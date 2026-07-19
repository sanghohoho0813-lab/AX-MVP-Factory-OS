import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  MvpLevel,
  ProjectInput,
  ProjectStatus,
  ProjectType,
} from '../types/domain'
import type { HealthStatus, ProjectStage } from '../types'
import { HEALTH_META, PROJECT_STAGE_META } from '../lib/statusMeta'
import {
  MVP_LEVELS,
  PROJECT_STATUS_META,
  PROJECT_TYPE_META,
  STAGE_FLOW_BY_TYPE,
  TARGET_INSTITUTIONS,
  levelFieldLabel,
  mvpLevelLabel,
} from '../lib/domainMeta'
import { getDDay } from '../lib/format'
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard'
import { INTERNAL_MEMBERS } from '../data/members'
import { organizationRepository, projectRepository } from '../repositories'
import { createProject, updateProject } from '../services/projectService'
import { CurrencyField } from '../components/form/CurrencyField'
import { FormSection } from '../components/form/FormSection'
import {
  CheckboxGroupField,
  RadioGroupField,
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
  organizationId: string
  name: string
  projectType: ProjectType
  objective: string
  ownerId: string
  currentStage: ProjectStage
  currentMvpLevel: MvpLevel
  targetMvpLevel: MvpLevel
  status: ProjectStatus
  healthStatus: HealthStatus
  progress: string
  startDate: string
  dueDate: string
  fundingRequired: boolean
  targetInstitutions: string[]
  targetFundingAmount: number | null
  nextAction: string
  nextActionDueDate: string
  riskSummary: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

const FIELD_IDS: Record<keyof FormState, string> = {
  organizationId: 'proj-org',
  name: 'proj-name',
  projectType: 'proj-type',
  objective: 'proj-objective',
  ownerId: 'proj-owner',
  currentStage: 'proj-stage',
  currentMvpLevel: 'proj-current-level',
  targetMvpLevel: 'proj-target-level',
  status: 'proj-status',
  healthStatus: 'proj-health',
  progress: 'proj-progress',
  startDate: 'proj-start',
  dueDate: 'proj-due',
  fundingRequired: 'proj-funding',
  targetInstitutions: 'proj-institutions',
  targetFundingAmount: 'proj-funding-amount',
  nextAction: 'proj-next-action',
  nextActionDueDate: 'proj-next-action-due',
  riskSummary: 'proj-risk',
}

function emptyForm(organizationId: string): FormState {
  return {
    organizationId,
    name: '',
    projectType: 'ax',
    objective: '',
    ownerId: INTERNAL_MEMBERS[0].id,
    currentStage: 'intake',
    currentMvpLevel: 0,
    targetMvpLevel: 2,
    status: 'planned',
    healthStatus: 'healthy',
    progress: '0',
    startDate: '',
    dueDate: '',
    fundingRequired: false,
    targetInstitutions: [],
    targetFundingAmount: null,
    nextAction: '',
    nextActionDueDate: '',
    riskSummary: '',
  }
}

function toFormState(input: ProjectInput): FormState {
  return {
    organizationId: input.organizationId,
    name: input.name,
    projectType: input.projectType,
    objective: input.objective,
    ownerId: input.ownerId,
    currentStage: input.currentStage,
    currentMvpLevel: input.currentMvpLevel,
    targetMvpLevel: input.targetMvpLevel,
    status: input.status,
    healthStatus: input.healthStatus,
    progress: String(input.progress),
    startDate: input.startDate ?? '',
    dueDate: input.dueDate ?? '',
    fundingRequired: input.fundingRequired,
    targetInstitutions: input.targetInstitutions,
    targetFundingAmount: input.targetFundingAmount,
    nextAction: input.nextAction,
    nextActionDueDate: input.nextActionDueDate ?? '',
    riskSummary: input.riskSummary,
  }
}

function toInput(form: FormState): ProjectInput {
  return {
    organizationId: form.organizationId,
    name: form.name.trim(),
    projectType: form.projectType,
    objective: form.objective.trim(),
    ownerId: form.ownerId,
    currentStage: form.currentStage,
    currentMvpLevel: form.currentMvpLevel,
    targetMvpLevel: form.targetMvpLevel,
    status: form.status,
    healthStatus: form.healthStatus,
    progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
    startDate: form.startDate || null,
    dueDate: form.dueDate || null,
    fundingRequired: form.fundingRequired,
    targetInstitutions: form.fundingRequired ? form.targetInstitutions : [],
    targetFundingAmount: form.fundingRequired ? form.targetFundingAmount : null,
    nextAction: form.nextAction.trim(),
    nextActionDueDate: form.nextActionDueDate || null,
    riskSummary: form.riskSummary.trim(),
  }
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.organizationId) errors.organizationId = '고객사를 선택해 주세요.'
  if (!form.name.trim()) errors.name = '프로젝트명을 입력해 주세요.'
  if (!form.objective.trim()) errors.objective = '프로젝트 목적을 입력해 주세요.'
  if (!form.ownerId) errors.ownerId = '담당자를 선택해 주세요.'
  if (!form.dueDate) errors.dueDate = '목표 완료일을 선택해 주세요.'
  if (!form.nextAction.trim()) errors.nextAction = '다음 행동을 입력해 주세요.'

  const progress = Number(form.progress)
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    errors.progress = '진행률은 0~100 사이 숫자로 입력해 주세요.'
  }
  if (form.targetMvpLevel < form.currentMvpLevel) {
    errors.targetMvpLevel = `목표 수준은 현재 수준(${mvpLevelLabel(form.currentMvpLevel, form.projectType)}) 이상으로 설정해 주세요.`
  }
  if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
    errors.dueDate = '목표 완료일은 시작일보다 빠를 수 없습니다.'
  }
  return errors
}

