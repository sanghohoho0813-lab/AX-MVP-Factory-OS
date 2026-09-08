/**
 * 간단 모드 인수 시험 — 대표 입장에서 (§47).
 *
 *   node e2e/simple.mjs <baseUrl>
 *
 * TEST 1  프로젝트를 열면 지금 뭘 해야 하는지 바로 보이는가
 * TEST 2  Prompt Type·Stage 를 몰라도 프롬프트를 만들 수 있는가
 * TEST 3  Artifact Type·Version 을 몰라도 결과를 저장할 수 있는가
 * TEST 4  다음에 무엇을 누를지 설명 없이 아는가
 * TEST 5  390px 에서 한 손으로 계속 진행되는가
 * + 숨김 ≠ 삭제 (§48), 자동 기록, 클릭 수
 */

import { chromium } from 'playwright'
import { seedScript, SEED_CLIENT_ID, SEED_DOC_PROJECT_ID, SEED_NEW_PROJECT_ID, SEED_PROJECT_ID } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())

/* ── TEST 1 · 목록과 첫 화면 ── */
await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
await wait(800)
check('1 목록에 [계속하기] 가 있다', (await page.getByText('계속하기').count()) > 0)
check('1 목록이 관리자 표가 아니다 (table 없음)', (await page.locator('table').count()) === 0)

await page.getByText('계속하기').first().click()
await wait(1000)
check('1 프로젝트 화면으로 들어간다', /\/studio\/[^/]+/.test(page.url()), page.url())

const tabs = await page.locator('[role=tab]').allTextContents()
check('1 탭이 3개뿐이다', tabs.length === 3, tabs.join('/'))
check('1 탭 이름이 진행하기·결과물·기록', tabs.join(',') === '진행하기,결과물,기록', tabs.join(','))
check('1 S0~S16 이 화면에 나열되지 않는다', (await page.getByText('S16').count()) === 0)

const headline = (await page.locator('h2').first().textContent()) ?? ''
check('1 지금 할 일이 큰 글씨로 하나 보인다', headline.trim().length > 6, headline)
check('1 준비된 정보를 알려준다', (await page.getByText(/준비된 정보 \d+\/\d+/).count()) > 0)
check('1 다음이 무엇인지 미리 보여준다', (await page.getByText(/다음 ·/).count()) > 0)

/* Primary CTA 가 경쟁하지 않는다 */
const primaries = await page.locator('button.bg-brand-600').count()
check('1 강조 버튼이 하나뿐이다', primaries === 1, String(primaries))

/* ── TEST 4 · 설명 없이 다음을 안다 (버튼 글자가 행동) ── */
const cta = (await page.locator('button.bg-brand-600').first().textContent()) ?? ''
check('4 버튼 글자가 행동을 말한다', /계속|만들기|선택|가져오기|저장/.test(cta), cta)

/* ── 진행: 시드 프로젝트는 S3 이므로 프롬프트까지 몇 번 만에 가는지 센다 ── */
let clicks = 0
let reachedPrompt = false
for (let i = 0; i < 8; i += 1) {
  const label = (await page.locator('button.bg-brand-600').first().textContent()) ?? ''
  if (/프롬프트 만들기/.test(label)) { reachedPrompt = true; break }
  // SELECT 면 첫 항목을 고르고, INPUT 이면 채운다
  const choice = page.locator('button[aria-pressed]').first()
  if ((await choice.count()) > 0) await choice.click()
  const inputs = page.locator('section input[type=text], section input:not([type]), section textarea')
  const n = await inputs.count()
  for (let j = 0; j < n; j += 1) await inputs.nth(j).fill('테스트 입력값')
  await wait(200)
  const btn = page.locator('button.bg-brand-600').first()
  if (await btn.isDisabled()) break
  await btn.click()
  clicks += 1
  await wait(900)
}
check(`진행: ${clicks}번 눌러 프롬프트 단계 도달`, reachedPrompt && clicks <= 6, `${clicks}회 · 도달=${reachedPrompt}`)

