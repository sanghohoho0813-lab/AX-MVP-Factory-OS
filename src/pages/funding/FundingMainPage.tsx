import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePlus2,
  Landmark,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { FundingStrategy } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  organizationRepository,
  projectRepository,
  supportProgramRepository,
} from '../../repositories'
import {
  countFundingPending,
  getFundingEligibility,
  getProjectFundingContext,
  summarizeStrategy,
} from '../../services/fundingService'
import type { FundingEligibility } from '../../services/funding/evidenceCollector'
import type { FundingSummary } from '../../services/funding/fundingSummaryBuilder'
import { FUNDING_STEPS, NO_APPROVAL_PREDICTION_NOTE } from '../../lib/fundingMeta'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import {
  ApplicationStageBadge,
  OutcomeTypeBadge,
  StrategyStatusBadge,
} from '../../components/funding/badges'

interface Row {
  project: Project
  orgName: string
  eligibility: FundingEligibility
  latest: FundingStrategy | null
  summary: FundingSummary | null
  latestStale: boolean
}

function evidenceFlags(e: FundingEligibility): string[] {
  return [
    e.hasDiagnosis ? '진단' : null,
    e.hasSelection ? '과제선정' : null,
    e.hasMvp ? 'AX설계' : null,
    e.hasWebsite ? '홈페이지설계' : null,
    e.hasDeliverable ? '제출자료' : null,
  ].filter((v): v is string => v !== null)
}

const IN_REVIEW_STAGES = ['reviewing', 'submitted'] as const

