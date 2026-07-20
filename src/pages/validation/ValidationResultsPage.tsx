import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FlaskConical } from 'lucide-react'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { organizationRepository, projectRepository, validationWorkspaceRepository } from '../../repositories'
import { summarize } from '../../services/validationService'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { DecisionBadge, TrackBadge } from '../../components/validation/badges'
import { TRACK_META } from '../../lib/validationMeta'

interface Row {
  workspace: ValidationWorkspace
  orgName: string
  projectName: string
  headline: string
  requiredPassRate: number
  completedRounds: number
}

const TRACK_ORDER: ValidationTrackType[] = ['ax_mvp', 'website']

export function ValidationResultsPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const groups = useMemo(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projById = new Map(projectRepository.getAll(true).map((p) => [p.id, p]))

    const rows: Row[] = validationWorkspaceRepository
      .getAll()
      .filter((w) => w.status === 'finalized')
      .sort((a, b) => (b.finalizedAt ?? '').localeCompare(a.finalizedAt ?? ''))
      .map((workspace) => {
        const s = summarize(workspace)
        return {
          workspace,
          orgName: orgById.get(workspace.organizationId)?.name ?? '알 수 없음',
          projectName: projById.get(workspace.projectId)?.name ?? '알 수 없음',
          headline: s.headline,
          requiredPassRate: s.requiredPassRate,
          completedRounds: s.completedRounds,
        }
      })

    return TRACK_ORDER.map((trackType) => ({
      trackType,
      rows: rows.filter((r) => r.workspace.trackType === trackType),
    })).filter((g) => g.rows.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const total = groups.reduce((sum, g) => sum + g.rows.length, 0)

  const openTrack = (r: Row) =>
    navigate(`/validation/projects/${r.workspace.projectId}/${r.workspace.trackType}`)

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/validation')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        실제 사용 테스트
      </button>

      <PageHeader
        title="검증 결과"
        description="확정된 실제 사용 테스트 결과를 트랙별로 모아 봅니다. 각 결과는 확정 시점 기준으로 동결되어 보존됩니다."
      />

      <HelpNote
        summary="AX MVP와 홈페이지는 서로 독립된 트랙입니다. 통과율·판정은 절대 합산하지 않고 트랙별로 따로 확정·보존합니다."
        what="확정된 검증의 필수 통과율·완료 회차·최종 결정을 트랙별로 확인합니다."
        when="검증을 확정한 뒤 결과를 되짚어 볼 때 사용합니다."
        next="결과 카드를 눌러 해당 트랙의 상세 근거를 확인할 수 있습니다."
      />

      {total === 0 ? (
        <Panel title="확정 결과" flush>
          <EmptyState
            icon={CheckCircle2}
            title="아직 확정한 검증 결과가 없습니다"
            description="실제 사용 테스트를 진행하고 근거를 갖춘 뒤 검증을 확정하면 이곳에 정리됩니다."
          />
        </Panel>
      ) : (
        groups.map((group) => (
          <section key={group.trackType} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrackBadge track={group.trackType} />
              <span className="text-[13px] font-medium text-slate-500">
                {TRACK_META[group.trackType].label} · {group.rows.length}건
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {group.rows.map((r) => {
                const decisionType = r.workspace.finalDecision.type
                return (
                  <button
                    key={r.workspace.id}
                    type="button"
                    onClick={() => openTrack(r)}
                    className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{r.workspace.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {r.orgName} · {r.projectName} · v{r.workspace.version}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <TrackBadge track={r.workspace.trackType} />
                        {decisionType && <DecisionBadge type={decisionType} />}
                      </div>
                    </div>
                    <p className="line-clamp-2 text-[13px] break-keep text-slate-600">{r.headline}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-700">{r.requiredPassRate}%</span> 필수 통과율
                      </span>
                      <span>완료 회차 {r.completedRounds}회</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}

      {total > 0 && (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px] break-keep text-slate-500">
          <FlaskConical aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          AX MVP와 홈페이지 결과는 별개의 트랙으로, 하나의 점수로 합치지 않습니다.
        </p>
      )}
    </div>
  )
}
