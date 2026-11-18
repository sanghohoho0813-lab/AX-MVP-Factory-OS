/**
 * /ai/cases/:caseId/talk — 기획 대화(D-626 · 대표 전용).
 *
 * 한 번 눌러서 답이 안 나오는 일을 여기서 이어서 묻는다. 대표가 실제로 일하는 순서 그대로:
 *   ① 이어서 묻기 ↔ 리서치   ② 자체점검(반대 입장)   ③ 기획서 판으로 굳히기 → 개발 프롬프트
 * 화면 원칙 — 첫 화면은 질문칸 하나 + 순서 한 줄. 대화가 시작되면 대화 · 아래 질문칸, 굳힌 판은 옆 칸(휴대폰은 탭).
 * 대화 한 번 = 실행 한 줄(지워지지 않고 쌓임 · 사용량에 잡힘 · 다른 기기에서도). 보라색은 AI 단추만.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ClipboardCheck, ClipboardPaste, Copy, Download, Loader2, MessagesSquare, Plus, Sparkles } from 'lucide-react'
import { AiCallError } from '../../services/ownerAi/aiClient'
import { newUuid } from '../../services/ownerAi/caseUtil'
import { applyContext } from '../../services/ownerAi/memory'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import { BOARD_FIELDS, boardFieldLines, boardText, judgeVerdictLabel } from '../../services/ownerAi/render'
import { skillName } from '../../services/ownerAi/skillCatalog'
import { FIELD_LABEL, MODE_DEFAULT_ASK, MODE_HINT, MODE_LABEL, modeOfRun, newThreadId, nextStep, threadText, threadsOf, turnText, type TalkField, type TalkMode, type TalkThread } from '../../services/ownerAi/talk'
import { emptyContext, type AiRun, type CurrentContext } from '../../services/ownerAi/types'
import { evaluate, importTalk, latestSnapshot, loadBundle, saveContext, talkTurn, type CaseBundle } from '../../services/ownerAi/workflow'
import { todayLocalDate } from '../../lib/appClock'
import { useToast } from '../../components/ui/toastContext'
import { BottomSheet, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { PageHero } from '../../components/ui/pageFrame'
import { IconTile } from '../../components/ui/visual'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { MemoryEditor } from './parts/MemoryCard'
import { fmtShort } from './parts/runStatus'
import { skillIcon } from './skillVisual'
import { AiSetupBanner, Md, OwnerAiGate, copyToClipboard, useAiSetup, useFindClient, useOwnerAiIdentity, useOwnerAiRepo } from './shared'
import { downloadBlob, safeFileName } from './studioShared'
import { BotRow, MeBubble, TypingBubble } from '../../components/chat/bubbles'

export default function TalkPage() {
  const { caseId = '' } = useParams()
  return (
    <OwnerAiGate>
      <Talk key={caseId} caseId={caseId} />
    </OwnerAiGate>
  )
}

type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean)

const MODES: TalkMode[] = ['talk', 'research', 'judge', 'lock', 'prompt']
/** 모드 단추의 안내 열쇠(사용법 안내 · 마우스 안내 카드) */
const MODE_GUIDE: Record<TalkMode, string> = { talk: 'fn-talk-talk', research: 'fn-talk-research', judge: 'fn-talk-judge', lock: 'fn-talk-lock', prompt: 'fn-talk-prompt' }
const AI_BTN = 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700 hover:border-violet-700'
const BOX = 'rounded-(--radius-panel) border border-slate-200 bg-white'

const STARTERS: Record<TalkField, string[]> = {
  ax: ['이 회사 본업에서 돈이 가장 많이 새는 곳 하나부터 같이 좁혀 줘', '지금까지 채택한 방향을 개발로 넘길 만큼 구체화하자', '이 기획에서 이번에 만들지 말아야 할 것부터 정하자'],
  ip: ['이 회사가 이미 가진 기술 · 특허부터 정리하고 어느 갈래로 갈지 정하자', '핵심 주장 하나와 그것을 증명할 자료를 같이 정리하자', '벤처 확인까지 볼 때 지금 가장 약한 곳이 어디야'],
}

type Phase = { kind: 'loading' } | { kind: 'missing' } | { kind: 'db_setup' } | { kind: 'error'; message: string } | { kind: 'ready' }

