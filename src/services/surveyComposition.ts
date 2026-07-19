import type { RespondentRole } from '../types'
import type {
  Question,
  QuestionCategory,
  QuestionCondition,
  QuestionScope,
  QuestionType,
  ScoringDomain,
  SnapshotPlacement,
  SnapshotSection,
  SurveyCompositionSummary,
  SurveyQualityCheck,
  SurveySection,
} from '../types/survey'
import { estimateFromQuestions } from '../lib/surveyEstimate'
import { ROLE_RECOMMENDED_MINUTES } from '../lib/surveyMeta'

/* ------------------------------------------------------------------ */
/* 해석된(resolved) 설문 구조                                           */
/* ------------------------------------------------------------------ */

export interface ResolvedPlacement {
  placementId: string
  questionId: string
  /** 원본 질문 (없거나 보관되면 null) */
  question: Question | null
  required: boolean
  condition: QuestionCondition | null
  /** 조합 출처 (스냅샷 배지용). 기본은 질문 scope를 따른다 */
  sourceScope: QuestionScope
  orderIndex: number
}

export interface ResolvedSection {
  id: string
  title: string
  description: string
  orderIndex: number
  placements: ResolvedPlacement[]
}

/** 템플릿 섹션 → 해석된 섹션 (질문 맵으로 원본 질문 연결) */
export function resolveTemplateSections(
  sections: SurveySection[],
  questionById: Map<string, Question>,
): ResolvedSection[] {
  return sections
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      orderIndex: section.orderIndex,
      placements: section.placements
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((placement) => {
          const question = questionById.get(placement.questionId) ?? null
          return {
            placementId: placement.id,
            questionId: placement.questionId,
            question,
            required: placement.required,
            condition: placement.condition,
            sourceScope: question?.scope ?? 'custom',
            orderIndex: placement.orderIndex,
          }
        }),
    }))
}

/** 해석된 섹션의 전체 배치를 순서대로 평탄화 */
export function flattenResolved(sections: ResolvedSection[]): ResolvedPlacement[] {
  return sections.flatMap((s) => s.placements)
}

/* ------------------------------------------------------------------ */
/* 스냅샷                                                               */
/* ------------------------------------------------------------------ */

/** 해석된 구조를 스냅샷으로 고정 (원본 변경과 무관하게 보존) */
export function buildSnapshot(sections: ResolvedSection[]): SnapshotSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    orderIndex: section.orderIndex,
    placements: section.placements
      .filter((p) => p.question !== null)
      .map<SnapshotPlacement>((p, index) => {
        const q = p.question as Question
        return {
          id: p.placementId,
          questionId: q.id,
          questionCode: q.code,
          questionText: q.text,
          helpText: q.helpText,
          example: q.example,
          type: q.type,
          category: q.category,
          scope: q.scope,
          scoringDomain: q.scoringDomain,
          expertRiskGrade: q.expertRiskGrade,
          options: q.options,
          repeatTableColumns: q.repeatTableColumns,
          required: p.required,
          condition: p.condition,
          sourceScope: p.sourceScope,
          orderIndex: index,
        }
      }),
  }))
}

/** 스냅샷 → 해석된 구조 (미리보기·요약 재사용) */
export function resolveSnapshot(sections: SnapshotSection[]): ResolvedSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    orderIndex: section.orderIndex,
    placements: section.placements.map<ResolvedPlacement>((p) => ({
      placementId: p.id,
      questionId: p.questionId,
      question: {
        id: p.questionId,
        code: p.questionCode,
        text: p.questionText,
        helpText: p.helpText,
        example: p.example,
        type: p.type,
        category: p.category,
        respondentRole: 'mixed',
        scope: p.scope,
        industryKeys: [],
        objectiveKeys: [],
        requiredDefault: p.required,
        scoringDomain: p.scoringDomain,
        scoringWeight: 0,
        expertRiskGrade: p.expertRiskGrade,
        riskReason: '',
        analysisTags: [],
        options: p.options,
        repeatTableColumns: p.repeatTableColumns,
        active: true,
        version: 1,
        createdAt: '',
        updatedAt: '',
        archivedAt: null,
      },
      required: p.required,
      condition: p.condition,
      sourceScope: p.sourceScope,
      orderIndex: p.orderIndex,
    })),
  }))
}

/* ------------------------------------------------------------------ */
/* 구성 요약                                                            */
/* ------------------------------------------------------------------ */

