/**
 * D-298 스레드 · 릴스 · 틱톡 화면의 색 — 뜻마다 색 하나(같은 뜻은 어느 화면에서나 같은 색) · 색 칩 · [형식 바꾸기] 빛남.
 * 화면 조각(snsParts)과 따로 둔다 — 조각 파일은 그림만 내보내야 고친 것이 바로 반영된다.
 */
/**
 * 대표 "색이 없어서 눈에 안 들어온다 · 어울리는 색을 다양하게" — 뜻마다 색 하나(같은 뜻은 어느 화면에서나 같은 색).
 * Tailwind 가 찾을 수 있게 글자 그대로 적는다.
 */
export type Tone = 'slate' | 'rose' | 'sky' | 'emerald' | 'violet' | 'amber' | 'indigo' | 'fuchsia' | 'orange' | 'teal'
/**
 * D-370 대표 "박스가 많은데 색이 제각각이라 눈에 안 들어온다 — 박스는 흰 바탕 · 얇은 테두리로 통일, 정말 중요한 것(AI 단추)만 보라,
 * 강조는 글자색 하나로" — 그래서 칸 · 칩 · 탭은 뜻과 상관없이 같은 차분한 모양(흰 바탕 · 회색 테두리 · 고르면 파랑 하나).
 * 뜻마다 다른 색은 작은 점(bar — '색 = 잘 되는 반응' 읽는 법)에만 남긴다. 이름(tone 키)은 그대로 — 화면 코드는 바꾸지 않아도 된다.
 */
const CALM = { wash: 'bg-white', soft: 'bg-white', line: 'border-slate-200', ink: 'text-slate-900', icon: 'text-slate-500', solid: 'border-brand-600 bg-brand-600 text-white', ring: 'ring-brand-200', hover: 'hover:border-brand-500' }
export const TONES: Readonly<Record<Tone, { wash: string; soft: string; line: string; ink: string; icon: string; solid: string; ring: string; hover: string; bar: string }>> = {
  slate: { ...CALM, bar: 'bg-slate-400' },
  rose: { ...CALM, bar: 'bg-rose-400' },
  sky: { ...CALM, bar: 'bg-sky-400' },
  emerald: { ...CALM, bar: 'bg-emerald-400' },
  violet: { ...CALM, bar: 'bg-violet-400' },
  amber: { ...CALM, bar: 'bg-amber-400' },
  indigo: { ...CALM, bar: 'bg-indigo-400' },
  fuchsia: { ...CALM, bar: 'bg-fuchsia-400' },
  orange: { ...CALM, bar: 'bg-orange-400' },
  teal: { ...CALM, bar: 'bg-teal-400' },
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

