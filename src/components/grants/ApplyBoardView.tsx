/**
 * 신청 진행판 (D-152) — 모든 업체의 지원사업 신청 건을 한 판에.
 *   서류 준비(마감 가까운 순 · 서류 n/m · 받을 것) → 결과 기다림(발표 가까운 순) → 최근 결과(선정 · 탈락 · 성공보수).
 * 줄을 누르면 그 업체의 '지원사업 신청' 탭.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, Copy } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { applicationBoard, grantDocRequestMessage, grantYearStats, type BoardRow } from '../../services/grants/grantApply'
import { formatKrwCompact } from '../../lib/format'
import { dueText } from '../../services/clientOpsAlerts'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'

const md = (iso: string | null | undefined) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

function Row({ row, record, today }: { row: BoardRow; record: ClientOpsRecord | undefined; today: string }) {
  const { showToast } = useToast()
  const urgent = row.stage === 'preparing' && row.daysLeft !== null && row.daysLeft <= 7
  const when =
    row.stage === 'preparing'
      ? row.app.applyDueDate
        ? `마감 ${md(row.app.applyDueDate)}${row.app.applyDueTime ? ` ${row.app.applyDueTime}` : ''} · ${dueText(row.daysLeft)}`
        : '마감 없음'
      : row.stage === 'waiting'
        ? row.app.resultDueDate
          ? `결과 발표 ${md(row.app.resultDueDate)} · ${dueText(row.daysLeft)}`
          : `접수 ${md(row.app.submittedAt)} · 결과 발표일 모름`
        : `${row.stage === 'selected' ? '선정' : row.app.status === 'rejected' ? '탈락' : '포기'} ${md(row.app.resultAt)}`
  const fee = row.stage === 'selected' && record ? record.fees.find((f) => f.id === row.app.successFeeId) : undefined
  return (
    <li className={`flex flex-col gap-1.5 px-3 py-3 ${urgent ? 'bg-warning-50/50' : ''}`} data-testid="board-row" data-stage={row.stage} data-client={row.clientId}>
      <Link to={`/ops/clients/${row.clientId}?tab=funding`} className="tap flex items-start gap-2 text-left">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-body font-semibold [overflow-wrap:anywhere] text-slate-900">{row.app.programName || '(사업 이름 없음)'}</span>
          <span className="t-sub text-slate-600">
            <b className="font-semibold text-slate-800">{row.clientName}</b> · <span className={urgent ? 'font-semibold text-warning-800' : ''}>{when}</span>
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400" />
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {row.stage === 'preparing' && row.total !== null && (
          <span className={`t-sub rounded-full border px-2.5 py-0.5 font-semibold ${row.ready === row.total ? 'border-success-200 bg-success-50 text-success-700' : 'border-slate-200 bg-white text-slate-700'}`} data-testid="board-ready">
            {row.ready === row.total ? '서류 다 모음' : `서류 ${row.ready}/${row.total}`}
          </span>
        )}
        {row.stage === 'preparing' && row.needFromClient > 0 && record && (
          <Button
            size="sm"
            variant="secondary"
            data-testid="board-copy"
            onClick={async () => {
              const ok = await copyText(grantDocRequestMessage(record, row.app, today))
              showToast(ok ? `${row.clientName} 서류 요청 문구를 복사했습니다 — ${row.needFromClient}가지` : '복사하지 못했습니다')
            }}
          >
            <Copy aria-hidden="true" className="size-4" /> 받을 서류 {row.needFromClient}가지 카톡 문구
          </Button>
        )}
        {row.stage === 'selected' &&
          (fee ? (
            <span className="t-sub font-semibold text-success-700">성공보수 수금에 걸림</span>
          ) : (
            <Link to={`/ops/clients/${row.clientId}?tab=funding`} className="tap t-sub inline-flex min-h-11 items-center rounded-full border border-warning-200 bg-warning-50 px-3 font-semibold text-warning-800" data-testid="board-fee-missing">
              성공보수 아직 안 걸림 → 걸기
            </Link>
          ))}
      </div>
    </li>
  )
}

function Group({ title, rows, records, today, empty, testId }: { title: string; rows: BoardRow[]; records: Map<string, ClientOpsRecord>; today: string; empty: string; testId: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h3 className="t-body font-semibold text-slate-900">
        {title} <span className="text-brand-700">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="t-sub rounded-(--radius-control) border border-dashed border-slate-200 px-3 py-3 text-slate-500">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
          {rows.map((r) => (
            <Row key={`${r.clientId}:${r.app.id}`} row={r} record={records.get(r.clientId)} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** D-153: 올해 지원사업 성과 — 접수 · 선정(선정률) · 선정 금액 · 성공보수(받은 돈 / 건 돈) */
function YearStats({ records, today }: { records: ClientOpsRecord[]; today: string }) {
  const st = grantYearStats(records, Number(today.slice(0, 4)))
  const tiles: [string, string, string][] = [
    ['접수', `${st.submitted}건`, 'stat-submitted'],
    ['선정', st.selectionRate === null ? `${st.selected}건` : `${st.selected}건 · 선정률 ${Math.round(st.selectionRate * 100)}%`, 'stat-selected'],
    ['선정 금액', st.approvedTotal ? formatKrwCompact(st.approvedTotal) : '0원', 'stat-approved'],
    ['성공보수', st.feeTotal ? `${formatKrwCompact(st.feeReceived) || '0원'} 받음 / ${formatKrwCompact(st.feeTotal)}` : '0원', 'stat-fee'],
  ]
  return (
    <section aria-label={`${st.year}년 지원사업 성과`} className="flex flex-col gap-2" data-testid="board-stats">
      <h3 className="t-body font-semibold text-slate-900">{st.year}년 지원사업 성과</h3>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map(([k, v, id]) => (
          <div key={k} className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid={id}>
            <dt className="t-sub text-slate-500">{k}</dt>
            <dd className="t-body font-bold [overflow-wrap:anywhere] text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ApplyBoardView({ records, today }: { records: ClientOpsRecord[]; today: string }) {
  const board = applicationBoard(records, today)
  const byId = new Map(records.map((r) => [r.id, r]))
  return (
    <div className="flex flex-col gap-5" data-testid="apply-board">
      <YearStats records={records} today={today} />
      <p className="t-sub break-keep text-slate-600">
        공고 창에서 [신청 준비] 를 누른 업체가 여기 모입니다. 줄을 누르면 그 업체의 낼 서류 · 접수 · 결과 · 성공보수를 고칠 수 있어요.
        {board.feeMissing > 0 && <b className="text-warning-800"> 선정됐는데 성공보수를 안 건 곳 {board.feeMissing}곳.</b>}
      </p>
      <Group title="서류 준비" rows={board.preparing} records={byId} today={today} testId="board-preparing" empty="서류 준비 중인 신청이 없습니다. 지원사업 알림 공고 창에서 업체 옆 [신청 준비] 를 눌러 시작하세요." />
      <Group title="접수 · 결과 기다림" rows={board.waiting} records={byId} today={today} testId="board-waiting" empty="접수하고 결과를 기다리는 신청이 없습니다." />
      <Group title="최근 결과(90일)" rows={board.done} records={byId} today={today} testId="board-done" empty="최근 90일 안에 결과가 난 신청이 없습니다." />
    </div>
  )
}
