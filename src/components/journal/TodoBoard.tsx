/**
 * 오늘 할 일 — 대표가 직접 적은 것.
 *
 * 왜 맨 위인가
 *   규칙이 찾아 주는 경고(마감·서류·수금)는 "시스템이 아는 것" 이다. 그런데 하루를
 *   실제로 굴리는 것은 "내가 적어 둔 것" — 누구에게 전화할지, 어떤 서류를 요청할지다.
 *   전에는 규칙 경고가 화면 맨 위를 차지하고 내가 적은 것은 한참 아래에 있었다.
 *   순서를 뒤집었다.
 *
 * 어디에 저장되나
 *   업무 일기(ops_journal_entries)의 '할 일'(follow_up) 항목이다. 따로 만든 표가
 *   아니므로 일정 화면·일기 화면·업체 상세에서 같은 것이 보인다.
 */

import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, Plus, X } from 'lucide-react'
import type { JournalEntry } from '../../types/bridge'
import { TODO_PRESETS } from '../../services/journalService'
import { dueText } from '../../services/clientOpsAlerts'
import { daysLeftFrom } from '../../services/clientOpsAlerts'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/primitives'

export interface TodoDraft {
  content: string
  dueDate: string
  clientId: string | null
}

/**
 * 할 일 한 줄 적는 칸.
 *
 * 자주 쓰는 문구는 눌러서 앞부분을 채운다 — 매번 처음부터 치면 결국 안 적게 된다.
 * 업체를 고르는 것은 선택이다(고르면 그 업체 기록에서도 보인다).
 */
export function TodoComposer({
  date,
  clients,
  onAdd,
  autoFocus = false,
  compact = false,
}: {
  date: string
  clients: { id: string; companyName: string }[]
  onAdd: (draft: TodoDraft) => void
  autoFocus?: boolean
  compact?: boolean
}) {
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState('')
  const [open, setOpen] = useState(autoFocus)

  const submit = () => {
    const content = text.trim()
    if (content === '') return
    onAdd({ content, dueDate: date, clientId: clientId === '' ? null : clientId })
    setText('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap flex w-full items-center gap-2 rounded-(--radius-control) border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-slate-500 hover:border-brand-400 hover:text-brand-700"
      >
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        <span className="t-body">할 일 적기</span>
      </button>
    )
  }

  return (
    <div className="rounded-(--radius-control) border border-brand-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="예: 한솔테크 대표님 통화 — 벤처인증 서류 요청"
          aria-label="할 일 내용"
          className="t-body min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 py-2.5 focus:border-brand-500 focus:outline-none"
        />
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setOpen(false)}
          className="tap shrink-0 rounded-(--radius-control) p-2 text-slate-400 hover:bg-slate-100"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      {/* 자주 쓰는 문구 — 앞부분만 채우고 뒷말은 직접 쓴다 */}
      <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TODO_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setText((v) => (v.trim() === '' ? p.text : v))}
            className="t-meta shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium whitespace-nowrap text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!compact && clients.length > 0 && (
          <select
            aria-label="관련 업체"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-[0.92rem] sm:flex-none"
          >
            <option value="">업체 없음</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" size="sm" className="ml-auto" disabled={text.trim() === ''} onClick={submit}>
          <Plus aria-hidden="true" className="size-3.5" />
          넣기
        </Button>
      </div>
    </div>
  )
}

/**
 * 할 일 한 줄.
 *
 * 왼쪽 동그라미는 지금 상태를 보여 주고, 누르면 무엇을 할 수 있는지 시트로 펼친다.
 * 예전에는 체크상자였는데 눌러 보기 전에는 무슨 일이 일어나는지 알 수 없었다 —
 * 완료되는 건지, 지워지는 건지. 이름을 붙여 고르게 하는 편이 확실하다.
 */
