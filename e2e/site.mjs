/**
 * 홈페이지 만들기 시험 (D-202) — 식스샵식 블록 구성을 우리 OS 에 (업체 기록 → 초안 → 고치기 → 미리보기 → 내려받기).
 *
 *  1440  업체 고르기 → 처음 카드(무엇이 채워지나 ✓/– · 업종 알아봄) → 초안 만들기 → 블록 목록 · 미리보기(회사명 · 사업자번호 · 스크립트 0)
 *        저장 → 새로고침해도 그대로 · 큰 문구 고치기 → 미리보기 바뀜 · 견본 표시 빠짐 · 미리보기에서 블록 누르기 → 왼쪽에서 열림
 *        아래로 옮기기 · 휴대폰 숨김(휴대폰 미리보기에서 안 보임) · 블록 더하기(연혁 = 설립 연도) · 지우기(한 번 더 묻기) → 되돌리기
 *        꾸밈 색 바꾸기 · 점검(꼭 · 확인 · 열기) · 대표 전화 없는 업체 → [담당자 번호 넣기]
 *        공격 글(<img onerror>) → 미리보기에 이벤트 0 · 알림창 0 · HTML 내려받기(파일 이름 · 내용) · 업체 기록에 붙이기(다시 열기 주소)
 *        업체 상세 › 잘 안 쓰는 기능 › 웹 스튜디오 › 홈페이지 [만들기] 입구
 *  390 · 360  [고치기 | 미리보기] · 가로 넘침 0 · 누르는 것 44px · 휴대폰 미리보기
 *  D-208  홈페이지 점수 · 이것만 하면(누르면 그 블록) · 업종 맞춤 블록 [넣기] · 디자인 한 번에(스타일 6 · 업종 추천 · 되돌리기) ·
 *         사진 없으면 사진 가득 대신 색 바탕 · 이 업체 홍보 글로 바로 · 휴대폰 넘침 0
 *  D-226  색 — 처음 카드 · 편집 머리 띠(초록 · 점수 같은 숫자) · 블록마다 색 아이콘 · 고른 탭 초록 · 블록 더하기 창 아이콘
 *
 *   node e2e/site.mjs http://localhost:4390 [--shots <dir>]
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_site',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  contactName: '박담당',
  businessNumber: '1234567890',
  establishedAt: '2014-03-02',
  businessCategory: '제조업',
  businessItem: '정밀 금속부품, 금형, 시제품 가공',
  businessAddress: '경기도 화성시 동탄산단 6길 15',
  employeeCount: '42',
  companyPhone: '031-123-4567',
  contactPhone: '010-9999-8888',
  contactEmail: 'hello@hansol.co.kr',
  status: 'active',
  factValues: { certifications: '벤처기업, 이노비즈, ISO 9001', patents: '금형 냉각 구조', researchLab: '인정(2019)' },
  createdAt: NOW,
  updatedAt: NOW,
}
// 대표 전화가 없고 담당자 휴대폰만 있는 업체
const NOPHONE = { id: 'cli_site_np', companyName: '새봄카페', businessCategory: '음식점업', businessItem: '커피 전문점', contactPhone: '010-2222-3333', status: 'active', createdAt: NOW, updatedAt: NOW }

async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(
    (rows) => {
      const k = 'axmvp.v1.operations_clients'
      const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !rows.some((x) => x.id === r.id))
      list.push(...rows)
      localStorage.setItem(k, JSON.stringify(list))
      for (const key of Object.keys(localStorage)) if (key.startsWith('axmvp.module.homepage')) localStorage.removeItem(key)
    },
    [FULL, NOPHONE],
  )
}

const frameHtml = (page) => page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentDocument?.documentElement.outerHTML ?? '')
const frameEval = (page, fn, arg) => page.locator('[data-testid="site-frame"]').evaluate((f, [src, a]) => new Function('doc', 'arg', `return (${src})(doc, arg)`)(f.contentDocument, a), [fn.toString(), arg])
const rowOf = (page, type) => page.locator(`[data-block-row][data-type="${type}"]`).first()
const savedDoc = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('axmvp.module.homepage.site'))
    const rows = k ? JSON.parse(localStorage.getItem(k) ?? '[]') : []
    return rows.find((r) => r.clientId === 'cli_site')?.data?.doc ?? null
  })
async function waitSaved(page) {
  for (let i = 0; i < 40; i++) {
    if ((await page.getByTestId('site-save').getAttribute('data-state')) === 'saved') return true
    await wait(100)
  }
  return false
}

const browser = await chromium.launch()
const errors = []

/* ================================================================== */
/* PC 1440                                                             */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  let dialogs = 0
  page.on('dialog', (d) => {
    dialogs += 1
    void d.dismiss()
  })
  await seed(page)

  // 1 업체 고르기
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  check('1 /tools/homepage — 업체 고르기 · 찾기', (await page.getByTestId('site-picker').count()) === 1)
  await page.getByTestId('site-picker-search').fill('한솔정밀')
  check('1 찾기 → 한솔정밀(주) 한 줄', (await page.getByTestId('site-picker-item').count()) === 1)
  await page.getByTestId('site-picker-item').first().click()
  await page.waitForURL(/\/tools\/homepage\/build\?client=cli_site/)
  check('1 고르면 그 업체로(?client=cli_site)', page.url().includes('/tools/homepage/build?client=cli_site'))

  // 2 처음 카드
  await page.getByTestId('site-start').waitFor()
  const startText = await page.getByTestId('site-start').innerText()
  check('2 처음 카드 — 9가지 중 9가지 있음 · 업종 = 제조 · 생산(업체 기록으로 알아봄)', /9가지 중 9가지/.test(startText) && (await page.getByTestId('site-industry').inputValue()) === 'manufacturing' && /업체 기록으로 알아봄/.test(startText), startText.slice(0, 200))
  check('2 처음 카드 — 사업자번호 하이픈 · 담당자 휴대폰은 안 보임', /123-45-67890/.test(startText) && !/010-9999-8888/.test(startText))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-start-pc.png`, fullPage: true })

  // 3 초안
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await wait(700)
  const types = await page.locator('[data-block-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check('3 초안 — 맨 위 줄 처음 · 맨 아래 줄 끝 · 첫 화면 · 소개 · 숫자 · 사업 · 인증 · 순서 · 질문 · 문의 · 연락처', types[0] === 'header' && types.at(-1) === 'footer' && ['hero', 'about', 'numbers', 'services', 'certs', 'process', 'faq', 'cta', 'contact'].every((t) => types.includes(t)), types)
  const html = await frameHtml(page)
  check('3 미리보기 — 회사명 · 사업자등록번호 · 대표 전화 · 스크립트 0', html.includes('한솔정밀(주)') && html.includes('사업자등록번호 123-45-67890') && html.includes('031-123-4567') && !/<script/i.test(html))
  check('3 미리보기 — 숫자(업력 12년 · 42명) · 인증(이노비즈 · 기업부설연구소)', /12년/.test(html) && /42명/.test(html) && html.includes('이노비즈') && html.includes('기업부설연구소'))
  // D-205 모양 · 그림
  const look = await frameEval(page, (doc) => ({
    split: doc.querySelectorAll('section.hero.split').length,
    art: doc.querySelectorAll('.hero-art svg.art').length,
    hl: doc.querySelector('.hero h1 .hl')?.textContent ?? '',
    chips: [...doc.querySelectorAll('.hero .chips li')].map((li) => li.textContent),
    icw: doc.querySelectorAll('#services .icw svg.ic').length,
    cards: doc.querySelectorAll('#services .card').length,
    numband: doc.querySelectorAll('section.numband').length,
    kicker: [...doc.querySelectorAll('.kicker')].map((k) => k.textContent),
    mark: doc.querySelector('.logo .mark')?.textContent ?? '',
  }))
  check('3b 첫 화면 = 글 + 업종 그림 나란히 · 마지막 줄 강조 · 칩(설립 · 소재지 · 직원)', look.split === 1 && look.art === 1 && look.hl.length > 0 && look.chips.length === 3 && look.chips[0].startsWith('설립'), look)
  check('3b 사업 = 아이콘 카드(카드마다 아이콘) · 숫자 = 색 띠 · 구역 머리글 · 로고 글자', look.cards >= 2 && look.icw === look.cards && look.numband === 1 && look.kicker.includes('ABOUT') && look.kicker.includes('BUSINESS') && look.mark === '한', look)
  check('3 저장됨', await waitSaved(page))
  const firstSaved = await savedDoc(page)
  check('3 이 브라우저 모듈 기록(homepage · site)에 업체별 한 줄', firstSaved?.blocks?.length === types.length)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-builder-pc.png`, fullPage: false })

  // 4 새로고침
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('site-builder').waitFor()
  check('4 새로고침해도 그대로(처음 카드 아님 · 블록 수 같음)', (await page.getByTestId('site-start').count()) === 0 && (await page.locator('[data-block-row]').count()) === types.length)

  // 5 큰 문구 고치기
  await rowOf(page, 'hero').getByTestId('block-row').click()
  const heroEditor = rowOf(page, 'hero').getByTestId('block-editor')
  check('5 첫 화면 칸 — 큰 문구에 견본 표시', (await heroEditor.locator('[data-testid="field-sample"]').count()) >= 1)
  await heroEditor.locator('textarea[data-field="title"]').fill('정밀 부품은\n한솔정밀이 끝까지 책임집니다')
  await wait(900)
  check('5 미리보기에 바로 반영(줄바꿈 → <br> · 나란히 모양은 마지막 줄 강조색)', (await frameHtml(page)).includes('정밀 부품은<br><span class="hl">한솔정밀이 끝까지 책임집니다</span>'))
  const heroSample = await heroEditor.locator('[data-testid="field-sample"]').count()
  check('5 고친 칸은 견본 표시 빠짐(설명 칸은 남음)', heroSample === 1, heroSample)
  check('5 저장됨', await waitSaved(page))

  // 6 미리보기에서 블록 누르기
  await page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentDocument.querySelector('[data-block] h2')?.closest('[data-block]')?.scrollIntoView())
  const aboutId = await rowOf(page, 'about').getAttribute('data-block-row')
  await page.locator('[data-testid="site-frame"]').evaluate((f, id) => f.contentDocument.querySelector(`[data-block="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), aboutId)
  await wait(300)
  check('6 미리보기에서 회사 소개를 누르면 왼쪽 회사 소개가 열림', (await rowOf(page, 'about').getByTestId('block-row').getAttribute('aria-expanded')) === 'true')
  await wait(400)
  check('6 고른 블록 테두리(미리보기 CSS)', (await frameHtml(page)).includes(`[data-block="${aboutId}"]{box-shadow`))

  // 7 아래로 옮기기
  const before = await page.locator('[data-block-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  await rowOf(page, 'about').getByTestId('block-down').click()
  await wait(400)
  const after = await page.locator('[data-block-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check('7 [아래로] → 회사 소개가 한 칸 아래', after.indexOf('about') === before.indexOf('about') + 1, after)
  check('7 맨 위 줄 [위로] · [아래로] 꺼짐', await (async () => {
    await rowOf(page, 'header').getByTestId('block-row').click()
    const r = rowOf(page, 'header')
    return (await r.getByTestId('block-up').isDisabled()) && (await r.getByTestId('block-down').isDisabled()) && (await r.getByTestId('block-copy').count()) === 0
  })())

  // 8 휴대폰 숨김
  await rowOf(page, 'faq').getByTestId('block-row').click()
  await rowOf(page, 'faq').getByTestId('block-hide-mobile').check()
  await page.getByTestId('preview-mobile').click()
  await wait(900)
  const faqShown = await frameEval(page, (doc) => {
    const el = doc.querySelector('#faq')
    return el ? doc.defaultView.getComputedStyle(el).display : 'none-el'
  })
  check('8 휴대폰 숨김 → 휴대폰 미리보기(390폭)에서 질문 블록 안 보임', faqShown === 'none', faqShown)
  check('8 휴대폰 미리보기 = 390폭 iframe', (await page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentWindow.innerWidth)) === 390)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-mobile-preview-pc.png`, fullPage: false })
  await page.getByTestId('preview-pc').click()
  await wait(900)
  const faqPc = await frameEval(page, (doc) => doc.defaultView.getComputedStyle(doc.querySelector('#faq')).display)
  check('8 PC 미리보기(1280폭)에서는 보임', faqPc !== 'none', faqPc)
  check('8 목록에 [휴대폰 숨김] 표시', /휴대폰 숨김/.test(await rowOf(page, 'faq').getByTestId('block-row').innerText()))

  // 9 블록 더하기 — 연혁
  await page.getByTestId('block-add').click()
  const palette = await page.getByTestId('palette-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check('9 블록 고르기 — 맨 위 · 맨 아래 줄은 이미 있어 빠짐 · 13종(D-207 사진 모음 · 후기 · 로고 포함)', !palette.includes('header') && !palette.includes('footer') && palette.length === 13 && ['gallery', 'reviews', 'logos'].every((t) => palette.includes(t)), palette)
  await page.locator('[data-testid="palette-item"][data-type="history"]').click()
  await wait(500)
  const afterAdd = await page.locator('[data-block-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check('9 연혁이 고른 블록(질문) 바로 아래에', afterAdd.indexOf('history') === afterAdd.indexOf('faq') + 1, afterAdd)
  check('9 연혁 첫 줄 = 설립 연도(2014 · 한솔정밀(주) 설립)', (await rowOf(page, 'history').locator('input[aria-label="1번째 연도"]').inputValue()) === '2014' && /설립/.test(await rowOf(page, 'history').locator('input[aria-label="1번째 내용"]').inputValue()))

  // 10 지우기 → 되돌리기
  await rowOf(page, 'history').getByTestId('block-remove').click()
  check('10 지우기는 한 번 더 묻기', (await page.getByRole('dialog').filter({ hasText: '이 블록을 지울까요?' }).count()) === 1)
  await page.getByRole('button', { name: '지우기', exact: true }).click()
  await wait(400)
  check('10 지움', (await page.locator('[data-block-row][data-type="history"]').count()) === 0)
  await page.getByTestId('site-undo').click()
  await wait(400)
  check('10 [되돌리기] → 연혁 다시', (await page.locator('[data-block-row][data-type="history"]').count()) === 1)
  await page.getByTestId('site-redo').click()
  await wait(400)
  check('10 [다시 하기] → 다시 지워짐', (await page.locator('[data-block-row][data-type="history"]').count()) === 0)

  // 11 꾸밈
  await page.getByTestId('site-tab-style').click()
  await page.locator('[data-testid="theme-palette"][data-value="navy"]').click()
  await page.locator('[data-testid="theme-corner"][data-value="square"]').click()
  await wait(900)
  const css = await frameHtml(page)
  check('11 색 남색 · 모서리 각지게 → 미리보기 CSS 변수', css.includes('--p:#1e3a8a') && css.includes('--rb:4px'))
  check('11 검색 제목 칸 = 회사명 | 종목', /^한솔정밀\(주\) \| /.test(await page.getByTestId('seo-title').inputValue()))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-style-pc.png`, fullPage: false })

  // 12 점검
  await page.getByTestId('site-tab-checks').click()
  const checkKeys = await page.getByTestId('site-check').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-level')}:${e.getAttribute('data-key')}`))
  check('12 점검 — 꼭 고칠 것 0 · 견본 문구 확인 여럿', !checkKeys.some((k) => k.startsWith('must:')) && checkKeys.filter((k) => k.includes(':sample-')).length >= 4, checkKeys)
  check('12 머리 단추 = 확인할 것 n', /확인할 것 \d+/.test(await page.getByTestId('site-check-count').innerText()))
  await page.getByTestId('site-check').filter({ hasText: '첫 화면' }).getByTestId('check-open').click()
  await wait(300)
  check('12 점검 [열기] → 블록 탭 · 그 블록 열림', (await rowOf(page, 'hero').getByTestId('block-row').getAttribute('aria-expanded')) === 'true')
  await rowOf(page, 'hero').getByTestId('sample-confirm').click()
  await wait(300)
  check('12 [업체와 확인했어요] → 견본 배지 빠짐', !/견본/.test(await rowOf(page, 'hero').getByTestId('block-row').innerText()))

  // 13 공격 글
  await heroEditor.locator('textarea[data-field="title"]').fill('<img src=x onerror=alert(1)><script>alert(2)</script>')
  await rowOf(page, 'hero').locator('input[data-field="buttonLabel"]').fill('"><svg onload=alert(3)>')
  await wait(1200)
  const evil = await frameEval(page, (doc) => ({ img: doc.querySelectorAll('img[onerror], svg:not(.art):not(.ic), script, [onload], [onerror]').length, text: doc.querySelector('h1')?.textContent ?? '' }))
  check('13 공격 글 → 미리보기에 img/svg(우리 그림 · 아이콘 말고)/script · on 이벤트 0 · 글자로만 보임 · 알림창 0', evil.img === 0 && evil.text.includes('<img src=x onerror=alert(1)>') && dialogs === 0, evil)
  await heroEditor.locator('textarea[data-field="title"]').fill('정밀 부품은\n한솔정밀이 끝까지 책임집니다')
  await rowOf(page, 'hero').locator('input[data-field="buttonLabel"]').fill('견적 문의')
  await wait(400)

  // 13b 미리보기 크게(D-205) — 왼쪽 고치기 칸 접고 미리보기만 → 블록 누르면 고치기 칸 다시
  const wBefore = await page.getByTestId('site-preview').evaluate((e) => e.clientWidth)
  await page.getByTestId('preview-big').click()
  await wait(400)
  const wBig = await page.getByTestId('site-preview').evaluate((e) => e.clientWidth)
  check('13b [미리보기 크게] → 고치기 칸 접힘 · 미리보기가 넓어짐', (await page.getByTestId('site-blocks').count()) === 0 && wBig > wBefore + 300, { wBefore, wBig })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-big-pc.png`, fullPage: false })
  const svcId = await page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentDocument.querySelector('#services')?.getAttribute('data-block'))
  await page.locator('[data-testid="site-frame"]').evaluate((f, id) => f.contentDocument.querySelector(`[data-block="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), svcId)
  await wait(400)
  check('13b 크게 보다가 블록 누르기 → 고치기 칸 다시 · 그 블록 열림', (await page.getByTestId('site-blocks').count()) === 1 && (await rowOf(page, 'services').getByTestId('block-row').getAttribute('aria-expanded')) === 'true')
  await rowOf(page, 'services').locator('select[data-field="layout"]').selectOption('rows')
  await wait(700)
  check('13b 사업 모양 [번호 줄] → 미리보기 01 · 02 … · 아이콘 없음', (await frameEval(page, (doc) => doc.querySelectorAll('#services ol.rows li em').length)) >= 2 && (await frameEval(page, (doc) => doc.querySelectorAll('#services .icw').length)) === 0)
  await rowOf(page, 'services').locator('select[data-field="layout"]').selectOption('icons')
  await wait(400)

  // D-207 연락처 단추 · 휴대폰 고정 단추 · 바탕 · 사진 모음
  await rowOf(page, 'contact').getByTestId('block-row').click()
  await wait(300)
  check('D1 연락처 — 대표 전화가 있어 휴대폰 고정 단추가 처음부터 켜짐 · 미리보기에 전화 걸기', (await rowOf(page, 'contact').locator('input[data-field="floatBar"]').isChecked()) && (await frameEval(page, (doc) => doc.querySelector('nav.fbar a.fb-tel')?.textContent ?? '')) === '전화 걸기')
  await rowOf(page, 'contact').locator('input[data-field="kakaoUrl"]').fill('https://pf.kakao.com/_hansol')
  await wait(800)
  const kakao = await frameEval(page, (doc) => ({ box: doc.querySelector('#contact .cbtns a.kakao')?.getAttribute('href') ?? '', bar: doc.querySelector('nav.fbar a.kakao')?.textContent ?? '' }))
  check('D1 카카오톡 채널 주소 → 연락처에 [카카오톡 상담] · 고정 단추 둘째 칸도 카카오톡', kakao.box === 'https://pf.kakao.com/_hansol' && kakao.bar === '카카오톡 상담', kakao)
  await rowOf(page, 'contact').locator('input[data-field="formUrl"]').fill('javascript:alert(1)')
  await wait(800)
  check('D1 상담 신청서 주소가 https 가 아니면 단추 없음', (await frameEval(page, (doc) => [...doc.querySelectorAll('#contact .cbtns a')].map((a) => a.textContent))).every((t) => t !== '상담 신청하기'))
  await rowOf(page, 'contact').locator('input[data-field="formUrl"]').fill('')
  await rowOf(page, 'about').getByTestId('block-row').click()
  await wait(300)
  await rowOf(page, 'about').locator('select[data-field="bg"]').selectOption('dark')
  await wait(700)
  check('D2 회사 소개 바탕 [어둡게] → 미리보기 bg-dark · 글자 흰색', (await frameEval(page, (doc) => { const el = doc.querySelector('#about.bg-dark'); return el ? getComputedStyle(el.querySelector('h2')).color : '' })) === 'rgb(255, 255, 255)')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-pc-bg-dark.png`, fullPage: false })
  await rowOf(page, 'about').locator('select[data-field="bg"]').selectOption('auto')
  await wait(400)
  await page.getByTestId('block-add').click()
  await page.locator('[data-testid="palette-item"][data-type="gallery"]').click()
  await wait(600)
  check('D3 사진 모음 더하기 → 빈 칸 3개 · 채우기 전엔 미리보기에 안 나옴', (await rowOf(page, 'gallery').getByTestId('list-item').count()) === 3 && (await frameEval(page, (doc) => doc.querySelectorAll('#works').length)) === 0)
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 240 } })
  await rowOf(page, 'gallery').getByTestId('list-item').first().getByTestId('image-file').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: shot })
  await wait(900)
  await rowOf(page, 'gallery').getByTestId('list-item').first().locator('input[aria-label="1번째 제목(예: 동탄 아파트 욕실)"]').fill('자동차 부품 시제품')
  await wait(800)
  const gal = await frameEval(page, (doc) => ({ img: doc.querySelectorAll('#works .gm img').length, src: doc.querySelector('#works .gm img')?.getAttribute('src')?.slice(0, 15) ?? '', title: doc.querySelector('#works h3')?.textContent ?? '' }))
  check('D3 목록 안 사진 올리기 → 줄여서 들어감(data:image) · 제목 · 미리보기 사진 1장', gal.img === 1 && gal.src.startsWith('data:image/') && gal.title === '자동차 부품 시제품', gal)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-pc-gallery.png`, fullPage: false })
  await rowOf(page, 'gallery').getByTestId('list-item').nth(1).locator('input[aria-label="2번째 제목(예: 동탄 아파트 욕실)"]').fill('금형 수리')
  await wait(800)
  check('D3 사진 없는 칸 → 미리보기엔 아이콘 자리', (await frameEval(page, (doc) => doc.querySelectorAll('#works .gph').length)) === 1)
  // D-221 사진을 줄이는 동안(느린 휴대폰 흉내로 1.5초) 다른 칸에 적어도 — 사진이 들어올 때 적은 글이 옛 값으로 덮이지 않음
  await page.evaluate(() => {
    const Real = window.Image
    window.__RealImage = Real
    window.Image = function () {
      const el = new Real()
      let cb = null
      Object.defineProperty(el, 'onload', { set(f) { cb = f }, get() { return cb } })
      el.addEventListener('load', () => setTimeout(() => cb && cb(), 1500))
      return el
    }
  })
  await rowOf(page, 'gallery').getByTestId('list-item').nth(2).getByTestId('image-file').setInputFiles({ name: 'work3.png', mimeType: 'image/png', buffer: shot })
  await wait(200)
  await rowOf(page, 'gallery').locator('input[data-field="title"], textarea[data-field="title"]').first().fill('이런 일을 했어요')
  await rowOf(page, 'gallery').getByTestId('list-item').nth(1).locator('input[aria-label="2번째 제목(예: 동탄 아파트 욕실)"]').fill('금형 수리 · 재생')
  await wait(2600)
  await page.evaluate(() => {
    window.Image = window.__RealImage
  })
  await waitSaved(page)
  const galD = (await savedDoc(page))?.blocks.find((b) => b.type === 'gallery')?.props
  check('D221 사진 줄이는 중에 적은 칸 — 블록 제목 · 2번째 제목 그대로 · 3번째 사진도 들어감', galD?.title === '이런 일을 했어요' && galD?.items?.[1]?.title === '금형 수리 · 재생' && String(galD?.items?.[2]?.image ?? '').startsWith('data:image/'), { title: galD?.title, t2: galD?.items?.[1]?.title, img3: String(galD?.items?.[2]?.image ?? '').slice(0, 12) })
  await page.getByTestId('site-tab-checks').click()
  await wait(300)
  const galChecks = await page.getByTestId('site-check').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}|${e.textContent}`))
  check('D3 점검 — "사진 없는 칸 1개" 알림', galChecks.some((k) => k.startsWith('gallery-') && k.includes('사진 없는 칸 1개')), galChecks)
  await page.getByTestId('site-tab-blocks').click()
  await wait(300)

  // 14 내려받기
  await waitSaved(page)
  await page.evaluate(() => {
    window.__dl = []
    const orig = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__dl.push(this.download)
      return orig.call(this)
    }
  })
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('site-download').click()])
  const file = readFileSync(await dl.path(), 'utf8')
  const dlName = await page.evaluate(() => window.__dl[0])
  check('14 내려받기 이름 = 한솔정밀(주)-홈페이지.html', dlName === '한솔정밀(주)-홈페이지.html', dlName)
  check('14 내려받은 HTML — 완성 문서 · 회사명 · 고친 문구 · 스크립트 0 · 미리보기 표시(data-block) 없음', file.startsWith('<!doctype html>') && file.includes('한솔정밀(주)') && file.includes('끝까지 책임집니다') && !/<script/i.test(file) && !file.includes('data-block='))
  check('14 휴대폰 숨김 블록은 class hide-m 으로 들어감', /id="faq" class="[^"]*hide-m/.test(file))
  check('14 D-207 내려받은 HTML — 카카오톡 단추 · 고정 단추 · 사진 모음 · 탭 아이콘 · og:locale', file.includes('href="https://pf.kakao.com/_hansol"') && file.includes('<nav class="fbar"') && file.includes('id="works"') && file.includes('<link rel="icon" href="data:image/svg+xml,') && file.includes('og:locale'))

  // 15 업체 기록에 붙이기
  await page.getByTestId('tool-attach-quick').click()
  await wait(900)
  const attached = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_site')?.toolResults?.find((t) => t.toolKey === 'homepage'))
  check('15 업체 기록에 붙음 — 홈페이지 초안 · 다시 열기 주소', attached?.title === '홈페이지 초안' && attached?.openPath === '/tools/homepage/build?client=cli_site', attached)

  // 16 업체 상세 입구
  await page.goto(BASE + '/ops/clients/cli_site', { waitUntil: 'networkidle' })
  const entry = page.locator('a[href*="/tools/homepage/build?client=cli_site"]')
  check('16 업체 상세 모듈 입구에 홈페이지 [만들기](잘 안 쓰는 기능 안)', (await entry.count()) >= 1)

  // 17 대표 전화 없는 업체 → 담당자 번호 넣기
  await page.goto(BASE + '/tools/homepage/build?client=cli_site_np', { waitUntil: 'networkidle' })
  await page.getByTestId('site-start').waitFor()
  check('17 카페 → 업종 음식 · 카페 · 담당자 휴대폰은 저절로 안 넣는다는 안내', (await page.getByTestId('site-industry').inputValue()) === 'food' && /저절로 넣지 않아요/.test(await page.getByTestId('site-start').innerText()))
  // 17a 일부러 다른 업종(제조) 견본으로 만들면 → '맞는 견본으로 바꾸기' 안내(D-205)
  await page.getByTestId('site-industry').selectOption('manufacturing')
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await wait(300)
  check('17a 업체 기록(카페)과 다른 견본 → 맞는 견본 안내(음식 · 카페)', (await page.getByTestId('site-industry-mismatch').count()) === 1 && (await page.getByTestId('site-industry-mismatch').getAttribute('data-detected')) === 'food')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/site-mismatch-pc.png`, fullPage: false })
  await page.getByTestId('site-industry-fix').click()
  await page.getByRole('dialog').getByRole('button', { name: '다시 만들기' }).click()
  await wait(700)
  check('17a [맞는 견본으로 바꾸기] → 음식 견본(카페는 "한 잔" · D-220) · 안내 사라짐', (await page.getByTestId('site-industry-mismatch').count()) === 0 && (await frameHtml(page)).includes('한 잔'))
  await page.getByTestId('site-tab-checks').click()
  check('17 점검 — 대표 전화 없음 · [담당자 번호 넣기]', (await page.getByTestId('fix-contact-phone').count()) === 1)
  await page.getByTestId('fix-contact-phone').click()
  await wait(900)
  check('17 넣으면 미리보기에 전화 · 점검에서 빠짐', (await frameHtml(page)).includes('010-2222-3333') && (await page.getByTestId('fix-contact-phone').count()) === 0)

  check('18 화면 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ================================================================== */
/* D-208 점수 · 업종 맞춤 블록 · 디자인 한 번에                             */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`D208 pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/homepage/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-score').waitFor()
  await waitSaved(page)
  const score0 = Number(await page.getByTestId('site-score').getAttribute('data-score'))
  const next = await page.getByTestId('site-score-item').evaluateAll((els) => els.map((e) => [e.getAttribute('data-key'), e.textContent]))
  check('S1 홈페이지 점수 0~100 · 이것만 하면 3개(+점수 · 큰 것부터)', score0 > 0 && score0 < 100 && next.length === 3 && next.every(([, t]) => /^\+\d+/.test(t)) && Number(/\+(\d+)/.exec(next[0][1])[1]) >= Number(/\+(\d+)/.exec(next[2][1])[1]), { score0, next })
  if (SHOTS) await page.getByTestId('site-score').screenshot({ path: `${SHOTS}/site-d208-score.png` })
  await page.locator('[data-testid="site-score-item"][data-key="about"]').click()
  await wait(400)
  check('S2 점수 항목 누르기 → 그 블록(회사 소개)이 열림', (await rowOf(page, 'about').getByTestId('block-row').getAttribute('aria-expanded')) === 'true')
  await rowOf(page, 'about').getByTestId('sample-confirm').click()
  await waitSaved(page)
  await wait(300)
  const score1 = Number(await page.getByTestId('site-score').getAttribute('data-score'))
  check('S3 회사 소개 확인 → 점수 +10 이상', score1 - score0 >= 10, { score0, score1 })
  const sug = await page.getByTestId('site-suggest-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-type')))
  check('S4 제조 업종 맞춤 블록 — 거래처 로고 · 사진 모음 · 연혁(이유 한 줄)', ['logos', 'gallery', 'history'].every((x) => sug.includes(x)), sug)
  if (SHOTS) await page.getByTestId('site-suggest').screenshot({ path: `${SHOTS}/site-d208-suggest.png` })
  await page.locator('[data-testid="site-suggest-item"][data-type="gallery"]').getByTestId('site-suggest-add').click()
  await waitSaved(page)
  const doc1 = await savedDoc(page)
  const types1 = doc1.blocks.map((b) => b.type)
  check('S5 [넣기] → 사진 모음이 연락처 위에 · 열림 · 추천에서 빠짐', types1.indexOf('gallery') > 0 && types1.indexOf('gallery') < types1.indexOf('contact') && (await rowOf(page, 'gallery').getByTestId('block-row').getAttribute('aria-expanded')) === 'true' && (await page.locator('[data-testid="site-suggest-item"][data-type="gallery"]').count()) === 0, types1)

  await page.getByTestId('site-tab-style').click()
  const presets = await page.getByTestId('site-preset').evaluateAll((els) => els.map((e) => [e.getAttribute('data-value'), e.getAttribute('aria-pressed'), /이 업종 추천/.test(e.textContent)]))
  check('S6 디자인 한 번에 6가지 · 지금(자연스러운) 눌린 상태 · 제조 업종 추천 표시', presets.length === 6 && presets.find((x) => x[0] === 'nature')?.[1] === 'true' && presets.find((x) => x[0] === 'nature')?.[2] === true && presets.filter((x) => x[2]).length === 1, presets)
  if (SHOTS) await page.getByTestId('site-presets').screenshot({ path: `${SHOTS}/site-d208-presets.png` })
  await page.locator('[data-testid="site-preset"][data-value="premium"]').click()
  await waitSaved(page)
  await wait(600)
  const doc2 = await savedDoc(page)
  const html2 = await frameHtml(page)
  const hero2 = doc2.blocks.find((b) => b.type === 'hero')
  check('S7 고급스러운 → 와인색 · 명조 · 각지게 · 첫 화면 가운데 · 사업 카드 글 모양 · 미리보기에 바로', doc2.theme.palette === 'wine' && doc2.theme.font === 'serif' && doc2.theme.corner === 'square' && hero2.props.layout === 'band' && hero2.props.align === 'center' && doc2.blocks.find((b) => b.type === 'services').props.layout === 'plain' && html2.includes('#7f1d3f') && html2.includes('Noto Serif KR'), doc2.theme)
  check('S8 글 · 순서는 그대로(블록 순서 · 큰 문구 같음)', JSON.stringify(doc2.blocks.map((b) => b.id)) === JSON.stringify(doc1.blocks.map((b) => b.id)) && hero2.props.title === doc1.blocks.find((b) => b.type === 'hero').props.title)
  await page.getByTestId('site-undo').click()
  await waitSaved(page)
  await wait(500)
  const doc3 = await savedDoc(page)
  check('S9 되돌리기 한 번 → 원래 꾸밈(숲 · 고딕) · 첫 화면 모양 그대로', doc3.theme.palette === 'forest' && doc3.theme.font === 'sans' && doc3.blocks.find((b) => b.type === 'hero').props.layout === doc1.blocks.find((b) => b.type === 'hero').props.layout && (await page.locator('[data-testid="site-preset"][data-value="nature"]').getAttribute('aria-pressed')) === 'true', doc3.theme)
  await page.locator('[data-testid="site-preset"][data-value="warm"]').click()
  await waitSaved(page)
  const doc4 = await savedDoc(page)
  await page.getByTestId('site-tab-checks').click()
  const ck4 = await page.getByTestId('site-check').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check("S10 따뜻한 가게(사진 가득) — 첫 화면 사진이 없으면 색 바탕으로 · '사진 없음' 경고 0", doc4.theme.palette === 'sunset' && doc4.blocks.find((b) => b.type === 'hero').props.layout === 'band' && !ck4.some((k) => k?.startsWith('photo-')), { layout: doc4.blocks.find((b) => b.type === 'hero').props.layout, ck4 })
  // D-208 고침 — 저장이 실패하면(저장 공간 막힘 흉내) 실패 표시 · [지금 다시 저장] → 풀리면 저장됨
  await page.getByTestId('site-tab-style').click()
  await page.evaluate(() => {
    window.__realSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith('axmvp.module.homepage')) throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      return window.__realSet.call(this, k, v)
    }
  })
  await page.locator('[data-testid="site-preset"][data-value="modern"]').click()
  let errState = ''
  for (let i = 0; i < 30 && errState !== 'error'; i++) {
    await wait(100)
    errState = await page.getByTestId('site-save').getAttribute('data-state')
  }
  const retryShown = await page.getByTestId('site-save-retry').count()
  // D-221 저장 실패 중에 다른 화면으로 가려 하면 묻는다 → [남아서 다시 저장] 이면 그 자리에서 다시 저장
  await page.getByTestId('site-to-content').click()
  const leaveDlg = page.getByRole('dialog').filter({ hasText: '저장하지 못한 홈페이지가 있어요' })
  await leaveDlg.waitFor({ timeout: 5000 }).catch(() => {})
  const askedLeave = (await leaveDlg.count()) === 1 && /\/tools\/homepage\/build/.test(page.url())
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d221-site-leave.png`, fullPage: false })
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__realSet
  })
  if (askedLeave) await leaveDlg.getByRole('button', { name: '남아서 다시 저장' }).click()
  else await page.getByTestId('site-save-retry').click()
  await waitSaved(page)
  check('D221 저장 실패 중 다른 화면으로 → 묻는 창 · 이 화면 그대로 · [남아서 다시 저장] → 저장됨', askedLeave && /\/tools\/homepage\/build/.test(page.url()) && (await page.getByTestId('site-save').getAttribute('data-state')) === 'saved', { url: page.url() })
  const docR = await savedDoc(page)
  check('S12 저장 실패 → 실패 표시 · [지금 다시 저장] → 풀리면 저장됨(산뜻한 꾸밈이 남음)', errState === 'error' && retryShown === 1 && (await page.getByTestId('site-save').getAttribute('data-state')) === 'saved' && docR?.theme?.palette === 'ocean', { errState, retryShown, palette: docR?.theme?.palette })
  await page.getByTestId('site-to-content').click()
  await page.waitForURL(/\/tools\/content\/build\?client=cli_site/)
  check('S11 홈페이지 → 이 업체 홍보 글로 바로', /\/tools\/content\/build\?client=cli_site/.test(page.url()))
  await ctx.close()
}

