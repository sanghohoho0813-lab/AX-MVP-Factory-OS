import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ListChecks,
  Phone,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { FundingEligibility } from '../../services/funding/evidenceCollector'
import type { FundingStrategy } from '../../types/funding'
import { createStrategy, createNewVersion, summarizeStrategy } from '../../services/fundingService'
import { FUNDING_STEPS, NO_APPROVAL_PREDICTION_NOTE } from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { useToast } from '../../components/ui/toastContext'
import { FundingHeader, FundingNav, FundingNotFound, StaleBanner } from './fundingShared'
import { useFundingData } from './useFundingData'

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

function ApprovalNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-(--radius-card) border border-slate-200 bg-slate-50/70 px-4 py-3">
      <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <p className="text-[13px] break-keep text-slate-600">{NO_APPROVAL_PREDICTION_NOTE}</p>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs break-keep text-slate-400">{hint}</p>}
    </div>
  )
}

interface NextStep {
  title: string
  description: string
  label: string
  path: string
}

function computeNextStep(strategy: FundingStrategy, base: string): NextStep {
  const summary = summarizeStrategy(strategy)
  if (summary.blockingErrorCount > 0) {
    return {
      title: '확정 전 해결할 오류를 처리하세요.',
      description: '품질 검사에서 걸린 오류를 해결해야 전략을 확정할 수 있습니다.',
      label: '검토·확정으로 이동',
      path: `${base}/review`,
    }
  }
  if (summary.primaryCount === 0) {
    return {
      title: '우선 검토할 기관 후보를 정하세요.',
      description: '후보 기관 중 먼저 확인할 곳을 우선 검토로 지정합니다. (승인 가능성 판단이 아닙니다)',
      label: '기관 후보로 이동',
      path: `${base}/matches`,
    }
  }
  if (summary.openGapCount > 0) {
    return {
      title: '부족조건을 확인·보강하세요.',
      description: '요건 미충족과 확인 필요(데이터 없음)를 구분해 필요한 근거를 준비합니다.',
      label: '근거·부족조건으로 이동',
      path: `${base}/gaps`,
    }
  }
  if (strategy.outreachPlans.length === 0) {
    return {
      title: '기관 접촉 계획을 세우세요.',
      description: '누구에게 무엇을 확인할지 정리해 공식 조건을 문의할 준비를 합니다.',
      label: '접촉 계획으로 이동',
      path: `${base}/outreach`,
    }
  }
  return {
    title: '신청·심사를 진행하고 결과를 기록하세요.',
    description: '준비자료를 점검하고 신청 단계를 관리하며 결과와 성과를 기록합니다.',
    label: '신청·심사로 이동',
    path: `${base}/pipeline`,
  }
}