export function TodoRow({
  entry,
  today,
  clientName,
  onPick,
}: {
  entry: JournalEntry
  today: string
  clientName?: string
  /** 상태 시트를 연다 — 업체로 가는 길도 그 안에 있다 */
  onPick: () => void
}) {
  const left = entry.dueDate ? daysLeftFrom(today, entry.dueDate) : null
  const overdue = !entry.completed && left !== null && left < 0

  return (
    <li
      className={`flex items-start gap-3 rounded-(--radius-card) border px-4 py-3.5 ${
        entry.completed
          ? 'border-slate-200 bg-white'
          : overdue
            ? 'border-danger-200 bg-danger-50/50'
            : 'border-brand-200 bg-white'
      }`}
    >
      <button
        type="button"
        aria-label={`${entry.content} — ${entry.completed ? '완료' : '진행 중'}. 눌러서 바꾸기`}
        onClick={onPick}
        className={`tap mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
          entry.completed
            ? 'border-success-500 bg-success-500 text-white'
            : 'border-slate-300 bg-white text-slate-400 hover:border-brand-500 hover:text-brand-600'
        }`}
      >
        {entry.completed ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4" />
        )}
      </button>

      <button type="button" onClick={onPick} className="min-w-0 flex-1 text-left">
        <span className={`t-body block break-keep ${entry.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {entry.content}
        </span>
        <span className="t-meta mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-500">
          {overdue && <span className="font-semibold text-danger-700">{dueText(left)}</span>}
          {entry.completed && <span className="text-success-700">완료</span>}
          {clientName && <span>{clientName}</span>}
        </span>
      </button>

    </li>
  )
}

/**
 * 할 일로 무엇을 할지 고르는 시트.
 *
 * 네 가지만 둔다 — 진행 중 / 완료 / 내일로 미루기 / 삭제.
 * '내일로 미루기' 가 있는 이유: 오늘 못 한 일을 그냥 두면 다음 날에도 빨갛게
 * 남아 목록이 밀린 것으로 뒤덮인다. 미루는 것도 정직한 처리다.
 */
export type TodoAction = 'open' | 'done' | 'tomorrow' | 'delete'

export function TodoActionSheet({
  entry,
  clientName,
  onPick,
  onOpenClient,
  onClose,
}: {
  entry: JournalEntry
  clientName?: string
  onPick: (action: TodoAction) => void
  /** 관련 업체가 있을 때만 */
  onOpenClient?: () => void
  onClose: () => void
}) {
  const rows: { action: TodoAction; label: string; hint: string; tone?: 'danger' }[] = [
    { action: 'open', label: '진행 중', hint: '아직 안 끝났습니다 (목록에 남습니다)' },
    { action: 'done', label: '완료', hint: '끝났습니다 (아래로 접힙니다)' },
    { action: 'tomorrow', label: '내일로 미루기', hint: '기한을 내일로 옮깁니다' },
    { action: 'delete', label: '삭제', hint: '기록에서 지웁니다 — 되돌릴 수 없습니다', tone: 'danger' },
  ]

  return (
    <BottomSheet title={entry.content} onClose={onClose}>
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const active = (r.action === 'done' && entry.completed) || (r.action === 'open' && !entry.completed)
          return (
            <button
              key={r.action}
              type="button"
              onClick={() => onPick(r.action)}
              className={`flex items-center gap-3 rounded-(--radius-control) border px-3 py-3 text-left ${
                active
                  ? 'border-brand-400 bg-brand-50'
                  : r.tone === 'danger'
                    ? 'border-danger-200 bg-white hover:bg-danger-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`t-body block font-semibold ${r.tone === 'danger' ? 'text-danger-700' : 'text-slate-900'}`}>
                  {r.label}
                </span>
                <span className="t-meta block break-keep text-slate-500">{r.hint}</span>
              </span>
              {active && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
            </button>
          )
        })}
      </div>

      {clientName && onOpenClient && (
        <Button variant="secondary" className="mt-3 w-full" onClick={onOpenClient}>
          <ArrowRight aria-hidden="true" className="size-4" />
          {clientName} 열기
        </Button>
      )}
    </BottomSheet>
  )
}
