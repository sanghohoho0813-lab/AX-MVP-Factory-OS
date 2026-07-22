import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Gauge, Plus, Ruler, Trash2 } from 'lucide-react'
import type {
  MetricDirection,
  ValidationMetricDefinition,
  ValidationMetricMeasurement,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import { METRIC_DIRECTION_META } from '../../lib/validationMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { Modal } from '../../components/ui/Modal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { MetricDirectionBadge } from '../../components/validation/badges'
import {
  addMetric,
  recordMeasurement,
  removeMetric,
  updateMetric,
} from '../../services/validationService'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none'
const labelCls = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'
const DIRECTIONS: MetricDirection[] = ['increase', 'decrease', 'maintain', 'threshold']

function toastError(showToast: (m: string) => void, error: unknown) {
  showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
}

/** metricId에 대한 가장 최근 측정값을 반환한다 (없으면 null). */
function latestMeasurement(
  measurements: ValidationMetricMeasurement[],
  metricId: string,
): ValidationMetricMeasurement | null {
  const list = measurements.filter((m) => m.metricId === metricId)
  if (list.length === 0) return null
  return list.reduce((a, b) => (a.measuredAt >= b.measuredAt ? a : b))
}

/* ------------------------------------------------------------------ */
/* KPI 추가·편집 모달                                                   */
/* ------------------------------------------------------------------ */

interface MetricForm {
  name: string
  direction: MetricDirection
  unit: string
  baselineValue: string
  targetValue: string
  measurementMethod: string
  required: boolean
}

function MetricModal({
  open,
  onClose,
  workspaceId,
  metric,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  metric: ValidationMetricDefinition | null
}) {
  const { showToast } = useToast()
  const [form, setForm] = useState<MetricForm>(() => ({
    name: metric?.name ?? '',
    direction: metric?.direction ?? 'increase',
    unit: metric?.unit ?? '',
    baselineValue: metric?.baselineValue ?? '',
    targetValue: metric?.targetValue ?? '',
    measurementMethod: metric?.measurementMethod ?? '',
    required: metric?.required ?? true,
  }))

  const submit = () => {
    if (!form.name.trim()) {
      showToast('KPI 이름을 입력하세요.')
      return
    }
    try {
      if (metric) {
        updateMetric(workspaceId, metric.id, { ...form, name: form.name.trim() })
        showToast('KPI를 수정했습니다.')
      } else {
        addMetric(workspaceId, { ...form, name: form.name.trim() })
        showToast('KPI를 추가했습니다.')
      }
      onClose()
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <Modal
      open={open}
      title={metric ? 'KPI 수정' : 'KPI 추가'}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>{metric ? '수정' : '추가'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-600">
          기준값·목표값은 근거가 있을 때만 입력하세요. 측정값은 별도로 '측정값 기록'에서 실측을 남깁니다.
        </p>
        <div>
          <label htmlFor="m-name" className={labelCls}>KPI 이름</label>
          <input id="m-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="예: 처리 소요 시간" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="m-dir" className={labelCls}>목표 방향</label>
            <select id="m-dir" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as MetricDirection }))} className={inputCls}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>{METRIC_DIRECTION_META[d].symbol} {METRIC_DIRECTION_META[d].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="m-unit" className={labelCls}>단위</label>
            <input id="m-unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className={inputCls} placeholder="예: 분, 건, %" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="m-base" className={labelCls}>기준값 (선택)</label>
            <input id="m-base" value={form.baselineValue} onChange={(e) => setForm((f) => ({ ...f, baselineValue: e.target.value }))} className={inputCls} placeholder="근거 있을 때만" />
          </div>
          <div>
            <label htmlFor="m-target" className={labelCls}>목표값 (선택)</label>
            <input id="m-target" value={form.targetValue} onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} className={inputCls} placeholder="근거 있을 때만" />
          </div>
        </div>
        <div>
          <label htmlFor="m-method" className={labelCls}>측정 방법</label>
          <textarea id="m-method" value={form.measurementMethod} onChange={(e) => setForm((f) => ({ ...f, measurementMethod: e.target.value }))} rows={2} className={inputCls} placeholder="어떻게 측정하는지" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.required} onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))} className="size-4 rounded border-slate-300" />
          필수 KPI (검증 판정에 반영)
        </label>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* 측정값 기록 모달                                                     */
