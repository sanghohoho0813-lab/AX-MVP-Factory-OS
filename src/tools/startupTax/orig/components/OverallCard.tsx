import { Link } from 'react-router-dom'
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
      {/* D-318 감면율 — 창업 연도(2026 개정) · 권역 · 청년으로 고른 값 */}
      {!result.notice && (
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <p className="inline-flex max-w-full break-keep rounded-2xl bg-white/80 px-3 py-1.5 text-base font-bold text-gray-800" data-testid="startup-tax-rate">
            {result.taxRate.line}
          </p>
          {/* D-326 감면 기간 · 이 감면율의 기준(계산 기준표 창업감면 칸) */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 break-keep text-sm text-gray-600">
            {result.taxRate.lastYear !== null && (
              <span data-testid="startup-tax-period">
                {result.taxRate.lastYear >= result.taxRate.baseYear
                  ? `감면 기간 ~${result.taxRate.lastYear}년 과세연도 · 올해 포함 ${result.taxRate.lastYear - result.taxRate.baseYear + 1}년 남음`
                  : `감면 기간 ~${result.taxRate.lastYear}년 과세연도 — 지났을 가능성`}
              </span>
            )}
            <Link to="/tools/tax?m=basis&s=startup" className="tap inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-2" data-testid="startup-tax-basis">
              감면율 기준표
            </Link>
          </p>
        </div>
      )}

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
