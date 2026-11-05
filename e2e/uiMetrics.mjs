/**
 * U0(§10 UI 개편) 화면 정돈 숫자 — 같은 자로 전후를 잰다(qa:firstscreen 이 쓴다).
 *
 *   start      핵심 내용(그 화면에서 가장 먼저 봐야 할 것)이 시작하는 위치 px — 문서 맨 위에서. 화면 높이로 나눈 값이 1 이하면 첫 화면 안.
 *   fontKinds  화면 본문(main) 안 글자 크기 종류 수 — 글이 들어 있는 보이는 칸의 계산된 글자 크기(px, 소수 둘째 자리)
 *   fonts      크기별 개수 '14px×40 15px×86 …'
 *   boxes      테두리 네 변이 있는 칸(높이 30px 넘음) 수 · nested 그중 다른 테두리 칸 안에 든 수(상자 안 상자)
 *   screens    문서 높이 ÷ 화면 높이
 * 읽기만 한다(화면을 바꾸지 않음).
 */
export async function measureUi(page, coreSelector) {
  return page.evaluate((sel) => {
    const H = window.innerHeight
    const main = document.querySelector('main') ?? document.body
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const all = [...main.querySelectorAll('*')].filter(vis)
    const textEls = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    const sizes = new Map()
    for (const el of textEls) {
      const s = `${Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100}px`
      sizes.set(s, (sizes.get(s) ?? 0) + 1)
    }
    const boxed = all.filter((el) => {
      const cs = getComputedStyle(el)
      return ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none') && el.getBoundingClientRect().height > 30
    })
    const nested = boxed.filter((el) => boxed.some((p) => p !== el && p.contains(el))).length
    const core = sel ? [...document.querySelectorAll(sel)].find(vis) : null
    const start = core ? Math.round(core.getBoundingClientRect().top + window.scrollY) : null
    return {
      start,
      startScreens: start == null ? null : Math.round((start / H) * 100) / 100,
      fontKinds: sizes.size,
      fonts: [...sizes.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([s, n]) => `${s}×${n}`).join(' '),
      boxes: boxed.length,
      nested,
      screens: Math.round((document.documentElement.scrollHeight / H) * 100) / 100,
    }
  }, coreSelector)
}

/**
 * §10 다섯 화면 — [이름, 주소, 핵심 내용 표지].
 * 기준선(2026-11-05 · main a43c319 · 견본 자료): 오늘 할 일 목록 PC 1,546px / 휴대폰 1,590px · 첫 업체 카드 800 / 907 · 서류함 칸 681 / 1,011 · 달력 464 · 마케팅 입력칸 341 / 308.
 */
export const KEY_SCREENS = [
  ['오늘', '/', '[data-testid="today-todo-grid"]'],
  ['고객 관리', '/ops/clients', '[data-testid="client-card"]'],
  ['서류', '/ops/clients/cli_hansol?tab=docs', '[data-testid="doc-shelf"]'],
  ['일정', '/ops/calendar', '[data-testid="month-calendar"]'],
  ['마케팅', '/marketing', '[data-testid="mk-ask-input"]'],
]
