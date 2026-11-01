/**
 * 업체가 하나도 없을 때 — 등록하면 무엇이 되는지 1 → 2 → 3 (📐 화면 원칙: 누르면 어떻게 되는지 예측되게).
 * 휴대폰은 테두리 없이 세 줄(첫 화면이 길어지지 않게), PC 는 세 칸.
 * 새 업체 등록 창은 사업자등록증 · 등기부를 올리면 칸을 채우고, 등록하면 그 서류가 서류함으로 간다.
 */
const STEPS: { title: string; note: string }[] = [
  { title: '첫 업체 등록', note: '사업자등록증을 올리면 이름 · 번호 · 대표가 채워져요' },
  { title: '서류 올리기', note: '대충 올려도 프로그램이 칸 · 회사 정보를 채워요' },
  { title: '맞춤 추천', note: '맞는 모듈 · 예상 금액 · 할 일이 바로 떠요' },
]

export function FirstClientSteps() {
  return (
    <ol className="mx-auto grid w-full max-w-2xl gap-2.5 text-left sm:grid-cols-3 sm:gap-2" data-testid="first-client-steps" aria-label="시작 순서">
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex min-w-0 items-start gap-2 sm:rounded-(--radius-control) sm:border sm:border-slate-200 sm:bg-white sm:px-3 sm:py-2.5">
          <span className="t-meta mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-200 font-bold text-brand-700 tabular-nums">{i + 1}</span>
          <span className="flex min-w-0 flex-col">
            <span className="t-sub font-semibold text-slate-900">{s.title}</span>
            <span className="t-meta break-keep [overflow-wrap:anywhere] text-slate-500">{s.note}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
