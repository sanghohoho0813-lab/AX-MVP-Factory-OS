// 상담 전환 CTA — 추가 검토 시 결과가 달라질 수 있음을 강조
export default function ContractCta({
  checklist,
  checkCount,
}: {
  checklist: string[]
  checkCount: number
}) {
  return (
    <div className="rounded-3xl border-2 border-brand/40 bg-brand/5 p-5 shadow-card sm:p-6">
      {/* 강조 제목 */}
      <div className="rounded-2xl bg-brand px-5 py-4 text-center">
        <p className="text-xl font-extrabold leading-snug text-white">
          추가 검토 시 결과가
          <br className="sm:hidden" /> 달라질 수 있습니다
        </p>
      </div>

      {/* 본문 */}
      <p className="mt-4 text-base leading-relaxed text-gray-700">
        창업연혁, 업종코드, 과밀억제권역 여부, 최초 소득 발생연도 등에 따라 실제 감면율과 감면기간이
        달라질 수 있습니다.
      </p>

      {/* 체크리스트 */}
      <ul className="mt-4 space-y-2">
        {checklist.map((c) => (
          <li
            key={c}
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-lg font-medium text-gray-800"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand text-sm font-bold text-white">
              ✓
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>

      {/* N개 항목 확인 강조 */}
      <div className="mt-4 rounded-2xl bg-brand/10 px-4 py-3.5 text-center">
        <p className="text-lg font-extrabold text-brand-dark">
          대표님 케이스는 현재 {checkCount}개 항목 확인이 필요합니다.
        </p>
      </div>

      <p className="mt-4 text-center text-base font-bold text-brand-dark">
        전문가 상담 시 적용 가능 여부를 보다 정확하게 확인할 수 있습니다.
      </p>
    </div>
  )
}
