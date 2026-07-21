import type {
  CriterionCategory,
  CriterionStatus,
  FundingEvidence,
  FundingMatch,
  Institution,
  MatchConfidence,
  MatchPriority,
  ProgramCriterionCheck,
  SupportProgram,
} from '../../types/funding'
import type { CollectedFundingSources } from './evidenceCollector'
import { computeProgramFreshness } from './freshnessEngine'
import { FUNDING_ISO, FUNDING_NEEDS } from './fundingTaxonomy'

/* ------------------------------------------------------------------ */
/* 기관·프로그램 후보 생성 (matchRuleEngine)                            */
/*                                                                     */
/* 이 엔진은 승인 확률·예상 한도/금리/지원금액을 만들지 않는다.          */
/* 현재 확보된 근거를 기준으로 '추가 검토 우선순위'와 '확인 필요 항목'만  */
/* 정리한다. 데이터가 없으면 'unknown'(확인 필요)으로 표시하며           */
/* 근거가 없다고 해서 'not_met'(요건 미충족)으로 단정하지 않는다.        */
/* 결정적: 고정 시드 키 기반 id, FUNDING_ISO 타임스탬프.                */
/* ------------------------------------------------------------------ */

/** 카테고리별 평가 규칙 정의 */
interface CategoryDef {
  category: CriterionCategory
  label: string
  description: string
  /** 이 라벨(부분일치)이 있으면 근거로 인정 */
  evidenceKeywords: string[]
  /** 근거가 있어도 공식 서류 확인 전이라 부분충족까지만 인정 */
  partialOnly: boolean
  /** 재무·신용·금액·일정 관련 → 공식 공고 확인 필요 */
  requiresOfficialConfirmation: boolean
  /** 부족 시 필요한 자료 설명 */
  needs: string
}

/** 결정적 출력 순서를 위한 고정 카테고리 순서 */
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
]

const CATEGORY_DEFS: Record<string, CategoryDef> = {
  basic: {
    category: 'basic',
    label: '기초 기업요건',
    description: '업종·지역·업력·사업자등록 등 기초 정보 확보 여부',
    evidenceKeywords: ['업종', '지역', '설립일', '사업자등록', '자금 용도'],
    partialOnly: false,
    requiresOfficialConfirmation: false,
    needs: '업종·지역·설립일·사업자등록 등 기초 정보',
  },
  financial: {
    category: 'financial',
    label: '재무 요건',
    description: '재무 건전성·매출 근거 (실제 요건은 공식 공고 확인 필요)',
    evidenceKeywords: ['연매출'],
    partialOnly: true,
    requiresOfficialConfirmation: true,
    needs: '재무제표, 부가세 신고자료',
  },
  credit: {
    category: 'credit',
    label: '신용 요건',
    description: '신용도·현금흐름 근거 (실제 요건은 공식 공고 확인 필요)',
    evidenceKeywords: [],
    partialOnly: true,
    requiresOfficialConfirmation: true,
    needs: '신용 정보, 부가세 신고자료',
  },
  technology: {
    category: 'technology',
    label: '기술성 요건',
    description: 'AI 활용·자동화 설계 등 기술성 근거',
    evidenceKeywords: ['AI 활용 기능', 'AX MVP 설계', '핵심 자동화 과제', '외부 연동', 'AX 실제 사용 테스트'],
    partialOnly: false,
    requiresOfficialConfirmation: false,
    needs: '기술 증빙, 지식재산권, 개발 산출물',
  },
  innovation: {
    category: 'innovation',
    label: '혁신성 요건',
    description: '개선 효과·진단 결과 등 혁신성 근거',
    evidenceKeywords: ['AX 적합성 진단', '개선 KPI', '기대 KPI'],
    partialOnly: false,
    requiresOfficialConfirmation: false,
    needs: '혁신성·개선 효과 근거',
  },
  employment: {
    category: 'employment',
    label: '고용 요건',
    description: '고용 규모·고용 계획 근거 (실제 요건은 공식 공고 확인 필요)',
    evidenceKeywords: ['직원 수'],
    partialOnly: true,
    requiresOfficialConfirmation: true,
    needs: '고용보험 자료, 급여 대장, 고용 계획',
  },
  certification: {
    category: 'certification',
    label: '인증 요건',
    description: '기업 인증(벤처·이노비즈 등) 관련 근거',
    evidenceKeywords: ['AX 적합성 진단', 'AI 활용 기능', 'AX MVP 설계'],
    partialOnly: true,
    requiresOfficialConfirmation: false,
    needs: '인증 요건 충족 증빙, 기술·재무 자료',
  },
  market: {
    category: 'market',
    label: '시장성 요건',
    description: '시장·성장·수출 관련 근거',
    evidenceKeywords: ['기대 KPI', '업종', '홈페이지 준비도'],
    partialOnly: true,
    requiresOfficialConfirmation: false,
    needs: '시장·성장·수출 근거',
  },
  region: {
    category: 'region',
    label: '지역 요건',
    description: '지역 소재·지역 연계 근거',
    evidenceKeywords: ['지역'],
    partialOnly: false,
    requiresOfficialConfirmation: false,
    needs: '지역 소재 증빙',
  },
  documentation: {
    category: 'documentation',
    label: '제출자료 요건',
    description: '연결 가능한 확정 제출자료 확보 여부',
    evidenceKeywords: ['제출자료', '사업자등록'],
    partialOnly: false,
    requiresOfficialConfirmation: false,
    needs: '제출 가능한 확정 자료',
  },
}

