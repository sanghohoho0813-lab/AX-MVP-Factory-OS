import { GitCompareArrows } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Panel } from '../../../components/ui/Panel'
import { SummaryStrip } from '../../../components/ui/SummaryStrip'
import { EmptyState } from '../../../components/ui/EmptyState'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import { ComparisonView } from '../../../components/assessment/ComparisonView'
import { summarizeComparisons } from '../../../services/assessment/comparisonEngine'
import {
  CheckCircle2,
  CircleHelp,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  AnalysisHeader,
  ProjectNotFound,
  useAnalysisData,
} from './analysisShared'

export function ResponseComparePage() {
  const { projectId = '' } = useParams()
  const { context, organization } = useAnalysisData(projectId)
  if (!context) return <ProjectNotFound />
  const { project, latest } = context

  const header = (
    <AnalysisHeader project={project} organization={organization} />
  )

  if (!latest) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={GitCompareArrows}
            title="분석을 먼저 실행하세요"
            description="개요 화면에서 진단 분석을 실행하면 응답자 비교가 표시됩니다."
          />
        </div>
      </div>
    )
  }

  if (latest.analysisKind === 'website') {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={GitCompareArrows}
            title="홈페이지 단독 프로젝트입니다"
            description="홈페이지 제작 준비도 분석에는 응답자 비교가 적용되지 않습니다."
          />
        </div>
      </div>
    )
  }

  const summary = summarizeComparisons(latest.comparisons)

  return (
    <div className="flex flex-col gap-5">
      {header}
      <AnalysisNav projectId={projectId} />

      <p className="text-sm break-keep text-slate-500">
        대표자·관리자·현장 담당자의 답변 차이를 비교해 실제 업무와 경영진 인식의 차이를 확인합니다.
      </p>

      <SummaryStrip
        ariaLabel="응답자 비교 요약"
        items={[
          { key: 'roles', label: '제출 응답자', value: latest.sourceResponseIds.length, unit: '명', tone: 'info', icon: Users },
          { key: 'aligned', label: '일치', value: summary.aligned, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'minor', label: '일부 차이', value: summary.minorGap, unit: '건', tone: 'warning', icon: TriangleAlert },
          { key: 'major', label: '큰 차이', value: summary.majorGap, unit: '건', tone: 'danger', icon: TriangleAlert },
          { key: 'insufficient', label: '추가 확인 필요', value: summary.insufficient, unit: '건', tone: 'neutral', icon: CircleHelp },
        ]}
      />

      <Panel title="주제별 응답 비교">
        <ComparisonView items={latest.comparisons} />
      </Panel>
    </div>
  )
}
