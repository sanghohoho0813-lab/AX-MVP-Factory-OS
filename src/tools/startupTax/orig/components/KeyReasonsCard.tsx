// 이번 판정의 핵심 이유 (3줄) — 결과 이유를 3초 안에 이해
export default function KeyReasonsCard({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">🧭</span>
        <h3 className="text-xl font-bold text-gray-900">이번 판정의 핵심 이유</h3>
      </div>

      <ul className="mt-3.5 space-y-2">
        {reasons.map((r) => (
          <li
            key={r}
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-lg font-bold text-gray-800"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
              ✓
            </span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
