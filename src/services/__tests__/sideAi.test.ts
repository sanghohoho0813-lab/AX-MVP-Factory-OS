/**
 * D-254 AI 옆 창 — 화면 자리 계산(오른쪽에 붙이기 · 왼쪽 OS 창 · 본문 비키기) · 기억한 설정 읽기.
 */
import { SIDE_SERVICES, featuresOf, parsePrefs, reserveFor, sideLayout } from '../../lib/sideAi'

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
check('S11 서비스 주소 — https 공식 주소만 · 셋', Object.values(SIDE_SERVICES).length === 3 && Object.values(SIDE_SERVICES).every((s) => /^https:\/\/(chatgpt\.com|claude\.ai|gemini\.google\.com)\//.test(s.url)))

console.log(`\nsideAi: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
