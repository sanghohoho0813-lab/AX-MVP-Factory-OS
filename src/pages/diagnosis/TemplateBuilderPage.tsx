import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, Send } from 'lucide-react'
import type { RespondentRole } from '../../types'
import type {
  SurveyPurpose,
  SurveySection,
  SurveyTemplateInput,
} from '../../types/survey'
import {
  RESPONDENT_ROLES,
  RESPONDENT_ROLE_META,
  SURVEY_PURPOSE_META,
} from '../../lib/surveyMeta'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { generateId } from '../../storage/localStore'
import { surveyTemplateRepository } from '../../repositories'
import {
  buildQuestionMap,
  publishTemplate,
} from '../../services/surveyTemplateService'
import {
  calculateSurveyQuality,
  computeCompositionSummary,
  resolveTemplateSections,
  summarizeQuality,
} from '../../services/surveyComposition'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { QuestionLibraryPanel } from '../../components/diagnosis/QuestionLibraryPanel'
import { TemplateSectionEditor } from '../../components/diagnosis/TemplateSectionEditor'
import { SurveyQualityPanel } from '../../components/diagnosis/SurveyQualityPanel'
import { SurveyCompositionSummaryView } from '../../components/diagnosis/SurveyCompositionSummary'
import { useToast } from '../../components/ui/toastContext'

type BuilderTab = 'library' | 'sections' | 'summary'

