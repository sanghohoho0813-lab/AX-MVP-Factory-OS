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
 *   D-550 SYNC-5 덮인 판 되돌리기
 *   R1 목록 — 이 작업공간 보관 줄 전부(새것부터) · 원래 갈래 · 원래 id · 덮인 때 · 내용
 *   R2 되돌리기 → 원래 줄 = 그때 내용 · 지금 내용은 보관(reason restore) · 보관 줄에 되돌린 때 · 지우는 것 0
 *   R3 되돌린 것도 다시 되돌림(방금 보관한 판으로) — 처음 내용 그대로
 *   R4 기기 A 가 그 기록을 연 채(예전 판 기억)로 저장 → 되돌린 판이 조용히 사라지지 않음(D-535 길로 보관)
 *   R5 원래 줄이 지워졌으면 같은 id 로 다시 만듦
 *   R6 되돌리기 직전 다른 기기가 또 고쳤으면 멈춤(덮지 않음 · 그 내용 지킴)
 *   R7 팀장 토큰 — 대표 작업공간 보관 목록 0 · 되돌리기 막힘
 *   D-538 고정 id(자체점검 기준 self-check · 스레드 이번 주 참고 wk_<주>) — 대표가 대표 작업공간 · 팀장 작업공간(편집자) 둘 다에 저장할 때
 *   F1 (수정 전 재현 · 0023 없음) 예전 id 로 팀장 작업공간에 저장 → 대표 줄이 팀장 작업공간으로 옮겨짐
 *   F2 (수정 전 재현 · 0023 있음) 예전 id 로 저장 → 막힘 · 대표 줄은 제자리
 *   F3 (수정 뒤 · 0023 있음) 자체점검 기준: 두 작업공간 저장 둘 다 됨 · 각자 제 줄 · 대표 줄 안 옮겨짐 · 읽기도 제 것
 *   F4 (수정 뒤) 예전 줄만 있는 작업공간은 예전 줄을 이어서 읽음 · 새로 저장해도 예전 줄은 그대로(지우지 않음)
 *   F5 (수정 뒤 · 0023 있음) 이번 주 참고: 두 작업공간 저장 둘 다 됨 · 각자 제 것
 *   F6 팀장 본인(팀장 토큰) — 예전 id 는 대표 줄 때문에 저장 안 됨 → 고친 뒤 저장 · 읽기 됨 · 대표 줄은 안 보임
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
const PILOT_ID = '0e000000-0000-4000-8000-0000000000b1'
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

  // ---- D-550 SYNC-5 덮인 판 되돌리기 ----
  const list1 = await C.listOverwritten(WS)
  const e1 = list1.find((e) => e.originalId === 'n1')
  check('R1 목록 — 보관 줄 · 원래 갈래 notes · 원래 id n1 · 덮인 때 · 그때 내용(PC) · 종류 이름',
    !!e1 && e1.bucket === 'notes' && e1.moduleKey === MOD && !!e1.replacedAt && e1.data.text === 'PC 에서 고친 것' && e1.reason === '' && C.kindLabel(e1) === '모듈 기록',
    list1.map((e) => [e.originalId, e.bucket, e.data.text]))
  const cur1 = await C.readModuleRow(WS, 'n1')
  const d1 = C.diffSummary(e1.data, cur1.data)
  check('R1b 지금 내용과 달라진 곳 — 그때 PC / 지금 휴대폰', d1.count === 1 && d1.samples[0].then === 'PC 에서 고친 것' && d1.samples[0].now === '휴대폰에서 고친 것', d1)
  const before = Number(sql(`select count(*) from public.module_data where workspace_id = '${WS}'`))
  await C.restoreOverwritten(WS, e1.id)
  const restoreKept = sql(`select (payload->'data'->>'text') || '|' || (payload->>'reason') || '|' || (payload->>'restoredFrom') from public.module_data where bucket = 'notes${A.OVERWRITTEN_SUFFIX}' and payload->>'reason' = 'restore'`)
  check('R2 되돌리기 → 원래 줄 = 그때 내용(PC) · 지금 내용(휴대폰)은 보관(restore) · 보관 줄에 되돌린 때 · 줄 수는 +1(지운 것 0)',
    textOf('n1') === 'PC 에서 고친 것' && restoreKept === `휴대폰에서 고친 것|restore|${e1.id}` && !!sql(`select payload->>'restoredAt' from public.module_data where id = '${e1.id}'`) &&
    Number(sql(`select count(*) from public.module_data where workspace_id = '${WS}'`)) === before + 1,
    { now: textOf('n1'), restoreKept })
  const e2 = (await C.listOverwritten(WS)).find((e) => e.originalId === 'n1' && e.reason === 'restore')
  check('R2b 목록 맨 위 = 방금 보관한 판(되돌리기 전 내용)', (await C.listOverwritten(WS))[0]?.id === e2?.id)
  await C.restoreOverwritten(WS, e2.id)
  check('R3 되돌린 것도 다시 되돌림 → 휴대폰 내용 · 보관은 또 하나(지금까지 3)', textOf('n1') === '휴대폰에서 고친 것' && kept('notes') === 3, { now: textOf('n1'), kept: kept('notes') })
  // R4 기기 A 는 n1 을 예전에 읽은 판으로 기억 — 되돌린 뒤 A 가 예전 화면 그대로 저장
  await C.restoreOverwritten(WS, e1.id)
  const keptBefore = kept('notes')
  await A.saveRowChecked(WS, MOD, 'notes', { id: 'n1', data: { text: 'A 가 열어 둔 예전 화면에서 저장' } })
  const lostCheck = sql(`select count(*) from public.module_data where bucket = 'notes${A.OVERWRITTEN_SUFFIX}' and payload->'data'->>'text' = 'PC 에서 고친 것' and created_at > now() - interval '5 seconds'`)
  check('R4 열어 둔 예전 화면이 저장해도 되돌린 판은 보관됨(조용히 사라지지 않음)', textOf('n1') === 'A 가 열어 둔 예전 화면에서 저장' && kept('notes') === keptBefore + 1 && Number(lostCheck) >= 1, { kept: kept('notes'), keptBefore, lostCheck })
  // R5 원래 줄 지워짐
  await A.saveRow(WS, MOD, 'gone', { id: 'g1', data: { text: '처음' } })
  await A.listRows(WS, MOD, 'gone')
  await B.listRows(WS, MOD, 'gone')
  await A.saveRowChecked(WS, MOD, 'gone', { id: 'g1', data: { text: 'A 것' } })
  await B.saveRowChecked(WS, MOD, 'gone', { id: 'g1', data: { text: 'B 것' } })
  await B.deleteRow(WS, MOD, 'gone', 'g1')
  const eg = (await C.listOverwritten(WS)).find((e) => e.originalId === 'g1')
  const r5 = await C.restoreOverwritten(WS, eg.id)
  check('R5 원래 줄이 지워졌으면 같은 id 로 다시 만듦(그때 내용 A)', r5.recreated === true && textOf('g1') === 'A 것' && sql(`select bucket from public.module_data where id = 'g1'`) === 'gone')
  // R6 되돌리는 사이 다른 기기가 또 고침
  const raceId = 'race1'
  await A.saveRow(WS, MOD, 'race', { id: raceId, data: { text: '처음' } })
  await A.listRows(WS, MOD, 'race')
  await B.listRows(WS, MOD, 'race')
  await A.saveRowChecked(WS, MOD, 'race', { id: raceId, data: { text: 'A' } })
  await B.saveRowChecked(WS, MOD, 'race', { id: raceId, data: { text: 'B' } })
  const er = (await C.listOverwritten(WS)).find((e) => e.originalId === raceId)
  // 되돌리기가 '지금 내용 보관' 을 넣는 바로 그 순간 다른 기기가 원래 줄을 또 고치게(시험 DB 에만 잠깐 장치)
  sql(`create or replace function public.qa_race_bump() returns trigger language plpgsql security definer as $$ begin update public.module_data set payload = '{"text":"C 가 방금 고침"}'::jsonb, updated_at = clock_timestamp() + interval '1 second' where id = 'race1'; return new; end $$;
       create trigger qa_race after insert on public.module_data for each row when (new.bucket = 'race.overwritten' and new.payload->>'reason' = 'restore') execute function public.qa_race_bump();`)
  const r6 = await C.restoreOverwritten(WS, er.id).then(() => 'restored', (e) => String(e?.message ?? e))
  sql(`drop trigger qa_race on public.module_data; drop function public.qa_race_bump();`)
  check('R6 되돌리는 사이 다른 기기가 또 고침 → 멈추고 알림 · 그 내용(C) 그대로 · 덮지 않음', /또 고쳤어요/.test(r6) && textOf(raceId) === 'C 가 방금 고침', { r6, now: textOf(raceId) })
  // R7 팀장 토큰
  {
    const ownerJwt0 = globalThis.__PGRST_JWT
    const pp0 = b64({ sub: PILOT_ID, email: 'pilot@e2e.kr', role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
    globalThis.__PGRST_JWT = `${h}.${pp0}.${createHmac('sha256', SECRET).update(`${h}.${pp0}`).digest('base64url')}`
    const pl = await C.listOverwritten(WS)
    const pr = await C.restoreOverwritten(WS, e1.id).then(() => 'restored', (e) => `blocked:${String(e?.message ?? e).slice(0, 40)}`)
    globalThis.__PGRST_JWT = ownerJwt0
    check('R7 팀장 토큰 — 대표 작업공간 보관 목록 0 · 되돌리기 막힘 · 대표 줄 그대로', pl.length === 0 && pr.startsWith('blocked') && textOf('n1') === 'A 가 열어 둔 예전 화면에서 저장', { pl: pl.length, pr })
  }

  // ---- D-538 고정 id ----
  const PW = sql(`select w.id from public.workspaces w join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' order by w.created_at limit 1`)
  const ownerIn = sql(`select role from public.workspace_members where workspace_id = '${PW}' and user_id = '${OWNER.id}'`)
  check('F0 준비 — 대표가 팀장 작업공간 편집자(0020 · 팀장 화면 전환) · 0023 장치 있음', !!PW && ownerIn === 'editor' && sql(`select count(*) from pg_trigger where tgname = 'zz_workspace_id_lock' and tgrelid = 'public.module_data'::regclass`) === '1', { PW, ownerIn })
  const wsOf = (id) => sql(`select coalesce(string_agg(workspace_id::text, ','), '') from public.module_data where id = '${id}'`)
  const tryOld = async (id) => A.saveRow(PW, 'ai', 'skills', { id, data: { text: '팀장 화면에서 저장' } }).then(() => 'saved', (e) => `error:${String(e?.message ?? e).slice(0, 80)}`)

  // F1 수정 전 재현(0023 없음 — 이 시험 DB 에서만 잠깐 끔)
  await A.saveRow(WS, 'ai', 'skills', { id: 'self-check-f1', data: { text: '대표 정의' } })
  sql(`alter table public.module_data disable trigger zz_workspace_id_lock`)
  const f1 = await tryOld('self-check-f1')
  sql(`alter table public.module_data enable trigger zz_workspace_id_lock`)
  check('F1 (수정 전 · 0023 없음) 예전 같은 id 로 팀장 작업공간에 저장 → 대표 줄이 팀장 작업공간으로 옮겨짐(섞임)', f1 === 'saved' && wsOf('self-check-f1') === PW, { f1, at: wsOf('self-check-f1') })

  // F2 수정 전 재현(0023 있음)
  await A.saveRow(WS, 'ai', 'skills', { id: 'self-check', data: { text: '대표 예전 정의' } })
  const f2 = await tryOld('self-check')
  check('F2 (수정 전 · 0023 있음) 예전 같은 id 저장 → 막힘 · 대표 줄은 대표 작업공간에 그대로', f2.startsWith('error') && wsOf('self-check') === WS, { f2, at: wsOf('self-check') })

  // F3 수정 뒤 — 실제 saveJudgeSkill
  const okOwner = await A.saveJudgeSkill(WS, '대표 정의(새)')
  const okPilot = await A.saveJudgeSkill(PW, '팀장 화면에서 쓴 정의')
  A.__resetJudgeSkill()
  const readOwner = await A.syncJudgeSkill(WS)
  A.__resetJudgeSkill()
  const readPilot = await A.syncJudgeSkill(PW)
  check('F3 (수정 뒤 · 0023 있음) 자체점검 기준 — 두 작업공간 저장 둘 다 됨 · 각자 제 줄 · 읽기도 제 것',
    okOwner && okPilot && wsOf(A.workspaceRowId('self-check', WS)) === WS && wsOf(A.workspaceRowId('self-check', PW)) === PW && readOwner === '대표 정의(새)' && readPilot === '팀장 화면에서 쓴 정의',
    { okOwner, okPilot, readOwner, readPilot })
  check('F4 예전 줄(self-check)은 지우지 않고 대표 작업공간에 그대로 · 내용도 그대로', wsOf('self-check') === WS && sql(`select payload->>'text' from public.module_data where id = 'self-check'`) === '대표 예전 정의', sql(`select payload::text from public.module_data where id = 'self-check'`))

  // F5 이번 주 참고 — 실제 saveWeekRef · loadWeekRef
  const day = '2026-11-05'
  const week = A.mondayOf(day)
  await A.saveRow(WS, A.THREADS_MODULE, A.WEEK_BUCKET, { id: `wk_${week}`, data: { items: [{ template: 'P', firstLine: '', ending: '', note: '예전 줄' }], savedAt: '2026-11-03T00:00:00Z' } })
  const oldRead = (await A.loadWeekRef(WS, day))?.items?.[0]?.note
  const w1 = await A.saveWeekRef(WS, [{ template: 'B', firstLine: '', ending: '', note: '대표 것' }], day).then(() => 'ok', (e) => String(e?.message ?? e))
  const w2 = await A.saveWeekRef(PW, [{ template: 'E', firstLine: '', ending: '', note: '팀장 화면 것' }], day).then(() => 'ok', (e) => String(e?.message ?? e))
  const rOwner = (await A.loadWeekRef(WS, day))?.items?.[0]?.note
  const rPilot = (await A.loadWeekRef(PW, day))?.items?.[0]?.note
  check('F5 (수정 뒤 · 0023 있음) 이번 주 참고 — 예전 줄 이어 읽음 → 두 작업공간 저장 둘 다 됨 · 각자 제 것 · 예전 줄 제자리',
    oldRead === '예전 줄' && w1 === 'ok' && w2 === 'ok' && rOwner === '대표 것' && rPilot === '팀장 화면 것' && wsOf(A.weekRefId(week, PW)) === PW && wsOf(`wk_${week}`) === WS,
    { oldRead, w1, w2, rOwner, rPilot })

  // F6 팀장 본인(팀장 토큰) — 예전에는 대표가 먼저 만든 같은 id 줄을 고칠 수 없어(RLS) 저장이 안 됐다
  const ownerJwt = globalThis.__PGRST_JWT
  const pp = b64({ sub: PILOT_ID, email: 'pilot@e2e.kr', role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
  globalThis.__PGRST_JWT = `${h}.${pp}.${createHmac('sha256', SECRET).update(`${h}.${pp}`).digest('base64url')}`
  const p0 = await C.saveRow(PW, 'ai', 'skills', { id: 'self-check', data: { text: '팀장 예전 방식' } }).then(() => 'saved', () => 'error')
  const p1 = await C.saveJudgeSkill(PW, '팀장 본인 정의')
  C.__resetJudgeSkill()
  const p2 = await C.syncJudgeSkill(PW)
  const p3 = await C.saveWeekRef(PW, [{ template: 'L', firstLine: '', ending: '', note: '팀장 본인' }], day).then(() => 'ok', (e) => String(e?.message ?? e))
  const ownerRows = await C.listRows(WS, 'ai', 'skills')
  globalThis.__PGRST_JWT = ownerJwt
  check('F6 팀장 본인 — 예전 id 는 대표 줄 때문에 저장 안 됨(수정 전 재현) → 고친 뒤 자체점검 기준 · 이번 주 참고 저장 · 읽기 됨 · 대표 줄은 안 보임',
    p0 === 'error' && p1 === true && p2 === '팀장 본인 정의' && p3 === 'ok' && ownerRows.length === 0 && wsOf('self-check') === WS,
    { p0, p1, p2, p3, ownerRows: ownerRows.length })
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
