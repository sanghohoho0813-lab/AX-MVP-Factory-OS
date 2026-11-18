/**
 * 마케팅 화면 시험이 같이 쓰는 '한 번 누르기' 도우미 (D-630 · 2026-11-18 대표 지시).
 *
 * 대표: "마케팅은 들어갔을 때 아직 많다 — 딱 한 가지만(이름 · 한 줄 · 첫 단계나 목록 하나), 나머지는 누른 뒤에".
 * 그래서 예전에 첫 화면에 있던 것들이 접힌 한 줄 안으로 옮겨졌다 — 시험은 사람처럼 그 줄을 한 번 누르고 본다.
 * 접힌 줄은 들어올 때마다 접힌 채로 시작한다(펼친 것을 기억하지 않는다 · [모두 펼치기] 를 해 둔 계정만 처음부터 펼침).
 * 모든 도우미는 이미 펼쳐져 있으면 아무것도 하지 않고, 그 줄이 화면에 없으면(다른 화면) 조용히 넘어간다.
 */

/**
 * 눈에 보이는 글자만 — 화면 읽기 전용 글(.sr-only)은 뺀다.
 * (innerText 는 화면 읽기 전용 글도 같이 돌려준다 — '지금 칸' 한 줄처럼 이름을 화면 읽기용으로만 남긴 곳을 볼 때 쓴다)
 */
export const visibleText = (locator) =>
  locator.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let out = ''
    let n
    while ((n = walker.nextNode())) if (!n.parentElement?.closest('.sr-only')) out += n.textContent
    return out.replace(/\s+/g, ' ').trim()
  })

/** 접힌 한 줄(Fold · data-testid) 하나를 펼친다 — 펼쳤으면 true */
export async function openFoldRow(page, testId, wait = 250) {
  const box = page.getByTestId(testId).first()
  if (!(await box.count())) return false
  if ((await box.getAttribute('data-open')) === '1') return true
  await box.getByTestId('fold-toggle').first().click()
  await page.waitForTimeout(wait)
  return (await box.getAttribute('data-open')) === '1'
}

/** 유튜브(이번 주 뜨는 주제) 판 맨 아래 [더 보기] — 1주일치 · 우리 본업 주제 · 주제 직접 쓰기 · 내 관심 분야 · 사용 방법 · 받은 때 · [자세히 보기] */
export const openMkHomeMore = (page) => openFoldRow(page, 'mk-home-more')

/** 유튜브 [더 보기] 안 [자세히 보기] — 시장 신호 · 추천 기준 · AI 도우미 · 새로 가져오기 · 엑셀로 받기 · 채널 설계 기준 */
export async function openMkDetail(page) {
  await openMkHomeMore(page)
  return openFoldRow(page, 'mk-more', 350)
}

/** 스레드(thr) · 릴스 · 틱톡(sht) 1단계 맨 아래 [더 보기] — 뼈대 · 예시 · 첫마디 10개 · 추천 형식 · 바라는 점 · 참고 글 · 사실 · 모델 · 내 맞춤 */
export const openQsMore = (page, pre) => openFoldRow(page, `${pre}-qs-more`)

/** 남의 인기 영상 [기간 · 주제 고르기] — 이번 주 주목 주제 · 거르기 · 기간 · 키워드 · 숫자 한 줄 */
export const openTopTools = (page) => openFoldRow(page, 'yt-top-tools')

/** 남의 인기 영상 — 처음 세 편 뒤 [n편 더 보기](있으면) */
export async function showAllTop(page) {
  const more = page.getByTestId('yt-top-more')
  if (!(await more.count())) return false
  await more.first().click()
  await page.waitForTimeout(200)
  return true
}

/** 기초 7가지 목록 아래 [더 보기] — 프로필 소개 글 · 내 상담 신청 링크 · 연락 받는 길 만드는 법 · 올리는 법 */
export const openBasicsTools = (page) => openFoldRow(page, 'mk-basics-tools')

/** 1주일치 — 탭 하나를 고른다(들어오면 고른 탭이 없다). 이미 그 탭이면 그대로 */
export async function pickWeekTab(page, key) {
  const root = page.getByTestId('mk-week').first()
  if (!(await root.count())) return false
  if ((await root.getAttribute('data-tab')) === key) return true
  await page.locator(`[data-testid="mk-week-tab"][data-tab="${key}"]`).first().click()
  await page.waitForSelector(`[data-testid="mk-week-panel"][data-tab="${key}"]`, { timeout: 5000 }).catch(() => {})
  return true
}

/**
 * 유튜브(이번 주 뜨는 주제) 화면이면 [더 보기] › [자세히 보기] 까지 펼친다 — 자료를 받는 중이면 끝날 때까지 기다린 뒤.
 * 자료를 못 받은 화면([예시로 보기])은 [더 보기] 만 펼친다(그 안에 채널 설계 기준).
 */
export async function openPlanInside(page) {
  if (!(await page.getByTestId('mk-home').count())) return false
  await page.waitForFunction(() => !document.querySelector('[data-testid="yt-loading"]'), null, { timeout: 8000 }).catch(() => {})
  await openMkHomeMore(page)
  await page.waitForSelector('[data-testid="mk-more"], [data-testid="yt-setup"]', { timeout: 3000 }).catch(() => {})
  return openFoldRow(page, 'mk-more', 350)
}

/**
 * 지금 열린 마케팅 화면의 접힌 줄을 전부 펼친다 — '이 계정에 보이면 안 되는 글이 화면 어디에도 없다' 를 보는 시험용
 * (D-630 전에는 첫 화면에 나와 있던 것들이라, 접힌 채로만 보면 그 시험이 약해진다). 그 화면에 없는 줄은 조용히 넘어간다.
 */
export async function openMkEntryFolds(page) {
  await openPlanInside(page).catch(() => {})
  for (const id of ['thr-qs-more', 'sht-qs-more', 'yt-top-tools', 'mk-basics-tools']) await openFoldRow(page, id).catch(() => {})
}

/**
 * [자세히 보기] 안(시장 신호 · 추천 기준 · 제작 예정 …)을 보는 시험용 — 이 창에서 주소를 열거나 새로 고칠 때마다
 * 유튜브 화면이면 [더 보기] › [자세히 보기] 를 다시 펼친다(D-630 부터 들어올 때마다 접힌 채로 시작하므로).
 * 들어왔을 때 모양 그대로를 보려면 돌려받은 off() 로 끄고, 다시 켜려면 on().
 */
export function keepPlanInsideOpen(page) {
  let enabled = true
  const goto = page.goto.bind(page)
  const reload = page.reload.bind(page)
  page.goto = async (...a) => {
    const r = await goto(...a)
    if (enabled) await openPlanInside(page).catch(() => {})
    return r
  }
  page.reload = async (...a) => {
    const r = await reload(...a)
    if (enabled) await openPlanInside(page).catch(() => {})
    return r
  }
  return { off: () => (enabled = false), on: () => (enabled = true) }
}
