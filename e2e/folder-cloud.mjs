/**
 * 서류함 '폴더로 보기' 시험 (D-204) — 클라우드 모드(Supabase 흉내)에서 진짜 화면을 누른다.
 *
 *   [목차로 보기 | 폴더로 보기] — 처음은 목차 · 바꾸면 새로고침해도 기억
 *   맨 위: 폴더(비원미래) + 폴더 없이 올린 파일 · 폴더 누르기 → 안으로 · 빵 부스러기 · 위로
 *   PDF 첫 장 · 사진은 작은 그림(서명 주소로 받아 그림) · 한글(HWP)은 종류 아이콘
 *   파일 누르기 → 서류 칸 · 폴더 · 올린 날 · [미리보기] · [목차에서 이 칸 보기]
 *   [폴더째 고르기]로 폴더를 올리면 원래 폴더 경로가 업체 기록에 남고 폴더 보기에 그대로 나온다
 *   저장소는 비공개 그대로(공개 주소 0) · 휴대폰 390 넘침 0
 *
 *   node e2e/folder-cloud.mjs [--shots <dir>]      (dist-qa-folder 로 따로 빌드하고 4536 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { deflateSync } from 'node:zlib'
import { join } from 'node:path'

const REF = 'qaproject'
const PORT = 4536
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-folder'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 300)}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, {
  stdio: 'ignore',
  env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' },
})
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => {
  try {
    process.kill(-server.pid)
  } catch {
    /* 이미 꺼짐 */
  }
}
for (let i = 0; i < 40; i += 1) {
  try {
    if ((await fetch(BASE)).ok) break
  } catch {
    /* 아직 */
  }
  await wait(250)
}

const WS = '11111111-1111-4111-8111-111111111111'
const OWNER = '00000000-0000-4000-8000-000000000001'
const CID = 'cli_folder'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

// 40×40 단색 PNG(직접 만든다) · 글자가 있는 작은 PDF
function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function solidPng(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const PNG = solidPng(40, 40, [220, 60, 60])
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 260]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 20 200 Td (BIZ REG) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
)
const d = (path, fileName, folderPath, extra = {}) => ({ received: true, issuedAt: '', fileName, fileSize: 1024, storagePath: `${WS}/${CID}/${path}`, folderPath, updatedAt: '2026-10-10T09:00:00.000Z', ...extra })
let row = {
  id: CID,
  workspace_id: WS,
  company_name: '비원미래(주)',
  status: 'active',
  next_action: '',
  next_action_due_date: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
  payload: {
    businessNumber: '123-45-67890',
    representativeName: '송대표',
    documents: {
      businessRegistration: d('businessRegistration/a-biz.pdf', '사업자등록증.pdf', '비원미래', { issuedAt: '2026-04-10' }),
      corporateRegistry: d('corporateRegistry/b-reg.png', '법인등기부등본 캡쳐.png', '비원미래/정관 개정_260410'),
      customdoc_hwp: d('customdoc_hwp/c-plan.hwp', '특허명세서_260601.hwp', '비원미래/정관 개정_260410'),
      financialStatements: d('financialStatements/d-fin.pdf', '2025년 재무제표.pdf', '비원미래/재무'),
      payrollRoster: d('payrollRoster/e-roster.xlsx', '4대보험 가입자명부.xlsx', ''),
    },
    customDocuments: [{ id: 'cd1', key: 'customdoc_hwp', label: '특허명세서', validMonths: null, sensitive: false }],
  },
}
const signed = []
const publicHits = []
const uploads = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
async function newCtx(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  await ctx.addInitScript(([ref, s, ws]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
  }, [REF, session, WS])
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    const method = req.method()
    if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (path.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json('full'))
    if (path.includes('/storage/v1/object/public/')) {
      publicHits.push(path)
      return route.fulfill({ status: 400, body: 'private bucket' })
    }
    if (method === 'POST' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
      signed.push(key)
      return route.fulfill(json({ signedURL: `/object/sign/client-documents/${encodeURI(key)}?token=qa-${signed.length}` }))
    }
    if (method === 'GET' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
      const body = key.endsWith('.png') ? PNG : key.endsWith('.pdf') ? PDF : Buffer.from('OTHER-BYTES')
      const type = key.endsWith('.png') ? 'image/png' : key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
      return route.fulfill({ status: 200, headers: { 'content-type': type, 'access-control-allow-origin': '*' }, body })
    }
    if (method === 'POST' && path.startsWith('/storage/v1/object/client-documents/')) {
      uploads.push(path.slice('/storage/v1/object/client-documents/'.length))
      return route.fulfill(json({ Key: path.slice('/storage/v1/object/'.length) }))
    }
    if (path.includes('/rest/v1/workspace_members')) {
      return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    }
    if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    if (path.includes('/rest/v1/operations_clients')) {
      if (method === 'PATCH' || method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        row = { ...row, ...(Array.isArray(body) ? body[0] : body), updated_at: new Date().toISOString() }
      }
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return route.fulfill(json(single ? row : [row]))
    }
    return route.fulfill(json([]))
  })
  return ctx
}

