import { useRef, useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { JournalEntryType } from '../../types/bridge'
import { JOURNAL_TYPES, JOURNAL_TYPE_LABEL, type CreateJournalInput } from '../../services/journalService'
import { DueDateField } from '../ops/opsControls'
import { todayLocalDate } from '../../lib/appClock'

/**
 * 빠른 기록 — "무슨 일이 있었나요?" 한 줄이면 저장된다.
 * 유형(메모·통화·결정·후속조치·막힘·성과·아이디어)과 고객 연결은 선택.
 * 후속조치는 기한을 받아 홈의 "오늘 반드시"에 올라간다. Ctrl/Cmd+Enter 로 저장.
 */
export function QuickCapture({
  clients,
  defaultClientId = null,
  onCreate,
  compact = false,
  autoFocus = false,
}: {
  clients: ClientOpsRecord[]
  defaultClientId?: string | null
  onCreate: (input: CreateJournalInput) => Promise<void>
  compact?: boolean
  autoFocus?: boolean
}) {
  const [type, setType] = useState<JournalEntryType>('note')
  const [content, setContent] = useState('')
  const [clientId, setClientId] = useState<string>(defaultClientId ?? '')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const submit = async () => {
    const text = content.trim()
    if (!text) {
      setError('내용을 적어 주세요.')
      textRef.current?.focus()
      return
    }
    if (type === 'follow_up' && !dueDate) {
      setError('후속조치는 언제까지 할지 날짜를 정해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onCreate({
        content: text,
        entryType: type,
        clientId: clientId || null,
        dueDate: type === 'follow_up' ? dueDate : '',
      })
      setContent('')
      setDueDate('')
      if (type !== 'note') setType('note')
      textRef.current?.focus()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  /* 무엇이든 적기 시작하기 전에는 종류·고객사 선택을 보여주지 않는다.
     처음 보이는 것이 빈 칸 하나뿐이어야 손이 먼저 나간다. */
  const expanded = open || content.trim().length > 0

  return (
    <div className={`rounded-(--radius-panel) border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        rows={expanded ? (compact ? 3 : 4) : 2}
        placeholder={
          type === 'call'
            ? '누구와 통화했고 무엇을 정했나요?'
            : type === 'decision'
              ? '무엇을, 왜 그렇게 결정했나요?'
              : type === 'follow_up'
                ? '무엇을 언제까지 해야 하나요?'
                : type === 'blocker'
                  ? '무엇이 막혀 있고 누가 풀 수 있나요?'
                  : '무슨 일이 있었나요?'
        }
        aria-label="기록 내용"
        className="t-body w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-3 focus:border-brand-500 focus:outline-none"
      />

      {expanded && (
        <>
          <div role="radiogroup" aria-label="기록 종류" className="mt-3 flex flex-wrap gap-1.5">
            {JOURNAL_TYPES.map((t) => {
              const on = t === type
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(t)}
                  className={`t-sub tap rounded-full border px-3 py-1.5 font-medium ${
                    on
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {JOURNAL_TYPE_LABEL[t]}
                </button>
              )
            })}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="연결할 고객사"
              className="t-sub h-11 min-w-0 max-w-full rounded-(--radius-control) border border-slate-300 px-2.5 text-slate-700 focus:border-brand-500 focus:outline-none sm:h-10"
            >
              <option value="">고객사 연결 안 함</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
            {type === 'follow_up' && (
              <div className="min-w-0">
                <DueDateField value={dueDate} onChange={setDueDate} label="언제까지" today={todayLocalDate()} />
              </div>
            )}
            <span className="t-meta ml-auto hidden text-slate-500 sm:inline">Ctrl+Enter 저장</span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="t-body tap inline-flex h-11 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:h-10"
            >
              <Send aria-hidden="true" className="size-4" />
              {busy ? '저장 중…' : '기록'}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="t-sub mt-2 text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