/* ── TEST 2 · 종류를 고르지 않고 프롬프트 만들기 ── */
if (reachedPrompt) {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_prompt_packages') ?? '[]').length)
  check('2 프롬프트 종류 선택 상자가 없다', (await page.locator('select').count()) === 0)
  await page.locator('button.bg-brand-600').first().click()
  await wait(1500)
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_prompt_packages') ?? '[]'))
  check('2 한 번 눌러 프롬프트가 만들어졌다', after.length === before + 1, `${before}→${after.length}`)
  check('2 만들어진 프롬프트에 회사 사실이 들어 있다', (after[0]?.prompt ?? '').includes('한솔테크'))
  check('2 반환 블록을 요구한다', (after[0]?.prompt ?? '').includes('MIRAE_OS_RETURN'))
  check('2 내용은 기본으로 접혀 있다', (await page.getByRole('button', { name: '내용 보기' }).count()) === 1)
  check('2 복사하고 여는 버튼 하나로 끝난다', (await page.getByRole('button', { name: '복사하고 ChatGPT 열기' }).count()) === 1)
  check('2 프롬프트가 나와도 강조 버튼은 하나', (await page.locator('button.bg-brand-600').count()) === 1)
}

/* ── TEST 3 · 종류·버전을 고르지 않고 결과 저장 ── */
{
  const importBtn = page.getByRole('button', { name: '결과 가져오기' }).first()
  check('3 다음 할 일이 자동으로 결과 가져오기로 바뀐다', (await importBtn.count()) > 0)
  if ((await importBtn.count()) > 0) {
    await importBtn.click()
    await wait(500)
    const sheet = page.getByRole('dialog')
    check('3 시트에 종류·버전 선택칸이 없다', (await sheet.locator('select').count()) === 0)
    await page.getByLabel('결과 붙여넣기').fill(
      '# 특허 아이디어\n본문입니다.\n\n--- MIRAE_OS_RETURN ---\nTYPE: PATENT_IDEA\nSUMMARY: 세 방향으로 정리했습니다\nDECISION_OPTIONS:\n1) 공정 데이터 정규화 후 위험 산출\n2) 작업자 배정 최적화\nMISSING_FACTS:\n- 최근 매출\nNEXT_RECOMMENDATION: 선행기술 검토\n--- END_MIRAE_OS_RETURN ---',
    )
    await wait(400)
    check('3 붙여 넣으면 내용을 알아본다', (await page.getByText('내용을 알아봤습니다').count()) > 0)
    await page.getByRole('button', { name: '저장하고 계속' }).click()
    await wait(1500)
    const arts = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]'))
    check('3 산출물이 저장됐다 (종류·단계·버전 자동)', arts.length >= 1 && arts[0].type === 'PATENT_IDEA' && arts[0].version === 1, JSON.stringify(arts[0]?.type))
    check('3 기계용 블록은 보관된다 (다시 읽어야 하므로)', (arts[0]?.content ?? '').includes('MIRAE_OS_RETURN'))
    check('3 저장 후 후보를 고르라고 한다', (await page.getByText(/어느 방향으로/).count()) > 0)
  }
}

/* ── Red Team · 형식이 없어도 원문은 저장된다 (§17) ── */
{
  // 후보를 골라 S4(선행기술)로 넘어간 뒤, 형식 없는 답변을 그대로 붙여 넣는다
  const choice = page.locator('button[aria-pressed]').first()
  if ((await choice.count()) > 0) {
    await choice.click()
    await page.locator('button.bg-brand-600').first().click()
    await wait(1200)
  }
  const gen = page.locator('button.bg-brand-600').first()
  const label = (await gen.textContent()) ?? ''
  check('RT 후보를 고르면 다음 프롬프트로 이어진다', /프롬프트 만들기/.test(label), label)
  await gen.click()
  await wait(1500)
  await page.getByRole('button', { name: '결과 가져오기' }).first().click()
  await wait(500)
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]').length)
  await page.getByLabel('결과 붙여넣기').fill('형식 없이 그냥 쓴 답변입니다. 유사 특허 3건을 찾았고 회피 설계가 필요합니다.')
  await wait(400)
  check('RT 형식이 없어도 저장할 수 있다고 알려준다', (await page.getByText(/원문 그대로/).count()) > 0)
  await page.getByRole('button', { name: '저장하고 계속' }).click()
  await wait(1500)
  const arts = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]'))
  check('RT 형식이 없어도 원문이 통째로 저장된다', arts.length === before + 1 && (arts[0]?.content ?? '').includes('회피 설계'), `${before}→${arts.length}`)
}

/* ── 자동 기록 ── */
await page.getByRole('tab', { name: '기록' }).click()
await wait(800)
check('자동 기록: 따로 적지 않아도 타임라인이 쌓인다', (await page.getByText('프롬프트 생성').count()) > 0 || (await page.getByText('가져옴').count()) > 0)
check('자동 기록: 오늘로 묶인다', (await page.getByText('오늘').count()) > 0)

