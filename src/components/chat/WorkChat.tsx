/**
 * D-250 대화창 — 대표 "LLM 채팅창처럼 앞에서 보이는 건 최대한 간편하게 · 처음 써 보는 사람도 바로 이해 · 사용 방법은 자세히".
 *
 *   맨 위: 화면 이름 · [사용 방법] · [자세히](예전 전체 화면) · 회사 고르기
 *   처음: '무엇을 도와드릴까요?' · 질문창 · 큰 단추 4개
 *   대화: 내가 한 말 → 답 카드(짧은 글 · 바로 가기 단추 · 복사 · [AI로 더 자세히]) · 질문창은 아래에 붙어 따라온다
 *
 * 답: 단추 → 규칙 답(바로 · 비용 0). 직접 쓴 말 → 대표는 AI(/api/ai-assist · 이 회사 기록 요약만), 팀장 · AI 연결 전에는 규칙 답.
 * 대화는 모듈 · 회사마다 이 브라우저에 20개까지 남는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Copy, LayoutList, Loader2, MessageCircle, Paperclip, RotateCcw, SendHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/primitives'
import { useToast } from '../ui/toastContext'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { assistOn, useAiAssistAccess } from '../../auth/ownerAiAccess'
import { callAssist } from '../../services/aiAssist/client'
import { readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../ai/ModelPicker'
import type { AssistPage } from '../../services/aiAssist/presets'
import type { AssistContext } from '../../services/aiAssist/context'
import { copyText } from '../../services/grants/grantView'
import { toneClass, type FeatureTone } from '../../config/featureVisual'
import { HISTORY_MAX, answerFromAi, answerText, historyKey, parseHistory, type ChatActKind, type ChatAnswer, type ChatGuideStep, type ChatModule, type ChatStarter, type ChatTurn } from '../../services/workChat/chatTypes'

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

const TONE_EDGE: Record<ChatAnswer['tone'], string> = { ok: 'border-l-success-500', warn: 'border-l-warning-500', info: 'border-l-brand-500' }

function AnswerCard({ a, owner, aiReady, onAct, onAsk, onAiMore, onCopy }: { a: ChatAnswer; owner: boolean; aiReady: boolean; onAct: (k: ChatActKind) => void; onAsk: (text: string) => void; onAiMore: () => void; onCopy: (text: string, what: string) => void }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-(--radius-panel) border border-l-4 border-slate-200 bg-white px-3.5 py-3 shadow-(--shadow-card) ${TONE_EDGE[a.tone]}`} data-testid="chat-answer" data-source={a.source} data-topic={a.topic ?? ''}>
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
          ) : x.act ? (
            <Button key={x.id} size="sm" variant={x.primary ? 'primary' : 'secondary'} onClick={() => onAct(x.act!)} data-testid="chat-action" data-id={x.id}>
              {x.act === 'file' && <Paperclip aria-hidden="true" className="size-4" />}
              {x.label}
            </Button>
          ) : null,
        )}
        {owner && aiReady && a.source === 'rule' && a.topic !== 'help' && (
          <Button size="sm" variant="ghost" className="text-violet-700" onClick={onAiMore} data-testid="chat-ai-more">
            <Sparkles aria-hidden="true" className="size-4" /> AI로 더 자세히
          </Button>
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
  const aiReady = assistOn(access)
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadTurns(p.module, p.clientId))
  const [text, setText] = useState('')
  const [guide, setGuide] = useState(false)
  const [busy, setBusy] = useState(false)
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const fileRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLSelectElement>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const keyRef = useRef(`${p.module}|${p.clientId}`)

  // 회사를 바꾸면 그 회사 대화로
  useEffect(() => {
    keyRef.current = `${p.module}|${p.clientId}`
    setTurns(loadTurns(p.module, p.clientId))
  }, [p.module, p.clientId])

  const commit = useCallback(
    (fn: (cur: ChatTurn[]) => ChatTurn[], key = keyRef.current) => {
      // 답을 기다리는 사이 회사를 바꿨으면 그 회사 기록에만 넣는다
      if (key !== keyRef.current) {
        const [m, c] = key.split('|')
        saveTurns(m as ChatModule, c, fn(loadTurns(m as ChatModule, c)))
        return
      }
      setTurns((cur) => {
        const next = fn(cur).slice(-HISTORY_MAX)
        saveTurns(p.module, p.clientId, next)
        return next
      })
    },
    [p.module, p.clientId],
  )

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
    commit((cur) => [...cur, { id, at: new Date().toISOString(), q: shown, a: null, status: 'pending' }], key)
    setBusy(true)
    try {
      const run = await callAssist({ requestId: uid('ch'), assistId: p.assistId, page: p.page, choice: readChoice(), context: ctx, ask: q })
      const a = answerFromAi(run.structured, run.raw, run.model)
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

  const composer = (docked: boolean) => (
    <div className="flex flex-col gap-1.5" data-testid="chat-composer">
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-(--shadow-card) focus-within:border-brand-500">
        {p.onFile && (
          <Button variant="ghost" size="sm" className="shrink-0" aria-label="명세서 파일 올리기" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="chat-file">
            <Paperclip aria-hidden="true" className="size-5" />
          </Button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder={docked ? (clientMissing ? '먼저 회사를 고르세요' : '여기에 물어보세요') : clientMissing ? '먼저 위에서 회사를 골라 주세요' : p.placeholder}
          aria-label="질문"
          className="t-body max-h-40 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-2.5 leading-snug outline-none [field-sizing:content]"
          data-testid="chat-input"
        />
        <Button variant="primary" size="sm" className={`shrink-0 ${aiReady ? 'bg-violet-600 border-violet-600 hover:bg-violet-700 hover:border-violet-700' : ''}`} onClick={send} disabled={!text.trim() || busy || !p.ready} aria-label={sendLabel} data-testid="chat-send" data-ai={aiReady ? '1' : '0'}>
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : aiReady ? <Sparkles aria-hidden="true" className="size-4" /> : <SendHorizontal aria-hidden="true" className="size-4" />}
          <span className="hidden sm:inline">{sendLabel}</span>
        </Button>
      </div>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-2 ${docked ? 'hidden lg:flex' : ''}`}>
        <p className="t-meta min-w-0 flex-1 basis-56 break-keep text-slate-500" data-testid="chat-mode">
          {aiReady ? '✨ AI 연결됨 — 쓴 질문은 AI가 이 회사 기록 요약을 보고 답해요(Enter)' : access === 'setup' ? 'AI 연결 준비 중 — 지금은 정해진 답으로 바로 알려 드려요' : '쓴 질문은 정해진 답으로 바로 알려 드려요(Enter)'}
        </p>
        {/* D-255 대화창도 고른 모델로(전에는 늘 기본 모델) — 여기서 바꿔도 모든 AI 단추가 같이 */}
        {aiReady && <ModelPicker popover testId="chat-model" />}
      </div>
    </div>
  )

  const starterButtons = (compact: boolean) => (
    <div className={compact ? '-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'} data-testid="chat-starters">
      {p.starters.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onStarter(s)}
          disabled={!p.ready || busy}
          className={
            compact
              ? 'tap t-sub inline-flex shrink-0 items-center gap-1.5 rounded-full border whitespace-nowrap border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50'
              : 'tap flex min-h-24 flex-col items-start justify-between gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-3 text-left shadow-(--shadow-card) hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50'
          }
          data-testid="chat-starter"
          data-id={s.id}
        >
          <span className={`grid shrink-0 place-items-center rounded-lg ${compact ? `size-5 bg-transparent ${s.tone ? toneClass(s.tone).icon : 'text-brand-700'}` : `size-10 ${s.tone ? toneClass(s.tone).tile : 'bg-brand-50 text-brand-700'}`}`} aria-hidden="true">
            {s.icon}
          </span>
          <span className={`${compact ? '' : 't-body'} font-semibold break-keep text-slate-900`}>{s.label}</span>
        </button>
      ))}
    </div>
  )

  const head = (
    <div className="flex flex-col gap-3" data-testid="chat-head">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h1 className="t-page min-w-0 break-keep text-slate-900">{p.title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setGuide(true)} data-testid="chat-guide-open">
            <BookOpen aria-hidden="true" className="size-4" /> 사용 방법
          </Button>
          <Link to={p.detailHref} className="tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100" data-testid="chat-detail">
            <LayoutList aria-hidden="true" className="size-4" /> 자세히
          </Link>
        </div>
      </div>
      <label className="flex min-w-0 items-center gap-2">
        <span className="t-sub shrink-0 font-semibold text-slate-600">회사</span>
        <select ref={pickRef} value={p.clientId} onChange={(e) => p.onClient(e.target.value)} className="tap t-body min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 sm:max-w-sm" data-testid="chat-client">
          <option value="">{p.needClient ? '회사 고르기' : '회사 고르지 않음(전체)'}</option>
          {p.clients && <ClientPickerOptions clients={p.clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber ?? '', corporateNumber: c.corporateNumber ?? '' }))} />}
        </select>
      </label>
    </div>
  )

  const lastId = useMemo(() => turns[turns.length - 1]?.id, [turns])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" data-testid={`chat-${p.module}`} data-turns={turns.length}>
      {head}
      {p.steps}
      {p.brief}
      {p.onFile && <input ref={fileRef} type="file" accept={p.fileAccept} className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="chat-file-input" />}

      {empty ? (
        <section className={`flex flex-col gap-4 ${p.brief ? 'py-2' : 'py-4 sm:py-10'}`} data-testid="chat-hero">
          <h2 className={`${p.brief ? 't-section' : 't-page'} text-center font-bold break-keep text-slate-900`}>{p.heroTitle ?? '무엇을 도와드릴까요?'}</h2>
          {composer(false)}
          {starterButtons(false)}
        </section>
      ) : (
        <>
          <ol className="flex flex-col gap-4" data-testid="chat-turns" aria-live="polite">
            {turns.map((t) => (
              <li key={t.id} ref={t.id === lastId ? endRef : undefined} className="flex scroll-mt-20 flex-col gap-2" data-testid="chat-turn" data-status={t.status}>
                <p className="t-body max-w-[85%] self-end rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 break-keep text-white [overflow-wrap:anywhere]" data-testid="chat-q">
                  {t.q}
                </p>
                {t.status === 'pending' && (
                  <p className="t-sub flex items-center gap-2 text-slate-500" role="status" data-testid="chat-pending">
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" /> AI가 답을 만드는 중…
                  </p>
                )}
                {t.error && <p className="t-sub break-keep text-warning-800" data-testid="chat-error">△ {t.error}</p>}
                {t.a && <AnswerCard a={t.a} owner={owner} aiReady={aiReady} onAct={onAct} onAsk={onAsk} onAiMore={() => void askAi(`${t.q} — 이 회사 기록으로 더 자세히 알려 줘`, `${t.q} (AI로 더 자세히)`)} onCopy={(x, w) => void onCopy(x, w)} />}
                {t.status === 'error' && !t.a && (
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => void askAi(t.q)}>
                      <RotateCcw aria-hidden="true" className="size-4" /> 다시 묻기
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {/* 휴대폰: 아래 메뉴 바로 위에 붙고 화면 끝까지 덮는다(뒤 글이 비치지 않게) */}
          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 pt-2 pb-3 backdrop-blur sm:-mx-1 sm:rounded-2xl sm:border-0 sm:px-1 lg:bottom-3 lg:pb-1" data-testid="chat-dock">
            {starterButtons(true)}
            {composer(true)}
          </div>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={clear} data-testid="chat-clear">
              <Trash2 aria-hidden="true" className="size-4" /> 대화 지우기
            </Button>
          </div>
        </>
      )}

      {guide && (
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
      )}
    </div>
  )
}
