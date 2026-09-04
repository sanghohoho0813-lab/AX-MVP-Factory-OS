#!/usr/bin/env node
/**
 * 고객 ↔ 내부 OS 왕복을 실제 Supabase 에서 준비하고 검증한다.
 *
 *   node scripts/roundtrip-live.mjs prepare   테스트 고객 계정 · 업체 · 서류 요청까지 준비
 *   node scripts/roundtrip-live.mjs verify    고객이 한 행동이 내부 이벤트함에 들어왔는지 확인
 *   node scripts/roundtrip-live.mjs watch     들어올 때까지 지켜본다 (기본 10분)
 *   node scripts/roundtrip-live.mjs cleanup   이 스크립트가 만든 것만 삭제
 *
 * 환경변수 (셸에서만 준다 — 파일로 커밋하지 않는다)
 *   SUPABASE_URL                 https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    서버 전용 키. 브라우저·저장소에 절대 넣지 않는다.
 *   TEST_CUSTOMER_EMAIL          (선택) 기본 portal-test@miraeailab.com
 *   TEST_CUSTOMER_PASSWORD       (선택) 없으면 임의 생성해 출력한다
 *
 * 안전장치
 *   - 건드리는 행은 operations_clients.id = 'cli_roundtrip_check' 에 매달린 것뿐이다.
 *   - 실제 고객 데이터는 읽지도 쓰지도 않는다.
 *   - 키는 화면에 출력하지 않는다.
 */

const TEST_CLIENT_ID = 'cli_roundtrip_check'
const TEST_COMPANY = '왕복테스트(주)'
const DOC_TITLE = '사업자등록증(테스트)'

const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const EMAIL = process.env.TEST_CUSTOMER_EMAIL ?? 'portal-test@miraeailab.com'

if (!URL_BASE || !KEY) {
  console.error('SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 환경변수로 주세요.')
  process.exit(2)
}

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

async function api(path, init = {}) {
  const res = await fetch(`${URL_BASE}${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } })
  const text = await res.text()
  let body = null
  if (text) { try { body = JSON.parse(text) } catch { body = text } }
  if (!res.ok) {
    const msg = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${msg?.slice(0, 300)}`)
  }
  return body
}

const rest = (t, q = '') => api(`/rest/v1/${t}${q}`)
const insert = (t, row, prefer = 'return=representation') =>
  api(`/rest/v1/${t}`, { method: 'POST', body: JSON.stringify(row), headers: { Prefer: prefer } })
const patch = (t, q, row) =>
  api(`/rest/v1/${t}${q}`, { method: 'PATCH', body: JSON.stringify(row), headers: { Prefer: 'return=representation' } })
