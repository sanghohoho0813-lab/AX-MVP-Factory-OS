import type { RespondentRole } from '../../types'
import type {
  ComparisonImportance,
  ComparisonRespondentValue,
  ResponseComparisonItem,
  ResponseComparisonStatus,
} from '../../types/assessment'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { TAG } from './scoringConfig'
import type { AnalysisDataset } from './analysisData'
import type { NormalizedAnswer } from './answerNormalization'

type CompareMode = 'scale' | 'numeric' | 'choice' | 'multi_choice' | 'text'

interface ComparisonTopic {
  topicKey: string
  title: string
  description: string
  category: string
  importance: ComparisonImportance
  mode: CompareMode
  /** 역할별 태그 (역할마다 다른 문항으로 같은 주제를 물을 때) */
  roleTag?: Partial<Record<RespondentRole, string>>
  /** 모든 역할 공통 태그 */
  sharedTag?: string
}

const TOPICS: ComparisonTopic[] = [
  {
    topicKey: 'usage_will',
    title: '도구 사용 의지',
    description: '대표자와 현장 담당자의 실제 사용 의지 차이',
    category: 'adoption',
    importance: 'critical',
    mode: 'scale',
    roleTag: { owner: TAG.ownerWill, worker: TAG.workerWill },
  },
  {
    topicKey: 'monthly_workload',
    title: '월 업무량',
    description: '월 총 업무시간 등 업무량 인식 차이',
    category: 'kpi',
    importance: 'high',
    mode: 'numeric',
    sharedTag: TAG.baselineTime,
  },
  {
    topicKey: 'error_volume',
    title: '오류·재작업 규모',
    description: '월 평균 오류·재작업 건수 인식 차이',
    category: 'kpi',
    importance: 'medium',
    mode: 'numeric',
    sharedTag: TAG.baselineError,
  },
  {
    topicKey: 'data_holding',
    title: '데이터 보유 상태',
    description: '업무 데이터의 보관 형태에 대한 응답',
    category: 'data',
    importance: 'high',
    mode: 'multi_choice',
    sharedTag: TAG.dataFormat,
  },
  {
    topicKey: 'data_provision',
    title: '자료 제공 가능성',
    description: '진단·구축용 실제 자료 제공 가능 여부',
    category: 'adoption',
    importance: 'high',
    mode: 'choice',
    sharedTag: TAG.dataProvision,
  },
  {
    topicKey: 'test_owner',
    title: '테스트 담당자 지정',
    description: '검증 기간 테스트 담당자 지정 가능 여부',
    category: 'adoption',
    importance: 'high',
    mode: 'choice',
    sharedTag: TAG.testOwner,
  },
  {
    topicKey: 'feedback',
    title: '주 1회 피드백',
    description: '주 1회 피드백 미팅 참여 가능 여부',
    category: 'adoption',
    importance: 'medium',
    mode: 'choice',
    sharedTag: TAG.feedbackCadence,
  },
  {
    topicKey: 'measurable_kpi',
    title: 'KPI 측정 가능성',
    description: '개선 전후를 측정할 지표 보유 여부',
    category: 'kpi',
    importance: 'medium',
    mode: 'multi_choice',
    sharedTag: TAG.measurableKpi,
  },
  {
    topicKey: 'primary_problem',
    title: '가장 큰 경영 문제',
    description: '경영상 핵심 문제에 대한 서술 (직접 검토)',
    category: 'company',
    importance: 'medium',
    mode: 'text',
    sharedTag: 'pain_point',
  },
  {
    topicKey: 'primary_goal',
    title: '우선 해결 업무',
    description: '가장 먼저 해결하고 싶은 업무 (직접 검토)',
    category: 'company',
    importance: 'high',
    mode: 'text',
    sharedTag: TAG.primaryGoal,
  },
]

/** 역할별 대표 정규화 답변 (같은 역할 복수면 첫 응답) */
function collectRoleAnswers(
  dataset: AnalysisDataset,
  topic: ComparisonTopic,
): Map<RespondentRole, { normalized: NormalizedAnswer; responseId: string; name: string }> {
  const out = new Map<
    RespondentRole,
    { normalized: NormalizedAnswer; responseId: string; name: string }
  >()
  for (const respondent of dataset.respondents) {
    if (out.has(respondent.role)) continue
    const tag = topic.roleTag?.[respondent.role] ?? topic.sharedTag
    if (!tag) continue
    const list = respondent.byTag.get(tag)
    const found = list?.find((n) => n.answered)
    if (found) {
      out.set(respondent.role, {
        normalized: found,
        responseId: respondent.responseId,
        name: respondent.respondentName,
      })
    }
  }
  return out
}

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const inter = [...setA].filter((v) => setB.has(v)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : inter / union
}