const CHOICE_TYPES: QuestionType[] = [
  'single_choice',
  'multiple_choice',
  'yes_no',
  'scale_5',
  'ranking',
]
const TEXT_TYPES: QuestionType[] = ['short_text', 'long_text']

export function isChoiceType(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type)
}

export function isTextType(type: QuestionType): boolean {
  return TEXT_TYPES.includes(type)
}

export function computeCompositionSummary(
  sections: ResolvedSection[],
): SurveyCompositionSummary {
  const placements = flattenResolved(sections).filter((p) => p.question !== null)
  const questions = placements.map((p) => p.question as Question)
  const total = placements.length

  const conditionalCount = placements.filter((p) => p.condition !== null).length
  const requiredCount = placements.filter((p) => p.required).length

  const scopeCount = (scope: QuestionScope) =>
    placements.filter((p) => p.sourceScope === scope).length

  const commonCount = scopeCount('common')
  const industryCount = scopeCount('industry')
  const objectiveCount = scopeCount('objective')
  const customCount = scopeCount('custom')

  const ratio = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  const estimatedVisible = total - Math.round(conditionalCount * 0.5)
  const estimatedMinutes = estimateFromQuestions(
    questions,
    total,
    conditionalCount,
  )

  const scoringCoverage = Array.from(
    new Set(
      questions
        .map((q) => q.scoringDomain)
        .filter((d): d is ScoringDomain => d !== 'none'),
    ),
  )

  const expertRiskCount = questions.filter(
    (q) => q.expertRiskGrade !== 'green',
  ).length

  return {
    totalQuestions: total,
    conditionalQuestions: conditionalCount,
    estimatedVisibleQuestions: Math.max(0, estimatedVisible),
    estimatedMinutes,
    commonRatio: ratio(commonCount),
    industryRatio: ratio(industryCount),
    objectiveRatio: ratio(objectiveCount),
    customRatio: ratio(customCount),
    requiredRatio: ratio(requiredCount),
    scoringCoverage,
    expertRiskCount,
  }
}

/* ------------------------------------------------------------------ */
/* 품질검사                                                             */
/* ------------------------------------------------------------------ */

export interface QualityContext {
  respondentRole: RespondentRole
  /** 업종 특화 질문이 필요한 프로젝트인지 (인식된 업종이 있으면 true) */
  needsIndustry?: boolean
  /** 홈페이지 관련 프로젝트인지 */
  isWebsiteProject?: boolean
}

function check(
  id: string,
  type: string,
  severity: SurveyQualityCheck['severity'],
  title: string,
  description: string,
  passed: boolean,
): SurveyQualityCheck {
  return { id, type, severity, title, description, passed }
}

/**
 * 규칙 기반 설문 품질검사.
 * 통과하지 못한 error가 하나라도 있으면 게시·ready 처리를 막아야 한다.
 */
