import { useMemo, useState } from 'react'
import type { ProjectSurveyBlueprint } from '../../types/survey'
import type { SurveyDistribution } from '../../types/surveyRuntime'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import {
  organizationRepository,
  projectRepository,
  projectSurveyBlueprintRepository,
  surveyDistributionRepository,
} from '../../repositories'
import {
  generateUniqueAccessToken,
  buildSurveyUrl,
} from '../../services/surveyTokenService'
import { issueSurveyDistribution } from '../../services/surveyRuntimeService'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { SelectField, TextAreaField, TextField } from '../form/fields'
import { LocalTestModeBanner } from './LocalTestModeBanner'
import { SurveyLinkCopyField } from './SurveyLinkCopyField'
import { useToast } from '../ui/toastContext'

const DEFAULT_PRIVACY =
  '본 설문은 담당 컨설턴트가 귀사의 업무 진단을 위해 응답 내용을 내부적으로만 활용합니다. 수집 항목은 응답자 성명·직책·연락처 및 설문 응답이며, 실제 운영 전 개인정보 처리 문구는 법적 검토가 필요합니다.'
const DEFAULT_INTRO =
  '안녕하세요. 귀사의 업무 현황과 개선 가능성을 진단하기 위한 설문입니다. 편하게 아시는 범위에서 응답해 주세요.'

const EXPIRY_PRESETS = [
  { label: '3일', days: 3 },
  { label: '7일', days: 7 },
  { label: '14일', days: 14 },
  { label: '30일', days: 30 },
  { label: '만료 없음', days: null },
] as const

interface SurveyLinkCreateModalProps {
  open: boolean
  /** 미리 선택할 프로젝트 */
  presetProjectId?: string
  onClose: () => void
  /** 생성 완료 시 부수효과(목록 새로고침 등). 화면 전환은 하지 말 것 */
  onCreated?: (distribution: SurveyDistribution) => void
  /** 결과 화면의 "링크 상세 보기"에서 호출 */
  onViewDetail?: (distribution: SurveyDistribution) => void
}

