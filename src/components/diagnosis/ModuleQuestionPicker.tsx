import { ChevronDown, ChevronUp, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Question, QuestionScope } from '../../types/survey'
import { normalizeQuery } from '../../lib/format'
import { QUESTION_SCOPES, QUESTION_SCOPE_META } from '../../lib/surveyMeta'
import { questionRepository } from '../../repositories'
import { QuestionCategoryBadge, QuestionScopeBadge, QuestionTypeBadge } from './badges'

interface ModuleQuestionPickerProps {
  questionIds: string[]
  onChange: (ids: string[]) => void
  /** 우선 추천할 범위 (모듈 종류에 맞춰) */
  preferredScope?: QuestionScope
}

/** 모듈에 연결할 질문을 검색·추가·정렬하는 편집기 */
export function ModuleQuestionPicker({
  questionIds,
  onChange,
  preferredScope,
}: ModuleQuestionPickerProps) {
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string>(preferredScope ?? '')

  const allQuestions = useMemo(() => questionRepository.getAll(), [])
  const byId = useMemo(
    () => new Map(allQuestions.map((q) => [q.id, q])),
    [allQuestions],
  )

  const connected = questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined)

  const normalized = normalizeQuery(query)
  const candidates = allQuestions
    .filter((q) => !questionIds.includes(q.id))
    .filter((q) => (scopeFilter ? q.scope === scopeFilter : true))
    .filter((q) =>
      normalized
        ? `${q.code} ${q.text}`.toLowerCase().includes(normalized)
        : true,
    )
    .sort((a, b) => {
      if (preferredScope) {
        const aPref = a.scope === preferredScope ? 0 : 1
        const bPref = b.scope === preferredScope ? 0 : 1
        if (aPref !== bPref) return aPref - bPref
      }
      return a.code.localeCompare(b.code)
    })
    .slice(0, 40)

  const add = (id: string) => onChange([...questionIds, id])
  const remove = (id: string) => onChange(questionIds.filter((q) => q !== id))
  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= questionIds.length) return
    const copy = [...questionIds]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    onChange(copy)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 연결된 질문 */}
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">
            연결 질문 ({connected.length})
          </p>
        </div>
        {connected.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-slate-400">
            오른쪽에서 질문을 추가하세요.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {connected.map((q, index) => (
              <li key={q.id} className="flex items-start gap-2 px-4 py-2.5">
                <div className="flex flex-col pt-0.5">
                  <button
                    type="button"
                    aria-label={`${q.code} 위로`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${q.code} 아래로`}
                    disabled={index === connected.length - 1}
                    onClick={() => move(index, 1)}
                    className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronDown aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.875rem] font-semibold text-slate-400">
                    {q.code}
                  </span>
                  <p className="text-[13px] break-keep text-slate-700">{q.text}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <QuestionScopeBadge scope={q.scope} />
                    <QuestionTypeBadge type={q.type} />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`${q.code} 제거`}
                  onClick={() => remove(q.id)}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 질문 검색·추가 */}
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative">
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
          <select
            aria-label="범위 필터"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="h-9 rounded-(--radius-control) border border-slate-200 px-2.5 text-[13px] text-slate-700"
          >
            <option value="">모든 범위</option>
            {QUESTION_SCOPES.map((s) => (
              <option key={s} value={s}>
                {QUESTION_SCOPE_META[s].label}
              </option>
            ))}
          </select>
        </div>
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {candidates.length === 0 ? (
            <li className="px-4 py-8 text-center text-[13px] text-slate-400">
              추가할 질문이 없습니다.
            </li>
          ) : (
            candidates.map((q) => (
              <li key={q.id} className="flex items-start gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[0.875rem] font-semibold text-slate-400">
                    {q.code}
                  </span>
                  <p className="text-[13px] break-keep text-slate-700">{q.text}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <QuestionScopeBadge scope={q.scope} />
                    <QuestionCategoryBadge category={q.category} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => add(q.id)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[0.875rem] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Plus aria-hidden="true" className="size-3" />
                  추가
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
