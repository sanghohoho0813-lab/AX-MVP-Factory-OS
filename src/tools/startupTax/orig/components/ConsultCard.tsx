// 상담 시 확인해야 할 핵심 질문 (아코디언 내부에 들어가는 본문)
export default function ConsultCard({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null

  return (
    <div>
      <p className="mb-3 text-base leading-relaxed text-gray-500">
        대표님께 아래 항목을 직접 확인하면 판정이 더 정확해집니다.
      </p>
      <ul className="space-y-2.5">
        {questions.map((q, i) => (
          <li
            key={q}
            className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4 text-lg leading-relaxed text-gray-800"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
              {i + 1}
            </span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
