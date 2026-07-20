import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  AssetStatus,
  ContentItemStatus,
  GuardrailStatus,
  QualitySeverity,
  SectionContentStatus,
  WebsiteDesignStatus,
  WebsitePageStatus,
  WebsiteType,
} from '../../types/websiteDesign'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  ASSET_STATUS_META,
  CONTENT_ITEM_STATUS_META,
  GUARDRAIL_STATUS_META,
  PAGE_STATUS_META,
  QUALITY_SEVERITY_META,
  SECTION_CONTENT_STATUS_META,
  WEBSITE_DESIGN_STATUS_META,
  WEBSITE_TYPE_META,
} from '../../lib/websiteDesignMeta'

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
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE_CLASS[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  )
}

export function WebsiteStatusBadge({ status }: { status: WebsiteDesignStatus }) {
  const m = WEBSITE_DESIGN_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function WebsiteTypeBadge({ type }: { type: WebsiteType }) {
  const m = WEBSITE_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function PageStatusBadge({ status }: { status: WebsitePageStatus }) {
  const m = PAGE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function SectionStatusBadge({ status }: { status: SectionContentStatus }) {
  const m = SECTION_CONTENT_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function ContentStatusBadge({ status }: { status: ContentItemStatus }) {
  const m = CONTENT_ITEM_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const m = ASSET_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function GuardrailStatusBadge({ status }: { status: GuardrailStatus }) {
  const m = GUARDRAIL_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function QualitySeverityBadge({ severity }: { severity: QualitySeverity }) {
  const m = QUALITY_SEVERITY_META[severity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
