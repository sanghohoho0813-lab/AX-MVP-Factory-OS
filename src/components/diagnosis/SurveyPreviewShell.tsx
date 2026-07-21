import { ChevronLeft, ChevronRight, Monitor, Smartphone } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RespondentRole } from '../../types'
import type { ResolvedSection } from '../../services/surveyComposition'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { Button } from '../ui/Button'
import { RespondentRoleBadge } from './badges'
import { SurveyQuestionRenderer } from './renderers/SurveyQuestionRenderer'
import {
  evaluateCondition,
  type RenderQuestion,
  type SurveyAnswer,
} from './renderers/types'

interface SurveyPreviewShellProps {
  sections: ResolvedSection[]
  respondentRole: RespondentRole
  estimatedMinutes: number
  title: string
  onExit: () => void
}

type ViewMode = 'desktop' | 'mobile'

/**
 * 내부 검수용 설문 미리보기.
 * 실제 고객 제출이 아니라 화면 상태에만 입력을 유지하며,
 * 조건부 질문 표시를 시뮬레이션한다.
 */
export function SurveyPreviewShell({
  sections,
  respondentRole,
  estimatedMinutes,
  title,
  onExit,
}: SurveyPreviewShellProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({})
  const [sectionIndex, setSectionIndex] = useState(0)

  const visibleSections = useMemo(
    () => sections.filter((s) => s.placements.some((p) => p.question !== null)),
    [sections],
  )

  const total = visibleSections.length
  const safeIndex = Math.min(sectionIndex, Math.max(0, total - 1))
  const section = visibleSections[safeIndex]

  const setAnswer = (questionId: string, answer: SurveyAnswer) =>
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))

  if (total === 0) {
    return (
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        미리보기할 질문이 없습니다.
      </div>
    )
  }

  // 조건부 질문 표시 시뮬레이션
  const placements = section.placements.filter((p) => {
    if (!p.question) return false
    return evaluateCondition(p.condition, answers[p.condition?.sourceQuestionId ?? ''])
  })

  let questionNumber = 0

  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      {/* 미리보기 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <RespondentRoleBadge role={respondentRole} />
          <span className="text-[13px] text-slate-500">
            예상 약 {estimatedMinutes}분 · {RESPONDENT_ROLE_META[respondentRole].label}용 미리보기
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-(--radius-control) border border-slate-200 p-0.5">
            <button
              type="button"
              aria-label="데스크톱 보기"
              aria-pressed={viewMode === 'desktop'}
              onClick={() => setViewMode('desktop')}
              className={`flex size-8 cursor-pointer items-center justify-center rounded-md ${
                viewMode === 'desktop'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Monitor aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="모바일 보기"
              aria-pressed={viewMode === 'mobile'}
              onClick={() => setViewMode('mobile')}
              className={`flex size-8 cursor-pointer items-center justify-center rounded-md ${
                viewMode === 'mobile'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Smartphone aria-hidden="true" className="size-4" />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={onExit}>
            미리보기 종료
          </Button>
        </div>
      </div>

      {/* 진행률 */}
      <div className="border-b border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between text-[0.875rem] text-slate-500">
          <span>
            섹션 {safeIndex + 1} / {total} · {section.title}
          </span>
          <span aria-live="polite">
            {Math.round(((safeIndex + 1) / total) * 100)}% 진행
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={safeIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="설문 진행률"
        >
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${((safeIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* 설문 본문 */}
      <div className="bg-slate-50 px-4 py-6">
        <div
          className={`mx-auto bg-white ${
            viewMode === 'mobile'
              ? 'max-w-sm rounded-[20px] border-4 border-slate-200 px-4 py-5 shadow-sm'
              : 'max-w-2xl rounded-(--radius-panel) border border-slate-200 px-6 py-6'
          }`}
        >
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-sm font-medium text-slate-700">{section.title}</p>
            {section.description && (
              <p className="mt-1 text-[13px] break-keep text-slate-500">
                {section.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {placements.map((p) => {
              questionNumber += 1
              return (
                <SurveyQuestionRenderer
                  key={p.placementId}
                  index={questionNumber}
                  required={p.required}
                  question={p.question as RenderQuestion}
                  answer={answers[p.questionId]}
                  onAnswer={(a) => setAnswer(p.questionId, a)}
                />
              )
            })}
            {placements.length === 0 && (
              <p className="text-[13px] text-slate-400">
                이 섹션의 질문은 이전 답변 조건에 따라 표시됩니다.
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={safeIndex === 0}
              onClick={() => setSectionIndex(safeIndex - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              이전
            </Button>
            {safeIndex < total - 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSectionIndex(safeIndex + 1)}
              >
                다음
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={onExit}>
                미리보기 종료
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

