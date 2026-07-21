import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  PencilLine,
  Plus,
  TimerOff,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SurveyDistribution } from '../../types/surveyRuntime'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate, formatDateTime } from '../../lib/format'
import { DISTRIBUTION_STATUSES, DISTRIBUTION_STATUS_META } from '../../lib/runtimeMeta'
import { RESPONDENT_ROLES, RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import {
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import { buildSurveyUrl } from '../../services/surveyTokenService'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { LocalTestModeBanner } from '../../components/runtime/LocalTestModeBanner'
import { SurveyDistributionStatusBadge } from '../../components/runtime/badges'
import { SurveyLinkCreateModal } from '../../components/runtime/SurveyLinkCreateModal'
import { RespondentRoleBadge } from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'

interface Row {
  distribution: SurveyDistribution
  orgName: string
  projectName: string
  progress: number
  lastSaved: string | null
}

const SORT_OPTIONS = [
  { value: 'issued', label: '최근 발급순' },
  { value: 'activity', label: '최근 활동순' },
  { value: 'expiry', label: '만료 임박순' },
  { value: 'progress', label: '진행률 높은 순' },
  { value: 'org', label: '고객사명순' },
]

export function SurveysMainPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [modalOpen, setModalOpen] = useState(false)
  const [filters, setFilters] = useState({
    query: '',
    status: '',
    role: '',
    sort: 'issued',
  })

  const rows = useMemo<Row[]>(() => {
    const dists = surveyDistributionRepository.getAll()
    const orgs = new Map(
      organizationRepository.getAll(true).map((o) => [o.id, o.name]),
    )
    const projects = new Map(
      projectRepository.getAll().map((p) => [p.id, p.name]),
    )
    let result: Row[] = dists.map((d) => {
      const response = surveyResponseRepository.getByDistributionId(d.id)
      return {
        distribution: d,
        orgName: orgs.get(d.organizationId) ?? '알 수 없음',
        projectName: projects.get(d.projectId) ?? '알 수 없음',
        progress:
          d.status === 'submitted' ? 100 : (response?.progressPercent ?? 0),
        lastSaved: response?.lastSavedAt ?? null,
      }
    })

    const q = filters.query.trim().toLowerCase()
    result = result.filter((r) => {
      if (filters.status && r.distribution.status !== filters.status) return false
      if (filters.role && r.distribution.respondentRole !== filters.role) {
        return false
      }
      if (q) {
        const hay = [
          r.orgName,
          r.projectName,
          r.distribution.surveyTitle,
          r.distribution.recipientName,
          r.distribution.recipientPosition,
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    result.sort((a, b) => {
      switch (filters.sort) {
        case 'activity':
          return b.distribution.updatedAt.localeCompare(a.distribution.updatedAt)
        case 'expiry':
          return (
            (a.distribution.expiresAt ?? '9999').localeCompare(
              b.distribution.expiresAt ?? '9999',
            )
          )
        case 'progress':
          return b.progress - a.progress
        case 'org':
          return a.orgName.localeCompare(b.orgName, 'ko')
        default:
          return b.distribution.issuedAt.localeCompare(a.distribution.issuedAt)
      }
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, version])

  const summary = useMemo(() => {
    const all = surveyDistributionRepository.getAll()
    return {
      waiting: all.filter((d) => d.status === 'issued' || d.status === 'opened').length,
      inProgress: all.filter((d) => d.status === 'in_progress').length,
      submitted: all.filter((d) => d.status === 'submitted').length,
      inactive: all.filter((d) => d.status === 'expired' || d.status === 'revoked').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const totalCount = surveyDistributionRepository.getAll().length

  const copyLink = async (d: SurveyDistribution) => {
    const url = buildSurveyUrl(d.accessToken)
    try {
      await navigator.clipboard?.writeText(url)
      showToast('테스트 링크를 복사했습니다.')
    } catch {
      showToast('복사에 실패했습니다. 링크 상세에서 직접 복사해 주세요.')
    }
  }

  const rowMenu = (d: SurveyDistribution) => (
    <DropdownMenu
      ariaLabel={`${d.recipientName} 링크 더보기`}
      items={[
        {
          key: 'detail',
          label: '상세 보기',
          icon: Eye,
          onSelect: () => navigate(`/diagnosis/surveys/${d.id}`),
        },
        {
          key: 'open',
          label: '응답자 화면 열기',
          icon: ExternalLink,
          onSelect: () => window.open(buildSurveyUrl(d.accessToken), '_blank'),
        },
        {
          key: 'copy',
          label: '테스트 링크 복사',
          icon: Copy,
          onSelect: () => copyLink(d),
        },
      ]}
    />
  )

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'org',
      header: '고객사',
      cell: (r) => (
        <span className="text-[13px] font-medium text-slate-700">{r.orgName}</span>
      ),
    },
    {
      key: 'project',
      header: '프로젝트',
      className: 'hidden xl:table-cell',
      cell: (r) => (
        <span className="block max-w-40 truncate text-[13px] text-slate-600">
          {r.projectName}
        </span>
      ),
    },
    {
      key: 'survey',
      header: '설문',
      cell: (r) => (
        <span className="block max-w-48 truncate text-[13px] text-slate-700">
          {r.distribution.surveyTitle}
        </span>
      ),
    },
    {
      key: 'recipient',
      header: '응답자',
      cell: (r) => (
        <span className="text-[13px] text-slate-600">
          {r.distribution.recipientName}
        </span>
      ),
    },
    {
      key: 'role',
      header: '역할',
      className: 'hidden 2xl:table-cell',
      cell: (r) => <RespondentRoleBadge role={r.distribution.respondentRole} />,
    },
    {
      key: 'status',
      header: '상태',
      cell: (r) => <SurveyDistributionStatusBadge status={r.distribution.status} />,
    },
    {
      key: 'progress',
      header: '진행률',
      className: 'w-32',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={r.progress} tone="info" label="응답 진행률" />
          <span className="w-9 shrink-0 text-right text-[0.875rem] font-semibold text-slate-600">
            {r.progress}%
          </span>
        </div>
      ),
    },
    {
      key: 'saved',
      header: '마지막 저장',
      className: 'hidden lg:table-cell',
      cell: (r) => (
        <span className="text-[0.875rem] whitespace-nowrap text-slate-500">
          {r.lastSaved ? formatDateTime(r.lastSaved) : '-'}
        </span>
      ),
    },
    {
      key: 'expiry',
      header: '만료일',
      className: 'hidden xl:table-cell',
      cell: (r) => (
        <span className="text-[0.875rem] whitespace-nowrap text-slate-500">
          {r.distribution.expiresAt ? formatDate(r.distribution.expiresAt) : '없음'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (r) => rowMenu(r.distribution),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="설문 발급·응답관리"
        description="준비 완료된 설문을 응답자별 테스트 링크로 발급하고 작성 현황과 제출 결과를 관리합니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/diagnosis')}>
              진단 스튜디오로 이동
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              테스트 링크 생성
            </Button>
          </>
        }
      />
      <DiagnosisStudioNav />
      <LocalTestModeBanner />

      <SummaryStrip
        ariaLabel="설문 응답 요약"
        items={[
          { key: 'w', label: '응답 대기', value: summary.waiting, unit: '건', tone: 'info', icon: Clock3 },
          { key: 'p', label: '작성 중', value: summary.inProgress, unit: '건', tone: 'warning', icon: PencilLine },
          { key: 's', label: '제출 완료', value: summary.submitted, unit: '건', tone: 'success', icon: CheckCircle2 },
          { key: 'x', label: '만료·회수', value: summary.inactive, unit: '건', tone: 'neutral', icon: TimerOff },
        ]}
      />

      <FilterBar
        searchValue={filters.query}
        searchPlaceholder="고객사, 프로젝트, 설문, 응답자 검색"
        onSearchChange={(v) => setFilters((p) => ({ ...p, query: v }))}
        hasActiveFilters={filters.query !== '' || filters.status !== '' || filters.role !== ''}
        resultCount={rows.length}
        resultUnit="건"
        onReset={() => setFilters({ query: '', status: '', role: '', sort: filters.sort })}
        selects={[
          {
            key: 'status',
            ariaLabel: '설문 상태 필터',
            value: filters.status,
            placeholder: '설문 상태',
            options: DISTRIBUTION_STATUSES.map((s) => ({
              value: s,
              label: DISTRIBUTION_STATUS_META[s].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, status: v })),
          },
          {
            key: 'role',
            ariaLabel: '응답자 역할 필터',
            value: filters.role,
            placeholder: '응답자 역할',
            options: RESPONDENT_ROLES.map((r) => ({
              value: r,
              label: RESPONDENT_ROLE_META[r].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, role: v })),
          },
          {
            key: 'sort',
            ariaLabel: '정렬',
            value: filters.sort,
            placeholder: '최근 발급순',
            options: SORT_OPTIONS.filter((o) => o.value !== 'issued'),
            onChange: (v) => setFilters((p) => ({ ...p, sort: v })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Link2}
            title={totalCount === 0 ? '발급된 테스트 링크가 없습니다' : '조건에 맞는 링크가 없습니다'}
            description={
              totalCount === 0
                ? '준비 완료된 프로젝트 설문에서 첫 테스트 링크를 생성하세요. 링크와 응답은 이 브라우저에만 저장됩니다.'
                : '검색어 또는 필터를 조정해 보세요.'
            }
            action={
              totalCount === 0 ? (
                <Button variant="primary" onClick={() => setModalOpen(true)}>
                  <Plus aria-hidden="true" className="size-4" />첫 테스트 링크 생성
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setFilters({ query: '', status: '', role: '', sort: filters.sort })}
                >
                  필터 초기화
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.distribution.id}
              rowAriaLabel={(r) => `${r.distribution.recipientName} 링크 상세`}
              onRowClick={(r) => navigate(`/diagnosis/surveys/${r.distribution.id}`)}
            />
          </div>
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((r) => (
              <li
                key={r.distribution.id}
                className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/diagnosis/surveys/${r.distribution.id}`)}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {r.orgName} · {r.distribution.recipientName}
                    </p>
                    <p className="mt-0.5 truncate text-[0.875rem] text-slate-400">
                      {r.distribution.surveyTitle}
                    </p>
                  </button>
                  {rowMenu(r.distribution)}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <SurveyDistributionStatusBadge status={r.distribution.status} />
                  <RespondentRoleBadge role={r.distribution.respondentRole} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <ProgressBar value={r.progress} tone="info" label="응답 진행률" />
                  <span className="shrink-0 text-[0.875rem] font-semibold text-slate-600">
                    {r.progress}%
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(buildSurveyUrl(r.distribution.accessToken), '_blank')}
                    className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-brand-600"
                  >
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                    응답자 화면
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/diagnosis/surveys/${r.distribution.id}`)}
                    className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand-600"
                  >
                    상세
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <SurveyLinkCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onViewDetail={(d) => navigate(`/diagnosis/surveys/${d.id}`)}
      />
    </div>
  )
}
