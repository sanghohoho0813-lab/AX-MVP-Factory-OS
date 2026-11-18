/**
 * D-628 이 화면의 대화창을 오른쪽 판으로 — 대표: "가운데는 작업창, 오른쪽에서 요청(구글 Flow · 피그마처럼)".
 *
 *   <PageChat>          화면이 자기 대화창을 감싼다 → 오른쪽 판(휴대폰은 아래 판)의 자리로 그려 보낸다(portal · 화면 문맥 그대로).
 *                       한 번 보인 뒤에는 판을 닫아도 살아 있다(답을 기다리던 대화가 끊기지 않게).
 *   <ChatStartCard>     대화가 없을 때 — 짧은 제목 · 한 줄 · 큰 [대화 시작] 하나.
 *   <PageChatLauncher>  닫혀 있을 때 여는 단추 — PC 오른쪽 끝 세로 [대화] · 휴대폰 오른쪽 아래 둥근 [대화].
 *   <PageChatSheet>     휴대폰 — 아래에서 올라오는 판(같은 대화창 · 같은 바탕색).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigationType } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { useBackToClose } from '../../lib/backToClose'
import { useEscToClose } from '../../lib/escStack'
import { CHAT_TINT, basePageChat, closePageSheet, currentPageChat, launchPageChat, nextPageChatKey, registerPageChat, setPageChatSlot, startPageChat, usePageChat } from '../../lib/pageChat'


export function PageChat({
  scope,
  kind = 'chat',
  auto = false,
  launcher = true,
  keep = true,
  openPhone,
  entryKey,
  children,
}: {
  scope: string
  kind?: 'chat' | 'assist'
  auto?: boolean
  launcher?: boolean
  /** 한 번 보인 뒤 판을 닫아도 살려 둘까(기본) — 아니면 안 보일 때는 그리지 않는다 */
  keep?: boolean
  openPhone?: () => void
  /** 부른 쪽이 번호를 미리 가졌을 때(AI 도우미 — 단추가 그 번호로 판을 연다) */
  entryKey?: number
  children: ReactNode
}) {
  const keyRef = useRef(entryKey ?? 0)
  if (!keyRef.current) keyRef.current = nextPageChatKey()
  const key = keyRef.current
  const pc = usePageChat()
  const phoneRef = useRef(openPhone)
  phoneRef.current = openPhone
  const hasPhone = !!openPhone
  const host = useMemo(() => {
    const d = document.createElement('div')
    d.className = 'flex min-h-0 flex-1 flex-col'
    return d
  }, [])
  useEffect(() => {
    host.setAttribute('data-page-chat', scope)
  }, [host, scope])

  // 알리기(값이 바뀌면 고쳐 알림) · 화면을 떠날 때 한 번 뺀다
  const off = useRef<(() => void) | null>(null)
  useEffect(() => {
    off.current = registerPageChat({ key, scope, kind, auto, launcher, openPhone: hasPhone ? () => phoneRef.current?.() : undefined })
  }, [key, scope, kind, auto, launcher, hasPhone])
  useEffect(() => () => off.current?.(), [])

  const visible = !!pc.slot && currentPageChat(pc)?.key === key
  const [seen, setSeen] = useState(false)
  if (visible && !seen) setSeen(true)
  useLayoutEffect(() => {
    if (!visible || !pc.slot) return
    pc.slot.appendChild(host)
    return () => host.remove()
  }, [visible, pc.slot, host])

  if (!(keep ? seen : visible)) return null
  return createPortal(children, host)
}

/**
 * 대화 부품이 스스로 시작 카드를 그리지 않는 곳(마케팅 첫 화면의 한 줄 대화창)에 씌운다 —
 * [대화 시작] 을 누르기 전에는 카드, 누르면(또는 오른쪽 끝 [대화] 로 열었으면) 안의 것.
 */
export function ChatStartGate({ scope, title, sub, hint, children }: { scope: string; title?: string; sub?: ReactNode; hint?: string; children: ReactNode }) {
  const pc = usePageChat()
  if (!pc.started.includes(scope)) return <ChatStartCard title={title} sub={sub} hint={hint} onStart={() => startPageChat(scope)} />
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3" data-testid="chat-gate-body">
      {children}
    </div>
  )
}

