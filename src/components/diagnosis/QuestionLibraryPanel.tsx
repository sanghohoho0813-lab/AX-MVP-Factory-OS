import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Question } from '../../types/survey'
import { normalizeQuery } from '../../lib/format'
import {
  QUESTION_CATEGORIES,
  QUESTION_CATEGORY_META,
  QUESTION_SCOPES,
  QUESTION_SCOPE_META,
  QUESTION_TYPE_META,
} from '../../lib/surveyMeta'
import { questionRepository, surveyModuleRepository } from '../../repositories'
import { QuestionCategoryBadge, QuestionScopeBadge } from './badges'

interface QuestionLibraryPanelProps {
  addedIds: Set<string>
  onAdd: (questionId: string) => void
}

/** 템플릿 빌더 좌측 질문 라이브러리 — 검색·필터·추가 */
export function QuestionLibraryPanel({ addedIds, onAdd }: QuestionLibraryPanelProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('')
  const [moduleId, setModuleId] = useState('')

  const modules = useMemo(() => surveyModuleRepository.getAll(), [])
  const questions = useMemo(() => questionRepository.getAll(), [])

  const moduleQuestionIds = useMemo(() => {
    if (!moduleId) return null
    const module = modules.find((m) => m.id === moduleId)
    return module ? new Set(module.questionIds) : new Set<string>()
  }, [moduleId, modules])

  const normalized = normalizeQuery(query)
  const filtered = questions
    .filter((q) => (category ? q.category === category : true))
    .filter((q) => (scope ? q.scope === scope : true))
    .filter((q) => (moduleQuestionIds ? moduleQuestionIds.has(q.id) : true))
    .filter((q) =>
      normalized ? `${q.code} ${q.text}`.toLowerCase().includes(normalized) : true,
    )
    .slice(0, 60)

  return (
    <div className="flex h-full flex-col rounded-(--radius-panel) border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">질문 라이브러리</p>
        <div className="relative mt-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            aria-label="질문 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="코드·질문 검색"
            className="h-9 w-full rounded-(--radius-control) border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm focus:border-brand-500 focus:bg-white"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            aria-label="범주 필터"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-(--radius-control) border border-slate-200 px-2 text-[0.875rem] text-slate-700"
          >
            <option value="">모든 범주</option>
            {QUESTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {QUESTION_CATEGORY_META[c].label}
              </option>
            ))}
          </select>
          <select
            aria-label="범위 필터"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-9 rounded-(--radius-control) border border-slate-200 px-2 text-[0.875rem] text-slate-700"
          >
            <option value="">모든 범위</option>
            {QUESTION_SCOPES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_SCOPE_META[s].label}
              </option>
            ))}
          </select>
          <select
            aria-label="모듈 필터"
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            className="col-span-2 h-9 rounded-(--radius-control) border border-slate-200 px-2 text-[0.875rem] text-slate-700"
          >
            <option value="">모든 모듈</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-slate-400">
            조건에 맞는 질문이 없습니다.
          </li>
        ) : (
          filtered.map((q: Question) => {
            const added = addedIds.has(q.id)
            return (
              <li key={q.id} className="flex items-start gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.875rem] font-semibold text-slate-400">
                    {q.code}
                  </span>
                  <p className="line-clamp-2 text-[13px] break-keep text-slate-700">
                    {q.text}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <QuestionScopeBadge scope={q.scope} />
                    <QuestionCategoryBadge category={q.category} />
                    <span className="text-[0.8125rem] text-slate-400">
                      약 {QUESTION_TYPE_META[q.type].estimateMinutes}분
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAdd(q.id)}
                  aria-label={added ? `${q.code} 이미 추가됨` : `${q.code} 추가`}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[0.875rem] font-medium ${
                    added
                      ? 'cursor-default border-success-200 bg-success-50 text-success-600'
                      : 'cursor-pointer border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {added ? (
                    <>
                      <Check aria-hidden="true" className="size-3" />
                      추가됨
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden="true" className="size-3" />
                      추가
                    </>
                  )}
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
