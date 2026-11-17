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
