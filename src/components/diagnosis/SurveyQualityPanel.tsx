import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { SurveyQualityCheck } from '../../types/survey'
import { summarizeQuality, type QualityVerdict } from '../../services/surveyComposition'

interface SurveyQualityPanelProps {
  checks: SurveyQualityCheck[]
}

const VERDICT_META: Record<
  QualityVerdict,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  passed: {
    label: '통과',
    className: 'border-success-200 bg-success-50 text-success-700',
    icon: CheckCircle2,
  },
  warning: {
    label: '주의',
    className: 'border-warning-200 bg-warning-50 text-warning-700',
    icon: AlertTriangle,
  },
  error: {
    label: '오류',
    className: 'border-danger-200 bg-danger-50 text-danger-700',
    icon: XCircle,
  },
}

function CheckRow({ check }: { check: SurveyQualityCheck }) {
  const failed = !check.passed
  const isInfo = check.severity === 'info'
  const Icon = isInfo
    ? Info
    : failed
      ? check.severity === 'error'
        ? XCircle
        : AlertTriangle
      : CheckCircle2
  const color = isInfo
    ? 'text-slate-400'
    : failed
      ? check.severity === 'error'
        ? 'text-danger-500'
        : 'text-warning-500'
      : 'text-success-500'
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[13px] font-medium break-keep text-slate-700">
          {check.title}
        </p>
        {check.description && (
          <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">
            {check.description}
          </p>
        )}
      </div>
    </li>
  )
}

/** 규칙 기반 설문 품질검사 결과 패널 */
export function SurveyQualityPanel({ checks }: SurveyQualityPanelProps) {
  const { verdict, errorCount, warningCount } = summarizeQuality(checks)
  const meta = VERDICT_META[verdict]

  const errors = checks.filter((c) => c.severity === 'error' && !c.passed)
  const warnings = checks.filter((c) => c.severity === 'warning' && !c.passed)
  const passed = checks.filter((c) => c.severity !== 'info' && c.passed)
  const infos = checks.filter((c) => c.severity === 'info')

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`flex items-center gap-2 rounded-(--radius-control) border px-3 py-2.5 ${meta.className}`}
      >
        <meta.icon aria-hidden="true" className="size-4" />
        <span className="text-sm font-semibold">품질검사: {meta.label}</span>
        <span className="ml-auto text-[0.875rem]">
          오류 {errorCount} · 주의 {warningCount}
        </span>
      </div>

      {errors.length > 0 && (
        <div>
          <p className="text-[0.875rem] font-semibold text-danger-600">오류 ({errors.length})</p>
          <ul className="divide-y divide-slate-100">
            {errors.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="text-[0.875rem] font-semibold text-warning-600">주의 ({warnings.length})</p>
          <ul className="divide-y divide-slate-100">
            {warnings.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>
      )}
      {infos.length > 0 && (
        <div>
          <p className="text-[0.875rem] font-semibold text-slate-500">정보</p>
          <ul className="divide-y divide-slate-100">
            {infos.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </div>
      )}
      {errors.length === 0 && warnings.length === 0 && (
        <p className="text-[13px] text-success-700">
          모든 필수 품질 조건을 통과했습니다. ({passed.length}개 항목 확인)
        </p>
      )}
    </div>
  )
}
