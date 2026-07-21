import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Lock } from 'lucide-react'
import type { CaseStudy } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { CASE_STATUS_META, CASE_STATUSES, CASE_VISIBILITY_META, CASE_VISIBILITIES } from '../../lib/fundingMeta'
import { getAllCases } from '../../services/caseStudyService'
import { CaseStatusBadge, CaseVisibilityBadge, ConsentBadge } from '../../components/funding/badges'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterBar } from '../../components/ui/FilterBar'
import { HelpNote } from '../../components/ui/HelpNote'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'

export function CasesLibraryPage() {
  const navigate = useNavigate()
  const version = useStoreVersion()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState('')

  const cases = useMemo<CaseStudy[]>(() => {
    return getAllCases()
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const filtered = cases.filter((c) => {
    if (status && c.status !== status) return false
    if (visibility && c.visibility !== visibility) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const hay = `${c.title} ${c.industry} ${c.outcomeSummary}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const hasActiveFilters = Boolean(query || status || visibility)
  const reset = () => {
    setQuery('')
    setStatus('')
    setVisibility('')
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="사례 라이브러리"
        description="실제 결과가 기록된 연계 전략에서 만든 사례를 모아 봅니다. 공개는 익명화·고객 동의 확인 후에만 가능합니다."
      />
      <HelpNote
        summary="사례는 실제 결과를 바탕으로 만들어집니다. 내부 전용 사례는 외부에 노출하지 않습니다."
        what="연계 전략의 실제 승인·부결 결과를 재사용 가능한 사례로 정리합니다."
        when="새 제안·유사 프로젝트에 참고할 사례를 찾을 때 사용합니다."
        next="사례 상세에서 익명화·동의를 확인하고 공개 범위를 관리합니다."
      />

      <FilterBar
        searchValue={query}
        searchPlaceholder="제목·업종·결과 요약 검색"
        onSearchChange={setQuery}
        selects={[
          { key: 'status', ariaLabel: '상태 필터', value: status, placeholder: '모든 상태', onChange: setStatus, options: CASE_STATUSES.map((s) => ({ value: s, label: CASE_STATUS_META[s].label })) },
          { key: 'visibility', ariaLabel: '공개범위 필터', value: visibility, placeholder: '모든 공개범위', onChange: setVisibility, options: CASE_VISIBILITIES.map((v) => ({ value: v, label: CASE_VISIBILITY_META[v].label })) },
        ]}
        onReset={reset}
        resultCount={filtered.length}
        hasActiveFilters={hasActiveFilters}
      />

      {filtered.length === 0 ? (
        <Panel title="사례" flush>
          <EmptyState
            icon={FileText}
            title={hasActiveFilters ? '조건에 맞는 사례가 없습니다' : '아직 등록된 사례가 없습니다'}
            description={
              hasActiveFilters
                ? '필터를 초기화하면 전체 사례를 볼 수 있습니다.'
                : '사례는 실제 결과(승인·부결)가 기록된 연계 전략의 결과·성과 화면에서 만들 수 있습니다.'
            }
          />
        </Panel>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(`/cases/${c.id}`)}
                className="flex h-full w-full flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left shadow-(--shadow-card) hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold break-keep text-slate-900">{c.title || '제목 없음'}</p>
                    {c.industry && <p className="mt-0.5 text-xs text-slate-400">{c.industry}</p>}
                  </div>
                  {c.visibility === 'internal' && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-danger-200 bg-danger-50 px-1.5 py-0.5 text-xs font-medium text-danger-700">
                      <Lock aria-hidden="true" className="size-3" />
                      외부 노출 금지
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CaseStatusBadge status={c.status} />
                  <CaseVisibilityBadge visibility={c.visibility} />
                  <ConsentBadge status={c.consentStatus} />
                </div>
                <p className="text-[13px] break-keep text-slate-600">{c.outcomeSummary || '결과 요약 없음'}</p>
                {c.keyProblems[0] && (
                  <p className="text-xs break-keep text-slate-500">초기 문제: {c.keyProblems[0]}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>연결 기관 {c.selectedInstitutions.length}곳</span>
                  <span>검증 성과 {c.verifiedMetrics.length}건</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
