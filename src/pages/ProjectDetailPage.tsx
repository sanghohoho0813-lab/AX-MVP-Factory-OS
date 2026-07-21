import {
  Archive,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  ExternalLink,
  FilePen,
  Landmark,
  Link2,
  Lock,
  Minus,
  Pencil,
  Plus,
  SearchCheck,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useActiveProject } from '../context/activeProject'
import { HEALTH_META } from '../lib/statusMeta'
import {
  PROJECT_STATUS_META,
  levelFieldLabel,
  mvpLevelLabel,
} from '../lib/domainMeta'
import { formatDate, formatKrw, formatKrwCompact, getDDay } from '../lib/format'
import { memberName } from '../data/members'
import { useStoreVersion } from '../lib/useStoreVersion'
import { isAdvancedVisible } from '../lib/featureVisibility'
import {
  activityRepository,
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
} from '../repositories'
import { archiveProject } from '../services/projectService'
import { summarizeProjectSurveys } from '../services/projectSurveyService'
import {
  STEP_STATE_LABEL,
  collectProgressInputs,
  getProjectProgress,
  type StepViewState,
} from '../services/projectProgressService'
import { RESPONDENT_ROLE_META } from '../lib/surveyMeta'
import { buildSurveyUrl } from '../services/surveyTokenService'
import { LocalTestModeBadge } from '../components/runtime/LocalTestModeBanner'
import { SurveyLinkCreateModal } from '../components/runtime/SurveyLinkCreateModal'
import { ProjectTypeBadge } from '../components/domain/ProjectTypeBadge'
import { ActivityTimeline } from '../components/ui/ActivityTimeline'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { DetailHeader } from '../components/ui/DetailHeader'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { NotFoundState } from '../components/ui/NotFoundState'
import { Panel } from '../components/ui/Panel'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useToast } from '../components/ui/toastContext'

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.875rem] text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

/** 단계 상태별 색상 (완료=초록, 진행 중=브랜드, 시작 가능=슬레이트, 잠김=연한 슬레이트) */
const STEP_STATE_TEXT_CLASS: Record<StepViewState, string> = {
  completed: 'text-success-700',
  in_progress: 'text-brand-700',
  ready: 'text-slate-500',
  blocked_by_prerequisite: 'text-slate-400',
}

