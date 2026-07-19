import type {
  AssessmentDeduction,
  AssessmentDeductionType,
  DomainScore,
  ResponseComparisonItem,
} from '../../types/assessment'
import { DEDUCTION_TYPE_LABEL } from './deductionLabels'
import { evidenceId } from './evidenceBuilder'
import { MAX_AUTO_DEDUCTION, TAG } from './scoringConfig'
import { answerForRoleTag, answersForTag, type AnalysisDataset } from './analysisData'

interface DraftDeduction {
  type: AssessmentDeductionType
  points: number
  reason: string
  evidenceIds: string[]
  /** 우선순위(작을수록 먼저 적용, 상한 도달 시 뒤쪽이 잘림) */
  priority: number
}

function domainByKey(domainScores: DomainScore[]) {
  return new Map(domainScores.map((d) => [d.domain, d]))
}

/**
 * 자동 감점을 계산한다. (순수 함수)
 * - 각 감점은 근거와 이유를 가진다.
 * - 중복 근거의 과도한 중첩을 제한한다.
 * - 자동 감점 총합은 최대 30점.
 */
export function detectDeductions(
  dataset: AnalysisDataset,
  comparisons: ResponseComparisonItem[],
  domainScores: DomainScore[],
): AssessmentDeduction[] {
  const isWebsite = dataset.project.projectType === 'website'
  if (isWebsite) return []

  const drafts: DraftDeduction[] = []
  const domains = domainByKey(domainScores)

  const ownerWill = answerForRoleTag(dataset, 'owner', TAG.ownerWill)
  const workerWill = answerForRoleTag(dataset, 'worker', TAG.workerWill)
  const lowOwnerWill =
    ownerWill !== null && (ownerWill.normalizedScore ?? 100) <= 25
  const lowWorkerWill =
    workerWill !== null && (workerWill.normalizedScore ?? 100) <= 25
  const lowAdoptionWill = lowOwnerWill && lowWorkerWill

  // A. 핵심 담당자 부재 — 테스트 담당자 지정 불가
  const testOwner = answersForTag(dataset, TAG.testOwner)
  const testOwnerNo = testOwner.filter(
    (a) => String(a.normalized.rawValue) === 'no',
  )
  if (testOwner.length > 0 && testOwnerNo.length > 0) {
    drafts.push({
      type: 'no_owner',
      points: 5,
      reason: '검증 기간 테스트를 담당할 직원을 지정하기 어렵다고 응답했습니다.',
      evidenceIds: testOwnerNo.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
      priority: 2,
    })
  }

  // B. 현장 응답 부재
  if (!dataset.rolesPresent.includes('worker')) {
    drafts.push({
      type: 'no_field_participant',
      points: 3,
      reason: '현장 담당자 제출 응답이 없어 실행 가능성 판단이 제한됩니다.',
      evidenceIds: [],
      priority: 3,
    })
  }

  // C. 데이터 제공 불가
  const dataProvision = answersForTag(dataset, TAG.dataProvision)
  const provisionHard = dataProvision.filter(
    (a) => String(a.normalized.rawValue) === 'hard',
  )
  const exportApi = answersForTag(dataset, TAG.exportApi)
  const exportNo = exportApi.filter(
    (a) => String(a.normalized.rawValue) === 'no',
  )
  let dataPoints = 0
  const dataEvidence: string[] = []
  if (provisionHard.length > 0) {
    dataPoints += 4
    dataEvidence.push(
      ...provisionHard.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
    )
  }
  if (exportNo.length > 0) {
    dataPoints += 2
    dataEvidence.push(
      ...exportNo.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
    )
  }
  if (dataPoints > 0) {
    drafts.push({
      type: 'insufficient_data',
      points: Math.min(6, dataPoints),
      reason: '실제 자료 제공 또는 데이터 내보내기가 어렵다고 응답했습니다.',
      evidenceIds: dataEvidence,
      priority: 4,
    })
  }

  // D. 업무 규칙 불명확
  const processDomain = domains.get('process_clarity')
  if (
    processDomain &&
    processDomain.measured &&
    processDomain.normalizedScore < 40
  ) {
    drafts.push({
      type: 'inconsistent_process',
      points: processDomain.normalizedScore < 25 ? 5 : 3,
      reason: `업무 규칙 명확성 점수가 낮습니다(정규화 ${processDomain.normalizedScore}점). 처리 방식·승인 흐름이 불명확합니다.`,
      evidenceIds: processDomain.evidenceIds.slice(0, 3),
      priority: 5,
    })
  }

  // E. 개인정보·전문가 위험
  const privacyYes = answersForTag(dataset, TAG.privacy).filter(
    (a) => String(a.normalized.rawValue) === 'yes',
  )
  const humanReviewYes = answersForTag(dataset, TAG.humanReview).filter(
    (a) => String(a.normalized.rawValue) === 'yes',
  )
  const criticalSignals = dataset.respondents.flatMap((r) =>
    [...r.normalizedById.values()].filter((n) =>
      n.riskSignals.includes('critical'),
    ),
  )
  let riskPoints = 0
  const riskEvidence: string[] = []
  if (privacyYes.length > 0) {
    riskPoints += 3
    riskEvidence.push(
      ...privacyYes.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
    )
  }
  if (criticalSignals.length >= 2) riskPoints += 3
  if (riskPoints > 0) {
    drafts.push({
      type: 'high_privacy_risk',
      points: Math.min(6, riskPoints),
      reason: '개인정보 처리 또는 심각 위험 신호가 확인되어 전문가 검토가 필요합니다.',
      evidenceIds: riskEvidence,
      priority: 6,
    })
  }
  if (humanReviewYes.length > 0) {
    drafts.push({
      type: 'expert_judgment_dominant',
      points: Math.min(6, 3 + (humanReviewYes.length >= 2 ? 3 : 0)),
      reason: '결과에 사람의 최종 판단이 필요한 업무 비중이 확인되었습니다.',
      evidenceIds: humanReviewYes.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
      priority: 7,
    })
  }

  // F. 측정 가능한 KPI 없음
  const kpiAnswers = answersForTag(dataset, TAG.measurableKpi)
  const kpiNone =
    kpiAnswers.length > 0 &&
    kpiAnswers.every((a) => a.normalized.selectedOptionValues.includes('none'))
  if (kpiNone) {
    drafts.push({
      type: 'no_measurable_kpi',
      points: 4,
      reason: '개선 효과를 측정할 수 있는 지표가 없다고 응답했습니다.',
      evidenceIds: kpiAnswers.map((a) =>
        evidenceId(a.respondent.responseId, a.normalized.questionCode),
      ),
      priority: 8,
    })
  }

  // G. 도입 의지 부족
  if (lowAdoptionWill) {
    drafts.push({
      type: 'low_adoption_will',
      points: 8,
      reason: '대표자와 현장 담당자 모두 사용 의지가 낮게 확인되었습니다.',
      evidenceIds: [ownerWill, workerWill]
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .map((a) => evidenceId('', a.questionCode)),
      priority: 1,
    })
  } else if (lowOwnerWill || lowWorkerWill) {
    drafts.push({
      type: 'low_adoption_will',
      points: 4,
      reason: lowOwnerWill
        ? '대표자의 사용 의지가 낮게 확인되었습니다.'
        : '현장 담당자의 사용 의지가 낮게 확인되었습니다.',
      evidenceIds: [],
      priority: 2,
    })
  }

  // H. 형식적 구축 목적 (도입 의지 부족과 근거 중복 시 제한)
  const noTestOwner = testOwnerNo.length > 0 || !dataset.rolesPresent.includes('worker')
  if (dataset.project.fundingRequired && lowAdoptionWill && noTestOwner) {
    drafts.push({
      type: 'formal_build_only',
      points: 3, // 도입 의지 부족과 중복되므로 축소 적용
      reason:
        '자금 신청 목적이 있으나 실제 사용 의지·담당자가 확인되지 않아 형식적 구축 위험이 있습니다.',
      evidenceIds: [],
      priority: 9,
    })
  }

  // I. 심각한 응답 충돌
  const usageConflict = comparisons.find(
    (c) => c.topicKey === 'usage_will' && c.status === 'major_gap',
  )
  const workloadConflict = comparisons.find(
    (c) => c.topicKey === 'monthly_workload' && c.status === 'major_gap',
  )
  if (usageConflict || workloadConflict) {
    const src = usageConflict ?? workloadConflict!
    drafts.push({
      type: 'severe_response_conflict',
      points: usageConflict && workloadConflict ? 5 : 3,
      reason:
        '대표자와 현장 담당자의 핵심 응답(사용 의지·업무량)에 중대한 차이가 있습니다.',
      evidenceIds: src.respondentValues.flatMap((v) =>
        src.relatedQuestionCodes.map((code) => evidenceId(v.responseId, code)),
      ),
      priority: 10,
    })
  }

  // 우선순위 순 정렬 후 상한 30점 적용
  drafts.sort((a, b) => a.priority - b.priority)
  const result: AssessmentDeduction[] = []
  let running = 0
  for (const draft of drafts) {
    if (running >= MAX_AUTO_DEDUCTION) break
    const allowed = Math.min(draft.points, MAX_AUTO_DEDUCTION - running)
    if (allowed <= 0) break
    running += allowed
    result.push({
      id: `ded-${draft.type}`,
      type: draft.type,
      label: DEDUCTION_TYPE_LABEL[draft.type],
      points: allowed,
      reason: draft.reason,
      evidenceIds: draft.evidenceIds,
      autoGenerated: true,
      overridden: false,
      overrideReason: '',
    })
  }
  return result
}
