import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, Pencil, Plus, ShieldAlert, Trash2, TrendingUp } from 'lucide-react'
import type {
  FundingApplication,
  FundingOutcome,
  FundingStrategy,
  OutcomeMetric,
  OutcomeMetricType,
  OutcomeType,
} from '../../types/funding'
import {
  OUTCOME_METRIC_TYPE_META,
  OUTCOME_METRIC_TYPES,
  OUTCOME_TYPE_META,
  OUTCOME_TYPES,
} from '../../lib/fundingMeta'
import { OutcomeTypeBadge } from '../../components/funding/badges'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { Modal } from '../../components/ui/Modal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  addMetric,
  recordOutcome,
  removeMetric,
  removeOutcome,
  updateInternalPerformance,
  updateMetric,
  updateOutcome,
} from '../../services/fundingService'
import { FundingStrategyFrame } from './fundingShared'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'
const labelClass = 'text-[13px] font-medium text-slate-600'

function displayValue(value: string): string {
  return value.trim() === '' ? '미입력' : value
}
function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}

export function FundingOutcomePage() {
  const { projectId = '' } = useParams()
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => <OutcomeContent strategy={strategy} />}
    />
  )
}

interface OutcomeFormState {
  applicationId: string
  type: OutcomeType
  summary: string
  requestedAmount: string
  approvedAmount: string
  executedAmount: string
  approvalDate: string
  executionDate: string
  conditions: string
  rejectionReasons: string
  lessonsLearned: string
}

function emptyOutcomeForm(applicationId: string): OutcomeFormState {
  return {
    applicationId,
    type: 'approved',
    summary: '',
    requestedAmount: '',
    approvedAmount: '',
    executedAmount: '',
    approvalDate: '',
    executionDate: '',
    conditions: '',
    rejectionReasons: '',
    lessonsLearned: '',
  }
}

interface MetricFormState {
  type: OutcomeMetricType
  name: string
  unit: string
  outcomeId: string
  baselineValue: string
  targetValue: string
  actualValue: string
  measurementMethod: string
  sensitive: boolean
}

function emptyMetricForm(): MetricFormState {
  return {
    type: 'funding_amount',
    name: '',
    unit: '',
    outcomeId: '',
    baselineValue: '',
    targetValue: '',
    actualValue: '',
    measurementMethod: '',
    sensitive: false,
  }
}

