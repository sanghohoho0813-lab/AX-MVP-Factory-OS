import type { SurveyCompositionSummary } from '../../types/survey'
import { SCORING_DOMAIN_META } from '../../lib/surveyMeta'

interface SurveyCompositionSummaryProps {
  summary: SurveyCompositionSummary
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5">
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function RatioBar({
  common,
  industry,
  objective,
  custom,
}: {
  common: number
  industry: number
  objective: number
  custom: number
}) {
  const segments = [
    { value: common, className: 'bg-slate-400', label: '공통' },
    { value: industry, className: 'bg-brand-500', label: '업종' },
    { value: objective, className: 'bg-accent-600', label: '목적' },
    { value: custom, className: 'bg-warning-500', label: '맞춤' },
  ].filter((s) => s.value > 0)
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) => (
          <div
            key={s.label}
            className={s.className}
            style={{ width: `${s.value}%` }}
            title={`${s.label} ${s.value}%`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>공통 {common}%</span>
        <span>업종 {industry}%</span>
        <span>목적 {objective}%</span>
        <span>맞춤 {custom}%</span>
      </div>
    </div>
  )
}

/** 설문 구성 요약 — 문항 수·비율·예상시간·점수 커버리지 */
export function SurveyCompositionSummaryView({
  summary,
}: SurveyCompositionSummaryProps) {
  return (
    <div className="flex flex-col gap-3">
      <RatioBar
        common={summary.commonRatio}
        industry={summary.industryRatio}
        objective={summary.objectiveRatio}
        custom={summary.customRatio}
      />
      <div className="divide-y divide-slate-100">
        <Stat label="총 문항 수" value={`${summary.totalQuestions}개`} />
        <Stat label="조건부 문항" value={`${summary.conditionalQuestions}개`} />
        <Stat
          label="예상 실제 노출"
          value={`약 ${summary.estimatedVisibleQuestions}개`}
        />
        <Stat label="예상 소요시간" value={`약 ${summary.estimatedMinutes}분`} />
        <Stat label="필수 비율" value={`${summary.requiredRatio}%`} />
        <Stat label="전문가 위험 질문" value={`${summary.expertRiskCount}개`} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">점수 영역 커버리지</p>
        {summary.scoringCoverage.length === 0 ? (
          <p className="text-xs text-slate-400">점수 영역이 지정된 질문이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {summary.scoringCoverage.map((domain) => (
              <span
                key={domain}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
              >
                {SCORING_DOMAIN_META[domain].label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
