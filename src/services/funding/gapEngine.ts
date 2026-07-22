import type {
  CriterionCategory,
  CriterionStatus,
  FundingGap,
  FundingMatch,
  GapSeverity,
} from '../../types/funding'
import type { CollectedFundingSources } from './evidenceCollector'
import { FUNDING_ISO, FUNDING_NEEDS } from './fundingTaxonomy'

/* ------------------------------------------------------------------ */
/* 부족조건 생성 (gapEngine)                                           */
/*                                                                     */
/* 후보들의 요건 점검 결과(not_met/partially_met/unknown)와            */
/* 필수 기초근거 누락을 모아 부족조건으로 정리한다.                     */
/* 'unknown'(데이터 없음=확인 필요)은 '요건 미충족'과 구분하며          */
/* 자동으로 critical로 올리지 않는다(하드 요건일 때만 상향).           */
/* 유사 부족조건은 카테고리 단위로 통합(전략 단위, matchId=null).       */
/* ------------------------------------------------------------------ */

/** 결정적 출력 순서 */
const CATEGORY_ORDER: CriterionCategory[] = [
  'basic',
  'financial',
  'credit',
  'technology',
  'innovation',
  'employment',
  'certification',
  'market',
  'region',
  'documentation',
  'compliance',
  'other',
]

/** 하드 요건(누락 시 상향) */
const HARD_REQUIREMENT = new Set<CriterionCategory>(['financial', 'credit', 'documentation'])

interface CategoryMeta {
  title: string
  evidenceNeeded: string
  requiredAction: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  basic: {
    title: '기초 기업요건 확인',
    evidenceNeeded: '사업자등록증, 업종·지역·업력 정보',
    requiredAction: '기초 기업 정보 확보 및 공식 공고 대상 요건 확인',
  },
  financial: {
    title: '재무자료 확인',
    evidenceNeeded: '재무제표, 부가세 신고자료',
    requiredAction: '재무자료 확보 후 공식 공고 재무 요건 확인',
  },
  credit: {
    title: '신용 정보 확인',
    evidenceNeeded: '신용 정보, 부가세 신고자료',
    requiredAction: '신용 정보 확인 및 기관 사전 문의',
  },
  technology: {
    title: '기술성 근거 보강',
    evidenceNeeded: '기술 증빙, 지식재산권, 개발 산출물',
    requiredAction: '기술성 근거 자료 보강',
  },
  innovation: {
    title: '혁신성 근거 보강',
    evidenceNeeded: '개선 효과·진단 근거',
    requiredAction: '혁신성·개선 효과 근거 보강',
  },
  employment: {
    title: '고용 요건 확인',
    evidenceNeeded: '고용보험 자료, 급여 대장, 고용 계획',
    requiredAction: '고용 관련 자료 확보 및 공식 공고 요건 확인',
  },
  certification: {
    title: '인증 요건 확인',
    evidenceNeeded: '인증 요건 충족 증빙, 기술·재무 자료',
    requiredAction: '인증 요건 확인 및 필요 서류 준비',
  },
  market: {
    title: '시장성 근거 보강',
    evidenceNeeded: '시장·성장·수출 근거',
    requiredAction: '시장성 근거 자료 보강',
  },
  region: {
    title: '지역 요건 확인',
    evidenceNeeded: '지역 소재 증빙',
    requiredAction: '지역 소재 증빙 확보 및 요건 확인',
  },
  documentation: {
    title: '제출자료 확인',
    evidenceNeeded: '제출 가능한 확정 자료',
    requiredAction: '연결 가능한 확정 제출자료 정리',
  },
  compliance: {
    title: '준수 요건 확인',
    evidenceNeeded: '관련 규정 준수 증빙',
    requiredAction: '준수 요건 확인',
  },
  other: {
    title: '기타 요건 확인',
    evidenceNeeded: '관련 근거 자료',
    requiredAction: '관련 요건 확인',
  },
}

interface Agg {
  category: CriterionCategory
  hasNotMet: boolean
  hasPartial: boolean
  hasUnknown: boolean
  matchIds: string[]
}

function severityFor(category: CriterionCategory, agg: Agg): GapSeverity {
  if (agg.hasNotMet) {
    // 근거가 실제로 미충족을 가리키는 경우
    return category === 'financial' || category === 'credit' ? 'critical' : 'high'
  }
  if (agg.hasPartial) return 'medium'
  // unknown(확인 필요)만 존재 — 자동 critical 금지
  if (HARD_REQUIREMENT.has(category)) {
    return category === 'financial' ? 'high' : 'medium'
  }
  if (category === 'employment') return 'medium'
  if (category === 'basic') return 'low'
  return 'low'
}

function describe(category: CriterionCategory, agg: Agg): string {
  const meta = CATEGORY_META[category]
  if (agg.hasNotMet) {
    return `요건 미충족: ${meta.title} 관련 근거가 요건을 충족하지 못합니다. 공식 공고 요건과 대조해 보강이 필요합니다.`
  }
  if (agg.hasPartial) {
    return `자료 보강 필요: ${meta.title} 관련 근거가 일부 확인되었으나 공식 서류로 보강해야 합니다.`
  }
  return `데이터 없음(확인 필요): ${meta.title} 관련 근거가 아직 없습니다. 미충족이 아니라 확인이 필요한 상태입니다.`
}

/**
 * 후보들의 요건 점검을 카테고리 단위로 통합해 부족조건을 생성한다.
 * 교차 반복되는 누락은 전략 단위(matchId=null)로 1건씩만 만든다.
 */
export function buildGaps(sources: CollectedFundingSources, matches: FundingMatch[]): FundingGap[] {
  const aggByCategory = new Map<CriterionCategory, Agg>()

  const ensure = (category: CriterionCategory): Agg => {
    let a = aggByCategory.get(category)
    if (!a) {
      a = { category, hasNotMet: false, hasPartial: false, hasUnknown: false, matchIds: [] }
      aggByCategory.set(category, a)
    }
    return a
  }

  for (const match of matches) {
    for (const check of match.criterionChecks) {
      const status: CriterionStatus = check.status
      if (status !== 'not_met' && status !== 'partially_met' && status !== 'unknown') continue
      const a = ensure(check.category)
      if (status === 'not_met') a.hasNotMet = true
      else if (status === 'partially_met') a.hasPartial = true
      else a.hasUnknown = true
      if (!a.matchIds.includes(match.id)) a.matchIds.push(match.id)
    }
  }

  // 필수 기초근거 누락(후보에 없더라도 전략 차원에서 필요) 보강
  const hasFinancial = sources.evidence.some((e) => e.label.includes('연매출'))
  const hasDeliverable = sources.evidence.some((e) => e.label.includes('제출자료'))
  if (!hasFinancial) ensure('financial').hasUnknown = true
  if (!hasDeliverable) ensure('documentation').hasUnknown = true

  const gaps: FundingGap[] = []
  let i = 0
  for (const category of CATEGORY_ORDER) {
    const agg = aggByCategory.get(category)
    if (!agg) continue
    const meta = CATEGORY_META[category]
    const severity = severityFor(category, agg)
    gaps.push({
      id: `gap-${i}-${category}`,
      strategyId: '',
      matchId: null,
      category,
      severity,
      title: meta.title,
      description: describe(category, agg),
      requiredAction: meta.requiredAction || FUNDING_NEEDS.officialConfirm,
      ownerId: '',
      dueDate: '',
      status: 'open',
      evidenceNeeded: meta.evidenceNeeded,
      resolution: '',
      createdAt: FUNDING_ISO,
      updatedAt: FUNDING_ISO,
    })
    i += 1
  }

  return gaps
}
