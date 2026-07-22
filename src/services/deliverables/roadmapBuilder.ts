import type { RoadmapPhase } from '../../types/deliverables'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'
import { BlockBuilder, NEEDS } from './contentBlocks'

/* ------------------------------------------------------------------ */
/* 구현 로드맵 빌더 (Stage 10)                                           */
/*                                                                     */
/* 확정 설계 스냅샷을 보고 트랙별 구현 단계를 결정적으로 만든다.           */
/* AX와 홈페이지 단계는 별도로 유지하며 합치지 않는다.                     */
/* 근거 없는 기간·비용 숫자를 만들지 않고 기간은 '담당 개발자 산정 필요'.   */
/* ------------------------------------------------------------------ */

interface PhaseTemplate {
  name: string
  objective: string
  scope: string
  deliverables: string[]
  successCriteria: string[]
  risks: string[]
}

const AX_PHASES: PhaseTemplate[] = [
  {
    name: '범위 확정',
    objective: '확정된 AX MVP 설계 범위를 개발 착수 기준으로 재확인한다.',
    scope: 'Must·Should 기능, 화면, 데이터, 역할, 제외 범위를 개발 관점에서 점검하고 개발 환경을 준비한다.',
    deliverables: ['개발 범위 확인 문서(Must/Should/제외)', '기술 스택·저장소·개발 환경 세팅', '설계 인계 스냅샷 검토 결과'],
    successCriteria: ['Must 기능 목록이 설계 인계 스냅샷과 일치함', '이 문서 범위 밖 기능이 명시적으로 제외됨'],
    risks: ['설계 확정 이후 범위가 재확장될 위험', '개발 환경 준비 지연'],
  },
  {
    name: '데이터·샘플 준비',
    objective: '실제 업무 데이터 구조와 샘플을 확보한다.',
    scope: '엔티티·필드·민감정보 항목을 확정하고 테스트용 샘플 데이터를 준비한다.',
    deliverables: ['데이터 모델 정의(엔티티·필드·타입)', '샘플·시드 데이터', '개인정보·민감정보 취급 기준'],
    successCriteria: ['핵심 엔티티의 필드·타입이 설계와 일치함', '민감 데이터 항목이 식별·표시됨'],
    risks: ['실제 데이터 확보 지연', '샘플 데이터가 실제 업무를 대표하지 못할 위험'],
  },
  {
    name: '기반 화면·저장 구조',
    objective: '공통 레이아웃·디자인 시스템·저장 구조를 만든다.',
    scope: '기반 UI 컴포넌트, 라우팅, 저장소(Repository) 계층을 구축한다.',
    deliverables: ['공통 레이아웃·디자인 시스템', '저장소(Repository) 계층', '기본 라우팅·네비게이션'],
    successCriteria: ['주요 화면 골격이 렌더링됨', '데이터 저장·조회가 동작함'],
    risks: ['기반 구조 변경 시 광범위한 재작업', '디자인 시스템 미확정'],
  },
  {
    name: '핵심 업무 흐름',
    objective: '핵심 입력·목록·상세 등 주요 업무 흐름을 구현한다.',
    scope: 'Must 기능의 입력 폼·목록·상세 화면과 기본 업무 처리를 구현한다.',
    deliverables: ['핵심 입력 폼', '목록·상세 화면', '기본 업무 처리 흐름'],
    successCriteria: ['핵심 업무를 처음부터 끝까지 수행 가능', '수용 기준의 정상 흐름이 통과됨'],
    risks: ['업무 흐름 이해 부족으로 인한 재작업'],
  },
  {
    name: '계산·규칙',
    objective: '업무 규칙·계산 로직을 구현한다.',
    scope: '검증·계산·분류·라우팅 등 비즈니스 규칙을 구현한다.',
    deliverables: ['업무 규칙·검증 로직', '계산·분류 처리', '규칙 확인이 필요한 항목 목록'],
    successCriteria: ['규칙이 설계의 조건→결과와 일치함', '확인이 필요한 규칙이 담당자 검토를 거침'],
    risks: ['확정되지 않은 규칙 존재', '규칙 해석 차이'],
  },
  {
    name: '권한·예외',
    objective: '역할별 권한과 예외·오류 처리를 구현한다.',
    scope: '역할·권한 규칙, 예외 시나리오, 오류 처리, 변경 이력을 구현한다.',
    deliverables: ['역할·권한 제어', '예외·오류 처리', '변경 이력'],
    successCriteria: ['권한 시나리오가 설계대로 동작함', '주요 예외 상황이 처리됨'],
    risks: ['권한 경계 누락', '전문가 최종판단 필요 영역의 자동화 위험'],
  },
  {
    name: '현장 테스트',
    objective: '실제 사용자가 실제 업무로 테스트한다.',
    scope: '테스트 버전 배포, 시나리오 실행, 피드백·이슈·KPI를 수집한다.',
    deliverables: ['테스트 버전', '시나리오 실행 결과', '피드백·이슈·증거 기록'],
    successCriteria: ['핵심 시나리오가 실제 사용자로 실행됨', '이슈·피드백이 근거와 함께 기록됨'],
    risks: ['참여자 확보 어려움', '테스트 환경과 실제 환경 차이'],
  },
  {
    name: '수정·재시험',
    objective: '테스트에서 발견된 문제를 수정하고 재시험한다.',
    scope: '실패·미해결 이슈를 수정하고 회귀를 방지하며 재시험 시나리오를 실행한다.',
    deliverables: ['이슈 수정 내역', '회귀 테스트 결과', '재시험 결과'],
    successCriteria: ['중대 이슈가 해결·검증됨', '재시험 시나리오가 통과됨'],
    risks: ['수정이 다른 기능에 영향(회귀)', '반복 재시험으로 인한 일정 지연'],
  },
  {
    name: '운영 준비',
    objective: '실제 운영 전환을 준비한다.',
    scope: '배포·백업·권한·교육·운영 문서를 준비한다.',
    deliverables: ['운영 배포 구성', '운영 매뉴얼·인수인계 문서', '백업·복구 절차'],
    successCriteria: ['운영 환경에서 핵심 업무가 동작함', '담당자가 운영 절차를 숙지함'],
    risks: ['운영 전환 시 데이터 이관 문제', '운영 담당자 교육 부족'],
  },
]