/* ── 결과물 ── */
await page.getByRole('tab', { name: '결과물' }).click()
await wait(700)
check('결과물: 만들어진 문서가 보인다', (await page.getByText('특허 아이디어 설계').count()) > 0)
check('결과물: draft/superseded 같은 내부 낱말이 없다', (await page.getByText(/draft|superseded/i).count()) === 0)
await page.getByText('특허 아이디어 설계').first().click()
await wait(600)
check('결과물: 읽을 때는 기계용 블록이 감춰진다', (await page.getByText('MIRAE_OS_RETURN').count()) === 0)
await page.getByRole('button', { name: '닫기' }).first().click()
await wait(400)

/* ── TEST 5 · 390 가로 넘침 ── */
let overflow = 0
for (const t of ['진행하기', '결과물', '기록']) {
  await page.getByRole('tab', { name: t }).click()
  await wait(500)
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (w > 2) { overflow++; console.log('   overflow', t, w) }
}
check('5 390px 가로 넘침 0 (3탭)', overflow === 0)
check('5 탭이 가로 스크롤되지 않는다', await page.evaluate(() => {
  const el = document.querySelector('[role=tablist]')
  return el ? el.scrollWidth - el.clientWidth <= 2 : false
}))

/* ── 처음 쓰는 사람 안내 (§20) ── */
{
  await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
  await wait(800)
  check('초보: 처음 안내가 세 줄로 뜬다', (await page.getByText('처음이신가요? 세 가지만 알면 됩니다.').count()) > 0)
  const steps = await page.locator('ol li').count()
  check('초보: 안내가 3단계를 넘지 않는다', steps <= 3, String(steps))
  await page.getByRole('button', { name: '안내 닫기' }).click()
  await wait(400)
  check('초보: 닫으면 사라진다', (await page.getByText('처음이신가요').count()) === 0)
  await page.reload({ waitUntil: 'networkidle' })
  await wait(700)
  check('초보: 새로고침해도 다시 뜨지 않는다', (await page.getByText('처음이신가요').count()) === 0)
}

/* ── 모르면 넘어갈 수 있다 · 시스템이 먼저 쓴다 (§5·§8·§9) ── */
{
  await page.goto(BASE + `/studio/${SEED_NEW_PROJECT_ID}`, { waitUntil: 'networkidle' })
  await wait(900)
  const later = page.getByRole('button', { name: /잘 모르겠어요/ })
  check('모름: 화면에 "잘 모르겠어요"가 있다', (await later.count()) > 0)
  await later.first().click()
  await wait(1400)
  check('모름: 미룬 것을 시스템이 들고 있다고 알려준다', (await page.getByText(/나중에 확인하기로 한 것/).count()) > 0)
  check('모름: 막히지 않고 다음 할 일이 나온다', (await page.locator('button.bg-brand-600').count()) === 1)

  // 문제 고르기까지 밀고 가서 "이렇게 저장됩니다" 를 확인
  for (let i = 0; i < 6; i += 1) {
    const h2 = (await page.locator('h2').first().textContent()) ?? ''
    if (/문제를 골라/.test(h2)) break
    const choice = page.locator('button[aria-pressed]').first()
    if ((await choice.count()) > 0) await choice.click()
    const ins = page.locator('section input[type=text], section input:not([type]), section textarea')
    for (let j = 0; j < (await ins.count()); j += 1) await ins.nth(j).fill('테스트 값')
    const btn = page.locator('button.bg-brand-600').first()
    if (await btn.isDisabled()) break
    await btn.click()
    await wait(900)
  }
  const h2now = (await page.locator('h2').first().textContent()) ?? ''
  if (/문제를 골라/.test(h2now)) {
    await page.locator('button[aria-pressed]').first().click()
    await wait(400)
    check('시스템이 씀: 고르면 저장될 문장을 미리 보여준다', (await page.getByText('이렇게 저장됩니다').count()) > 0)
    await page.locator('button.bg-brand-600').first().click()
    await wait(1200)
  } else {
    check('시스템이 씀: 문제 고르기 화면에 도달', false, h2now)
  }

  // 거래처 수 → 진행 판단(추천)
  for (let i = 0; i < 4; i += 1) {
    const h = (await page.locator('h2').first().textContent()) ?? ''
    if (/벤처인증까지 갈 수 있을까요/.test(h)) break
    const choice = page.locator('button[aria-pressed]').first()
    if ((await choice.count()) > 0) await choice.click()
    const btn = page.locator('button.bg-brand-600').first()
    if (await btn.isDisabled()) break
    await btn.click()
    await wait(900)
  }
  check('추천: 시스템이 먼저 의견을 낸다', (await page.getByText('지금 자료로 보면').count()) > 0)
  check('추천: 버튼이 "추천대로 진행"', (await page.getByRole('button', { name: /추천대로 진행/ }).count()) > 0)
  check('추천: 다르게 고를 수도 있다', (await page.getByRole('button', { name: '다르게 선택할게요' }).count()) > 0)
  check('추천: 무슨 뜻인지 물어볼 수 있다', (await page.getByRole('button', { name: /이게 뭔가요/ }).count()) > 0)
  await page.getByRole('button', { name: /이게 뭔가요/ }).click()
  await wait(400)
  check('용어풀이: 눌러야 나온다', (await page.getByText(/이 회사로 벤처인증까지 갈 수 있는지/).count()) > 0)
}

