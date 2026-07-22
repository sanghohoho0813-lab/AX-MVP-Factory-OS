import {
  ArrowRight,
  ChevronDown,
  FileStack,
  Layers,
  ListChecks,
  Plus,
  Send,
  Settings,
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
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
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
          <p className="text-[0.875rem] text-slate-400">{p.projectCode}</p>
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
        title="기업 진단"
        description="설문으로 고객사의 실제 업무·데이터 상태를 확인하고 AX 도입 가능성을 진단합니다."
        actions={
          <Button variant="primary" onClick={startFirstSetup}>
            설문 구성하기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <HelpNote
        summary="진단은 ① 설문 준비 → ② 응답 현황 → ③ 진단 결과 순서로 진행합니다."
        what="대표자·현장 담당자에게 설문을 보내고, 제출된 응답으로 AX 적합성을 계산합니다."
        when="새 프로젝트의 업무·데이터 상태를 처음 파악할 때 사용합니다."
        next="진단 결과가 확정되면 '만들 업무 선택' 단계로 이어집니다."
      />

      {/* 3단계 흐름 안내 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { n: 1, label: '설문 준비', desc: '보낼 질문을 고르고 테스트 링크를 만듭니다.' },
          { n: 2, label: '응답 현황', desc: '대표자·현장 담당자의 제출을 확인합니다.' },
          { n: 3, label: '진단 결과', desc: '응답을 비교해 AX 적합성을 판단합니다.' },
        ].map((f) => (
          <div key={f.n} className="flex flex-col gap-1 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3 shadow-(--shadow-card)">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-[0.875rem] font-bold text-brand-600">{f.n}</span>
            <span className="text-sm font-semibold text-slate-800">{f.label}</span>
            <span className="text-[0.875rem] break-keep text-slate-500">{f.desc}</span>
          </div>
        ))}
      </div>

      <SummaryStrip
        ariaLabel="진단 요약"
        items={[
          { key: 's', label: '진단이 필요한 프로젝트', value: data.counts.needsSetup, unit: '건', tone: 'warning', icon: FileStack },
          { key: 'q', label: '설문 질문', value: data.counts.activeQuestions, unit: '개', tone: 'info', icon: ListChecks },
          { key: 'm', label: '업종·목적 모듈', value: data.counts.activeModules, unit: '개', tone: 'accent', icon: Layers },
          { key: 't', label: '설문 양식', value: data.counts.publishedTemplates, unit: '개', tone: 'success', icon: Send },
        ]}
      />

      {/* A. 진단이 필요한 프로젝트 */}
      <Panel title="진단이 필요한 프로젝트" flush>
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

      {/* 진단 설정 — 질문·모듈·양식 등 고급 관리 (기본 접힘) */}
      <details className="group rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4">
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Settings aria-hidden="true" className="size-4 text-slate-400" />
              진단 설정
            </span>
            <span className="mt-0.5 block text-[13px] break-keep text-slate-500">
              질문·업종 모듈·설문 양식 등은 자동 점수·분석 규칙을 수정할 때만 사용합니다.
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-2">
            {[
              { to: '/diagnosis/questions', label: '질문 은행 관리', icon: ListChecks, desc: '진단에 쓰는 질문 104개를 관리합니다.' },
              { to: '/diagnosis/modules', label: '업종·목적 모듈', icon: Layers, desc: '업종·목적별 질문 묶음을 관리합니다.' },
              { to: '/diagnosis/templates', label: '설문 양식', icon: FileStack, desc: '역할별 설문 양식을 만들고 게시합니다.' },
              { to: '/diagnosis/questions/new', label: '새 질문 등록', icon: Plus, desc: '새로운 진단 질문을 추가합니다.' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 hover:border-slate-300 hover:bg-slate-50"
              >
                <item.icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="block text-[0.875rem] break-keep text-slate-400">{item.desc}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {[
              ['공통 질문', data.library.common],
              ['업종 특화', data.library.industry],
              ['목적 특화', data.library.objective],
              ['비활성·보관', data.library.inactiveOrArchived],
              ['질문 없는 모듈', data.library.emptyModules],
              ['품질 경고 양식', data.library.warnedTemplates],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-[0.875rem] text-slate-400">{label}</dt>
                <dd className="text-lg font-bold text-slate-800">
                  {value}
                  <span className="ml-0.5 text-[0.875rem] font-medium text-slate-400">개</span>
                </dd>
              </div>
            ))}
          </dl>

          {data.recentTemplates.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-[13px] font-semibold text-slate-500">최근 수정 설문 양식</p>
              <ul className="flex flex-col gap-1.5">
                {data.recentTemplates.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/diagnosis/templates/${t.id}/preview`}
                      className="flex items-center gap-3 rounded-(--radius-control) px-2 py-1.5 hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{t.name}</span>
                      <RespondentRoleBadge role={t.respondentRole} />
                      <TemplateStatusBadge status={t.status} />
                      <span className="text-[0.875rem] text-slate-400">{formatDate(t.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
