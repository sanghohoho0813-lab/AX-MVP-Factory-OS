/**
 * 성과 지표 — 이 시스템이 실제로 무엇을 바꾸고 있는지 재는 화면.
 *
 * 목표치는 없다. 규격(v3.0 §4.2)이 금지한다: 실측 전에 개선율을 지어내지 않는다.
 * 대신 "무엇을 어디서 재는지" 와 "지금 값" 과 "그 값을 믿어도 되는지(근거 건수)" 를
 * 함께 보여준다. 기록이 쌓일수록 '기준선 만드는 중' 이 '측정 중' 으로 바뀐다.
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { PageHeader } from '../components/ui/PageHeader'
import { Blank, Disclosure, Section } from '../components/ui/primitives'
import { hintFor } from '../content/sectionHints'
import { useToast } from '../components/ui/toastContext'
import { listClients } from '../services/clientOpsService'
import { listJournal } from '../services/journalService'
import { listEvents } from '../services/customerBridgeService'
import {
  KPI_GROUP_LABEL,
  KPI_STATUS_LABEL,
  MIN_BASIS,
  buildKpis,
  kpiStatusSummary,
  kpisByGroup,
  type KpiMetric,
  type KpiStatus,
} from '../services/kpiService'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, JournalEntry } from '../types/bridge'

/** 상태는 뜻 점(●) 하나로 — 글은 점에 마우스를 올리거나 줄을 펼치면 */
const STATUS_DOT: Record<KpiStatus, string> = {
  measured: 'bg-success-500',
  baseline_forming: 'bg-warning-500',
  unknown: 'bg-slate-300',
}

/** D-627 지표 한 줄 — 이름 · 지금 값 · 상태. 재는 법 · 주의 · 근거는 줄을 누르면 */
function MetricRow({ m }: { m: KpiMetric }) {
  const [open, setOpen] = useState(false)
  return (
    <li data-testid="kpi-metric" data-key={m.key}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="tap flex min-h-11 w-full items-center gap-3 py-2 text-left hover:bg-slate-50"
      >
        <span className="t-body min-w-0 flex-1 break-keep text-slate-800">{m.label}</span>
        <span className={`t-body shrink-0 font-semibold tabular-nums ${m.value === null ? 'text-slate-400' : 'text-slate-900'}`}>{m.value ?? '—'}</span>
        <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[m.status]}`} title={KPI_STATUS_LABEL[m.status]} aria-label={KPI_STATUS_LABEL[m.status]} />
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-3">
          <p className="t-sub break-keep text-slate-600">
            <span className="font-medium text-slate-700">{KPI_STATUS_LABEL[m.status]} · 재는 법 · </span>
            {m.method}
          </p>
          {m.caution && <p className="t-meta mt-1 break-keep text-slate-500">{m.caution}</p>}
          {m.status === 'baseline_forming' && (
            <p className="t-meta mt-1 text-slate-500">
              근거 {m.basis}건 — {MIN_BASIS}건이 넘으면 기준선으로 삼는다.
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function KpiContent({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [events, setEvents] = useState<CustomerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const today = todayLocalDate()

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [c, j] = await Promise.all([listClients(workspaceId), listJournal(workspaceId)])
        // 브릿지 표가 아직 없는 환경에서는 이벤트가 없다고 보고 나머지는 그대로 센다
        const e = await listEvents(workspaceId).catch(() => [] as CustomerEvent[])
        if (!alive) return
        setRecords(c)
        setJournal(j)
        setEvents(e)
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '지표를 계산할 기록을 불러오지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [workspaceId, showToast])

  const metrics = useMemo(() => buildKpis({ records, journal, events, today }), [records, journal, events, today])
  const groups = useMemo(() => kpisByGroup(metrics), [metrics])
  const summary = useMemo(() => kpiStatusSummary(metrics), [metrics])

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      {/* D-627 머리는 제목 + 한 줄(긴 설명은 ⓘ) · 상태 수는 한 줄 · 묶음은 첫 것만 펼침(나머지는 한 줄) */}
      <PageHeader
        title="성과 지표"
        description="이 시스템이 돈·시간·규모·사용에서 무엇을 바꾸는지, 이미 남긴 기록에서만 계산합니다. 목표치는 두지 않습니다."
      />

      <p className="t-sub flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600" data-testid="kpi-status-line">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-success-500" />측정 중 {summary.measured}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-warning-500" />기준선 만드는 중 {summary.baseline_forming}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-full bg-slate-300" />방법만 정함 {summary.unknown}</span>
      </p>

      {loading ? (
        <p className="t-sub text-slate-500">기록을 읽는 중…</p>
      ) : records.length === 0 ? (
        <Blank title="아직 업체 기록이 없어 잴 것이 없습니다. 업체를 등록하고 상태를 바꾸기 시작하면 여기에 숫자가 생깁니다." />
      ) : (
        groups.map((g, gi) => (
          // '영업' 처럼 다른 화면 목차와 이름이 같아도 이 화면 뜻으로 — 사전에서 '핵심 숫자 · …' 로 찾는다
          <Section
            key={g.group}
            title={KPI_GROUP_LABEL[g.group]}
            hint={hintFor(`핵심 숫자 · ${KPI_GROUP_LABEL[g.group]}`)}
            fold={{ id: `kpi.${g.group}`, open: gi === 0, summary: `${g.items.length}개` }}
          >
            <ul className="divide-y divide-slate-100">
              {g.items.map((m) => (
                <MetricRow key={m.key} m={m} />
              ))}
            </ul>
          </Section>
        ))
      )}

      <Disclosure title="이 숫자를 읽는 법">
        <div className="t-sub flex flex-col gap-2 break-keep text-slate-600">
          <p>
            <strong className="text-slate-800">기준선</strong>은 "바꾸기 전에 어땠는가" 다. 근거가 {MIN_BASIS}건을 넘기
            전까지는 기준선이라 부르지 않는다.
          </p>
          <p>
            <strong className="text-slate-800">목표치</strong>는 여기에 없다. 실제 기준선이 생긴 뒤에 대표가 정한다. 시스템이
            먼저 "30% 개선" 같은 숫자를 내걸지 않는다.
          </p>
          <p>
            <strong className="text-slate-800">실증</strong>은 같은 지표를 12주 동안 같은 방법으로 잰 결과다. 그때 비로소
            "얼마나 좋아졌다" 고 말할 수 있다.
          </p>
        </div>
      </Disclosure>
    </div>
  )
}

export function KpiPage() {
  return <WorkspaceScope>{(ctx) => <KpiContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
