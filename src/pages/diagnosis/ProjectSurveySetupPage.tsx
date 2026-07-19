import {
  Check,
  Plus,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RespondentRole } from '../../types'
import type { Question } from '../../types/survey'
import { normalizeQuery } from '../../lib/format'
import {
  RESPONDENT_ROLE_META,
  resolveIndustryKey,
} from '../../lib/surveyMeta'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  organizationRepository,
  projectRepository,
  projectSurveyBlueprintRepository,
  questionRepository,
  surveyTemplateRepository,
} from '../../repositories'
import {
  calculateBlueprintQuality,
  composeProjectSurvey,
  getRecommendedModulesForProject,
  saveProjectSurveyBlueprint,
  surveyRolesForProject,
} from '../../services/projectSurveyService'
import { computeCompositionSummary } from '../../services/surveyComposition'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Button } from '../../components/ui/Button'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { SurveyQualityPanel } from '../../components/diagnosis/SurveyQualityPanel'
import { SurveyCompositionSummaryView } from '../../components/diagnosis/SurveyCompositionSummary'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import {
  QuestionScopeBadge,
  QuestionTypeBadge,
  RespondentRoleBadge,
  TemplateStatusBadge,
} from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

function StepHeading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
        {n}
      </span>
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

export function ProjectSurveySetupPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()

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

  const roles = project ? surveyRolesForProject(project) : ['owner' as const]
  const [respondentRole, setRespondentRole] = useState<RespondentRole>(roles[0])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [excludedQuestionIds, setExcludedQuestionIds] = useState<string[]>([])
  const [additionalQuestionIds, setAdditionalQuestionIds] = useState<string[]>([])
  const [requiredOverrides, setRequiredOverrides] = useState<
    Record<string, boolean>
  >({})
  const [initializedFor, setInitializedFor] = useState<string | null>(null)
  const [customQuery, setCustomQuery] = useState('')
  const [saving, setSaving] = useState(false)

  const recommendations = useMemo(
    () => (project ? getRecommendedModulesForProject(project, organization) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, organization, version],
  )

  const publishedTemplates = useMemo(
    () => surveyTemplateRepository.search({ status: 'published' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
  const draftTemplates = useMemo(
    () => surveyTemplateRepository.search({ status: 'draft' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  // 응답자 변경 시 기존 초안 로드 또는 추천값 초기화
  const initKey = `${projectId}:${respondentRole}`
  if (project && initializedFor !== initKey) {
    const existing = projectSurveyBlueprintRepository
      .getByProjectId(projectId)
      .find((b) => b.respondentRole === respondentRole)

    if (existing) {
      setTemplateId(existing.templateId)
      setSelectedModuleIds(existing.selectedModuleIds)
      setExcludedQuestionIds(existing.excludedQuestionIds)
      setAdditionalQuestionIds(existing.additionalQuestionIds)
      const overrides: Record<string, boolean> = {}
      existing.sections.forEach((s) =>
        s.placements.forEach((p) => {
          overrides[p.questionId] = p.required
        }),
      )
      setRequiredOverrides(overrides)
    } else {
      // 추천 템플릿(응답자 일치, 게시) + 추천 모듈 자동 선택
      const roleTemplate =
        publishedTemplates.find((t) => t.respondentRole === respondentRole) ??
        publishedTemplates.find(
          (t) =>
            respondentRole === 'mixed' && t.purpose === 'website_readiness',
        ) ??
        (respondentRole === 'mixed'
          ? publishedTemplates.find((t) => t.respondentRole === 'mixed')
          : undefined) ??
        null
      setTemplateId(roleTemplate?.id ?? null)
      setSelectedModuleIds(recommendations.map((r) => r.module.id))
      setExcludedQuestionIds([])
      setAdditionalQuestionIds([])
      setRequiredOverrides({})
    }
    setInitializedFor(initKey)
  }

  const composed = useMemo(() => {
    if (!project) return []
    return composeProjectSurvey({
      templateId,
      respondentRole,
      selectedModuleIds,
      additionalQuestionIds,
      excludedQuestionIds: [],
      requiredOverrides,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    templateId,
    respondentRole,
    selectedModuleIds,
    additionalQuestionIds,
    requiredOverrides,
    version,
  ])

  // 실제 저장에 반영될(제외 적용된) 구성
  const finalComposed = useMemo(() => {
    if (!project) return []
    return composeProjectSurvey({
      templateId,
      respondentRole,
      selectedModuleIds,
      additionalQuestionIds,
      excludedQuestionIds,
      requiredOverrides,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    templateId,
    respondentRole,
    selectedModuleIds,
    additionalQuestionIds,
    excludedQuestionIds,
    requiredOverrides,
    version,
  ])

  const summary = useMemo(
    () => computeCompositionSummary(finalComposed),
    [finalComposed],
  )
  const quality = useMemo(() => {
    if (!project) return { checks: [], verdict: 'error' as const, errorCount: 0, warningCount: 0 }
    return calculateBlueprintQuality(
      finalComposed,
      project,
      organization,
      respondentRole,
    )
  }, [finalComposed, project, organization, respondentRole])

  const excludedSet = new Set(excludedQuestionIds)

  const customCandidates = useMemo(() => {
    const q = normalizeQuery(customQuery)
    if (!q) return []
    const placed = new Set(
      composed.flatMap((s) => s.placements.map((p) => p.questionId)),
    )
    return questionRepository
      .getAll()
      .filter((question) => !placed.has(question.id))
      .filter((question) =>
        `${question.code} ${question.text}`.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [customQuery, composed])

  if (!project) {
    return (
      <NotFoundState
        title="프로젝트를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
        backTo="/diagnosis"
        backLabel="진단 스튜디오로 돌아가기"
      />
    )
  }

  const toggleModule = (id: string) =>
    setSelectedModuleIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )
  const toggleExclude = (questionId: string) =>
    setExcludedQuestionIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((q) => q !== questionId)
        : [...prev, questionId],
    )
  const addCustom = (questionId: string) => {
    setAdditionalQuestionIds((prev) =>
      prev.includes(questionId) ? prev : [...prev, questionId],
    )
    setCustomQuery('')
  }
  const removeCustom = (questionId: string) =>
    setAdditionalQuestionIds((prev) => prev.filter((q) => q !== questionId))
  const setRequired = (questionId: string, required: boolean) =>
    setRequiredOverrides((prev) => ({ ...prev, [questionId]: required }))

  const handleSave = (markReady: boolean) => {
    if (saving) return
    setSaving(true)
    try {
      saveProjectSurveyBlueprint(
        {
          projectId,
          templateId,
          respondentRole,
          selectedModuleIds,
          additionalQuestionIds,
          excludedQuestionIds,
          requiredOverrides,
          markReady,
        },
        project,
        organization,
      )
      showToast(
        markReady
          ? `${RESPONDENT_ROLE_META[respondentRole].label}용 설문을 준비 완료했습니다.`
          : '설문 초안을 저장했습니다.',
      )
      if (markReady) navigate(`/projects/${projectId}`)
      else setSaving(false)
    } catch (error) {
      setSaving(false)
      showToast(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  const industryKey = organization
    ? resolveIndustryKey(organization.industry)
    : null
  const additionalQuestions = additionalQuestionIds
    .map((id) => questionRepository.getById(id))
    .filter((q): q is Question => q !== null)

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`/projects/${projectId}`}
        backLabel={`${project.name} 상세`}
        title="프로젝트 설문 설계"
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
            <span>{organization?.industry}</span>
            <span>{project.name}</span>
          </>
        }
      />

      {project.currentStage === 'intake' && (
        <p className="rounded-(--radius-card) border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] break-keep text-brand-700">
          설문 발급과 응답 수집은 다음 개발 단계에서 제공됩니다. 현재 프로젝트 단계는
          변경되지 않습니다.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* 좌측: 단계 구성 */}
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* 1. 응답자 선택 */}
          <Panel title="">
            <StepHeading n={1} title="응답자 선택" hint="한 번에 하나의 응답자 설문을 설계합니다." />
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map((role) => {
                const active = role === respondentRole
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRespondentRole(role)}
                    className={`flex h-10 cursor-pointer items-center gap-2 rounded-(--radius-control) border px-3.5 text-sm font-medium ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {RESPONDENT_ROLE_META[role].label}
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* 2. 기본 템플릿 선택 */}
          <Panel title="">
            <StepHeading n={2} title="기본 템플릿 선택" hint="응답자에 맞는 게시 템플릿을 우선 추천합니다." />
            <div className="mt-3 flex flex-col gap-2">
              {publishedTemplates.length === 0 && draftTemplates.length === 0 && (
                <p className="text-[13px] text-slate-400">
                  사용할 수 있는 템플릿이 없습니다. 템플릿을 먼저 만들어 주세요.
                </p>
              )}
              {publishedTemplates.map((t) => {
                const active = t.id === templateId
                const recommended = t.respondentRole === respondentRole
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${
                      active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={active}
                      onChange={() => setTemplateId(t.id)}
                      className="size-4 accent-brand-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">
                        문항 {t.sections.reduce((n, s) => n + s.placements.length, 0)}개 · 약{' '}
                        {t.estimatedMinutes}분
                      </p>
                    </div>
                    <RespondentRoleBadge role={t.respondentRole} />
                    {recommended && (
                      <span className="rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
                        추천
                      </span>
                    )}
                  </label>
                )
              })}
              {draftTemplates.map((t) => {
                const active = t.id === templateId
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${
                      active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={active}
                      onChange={() => setTemplateId(t.id)}
                      className="size-4 accent-brand-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                      <p className="text-xs text-warning-600">
                        초안 템플릿입니다. 게시본을 우선 사용하는 것을 권장합니다.
                      </p>
                    </div>
                    <TemplateStatusBadge status={t.status} />
                  </label>
                )
              })}
            </div>
          </Panel>

          {/* 3. 추천 모듈 선택 */}
          <Panel title="">
            <StepHeading
              n={3}
              title="추천 모듈 선택"
              hint="업종·프로젝트 유형·자금조달 연계 여부로 추천합니다."
            />
            <div className="mt-3 flex flex-col gap-2">
              {recommendations.length === 0 ? (
                <p className="text-[13px] text-slate-400">
                  이 프로젝트에 추천되는 모듈이 없습니다.
                </p>
              ) : (
                recommendations.map(({ module, reason }) => {
                  const active = selectedModuleIds.includes(module.id)
                  return (
                    <label
                      key={module.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${
                        active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleModule(module.id)}
                        className="mt-0.5 size-4 accent-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{module.name}</p>
                        <p className="text-xs text-slate-500">
                          질문 {module.questionIds.length}개 · {reason}
                        </p>
                      </div>
                    </label>
                  )
                })
              )}
              {!industryKey && project.projectType !== 'website' && (
                <p className="text-xs text-slate-400">
                  고객사 업종이 표준 업종으로 인식되지 않아 업종 모듈이 자동
                  추천되지 않았습니다.
                </p>
              )}
            </div>
          </Panel>

          {/* 4. 맞춤 질문 조정 */}
          <Panel title="">
            <StepHeading
              n={4}
              title="질문 조합 조정"
              hint="질문을 제외하거나 프로젝트 맞춤 질문을 추가합니다."
            />

            {/* 맞춤 질문 추가 */}
            <div className="mt-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  aria-label="맞춤 질문 검색"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="추가할 질문을 코드·문구로 검색"
                  className="h-10 w-full rounded-(--radius-control) border border-slate-300 pr-3 pl-9 text-sm focus:border-brand-500"
                />
              </div>
              {customCandidates.length > 0 && (
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
                  {customCandidates.map((q) => (
                    <li key={q.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs text-slate-400">{q.code}</span>
                        <p className="truncate text-[13px] text-slate-700">{q.text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addCustom(q.id)}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Plus aria-hidden="true" className="size-3" />
                        추가
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {additionalQuestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {additionalQuestions.map((q) => (
                    <span
                      key={q.id}
                      className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs text-warning-700"
                    >
                      {q.code}
                      <button
                        type="button"
                        aria-label={`${q.code} 맞춤 질문 제거`}
                        onClick={() => removeCustom(q.id)}
                        className="cursor-pointer hover:text-warning-900"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 조합된 질문 목록 */}
            <div className="mt-4 flex flex-col gap-4">
              {composed.map((section) => (
                <div key={section.id}>
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-700">
                    {section.title}
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
                    {section.placements.map((p) => {
                      const excluded = excludedSet.has(p.questionId)
                      const q = p.question
                      return (
                        <li
                          key={p.placementId}
                          className={`flex items-start gap-2.5 px-3 py-2.5 ${excluded ? 'opacity-50' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs text-slate-400">
                              {q?.code}
                            </span>
                            <p className="text-[13px] break-keep text-slate-700">
                              {q?.text}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {q && <QuestionScopeBadge scope={p.sourceScope} />}
                              {q && <QuestionTypeBadge type={q.type} />}
                              <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={p.required}
                                  disabled={excluded}
                                  onChange={(e) =>
                                    setRequired(p.questionId, e.target.checked)
                                  }
                                  className="size-3.5 accent-brand-600"
                                />
                                필수
                              </label>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleExclude(p.questionId)}
                            aria-label={excluded ? `${q?.code} 제외 취소` : `${q?.code} 제외`}
                            className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${
                              excluded
                                ? 'border-brand-300 text-brand-600 hover:bg-brand-50'
                                : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {excluded ? (
                              <>
                                <RotateCcw aria-hidden="true" className="size-3" />
                                제외 취소
                              </>
                            ) : (
                              <>
                                <X aria-hidden="true" className="size-3" />
                                제외
                              </>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
              {composed.length === 0 && (
                <p className="text-[13px] text-slate-400">
                  템플릿 또는 모듈을 선택하면 질문이 조합됩니다.
                </p>
              )}
            </div>
          </Panel>
        </div>

        {/* 우측: 요약 + 품질 + 저장 */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-5 xl:sticky xl:top-20">
            <Panel title="최종 요약">
              <SurveyCompositionSummaryView summary={summary} />
            </Panel>

            <Panel title="">
              <StepHeading n={5} title="품질검사 및 저장" />
              <div className="mt-3">
                <SurveyQualityPanel checks={quality.checks} />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  <Save aria-hidden="true" className="size-4" />
                  초안 저장
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleSave(true)}
                  disabled={saving || quality.verdict === 'error'}
                  title={
                    quality.verdict === 'error'
                      ? '품질 오류를 먼저 해결하세요.'
                      : undefined
                  }
                >
                  <Check aria-hidden="true" className="size-4" />
                  설문 준비 완료
                </Button>
                {quality.verdict === 'error' && (
                  <p className="text-xs text-danger-600">
                    품질 오류가 있어 준비 완료할 수 없습니다.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-400"
              >
                고객용 설문 링크 발급 (다음 단계에서 제공)
              </button>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
