/**
 * 영업 관리 화면 공용 조각 (D-114) — 복사 단추 · 글 상자 · 번호 목록.
 * 원본(기업컨설팅 OS)의 TextBlock · 복사 단추를 운영 OS 모양(흰 카드 · 회색 글 · 테마색 단추)으로 다시 만들었다.
 */
import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { SALES_STAGE_LABEL, type SalesStage } from '../../types/clientOps'
import { stageColor } from './salesColor'

export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand?.('copy')
      ta.remove()
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 1800)
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="tap t-meta inline-flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700"
    >
      {done ? <Check aria-hidden="true" className="size-3.5 text-success-600" /> : <Copy aria-hidden="true" className="size-3.5" />}
      {done ? '복사됨' : label}
    </button>
  )
}

/** 제목 + 글(+ 복사) — 대본 · 카톡 문구 한 덩어리 */
export function ScriptBlock({ title, text, copy = false, children }: { title: string; text?: string; copy?: boolean; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="t-sub font-bold text-slate-800">{title}</h3>
        {copy && text ? <CopyButton text={text} /> : null}
      </div>
      {text !== undefined && <p className="t-body break-keep whitespace-pre-line text-slate-700">{text}</p>}
      {children}
    </section>
  )
}

/** 번호 매긴 줄 목록 (질문 12 · 이슈 TOP3 …) */
export function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((q, i) => (
        <li key={`${i}-${q.slice(0, 12)}`} className="t-body flex gap-2 break-keep text-slate-700">
          <span className="t-meta mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500 tabular-nums">{i + 1}</span>
          <span className="min-w-0">{q}</span>
        </li>
      ))}
    </ol>
  )
}

/** 작은 알약 목록 (자료 · 관심사) */
export function PillList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="t-sub text-slate-400">없음</p>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((d) => (
        <li key={d} className="t-meta rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
          {d}
        </li>
      ))}
    </ul>
  )
}

/** 영업 단계 배지 — 점 + 이름, 옅은 단계색 바탕 (D-118) */
export function StageBadge({ stage }: { stage: SalesStage }) {
  const c = stageColor(stage)
  return (
    <span data-stage-badge={stage} className={`t-meta inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold ${c.soft} ${c.text} ${c.border}`} style={c.style}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${c.dot}`} style={c.style} />
      {SALES_STAGE_LABEL[stage]}
    </span>
  )
}
