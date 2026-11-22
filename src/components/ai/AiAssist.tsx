/**
 * AI 도우미 (D-239) — 화면마다 '이 화면이 왜 있는가' 에 맞춘 질문 단추. 타자 없이 눌러서 묻는다.
 *
 *   bar    화면 위 보라색 띠: [AI 도우미] + 자주 쓰는 질문 단추 2~3개(누르면 바로 답) · 고른 모델
 *   button 머리줄 단추 하나 — 누르면 질문 단추 판
 *
 * 누르면 그 화면 자료를 작은 묶음으로 만들어(사람 이름 · 연락처 빼고) 서버 함수(/api/ai-assist)로 보낸다.
 * 브라우저는 AI 공급자를 직접 부르지 않는다. 대표 계정에서만 보인다(팀장 화면 · 팀장 보기에는 없음).
 * 기본 모델은 Gemini 의 가장 싼 모델 — 판 안 '모델 바꾸기' 에서 GPT · Claude 로 바꿀 수 있다(이 브라우저에 기억).
 * D-629 대표 화면의 기본은 '자동' — 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델(요청마다 callAssist 가 정한다). 고른 모델이 있으면 그 모델 그대로.
 *
 * D-241 답은 다음 단계로 이어진다 — 대표: "열어보기를 누르면 진짜 뭔가 열리던지 뭔가 기록이 되든지 해야".
 *   - 번호 단추는 무엇이 열리는지 이름으로(업체 열기 · 공고 보기 …). 지금 보고 있는 화면과 같으면 내지 않는다.
 *   - [할 일로 넣기] — 업무 일기 할 일로(업체 번호면 그 업체에 · 언제가 있으면 그날 기한) → 오늘 · 달력에 보인다.
 *   - 화면이 붙이는 단추(itemActions · resultActions) — 예: 마케팅 [내 콘텐츠에 담기] · [이 기획으로 대본 끝까지].
 *   - [더 잘 쓰는 모델로 다시] — 같은 회사의 한 단계 위 모델로 이번 한 번만.
 *
 * D-628 PC(1024~)에서는 판이 화면을 덮지 않고 오른쪽 판(SideDock)의 [대화] 자리에 뜬다 — 가운데 화면을 보면서 묻는다.
 *   - 화면 머리의 도우미(inline 이 아닌 것)는 그 화면의 대화창으로 알린다: 그 화면에 다른 대화창이 없으면 오른쪽 판을 열 때 이 도우미가 보인다.
 *   - dock="auto"(마케팅 유튜브 · 스레드 · 릴스) — 붙일 폭이 되면 저절로 열리고 오른쪽 끝 [대화] 단추가 생긴다. 처음은 [대화 시작] 카드.
 *   - 휴대폰 · 창 · 카드 안(inline)은 예전처럼 아래에서 올라오는 판.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { InPageTools, MENU_ROW, useInPageTools } from '../layout/PageTools'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ClipboardList, Copy, ExternalLink, History, Loader2, RefreshCw, Send, Settings2, Sparkles, Wand2, X } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useAiAssistAccess } from '../../auth/ownerAiAccess'
import { todayLocalDate } from '../../lib/appClock'
import { useBackToClose } from '../../lib/backToClose'
import { useEscToClose } from '../../lib/escStack'
import { createJournalEntry } from '../../services/journalService'
import { betterModel, dueFromWhen, isSamePage, pointsAtTodo, refKind, refLabel, todoText, unalias, unaliasAnswer } from '../../services/aiAssist/actions'
import { AssistError, PROVIDER_NAME, assistMessage, callAssist, cutOff, fetchAssistStatus, peekAssistStatus, providerMessage, type ProviderProbe } from '../../services/aiAssist/client'
import type { AssistAnswer, AssistItem, AssistRun, AssistStatus, ModelInfo, ProviderId } from '../../services/aiAssist/client'
import { ASK_MAX_CHAT, aliasText, normRef, safeText } from '../../services/aiAssist/context'
import type { AssistBundle } from '../../services/aiAssist/context'
import { askPresetOf, presetsFor } from '../../services/aiAssist/presets'
import type { AssistPage, AssistPreset } from '../../services/aiAssist/presets'
import { CHOICE_EVENT, contextHash, historyOf, markDone, newRequestId, readChoice, saveChoice, allowedProviders, isCheapOnly, addPending, removePending, pendingFor, pushHistoryIfOwner, currentOwner, autoUpgradeAllowed } from '../../services/aiAssist/store'
import { resumeOnce } from '../../services/aiAssist/resume'
import { CUT_NOTE, answerOf, chatAnswerOf } from '../../services/aiAssist/looseJson'
import { askCarry, type AiChoice, type FollowMeta, type HistoryEntry } from '../../services/aiAssist/store'
import { classifyAsk } from '../../services/aiAssist/autoModel'
import { autoPlanFor, showsAuto, useLastAutoPick } from '../../lib/modelPickPref'
import { useToast } from '../ui/toastContext'
import { ModelPicker } from './ModelPicker'
import { josa } from '../../lib/josa'
import { ChatStartCard, PageChat } from '../chat/PageChat'
import { CHAT_TINT, closeAssistInDock, closePageDock, nextPageChatKey, openAssistInDock, startPageChat, usePageChat } from '../../lib/pageChat'
import { BotAvatar, BotBubble, BotRow, ChatNotice, MeBubble, TypingBubble } from '../chat/bubbles'
import { chatDay, chatDayKey, chatDayLine, chatStamp, chatTime } from '../../lib/chatTime'
import { ChatTextSize } from '../chat/ChatTextSize'
import { useChatAutoOpen } from '../../lib/useChatFirst'

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

/** D-299 직접 묻기 칸의 예 — 마케팅 화면은 그 화면에 맞는 질문으로(업체 질문 예가 엉뚱해 보이지 않게) */
const ASK_EXAMPLE: Partial<Record<AssistPage, string>> = {
  threads: '예: 이 소재로 팔로워 모으기 좋은 첫 줄 3개만',
  shorts: '예: 이 대본을 릴스 20초로 줄이면?',
  radar: '예: 이번 주 1순위로 쇼츠 제목 3개만',
  content: '예: 블로그 제목에 지역 이름을 넣어 다시',
  site: '예: 첫 화면 큰 문구를 더 짧게 세 가지',
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
  /**
   * D-618 직접 물어본 질문 위에 고정해 보여 줄 칸 — 그 화면이 규칙으로 이미 아는 답(예: 물어본 모듈의 OS 판정 · 모듈 화면과 같은 글).
   * AI 답을 기다리는 동안에도 바로 보이고, AI 답은 그 아래에 온다. 보여 줄 것이 없으면 null.
   */
  pin?: (ask: string) => ReactNode
  /** D-627 [⋯] 이 화면 도구로 보내지 않고 그 자리에(창 · 카드 안처럼 화면 머리가 아닌 곳) */
  inline?: boolean
  /** D-628 'auto' — 이 화면의 대화창으로(붙일 폭이 되면 오른쪽 판이 저절로 열리고 · 오른쪽 끝 [대화] 단추) */
  dock?: 'auto'
}

export function AiAssist(props: AiAssistProps) {
  // D-257 팀장도 띠가 보인다(Gemini 만) — AI 전략실은 따로(대표만)
  const access = useAiAssistAccess()
  if (access === 'no') return null
  return <AiAssistInner {...props} />
}

/** D-288 [직접 묻기] 로 열 때 — 단추를 누르지 않고 질문 칸에 바로 */
const ASK_FIRST = '__ask'

