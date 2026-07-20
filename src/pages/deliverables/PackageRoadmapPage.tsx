import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Route } from 'lucide-react'
import type {
  DeliverablePackage,
  RoadmapPhase,
  RoadmapPhaseStatus,
  DeliverableTrackType,
} from '../../types/deliverables'
import { updateRoadmapPhase } from '../../services/deliverableService'
import { DELIVERABLE_TRACK_META } from '../../lib/deliverableMeta'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { DeliverableTrackBadge } from '../../components/deliverables/badges'
import { ContentBlocks } from '../../components/deliverables/ContentBlockView'
import { PackageSectionFrame, ReadOnlyNotice, DeliverableNotFound } from './deliverableShared'

const PHASE_STATUS_META: Record<RoadmapPhaseStatus, { label: string; tone: string }> = {
  planned: { label: '계획', tone: 'border-slate-200 bg-slate-50 text-slate-600' },
  ready: { label: '착수 준비', tone: 'border-brand-200 bg-brand-50 text-brand-700' },
  in_progress: { label: '진행 중', tone: 'border-warning-200 bg-warning-50 text-warning-700' },
  completed: { label: '완료', tone: 'border-success-200 bg-success-50 text-success-700' },
  blocked: { label: '차단', tone: 'border-danger-200 bg-danger-50 text-danger-700' },
  deferred: { label: '보류', tone: 'border-slate-200 bg-slate-50 text-slate-500' },
}
const PHASE_STATUS_ORDER: RoadmapPhaseStatus[] = [
  'planned',
  'ready',
  'in_progress',
  'completed',
  'blocked',
  'deferred',
]

const TRACK_ORDER: DeliverableTrackType[] = ['ax', 'website', 'validation', 'roadmap', 'overview', 'evidence', 'prompt']

function trackOrderIndex(track: DeliverableTrackType): number {
  const i = TRACK_ORDER.indexOf(track)
  return i === -1 ? TRACK_ORDER.length : i
}

