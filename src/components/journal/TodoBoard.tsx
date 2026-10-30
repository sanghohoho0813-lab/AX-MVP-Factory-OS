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

import { useState, type LiHTMLAttributes } from 'react'
import { ClientPickerOptions } from '../ops/ClientPickerOptions'
import { ArrowRight, Check, Plus, X } from 'lucide-react'
import type { JournalEntry } from '../../types/bridge'
import { TODO_PRESETS } from '../../services/journalService'
import { ScrollHintRow } from '../ui/ScrollHintRow'
import { dueText } from '../../services/clientOpsAlerts'
import { daysLeftFrom } from '../../services/clientOpsAlerts'
import { Button } from '../ui/Button'
import { DueDateField } from '../ops/opsControls'
import { todayLocalDate } from '../../lib/appClock'
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
  clients: { id: string; companyName: string; businessNumber?: string; corporateNumber?: string }[]
  /** false 를 돌려주면(저장 실패) 적은 글을 비우지 않는다 — D-120 */
  onAdd: (draft: TodoDraft) => void | boolean | Promise<void | boolean>
  autoFocus?: boolean
  compact?: boolean
}) {
  const [text, setText] = useState('')
  const [clientId, setClientId] = useState('')
  const [open, setOpen] = useState(autoFocus)

  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const content = text.trim()
    if (content === '' || busy) return
    setBusy(true)
    const ok = await onAdd({ content, dueDate: date, clientId: clientId === '' ? null : clientId })
    setBusy(false)
    if (ok !== false) setText('')
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
            // D-210: 한글을 조합하는 중의 Enter 는 글자 확정이다(마지막 글자가 칸에 남거나 두 번 들어가지 않게)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
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
      {/* D-122: 오른쪽에 더 있으면 '›' · 이미 적은 글이 있으면 앞에 붙인다(예전엔 아무 일도 안 일어났다) */}
      <ScrollHintRow className="-mx-1 mt-2" innerClassName="flex gap-1 px-1" fade="from-white via-white/90">
        {TODO_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setText((v) => (v.trim() === '' ? p.text : v.startsWith(p.text) ? v : `${p.text}${v.trim()}`))}
            className="tap t-meta shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium whitespace-nowrap text-slate-600 hover:border-brand-300 hover:text-brand-700"
          >
            {p.label}
          </button>
        ))}
      </ScrollHintRow>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!compact && clients.length > 0 && (
          <select
            aria-label="관련 업체"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-[0.92rem] sm:flex-none"
          >
            <option value="">업체 없음</option>
            <ClientPickerOptions clients={clients} />
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
 * 줄을 누르면 무엇을 할 수 있는지(진행 중 · 완료 · 내일로 · 지우기) 시트로 펼친다.
 * 체크상자는 눌러 보기 전에는 완료인지 삭제인지 알 수 없었다 — 이름을 붙여 고르게 한다.
 * D-159: 왼쪽 동그라미도 뺐다 — 휴대폰 두 칸 그리드에 글이 들어갈 자리를 준다.
 */
export function TodoRow({
  entry,
  today,
  clientName,
  onPick,
  dragProps,
  number,
}: {
  /** D-158: 그날 적은 순서 번호(일정 달력) — 눈에 잘 띄게 */
  number?: number
  entry: JournalEntry
  today: string
  clientName?: string
  /** 상태 시트를 연다 — 업체로 가는 길도 그 안에 있다 */
  onPick: () => void
  /** D-157: 일정 달력(PC)에서 끌어 다른 날로 옮기기 */
  dragProps?: LiHTMLAttributes<HTMLLIElement>
}) {
  const left = entry.dueDate ? daysLeftFrom(today, entry.dueDate) : null
  const overdue = !entry.completed && left !== null && left < 0

  return (
    <li
      {...dragProps}
      className={`flex min-w-0 items-start rounded-(--radius-card) border px-3 py-3 sm:px-4 sm:py-3.5 ${dragProps?.draggable ? 'lg:cursor-grab ' : ''}${
        entry.completed
          ? 'border-slate-200 bg-white'
          : overdue
            ? 'border-slate-200 bg-white' // D-370 밀린 것도 흰 칸 — '55일 지남' 빨간 글자로 알린다
            : 'border-slate-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        aria-label={`${entry.content} — ${entry.completed ? '완료' : '진행 중'}. 눌러서 바꾸기`}
        className="tap min-w-0 flex-1 text-left"
      >
        {/* D-159: 번호는 글 앞에 붙여 흐르게 — 두 칸 그리드에서 번호 칸만큼 글 폭이 줄지 않게 */}
        <span className={`t-body block break-keep [overflow-wrap:anywhere] ${entry.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {number !== undefined && (
            <span aria-hidden="true" data-testid="todo-number" className={`mr-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 align-[0.1em] text-[0.85rem] leading-none font-bold ${entry.completed ? 'bg-slate-100 text-slate-400' : 'bg-brand-600 text-white'}`}>
              {number}
            </span>
          )}
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
 * 할 일 한 창 — 내용 · 기한 · 업체를 바로 고치고, 같은 창에서 진행 중 / 완료 / 내일로 / 지우기.
 *
 * D-201(대표 요청): 예전에는 [내용 고치기] 를 한 번 더 눌러 다른 창으로 들어가야 날짜 · 이름을 바꿀 수 있었다.
 * 이제 창을 열면 칸이 처음부터 열려 있다. 고친 뒤 [저장] 을 누르거나, 그냥 상태 단추(완료 등)를
 * 누르면 고친 내용까지 한 번에 저장된다. 고친 것이 있는데 닫으려 하면 한 번 묻는다(적은 것이 사라지지 않게).
 *
 * '내일로 미루기' 가 있는 이유: 오늘 못 한 일을 그냥 두면 다음 날에도 빨갛게
 * 남아 목록이 밀린 것으로 뒤덮인다. 미루는 것도 정직한 처리다.
 */
export type TodoAction = 'open' | 'done' | 'today' | 'tomorrow' | 'delete'

/** 창에서 고친 칸 — 상태 단추와 함께 한 번에 저장된다 */
export interface TodoEdits {
  content: string
  dueDate: string
  clientId: string | null
}

export function TodoActionSheet({
  entry,
  clientName,
  clients = [],
  onPick,
  onSave,
  onOpenClient,
  onClose,
}: {
  entry: JournalEntry
  clientName?: string
  /** 업체를 바꿀 수 있게 — 없으면 업체 칸을 숨긴다 */
  clients?: { id: string; companyName: string; businessNumber?: string; corporateNumber?: string }[]
  /** 상태 단추 — 고친 칸이 있으면 edits 로 함께 넘긴다(한 번에 저장) */
  onPick: (action: TodoAction, edits?: TodoEdits) => void
  /** [저장] — 적어 둔 내용 · 기한 · 업체만 고칠 때. false 를 돌려주면(실패) 창을 그대로 둔다 */
  onSave?: (patch: TodoEdits) => unknown
  /** 업체 화면 열기 — 창에서 지금 고른 업체로(업체를 바꾸면 바꾼 업체가 열린다) */
  onOpenClient?: (clientId: string) => void
  onClose: () => void
}) {
  /*
   * 적고 나서 고칠 수 있어야 한다.
   * 통화 중에 급히 적은 한 줄은 대개 나중에 다듬게 된다 — 고칠 수 없으면
   * 지우고 다시 적게 되고, 그러면 언제 적었는지가 사라진다.
   */
  const editable = !!onSave
  const [content, setContent] = useState(entry.content)
  const [dueDate, setDueDate] = useState(entry.dueDate)
  const today = todayLocalDate()
  const [clientId, setClientId] = useState(entry.clientId ?? '')
  /*
   * 지금 붙어 있는 업체가 목록(보관·종료 제외)에 없어도 고르는 칸에서 사라지면 안 된다 —
   * 저장하는 순간 소리 없이 '업체 없음' 이 된다. 그래서 목록 맨 위에 그대로 남겨 둔다.
   */
  const clientOptions =
    entry.clientId && clientName && !clients.some((c) => c.id === entry.clientId)
      ? [{ id: entry.clientId, companyName: clientName }, ...clients]
      : clients

  const edits: TodoEdits = { content: content.trim(), dueDate, clientId: clientId === '' ? null : clientId }
  const dirty =
    editable && (edits.content !== entry.content.trim() || edits.dueDate !== entry.dueDate || edits.clientId !== (entry.clientId ?? null))
  const emptyContent = edits.content === ''
  // D-210: 할 일은 기한이 있어야 오늘 · 달력에 보인다 — 비우면(기한 없애기) 전체 기록에만 남아 사라진 것처럼 됐다
  const emptyDue = editable && edits.dueDate === '' && entry.dueDate !== ''
  const invalid = emptyContent || emptyDue

  const [saving, setSaving] = useState(false)
  /** D-122: 저장이 된 뒤에만 닫는다 — false 가 오면(실패) 고치던 칸 그대로 */
  const save = async () => {
    if (!onSave || invalid || saving || !dirty) return false
    setSaving(true)
    const ok = await onSave(edits)
    setSaving(false)
    return ok !== false
  }
  /** 상태 단추 — 고친 칸이 있으면 같이 넘긴다(지우기는 고친 것과 상관없다) */
  const pick = (action: TodoAction) => {
    if (action !== 'delete' && dirty && invalid) return
    onPick(action, action !== 'delete' && dirty ? edits : undefined)
  }
  /** 삭제는 한 번 더 묻는다(D-122) */
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** 고친 것이 있는데 닫으려 하면 한 번 묻는다 */
  const [confirmClose, setConfirmClose] = useState(false)
  /** D-210: 닫은 뒤 할 일 — '(업체) 열기' 도 고친 것이 있으면 먼저 묻는다(예전: 묻지 않고 업체로 넘어가 고친 것이 사라졌다) */
  const [afterClose, setAfterClose] = useState<{ run: () => void; label: string; what: string } | null>(null)
  const requestClose = (next?: { run: () => void; label: string; what: string }) => {
    if (!dirty) return (next?.run ?? onClose)()
    setAfterClose(next ?? null)
    setConfirmClose(true)
  }
  const leave = () => (afterClose?.run ?? onClose)()

  // D-240: '업체 열기' 는 지금 고른 업체 — 붙어 있던 업체가 목록에 없으면 받은 이름으로
  const openId = editable ? clientId : (entry.clientId ?? '')
  const openName = openId === '' ? undefined : (clientOptions.find((c) => c.id === openId)?.companyName ?? (openId === entry.clientId ? clientName : undefined))
  const showClientPick = editable && (clientOptions.length > 0 || clientId !== '')

  // D-167: 밀린(빨간) 할 일은 맨 위에 '오늘 할 일로' — 기한을 오늘로 옮겨 밀린 것에서 뺀다(대표 요청)
  const overdue = !entry.completed && entry.dueDate !== '' && entry.dueDate < today
  const statusBtn = (action: TodoAction, label: string, hint: string, active = false, tone?: 'danger') => (
    <button
      key={action}
      type="button"
      data-todo-action={action}
      aria-pressed={action === 'open' || action === 'done' ? active : undefined}
      disabled={action !== 'delete' && dirty && invalid}
      onClick={() => (action === 'delete' ? setConfirmDelete(true) : pick(action))}
      className={`tap flex min-h-14 min-w-0 items-center gap-2 rounded-(--radius-control) border px-3 py-2.5 text-left disabled:opacity-50 ${
        active
          ? 'border-brand-500 bg-brand-50'
          : tone === 'danger'
            ? 'border-danger-200 bg-white hover:bg-danger-50'
            : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className={`t-body block font-semibold break-keep ${tone === 'danger' ? 'text-danger-700' : active ? 'text-brand-800' : 'text-slate-900'}`}>{label}</span>
        <span className="t-meta block break-keep text-slate-500">{hint}</span>
      </span>
      {active && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
    </button>
  )

  return (
    <BottomSheet
      title="할 일"
      onClose={() => requestClose()}
      footer={
        confirmClose ? (
          <div role="alertdialog" aria-label="고친 내용 저장 확인" data-testid="todo-close-confirm" className="flex flex-col gap-2">
            <p className="t-body font-semibold break-keep text-slate-900">{afterClose ? `고친 내용이 있습니다. ${afterClose.what} 전에 저장할까요?` : '고친 내용이 있습니다. 저장할까요?'}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setConfirmClose(false)}>계속 고치기</Button>
              <Button onClick={leave}>저장 안 하고 {afterClose?.label ?? '닫기'}</Button>
              <Button variant="primary" disabled={invalid || saving} onClick={() => void save().then((ok) => ok && leave())}>
                저장하고 {afterClose?.label ?? '닫기'}
              </Button>
            </div>
          </div>
        ) : editable ? (
          <div className="flex items-center justify-end gap-2">
            <span className={`t-meta mr-auto break-keep text-slate-500 ${dirty ? '' : 'hidden sm:inline'}`}>{dirty ? '고친 내용이 있습니다' : '칸을 눌러 바로 고칠 수 있습니다'}</span>
            <Button onClick={() => requestClose()}>닫기</Button>
            <Button variant="primary" data-testid="todo-save" disabled={!dirty || invalid || saving} onClick={() => void save()}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {/*
         * D-240(대표 요청): 맨 위 한 줄에 '할 일' · 업체 고르기 · 그 업체 열기 → 내용 → 어떻게 할까요 → 언제까지.
         * 상태 단추를 기한보다 위에 — 창을 여는 까닭은 대개 '끝났다 · 미룬다' 이고, 기한은 가끔 고친다.
         */}
        <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="todo-head">
          <span className="t-sub shrink-0 font-medium text-slate-700">할 일</span>
          {/* 업체를 잘못 붙였거나 안 붙였을 때 — 지우고 다시 적지 않아도 된다 */}
          {showClientPick && (
            <select
              aria-label="할 일 업체 고치기"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="t-sub h-10 min-w-0 flex-1 basis-36 rounded-(--radius-control) border border-slate-300 bg-white px-2.5"
            >
              <option value="">업체 없음</option>
              <ClientPickerOptions clients={clientOptions} />
            </select>
          )}
          {openName && onOpenClient && (
            <Button
              size="sm"
              className="ml-auto"
              aria-label={`${openName} 열기`}
              title={`${openName} 열기`}
              onClick={() => requestClose({ run: () => onOpenClient(openId), label: '열기', what: `${openName} 열기` })}
              data-testid="todo-open-client"
            >
              <ArrowRight aria-hidden="true" className="size-4" />
              업체 열기
            </Button>
          )}
        </div>
        {editable ? (
          <label className="block">
            <textarea
              aria-label="할 일 내용 고치기"
              value={content}
              rows={2}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
              }}
              className={`t-body w-full resize-y rounded-(--radius-control) border px-3 py-2.5 focus:border-brand-500 focus:outline-none ${emptyContent ? 'border-danger-300' : 'border-slate-300'}`}
            />
            {emptyContent && <span className="t-meta text-danger-700">할 일을 적어 주세요.</span>}
          </label>
        ) : (
          <p className="t-body break-keep [overflow-wrap:anywhere] text-slate-900">{entry.content}</p>
        )}

        <div className="flex flex-col gap-1.5" data-testid="todo-actions">
          <span className="t-sub font-medium text-slate-700">어떻게 할까요?{dirty ? ' (누르면 고친 내용도 함께 저장)' : ''}</span>
          {overdue && statusBtn('today', '오늘 할 일로 바꾸기', `기한을 오늘로 (지금 ${entry.dueDate})`)}
          <div className="grid grid-cols-2 gap-1.5">
            {statusBtn('open', '진행 중', '목록에 남습니다', !entry.completed)}
            {statusBtn('done', '완료', '끝난 일로 접힙니다', entry.completed)}
            {statusBtn('tomorrow', '내일로 미루기', '기한을 내일로')}
            {statusBtn('delete', '지우기', '되돌릴 수 없습니다', false, 'danger')}
          </div>
          {/* 지울지 묻는 칸은 [지우기] 바로 아래 — 기한 칸 밑으로 밀려나지 않게 */}
          {confirmDelete && (
            <div role="alertdialog" aria-label="할 일 삭제 확인" data-testid="todo-delete-confirm" className="mt-1 flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3">
              <p className="t-body font-semibold break-keep text-danger-800">이 할 일을 지울까요? 되돌릴 수 없습니다.</p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => onPick('delete')}>
                  네, 지웁니다
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>취소</Button>
              </div>
            </div>
          )}
        </div>

        {editable && (
          <>
            {/* D-126: 다른 곳과 같은 오늘 · 내일 · 1주 단추 */}
            <DueDateField label="언제까지" ariaLabel="할 일 기한 고치기" value={dueDate} today={today} onChange={setDueDate} clearable={entry.dueDate === ''} clearLabel="기한 없애기" />
            {emptyDue && <span className="t-meta -mt-2 text-danger-700" data-testid="todo-due-required">언제까지 할지 날짜를 정해 주세요(날짜가 없으면 오늘 · 달력에 안 보여요).</span>}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
