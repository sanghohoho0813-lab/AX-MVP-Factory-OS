/**
 * AI 도우미 (D-239) — 화면마다 '이 화면이 왜 있는가' 에 맞춘 질문 단추. 타자 없이 눌러서 묻는다.
 *
 *   bar    화면 위 보라색 띠: [AI 도우미] + 자주 쓰는 질문 단추 2~3개(누르면 바로 답) · 고른 모델
 *   button 머리줄 단추 하나 — 누르면 질문 단추 판
 *
 * 누르면 그 화면 자료를 작은 묶음으로 만들어(사람 이름 · 연락처 빼고) 서버 함수(/api/ai-assist)로 보낸다.
 * 브라우저는 AI 공급자를 직접 부르지 않는다. 대표 계정에서만 보인다(팀장 화면 · 팀장 보기에는 없음).
 * 기본 모델은 Gemini 의 가장 싼 모델 — 판 안 '모델 바꾸기' 에서 GPT · Claude 로 바꿀 수 있다(이 브라우저에 기억).
 *
 * D-241 답은 다음 단계로 이어진다 — 대표: "열어보기를 누르면 진짜 뭔가 열리던지 뭔가 기록이 되든지 해야".
 *   - 번호 단추는 무엇이 열리는지 이름으로(업체 열기 · 공고 보기 …). 지금 보고 있는 화면과 같으면 내지 않는다.
 *   - [할 일로 넣기] — 업무 일기 할 일로(업체 번호면 그 업체에 · 언제가 있으면 그날 기한) → 오늘 · 달력에 보인다.
 *   - 화면이 붙이는 단추(itemActions · resultActions) — 예: 마케팅 [내 콘텐츠에 담기] · [이 기획으로 대본 끝까지].
 *   - [더 잘 쓰는 모델로 다시] — 같은 회사의 한 단계 위 모델로 이번 한 번만.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp, ClipboardList, Copy, ExternalLink, History, Loader2, RefreshCw, Settings2, Sparkles, Wand2, X } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useAiAssistAccess } from '../../auth/ownerAiAccess'
import { todayLocalDate } from '../../lib/appClock'
import { useBackToClose } from '../../lib/backToClose'
import { useEscToClose } from '../../lib/escStack'
import { activityTimeText } from '../../services/clientOpsActivity'
import { createJournalEntry } from '../../services/journalService'
import { betterModel, dueFromWhen, isSamePage, pointsAtTodo, refKind, refLabel, todoText, unalias, unaliasAnswer } from '../../services/aiAssist/actions'
import { AssistError, assistMessage, callAssist, fetchAssistStatus } from '../../services/aiAssist/client'
import type { AssistAnswer, AssistItem, AssistRun, AssistStatus, ModelInfo, ProviderId } from '../../services/aiAssist/client'
import { normRef, safeText } from '../../services/aiAssist/context'
import type { AssistBundle } from '../../services/aiAssist/context'
import { presetsFor } from '../../services/aiAssist/presets'
import type { AssistPage, AssistPreset } from '../../services/aiAssist/presets'
import { CHOICE_EVENT, contextHash, historyOf, markDone, newRequestId, pushHistory, readChoice, saveChoice, allowedProviders } from '../../services/aiAssist/store'
import type { AiChoice, FollowMeta, HistoryEntry } from '../../services/aiAssist/store'
import { useToast } from '../ui/toastContext'
import { ModelPicker } from './ModelPicker'

const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: 'Gemini', openai: 'GPT', anthropic: 'Claude' }
/** 서버 상태를 못 받았을 때 보일 기본 이름(서버 목록이 오면 그것으로) */
const FALLBACK_DEFAULT: AiChoice = { provider: 'gemini', model: 'gemini-3.1-flash-lite' }

type Shown = (HistoryEntry & { links: Record<string, string> }) | null

/** D-241 화면이 붙이는 단추가 받는 것 */
export interface AssistCtx {
  assistId: string
  entry: HistoryEntry
  /** 답의 번호(ref) → 화면 저장소의 원래 번호(업체 번호 · 후보 키 …). 없는 번호면 undefined */
  idOf: (ref: string | undefined) => string | undefined
  /** 같은 판에서 다른 질문을 이어서 — 고른 항목을 자료 맨 앞에 붙여 보낸다 */
  follow: (presetId: string, meta: FollowMeta) => void
  close: () => void
}

/** true · {to,label}(끝난 뒤 그곳으로 가는 링크) = 됨 · false = 못 함(다시 누를 수 있게) */
export type AssistActionResult = boolean | { to: string; label: string } | void

export interface AssistItemAction {
  id: string
  label: string
  /** 끝난 뒤 단추 글(없으면 '✓ ' + label) */
  doneLabel?: string
  /** 진하게(그 화면의 첫 다음 단계) */
  primary?: boolean
  /** 한 번 하면 끝인가(담기 · 저장) — 아니면 여러 번 누를 수 있다(이어 쓰기) */
  once?: boolean
  run: (item: AssistItem, ctx: AssistCtx) => Promise<AssistActionResult> | AssistActionResult
}

export interface AssistResultAction {
  id: string
  label: string
  doneLabel?: string
  run: (answer: { structured: AssistAnswer | null; raw: string }, ctx: AssistCtx) => Promise<AssistActionResult> | AssistActionResult
}

/** 답 항목에 [할 일로 넣기] 를 붙일 화면 — 일하는 화면만(마케팅 · 홍보 글은 그 화면 단추가 대신) */
const RECORD_PAGES: ReadonlySet<AssistPage> = new Set<AssistPage>(['today', 'sales', 'clients', 'inbox', 'agents', 'money', 'calendar', 'grants', 'client', 'module'])


