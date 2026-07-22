import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type {
  Question,
  QuestionCondition,
  SurveySection,
  TemplateQuestionPlacement,
} from '../../types/survey'
import { generateId } from '../../storage/localStore'
import { QuestionTypeBadge } from './badges'
import { ConditionEditor } from './ConditionEditor'

interface TemplateSectionEditorProps {
  sections: SurveySection[]
  questionById: Map<string, Question>
  onChange: (sections: SurveySection[]) => void
}

function reindex<T extends { orderIndex: number }>(list: T[]): T[] {
  return list.map((item, i) => ({ ...item, orderIndex: i }))
}

/** 템플릿 섹션·질문 배치 편집기 (drag 없이 버튼·Select로 조작) */
export function TemplateSectionEditor({
  sections,
  questionById,
  onChange,
}: TemplateSectionEditorProps) {
  const ordered = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)

  // 조건 source 후보: 전역 순서상 해당 배치보다 앞에 있는 질문들
  const globalOrder: Array<{ sectionIndex: number; placement: TemplateQuestionPlacement }> = []
  ordered.forEach((section, sectionIndex) => {
    ;[...section.placements]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((placement) => globalOrder.push({ sectionIndex, placement }))
  })

  const sourceQuestionsBefore = (placementId: string): Question[] => {
    const idx = globalOrder.findIndex((g) => g.placement.id === placementId)
    if (idx < 0) return []
    return globalOrder
      .slice(0, idx)
      .map((g) => questionById.get(g.placement.questionId))
      .filter((q): q is Question => q !== undefined)
  }

  const updateSection = (id: string, patch: Partial<SurveySection>) =>
    onChange(ordered.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const addSection = () =>
    onChange(
      reindex([
        ...ordered,
        {
          id: generateId(),
          title: `새 섹션 ${ordered.length + 1}`,
          description: '',
          orderIndex: ordered.length,
          placements: [],
        },
      ]),
    )

  const removeSection = (id: string) =>
    onChange(reindex(ordered.filter((s) => s.id !== id)))

  const moveSection = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= ordered.length) return
    const copy = [...ordered]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    onChange(reindex(copy))
  }

  const updatePlacement = (
    sectionId: string,
    placementId: string,
    patch: Partial<TemplateQuestionPlacement>,
  ) =>
    onChange(
      ordered.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              placements: s.placements.map((p) =>
                p.id === placementId ? { ...p, ...patch } : p,
              ),
            }
          : s,
      ),
    )

  const removePlacement = (sectionId: string, placementId: string) =>
    onChange(
      ordered.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              placements: reindex(s.placements.filter((p) => p.id !== placementId)),
            }
          : s,
      ),
    )

  const movePlacement = (sectionId: string, index: number, dir: -1 | 1) =>
    onChange(
      ordered.map((s) => {
        if (s.id !== sectionId) return s
        const sorted = [...s.placements].sort((a, b) => a.orderIndex - b.orderIndex)
        const next = index + dir
        if (next < 0 || next >= sorted.length) return s
        ;[sorted[index], sorted[next]] = [sorted[next], sorted[index]]
        return { ...s, placements: reindex(sorted) }
      }),
    )

  const movePlacementToSection = (
    fromSectionId: string,
    placementId: string,
    toSectionId: string,
  ) => {
    if (fromSectionId === toSectionId) return
    let moved: TemplateQuestionPlacement | undefined
    const withoutMoved = ordered.map((s) => {
      if (s.id !== fromSectionId) return s
      moved = s.placements.find((p) => p.id === placementId)
      return {
        ...s,
        placements: reindex(s.placements.filter((p) => p.id !== placementId)),
      }
    })
    if (!moved) return
    onChange(
      withoutMoved.map((s) =>
        s.id === toSectionId
          ? {
              ...s,
              placements: reindex([...s.placements, { ...moved!, condition: null }]),
            }
          : s,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((section, sectionIndex) => {
        const placements = [...section.placements].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        )
        return (
          <div
            key={section.id}
            className="rounded-(--radius-panel) border border-slate-200 bg-white"
          >
            <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
              <GripVertical
                aria-hidden="true"
                className="mt-2 size-4 shrink-0 text-slate-300"
              />
              <div className="min-w-0 flex-1">
                <input
                  aria-label={`섹션 ${sectionIndex + 1} 제목`}
                  value={section.title}
                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                  className="w-full rounded-lg border border-transparent px-1 text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-brand-500"
                />
                <input
                  aria-label={`섹션 ${sectionIndex + 1} 설명`}
                  value={section.description}
                  onChange={(e) =>
                    updateSection(section.id, { description: e.target.value })
                  }
                  placeholder="섹션 설명 (선택)"
                  className="mt-0.5 w-full rounded-lg border border-transparent px-1 text-[0.875rem] text-slate-500 hover:border-slate-200 focus:border-brand-500"
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`섹션 ${sectionIndex + 1} 위로`}
                  disabled={sectionIndex === 0}
                  onClick={() => moveSection(sectionIndex, -1)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`섹션 ${sectionIndex + 1} 아래로`}
                  disabled={sectionIndex === ordered.length - 1}
                  onClick={() => moveSection(sectionIndex, 1)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronDown aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`섹션 ${sectionIndex + 1} 삭제`}
                  onClick={() => removeSection(section.id)}
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>

            {placements.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-slate-400">
                왼쪽 질문 라이브러리에서 질문을 추가하세요.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {placements.map((placement, index) => {
                  const question = questionById.get(placement.questionId)
                  const missing = !question
                  return (
                    <li key={placement.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col pt-0.5">
                          <button
                            type="button"
                            aria-label="위로"
                            disabled={index === 0}
                            onClick={() => movePlacement(section.id, index, -1)}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ChevronUp aria-hidden="true" className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="아래로"
                            disabled={index === placements.length - 1}
                            onClick={() => movePlacement(section.id, index, 1)}
                            className="flex size-5 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <ChevronDown aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-[0.875rem] font-semibold text-slate-400">
                            {question?.code ?? '삭제된 질문'}
                          </span>
                          <p
                            className={`text-[13px] break-keep ${missing ? 'text-danger-600' : 'text-slate-700'}`}
                          >
                            {question?.text ?? '참조할 수 없는 질문입니다. 제거해 주세요.'}
                          </p>
                          {question && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <QuestionTypeBadge type={question.type} />
                              <label className="flex cursor-pointer items-center gap-1 text-[0.875rem] text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={placement.required}
                                  onChange={(e) =>
                                    updatePlacement(section.id, placement.id, {
                                      required: e.target.checked,
                                    })
                                  }
                                  className="size-3.5 accent-brand-600"
                                />
                                필수
                              </label>
                              {ordered.length > 1 && (
                                <select
                                  aria-label="다른 섹션으로 이동"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      movePlacementToSection(
                                        section.id,
                                        placement.id,
                                        e.target.value,
                                      )
                                    }
                                  }}
                                  className="h-7 rounded-md border border-slate-200 px-1.5 text-[0.875rem] text-slate-500"
                                >
                                  <option value="">섹션 이동…</option>
                                  {ordered
                                    .filter((s) => s.id !== section.id)
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.title}
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                          )}
                          {question && (
                            <ConditionEditor
                              condition={placement.condition}
                              sourceQuestions={sourceQuestionsBefore(placement.id)}
                              onChange={(condition: QuestionCondition | null) =>
                                updatePlacement(section.id, placement.id, { condition })
                              }
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="질문 제거"
                          onClick={() => removePlacement(section.id, placement.id)}
                          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={addSection}
        className="flex items-center justify-center gap-1.5 rounded-(--radius-panel) border border-dashed border-slate-300 py-3 text-[13px] font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus aria-hidden="true" className="size-4" />
        섹션 추가
      </button>
    </div>
  )
}