function AiAssistInner({ page, scope, title, presets, build, variant = 'bar', quick = 3, label = 'AI 도우미', className = '', onSaveItem, itemActions, resultActions, record, onRecorded, defaultClientId, pin, inline = false, dock }: AiAssistProps) {
  const list = useMemo(() => presetsFor(presets), [presets])
  const key = scope ?? page
  const [open, setOpen] = useState(false)
  // D-628 오른쪽 판에 알리는 번호 · 판 안에서 단추로 다시 열 때마다 올리는 수(같은 판이 살아 있어도 고른 질문을 다시 받게)
  const dockKey = useRef(0)
  if (!dockKey.current) dockKey.current = nextPageChatKey()
  const [runTick, setRunTick] = useState(0)
  const autoPref = useChatAutoOpen()
  // D-629 다른 AI 단추가 이미 받아 둔 서버 모델 목록이 있으면 그것부터(판을 열자마자 '자동' 이 어느 모델인지 보이게)
  const [status, setStatus] = useState<AssistStatus | null>(() => peekAssistStatus())
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

  const loadStatus = useCallback(async (withModels = false, probe = false) => {
    try {
      const s = await fetchAssistStatus(withModels, probe)
      setStatus(s)
      return s
    } catch {
      return null
    }
  }, [])

  const effective: AiChoice = choice ?? status?.defaultChoice ?? FALLBACK_DEFAULT

  const openWith = (id: string | null) => {
    setPendingRun(id)
    setRunTick((t) => t + 1)
    // D-628 PC — 화면을 덮지 않고 오른쪽 판에(화면 머리의 도우미만 · 창 · 카드 안은 예전 판)
    if (!inline && openAssistInDock(dockKey.current)) return
    setOpen(true)
  }
  const panelProps = {
    page,
    scope: key,
    title,
    presets: list,
    build,
    status,
    loadStatus,
    choice,
    effective,
    setChoice: (c: AiChoice | null) => {
      setChoice(c)
      saveChoice(c)
    },
    autoRun: pendingRun,
    autoTick: runTick,
    onSaveItem,
    itemActions,
    resultActions,
    record: record ?? RECORD_PAGES.has(page),
    defaultClientId,
    pin,
    onRecorded: () => {
      recorded.current = true
    },
  }
  const afterClose = () => {
    setPendingRun(null)
    if (recorded.current) {
      recorded.current = false
      onRecorded?.()
    }
  }

  // D-627 화면 글자 수 한도 — 띠 · 단추는 경로 줄 오른쪽 [⋯] 이 화면 도구 안으로(질문 칩 · 직접 묻기도 메뉴 줄로). inline 이면 예전처럼 그 자리에
  const entry = (
    <AssistEntry
      inline={inline}
      // D-627 [⋯] 안 — 띠였던 것은 예전 이름 그대로(ai-assist-bar), 머리 단추였던 것은 ai-assist-menu
      testId={variant === 'bar' ? 'ai-assist-bar' : 'ai-assist-menu'}
      title={title}
      label={label}
      list={list.slice(0, quick)}
      ask={!!askPresetOf(page)}
      onOpen={openWith}
      askId={ASK_FIRST}
      original={
        <>
      {variant === 'bar' ? (
        <section
          aria-label="AI 도우미"
          data-testid="ai-assist-bar"
          data-ai-assist="bar"
          // D-478 휴대폰은 띠가 세 줄(약 160px)로 쌓였다 — 한 줄 가로 넘김(PC 는 그대로 줄바꿈)
          className={`flex min-w-0 flex-wrap items-center gap-2 rounded-(--radius-panel) border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50 px-3 py-2.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] ${className}`}
        >
          <OpenButton label={label} onClick={() => openWith(null)} />
          {list.slice(0, quick).map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-testid="ai-assist-chip"
              data-assist={p.id}
              onClick={() => openWith(p.id)}
              className={`tap t-sub min-h-10 max-w-full min-w-0 items-center rounded-full border border-violet-300 bg-white px-3 py-1.5 text-left font-semibold break-keep text-violet-900 hover:bg-violet-100 max-sm:max-w-none max-sm:shrink-0 max-sm:whitespace-nowrap ${i === 0 ? 'inline-flex' : 'hidden sm:inline-flex'}`}
            >
              {p.label}
            </button>
          ))}
          {/* D-288 단추에 없는 것 — 판을 열고 질문 칸에 바로 */}
          {askPresetOf(page) && (
            <button
              type="button"
              data-testid="ai-assist-ask-chip"
              onClick={() => openWith(ASK_FIRST)}
              className="tap t-sub inline-flex min-h-10 max-w-full min-w-0 items-center gap-1 rounded-full border border-dashed border-violet-400 bg-white px-3 py-1.5 font-semibold break-keep text-violet-800 hover:bg-violet-100 max-sm:max-w-none max-sm:shrink-0 max-sm:whitespace-nowrap"
            >
              직접 묻기
            </button>
          )}
          {/* D-255 대표 "곳곳에 제미나이 3.1 플래시 라이트만 — 어디서든 내가 원하는 모델로": 이름만 보이던 칩 → 누르면 고르는 단추 */}
          {/* D-375 휴대폰은 띠가 세 줄이 되어 목록이 밀렸다 — 모델 고르기는 판 안(모델 줄)에서. PC 는 그대로 띠에 */}
          <ModelPicker popover className="ml-auto max-sm:hidden" testId="ai-assist-model-chip" />
        </section>
      ) : (
        <OpenButton label={label} onClick={() => openWith(null)} className={className} />
      )}
        </>
      }
    />
  )

  return (
    <>
      {entry}
      {/* D-627 판은 문서 맨 끝에(포털) — 머리 칸 · [⋯] 안에서 열어도 뒤 화면(카드 · 영업 보드)이 판 위로 올라오지 않게 */}
      {open && createPortal(
        <AssistPanel
          {...panelProps}
          onClose={() => {
            setOpen(false)
            afterClose()
          }}
        />,
        document.body,
      )}
      {/* D-628 PC — 오른쪽 판의 [대화] 자리에(화면 머리의 도우미만). 한 번 보인 뒤에는 닫아도 살아 있다(답을 기다리던 질문이 끊기지 않게) */}
      {!inline && (
        <PageChat entryKey={dockKey.current} scope={`assist:${key}`} kind="assist" auto={dock === 'auto' && autoPref} launcher={dock === 'auto'} openPhone={() => openWith(null)}>
          <AssistDock entryKey={dockKey.current} chatScope={`assist:${key}`} historyScope={key} title={title} panelProps={panelProps} afterClose={afterClose} />
        </PageChat>
      )}
    </>
  )
}

type PanelProps = Omit<Parameters<typeof AssistPanel>[0], 'onClose' | 'docked' | 'explicit'>

/**
 * D-628 오른쪽 판 안의 도우미 — 처음(지난 답 없음 · 저절로 열림)은 가벼운 시작 카드, [대화 시작] 을 누르거나 [⋯] 에서 눌러 열었으면 질문 판.
 */
function AssistDock({ entryKey, chatScope, historyScope, title, panelProps, afterClose }: { entryKey: number; chatScope: string; historyScope: string; title: string; panelProps: PanelProps; afterClose: () => void }) {
  const pc = usePageChat()
  const explicit = pc.explicit === entryKey
  const [hadHistory] = useState(() => historyOf(historyScope).length > 0)
  const [begun, setBegun] = useState(false)
  const started = begun || explicit || hadHistory || pc.started.includes(chatScope)
  if (started && !begun) setBegun(true)
  if (!started) return <ChatStartCard sub="이 화면 자료로 AI가 답해요" hint={`AI 도우미 · ${title}`} onStart={() => startPageChat(chatScope)} />
  return (
    <AssistPanel
      {...panelProps}
      docked
      explicit={explicit}
      onClose={() => {
        // 눌러서 연 것이면 그 화면 대화창으로 돌아가고(없으면 판을 닫는다), 그 화면의 대화창으로 떠 있던 것이면 판을 닫는다
        if (explicit) closeAssistInDock(entryKey)
        else closePageDock()
        afterClose()
      }}
    />
  )
}

/** D-627 [⋯] 메뉴 안이면 메뉴 줄(AI 도우미 · 질문 · 직접 묻기), 아니면 예전 띠 · 단추 */
function AssistEntry({ inline, title, label, list, ask, onOpen, askId, original, testId }: { inline: boolean; title: string; label: string; list: AssistPreset[]; ask: boolean; onOpen: (id: string | null) => void; askId: string; original: ReactNode; testId: string }) {
  return (
    <InPageTools inline={inline}>
      <AssistMenuOrOriginal title={title} label={label} list={list} ask={ask} onOpen={onOpen} askId={askId} original={original} testId={testId} />
    </InPageTools>
  )
}

function AssistMenuOrOriginal({ title, label, list, ask, onOpen, askId, original, testId }: { title: string; label: string; list: AssistPreset[]; ask: boolean; onOpen: (id: string | null) => void; askId: string; original: ReactNode; testId: string }) {
  const inMenu = useInPageTools()
  if (!inMenu) return <>{original}</>
  return (
    <div className="flex flex-col gap-0.5" data-ai-assist="menu" data-testid={testId}>
      <button type="button" data-testid="ai-assist-open" data-ai-assist="open" data-guide="fn-ai-assist" onClick={() => onOpen(null)} className={`${MENU_ROW} text-violet-800 hover:bg-violet-50`}>
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-violet-600" />
        <span className="min-w-0 flex-1">
          {label}
          {title ? <span className="t-meta block truncate font-normal text-slate-500">{title}</span> : null}
        </span>
      </button>
      {list.map((p) => (
        <button key={p.id} type="button" data-testid="ai-assist-chip" data-assist={p.id} onClick={() => onOpen(p.id)} className={`${MENU_ROW} pl-9 font-normal text-slate-700`}>
          {p.label}
        </button>
      ))}
      {ask && (
        <button type="button" data-testid="ai-assist-ask-chip" onClick={() => onOpen(askId)} className={`${MENU_ROW} pl-9 font-normal text-violet-800`}>
          직접 묻기
        </button>
      )}
      {/* D-255 어디서든 모델 고르기 — 메뉴 안에서 고르는 동안 메뉴는 열려 있다(data-menu-keep) */}
      <div data-menu-keep className="px-3 py-1 max-sm:hidden">
        <ModelPicker popover testId="ai-assist-model-chip" />
      </div>
    </div>
  )
}

function OpenButton({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      data-testid="ai-assist-open"
      data-ai-assist="open"
      data-guide="fn-ai-assist"
      onClick={onClick}
      className={`tap t-body inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-1.5 font-semibold whitespace-nowrap text-white shadow-sm hover:from-violet-700 hover:to-fuchsia-700 sm:min-h-10 ${className}`}
    >
      <Sparkles aria-hidden="true" className="size-4 shrink-0" />
      {label}
    </button>
  )
}

/** 서버 목록이 아직 없으면 모델 이름을 읽기 좋게('gemini-3.1-flash-lite' → 'Gemini 3.1 Flash Lite') */
// W7(D-644) 모델 이름은 modelLabel.ts — 모델 고르기 단추(앱 뼈대)가 이 큰 파일을 끌어오지 않게(여기서 다시 내보냄)
import { labelOf, prettyModel } from './modelLabel'
export { labelOf, prettyModel }


