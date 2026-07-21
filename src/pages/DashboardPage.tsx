import {
  ArrowRight,
  Check,
  ChevronRight,
  PlayCircle,
  Plus,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PRIORITY_TASKS, TIMELINE_ITEMS, TIMELINE_TRACKS } from '../data/demo'
import { useStoreVersion } from '../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../repositories'
import {
  buildDashboardMetrics,
  buildPortfolioItems,
} from '../services/dashboardService'
import { countSelectionPending } from '../services/selectionService'
import { countDesignInProgress } from '../services/mvpDesignService'
import { countWebsitePending } from '../services/websiteDesignService'
import { countValidationPending } from '../services/validationService'
import { countDeliverablePending } from '../services/deliverableService'
import { countFundingPending } from '../services/fundingService'
import {
  FLOW_STEPS,
  computeProjectJourney,
  flowStepIndex,
  getMostRecentProject,
  getTopNextActions,
  type ProjectJourney,
} from '../services/journeyService'
import {
  getGuidedDemoStatus,
  resetGuidedDemo,
} from '../services/guidedDemo/guidedDemoService'
import { useDemoTour } from '../components/demo/demoTour'
import { MetricStrip } from '../components/dashboard/MetricStrip'
import { PortfolioHealth } from '../components/dashboard/PortfolioHealth'
import { PriorityList } from '../components/dashboard/PriorityList'
import { WeeklyTimeline } from '../components/dashboard/WeeklyTimeline'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { useToast } from '../components/ui/toastContext'

