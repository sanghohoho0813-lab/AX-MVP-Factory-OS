import type { RegistrationReference as RegRef } from '../../types'

// 등록면허세 — 종합판정에서 제외된 별도 참고 영역
export default function RegistrationReference({ data }: { data: RegRef }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-card sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-900">{data.title}</h3>
        <span className="inline-flex shrink-0 items-center rounded-full bg-gray-500 px-3.5 py-1.5 text-base font-bold text-white">
          별도 확인 필요
        </span>
      </div>

      <p className="mt-3 text-base leading-relaxed text-gray-600">{data.note}</p>

      <div className="mt-3.5">
        <div className="mb-1.5 text-base font-bold text-gray-700">확인 사항</div>
        <ul className="space-y-1.5">
          {data.checkPoints.map((c, i) => (
            <li key={i} className="flex gap-2 text-base leading-relaxed text-gray-600">
              <span className="text-gray-300">▸</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-sm text-gray-400">
        ※ 등록면허세는 종합판정에 포함되지 않으며, 참고용으로만 표시됩니다.
      </p>
    </div>
  )
}
