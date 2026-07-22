import {
  ChevronDown,
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
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { DiagnosisFlowShell } from '../../components/diagnosis/DiagnosisFlowShell'
import {
  projectRepository,
  surveyDistributionRepository,
} from '../../repositories'
import { summarizeProjectSurveys } from '../../services/projectSurveyService'
import { getProjectSurveyResponseSummary } from '../../services/surveyRuntimeService'
import { buildSurveyUrl } from '../../services/surveyTokenService'
import { Button } from '../../components/ui/Button'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { LocalTestModeBanner } from '../../components/runtime/LocalTestModeBanner'
import { SurveyLinkCreateModal } from '../../components/runtime/SurveyLinkCreateModal'
import { SurveyDistributionStatusBadge } from '../../components/runtime/badges'
import { RespondentRoleBadge } from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

export function ProjectSurveysPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [modalOpen, setModalOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const project = useMemo(
    () => projectRepository.getById(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )

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

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard?.writeText(buildSurveyUrl(token))
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 링크 상세에서 직접 복사해 주세요.')
    }
  }

  const linksByRole = (role: string) =>
    distributions.filter((d) => d.respondentRole === role)

  // 역할별 응답 현황: 설문 초안(blueprint) 또는 발급 링크(distribution)가
  // 있는 역할을 모두 포함한다. 가이드 데모는 초안 없이 링크만 만들 수 있으므로
  // 두 출처를 합쳐서 판단한다.
  const roleViews = roleStatuses
    .map((status) => {
      const links = linksByRole(status.respondentRole)
      const submitted = links.filter((d) => d.status === 'submitted').length
      // 초안이 없으면 발급 링크 스냅샷에서 문항 수를 추정한다.
      const snapshotCount = links[0]?.blueprintSnapshot.reduce(
        (n, s) => n + s.placements.length,
        0,
      )
      return {
        respondentRole: status.respondentRole,
        roleLabel: RESPONDENT_ROLE_META[status.respondentRole].label,
        state: status.state,
        questionCount: status.questionCount || snapshotCount || 0,
        estimatedMinutes: status.estimatedMinutes,
        links,
        submitted,
        hasLink: links.length > 0,
        hasSurvey: status.state !== 'none' || links.length > 0,
      }
    })
    .filter((v) => v.hasSurvey)

  const submittedRoles = roleViews.filter((v) => v.submitted > 0)
  const pendingRoles = roleViews.filter((v) => v.submitted === 0)
  const canBuildResult = submittedRoles.length > 0
  const hasAnySurvey = roleViews.length > 0

  return (
    <DiagnosisFlowShell projectId={projectId} step="responses">
      <div className="flex flex-col gap-5">
        <LocalTestModeBanner />

      {!hasAnySurvey ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={ClipboardList}
            title="먼저 진단 설문을 준비하세요"
            description="진단 대상 역할을 정하고 질문을 구성해 준비를 마치면, 역할별 설문 링크를 만들고 응답을 받을 수 있습니다."
            action={
              <Button variant="primary" onClick={() => navigate(`/diagnosis/projects/${projectId}/setup`)}>
                진단 대상·질문 구성하러 가기
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* 지금 무엇이 더 필요한가 */}
          <section className="rounded-(--radius-panel) border border-brand-100 bg-brand-50/50 p-5 sm:p-6">
            <h2 className="text-[1.25rem] font-bold break-keep text-slate-900">진단 결과를 만들려면 어떤 응답이 더 필요할까요?</h2>
            <p className="mt-2 text-[1rem] break-keep text-slate-600">
              {pendingRoles.length === 0
                ? '필요한 역할의 응답이 모두 제출되었습니다. 이제 진단 결과를 만들 수 있습니다.'
                : `${pendingRoles.map((r) => r.roleLabel).join(', ')}의 응답이 제출되면 서로 다른 관점을 비교해 진단 결과를 만들 수 있습니다.`}
            </p>
            <Button variant="primary" className="mt-4 h-auto w-full py-2.5 sm:w-auto" disabled={!canBuildResult} onClick={() => navigate(`/diagnosis/projects/${projectId}/analysis`)}>
              <span className="whitespace-normal">제출된 응답으로 진단 결과 만들기</span>
            </Button>
            {!canBuildResult && <p className="mt-2 text-[0.9rem] text-slate-500">아직 제출된 응답이 없습니다. 아래에서 역할별 링크를 만들어 응답을 받으세요.</p>}
          </section>

          {/* 역할별 응답 상태 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {roleViews.map((view) => {
              const { roleLabel, links, submitted, hasLink } = view
              const stateLabel = submitted > 0 ? '제출 완료' : hasLink ? '작성 대기·진행 중' : '링크 준비 필요'
              const stateCls = submitted > 0 ? 'border-success-200 bg-success-50 text-success-700' : hasLink ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-100 text-slate-600'
              const primaryLink = links[0]
              return (
                <div key={view.respondentRole} className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[1.1rem] font-bold text-slate-900">{roleLabel}</p>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[0.85rem] font-semibold ${stateCls}`}>{stateLabel}</span>
                  </div>
                  <p className="text-[0.9rem] text-slate-500">문항 {view.questionCount}개 · 약 {view.estimatedMinutes}분 · 발급 {links.length} · 제출 {submitted}</p>
                  {hasLink && <ProgressBar value={submitted > 0 ? 100 : 10} tone={submitted > 0 ? 'success' : 'info'} label={`${roleLabel} 진행률`} />}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {submitted > 0 && primaryLink ? (
                      <Button variant="primary" size="sm" onClick={() => navigate(`/diagnosis/surveys/${primaryLink.id}`)}>제출된 {roleLabel} 응답 확인하기</Button>
                    ) : hasLink && primaryLink ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => copyLink(primaryLink.accessToken)}><Copy aria-hidden="true" className="size-3.5" />{roleLabel} 링크 복사하기</Button>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/diagnosis/surveys/${primaryLink.id}`)}>응답 확인하기</Button>
                      </>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}><Plus aria-hidden="true" className="size-3.5" />{roleLabel} 설문 링크 만들기</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 진단 결과 생성 조건 */}
          <Panel title="진단 결과 생성 조건">
            <ul className="flex flex-col gap-2 text-[0.95rem]">
              {[
                { ok: canBuildResult, label: '필요한 역할의 응답이 제출됨' },
                { ok: pendingRoles.length === 0, label: '모든 대상 역할의 응답 제출 완료' },
                { ok: responseSummary.submitted > 0, label: '제출된 응답에 필수 답변 포함' },
              ].map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span className={`flex size-5 items-center justify-center rounded-full text-[0.7rem] font-bold ${c.ok ? 'bg-success-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{c.ok ? '✓' : '·'}</span>
                  <span className={c.ok ? 'text-slate-700' : 'text-slate-500'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Panel>

          {/* 고급 링크 관리 (접힘) */}
          <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
            <button type="button" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700">
              고급 링크 관리 (발급 내역·만료·응답 현황)
              <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
            {showAdvanced && (
            <div className="border-t border-slate-100 p-5">
          <Panel title={`발급된 설문 링크 (${distributions.length})`} flush>
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
                        <span className="ml-1.5 text-[0.875rem] font-normal text-slate-400">
                          {d.recipientPosition}
                        </span>
                      </p>
                      <RespondentRoleBadge role={d.respondentRole} />
                      <SurveyDistributionStatusBadge status={d.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-slate-400">
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
                  <dt className="text-[0.875rem] text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[0.85rem] text-slate-400">평균 진행률</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <ProgressBar value={responseSummary.averageProgress} tone="info" label="평균 진행률" />
                  <span className="shrink-0 text-[0.95rem] font-semibold text-slate-700">
                    {responseSummary.averageProgress}%
                  </span>
                </dd>
              </div>
            </dl>
          </Panel>
            </div>
            )}
          </div>
        </>
      )}

      <SurveyLinkCreateModal
        open={modalOpen}
        presetProjectId={projectId}
        onClose={() => setModalOpen(false)}
        onViewDetail={(d) => navigate(`/diagnosis/surveys/${d.id}`)}
      />
      </div>
    </DiagnosisFlowShell>
  )
}
