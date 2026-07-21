import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClipboardList, FileText, Lock, Plus } from 'lucide-react'
import type {
  CriterionCategory,
  EvidenceSourceType,
  FundingEvidence,
  FundingGap,
  FundingStrategy,
  GapSeverity,
  GapStatus,
} from '../../types/funding'
import { addEvidence, addGap, removeEvidence, removeGap, updateEvidence, updateGap } from '../../services/fundingService'
import { GAP_SEVERITIES, GAP_SEVERITY_META, GAP_STATUSES, GAP_STATUS_META } from '../../lib/fundingMeta'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { GapSeverityBadge, GapStatusBadge } from '../../components/funding/badges'
import { ReadOnlyNotice, FundingStrategyFrame } from './fundingShared'

const SOURCE_TYPE_LABEL: Record<EvidenceSourceType, string> = {
  organization: '기업 정보',
  project: '프로젝트',
  assessment: '진단',
  selection: '과제선정',
  mvp_design: 'AX 설계',
  website_design: '홈페이지 설계',
  validation: '검증',
  deliverable: '제출자료',
  manual: '직접 입력',
  external_document: '외부 문서',
}

const CATEGORY_LABEL: Record<CriterionCategory, string> = {
  basic: '기본',
  financial: '재무',
  credit: '신용',
  technology: '기술',
  innovation: '혁신',
  employment: '고용',
  certification: '인증',
  market: '시장',
  region: '지역',
  documentation: '서류',
  compliance: '규정',
  other: '기타',
}
const CATEGORIES = Object.keys(CATEGORY_LABEL) as CriterionCategory[]

/* ------------------------------------------------------------------ */
/* 근거                                                                 */
/* ------------------------------------------------------------------ */

interface EvidenceForm {
  label: string
  value: string
  unit: string
  description: string
  sensitive: boolean
}
const EMPTY_EVIDENCE: EvidenceForm = { label: '', value: '', unit: '', description: '', sensitive: false }

