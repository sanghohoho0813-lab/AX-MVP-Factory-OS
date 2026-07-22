import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { InterviewQuestion } from '../../types/assessment'
import { formatDateTime } from '../../lib/format'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { Button } from '../ui/Button'
import { InterviewPriorityBadge, InterviewStatusBadge } from './badges'

export interface InterviewActions {
  onSelect: (q: InterviewQuestion) => void
  onExclude: (q: InterviewQuestion) => void
  onAnswer: (q: InterviewQuestion, answer: string) => void
}

function InterviewItem({
  q,
  onSelect,
  onExclude,
  onAnswer,
}: { q: InterviewQuestion } & InterviewActions) {
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState(q.answer)
  const excluded = q.status === 'excluded'

  return (
    <li
      className={`rounded-(--radius-card) border px-4 py-3.5 ${
        excluded ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <InterviewPriorityBadge priority={q.priority} />
        <InterviewStatusBadge status={q.status} />
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.8125rem] font-medium text-slate-500">
          {RESPONDENT_ROLE_META[q.targetRespondentRole].label} 대상
        </span>
        {q.manual && (
          <span className="rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[0.8125rem] font-medium text-accent-700">
            수동
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-medium break-keep text-slate-800">{q.question}</p>
      {q.reason && <p className="mt-1 text-[0.875rem] break-keep text-slate-400">{q.reason}</p>}
      {q.expectedEvidence && (
        <p className="mt-1 text-[0.875rem] break-keep text-slate-500">
          기대 확인자료: {q.expectedEvidence}
        </p>
      )}

      {q.status === 'answered' && !answering && (
        <div className="mt-2 rounded-(--radius-control) border border-success-200 bg-success-50/50 px-3 py-2">
          <p className="text-[13px] break-keep whitespace-pre-wrap text-slate-700">{q.answer}</p>
          {q.answeredAt && (
            <p className="mt-1 text-[0.875rem] text-slate-400">기록 {formatDateTime(q.answeredAt)}</p>
          )}
        </div>
      )}

      {answering && (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
            aria-label="인터뷰 답변 입력"
            placeholder="인터뷰에서 확인한 내용을 기록하세요."
            className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onAnswer(q, answer)
                setAnswering(false)
              }}
              disabled={answer.trim() === ''}
            >
              <Check aria-hidden="true" className="size-3.5" />
              답변 저장
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAnswering(false)}>
              취소
            </Button>
          </div>
        </div>
      )}

      {!answering && !excluded && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {q.status === 'suggested' && (
            <Button variant="secondary" size="sm" onClick={() => onSelect(q)}>
              <Plus aria-hidden="true" className="size-3.5" />
              인터뷰에 선택
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAnswer(q.answer)
              setAnswering(true)
            }}
          >
            {q.status === 'answered' ? '답변 수정' : '답변 기록'}
          </Button>
          <button
            type="button"
            onClick={() => onExclude(q)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-400 hover:text-slate-600"
          >
            <X aria-hidden="true" className="size-3.5" />
            제외
          </button>
        </div>
      )}
    </li>
  )
}

interface InterviewListProps extends InterviewActions {
  questions: InterviewQuestion[]
}

export function InterviewList({ questions, ...actions }: InterviewListProps) {
  return (
    <ul className="flex flex-col gap-2.5">
      {questions.map((q) => (
        <InterviewItem key={q.id} q={q} {...actions} />
      ))}
    </ul>
  )
}