const del = (t, q) => api(`/rest/v1/${t}${q}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } })

const ok = (b) => (b ? '✅' : '❌')

/* ------------------------------------------------------------------ */
/* 공통 조회                                                            */
/* ------------------------------------------------------------------ */

/** 유입 워크스페이스 — 라우팅 테이블 우선, 없으면 가장 오래된 워크스페이스 */
async function resolveWorkspace() {
  const routed = await rest('customer_intake_routing', '?select=workspace_id&is_default=is.true&order=created_at.asc&limit=1')
  if (routed?.length) return routed[0].workspace_id
  const ws = await rest('workspaces', '?select=id&order=created_at.asc&limit=1')
  if (!ws?.length) throw new Error('워크스페이스가 없습니다. 내부 OS 에 먼저 로그인해 워크스페이스를 만드세요.')
  return ws[0].id
}

async function findCustomer() {
  const rows = await rest('profiles', `?select=id,email&email=eq.${encodeURIComponent(EMAIL)}&limit=1`)
  return rows?.[0] ?? null
}

async function findLink() {
  const rows = await rest(
    'portal_client_links',
    `?select=id,workspace_id,operations_client_id,profile_id,display_name&operations_client_id=eq.${TEST_CLIENT_ID}&limit=1`,
  )
  return rows?.[0] ?? null
}

/* ------------------------------------------------------------------ */
/* prepare                                                             */
/* ------------------------------------------------------------------ */

async function ensureAuthUser() {
  const existing = await findCustomer()
  if (existing) return { id: existing.id, created: false, password: null }

  const password =
    process.env.TEST_CUSTOMER_PASSWORD ??
    `Mirae!${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 90 + 10)}`

  const user = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: EMAIL,
      password,
      email_confirm: true,                     // 이메일 인증 단계를 건너뛴다
      user_metadata: { name: '왕복테스트 고객', member_type: 'business' },
    }),
  })
  return { id: user.id, created: true, password }
}

async function prepare() {
  console.log(`대상: ${URL_BASE}\n`)

  const wsId = await resolveWorkspace()
  console.log(`  워크스페이스     ${wsId}`)

  const user = await ensureAuthUser()
  console.log(`  고객 계정        ${EMAIL} (${user.created ? '새로 생성' : '이미 있음'})`)

  // 공개 사이트 온보딩 게이트를 통과시킨다 (member_type 이 비면 /auth/onboarding 으로 밀려난다)
  await patch('profiles', `?id=eq.${user.id}`, { member_type: 'business', phone_verified: true })
  console.log('  프로필           member_type=business · phone_verified=true (온보딩 통과)')

  // 테스트 업체
  await insert(
    'operations_clients',
    {
      id: TEST_CLIENT_ID,
      workspace_id: wsId,
      company_name: TEST_COMPANY,
      payload: {
        fees: [{ amount: 5500000, label: '착수금(테스트)' }],
        notes: '내부 메모(테스트) — 고객 화면에 보이면 안 된다',
      },
    },
    'resolution=merge-duplicates,return=representation',
  )
  console.log(`  업체             ${TEST_COMPANY} (${TEST_CLIENT_ID})`)

  // 고객 플랫폼 연결
  let link = await findLink()
  if (!link) {
    const rows = await insert('portal_client_links', {
      workspace_id: wsId,
      operations_client_id: TEST_CLIENT_ID,
      profile_id: user.id,
      display_name: `${TEST_COMPANY} 벤처인증(테스트)`,
      consultant_name: '김상호',
    })
    link = rows[0]
  }
  console.log(`  계정 연결        ${link.id}`)

  // 내부가 요청해 둔 서류 (고객이 여기에 올린다)
  const docs = await rest(
    'portal_documents',
    `?select=id,status&portal_client_link_id=eq.${link.id}&document_type=eq.businessRegistration&limit=1`,
  )
  if (!docs?.length) {
    await insert('portal_documents', {
      workspace_id: wsId,
      portal_client_link_id: link.id,
      operations_client_id: TEST_CLIENT_ID,
      document_type: 'businessRegistration',
      title: DOC_TITLE,
      status: 'requested',
      customer_note: '3개월 이내 발급본으로 부탁드립니다',
      internal_note: '내부 메모(테스트) — 고객에게 보이면 안 된다',
      requested_at: new Date().toISOString(),
    })
    console.log(`  서류 요청        ${DOC_TITLE} (requested)`)
  } else {
    console.log(`  서류 요청        ${DOC_TITLE} (이미 있음 · status=${docs[0].status})`)
  }

  console.log('\n준비 끝. 고객 플랫폼 Preview 에 아래로 로그인하세요.')
  console.log(`  이메일   ${EMAIL}`)
  console.log(`  비밀번호 ${user.password ?? '(기존 계정 — 이미 정한 비밀번호)'}`)
  console.log('\n로그인 후 /my-projects 에서 두 가지만 해주세요.')
  console.log('  ① 내 요청 탭 → 제목 "벤처인증 진행 상황이 궁금합니다" 로 보내기')
  console.log('  ② 서류 탭 → 요청받은 사업자등록증에 PDF 아무거나 올리기')
  console.log('\n그다음:  node scripts/roundtrip-live.mjs watch')
}

/* ------------------------------------------------------------------ */
/* verify                                                              */
/* ------------------------------------------------------------------ */

async function collect() {
  const link = await findLink()
  if (!link) return { link: null }

  const events = await rest(
    'customer_events',
    `?select=id,event_type,status,priority,operations_client_id,customer_safe_payload,occurred_at` +
      `&portal_client_link_id=eq.${link.id}&order=occurred_at.desc&limit=50`,
  )
  const request = events.find((e) => e.event_type === 'customer_request_created')
  const upload = events.find((e) => e.event_type === 'document_uploaded')
  const docs = await rest(
    'portal_documents',
    `?select=id,title,status,file_name,storage_path&portal_client_link_id=eq.${link.id}`,
  )
  return { link, events, request, upload, docs }
}

function report(s) {
  const { link, request, upload, docs } = s
  const uploaded = docs?.find((d) => d.status === 'uploaded')
  const pathOk =
    uploaded?.storage_path?.startsWith(`${link.workspace_id}/portal/${link.id}/`) ?? false

  const checks = [
    ['① 고객 요청이 이벤트함에 들어옴', !!request, request ? request.customer_safe_payload?.title ?? '' : '아직 없음'],
    ['① 요청 이벤트에 고객사 id 채워짐', request?.operations_client_id === TEST_CLIENT_ID, request?.operations_client_id ?? '-'],
    ['① 요청 이벤트가 연결됨 상태', request?.status === 'linked', request?.status ?? '-'],
    ['② 서류 업로드가 이벤트함에 들어옴', !!upload, upload ? upload.customer_safe_payload?.file_name ?? upload.customer_safe_payload?.title ?? '' : '아직 없음'],
    ['② 업로드 이벤트에 고객사 id 채워짐', upload?.operations_client_id === TEST_CLIENT_ID, upload?.operations_client_id ?? '-'],
    ['② 서류가 uploaded 로 바뀜', !!uploaded, uploaded ? `${uploaded.title} · ${uploaded.file_name ?? ''}` : '아직 requested'],
    ['② 업로드 경로가 서버 발급 규칙을 지킴', pathOk, uploaded?.storage_path ?? '-'],
  ]

  // 한글은 폭이 2 이므로 코드포인트 수로 맞추면 표가 어긋난다
  const w = (t) => [...t].reduce((n, ch) => n + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1), 0)
  const width = Math.max(...checks.map((c) => w(c[0])))
  for (const [name, pass, detail] of checks) {
    console.log(`  ${ok(pass)} ${name}${' '.repeat(width - w(name))}  ${detail}`)
  }
  const passed = checks.filter((c) => c[1]).length
  console.log(`\n  ${passed}/${checks.length} 통과`)
  return passed === checks.length
}

async function verify() {
  const s = await collect()
  if (!s.link) {
    console.error('연결이 없습니다. 먼저 prepare 를 실행하세요.')
    process.exit(1)
  }
  console.log(`대상: ${URL_BASE}\n연결: ${s.link.display_name} (${s.link.id})\n`)
  const allOk = report(s)
  if (!allOk) {
    console.log('\n아직 안 들어온 항목이 있으면, 고객 화면에서 해당 동작을 하고 다시 실행하세요.')
    console.log('또는:  node scripts/roundtrip-live.mjs watch')
  }
  process.exit(allOk ? 0 : 1)
}

async function watch() {
  const minutes = Number(process.env.WATCH_MINUTES ?? 10)
  const until = Date.now() + minutes * 60_000
  console.log(`대상: ${URL_BASE}\n${minutes}분 동안 15초마다 확인합니다. 고객 화면에서 ①② 를 해주세요.\n`)
  let last = ''
  for (;;) {
    const s = await collect()
    if (!s.link) { console.error('연결이 없습니다. 먼저 prepare 를 실행하세요.'); process.exit(1) }
    const sig = `${!!s.request}${!!s.upload}${s.docs?.find((d) => d.status === 'uploaded')?.id ?? ''}`
    if (sig !== last) {
      last = sig
      console.log(`[${new Date().toLocaleTimeString('ko-KR')}]`)
      if (report(s)) { console.log('\n왕복 ①② 모두 통과했습니다.'); process.exit(0) }
      console.log('')
    }
    if (Date.now() > until) { console.log('\n시간이 다 됐습니다. 마지막 상태는 위와 같습니다.'); process.exit(1) }
    await new Promise((r) => setTimeout(r, 15_000))
  }
}

/* ------------------------------------------------------------------ */
/* cleanup                                                             */
/* ------------------------------------------------------------------ */

async function cleanup() {
  const link = await findLink()
  if (link) {
    for (const t of ['customer_events', 'portal_updates', 'portal_requests', 'portal_documents']) {
      const gone = await del(t, `?portal_client_link_id=eq.${link.id}`)
      console.log(`  ${t} ${gone?.length ?? 0}건 삭제`)
    }
    await del('portal_client_links', `?id=eq.${link.id}`)
    console.log('  portal_client_links 1건 삭제')
  }
  await del('operations_clients', `?id=eq.${TEST_CLIENT_ID}`)
  console.log(`  operations_clients ${TEST_CLIENT_ID} 삭제`)
  console.log('\n테스트 데이터만 지웠습니다. 고객 계정은 Dashboard 에서 직접 지우세요(원하면).')
}

/* ------------------------------------------------------------------ */

const cmd = process.argv[2]
const run = { prepare, verify, watch, cleanup }[cmd]
if (!run) {
  console.error('사용법: node scripts/roundtrip-live.mjs <prepare|verify|watch|cleanup>')
  process.exit(2)
}
run().catch((e) => { console.error('\n실패:', e.message); process.exit(1) })
