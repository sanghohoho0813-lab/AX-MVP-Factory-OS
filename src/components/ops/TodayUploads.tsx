/**
 * D-657 오늘 — 고객이 올린 서류(올리기 링크로 들어와 아직 칸에 안 넣은 것).
 *
 * 예전에는 업체 서류함을 하나하나 열어야 누가 올렸는지 알았다. 오늘 머리 줄에 '받은 서류 n개' 단추 하나(없으면 안 그림) →
 * 판에 업체마다 한 줄 → [넣으러 가기] 를 누르면 그 업체 서류함이 '고객이 올린 서류' 판이 열린 채로 뜬다.
 * 모양은 '보낼 안내'(TodayNotices)와 같다 — 보낼 것 · 받은 것이 나란히.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, Inbox } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { BottomSheet } from '../ui/primitives'
import { uploadInboxHref, uploadInboxRows, type UploadInboxRow } from './useUploadInbox'

const SHOW = 5

export function TodayUploads({ clients, inbox, chip = false }: { clients: ClientOpsRecord[]; inbox: ReadonlyMap<string, number>; /** 휴대폰 — 숫자 한 줄의 칩 모양 */ chip?: boolean }) {
  const rows = useMemo(() => uploadInboxRows(clients, inbox), [clients, inbox])
  const total = rows.reduce((n, r) => n + r.waiting, 0)
  const [open, setOpen] = useState(false)
  if (!rows.length) return null
  return (
    <>
      {chip ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`고객이 올린 서류 ${total}개 — 눌러서 칸에 넣어요`}
          className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left hover:border-slate-300 hover:bg-slate-50"
          data-testid="today-uploads-open"
          data-count={total}
          data-guide="fn-today-uploads"
        >
          <Inbox aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          <span className="t-sub break-keep whitespace-nowrap text-slate-600">받은 서류</span>
          <strong className="t-body font-bold whitespace-nowrap text-brand-700 tabular-nums">{total}개</strong>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap t-sub inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand-700 hover:underline"
          data-testid="today-uploads-open"
          data-count={total}
          data-guide="fn-today-uploads"
        >
          <Inbox aria-hidden="true" className="size-4" />
          받은 서류 {total}개
        </button>
      )}
      {open && createPortal(<UploadsSheet rows={rows} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function UploadsSheet({ rows, onClose }: { rows: UploadInboxRow[]; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, SHOW)
  return (
    <BottomSheet title="고객이 올린 서류" onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="uploads-sheet">
        <p className="t-sub break-keep text-slate-700">누르면 그 업체 서류함에서 칸에 넣어요</p>
        <ul className="flex flex-col divide-y divide-slate-200">
          {shown.map((r) => (
            <li key={r.clientId} data-testid="uploads-row" data-client={r.clientId}>
              <Link
                to={uploadInboxHref(r.clientId)}
                onClick={onClose}
                className="tap flex min-h-12 items-center gap-2 py-2 hover:bg-slate-50"
                data-testid="uploads-go"
              >
                <span className="t-body min-w-0 flex-1 font-bold [overflow-wrap:anywhere] text-slate-900">{r.companyName}</span>
                <span className="t-sub shrink-0 font-semibold whitespace-nowrap text-brand-700 tabular-nums">{r.waiting}개</span>
                <span className="t-sub inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-slate-700">
                  넣으러 가기 <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {!all && rows.length > SHOW && (
          <button type="button" onClick={() => setAll(true)} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="uploads-more">
            {rows.length - SHOW}곳 더 보기
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
