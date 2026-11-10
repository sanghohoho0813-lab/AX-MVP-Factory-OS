/**
 * qa:originals — D-549 SAFE-5 서류 원본 묶음(ZIP) · 클라우드 흉내(Supabase 응답을 흉내 낸 진짜 화면).
 *
 *   업체 서류함 [원본 내려받기] → 판 [전부 n개] → 압축 파일 하나 — 안의 이름 = 서류 칸 이름 · (2) · 목록.txt(원래 이름 · 발급일 · 못 담은 파일 까닭)
 *   보관함에서 지워진 파일 하나 → 그 파일만 건너뛰고 나머지는 담김 · 끝 한 줄에 '1개는 담지 못했어요'
 *   [정책자금 신청 서류만 m개] → 사업자등록증 · 재무제표는 들고 · 용역 계약서 · 현장 사진은 없음
 *   더보기 › [서류 원본 한 번에 내려받기] 도 같은 판
 *   설정 › 데이터 [서류 원본 파일 전부] → 업체마다 폴더 · 맨 위 목록.txt
 *   읽기만 — 업체 기록 저장(PATCH) 0 · 보관함 지우기 0 · 공개 주소 0
 *   이 기기 모드(클라우드 아님)에는 단추가 없다(로컬 빌드는 qa:detail 이 본다 — 여기서는 원본 없는 업체에 단추 없음)
 *
 *   node e2e/docoriginals-cloud.mjs      (dist-qa-originals 로 따로 빌드 · 4583)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const REF = 'qaproject'
const PORT = 4583
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-originals'
const SHOTS = '/tmp/claude-0/originals'
mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600)}`)
}

// 압축 풀기는 앱과 같은 zip.ts 를 node 에서 — 시험이 따로 만든 풀기가 아니라 같은 규칙으로
// 이 프로젝트의 vite 로 묶는다(따로 받는 도구 없이)
const { build } = await import('vite')
await build({ logLevel: 'silent', configFile: false, build: { outDir: '.originals-out', emptyOutDir: true, lib: { entry: path.resolve('src/services/patent/zip.ts'), formats: ['es'], fileName: () => 'zip.mjs' }, minify: false, target: 'node20' } })
const { unzip } = await import(pathToFileURL(path.resolve('.originals-out/zip.mjs')).href)

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
  await new Promise((r) => setTimeout(r, 250))
}

const WS = '11111111-1111-4111-8111-111111111111'
const OWNER = '00000000-0000-4000-8000-000000000001'
const CID = 'cli_orig'
const CID2 = 'cli_orig2'
const CID3 = 'cli_nofile'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const doc = (fileName, key, extra = {}) => ({ received: true, issuedAt: today, fileName, fileSize: 20, storagePath: `${WS}/${extra.cid ?? CID}/${key}/${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`, note: '', updatedAt: `${today}T00:00:00Z`, uploadedAt: `${today}T01:00:00Z`, ...extra })

const rows = [
  {
    id: CID,
    workspace_id: WS,
    company_name: '원본정밀(주)',
    status: 'active',
    next_action: '',
    next_action_due_date: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    payload: {
      businessNumber: '123-45-67890',
      businessType: 'corporation',
      representativeName: '이대표',
      documents: {
        businessRegistration: doc('스캔0001.pdf', 'businessRegistration'),
        financialStatements: doc('KakaoTalk_2025재무.pdf', 'financialStatements'),
        customdoc_dup: doc('사업자등록증_새로.pdf', 'customdoc_dup'),
        customdoc_photo: doc('현장사진.png', 'customdoc_photo'),
        customdoc_gone: doc('없어진계약서.hwp', 'customdoc_gone', { storagePath: `${WS}/${CID}/customdoc_gone/GONE-contract.hwp` }),
      },
      customDocuments: [
        { id: 'c1', key: 'customdoc_dup', label: '사업자등록증', validMonths: null, sensitive: false },
        { id: 'c2', key: 'customdoc_photo', label: '현장 사진', validMonths: null, sensitive: false },
        { id: 'c3', key: 'customdoc_gone', label: '용역 계약서', validMonths: null, sensitive: false },
      ],
    },
  },
  {
    id: CID2,
    workspace_id: WS,
    company_name: '둘째상사',
    status: 'active',
    next_action: '',
    next_action_due_date: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    payload: { documents: { businessRegistration: doc('biz.png', 'businessRegistration', { cid: CID2 }) }, customDocuments: [] },
  },
  {
    id: CID3,
    workspace_id: WS,
    company_name: '서류없는곳',
    status: 'active',
    next_action: '',
    next_action_due_date: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    payload: { documents: {}, customDocuments: [] },
  },
]
const patches = []
const deletes = []
const publicHits = []
const fetched = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
async function newCtx(viewport) {
  // 화면은 브라우저의 오늘 날짜로 파일 이름을 짓는다 — 시험의 today(한국 시각)와 같은 시간대로 맞춘다(한국 자정 ~ 오전 9시에 날짜가 하루 어긋나던 것)
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true, ...(viewport.width < 768 ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(([ref, s, ws]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
  }, [REF, session, WS])
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname)
    const method = req.method()
    if (p.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (p.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (p.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json('full'))
    if (p.includes('/storage/v1/object/public/')) {
      publicHits.push(p)
      return route.fulfill({ status: 400, body: 'private bucket' })
    }
    if (method === 'POST' && p.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = p.slice('/storage/v1/object/sign/client-documents/'.length)
      return route.fulfill(json({ signedURL: `/object/sign/client-documents/${encodeURI(key)}?token=qa` }))
    }
    if (method === 'GET' && p.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = p.slice('/storage/v1/object/sign/client-documents/'.length)
      fetched.push(key)
      // 보관함에서 지워진 파일 — 서명 주소로 받으면 400(저장소가 '없음' 을 이렇게 준다)
      if (key.includes('GONE')) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }) })
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' }, body: Buffer.from(`ORIG:${key}`) })
    }
    if (method === 'DELETE' && p.startsWith('/storage/v1/object/')) {
      deletes.push(p)
      return route.fulfill(json([]))
    }
    if (p.includes('/rest/v1/workspace_members')) {
      return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    }
    if (p.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    if (p.includes('/rest/v1/operations_clients')) {
      if (method === 'PATCH' || method === 'POST') {
        patches.push(req.postData() ?? '')
        return route.fulfill(json([]))
      }
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      const idEq = url.searchParams.get('id')?.replace(/^eq\./, '')
      const list = idEq ? rows.filter((r) => r.id === idEq) : rows
      return route.fulfill(json(single ? list[0] ?? null : list))
    }
    return route.fulfill(json([]))
  })
  return ctx
}

const unzipped = async (download) => {
  const m = await unzip(new Uint8Array(readFileSync(await download.path())))
  return m
}
const txt = (m, name) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(m.get(name) ?? new Uint8Array())

const ctx = await newCtx({ width: 1440, height: 900 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

// ---------- 1) 업체 서류함 [원본 내려받기] → [전부] ----------
await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const openBtn = page.getByTestId('doc-originals-open')
check('1 서류함 머리 [원본 내려받기] — 원본이 있는 업체(클라우드)', (await openBtn.count()) === 1)
await openBtn.click()
const sheet = page.getByTestId('doc-originals')
await sheet.waitFor({ timeout: 5000 })
const allLabel = (await page.getByTestId('doc-originals-all').innerText()) ?? ''
check('1b 판 — [전부 5개] · [정책자금 신청 서류만 n개] 두 가지', /전부 5개/.test(allLabel) && (await page.getByTestId('doc-originals-policy').count()) === 1, allLabel)
await page.screenshot({ path: `${SHOTS}/pc-sheet.png` })
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('doc-originals-all').click()])
await page.getByTestId('doc-originals-done').waitFor({ timeout: 10000 })
const doneLine = (await page.getByTestId('doc-originals-done').innerText()) ?? ''
check('1c 압축 파일 이름 = 업체_서류원본_날짜.zip', dl.suggestedFilename() === `원본정밀(주)_서류원본_${today}.zip`, dl.suggestedFilename())
const m1 = await unzipped(dl)
const names1 = [...m1.keys()]
check('1d 안의 이름 = 서류 칸 이름 — 사업자등록증.pdf · 사업자등록증 (2).pdf · 최근 3개년 재무제표.pdf · 현장 사진.png · 목록.txt', names1.includes('사업자등록증.pdf') && names1.includes('사업자등록증 (2).pdf') && names1.includes('현장 사진.png') && names1.some((n) => /재무제표\.pdf$/.test(n)) && names1.includes('목록.txt') && names1.length === 5, names1)
check('1e 파일 내용은 보관함 그대로', txt(m1, '사업자등록증.pdf') === `ORIG:${WS}/${CID}/businessRegistration/0001.pdf`.replace('0001.pdf', '_0001.pdf') || txt(m1, '사업자등록증.pdf').startsWith(`ORIG:${WS}/${CID}/businessRegistration/`), txt(m1, '사업자등록증.pdf'))
const idx1 = txt(m1, '목록.txt')
check('1f 목록.txt — 원래 이름(스캔0001.pdf) · 발급일 · 지워진 파일은 까닭과 함께 맨 아래', idx1.includes('원래 이름 스캔0001.pdf') && idx1.includes(`발급일 ${today}`) && idx1.includes('용역 계약서 (없어진계약서.hwp)') && idx1.includes('찾지 못했어요'), idx1.slice(0, 600))
check('1g 끝 한 줄 — 원본 4개 · 1개는 담지 못했어요(목록 맨 아래)', /원본 4개/.test(doneLine) && /1개는 담지 못했어요/.test(doneLine), doneLine)
await page.screenshot({ path: `${SHOTS}/pc-done.png` })

// ---------- 2) [정책자금 신청 서류만] ----------
const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('doc-originals-policy').click()])
await page.waitForTimeout(400)
const m2 = await unzipped(dl2)
const names2 = [...m2.keys()]
check('2 정책자금 신청 서류만 — 이름 _정책자금신청서류_ · 사업자등록증 · 재무제표는 들고 · 현장 사진 · 용역 계약서 없음', dl2.suggestedFilename() === `원본정밀(주)_정책자금신청서류_${today}.zip` && names2.includes('사업자등록증.pdf') && names2.some((n) => /재무제표/.test(n)) && !names2.some((n) => /현장 사진|용역 계약서/.test(n)), { f: dl2.suggestedFilename(), names2 })
check('2b 목록 제목 — 정책자금 신청 서류', txt(m2, '목록.txt').includes('정책자금 신청 서류'))
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ---------- 3) 더보기 › [서류 원본 한 번에 내려받기] ----------
await page.getByRole('button', { name: '더보기' }).first().click()
const more = page.getByTestId('more-doc-originals')
await more.waitFor({ timeout: 5000 })
check('3 더보기 › [서류 원본 한 번에 내려받기(ZIP · 5개)]', /5개/.test((await more.innerText()) ?? ''))
await more.click()
await page.getByTestId('doc-originals').waitFor({ timeout: 5000 })
check('3b 같은 판이 열림', (await page.getByTestId('doc-originals-all').count()) === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ---------- 4) 원본 없는 업체 — 단추 없음 ----------
await page.goto(`${BASE}/ops/clients/${CID3}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('4 원본 파일이 없는 업체 — [원본 내려받기] 단추 없음', (await page.getByTestId('doc-originals-open').count()) === 0)

// ---------- 5) 설정 › 데이터 [서류 원본 파일 전부] ----------
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: /데이터/ }).first().click()
const wsBtn = page.getByTestId('settings-originals')
await wsBtn.waitFor({ timeout: 5000 })
const [dl3] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), wsBtn.click()])
await page.getByTestId('settings-originals-done').waitFor({ timeout: 10000 })
const wsLine = (await page.getByTestId('settings-originals-done').innerText()) ?? ''
const m3 = await unzipped(dl3)
const names3 = [...m3.keys()]
check('5 작업공간 전부 — 이름 미래AI랩_서류원본전부_날짜 · 업체마다 폴더 · 맨 위 목록 · 파일 없는 업체는 폴더 없음', dl3.suggestedFilename() === `미래AI랩_서류원본전부_${today}.zip` && names3[0] === '목록.txt' && names3.includes('원본정밀(주)/사업자등록증.pdf') && names3.includes('둘째상사/사업자등록증.png') && names3.includes('둘째상사/목록.txt') && !names3.some((n) => n.startsWith('서류없는곳')), { f: dl3.suggestedFilename(), names3 })
check('5b 끝 한 줄 — 업체 2곳 · 원본 5개 · 1개 못 담음', /업체 2곳/.test(wsLine) && /원본 5개/.test(wsLine) && /1개는 담지 못했어요/.test(wsLine), wsLine)
check('5c 전체 목록 — 업체별 담은 수', txt(m3, '목록.txt').includes('원본정밀(주) — 4개') && txt(m3, '목록.txt').includes('둘째상사 — 1개'), txt(m3, '목록.txt').slice(0, 400))
await page.screenshot({ path: `${SHOTS}/pc-settings.png` })

// ---------- 6) 휴대폰 390 — 단추 · 판 ----------
const mctx = await newCtx({ width: 390, height: 844 })
const mp = await mctx.newPage()
await mp.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await mp.waitForTimeout(1200)
const mbtn = mp.getByTestId('doc-originals-open')
const mbox = await mbtn.boundingBox()
check('6 휴대폰: [원본] 단추 보임 · 가로 넘침 0', !!mbox && (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, mbox)
await mbtn.click()
await mp.getByTestId('doc-originals').waitFor({ timeout: 5000 })
await mp.waitForTimeout(500)
const allBox = await mp.getByTestId('doc-originals-all').boundingBox()
check('6b 휴대폰 판: [전부] 단추 40px 넘게 · 화면 안(가로 · 세로)', !!allBox && allBox.height >= 40 && allBox.x >= 0 && allBox.x + allBox.width <= 390 && allBox.y >= 0 && allBox.y + allBox.height <= 844, allBox)
await mp.screenshot({ path: `${SHOTS}/phone-sheet.png` })
await mctx.close()

// ---------- 읽기만 ----------
check('7 읽기만 — 업체 기록 저장 0 · 보관함 지우기 0 · 공개 주소 0', patches.length === 0 && deletes.length === 0 && publicHits.length === 0, { patches: patches.length, deletes, publicHits })
check('7b 지워진 파일은 두 번 시도(잠깐 끊김 대비)뒤 건너뜀', fetched.filter((k) => k.includes('GONE')).length >= 2, fetched.filter((k) => k.includes('GONE')).length)
const realErrors = errors.filter((e) => !/tesseract\.js@.*worker\.min\.js/.test(e))
check('8 JS 오류 없음', realErrors.length === 0, realErrors.join(' | '))

await browser.close()
stop()
console.log(`\n서류 원본 묶음(클라우드): ${pass} passed, ${fail} failed  (스크린샷: ${SHOTS})`)
if (fail > 0) process.exit(1)
