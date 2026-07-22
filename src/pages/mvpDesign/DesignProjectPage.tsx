import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, ChevronDown, PencilRuler, Sparkles } from 'lucide-react'
import { mvpLevelLabel } from '../../lib/domainMeta'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  DesignBlockedError,
  ensureDesignDraft,
} from '../../services/mvpDesignService'
import { GuardrailStatusBadge, QualitySeverityBadge } from '../../components/mvpDesign/badges'
import {
  WorkspaceShell,
  WorkspaceNextAction,
  WorkspaceSummaryLine,
  WorkspaceCompletionChecklist,
  WorkspaceWarningPanel,
  WorkspaceNextStep,
  type WorkspaceWarning,
} from '../../components/workspace/WorkspaceShell'
import {
  DESIGN_MODULE_DESC,
  DESIGN_MODULE_NAME,
  DesignGateNotice,
  DesignHeader,
  DesignNav,
  DesignProjectNotFound,
  RedesignBanner,
  designSteps,
} from './designShared'
import { useDesignData } from './useDesignData'
import { ScreenGuide } from '../../components/onboarding/ScreenGuide'

/** 영어 범위 용어를 쉬운 표현으로 (전문가 정보에서만 원어 보존) */
const SCOPE_LABEL: Record<string, string> = {
  must: '이번에 꼭 만듦',
  should: '가능하면 포함',
  later: '다음 버전',
  excluded: '이번 범위 제외',
}

