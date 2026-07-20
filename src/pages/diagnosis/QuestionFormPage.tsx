import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RespondentRole } from '../../types'
import type {
  ExpertRiskGrade,
  QuestionCategory,
  QuestionInput,
  QuestionScope,
  QuestionType,
  ScoringDomain,
} from '../../types/survey'
import {
  EXPERT_RISK_GRADES,
  EXPERT_RISK_META,
  INDUSTRY_KEYS,
  INDUSTRY_KEY_META,
  OBJECTIVE_KEYS,
  OBJECTIVE_KEY_META,
  QUESTION_CATEGORIES,
  QUESTION_CATEGORY_META,
  QUESTION_SCOPES,
  QUESTION_SCOPE_META,
  QUESTION_TYPES,
  QUESTION_TYPE_META,
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
  SCORING_DOMAINS,
  SCORING_DOMAIN_META,
  questionNeedsColumns,
  questionNeedsOptions,
} from '../../lib/surveyMeta'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { questionRepository } from '../../repositories'
import {
  createQuestion,
  updateQuestion,
  validateQuestion,
  type QuestionErrors,
} from '../../services/questionService'
import { buildOptions, buildColumns, YES_NO_OPTS, SCALE_5_OPTS } from '../../data/seed/surveyFactory'
import { FormSection } from '../../components/form/FormSection'
import {
  CheckboxGroupField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/form/fields'
import { OptionEditor } from '../../components/diagnosis/OptionEditor'
import { RepeatTableColumnEditor } from '../../components/diagnosis/RepeatTableColumnEditor'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { PageHeader } from '../../components/ui/PageHeader'
import { DiagnosisStudioNav } from '../../components/diagnosis/DiagnosisStudioNav'
import { useToast } from '../../components/ui/toastContext'
import type { QuestionOption, RepeatTableColumn } from '../../types/survey'

interface FormState {
  code: string
  text: string
  helpText: string
  example: string
  type: QuestionType
  category: QuestionCategory
  respondentRole: RespondentRole
  scope: QuestionScope
  industryKeys: string[]
  objectiveKeys: string[]
  requiredDefault: boolean
  scoringDomain: ScoringDomain
  scoringWeight: number
  expertRiskGrade: ExpertRiskGrade
  riskReason: string
  analysisTags: string
  options: QuestionOption[]
  repeatTableColumns: RepeatTableColumn[]
  active: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  text: '',
  helpText: '',
  example: '',
  type: 'single_choice',
  category: 'workflow',
  respondentRole: 'worker',
  scope: 'common',
  industryKeys: [],
  objectiveKeys: [],
  requiredDefault: false,
  scoringDomain: 'none',
  scoringWeight: 0,
  expertRiskGrade: 'green',
  riskReason: '',
  analysisTags: '',
  options: [],
  repeatTableColumns: [],
  active: true,
}

const FIELD_IDS: Record<string, string> = {
  code: 'q-code',
  text: 'q-text',
  type: 'q-type',
  options: 'q-options',
  repeatTableColumns: 'q-columns',
  scoringWeight: 'q-weight',
  riskReason: 'q-risk-reason',
  industryKeys: 'q-industry',
  objectiveKeys: 'q-objective',
}

function toFormState(input: QuestionInput): FormState {
  return {
    code: input.code,
    text: input.text,
    helpText: input.helpText,
    example: input.example,
    type: input.type,
    category: input.category,
    respondentRole: input.respondentRole,
    scope: input.scope,
    industryKeys: input.industryKeys,
    objectiveKeys: input.objectiveKeys,
    requiredDefault: input.requiredDefault,
    scoringDomain: input.scoringDomain,
    scoringWeight: input.scoringWeight,
    expertRiskGrade: input.expertRiskGrade,
    riskReason: input.riskReason,
    analysisTags: input.analysisTags.join(', '),
    options: input.options,
    repeatTableColumns: input.repeatTableColumns,
    active: input.active,
  }
}

function toInput(form: FormState): QuestionInput {
  return {
    code: form.code.trim().toUpperCase(),
    text: form.text.trim(),
    helpText: form.helpText.trim(),
    example: form.example.trim(),
    type: form.type,
    category: form.category,
    respondentRole: form.respondentRole,
    scope: form.scope,
    industryKeys: form.industryKeys,
    objectiveKeys: form.objectiveKeys,
    requiredDefault: form.requiredDefault,
    scoringDomain: form.scoringDomain,
    scoringWeight: form.scoringDomain === 'none' ? 0 : form.scoringWeight,
    expertRiskGrade: form.expertRiskGrade,
    riskReason: form.riskReason.trim(),
    analysisTags: form.analysisTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    options: form.options,
    repeatTableColumns: form.repeatTableColumns,
    active: form.active,
  }
}

export function QuestionFormPage() {
  const { questionId } = useParams()
  const isEdit = questionId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existing = useMemo(
    () => (questionId ? questionRepository.getById(questionId) : null),
    [questionId],
  )

  const [form, setForm] = useState<FormState>(() =>
    existing ? toFormState(existing) : EMPTY_FORM,
  )
  const [errors, setErrors] = useState<QuestionErrors>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  if (isEdit && !existing) {
    return (
      <NotFoundState
        title="질문을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 질문입니다."
        backTo="/diagnosis/questions"
        backLabel="질문은행으로 돌아가기"
      />
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  /** 유형 변경 시 yes_no·scale_5 기본 선택지를 제안 */
  const handleTypeChange = (type: QuestionType) => {
    setForm((prev) => {
      let options = prev.options
      if (questionNeedsOptions(type)) {
        if (type === 'yes_no' && prev.type !== 'yes_no') {
          options = buildOptions(YES_NO_OPTS)
        } else if (type === 'scale_5' && prev.type !== 'scale_5') {
          options = buildOptions(SCALE_5_OPTS)
        } else if (prev.options.length === 0) {
          options = []
        }
      }
      const columns =
        questionNeedsColumns(type) && prev.repeatTableColumns.length === 0
          ? buildColumns([
              ['업무명', 'short_text', true],
              ['월 처리건수', 'number', false, '건'],
            ])
          : prev.repeatTableColumns
      return { ...prev, type, options, repeatTableColumns: columns }
    })
    setDirty(true)
  }

  const focusFirstError = (nextErrors: QuestionErrors) => {
    const order = [
      'code',
      'text',
      'options',
      'repeatTableColumns',
      'scoringWeight',
      'riskReason',
      'industryKeys',
      'objectiveKeys',
    ]
    const firstKey = order.find((key) => nextErrors[key as keyof QuestionErrors])
    if (firstKey && FIELD_IDS[firstKey]) {
      document.getElementById(FIELD_IDS[firstKey])?.focus()
    }
  }

  const handleSubmit = () => {
    if (saving) return
    const input = toInput(form)
    const nextErrors = validateQuestion(input, questionId)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      // 고급 설정 안의 오류면 접힌 영역을 먼저 펼친 뒤 포커스한다
      const advancedErrorKeys = ['code', 'scoringWeight', 'riskReason', 'industryKeys', 'objectiveKeys'] as const
      if (advancedErrorKeys.some((k) => nextErrors[k])) setAdvancedOpen(true)
      setTimeout(() => focusFirstError(nextErrors), 0)
      return
    }
    setSaving(true)
    try {
      const saved = questionId
        ? updateQuestion(questionId, input)
        : createQuestion(input)
      allowNavigation()
      showToast(
        isEdit ? '질문을 저장했습니다.' : `${saved.code} 질문을 등록했습니다.`,
      )
      navigate('/diagnosis/questions')
    } catch (error) {
      setSaving(false)
      showToast(error instanceof Error ? error.message : '저장에 실패했습니다.')
    }
  }

  const showOptions = questionNeedsOptions(form.type)
  const showColumns = questionNeedsColumns(form.type)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <PageHeader
        title={isEdit ? '질문 수정' : '질문 등록'}
        description="AX 진단에 사용할 질문의 내용, 응답 방식, 분석 설정을 정의합니다."
      />
      <DiagnosisStudioNav />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-5"
      >
        <FormSection title="질문 내용" description="응답자가 보게 될 질문 문구와 설명을 작성합니다.">
          <TextAreaField
            id={FIELD_IDS.text}
            label="질문 문구"
            required
            rows={2}
            value={form.text}
            onChange={(e) => set('text', e.target.value)}
            error={errors.text}
            placeholder="응답자가 이해하기 쉬운 문장으로 작성하세요."
          />
          <TextField
            id="q-help"
            label="쉬운 설명"
            fullWidth
            value={form.helpText}
            onChange={(e) => set('helpText', e.target.value)}
            placeholder="질문 의도를 돕는 한 줄 설명"
          />
          <TextField
            id="q-example"
            label="입력 예시"
            fullWidth
            value={form.example}
            onChange={(e) => set('example', e.target.value)}
            placeholder="실제 입력 예시"
          />
          <SelectField
            id="q-category"
            label="질문 범주"
            value={form.category}
            onChange={(e) => set('category', e.target.value as QuestionCategory)}
            options={QUESTION_CATEGORIES.map((c) => ({
              value: c,
              label: QUESTION_CATEGORY_META[c].label,
            }))}
          />
        </FormSection>

        <FormSection title="답변 방식" description="답변 유형과 선택지, 필수 여부를 설정합니다.">
          <SelectField
            id={FIELD_IDS.type}
            label="답변 유형"
            required
            value={form.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            options={QUESTION_TYPES.map((t) => ({
              value: t,
              label: QUESTION_TYPE_META[t].label,
            }))}
          />
          <SelectField
            id="q-required"
            label="기본 필수 여부"
            value={form.requiredDefault ? 'yes' : 'no'}
            onChange={(e) => set('requiredDefault', e.target.value === 'yes')}
            options={[
              { value: 'no', label: '선택 응답' },
              { value: 'yes', label: '필수 응답' },
            ]}
          />
          {showOptions && (
            <div id={FIELD_IDS.options}>
              <OptionEditor
                options={form.options}
                onChange={(o) => set('options', o)}
                error={errors.options}
              />
            </div>
          )}
          {showColumns && (
            <div id={FIELD_IDS.repeatTableColumns}>
              <RepeatTableColumnEditor
                columns={form.repeatTableColumns}
                onChange={(c) => set('repeatTableColumns', c)}
                error={errors.repeatTableColumns}
              />
            </div>
          )}
          {!showOptions && !showColumns && (
            <p className="text-[13px] text-slate-400 sm:col-span-2">
              이 유형은 선택지·컬럼 설정이 필요하지 않습니다.
            </p>
          )}
        </FormSection>

        <FormSection title="응답 대상" description="이 질문을 누구에게 물어볼지 정합니다.">
          <SelectField
            id="q-role"
            label="응답 대상"
            value={form.respondentRole}
            onChange={(e) => set('respondentRole', e.target.value as RespondentRole)}
            options={RESPONDENT_ROLES.map((r) => ({
              value: r,
              label: RESPONDENT_ROLE_META[r].label,
            }))}
          />
          <SelectField
            id="q-active"
            label="사용 여부"
            value={form.active ? 'active' : 'inactive'}
            onChange={(e) => set('active', e.target.value === 'active')}
            options={[
              { value: 'active', label: '사용함' },
              { value: 'inactive', label: '사용 안 함' },
            ]}
          />
        </FormSection>

        {/* 고급 분석 설정 — 자동 점수·분석 규칙 (기본 접힘) */}
        <details
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
          className="group rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4">
            <span className="min-w-0">
              <span className="text-[15px] font-semibold text-slate-900">고급 분석 설정</span>
              <span className="mt-0.5 block text-[13px] break-keep text-slate-500">
                자동 점수와 분석 규칙을 수정할 때만 사용합니다.
              </span>
            </span>
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-slate-100 px-5 py-5 sm:grid-cols-2">
            <TextField
              id={FIELD_IDS.code}
              label="질문 코드"
              required
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              error={errors.code}
              placeholder="예: COM-WF-010"
              help="영역-주제-번호 형식을 권장합니다. 중복될 수 없습니다."
            />
            <SelectField
              id="q-scope"
              label="질문 범위"
              value={form.scope}
              onChange={(e) => set('scope', e.target.value as QuestionScope)}
              options={QUESTION_SCOPES.map((s) => ({
                value: s,
                label: QUESTION_SCOPE_META[s].label,
              }))}
            />
            {form.scope === 'industry' && (
              <CheckboxGroupField
                label="관련 업종"
                values={form.industryKeys}
                options={INDUSTRY_KEYS}
                renderLabel={(k) => INDUSTRY_KEY_META[k]?.label ?? k}
                onChange={(v) => set('industryKeys', v)}
                error={errors.industryKeys}
              />
            )}
            {form.scope === 'objective' && (
              <CheckboxGroupField
                label="관련 목적"
                values={form.objectiveKeys}
                options={OBJECTIVE_KEYS}
                renderLabel={(k) => OBJECTIVE_KEY_META[k]?.label ?? k}
                onChange={(v) => set('objectiveKeys', v)}
                error={errors.objectiveKeys}
              />
            )}
            <SelectField
              id="q-scoring"
              label="점수 영역"
              value={form.scoringDomain}
              onChange={(e) => {
                const domain = e.target.value as ScoringDomain
                setForm((prev) => ({
                  ...prev,
                  scoringDomain: domain,
                  scoringWeight: domain === 'none' ? 0 : prev.scoringWeight || 2,
                }))
                setDirty(true)
              }}
              options={SCORING_DOMAINS.map((d) => ({
                value: d,
                label: SCORING_DOMAIN_META[d].label,
              }))}
            />
            <TextField
              id={FIELD_IDS.scoringWeight}
              label="점수 가중치 (0~5)"
              type="number"
              min={0}
              max={5}
              value={String(form.scoringWeight)}
              disabled={form.scoringDomain === 'none'}
              onChange={(e) => set('scoringWeight', Number(e.target.value) || 0)}
              error={errors.scoringWeight}
              help={form.scoringDomain === 'none' ? '점수 영역이 없으면 0으로 고정됩니다.' : undefined}
            />
            <SelectField
              id="q-risk"
              label="전문가 위험등급"
              value={form.expertRiskGrade}
              onChange={(e) => set('expertRiskGrade', e.target.value as ExpertRiskGrade)}
              options={EXPERT_RISK_GRADES.map((g) => ({
                value: g,
                label: EXPERT_RISK_META[g].label,
              }))}
            />
            <TextField
              id="q-tags"
              label="분석 태그"
              value={form.analysisTags}
              onChange={(e) => set('analysisTags', e.target.value)}
              placeholder="쉼표로 구분 (예: 반복업무, 데이터)"
            />
            <TextField
              id={FIELD_IDS.riskReason}
              label="위험 이유"
              fullWidth
              value={form.riskReason}
              onChange={(e) => set('riskReason', e.target.value)}
              error={errors.riskReason}
              placeholder="전문가 확인이 필요한 이유 (red 등급은 필수)"
            />
            {existing && (
              <TextField
                id="q-version"
                label="버전"
                value={`v${existing.version}`}
                disabled
                onChange={() => undefined}
              />
            )}
          </div>
        </details>

        <div className="flex items-center justify-end gap-2 pb-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/diagnosis/questions')}
            disabled={saving}
          >
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? '저장 중…' : isEdit ? '저장' : '질문 등록'}
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
