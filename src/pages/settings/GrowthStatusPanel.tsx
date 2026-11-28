/**
 * D-690 설정 › 시스템 — 고객 화면(My MIRAE) 켜짐 점검 · 첫 주 숫자(대표만 · 읽기만 · 기록 0).
 * 운영 SQL(0033 ~ 0036)을 넣은 뒤 [점검하기] 한 번 → 기능 넷이 켜졌는지 · 시범 고객 첫 주가 어디까지 왔는지.
 * 꺼진 것이 있으면 무엇을 하면 되는지 한 줄. 대표 화면에만 그린다(팀장 · 구독 고객 · 대표가 팀장 화면을 보는 중에는 없음).
 */
import { useContext, useState } from 'react'
import { CheckCircle2, CircleDashed, HelpCircle, RefreshCw, XCircle } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { AuthContext } from '../../auth/authContext'
import { getSupabaseClient } from '../../lib/supabase/client'
import { useCustomerViewAllowed } from '../customerViewAccess'
import { listLinks } from '../../services/customerBridgeService'
import { listPublishedReports, listWorkspaceReceipts } from '../../services/portalGrowth'
import { listRecoInterests, listShownRecos } from '../../services/portalReco'
import { GROWTH_FEATURE_LABEL, firstWeekSteps, growthFixText, probeState, type FirstWeekStep, type GrowthFeature } from '../../services/growthStatus'

const ZERO = '00000000-0000-0000-0000-000000000000'

export function GrowthStatusPanel() {
  const allowed = useCustomerViewAllowed()
  const auth = useContext(AuthContext)
  const ws = auth?.currentWorkspaceId ?? null
  const [running, setRunning] = useState(false)
  const [features, setFeatures] = useState<GrowthFeature[] | null>(null)
  const [steps, setSteps] = useState<FirstWeekStep[] | null>(null)
  if (!allowed) return null

  const run = async () => {
    if (running) return
    setRunning(true)
    try {
      const sb = getSupabaseClient()
      const probe = async (p: PromiseLike<{ error: unknown }>) => {
        try {
          return probeState((await p).error)
        } catch (cause) {
          return probeState(cause)
        }
      }
      const [s33, s34, s35, s36] = await Promise.all([
        probe(sb.from('portal_reports').select('id').limit(1)),
        probe(sb.rpc('portal_result_receipts_since')),
        // 고객 함수 — 대표가 부르면 '그 연결의 고객 아님' 으로 막힌다(= 있고 부를 수 있다)
        probe(sb.rpc('portal_results_state', { p_link_id: ZERO })),
        probe(sb.from('portal_recommendations').select('id').limit(1)),
      ])
      const list: GrowthFeature[] = (
        [
          ['0033', s33],
          ['0034', s34],
          ['0035', s35],
          ['0036', s36],
        ] as const
      ).map(([key, state]) => ({ key, label: GROWTH_FEATURE_LABEL[key], state }))
      setFeatures(list)
      if (s33 !== 'on' || !ws) {
        setSteps(null)
        return
      }
      const [links, receipts, reports, recos, interests] = await Promise.all([
        listLinks(ws).catch(() => []),
        listWorkspaceReceipts(ws).catch(() => []),
        listPublishedReports(ws).catch(() => []),
        s36 === 'on' ? listShownRecos(ws).catch(() => []) : Promise.resolve([]),
        s36 === 'on' ? listRecoInterests(ws).catch(() => []) : Promise.resolve([]),
      ])
      setSteps(
        firstWeekSteps({
          links,
          visited: new Set(receipts.filter((r) => r.itemKind === 'home').map((r) => r.linkId)),
          reports,
          reportSeen: new Set(receipts.filter((r) => r.itemKind === 'report').map((r) => r.itemId)),
          reportAcked: new Set(receipts.filter((r) => r.itemKind === 'report' && r.acknowledgedAt).map((r) => r.itemId)),
          recosShown: recos.length,
          interests: interests.length,
        }),
      )
    } finally {
      setRunning(false)
    }
  }

  const fix = features ? growthFixText(features) : null
  return (
    <Panel title="고객 화면(My MIRAE) 켜짐 점검">
      <HelpNote summary="운영 SQL(0033 ~ 0036)을 넣은 뒤 한 번 누르세요. 기능 넷이 켜졌는지와 시범 고객 첫 주가 어디까지 왔는지 보여 줘요(읽기만 · 고객 기록에 남지 않음)." />
      <div className="mt-4">
        <Button variant="primary" onClick={() => void run()} disabled={running} data-testid="growth-status-run">
          <RefreshCw aria-hidden="true" className={`size-4 ${running ? 'animate-spin' : ''}`} />
          {running ? '확인 중…' : '점검하기'}
        </Button>
      </div>
      {features && (
        <ul className="mt-4 flex flex-col gap-1.5" data-testid="growth-status">
          {features.map((f) => (
            <li key={f.key} className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5" data-testid="growth-status-row" data-key={f.key} data-state={f.state}>
              {f.state === 'on' ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" />
              ) : f.state === 'off' ? (
                <XCircle aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
              ) : (
                <HelpCircle aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
              )}
              <span className="min-w-0 flex-1 text-[1rem] font-semibold break-keep text-slate-800">{f.key} {f.label}</span>
              <span className={`t-sub shrink-0 font-semibold ${f.state === 'on' ? 'text-success-700' : f.state === 'off' ? 'text-danger-700' : 'text-slate-600'}`}>
                {f.state === 'on' ? '켜짐' : f.state === 'off' ? '꺼짐' : '확인 못 함'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {fix && <p className="t-sub mt-2 break-keep text-danger-700" data-testid="growth-status-fix">{fix}</p>}
      {features && features.some((f) => f.state === 'unknown') && (
        <p className="t-sub mt-2 break-keep text-slate-600" data-testid="growth-status-unknown">'확인 못 함' 은 연결이 잠깐 끊겼을 때 나와요 — 조금 뒤 다시 눌러 주세요.</p>
      )}
      {steps && (
        <div className="mt-4" data-testid="growth-firstweek">
          <p className="t-sub font-bold text-slate-900">첫 주 지켜보기</p>
          <ol className="mt-1.5 flex flex-col divide-y divide-slate-100">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-2.5 py-2" data-testid="growth-firstweek-step" data-key={s.key} data-done={s.done ? '1' : '0'}>
                {s.done ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" /> : <CircleDashed aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
                <span className={`min-w-0 flex-1 text-[0.9375rem] break-keep ${s.done ? 'text-slate-900' : 'text-slate-600'}`}>{s.label}</span>
                <span className="t-sub shrink-0 text-slate-700 tabular-nums">{s.value}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  )
}
