import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { FundingEligibility } from '../../services/funding/evidenceCollector'
import type { FundingApplication, FundingMatch, FundingStrategy } from '../../types/funding'
import { createStrategy, createNewVersion, summarizeStrategy } from '../../services/fundingService'
import {
  APPLICATION_STAGE_META,
  GAP_SEVERITY_META,
  MATCH_CONFIDENCE_META,
  SOURCE_STATUS_META,
  SUPPORT_TYPE_META,
} from '../../lib/fundingMeta'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { AdvancedFeatureNotice } from '../../components/workspace/FeatureNotices'
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
  FUNDING_MODULE_DESC,
  FUNDING_MODULE_NAME,
  FundingHeader,
  FundingNotFound,
  fundingSteps,
} from './fundingShared'
import { useFundingData } from './useFundingData'

/** 승인 결과를 예측하지 않는다는 고지 (금지 표현 없이 표기) */
const NO_PREDICTION_NOTE =
  '이 화면은 지원 결과를 예측하지 않습니다. 우선 검토 순서와 추가 확인 필요 사항만 정리하며, 실제 조건은 공식 기관 확인이 필요합니다.'

interface ReadinessRow {
  key: string
  label: string
  ready: boolean
}

function readinessRows(e: FundingEligibility): ReadinessRow[] {
  return [
    { key: 'diagnosis', label: '진단 결과', ready: e.hasDiagnosis },
    { key: 'selection', label: '과제선정', ready: e.hasSelection },
    { key: 'ax', label: 'AX MVP 설계', ready: e.hasMvp },
    { key: 'website', label: '홈페이지 설계', ready: e.hasWebsite },
    { key: 'deliverable', label: '제출자료', ready: e.hasDeliverable },
  ]
}

function institutionName(id: string): string {
  return institutionRepository.getById(id)?.name ?? '기관 미상'
}
function programName(id: string | null): string {
  if (!id) return '기관 일반'
  return supportProgramRepository.getById(id)?.name ?? '프로그램 미상'
}

/* ------------------------------------------------------------------ */
/* 오버뷰 (연계 전략 있음)                                              */
/* ------------------------------------------------------------------ */

