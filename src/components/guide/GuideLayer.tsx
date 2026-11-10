/**
 * D-565 메뉴 안내 카드 — `data-guide="<메뉴 key>"` 가 붙은 것에 마우스를 올리면(또는 키보드로 옮기면) 그 메뉴의
 * '무엇을 하나요 · 왜 있나요 · 쓰면 이렇게 돼요 · 앞으로' 가 옆에 뜬다. 글은 content/menuGuide, 영상 자리는 사용법 안내 화면(/guide).
 *
 *  - 한 번만 붙이는 층(AppShell) — 메뉴 · 목차 · 바로가기는 `data-guide` 만 달면 된다.
 *  - 마우스가 있는 기기에서만(휴대폰은 올릴 수 없다 — 사용법 안내 화면에서 본다).
 *  - 0.45초 머물러야 뜬다(지나가는 마우스에 깜빡이지 않게) · 누르면 닫히고 그 칸을 떠날 때까지 다시 뜨지 않는다 · Esc · 스크롤 · 화면 이동에 닫힌다.
 *  - 카드는 누를 수 없다(pointer-events: none) — 아래 화면을 가리거나 누름을 가로채지 않는다. 본문 밖(body)에 그려 메뉴 글에 섞이지 않는다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlayCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { GUIDE_LABELS, menuGuide } from '../../content/menuGuide'
import { menuVideo } from '../../config/menuVideos'
import { useCustomerAudience } from '../../config/customerAudience'
import { guideTitle } from './guideTitle'

interface Shown {
  key: string
  label: string
  rect: { top: number; left: number; right: number; bottom: number }
  /** 왼쪽 메뉴 줄이면 옆에, 그 밖(목차 · 바로가기)은 아래에 — 옆 칸을 가리지 않게 */
  side: boolean
}

const DELAY_MS = 450
const CARD_W = 320

export function GuideLayer() {
  const [shown, setShown] = useState<Shown | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const basic = useCustomerAudience()
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (!window.matchMedia('(hover: hover)').matches) return
    let timer = 0
    let current: Element | null = null
    // 누른 칸은 떠날 때까지 다시 띄우지 않는다(누른 뒤 화면이 바뀌어도 마우스는 그 자리에 있다)
    let muted: Element | null = null
    const hide = () => {
      window.clearTimeout(timer)
      current = null
      setShown(null)
    }
    const arm = (el: Element) => {
      if (el === current || el === muted) return
      window.clearTimeout(timer)
      current = el
      setShown(null)
      timer = window.setTimeout(() => {
        if (current !== el || !el.isConnected) return
        const key = el.getAttribute('data-guide') ?? ''
        if (!key) return
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        setShown({ key, label: el.getAttribute('data-guide-label') || guideTitle(key), rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom }, side: !!el.closest('aside') })
      }, DELAY_MS)
    }
    const guideOf = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-guide]') : null)
    const over = (e: MouseEvent) => {
      const el = guideOf(e.target)
      if (!el) {
        if (current) hide()
        muted = null
        return
      }
      if (muted && el !== muted) muted = null
      arm(el)
    }
    const focusIn = (e: FocusEvent) => {
      const el = guideOf(e.target)
      // 마우스로 눌러 생긴 초점에는 띄우지 않는다(키보드로 옮겼을 때만)
      if (el && e.target instanceof Element && e.target.matches(':focus-visible')) arm(el)
    }
    const down = (e: MouseEvent) => {
      muted = guideOf(e.target)
      hide()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    const leave = () => {
      muted = null
      hide()
    }
    document.addEventListener('mouseover', over)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('mousedown', down, true)
    document.addEventListener('keydown', key)
    document.addEventListener('mouseleave', leave)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mouseover', over)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('mousedown', down, true)
      document.removeEventListener('keydown', key)
      document.removeEventListener('mouseleave', leave)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // 화면이 바뀌면 닫는다
  useEffect(() => {
    setShown(null)
  }, [location.pathname, location.search])

  // 자리 — 오른쪽에 자리가 있으면 옆(메뉴), 없으면 아래(목차), 아래도 모자라면 위. 화면 밖으로 나가지 않게 당긴다
  useLayoutEffect(() => {
    if (!shown) {
      setPos(null)
      return
    }
    const el = card.current
    if (!el) return
    const h = el.offsetHeight
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const r = shown.rect
    let left: number
    let top: number
    if (shown.side && vw - r.right >= CARD_W + 20) {
      left = r.right + 10
      top = r.top - 6
    } else {
      left = r.left
      top = vh - r.bottom >= h + 16 || r.top < h + 16 ? r.bottom + 8 : r.top - h - 8
    }
    left = Math.max(8, Math.min(left, vw - CARD_W - 8))
    top = Math.max(8, Math.min(top, vh - h - 8))
    setPos({ top, left })
  }, [shown])

  if (!shown || typeof document === 'undefined') return null
  const g = menuGuide(shown.key, { label: shown.label, basic })
  const video = menuVideo(shown.key)
  return createPortal(
    <div
      ref={card}
      role="tooltip"
      data-testid="menu-guide-card"
      data-key={shown.key}
      className="no-print pointer-events-none fixed z-[70] flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3.5 shadow-lg"
      style={{ width: CARD_W, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <p className="t-card font-bold break-keep text-slate-900">{shown.label}</p>
      <dl className="flex flex-col gap-1.5">
        {(['what', 'why', 'effect', 'next'] as const).map((k) => (
          <div key={k} className="flex flex-col">
            <dt className="t-meta font-bold text-brand-700">{GUIDE_LABELS[k]}</dt>
            <dd className="t-sub break-keep text-slate-800">{g[k]}</dd>
          </div>
        ))}
      </dl>
      {/* 영상 자리는 메뉴마다 — 화면 안 기능(fn-…) 카드는 글만(D-569) */}
      {!shown.key.startsWith('fn-') && (
        <p className="t-meta flex items-center gap-1.5 border-t border-slate-100 pt-2 text-slate-600">
          <PlayCircle aria-hidden="true" className="size-4 shrink-0" />
          {video ? '사용법 영상이 있어요 — 메뉴의 [사용법 안내]에서 보기' : '사용법 영상 준비 중 — 메뉴의 [사용법 안내]에 모여요'}
        </p>
      )}
    </div>,
    document.body,
  )
}
