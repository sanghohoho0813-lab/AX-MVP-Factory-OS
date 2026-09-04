/**
 * 고객 → 내부 OS → 고객 왕복 E2E
 *
 * 손으로 쓴 픽스처를 쓰지 않는다. payloads.json 은 실제 마이그레이션이 적용된
 * PostgreSQL 에서 실제 SQL 함수(portal_my_projects / portal_project /
 * portal_preview_project / customer_events)가 만들어낸 응답을 그대로 받아온 것이다.
 * 여기서는 그 응답을 두 앱의 진짜 화면에 먹여서 UI 까지 왕복이 닫히는지 본다.
 *
 * 검증하지 못하는 것: 실제 로그인/이메일 인증, Production Supabase 네트워크.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const PUBLIC = process.env.PUBLIC_BASE ?? 'http://localhost:4532'
const INTERNAL = process.env.INTERNAL_BASE ?? 'http://localhost:4534'
const REF = 'qaproject'
const OUT = process.env.OUT ?? './shots-roundtrip'
const P = JSON.parse(readFileSync('./payloads.json', 'utf8'))

const results = []
const errs = []
function log(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
let diagPage = null
async function step(name, fn) {
  try {
    const r = await fn()
    log(name, r !== false, typeof r === 'string' ? r : '')
  } catch (e) {
    log(name, false, String(e).split('\n')[0].slice(0, 220))
    if (process.env.DIAG) console.log('      ↳ full=' + String(e).split('\n').slice(0, 8).join(' / ').slice(0, 700))
    if (process.env.DIAG && diagPage) {
      try {
        const t = (await diagPage.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 500)
        console.log('      ↳ url=' + diagPage.url())
        console.log('      ↳ body=' + t)
      } catch { /* 페이지가 닫혔을 수 있다 */ }
    }
  }
}

const session = (userId, email) => ({
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: {
    id: userId, aud: 'authenticated', role: 'authenticated', email,
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
  },
})

const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/** 고정 sleep 대신, 화면에 문구가 실제로 나타날 때까지 기다린다 */
async function waitForText(page, text, timeout = 15000) {
  await page.waitForFunction(
    (t) => (document.body?.innerText ?? '').includes(t),
    text,
    { timeout },
  )
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* =====================================================================
 * PART A — 고객 앱: 프로젝트를 보고, 조치 완료 / 요청 / 서류 업로드
 * ===================================================================== */
const custCtx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' })
const cust = await custCtx.newPage()
diagPage = cust
cust.on('pageerror', (e) => errs.push('[customer] ' + String(e)))
// 프록시가 막는 외부 폰트 CDN·favicon 은 앱 오류가 아니다
const IGNORE = /font|favicon|ERR_CONNECTION_RESET|ERR_BLOCKED/i
cust.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push('[customer] ' + m.text()) })
cust.on('requestfailed', (r) => { if (!/supabase\.co|localhost/.test(r.url())) return; errs.push('[customer] 요청 실패 ' + r.url()) })

// 고객이 실제로 한 행동에 따라서만 서버 응답이 넘어간다.
// 각 스냅샷은 shadow DB 에서 그 시점에 실제로 나온 응답이다.
let stage = 'stage1'                // stage1 → after_action → after_request → stage2 → stage3
const rpcCalls = []                 // 고객 앱이 실제로 호출한 RPC
const restPaths = []                // 내부 테이블을 건드리지 않는지 확인용

await custCtx.addInitScript(([ref, s]) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
}, [REF, session(P.customer_id, 'portal-test@miraeailab.com')])

