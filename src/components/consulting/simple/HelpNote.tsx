/**
 * [이게 뭔가요?] — 궁금할 때만 열리는 용어 풀이 (§15·§17·§46).
 *
 * 화면마다 긴 설명을 붙이지 않는다. 피할 수 없는 낱말(출원인·명세서·TAM …)이 나오는
 * 자리에만 작은 링크를 두고, 누르면 그 자리에서 1~3문장이 펼쳐진다.
 */

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { glossary } from '../../../domain/consulting/glossary'

export function HelpNote({ keys }: { keys: string[] }) {
  const [open, setOpen] = useState(false)
  const entries = keys.map((k) => glossary(k)).filter((e) => e !== null)
  if (entries.length === 0) return null

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="tap t-sub inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800"
      >
        <HelpCircle aria-hidden="true" className="size-4" />
        {open ? '접기' : entries.length === 1 ? `${entries[0].term} — 이게 뭔가요?` : '이게 뭔가요?'}
      </button>
      {open && (
        <dl className="mt-2 flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3">
          {entries.map((e) => (
            <div key={e.term}>
              <dt className="t-sub font-semibold text-slate-800">{e.term}</dt>
              <dd className="t-sub mt-0.5 break-keep text-slate-600">
                {e.text}
                {e.example && <span className="mt-1 block text-slate-500">예) {e.example}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
