import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRightCircle, MessageSquare, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import type {
  FeedbackItem,
  FeedbackSeverity,
  FeedbackSource,
  FeedbackStatus,
  FeedbackType,
  ValidationIssue,
  ValidationIssueStatus,
  ValidationIssueType,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_META,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_META,
  ISSUE_STATUSES,
  ISSUE_STATUS_META,
  ISSUE_TYPES,
  ISSUE_TYPE_META,
  SEVERITIES,
  SEVERITY_META,
} from '../../lib/validationMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { Modal } from '../../components/ui/Modal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  FeedbackStatusBadge,
  FeedbackTypeBadge,
  IssueStatusBadge,
  IssueTypeBadge,
  SeverityBadge,
} from '../../components/validation/badges'
import {
  addFeedback,
  addIssue,
  createIssueFromFeedback,
  removeFeedback,
  updateFeedback,
  updateIssue,
} from '../../services/validationService'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none'
const labelCls = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'

const FEEDBACK_SOURCE_LABEL: Record<FeedbackSource, string> = {
  participant: '참여자',
  facilitator: '진행자',
  observer: '관찰자',
  system: '시스템',
  manual: '수동 입력',
}
const FEEDBACK_SOURCES: FeedbackSource[] = ['participant', 'facilitator', 'observer', 'system', 'manual']

function toastError(showToast: (m: string) => void, error: unknown) {
  showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
}

function isOpenCritical(issue: ValidationIssue): boolean {
  return (
    issue.severity === 'critical' &&
    issue.status !== 'verified' &&
    issue.status !== 'accepted_risk' &&
    issue.status !== 'wont_fix'
  )
}

/* ------------------------------------------------------------------ */
/* 피드백 추가 모달                                                     */
/* ------------------------------------------------------------------ */

function AddFeedbackModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
}) {
  const { showToast } = useToast()
  const [type, setType] = useState<FeedbackType>('usability')
  const [severity, setSeverity] = useState<FeedbackSeverity>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [context, setContext] = useState('')
  const [source, setSource] = useState<FeedbackSource>('facilitator')

  const reset = () => {
    setType('usability')
    setSeverity('medium')
    setTitle('')
    setDescription('')
    setContext('')
    setSource('facilitator')
  }

  const submit = () => {
    if (!title.trim()) {
      showToast('제목을 입력하세요.')
      return
    }
    try {
      addFeedback(workspaceId, { type, severity, title: title.trim(), description, context, source })
      showToast('피드백을 추가했습니다.')
      reset()
      onClose()
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <Modal
      open={open}
      title="피드백 추가"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>추가</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-600">
          피드백은 참여자·관찰자의 <span className="font-semibold">의견·관찰</span>입니다. 재현 가능한 문제·증거는 이슈로 등록하세요.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="fb-type" className={labelCls}>유형</label>
            <select id="fb-type" value={type} onChange={(e) => setType(e.target.value as FeedbackType)} className={inputCls}>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>{FEEDBACK_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fb-sev" className={labelCls}>심각도</label>
            <select id="fb-sev" value={severity} onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)} className={inputCls}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="fb-title" className={labelCls}>제목</label>
          <input id="fb-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="예: 저장 버튼 위치를 찾기 어렵다는 의견" />
        </div>
        <div>
          <label htmlFor="fb-desc" className={labelCls}>설명</label>
          <textarea id="fb-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
        </div>
        <div>
          <label htmlFor="fb-ctx" className={labelCls}>맥락 (선택)</label>
          <textarea id="fb-ctx" value={context} onChange={(e) => setContext(e.target.value)} rows={2} className={inputCls} placeholder="어떤 상황·화면에서 나온 의견인지" />
        </div>
        <div>
          <label htmlFor="fb-src" className={labelCls}>출처</label>
          <select id="fb-src" value={source} onChange={(e) => setSource(e.target.value as FeedbackSource)} className={inputCls}>
            {FEEDBACK_SOURCES.map((s) => (
              <option key={s} value={s}>{FEEDBACK_SOURCE_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 이슈 추가 모달                                                       */
/* ------------------------------------------------------------------ */

function AddIssueModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
}) {
  const { showToast } = useToast()
  const [type, setType] = useState<ValidationIssueType>('defect')
  const [severity, setSeverity] = useState<FeedbackSeverity>('high')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reproductionSteps, setReproductionSteps] = useState('')
  const [expectedBehavior, setExpectedBehavior] = useState('')
  const [actualBehavior, setActualBehavior] = useState('')
  const [impact, setImpact] = useState('')

  const reset = () => {
    setType('defect')
    setSeverity('high')
    setTitle('')
    setDescription('')
    setReproductionSteps('')
    setExpectedBehavior('')
    setActualBehavior('')
    setImpact('')
  }

  const submit = () => {
    if (!title.trim()) {
      showToast('제목을 입력하세요.')
      return
    }
    try {
      addIssue(workspaceId, {
        type,
        severity,
        title: title.trim(),
        description,
        reproductionSteps,
        expectedBehavior,
        actualBehavior,
        impact,
      })
      showToast('이슈를 추가했습니다.')
      reset()
      onClose()
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <Modal
      open={open}
      title="이슈 추가"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>추가</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-(--radius-control) border border-warning-200 bg-warning-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-600">
          이슈는 <span className="font-semibold">재현 가능한 문제·증거</span>입니다. 재현 절차와 기대·실제 동작을 함께 기록하세요.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="is-type" className={labelCls}>유형</label>
            <select id="is-type" value={type} onChange={(e) => setType(e.target.value as ValidationIssueType)} className={inputCls}>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>{ISSUE_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="is-sev" className={labelCls}>심각도</label>
            <select id="is-sev" value={severity} onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)} className={inputCls}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="is-title" className={labelCls}>제목</label>
          <input id="is-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="is-desc" className={labelCls}>설명</label>
          <textarea id="is-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls} />
        </div>
        <div>
          <label htmlFor="is-repro" className={labelCls}>재현 절차</label>
          <textarea id="is-repro" value={reproductionSteps} onChange={(e) => setReproductionSteps(e.target.value)} rows={2} className={inputCls} placeholder="1. ... 2. ..." />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="is-exp" className={labelCls}>기대 동작</label>
            <textarea id="is-exp" value={expectedBehavior} onChange={(e) => setExpectedBehavior(e.target.value)} rows={2} className={inputCls} />
          </div>
          <div>
            <label htmlFor="is-act" className={labelCls}>실제 동작</label>
            <textarea id="is-act" value={actualBehavior} onChange={(e) => setActualBehavior(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="is-impact" className={labelCls}>영향</label>
          <textarea id="is-impact" value={impact} onChange={(e) => setImpact(e.target.value)} rows={2} className={inputCls} placeholder="이 문제가 업무·사용자에 미치는 영향" />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 위험 감수 사유 입력 모달                                             */
/* ------------------------------------------------------------------ */

function AcceptRiskModal({
  open,
  onClose,
  workspaceId,
  issue,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  issue: ValidationIssue | null
}) {
  const { showToast } = useToast()
  const [reason, setReason] = useState('')
  const [approvedBy, setApprovedBy] = useState('')

  const submit = () => {
    if (!issue) return
    if (!reason.trim() || !approvedBy.trim()) {
      showToast('위험 감수 사유와 승인자를 모두 입력하세요.')
      return
    }
    try {
      updateIssue(workspaceId, issue.id, {
        status: 'accepted_risk',
        acceptedRiskReason: reason.trim(),
        acceptedRiskApprovedBy: approvedBy.trim(),
      })
      showToast('위험 감수로 처리했습니다.')
      setReason('')
      setApprovedBy('')
      onClose()
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <Modal
      open={open}
      title="위험 감수 처리"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>위험 감수 확정</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[0.95rem] break-keep text-slate-600">
          위험 감수는 문제를 남겨두고 진행하겠다는 판단입니다. 사유와 승인자를 반드시 기록하세요.
        </p>
        <div>
          <label htmlFor="ar-reason" className={labelCls}>위험 감수 사유 (필수)</label>
          <textarea id="ar-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} />
        </div>
        <div>
          <label htmlFor="ar-by" className={labelCls}>승인자 (필수)</label>
          <input id="ar-by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className={inputCls} />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 피드백 카드                                                          */
/* ------------------------------------------------------------------ */

function FeedbackCard({
  item,
  workspaceId,
  readOnly,
}: {
  item: FeedbackItem
  workspaceId: string
  readOnly: boolean
}) {
  const { showToast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const changeStatus = (status: FeedbackStatus) => {
    try {
      updateFeedback(workspaceId, item.id, { status })
      showToast('피드백 상태를 변경했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  const promote = () => {
    try {
      createIssueFromFeedback(workspaceId, item.id)
      showToast('이 의견을 추적 이슈로 전환했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  const remove = () => {
    setBusy(true)
    try {
      removeFeedback(workspaceId, item.id)
      showToast('피드백을 삭제했습니다.')
      setConfirmOpen(false)
    } catch (error) {
      toastError(showToast, error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTypeBadge type={item.type} />
        <SeverityBadge severity={item.severity} />
        <FeedbackStatusBadge status={item.status} />
        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
      </div>
      {item.description && <p className="mt-1.5 text-[0.95rem] break-keep whitespace-pre-wrap text-slate-600">{item.description}</p>}
      {item.context && <p className="mt-1 text-[0.9rem] break-keep text-slate-400">맥락: {item.context}</p>}
      <p className="mt-1 text-[0.9rem] text-slate-400">출처: {FEEDBACK_SOURCE_LABEL[item.source]}</p>
      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`fb-st-${item.id}`}>상태 변경</label>
          <select
            id={`fb-st-${item.id}`}
            value={item.status}
            onChange={(e) => changeStatus(e.target.value as FeedbackStatus)}
            className="rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[0.95rem] text-slate-700 focus:border-brand-400 focus:outline-none"
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>{FEEDBACK_STATUS_META[s].label}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={promote}>
            <ArrowRightCircle aria-hidden="true" className="size-4" />
            이슈로 전환
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" className="size-4" />
            삭제
          </Button>
        </div>
      )}
      <ConfirmModal
        open={confirmOpen}
        title="피드백 삭제"
        message={`'${item.title}' 피드백을 삭제할까요?`}
        confirmLabel="삭제"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 이슈 카드                                                            */
/* ------------------------------------------------------------------ */

function IssueCard({
  issue,
  workspaceId,
  readOnly,
  onAcceptRisk,
}: {
  issue: ValidationIssue
  workspaceId: string
  readOnly: boolean
  onAcceptRisk: (issue: ValidationIssue) => void
}) {
  const { showToast } = useToast()

  const changeStatus = (status: ValidationIssueStatus) => {
    if (status === 'accepted_risk') {
      onAcceptRisk(issue)
      return
    }
    try {
      updateIssue(workspaceId, issue.id, { status })
      showToast('이슈 상태를 변경했습니다.')
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <IssueTypeBadge type={issue.type} />
        <SeverityBadge severity={issue.severity} />
        <IssueStatusBadge status={issue.status} />
        <p className="text-sm font-semibold text-slate-800">{issue.title}</p>
      </div>
      {issue.description && <p className="mt-1.5 text-[0.95rem] break-keep whitespace-pre-wrap text-slate-600">{issue.description}</p>}
      <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[0.95rem] sm:grid-cols-2">
        {issue.reproductionSteps && (
          <div><dt className="text-[0.9rem] font-semibold text-slate-500">재현 절차</dt><dd className="break-keep whitespace-pre-wrap text-slate-600">{issue.reproductionSteps}</dd></div>
        )}
        {issue.impact && (
          <div><dt className="text-[0.9rem] font-semibold text-slate-500">영향</dt><dd className="break-keep text-slate-600">{issue.impact}</dd></div>
        )}
        {issue.expectedBehavior && (
          <div><dt className="text-[0.9rem] font-semibold text-slate-500">기대 동작</dt><dd className="break-keep text-slate-600">{issue.expectedBehavior}</dd></div>
        )}
        {issue.actualBehavior && (
          <div><dt className="text-[0.9rem] font-semibold text-slate-500">실제 동작</dt><dd className="break-keep text-slate-600">{issue.actualBehavior}</dd></div>
        )}
      </dl>
      {issue.status === 'accepted_risk' && issue.acceptedRiskReason && (
        <p className="mt-2 rounded-(--radius-control) border border-warning-200 bg-warning-50/60 px-3 py-2 text-[0.9rem] break-keep text-warning-700">
          위험 감수 사유: {issue.acceptedRiskReason} · 승인: {issue.acceptedRiskApprovedBy || '미지정'}
        </p>
      )}
      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`is-st-${issue.id}`}>상태 변경</label>
          <select
            id={`is-st-${issue.id}`}
            value={issue.status}
            onChange={(e) => changeStatus(e.target.value as ValidationIssueStatus)}
            className="rounded-(--radius-control) border border-slate-300 px-2.5 py-1.5 text-[0.95rem] text-slate-700 focus:border-brand-400 focus:outline-none"
          >
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>{ISSUE_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 본문                                                                */
/* ------------------------------------------------------------------ */

function FeedbackBody({ w }: { w: ValidationWorkspace }) {
  const readOnly = w.status === 'finalized' || w.status === 'superseded'
  const [tab, setTab] = useState<'feedback' | 'issues'>('feedback')
  const [addFbOpen, setAddFbOpen] = useState(false)
  const [addIsOpen, setAddIsOpen] = useState(false)
  const [riskIssue, setRiskIssue] = useState<ValidationIssue | null>(null)

  const openCriticals = w.issues.filter(isOpenCritical)

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="피드백은 참여자·관찰자의 의견·관찰이고, 이슈는 재현 가능한 문제·증거입니다. 두 가지를 구분해서 관리하세요."
        what="의견은 피드백으로, 재현되는 문제는 이슈로 등록합니다. 피드백은 '이슈로 전환'해 추적 대상으로 승격할 수 있습니다."
        when="테스트 회차 중·후에 나온 반응을 정리할 때 사용합니다."
        next="미해결 critical 이슈가 없어야 Gate 6 통과·검증 확정이 가능합니다."
      />

      <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label="피드백·이슈 탭">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'feedback'}
          onClick={() => setTab('feedback')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'feedback' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          피드백 (의견) · {w.feedbackItems.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'issues'}
          onClick={() => setTab('issues')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${tab === 'issues' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          이슈 (증거·재현) · {w.issues.length}
        </button>
      </div>

      {tab === 'feedback' ? (
        <Panel
          title="피드백 — 의견·관찰"
          actions={
            !readOnly && (
              <Button variant="primary" size="sm" onClick={() => setAddFbOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                추가
              </Button>
            )
          }
        >
          {w.feedbackItems.length === 0 ? (
            <EmptyState icon={MessageSquare} title="등록된 피드백이 없습니다" description="참여자·관찰자의 의견을 기록하세요." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {w.feedbackItems.map((item) => (
                <FeedbackCard key={item.id} item={item} workspaceId={w.id} readOnly={readOnly} />
              ))}
            </ul>
          )}
        </Panel>
      ) : (
        <>
          {openCriticals.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-(--radius-card) border border-danger-200 bg-danger-50 px-4 py-3" role="alert">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-600" />
              <p className="text-[0.95rem] font-medium break-keep text-danger-700">
                미해결 critical 이슈 {openCriticals.length}건 — 미해결 critical 이슈는 Gate 6 통과·검증 확정을 막습니다.
              </p>
            </div>
          )}
          <Panel
            title="이슈 — 증거·재현"
            actions={
              !readOnly && (
                <Button variant="primary" size="sm" onClick={() => setAddIsOpen(true)}>
                  <Plus aria-hidden="true" className="size-4" />
                  추가
                </Button>
              )
            }
          >
            {w.issues.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="등록된 이슈가 없습니다" description="재현 가능한 문제를 증거와 함께 기록하세요." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {w.issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} workspaceId={w.id} readOnly={readOnly} onAcceptRisk={setRiskIssue} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <AddFeedbackModal open={addFbOpen} onClose={() => setAddFbOpen(false)} workspaceId={w.id} />
      <AddIssueModal open={addIsOpen} onClose={() => setAddIsOpen(false)} workspaceId={w.id} />
      <AcceptRiskModal open={riskIssue !== null} onClose={() => setRiskIssue(null)} workspaceId={w.id} issue={riskIssue} />
    </>
  )
}

export function TrackFeedbackPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <FeedbackBody w={w} />}
    />
  )
}