function StrategyOverview({ strategy, projectId, objectiveFallback }: { strategy: FundingStrategy; projectId: string; objectiveFallback: string }) {
  const { showToast } = useToast()
  const [showExpert, setShowExpert] = useState(false)
  const base = `/funding/projects/${projectId}`
  const summary = summarizeStrategy(strategy)

  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
  const finalized = strategy.status === 'finalized'
  const primaryMatches = strategy.matches.filter((m) => m.priority === 'primary')
  const openGaps = strategy.gaps.filter((g) => g.status === 'open' || g.status === 'in_progress')
  const pendingDocs = strategy.documentRequirements.filter((d) => d.status !== 'ready' && d.status !== 'submitted' && d.status !== 'not_required')
  const blockingChecks = strategy.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)
  const supportLabels = strategy.preferredSupportTypes.map((t) => SUPPORT_TYPE_META[t].label)
  const targetUse = strategy.targetUse || strategy.objective || objectiveFallback || '자금 용도가 입력되지 않았습니다.'

  function handleNewVersion() {
    try {
      createNewVersion(projectId)
      showToast('새 버전을 만들었습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '새 버전을 만들 수 없습니다.')
    }
  }

  // 지금 해야 할 일 (한 화면에 핵심 행동 하나)
  const next = (() => {
    if (blockingChecks.length > 0) return { title: '확정 전 해결할 오류를 처리하세요', why: `검토·확정에서 걸린 오류 ${blockingChecks.length}건을 먼저 해결해야 전략을 확정할 수 있습니다.`, label: '검토·확정으로 이동', path: `${base}/review`, tone: undefined }
    if (summary.primaryCount === 0) return { title: '우선 검토할 기관을 정하세요', why: '후보 기관 중 먼저 확인할 곳을 우선 검토로 지정합니다. 지원 결과 예측이 아니라 검토 순서를 정하는 단계입니다.', label: '기관 후보로 이동', path: `${base}/matches`, tone: undefined }
    if (summary.openGapCount > 0) return { title: '부족조건을 확인·보강하세요', why: '요건 미충족과 확인 필요(데이터 없음)를 구분해 자료 보강 필요 항목을 준비합니다.', label: '근거·부족조건으로 이동', path: `${base}/gaps`, tone: undefined }
    if (strategy.outreachPlans.length === 0) return { title: '기관 접촉 계획을 세우세요', why: '누구에게 무엇을 확인할지 정리해 공식 기관 확인을 준비합니다.', label: '접촉 계획으로 이동', path: `${base}/outreach`, tone: undefined }
    if (!finalized) return { title: '신청·심사를 진행하고 결과를 기록하세요', why: '준비자료를 점검하고 신청 단계를 관리하며 결과·성과를 기록합니다.', label: '신청·심사로 이동', path: `${base}/pipeline`, tone: undefined }
    return { title: '결과·성과를 사례로 정리하세요', why: '연계 전략이 확정되었습니다. 결과·성과를 기록하고 사례로 정리할 수 있습니다.', label: '결과·성과로 이동', path: `${base}/outcome`, tone: 'success' as const }
  })()

  const checklist = [
    { ok: summary.primaryCount > 0, label: '우선 검토 기관 선택', actionPath: `${base}/matches`, actionLabel: '기관 후보로' },
    { ok: summary.evidenceCount > 0, label: '연결할 근거 확인', actionPath: `${base}/gaps`, actionLabel: '근거 확인하기' },
    { ok: summary.openGapCount === 0, label: '미해결 부족조건 없음', actionPath: `${base}/gaps`, actionLabel: '부족조건 보강' },
    { ok: strategy.outreachPlans.length > 0, label: '기관 접촉 계획 수립', actionPath: `${base}/outreach`, actionLabel: '접촉 계획으로' },
    { ok: summary.docCount > 0 && summary.docReadyCount === summary.docCount, label: '준비자료 점검 완료', actionPath: `${base}/checklist`, actionLabel: '준비자료로' },
    { ok: blockingChecks.length === 0, label: '확정 전 오류 없음', actionPath: `${base}/review`, actionLabel: '오류 확인하기' },
    { ok: finalized, label: '연계 전략 확정', actionPath: `${base}/review`, actionLabel: '확정하기' },
  ]

  const warns: WorkspaceWarning[] = [
    ...blockingChecks.slice(0, 3).map((c) => ({ tone: 'error' as const, message: c.description || c.title, actionPath: `${base}/review`, actionLabel: '검토·확정 화면으로' })),
    ...(summary.criticalGapCount > 0 ? [{ tone: 'warn' as const, message: `중대 부족조건 ${summary.criticalGapCount}건 — 자료 보강 필요`, actionPath: `${base}/gaps`, actionLabel: '부족조건으로' }] : []),
    ...(summary.hasOfficialConfirmationPending ? [{ tone: 'warn' as const, message: '공식 기관 확인 필요 항목이 있습니다.', actionPath: `${base}/matches`, actionLabel: '기관 후보로' }] : []),
    ...(summary.stale ? [{ tone: 'warn' as const, message: '출처 원본이 변경되었습니다. 최신 결과를 반영하려면 새 버전을 만드세요.' }] : []),
  ]

  const summaryPanel = (
    <>
      <div>
        <WorkspaceSummaryLine label="자금 용도" value={targetUse} />
        <WorkspaceSummaryLine label="우선 검토 기관" value={`${summary.primaryCount}곳`} />
        <WorkspaceSummaryLine label="현재 근거" value={`${summary.verifiedEvidenceCount}/${summary.evidenceCount} 확인`} />
        <WorkspaceSummaryLine label="부족조건" value={`미해결 ${summary.openGapCount}건`} tone={summary.openGapCount > 0 ? 'warn' : 'ok'} />
        <WorkspaceSummaryLine label="준비자료" value={`${summary.docReadyCount}/${summary.docCount} 준비`} />
        <WorkspaceSummaryLine label="현재 진행상태" value={summary.currentStageLabel || '미신청'} />
        <WorkspaceSummaryLine label="전략 상태" value={finalized ? '확정됨' : '작성 중'} tone={finalized ? 'ok' : 'default'} />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
      {finalized && <WorkspaceNextStep label="결과·성과·사례로 정리하기" path={`${base}/outcome`} />}
    </>
  )

  return (
    <WorkspaceShell
      moduleName={FUNDING_MODULE_NAME}
      moduleDescription={FUNDING_MODULE_DESC}
      saveStatus="local"
      steps={fundingSteps(projectId)}
      currentKey="overview"
      nextAction={<WorkspaceNextAction title={next.title} why={next.why} actionLabel={next.label} actionPath={next.path} tone={next.tone} />}
      summary={summaryPanel}
    >
      <div className="flex flex-col gap-5">
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/70 px-4 py-3 text-[0.9rem] leading-relaxed break-keep text-slate-600">
          {NO_PREDICTION_NOTE}
        </p>

        {/* 자금 용도·지원 유형 */}
        <Panel title="연계 개요·자금 용도">
          <dl className="flex flex-col gap-3">
            <DefItem label="필요한 자금 용도" value={targetUse} />
            <DefItem label="지원 유형" value={supportLabels.length > 0 ? supportLabels.join(', ') : '아직 지정되지 않았습니다.'} />
          </dl>
          {strategy.strategySummary && (
            <p className="mt-3 rounded-(--radius-control) border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-[0.9rem] leading-relaxed break-keep text-slate-600">
              {strategy.strategySummary}
            </p>
          )}
        </Panel>

        {/* 우선 검토 기관 */}
        <Panel title="우선 검토 기관">
          {primaryMatches.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {primaryMatches.map((m) => (
                <InstitutionCard key={m.id} match={m} />
              ))}
            </ul>
          ) : (
            <p className="text-[0.9rem] break-keep text-slate-500">
              아직 우선 검토로 지정한 기관이 없습니다. 기관 후보에서 먼저 확인할 곳을 우선 검토로 지정하세요.
            </p>
          )}
        </Panel>

        {/* 현재 근거·부족조건 */}
        <Panel title="현재 근거·부족조건">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <p className="text-[0.82rem] font-semibold text-slate-500">현재 근거</p>
              <p className="mt-1 text-[0.9rem] break-keep text-slate-700">
                {summary.evidenceCount > 0 ? `근거 ${summary.evidenceCount}건 중 ${summary.verifiedEvidenceCount}건 확인됨 (기초 근거 있음)` : '연결할 근거가 아직 없습니다. 근거 확인이 필요합니다.'}
              </p>
            </div>
            <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <p className="text-[0.82rem] font-semibold text-slate-500">부족조건</p>
              <p className="mt-1 text-[0.9rem] break-keep text-slate-700">
                {openGaps.length > 0 ? `미해결 ${openGaps.length}건 — 자료 보강 필요` : '미해결 부족조건이 없습니다.'}
              </p>
            </div>
          </div>
          {openGaps.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {openGaps.slice(0, 5).map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-[0.9rem] text-slate-700">
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-500" />
                  <span className="min-w-0 break-keep">
                    <span className="font-medium">{GAP_SEVERITY_META[g.severity].label}</span> · {g.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 준비자료 */}
        <Panel title="준비자료">
          <p className="text-[0.9rem] break-keep text-slate-700">
            {summary.docCount > 0 ? `준비자료 ${summary.docCount}건 중 ${summary.docReadyCount}건 준비 완료` : '아직 준비자료 요건이 정리되지 않았습니다.'}
          </p>
          {pendingDocs.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {pendingDocs.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-[0.9rem] text-slate-700">
                  <CircleDashed aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-300" />
                  <span className="min-w-0 break-keep">{d.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 현재 진행상태 */}
        <Panel title="현재 진행상태">
          {strategy.applications.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {strategy.applications.map((app) => (
                <ApplicationCard key={app.id} strategy={strategy} app={app} />
              ))}
            </ul>
          ) : (
            <p className="text-[0.9rem] break-keep text-slate-500">아직 신청 건이 없습니다. 준비가 끝나면 신청·심사에서 진행 상태를 기록하세요.</p>
          )}
        </Panel>

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowExpert((v) => !v)}
            aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700"
          >
            전문가·시스템 정보 (버전·검토 신뢰도·점검·수치)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem] text-slate-400">
                <span>전략 v{strategy.version}</span>
                <span>규칙 {strategy.ruleVersion || '-'}</span>
                {readOnly && (
                  <Button variant="secondary" size="sm" onClick={handleNewVersion}>
                    <Sparkles aria-hidden="true" className="size-4" />
                    새 버전
                  </Button>
                )}
              </div>

              <Panel title="수치 요약">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                  {[
                    ['후보 기관', `${summary.matchCount}`],
                    ['우선 검토', `${summary.primaryCount}`],
                    ['보조 검토', `${summary.secondaryCount}`],
                    ['근거 검증률', `${summary.evidenceVerifyRate}%`],
                    ['준비자료율', `${summary.docReadyRate}%`],
                    ['결과 기록', `${summary.outcomeCount}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[0.82rem] text-slate-400">{label}</dt>
                      <dd className="text-[1.15rem] font-bold text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              {strategy.matches.length > 0 && (
                <Panel title="후보 검토 신뢰도 (승인 보장 아님)">
                  <ul className="flex flex-col gap-1.5">
                    {strategy.matches.slice(0, 8).map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-[0.9rem]">
                        <span className="min-w-0 truncate text-slate-600">{institutionName(m.institutionId)}</span>
                        <span className="shrink-0 text-[0.82rem] font-medium text-slate-500">{MATCH_CONFIDENCE_META[m.confidence].label}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              {blockingChecks.length > 0 && (
                <Panel title="점검 상세">
                  <ul className="flex flex-col gap-1.5">
                    {blockingChecks.slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-start gap-1.5 text-[0.9rem] break-keep text-slate-600">
                        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-500" />
                        <span className="min-w-0">{c.description || c.title}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}

function InstitutionCard({ match }: { match: FundingMatch }) {
  const inst = institutionRepository.getById(match.institutionId)
  const name = inst?.name ?? '기관 미상'
  const freshness = inst
    ? `${SOURCE_STATUS_META[inst.sourceStatus].label}${inst.lastVerifiedAt ? ` · 확인 ${inst.lastVerifiedAt}` : ' · 확인일 없음'}`
    : '공식 기관 확인 필요'
  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        <p className="text-[1.05rem] font-semibold break-keep text-slate-900">{name}</p>
        <span className="text-[0.82rem] break-keep text-slate-400">{programName(match.programId)}</span>
      </div>
      <dl className="mt-2.5 flex flex-col gap-2">
        <CardRow label="왜 검토" value={match.reasonSummary || '검토 사유 확인 필요'} />
        <CardRow label="현재 근거" value={match.strengths.length > 0 ? match.strengths.join(', ') : '기초 근거 확인 필요'} />
        <CardRow label="부족한 내용" value={match.gaps.length > 0 ? match.gaps.join(', ') : '자료 보강 필요 여부 확인'} />
        <CardRow label="공식 확인사항" value={match.officialConfirmationRequired.length > 0 ? match.officialConfirmationRequired.join(', ') : '공식 기관 확인 필요'} />
        <CardRow label="다음 행동" value={match.requiredNextActions.length > 0 ? match.requiredNextActions.join(', ') : '접촉 계획 수립 필요'} />
        <CardRow label="정보 최신성" value={freshness} />
      </dl>
    </li>
  )
}

function ApplicationCard({ strategy, app }: { strategy: FundingStrategy; app: FundingApplication }) {
  const match = app.matchId ? strategy.matches.find((m) => m.id === app.matchId) ?? null : null
  const title = app.applicationName || (match ? institutionName(match.institutionId) : '신청 건')
  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3.5">
      <p className="text-[1.05rem] font-semibold break-keep text-slate-900">{title}</p>
      <dl className="mt-2.5 flex flex-col gap-2">
        <CardRow label="현재 진행상태" value={APPLICATION_STAGE_META[app.applicationStage].label} />
        <CardRow label="최근 행동" value={app.notes || '기록 없음'} />
        <CardRow label="필요한 보완" value={app.supplementRequests.length > 0 ? app.supplementRequests.join(', ') : '없음'} />
        <CardRow label="담당자" value={app.ownerId || '미지정'} />
        <CardRow label="다음 행동" value={app.nextAction || '다음 행동 미정'} />
      </dl>
    </li>
  )
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-[0.82rem] font-semibold text-slate-500 sm:w-24">{label}</dt>
      <dd className="min-w-0 text-[0.9rem] break-keep text-slate-700">{value}</dd>
    </div>
  )
}

function DefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.85rem] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[0.9rem] break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 연계 시작 (연계 전략 없음)                                          */
/* ------------------------------------------------------------------ */

function StartFunding({ projectId, eligibility, objective }: { projectId: string; eligibility: FundingEligibility; objective: string }) {
  const { showToast } = useToast()
  const [creating, setCreating] = useState(false)

  function handleCreate() {
    setCreating(true)
    try {
      createStrategy(projectId)
      showToast('연계 전략 초안을 만들었습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '연계 전략을 만들 수 없습니다.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <WorkspaceShell
      moduleName={FUNDING_MODULE_NAME}
      moduleDescription={FUNDING_MODULE_DESC}
      steps={fundingSteps(projectId)}
      currentKey="overview"
      nextAction={
        <WorkspaceNextAction
          title="연계를 시작하세요"
          why="확정된 결과에서 근거를 모아 후보 기관과 준비할 사항을 자동으로 정리한 초안을 만듭니다."
          actionLabel={creating ? '만드는 중…' : '연계 시작'}
          onAction={handleCreate}
          disabled={!eligibility.canCreate || creating}
          disabledReason={!eligibility.canCreate ? '먼저 진단·설계·제출자료 중 하나 이상을 확정하세요.' : undefined}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/70 px-4 py-3 text-[0.9rem] leading-relaxed break-keep text-slate-600">
          {NO_PREDICTION_NOTE}
        </p>

        <Panel title="연계 목적·자금 용도">
          <dl className="flex flex-col gap-3">
            <DefItem label="연계 목적" value="확정된 결과를 근거로 적합한 지원기관·프로그램을 찾아 자금·인증·지원사업 연계를 준비합니다." />
            <DefItem label="필요한 자금 용도(프로젝트 목적)" value={objective || '프로젝트 목적이 입력되지 않았습니다.'} />
          </dl>
        </Panel>

        <Panel title="확정 결과 준비 상태">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {readinessRows(eligibility).map((row) => (
              <li key={row.key} className="flex items-center gap-2.5 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                {row.ready ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-500" />
                ) : (
                  <CircleDashed aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                )}
                <span className="min-w-0 flex-1 truncate text-[0.9rem] font-medium text-slate-700">{row.label}</span>
                <span className={`shrink-0 text-[0.82rem] font-medium ${row.ready ? 'text-success-600' : 'text-slate-400'}`}>
                  {row.ready ? '사용 가능' : '선행 필요'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {!eligibility.canCreate && eligibility.reasons.length > 0 && (
          <Panel title="연계 시작 전 확인">
            <ul className="list-disc space-y-1 pl-5 text-[0.9rem] break-keep text-warning-700">
              {eligibility.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </WorkspaceShell>
  )
}

/* ------------------------------------------------------------------ */
/* 페이지                                                              */
/* ------------------------------------------------------------------ */

export function ProjectFundingPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { context } = useFundingData(projectId)
  useStoreVersion()
  const advanced = isAdvancedVisible()

  if (!context) {
    return (
      <div className="flex flex-col gap-5">
        <FundingHeader />
        <FundingNotFound />
      </div>
    )
  }

  const { project, eligibility, latest } = context
  const advancedNotice = !advanced ? (
    <AdvancedFeatureNotice
      featureName="기관·자금 연계"
      whenToUse="프로젝트 결과와 근거가 쌓인 뒤, 검토할 기관과 준비자료를 관리할 때 사용합니다."
    />
  ) : null

  return (
    <div className="flex flex-col gap-5">
      {advancedNotice}
      {latest ? (
        <StrategyOverview strategy={latest} projectId={projectId} objectiveFallback={project.objective} />
      ) : (
        <StartFunding projectId={projectId} eligibility={eligibility} objective={project.objective} />
      )}
    </div>
  )
}
