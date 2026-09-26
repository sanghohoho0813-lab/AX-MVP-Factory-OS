/**
 * 영업 흐름 카드 (D-119) — 1차 미팅 준비부터 계약 뒤 관리까지 여섯 걸음을 한 장에.
 *
 * 걸음을 누르면 그 걸음의 '보이지 않던 할 일'(자동 체크)과 그때 쓸 작업실 도구가 보인다.
 * 도구는 이 업체로 바로 열리고(?client=), 결과를 붙이면 다시 이 업체 기록으로 돌아온다.
 * 잠긴 모듈(D-91)은 감추지 않고 '잠김' 으로 — 나중에 모듈별 결제를 붙이는 자리.
 * 색은 테마 띠(ramp) · 성공색만 쓴다(D-118 규칙).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Circle, Lock, Route, Wrench } from 'lucide-react'
import { Badge } from '../ui/primitives'
import { buildJourney, SALES_PATH_INFO, type JourneyStepKey } from '../../services/salesJourney'
import { useModuleAccessMap } from './useModuleAccessMap'
import { SALES_PATH_ORDER, type ClientOpsRecord, type SalesPath } from '../../types/clientOps'
import { rampAt } from './salesColor'

export function SalesJourneyCard({
  record,
  today,
  onPathChange,
  compact = false,
}: {
  record: ClientOpsRecord
  today: string
  /** 계약 경로를 고르면 — 없으면 경로 칸을 보여 주기만 한다 */
  onPathChange?: (path: SalesPath | null) => void
  /** 고객 상세처럼 다른 카드 사이에 둘 때 — 걸음 설명(hint)을 줄인다 */
  compact?: boolean
}) {
  const access = useModuleAccessMap(record.workspaceId)
  const journey = useMemo(() => buildJourney(record, { today, access }), [record, today, access])
  const [picked, setPicked] = useState<JourneyStepKey | null>(null)
  // 다른 업체로 바뀌면 지금 걸음으로 돌아간다
  const [seenId, setSeenId] = useState(record.id)
  if (seenId !== record.id) {
    setSeenId(record.id)
    setPicked(null)
  }
  const openKey = picked ?? journey.current
  const open = journey.steps.find((s) => s.key === openKey) ?? journey.steps[0]
  const openIndex = journey.steps.indexOf(open)
  const path = journey.path

  return (
    <section data-testid="sales-journey" aria-label="영업 흐름" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="t-card inline-flex items-center gap-2 font-bold text-slate-900">
          <Route aria-hidden="true" className="size-5 text-brand-600" />
          영업 흐름
          <span className="t-sub font-medium text-slate-500">· 지금 {journey.steps.find((s) => s.key === journey.current)?.label}</span>
        </h2>
        <div role="group" aria-label="계약 경로" data-testid="sales-path" className="flex flex-wrap items-center gap-1.5">
          <span className="t-meta text-slate-500">계약 경로</span>
          {SALES_PATH_ORDER.map((p) => {
            const on = path === p
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                disabled={!onPathChange}
                onClick={() => onPathChange?.(on ? null : p)}
                className={`tap t-meta rounded-full border px-2.5 py-1 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'} disabled:cursor-default`}
              >
                {SALES_PATH_INFO[p].label}
              </button>
            )
          })}
        </div>
      </div>
      {path && <p className="t-meta -mt-1 break-keep text-slate-500">{SALES_PATH_INFO[path].label} — {SALES_PATH_INFO[path].hint}</p>}

      {/* 여섯 걸음 */}
      <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {journey.steps.map((s, i) => {
          const sel = s.key === open.key
          const doneCount = s.tasks.filter((t) => t.done && !t.soon).length
          const total = s.tasks.filter((t) => !t.soon).length
          const tone =
            s.state === 'done'
              ? 'border-success-200 bg-success-50'
              : s.state === 'now'
                ? 'ramp-border ramp-soft'
                : s.state === 'optional'
                  ? 'border-dashed border-slate-300 bg-white'
                  : 'border-slate-200 bg-white'
          return (
            <li key={s.key}>
              <button
                type="button"
                data-journey-step={s.key}
                data-state={s.state}
                aria-pressed={sel}
                onClick={() => setPicked(s.key)}
                style={s.state === 'now' ? rampAt(i, 6) : undefined}
                className={`tap flex h-full w-full flex-col items-start gap-0.5 rounded-(--radius-control) border px-2.5 py-2 text-left ${tone} ${sel ? 'ring-2 ring-brand-500/40' : ''}`}
              >
                <span className="t-meta inline-flex items-center gap-1 font-semibold text-slate-500">
                  {s.state === 'done' ? (
                    <Check aria-hidden="true" className="size-3.5 text-success-600" />
                  ) : (
                    <span className={`tabular-nums ${s.state === 'now' ? 'ramp-text' : ''}`} style={s.state === 'now' ? rampAt(i, 6) : undefined}>
                      {i + 1}
                    </span>
                  )}
                  {s.state === 'now' ? '지금' : s.state === 'optional' ? '건너뛸 수 있음' : total > 0 ? `${doneCount}/${total}` : ''}
                </span>
                <span className="t-sub font-bold break-keep text-slate-900">{s.label}</span>
                {!compact && <span className="t-meta hidden break-keep text-slate-500 sm:block">{s.hint}</span>}
              </button>
            </li>
          )
        })}
      </ol>

      {/* 고른 걸음 — 할 일 · 작업실 도구 */}
      <div data-testid="journey-open" data-step={open.key} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <h3 className="t-meta font-semibold text-slate-500">
            {openIndex + 1}. {open.label} — 할 일
          </h3>
          <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
            {open.tasks.map((t) => {
              const body = (
                <>
                  {t.done ? (
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" />
                  ) : (
                    <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`t-sub font-semibold break-keep ${t.done ? 'text-slate-500' : 'text-slate-900'}`}>
                      {t.label}
                      {t.soon && (
                        <Badge tone="neutral" className="ml-1.5 align-middle">
                          준비 중
                        </Badge>
                      )}
                    </span>
                    {t.note && <span className="t-meta break-keep text-slate-500">{t.note}</span>}
                  </span>
                  {t.to && <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" />}
                </>
              )
              return (
                <li key={t.label} data-journey-task={t.label} data-done={t.done ? '1' : '0'}>
                  {t.to ? (
                    <Link to={t.to} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5 px-3 py-2.5">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="t-meta inline-flex items-center gap-1 font-semibold text-slate-500">
            <Wrench aria-hidden="true" className="size-3.5" />
            이 걸음에 쓸 작업실 도구 · 이 업체로 열림
          </h3>
          {open.tools.length === 0 ? (
            <p className="t-sub rounded-(--radius-control) border border-dashed border-slate-200 px-3 py-3 break-keep text-slate-500">
              {open.key === 'contract' ? '계약 걸음은 수금 · 서류 탭에서 이어 갑니다.' : '관심사를 고르거나 크레탑 분석을 붙이면 맞는 도구가 여기 뜹니다.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
              {open.tools.map((t, i) => (
                <li key={t.key} data-journey-tool={t.key}>
                  <Link to={t.to} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50">
                    <span aria-hidden="true" className="ramp-dot mt-1.5 size-2 shrink-0 rounded-full" style={rampAt(i, Math.max(2, open.tools.length))} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="t-sub inline-flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                        {t.label}
                        {t.done && <Badge tone="success">결과 있음</Badge>}
                        {t.locked && (
                          <Badge tone="warning">
                            <Lock aria-hidden="true" className="size-3" />
                            잠김
                          </Badge>
                        )}
                      </span>
                      <span className="t-meta break-keep text-slate-500">{t.reason}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