export function ProjectFormPage() {
  const { projectId } = useParams()
  const isEdit = projectId !== undefined
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existing = useMemo(
    () => (projectId ? projectRepository.getById(projectId) : null),
    [projectId],
  )
  const organizations = useMemo(() => organizationRepository.getAll(), [])

  const presetOrgId = searchParams.get('organizationId') ?? ''
  const [form, setForm] = useState<FormState>(() => {
    if (existing) return toFormState(existing)
    const validPreset = organizations.some((o) => o.id === presetOrgId)
    return emptyForm(validPreset ? presetOrgId : '')
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  if (isEdit && !existing) {
    return (
      <NotFoundState
        title="프로젝트를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
        backTo="/clients"
        backLabel="고객사 목록으로 돌아가기"
      />
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  /** 유형 변경 시 해당 유형에서 사용하지 않는 단계면 첫 단계로 되돌린다 */
  const handleTypeChange = (type: ProjectType) => {
    setForm((prev) => {
      const flow = STAGE_FLOW_BY_TYPE[type]
      return {
        ...prev,
        projectType: type,
        currentStage: flow.includes(prev.currentStage)
          ? prev.currentStage
          : flow[0],
      }
    })
    setDirty(true)
  }

  const focusFirstError = (nextErrors: FormErrors) => {
    const firstKey = (Object.keys(FIELD_IDS) as (keyof FormState)[]).find(
      (key) => nextErrors[key],
    )
    if (firstKey) document.getElementById(FIELD_IDS[firstKey])?.focus()
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
      const saved = projectId
        ? updateProject(projectId, toInput(form))
        : createProject(toInput(form))
      allowNavigation()
      showToast(
        isEdit
          ? '프로젝트를 저장했습니다.'
          : `${saved.projectCode} 프로젝트를 등록했습니다.`,
      )
      navigate(`/projects/${saved.id}`)
    } catch (error) {
      setSaving(false)
      showToast(
        error instanceof Error
          ? error.message
          : '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
  }

  const stageFlow = STAGE_FLOW_BY_TYPE[form.projectType]
  const levelLabel = levelFieldLabel(form.projectType)
  const nextActionDday = getDDay(form.nextActionDueDate || null)
  const cancelTo = isEdit
    ? `/projects/${projectId}`
    : form.organizationId
      ? `/clients/${form.organizationId}`
      : '/clients'

  const levelOptions = MVP_LEVELS.map((level) => ({
    value: String(level),
    label: mvpLevelLabel(level, form.projectType),
  }))

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <PageHeader
        title={isEdit ? '프로젝트 수정' : '프로젝트 등록'}
        description={
          isEdit
            ? `${existing?.projectCode} ${existing?.name}의 계획과 실행 정보를 수정합니다.`
            : '프로젝트 기본정보와 진행 계획을 등록하면 코드가 자동 생성됩니다.'
        }
      />

      {existing?.archivedAt && (
        <p className="rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-[13px] break-keep text-warning-700">
          보관 처리된 프로젝트입니다. 수정 내용은 저장되지만 기본 목록에는 표시되지
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
          title="프로젝트 기본정보"
          description="어떤 고객사의 어떤 문제를 해결하는 프로젝트인지 정의합니다."
        >
          <SelectField
            id={FIELD_IDS.organizationId}
            label="고객사"
            required
            value={form.organizationId}
            onChange={(e) => set('organizationId', e.target.value)}
            error={errors.organizationId}
            placeholder="고객사 선택"
            options={organizations.map((org) => ({
              value: org.id,
              label: org.name,
            }))}
            disabled={isEdit}
          />
          <TextField
            id={FIELD_IDS.name}
            label="프로젝트명"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            placeholder="예: 생산계획 AX MVP"
          />
          <SelectField
            id={FIELD_IDS.projectType}
            label="프로젝트 유형"
            required
            value={form.projectType}
            onChange={(e) => handleTypeChange(e.target.value as ProjectType)}
            options={(Object.keys(PROJECT_TYPE_META) as ProjectType[]).map(
              (type) => ({ value: type, label: PROJECT_TYPE_META[type].label }),
            )}
            help="유형에 따라 진행 단계와 수준 표시가 달라집니다."
          />
          <SelectField
            id={FIELD_IDS.ownerId}
            label="내부 담당자"
            required
            value={form.ownerId}
            onChange={(e) => set('ownerId', e.target.value)}
            error={errors.ownerId}
            options={INTERNAL_MEMBERS.map((member) => ({
              value: member.id,
              label: `${member.name} · ${member.role}`,
            }))}
          />
          <TextAreaField
            id={FIELD_IDS.objective}
            label="프로젝트 목적"
            required
            value={form.objective}
            onChange={(e) => set('objective', e.target.value)}
            error={errors.objective}
            placeholder="이 프로젝트로 해결할 문제와 기대 효과를 한두 문장으로 정리하세요."
          />
        </FormSection>

        <FormSection
          title="진행 계획"
          description="현재 단계와 목표 수준, 일정을 관리합니다."
        >
          <SelectField
            id={FIELD_IDS.currentStage}
            label="현재 단계"
            required
            value={form.currentStage}
            onChange={(e) => set('currentStage', e.target.value as ProjectStage)}
            options={stageFlow.map((stage) => ({
              value: stage,
              label: PROJECT_STAGE_META[stage].label,
            }))}
          />
          <SelectField
            id={FIELD_IDS.status}
            label="프로젝트 상태"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ProjectStatus)}
            options={(
              ['planned', 'active', 'waiting_client', 'on_hold', 'completed'] as const
            ).map((status) => ({
              value: status,
              label: PROJECT_STATUS_META[status].label,
            }))}
          />
          <SelectField
            id={FIELD_IDS.currentMvpLevel}
            label={`현재 ${levelLabel}`}
            value={String(form.currentMvpLevel)}
            onChange={(e) =>
              set('currentMvpLevel', Number(e.target.value) as MvpLevel)
            }
            options={levelOptions}
          />
          <SelectField
            id={FIELD_IDS.targetMvpLevel}
            label={`목표 ${levelLabel}`}
            value={String(form.targetMvpLevel)}
            onChange={(e) =>
              set('targetMvpLevel', Number(e.target.value) as MvpLevel)
            }
            error={errors.targetMvpLevel}
            options={levelOptions}
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
          <TextField
            id={FIELD_IDS.progress}
            label="진행률 (%)"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={form.progress}
            onChange={(e) => set('progress', e.target.value)}
            error={errors.progress}
          />
          <TextField
            id={FIELD_IDS.startDate}
            label="시작일"
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          <TextField
            id={FIELD_IDS.dueDate}
            label="목표 완료일"
            required
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            error={errors.dueDate}
          />
        </FormSection>

        <FormSection
          title="자금조달 연계"
          description="정책자금·보증 연계가 필요한 프로젝트인지 설정합니다."
        >
          <RadioGroupField
            id={FIELD_IDS.fundingRequired}
            label="자금조달 연계 여부"
            fullWidth
            value={form.fundingRequired ? 'yes' : 'no'}
            onChange={(value) => set('fundingRequired', value === 'yes')}
            options={[
              { value: 'no', label: '아니오' },
              { value: 'yes', label: '예' },
            ]}
          />
          {form.fundingRequired && (
            <>
              <CheckboxGroupField
                label="목표 기관 (복수 선택)"
                values={form.targetInstitutions}
                options={TARGET_INSTITUTIONS}
                onChange={(values) => set('targetInstitutions', values)}
              />
              <CurrencyField
                id={FIELD_IDS.targetFundingAmount}
                label="목표 자금 금액"
                value={form.targetFundingAmount}
                onChange={(value) => set('targetFundingAmount', value)}
                placeholder="예: 80,000,000"
              />
            </>
          )}
        </FormSection>

        <FormSection
          title="실행 관리"
          description="당장 해야 할 다음 행동과 위험요소를 관리합니다."
        >
          <TextField
            id={FIELD_IDS.nextAction}
            label="다음 행동"
            required
            fullWidth
            value={form.nextAction}
            onChange={(e) => set('nextAction', e.target.value)}
            error={errors.nextAction}
            placeholder="예: 기관 설명자료 초안 검토"
          />
          <TextField
            id={FIELD_IDS.nextActionDueDate}
            label="다음 행동 예정일"
            type="date"
            value={form.nextActionDueDate}
            onChange={(e) => set('nextActionDueDate', e.target.value)}
            help={
              nextActionDday?.overdue
                ? `예정일이 ${Math.abs(nextActionDday.daysLeft)}일 지났습니다. 저장은 가능하지만 일정 재조정을 권장합니다.`
                : undefined
            }
          />
          <TextAreaField
            id={FIELD_IDS.riskSummary}
            label="주요 위험요소"
            value={form.riskSummary}
            onChange={(e) => set('riskSummary', e.target.value)}
            placeholder="일정·데이터·의사결정 관련 위험을 기록하세요."
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
            {saving ? '저장 중…' : isEdit ? '저장' : '프로젝트 등록'}
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