export interface AiAssistProps {
  page: AssistPage
  /** 지난 답을 묶는 열쇠(같은 화면 안에서 모듈마다 따로 · 업체마다 따로) */
  scope?: string
  /** 판 제목에 붙는 화면 이름 */
  title: string
  presets: readonly string[]
  build: () => AssistBundle | Promise<AssistBundle>
  variant?: 'bar' | 'button'
  /** 띠에 바로 보일 질문 수(휴대폰은 1개) */
  quick?: number
  label?: string
  className?: string
  /** 글 쓰기 답(본문 있는 항목)을 그 화면 보관함에 저장 — 있으면 '보관함에 저장' 단추가 붙는다 */
  onSaveItem?: (item: AssistItem, assistId: string) => Promise<boolean>
  /** D-241 답 항목마다 붙는 다음 단계 단추(질문마다 다르게 · 없으면 null) */
  itemActions?: (assistId: string) => AssistItemAction[] | null
  /** D-241 답 전체에 붙는 단추(예: 이 대본을 내 콘텐츠에 저장) */
  resultActions?: (assistId: string) => AssistResultAction[] | null
  /** D-241 [할 일로 넣기] — 기본은 일하는 화면에서 켜짐 */
  record?: boolean
  /** 할 일을 넣은 뒤(그 화면 목록 다시 읽기) */
  onRecorded?: () => void
  /** D-244 한 업체 화면 — 답 항목에 업체 번호(c#)가 없어도 [할 일로 넣기] 를 이 업체에 */
  defaultClientId?: string
}

export function AiAssist(props: AiAssistProps) {
  // D-257 팀장도 띠가 보인다(Gemini 만) — AI 전략실은 따로(대표만)
  const access = useAiAssistAccess()
  if (access === 'no') return null
  return <AiAssistInner {...props} />
}

function AiAssistInner({ page, scope, title, presets, build, variant = 'bar', quick = 3, label = 'AI 도우미', className = '', onSaveItem, itemActions, resultActions, record, onRecorded, defaultClientId }: AiAssistProps) {
  const list = useMemo(() => presetsFor(presets), [presets])
  const key = scope ?? page
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AssistStatus | null>(null)
  const [choice, setChoice] = useState<AiChoice | null>(() => readChoice())
  // D-244 한 화면에 도우미가 여럿이면(머리줄 단추 · 탭 띠) 한 곳에서 모델을 바꿔도 모두 따라오게 — 다른 탭에서 바꾼 것도
  useEffect(() => {
    // 알림에 담긴 선택을 그대로(저장 공간이 막혀도 같은 화면은 맞춘다) · 다른 탭은 저장된 것을 다시 읽는다
    const fromEvent = (e: Event) => setChoice(((e as CustomEvent<AiChoice | null>).detail ?? null) as AiChoice | null)
    const fromStorage = () => setChoice(readChoice())
    window.addEventListener(CHOICE_EVENT, fromEvent)
    window.addEventListener('storage', fromStorage)
    return () => {
      window.removeEventListener(CHOICE_EVENT, fromEvent)
      window.removeEventListener('storage', fromStorage)
    }
  }, [])
  const [pendingRun, setPendingRun] = useState<string | null>(null)
  // 할 일을 넣었으면 판을 닫을 때 화면 목록을 다시 읽는다 — 열린 채 다시 읽으면 방금 답에 '자료가 바뀌었어요' 가 떠서
  const recorded = useRef(false)

  const loadStatus = useCallback(async (withModels = false) => {
    try {
      const s = await fetchAssistStatus(withModels)
      setStatus(s)
      return s
    } catch {
      return null
    }
  }, [])

  const effective: AiChoice = choice ?? status?.defaultChoice ?? FALLBACK_DEFAULT

  const openWith = (id: string | null) => {
    setPendingRun(id)
    setOpen(true)
  }

  return (
    <>
      {variant === 'bar' ? (
        <section
          aria-label="AI 도우미"
          data-testid="ai-assist-bar"
          data-ai-assist="bar"
          className={`flex min-w-0 flex-wrap items-center gap-2 rounded-(--radius-panel) border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 px-3 py-2.5 ${className}`}
        >
          <OpenButton label={label} onClick={() => openWith(null)} />
          {list.slice(0, quick).map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-testid="ai-assist-chip"
              data-assist={p.id}
              onClick={() => openWith(p.id)}
              className={`tap t-sub min-h-10 max-w-full min-w-0 items-center rounded-full border border-violet-300 bg-white px-3 py-1.5 text-left font-semibold break-keep text-violet-900 hover:bg-violet-100 ${i === 0 ? 'inline-flex' : 'hidden sm:inline-flex'}`}
            >
              {p.label}
            </button>
          ))}
          {/* D-255 대표 "곳곳에 제미나이 3.1 플래시 라이트만 — 어디서든 내가 원하는 모델로": 이름만 보이던 칩 → 누르면 고르는 단추 */}
          <ModelPicker popover className="ml-auto" testId="ai-assist-model-chip" />
        </section>
      ) : (
        <OpenButton label={label} onClick={() => openWith(null)} className={className} />
      )}
      {open && (
        <AssistPanel
          page={page}
          scope={key}
          title={title}
          presets={list}
          build={build}
          status={status}
          loadStatus={loadStatus}
          choice={choice}
          effective={effective}
          setChoice={(c) => {
            setChoice(c)
            saveChoice(c)
          }}
          autoRun={pendingRun}
          onSaveItem={onSaveItem}
          itemActions={itemActions}
          resultActions={resultActions}
          record={record ?? RECORD_PAGES.has(page)}
          defaultClientId={defaultClientId}
          onRecorded={() => {
            recorded.current = true
          }}
          onClose={() => {
            setOpen(false)
            setPendingRun(null)
            if (recorded.current) {
              recorded.current = false
              onRecorded?.()
            }
          }}
        />
      )}
    </>
  )
}

