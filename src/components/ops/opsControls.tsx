import { useEffect, useRef, useState } from 'react'
import { Check, ClipboardCopy, Phone, X } from 'lucide-react'
import { Button } from '../ui/Button'

/** 저장 상태 표시 — 자동 저장이 실제로 됐는지 눈으로 확인시켜 준다 */
export function SavedBadge({ savedAt }: { savedAt: number | null }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (savedAt === null) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(t)
  }, [savedAt])
  if (!visible) return null
  return (
    <span
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-success-200 bg-success-50 px-4 py-2 text-[0.95rem] font-semibold text-success-700 shadow-(--shadow-card)"
    >
      <Check aria-hidden="true" className="mr-1 inline size-4" />
      저장했습니다
    </span>
  )
}

/** 오늘 기준 n일 뒤 날짜 문자열 */
export function shiftDays(today: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  d.setUTCDate(d.getUTCDate() + days)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const QUICK = [
  { label: '오늘', days: 0 },
  { label: '내일', days: 1 },
  { label: '1주', days: 7 },
  { label: '2주', days: 14 },
  { label: '1개월', days: 30 },
]

/** 날짜 입력 + 빠른 선택 버튼 */
export function DueDateField({
  label,
  value,
  today,
  onChange,
  hint,
}: {
  label: string
  value: string
  today: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div>
      <label className="block text-[0.9rem] font-medium text-slate-600">
        {label}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none"
        />
      </label>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => onChange(shiftDays(today, q.days))}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.82rem] font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            {q.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.82rem] font-medium text-slate-400 hover:text-danger-600"
          >
            지우기
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-[0.85rem] font-semibold">{hint}</p>}
    </div>
  )
}

/** 문구 미리보기 + 복사 모달 */
export function MessageModal({
  title,
  description,
  text,
  onClose,
}: {
  title: string
  description: string
  text: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      ref.current?.select()
      document.execCommand?.('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 cursor-default bg-navy-950/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay)"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[1.25rem] font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-[0.92rem] break-keep text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <textarea
            ref={ref}
            readOnly
            value={text}
            rows={14}
            className="w-full resize-none rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-[0.92rem] leading-relaxed text-slate-800"
          />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5">
          <span className="text-[0.88rem] text-slate-500">복사해서 카카오톡·문자·메일에 붙여넣으세요.</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button variant="primary" onClick={() => void copy()}>
              <ClipboardCopy aria-hidden="true" className="size-4" />
              {copied ? '복사했습니다' : '복사하기'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 전화번호 — 누르면 걸기, 길게 보이지 않게 */
export function PhoneLink({ phone }: { phone: string }) {
  if (!phone.trim()) return <span className="text-slate-400">—</span>
  return (
    <a
      href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
    >
      <Phone aria-hidden="true" className="size-3.5" />
      {phone}
    </a>
  )
}
