/**
 * D-250 대화창 — 대표 "LLM 채팅창처럼 앞에서 보이는 건 최대한 간편하게 · 처음 써 보는 사람도 바로 이해 · 사용 방법은 자세히".
 *
 * D-628 대화창은 오른쪽 판에(대표 2026-11-18 "가운데는 작업창, 오른쪽에서 요청") — 이 부품은 대화(회사 고르기 · 질문창 · 큰 단추 · 답)를
 *   오른쪽 판(휴대폰은 아래 판)으로 그려 보내고, 가운데에는 화면 문법의 머리 · 요약 · 지금 할 일만 남긴다(frame 을 준 화면).
 *   처음(대화 없음): 가벼운 시작 카드 — 제목 · 한 줄 · 큰 [대화 시작]. 누르면 질문칸(커서) · 큰 단추 4 · 이렇게 물어보세요.
 *   대화: 내가 한 말(파란 말풍선) → 답 카드(흰 판 · 바로 가기 단추 · 복사 · [AI로 더 자세히]) · 질문창은 판 맨 아래에 붙어 있다
 *
 * 답: 단추 → 규칙 답(바로 · 비용 0). 직접 쓴 말 → 대표는 AI(/api/ai-assist · 이 회사 기록 요약만), 팀장 · AI 연결 전에는 규칙 답.
 * 대화는 모듈 · 회사마다 이 브라우저에 20개까지 남는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, Copy, LayoutList, Loader2, MessageCircle, Paperclip, RotateCcw, SendHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { assistOn, useAiAssistAccess } from '../../auth/ownerAiAccess'
import { callAssist } from '../../services/aiAssist/client'
import { resumeOnce } from '../../services/aiAssist/resume'
import { readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../ai/ModelPicker'
import { ChatTextSize } from './ChatTextSize'
import type { AssistPage } from '../../services/aiAssist/presets'
import { ASK_MAX_CHAT, type AssistContext } from '../../services/aiAssist/context'
import { copyText } from '../../services/grants/grantView'
import { toneClass, type FeatureTone } from '../../config/featureVisual'
import type { HeroArt } from '../../config/heroArt'
import { PageHero } from '../ui/pageFrame'
import { ChatStartCard, PageChat } from './PageChat'
import { BotRow, ChatNotice, CutLine, MeBubble, TypingBubble } from './bubbles'
import { chatDayKey, chatDayLine, chatTime } from '../../lib/chatTime'
import { startPageChat, usePageChat } from '../../lib/pageChat'
import { HISTORY_MAX, answerFromAi, answerText, historyKey, parseHistory, type ChatActKind, type ChatAnswer, type ChatGuideStep, type ChatModule, type ChatStarter, type ChatTurn } from '../../services/workChat/chatTypes'
import { AiConfirm } from '../ai/AiConfirm'

export interface WorkChatProps {
  module: ChatModule
  title: string
  placeholder: string
  /** D-282 tone — 큰 단추 아이콘 칸의 기능 색(없으면 테마색) */
  starters: readonly (ChatStarter & { icon: ReactNode; tone?: FeatureTone })[]
  clients: readonly { id: string; companyName: string; businessNumber?: string | null; corporateNumber?: string | null }[] | null
  clientId: string
  clientName: string
  /** 회사 없이는 답할 수 없는 화면(기업인증) */
  needClient: boolean
  onClient: (id: string) => void
  /** 기록을 다 읽었는지 — 아니면 단추 · 질문을 잠깐 막는다 */
  ready: boolean
  /** 단추(starter id) 또는 쓴 말 → 규칙 답 */
  ruleAnswer: (input: { starter?: string; text?: string }) => ChatAnswer
  /** 쓴 말에 맞는 작업 화면 단추(AI 답 아래에 붙인다) */
  actionsFor: (text: string) => ChatAnswer['actions']
  aiContext: (turns: readonly ChatTurn[]) => AssistContext
  assistId: string
  page: AssistPage
  onAct: (act: ChatActKind) => void
  /** 파일 올리기(특허 명세서 점검) — 없으면 클립 단추를 숨긴다 */
  onFile?: (file: File) => Promise<ChatAnswer>
  fileAccept?: string
  detailHref: string
  guide: readonly ChatGuideStep[]
  today: string
  /** PV-1 회사 고르기 바로 아래 — 이 회사 준비 현황 · 다음 할 일(규칙). 있으면 대화창은 그 아래 보조로 */
  brief?: ReactNode
  /** 대화창 큰 제목(없으면 '무엇을 도와드릴까요?') */
  heroTitle?: string
  /** D-282 회사 고르기 바로 아래 · 준비 현황 위 — 단계 표시(규칙 계산) */
  steps?: ReactNode
  /**
   * UXS-1 화면 문법(공통 다섯 칸) — 주면 가운데에 ① 머리(PageHero · 회사 고르기 · 자세히) ② summary ③ next ⑤ aside 를 그린다(D-628 대화 판은 오른쪽 판으로).
   * 없으면 가운데는 그리지 않는다(기업인증 — 가운데는 그 화면이 직접 그린다). 대화 · 답 · 저장은 같다.
   */
  frame?: { art: HeroArt; sub?: ReactNode; summary?: ReactNode; next?: ReactNode; aside?: ReactNode }
  /** D-552 큰 제목 아래 한 줄 — 이 화면이 무엇을 해 주는지 */
  heroSub?: ReactNode
  /** D-627 머리 한 줄에 다 못 담은 설명 — 마우스를 올리면(title) */
  heroHint?: string
  /** D-552 '이렇게 물어보세요' — 누르면 질문칸에 들어간다(바로 보내지 않음 · 업체 이름만 바꿔 보내게) */
  examples?: readonly string[]
  /** D-552 대화 판 아래(처음 · 대화 중 모두) — 직접 눌러서 하기 칸 */
  /** false 면 쓴 질문도 정해진 답으로(AI 단추 · 모델 고르기 없음) */
  aiOn?: boolean
  below?: ReactNode
  /** 머리 [자세히] 단추 글(없으면 '자세히') */
  detailLabel?: string
  /** D-628 대화가 속한 곳(같은 곳 안에서 화면을 옮겨도 판이 열린 채) — 없으면 module */
  scope?: string
  /** D-628 이미 오른쪽 판 안에서 그리는 중(모듈 대화창) — 가운데 칸 없이 대화만 */
  dockOnly?: boolean
  /** D-628 붙일 폭이 되면 저절로 열까(dockOnly 가 아닐 때 — 특허 · 벤처 · 기업인증) */
  auto?: boolean
  /** D-628 닫혀 있을 때 여는 단추(오른쪽 끝 [대화])를 보일까 — 기본 보임. false 면 이미 열린 판에만 그린다 */
  launcher?: boolean
}

