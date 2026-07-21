import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Phone, Plus } from 'lucide-react'
import type {
  FundingStrategy,
  OutreachChannel,
  OutreachPlan,
  OutreachPlanStatus,
} from '../../types/funding'
import {
  addOutreachPlan,
  recordOutreachActivity,
  updateOutreachPlan,
} from '../../services/fundingService'
import { OUTREACH_CHANNELS, OUTREACH_CHANNEL_META, OUTREACH_PLAN_STATUSES, OUTREACH_PLAN_STATUS_META } from '../../lib/fundingMeta'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { OutreachChannelBadge, OutreachPlanStatusBadge } from '../../components/funding/badges'
import { FundingStrategyFrame, FundingNotFound, ReadOnlyNotice } from './fundingShared'

const INPUT_CLASS = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function institutionName(id: string): string {
  return institutionRepository.getById(id)?.name ?? '기관 미확인'
}
function programName(id: string | null): string {
  if (!id) return ''
  return supportProgramRepository.getById(id)?.name ?? ''
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[0.875rem] text-slate-400">{label}</dt>
      <dd className="text-[13px] break-keep text-slate-700">{value || '—'}</dd>
    </div>
  )
}

interface InstitutionOption {
  institutionId: string
  programId: string | null
  name: string
  program: string
}

/* ------------------------------------------------------------------ */
/* 계획 추가 모달                                                        */
/* ------------------------------------------------------------------ */

interface PlanDraft {
  institutionId: string
  purpose: string
  targetRole: string
  channel: OutreachChannel
  plannedDate: string
}

