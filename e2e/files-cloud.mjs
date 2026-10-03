/**
 * 서류 파일 — 클라우드 모드 시험 (D-129). 브라우저 저장 모드에는 파일 보관이 없어서
 * Supabase 를 흉내 낸 응답으로 진짜 화면의 단추를 누른다.
 *
 *   [미리보기]  PDF → OS 안 iframe · 사진 → OS 안 img(실제로 그려짐)
 *   [새 창에서 열기]  새 창이 서명 주소(5분짜리)로 간다
 *   [내려받기]  원래 한글 이름 그대로 저장된다(저장소 download= 에 맡기지 않는다 — 라이브러리가 한글을 두 번 인코딩)
 *   HWP  미리보기 단추가 없고 '새 창 · 내려받기' 안내
 *   [파일 교체]  저장소에 올리고 업체 기록(payload)을 고친다 → 사업자등록증 글자에서 회사 정보 후보(확정 아님)
 *   저장소는 비공개 — 파일 주소는 늘 /object/sign/ (공개 주소 /object/public/ 을 쓰지 않는다)
 *
 *   node e2e/files-cloud.mjs            (dist-qa-cloud 로 따로 빌드하고 4535 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'

const REF = 'qaproject'
const PORT = 4535
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-cloud'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

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
    const r = await fetch(BASE)
    if (r.ok) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const WS = '11111111-1111-4111-8111-111111111111'
const OWNER = '00000000-0000-4000-8000-000000000001'
const CID = 'cli_cloud'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

// 1×1 PNG · 가장 작은 PDF
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')

let row = {
  id: CID,
  workspace_id: WS,
  company_name: '클라우드정밀(주)',
  status: 'active',
  next_action: '',
  next_action_due_date: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
  payload: {
    businessNumber: '123-45-67890',
    representativeName: '이대표',
    documents: {
      businessRegistration: { received: true, issuedAt: '2026-09-01', fileName: '사업자등록증.pdf', fileSize: PDF.length, storagePath: `${WS}/${CID}/businessRegistration/a-biz.pdf` },
      customdoc_photo: { received: true, issuedAt: '', fileName: '현장사진.png', fileSize: PNG.length, storagePath: `${WS}/${CID}/customdoc_photo/b-site.png` },
      customdoc_hwp: { received: true, issuedAt: '', fileName: '용역계약서.hwp', fileSize: 2048, storagePath: `${WS}/${CID}/customdoc_hwp/c-contract.hwp` },
      // D-146/147: 예전 판별이 중소기업 확인서 칸에 넣은 졸업증명서 — 파일 이름으로는 모르고 글자를 읽어야 안다
      smeCertificate: { received: true, issuedAt: '2020-02-01', fileName: '스캔0001.txt', fileSize: 120, storagePath: `${WS}/${CID}/smeCertificate/d-scan0001.txt` },
    },
    customDocuments: [
      { id: 'cd1', key: 'customdoc_photo', label: '현장 사진', validMonths: null, sensitive: false },
      { id: 'cd2', key: 'customdoc_hwp', label: '용역 계약서', validMonths: null, sensitive: false },
    ],
  },
}
const TXT = { 'd-scan0001.txt': '졸 업 증 명 서\n성명 : 이대표\n위 사람은 본교 기계공학과를 졸업하였음을 증명합니다.\n2020년 2월 1일' }
const deletes = []
let portalRows = [
  { id: 'pd1', workspace_id: WS, portal_client_link_id: 'lnk1', operations_client_id: CID, document_type: 'etc', title: '고객이 올린 재무제표', storage_path: `${WS}/portal/lnk1/123-fin.png`, file_name: '2025 재무제표.png', file_size: PNG.length, mime_type: 'image/png', source: 'customer', visibility: 'customer', status: 'verified', uploaded_at: '2026-09-20T00:00:00Z', created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z' },
  // D-148: 고객이 사업자등록증 요청에 올린 새 파일 — 확인 완료하면 서류함 칸을 덮지 않고 '(2)' 칸으로
  { id: 'pd2', workspace_id: WS, portal_client_link_id: 'lnk1', operations_client_id: CID, document_type: 'businessRegistration', title: '사업자등록증', storage_path: `${WS}/portal/lnk1/456-biz.pdf`, file_name: '사업자등록증_고객.pdf', file_size: PDF.length, mime_type: 'application/pdf', source: 'customer', visibility: 'customer', status: 'uploaded', uploaded_at: '2026-09-28T00:00:00Z', created_at: '2026-09-28T00:00:00Z', updated_at: '2026-09-28T00:00:00Z' },
]
const signed = []
const uploads = []
const patches = []
const publicHits = []
const fetched = []

// 컨테이너에 로캘이 없으면 크롬이 한글 파일 이름을 'download' 로 바꾼다 — 사용자 PC 와 같게 UTF-8 로 띄운다
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', acceptDownloads: true })
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
  if (path.includes('/storage/v1/object/public/')) {
    publicHits.push(path)
    return route.fulfill({ status: 400, body: 'private bucket' })
  }
  // 서명 주소 만들기
  if (method === 'POST' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
    const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
    signed.push(key)
    return route.fulfill(json({ signedURL: `/object/sign/client-documents/${encodeURI(key)}?token=qa-${signed.length}` }))
  }
  // 서명 주소로 파일 받기
  if (method === 'GET' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
    const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
    const txt = TXT[key.split('/').pop()]
    const body = txt ? Buffer.from(txt, 'utf8') : key.endsWith('.png') ? PNG : key.endsWith('.pdf') ? PDF : Buffer.from('HWP-BYTES')
    const type = txt ? 'text/plain; charset=utf-8' : key.endsWith('.png') ? 'image/png' : key.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
    const dl = url.searchParams.get('download')
    fetched.push({ key, dl })
    const headers = { 'content-type': type, 'access-control-allow-origin': '*' }
    if (dl !== null) headers['content-disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(dl || key.split('/').pop())}`
    return route.fulfill({ status: 200, headers, body })
  }
  // 지우기 — 서류함에서 빼도 보관함 파일은 지우지 않는다(D-146)
  if (method === 'DELETE' && path.startsWith('/storage/v1/object/')) {
    deletes.push(path)
    return route.fulfill(json([]))
  }
  // 올리기
  if (method === 'POST' && path.startsWith('/storage/v1/object/client-documents/')) {
    uploads.push(path.slice('/storage/v1/object/client-documents/'.length))
    return route.fulfill(json({ Key: path.slice('/storage/v1/object/'.length) }))
  }
  if (path.includes('/rest/v1/portal_client_links')) {
    return route.fulfill(json([{ id: 'lnk1', workspace_id: WS, operations_client_id: CID, profile_id: 'p1', status: 'active', customer_stage: 'contracted', display_name: '', consultant_name: '', linked_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', profiles: { email: 'c@x.kr', name: '고객' } }]))
  }
  if (path.includes('/rest/v1/portal_documents')) {
    // D-148: 확인 완료(PATCH) → 그 한 줄을 돌려준다(.single())
    if (method === 'PATCH') {
      const body = JSON.parse(req.postData() ?? '{}')
      portalRows = portalRows.map((r) => (url.searchParams.get('id') === `eq.${r.id}` ? { ...r, ...body } : r))
      const hit = portalRows.find((r) => url.searchParams.get('id') === `eq.${r.id}`) ?? portalRows[0]
      return route.fulfill(json(hit))
    }
    return route.fulfill(json(portalRows))
  }
  if (path.includes('/rest/v1/workspace_members')) {
    return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
  }
  if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
  if (path.includes('/rest/v1/operations_clients')) {
    if (method === 'PATCH') {
      const body = JSON.parse(req.postData() ?? '{}')
      patches.push(body)
      row = { ...row, ...body, updated_at: new Date().toISOString() }
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return route.fulfill(json(single ? row : [row]))
    }
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    return route.fulfill(json(single ? row : [row]))
  }
  return route.fulfill(json([]))
})

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const text = (await page.locator('main').innerText().catch(() => '')) ?? ''
check('클라우드 모드: 업체 서류 탭이 열린다', text.includes('사업자등록증.pdf') && text.includes('현장사진.png') && text.includes('용역계약서.hwp'), text.slice(0, 300))

// PDF 미리보기
await page.getByRole('button', { name: '사업자등록증 미리보기' }).first().click()
const pv = page.getByTestId('file-preview')
await pv.waitFor({ timeout: 8000 })
const iframeSrc = await pv.locator('iframe').getAttribute('src')
check('PDF 미리보기: OS 안 iframe · 서명 주소', (await pv.getAttribute('data-kind')) === 'pdf' && /\/object\/sign\/client-documents\/.+a-biz\.pdf\?token=/.test(iframeSrc ?? ''), iframeSrc ?? '')
check('PDF 미리보기: 창을 옮기지 않는다', page.url().includes(`/ops/clients/${CID}`))
await page.getByRole('dialog').getByRole('button', { name: '닫기' }).last().click()
await page.waitForTimeout(300)

// 사진 미리보기 — 실제로 그려졌는지
await page.getByRole('button', { name: '현장 사진 미리보기' }).first().click()
await pv.waitFor({ timeout: 8000 })
await page.waitForTimeout(500)
const img = await pv.locator('img').evaluate((el) => ({ w: el.naturalWidth, src: el.getAttribute('src') }))
check('사진 미리보기: OS 안 img 가 그려진다', (await pv.getAttribute('data-kind')) === 'image' && img.w > 0, JSON.stringify(img))
await page.getByRole('dialog').getByRole('button', { name: '닫기' }).last().click()
await page.waitForTimeout(300)

// HWP — 미리보기 없음 · 안내
const hwp = page.locator('[data-file-actions="용역 계약서"]').first()
check('HWP: 미리보기 단추가 없다(억지로 열지 않음)', (await hwp.getByRole('button', { name: /미리보기/ }).count()) === 0 && (await hwp.getByRole('button', { name: '용역 계약서 새 창에서 열기' }).count()) === 1)
check('HWP: 새 창 · 내려받기 안내', text.includes('여기서 미리 볼 수 없습니다'))

// 고객이 올린 파일도 서류 탭에서 — 같은 단추
const portal = page.locator('[data-portal-file="pd1"]')
check('고객이 올린 파일: 서류 탭 안에 보인다', ((await portal.innerText().catch(() => '')) ?? '').includes('2025 재무제표.png'))
await portal.getByRole('button', { name: '고객이 올린 재무제표 미리보기' }).click()
await pv.waitFor({ timeout: 8000 })
await page.waitForTimeout(400)
const pimg = await pv.locator('img').evaluate((el) => el.naturalWidth)
check('고객이 올린 파일: OS 안 미리보기(사진)', pimg > 0 && signed.at(-1) === `${WS}/portal/lnk1/123-fin.png`, String(signed.at(-1)))
await page.getByRole('dialog').getByRole('button', { name: '닫기' }).last().click()
await page.waitForTimeout(300)

// 새 창
const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('button', { name: '사업자등록증 새 창에서 열기' }).first().click()])
await popup.waitForURL(/object\/sign\/client-documents/, { timeout: 8000 }).catch(() => {})
check('새 창에서 열기: 새 창이 서명 주소로 간다', /\/object\/sign\/client-documents\/.+a-biz\.pdf/.test(decodeURIComponent(popup.url())), popup.url())
await popup.close()

// 내려받기
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.getByRole('button', { name: '용역 계약서 내려받기' }).first().click()])
check('내려받기: 원래 한글 이름(용역계약서.hwp) 그대로 저장된다', download.suggestedFilename() === '용역계약서.hwp', download.suggestedFilename())
check('내려받기: 파일 내용이 저장소 파일 그대로', (await import('node:fs')).readFileSync(await download.path(), 'utf8') === 'HWP-BYTES')
void fetched

// 파일 교체 — 사업자등록증 글자 파일로
const beforePatches = patches.length
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: '사업자등록증 파일 교체' }).first().click()])
await chooser.setFiles({ name: '사업자등록증_새.txt', mimeType: 'text/plain', buffer: Buffer.from('사업자등록증 (법인사업자)\n등록번호 : 214-88-01234\n법인명(단체명) : 클라우드정밀(주)\n대표자 : 이대표', 'utf8') })
await page.waitForTimeout(2500)
const lastUpload = uploads[uploads.length - 1] ?? ''
check('파일 교체: 비공개 저장소 client-documents 에 올린다', lastUpload.startsWith(`${WS}/${CID}/businessRegistration/`) && lastUpload.endsWith('.txt'), lastUpload)
const saved = row.payload?.documents?.businessRegistration ?? {}
check('파일 교체: 업체 기록의 파일 이름 · 경로가 바뀐다', patches.length > beforePatches && saved.fileName === '사업자등록증_새.txt' && saved.storagePath === lastUpload, JSON.stringify(saved))
const inbox = row.payload?.factInbox ?? []
check('파일 교체: 글자에서 회사 정보 후보(사업자등록번호) — 확정하지 않는다', inbox.some((c) => c.key === 'businessNumber' && c.value === '214-88-01234') && row.payload.businessNumber === '123-45-67890', JSON.stringify(inbox).slice(0, 300))
const shown = (await page.locator('main').innerText()) ?? ''
check('파일 교체: 화면에 새 파일 이름', shown.includes('사업자등록증_새.txt'))

// D-148: 고객 플랫폼 '확인 완료' — 서류함 사업자등록증 칸(이미 파일 있음)을 덮지 않고 '사업자등록증 (2)' 칸으로
const bizBefore = row.payload?.documents?.businessRegistration?.storagePath
await page.goto(`${BASE}/ops/clients/${CID}?tab=portal`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.getByRole('button', { name: '확인 완료' }).first().click()
await page.waitForTimeout(1500)
const afterVerify = row.payload ?? {}
const biz2 = (afterVerify.customDocuments ?? []).find((d) => d.label === '사업자등록증 (2)')
check('확인 완료: 사업자등록증 칸의 기존 파일은 그대로(덮지 않음)', !!bizBefore && afterVerify.documents?.businessRegistration?.storagePath === bizBefore, `${bizBefore} → ${afterVerify.documents?.businessRegistration?.storagePath}`)
check("확인 완료: 고객 파일은 '사업자등록증 (2)' 칸에", !!biz2 && afterVerify.documents?.[biz2.key]?.storagePath === `${WS}/portal/lnk1/456-biz.pdf`, JSON.stringify(biz2))

// D-148: 고객과 주고받은 파일 → [서류함에 넣기] (종류 '기타' · 파일 이름 '2025 재무제표.png' → 재무제표 칸)
await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByTestId('portal-file-pd1').click()
await page.waitForFunction(() => !!document.querySelector('[data-testid="portal-filed-pd1"]'), null, { timeout: 30000 })
const fin = row.payload?.documents?.financialStatements ?? {}
check('서류함에 넣기: 고객 파일이 재무제표 칸에(같은 보관함 경로)', fin.storagePath === `${WS}/portal/lnk1/123-fin.png` && fin.fileName === '2025 재무제표.png', JSON.stringify(fin))
check("서류함에 넣기: '서류함 … 칸에 있음' 으로 바뀜", ((await page.getByTestId('portal-filed-pd1').innerText()) ?? '').includes('재무제표'))

// D-146/147: 서류 다시 분류 — 보관함 파일을 서명 주소로 받아 글자를 읽고 제목으로 옮긴다
await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('다시 분류 전: 중소기업 확인서 만료(엉뚱한 서류)', ((await page.locator('main').innerText()) ?? '').includes('만료됨'))
const fetchedBefore = fetched.length
await page.getByTestId('doc-resort').click()
await page.getByTestId('resort-sheet').waitFor()
await page.waitForFunction(() => !document.querySelector('[data-testid="resort-reading"]'), null, { timeout: 30000 })
const rmoves = await page.getByTestId('resort-move').allInnerTexts()
check('다시 분류: 보관함에서 파일을 받아 읽었다', fetched.slice(fetchedBefore).some((f) => f.key.endsWith('d-scan0001.txt')), JSON.stringify(fetched.slice(fetchedBefore)))
check('다시 분류: 글자 제목으로 — 스캔0001.txt 를 중소기업 확인서 → 졸업증명서', rmoves.length === 1 && rmoves[0].includes('스캔0001.txt') && rmoves[0].includes('졸업증명서') && rmoves[0].includes('서류 제목'), rmoves.join(' || '))
await page.getByTestId('resort-apply').click()
await page.waitForTimeout(1500)
const rdocs = row.payload?.documents ?? {}
const gradCell = (row.payload?.customDocuments ?? []).find((d) => d.label === '졸업증명서')
check('다시 분류 후: 졸업증명서 새 칸에 같은 보관함 경로 · 중소기업 확인서 칸은 비움', !!gradCell && rdocs[gradCell.key]?.storagePath === `${WS}/${CID}/smeCertificate/d-scan0001.txt` && !rdocs.smeCertificate?.storagePath, JSON.stringify({ gradCell, sme: rdocs.smeCertificate }))
check('다시 분류 후: 만료됨 사라짐', !((await page.locator('main').innerText()) ?? '').includes('만료됨'))

// 파일 지우기 — 서류함에서만 빠지고 보관함 파일은 그대로
await page.getByTestId(`doc-remove-${gradCell?.key}`).click()
await page.getByTestId(`doc-remove-${gradCell?.key}-yes`).click()
await page.waitForTimeout(1200)
check('파일 지우기: 졸업증명서 칸이 서류함에서 빠짐', !(row.payload?.customDocuments ?? []).some((d) => d.key === gradCell?.key))
check('파일 지우기: 보관함 파일은 지우지 않음(되돌릴 수 없는 삭제 0)', deletes.length === 0, deletes.join(' | '))

check('비공개 저장소: 공개 주소를 한 번도 쓰지 않았다', publicHits.length === 0, publicHits.join(' | '))
// 이 시험 환경은 바깥 CDN 에 못 나간다 — 사진 글자 인식(tesseract) 일꾼을 못 받아 생기는 오류만 뺀다(실제 사용자 PC 는 받는다).
// 그래도 다시 분류는 멈추지 않고 끝나야 한다(위에서 확인).
const realErrors = errors.filter((e) => !/tesseract\.js@.*worker\.min\.js/.test(e))
check('JS 오류 없음(CDN 못 받는 글자 인식 일꾼 제외)', realErrors.length === 0, realErrors.join(' | '))

await browser.close()
stop()
console.log(`\n서류 파일(클라우드): ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
