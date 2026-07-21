import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import type {
  AssessmentResult,
  WebsiteReadinessResult,
} from '../../types/assessment'
import {
  ASSESSMENT_RULE_VERSION,
} from '../../services/assessment/scoringConfig'
import {
  CONFIDENCE_META,
  WEBSITE_DOMAIN_META,
  WEBSITE_RECOMMENDATION_META,
} from '../../lib/assessmentMeta'
import { TONE_BAR_CLASS } from '../../lib/statusMeta'
import { ProgressBar } from '../ui/ProgressBar'
import {
  AssessmentConfidenceBadge,
  AssessmentRecommendationBadge,
} from './badges'
import { ScoreBar } from './scoreParts'

/* ------------------------------------------------------------------ */
/* AX 점수 헤드라인                                                      */
/* ------------------------------------------------------------------ */

export function AssessmentScoreHeadline({
  result,
}: {
  result: AssessmentResult
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[0.875rem] text-slate-400">최종 점수</p>
        <p className="mt-0.5 text-3xl font-bold text-slate-900">
          {result.finalScore}
          <span className="text-base font-medium text-slate-400"> / 100</span>
        </p>
        <p className="mt-1 text-[0.875rem] text-slate-400">
          원점수 {result.subtotalScore} · 감점 -{result.deductionTotal}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-1.5 sm:col-span-2">
        <p className="text-[0.875rem] text-slate-400">판정</p>
        <AssessmentRecommendationBadge recommendation={result.recommendation} />
        {result.recommendationExceptionReason && (
          <p className="text-[0.875rem] break-keep text-warning-700">
            예외 적용: {result.recommendationExceptionReason}
          </p>
        )}
      </div>
      <div className="flex flex-col justify-center gap-1.5">
        <AssessmentConfidenceBadge confidence={result.confidence} />
        <p className="text-[0.875rem] break-keep text-slate-500">{result.confidenceReason}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 신뢰도 · 데이터 충분도 패널                                            */
/* ------------------------------------------------------------------ */

export function DataCompletenessPanel({ result }: { result: AssessmentResult }) {
  const rows: Array<[string, number, string]> = [
    ['데이터 충분도', result.dataCompleteness, '진단에 필요한 전체 정보 확보 수준'],
    ['점수 커버리지', result.scoreCoverage, '실제 점수 계산에 사용된 문항 응답 수준'],
    ['응답자 커버리지', result.respondentCoverage, '기대 역할 대비 제출 응답자 비율'],
  ]
  return (
    <div className="flex flex-col gap-3">
      {rows.map(([label, value, help]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-600">{label}</span>
            <span className="text-sm font-semibold text-slate-800">{value}%</span>
          </div>
          <ProgressBar value={value} tone="info" label={label} />
          <p className="mt-1 text-[0.875rem] text-slate-400">{help}</p>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-2">
        <span className="text-[0.875rem] text-slate-400">신뢰도</span>
        <AssessmentConfidenceBadge confidence={result.confidence} />
        <span className="text-[0.875rem] text-slate-400">{CONFIDENCE_META[result.confidence].label}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 진행 단계                                                            */
/* ------------------------------------------------------------------ */

export type StepState = 'todo' | 'done' | 'attention' | 'reviewed' | 'finalized'

export interface AnalysisStep {
  label: string
  state: StepState
  hint?: string
}

const STEP_ICON: Record<StepState, LucideIcon> = {
  todo: Circle,
  done: CheckCircle2,
  attention: CircleDot,
  reviewed: CheckCircle2,
  finalized: CheckCircle2,
}

const STEP_COLOR: Record<StepState, string> = {
  todo: 'text-slate-300',
  done: 'text-success-600',
  attention: 'text-warning-600',
  reviewed: 'text-brand-600',
  finalized: 'text-success-600',
}

export function AnalysisProgressSteps({ steps }: { steps: AnalysisStep[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, i) => {
        const Icon = STEP_ICON[step.state]
        return (
          <li key={step.label} className="flex items-start gap-2.5">
            <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${STEP_COLOR[step.state]}`} />
            <div>
              <p className="text-[13px] font-medium text-slate-700">
                <span className="mr-1 text-slate-400">{i + 1}.</span>
                {step.label}
              </p>
              {step.hint && <p className="text-[0.875rem] text-slate-400">{step.hint}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* 규칙 버전 정보                                                        */
/* ------------------------------------------------------------------ */

export function RuleVersionInfo({
  result,
}: {
  result?: AssessmentResult
}) {
  return (
    <p className="text-[0.875rem] text-slate-400">
      진단 규칙 버전 v{result?.ruleVersion ?? ASSESSMENT_RULE_VERSION}
      {result && ` · 분석 버전 v${result.version}`}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* 홈페이지 준비도 요약                                                  */
/* ------------------------------------------------------------------ */

export function WebsiteReadinessSummary({
  website,
}: {
  website: WebsiteReadinessResult
}) {
  const meta = WEBSITE_RECOMMENDATION_META[website.recommendation]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[0.875rem] text-slate-400">홈페이지 제작 준비도</p>
          <p className="mt-0.5 text-3xl font-bold text-slate-900">
            {website.overallScore}
            <span className="text-base font-medium text-slate-400"> / 100</span>
          </p>
        </div>
        <div className="flex flex-col justify-center gap-1.5 sm:col-span-2">
          <p className="text-[0.875rem] text-slate-400">판정</p>
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[0.875rem] font-medium ${
              meta.tone === 'success'
                ? 'border-success-200 bg-success-50 text-success-700'
                : meta.tone === 'info'
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-warning-200 bg-warning-50 text-warning-700'
            }`}
          >
            <meta.icon aria-hidden="true" className="size-3.5" />
            {meta.label}
          </span>
          <p className="text-[0.875rem] break-keep text-slate-500">{meta.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {website.domains.map((d) => {
          const normalized = d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0
          const tone =
            normalized >= 66 ? 'success' : normalized >= 40 ? 'info' : 'warning'
          return (
            <div key={d.domain} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-[13px] text-slate-600">
                {WEBSITE_DOMAIN_META[d.domain].label}
              </span>
              <div className="min-w-0 flex-1">
                <ScoreBar normalized={normalized} tone={tone} label={WEBSITE_DOMAIN_META[d.domain].label} />
              </div>
              <span className="w-16 shrink-0 text-right text-sm font-semibold text-slate-800">
                {d.score}
                <span className="text-[0.875rem] font-normal text-slate-400"> / {d.maxScore}</span>
              </span>
            </div>
          )
        })}
      </div>

      {(website.missingContent.length > 0 || website.missingAssets.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {website.missingContent.length > 0 && (
            <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50/40 px-3 py-2">
              <p className="text-[0.875rem] font-semibold text-warning-700">부족한 콘텐츠</p>
              <p className="mt-0.5 text-[13px] break-keep text-slate-600">
                {website.missingContent.join(', ')}
              </p>
            </div>
          )}
          {website.missingAssets.length > 0 && (
            <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50/40 px-3 py-2">
              <p className="text-[0.875rem] font-semibold text-warning-700">부족한 이미지·영상 자산</p>
              <p className="mt-0.5 text-[13px] break-keep text-slate-600">
                {website.missingAssets.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 톤 바 클래스 재노출 (외부 사용 편의) */
export { TONE_BAR_CLASS }
