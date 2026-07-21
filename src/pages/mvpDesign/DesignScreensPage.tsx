import { useParams } from 'react-router-dom'
import { LayoutList } from 'lucide-react'
import type { MvpDesign } from '../../types/mvpDesign'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import { FeatureScopeBadge, ScreenTypeBadge } from '../../components/mvpDesign/badges'
import { DesignSectionFrame } from './designShared'

function featureName(design: MvpDesign, id: string): string {
  return design.features.find((f) => f.id === id)?.name ?? id
}

export function DesignScreensPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const screens = design.screens.filter((s) => s.scope !== 'excluded').sort((a, b) => a.order - b.order)
        const overLimit = design.guardrailChecks.find((g) => g.key === 'max_screens')
        return (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.92rem]">
              <LayoutList aria-hidden="true" className="size-4 text-slate-400" />
              <span className="text-slate-600">활성 화면 {screens.length}개</span>
              {overLimit && overLimit.limit !== null && (
                <span className={overLimit.status === 'exceeded' ? 'font-medium text-danger-600' : 'text-slate-400'}>
                  · 상한 {overLimit.limit}개 {overLimit.status === 'exceeded' ? '(초과)' : ''}
                </span>
              )}
            </div>
            {screens.length === 0 ? (
              <Panel title="화면" flush>
                <EmptyState icon={LayoutList} title="화면이 없습니다" description="Must/Should 기능이 지정되면 화면이 생성됩니다." />
              </Panel>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {screens.map((screen) => (
                  <div key={screen.id} className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{screen.name}</p>
                        <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">{screen.purpose}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <ScreenTypeBadge type={screen.type} />
                        <FeatureScopeBadge scope={screen.scope} />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[0.82rem] font-semibold text-slate-400">구성 요소</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {screen.components.map((c) => (
                          <li key={c.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.82rem] text-slate-600" title={c.description}>
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[0.82rem] font-semibold text-slate-400">담는 기능</p>
                      <p className="text-[0.875rem] break-keep text-slate-600">
                        {screen.featureIds.map((id) => featureName(design, id)).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      }}
    />
  )
}