const WEBSITE_PHASES: PhaseTemplate[] = [
  {
    name: '콘텐츠·자산 수집',
    objective: '홈페이지에 필요한 콘텐츠와 자산을 수집한다.',
    scope: '문구·이미지·로고·사례 등 콘텐츠 요구사항과 자산 준비 상태를 정리한다.',
    deliverables: ['콘텐츠 요구 목록·준비 상태', '로고·이미지 등 자산 목록', '부족 콘텐츠·자산 확보 계획'],
    successCriteria: ['필수 콘텐츠 항목이 식별됨', '부족한 자산의 확보 담당·방법이 정해짐'],
    risks: ['콘텐츠·자산 확보 지연', '저작권·사용권 미확인 자산'],
  },
  {
    name: '사이트 구조 확정',
    objective: '사이트맵과 페이지 구조를 확정한다.',
    scope: '페이지 목록·네비게이션·URL 구조를 개발 기준으로 확정한다.',
    deliverables: ['확정 사이트맵', '네비게이션 구조', '페이지별 목적·전환 목표'],
    successCriteria: ['필수 페이지가 사이트맵에 포함됨', '페이지 간 연결이 정의됨'],
    risks: ['페이지 범위 확장', '전환 흐름 미정의'],
  },
  {
    name: '디자인 방향 확정',
    objective: '디자인 방향·브랜드 톤을 개발 가능한 기준으로 확정한다.',
    scope: '색상·타이포·간격·모션·금지 스타일을 확정한다.',
    deliverables: ['디자인 방향 정의(색상·타이포·간격)', '금지 스타일 목록', '반응형·접근성 원칙'],
    successCriteria: ['디자인 방향이 설계 스냅샷과 일치함', '금지 스타일이 명시됨'],
    risks: ['취향 기반 디자인 재수정 반복', '브랜드 자산 부재'],
  },
  {
    name: '홈 페이지',
    objective: '홈(메인) 페이지를 구현한다.',
    scope: '히어로·문제·솔루션·신뢰·전환 등 핵심 섹션을 구현한다.',
    deliverables: ['홈 페이지 구현', '핵심 섹션·CTA', '반응형 레이아웃'],
    successCriteria: ['홈 페이지가 디자인 방향대로 렌더링됨', '핵심 CTA가 동작함'],
    risks: ['콘텐츠 미확정으로 임시 문구 사용', '핵심 메시지 불명확'],
  },
  {
    name: '하위 페이지',
    objective: '소개·서비스·사례 등 하위 페이지를 구현한다.',
    scope: '사이트맵의 나머지 필수·권장 페이지를 구현한다.',
    deliverables: ['하위 페이지 구현', '페이지별 섹션·콘텐츠', '내부 링크·SEO 기본'],
    successCriteria: ['필수 하위 페이지가 구현됨', '내부 링크가 연결됨'],
    risks: ['페이지별 콘텐츠 부족', '일관성 없는 레이아웃'],
  },
  {
    name: '문의·CTA',
    objective: '문의 폼과 전환 행동을 구현한다.',
    scope: '폼·전환 버튼·수신 처리·개인정보 동의를 구현한다.',
    deliverables: ['문의·상담 폼', '전환 버튼·연결', '개인정보 동의·스팸 방지'],
    successCriteria: ['문의가 지정 수신처로 전달됨', '개인정보 동의가 처리됨'],
    risks: ['폼 수신·스팸 처리 미비', '개인정보 처리 기준 미확정'],
  },
  {
    name: '모바일·접근성',
    objective: '모바일 대응과 기본 접근성을 확보한다.',
    scope: '반응형 레이아웃, 모바일 동작, 접근성 기준을 적용한다.',
    deliverables: ['반응형·모바일 대응', '접근성 기본 적용', '주요 브라우저 확인'],
    successCriteria: ['주요 화면이 모바일에서 정상 표시됨', '기본 접근성 기준을 충족함'],
    risks: ['모바일 레이아웃 깨짐', '접근성 기준 미충족'],
  },
  {
    name: '콘텐츠 검수',
    objective: '실제 콘텐츠를 반영하고 검수한다.',
    scope: '임시 문구를 실제 콘텐츠로 교체하고 오탈자·링크를 검수한다.',
    deliverables: ['실제 콘텐츠 반영', '오탈자·링크 검수 결과', 'SEO 메타 정보'],
    successCriteria: ['임시 문구가 실제 콘텐츠로 교체됨', '깨진 링크가 없음'],
    risks: ['실제 콘텐츠 최종본 지연', '검수 누락'],
  },
  {
    name: '공개 전 테스트',
    objective: '공개 전 실제 사용 테스트를 수행한다.',
    scope: '전환 흐름·폼·표시를 시나리오로 점검한다.',
    deliverables: ['공개 전 점검 결과', '전환·폼 동작 확인', '발견 이슈 목록'],
    successCriteria: ['핵심 전환 흐름이 동작함', '중대 이슈가 해결됨'],
    risks: ['공개 직전 이슈 발견', '실제 트래픽 환경 미검증'],
  },
  {
    name: '공개 준비',
    objective: '도메인 연결·분석·공개를 준비한다.',
    scope: '도메인·호스팅·분석 도구·검색 등록을 준비한다.',
    deliverables: ['도메인·호스팅 구성', '분석·검색 등록', '공개 체크리스트'],
    successCriteria: ['도메인·호스팅이 준비됨', '공개 체크리스트가 완료됨'],
    risks: ['도메인·인증서 문제', '분석·검색 등록 누락'],
  },
]