/* ------------------------------------------------------------------ */

function MeasurementModal({
  open,
  onClose,
  workspaceId,
  metric,
  rounds,
}: {
  open: boolean
  onClose: () => void
  workspaceId: string
  metric: ValidationMetricDefinition | null
  rounds: ValidationWorkspace['rounds']
}) {
  const { showToast } = useToast()
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState(metric?.unit ?? '')
  const [roundId, setRoundId] = useState('')
  const [notes, setNotes] = useState('')

  const submit = () => {
    if (!metric) return
    if (!value.trim()) {
      showToast('측정값을 입력하세요.')
      return
    }
    try {
      recordMeasurement(workspaceId, {
        metricId: metric.id,
        value: value.trim(),
        unit: unit.trim() || metric.unit,
        roundId: roundId || null,
        notes,
      })
      showToast('측정값을 기록했습니다.')
      setValue('')
      setNotes('')
      onClose()
    } catch (error) {
      toastError(showToast, error)
    }
  }

  return (
    <Modal
      open={open}
      title={`측정값 기록 · ${metric?.name ?? ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit}>기록</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="me-val" className={labelCls}>측정값</label>
            <input id="me-val" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="실측값" />
          </div>
          <div>
            <label htmlFor="me-unit" className={labelCls}>단위</label>
            <input id="me-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="me-round" className={labelCls}>측정 회차 (선택)</label>
          <select id="me-round" value={roundId} onChange={(e) => setRoundId(e.target.value)} className={inputCls}>
            <option value="">회차 미지정</option>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.roundNumber}회차 · {r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="me-notes" className={labelCls}>메모 (선택)</label>
          <textarea id="me-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* KPI 카드                                                             */
/* ------------------------------------------------------------------ */

function MetricCard({
  metric,
  w,
  readOnly,
  onEdit,
  onMeasure,
}: {
  metric: ValidationMetricDefinition
  w: ValidationWorkspace
  readOnly: boolean
  onEdit: (m: ValidationMetricDefinition) => void
  onMeasure: (m: ValidationMetricDefinition) => void
}) {
  const { showToast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const history = w.metricMeasurements
    .filter((m) => m.metricId === metric.id)
    .slice()
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))
  const latest = latestMeasurement(w.metricMeasurements, metric.id)

  const remove = () => {
    setBusy(true)
    try {
      removeMetric(w.id, metric.id)
      showToast('KPI를 삭제했습니다.')
      setConfirmOpen(false)
    } catch (error) {
      toastError(showToast, error)
    } finally {
      setBusy(false)
    }
  }

  const roundLabel = (roundId: string | null): string => {
    if (!roundId) return ''
    const r = w.rounds.find((x) => x.id === roundId)
    return r ? ` · ${r.roundNumber}회차` : ''
  }

  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-800">{metric.name}</p>
        <MetricDirectionBadge direction={metric.direction} />
        {metric.required && <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.82rem] font-medium text-slate-500">필수</span>}
        {metric.unit && <span className="text-[0.9rem] text-slate-400">단위: {metric.unit}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[0.95rem] sm:grid-cols-3">
        <div><span className="text-[0.9rem] text-slate-400">기준값</span><p className="font-medium text-slate-700">{metric.baselineValue || '미입력'}</p></div>
        <div><span className="text-[0.9rem] text-slate-400">목표값</span><p className="font-medium text-slate-700">{metric.targetValue || '미입력'}</p></div>
        <div>
          <span className="text-[0.9rem] text-slate-400">최근 측정값</span>
          {latest ? (
            <p className="font-semibold text-slate-800">{latest.value}{latest.unit ? ` ${latest.unit}` : ''}</p>
          ) : (
            <p className="font-semibold text-warning-600">측정 필요</p>
          )}
        </div>
      </div>
      {metric.measurementMethod && <p className="mt-1.5 text-[0.9rem] break-keep text-slate-400">측정 방법: {metric.measurementMethod}</p>}

      {history.length > 0 && (
        <div className="mt-2.5 border-t border-slate-100 pt-2.5">
          <p className="mb-1 text-[0.9rem] font-semibold text-slate-500">측정 이력</p>
          <ul className="flex flex-col gap-1">
            {history.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 text-[0.95rem] text-slate-600">
                <span className="font-medium text-slate-800">{m.value}{m.unit ? ` ${m.unit}` : ''}</span>
                <span className="text-[0.9rem] text-slate-400">{new Date(m.measuredAt).toLocaleDateString('ko-KR')}{roundLabel(m.roundId)}</span>
                {m.notes && <span className="text-[0.9rem] break-keep text-slate-400">— {m.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onMeasure(metric)}>
            <Ruler aria-hidden="true" className="size-4" />
            측정값 기록
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(metric)}>수정</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 aria-hidden="true" className="size-4" />
            삭제
          </Button>
        </div>
      )}
      <ConfirmModal
        open={confirmOpen}
        title="KPI 삭제"
        message={`'${metric.name}' KPI와 측정 이력을 삭제할까요?`}
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
/* 본문                                                                */
/* ------------------------------------------------------------------ */

function MetricsBody({ w }: { w: ValidationWorkspace }) {
  const readOnly = w.status === 'finalized' || w.status === 'superseded'
  const [addOpen, setAddOpen] = useState(false)
  const [editMetric, setEditMetric] = useState<ValidationMetricDefinition | null>(null)
  const [measureMetric, setMeasureMetric] = useState<ValidationMetricDefinition | null>(null)

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="이 테스트에서 확인할 KPI를 정의하고, 실측값을 기록합니다. 측정값이 없으면 '측정 필요'로 둡니다."
        what="KPI 이름·방향·목표를 정의하고, 회차별 실측값을 남깁니다."
        when="테스트 준비 시 KPI를 정의하고, 회차 중·후에 측정값을 기록합니다."
        next="필수 KPI가 측정되어야 결과 판정·확정에서 근거로 인정됩니다."
      />

      <Panel
        title={`KPI (${w.metricDefinitions.length})`}
        actions={
          !readOnly && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              KPI 추가
            </Button>
          )
        }
      >
        {w.metricDefinitions.length === 0 ? (
          <EmptyState icon={Gauge} title="정의된 KPI가 없습니다" description="이 테스트에서 확인할 KPI를 추가하세요." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {w.metricDefinitions.map((m) => (
              <MetricCard
                key={m.id}
                metric={m}
                w={w}
                readOnly={readOnly}
                onEdit={setEditMetric}
                onMeasure={setMeasureMetric}
              />
            ))}
          </ul>
        )}
      </Panel>

      <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.95rem] break-keep text-slate-500">
        근거 없는 KPI 숫자를 만들지 마세요 — 측정값이 없으면 '측정 필요'로 둡니다.
      </p>

      {addOpen && <MetricModal open={addOpen} onClose={() => setAddOpen(false)} workspaceId={w.id} metric={null} />}
      {editMetric && (
        <MetricModal
          key={editMetric.id}
          open={editMetric !== null}
          onClose={() => setEditMetric(null)}
          workspaceId={w.id}
          metric={editMetric}
        />
      )}
      {measureMetric && (
        <MeasurementModal
          key={measureMetric.id}
          open={measureMetric !== null}
          onClose={() => setMeasureMetric(null)}
          workspaceId={w.id}
          metric={measureMetric}
          rounds={w.rounds}
        />
      )}
    </>
  )
}

export function TrackMetricsPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <MetricsBody w={w} />}
    />
  )
}
