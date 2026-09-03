import { Check } from 'lucide-react'
import { UI_THEMES } from '../../lib/uiTheme'
import { useAppearance } from './appearance'

/**
 * 화면 테마 선택 컨트롤.
 * 9종을 모두 실제로 전환할 수 있어야 하며(마스터 규격), 선택 즉시 전 화면에 반영되고
 * 다음 접속에도 유지된다. 각 항목은 6색 미리보기 점으로 색감을 알 수 있게 한다.
 */
export function ThemeControl() {
  const { theme, setTheme } = useAppearance()
  return (
    <div role="radiogroup" aria-label="화면 테마" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {UI_THEMES.map((t) => {
        const on = t.key === theme
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(t.key)}
            className={`flex items-center gap-3 rounded-(--radius-control) border px-3 py-2.5 text-left transition-colors ${
              on
                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {/* 6색 미리보기 — Shell / Primary / Secondary / Accent / Highlight / Soft */}
            <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-slate-900/10">
              {t.swatch.map((c, i) => (
                <span key={i} className="block size-5" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.95rem] font-semibold text-slate-800">{t.label}</span>
              <span className="block truncate text-[0.85rem] text-slate-500">{t.hint}</span>
            </span>
            {on && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-700" />}
          </button>
        )
      })}
    </div>
  )
}

/** 화면 움직임 줄이기 토글 */
export function MotionControl() {
  const { motion, setMotion } = useAppearance()
  const reduced = motion === 'reduced'
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-(--radius-control) border border-slate-200 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[0.95rem] font-semibold text-slate-800">화면 움직임 줄이기</span>
        <span className="block text-[0.88rem] break-keep text-slate-500">
          {reduced
            ? '열고 닫힐 때의 부드러운 효과를 끕니다.'
            : '메뉴·팝업이 부드럽게 나타납니다. 어지러우면 꺼 주세요.'}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label="화면 움직임 줄이기"
        checked={reduced}
        onChange={(e) => setMotion(e.target.checked ? 'reduced' : 'full')}
        className="size-5 shrink-0 accent-brand-600"
      />
    </label>
  )
}
