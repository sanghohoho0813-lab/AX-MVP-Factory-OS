import type {
  DeliverablePrompt,
  DeliverablePromptType,
  DeliverableTrackType,
} from '../../types/deliverables'
import type {
  DesignHandoffFeature,
  FeatureAutomationMode,
  FeatureScope,
  FeatureType,
  MvpDesignHandoffSnapshot,
} from '../../types/mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from '../../types/websiteDesign'
import type { ValidationHandoffSnapshot } from '../../types/validation'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'
import { BlockBuilder, DELIVERABLE_ISO } from './contentBlocks'

/* ------------------------------------------------------------------ */
/* Claude Code 개발 프롬프트 패키지 빌더 (Stage 10)                       */
/*                                                                     */
/* 확정 설계 스냅샷을 그대로 복사해 쓸 수 있는 개발 프롬프트로 변환한다.    */
/* 실제 Claude Code와 자동 연동하지 않으며, AX와 홈페이지 프롬프트는       */
/* 별도 항목으로 유지한다. 문서 범위 밖 기능은 만들지 않도록 지시한다.     */
/* ------------------------------------------------------------------ */

const NO_HALLUCINATION = '실제 존재하지 않는 기능을 상상해 만들지 말 것'
const NO_OUT_OF_SCOPE = '이 문서 범위 밖 기능 구현 금지'

const SCOPE_LABEL: Record<FeatureScope, string> = {
  must: '필수',
  should: '권장',
  later: '추후',
  excluded: '제외',
}
const AUTOMATION_LABEL: Record<FeatureAutomationMode, string> = {
  full_auto: '완전자동',
  assisted: '보조',
  human_confirm: '사람확정',
  manual_only: '수동',
}
const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  input_form: '입력폼',
  list_view: '목록',
  detail_view: '상세',
  rule_calculation: '규칙계산',
  document_generation: '문서생성',
  approval_flow: '승인흐름',
  notification: '알림',
  dashboard_report: '대시보드·보고서',
  search_filter: '검색·필터',
  data_validation: '데이터검증',
  status_tracking: '상태추적',
  ai_assist: 'AI보조',
  integration: '외부연동',
  admin_setting: '관리설정',
  other: '기타',
}

function lines(items: string[], fallback = '- (없음)'): string {
  const clean = items.filter((i) => i && i.trim())
  if (clean.length === 0) return fallback
  return clean.map((i) => `- ${i}`).join('\n')
}

function formatFeature(f: DesignHandoffFeature): string {
  const flags: string[] = []
  if (f.usesAi) flags.push('AI 사용')
  if (f.humanReviewRequired) flags.push('사람 검토 필요')
  if (f.expertJudgmentBoundary) flags.push('전문가 최종판단 경계(대체 금지)')
  const flagText = flags.length > 0 ? ` · ${flags.join(' · ')}` : ''
  return [
    `- ${f.name} [${SCOPE_LABEL[f.scope]}/${FEATURE_TYPE_LABEL[f.type]}/${AUTOMATION_LABEL[f.automationMode]}]${flagText}`,
    `  · 입력: ${f.input || '미정'}`,
    `  · 처리: ${f.processing || '미정'}`,
    `  · 출력: ${f.output || '미정'}`,
    `  · 수용 기준 ${f.acceptanceCount}개`,
  ].join('\n')
}

function formatFeatureList(features: DesignHandoffFeature[]): string {
  if (features.length === 0) return '- (없음)'
  return features.map(formatFeature).join('\n')
}

interface PromptParams {
  id: string
  track: DeliverableTrackType
  type: DeliverablePromptType
  title: string
  purpose: string
  content: string
  sequenceNumber: number
  prerequisites: string[]
  expectedOutput: string
  completionChecks: string[]
  version: number
  editNotes?: string
}

function makePrompt(p: PromptParams): DeliverablePrompt {
  return {
    id: p.id,
    packageId: '',
    track: p.track,
    type: p.type,
    title: p.title,
    purpose: p.purpose,
    content: p.content,
    sourceSectionIds: [],
    generatedFromVersion: p.version,
    generatedAt: DELIVERABLE_ISO,
    manuallyEdited: false,
    originalContent: p.content,
    editNotes: p.editNotes ?? '',
    sequenceNumber: p.sequenceNumber,
    prerequisites: p.prerequisites,
    expectedOutput: p.expectedOutput,
    completionChecks: p.completionChecks,
  }
}

