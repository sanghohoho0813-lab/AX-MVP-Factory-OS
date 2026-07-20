import type {
  DesignHandoffFeature,
  FeatureAutomationMode,
  FeatureType,
} from '../../types/mvpDesign'
import type { DeliverableKeyValue } from '../../types/deliverables'
import { BlockBuilder, NEEDS } from './contentBlocks'
import type { CollectedSources } from './sourceCollector'
import type { SectionSeed } from './sectionFactory'

/* ------------------------------------------------------------------ */
/* Stage 10 · AX MVP 기능 명세 딜리버러블 빌더                          */
/*                                                                     */
/* 확정된 MvpDesignHandoffSnapshot(동결 스냅샷)만을 근거로 개발자용     */
/* 명세 섹션 시드를 결정적으로 생성한다. 순수 데이터(React 없음),        */
/* 임의 수치·결과 생성 없음, 한국어.                                    */
/* ------------------------------------------------------------------ */

/** FeatureType 한글 라벨 (mvpDesignMeta의 아이콘 의존 없이 로컬 정의) */
const FEATURE_TYPE_LABEL: Record<FeatureType, string> = {
  input_form: '입력 폼',
  list_view: '목록 조회',
  detail_view: '상세 조회',
  rule_calculation: '규칙 계산',
  document_generation: '문서 생성',
  approval_flow: '승인 흐름',
  notification: '알림',
  dashboard_report: '대시보드·보고',
  search_filter: '검색·필터',
  data_validation: '데이터 검증',
  status_tracking: '상태 추적',
  ai_assist: 'AI 보조',
  integration: '외부 연동',
  admin_setting: '관리 설정',
  other: '기타',
}

/** FeatureAutomationMode 한글 라벨 */
const AUTOMATION_MODE_LABEL: Record<FeatureAutomationMode, string> = {
  full_auto: '완전 자동',
  assisted: '자동 보조',
  human_confirm: '사람 확정',
  manual_only: '수동 처리',
}

function nonEmpty(values: string[]): string[] {
  return values.filter((v) => v && v.trim())
}

/** 한 기능의 입력/처리/출력/자동화/검토/수용 기준을 key_value 항목으로 변환한다 */
function featureKeyValues(feature: DesignHandoffFeature): DeliverableKeyValue[] {
  const automation = feature.usesAi
    ? `${AUTOMATION_MODE_LABEL[feature.automationMode]} · AI 사용`
    : AUTOMATION_MODE_LABEL[feature.automationMode]
  return [
    { key: '기능 유형', value: FEATURE_TYPE_LABEL[feature.type] },
    { key: '입력', value: feature.input.trim() || NEEDS.manualEvidence },
    { key: '처리', value: feature.processing.trim() || NEEDS.manualEvidence },
    { key: '출력', value: feature.output.trim() || NEEDS.manualEvidence },
    { key: '자동·수동·AI 처리', value: automation },
    { key: '사람 검토', value: feature.humanReviewRequired ? '필요 (결과는 사람 확정 후 반영)' : '불필요' },
    {
      key: '전문가 판단 경계',
      value: feature.expertJudgmentBoundary
        ? '전문가 최종판단 영역 · 자동 처리로 대체 금지'
        : '해당 없음',
    },
    {
      key: '수용 기준 수',
      value: feature.acceptanceCount > 0 ? `${feature.acceptanceCount}건` : `미정 · ${NEEDS.beforeTest}`,
    },
  ]
}

