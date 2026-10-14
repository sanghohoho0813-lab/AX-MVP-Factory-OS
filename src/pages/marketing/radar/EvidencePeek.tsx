/**
 * 숫자 뒤 영상 목록 (D-198 대표 요청) — '터진 영상 4' · '6개 채널 · 16편' · '19곳 중 12곳' 같은 숫자에
 *  - PC(마우스): 올리면 그 숫자가 센 영상이 바로 아래 떠 있는 목록으로 · 누르면 고정(✕ · 바깥 · Esc 로 닫기)
 *  - 휴대폰 · 태블릿(손가락): 누르면 영상 목록 창
 * 목록은 그 숫자가 센 영상 그대로다(빼거나 더하지 않는다) — 숫자 = 줄 수 · 채널 수 = 목록 속 채널 수.
 * 영상을 누르면 영상 상세 창(기존과 같은 창).
 */
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { shortNum } from '../../../services/marketing/ytBench'
import { evidenceChannels, evidenceOrder, type RadarVideo } from '../../../services/marketing/ytRadar'
import { RatioChip, Thumb } from './RadarParts'

interface PeekEnv {
  onOpenVideo: (v: RadarVideo) => void
  noThumb: boolean
}
const PeekCtx = createContext<PeekEnv>({ onOpenVideo: () => {}, noThumb: false })
export const PeekProvider = PeekCtx.Provider