await cust.route(`https://${REF}.supabase.co/**`, async (route) => {
  const url = new URL(route.request().url())
  const path = url.pathname
  restPaths.push(path)

  if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session(P.customer_id, 'portal-test@miraeailab.com')))
  if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session(P.customer_id, 'portal-test@miraeailab.com').user))

  if (path.endsWith('/rpc/portal_my_projects')) return route.fulfill(json(P[`${stage}_projects`]))
  if (path.endsWith('/rpc/portal_project')) return route.fulfill(json(P[`${stage}_project`]))

  if (path.endsWith('/rpc/portal_complete_action')) { rpcCalls.push('portal_complete_action'); stage = 'after_action'; return route.fulfill(json(true)) }
  if (path.endsWith('/rpc/portal_create_request')) { rpcCalls.push('portal_create_request'); stage = 'after_request'; return route.fulfill(json(P.stage2_project.requests[0].id)) }
  if (path.endsWith('/rpc/portal_upload_path')) {
    rpcCalls.push('portal_upload_path')
    return route.fulfill(json(`${P.workspace_id}/portal/${P.link_id}/${Date.now()}-biz.pdf`))
  }
  if (path.endsWith('/rpc/portal_register_document')) { rpcCalls.push('portal_register_document'); stage = 'stage2'; return route.fulfill(json(P.stage2_project.documents[0].id)) }

  if (path.startsWith('/storage/v1/object/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' })
  if (path.includes('/rest/v1/profiles')) {
    return route.fulfill(json([{
      id: P.customer_id, email: 'portal-test@miraeailab.com', name: '테스트고객',
      member_type: 'business', phone: '010-0000-0000', phone_verified: true,
      created_at: '2026-01-01T00:00:00Z',
    }]))
  }
  if (path.includes('/rest/v1/user_roles')) return route.fulfill(json([{ role: 'business' }]))
  return route.fulfill(json([]))
})

await step('A1 고객: 내 프로젝트 목록 (실제 portal_my_projects 응답)', async () => {
  await cust.goto(`${PUBLIC}/my-projects`, { waitUntil: 'networkidle' })
  const expect = P.stage1_projects[0]
  await waitForText(cust, expect.name)
  await cust.screenshot({ path: `${OUT}/A1-projects.png` })
  return `name=${expect.name} pending=${expect.pending_actions} docs=${expect.requested_documents}`
})

await step('A2 고객: 상세 진입 — 해야 할 일 배너', async () => {
  await cust.getByText(P.stage1_projects[0].name).first().click()
  const title = P.stage1_project.updates.find((u) => u.action_required)?.title
  if (!title) throw new Error('조치 필요 업데이트가 payload 에 없음')
  await waitForText(cust, title)
  await cust.screenshot({ path: `${OUT}/A2-detail.png` })
  return title
})

await step('A3 고객: 내부 정보가 화면에 없다', async () => {
  const html = await cust.content()
  const leaks = ['7700000', '내부 메모', 'internal_note', 'handling_note', 'operations_client_id', '지난번 것은 만료', '초안']
    .filter((s) => html.includes(s))
  if (leaks.length) throw new Error(`누출: ${leaks.join(', ')}`)
  return '누출 0'
})

await step('A4 고객: "완료했어요" → portal_complete_action 호출', async () => {
  const btn = cust.getByRole('button', { name: /완료|했어요|올렸어요/ }).first()
  await btn.waitFor({ state: 'visible', timeout: 15000 })
  await btn.click()
  await cust.waitForTimeout(1200)
  if (!rpcCalls.includes('portal_complete_action')) throw new Error('RPC 미호출')
  return 'stage → 2'
})

await step('A5 고객: 요청 보내기 → portal_create_request 호출', async () => {
  const tab = cust.getByRole('button', { name: /내 요청/ }).first()
  await tab.click()
  await cust.waitForTimeout(700)
  const kind = cust.getByRole('button', { name: '진행상태 문의' }).first()
  if (await kind.count()) await kind.click()
  const subject = cust.getByPlaceholder(/진행 상황이 궁금합니다|한 줄|무엇을 문의/).first()
  await subject.waitFor({ state: 'visible', timeout: 10000 })
  await subject.fill('진행 상황이 궁금합니다')
  const ta = cust.locator('textarea').first()
  if (await ta.count()) await ta.fill('접수까지 얼마나 걸릴까요?')
  await cust.getByRole('button', { name: '보내기' }).first().click()
  await cust.waitForTimeout(1200)
  if (!rpcCalls.includes('portal_create_request')) throw new Error('RPC 미호출')
  return 'ok'
})