/* ================================================================== */
/* D-220 잠재고객 · 컨설턴트 · 가상 업체 → 임시등록                          */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  await seed(page)
  await page.evaluate(() => {
    const k = 'axmvp.v1.operations_clients'
    const now = '2026-09-01T00:00:00.000Z'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !['cli_d220_lead', 'cli_d220_cons'].includes(r.id))
    list.push({ id: 'cli_d220_lead', companyName: '다온물산', status: 'waiting', businessItem: '산업용 포장재 도매', createdAt: now, updatedAt: now })
    list.push({ id: 'cli_d220_cons', companyName: '최동료 경영컨설턴트', status: 'active', clientType: 'consultant', createdAt: now, updatedAt: now })
    localStorage.setItem(k, JSON.stringify(list))
    for (const key of Object.keys(localStorage)) if (key.startsWith('axmvp.module.marketing') || key.startsWith('axmvp.module.content')) localStorage.removeItem(key)
  })
  const rows = (prefix) => page.evaluate((pre) => Object.keys(localStorage).filter((x) => x.startsWith(pre)).flatMap((k) => JSON.parse(localStorage.getItem(k) ?? '[]')), prefix)
  const clientRec = (id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === cid) ?? null, id)

  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  const groups = await page.getByTestId('site-picker-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))
  check('D220 고르기 — 계약 고객 · 잠재고객 · 컨설턴트가 나뉘어 보임 · 가상 업체 만들기 입구', groups.includes('contract') && groups.includes('lead') && groups.includes('consultant') && (await page.getByTestId('trial-start').count()) === 1, [...new Set(groups)])
  await page.locator('[data-testid="subject-filter"][data-filter="lead"]').click()
  const leads = await page.getByTestId('site-picker-item').allInnerTexts()
  check('D220 잠재고객만 거르기 → 다온물산 · 잠재고객 표시 · 계약 고객은 안 보임', leads.some((t) => t.includes('다온물산') && t.includes('잠재고객')) && !leads.some((t) => t.includes('한솔정밀')), leads)
  await page.locator('[data-testid="subject-filter"][data-filter="consultant"]').click()
  await page.getByTestId('site-picker-item').first().click()
  await page.getByTestId('site-start').waitFor()
  check('D220 컨설턴트 고객 → 개인 컨설턴트 견본으로 알아봄', (await page.getByTestId('site-industry').inputValue()) === 'consultant', await page.getByTestId('site-industry').inputValue())

  // 가상 업체 — 고객 관리에 없는 곳
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  await page.getByTestId('trial-new-company').click()
  await page.getByTestId('trial-form').waitFor()
  const saveOff = await page.getByTestId('trial-save').isDisabled()
  await page.locator('[data-testid="trial-sample"][data-sample="bakery"]').click()
  await page.getByTestId('trial-requestedBy').fill('최동료 컨설턴트')
  check('D220 가상 업체 창 — 이름 없으면 저장 꺼짐 · 예시 누르면 칸 채움', saveOff && (await page.getByTestId('trial-name').inputValue()) === '봄날베이커리' && (await page.getByTestId('trial-region').inputValue()).includes('수원'))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d220-trial-form.png`, fullPage: false })
  await page.getByTestId('trial-save').click()
  await page.waitForURL(/\/tools\/homepage\/build\?trial=trial_/)
  await page.getByTestId('trial-banner').waitFor()
  const trialId = new URL(page.url()).searchParams.get('trial')
  const bannerText = await page.getByTestId('trial-banner').innerText()
  check('D220 바로 가상 업체 화면 — 띠(이름 · 고객 관리에 없음 · 부탁한 사람) · 업체 띠 없음', bannerText.includes('봄날베이커리') && bannerText.includes('고객 관리에는 없어요') && bannerText.includes('최동료') && (await page.getByTestId('tool-client-banner').count()) === 0, bannerText)
  await page.getByTestId('site-start').waitFor()
  check('D220 가상 빵집 → 음식 견본으로 알아봄', (await page.getByTestId('site-industry').inputValue()) === 'food')
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await waitSaved(page)
  const thtml = await frameHtml(page)
  const trow = (await rows('axmvp.module.homepage.site')).find((r) => r.data?.trialId === trialId)
  check('D220 가상 업체 초안 — 미리보기 이름 · 전화 · 스크립트 0 · 저장은 업체 칸 비우고 내용에 가상 id · 업체에 붙이기 단추 없음', thtml.includes('봄날베이커리') && thtml.includes('031-123-4567') && !/<script/i.test(thtml) && !!trow && trow.clientId === '' && (await page.getByTestId('tool-attach-open').count()) === 0 && (await page.getByTestId('tool-attach-quick').count()) === 0, { clientId: trow?.clientId })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d220-trial-build.png`, fullPage: false })
  await page.getByTestId('site-to-content').click()
  await page.waitForURL(/\/tools\/content\/build\?trial=/)
  // 주소는 바로 바뀌지만 앞 화면 띠가 잠깐 남는다 — 홍보 글 화면이 뜰 때까지
  await page.getByTestId('content-studio').waitFor({ timeout: 15000 }).catch(() => {})
  await page.getByTestId('trial-banner').waitFor()
  check('D220 이 업체 홍보 글 → 같은 가상 업체로(?trial=) · 띠 그대로', page.url().includes(`trial=${trialId}`) && (await page.getByTestId('content-studio').count()) === 1, { url: page.url(), trialId, studio: await page.getByTestId('content-studio').count(), body: (await page.locator('main').innerText()).slice(0, 300) })
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  await page.locator('[data-testid="subject-filter"][data-filter="trial"]').click()
  const trials = await page.getByTestId('site-picker-item').allInnerTexts()
  check('D220 목록 › 가상 — 봄날베이커리 · 가상 업체 · 만든 홈페이지 있음', trials.length === 1 && trials[0].includes('봄날베이커리') && trials[0].includes('가상 업체') && trials[0].includes('만든 홈페이지 있음'), trials)

  // 임시등록
  await page.getByTestId('site-picker-item').first().click()
  await page.getByTestId('trial-banner').waitFor()
  await page.getByTestId('trial-register').click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  const dlgText = await dlg.innerText()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d220-register-confirm.png`, fullPage: false })
  await dlg.getByRole('button', { name: '임시등록', exact: true }).click()
  await page.waitForURL(/\/tools\/homepage\/build\?client=/, { timeout: 8000 })
  const newId = new URL(page.url()).searchParams.get('client')
  await page.getByTestId('site-builder').waitFor()
  const rec = await clientRec(newId)
  const moved = (await rows('axmvp.module.homepage.site')).find((r) => r.id === trow?.id)
  check('D220 임시등록 → 묻고(잠재고객으로) · 그 업체 화면 · 만든 홈페이지 그대로(처음 카드 아님)', dlgText.includes('잠재고객') && (await page.getByTestId('site-start').count()) === 0 && (await page.getByTestId('tool-client-banner').innerText()).includes('봄날베이커리'), dlgText.slice(0, 120))
  check('D220 고객 관리 기록 — 계약 전(잠재) · 임시등록 표시 · 부탁한 사람 · 대표 · 주소 · 종목 · 기록 한 줄', rec?.status === 'waiting' && rec?.provisional?.requestedBy === '최동료 컨설턴트' && rec?.representativeName === '김봄날' && rec?.businessAddress?.includes('수원') && rec?.businessItem?.includes('빵') && rec?.activity?.[0]?.text?.includes('임시등록'), { status: rec?.status, prov: rec?.provisional })
  check('D220 만든 홈페이지 줄이 그 업체로 옮겨짐(가상 id 빠짐 · 같은 줄)', moved?.clientId === newId && !moved?.data?.trialId)
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  const counts = await page.getByTestId('subject-filter').allInnerTexts()
  await page.locator('[data-testid="subject-filter"][data-filter="lead"]').click()
  const leads2 = await page.getByTestId('site-picker-item').allInnerTexts()
  check('D220 목록 — 가상에서 빠지고 잠재고객에 임시등록 표시로', counts.some((t) => /가상\s*0/.test(t)) && leads2.some((t) => t.includes('봄날베이커리') && t.includes('임시등록')), { counts, leads2 })

  // 업체 상세 — 임시등록 표시 · 지우기
  await page.goto(`${BASE}/ops/clients/${newId}`, { waitUntil: 'networkidle' })
  const hadBadge = (await page.getByTestId('client-provisional-badge').count()) === 1
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d220-client-badge.png`, fullPage: false })
  await page.getByRole('button', { name: /더보기/ }).first().click()
  await page.getByTestId('more-clear-provisional').click()
  await wait(500)
  check('D220 업체 상세 — 임시등록 표시 · 더보기 [표시 지우기] → 사라짐(기록은 그대로)', hadBadge && (await page.getByTestId('client-provisional-badge').count()) === 0 && (await clientRec(newId))?.provisional === undefined && (await clientRec(newId))?.companyName === '봄날베이커리')

  // 가상 컨설턴트 → 개인 컨설턴트 견본 · 지우기
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  await page.getByTestId('trial-new-consultant').click()
  await page.locator('[data-testid="trial-sample"][data-sample="consultant"]').click()
  await page.getByTestId('trial-save').click()
  await page.waitForURL(/\?trial=trial_/)
  await page.getByTestId('site-start').waitFor()
  const cTrial = new URL(page.url()).searchParams.get('trial')
  check('D220 가상 컨설턴트(동료) → 개인 컨설턴트 견본', (await page.getByTestId('site-industry').inputValue()) === 'consultant' && (await page.getByTestId('trial-banner').getAttribute('data-kind')) === 'consultant')
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await waitSaved(page)
  await page.getByTestId('trial-delete').click()
  await page.getByRole('dialog').getByRole('button', { name: '지우기', exact: true }).click()
  await page.waitForURL(/\/tools\/homepage$/)
  const leftovers = (await rows('axmvp.module.')).filter((r) => r.id === cTrial || r.data?.trialId === cTrial)
  check('D220 가상 지우기 — 한 번 더 묻고 · 프로필 · 만든 홈페이지 모두 지움 · 목록으로', leftovers.length === 0, leftovers.length)
  await ctx.close()
}

