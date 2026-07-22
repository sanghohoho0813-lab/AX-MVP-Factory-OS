import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  DeliverableAudience,
  DeliverablePackageStatus,
  DeliverablePackageType,
  DeliverableSectionStatus,
  DeliverableSectionVisibility,
  DeliverableTrackType,
} from '../../types/deliverables'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  AUDIENCE_META,
  DELIVERABLE_QUALITY_META,
  DELIVERABLE_TRACK_META,
  PACKAGE_STATUS_META,
  PACKAGE_TYPE_META,
  SECTION_STATUS_META,
  VISIBILITY_META,
} from '../../lib/deliverableMeta'

interface Base {
  tone: StatusTone
  label: string
  icon?: LucideIcon
  title?: string
}
function Badge({ tone, label, icon: Icon, title }: Base) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.875rem] font-medium ${TONE_BADGE_CLASS[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  )
}

export function PackageStatusBadge({ status }: { status: DeliverablePackageStatus }) {
  const m = PACKAGE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function PackageTypeBadge({ type }: { type: DeliverablePackageType }) {
  const m = PACKAGE_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function AudienceBadge({ audience }: { audience: DeliverableAudience }) {
  const m = AUDIENCE_META[audience]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function DeliverableTrackBadge({ track }: { track: DeliverableTrackType }) {
  const m = DELIVERABLE_TRACK_META[track]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function VisibilityBadge({ visibility }: { visibility: DeliverableSectionVisibility }) {
  const m = VISIBILITY_META[visibility]
  return <Badge tone={m.tone} label={m.label} />
}

export function SectionStatusBadge({ status }: { status: DeliverableSectionStatus }) {
  const m = SECTION_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function DeliverableQualityBadge({ severity }: { severity: 'info' | 'warning' | 'error' }) {
  const m = DELIVERABLE_QUALITY_META[severity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