function evaluateTopic(
  dataset: AnalysisDataset,
  topic: ComparisonTopic,
): ResponseComparisonItem | null {
  const roleAnswers = collectRoleAnswers(dataset, topic)
  if (roleAnswers.size === 0) return null

  const respondentValues: ComparisonRespondentValue[] = []
  for (const [role, entry] of roleAnswers) {
    respondentValues.push({
      role,
      respondentName: entry.name,
      displayValue: entry.normalized.displayValue,
      normalizedValue: entry.normalized.normalizedScore,
      responseId: entry.responseId,
    })
  }
  respondentValues.sort((a, b) => a.role.localeCompare(b.role))

  let status: ResponseComparisonStatus = 'insufficient'
  let gapScore = 0
  let interpretation = ''

  const entries = [...roleAnswers.values()]

  if (topic.mode === 'text') {
    status = 'insufficient'
    interpretation = '서술형 응답은 담당자가 직접 비교·판정해야 합니다.'
  } else if (roleAnswers.size < 2) {
    status = 'insufficient'
    interpretation =
      '비교할 다른 역할의 응답이 없어 자동 비교가 제한됩니다. 추가 응답 또는 인터뷰가 필요합니다.'
  } else if (topic.mode === 'numeric') {
    const nums = entries
      .map((e) => e.normalized.numericValue)
      .filter((n): n is number => n !== null)
    if (nums.length < 2) {
      status = 'insufficient'
      interpretation = '수치 응답이 충분하지 않습니다.'
    } else {
      const max = Math.max(...nums)
      const min = Math.min(...nums)
      const ratio = min <= 0 ? (max > 0 ? Infinity : 1) : max / min
      gapScore = Math.min(100, Math.round((1 - min / Math.max(max, 1)) * 100))
      if (ratio <= 1.2) status = 'aligned'
      else if (ratio <= 2) status = 'minor_gap'
      else status = 'major_gap'
      interpretation =
        status === 'aligned'
          ? '응답자 간 수치가 유사합니다.'
          : `응답자 간 수치 차이가 ${status === 'major_gap' ? '큽니다(2배 이상)' : '일부 있습니다'}. 산정 기준 확인이 필요합니다.`
    }
  } else if (topic.mode === 'multi_choice') {
    const overlap = jaccard(
      entries[0].normalized.selectedOptionValues,
      entries[1].normalized.selectedOptionValues,
    )
    gapScore = Math.round((1 - overlap) * 100)
    if (overlap >= 0.8) status = 'aligned'
    else if (overlap >= 0.3) status = 'minor_gap'
    else status = 'major_gap'
    interpretation =
      status === 'aligned'
        ? '선택 항목이 대체로 일치합니다.'
        : '선택 항목이 응답자마다 다릅니다. 실제 현황 확인이 필요합니다.'
  } else {
    // scale / choice — 정규화 값 차이
    const norms = entries
      .map((e) => e.normalized.normalizedScore)
      .filter((n): n is number => n !== null)
    if (norms.length < 2) {
      status = 'insufficient'
      interpretation = '점수화 가능한 응답이 부족합니다.'
    } else {
      gapScore = Math.round(Math.max(...norms) - Math.min(...norms))
      if (gapScore <= 25) status = 'aligned'
      else if (gapScore <= 50) status = 'minor_gap'
      else status = 'major_gap'
      interpretation =
        status === 'aligned'
          ? '응답자 간 인식이 유사합니다.'
          : status === 'major_gap'
            ? '대표자와 현장의 인식 차이가 큽니다. 실제 상황 확인이 필요합니다.'
            : '응답자 간 인식에 일부 차이가 있습니다.'
    }
  }

  const requiresInterview =
    (status === 'major_gap' &&
      (topic.importance === 'critical' || topic.importance === 'high')) ||
    (status === 'insufficient' &&
      topic.importance === 'critical' &&
      roleAnswers.size < 2)

  return {
    id: `cmp-${dataset.project.id}-${topic.topicKey}`,
    topicKey: topic.topicKey,
    title: topic.title,
    description: topic.description,
    category: topic.category,
    relatedQuestionCodes: entries.map((e) => e.normalized.questionCode),
    respondentValues,
    status,
    gapScore,
    importance: topic.importance,
    interpretation,
    requiresInterview,
    evidenceIds: [],
  }
}

/** 응답자 비교 항목 목록 (순수 함수) */
export function buildResponseComparisons(
  dataset: AnalysisDataset,
): ResponseComparisonItem[] {
  const items: ResponseComparisonItem[] = []
  for (const topic of TOPICS) {
    const item = evaluateTopic(dataset, topic)
    if (item) items.push(item)
  }
  return items
}

export interface ComparisonSummary {
  comparableTopics: number
  aligned: number
  minorGap: number
  majorGap: number
  insufficient: number
}

export function summarizeComparisons(
  items: ResponseComparisonItem[],
): ComparisonSummary {
  return {
    comparableTopics: items.filter((i) => i.status !== 'insufficient').length,
    aligned: items.filter((i) => i.status === 'aligned').length,
    minorGap: items.filter((i) => i.status === 'minor_gap').length,
    majorGap: items.filter((i) => i.status === 'major_gap').length,
    insufficient: items.filter((i) => i.status === 'insufficient').length,
  }
}

/** 비교 항목의 역할 라벨 헬퍼 (컴포넌트 공용) */
export function comparisonRoleLabel(role: RespondentRole): string {
  return RESPONDENT_ROLE_META[role].label
}