/* ================================================================== */
/* 휴대폰 390 · 360                                                     */
/* ================================================================== */
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${width} pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/homepage/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('site-start').waitFor()
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`M${width} 처음 카드 가로 넘침 0`, (await over()) <= 0, await over())
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  check(`M${width} [고치기 | 미리보기] 둘로 나뉨`, (await page.getByTestId('pane-edit').count()) === 1 && (await page.getByTestId('site-preview').count()) === 0)
  await rowOf(page, 'hero').getByTestId('block-row').click()
  check(`M${width} 고치기 화면 가로 넘침 0`, (await over()) <= 0, await over())
  const small = await page.locator('[data-testid="site-builder"] button:visible, [data-testid="site-builder"] a:visible').evaluateAll((els) =>
    els
      .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h > 0 && x.h < 40),
  )
  check(`M${width} 누르는 것 40px 이상(44 기준 · 테두리 오차)`, small.length === 0, small)
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/site-edit-m390.png`, fullPage: false })
  // D-208 점수 · 디자인 한 번에 — 휴대폰 넘침 0 · 누르는 것 44px
  await page.getByTestId('site-tab-style').click()
  await page.getByTestId('site-presets').waitFor()
  const presetH = await page.getByTestId('site-preset').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  const scoreH = await page.getByTestId('site-score-item').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M${width} D-208 점수 · 스타일 6 — 넘침 0 · 44px 이상`, (await over()) <= 0 && presetH.length === 6 && presetH.every((h) => h >= 44) && scoreH.length === 3 && scoreH.every((h) => h >= 44), { presetH, scoreH })
  if (SHOTS && width === 390) {
    await page.getByTestId('site-score').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/site-m390-score.png`, fullPage: false })
  }
  await page.getByTestId('site-tab-blocks').click()
  await page.getByTestId('pane-preview').click()
  await page.getByTestId('preview-mobile').click()
  await wait(1000)
  check(`M${width} 미리보기 — 휴대폰 390폭 · 화면 안에 맞춤 · 넘침 0`, (await page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentWindow.innerWidth)) === 390 && (await over()) <= 0)
  const inner = await frameEval(page, (doc) => doc.documentElement.scrollWidth - doc.defaultView.innerWidth)
  check(`M${width} 만든 홈페이지(휴대폰 폭) 가로 넘침 0`, inner <= 0, inner)
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/site-preview-m390.png`, fullPage: false })
  // 미리보기에서 블록 누르기 → 고치기 화면으로
  const contactId = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('axmvp.module.homepage.site'))
    return JSON.parse(localStorage.getItem(k) ?? '[]')[0]?.data?.doc?.blocks?.find((b) => b.type === 'contact')?.id
  })
  if (contactId) {
    await page.locator('[data-testid="site-frame"]').evaluate((f, id) => f.contentDocument.querySelector(`[data-block="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), contactId)
    await wait(400)
    check(`M${width} 미리보기에서 연락처 누르기 → 고치기 화면 · 연락처 열림`, (await page.getByTestId('pane-edit').getAttribute('aria-pressed')) === 'true' && (await rowOf(page, 'contact').getByTestId('block-row').getAttribute('aria-expanded')) === 'true')
  } else check(`M${width} 미리보기에서 연락처 누르기`, false, 'no contact id (not saved yet)')
  // D-220 휴대폰 — 누구 것 고르기 · 가상 업체 창 · 띠(홈페이지 · 홍보 글)
  await page.goto(BASE + '/tools/homepage', { waitUntil: 'networkidle' })
  await page.getByTestId('site-picker-item').first().waitFor()
  const chipH = await page.locator('[data-testid="subject-filter"], [data-testid="trial-new-company"], [data-testid="trial-new-consultant"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M${width} D220 고르기 — 넘침 0 · 거르기 칩 5 · 가상 입구 2 · 모두 44px 이상`, (await over()) <= 0 && chipH.length === 7 && chipH.every((h) => h >= 44), { over: await over(), chipH })
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/d220-picker-m390.png`, fullPage: false })
  await page.getByTestId('trial-new-consultant').click()
  await page.getByTestId('trial-form').waitFor()
  await page.locator('[data-testid="trial-sample"][data-sample="consultant"]').click()
  check(`M${width} D220 가상 창 — 넘침 0 · 예시 채움(컨설턴트)`, (await over()) <= 0 && (await page.getByTestId('trial-name').inputValue()) === '정다온 경영컨설턴트')
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/d220-form-m390.png`, fullPage: false })
  await page.getByTestId('trial-save').click()
  await page.getByTestId('trial-banner').waitFor()
  await page.getByTestId('site-start').waitFor()
  const bannerH = await page.locator('[data-testid="trial-banner"] button:visible, [data-testid="trial-banner"] a:visible').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M${width} D220 가상 컨설턴트 띠 — 넘침 0 · 단추 44px 이상 · 개인 컨설턴트 견본`, (await over()) <= 0 && bannerH.length >= 4 && bannerH.every((h) => h >= 44) && (await page.getByTestId('site-industry').inputValue()) === 'consultant', { bannerH })
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/d220-banner-m390.png`, fullPage: false })
  const mTrial = new URL(page.url()).searchParams.get('trial')
  await page.goto(BASE + `/tools/content/build?trial=${mTrial}`, { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  check(`M${width} D220 같은 가상으로 홍보 글 — 띠 · 넘침 0`, (await page.getByTestId('trial-banner').count()) === 1 && (await over()) <= 0, await over())
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/d220-content-m390.png`, fullPage: false })
  await ctx.close()
}
check('19 휴대폰 화면 오류 0', errors.length === 0, errors)

// D-226 — 색: 홈페이지는 초록. 처음 카드 · 편집 머리 띠 · 블록마다 색 아이콘 · 고른 탭 · 블록 더하기 창
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`D226 pageerror ${e.message}`))
  const chroma = (sel) =>
    p.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el)
      const s = `${cs.backgroundImage} ${cs.backgroundColor}`
      let best = 0
      for (const m of s.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)/g)) best = Math.max(best, Number(m[2]))
      for (const m of s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
        const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255)
        const mx = Math.max(r, g, b)
        best = Math.max(best, mx === 0 ? 0 : ((mx - Math.min(r, g, b)) / mx) * 0.4)
      }
      return best
    })
  await seed(p)
  await p.goto(BASE + '/tools/homepage/build?client=cli_site', { waitUntil: 'networkidle' })
  await p.getByTestId('site-start').waitFor()
  const startC = await chroma('[data-testid="site-start"] > div')
  const startTxt = await p.getByTestId('site-start').innerText()
  check(`H1 처음 카드 머리 띠 — 초록 그라데이션(채도 ${startC.toFixed(2)}) · 채울 수 있는 것 n/9`, startC > 0.09 && /\d\/9/.test(startTxt), startC)
  check('H1 [초안 만들기] — 테마 색이 아니라 초록', (await chroma('[data-testid="site-create"]')) > 0.09)
  await p.getByTestId('site-create').click()
  await p.getByTestId('site-hero').waitFor()
  const score = await p.getByTestId('site-score').getAttribute('data-score')
  check('H2 편집 머리 띠 — 보이는 블록 · 점수(아래 점수 카드와 같은 숫자) · 점검', (await p.getByTestId('site-stat-score').innerText()).includes(`${score}점`) && /\d+개/.test(await p.getByTestId('site-stat-blocks').innerText()) && (await chroma('[data-testid="site-hero"]')) > 0.09, score)
  const rowN = await p.getByTestId('block-row').count()
  const rowIco = await p.locator('[data-testid="block-row"] > span:first-child > span[aria-hidden="true"]:first-child').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
  check(`H3 블록 ${rowN}줄 모두 색 아이콘 · 블록 종류마다 색 여러 가지`, rowIco.length === rowN && new Set(rowIco).size >= 5, rowIco.length)
  check('H3 고른 탭(블록) — 초록 바탕', (await chroma('[data-testid="site-tab-blocks"]')) > 0.09)
  await p.getByTestId('block-add').click()
  const palN = await p.getByTestId('palette-item').count()
  const palIco = await p.locator('[data-testid="palette-item"] svg').count()
  check('H4 블록 더하기 창 — 항목마다 색 아이콘', palN > 0 && palIco >= palN, { palN, palIco })
  check('H5 D-226 화면 오류 0', !errors.some((e) => e.startsWith('D226')), errors.filter((e) => e.startsWith('D226')))
  await ctx.close()
}

await browser.close()
console.log(`\n홈페이지 만들기 e2e: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
