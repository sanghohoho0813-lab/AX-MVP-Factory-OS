/**
 * 영업 흐름 카드 (D-119) — 1차 미팅 준비부터 계약 뒤 관리까지 여섯 걸음을 한 장에.
 *
 * 걸음을 누르면 그 걸음의 '보이지 않던 할 일'(자동 체크)과 그때 쓸 작업실 도구가 보인다.
 * 도구는 이 업체로 바로 열리고(?client=), 결과를 붙이면 다시 이 업체 기록으로 돌아온다.
 * 잠긴 모듈(D-91)은 감추지 않고 '잠김' 으로 — 나중에 모듈별 결제를 붙이는 자리.
 * 색은 테마 띠(ramp) · 성공색만 쓴다(D-118 규칙).
 */
import { NextStepEditor } from '../ops/NextStepEditor'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fromState } from '../../lib/navFrom'
import { ArrowRight, Check, Circle, Lock, Route, Wrench } from 'lucide-react'
import { Badge } from '../ui/primitives'
import { stageReached } from '../../services/salesPipeline'
import { buildJourney, SALES_PATH_INFO, type JourneyStepKey } from '../../services/salesJourney'
import { useModuleAccessMap } from './useModuleAccessMap'
import { SALES_PATH_ORDER, type ClientOpsRecord, type SalesPath } from '../../types/clientOps'
import { rampAt } from './salesColor'

/** 걸음마다 제 색 (D-123) — 테마 색 하나로 돌린 띠는 옅어서 회색처럼 보였다 */
const STEP_COLORS = [
  { bar: 'bg-sky-500', num: 'bg-sky-600', text: 'text-sky-800', soft: 'bg-sky-50', border: 'border-sky-400' },
  { bar: 'bg-indigo-500', num: 'bg-indigo-600', text: 'text-indigo-800', soft: 'bg-indigo-50', border: 'border-indigo-400' },
  { bar: 'bg-violet-500', num: 'bg-violet-600', text: 'text-violet-800', soft: 'bg-violet-50', border: 'border-violet-400' },
  { bar: 'bg-amber-500', num: 'bg-amber-600', text: 'text-amber-900', soft: 'bg-amber-50', border: 'border-amber-400' },
  { bar: 'bg-emerald-500', num: 'bg-emerald-600', text: 'text-emerald-800', soft: 'bg-emerald-50', border: 'border-emerald-400' },
  { bar: 'bg-teal-500', num: 'bg-teal-600', text: 'text-teal-800', soft: 'bg-teal-50', border: 'border-teal-400' },
]

