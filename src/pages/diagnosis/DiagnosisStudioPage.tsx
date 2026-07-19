import {
  ArrowRight,
  FileStack,
  Layers,
  ListChecks,
  Plus,
  Send,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Project } from '../../types/domain'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'
import { memberName } from '../../data/members'
import {
  organizationRepository,
  projectRepository,
  questionRepository,
  surveyDistributionRepository,
  surveyModuleRepository,
  surveyTemplateRepository,
} from '../../repositories'
import { calculateTemplateQuality } from '../../services/surveyTemplateService'
import { summarizeProjectSurveys } from '../../services/projectSurveyService'
import {
  countSubmittedResponses,
  getProjectAnalysisLifecycle,
} from '../../services/assessmentService'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import {
  ProjectTypeBadge,
} from '../../components/domain/ProjectTypeBadge'
import {
  RespondentRoleBadge,
  TemplateStatusBadge,
} from '../../components/diagnosis/badges'
import { StatusBadge } from '../../components/ui/StatusBadge'

/** Blueprint + Distribution + 분석을 함께 고려한 프로젝트 설문 라이프사이클 */
type SurveyLifecycle =
  | 'unset'
  | 'draft'
  | 'ready'
  | 'issued'
  | 'in_progress'
  | 'submitted'
  | 'analysis_needed'
  | 'analysis_review'
  | 'finalized'
  | 'needs_reanalysis'

const LIFECYCLE_META: Record<
  SurveyLifecycle,
  { label: string; tone: 'neutral' | 'warning' | 'info' | 'success'; action: string }
> = {
  unset: { label: '설문 미설계', tone: 'neutral', action: '설문 설계' },
  draft: { label: '설문 초안', tone: 'warning', action: '설문 설계' },
  ready: { label: '설문 준비 완료', tone: 'info', action: '테스트 링크 생성' },
  issued: { label: '테스트 링크 발급', tone: 'info', action: '응답 현황' },
  in_progress: { label: '응답 작성 중', tone: 'warning', action: '응답 현황' },
  submitted: { label: '응답 제출 완료', tone: 'success', action: '분석 시작' },
  analysis_needed: { label: '진단 분석 필요', tone: 'warning', action: '분석 시작' },
  analysis_review: { label: '분석 검토 중', tone: 'info', action: '분석 계속' },
  finalized: { label: '진단 확정', tone: 'success', action: '결과 보기' },
  needs_reanalysis: { label: '재분석 필요', tone: 'warning', action: '재분석' },
}

function projectSurveyLifecycle(project: Project): SurveyLifecycle {
  const dists = surveyDistributionRepository.getByProjectId(project.id)
  const hasSubmitted =
    dists.some((d) => d.status === 'submitted') ||
    countSubmittedResponses(project.id) > 0
  if (hasSubmitted) {
    switch (getProjectAnalysisLifecycle(project)) {
      case 'finalized':
        return 'finalized'
      case 'needs_reanalysis':
        return 'needs_reanalysis'
      case 'draft':
      case 'reviewed':
        return 'analysis_review'
      default:
        return 'analysis_needed'
    }
  }
  if (dists.some((d) => d.status === 'in_progress')) return 'in_progress'
  if (dists.some((d) => d.status === 'issued' || d.status === 'opened')) {
    return 'issued'
  }
  const states = summarizeProjectSurveys(project).map((s) => s.state)
  if (states.includes('ready')) return 'ready'
  if (states.includes('draft')) return 'draft'
  return 'unset'
}

const ANALYSIS_LIFECYCLES: SurveyLifecycle[] = [
  'submitted',
  'analysis_needed',
  'analysis_review',
  'finalized',
  'needs_reanalysis',
]