/* ── 서류로 회사 기본정보 채우기 (사업자등록증 · 법인등기부등본) ── */
{
  await page.goto(BASE + `/studio/${SEED_DOC_PROJECT_ID}`, { waitUntil: 'networkidle' })
  await wait(900)
  check('서류: 빈 프로젝트는 회사 기본정보부터 묻는다', (await page.getByText(/회사 기본정보/).count()) > 0)
  const docBtn = page.getByRole('button', { name: /사업자등록증/ }).first()
  check('서류: 카드에 "서류로 채우기" 가 보인다', (await docBtn.count()) > 0)
  check('서류: 서류 버튼이 강조 버튼을 뺏지 않는다', (await page.locator('button.bg-brand-600').count()) === 1)

  await docBtn.click()
  await wait(500)
  const sheet = page.getByRole('dialog')
  check('서류: 한 번에 두 장을 고를 수 있다', await sheet.locator('input[type=file][multiple]').count() > 0)
  check('서류: PDF·사진만 받는다', (await sheet.locator('input[type=file]').getAttribute('accept'))?.includes('pdf') === true)

  // 파일 대신 글자로 — 판독기(pdfjs·OCR)를 브라우저 시험에서 돌리지 않기 위해서다.
  // 읽어 낸 다음의 흐름(무엇을 채우나 · 무엇을 덮나 · 어떻게 기록되나)은 동일하다.
  await sheet.getByRole('button', { name: '서류 대신 글자를 붙여 넣기' }).click()
  await wait(300)
  await page.getByLabel('서류 글자 붙여넣기').fill(
    [
      '사업자등록증 ( 법인사업자 )',
      '등록번호 : 214-88-01234',
      '법인명(단체명) : 주식회사 대한정밀',
      '대표자 : 박정밀',
      '개업연월일 : 2018 년 05 월 14 일',
      '사업장 소재지 : 경기도 화성시 동탄산단6길 22',
      '업태 : 제조업',
      '종목 : 자동차부품 제조',
    ].join('\n'),
  )
  await sheet.getByRole('button', { name: '글자에서 읽기' }).click()
  await wait(600)
  check('서류: 읽은 항목을 목록으로 보여준다', (await sheet.getByText(/에서 \d+개를 읽었습니다/).count()) > 0)
  check('서류: 회사명을 읽었다', (await sheet.getByText('주식회사 대한정밀').count()) > 0)
  check('서류: 사업자등록번호를 읽었다', (await sheet.getByText('214-88-01234').count()) > 0)
  check('서류: 대표자를 읽었다', (await sheet.getByText('박정밀').count()) > 0)

  const applyBtn = sheet.getByRole('button', { name: /개 채우기/ })
  check('서류: 몇 개를 채울지 버튼에 쓴다', (await applyBtn.count()) > 0, (await applyBtn.first().textContent()) ?? '')
  await applyBtn.first().click()
  await wait(1600)

  const saved = await page.evaluate(
    (id) => (JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]').find((x) => x.id === id) ?? {}).factsheet ?? {},
    SEED_DOC_PROJECT_ID,
  )
  check('서류: 회사명이 사실표에 들어갔다', saved.companyName?.value === '주식회사 대한정밀', JSON.stringify(saved.companyName))
  check('서류: 출처가 서류 이름으로 남는다', saved.companyName?.source === '사업자등록증', saved.companyName?.source)
  check('서류: 본점·설립일·사업자번호도 함께 채워진다', !!saved.headOffice?.value && !!saved.establishedAt?.value && saved.businessNumber?.value === '214-88-01234')
  check('서류: 종목에서 옮긴 주요제품은 미확인으로 둔다', saved.mainProducts?.status === 'unverified', saved.mainProducts?.status)

  await page.getByRole('tab', { name: '기록' }).click()
  await wait(700)
  check('서류: 따로 적지 않아도 기록에 남는다', (await page.getByText(/서류에서 \d+개 항목/).count()) > 0)
}