/* ------------------------------ AX ------------------------------ */

function axFullContent(h: MvpDesignHandoffSnapshot): string {
  return [
    `[AX MVP 전체 개발 프롬프트 · Claude Code용]`,
    `당신은 아래 확정 설계를 그대로 구현하는 개발자입니다. 설계에 없는 기능을 추가하지 말고, 아래 범위만 정확히 구현하세요.`,
    ``,
    `## 프로젝트 개요`,
    `- 핵심 과제: ${h.coreTaskName || '미정'}`,
    `- MVP 수준: ${h.selectedLevel}`,
    ``,
    `## 해결할 문제`,
    h.problemStatement || '- (미정)',
    ``,
    `## 사용자`,
    h.targetUsers || '- (미정)',
    ``,
    `## 목표`,
    h.goalStatement || '- (미정)',
    ``,
    `## 기술 범위 · 필수(Must) 기능`,
    `각 기능은 입력→처리→출력과 수용 기준을 지켜 구현합니다.`,
    formatFeatureList(h.mustFeatures),
    ``,
    `## 권장(Should) 기능 — Must 완료 후에만 착수`,
    formatFeatureList(h.shouldFeatures),
    ``,
    `## 추후(Later) — 이번 범위 아님`,
    lines(h.laterFeatures),
    ``,
    `## 제외(Excluded) — 구현 금지`,
    lines(h.excludedFeatures),
    ``,
    `## 화면`,
    lines(h.screenNames),
    ``,
    `## 데이터(엔티티)`,
    lines(h.entityNames),
    ``,
    `## 권한(역할)`,
    lines(h.roleNames),
    ``,
    `## 업무 규칙`,
    lines(h.keyBusinessRules),
    ``,
    `## AI 사용 범위`,
    lines(h.aiFeatureNames, '- (AI 기능 없음)'),
    `- AI 출력은 초안이며 사람이 확정합니다. 세무·노무·법률·의료 등 전문가 최종판단을 AI로 대체하지 마세요.`,
    ``,
    `## AI 금지 판단`,
    `- 전문가 최종판단이 필요한 영역은 자동 확정하지 말고 사람 검토 단계를 둡니다.`,
    ``,
    `## 연동(외부 시스템)`,
    lines(h.integrationNames, '- (외부 연동 없음)'),
    ``,
    `## 오류·예외`,
    `- 잘못된 입력, 데이터 누락, 권한 없음, 외부 실패, 충돌, 전문가 필요 상황을 각 기능에서 처리합니다.`,
    ``,
    `## 반응형`,
    `- 담당 사용자의 실제 사용 기기를 기준으로 데스크톱·모바일에서 사용 가능해야 합니다.`,
    ``,
    `## 접근성`,
    `- 기본 접근성(대비, 키보드 조작, 레이블)을 준수합니다.`,
    ``,
    `## 수용 기준`,
    `- 각 Must 기능의 수용 기준(Given/When/Then)을 만족해야 완료로 봅니다.`,
    ``,
    `## 테스트`,
    `- 정상 흐름, 검증, 권한, 예외, 경계값 시나리오를 각각 확인합니다.`,
    ``,
    `## KPI`,
    lines(h.kpiSummaries, '- (측정 지표 미정)'),
    ``,
    `## 구현 금지 범위 / 완료 기준`,
    lines(h.outOfScope, '- (명시된 제외 범위 없음)'),
    `- ${NO_OUT_OF_SCOPE}`,
    `- ${NO_HALLUCINATION}`,
    `- 완료 기준: 위 Must 기능이 수용 기준을 만족하고, 제외 범위가 구현되지 않았으며, 오류·권한·예외가 처리됨.`,
    ``,
    `## Git · 배포 원칙`,
    `- 의미 있는 단위로 커밋하고, 기능별 브랜치를 사용합니다. 배포는 담당자 확인 후 진행합니다.`,
  ].join('\n')
}

interface AxStageSpec {
  key: string
  title: string
  scope: string
  structures: string
  notImplement: string
  tests: string
  checks: string[]
}

