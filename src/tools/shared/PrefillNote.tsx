/**
 * "업체 기록에서 채웠습니다" 한 줄 (D-90).
 * 도구가 스스로 채운 값은 반드시 그렇게 밝힌다 — 대표가 적은 값과 구분되어야 한다.
 */

import { Wand2 } from 'lucide-react'

export function PrefillNote({ note }: { note: string }) {
  if (!note) return null
  return (
    <p
      data-testid="tool-prefill-note"
      className="t-sub flex items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 break-keep text-slate-600"
    >
      <Wand2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      {note}. 다르면 고치세요 — 고친 값이 판정에 쓰입니다.
    </p>
  )
}
