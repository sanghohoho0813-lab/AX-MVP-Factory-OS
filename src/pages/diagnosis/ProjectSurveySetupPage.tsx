import {
  Check,
  ChevronDown,
  Clock,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RespondentRole } from '../../types'
import type { Question } from '../../types/survey'
import { normalizeQuery } from '../../lib/format'
import {
  RESPONDENT_ROLE_META,
  ROLE_RECOMMENDED_MINUTES,
  ROLE_RECOMMENDED_QUESTIONS,
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
import { Button } from '../../components/ui/Button'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { SurveyQualityPanel } from '../../components/diagnosis/SurveyQualityPanel'
import { SurveyCompositionSummaryView } from '../../components/diagnosis/SurveyCompositionSummary'
import {
  DiagnosisFlowShell,
  SummaryLine,
} from '../../components/diagnosis/DiagnosisFlowShell'
import {
  QuestionScopeBadge,
  QuestionTypeBadge,
  RespondentRoleBadge,
  TemplateStatusBadge,
} from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

/** 역할별 진단 관점 안내 (친절한 설명) */
const ROLE_PERSPECTIVE: Record<RespondentRole, string> = {
  owner: '회사 전체 방향과 투자 판단 관점에서 확인합니다.',
  manager: '부서 운영·업무 관리 관점에서 확인합니다.',
  worker: '실제 현장 업무와 반복 작업 관점에서 확인합니다.',
  mixed: '홈페이지·공통 관점에서 확인합니다.',
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
  const [showExpert, setShowExpert] = useState(false)
  const [showAdvancedLink, setShowAdvancedLink] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // 역할별 설문 준비 상태 (카드에 준비 완료 여부 표시)
  const blueprintsByRole = useMemo(
    () => projectSurveyBlueprintRepository.getByProjectId(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )

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
      if (markReady) navigate(`/diagnosis/projects/${projectId}/surveys`)
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

  const expertOpen = showExpert || quality.verdict === 'error'
  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  const roleLabel = RESPONDENT_ROLE_META[respondentRole].label

  const summaryPanel = (
    <div className="flex flex-col gap-4">
      <SummaryLine label="진단 대상" value={roleLabel} />
      <SummaryLine label="질문 수" value={`${summary.totalQuestions}개`} />
      <SummaryLine label="예상 시간" value={`약 ${summary.estimatedMinutes}분`} />
      <SummaryLine
        label="준비 상태"
        value={quality.verdict === 'error' ? '확인 필요' : '준비 가능'}
        tone={quality.verdict === 'error' ? 'warn' : 'ok'}
      />
      <div className="pt-1">
        <SurveyCompositionSummaryView summary={summary} />
      </div>
    </div>
  )

  return (
    <DiagnosisFlowShell projectId={projectId} step="target" summary={summaryPanel}>
      <div className="flex flex-col gap-5">
        {/* §3 진단 대상 선택 */}
        <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-[1.25rem] font-bold break-keep text-slate-900">누구의 업무 경험을 확인할까요?</h2>
          <p className="mt-1.5 text-[1rem] break-keep text-slate-600">
            역할마다 보는 관점이 다릅니다. 지금 준비할 대상을 고르면 그 역할에 맞는 질문이 자동으로 구성됩니다. 최소 한 명은 있어야 진단을 시작할 수 있습니다.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => {
              const active = role === respondentRole
              const meta = RESPONDENT_ROLE_META[role]
              const RoleIcon = meta.icon
              const saved = blueprintsByRole.find((b) => b.respondentRole === role)
              const ready = saved?.status === 'ready'
              const qRange = ROLE_RECOMMENDED_QUESTIONS[role]
              const qText = saved
                ? `${saved.sections.reduce((n, s) => n + s.placements.length, 0)}개`
                : `약 ${qRange.min}~${qRange.max}개`
              const minutes = saved?.estimatedMinutes || ROLE_RECOMMENDED_MINUTES[role]
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setRespondentRole(role)}
                  aria-pressed={active}
                  className={`flex flex-col gap-2 rounded-(--radius-panel) border p-4 text-left transition-colors ${
                    active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[1.1rem] font-bold break-keep text-slate-900">
                    <RoleIcon aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
                    {meta.label}
                  </span>
                  <p className="text-[0.92rem] break-keep text-slate-500">{ROLE_PERSPECTIVE[role]}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.88rem] text-slate-500">
                    <span className="break-keep">예상 질문 {qText}</span>
                    <span className="inline-flex items-center gap-1"><Clock aria-hidden="true" className="size-3.5" />약 {minutes}분</span>
                  </div>
                  <div className="mt-auto pt-1">
                    {ready ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2.5 py-0.5 text-[0.82rem] font-semibold text-success-700"><Check aria-hidden="true" className="size-3.5" />준비 완료</span>
                    ) : active ? (
                      <span className="inline-flex items-center rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-[0.82rem] font-semibold text-brand-700">선택됨 · 아래에서 구성</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[0.82rem] font-medium text-slate-500">눌러서 선택</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* §4 질문 구성 — 그룹 카드 */}
        <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[1.25rem] font-bold break-keep text-slate-900">{roleLabel}에게 물어볼 질문</h2>
            <span className="text-[0.9rem] text-slate-500">전체 {summary.totalQuestions}개 · 약 {summary.estimatedMinutes}분</span>
          </div>
          <p className="mt-1.5 text-[1rem] break-keep text-slate-600">
            주제별로 묶어 두었습니다. 그룹을 펼치면 실제 질문을 볼 수 있고, 필요 없는 질문은 제외할 수 있습니다.
          </p>

          {composed.length === 0 ? (
            <p className="mt-4 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 text-[0.95rem] text-slate-500">
              아직 질문이 없습니다. 아래 전문가 설정에서 템플릿이나 모듈을 선택하면 질문이 구성됩니다.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {composed.map((section) => {
                const open = expandedGroups[section.id] ?? false
                const activeCount = section.placements.filter((p) => !excludedSet.has(p.questionId)).length
                return (
                  <div key={section.id} className="rounded-(--radius-panel) border border-slate-200">
                    <button
                      type="button"
                      onClick={() => toggleGroup(section.id)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block text-[1.05rem] font-semibold break-keep text-slate-800">{section.title}</span>
                        <span className="block text-[0.88rem] text-slate-500">질문 {activeCount}개</span>
                      </span>
                      <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {section.placements.map((p) => {
                          const excluded = excludedSet.has(p.questionId)
                          const q = p.question
                          return (
                            <li key={p.placementId} className={`flex items-start gap-2.5 px-4 py-3 ${excluded ? 'opacity-50' : ''}`}>
                              <div className="min-w-0 flex-1">
                                <p className="text-[0.98rem] break-keep text-slate-700">{q?.text}</p>
                                {expertOpen && (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[0.78rem] text-slate-400">{q?.code}</span>
                                    {q && <QuestionScopeBadge scope={p.sourceScope} />}
                                    {q && <QuestionTypeBadge type={q.type} />}
                                    <label className="flex cursor-pointer items-center gap-1 text-[0.85rem] text-slate-500">
                                      <input
                                        type="checkbox"
                                        checked={p.required}
                                        disabled={excluded}
                                        onChange={(e) => setRequired(p.questionId, e.target.checked)}
                                        className="size-3.5 accent-brand-600"
                                      />
                                      필수
                                    </label>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleExclude(p.questionId)}
                                aria-label={excluded ? `${q?.code} 제외 취소` : `${q?.code} 제외`}
                                className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-[0.82rem] font-medium ${
                                  excluded ? 'border-brand-300 text-brand-600 hover:bg-brand-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                                }`}
                              >
                                {excluded ? (<><RotateCcw aria-hidden="true" className="size-3" />포함</>) : (<><X aria-hidden="true" className="size-3" />제외</>)}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 전문가 설정 (접힘 — 오류 시 자동 펼침) */}
          <div className="mt-4 rounded-(--radius-panel) border border-slate-200 bg-slate-50/60">
            <button
              type="button"
              onClick={() => setShowExpert((v) => !v)}
              aria-expanded={expertOpen}
              className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-[1rem] font-semibold text-slate-700"
            >
              <span className="flex items-center gap-2"><Settings2 aria-hidden="true" className="size-4.5 text-slate-400" />전문가 설정 (템플릿·모듈·맞춤 질문·필수 여부)</span>
              <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${expertOpen ? 'rotate-180' : ''}`} />
            </button>
            {expertOpen && (
              <div className="flex flex-col gap-5 border-t border-slate-100 px-4 py-5">
                {quality.verdict === 'error' && (
                  <p className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-[0.9rem] text-danger-700">
                    확인이 필요한 항목이 있어 전문가 설정을 펼쳤습니다. 아래에서 템플릿·모듈 구성을 조정해 주세요.
                  </p>
                )}
                {/* 기본 템플릿 */}
                <div>
                  <p className="mb-2 text-[0.95rem] font-semibold text-slate-700">기본 템플릿</p>
                  <div className="flex flex-col gap-2">
                    {publishedTemplates.length === 0 && draftTemplates.length === 0 && (
                      <p className="text-[0.9rem] text-slate-400">사용할 수 있는 템플릿이 없습니다.</p>
                    )}
                    {publishedTemplates.map((t) => {
                      const active = t.id === templateId
                      const recommended = t.respondentRole === respondentRole
                      return (
                        <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <input type="radio" name="template" checked={active} onChange={() => setTemplateId(t.id)} className="size-4 accent-brand-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.95rem] font-medium text-slate-800">{t.name}</p>
                            <p className="text-[0.82rem] text-slate-400">문항 {t.sections.reduce((n, s) => n + s.placements.length, 0)}개 · 약 {t.estimatedMinutes}분</p>
                          </div>
                          <RespondentRoleBadge role={t.respondentRole} />
                          {recommended && <span className="rounded-md border border-success-200 bg-success-50 px-2 py-0.5 text-[0.8rem] font-medium text-success-700">추천</span>}
                        </label>
                      )
                    })}
                    {draftTemplates.map((t) => {
                      const active = t.id === templateId
                      return (
                        <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <input type="radio" name="template" checked={active} onChange={() => setTemplateId(t.id)} className="size-4 accent-brand-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.95rem] font-medium text-slate-800">{t.name}</p>
                            <p className="text-[0.82rem] text-warning-600">초안 템플릿입니다. 게시본을 우선 사용하는 것을 권장합니다.</p>
                          </div>
                          <TemplateStatusBadge status={t.status} />
                        </label>
                      )
                    })}
                  </div>
                </div>
                {/* 추천 모듈 */}
                <div>
                  <p className="mb-2 text-[0.95rem] font-semibold text-slate-700">추천 모듈</p>
                  <div className="flex flex-col gap-2">
                    {recommendations.length === 0 ? (
                      <p className="text-[0.9rem] text-slate-400">이 프로젝트에 추천되는 모듈이 없습니다.</p>
                    ) : (
                      recommendations.map(({ module, reason }) => {
                        const active = selectedModuleIds.includes(module.id)
                        return (
                          <label key={module.id} className={`flex cursor-pointer items-start gap-3 rounded-(--radius-control) border px-3.5 py-2.5 ${active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <input type="checkbox" checked={active} onChange={() => toggleModule(module.id)} className="mt-0.5 size-4 accent-brand-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.95rem] font-medium text-slate-800">{module.name}</p>
                              <p className="text-[0.82rem] text-slate-500">질문 {module.questionIds.length}개 · {reason}</p>
                            </div>
                          </label>
                        )
                      })
                    )}
                    {!industryKey && project.projectType !== 'website' && (
                      <p className="text-[0.82rem] text-slate-400">고객사 업종이 표준 업종으로 인식되지 않아 업종 모듈이 자동 추천되지 않았습니다.</p>
                    )}
                  </div>
                </div>
                {/* 맞춤 질문 추가 */}
                <div>
                  <p className="mb-2 text-[0.95rem] font-semibold text-slate-700">맞춤 질문 추가</p>
                  <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <input type="search" aria-label="맞춤 질문 검색" value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder="추가할 질문을 코드·문구로 검색" className="h-10 w-full rounded-(--radius-control) border border-slate-300 pr-3 pl-9 text-[0.95rem] focus:border-brand-500" />
                  </div>
                  {customCandidates.length > 0 && (
                    <ul className="mt-1.5 divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
                      {customCandidates.map((q) => (
                        <li key={q.id} className="flex items-center gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-[0.78rem] text-slate-400">{q.code}</span>
                            <p className="truncate text-[0.9rem] text-slate-700">{q.text}</p>
                          </div>
                          <button type="button" onClick={() => addCustom(q.id)} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[0.82rem] font-medium text-slate-600 hover:bg-slate-50">
                            <Plus aria-hidden="true" className="size-3" />추가
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {additionalQuestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {additionalQuestions.map((q) => (
                        <span key={q.id} className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.82rem] text-warning-700">
                          {q.code}
                          <button type="button" aria-label={`${q.code} 맞춤 질문 제거`} onClick={() => removeCustom(q.id)} className="cursor-pointer hover:text-warning-900">
                            <X aria-hidden="true" className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* §5 발송 전 확인 */}
        <section className="rounded-(--radius-panel) border border-brand-100 bg-brand-50/50 p-5 sm:p-6">
          <h2 className="text-[1.25rem] font-bold break-keep text-slate-900">설문을 만들기 전에 마지막으로 확인하세요</h2>
          <p className="mt-1.5 text-[1rem] break-keep text-slate-600">
            {quality.verdict === 'error'
              ? '아직 확인이 필요한 항목이 있습니다. 위 전문가 설정에서 질문 구성을 조정한 뒤 준비를 마칠 수 있습니다.'
              : '구성이 좋아 보입니다. 준비를 마치면 역할별 응답을 받을 수 있습니다.'}
          </p>

          <div className="mt-4 rounded-(--radius-panel) border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-[0.95rem] font-semibold text-slate-700">
              {quality.verdict === 'error' ? (
                <TriangleAlert aria-hidden="true" className="size-4.5 text-warning-500" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-4.5 text-success-500" />
              )}
              설문 품질 확인
            </div>
            <SurveyQualityPanel checks={quality.checks} />
          </div>

          <p className="mt-3 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5 text-[0.9rem] break-keep text-slate-500">
            로컬 모드는 이 브라우저에만 저장됩니다. 준비한 설문과 응답은 같은 브라우저에서만 열 수 있으며, 외부 공유는 Supabase 연결 후 제공됩니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button variant="primary" className="h-auto py-2.5" onClick={() => handleSave(true)} disabled={saving || quality.verdict === 'error'} title={quality.verdict === 'error' ? '확인이 필요한 항목을 먼저 해결하세요.' : undefined}>
              <Check aria-hidden="true" className="size-4 shrink-0" /><span className="whitespace-normal">{roleLabel} 설문 준비 완료</span>
            </Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
              <Save aria-hidden="true" className="size-4" />초안으로 저장
            </Button>
          </div>

          {/* 고급 링크 관리 (접힘) */}
          <div className="mt-4 rounded-(--radius-panel) border border-slate-200 bg-white">
            <button type="button" onClick={() => setShowAdvancedLink((v) => !v)} aria-expanded={showAdvancedLink} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[0.95rem] font-semibold text-slate-600">
              고급 링크 관리
              <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showAdvancedLink ? 'rotate-180' : ''}`} />
            </button>
            {showAdvancedLink && (
              <div className="border-t border-slate-100 px-4 py-4">
                <p className="text-[0.9rem] break-keep text-slate-500">
                  준비를 마치면 <span className="font-medium text-slate-700">역할별 응답관리</span> 화면에서 설문 링크를 만들고 응답 현황을 관리할 수 있습니다. 링크 발급·만료·토큰 관리는 그곳에서 처리합니다.
                </p>
                <Button variant="secondary" className="mt-3" onClick={() => navigate(`/diagnosis/projects/${projectId}/surveys`)}>
                  역할별 응답관리로 이동
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </DiagnosisFlowShell>
  )
}