function axStages(h: MvpDesignHandoffSnapshot, hasReporting: boolean): AxStageSpec[] {
  const stages: AxStageSpec[] = [
    {
      key: 'foundation',
      title: '기반·디자인 시스템',
      scope: '공통 레이아웃, 라우팅, 디자인 시스템, 기본 컴포넌트를 만든다.',
      structures: '레이아웃 셸, 라우터, 공통 UI 컴포넌트, 테마.',
      notImplement: '- 업무 기능·데이터 로직은 아직 구현하지 않는다.',
      tests: '- 주요 화면 골격이 렌더링되고 네비게이션이 동작하는지 확인.',
      checks: ['공통 레이아웃·라우팅 동작', '디자인 시스템 기본 컴포넌트 사용 가능'],
    },
    {
      key: 'data',
      title: '데이터 모델·Repository',
      scope: `엔티티·필드·저장소(Repository) 계층을 만든다. 대상 엔티티: ${h.entityNames.join(', ') || '설계 참조'}.`,
      structures: '엔티티 타입 정의, Repository, 시드·샘플 데이터.',
      notImplement: '- 화면 세부 UI는 아직 다루지 않는다.',
      tests: '- 저장·조회·수정·삭제가 동작하는지 확인.',
      checks: ['핵심 엔티티 CRUD 동작', '민감 데이터 항목 표시'],
    },
    {
      key: 'core_input',
      title: '핵심 입력·목록',
      scope: '필수 입력 폼과 목록·상세 화면을 구현한다.',
      structures: '입력 폼, 목록·상세 화면, 검증.',
      notImplement: '- 복잡한 계산·규칙은 다음 단계에서 다룬다.',
      tests: '- 입력→저장→목록 표시 정상 흐름 확인.',
      checks: ['핵심 입력·목록·상세 동작', '필수 항목 검증 동작'],
    },
    {
      key: 'core_process',
      title: '핵심 업무 처리',
      scope: '핵심 업무 흐름(상태 전이·처리)을 구현한다.',
      structures: '업무 처리 서비스, 상태 관리.',
      notImplement: '- 권한·이력은 다음 단계에서 다룬다.',
      tests: '- 핵심 업무를 처음부터 끝까지 수행 가능한지 확인.',
      checks: ['핵심 업무 흐름 완주 가능', '수용 기준 정상 흐름 통과'],
    },
    {
      key: 'rules',
      title: '규칙·계산',
      scope: `업무 규칙·계산·분류·라우팅을 구현한다. 주요 규칙: ${h.keyBusinessRules.join(' / ') || '설계 참조'}.`,
      structures: '규칙·계산 로직, 검증 규칙.',
      notImplement: '- 확정되지 않은 규칙은 임의로 만들지 말고 담당자 확인 항목으로 표시한다.',
      tests: '- 규칙의 조건→결과가 설계와 일치하는지 확인.',
      checks: ['규칙·계산 결과가 설계와 일치', '확인 필요 규칙 목록화'],
    },
    {
      key: 'permission',
      title: '권한·이력·예외',
      scope: `역할별 권한, 변경 이력, 예외·오류 처리를 구현한다. 역할: ${h.roleNames.join(', ') || '설계 참조'}.`,
      structures: '권한 제어, 이력 기록, 예외 처리.',
      notImplement: '- 전문가 최종판단 필요 영역을 자동 확정하지 않는다.',
      tests: '- 권한 시나리오와 주요 예외 상황 처리 확인.',
      checks: ['권한 시나리오 동작', '주요 예외 처리'],
    },
  ]
  if (hasReporting) {
    stages.push({
      key: 'report',
      title: '보고서·내보내기',
      scope: '대시보드·보고서·내보내기(문서 생성)를 구현한다.',
      structures: '집계·보고서 화면, 내보내기.',
      notImplement: '- 근거 없는 수치를 표시하지 않는다.',
      tests: '- 보고서 수치가 실제 데이터와 일치하는지 확인.',
      checks: ['보고서·내보내기 동작', '수치가 원본 데이터와 일치'],
    })
  }
  stages.push({
    key: 'test_deploy',
    title: '테스트·반응형·배포',
    scope: '전체 시나리오 테스트, 반응형·접근성 점검, 배포 준비를 한다.',
    structures: '테스트, 반응형 보정, 배포 구성.',
    notImplement: '- 새 기능을 추가하지 않는다. 발견된 문제만 수정한다.',
    tests: '- 정상·검증·권한·예외·경계값·모바일 시나리오 확인.',
    checks: ['핵심 시나리오 통과', '모바일·접근성 기본 충족', '배포 구성 준비'],
  })
  return stages
}

