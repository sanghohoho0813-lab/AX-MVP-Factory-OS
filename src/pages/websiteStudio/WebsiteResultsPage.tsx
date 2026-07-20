import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Palette } from 'lucide-react'
import type { WebsiteDesign } from '../../types/websiteDesign'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  organizationRepository,
  projectRepository,
  websiteDesignRepository,
} from '../../repositories'
import { GuidedEmptyState } from '../../components/ui/GuidedEmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { WebsiteStatusBadge, WebsiteTypeBadge } from '../../components/websiteStudio/badges'
import { needsRedesign } from '../../services/websiteDesignService'

interface Row {
  design: WebsiteDesign
  orgName: string
  projectName: string
  stale: boolean
}

export function WebsiteResultsPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const projById = new Map(projectRepository.getAll(true).map((p) => [p.id, p]))
    return websiteDesignRepository
      .getAll()
      .filter((d) => d.status === 'finalized')
      .sort((a, b) => (b.finalizedAt ?? '').localeCompare(a.finalizedAt ?? ''))
      .map((design) => ({
        design,
        orgName: orgById.get(design.organizationId)?.name ?? '알 수 없음',
        projectName: projById.get(design.projectId)?.name ?? '알 수 없음',
        stale: needsRedesign(design),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/website-studio')}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        홈페이지 설계
      </button>
      <PageHeader title="홈페이지 설계 결과" description="확정된 홈페이지 설계를 모아 봅니다. 각 설계는 확정 시점 기준으로 동결되어 보존됩니다." />

      {rows.length === 0 ? (
        <Panel title="확정 설계" flush>
          <GuidedEmptyState
            icon={Palette}
            title="아직 확정한 홈페이지 설계가 없습니다"
            reason="홈페이지 제작 프로젝트에서 사이트 구조·콘텐츠·디자인·개발 지시문을 확정하면 이곳에 정리됩니다."
            flowPosition="홈페이지 설계"
            prereqs={[
              { label: '홈페이지 진단 결과 확인', done: false },
              { label: '사이트 구조·콘텐츠 설계', done: false },
              { label: '개발 지시문 생성·확정', done: false },
            ]}
            primaryLabel="홈페이지 설계로 이동"
            onPrimary={() => navigate('/website-studio')}
            sampleLabel="샘플 설계 보기"
            onSample={() => navigate('/website-studio/projects/proj-106')}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const pages = r.design.pages.filter((p) => p.status !== 'excluded').length
            return (
              <button
                key={r.design.id}
                type="button"
                onClick={() => navigate(`/website-studio/projects/${r.design.projectId}/review`)}
                className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.design.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{r.orgName} · {r.projectName} · v{r.design.version}</p>
                  </div>
                  <WebsiteStatusBadge status={r.design.status} />
                </div>
                <p className="line-clamp-2 text-[13px] break-keep text-slate-600">{r.design.designSummary || r.design.strategy.purpose}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <WebsiteTypeBadge type={r.design.strategy.websiteType} />
                  <span>페이지 {pages}개</span>
                  <span>개발 지시문 {r.design.generatedPrompts.length}종</span>
                </div>
                {r.stale && (
                  <span className="w-fit rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                    진단 변경됨 · 재설계 권장
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
