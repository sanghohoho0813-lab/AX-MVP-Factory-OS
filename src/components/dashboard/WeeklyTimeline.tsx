import type { TimelineItem, TimelineTrack } from '../../types'
import { TONE_DOT_CLASS } from '../../lib/statusMeta'
import {
  DEMO_TODAY_INDEX,
  WEEK_DAYS,
  WEEK_RANGE_LABEL,
} from '../../data/demo'

interface WeeklyTimelineProps {
  tracks: TimelineTrack[]
  items: TimelineItem[]
}

/** 트랙 라벨 열 고정 너비(px) — 오늘 세로선 정렬 기준 */
const LABEL_COL_PX = 112
const GRID_TEMPLATE = `${LABEL_COL_PX}px repeat(${WEEK_DAYS.length}, minmax(0, 1fr))`

const TODAY_LINE_PERCENT =
  ((DEMO_TODAY_INDEX + 0.5) / WEEK_DAYS.length) * 100

export function WeeklyTimeline({ tracks, items }: WeeklyTimelineProps) {
  return (
    <section
      aria-label="이번 주 운영 타임라인"
      className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          이번 주 운영 타임라인
        </h2>
        <p className="text-[13px] text-slate-400">{WEEK_RANGE_LABEL}</p>
      </div>

      {/* 데스크톱/태블릿: CSS Grid 타임라인 */}
      <div className="hidden px-5 py-4 md:block">
        {/* 요일 헤더 */}
        <div className="grid" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
          <div />
          {WEEK_DAYS.map((day, index) => (
            <div key={day.label} className="pb-2 text-center">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.875rem] font-medium ${
                  index === DEMO_TODAY_INDEX
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500'
                }`}
              >
                {day.label} {day.date}
              </span>
            </div>
          ))}
        </div>

        {/* 트랙 본문 + 오늘 세로선 */}
        <div className="relative">
          {tracks.map((track) => {
            const trackItems = items.filter((item) => item.trackKey === track.key)
            return (
              <div
                key={track.key}
                className="grid items-center border-t border-slate-100"
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <div className="flex items-center gap-2 py-4 pr-3">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 shrink-0 rounded-full ${TONE_DOT_CLASS[track.tone]}`}
                  />
                  <span className="truncate text-[13px] font-medium text-slate-600">
                    {track.label}
                  </span>
                </div>
                {trackItems.map((item) => (
                  <div
                    key={item.id}
                    className="min-w-0 py-2"
                    style={{
                      gridColumn: `${item.startDay + 2} / span ${item.durationDays}`,
                    }}
                  >
                    <div className="mx-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <p className="truncate text-[0.875rem] font-medium text-slate-700">
                        {item.title}
                      </p>
                      <p className="truncate text-[0.8125rem] text-slate-400">
                        {item.owner}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {/* 오늘 세로선 — 라벨 열을 제외한 영역 기준 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0"
            style={{ left: `${LABEL_COL_PX}px` }}
          >
            <div
              className="absolute inset-y-0 w-px bg-brand-600/60"
              style={{ left: `${TODAY_LINE_PERCENT}%` }}
            >
              <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-brand-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 모바일: 세로 리스트 */}
      <ul className="flex flex-col gap-3 px-5 py-4 md:hidden">
        {items.map((item) => {
          const track = tracks.find((t) => t.key === item.trackKey)
          const start = WEEK_DAYS[item.startDay]
          const end =
            WEEK_DAYS[
              Math.min(
                item.startDay + item.durationDays - 1,
                WEEK_DAYS.length - 1,
              )
            ]
          return (
            <li
              key={item.id}
              className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[0.875rem] font-medium text-slate-500">
                  {track && (
                    <span
                      aria-hidden="true"
                      className={`size-1.5 shrink-0 rounded-full ${TONE_DOT_CLASS[track.tone]}`}
                    />
                  )}
                  <span className="truncate">{track?.label}</span>
                </span>
                <span className="shrink-0 text-[0.875rem] text-slate-400">
                  {start.label} {start.date} ~ {end.label} {end.date}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium break-keep text-slate-800">
                {item.title}
              </p>
              <p className="mt-0.5 text-[0.875rem] text-slate-400">{item.owner}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
