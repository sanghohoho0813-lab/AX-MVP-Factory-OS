import { useState } from 'react'
import { ChevronDown, Pencil, RotateCcw, TriangleAlert } from 'lucide-react'
import type {
  AssessmentDeduction,
  AssessmentEvidence,
  DomainScore,
  ManualScoreAdjustment,
} from '../../types/assessment'
import { ASSESSMENT_DOMAIN_META } from '../../lib/assessmentMeta'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { TONE_BAR_CLASS } from '../../lib/statusMeta'
import { ScoreConfidenceBadge } from './badges'

/* ------------------------------------------------------------------ */
/* 점수 막대 (텍스트 대안 포함)                                          */
/* ------------------------------------------------------------------ */

export function ScoreBar({
  normalized,
  tone,
  label,
}: {
  normalized: number
  tone: 'info' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
  label: string
}) {
  const value = Math.max(0, Math.min(100, normalized))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      role="img"
      aria-label={`${label} 정규화 ${value}점 / 100점`}
    >
      <div
        className={`h-full rounded-full ${TONE_BAR_CLASS[tone]}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 점수 기여 표                                                          */
/* ------------------------------------------------------------------ */

function ScoreContributionTable({
  evidence,
}: {
  evidence: AssessmentEvidence[]
}) {
  if (evidence.length === 0) {
    return (
      <p className="text-[13px] text-slate-400">
        점수화된 응답이 없습니다.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-(--radius-control) border border-slate-200">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-[0.875rem] text-slate-500">
            <th scope="col" className="px-3 py-2 text-left font-medium">응답자</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">질문</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">답변</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">정규화</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">가중치</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => (
            <tr key={e.id} className="border-t border-slate-100 align-top">
              <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                {RESPONDENT_ROLE_META[e.respondentRole].shortLabel}
              </td>
              <td className="px-3 py-2">
                <p className="text-[13px] font-medium text-slate-700">{e.questionCode}</p>
                <p className="max-w-[220px] truncate text-[0.875rem] text-slate-400">{e.questionText}</p>
              </td>
              <td className="px-3 py-2 text-[13px] break-keep text-slate-700">
                {e.answerValue}
              </td>
              <td className="px-3 py-2 text-right">
                {e.normalizedValue !== null ? (
                  <span
                    className={`font-semibold ${
                      e.normalizedValue >= 66
                        ? 'text-success-700'
                        : e.normalizedValue >= 40
                          ? 'text-slate-700'
                          : 'text-warning-700'
                    }`}
                  >
                    {e.normalizedValue}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-slate-500">{e.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 영역 점수 행 (펼침)                                                   */
/* ------------------------------------------------------------------ */

const DOMAIN_TONE = ASSESSMENT_DOMAIN_META

interface DomainScoreRowProps {
  score: DomainScore
  evidence: AssessmentEvidence[]
  adjustment?: ManualScoreAdjustment
  editable?: boolean
  onAdjust?: () => void
}

export function DomainScoreRow({
  score,
  evidence,
  adjustment,
  editable,
  onAdjust,
}: DomainScoreRowProps) {
  const [open, setOpen] = useState(false)
  const meta = DOMAIN_TONE[score.domain]
  const domainEvidence = evidence.filter((e) =>
    score.evidenceIds.includes(e.id),
  )
  const tone = score.measured
    ? score.normalizedScore >= 66
      ? 'success'
      : score.normalizedScore >= 40
        ? 'info'
        : 'warning'
    : 'neutral'

  return (
    <div className="rounded-(--radius-card) border border-slate-200">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <meta.icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="text-sm font-medium text-slate-800">{meta.label}</span>
          <ScoreConfidenceBadge confidence={score.confidence} />
          {adjustment && (
            <span className="rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-accent-700">
              보정됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <div className="min-w-0 flex-1">
            <ScoreBar normalized={score.measured ? score.normalizedScore : 0} tone={tone} label={meta.label} />
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-800">
            {score.measured ? (
              <>
                {score.rawScore}
                <span className="text-[0.875rem] font-normal text-slate-400"> / {score.maxScore}</span>
              </>
            ) : (
              <span className="text-[0.875rem] font-normal text-slate-400">데이터 없음</span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editable && score.measured && (
            <button
              type="button"
              onClick={onAdjust}
              aria-label={`${meta.label} 점수 보정`}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${meta.label} 상세 ${open ? '접기' : '펼치기'}`}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-[13px] break-keep text-slate-600">{score.explanation}</p>
          {adjustment && (
            <p className="mb-2 rounded-(--radius-control) border border-accent-200 bg-accent-50 px-3 py-2 text-[0.875rem] break-keep text-accent-700">
              담당자 보정: 자동 {adjustment.beforeScore}점 → {adjustment.afterScore}점 · 사유: {adjustment.reason}
            </p>
          )}
          {score.warnings.map((w) => (
            <p
              key={w}
              className="mb-2 flex items-start gap-1.5 text-[0.875rem] break-keep text-warning-700"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </p>
          ))}
          <p className="mb-1.5 text-[0.875rem] text-slate-400">
            점수 대상 {score.applicableQuestionCount}개 · 응답 {score.answeredQuestionCount}개 · 근거 {score.evidenceCount}건
          </p>
          <ScoreContributionTable evidence={domainEvidence} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 감점 목록                                                            */
/* ------------------------------------------------------------------ */

interface DeductionListProps {
  deductions: AssessmentDeduction[]
  editable?: boolean
  onToggleOverride?: (deduction: AssessmentDeduction) => void
}

export function DeductionList({
  deductions,
  editable,
  onToggleOverride,
}: DeductionListProps) {
  if (deductions.length === 0) {
    return <p className="text-[13px] text-slate-500">적용된 감점이 없습니다.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {deductions.map((d) => (
        <li
          key={d.id}
          className={`rounded-(--radius-card) border px-4 py-3 ${
            d.overridden
              ? 'border-slate-200 bg-slate-50'
              : 'border-danger-200 bg-danger-50/40'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{d.label}</span>
            <span
              className={`text-sm font-bold ${d.overridden ? 'text-slate-400 line-through' : 'text-danger-600'}`}
            >
              -{d.points}점
            </span>
            {!d.autoGenerated && (
              <span className="rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-accent-700">
                수동
              </span>
            )}
            {d.overridden && (
              <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[0.8125rem] font-medium text-slate-500">
                제외됨
              </span>
            )}
            {editable && onToggleOverride && (
              <button
                type="button"
                onClick={() => onToggleOverride(d)}
                className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
              >
                {d.overridden ? (
                  <>
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                    복원
                  </>
                ) : (
                  '제외'
                )}
              </button>
            )}
          </div>
          <p className="mt-1 text-[13px] break-keep text-slate-600">{d.reason}</p>
          {d.overridden && d.overrideReason && (
            <p className="mt-1 text-[0.875rem] break-keep text-slate-500">
              제외 사유: {d.overrideReason}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* 점수 계산 안내                                                        */
/* ------------------------------------------------------------------ */

export function ScoreCalcNotice() {
  return (
    <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[0.875rem] break-keep text-slate-500">
      제출 응답과 사전 정의된 진단 규칙을 기준으로 계산되었습니다. 측정 가능한 영역의 배점을
      100점으로 환산해 총점을 산정하며, 응답이 없는 영역은 총점 계산에서 제외됩니다.
    </p>
  )
}

interface AdjustNoticeProps {
  show: boolean
}

export function ManualAdjustNotice({ show }: AdjustNoticeProps) {
  if (!show) return null
  return (
    <p className="rounded-(--radius-control) border border-accent-200 bg-accent-50 px-3 py-2 text-[0.875rem] break-keep text-accent-700">
      담당자 판단으로 점수가 보정되었습니다. 자동 계산값과 보정 사유가 함께 보존됩니다.
    </p>
  )
}

export { ScoreContributionTable }