function findEvidence(sources: CollectedFundingSources, keywords: string[]): FundingEvidence[] {
  if (keywords.length === 0) return []
  return sources.evidence.filter((e) => keywords.some((k) => e.label.includes(k)))
}

/** 프로그램·기관에 적용할 요건 카테고리를 결정한다. */
function selectCategories(program: SupportProgram, institution: Institution): CriterionCategory[] {
  const focus = `${program.reviewFocus.join(' ')} ${program.summary} ${institution.typicalReviewFocus.join(' ')}`
  const cats = new Set<CriterionCategory>(['basic', 'documentation'])

  if (/기술|혁신|연구|개발|R&D/.test(focus) || institution.category === 'technology_guarantee' || institution.category === 'rnd_support') {
    cats.add('technology')
    cats.add('innovation')
  }
  if (/재무|매출|현금|상환|자금/.test(focus) || program.supportType === 'loan') cats.add('financial')
  if (/신용/.test(focus) || institution.category === 'credit_guarantee' || program.supportType === 'guarantee') cats.add('credit')
  if (/고용/.test(focus) || program.supportType === 'employment') cats.add('employment')
  if (/지역/.test(focus) || institution.category === 'local_government') cats.add('region')
  if (/시장|성장|수출|해외|사업성|수익/.test(focus) || program.supportType === 'export' || program.supportType === 'investment') cats.add('market')
  if (/인증/.test(focus) || program.supportType === 'certification') cats.add('certification')

  return CATEGORY_ORDER.filter((c) => cats.has(c))
}

function buildCriterionCheck(
  matchId: string,
  def: CategoryDef,
  program: SupportProgram,
  sources: CollectedFundingSources,
): ProgramCriterionCheck {
  const matched = findEvidence(sources, def.evidenceKeywords)
  let status: CriterionStatus
  if (matched.length > 0) {
    status = def.partialOnly ? 'partially_met' : 'met'
  } else {
    // 근거가 없으면 '확인 필요'(unknown) — 미충족으로 단정하지 않는다
    status = 'unknown'
  }

  const missingEvidence = status === 'met' ? '' : def.needs
  const sourceRule = def.requiresOfficialConfirmation
    ? FUNDING_NEEDS.officialConfirm
    : `참고: ${program.name} 검토 관점 (${program.reviewFocus.join(', ') || '공식 공고 확인 필요'})`

  return {
    id: `${matchId}-crit-${def.category}`,
    category: def.category,
    label: def.label,
    description: def.description,
    status,
    projectEvidenceIds: matched.map((e) => e.id),
    missingEvidence,
    analystNote: '',
    sourceRule,
    requiresOfficialConfirmation: def.requiresOfficialConfirmation,
  }
}

function computeConfidence(checks: ProgramCriterionCheck[]): MatchConfidence {
  if (checks.length === 0) return 'insufficient_data'
  let sum = 0
  let unknownCount = 0
  for (const c of checks) {
    if (c.status === 'met') sum += 1
    else if (c.status === 'partially_met') sum += 0.5
    else if (c.status === 'unknown') unknownCount += 1
  }
  const ratio = sum / checks.length
  const unknownRatio = unknownCount / checks.length
  if (unknownRatio >= 0.75) return 'insufficient_data'
  if (ratio >= 0.55) return 'high'
  if (ratio >= 0.3) return 'medium'
  if (ratio >= 0.12) return 'low'
  return 'insufficient_data'
}

/** 기관 유형과 확보 근거가 맞물리는지(추가 검토 적합성) 판단한다. */
function isAligned(institution: Institution, sources: CollectedFundingSources): boolean {
  const hasTech = findEvidence(sources, ['AI 활용 기능', 'AX MVP 설계', '핵심 자동화 과제']).length > 0
  const hasFinancial = findEvidence(sources, ['연매출']).length > 0
  const hasEmployment = findEvidence(sources, ['직원 수']).length > 0
  const hasRegion = findEvidence(sources, ['지역']).length > 0
  switch (institution.category) {
    case 'technology_guarantee':
    case 'rnd_support':
      return hasTech
    case 'credit_guarantee':
      return hasFinancial
    case 'employment_support':
      return hasEmployment
    case 'local_government':
      return hasRegion
    case 'investment':
      return hasTech || findEvidence(sources, ['기대 KPI', '업종']).length > 0
    case 'policy_finance':
    case 'startup_support':
    case 'certification':
      return true
    default:
      return true
  }
}

