/**
 * 오늘 — 안부 챙길 계약 고객 (D-155).
 * 한 달 넘게 조용한 계약 고객 · 계약 1주년이 다가오는 고객. 줄마다 [안부 카톡] [연락했어요] [다음에] , 1주년은 [성과 보고서].
 * D-684 계약 끝나는 날이 30일 안(끝난 뒤 30일까지) — [재계약 문구] [성과 보고서] [재계약했어요](새 끝나는 날 고르기) [연락했어요](7일 뒤 다시) [다음에].
 * 챙길 곳이 없으면 칸을 그리지 않는다 — 오늘 화면을 길게 만들지 않으려고.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Check, Copy, FileText, HeartHandshake, RefreshCcw } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { careList, careMessage, careSnoozeUntil, withCareContactFor, withCareSnooze, type CareItem } from '../../services/clientCare'
import { addDay, contractEnd, endAfterYears, renewalDefaultEnd, renewalYears, withRenewal } from '../../services/contractRenewal'
import { BottomSheet } from '../ui/primitives'
import { listClients, saveClient } from '../../services/clientOpsService'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'
import { useSenderLine } from '../layout/useCurrentUser'
import { Fold } from '../ui/fold'

const SHOW = 4

export function TodayCare({
  clients,
  today,
  workspaceId,
  onSaved,
}: {
  clients: ClientOpsRecord[]
  today: string
  /** D-212: 누르기 직전에 이 작업실 기록을 새로 읽는다 */
  workspaceId: string | null
  onSaved: (record: ClientOpsRecord) => void
}) {
  const { showToast } = useToast()
  const sender = useSenderLine()
  const items = useMemo(() => careList(clients, today), [clients, today])
  const [busy, setBusy] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const [renewing, setRenewing] = useState<CareItem | null>(null)
  if (items.length === 0) return null
  const byId = new Map(clients.map((c) => [c.id, c]))

  const save = async (id: string, change: (r: ClientOpsRecord) => ClientOpsRecord, done: string) => {
    const rec = byId.get(id)
    if (!rec || busy) return
    setBusy(id)
    try {
      // D-212: 오늘 화면을 아침에 열어 둔 채 다른 창 · 팀장이 이 업체에 메모 · 수수료를 적었으면, 처음 읽어 둔 기록으로 저장해 그것을 지웠다 — 저장 직전에 새로 읽는다
      const fresh = (await listClients(workspaceId).catch(() => null))?.find((c) => c.id === id) ?? rec
      onSaved(await saveClient(change(fresh)))
      showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  const shown = all ? items : items.slice(0, SHOW)
  return (
    // D-192: 접어 두고 숫자만 — 설명은 목차에 마우스를 올리거나 ⓘ
    <Fold
      id="today.care"
      title="안부 챙길 계약 고객"
      headingId="today-care-title"
      testId="today-care"
      icon={
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-nav-ops">
          <HeartHandshake className="size-4" />
        </span>
      }
      count={items.length}
    >
      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white">
        {shown.map((it) => {
          const rec = byId.get(it.clientId)
          return (
            <li key={it.clientId} className="flex flex-col gap-2 px-4 py-3" data-testid="care-row" data-reason={it.reason} data-client={it.clientId}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <Link to={`/ops/clients/${it.clientId}`} className="tap t-sub inline-flex items-center font-bold [overflow-wrap:anywhere] text-slate-900 hover:text-brand-700 hover:underline">
                  {it.companyName}
                </Link>
                <span className={`t-sub min-w-0 flex-[1_1_12rem] break-keep ${it.urgent ? 'font-semibold text-warning-800' : 'text-slate-600'}`} data-testid="care-text">
                  {it.text}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rec && (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid="care-kakao"
                    onClick={async () => showToast((await copyText(careMessage(rec, it, today, sender))) ? `${it.companyName} ${it.reason === 'renewal' ? '재계약' : '안부'} 문구를 복사했습니다` : '복사하지 못했습니다')}
                  >
                    <Copy aria-hidden="true" className="size-4" /> {it.reason === 'renewal' ? '재계약 문구' : '안부 카톡'}
                  </Button>
                )}
                {(it.reason === 'anniversary' || it.reason === 'renewal') && (
                  <Link
                    // D-212: 1주년 카톡이 '지난 1년' 을 말하니 보고서도 최근 12개월로 연다(예전: 올해 — 2월이면 거의 빈 종이)
                    // D-684 재계약은 계약일부터(그동안 함께 한 것 전부)
                    to={`/ops/clients/${it.clientId}?report=1&period=${it.reason === 'renewal' ? 'contract' : 'last12'}`}
                    data-testid="care-report"
                    className="tap t-sub inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <FileText aria-hidden="true" className="size-4" /> 성과 보고서
                  </Link>
                )}
                {it.reason === 'renewal' && rec && (
                  <Button size="sm" variant="primary" data-testid="care-renewed" data-guide="fn-care-renewed" disabled={busy !== null} onClick={() => setRenewing(it)}>
                    <RefreshCcw aria-hidden="true" className="size-4" /> 재계약했어요
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={it.reason === 'renewal' ? 'secondary' : 'primary'}
                  data-testid="care-contacted"
                  disabled={busy !== null}
                  onClick={() =>
                    void save(
                      it.clientId,
                      (r) => withCareContactFor(r, it, today),
                      it.reason === 'renewal' ? `${it.companyName} — 연락한 것으로 적었습니다. 7일 뒤 다시 보여 드려요` : `${it.companyName} — 오늘 연락한 것으로 적었습니다`,
                    )
                  }
                >
                  <Check aria-hidden="true" className="size-4" /> 연락했어요
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="care-snooze"
                  disabled={busy !== null}
                  onClick={() => {
                    const until = careSnoozeUntil(it, today)
                    void save(it.clientId, (r) => withCareSnooze(r, until), `${it.companyName} — ${Number(until.slice(5, 7))}/${Number(until.slice(8, 10))}에 다시 보여 드립니다`)
                  }}
                >
                  다음에
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {items.length > SHOW && (
        <button type="button" className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="care-more" onClick={() => setAll((v) => !v)}>
          {all ? '접기' : `${items.length - SHOW}곳 더 보기`}
        </button>
      )}
      {renewing && byId.get(renewing.clientId) &&
        createPortal(
          <RenewSheet
            record={byId.get(renewing.clientId) as ClientOpsRecord}
            busy={busy !== null}
            onClose={() => setRenewing(null)}
            onSave={async (newEnd) => {
              await save(renewing.clientId, (r) => withRenewal(r, newEnd, today), `${renewing.companyName} — 재계약을 적었습니다(${newEnd}까지)`)
              setRenewing(null)
            }}
          />,
          document.body,
        )}
    </Fold>
  )
}

/** D-684 [재계약했어요] — 새 계약 끝나는 날 고르기(지금 기간과 같은 햇수가 먼저) → 저장하면 계약 칸 · 활동 기록 · 오늘 연락함 */
function RenewSheet({ record, busy, onClose, onSave }: { record: ClientOpsRecord; busy: boolean; onClose: () => void; onSave: (newEnd: string) => void | Promise<void> }) {
  const oldEnd = contractEnd(record.contract)
  const from = oldEnd ? addDay(oldEnd, 1) : ''
  const [end, setEnd] = useState(() => renewalDefaultEnd(record.contract, renewalYears(record.contract)))
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(end) && !!oldEnd && end > oldEnd
  return (
    <BottomSheet
      title={`재계약 — ${record.companyName}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" data-testid="renew-save" disabled={!ok || busy} onClick={() => void onSave(end)}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-testid="renew-sheet">
        <p className="t-body break-keep text-slate-800">
          새 계약은 <strong className="tabular-nums">{from}</strong>부터예요. 언제까지인가요?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2].map((n) => {
            const v = endAfterYears(from, n)
            return (
              <button
                key={n}
                type="button"
                aria-pressed={end === v}
                data-testid="renew-years"
                data-years={n}
                onClick={() => setEnd(v)}
                className={`tap t-sub min-h-10 rounded-full border px-3.5 font-semibold ${end === v ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {end === v && <Check aria-hidden="true" className="mr-1 inline size-4 align-[-3px]" />}
                {n}년
              </button>
            )
          })}
        </div>
        <label className="block">
          <span className="t-sub font-medium text-slate-700">새 계약 끝나는 날</span>
          <input type="date" aria-label="새 계약 끝나는 날" value={end} min={from} onChange={(e) => setEnd(e.target.value)} className="t-body mt-1 h-12 w-full rounded-(--radius-control) border border-slate-300 px-3" />
        </label>
        {!ok && end !== '' && <p className="t-sub break-keep text-danger-700">앞 계약이 끝난 날({oldEnd})보다 뒤여야 해요.</p>}
        <p className="t-meta break-keep text-slate-500">저장하면 계약 칸 · 활동 기록에 적히고, 이 줄은 목록에서 빠져요. 금액이 바뀌었으면 업체 › 계약에서 고쳐 주세요.</p>
      </div>
    </BottomSheet>
  )
}