export function SalesJourneyCard({
  record,
  today,
  onPathChange,
  compact = false,
  onSave,
  foldable = false,
}: {
  record: ClientOpsRecord
  today: string
  /** 계약 경로를 고르면 — 없으면 경로 칸을 보여 주기만 한다 */
  onPathChange?: (path: SalesPath | null) => void
  /** 고객 상세처럼 다른 카드 사이에 둘 때 — 걸음 설명(hint)을 줄인다 */
  compact?: boolean
  /** 주면 카드 위에 '다음 약속' 고치기가 붙는다(D-120) — 미팅 준비에서 */
  onSave?: (next: ClientOpsRecord, msg: string) => void | boolean | Promise<void | boolean>
  /** 한 줄로 접어 두고 눌러서 펼친다(D-121) — 미팅 준비에서. 접힌 줄에 지금 걸음 · 다음 할 일 */
  foldable?: boolean
}) {
  const access = useModuleAccessMap(record.workspaceId)
  const location = useLocation()
  /** D-124: 영업 화면에서 업체 화면으로 가는 줄이면 돌아올 곳을 싣는다 */
  // 영업 화면에서 업체로 가면 '영업에서 왔음' 을 들고 간다 · 업체 화면 안(탭)에서는 이미 들고 온 것을 그대로 넘긴다
  const linkState = (to: string) =>
    !to.startsWith('/ops/clients/') ? undefined : location.pathname.startsWith('/sales') ? fromState(location) : location.pathname.startsWith('/ops/clients/') ? (location.state as unknown) : undefined
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
  const [unfolded, setUnfolded] = useState(false)
  // D-124: 계약 경로는 2차 · 3차 미팅에서 정한다 — 1차 미팅 준비 때는 보이지 않는다(이미 정했으면 보인다)
  const showPath = path !== null || stageReached(record, 'm2')

  if (foldable && !unfolded) {
    const now = journey.steps.find((s) => s.key === journey.current) ?? journey.steps[0]
    const todo = now.tasks.find((t) => !t.done && !t.soon)
    const nowIndex = journey.steps.indexOf(now)
    return (
      <section data-testid="sales-journey" data-folded="1" aria-label="영업 흐름" className="rounded-(--radius-panel) border border-slate-200 bg-white">
        <button
          type="button"
          data-testid="journey-unfold"
          aria-expanded={false}
          onClick={() => setUnfolded(true)}
          className="tap flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5"
        >
          <Route aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="t-sub font-bold break-keep text-slate-900">
              영업 흐름 · <span className={STEP_COLORS[nowIndex % STEP_COLORS.length].text}>{nowIndex + 1}/6 {now.label}</span>
              {path && <span className="font-medium text-slate-500"> · {SALES_PATH_INFO[path].label}</span>}
            </span>
            {todo && <span className="t-meta break-keep text-slate-500">다음 할 일 · {todo.label}</span>}
          </span>
          <span className="t-meta shrink-0 font-semibold text-brand-700">펼치기</span>
        </button>
      </section>
    )
  }

  return (
    <section data-testid="sales-journey" aria-label="영업 흐름" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="t-card inline-flex items-center gap-2 font-bold text-slate-900">
          <Route aria-hidden="true" className="size-5 text-brand-600" />
          영업 흐름
          <span className="t-sub font-medium text-slate-500">· 지금 {journey.steps.find((s) => s.key === journey.current)?.label}</span>
          {foldable && (
            <button type="button" data-testid="journey-fold" onClick={() => setUnfolded(false)} className="t-meta font-semibold text-brand-700 hover:underline">
              접기
            </button>
          )}
        </h2>
      </div>
      {/* D-123: 계약 경로 — 처음 보는 사람도 알게: 무엇을 고르는지 · 고르면 무엇이 바뀌는지 · 다시 누르면 풀린다
          D-124: 2차 미팅 걸음부터만 — 무엇으로 계약할지는 2 · 3차 미팅에서 정해지는 것이라 1차 준비 때는 보이지 않는다(이미 정했으면 보인다) */}
      {showPath && (
      <div role="group" aria-label="계약 경로" data-testid="sales-path" className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="t-sub break-keep text-slate-700">
          <strong className="font-bold text-slate-900">계약 경로</strong> — 이 업체와 무엇으로 계약할 것 같나요?
          <span className="t-meta block text-slate-500">
            {onPathChange ? '하나를 누르면 아래 걸음이 그 경로에 맞춰집니다. 한 번 더 누르면 풀립니다. 모르면 비워 두세요.' : '미팅 준비에서 고를 수 있습니다.'}
          </span>
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {SALES_PATH_ORDER.map((p) => {
            const on = path === p
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                disabled={!onPathChange}
                onClick={() => onPathChange?.(on ? null : p)}
                className={`tap flex flex-col items-start gap-0.5 rounded-(--radius-control) border px-2.5 py-2 text-left ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'} disabled:cursor-default`}
              >
                <span className="t-sub font-bold">
                  {on ? '✓ ' : ''}
                  {SALES_PATH_INFO[p].label}
                </span>
                <span className={`t-meta break-keep ${on ? 'text-white/90' : 'text-slate-500'}`}>{SALES_PATH_INFO[p].hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      )}
      {onSave && (
        <div className="rounded-(--radius-control) border border-slate-200 px-3 py-2.5">
          <NextStepEditor record={record} today={today} onSave={onSave} />
        </div>
      )}

      {/* 여섯 걸음 — D-123: 걸음마다 제 색(회색 · 검정뿐이라 눈에 안 들어왔다). 끝난 걸음은 초록 체크, 지금 걸음은 진하게 */}
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {journey.steps.map((s, i) => {
          const sel = s.key === open.key
          const doneCount = s.tasks.filter((t) => t.done && !t.soon).length
          const total = s.tasks.filter((t) => !t.soon).length
          const c = STEP_COLORS[i % STEP_COLORS.length]
          const now = s.state === 'now'
          const tone = now ? `${c.border} ${c.soft} border-2` : s.state === 'optional' ? 'border-dashed border-slate-300 bg-white' : 'border-slate-200 bg-white'
          return (
            <li key={s.key}>
              <button
                type="button"
                data-journey-step={s.key}
                data-state={s.state}
                aria-pressed={sel}
                onClick={() => setPicked(s.key)}
                className={`tap relative flex h-full w-full flex-col items-start gap-1 overflow-hidden rounded-(--radius-control) border px-2.5 pt-3 pb-2 text-left ${tone} ${sel ? 'ring-2 ring-brand-500/50' : ''}`}
              >
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${c.bar} ${s.state === 'next' || s.state === 'optional' ? 'opacity-40' : ''}`} />
                <span className="t-meta inline-flex items-center gap-1.5 font-semibold text-slate-600">
                  {s.state === 'done' ? (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-success-600 text-white">
                      <Check aria-hidden="true" className="size-3.5" />
                    </span>
                  ) : (
                    <span className={`inline-flex size-5 items-center justify-center rounded-full text-[0.75rem] font-bold text-white tabular-nums ${c.num} ${s.state === 'next' || s.state === 'optional' ? 'opacity-50' : ''}`}>
                      {i + 1}
                    </span>
                  )}
                  <span className={now ? `font-bold ${c.text}` : ''}>
                    {s.state === 'done' ? '끝남' : now ? '지금 여기' : s.state === 'optional' ? '건너뛸 수 있음' : total > 0 ? `${doneCount}/${total}` : ''}
                  </span>
                </span>
                <span className={`t-sub font-bold break-keep ${now ? c.text : s.state === 'done' ? 'text-slate-600' : 'text-slate-900'}`}>{s.label}</span>
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
                    <Link to={t.to} state={linkState(t.to)} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50">
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
          {/* D-123: '작업실 도구' 가 무엇인지 몰랐다 — 쉬운 말로 무엇이고 누르면 어떻게 되는지 */}
          <h3 className="t-sub inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <Wrench aria-hidden="true" className="size-4" />
            이 단계에서 쓰면 좋은 계산기 · 분석 도구
          </h3>
          <p className="t-meta -mt-0.5 break-keep text-slate-500">누르면 이 업체 정보가 채워진 채로 열리고, 나온 결과는 이 업체 기록에 붙습니다. 안 써도 영업은 그대로 진행됩니다.</p>
          {open.tools.length === 0 ? (
            <p className="t-sub rounded-(--radius-control) border border-dashed border-slate-200 px-3 py-3 break-keep text-slate-500">
              {open.key === 'contract' ? '계약 걸음은 수금 · 서류 탭에서 이어 갑니다.' : stageReached(record, 'm1done') ? '관심사를 고르거나 크레탑 분석을 붙이면 맞는 도구가 여기 뜹니다.' : '크레탑 분석을 붙이거나 1차 미팅에서 관심사를 확인하면 맞는 도구가 여기 뜹니다.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
              {open.tools.map((t, i) => (
                <li key={t.key} data-journey-tool={t.key}>
                  <Link to={t.to} state={linkState(t.to)} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50">
                    <span aria-hidden="true" className="ramp-dot mt-1.5 size-2 shrink-0 rounded-full" style={rampAt(i, Math.max(2, open.tools.length))} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="t-sub inline-flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                        {t.label}
                        {t.done && <Badge tone="success">결과 있음</Badge>}
                        {t.locked && (
                          <Badge tone="warning">
                            <Lock aria-hidden="true" className="size-3" />
                            아직 못 씀(잠김)
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
