import { CheckCircle2 } from 'lucide-react'
import { formatDateTime } from '../../lib/format'

interface SurveyCompletionPageProps {
  organizationName: string
  surveyTitle: string
  recipientName: string
  submittedAt: string | null
  answeredCount: number
  requiredComplete: boolean
}

/** 제출 완료 화면 (재진입 시에도 읽기 전용으로 표시) */
export function SurveyCompletionPage({
  organizationName,
  surveyTitle,
  recipientName,
  submittedAt,
  answeredCount,
  requiredComplete,
}: SurveyCompletionPageProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-full bg-success-50 text-success-600"
      >
        <CheckCircle2 className="size-8" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">제출이 완료되었습니다</h1>
      <p className="mt-2 text-sm break-keep text-slate-500">
        응답해주신 내용은 담당자가 검토한 뒤 필요한 경우 추가 인터뷰 질문을
        정리합니다.
      </p>

      <dl className="mt-6 w-full rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-4 text-left shadow-(--shadow-card)">
        {organizationName && (
          <div className="flex justify-between border-b border-slate-100 py-2">
            <dt className="text-[13px] text-slate-400">고객사</dt>
            <dd className="text-[13px] font-medium text-slate-700">{organizationName}</dd>
          </div>
        )}
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-[13px] text-slate-400">설문</dt>
          <dd className="max-w-52 truncate text-[13px] font-medium text-slate-700">
            {surveyTitle}
          </dd>
        </div>
        {recipientName && (
          <div className="flex justify-between border-b border-slate-100 py-2">
            <dt className="text-[13px] text-slate-400">응답자</dt>
            <dd className="text-[13px] font-medium text-slate-700">{recipientName}</dd>
          </div>
        )}
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-[13px] text-slate-400">제출 일시</dt>
          <dd className="text-[13px] font-medium text-slate-700">
            {formatDateTime(submittedAt)}
          </dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-[13px] text-slate-400">응답 문항</dt>
          <dd className="text-[13px] font-medium text-slate-700">{answeredCount}개</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-[13px] text-slate-400">필수 문항</dt>
          <dd className="text-[13px] font-medium text-slate-700">
            {requiredComplete ? '완료' : '일부 미완료'}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-xs break-keep text-slate-400">
        담당자 검토가 예정되어 있습니다. 이 화면은 닫으셔도 됩니다.
      </p>
    </div>
  )
}
