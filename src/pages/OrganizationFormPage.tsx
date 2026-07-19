import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  BusinessType,
  OrganizationInput,
  OrganizationStatus,
} from '../types/domain'
import type { HealthStatus } from '../types'
import { HEALTH_META } from '../lib/statusMeta'
import { BUSINESS_TYPE_META, ORG_STATUS_META } from '../lib/domainMeta'
import {
  formatBusinessNumber,
  formatPhone,
  isValidBusinessNumber,
  isValidEmail,
  isValidPhone,
  isValidUrl,
} from '../lib/format'
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard'
import { organizationRepository } from '../repositories'
import {
  createOrganization,
  updateOrganization,
} from '../services/organizationService'
import { CurrencyField } from '../components/form/CurrencyField'
import { FormSection } from '../components/form/FormSection'
import {
  SelectField,
  TextAreaField,
  TextField,
} from '../components/form/fields'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { NotFoundState } from '../components/ui/NotFoundState'
import { PageHeader } from '../components/ui/PageHeader'
import { useToast } from '../components/ui/toastContext'

interface FormState {
  name: string
  businessRegistrationNumber: string
  industry: string
  subIndustry: string
  businessType: BusinessType
  foundedAt: string
  employeeCount: string
  annualRevenue: number | null
  region: string
  address: string
  website: string
  contactName: string
  contactPosition: string
  contactPhone: string
  contactEmail: string
  status: OrganizationStatus
  healthStatus: HealthStatus
  notes: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

const EMPTY_FORM: FormState = {
  name: '',
  businessRegistrationNumber: '',
  industry: '',
  subIndustry: '',
  businessType: 'corporation',
  foundedAt: '',
  employeeCount: '',
  annualRevenue: null,
  region: '',
  address: '',
  website: '',
  contactName: '',
  contactPosition: '',
  contactPhone: '',
  contactEmail: '',
  status: 'prospect',
  healthStatus: 'healthy',
  notes: '',
}

/** 필드 id 매핑 — 첫 오류 필드로 포커스 이동에 사용 */
const FIELD_IDS: Record<keyof FormState, string> = {
  name: 'org-name',
  businessRegistrationNumber: 'org-brn',
  industry: 'org-industry',
  subIndustry: 'org-sub-industry',
  businessType: 'org-business-type',
  foundedAt: 'org-founded-at',
  employeeCount: 'org-employee-count',
  annualRevenue: 'org-annual-revenue',
  region: 'org-region',
  address: 'org-address',
  website: 'org-website',
  contactName: 'org-contact-name',
  contactPosition: 'org-contact-position',
  contactPhone: 'org-contact-phone',
  contactEmail: 'org-contact-email',
  status: 'org-status',
  healthStatus: 'org-health',
  notes: 'org-notes',
}

function toFormState(input: OrganizationInput): FormState {
  return {
    name: input.name,
    businessRegistrationNumber: input.businessRegistrationNumber,
    industry: input.industry,
    subIndustry: input.subIndustry,
    businessType: input.businessType,
    foundedAt: input.foundedAt ?? '',
    employeeCount: input.employeeCount !== null ? String(input.employeeCount) : '',
    annualRevenue: input.annualRevenue,
    region: input.region,
    address: input.address,
    website: input.website,
    contactName: input.primaryContact.name,
    contactPosition: input.primaryContact.position,
    contactPhone: input.primaryContact.phone,
    contactEmail: input.primaryContact.email,
    status: input.status,
    healthStatus: input.healthStatus,
    notes: input.notes,
  }
}

function toInput(form: FormState): OrganizationInput {
  return {
    name: form.name.trim(),
    businessRegistrationNumber: form.businessRegistrationNumber.trim(),
    industry: form.industry.trim(),
    subIndustry: form.subIndustry.trim(),
    businessType: form.businessType,
    foundedAt: form.foundedAt || null,
    employeeCount: form.employeeCount === '' ? null : Number(form.employeeCount),
    annualRevenue: form.annualRevenue,
    region: form.region.trim(),
    address: form.address.trim(),
    website: form.website.trim(),
    primaryContact: {
      name: form.contactName.trim(),
      position: form.contactPosition.trim(),
      phone: formatPhone(form.contactPhone),
      email: form.contactEmail.trim(),
    },
    status: form.status,
    healthStatus: form.healthStatus,
    notes: form.notes.trim(),
  }
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = '고객사명을 입력해 주세요.'
  if (!form.industry.trim()) errors.industry = '업종을 입력해 주세요.'
  if (!form.contactName.trim()) {
    errors.contactName = '대표 연락 담당자 이름을 입력해 주세요.'
  }
  const hasPhone = form.contactPhone.trim() !== ''
  const hasEmail = form.contactEmail.trim() !== ''
  if (!hasPhone && !hasEmail) {
    errors.contactPhone = '전화번호 또는 이메일 중 하나는 입력해야 합니다.'
  }
  if (hasPhone && !isValidPhone(form.contactPhone)) {
    errors.contactPhone = '전화번호 형식을 확인해 주세요.'
  }
  if (hasEmail && !isValidEmail(form.contactEmail)) {
    errors.contactEmail = '이메일 형식을 확인해 주세요. 예: name@company.com'
  }
  if (
    form.businessRegistrationNumber.trim() !== '' &&
    !isValidBusinessNumber(form.businessRegistrationNumber)
  ) {
    errors.businessRegistrationNumber =
      '사업자등록번호는 000-00-00000 형식으로 입력해 주세요.'
  }
  if (form.website.trim() !== '' && !isValidUrl(form.website)) {
    errors.website = '홈페이지 주소 형식을 확인해 주세요. 예: https://company.com'
  }
  if (form.employeeCount !== '') {
    const count = Number(form.employeeCount)
    if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
      errors.employeeCount = '직원 수는 0 이상의 정수로 입력해 주세요.'
    }
  }
  if (form.foundedAt && Number.isNaN(new Date(form.foundedAt).getTime())) {
    errors.foundedAt = '설립일 형식이 올바르지 않습니다.'
  }
  return errors
}