function buildTrackPhases(
  templates: PhaseTemplate[],
  track: 'ax' | 'website',
  startOrder: number,
): RoadmapPhase[] {
  return templates.map((tpl, i) => ({
    id: `phase-${track}-${i}`,
    track,
    name: tpl.name,
    objective: tpl.objective,
    scope: tpl.scope,
    deliverables: tpl.deliverables,
    dependencies: i === 0 ? [] : [templates[i - 1].name],
    owner: '',
    estimatedDurationText: NEEDS.devEstimate,
    successCriteria: tpl.successCriteria,
    risks: tpl.risks,
    status: 'planned',
    orderIndex: startOrder + i,
  }))
}

function renderPhases(builder: BlockBuilder, phases: RoadmapPhase[], trackLabel: string): void {
  if (phases.length === 0) return
  builder.heading(`${trackLabel} 구현 단계`)
  builder.timeline(phases.map((p) => `${p.orderIndex + 1}. ${p.name}`))
  for (const p of phases) {
    builder.heading(`${p.orderIndex + 1}. ${p.name}`)
    builder.keyValue([
      { key: '목표', value: p.objective },
      { key: '범위', value: p.scope },
      { key: '선행조건', value: p.dependencies.length > 0 ? p.dependencies.join(', ') : '없음(첫 단계)' },
      { key: '기간', value: p.estimatedDurationText },
    ])
    builder.bullets(p.deliverables, { title: '결과물' })
    builder.checklist(p.successCriteria, { title: '완료 기준' })
    builder.bullets(p.risks, { title: '리스크' })
  }
}

