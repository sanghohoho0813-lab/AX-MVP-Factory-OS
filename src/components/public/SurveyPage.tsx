import type { SnapshotPlacement } from '../../types/survey'
import type { SurveyAnswerValue } from '../../types/surveyRuntime'
import type { PublicSurveyPage } from '../../services/surveyRuntimeService'
import { answerToValue, valueToAnswer } from '../../services/surveyAnswerBridge'
import { SurveyQuestionRenderer } from '../diagnosis/renderers/SurveyQuestionRenderer'
import type {
  RenderQuestion,
  SurveyAnswer,
} from '../diagnosis/renderers/types'

interface SurveyPageProps {
  page: PublicSurveyPage
  /** 페이지 첫 문항 시작 번호 (전체 통산) */
  startNumber: number
  answers: Map<string, SurveyAnswerValue>
  onAnswer: (questionId: string, value: SurveyAnswerValue) => void
  errorQuestionIds: Set<string>
}

function toRenderQuestion(p: SnapshotPlacement): RenderQuestion {
  return {
    id: p.questionId,
    text: p.questionText,
    helpText: p.helpText,
    example: p.example,
    type: p.type,
    options: p.options,
    repeatTableColumns: p.repeatTableColumns,
  }
}

export function SurveyPage({
  page,
  startNumber,
  answers,
  onAnswer,
  errorQuestionIds,
}: SurveyPageProps) {
  return (
    <div className="flex flex-col gap-6">
      {page.sectionDescription && page.pageInSection === 1 && (
        <p className="text-[13px] break-keep text-slate-500">
          {page.sectionDescription}
        </p>
      )}
      {page.placements.map((placement, index) => {
        const rq = toRenderQuestion(placement)
        const fallbackOrder = [...placement.options]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => o.value)
        const answer: SurveyAnswer = valueToAnswer(
          answers.get(placement.questionId) ?? null,
          placement.type,
          fallbackOrder,
        )
        const hasError = errorQuestionIds.has(placement.questionId)
        return (
          <div
            key={placement.id}
            id={`q-${placement.questionId}`}
            className={`scroll-mt-24 rounded-(--radius-panel) border bg-white px-5 py-5 ${
              hasError ? 'border-danger-300' : 'border-slate-200'
            }`}
          >
            <SurveyQuestionRenderer
              index={startNumber + index}
              required={placement.required}
              question={rq}
              answer={answer}
              onAnswer={(a) => onAnswer(placement.questionId, answerToValue(a))}
            />
            {placement.example && placement.type !== 'short_text' && placement.type !== 'long_text' && (
              <p className="mt-2 text-xs text-slate-400">예시: {placement.example}</p>
            )}
            {hasError && (
              <p className="mt-2 text-xs font-medium text-danger-600" role="alert">
                필수 응답 문항입니다.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
