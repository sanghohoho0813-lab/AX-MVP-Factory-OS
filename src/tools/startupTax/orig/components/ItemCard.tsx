import type { ItemResult } from '../../types'
import { VERDICT_LABEL } from '../../lib/judgement'
import { VERDICT_STYLE } from '../../lib/verdictStyle'

// 항목별 감면 판정 카드
export default function ItemCard({ item }: { item: ItemResult }) {
  const s = VERDICT_STYLE[item.verdict]
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-card sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-full ${s.chipBg} px-3.5 py-1.5 text-base font-bold text-white`}
        >
          {VERDICT_LABEL[item.verdict]}
        </span>
      </div>

      {/* 이유 */}
      <div className={`mt-4 rounded-2xl ${s.bg} p-4`}>
        <div className={`mb-1.5 text-base font-bold ${s.text}`}>판단 이유</div>
        <ul className="space-y-1.5">
          {item.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-base leading-relaxed text-gray-700">
              <span className="text-gray-400">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 추가 확인 필요사항 */}
      <div className="mt-3.5">
        <div className="mb-1.5 text-base font-bold text-gray-800">추가 확인 필요사항</div>
        <ul className="space-y-1.5">
          {item.checkPoints.map((c, i) => (
            <li key={i} className="flex gap-2 text-base leading-relaxed text-gray-600">
              <span className="text-gray-300">▸</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 상담 멘트 예시 */}
      <div className="mt-3.5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
        <div className="mb-1 text-sm font-bold text-gray-400">상담 멘트 예시</div>
        <p className="text-base leading-relaxed text-gray-700">“{item.consultScript}”</p>
      </div>
    </div>
  )
}
