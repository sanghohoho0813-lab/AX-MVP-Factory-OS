import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Target } from 'lucide-react'
import type {
  ApplicationStage,
  FundingApplication,
  FundingMatch,
  FundingStrategy,
} from '../../types/funding'
import { addApplication, setApplicationStage, updateApplication } from '../../services/fundingService'
import { APPLICATION_STAGES, APPLICATION_STAGE_META } from '../../lib/fundingMeta'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { ApplicationStageBadge } from '../../components/funding/badges'
import { FundingStrategyFrame, FundingNotFound, ReadOnlyNotice } from './fundingShared'

const INPUT_CLASS = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function institutionName(id: string): string {
  return institutionRepository.getById(id)?.name ?? '기관 미확인'
}
function programName(id: string | null): string {
  if (!id) return ''
  return supportProgramRepository.getById(id)?.name ?? ''
}
function matchOf(strategy: FundingStrategy, matchId: string | null): FundingMatch | undefined {
  if (!matchId) return undefined
  return strategy.matches.find((m) => m.id === matchId)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-[13px] break-keep text-slate-700">{value || '—'}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 단계 개요 (넓은 화면 가로 · 좁은 화면/큰 글씨 세로)                    */
/* ------------------------------------------------------------------ */

function StageOverview({ counts }: { counts: Record<ApplicationStage, number> }) {
  return (
    <Panel title="단계 개요">
      <ol className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:gap-2">
        {APPLICATION_STAGES.map((stage) => {
          const count = counts[stage]
          return (
            <li
              key={stage}
              className={`flex items-center justify-between gap-3 rounded-(--radius-card) border px-3 py-2 xl:flex-col xl:items-start xl:gap-1 ${
                count > 0 ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <span className="text-[13px] font-medium break-keep text-slate-700">
                {APPLICATION_STAGE_META[stage].label}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums ${count > 0 ? 'text-brand-700' : 'text-slate-400'}`}
              >
                {count}
              </span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* 신청 추가 모달                                                        */
/* ------------------------------------------------------------------ */

interface AppDraft {
  matchId: string
  applicationName: string
  applicationReference: string
  requestedAmount: string
  currency: string
}

function AddAppModal({
  open,
  matches,
  onClose,
  onSubmit,
}: {
  open: boolean
  matches: FundingMatch[]
  onClose: () => void
  onSubmit: (draft: AppDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<AppDraft>({
    matchId: '',
    applicationName: '',
    applicationReference: '',
    requestedAmount: '',
    currency: 'KRW',
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
      title="신청 추가"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !draft.matchId || !draft.applicationName.trim()}
          >
            {saving ? '추가 중…' : '신청 추가'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">대상 후보</span>
          <select
            className={INPUT_CLASS}
            value={draft.matchId}
            onChange={(e) => setDraft((d) => ({ ...d, matchId: e.target.value }))}
          >
            <option value="">후보를 선택하세요</option>
            {matches.map((m) => {
              const program = programName(m.programId)
              return (
                <option key={m.id} value={m.id}>
                  {institutionName(m.institutionId)}
                  {program ? ` · ${program}` : ''}
                </option>
              )
            })}
          </select>
          {matches.length === 0 && (
            <span className="text-xs text-warning-600">
              신청 가능한 후보가 없습니다. 기관 후보 화면에서 후보를 확인하세요.
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">신청명</span>
          <input
            className={INPUT_CLASS}
            value={draft.applicationName}
            onChange={(e) => setDraft((d) => ({ ...d, applicationName: e.target.value }))}
            placeholder="예: 2026년 창업기업 지원자금 신청"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">접수번호·참조(선택)</span>
          <input
            className={INPUT_CLASS}
            value={draft.applicationReference}
            onChange={(e) => setDraft((d) => ({ ...d, applicationReference: e.target.value }))}
            placeholder="공고·접수번호 등"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">신청 금액(선택)</span>
            <input
              className={INPUT_CLASS}
              value={draft.requestedAmount}
              onChange={(e) => setDraft((d) => ({ ...d, requestedAmount: e.target.value }))}
              placeholder="입력한 값만 저장됩니다"
            />
            <span className="text-xs text-slate-400">금액을 임의로 생성하지 않습니다. 실제 값만 입력하세요.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">통화</span>
            <input
              className={INPUT_CLASS}
              value={draft.currency}
              onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 신청 편집 모달                                                        */
/* ------------------------------------------------------------------ */

interface AppEditDraft {
  requestedAmount: string
  approvedAmount: string
  nextAction: string
  supplementRequests: string
}

function EditAppModal({
  app,
  onClose,
  onSubmit,
}: {
  app: FundingApplication
  onClose: () => void
  onSubmit: (appId: string, draft: AppEditDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<AppEditDraft>({
    requestedAmount: app.requestedAmount,
    approvedAmount: app.approvedAmount,
    nextAction: app.nextAction,
    supplementRequests: app.supplementRequests.join('\n'),
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSubmit(app.id, draft)
    setSaving(false)
  }

  return (
    <Modal
      open={true}
      title="신청 정보 편집"
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
        <p className="text-[13px] font-semibold text-slate-700">{app.applicationName}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">신청 금액</span>
            <input
              className={INPUT_CLASS}
              value={draft.requestedAmount}
              onChange={(e) => setDraft((d) => ({ ...d, requestedAmount: e.target.value }))}
              placeholder="실제 입력값만 저장"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-700">승인 금액</span>
            <input
              className={INPUT_CLASS}
              value={draft.approvedAmount}
              onChange={(e) => setDraft((d) => ({ ...d, approvedAmount: e.target.value }))}
              placeholder="실제 결과값만 저장"
            />
          </label>
        </div>
        <span className="-mt-2 text-xs text-slate-400">
          금액은 사용자가 입력한 값만 저장하며, 예상 금액을 자동으로 만들지 않습니다.
        </span>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">다음 조치</span>
          <input
            className={INPUT_CLASS}
            value={draft.nextAction}
            onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))}
            placeholder="예: 보완자료 제출 준비"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-slate-700">보완 요청 사항 (한 줄에 하나)</span>
          <textarea
            className={INPUT_CLASS}
            rows={3}
            value={draft.supplementRequests}
            onChange={(e) => setDraft((d) => ({ ...d, supplementRequests: e.target.value }))}
            placeholder={'추가 재무자료 제출\n사업계획 보완'}
          />
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 신청 카드                                                            */
/* ------------------------------------------------------------------ */

function ApplicationCard({
  strategy,
  app,
  readOnly,
  onStage,
  onEdit,
}: {
  strategy: FundingStrategy
  app: FundingApplication
  readOnly: boolean
  onStage: (appId: string, stage: ApplicationStage) => void
  onEdit: (app: FundingApplication) => void
}) {
  const match = matchOf(strategy, app.matchId)
  const stageIndex = APPLICATION_STAGES.indexOf(app.applicationStage)
  const prevStage = stageIndex > 0 ? APPLICATION_STAGES[stageIndex - 1] : null
  const nextStage = stageIndex < APPLICATION_STAGES.length - 1 ? APPLICATION_STAGES[stageIndex + 1] : null
  const supplementActive = app.applicationStage === 'supplement_requested'
  const isResult = app.applicationStage === 'approved' || app.applicationStage === 'rejected'
  const program = programName(match?.programId ?? null)

  return (
    <article className="flex w-full flex-col rounded-(--radius-card) border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold break-keep text-slate-900">
              {match ? institutionName(match.institutionId) : '후보 미지정'}
            </h3>
            <ApplicationStageBadge stage={app.applicationStage} />
          </div>
          {program && <p className="mt-0.5 text-[13px] text-slate-500">{program}</p>}
          <p className="mt-0.5 text-[13px] font-medium break-keep text-slate-700">{app.applicationName}</p>
        </div>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={() => onEdit(app)}>
            편집
          </Button>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        <Field label="접수번호·참조" value={app.applicationReference} />
        <Field
          label="신청 금액"
          value={app.requestedAmount ? `${app.requestedAmount} ${app.currency}` : '금액 미입력'}
        />
        {app.approvedAmount && <Field label="승인 금액" value={`${app.approvedAmount} ${app.currency}`} />}
        <Field label="제출일" value={app.submittedAt ? app.submittedAt.slice(0, 10) : ''} />
        <Field label="담당자" value={app.ownerId} />
        <Field label="다음 조치" value={app.nextAction} />
      </dl>

      {supplementActive && app.supplementRequests.length > 0 && (
        <div className="mt-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 p-3">
          <p className="text-[13px] font-semibold text-warning-800">보완 요청 사항</p>
          <ul className="mt-1 flex flex-col gap-1">
            {app.supplementRequests.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] break-keep text-warning-800">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning-400" />
                <span className="min-w-0 whitespace-pre-wrap">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isResult && (
        <p className="mt-3 rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-3 py-2 text-[13px] break-keep text-brand-700">
          결과가 확정된 단계입니다. 결과·성과 화면에서 상세 결과와 성과를 기록하세요.
        </p>
      )}

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={!prevStage}
            onClick={() => prevStage && onStage(app.id, prevStage)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            이전 단계
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!nextStage}
            onClick={() => nextStage && onStage(app.id, nextStage)}
          >
            다음 단계
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <label className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-slate-500">단계 이동</span>
            <select
              className="rounded-(--radius-control) border border-slate-200 px-2 py-1 text-[13px]"
              value={app.applicationStage}
              onChange={(e) => onStage(app.id, e.target.value as ApplicationStage)}
            >
              {APPLICATION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STAGE_META[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* 메인 뷰                                                              */
/* ------------------------------------------------------------------ */

function PipelineView({ strategy, readOnly }: { strategy: FundingStrategy; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editApp, setEditApp] = useState<FundingApplication | null>(null)

  const selectableMatches = useMemo(
    () => strategy.matches.filter((m) => m.priority !== 'excluded'),
    [strategy.matches],
  )

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(APPLICATION_STAGES.map((s) => [s, 0])) as Record<ApplicationStage, number>
    for (const app of strategy.applications) counts[app.applicationStage] += 1
    return counts
  }, [strategy.applications])

  function handleStage(appId: string, stage: ApplicationStage) {
    try {
      setApplicationStage(strategy.id, appId, stage)
      showToast('신청 단계를 변경했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '단계 변경에 실패했습니다.')
    }
  }

  async function handleAdd(draft: AppDraft) {
    try {
      addApplication(strategy.id, {
        matchId: draft.matchId,
        applicationName: draft.applicationName.trim(),
        applicationReference: draft.applicationReference.trim(),
        requestedAmount: draft.requestedAmount.trim(),
        currency: draft.currency.trim() || 'KRW',
      })
      showToast('신청을 추가했습니다.')
      setAddOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '신청 추가에 실패했습니다.')
    }
  }

  async function handleEdit(appId: string, draft: AppEditDraft) {
    try {
      updateApplication(strategy.id, appId, {
        requestedAmount: draft.requestedAmount.trim(),
        approvedAmount: draft.approvedAmount.trim(),
        nextAction: draft.nextAction.trim(),
        supplementRequests: draft.supplementRequests
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      showToast('신청 정보를 저장했습니다.')
      setEditApp(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="신청 진행 상황을 단계별로 관리합니다. 승인 가능성·예상 금액을 제시하지 않으며, 금액은 입력한 값만 표시합니다."
        what="후보별 신청을 카드로 만들고 단계 이동 버튼으로 진행 상황을 갱신합니다."
        when="준비자료 점검을 마치고 실제 신청·심사를 진행할 때 사용합니다."
        next="승인·부결 결과가 나오면 결과·성과 화면에서 결과를 기록하세요."
      />
      <ReadOnlyNotice strategy={strategy} />

      <StageOverview counts={stageCounts} />

      <Panel
        title="신청 목록"
        actions={
          !readOnly && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              신청 추가
            </Button>
          )
        }
      >
        {strategy.applications.length === 0 ? (
          <EmptyState
            icon={Target}
            title="아직 신청이 없습니다."
            description="후보 기관을 선택해 신청을 추가하고 단계를 관리하세요."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {strategy.applications.map((app) => (
              <ApplicationCard
                key={app.id}
                strategy={strategy}
                app={app}
                readOnly={readOnly}
                onStage={handleStage}
                onEdit={setEditApp}
              />
            ))}
          </div>
        )}
      </Panel>

      <AddAppModal
        open={addOpen}
        matches={selectableMatches}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />
      {editApp && (
        <EditAppModal key={editApp.id} app={editApp} onClose={() => setEditApp(null)} onSubmit={handleEdit} />
      )}
    </div>
  )
}

export function FundingPipelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return <FundingNotFound />
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => {
        const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
        return <PipelineView strategy={strategy} readOnly={readOnly} />
      }}
    />
  )
}