export function FundingMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const { rows, counts, stalePrograms } = useMemo(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    const all = projectRepository.getAll().filter((p) => p.status !== 'archived')
    const built: Row[] = []
    for (const project of all) {
      const eligibility = getFundingEligibility(project.id)
      const context = getProjectFundingContext(project.id)
      if (!eligibility || !context) continue
      built.push({
        project,
        orgName: orgById.get(project.organizationId)?.name ?? '알 수 없음',
        eligibility,
        latest: context.latest,
        summary: context.latest ? summarizeStrategy(context.latest) : null,
        latestStale: context.latestStale,
      })
    }
    return {
      rows: built,
      counts: countFundingPending(),
      stalePrograms: supportProgramRepository.findStalePrograms().length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const creatable = rows.filter((r) => r.eligibility.canCreate)
  const inProgress = rows.filter(
    (r) => r.latest && r.latest.applications.some((a) => IN_REVIEW_STAGES.includes(a.applicationStage as (typeof IN_REVIEW_STAGES)[number])),
  )
  const supplement = rows.filter(
    (r) => r.latest && r.latest.applications.some((a) => a.applicationStage === 'supplement_requested'),
  )
  const results = rows.filter((r) => r.latest && r.latest.outcomes.length > 0)

  const go = (r: Row) => navigate(`/funding/projects/${r.project.id}`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.875rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    {
      key: 'use', header: '필요한 자금 용도', className: 'hidden xl:table-cell min-w-[160px]',
      cell: (r) => (
        <span className="line-clamp-2 text-[13px] text-slate-600">
          {r.latest?.targetUse || r.project.objective || '미입력'}
        </span>
      ),
    },
    {
      key: 'evidence', header: '준비된 근거', className: 'hidden lg:table-cell',
      cell: (r) => {
        const labels = evidenceFlags(r.eligibility)
        if (labels.length === 0) return <span className="text-[13px] text-slate-400">없음</span>
        return (
          <div className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <span key={label} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-slate-600">{label}</span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'candidate', header: '추천 후보', className: 'hidden lg:table-cell',
      cell: (r) => (
        r.summary
          ? <span className="text-[13px] font-medium text-slate-700">우선 검토 {r.summary.primaryCount}곳</span>
          : <span className="text-[13px] text-slate-400">미생성</span>
      ),
    },
    {
      key: 'status', header: '현재 상태',
      cell: (r) => (r.latest ? <StrategyStatusBadge status={r.latest.status} /> : <span className="text-[13px] text-slate-400">없음</span>),
    },
    {
      key: 'action', header: '', className: 'text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
          {r.latest ? '연계 보기' : '연계 시작'}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="기관·자금 연계"
        description="프로젝트 근거를 확인하고 연결할 기관·지원 유형, 준비자료와 진행 결과를 관리합니다."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/funding/results')}>
              진행 결과 보기
            </Button>
            <Button variant="primary" onClick={() => navigate('/funding/catalog')}>
              기관·프로그램 목록
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        }
      />

      <div
        role="note"
        className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3"
      >
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
        <p className="text-[13px] break-keep text-warning-800">{NO_APPROVAL_PREDICTION_NOTE}</p>
      </div>

      <HelpNote
        summary={`① ${FUNDING_STEPS[0]} → ② ${FUNDING_STEPS[1]} → ③ ${FUNDING_STEPS[2]} → ④ ${FUNDING_STEPS[3]} → ⑤ ${FUNDING_STEPS[4]} → ⑥ ${FUNDING_STEPS[5]} → ⑦ ${FUNDING_STEPS[6]} 순서로 진행합니다.`}
        what="확정된 진단·설계·테스트·제출자료를 근거로 연결할 기관·지원 유형 후보를 정리하고, 준비자료·접촉·신청·결과를 관리합니다."
        when="자금·보증·지원사업 등 외부 기관과의 연계를 검토하거나 진행 상황을 기록할 때 사용합니다."
        next="후보를 정리하면 준비자료를 점검하고, 실제 신청·심사 결과와 성과를 기록해 사례로 정리할 수 있습니다. 승인 여부·한도·금리는 공식 공고와 기관 문의로 확인합니다."
      />

      <SummaryStrip
        ariaLabel="기관·자금 연계 요약"
        items={[
          { key: 'creatable', label: '연계 준비', value: counts.creatable, unit: '건', tone: 'info', icon: FilePlus2 },
          { key: 'reviewing', label: '기관 검토 중', value: counts.reviewing, unit: '건', tone: 'accent', icon: ClipboardList },
          { key: 'applyingReady', label: '신청 준비', value: counts.applyingReady, unit: '건', tone: 'info', icon: ListChecks },
          { key: 'underReview', label: '심사 중', value: counts.underReview, unit: '건', tone: 'warning', icon: Clock },
          { key: 'outcomeDone', label: '결과 완료', value: counts.outcomeDone, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'supplementNeeded', label: '보완 필요', value: counts.supplementNeeded, unit: '건', tone: 'danger', icon: AlertTriangle },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => navigate('/funding/projects/proj-101')}>
          <Sparkles aria-hidden="true" className="size-4" />
          샘플 프로젝트 연계 보기
        </Button>
      </div>

      <Panel title="연계가 필요한 프로젝트" flush>
        {creatable.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="아직 연계할 수 있는 프로젝트가 없습니다"
            description="기관·자금 연계는 확정된 진단 결과 또는 확정된 AX MVP·홈페이지 설계·제출자료가 있어야 시작할 수 있습니다. 먼저 진단·설계를 확정하고 제출자료를 만드세요."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => navigate('/deliverables')}>제출자료로 이동</Button>
                <Button variant="secondary" onClick={() => navigate('/diagnosis')}>진단으로 이동</Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={creatable} rowKey={(r) => r.project.id} rowAriaLabel={(r) => `${r.project.name} 기관·자금 연계`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {creatable.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="mt-0.5 text-[0.875rem] text-slate-400">{evidenceFlags(r.eligibility).join(' · ') || '근거 없음'}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {r.latest ? <StrategyStatusBadge status={r.latest.status} /> : <span className="text-[0.875rem] text-slate-400">연계 전략 없음</span>}
                        <ProjectTypeBadge type={r.project.projectType} compact />
                      </div>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-brand-600">{r.latest ? '연계 보기' : '연계 시작'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="진행 중 신청" flush>
          {inProgress.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">제출·심사 중인 신청이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inProgress.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.875rem] text-slate-400">{r.summary?.currentStageLabel || '진행 중'}</p>
                    </div>
                    <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="보완 요청" flush>
          {supplement.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">보완 요청받은 신청이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {supplement.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-[0.875rem] text-warning-600">기관이 추가 자료를 요청했습니다.</p>
                    </div>
                    <ApplicationStageBadge stage="supplement_requested" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="최근 결과" flush>
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">기록된 결과가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((r) => {
                const outcome = r.latest?.outcomes[r.latest.outcomes.length - 1] ?? null
                return (
                  <li key={r.project.id}>
                    <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                        <p className="text-[0.875rem] text-slate-400">결과 {r.latest?.outcomes.length}건 기록</p>
                      </div>
                      {outcome && <OutcomeTypeBadge type={outcome.type} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="오래된 기관·프로그램 정보" flush>
          <div className="flex flex-col gap-3 px-5 py-5">
            <div className="flex items-start gap-2">
              <RefreshCw aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-500" />
              <p className="text-[13px] break-keep text-slate-600">
                재확인이 필요한(오래됨·확인 필요·재확인 권장) 지원 프로그램이{' '}
                <span className="font-semibold text-warning-700">{stalePrograms}건</span> 있습니다. 실제 조건은 공식 공고에서 확인하세요.
              </p>
            </div>
            <div>
              <Button variant="secondary" onClick={() => navigate('/funding/catalog')}>
                <TrendingUp aria-hidden="true" className="size-4" />
                목록에서 확인·갱신
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
