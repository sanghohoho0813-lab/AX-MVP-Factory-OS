import type { JudgementResult } from '../../types'
import { VERDICT_LABEL } from '../../lib/judgement'
import { VERDICT_STYLE } from '../../lib/verdictStyle'

// 종합 판정 카드 (상단) — 결론을 가장 크게 표시
export default function OverallCard({ result }: { result: JudgementResult }) {
  const s = VERDICT_STYLE[result.overall]
  return (
    <div className={`rounded-3xl border-2 ${s.border} ${s.bg} p-6 shadow-card sm:p-7`}>
      {/* 종합판정 배지 */}
      <div className="flex items-center gap-2.5">
        <span className="text-3xl">{s.emoji}</span>
        <div>
          <div className="text-sm font-medium text-gray-500">종합 판정</div>
          <span className={`text-2xl font-extrabold ${s.text}`}>{VERDICT_LABEL[result.overall]}</span>
        </div>
      </div>

      {/* 한줄 결론 — 가장 크게 */}
      <p className={`mt-4 text-[1.75rem] font-extrabold leading-tight ${s.text}`} data-testid="startup-tax-oneline">
        {result.oneLineConclusion}
      </p>

      {result.isYouth !== null && (
        <p className="mt-4 text-sm text-gray-500">
          ※ 병역기간에 따라 청년 여부가 달라질 수 있습니다.
        </p>
      )}
    </div>
  )
}