function OpenButton({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-testid="ai-assist-open"
      data-ai-assist="open"
      onClick={onClick}
      className={`tap t-body inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-1.5 font-semibold whitespace-nowrap text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 sm:min-h-10 ${className}`}
    >
      <Sparkles aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </button>
  )
}

/** 서버 목록이 아직 없으면 모델 이름을 읽기 좋게('gemini-3.1-flash-lite' → 'Gemini 3.1 Flash Lite') */
export function prettyModel(id: string): string {
  return id
    .replace(/(\d)-(\d)/g, '$1.$2')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^Gpt/, 'GPT')
    .replace(/Flash Lite$/, 'Flash-Lite')
}

export function labelOf(status: AssistStatus | null, c: AiChoice): string {
  const p = status?.providers.find((x) => x.id === c.provider)
  const m = p?.models.find((x) => x.id === c.model)
  return m ? m.label : prettyModel(c.model)
}


/* ------------------------------------------------------------------ */
/* 판                                                                    */
/* ------------------------------------------------------------------ */

function AssistPanel({
  page,
  scope,
  title,
  presets,
  build,
  status,
  loadStatus,
  choice,
  effective,
  setChoice,
  autoRun,
  onSaveItem,
  itemActions,
  resultActions,
  record,
  defaultClientId,
  onRecorded,
  onClose,
}: {
  onSaveItem?: (item: AssistItem, assistId: string) => Promise<boolean>
  itemActions?: (assistId: string) => AssistItemAction[] | null
  resultActions?: (assistId: string) => AssistResultAction[] | null
  record: boolean
  defaultClientId?: string
  onRecorded?: () => void
  page: AssistPage
  scope: string
  title: string
  presets: AssistPreset[]
  build: () => AssistBundle | Promise<AssistBundle>
  status: AssistStatus | null
  loadStatus: (withModels?: boolean) => Promise<AssistStatus | null>
  choice: AiChoice | null
  effective: AiChoice
  setChoice: (c: AiChoice | null) => void
  autoRun: string | null
  onClose: () => void
}) {
  useBackToClose(true, onClose)
  useEscToClose(true, onClose)
  const { showToast } = useToast()
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<{ code: string; message: string; missing: string[] } | null>(null)
  const [shown, setShown] = useState<Shown>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(() => historyOf(scope))
  const [ask, setAsk] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [askPreset, setAskPreset] = useState(presets[0]?.id ?? '')
  const [settings, setSettings] = useState(false)
  const [nowHash, setNowHash] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!status) void loadStatus()
  }, [status, loadStatus])

  // 지금 자료의 지문 — 지난 답이 다른 자료로 만든 것이면 알려 준다
  useEffect(() => {
    let alive = true
    Promise.resolve(build())
      .then((b) => alive && setNowHash(contextHash(JSON.stringify(b.context))))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [build])

  /**
   * opts.choice — 이번 한 번만 다른 모델(더 잘 쓰는 모델로 다시) · opts.follow — 고른 항목을 자료 맨 앞에 붙여 이어 쓰기.
   * 지문(hash)은 화면 자료로만 — 이어 쓴 답도 '화면 자료가 바뀌었어요' 를 같은 기준으로 판단한다.
   */
  const run = useCallback(
    async (preset: AssistPreset, askText = '', opts: { choice?: AiChoice; follow?: FollowMeta } = {}) => {
      if (running) return
      setRunning(preset.id)
      setError(null)
      try {
        const bundle = await Promise.resolve(build())
        const hash = contextHash(JSON.stringify(bundle.context))
        setNowHash(hash)
        const context = opts.follow ? { ...bundle.context, sections: [opts.follow.section, ...bundle.context.sections] } : bundle.context
        // D-244 직접 적은 질문도 보내기 전에 가린다(연락처 · 이메일 · 주민번호) — 지난 답에도 가린 글만 남긴다
        const masked = askText ? safeText(askText, [], 500) : ''
        const runResult: AssistRun = await callAssist({ requestId: newRequestId(), assistId: preset.id, page, choice: opts.choice ?? choice ?? (status ? status.defaultChoice : null), context, ask: masked })
        const entry: HistoryEntry & { links: Record<string, string> } = { scope, assistId: preset.id, label: opts.follow ? `${preset.label} · ${opts.follow.title}` : preset.label, ask: masked, hash, run: runResult, links: bundle.links, ids: bundle.ids ?? {}, ...(bundle.aliases ? { aliases: bundle.aliases } : {}), ...(opts.follow ? { follow: opts.follow } : {}) }
        pushHistory(entry)
        setHistory(historyOf(scope))
        setShown(entry)
        window.setTimeout(() => resultRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40)
      } catch (e) {
        if (e instanceof AssistError) setError({ code: e.code, message: e.message, missing: e.missing })
        else setError({ code: 'provider_error', message: assistMessage('provider_error'), missing: [] })
      } finally {
        setRunning(null)
      }
    },
    [running, build, page, choice, status, scope],
  )

  /** 판의 단추에 없는 질문(이어 쓰기 전용 — 예: 대본 끝까지)도 찾는다 */
  const presetOf = useCallback((id: string) => presets.find((x) => x.id === id) ?? presetsFor([id])[0], [presets])

  const rerun = useCallback(
    (entry: NonNullable<Shown>, choiceOverride?: AiChoice) => {
      const p = presetOf(entry.assistId)
      if (p) void run(p, entry.ask, { choice: choiceOverride, follow: entry.follow })
    },
    [presetOf, run],
  )

  const ctxFor = useCallback(
    (entry: NonNullable<Shown>): AssistCtx => ({
      assistId: entry.assistId,
      entry,
      idOf: (ref) => {
        const r = normRef(ref)
        return r ? entry.ids?.[r] : undefined
      },
      follow: (presetId, meta) => {
        const p = presetOf(presetId)
        if (p) void run(p, '', { follow: meta })
      },
      close: onClose,
    }),
    [presetOf, run, onClose],
  )

  const better = useMemo(() => (shown ? betterModel(status, shown.run) : null), [status, shown])

  // D-244 할 일로 넣은 항목을 지난 답에 적었으면 목록 · 보이는 답을 새것으로(다시 눌러도 같은 할 일이 두 번 안 생기게)
  const onMarked = useCallback(
    (updated: HistoryEntry) => {
      setHistory(historyOf(scope))
      setShown((s) => (s && s.run.requestId === updated.run.requestId ? { ...s, done: updated.done } : s))
    },
    [scope],
  )

  // 띠의 질문 단추로 열었으면 바로 묻는다(한 번만)
  useEffect(() => {
    if (!autoRun || started.current) return
    started.current = true
    const p = presets.find((x) => x.id === autoRun)
    if (p) void run(p)
  }, [autoRun, presets, run])

  const stale = !!shown && !!nowHash && shown.hash !== nowHash

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`AI 도우미 · ${title}`} data-testid="ai-assist-panel">
      <div className="ax-pop flex max-h-[94vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-(--radius-panel)">
        <div className="flex shrink-0 items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-5 py-3.5 sm:rounded-t-(--radius-panel)">
          <Sparkles aria-hidden="true" className="size-5 shrink-0 text-violet-700" />
          <h2 className="t-section min-w-0 grow break-keep text-violet-950 [overflow-wrap:anywhere]">AI 도우미 · {title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="tap -mr-2 flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-white hover:text-slate-800">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {/* D-255 모델을 먼저 — 질문을 누르기 전에 무엇으로 물을지 보이고 바꿀 수 있게(전에는 질문 단추 아래) */}
            <ModelRow status={status} effective={effective} choice={choice} open={settings} setOpen={setSettings} setChoice={setChoice} loadStatus={loadStatus} />
            <section aria-label="무엇을 도와드릴까요" className="flex flex-col gap-2">
              <p className="t-sub font-semibold text-slate-700">무엇을 도와드릴까요? — 누르면 바로 답해요</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid="ai-assist-preset"
                    data-assist={p.id}
                    disabled={!!running}
                    onClick={() => void run(p, '')}
                    className={`tap flex min-h-14 min-w-0 items-start gap-2 rounded-(--radius-control) border px-3 py-2.5 text-left disabled:cursor-wait ${shown?.assistId === p.id ? 'border-violet-500 bg-violet-50' : 'border-violet-200 bg-white hover:bg-violet-50'}`}
                  >
                    {running === p.id ? <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin text-violet-700" /> : <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-600" />}
                    <span className="flex min-w-0 flex-col">
                      <span className="t-body font-semibold break-keep text-violet-950">{p.label}</span>
                      <span className="t-meta break-keep text-slate-600">{p.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setAskOpen((v) => !v)} aria-expanded={askOpen} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-violet-800 hover:underline">
                {askOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
                단추에 없는 것 물어보기(선택)
              </button>
              {askOpen && (
                <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 p-3">
                  <textarea
                    value={ask}
                    maxLength={500}
                    onChange={(e) => setAsk(e.target.value)}
                    rows={2}
                    placeholder="예: 이 중에서 이번 주 금요일까지 끝낼 수 있는 것만"
                    className="t-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2"
                    data-testid="ai-assist-ask"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-meta text-slate-500">아래 단추 하나를 고르면 이 말을 같이 보내요</span>
                    <select
                      aria-label="어느 질문에 붙일까요"
                      className="t-sub ml-auto min-h-10 rounded-(--radius-control) border border-slate-300 bg-white px-2"
                      data-testid="ai-assist-ask-preset"
                      value={askPreset}
                      onChange={(e) => setAskPreset(e.target.value)}
                    >
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!ask.trim() || !!running}
                      onClick={() => {
                        const p = presets.find((x) => x.id === askPreset) ?? presets[0]
                        if (p) void run(p, ask.trim())
                      }}
                      className="tap t-sub min-h-10 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white disabled:opacity-50"
                      data-testid="ai-assist-ask-send"
                    >
                      같이 보내기
                    </button>
                  </div>
                </div>
              )}
            </section>

            {error && <ErrorBox error={error} />}

            {running && !shown && (
              <div className="flex items-center gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-3" data-testid="ai-assist-running">
                <Loader2 aria-hidden="true" className="size-4 animate-spin text-violet-700" />
                <span className="t-body text-violet-900">화면 자료를 보내고 답을 기다리는 중…(보통 5~20초)</span>
              </div>
            )}

            {running && shown && (
              <div className="flex items-center gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-2.5" data-testid="ai-assist-running">
                <Loader2 aria-hidden="true" className="size-4 animate-spin text-violet-700" />
                <span className="t-sub text-violet-900">{presetOf(running)?.label ?? '답'} — 만드는 중…(긴 글은 20~60초)</span>
              </div>
            )}

            {shown && (
              <div ref={resultRef} className="scroll-mt-2">
                <ResultView
                  key={shown.run.requestId}
                  entry={shown}
                  stale={stale}
                  running={!!running}
                  onClose={onClose}
                  onSaveItem={onSaveItem}
                  onSaved={(ok) => showToast(ok ? '보관함에 저장했어요 — 화면 아래 보관함에 쌓여요' : '저장하지 못했어요. 다시 눌러 주세요.')}
                  onRerun={() => rerun(shown)}
                  better={better}
                  onBetter={() => better && rerun(shown, { provider: better.provider, model: better.model })}
                  onCopied={() => showToast('복사했어요')}
                  ctx={ctxFor(shown)}
                  itemActions={itemActions?.(shown.assistId) ?? []}
                  resultActions={resultActions?.(shown.assistId) ?? []}
                  record={record}
                  defaultClientId={defaultClientId}
                  onRecorded={onRecorded}
                  onMarked={onMarked}
                  toast={showToast}
                />
              </div>
            )}

            {history.length > 0 && (
              <section aria-label="지난 답" className="flex flex-col gap-1.5" data-testid="ai-assist-history">
                <p className="t-sub flex items-center gap-1 font-semibold text-slate-700">
                  <History aria-hidden="true" className="size-4" /> 지난 답(이 브라우저에만)
                </p>
                <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
                  {history.map((h) => (
                    <li key={h.run.requestId}>
                      <button
                        type="button"
                        onClick={() => setShown({ ...h, links: h.links ?? {} })}
                        className={`tap flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left hover:bg-slate-50 ${shown?.run.requestId === h.run.requestId ? 'bg-violet-50' : ''}`}
                      >
                        <span className="t-sub min-w-0 grow font-semibold break-keep text-slate-800">{h.label}</span>
                        <span className="t-meta shrink-0 text-slate-500">
                          {activityTimeText(h.run.createdAt)} · {PROVIDER_LABEL[h.run.provider] ?? h.run.provider}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="t-meta break-keep text-slate-500">
              보내는 것: 이 화면의 업체 · 일 · 숫자(사람 이름 · 연락처 · 주민번호 · 계좌는 빼고). AI 답은 틀릴 수 있어요 — 금액 · 날짜는 화면 숫자로 한 번 확인하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 모델 고르기                                                            */
/* ------------------------------------------------------------------ */

function priceText(m: ModelInfo): string {
  return m.price ? `입력 $${m.price[0]} · 출력 $${m.price[1]} (100만 토큰)` : '가격 정보 없음'
}

export function ModelRow({
  status,
  effective,
  choice,
  open,
  setOpen,
  setChoice,
  loadStatus,
}: {
  status: AssistStatus | null
  effective: AiChoice
  choice: AiChoice | null
  open: boolean
  setOpen: (v: boolean) => void
  setChoice: (c: AiChoice | null) => void
  loadStatus: (withModels?: boolean) => Promise<AssistStatus | null>
}) {
  const [tab, setTab] = useState<ProviderId>(effective.provider)
  const [checking, setChecking] = useState(false)
  const provider = status?.providers.find((p) => p.id === tab)
  const current = labelOf(status, effective)
  const isDefault = !choice
  return (
    <section aria-label="모델" className="rounded-(--radius-control) border border-slate-200" data-testid="ai-assist-model">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="t-sub text-slate-600">쓰는 모델</span>
        <button type="button" onClick={() => setOpen(!open)} className="tap t-sub min-w-0 text-left font-semibold break-keep text-slate-900 hover:underline" data-testid="ai-assist-model-label">
          {current}
          {isDefault && <span className="t-meta ml-1 font-normal text-slate-500">(기본 · 가장 쌈)</span>}
        </button>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap t-sub ml-auto inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50" data-testid="ai-assist-model-toggle">
          <Settings2 aria-hidden="true" className="size-4" /> {open ? '닫기' : '모델 바꾸기'}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 px-3 py-3" data-testid="ai-assist-settings">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="AI 회사">
            {allowedProviders().filter((id) => !status || status.providers.some((x) => x.id === id)).map((id) => {
              const p = status?.providers.find((x) => x.id === id)
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  data-provider={id}
                  onClick={() => setTab(id)}
                  className={`tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 font-semibold ${tab === id ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {PROVIDER_LABEL[id]}
                  <span className={`t-meta rounded-full px-1.5 ${tab === id ? 'bg-white/25' : p?.configured ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`}>{p ? (p.configured ? '키 있음' : '키 없음') : '…'}</span>
                </button>
              )
            })}
          </div>
          {!status && <p className="t-sub text-slate-600">모델 목록을 받지 못했어요(서버 함수가 없는 미리보기이거나 연결 문제). 기본 모델로 물어봅니다.</p>}
          {provider && !provider.configured && (
            <p className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900">
              {provider.label} 키가 아직 없어요 — Vercel › Settings › Environment Variables 에 <b>{provider.keyName}</b> 를 넣고 Redeploy 하면 고를 수 있어요.
            </p>
          )}
          {provider && (
            <ul className="flex flex-col gap-1.5">
              {provider.models.map((m) => {
                const on = effective.provider === provider.id && effective.model === m.id
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      data-testid="ai-assist-model-option"
                      data-model={m.id}
                      disabled={!provider.configured}
                      onClick={() => setChoice({ provider: provider.id, model: m.id })}
                      className={`tap flex w-full min-w-0 items-start gap-2 rounded-(--radius-control) border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-55 ${on ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${on ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'}`}>{on && <Check aria-hidden="true" className="size-3" />}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="t-sub font-semibold break-keep text-slate-900">
                          {m.label} <span className="t-meta font-normal text-slate-600">· {m.note}</span>
                        </span>
                        <span className="t-meta break-keep text-slate-500">
                          {priceText(m)}
                          {m.verified === true && ' · ✓ 이 키로 확인됨'}
                          {m.verified === false && ' · 이 키 목록에 없음'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={checking}
              onClick={async () => {
                setChecking(true)
                await loadStatus(true)
                setChecking(false)
              }}
              className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" className={`size-4 ${checking ? 'animate-spin' : ''}`} /> 키로 쓸 수 있는 모델 확인
            </button>
            {!isDefault && (
              <button type="button" onClick={() => setChoice(null)} className="tap t-sub min-h-10 rounded-(--radius-control) px-2.5 font-semibold text-violet-800 hover:underline" data-testid="ai-assist-model-reset">
                기본(가장 싼 Gemini)으로
              </button>
            )}
          </div>
          <p className="t-meta break-keep text-slate-500">
            {/* D-257 팀장 화면에는 없는 마케팅 · AI 전략실은 말하지 않는다 */}
            고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 단추(도우미 · 대화창 · 명세서 · 사업계획서{allowedProviders().length > 1 ? ' · 마케팅 · AI 전략실' : ' · 오른쪽 판 AI 대화'})가 같이 써요.
            {allowedProviders().length === 1 && ' 팀장 계정은 지금 Gemini 모델만 쓸 수 있어요.'}
          </p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 오류 · 결과                                                            */
/* ------------------------------------------------------------------ */

function ErrorBox({ error }: { error: { code: string; message: string; missing: string[] } }) {
  let how: ReactNode = null
  if (error.code === 'setup_needed')
    how = (
      <>
        Vercel › Settings › Environment Variables 에 <b>{error.missing[0] ?? 'GEMINI_API_KEY'}</b> 를 넣고 Redeploy 하면 바로 됩니다(키는 서버에만 — 이름이 VITE_ 로 시작하면 안 됩니다).
      </>
    )
  if (error.code === 'db_setup_needed') how = <>Supabase SQL Editor 에서 0021(AI 전략실 권한) 을 한 번 실행하면 됩니다 — docs/OWNER_AI_WORKSPACE_V1.md §12.</>
  return (
    <div role="alert" className="flex gap-2 rounded-(--radius-control) border border-amber-300 bg-amber-50 px-3 py-3" data-testid="ai-assist-error" data-code={error.code}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="t-body font-semibold break-keep text-amber-950">{error.message}</span>
        {how && <span className="t-sub break-keep text-amber-900">{how}</span>}
      </span>
    </div>
  )
}

export function answerText(a: AssistAnswer | null, raw: string): string {
  if (!a) return raw
  const lines = [a.headline, '']
  a.items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title}${it.tag ? ` [${it.tag}]` : ''}${it.amount ? ` · ${it.amount}` : ''}${it.when ? ` · ${it.when}` : ''}`)
    if (it.detail) lines.push(`   ${it.detail}`)
    for (const o of it.outline ?? []) lines.push(`   - ${o}`)
    if (it.body) lines.push('', it.body, '')
  })
  if (a.next?.length) lines.push('', '바로 할 일', ...a.next.map((n) => `- ${n}`))
  if (a.caution) lines.push('', `확인할 점: ${a.caution}`)
  return lines.join('\n').trim()
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function costText(run: AssistRun): string {
  if (run.estimatedCostUsd == null) return ''
  const krw = run.estimatedCostUsd * 1400
  return krw < 1 ? ' · 1원 안 됨' : ` · 약 ${Math.round(krw).toLocaleString('ko-KR')}원`
}

interface ResultViewProps {
  entry: NonNullable<Shown>
  stale: boolean
  running: boolean
  onRerun: () => void
  better: (AiChoice & { label: string }) | null
  onBetter: () => void
  onClose: () => void
  onCopied: () => void
  onSaveItem?: (item: AssistItem, assistId: string) => Promise<boolean>
  onSaved: (ok: boolean) => void
  ctx: AssistCtx
  itemActions: AssistItemAction[]
  resultActions: AssistResultAction[]
  record: boolean
  defaultClientId?: string
  onRecorded?: () => void
  onMarked?: (updated: HistoryEntry) => void
  toast: (msg: string) => void
}

function ResultView({ entry, stale, running, onRerun, better, onBetter, onClose, onCopied, onSaveItem, onSaved, ctx, itemActions, resultActions, record, defaultClientId, onRecorded, onMarked, toast }: ResultViewProps) {
  const { run } = entry
  // D-244 별칭(영업자 A)은 보여 줄 때 실제 이름으로 — 이 브라우저에서만
  const a = useMemo(() => unaliasAnswer(run.structured, entry.aliases), [run.structured, entry.aliases])
  const raw = useMemo(() => unalias(run.raw, entry.aliases), [run.raw, entry.aliases])
  const done = useMemo(() => new Set(entry.done ?? []), [entry.done])
  const here = useLocation()
  // 로컬 모드에는 AuthProvider 가 없다 — 그때는 작업공간 · 사용자 없이(업무 일기는 이 브라우저에)
  const auth = useContext(AuthContext)

  /** 답 한 줄 → 업무 일기 할 일(업체 번호면 그 업체에 · 언제가 있으면 그날 기한). key = 지난 답에 '했음' 으로 적을 이름 */
  const addTodo = async (item: Pick<AssistItem, 'title' | 'detail' | 'ref' | 'when'>, key: string): Promise<AssistActionResult> => {
    const today = todayLocalDate()
    const r = normRef(item.ref)
    // D-244 업체 상세처럼 한 업체 화면이면 번호가 없는 항목도 그 업체에
    const clientId = (r && refKind(r) === 'c' ? ctx.idOf(r) : undefined) ?? defaultClientId
    const due = dueFromWhen(item.when, today)
    try {
      await createJournalEntry(auth?.currentWorkspaceId ?? null, auth?.session?.user.id ?? null, {
        entryType: 'follow_up',
        entryDate: today,
        content: todoText(item),
        clientId: clientId ?? null,
        dueDate: due,
      })
      const updated = markDone(run.requestId, key)
      if (updated) onMarked?.(updated)
      onRecorded?.()
      toast(due === today ? '오늘 할 일에 넣었어요' : `할 일에 넣었어요 · 기한 ${due.slice(5).replace('-', '/')}`)
      return { to: due === today ? '/' : '/ops/calendar', label: due === today ? '오늘 할 일에서 보기' : '일정에서 보기' }
    } catch {
      return false
    }
  }

  return (
    <section aria-label="AI 답" className="flex flex-col gap-3 rounded-(--radius-panel) border border-violet-300 bg-white p-3.5 shadow-sm" data-testid="ai-assist-result" data-assist={entry.assistId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">
          <Sparkles aria-hidden="true" className="size-3.5" /> {entry.label}
        </span>
        {stale && (
          <span className="t-meta rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900" data-testid="ai-assist-stale">
            그 뒤로 화면 자료가 바뀌었어요 — 다시 만들면 새 자료로
          </span>
        )}
      </div>
      {a ? (
        <>
          <p className="t-card font-bold break-keep text-slate-900" data-testid="ai-assist-headline">
            {a.headline}
          </p>
          <ol className="flex flex-col gap-2.5">
            {a.items.map((it, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-slate-50/50 px-3 py-2.5" data-testid="ai-assist-item">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 font-bold text-white">{i + 1}</span>
                  <span className="t-body min-w-0 grow font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{it.title}</span>
                  {it.tag && <span className="t-meta shrink-0 rounded-full bg-white px-2 py-0.5 font-semibold text-violet-800 ring-1 ring-violet-200">{it.tag}</span>}
                </div>
                {(it.amount || it.when) && (
                  <p className="t-sub break-keep text-slate-700">
                    {it.amount && <b className="font-semibold">{it.amount}</b>}
                    {it.amount && it.when && ' · '}
                    {it.when}
                  </p>
                )}
                {it.detail && <p className="t-body break-keep whitespace-pre-line text-slate-800 [overflow-wrap:anywhere]">{it.detail}</p>}
                {it.outline && it.outline.length > 0 && (
                  <ul className="t-sub list-disc pl-5 break-keep text-slate-700">
                    {it.outline.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                )}
                {it.body && (
                  <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white p-2.5">
                    <p className="t-body break-keep whitespace-pre-line text-slate-900 [overflow-wrap:anywhere]" data-testid="ai-assist-body">
                      {it.body}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {onSaveItem && <SaveItemButton onSave={() => onSaveItem(it, entry.assistId)} onSaved={onSaved} />}
                      <button
                        type="button"
                        onClick={async () => {
                          if (await copy(`${it.title}\n\n${it.body}`)) onCopied()
                        }}
                        className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy aria-hidden="true" className="size-4" /> 이 글 복사
                      </button>
                    </div>
                  </div>
                )}
                <ItemActionRow
                  item={it}
                  entry={entry}
                  here={here}
                  onClose={onClose}
                  actions={itemActions}
                  ctx={ctx}
                  onTodo={record && !pointsAtTodo(it.ref, entry.links) ? () => addTodo(it, `item:${i}`) : undefined}
                  todoDone={done.has(`item:${i}`)}
                  toast={toast}
                />
              </li>
            ))}
          </ol>
          {a.next && a.next.length > 0 && (
            <div className="flex flex-col gap-1 rounded-(--radius-control) bg-violet-50 px-3 py-2.5">
              <p className="t-sub font-semibold text-violet-900">바로 할 일</p>
              <ul className="flex flex-col gap-1">
                {a.next.map((n, i) => (
                  <li key={i} className="t-body flex flex-wrap items-start gap-x-1.5 gap-y-1 break-keep text-violet-950" data-testid="ai-assist-next">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet-700" />
                    <span className="min-w-0 grow basis-40">{n}</span>
                    {record && <ActionButton id="todo-next" label="할 일로" doneLabel="할 일에 넣음" once small initiallyDone={done.has(`next:${i}`)} onRun={() => addTodo({ title: n }, `next:${i}`)} toast={toast} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.caution && <p className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900">확인할 점 · {a.caution}</p>}
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="t-sub text-slate-600">정리된 모양으로 오지 않아 받은 글을 그대로 보여 드려요.</p>
          <p className="t-body break-keep whitespace-pre-line text-slate-900">{raw}</p>
        </div>
      )}
      {resultActions.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 p-2.5" data-testid="ai-assist-result-actions">
          {resultActions.map((act) => (
            <ActionButton key={act.id} id={act.id} label={act.label} doneLabel={act.doneLabel} primary once onRun={() => act.run({ structured: a, raw }, ctx)} onNavigate={onClose} toast={toast} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={async () => {
            if (await copy(answerText(a, raw))) onCopied()
          }}
          className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="ai-assist-copy"
        >
          <Copy aria-hidden="true" className="size-4" /> 전체 복사
        </button>
        <button type="button" disabled={running} onClick={onRerun} className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-violet-300 bg-white px-2.5 font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60" data-testid="ai-assist-rerun">
          <RefreshCw aria-hidden="true" className={`size-4 ${running ? 'animate-spin' : ''}`} /> 다시 만들기
        </button>
        {better && (
          <button
            type="button"
            disabled={running}
            onClick={onBetter}
            title={`이번 한 번만 ${better.label} 로 — 고른 모델은 그대로`}
            className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-violet-400 bg-violet-50 px-2.5 font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
            data-testid="ai-assist-better"
            data-model={better.model}
          >
            <Wand2 aria-hidden="true" className="size-4" /> 더 잘 쓰는 모델로 다시 · {better.label}
          </button>
        )}
        <span className="t-meta ml-auto break-keep text-slate-500" data-testid="ai-assist-meta">
          {PROVIDER_LABEL[run.provider] ?? run.provider} · {run.model} · {(run.ms / 1000).toFixed(1)}초 · 토큰 {run.usage.total.toLocaleString('ko-KR')}
          {costText(run)} · 보낸 줄 {run.sent.rows}
        </span>
      </div>
    </section>
  )
}

/** 한 번만 저장(두 번 눌러도 한 번) — 저장한 뒤에는 '저장됨' */
function SaveItemButton({ onSave, onSaved }: { onSave: () => Promise<boolean>; onSaved: (ok: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  return (
    <button
      type="button"
      disabled={state !== 'idle'}
      data-testid="ai-assist-save"
      onClick={async () => {
        setState('busy')
        const ok = await onSave().catch(() => false)
        setState(ok ? 'done' : 'idle')
        onSaved(ok)
      }}
      className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-violet-400 bg-violet-600 px-2.5 font-semibold text-white hover:bg-violet-700 disabled:opacity-70"
    >
      {state === 'done' ? <Check aria-hidden="true" className="size-4" /> : state === 'busy' ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
      {state === 'done' ? '보관함에 저장됨' : '보관함에 저장'}
    </button>
  )
}

/**
 * D-241 답 한 줄 아래 단추 줄 — 화면이 붙인 다음 단계 · [할 일로 넣기] · 이름 붙은 이동 단추.
 * 이동 단추는 무엇이 열리는지 말한다(업체 열기 · 공고 보기 …). 지금 보고 있는 화면과 같은 곳이면 내지 않는다
 * (D-239 마케팅 답의 '열어 보기' 는 지금 화면 주소여서 눌러도 판만 닫혔다).
 */
function ItemActionRow({
  item,
  entry,
  here,
  onClose,
  actions,
  ctx,
  onTodo,
  todoDone = false,
  toast,
}: {
  item: AssistItem
  entry: NonNullable<Shown>
  here: { pathname: string; search: string }
  onClose: () => void
  actions: AssistItemAction[]
  ctx: AssistCtx
  onTodo?: () => Promise<AssistActionResult>
  /** D-244 이 항목은 이미 할 일로 넣었음(지난 답에 적힌 것) */
  todoDone?: boolean
  toast: (msg: string) => void
}) {
  const r = normRef(item.ref)
  const href = r ? entry.links[r] : undefined
  const external = !!href && /^https:\/\//.test(href)
  const showRef = !!href && (external || !isSamePage(href, here))
  if (!showRef && !onTodo && actions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="ai-assist-item-actions">
      {actions.map((act) => (
        <ActionButton key={act.id} id={act.id} label={act.label} doneLabel={act.doneLabel} primary={act.primary} once={act.once} onRun={() => act.run(item, ctx)} onNavigate={onClose} toast={toast} />
      ))}
      {onTodo && <ActionButton id="todo" label="할 일로 넣기" doneLabel="할 일에 넣음" once initiallyDone={todoDone} onRun={onTodo} onNavigate={onClose} toast={toast} />}
      {showRef &&
        href &&
        (external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) px-1.5 font-semibold text-brand-700 hover:underline" data-testid="ai-assist-ref">
            {refKind(r) === 'v' ? '영상 보기' : '새 창에서 보기'} <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <Link to={href} onClick={onClose} className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) px-1.5 font-semibold text-brand-700 hover:underline" data-testid="ai-assist-ref" data-ref={r}>
            {refLabel(r)} <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ))}
    </div>
  )
}

/** 한 번 누르면 하는 단추 — 하는 중 · 됨 · 못 함(다시 누를 수 있게). 됨이 '그곳으로' 를 돌려주면 옆에 이동 링크 */
function ActionButton({
  id,
  label,
  doneLabel,
  primary = false,
  once = false,
  small = false,
  initiallyDone = false,
  onRun,
  onNavigate,
  toast,
}: {
  id: string
  label: string
  doneLabel?: string
  primary?: boolean
  once?: boolean
  small?: boolean
  /** D-244 판을 다시 열어도 '됨' 그대로(지난 답에 적힌 것) */
  initiallyDone?: boolean
  onRun: () => Promise<AssistActionResult> | AssistActionResult
  onNavigate?: () => void
  toast: (msg: string) => void
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>(once && initiallyDone ? 'done' : 'idle')
  const [go, setGo] = useState<{ to: string; label: string } | null>(null)
  const done = once && state === 'done'
  const tone = done ? 'border-success-200 bg-success-50 text-success-800' : primary ? 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700' : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-50'
  return (
    <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={state === 'busy' || done}
        data-testid="ai-assist-action"
        data-action={id}
        data-state={state}
        onClick={async () => {
          setState('busy')
          let res: AssistActionResult
          try {
            res = await onRun()
          } catch {
            res = false
          }
          if (res === false) {
            setState('idle')
            toast('하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
            return
          }
          setState(once ? 'done' : 'idle')
          if (res && typeof res === 'object') setGo(res)
        }}
        className={`tap inline-flex max-w-full min-w-0 items-center gap-1 rounded-(--radius-control) border px-2.5 font-semibold break-keep disabled:cursor-default ${small ? 't-meta min-h-9' : 't-sub min-h-10'} ${tone}`}
      >
        {state === 'busy' ? (
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
        ) : done ? (
          <Check aria-hidden="true" className="size-4 shrink-0" />
        ) : id.startsWith('todo') ? (
          <ClipboardList aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        )}
        {done ? (doneLabel ?? label) : label}
      </button>
      {go &&
        (/^https:\/\//.test(go.to) ? (
          <a href={go.to} target="_blank" rel="noopener noreferrer" className="tap t-sub inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid="ai-assist-action-go">
            {go.label} <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <Link to={go.to} onClick={onNavigate} className="tap t-sub inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid="ai-assist-action-go">
            {go.label} <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ))}
    </span>
  )
}
