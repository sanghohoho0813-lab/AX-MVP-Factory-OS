/**
 * 달력에서 바로 적기 (D-139).
 *
 * 날짜를 한 번 더 누르거나(휴대폰) 두 번 누르면(컴퓨터) · '＋ 이 날에 적기' 를 누르면 아래에서 올라온다.
 *  - 할 일: 내용 · 업체 · 날짜 · 반복(한 번 · 매주 · 2주마다 · 매월 × 횟수) · 주말·쉬는 날이면 앞 영업일로
 *  - 쉬는 날: 이름(대체공휴일 · 설날 연휴 · 추석 연휴 …) · 며칠 연속 — 달력에 날짜가 빨간 글자(일요일처럼)
 * 저장이 실패하면 적은 것은 그대로 남는다(onSave 가 false).
 */
import { todayLocalDate } from '../../lib/appClock'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { useMemo, useState } from 'react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { TODO_PRESETS } from '../../services/journalService'
import { DAY_OFF_PRESETS, dateLabel, rangeDates, type DayOff, type DayOffKind } from '../../services/daysOff'
import { REPEAT_LABEL, repeatDates, type RepeatEvery } from '../../services/repeatDates'


export interface QuickTodoInput {
  content: string
  clientId: string | null
  dates: string[]
}

const chip = (on: boolean) =>
  `tap t-sub shrink-0 rounded-full border px-3 py-1.5 font-medium whitespace-nowrap ${on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'}`

