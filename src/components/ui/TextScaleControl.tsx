import { TEXT_SCALES, TEXT_SCALE_META } from '../../lib/uiTextScale'
import { StatusBadge } from './StatusBadge'
import { useTextScale } from './textScale'

/**
 * 글자 크기 선택 컨트롤 (라디오 그룹). 선택 즉시 전체 프로그램에 반영된다.
 * showPreview=true 이면 제목·본문·보조·버튼·배지 미리보기를 함께 보여준다.
 */
export function TextScaleControl({ showPreview = false, compact = false }: { showPreview?: boolean; compact?: boolean }) {
  const { scale, setScale } = useTextScale()

  if (compact) {
    return (
      <div role="radiogroup" aria-label="글자 크기" className="flex gap-1">
        {TEXT_SCALES.map((s) => {
          const on = s === scale
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`글자 크기 ${TEXT_SCALE_META[s].label}`}
              onClick={() => setScale(s)}
              className={`flex-1 rounded-(--radius-control) border px-2 py-1.5 text-[0.875rem] font-medium transition-colors ${
                on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {TEXT_SCALE_META[s].label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="글자 크기" className="flex flex-wrap gap-2">
        {TEXT_SCALES.map((s) => {
          const on = s === scale
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setScale(s)}
              className={`flex min-w-[112px] flex-col items-start gap-0.5 rounded-(--radius-control) border px-3.5 py-2.5 text-left transition-colors ${
                on ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-sm font-semibold text-slate-800">{TEXT_SCALE_META[s].label}</span>
              <span className="text-[0.875rem] text-slate-500">{TEXT_SCALE_META[s].hint}</span>
            </button>
          )
        })}
      </div>

      {showPreview && (
        <div className="rounded-(--radius-card) border border-slate-200 bg-white p-4">
          <p className="text-[0.875rem] font-semibold tracking-wide text-slate-400 uppercase">미리보기</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">진단부터 검증까지 한눈에</h3>
          <p className="mt-1.5 text-sm text-slate-700">
            기업의 현재 업무를 진단하고 다음에 만들 기능을 확인합니다.
          </p>
          <p className="mt-1 text-[0.875rem] text-slate-400">보조 설명 · 이 문장은 작은 글씨의 예시입니다.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center rounded-(--radius-control) bg-brand-600 px-4 text-sm font-medium text-white">
              핵심 행동 버튼
            </span>
            <StatusBadge tone="success" withDot>통과</StatusBadge>
            <StatusBadge tone="warning" withDot>조건부 통과</StatusBadge>
          </div>
        </div>
      )}
    </div>
  )
}