function StrategyOverview({ strategy, projectId }: { strategy: FundingStrategy; projectId: string }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const base = `/funding/projects/${projectId}`
  const summary = summarizeStrategy(strategy)
  const nextStep = computeNextStep(strategy, base)
  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
  const blockingChecks = strategy.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)

  const stats: { key: string; label: string; value: string; hint?: string }[] = [
    { key: 'match', label: '후보 기관', value: `${summary.matchCount}`, hint: `우선 검토 ${summary.primaryCount}` },
    { key: 'primary', label: '우선 검토', value: `${summary.primaryCount}` },
    { key: 'evidence', label: '근거 검증률', value: `${summary.evidenceVerifyRate}%`, hint: `${summary.verifiedEvidenceCount}/${summary.evidenceCount}` },
    { key: 'gap', label: '미해결 부족조건', value: `${summary.openGapCount}`, hint: summary.criticalGapCount > 0 ? `중대 ${summary.criticalGapCount}` : undefined },
    { key: 'doc', label: '준비자료', value: `${summary.docReadyRate}%`, hint: `${summary.docReadyCount}/${summary.docCount}` },
    { key: 'stage', label: '현재 단계', value: summary.currentStageLabel || '미신청' },
    { key: 'outcome', label: '결과 기록', value: `${summary.outcomeCount}` },
  ]

  const quickLinks = [
    { to: `${base}/matches`, label: '기관 후보', icon: Building2 },
    { to: `${base}/gaps`, label: '근거·부족조건', icon: ClipboardList },
    { to: `${base}/outreach`, label: '접촉 계획', icon: Phone },
    { to: `${base}/checklist`, label: '준비자료', icon: ListChecks },
    { to: `${base}/pipeline`, label: '신청·심사', icon: Target },
    { to: `${base}/outcome`, label: '결과·성과', icon: TrendingUp },
    { to: `${base}/case`, label: '사례', icon: FileText },
    { to: `${base}/review`, label: '검토·확정', icon: ClipboardCheck },
  ]

  function handleNewVersion() {
    try {
      createNewVersion(projectId)
      showToast('새 버전을 만들었습니다.')
      navigate(`/funding/projects/${projectId}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '새 버전을 만들 수 없습니다.')
    }
  }

  return (
    <>
      <ApprovalNote />

      <section aria-label="지금 해야 할 일" className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
        <p className="mt-1.5 text-base font-semibold break-keep text-slate-900">{nextStep.title}</p>
        <p className="mt-1 text-[13px] break-keep text-slate-600">{nextStep.description}</p>
        <div className="mt-3">
          <Button variant="primary" onClick={() => navigate(nextStep.path)}>
            {nextStep.label}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="현재 상태 요약">
            <p className="text-[13px] leading-relaxed break-keep text-slate-700">{summary.headline}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <StatCard key={s.key} label={s.label} value={s.value} hint={s.hint} />
              ))}
            </div>
          </Panel>

          <Panel title="진행 순서">
            <p className="mb-3 text-[13px] break-keep text-slate-500">기관·자금 연계는 다음 순서로 진행합니다.</p>
            <ol className="flex flex-col gap-2">
              {FUNDING_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                  <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-[13px] font-medium break-keep text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="점검 상태"
            actions={
              readOnly ? (
                <Button variant="secondary" size="sm" onClick={handleNewVersion}>
                  <Sparkles aria-hidden="true" className="size-4" />
                  새 버전
                </Button>
              ) : undefined
            }
          >
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-600">해결할 오류</span>
              <span className={blockingChecks.length > 0 ? 'font-semibold text-danger-600' : 'text-slate-400'}>
                {blockingChecks.length}건
              </span>
            </div>
            {blockingChecks.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {blockingChecks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-500" />
                    <span className="min-w-0 text-xs break-keep text-slate-600">{c.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] break-keep text-slate-500">해결해야 할 오류가 없습니다.</p>
            )}
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {quickLinks.map((item) => (
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
    </>
  )
}

export function ProjectFundingPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { context } = useFundingData(projectId)
  const { showToast } = useToast()
  const [creating, setCreating] = useState(false)

  if (!context) return <FundingNotFound />

  const { project, organization, eligibility, latest, latestStale } = context
  const orgName = organization?.name ?? '고객사 미상'

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
    <div className="flex flex-col gap-5">
      <FundingHeader project={project} organizationName={orgName} strategy={latest} />

      <HelpNote
        summary="확정된 진단·설계·검증 결과를 근거로 연결할 지원기관을 정리하고, 준비자료·신청·성과·사례까지 이어서 관리합니다."
        what="후보 기관을 추려 추가 검토 우선순위를 정하고, 부족한 근거와 준비자료를 점검합니다."
        when="제출자료 또는 설계·진단이 확정되어 기관 연계를 준비할 때 사용합니다."
        next="후보를 정리한 뒤 접촉 계획을 세우고 신청·심사를 진행합니다."
      />

      {latest ? (
        <>
          <FundingNav projectId={projectId} />
          <StaleBanner show={latestStale} />
          <StrategyOverview strategy={latest} projectId={projectId} />
        </>
      ) : (
        <>
          <section aria-label="지금 해야 할 일" className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold break-keep text-slate-900">연계를 시작하세요.</p>
                <p className="mt-1 text-[13px] break-keep text-slate-600">
                  확정된 결과에서 근거를 모아 후보 기관과 준비할 사항을 자동으로 정리한 초안을 만듭니다.
                </p>
              </div>
              <Button variant="primary" disabled={!eligibility.canCreate || creating} onClick={handleCreate}>
                <Sparkles aria-hidden="true" className="size-4" />
                {creating ? '만드는 중…' : '연계 시작'}
              </Button>
            </div>
            {!eligibility.canCreate && eligibility.reasons.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] break-keep text-warning-700">
                {eligibility.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            )}
          </section>

          <ApprovalNote />

          <Panel title="연계 목적·자금 용도">
            <dl className="flex flex-col gap-3 text-[13px]">
              <div className="flex flex-col gap-0.5">
                <dt className="font-semibold text-slate-500">연계 목적</dt>
                <dd className="break-keep text-slate-700">
                  확정된 결과를 근거로 적합한 지원기관·프로그램을 찾아 자금·인증·지원사업 연계를 준비합니다.
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="font-semibold text-slate-500">자금 용도(프로젝트 목적)</dt>
                <dd className="break-keep text-slate-700">{project.objective || '프로젝트 목적이 입력되지 않았습니다.'}</dd>
              </div>
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
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{row.label}</span>
                  <span className={`shrink-0 text-xs font-medium ${row.ready ? 'text-success-600' : 'text-slate-400'}`}>
                    {row.ready ? '사용 가능' : '선행 필요'}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}