export function OrganizationFormPage() {
  const { organizationId } = useParams()
  const isEdit = organizationId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existing = useMemo(
    () => (isEdit ? organizationRepository.getById(organizationId) : null),
    [isEdit, organizationId],
  )

  const [form, setForm] = useState<FormState>(() =>
    existing ? toFormState(existing) : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  if (isEdit && !existing) {
    return (
      <NotFoundState
        title="고객사를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 고객사입니다."
        backTo="/clients"
        backLabel="고객사 목록으로 돌아가기"
      />
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const focusFirstError = (nextErrors: FormErrors) => {
    const firstKey = (Object.keys(FIELD_IDS) as (keyof FormState)[]).find(
      (key) => nextErrors[key],
    )
    if (firstKey) {
      document.getElementById(FIELD_IDS[firstKey])?.focus()
    }
  }

  const handleSubmit = () => {
    if (saving) return
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstError(nextErrors)
      return
    }
    setSaving(true)
    try {
      const saved = organizationId
        ? updateOrganization(organizationId, toInput(form))
        : createOrganization(toInput(form))
      allowNavigation()
      showToast(
        isEdit
          ? '고객사 정보를 저장했습니다.'
          : `${saved.name} 고객사를 등록했습니다.`,
      )
      navigate(`/clients/${saved.id}`)
    } catch (error) {
      setSaving(false)
      showToast(
        error instanceof Error
          ? error.message
          : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
  }

  const cancelTo = isEdit ? `/clients/${organizationId}` : '/clients'

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <PageHeader
        title={isEdit ? '고객사 수정' : '고객사 등록'}
        description={
          isEdit
            ? `${existing?.name}의 기업 정보와 운영 상태를 수정합니다.`
            : '기업 기본정보와 담당자를 등록하면 진단·프로젝트 관리를 시작할 수 있습니다.'
        }
      />

      {existing?.archivedAt && (
        <p className="rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] break-keep text-warning-700">
          보관 처리된 고객사입니다. 수정 내용은 저장되지만 기본 목록에는 표시되지
          않습니다.
        </p>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-5"
      >
        <FormSection
          title="기업 기본정보"
          description="고객사의 기본 현황 정보를 입력합니다."
        >
          <TextField
            id={FIELD_IDS.name}
            label="고객사명"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="예: 대한정밀"
          />
          <TextField
            id={FIELD_IDS.businessRegistrationNumber}
            label="사업자등록번호"
            inputMode="numeric"
            value={form.businessRegistrationNumber}
            onChange={(e) =>
              set(
                'businessRegistrationNumber',
                formatBusinessNumber(e.target.value),
              )
            }
            error={errors.businessRegistrationNumber}
            placeholder="000-00-00000"
            help="숫자만 입력하면 자동으로 형식이 적용됩니다."
          />
          <TextField
            id={FIELD_IDS.industry}
            label="업종"
            required
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            error={errors.industry}
            placeholder="예: 정밀가공 제조업"
          />
          <TextField
            id={FIELD_IDS.subIndustry}
            label="세부 업종"
            value={form.subIndustry}
            onChange={(e) => set('subIndustry', e.target.value)}
            placeholder="예: 금속 절삭가공"
          />
          <SelectField
            id={FIELD_IDS.businessType}
            label="기업 형태"
            value={form.businessType}
            onChange={(e) => set('businessType', e.target.value as BusinessType)}
            options={(
              Object.keys(BUSINESS_TYPE_META) as BusinessType[]
            ).map((type) => ({
              value: type,
              label: BUSINESS_TYPE_META[type].label,
            }))}
          />
          <TextField
            id={FIELD_IDS.foundedAt}
            label="설립일"
            type="date"
            value={form.foundedAt}
            onChange={(e) => set('foundedAt', e.target.value)}
            error={errors.foundedAt}
          />
          <TextField
            id={FIELD_IDS.employeeCount}
            label="직원 수"
            type="number"
            min={0}
            inputMode="numeric"
            value={form.employeeCount}
            onChange={(e) => set('employeeCount', e.target.value)}
            error={errors.employeeCount}
            placeholder="예: 42"
          />
          <CurrencyField
            id={FIELD_IDS.annualRevenue}
            label="연매출"
            value={form.annualRevenue}
            onChange={(value) => set('annualRevenue', value)}
            placeholder="예: 1,200,000,000"
          />
          <TextField
            id={FIELD_IDS.region}
            label="지역"
            value={form.region}
            onChange={(e) => set('region', e.target.value)}
            placeholder="예: 경기 시흥"
          />
          <TextField
            id={FIELD_IDS.website}
            label="홈페이지 주소"
            type="url"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            error={errors.website}
            placeholder="https://company.com"
          />
          <TextField
            id={FIELD_IDS.address}
            label="주소"
            fullWidth
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="예: 경기도 시흥시 공단1대로 000"
          />
        </FormSection>

        <FormSection
          title="대표 연락 담당자"
          description="프로젝트 진행 시 기본으로 연락할 담당자입니다."
        >
          <TextField
            id={FIELD_IDS.contactName}
            label="이름"
            required
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            error={errors.contactName}
            placeholder="예: 김도현"
          />
          <TextField
            id={FIELD_IDS.contactPosition}
            label="직책"
            value={form.contactPosition}
            onChange={(e) => set('contactPosition', e.target.value)}
            placeholder="예: 생산혁신팀장"
          />
          <TextField
            id={FIELD_IDS.contactPhone}
            label="전화번호"
            type="tel"
            inputMode="tel"
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            onBlur={(e) => set('contactPhone', formatPhone(e.target.value))}
            error={errors.contactPhone}
            placeholder="010-0000-0000"
            help="전화번호 또는 이메일 중 하나는 필수입니다."
          />
          <TextField
            id={FIELD_IDS.contactEmail}
            label="이메일"
            type="email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            error={errors.contactEmail}
            placeholder="name@company.com"
          />
        </FormSection>

        <FormSection
          title="운영 정보"
          description="내부 운영 관점의 상태를 관리합니다."
        >
          <SelectField
            id={FIELD_IDS.status}
            label="고객 상태"
            value={form.status}
            onChange={(e) => set('status', e.target.value as OrganizationStatus)}
            options={(['active', 'prospect', 'paused'] as const).map((s) => ({
              value: s,
              label: ORG_STATUS_META[s].label,
            }))}
          />
          <SelectField
            id={FIELD_IDS.healthStatus}
            label="건강 상태"
            value={form.healthStatus}
            onChange={(e) => set('healthStatus', e.target.value as HealthStatus)}
            options={(['healthy', 'attention', 'risk'] as const).map((h) => ({
              value: h,
              label: HEALTH_META[h].label,
            }))}
          />
          <TextAreaField
            id={FIELD_IDS.notes}
            label="내부 메모"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="고객사 특이사항, 진행 맥락 등을 기록하세요."
          />
        </FormSection>

        <div className="flex items-center justify-end gap-2 pb-2">
          <Button
            variant="secondary"
            onClick={() => navigate(cancelTo)}
            disabled={saving}
          >
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '저장 중…' : isEdit ? '저장' : '고객사 등록'}
          </Button>
        </div>
      </form>

      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="작성 중인 내용이 있습니다"
        message="저장하지 않은 변경 내용이 사라집니다. 이 화면을 나갈까요?"
        confirmLabel="나가기"
        cancelLabel="계속 작성"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}
