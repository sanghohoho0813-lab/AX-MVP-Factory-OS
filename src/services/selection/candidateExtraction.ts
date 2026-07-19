import type { RespondentRole } from '../../types'
import type { AssessmentResult } from '../../types/assessment'
import type { AnalysisIssue, InterviewQuestion } from '../../types/assessment'
import type {
  CandidateMetricType,
  CandidateSourceType,
  CandidateTaskFamily,
} from '../../types/selection'
import type { AnalysisDataset, RespondentDataset } from '../assessment/analysisData'
import type { NormalizedAnswer } from '../assessment/answerNormalization'
import {
  TAG_RULES,
  type AutomationRatioKey,
} from './scoringConfig'
import {
  buildCandidateName,
  inferTaskFamily,
  taskNameKey,
} from './candidateTaxonomy'

export interface DraftMetric {
  type: CandidateMetricType
  label: string
  value: number | null
  unit: string
  sourceEvidenceIds: string[]
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
}

export interface CandidateDraft {
  generationKey: string
  name: string
  nameNeedsReview: boolean
  problemStatement: string
  currentProcess: string
  trigger: string
  users: string
  ownerRole: RespondentRole | 'unknown'
  inputData: string
  outputResult: string
  startCondition: string
  endCondition: string
  taskFamily: CandidateTaskFamily
  sourceTypes: CandidateSourceType[]
  sourceEvidenceIds: string[]
  sourceQuestionCodes: string[]
  sourceIssueIds: string[]
  sourceInterviewQuestionIds: string[]
  metrics: DraftMetric[]
  ratioKey: AutomationRatioKey
  tags: string[]
}

export interface ExtractionResult {
  drafts: CandidateDraft[]
  notes: string[]
}

/** 특정 questionCode에 대한 assessment 근거 ID */
function evidenceIdsForCode(assessment: AssessmentResult, code: string): string[] {
  return assessment.evidence.filter((e) => e.questionCode === code).map((e) => e.id)
}

function affirmative(n: NormalizedAnswer): boolean {
  const raw = String(n.rawValue)
  if (raw === 'yes') return true
  if (n.normalizedScore !== null && n.normalizedScore >= 60) return true
  if (n.type === 'currency' || n.type === 'number') return (n.numericValue ?? 0) > 0
  if (n.selectedOptionValues.some((v) => ['multi_step', 'one_step', 'over_week', 'few_days'].includes(v))) {
    return true
  }
  return false
}

const PROBLEM_TEMPLATE: Record<string, string> = {
  duplicate_entry: '동일한 데이터를 여러 문서·시스템에 중복 입력하고 있습니다.',
  repeat_docs: '비슷한 문서를 반복적으로 다시 작성하고 있습니다.',
  draft_generation: '보고서·제안서 초안 작성에 시간이 많이 들고 있습니다.',
  owner_operational: '대표자가 반복 실무를 직접 처리해 핵심 업무 시간이 부족합니다.',
  key_person_risk: '특정 담당자 1인에게 업무가 집중되어 부재 시 업무가 멈춥니다.',
  outsourcing_cost: '반복 업무를 외주로 처리해 월 비용이 지속적으로 발생합니다.',
  measurable_kpi: '개선 전후를 비교할 성과 지표가 정리되어 있지 않습니다.',
  task_inventory: '반복 업무의 처리량과 소요시간이 문서로 관리되지 않고 있습니다.',
}

/** 업무명·태그 후보를 생성한다 (curate된 문제 지표 태그만) */
const STRUCTURED_TAGS = [
  'duplicate_entry',
  'repeat_docs',
  'draft_generation',
  'owner_operational',
  'key_person_risk',
  'outsourcing_cost',
  'measurable_kpi',
]

const ROLE_ORDER: RespondentRole[] = ['worker', 'manager', 'owner', 'mixed']

/** analysisTag를 실제로 응답한 대표 응답자·정규화 답변 */
function firstAffirmative(
  dataset: AnalysisDataset,
  tag: string,
): { respondent: RespondentDataset; normalized: NormalizedAnswer } | null {
  for (const role of ROLE_ORDER) {
    for (const respondent of dataset.respondents) {
      if (respondent.role !== role) continue
      const found = respondent.byTag.get(tag)?.find((n) => n.answered && affirmative(n))
      if (found) return { respondent, normalized: found }
    }
  }
  return null
}

/**
 * 확정 진단 결과와 응답에서 자동화 후보 초안을 추출한다. (순수 함수)
 */
