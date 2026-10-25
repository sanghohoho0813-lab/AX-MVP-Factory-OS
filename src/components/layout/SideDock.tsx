/**
 * D-258 OS 안 오른쪽 판 — 대표 "새 창 말고 안에서 띄우는 건 안 돼? GPT 뿐만 아니라 제미나이든 구글이든".
 *
 *   [AI 대화]  우리 서버(/api/ai-assist · side.chat)로 묻고 판 안에서 답을 본다 — 대표는 고른 모델, 팀장은 Gemini 만(D-257).
 *   [웹]       Google(igu=1) · 기업마당 · 홈택스처럼 막지 않는 곳은 판 안에. ChatGPT · Gemini · 네이버처럼 막는 곳은 [옆 창] 으로.
 *
 * 놓는 법(dockLayout): 본문이 768px 이상 남으면 옆에 붙이고(본문이 비킨다) · 좁으면 본문 위에 덮어 띄운다 · 1024 아래는 없음.
 * D-261 머리줄(시각 · 찾기 · 알림) 아래부터 — 머리줄은 그대로 다 보이고 본문 칸 안에만 뜬다.
 * 폭은 왼쪽 경계선을 끌어서(320~720) · 키보드 ←/→ · 두 번 누르면 처음 폭. 보기 무대(iframe) 안에서는 그리지 않는다.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowUpRight, Copy, Globe, Loader2, MessageCircle, RotateCcw, SendHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { inFrame } from '../../lib/deviceView'
import { navPx, useNavSize } from '../../lib/navWidth'
import { DOCK_MAX, DOCK_MIN, GOOGLE_FRAME_HOME, canFrame, closeDock, dockLayout, frameUrlOf, setDock, useDock, type DockTab, type DockTurn } from '../../lib/sideDock'
import { SIDE_SITES, addressLabel, addressToUrl, openInSide, useSideAi } from '../../lib/sideAi'
import { assistOn, useAiAssistAccess } from '../../auth/ownerAiAccess'
import { askDock, dockTurns, setDockTurns, syncDockChat, useDockChat } from '../../services/aiAssist/dockChat'
import { copyText } from '../../services/grants/grantView'
import { useToast } from '../ui/toastContext'
import { ModelPicker } from '../ai/ModelPicker'
import { AiConfirm } from '../ai/AiConfirm'

const DOCK_DEFAULT_W = 420
const STEP = 24

const STARTERS = ['고객에게 보낼 안부 문자 써 줘', '정책자금 신청 순서를 쉽게 정리해 줘', '이 문장을 더 쉽게 고쳐 줘: ', '고용지원금 종류를 한눈에 비교해 줘']

/** 판 안에 띄울 수 있는 바로 가기 · 막는 곳(옆 창) */
const FRAME_SITES = [{ id: 'google', label: 'Google', url: GOOGLE_FRAME_HOME }, ...SIDE_SITES.filter((s) => canFrame(s.url))]
const SIDE_ONLY = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/new' },
  ...SIDE_SITES.filter((s) => !canFrame(s.url)),
]