export function DesignProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useDesignData(projectId)
  const [showExpert, setShowExpert] = useState(false)

  if (!context) return <DesignProjectNotFound />
  const { project, eligibility, design } = context
  const base = `/mvp-design/projects/${projectId}`

  const doGenerate = () => {
    try {
      ensureDesignDraft(projectId)
      showToast('MVP 설계 초안을 생성했습니다.')
    } catch (error) {
      showToast(error instanceof DesignBlockedError ? error.message : '설계 생성에 실패했습니다.')
    }
  }

  // 진입 차단 (선정 미확정·홈페이지 단독)
  if (!eligibility.canDesign) {
    return (
      <div className="flex flex-col gap-5">
        <DesignHeader />
        <DesignGateNotice context={context} />
      </div>
    )
  }

  // 설계 초안 없음
  if (!design) {
    return (
      <WorkspaceShell moduleName={DESIGN_MODULE_NAME} moduleDescription={DESIGN_MODULE_DESC} steps={designSteps(projectId)} currentKey="overview">
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={PencilRuler}
            title="확정한 핵심 업무로 설계를 시작할 수 있습니다"
            description={`핵심 업무: ${eligibility.handoff?.primaryCandidate?.name ?? ''}`}
            action={
              <Button variant="primary" onClick={doGenerate}>
                <Sparkles aria-hidden="true" className="size-4" />
                MVP 설계 생성
              </Button>
            }
          />
        </div>
      </WorkspaceShell>
    )
  }

  const must = design.features.filter((f) => f.scope === 'must')
  const should = design.features.filter((f) => f.scope === 'should')
  const later = design.features.filter((f) => f.scope === 'later')
  const activeScreens = design.screens.filter((s) => s.scope !== 'excluded')
  const errors = design.qualityChecks.filter((c) => c.severity === 'error')
  const warnings = design.qualityChecks.filter((c) => c.severity === 'warning')
  const finalized = design.status === 'finalized'

  // 지금 해야 할 일 (한 화면에 핵심 행동 하나)
  const next = (() => {
    if (errors.length > 0) return { title: '설계 오류를 먼저 확인하세요', why: `해결할 오류 ${errors.length}건이 있어 설계를 확정할 수 없습니다.`, label: '설계 오류 확인하기', path: `${base}/review` }
    if (must.length === 0) return { title: '이번에 만들 기능을 정하세요', why: '1차 MVP에서 꼭 만들 기능을 1개 이상 정해야 다음으로 진행할 수 있습니다.', label: '이번에 만들 기능 정하기', path: `${base}/features` }
    if (activeScreens.length === 0) return { title: '필요한 화면을 구성하세요', why: '정한 기능을 실제로 사용할 화면을 구성하세요.', label: '필요한 화면 구성하기', path: `${base}/screens` }
    if (!finalized) return { title: 'MVP 설계안을 확정하세요', why: '구성이 준비되었습니다. 확정하면 실제 사용 테스트로 넘어갈 수 있습니다.', label: 'MVP 설계안 확정하기', path: `${base}/review`, tone: 'success' as const }
    return { title: '실제 사용 테스트를 시작하세요', why: '설계가 확정되었습니다. 실제 사용자가 시험할 준비를 하세요.', label: '실제 사용 테스트 시작하기', path: `/validation/projects/${projectId}`, tone: 'success' as const }
  })()

  const checklist = [
    { ok: true, label: `핵심 업무 확정: ${design.coreTaskName}` },
    { ok: must.length > 0, label: '이번에 꼭 만들 기능 1개 이상', actionPath: `${base}/features`, actionLabel: '기능 정하기' },
    { ok: later.length > 0 || should.length > 0, label: '다음 버전 기능이 구분됨', actionPath: `${base}/features` },
    { ok: activeScreens.length > 0, label: '주요 화면이 구성됨', actionPath: `${base}/screens`, actionLabel: '화면 구성하기' },
    { ok: errors.length === 0, label: '범위 초과·설계 오류 없음', actionPath: `${base}/review`, actionLabel: '오류 확인하기' },
    { ok: finalized, label: 'MVP 설계안 확정', actionPath: `${base}/review`, actionLabel: '확정하기' },
  ]

  const warns: WorkspaceWarning[] = [
    ...errors.slice(0, 3).map((c) => ({ tone: 'error' as const, message: c.message, actionPath: `${base}/review`, actionLabel: '설계 확정 화면으로' })),
    ...warnings.slice(0, 2).map((c) => ({ tone: 'warn' as const, message: c.message })),
  ]

  const summary = (
    <>
      <div>
        <WorkspaceSummaryLine label="핵심 업무" value={design.coreTaskName} />
        <WorkspaceSummaryLine label="MVP 수준" value={mvpLevelLabel(design.levelDecision.selectedLevel, project.projectType)} />
        <WorkspaceSummaryLine label="이번에 꼭 만들 기능" value={`${must.length}개`} />
        <WorkspaceSummaryLine label="주요 화면" value={`${activeScreens.length}개`} />
        <WorkspaceSummaryLine label="설계 상태" value={finalized ? '확정됨' : '작성 중'} tone={finalized ? 'ok' : 'default'} />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
      {finalized && <WorkspaceNextStep label="실제 사용 테스트 준비하기" path={`/validation/projects/${projectId}`} />}
    </>
  )

  return (
    <WorkspaceShell
      moduleName={DESIGN_MODULE_NAME}
      moduleDescription={DESIGN_MODULE_DESC}
      saveStatus="local"
      steps={designSteps(projectId)}
      currentKey="overview"
      nextAction={<WorkspaceNextAction title={next.title} why={next.why} actionLabel={next.label} actionPath={next.path} tone={next.tone} />}
      summary={summary}
    >
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <ScreenGuide screenKey="ax_design" />
        </div>
        <RedesignBanner show={context.needsRedesignFlag} onRun={() => navigate(`${base}/review`)} />

        {/* 확정한 핵심 업무 */}
        <Panel title="이번에 만들 핵심 업무">
          <dl className="flex flex-col gap-3">
            <DefItem label="핵심 업무" value={design.coreTaskName} />
            <DefItem label="해결할 문제" value={design.problemStatement} />
            <DefItem label="목표 사용자" value={design.targetUsers} />
            <DefItem label="이번 MVP 목표" value={design.goalStatement} />
          </dl>
          <p className="mt-3 rounded-(--radius-control) border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-[0.95rem] leading-relaxed break-keep text-slate-600">{design.autoSummary}</p>
        </Panel>

        {/* 기능 범위 (쉬운 표현) */}
        <Panel title="이번에 만들 기능">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ScopeStat label={SCOPE_LABEL.must} value={must.length} tone="text-success-700" />
            <ScopeStat label={SCOPE_LABEL.should} value={should.length} tone="text-brand-700" />
            <ScopeStat label={SCOPE_LABEL.later} value={later.length} tone="text-warning-700" />
          </div>
          {must.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5">
              {must.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-[0.98rem] text-slate-700">
                  <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-500" />
                  <span className="min-w-0 break-keep">{f.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 주요 화면 */}
        {activeScreens.length > 0 && (
          <Panel title="주요 화면">
            <ul className="flex flex-col gap-2">
              {activeScreens.slice(0, 6).map((s) => (
                <li key={s.id} className="rounded-(--radius-control) border border-slate-100 px-3.5 py-2.5">
                  <p className="text-[0.98rem] font-medium break-keep text-slate-800">{s.name}</p>
                  {s.purpose && <p className="mt-0.5 text-[0.9rem] break-keep text-slate-500">{s.purpose}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button type="button" onClick={() => setShowExpert((v) => !v)} aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700">
            전문가·시스템 정보 (버전·가드레일·점검·상세 구조)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2 text-[0.85rem] text-slate-400">
                <span>설계 v{design.version}</span>
                <span>Must {must.length} · Should {should.length} · Later {later.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel title="구성 요약">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      ['필수 기능', must.length],
                      ['화면', activeScreens.length],
                      ['데이터', design.entities.length],
                      ['역할', design.roles.length],
                      ['업무 규칙', design.businessRules.length],
                      ['AI 기능', design.aiFeatures.length],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="text-[0.82rem] text-slate-400">{label}</dt>
                        <dd className="text-[1.1rem] font-bold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel title="범위 가드레일">
                  <ul className="flex flex-col gap-2">
                    {design.guardrailChecks.filter((g) => g.limit !== null).map((g) => (
                      <li key={g.key} className="flex items-center justify-between gap-2 text-[0.9rem]">
                        <span className="min-w-0 truncate text-slate-600">{g.label}</span>
                        <GuardrailStatusBadge status={g.status} />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
              {errors.length + warnings.length > 0 && (
                <Panel title="점검 상세">
                  <ul className="flex flex-col gap-1.5">
                    {[...errors, ...warnings].slice(0, 6).map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[0.88rem] break-keep text-slate-600">
                        <QualitySeverityBadge severity={c.severity} />
                        <span className="min-w-0">{c.message}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              <DesignNav projectId={projectId} />
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}

function DefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.85rem] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[0.98rem] break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

function ScopeStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 px-3 py-3 text-center">
      <p className={`text-[1.6rem] font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[0.9rem] break-keep text-slate-500">{label}</p>
    </div>
  )
}
