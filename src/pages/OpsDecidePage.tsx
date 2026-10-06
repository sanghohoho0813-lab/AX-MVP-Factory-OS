/**
 * 확인할 것 (D-158) — 모든 업체에서 프로그램이 준비한 것을 한 화면에.
 * 대표는 '맞아요 / 아니에요' 만 고른다. 서류를 올리면 여기로 결정 거리가 모인다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Blank } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { DecisionList, useDecisionAnswer } from '../components/ops/DecisionList'
import { useGrantData } from '../components/grants/useGrants'
import { useEntitlements } from '../lib/entitlementsStore'
import { listClients, saveClient } from '../services/clientOpsService'
import { DECISION_BULK_KINDS, DECISION_KIND_LABEL, buildAllDecisions, type DecisionKind } from '../services/decisions'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'

const KINDS: DecisionKind[] = ['fact', 'money', 'doc', 'stale', 'module', 'next', 'grant', 'followup']

function DecideContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  // D-160: 한 번에 여러 건 답할 때도 저장 직전의 최신 기록 위에 적는다
  const recordsRef = useRef(records)
  recordsRef.current = records
  const [loaded, setLoaded] = useState(false)
  const [kind, setKind] = useState<DecisionKind | 'all'>('all')
  const { notices, linkOf } = useGrantData(workspaceId)
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
  const { answer, answerMany, busy } = useDecisionAnswer({
    workspaceId,
    userId,
    today,
    notices,
    latest: (id) => recordsRef.current.find((r) => r.id === id),
    save: async (next) => {
      const saved = await saveClient(next)
      setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
      return saved
    },
    linkOf,
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
      {/* D-160: 종류를 고르면 그 종류를 한 번에 — 카톡 문구(복사)는 하나씩 보내야 하므로 없다 */}
      {kind !== 'all' && DECISION_BULK_KINDS.includes(kind) && shown.length >= 2 && (
        <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/50 px-4 py-3 sm:flex-row sm:items-center" data-testid="decide-bulk">
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-700">
            {DECISION_KIND_LABEL[kind]} {shown.length}건을 다 읽어 보셨으면 한 번에 처리할 수 있어요.
          </p>
          <Button size="sm" variant="primary" className="self-start sm:self-auto" disabled={busy !== null} onClick={() => void answerMany(shown)} data-testid="decide-bulk-yes">
            <CheckCheck aria-hidden="true" className="size-4" /> 이 {shown.length}건 모두 맞아요
          </Button>
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
        shown.length > 0 && <DecisionList decisions={shown} busy={busy} linked={(id) => !!linkOf(id)} onAnswer={(d, a) => void answer(d, a)} />
      )}
    </div>
  )
}

export function OpsDecidePage() {
  return <WorkspaceScope>{(ctx) => <DecideContent workspaceId={ctx.workspaceId} userId={ctx.userId} />}</WorkspaceScope>
}
