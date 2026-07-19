import {
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate, formatDateTime } from '../../lib/format'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import {
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
} from '../../repositories'
import { summarizeProjectSurveys } from '../../services/projectSurveyService'
import { getProjectSurveyResponseSummary } from '../../services/surveyRuntimeService'
import { buildSurveyUrl } from '../../services/surveyTokenService'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Button } from '../../components/ui/Button'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocalTestModeBanner } from '../../components/runtime/LocalTestModeBanner'
import { SurveyLinkCreateModal } from '../../components/runtime/SurveyLinkCreateModal'
import { SurveyDistributionStatusBadge } from '../../components/runtime/badges'
import {
  ProjectTypeBadge,
} from '../../components/domain/ProjectTypeBadge'
import { RespondentRoleBadge } from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

export function ProjectSurveysPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [modalOpen, setModalOpen] = useState(false)

  const project = useMemo(
    () => projectRepository.getById(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )
  const organization = project
    ? organizationRepository.getById(project.organizationId)
    : null

  const roleStatuses = useMemo(
    () => (project ? summarizeProjectSurveys(project) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, version],
  )
  const distributions = useMemo(
    () => surveyDistributionRepository.getByProjectId(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )
  const responseSummary = useMemo(
    () => getProjectSurveyResponseSummary(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )

  if (!project) {
    return (
      <NotFoundState
        title="프로젝트를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
        backTo="/diagnosis/surveys"
        backLabel="설문 관리로 돌아가기"
      />
    )
  }

  const hasReady = roleStatuses.some((s) => s.state === 'ready')
  const linksByRole = (role: string) =>
    distributions.filter((d) => d.respondentRole === role)

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(buildSurveyUrl(token))
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 링크 상세에서 직접 복사해 주세요.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`/projects/${projectId}`}
        backLabel={`${project.name} 상세`}
        title="프로젝트 설문 링크 관리"
        badges={
          <>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {project.projectCode}
            </span>
            <ProjectTypeBadge type={project.projectType} compact />
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
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
        actions={
          hasReady ? (
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              테스트 링크 생성
            </Button>
          ) : undefined
        }
      />

      <LocalTestModeBanner />

      {!hasReady ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={ClipboardList}
            title="먼저 프로젝트 설문을 준비 완료해주세요"
            description="응답자별 설문을 설계하고 준비 완료하면 테스트 링크를 생성할 수 있습니다."
            action={
              <Button
                variant="primary"
                onClick={() => navigate(`/diagnosis/projects/${projectId}/setup`)}
              >
                설문 설계로 이동
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* A. 준비 완료 설문 */}
          <Panel title="준비 완료 설문">
            <ul className="flex flex-col gap-3">
              {roleStatuses.map((status) => {
                const links = linksByRole(status.respondentRole)
                const submitted = links.filter((d) => d.status === 'submitted').length
                return (
                  <li
                    key={status.respondentRole}
                    className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-slate-200 px-4 py-3"
                  >
                    <RespondentRoleBadge role={status.respondentRole} />
                    {status.state === 'none' ? (
                      <span className="text-[13px] text-slate-400">미작성</span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        문항 {status.questionCount}개 · 약 {status.estimatedMinutes}분 · 수정{' '}
                        {formatDate(status.updatedAt)}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      발급 {links.length} · 제출 {submitted}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {status.state === 'ready' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setModalOpen(true)}
                        >
                          <Plus aria-hidden="true" className="size-3.5" />
                          링크 생성
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/diagnosis/projects/${projectId}/setup`)}
                        >
                          설문 편집
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>

          {/* B. 발급된 테스트 링크 */}
          <Panel title={`발급된 테스트 링크 (${distributions.length})`} flush>
            {distributions.length === 0 ? (
              <EmptyState
                icon={ExternalLink}
                title="아직 발급된 링크가 없습니다"
                description="준비 완료된 설문에서 테스트 링크를 생성하세요."
                action={
                  <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                    <Plus aria-hidden="true" className="size-4" />
                    테스트 링크 생성
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {distributions.map((d) => (
                  <li key={d.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {d.recipientName}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {d.recipientPosition}
                        </span>
                      </p>
                      <RespondentRoleBadge role={d.respondentRole} />
                      <SurveyDistributionStatusBadge status={d.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>발급 {formatDate(d.issuedAt)}</span>
                      <span>만료 {d.expiresAt ? formatDate(d.expiresAt) : '없음'}</span>
                      {d.submittedAt && <span>제출 {formatDateTime(d.submittedAt)}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => window.open(buildSurveyUrl(d.accessToken), '_blank')}
                        disabled={d.status === 'revoked' || d.status === 'expired'}
                        className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-600 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                        응답자 화면 열기
                      </button>
                      <button
                        type="button"
                        onClick={() => copyLink(d.accessToken)}
                        disabled={d.status === 'revoked' || d.status === 'expired'}
                        className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-slate-500 disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        <Copy aria-hidden="true" className="size-3.5" />
                        복사
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/diagnosis/surveys/${d.id}`)}
                        className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand-600"
                      >
                        <Eye aria-hidden="true" className="size-3.5" />
                        상세
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* C. 응답 현황 요약 */}
          <Panel title="응답 현황 요약">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ['발급', responseSummary.issued],
                ['미시작', responseSummary.notStarted],
                ['작성 중', responseSummary.inProgress],
                ['제출 완료', responseSummary.submitted],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-slate-400">평균 진행률</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <ProgressBar value={responseSummary.averageProgress} tone="info" label="평균 진행률" />
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {responseSummary.averageProgress}%
                  </span>
                </dd>
              </div>
            </dl>
          </Panel>
        </>
      )}

      <SurveyLinkCreateModal
        open={modalOpen}
        presetProjectId={projectId}
        onClose={() => setModalOpen(false)}
        onViewDetail={(d) => navigate(`/diagnosis/surveys/${d.id}`)}
      />
    </div>
  )
}