/** 라이프사이클에 따른 이동 경로 */
function lifecycleTarget(project: Project, lifecycle: SurveyLifecycle): string {
  if (lifecycle === 'unset' || lifecycle === 'draft') {
    return `/diagnosis/projects/${project.id}/setup`
  }
  if (ANALYSIS_LIFECYCLES.includes(lifecycle)) {
    return lifecycle === 'finalized'
      ? `/diagnosis/projects/${project.id}/analysis/result`
      : `/diagnosis/projects/${project.id}/analysis`
  }
  return `/diagnosis/projects/${project.id}/surveys`
}

export function DiagnosisStudioPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const data = useMemo(() => {
    const questions = questionRepository.getAll(true)
    const activeQuestions = questions.filter((q) => q.active && q.archivedAt === null)
    const modules = surveyModuleRepository.getAll()
    const templates = surveyTemplateRepository.getAll()
    const projects = projectRepository.getAll()
    const orgById = new Map(
      organizationRepository.getAll(true).map((o) => [o.id, o]),
    )

    // 진단 준비가 필요한 프로젝트
    const needsSetup = projects.filter((p) => {
      if (p.status === 'completed') return false
      const isAxEarly =
        (p.projectType === 'ax' || p.projectType === 'ax_website') &&
        (p.currentStage === 'intake' || p.currentStage === 'diagnosis')
      const isWebsiteEarly =
        p.projectType === 'website' &&
        (p.currentStage === 'intake' || p.currentStage === 'website_design')
      if (!isAxEarly && !isWebsiteEarly) return false
      return !ANALYSIS_LIFECYCLES.includes(projectSurveyLifecycle(p))
    })

    const emptyModules = modules.filter((m) => m.questionIds.length === 0)
    const warnedTemplates = templates.filter(
      (t) => t.archivedAt === null && calculateTemplateQuality(t).verdict !== 'passed',
    )

    return {
      library: {
        active: activeQuestions.length,
        common: activeQuestions.filter((q) => q.scope === 'common').length,
        industry: activeQuestions.filter((q) => q.scope === 'industry').length,
        objective: activeQuestions.filter((q) => q.scope === 'objective').length,
        inactiveOrArchived: questions.filter(
          (q) => !q.active || q.archivedAt !== null,
        ).length,
        emptyModules: emptyModules.length,
        warnedTemplates: warnedTemplates.length,
      },
      counts: {
        activeQuestions: activeQuestions.length,
        activeModules: modules.filter((m) => m.status === 'active').length,
        publishedTemplates: templates.filter((t) => t.status === 'published').length,
        needsSetup: needsSetup.length,
      },
      needsSetup,
      recentTemplates: [...templates]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5),
      orgById,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const startFirstSetup = () => {
    if (data.needsSetup.length > 0) {
      navigate(`/diagnosis/projects/${data.needsSetup[0].id}/setup`)
    } else {
      navigate('/clients')
    }
  }

  const setupColumns: DataTableColumn<Project>[] = [
    {
      key: 'client',
      header: '고객사',
      cell: (p) => (
        <span className="text-[13px] font-medium text-slate-700">
          {data.orgById.get(p.organizationId)?.name ?? '알 수 없음'}
        </span>
      ),
    },
    {
      key: 'name',
      header: '프로젝트',
      className: 'min-w-[160px]',
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
          <p className="text-xs text-slate-400">{p.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (p) => <ProjectTypeBadge type={p.projectType} compact /> },
    {
      key: 'stage',
      header: '현재 단계',
      cell: (p) => (
        <StatusBadge tone={PROJECT_STAGE_META[p.currentStage].tone}>
          {PROJECT_STAGE_META[p.currentStage].label}
        </StatusBadge>
      ),
    },
    {
      key: 'design',
      header: '설문 상태',
      cell: (p) => {
        const lc = projectSurveyLifecycle(p)
        return (
          <StatusBadge tone={LIFECYCLE_META[lc].tone} withDot>
            {LIFECYCLE_META[lc].label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'owner',
      header: '담당자',
      className: 'hidden xl:table-cell',
      cell: (p) => <span className="text-[13px] text-slate-600">{memberName(p.ownerId)}</span>,
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      cell: (p) => {
        const lc = projectSurveyLifecycle(p)
        return (
          <button
            type="button"
            onClick={() => navigate(lifecycleTarget(p, lc))}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
          >
            {LIFECYCLE_META[lc].action}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="진단 스튜디오"
        description="공통 질문과 업종별 질문을 조합해 고객사의 실제 업무와 AX 도입 가능성을 진단합니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/diagnosis/questions/new')}>
              <Plus aria-hidden="true" className="size-4" />
              질문 등록
            </Button>
            <Button variant="primary" onClick={startFirstSetup}>
              프로젝트 설문 설계
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </>
        }
      />
      <DiagnosisStudioNav />

      <SummaryStrip
        ariaLabel="진단 스튜디오 요약"
        items={[
          { key: 'q', label: '활성 질문', value: data.counts.activeQuestions, unit: '개', tone: 'info', icon: ListChecks },
          { key: 'm', label: '활성 모듈', value: data.counts.activeModules, unit: '개', tone: 'accent', icon: Layers },
          { key: 't', label: '게시 템플릿', value: data.counts.publishedTemplates, unit: '개', tone: 'success', icon: Send },
          { key: 's', label: '설문 준비 필요 프로젝트', value: data.counts.needsSetup, unit: '건', tone: 'warning', icon: FileStack },
        ]}
      />

      {/* A. 진단 준비가 필요한 프로젝트 */}
      <Panel title="진단 준비가 필요한 프로젝트" flush>
        {data.needsSetup.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="설문 설계가 필요한 프로젝트가 없습니다"
            description="상담 접수·진단 단계의 프로젝트가 생기면 이곳에 표시됩니다."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable
                columns={setupColumns}
                rows={data.needsSetup}
                rowKey={(p) => p.id}
                rowAriaLabel={(p) => `${p.name} 설문 설계`}
                onRowClick={(p) => navigate(`/diagnosis/projects/${p.id}/setup`)}
              />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {data.needsSetup.map((p) => {
                const lc = projectSurveyLifecycle(p)
                return (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                        {data.orgById.get(p.organizationId)?.name} · {p.name}
                      </p>
                      <StatusBadge tone={LIFECYCLE_META[lc].tone} withDot>
                        {LIFECYCLE_META[lc].label}
                      </StatusBadge>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <ProjectTypeBadge type={p.projectType} compact />
                      <button
                        type="button"
                        onClick={() => navigate(lifecycleTarget(p, lc))}
                        className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand-600"
                      >
                        {LIFECYCLE_META[lc].action}
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* C. 최근 수정 템플릿 */}
        <div className="min-w-0 xl:col-span-2">
          <Panel title="최근 수정 템플릿" flush>
            <ul className="divide-y divide-slate-100">
              {data.recentTemplates.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/diagnosis/templates/${t.id}/preview`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">
                        문항 {t.sections.reduce((n, s) => n + s.placements.length, 0)}개 · 약{' '}
                        {t.estimatedMinutes}분 · {formatDate(t.updatedAt)}
                      </p>
                    </div>
                    <RespondentRoleBadge role={t.respondentRole} />
                    <div className="flex items-center gap-1.5">
                      <TemplateStatusBadge status={t.status} />
                      <span className="text-xs text-slate-400">v{t.version}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* B + D. 라이브러리 현황 & 빠른 이동 */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="설문 라이브러리 현황">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ['공통 질문', data.library.common],
                ['업종 특화', data.library.industry],
                ['목적 특화', data.library.objective],
                ['비활성·보관', data.library.inactiveOrArchived],
                ['질문 없는 모듈', data.library.emptyModules],
                ['품질 경고 템플릿', data.library.warnedTemplates],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">
                    {value}
                    <span className="ml-0.5 text-xs font-medium text-slate-400">개</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {[
                { to: '/diagnosis/questions', label: '질문은행', icon: ListChecks },
                { to: '/diagnosis/modules', label: '업종·목적 모듈', icon: Layers },
                { to: '/diagnosis/templates', label: '설문 템플릿', icon: FileStack },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
