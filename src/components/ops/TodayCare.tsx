/**
 * 오늘 — 안부 챙길 계약 고객 (D-155).
 * 한 달 넘게 조용한 계약 고객 · 계약 1주년이 다가오는 고객. 줄마다 [안부 카톡] [연락했어요] [다음에] , 1주년은 [성과 보고서].
 * 챙길 곳이 없으면 칸을 그리지 않는다 — 오늘 화면을 길게 만들지 않으려고.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, FileText, HeartHandshake } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { careList, careMessage, careSnoozeUntil, withCareContact, withCareSnooze } from '../../services/clientCare'
import { saveClient } from '../../services/clientOpsService'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'
import { useSenderLine } from '../layout/useCurrentUser'

const SHOW = 4

export function TodayCare({ clients, today, onSaved }: { clients: ClientOpsRecord[]; today: string; onSaved: (record: ClientOpsRecord) => void }) {
  const { showToast } = useToast()
  const sender = useSenderLine()
  const items = useMemo(() => careList(clients, today), [clients, today])
  const [busy, setBusy] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  if (items.length === 0) return null
  const byId = new Map(clients.map((c) => [c.id, c]))

  const save = async (id: string, change: (r: ClientOpsRecord) => ClientOpsRecord, done: string) => {
    const rec = byId.get(id)
    if (!rec || busy) return
    setBusy(id)
    try {
      onSaved(await saveClient(change(rec)))
      showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  const shown = all ? items : items.slice(0, SHOW)
  return (
    <section aria-labelledby="today-care-title" data-testid="today-care" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="today-care-title" className="flex items-center gap-2 text-[1.15rem] font-bold text-slate-900">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-nav-ops">
            <HeartHandshake className="size-4" />
          </span>
          안부 챙길 계약 고객
          <span className="text-[0.95rem] font-semibold text-slate-500">{items.length}</span>
        </h2>
      </div>
      <p className="t-sub break-keep text-slate-500">한 달 넘게 연락이 없거나 계약 1주년이 다가오는 곳입니다. 연락했으면 [연락했어요] 를 눌러 주세요.</p>
      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white">
        {shown.map((it) => {
          const rec = byId.get(it.clientId)
          return (
            <li key={it.clientId} className="flex flex-col gap-2 px-4 py-3" data-testid="care-row" data-reason={it.reason} data-client={it.clientId}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <Link to={`/ops/clients/${it.clientId}`} className="t-sub font-bold [overflow-wrap:anywhere] text-slate-900 hover:text-brand-700 hover:underline">
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
                    onClick={async () => showToast((await copyText(careMessage(rec, it, today, sender))) ? `${it.companyName} 안부 문구를 복사했습니다` : '복사하지 못했습니다')}
                  >
                    <Copy aria-hidden="true" className="size-4" /> 안부 카톡
                  </Button>
                )}
                {it.reason === 'anniversary' && (
                  <Link
                    to={`/ops/clients/${it.clientId}?report=1`}
                    data-testid="care-report"
                    className="tap t-sub inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <FileText aria-hidden="true" className="size-4" /> 성과 보고서
                  </Link>
                )}
                <Button size="sm" variant="primary" data-testid="care-contacted" disabled={busy !== null} onClick={() => void save(it.clientId, (r) => withCareContact(r, today), `${it.companyName} — 오늘 연락한 것으로 적었습니다`)}>
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
    </section>
  )
}
