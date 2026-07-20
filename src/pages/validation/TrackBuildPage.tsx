import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Cpu, Plus, Users } from 'lucide-react'
import type {
  BuildArtifact,
  BuildArtifactType,
  ParticipantConsentStatus,
  ParticipantStatus,
  ValidationParticipant,
  ValidationParticipantRole,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import {
  BUILD_TYPES,
  BUILD_TYPE_META,
  CONSENT_META,
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_META,
  PARTICIPANT_STATUS_META,
} from '../../lib/validationMeta'
import {
  addBuildArtifact,
  addParticipant,
  removeBuildArtifact,
  removeParticipant,
  setCurrentBuild,
  updateBuildArtifact,
  updateParticipant,
} from '../../services/validationService'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { useToast } from '../../components/ui/toastContext'
import {
  BuildStatusBadge,
  ConsentBadge,
  ParticipantRoleBadge,
  ParticipantStatusBadge,
} from '../../components/validation/badges'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-semibold text-slate-500'

const CONSENT_STATUSES = Object.keys(CONSENT_META) as ParticipantConsentStatus[]
const PARTICIPANT_STATUSES = Object.keys(PARTICIPANT_STATUS_META) as ParticipantStatus[]

interface BuildFormState {
  name: string
  version: string
  type: BuildArtifactType
  url: string
  accessMethod: string
  environment: string
  releaseNotes: string
  knownLimitations: string
}

function emptyBuildForm(): BuildFormState {
  return { name: '', version: '', type: 'prototype', url: '', accessMethod: '', environment: '', releaseNotes: '', knownLimitations: '' }
}

function BuildModal({
  open,
  title,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial: BuildFormState
  onClose: () => void
  onSubmit: (form: BuildFormState) => void
}) {
  const [form, setForm] = useState<BuildFormState>(initial)

  const set = <K extends keyof BuildFormState>(key: K, value: BuildFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Modal
      open={open}
      title={title}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={() => onSubmit(form)} disabled={!form.name.trim()}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="b-name" className={labelClass}>이름</label>
          <input id="b-name" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="b-version" className={labelClass}>버전</label>
          <input id="b-version" value={form.version} onChange={(e) => set('version', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="b-type" className={labelClass}>유형</label>
          <select id="b-type" value={form.type} onChange={(e) => set('type', e.target.value as BuildArtifactType)} className={inputClass}>
            {BUILD_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUILD_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="b-env" className={labelClass}>환경</label>
          <input id="b-env" value={form.environment} onChange={(e) => set('environment', e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-url" className={labelClass}>링크·파일 위치 (URL)</label>
          <input id="b-url" value={form.url} onChange={(e) => set('url', e.target.value)} className={inputClass} placeholder="예: https://... 또는 파일 경로" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-access" className={labelClass}>접근 방법</label>
          <input id="b-access" value={form.accessMethod} onChange={(e) => set('accessMethod', e.target.value)} className={inputClass} placeholder="예: 초대 링크 · 계정 정보 · 접근 권한" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-notes" className={labelClass}>릴리스 노트</label>
          <textarea id="b-notes" value={form.releaseNotes} onChange={(e) => set('releaseNotes', e.target.value)} rows={2} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="b-limits" className={labelClass}>알려진 제약</label>
          <textarea id="b-limits" value={form.knownLimitations} onChange={(e) => set('knownLimitations', e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>
    </Modal>
  )
}

function BuildPanel({ w, readOnly }: { w: ValidationWorkspace; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<BuildArtifact | null>(null)
  const [removeTarget, setRemoveTarget] = useState<BuildArtifact | null>(null)

  const doAdd = (form: BuildFormState) => {
    try {
      addBuildArtifact(w.id, form)
      setAddOpen(false)
      showToast('테스트 버전을 추가했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const doEdit = (form: BuildFormState) => {
    if (!editing) return
    try {
      updateBuildArtifact(w.id, editing.id, form)
      setEditing(null)
      showToast('테스트 버전을 수정했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const doSetCurrent = (id: string) => {
    try {
      setCurrentBuild(w.id, id)
      showToast('활성 테스트 버전을 지정했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const doRemove = () => {
    if (!removeTarget) return
    try {
      removeBuildArtifact(w.id, removeTarget.id)
      setRemoveTarget(null)
      showToast('테스트 버전을 삭제했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  return (
    <Panel
      title="테스트 버전(제작물)"
      actions={
        !readOnly ? (
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            추가
          </Button>
        ) : undefined
      }
    >
      <HelpNote
        summary="이 화면은 MVP나 홈페이지를 직접 제작하지 않습니다. 테스트할 제작물이 있는 링크·파일 위치만 기록합니다."
        what="테스트에 사용할 버전(프로토타입·MVP·시안·문서)의 위치와 접근 방법을 등록합니다."
        when="현장 테스트 회차를 시작하기 전, 어떤 버전으로 테스트할지 정할 때 사용합니다."
        next="활성 버전을 지정한 뒤 참여자를 등록하고 회차를 만드세요."
      />

      {w.buildArtifacts.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Cpu} title="등록된 테스트 버전이 없습니다" description="테스트할 제작물의 링크·파일 위치를 추가하세요." />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {w.buildArtifacts.map((b) => (
            <li key={b.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                {b.version && <span className="text-xs text-slate-400">v{b.version}</span>}
                <BuildStatusBadge status={b.status} />
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                  {BUILD_TYPE_META[b.type].label}
                </span>
                {b.isCurrent && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-50 px-1.5 py-0.5 text-[11px] font-medium text-success-700">
                    <CheckCircle2 aria-hidden="true" className="size-3.5" />
                    활성 버전
                  </span>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[13px] sm:grid-cols-2">
                {b.url && (
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">링크·위치</dt>
                    <dd className="break-all text-slate-600">{b.url}</dd>
                  </div>
                )}
                {b.accessMethod && (
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">접근 방법</dt>
                    <dd className="break-keep text-slate-600">{b.accessMethod}</dd>
                  </div>
                )}
                {b.environment && (
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">환경</dt>
                    <dd className="break-keep text-slate-600">{b.environment}</dd>
                  </div>
                )}
              </dl>
              {!readOnly && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!b.isCurrent && (
                    <Button variant="secondary" size="sm" onClick={() => doSetCurrent(b.id)}>
                      활성으로 지정
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>
                    편집
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(b)}>
                    삭제
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && <BuildModal open title="테스트 버전 추가" initial={emptyBuildForm()} onClose={() => setAddOpen(false)} onSubmit={doAdd} />}
      {editing && (
        <BuildModal
          open={editing !== null}
          title="테스트 버전 편집"
          initial={{
            name: editing.name,
            version: editing.version,
            type: editing.type,
            url: editing.url,
            accessMethod: editing.accessMethod,
            environment: editing.environment,
            releaseNotes: editing.releaseNotes,
            knownLimitations: editing.knownLimitations,
          }}
          onClose={() => setEditing(null)}
          onSubmit={doEdit}
        />
      )}
      <ConfirmModal
        open={removeTarget !== null}
        title="테스트 버전 삭제"
        message={`'${removeTarget?.name ?? ''}' 테스트 버전을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        danger
        onConfirm={doRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </Panel>
  )
}

interface ParticipantFormState {
  name: string
  role: ValidationParticipantRole
  organization: string
  contactNote: string
  consentStatus: ParticipantConsentStatus
  expertise: string
}

function ParticipantModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (form: ParticipantFormState) => void
}) {
  const [form, setForm] = useState<ParticipantFormState>({
    name: '',
    role: 'operator',
    organization: '',
    contactNote: '',
    consentStatus: 'pending',
    expertise: '',
  })

  const set = <K extends keyof ParticipantFormState>(key: K, value: ParticipantFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <Modal
      open={open}
      title="참여자 추가"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={() => onSubmit(form)} disabled={!form.name.trim()}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pt-name" className={labelClass}>이름</label>
          <input id="pt-name" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pt-role" className={labelClass}>역할</label>
          <select id="pt-role" value={form.role} onChange={(e) => set('role', e.target.value as ValidationParticipantRole)} className={inputClass}>
            {PARTICIPANT_ROLES.map((r) => (
              <option key={r} value={r}>
                {PARTICIPANT_ROLE_META[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pt-org" className={labelClass}>소속</label>
          <input id="pt-org" value={form.organization} onChange={(e) => set('organization', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pt-consent" className={labelClass}>동의 상태</label>
          <select id="pt-consent" value={form.consentStatus} onChange={(e) => set('consentStatus', e.target.value as ParticipantConsentStatus)} className={inputClass}>
            {CONSENT_STATUSES.map((c) => (
              <option key={c} value={c}>
                {CONSENT_META[c].label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pt-expertise" className={labelClass}>전문성·배경</label>
          <input id="pt-expertise" value={form.expertise} onChange={(e) => set('expertise', e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pt-contact" className={labelClass}>연락 메모</label>
          <textarea id="pt-contact" value={form.contactNote} onChange={(e) => set('contactNote', e.target.value)} rows={2} className={inputClass} />
        </div>
      </div>
    </Modal>
  )
}

function ParticipantPanel({ w, readOnly }: { w: ValidationWorkspace; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ValidationParticipant | null>(null)

  const doAdd = (form: ParticipantFormState) => {
    try {
      addParticipant(w.id, form)
      setAddOpen(false)
      showToast('참여자를 추가했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const doUpdate = (id: string, patch: Partial<Pick<ValidationParticipant, 'consentStatus' | 'status'>>) => {
    try {
      updateParticipant(w.id, id, patch)
      showToast('참여자 정보를 수정했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const doRemove = () => {
    if (!removeTarget) return
    try {
      removeParticipant(w.id, removeTarget.id)
      setRemoveTarget(null)
      showToast('참여자를 삭제했습니다.')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  return (
    <Panel
      title="참여자"
      actions={
        !readOnly ? (
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            추가
          </Button>
        ) : undefined
      }
    >
      {w.participants.length === 0 ? (
        <EmptyState icon={Users} title="등록된 참여자가 없습니다" description="테스트에 참여할 사용자를 추가하세요." />
      ) : (
        <ul className="flex flex-col gap-3">
          {w.participants.map((p) => (
            <li key={p.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                <ParticipantRoleBadge role={p.role} />
                <ConsentBadge status={p.consentStatus} />
                <ParticipantStatusBadge status={p.status} />
              </div>
              {(p.organization || p.expertise) && (
                <p className="mt-1 text-[13px] break-keep text-slate-600">
                  {[p.organization, p.expertise].filter(Boolean).join(' · ')}
                </p>
              )}
              {!readOnly && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="text-xs text-slate-500">
                    동의
                    <select
                      value={p.consentStatus}
                      onChange={(e) => doUpdate(p.id, { consentStatus: e.target.value as ParticipantConsentStatus })}
                      className="ml-1.5 rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[13px] text-slate-700 focus:border-brand-400 focus:outline-none"
                    >
                      {CONSENT_STATUSES.map((c) => (
                        <option key={c} value={c}>
                          {CONSENT_META[c].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    상태
                    <select
                      value={p.status}
                      onChange={(e) => doUpdate(p.id, { status: e.target.value as ParticipantStatus })}
                      className="ml-1.5 rounded-(--radius-control) border border-slate-300 px-2 py-1 text-[13px] text-slate-700 focus:border-brand-400 focus:outline-none"
                    >
                      {PARTICIPANT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PARTICIPANT_STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(p)}>
                    삭제
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {addOpen && <ParticipantModal open onClose={() => setAddOpen(false)} onSubmit={doAdd} />}
      <ConfirmModal
        open={removeTarget !== null}
        title="참여자 삭제"
        message={`'${removeTarget?.name ?? ''}' 참여자를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        danger
        onConfirm={doRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </Panel>
  )
}

export function TrackBuildPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => {
        const readOnly = w.status === 'finalized' || w.status === 'superseded'
        return (
          <div className="flex flex-col gap-5">
            <ReadOnlyNotice workspace={w} />
            <BuildPanel w={w} readOnly={readOnly} />
            <ParticipantPanel w={w} readOnly={readOnly} />
          </div>
        )
      }}
    />
  )
}
