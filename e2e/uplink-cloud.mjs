/**
 * L-41 · D-652 서류 올리기 링크 — 클라우드 흉내 시험(0031 함수 · 보관함을 흉내 낸 응답으로 진짜 화면을 누른다).
 *
 *   컨설턴트(PC): 업체 서류함 [링크로 받기] → 받을 서류 고르기 → [링크 만들기] → 주소 · 카톡 문구 복사 → 서류함 한 줄
 *   업체 대표(휴대폰 390 · 로그인 없음): /up/<20자리> → 서류마다 [사진 찍기 · 파일 고르기] → 예약 → 그 경로에만 넣기 → 다 올림
 *     · 세션 없는 연결(컨설턴트 브라우저에서 열어도 그 사람 자격 0) · 이상한 파일은 서버에 가기 전에 막힘 · 닫힌 주소 · OS 이름 0
 *   컨설턴트: '고객이 올린 서류 n개' → [넣기] → 그 칸 '받음'(덮지 않음 · 폴더 '고객이 올린 서류') · 그 밖의 서류는 글자로 칸 · [되돌리기]
 *   0031 전(함수 없음)이면 단추 · 한 줄 0
 *
 *   node e2e/uplink-cloud.mjs            (dist-qa-uplink 로 따로 빌드하고 4538 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const REF = 'qaproject'
const PORT = 4538
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-uplink'
const SHOTS = process.argv[2] || ''
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

if (!process.env.UPLINK_NO_BUILD) {
  execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, {
    stdio: 'ignore',
    env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' },
  })
}
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
const CID = 'cli_upload'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
const SME_TEXT = '중 소 기 업 확 인 서\n기업명 : (주)업로드정밀\n사업자등록번호 : 123-45-67890\n유효기간 : 2026.04.01 ~ 2027.03.31\n중소벤처기업부'

let row = {
  id: CID,
  workspace_id: WS,
  company_name: '(주)업로드정밀',
  status: 'active',
  next_action: '',
  next_action_due_date: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-20T00:00:00Z',
  payload: { contactName: '박대표', businessNumber: '123-45-67890', documents: {}, customDocuments: [] },
}

// 0031 흉내 — 링크 · 받은 파일 · 함수 기록
let missing = false
let link = null
const files = []
const calls = []
const storagePuts = []
const patches = []
const journal = []
const fileBytes = {}
const SLUGS = ['abcdef0123456789abcd', 'fedcba9876543210fedc']
let slugIdx = 0
const stateOf = () => ({
  role: 'writer',
  link: link && { ...link, expired: false },
  files: files.filter((f) => f.status === 'uploaded').map((f) => ({ id: f.id, docKey: f.docKey, docLabel: f.docLabel, fileName: f.fileName, fileSize: f.fileSize, contentType: '', storagePath: f.storagePath, uploadedAt: f.uploadedAt })),
  accepted: files.filter((f) => f.status === 'accepted').length,
  closed: 0,
})
const openLink = (slug) => (link && link.slug === String(slug ?? '').trim().toLowerCase() ? link : null)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })

async function routeCloud(ctx, who) {
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    const method = req.method()
    const auth = req.headers()['authorization'] ?? ''
    const body = (() => {
      try {
        return JSON.parse(req.postData() ?? '{}')
      } catch {
        return {}
      }
    })()
    if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (path.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json('full'))
    if (path.startsWith('/rest/v1/rpc/upload_link_') || path.startsWith('/rest/v1/rpc/public_upload_')) {
      const fn = path.slice('/rest/v1/rpc/'.length)
      calls.push({ fn, who, auth, body })
      if (missing) return route.fulfill(json({ code: 'PGRST202', message: `Could not find the function public.${fn}` }, 404))
      if (fn === 'upload_link_state') return route.fulfill(json(stateOf()))
      if (fn === 'upload_link_save') {
        const days = Math.min(Math.max(Number(body.p_days) || 14, 1), 30)
        const docs = (body.p_docs ?? []).filter((d) => /^[A-Za-z0-9_-]{1,60}$/.test(d.key))
        link = { ...(link ?? { slug: SLUGS[slugIdx], uploaded: 0, createdAt: new Date().toISOString(), lastAt: null }), title: row.company_name, note: body.p_note ?? '', docs, expiresAt: new Date(Date.now() + days * 86400000).toISOString() }
        return route.fulfill(json(stateOf()))
      }
      if (fn === 'upload_link_rotate') {
        slugIdx += 1
        link = { ...link, slug: SLUGS[slugIdx % SLUGS.length] }
        return route.fulfill(json(stateOf()))
      }
      if (fn === 'upload_link_off') {
        link = null
        return route.fulfill(json(stateOf()))
      }
      if (fn === 'upload_link_decide') {
        const f = files.find((x) => x.id === body.p_file)
        const to = body.p_decision
        const ok = f && f.status !== to && ((to !== 'uploaded' && f.status === 'uploaded') || (to === 'uploaded' && ['accepted', 'dismissed'].includes(f.status)))
        if (ok) f.status = to
        return route.fulfill(json({ changed: Boolean(ok), status: f?.status ?? null }))
      }
      if (fn === 'upload_link_inbox') {
        // D-657 작업공간 전체 — 업체마다 '올리고 아직 칸에 안 넣은' 파일 수
        const waiting = files.filter((f) => f.status === 'uploaded').length
        return route.fulfill(json(waiting ? [{ clientId: CID, waiting }] : []))
      }
      if (fn === 'public_upload_form') {
        const l = openLink(body.p_slug)
        if (!l) return route.fulfill(json(null))
        const sent = {}
        for (const f of files) if (f.status === 'uploaded' || f.status === 'accepted') sent[f.docKey] = (sent[f.docKey] ?? 0) + 1
        return route.fulfill(json({ title: l.title, note: l.note, docs: l.docs, expiresAt: l.expiresAt, sent: Object.entries(sent).map(([key, n]) => ({ key, n, lastAt: null })) }))
      }
      if (fn === 'public_upload_reserve') {
        const l = openLink(body.p_slug)
        if (!l) return route.fulfill(json({ status: 'closed' }))
        const id = `f${files.length + 1}0000000-0000-4000-8000-000000000000`.slice(0, 36)
        const ext = /\.([A-Za-z0-9]{1,5})$/.exec(body.p_file_name)?.[1]?.toLowerCase() ?? 'bin'
        const docLabel = (l.docs.find((d) => d.key === body.p_doc_key) ?? { label: '' }).label
        const storagePath = `${WS}/${CID}/upload-link/link1/${id}.${ext}`
        files.push({ id, docKey: body.p_doc_key, docLabel, fileName: body.p_file_name, fileSize: body.p_size, storagePath, status: 'reserved', uploadedAt: null })
        return route.fulfill(json({ status: 'ok', id, path: storagePath }))
      }
      if (fn === 'public_upload_done') {
        const f = files.find((x) => x.storagePath === body.p_path)
        if (!f) return route.fulfill(json({ code: '22023', message: 'unknown file' }, 400))
        if (f.status === 'reserved') {
          f.status = storagePuts.includes(f.storagePath) ? 'uploaded' : f.status
          if (f.status === 'reserved') return route.fulfill(json('missing'))
          f.uploadedAt = new Date().toISOString()
          link.uploaded += 1
        }
        return route.fulfill(json('ok'))
      }
      return route.fulfill(json(null))
    }
    // 보관함 — 예약한 경로에만 넣을 수 있다(정책 흉내)
    if (method === 'POST' && path.startsWith('/storage/v1/object/client-documents/')) {
      const key = path.slice('/storage/v1/object/client-documents/'.length)
      calls.push({ fn: 'storage.put', who, auth, key, headers: req.headers() })
      const f = files.find((x) => x.storagePath === key && x.status === 'reserved')
      if (!f) return route.fulfill(json({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 403))
      storagePuts.push(key)
      fileBytes[key] = req.postDataBuffer()
      return route.fulfill(json({ Key: `client-documents/${key}` }))
    }
    if (method === 'POST' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
      return route.fulfill(json({ signedURL: `/object/sign/client-documents/${encodeURI(key)}?token=qa` }))
    }
    if (method === 'GET' && path.startsWith('/storage/v1/object/sign/client-documents/')) {
      const key = path.slice('/storage/v1/object/sign/client-documents/'.length)
      const isTxt = key.endsWith('.txt')
      return route.fulfill({ status: 200, headers: { 'content-type': isTxt ? 'text/plain; charset=utf-8' : 'application/pdf', 'access-control-allow-origin': '*' }, body: isTxt ? Buffer.from(SME_TEXT, 'utf8') : PDF })
    }
    if (path.includes('/rest/v1/workspace_members')) return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '대표 작업공간', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '대표 작업공간', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    if (path.includes('/rest/v1/ops_journal_entries')) {
      // D-656 [보냈어요] 가 만드는 '받았는지 확인' 할 일 — 넣은 줄을 그대로 돌려준다
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (method === 'POST') {
        const made = { id: `j${journal.length + 1}0000000-0000-4000-8000-000000000000`.slice(0, 36), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...body }
        journal.push(made)
        return route.fulfill(json(single ? made : [made], 201))
      }
      return route.fulfill(json(single ? (journal[0] ?? null) : journal))
    }
    if (path.includes('/rest/v1/operations_clients')) {
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (method === 'PATCH') {
        patches.push(body)
        row = { ...row, ...body, updated_at: new Date().toISOString() }
      }
      return route.fulfill(json(single ? row : [row]))
    }
    return route.fulfill(json([]))
  })
}

// ---------------------------------------------------------------- 컨설턴트(PC)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', permissions: ['clipboard-read', 'clipboard-write'] })
await ctx.addInitScript(([ref, s, ws]) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
  localStorage.setItem('axmvp.active_workspace', ws)
  localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
}, [REF, session, WS])
await routeCloud(ctx, 'owner')
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

// 0031 전 — 단추 · 한 줄 0
missing = true
await page.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('U1 0031 전(함수 없음): [링크로 받기] · 한 줄 · 더보기 칸 0', (await page.getByTestId('docs-upload-link').count()) === 0 && (await page.getByTestId('upload-link-bar').count()) === 0)
missing = false
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const btn = page.getByTestId('docs-upload-link')
check('U2 0031 뒤: 서류함 머리에 [링크로 받기] · 아직 링크 없으면 한 줄 없음', (await btn.count()) === 1 && (await page.getByTestId('upload-link-bar').count()) === 0)
await btn.click()
const sheet = page.getByTestId('upload-link-sheet')
await sheet.waitFor({ timeout: 5000 })
check('U3 처음 누르면 받을 서류 고르기(한 화면에 한 가지)', (await sheet.getAttribute('data-view')) === 'make' && (await sheet.getByTestId('upload-link-doc').count()) >= 4)
await sheet.locator('[data-testid="upload-link-doc"][data-key="businessRegistration"] input').check()
const fin = sheet.locator('[data-testid="upload-link-doc"][data-key="financialStatements"] input')
if ((await fin.count()) === 0) await sheet.getByTestId('upload-link-more').click()
await sheet.locator('[data-testid="upload-link-doc"][data-key="financialStatements"] input').check()
await sheet.locator('[data-testid="upload-link-days"][data-days="7"]').click()
const saveBtn = sheet.getByTestId('upload-link-save')
check("U4 [링크 만들기 · 2가지]", /링크 만들기 · 2가지/.test(await saveBtn.innerText()), await saveBtn.innerText())
await saveBtn.click()
await page.waitForFunction(() => document.querySelector('[data-testid="upload-link-sheet"]')?.getAttribute('data-view') === 'ready', null, { timeout: 5000 })
const saveCall = calls.filter((c) => c.fn === 'upload_link_save').at(-1)
const linkUrl = await sheet.getByTestId('upload-link-url').inputValue()
check('U5 만들기 → 고른 서류 2가지 · 7일 · 주소 /up/<20자리>', saveCall?.body?.p_docs?.length === 2 && saveCall.body.p_days === 7 && saveCall.body.p_ws === WS && saveCall.body.p_client === CID && /\/up\/[0-9a-f]{20}$/.test(linkUrl), JSON.stringify(saveCall?.body) + ' ' + linkUrl)
await sheet.getByTestId('upload-link-copy-msg').click()
await page.waitForTimeout(300)
const clip = await page.evaluate(() => navigator.clipboard.readText())
const hint5 = row.payload?.uploadHint
check('J1 D-656 링크를 만들면 업체 기록에 사본(주소 20자리 · 열려 있는 마지막 날) — 다시 부탁 문구가 주소를 붙인다', Boolean(hint5) && linkUrl.endsWith(`/up/${hint5.slug}`) && /^\d{4}-\d{2}-\d{2}$/.test(hint5.until), JSON.stringify(hint5))
check('U6 [카톡 문구 복사] — 대표님 이름 · 로그인 없음 · 서류 목록 · 주소 · 기한 · OS 이름 0', clip.startsWith('안녕하세요, 박대표 대표님.') && clip.includes(linkUrl) && /1\. 사업자등록증/.test(clip) && /재무제표/.test(clip) && /까지 열려 있어요/.test(clip) && !/MIRAE|미래AI랩/.test(clip), clip)
// D-656 문구를 보냈으면 [보냈어요] 한 번 — 서류함 '요청한 서류' · 3일 뒤 할 일로 이어진다
const sentBtn = sheet.getByTestId('upload-link-sent')
check('J2 문구를 복사하면 [보냈어요] 가 주 단추로(복사 단추는 한 단계 옅게)', (await sentBtn.count()) === 1 && /보냈어요/.test(await sentBtn.innerText()) && /bg-brand-600|bg-navy/.test((await sentBtn.getAttribute('class')) ?? '') && !/bg-brand-600/.test((await sheet.getByTestId('upload-link-copy-msg').getAttribute('class')) ?? ''), await sentBtn.getAttribute('class'))
await sentBtn.click()
await sheet.getByTestId('upload-link-sent-done').waitFor({ timeout: 5000 })
const sentLine = await sheet.getByTestId('upload-link-sent-done').innerText()
const req1 = row.payload?.docRequests ?? []
check("J3 [보냈어요] → 3일 뒤 '받았는지 확인' 할 일 1개 · 서류함에 '요청함' 2가지 · 단추는 '보낸 것으로 적음'(또 못 누름)", journal.length === 1 && /자료 받았는지 확인 — 사업자등록증/.test(journal[0].content ?? '') && req1.length === 1 && req1[0].items.length === 2 && /할 일에 넣었어요/.test(sentLine) && /요청함/.test(sentLine) && (await sentBtn.isDisabled()) && /보낸 것으로 적음/.test(await sentBtn.innerText()), JSON.stringify({ journal: journal.length, req1, sentLine }))
if (SHOTS) { await page.waitForTimeout(900); await page.screenshot({ path: join(SHOTS, 'uplink-ready-pc.png') }) }
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const reqRow = page.getByTestId('doc-req-row').first()
check("J4 서류함 '요청한 서류' 에 그 요청 — 0/2 · 오늘 보냄(링크로 부탁한 것과 문구로 부탁한 것이 한 줄에서 만난다)", (await reqRow.count()) === 1 && /0\s*\/\s*2/.test(await reqRow.innerText()), await reqRow.innerText().catch(() => ''))
await reqRow.getByTestId('doc-req-resend').click()
const again = await page.getByRole('dialog').locator('textarea').inputValue()
check('J5 [다시 요청] 문구 — 아직 안 온 2가지 + 올리기 주소 한 줄(끝인사 앞)', /1\. 사업자등록증/.test(again) && again.includes(linkUrl) && again.indexOf(linkUrl) < again.indexOf('사진이나 PDF로'), again)
if (SHOTS) await page.screenshot({ path: join(SHOTS, 'uplink-resend-pc.png') })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
// 링크 판을 다시 열어 또 [보냈어요] — 같은 서류를 이미 부탁해 뒀으니 요청 · 할 일이 늘지 않고 '다시 보낸 날' 만
await page.getByTestId('upload-link-bar').click()
await sheet.waitFor()
// D-665 다시 연 판은 이미 부탁한 것을 안다 — '오늘 부탁함 · 받은 0/2' · 단추는 [다시 보냈어요]
const askedLine = await sheet.getByTestId('upload-link-asked').innerText().catch(() => '')
check("J5b 링크 판을 다시 열면 '오늘 부탁함 · 받은 0/2' 한 줄 · 단추 말은 [다시 보냈어요](처음처럼 보이지 않는다)", /오늘 부탁함 · 받은 0\/2/.test(askedLine) && /다시 보냈어요/.test(await sheet.getByTestId('upload-link-sent').innerText()), askedLine)
await sheet.getByTestId('upload-link-copy-msg').click()
await sheet.getByTestId('upload-link-sent').click()
await sheet.getByTestId('upload-link-sent-done').waitFor({ timeout: 5000 })
const req2 = row.payload?.docRequests ?? []
check("J6 또 [보냈어요] → 요청 1개 그대로 · 할 일 1개 그대로 · 그 요청에 '다시 보낸 날'", req2.length === 1 && journal.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(req2[0].resentAt ?? '') && /다시 보낸 날/.test(await sheet.getByTestId('upload-link-sent-done').innerText()), JSON.stringify(req2))
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
const bar = page.getByTestId('upload-link-bar')
check('U7 서류함 한 줄 — 올리기 링크 · 기한 · 받은 0개', (await bar.count()) === 1 && /올리기 링크 · .+까지 · 받은 0개/.test(await bar.innerText()), await bar.innerText().catch(() => ''))

// ---------------------------------------------------------------- 업체 대표(휴대폰 · 로그인 없음 — 컨설턴트 세션이 남아 있어도 그 자격 0)
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
// 같은 브라우저에서 컨설턴트가 열어 본 경우처럼 세션을 넣어 둔다 — 그래도 공개 화면은 세션 없이 불러야 한다
await phone.addInitScript(([ref, s]) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s)), [REF, session])
await routeCloud(phone, 'public')
const up = await phone.newPage()
const upErrors = []
up.on('pageerror', (e) => upErrors.push(String(e)))
const slug = linkUrl.split('/up/')[1]
await up.goto(`${BASE}/up/${slug.toUpperCase()}`, { waitUntil: 'networkidle' })
await up.getByTestId('up-title').waitFor({ timeout: 8000 })
const upText = await up.locator('main').innerText()
check('P1 공개 화면 — 업체 이름 · 받을 서류 2 + 그 밖의 서류 · 기한 · OS 이름 · 로고 0', upText.includes('(주)업로드정밀') && (await up.getByTestId('up-doc').count()) === 3 && upText.includes('그 밖의 서류') && /까지 열려 있어요/.test(upText) && !/MIRAE|미래AI랩|AI LAB/.test(upText) && (await up.locator('img').count()) === 0, upText.slice(0, 200))
const sizes = await up.evaluate(() => ({
  label: Math.min(...[...document.querySelectorAll('[data-testid="up-doc"] span')].map((e) => parseFloat(getComputedStyle(e).fontSize))),
  btn: Math.min(...[...document.querySelectorAll('[data-testid="up-pick"]')].map((e) => e.getBoundingClientRect().height)),
  over: document.documentElement.scrollWidth - window.innerWidth,
}))
check('P2 60대 기준 — 서류 이름 16px 이상 · 누르는 칸 52px 이상 · 옆 넘침 0(390)', sizes.label >= 16 && sizes.btn >= 52 && sizes.over <= 0, JSON.stringify(sizes))
const formCall = calls.filter((c) => c.who === 'public' && c.fn === 'public_upload_form').at(-1)
check('P3 세션 없는 연결 — 남아 있는 로그인 토큰을 보내지 않음(로그인 안 한 사람 자격)', Boolean(formCall) && !formCall.auth.includes(session.access_token) && calls.filter((c) => c.who === 'public' && c.auth.includes(session.access_token)).length === 0, formCall?.auth)
if (SHOTS) await up.screenshot({ path: join(SHOTS, 'uplink-public-390.png'), fullPage: true })

const dir = join(tmpdir(), `uplink-${process.pid}`)
mkdirSync(dir, { recursive: true })
const bizPdf = join(dir, '사업자등록증 사진.pdf')
writeFileSync(bizPdf, PDF)
const exe = join(dir, 'virus.exe')
writeFileSync(exe, 'MZ')
const smeTxt = join(dir, '중기확인.txt')
writeFileSync(smeTxt, SME_TEXT)

const rowOf = (key) => up.locator(`[data-testid="up-doc"][data-key="${key}"]`)
await rowOf('businessRegistration').getByTestId('up-file').setInputFiles(bizPdf)
await rowOf('businessRegistration').getByTestId('up-doc-done').waitFor({ timeout: 8000 })
const res1 = calls.filter((c) => c.fn === 'public_upload_reserve').at(-1)
const put1 = calls.filter((c) => c.fn === 'storage.put').at(-1)
check('P4 사업자등록증 올리기 → 예약(그 칸 · 이름 · 크기) → 서버가 정한 경로에 넣기 → 다 올림 → "1개 올렸어요"', res1?.body?.p_doc_key === 'businessRegistration' && res1.body.p_file_name === '사업자등록증 사진.pdf' && res1.body.p_size === PDF.length && put1?.key === files[0]?.storagePath && files[0].status === 'uploaded' && /1개 올렸어요/.test(await rowOf('businessRegistration').innerText()), JSON.stringify({ res1: res1?.body, put1: put1?.key, f: files[0] }))
// 브라우저 가로채기는 묶음(multipart) 안 파일 바이트를 넘겨주지 않는다(시험 도구 한계) — 파일 칸 · 종류 · 덮어쓰기 아님은 여기서, 크기는 P4 예약 값(p_size)으로 본다.
const body1 = (fileBytes[files[0].storagePath] ?? Buffer.alloc(0)).toString('utf8')
check('P4b 보관함에 간 것 = 파일 칸 하나 · PDF 종류 · 덮어쓰기 아님(x-upsert 없음 또는 false)', /Content-Disposition: form-data; name=""; filename="사업자등록증 사진\.pdf"/.test(body1) && /Content-Type: application\/pdf/.test(body1) && !/x-upsert['"]?:\s*['"]?true/i.test(JSON.stringify(put1?.headers ?? {})), JSON.stringify({ len: body1.length, head: body1.slice(0, 300) }))
const before = calls.filter((c) => c.fn === 'public_upload_reserve').length
await rowOf('financialStatements').getByTestId('up-file').setInputFiles(exe)
await rowOf('financialStatements').getByTestId('up-error').waitFor({ timeout: 5000 })
check('P5 실행 파일 → 서버에 가기 전에 쉬운 말로 막힘(예약 0)', /형식/.test(await rowOf('financialStatements').getByTestId('up-error').innerText()) && calls.filter((c) => c.fn === 'public_upload_reserve').length === before)
await rowOf('').getByTestId('up-file').setInputFiles(smeTxt)
await rowOf('').getByTestId('up-doc-done').waitFor({ timeout: 8000 })
check('P6 그 밖의 서류로도 올림 · 다 올렸으면 창 닫아도 된다는 한 줄', files[1]?.docKey === '' && files[1].status === 'uploaded' && (await up.getByTestId('up-all-done').count()) === 1)
// 예약 안 한 경로에 넣기 — 보관함이 막는다(흉내 정책 = 0031 정책)
const forged = await up.evaluate(async ([ref, ws, cid]) => {
  const r = await fetch(`https://${ref}.supabase.co/storage/v1/object/client-documents/${ws}/${cid}/businessRegistration/evil.pdf`, { method: 'POST', headers: { authorization: 'Bearer qa-anon', apikey: 'qa-anon' }, body: 'x' })
  return r.status
}, [REF, WS, CID])
check('P7 예약하지 않은 경로(서류 칸 폴더)에 직접 넣기 → 막힘', forged === 403, String(forged))
await up.goto(`${BASE}/up/00000000000000000000`, { waitUntil: 'networkidle' })
await up.getByTestId('up-closed').waitFor({ timeout: 8000 })
check('P8 없는 · 닫힌 주소 → "이 주소는 지금 서류를 받지 않아요" · 새 주소 물어보라는 한 줄', (await up.getByTestId('up-closed').count()) === 1 && (await up.locator('main').innerText()).includes('새 주소'))
check('P9 공개 화면 JS 오류 0', upErrors.length === 0, upErrors.join(' | '))

// ---------------------------------------------------------------- D-657 컨설턴트: 오늘 · 고객 관리에서 '고객이 올린 서류' 를 바로 안다
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const upChip = page.getByTestId('today-uploads-open')
await upChip.waitFor({ timeout: 8000 }).catch(() => {})
check("T1 오늘 머리 줄 '받은 서류 2개'(업체를 열지 않아도 누가 올렸는지)", (await upChip.count()) === 1 && (await upChip.getAttribute('data-count')) === '2' && /받은 서류 2개/.test(await upChip.innerText()), await upChip.innerText().catch(() => '없음'))
await upChip.click()
const upSheet = page.getByTestId('uploads-sheet')
await upSheet.waitFor()
check('T2 누르면 판 — 업체 한 줄 · 2개 · [넣으러 가기]', (await upSheet.getByTestId('uploads-row').count()) === 1 && /\(주\)업로드정밀/.test(await upSheet.innerText()) && /2개/.test(await upSheet.innerText()) && /넣으러 가기/.test(await upSheet.innerText()), await upSheet.innerText())
if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: join(SHOTS, 'today-uploads-pc.png') }) }
await upSheet.getByTestId('uploads-go').click()
await page.getByTestId('upload-link-sheet').waitFor({ timeout: 8000 }).catch(() => {})
check("T3 [넣으러 가기] → 그 업체 서류함 · '고객이 올린 서류' 판이 열린 채 · 주소의 inbox 값은 지워짐(새로 고쳐도 또 안 뜸)", new URL(page.url()).pathname === `/ops/clients/${CID}` && new URL(page.url()).searchParams.get('tab') === 'docs' && !new URL(page.url()).searchParams.has('inbox') && (await page.getByTestId('upload-link-sheet').getAttribute('data-view').catch(() => '')) === 'inbox', page.url())
await page.keyboard.press('Escape')
await page.goto(`${BASE}/ops/clients`, { waitUntil: 'networkidle' })
const cardUp = page.getByTestId('card-uploads')
await cardUp.first().waitFor({ timeout: 8000 }).catch(() => {})
check("T4 고객 관리 카드(접힌 채)에도 '받은 서류 2' 알약 · 그 카드는 '이상 없음' 대신 이 알약", (await cardUp.count()) === 1 && /받은 서류 2/.test(await cardUp.innerText()) && !/이상 없음/.test(await page.locator(`[data-testid="client-card"][data-client-id="${CID}"]`).innerText()), await cardUp.innerText().catch(() => '없음'))
if (SHOTS) await page.screenshot({ path: join(SHOTS, 'hub-card-uploads-pc.png') })
await cardUp.click()
await page.getByTestId('upload-link-sheet').waitFor({ timeout: 8000 }).catch(() => {})
check('T5 카드에서 눌러도 올린 서류 판이 열린 채', (await page.getByTestId('upload-link-sheet').getAttribute('data-view').catch(() => '')) === 'inbox')
await page.keyboard.press('Escape')
// D-663 종(알림) — 어느 화면에 있든
await page.goto(`${BASE}/ops/calendar`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: /챙길 것/ }).click()
const bellUp = page.getByTestId('bell-uploads')
await bellUp.waitFor({ timeout: 6000 }).catch(() => {})
check("T6 종에 '고객이 올린 서류 · 2개 — 칸에 넣기' → 누르면 그 업체 서류함(올린 서류 판)", (await bellUp.count()) === 1 && /2개 — 칸에 넣기/.test(await bellUp.innerText()))
if (SHOTS) await page.screenshot({ path: join(SHOTS, 'bell-uploads-pc.png') })
await bellUp.click()
await page.getByTestId('upload-link-sheet').waitFor({ timeout: 8000 }).catch(() => {})
check('T7 종에서 눌러도 올린 서류 판이 열린 채', new URL(page.url()).pathname === `/ops/clients/${CID}` && (await page.getByTestId('upload-link-sheet').getAttribute('data-view').catch(() => '')) === 'inbox', page.url())
await page.keyboard.press('Escape')

// ---------------------------------------------------------------- 컨설턴트: 받은 서류 넣기
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('I1 서류함 한 줄 — "고객이 올린 서류 2개"', /고객이 올린 서류 2개/.test(await page.getByTestId('upload-link-bar').innerText()), await page.getByTestId('upload-link-bar').innerText())
await page.getByTestId('upload-link-bar').click()
await sheet.waitFor({ timeout: 5000 })
check('I2 누르면 받은 서류 목록 — 2줄 · [모두 칸에 넣기 · 2개] · 칸 고르기(업체 대표가 고른 칸이 먼저 골라져 있음)', (await sheet.getAttribute('data-view')) === 'inbox' && (await sheet.getByTestId('upload-inbox-row').count()) === 2 && /모두 칸에 넣기 · 2개/.test(await sheet.getByTestId('upload-inbox-all').innerText()) && (await sheet.getByTestId('upload-inbox-slot').first().inputValue()) === 'businessRegistration')
if (SHOTS) { await page.waitForTimeout(900); await page.screenshot({ path: join(SHOTS, 'uplink-inbox-pc.png') }) }
const patchN = patches.length
await sheet.locator(`[data-testid="upload-inbox-row"][data-id="${files[0].id}"]`).getByTestId('upload-inbox-accept').click()
await page.getByText("'사업자등록증' 칸에 넣었어요").first().waitFor({ timeout: 8000 })
const biz = patches.slice(patchN).map((p) => p.payload?.documents?.businessRegistration).filter(Boolean).at(-1)
check("I3 [넣기] → 사업자등록증 칸 '받음' · 그 파일 경로 · 원래 이름 · 폴더 '고객이 올린 서류' · 받은 상태 accepted", biz?.received === true && biz.storagePath === files[0].storagePath && biz.fileName === '사업자등록증 사진.pdf' && biz.folderPath === '고객이 올린 서류' && files[0].status === 'accepted', JSON.stringify(biz))
await page.waitForTimeout(600)
await sheet.locator(`[data-testid="upload-inbox-row"][data-id="${files[1].id}"]`).getByTestId('upload-inbox-accept').click()
const toast2 = page.getByText(/칸에 넣었어요/).last()
await toast2.waitFor({ timeout: 8000 })
await page.waitForTimeout(400)
const t2 = (await page.getByRole('status').allInnerTexts()).join(' | ')
const docs2 = row.payload?.documents ?? {}
const smeKey = Object.keys(docs2).find((k) => docs2[k]?.storagePath === files[1].storagePath)
check("I4 그 밖의 서류 → 글자를 읽어 '중소기업 확인서' 칸으로(알아서 칸 정하기)", smeKey === 'smeCertificate' && /중소기업 확인서/.test(t2), `${smeKey} ${t2}`)
check('I5 다 넣으면 받은 서류 줄 0 → 서류함 한 줄은 링크 줄로(받은 2개)', (await page.getByTestId('upload-link-bar').count()) === 1 && /받은 2개/.test(await page.getByTestId('upload-link-bar').innerText()), await page.getByTestId('upload-link-bar').innerText().catch(() => ''))
// 되돌리기 — 마지막 넣기를 되돌리면 칸에서 빠지고 다시 '고객이 올린 서류'
await page.getByRole('button', { name: '되돌리기' }).last().click()
await page.waitForTimeout(1500)
const docs3 = row.payload?.documents ?? {}
check('I6 [되돌리기] → 그 칸에서 빠짐 · 받은 상태 uploaded · 서류함 한 줄 "고객이 올린 서류 1개"', !Object.values(docs3).some((d) => d?.storagePath === files[1].storagePath) && files[1].status === 'uploaded' && /고객이 올린 서류 1개/.test(await page.getByTestId('upload-link-bar').innerText().catch(() => '')), `${files[1].status} ${await page.getByTestId('upload-link-bar').innerText().catch(() => '')}`)
// 안 쓰기 — 받은 목록에서만 빠지고 되돌릴 수 있다(파일은 지우지 않음)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.getByTestId('upload-link-bar').click()
await sheet.waitFor({ timeout: 5000 })
await sheet.getByTestId('upload-inbox-dismiss').first().click()
await page.waitForTimeout(800)
check('I7 [넣지 않기] → dismissed · 파일 지우기 0', files[1].status === 'dismissed' && !calls.some((c) => c.fn === 'storage.delete'))
// 더보기 · 링크 고치기 · 새 주소 · 닫기
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
// D-666 받았다고 알리기 — 넣은 서류가 부탁한 서류였으니 업체 머리에 '보낼 안내 1건'(받은 것 · 남은 것 · 같은 올리기 주소)
{
  const gotChip = page.getByTestId('client-now')
  const gotCount = (await gotChip.getAttribute('data-kind').catch(() => '')) === 'notices' && /보낼 안내 1/.test(await gotChip.innerText().catch(() => '')) ? '1' : ''
  await gotChip.click().catch(() => {})
  const gotRow = page.getByTestId('notice-sheet').getByTestId('notice-row').first()
  await gotRow.getByTestId('notice-peek').click().catch(() => {})
  const gotText = await gotRow.getByTestId('notice-text').innerText().catch(() => '')
  check(
    "I8 D-666 넣고 나면 업체 알약 '보낼 안내 1'(서류 탭 — 하나뿐이라 누르면 바로 문구 판) → '받았다고 알리기 · 서류 1가지 받음 · 남은 1가지' · 받은 서류 사업자등록증 · 아직 남은 서류 재무제표 · 올리기 주소",
    gotCount === '1' && (await gotRow.getAttribute('data-kind').catch(() => '')) === 'got' && /서류 1가지 받음 · 남은 1가지/.test(await gotRow.getByTestId('notice-title').innerText().catch(() => '')) &&
      /받은 서류\n1\. 사업자등록증/.test(gotText) && /아직 남은 서류\n1\. [^\n]*재무제표/.test(gotText) && gotText.includes(linkUrl),
    gotText,
  )
  if (SHOTS) { await page.waitForTimeout(700); await page.screenshot({ path: join(SHOTS, 'uplink-got-pc.png') }) }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}
await page.getByTestId('client-more').click()
await page.getByTestId('more-upload-link').click()
await sheet.waitFor({ timeout: 5000 })
await sheet.getByTestId('upload-link-rotate').click()
check('L1 [새 주소] 한 번은 확인 글로 바뀜(바로 안 바뀜)', /예전 주소를 막고/.test(await sheet.getByTestId('upload-link-rotate').innerText()) && !calls.some((c) => c.fn === 'upload_link_rotate'))
await sheet.getByTestId('upload-link-rotate').click()
await page.waitForTimeout(800)
await page.waitForTimeout(500)
check('J7 D-656 새 주소로 바꾸면 업체 기록의 사본도 새 주소로', Boolean(row.payload?.uploadHint?.slug) && (await sheet.getByTestId('upload-link-url').inputValue()).endsWith(`/up/${row.payload.uploadHint.slug}`) && row.payload.uploadHint.slug !== hint5.slug, JSON.stringify(row.payload?.uploadHint))
check('L2 두 번째 누르면 새 주소 · 화면 주소도 바뀜', calls.some((c) => c.fn === 'upload_link_rotate') && (await sheet.getByTestId('upload-link-url').inputValue()).endsWith(SLUGS[1]))
await sheet.getByTestId('upload-link-off').click()
await sheet.getByTestId('upload-link-off').click()
await page.waitForTimeout(800)
check('L3 [링크 닫기] 두 번 → 닫힘(받은 서류 기록은 그대로)', calls.some((c) => c.fn === 'upload_link_off') && link === null && files.length === 2)
await page.waitForTimeout(500)
check('J8 D-656 링크를 닫으면 사본도 지움(다시 부탁 문구에 죽은 주소를 붙이지 않게) · 요청 기록은 그대로', row.payload?.uploadHint === undefined && (row.payload?.docRequests ?? []).length === 1, JSON.stringify(Object.keys(row.payload ?? {})))
// D-656 반대 길 — 요청 문구 창에서 바로 링크를 만들어 붙인다(링크가 없을 때만 단추가 보인다)
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
// 진행 중인 업무가 있어야 '받을 서류' 가 생긴다 — 사업목적 추가(사업자등록증 · 법인등기부등본 · 공동인증서)를 진행 중으로
row = { ...row, payload: { ...row.payload, services: { ...(row.payload.services ?? {}), businessScope: { status: 'in_progress' } } }, updated_at: new Date().toISOString() }
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByTestId('client-more').click()
await page.getByTestId('more-doc-request').click()
const dlg = page.getByRole('dialog')
const askBefore = await dlg.locator('textarea').inputValue()
const toolBtn = dlg.getByTestId('message-tool')
check('J9 요청 문구 창 — 링크가 없으면 [올리기 링크 붙이기] 한 단추 · 문구에는 아직 주소 없음', (await toolBtn.count()) === 1 && /올리기 링크 붙이기/.test(await toolBtn.innerText()) && !askBefore.includes('/up/'), askBefore.slice(-120))
const savesBefore = calls.filter((c) => c.fn === 'upload_link_save').length
await toolBtn.click()
await dlg.getByTestId('message-tool-done').waitFor({ timeout: 5000 })
const after2 = await dlg.locator('textarea').inputValue()
const made2 = calls.filter((c) => c.fn === 'upload_link_save').at(-1)
check('J10 누르면 → 문구의 서류(서류함 칸이 있는 것)로 링크 · 14일 → 끝인사 앞에 주소 한 줄(나머지 글은 그대로) · 단추는 사라지고 한 줄 알림 · 업체 기록에 사본', calls.filter((c) => c.fn === 'upload_link_save').length === savesBefore + 1 && made2.body.p_days === 14 && made2.body.p_docs.length >= 1 && after2.includes(`/up/${row.payload?.uploadHint?.slug}`) && after2.indexOf('/up/') < after2.lastIndexOf('감사합니다') && after2.trimEnd().endsWith('감사합니다.') && after2.replace(/\n\n아래 주소를[^\n]*\n[^\n]*\/up\/[^\n]*/, '').trimEnd() === askBefore.trimEnd() && (await dlg.getByTestId('message-tool').count()) === 0 && /주소를 붙였어요/.test(await dlg.getByTestId('message-tool-done').innerText()), JSON.stringify({ docs: made2?.body?.p_docs, tail: after2.slice(-160) }))
if (SHOTS) await page.screenshot({ path: join(SHOTS, 'uplink-request-tool-pc.png') })
const journalBefore = journal.length
await dlg.getByTestId('message-followup').click()
await dlg.getByTestId('message-followup-done').waitFor({ timeout: 5000 })
const reqs3 = row.payload?.docRequests ?? []
check("J11 그 문구로 [보냈어요 · 3일 뒤 받았는지 확인] → 새 요청 · 새 할 일(주소 줄은 서류 줄로 세지 않음)", journal.length === journalBefore + 1 && reqs3.length === 2 && reqs3[0].items.every((i) => !/up\//.test(i.label)), JSON.stringify(reqs3.map((r) => r.items.map((i) => i.label))))
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('L4 컨설턴트 화면 JS 오류 0', errors.length === 0, errors.join(' | '))

// 휴대폰에서 컨설턴트 판(390) — 옆 넘침 0
const ph2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
await ph2.addInitScript(([ref, s, ws]) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
  localStorage.setItem('axmvp.active_workspace', ws)
  localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
}, [REF, session, WS])
await routeCloud(ph2, 'owner390')
const p2 = await ph2.newPage()
await p2.goto(`${BASE}/ops/clients/${CID}?tab=docs`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(800)
await p2.getByTestId('docs-upload-link').click()
await p2.getByTestId('upload-link-sheet').waitFor({ timeout: 5000 })
await p2.waitForTimeout(400)
const over = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check('M1 휴대폰 390 — [링크로 받기] 판 옆 넘침 0', over <= 0, String(over))
if (SHOTS) { await p2.waitForTimeout(900); await p2.screenshot({ path: join(SHOTS, 'uplink-make-390.png') }) }
// 휴대폰 한 줄 걷기(390) — 고객이 하나 더 올린 뒤: 오늘 칩 → 판 → 업체 넣기 판 · 고객 카드 알약(옆 넘침 0 · 손가락 크기)
files[1].status = 'uploaded'
await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' })
const chip390 = p2.getByTestId('today-uploads-open')
await chip390.waitFor({ timeout: 10_000 }).catch(() => {})
await chip390.scrollIntoViewIfNeeded().catch(() => {})
const chipBox = await chip390.boundingBox().catch(() => null)
const overT = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check("M2 휴대폰 오늘 — 숫자 칩 줄에 '받은 서류 1개' 칩(높이 36px 이상) · 옆 넘침 0", /받은 서류\s*1개/.test((await chip390.innerText().catch(() => '')).replace(/\s+/g, ' ')) && (chipBox?.height ?? 0) >= 36 && overT <= 0, `${chipBox?.height} over=${overT}`)
if (SHOTS) await p2.screenshot({ path: join(SHOTS, 'today-uploads-390.png') })
await chip390.tap().catch(() => {})
const sheet390 = p2.getByTestId('uploads-sheet')
await sheet390.waitFor({ timeout: 5000 }).catch(() => {})
const goBox = await sheet390.getByTestId('uploads-go').first().boundingBox().catch(() => null)
check('M3 누르면 아래 판 — 업체 한 줄 · [넣으러 가기] 높이 40px 이상 · 옆 넘침 0', (await sheet390.getByTestId('uploads-row').count()) === 1 && (goBox?.height ?? 0) >= 40 && (await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, String(goBox?.height))
if (SHOTS) { await p2.waitForTimeout(700); await p2.screenshot({ path: join(SHOTS, 'uploads-sheet-390.png') }) }
await sheet390.getByTestId('uploads-go').first().tap().catch(() => {})
await p2.getByTestId('upload-inbox').waitFor({ timeout: 8000 }).catch(() => {})
const acceptBox = await p2.getByTestId('upload-inbox-accept').first().boundingBox().catch(() => null)
check('M4 [넣으러 가기] → 그 업체 넣기 판(390) — 1줄 · [넣기] 높이 40px 이상 · 옆 넘침 0', (await p2.getByTestId('upload-inbox-row').count()) === 1 && (acceptBox?.height ?? 0) >= 40 && (await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, String(acceptBox?.height))
if (SHOTS) { await p2.waitForTimeout(700); await p2.screenshot({ path: join(SHOTS, 'uplink-inbox-390.png') }) }
await p2.goto(`${BASE}/ops/clients`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(1600)
const card390 = p2.getByTestId('card-uploads').first()
const cardBox = await card390.boundingBox().catch(() => null)
check("M5 휴대폰 고객 관리 — 카드 머리 '받은 서류 1' 알약 · 옆 넘침 0", /받은 서류\s*1/.test((await card390.innerText().catch(() => '')).replace(/\s+/g, ' ')) && (cardBox?.height ?? 0) >= 24 && (await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, String(cardBox?.height))
if (SHOTS) await p2.screenshot({ path: join(SHOTS, 'hub-card-uploads-390.png') })

await browser.close()
stop()
console.log(`\n통과 ${pass} · 실패 ${fail}`)
process.exit(fail ? 1 : 0)
