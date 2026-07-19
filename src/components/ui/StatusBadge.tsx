import type { StatusTone } from '../../types'
import { TONE_BADGE_CLASS, TONE_DOT_CLASS } from '../../lib/statusMeta'

interface StatusBadgeProps {
  tone: StatusTone
  children: string
  withDot?: boolean
}

export function StatusBadge({ tone, children, withDot = false }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_BADGE_CLASS[tone]}`}
    >
      {withDot && (
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${TONE_DOT_CLASS[tone]}`}
        />
      )}
      {children}
    </span>
  )
}
