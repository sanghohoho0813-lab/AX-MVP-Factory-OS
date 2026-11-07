/**
 * MK-SIMPLE(D-553) 마케팅 목차 — 첫 화면 밖에서는 PC 는 얇은 두 줄, 휴대폰은 [다른 화면] 을 눌러야 칸이 보인다.
 * 칸이 보이지 않으면 [다른 화면] 을 먼저 펼치고 누른다(같은 칸 · 같은 시험 이름).
 */
export async function mkTab(page, id, how = 'click') {
  const el = page.getByTestId(id)
  if (!(await el.isVisible().catch(() => false))) {
    const more = page.getByTestId('mk-tabs-more')
    if (await more.isVisible().catch(() => false)) {
      await more.click()
      await el.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
    }
  }
  if (how === 'tap') await el.tap()
  else await el.click()
}
