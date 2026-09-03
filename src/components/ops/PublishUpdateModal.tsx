import { useState } from 'react'
import { Eye } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { PortalClientLink, PortalUpdateCategory } from '../../types/bridge'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { DueDateField } from './opsControls'
import { UPDATE_CATEGORY_LABEL, publishUpdate, type PublishUpdateInput } from '../../services/customerBridgeService'
import {
  CUSTOMER_STAGE_LABEL,
  CUSTOMER_STAGE_ORDER,
  suggestCustomerStage,
  type CustomerStage,
} from '../../config/serviceCatalog'
import { SERVICES } from '../../content/clientOpsCatalog'
import { todayLocalDate } from '../../lib/appClock'
import { brand } from '../../brand/brand.config'

const CATEGORIES: PortalUpdateCategory[] = ['progress', 'document_request', 'result', 'notice', 'question']

/**
 * "고객에게 업데이트" — 내부 상태를 자동으로 내보내지 않고, 여기서 쓴 내용만 명시적으로 공개한다.
 * 공개 전 고객 화면에 어떻게 보일지 미리보기를 보여주고, 확인을 눌러야 published 가 된다.
 */
export function PublishUpdateModal({
  link,
  record,
  workspaceId,
  initialDraft,
  onClose,
  onPublished,
}: {
  link: PortalClientLink
  record: ClientOpsRecord
  workspaceId: string | null
  /** 자동 초안(선택) — 사용자가 고쳐서 공개한다 */
  initialDraft?: Partial<Pick<PublishUpdateInput, 'category' | 'title' | 'body' | 'customerActionRequired' | 'customerActionLabel'>>
  onClose: () => void
  onPublished: () => void
}) {
  const today = todayLocalDate()
  const suggested = suggestCustomerStage(SERVICES.map((s) => record.services[s.key].status))
  const [category, setCategory] = useState<PortalUpdateCategory>(initialDraft?.category ?? 'progress')
  const [title, setTitle] = useState(initialDraft?.title ?? '')
  const [body, setBody] = useState(initialDraft?.body ?? '')
  const [actionRequired, setActionRequired] = useState(initialDraft?.customerActionRequired ?? false)
  const [actionLabel, setActionLabel] = useState(initialDraft?.customerActionLabel ?? '')
  const [dueDate, setDueDate] = useState('')
  const [stage, setStage] = useState<CustomerStage | ''>(link.customerStage === suggested ? '' : suggested)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('고객에게 보일 제목을 적어 주세요.'); return }
    if (actionRequired && !actionLabel.trim()) { setError('고객이 해야 할 일을 한 줄로 적어 주세요.'); return }
    setBusy(true); setError('')
    try {
      await publishUpdate(workspaceId, {
        linkId: link.id,
        category,
        title,
        body,
        customerActionRequired: actionRequired,
        customerActionLabel: actionLabel,
        dueDate,
        customerStage: stage || undefined,
      })
      onPublished()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '공개하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const projectName = link.displayName.trim() || record.companyName

  return (
    <Modal
      open
      title="고객에게 업데이트"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>취소</Button>
          {!preview ? (
            <Button variant="secondary" onClick={() => setPreview(true)}>
              <Eye aria-hidden="true" className="size-4" /> 고객 화면 미리보기
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setPreview(false)}>다시 편집</Button>
          )}
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? '공개 중…' : '고객에게 공개'}
          </Button>
        </>
      }
    >
      <p className="text-[0.88rem] break-keep text-slate-500">
        여기 적은 내용만 {brand.customerPortalLabel}에 보입니다. 내부 메모·수임료·업무 세부 단계는 자동으로 나가지 않습니다.
      </p>

      {preview ? (
        <div className="mt-4 rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.8rem] font-semibold tracking-wide text-slate-400 uppercase">고객에게 이렇게 보입니다</p>
          <p className="mt-2 text-[0.85rem] text-slate-500">{projectName} · {stage ? CUSTOMER_STAGE_LABEL[stage] : CUSTOMER_STAGE_LABEL[link.customerStage]}</p>
          <div className="mt-2 rounded-(--radius-card) border border-slate-200 bg-white p-4">
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.8rem] font-semibold text-brand-700">{UPDATE_CATEGORY_LABEL[category]}</span>
            <h3 className="mt-2 text-[1.05rem] font-bold text-slate-900">{title || '(제목)'}</h3>
            <p className="mt-1 text-[0.95rem] break-keep whitespace-pre-wrap text-slate-700">{body || '(내용 없음)'}</p>
            {actionRequired && (
              <div className="mt-3 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 text-[0.92rem] text-warning-700">
                <strong>해주실 일:</strong> {actionLabel || '(해야 할 일)'}{dueDate ? ` · ${dueDate}까지` : ''}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div role="radiogroup" aria-label="종류" className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => { setCategory(c); if (c === 'document_request' || c === 'question') setActionRequired(true) }}
                className={`rounded-full border px-3 py-1 text-[0.88rem] font-semibold ${category === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {UPDATE_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <label className="block text-[0.9rem] font-medium text-slate-600">
            제목
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 벤처인증 서류 접수를 마쳤습니다"
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] text-slate-800 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="block text-[0.9rem] font-medium text-slate-600">
            고객에게 보일 내용
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="지금 어디까지 왔고, 다음에 무엇이 진행되는지 고객 눈높이로 적습니다."
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] leading-relaxed text-slate-800 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[0.92rem] text-slate-700">
            <input type="checkbox" checked={actionRequired} onChange={(e) => setActionRequired(e.target.checked)} className="size-4 accent-brand-600" />
            고객이 해야 할 일이 있습니다
          </label>
          {actionRequired && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[0.9rem] font-medium text-slate-600">
                해야 할 일 (한 줄)
                <input
                  value={actionLabel}
                  onChange={(e) => setActionLabel(e.target.value)}
                  placeholder="예: 사업자등록증 최신본 올리기"
                  className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] text-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </label>
              <DueDateField label="기한(선택)" value={dueDate} today={today} onChange={setDueDate} />
            </div>
          )}
          <label className="block text-[0.9rem] font-medium text-slate-600">
            고객에게 보이는 단계
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as CustomerStage | '')}
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] text-slate-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="">그대로 둠 ({CUSTOMER_STAGE_LABEL[link.customerStage]})</option>
              {CUSTOMER_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CUSTOMER_STAGE_LABEL[s]}{s === suggested ? ' · 내부 업무 상태로 볼 때 추천' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-[0.9rem] text-danger-600">{error}</p>}
    </Modal>
  )
}
