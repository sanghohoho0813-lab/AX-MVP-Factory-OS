import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  MvpLevel,
  ProjectInput,
  ProjectStatus,
  ProjectType,
} from '../types/domain'
import type { HealthStatus, ProjectStage } from '../types'
import { PROJECT_STAGE_META } from '../lib/statusMeta'
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
import { Modal } from '../components/ui/Modal'
import { NotFoundState } from '../components/ui/NotFoundState'
import { useToast } from '../components/ui/toastContext'
import { WizardLayout, type WizardStep } from '../components/workspace/WizardLayout'
import { useActiveProject } from '../context/activeProject'
import { computeProjectJourney } from '../services/journeyService'

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
  const [step, setStep] = useState(0)
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null)
  const { setActiveProject } = useActiveProject()
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
      if (isEdit) {
        showToast('프로젝트를 저장했습니다.')
        navigate(`/projects/${saved.id}`)
      } else {
        setSaving(false)
        setSavedProjectId(saved.id)
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

  const STEPS: WizardStep[] = [
    { key: 'org', title: '고객사' },
    { key: 'goal', title: '프로젝트 목표' },
    { key: 'type', title: '프로젝트 유형' },
    { key: 'plan', title: '담당자·일정' },
    { key: 'confirm', title: '확인·시작' },
  ]

  const TYPE_DESC: Record<string, string> = {
    ax: '반복업무를 진단하고 먼저 만들 업무와 기능을 설계합니다.',
    website: '홈페이지 목적·구조·콘텐츠·디자인 방향을 설계합니다.',
    ax_website: '업무개선과 홈페이지 설계를 각각 진행합니다.',
  }

  const validateStep = (i: number): boolean => {
    const e = validate(form)
    const check = (keys: (keyof FormErrors)[]) => {
      const stepErr: FormErrors = {}
      let bad = false
      for (const k of keys) { stepErr[k] = e[k]; if (e[k]) bad = true }
      setErrors((prev) => ({ ...prev, ...stepErr }))
      if (bad) focusFirstError(stepErr)
      return !bad
    }
    if (i === 0) return check(['organizationId'])
    if (i === 1) return check(['name', 'objective'])
    if (i === 3) return check(['ownerId', 'dueDate', 'nextAction', 'progress', 'targetMvpLevel'])
    return true
  }

  const goNext = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  const goPrev = () => { if (step === 0) { allowNavigation(); navigate(cancelTo) } else setStep((s) => s - 1) }

  const orgName = organizations.find((o) => o.id === form.organizationId)?.name ?? '미선택'
  const summary = (
    <dl className="text-[0.9rem]">
      {[['고객사', orgName], ['프로젝트명', form.name], ['유형', PROJECT_TYPE_META[form.projectType].label], ['담당자', INTERNAL_MEMBERS.find((m) => m.id === form.ownerId)?.name ?? '']].map(([l, v]) => (
        <div key={l} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
          <dt className="shrink-0 text-slate-500">{l}</dt>
          <dd className="min-w-0 break-keep text-right font-medium text-slate-800">{v || <span className="text-slate-300">미입력</span>}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <>
      <WizardLayout
        title={isEdit ? '프로젝트 수정' : '프로젝트 등록'}
        description={isEdit ? `${existing?.projectCode} ${existing?.name}의 계획을 단계별로 수정합니다.` : '단계별로 입력하면 프로젝트 코드가 자동 생성됩니다.'}
        steps={STEPS}
        current={step}
        onStepChange={(i) => { if (i <= step) setStep(i) }}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={handleSubmit}
        submitLabel={isEdit ? '저장' : '프로젝트 시작하기'}
        saving={saving}
        summary={summary}
      >
        {existing?.archivedAt && (
          <p className="mb-4 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-[0.9rem] break-keep text-warning-700">
            보관 처리된 프로젝트입니다. 수정 내용은 저장되지만 기본 목록에는 표시되지 않습니다.
          </p>
        )}

        {step === 0 && (
          <FormSection title="어느 고객사의 프로젝트인가요?" description="프로젝트를 진행할 고객사를 선택합니다.">
            <SelectField id={FIELD_IDS.organizationId} label="고객사" required value={form.organizationId} onChange={(e) => set('organizationId', e.target.value)} error={errors.organizationId} placeholder="고객사 선택" options={organizations.map((org) => ({ value: org.id, label: org.name }))} disabled={isEdit} />
          </FormSection>
        )}

        {step === 1 && (
          <FormSection title="프로젝트 목표" description="어떤 문제를 해결하는 프로젝트인지 정의합니다.">
            <TextField id={FIELD_IDS.name} label="프로젝트명" required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="예: 생산계획 AX MVP" />
            <TextAreaField id={FIELD_IDS.objective} label="프로젝트 목적" required value={form.objective} onChange={(e) => set('objective', e.target.value)} error={errors.objective} placeholder="이 프로젝트로 해결할 문제와 기대 효과를 한두 문장으로 정리하세요." />
          </FormSection>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[1.15rem] font-bold text-slate-900">프로젝트 유형</h2>
              <p className="mt-1 text-[0.95rem] text-slate-500">유형에 따라 진행 단계가 달라집니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(PROJECT_TYPE_META) as ProjectType[]).map((type) => {
                const selected = form.projectType === type
                return (
                  <button key={type} type="button" onClick={() => handleTypeChange(type)}
                    className={`flex flex-col items-start gap-1 rounded-(--radius-card) border-2 p-4 text-left transition-colors ${selected ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className="text-[1.05rem] font-bold text-slate-900">{PROJECT_TYPE_META[type].label}</span>
                    <span className="text-[0.95rem] break-keep text-slate-600">{TYPE_DESC[type] ?? ''}</span>
                  </button>
                )
              })}
            </div>
            <FormSection title="목표 수준" description="이번 프로젝트의 목표 수준을 정합니다.">
              <SelectField id={FIELD_IDS.currentMvpLevel} label={`현재 ${levelLabel}`} value={String(form.currentMvpLevel)} onChange={(e) => set('currentMvpLevel', Number(e.target.value) as MvpLevel)} options={levelOptions} />
              <SelectField id={FIELD_IDS.targetMvpLevel} label={`목표 ${levelLabel}`} value={String(form.targetMvpLevel)} onChange={(e) => set('targetMvpLevel', Number(e.target.value) as MvpLevel)} error={errors.targetMvpLevel} options={levelOptions} />
            </FormSection>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <FormSection title="담당자·일정" description="담당자와 목표 완료일, 지금 해야 할 다음 행동을 정합니다.">
              <SelectField id={FIELD_IDS.ownerId} label="내부 담당자" required value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)} error={errors.ownerId} options={INTERNAL_MEMBERS.map((member) => ({ value: member.id, label: `${member.name} · ${member.role}` }))} />
              <SelectField id={FIELD_IDS.currentStage} label="현재 단계" required value={form.currentStage} onChange={(e) => set('currentStage', e.target.value as ProjectStage)} options={stageFlow.map((stage) => ({ value: stage, label: PROJECT_STAGE_META[stage].label }))} />
              <SelectField id={FIELD_IDS.status} label="프로젝트 상태" value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)} options={(['planned', 'active', 'waiting_client', 'on_hold', 'completed'] as const).map((status) => ({ value: status, label: PROJECT_STATUS_META[status].label }))} />
              <TextField id={FIELD_IDS.progress} label="진행률 (%)" type="number" min={0} max={100} inputMode="numeric" value={form.progress} onChange={(e) => set('progress', e.target.value)} error={errors.progress} />
              <TextField id={FIELD_IDS.startDate} label="시작일" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              <TextField id={FIELD_IDS.dueDate} label="목표 완료일" required type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} error={errors.dueDate} />
              <TextField id={FIELD_IDS.nextAction} label="다음 행동" required fullWidth value={form.nextAction} onChange={(e) => set('nextAction', e.target.value)} error={errors.nextAction} placeholder="예: 대표자 진단 설문 준비" />
              <TextField id={FIELD_IDS.nextActionDueDate} label="다음 행동 예정일" type="date" value={form.nextActionDueDate} onChange={(e) => set('nextActionDueDate', e.target.value)} help={nextActionDday?.overdue ? `예정일이 ${Math.abs(nextActionDday.daysLeft)}일 지났습니다.` : undefined} />
            </FormSection>
            <FormSection title="자금조달 연계 (선택)" description="정책자금·보증 연계가 필요한 프로젝트인지 설정합니다.">
              <RadioGroupField id={FIELD_IDS.fundingRequired} label="자금조달 연계 여부" fullWidth value={form.fundingRequired ? 'yes' : 'no'} onChange={(value) => set('fundingRequired', value === 'yes')} options={[{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }]} />
              {form.fundingRequired && (
                <>
                  <CheckboxGroupField label="목표 기관 (복수 선택)" values={form.targetInstitutions} options={TARGET_INSTITUTIONS} onChange={(values) => set('targetInstitutions', values)} />
                  <CurrencyField id={FIELD_IDS.targetFundingAmount} label="목표 자금 금액" value={form.targetFundingAmount} onChange={(value) => set('targetFundingAmount', value)} placeholder="예: 80,000,000" />
                </>
              )}
              <TextAreaField id={FIELD_IDS.riskSummary} label="주요 위험요소 (선택)" value={form.riskSummary} onChange={(e) => set('riskSummary', e.target.value)} placeholder="일정·데이터·의사결정 관련 위험을 기록하세요." />
            </FormSection>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[1.15rem] font-bold text-slate-900">입력 내용 확인</h2>
            <dl className="rounded-(--radius-card) border border-slate-200">
              {[['고객사', orgName], ['프로젝트명', form.name], ['유형', PROJECT_TYPE_META[form.projectType].label], ['목적', form.objective], ['담당자', INTERNAL_MEMBERS.find((m) => m.id === form.ownerId)?.name ?? ''], ['목표 완료일', form.dueDate], ['다음 행동', form.nextAction]].map(([l, v]) => (
                <div key={l} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <dt className="shrink-0 text-[0.95rem] text-slate-500">{l}</dt>
                  <dd className="min-w-0 break-keep text-right text-[0.95rem] font-medium text-slate-800">{v || <span className="text-slate-300">미입력</span>}</dd>
                </div>
              ))}
            </dl>
            <p className="rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-4 py-3 text-[0.95rem] break-keep text-brand-800">
              시작하면 프로젝트 코드가 자동 생성되고, 프로젝트 컨트롤 센터에서 첫 번째 해야 할 일을 안내합니다.
            </p>
          </div>
        )}
      </WizardLayout>

      {/* 생성 완료 화면 */}
      <Modal open={savedProjectId !== null} title="프로젝트를 시작했습니다" onClose={() => { const id = savedProjectId; setSavedProjectId(null); if (id) { setActiveProject(id); navigate(`/projects/${id}`) } }}>
        {savedProjectId && (() => {
          const saved = projectRepository.getById(savedProjectId)
          const j = saved ? computeProjectJourney(saved) : null
          return (
            <div className="flex flex-col gap-3">
              <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                <p className="text-[0.9rem] text-slate-500">{saved?.projectCode} · {saved ? PROJECT_TYPE_META[saved.projectType].label : ''}</p>
                <p className="mt-0.5 text-[1.1rem] font-bold text-slate-900">{saved?.name}</p>
              </div>
              {j && (
                <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-4 py-3">
                  <p className="text-[0.85rem] font-semibold text-brand-700">첫 번째 해야 할 일</p>
                  <p className="mt-0.5 text-[0.95rem] break-keep text-slate-700">{j.actionText}</p>
                </div>
              )}
              <Button variant="primary" onClick={() => { const id = savedProjectId; setSavedProjectId(null); if (id) { setActiveProject(id); navigate(`/projects/${id}`) } }}>프로젝트 열기</Button>
            </div>
          )
        })()}
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
