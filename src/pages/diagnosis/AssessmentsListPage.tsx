import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  FlaskConical,
  RefreshCw,
  ScanSearch,
  TrendingDown,
} from 'lucide-react'
import type { AssessmentResult } from '../../types/assessment'
import type { Organization, Project } from '../../types/domain'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate, normalizeQuery } from '../../lib/format'
import { memberName } from '../../data/members'
import {
  assessmentRepository,
  organizationRepository,
  projectRepository,
} from '../../repositories'
import { needsReanalysis } from '../../services/assessmentService'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { EmptyState } from '../../components/ui/EmptyState'
import { GuidedEmptyState } from '../../components/ui/GuidedEmptyState'
import { useDemoTour } from '../../components/demo/demoTour'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import {
  AssessmentConfidenceBadge,
  AssessmentRecommendationBadge,
  AssessmentStatusBadge,
} from '../../components/assessment/badges'

interface Row {
  assessment: AssessmentResult
  project: Project
  organization: Organization | null
  needsReanalysis: boolean
}

function scoreLabel(a: AssessmentResult): string {
  if (a.analysisKind === 'website') {
    return `준비도 ${a.websiteReadiness?.overallScore ?? 0}점`
  }
  return `${a.finalScore}점`
}

export function AssessmentsListPage() {
  const navigate = useNavigate()
  const demo = useDemoTour()
  const version = useStoreVersion()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [sort, setSort] = useState('recent')

  const rows = useMemo<Row[]>(() => {
    const all = assessmentRepository.getAll()
    // 프로젝트별 최신(비-superseded 우선) 1건
    const byProject = new Map<string, AssessmentResult>()
    for (const a of all) {
      const current = byProject.get(a.projectId)
      if (!current) {
        byProject.set(a.projectId, a)
        continue
      }
      const currentActive = current.status !== 'superseded'
      const aActive = a.status !== 'superseded'
      if ((aActive && !currentActive) || (aActive === currentActive && a.version > current.version)) {
        byProject.set(a.projectId, a)
      }
    }
    return [...byProject.values()]
      .map((assessment) => {
        const project = projectRepository.getById(assessment.projectId)
        if (!project) return null
        return {
          assessment,
          project,
          organization: organizationRepository.getById(project.organizationId),
          needsReanalysis: needsReanalysis(assessment),
        }
      })
      .filter((r): r is Row => r !== null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const filtered = useMemo(() => {
    const q = normalizeQuery(query)
    const result = rows.filter((r) => {
      if (status && r.assessment.status !== status) return false
      if (type && r.project.projectType !== type) return false
      if (q) {
        const haystack = `${r.organization?.name ?? ''} ${r.project.name} ${r.organization?.industry ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    const score = (a: AssessmentResult) =>
      a.analysisKind === 'website' ? (a.websiteReadiness?.overallScore ?? 0) : a.finalScore
    result.sort((a, b) => {
      switch (sort) {
        case 'score_desc':
          return score(b.assessment) - score(a.assessment)
        case 'score_asc':
          return score(a.assessment) - score(b.assessment)
        case 'client_name':
          return (a.organization?.name ?? '').localeCompare(b.organization?.name ?? '')
        default:
          return b.assessment.updatedAt.localeCompare(a.assessment.updatedAt)
      }
    })
    return result
  }, [rows, query, status, type, sort])

  const counts = {
    draft: rows.filter((r) => r.assessment.status === 'draft').length,
    reviewed: rows.filter((r) => r.assessment.status === 'reviewed').length,
    finalized: rows.filter((r) => r.assessment.status === 'finalized').length,
    reanalysis: rows.filter((r) => r.needsReanalysis).length,
    deferred: rows.filter(
      (r) =>
        r.assessment.analysisKind !== 'website' &&
        (r.assessment.recommendation === 'build_deferred_data' ||
          r.assessment.recommendation === 'build_deferred_adoption'),
    ).length,
  }

  const goTo = (r: Row) =>
    navigate(`/diagnosis/projects/${r.project.id}/analysis/result`)

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'client',
      header: '고객사',
      cell: (r) => (
        <span className="text-[13px] font-medium text-slate-700">
          {r.organization?.name ?? '알 수 없음'}
        </span>
      ),
    },
    {
      key: 'project',
      header: '프로젝트',
      className: 'min-w-[150px]',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{r.project.name}</p>
          <p className="text-[0.875rem] text-slate-400">{r.project.projectCode}</p>
        </div>
      ),
    },
    { key: 'type', header: '유형', cell: (r) => <ProjectTypeBadge type={r.project.projectType} compact /> },
    {
      key: 'score',
      header: '점수',
      cell: (r) => (
        <span className="text-sm font-bold text-slate-800">{scoreLabel(r.assessment)}</span>
      ),
    },
    {
      key: 'recommendation',
      header: '판정',
      className: 'min-w-[140px]',
      cell: (r) =>
        r.assessment.analysisKind === 'website' ? (
          <span className="text-[13px] text-slate-500">홈페이지 준비도</span>
        ) : (
          <AssessmentRecommendationBadge recommendation={r.assessment.recommendation} withIcon={false} />
        ),
    },
    {
      key: 'confidence',
      header: '신뢰도',
      className: 'hidden lg:table-cell',
      cell: (r) => <AssessmentConfidenceBadge confidence={r.assessment.confidence} />,
    },
    {
      key: 'status',
      header: '상태',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <AssessmentStatusBadge status={r.assessment.status} />
          {r.needsReanalysis && (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-warning-700">
              <RefreshCw aria-hidden="true" className="size-3" />
              재분석
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'version',
      header: '버전',
      className: 'hidden xl:table-cell',
      cell: (r) => <span className="text-[0.875rem] text-slate-400">v{r.assessment.version}</span>,
    },
    {
      key: 'updated',
      header: '최근 분석',
      className: 'hidden lg:table-cell',
      cell: (r) => <span className="text-[13px] text-slate-500">{formatDate(r.assessment.updatedAt)}</span>,
    },
    {
      key: 'owner',
      header: '담당자',
      className: 'hidden xl:table-cell',
      cell: (r) => <span className="text-[13px] text-slate-600">{memberName(r.project.ownerId)}</span>,
    },
  ]

  const hasActiveFilters = query !== '' || status !== '' || type !== '' || sort !== 'recent'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="진단 결과"
        description="고객사별 AX 적합성 분석과 홈페이지 제작 준비도 결과를 관리합니다."
      />
      <DiagnosisStudioNav />

      <SummaryStrip
        ariaLabel="진단 결과 요약"
        items={[
          { key: 'draft', label: '분석 초안', value: counts.draft, unit: '건', tone: 'warning', icon: FlaskConical },
          { key: 'reviewed', label: '내부 검토', value: counts.reviewed, unit: '건', tone: 'info', icon: ScanSearch },
          { key: 'finalized', label: '진단 확정', value: counts.finalized, unit: '건', tone: 'success', icon: ClipboardCheck },
          { key: 'reanalysis', label: '재분석 필요', value: counts.reanalysis, unit: '건', tone: 'warning', icon: RefreshCw },
          { key: 'deferred', label: '구축 보류', value: counts.deferred, unit: '건', tone: 'danger', icon: TrendingDown },
        ]}
      />

      <FilterBar
        searchValue={query}
        searchPlaceholder="고객사·프로젝트·업종 검색"
        onSearchChange={setQuery}
        selects={[
          {
            key: 'status',
            ariaLabel: '상태 필터',
            value: status,
            placeholder: '전체 상태',
            options: [
              { value: 'draft', label: '분석 초안' },
              { value: 'reviewed', label: '내부 검토' },
              { value: 'finalized', label: '진단 확정' },
            ],
            onChange: setStatus,
          },
          {
            key: 'type',
            ariaLabel: '유형 필터',
            value: type,
            placeholder: '전체 유형',
            options: [
              { value: 'ax', label: 'AX' },
              { value: 'ax_website', label: 'AX+홈페이지' },
              { value: 'website', label: '홈페이지' },
            ],
            onChange: setType,
          },
          {
            key: 'sort',
            ariaLabel: '정렬',
            value: sort === 'recent' ? '' : sort,
            placeholder: '최근 분석순',
            options: [
              { value: 'score_desc', label: '점수 높은 순' },
              { value: 'score_asc', label: '점수 낮은 순' },
              { value: 'client_name', label: '고객사명순' },
            ],
            onChange: (v) => setSort(v === '' ? 'recent' : v),
          },
        ]}
        onReset={() => {
          setQuery('')
          setStatus('')
          setType('')
          setSort('recent')
        }}
        resultCount={filtered.length}
        hasActiveFilters={hasActiveFilters}
      />

      <Panel title={`진단 결과 (${filtered.length})`} flush>
        {filtered.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              icon={ClipboardCheck}
              title="조건에 맞는 결과가 없습니다"
              description="필터를 조정해 다시 확인해 보세요."
            />
          ) : (
            <GuidedEmptyState
              icon={ClipboardCheck}
              title="아직 진단 결과가 없습니다"
              reason="설문 응답이 제출되면 대표자와 현장 담당자의 답변을 비교해 AX 도입 적합성을 계산할 수 있습니다."
              flowPosition="1단계 · 기업 진단"
              prereqs={[
                { label: '설문 구성', done: false },
                { label: '테스트 링크로 응답 받기', done: false },
                { label: '진단 결과 만들기', done: false },
              ]}
              primaryLabel="응답 현황 확인"
              onPrimary={() => navigate('/diagnosis/surveys')}
              sampleLabel="샘플 진단 결과 보기"
              onSample={() => demo.start()}
            />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(r) => r.assessment.id}
                rowAriaLabel={(r) => `${r.project.name} 진단 결과`}
                onRowClick={goTo}
              />
            </div>
            <ul className="flex flex-col divide-y divide-slate-100 lg:hidden">
              {filtered.map((r) => (
                <li key={r.assessment.id}>
                  <button
                    type="button"
                    onClick={() => goTo(r)}
                    className="flex w-full flex-col gap-1.5 px-5 py-3.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                        {r.organization?.name} · {r.project.name}
                      </p>
                      <span className="shrink-0 text-sm font-bold text-slate-800">
                        {scoreLabel(r.assessment)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ProjectTypeBadge type={r.project.projectType} compact />
                      <AssessmentStatusBadge status={r.assessment.status} />
                      {r.assessment.analysisKind !== 'website' && (
                        <AssessmentRecommendationBadge
                          recommendation={r.assessment.recommendation}
                          withIcon={false}
                        />
                      )}
                      {r.needsReanalysis && (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-warning-700">
                          <RefreshCw aria-hidden="true" className="size-3" />
                          재분석
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
}
