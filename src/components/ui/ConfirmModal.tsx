import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  /** 강조 안내(선택) — 경고 박스로 표시 */
  warning?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  warning,
  confirmLabel,
  cancelLabel = '취소',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={busy}
            className={
              danger
                ? 'border-danger-600 bg-danger-600 hover:border-danger-700 hover:bg-danger-700'
                : undefined
            }
          >
            {busy ? '처리 중…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="break-keep">{message}</p>
      {warning && (
        <p className="mt-3 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2.5 text-[13px] break-keep text-warning-700">
          {warning}
        </p>
      )}
    </Modal>
  )
}
