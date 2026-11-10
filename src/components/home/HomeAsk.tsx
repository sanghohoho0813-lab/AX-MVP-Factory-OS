/**
 * D-497 오늘 맨 위 대화창 — LLM 첫 화면처럼 질문 한 줄로 시작한다.
 *
 *   가운데 큰 글 '무엇을 도와드릴까요?' · 둥근 입력 줄([+] 업체 고르기 · 모델 고르기 · 말로 적기 · 보내기 ↑) · 지금 자료에 맞춘 질문 세 줄
 *   업체 이름과 함께 물으면 그 업체의 회사 · OS 모듈 판정 · 서류함 · 일정 · 받을 돈을 엮어 AI 도우미 서버 함수(/api/ai-assist)로 묻는다.
 *   AI 를 못 부르면(연결 없음 · 오류) 판정 그대로 '먼저 제안할 것 · 확인할 것 · 받아 올 서류' 를 규칙으로 정리해 같은 자리에 — AI 라고 부르지 않는다.
 *   답마다 👍 · 👎(까닭) — 다음 답의 말하기 규칙으로 쌓인다. 화면 꾸미기로 숨길 수 있다(칸 id 'ask').
 */
import { useContext, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { AuthContext } from '../../auth/authContext'
import { createJournalEntry } from '../../services/journalService'
import { requestDiagnosis } from '../../services/openDiagnosis'
import { todayLocalDate } from '../../lib/appClock'
import { addDaysLocal } from '../../services/clientOpsNextAction'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, Building2, Calculator, CalendarClock, Check, ChevronRight, Copy, FileText, FileUp, Lightbulb, ListChecks, Loader2, Mic, MicOff, Paperclip, Phone, Plus, ThumbsDown, ThumbsUp, Trash2, Wallet, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { handDocsTo, handNewClientDocs } from '../../services/docHandoff'
import { CHAT_DOC_MAX, defaultDocQuestion, labelOfDoc, type ChatDoc, type DocCompany } from '../../services/homeAsk/homeDocs'
import { ModelPicker } from '../ai/ModelPicker'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { useToast } from '../ui/toastContext'
import { useIsPhone } from '../../lib/useIsPhone'
import { useCustomerAudience } from '../../config/customerAudience'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { AssistBundle } from '../../services/aiAssist/context'
import { DOWN_REASONS, docRequestText, findClients, intentsOf, isDocListItem, learnAliases, type HomeIntent, type HomeSuggestion, type PlanChip, type RuleAnswer, type SuggestIcon } from '../../services/homeAsk/homeAsk'
import type { TalkAnswer, TalkNext, TalkNumber } from '../../services/homeAsk/homeTalk'
import { TalkCard } from './TalkCard'
import { addAliases, askHome, clearHomeTurns, docsOfTurn, homeAliases, markDocsSaved, markTalkSaved, markTodoDone, rateTurn, restoreHomeTurns, syncHomeTurns, useHomeAsk, type HomeTurn } from '../../services/homeAsk/homeAskStore'

const ICON: Record<SuggestIcon, typeof CalendarClock> = { meeting: CalendarClock, docs: FileText, reco: Lightbulb, today: ListChecks, money: Wallet, call: Phone }

export interface HomeAskProps {
  clients: readonly ClientOpsRecord[]
  suggestions: readonly HomeSuggestion[]
  canAI: boolean
  /** docs — D-498 함께 올린 서류(읽기 끝난 것 · 없으면 빈 배열) */
  prepare: (question: string, clientIds: string[], intents: HomeIntent[], docs: readonly ChatDoc[]) => Promise<{ bundle: AssistBundle; rule: RuleAnswer; docCompany?: DocCompany | null; plans?: PlanChip[]; talk?: HomeTurn['talk'] }>
  /** D-499 답에서 할 일을 넣은 뒤 — 오늘 할 일 목록을 다시 읽게 */
  onRecorded?: () => void
  /** D-502 말한 업체 사정을 업체에 기록(성공하면 true) */
  onRecordTalk?: (clientId: string, answers: readonly TalkAnswer[], numbers?: readonly TalkNumber[], next?: TalkNext) => Promise<boolean>
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

export function HomeAsk({ clients, suggestions, canAI, prepare, onRecorded, onRecordTalk }: HomeAskProps) {
  // D-563 외부 구독 고객 계정 — 모듈 판정을 약속하는 말을 쓰지 않는다
  const customer = useCustomerAudience()
  const { turns, busy } = useHomeAsk()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const phone = useIsPhone()
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState<string>('')
  const [menu, setMenu] = useState(false)
  const [picking, setPicking] = useState(false)
  const [listening, setListening] = useState(false)
  const [showOld, setShowOld] = useState(false)
  // U2(2026-11-05 대표 승인) 평소에는 입력칸 한 줄 — 누르면(입력칸 · [+] · 말로 적기) 지금처럼 큰 글 · 안내 · 질문 세 줄까지 펼친다. 한 번 펼치면 이 화면에 있는 동안 그대로
  const [open, setOpen] = useState(false)
  // D-498 함께 보낼 서류(이 기기에서 읽기만 — 저장은 답 아래 단추로)
  const [docs, setDocs] = useState<ChatDoc[]>([])
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
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

  /** D-498 서류 넣기 — 하나씩 읽는다(사진 · 스캔은 처음 한 번 글자 인식 준비가 걸린다) */
  const addFiles = async (list: File[]) => {
    const room = CHAT_DOC_MAX - docs.length
    const picked = list.filter((f) => f.size > 0).slice(0, Math.max(0, room))
    if (list.length > picked.length) showToast(`대화창에는 서류 ${CHAT_DOC_MAX}개까지 — 더 많으면 업체 화면 [서류 올리기] 로 넣어 주세요.`)
    if (picked.length === 0) return
    const fresh: ChatDoc[] = picked.map((file, i) => ({ id: `cd_${Date.now().toString(36)}_${i}`, file, status: 'reading', text: '', method: 'none', label: '' }))
    setDocs((cur) => [...cur, ...fresh])
    const { canExtractText, extractTextFromFile } = await import('../../services/docTextExtract')
    for (const d of fresh) {
      let text = ''
      let method: ChatDoc['method'] = 'none'
      let note = ''
      try {
        if (canExtractText(d.file)) {
          const res = await extractTextFromFile(d.file)
          text = res.text
          method = res.method
        } else note = '글자를 읽을 수 없는 파일이에요 — 파일 이름으로만 봐요'
      } catch {
        note = '글자를 읽지 못했어요 — 파일 이름으로만 봐요'
      }
      const label = await labelOfDoc(text, d.file.name).catch(() => '')
      setDocs((cur) => cur.map((x) => (x.id === d.id ? { ...x, status: 'done', text, method, label, ...(note ? { note } : {}) } : x)))
    }
  }
  const reading = docs.some((d) => d.status === 'reading')
  const readyDocs = docs.filter((d) => d.status === 'done')

  const send = (raw: string, forceClient?: string) => {
    // 서류만 넣고 보내면 — 서류 종류로 묻는 말을 대신 만든다
    const q = raw.trim() || (readyDocs.length ? defaultDocQuestion(readyDocs.map((d) => d.label)) : '')
    if (!q || busy || reading) return
    const found = findClients(q, clients, homeAliases())
    const extra = forceClient || pinned
    // 이름이 잡히지 않았는데 업체를 골라 두었으면 — 질문 속 그 업체 이름 조각을 별명으로 배운다
    if (extra && found.length === 0) {
      const c = byId.get(extra)
      if (c) addAliases(learnAliases(q, c.companyName), c.id)
    }
    const ids = [...new Set([...found, ...(extra ? [extra] : [])])].slice(0, 3)
    const intents = intentsOf(q)
    const sent = readyDocs
    setText('')
    setDocs([])
    void askHome({ question: q, clientIds: ids, canAI, docs: sent, prepare: () => prepare(q, ids, intents, sent) })
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
    // U2 대화를 지운 직후에는 펼친 채로(질문 세 줄이 바로 보이게) — 한 줄로 접히면 다음 질문을 찾기 어렵다
    setOpen(true)
    const prev = clearHomeTurns()
    showToast('대화를 지웠습니다', { label: '되돌리기', onClick: () => restoreHomeTurns(prev) })
  }

  const pinnedName = pinned ? byId.get(pinned)?.companyName ?? '' : ''
  const shown = showOld ? turns : turns.slice(-2)
  // 대화 · 올린 서류 · 고른 업체 · 적던 글이 있으면 늘 펼친 채로(지금처럼)
  const expanded = open || turns.length > 0 || docs.length > 0 || !!pinned || !!text || menu || picking || listening || over

  return (
    <section
      aria-label="무엇이든 물어보기"
      data-testid="home-ask"
      data-open={expanded ? '1' : '0'}
      // D-498 서류를 끌어다 놓아도 된다
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setOver(false)
        void addFiles(Array.from(e.dataTransfer.files))
      }}
      className={expanded ? `rounded-(--radius-panel) border bg-white px-3 py-5 sm:px-8 sm:py-7 ${over ? 'border-brand-400' : 'border-slate-200'}` : ''}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.txt,.pptx"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          e.target.value = ''
          void addFiles(list)
        }}
        data-testid="home-ask-file"
      />
      {/* 목차 제목이 아니라 인사 — 목차 설명(ⓘ) 규칙(D-192)은 h2 목차에만 */}
      {expanded && (
        <>
          <p className="text-center text-[1.2rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.55rem]" data-testid="home-ask-title">
            무엇을 도와드릴까요?
          </p>
          <p className="t-sub mt-1 text-center break-keep text-slate-500" data-testid="home-ask-guide">
            {customer ? '업체 이름과 함께 물어보거나 서류를 올리면 그 업체 자료로 답해요' : '업체 이름과 함께 물어보거나 서류를 올리면 모듈 판정까지 보고 답해요'}
          </p>
        </>
      )}

      <form onSubmit={onSubmit} className={`relative mx-auto ${expanded ? 'mt-4' : ''} flex w-full max-w-3xl items-end gap-1 rounded-[26px] border border-slate-300 bg-white py-1.5 pr-1.5 pl-1.5 shadow-sm focus-within:border-violet-400`} data-testid="home-ask-form">
        <div ref={menuRef} className="relative shrink-0">
          <button type="button" aria-label="업체 고르기 · 서류로 새 업체" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="tap flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" data-testid="home-ask-plus" data-guide={menu ? undefined : 'fn-ask-plus'}>
            <Plus aria-hidden="true" className="size-5" />
          </button>
          {menu && (
            <div className="absolute bottom-12 left-0 z-40 w-64 rounded-(--radius-control) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)" data-testid="home-ask-menu">
              <button type="button" onClick={() => { setMenu(false); fileRef.current?.click() }} className="tap t-body flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-slate-800 hover:bg-slate-50" data-testid="home-ask-attach">
                <FileUp aria-hidden="true" className="size-4 text-slate-500" /> 서류 올리기(사업자등록증 · 재무제표 …)
              </button>
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
          {docs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1" data-testid="home-ask-docs">
              {docs.map((d) => (
                <span key={d.id} className="t-sub inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white py-0.5 pr-1 pl-2.5 text-slate-700" data-testid="home-ask-doc" data-status={d.status} title={d.note || d.file.name}>
                  {d.status === 'reading' ? <Loader2 aria-hidden="true" className="size-3.5 shrink-0 animate-spin" /> : <Paperclip aria-hidden="true" className="size-3.5 shrink-0 text-slate-500" />}
                  {/* 종류를 알면 종류만(긴 파일 이름은 마우스를 올리면) — 휴대폰에서 '사업자등…' 으로 잘리지 않게 */}
                  <span className="max-w-[14rem] truncate">{d.status === 'reading' ? `${d.file.name} 읽는 중` : d.label || d.file.name}</span>
                  <button type="button" aria-label={`${d.file.name} 빼기`} onClick={() => setDocs((cur) => cur.filter((x) => x.id !== d.id))} className="tap flex size-6 items-center justify-center rounded-full hover:bg-slate-100">
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
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
            onFocus={() => setOpen(true)}
            // 휴대폰은 칸이 좁아 긴 예시가 두 줄로 잘린다 — 짧게
            placeholder={!expanded && !phone ? '무엇이든 물어보세요 · 업체 이름과 함께' : readyDocs.length && !phone ? '서류만 보내도 돼요 — 무엇을 제안할지 정리해요' : pinnedName ? (phone ? '무엇이 궁금하세요?' : `${pinnedName} — 무엇이 궁금하세요?`) : phone ? '무엇이든 물어보세요' : '예: ○○ 1차 미팅 — 무엇을 제안할까?'}
            aria-label="질문"
            className={`t-body min-h-10 w-full resize-none ${text ? 'overflow-y-auto' : 'overflow-hidden'} bg-transparent px-1.5 py-2 leading-snug text-slate-900 outline-none placeholder:text-slate-400`}
            data-testid="home-ask-input"
          />
        </div>
        <ModelPicker popover className="max-w-[11.5rem] shrink-0 max-sm:hidden" testId="home-ask-model" />
        {Speech && (
          <button type="button" aria-label={listening ? '받아 적기 멈추기' : '말로 적기'} aria-pressed={listening} onClick={toggleMic} data-guide="fn-ask-voice" className={`tap flex size-10 shrink-0 items-center justify-center rounded-full ${listening ? 'bg-danger-50 text-danger-700' : 'text-slate-600 hover:bg-slate-100'}`} data-testid="home-ask-mic">
            {listening ? <MicOff aria-hidden="true" className="size-5" /> : <Mic aria-hidden="true" className="size-5" />}
          </button>
        )}
        <button type="submit" aria-label="보내기" disabled={busy || reading || (!text.trim() && readyDocs.length === 0)} className="tap flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400" data-testid="home-ask-send">
          {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ArrowUp aria-hidden="true" className="size-5" />}
        </button>
      </form>

      {!expanded ? null : turns.length === 0 ? (
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
            <Turn key={t.id} turn={t} names={t.clientIds.map((id) => ({ id, name: byId.get(id)?.companyName ?? '' })).filter((x) => x.name)} onRecorded={onRecorded} onRecordTalk={onRecordTalk} />
          ))}
        </div>
      )}
    </section>
  )
}

function Turn({ turn, names, onRecorded, onRecordTalk }: { turn: HomeTurn; names: { id: string; name: string }[]; onRecorded?: () => void; onRecordTalk?: HomeAskProps['onRecordTalk'] }) {
  // D-563 외부 구독 고객 계정 — 맞춤 진단서 · 말하기 대본(모듈 판정으로 만드는 것)은 띄우지 않는다
  const customer = useCustomerAudience()
  const [talkBusy, setTalkBusy] = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const auth = useContext(AuthContext)
  // D-499 '다음에 할 일' 한 줄 → 할 일(물어본 첫 업체에 · 내일 기한) — 한 번 누르면 끝
  const company = names[0]?.name ?? turn.docs?.company?.name ?? ''
  const addTodo = async (text: string, index: number) => {
    const today = todayLocalDate()
    const due = addDaysLocal(today, 1)
    try {
      await createJournalEntry(auth?.currentWorkspaceId ?? null, auth?.session?.user.id ?? null, {
        entryType: 'follow_up',
        entryDate: today,
        content: company && !text.includes(company) ? `${company} — ${text}` : text,
        clientId: names[0]?.id ?? null,
        dueDate: due,
      })
      markTodoDone(turn.id, index)
      onRecorded?.()
      showToast(`할 일에 넣었어요 · 기한 ${due.slice(5).replace('-', '/')}`)
    } catch {
      showToast('할 일에 넣지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    }
  }
  const copyText = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(done)
    } catch {
      showToast('복사하지 못했습니다')
    }
  }
  const files = docsOfTurn(turn.id)
  // D-498 답 아래 한 번 — 기존 업체는 그 업체 '서류 올리기'(D-187 넘기기), 새 업체는 '새 업체 등록' 창(서류로 칸이 채워진 채)
  const saveDocs = () => {
    const handed = files.map((d) => ({ file: d.file, text: d.text, method: d.method }))
    const company = turn.docs?.company
    if (company?.clientId) {
      handDocsTo(company.clientId, handed)
      markDocsSaved(turn.id, 'client')
      navigate(`/ops/clients/${encodeURIComponent(company.clientId)}`)
    } else {
      handNewClientDocs(handed)
      markDocsSaved(turn.id, 'new')
      navigate('/ops/clients?new=1')
    }
  }
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
        <p className="t-meta flex flex-wrap items-baseline justify-end gap-x-1 self-end text-right text-slate-500" data-testid="home-ask-clients">
          이 업체 자료로:
          {names.map((n) => (
            <Link key={n.id} to={`/ops/clients/${encodeURIComponent(n.id)}?tab=smart`} className="tap font-semibold text-brand-700 hover:underline">
              {n.name}
            </Link>
          ))}
          {/* D-499 대표님께 드릴 한 장 — 누르면 그 업체 맞춤 진단서가 바로 열린다 */}
          {names[0] && !customer && (
            <Link to={`/ops/clients/${encodeURIComponent(names[0].id)}?tab=smart&diag=1`} onClick={() => requestDiagnosis(names[0].id)} className="tap ml-1 inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-50" data-testid="home-ask-diag">
              맞춤 진단서
            </Link>
          )}
          {/* D-508 상담 자리에서 읽을 말 — 그 업체 판정 그대로 미팅 순서 · 고객에게 이렇게 말하세요 */}
          {names[0] && !customer && (
            <Link to={`/ops/clients/${encodeURIComponent(names[0].id)}?tab=smart&talk=1`} className="tap ml-1 inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-50" data-testid="home-ask-talkscript">
              말하기 대본
            </Link>
          )}
        </p>
      )}
      {turn.docs && (
        <p className="t-meta flex flex-wrap items-center justify-end gap-1 self-end text-slate-500" data-testid="home-ask-turn-docs">
          <Paperclip aria-hidden="true" className="size-3.5" />
          {turn.docs.labels.map((l, i) => l || turn.docs?.names[i]).join(' · ')}
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
                  {/* D-499 한 번에 — 받아 올 서류는 대표님께 보낼 요청 문구로, 말할 글은 그대로 복사 */}
                  {(isDocListItem(it.title, it.outline) || it.body) && (
                    <div className="flex flex-wrap gap-1.5">
                      {isDocListItem(it.title, it.outline) && (
                        <Button size="sm" variant="secondary" onClick={() => void copyText(docRequestText(company, it.outline ?? []), '서류 요청 문구를 복사했어요 — 카톡에 붙여 넣으세요')} data-testid="home-ask-docreq">
                          <Copy aria-hidden="true" className="size-4" /> 서류 요청 문구 복사
                        </Button>
                      )}
                      {it.body && (
                        <Button size="sm" variant="ghost" onClick={() => void copyText(it.body ?? '', '복사했어요')} data-testid="home-ask-body-copy">
                          <Copy aria-hidden="true" className="size-4" /> 이 글 복사
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {a.next && a.next.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="t-meta font-semibold text-slate-500">다음에 할 일</span>
              <ul className="t-sub flex flex-col gap-0.5 text-slate-700">
                {a.next.map((n, k) => {
                  const done = turn.todoDone?.includes(k)
                  return (
                    <li key={k} className="flex items-start gap-1.5 break-keep" data-testid="home-ask-next">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">{n}</span>
                      <button type="button" disabled={done} onClick={() => void addTodo(n, k)} className={`tap t-meta shrink-0 rounded-full border px-2.5 py-1 font-semibold ${done ? 'border-slate-200 text-slate-400' : 'border-slate-300 bg-white text-brand-700 hover:bg-slate-50'}`} data-testid="home-ask-todo">
                        {done ? '할 일에 넣음' : '할 일로'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {a.caution && <p className="t-sub break-keep text-danger-700">{a.caution}</p>}
          {turn.talk && (turn.talk.answers.length > 0 || (turn.talk.numbers?.length ?? 0) > 0 || !!turn.talk.next) && (
            // D-502~D-504 질문에서 읽은 업체 사정 · 숫자 · 다음 약속 — 한 번 누르면 업체에 남는다(최종 확인 · 업무 일기 메모와 같은 카드)
            <TalkCard
              company={turn.talk.company}
              answers={turn.talk.answers}
              numbers={turn.talk.numbers}
              next={turn.talk.next}
              changes={turn.talk.changes}
              saved={!!turn.talk.saved}
              savedText={`${turn.talk.company}에 기록했어요 — 회사 정보 · 상황 예시 · 다음 할 일에 들어가고, 들은 말은 업무 일기에 상담 메모로 남겼어요`}
              busy={talkBusy}
              onRecord={
                onRecordTalk &&
                (async () => {
                  const tk = turn.talk
                  if (!tk || talkBusy) return
                  setTalkBusy(true)
                  const ok = await onRecordTalk(tk.clientId, tk.answers, tk.numbers ?? [], tk.next).catch(() => false)
                  setTalkBusy(false)
                  if (ok) {
                    markTalkSaved(turn.id)
                    // D-504 들은 말 그대로 업무 일기에 '상담 메모'(언제 무엇을 들었나 — 고객에게는 안 보임)
                    await createJournalEntry(auth?.currentWorkspaceId ?? null, auth?.session?.user.id ?? null, { entryType: 'note', entryDate: todayLocalDate(), content: `상담 메모 — ${turn.q}`.slice(0, 500), clientId: tk.clientId }).then(() => onRecorded?.()).catch(() => undefined)
                    showToast(`${tk.company}에 기록했어요 — 상황 예시를 다시 맞췄어요`)
                  }
                })
              }
            />
          )}
          {turn.plans && turn.plans.length > 0 && (
            // D-501 고도화 목표 3 — 이 업체에 맞는 상황 예시를 한 번 누르면 그 업체 숫자로 모듈이 열려 바로 결과
            <div className="flex flex-col gap-1" data-testid="home-ask-plans">
              <span className="t-meta inline-flex items-center gap-1 font-semibold text-slate-500">
                <Calculator aria-hidden="true" className="size-3.5" />
                상황 예시로 바로 설계{names[0] ? ` — 누르면 ${names[0].name} 숫자로` : ''}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {turn.plans.map((p) => (
                  <Link key={p.id} to={p.path} title={p.headline} className="tap t-meta inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:border-brand-300 hover:bg-slate-50" data-testid="home-ask-plan" data-module={p.module}>
                    {p.tag && <span className="shrink-0 text-brand-700" data-testid="home-ask-plan-tag">{p.tag === 'talk' ? '방금 말한 것' : '가정'}</span>}
                    <span className="shrink-0 text-slate-500">{p.moduleLabel}</span>
                    <span className="min-w-0 truncate">{p.title}</span>
                    {p.amount && <span className="shrink-0 text-brand-700">{p.amount}</span>}
                    <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {turn.docs && (
            // D-498 아직 저장 전 서류 — 한 번 누르면 서류함 · 새 업체 등록으로(저장 · 분류 · 분석은 원래 화면이)
            <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5" data-testid="home-ask-docsave">
              {turn.docs.saved ? (
                <p className="t-sub inline-flex items-center gap-1.5 font-semibold text-slate-600">
                  <Check aria-hidden="true" className="size-4 text-success-700" />
                  {turn.docs.saved === 'client' ? '서류함으로 넘겼어요 — 그 업체 화면에서 저장 · 분석까지 했어요' : '새 업체 등록 창으로 넘겼어요'}
                </p>
              ) : files.length > 0 ? (
                <>
                  <p className="t-sub break-keep text-slate-600">
                    올린 서류는 아직 저장 전이에요{turn.docs.company?.name ? ` — ${turn.docs.company.name}${turn.docs.company.clientId ? '' : '(등록 안 된 업체)'}` : ''}. 누르면 서류함에 넣고 회사 정보 · 판정까지 저장해요.
                  </p>
                  <Button size="sm" variant="primary" className="self-start" onClick={saveDocs} data-testid="home-ask-docsave-go" data-target={turn.docs.company?.clientId ? 'client' : 'new'}>
                    <FileUp aria-hidden="true" className="size-4" />
                    {turn.docs.company?.clientId ? `${turn.docs.company.name} 서류함에 넣기` : turn.docs.company?.name ? `새 업체로 등록 — ${turn.docs.company.name}` : '새 업체로 등록'}
                  </Button>
                </>
              ) : (
                <p className="t-sub break-keep text-slate-500">올린 파일은 저장 전이라 새로 고치면 사라져요 — 저장하려면 서류를 다시 올려 주세요.</p>
              )}
            </div>
          )}
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