export function TemplateBuilderPage() {
  const { templateId } = useParams()
  const isEdit = templateId !== undefined
  const navigate = useNavigate()
  const { showToast } = useToast()

  const existing = useMemo(
    () => (templateId ? surveyTemplateRepository.getById(templateId) : null),
    [templateId],
  )
  const questionById = useMemo(() => buildQuestionMap(), [])

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [respondentRole, setRespondentRole] = useState<RespondentRole>(
    existing?.respondentRole ?? 'owner',
  )
  const [purpose, setPurpose] = useState<SurveyPurpose>(
    existing?.purpose ?? 'ax_diagnosis',
  )
  const [sections, setSections] = useState<SurveySection[]>(
    existing?.sections ?? [],
  )
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileTab, setMobileTab] = useState<BuilderTab>('sections')
  const [publishBlocked, setPublishBlocked] = useState(false)
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  const addedIds = useMemo(
    () =>
      new Set(sections.flatMap((s) => s.placements.map((p) => p.questionId))),
    [sections],
  )

  const activeSectionId = sections[0]?.id ?? null

  const resolved = useMemo(
    () => resolveTemplateSections(sections, questionById),
    [sections, questionById],
  )
  const summary = useMemo(
    () => computeCompositionSummary(resolved),
    [resolved],
  )
  const quality = useMemo(
    () =>
      calculateSurveyQuality(resolved, { respondentRole }),
    [resolved, respondentRole],
  )
  const qualityVerdict = summarizeQuality(quality).verdict

  if (isEdit && !existing) {
    return (
      <NotFoundState
        title="템플릿을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 템플릿입니다."
        backTo="/diagnosis/templates"
        backLabel="템플릿 목록으로 돌아가기"
      />
    )
  }

  // 게시된 템플릿은 직접 수정 불가 → 안내 화면
  if (existing && existing.status === 'published') {
    return (
      <div className="flex flex-col gap-5">
        <DetailHeader
          backTo="/diagnosis/templates"
          backLabel="설문 템플릿"
          title={existing.name}
        />
        <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold break-keep text-warning-800">
            게시된 템플릿은 기존 프로젝트의 일관성을 위해 직접 수정하지 않습니다.
          </p>
          <p className="mt-1 text-[13px] break-keep text-warning-700">
            새 버전을 생성해 수정하세요. 새 버전은 초안 상태로 만들어집니다.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate(`/diagnosis/templates/${existing.id}/preview`)}
            >
              미리보기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const next = surveyTemplateRepository.createNewVersion(existing.id)
                showToast(`새 버전(v${next.version}) 초안을 생성했습니다.`)
                navigate(`/diagnosis/templates/${next.id}/edit`)
              }}
            >
              새 버전 만들기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const markDirty = () => setDirty(true)

  const updateSections = (next: SurveySection[]) => {
    setSections(next)
    markDirty()
  }

  const addQuestion = (questionId: string) => {
    setSections((prev) => {
      let target = prev
      if (prev.length === 0) {
        target = [
          {
            id: generateId(),
            title: '새 섹션 1',
            description: '',
            orderIndex: 0,
            placements: [],
          },
        ]
      }
      const targetId = activeSectionId ?? target[0].id
      const question = questionById.get(questionId)
      return target.map((s) =>
        s.id === targetId
          ? {
              ...s,
              placements: [
                ...s.placements,
                {
                  id: generateId(),
                  questionId,
                  required: question?.requiredDefault ?? false,
                  condition: null,
                  orderIndex: s.placements.length,
                },
              ],
            }
          : s,
      )
    })
    markDirty()
  }

  const buildInput = (): SurveyTemplateInput => ({
    name: name.trim() || '제목 없는 템플릿',
    description: description.trim(),
    respondentRole,
    purpose,
    sections,
    status: 'draft',
  })

  const persist = (): string | null => {
    const input = buildInput()
    const estimatedMinutes = computeCompositionSummary(
      resolveTemplateSections(sections, questionById),
    ).estimatedMinutes
    try {
      if (templateId && existing) {
        surveyTemplateRepository.update(templateId, input, estimatedMinutes)
        return templateId
      }
      const created = surveyTemplateRepository.create(input, estimatedMinutes)
      return created.id
    } catch (error) {
      showToast(error instanceof Error ? error.message : '저장에 실패했습니다.')
      return null
    }
  }

  const handleSaveDraft = () => {
    if (saving) return
    setSaving(true)
    const id = persist()
    if (id) {
      allowNavigation()
      showToast('템플릿 초안을 저장했습니다.')
      navigate('/diagnosis/templates')
    } else {
      setSaving(false)
    }
  }

  const handlePublish = () => {
    if (saving) return
    setSaving(true)
    const id = persist()
    if (!id) {
      setSaving(false)
      return
    }
    try {
      publishTemplate(id)
      allowNavigation()
      showToast(`${name || '템플릿'}을(를) 게시했습니다.`)
      navigate('/diagnosis/templates')
    } catch {
      setSaving(false)
      setPublishBlocked(true)
    }
  }

  const handlePreview = () => {
    const id = persist()
    if (id) {
      allowNavigation()
      setDirty(false)
      navigate(`/diagnosis/templates/${id}/preview`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/diagnosis/templates"
        backLabel="설문 템플릿"
        title={isEdit ? '템플릿 편집' : '새 템플릿'}
        actions={
          <>
            <Button variant="secondary" onClick={handlePreview} disabled={saving}>
              <Eye aria-hidden="true" className="size-4" />
              미리보기
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
              초안 저장
            </Button>
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={saving || qualityVerdict === 'error'}
              title={qualityVerdict === 'error' ? '품질 오류를 먼저 해결하세요.' : undefined}
            >
              <Send aria-hidden="true" className="size-4" />
              게시
            </Button>
          </>
        }
      />

      {/* 기본정보 */}
      <div className="grid grid-cols-1 gap-4 rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-4 shadow-(--shadow-card) sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="tpl-name" className="mb-1 block text-[13px] font-medium text-slate-700">
            템플릿명
          </label>
          <input
            id="tpl-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              markDirty()
            }}
            placeholder="예: 대표자용 AX 기본진단"
            className="h-10 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="tpl-role" className="mb-1 block text-[13px] font-medium text-slate-700">
            응답자
          </label>
          <select
            id="tpl-role"
            value={respondentRole}
            onChange={(e) => {
              setRespondentRole(e.target.value as RespondentRole)
              markDirty()
            }}
            className="h-10 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500"
          >
            {RESPONDENT_ROLES.map((r) => (
              <option key={r} value={r}>
                {RESPONDENT_ROLE_META[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tpl-purpose" className="mb-1 block text-[13px] font-medium text-slate-700">
            목적
          </label>
          <select
            id="tpl-purpose"
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value as SurveyPurpose)
              markDirty()
            }}
            className="h-10 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500"
          >
            {(Object.keys(SURVEY_PURPOSE_META) as SurveyPurpose[]).map((p) => (
              <option key={p} value={p}>
                {SURVEY_PURPOSE_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="tpl-desc" className="mb-1 block text-[13px] font-medium text-slate-700">
            설명
          </label>
          <input
            id="tpl-desc"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              markDirty()
            }}
            placeholder="이 템플릿의 용도를 설명하세요."
            className="h-10 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500"
          />
        </div>
      </div>

      {/* 모바일 탭 */}
      <div className="flex gap-1 border-b border-slate-200 lg:hidden">
        {(
          [
            ['library', '질문'],
            ['sections', '섹션 편집'],
            ['summary', '요약·품질'],
          ] as Array<[BuilderTab, string]>
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium ${
              mobileTab === tab
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3열 워크벤치 (lg+) / 탭 (모바일) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_300px] xl:grid-cols-[340px_1fr_340px]">
        <div className={`${mobileTab === 'library' ? '' : 'hidden'} lg:block`}>
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
            <QuestionLibraryPanel addedIds={addedIds} onAdd={addQuestion} />
          </div>
        </div>

        <div className={`${mobileTab === 'sections' ? '' : 'hidden'} min-w-0 lg:block`}>
          {sections.length === 0 ? (
            <div className="rounded-(--radius-panel) border border-dashed border-slate-300 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-600">아직 섹션이 없습니다</p>
              <p className="mt-1 text-[13px] text-slate-400">
                질문 라이브러리에서 질문을 추가하면 첫 섹션이 만들어집니다.
              </p>
            </div>
          ) : (
            <TemplateSectionEditor
              sections={sections}
              questionById={questionById}
              onChange={updateSections}
            />
          )}
        </div>

        <div className={`${mobileTab === 'summary' ? '' : 'hidden'} lg:block`}>
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 shadow-(--shadow-card)">
              <p className="mb-3 text-sm font-semibold text-slate-800">설문 요약</p>
              <SurveyCompositionSummaryView summary={summary} />
            </div>
            <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 shadow-(--shadow-card)">
              <SurveyQualityPanel checks={quality} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={publishBlocked}
        title="게시할 수 없습니다"
        message="품질 오류를 먼저 해결해야 템플릿을 게시할 수 있습니다. 오른쪽 품질검사에서 오류 항목을 확인하세요."
        confirmLabel="확인"
        cancelLabel="닫기"
        onConfirm={() => setPublishBlocked(false)}
        onCancel={() => setPublishBlocked(false)}
      />

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
