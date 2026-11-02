/**
 * D-497 오늘 맨 위 대화창 — LLM 첫 화면처럼 질문 한 줄로 시작한다.
 *
 *   가운데 큰 글 '무엇을 도와드릴까요?' · 둥근 입력 줄([+] 업체 고르기 · 모델 고르기 · 말로 적기 · 보내기 ↑) · 지금 자료에 맞춘 질문 세 줄
 *   업체 이름과 함께 물으면 그 업체의 회사 · OS 모듈 판정 · 서류함 · 일정 · 받을 돈을 엮어 AI 도우미 서버 함수(/api/ai-assist)로 묻는다.
 *   AI 를 못 부르면(연결 없음 · 오류) 판정 그대로 '먼저 제안할 것 · 확인할 것 · 받아 올 서류' 를 규칙으로 정리해 같은 자리에 — AI 라고 부르지 않는다.
 *   답마다 👍 · 👎(까닭) — 다음 답의 말하기 규칙으로 쌓인다. 화면 꾸미기로 숨길 수 있다(칸 id 'ask').
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUp, Building2, CalendarClock, Check, ChevronRight, Copy, FileText, Lightbulb, ListChecks, Loader2, Mic, MicOff, Phone, Plus, ThumbsDown, ThumbsUp, Trash2, Wallet, X } from 'lucide-react'
import { ModelPicker } from '../ai/ModelPicker'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { useToast } from '../ui/toastContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { AssistBundle } from '../../services/aiAssist/context'
import { DOWN_REASONS, findClients, intentsOf, learnAliases, type HomeIntent, type HomeSuggestion, type RuleAnswer, type SuggestIcon } from '../../services/homeAsk/homeAsk'
import { addAliases, askHome, clearHomeTurns, homeAliases, rateTurn, restoreHomeTurns, syncHomeTurns, useHomeAsk, type HomeTurn } from '../../services/homeAsk/homeAskStore'

const ICON: Record<SuggestIcon, typeof CalendarClock> = { meeting: CalendarClock, docs: FileText, reco: Lightbulb, today: ListChecks, money: Wallet, call: Phone }

export interface HomeAskProps {
  clients: readonly ClientOpsRecord[]
  suggestions: readonly HomeSuggestion[]
  canAI: boolean
  prepare: (question: string, clientIds: string[], intents: HomeIntent[]) => Promise<{ bundle: AssistBundle; rule: RuleAnswer }>
}

/* 말로 적기 — 브라우저가 받아 적기를 지원할 때만 단추가 보인다(크롬 · 엣지 · 사파리) */
interface SpeechLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
function speechCtor(): (new () => SpeechLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function HomeAsk({ clients, suggestions, canAI, prepare }: HomeAskProps) {
  const { turns, busy } = useHomeAsk()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState<string>('')
  const [menu, setMenu] = useState(false)
  const [picking, setPicking] = useState(false)
  const [listening, setListening] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const rec = useRef<SpeechLike | null>(null)
  const Speech = useMemo(() => speechCtor(), [])
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const live = useMemo(() => clients.filter((c) => !c.archivedAt), [clients])

  useEffect(() => {
    syncHomeTurns()
  }, [])
  // 입력 칸 높이 — 한 줄에서 네 줄까지 늘어남
  useEffect(() => {
    const el = box.current
    if (!el) return
    // 비어 있으면 한 줄(긴 안내 글이 휴대폰에서 세 줄로 칸을 키우지 않게)
    el.style.height = 'auto'
    if (text) el.style.height = `${Math.min(140, el.scrollHeight)}px`
  }, [text])
  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])
  useEffect(() => () => rec.current?.stop(), [])

  const send = (raw: string, forceClient?: string) => {
    const q = raw.trim()
    if (!q || busy) return
    const found = findClients(q, clients, homeAliases())
    const extra = forceClient || pinned
    // 이름이 잡히지 않았는데 업체를 골라 두었으면 — 질문 속 그 업체 이름 조각을 별명으로 배운다
    if (extra && found.length === 0) {
      const c = byId.get(extra)
      if (c) addAliases(learnAliases(q, c.companyName), c.id)
    }
    const ids = [...new Set([...found, ...(extra ? [extra] : [])])].slice(0, 3)
    const intents = intentsOf(q)
    setText('')
    void askHome({ question: q, clientIds: ids, canAI, prepare: () => prepare(q, ids, intents) })
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 조합 중 Enter 는 글자 확정 — 보내지 않는다
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send(text)
    }
  }
  const toggleMic = () => {
    if (!Speech) return
    if (listening) {
      rec.current?.stop()
      return
    }
    const r = new Speech()
    r.lang = 'ko-KR'
    r.interimResults = false
    r.continuous = false
    const start = text
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim()
      if (said) setText(`${start}${start && !start.endsWith(' ') ? ' ' : ''}${said}`)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch {
      setListening(false)
    }
  }
  const clear = () => {
    const prev = clearHomeTurns()
    showToast('대화를 지웠습니다', { label: '되돌리기', onClick: () => restoreHomeTurns(prev) })
  }

  const pinnedName = pinned ? byId.get(pinned)?.companyName ?? '' : ''
  const shown = showOld ? turns : turns.slice(-2)

  return (
    <section aria-label="무엇이든 물어보기" data-testid="home-ask" className="rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-5 sm:px-8 sm:py-7">
      <h2 className="text-center text-[1.3rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.55rem]">무엇을 도와드릴까요?</h2>
      <p className="t-sub mt-1 text-center break-keep text-slate-500" data-testid="home-ask-guide">
        업체 이름과 함께 물어보면 그 업체 서류 · 모듈 판정까지 보고 답해요
      </p>

      <form onSubmit={onSubmit} className="relative mx-auto mt-4 flex w-full max-w-3xl items-end gap-1 rounded-[26px] border border-slate-300 bg-white py-1.5 pr-1.5 pl-1.5 shadow-sm focus-within:border-violet-400" data-testid="home-ask-form">
        <div ref={menuRef} className="relative shrink-0">
          <button type="button" aria-label="업체 고르기 · 서류로 새 업체" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="tap flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" data-testid="home-ask-plus">
            <Plus aria-hidden="true" className="size-5" />
          </button>
          {menu && (
            <div className="absolute bottom-12 left-0 z-40 w-64 rounded-(--radius-control) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)" data-testid="home-ask-menu">
              <button type="button" onClick={() => { setMenu(false); setPicking(true) }} className="tap t-body flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-slate-800 hover:bg-slate-50" data-testid="home-ask-pick-open">
                <Building2 aria-hidden="true" className="size-4 text-slate-500" /> 어느 업체 이야기인지 고르기
              </button>
              <button type="button" onClick={() => { setMenu(false); navigate('/ops/clients?new=1') }} className="tap t-body flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-slate-800 hover:bg-slate-50">
                <FileText aria-hidden="true" className="size-4 text-slate-500" /> 서류로 새 업체 등록
              </button>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {(pinnedName || picking) && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
              {picking ? (
                <select
                  autoFocus
                  value={pinned}
                  onChange={(e) => { setPinned(e.target.value); setPicking(false); box.current?.focus() }}
                  onBlur={() => setPicking(false)}
                  className="t-sub max-w-full rounded-full border border-slate-300 bg-white px-3 py-1"
                  data-testid="home-ask-pick"
                >
                  <option value="">업체 고르기</option>
                  <ClientPickerOptions clients={live.map((c) => ({ id: c.id, companyName: c.companyName }))} />
                </select>
              ) : (
                <span className="t-sub inline-flex max-w-full items-center gap-1 rounded-full border border-brand-200 bg-white py-0.5 pr-1 pl-2.5 font-semibold text-brand-700" data-testid="home-ask-pinned">
                  <span className="truncate">{pinnedName}</span>
                  <button type="button" aria-label="업체 빼기" onClick={() => setPinned('')} className="tap flex size-6 items-center justify-center rounded-full hover:bg-slate-100">
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}
          <textarea
            ref={box}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={pinnedName ? `${pinnedName} — 무엇이 궁금하세요?` : '예: ○○ 1차 미팅 — 무엇을 제안할까?'}
            aria-label="질문"
            className={`t-body min-h-10 w-full resize-none ${text ? 'overflow-y-auto' : 'overflow-hidden'} bg-transparent px-1.5 py-2 leading-snug text-slate-900 outline-none placeholder:text-slate-400`}
            data-testid="home-ask-input"
          />
        </div>
        <ModelPicker popover className="max-w-[11.5rem] shrink-0 max-sm:hidden" testId="home-ask-model" />
        {Speech && (
          <button type="button" aria-label={listening ? '받아 적기 멈추기' : '말로 적기'} aria-pressed={listening} onClick={toggleMic} className={`tap flex size-10 shrink-0 items-center justify-center rounded-full ${listening ? 'bg-danger-50 text-danger-700' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="home-ask-mic">
            {listening ? <MicOff aria-hidden="true" className="size-5" /> : <Mic aria-hidden="true" className="size-5" />}
          </button>
        )}
        <button type="submit" aria-label="보내기" disabled={busy || !text.trim()} className="tap flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400" data-testid="home-ask-send">
          {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ArrowUp aria-hidden="true" className="size-5" />}
        </button>
      </form>

      {turns.length === 0 ? (
        <ul className="mx-auto mt-3 flex w-full max-w-3xl flex-col" data-testid="home-ask-suggest">
          {suggestions.map((s) => {
            const Icon = ICON[s.icon]
            return (
              <li key={s.text}>
                <button type="button" onClick={() => send(s.text, s.clientId)} disabled={busy} className="tap t-body flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-left break-keep text-slate-700 hover:bg-slate-50" data-testid="home-ask-chip" data-icon={s.icon}>
                  <Icon aria-hidden="true" className="size-4.5 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1">{s.text}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-4" data-testid="home-ask-thread">
          <div className="flex items-center gap-2">
            {turns.length > 2 && (
              <button type="button" onClick={() => setShowOld((v) => !v)} className="tap t-sub font-semibold text-slate-500 hover:text-slate-800" data-testid="home-ask-older">
                {showOld ? '지난 대화 접기' : `지난 대화 ${turns.length - 2}개 보기`}
              </button>
            )}
            <button type="button" onClick={clear} className="tap t-sub ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800" data-testid="home-ask-clear">
              <Trash2 aria-hidden="true" className="size-4" /> 대화 지우기
            </button>
          </div>
          {shown.map((t) => (
            <Turn key={t.id} turn={t} names={t.clientIds.map((id) => ({ id, name: byId.get(id)?.companyName ?? '' })).filter((x) => x.name)} />
          ))}
        </div>
      )}
    </section>
  )
}

function Turn({ turn, names }: { turn: HomeTurn; names: { id: string; name: string }[] }) {
  const { showToast } = useToast()
  const [why, setWhy] = useState(false)
  const a = turn.answer
  const copy = async () => {
    if (!a) return
    const lines = [a.headline, ...a.items.flatMap((i) => [`- ${i.title}${i.amount ? ` (${i.amount})` : ''}`, ...(i.detail ? [`  ${i.detail}`] : []), ...(i.outline ?? []).map((o) => `  · ${o}`), ...(i.body ? [i.body] : [])]), ...(a.next?.length ? ['', '다음 할 일', ...a.next.map((n) => `- ${n}`)] : [])]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      showToast('답을 복사했습니다')
    } catch {
      showToast('복사하지 못했습니다')
    }
  }
  return (
    <article className="flex flex-col gap-2" data-testid="home-ask-turn" data-status={turn.status}>
      <p className="t-body max-w-[85%] self-end rounded-2xl bg-slate-100 px-3.5 py-2 break-keep whitespace-pre-wrap text-slate-900" data-testid="home-ask-q">
        {turn.q}
      </p>
      {names.length > 0 && (
        <p className="t-meta flex flex-wrap items-center gap-1 self-end text-slate-500" data-testid="home-ask-clients">
          이 업체 자료로:
          {names.map((n) => (
            <Link key={n.id} to={`/ops/clients/${encodeURIComponent(n.id)}?tab=smart`} className="tap font-semibold text-brand-700 hover:underline">
              {n.name}
            </Link>
          ))}
        </p>
      )}
      {turn.status === 'pending' ? (
        <p className="t-body inline-flex items-center gap-2 text-slate-500" data-testid="home-ask-pending">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" /> 자료를 모아 답을 쓰는 중…
        </p>
      ) : a ? (
        <div className="flex flex-col gap-2.5" data-testid="home-ask-answer">
          <p className="t-meta font-semibold" data-testid="home-ask-source">
            {turn.status === 'ai' ? (
              <span className="text-violet-700">AI 답{turn.model ? ` · ${turn.model}` : ''}</span>
            ) : (
              <span className="text-slate-500">
                자료로 바로 정리했어요(규칙){turn.why ? <span className="text-danger-700"> · AI 연결: {turn.why}</span> : ''}
              </span>
            )}
          </p>
          <p className="t-body font-semibold break-keep text-slate-900" data-testid="home-ask-headline">
            {a.headline}
          </p>
          {a.items.length > 0 && (
            <ol className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
              {a.items.map((it, i) => (
                <li key={i} className="flex flex-col gap-1 px-3.5 py-2.5" data-testid="home-ask-item">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="t-body font-semibold break-keep text-slate-900">{it.title}</span>
                    {it.amount && <span className="t-sub font-semibold text-brand-700 tabular-nums">{it.amount}</span>}
                    {it.ref && turn.links?.[it.ref] && (
                      <Link to={turn.links[it.ref]} className="tap t-sub ml-auto inline-flex items-center font-semibold text-brand-700 hover:underline" data-testid="home-ask-ref">
                        열기 <ChevronRight aria-hidden="true" className="size-4" />
                      </Link>
                    )}
                  </div>
                  {it.detail && <p className="t-sub break-keep text-slate-600">{it.detail}</p>}
                  {it.outline && it.outline.length > 0 && (
                    <ul className="t-sub flex list-disc flex-col gap-0.5 pl-5 text-slate-700">
                      {it.outline.map((o, k) => (
                        <li key={k} className="break-keep">{o}</li>
                      ))}
                    </ul>
                  )}
                  {it.body && <p className="t-body rounded-[8px] border border-slate-200 bg-white px-3 py-2 break-keep whitespace-pre-wrap text-slate-800">{it.body}</p>}
                </li>
              ))}
            </ol>
          )}
          {a.next && a.next.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="t-meta font-semibold text-slate-500">다음에 할 일</span>
              <ul className="t-sub flex flex-col gap-0.5 text-slate-700">
                {a.next.map((n, k) => (
                  <li key={k} className="flex gap-1.5 break-keep">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.caution && <p className="t-sub break-keep text-danger-700">{a.caution}</p>}
          <div className="flex flex-wrap items-center gap-1.5" data-testid="home-ask-rate">
            <IconBtn label="좋아요" on={turn.rated === 'up'} disabled={!!turn.rated} onClick={() => { rateTurn(turn.id, { up: true }); showToast('좋은 답으로 기억했어요 — 다음 답에 참고해요') }} testid="home-ask-up">
              <ThumbsUp aria-hidden="true" className="size-4" />
            </IconBtn>
            <IconBtn label="아쉬워요" on={turn.rated === 'down' || why} disabled={!!turn.rated} onClick={() => setWhy((v) => !v)} testid="home-ask-down">
              <ThumbsDown aria-hidden="true" className="size-4" />
            </IconBtn>
            <IconBtn label="답 복사" onClick={() => void copy()} testid="home-ask-copy">
              <Copy aria-hidden="true" className="size-4" />
            </IconBtn>
            {why && !turn.rated && (
              <span className="flex flex-wrap items-center gap-1" data-testid="home-ask-reasons">
                {DOWN_REASONS.map((r) => (
                  <button key={r.key} type="button" onClick={() => { rateTurn(turn.id, { up: false, reason: r.key }); setWhy(false); showToast('다음 답부터 고쳐서 답해요') }} className="tap t-meta rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50" data-testid="home-ask-reason" data-reason={r.key}>
                    {r.label}
                  </button>
                ))}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function IconBtn({ label, on = false, disabled = false, onClick, testid, children }: { label: string; on?: boolean; disabled?: boolean; onClick: () => void; testid: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={on} disabled={disabled && !on} onClick={onClick} className={`tap flex size-9 items-center justify-center rounded-full ${on ? 'text-brand-700' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-40`} data-testid={testid}>
      {children}
    </button>
  )
}