function toDateInputValue(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

export function SurveyLinkCreateModal({
  open,
  presetProjectId,
  onClose,
  onCreated,
  onViewDetail,
}: SurveyLinkCreateModalProps) {
  const { showToast } = useToast()

  // ready blueprint를 가진 프로젝트만 대상
  const projectsWithReady = useMemo(() => {
    if (!open) return []
    const all = projectRepository.getAll()
    return all.filter((p) =>
      projectSurveyBlueprintRepository
        .getByProjectId(p.id)
        .some((b) => b.status === 'ready'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const [projectId, setProjectId] = useState(presetProjectId ?? '')
  const [blueprintId, setBlueprintId] = useState('')
  const [surveyTitle, setSurveyTitle] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPosition, setRecipientPosition] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [introMessage, setIntroMessage] = useState(DEFAULT_INTRO)
  const [privacyNotice, setPrivacyNotice] = useState(DEFAULT_PRIVACY)
  const [consentRequired, setConsentRequired] = useState(true)
  /** 만료일 프리셋: 일수 또는 null(만료 없음) */
  const [expiryDays, setExpiryDays] = useState<number | null>(14)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SurveyDistribution | null>(null)

  // 첫 렌더에서 preset 반영
  if (open && presetProjectId && projectId === '' && presetProjectId !== projectId) {
    setProjectId(presetProjectId)
  }

  const readyBlueprints: ProjectSurveyBlueprint[] = useMemo(() => {
    if (!projectId) return []
    return projectSurveyBlueprintRepository
      .getByProjectId(projectId)
      .filter((b) => b.status === 'ready')
  }, [projectId])

  const draftOnly =
    projectId !== '' &&
    readyBlueprints.length === 0 &&
    projectSurveyBlueprintRepository.getByProjectId(projectId).length > 0

  const selectedBlueprint = readyBlueprints.find((b) => b.id === blueprintId) ?? null
  const org = projectId
    ? organizationRepository.getById(
        projectRepository.getById(projectId)?.organizationId ?? '',
      )
    : null

  const reset = () => {
    setProjectId(presetProjectId ?? '')
    setBlueprintId('')
    setSurveyTitle('')
    setRecipientName('')
    setRecipientPosition('')
    setRecipientEmail('')
    setRecipientPhone('')
    setIntroMessage(DEFAULT_INTRO)
    setPrivacyNotice(DEFAULT_PRIVACY)
    setConsentRequired(true)
    setExpiryDays(14)
    setErrors({})
    setResult(null)
    setSaving(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const pickBlueprint = (id: string) => {
    setBlueprintId(id)
    const bp = readyBlueprints.find((b) => b.id === id)
    if (bp && org && !surveyTitle) {
      setSurveyTitle(
        `${org.name} ${RESPONDENT_ROLE_META[bp.respondentRole].label}용 진단 설문`,
      )
    }
  }

  const computeExpiry = (): string | null => {
    if (expiryDays === null) return null // 만료 없음
    return new Date(`${toDateInputValue(expiryDays)}T23:59:59`).toISOString()
  }

  const handleSubmit = () => {
    if (saving) return
    const nextErrors: Record<string, string> = {}
    if (!projectId) nextErrors.project = '프로젝트를 선택해 주세요.'
    if (!blueprintId) nextErrors.blueprint = '준비 완료된 설문을 선택해 주세요.'
    if (!recipientName.trim()) nextErrors.recipientName = '응답자 이름을 입력해 주세요.'

    const expiresAt = computeExpiry()
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      nextErrors.expiry = '만료일은 현재 이후로 설정해 주세요.'
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    if (!selectedBlueprint || !org) return

    setSaving(true)
    try {
      const project = projectRepository.getById(projectId)
      const distribution = issueSurveyDistribution(
        {
          projectId,
          organizationId: org.id,
          blueprintId: selectedBlueprint.id,
          blueprintSnapshot: selectedBlueprint.sections,
          respondentRole: selectedBlueprint.respondentRole,
          surveyTitle:
            surveyTitle.trim() ||
            `${org.name} ${RESPONDENT_ROLE_META[selectedBlueprint.respondentRole].label}용 진단 설문`,
          recipientName: recipientName.trim(),
          recipientPosition: recipientPosition.trim(),
          recipientEmail: recipientEmail.trim(),
          recipientPhone: recipientPhone.trim(),
          introMessage: introMessage.trim(),
          privacyNotice: privacyNotice.trim(),
          consentRequired,
          expiresAt,
        },
        generateUniqueAccessToken((t) =>
          surveyDistributionRepository.isTokenTaken(t),
        ),
      )
      void project
      setResult(distribution)
      onCreated?.(distribution)
      showToast('테스트 링크를 생성했습니다.')
    } catch (error) {
      setSaving(false)
      showToast(error instanceof Error ? error.message : '링크 생성에 실패했습니다.')
    }
  }

  if (result) {
    const url = buildSurveyUrl(result.accessToken)
    return (
      <Modal
        open={open}
        title="테스트 링크 생성 완료"
        onClose={handleClose}
        footer={
          <>
            <Button variant="secondary" onClick={handleClose}>
              닫기
            </Button>
            {onViewDetail && (
              <Button
                variant="secondary"
                onClick={() => {
                  const created = result
                  handleClose()
                  onViewDetail(created)
                }}
              >
                링크 상세 보기
              </Button>
            )}
            <Button variant="primary" onClick={() => window.open(url, '_blank')}>
              응답자 화면 열기
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <LocalTestModeBanner />
          <SurveyLinkCopyField
            url={url}
            onOpen={() => window.open(url, '_blank')}
          />
          <p className="text-[13px] text-slate-500">
            이 링크는 같은 브라우저 프로필에서만 열립니다. 응답 현황은 링크 상세에서
            확인할 수 있습니다.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      title="테스트 링크 생성"
      size="lg"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? '생성 중…' : '테스트 링크 생성'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <LocalTestModeBanner compact />

        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <SelectField
            id="dist-project"
            label="프로젝트"
            required
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value)
              setBlueprintId('')
            }}
            error={errors.project}
            placeholder="프로젝트 선택"
            options={projectsWithReady.map((p) => ({
              value: p.id,
              label: `${organizationRepository.getById(p.organizationId)?.name ?? ''} · ${p.name}`,
            }))}
          />
          <SelectField
            id="dist-blueprint"
            label="준비 완료 설문"
            required
            value={blueprintId}
            onChange={(e) => pickBlueprint(e.target.value)}
            error={errors.blueprint}
            placeholder={readyBlueprints.length ? '설문 선택' : '준비 완료 설문 없음'}
            disabled={readyBlueprints.length === 0}
            options={readyBlueprints.map((b) => ({
              value: b.id,
              label: `${RESPONDENT_ROLE_META[b.respondentRole].label}용 · 문항 ${b.sections.reduce((n, s) => n + s.placements.length, 0)}개`,
            }))}
          />
          {draftOnly && (
            <p className="text-[0.875rem] break-keep text-warning-700 sm:col-span-2">
              이 프로젝트의 설문이 아직 초안 상태입니다. 설문 설계에서 먼저 준비
              완료해 주세요.
            </p>
          )}
          <TextField
            id="dist-title"
            label="설문 제목"
            fullWidth
            value={surveyTitle}
            onChange={(e) => setSurveyTitle(e.target.value)}
            placeholder="응답자에게 보일 설문 제목"
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-[13px] font-semibold text-slate-700">응답자 정보</p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField
              id="dist-name"
              label="이름"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              error={errors.recipientName}
              placeholder="예: 정대표"
            />
            <TextField
              id="dist-position"
              label="직책"
              value={recipientPosition}
              onChange={(e) => setRecipientPosition(e.target.value)}
              placeholder="예: 대표이사"
            />
            <TextField
              id="dist-email"
              label="이메일 (선택)"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              help="실제 이메일 발송은 하지 않습니다."
            />
            <TextField
              id="dist-phone"
              label="전화번호 (선택)"
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-[13px] font-semibold text-slate-700">안내 설정</p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextAreaField
              id="dist-intro"
              label="시작 안내문"
              rows={2}
              value={introMessage}
              onChange={(e) => setIntroMessage(e.target.value)}
            />
            <TextAreaField
              id="dist-privacy"
              label="개인정보 안내문"
              rows={2}
              value={privacyNotice}
              onChange={(e) => setPrivacyNotice(e.target.value)}
            />
            <SelectField
              id="dist-consent"
              label="동의 필수 여부"
              value={consentRequired ? 'yes' : 'no'}
              onChange={(e) => setConsentRequired(e.target.value === 'yes')}
              options={[
                { value: 'yes', label: '동의 필수' },
                { value: 'no', label: '동의 선택' },
              ]}
            />
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
                응답 만료일
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EXPIRY_PRESETS.map((preset) => {
                  const active = expiryDays === preset.days
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setExpiryDays(preset.days)}
                      className={`h-8 cursor-pointer rounded-(--radius-control) border px-2.5 text-[13px] font-medium ${
                        active
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[0.875rem] text-slate-400">
                {expiryDays === null
                  ? '만료 없이 유지됩니다.'
                  : `${toDateInputValue(expiryDays)}에 만료됩니다.`}
              </p>
              {errors.expiry && (
                <p className="mt-1 text-[0.875rem] text-danger-600">{errors.expiry}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
