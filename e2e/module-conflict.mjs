/**
 * qa:modconflict — D-535 모듈 기록을 두 기기에서 같이 고칠 때 한쪽 고침이 조용히 사라지지 않는지(점검 A3) — **진짜 PostgREST · RLS** 위에서.
 *
 *   실제 src/services/moduleData.ts 를 그대로 묶되 연결만 로컬 PostgREST(대표 토큰)로 바꾼다. 같은 묶음을 두 번 불러 '기기 A · 기기 B'(서로 다른 기억)로 쓴다.
 *   M1 A · B 가 같은 줄을 읽음 → A 저장 → B 저장: B 것이 저장되고, A 것은 `<갈래>.overwritten` 에 보관(내용 · 원래 id · 원래 시각)
 *   M2 예전 saveRow(덮어쓰기) 로 같은 일을 하면 A 것이 흔적 없이 사라진다(수정 전 재현 — 보관 줄 0)
 *   M3 같은 기기에서 연달아 저장(기다리지 않고 두 번) → 보관 줄 0 · 마지막 것이 남음
 *   M4 다른 기기가 그 줄을 지운 뒤 저장 → 다시 만들어짐(내 글 안 잃음) · 보관 0
 *   M5 읽은 적 없는 줄(새 줄) → 예전처럼 저장 · 보관 0
 *   M6 보관 줄은 같은 작업공간 · 같은 모듈 — 전체 내보내기(모듈 기록)에 담긴다
 *
 *   sudo node e2e/module-conflict.mjs   (pg_ctlcluster 16 main start 먼저)
 */
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const E2E_DB = process.env.AXE2E_DB ?? 'axmodconf'
const PGRST_PORT = Number(process.env.PGRST_PORT ?? 4566)
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr' }
const WS = '0e0000aa-0000-4000-8000-00000000000a'
let pass = 0
let fail = 0
const check = (n, ok, d) => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 300)}`)
}

execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore', env: { ...process.env, AXE2E_DB: E2E_DB } })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
let PGRST = process.env.POSTGREST_BIN ?? '.cache/postgrest/postgrest'
if (!existsSync(PGRST)) {
  mkdirSync('.cache/postgrest', { recursive: true })
  execSync('curl -sSL -o .cache/postgrest/p.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xf .cache/postgrest/p.tar.xz -C .cache/postgrest')
}
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${E2E_DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})
execSync('npx vite build --config e2e/support/vite.modconflict.config.mjs', { stdio: 'ignore' })
for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${PGRST_PORT}/`)).status < 500) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const h = b64({ alg: 'HS256', typ: 'JWT' })
const p = b64({ sub: OWNER.id, email: OWNER.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
globalThis.__PGRST_URL = `http://127.0.0.1:${PGRST_PORT}`
globalThis.__PGRST_JWT = `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`

const bundle = pathToFileURL(path.resolve('.modconflict-out/modconflict.mjs')).href
const A = await import(`${bundle}?device=A`)
const B = await import(`${bundle}?device=B`)
const C = await import(`${bundle}?device=C`)
const MOD = 'qa-mod'
const kept = (bucket) => Number(sql(`select count(*) from public.module_data where workspace_id = '${WS}' and module_key = '${MOD}' and bucket = '${bucket}${A.OVERWRITTEN_SUFFIX}'`))
const textOf = (id) => sql(`select payload->>'text' from public.module_data where id = '${id}'`)

try {
  // M1 두 기기
  await A.saveRow(WS, MOD, 'notes', { id: 'n1', data: { text: '처음' } })
  await A.listRows(WS, MOD, 'notes')
  await B.listRows(WS, MOD, 'notes')
  await A.saveRowChecked(WS, MOD, 'notes', { id: 'n1', data: { text: 'PC 에서 고친 것' } })
  await B.saveRowChecked(WS, MOD, 'notes', { id: 'n1', data: { text: '휴대폰에서 고친 것' } })
  const keptRow = sql(`select payload->>'originalId' || '|' || (payload->'data'->>'text') from public.module_data where module_key = '${MOD}' and bucket = 'notes${A.OVERWRITTEN_SUFFIX}'`)
  check('M1 두 기기 → 나중 것(휴대폰) 저장 · 먼저 것(PC)은 보관(원래 id · 내용)', textOf('n1') === '휴대폰에서 고친 것' && kept('notes') === 1 && keptRow === 'n1|PC 에서 고친 것', { now: textOf('n1'), kept: kept('notes'), keptRow })

  // M2 수정 전 재현 — 예전 저장(saveRow)은 덮어쓰고 흔적 없음
  await A.saveRow(WS, MOD, 'old', { id: 'o1', data: { text: '처음' } })
  await A.listRows(WS, MOD, 'old')
  await B.listRows(WS, MOD, 'old')
  await A.saveRow(WS, MOD, 'old', { id: 'o1', data: { text: 'PC 에서 고친 것' } })
  await B.saveRow(WS, MOD, 'old', { id: 'o1', data: { text: '휴대폰에서 고친 것' } })
  check('M2 (수정 전 방식) 예전 저장은 PC 고침이 흔적 없이 사라짐 — 보관 0', textOf('o1') === '휴대폰에서 고친 것' && kept('old') === 0)

  // M3 같은 기기 연달아(기다리지 않고)
  await A.saveRow(WS, MOD, 'seq', { id: 's1', data: { text: '0' } })
  await A.listRows(WS, MOD, 'seq')
  await Promise.all([A.saveRowChecked(WS, MOD, 'seq', { id: 's1', data: { text: '1' } }), A.saveRowChecked(WS, MOD, 'seq', { id: 's1', data: { text: '2' } }), A.saveRowChecked(WS, MOD, 'seq', { id: 's1', data: { text: '3' } })])
  check('M3 같은 기기 연달아 세 번 → 보관 0 · 마지막(3) 남음', kept('seq') === 0 && textOf('s1') === '3', { kept: kept('seq'), now: textOf('s1') })

  // M4 다른 기기가 지운 뒤
  await A.saveRow(WS, MOD, 'del', { id: 'd1', data: { text: '처음' } })
  await A.listRows(WS, MOD, 'del')
  await B.deleteRow(WS, MOD, 'del', 'd1')
  await A.saveRowChecked(WS, MOD, 'del', { id: 'd1', data: { text: '지워진 줄에 고친 것' } })
  check('M4 다른 기기가 지운 줄 → 다시 만들어 내 글 남음 · 보관 0', textOf('d1') === '지워진 줄에 고친 것' && kept('del') === 0)

  // M5 읽은 적 없는 줄
  await C.saveRowChecked(WS, MOD, 'fresh', { id: 'f1', data: { text: '새 줄' } })
  check('M5 처음 저장하는 줄 → 예전처럼 저장 · 보관 0', textOf('f1') === '새 줄' && kept('fresh') === 0)

  // M6 보관 줄 위치 — 같은 작업공간 · 같은 모듈(전체 내보내기가 작업공간 전체 module_data 를 읽으므로 담긴다)
  check('M6 보관 줄 = 같은 작업공간 · 같은 모듈 · 갈래 notes.overwritten', sql(`select workspace_id || '|' || module_key from public.module_data where bucket = 'notes${A.OVERWRITTEN_SUFFIX}'`) === `${WS}|${MOD}`)
} catch (e) {
  check('실행 중 오류 없음', false, String(e).slice(0, 300))
} finally {
  try {
    process.kill(-pgrst.pid)
  } catch {
    /* 이미 꺼짐 */
  }
}
console.log(`\nqa:modconflict: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
