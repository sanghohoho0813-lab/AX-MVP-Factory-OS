import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Organization, Project } from '../../../types/domain'
import { useStoreVersion } from '../../../lib/useStoreVersion'
import { PROJECT_STAGE_META } from '../../../lib/statusMeta'
import {
  getProjectAnalysisContext,
  runOrRefreshAnalysis,
  type ProjectAnalysisContext,
} from '../../../services/assessmentService'
import { organizationRepository } from '../../../repositories'
import { ProjectTypeBadge } from '../../../components/domain/ProjectTypeBadge'
import { Button } from '../../../components/ui/Button'
import { DetailHeader } from '../../../components/ui/DetailHeader'
import { EmptyState } from '../../../components/ui/EmptyState'
import { NotFoundState } from '../../../components/ui/NotFoundState'
import { useToast } from '../../../components/ui/toastContext'
import { ClipboardList } from 'lucide-react'

export interface AnalysisLoaded {
  project: Project
  organization: Organization | null
  context: ProjectAnalysisContext
}

/** 분석 컨텍스트를 로드한다 (store 버전에 반응) */
export function useAnalysisData(projectId: string) {
  const version = useStoreVersion()
  return useMemo(() => {
    const context = getProjectAnalysisContext(projectId)
    if (!context) return { context: null, organization: null }
    const organization = organizationRepository.getById(
      context.project.organizationId,
    )
    return { context, organization }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}

interface AnalysisHeaderProps {
  project: Project
  organization: Organization | null
  actions?: ReactNode
}

export function AnalysisHeader({
  project,
  organization,
  actions,
}: AnalysisHeaderProps) {
  return (
    <DetailHeader
      backTo={`/projects/${project.id}`}
      backLabel={`${project.name} 상세`}
      title="진단 분석"
      badges={
        <>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.875rem] font-semibold text-slate-500">
            {project.projectCode}
          </span>
          <ProjectTypeBadge type={project.projectType} compact />
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.875rem] text-slate-500">
            {PROJECT_STAGE_META[project.currentStage].label}
          </span>
        </>
      }
      meta={
        <>
          <span>{organization?.name}</span>
          <span>{project.name}</span>
        </>
      }
      actions={actions}
    />
  )
}

/** 제출 응답이 없을 때 안내 */
export function NoResponseState({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      <EmptyState
        icon={ClipboardList}
        title="제출 완료된 설문 응답이 없습니다"
        description="분석은 제출 완료된 응답을 기준으로 실행됩니다. 먼저 설문 링크를 발급하고 응답을 받아주세요."
        action={
          <Button
            variant="primary"
            onClick={() => navigate(`/diagnosis/projects/${projectId}/surveys`)}
          >
            설문 현황으로 이동
          </Button>
        }
      />
    </div>
  )
}

export function ProjectNotFound() {
  return (
    <NotFoundState
      title="프로젝트를 찾을 수 없습니다"
      description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
      backTo="/diagnosis/assessments"
      backLabel="진단 결과 목록으로"
    />
  )
}

/** 재분석 필요 배너 */
export function ReanalysisBanner({
  show,
  onRun,
}: {
  show: boolean
  onRun: () => void
}) {
  if (!show) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
      <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-warning-600" />
      <p className="min-w-0 flex-1 text-[13px] break-keep text-warning-800">
        새로운 제출 응답 또는 인터뷰 답변이 있어 재분석이 필요합니다.
      </p>
      <Button variant="secondary" size="sm" onClick={onRun}>
        <RefreshCw aria-hidden="true" className="size-3.5" />
        재분석
      </Button>
    </div>
  )
}

/** 분석 실행 버튼 (액션) — 상태에 맞는 라벨 */
export function useRunAnalysis(projectId: string) {
  const { showToast } = useToast()
  return () => {
    try {
      runOrRefreshAnalysis(projectId)
      showToast('진단 분석을 실행했습니다.')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '분석 실행에 실패했습니다.',
      )
    }
  }
}

/** 헤더 오른쪽 공용 액션 (분석 실행/재분석 + 결과 보기) */
export function AnalysisHeaderActions({
  context,
  onRun,
}: {
  context: ProjectAnalysisContext
  onRun: () => void
}) {
  const navigate = useNavigate()
  const hasAnalysis = context.latest !== null
  return (
    <>
      <Button variant="secondary" onClick={onRun}>
        {hasAnalysis ? (
          <>
            <RefreshCw aria-hidden="true" className="size-4" />
            재분석
          </>
        ) : (
          <>
            <Send aria-hidden="true" className="size-4" />
            분석 시작
          </>
        )}
      </Button>
      {hasAnalysis && (
        <Button
          variant="primary"
          onClick={() =>
            navigate(`/diagnosis/projects/${context.project.id}/analysis/result`)
          }
        >
          결과 검토
        </Button>
      )}
    </>
  )
}
