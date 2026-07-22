import type { MvpDesignHandoffSnapshot } from '../../types/mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from '../../types/websiteDesign'
import type {
  HypothesisPriority,
  ValidationHypothesis,
  ValidationMetricDefinition,
  ValidationScenario,
  ValidationScenarioType,
} from '../../types/validation'

const ISO = '1970-01-01T00:00:00.000Z'

interface ScenarioSeed {
  title: string
  description: string
  type: ValidationScenarioType
  required: boolean
  priority: HypothesisPriority
  passRule: string
  measurementMethod?: string
  sourceCriterionIds?: string[]
}

function toScenario(seed: ScenarioSeed, i: number): ValidationScenario {
  return {
    id: `sc-${i}`,
    sourceScenarioId: '',
    sourceCriterionIds: seed.sourceCriterionIds ?? [],
    title: seed.title,
    description: seed.description,
    type: seed.type,
    priority: seed.priority,
    targetRoles: [],
    preconditions: '',
    steps: [],
    expectedResult: seed.description,
    measurementMethod: seed.measurementMethod ?? '관찰·기록',
    requiredEvidence: '',
    passRule: seed.passRule,
    required: seed.required,
    status: 'ready',
    orderIndex: i,
    createdAt: ISO,
    updatedAt: ISO,
    archivedAt: null,
  }
}

function toMetric(name: string, i: number, direction: ValidationMetricDefinition['direction'], required: boolean): ValidationMetricDefinition {
  return {
    id: `mt-${i}`,
    sourceKpiId: '',
    name,
    description: '',
    unit: '',
    baselineValue: '',
    targetValue: '',
    measurementMethod: '현장 측정 필요',
    measurementSource: '',
    frequency: '회차별',
    ownerRole: '',
    required,
    direction,
  }
}

export interface ImportResult {
  objective: string
  targetUsers: string
  hypotheses: ValidationHypothesis[]
  scenarios: ValidationScenario[]
  metrics: ValidationMetricDefinition[]
  risks: string[]
  openQuestions: string[]
}

/* ------------------------------------------------------------------ */
/* AX MVP 설계 가져오기                                                  */
/* ------------------------------------------------------------------ */

export function importFromMvpDesign(h: MvpDesignHandoffSnapshot): ImportResult {
  const seeds: ScenarioSeed[] = []
  // Must 기능 → 필수 정상 흐름 시나리오
  h.mustFeatures.forEach((f) => {
    seeds.push({
      title: `${f.name} 정상 수행`,
      description: `${f.input} → ${f.processing} → ${f.output}`,
      type: 'happy_path',
      required: true,
      priority: 'critical',
      passRule: `${f.output}이(가) 정상적으로 생성되고 담당자가 확인 가능`,
    })
    if (f.type === 'input_form' || f.type === 'data_validation') {
      seeds.push({ title: `${f.name} 입력 검증`, description: '필수·형식 오류 입력 시 처리', type: 'error', required: true, priority: 'high', passRule: '오류 입력이 차단되고 안내가 표시됨' })
    }
    if (f.usesAi) {
      seeds.push({ title: `${f.name} AI 결과 사람 확정`, description: 'AI 보조 결과를 사람이 검토·확정', type: 'ai_quality', required: true, priority: 'high', passRule: 'AI 결과가 초안으로 제시되고 사람 확정 전 최종 반영되지 않음' })
    }
    if (f.expertJudgmentBoundary || f.humanReviewRequired) {
      seeds.push({ title: `${f.name} 전문가 확인 흐름`, description: '전문가 최종판단이 필요한 경우 자동 처리하지 않음', type: 'permission', required: true, priority: 'high', passRule: '전문가 확인 대상으로 표시되고 자동 확정되지 않음' })
    }
  })
  // Should 기능 → 선택 시나리오
  h.shouldFeatures.forEach((f) => {
    seeds.push({ title: `${f.name} 수행`, description: f.output, type: 'happy_path', required: false, priority: 'medium', passRule: `${f.output} 확인` })
  })
  // 외부 연동 실패 시나리오
  if (h.integrationNames.length > 0) {
    seeds.push({ title: '외부 연동 실패 대체', description: `${h.integrationNames.join(', ')} 연동 실패 시 대체 동작`, type: 'integration', required: true, priority: 'high', passRule: '연동 실패 시 대체 방식으로 업무가 계속됨' })
  }
  // 공통 커버리지
  seeds.push({ title: '모바일 화면 사용', description: '주요 흐름을 모바일에서 수행', type: 'mobile', required: false, priority: 'medium', passRule: '모바일에서 주요 흐름 완료 가능' })
  seeds.push({ title: '접근성 기본', description: '키보드·명도 대비 기본 확인', type: 'accessibility', required: false, priority: 'low', passRule: '키보드로 주요 기능 접근 가능' })

  const scenarios = seeds.map(toScenario)

  const metrics = h.kpiSummaries.map((k, i) => toMetric(k, i, /절감|감소|단축/.test(k) ? 'decrease' : /증가|향상/.test(k) ? 'increase' : 'threshold', true))

  const hypotheses: ValidationHypothesis[] = [
    {
      id: 'hy-0',
      statement: `${h.coreTaskName}을(를) MVP로 만들면 대상 사용자의 문제가 실제로 줄어든다.`,
      source: 'mvp_design',
      evidenceRequired: '핵심 기능 정상 수행·사용자 피드백',
      successCondition: '필수 시나리오 통과 + 핵심 KPI 개선 방향 확인',
      failureCondition: '필수 시나리오 실패 또는 KPI 악화',
      priority: 'critical',
      relatedScenarioIds: scenarios.filter((s) => s.required).map((s) => s.id),
      relatedMetricIds: metrics.map((m) => m.id),
    },
  ]

  return {
    objective: h.goalStatement || `${h.coreTaskName} 1차 MVP의 실제 사용성을 검증한다.`,
    targetUsers: h.targetUsers,
    hypotheses,
    scenarios,
    metrics,
    risks: [],
    openQuestions: [],
  }
}

