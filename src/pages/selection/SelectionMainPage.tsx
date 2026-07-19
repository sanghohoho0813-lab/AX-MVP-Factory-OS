import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { Project } from '../../types/domain'
import type { AssessmentConfidence } from '../../types/assessment'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { memberName } from '../../data/members'
import { RECOMMENDATION_META } from '../../lib/assessmentMeta'
import {
  automationCandidateRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
} from '../../repositories'
import {
  getProjectSelectionLifecycle,
  type SelectionLifecycle,
} from '../../services/selectionService'
import { assessmentRepository } from '../../repositories'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { AssessmentConfidenceBadge } from '../../components/assessment/badges'

interface Row {
  project: Project
  orgName: string
  lifecycle: SelectionLifecycle
  candidateCount: number
  primaryName: string | null
  primaryScore: number | null
  diagnosisLabel: string
  confidence: AssessmentConfidence
}

const LIFECYCLE_ACTION: Record<SelectionLifecycle, string> = {
  website_only: '웹사이트 스튜디오',
  not_eligible: '진단 분석',
  ready_to_extract: '후보 추출',
  candidates_ready: '후보 검토',
  draft: '선정 계속',
  reviewed: '결과 검토',
  finalized: '결과 보기',
  needs_reselection: '재선별',
}

export function SelectionMainPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const rows = useMemo<Row[]>(() => {
    const orgById = new Map(organizationRepository.getAll(true).map((o) => [o.id, o]))
    return projectRepository
      .getAll()
      .filter((p) => p.projectType !== 'website' && p.status !== 'archived')
      .map((project) => {
        const assessment = assessmentRepository.getLatestByProjectId(project.id)
        if (!assessment) return null
        const lifecycle = getProjectSelectionLifecycle(project)
        const decision = selectionDecisionRepository.getLatestByProjectId(project.id)
        const primary = decision?.primaryCandidateId
          ? automationCandidateRepository.getById(decision.primaryCandidateId)
          : null
        return {
          project,
          orgName: orgById.get(project.organizationId)?.name ?? '알 수 없음',
          lifecycle,
          candidateCount: automationCandidateRepository.getByProjectId(project.id).length,
          primaryName: primary?.name ?? null,
          primaryScore: primary?.priorityScore ?? null,
          diagnosisLabel: RECOMMENDATION_META[assessment.recommendation].label,
          confidence: assessment.confidence,
        }
      })
      .filter((r): r is Row => r !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const needSelection = rows.filter((r) => ['ready_to_extract', 'candidates_ready', 'needs_reselection'].includes(r.lifecycle))
  const inProgress = rows.filter((r) => r.lifecycle === 'draft' || r.lifecycle === 'reviewed')
  const finalized = rows.filter((r) => r.lifecycle === 'finalized')
  const websiteProjects = useMemo(
    () => projectRepository.getAll().filter((p) => p.projectType === 'website' && p.status !== 'archived'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const go = (r: Row) =>
    navigate(r.lifecycle === 'finalized' ? `/selection/projects/${r.project.id}/decision` : `/selection/projects/${r.project.id}`)

  const columns: DataTableColumn<Row>[] = [
    { key: 'client', header: '고객사', cell: (r) => <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span> },
    {
      key: 'project', header: '프로젝트', className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-xs text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact /> },
    { key: 'diagnosis', header: '진단 판정', className: 'hidden lg:table-cell', cell: (r) => <span className="text-[13px] text-slate-600">{r.diagnosisLabel}</span> },
    { key: 'candidates', header: '후보', cell: (r) => <span className="text-[13px] text-slate-600">{r.candidateCount}건</span> },
    {
      key: 'action', header: '', className: 'text-right',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600">
          {LIFECYCLE_ACTION[r.lifecycle]}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="과제선별"
        description="진단 결과에서 자동화 후보 업무를 추출하고 효과와 실행 가능성을 비교해 첫 번째 MVP 과제를 선정합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/selection/results')}>
            선정 결과 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        }
      />

      <SummaryStrip
        ariaLabel="과제선별 요약"
        items={[
          { key: 'ready', label: '선별 준비 프로젝트', value: needSelection.length, unit: '건', tone: 'info', icon: Search },
          { key: 'progress', label: '선정 검토 중', value: inProgress.length, unit: '건', tone: 'warning', icon: FlaskConical },
          { key: 'finalized', label: '핵심 과제 확정', value: finalized.length, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'reselection', label: '재선별 필요', value: rows.filter((r) => r.lifecycle === 'needs_reselection').length, unit: '건', tone: 'warning', icon: RefreshCw },
        ]}
      />

      <Panel title="선별이 필요한 프로젝트" flush>
        {needSelection.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="선별이 필요한 프로젝트가 없습니다"
            description="진단 결과가 확정된 AX 프로젝트가 생기면 이곳에 표시됩니다."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable columns={columns} rows={needSelection} rowKey={(r) => r.project.id} rowAriaLabel={(r) => `${r.project.name} 과제선별`} onRowClick={go} />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {needSelection.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-xs text-slate-400">후보 {r.candidateCount}건</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-brand-600">{LIFECYCLE_ACTION[r.lifecycle]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="진행 중인 과제선별" flush>
          {inProgress.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">진행 중인 과제선별이 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {inProgress.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.orgName} · {r.project.name}</p>
                      <p className="text-xs text-slate-400">후보 {r.candidateCount}건 · {r.lifecycle === 'draft' ? '선정 초안' : '내부 검토'}</p>
                    </div>
                    <AssessmentConfidenceBadge confidence={r.confidence} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="최근 확정 결과" flush>
          {finalized.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-slate-400">확정된 선정 결과가 없습니다.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {finalized.map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => go(r)} className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 text-left">
                      <p className="truncate text-sm font-medium text-slate-800">{r.primaryName ?? r.project.name}</p>
                      <p className="text-xs text-slate-400">{r.orgName} · {memberName(r.project.ownerId)}</p>
                    </div>
                    {r.primaryScore !== null && <span className="shrink-0 text-sm font-bold text-slate-800">{r.primaryScore}점</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {websiteProjects.length > 0 && (
        <Panel title="홈페이지 단독 프로젝트">
          <p className="mb-2 text-[13px] break-keep text-slate-500">
            홈페이지 제작 프로젝트에는 AX 과제선별을 적용하지 않습니다. 제작 방향은 웹사이트 스튜디오에서 설계합니다.
          </p>
          <ul className="flex flex-wrap gap-2">
            {websiteProjects.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => navigate('/website-studio')} className="rounded-(--radius-control) border border-slate-200 px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50">
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-slate-400">
        후보 점수는 제출 응답과 사전 정의된 선별 규칙으로 계산됩니다.
      </p>
    </div>
  )
}