await step('A6 고객: 서류 업로드 → 경로 발급 + 등록 (서버 발급 경로만)', async () => {
  const tab = cust.getByRole('button', { name: /서류/ }).first()
  if (await tab.count()) { await tab.click(); await cust.waitForTimeout(700) }
  const file = cust.locator('input[type="file"]').first()
  await file.waitFor({ state: 'attached', timeout: 15000 })
  await file.setInputFiles({ name: '사업자등록증.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
  await cust.waitForTimeout(1200)
  if (!rpcCalls.includes('portal_upload_path')) throw new Error('portal_upload_path 미호출')
  if (!rpcCalls.includes('portal_register_document')) throw new Error('portal_register_document 미호출')
  await cust.screenshot({ path: `${OUT}/A6-uploaded.png` })
  return 'upload_path → storage → register'
})

await step('A7 고객 앱이 내부 테이블을 부르지 않았다', async () => {
  const bad = restPaths.filter((p) => /rest\/v1\/(operations_clients|ops_journal_entries|portal_client_links|customer_events|workspaces|workspace_members|portal_updates|portal_documents|portal_requests)/.test(p))
  if (bad.length) throw new Error(`내부 테이블 호출: ${[...new Set(bad)].join(', ')}`)
  return `${restPaths.length} calls, 내부 테이블 0`
})

/* =====================================================================
 * PART B — 내부 OS(supabase 모드): 고객 행동이 이벤트함에 뜬다  ← 왕복 ①
 * ===================================================================== */
const opsCtx = await b.newContext({ viewport: { width: 1440, height: 950 }, locale: 'ko-KR' })
const ops = await opsCtx.newPage()
diagPage = ops
ops.on('pageerror', (e) => errs.push('[internal] ' + String(e)))
ops.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push('[internal] ' + m.text()) })

const OWNER = P.inbox_events[0]?.created_by ?? '00000000-0000-0000-0000-000000000001'
await opsCtx.addInitScript(([ref, s, ws]) => {
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
  localStorage.setItem('axmvp.active_workspace', ws)
  localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
}, [REF, session(OWNER, 'owner-test@miraeailab.com'), P.workspace_id])

