/**
 * 회사명 옆 계약 상태 (D-140) — [계약 중 ▼] 를 눌러 바로 바꾼다.
 * 저장 값은 예전 그대로(waiting · active · completed) — 화면 이름만 '계약 전 · 계약 중 · 계약 완료'.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { CONTRACT_STAGE_LABEL, CONTRACT_STAGE_ORDER, contractStageOf, type ClientOpsStatus, type ContractStage } from '../../types/clientOps'

const CLS: Record<ContractStage, string> = {
  pre: 'border-slate-300 bg-slate-100 text-slate-700',
  signed: 'border-brand-300 bg-brand-50 text-brand-800',
  closed: 'border-success-300 bg-success-50 text-success-800',
}

export function ContractStageMenu({ status, onChange }: { status: ClientOpsStatus; onChange: (stage: ContractStage) => void }) {
  const stage = contractStageOf(status)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`계약 상태 ${CONTRACT_STAGE_LABEL[stage]} — 바꾸기`}
        data-testid="stage-badge"
        onClick={() => setOpen((v) => !v)}
        className={`tap t-sub inline-flex min-h-9 items-center gap-1 rounded-full border px-3 py-1 font-bold ${CLS[stage]}`}
      >
        {CONTRACT_STAGE_LABEL[stage]}
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      {open && (
        <div role="menu" aria-label="계약 상태" className="absolute top-full left-0 z-30 mt-1 w-44 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white shadow-(--shadow-overlay)" data-testid="stage-menu">
          {CONTRACT_STAGE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === stage}
              onClick={() => {
                setOpen(false)
                if (s !== stage) onChange(s)
              }}
              className={`tap t-body flex w-full items-center justify-between px-4 py-2.5 text-left font-semibold hover:bg-slate-50 ${s === stage ? 'text-brand-800' : 'text-slate-800'}`}
            >
              {CONTRACT_STAGE_LABEL[s]}
              {s === stage && <Check aria-hidden="true" className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