const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

function loadTurns(module: ChatModule, clientId: string): ChatTurn[] {
  try {
    return parseHistory(localStorage.getItem(historyKey(module, clientId)))
  } catch {
    return []
  }
}

function saveTurns(module: ChatModule, clientId: string, turns: readonly ChatTurn[]) {
  try {
    localStorage.setItem(historyKey(module, clientId), JSON.stringify(turns.slice(-HISTORY_MAX)))
  } catch {
    /* 저장 공간이 가득 차도 대화는 화면에 남는다 */
  }
}

// D-483 한쪽만 칠하지 않는다 — 네 변을 옅은 같은 색으로
const TONE_EDGE: Record<ChatAnswer['tone'], string> = { ok: 'border-success-200', warn: 'border-warning-200', info: 'border-brand-200' }

function AnswerCard({ a, owner, aiReady, onAct, onAsk, onAiMore, onCopy }: { a: ChatAnswer; owner: boolean; aiReady: boolean; onAct: (k: ChatActKind) => void; onAsk: (text: string) => void; onAiMore: () => void; onCopy: (text: string, what: string) => void }) {
  return (
    <div className={`flex w-full min-w-0 flex-col gap-2 rounded-2xl rounded-tl-md border bg-white px-3.5 py-3 ${TONE_EDGE[a.tone]}`} data-testid="chat-answer" data-source={a.source} data-topic={a.topic ?? ''}>
      <p className="t-meta flex items-center gap-1 font-semibold text-slate-500">
        {a.source === 'ai' ? (
          <>
            <Sparkles aria-hidden="true" className="size-3.5 text-violet-600" /> AI 답{a.model ? ` · ${a.model}` : ''}
          </>
        ) : (
          '바로 답'
        )}
      </p>
      <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="chat-answer-title">
        {a.title}
      </p>
      {a.lines.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="chat-answer-lines">
          {a.lines.map((l, i) => (
            <li key={i} className="t-sub flex gap-1.5 break-keep text-slate-700 [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-slate-300" />
              <span className="min-w-0">{l}</span>
            </li>
          ))}
        </ul>
      )}
      {a.next && a.next.length > 0 && (
        <p className="t-sub break-keep text-slate-800" data-testid="chat-answer-next">
          <b className="font-semibold">다음</b> · {a.next.join(' · ')}
        </p>
      )}
      {a.caution && <p className="t-sub break-keep text-warning-800">△ {a.caution}</p>}
      {a.cut && <CutLine />}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {a.actions.map((x) =>
          x.href ? (
            <Link key={x.id} to={x.href} className={`tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-2 font-semibold ${x.primary ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`} data-testid="chat-action" data-id={x.id}>
              {x.label} {x.primary && <ArrowRight aria-hidden="true" className="size-4" />}
            </Link>
          ) : x.copy ? (
            <Button key={x.id} size="sm" variant={x.primary ? 'primary' : 'secondary'} onClick={() => onCopy(x.copy!, x.label.replace(/ 복사$/, ''))} data-testid="chat-action" data-id={x.id}>
              <Copy aria-hidden="true" className="size-4" /> {x.label}
            </Button>
          ) : x.ask ? (
            <button key={x.id} type="button" onClick={() => onAsk(x.ask!)} className="tap t-sub inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 font-semibold text-brand-800 hover:bg-brand-100" data-testid="chat-action" data-id={x.id}>
              <MessageCircle aria-hidden="true" className="size-4" /> {x.label}
            </button>
          ) : x.act === 'new-spec' ? (
            // D-289 새 명세서는 열자마자 AI 가 쓰기 시작(D-261) — 그래서 두 번 눌러야
            <AiConfirm key={x.id}>
              <Button size="sm" variant={x.primary ? 'primary' : 'secondary'} onClick={() => onAct(x.act!)} data-testid="chat-action" data-id={x.id}>
                {x.label}
              </Button>
            </AiConfirm>
          ) : x.act ? (
            <Button key={x.id} size="sm" variant={x.primary ? 'primary' : 'secondary'} onClick={() => onAct(x.act!)} data-testid="chat-action" data-id={x.id}>
              {x.act === 'file' && <Paperclip aria-hidden="true" className="size-4" />}
              {x.label}
            </Button>
          ) : null,
        )}
        {owner && aiReady && a.source === 'rule' && a.topic !== 'help' && (
          <AiConfirm><Button size="sm" variant="ghost" className="text-violet-700" onClick={onAiMore} data-testid="chat-ai-more">
            <Sparkles aria-hidden="true" className="size-4" /> AI로 더 자세히
          </Button></AiConfirm>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" aria-label="답 복사" onClick={() => onCopy(answerText(a), '답')} data-testid="chat-copy">
          <Copy aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function WorkChat(p: WorkChatProps) {
  const { showToast } = useToast()
  // D-257 팀장도 AI(Gemini 만)
  const access = useAiAssistAccess()
  const owner = access !== 'no'
  // D-552 화면마다 AI 를 끌 수 있다(팀장에게 닫힌 홈페이지 · 마케팅이 닫힌 홍보 글 — 서버가 403 하기 전에 정해진 답으로)
  const aiReady = assistOn(access) && p.aiOn !== false
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadTurns(p.module, p.clientId))
  const [text, setText] = useState('')
  const [guide, setGuide] = useState(false)
  /** D-627 '이렇게 물어보세요' 펼침 */
  const [exOpen, setExOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pickRef = useRef<HTMLSelectElement>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const keyRef = useRef(`${p.module}|${p.clientId}`)

  // 회사를 바꾸면 그 회사 대화로
  useEffect(() => {
    keyRef.current = `${p.module}|${p.clientId}`
    setTurns(loadTurns(p.module, p.clientId))
  }, [p.module, p.clientId])

  // D-638 화면을 떠난 뒤에 온 답도 버리지 않는다 — 예전엔 setTurns 안에서만 저장해 화면이 사라지면(다른 화면으로 감) 답이 저장되지 않았다
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const commit = useCallback(
    (fn: (cur: ChatTurn[]) => ChatTurn[], key = keyRef.current) => {
      // 답을 기다리는 사이 회사를 바꿨거나 화면을 떠났으면 그 회사 기록에만 넣는다
      if (key !== keyRef.current || !mountedRef.current) {
        const [m, c] = key.split('|')
        saveTurns(m as ChatModule, c, fn(loadTurns(m as ChatModule, c)).slice(-HISTORY_MAX))
        return
      }
      const next = fn(turnsRef.current).slice(-HISTORY_MAX)
      turnsRef.current = next
      saveTurns(p.module, p.clientId, next)
      setTurns(next)
    },
    [p.module, p.clientId],
  )

  // D-638 떠나 있던 사이에 온 답 받아 오기 — '받아 오는 중' 줄마다 그 요청 번호로 서버에 묻는다(AI 다시 안 부름)
  useEffect(() => {
    const key = `${p.module}|${p.clientId}`
    const waiting = loadTurns(p.module, p.clientId).filter((t) => t.resume && t.rid)
    if (!waiting.length) return
    void (async () => {
      for (const t of waiting) {
        const got = await resumeOnce(t.rid as string)
        if (got === 'pending') continue
        const a = got ? answerFromAi(got.structured, got.raw, got.servedModel || got.model, got.finish) : null
        if (a) a.actions = p.actionsFor(t.q)
        commit((cur) => cur.map((x) => (x.id !== t.id ? x : a ? { ...x, a, status: 'done', error: undefined, resume: undefined } : { ...x, resume: undefined, error: '화면을 떠나 답을 받지 못했어요 — 다시 물어봐 주세요' })), key)
      }
    })()
    // 회사 · 모듈이 바뀔 때만(답 단추 목록은 그 화면 것)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.module, p.clientId])

  // 새 질문이 생기거나 AI 답이 도착하면 그 질문을 화면 위쪽으로 — 아래 질문창에 답이 가리지 않게
  const lastKey = `${turns.length}:${turns[turns.length - 1]?.status ?? ''}`
  useEffect(() => {
    if (lastKey !== '0:') endRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [lastKey])

  const onCopy = async (t: string, what: string) => showToast((await copyText(t)) ? `${what} 복사했어요` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요')

  // PV-2 [AI로 더 자세히] · [다시 묻기] 를 연달아 눌러도 AI 는 한 번만(예전엔 누른 만큼 불렀다 — 매번 새 요청 번호라 서버도 못 걸렀다)
  const askingRef = useRef(false)
  const askAi = async (q: string, shown = q) => {
    if (askingRef.current) {
      showToast('AI가 앞 질문에 답하는 중이에요 — 끝나면 다시 눌러 주세요')
      return
    }
    askingRef.current = true
    const id = uid('t')
    const key = keyRef.current
    const ctx = p.aiContext(turnsRef.current)
    // D-638 요청 번호를 줄에 같이 적어 둔다 — 떠났다 와도 이 번호로 답을 받아 온다
    const rid = uid('ch')
    commit((cur) => [...cur, { id, at: new Date().toISOString(), q: shown, a: null, status: 'pending', rid }], key)
    setBusy(true)
    try {
      const run = await callAssist({ requestId: rid, assistId: p.assistId, page: p.page, choice: readChoice(), context: ctx, ask: q })
      const a = answerFromAi(run.structured, run.raw, run.servedModel || run.model, run.finish)
      a.actions = p.actionsFor(q)
      commit((cur) => cur.map((t) => (t.id === id ? { ...t, a, status: 'done' } : t)), key)
    } catch (e) {
      const why = e instanceof Error && e.message ? e.message : 'AI 연결을 확인해 주세요'
      const fallback = p.ruleAnswer({ text: q })
      commit((cur) => cur.map((t) => (t.id === id ? { ...t, a: fallback, status: 'error', error: `AI 답을 받지 못해 정해진 답을 보여 드려요 — ${why}` } : t)), key)
    } finally {
      askingRef.current = false
      setBusy(false)
    }
  }

  const ruleTurn = (q: string, a: ChatAnswer) => commit((cur) => [...cur, { id: uid('t'), at: new Date().toISOString(), q, a, status: 'done' }])

  const send = () => {
    const q = text.trim()
    if (!q || busy || !p.ready) return
    setText('')
    if (aiReady) void askAi(q)
    else ruleTurn(q, p.ruleAnswer({ text: q }))
  }

  /** 답 안 칩(이어 묻기) — 정해진 답으로 바로 */
  const onAsk = (q: string) => {
    if (!p.ready || busy) return
    ruleTurn(q, p.ruleAnswer({ text: q }))
  }

  const onStarter = (s: ChatStarter) => {
    if (!p.ready) return
    ruleTurn(s.ask, p.ruleAnswer({ starter: s.id }))
  }

  const onAct = (k: ChatActKind) => {
    if (k === 'file') fileRef.current?.click()
    else if (k === 'pick-client') {
      pickRef.current?.focus()
      pickRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else p.onAct(k)
  }

  const onFile = async (f: File | undefined) => {
    if (!f || !p.onFile) return
    setBusy(true)
    try {
      ruleTurn(`📎 ${f.name}`, await p.onFile(f))
    } catch {
      showToast('파일을 읽지 못했어요 — 특허로 서식(.hwpx) 또는 MD 파일인지 확인해 주세요')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clear = () => {
    const before = turnsRef.current
    const key = keyRef.current
    commit(() => [])
    showToast('대화를 지웠어요', { label: '되돌리기', onClick: () => commit(() => before, key) })
  }

  const empty = turns.length === 0
  const clientMissing = p.needClient && !p.clientId
  const sendLabel = aiReady ? 'AI에게 묻기' : '보내기'

  // D-628 처음(대화 없음)은 시작 카드 — [대화 시작] 을 누르거나 오른쪽 끝 [대화] 로 열었으면 바로 질문칸
  const scope = p.scope ?? p.module
  const pc = usePageChat()
  const started = !empty || pc.started.includes(scope)
  const focusNext = useRef(false)
  // [대화 시작] 을 눌렀거나, PC 에서 [대화] 로 방금 열었으면(대화 없음) 질문칸에 커서 — 휴대폰은 자판이 큰 단추를 가려서 두지 않는다
  const phoneNow = pc.mode === 'none'
  useEffect(() => {
    if (!started) return
    if (focusNext.current || (empty && !phoneNow)) {
      focusNext.current = false
      inputRef.current?.focus({ preventScroll: true })
    }
    // 시작했을 때 한 번만 본다(대화 수 · 폭이 바뀔 때마다 커서를 옮기지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])
  const onStart = () => {
    focusNext.current = true
    startPageChat(scope)
  }
  // 대화가 한 번 보였으면 그 뒤로는 시작 카드로 돌아가지 않는다(대화를 지우거나 다른 회사로 바꿔도 질문칸 그대로)
  useEffect(() => {
    if (!empty) startPageChat(scope)
  }, [empty, scope])

  const composer = (
    <div className="flex flex-col gap-1.5" data-testid="chat-composer">
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-(--shadow-card) focus-within:border-brand-500">
        {p.onFile && (
          <Button variant="ghost" size="sm" className="shrink-0" aria-label="명세서 파일 올리기" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="chat-file">
            <Paperclip aria-hidden="true" className="size-5" />
          </Button>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, ASK_MAX_CHAT))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder={clientMissing ? '먼저 회사를 고르세요' : empty ? p.placeholder : '여기에 물어보세요'}
          aria-label="질문"
          className="t-body max-h-40 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-2.5 leading-snug outline-none [field-sizing:content]"
          data-testid="chat-input"
        />
        <Button variant="primary" size="sm" className={`shrink-0 ${aiReady ? 'bg-violet-600 border-violet-600 hover:bg-violet-700 hover:border-violet-700' : ''}`} onClick={send} disabled={!text.trim() || busy || !p.ready} aria-label={sendLabel} title={sendLabel} data-testid="chat-send" data-ai={aiReady ? '1' : '0'}>
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : aiReady ? <Sparkles aria-hidden="true" className="size-4" /> : <SendHorizontal aria-hidden="true" className="size-4" />}
        </Button>
      </div>
      {/* 휴대폰에서 대화가 쌓인 뒤에는 이 줄을 접는다(아래 묶음이 화면을 많이 먹지 않게 — 모델은 처음 화면 · PC 판에서 고른다) */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-1 ${empty ? '' : 'max-lg:hidden'}`}>
        {/* D-627 글자 수 한도 — 한 줄은 짧게, 무엇이 어떻게 답하는지는 마우스를 올리면(title) */}
        <p
          className="t-meta min-w-0 flex-1 basis-24 break-keep text-slate-500"
          data-testid="chat-mode"
          title={aiReady ? '쓴 질문은 AI가 이 회사 기록 요약을 보고 답해요(Enter)' : access === 'setup' ? 'AI 연결 준비 중 — 지금은 정해진 답으로 바로 알려 드려요' : '쓴 질문은 정해진 답으로 바로 알려 드려요(Enter)'}
        >
          {aiReady ? '✨ AI 연결됨' : access === 'setup' ? 'AI 연결 준비 중' : '정해진 답으로 알려 드려요'}
        </p>
        {/* D-255 대화창도 고른 모델로(전에는 늘 기본 모델) — 여기서 바꿔도 모든 AI 단추가 같이 */}
        {aiReady && <ModelPicker popover testId="chat-model" />}
        {/* D-638 대화 글자 크기 — 모델 고르기 옆 */}
        <ChatTextSize testId="chat-size" />
      </div>
    </div>
  )

  const starterButtons = (compact: boolean) => (
    <div className={compact ? '-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'grid grid-cols-2 gap-2'} data-testid="chat-starters">
      {p.starters.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onStarter(s)}
          disabled={!p.ready || busy}
          className={
            compact
              ? 'tap t-sub inline-flex shrink-0 items-center gap-1.5 rounded-full border whitespace-nowrap border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50'
              : 'tap flex min-h-20 flex-col items-start justify-between gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-3 text-left hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50'
          }
          data-testid="chat-starter"
          data-id={s.id}
        >
          <span className={`grid shrink-0 place-items-center rounded-lg ${compact ? `size-5 bg-transparent ${s.tone ? toneClass(s.tone).icon : 'text-brand-700'}` : `size-9 ${s.tone ? toneClass(s.tone).tile : 'bg-brand-50 text-brand-700'}`}`} aria-hidden="true">
            {s.icon}
          </span>
          <span className={`${compact ? '' : 't-sub'} font-semibold break-keep text-slate-900`}>{s.label}</span>
        </button>
      ))}
    </div>
  )

  const options = (
    <>
      <option value="">{p.needClient ? '회사 고르기' : '회사 고르지 않음(전체)'}</option>
      {p.clients && <ClientPickerOptions clients={p.clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber ?? '', corporateNumber: c.corporateNumber ?? '' }))} />}
    </>
  )
  /** 대화창의 회사 고르기 · [사용 방법] — 판 맨 위 한 줄 */
  const dockHead = (
    <div className="flex shrink-0 items-center gap-1.5 px-3 pt-3" data-testid="chat-head">
      <label className="flex min-w-0 flex-1 items-center">
        <span className="sr-only">회사</span>
        <select ref={pickRef} value={p.clientId} onChange={(e) => p.onClient(e.target.value)} className="tap t-sub min-h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2" data-testid="chat-client">
          {options}
        </select>
      </label>
      {/* 휴대폰은 그림만(회사 칸을 넓게) — PC 오른쪽 판에서는 글도 */}
      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setGuide(true)} aria-label="사용 방법" title="사용 방법" data-testid="chat-guide-open">
        <BookOpen aria-hidden="true" className="size-4" /> <span className="max-lg:hidden">사용 방법</span>
      </Button>
    </div>
  )

  const lastId = useMemo(() => turns[turns.length - 1]?.id, [turns])
  const fileInput = p.onFile && <input ref={fileRef} type="file" accept={p.fileAccept} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="chat-file-input" />

  const hero = empty ? (
    <section className="flex flex-col gap-3" data-testid="chat-hero">
      <h2 className="t-body font-bold break-keep text-slate-900">{p.heroTitle ?? '무엇을 도와드릴까요?'}</h2>
      {starterButtons(false)}
      {p.examples && p.examples.length > 0 && (
        // D-552 '이렇게 물어보세요' — 누르면 질문칸에 들어간다(업체 이름만 바꿔 Enter)
        // D-627 글자 수 한도 — 처음엔 한 줄 단추. 누르면 예시 칩(그려 두고 숨긴다 — 접어도 예시 수는 그대로)
        <div className="flex flex-col gap-1.5" data-testid="chat-examples">
          <button
            type="button"
            onClick={() => setExOpen((v) => !v)}
            aria-expanded={exOpen}
            title="누르면 질문칸에 들어가요"
            className="tap t-sub inline-flex min-h-11 items-center gap-1 self-start rounded-(--radius-control) px-1 font-semibold text-slate-700 hover:bg-white"
            data-testid="chat-examples-open"
          >
            이렇게 물어보세요
            <ChevronDown aria-hidden="true" className={`size-4 text-slate-500 transition-transform ${exOpen ? 'rotate-180' : ''}`} />
          </button>
          <ul className={exOpen ? 'flex flex-wrap gap-2' : 'hidden'}>
            {p.examples.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  onClick={() => {
                    setText(ex)
                    inputRef.current?.focus()
                  }}
                  className="tap t-sub rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left break-keep text-slate-700 hover:border-brand-300 hover:bg-slate-50"
                  data-testid="chat-example"
                >
                  “{ex}”
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  ) : null
  const turnsList = !empty && (
    <ol className="chat-zoom flex flex-col gap-4" data-testid="chat-turns" aria-live="polite">
      {turns.map((t, i) => (
        <li key={t.id} ref={t.id === lastId ? endRef : undefined} className="flex scroll-mt-2 flex-col gap-2" data-testid="chat-turn" data-status={t.status}>
          {/* D-638 날짜 줄 — 앞 대화와 날이 다를 때(첫 대화는 오늘이 아닐 때) */}
          {t.at && chatDayKey(t.at) !== (i > 0 ? chatDayKey(turns[i - 1].at) : chatDayKey(new Date())) && <ChatNotice testId="chat-day">{chatDayLine(t.at)}</ChatNotice>}
          {/* D-634 카카오톡처럼 — 내 말은 오른쪽 말풍선 · 답은 왼쪽 프로필 아래 말풍선 */}
          <MeBubble testId="chat-q" time={chatTime(t.at)}>
            {t.q}
          </MeBubble>
          {t.status === 'pending' && <TypingBubble testId="chat-pending" note="AI가 답을 만드는 중…" />}
          {t.error && (
            <p className="t-sub pl-10 break-keep text-warning-800" data-testid="chat-error">
              △ {t.error}
            </p>
          )}
          {t.a && (
            <BotRow ai={t.a.source === 'ai'}>
              <AnswerCard a={t.a} owner={owner} aiReady={aiReady} onAct={onAct} onAsk={onAsk} onAiMore={() => void askAi(`${t.q} — 이 회사 기록으로 더 자세히 알려 줘`, `${t.q} (AI로 더 자세히)`)} onCopy={(x, w) => void onCopy(x, w)} />
            </BotRow>
          )}
          {t.status === 'error' && !t.a && (
            <div className="pl-10">
              <AiConfirm>
                <Button size="sm" variant="secondary" onClick={() => void askAi(t.q)} data-testid="chat-retry">
                  <RotateCcw aria-hidden="true" className="size-4" /> 다시 묻기
                </Button>
              </AiConfirm>
            </div>
          )}
        </li>
      ))}
    </ol>
  )
  const clearRow = !empty && (
    <div className="flex justify-center">
      <Button variant="ghost" size="sm" onClick={clear} data-testid="chat-clear">
        <Trash2 aria-hidden="true" className="size-4" /> 대화 지우기
      </Button>
    </div>
  )

  const guideSheet = guide && (
    <BottomSheet title="사용 방법" onClose={() => setGuide(false)}>
      <ol className="flex flex-col gap-3" data-testid="chat-guide">
        {p.guide.map((g, i) => (
          <li key={g.head} className="flex gap-3">
            <span className="t-sub grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 font-bold text-white" aria-hidden="true">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="t-body font-bold break-keep text-slate-900">{g.head}</p>
              <p className="t-sub break-keep whitespace-pre-line text-slate-700">{g.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </BottomSheet>
  )

  // D-628 대화 — 오른쪽 판(휴대폰은 아래 판) 안의 좁은 한 줄. 대화는 가운데에서 굴리고 질문창은 판 맨 아래에 붙는다
  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col" aria-label="대화창" data-testid={`chat-${p.module}`} data-variant="dock" data-turns={turns.length} data-started={started ? '1' : '0'}>
      {fileInput}
      {!started ? (
        <ChatStartCard title={p.heroTitle ?? '무엇을 도와드릴까요?'} sub={p.heroSub ?? '물어보면 바로 답해 드려요'} hint={p.heroHint} onStart={onStart} />
      ) : (
        <>
          {dockHead}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3" data-testid="chat-panel">
            {hero}
            {turnsList}
            {clearRow}
            {p.below}
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-3 pt-2 pb-3" data-testid="chat-dock">
            {!empty && starterButtons(true)}
            {composer}
          </div>
        </>
      )}
      {guideSheet}
    </div>
  )

  if (p.dockOnly) return conversation

  // UXS-1 가운데 = 작업 화면 — 머리(회사 고르기 · [자세히]) → 요약 → 지금 할 일 → 보조. 대화는 오른쪽 판으로 보낸다
  return (
    <>
      {p.frame && (
        <div className="flex flex-col gap-4 sm:gap-5" data-testid={`chat-${p.module}-page`}>
          <PageHero
            art={p.frame.art}
            title={p.title}
            sub={p.frame.sub}
            context={
              <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                <span className="t-sub sr-only shrink-0 font-semibold text-slate-600 sm:not-sr-only">회사</span>
                <select value={p.clientId} onChange={(e) => p.onClient(e.target.value)} className="tap t-body min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 sm:w-80 sm:max-w-sm sm:flex-none" data-testid="page-client">
                  {options}
                </select>
              </label>
            }
            actions={
              <Link to={p.detailHref} className="tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100" data-testid="chat-detail">
                <LayoutList aria-hidden="true" className="size-4" /> {p.detailLabel ?? '자세히'}
              </Link>
            }
            testId="page-head"
          />
          {p.frame.summary}
          {p.frame.next}
          {p.frame.aside && (
            <aside aria-label="도움 · 이어서 할 것" className="flex min-w-0 flex-col gap-3">
              {p.frame.aside}
            </aside>
          )}
        </div>
      )}
      <PageChat scope={scope} auto={p.auto !== false} launcher={p.launcher !== false}>
        {conversation}
      </PageChat>
    </>
  )
}