const errors = []
// 이 시험 환경은 바깥 CDN 에 못 나간다 — 사진 글자 인식(tesseract) 일꾼을 못 받아 생기는 오류만 뺀다(실제 사용자 PC 는 받는다 · files-cloud 와 같음)
const realErrors = () => errors.filter((e) => !/tesseract\.js@.*worker\.min\.js/.test(e))
const ctx = await newCtx({ width: 1440, height: 900 })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
try {
  await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
  await page.getByTestId('doc-view-switch').waitFor({ timeout: 10000 })
  check('1 서류 탭 — 처음은 목차로 보기(지금까지와 같음)', (await page.getByTestId('doc-view-list').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('folder-view').count()) === 0)

  await page.getByTestId('doc-view-folder').click()
  await page.getByTestId('folder-view').waitFor()
  const rootFolders = await page.getByTestId('folder-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  const rootFiles = await page.getByTestId('folder-file').allInnerTexts()
  check('2 폴더로 보기 — 맨 위: 폴더 비원미래 · 폴더 없이 올린 명부 · 안내 한 줄', JSON.stringify(rootFolders) === '["비원미래"]' && rootFiles.length === 1 && rootFiles[0].includes('4대보험 가입자명부.xlsx') && /폴더 밖에 있는 파일/.test(await page.getByTestId('folder-view').innerText()), { rootFolders, rootFiles })
  check('2 폴더 아이콘에 파일 수(아래 전부 4개)', /파일 4개/.test(await page.getByTestId('folder-item').first().innerText()))
  check('2 엑셀은 종류 아이콘(XLSX)', /XLSX/.test(rootFiles[0]))

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('doc-view-switch').waitFor()
  check('3 새로고침해도 폴더로 보기 기억', (await page.getByTestId('doc-view-folder').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('folder-view').count()) === 1)

  await page.getByTestId('folder-item').filter({ hasText: '비원미래' }).click()
  await wait(300)
  const crumbs = await page.getByTestId('folder-crumb').allInnerTexts()
  const sub = await page.getByTestId('folder-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  check('4 비원미래 안 — 빵 부스러기 서류함 › 비원미래 · 하위 폴더 2(이름 순) · 파일 1', crumbs.join('>') === '서류함>비원미래' && sub.join('|') === '재무|정관 개정_260410' && (await page.getByTestId('folder-file').count()) === 1, { crumbs, sub })
  await page.getByTestId('folder-thumb').first().waitFor({ timeout: 10000 }).catch(() => {})
  const pdfThumb = await page.getByTestId('folder-thumb').first().getAttribute('src').catch(() => null)
  check('5 PDF 첫 장이 작은 그림으로(서명 주소로 받아 그림)', !!pdfThumb && pdfThumb.startsWith('data:image/jpeg'), (pdfThumb ?? '').slice(0, 40))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/folder-pc-inside.png` })

  await page.getByTestId('folder-item').filter({ hasText: '정관 개정_260410' }).click()
  await wait(300)
  await page.getByTestId('folder-thumb').first().waitFor({ timeout: 10000 }).catch(() => {})
  const files = await page.getByTestId('folder-file').allInnerTexts()
  check('6 정관 개정 안 — 사진(작은 그림) · 한글(HWP 아이콘)', files.length === 2 && (await page.getByTestId('folder-thumb').count()) === 1 && files.some((t) => t.includes('HWP') && t.includes('특허명세서_260601.hwp')), files)

  await page.getByTestId('folder-file').filter({ hasText: '법인등기부등본' }).click()
  const sheet = page.getByTestId('folder-file-sheet')
  await sheet.waitFor()
  const st = await sheet.innerText()
  check('7 파일 누르기 → 서류 칸 · 폴더 · 올린 날', /법인등기부/.test(st) && st.includes('비원미래/정관 개정_260410') && st.includes('2026.10.10'), st.slice(0, 200))
  await sheet.getByRole('button', { name: /미리보기/ }).first().click()
  await page.getByTestId('file-preview').waitFor({ timeout: 8000 })
  check('7 [미리보기] → OS 안에서 사진', (await page.getByTestId('file-preview').locator('img').count()) === 1)
  await page.keyboard.press('Escape')
  await wait(300)
  if ((await page.getByTestId('file-preview').count()) > 0) await page.getByTestId('file-preview').getByRole('button', { name: /닫기/ }).first().click().catch(() => {})
  await wait(300)
  if ((await sheet.count()) === 0) await page.getByTestId('folder-file').filter({ hasText: '법인등기부' }).click()
  await page.getByTestId('folder-show-in-list').click()
  await wait(600)
  check('8 [목차에서 이 칸 보기] → 목차로 · 그 칸이 보임', (await page.getByTestId('doc-view-list').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-doc-card="corporateRegistry"]').isVisible()))

  await page.getByTestId('doc-view-folder').click()
  await page.getByTestId('folder-view').waitFor()
  check('9 다시 폴더로 — 맨 위부터', (await page.getByTestId('folder-view').getAttribute('data-path')) === '')

  // 10 폴더째 올리기 → 폴더 경로가 남는다
  const dir = mkdtempSync(join(tmpdir(), 'qa-folder-'))
  mkdirSync(join(dir, '새봄상사', '인증서'), { recursive: true })
  writeFileSync(join(dir, '새봄상사', '인증서', '벤처기업확인서.png'), PNG)
  writeFileSync(join(dir, '새봄상사', '회사소개서.pdf'), PDF)
  await page.getByRole('button', { name: '한꺼번에 올리기' }).click()
  await page.locator('input[aria-label="서류 폴더 고르기"]').setInputFiles(join(dir, '새봄상사'))
  await page.waitForTimeout(4000)
  const upBtn = page.getByRole('button', { name: /올리기/ }).filter({ hasText: /(고른|전부|모두|\d+개)/ }).first()
  if (await upBtn.count()) await upBtn.click()
  await page.waitForTimeout(3000)
  const folderPaths = Object.values(row.payload?.documents ?? {}).map((x) => `${x?.fileName}|${x?.folderPath ?? ''}`)
  check('10 [폴더째 고르기] → 올린 파일에 원래 폴더 경로가 남음(새봄상사 · 새봄상사/인증서)', folderPaths.some((x) => x === '회사소개서.pdf|새봄상사') && folderPaths.some((x) => x === '벤처기업확인서.png|새봄상사/인증서'), folderPaths)
  await page.keyboard.press('Escape').catch(() => {})
  await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
  await page.getByTestId('folder-view').waitFor({ timeout: 10000 })
  check('10 폴더 보기 맨 위에 새봄상사 폴더가 생김', (await page.getByTestId('folder-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))).includes('새봄상사'))

  check('11 저장소는 비공개 그대로(공개 주소 0) · 작은 그림도 서명 주소로', publicHits.length === 0 && signed.some((k) => k.endsWith('a-biz.pdf')))
  check('12 화면 오류 0', realErrors().length === 0, realErrors())
} finally {
  await ctx.close()
}

// 휴대폰 390
const m = await newCtx({ width: 390, height: 844 }, true)
const mp = await m.newPage()
mp.on('pageerror', (e) => errors.push(`390 ${e}`))
try {
  await mp.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
  await mp.getByTestId('doc-view-switch').waitFor({ timeout: 10000 })
  await mp.getByTestId('doc-view-folder').click()
  await mp.getByTestId('folder-item').filter({ hasText: '비원미래' }).click()
  await mp.getByTestId('folder-thumb').first().waitFor({ timeout: 10000 }).catch(() => {})
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('M390 폴더 보기 — 한 줄에 3칸 · 가로 넘침 0', over <= 0 && (await mp.getByTestId('folder-grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)) === 3, over)
  const small = await mp.locator('[data-testid="folder-view"] button:visible').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)).filter((h) => h > 0 && h < 44))
  check('M390 누르는 곳 44px 이상', small.length === 0, small)
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/folder-m390.png` })
  check('M390 화면 오류 0', realErrors().length === 0, realErrors())
} finally {
  await m.close()
  await browser.close()
  stop()
}
console.log(`\n서류함 폴더 보기: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
