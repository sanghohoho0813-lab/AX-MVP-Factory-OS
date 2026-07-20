import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  Landmark,
  MinusCircle,
  TriangleAlert,
} from 'lucide-react'
import type { DeliverableAudience, DeliverablePackageType } from '../../types/deliverables'
import { createPackage, getDraftPreview } from '../../services/deliverableService'
import { PACKAGE_PRESETS } from '../../services/deliverables/packagePresetEngine'
import {
  AUDIENCE_META,
  AUDIENCES,
  INSTITUTION_DISCLAIMER,
  PACKAGE_TYPES,
  PACKAGE_TYPE_META,
} from '../../lib/deliverableMeta'
import { useToast } from '../../components/ui/toastContext'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { ProjectTypeBadge } from '../../components/domain/ProjectTypeBadge'
import { TextField, SelectField } from '../../components/form/fields'
import { DeliverableNotFound } from './deliverableShared'
import { useDeliverableData } from './useDeliverableData'

export function CreatePackagePage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useDeliverableData(projectId)

  const [type, setType] = useState<DeliverablePackageType>('internal_master')
  const [name, setName] = useState('')
  const [audienceOverride, setAudienceOverride] = useState<'' | DeliverableAudience>('')
  const [removePersonalInfo, setRemovePersonalInfo] = useState(false)
  const [removeInternalNotes, setRemoveInternalNotes] = useState(false)
  const [busy, setBusy] = useState(false)

  const presetAudience = PACKAGE_PRESETS[type].audience
  const audience: DeliverableAudience = audienceOverride || presetAudience
  const effectiveName = name.trim() || PACKAGE_TYPE_META[type].label

  const preview = useMemo(
    () => getDraftPreview(projectId, type, effectiveName),
    [projectId, type, effectiveName],
  )

  if (!context) return <DeliverableNotFound />

  const { project, organization, eligibility } = context
  const orgName = organization?.name ?? '고객사 미상'
  const canCreate = eligibility.canCreate

  const submit = () => {
    if (!canCreate || busy) return
    setBusy(true)
    try {
      const created = createPackage(projectId, type, effectiveName, {
        audience: audienceOverride || undefined,
        removePersonalInfo,
        removeInternalNotes,
      })
      showToast('자료 패키지 초안을 생성했습니다.')
      navigate(`/deliverables/projects/${projectId}/packages/${created.id}`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '자료를 생성하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate(`/deliverables/projects/${projectId}`)}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        자료 패키지 목록
      </button>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold break-keep text-slate-900 lg:text-2xl">새 자료 패키지 만들기</h1>
          <ProjectTypeBadge type={project.projectType} />
        </div>
        <p className="mt-1.5 text-sm text-slate-500">{orgName} · {project.name}</p>
      </div>

      {!canCreate && (
        <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
          <p className="text-[13px] font-semibold text-warning-800">지금은 자료를 만들 수 없습니다</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] break-keep text-warning-700">
            {eligibility.reasons.length > 0
              ? eligibility.reasons.map((reason, i) => <li key={i}>{reason}</li>)
              : <li>확정된 진단 결과 또는 확정된 설계가 필요합니다.</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title="패키지 구성">
          <div className="flex flex-col gap-5">
            <TextField
              id="package-name"
              label="패키지 이름"
              placeholder={PACKAGE_TYPE_META[type].label}
              value={name}
              onChange={(e) => setName(e.target.value)}
              help="비워 두면 선택한 유형 이름으로 자동 지정됩니다."
              fullWidth
            />

            <fieldset>
              <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">패키지 유형</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PACKAGE_TYPES.map((t) => {
                  const meta = PACKAGE_TYPE_META[t]
                  const checked = t === type
                  return (
                    <label
                      key={t}
                      className={`flex cursor-pointer flex-col gap-1 rounded-(--radius-control) border px-3.5 py-3 transition-colors ${
                        checked ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <input
                          type="radio"
                          name="package-type"
                          value={t}
                          checked={checked}
                          onChange={() => {
                            setType(t)
                            setAudienceOverride('')
                          }}
                          className="size-3.5 accent-brand-600"
                        />
                        <meta.icon aria-hidden="true" className="size-4 text-slate-500" />
                        {meta.label}
                      </span>
                      <span className="pl-5 text-xs break-keep text-slate-500">{meta.description}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <SelectField
              id="package-audience"
              label="대상 독자"
              value={audienceOverride}
              onChange={(e) => setAudienceOverride(e.target.value as '' | DeliverableAudience)}
              placeholder={`유형 기본값 (${AUDIENCE_META[presetAudience].label})`}
              options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_META[a].label }))}
              help={`선택한 유형의 기본 대상은 ${AUDIENCE_META[presetAudience].label}입니다. 필요하면 바꿀 수 있습니다.`}
              fullWidth
            />

            <fieldset>
              <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">공개 범위 정리</legend>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={removePersonalInfo}
                    onChange={(e) => setRemovePersonalInfo(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-brand-600"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">개인정보 제거</span>
                    <span className="block text-xs break-keep text-slate-500">담당자 연락처 등 개인정보를 자료에서 가립니다.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={removeInternalNotes}
                    onChange={(e) => setRemoveInternalNotes(e.target.checked)}
                    className="mt-0.5 size-3.5 accent-brand-600"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">내부 메모 제거</span>
                    <span className="block text-xs break-keep text-slate-500">내부 전용 메모·리스크 코멘트를 자료에서 가립니다.</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="flex items-start gap-2 rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-4 py-3">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
              <p className="text-[13px] break-keep text-slate-600">
                검증(실제 사용 테스트) 결과가 포함되지 않은 자료는 <span className="font-semibold">검증 전 설계안</span>으로 표시됩니다. 근거가 없는 수치는 자동으로 "산정 필요"로 남습니다.
              </p>
            </div>

            {type === 'institution_preparation' && (
              <div className="flex items-start gap-2 rounded-(--radius-card) border border-success-200 bg-success-50/60 px-4 py-3">
                <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" />
                <p className="text-[13px] font-medium break-keep text-success-800">{INSTITUTION_DISCLAIMER}</p>
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="생성 전 예상 결과">
            {preview ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-(--radius-card) border border-slate-200 px-3.5 py-3">
                    <p className="text-xs text-slate-500">예상 Section</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900">{preview.sectionCount}개</p>
                  </div>
                  <div className="rounded-(--radius-card) border border-slate-200 px-3.5 py-3">
                    <p className="text-xs text-slate-500">개발 프롬프트</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900">{preview.promptCount}종</p>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-700">사용 가능한 출처</p>
                  {preview.availableSources.length === 0 ? (
                    <p className="text-[13px] text-slate-400">사용 가능한 출처가 없습니다.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {preview.availableSources.map((source, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[13px] break-keep text-slate-600">
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-500" />
                          {source}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {preview.missingSources.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[13px] font-semibold text-slate-700">아직 없는 출처</p>
                    <ul className="flex flex-col gap-1">
                      {preview.missingSources.map((source, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[13px] break-keep text-slate-400">
                          <MinusCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-300" />
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3.5 py-3">
                    <p className="text-[13px] font-semibold text-warning-800">확인이 필요한 항목</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] break-keep text-warning-700">
                      {preview.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs break-keep text-slate-400">대상 독자: {AUDIENCE_META[audience].label}</p>
              </div>
            ) : (
              <p className="text-[13px] break-keep text-slate-500">
                예상 결과를 계산할 출처가 없습니다. 진단 또는 설계를 먼저 확정하세요.
              </p>
            )}
          </Panel>

          <Button variant="primary" disabled={!canCreate || busy || !preview} onClick={submit}>
            <FilePlus2 aria-hidden="true" className="size-4" />
            {busy ? '생성 중…' : '자료 생성'}
          </Button>
        </div>
      </div>
    </div>
  )
}
