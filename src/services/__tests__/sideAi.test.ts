/**
 * D-254 AI 옆 창 — 화면 자리 계산(오른쪽에 붙이기 · 왼쪽 OS 창 · 본문 비키기) · 기억한 설정 읽기.
 * D-256 주소 칸(주소 · 검색어 · 막을 것) · 왼쪽 메뉴 폭(끌기 · 키보드 · 기억).
 */
import { SIDE_SERVICES, SIDE_SITES, addressLabel, addressToUrl, featuresOf, parsePrefs, reserveFor, sideLayout } from '../../lib/sideAi'
import { NAV_ICONS, NAV_MAX, NAV_MIN, navMaxFor, navPx, parseNavSize, sizeAtDrag, stepNav, type NavSize } from '../../lib/navWidth'

let pass = 0
let fail = 0
const check = (n: string, c: boolean, d?: unknown) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : JSON.stringify(d))
  }
}

const FHD = { left: 0, top: 0, width: 1920, height: 1040 }
{
  const { side, os } = sideLayout(FHD, 'twofifths')
  check('S1 1920 화면 보통(40%) — 오른쪽 768px · 위아래 꽉 · 왼쪽 OS 1152px · 둘이 딱 맞음', side.width === 768 && side.left === 1152 && side.top === 0 && side.height === 1040 && os.left === 0 && os.width === 1152 && os.width + side.width === 1920, { side, os })
  const t = sideLayout(FHD, 'third')
  const h = sideLayout(FHD, 'half')
  check('S2 폭 3단계 — 1/3 = 640 · 1/2 = 960', t.side.width === 640 && h.side.width === 960 && h.os.width === 960, [t.side.width, h.side.width])
  const small = sideLayout({ left: 0, top: 0, width: 1000, height: 700 }, 'third')
  check('S3 작은 화면 — 옆 창은 380px 아래로 안 줄임', small.side.width === 380 && small.os.width === 620, small)
  const second = sideLayout({ left: 1920, top: 0, width: 2560, height: 1400 }, 'half')
  check('S4 두 번째 모니터(왼쪽이 1920) — 그 모니터 오른쪽에', second.side.left === 1920 + 1280 && second.os.left === 1920, second)
}
{
  const { side } = sideLayout(FHD, 'twofifths')
  const full = reserveFor({ screenX: 0, outerWidth: 1920, innerWidth: 1920 }, side)
  check('S5 OS 창이 화면 가득 — 덮이는 768px 만큼 본문을 비킴', full === 768, full)
  const left = reserveFor({ screenX: 0, outerWidth: 1152, innerWidth: 1152 }, side)
  check('S6 OS 창을 왼쪽에 둠(안 겹침) — 비키지 않음', left === 0, left)
  const other = reserveFor({ screenX: 1920, outerWidth: 1920, innerWidth: 1920 }, side)
  check('S7 OS 창이 다른 모니터 — 비키지 않음', other === 0, other)
  const tiny = reserveFor({ screenX: 700, outerWidth: 1000, innerWidth: 1000 }, sideLayout(FHD, 'half').side)
  check('S8 본문이 640px 아래로 좁아지게는 안 비킴', tiny === 360, tiny)
}
check('S9 창 모양 글 — popup · 자리 · 크기', featuresOf({ left: 1152, top: 0, width: 768, height: 1040 }) === 'popup=yes,left=1152,top=0,width=768,height=1040')
check('S10 기억한 설정 — 모르는 값 · 깨진 글은 기본(ChatGPT · 보통)', parsePrefs('{"service":"claude","width":"half"}').service === 'claude' && parsePrefs('{"service":"x","width":"y"}').service === 'chatgpt' && parsePrefs('{"service":"x","width":"y"}').width === 'twofifths' && parsePrefs('not json').width === 'twofifths' && parsePrefs(null).service === 'chatgpt')
check('S11 서비스 주소 — https 공식 주소만 · 넷(구글 포함)', Object.values(SIDE_SERVICES).length === 4 && Object.values(SIDE_SERVICES).every((s) => /^https:\/\/(chatgpt\.com|claude\.ai|gemini\.google\.com|www\.google\.com)\//.test(s.url)))

// D-256 주소 칸
check('S12 빈 칸 → null(부른 쪽이 구글)', addressToUrl('') === null && addressToUrl('   ') === null)
check('S13 점 있는 한 덩어리 → https:// 붙여', addressToUrl('naver.com') === 'https://naver.com/' && addressToUrl('www.bizinfo.go.kr/web/index.do') === 'https://www.bizinfo.go.kr/web/index.do' && addressToUrl(' google.com ') === 'https://google.com/', [addressToUrl('naver.com'), addressToUrl('www.bizinfo.go.kr/web/index.do')])
check('S14 http(s) 주소는 그대로', addressToUrl('https://www.k-startup.go.kr/') === 'https://www.k-startup.go.kr/' && addressToUrl('http://example.org/a?b=1') === 'http://example.org/a?b=1')
check('S15 검색어(띄어쓰기 · 한글) → 구글 검색', addressToUrl('청년도약 장려금 2026') === 'https://www.google.com/search?q=' + encodeURIComponent('청년도약 장려금 2026') && addressToUrl('정책자금')!.startsWith('https://www.google.com/search?q='))
check('S16 javascript: · data: · file: 는 절대 열지 않고 검색으로', ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'JavaScript:void(0)'].every((x) => addressToUrl(x)!.startsWith('https://www.google.com/search?q=')))
check('S17 깨진 http 주소 → 검색', addressToUrl('http://')!.startsWith('https://www.google.com/search?q=') && addressToUrl('https:// 띄어쓰기')!.startsWith('https://www.google.com/search?q='))

check('S18 단추 이름 — 구글 검색 · 구글 · 다른 곳은 www 뗀 주소', addressLabel('https://www.google.com/search?q=x') === 'Google 검색' && addressLabel('https://www.google.com/') === 'Google' && addressLabel('https://www.naver.com/') === 'naver.com' && addressLabel('not a url') === '')
check('S19 바로 가기 — https 공식 주소만', SIDE_SITES.length >= 4 && SIDE_SITES.every((s) => addressToUrl(s.url) === s.url && s.url.startsWith('https://')))

// D-256 왼쪽 메뉴 폭
const FULL: NavSize = { mode: 'full', width: 300 }
check('N1 끈 자리 → 40 안 숨김 · 150 안 아이콘 · 그 밖 그 폭(200~440)', sizeAtDrag(10, FULL).mode === 'hidden' && sizeAtDrag(39, FULL).mode === 'hidden' && sizeAtDrag(40, FULL).mode === 'icons' && sizeAtDrag(149, FULL).mode === 'icons' && sizeAtDrag(150, FULL).width === 200 && sizeAtDrag(320, FULL).width === 320 && sizeAtDrag(900, FULL).width === NAV_MAX && sizeAtDrag(-50, FULL).mode === 'hidden')
check('N2 숨김 · 아이콘으로 끌어도 넓게 폭은 기억(돌아오면 그 폭)', sizeAtDrag(10, FULL).width === 300 && sizeAtDrag(100, FULL).width === 300 && navPx(sizeAtDrag(10, FULL)) === 0 && navPx(sizeAtDrag(100, FULL)) === NAV_ICONS)
check('N3 키보드 ← 24px 씩 · 200 에서 더 ← 아이콘 → 숨김 · 숨김에서 → 아이콘 → 넓게', stepNav(FULL, -1, 300).width === 276 && stepNav({ mode: 'full', width: NAV_MIN }, -1, NAV_MIN).mode === 'icons' && stepNav({ mode: 'icons', width: 300 }, -1, 80).mode === 'hidden' && stepNav({ mode: 'hidden', width: 300 }, 1, 0).mode === 'icons' && stepNav({ mode: 'icons', width: 300 }, 1, 80).mode === 'full' && stepNav({ mode: 'full', width: NAV_MAX }, 1, NAV_MAX).width === NAV_MAX && stepNav({ mode: 'hidden', width: null }, -1, 0).mode === 'hidden')
check('N4 끈 적 없음(폭 null) — 예전 폭 그대로 그린다(클래스) · 키보드는 지금 보이는 폭에서', navPx({ mode: 'full', width: null }) === null && stepNav({ mode: 'full', width: null }, 1, 288).width === 312)
check('N5 기억한 값 — 모르는 모드 · 깨진 글 · 범위 밖 폭은 바로잡음', parseNavSize(null).mode === 'full' && parseNavSize(null).width === null && parseNavSize('{"mode":"x","width":999}').mode === 'full' && parseNavSize('{"mode":"x","width":999}').width === NAV_MAX && parseNavSize('{"mode":"hidden","width":10}').width === NAV_MIN && parseNavSize('{"mode":"icons"}').mode === 'icons' && parseNavSize('nope').mode === 'full' && parseNavSize('{"width":"300"}').width === null)
check('N6 본문 768px 남김 — 1024 화면 메뉴 끝 256(예전 폭) · 1440 은 440 · 아주 좁으면 200 · 끌어도 그 끝까지', navMaxFor(1024) === 256 && navMaxFor(1440) === NAV_MAX && navMaxFor(800) === NAV_MIN && sizeAtDrag(500, FULL, 256).width === 256 && stepNav({ mode: 'full', width: 240 }, 1, 240, 256).width === 256)

console.log(`\nsideAi: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