function useViewport(): number {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

function turnText(t: DockTurn): string {
  const out = [t.headline ?? '']
  for (const i of t.items ?? []) out.push(`\n■ ${i.title}${i.detail ? `\n${i.detail}` : ''}${i.body ? `\n${i.body}` : ''}`)
  if (t.next?.length) out.push(`\n다음: ${t.next.join(' · ')}`)
  if (t.caution) out.push(`\n확인: ${t.caution}`)
  return out.join('\n').trim()
}

/* ------------------------------------------------------------------ */
/* AI 대화                                                              */
/* ------------------------------------------------------------------ */

function ChatTab() {
  const access = useAiAssistAccess()
  const ready = assistOn(access)
  const { showToast } = useToast()
  const { turns, busy } = useDockChat()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => syncDockChat(), [])

  const lastKey = `${turns.length}:${turns[turns.length - 1]?.status ?? ''}`
  useEffect(() => {
    if (lastKey !== '0:') endRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [lastKey])

  // 답은 판 밖(dockChat)에서 받는다 — [웹] 으로 가거나 판을 닫아도 답이 오면 저장되고 돌아오면 보인다
  const ask = (q: string) => {
    if (!ready) return
    const screen = (document.querySelector('main h1')?.textContent ?? '').trim().slice(0, 60)
    void askDock(q, screen)
  }

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    const q = text
    setText('')
    ask(q)
  }

  const clear = () => {
    const before = dockTurns()
    setDockTurns([])
    showToast('대화를 지웠어요', { label: '되돌리기', onClick: () => setDockTurns(before) })
  }

  const copy = async (t: string) => showToast((await copyText(t)) ? '복사했어요' : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요')

  if (!ready) {
    return (
      <div className="flex flex-1 flex-col gap-2 p-4" data-testid="dock-chat-off">
        <p className="t-body font-semibold text-slate-900">이 계정에서는 AI 대화를 쓸 수 없어요</p>
        <p className="t-sub break-keep text-slate-600">{access === 'setup' ? 'AI 권한 설정이 아직 끝나지 않았어요 — 대표에게 알려 주세요.' : 'AI 는 대표 · 팀장 계정에서 열려 있어요. 위 [웹] 에서 Google 은 그대로 쓸 수 있어요.'}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <ModelPicker popover className="min-w-0 flex-1" testId="dock-model" />
        {turns.length > 0 && (
          <button type="button" onClick={clear} className="tap flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" aria-label="대화 지우기" title="대화 지우기" data-testid="dock-chat-clear">
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3" data-testid="dock-chat-list" aria-live="polite">
        {turns.length === 0 && (
          <li className="flex flex-col gap-2" data-testid="dock-chat-empty">
            <p className="t-body font-bold text-slate-900">무엇이든 물어보세요</p>
            <p className="t-sub break-keep text-slate-600">OS 화면을 보면서 옆에서 바로 묻는 AI 예요. 회사 기록은 보내지 않고, 적은 질문과 앞선 대화 몇 줄만 보냅니다.</p>
            <div className="flex flex-col gap-1.5 pt-1">
              {STARTERS.map((s) => (
                <AiConfirm><button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (s.endsWith(': ')) {
                      setText(s)
                      inputRef.current?.focus()
                    } else ask(s)
                  }}
                  className="tap t-sub flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50 px-3 text-left font-semibold text-violet-900 hover:bg-violet-100"
                  data-testid="dock-starter"
                >
                  <MessageCircle aria-hidden="true" className="size-4 shrink-0" /> <span className="min-w-0 break-keep">{s.replace(/: $/, ' …')}</span>
                </button></AiConfirm>
              ))}
            </div>
          </li>
        )}
        {turns.map((t, i) => (
          <li key={t.id} ref={i === turns.length - 1 ? endRef : undefined} className="flex min-w-0 flex-col gap-1.5" data-testid="dock-turn" data-status={t.status}>
            <p className="t-sub ml-6 self-end rounded-(--radius-control) bg-slate-100 px-3 py-2 break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]">{t.q}</p>
            {t.status === 'pending' && (
              <p className="t-sub flex items-center gap-1.5 text-slate-500" data-testid="dock-pending">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" /> 답을 쓰는 중…
              </p>
            )}
            {t.status === 'error' && (
              <div className="t-sub flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900" role="alert" data-testid="dock-error">
                <span className="min-w-0 flex-1 break-keep">{t.error}</span>
                <AiConfirm><button type="button" onClick={() => ask(t.q)} disabled={busy} className="tap inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) border border-amber-300 bg-white px-2.5 font-semibold disabled:opacity-50" data-testid="dock-retry">
                  <RotateCcw aria-hidden="true" className="size-4" /> 다시
                </button></AiConfirm>
              </div>
            )}
            {t.status === 'done' && (
              <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-panel) border border-l-4 border-slate-200 border-l-violet-500 bg-white px-3 py-2.5" data-testid="dock-answer">
                <p className="t-meta flex items-center gap-1 font-semibold text-slate-500">
                  <Sparkles aria-hidden="true" className="size-3.5 text-violet-600" /> AI 답{t.model ? ` · ${t.model}` : ''}
                </p>
                {t.headline && <p className="t-sub font-semibold break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]">{t.headline}</p>}
                {(t.items ?? []).map((it, k) => (
                  <div key={k} className="flex min-w-0 flex-col gap-0.5 border-t border-slate-100 pt-1.5">
                    <p className="t-sub font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{it.title}</p>
                    {it.detail && <p className="t-sub break-keep whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">{it.detail}</p>}
                    {it.body && (
                      <div className="relative">
                        <p className="t-sub rounded-(--radius-control) bg-slate-50 px-2.5 py-2 pr-10 break-keep whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]" data-testid="dock-body">
                          {it.body}
                        </p>
                        <button type="button" onClick={() => void copy(it.body ?? '')} className="tap absolute top-1 right-1 flex size-9 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-white" aria-label="이 글 복사">
                          <Copy aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {t.caution && <p className="t-sub break-keep text-warning-800">△ {t.caution}</p>}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {(t.next ?? []).slice(0, 3).map((n) => (
                    <AiConfirm keepLabel cancel={false}><button key={n} type="button" onClick={() => ask(n)} disabled={busy} className="tap t-meta min-h-9 rounded-full border border-violet-300 bg-violet-50 px-2.5 text-left font-semibold break-keep text-violet-900 hover:bg-violet-100 disabled:opacity-50" data-testid="dock-next">
                      {n}
                    </button></AiConfirm>
                  ))}
                  <button type="button" onClick={() => void copy(turnText(t))} className="tap ml-auto flex size-9 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" aria-label="답 복사" data-testid="dock-copy">
                    <Copy aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3" data-testid="dock-chat-form">
        <label htmlFor="dock-chat-input" className="sr-only">
          AI 에게 물어볼 것
        </label>
        <textarea
          id="dock-chat-input"
          ref={inputRef}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="물어볼 것을 적고 Enter (줄 바꿈은 Shift+Enter)"
          className="t-sub max-h-40 min-h-11 min-w-0 flex-1 resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2 text-slate-900"
          data-testid="dock-chat-input"
        />
        <button type="submit" disabled={busy || !text.trim()} className="tap inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" data-testid="dock-chat-send">
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <SendHorizontal aria-hidden="true" className="size-4" />}
          <span className="t-sub">묻기</span>
        </button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 웹 (판 안 iframe)                                                     */
/* ------------------------------------------------------------------ */

function WebTab({ url }: { url: string }) {
  const [addr, setAddr] = useState('')
  const [note, setNote] = useState<{ kind: 'side' | 'blocked'; label: string } | null>(null)

  const toSide = (target: string, label: string) => setNote({ kind: openInSide(target, label) ? 'side' : 'blocked', label })

  const go = (input: string, label?: string) => {
    const target = addressToUrl(input)
    if (!target) {
      setNote(null)
      setDock({ webUrl: GOOGLE_FRAME_HOME })
      return
    }
    const framed = frameUrlOf(target)
    if (framed && canFrame(framed)) {
      setNote(null)
      setDock({ webUrl: framed })
    } else toSide(target, label || addressLabel(target))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go(addr)
        }}
        className="flex flex-col gap-1.5 border-b border-slate-200 px-3 py-2"
        data-testid="dock-web-form"
      >
        <div className="flex gap-1.5">
          <label htmlFor="dock-web-address" className="sr-only">
            주소 · 검색어
          </label>
          <input
            id="dock-web-address"
            type="text"
            inputMode="url"
            enterKeyHint="go"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="검색어 · 주소 (비우면 Google)"
            className="t-sub min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-slate-900"
            data-testid="dock-web-address"
          />
          <button type="submit" className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) bg-slate-800 px-3 font-semibold text-white hover:bg-slate-900" data-testid="dock-web-go">
            <Globe aria-hidden="true" className="size-4" /> 열기
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="바로 가기">
          {FRAME_SITES.map((s) => (
            <button key={s.id} type="button" onClick={() => go(s.url, s.label)} className="tap t-meta min-h-9 rounded-full border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100" data-testid="dock-web-site" data-id={s.id}>
              {s.label}
            </button>
          ))}
          {SIDE_ONLY.map((s) => (
            <button key={s.id} type="button" onClick={() => toSide(s.url, s.label)} className="tap t-meta inline-flex min-h-9 items-center gap-0.5 rounded-full border border-dashed border-slate-300 bg-slate-50 px-2.5 font-semibold text-slate-600 hover:bg-slate-100" title={`${s.label} 은 다른 사이트 안에 못 들어가게 막아 두어 옆 창으로 엽니다`} data-testid="dock-web-side" data-id={s.id}>
              {s.label} <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </button>
          ))}
        </div>
        {note && (
          <p role="status" className={`t-meta break-keep rounded-(--radius-control) px-2.5 py-1.5 ${note.kind === 'side' ? 'bg-violet-50 text-violet-900' : 'bg-amber-50 text-amber-900'}`} data-testid="dock-web-note" data-kind={note.kind}>
            {note.kind === 'side' ? `${note.label} 는 사이트가 다른 화면 안에 들어가는 것을 막아 두어 오른쪽 옆 창으로 열었어요.` : '브라우저가 새 창을 막았어요 — 주소창 오른쪽 팝업 차단 아이콘에서 항상 허용을 고른 뒤 다시 눌러 주세요.'}
          </p>
        )}
      </form>
      <iframe
        key={url}
        src={url}
        title="오른쪽 판 웹"
        className="min-h-0 w-full flex-1 border-0 bg-white"
        // 판 안 사이트가 OS 화면을 바꾸지 못하게(top 이동 없음) · 새 창 링크는 새 창으로
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        data-testid="dock-web-frame"
      />
      <p className="t-meta border-t border-slate-200 px-3 py-1.5 break-keep text-slate-500">
        검색 결과에서 연 사이트가 하얗게 보이면 그 사이트가 막아 둔 곳이에요 —{' '}
        <button type="button" onClick={() => toSide(url, addressLabel(url))} className="font-semibold text-violet-800 underline underline-offset-2" data-testid="dock-web-to-side">
          옆 창으로 열기
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 판                                                                   */
/* ------------------------------------------------------------------ */

const TABS: { id: DockTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'chat', label: 'AI 대화', icon: Sparkles },
  { id: 'web', label: '웹 · Google', icon: Globe },
]

export function SideDock() {
  const dock = useDock()
  const nav = useNavSize()
  const vw = useViewport()
  // D-254 옆 창(팝업)이 오른쪽을 덮고 있으면 그 왼쪽에 붙인다
  const sideReserve = useSideAi().reserve
  const navW = navPx(nav) ?? (vw >= 1280 ? 288 : 256)
  const lay = dockLayout(vw - sideReserve, navW, dock.width)
  const shown = dock.open && lay.mode !== 'none' && !inFrame()
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; w: number; raf: number; next: number } | null>(null)
  const [webSeen, setWebSeen] = useState(dock.tab === 'web')
  if (dock.tab === 'web' && !webSeen) setWebSeen(true)

  // 본문이 판만큼 비키게(옆에 붙일 때만) — 바깥 부품은 CSS 변수만 읽는다
  // 맨 위로 단추 · 알림은 덮어 띄울 때도 판 왼쪽으로(--dock-float) — 판 밑에 숨지 않게
  const reserve = shown && lay.mode === 'dock' ? lay.width : 0
  const float = shown ? lay.width : 0
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--dock-w', `${reserve}px`)
    root.setProperty('--dock-float', `${float}px`)
    return () => {
      root.setProperty('--dock-w', '0px')
      root.setProperty('--dock-float', '0px')
    }
  }, [reserve, float])

  if (!shown) return null

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, w: lay.width, raf: 0, next: lay.width }
    setDragging(true)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    d.next = d.w + (d.x - e.clientX)
    if (!d.raf)
      d.raf = requestAnimationFrame(() => {
        if (drag.current) {
          drag.current.raf = 0
          setDock({ width: drag.current.next }, false)
        }
      })
  }
  const onUp = () => {
    const d = drag.current
    if (!d) return
    if (d.raf) cancelAnimationFrame(d.raf)
    drag.current = null
    setDragging(false)
    setDock({ width: d.next })
  }
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // 지금 보이는 폭에서 — 화면이 좁아 줄여 보이는 때도 누른 만큼 바로 움직이게
    if (e.key === 'ArrowLeft') setDock({ width: lay.width + STEP })
    else if (e.key === 'ArrowRight') setDock({ width: lay.width - STEP })
    else if (e.key === 'Home') setDock({ width: DOCK_MIN })
    else if (e.key === 'End') setDock({ width: DOCK_MAX })
    else if (e.key === 'Enter') setDock({ width: DOCK_DEFAULT_W })
    else return
    e.preventDefault()
  }

  return (
    <aside
      aria-label="오른쪽 판"
      className={`no-print fixed top-16 bottom-0 z-40 flex flex-col border-l border-slate-200 bg-white ${lay.mode === 'over' ? 'shadow-(--shadow-overlay)' : ''}`}
      style={{ width: lay.width, right: sideReserve }}
      data-testid="side-dock"
      data-mode={lay.mode}
      data-tab={dock.tab}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="오른쪽 판 폭 — 끌어서 넓히기 · 좁히기 (←/→ · 두 번 누르면 처음 폭)"
        aria-valuemin={DOCK_MIN}
        aria-valuemax={DOCK_MAX}
        aria-valuenow={lay.width}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => setDock({ width: DOCK_DEFAULT_W })}
        onKeyDown={onKey}
        className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none focus-visible:outline-none"
        data-testid="dock-resize"
      >
        <span aria-hidden="true" className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 ${dragging ? 'bg-violet-500' : 'bg-transparent group-hover:bg-violet-400 group-focus-visible:bg-violet-500'}`} />
      </div>
      {/* 끄는 동안 판 안 iframe 이 마우스를 먹지 않게 */}
      {dragging && <div aria-hidden="true" className="fixed inset-0 z-20 cursor-col-resize" />}
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-slate-200 px-2">
        <div role="tablist" aria-label="오른쪽 판" className="flex min-w-0 flex-1 gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const on = dock.tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setDock({ tab: t.id })}
                className={`tap t-sub inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-(--radius-control) px-3 font-semibold ${on ? 'bg-violet-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                data-testid="dock-tab"
                data-id={t.id}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" /> <span className="truncate">{t.label}</span>
              </button>
            )
          })}
        </div>
        <button type="button" onClick={closeDock} className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" aria-label="오른쪽 판 닫기" title="닫기" data-testid="dock-close">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      {dock.tab === 'chat' && <ChatTab />}
      {/* 웹은 한 번 연 뒤로는 숨기기만 — 대화로 갔다 와도 보던 쪽이 처음부터 다시 열리지 않게 */}
      {webSeen && (
        <div className={dock.tab === 'web' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <WebTab url={dock.webUrl} />
        </div>
      )}
    </aside>
  )
}
