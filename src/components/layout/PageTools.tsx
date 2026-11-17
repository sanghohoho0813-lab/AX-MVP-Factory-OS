/**
 * D-627 [⋯] 이 화면 도구 — 화면마다 흩어져 있던 보조 단추(AI 도우미와 그 질문 · 화면 꾸미기 · 대화로 묻기)를 경로 줄 오른쪽 한 곳에.
 *
 * 대표: "목차를 눌러 들어갔을 때 한 화면에 나오는 글자 수를 엄격하게 — 여러 번 누르더라도 하나하나 더 나오게. 토스처럼."
 * 보조 단추는 매 화면 같은 자리에 같은 모양(⋯ 하나)으로 — 화면 글자를 차지하지 않고, 누르면 그 화면의 도구가 다 나온다.
 *
 * 화면(페이지)은 <InPageTools> 로 감싼 것을 이 메뉴 안으로 보낸다(portal). 메뉴가 없는 곳(시험 · 창 안)에서는 그 자리에 그대로 그린다.
 * 메뉴 안의 어느 단추를 눌러도 메뉴는 닫힌다. 메뉴에 들어간 것이 없으면 [⋯] 도 없다.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

const SlotContext = createContext<{ slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void } | null>(null)
/** 지금 그리는 것이 [⋯] 메뉴 안인가 — 단추가 메뉴 줄 모양으로 바뀐다 */
const InMenuContext = createContext(false)

export function PageToolsProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>
}

/** 메뉴 안에서 그리는 중인가 */
export function useInPageTools(): boolean {
  return useContext(InMenuContext)
}

/** 이 화면에 [⋯] 메뉴가 있는가 — 같은 도구가 두 번 들어가지 않게(예: 업체 머리줄과 맞춤 추천 탭의 같은 AI 도우미) */
export function usePageToolsActive(): boolean {
  return !!useContext(SlotContext)?.slot
}

/**
 * 화면 쪽 — 이 안의 것을 [⋯] 메뉴로 보낸다. inline 이면(또는 메뉴가 없으면) 그 자리에 그대로.
 * order: 메뉴 안 순서(작을수록 위) — 같은 화면에 여럿일 때.
 */
export function InPageTools({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const ctx = useContext(SlotContext)
  if (inline || !ctx?.slot) return <>{children}</>
  return createPortal(<InMenuContext.Provider value>{children}</InMenuContext.Provider>, ctx.slot)
}

/** 메뉴 줄 모양(왼쪽 정렬 · 아이콘 + 글) — 메뉴 안 단추가 같이 쓴다 */
export const MENU_ROW = 'tap t-sub flex w-full min-h-11 items-center gap-2 rounded-(--radius-control) px-3 py-2 text-left font-semibold break-keep text-slate-800 hover:bg-slate-50'

/** 셸 쪽 — 경로 줄 오른쪽 [⋯] 와 그 판(늘 그려 두고 닫혀 있으면 숨김 — 화면이 보낸 것이 살아 있게) */
export function PageTools({ children }: { children?: ReactNode }) {
  const ctx = useContext(SlotContext)
  const [open, setOpen] = useState(false)
  const [has, setHas] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  // 메뉴 안 무엇을 눌러도 닫는다(그 단추의 일은 그대로 한다) — 화면이 보낸 것(portal)은 React 클릭이 이 판까지 오지 않아 DOM 으로 듣는다
  useEffect(() => {
    const el = menu.current
    if (!el) return
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      // 모델 고르기처럼 메뉴 안에서 한 번 더 고르는 것은 닫지 않는다(data-menu-keep)
      if (t.closest('button, a[href]') && !t.closest('[data-menu-keep]')) setOpen(false)
    }
    el.addEventListener('click', close)
    return () => el.removeEventListener('click', close)
  }, [])

  // 메뉴 안에 누를 것이 있는지 — 화면이 넣고 빼면 바로 따라간다
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const measure = () => setHas(!!el.querySelector('button, a[href]'))
    measure()
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className={`no-print relative shrink-0 ${has ? '' : 'hidden'}`} data-testid="page-tools-box">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="이 화면 도구"
        title="이 화면 도구 — AI 도우미 · 화면 꾸미기"
        className="tap inline-flex size-10 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        data-testid="page-tools"
        data-guide="fn-page-tools"
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>
      <div
        ref={menu}
        role="menu"
        hidden={!open}
        className="absolute top-full right-0 z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-(--radius-panel) border border-slate-200 bg-white p-1.5 shadow-(--shadow-card)"
        data-testid="page-tools-menu"
      >
        <div ref={list} className="flex flex-col gap-0.5">
          <InMenuContext.Provider value>{children}</InMenuContext.Provider>
          <div ref={ctx?.setSlot} className="flex flex-col gap-0.5" data-testid="page-tools-slot" />
        </div>
      </div>
    </div>
  )
}