export function extractCandidateDrafts(
  dataset: AnalysisDataset,
  assessment: AssessmentResult,
  issues: AnalysisIssue[],
  interviews: InterviewQuestion[],
): ExtractionResult {
  const drafts: CandidateDraft[] = []
  const notes: string[] = []
  const seenKeys = new Set<string>()

  const pushDraft = (draft: CandidateDraft) => {
    if (seenKeys.has(draft.generationKey)) return
    seenKeys.add(draft.generationKey)
    drafts.push(draft)
  }

  // 프로젝트 전역 위험/이슈 연결
  const dataIssueIds = issues
    .filter((i) => i.type === 'missing_data' || i.type === 'insufficient_response')
    .map((i) => i.id)
  const answeredInterviewIds = interviews
    .filter((q) => q.status === 'answered')
    .map((q) => q.id)

  /* A. repeat_table 업무 목록 (task_inventory) */
  for (const respondent of dataset.respondents) {
    const list = respondent.byTag.get('task_inventory')
    if (!list) continue
    for (const normalized of list) {
      if (!normalized.answered) continue
      const placement = respondent.placementById.get(normalized.questionId)
      const rawRows = respondent.valueById.get(normalized.questionId)
      if (!placement || !Array.isArray(rawRows)) continue
      const cols = [...placement.repeatTableColumns].sort((a, b) => a.orderIndex - b.orderIndex)
      const nameCol = cols[0]?.id
      const ownerCol = cols[1]?.id
      const volumeCol = cols.find((c) => c.label.includes('건수'))?.id
      const timeCol = cols.find((c) => c.label.includes('시간'))?.id
      const evidenceIds = evidenceIdsForCode(assessment, placement.questionCode)

      for (const row of rawRows as Array<Record<string, string>>) {
        const rawName = nameCol ? String(row[nameCol] ?? '').trim() : ''
        if (rawName === '') continue
        const family = inferTaskFamily(rawName, 'schedule_progress')
        const named = buildCandidateName(rawName, '반복 업무 처리')
        const volume = volumeCol ? Number(String(row[volumeCol] ?? '').replace(/[^\d.]/g, '')) : NaN
        const minutes = timeCol ? Number(String(row[timeCol] ?? '').replace(/[^\d.]/g, '')) : NaN
        const metrics: DraftMetric[] = []
        if (Number.isFinite(volume) && volume > 0) {
          metrics.push({ type: 'monthly_volume', label: '월 처리건수', value: volume, unit: '건', sourceEvidenceIds: evidenceIds, confidence: 'high' })
        }
        if (Number.isFinite(minutes) && minutes > 0) {
          metrics.push({ type: 'time_per_case_minutes', label: '건당 소요시간', value: minutes, unit: '분', sourceEvidenceIds: evidenceIds, confidence: 'high' })
        }
        if (metrics.length === 2) {
          const monthlyHours = Math.round(((volume * minutes) / 60) * 10) / 10
          metrics.push({ type: 'monthly_hours', label: '월 총 업무시간', value: monthlyHours, unit: '시간', sourceEvidenceIds: evidenceIds, confidence: 'high' })
        }
        pushDraft({
          generationKey: `rt|${taskNameKey(rawName)}`,
          name: named.name,
          nameNeedsReview: named.needsReview,
          problemStatement: `${named.name} 업무를 수기·엑셀로 반복 처리하고 있습니다.`,
          currentProcess: '',
          trigger: '',
          users: ownerCol ? String(row[ownerCol] ?? '').trim() : '',
          ownerRole: respondent.role,
          inputData: '엑셀·수기 자료',
          outputResult: '',
          startCondition: '',
          endCondition: '',
          taskFamily: family,
          sourceTypes: ['repeat_table'],
          sourceEvidenceIds: evidenceIds,
          sourceQuestionCodes: [placement.questionCode],
          sourceIssueIds: dataIssueIds,
          sourceInterviewQuestionIds: answeredInterviewIds,
          metrics,
          ratioKey: 'general',
          tags: ['task_inventory'],
        })
      }
    }
  }

  /* B. 태그 기반 구조화 후보 */
  for (const tag of STRUCTURED_TAGS) {
    const hit = firstAffirmative(dataset, tag)
    if (!hit) continue
    const rule = TAG_RULES[tag]
    const family: CandidateTaskFamily = rule?.taskFamily ?? 'other'
    const hint = rule?.nameHint ?? '반복 업무'
    const named = buildCandidateName(hint, hint)
    const code = hit.normalized.questionCode
    const evidenceIds = evidenceIdsForCode(assessment, code)
    const metrics: DraftMetric[] = []
    if (hit.normalized.numericValue !== null && (hit.normalized.type === 'currency' || hit.normalized.type === 'number')) {
      metrics.push({
        type: tag === 'outsourcing_cost' ? 'external_cost' : 'monthly_volume',
        label: tag === 'outsourcing_cost' ? '월 외주비' : '수치',
        value: hit.normalized.numericValue,
        unit: tag === 'outsourcing_cost' ? '원' : '',
        sourceEvidenceIds: evidenceIds,
        confidence: 'medium',
      })
    }
    pushDraft({
      generationKey: `tag|${tag}`,
      name: named.name,
      nameNeedsReview: named.needsReview,
      problemStatement: PROBLEM_TEMPLATE[tag] ?? `${hint} 관련 반복 업무가 확인되었습니다.`,
      currentProcess: '',
      trigger: '',
      users: '',
      ownerRole: hit.respondent.role,
      inputData: '',
      outputResult: '',
      startCondition: '',
      endCondition: '',
      taskFamily: family,
      sourceTypes: ['structured_answer', 'assessment_evidence'],
      sourceEvidenceIds: evidenceIds,
      sourceQuestionCodes: [code],
      sourceIssueIds: [],
      sourceInterviewQuestionIds: answeredInterviewIds,
      metrics,
      ratioKey: rule?.ratioKey ?? 'general',
      tags: [tag],
    })
  }

  if (drafts.length === 0) {
    notes.push('진단 응답에서 자동화 후보로 추출할 수 있는 반복 업무를 찾지 못했습니다. 수동으로 후보를 추가하세요.')
  }

  return { drafts, notes }
}