export function buildMvpSpecSeeds(sources: CollectedSources): SectionSeed[] {
  const h = sources.mvpHandoff
  if (!h) return []

  const mvpRefId = sources.references.find(
    (r) => r.sourceType === 'mvp_design_handoff' && r.available,
  )?.id
  const refs: string[] = mvpRefId ? [mvpRefId] : []

  const seeds: SectionSeed[] = []
  const seed = (
    type: SectionSeed['type'],
    title: string,
    build: (b: BlockBuilder) => void,
    subtitle = '',
  ): void => {
    const b = new BlockBuilder(`mvpspec-${type}`)
    build(b)
    const blocks = b.build()
    if (blocks.length === 0) return
    seeds.push({
      type,
      track: 'ax',
      title,
      subtitle,
      blocks,
      sourceReferences: refs,
      visibility: 'developer_visible',
    })
  }

  /* 1. 업무 흐름 — 현재 vs 목표 --------------------------------------- */
  const sel = sources.selectionHandoff
  const currentWorkflow = sel?.currentWorkflow.trim() ?? ''
  const desiredWorkflow = sel?.desiredWorkflow.trim() ?? ''
  seed('workflow', '업무 흐름 — 현재 vs 목표', (b) => {
    b.paragraph(
      `핵심 과제 "${h.coreTaskName}"의 현재 업무 흐름과 MVP 적용 후 목표 업무 흐름입니다. 아래 내용은 확정된 설계 인계 기준입니다.`,
    )
    if (currentWorkflow || desiredWorkflow) {
      b.keyValue(
        [
          { key: '현재 업무 흐름', value: currentWorkflow || NEEDS.manualEvidence },
          { key: '목표 업무 흐름', value: desiredWorkflow || NEEDS.manualEvidence },
        ],
        { title: '업무 흐름 비교' },
      )
    } else {
      b.keyValue(
        [
          { key: '문제 상황', value: h.problemStatement.trim() || NEEDS.manualEvidence },
          { key: '목표', value: h.goalStatement.trim() || NEEDS.manualEvidence },
          { key: '대상 사용자', value: h.targetUsers.trim() || NEEDS.manualEvidence },
        ],
        { title: '설계 인계 기준' },
      )
      b.callout(
        '별도의 현재/목표 업무 흐름 텍스트가 인계 스냅샷에 없어 문제·목표 정의로부터 흐름 기준을 제시합니다. 상세 단계는 설계 확정 기준을 따릅니다.',
        { title: '기준 안내' },
      )
    }
  })

  /* 2. 기능 명세 — Must / Should + Later / 제외 ----------------------- */
  const mustFeatures = h.mustFeatures ?? []
  const shouldFeatures = h.shouldFeatures ?? []
  const laterFeatures = nonEmpty(h.laterFeatures ?? [])
  const excludedFeatures = nonEmpty(h.excludedFeatures ?? [])
  if (
    mustFeatures.length > 0 ||
    shouldFeatures.length > 0 ||
    laterFeatures.length > 0 ||
    excludedFeatures.length > 0
  ) {
    seed('feature_specification', '기능 명세', (b) => {
      b.paragraph(
        '각 기능은 입력→처리→출력, 자동·수동·AI 처리 방식, 사람 검토·전문가 판단 경계, 수용 기준 수로 정의합니다. 대상 역할은 권한 명세 섹션(역할 개요)을 따릅니다.',
      )
      if (mustFeatures.length > 0) {
        b.heading('Must 기능 (1차 MVP 필수)')
        mustFeatures.forEach((f, i) => {
          b.keyValue(featureKeyValues(f), { title: `Must ${i + 1}. ${f.name}` })
        })
      }
      if (shouldFeatures.length > 0) {
        b.heading('Should 기능 (여력 시 포함)')
        shouldFeatures.forEach((f, i) => {
          b.keyValue(featureKeyValues(f), { title: `Should ${i + 1}. ${f.name}` })
        })
      }
      b.bullets(laterFeatures, { title: 'Later 기능 (이후 단계 검토)' })
      b.bullets(excludedFeatures, { title: '제외 기능 (1차 범위 밖)' })
    })
  }

  /* 3. 화면 명세 ----------------------------------------------------- */
  const screenNames = nonEmpty(h.screenNames ?? [])
  if (screenNames.length > 0) {
    seed('screen_specification', '화면 명세', (b) => {
      b.paragraph('1차 MVP에 포함되는 화면 목록입니다. 화면별 상세 목적·구성 요소는 설계 확정 기준을 따릅니다.')
      b.table(
        ['화면', '화면 목적'],
        screenNames.map((name) => ({ cells: [name, '화면별 목적은 설계 확정 기준'] })),
        { title: `화면 목록 (${screenNames.length}개)` },
      )
    })
  }

  /* 4. 데이터 명세 --------------------------------------------------- */
  const entityNames = nonEmpty(h.entityNames ?? [])
  if (entityNames.length > 0) {
    seed('data_specification', '데이터 명세', (b) => {
      b.bullets(entityNames, { title: `데이터 엔티티 (${entityNames.length}개)` })
      b.callout(
        '엔티티별 주요 필드·관계는 인계 스냅샷에 포함되지 않았습니다. 상세 필드·관계는 설계 인계 기준을 따르며 임의로 정의하지 않습니다.',
        { title: '기준 안내' },
      )
    })
  }

  /* 5. 권한 명세 ----------------------------------------------------- */
  const roleNames = nonEmpty(h.roleNames ?? [])
  if (roleNames.length > 0) {
    seed('permission_specification', '권한 명세', (b) => {
      b.bullets(roleNames, { title: `역할 (${roleNames.length}개)` })
      b.paragraph(
        '위 역할이 각 기능·데이터에 대한 접근 권한 개요를 구성합니다. 역할별 상세 권한(생성·조회·수정·삭제·승인·내보내기)은 설계 확정 기준을 따릅니다.',
      )
    })
  }

  /* 6. 비즈니스 규칙 ------------------------------------------------- */
  const keyBusinessRules = nonEmpty(h.keyBusinessRules ?? [])
  if (keyBusinessRules.length > 0) {
    seed('business_rules', '핵심 비즈니스 규칙', (b) => {
      b.paragraph('예쁜 화면이 아니라 실제 업무를 움직이는 핵심 규칙입니다.')
      b.bullets(keyBusinessRules, { title: '비즈니스 규칙' })
    })
  }

  /* 7. AI 가드레일 --------------------------------------------------- */
  const aiFeatureNames = nonEmpty(h.aiFeatureNames ?? [])
  const humanReviewFeatures = [...mustFeatures, ...shouldFeatures]
    .filter((f) => f.humanReviewRequired)
    .map((f) => f.name)
  const expertBoundaryFeatures = [...mustFeatures, ...shouldFeatures]
    .filter((f) => f.expertJudgmentBoundary)
    .map((f) => f.name)
  if (
    aiFeatureNames.length > 0 ||
    humanReviewFeatures.length > 0 ||
    expertBoundaryFeatures.length > 0
  ) {
    seed('ai_guardrails', 'AI 가드레일', (b) => {
      b.bullets(aiFeatureNames, { title: `AI 활용 기능 (${aiFeatureNames.length}개)` })
      b.warning(
        'AI 결과는 초안입니다. 사람이 확정하기 전에는 최종 결과로 반영하지 않습니다.',
        { title: 'AI 사람 확정 원칙' },
      )
      b.warning(
        '세무·노무·법률·의료 등 전문가 최종판단 영역은 AI·자동 처리로 대체하지 않습니다.',
        { title: '전문가 판단 경계' },
      )
      b.bullets(humanReviewFeatures, { title: '사람 검토 필수 기능' })
      b.bullets(expertBoundaryFeatures, { title: '전문가 판단 경계 기능 (자동 처리 금지)' })
    })
  }

  /* 8. 연동 범위 ----------------------------------------------------- */
  const integrationNames = nonEmpty(h.integrationNames ?? [])
  if (integrationNames.length > 0) {
    seed('integration_scope', '외부 연동 범위', (b) => {
      b.bullets(integrationNames, { title: `외부 연동 (${integrationNames.length}개)` })
      b.callout(
        '연동이 준비되지 않거나 실패할 경우 1차 범위에서 제외하고 수동 입력 등 대체 방식으로 처리합니다. 연동 성공을 전제로 핵심 흐름을 막지 않습니다.',
        { title: '연동 실패 시 대체 원칙' },
      )
    })
  }

  /* 9. 수용 기준 ----------------------------------------------------- */
  if (mustFeatures.length > 0 || shouldFeatures.length > 0) {
    seed('acceptance_criteria', '수용 기준', (b) => {
      b.paragraph('기능별 수용 기준 수 요약입니다. 상세 수용 기준(Given/When/Then)은 각 기능 설계 기준을 따릅니다.')
      const rows = [...mustFeatures, ...shouldFeatures].map((f) => ({
        cells: [
          f.name,
          f.scope === 'must' ? 'Must' : 'Should',
          f.acceptanceCount > 0 ? `${f.acceptanceCount}건` : `미정 · ${NEEDS.beforeTest}`,
        ],
      }))
      b.table(['기능', '분류', '수용 기준 수'], rows, { title: '기능별 수용 기준 수' })
      b.callout('수용 기준은 각 기능 설계 기준이며, 여기서는 기준 개수만 집계합니다.', { title: '기준 안내' })
    })
  }

  /* 10. 테스트 시나리오 --------------------------------------------- */
  if (mustFeatures.length > 0) {
    seed('test_scenarios', '테스트 시나리오 (개발 확인 기준)', (b) => {
      b.callout(
        '실제 사용 테스트(검증) 결과는 검증 트랙에서 관리됩니다. 여기서는 Must 기능의 정상 흐름을 개발 확인 기준으로만 제시하며, 테스트 통과 여부를 주장하지 않습니다.',
        { title: '범위 안내', tone: 'info' },
      )
      b.checklist(
        mustFeatures.map((f) => `${f.name}: 입력 → 처리 → 출력 정상 흐름 개발 확인`),
        { title: 'Must 기능 정상 흐름 개발 확인' },
      )
      b.warning(`아래 항목은 개발 확인 기준일 뿐, 실제 사용 테스트 결과가 아닙니다. (${NEEDS.beforeTest})`)
    })
  }

  return seeds
}
