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
import { summarizeProjectSurveys } from '../services/projectSurveyService'
import { getProjectAnalysisContext } from '../services/assessmentService'
import { getProjectSelectionContext } from '../services/selectionService'
import {
  AssessmentConfidenceBadge,
  AssessmentRecommendationBadge,
  AssessmentStatusBadge,
} from '../components/assessment/badges'
import {
  PriorityQuadrantBadge,
  SelectionStatusBadge,
} from '../components/selection/badges'
import { Filter, Target } from 'lucide-react'
import { RESPONDENT_ROLE_META } from '../lib/surveyMeta'
import {
  BarChart3,
  ClipboardList,
  Copy,
  ExternalLink,
  FilePen,
  Link2,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { surveyDistributionRepository } from '../repositories'
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
  const [linkModalOpen, setLinkModalOpen] = useState(false)

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
  const isDiagnosisStage =
    project.currentStage === 'intake' || project.currentStage === 'diagnosis'
  const surveyStatuses = summarizeProjectSurveys(project)
  const distributions = surveyDistributionRepository.getByProjectId(project.id)
  const distsByRole = (role: string) =>
    distributions.filter((d) => d.respondentRole === role)
  const anyReady = surveyStatuses.some((s) => s.state === 'ready')
  const analysis = getProjectAnalysisContext(project.id)
  const analysisPath = `/diagnosis/projects/${project.id}/analysis`
  const selection = getProjectSelectionContext(project.id)
  const selectionPath = `/selection/projects/${project.id}`
  const primaryCandidate =
    selection?.decision?.primaryCandidateId && selection
      ? selection.candidates.find((c) => c.id === selection.decision?.primaryCandidateId) ?? null
      : null

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(buildSurveyUrl(token))
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 링크 상세에서 직접 복사해 주세요.')
    }
  }

  const handleNextStage = () => {
    // 상담 접수·진단 단계는 프로젝트 설문 설계 워크벤치로 이동
    if (isDiagnosisStage) {
      navigate(`/diagnosis/projects/${project.id}/setup`)
      return
    }
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

      {/* 진단 설문 (상담 접수·진단 단계) */}
      {isDiagnosisStage && (
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
                    <span className="text-xs text-slate-400">
                      문항 {status.questionCount}개 · 약 {status.estimatedMinutes}분
                    </span>
                  )}
                  {links.length > 0 && (
                    <span className="text-xs text-slate-400">
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
          <p className="mt-3 flex items-center gap-2 text-xs break-keep text-slate-400">
            <LocalTestModeBadge />
            테스트 링크와 응답은 이 브라우저에만 저장됩니다. 외부 공유는 Supabase 연결 후 제공됩니다.
          </p>
        </Panel>
      )}

      {/* 진단 분석 */}
      {analysis && analysis.submittedCount > 0 && (
        <Panel
          title="진단 분석"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(analysis.latest ? `${analysisPath}/result` : analysisPath)
              }
            >
              <BarChart3 aria-hidden="true" className="size-4" />
              {analysis.latest ? '분석 결과 보기' : '진단 분석 시작'}
            </Button>
          }
        >
          {!analysis.latest ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] break-keep text-slate-600">
                제출 완료된 응답 {analysis.submittedCount}건을 기준으로 진단 분석을 실행할 수
                있습니다.
              </p>
              <Button variant="primary" size="sm" onClick={() => navigate(analysisPath)}>
                <BarChart3 aria-hidden="true" className="size-4" />
                진단 분석 시작
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <AssessmentStatusBadge status={analysis.latest.status} />
                {analysis.needsReanalysisFlag && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    재분석 필요
                  </span>
                )}
              </div>
              {analysis.latest.analysisKind === 'website' ? (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="text-2xl font-bold text-slate-900">
                    준비도 {analysis.latest.websiteReadiness?.overallScore ?? 0}
                    <span className="text-sm font-medium text-slate-400"> / 100</span>
                  </span>
                  <AssessmentConfidenceBadge confidence={analysis.latest.confidence} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {analysis.latest.finalScore}
                    <span className="text-sm font-medium text-slate-400"> / 100</span>
                  </span>
                  <AssessmentRecommendationBadge recommendation={analysis.latest.recommendation} />
                  <AssessmentConfidenceBadge confidence={analysis.latest.confidence} />
                </div>
              )}
              {analysis.latest.status === 'finalized' && analysis.latest.finalizedAt && (
                <p className="text-xs text-slate-400">
                  확정 {formatDate(analysis.latest.finalizedAt)}
                </p>
              )}
              {analysis.latest.suggestedNextActions.length > 0 && (
                <p className="text-[13px] break-keep text-slate-600">
                  다음 행동: {analysis.latest.suggestedNextActions[0]}
                </p>
              )}
              <p className="text-xs break-keep text-slate-400">
                제출 응답과 사전 정의된 진단 규칙을 기준으로 계산되었습니다.
              </p>
            </div>
          )}
        </Panel>
      )}

      {/* 과제선별 */}
      {selection && project.projectType !== 'website' && (
        <Panel
          title="과제선별"
          actions={
            selection.lifecycle !== 'not_eligible' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(selection.lifecycle === 'finalized' ? `${selectionPath}/decision` : selectionPath)
                }
              >
                <Filter aria-hidden="true" className="size-4" />
                {selection.lifecycle === 'finalized'
                  ? '선정 결과 보기'
                  : selection.candidates.length > 0
                    ? '과제선별 계속'
                    : '과제선별 시작'}
              </Button>
            ) : undefined
          }
        >
          {selection.lifecycle === 'not_eligible' ? (
            <p className="text-[13px] break-keep text-slate-500">
              진단 결과를 확정하면 자동화 후보 과제를 추출하고 핵심 과제를 선정할 수 있습니다.
            </p>
          ) : selection.lifecycle === 'finalized' && selection.decision ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SelectionStatusBadge status={selection.decision.status} />
                {selection.needsReselectionFlag && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    재선별 필요
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Target aria-hidden="true" className="size-4 text-brand-500" />
                <span className="text-lg font-bold text-slate-900">{primaryCandidate?.name ?? '핵심 과제 미정'}</span>
                {primaryCandidate && (
                  <>
                    <span className="text-sm font-semibold text-slate-500">{primaryCandidate.priorityScore}점</span>
                    <PriorityQuadrantBadge quadrant={primaryCandidate.quadrant} />
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400">
                보조 과제 {selection.decision.secondaryCandidateIds.length}개 · 권장 {mvpLevelLabel(selection.decision.recommendedMvpLevel, 'ax')}
                {selection.decision.finalizedAt && ` · 확정 ${formatDate(selection.decision.finalizedAt)}`}
              </p>
              <p className="text-xs break-keep text-slate-400">
                Stage 7 MVP 설계 준비 {selection.handoff ? '완료' : '대기'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {selection.candidates.length > 0 ? (
                  <p className="text-[13px] break-keep text-slate-600">
                    자동화 후보 {selection.candidates.length}건이 추출되었습니다.
                    {selection.decision ? ' 선정 초안을 검토하세요.' : ' 후보를 검토하고 핵심 과제를 선정하세요.'}
                  </p>
                ) : (
                  <p className="text-[13px] break-keep text-slate-600">
                    확정된 진단 결과에서 자동화 후보 과제를 추출할 수 있습니다.
                  </p>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={() => navigate(selectionPath)}>
                <Filter aria-hidden="true" className="size-4" />
                {selection.candidates.length > 0 ? '과제선별 계속' : '과제선별 시작'}
              </Button>
            </div>
          )}
        </Panel>
      )}

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

      <SurveyLinkCreateModal
        open={linkModalOpen}
        presetProjectId={project.id}
        onClose={() => setLinkModalOpen(false)}
        onViewDetail={(d) => navigate(`/diagnosis/surveys/${d.id}`)}
      />
    </div>
  )
}
