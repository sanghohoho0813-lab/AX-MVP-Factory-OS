/**
 * 머리줄 [폭] 단추 (D-201) — 누를 때마다 본문 폭이 좁게 → 보통 → 넓게. 글자 크기는 그대로.
 * 보기 무대(iframe) 안에서는 숨긴다(바깥 머리줄에 하나만).
 */
import { MoveHorizontal } from 'lucide-react'
import { CONTENT_WIDTH_LABEL, nextContentWidth, setContentWidth, useContentWidth } from '../../lib/contentWidth'
import { inFrame } from '../../lib/deviceView'

export function ContentWidthButton() {
  const w = useContentWidth()
  if (inFrame()) return null
  const next = nextContentWidth(w)
  return (
    <button
      type="button"
      onClick={() => setContentWidth(next)}
      aria-label={`본문 폭: ${CONTENT_WIDTH_LABEL[w]} — 누르면 ${CONTENT_WIDTH_LABEL[next]}`}
      title={`본문 폭: ${CONTENT_WIDTH_LABEL[w]} — 누르면 ${CONTENT_WIDTH_LABEL[next]}`}
      data-testid="content-width"
      data-width={w}
      className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-(--radius-control) border px-2 min-[1900px]:px-2.5 text-[0.85rem] font-semibold whitespace-nowrap ${w === 'normal' ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-brand-300 bg-brand-50 text-brand-700'}`}
    >
      <MoveHorizontal aria-hidden="true" className="size-4" />
      {/* 1900px 아래에서는 아이콘만 — 머리줄이 옆으로 넘치지 않게(단추 이름 · 지금 폭은 aria-label · title) */}
      <span aria-hidden="true" className="hdr-opt-label hidden min-[1900px]:inline">폭 {CONTENT_WIDTH_LABEL[w]}</span>
    </button>
  )
}
