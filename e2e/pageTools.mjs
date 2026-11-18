/**
 * D-627 [⋯] 이 화면 도구 — AI 도우미 · 화면 꾸미기 · 대화로 묻기는 경로 줄 오른쪽 [⋯] 안에 있다.
 * 그 단추를 누르기 전에 부른다 — 메뉴가 닫혀 있으면 연다(이미 열려 있거나 [⋯] 가 없으면 그대로).
 * page 또는 locator 를 받는다.
 */
export async function openTools(pageOrLocator) {
  const p = typeof pageOrLocator.page === 'function' ? pageOrLocator.page() : pageOrLocator
  const menu = p.getByTestId('page-tools-menu')
  if (!(await menu.count())) return
  if (await menu.first().isVisible()) return
  const btn = p.getByTestId('page-tools').first()
  if (await btn.isVisible().catch(() => false)) {
    await btn.click()
    await menu.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  }
}

/** 이 가운데 하나라도 보일 때까지 기다린다(못 보면 false) */
async function seenAny(page, ids, timeout = 8000) {
  return page
    .waitForFunction((list) => list.some((id) => [...document.querySelectorAll(`[data-testid="${id}"]`)].some((el) => el.checkVisibility())), ids, { timeout })
    .then(() => true)
    .catch(() => false)
}

/**
 * D-628 이 화면의 대화창은 오른쪽 판(휴대폰은 아래 판)에 있다 — 대화창 안의 것을 누르기 전에 부른다.
 * 닫혀 있으면 [대화] 단추로 열고, 시작 카드가 떠 있으면 [대화 시작] 을 누른다(이미 질문칸이 보이면 그대로).
 */
export async function openChat(page) {
  const INSIDE = ['chat-input', 'mk-ask-input', 'ai-assist-panel']
  await seenAny(page, ['chat-start', 'page-chat-launch', ...INSIDE])
  const launch = page.getByTestId('page-chat-launch').first()
  if (await launch.isVisible().catch(() => false)) {
    await launch.click()
    await seenAny(page, ['chat-start', ...INSIDE])
  }
  const start = page.getByTestId('chat-start').first()
  if (await start.isVisible().catch(() => false)) {
    await start.click()
    await seenAny(page, INSIDE)
  }
}

/** D-628 휴대폰 아래 판 · PC 오른쪽 판 닫기(열려 있을 때만) */
export async function closeChat(page) {
  for (const id of ['page-chat-sheet-close', 'dock-close']) {
    const b = page.getByTestId(id).first()
    if (await b.isVisible().catch(() => false)) {
      await b.click()
      await page.waitForTimeout(200)
      return
    }
  }
}

/** D-628 대화창이 지금 보이는가(오른쪽 판 또는 아래 판 안에 이 화면 대화창) */
export async function chatOpen(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="side-dock"] [data-page-chat], [data-testid="page-chat-sheet"] [data-page-chat]')].some((el) => el.checkVisibility()))
}
