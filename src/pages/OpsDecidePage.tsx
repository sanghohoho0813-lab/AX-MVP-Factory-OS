/**
 * 확인할 것 (D-158) — 모든 업체에서 프로그램이 준비한 것을 한 화면에.
 * 대표는 '맞아요 / 아니에요' 만 고른다. 서류를 올리면 여기로 결정 거리가 모인다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { PageHeader } from '../components/ui/PageHeader'
import { Blank } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { DecisionList, useDecisionAnswer } from '../components/ops/DecisionList'
import { useGrantData } from '../components/grants/useGrants'
import { useEntitlements } from '../lib/entitlementsStore'
import { listClients, saveClient } from '../services/clientOpsService'
import { DECISION_KIND_LABEL, buildAllDecisions, type DecisionKind } from '../services/decisions'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'

const KINDS: DecisionKind[] = ['fact', 'doc', 'module', 'grant']

function DecideContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [kind, setKind] = useState<DecisionKind | 'all'>('all')
  const { notices } = useGrantData(workspaceId)
  const { ent } = useEntitlements()
  const usable = useCallback((key: string) => key === 'grants' || ent.feature(key).usable, [ent])

  useEffect(() => {
    listClients(workspaceId)
      .then((r) => setRecords(r))
      .catch((cause) => showToast(cause instanceof Error ? cause.message : '업체를 불러오지 못했습니다.'))
      .finally(() => setLoaded(true))
  }, [workspaceId, showToast])

  const all = useMemo(() => buildAllDecisions(records, today, notices, usable), [records, today, notices, usable])
  const shown = kind === 'all' ? all : all.filter((d) => d.kind === kind)
  const { answer, busy } = useDecisionAnswer({
    workspaceId,
    userId,
    today,
    notices,
    latest: (id) => records.find((r) => r.id === id),
    save: async (next) => {
      const saved = await saveClient(next)
      setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
      return saved
    },
  })
  const clients = new Set(all.map((d) => d.clientId)).size

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="확인할 것"
        description="올린 서류 · 업체 기록 · 받아 둔 공고를 읽고 프로그램이 먼저 준비했습니다. 맞으면 [맞아요], 아니면 [아니에요] 만 누르세요."
      />
      <p className="t-body text-slate-700" data-testid="decide-summary">
        {loaded ? (all.length ? <><b className="font-bold text-slate-900">{clients}곳</b>에서 <b className="font-bold text-brand-700">{all.length}건</b> 확인할 것이 있습니다.</> : '지금 확인할 것이 없습니다.') : '불러오는 중…'}
      </p>
      {all.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="종류">
          {(['all', ...KINDS] as (DecisionKind | 'all')[]).map((k) => {
            const n = k === 'all' ? all.length : all.filter((d) => d.kind === k).length
            if (k !== 'all' && n === 0) return null
            return (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                data-testid={`decide-kind-${k}`}
                className={`tap t-sub shrink-0 rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${kind === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {k === 'all' ? '전체' : DECISION_KIND_LABEL[k]} {n}
              </button>
            )
          })}
        </div>
      )}
      {loaded && all.length === 0 ? (
        <Blank
          title="지금 확인할 것이 없습니다. 업체에 서류를 올리면 프로그램이 읽고 맞는지 물어볼 것을 여기로 가져옵니다."
          icon={<CheckCheck className="size-7" />}
          action={
            <Link to="/ops/clients" className="t-sub font-semibold text-brand-700 hover:underline">
              고객 관리로 →
            </Link>
          }
        />
      ) : (
        shown.length > 0 && <DecisionList decisions={shown} busy={busy} onAnswer={(d, a) => void answer(d, a)} />
      )}
    </div>
  )
}

export function OpsDecidePage() {
  return <WorkspaceScope>{(ctx) => <DecideContent workspaceId={ctx.workspaceId} userId={ctx.userId} />}</WorkspaceScope>
}
