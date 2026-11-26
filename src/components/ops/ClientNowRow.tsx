/**
 * D-660 이 업체에서 지금 할 것 — 업체 머리 한 줄(있을 때만).
 *
 * 오늘 화면의 '받은 서류' · '보낼 안내' 와 서류함의 '요청한 서류' 가 업체 화면에서는 탭 안에 들어가 있어,
 * 개요 · 업무 탭을 보고 있으면 지금 이 업체에 무엇이 걸려 있는지 몰랐다. 같은 것을 같은 모양(작은 알약)으로 머리에 —
 *   받은 서류 n개(고객이 올리기 링크로 올림) → 넣기 판 · 보낼 안내 n건 → 문구 판 · 서류 요청 n일째 n/m → 서류함.
 * 규칙만 본다(새 판정 0 · AI 0). 서류 탭에서는 그 탭이 같은 줄을 이미 보여 주므로 서류 알약 둘은 그리지 않는다.
 */
import { useMemo } from 'react'
import { Inbox, MailQuestion } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { requestSummary } from '../../services/docRequests'
import { outboundNotices } from '../../services/outbound'
import { useSenderLine } from '../layout/useCurrentUser'
import { TodayNotices } from './TodayNotices'

const PILL = 'tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left hover:border-slate-300 hover:bg-slate-50'

export function ClientNowRow({
  record,
  today,
  workspaceId,
  uploads,
  onUploads,
  onDocs,
  onSaved,
  inDocs,
}: {
  record: ClientOpsRecord
  today: string
  workspaceId: string | null
  /** 고객이 올리고 아직 칸에 안 넣은 서류 수 */
  uploads: number
  onUploads: () => void
  onDocs: () => void
  /** [보냈어요] 로 저장된 기록을 화면에 */
  onSaved: (record: ClientOpsRecord) => void
  /** 서류 탭을 보고 있다 — 서류 알약 둘은 그 탭이 이미 보여 준다 */
  inDocs: boolean
}) {
  const sender = useSenderLine()
  const list = useMemo(() => [record], [record])
  const notices = useMemo(() => (record.archivedAt ? 0 : outboundNotices(list, today, sender).length), [list, record.archivedAt, today, sender])
  const req = inDocs ? null : requestSummary(record, today)
  const showUploads = uploads > 0 && !inDocs
  if (!showUploads && !notices && !req) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="client-now" aria-label="이 업체에서 지금 할 것">
      {showUploads && (
        <button type="button" onClick={onUploads} className={PILL} data-testid="now-uploads" data-count={uploads} aria-label={`고객이 올린 서류 ${uploads}개 — 눌러서 칸에 넣어요`}>
          <Inbox aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          <span className="t-sub whitespace-nowrap text-slate-600">받은 서류</span>
          <strong className="t-body font-bold whitespace-nowrap text-brand-700 tabular-nums">{uploads}개</strong>
        </button>
      )}
      {notices > 0 && <TodayNotices chip clients={list} today={today} workspaceId={workspaceId} onSaved={onSaved} />}
      {req && (
        <button type="button" onClick={onDocs} className={PILL} data-testid="now-docreq" data-done={req.done ? '1' : '0'}>
          <MailQuestion aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          <span className="t-sub whitespace-nowrap text-slate-600">{req.done ? '요청한 서류' : `서류 요청 ${req.waitingDays === 0 ? '오늘' : `${req.waitingDays}일째`}`}</span>
          <strong className={`t-body font-bold whitespace-nowrap tabular-nums ${req.done ? 'text-success-700' : req.waitingDays >= 3 ? 'text-danger-700' : 'text-brand-700'}`}>
            {req.done ? '다 받음' : `${req.got}/${req.total}`}
          </strong>
        </button>
      )}
    </div>
  )
}
