/**
 * 큰 달력 (D-131) — OS 의 모든 날짜 칸(<input type="date">)을 누르면 이 달력이 뜬다.
 *
 * 왜: 브라우저 · 휴대폰의 기본 달력은 기기마다 모양이 달랐고, 요일이 '금토일월…' 처럼 엉뚱한 날부터 시작하거나
 *     칸이 작아 누르기 어려웠다. 날짜 칸이 80곳 가까이(옮겨 온 도구 포함) 있어 하나씩 바꾸지 않고,
 *     앱 전체에서 날짜 칸을 누르는 순간을 받아 이 달력 하나를 띄운다.
 *
 *  - 요일은 늘 일 월 화 수 목 금 토(일 빨강 · 토 파랑). 칸은 44px 이상.
 *  - 연도 · 월은 눌러서 바로 고른다(취임일 · 생년월일처럼 몇 년 전 날짜도 빨리).
 *  - 오늘 · 지우기 · 직접 적기(20150302 · 2015-03-02 · 2015.3.2). min · max 를 지킨다.
 *  - 고르면 날짜 칸의 값을 바꾸고 input · change 를 보낸다 — 화면(React)은 사람이 적은 것과 똑같이 받는다.
 *  - 휴대폰은 기본 달력이 먼저 뜨지 않게 날짜 칸을 '읽기 전용'으로 둔다(값은 이 달력이 넣는다).
 *    그 칸이 원래 읽기 전용 · 잠김이면 건드리지 않는다. data-native-date 를 붙이면 예전 달력 그대로.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useBackToClose } from '../../lib/backToClose'
import { parseTypedDate } from '../../lib/typedDate'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

interface Ymd {
  y: number
  m: number
  d: number
}

function parseIso(v: string): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!r) return null
  return { y: Number(r[1]), m: Number(r[2]) - 1, d: Number(r[3]) }
}

function todayYmd(): Ymd {
  const n = new Date()
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }
}

function isPickable(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement) || el.type !== 'date') return false
  if (el.disabled || 'nativeDate' in el.dataset) return false
  if (el.readOnly && el.dataset.dp !== '1') return false
  return true
}

/** React 가 받는 방식 그대로 값을 넣는다(사람이 적은 것처럼) */
function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function labelOf(el: HTMLInputElement): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const lab = el.labels?.[0]?.textContent?.trim()
  if (lab) return lab.slice(0, 40)
  return '날짜'
}

export function DatePickerHost() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    const open = (el: HTMLInputElement) => {
      el.blur()
      setTarget(el)
    }
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('input[type="date"]') ?? null
      if (!isPickable(el)) return
      e.preventDefault()
      open(el)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!isPickable(e.target)) return
      if (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault()
        open(e.target)
      }
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)

    // 휴대폰: 기본 달력이 먼저 뜨지 않게 읽기 전용으로(이 달력이 값을 넣는다). 자동 시험(webdriver)은 칸에 바로 적으므로 두지 않는다
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !navigator.webdriver
    let mo: MutationObserver | null = null
    if (coarse) {
      const mark = () => {
        document.querySelectorAll<HTMLInputElement>('input[type="date"]:not([data-dp])').forEach((el) => {
          if (el.readOnly || el.disabled || 'nativeDate' in el.dataset) return
          el.dataset.dp = '1'
          el.readOnly = true
        })
      }
      mark()
      mo = new MutationObserver(mark)
      mo.observe(document.body, { childList: true, subtree: true })
    }
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
      mo?.disconnect()
    }
  }, [])

  const close = useCallback(() => {
    setTarget((t) => {
      t?.focus({ preventScroll: true })
      return null
    })
  }, [])

  if (!target) return null
  return <BigCalendar input={target} onClose={close} />
}