export function DashboardPage() {
  const navigate = useNavigate()
  const demo = useDemoTour()
  const { showToast } = useToast()
  const [startOpen, setStartOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const version = useStoreVersion()

  const { metrics, portfolioItems, nextActions, recent, demoExists } = useMemo(() => {
    const projects = projectRepository.getAll()
    const organizations = organizationRepository.getAll()
    const recentProject = getMostRecentProject()
    return {
      metrics: buildDashboardMetrics(projects, countSelectionPending(), countDesignInProgress(), countWebsitePending(), countValidationPending(), countDeliverablePending(), countFundingPending()),
      portfolioItems: buildPortfolioItems(organizations, projects),
      nextActions: getTopNextActions(3),
      recent: recentProject ? computeProjectJourney(recentProject) : null,
      demoExists: getGuidedDemoStatus().hasResponses,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const doReset = () => {
    resetGuidedDemo()
    setResetOpen(false)
    showToast('샘플 데이터를 초기화했습니다. 일반 프로젝트는 그대로 유지됩니다.')
  }

  const startDemo = () => {
    setStartOpen(false)
    demo.start()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="AX MVP 운영 시스템"
        description="지금 해야 할 일을 안내하는 업무 운영 시스템입니다. 진단부터 설계까지 순서대로 진행하세요."
      />

      {/* A. 시작 안내 */}
      <section aria-labelledby="home-start" className="flex flex-col gap-3">
        <h2 id="home-start" className="text-lg font-semibold text-slate-900">
          어떤 작업을 시작할까요?
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StartCard
            icon={Plus}
            title="새 고객 프로젝트 시작"
            desc="고객사를 등록하거나 기존 고객사를 선택해 프로젝트를 시작합니다."
            actionLabel="시작하기"
            onClick={() => setStartOpen(true)}
            highlight
          />
          <StartCard
            icon={PlayCircle}
            title="진행 중인 프로젝트 계속"
            desc={
              recent
                ? `${recent.orgName} · ${recent.project.name}의 다음 단계로 이동합니다.`
                : '가장 최근에 작업한 프로젝트의 다음 단계로 이동합니다.'
            }
            actionLabel={recent ? recent.actionLabel : '프로젝트 없음'}
            onClick={recent ? () => navigate(recent.actionPath) : undefined}
            disabled={!recent}
          />
          <StartCard
            icon={Sparkles}
            title="샘플 프로젝트로 체험"
            desc="대한정밀 샘플로 진단부터 기능·화면 설계까지 전체 흐름을 확인합니다."
            actionLabel="샘플 체험 시작"
            onClick={() => demo.start()}
          />
        </div>
        {demoExists && (
          <div>
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="text-[13px] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              샘플 데이터 초기화
            </button>
          </div>
        )}
      </section>

      {/* B. 지금 해야 할 일 */}
      <section aria-labelledby="home-todo" className="flex flex-col gap-3">
        <h2 id="home-todo" className="text-lg font-semibold text-slate-900">
          지금 해야 할 일
        </h2>
        {nextActions.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 shadow-(--shadow-card)">
            <p className="text-sm break-keep text-slate-500">
              진행 중인 작업이 없습니다. 새 프로젝트를 시작하거나 샘플로 전체 흐름을 확인해 보세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setStartOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                새 고객 프로젝트 시작
              </Button>
              <Button variant="secondary" onClick={() => demo.start()}>
                <Sparkles aria-hidden="true" className="size-4" />
                샘플 프로젝트로 체험
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {nextActions.map((task) => (
              <TodoCard key={task.project.id} task={task} onGo={() => navigate(task.actionPath)} />
            ))}
          </ul>
        )}
      </section>

      {/* C. 전체 진행 흐름 */}
      <section aria-labelledby="home-flow" className="flex flex-col gap-3">
        <h2 id="home-flow" className="text-lg font-semibold text-slate-900">
          전체 진행 흐름
        </h2>
        <FlowStrip />
      </section>

      {/* 운영 현황 (보조 정보) */}
      <section aria-labelledby="home-status" className="flex flex-col gap-4">
        <h2 id="home-status" className="text-lg font-semibold text-slate-900">
          운영 현황
        </h2>
        <MetricStrip metrics={metrics} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <WeeklyTimeline tracks={TIMELINE_TRACKS} items={TIMELINE_ITEMS} />
          </div>
          <div className="min-w-0">
            <PriorityList tasks={PRIORITY_TASKS} />
          </div>
        </div>
        <PortfolioHealth projects={portfolioItems} />
      </section>

      {/* 시작 선택 모달 — 실제 화면으로 이동 */}
      <Modal open={startOpen} title="새 고객 프로젝트 시작" onClose={() => setStartOpen(false)}>
        <p className="mb-4 text-sm break-keep text-slate-500">
          어떻게 시작할지 선택하세요. 각 선택은 실제 화면으로 이동합니다.
        </p>
        <div className="flex flex-col gap-2.5">
          <ChoiceButton
            title="기존 고객사로 프로젝트 만들기"
            desc="이미 등록된 고객사에 새 프로젝트를 추가합니다."
            onClick={() => {
              setStartOpen(false)
              navigate('/projects/new')
            }}
          />
          <ChoiceButton
            title="새 고객사부터 등록하기"
            desc="고객사를 먼저 등록한 뒤 프로젝트를 만듭니다."
            onClick={() => {
              setStartOpen(false)
              navigate('/clients/new')
            }}
          />
          <ChoiceButton
            title="샘플 프로젝트로 체험하기"
            desc="대한정밀 샘플로 전체 흐름을 먼저 둘러봅니다."
            onClick={startDemo}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={resetOpen}
        title="샘플 데이터 초기화"
        message="대한정밀 샘플의 진단·선정·설계 데이터를 삭제합니다. 직접 등록한 고객사·프로젝트는 그대로 유지됩니다."
        confirmLabel="초기화"
        onConfirm={doReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  )
}

function StartCard({
  icon: Icon,
  title,
  desc,
  actionLabel,
  onClick,
  highlight,
  disabled,
}: {
  icon: typeof Plus
  title: string
  desc: string
  actionLabel: string
  onClick?: () => void
  highlight?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[152px] flex-col items-start gap-2 rounded-(--radius-panel) border p-5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        highlight
          ? 'border-brand-200 bg-brand-50/50 hover:border-brand-300 hover:bg-brand-50'
          : 'border-slate-200 bg-white shadow-(--shadow-card) hover:border-slate-300'
      }`}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-(--radius-control) ${
          highlight ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="text-base font-semibold text-slate-900">{title}</span>
      <span className="text-[13px] break-keep text-slate-500">{desc}</span>
      <span className={`mt-auto inline-flex items-center gap-1 text-[13px] font-semibold ${disabled ? 'text-slate-400' : 'text-brand-600'}`}>
        {actionLabel}
        {!disabled && <ArrowRight aria-hidden="true" className="size-3.5" />}
      </span>
    </button>
  )
}

function TodoCard({ task, onGo }: { task: ProjectJourney; onGo: () => void }) {
  const stepMeta = FLOW_STEPS[flowStepIndex(task.currentStepKey)]
  return (
    <li className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {stepMeta.label}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {task.orgName} · {task.project.name}
        </p>
        <p className="mt-1 text-[13px] break-keep text-slate-600">{task.actionText}</p>
        <p className="mt-0.5 text-xs break-keep text-slate-400">{task.reason}</p>
      </div>
      <Button variant="primary" size="sm" onClick={onGo} className="mt-auto w-fit">
        {task.actionLabel}
        <ArrowRight aria-hidden="true" className="size-3.5" />
      </Button>
    </li>
  )
}

function FlowStrip() {
  const steps = FLOW_STEPS.filter((s) => s.key !== 'done')
  return (
    <ol className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
      {steps.map((step, i) => (
        <li
          key={step.key}
          className="flex min-w-[150px] flex-col gap-1.5 rounded-(--radius-card) border border-slate-200 bg-white px-3.5 py-3 shadow-(--shadow-card) sm:min-w-0"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-600">
            {i + 1}
          </span>
          <span className="text-sm font-semibold text-slate-800">{step.label}</span>
          <span className="text-xs break-keep text-slate-500">{step.desc}</span>
        </li>
      ))}
    </ol>
  )
}

function ChoiceButton({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Check aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="block text-xs break-keep text-slate-500">{desc}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
    </button>
  )
}