function axStageContent(stage: AxStageSpec, index: number, prereqTitles: string[]): string {
  return [
    `[AX MVP 단계별 개발 · ${index + 1}단계: ${stage.title}]`,
    ``,
    `## 현재 단계`,
    `${index + 1}. ${stage.title}`,
    ``,
    `## 전제조건`,
    prereqTitles.length > 0 ? lines(prereqTitles) : '- 없음(첫 단계)',
    ``,
    `## 구현 범위`,
    `- ${stage.scope}`,
    ``,
    `## 수정할 구조`,
    `- ${stage.structures}`,
    ``,
    `## 구현하지 않을 것`,
    stage.notImplement,
    `- ${NO_OUT_OF_SCOPE}`,
    `- ${NO_HALLUCINATION}`,
    ``,
    `## 테스트`,
    stage.tests,
    ``,
    `## 완료 기준`,
    lines(stage.checks),
    ``,
    `## Git 처리`,
    `- 이 단계 작업을 의미 있는 단위로 커밋하고, 단계 완료 시 정리해 커밋한다.`,
    ``,
    `## 완료 보고 형식`,
    `- 구현한 항목 / 남은 항목 / 발견한 문제 / 다음 단계 제안을 3~5줄로 보고한다.`,
  ].join('\n')
}

function axRevisionContent(v: ValidationHandoffSnapshot): string {
  const failed = v.failedCriteria.filter((i) => i.trim())
  const unresolved = v.unresolvedIssues.filter((i) => i.trim())
  return [
    `[AX MVP 수정·재시험 프롬프트]`,
    `실제 사용 테스트에서 발견된 아래 문제만 수정합니다. 새 기능을 추가하지 마세요.`,
    ``,
    `## 문제 (실패한 기준)`,
    lines(failed, '- (실패한 기준 없음)'),
    ``,
    `## 문제 (미해결 이슈)`,
    lines(unresolved, '- (미해결 이슈 없음)'),
    ``,
    `## 재현 절차`,
    `- 각 문제의 재현 절차를 확인한 뒤 수정에 착수합니다. 재현이 안 되면 담당자에게 확인합니다.`,
    ``,
    `## 기대 행동 / 실제 행동`,
    `- 기대 행동과 실제 행동의 차이를 명확히 하고, 기대 행동에 맞게 수정합니다.`,
    ``,
    `## 영향`,
    `- 수정이 영향을 주는 기능·화면을 먼저 파악합니다.`,
    ``,
    `## 관련 기능·화면`,
    `- 위 문제와 연결된 기능·화면만 수정 대상으로 합니다.`,
    ``,
    `## 수정 범위 / 회귀 금지`,
    `- 문제와 무관한 코드를 바꾸지 않습니다. 기존 통과 시나리오가 깨지지 않도록 합니다(회귀 금지).`,
    ``,
    `## 재시험 시나리오`,
    `- 수정 후 실패했던 시나리오와 인접 정상 시나리오를 다시 실행합니다.`,
    ``,
    `## 완료 기준`,
    `- 위 문제가 해결·검증되고, 회귀가 없으며, 재시험 시나리오가 통과됨.`,
  ].join('\n')
}

