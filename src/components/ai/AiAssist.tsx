/**
 * AI 도우미 (D-239) — 화면마다 '이 화면이 왜 있는가' 에 맞춘 질문 단추. 타자 없이 눌러서 묻는다.
 *
 *   bar    화면 위 보라색 띠: [AI 도우미] + 자주 쓰는 질문 단추 2~3개(누르면 바로 답) · 고른 모델
 *   button 머리줄 단추 하나 — 누르면 질문 단추 판
 *
 * 누르면 그 화면 자료를 작은 묶음으로 만들어(사람 이름 · 연락처 빼고) 서버 함수(/api/ai-assist)로 보낸다.
 * 브라우저는 AI 공급자를 직접 부르지 않는다. 대표 계정에서만 보인다(팀장 화면 · 팀장 보기에는 없음).
 * 기본 모델은 Gemini 의 가장 싼 모델 — 판 안 '모델 바꾸기' 에서 GPT · Claude 로 바꿀 수 있다(이 브라우저에 기억).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, History, Loader2, RefreshCw, Settings2, Sparkles, X } from 'lucide-react'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { useBackToClose } from '../../lib/backToClose'
import { useEscToClose } from '../../lib/escStack'
import { activityTimeText } from '../../services/clientOpsActivity'
import { AssistError, assistMessage, callAssist, fetchAssistStatus } from '../../services/aiAssist/client'
import type { AssistAnswer, AssistItem, AssistRun, AssistStatus, ModelInfo, ProviderId } from '../../services/aiAssist/client'
import type { AssistBundle } from '../../services/aiAssist/context'
import { presetsFor } from '../../services/aiAssist/presets'
import type { AssistPage, AssistPreset } from '../../services/aiAssist/presets'
import { contextHash, historyOf, newRequestId, pushHistory, readChoice, saveChoice } from '../../services/aiAssist/store'
import type { AiChoice, HistoryEntry } from '../../services/aiAssist/store'
import { useToast } from '../ui/toastContext'

const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: 'Gemini', openai: 'GPT', anthropic: 'Claude' }
/** 서버 상태를 못 받았을 때 보일 기본 이름(서버 목록이 오면 그것으로) */
const FALLBACK_DEFAULT: AiChoice = { provider: 'gemini', model: 'gemini-3.1-flash-lite' }

type Shown = (HistoryEntry & { links: Record<string, string> }) | null


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
}

export function AiAssist(props: AiAssistProps) {
  const access = useOwnerAiAccess()
  if (access === 'no') return null
  return <AiAssistInner {...props} />
}

