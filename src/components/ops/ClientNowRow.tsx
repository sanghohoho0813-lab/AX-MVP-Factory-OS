/**
 * D-660 · D-667 이 업체에서 지금 할 것 — 알약 하나(있을 때만).
 *
 * 오늘 화면의 '받은 서류' · '보낼 안내' 와 서류함의 '요청한 서류' 가 업체 화면에서는 탭 안에 들어가 있어,
 * 개요 · 업무 탭을 보고 있으면 지금 이 업체에 무엇이 걸려 있는지 몰랐다.
 *   받은 서류 n개(고객이 올리기 링크로 올림) → 넣기 판 · 보낼 안내 n건 → 문구 판 · 서류 요청 n일째 n/m → 서류함.
 * D-667 글자 수 한도(D-627): 알약을 머리에 한 줄로 늘어놓으니 업체 탭마다 6 ~ 20자가 늘어 한도를 넘었다.
 *   → 알약은 **하나**, 탭 아래 '일 순서 안내' 접힌 줄의 글자 자리에 대신 선다(글자 수 그대로).
 *   하나뿐이면 그 일 이름('보낼 안내 1') · 누르면 바로 그 판, 여럿이면 '지금 할 것 n' · 누르면 한 줄씩.
 * 규칙만 본다(새 판정 0 · AI 0). 서류 탭에서는 그 탭이 같은 줄을 이미 보여 주므로 서류 두 가지는 세지 않는다.
 */
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Inbox, ListChecks, MailQuestion, Send, type LucideIcon } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { BottomSheet } from '../ui/primitives'
import { NoticesSheet } from './TodayNotices'
import type { NowItem, NowKind } from './clientNow'

const ICON: Record<NowKind, LucideIcon> = { uploads: Inbox, notices: Send, docreq: MailQuestion }

/** 알약 하나 — 하나뿐이면 그 일로 바로, 여럿이면 목록 판으로 */
export function ClientNowPill({ items, onRun }: { items: NowItem[]; onRun: (what: NowKind | 'list') => void }) {
  if (!items.length) return null
  const one = items.length === 1 ? items[0] : null
  const Icon = one ? ICON[one.kind] : ListChecks
  const full = items.map((i) => `${i.label} ${i.value}`).join(' · ')
  return (
    <button
      type="button"
      onClick={() => onRun(one ? one.kind : 'list')}
      aria-label={`이 업체에서 지금 할 것 — ${full}`}
      title={full}
      className="tap t-sub -my-1 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 font-bold whitespace-nowrap hover:border-slate-300 hover:bg-slate-50"
      data-testid="client-now"
      data-count={items.length}
      data-kind={one?.kind ?? 'many'}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
      <span className={`tabular-nums ${items.some((i) => i.danger) ? 'text-danger-700' : 'text-brand-700'}`}>{one ? one.short : `지금 할 것 ${items.length}`}</span>
    </button>
  )
}

/** 알약이 여는 판 둘 — 목록(여럿일 때) · 보낼 안내 문구(이 업체 것만). 알약이 사라져도(다 보냄) 판은 닫을 때까지 남는다 */
export function ClientNowSheets({
  sheet,
  items,
  record,
  today,
  workspaceId,
  onRun,
  onSaved,
  onClose,
}: {
  sheet: 'list' | 'notices' | null
  items: NowItem[]
  record: ClientOpsRecord
  today: string
  workspaceId: string | null
  onRun: (what: NowKind) => void
  /** [보냈어요] 로 저장된 기록을 화면에 */
  onSaved: (record: ClientOpsRecord) => void
  onClose: () => void
}) {
  const list = useMemo(() => [record], [record])
  if (sheet === 'notices') return <NoticesSheet clients={list} today={today} workspaceId={workspaceId} onSaved={onSaved} onClose={onClose} />
  if (sheet !== 'list') return null
  return createPortal(
    <BottomSheet title="이 업체에서 지금 할 것" onClose={onClose}>
      <ul className="flex flex-col divide-y divide-slate-200" data-testid="client-now-sheet">
        {items.map((i) => {
          const Icon = ICON[i.kind]
          return (
            <li key={i.kind}>
              <button type="button" onClick={() => onRun(i.kind)} className="tap flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-slate-50" data-testid={`now-${i.kind}`}>
                <Icon aria-hidden="true" className="size-5 shrink-0 text-slate-500" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="t-body font-bold break-keep text-slate-900">{i.label}</span>
                  <strong className={`t-body font-bold tabular-nums ${i.danger ? 'text-danger-700' : 'text-brand-700'}`}>{i.value}</strong>
                </span>
                <span className="t-sub shrink-0 font-semibold whitespace-nowrap text-brand-700">{i.go}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              </button>
            </li>
          )
        })}
        {items.length === 0 && <li className="t-body py-2 break-keep text-slate-700">지금 할 것을 다 했어요.</li>}
      </ul>
    </BottomSheet>,
    document.body,
  )
}