function buildAxPrompts(sources: CollectedSources): DeliverablePrompt[] {
  const h = sources.mvpHandoff
  if (!h) return []
  const version = sources.mvpDesign?.version ?? 0
  const prompts: DeliverablePrompt[] = []

  prompts.push(
    makePrompt({
      id: 'prompt-ax-full',
      track: 'ax',
      type: 'ax_full_build',
      title: 'AX MVP 전체 개발 프롬프트',
      purpose: '확정 AX MVP 설계 전체를 한 번에 전달하는 종합 개발 프롬프트',
      content: axFullContent(h),
      sequenceNumber: 0,
      prerequisites: [],
      expectedOutput: '설계 범위에 맞는 동작하는 AX MVP',
      completionChecks: ['Must 기능이 수용 기준을 만족', '제외 범위 미구현', '오류·권한·예외 처리'],
      version,
    }),
  )

  const allFeatures = [...h.mustFeatures, ...h.shouldFeatures]
  const hasReporting =
    h.kpiSummaries.length > 0 ||
    allFeatures.some((f) => f.type === 'dashboard_report' || f.type === 'document_generation')
  const stages = axStages(h, hasReporting)
  const prereq: string[] = []
  stages.forEach((stage, i) => {
    prompts.push(
      makePrompt({
        id: `prompt-ax-stage-${i + 1}`,
        track: 'ax',
        type: 'ax_staged_build',
        title: `AX ${i + 1}단계 · ${stage.title}`,
        purpose: `단계별 개발 · ${stage.title}`,
        content: axStageContent(stage, i, [...prereq]),
        sequenceNumber: i + 1,
        prerequisites: [...prereq],
        expectedOutput: `${stage.title} 완료`,
        completionChecks: stage.checks,
        version,
      }),
    )
    prereq.push(`${i + 1}단계 · ${stage.title}`)
  })

  const v = sources.axValidationHandoff
  const hasIssues = v !== null && (v.failedCriteria.some((i) => i.trim()) || v.unresolvedIssues.some((i) => i.trim()))
  if (v && hasIssues) {
    prompts.push(
      makePrompt({
        id: 'prompt-ax-revision',
        track: 'ax',
        type: 'ax_design_revision',
        title: 'AX 수정·재시험 프롬프트',
        purpose: '실제 사용 테스트에서 발견된 문제를 수정하고 재시험',
        content: axRevisionContent(v),
        sequenceNumber: stages.length + 1,
        prerequisites: prereq,
        expectedOutput: '중대 이슈 해결 및 재시험 통과',
        completionChecks: ['중대 이슈 해결·검증', '회귀 없음', '재시험 시나리오 통과'],
        version,
      }),
    )
  }

  return prompts
}

/* --------------------------- Website --------------------------- */

function websiteFullContent(h: WebsiteDesignHandoffSnapshot): string {
  const d = h.designDirection
  return [
    `[홈페이지 전체 개발 프롬프트 · Claude Code용]`,
    `아래 확정 설계대로 홈페이지를 구현합니다. 설계에 없는 페이지·기능을 추가하지 마세요.`,
    ``,
    `## 목적 · 목표`,
    `- 목적: ${h.strategy.purpose || '미정'}`,
    `- 비즈니스 목표: ${h.strategy.businessGoal || '미정'}`,
    `- 유형: ${h.strategy.websiteType}`,
    `- 핵심 메시지: ${h.strategy.keyMessage || '미정'}`,
    `- 차별점: ${h.strategy.differentiation || '미정'}`,
    ``,
    `## 사이트맵`,
    lines(h.sitemap),
    ``,
    `## 페이지`,
    h.pages.length > 0
      ? h.pages
          .map((p) => `- ${p.name} (${p.slug}) [${p.status}] · ${p.purpose || '목적 미정'} · 섹션: ${p.sectionTitles.join(', ') || '미정'}`)
          .join('\n')
      : '- (페이지 없음)',
    ``,
    `## 콘텐츠 요구`,
    lines(h.contentRequirements),
    ``,
    `## 자산 요구`,
    lines(h.assetRequirements),
    ``,
    `## 디자인 방향`,
    `- 성격: ${d.personalities.join(', ') || '미정'}`,
    `- 색상: ${d.primaryColorDirection || '미정'} / ${d.secondaryColorDirection || '-'} / ${d.accentColorDirection || '-'}`,
    `- 타이포: ${d.typographyDirection || '미정'}`,
    `- 간격 밀도: ${d.spacingDensity} · 모서리: ${d.cornerStyle} · 모션: ${d.motionStyle}`,
    `- 금지 스타일: ${d.prohibitedStyles.join(', ') || '없음'}`,
    ``,
    `## 기술 범위`,
    `- 프레임워크 선호: ${h.technicalScope.frameworkPreference}`,
    `- 반응형: ${h.technicalScope.responsive ? '예' : '아니오'} · 폼: ${h.technicalScope.forms ? '예' : '아니오'} · 분석: ${h.technicalScope.analytics ? '예' : '아니오'}`,
    `- 접근성 수준: ${h.technicalScope.accessibilityLevel || '기본'}`,
    ``,
    `## 폼`,
    h.forms.length > 0
      ? h.forms.map((f) => `- ${f.name}: ${f.fields.join(', ')} → ${f.destination || '수신처 미정'}${f.privacyConsentRequired ? ' (개인정보 동의 필요)' : ''}`).join('\n')
      : '- (폼 없음)',
    ``,
    `## 외부 연동`,
    h.integrations.length > 0 ? h.integrations.map((i) => `- ${i.name}: ${i.purpose}`).join('\n') : '- (외부 연동 없음)',
    ``,
    `## 제외 범위 / 완료 기준`,
    lines(h.technicalScope.excludedTechnicalScope, '- (명시된 제외 범위 없음)'),
    `- ${NO_OUT_OF_SCOPE}`,
    `- ${NO_HALLUCINATION}`,
    `- 완료 기준: 필수 페이지·섹션·폼이 구현되고, 반응형·기본 접근성을 충족하며, 제외 범위가 구현되지 않음.`,
    ``,
    `## Git · 배포 원칙`,
    `- 페이지·기능별로 커밋하고, 공개는 담당자 확인 후 진행합니다.`,
  ].join('\n')
}

