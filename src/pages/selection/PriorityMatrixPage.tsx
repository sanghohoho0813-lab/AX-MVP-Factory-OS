import { useState } from 'react'
import { Grid2x2, List } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { AutomationCandidate } from '../../types/selection'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { QUADRANT_META, QUADRANTS } from '../../lib/selectionMeta'
import { TONE_DOT_CLASS } from '../../lib/statusMeta'
import {
  PriorityMatrix,
  PriorityMatrixList,
} from '../../components/selection/PriorityMatrix'
import {
  SelectionGateNotice,
  SelectionHeader,
  SelectionNav,
  SelectionProjectNotFound,
  } from './selectionShared'
import { useSelectionData } from './useSelectionData'

export function PriorityMatrixPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { context } = useSelectionData(projectId)
  const [view, setView] = useState<'matrix' | 'list'>('matrix')

  if (!context) return <SelectionProjectNotFound />
  const { project, organization, eligibility, candidates } = context

  if (!eligibility.canExtract) {
    return (
      <div className="flex flex-col gap-5">
        <SelectionHeader project={project} organizationName={organization?.name ?? ''} />
        <SelectionGateNotice context={context} />
      </div>
    )
  }

  const active = candidates.filter((c) => c.status !== 'archived' && c.status !== 'rejected')
  const onOpen = (c: AutomationCandidate) => navigate(`/selection/projects/${projectId}/candidates/${c.id}`)

  return (
    <div className="flex flex-col gap-5">
      <SelectionHeader project={project} organizationName={organization?.name ?? ''} />
      <SelectionNav projectId={projectId} />

      <p className="text-sm break-keep text-slate-500">
        운영·사업 효과와 구현 가능성을 기준으로 후보의 우선순위를 비교합니다.
      </p>

      {active.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Grid2x2}
            title="매트릭스에 표시할 후보가 없습니다"
            description="후보를 추출하면 우선순위 매트릭스가 표시됩니다."
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 self-start rounded-(--radius-control) border border-slate-200 p-0.5">
            <button type="button" onClick={() => setView('matrix')} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${view === 'matrix' ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}>
              <Grid2x2 aria-hidden="true" className="size-4" />
              매트릭스
            </button>
            <button type="button" onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${view === 'list' ? 'bg-slate-100 text-slate-800' : 'text-slate-500'}`}>
              <List aria-hidden="true" className="size-4" />
              목록
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel title="우선순위 매트릭스">
                {/* 데스크톱: 매트릭스 / 모바일: 목록 */}
                <div className={view === 'matrix' ? 'hidden sm:block' : 'hidden'}>
                  <PriorityMatrix candidates={active} onOpen={onOpen} />
                </div>
                <div className={view === 'matrix' ? 'sm:hidden' : ''}>
                  <PriorityMatrixList candidates={active} onOpen={onOpen} />
                </div>
              </Panel>
            </div>
            <div>
              <Panel title="사분면 안내">
                <ul className="flex flex-col gap-2.5">
                  {QUADRANTS.map((q) => (
                    <li key={q} className="flex items-start gap-2">
                      <span className={`mt-1 size-2.5 shrink-0 rounded-full ${TONE_DOT_CLASS[QUADRANT_META[q].tone]}`} />
                      <div>
                        <p className="text-[13px] font-medium text-slate-700">{QUADRANT_META[q].label}</p>
                        <p className="text-xs break-keep text-slate-400">{QUADRANT_META[q].description}</p>
                        <p className="mt-0.5 text-xs text-slate-400">후보 {active.filter((c) => c.quadrant === q).length}건</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
