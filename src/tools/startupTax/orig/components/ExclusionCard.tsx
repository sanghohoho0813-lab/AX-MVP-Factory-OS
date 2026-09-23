import type { ExclusionReason } from '../../types'

// 창업 제외사유 진단 카드
// "주의"만 표시하지 않고, 예상 제외사유를 구체적으로 설명한다.
export default function ExclusionCard({ reasons }: { reasons: ExclusionReason[] }) {
  if (reasons.length === 0) return null

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-card sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl">⚠️</span>
        <h3 className="text-xl font-bold text-amber-800">창업 제외사유 진단</h3>
      </div>
      <p className="mt-2 text-base leading-relaxed text-amber-700">
        아래 사유로 창업감면 적용이 제한될 수 있습니다. 단정이 아닌 검토 포인트로 확인해 주세요.
      </p>

      <div className="mt-4 space-y-3">
        {reasons.map((r) => (
          <div key={r.title} className="rounded-2xl bg-white/80 p-4">
            <div className="text-lg font-bold text-gray-900">{r.title}</div>
            <p className="mt-1.5 text-base leading-relaxed text-gray-700">{r.detail}</p>
            <div className="mt-2.5 rounded-xl bg-amber-100/70 p-3 text-sm leading-relaxed text-amber-800">
              <span className="font-bold">검토 포인트 · </span>
              {r.exception}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
