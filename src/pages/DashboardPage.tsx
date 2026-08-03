import { ArrowRight, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStoreVersion } from '../lib/useStoreVersion'
import { organizationRepository, projectRepository } from '../repositories'
import { buildDashboardMetrics, buildPortfolioItems } from '../services/dashboardService'
import { buildConsultingOpsBrief } from '../services/consultingOpsService'
import { countSelectionPending } from '../services/selectionService'
import { countDesignInProgress } from '../services/mvpDesignService'
import { countWebsitePending } from '../services/websiteDesignService'
import { countValidationPending } from '../services/validationService'
import { countDeliverablePending } from '../services/deliverableService'
import { countFundingPending } from '../services/fundingService'
import {
  computeProjectJourney,
  flowStepIndex,
  getMostRecentProject,
  type ProjectJourney,
} from '../services/journeyService'
import { getGuidedDemoStatus, resetGuidedDemo } from '../services/guidedDemo/guidedDemoService'
import { useDemoTour } from '../components/demo/demoTour'
import { MetricStrip } from '../components/dashboard/MetricStrip'
import { PortfolioHealth } from '../components/dashboard/PortfolioHealth'
import { ConsultingOpsBoard } from '../components/dashboard/ConsultingOpsBoard'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/toastContext'
import { NextActionHero } from '../components/workspace/NextActionHero'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { StatusPill, toFriendlyStatus } from '../components/workspace/StatusPill'
import { useActiveProject } from '../context/activeProject'

