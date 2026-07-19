import type {
  AnalysisIssueInput,
  AssessmentResultInput,
  DomainScore,
  InterviewQuestionInput,
  WebsiteReadinessResult,
} from '../../types/assessment'
import { WEBSITE_DOMAIN_META } from '../../lib/assessmentMeta'
import { CURRENT_USER } from '../../data/demo'
import type { AnalysisDataset } from './analysisData'
import { scoreDomains } from './domainScoring'
import { buildResponseComparisons } from './comparisonEngine'
import { detectIssues } from './issueDetection'
import { detectDeductions } from './deductionEngine'
import { computeConfidence, dataCompletenessDetail } from './confidenceEngine'
import { decideRecommendation } from './recommendationEngine'
import { generateInterviewQuestions } from './interviewQuestionEngine'
import { buildNarrative } from './assessmentSummary'
import { analyzeWebsiteReadiness } from './websiteReadiness'
import { ASSESSMENT_RULE_VERSION } from './scoringConfig'

export interface AnalysisComputation {
  resultInput: AssessmentResultInput
  issues: AnalysisIssueInput[]
  interviewQuestions: InterviewQuestionInput[]
}

/** 결정적 스냅샷 해시 — 제출 응답 집합이 바뀌면 값이 바뀐다 */
export function computeSnapshotHash(responseIds: string[]): string {
  return [...responseIds].sort().join('|')
}

function websiteNarrative(website: WebsiteReadinessResult) {
  const strengths = website.domains
    .filter((d) => d.maxScore > 0 && d.score / d.maxScore >= 0.75)
    .map((d) => `${WEBSITE_DOMAIN_META[d.domain].label}이(가) 잘 준비되어 있습니다.`)
  const weaknesses = website.domains
    .filter((d) => d.maxScore > 0 && d.score / d.maxScore < 0.5)
    .map((d) => `${WEBSITE_DOMAIN_META[d.domain].label}이(가) 부족합니다.`)
  return { strengths, weaknesses }
}

/**
 * 프로젝트 분석을 실행해 저장 가능한 결과 입력·이슈·인터뷰 질문을 만든다.
 * (동일 dataset·analyzedAt 입력이면 점수는 결정적으로 동일)
 */
export function runAssessmentAnalysis(
  dataset: AnalysisDataset,
  analyzedAt: string,
): AnalysisComputation {
  const projectType = dataset.project.projectType
  const analysisKind = projectType
  const isAx = projectType === 'ax' || projectType === 'ax_website'
  const isWebsite = projectType === 'website' || projectType === 'ax_website'

  // AX 적합성 분석
  const comparisons = isAx ? buildResponseComparisons(dataset) : []
  const domainResult = isAx
    ? scoreDomains(dataset, analyzedAt)
    : { domainScores: [] as DomainScore[], evidence: [], subtotalScore: 0, scoreCoverage: 0 }

  const issues = isAx
    ? detectIssues(dataset, comparisons, domainResult.domainScores)
    : []
  const deductions = isAx
    ? detectDeductions(dataset, comparisons, domainResult.domainScores)
    : []

  const deductionTotal = deductions.reduce((s, d) => s + d.points, 0)
  const subtotalScore = domainResult.subtotalScore
  const finalScore = Math.max(0, Math.min(100, subtotalScore - deductionTotal))

  const website = isWebsite ? analyzeWebsiteReadiness(dataset) : null

  // 신뢰도
  let confidenceResult
  if (isAx) {
    confidenceResult = computeConfidence(
      dataset,
      domainResult.domainScores,
      comparisons,
    )
  } else {
    const detail = dataCompletenessDetail(dataset)
    confidenceResult = {
      confidence: website?.confidence ?? 'insufficient',
      confidenceReason:
        website && website.confidence === 'high'
          ? '홈페이지 사전진단 핵심 항목이 대부분 응답되었습니다.'
          : '홈페이지 사전진단 응답이 일부 부족합니다.',
      dataCompleteness: detail.overall,
      respondentCoverage: dataset.respondents.length > 0 ? 100 : 0,
      hasNumericData: false,
      hasOwnerFieldComparison: false,
      unresolvedCriticalConflicts: 0,
    }
  }

  // 판정
  const recommendationResult = isAx
    ? decideRecommendation(
        finalScore,
        dataset,
        domainResult.domainScores,
        confidenceResult,
        issues,
      )
    : {
        baseRecommendation: 'diagnosis_document_first' as const,
        recommendation: 'diagnosis_document_first' as const,
        exceptionReason: '',
      }

  const interviewQuestions = isAx
    ? generateInterviewQuestions(dataset, issues, comparisons)
    : []

  // 요약
  let narrative
  if (isAx) {
    narrative = buildNarrative(
      dataset,
      domainResult.domainScores,
      deductions,
      issues,
      comparisons,
      recommendationResult.recommendation,
      confidenceResult,
      finalScore,
    )
  } else {
    const wn = website ? websiteNarrative(website) : { strengths: [], weaknesses: [] }
    narrative = {
      keyStrengths: wn.strengths,
      keyWeaknesses: wn.weaknesses,
      keyRisks: website?.designRisks ?? [],
      missingDataSummary: [
        ...(website?.missingContent ?? []),
      ],
      conflictSummary: [],
      suggestedNextActions: website?.nextActions ?? [],
      autoSummary: website
        ? `${dataset.organization?.name ?? '고객사'}의 홈페이지 제작 준비도는 ${website.overallScore}점입니다. ${
            website.missingContent.length > 0
              ? `보완이 필요한 콘텐츠: ${website.missingContent.join(', ')}.`
              : '핵심 정보가 대부분 준비되어 있습니다.'
          } (규칙 기반 계산)`
        : '홈페이지 사전진단 응답이 없습니다.',
    }
  }

  const scoreCoverage = isAx ? domainResult.scoreCoverage : confidenceResult.dataCompleteness

  const resultInput: AssessmentResultInput = {
    projectId: dataset.project.id,
    organizationId: dataset.project.organizationId,
    status: 'draft',
    analysisKind,
    sourceResponseIds: dataset.submittedResponseIds,
    sourceDistributionIds: dataset.submittedDistributionIds,
    sourceSnapshotHash: computeSnapshotHash(dataset.submittedResponseIds),
    domainScores: domainResult.domainScores,
    evidence: domainResult.evidence,
    comparisons,
    subtotalScore,
    deductions,
    deductionTotal,
    finalScore,
    recommendation: recommendationResult.recommendation,
    baseRecommendation: recommendationResult.baseRecommendation,
    recommendationExceptionReason: recommendationResult.exceptionReason,
    confidence: confidenceResult.confidence,
    confidenceReason: confidenceResult.confidenceReason,
    dataCompleteness: confidenceResult.dataCompleteness,
    respondentCoverage: confidenceResult.respondentCoverage,
    scoreCoverage,
    keyStrengths: narrative.keyStrengths,
    keyWeaknesses: narrative.keyWeaknesses,
    keyRisks: narrative.keyRisks,
    missingDataSummary: narrative.missingDataSummary,
    conflictSummary: narrative.conflictSummary,
    suggestedNextActions: narrative.suggestedNextActions,
    autoSummary: narrative.autoSummary,
    manualSummary: '',
    manualAdjustments: [],
    websiteReadiness: website,
    ruleVersion: ASSESSMENT_RULE_VERSION,
    createdBy: CURRENT_USER.name,
    reviewedBy: '',
    finalizedBy: '',
    reviewedAt: null,
    finalizedAt: null,
  }

  return { resultInput, issues, interviewQuestions }
}
