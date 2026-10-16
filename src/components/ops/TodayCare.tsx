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
                    onClick={async () => showToast((await copyText(careMessage(rec, it, today, sender))) ? `${it.companyName} 안부 문구를 복사했습니다` : '복사하지 못했습니다')}
                  >
                    <Copy aria-hidden="true" className="size-4" /> 안부 카톡
                  </Button>
                )}
                {it.reason === 'anniversary' && (
                  <Link
                    // D-212: 1주년 카톡이 '지난 1년' 을 말하니 보고서도 최근 12개월로 연다(예전: 올해 — 2월이면 거의 빈 종이)
                    to={`/ops/clients/${it.clientId}?report=1&period=last12`}
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
    </Fold>
  )
}
