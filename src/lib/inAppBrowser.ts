/**
 * D-594 카카오톡 · 네이버 · 인스타그램 같은 앱 '안'에서 열린 화면인가.
 *
 * 주소를 카카오톡으로 받으면 누른 사람은 카카오톡 안 브라우저에서 열게 된다. 그 안에서는
 * 로그인이 오래 남지 않고 · 파일 내려받기가 막히고 · 홈 화면에 넣을 수 없다 — 그런데 쓰는 사람은 까닭을 모른다.
 * 그래서 로그인 화면과 '홈 화면에 넣는 법' 에서 알려 주고, 바깥 브라우저로 여는 길을 준다.
 *
 *  - 알아보는 법: 브라우저가 스스로 밝히는 이름(User-Agent)에 앱 이름이 들어 있다.
 *  - 여는 길: 카카오톡은 앱이 주는 길(openExternal)이 있다. 안드로이드의 다른 앱은 크롬으로 여는 길(intent).
 *    아이폰의 다른 앱은 길이 없다 — 글로 안내하고 [주소 복사] 를 준다.
 * 아무것도 저장하지 않는다. 주소를 밖으로 보내지 않는다(이 기기 안에서 여는 것뿐).
 */
export type InAppKind = 'kakaotalk' | 'naver' | 'threads' | 'instagram' | 'facebook' | 'line'

export const IN_APP_LABEL: Readonly<Record<InAppKind, string>> = {
  kakaotalk: '카카오톡',
  naver: '네이버 앱',
  threads: '스레드 앱',
  instagram: '인스타그램 앱',
  facebook: '페이스북 앱',
  line: '라인',
}

/** 앱 안 브라우저면 어느 앱인지, 평소 브라우저(사파리 · 크롬 · 삼성 인터넷 …)면 null */
export function inAppBrowserOf(ua: string): InAppKind | null {
  if (!ua) return null
  if (/KAKAOTALK/i.test(ua)) return 'kakaotalk'
  if (/NAVER\(inapp/i.test(ua)) return 'naver'
  if (/Barcelona/i.test(ua)) return 'threads'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN\/|FBAV\/|FB_IAB\//i.test(ua)) return 'facebook'
  if (/(^|\s)Line\//i.test(ua)) return 'line'
  return null
}

/** 지금 화면을 바깥 브라우저로 여는 주소 — 길이 없으면 null(글로 안내한다). http(s) 주소만 */
export function externalOpenUrl(kind: InAppKind, href: string, ua: string): string | null {
  if (!/^https?:\/\//i.test(href)) return null
  if (kind === 'kakaotalk') return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`
  if (/Android/i.test(ua)) {
    const scheme = /^https:/i.test(href) ? 'https' : 'http'
    return `intent://${href.replace(/^https?:\/\//i, '')}#Intent;scheme=${scheme};package=com.android.chrome;end`
  }
  return null
}

/**
 * 한 번만 쓰는 표(비밀번호 재설정 · 이메일 확인 링크)가 주소에 붙어 온 화면인가.
 * 그런 화면에서는 안내하지 않는다 — 그 자리에서 끝내는 것이 맞고, 표가 든 주소를 다른 곳으로 넘기거나 복사하게 하지 않는다.
 */
export function hasOneTimeToken(href: string): boolean {
  return /[#&?](access_token|refresh_token|code|token_hash)=|[#&?]type=(recovery|signup|magiclink|invite|email_change)\b/i.test(href)
}

/** 지금 브라우저(없으면 null) */
export function currentInApp(): InAppKind | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null
  if (hasOneTimeToken(window.location.href)) return null
  return inAppBrowserOf(navigator.userAgent)
}
