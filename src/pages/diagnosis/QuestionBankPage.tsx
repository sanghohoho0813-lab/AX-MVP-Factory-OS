import {
  Archive,
  Copy,
  ListChecks,
  Pencil,
  Plus,
  Power,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question, QuestionSortKey } from '../../types/survey'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import {
  EXPERT_RISK_GRADES,
  EXPERT_RISK_META,
  QUESTION_CATEGORIES,
  QUESTION_CATEGORY_META,
  QUESTION_SCOPES,
  QUESTION_SCOPE_META,
  QUESTION_TYPES,
  QUESTION_TYPE_META,
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
} from '../../lib/surveyMeta'
import { questionRepository } from '../../repositories'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import {
  ExpertRiskBadge,
  QuestionCategoryBadge,
  QuestionScopeBadge,
  QuestionTypeBadge,
  RespondentRoleBadge,
} from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'
import { Building2, CircleDot, Sparkles } from 'lucide-react'

interface FilterState {
  query: string
  category: string
  type: string
  scope: string
  respondentRole: string
  risk: string
  activeState: string
  sort: QuestionSortKey
}

const EMPTY_FILTERS: FilterState = {
  query: '',
  category: '',
  type: '',
  scope: '',
  respondentRole: '',
  risk: '',
  activeState: '',
  sort: 'updated',
}

