import type { SavingsLevel, SavingsLevelGrade } from '../../types'

// LEVEL별 색상 (A=가장 강조 → D=중립)
const LEVEL_STYLE: Record<SavingsLevelGrade, { ring: string; badge: string; text: string }> = {
  A: { ring: 'border-amber-300 bg-amber-50', badge: 'bg-amber-500', text: 'text-amber-700' },
  B: { ring: 'border-amber-200 bg-amber-50/70', badge: 'bg-amber-400', text: 'text-amber-700' },
  C: { ring: 'border-gray-200 bg-gray-50', badge: 'bg-gray-400', text: 'text-gray-600' },
  D: { ring: 'border-gray-200 bg-gray-50', badge: 'bg-gray-400', text: 'text-gray-500' },
}

// 예상 절세 규모 카드 — 실제 세액 계산 아님, 가능성 수준만
export default function SavingsLevelCard({ data }: { data: SavingsLevel }) {
  const s = LEVEL_STYLE[data.level]
  return (
    <div className={`rounded-3xl border-2 ${s.ring} p-6 shadow-card sm:p-7`}>
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">💰</span>
        <h3 className="text-xl font-bold text-gray-900">예상 절세 규모</h3>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${s.badge} text-white`}
        >
          <span className="text-[10px] font-bold opacity-80">LEVEL</span>
          <span className="text-3xl font-extrabold leading-none">{data.level}</span>
        </div>
        <p className={`text-2xl font-extrabold leading-tight ${s.text}`}>{data.label}</p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-400">
        ※ 실제 금액은 매출·이익·자산 규모에 따라 달라질 수 있습니다.
      </p>
    </div>
  )
}