const STEP_CIRCLE_CLASS: Record<StepViewState, string> = {
  completed: 'border-success-600 bg-success-600 text-white',
  in_progress: 'border-brand-600 bg-white text-brand-700 ring-2 ring-brand-100',
  ready: 'border-slate-300 bg-white text-slate-500',
  blocked_by_prerequisite: 'border-slate-200 bg-slate-50 text-slate-300',
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

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

  // 프로젝트를 열면 전역 프로젝트 컨텍스트로 설정한다(프로젝트 중심 정보구조).
  const { setActiveProject } = useActiveProject()
  useEffect(() => {
    if (projectId) setActiveProject(projectId)
  }, [projectId, setActiveProject])

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

  // 진행상태 단일 기준 — 화면 임의 계산·하드코딩 진행률 금지
  const progress = getProjectProgress(project)
  const inputs = collectProgressInputs(project)
  const nextAction = progress.nextAction

  const dday = getDDay(project.nextActionDueDate)
  const levelLabel = levelFieldLabel(project.projectType)
  const surveyStatuses = summarizeProjectSurveys(project)
  const distributions = surveyDistributionRepository.getByProjectId(project.id)
  const distsByRole = (role: string) =>
    distributions.filter((d) => d.respondentRole === role)
  const anyReady = surveyStatuses.some((s) => s.state === 'ready')

  // 진단 설문 패널 — 진단 단계가 열려 있고 아직 완료되지 않았을 때만 (홈페이지 단독은 사전진단 확정 전까지)
  const diagnosisStep = progress.steps.find((s) => s.key === 'diagnosis')
  const showSurveyPanel = diagnosisStep
    ? diagnosisStep.state === 'ready' || diagnosisStep.state === 'in_progress'
    : project.projectType === 'website' && !inputs.assessmentFinalized

  const validationPath = `/validation/projects/${project.id}`
  const fundingPath = `/funding/projects/${project.id}`
  const advancedVisible = isAdvancedVisible()

  // 현재 준비된 결과물 — 진행상태 서비스와 동일한 확정 기준만 사용
  const resultItems = [
    {
      key: 'assessment',
      label: '확정 진단 결과',
      exists: inputs.assessmentFinalized,
      path: `/diagnosis/projects/${project.id}/analysis`,
      condition: '대표자·현장 응답이 제출되면 진단 결과를 만들 수 있습니다.',
      show: true,
    },
    {
      key: 'selection',
      label: '확정 핵심 업무',
      exists: inputs.selectionFinalized,
      path: `/selection/projects/${project.id}/decision`,
      condition: '진단 결과를 확정하면 먼저 만들 업무를 선택할 수 있습니다.',
      show: project.projectType !== 'website',
    },
    {
      key: 'ax-design',
      label: 'AX 설계안',
      exists: inputs.axDesignFinalized,
      path: `/mvp-design/projects/${project.id}`,
      condition: '만들 업무를 확정하면 기능·화면 설계안을 만들 수 있습니다.',
      show: project.projectType !== 'website',
    },
    {
      key: 'website-design',
      label: '홈페이지 설계안',
      exists: inputs.websiteFinalized,
      path: `/website-studio/projects/${project.id}`,
      condition:
        project.projectType === 'website'
          ? '홈페이지 구조·콘텐츠·디자인 설계를 확정하면 설계안이 준비됩니다.'
          : '만들 업무를 확정하면 홈페이지 설계안을 함께 만들 수 있습니다.',
      show: project.projectType !== 'ax',
    },
    {
      key: 'deliverables',
      label: '결과자료',
      exists: inputs.deliverableFinalized,
      path: `/deliverables/projects/${project.id}`,
      condition: '진단 또는 설계 결과를 확정하면 결과자료를 만들 수 있습니다.',
      show: true,
    },
  ].filter((item) => item.show)

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(buildSurveyUrl(token))
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 링크 상세에서 직접 복사해 주세요.')
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
      {/* 1. 현재 프로젝트 — 이름·고객사·유형과 실제 진행상태 */}
      <DetailHeader
        backTo={organization ? `/clients/${organization.id}` : '/clients'}
        backLabel={organization ? `${organization.name} 상세` : '고객사 목록'}
        title={project.name}
        badges={
          <>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] font-semibold tracking-wide text-slate-500">
              {project.projectCode}
            </span>
            <ProjectTypeBadge type={project.projectType} compact />
            {progress.isSample && (
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[13px] font-semibold text-brand-700">
                샘플
              </span>
            )}
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
            <span className="font-medium text-slate-700">
              진행 {progress.stepText} · 현재 단계 {progress.currentStep.label}
            </span>
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
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.875rem] break-keep text-slate-600">
          {formatDate(project.archivedAt)}에 보관 처리된 프로젝트입니다. 데이터는
          유지됩니다.
        </p>
      )}

      {/* 2. 지금 해야 할 일 — 하나의 핵심 행동 (진행상태 단일 기준) */}
      {!project.archivedAt && (
        <section
          aria-label="지금 해야 할 일"
          className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5"
        >
          <p className="text-[13px] font-semibold tracking-wide text-brand-700 uppercase">
            지금 해야 할 일
          </p>
          <p className="mt-1.5 text-lg font-bold break-keep text-slate-900">
            {nextAction.title}
          </p>
          <p className="mt-1 text-[0.875rem] break-keep text-slate-600">
            {nextAction.reason}
          </p>
          <div className="mt-3.5">
            <Button variant="primary" onClick={() => navigate(nextAction.path)}>
              {nextAction.buttonLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </section>
      )}

      {/* 3. 핵심 단계 — 실제 데이터 기준의 단계별 상태 */}
      <Panel title="핵심 단계" flush>
        <ol className="flex flex-col divide-y divide-slate-100">
          {progress.steps.map((step, index) => {
            const blocked = step.state === 'blocked_by_prerequisite'
            const inner = (
              <>
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${STEP_CIRCLE_CLASS[step.state]}`}
                >
                  {step.state === 'completed' ? (
                    <Check aria-hidden="true" className="size-4" />
                  ) : blocked ? (
                    <Lock aria-hidden="true" className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                    <span
                      className={`text-[0.95rem] font-semibold break-keep ${blocked ? 'text-slate-400' : 'text-slate-800'}`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-[13px] font-semibold ${STEP_STATE_TEXT_CLASS[step.state]}`}
                    >
                      {STEP_STATE_LABEL[step.state]}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-[0.875rem] leading-relaxed break-keep ${blocked ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    {step.detail}
                  </p>
                </div>
              </>
            )
            return (
              <li key={step.key}>
                {blocked ? (
                  // 잠긴 단계는 이동 메뉴가 아니라 이유 안내로만 보여준다
                  <div className="flex items-start gap-3.5 px-5 py-4">{inner}</div>
                ) : (
                  <Link
                    to={step.path}
                    className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50"
                  >
                    {inner}
                    <ArrowRight
                      aria-hidden="true"
                      className="mt-1.5 size-4 shrink-0 text-slate-300"
                    />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </Panel>

      {/* 4. 현재 준비된 결과물 — 확정 기준으로 실제 존재하는 것만 */}
      <Panel title="현재 준비된 결과물" flush>
        <ul className="flex flex-col divide-y divide-slate-100">
          {resultItems.map((item) =>
            item.exists ? (
              <li key={item.key}>
                <Link
                  to={item.path}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
                    <Check aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="text-[0.95rem] font-semibold break-keep text-slate-800">
                    {item.label}
                  </span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-600">
                    열기
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </span>
                </Link>
              </li>
            ) : (
              <li key={item.key} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-300">
                  <Minus aria-hidden="true" className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <span className="text-[0.95rem] font-medium break-keep text-slate-500">
                    {item.label}
                  </span>
                  <p className="mt-0.5 text-[0.875rem] leading-relaxed break-keep text-slate-500">
                    {item.condition}
                  </p>
                </div>
              </li>
            ),
          )}
        </ul>
      </Panel>

      {/* 진단 설문 운영 (진단 단계가 열려 있는 동안) */}
      {showSurveyPanel && (
        <Panel
          title={
            project.projectType === 'website'
              ? '홈페이지 제작 사전진단'
              : '진단 설문'
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/diagnosis/projects/${project.id}/setup`)}
              >
                <ClipboardList aria-hidden="true" className="size-4" />
                설문 설계
              </Button>
              {anyReady && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/diagnosis/projects/${project.id}/surveys`)}
                >
                  <Link2 aria-hidden="true" className="size-4" />
                  링크 관리
                </Button>
              )}
            </div>
          }
        >
          <ul className="flex flex-col gap-2.5">
            {surveyStatuses.map((status) => {
              const tone =
                status.state === 'ready'
                  ? 'success'
                  : status.state === 'draft'
                    ? 'warning'
                    : 'neutral'
              const label =
                status.state === 'ready'
                  ? '준비 완료'
                  : status.state === 'draft'
                    ? '초안'
                    : '미작성'
              const links = distsByRole(status.respondentRole)
              const submitted = links.find((d) => d.status === 'submitted')
              const activeLink = links.find(
                (d) =>
                  d.status === 'issued' ||
                  d.status === 'opened' ||
                  d.status === 'in_progress',
              )
              return (
                <li
                  key={status.respondentRole}
                  className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-slate-200 px-4 py-3"
                >
                  <span className="min-w-24 text-sm font-medium text-slate-700">
                    {RESPONDENT_ROLE_META[status.respondentRole].label}
                  </span>
                  <StatusBadge tone={tone} withDot>
                    {label}
                  </StatusBadge>
                  {status.state !== 'none' && (
                    <span className="text-[0.875rem] text-slate-500">
                      문항 {status.questionCount}개 · 약 {status.estimatedMinutes}분
                    </span>
                  )}
                  {links.length > 0 && (
                    <span className="text-[0.875rem] text-slate-500">
                      발급 {links.length}
                    </span>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-1">
                    {status.state === 'draft' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/diagnosis/projects/${project.id}/setup`)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        <FilePen aria-hidden="true" className="size-3.5" />
                        계속 설계
                      </button>
                    )}
                    {status.state === 'none' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/diagnosis/projects/${project.id}/setup`)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        <ClipboardList aria-hidden="true" className="size-3.5" />
                        설계 시작
                      </button>
                    )}
                    {status.state === 'ready' && links.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setLinkModalOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                        테스트 링크 생성
                      </button>
                    )}
                    {submitted && (
                      <button
                        type="button"
                        onClick={() => navigate(`/diagnosis/surveys/${submitted.id}/response`)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        응답 상세 보기
                      </button>
                    )}
                    {!submitted && activeLink && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/diagnosis/surveys/${activeLink.id}`)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
                        >
                          응답 현황 보기
                        </button>
                        <button
                          type="button"
                          aria-label="응답자 화면 열기"
                          onClick={() => window.open(buildSurveyUrl(activeLink.accessToken), '_blank')}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <ExternalLink aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="테스트 링크 복사"
                          onClick={() => copyLink(activeLink.accessToken)}
                          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Copy aria-hidden="true" className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 flex items-center gap-2 text-[0.875rem] break-keep text-slate-500">
            <LocalTestModeBadge />
            테스트 링크와 응답은 이 브라우저에만 저장됩니다. 외부 공유는 Supabase 연결 후 제공됩니다.
          </p>
        </Panel>
      )}

      {/* 5. 확인이 필요한 항목 — 등록된 위험·다음 행동 메모 */}
      <Panel title="확인이 필요한 항목">
        {project.riskSummary || project.nextAction ? (
          <div className="flex flex-col gap-3">
            {project.riskSummary && (
              <p className="flex items-start gap-2.5 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-sm break-keep text-warning-700">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {project.riskSummary}
              </p>
            )}
            {project.nextAction && (
              <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.875rem] font-semibold text-slate-500">
                    다음 행동 메모
                  </span>
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
                <p className="mt-2 text-sm font-medium break-keep text-slate-800">
                  {project.nextAction}
                </p>
                {project.nextActionDueDate && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[0.875rem] text-slate-500">
                    <CalendarClock aria-hidden="true" className="size-3.5" />
                    예정일 {formatDate(project.nextActionDueDate)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[0.875rem] text-slate-500">
            현재 확인이 필요한 항목이 없습니다.
          </p>
        )}
      </Panel>

      {/* 6. 고급 운영 기능 — 기본 접힘 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">고급 운영 기능</h2>
            <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">
              프로젝트 후반에 사용하는 고급 운영 기능입니다.
            </p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-slate-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-2.5 border-t border-slate-100 px-5 py-4">
            <Link
              to={validationPath}
              className="flex items-center gap-3 rounded-(--radius-card) border border-slate-200 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <SearchCheck aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <span className="text-[0.95rem] font-semibold text-slate-800">
                  실제 사용 테스트
                </span>
                <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">
                  확정된 설계를 실제 담당자가 사용해 보고 판정합니다.
                </p>
              </div>
              <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-slate-300" />
            </Link>
            <Link
              to={fundingPath}
              className="flex items-center gap-3 rounded-(--radius-card) border border-slate-200 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <Landmark aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <span className="text-[0.95rem] font-semibold text-slate-800">
                  기관·자금 연계
                </span>
                <p className="mt-0.5 text-[0.875rem] break-keep text-slate-500">
                  연결할 기관·지원 유형과 준비자료·진행 결과를 관리합니다.
                </p>
              </div>
              <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-slate-300" />
            </Link>
            {!advancedVisible && (
              <p className="text-[0.875rem] break-keep text-slate-500">
                설정에서 "고급 운영 기능 보기"를 켜면 메뉴에 항상 표시됩니다.{' '}
                <Link to="/settings" className="font-medium text-brand-600 hover:underline">
                  설정 열기
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* 핵심 요약 */}
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
              <SummaryItem
                label="진행 단계"
                value={`${progress.stepText} · ${progress.currentStep.label}`}
              />
            </dl>
          </Panel>

          {/* 자금조달 연계 */}
          <Panel title="자금조달 연계">
            {project.fundingRequired ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <dt className="text-[0.875rem] text-slate-400">목표 기관</dt>
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
                  <dt className="text-[0.875rem] text-slate-400">현재 준비 상태</dt>
                  <dd className="mt-0.5 text-sm break-keep text-slate-700">
                    {inputs.deliverableFinalized
                      ? '결과자료가 확정되어 제출자료로 활용할 수 있습니다.'
                      : '진단·설계 결과를 확정하면 제출자료 준비를 시작할 수 있습니다.'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-[0.875rem] text-slate-500">자금조달 연계 없음</p>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {/* 최근 활동 */}
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

      <SurveyLinkCreateModal
        open={linkModalOpen}
        presetProjectId={project.id}
        onClose={() => setLinkModalOpen(false)}
        onViewDetail={(d) => navigate(`/diagnosis/surveys/${d.id}`)}
      />
    </div>
  )
}
