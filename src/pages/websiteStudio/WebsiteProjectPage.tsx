import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Palette, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WebsiteDesignBlockedError,
  ensureWebsiteDraft,
} from '../../services/websiteDesignService'
import { buildWebsiteAutoSummary } from '../../services/websiteStudio/summaryBuilder'
import { WEBSITE_TYPE_META, BRAND_PERSONALITY_META } from '../../lib/websiteDesignMeta'
import { WebsiteStatusBadge, WebsiteTypeBadge, PageStatusBadge, QualitySeverityBadge } from '../../components/websiteStudio/badges'
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
  WEBSITE_MODULE_DESC,
  WEBSITE_MODULE_NAME,
  ReadinessNotice,
  RedesignBanner,
  WebsiteGateNotice,
  WebsiteHeader,
  WebsiteNav,
  WebsiteProjectNotFound,
  websiteSteps,
} from './websiteShared'
import { useWebsiteData } from './useWebsiteData'

export function WebsiteProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useWebsiteData(projectId)
  const [showExpert, setShowExpert] = useState(false)

  if (!context) return <WebsiteProjectNotFound />
  const { organization, eligibility, design } = context
  const base = `/website-studio/projects/${projectId}`

  const doGenerate = () => {
    try {
      ensureWebsiteDraft(projectId)
      showToast('홈페이지 설계 초안을 생성했습니다.')
    } catch (error) {
      showToast(error instanceof WebsiteDesignBlockedError ? error.message : '설계 생성에 실패했습니다.')
    }
  }

  // 진입 차단 (AX 전용 등)
  if (!eligibility.canDesign) {
    return (
      <div className="flex flex-col gap-5">
        <WebsiteHeader />
        <WebsiteGateNotice context={context} />
      </div>
    )
  }

  // 설계 초안 없음
  if (!design) {
    return (
      <WorkspaceShell moduleName={WEBSITE_MODULE_NAME} moduleDescription={WEBSITE_MODULE_DESC} steps={websiteSteps(projectId)} currentKey="overview">
        <div className="flex flex-col gap-5">
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
      </WorkspaceShell>
    )
  }

  const { strategy, designDirection } = design
  const activePages = design.pages.filter((p) => p.status === 'required' || p.status === 'recommended')
  const requiredSections = design.pages.flatMap((p) => p.sections).filter((s) => s.scope === 'required').length
  const contentTotal = design.contentItems.length || 1
  const contentReady = design.contentItems.filter((c) => c.status === 'ready' || c.status === 'draft').length
  const missingContent = design.contentItems.filter((c) => c.required && c.status === 'missing').length
  const missingAssets = design.assetRequirements.filter((a) => a.required && a.status === 'missing').length
  const errors = design.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)
  const warnings = design.qualityChecks.filter((c) => c.severity === 'warning' && !c.passed)
  const hasPrompt = design.generatedPrompts.some((p) => p.type === 'claude_code')
  const finalized = design.status === 'finalized'

  // 핵심 고객·핵심 행동 (쉬운 표현)
  const primaryAudience =
    strategy.audiences.find((a) => a.id === strategy.primaryAudienceId) ??
    strategy.audiences.find((a) => a.priority === 'primary') ??
    strategy.audiences[0]
  const primaryConversion =
    strategy.conversionActions.find((a) => a.id === strategy.primaryConversionActionId) ??
    strategy.conversionActions.find((a) => a.priority === 'primary') ??
    strategy.conversionActions[0]
  const primaryActionLabel = primaryConversion?.label || primaryConversion?.buttonText || '미정'

  const strategyReady = strategy.purpose.trim().length > 0 && strategy.audiences.length > 0
  const hasDesignDirection = designDirection.personalities.length > 0
  const websiteTypeLabel = WEBSITE_TYPE_META[strategy.websiteType].label
  const designWords =
    designDirection.moodDescription?.trim() ||
    designDirection.personalities.map((p) => BRAND_PERSONALITY_META[p].label).join(' · ')

  const audienceName = (id: string) => strategy.audiences.find((a) => a.id === id)?.name

  // 지금 해야 할 일 (한 화면에 핵심 행동 하나)
  const next = (() => {
    if (!strategyReady) return { title: '홈페이지 목표부터 정하세요', why: '홈페이지 목적과 핵심 고객을 정하면 구조·콘텐츠·디자인을 자동으로 제안합니다.', label: '홈페이지 목표 정하기', path: `${base}/strategy` }
    if (activePages.length === 0) return { title: '사이트 구조를 확인하세요', why: '어떤 페이지가 필요한지 정해야 콘텐츠와 디자인으로 진행할 수 있습니다.', label: '사이트 구조 확인하기', path: `${base}/sitemap` }
    if (missingContent > 0) return { title: '부족한 콘텐츠를 정리하세요', why: `제작 전 확보해야 할 필수 콘텐츠 ${missingContent}건이 아직 준비되지 않았습니다.`, label: '부족한 콘텐츠 정리하기', path: `${base}/content` }
    if (!hasDesignDirection) return { title: '디자인 방향을 정하세요', why: '브랜드 느낌과 화면 스타일을 정하면 개발 지시문에 반영됩니다.', label: '디자인 방향 정하기', path: `${base}/design` }
    if (errors.length > 0) return { title: '설계 오류를 먼저 확인하세요', why: `해결할 오류 ${errors.length}건이 있어 설계를 확정할 수 없습니다.`, label: '설계 오류 확인하기', path: `${base}/review` }
    if (!hasPrompt) return { title: '개발 지시문을 만드세요', why: '사이트 구조·디자인 방향을 정리해 Claude Code용 개발 지시문을 생성합니다.', label: '개발 지시문 만들기', path: `${base}/prompt` }
    if (!finalized) return { title: '홈페이지 설계안을 확정하세요', why: '준비가 되었습니다. 확정하면 실제 제작에 넘길 수 있습니다.', label: '홈페이지 설계안 확정하기', path: `${base}/review`, tone: 'success' as const }
    return { title: '홈페이지 설계가 확정되었습니다', why: '확정된 설계와 개발 지시문을 제작에 전달하세요.', label: '확정 내용 보기', path: `${base}/review`, tone: 'success' as const }
  })()

  const checklist = [
    { ok: strategyReady, label: '홈페이지 목적·핵심 고객 정함', actionPath: `${base}/strategy`, actionLabel: '목표 정하기' },
    { ok: activePages.length > 0, label: '사이트 구조(페이지)가 구성됨', actionPath: `${base}/sitemap`, actionLabel: '구조 확인하기' },
    { ok: missingContent === 0, label: '필수 콘텐츠 준비 완료', actionPath: `${base}/content`, actionLabel: '콘텐츠 정리하기' },
    { ok: missingAssets === 0, label: '필수 이미지·자산 준비 완료', actionPath: `${base}/content`, actionLabel: '자산 확인하기' },
    { ok: hasDesignDirection, label: '디자인 방향이 정해짐', actionPath: `${base}/design`, actionLabel: '디자인 방향 정하기' },
    { ok: errors.length === 0, label: '품질 오류 없음', actionPath: `${base}/review`, actionLabel: '오류 확인하기' },
    { ok: finalized, label: '홈페이지 설계안 확정', actionPath: `${base}/review`, actionLabel: '확정하기' },
  ]

  const warns: WorkspaceWarning[] = [
    ...errors.slice(0, 3).map((c) => ({ tone: 'error' as const, message: c.description, actionPath: `${base}/review`, actionLabel: '설계 확정 화면으로' })),
    ...warnings.slice(0, 2).map((c) => ({ tone: 'warn' as const, message: c.description })),
  ]

  const summary = (
    <>
      <div>
        <WorkspaceSummaryLine label="홈페이지 목적" value={strategy.purpose || '미정'} />
        <WorkspaceSummaryLine label="핵심 고객" value={primaryAudience?.name ?? '미정'} />
        <WorkspaceSummaryLine label="핵심 행동" value={primaryActionLabel} />
        <WorkspaceSummaryLine label="추천 유형" value={websiteTypeLabel} />
        <WorkspaceSummaryLine label="페이지 수" value={`${activePages.length}개`} />
        <WorkspaceSummaryLine label="부족 콘텐츠" value={`${missingContent}건`} tone={missingContent > 0 ? 'warn' : 'ok'} />
        <WorkspaceSummaryLine label="부족 이미지" value={`${missingAssets}건`} tone={missingAssets > 0 ? 'warn' : 'ok'} />
        <WorkspaceSummaryLine label="설계 상태" value={finalized ? '확정됨' : '작성 중'} tone={finalized ? 'ok' : 'default'} />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
      {finalized && <WorkspaceNextStep label="확정된 설계·개발 지시문 보기" path={`${base}/review`} />}
    </>
  )

  return (
    <WorkspaceShell
      moduleName={WEBSITE_MODULE_NAME}
      moduleDescription={WEBSITE_MODULE_DESC}
      saveStatus="local"
      steps={websiteSteps(projectId)}
      currentKey="overview"
      nextAction={<WorkspaceNextAction title={next.title} why={next.why} actionLabel={next.label} actionPath={next.path} tone={next.tone} />}
      summary={summary}
    >
      <div className="flex flex-col gap-5">
        <RedesignBanner show={context.needsRedesignFlag} onRun={() => navigate(`${base}/review`)} />
        <ReadinessNotice show={!eligibility.hasReadiness} />

        {/* 홈페이지 개요 (쉬운 표현) */}
        <Panel title="이 홈페이지가 하려는 일">
          <dl className="flex flex-col gap-3">
            <DefItem label="홈페이지 목적" value={strategy.purpose} />
            <DefItem label="핵심 고객" value={primaryAudience?.name ?? ''} />
            <DefItem label="핵심 행동" value={primaryActionLabel} />
            <DefItem label="핵심 메시지" value={strategy.keyMessage} />
          </dl>
          <p className="mt-3 rounded-(--radius-control) border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-[0.95rem] leading-relaxed break-keep text-slate-600">
            {buildWebsiteAutoSummary(design, organization)}
          </p>
        </Panel>

        {/* 추천 홈페이지 유형 */}
        <Panel title="추천 홈페이지 유형">
          <div className="flex items-center gap-2">
            <WebsiteTypeBadge type={strategy.websiteType} />
          </div>
          <p className="mt-2 text-[0.95rem] break-keep text-slate-600">{strategy.websiteTypeReason}</p>
        </Panel>

        {/* 주요 페이지 (쉬운 표현: 페이지명·필요한 이유·대상 고객·핵심 메시지·준비 상태) */}
        {activePages.length > 0 && (
          <Panel title="주요 페이지">
            <ul className="flex flex-col gap-2.5">
              {activePages.slice(0, 8).map((p) => {
                const audienceNames = p.targetAudienceIds.map(audienceName).filter(Boolean).join(', ')
                const needsContent = p.sections.some((s) => s.contentStatus === 'missing')
                return (
                  <li key={p.id} className="rounded-(--radius-control) border border-slate-100 px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[1.05rem] font-semibold break-keep text-slate-800">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <PageStatusBadge status={p.status} />
                        <span className={`text-[0.82rem] font-medium ${needsContent ? 'text-warning-700' : 'text-success-700'}`}>
                          {needsContent ? '자료 준비 필요' : '준비됨'}
                        </span>
                      </div>
                    </div>
                    {p.purpose && <p className="mt-1 text-[0.95rem] break-keep text-slate-600">{p.purpose}</p>}
                    {p.primaryMessage && <p className="mt-1 text-[0.9rem] break-keep text-slate-500">핵심 메시지: {p.primaryMessage}</p>}
                    {audienceNames && <p className="mt-0.5 text-[0.9rem] break-keep text-slate-500">대상 고객: {audienceNames}</p>}
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}

        {/* 디자인 방향 (쉬운 표현) */}
        {hasDesignDirection && (
          <Panel title="디자인 방향">
            <p className="text-[0.98rem] leading-relaxed break-keep text-slate-700">{designWords}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {designDirection.personalities.map((p) => (
                <span key={p} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[0.85rem] font-medium text-slate-600">
                  {BRAND_PERSONALITY_META[p].label}
                </span>
              ))}
            </div>
          </Panel>
        )}

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button type="button" onClick={() => setShowExpert((v) => !v)} aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700">
            전문가·시스템 정보 (버전·유형 코드·구성 수치·점검)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2 text-[0.85rem] text-slate-400">
                <WebsiteStatusBadge status={design.status} />
                <span>설계 v{design.version}</span>
                <span>유형 코드: {strategy.websiteType}</span>
                <span>규칙 {design.ruleVersion}</span>
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel title="구성 요약">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      ['페이지', activePages.length],
                      ['필수 섹션', requiredSections],
                      ['CTA', strategy.conversionActions.length],
                      ['외부 연동', design.integrations.length],
                      ['폼', design.forms.length],
                      ['부족 콘텐츠', missingContent],
                      ['부족 자산', missingAssets],
                      ['콘텐츠 준비율', `${Math.round((contentReady / contentTotal) * 100)}%`],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <dt className="text-[0.82rem] text-slate-400">{label}</dt>
                        <dd className="text-[1.1rem] font-bold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
                <Panel title="페이지 코드">
                  <ul className="flex flex-col gap-1.5">
                    {activePages.slice(0, 10).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-[0.88rem]">
                        <span className="min-w-0 truncate text-slate-600">{p.name}</span>
                        <span className="shrink-0 text-slate-400">{p.pageType} · /{p.slug}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
              {errors.length + warnings.length > 0 && (
                <Panel title="점검 상세">
                  <ul className="flex flex-col gap-1.5">
                    {[...errors, ...warnings].slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-start gap-1.5 text-[0.88rem] break-keep text-slate-600">
                        <QualitySeverityBadge severity={c.severity} />
                        <span className="min-w-0">{c.description}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              <WebsiteNav projectId={projectId} />
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