/* ------------------------------------------------------------------ */
/* 홈페이지 설계 가져오기                                                */
/* ------------------------------------------------------------------ */

export function importFromWebsiteDesign(h: WebsiteDesignHandoffSnapshot): ImportResult {
  const hasForm = h.forms.length > 0
  const seeds: ScenarioSeed[] = [
    { title: '홈 페이지 정상 진입', description: '홈 페이지가 정상적으로 열리고 핵심 메시지가 보임', type: 'happy_path', required: true, priority: 'critical', passRule: '홈이 오류 없이 열리고 핵심 메시지가 첫 화면에 노출' },
    { title: '핵심 CTA 발견', description: '주요 CTA를 쉽게 찾을 수 있음', type: 'conversion', required: true, priority: 'critical', passRule: '참여자가 도움 없이 핵심 CTA를 찾음' },
    { title: 'CTA 목적지 정상', description: 'CTA가 문의 경로로 정상 연결', type: 'conversion', required: true, priority: 'high', passRule: 'CTA 클릭 시 문의 페이지·폼으로 이동' },
    { title: '문의 폼 입력·제출', description: '문의 폼을 작성하고 제출', type: 'happy_path', required: hasForm, priority: 'critical', passRule: '유효 입력 시 제출 완료 안내가 표시됨' },
    { title: '문의 폼 필수값 검증', description: '필수값 누락 시 제출 차단', type: 'error', required: hasForm, priority: 'high', passRule: '필수값 누락 시 제출이 막히고 안내 표시' },
    { title: '개인정보 수집 동의', description: '동의 없이 제출 불가', type: 'permission', required: hasForm, priority: 'critical', passRule: '개인정보 동의 미체크 시 제출 불가' },
    { title: '모바일 내비게이션', description: '모바일에서 메뉴·주요 페이지 이동', type: 'mobile', required: true, priority: 'high', passRule: '모바일에서 주요 페이지 접근 가능' },
    { title: '390px 화면 확인', description: '작은 화면에서 가로 스크롤·잘림 없음', type: 'mobile', required: true, priority: 'high', passRule: '390px에서 가로 스크롤 없음' },
    { title: '빈 이미지·콘텐츠 없음', description: '주요 섹션에 누락 콘텐츠·깨진 이미지 없음', type: 'content', required: false, priority: 'medium', passRule: '주요 섹션 콘텐츠가 채워짐' },
    { title: '연락처·주소 정확성', description: '연락처·주소·운영시간 정확', type: 'content', required: false, priority: 'medium', passRule: '연락처 정보가 정확함' },
    { title: '법적 페이지 확인', description: '개인정보처리방침 접근 가능', type: 'content', required: hasForm, priority: 'medium', passRule: '개인정보처리방침 페이지 접근 가능' },
    { title: '키보드 접근', description: '키보드로 주요 요소 접근', type: 'accessibility', required: false, priority: 'low', passRule: '키보드로 CTA·폼 접근 가능' },
    { title: '색 대비 확인', description: '텍스트·배경 명도 대비 확인', type: 'accessibility', required: false, priority: 'low', passRule: '주요 텍스트 대비 충분' },
    { title: '404·오류 상태', description: '없는 경로·오류 상태 처리', type: 'error', required: false, priority: 'low', passRule: '없는 경로에서 안내 표시' },
    { title: '외부 연동 실패 대체', description: '지도·분석 등 외부 연동 실패 시 대체', type: 'integration', required: h.integrations.length > 0, priority: 'medium', passRule: '연동 실패 시 대체 정보 노출' },
    { title: '상담·DB 수집 흐름', description: '방문부터 문의 완료까지 전체 흐름', type: 'conversion', required: true, priority: 'critical', passRule: '방문자가 문의를 완료할 수 있음' },
  ]
  const scenarios = seeds.map(toScenario)

  const metricNames = ['CTA 발견 성공률', '문의 완료 성공률', '모바일 시나리오 통과율', '필수 콘텐츠 누락 수', '주요 페이지 접근 성공률']
  const metrics = metricNames.map((n, i) => toMetric(n, i, /누락/.test(n) ? 'decrease' : 'increase', i < 3))

  const hypotheses: ValidationHypothesis[] = [
    {
      id: 'hy-0',
      statement: `${h.strategy.keyMessage || '홈페이지'}가 방문자의 신뢰를 얻고 문의 전환으로 이어진다.`,
      source: 'website_design',
      evidenceRequired: 'CTA 발견·문의 완료·모바일 사용',
      successCondition: '핵심 시나리오 통과 + 문의 완료 가능',
      failureCondition: '문의 흐름 실패 또는 모바일 사용 불가',
      priority: 'critical',
      relatedScenarioIds: scenarios.filter((s) => s.required).map((s) => s.id),
      relatedMetricIds: metrics.map((m) => m.id),
    },
  ]

  return {
    objective: h.strategy.purpose || '홈페이지 사용성과 문의 전환 흐름을 검증한다.',
    targetUsers: h.strategy.audiences.map((a) => a.name).join(', '),
    hypotheses,
    scenarios,
    metrics,
    risks: h.risks,
    openQuestions: h.openQuestions,
  }
}