function BigCalendar({ input, onClose }: { input: HTMLInputElement; onClose: () => void }) {
  useBackToClose(true, onClose)
  const selected = parseIso(input.value)
  const today = todayYmd()
  const [view, setView] = useState<{ y: number; m: number }>(() => (selected ? { y: selected.y, m: selected.m } : { y: today.y, m: today.m }))
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [typed, setTyped] = useState('')
  const [typedErr, setTypedErr] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const min = input.min || ''
  const max = input.max || ''
  const label = labelOf(input)

  useEffect(() => {
    panel.current?.focus()
    // 아래 창(모달)의 Esc 가 같이 닫히지 않게 — 이 달력만 닫는다
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max)
  const pick = (v: string) => {
    if (!allowed(v)) return
    setInputValue(input, v)
    onClose()
  }

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay()
    const days = new Date(view.y, view.m + 1, 0).getDate()
    const out: (number | null)[] = []
    for (let i = 0; i < first; i++) out.push(null)
    for (let d = 1; d <= days; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [view])

  const shift = (n: number) =>
    setView((v) => {
      const m = v.m + n
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  const yearStart = Math.floor(view.y / 12) * 12

  const applyTyped = () => {
    const v = parseTypedDate(typed)
    if (!v) {
      setTypedErr('날짜를 읽지 못했습니다 — 예: 20150302')
      return
    }
    if (!allowed(v)) {
      setTypedErr('고를 수 있는 기간 밖입니다')
      return
    }
    pick(v)
  }

  const headline = selected ? `${selected.y}년 ${selected.m + 1}월 ${selected.d}일 ${WEEK[new Date(selected.y, selected.m, selected.d).getDay()]}요일` : '아직 고르지 않았습니다'
  const navBtn = 'tap inline-flex size-12 items-center justify-center rounded-(--radius-control) text-slate-700 hover:bg-slate-100'

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" data-testid="big-calendar">
      <button type="button" aria-label="달력 닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-navy-950/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} — 날짜 고르기`}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay) sm:max-w-md sm:rounded-(--radius-panel)"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <p className="t-sub break-keep text-slate-500">{label}</p>
            <p className="text-[1.15rem] font-bold text-slate-900" data-testid="big-calendar-selected">
              {headline}
            </p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} className="tap inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-1 px-3 pt-3">
          <button
            type="button"
            className={navBtn}
            aria-label={mode === 'years' ? '앞 12년' : mode === 'months' ? '작년' : '지난달'}
            onClick={() => (mode === 'years' ? setView((v) => ({ ...v, y: v.y - 12 })) : mode === 'months' ? setView((v) => ({ ...v, y: v.y - 1 })) : shift(-1))}
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMode(mode === 'years' ? 'days' : 'years')} aria-pressed={mode === 'years'} className="tap rounded-(--radius-control) px-3 text-[1.2rem] font-bold text-slate-900 hover:bg-slate-100" data-testid="big-calendar-year">
              {mode === 'years' ? `${yearStart}~${yearStart + 11}년` : `${view.y}년`}
            </button>
            {mode !== 'years' && (
              <button type="button" onClick={() => setMode(mode === 'months' ? 'days' : 'months')} aria-pressed={mode === 'months'} className="tap rounded-(--radius-control) px-3 text-[1.2rem] font-bold text-slate-900 hover:bg-slate-100" data-testid="big-calendar-month">
                {view.m + 1}월
              </button>
            )}
          </div>
          <button
            type="button"
            className={navBtn}
            aria-label={mode === 'years' ? '뒤 12년' : mode === 'months' ? '내년' : '다음 달'}
            onClick={() => (mode === 'years' ? setView((v) => ({ ...v, y: v.y + 12 })) : mode === 'months' ? setView((v) => ({ ...v, y: v.y + 1 })) : shift(1))}
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
        </div>

        <div className="px-3 pt-2 pb-3">
          {mode === 'years' && (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="연도 고르기">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setView((v) => ({ ...v, y }))
                    setMode('months')
                  }}
                  className={`tap h-14 rounded-(--radius-control) text-[1.05rem] font-semibold tabular-nums ${y === view.y ? 'bg-brand-600 text-white' : y === today.y ? 'border border-brand-300 text-brand-800' : 'text-slate-800 hover:bg-slate-100'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          {mode === 'months' && (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="월 고르기">
              {Array.from({ length: 12 }, (_, m) => m).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setView((v) => ({ ...v, m }))
                    setMode('days')
                  }}
                  className={`tap h-14 rounded-(--radius-control) text-[1.05rem] font-semibold ${m === view.m ? 'bg-brand-600 text-white' : 'text-slate-800 hover:bg-slate-100'}`}
                >
                  {m + 1}월
                </button>
              ))}
            </div>
          )}
          {mode === 'days' && (
            <div role="grid" aria-label={`${view.y}년 ${view.m + 1}월`}>
              <div className="grid grid-cols-7" role="row" data-testid="big-calendar-week">
                {WEEK.map((w, i) => (
                  <span key={w} role="columnheader" className={`py-1.5 text-center text-[0.95rem] font-bold ${i === 0 ? 'text-danger-600' : i === 6 ? 'text-brand-700' : 'text-slate-600'}`}>
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((d, i) => {
                  if (d === null) return <span key={`e${i}`} aria-hidden="true" />
                  const v = iso(view.y, view.m, d)
                  const isSel = !!selected && selected.y === view.y && selected.m === view.m && selected.d === d
                  const isToday = today.y === view.y && today.m === view.m && today.d === d
                  const ok = allowed(v)
                  const dow = i % 7
                  return (
                    <button
                      key={v}
                      type="button"
                      role="gridcell"
                      aria-selected={isSel}
                      aria-label={`${view.m + 1}월 ${d}일 ${WEEK[dow]}요일${isToday ? ' (오늘)' : ''}`}
                      disabled={!ok}
                      onClick={() => pick(v)}
                      data-day={v}
                      className={`mx-auto flex size-12 items-center justify-center rounded-full text-[1.05rem] font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-30 ${
                        isSel
                          ? 'bg-brand-600 text-white'
                          : isToday
                            ? 'border-2 border-brand-500 text-brand-800'
                            : dow === 0
                              ? 'text-danger-600 hover:bg-slate-100'
                              : dow === 6
                                ? 'text-brand-700 hover:bg-slate-100'
                                : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">직접 적기</span>
            <span className="mt-1 flex gap-2">
              <input
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  setTypedErr('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyTyped()
                }}
                inputMode="numeric"
                placeholder="예: 20150302"
                aria-label="날짜 직접 적기"
                className="min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 text-[1rem] focus:border-brand-500 focus:outline-none"
              />
              <button type="button" onClick={applyTyped} className="tap min-h-11 shrink-0 rounded-(--radius-control) border border-slate-300 px-4 font-semibold text-slate-800 hover:bg-slate-50">
                적용
              </button>
            </span>
            {typedErr && <span className="t-sub mt-1 block text-danger-700">{typedErr}</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => pick(iso(today.y, today.m, today.d))} disabled={!allowed(iso(today.y, today.m, today.d))} className="tap min-h-12 flex-1 rounded-(--radius-control) bg-brand-600 px-4 text-[1.05rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              오늘
            </button>
            {!input.required && (
              <button
                type="button"
                onClick={() => {
                  setInputValue(input, '')
                  onClose()
                }}
                className="tap min-h-12 rounded-(--radius-control) border border-slate-300 px-4 text-[1.05rem] font-semibold text-slate-700 hover:bg-slate-50"
              >
                지우기
              </button>
            )}
            <button type="button" onClick={onClose} className="tap min-h-12 rounded-(--radius-control) border border-slate-300 px-4 text-[1.05rem] font-semibold text-slate-700 hover:bg-slate-50">
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