interface WebStageSpec {
  key: string
  title: string
  scope: string
  checks: string[]
}

const WEB_STAGES: WebStageSpec[] = [
  { key: 'content', title: '콘텐츠·자산 수집', scope: '필요한 콘텐츠·자산을 정리하고 준비 상태를 확인한다.', checks: ['필수 콘텐츠 항목 식별', '자산 준비 상태 확인'] },
  { key: 'sitemap', title: '사이트 구조', scope: '사이트맵·네비게이션·URL 구조를 구성한다.', checks: ['필수 페이지 라우팅', '네비게이션 동작'] },
  { key: 'design', title: '디자인', scope: '디자인 시스템(색상·타이포·간격)과 공통 컴포넌트를 만든다.', checks: ['디자인 방향 반영', '금지 스타일 미사용'] },
  { key: 'home', title: '홈', scope: '홈(메인) 페이지의 핵심 섹션과 CTA를 구현한다.', checks: ['홈 페이지 렌더링', '핵심 CTA 동작'] },
  { key: 'subpages', title: '하위 페이지', scope: '나머지 필수·권장 페이지를 구현한다.', checks: ['필수 하위 페이지 구현', '내부 링크 연결'] },
  { key: 'forms', title: '문의·CTA', scope: '문의 폼·전환 버튼·수신 처리·개인정보 동의를 구현한다.', checks: ['문의 전달 동작', '개인정보 동의 처리'] },
  { key: 'mobile', title: '모바일·접근성', scope: '반응형·모바일 동작과 기본 접근성을 적용한다.', checks: ['모바일 정상 표시', '기본 접근성 충족'] },
  { key: 'review', title: '검수', scope: '실제 콘텐츠 반영과 오탈자·링크·SEO 메타를 검수한다.', checks: ['실제 콘텐츠 반영', '깨진 링크 없음'] },
  { key: 'pretest', title: '공개 전 테스트', scope: '전환 흐름·폼·표시를 시나리오로 점검한다.', checks: ['핵심 전환 흐름 동작', '중대 이슈 해결'] },
]

function webStageContent(stage: WebStageSpec, index: number, prereqTitles: string[]): string {
  return [
    `[홈페이지 단계별 개발 · ${index + 1}단계: ${stage.title}]`,
    ``,
    `## 현재 단계`,
    `${index + 1}. ${stage.title}`,
    ``,
    `## 전제조건`,
    prereqTitles.length > 0 ? lines(prereqTitles) : '- 없음(첫 단계)',
    ``,
    `## 구현 범위`,
    `- ${stage.scope}`,
    ``,
    `## 구현하지 않을 것`,
    `- ${NO_OUT_OF_SCOPE}`,
    `- ${NO_HALLUCINATION}`,
    ``,
    `## 테스트 / 완료 기준`,
    lines(stage.checks),
    ``,
    `## Git 처리`,
    `- 단계 작업을 의미 있는 단위로 커밋한다.`,
    ``,
    `## 완료 보고 형식`,
    `- 구현한 항목 / 남은 항목 / 발견한 문제를 3~5줄로 보고한다.`,
  ].join('\n')
}

