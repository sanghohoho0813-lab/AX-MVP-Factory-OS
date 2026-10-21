/**
 * D-254 AI 옆 창 — 화면 자리 계산(오른쪽에 붙이기 · 왼쪽 OS 창 · 본문 비키기) · 기억한 설정 읽기.
 * D-256 주소 칸(주소 · 검색어 · 막을 것) · 왼쪽 메뉴 폭(끌기 · 키보드 · 기억).
 * D-258 OS 안 오른쪽 판 — 안에 띄울 수 있는 곳 · Google igu · 놓는 법(붙이기 · 덮기 · 없음) · 기억 · 대화 기록.
 */
import { SIDE_SERVICES, SIDE_SITES, addressLabel, addressToUrl, featuresOf, parsePrefs, reserveFor, sideLayout } from '../../lib/sideAi'
import { NAV_ICONS, NAV_MAX, NAV_MIN, navMaxFor, navPx, parseNavSize, sizeAtDrag, stepNav, type NavSize } from '../../lib/navWidth'
import { DOCK_CHAT_MAX, DOCK_MAX, DOCK_MIN, GOOGLE_FRAME_HOME, canFrame, dockChatContext, dockLayout, frameUrlOf, parseDock, parseDockChat } from '../../lib/sideDock'

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

// D-258 OS 안 오른쪽 판
check('K1 안에 못 들어가는 곳(실측 막음) — ChatGPT · Claude · Gemini · 네이버 · K-Startup · Bing · 유튜브 · 하위 주소까지', ['https://chatgpt.com/', 'https://claude.ai/new', 'https://gemini.google.com/app', 'https://www.naver.com/', 'https://m.search.naver.com/x', 'https://www.k-startup.go.kr/', 'https://www.bing.com/', 'https://www.youtube.com/watch?v=abc'].every((u) => !canFrame(u)))
check('K2 안에 들어가는 곳 — 기업마당 · 홈택스 · Google(igu=1 있을 때만)', canFrame('https://www.bizinfo.go.kr/') && canFrame('https://www.hometax.go.kr/') && canFrame(GOOGLE_FRAME_HOME) && !canFrame('https://www.google.com/') && !canFrame('https://www.google.com/search?q=a') && canFrame('https://www.google.com/search?q=a&igu=1'))
check('K3 javascript · data · file · 깨진 주소는 절대 안 띄움', !canFrame('javascript:alert(1)') && !canFrame('data:text/html,x') && !canFrame('file:///etc/passwd') && !canFrame('nope') && frameUrlOf('javascript:alert(1)') === null && frameUrlOf('data:text/html,x') === null && frameUrlOf('') === null)
{
  const home = frameUrlOf('https://google.com/')
  const search = frameUrlOf(addressToUrl('정책자금 신청') as string)
  const plain = frameUrlOf('https://www.bizinfo.go.kr/web/index.do')
  check('K4 Google 이면 igu=1 을 붙여 안에 — 첫 화면은 /webhp · 검색은 검색 그대로 · 다른 곳은 그대로', home === 'https://www.google.com/webhp?igu=1' && !!search && search.startsWith('https://www.google.com/search?') && search.includes('igu=1') && decodeURIComponent(new URL(search).searchParams.get('q') ?? '') === '정책자금 신청' && canFrame(search) && plain === 'https://www.bizinfo.go.kr/web/index.do', [home, search, plain])
}
{
  const a = dockLayout(1440, 256, 420)
  const b = dockLayout(1920, 288, 900)
  const c = dockLayout(1280, 288, 420)
  const d = dockLayout(1366, 256, 420)
  const e = dockLayout(1023, 0, 420)
  const f = dockLayout(1440, 0, 420)
  check('K5 놓는 법 — 1440 · 메뉴 256 → 옆에 붙임 416(본문 768 남김) · 1920 → 720 끝 · 1280 · 메뉴 288 → 덮어 띄움 · 1023 → 없음', a.mode === 'dock' && a.width === 416 && 1440 - 256 - a.width === 768 && b.mode === 'dock' && b.width === DOCK_MAX && c.mode === 'over' && c.width === 420 && d.mode === 'dock' && d.width === 342 && e.mode === 'none' && f.mode === 'dock' && f.width === 420, { a, b, c, d, e, f })
  const g = dockLayout(1100, 256, 100)
  const h = dockLayout(1024, 80, 2000)
  check('K6 폭 범위 — 덮을 때도 320 아래로 안 줄고 화면 밖으로 안 나감', g.mode === 'over' && g.width === DOCK_MIN && h.width <= 1024 - 48 && h.width >= DOCK_MIN, { g, h })
}
{
  const p0 = parseDock(null)
  const p1 = parseDock('{"open":true,"tab":"web","width":9999,"webUrl":"https://chatgpt.com/"}')
  const p2 = parseDock('{"open":"yes","tab":"x","width":"500","webUrl":"https://www.google.com/search?q=a"}')
  check('K7 기억한 값 — 처음은 닫힘 · AI 대화 · 420 · 범위 밖 폭 바로잡음 · 막는 곳 주소는 Google 로 · Google 은 igu 붙여', p0.open === false && p0.tab === 'chat' && p0.width === 420 && p0.webUrl === GOOGLE_FRAME_HOME && p1.open && p1.tab === 'web' && p1.width === DOCK_MAX && p1.webUrl === GOOGLE_FRAME_HOME && !p2.open && p2.tab === 'chat' && p2.width === 420 && p2.webUrl.includes('igu=1') && parseDock('깨짐').width === 420, { p1, p2 })
}
{
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, at: '', q: `질문 ${i}`, status: 'done', headline: `답 ${i}`, items: [{ title: '가' }, { nope: 1 }] }))
  const list = parseDockChat(JSON.stringify([...many, { id: 'p', q: '기다리던 것', status: 'pending' }, { q: 'id 없음' }, 'x', null]))
  check('K8 대화 기록 — 30개까지 · 모양 틀린 줄 버림 · 기다리던 중 닫힌 것은 다시 묻기로', list.length === DOCK_CHAT_MAX && list[list.length - 1].id === 'p' && list[list.length - 1].status === 'error' && !!list[list.length - 1].error && list[0].items?.length === 1 && parseDockChat('깨짐').length === 0 && parseDockChat('{"a":1}').length === 0, list.slice(-2))
  const ctx = dockChatContext(list, '2026-10-21', '오늘')
  check('K9 보낼 것 — 앞선 대화(끝난 것) 4줄 · 지금 화면 이름만(회사 기록 없음)', ctx.sections.length === 1 && ctx.sections[0].rows.length === 4 && ctx.sections[0].rows[3].q === '질문 39' && ctx.facts[0] === '지금 보고 있는 화면: 오늘' && dockChatContext([], '2026-10-21', '').sections.length === 0 && dockChatContext([], '2026-10-21', '').facts.length === 0)
}

console.log(`\nsideAi: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
