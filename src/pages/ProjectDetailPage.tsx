import {
  Archive,
  ArrowRight,
  CalendarClock,
  Pencil,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useActiveProject } from '../context/activeProject'
import { NextActionHero } from '../components/workspace/NextActionHero'
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
import { getProjectDesignContext } from '../services/mvpDesignService'
import { getProjectWebsiteContext } from '../services/websiteDesignService'
import { getProjectValidationContext } from '../services/validationService'
import {
  TrackBadge,
  WorkspaceStatusBadge,
} from '../components/validation/badges'
import { getProjectDeliverableContext } from '../services/deliverableService'
import {
  PackageStatusBadge,
  PackageTypeBadge,
} from '../components/deliverables/badges'
import { getProjectFundingContext } from '../services/fundingService'
import { StrategyStatusBadge } from '../components/funding/badges'
import { WebsiteStatusBadge, WebsiteTypeBadge } from '../components/websiteStudio/badges'
import { WEBSITE_TYPE_META } from '../lib/websiteDesignMeta'
import {
  FLOW_STEPS,
  computeProjectJourney,
  flowStepIndex,
} from '../services/journeyService'
import { JourneyFlow, type JourneyFlowStep } from '../components/domain/JourneyFlow'
import {
  AssessmentConfidenceBadge,
  AssessmentRecommendationBadge,
  AssessmentStatusBadge,
} from '../components/assessment/badges'
import {
  PriorityQuadrantBadge,
  SelectionStatusBadge,
} from '../components/selection/badges'
import { DesignStatusBadge } from '../components/mvpDesign/badges'
import { Filter, Palette, PencilRuler, Target } from 'lucide-react'
import { RESPONDENT_ROLE_META } from '../lib/surveyMeta'
import {
  BarChart3,
  ClipboardList,
  Copy,
  ExternalLink,
  FilePen,
  FileText,
  Landmark,
  Link2,
  Plus,
  RefreshCw,
  SearchCheck,
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
  const design = getProjectDesignContext(project.id)
  const designPath = `/mvp-design/projects/${project.id}`
  const website =
    project.projectType === 'website' || project.projectType === 'ax_website'
      ? getProjectWebsiteContext(project.id)
      : null
  const websitePath = `/website-studio/projects/${project.id}`
  const validation = getProjectValidationContext(project.id)
  const validationPath = `/validation/projects/${project.id}`
  const deliverable = getProjectDeliverableContext(project.id)
  const deliverablePath = `/deliverables/projects/${project.id}`
  const funding = getProjectFundingContext(project.id)
  const fundingPath = `/funding/projects/${project.id}`
  const journey = computeProjectJourney(project)
  const currentFlowIndex = flowStepIndex(journey.currentStepKey)

  // 완료·현재·잠금 상태의 쉬운 명칭 흐름 (홈페이지 단독 프로젝트는 제외)
  const flowStepPath: Partial<Record<string, string>> = {
    prepare: `/projects/${project.id}`,
    diagnosis: analysis?.latest ? `${analysisPath}/result` : analysisPath,
    selection: selectionPath,
    design: designPath,
    validation: design?.design ? `${designPath}/review` : undefined,
    deliverables: undefined,
  }
  const flowHint: Partial<Record<string, string>> = {
    diagnosis: '설문 응답 제출 후 진행',
    selection: '진단 결과 확정 후 진행',
    design: '핵심 업무 선정 후 진행',
    validation: '설계 확정 후 진행',
    deliverables: '검증 완료 후 진행',
  }
  const journeySteps: JourneyFlowStep[] = FLOW_STEPS.filter((s) => s.key !== 'done').map((s) => {
    const idx = flowStepIndex(s.key)
    const state: JourneyFlowStep['state'] =
      idx < currentFlowIndex ? 'done' : idx === currentFlowIndex ? 'current' : 'locked'
    return {
      key: s.key,
      label: s.label,
      state,
      path: state === 'locked' ? undefined : flowStepPath[s.key],
      hint: flowHint[s.key],
    }
  })

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
      {/* 프로젝트 컨트롤 센터 — 지금 해야 할 일이 가장 크게 보인다 */}
      <NextActionHero
        eyebrow={`${organization?.name ?? '고객사'} · ${project.name}`}
        actionText={journey.actionText}
        reason={journey.reason}
        actionLabel={journey.actionLabel}
        actionPath={journey.actionPath}
      />
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
            <Button variant="primary" onClick={() => navigate(journey.actionPath)}>
              {journey.actionLabel}
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

      {/* 지금 해야 할 일 — 하나의 핵심 행동 */}
      {!project.archivedAt && (
        <section
          aria-label="지금 해야 할 일"
          className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5"
        >
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
          <p className="mt-1.5 text-base font-semibold break-keep text-slate-900">{journey.actionText}</p>
          <p className="mt-1 text-[13px] break-keep text-slate-600">{journey.reason}</p>
          <div className="mt-3">
            <Button variant="primary" onClick={() => navigate(journey.actionPath)}>
              {journey.actionLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </section>
      )}

      {/* A. 전체 진행 흐름 (쉬운 명칭 · 완료/현재/잠금) */}
      {project.projectType !== 'website' ? (
        <Panel title="전체 진행 흐름">
          <JourneyFlow steps={journeySteps} onNavigate={(path) => navigate(path)} />
        </Panel>
      ) : (
        <Panel title="전체 진행 흐름">
          <StageProgress
            flow={STAGE_FLOW_BY_TYPE[project.projectType]}
            currentStage={project.currentStage}
          />
        </Panel>
      )}

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

      {/* MVP 설계 */}
      {design && project.projectType !== 'website' && design.lifecycle !== 'not_eligible' && (
        <Panel
          title="MVP 설계"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(design.design ? designPath : `${designPath}`)}
            >
              <PencilRuler aria-hidden="true" className="size-4" />
              {design.lifecycle === 'finalized'
                ? '설계 결과 보기'
                : design.design
                  ? 'MVP 설계 계속'
                  : 'MVP 설계 시작'}
            </Button>
          }
        >
          {design.lifecycle === 'finalized' && design.design ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <DesignStatusBadge status={design.design.status} />
                {design.needsRedesignFlag && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    재설계 필요
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PencilRuler aria-hidden="true" className="size-4 text-brand-500" />
                <span className="text-lg font-bold text-slate-900">{design.design.coreTaskName}</span>
                <span className="text-sm font-semibold text-slate-500">
                  {mvpLevelLabel(design.design.levelDecision.selectedLevel, project.projectType)}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                필수 기능 {design.design.features.filter((f) => f.scope === 'must').length}개 · 화면{' '}
                {design.design.screens.filter((s) => s.scope !== 'excluded').length}개
                {design.design.finalizedAt && ` · 확정 ${formatDate(design.design.finalizedAt)}`}
              </p>
              <p className="text-xs break-keep text-slate-400">Stage 8 현장검증 인계 준비 완료</p>
            </div>
          ) : (
            <p className="text-[13px] break-keep text-slate-600">
              {design.design
                ? `MVP 설계 초안이 있습니다. 기능 범위와 검증 기준을 검토해 확정하세요.`
                : '확정된 핵심 과제로 개발 가능한 기능·화면·데이터·검증 기준을 설계할 수 있습니다.'}
            </p>
          )}
        </Panel>
      )}

      {/* 홈페이지 설계 */}
      {website && (
        <Panel
          title="홈페이지 설계"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate(websitePath)}>
              <Palette aria-hidden="true" className="size-4" />
              {website.lifecycle === 'finalized'
                ? '설계 결과 보기'
                : website.design
                  ? '홈페이지 설계 계속'
                  : '홈페이지 설계 시작'}
            </Button>
          }
        >
          {website.lifecycle === 'finalized' && website.design ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <WebsiteStatusBadge status={website.design.status} />
                <WebsiteTypeBadge type={website.design.strategy.websiteType} />
                {website.needsRedesignFlag && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    재설계 필요
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {WEBSITE_TYPE_META[website.design.strategy.websiteType].label} · 페이지{' '}
                {website.design.pages.filter((p) => p.status !== 'excluded').length}개 · 개발 지시문{' '}
                {website.design.generatedPrompts.length}종
                {website.design.finalizedAt && ` · 확정 ${formatDate(website.design.finalizedAt)}`}
              </p>
              <p className="text-xs break-keep text-slate-400">
                핵심 CTA:{' '}
                {website.design.strategy.conversionActions.find(
                  (c) => c.id === website.design?.strategy.primaryConversionActionId,
                )?.label ?? '미설정'}
                {' · '}콘텐츠 준비 확인 필요
              </p>
            </div>
          ) : (
            <p className="text-[13px] break-keep text-slate-600">
              {website.design
                ? '홈페이지 설계 초안이 있습니다. 사이트 구조·콘텐츠·디자인을 검토해 개발 지시문을 확정하세요.'
                : '홈페이지 진단 결과로 사이트 구조·콘텐츠·디자인 방향과 개발 지시문을 설계할 수 있습니다.'}
            </p>
          )}
        </Panel>
      )}

      {/* 실제 사용 테스트 (Stage-Gate) */}
      {validation && validation.tracks.some((t) => t.eligibility.available || t.workspace) && (
        <Panel
          title="실제 사용 테스트"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate(validationPath)}>
              <SearchCheck aria-hidden="true" className="size-4" />
              테스트 열기
            </Button>
          }
        >
          <p className="mb-3 text-[13px] break-keep text-slate-500">
            확정된 설계를 실제 담당자가 사용해 보고 Gate로 판정합니다. AX와 홈페이지는 별도 트랙으로 각각 검증합니다(결과를 합산하지 않습니다).
          </p>
          <div className="flex flex-col gap-2.5">
            {validation.tracks.map((track) => (
              <div
                key={track.trackType}
                className="flex flex-wrap items-center gap-2 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5"
              >
                <TrackBadge track={track.trackType} />
                {track.workspace ? (
                  <>
                    <WorkspaceStatusBadge status={track.workspace.status} />
                    <span className="text-xs text-slate-500">{track.summary?.headline}</span>
                    {track.needsRevalidationFlag && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                        <RefreshCw aria-hidden="true" className="size-3" />
                        재검증 필요
                      </span>
                    )}
                  </>
                ) : track.eligibility.available ? (
                  <span className="text-xs text-slate-500">검증 준비됨 — 워크스페이스 생성 대기</span>
                ) : (
                  <span className="text-xs break-keep text-slate-400">{track.eligibility.reason}</span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 제출자료 */}
      {deliverable && deliverable.eligibility.canCreate && (
        <Panel
          title="제출자료"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate(deliverablePath)}>
              <FileText aria-hidden="true" className="size-4" />
              {deliverable.latest ? '자료 열기' : '자료 만들기'}
            </Button>
          }
        >
          {deliverable.latest ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <PackageTypeBadge type={deliverable.latest.type} />
                <PackageStatusBadge status={deliverable.latest.status} />
                <span className="text-xs text-slate-400">v{deliverable.latest.version}</span>
                {deliverable.latestStale && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    원본 변경
                  </span>
                )}
              </div>
              <p className="text-[13px] break-keep text-slate-500">
                확정 결과를 보고서·개발명세·로드맵·개발 프롬프트로 정리합니다. AX와 홈페이지는 별도 트랙으로 관리하며 결과를 합산하지 않습니다.
              </p>
            </div>
          ) : (
            <p className="text-[13px] break-keep text-slate-600">
              확정된 진단·설계·테스트 결과를 고객 설명·개발 전달·기관 준비용 자료 패키지로 만들 수 있습니다.
            </p>
          )}
        </Panel>
      )}

      {/* 기관·자금 연계 */}
      {funding && funding.eligibility.canCreate && (
        <Panel
          title="기관·자금 연계"
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate(fundingPath)}>
              <Landmark aria-hidden="true" className="size-4" />
              {funding.latest ? '연계 열기' : '연계 시작'}
            </Button>
          }
        >
          {funding.latest ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StrategyStatusBadge status={funding.latest.status} />
                <span className="text-xs text-slate-400">v{funding.latest.version}</span>
                <span className="text-xs text-slate-500">
                  후보 기관 {funding.latest.matches.filter((m) => m.priority !== 'excluded').length}개 · 결과 {funding.latest.outcomes.length}건
                </span>
                {funding.latestStale && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                    <RefreshCw aria-hidden="true" className="size-3" />
                    재검토 필요
                  </span>
                )}
              </div>
              <p className="text-[13px] break-keep text-slate-500">
                연결할 기관·지원 유형을 검토하고 준비자료·진행상태·결과·사례를 관리합니다. 승인 가능성·금액은 예측하지 않으며, 실제 조건은 공식 공고 확인이 필요합니다.
              </p>
            </div>
          ) : (
            <p className="text-[13px] break-keep text-slate-600">
              진단·설계·검증 결과를 바탕으로 연결할 기관·지원 유형과 준비자료, 진행 결과를 관리할 수 있습니다.
            </p>
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
