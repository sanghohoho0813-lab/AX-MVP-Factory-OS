// 많은 대표님들이 놓치는 부분 (아코디언 내부 본문, 결과별 자동 생성)
export default function MissedPointsCard({ points }: { points: string[] }) {
  if (points.length === 0) return null

  return (
    <ul className="space-y-2.5">
      {points.map((p, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4 text-base leading-relaxed text-gray-700"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-gray-300 text-xs text-gray-400">
            ☐
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  )
}