const INPUT_CLASS = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function PhaseStatusChip({ status }: { status: RoadmapPhaseStatus }) {
  const m = PHASE_STATUS_META[status]
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${m.tone}`}>
      {m.label}
    </span>
  )
}

function BulletList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[13px] font-semibold text-slate-700">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
            <span className="min-w-0 whitespace-pre-wrap">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface PhaseDraft {
  owner: string
  estimatedDurationText: string
  status: RoadmapPhaseStatus
}

function PhaseCard({
  phase,
  readOnly,
  onEdit,
}: {
  phase: RoadmapPhase
  readOnly: boolean
  onEdit: (phase: RoadmapPhase) => void
}) {
  return (
    <article className="rounded-(--radius-card) border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
              {phase.orderIndex + 1}
            </span>
            <h3 className="text-[15px] font-semibold break-keep text-slate-900">{phase.name}</h3>
            <PhaseStatusChip status={phase.status} />
          </div>
          {phase.objective && (
            <p className="mt-1.5 text-[13px] leading-relaxed break-keep whitespace-pre-wrap text-slate-600">
              {phase.objective}
            </p>
          )}
        </div>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={() => onEdit(phase)}>
            편집
          </Button>
        )}
      </div>

      {phase.scope && (
        <p className="mt-3 text-[13px] leading-relaxed break-keep whitespace-pre-wrap text-slate-700">
          {phase.scope}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <BulletList label="산출물" items={phase.deliverables} />
        <BulletList label="선행 조건" items={phase.dependencies} />
        <BulletList label="완료 기준" items={phase.successCriteria} />
        <BulletList label="리스크" items={phase.risks} />
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div className="flex flex-col">
          <dt className="text-xs text-slate-400">담당자</dt>
          <dd className="text-[13px] break-keep text-slate-700">{phase.owner || '지정 필요'}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-slate-400">기간</dt>
          <dd className="text-[13px] break-keep text-slate-700">{phase.estimatedDurationText}</dd>
        </div>
      </dl>
    </article>
  )
}

function RoadmapView({ pkg, readOnly }: { pkg: DeliverablePackage; readOnly: boolean }) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState<RoadmapPhase | null>(null)
  const [draft, setDraft] = useState<PhaseDraft>({ owner: '', estimatedDurationText: '', status: 'planned' })
  const [saving, setSaving] = useState(false)

  const roadmapSection = pkg.sections.find((s) => s.type === 'implementation_roadmap')

  function openEdit(phase: RoadmapPhase) {
    setEditing(phase)
    setDraft({ owner: phase.owner, estimatedDurationText: phase.estimatedDurationText, status: phase.status })
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      updateRoadmapPhase(pkg.id, editing.id, {
        owner: draft.owner,
        estimatedDurationText: draft.estimatedDurationText,
        status: draft.status,
      })
      showToast('단계 정보를 저장했습니다.')
      setEditing(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const tracks = Array.from(new Set(pkg.roadmap.map((p) => p.track))).sort(
    (a, b) => trackOrderIndex(a) - trackOrderIndex(b),
  )

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="근거 없는 비용·일수를 만들지 않으며, 기간은 담당 개발자가 산정합니다."
        what="확정된 설계 스냅샷을 트랙별 실행 단계로 정리합니다. AX와 홈페이지는 별도 트랙으로 나누어 표시합니다."
        when="개발 착수 전 단계·담당자·상태를 정리할 때 사용합니다."
        next="개발 프롬프트 탭에서 각 단계에 맞는 Claude Code 프롬프트를 확인하세요."
      />
      <ReadOnlyNotice pkg={pkg} />

      {pkg.roadmap.length === 0 ? (
        <Panel title="실행 로드맵">
          <EmptyState
            icon={Route}
            title="아직 로드맵 단계가 없습니다."
            description="확정된 AX MVP 설계 또는 홈페이지 설계가 있으면 실행 단계가 생성됩니다."
          />
        </Panel>
      ) : (
        tracks.map((track) => {
          const phases = pkg.roadmap
            .filter((p) => p.track === track)
            .sort((a, b) => a.orderIndex - b.orderIndex)
          return (
            <section key={track} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <DeliverableTrackBadge track={track} />
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {DELIVERABLE_TRACK_META[track].label} 실행 단계
                </h2>
              </div>
              <div className="flex flex-col gap-3">
                {phases.map((phase) => (
                  <PhaseCard key={phase.id} phase={phase} readOnly={readOnly} onEdit={openEdit} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {roadmapSection && roadmapSection.structuredContent.length > 0 && (
        <Panel title={roadmapSection.title || '실행 로드맵 상세'}>
          <ContentBlocks blocks={roadmapSection.structuredContent} showInternal={true} />
        </Panel>
      )}

      <Modal
        open={editing !== null}
        title="단계 정보 편집"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              취소
            </Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">담당자</span>
            <input
              className={INPUT_CLASS}
              value={draft.owner}
              onChange={(e) => setDraft((d) => ({ ...d, owner: e.target.value }))}
              placeholder="담당자 이름 또는 역할"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">기간</span>
            <input
              className={INPUT_CLASS}
              value={draft.estimatedDurationText}
              onChange={(e) => setDraft((d) => ({ ...d, estimatedDurationText: e.target.value }))}
              placeholder="담당 개발자 산정 필요"
            />
            <span className="text-xs text-slate-400">근거 없는 일수는 입력하지 마세요. 담당 개발자가 산정합니다.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">상태</span>
            <select
              className={INPUT_CLASS}
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as RoadmapPhaseStatus }))}
            >
              {PHASE_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {PHASE_STATUS_META[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </div>
  )
}

export function PackageRoadmapPage() {
  const { projectId, packageId } = useParams<{ projectId: string; packageId: string }>()
  if (!projectId || !packageId) return <DeliverableNotFound />
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => {
        const readOnly =
          pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'
        return <RoadmapView pkg={pkg} readOnly={readOnly} />
      }}
    />
  )
}