/* ------------------------------------------------------------------ */
/* 판                                                                    */
/* ------------------------------------------------------------------ */

/**
 * D-634 판 = 카카오톡 같은 대화 — 대표: "대화가 핑퐁 하듯이 · 지난 답은 따로 버튼으로 · 1번 2번 3번은 접혀서".
 *   맨 위   머리(제목 · [지난 대화 n] · 닫기) + 쓰는 모델 한 줄
 *   가운데 대화 — AI 인사 말풍선 + 질문 단추(빠른 답장) → 내 말풍선(오른쪽) → AI 말풍선(왼쪽 · 항목은 접힌 채)
 *   맨 아래 질문창(Enter 로 보내기) · 고른 단추 확인 줄
 * 이 판에서 주고받은 것만 대화에 쌓인다 — 지난 대화는 머리 [지난 대화] 에서 골라 다시 본다.
 */
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
  autoTick = 0,
  onSaveItem,
  itemActions,
  resultActions,
  record,
  defaultClientId,
  pin,
  onRecorded,
  onClose,
  docked = false,
  explicit = false,
}: {
  /** D-628 오른쪽 판 안(화면을 덮지 않는다 · 뒤 화면을 그대로 쓴다) */
  docked?: boolean
  /** D-628 판 안에서 — [⋯] 로 눌러 연 것인가(Esc 로 닫힌다) */
  explicit?: boolean
  /** 같은 판이 살아 있는 채 단추로 다시 열 때마다 달라지는 수 */
  autoTick?: number
  pin?: (ask: string) => ReactNode
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
  useBackToClose(!docked, onClose)
  useEscToClose(!docked || explicit, onClose)
  const { showToast } = useToast()
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<{ code: string; message: string; missing: string[]; ref?: string } | null>(null)
  // D-634 이 판에서 주고받은 대화(오래된 것 먼저). 맨 끝이 지금 답 — 판을 새로 열면 새 대화(지난 대화는 머리 [지난 대화])
  const [turns, setTurns] = useState<NonNullable<Shown>[]>([])
  // 보내는 중(또는 못 받은) 질문 — 답을 기다리는 동안 내 말풍선으로 먼저 보인다
  const [asking, setAsking] = useState<{ preset: AssistPreset; label: string; ask: string; at: string; opts: { choice?: AiChoice; follow?: FollowMeta } } | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(() => historyOf(scope))
  const [historyOpen, setHistoryOpen] = useState(false)
  const [ask, setAsk] = useState('')
  // D-626 [새로 묻기] 를 누른 때 — 그 앞의 질문은 이어받지 않는다
  const [carryFrom, setCarryFrom] = useState('')
  const carryFromRef = useRef('')
  // D-288 적은 질문은 기본으로 '직접 질문'(이 화면 자료로 그 질문에만 답) — 예전에는 첫 단추(예: 이번 주 일정 한눈에)에 묶여 그 단추 답만 나왔다
  const askDirect = useMemo(() => askPresetOf(page), [page])
  const DIRECT = '__direct'
  const [askPreset, setAskPreset] = useState(askDirect ? DIRECT : (presets[0]?.id ?? ''))
  const askRef = useRef<HTMLTextAreaElement | null>(null)
  // D-289 단추를 한 번 누르면 고르기만 — 아래 [이대로 질문하기] 를 눌러야 AI 를 부른다(잘못 눌러 바로 도는 일 없게)
  const [pending, setPending] = useState<{ preset: AssistPreset; ask: string; opts: { choice?: AiChoice; follow?: FollowMeta }; label: string } | null>(null)
  const [settings, setSettings] = useState(false)
  const [nowHash, setNowHash] = useState<string | null>(null)
  // 지금 답(또는 보내는 질문)의 첫 줄 — 답이 오면 내 질문부터 보이게 그 자리로
  const turnRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const startedTick = useRef(-1)
  const live = turns.length ? turns[turns.length - 1] : null

  // 화면을 덮는 판일 때만 뒤 화면 굴리기를 막는다(오른쪽 판 안에서는 가운데 화면을 그대로 쓴다)
  useEffect(() => {
    if (docked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [docked])

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

  const toEnd = () => window.setTimeout(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 40)
  const toTurn = () => window.setTimeout(() => turnRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 40)

  /**
   * opts.choice — 이번 한 번만 다른 모델(더 잘 쓰는 모델로 다시) · opts.follow — 고른 항목을 자료 맨 앞에 붙여 이어 쓰기.
   * D-629 고른 모델이 없으면(자동) 그대로 null 을 넘긴다 — 물음인지 일인지 보고 callAssist 가 모델을 정한다.
   * 지문(hash)은 화면 자료로만 — 이어 쓴 답도 '화면 자료가 바뀌었어요' 를 같은 기준으로 판단한다.
   */
  const run = useCallback(
    async (preset: AssistPreset, askText = '', opts: { choice?: AiChoice; follow?: FollowMeta; before?: string } = {}) => {
      if (running) return
      setRunning(preset.id)
      setError(null)
      // D-244 직접 적은 질문도 보내기 전에 가린다(연락처 · 이메일 · 주민번호) — 지난 답에도 가린 글만 남긴다
      const masked = askText ? safeText(askText, [], ASK_MAX_CHAT) : ''
      const label = opts.follow ? `${preset.label} · ${opts.follow.title}` : preset.id.endsWith('.ask') ? '직접 물어본 것' : preset.label
      setAsking({ preset, label, ask: masked, at: new Date().toISOString(), opts })
      toEnd()
      // NX-2 실패하면 이 번호 끝 6자리를 '문의 번호' 로 보여 준다(서버 함수 기록과 같은 번호)
      const requestId = newRequestId()
      try {
        const bundle = await Promise.resolve(build())
        const hash = contextHash(JSON.stringify(bundle.context))
        setNowHash(hash)
        // D-626 직접 물어보기는 이어서 — 이 화면에서 방금 주고받은 것을 '앞선 대화' 로 같이 보낸다(단추 · 이어 쓰기는 그대로)
        // D-638 [다시 만들기] 는 다시 만드는 그 답 · 그 뒤 것은 빼고 보낸다(같은 답을 되풀이하지 않게)
        const carry = !opts.follow && preset.id.endsWith('.ask') ? askCarry(historyOf(scope), carryFromRef.current, Date.now(), opts.before ?? '') : []
        const context = opts.follow ? { ...bundle.context, sections: [opts.follow.section, ...bundle.context.sections] } : carry.length ? { ...bundle.context, sections: [{ name: '앞선 대화', rows: carry }, ...bundle.context.sections] } : bundle.context
        // D-638 묻는 중을 적어 둔다 — 판을 닫거나 다른 화면으로 가도(휴대폰이 탭을 버려도) 다시 열면 이 번호로 답을 받아 온다
        const owner = currentOwner()
        const meta = { scope, assistId: preset.id, label, ask: masked, hash, links: bundle.links, ids: bundle.ids ?? {}, ...(bundle.aliases ? { aliases: bundle.aliases } : {}), ...(opts.follow ? { follow: opts.follow } : {}) }
        addPending({ ...meta, rid: requestId })
        let runResult: AssistRun
        try {
          // D-638 물음 속 사람 이름도 화면 자료와 같은 별칭으로 보낸다(답은 보여 줄 때 되돌림)
          runResult = await callAssist({ requestId, assistId: preset.id, page, choice: opts.choice ?? choice, context, ask: aliasText(masked, bundle.aliases) })
        } finally {
          removePending(requestId)
        }
        const entry: HistoryEntry & { links: Record<string, string> } = { ...meta, run: runResult, links: bundle.links }
        // D-638 묻는 사이 계정이 바뀌었으면 지난 답에 넣지 않는다(다른 사람 기록에 섞이지 않게)
        if (!pushHistoryIfOwner(entry, owner)) return
        setHistory(historyOf(scope))
        setTurns((t) => [...t.filter((x) => x.run.requestId !== entry.run.requestId), entry])
        setAsking(null)
        // 내 질문부터(D-618 판정 줄 → AI 답 순서로 읽히게)
        toTurn()
      } catch (e) {
        const ref = requestId.slice(-6)
        if (e instanceof AssistError) setError({ code: e.code, message: e.message, missing: e.missing, ref })
        else setError({ code: 'provider_error', message: assistMessage('provider_error'), missing: [], ref })
        toEnd()
      } finally {
        setRunning(null)
      }
    },
    [running, build, page, choice, scope],
  )

  /** 판의 단추에 없는 질문(이어 쓰기 전용 — 예: 대본 끝까지)도 찾는다 */
  const presetOf = useCallback((id: string) => presets.find((x) => x.id === id) ?? presetsFor([id])[0], [presets])

  /** D-289 바로 부르지 않고 '이대로 질문하기' 를 기다린다 */
  const request = useCallback((preset: AssistPreset, label: string, ask = '', opts: { choice?: AiChoice; follow?: FollowMeta; before?: string } = {}) => {
    setPending({ preset, ask, opts, label })
  }, [])
  const confirmPending = () => {
    const p = pending
    if (!p || running) return
    setPending(null)
    void run(p.preset, p.ask, p.opts)
  }

  const rerun = useCallback(
    (entry: NonNullable<Shown>, choiceOverride?: AiChoice, betterLabel?: string) => {
      const p = presetOf(entry.assistId)
      if (p) request(p, betterLabel ? `${entry.label} — ${betterLabel} 로 다시` : `${entry.label} — 다시 만들기`, entry.ask, { choice: choiceOverride, follow: entry.follow, before: entry.run.createdAt })
    },
    [presetOf, request],
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
        if (p) request(p, `${p.label} · ${meta.title}`, '', { follow: meta })
      },
      close: onClose,
    }),
    [presetOf, request, onClose],
  )

  const better = useMemo(() => (live ? betterModel(status, live.run) : null), [status, live])

  // D-244 할 일로 넣은 항목을 지난 답에 적었으면 목록 · 대화 속 답을 새것으로(다시 눌러도 같은 할 일이 두 번 안 생기게)
  const onMarked = useCallback(
    (updated: HistoryEntry) => {
      setHistory(historyOf(scope))
      setTurns((ts) => ts.map((s) => (s.run.requestId === updated.run.requestId ? { ...s, done: updated.done } : s)))
    },
    [scope],
  )

  // D-638 이 화면에서 답을 기다리다 판을 닫았던 것 — 다시 열면 그 번호로 받아 와 지난 답 · 대화에 넣는다(AI 다시 안 부름)
  useEffect(() => {
    const waiting = pendingFor(scope)
    if (!waiting.length) return
    let alive = true
    void (async () => {
      for (const p of waiting) {
        const got = await resumeOnce(p.rid)
        if (got === 'pending') continue
        removePending(p.rid)
        if (!got) continue
        const { rid: _rid, at: _at, owner, ...meta } = p
        const entry: HistoryEntry & { links: Record<string, string> } = { ...meta, run: got, links: meta.links ?? {} }
        if (!pushHistoryIfOwner(entry, owner)) continue
        if (!alive) continue
        setHistory(historyOf(scope))
        setTurns((t) => [...t.filter((x) => x.run.requestId !== got.requestId), entry])
      }
    })()
    return () => {
      alive = false
    }
  }, [scope])

  // 띠의 질문 단추로 열었으면 그 단추를 골라 둔다(한 번만) · D-288 [직접 묻기] 로 열었으면 질문 칸에 바로 쓰게
  useEffect(() => {
    if (!autoRun || startedTick.current === autoTick) return
    startedTick.current = autoTick
    if (autoRun === ASK_FIRST) {
      window.setTimeout(() => askRef.current?.focus(), 60)
      return
    }
    // D-289 띠의 단추로 열어도 고르기만 — [이대로 질문하기] 를 눌러야 부른다
    const p = presets.find((x) => x.id === autoRun)
    if (p) request(p, p.label)
  }, [autoRun, autoTick, presets, request])

  // D-626 다음 질문에 같이 갈 앞 질문 수(이 화면 · 6시간 안 · [새로 묻기] 뒤)
  const carryCount = useMemo(() => askCarry(history, carryFrom).length, [history, carryFrom])

  const sendAsk = () => {
    const text = ask.trim()
    if (!text || running) return
    const p = askPreset === DIRECT ? askDirect : (presets.find((x) => x.id === askPreset) ?? presets[0])
    if (!p) return
    // 카카오톡처럼 — 보내면 질문창은 비고 내 말풍선으로 올라간다(못 받으면 그 말풍선 옆 [다시 보내기])
    setAsk('')
    void run(p, text)
  }

  /** 지난 대화에서 하나 고르면 — 대화 맨 끝으로 가져와 지금 답으로 */
  const reopen = (h: HistoryEntry) => {
    setTurns((t) => [...t.filter((x) => x.run.requestId !== h.run.requestId), { ...h, links: h.links ?? {} }])
    setHistoryOpen(false)
    if (!running) {
      setAsking(null)
      setError(null)
    }
    toTurn()
  }

  const stale = !!live && !!nowHash && live.hash !== nowHash

  // D-629 [이대로 질문하기] 전에 어느 모델로 물을지 — 자동이면 이 단추가 물음인지 일인지에 따라(가장 싼 모델 · 좋은 모델)
  const pendingModel = useMemo(() => {
    if (!pending) return ''
    if (pending.opts.choice || choice) return labelOf(status, pending.opts.choice ?? effective)
    const plan = autoPlanFor(status)
    if (!plan?.upgrades) return labelOf(status, effective)
    return `자동 · ${labelOf(status, classifyAsk({ assistId: pending.preset.id, ask: pending.ask }) === 'heavy' ? plan.heavy : plan.light)}`
  }, [pending, choice, status, effective])

  // D-618 판정 줄은 지금 질문 하나에만(보내는 중 · 못 받은 질문 · 지금 답)
  const focusAsk = asking ? asking.ask : (live?.ask ?? '')
  const pinNode = pin ? (
    <div className="scroll-mt-2 pl-10 empty:hidden" data-chat="pin">
      {pin(focusAsk)}
    </div>
  ) : null

  // 질문 단추 — 대화가 비면 인사 말풍선 아래, 대화가 있으면 맨 끝 답 아래(카카오톡 빠른 답장처럼 · 한 곳에만)
  const presetChips = (
    <div className="flex flex-col items-start gap-1.5 pl-10" data-chat="quick">
      {turns.length > 0 && <p className="t-meta text-slate-600">다른 것도 물어보세요</p>}
      <div className="flex max-w-full flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid="ai-assist-preset"
            data-assist={p.id}
            disabled={!!running}
            aria-pressed={pending?.preset.id === p.id && !pending.opts.follow}
            onClick={() => request(p, p.label)}
            title={p.hint}
            className={`tap t-sub inline-flex min-h-10 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left font-semibold break-keep disabled:cursor-wait ${pending?.preset.id === p.id && !pending.opts.follow ? 'border-violet-600 bg-violet-600 text-white' : live?.assistId === p.id ? 'border-violet-400 bg-white text-violet-900' : 'border-violet-200 bg-white text-violet-900 hover:bg-violet-50'}`}
          >
            {running === p.id ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" /> : null}
            <span className="min-w-0 [overflow-wrap:anywhere]">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const thread = (
    <div className="flex flex-col gap-4" data-testid="ai-assist-thread" data-turns={turns.length}>
      {/* 첫 말 — 무엇을 하는 곳인지 한 줄 + 질문 단추 */}
      <BotRow>
        <BotBubble first>
          <p className="t-body break-keep">
            {docked ? '무엇을 도와드릴까요?' : `무엇을 도와드릴까요? ${title} 자료로 답해요.`}
            <span className="t-sub block text-slate-600">단추를 고르거나 아래에 물어보세요</span>
          </p>
        </BotBubble>
      </BotRow>
      {turns.length === 0 && presetChips}
      <ChatNotice testId="ai-assist-note" title="보내는 것: 이 화면의 업체 · 일 · 숫자(사람 이름 · 연락처 · 주민번호 · 계좌는 빼고). AI 답은 틀릴 수 있어요 — 금액 · 날짜는 화면 숫자로 한 번 확인하세요.">
        이름 · 연락처는 빼고 보내요
      </ChatNotice>

      {turns.map((t, i) => {
        const isLive = i === turns.length - 1
        // D-638 날짜 줄(카카오톡처럼) — 앞 대화와 날이 다르거나 오늘이 아닌 지난 대화를 다시 열었을 때
        const day = chatDayKey(t.run.createdAt)
        const prevDay = i > 0 ? chatDayKey(turns[i - 1].run.createdAt) : chatDayKey(new Date())
        return (
          <LiveCtx.Provider key={t.run.requestId} value={isLive && !asking}>
            {day && day !== prevDay && <ChatNotice testId="ai-assist-day">{chatDayLine(t.run.createdAt)}</ChatNotice>}
            <div ref={isLive ? turnRef : undefined} className="flex scroll-mt-2 flex-col gap-3">
              <ResultView
                entry={t}
                stale={isLive && stale}
                last={isLive}
                running={!!running}
                onClose={onClose}
                onSaveItem={onSaveItem}
                onSaved={(ok) => showToast(ok ? '보관함에 저장했어요 — 화면 아래 보관함에 쌓여요' : '저장하지 못했어요. 다시 눌러 주세요.')}
                onRerun={() => rerun(t)}
                better={isLive ? better : null}
                onBetter={() => better && rerun(t, { provider: better.provider, model: better.model }, better.label)}
                onCopied={() => showToast('복사했어요')}
                ctx={ctxFor(t)}
                itemActions={itemActions?.(t.assistId) ?? []}
                resultActions={resultActions?.(t.assistId) ?? []}
                record={record}
                defaultClientId={defaultClientId}
                onRecorded={onRecorded}
                onMarked={onMarked}
                toast={showToast}
                pinNode={isLive && !asking ? pinNode : null}
              />
            </div>
          </LiveCtx.Provider>
        )
      })}

      {/* 보내는 중 · 못 받은 질문 — 내 말풍선 → (판정 줄) → 점 세 개 또는 오류 */}
      {asking && (
        <div className="flex flex-col gap-3" data-testid="ai-assist-asking">
          <MeBubble time={chatTime(asking.at)} testId={running ? undefined : 'ai-assist-failed-q'}>
            {myText(asking.label, asking.ask, asking.preset.id)}
          </MeBubble>
          {pinNode}
          {running ? (
            <TypingBubble testId="ai-assist-running" note={live ? `${presetOf(running)?.label ?? '답'} — 만드는 중…(긴 글은 20~60초)` : '화면 자료를 보내고 답을 기다리는 중…(보통 5~20초)'} />
          ) : (
            error && (
              <BotRow>
                <ErrorBox error={error} />
                <button
                  type="button"
                  onClick={() => void run(asking.preset, asking.ask, asking.opts)}
                  className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-full border border-violet-300 bg-white px-3 font-semibold text-violet-800 hover:bg-violet-50"
                  data-testid="ai-assist-retry"
                >
                  <RefreshCw aria-hidden="true" className="size-4" /> 다시 보내기
                </button>
              </BotRow>
            )
          )}
        </div>
      )}
      {!asking && error && <ErrorBox error={error} />}

      {turns.length > 0 && !asking && presetChips}
      <div ref={endRef} aria-hidden="true" />
    </div>
  )

  // 질문창 — 카카오톡처럼 맨 아래(이어서 묻기 한 줄 · 단추에 덧붙이기는 그 위 작은 줄)
  const composer = (
    <div className={`flex shrink-0 flex-col gap-1.5 border-t border-slate-200 bg-white pt-2 pb-2.5 ${docked ? 'px-3' : 'px-4'}`} data-testid="ai-assist-ask-box">
      {/* D-626 이어서 묻기 — 방금 주고받은 것을 같이 보낸다는 것을 보여 주고, 끊고 싶으면 [새로 묻기] */}
      {askPreset === DIRECT && carryCount > 0 && (
        <p className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1 break-keep text-violet-900" data-testid="ai-assist-carry">
          <span>이어서 묻기 — 방금 주고받은 {carryCount}개를 같이 보내요</span>
          <button
            type="button"
            className="tap t-meta rounded-full border border-violet-300 bg-white px-2.5 py-0.5 font-semibold text-violet-800 hover:bg-violet-50"
            onClick={() => {
              const at = new Date().toISOString()
              carryFromRef.current = at
              setCarryFrom(at)
            }}
            data-testid="ai-assist-carry-reset"
          >
            새로 묻기
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor={`ai-ask-${scope}`} className="sr-only">
          직접 물어보기 — 단추에 없는 것도 이 화면 자료로 답해요
        </label>
        <textarea
          id={`ai-ask-${scope}`}
          ref={askRef}
          value={ask}
          maxLength={ASK_MAX_CHAT}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => {
            // Enter = 보내기 · Shift+Enter = 줄바꿈(한글 조합 중에는 보내지 않음)
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              sendAsk()
            }
          }}
          rows={1}
          placeholder={ASK_EXAMPLE[page] ?? '예: 이번 달에 메모가 가장 많았던 업체는?'}
          className="t-body max-h-36 min-h-11 w-full min-w-0 flex-1 resize-none rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 [field-sizing:content] focus:bg-white"
          data-testid="ai-assist-ask"
        />
        <button
          type="button"
          disabled={!ask.trim() || !!running}
          onClick={sendAsk}
          aria-label={askPreset === DIRECT ? '물어보기' : '같이 보내기'}
          title={askPreset === DIRECT ? '물어보기(Enter)' : '고른 단추에 덧붙여 같이 보내기(Enter)'}
          className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-violet-700 px-3.5 font-semibold text-white hover:bg-violet-800 disabled:opacity-45"
          data-testid="ai-assist-ask-send"
        >
          <Send aria-hidden="true" className="size-4" />
          <span className={docked ? 'sr-only' : 'max-sm:sr-only'}>{askPreset === DIRECT ? '물어보기' : '같이 보내기'}</span>
        </button>
      </div>
      {/* 단추에 덧붙여 묻기 — 작은 한 줄(기본은 단추와 상관없이 직접 질문) */}
      <select
        aria-label="어떻게 물을까요"
        className="t-meta min-h-9 max-w-full min-w-0 self-start rounded-full border border-slate-200 bg-white px-2 text-slate-600"
        data-testid="ai-assist-ask-preset"
        value={askPreset}
        onChange={(e) => setAskPreset(e.target.value)}
      >
        {askDirect && <option value={DIRECT}>직접 질문 — 단추와 상관없이</option>}
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            ‘{p.label}’ 에 덧붙여 묻기
          </option>
        ))}
      </select>
    </div>
  )

  const confirmBar = (
    <>
      {/* D-289 고른 단추 확인 — 판 맨 아래에 늘 붙어 있다(어느 단추를 눌렀든 보이게). 이걸 눌러야 AI 를 부른다 */}
      {pending && (
        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-t border-violet-200 bg-violet-50 py-3 ${docked ? 'px-3' : 'px-5 sm:rounded-b-(--radius-panel)'}`} data-testid="ai-assist-confirm" data-assist={pending.preset.id}>
          <p className="t-sub min-w-0 flex-1 break-keep text-violet-950 [overflow-wrap:anywhere]">
            <b>‘{pending.label}’</b> — 이대로 물어볼까요?
            <span className="t-meta block text-violet-800" data-testid="ai-assist-confirm-model">{pendingModel} 로 · 화면 자료를 같이 보내요</span>
          </p>
          <button type="button" onClick={() => setPending(null)} className="tap t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="ai-assist-confirm-cancel">
            취소
          </button>
          <button type="button" disabled={!!running} onClick={confirmPending} className="tap t-body inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-4 font-semibold text-white hover:bg-violet-800 disabled:opacity-60" data-testid="ai-assist-confirm-go">
            <Sparkles aria-hidden="true" className="size-4" /> 이대로 질문하기
          </button>
        </div>
      )}
    </>
  )

  // 지난 대화 — 머리 단추로 여는 판(대화 위를 덮는다 · 고르면 대화 맨 끝으로)
  const historySheet = historyOpen && (
    <section aria-label="지난 대화" className="absolute inset-0 z-10 flex flex-col bg-white" data-testid="ai-assist-history">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1.5">
        <History aria-hidden="true" className="size-4 shrink-0 text-slate-600" />
        <p className="t-body min-w-0 grow font-bold text-slate-900">
          지난 대화 <span className="t-meta font-normal text-slate-500">· 이 브라우저에만</span>
        </p>
        <button type="button" onClick={() => setHistoryOpen(false)} aria-label="지난 대화 닫기" className="tap flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100 hover:text-slate-800" data-testid="ai-assist-history-close">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      {/* D-638 날짜별로 묶어(오늘 · 어제 · 11월 17일 (월)) 줄마다 시각 — '3일 전' 같은 말 대신 날짜 · 시각 그대로 */}
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {history.map((h, i) => {
          const day = chatDayKey(h.run.createdAt)
          const head = i === 0 || chatDayKey(history[i - 1].run.createdAt) !== day
          return (
            <li key={h.run.requestId} className={head ? '' : 'border-t border-slate-100'}>
              {head && (
                <p className="t-meta sticky top-0 bg-slate-50 px-3 py-1 font-semibold text-slate-600" data-testid="ai-assist-history-day">
                  {chatDay(h.run.createdAt)}
                </p>
              )}
              <button type="button" onClick={() => reopen(h)} className={`tap flex w-full min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50 ${live?.run.requestId === h.run.requestId ? 'bg-violet-50' : ''}`} data-testid="ai-assist-history-item">
                <span className="t-sub min-w-0 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{h.ask && h.assistId.endsWith('.ask') ? h.ask : h.label}</span>
                <span className="t-meta text-slate-500" data-testid="ai-assist-history-when" title={chatStamp(h.run.createdAt)}>
                  {chatTime(h.run.createdAt)} · {PROVIDER_LABEL[h.run.provider] ?? h.run.provider}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )

  const historyButton = (
    <button
      type="button"
      onClick={() => setHistoryOpen((v) => !v)}
      disabled={history.length === 0}
      aria-expanded={historyOpen}
      title={history.length ? '지난 대화 보기(이 브라우저에만)' : '아직 지난 대화가 없어요'}
      className="tap t-sub inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-45"
      data-testid="ai-assist-history-open"
      data-count={history.length}
    >
      <History aria-hidden="true" className="size-4" />
      지난 대화{history.length ? ` ${history.length}` : ''}
    </button>
  )

  const head = (
    <div className={`flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white ${docked ? 'py-1.5 pr-1 pl-3' : 'px-4 py-2.5 sm:rounded-t-(--radius-panel)'}`}>
      <BotAvatar className={docked ? 'size-7' : ''} />
      <h2 className={`${docked ? 't-body' : 't-section'} min-w-0 grow truncate font-bold text-slate-900`} title={`AI 도우미 · ${title}`}>
        AI 도우미 · {title}
      </h2>
      {historyButton}
      <button type="button" onClick={onClose} aria-label="닫기" title={docked && explicit ? '닫기 — 이 화면 대화로 돌아가요' : '닫기'} className="tap flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100 hover:text-slate-800" data-testid="ai-assist-close">
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  )

  // 머리 · 모델 한 줄 · (굴리는) 대화 · 질문창 · 확인 줄 — 오른쪽 판과 창이 같은 모양
  const inner = (
    <>
      {head}
      {/* D-255 모델을 먼저 — 질문을 누르기 전에 무엇으로 물을지 보이고 바꿀 수 있게 */}
      <ModelRow slim status={status} effective={effective} choice={choice} open={settings} setOpen={setSettings} setChoice={setChoice} loadStatus={loadStatus} />
      <div className={`relative flex min-h-0 flex-1 flex-col ${CHAT_TINT}`}>
        <div className={`min-h-0 flex-1 overflow-y-auto ${docked ? 'px-3 py-3' : 'px-4 py-4'}`}>{thread}</div>
        {historySheet}
      </div>
      {composer}
      {confirmBar}
    </>
  )

  // D-628 오른쪽 판 안 — 뒤판 없이 판을 가득 채운다
  if (docked)
    return (
      <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label={`AI 도우미 · ${title}`} data-testid="ai-assist-panel" data-docked="1">
        {inner}
      </div>
    )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`AI 도우미 · ${title}`} data-testid="ai-assist-panel">
      <div className="ax-pop flex h-[94dvh] max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[88vh] sm:max-w-2xl sm:rounded-(--radius-panel)">{inner}</div>
    </div>
  )
}

/** 내 말풍선 글 — 직접 물은 것은 그 말 · 단추는 단추 이름 · 단추에 덧붙인 것은 둘 다 */
function myText(label: string, ask: string, assistId: string): string {
  if (!ask) return label
  return assistId.endsWith('.ask') ? ask : `${label} — ${ask}`
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
  slim = false,
}: {
  status: AssistStatus | null
  effective: AiChoice
  choice: AiChoice | null
  open: boolean
  setOpen: (v: boolean) => void
  setChoice: (c: AiChoice | null) => void
  loadStatus: (withModels?: boolean, probe?: boolean) => Promise<AssistStatus | null>
  /** D-634 대화 판 머리 아래 한 줄(테두리 칸 없이) — 펼친 설정은 판 높이의 절반까지만(대화가 가려지지 않게) */
  slim?: boolean
}) {
  const [tab, setTab] = useState<ProviderId>(effective.provider)
  const [checking, setChecking] = useState(false)
  // D-638 키 이름 · 가격 · 연결 점검은 대표 화면에만(팀장 · 고객 · 대표가 팀장 화면으로 볼 때는 숨김)
  const admin = autoUpgradeAllowed()
  // D-353 [연결 점검] — 공급자마다 아주 짧게 한 번 불러 본 결과(키 없음 · 키 틀림 · 잔액 부족 · 모델 이름 …)
  const [probing, setProbing] = useState(false)
  const [probe, setProbe] = useState<ProviderProbe[] | null>(null)
  const [probeFail, setProbeFail] = useState(false)
  const runProbe = async () => {
    setProbing(true)
    setProbeFail(false)
    const s = await loadStatus(true, true)
    setProbe(s?.probe ?? null)
    setProbeFail(!s?.probe)
    setProbing(false)
  }
  const provider = status?.providers.find((p) => p.id === tab)
  const current = labelOf(status, effective)
  const isDefault = !choice
  // D-629 자동 — 대표 화면만(올려 쓸 좋은 모델이 있을 때). 팀장 · 구독 고객 화면은 아래가 예전 모양 그대로다
  const canAuto = showsAuto(status)
  const auto = canAuto && !choice
  const plan = canAuto ? autoPlanFor(status) : null
  // [가장 싼 모델] · [좋은 모델] 은 지금 고른 회사 안에서(Claude 를 쓰고 있으면 Claude 의 싼 모델 · 좋은 모델)
  const quick = canAuto ? autoPlanFor(status, choice?.provider) : null
  const last = useLastAutoPick()
  const isPick = (c: AiChoice | undefined) => !!c && !!choice && choice.provider === c.provider && choice.model === c.model
  return (
    <section aria-label="모델" className={slim ? 'shrink-0 border-b border-slate-200 bg-white' : 'rounded-(--radius-control) border border-slate-200'} data-testid="ai-assist-model">
      <div className={`flex flex-wrap items-center gap-2 px-3 ${slim ? 'py-1' : 'py-2'}`}>
        <span className="t-sub text-slate-600">쓰는 모델</span>
        <button type="button" onClick={() => setOpen(!open)} title={slim && auto ? '물음은 가장 싼 모델 · 일은 좋은 모델' : undefined} className="tap t-sub min-w-0 text-left font-semibold break-keep text-slate-900 hover:underline" data-testid="ai-assist-model-label" data-mode={auto ? 'auto' : 'manual'}>
          {auto ? '자동' : current}
          {/* 펼치면 바로 아래 '자동' 줄이 같은 말을 한다 — 접혀 있을 때만 뜻을 붙인다 */}
          {/* D-634 대화 판 머리 아래 한 줄(slim)에서는 자동의 긴 뜻만 마우스 설명으로 — 줄이 두 줄로 늘지 않게('기본 · 가장 쌈' 은 짧아 그대로) */}
          {auto ? !open && !slim && <span className="t-meta ml-1 font-normal text-slate-500">(물음은 가장 싼 모델 · 일은 좋은 모델)</span> : isDefault && <span className="t-meta ml-1 font-normal text-slate-500">(기본 · 가장 쌈)</span>}
        </button>
        {/* D-638 대화 판에서는 모델 바꾸기 옆에 글자 크기 [가−][가+] */}
        {slim && <ChatTextSize className="ml-auto" testId="ai-assist-size" />}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`tap t-sub ${slim ? '' : 'ml-auto'} inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50`} data-testid="ai-assist-model-toggle">
          <Settings2 aria-hidden="true" className="size-4" /> {open ? '닫기' : '모델 바꾸기'}
        </button>
      </div>
      {open && (
        <div className={`flex flex-col gap-2.5 border-t border-slate-100 px-3 py-3 ${slim ? 'max-h-[45vh] overflow-y-auto' : ''}`} data-testid="ai-assist-settings">
          {/* D-629 맨 위 — 자동(기본) · 한 번에 고르기 둘. 누르면 바로 다음 질문부터 그 방식으로 */}
          {canAuto && (
            <div className="flex flex-col gap-2" data-testid="ai-model-auto-box">
              <button
                type="button"
                data-testid="ai-model-auto"
                aria-pressed={auto}
                onClick={() => setChoice(null)}
                className={`tap flex w-full min-w-0 items-start gap-2 rounded-(--radius-control) border px-3 py-2 text-left ${auto ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <span className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${auto ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'}`}>{auto && <Check aria-hidden="true" className="size-3" />}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="t-sub font-semibold break-keep text-slate-900">자동 — 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델</span>
                  <span className="t-meta break-keep text-slate-500" data-testid="ai-model-auto-status">
                    {plan ? `물음 ${labelOf(status, plan.light)} · 일 ${labelOf(status, plan.heavy)}` : '모델 목록을 받으면 어느 모델인지 보여요'}
                    {auto && last && (
                      <span className="text-violet-800" data-testid="ai-model-auto-last" data-weight={last.weight} data-model={last.model}>
                        {' '}
                        · 방금: {last.weight === 'heavy' ? '좋은 모델' : '가장 싼 모델'}로 답함
                      </span>
                    )}
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="t-meta text-slate-500">한 번에 고르기</span>
                {(
                  [
                    ['cheap', '가장 싼 모델', quick?.light],
                    ['good', '좋은 모델', quick?.heavy],
                  ] as const
                ).map(([key, text, c]) => (
                  <button
                    key={key}
                    type="button"
                    data-testid="ai-model-quick"
                    data-pick={key}
                    data-model={c?.model ?? ''}
                    disabled={!c}
                    aria-pressed={isPick(c)}
                    title={c ? labelOf(status, c) : undefined}
                    onClick={() => c && setChoice(c)}
                    className={`tap t-sub inline-flex min-h-10 items-center rounded-full border px-3 font-semibold disabled:cursor-wait disabled:opacity-55 ${isPick(c) ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                  <span className={`t-meta rounded-full px-1.5 ${tab === id ? 'bg-white/25' : probeOf(probe, id) ? (probeOf(probe, id)!.code === 'ok' ? 'bg-success-50 text-success-700' : 'bg-amber-100 text-amber-900') : p?.configured ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-500'}`} data-testid="ai-assist-provider-state" data-for={id}>
                    {probeOf(probe, id) ? PROBE_CHIP[probeOf(probe, id)!.code] ?? '문제 있음' : p ? (p.configured ? (admin ? '키 있음' : '쓸 수 있음') : admin ? '키 없음' : '준비 중') : '…'}
                  </span>
                </button>
              )
            })}
          </div>
          {!status && <p className="t-sub text-slate-600">모델 목록을 받지 못했어요(서버 함수가 없는 미리보기이거나 연결 문제). 기본 모델로 물어봅니다.</p>}
          {provider && !provider.configured && (
            <p className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900">
              {josa(provider.label, '은/는')} 아직 연결되지 않았어요 — 관리자가 연결하면 고를 수 있어요.
              {admin && <span className="t-meta block text-amber-800">관리자용: Vercel › Settings › Environment Variables 에 <b>{provider.keyName}</b> 를 넣고 Redeploy</span>}
            </p>
          )}
          {provider && (
            <ul className="flex flex-col gap-1.5">
              {/* D-614 내부 팀장은 회사마다 가장 싼 모델 하나만(대표가 팀장 화면으로 볼 때도 같은 모양) */}
              {provider.models.filter((m) => !isCheapOnly() || m.tier === 'cheap').map((m) => {
                // D-629 자동이면 목록의 어느 모델도 고른 것이 아니다(맨 위 '자동' 줄이 골라져 있다)
                const on = !auto && effective.provider === provider.id && effective.model === m.id
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
                        {admin && (
                          <span className="t-meta break-keep text-slate-500">
                            {priceText(m)}
                            {m.verified === true && ' · ✓ 이 키로 확인됨'}
                            {m.verified === false && ' · 이 키 목록에 없음'}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {/* D-638 키 · 연결 점검은 대표 화면에만(팀장 · 고객은 고칠 수 없는 것 — 점검 단추가 비용 없이 AI 를 부르는 길도 닫는다) */}
            {admin && (<>
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
            <button
              type="button"
              disabled={probing}
              onClick={() => void runProbe()}
              className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) border border-violet-300 bg-violet-50 px-2.5 font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
              data-testid="ai-assist-probe"
              title="AI 회사마다 가장 싼 모델로 아주 짧게 한 번 불러 봐요 — 키 없음 · 키 틀림 · 잔액 부족을 바로 알려 줘요"
            >
              <RefreshCw aria-hidden="true" className={`size-4 ${probing ? 'animate-spin' : ''}`} /> {probing ? '점검 중…' : '연결 점검'}
            </button>
            </>)}
            {!isDefault && (
              <button type="button" onClick={() => setChoice(null)} className="tap t-sub min-h-10 rounded-(--radius-control) px-2.5 font-semibold text-violet-800 hover:underline" data-testid="ai-assist-model-reset">
                {canAuto ? '자동으로 되돌리기' : '기본(가장 싼 Gemini)으로'}
              </button>
            )}
          </div>
          {admin && (probe || probeFail) && (
            <ul className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2" data-testid="ai-assist-probe-result">
              {probeFail && <li className="t-sub break-keep text-amber-900">점검하지 못했어요 — 20초 뒤 다시 눌러 주세요(연달아 누르면 잠시 막혀요).</li>}
              {(probe ?? []).map((x) => (
                <li key={x.id} className={`t-sub flex min-w-0 items-start gap-1.5 break-keep [overflow-wrap:anywhere] ${x.code === 'ok' ? 'text-success-800' : 'text-amber-900'}`} data-testid="ai-assist-probe-row" data-provider={x.id} data-code={x.code}>
                  <span aria-hidden="true" className="shrink-0 font-bold">{x.code === 'ok' ? '✓' : '!'}</span>
                  <span className="min-w-0">{probeText(x)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="t-meta break-keep text-slate-500">
            {/* D-257 팀장 화면에는 없는 마케팅 · AI 전략실은 말하지 않는다 */}
            고른 모델은 이 브라우저에 기억돼 모든 화면의 AI 단추(도우미 · 대화창 · 명세서 · 사업계획서{allowedProviders().length > 1 && !isCheapOnly() ? ' · 마케팅 · AI 전략실' : ' · 마케팅 · 오른쪽 판 AI 대화'})가 같이 써요.
            {canAuto && ' 바꾸면 바로 다음 질문부터 그 모델로 답해요.'}
            {allowedProviders().length === 1 && ' 이 계정은 지금 Gemini 모델만 쓸 수 있어요.'}
            {isCheapOnly() && ' 팀장 계정은 회사마다 가장 싼 모델 하나씩 쓸 수 있어요.'}
          </p>
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* D-353 연결 점검                                                         */
/* ------------------------------------------------------------------ */

const PROBE_CHIP: Record<string, string> = {
  ok: '연결됨',
  no_key: '키 없음',
  bad_base: '주소 설정',
  provider_auth: '키 틀림',
  provider_billing: '잔액 부족',
  provider_model: '모델 이름',
  provider_busy: '붐빔',
  provider_unreachable: '응답 없음',
}
const probeOf = (probe: readonly ProviderProbe[] | null, id: ProviderId) => probe?.find((x) => x.id === id) ?? null

/** 점검 한 줄 — 무엇이 문제고 어디서 고치는지 */
function probeText(x: ProviderProbe): string {
  const name = PROVIDER_NAME[x.id]
  if (x.code === 'ok') return `${name} — 연결됨${x.model ? `(${x.model} 로 한 번 불러 봤어요)` : ''}`
  if (x.code === 'no_key') return `${name} — 서버에 키가 없어요. 관리자: Vercel › Settings › Environment Variables 에 ${x.keyName ?? '키'} 를 넣고(Production 에 체크) Redeploy 해 주세요.`
  if (x.code === 'bad_base') return `${name} — 주소 설정(${x.keyName ?? ''})이 https 주소가 아니에요. 지우면 기본 주소로 붙어요.`
  if (x.code === 'provider_busy') return `${name} — 지금 붐비거나 1분 한도에 닿았어요. 잠시 뒤 다시 점검해 주세요.`
  if (x.code === 'provider_unreachable') return `${name} — 20초 안에 답이 없었어요. 잠시 뒤 다시 점검해 주세요.`
  return providerMessage(x.code, x.id, x.detail)
}

/* ------------------------------------------------------------------ */
/* 오류 · 결과                                                            */
/* ------------------------------------------------------------------ */

function ErrorBox({ error }: { error: { code: string; message: string; missing: string[]; ref?: string } }) {
  let how: ReactNode = null
  // D-638 키 이름 · 서버 설정 · 문서 이름은 대표 화면에만
  const admin = autoUpgradeAllowed()
  if (!admin && (error.code === 'setup_needed' || error.code === 'db_setup_needed')) how = <>관리자에게 'AI 연결' 을 부탁해 주세요.</>
  else if (error.code === 'setup_needed')
    how = (
      <>
        관리자에게 'AI 키 연결' 을 부탁해 주세요.
        <span className="t-meta block">관리자용: Vercel › Settings › Environment Variables 에 <b>{error.missing[0] ?? 'GEMINI_API_KEY'}</b> 를 넣고 Redeploy(키는 서버에만 — 이름이 VITE_ 로 시작하면 안 됩니다).</span>
      </>
    )
  else if (error.code === 'db_setup_needed')
    how = (
      <>
        관리자에게 'AI 권한 설정' 을 부탁해 주세요.
        <span className="t-meta block">관리자용: Supabase SQL Editor 에서 0021(AI 전략실 권한) 실행 — 운영 적용 안내 문서 §12.</span>
      </>
    )
  return (
    <div role="alert" className="flex gap-2 rounded-(--radius-control) border border-amber-300 bg-amber-50 px-3 py-3" data-testid="ai-assist-error" data-code={error.code}>
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="t-body font-semibold break-keep text-amber-950">{error.message}</span>
        {how && <span className="t-sub break-keep text-amber-900">{how}</span>}
        {/* NX-2 같은 오류가 되풀이되면 이 번호로 관리자가 서버 기록을 찾는다(키 · 설정 문제는 번호가 필요 없다) */}
        {error.ref && !['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed'].includes(error.code) && (
          <span className="t-meta break-keep text-amber-800" data-testid="ai-assist-error-ref">
            문의 번호 {error.ref} — 계속 안 되면 관리자에게 이 번호를 알려 주세요
          </span>
        )}
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

/**
 * D-634 대화 맨 끝(지금 답)만 시험 이름표(ai-assist-*)를 단다 — 위로 밀린 지난 답은 이름표 없이(같은 단추가 여럿 잡히지 않게).
 * 보내는 중이면 지금 답도 이름표를 내려놓는다(새 답이 오면 그것이 지금 답).
 */
const LiveCtx = createContext(true)
function useTid() {
  const live = useContext(LiveCtx)
  return (id: string) => (live ? id : undefined)
}

interface ResultViewProps {
  entry: NonNullable<Shown>
  stale: boolean
  /** 대화의 맨 끝 답 — [다시 만들기] · [더 잘 쓰는 모델로 다시] · 기록 줄은 맨 끝 답에만 */
  last: boolean
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
  /** D-618 내 질문과 AI 답 사이에 끼울 판정 줄(지금 답에만) */
  pinNode?: ReactNode
}

/** 대화 한 번 — 내 말풍선(오른쪽) → (판정 줄) → AI 말풍선들(왼쪽: 한 줄 결론 · 접힌 항목 · 바로 할 일) → 단추 */
function ResultView({ entry, stale, last, running, onRerun, better, onBetter, onClose, onCopied, onSaveItem, onSaved, ctx, itemActions, resultActions, record, defaultClientId, onRecorded, onMarked, toast, pinNode }: ResultViewProps) {
  const tid = useTid()
  const { run } = entry
  // D-244 별칭(영업자 A)은 보여 줄 때 실제 이름으로 — 이 브라우저에서만
  // D-638 서버 모양 검사에서 떨어진 답도 너그럽게 읽어 항목으로 — 그래도 못 읽으면 JSON 껍데기 대신 머리글 · 쉬운 말 한 줄
  const a = useMemo(() => unaliasAnswer(run.structured ?? answerOf(run), entry.aliases), [run, entry.aliases])
  const raw = useMemo(() => unalias(run.raw, entry.aliases), [run.raw, entry.aliases])
  const shownRaw = useMemo(() => unalias(chatAnswerOf({ structured: null, raw: run.raw }).headline, entry.aliases), [run.raw, entry.aliases])
  const cut = cutOff(run)
  const done = useMemo(() => new Set(entry.done ?? []), [entry.done])
  const here = useLocation()
  // 로컬 모드에는 AuthProvider 가 없다 — 그때는 작업공간 · 사용자 없이(업무 일기는 이 브라우저에)
  const auth = useContext(AuthContext)
  const items = a?.items ?? []
  // D-634 1번 2번 3번은 접힌 채 — 하나뿐이면 펼쳐 둔다. 접어도 단추 상태(담음 · 저장됨)는 그대로(숨기기만)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set(items.length === 1 ? [0] : []))
  const allOpen = items.length > 0 && open.size === items.length
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  const time = chatTime(run.createdAt)

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

  const pill = 'tap t-sub inline-flex min-h-10 items-center gap-1 rounded-full border px-3 font-semibold disabled:opacity-60'

  return (
    <section aria-label="AI 답" className="flex flex-col gap-3" data-testid={tid('ai-assist-result')} data-assist={entry.assistId} data-chat="turn">
      <MeBubble time={time} testId={entry.ask ? tid('ai-assist-asked') : tid('ai-assist-task')}>
        {myText(entry.label, entry.ask, entry.assistId)}
      </MeBubble>
      {pinNode}
      <BotRow
        time={time}
        tag={
          <span className="t-meta rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600" data-testid={tid('ai-assist-model')}>
            {prettyModel(run.model)}
          </span>
        }
      >
        {a ? (
          <>
            <BotBubble first>
              <p className="t-body font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid={tid('ai-assist-headline')}>
                {a.headline}
              </p>
              {stale && (
                <p className="t-meta mt-1 break-keep text-warning-800" data-testid={tid('ai-assist-stale')}>
                  그 뒤로 화면 자료가 바뀌었어요 — 다시 만들면 새 자료로
                </p>
              )}
            </BotBubble>
            {items.length > 0 && (
              <BotBubble wide tight>
                {items.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 pt-0.5 pb-1">
                    <span className="t-meta text-slate-600">{items.length}개 — 누르면 펼쳐져요</span>
                    <button
                      type="button"
                      onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((_, i) => i)))}
                      className="tap t-meta inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-semibold text-brand-700 hover:bg-slate-50"
                      data-testid={tid('ai-assist-expand-all')}
                      aria-expanded={allOpen}
                    >
                      {allOpen ? '모두 접기' : '모두 펼치기'}
                    </button>
                  </div>
                )}
                <ol className="flex flex-col divide-y divide-slate-100">
                  {items.map((it, i) => {
                    const isOpen = open.has(i)
                    return (
                      <li key={i} className="flex min-w-0 flex-col" data-testid={tid('ai-assist-item')} data-open={isOpen ? '1' : '0'}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => toggle(i)}
                          className="tap flex w-full min-w-0 items-center gap-2 rounded-xl px-1.5 py-2 text-left hover:bg-slate-50"
                          data-testid={tid('ai-assist-item-toggle')}
                        >
                          <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 font-bold text-white">{i + 1}</span>
                          {/* 꼬리표는 제목 아래 — 좁은 판에서 제목이 한 글자씩 꺾이지 않게 */}
                          <span className="flex min-w-0 grow flex-col items-start gap-1">
                            <span className="t-body min-w-0 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{it.title}</span>
                            {it.tag && <span className="t-meta max-w-full rounded-full bg-white px-2 py-0.5 font-semibold break-keep text-violet-800 ring-1 ring-violet-200">{it.tag}</span>}
                          </span>
                          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <div className={isOpen ? 'flex min-w-0 flex-col gap-1.5 pr-1.5 pb-2.5 pl-9' : 'hidden'}>
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
                            <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-2.5">
                              <p className="t-body break-keep whitespace-pre-line text-slate-900 [overflow-wrap:anywhere]" data-testid={tid('ai-assist-body')}>
                                {it.body}
                              </p>
                              <div className="flex flex-wrap justify-end gap-2">
                                {onSaveItem && <SaveItemButton onSave={() => onSaveItem(it, entry.assistId)} onSaved={onSaved} />}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (await copy(`${it.title}\n\n${it.body}`)) onCopied()
                                  }}
                                  className={`${pill} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
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
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </BotBubble>
            )}
            {a.next && a.next.length > 0 && (
              <BotBubble>
                <p className="t-sub font-semibold text-slate-700">바로 할 일</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {a.next.map((n, i) => (
                    <li key={i} className="t-body flex flex-wrap items-start gap-x-1.5 gap-y-1 break-keep text-slate-900" data-testid={tid('ai-assist-next')}>
                      <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet-700" />
                      <span className="min-w-0 grow basis-40 [overflow-wrap:anywhere]">{n}</span>
                      {record && <ActionButton id="todo-next" label="할 일로" doneLabel="할 일에 넣음" once small initiallyDone={done.has(`next:${i}`)} onRun={() => addTodo({ title: n }, `next:${i}`)} toast={toast} />}
                    </li>
                  ))}
                </ul>
              </BotBubble>
            )}
            {a.caution && (
              <BotBubble>
                <p className="t-sub break-keep text-warning-800">△ 확인할 점 · {a.caution}</p>
              </BotBubble>
            )}
          </>
        ) : (
          <BotBubble first>
            <p className="t-body break-keep whitespace-pre-line text-slate-900 [overflow-wrap:anywhere]" data-testid={tid('ai-assist-plain')}>{shownRaw}</p>
          </BotBubble>
        )}
        {cut && (
          <BotBubble>
            <p className="t-sub break-keep text-slate-700" data-testid={tid('ai-assist-cut')}>✂ {CUT_NOTE}</p>
          </BotBubble>
        )}
        {resultActions.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid={tid('ai-assist-result-actions')}>
            {resultActions.map((act) => (
              <ActionButton key={act.id} id={act.id} label={act.label} doneLabel={act.doneLabel} primary once onRun={() => act.run({ structured: a, raw }, ctx)} onNavigate={onClose} toast={toast} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={async () => {
              if (await copy(answerText(a, shownRaw))) onCopied()
            }}
            className={`${pill} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            data-testid={tid('ai-assist-copy')}
          >
            <Copy aria-hidden="true" className="size-4" /> 복사
          </button>
          {last && (
            <button type="button" disabled={running} onClick={onRerun} className={`${pill} border-violet-200 bg-white text-violet-800 hover:bg-violet-50`} data-testid={tid('ai-assist-rerun')}>
              <RefreshCw aria-hidden="true" className={`size-4 ${running ? 'animate-spin' : ''}`} /> 다시 만들기
            </button>
          )}
          {last && better && (
            <button
              type="button"
              disabled={running}
              onClick={onBetter}
              title={`이번 한 번만 ${better.label} 로 — 고른 모델은 그대로`}
              className={`${pill} border-violet-300 bg-white text-violet-900 hover:bg-violet-50`}
              data-testid={tid('ai-assist-better')}
              data-model={better.model}
            >
              <Wand2 aria-hidden="true" className="size-4" /> 더 잘 쓰는 모델로 다시 · {better.label}
            </button>
          )}
        </div>
        {last && (
          <p className="t-meta break-keep text-slate-500" data-testid={tid('ai-assist-meta')}>
            {PROVIDER_LABEL[run.provider] ?? run.provider} · {run.model} · {(run.ms / 1000).toFixed(1)}초 · 토큰 {run.usage.total.toLocaleString('ko-KR')}
            {costText(run)} · 보낸 줄 {run.sent.rows}
          </p>
        )}
      </BotRow>
    </section>
  )
}

/** 한 번만 저장(두 번 눌러도 한 번) — 저장한 뒤에는 '저장됨' */
function SaveItemButton({ onSave, onSaved }: { onSave: () => Promise<boolean>; onSaved: (ok: boolean) => void }) {
  const tid = useTid()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  return (
    <button
      type="button"
      disabled={state !== 'idle'}
      data-testid={tid('ai-assist-save')}
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
  const tid = useTid()
  const r = normRef(item.ref)
  const href = r ? entry.links[r] : undefined
  const external = !!href && /^https:\/\//.test(href)
  const showRef = !!href && (external || !isSamePage(href, here))
  if (!showRef && !onTodo && actions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" data-testid={tid('ai-assist-item-actions')}>
      {actions.map((act) => (
        <ActionButton key={act.id} id={act.id} label={act.label} doneLabel={act.doneLabel} primary={act.primary} once={act.once} onRun={() => act.run(item, ctx)} onNavigate={onClose} toast={toast} />
      ))}
      {onTodo && <ActionButton id="todo" label="할 일로 넣기" doneLabel="할 일에 넣음" once initiallyDone={todoDone} onRun={onTodo} onNavigate={onClose} toast={toast} />}
      {showRef &&
        href &&
        (external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) px-1.5 font-semibold text-brand-700 hover:underline" data-testid={tid('ai-assist-ref')}>
            {refKind(r) === 'v' ? '영상 보기' : '새 창에서 보기'} <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <Link to={href} onClick={onClose} className="tap t-sub inline-flex min-h-10 items-center gap-1 rounded-(--radius-control) px-1.5 font-semibold text-brand-700 hover:underline" data-testid={tid('ai-assist-ref')} data-ref={r}>
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
  const tid = useTid()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>(once && initiallyDone ? 'done' : 'idle')
  const [go, setGo] = useState<{ to: string; label: string } | null>(null)
  const done = once && state === 'done'
  const tone = done ? 'border-success-200 bg-success-50 text-success-800' : primary ? 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700' : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-50'
  return (
    <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={state === 'busy' || done}
        data-testid={tid('ai-assist-action')}
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
          <a href={go.to} target="_blank" rel="noopener noreferrer" className="tap t-sub inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid={tid('ai-assist-action-go')}>
            {go.label} <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <Link to={go.to} onClick={onNavigate} className="tap t-sub inline-flex min-h-10 items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid={tid('ai-assist-action-go')}>
            {go.label} <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ))}
    </span>
  )
}