function OutcomeContent({ strategy }: { strategy: FundingStrategy }) {
  const { showToast } = useToast()
  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'

  const [outcomeModal, setOutcomeModal] = useState<{ mode: 'create' | 'edit'; id: string } | null>(null)
  const [outcomeForm, setOutcomeForm] = useState<OutcomeFormState>(emptyOutcomeForm(''))
  const [outcomeToDelete, setOutcomeToDelete] = useState<FundingOutcome | null>(null)

  const [metricModal, setMetricModal] = useState<{ mode: 'create' | 'edit'; id: string } | null>(null)
  const [metricForm, setMetricForm] = useState<MetricFormState>(emptyMetricForm())
  const [metricToDelete, setMetricToDelete] = useState<OutcomeMetric | null>(null)

  const appById = new Map<string, FundingApplication>(strategy.applications.map((a) => [a.id, a]))
  const outcomeLabel = (id: string): string => {
    const out = strategy.outcomes.find((o) => o.id === id)
    if (!out) return '연결 없음'
    return `${OUTCOME_TYPE_META[out.type].label} · ${out.summary.slice(0, 20) || '요약 없음'}`
  }

  /* ---------- 결과 ---------- */
  const openCreateOutcome = () => {
    setOutcomeForm(emptyOutcomeForm(strategy.applications[0]?.id ?? ''))
    setOutcomeModal({ mode: 'create', id: '' })
  }
  const openEditOutcome = (outcome: FundingOutcome) => {
    setOutcomeForm({
      applicationId: outcome.applicationId,
      type: outcome.type,
      summary: outcome.summary,
      requestedAmount: outcome.requestedAmount,
      approvedAmount: outcome.approvedAmount,
      executedAmount: outcome.executedAmount,
      approvalDate: outcome.approvalDate,
      executionDate: outcome.executionDate,
      conditions: outcome.conditions.join('\n'),
      rejectionReasons: outcome.rejectionReasons.join('\n'),
      lessonsLearned: outcome.lessonsLearned,
    })
    setOutcomeModal({ mode: 'edit', id: outcome.id })
  }
  const submitOutcome = () => {
    if (!outcomeModal) return
    try {
      if (outcomeModal.mode === 'create') {
        recordOutcome(strategy.id, {
          applicationId: outcomeForm.applicationId,
          type: outcomeForm.type,
          summary: outcomeForm.summary,
          requestedAmount: outcomeForm.requestedAmount,
          approvedAmount: outcomeForm.approvedAmount,
          executedAmount: outcomeForm.executedAmount,
          approvalDate: outcomeForm.approvalDate,
          executionDate: outcomeForm.executionDate,
          conditions: linesToArray(outcomeForm.conditions),
          rejectionReasons: linesToArray(outcomeForm.rejectionReasons),
          lessonsLearned: outcomeForm.lessonsLearned,
        })
        showToast('실제 결과를 기록했습니다.')
      } else {
        updateOutcome(strategy.id, outcomeModal.id, {
          type: outcomeForm.type,
          summary: outcomeForm.summary,
          requestedAmount: outcomeForm.requestedAmount,
          approvedAmount: outcomeForm.approvedAmount,
          executedAmount: outcomeForm.executedAmount,
          approvalDate: outcomeForm.approvalDate,
          executionDate: outcomeForm.executionDate,
          lessonsLearned: outcomeForm.lessonsLearned,
        })
        showToast('결과를 수정했습니다.')
      }
      setOutcomeModal(null)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const confirmRemoveOutcome = () => {
    if (!outcomeToDelete) return
    try {
      removeOutcome(strategy.id, outcomeToDelete.id)
      showToast('결과를 삭제했습니다.')
      setOutcomeToDelete(null)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  /* ---------- KPI ---------- */
  const openCreateMetric = () => {
    setMetricForm(emptyMetricForm())
    setMetricModal({ mode: 'create', id: '' })
  }
  const openEditMetric = (metric: OutcomeMetric) => {
    setMetricForm({
      type: metric.type,
      name: metric.name,
      unit: metric.unit,
      outcomeId: metric.outcomeId,
      baselineValue: metric.baselineValue,
      targetValue: metric.targetValue,
      actualValue: metric.actualValue,
      measurementMethod: metric.measurementMethod,
      sensitive: metric.sensitive,
    })
    setMetricModal({ mode: 'edit', id: metric.id })
  }
  const submitMetric = () => {
    if (!metricModal) return
    try {
      if (metricModal.mode === 'create') {
        addMetric(strategy.id, {
          type: metricForm.type,
          name: metricForm.name,
          unit: metricForm.unit,
          outcomeId: metricForm.outcomeId,
          baselineValue: metricForm.baselineValue,
          targetValue: metricForm.targetValue,
          actualValue: metricForm.actualValue,
          measurementMethod: metricForm.measurementMethod,
          sensitive: metricForm.sensitive,
        })
        showToast('성과 KPI를 추가했습니다.')
      } else {
        updateMetric(strategy.id, metricModal.id, {
          actualValue: metricForm.actualValue,
        })
        showToast('실제값을 기록했습니다.')
      }
      setMetricModal(null)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const toggleVerified = (metric: OutcomeMetric) => {
    try {
      updateMetric(strategy.id, metric.id, { verified: !metric.verified })
      showToast(metric.verified ? '검증 표시를 해제했습니다.' : '검증 완료로 표시했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const confirmRemoveMetric = () => {
    if (!metricToDelete) return
    try {
      removeMetric(strategy.id, metricToDelete.id)
      showToast('KPI를 삭제했습니다.')
      setMetricToDelete(null)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  const editingOutcomeCreate = outcomeModal?.mode === 'create'

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="실제 신청 결과와 성과를 기록합니다. 근거 없는 전후 수치를 만들지 않으며 실제값·검증 여부를 표시합니다."
        what="승인·부결 등 실제 결과와 검증된 성과 KPI를 기록합니다."
        when="신청·심사가 끝나 결과가 확인되었을 때 사용합니다."
        next="실제 결과가 있으면 사례로 정리할 수 있습니다."
      />

      {/* 결과 */}
      <Panel
        title="결과 (Outcomes)"
        actions={
          !readOnly && (
            <Button variant="primary" size="sm" onClick={openCreateOutcome} disabled={strategy.applications.length === 0}>
              <Plus aria-hidden="true" className="size-4" />
              결과 기록
            </Button>
          )
        }
        flush
      >
        {strategy.outcomes.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="아직 기록된 결과가 없습니다"
            description={
              strategy.applications.length === 0
                ? '먼저 신청·심사 화면에서 신청 건을 등록한 뒤 결과를 기록하세요.'
                : '실제 승인·부결 결과가 확인되면 기록하세요. 금액은 입력한 경우에만 표시됩니다.'
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {strategy.outcomes.map((outcome) => (
              <li key={outcome.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomeTypeBadge type={outcome.type} />
                      <span className="text-sm font-medium text-slate-700">
                        {appById.get(outcome.applicationId)?.applicationName ?? '연결된 신청 없음'}
                      </span>
                    </div>
                    <p className="text-[13px] break-keep text-slate-600">{displayValue(outcome.summary)}</p>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditOutcome(outcome)}>
                        <Pencil aria-hidden="true" className="size-3.5" />
                        수정
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setOutcomeToDelete(outcome)}>
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        삭제
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
                  <AmountField label="요청 금액" value={outcome.requestedAmount} />
                  <AmountField label="승인 금액" value={outcome.approvedAmount} />
                  <AmountField label="집행 금액" value={outcome.executedAmount} />
                  <AmountField label="승인일" value={outcome.approvalDate} />
                  <AmountField label="집행일" value={outcome.executionDate} />
                </dl>
                {outcome.conditions.length > 0 && (
                  <ListBlock title="승인 조건" items={outcome.conditions} />
                )}
                {outcome.rejectionReasons.length > 0 && (
                  <ListBlock title="부결 사유" items={outcome.rejectionReasons} />
                )}
                {outcome.lessonsLearned.trim() !== '' && (
                  <TextBlock title="배운 점" value={outcome.lessonsLearned} />
                )}
                {outcome.followUpActions.length > 0 && (
                  <ListBlock title="후속 조치" items={outcome.followUpActions} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 성과 KPI */}
      <Panel
        title="성과 KPI"
        actions={
          !readOnly && (
            <Button variant="secondary" size="sm" onClick={openCreateMetric}>
              <Plus aria-hidden="true" className="size-4" />
              KPI 추가
            </Button>
          )
        }
        flush
      >
        <div className="px-5 pt-4">
          <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-3 py-2 text-[13px] break-keep text-slate-500">
            근거 없는 전후 수치를 만들지 않으며 실제값·검증 여부를 표시합니다. 값이 없으면 &lsquo;미입력&rsquo;으로 둡니다.
          </p>
        </div>
        {strategy.metrics.length === 0 ? (
          <EmptyState icon={TrendingUp} title="등록된 성과 KPI가 없습니다" description="측정 가능한 성과가 확인되면 KPI로 추가하세요." />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {strategy.metrics.map((metric) => (
              <li key={metric.id} className="flex flex-col gap-2.5 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{metric.name || OUTCOME_METRIC_TYPE_META[metric.type].label}</span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.875rem] text-slate-500">
                        {OUTCOME_METRIC_TYPE_META[metric.type].label}
                      </span>
                      {metric.verified ? (
                        <span className="rounded-md border border-success-200 bg-success-50 px-1.5 py-0.5 text-[0.875rem] font-medium text-success-700">검증됨</span>
                      ) : (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.875rem] text-slate-500">미검증</span>
                      )}
                      {metric.sensitive && (
                        <span className="rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.875rem] font-medium text-warning-700">민감정보</span>
                      )}
                    </div>
                    {metric.outcomeId && (
                      <span className="text-[0.875rem] text-slate-400">연결 결과: {outcomeLabel(metric.outcomeId)}</span>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleVerified(metric)}>
                        {metric.verified ? '검증 해제' : '검증 완료'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditMetric(metric)}>
                        <Pencil aria-hidden="true" className="size-3.5" />
                        실제값
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setMetricToDelete(metric)}>
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        삭제
                      </Button>
                    </div>
                  )}
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <AmountField label="기준값(전)" value={metric.baselineValue} />
                  <AmountField label="목표값" value={metric.targetValue} />
                  <AmountField label="실제값(후)" value={metric.actualValue} />
                  <AmountField label="단위" value={metric.unit} />
                </dl>
                {metric.measurementMethod.trim() !== '' && (
                  <TextBlock title="측정 방법" value={metric.measurementMethod} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 내부 성과 (기본 접힘) */}
      <InternalPerformanceSection strategy={strategy} readOnly={readOnly} />

      {/* 결과 기록/수정 모달 */}
      <Modal
        open={outcomeModal !== null}
        title={editingOutcomeCreate ? '결과 기록' : '결과 수정'}
        onClose={() => setOutcomeModal(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOutcomeModal(null)}>취소</Button>
            <Button variant="primary" onClick={submitOutcome}>{editingOutcomeCreate ? '기록' : '저장'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Labeled label="신청 건">
            <select
              className={inputClass}
              value={outcomeForm.applicationId}
              disabled={!editingOutcomeCreate}
              onChange={(e) => setOutcomeForm((f) => ({ ...f, applicationId: e.target.value }))}
            >
              {strategy.applications.length === 0 && <option value="">신청 건 없음</option>}
              {strategy.applications.map((app) => (
                <option key={app.id} value={app.id}>{app.applicationName}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="결과 유형">
            <select
              className={inputClass}
              value={outcomeForm.type}
              onChange={(e) => setOutcomeForm((f) => ({ ...f, type: e.target.value as OutcomeType }))}
            >
              {OUTCOME_TYPES.map((t) => (
                <option key={t} value={t}>{OUTCOME_TYPE_META[t].label}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="결과 요약">
            <textarea
              className={inputClass}
              rows={2}
              value={outcomeForm.summary}
              onChange={(e) => setOutcomeForm((f) => ({ ...f, summary: e.target.value }))}
            />
          </Labeled>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Labeled label="요청 금액">
              <input className={inputClass} placeholder="실제 결과 입력" value={outcomeForm.requestedAmount} onChange={(e) => setOutcomeForm((f) => ({ ...f, requestedAmount: e.target.value }))} />
            </Labeled>
            <Labeled label="승인 금액">
              <input className={inputClass} placeholder="실제 결과 입력" value={outcomeForm.approvedAmount} onChange={(e) => setOutcomeForm((f) => ({ ...f, approvedAmount: e.target.value }))} />
            </Labeled>
            <Labeled label="집행 금액">
              <input className={inputClass} placeholder="실제 결과 입력" value={outcomeForm.executedAmount} onChange={(e) => setOutcomeForm((f) => ({ ...f, executedAmount: e.target.value }))} />
            </Labeled>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Labeled label="승인일">
              <input type="date" className={inputClass} value={outcomeForm.approvalDate} onChange={(e) => setOutcomeForm((f) => ({ ...f, approvalDate: e.target.value }))} />
            </Labeled>
            <Labeled label="집행일">
              <input type="date" className={inputClass} value={outcomeForm.executionDate} onChange={(e) => setOutcomeForm((f) => ({ ...f, executionDate: e.target.value }))} />
            </Labeled>
          </div>
          {editingOutcomeCreate && (
            <>
              <Labeled label="승인 조건 (줄바꿈으로 구분)">
                <textarea className={inputClass} rows={2} value={outcomeForm.conditions} onChange={(e) => setOutcomeForm((f) => ({ ...f, conditions: e.target.value }))} />
              </Labeled>
              <Labeled label="부결 사유 (줄바꿈으로 구분)">
                <textarea className={inputClass} rows={2} value={outcomeForm.rejectionReasons} onChange={(e) => setOutcomeForm((f) => ({ ...f, rejectionReasons: e.target.value }))} />
              </Labeled>
            </>
          )}
          <Labeled label="배운 점">
            <textarea className={inputClass} rows={2} value={outcomeForm.lessonsLearned} onChange={(e) => setOutcomeForm((f) => ({ ...f, lessonsLearned: e.target.value }))} />
          </Labeled>
        </div>
      </Modal>

      {/* KPI 모달 */}
      <Modal
        open={metricModal !== null}
        title={metricModal?.mode === 'create' ? 'KPI 추가' : '실제값·검증 수정'}
        onClose={() => setMetricModal(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMetricModal(null)}>취소</Button>
            <Button variant="primary" onClick={submitMetric}>{metricModal?.mode === 'create' ? '추가' : '저장'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {metricModal?.mode === 'create' ? (
            <>
              <Labeled label="지표 유형">
                <select className={inputClass} value={metricForm.type} onChange={(e) => setMetricForm((f) => ({ ...f, type: e.target.value as OutcomeMetricType }))}>
                  {OUTCOME_METRIC_TYPES.map((t) => (
                    <option key={t} value={t}>{OUTCOME_METRIC_TYPE_META[t].label}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="지표 이름">
                <input className={inputClass} value={metricForm.name} onChange={(e) => setMetricForm((f) => ({ ...f, name: e.target.value }))} />
              </Labeled>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Labeled label="단위">
                  <input className={inputClass} value={metricForm.unit} onChange={(e) => setMetricForm((f) => ({ ...f, unit: e.target.value }))} />
                </Labeled>
                <Labeled label="연결 결과 (선택)">
                  <select className={inputClass} value={metricForm.outcomeId} onChange={(e) => setMetricForm((f) => ({ ...f, outcomeId: e.target.value }))}>
                    <option value="">연결 없음</option>
                    {strategy.outcomes.map((o) => (
                      <option key={o.id} value={o.id}>{outcomeLabel(o.id)}</option>
                    ))}
                  </select>
                </Labeled>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Labeled label="기준값(전)">
                  <input className={inputClass} placeholder="실제값 입력" value={metricForm.baselineValue} onChange={(e) => setMetricForm((f) => ({ ...f, baselineValue: e.target.value }))} />
                </Labeled>
                <Labeled label="목표값">
                  <input className={inputClass} placeholder="실제값 입력" value={metricForm.targetValue} onChange={(e) => setMetricForm((f) => ({ ...f, targetValue: e.target.value }))} />
                </Labeled>
                <Labeled label="실제값(후)">
                  <input className={inputClass} placeholder="실제값 입력" value={metricForm.actualValue} onChange={(e) => setMetricForm((f) => ({ ...f, actualValue: e.target.value }))} />
                </Labeled>
              </div>
              <Labeled label="측정 방법">
                <input className={inputClass} value={metricForm.measurementMethod} onChange={(e) => setMetricForm((f) => ({ ...f, measurementMethod: e.target.value }))} />
              </Labeled>
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input type="checkbox" checked={metricForm.sensitive} onChange={(e) => setMetricForm((f) => ({ ...f, sensitive: e.target.checked }))} />
                민감정보 (고객용 자료에서 가림)
              </label>
            </>
          ) : (
            <Labeled label="실제값(후)">
              <input className={inputClass} placeholder="실제값 입력" value={metricForm.actualValue} onChange={(e) => setMetricForm((f) => ({ ...f, actualValue: e.target.value }))} />
            </Labeled>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={outcomeToDelete !== null}
        title="결과 삭제"
        message="이 결과 기록을 삭제하시겠습니까? 연결된 성과 KPI도 함께 삭제됩니다."
        warning="삭제하면 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={confirmRemoveOutcome}
        onCancel={() => setOutcomeToDelete(null)}
      />
      <ConfirmModal
        open={metricToDelete !== null}
        title="KPI 삭제"
        message="이 성과 KPI를 삭제하시겠습니까?"
        confirmLabel="삭제"
        danger
        onConfirm={confirmRemoveMetric}
        onCancel={() => setMetricToDelete(null)}
      />
    </div>
  )
}

function InternalPerformanceSection({ strategy, readOnly }: { strategy: FundingStrategy; readOnly: boolean }) {
  const { showToast } = useToast()
  const ip = strategy.internalPerformance
  const [form, setForm] = useState({
    leadConsultant: ip.leadConsultant,
    totalHours: ip.totalHours,
    externalCost: ip.externalCost,
    clientFee: ip.clientFee,
    additionalContracts: ip.additionalContracts,
    referrals: ip.referrals,
    renewals: ip.renewals,
    notes: ip.notes,
  })

  const save = () => {
    try {
      updateInternalPerformance(strategy.id, form)
      showToast('내부 성과를 저장했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  return (
    <details className="group rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <ShieldAlert aria-hidden="true" className="size-4 text-warning-500" />
          내부 성과 (민감정보 · 기본 접힘)
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-5 py-5">
        <p className="mb-4 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3 py-2 text-[13px] break-keep text-warning-700">
          금액(외부 투입비·수임료 등)은 민감정보이며 고객용 자료에서 자동으로 가려집니다. 메인 화면에서는 강조하지 않습니다.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labeled label="담당 컨설턴트"><input className={inputClass} value={form.leadConsultant} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, leadConsultant: e.target.value }))} /></Labeled>
          <Labeled label="총 투입 시간"><input className={inputClass} value={form.totalHours} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, totalHours: e.target.value }))} /></Labeled>
          <Labeled label="외부 투입비 (민감)"><input className={inputClass} value={form.externalCost} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, externalCost: e.target.value }))} /></Labeled>
          <Labeled label="수임료 (민감)"><input className={inputClass} value={form.clientFee} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, clientFee: e.target.value }))} /></Labeled>
          <Labeled label="추가 계약"><input className={inputClass} value={form.additionalContracts} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, additionalContracts: e.target.value }))} /></Labeled>
          <Labeled label="소개 건"><input className={inputClass} value={form.referrals} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, referrals: e.target.value }))} /></Labeled>
          <Labeled label="재계약"><input className={inputClass} value={form.renewals} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, renewals: e.target.value }))} /></Labeled>
        </div>
        <div className="mt-3">
          <Labeled label="비고"><textarea className={inputClass} rows={2} value={form.notes} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Labeled>
        </div>
        {!readOnly && (
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" size="sm" onClick={save}>내부 성과 저장</Button>
          </div>
        )}
      </div>
    </details>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function AmountField({ label, value }: { label: string; value: string }) {
  const empty = value.trim() === ''
  return (
    <div className="flex flex-col">
      <dt className="text-[0.875rem] text-slate-400">{label}</dt>
      <dd className={`text-[13px] ${empty ? 'text-slate-400' : 'font-medium text-slate-700'}`}>{empty ? '미입력' : value}</dd>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="text-[0.875rem] font-semibold text-slate-500">{title}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-[13px] break-keep text-slate-600">· {item}</li>
        ))}
      </ul>
    </div>
  )
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2">
      <p className="text-[0.875rem] font-semibold text-slate-500">{title}</p>
      <p className="mt-0.5 text-[13px] break-keep text-slate-600">{value}</p>
    </div>
  )
}
