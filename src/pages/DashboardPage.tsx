import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PRIORITY_TASKS, TIMELINE_ITEMS, TIMELINE_TRACKS } from '../data/demo'
import { useStoreVersion } from '../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../repositories'
import {
  buildDashboardMetrics,
  buildPortfolioItems,
} from '../services/dashboardService'
import { countSelectionPending } from '../services/selectionService'
import { MetricStrip } from '../components/dashboard/MetricStrip'
import { PortfolioHealth } from '../components/dashboard/PortfolioHealth'
import { PriorityList } from '../components/dashboard/PriorityList'
import { WeeklyTimeline } from '../components/dashboard/WeeklyTimeline'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

export function DashboardPage() {
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false)
  const version = useStoreVersion()

  const { metrics, portfolioItems } = useMemo(() => {
    const projects = projectRepository.getAll()
    const organizations = organizationRepository.getAll()
    return {
      metrics: buildDashboardMetrics(projects, countSelectionPending()),
      portfolioItems: buildPortfolioItems(organizations, projects),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="오늘의 AX MVP 운영 현황"
        description="진단부터 현장검증과 자료 준비까지, 진행 중인 프로젝트의 다음 행동을 확인합니다."
        actions={
          <Button variant="primary" onClick={() => setDiagnosisModalOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            신규 진단 시작
          </Button>
        }
      />

      <MetricStrip metrics={metrics} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <WeeklyTimeline tracks={TIMELINE_TRACKS} items={TIMELINE_ITEMS} />
        </div>
        <div className="min-w-0">
          <PriorityList tasks={PRIORITY_TASKS} />
        </div>
      </div>

      <PortfolioHealth projects={portfolioItems} />

      <Modal
        open={diagnosisModalOpen}
        title="신규 진단 시작"
        onClose={() => setDiagnosisModalOpen(false)}
        footer={
          <Button variant="primary" onClick={() => setDiagnosisModalOpen(false)}>
            확인
          </Button>
        }
      >
        <p className="break-keep">
          업종 맞춤 현장진단 생성은 다음 개발 단계(진단 스튜디오)에서 제공됩니다.
          지금은 대시보드에서 진행 중인 프로젝트 현황을 확인할 수 있습니다.
        </p>
      </Modal>
    </div>
  )
}