function AiAssistInner({ page, scope, title, presets, build, variant = 'bar', quick = 3, label = 'AI 도우미', className = '', onSaveItem }: AiAssistProps) {
  const list = useMemo(() => presetsFor(presets), [presets])
  const key = scope ?? page
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<AssistStatus | null>(null)
  const [choice, setChoice] = useState<AiChoice | null>(() => readChoice())
  const [pendingRun, setPendingRun] = useState<string | null>(null)

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
  const modelLabel = labelOf(status, effective)

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
          <span className="t-meta ml-auto hidden min-w-0 items-center gap-1 text-violet-700 lg:inline-flex" data-testid="ai-assist-model-chip">
            <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
            {modelLabel}
          </span>
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
          onClose={() => {
            setOpen(false)
            setPendingRun(null)
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

function labelOf(status: AssistStatus | null, c: AiChoice): string {
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
  onClose,
}: {
  onSaveItem?: (item: AssistItem, assistId: string) => Promise<boolean>
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

  const run = useCallback(
    async (preset: AssistPreset, askText = '') => {
      if (running) return
      setRunning(preset.id)
      setError(null)
      try {
        const bundle = await Promise.resolve(build())
        const json = JSON.stringify(bundle.context)
        const hash = contextHash(json)
        setNowHash(hash)
        const runResult: AssistRun = await callAssist({ requestId: newRequestId(), assistId: preset.id, page, choice: choice ?? (status ? status.defaultChoice : null), context: bundle.context, ask: askText })
        const entry = { scope, assistId: preset.id, label: preset.label, ask: askText, hash, run: runResult, links: bundle.links }
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

            <ModelRow status={status} effective={effective} choice={choice} open={settings} setOpen={setSettings} setChoice={setChoice} loadStatus={loadStatus} />

            {error && <ErrorBox error={error} />}

            {running && !shown && (
              <div className="flex items-center gap-2 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-3" data-testid="ai-assist-running">
                <Loader2 aria-hidden="true" className="size-4 animate-spin text-violet-700" />
                <span className="t-body text-violet-900">화면 자료를 보내고 답을 기다리는 중…(보통 5~20초)</span>
              </div>
            )}

            {shown && (
              <div ref={resultRef} className="scroll-mt-2">
                <ResultView entry={shown} stale={stale} running={!!running} onClose={onClose} onSaveItem={onSaveItem} onSaved={(ok) => showToast(ok ? '보관함에 저장했어요 — 화면 아래 보관함에 쌓여요' : '저장하지 못했어요. 다시 눌러 주세요.')} onRerun={() => {
                  const p = presets.find((x) => x.id === shown.assistId)
                  if (p) void run(p, shown.ask)
                }} onCopied={() => showToast('복사했어요')} />
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

function ModelRow({
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
        <span className="t-sub min-w-0 font-semibold break-keep text-slate-900" data-testid="ai-assist-model-label">
          {current}
          {isDefault && <span className="t-meta ml-1 font-normal text-slate-500">(기본 · 가장 쌈)</span>}
        </span>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap t-sub ml-auto inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50" data-testid="ai-assist-model-toggle">
          <Settings2 aria-hidden="true" className="size-4" /> {open ? '닫기' : '모델 바꾸기'}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 px-3 py-3" data-testid="ai-assist-settings">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="AI 회사">
            {(['gemini', 'openai', 'anthropic'] as ProviderId[]).map((id) => {
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
          <p className="t-meta break-keep text-slate-500">고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 도우미에 쓰여요. AI 작업실은 같은 회사의 빠르게 · 보통 · 깊게 모델을 일에 맞춰 씁니다.</p>
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
  if (error.code === 'db_setup_needed') how = <>Supabase SQL Editor 에서 0021(AI 작업실 권한) 을 한 번 실행하면 됩니다 — docs/OWNER_AI_WORKSPACE_V1.md §12.</>
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

function ResultView({ entry, stale, running, onRerun, onClose, onCopied, onSaveItem, onSaved }: { entry: NonNullable<Shown>; stale: boolean; running: boolean; onRerun: () => void; onClose: () => void; onCopied: () => void; onSaveItem?: (item: AssistItem, assistId: string) => Promise<boolean>; onSaved: (ok: boolean) => void }) {
  const { run } = entry
  const a = run.structured
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
                {it.ref && entry.links[it.ref] && (/^https:\/\//.test(entry.links[it.ref]) ? (
                  <a href={entry.links[it.ref]} target="_blank" rel="noopener noreferrer" className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="ai-assist-ref">
                    영상 열기 ↗
                  </a>
                ) : (
                  <Link to={entry.links[it.ref]} onClick={onClose} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="ai-assist-ref">
                    열어 보기 →
                  </Link>
                ))}
              </li>
            ))}
          </ol>
          {a.next && a.next.length > 0 && (
            <div className="flex flex-col gap-1 rounded-(--radius-control) bg-violet-50 px-3 py-2.5">
              <p className="t-sub font-semibold text-violet-900">바로 할 일</p>
              <ul className="flex flex-col gap-0.5">
                {a.next.map((n, i) => (
                  <li key={i} className="t-body flex gap-1.5 break-keep text-violet-950">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet-700" />
                    {n}
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
          <p className="t-body break-keep whitespace-pre-line text-slate-900">{run.raw}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={async () => {
            if (await copy(answerText(a, run.raw))) onCopied()
          }}
          className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          data-testid="ai-assist-copy"
        >
          <Copy aria-hidden="true" className="size-4" /> 전체 복사
        </button>
        <button type="button" disabled={running} onClick={onRerun} className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-violet-300 bg-white px-2.5 font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60" data-testid="ai-assist-rerun">
          <RefreshCw aria-hidden="true" className={`size-4 ${running ? 'animate-spin' : ''}`} /> 다시 만들기
        </button>
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
