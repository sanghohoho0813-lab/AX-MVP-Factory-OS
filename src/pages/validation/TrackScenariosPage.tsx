import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, Copy, ListChecks, Pencil, Plus, Archive } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  HypothesisPriority,
  ValidationScenario,
  ValidationScenarioType,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import { SCENARIO_TYPE_META, SCENARIO_TYPES } from '../../lib/validationMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { useToast } from '../../components/ui/toastContext'
import {
  addScenario,
  duplicateScenario,
  moveScenario,
  retireScenario,
  updateScenario,
} from '../../services/validationService'
import { TrackSectionFrame, ReadOnlyNotice } from './validationShared'

const PRIORITY_META: Record<HypothesisPriority, { label: string; tone: StatusTone }> = {
  critical: { label: '긴급', tone: 'danger' },
  high: { label: '높음', tone: 'warning' },
  medium: { label: '보통', tone: 'info' },
  low: { label: '낮음', tone: 'neutral' },
}
const PRIORITIES: HypothesisPriority[] = ['critical', 'high', 'medium', 'low']

const STATUS_LABEL: Record<ValidationScenario['status'], string> = {
  draft: '초안',
  ready: '준비됨',
  retired: '은퇴',
}

function ScenarioTypeBadge({ type }: { type: ValidationScenarioType }) {
  const m = SCENARIO_TYPE_META[type]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.9rem] font-medium ${TONE_BADGE_CLASS[m.tone]}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      {m.label}
    </span>
  )
}

interface ScenarioForm {
  title: string
  description: string
  type: ValidationScenarioType
  priority: HypothesisPriority
  passRule: string
  required: boolean
  preconditions: string
  steps: string
  expectedResult: string
  measurementMethod: string
}

const EMPTY_FORM: ScenarioForm = {
  title: '',
  description: '',
  type: 'happy_path',
  priority: 'medium',
  passRule: '',
  required: true,
  preconditions: '',
  steps: '',
  expectedResult: '',
  measurementMethod: '',
}

const labelClass = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'
const inputClass = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.95rem] focus:border-brand-400 focus:outline-none'

