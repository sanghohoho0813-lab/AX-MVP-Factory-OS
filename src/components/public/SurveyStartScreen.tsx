import { Clock, FileText, ListChecks, ShieldCheck } from 'lucide-react'
import type { RespondentProfile } from '../../types/surveyRuntime'
import type { PublicSurveyView } from '../../services/surveyRuntimeService'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { formatDate } from '../../lib/format'
import { Button } from '../ui/Button'

interface SurveyStartScreenProps {
  view: PublicSurveyView
  estimatedMinutes: number
  hasDraft: boolean
  draftProgress: number
  draftLastSaved: string | null
  profile: RespondentProfile
  onProfileChange: (patch: Partial<RespondentProfile>) => void
  consented: boolean
  onConsentChange: (v: boolean) => void
  error: string | null
  onStart: () => void
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  error?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500 aria-invalid:border-danger-500"
      />
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}

/** 고객용 설문 시작 화면 (개요 + 응답자 정보 + 개인정보 동의) */
export function SurveyStartScreen({
  view,
  estimatedMinutes,
  hasDraft,
  draftProgress,
  draftLastSaved,
  profile,
  onProfileChange,
  consented,
  onConsentChange,
  error,
  onStart,
}: SurveyStartScreenProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* 개요 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-5 shadow-(--shadow-card)">
        <h1 className="text-lg font-semibold break-keep text-slate-900">
          {view.surveyTitle}
        </h1>
        {view.organizationName && (
          <p className="mt-0.5 text-sm text-slate-500">{view.organizationName}</p>
        )}
        {view.introMessage && (
          <p className="mt-3 text-sm break-keep whitespace-pre-wrap text-slate-600">
            {view.introMessage}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="size-4 text-slate-400" />
            <div>
              <dt className="text-[11px] text-slate-400">전체 섹션</dt>
              <dd className="text-sm font-semibold text-slate-700">
                {view.totalSections}개
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 text-slate-400" />
            <div>
              <dt className="text-[11px] text-slate-400">예상 시간</dt>
              <dd className="text-sm font-semibold text-slate-700">약 {estimatedMinutes}분</dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText aria-hidden="true" className="size-4 text-slate-400" />
            <div>
              <dt className="text-[11px] text-slate-400">응답 역할</dt>
              <dd className="text-sm font-semibold text-slate-700">
                {RESPONDENT_ROLE_META[view.respondentRole].label}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 text-slate-400" />
            <div>
              <dt className="text-[11px] text-slate-400">응답 만료</dt>
              <dd className="text-sm font-semibold text-slate-700">
                {view.expiresAt ? formatDate(view.expiresAt) : '없음'}
              </dd>
            </div>
          </div>
        </dl>
        <ul className="mt-4 flex flex-col gap-1 rounded-(--radius-card) bg-slate-50 px-4 py-3 text-xs break-keep text-slate-500">
          <li>· 입력 내용은 자동으로 임시 저장되며, 같은 링크로 다시 들어오면 이어서 작성할 수 있습니다.</li>
          <li>· <span className="text-danger-500">*</span> 표시는 필수 응답 문항입니다.</li>
          <li>· 제출한 뒤에는 이 링크에서 답변을 수정할 수 없습니다.</li>
        </ul>
      </section>

      {hasDraft && (
        <section className="rounded-(--radius-panel) border border-brand-200 bg-brand-50 px-5 py-4">
          <p className="text-sm font-medium text-brand-800">작성 중인 응답이 있습니다</p>
          <p className="mt-0.5 text-[13px] text-brand-700">
            현재 진행률 {draftProgress}%
            {draftLastSaved ? ` · 마지막 저장 ${formatDate(draftLastSaved)}` : ''}
          </p>
        </section>
      )}

      {/* 응답자 정보 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-5 shadow-(--shadow-card)">
        <h2 className="text-[15px] font-semibold text-slate-900">응답자 정보</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="resp-name"
            label="이름"
            required
            value={profile.name}
            onChange={(v) => onProfileChange({ name: v })}
            error={error && !profile.name.trim() ? '이름을 입력해 주세요.' : undefined}
          />
          <Field
            id="resp-position"
            label="직책"
            value={profile.position}
            onChange={(v) => onProfileChange({ position: v })}
          />
          <Field
            id="resp-department"
            label="부서"
            value={profile.department}
            onChange={(v) => onProfileChange({ department: v })}
          />
          <Field
            id="resp-email"
            label="이메일"
            type="email"
            value={profile.email}
            onChange={(v) => onProfileChange({ email: v })}
          />
          <Field
            id="resp-phone"
            label="전화번호"
            type="tel"
            value={profile.phone}
            onChange={(v) => onProfileChange({ phone: v })}
          />
        </div>
      </section>

      {/* 개인정보 동의 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-5 shadow-(--shadow-card)">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <ShieldCheck aria-hidden="true" className="size-4 text-slate-400" />
          개인정보 수집 안내
        </h2>
        <p className="mt-2 text-[13px] break-keep whitespace-pre-wrap text-slate-600">
          {view.privacyNotice}
        </p>
        <p className="mt-2 text-xs break-keep text-slate-400">
          본 문구는 내부 테스트용 예시이며, 실제 운영 전 법적 검토가 필요합니다.
        </p>
        {view.consentRequired && (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-(--radius-card) border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span className="text-[13px] break-keep text-slate-700">
              개인정보 수집·이용에 동의합니다. (필수)
            </span>
          </label>
        )}
        {error && view.consentRequired && !consented && (
          <p className="mt-2 text-xs text-danger-600">
            설문을 시작하려면 개인정보 수집에 동의해야 합니다.
          </p>
        )}
      </section>

      <Button variant="primary" size="md" onClick={onStart} className="h-12 w-full text-base">
        {hasDraft ? '이어서 작성' : '설문 시작'}
      </Button>
    </div>
  )
}