/** 마우스로 올려 볼 수 있는 기기인가(손가락 기기는 누르면 창) */
function useFinePointer(): boolean {
  const q = '(hover: hover) and (pointer: fine)'
  const [fine, setFine] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setFine(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return fine
}

/** 채널 칩 — 앞 6곳 · 나머지는 '외 n곳' */
const CH_SHOWN = 6

const ago = (d: number) => (d < 1 ? '오늘' : `${Math.floor(d)}일 전`)

function EvidenceBody({ title, basis, videos, onPick, noThumb, head = true }: { title: string; basis: string; videos: readonly RadarVideo[]; onPick: (v: RadarVideo) => void; noThumb: boolean; head?: boolean }) {
  const chs = useMemo(() => evidenceChannels(videos), [videos])
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        {head && <p className="t-sub font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{title}</p>}
        <p className="t-meta break-keep text-slate-600" data-testid="radar-peek-basis">
          {basis} · 채널 {chs.length}곳 · 영상 {videos.length}편
        </p>
      </div>
      <ul className="flex flex-wrap gap-1" aria-label="채널">
        {chs.slice(0, CH_SHOWN).map((c) => (
          <li key={c.id} className="t-meta max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700" data-testid="radar-peek-ch">
            {c.name} <span className="font-bold text-slate-900">{c.count}</span>
          </li>
        ))}
        {chs.length > CH_SHOWN && <li className="t-meta px-1 py-0.5 text-slate-500">외 {chs.length - CH_SHOWN}곳</li>}
      </ul>
      <ul className="flex flex-col divide-y divide-slate-100" data-testid="radar-peek-list">
        {videos.map((v) => (
          <li key={v.id} className="min-w-0">
            <button type="button" onClick={() => onPick(v)} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-control) px-1 py-1.5 text-left hover:bg-slate-50" data-testid="radar-peek-row" aria-label={`${v.title} — 자세히`}>
              <Thumb v={v} noThumb={noThumb} className="w-20 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-sub line-clamp-2 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{v.title}</span>
                {/* 채널 이름만 줄이고 날짜 · 조회수는 늘 보이게(휴대폰에서 '조회 …' 로 잘렸다) */}
                <span className="t-meta flex min-w-0 flex-wrap items-baseline gap-x-1 text-slate-500">
                  <span className="min-w-0 max-w-full truncate">{v.channelName}</span>
                  <span className="shrink-0 whitespace-nowrap">
                    · {ago(v.ageDays)} · 조회 {shortNum(v.views)}
                  </span>
                </span>
                <RatioChip v={v} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Pos {
  left: number
  width: number
  maxH: number
  top?: number
  bottom?: number
}

/**
 * 숫자 하나를 감싼다. videos 가 비면 그냥 글(누를 것이 없다).
 * title — 목록 머리(주제 · 키워드 이름) · basis — 무엇을 셌나('최근 2주' · '평소보다 터진 영상(30일)')
 */
export function Peek({ videos, title, basis, kind, children, className = '' }: { videos: readonly RadarVideo[]; title: string; basis: string; kind: string; children: ReactNode; className?: string }) {
  const env = useContext(PeekCtx)
  const fine = useFinePointer()
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [mode, setMode] = useState<'closed' | 'hover' | 'pinned'>('closed')
  const [sheet, setSheet] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const id = useId()
  const list = useMemo(() => evidenceOrder(videos), [videos])

  const clear = () => window.clearTimeout(timer.current)
  const openSoon = () => {
    if (!fine) return
    clear()
    timer.current = window.setTimeout(() => setMode((m) => (m === 'closed' ? 'hover' : m)), 120)
  }
  const closeSoon = () => {
    clear()
    timer.current = window.setTimeout(() => setMode((m) => (m === 'hover' ? 'closed' : m)), 200)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const place = useCallback(() => {
    const el = btn.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(440, vw - 16)
    const left = Math.min(Math.max(8, r.left), vw - width - 8)
    const below = vh - r.bottom - 14
    const above = r.top - 14
    const up = below < 280 && above > below
    const maxH = Math.max(160, Math.min(480, up ? above : below))
    setPos(up ? { left, width, maxH, bottom: vh - r.top + 6 } : { left, width, maxH, top: r.bottom + 6 })
  }, [])

  useLayoutEffect(() => {
    if (mode === 'closed') return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [mode, place])

  // 고정했을 때 — 바깥을 누르면 닫는다 · Esc 는 열려 있으면 언제나
  useEffect(() => {
    if (mode === 'closed') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMode('closed')
      btn.current?.focus()
    }
    const onDown = (e: MouseEvent) => {
      if (mode !== 'pinned') return
      const t = e.target as Node
      if (btn.current?.contains(t) || panel.current?.contains(t)) return
      setMode('closed')
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [mode])

  if (list.length === 0) return <span className={className}>{children}</span>

  const pick = (v: RadarVideo) => {
    clear()
    setMode('closed')
    setSheet(false)
    env.onOpenVideo(v)
  }
  const open = mode !== 'closed'

  return (
    <>
      <button
        ref={btn}
        type="button"
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
        onClick={() => {
          clear()
          if (fine) setMode((m) => (m === 'pinned' ? 'closed' : 'pinned'))
          else setSheet(true)
        }}
        aria-expanded={fine ? open : sheet}
        aria-controls={open ? id : undefined}
        aria-label={`${title} — ${basis} 영상 ${list.length}편 보기`}
        className={`tap inline-flex max-w-full cursor-pointer items-center rounded-[6px] text-left underline decoration-slate-400 decoration-dotted underline-offset-[3px] hover:bg-white hover:decoration-slate-700 focus-visible:outline-2 focus-visible:outline-brand-500 ${open ? 'bg-white decoration-slate-700' : ''} ${className}`}
        data-testid="radar-peek"
        data-kind={kind}
        data-count={list.length}
      >
        {children}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={`${title} — 관련 영상 ${list.length}편`}
            onMouseEnter={clear}
            onMouseLeave={closeSoon}
            className="fixed z-[45] flex flex-col overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white shadow-(--shadow-overlay)"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}
            data-testid="radar-peek-panel"
            data-mode={mode}
            data-count={list.length}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-3">
              <EvidenceBody title={title} basis={basis} videos={list} onPick={pick} noThumb={env.noThumb} />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-1.5">
              <span className="t-meta break-keep text-slate-500">{mode === 'pinned' ? '영상을 누르면 자세히 봅니다' : '숫자를 누르면 목록이 고정됩니다'}</span>
              {mode === 'pinned' && (
                <button type="button" onClick={() => setMode('closed')} className="tap t-meta inline-flex shrink-0 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-slate-600 hover:bg-white" data-testid="radar-peek-close">
                  <X aria-hidden="true" className="size-3.5" /> 닫기
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {sheet && (
        <Modal open title={`${title} — 영상 ${list.length}편`} onClose={() => setSheet(false)} size="lg">
          <div data-testid="radar-peek-sheet" data-count={list.length}>
            <EvidenceBody title={title} basis={basis} videos={list} onPick={pick} noThumb={env.noThumb} head={false} />
          </div>
        </Modal>
      )}
    </>
  )
}
