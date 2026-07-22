import type { ProjectType } from '../../types/domain'
import { PROJECT_TYPE_META } from '../../lib/domainMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'

interface ProjectTypeBadgeProps {
  type: ProjectType
  /** 좁은 곳에서는 짧은 라벨 사용 */
  compact?: boolean
}

export function ProjectTypeBadge({ type, compact = false }: ProjectTypeBadgeProps) {
  const meta = PROJECT_TYPE_META[type]
  return (
    <span
      title={meta.label}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[0.875rem] font-medium whitespace-nowrap ${TONE_BADGE_CLASS[meta.tone]}`}
    >
      <meta.icon aria-hidden="true" className="size-3" />
      {compact ? meta.shortLabel : meta.label}
    </span>
  )
}