function ScenariosBody({ workspace: w }: { workspace: ValidationWorkspace }) {
  const { showToast } = useToast()
  const readOnly = w.status === 'finalized' || w.status === 'superseded'

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ScenarioForm>(EMPTY_FORM)
  const [retireTarget, setRetireTarget] = useState<ValidationScenario | null>(null)
  const [busy, setBusy] = useState(false)

  const sorted = [...w.scenarios].sort((a, b) => a.orderIndex - b.orderIndex)
  const required = sorted.filter((s) => s.required)
  const optional = sorted.filter((s) => !s.required)

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (s: ValidationScenario) => {
    setEditingId(s.id)
    setForm({
      title: s.title,
      description: s.description,
      type: s.type,
      priority: s.priority,
      passRule: s.passRule,
      required: s.required,
      preconditions: s.preconditions,
      steps: s.steps.join('\n'),
      expectedResult: s.expectedResult,
      measurementMethod: s.measurementMethod,
    })
    setFormOpen(true)
  }

  const submit = () => {
    if (!form.title.trim()) {
      showToast('시나리오 제목을 입력하세요.')
      return
    }
    const steps = form.steps.split('\n').map((t) => t.trim()).filter(Boolean)
    try {
      if (editingId) {
        updateScenario(w.id, editingId, {
          title: form.title,
          description: form.description,
          type: form.type,
          priority: form.priority,
          passRule: form.passRule,
          required: form.required,
          preconditions: form.preconditions,
          steps,
          expectedResult: form.expectedResult,
          measurementMethod: form.measurementMethod,
        })
      } else {
        addScenario(w.id, {
          title: form.title,
          description: form.description,
          type: form.type,
          priority: form.priority,
          passRule: form.passRule,
          required: form.required,
          preconditions: form.preconditions,
          steps,
          expectedResult: form.expectedResult,
          measurementMethod: form.measurementMethod,
        })
      }
      setFormOpen(false)
      showToast(editingId ? '시나리오를 수정했습니다.' : '시나리오를 추가했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const handleDuplicate = (id: string) => {
    try {
      duplicateScenario(w.id, id)
      showToast('시나리오를 복제했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const handleMove = (id: string, direction: 'up' | 'down') => {
    try {
      moveScenario(w.id, id, direction)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  const confirmRetire = () => {
    if (!retireTarget) return
    setBusy(true)
    try {
      retireScenario(w.id, retireTarget.id)
      showToast('시나리오를 은퇴 처리했습니다.')
      setRetireTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const renderRow = (s: ValidationScenario) => {
    const globalIndex = sorted.findIndex((x) => x.id === s.id)
    const invalid = s.required && !s.passRule.trim()
    const retired = s.status === 'retired'
    return (
      <li
        key={s.id}
        className={`rounded-(--radius-card) border px-4 py-3 ${
          invalid ? 'border-warning-300 bg-warning-50/50' : 'border-slate-200'
        } ${retired ? 'opacity-60' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold break-keep text-slate-800">{s.title}</p>
              <ScenarioTypeBadge type={s.type} />
              {s.required ? (
                <span className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.82rem] font-semibold text-brand-700">필수</span>
              ) : (
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.82rem] text-slate-500">선택</span>
              )}
              <span className={`rounded-md border px-1.5 py-0.5 text-[0.82rem] font-medium ${TONE_BADGE_CLASS[PRIORITY_META[s.priority].tone]}`}>
                {PRIORITY_META[s.priority].label}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.82rem] text-slate-500">
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            {s.description && <p className="mt-1 text-[0.95rem] break-keep text-slate-600">{s.description}</p>}
            <p className="mt-1 text-[0.9rem] break-keep text-slate-500">
              통과 기준: {s.passRule.trim() ? s.passRule : <span className="text-warning-700">미입력</span>}
            </p>
            {invalid && (
              <p className="mt-1 flex items-center gap-1 text-[0.9rem] font-medium text-warning-700">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                필수 시나리오에는 통과 기준(passRule)이 필요합니다.
              </p>
            )}
          </div>
          {!readOnly && (
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" aria-label="위로 이동" onClick={() => handleMove(s.id, 'up')} disabled={globalIndex <= 0}>
                <ArrowUp aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" aria-label="아래로 이동" onClick={() => handleMove(s.id, 'down')} disabled={globalIndex >= sorted.length - 1}>
                <ArrowDown aria-hidden="true" className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                <Pencil aria-hidden="true" className="size-4" />
                편집
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDuplicate(s.id)}>
                <Copy aria-hidden="true" className="size-4" />
                복제
              </Button>
              {!retired && (
                <Button variant="ghost" size="sm" onClick={() => setRetireTarget(s)}>
                  <Archive aria-hidden="true" className="size-4" />
                  은퇴
                </Button>
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="시나리오는 확정된 설계에서 도출되어 회차·Gate 판정의 근거가 됩니다. 각 필수 시나리오에는 통과 기준을 반드시 정의하세요."
        what="실제 사용 테스트에서 참여자가 수행할 과제와 통과 기준을 정의합니다."
        when="테스트 계획을 세운 뒤, 회차를 만들기 전에 준비합니다."
        next="회차를 만들어 참여자가 시나리오를 실행하면 결과가 기록됩니다."
      />

      <Panel
        title={`필수 시나리오 (${required.length})`}
        actions={!readOnly ? (
          <Button variant="primary" size="sm" onClick={openAdd}>
            <Plus aria-hidden="true" className="size-4" />
            추가
          </Button>
        ) : undefined}
      >
        {required.length === 0 ? (
          <EmptyState icon={ListChecks} title="필수 시나리오가 없습니다" description="핵심 과제를 검증할 필수 시나리오를 추가하세요." />
        ) : (
          <ul className="flex flex-col gap-2">{required.map(renderRow)}</ul>
        )}
      </Panel>

      <Panel title={`선택 시나리오 (${optional.length})`}>
        {optional.length === 0 ? (
          <p className="text-[0.95rem] text-slate-500">선택 시나리오가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">{optional.map(renderRow)}</ul>
        )}
      </Panel>

      <Modal
        open={formOpen}
        title={editingId ? '시나리오 편집' : '시나리오 추가'}
        onClose={() => setFormOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submit}>{editingId ? '저장' : '추가'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="sc-title" className={labelClass}>제목</label>
            <input id="sc-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sc-desc" className={labelClass}>설명</label>
            <textarea id="sc-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sc-type" className={labelClass}>유형</label>
              <select id="sc-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ValidationScenarioType })} className={inputClass}>
                {SCENARIO_TYPES.map((t) => (
                  <option key={t} value={t}>{SCENARIO_TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sc-priority" className={labelClass}>우선순위</label>
              <select id="sc-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as HypothesisPriority })} className={inputClass}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="sc-pass" className={labelClass}>통과 기준 (passRule)</label>
            <textarea id="sc-pass" rows={2} value={form.passRule} onChange={(e) => setForm({ ...form, passRule: e.target.value })} className={inputClass} placeholder="예: 도움 없이 3분 내 완료하고 오류 0건" />
          </div>
          <label className="flex items-center gap-2 text-[0.95rem] text-slate-700">
            <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="size-4 rounded border-slate-300" />
            필수 시나리오
          </label>
          <div>
            <label htmlFor="sc-pre" className={labelClass}>사전 조건</label>
            <textarea id="sc-pre" rows={2} value={form.preconditions} onChange={(e) => setForm({ ...form, preconditions: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sc-steps" className={labelClass}>수행 단계 (한 줄에 하나)</label>
            <textarea id="sc-steps" rows={3} value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} className={inputClass} placeholder={'로그인한다\n주문을 생성한다\n결과를 확인한다'} />
          </div>
          <div>
            <label htmlFor="sc-expected" className={labelClass}>기대 결과</label>
            <textarea id="sc-expected" rows={2} value={form.expectedResult} onChange={(e) => setForm({ ...form, expectedResult: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="sc-measure" className={labelClass}>측정 방법</label>
            <input id="sc-measure" value={form.measurementMethod} onChange={(e) => setForm({ ...form, measurementMethod: e.target.value })} className={inputClass} placeholder="예: 관찰·기록" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={retireTarget !== null}
        title="시나리오 은퇴"
        message={`"${retireTarget?.title ?? ''}" 시나리오를 은퇴 처리합니다.`}
        warning="은퇴는 삭제가 아닙니다. 완료된 회차가 참조하는 시나리오는 이력 보존을 위해 삭제하지 않고 은퇴 상태로 남깁니다. 은퇴한 시나리오는 새 회차 기본 대상에서 제외됩니다."
        confirmLabel="은퇴 처리"
        busy={busy}
        onConfirm={confirmRetire}
        onCancel={() => setRetireTarget(null)}
      />
    </>
  )
}

export function TrackScenariosPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <ScenariosBody workspace={w} />}
    />
  )
}
