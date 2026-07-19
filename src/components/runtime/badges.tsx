import type {
  SurveyDistributionStatus,
  SurveyResponseStatus,
} from '../../types/surveyRuntime'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  DISTRIBUTION_STATUS_META,
  RESPONSE_STATUS_META,
} from '../../lib/runtimeMeta'

const base =
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap'

export function SurveyDistributionStatusBadge({
  status,
}: {
  status: SurveyDistributionStatus
}) {
  const meta = DISTRIBUTION_STATUS_META[status]
  return (
    <span className={`${base} ${TONE_BADGE_CLASS[meta.tone]}`} title={meta.description}>
      <meta.icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  )
}

export function SurveyResponseStatusBadge({
  status,
}: {
  status: SurveyResponseStatus
}) {
  const meta = RESPONSE_STATUS_META[status]
  return (
    <span className={`${base} ${TONE_BADGE_CLASS[meta.tone]}`} title={meta.description}>
      <meta.icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  )
}
