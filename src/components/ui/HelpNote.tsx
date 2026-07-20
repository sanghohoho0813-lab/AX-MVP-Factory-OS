import { useId, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

interface HelpNoteProps {
  /** 한두 줄 요약 (항상 표시) */
  summary: string
  /** 이 화면에서 하는 일 */
  what?: string
  /** 언제 사용하는지 */
  when?: string
  /** 완료하면 다음에 무엇을 하는지 */
  next?: string
}

/**
 * 주요 페이지 상단의 쉬운 설명 컴포넌트.
 * 한두 줄 요약을 항상 보여주고, '자세히'로 상세 안내를 펼친다.
 */
export function HelpNote({ summary, what, when, next }: HelpNoteProps) {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  const hasDetail = Boolean(what || when || next)

  return (
    <section
      aria-label="화면 안내"
      className="rounded-(--radius-card) border border-brand-100 bg-brand-50/60 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm break-keep text-slate-700">{summary}</p>
          {hasDetail && open && (
            <dl id={detailId} className="mt-2.5 flex flex-col gap-2 border-t border-brand-100 pt-2.5">
              {what && <HelpRow label="하는 일" value={what} />}
              {when && <HelpRow label="사용 시점" value={when} />}
              {next && <HelpRow label="완료 후" value={next} />}
            </dl>
          )}
        </div>
        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700"
          >
            {open ? '접기' : '자세히'}
            <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </section>
  )
}

function HelpRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <dt className="w-14 shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-keep text-slate-600">{value}</dd>
    </div>
  )
}