export function DashboardPage() {
  const navigate = useNavigate()
  const demo = useDemoTour()
  const { showToast } = useToast()
  const { setActiveProject } = useActiveProject()
  const [startOpen, setStartOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [showOps, setShowOps] = useState(false)
  const version = useStoreVersion()

  const { hero, continueList, attention, metrics, portfolioItems, opsBrief, demoExists } = useMemo(() => {
    void version
    const allProjects = projectRepository.getAll()
    const projects = allProjects.filter((p) => p.status === 'active')
    const organizations = organizationRepository.getAll()
    const journeys = projects
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(computeProjectJourney)
    const heroJourney =
      journeys
        .filter((j) => j.needsAction)
        .sort((a, b) => flowStepIndex(a.currentStepKey) - flowStepIndex(b.currentStepKey))[0] ?? null
    const continueProjects = journeys.filter((j) => j.project.id !== heroJourney?.project.id).slice(0, 3)
    const attentionItems = journeys
      .filter((j) => j.project.healthStatus === 'risk' || j.project.healthStatus === 'attention')
      .slice(0, 5)
    return {
      hero: heroJourney,
      continueList: continueProjects,
      attention: attentionItems,
      metrics: buildDashboardMetrics(
        projects,
        countSelectionPending(),
        countDesignInProgress(),
        countWebsitePending(),
        countValidationPending(),
        countDeliverablePending(),
        countFundingPending(),
      ),
      portfolioItems: buildPortfolioItems(organizations, projects),
      opsBrief: buildConsultingOpsBrief(allProjects, organizations),
      demoExists: getGuidedDemoStatus().hasResponses,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const openProject = (j: ProjectJourney) => {
    setActiveProject(j.project.id)
    navigate(j.actionPath)
  }

  const recent = getMostRecentProject()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <ScreenGuide screenKey="home" />
      </div>
      {/* A. 오늘 가장 먼저 할 일 */}
      <div data-tour="home-next-actions">
      {hero ? (
        <NextActionHero
          eyebrow={`${hero.orgName} · ${hero.project.name}${hero.progress.isSample ? ' · 샘플' : ''}`}
          actionText={hero.actionText}
          reason={hero.reason}
          actionLabel={hero.actionLabel}
          onAction={() => openProject(hero)}
          secondary={
            <button
              type="button"
              onClick={() => { setActiveProject(hero.project.id); navigate(`/projects/${hero.project.id}`) }}
              className="text-[0.95rem] font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              프로젝트 열기
            </button>
          }
        />
      ) : (
        <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-8">
          <h2 className="text-[1.4rem] font-bold break-keep text-slate-900">시작할 준비가 되었습니다</h2>
          <p className="mt-2 max-w-2xl text-[1.05rem] break-keep text-slate-600">
            고객 프로젝트를 진단하고, 먼저 만들 업무를 정하고, 설계·검증까지 이어가는 업무 운영 시스템입니다. 새 프로젝트를 시작하거나 샘플로 전체 흐름을 확인해 보세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button variant="primary" onClick={() => setStartOpen(true)}>
              <Plus aria-hidden="true" className="size-5" /> 새 고객 프로젝트 시작
            </Button>
            <Button variant="secondary" onClick={() => demo.start()}>
              <Sparkles aria-hidden="true" className="size-5" /> 샘플 프로젝트로 체험
            </Button>
          </div>
        </section>
      )}
      </div>

      <ConsultingOpsBoard brief={opsBrief} />

      {/* B. 이어서 할 프로젝트 */}
      {continueList.length > 0 && (
        <section aria-labelledby="home-continue" data-tour="home-projects" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="home-continue" className="text-[1.25rem] font-bold text-slate-900">이어서 할 프로젝트</h2>
            <button type="button" onClick={() => navigate('/clients')} className="text-[0.95rem] font-medium text-brand-700 hover:underline">
              전체 보기
            </button>
          </div>
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {continueList.map((j) => (
              <li key={j.project.id}>
                <button
                  type="button"
                  onClick={() => openProject(j)}
                  className="flex h-full w-full flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[0.95rem] text-slate-500">
                        <span className="truncate">{j.orgName}</span>
                        {j.progress.isSample && (
                          <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.78rem] font-semibold text-brand-700">샘플</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[1.15rem] leading-tight font-bold break-keep text-slate-900">{j.project.name}</p>
                    </div>
                    <StatusPill status={toFriendlyStatus(j.project.status)} size="sm" />
                  </div>
                  <p className="text-[0.9rem] text-slate-500">
                    <span className="font-semibold text-slate-700">{j.progress.stepText}</span> · 현재 {j.progress.currentStep.label}
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${j.progress.percent}%` }} />
                  </div>
                  <p className="mt-auto flex items-center gap-1.5 text-[1rem] font-semibold text-brand-700">
                    {j.actionLabel}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* C. 확인이 필요한 항목 */}
      {attention.length > 0 && (
        <section aria-labelledby="home-attention" className="flex flex-col gap-3">
          <h2 id="home-attention" className="text-[1.25rem] font-bold text-slate-900">확인이 필요한 항목</h2>
          <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white">
            {attention.map((j) => (
              <li key={j.project.id}>
                <button
                  type="button"
                  onClick={() => openProject(j)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-[1.05rem] font-semibold break-keep text-slate-800">{j.orgName} · {j.project.name}</p>
                    <p className="mt-0.5 text-[0.95rem] break-keep text-slate-500">{j.project.riskSummary || j.actionText}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={j.project.healthStatus === 'risk' ? 'blocked' : 'attention'} label={j.project.healthStatus === 'risk' ? '중대한 이슈' : '보완 필요'} size="sm" />
                    <ChevronRight aria-hidden="true" className="size-5 text-slate-300" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 운영 현황 (보조 — 접힘) */}
      <section aria-labelledby="home-ops" className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowOps((v) => !v)}
          aria-expanded={showOps}
          className="flex w-fit items-center gap-1.5 text-[1rem] font-semibold text-slate-500 hover:text-slate-800"
        >
          <ChevronRight aria-hidden="true" className={`size-5 transition-transform ${showOps ? 'rotate-90' : ''}`} />
          운영 현황 자세히 보기
        </button>
        {showOps && (
          <div id="home-ops" className="flex flex-col gap-5">
            <MetricStrip metrics={metrics} />
            <PortfolioHealth projects={portfolioItems} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => demo.start()}>
                <Sparkles aria-hidden="true" className="size-4" /> 샘플 데이터 완성·전체 흐름 체험
              </Button>
              {demoExists && (
                <button type="button" onClick={() => setResetOpen(true)} className="text-[0.9rem] font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline">
                  샘플 데이터 초기화
                </button>
              )}
            </div>
            <p className="text-[0.9rem] break-keep text-slate-400">
              샘플 프로젝트는 모든 단계의 결과가 준비되어 있어 전체 기능을 둘러볼 수 있습니다. 실제 진단·선정 엔진을 호출해 채우며, 여러 번 눌러도 중복되지 않고 직접 등록한 데이터는 보존됩니다.
            </p>
          </div>
        )}
      </section>

      <Modal open={startOpen} title="새 고객 프로젝트 시작" onClose={() => setStartOpen(false)}>
        <p className="mb-4 text-[1rem] break-keep text-slate-500">어떻게 시작할지 선택하세요. 각 선택은 실제 화면으로 이동합니다.</p>
        <div className="flex flex-col gap-2.5">
          <ChoiceButton title="기존 고객사로 프로젝트 만들기" desc="이미 등록된 고객사에 새 프로젝트를 추가합니다." onClick={() => { setStartOpen(false); navigate('/projects/new') }} />
          <ChoiceButton title="새 고객사부터 등록하기" desc="고객사를 먼저 등록한 뒤 프로젝트를 만듭니다." onClick={() => { setStartOpen(false); navigate('/clients/new') }} />
          <ChoiceButton title="샘플 프로젝트로 체험하기" desc="대한정밀 샘플로 전체 흐름을 먼저 둘러봅니다." onClick={() => { setStartOpen(false); demo.start() }} />
        </div>
      </Modal>

      <ConfirmModal
        open={resetOpen}
        title="샘플 데이터 초기화"
        message="대한정밀 샘플의 진단·선정·설계 데이터를 삭제합니다. 직접 등록한 고객사·프로젝트는 그대로 유지됩니다."
        confirmLabel="초기화"
        onConfirm={() => { resetGuidedDemo(); setResetOpen(false); showToast('샘플 데이터를 초기화했습니다. 일반 프로젝트는 그대로 유지됩니다.') }}
        onCancel={() => setResetOpen(false)}
      />

      {/* recent 은 시작 흐름 계산에만 사용 (미표시) */}
      <span className="hidden">{recent?.id}</span>
    </div>
  )
}

function ChoiceButton({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-brand-50/40">
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-semibold text-slate-800">{title}</span>
        <span className="block text-[0.9rem] break-keep text-slate-500">{desc}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-300" />
    </button>
  )
}
