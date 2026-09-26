/**
 * 링크를 단추 모양으로 (D-119) — components/ui/Button 의 primary · secondary(md) 와 같은 모양.
 * 페이지를 옮기는 단추는 <button> 이 아니라 <Link> 여야 새 탭 · 뒤로 가기가 된다.
 */
const BASE = 'inline-flex shrink-0 items-center justify-center gap-2 rounded-(--radius-control) border h-11 px-4 t-body font-medium whitespace-nowrap transition-colors sm:h-10'

export const LINK_BUTTON = {
  primary: `${BASE} border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700`,
  secondary: `${BASE} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900`,
}
