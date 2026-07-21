import { History } from 'lucide-react'
import type { ActivityLog } from '../../types/domain'
import { ACTIVITY_TYPE_META } from '../../lib/domainMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import { formatDateTime } from '../../lib/format'
import { EmptyState } from './EmptyState'

interface ActivityTimelineProps {
  activities: ActivityLog[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="아직 활동 이력이 없습니다"
        description="고객사와 프로젝트를 생성·수정하면 이곳에 기록됩니다."
      />
    )
  }

  return (
    <ol className="flex flex-col">
      {activities.map((activity, index) => {
        const meta = ACTIVITY_TYPE_META[activity.activityType]
        return (
          <li key={activity.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {index < activities.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-8 left-[15px] h-[calc(100%-32px)] w-px bg-slate-200"
              />
            )}
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border ${TONE_BADGE_CLASS[meta.tone]}`}
            >
              <meta.icon className="size-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-medium break-keep text-slate-800">
                {activity.title}
              </p>
              {activity.description && (
                <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">
                  {activity.description}
                </p>
              )}
              <p className="mt-1 text-[0.8125rem] text-slate-400">
                {activity.actorName} · {formatDateTime(activity.createdAt)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
