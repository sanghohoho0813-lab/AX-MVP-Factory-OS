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

      {/* D-136: 판정기가 단정하지 못한 것 — 숨기지 않고 판정 바로 아래에 */}
      {result.alerts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-white/80 p-4" data-testid="startup-tax-alerts">
          <div className="text-base font-extrabold text-amber-800">★ 세무사 확인 필요</div>
          <ul className="mt-2 space-y-1.5">
            {result.alerts.map((a) => (
              <li key={a} className="flex gap-2 break-keep text-base leading-relaxed text-gray-700">
                <span className="shrink-0 text-amber-600">•</span>
                <span className="min-w-0">
                  {a.split('★확인').map((part, i) => (
                    <span key={i}>
                      {i > 0 && <span className="whitespace-nowrap font-bold text-amber-800">★확인</span>}
                      {part}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.age !== null && (
        <p className="mt-4 text-sm text-gray-500">
          ※ 청년 여부는 창업 당시 나이(만 {result.age}세)로 봅니다. 병역기간에 따라 달라질 수 있습니다.
        </p>
      )}
    </div>
  )
}
