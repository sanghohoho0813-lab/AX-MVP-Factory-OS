import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  LayoutList,
  Network,
  Palette,
  Rocket,
  Sparkles,
  Target,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignBlockedError,
  ensureWebsiteDraft,
} from '../../services/websiteDesignService'
import { buildWebsiteAutoSummary } from '../../services/websiteStudio/summaryBuilder'
import { WebsiteStatusBadge, WebsiteTypeBadge, QualitySeverityBadge } from '../../components/websiteStudio/badges'
import {
  ReadinessNotice,
  RedesignBanner,
  WebsiteGateNotice,
  WebsiteHeader,
  WebsiteNav,
  WebsiteProjectNotFound,
} from './websiteShared'
import { useWebsiteData } from './useWebsiteData'

const STEPS = ['목표·고객', '사이트 구조', '페이지·섹션', '콘텐츠·자료', '디자인 방향', '개발 지시문', '설계 확정']

export function WebsiteProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useWebsiteData(projectId)

  if (!context) return <WebsiteProjectNotFound />
  const { project, organization, eligibility, design } = context

  const doGenerate = () => {
    try {
      ensureWebsiteDraft(projectId)
      showToast('홈페이지 설계 초안을 생성했습니다.')
    } catch (error) {
      showToast(error instanceof WebsiteDesignBlockedError ? error.message : '설계 생성에 실패했습니다.')
    }
  }

  const header = (
    <WebsiteHeader
      project={project}
      organizationName={organization?.name ?? ''}
      actions={design ? (
        <Button variant="primary" onClick={() => navigate(`/website-studio/projects/${projectId}/strategy`)}>설계 이어가기</Button>
      ) : undefined}
    />
  )

  if (!eligibility.canDesign) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <WebsiteGateNotice context={context} />
      </div>
    )
  }

  if (!design) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <WebsiteNav projectId={projectId} />
        <ReadinessNotice show={!eligibility.hasReadiness} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Palette}
            title="홈페이지 진단 결과로 설계를 시작할 수 있습니다"
            description={eligibility.hasReadiness ? `홈페이지 준비도 ${eligibility.readiness?.overallScore}점을 반영합니다.` : '준비도 미확정 상태로 기본 초안을 생성합니다.'}
            action={
              <Button variant="primary" onClick={doGenerate}>
                <Sparkles aria-hidden="true" className="size-4" />
                홈페이지 설계 생성
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const activePages = design.pages.filter((p) => p.status === 'required' || p.status === 'recommended')
  const requiredSections = design.pages.flatMap((p) => p.sections).filter((s) => s.scope === 'required').length
  const contentTotal = design.contentItems.length || 1
  const contentReady = design.contentItems.filter((c) => c.status === 'ready' || c.status === 'draft').length
  const missingContent = design.contentItems.filter((c) => c.required && c.status === 'missing').length
  const missingAssets = design.assetRequirements.filter((a) => a.required && a.status === 'missing').length
  const errors = design.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)
  const warnings = design.qualityChecks.filter((c) => c.severity === 'warning' && !c.passed)

  const nextAction = design.generatedPrompts.some((p) => p.type === 'claude_code')
    ? { label: '설계 확정하기', path: `/website-studio/projects/${projectId}/review` }
    : { label: '개발 지시문 만들기', path: `/website-studio/projects/${projectId}/prompt` }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <WebsiteNav projectId={projectId} />
      <RedesignBanner show={context.needsRedesignFlag} onRun={() => navigate(`/website-studio/projects/${projectId}/review`)} />
      <ReadinessNotice show={!eligibility.hasReadiness} />

      {/* 지금 해야 할 일 */}
      <section aria-label="지금 해야 할 일" className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
        <p className="mt-1.5 text-base font-semibold break-keep text-slate-900">
          {nextAction.label === '설계 확정하기' ? '설계를 검토하고 확정하세요.' : '개발 지시문을 생성하세요.'}
        </p>
        <p className="mt-1 text-[13px] break-keep text-slate-600">
          {nextAction.label === '설계 확정하기' ? '품질 점검을 통과하면 홈페이지 설계를 확정할 수 있습니다.' : '사이트 구조와 디자인 방향을 정리한 뒤 Claude Code용 개발 지시문을 만듭니다.'}
        </p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => navigate(nextAction.path)}>
            {nextAction.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <WebsiteStatusBadge status={design.status} />
        <WebsiteTypeBadge type={design.strategy.websiteType} />
        <span className="text-xs text-slate-400">설계 v{design.version}</span>
        {errors.length > 0 && <span className="text-xs font-medium text-danger-600">해결할 오류 {errors.length}건</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="추천 홈페이지 유형">
            <div className="flex items-center gap-2">
              <WebsiteTypeBadge type={design.strategy.websiteType} />
            </div>
            <p className="mt-2 text-[13px] break-keep text-slate-600">{design.strategy.websiteTypeReason}</p>
            <dl className="mt-3 flex flex-col gap-2">
              <DefItem label="홈페이지 목적" value={design.strategy.purpose} />
              <DefItem label="핵심 메시지" value={design.strategy.keyMessage} />
            </dl>
          </Panel>

          <Panel title="자동 설계 요약">
            <p className="text-[13px] leading-relaxed break-keep text-slate-600">
              {buildWebsiteAutoSummary(design, organization)}
            </p>
          </Panel>

          <Panel title="진행 순서">
            <ol className="flex flex-col gap-2">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-[13px]">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                  <span className="text-slate-700">{label}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="구성 요약">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['페이지', activePages.length],
                ['필수 섹션', requiredSections],
                ['CTA', design.strategy.conversionActions.length],
                ['외부 연동', design.integrations.length],
                ['부족 콘텐츠', missingContent],
                ['부족 자산', missingAssets],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="text-lg font-bold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <p className="text-xs text-slate-400">콘텐츠 준비율</p>
              <p className="text-lg font-bold text-slate-800">{Math.round((contentReady / contentTotal) * 100)}%</p>
            </div>
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
              {errors.slice(0, 2).map((c) => (
                <p key={c.id} className="flex items-start gap-1.5 text-xs break-keep text-danger-600">
                  <QualitySeverityBadge severity={c.severity} />
                  <span className="min-w-0">{c.description}</span>
                </p>
              ))}
            </div>
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {[
                { to: `/website-studio/projects/${projectId}/strategy`, label: '목표·고객', icon: Target },
                { to: `/website-studio/projects/${projectId}/sitemap`, label: '사이트 구조', icon: Network },
                { to: `/website-studio/projects/${projectId}/pages`, label: '페이지·섹션', icon: LayoutList },
                { to: `/website-studio/projects/${projectId}/content`, label: '콘텐츠·자료', icon: FileText },
                { to: `/website-studio/projects/${projectId}/design`, label: '디자인 방향', icon: Palette },
                { to: `/website-studio/projects/${projectId}/prompt`, label: '개발 지시문', icon: Rocket },
                { to: `/website-studio/projects/${projectId}/review`, label: '설계 확정', icon: ClipboardCheck },
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
