/**
 * D-586 지금 주소 → 안내 열쇠 — 휴대폰 머리줄의 화면 이름을 누르면 그 화면의 안내를 띄운다.
 *
 * PC 는 메뉴 · 단추에 마우스를 올리면 안내 카드가 뜨지만(D-565 · D-569) 휴대폰은 올릴 수 없다.
 * 마케팅 · 브랜딩 안의 화면은 주소(와 ?view=)로 가른다 — 나머지는 메뉴 표에서 이 주소를 맡는 메뉴.
 */
import { moduleForPath } from '../config/moduleRegistry'

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

export function guideKeyForPath(pathname: string, search = ''): string | null {
  if (under(pathname, '/marketing/basics')) return 'mk-basics'
  if (under(pathname, '/marketing/threads')) return 'mk-threads'
  if (under(pathname, '/marketing/shorts')) return 'mk-shorts'
  if (under(pathname, '/marketing/youtube')) {
    const view = new URLSearchParams(search).get('view') ?? ''
    if (view === 'top' || view === 'channels' || view === 'analysis') return 'mk-top'
    if (view === 'make') return 'mk-make'
    return 'mk-plan'
  }
  if (under(pathname, '/tools/content')) return 'mk-content'
  if (under(pathname, '/tools/homepage')) return 'mk-homepage'
  return moduleForPath(pathname)?.key ?? null
}
