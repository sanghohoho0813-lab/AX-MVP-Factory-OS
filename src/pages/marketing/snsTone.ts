/**
 * D-298 스레드 · 릴스 · 틱톡 화면의 색 — 뜻마다 색 하나(같은 뜻은 어느 화면에서나 같은 색) · 색 칩 · [형식 바꾸기] 빛남.
 * 화면 조각(snsParts)과 따로 둔다 — 조각 파일은 그림만 내보내야 고친 것이 바로 반영된다.
 */
/**
 * 대표 "색이 없어서 눈에 안 들어온다 · 어울리는 색을 다양하게" — 뜻마다 색 하나(같은 뜻은 어느 화면에서나 같은 색).
 * Tailwind 가 찾을 수 있게 글자 그대로 적는다.
 */
export type Tone = 'slate' | 'rose' | 'sky' | 'emerald' | 'violet' | 'amber' | 'indigo' | 'fuchsia' | 'orange' | 'teal'
export const TONES: Readonly<Record<Tone, { wash: string; soft: string; line: string; ink: string; icon: string; solid: string; ring: string; hover: string; bar: string }>> = {
  slate: { wash: 'bg-slate-50/70', soft: 'bg-slate-100', line: 'border-slate-200', ink: 'text-slate-800', icon: 'text-slate-600', solid: 'border-slate-800 bg-slate-800 text-white', ring: 'ring-slate-300', hover: 'hover:border-slate-400', bar: 'bg-slate-400' },
  rose: { wash: 'bg-rose-50/60', soft: 'bg-rose-50', line: 'border-rose-200', ink: 'text-rose-800', icon: 'text-rose-600', solid: 'border-rose-600 bg-rose-600 text-white', ring: 'ring-rose-300', hover: 'hover:border-rose-400', bar: 'bg-rose-400' },
  sky: { wash: 'bg-sky-50/60', soft: 'bg-sky-50', line: 'border-sky-200', ink: 'text-sky-800', icon: 'text-sky-600', solid: 'border-sky-600 bg-sky-600 text-white', ring: 'ring-sky-300', hover: 'hover:border-sky-400', bar: 'bg-sky-400' },
  emerald: { wash: 'bg-emerald-50/60', soft: 'bg-emerald-50', line: 'border-emerald-200', ink: 'text-emerald-800', icon: 'text-emerald-600', solid: 'border-emerald-600 bg-emerald-600 text-white', ring: 'ring-emerald-300', hover: 'hover:border-emerald-400', bar: 'bg-emerald-400' },
  violet: { wash: 'bg-violet-50/60', soft: 'bg-violet-50', line: 'border-violet-200', ink: 'text-violet-800', icon: 'text-violet-600', solid: 'border-violet-600 bg-violet-600 text-white', ring: 'ring-violet-300', hover: 'hover:border-violet-400', bar: 'bg-violet-400' },
  amber: { wash: 'bg-amber-50/70', soft: 'bg-amber-50', line: 'border-amber-200', ink: 'text-amber-900', icon: 'text-amber-600', solid: 'border-amber-500 bg-amber-500 text-white', ring: 'ring-amber-300', hover: 'hover:border-amber-400', bar: 'bg-amber-400' },
  indigo: { wash: 'bg-indigo-50/60', soft: 'bg-indigo-50', line: 'border-indigo-200', ink: 'text-indigo-800', icon: 'text-indigo-600', solid: 'border-indigo-600 bg-indigo-600 text-white', ring: 'ring-indigo-300', hover: 'hover:border-indigo-400', bar: 'bg-indigo-400' },
  fuchsia: { wash: 'bg-fuchsia-50/60', soft: 'bg-fuchsia-50', line: 'border-fuchsia-200', ink: 'text-fuchsia-800', icon: 'text-fuchsia-600', solid: 'border-fuchsia-600 bg-fuchsia-600 text-white', ring: 'ring-fuchsia-300', hover: 'hover:border-fuchsia-400', bar: 'bg-fuchsia-400' },
  orange: { wash: 'bg-orange-50/60', soft: 'bg-orange-50', line: 'border-orange-200', ink: 'text-orange-800', icon: 'text-orange-600', solid: 'border-orange-500 bg-orange-500 text-white', ring: 'ring-orange-300', hover: 'hover:border-orange-400', bar: 'bg-orange-400' },
  teal: { wash: 'bg-teal-50/60', soft: 'bg-teal-50', line: 'border-teal-200', ink: 'text-teal-800', icon: 'text-teal-600', solid: 'border-teal-600 bg-teal-600 text-white', ring: 'ring-teal-300', hover: 'hover:border-teal-400', bar: 'bg-teal-400' },
}

/** 색 칩(주제 · 태그) — 고르면 그 색으로 채움 */
export const toneChip = (tone: Tone, on: boolean) => {
  const t = TONES[tone]
  return `tap t-sub inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-left font-semibold break-keep ${on ? t.solid : `${t.line} ${t.soft} ${t.ink} ${t.hover}`}`
}

/** D-298 [형식 바꾸기] — 접힌 '형식 직접 고르기' 를 펼치고 그 자리로 내려간 뒤, 눈이 가게 잠깐 빛나게 */
export function scrollAndFlash(testId: string) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('mk-flash')
    // 같은 단추를 다시 눌러도 또 빛나게 — 한 번 그린 뒤 다시 붙인다
    void el.offsetWidth
    el.classList.add('mk-flash')
    window.setTimeout(() => el.classList.remove('mk-flash'), 2600)
  }, 50)
}