/* ── 데스크톱 1024 / 1440 / 1920 ── */
for (const width of [1024, 1440, 1920]) {
  const dctx = await browser.newContext({ viewport: { width, height: 900 } })
  const dpage = await dctx.newPage()
  dpage.on('pageerror', (e) => errors.push(`${width}: ${String(e).slice(0, 160)}`))
  await dpage.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await dpage.evaluate(seedScript())
  await dpage.goto(BASE + `/studio/${SEED_PROJECT_ID}`, { waitUntil: 'networkidle' })
  await wait(900)
  const over = await dpage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`데스크톱 ${width}: 가로 넘침 없음`, over <= 2, String(over))
  check(`데스크톱 ${width}: 강조 버튼 하나`, (await dpage.locator('button.bg-brand-600').count()) === 1)
  /* 읽기 좋은 폭 — 카드가 화면 끝까지 늘어나면 제목과 버튼이 멀어진다 */
  const cardW = await dpage.evaluate(() => {
    const h = document.querySelector('h2')
    return h ? Math.round(h.closest('section')?.getBoundingClientRect().width ?? 0) : 0
  })
  check(`데스크톱 ${width}: 할 일 카드가 읽기 좋은 폭 (${cardW}px)`, cardW > 500 && cardW <= 800, String(cardW))
  await dpage.goto(BASE + '/studio', { waitUntil: 'networkidle' })
  await wait(700)
  check(`데스크톱 ${width}: 목록에 표가 없다`, (await dpage.locator('table').count()) === 0)
  await dctx.close()
}

/* ── §48 숨김 ≠ 삭제 ── */
await page.goto(BASE + `/studio/${SEED_PROJECT_ID}?adv=1`, { waitUntil: 'networkidle' })
await wait(900)
const advTabs = await page.locator('[role=tab]').allTextContents()
check('48 고급 보기에 기존 12탭이 그대로 있다', advTabs.length === 12, String(advTabs.length))
for (const name of ['단계', '사실표', '핵심 줄기', '증빙', '결정']) {
  check(`48 고급: ${name} 탭 보존`, advTabs.includes(name))
}
await page.goto(BASE + `/studio/${SEED_PROJECT_ID}?adv=1&tab=stages`, { waitUntil: 'networkidle' })
await wait(800)
check('48 단계 데이터가 살아 있다 (S0~S16)', (await page.getByText('S16').count()) > 0)
await page.goto(BASE + `/studio/${SEED_PROJECT_ID}?adv=1&tab=factsheet`, { waitUntil: 'networkidle' })
await wait(800)
check('48 사실표 데이터가 살아 있다', (await page.getByText('한솔테크').count()) > 0)

/* ── §44 되돌리기 · 간단 모드로 넣은 것은 고급에서 고칠 수 있다 ── */
await page.goto(BASE + `/studio/${SEED_PROJECT_ID}?adv=1&tab=artifacts`, { waitUntil: 'networkidle' })
await wait(800)
check('44 간단 모드로 저장한 산출물이 고급에도 있다', (await page.getByText('특허 아이디어 설계').count()) > 0)
await page.goto(BASE + `/studio/${SEED_PROJECT_ID}?adv=1&tab=thread`, { waitUntil: 'networkidle' })
await wait(800)
check('44 간단 모드로 고른 권리화 포인트를 고급에서 고칠 수 있다', (await page.locator('textarea, input[type=text]').count()) > 0)
check('44 조용히 지우지 않는다 (고른 값이 남아 있다)', (await page.getByText(/정규화|위험 산출/).count()) > 0)

/* ── 고객 상세에서도 열린다 ── */
await page.goto(BASE + `/ops/clients/${SEED_CLIENT_ID}?tab=consulting`, { waitUntil: 'networkidle' })
await wait(900)
check('고객 상세 컨설팅 탭 유지', (await page.getByText('작업지연').count()) > 0)

check('JS 오류 0', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\n간단 모드: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