function AddPlanModal({
  open,
  options,
  onClose,
  onSubmit,
}: {
  open: boolean
  options: InstitutionOption[]
  onClose: () => void
  onSubmit: (draft: PlanDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<PlanDraft>({
    institutionId: '',
    purpose: '',
    targetRole: '',
    channel: 'phone',
    plannedDate: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(draft)
    setSaving(false)
  }

  return (
    <Modal
      open={open}
      title="접촉 계획 추가"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !draft.institutionId || !draft.purpose.trim()}
          >
            {saving ? '추가 중…' : '계획 추가'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">대상 기관</span>
          <select
            className={INPUT_CLASS}
            value={draft.institutionId}
            onChange={(e) => setDraft((d) => ({ ...d, institutionId: e.target.value }))}
          >
            <option value="">기관을 선택하세요</option>
            {options.map((o) => (
              <option key={o.institutionId} value={o.institutionId}>
                {o.name}
                {o.program ? ` · ${o.program}` : ''}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <span className="text-[0.875rem] text-warning-600">
              후보 기관이 없습니다. 먼저 기관 후보 화면에서 후보를 확인하세요.
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">접촉 목적</span>
          <input
            className={INPUT_CLASS}
            value={draft.purpose}
            onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))}
            placeholder="예: 지원 요건·제출서류 확인"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">대상 담당(역할)</span>
          <input
            className={INPUT_CLASS}
            value={draft.targetRole}
            onChange={(e) => setDraft((d) => ({ ...d, targetRole: e.target.value }))}
            placeholder="예: 창업지원팀 담당자 (개인 실명 저장 지양)"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">접촉 채널</span>
          <select
            className={INPUT_CLASS}
            value={draft.channel}
            onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as OutreachChannel }))}
          >
            {OUTREACH_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {OUTREACH_CHANNEL_META[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">예정일</span>
          <input
            type="date"
            className={INPUT_CLASS}
            value={draft.plannedDate}
            onChange={(e) => setDraft((d) => ({ ...d, plannedDate: e.target.value }))}
          />
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 계획 편집 모달                                                        */
/* ------------------------------------------------------------------ */

interface PlanEditDraft {
  status: OutreachPlanStatus
  ownerId: string
  plannedDate: string
}

function EditPlanModal({
  plan,
  onClose,
  onSubmit,
}: {
  plan: OutreachPlan
  onClose: () => void
  onSubmit: (planId: string, draft: PlanEditDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<PlanEditDraft>({
    status: plan.status,
    ownerId: plan.ownerId,
    plannedDate: plan.plannedDate,
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(plan.id, draft)
    setSaving(false)
  }

  return (
    <Modal
      open={true}
      title="접촉 계획 편집"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">진행 상태</span>
          <select
            className={INPUT_CLASS}
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as OutreachPlanStatus }))}
          >
            {OUTREACH_PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {OUTREACH_PLAN_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">담당자</span>
          <input
            className={INPUT_CLASS}
            value={draft.ownerId}
            onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
            placeholder="담당자 이름 또는 역할"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">예정일</span>
          <input
            type="date"
            className={INPUT_CLASS}
            value={draft.plannedDate}
            onChange={(e) => setDraft((d) => ({ ...d, plannedDate: e.target.value }))}
          />
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 기록 추가 모달                                                        */
/* ------------------------------------------------------------------ */

interface ActivityDraft {
  channel: OutreachChannel
  contactRole: string
  contactNameNote: string
  summary: string
  institutionFeedback: string
  requestedMaterials: string
  nextAction: string
  nextActionDueDate: string
  internalOnly: boolean
}

function emptyActivityDraft(channel: OutreachChannel): ActivityDraft {
  return {
    channel,
    contactRole: '',
    contactNameNote: '',
    summary: '',
    institutionFeedback: '',
    requestedMaterials: '',
    nextAction: '',
    nextActionDueDate: '',
    internalOnly: false,
  }
}

function RecordActivityModal({
  plan,
  onClose,
  onSubmit,
}: {
  plan: OutreachPlan
  onClose: () => void
  onSubmit: (planId: string, draft: ActivityDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<ActivityDraft>(emptyActivityDraft(plan.channel))
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(plan.id, draft)
    setSaving(false)
  }

  return (
    <Modal
      open={true}
      title="접촉 기록 추가"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !draft.summary.trim()}>
            {saving ? '저장 중…' : '기록 저장'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">접촉 채널</span>
            <select
              className={INPUT_CLASS}
              value={draft.channel}
              onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as OutreachChannel }))}
            >
              {OUTREACH_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {OUTREACH_CHANNEL_META[c].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">상대 역할</span>
            <input
              className={INPUT_CLASS}
              value={draft.contactRole}
              onChange={(e) => setDraft((d) => ({ ...d, contactRole: e.target.value }))}
              placeholder="예: 상담 창구 담당자"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">상대 메모(선택)</span>
          <input
            className={INPUT_CLASS}
            value={draft.contactNameNote}
            onChange={(e) => setDraft((d) => ({ ...d, contactNameNote: e.target.value }))}
            placeholder="식별용 최소 메모만"
          />
          <span className="text-[0.875rem] text-warning-600">개인 연락처·실명 등 민감정보를 과도하게 저장하지 마세요.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">접촉 요약</span>
          <textarea
            className={INPUT_CLASS}
            rows={2}
            value={draft.summary}
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            placeholder="어떤 내용을 확인했는지 요약"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">기관 답변</span>
          <textarea
            className={INPUT_CLASS}
            rows={2}
            value={draft.institutionFeedback}
            onChange={(e) => setDraft((d) => ({ ...d, institutionFeedback: e.target.value }))}
            placeholder="기관이 안내한 내용"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">요청 자료 (한 줄에 하나)</span>
          <textarea
            className={INPUT_CLASS}
            rows={2}
            value={draft.requestedMaterials}
            onChange={(e) => setDraft((d) => ({ ...d, requestedMaterials: e.target.value }))}
            placeholder={'사업자등록증\n최근 재무제표'}
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">다음 조치</span>
            <input
              className={INPUT_CLASS}
              value={draft.nextAction}
              onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))}
              placeholder="예: 요청 자료 정리 후 회신"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">다음 조치 기한</span>
            <input
              type="date"
              className={INPUT_CLASS}
              value={draft.nextActionDueDate}
              onChange={(e) => setDraft((d) => ({ ...d, nextActionDueDate: e.target.value }))}
            />
          </label>
        </div>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={draft.internalOnly}
            onChange={(e) => setDraft((d) => ({ ...d, internalOnly: e.target.checked }))}
          />
          <span className="text-[13px] break-keep text-slate-700">
            내부 메모 (고객·외부 공유 대상 아님)
          </span>
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 계획 카드                                                            */
/* ------------------------------------------------------------------ */

function PlanCard({
  strategy,
  plan,
  readOnly,
  onEdit,
  onRecord,
}: {
  strategy: FundingStrategy
  plan: OutreachPlan
  readOnly: boolean
  onEdit: (plan: OutreachPlan) => void
  onRecord: (plan: OutreachPlan) => void
}) {
  const activities = strategy.outreachActivities.filter((a) => a.planId === plan.id)
  const shareable = activities.filter((a) => !a.internalOnly)
  const internal = activities.filter((a) => a.internalOnly)

  return (
    <article className="rounded-(--radius-card) border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold break-keep text-slate-900">
              {institutionName(plan.institutionId)}
            </h3>
            <OutreachChannelBadge channel={plan.channel} />
            <OutreachPlanStatusBadge status={plan.status} />
          </div>
          {programName(plan.programId) && (
            <p className="mt-0.5 text-[13px] text-slate-500">{programName(plan.programId)}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(plan)}>
              상태·담당 편집
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onRecord(plan)}>
              기록 추가
            </Button>
          </div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <Field label="접촉 목적" value={plan.purpose} />
        <Field label="대상 담당(역할)" value={plan.targetRole} />
        <Field label="예정일" value={plan.plannedDate} />
        <Field label="담당자" value={plan.ownerId} />
      </dl>

      <div className="mt-3 flex flex-col gap-3">
        <BulletList label="준비 항목" items={plan.preparationItems} />
        <BulletList label="핵심 질문" items={plan.keyQuestions} />
        <BulletList label="전달 포인트" items={plan.talkingPoints} />
      </div>

      {activities.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[13px] font-semibold text-slate-700">접촉 기록</p>
          <div className="flex flex-col gap-3">
            {shareable.map((a) => (
              <ActivityItem key={a.id} activity={a} internal={false} />
            ))}
            {internal.length > 0 && (
              <div className="flex flex-col gap-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/50 p-3">
                <p className="text-[0.875rem] font-semibold text-warning-700">내부 메모 (외부 공유 대상 아님)</p>
                {internal.map((a) => (
                  <ActivityItem key={a.id} activity={a} internal={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function ActivityItem({
  activity,
  internal,
}: {
  activity: FundingStrategy['outreachActivities'][number]
  internal: boolean
}) {
  return (
    <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.875rem] text-slate-400">{activity.occurredAt.slice(0, 10)}</span>
        <OutreachChannelBadge channel={activity.channel} />
        {activity.contactRole && <span className="text-[0.875rem] text-slate-500">{activity.contactRole}</span>}
        {internal && (
          <span className="inline-flex items-center rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.875rem] font-medium text-warning-700">
            내부 메모
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] break-keep whitespace-pre-wrap text-slate-700">{activity.summary}</p>
      {activity.institutionFeedback && (
        <p className="mt-1 text-[13px] break-keep whitespace-pre-wrap text-slate-600">
          <span className="font-semibold text-slate-500">기관 답변: </span>
          {activity.institutionFeedback}
        </p>
      )}
      <BulletList label="요청 자료" items={activity.requestedMaterials} />
      {activity.nextAction && (
        <p className="mt-1 text-[13px] break-keep text-slate-600">
          <span className="font-semibold text-slate-500">다음 조치: </span>
          {activity.nextAction}
          {activity.nextActionDueDate ? ` (기한 ${activity.nextActionDueDate})` : ''}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 메인 뷰                                                              */
/* ------------------------------------------------------------------ */

function OutreachView({ strategy, readOnly }: { strategy: FundingStrategy; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editPlan, setEditPlan] = useState<OutreachPlan | null>(null)
  const [recordPlan, setRecordPlan] = useState<OutreachPlan | null>(null)

  const institutionOptions = useMemo<InstitutionOption[]>(() => {
    const map = new Map<string, InstitutionOption>()
    for (const m of strategy.matches) {
      if (m.priority === 'excluded') continue
      if (map.has(m.institutionId)) continue
      map.set(m.institutionId, {
        institutionId: m.institutionId,
        programId: m.programId,
        name: institutionName(m.institutionId),
        program: programName(m.programId),
      })
    }
    return [...map.values()]
  }, [strategy.matches])

  async function handleAdd(draft: PlanDraft) {
    const option = institutionOptions.find((o) => o.institutionId === draft.institutionId)
    try {
      addOutreachPlan(strategy.id, {
        institutionId: draft.institutionId,
        programId: option?.programId ?? null,
        purpose: draft.purpose.trim(),
        targetRole: draft.targetRole.trim(),
        channel: draft.channel,
        plannedDate: draft.plannedDate,
      })
      showToast('접촉 계획을 추가했습니다.')
      setAddOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '접촉 계획 추가에 실패했습니다.')
    }
  }

  async function handleEdit(planId: string, draft: PlanEditDraft) {
    try {
      updateOutreachPlan(strategy.id, planId, {
        status: draft.status,
        ownerId: draft.ownerId.trim(),
        plannedDate: draft.plannedDate,
      })
      showToast('접촉 계획을 저장했습니다.')
      setEditPlan(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  async function handleRecord(planId: string, draft: ActivityDraft) {
    try {
      recordOutreachActivity(strategy.id, planId, {
        channel: draft.channel,
        contactRole: draft.contactRole.trim(),
        contactNameNote: draft.contactNameNote.trim(),
        summary: draft.summary.trim(),
        institutionFeedback: draft.institutionFeedback.trim(),
        requestedMaterials: draft.requestedMaterials
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        nextAction: draft.nextAction.trim(),
        nextActionDueDate: draft.nextActionDueDate,
        internalOnly: draft.internalOnly,
      })
      showToast('접촉 기록을 저장했습니다.')
      setRecordPlan(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '기록 저장에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="실제 이메일·문자 발송은 하지 않으며, 접촉 계획과 접촉 이력을 정리하는 내부 기록입니다."
        what="후보 기관별 접촉 목적·채널·준비 항목을 계획으로 정리하고, 접촉 후 확인한 내용을 기록합니다."
        when="기관 후보를 정한 뒤 실제 문의·상담을 준비하고 진행할 때 사용합니다."
        next="접촉에서 요청받은 자료를 준비자료 화면에서 점검하세요."
      />
      <ReadOnlyNotice strategy={strategy} />

      <Panel
        title="접촉 계획"
        actions={
          !readOnly && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              계획 추가
            </Button>
          )
        }
      >
        {strategy.outreachPlans.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="아직 접촉 계획이 없습니다."
            description="후보 기관을 선택해 접촉 목적과 준비 항목을 정리하세요."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {strategy.outreachPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                strategy={strategy}
                plan={plan}
                readOnly={readOnly}
                onEdit={setEditPlan}
                onRecord={setRecordPlan}
              />
            ))}
          </div>
        )}
      </Panel>

      <AddPlanModal
        open={addOpen}
        options={institutionOptions}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
      {editPlan && (
        <EditPlanModal key={editPlan.id} plan={editPlan} onClose={() => setEditPlan(null)} onSubmit={handleEdit} />
      )}
      {recordPlan && (
        <RecordActivityModal
          key={recordPlan.id}
          plan={recordPlan}
          onClose={() => setRecordPlan(null)}
          onSubmit={handleRecord}
        />
      )}
    </div>
  )
}

export function FundingOutreachPage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return <FundingNotFound />
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => {
        const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
        return <OutreachView strategy={strategy} readOnly={readOnly} />
      }}
    />
  )
}