export function QuestionBankPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [archiveTarget, setArchiveTarget] = useState<Question | null>(null)

  const usageById = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of questionRepository.getAll(true)) {
      map.set(q.id, questionRepository.getUsageCount(q.id))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const rows = useMemo(() => {
    const result = questionRepository.search({
      query: filters.query,
      category: (filters.category || undefined) as Question['category'] | undefined,
      type: (filters.type || undefined) as Question['type'] | undefined,
      scope: (filters.scope || undefined) as Question['scope'] | undefined,
      respondentRole: (filters.respondentRole || undefined) as
        | Question['respondentRole']
        | undefined,
      expertRiskGrade: (filters.risk || undefined) as
        | Question['expertRiskGrade']
        | undefined,
      activeState: (filters.activeState || undefined) as
        | 'active'
        | 'inactive'
        | undefined,
    })
    const sorted = [...result]
    switch (filters.sort) {
      case 'code':
        sorted.sort((a, b) => a.code.localeCompare(b.code))
        break
      case 'usage':
        sorted.sort(
          (a, b) => (usageById.get(b.id) ?? 0) - (usageById.get(a.id) ?? 0),
        )
        break
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category))
        break
      default:
        sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, usageById, version])

  const summary = useMemo(() => {
    const all = questionRepository.getAll()
    return {
      total: all.length,
      common: all.filter((q) => q.scope === 'common').length,
      industry: all.filter((q) => q.scope === 'industry').length,
      objective: all.filter((q) => q.scope === 'objective').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const hasActiveFilters =
    filters.query !== '' ||
    filters.category !== '' ||
    filters.type !== '' ||
    filters.scope !== '' ||
    filters.respondentRole !== '' ||
    filters.risk !== '' ||
    filters.activeState !== ''

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const handleToggleActive = (question: Question) => {
    try {
      questionRepository.setActive(question.id, !question.active)
      showToast(
        question.active
          ? `${question.code} 질문을 비활성화했습니다.`
          : `${question.code} 질문을 활성화했습니다.`,
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : '변경에 실패했습니다.')
    }
  }

  const handleClone = (question: Question) => {
    try {
      const cloned = questionRepository.clone(question.id)
      showToast(`${cloned.code} (으)로 복제했습니다.`)
      navigate(`/diagnosis/questions/${cloned.id}/edit`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '복제에 실패했습니다.')
    }
  }

  const handleArchive = () => {
    if (!archiveTarget) return
    try {
      questionRepository.archive(archiveTarget.id)
      showToast(`${archiveTarget.code} 질문을 보관했습니다.`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '보관에 실패했습니다.')
    }
    setArchiveTarget(null)
  }

  const rowMenu = (question: Question) => (
    <DropdownMenu
      ariaLabel={`${question.code} 더보기 메뉴`}
      items={[
        {
          key: 'edit',
          label: '수정',
          icon: Pencil,
          onSelect: () => navigate(`/diagnosis/questions/${question.id}/edit`),
        },
        {
          key: 'clone',
          label: '복제',
          icon: Copy,
          onSelect: () => handleClone(question),
        },
        {
          key: 'toggle',
          label: question.active ? '비활성 전환' : '활성 전환',
          icon: Power,
          onSelect: () => handleToggleActive(question),
        },
        {
          key: 'archive',
          label: '보관',
          icon: Archive,
          danger: true,
          onSelect: () => setArchiveTarget(question),
        },
      ]}
    />
  )

  const columns: DataTableColumn<Question>[] = [
    {
      key: 'code',
      header: '코드',
      cell: (q) => (
        <span className="font-mono text-xs font-semibold whitespace-nowrap text-slate-500">
          {q.code}
        </span>
      ),
    },
    {
      key: 'text',
      header: '질문',
      className: 'min-w-[240px] max-w-md',
      cell: (q) => (
        <p className="line-clamp-2 text-[13px] break-keep text-slate-700" title={q.text}>
          {q.text}
        </p>
      ),
    },
    {
      key: 'category',
      header: '범주',
      cell: (q) => <QuestionCategoryBadge category={q.category} />,
    },
    {
      key: 'type',
      header: '유형',
      cell: (q) => <QuestionTypeBadge type={q.type} />,
    },
    {
      key: 'role',
      header: '응답자',
      className: 'hidden xl:table-cell',
      cell: (q) => <RespondentRoleBadge role={q.respondentRole} />,
    },
    {
      key: 'scope',
      header: '범위',
      cell: (q) => <QuestionScopeBadge scope={q.scope} />,
    },
    {
      key: 'risk',
      header: '전문가 위험',
      className: 'hidden 2xl:table-cell',
      cell: (q) => <ExpertRiskBadge grade={q.expertRiskGrade} />,
    },
    {
      key: 'usage',
      header: '사용',
      className: 'text-center',
      cell: (q) => (
        <span className="text-[13px] text-slate-600">{usageById.get(q.id) ?? 0}</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      cell: (q) => (
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
            q.active
              ? 'border-success-200 bg-success-50 text-success-700'
              : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {q.active ? '활성' : '비활성'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: '최근 수정',
      className: 'hidden lg:table-cell',
      cell: (q) => (
        <span className="text-[13px] whitespace-nowrap text-slate-500">
          {formatDate(q.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (q) => rowMenu(q),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="질문은행"
        description="AX 진단에 재사용할 공통·업종·목적별 질문을 관리합니다."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/diagnosis/questions/new')}
          >
            <Plus aria-hidden="true" className="size-4" />
            질문 등록
          </Button>
        }
      />
      <DiagnosisStudioNav />

      <SummaryStrip
        ariaLabel="질문은행 요약"
        items={[
          { key: 'total', label: '전체 활성 질문', value: summary.total, unit: '개', tone: 'info', icon: ListChecks },
          { key: 'common', label: '공통', value: summary.common, unit: '개', tone: 'neutral', icon: CircleDot },
          { key: 'industry', label: '업종 특화', value: summary.industry, unit: '개', tone: 'info', icon: Building2 },
          { key: 'objective', label: '목적 특화', value: summary.objective, unit: '개', tone: 'accent', icon: Sparkles },
        ]}
      />

      <FilterBar
        searchValue={filters.query}
        searchPlaceholder="코드, 질문, 도움말, 태그 검색"
        onSearchChange={(v) => set('query', v)}
        hasActiveFilters={hasActiveFilters}
        resultCount={rows.length}
        resultUnit="개"
        onReset={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
        selects={[
          {
            key: 'category',
            ariaLabel: '질문 범주 필터',
            value: filters.category,
            placeholder: '범주',
            options: QUESTION_CATEGORIES.map((c) => ({
              value: c,
              label: QUESTION_CATEGORY_META[c].label,
            })),
            onChange: (v) => set('category', v),
          },
          {
            key: 'scope',
            ariaLabel: '질문 범위 필터',
            value: filters.scope,
            placeholder: '범위',
            options: QUESTION_SCOPES.map((s) => ({
              value: s,
              label: QUESTION_SCOPE_META[s].label,
            })),
            onChange: (v) => set('scope', v),
          },
          {
            key: 'type',
            ariaLabel: '질문 유형 필터',
            value: filters.type,
            placeholder: '유형',
            options: QUESTION_TYPES.map((t) => ({
              value: t,
              label: QUESTION_TYPE_META[t].label,
            })),
            onChange: (v) => set('type', v),
          },
          {
            key: 'role',
            ariaLabel: '응답자 필터',
            value: filters.respondentRole,
            placeholder: '응답자',
            options: RESPONDENT_ROLES.map((r) => ({
              value: r,
              label: RESPONDENT_ROLE_META[r].label,
            })),
            onChange: (v) => set('respondentRole', v),
          },
          {
            key: 'risk',
            ariaLabel: '전문가 위험 필터',
            value: filters.risk,
            placeholder: '전문가 위험',
            options: EXPERT_RISK_GRADES.map((g) => ({
              value: g,
              label: EXPERT_RISK_META[g].label,
            })),
            onChange: (v) => set('risk', v),
          },
          {
            key: 'active',
            ariaLabel: '활성 상태 필터',
            value: filters.activeState,
            placeholder: '활성 상태',
            options: [
              { value: 'active', label: '활성' },
              { value: 'inactive', label: '비활성' },
            ],
            onChange: (v) => set('activeState', v),
          },
          {
            key: 'sort',
            ariaLabel: '정렬',
            value: filters.sort,
            placeholder: '최근 수정순',
            options: [
              { value: 'code', label: '질문 코드순' },
              { value: 'usage', label: '사용 많은 순' },
              { value: 'category', label: '범주순' },
            ],
            onChange: (v) => set('sort', v as QuestionSortKey),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={ListChecks}
            title="조건에 맞는 질문이 없습니다"
            description="검색어 또는 필터를 조정하거나 새 질문을 등록하세요."
            action={
              <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                필터 초기화
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) lg:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(q) => q.id}
              rowAriaLabel={(q) => `${q.code} 질문 수정`}
              onRowClick={(q) => navigate(`/diagnosis/questions/${q.id}/edit`)}
            />
          </div>

          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((q) => (
              <li
                key={q.id}
                className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/diagnosis/questions/${q.id}/edit`)}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {q.code}
                    </span>
                    <p className="mt-0.5 text-[13px] break-keep text-slate-800">
                      {q.text}
                    </p>
                  </button>
                  {rowMenu(q)}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <QuestionTypeBadge type={q.type} />
                  <QuestionCategoryBadge category={q.category} />
                  <QuestionScopeBadge scope={q.scope} />
                  <ExpertRiskBadge grade={q.expertRiskGrade} />
                  {!q.active && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                      비활성
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={archiveTarget !== null}
        title="질문 보관"
        message={`${archiveTarget?.code ?? ''} 질문을 보관할까요?`}
        warning={
          archiveTarget && (usageById.get(archiveTarget.id) ?? 0) > 0
            ? '이 질문은 현재 여러 설문에서 사용 중입니다. 보관해도 기존 설문 구조에서는 유지되지만 새로운 설문 조합에서는 기본적으로 제외됩니다.'
            : undefined
        }
        confirmLabel="보관"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
