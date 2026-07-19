import {
  MultipleChoiceQuestion,
  ScaleQuestion,
  SingleChoiceQuestion,
} from './ChoiceQuestions'
import { FileQuestion } from './FileQuestion'
import { RankingQuestion } from './RankingQuestion'
import { RepeatTableQuestion } from './RepeatTableQuestion'
import { NumberQuestion, TextQuestion } from './TextQuestions'
import type { RendererProps } from './types'

interface SurveyQuestionRendererProps extends RendererProps {
  index: number
  required: boolean
}

/**
 * 질문 유형에 맞는 입력 UI를 렌더링한다.
 * fieldset/legend로 질문 문구와 입력을 묶어 접근성을 확보한다.
 */
export function SurveyQuestionRenderer({
  question,
  answer,
  onAnswer,
  disabled,
  index,
  required,
}: SurveyQuestionRendererProps) {
  const rendererProps: RendererProps = { question, answer, onAnswer, disabled }

  const renderInput = () => {
    switch (question.type) {
      case 'single_choice':
      case 'yes_no':
        return <SingleChoiceQuestion {...rendererProps} />
      case 'multiple_choice':
        return <MultipleChoiceQuestion {...rendererProps} />
      case 'scale_5':
        return <ScaleQuestion {...rendererProps} />
      case 'short_text':
      case 'long_text':
        return <TextQuestion {...rendererProps} />
      case 'number':
      case 'currency':
      case 'time':
      case 'date':
        return <NumberQuestion {...rendererProps} />
      case 'file':
        return <FileQuestion {...rendererProps} />
      case 'repeat_table':
        return <RepeatTableQuestion {...rendererProps} />
      case 'ranking':
        return <RankingQuestion {...rendererProps} />
      default:
        return null
    }
  }

  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 flex gap-2 text-[15px] font-medium break-keep text-slate-800">
        <span className="text-slate-400">{index}.</span>
        <span>
          {question.text}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger-500">
              *
            </span>
          )}
          {required && <span className="sr-only">(필수)</span>}
        </span>
      </legend>
      {question.helpText && (
        <p className="mb-2 text-[13px] break-keep text-slate-500">
          {question.helpText}
        </p>
      )}
      {renderInput()}
    </fieldset>
  )
}
