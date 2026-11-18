/**
 * D-507 마케팅 · 브랜딩 화면(레이더 · 내 콘텐츠 · 스레드 · 릴스 · 홍보 글 · 홈페이지) — 이 영역은 글자를 한 단계 크게 · 진하게.
 * 본문(main)과 D-628 오른쪽 판의 대화창이 같은 기준을 쓴다.
 */
export function isMarketingArea(pathname: string): boolean {
  return pathname === '/marketing' || pathname.startsWith('/marketing/') || pathname === '/tools/content' || pathname.startsWith('/tools/content/') || pathname === '/tools/homepage' || pathname.startsWith('/tools/homepage/')
}