export function calculateSurveyQuality(
  sections: ResolvedSection[],
  context: QualityContext,
): SurveyQualityCheck[] {
  const checks: SurveyQualityCheck[] = []
  const allPlacements = flattenResolved(sections)
  const resolved = allPlacements.filter((p) => p.question !== null)
  const questions = resolved.map((p) => p.question as Question)
  const summary = computeCompositionSummary(sections)

  const categories = new Set<QuestionCategory>(questions.map((q) => q.category))
  const hasCategory = (c: QuestionCategory) => categories.has(c)

  /* --- 오류 --- */
  checks.push(
    check(
      'no_sections',
      'structure',
      'error',
      '섹션이 있어야 합니다',
      '설문에 최소 1개의 섹션이 필요합니다.',
      sections.length > 0,
    ),
  )
  checks.push(
    check(
      'no_questions',
      'structure',
      'error',
      '질문이 있어야 합니다',
      '설문에 최소 1개의 질문이 필요합니다.',
      resolved.length > 0,
    ),
  )

  // 중복 질문
  const idCounts = new Map<string, number>()
  for (const p of resolved) {
    idCounts.set(p.questionId, (idCounts.get(p.questionId) ?? 0) + 1)
  }
  const duplicated = [...idCounts.values()].some((n) => n > 1)
  checks.push(
    check(
      'duplicate_question',
      'structure',
      'error',
      '중복 질문이 없어야 합니다',
      '같은 질문이 두 번 이상 포함되어 있습니다.',
      !duplicated,
    ),
  )

  // 존재하지 않는/보관된 questionId
  const missing = allPlacements.filter((p) => p.question === null)
  checks.push(
    check(
      'missing_question',
      'structure',
      'error',
      '모든 질문이 유효해야 합니다',
      missing.length > 0
        ? `${missing.length}개 질문이 삭제·보관되어 참조할 수 없습니다.`
        : '모든 질문을 정상적으로 참조합니다.',
      missing.length === 0,
    ),
  )

  // 조건 검증 (source 존재 + 순서)
  const orderIndexById = new Map<string, number>()
  allPlacements.forEach((p, index) => orderIndexById.set(p.questionId, index))
  let conditionSourceMissing = false
  let conditionSourceAfter = false
  allPlacements.forEach((p, index) => {
    if (!p.condition) return
    const sourceIndex = orderIndexById.get(p.condition.sourceQuestionId)
    if (sourceIndex === undefined) conditionSourceMissing = true
    else if (sourceIndex >= index) conditionSourceAfter = true
  })
  checks.push(
    check(
      'condition_source_missing',
      'condition',
      'error',
      '조건 기준 질문이 존재해야 합니다',
      '조건부 질문의 기준 질문이 설문에 없습니다.',
      !conditionSourceMissing,
    ),
  )
  checks.push(
    check(
      'condition_source_order',
      'condition',
      'error',
      '조건 기준 질문이 앞에 있어야 합니다',
      '조건부 질문의 기준 질문이 해당 질문보다 뒤에 배치되어 있습니다.',
      !conditionSourceAfter,
    ),
  )

  // 응답자에 맞는 질문
  const roleMatch = questions.some(
    (q) =>
      q.respondentRole === context.respondentRole ||
      q.respondentRole === 'mixed' ||
      context.respondentRole === 'mixed',
  )
  checks.push(
    check(
      'role_has_questions',
      'structure',
      'error',
      '응답자에게 맞는 질문이 있어야 합니다',
      '선택한 응답자 역할에 해당하는 질문이 없습니다.',
      resolved.length === 0 ? false : roleMatch,
    ),
  )

  /* --- 경고 --- */
  checks.push(
    check(
      'too_many_questions',
      'volume',
      'warning',
      '실제 노출 문항이 40개를 넘지 않는 것이 좋습니다',
      `현재 예상 노출 문항 약 ${summary.estimatedVisibleQuestions}개`,
      summary.estimatedVisibleQuestions <= 40,
    ),
  )
  const minuteLimit = ROLE_RECOMMENDED_MINUTES[context.respondentRole]
  checks.push(
    check(
      'estimated_minutes',
      'volume',
      'warning',
      `예상 소요시간이 ${minuteLimit}분을 넘지 않는 것이 좋습니다`,
      `현재 예상 약 ${summary.estimatedMinutes}분`,
      summary.estimatedMinutes <= minuteLimit,
    ),
  )
  checks.push(
    check(
      'required_ratio',
      'balance',
      'warning',
      '필수 질문 비율이 75%를 넘지 않는 것이 좋습니다',
      `현재 필수 비율 ${summary.requiredRatio}%`,
      summary.requiredRatio <= 75,
    ),
  )
  checks.push(
    check(
      'common_ratio',
      'balance',
      'warning',
      '공통 질문 비율은 55~80%가 권장됩니다',
      `현재 공통 비율 ${summary.commonRatio}%`,
      resolved.length === 0 ||
        (summary.commonRatio >= 55 && summary.commonRatio <= 80),
    ),
  )
  if (context.needsIndustry) {
    checks.push(
      check(
        'industry_present',
        'coverage',
        'warning',
        '업종 특화 질문이 포함되는 것이 좋습니다',
        '업종이 인식된 프로젝트인데 업종 특화 질문이 없습니다.',
        summary.industryRatio > 0,
      ),
    )
  }
  if (context.isWebsiteProject) {
    const hasWebsite = hasCategory('website')
    checks.push(
      check(
        'website_present',
        'coverage',
        'warning',
        '홈페이지 목적 질문이 포함되는 것이 좋습니다',
        '홈페이지 프로젝트인데 홈페이지·브랜드 질문이 없습니다.',
        hasWebsite,
      ),
    )
  }
  const coverageCats: Array<[QuestionCategory, string]> = [
    ['workflow', '업무 흐름'],
    ['waste', '시간·비용 낭비'],
    ['data', '데이터 현황'],
    ['adoption', '도입 의지'],
    ['kpi', '성과 측정'],
  ]
  for (const [cat, label] of coverageCats) {
    checks.push(
      check(
        `coverage_${cat}`,
        'coverage',
        'warning',
        `${label} 범주 질문이 포함되는 것이 좋습니다`,
        `${label} 관련 질문이 설문에 없습니다.`,
        hasCategory(cat),
      ),
    )
  }
  // 유형 편중
  const choiceCount = questions.filter((q) => isChoiceType(q.type)).length
  const textCount = questions.filter((q) => isTextType(q.type)).length
  checks.push(
    check(
      'all_choice',
      'balance',
      'warning',
      '모든 질문이 객관식이면 안 됩니다',
      '서술형 질문을 일부 포함하면 업무 맥락을 더 잘 파악할 수 있습니다.',
      resolved.length === 0 || choiceCount < resolved.length,
    ),
  )
  checks.push(
    check(
      'all_text',
      'balance',
      'warning',
      '모든 질문이 주관식이면 안 됩니다',
      '객관식 질문을 일부 포함하면 응답 부담을 줄일 수 있습니다.',
      resolved.length === 0 || textCount < resolved.length,
    ),
  )
  // 점수 영역 편중
  const scoringDist = new Map<ScoringDomain, number>()
  for (const q of questions) {
    if (q.scoringDomain === 'none') continue
    scoringDist.set(q.scoringDomain, (scoringDist.get(q.scoringDomain) ?? 0) + 1)
  }
  const scoredTotal = [...scoringDist.values()].reduce((a, b) => a + b, 0)
  const maxDomain = Math.max(0, ...scoringDist.values())
  const overConcentrated =
    scoredTotal >= 5 && maxDomain / scoredTotal > 0.7
  checks.push(
    check(
      'scoring_concentration',
      'balance',
      'warning',
      '점수 영역이 한 곳에 편중되지 않는 것이 좋습니다',
      overConcentrated
        ? '점수 질문이 한 영역에 과도하게 집중되어 있습니다.'
        : '점수 영역이 고르게 분포되어 있습니다.',
      !overConcentrated,
    ),
  )
  // red 위험 질문에 이유 없음
  const redWithoutReason = questions.some(
    (q) => q.expertRiskGrade === 'red' && !q.riskReason.trim(),
  )
  checks.push(
    check(
      'red_without_reason',
      'compliance',
      'warning',
      '전문가 확인 질문에는 사유가 있어야 합니다',
      '전문가 최종 확인(red) 질문 중 위험 이유가 비어 있는 항목이 있습니다.',
      !redWithoutReason,
    ),
  )

  /* --- 정보 --- */
  checks.push(
    check(
      'info_custom_ratio',
      'info',
      'info',
      '프로젝트 맞춤 질문 비율',
      `맞춤 질문 비율 ${summary.customRatio}%`,
      true,
    ),
  )
  checks.push(
    check(
      'info_conditional',
      'info',
      'info',
      '조건부 질문 수',
      `조건부 질문 ${summary.conditionalQuestions}개`,
      true,
    ),
  )
  const aiCandidates = questions.filter((q) => q.category === 'ai_fit').length
  checks.push(
    check(
      'info_ai',
      'info',
      'info',
      'AI 분석 후보 질문',
      `AI 적용 가능성 질문 ${aiCandidates}개`,
      true,
    ),
  )
  const expertReview = questions.filter(
    (q) => q.category === 'compliance' || q.expertRiskGrade !== 'green',
  ).length
  checks.push(
    check(
      'info_expert',
      'info',
      'info',
      '개인정보·전문가 검토 질문',
      `검토가 필요한 질문 ${expertReview}개`,
      true,
    ),
  )

  return checks
}

/** 품질검사 결과 요약: 통과 / 주의 / 오류 */
export type QualityVerdict = 'passed' | 'warning' | 'error'

export function summarizeQuality(checks: SurveyQualityCheck[]): {
  verdict: QualityVerdict
  errorCount: number
  warningCount: number
} {
  const errorCount = checks.filter(
    (c) => c.severity === 'error' && !c.passed,
  ).length
  const warningCount = checks.filter(
    (c) => c.severity === 'warning' && !c.passed,
  ).length
  const verdict: QualityVerdict =
    errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'passed'
  return { verdict, errorCount, warningCount }
}