function computePriority(
  confidence: MatchConfidence,
  freshness: string,
  aligned: boolean,
): MatchPriority {
  const freshOk = freshness !== 'stale' && freshness !== 'unknown'
  const strong = confidence === 'high' || confidence === 'medium'
  // stale/unknown 최신성은 자동 primary 금지
  if (strong && freshOk && aligned) return 'primary'
  if (strong || (confidence === 'low' && aligned)) return 'secondary'
  return 'watch'
}

/**
 * 시드 참고 기관·프로그램을 순회하며 (기관, 프로그램)별로 후보 1건씩 생성한다.
 * generationKey(institution.id:program.id)로 중복을 제거한다.
 */
export function buildMatches(
  sources: CollectedFundingSources,
  institutions: Institution[],
  programs: SupportProgram[],
): FundingMatch[] {
  const instById = new Map<string, Institution>()
  for (const i of institutions) instById.set(i.id, i)

  const objective = sources.project.objective || FUNDING_NEEDS.unknown
  const matches: FundingMatch[] = []
  const seen = new Set<string>()

  const orderedPrograms = [...programs].sort((a, b) => a.id.localeCompare(b.id))

  for (const program of orderedPrograms) {
    const institution = instById.get(program.institutionId)
    if (!institution) continue
    const generationKey = `${institution.id}:${program.id}`
    if (seen.has(generationKey)) continue
    seen.add(generationKey)

    const matchId = `match-${institution.id}-${program.id}`
    const cats = selectCategories(program, institution)
    const checks = cats.map((c) => buildCriterionCheck(matchId, CATEGORY_DEFS[c], program, sources))

    const confidence = computeConfidence(checks)
    const freshness = computeProgramFreshness(program)
    const aligned = isAligned(institution, sources)
    const priority = computePriority(confidence, freshness, aligned)

    // 강점: 근거가 확보된 요건
    const strengths: string[] = []
    for (const c of checks) {
      if (c.status === 'met' || c.status === 'partially_met') {
        const labels = c.projectEvidenceIds
          .map((id) => sources.evidence.find((e) => e.id === id)?.label)
          .filter((l): l is string => Boolean(l))
        const suffix = labels.length > 0 ? ` (${labels.join(', ')})` : ''
        strengths.push(`${c.label} 근거 확보${suffix}`)
      }
    }

    // 부족 라벨: 확인 필요/보강 필요 요건
    const gaps: string[] = []
    for (const c of checks) {
      if (c.status === 'unknown') gaps.push(`${c.label} 확인 필요`)
      else if (c.status === 'partially_met') gaps.push(`${c.label} 자료 보강`)
      else if (c.status === 'not_met') gaps.push(`${c.label} 요건 미충족`)
    }

    // 공식 확인 필요 항목
    const officialConfirmationRequired: string[] = ['지원 조건·한도·금리·접수기간 (공식 공고 확인 필요)']
    for (const c of checks) {
      if (c.requiresOfficialConfirmation) {
        const item = `${c.label} (공식 공고 확인 필요)`
        if (!officialConfirmationRequired.includes(item)) officialConfirmationRequired.push(item)
      }
    }

    // 후속 조치
    const requiredNextActions: string[] = [FUNDING_NEEDS.officialConfirm, '기관 사전 문의 권장']
    const financialCheck = checks.find((c) => c.category === 'financial')
    if (financialCheck && financialCheck.status !== 'met') requiredNextActions.push('재무자료 확인')
    const creditCheck = checks.find((c) => c.category === 'credit')
    if (creditCheck && creditCheck.status !== 'met') requiredNextActions.push('신용 정보 확인')

    // 리스크 (승인 예측이 아님을 명시)
    const risks: string[] = ['승인 여부·한도·금리는 기관 심사와 공식 공고에 따라 결정됩니다.']
    if (freshness === 'unknown' || freshness === 'stale') {
      risks.push('현재 정보는 참고용 시드 기준으로 최신성 확인이 필요합니다.')
    }

    const reasonSummary =
      `${institution.shortName} · ${program.name}: 현재 확보 근거 기준 '추가 검토 우선순위' 정리입니다 ` +
      `(승인 가능성·확률이 아님). ${strengths.length}개 근거 확인, ${gaps.length}개 항목 추가 확인 필요. ` +
      `실제 조건은 공식 공고와 기관 문의로 확인해야 합니다.`

    matches.push({
      id: matchId,
      strategyId: '',
      institutionId: institution.id,
      programId: program.id,
      priority,
      confidence,
      reasonSummary,
      expectedUse: objective,
      criterionChecks: checks,
      strengths,
      gaps,
      risks,
      requiredNextActions,
      officialConfirmationRequired,
      analystOpinion: '',
      autoGenerated: true,
      generationKey,
      createdAt: FUNDING_ISO,
      updatedAt: FUNDING_ISO,
      excludedAt: null,
      exclusionReason: '',
    })
  }

  return matches
}
