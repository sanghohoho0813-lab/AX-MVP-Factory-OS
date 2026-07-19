import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  GitBranch,
  LayoutList,
  PencilRuler,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { mvpLevelLabel } from '../../lib/domainMeta'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  DesignBlockedError,
  ensureDesignDraft,
} from '../../services/mvpDesignService'
import { DesignStatusBadge, GuardrailStatusBadge, QualitySeverityBadge } from '../../components/mvpDesign/badges'
import {
  DesignGateNotice,
  DesignHeader,
  DesignNav,
  DesignProjectNotFound,
  RedesignBanner,
} from './designShared'
import { useDesignData } from './useDesignData'

export function DesignProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useDesignData(projectId)

  if (!context) return <DesignProjectNotFound />
  const { project, organization, eligibility, design } = context

  const doGenerate = () => {
    try {
      ensureDesignDraft(projectId)
      showToast('MVP 설계 초안을 생성했습니다.')
    } catch (error) {
      showToast(error instanceof DesignBlockedError ? error.message : '설계 생성에 실패했습니다.')
    }
  }

  const header = (
    <DesignHeader
      project={project}
      organizationName={organization?.name ?? ''}
      actions={
        design ? (
          <Button variant="primary" onClick={() => navigate(`/mvp-design/projects/${projectId}/features`)}>
            설계 이어가기
          </Button>
        ) : undefined
      }
    />
  )

  if (!eligibility.canDesign) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <DesignGateNotice context={context} />
      </div>
    )
  }

  if (!design) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <DesignNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={PencilRuler}
            title="확정 핵심 과제로 설계를 시작할 수 있습니다"
            description={`핵심 과제: ${eligibility.handoff?.primaryCandidate?.name ?? ''}`}
            action={
              <Button variant="primary" onClick={doGenerate}>
                <Sparkles aria-hidden="true" className="size-4" />
                MVP 설계 생성
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const must = design.features.filter((f) => f.scope === 'must')
  const should = design.features.filter((f) => f.scope === 'should')
  const later = design.features.filter((f) => f.scope === 'later')
  const errors = design.qualityChecks.filter((c) => c.severity === 'error')
  const warnings = design.qualityChecks.filter((c) => c.severity === 'warning')

  return (
    <div className="flex flex-col gap-5">
      {header}
      <DesignNav projectId={projectId} />
      <RedesignBanner show={context.needsRedesignFlag} onRun={() => navigate(`/mvp-design/projects/${projectId}/review`)} />

      <div className="flex flex-wrap items-center gap-2">
        <DesignStatusBadge status={design.status} />
        <span className="text-xs text-slate-400">설계 v{design.version}</span>
        <span className="text-xs text-slate-400">{mvpLevelLabel(design.levelDecision.selectedLevel, project.projectType)}</span>
        {errors.length > 0 && <span className="text-xs font-medium text-danger-600">해결할 오류 {errors.length}건</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="핵심 과제 정의">
            <dl className="flex flex-col gap-3">
              <DefItem label="핵심 과제" value={design.coreTaskName} />
              <DefItem label="문제 정의" value={design.problemStatement} />
              <DefItem label="사용자" value={design.targetUsers} />
              <DefItem label="목표" value={design.goalStatement} />
            </dl>
          </Panel>

          <Panel title="자동 설계 요약">
            <p className="text-[13px] leading-relaxed break-keep text-slate-600">{design.autoSummary}</p>
          </Panel>

          <Panel title="기능 범위 개요">
            <div className="grid grid-cols-3 gap-3">
              <ScopeStat label="Must · 필수" value={must.length} tone="text-success-700" />
              <ScopeStat label="Should · 권장" value={should.length} tone="text-brand-700" />
              <ScopeStat label="Later · 2차" value={later.length} tone="text-warning-700" />
            </div>
            <ul className="mt-4 flex flex-col gap-1.5">
              {must.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                  <BadgeCheck aria-hidden="true" className="size-3.5 shrink-0 text-success-500" />
                  <span className="truncate">{f.name}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="구성 요약">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['필수 기능', must.length],
                ['화면', design.screens.filter((s) => s.scope !== 'excluded').length],
                ['데이터', design.entities.length],
                ['역할', design.roles.length],
                ['업무 규칙', design.businessRules.length],
                ['AI 기능', design.aiFeatures.length],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="범위 가드레일">
            <ul className="flex flex-col gap-2">
              {design.guardrailChecks.filter((g) => g.limit !== null).map((g) => (
                <li key={g.key} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-slate-600">{g.label}</span>
                  <GuardrailStatusBadge status={g.status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="점검 상태">
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">해결할 오류</span>
                <span className={errors.length > 0 ? 'font-semibold text-danger-600' : 'text-slate-400'}>{errors.length}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">경고</span>
                <span className={warnings.length > 0 ? 'font-medium text-warning-600' : 'text-slate-400'}>{warnings.length}건</span>
              </div>
              {errors.slice(0, 2).map((c, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs break-keep text-danger-600">
                  <QualitySeverityBadge severity={c.severity} />
                  <span className="min-w-0">{c.message}</span>
                </p>
              ))}
            </div>
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {[
                { to: `/mvp-design/projects/${projectId}/workflow`, label: '업무 흐름', icon: Workflow },
                { to: `/mvp-design/projects/${projectId}/features`, label: '기능·범위', icon: BadgeCheck },
                { to: `/mvp-design/projects/${projectId}/screens`, label: '화면', icon: LayoutList },
                { to: `/mvp-design/projects/${projectId}/data`, label: '데이터', icon: Boxes },
                { to: `/mvp-design/projects/${projectId}/permissions`, label: '역할·권한', icon: ShieldCheck },
                { to: `/mvp-design/projects/${projectId}/rules`, label: '규칙·AI', icon: GitBranch },
                { to: `/mvp-design/projects/${projectId}/validation`, label: '검증', icon: ClipboardCheck },
                { to: `/mvp-design/projects/${projectId}/review`, label: '설계 확정', icon: PencilRuler },
              ].map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function DefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

function ScopeStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 px-3 py-2.5 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}
