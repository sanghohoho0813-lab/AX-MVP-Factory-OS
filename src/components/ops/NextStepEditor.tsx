/**
 * 다음 약속 고치기 (D-120) — "다음에 무엇을, 언제".
 *
 * 누르면 그 자리에서 펼쳐진다: 무엇을(자주 쓰는 말 눌러 채우기) · 언제(오늘 · 내일 · 3일 뒤 · 1주 뒤 · 달력).
 * 50~60대도 쓰기 쉽게 — 큰 글씨 · 누르기 쉬운 단추 · 날짜는 '9월 29일(화) · 3일 뒤' 처럼 사람 말로.
 * 적은 날짜는 일정(달력) · 오늘 화면에 뜬다.
 */
import { useState } from 'react'
import { CalendarClock, Pencil } from 'lucide-react'
import { Button } from '../ui/Button'
import {
  NEXT_QUICK_DAYS,
  addDaysLocal,
  friendlyDate,
  nextSuggestions,
  relativeDay,
  suggestsFirstMeeting,
  withNextAction,
} from '../../services/clientOpsNextAction'
import type { ClientOpsRecord } from '../../types/clientOps'

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none'

export function NextStepEditor({
  record,
  today,
  onSave,
  label = '다음 약속',
}: {
  record: ClientOpsRecord
  today: string
  /** 저장 — 됐으면 true 를 돌려주면 펼친 칸을 닫는다 */
  onSave: (next: ClientOpsRecord, msg: string) => void | boolean | Promise<void | boolean>
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(record.nextAction)
  const [date, setDate] = useState(record.nextActionDueDate)
  const [move, setMove] = useState(true)
  const [busy, setBusy] = useState(false)

  const start = () => {
    setText(record.nextAction)
    setDate(record.nextActionDueDate)
    setMove(true)
    setOpen(true)
  }
  const save = async (t: string, d: string) => {
    setBusy(true)
    const firstMeeting = suggestsFirstMeeting(record, t, d)
    const next = withNextAction(record, t, d, { moveToM1: firstMeeting && move })
    const msg = t || d ? `다음 약속을 적었습니다${d ? ` — ${friendlyDate(d)}` : ''}${firstMeeting && move ? ' · 1차 미팅 예정으로 옮김' : ''}.` : '다음 약속을 비웠습니다.'
    const ok = await onSave(next, msg)
    setBusy(false)
    if (ok !== false) setOpen(false)
  }

  const rel = record.nextActionDueDate ? relativeDay(record.nextActionDueDate, today) : ''
  const overdue = rel.endsWith('지남')

  if (!open) {
    return (
      <div data-testid="next-step" className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <CalendarClock aria-hidden="true" className={`size-5 shrink-0 ${overdue ? 'text-danger-600' : 'text-brand-600'}`} />
        <span className="t-sub font-semibold text-slate-600">{label}</span>
        <span className="t-body min-w-0 flex-[1_1_14rem] break-keep text-slate-900">
          {record.nextAction || record.nextActionDueDate ? (
            <>
              <strong className="font-semibold">{record.nextAction || '할 일'}</strong>
              {record.nextActionDueDate && (
                <span className={overdue ? 'font-semibold text-danger-700' : 'text-slate-700'}>
                  {' '}
                  · {friendlyDate(record.nextActionDueDate)} · {rel}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500">아직 정하지 않았습니다</span>
          )}
        </span>
        <Button size="sm" variant="secondary" onClick={start} data-testid="next-step-edit">
          <Pencil aria-hidden="true" className="size-4" />
          {record.nextAction || record.nextActionDueDate ? '바꾸기' : '정하기'}
        </Button>
      </div>
    )
  }

  const firstMeeting = suggestsFirstMeeting(record, text, date)
  return (
    <div data-testid="next-step" data-open="1" className="flex flex-col gap-3 rounded-(--radius-control) border border-brand-200 bg-brand-50/40 p-3.5">
      <p className="t-sub inline-flex items-center gap-2 font-semibold text-slate-800">
        <CalendarClock aria-hidden="true" className="size-5 text-brand-600" />
        {label} 정하기
      </p>
      <label className="block text-[0.95rem] font-medium text-slate-700">
        무엇을
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="예) 1차 미팅, 자료 받기, 견적 회신 확인" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-2" aria-label="자주 쓰는 말">
        {nextSuggestions(record).map((s) => (
          <button key={s} type="button" onClick={() => setText(s)} className="tap rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[0.95rem] font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700">
            {s}
          </button>
        ))}
      </div>
      <label className="block text-[0.95rem] font-medium text-slate-700">
        언제
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-2" aria-label="날짜 빨리 고르기">
        {NEXT_QUICK_DAYS.map((q) => {
          const v = addDaysLocal(today, q.days)
          const on = date === v
          return (
            <button
              key={q.label}
              type="button"
              aria-pressed={on}
              onClick={() => setDate(v)}
              className={`tap rounded-full border px-3.5 py-1.5 text-[0.95rem] font-medium ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
            >
              {q.label}
            </button>
          )
        })}
      </div>
      {date && <p className="t-sub text-slate-600">→ {friendlyDate(date)} · {relativeDay(date, today)}</p>}
      {firstMeeting && (
        <label className="t-sub flex items-center gap-2 text-slate-700">
          <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} className="size-5 accent-brand-600" />
          영업 단계를 <strong className="font-semibold">1차 미팅 예정</strong>으로 옮기기
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save(text, date)} disabled={busy} data-testid="next-step-save">
          {busy ? '저장 중…' : '저장'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          취소
        </Button>
        {(record.nextAction || record.nextActionDueDate) && (
          <Button variant="ghost" onClick={() => void save('', '')} disabled={busy}>
            비우기
          </Button>
        )}
      </div>
    </div>
  )
}
