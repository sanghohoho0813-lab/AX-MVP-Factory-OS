import type { ExpertReview, ReviewGrade } from '../../types'

// 등급별 색상 토큰 (A=강추 → D=셀프)
const GRADE_STYLE: Record<ReviewGrade, { ring: string; badge: string; text: string }> = {
  A: { ring: 'border-red-200 bg-red-50', badge: 'bg-red-600', text: 'text-red-700' },
  B: { ring: 'border-orange-200 bg-orange-50', badge: 'bg-orange-500', text: 'text-orange-700' },
  C: { ring: 'border-amber-200 bg-amber-50', badge: 'bg-amber-500', text: 'text-amber-700' },
  D: { ring: 'border-green-200 bg-green-50', badge: 'bg-green-600', text: 'text-green-700' },
}

// 전문가 검토 추천도 카드 — 검토 필요 요소가 많을수록 A
export default function ExpertReviewCard({ review }: { review: ExpertReview }) {
  const s = GRADE_STYLE[review.grade]
  return (
    <div className={`rounded-3xl border ${s.ring} p-5 shadow-card sm:p-6`}>
      <div className="flex items-center gap-4">
        {/* 등급 배지 */}
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl ${s.badge} text-white`}
        >
          <span className="text-3xl font-extrabold leading-none">{review.grade}</span>
          <span className="mt-0.5 text-[10px] font-bold opacity-80">등급</span>
        </div>

        <div>
          <div className="text-base font-medium text-gray-500">전문가 검토 추천도</div>
          <div className={`text-xl font-extrabold ${s.text}`}>{review.label}</div>
        </div>
      </div>

      <p className="mt-3 text-base leading-relaxed text-gray-700">{review.description}</p>

      {/* 감지된 검토 필요 요소 */}
      {review.factors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.factors.map((f) => (
            <span
              key={f}
              className="rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-gray-600"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
