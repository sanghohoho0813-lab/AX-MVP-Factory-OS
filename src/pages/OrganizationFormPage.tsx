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
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { NotFoundState } from '../components/ui/NotFoundState'
import { useToast } from '../components/ui/toastContext'
import { WizardLayout, WizardSummaryRow, type WizardStep } from '../components/workspace/WizardLayout'
import { Button } from '../components/ui/Button'

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
  const [step, setStep] = useState(0)
  const [savedOrg, setSavedOrg] = useState<{ id: string; name: string } | null>(null)
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
      if (isEdit) {
        showToast('고객사 정보를 저장했습니다.')
        navigate(`/clients/${saved.id}`)
      } else {
        // 신규 등록: 다음 행동 선택 모달 표시
        setSaving(false)
        setSavedOrg({ id: saved.id, name: saved.name })
      }
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

  const STEPS: WizardStep[] = [
    { key: 'basic', title: '기본정보' },
    { key: 'contact', title: '담당자·연락처' },
    { key: 'status', title: '기업현황', optional: true },
    { key: 'confirm', title: '확인·저장' },
  ]

  const validateStep = (i: number): boolean => {
    const e = validate(form)
    if (i === 0) {
      const stepErr: FormErrors = { name: e.name, industry: e.industry }
      setErrors((prev) => ({ ...prev, ...stepErr }))
      if (e.name || e.industry) { focusFirstError(stepErr); return false }
    }
    if (i === 1) {
      const stepErr: FormErrors = { contactName: e.contactName, contactPhone: e.contactPhone, contactEmail: e.contactEmail }
      setErrors((prev) => ({ ...prev, ...stepErr }))
      if (e.contactName || e.contactPhone || e.contactEmail) { focusFirstError(stepErr); return false }
    }
    return true
  }

  const goNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  const goPrev = () => { if (step === 0) { allowNavigation(); navigate(cancelTo) } else setStep((s) => s - 1) }

  const summary = (
    <div>
      <WizardSummaryRow label="고객사명" value={form.name} />
      <WizardSummaryRow label="업종" value={form.industry} />
      <WizardSummaryRow label="담당자" value={form.contactName} />
      <WizardSummaryRow label="직원 수" value={form.employeeCount ? `${form.employeeCount}명` : ''} />
    </div>
  )

  const missingRequired: string[] = []
  {
    const e = validate(form)
    if (e.name) missingRequired.push('고객사명')
    if (e.industry) missingRequired.push('업종')
    if (e.contactName) missingRequired.push('담당자 이름')
    if (e.contactPhone || e.contactEmail) missingRequired.push('연락처(전화 또는 이메일)')
  }

  return (
    <>
      <WizardLayout
        title={isEdit ? '고객사 수정' : '고객사 등록'}
        description={isEdit ? `${existing?.name}의 기업 정보를 단계별로 수정합니다.` : '기업 정보와 담당자를 단계별로 입력하면 진단·프로젝트 관리를 시작할 수 있습니다.'}
        steps={STEPS}
        current={step}
        onStepChange={(i) => { if (i <= step) setStep(i) }}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={handleSubmit}
        submitLabel={isEdit ? '저장' : '고객사 등록하기'}
        saving={saving}
        summary={summary}
      >
        {existing?.archivedAt && (
          <p className="mb-4 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-[0.9rem] break-keep text-warning-700">
            보관 처리된 고객사입니다. 수정 내용은 저장되지만 기본 목록에는 표시되지 않습니다.
          </p>
        )}

        {step === 0 && (
          <FormSection title="기업 기본정보" description="꼭 필요한 정보만 먼저 입력합니다.">
            <TextField id={FIELD_IDS.name} label="고객사명" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="예: 대한정밀" />
            <TextField id={FIELD_IDS.industry} label="업종" required value={form.industry} onChange={(e) => set('industry', e.target.value)} error={errors.industry} placeholder="예: 정밀가공 제조업" />
            <TextField id={FIELD_IDS.subIndustry} label="세부 업종" value={form.subIndustry} onChange={(e) => set('subIndustry', e.target.value)} placeholder="예: 금속 절삭가공" />
            <TextField id={FIELD_IDS.region} label="지역" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="예: 경기 시흥" />
            <TextField id={FIELD_IDS.businessRegistrationNumber} label="사업자등록번호" inputMode="numeric" value={form.businessRegistrationNumber} onChange={(e) => set('businessRegistrationNumber', formatBusinessNumber(e.target.value))} error={errors.businessRegistrationNumber} placeholder="000-00-00000" help="숫자만 입력하면 자동으로 형식이 적용됩니다." />
            <SelectField id={FIELD_IDS.businessType} label="기업 형태" value={form.businessType} onChange={(e) => set('businessType', e.target.value as BusinessType)} options={(Object.keys(BUSINESS_TYPE_META) as BusinessType[]).map((type) => ({ value: type, label: BUSINESS_TYPE_META[type].label }))} />
            <TextField id={FIELD_IDS.address} label="주소" fullWidth value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="예: 경기도 시흥시 공단1대로 000" />
          </FormSection>
        )}

        {step === 1 && (
          <FormSection title="대표 연락 담당자" description="프로젝트 진행 시 기본으로 연락할 담당자입니다. 전화 또는 이메일 중 하나는 필수입니다.">
            <TextField id={FIELD_IDS.contactName} label="이름" required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} error={errors.contactName} placeholder="예: 김도현" />
            <TextField id={FIELD_IDS.contactPosition} label="직책" value={form.contactPosition} onChange={(e) => set('contactPosition', e.target.value)} placeholder="예: 생산혁신팀장" />
            <TextField id={FIELD_IDS.contactPhone} label="전화번호" type="tel" inputMode="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} onBlur={(e) => set('contactPhone', formatPhone(e.target.value))} error={errors.contactPhone} placeholder="010-0000-0000" />
            <TextField id={FIELD_IDS.contactEmail} label="이메일" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} error={errors.contactEmail} placeholder="name@company.com" />
            <TextAreaField id={FIELD_IDS.notes} label="연락 메모" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="고객사 특이사항, 진행 맥락 등을 기록하세요." />
          </FormSection>
        )}

        {step === 2 && (
          <FormSection title="기업현황 (선택)" description="아는 만큼만 입력하세요. 나중에 수정할 수 있습니다.">
            <TextField id={FIELD_IDS.foundedAt} label="설립일" type="date" value={form.foundedAt} onChange={(e) => set('foundedAt', e.target.value)} error={errors.foundedAt} />
            <TextField id={FIELD_IDS.employeeCount} label="직원 수" type="number" min={0} inputMode="numeric" value={form.employeeCount} onChange={(e) => set('employeeCount', e.target.value)} error={errors.employeeCount} placeholder="예: 42" />
            <CurrencyField id={FIELD_IDS.annualRevenue} label="연매출" value={form.annualRevenue} onChange={(value) => set('annualRevenue', value)} placeholder="예: 1,200,000,000" />
            <TextField id={FIELD_IDS.website} label="홈페이지 주소" type="url" value={form.website} onChange={(e) => set('website', e.target.value)} error={errors.website} placeholder="https://company.com" />
            <SelectField id={FIELD_IDS.status} label="고객 상태" value={form.status} onChange={(e) => set('status', e.target.value as OrganizationStatus)} options={(['active', 'prospect', 'paused'] as const).map((s) => ({ value: s, label: ORG_STATUS_META[s].label }))} />
            <SelectField id={FIELD_IDS.healthStatus} label="건강 상태" value={form.healthStatus} onChange={(e) => set('healthStatus', e.target.value as HealthStatus)} options={(['healthy', 'attention', 'risk'] as const).map((h) => ({ value: h, label: HEALTH_META[h].label }))} />
          </FormSection>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[1.15rem] font-bold text-slate-900">입력 내용 확인</h2>
            <dl className="rounded-(--radius-card) border border-slate-200">
              {[
                ['고객사명', form.name], ['업종', form.industry], ['세부 업종', form.subIndustry], ['지역', form.region],
                ['담당자', form.contactName], ['전화', form.contactPhone], ['이메일', form.contactEmail],
                ['직원 수', form.employeeCount ? `${form.employeeCount}명` : ''],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <dt className="shrink-0 text-[0.95rem] text-slate-500">{label}</dt>
                  <dd className="min-w-0 break-keep text-right text-[0.95rem] font-medium text-slate-800">{value || <span className="text-slate-300">미입력</span>}</dd>
                </div>
              ))}
            </dl>
            {missingRequired.length > 0 ? (
              <p className="rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-[0.95rem] break-keep text-warning-700">
                아직 필요한 정보가 있습니다: {missingRequired.join(', ')}. 이전 단계에서 입력해 주세요.
              </p>
            ) : (
              <p className="rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-4 py-3 text-[0.95rem] break-keep text-brand-800">
                등록 후 이 고객사로 <b>새 프로젝트</b>를 만들어 진단을 시작할 수 있습니다.
              </p>
            )}
          </div>
        )}
      </WizardLayout>

      {/* 등록 완료 후 다음 행동 선택 */}
      <Modal open={savedOrg !== null} title="고객사를 등록했습니다" onClose={() => { setSavedOrg(null); navigate(`/clients/${savedOrg?.id}`) }}>
        <p className="mb-4 text-[1rem] break-keep text-slate-600">{savedOrg?.name} 고객사가 등록되었습니다. 다음으로 무엇을 할까요?</p>
        <div className="flex flex-col gap-2.5">
          <Button variant="primary" onClick={() => { const id = savedOrg?.id; setSavedOrg(null); navigate(`/projects/new?organizationId=${id}`) }}>이 고객사로 새 프로젝트 만들기</Button>
          <Button variant="secondary" onClick={() => { const id = savedOrg?.id; setSavedOrg(null); navigate(`/clients/${id}`) }}>고객사 상세 보기</Button>
        </div>
      </Modal>

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
    </>
  )
}