let eventsPatched = 0
await ops.route(`https://${REF}.supabase.co/**`, async (route) => {
  const url = new URL(route.request().url())
  const path = url.pathname
  const method = route.request().method()

  if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session(OWNER, 'owner-test@miraeailab.com')))
  if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session(OWNER, 'owner-test@miraeailab.com').user))

  if (path.includes('/rest/v1/customer_events')) {
    if (method === 'PATCH') { eventsPatched += 1; return route.fulfill(json([{ ...P.inbox_events[0], status: 'resolved' }])) }
    return route.fulfill(json(P.inbox_events))
  }
  if (path.includes('/rest/v1/workspace_members')) {
    return route.fulfill(json([{ workspace_id: P.workspace_id, user_id: OWNER, role: 'owner',
      workspaces: { id: P.workspace_id, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
  }
  if (path.includes('/rest/v1/workspaces')) {
    return route.fulfill(json([{ id: P.workspace_id, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
  }
  if (path.includes('/rest/v1/operations_clients')) return route.fulfill(json([]))
  if (path.includes('/rest/v1/ui_preferences')) return route.fulfill(json([]))
  return route.fulfill(json([]))
})

await step('B1 내부 OS: 이벤트함이 실제 customer_events 3건을 렌더', async () => {
  await ops.goto(`${INTERNAL}/ops/inbox`, { waitUntil: 'networkidle' })
  await ops.waitForSelector('article', { timeout: 15000 })
  const body = await ops.locator('body').innerText()
  if (/준비하고 있습니다|준비 중/.test(body)) throw new Error('READY 안내가 떠 있다 (브릿지 미인식)')
  const cards = await ops.locator('article').count()
  if (cards < P.inbox_events.length) throw new Error(`카드 ${cards}개 < 이벤트 ${P.inbox_events.length}개`)
  await ops.screenshot({ path: `${OUT}/B1-inbox.png` })
  return `cards=${cards}`
})

await step('B2 왕복① 고객 "요청"이 이벤트함에 보인다', async () => {
  const body = await ops.locator('body').innerText()
  const ev = P.inbox_events.find((e) => e.event_type === 'customer_request_created')
  if (!ev) throw new Error('요청 이벤트가 payload 에 없음')
  const title = ev.customer_safe_payload?.title
  if (!body.includes(title)) throw new Error(`"${title}" 이 화면에 없음`)
  return title
})

await step('B3 왕복① 고객 "서류 업로드"가 이벤트함에 보인다', async () => {
  const body = await ops.locator('body').innerText()
  const ev = P.inbox_events.find((e) => e.event_type === 'document_uploaded')
  if (!ev) throw new Error('서류 이벤트가 payload 에 없음')
  const file = ev.customer_safe_payload?.file_name
  const title = ev.customer_safe_payload?.title
  const shown = [file, title].filter((s) => s && body.includes(s))
  if (!shown.length) throw new Error(`"${file}" / "${title}" 둘 다 화면에 없음`)
  return shown.join(' · ')
})

await step('B4 이벤트가 고객사와 연결된 상태로 보인다', async () => {
  const body = await ops.locator('body').innerText()
  if (!body.includes('연결됨')) throw new Error('"연결됨" 표시 없음')
  return 'linked'
})

await step('B5 처리 완료 → customer_events PATCH 발생', async () => {
  const btn = ops.locator('article').first().getByRole('button', { name: '처리 완료' }).first()
  await btn.waitFor({ state: 'visible', timeout: 15000 })
  await btn.click()
  await ops.waitForTimeout(1200)
  if (eventsPatched === 0) throw new Error('PATCH 미발생')
  return `patched=${eventsPatched}`
})

/* =====================================================================
 * PART C — 고객 앱: 내부가 발행한 업데이트가 보인다  ← 왕복 ②
 * ===================================================================== */
stage = 'stage3'
diagPage = cust
await step('C1 왕복② 내부 발행 업데이트가 고객 화면에 보인다', async () => {
  const published = P.stage3_project.updates.find((u) => u.title.includes('확인했습니다'))
  if (!published) throw new Error('발행 업데이트가 payload 에 없음')
  await cust.goto(`${PUBLIC}/my-projects/${P.link_id}`, { waitUntil: 'networkidle' })
  await cust.waitForTimeout(800)
  const tab = cust.getByRole('button', { name: /업데이트/ }).first()
  if (await tab.count()) { await tab.click(); await cust.waitForTimeout(600) }
  await waitForText(cust, published.title)
  await cust.screenshot({ path: `${OUT}/C1-update-visible.png` })
  return published.title
})

await step('C2 왕복② 초안(미발행)은 고객에게 보이지 않는다', async () => {
  const html = await cust.content()
  if (html.includes('초안')) throw new Error('초안이 노출됐다')
  return '초안 비노출'
})

await step('C3 왕복② 발행 후에도 내부 정보 누출 0', async () => {
  const html = await cust.content()
  const leaks = ['7700000', '내부 메모', 'internal_note', 'handling_note', 'operations_client_id', 'workspace_id']
    .filter((s) => html.includes(s))
  if (leaks.length) throw new Error(`누출: ${leaks.join(', ')}`)
  return '누출 0'
})

await step('C4 내부 "고객 화면 보기" 투영 == 고객이 실제로 받은 투영', async () => {
  const a = JSON.stringify(P.preview_after_publish)
  const c = JSON.stringify(P.stage3_project)
  if (a !== c) throw new Error('내부 미리보기와 고객 투영이 다르다')
  return 'byte-identical'
})

/* ---------------------------------------------------------------- */
const passed = results.filter((r) => r.ok).length
console.log(`\n왕복 E2E: ${passed}/${results.length} passed`)
if (errs.length) {
  console.log('JS 오류:')
  for (const e of [...new Set(errs)].slice(0, 10)) console.log('  ' + e.slice(0, 200))
} else console.log('JS 오류 없음')
await b.close()
process.exit(passed === results.length && errs.length === 0 ? 0 : 1)
