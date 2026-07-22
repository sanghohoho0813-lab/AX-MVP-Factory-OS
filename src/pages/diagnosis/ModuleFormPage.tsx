import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RespondentRole } from '../../types'
import type {
  ModuleKind,
  ModuleStatus,
  SurveyModuleInput,
} from '../../types/survey'
import {
  INDUSTRY_KEYS,
  INDUSTRY_KEY_META,
  MODULE_STATUS_META,
  OBJECTIVE_KEYS,
  OBJECTIVE_KEY_META,
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
} from '../../lib/surveyMeta'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { surveyModuleRepository } from '../../repositories'
import { FormSection } from '../../components/form/FormSection'
import {
  CheckboxGroupField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/form/fields'
import { ModuleQuestionPicker } from '../../components/diagnosis/ModuleQuestionPicker'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { PageHeader } from '../../components/ui/PageHeader'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { useToast } from '../../components/ui/toastContext'

interface FormState {
  name: string
  description: string
  kind: ModuleKind
  keys: string[]
  recommendedRespondentRoles: RespondentRole[]
  questionIds: string[]
  status: ModuleStatus
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  kind: 'industry',
  keys: [],
  recommendedRespondentRoles: ['worker', 'manager'],
  questionIds: [],
  status: 'draft',
}

export function ModuleFormPage() {
  const { moduleId } = useParams()
  const isEdit = moduleId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existing = useMemo(
    () => (moduleId ? surveyModuleRepository.getById(moduleId) : null),
    [moduleId],
  )

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          name: existing.name,
          description: existing.description,
          kind: existing.kind,
          keys: existing.keys,
          recommendedRespondentRoles: existing.recommendedRespondentRoles,
          questionIds: existing.questionIds,
          status: existing.status,
        }
      : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<{ name?: string; keys?: string }>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  if (isEdit && !existing) {
    return (
      <NotFoundState
        title="모듈을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 모듈입니다."
        backTo="/diagnosis/modules"
        backLabel="모듈 목록으로 돌아가기"
      />
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleKindChange = (kind: ModuleKind) => {
    setForm((prev) => ({ ...prev, kind, keys: [] }))
    setDirty(true)
  }

  const handleSubmit = () => {
    if (saving) return
    const nextErrors: { name?: string; keys?: string } = {}
    if (!form.name.trim()) nextErrors.name = '모듈명을 입력해 주세요.'
    if (form.keys.length === 0) {
      nextErrors.keys =
        form.kind === 'industry'
          ? '관련 업종을 1개 이상 선택해 주세요.'
          : '관련 목적을 1개 이상 선택해 주세요.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      document.getElementById(nextErrors.name ? 'mod-name' : 'mod-keys')?.focus()
      return
    }
    setSaving(true)
    const input: SurveyModuleInput = {
      name: form.name.trim(),
      description: form.description.trim(),
      kind: form.kind,
      keys: form.keys,
      recommendedRespondentRoles: form.recommendedRespondentRoles,
      questionIds: form.questionIds,
      status: form.status,
    }
    try {
      const saved = moduleId
        ? surveyModuleRepository.update(moduleId, input)
        : surveyModuleRepository.create(input)
      allowNavigation()
      showToast(isEdit ? '모듈을 저장했습니다.' : `${saved.name} 모듈을 등록했습니다.`)
      navigate('/diagnosis/modules')
    } catch (error) {
      setSaving(false)
      showToast(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  const roleOptions = RESPONDENT_ROLES.map((r) => RESPONDENT_ROLE_META[r].label)
  const roleLabelToValue = new Map(
    RESPONDENT_ROLES.map((r) => [RESPONDENT_ROLE_META[r].label, r]),
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title={isEdit ? '모듈 수정' : '모듈 등록'}
        description="공통 질문은행에서 업종·목적에 맞는 질문 묶음을 구성합니다."
      />
      <DiagnosisStudioNav />

      <FormSection title="모듈 기본정보" description="모듈의 이름과 종류, 관련 키를 정의합니다.">
        <TextField
          id="mod-name"
          label="모듈명"
          required
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="예: 제조업 현장 운영"
        />
        <SelectField
          id="mod-kind"
          label="모듈 종류"
          value={form.kind}
          onChange={(e) => handleKindChange(e.target.value as ModuleKind)}
          options={[
            { value: 'industry', label: '업종 모듈' },
            { value: 'objective', label: '목적 모듈' },
          ]}
        />
        <TextAreaField
          id="mod-desc"
          label="설명"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="이 모듈이 진단하는 영역을 설명하세요."
        />
        <div id="mod-keys">
          <CheckboxGroupField
            label={form.kind === 'industry' ? '관련 업종' : '관련 목적'}
            values={form.keys}
            options={form.kind === 'industry' ? INDUSTRY_KEYS : OBJECTIVE_KEYS}
            renderLabel={(k) =>
              form.kind === 'industry'
                ? (INDUSTRY_KEY_META[k]?.label ?? k)
                : (OBJECTIVE_KEY_META[k]?.label ?? k)
            }
            onChange={(v) => {
              set('keys', v)
              setErrors((p) => ({ ...p, keys: undefined }))
            }}
            error={errors.keys}
          />
          <p className="mt-1 text-[0.875rem] text-slate-400">
            {form.keys
              .map((k) =>
                form.kind === 'industry'
                  ? INDUSTRY_KEY_META[k]?.label
                  : OBJECTIVE_KEY_META[k]?.label,
              )
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
        <CheckboxGroupField
          label="권장 응답자"
          values={form.recommendedRespondentRoles.map(
            (r) => RESPONDENT_ROLE_META[r].label,
          )}
          options={roleOptions}
          onChange={(labels) =>
            set(
              'recommendedRespondentRoles',
              labels
                .map((l) => roleLabelToValue.get(l))
                .filter((r): r is RespondentRole => r !== undefined),
            )
          }
        />
        <SelectField
          id="mod-status"
          label="상태"
          value={form.status}
          onChange={(e) => set('status', e.target.value as ModuleStatus)}
          options={(['draft', 'active'] as const).map((s) => ({
            value: s,
            label: MODULE_STATUS_META[s].label,
          }))}
        />
      </FormSection>

      <Panel title={`연결 질문 (${form.questionIds.length})`}>
        <p className="mb-3 text-[13px] text-slate-500">
          {form.kind === 'industry'
            ? '업종 특화 질문을 우선 추천합니다. 공통 질문도 필요하면 추가할 수 있습니다.'
            : '목적 특화 질문을 우선 추천합니다. 공통 질문도 필요하면 추가할 수 있습니다.'}
        </p>
        <ModuleQuestionPicker
          questionIds={form.questionIds}
          onChange={(ids) => set('questionIds', ids)}
          preferredScope={form.kind === 'industry' ? 'industry' : 'objective'}
        />
      </Panel>

      <div className="flex items-center justify-end gap-2 pb-2">
        <Button
          variant="secondary"
          onClick={() => navigate('/diagnosis/modules')}
          disabled={saving}
        >
          취소
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {saving ? '저장 중…' : isEdit ? '저장' : '모듈 등록'}
        </Button>
      </div>

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