function EvidenceSection({ strategy, readOnly }: { strategy: FundingStrategy; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<EvidenceForm>(EMPTY_EVIDENCE)
  const [removeTarget, setRemoveTarget] = useState<FundingEvidence | null>(null)

  function submitAdd() {
    if (!form.label.trim()) {
      showToast('근거명을 입력하세요.')
      return
    }
    try {
      addEvidence(strategy.id, {
        label: form.label.trim(),
        value: form.value.trim(),
        unit: form.unit.trim(),
        description: form.description.trim(),
        sensitive: form.sensitive,
      })
      showToast('근거를 추가했습니다.')
      setForm(EMPTY_EVIDENCE)
      setAddOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '근거를 추가할 수 없습니다.')
    }
  }

  function toggleVerified(e: FundingEvidence) {
    try {
      updateEvidence(strategy.id, e.id, { verified: !e.verified })
      showToast(e.verified ? '미검증으로 변경했습니다.' : '검증으로 표시했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '변경할 수 없습니다.')
    }
  }

  function confirmRemove() {
    if (!removeTarget) return
    try {
      removeEvidence(strategy.id, removeTarget.id)
      showToast('근거를 제외했습니다.')
      setRemoveTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '제외할 수 없습니다.')
    }
  }

  return (
    <>
      <Panel
        title={`근거 (${strategy.evidence.length})`}
        actions={
          !readOnly ? (
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              직접 추가
            </Button>
          ) : undefined
        }
        flush
      >
        {strategy.evidence.length === 0 ? (
          <EmptyState icon={FileText} title="등록된 근거가 없습니다" description="확정된 결과에서 자동 수집되거나 직접 추가할 수 있습니다." />
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th scope="col" className="px-5 py-2.5 font-medium">근거명</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">값</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">출처</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">검증</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">민감</th>
                  {!readOnly && <th scope="col" className="px-5 py-2.5 text-right font-medium">관리</th>}
                </tr>
              </thead>
              <tbody>
                {strategy.evidence.map((e) => (
                  <tr key={e.id} className={`border-b border-slate-100 align-top ${e.sensitive ? 'bg-danger-50/30' : ''}`}>
                    <td className="px-5 py-2.5">
                      <p className="font-medium break-keep text-slate-700">{e.label}</p>
                      {e.description && <p className="mt-0.5 text-xs break-keep text-slate-400">{e.description}</p>}
                    </td>
                    <td className="px-3 py-2.5 break-keep text-slate-600">
                      {e.value ? `${e.value}${e.unit ? ` ${e.unit}` : ''}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{SOURCE_TYPE_LABEL[e.sourceType]}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${e.verified ? 'border-success-200 bg-success-50 text-success-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {e.verified ? '검증' : '미검증'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {e.sensitive && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-danger-200 bg-danger-50 px-2 py-0.5 text-[11px] font-medium text-danger-700">
                          <Lock aria-hidden="true" className="size-3" />
                          민감정보
                        </span>
                      )}
                    </td>
                    {!readOnly && (
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => toggleVerified(e)}>
                            {e.verified ? '미검증' : '검증 표시'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(e)}>제외</Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={addOpen}
        title="근거 직접 추가"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submitAdd}>추가</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">근거명</span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">값</span>
              <input
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">단위</span>
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">설명</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <input
              type="checkbox"
              checked={form.sensitive}
              onChange={(e) => setForm((f) => ({ ...f, sensitive: e.target.checked }))}
              className="size-4 rounded border-slate-300"
            />
            민감정보(연락처·재무·수임료 등)로 표시
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={removeTarget !== null}
        title="근거 제외"
        message={`'${removeTarget?.label ?? ''}' 근거를 제외하시겠습니까?`}
        confirmLabel="제외"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 부족조건                                                             */
/* ------------------------------------------------------------------ */

interface GapForm {
  category: CriterionCategory
  severity: GapSeverity
  title: string
  description: string
  requiredAction: string
  evidenceNeeded: string
}
const EMPTY_GAP: GapForm = { category: 'basic', severity: 'medium', title: '', description: '', requiredAction: '', evidenceNeeded: '' }

interface GapEditForm {
  status: GapStatus
  ownerId: string
  dueDate: string
}

function GapSection({ strategy, readOnly }: { strategy: FundingStrategy; readOnly: boolean }) {
  const { showToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<GapForm>(EMPTY_GAP)
  const [editTarget, setEditTarget] = useState<FundingGap | null>(null)
  const [editForm, setEditForm] = useState<GapEditForm>({ status: 'open', ownerId: '', dueDate: '' })
  const [removeTarget, setRemoveTarget] = useState<FundingGap | null>(null)

  function submitAdd() {
    if (!form.title.trim()) {
      showToast('부족 내용을 입력하세요.')
      return
    }
    try {
      addGap(strategy.id, {
        category: form.category,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        requiredAction: form.requiredAction.trim(),
        evidenceNeeded: form.evidenceNeeded.trim(),
      })
      showToast('부족조건을 추가했습니다.')
      setForm(EMPTY_GAP)
      setAddOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '추가할 수 없습니다.')
    }
  }

  function openEdit(gap: FundingGap) {
    setEditTarget(gap)
    setEditForm({ status: gap.status, ownerId: gap.ownerId, dueDate: gap.dueDate })
  }
  function submitEdit() {
    if (!editTarget) return
    try {
      updateGap(strategy.id, editTarget.id, {
        status: editForm.status,
        ownerId: editForm.ownerId.trim(),
        dueDate: editForm.dueDate,
      })
      showToast('부족조건을 수정했습니다.')
      setEditTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '수정할 수 없습니다.')
    }
  }

  function confirmRemove() {
    if (!removeTarget) return
    try {
      removeGap(strategy.id, removeTarget.id)
      showToast('부족조건을 삭제했습니다.')
      setRemoveTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제할 수 없습니다.')
    }
  }

  return (
    <>
      <HelpNote summary="데이터가 없다는 이유만으로 요건 미충족으로 단정하지 않습니다. '확인 필요(데이터 없음)'와 '요건 미충족'은 다릅니다." />

      <Panel
        title={`부족조건 (${strategy.gaps.length})`}
        actions={
          !readOnly ? (
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              부족조건 추가
            </Button>
          ) : undefined
        }
        flush
      >
        {strategy.gaps.length === 0 ? (
          <EmptyState icon={ClipboardList} title="등록된 부족조건이 없습니다" description="후보 검토 중 확인이 필요하거나 미충족인 항목을 추가하세요." />
        ) : (
          <ul className="flex flex-col gap-3 p-5">
            {strategy.gaps.map((gap) => (
              <li key={gap.id} className="rounded-(--radius-panel) border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {CATEGORY_LABEL[gap.category]}
                      </span>
                      <GapSeverityBadge severity={gap.severity} />
                      <GapStatusBadge status={gap.status} />
                    </div>
                    <p className="mt-1.5 text-sm font-semibold break-keep text-slate-900">{gap.title}</p>
                    {gap.description && <p className="mt-0.5 text-[13px] break-keep text-slate-600">{gap.description}</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(gap)}>수정</Button>
                      <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(gap)}>삭제</Button>
                    </div>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
                  {gap.requiredAction && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs font-semibold text-slate-400">필요한 행동</dt>
                      <dd className="break-keep text-slate-600">{gap.requiredAction}</dd>
                    </div>
                  )}
                  {gap.evidenceNeeded && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs font-semibold text-slate-400">필요한 증빙</dt>
                      <dd className="break-keep text-slate-600">{gap.evidenceNeeded}</dd>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-semibold text-slate-400">담당자</dt>
                    <dd className="text-slate-600">{gap.ownerId || '미지정'}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-semibold text-slate-400">기한</dt>
                    <dd className="text-slate-600">{gap.dueDate || '미지정'}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={addOpen}
        title="부족조건 추가"
        onClose={() => setAddOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submitAdd}>추가</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">구분</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CriterionCategory }))}
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">심각도</span>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as GapSeverity }))}
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
              >
                {GAP_SEVERITIES.map((s) => (
                  <option key={s} value={s}>{GAP_SEVERITY_META[s].label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">부족 내용</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">설명</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="확인 필요(데이터 없음)인지, 요건 미충족인지 구분해 적어주세요."
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">필요한 행동</span>
            <input
              value={form.requiredAction}
              onChange={(e) => setForm((f) => ({ ...f, requiredAction: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">필요한 증빙</span>
            <input
              value={form.evidenceNeeded}
              onChange={(e) => setForm((f) => ({ ...f, evidenceNeeded: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={editTarget !== null}
        title="부족조건 수정"
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>취소</Button>
            <Button variant="primary" onClick={submitEdit}>저장</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">상태</span>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as GapStatus }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            >
              {GAP_STATUSES.map((s) => (
                <option key={s} value={s}>{GAP_STATUS_META[s].label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">담당자</span>
            <input
              value={editForm.ownerId}
              onChange={(e) => setEditForm((f) => ({ ...f, ownerId: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">기한</span>
            <input
              type="date"
              value={editForm.dueDate}
              onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={removeTarget !== null}
        title="부족조건 삭제"
        message={`'${removeTarget?.title ?? ''}' 부족조건을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */

function GapsBody({ strategy }: { strategy: FundingStrategy }) {
  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
  const [tab, setTab] = useState<'evidence' | 'gaps'>('evidence')

  return (
    <>
      <ReadOnlyNotice strategy={strategy} />

      <div role="tablist" aria-label="근거·부족조건 구분" className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'evidence'}
          onClick={() => setTab('evidence')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${tab === 'evidence' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          근거 ({strategy.evidence.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'gaps'}
          onClick={() => setTab('gaps')}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${tab === 'gaps' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          부족조건 ({strategy.gaps.length})
        </button>
      </div>

      {tab === 'evidence' ? (
        <EvidenceSection strategy={strategy} readOnly={readOnly} />
      ) : (
        <GapSection strategy={strategy} readOnly={readOnly} />
      )}
    </>
  )
}

export function FundingGapsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  return <FundingStrategyFrame projectId={projectId} render={(strategy) => <GapsBody strategy={strategy} />} />
}
