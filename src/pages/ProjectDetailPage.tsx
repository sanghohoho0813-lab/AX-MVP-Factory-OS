import {
  Archive,
  ArrowRight,
  CalendarClock,
  Pencil,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HEALTH_META, PROJECT_STAGE_META } from '../lib/statusMeta'
import {
  PROJECT_STATUS_META,
  STAGE_FLOW_BY_TYPE,
  STAGE_NEXT_MODULE,
  levelFieldLabel,
  mvpLevelLabel,
} from '../lib/domainMeta'
import { formatDate, formatKrw, formatKrwCompact, getDDay } from '../lib/format'
import { memberName } from '../data/members'
import { useStoreVersion } from '../lib/useStoreVersion'
import {
  activityRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { archiveProject } from '../services/projectService'
import { ProjectTypeBadge } from '../components/domain/ProjectTypeBadge'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DetailHeader } from '../components/ui/DetailHeader'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { NotFoundState } from '../components/ui/NotFoundState'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StageProgress } from '../components/ui/StageProgress'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useToast } from '../components/ui/toastContext'

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [archiveOpen, setArchiveOpen] = useState(false)

  const project = useMemo(
    () => projectRepository.getById(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )
  const organization = useMemo(
    () =>
      project ? organizationRepository.getById(project.organizationId) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project?.organizationId, version],
  )
  const activities = useMemo(
    () => activityRepository.getByProjectId(projectId, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )

  if (!project) {
    return (
      <NotFoundState
        title="프로젝트를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
        backTo="/clients"
        backLabel="고객사 목록으로 돌아가기"
      />
    )
  }

  const nextModule = STAGE_NEXT_MODULE[project.currentStage]
  const dday = getDDay(project.nextActionDueDate)
  const levelLabel = levelFieldLabel(project.projectType)

  const handleNextStage = () => {
    if (nextModule.path) {
      navigate(nextModule.path)
    } else {
      showToast('모든 단계가 완료된 프로젝트입니다.')
    }
  }

  const handleArchive = () => {
    try {
      archiveProject(project.id)
      showToast(`${project.name} 프로젝트를 보관 처리했습니다.`)
      setArchiveOpen(false)
      navigate(`/clients/${project.organizationId}`)
    } catch (error) {
      setArchiveOpen(false)
      showToast(
        error instanceof Error ? error.message : '보관 처리에 실패했습니다.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={organization ? `/clients/${organization.id}` : '/clients'}
        backLabel={organization ? `${organization.name} 상세` : '고객사 목록'}
        title={project.name}
        badges={
          <>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold tracking-wide text-slate-500">
              {project.projectCode}
            </span>
            <ProjectTypeBadge type={project.projectType} compact />
            <StatusBadge tone={PROJECT_STATUS_META[project.status].tone}>
              {PROJECT_STATUS_META[project.status].label}
            </StatusBadge>
            <StatusBadge tone={HEALTH_META[project.healthStatus].tone} withDot>
              {HEALTH_META[project.healthStatus].label}
            </StatusBadge>
          </>
        }
        meta={
          <>
            {organization ? (
              <Link
                to={`/clients/${organization.id}`}
                className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {organization.name}
              </Link>
            ) : (
              <span className="text-warning-700">
                연결된 고객사를 찾을 수 없습니다
              </span>
            )}
            <span>담당 {memberName(project.ownerId)}</span>
            <span>최근 수정 {formatDate(project.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate(`/projects/${project.id}/edit`)}
            >
              <Pencil aria-hidden="true" className="size-4" />
              프로젝트 수정
            </Button>
            <Button variant="primary" onClick={handleNextStage}>
              다음 단계 작업 시작
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <DropdownMenu
              ariaLabel="프로젝트 더보기 메뉴"
              items={[
                {
                  key: 'archive',
                  label: '보관 처리',
                  icon: Archive,
                  danger: true,
                  onSelect: () => setArchiveOpen(true),
                },
              ]}
            />
          </>
        }
      />

      {project.archivedAt && (
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] break-keep text-slate-600">
          {formatDate(project.archivedAt)}에 보관 처리된 프로젝트입니다. 데이터는
          유지됩니다.
        </p>
      )}

      {/* A. 전체 진행 흐름 */}
      <Panel title="전체 진행 흐름">
        <StageProgress
          flow={STAGE_FLOW_BY_TYPE[project.projectType]}
          currentStage={project.currentStage}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* B. 핵심 요약 */}
          <Panel title="핵심 요약">
            <p className="text-sm break-keep text-slate-700">{project.objective}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
              <SummaryItem label="담당자" value={memberName(project.ownerId)} />
              <SummaryItem label="시작일" value={formatDate(project.startDate)} />
              <SummaryItem label="목표 완료일" value={formatDate(project.dueDate)} />
              <SummaryItem
                label={`현재 ${levelLabel}`}
                value={mvpLevelLabel(project.currentMvpLevel, project.projectType)}
              />
              <SummaryItem
                label={`목표 ${levelLabel}`}
                value={mvpLevelLabel(project.targetMvpLevel, project.projectType)}
              />
              <div>
                <dt className="text-xs text-slate-400">현재 진행률</dt>
                <dd className="mt-1.5 flex items-center gap-2">
                  <ProgressBar
                    value={project.progress}
                    tone={HEALTH_META[project.healthStatus].tone}
                    label={`${project.name} 진행률`}
                  />
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {project.progress}%
                  </span>
                </dd>
              </div>
            </dl>
          </Panel>

          {/* D. 자금조달 연계 */}
          <Panel title="자금조달 연계">
            {project.fundingRequired ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-400">목표 기관</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {project.targetInstitutions.length > 0 ? (
                      project.targetInstitutions.map((institution) => (
                        <StatusBadge key={institution} tone="info">
                          {institution}
                        </StatusBadge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">미지정</span>
                    )}
                  </dd>
                </div>
                <SummaryItem
                  label="목표 금액"
                  value={
                    project.targetFundingAmount !== null
                      ? `${formatKrw(project.targetFundingAmount)} (${formatKrwCompact(project.targetFundingAmount)})`
                      : '미지정'
                  }
                />
                <div className="sm:col-span-3">
                  <dt className="text-xs text-slate-400">현재 준비 상태</dt>
                  <dd className="mt-0.5 text-sm break-keep text-slate-700">
                    {project.currentStage === 'deliverables'
                      ? '자료 패키지 단계에서 제출자료를 준비하고 있습니다.'
                      : '자료 패키지 단계에 도달하면 제출자료 준비가 시작됩니다.'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-[13px] text-slate-500">자금조달 연계 없음</p>
            )}
          </Panel>

          {/* E. 주요 위험 */}
          <Panel title="주요 위험">
            {project.riskSummary ? (
              <p className="flex items-start gap-2.5 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-sm break-keep text-warning-700">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {project.riskSummary}
              </p>
            ) : (
              <p className="text-[13px] text-slate-500">
                현재 등록된 주요 위험이 없습니다.
              </p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {/* C. 다음 행동 */}
          <Panel title="다음 행동">
            {project.nextAction ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {dday && (
                    <StatusBadge
                      tone={
                        dday.overdue
                          ? 'danger'
                          : dday.daysLeft <= 2
                            ? 'warning'
                            : 'info'
                      }
                    >
                      {dday.label}
                    </StatusBadge>
                  )}
                  {dday?.overdue && (
                    <StatusBadge tone="danger" withDot>
                      지연
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-2.5 text-sm font-medium break-keep text-slate-800">
                  {project.nextAction}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarClock aria-hidden="true" className="size-3.5" />
                  예정일 {formatDate(project.nextActionDueDate)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">
                등록된 다음 행동이 없습니다.
              </p>
            )}
          </Panel>

          {/* G. 다음 모듈 안내 */}
          <Panel title="다음 모듈 안내">
            <p className="text-sm break-keep text-slate-600">
              현재 프로젝트는{' '}
              <span className="font-semibold text-slate-800">
                {PROJECT_STAGE_META[project.currentStage].label}
              </span>{' '}
              단계입니다. {nextModule.guide}
            </p>
            {nextModule.path && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => navigate(nextModule.path ?? '/')}
              >
                {nextModule.moduleName} 열기
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Button>
            )}
          </Panel>

          {/* F. 최근 활동 */}
          <Panel title="최근 활동">
            <ActivityTimeline activities={activities} />
          </Panel>
        </div>
      </div>

      <ConfirmModal
        open={archiveOpen}
        title="프로젝트 보관"
        message={`${project.name} 프로젝트를 보관할까요? 보관된 프로젝트는 기본 목록에서 숨겨지며 데이터는 삭제되지 않습니다.`}
        confirmLabel="보관 처리"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveOpen(false)}
      />
    </div>
  )
}