export function CalendarQuickSheet({
  date,
  initialTab = 'todo',
  clients,
  daysOffOn,
  offDates,
  onSaveTodos,
  onSaveDaysOff,
  onRemoveDayOff,
  onClose,
}: {
  date: string
  initialTab?: 'todo' | 'off'
  clients: { id: string; companyName: string; businessNumber?: string; corporateNumber?: string }[]
  /** 이 날에 이미 표시된 쉬는 날 */
  daysOffOn: DayOff[]
  /** 모든 쉬는 날 — 반복을 앞 영업일로 당길 때 */
  offDates: ReadonlySet<string>
  onSaveTodos: (input: QuickTodoInput) => Promise<boolean>
  onSaveDaysOff: (items: { date: string; name: string; kind: DayOffKind }[]) => Promise<boolean>
  onRemoveDayOff: (d: DayOff) => Promise<boolean>
  onClose: () => void
}) {
  const [tab, setTab] = useState<'todo' | 'off'>(initialTab)
  const [busy, setBusy] = useState(false)
  // 할 일
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState('')
  const [due, setDue] = useState(date)
  const [every, setEvery] = useState<RepeatEvery>('none')
  const [count, setCount] = useState(6)
  const [skipOff, setSkipOff] = useState(true)
  // 쉬는 날
  const [offName, setOffName] = useState('')
  const [offKind, setOffKind] = useState<DayOffKind>('holiday')
  const [offDays, setOffDays] = useState(1)

  // D-150: 쉬는 날을 피해 당기다 오늘보다 앞서면 다음 평일로(넣자마자 '지난 할 일' 이 되지 않게)
  const dates = useMemo(() => repeatDates(due, every, count, { skipOff: every !== 'none' && skipOff ? offDates : null, notBefore: todayLocalDate() }), [due, every, count, skipOff, offDates])
  const offRange = useMemo(() => rangeDates(date, offDays), [date, offDays])

  const saveTodo = async () => {
    const content = text.trim()
    if (!content || busy || dates.length === 0) return
    setBusy(true)
    const ok = await onSaveTodos({ content, clientId: clientId || null, dates })
    setBusy(false)
    if (ok) onClose()
  }
  const saveOff = async () => {
    const name = offName.trim() || '쉬는 날'
    if (busy) return
    setBusy(true)
    const ok = await onSaveDaysOff(offRange.map((d) => ({ date: d, name, kind: offKind })))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <BottomSheet
      title={`${dateLabel(date)} — 적기`}
      onClose={onClose}
      footer={
        tab === 'todo' ? (
          <Button variant="primary" onClick={() => void saveTodo()} disabled={!text.trim() || busy} className="w-full" data-testid="quick-save-todo">
            {busy ? '넣는 중…' : dates.length > 1 ? `할 일 ${dates.length}개 넣기` : '할 일 넣기'}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void saveOff()} disabled={busy} className="w-full" data-testid="quick-save-off">
            {busy ? '표시하는 중…' : offRange.length > 1 ? `${offRange.length}일 쉬는 날로 표시` : '쉬는 날로 표시'}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="calendar-quick-sheet">
        <div className="grid grid-cols-2 gap-1 rounded-(--radius-control) bg-slate-100 p-1" role="tablist" aria-label="무엇을 적을까요">
          {(
            [
              ['todo', '할 일'],
              ['off', '쉬는 날'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`tap t-body rounded-(--radius-control) py-2 font-semibold ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'todo' ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold text-slate-700">무엇을</span>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void saveTodo()
                }}
                placeholder="예: 한솔테크 대표님 통화 — 서류 요청"
                aria-label="할 일 내용"
                className="t-body rounded-(--radius-control) border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
              {TODO_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setText((v) => (v.trim() === '' ? p.text : v.startsWith(p.text) ? v : `${p.text}${v.trim()}`))} className={chip(false)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="t-sub font-semibold text-slate-700">날짜</span>
                <input type="date" aria-label="할 일 날짜" value={due} onChange={(e) => e.target.value && setDue(e.target.value)} className="t-body rounded-(--radius-control) border border-slate-300 px-3 py-2.5" />
              </label>
              {clients.length > 0 && (
                <label className="flex flex-col gap-1.5">
                  <span className="t-sub font-semibold text-slate-700">업체</span>
                  <select aria-label="관련 업체" value={clientId} onChange={(e) => setClientId(e.target.value)} className="t-body rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5">
                    <option value="">업체 없음</option>
                    <ClientPickerOptions clients={clients} />
                  </select>
                </label>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="t-sub font-semibold text-slate-700">반복</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="반복">
                {(Object.keys(REPEAT_LABEL) as RepeatEvery[]).map((k) => (
                  <button key={k} type="button" aria-pressed={every === k} onClick={() => setEvery(k)} className={chip(every === k)}>
                    {REPEAT_LABEL[k]}
                  </button>
                ))}
              </div>
              {every !== 'none' && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="몇 번">
                    {[4, 6, 12].map((n) => (
                      <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>
                        {n}번
                      </button>
                    ))}
                  </div>
                  <label className="t-sub flex items-center gap-2 text-slate-700">
                    <input type="checkbox" checked={skipOff} onChange={(e) => setSkipOff(e.target.checked)} className="size-5" />
                    주말 · 쉬는 날이면 앞 영업일로 당기기
                  </label>
                  <p className="t-sub break-keep text-slate-500" data-testid="quick-repeat-preview">
                    {dates.slice(0, 4).map(dateLabel).join(' · ')}
                    {dates.length > 4 ? ` 외 ${dates.length - 4}번` : ''}
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {daysOffOn.length > 0 && (
              <ul className="flex flex-col gap-1.5" data-testid="quick-off-existing">
                {daysOffOn.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
                    <span className="t-body font-semibold text-weekday-sun">{d.name}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true)
                        await onRemoveDayOff(d)
                        setBusy(false)
                      }}
                      disabled={busy}
                      className="tap t-sub rounded-(--radius-control) px-2 font-semibold text-slate-600 underline hover:text-danger-700"
                    >
                      표시 지우기
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="t-sub font-semibold text-slate-700">이름</span>
              <input value={offName} onChange={(e) => setOffName(e.target.value)} placeholder="예: 대체공휴일 · 창립기념일" aria-label="쉬는 날 이름" maxLength={30} className="t-body rounded-(--radius-control) border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_OFF_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={offName === p.name}
                  onClick={() => {
                    setOffName(p.name)
                    setOffKind(p.kind)
                    if (p.kind === 'festive' && offDays === 1) setOffDays(3)
                  }}
                  className={chip(offName === p.name)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="t-sub font-semibold text-slate-700">며칠 연속</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="며칠 연속">
                {[1, 2, 3, 4, 5, 7].map((n) => (
                  <button key={n} type="button" aria-pressed={offDays === n} onClick={() => setOffDays(n)} className={chip(offDays === n)}>
                    {n}일
                  </button>
                ))}
              </div>
              <p className="t-sub break-keep text-slate-500" data-testid="quick-off-preview">
                {offRange.length > 1 ? `${dateLabel(offRange[0])} ~ ${dateLabel(offRange[offRange.length - 1])}` : dateLabel(offRange[0] ?? date)} — 달력에 날짜가 빨간 글자로 보입니다
              </p>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

/** 법정 공휴일 한 번에 넣기 — 빠진 것만 보여 주고, 고른 것만 넣는다 */
export function HolidayImportSheet({
  year,
  items,
  onSave,
  onClose,
}: {
  year: number
  items: { date: string; name: string; kind: DayOffKind }[]
  onSave: (items: { date: string; name: string; kind: DayOffKind }[]) => Promise<boolean>
  onClose: () => void
}) {
  const [off, setOff] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const picked = items.filter((h) => !off.has(h.date))
  return (
    <BottomSheet
      title={`${year}년 법정 공휴일 넣기`}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          className="w-full"
          disabled={busy || picked.length === 0}
          data-testid="holiday-import-save"
          onClick={async () => {
            setBusy(true)
            const ok = await onSave(picked)
            setBusy(false)
            if (ok) onClose()
          }}
        >
          {busy ? '넣는 중…' : `${picked.length}일 넣기`}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" data-testid="holiday-import">
        <p className="t-sub break-keep text-slate-600">대체공휴일까지 넣었습니다. 넣은 뒤에도 날짜마다 지우거나 이름을 바꿀 수 있습니다.</p>
        <p className="t-sub break-keep text-amber-700">★ 설 · 추석 · 부처님오신날(음력)과 새로 정하는 임시공휴일은 정부 발표로 한 번 확인해 주세요.</p>
        <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
          {items.map((h) => (
            <li key={h.date}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={!off.has(h.date)}
                  onChange={() =>
                    setOff((s) => {
                      const n = new Set(s)
                      if (n.has(h.date)) n.delete(h.date)
                      else n.add(h.date)
                      return n
                    })
                  }
                  className="size-5 shrink-0"
                />
                <span className="t-body w-28 shrink-0 tabular-nums text-slate-700">{dateLabel(h.date)}</span>
                <span className="t-body min-w-0 break-keep font-semibold text-danger-700">{h.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}
