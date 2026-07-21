import { useState } from 'react'
import { Check, Pencil, RotateCcw, Sparkles } from 'lucide-react'
import type { DeliverableSection } from '../../types/deliverables'
import {
  applyRegeneratedOriginal,
  editSectionBody,
  regenerateSectionOriginal,
  restoreSectionOriginal,
  setSectionStatus,
} from '../../services/deliverableService'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { SectionStatusBadge, VisibilityBadge } from '../../components/deliverables/badges'
import { ContentBlocks } from '../../components/deliverables/ContentBlockView'
import { useToast } from '../../components/ui/toastContext'

const INPUT_CLASS =
  'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

/**
 * 보고서·개발명세 Section 공통 편집 카드.
 * 편집(본문·수정 사유) · 원본 복구 · 원본 재생성 · 검토 완료를 처리한다.
 * 자동 원본은 재생성 시 즉시 덮어쓰지 않고 사용자가 검토 후 적용한다.
 */
export function SectionEditorCard({
  packageId,
  section,
  readOnly,
}: {
  packageId: string
  section: DeliverableSection
  readOnly: boolean
}) {
  const { showToast } = useToast()

  const [editOpen, setEditOpen] = useState(false)
  const [draftBody, setDraftBody] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)

  const [regenBody, setRegenBody] = useState<string | null>(null)
  const [regenBusy, setRegenBusy] = useState(false)

  const [reviewBusy, setReviewBusy] = useState(false)

  function openEdit() {
    setDraftBody(section.body)
    setDraftNotes(section.editNotes)
    setEditOpen(true)
  }

  async function saveEdit() {
    setEditBusy(true)
    try {
      editSectionBody(packageId, section.id, draftBody, draftNotes)
      setEditOpen(false)
      showToast('본문을 수정했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setEditBusy(false)
    }
  }

  function confirmRestore() {
    setRestoreBusy(true)
    try {
      restoreSectionOriginal(packageId, section.id)
      setRestoreOpen(false)
      showToast('자동 생성 원본으로 복구했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '복구에 실패했습니다.')
    } finally {
      setRestoreBusy(false)
    }
  }

  function startRegenerate() {
    try {
      const result = regenerateSectionOriginal(packageId, section.id)
      if (!result) {
        showToast('원본을 재생성할 수 없습니다. 출처를 확인하세요.')
        return
      }
      setRegenBody(result.newOriginalBody)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '재생성에 실패했습니다.')
    }
  }

  function applyRegenerate() {
    setRegenBusy(true)
    try {
      applyRegeneratedOriginal(packageId, section.id)
      setRegenBody(null)
      showToast('새 원본을 적용했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '적용에 실패했습니다.')
    } finally {
      setRegenBusy(false)
    }
  }

  function markReviewed() {
    setReviewBusy(true)
    try {
      setSectionStatus(packageId, section.id, 'approved')
      showToast('검토 완료로 표시했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setReviewBusy(false)
    }
  }

  return (
    <Panel
      title={section.title}
      actions={
        <div className="flex items-center gap-1.5">
          {section.manuallyEdited && (
            <span className="rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-[0.82rem] font-medium text-warning-700">
              수동 수정됨
            </span>
          )}
          <VisibilityBadge visibility={section.visibility} />
          <SectionStatusBadge status={section.status} />
        </div>
      }
    >
      {section.subtitle && (
        <p className="mb-3 text-[0.9rem] break-keep text-slate-500">{section.subtitle}</p>
      )}

      <ContentBlocks blocks={section.structuredContent} showInternal={true} />

      {section.manuallyEdited && section.editNotes && (
        <p className="mt-4 rounded-(--radius-control) border border-warning-200 bg-warning-50/60 px-3 py-2 text-[0.9rem] break-keep text-warning-700">
          <span className="font-semibold">수정 사유</span> · {section.editNotes}
        </p>
      )}

      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" size="sm" onClick={openEdit}>
            <Pencil aria-hidden="true" className="size-4" />
            편집
          </Button>
          {section.status !== 'approved' && (
            <Button variant="secondary" size="sm" onClick={markReviewed} disabled={reviewBusy}>
              <Check aria-hidden="true" className="size-4" />
              검토 완료
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={startRegenerate}>
            <Sparkles aria-hidden="true" className="size-4" />
            원본 재생성
          </Button>
          {section.manuallyEdited && (
            <Button variant="ghost" size="sm" onClick={() => setRestoreOpen(true)}>
              <RotateCcw aria-hidden="true" className="size-4" />
              원본 복구
            </Button>
          )}
        </div>
      )}

      {/* 편집 모달 */}
      <Modal
        open={editOpen}
        title={`${section.title} 편집`}
        onClose={() => setEditOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={editBusy}>
              취소
            </Button>
            <Button variant="primary" onClick={saveEdit} disabled={editBusy}>
              {editBusy ? '저장 중…' : '저장'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[0.9rem] font-medium text-slate-700">본문</label>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={14}
              className={`${INPUT_CLASS} font-mono leading-relaxed`}
            />
            <p className="mt-1 text-[0.9rem] break-keep text-slate-400">
              수동 수정 후에도 자동 생성 원본은 보존되며, 언제든 원본으로 복구할 수 있습니다.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.9rem] font-medium text-slate-700">수정 사유</label>
            <textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              rows={3}
              placeholder="무엇을 왜 수정했는지 기록하세요."
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </Modal>

      {/* 원본 재생성 비교 모달 */}
      <Modal
        open={regenBody !== null}
        title={`${section.title} · 새 원본 검토`}
        onClose={() => setRegenBody(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenBody(null)} disabled={regenBusy}>
              현재 유지
            </Button>
            <Button variant="primary" onClick={applyRegenerate} disabled={regenBusy}>
              {regenBusy ? '적용 중…' : '새 원본 적용'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-[0.9rem] break-keep text-slate-500">
            최신 출처로 다시 생성한 원본입니다. 적용하면 현재 본문(수동 수정 포함)이 새 원본으로 교체됩니다.
          </p>
          <div>
            <p className="mb-1.5 text-[0.9rem] font-semibold text-slate-700">현재 본문</p>
            <pre className="max-h-48 overflow-auto rounded-(--radius-card) border border-slate-200 bg-slate-50 p-3 text-[0.9rem] leading-relaxed break-words whitespace-pre-wrap text-slate-600">
              {section.body}
            </pre>
          </div>
          <div>
            <p className="mb-1.5 text-[0.9rem] font-semibold text-brand-700">새 원본</p>
            <pre className="max-h-48 overflow-auto rounded-(--radius-card) border border-brand-200 bg-brand-50/50 p-3 text-[0.9rem] leading-relaxed break-words whitespace-pre-wrap text-slate-700">
              {regenBody}
            </pre>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={restoreOpen}
        title="원본으로 복구"
        message="수동 수정 내용을 버리고 자동 생성 원본으로 되돌립니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="원본 복구"
        danger
        busy={restoreBusy}
        onConfirm={confirmRestore}
        onCancel={() => setRestoreOpen(false)}
      />
    </Panel>
  )
}
