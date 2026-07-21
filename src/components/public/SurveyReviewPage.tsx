import { AlertTriangle, PencilLine } from 'lucide-react'
import type { SnapshotSection } from '../../types/survey'
import type { SurveyAnswerValue } from '../../types/surveyRuntime'
import { isValueAnswered } from '../../services/surveyAnswerBridge'
import { SurveyAnswerDisplay } from '../runtime/SurveyAnswerDisplay'
import { Button } from '../ui/Button'

interface SurveyReviewPageProps {
  sections: SnapshotSection[]
  visibleIds: Set<string>
  excludedCount: number
  answers: Map<string, SurveyAnswerValue>
  consentRequired: boolean
  consented: boolean
  requiredComplete: boolean
  submitting: boolean
  onEditSection: (sectionId: string) => void
  onSubmit: () => void
}

/** 제출 전 응답 검토 화면 */
export function SurveyReviewPage({
  sections,
  visibleIds,
  excludedCount,
  answers,
  consentRequired,
  consented,
  requiredComplete,
  submitting,
  onEditSection,
  onSubmit,
}: SurveyReviewPageProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">응답 검토</h1>
        <p className="mt-1 text-sm break-keep text-slate-500">
          제출 전에 응답 내용을 확인하세요. 수정이 필요하면 각 섹션의 수정하기를
          누르세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3 text-[13px]">
        <span className={requiredComplete ? 'text-success-700' : 'text-warning-700'}>
          필수 문항 {requiredComplete ? '완료' : '미완료'}
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">
          개인정보 동의 {consented ? '완료' : consentRequired ? '필요' : '선택'}
        </span>
        {excludedCount > 0 && (
          <>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">조건에 따라 제외된 문항 {excludedCount}개</span>
          </>
        )}
      </div>

      {sections.map((section) => {
        const rows = section.placements.filter((p) => visibleIds.has(p.questionId))
        if (rows.length === 0) return null
        return (
          <section
            key={section.id}
            className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
              <h2 className="text-[15px] font-semibold text-slate-800">{section.title}</h2>
              <Button variant="ghost" size="sm" onClick={() => onEditSection(section.id)}>
                <PencilLine aria-hidden="true" className="size-3.5" />
                수정하기
              </Button>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((p) => {
                const answered = isValueAnswered(answers.get(p.questionId), p.type)
                return (
                  <li key={p.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-medium break-keep text-slate-700">
                        {p.questionText}
                        {p.required && <span className="ml-0.5 text-danger-500">*</span>}
                      </p>
                      {p.required && !answered && (
                        <span className="flex shrink-0 items-center gap-1 text-[0.875rem] font-medium text-warning-600">
                          <AlertTriangle aria-hidden="true" className="size-3" />
                          미응답
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <SurveyAnswerDisplay placement={p} value={answers.get(p.questionId)} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-5 text-center shadow-(--shadow-card)">
        <p className="text-[13px] break-keep text-slate-500">
          제출 후에는 이 링크에서 답변을 수정할 수 없습니다.
        </p>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={submitting}
          className="mt-3 h-12 w-full text-base sm:w-64"
        >
          {submitting ? '제출 중…' : '최종 제출'}
        </Button>
      </div>
    </div>
  )
}
