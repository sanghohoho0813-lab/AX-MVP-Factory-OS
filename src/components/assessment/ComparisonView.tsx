import { useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import type { ResponseComparisonItem } from '../../types/assessment'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { EmptyState } from '../ui/EmptyState'
import { GitCompareArrows } from 'lucide-react'
import {
  ComparisonImportanceBadge,
  ComparisonStatusBadge,
} from './badges'

function ComparisonCard({ item }: { item: ResponseComparisonItem }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">{item.title}</span>
        <ComparisonStatusBadge status={item.status} />
        <ComparisonImportanceBadge importance={item.importance} />
        {item.requiresInterview && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-warning-700">
            <MessageCircleQuestion aria-hidden="true" className="size-3" />
            인터뷰 필요
          </span>
        )}
      </div>
      <p className="mt-1 text-[0.875rem] text-slate-400">{item.description}</p>

      <dl className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {item.respondentValues.map((v) => (
          <div
            key={`${v.role}-${v.responseId}`}
            className="rounded-(--radius-control) border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <dt className="text-[0.875rem] font-medium text-slate-500">
              {RESPONDENT_ROLE_META[v.role].label}
              <span className="ml-1 font-normal text-slate-400">{v.respondentName}</span>
            </dt>
            <dd
              className={`mt-0.5 text-[13px] break-keep text-slate-800 ${
                expanded ? '' : 'line-clamp-2'
              }`}
            >
              {v.displayValue}
              {v.normalizedValue !== null && (
                <span className="ml-1 text-[0.875rem] text-slate-400">({v.normalizedValue}점)</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-[13px] break-keep text-slate-600">{item.interpretation}</p>
      {item.respondentValues.some((v) => v.displayValue.length > 60) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 cursor-pointer text-[0.875rem] font-medium text-brand-600 hover:text-brand-700"
        >
          {expanded ? '접기' : '전체 보기'}
        </button>
      )}
    </li>
  )
}

interface ComparisonViewProps {
  items: ResponseComparisonItem[]
}

export function ComparisonView({ items }: ComparisonViewProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={GitCompareArrows}
        title="비교할 항목이 없습니다"
        description="제출 응답이 늘어나면 응답자 간 비교가 표시됩니다."
      />
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <ComparisonCard key={item.id} item={item} />
      ))}
    </ul>
  )
}