/** 확정 설계 스냅샷으로 트랙별 구현 로드맵과 렌더링 시드를 만든다. */
export function buildRoadmap(sources: CollectedSources): { phases: RoadmapPhase[]; seed: SectionSeed } {
  const hasAx = sources.mvpHandoff !== null
  const hasWebsite = sources.websiteHandoff !== null

  const axPhases = hasAx ? buildTrackPhases(AX_PHASES, 'ax', 0) : []
  const websitePhases = hasWebsite ? buildTrackPhases(WEBSITE_PHASES, 'website', axPhases.length) : []
  const phases = [...axPhases, ...websitePhases]

  const axRefId = sources.references.find((r) => r.sourceType === 'mvp_design_handoff' && r.available)?.id
  const webRefId = sources.references.find((r) => r.sourceType === 'website_design_handoff' && r.available)?.id
  const sourceReferences = [axRefId, webRefId].filter((id): id is string => Boolean(id))

  const builder = new BlockBuilder('roadmap')
  builder.callout(
    `기간·비용 숫자는 근거 없이 산정하지 않습니다. 각 단계의 기간은 "${NEEDS.devEstimate}"로 표기하며, 담당 개발자가 실제 범위를 보고 산정합니다.`,
    { title: '기간 산정 원칙', tone: 'info' },
  )
  if (hasAx && hasWebsite) {
    builder.paragraph('AX MVP와 홈페이지 구현 단계는 별도 트랙으로 관리하며 하나의 일정으로 합치지 않습니다.')
  }
  renderPhases(builder, axPhases, 'AX MVP')
  renderPhases(builder, websitePhases, '홈페이지')
  if (phases.length === 0) {
    builder.paragraph('확정된 AX MVP 설계 또는 홈페이지 설계가 없어 구현 로드맵을 생성할 수 없습니다.')
  }

  const seed: SectionSeed = {
    type: 'implementation_roadmap',
    track: 'roadmap',
    title: '구현 로드맵',
    subtitle: '트랙별 단계 · 목표 · 결과물 · 완료 기준',
    summary: '확정 설계를 개발 가능한 단계로 나눈 구현 로드맵입니다. 기간은 담당 개발자가 산정합니다.',
    blocks: builder.build(),
    sourceReferences,
    visibility: 'shared',
    required: false,
  }

  return { phases, seed }
}