function buildWebsitePrompts(sources: CollectedSources): DeliverablePrompt[] {
  const h = sources.websiteHandoff
  if (!h) return []
  const version = sources.websiteDesign?.version ?? 0
  const prompts: DeliverablePrompt[] = []

  const selected = h.selectedPrompt
  const useSelected = selected !== null && selected.content.trim().length > 0
  const fullContent = useSelected && selected ? selected.content : websiteFullContent(h)
  prompts.push(
    makePrompt({
      id: 'prompt-web-full',
      track: 'website',
      type: 'website_full_build',
      title: '홈페이지 전체 개발 프롬프트',
      purpose: useSelected
        ? '홈페이지 설계에서 확정한 개발 지시문(수정본 사용)'
        : '확정 홈페이지 설계 전체를 전달하는 종합 개발 프롬프트',
      content: fullContent,
      sequenceNumber: 0,
      prerequisites: [],
      expectedOutput: '설계 범위에 맞는 동작하는 홈페이지',
      completionChecks: ['필수 페이지·섹션·폼 구현', '반응형·기본 접근성 충족', '제외 범위 미구현'],
      version,
      editNotes: useSelected ? '홈페이지 설계에서 선택·수정한 지시문을 사용함.' : '',
    }),
  )

  const prereq: string[] = []
  WEB_STAGES.forEach((stage, i) => {
    prompts.push(
      makePrompt({
        id: `prompt-web-stage-${i + 1}`,
        track: 'website',
        type: 'website_staged_build',
        title: `홈페이지 ${i + 1}단계 · ${stage.title}`,
        purpose: `단계별 개발 · ${stage.title}`,
        content: webStageContent(stage, i, [...prereq]),
        sequenceNumber: i + 1,
        prerequisites: [...prereq],
        expectedOutput: `${stage.title} 완료`,
        completionChecks: stage.checks,
        version,
      }),
    )
    prereq.push(`${i + 1}단계 · ${stage.title}`)
  })

  return prompts
}

/** 확정 설계로 AX·홈페이지 개발 프롬프트를 결정적으로 만든다(트랙 분리). */
export function buildPrompts(sources: CollectedSources): DeliverablePrompt[] {
  return [...buildAxPrompts(sources), ...buildWebsitePrompts(sources)]
}

/** 개발 프롬프트 목록을 개발자용 섹션 시드로 렌더링한다. */
export function buildPromptSeed(prompts: DeliverablePrompt[]): SectionSeed {
  const builder = new BlockBuilder('prompt')

  if (prompts.length === 0) {
    builder.paragraph('개발 프롬프트를 생성할 확정 설계가 없습니다. AX MVP 설계 또는 홈페이지 설계를 확정하면 프롬프트가 생성됩니다.')
    return {
      type: 'developer_prompt',
      track: 'prompt',
      title: '개발 프롬프트 패키지',
      subtitle: '확정 설계 없음',
      blocks: builder.build(),
      sourceReferences: [],
      visibility: 'developer_visible',
      required: false,
    }
  }

  builder.callout(
    '실제 Claude Code와 자동 연동하지 않습니다. 순서대로 복사해 사용하세요.',
    { title: '사용 방법', tone: 'info' },
  )
  builder.table(
    ['순서', '제목', '목적'],
    prompts.map((p) => ({ cells: [String(p.sequenceNumber), p.title, p.purpose] })),
    { title: '프롬프트 목록' },
  )
  for (const p of prompts) {
    builder.heading(p.title)
    if (p.prerequisites.length > 0) {
      builder.keyValue([{ key: '전제조건', value: p.prerequisites.join(', ') }])
    }
    builder.prompt(p.content, { title: p.purpose })
  }

  return {
    type: 'developer_prompt',
    track: 'prompt',
    title: '개발 프롬프트 패키지',
    subtitle: 'AX · 홈페이지 개발 프롬프트 (트랙 분리)',
    summary: '확정 설계를 그대로 복사해 쓸 수 있는 개발 프롬프트 모음입니다.',
    blocks: builder.build(),
    sourceReferences: [],
    visibility: 'developer_visible',
    required: false,
  }
}
