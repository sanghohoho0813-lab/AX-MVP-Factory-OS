import type { StatusTone } from '../../types'
import { TONE_BAR_CLASS } from '../../lib/statusMeta'

interface ProgressBarProps {
  /** 0–100 */
  value: number
  tone: StatusTone
  label: string
}

export function ProgressBar({ value, tone, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
    >
      <div
        className={`h-full rounded-full ${TONE_BAR_CLASS[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