/** 대화가 없을 때 — 가볍게: 제목 · 한 줄 · 큰 단추 하나(누르면 질문칸 · 큰 단추가 나온다) */
export function ChatStartCard({ title = '무엇을 도와드릴까요?', sub, hint, onStart, label = '대화 시작' }: { title?: string; sub?: ReactNode; hint?: string; onStart: () => void; label?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center p-4" data-testid="chat-start-card">
      <section className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-7 text-center" aria-label="대화 시작">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <MessageCircle className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="t-section font-bold break-keep text-slate-900">{title}</h2>
          {sub && (
            <p className="t-sub break-keep text-slate-600" title={hint} data-testid="chat-start-sub">
              {sub}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onStart}
          className="tap t-body inline-flex min-h-12 w-full max-w-64 items-center justify-center gap-2 rounded-(--radius-control) bg-brand-600 px-5 font-bold text-white hover:bg-brand-700"
          data-testid="chat-start"
          data-guide="fn-chat-start"
        >
          <MessageCircle aria-hidden="true" className="size-5" /> {label}
        </button>
      </section>
    </div>
  )
}

/**
 * 닫혀 있을 때 여는 단추 — 이 화면에 대화창이 있을 때만.
 * PC: 오른쪽 끝 가운데 세로 [대화](늘 그 자리) · 휴대폰: 아래 메뉴 위 오른쪽 둥근 [대화].
 */
export function PageChatLauncher() {
  const pc = usePageChat()
  const base = basePageChat(pc)
  const phone = pc.mode === 'none'
  const show = !!base?.launcher && (phone ? !pc.sheet : !pc.dockShown)
  // 휴대폰 — 맨 위로 단추가 이 단추 위로 올라가게(같은 자리에 겹치지 않게)
  const fab = show && phone
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--chat-fab', fab ? '3.5rem' : '0px')
    return () => root.setProperty('--chat-fab', '0px')
  }, [fab])
  if (!show) return null
  if (phone)
    return (
      <button
        type="button"
        onClick={launchPageChat}
        aria-label="대화 열기"
        title="이 화면 대화창 열기"
        className="no-print tap fixed right-4 bottom-[calc(4.35rem+env(safe-area-inset-bottom,0px))] z-30 flex size-13 flex-col items-center justify-center gap-0.5 rounded-full bg-brand-600 text-white shadow-(--shadow-overlay) hover:bg-brand-700"
        data-testid="page-chat-launch"
        data-where="phone"
        data-guide="fn-chat-launch"
      >
        <MessageCircle aria-hidden="true" className="size-5" />
        <span className="text-[0.6875rem] leading-none font-bold">대화</span>
      </button>
    )
  return (
    <button
      type="button"
      onClick={launchPageChat}
      aria-label="대화 열기"
      title="이 화면 대화창 열기"
      className="no-print tap fixed top-1/2 right-[calc(var(--side-reserve,0px)+0.375rem)] z-30 flex min-h-20 w-9 -translate-y-1/2 flex-col items-center justify-center gap-1.5 rounded-full border border-brand-300 bg-white py-3 text-brand-700 shadow-(--shadow-card) hover:border-brand-500 hover:bg-brand-50"
      data-testid="page-chat-launch"
      data-where="pc"
      data-guide="fn-chat-launch"
    >
      <MessageCircle aria-hidden="true" className="size-4.5" />
      <span className="t-sub leading-tight font-bold [writing-mode:vertical-rl]">대화</span>
    </button>
  )
}

/** 휴대폰 — 화면 높이 가득 올라오는 아래 판. 같은 대화창을 그대로 띄운다 */
export function PageChatSheet() {
  const pc = usePageChat()
  const open = pc.sheet && pc.mode === 'none' && !!basePageChat(pc)
  // 폭이 넓어져 판이 사라지면(가로로 돌림) 열림 표시도 내린다 — 다시 좁혀도 저절로 뜨지 않게
  useEffect(() => {
    if (pc.sheet && pc.mode !== 'none') closePageSheet()
  }, [pc.sheet, pc.mode])
  if (!open) return null
  return <SheetBody />
}

function SheetBody() {
  useBackToClose(true, closePageSheet)
  useEscToClose(true, closePageSheet)
  // 답 단추 · 직접 눌러서 하기로 다른 화면에 가면 판을 내린다(가운데 화면이 보이게).
  // 회사 고르기처럼 주소만 바꿔 끼우는 것(replace)은 그대로 둔다 — 대화를 이어 가는 중이다
  const loc = useLocation()
  const navType = useNavigationType()
  const openedAt = useRef(loc.key)
  useEffect(() => {
    if (loc.key !== openedAt.current && navType !== 'REPLACE') closePageSheet()
    else openedAt.current = loc.key
  }, [loc.key, navType])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="no-print ax-fade fixed inset-0 z-50 flex flex-col justify-end bg-navy-950/40" role="dialog" aria-modal="true" aria-label="대화" data-testid="page-chat-sheet">
      <div className={`ax-pop flex h-[calc(100dvh-2.5rem)] w-full flex-col overflow-hidden rounded-t-2xl ${CHAT_TINT}`}>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white pr-1 pl-4">
          <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
          <h2 className="t-body min-w-0 flex-1 font-bold text-slate-900">대화</h2>
          <button type="button" onClick={closePageSheet} aria-label="대화 닫기" className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" data-testid="page-chat-sheet-close">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div ref={setPageChatSlot} className="flex min-h-0 flex-1 flex-col" data-testid="page-chat-slot" />
      </div>
    </div>
  )
}
