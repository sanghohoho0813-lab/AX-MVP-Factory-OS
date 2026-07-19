import {
  Archive,
  Copy,
  Eye,
  FileStack,
  GitBranch,
  Pencil,
  Plus,
  Send,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SurveyTemplate, TemplateFilters } from '../../types/survey'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDate } from '../../lib/format'
import {
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
  TEMPLATE_STATUS_META,
} from '../../lib/surveyMeta'
import { surveyTemplateRepository } from '../../repositories'
import {
  calculateTemplateQuality,
  publishTemplate,
} from '../../services/surveyTemplateService'
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
  RespondentRoleBadge,
  TemplateStatusBadge,
} from '../../components/diagnosis/badges'
import { useToast } from '../../components/ui/toastContext'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

function questionCount(template: SurveyTemplate): number {
  return template.sections.reduce((n, s) => n + s.placements.length, 0)
}

function QualityDot({ template }: { template: SurveyTemplate }) {
  const { verdict } = calculateTemplateQuality(template)
  const meta = {
    passed: { icon: CheckCircle2, className: 'text-success-500', label: '통과' },
    warning: { icon: AlertTriangle, className: 'text-warning-500', label: '주의' },
    error: { icon: XCircle, className: 'text-danger-500', label: '오류' },
  }[verdict]
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-slate-600" title={`품질 ${meta.label}`}>
      <meta.icon aria-hidden="true" className={`size-4 ${meta.className}`} />
      {meta.label}
    </span>
  )
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const [filters, setFilters] = useState<{
    query: string
    role: string
    status: string
  }>({ query: '', role: '', status: '' })
  const [publishBlocked, setPublishBlocked] = useState<SurveyTemplate | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<SurveyTemplate | null>(null)

  const rows = useMemo(
    () =>
      surveyTemplateRepository
        .search({
          query: filters.query,
          respondentRole: (filters.role || undefined) as
            | TemplateFilters['respondentRole'],
          status: (filters.status || undefined) as TemplateFilters['status'],
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, version],
  )

  const summary = useMemo(() => {
    const all = surveyTemplateRepository.getAll()
    const warned = all.filter(
      (t) => calculateTemplateQuality(t).verdict !== 'passed',
    ).length
    return {
      total: all.length,
      draft: all.filter((t) => t.status === 'draft').length,
      published: all.filter((t) => t.status === 'published').length,
      warned,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const hasActiveFilters =
    filters.query !== '' || filters.role !== '' || filters.status !== ''

  const handleEdit = (template: SurveyTemplate) => {
    if (template.status === 'published') {
      showToast(
        '게시된 템플릿은 기존 프로젝트의 일관성을 위해 직접 수정하지 않습니다. 새 버전을 생성해 수정하세요.',
      )
      return
    }
    navigate(`/diagnosis/templates/${template.id}/edit`)
  }

  const handlePublish = (template: SurveyTemplate) => {
    try {
      publishTemplate(template.id)
      showToast(`${template.name} 템플릿을 게시했습니다.`)
    } catch {
      setPublishBlocked(template)
    }
  }

  const handleClone = (template: SurveyTemplate) => {
    const cloned = surveyTemplateRepository.cloneAsDraft(template.id)
    showToast(`${cloned.name} (으)로 복제했습니다.`)
    navigate(`/diagnosis/templates/${cloned.id}/edit`)
  }

  const handleNewVersion = (template: SurveyTemplate) => {
    const next = surveyTemplateRepository.createNewVersion(template.id)
    showToast(`새 버전(v${next.version}) 초안을 생성했습니다.`)
    navigate(`/diagnosis/templates/${next.id}/edit`)
  }

  const handleArchive = () => {
    if (!archiveTarget) return
    surveyTemplateRepository.archive(archiveTarget.id)
    showToast(`${archiveTarget.name} 템플릿을 보관했습니다.`)
    setArchiveTarget(null)
  }

  const rowMenu = (template: SurveyTemplate) => (
    <DropdownMenu
      ariaLabel={`${template.name} 더보기 메뉴`}
      items={[
        {
          key: 'edit',
          label: '편집',
          icon: Pencil,
          onSelect: () => handleEdit(template),
        },
        {
          key: 'preview',
          label: '미리보기',
          icon: Eye,
          onSelect: () => navigate(`/diagnosis/templates/${template.id}/preview`),
        },
        ...(template.status === 'draft'
          ? [
              {
                key: 'publish',
                label: '게시',
                icon: Send,
                onSelect: () => handlePublish(template),
              },
            ]
          : []),
        {
          key: 'clone',
          label: '복제',
          icon: Copy,
          onSelect: () => handleClone(template),
        },
        ...(template.status === 'published'
          ? [
              {
                key: 'version',
                label: '새 버전 만들기',
                icon: GitBranch,
                onSelect: () => handleNewVersion(template),
              },
            ]
          : []),
        {
          key: 'archive',
          label: '보관',
          icon: Archive,
          danger: true,
          onSelect: () => setArchiveTarget(template),
        },
      ]}
    />
  )

  const columns: DataTableColumn<SurveyTemplate>[] = [
    {
      key: 'name',
      header: '템플릿명',
      className: 'min-w-[200px]',
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{t.description}</p>
        </div>
      ),
    },
    { key: 'role', header: '응답자', cell: (t) => <RespondentRoleBadge role={t.respondentRole} /> },
    {
      key: 'sections',
      header: '섹션',
      className: 'hidden xl:table-cell text-center',
      cell: (t) => <span className="text-[13px] text-slate-600">{t.sections.length}</span>,
    },
    {
      key: 'questions',
      header: '문항',
      className: 'text-center',
      cell: (t) => <span className="text-[13px] text-slate-600">{questionCount(t)}</span>,
    },
    {
      key: 'minutes',
      header: '예상시간',
      className: 'hidden lg:table-cell',
      cell: (t) => <span className="text-[13px] text-slate-600">약 {t.estimatedMinutes}분</span>,
    },
    {
      key: 'quality',
      header: '품질',
      className: 'hidden lg:table-cell',
      cell: (t) => <QualityDot template={t} />,
    },
    {
      key: 'status',
      header: '상태',
      cell: (t) => (
        <div className="flex items-center gap-1.5">
          <TemplateStatusBadge status={t.status} />
          <span className="text-xs text-slate-400">v{t.version}</span>
        </div>
      ),
    },
    {
      key: 'updated',
      header: '최근 수정',
      className: 'hidden 2xl:table-cell',
      cell: (t) => (
        <span className="text-[13px] whitespace-nowrap text-slate-500">
          {formatDate(t.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (t) => rowMenu(t),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="설문 템플릿"
        description="대표자·관리자·현장 담당자별 진단 설문의 기본 구조를 관리합니다."
        actions={
          <Button variant="primary" onClick={() => navigate('/diagnosis/templates/new')}>
            <Plus aria-hidden="true" className="size-4" />
            새 템플릿
          </Button>
        }
      />
      <DiagnosisStudioNav />

      <SummaryStrip
        ariaLabel="템플릿 요약"
        items={[
          { key: 'total', label: '전체 템플릿', value: summary.total, unit: '개', tone: 'info', icon: FileStack },
          { key: 'draft', label: '초안', value: summary.draft, unit: '개', tone: 'neutral', icon: Pencil },
          { key: 'published', label: '게시', value: summary.published, unit: '개', tone: 'success', icon: Send },
          { key: 'warned', label: '품질 경고', value: summary.warned, unit: '개', tone: 'warning', icon: AlertTriangle },
        ]}
      />

      <FilterBar
        searchValue={filters.query}
        searchPlaceholder="템플릿명, 설명 검색"
        onSearchChange={(v) => setFilters((p) => ({ ...p, query: v }))}
        hasActiveFilters={hasActiveFilters}
        resultCount={rows.length}
        resultUnit="개"
        onReset={() => setFilters({ query: '', role: '', status: '' })}
        selects={[
          {
            key: 'role',
            ariaLabel: '응답자 필터',
            value: filters.role,
            placeholder: '응답자',
            options: RESPONDENT_ROLES.map((r) => ({
              value: r,
              label: RESPONDENT_ROLE_META[r].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, role: v })),
          },
          {
            key: 'status',
            ariaLabel: '상태 필터',
            value: filters.status,
            placeholder: '상태',
            options: (['draft', 'published'] as const).map((s) => ({
              value: s,
              label: TEMPLATE_STATUS_META[s].label,
            })),
            onChange: (v) => setFilters((p) => ({ ...p, status: v })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={FileStack}
            title="조건에 맞는 템플릿이 없습니다"
            description="새 템플릿을 만들거나 필터를 조정하세요."
            action={
              <Button variant="primary" onClick={() => navigate('/diagnosis/templates/new')}>
                <Plus aria-hidden="true" className="size-4" />새 템플릿
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
              rowKey={(t) => t.id}
              rowAriaLabel={(t) => `${t.name} 미리보기`}
              onRowClick={(t) => navigate(`/diagnosis/templates/${t.id}/preview`)}
            />
          </div>
          <ul className="flex flex-col gap-3 lg:hidden">
            {rows.map((t) => (
              <li
                key={t.id}
                className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/diagnosis/templates/${t.id}/preview`)}
                    className="min-w-0 cursor-pointer text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{t.description}</p>
                  </button>
                  {rowMenu(t)}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <RespondentRoleBadge role={t.respondentRole} />
                  <TemplateStatusBadge status={t.status} />
                  <span className="text-xs text-slate-400">
                    문항 {questionCount(t)}개 · 약 {t.estimatedMinutes}분
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmModal
        open={publishBlocked !== null}
        title="게시할 수 없습니다"
        message="이 템플릿에는 해결해야 할 품질 오류가 있습니다. 편집 화면의 품질검사에서 오류를 먼저 해결해 주세요."
        confirmLabel="편집 열기"
        cancelLabel="닫기"
        onConfirm={() => {
          const target = publishBlocked
          setPublishBlocked(null)
          if (target) navigate(`/diagnosis/templates/${target.id}/edit`)
        }}
        onCancel={() => setPublishBlocked(null)}
      />

      <ConfirmModal
        open={archiveTarget !== null}
        title="템플릿 보관"
        message={`${archiveTarget?.name ?? ''} 템플릿을 보관할까요?`}
        confirmLabel="보관"
        danger
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  )
}