function Talk({ caseId }: { caseId: string }) {
  const repo = useOwnerAiRepo()
  const { userId } = useOwnerAiIdentity()
  const findClient = useFindClient()
  const { setup } = useAiSetup()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [sp, setSp] = useSearchParams()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [bundle, setBundle] = useState<CaseBundle | null>(null)
  const [mode, setMode] = useState<TalkMode>('talk')
  const [text, setText] = useState('')
  const [field, setField] = useState<TalkField>('ax')
  /** 답을 기다리는 물음(화면에 먼저 보인다) */
  const [pending, setPending] = useState<{ thread: string; mode: TalkMode; ask: string } | null>(null)
  const [failed, setFailed] = useState<{ thread: string; mode: TalkMode; ask: string; message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [pane, setPane] = useState<'chat' | 'board'>('chat')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [memoryApply, setMemoryApply] = useState<{ run: AiRun; proposed: CurrentContext } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      const b = await loadBundle(repo, caseId, findClient)
      if (!b) return setPhase({ kind: 'missing' })
      setBundle(b)
      setPhase({ kind: 'ready' })
    } catch (e) {
      setPhase(e instanceof OwnerAiSetupError ? { kind: 'db_setup' } : { kind: 'error', message: e instanceof Error ? e.message : '불러오지 못했습니다.' })
    }
  }, [repo, caseId, findClient])
  useEffect(() => {
    void load()
  }, [load])

  const threads = useMemo(() => threadsOf(bundle?.runs ?? []), [bundle])
  // 주소의 ?t= 가 고른 대화 — 'new' 면 새 대화, 없으면 가장 최근 대화(대화가 하나도 없으면 새 대화)
  const tParam = sp.get('t') ?? ''
  const [draftId, setDraftId] = useState(() => newThreadId())
  const active: TalkThread | null = tParam === 'new' ? null : (threads.find((t) => t.id === tParam) ?? (tParam ? null : (threads[0] ?? null)))
  const activeId = active?.id ?? draftId
  const activeField = active?.field ?? field
  const pick = (id: string) => {
    setSp((p) => {
      const n = new URLSearchParams(p)
      n.set('t', id)
      return n
    }, { replace: true })
    setFailed(null)
    setPane('chat')
  }
  const startNew = () => {
    setDraftId(newThreadId())
    pick('new')
    setMode('talk')
    setText('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const turns = active?.turns ?? []
  const lastId = turns[turns.length - 1]?.id
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [lastId, pending])

  const currentContext = useMemo(() => (bundle ? (latestSnapshot(bundle)?.content ?? emptyContext()) : emptyContext()), [bundle])
  const step = useMemo(() => nextStep(active), [active])

  if (phase.kind === 'loading') return <p className="t-sub text-slate-500" role="status">기획 대화를 여는 중…</p>
  if (phase.kind === 'missing')
    return (
      <Surface>
        <p className="t-body text-slate-700">이 업체 작업실을 찾지 못했습니다.</p>
        <Link to="/ai" className="t-body tap mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700">AI 전략실 목록으로</Link>
      </Surface>
    )
  if (phase.kind === 'db_setup')
    return (
      <Surface>
        <p className="t-body font-semibold text-slate-900" data-testid="owner-ai-db-setup">AI 전략실을 쓰려면 관리자 설정이 한 번 필요합니다.</p>
      </Surface>
    )
  if (phase.kind === 'error' || !bundle)
    return (
      <Surface>
        <p className="t-body text-danger-700" role="alert">{phase.kind === 'error' ? phase.message : '불러오지 못했습니다.'}</p>
        <Button className="mt-2" onClick={() => void load()}>다시 불러오기</Button>
      </Surface>
    )

  const b = bundle
  const aiReady = setup.state === 'ready'
  const busy = !!pending
  const needText = mode === 'talk' || mode === 'research'
  const canSend = aiReady && !busy && (!needText || !!text.trim()) && (mode !== 'prompt' || !!active?.board)

  const send = async (m: TalkMode, askText: string) => {
    if (busy || !aiReady) return
    const ask = askText.trim() || MODE_DEFAULT_ASK[m]
    if (!ask) return
    const threadId = activeId
    const requestId = newUuid()
    setPending({ thread: threadId, mode: m, ask })
    setFailed(null)
    setText('')
    try {
      const { run, c, replayed } = await talkTurn({ repo, bundle: b, thread: active, threadId, field: activeField, mode: m, ask, requestId, today, userId })
      setBundle((prev) => (prev ? { ...prev, c, runs: [run, ...prev.runs.filter((r) => r.id !== run.id)] } : prev))
      if (!active) pick(threadId)
      if (m === 'lock' || m === 'prompt') setPane('board')
      setMode('talk')
      if (replayed) showToast('같은 요청이라 앞서 받은 답을 그대로 보여 드립니다.')
      else if (run.status === 'parse_fallback') showToast('답의 형식이 달라 원문 그대로 보관했습니다.')
    } catch (e) {
      const quiet = ['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'rate_limited'].includes(e instanceof AiCallError ? e.code : '')
      const message = e instanceof AiCallError ? (e.retryAfter ? `${e.message} (${e.retryAfter}초 뒤)` : `${e.message}${quiet ? '' : ` · 문의 번호 ${requestId.slice(-6)}`}`) : e instanceof Error ? e.message : '답을 받지 못했습니다.'
      setFailed({ thread: threadId, mode: m, ask, message })
      setText(askText)
    } finally {
      setPending(null)
    }
  }

  const guard = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (saving) return null
    setSaving(true)
    try {
      return await fn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '저장하지 못했습니다. 다시 시도해 주세요.')
      return null
    } finally {
      setSaving(false)
    }
  }

  /** 채택 → 기억에 넣을 칸을 보여 주고 확인받는다(다른 작업이 이 판을 이어받는다) */
  const adopt = async (run: AiRun) => {
    const r = await guard(() => evaluate(repo, b, run, 'adopted', '', null, currentContext))
    if (!r) return
    setBundle((prev) => (prev ? { ...prev, c: r.c, runs: prev.runs.map((x) => (x.id === run.id ? r.run : x)) } : prev))
    if (Object.keys(r.proposal).length) setMemoryApply({ run: r.run, proposed: applyContext(currentContext, r.proposal) })
    else showToast(`${skillName(run.skillId)} — 채택했습니다. 다른 작업이 이 결과를 이어받습니다.`)
  }

  const copy = async (t: string, what: string) => showToast((await copyToClipboard(t)) ? `${what} 복사했습니다.` : '복사하지 못했습니다 — 글을 직접 골라 복사해 주세요.')
  const board = active?.board ?? null
  const boardData = board ? obj(b.latestRevision.get(board.id)?.content ?? board.structured) : null
  const prompt = active?.prompt ?? null
  const promptData = prompt ? obj(prompt.structured) : null
  const empty = turns.length === 0 && !pending

  const composer = (
    <div className="flex flex-col gap-2" data-testid="talk-composer">
      {step && !busy && (
        <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600" data-testid="talk-next">
          <span className="font-semibold text-slate-800">다음</span>
          <button type="button" className="tap t-sub rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50" onClick={() => setMode(step.mode)} data-testid="talk-next-go">
            {step.label}
          </button>
          <span className="min-w-0 break-keep">{step.why}</span>
        </p>
      )}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="무엇을 할까요" data-testid="talk-modes">
        {MODES.map((m) => {
          const Icon = skillIcon(m === 'talk' ? 'PLAN_TALK' : m === 'research' ? 'PLAN_RESEARCH' : m === 'judge' ? 'PLAN_JUDGE' : m === 'lock' ? 'PLAN_LOCK' : 'DEV_PROMPT')
          const on = mode === m
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={on}
              title={MODE_HINT[m]}
              onClick={() => setMode(m)}
              className={`tap t-sub inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${on ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
              data-testid={`talk-mode-${m}`}
              data-guide={MODE_GUIDE[m]}
            >
              <Icon aria-hidden="true" className="size-4" /> {MODE_LABEL[m]}
            </button>
          )
        })}
      </div>
      <div className={`flex items-end gap-2 p-2 ${BOX} focus-within:border-brand-500`}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) void send(mode, text)
            }
          }}
          rows={text.split('\n').length > 2 || text.length > 120 ? 4 : 2}
          maxLength={6000}
          placeholder={mode === 'talk' ? '이어서 물어보세요 — 앞에서 한 말을 이어받아요 (Enter 로 보내기 · Shift+Enter 줄바꿈)' : mode === 'research' ? '무엇을 찾아볼까요? 예: 같은 업종에서 이 방식으로 성과를 낸 사례' : mode === 'judge' ? '따로 짚을 곳이 있으면 적어 주세요(비워도 돼요)' : mode === 'lock' ? '판에 꼭 넣을 말이 있으면 적어 주세요(비워도 돼요)' : '프롬프트에 꼭 넣을 말이 있으면 적어 주세요(비워도 돼요)'}
          className="t-body min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-slate-900 outline-none placeholder:text-slate-400"
          aria-label="기획 대화 질문칸"
          data-testid="talk-input"
        />
        <Button variant="primary" size="sm" className={`shrink-0 ${AI_BTN}`} onClick={() => void send(mode, text)} disabled={!canSend} data-testid="talk-send" data-mode={mode}>
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
          <span>{mode === 'talk' ? '보내기' : MODE_LABEL[mode]}</span>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <p className="t-meta min-w-0 flex-1 basis-56 break-keep text-slate-500" data-testid="talk-hint">
          {mode === 'prompt' && !board ? '개발 프롬프트는 기획서 판을 먼저 굳힌 뒤에 뽑을 수 있어요.' : `${MODE_LABEL[mode]} — ${MODE_HINT[mode]}`}
        </p>
        {aiReady && <ModelPicker popover testId="talk-model" />}
      </div>
    </div>
  )

  const hero = (
    <section className="flex flex-col gap-4 py-2 sm:py-6" data-testid="talk-hero">
      <div className="flex flex-col gap-1">
        <h2 className="t-page font-bold break-keep text-slate-900">무엇을 기획할까요?</h2>
        <p className="t-sub break-keep text-slate-600">한 번에 답이 안 나오는 일은 여기서 이어서 묻습니다. 주고받은 말은 이 업체에 쌓이고, 다음 물음이 그대로 이어받아요.</p>
      </div>
      <ol className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700" data-testid="talk-steps">
        <li><b className="text-slate-900">1</b> 이어서 묻기 · 리서치</li>
        <li aria-hidden="true" className="text-slate-400">→</li>
        <li><b className="text-slate-900">2</b> 자체점검(반대 입장에서 따지기)</li>
        <li aria-hidden="true" className="text-slate-400">→</li>
        <li><b className="text-slate-900">3</b> 기획서 판 → 개발 프롬프트</li>
      </ol>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="무엇을 기획하나요" data-testid="talk-field">
        {(['ax', 'ip'] as TalkField[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={field === f} onClick={() => setField(f)} className={`tap t-sub rounded-full border px-3 py-1.5 font-semibold ${field === f ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} data-testid={`talk-field-${f}`}>
            {FIELD_LABEL[f]}
          </button>
        ))}
      </div>
      {composer}
      <div className="flex flex-col gap-1.5" data-testid="talk-starters">
        <p className="t-sub font-semibold text-slate-700">
          이렇게 시작해 보세요 <span className="font-normal text-slate-500">— 누르면 질문칸에 들어가요</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {STARTERS[field].map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => {
                  setMode('talk')
                  setText(ex)
                  inputRef.current?.focus()
                }}
                className="tap t-sub rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left break-keep text-slate-700 hover:border-brand-300 hover:bg-slate-50"
                data-testid="talk-starter"
              >
                “{ex}”
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )

  const chat = (
    <div className="flex min-w-0 flex-col gap-4">
      <ol className="flex flex-col gap-4" data-testid="talk-turns" aria-live="polite">
        {turns.map((r) => (
          <li key={r.id} className="flex scroll-mt-20 flex-col gap-2" data-testid="talk-turn" data-mode={modeOfRun(r)} data-status={r.status}>
            {/* D-634 카카오톡처럼 — 내 말은 오른쪽 · AI 답은 왼쪽 프로필 아래 */}
            <MeBubble testId="talk-q">{str(r.input?.task) || MODE_DEFAULT_ASK[modeOfRun(r)]}</MeBubble>
            <BotRow name="AI 기획 파트너">
              <TurnCard run={r} board={board} onCopy={copy} onAsk={(q) => { setMode('talk'); setText(q); inputRef.current?.focus() }} onAdopt={adopt} onShowBoard={() => setPane('board')} saving={saving} />
            </BotRow>
          </li>
        ))}
        {pending && pending.thread === activeId && (
          <li className="flex flex-col gap-2" data-testid="talk-pending">
            <MeBubble>{pending.ask}</MeBubble>
            <TypingBubble name="AI 기획 파트너" note={`${MODE_LABEL[pending.mode]} — AI가 앞 대화를 이어받아 답을 만드는 중…${pending.mode === 'judge' || pending.mode === 'lock' || pending.mode === 'prompt' ? ' (깊게 보는 일이라 1분쯤 걸려요)' : ''}`} />
          </li>
        )}
        {failed && failed.thread === activeId && (
          <li className="flex flex-col gap-2" data-testid="talk-failed">
            <p className="t-sub pl-10 break-keep text-warning-800" role="alert">△ {failed.message}</p>
            <div className="pl-10">
              <Button size="sm" variant="secondary" onClick={() => void send(failed.mode, failed.ask)} disabled={busy || !aiReady} data-testid="talk-retry">다시 보내기</Button>
            </div>
          </li>
        )}
      </ol>
      <div ref={endRef} />
    </div>
  )

  const boardPane = (
    <div className="flex min-w-0 flex-col gap-4" data-testid="talk-board-pane">
      {!board && (
        <div className={`${BOX} p-4`} data-testid="talk-board-empty">
          <p className="t-body font-semibold text-slate-900">아직 굳힌 판이 없어요</p>
          <p className="t-sub mt-1 break-keep text-slate-600">몇 번 주고받은 뒤 [기획서 판] 을 누르면, 정해진 것만 한 판으로 모입니다. 정하지 않은 칸은 지어내지 않고 ‘미정’ 으로 남아요.</p>
        </div>
      )}
      {board && boardData && (
        <section className={`${BOX} flex flex-col gap-3 p-4`} aria-label="지금 기획서 판" data-testid="talk-board">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="t-meta text-slate-500" data-testid="talk-board-version">
                기획서 판 {active?.boardVersion ?? 1}번째 · {fmtShort(board.createdAt)}
                {board.evaluation === 'adopted' ? ' · 채택함' : ''}
              </p>
              <h3 className="t-section font-bold break-keep text-slate-900" data-testid="talk-board-title">{str(boardData.title) || '기획서 판'}</h3>
              {str(boardData.ready) && <p className="t-sub mt-0.5 break-keep text-slate-700">개발로 넘기기: {str(boardData.ready)}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => void copy(boardText(boardData), '기획서 판을')} data-testid="talk-board-copy">
                <Copy aria-hidden="true" className="size-4" /> 복사
              </Button>
              {board.evaluation !== 'adopted' && (
                <Button size="sm" variant="secondary" onClick={() => void adopt(board)} disabled={saving} data-testid="talk-board-adopt" data-guide="fn-talk-adopt">
                  <ClipboardCheck aria-hidden="true" className="size-4" /> 이 판 채택
                </Button>
              )}
            </div>
          </div>
          {strs(boardData.open).length > 0 && (
            <div data-testid="talk-board-open">
              <p className="t-sub font-semibold text-warning-800">아직 미정 {strs(boardData.open).length}개</p>
              <ul className="t-sub mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
                {strs(boardData.open).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          <dl className="flex flex-col divide-y divide-slate-100">
            {BOARD_FIELDS.map((f) => {
              const rows = boardFieldLines(f.kind, boardData[f.key])
              if (!rows.length) return null
              return (
                <div key={f.key} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3" data-testid="talk-board-field" data-key={f.key}>
                  <dt className="t-sub w-40 shrink-0 font-semibold text-slate-600">{f.label}</dt>
                  <dd className="t-body min-w-0 flex-1 break-keep text-slate-900 [overflow-wrap:anywhere]">
                    {rows.length === 1 ? rows[0] : (
                      <ul className="flex list-disc flex-col gap-0.5 pl-5">
                        {rows.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
          {strs(boardData.changed).length > 0 && (
            <details className="t-sub text-slate-600">
              <summary className="tap cursor-pointer font-semibold">지난 판에서 바뀐 것 {strs(boardData.changed).length}개</summary>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep">
                {strs(boardData.changed).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {prompt && promptData && (
        <section className={`${BOX} flex flex-col gap-3 p-4`} aria-label="개발 프롬프트" data-testid="talk-prompt">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="t-meta text-slate-500">개발 프롬프트 · {fmtShort(prompt.createdAt)}</p>
              <h3 className="t-section font-bold text-slate-900 [overflow-wrap:anywhere]" data-testid="talk-prompt-repo">{str(promptData.repoName) || '(저장소 이름 없음)'}</h3>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => void copy(str(promptData.prompt), '프롬프트를')} data-testid="talk-prompt-copy">
                <Copy aria-hidden="true" className="size-4" /> 프롬프트 복사
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void copy(str(promptData.firstMessage), '첫 메시지를')} data-testid="talk-prompt-first-copy">
                <Copy aria-hidden="true" className="size-4" /> 첫 메시지 복사
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([`${str(promptData.prompt)}\n`], { type: 'text/markdown;charset=utf-8' }), `${safeFileName(str(promptData.repoName) || b.c.companyName)}_프롬프트.md`)} data-testid="talk-prompt-download">
                <Download aria-hidden="true" className="size-4" /> 파일로
              </Button>
            </div>
          </div>
          {strs(promptData.missing).length > 0 && (
            <div data-testid="talk-prompt-missing">
              <p className="t-sub font-semibold text-warning-800">아직 비어 있는 것</p>
              <ul className="t-sub mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
                {strs(promptData.missing).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="t-sub font-semibold text-slate-600">개발 AI 창에 처음 붙여 넣을 말</p>
            <p className="t-body mt-1 break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]" data-testid="talk-prompt-first">{str(promptData.firstMessage)}</p>
          </div>
          {strs(promptData.checks).length > 0 && (
            <div>
              <p className="t-sub font-semibold text-slate-600">보내기 전 확인</p>
              <ul className="t-sub mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
                {strs(promptData.checks).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="t-sub text-slate-700">
            <summary className="tap cursor-pointer font-semibold">프롬프트 전체 보기({str(promptData.prompt).length.toLocaleString()}자)</summary>
            <pre className="t-sub mt-2 max-h-[28rem] overflow-auto rounded-(--radius-control) border border-slate-200 bg-white p-3 break-keep whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]" data-testid="talk-prompt-body">{str(promptData.prompt)}</pre>
          </details>
          {strs(promptData.assets).length > 0 && (
            <details className="t-sub text-slate-700">
              <summary className="tap cursor-pointer font-semibold">먼저 만들어 둘 그림 {strs(promptData.assets).length}개</summary>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep">
                {strs(promptData.assets).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-testid="talk-page" data-thread={active?.id ?? 'new'} data-turns={turns.length}>
      <PageHero
        art="ai"
        title="기획 대화"
        titleTestId="talk-title"
        icon={<IconTile icon={MessagesSquare} tone="purple" size="lg" />}
        back={
          <Link to={`/ai/cases/${b.c.id}`} className="t-sub tap inline-flex min-h-11 items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900 sm:min-h-0" data-testid="talk-back">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {b.c.companyName} 작업실
          </Link>
        }
        sub={active ? `${FIELD_LABEL[active.field]} · 대화 ${turns.length}번${active.boardVersion ? ` · 기획서 판 ${active.boardVersion}번째` : ''}` : '한 번에 답이 안 나오는 일을 이어서 묻는 곳 — 주고받은 말이 이 업체에 쌓여요'}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setPasteOpen(true)} data-testid="talk-import" data-guide="fn-talk-import">
              <ClipboardPaste aria-hidden="true" className="size-4" /> 다른 AI 대화 가져오기
            </Button>
            {active && (
              <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([`${threadText(active, b.c.companyName)}\n`], { type: 'text/markdown;charset=utf-8' }), `${safeFileName(`${b.c.companyName}_${active.title}`)}.md`)} data-testid="talk-download">
                <Download aria-hidden="true" className="size-4" /> 대화 내려받기
              </Button>
            )}
          </>
        }
      />
      <AiSetupBanner setup={setup} strip />

      {(threads.length > 0 || tParam === 'new') && (
        <nav className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" aria-label="대화 목록" data-testid="talk-threads">
          {threads.map((t) => {
            const on = active?.id === t.id
            return (
              <button key={t.id} type="button" onClick={() => pick(t.id)} aria-current={on ? 'true' : undefined} className={`tap t-sub inline-flex max-w-64 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-semibold ${on ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`} data-testid="talk-thread" data-id={t.id}>
                <span className="truncate">{t.title}</span>
                <span className="t-meta shrink-0 font-normal text-slate-500">{t.turns.length}</span>
              </button>
            )
          })}
          <button type="button" onClick={startNew} className={`tap t-sub inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-semibold ${!active ? 'border-brand-600 bg-white text-brand-700' : 'border-dashed border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`} data-testid="talk-new">
            <Plus aria-hidden="true" className="size-4" /> 새 대화
          </button>
        </nav>
      )}

      {empty ? (
        <section className={`${BOX} p-4 sm:p-5`} aria-label="대화창" data-testid="talk-panel">
          {hero}
        </section>
      ) : (
        <>
          {/* 휴대폰 — 대화 / 기획서 판을 탭으로(한 화면에 한 가지) */}
          <div className="flex gap-1.5 xl:hidden" role="tablist" aria-label="보기" data-testid="talk-panes">
            {(['chat', 'board'] as const).map((p) => (
              <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={`tap t-sub flex-1 rounded-(--radius-control) border px-3 py-2 font-semibold ${pane === p ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`} data-testid={`talk-pane-${p}`}>
                {p === 'chat' ? `대화 ${turns.length}` : `기획서 판${active?.boardVersion ? ` ${active.boardVersion}번째` : ''}${prompt ? ' · 프롬프트' : ''}`}
              </button>
            ))}
          </div>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
            <section className={`${BOX} min-w-0 flex-col gap-4 p-4 sm:p-5 ${pane === 'chat' ? 'flex' : 'hidden xl:flex'}`} aria-label="대화창" data-testid="talk-panel">
              {chat}
              <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-3 backdrop-blur sm:-mx-5 sm:px-5 lg:bottom-0" data-testid="talk-dock">
                {composer}
              </div>
            </section>
            <aside className={`min-w-0 ${pane === 'board' ? 'block' : 'hidden xl:block'}`} aria-label="기획서 판 · 개발 프롬프트">
              {boardPane}
            </aside>
          </div>
        </>
      )}

      {memoryApply && (
        <MemoryEditor
          title={`기억에 넣기 — ${skillName(memoryApply.run.skillId)}`}
          current={currentContext}
          proposed={memoryApply.proposed}
          busy={saving}
          note={`${skillName(memoryApply.run.skillId)} 채택(기획 대화)`}
          onClose={() => setMemoryApply(null)}
          onSave={async (content, note) => {
            const r = await guard(() => saveContext(repo, b, content, `run:${memoryApply.run.id}`, note))
            if (!r) return
            setBundle((prev) => (prev ? { ...prev, c: r.c, snapshots: [...prev.snapshots, r.snap] } : prev))
            setMemoryApply(null)
            showToast(`업체 기억 v${r.snap.version} 으로 저장했습니다 — 다른 작업이 이어받습니다.`)
          }}
        />
      )}
      {pasteOpen && (
        <ImportSheet
          busy={saving}
          onClose={() => setPasteOpen(false)}
          onSave={async (t) => {
            const threadId = activeId
            const r = await guard(() => importTalk(repo, b, threadId, activeField, t, userId, today))
            if (!r) return
            setBundle((prev) => (prev ? { ...prev, c: r.c, runs: [r.run, ...prev.runs] } : prev))
            if (!active) pick(threadId)
            setPasteOpen(false)
            showToast('가져온 대화를 이 대화에 이어 붙였습니다 — 다음 물음부터 같이 봅니다.')
          }}
        />
      )}
    </div>
  )
}

/** 다른 AI 창에서 하던 대화 붙여넣기 — OS 는 바깥 대화를 읽지 못한다(붙여 넣은 글만 남긴다) */
function ImportSheet({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const [v, setV] = useState('')
  return (
    <BottomSheet
      title="다른 AI 대화 가져오기"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={() => void onSave(v)} disabled={busy || v.trim().length < 20} data-testid="talk-import-save">이 대화에 이어 붙이기</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="t-sub break-keep text-slate-600">다른 AI 창에서 하던 대화를 통째로 복사해 붙여 넣으세요. 이 업체 자료로 남고, 다음 물음부터 같이 봅니다. 주민등록번호 · 비밀번호 · 키는 저장 전에 지웁니다.</p>
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={10} maxLength={30000} placeholder="여기에 붙여 넣기" className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white p-3 text-slate-900" aria-label="가져올 대화" data-testid="talk-import-text" />
        <p className="t-meta text-slate-500">{v.length.toLocaleString()} / 30,000자</p>
      </div>
    </BottomSheet>
  )
}

/** 답 한 번 — 모드마다 모양이 다르다(대화 · 리서치 · 자체점검 · 판 · 프롬프트) */
function TurnCard({ run, board, onCopy, onAsk, onAdopt, onShowBoard, saving }: { run: AiRun; board: AiRun | null; onCopy: (text: string, what: string) => Promise<void>; onAsk: (q: string) => void; onAdopt: (run: AiRun) => Promise<void>; onShowBoard: () => void; saving: boolean }) {
  const s = obj(run.structured)
  const mode = modeOfRun(run)
  const good = run.status === 'succeeded' && !!run.structured
  const next = strs(s.next).slice(0, 3)
  const keep = strs(s.keep)
  const chips = (title: string, tone: string, items: string[], testId: string) =>
    items.length > 0 && (
      <div data-testid={testId}>
        <p className={`t-sub font-semibold ${tone}`}>{title}</p>
        <ul className="t-sub mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    )
  let body: React.ReactNode
  if (run.status === 'pasted') {
    body = (
      <details className="t-sub text-slate-700" data-testid="talk-pasted">
        <summary className="tap cursor-pointer font-semibold">가져온 대화 {run.rendered.length.toLocaleString()}자 — 펼쳐 보기</summary>
        <p className="mt-2 max-h-80 overflow-auto break-keep whitespace-pre-wrap [overflow-wrap:anywhere]">{run.rendered}</p>
      </details>
    )
  } else if (!good) {
    body = <Md text={run.rendered || '(답 없음)'} className="t-body text-slate-900" />
  } else if (mode === 'talk') {
    body = (
      <>
        <p className="t-body break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]" data-testid="talk-answer">{str(s.answer)}</p>
        {chips('정해야 할 것', 'text-warning-800', strs(s.questions), 'talk-questions')}
        {chips('이번에 정해진 것', 'text-slate-800', keep, 'talk-keep')}
      </>
    )
  } else if (mode === 'research') {
    const findings = arr(s.findings).map(obj).filter((f) => str(f.claim))
    const sources = arr(s.sources).map(obj).filter((x) => /^https?:\/\//.test(str(x.url)))
    body = (
      <>
        {s.searched === false && <p className="t-sub break-keep text-warning-800" data-testid="talk-nosearch">△ 이 모델은 웹 검색을 못 해서 아는 범위로만 답했어요 — 검색이 되는 모델(Gemini · Claude)로 바꿔 다시 보내 보세요.</p>}
        <p className="t-body break-keep whitespace-pre-wrap text-slate-900 [overflow-wrap:anywhere]" data-testid="talk-answer">{str(s.answer)}</p>
        {findings.length > 0 && (
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="talk-findings">
            {findings.map((f, i) => (
              <li key={i} className="flex flex-col gap-0.5 py-2">
                <p className="t-body break-keep text-slate-900 [overflow-wrap:anywhere]">
                  <span className="t-meta mr-1.5 inline-flex items-center rounded-full border border-slate-300 px-1.5 font-semibold text-slate-700" data-testid="talk-grade">{str(f.grade) || '?'}</span>
                  {str(f.claim)}
                </p>
                <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{[str(f.kind), str(f.source)].filter(Boolean).join(' · ')}{str(f.note) ? ` → ${str(f.note)}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
        {chips('못 찾은 것', 'text-warning-800', strs(s.unknowns), 'talk-unknowns')}
        {sources.length > 0 && (
          <details className="t-sub text-slate-600" data-testid="talk-sources">
            <summary className="tap cursor-pointer font-semibold">검색 기록 {sources.length}곳</summary>
            <ul className="mt-1 flex flex-col gap-0.5">
              {sources.map((x, i) => (
                <li key={i} className="[overflow-wrap:anywhere]">
                  <a href={str(x.url)} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline">{str(x.title) || str(x.url)}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="t-meta break-keep text-slate-500">등급 — A 공식 통계 · 법령 · 공시 / B 기관 보고서 · 주요 언론 / C 업체 자료 · 블로그 / D 확인 못 함</p>
      </>
    )
  } else if (mode === 'judge') {
    const attacks = arr(s.attacks).map(obj).filter((a) => str(a.point))
    const five = arr(s.five).map(obj).filter((f) => str(f.q))
    const v = str(s.verdict).toUpperCase()
    body = (
      <>
        <p className="t-body break-keep text-slate-900" data-testid="talk-verdict" data-verdict={v}>
          <span className={`font-bold ${v === 'GO' ? 'text-success-700' : v === 'NO_GO' ? 'text-danger-700' : 'text-warning-800'}`}>{judgeVerdictLabel(s.verdict)}</span>
          {str(s.oneLine) ? ` — ${str(s.oneLine)}` : ''}
        </p>
        {typeof s.score === 'number' && s.score > 0 && <p className="t-sub break-keep text-slate-600">전략 점수 {Math.round(s.score)}점{str(s.scoreWhy) ? ` — ${str(s.scoreWhy)}` : ''} <span className="text-slate-500">(AI 가 매긴 참고 점수)</span></p>}
        {chips('꼭 고칠 것', 'text-danger-700', strs(s.mustFix), 'talk-mustfix')}
        {attacks.length > 0 && (
          <details className="t-sub text-slate-700" data-testid="talk-attacks">
            <summary className="tap cursor-pointer font-semibold">따져 본 것 {attacks.length}개</summary>
            <ul className="mt-1 flex flex-col divide-y divide-slate-100">
              {attacks.map((a, i) => (
                <li key={i} className="py-1.5 break-keep [overflow-wrap:anywhere]">
                  <span className={`t-meta mr-1.5 font-bold ${str(a.level).toUpperCase() === 'P0' ? 'text-danger-700' : 'text-slate-600'}`}>{str(a.level) || 'P1'}</span>
                  {str(a.role) && <span className="font-semibold text-slate-800">{str(a.role)}: </span>}
                  {str(a.point)}
                  {str(a.why) && <span className="text-slate-600"> — {str(a.why)}</span>}
                  {str(a.fix) && <span className="block text-slate-800">→ {str(a.fix)}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {five.length > 0 && (
          <details className="t-sub text-slate-700" data-testid="talk-five">
            <summary className="tap cursor-pointer font-semibold">다섯 질문에 답해 보면</summary>
            <ul className="mt-1 flex flex-col gap-1.5">
              {five.map((f, i) => (
                <li key={i} className="break-keep [overflow-wrap:anywhere]">
                  <span className="font-semibold text-slate-800">{str(f.q)}</span>
                  <span className="block">{str(f.a) || '(답 없음)'}{str(f.state) ? <span className={`ml-1 font-semibold ${str(f.state) === '답함' ? 'text-success-700' : 'text-warning-800'}`}>({str(f.state)})</span> : null}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {chips('접거나 다시 설계할 기준', 'text-slate-800', strs(s.stop), 'talk-stop')}
      </>
    )
  } else if (mode === 'lock') {
    body = (
      <>
        <p className="t-body break-keep text-slate-900" data-testid="talk-locked">
          <span className="font-bold">기획서 판을 굳혔어요</span> — {str(s.title)}
          {board && board.id !== run.id ? <span className="text-slate-500"> (뒤에 다시 굳힌 판이 있어요)</span> : null}
        </p>
        {chips('지난 판에서 바뀐 것', 'text-slate-800', strs(s.changed), 'talk-changed')}
        {chips('아직 미정', 'text-warning-800', strs(s.open), 'talk-open')}
        <div className="xl:hidden">
          <Button size="sm" variant="secondary" onClick={onShowBoard} data-testid="talk-show-board">판 보기</Button>
        </div>
      </>
    )
  } else {
    body = (
      <>
        <p className="t-body break-keep text-slate-900" data-testid="talk-prompted">
          <span className="font-bold">개발 프롬프트를 뽑았어요</span> — 저장소 <span className="[overflow-wrap:anywhere]">{str(s.repoName)}</span>
        </p>
        {chips('아직 비어 있는 것', 'text-warning-800', strs(s.missing), 'talk-missing')}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => void onCopy(str(s.prompt), '프롬프트를')} data-testid="talk-turn-prompt-copy">
            <Copy aria-hidden="true" className="size-4" /> 프롬프트 복사
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onCopy(str(s.firstMessage), '첫 메시지를')}>
            <Copy aria-hidden="true" className="size-4" /> 첫 메시지 복사
          </Button>
        </div>
      </>
    )
  }
  const Icon = skillIcon(run.skillId)
  return (
    <article className={`${BOX} flex max-w-full flex-col gap-2.5 p-3.5 sm:max-w-[94%]`} data-testid="talk-card">
      <p className="t-meta flex flex-wrap items-center gap-x-1.5 text-slate-500">
        <Icon aria-hidden="true" className="size-4 text-violet-600" />
        <span className="font-semibold text-slate-700">{run.status === 'pasted' ? '가져온 대화' : MODE_LABEL[mode]}</span>
        <span>· {fmtShort(run.createdAt)}</span>
        {run.status !== 'pasted' && run.model && <span className="[overflow-wrap:anywhere]">· {run.model}</span>}
        {run.status === 'parse_fallback' && <span className="font-semibold text-warning-800">· 형식이 달라 원문 그대로</span>}
        {run.evaluation === 'adopted' && <span className="font-semibold text-success-700">· 채택함</span>}
      </p>
      {body}
      {good && next.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="talk-next-chips">
          {next.map((n) => (
            <button key={n} type="button" onClick={() => onAsk(n)} className="tap t-sub rounded-full border border-slate-200 bg-white px-3 py-1 text-left break-keep text-slate-700 hover:border-brand-300 hover:bg-slate-50" data-testid="talk-next-chip">
              {n}
            </button>
          ))}
        </div>
      )}
      {run.status !== 'pasted' && (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => void onCopy(turnText(run) || run.rendered, '답을')} data-testid="talk-copy">
            <Copy aria-hidden="true" className="size-4" /> 복사
          </Button>
          {good && (mode === 'talk' || mode === 'research' || mode === 'judge') && keep.length + strs(s.mustFix).length > 0 && run.evaluation === 'draft' && (
            <Button size="sm" variant="ghost" onClick={() => void onAdopt(run)} disabled={saving} data-testid="talk-keep-memory">
              <ClipboardCheck aria-hidden="true" className="size-4" /> 기억에 넣기
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
