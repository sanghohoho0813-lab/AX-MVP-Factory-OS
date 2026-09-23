import type { SavingsPoint, SavingsTone } from '../../types'

const TONE: Record<SavingsTone, { emoji: string; box: string }> = {
  good: { emoji: '🟢', box: 'bg-white text-gray-800' },
  caution: { emoji: '🟡', box: 'bg-amber-50 text-amber-800' },
  bad: { emoji: '🔴', box: 'bg-red-50 text-red-700' },
}

interface Props {
  points: SavingsPoint[]
  advice: string
}

// 예상 절세 포인트 — 결과 화면 상단
// "검토받으면 돈을 아낄 수 있겠다"를 느끼게 한다 (정확 세액 계산 아님)
export default function SavingsCard({ points, advice }: Props) {
  if (points.length === 0) return null

  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">💰</span>
        <h3 className="text-xl font-bold text-gray-900">예상 절세 포인트</h3>
      </div>

      <ul className="mt-3.5 space-y-2">
        {points.map((p, i) => {
          const t = TONE[p.tone]
          return (
            <li
              key={i}
              className={`flex items-start gap-3 rounded-2xl p-3.5 text-lg font-semibold leading-relaxed ${t.box}`}
            >
              <span className="text-xl">{t.emoji}</span>
              <span>{p.text}</span>
            </li>
          )
        })}
      </ul>

      {/* 상담 시 확인 포인트 */}
      <div className="mt-3.5 rounded-2xl bg-emerald-600/10 p-3.5 text-base font-medium leading-relaxed text-emerald-800">
        💡 {advice}
      </div>
    </div>
  )
}
