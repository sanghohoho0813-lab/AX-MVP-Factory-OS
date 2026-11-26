// D-662 운영 DB 에 한 번에 넣는 묶음 만들기 — 0026 ~ 0031 여섯 마이그레이션을 차례대로 · 한 거래로.
//
//   node scripts/make-ops-bundle.mjs          → supabase/manual/apply_0026_0031_all.sql · check_applied_0026_0031.sql 을 새로 쓴다
//   node scripts/make-ops-bundle.mjs --check  → 지금 있는 두 파일이 마이그레이션 원문과 같은지(다르면 끝 코드 1 — qa:db 가 돌린다)
//
// 왜: 대표가 SQL Editor 에 여섯 파일 + 확인 파일을 번갈아 열두 번쯤 붙여 넣어야 했다(안내서 §13 ~ §16) — 그래서 하나도 못 넣었다.
// 묶음은 손으로 고치지 않는다 — 마이그레이션 원문에서 'begin;' · 'commit;' 두 줄만 빼고 그대로 잇는다(그래야 전부 또는 전무).
// 이 스크립트는 파일만 만든다. 운영 DB 에는 아무것도 보내지 않는다(실행은 대표).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIG = join(ROOT, 'supabase/migrations')
const OUT_APPLY = join(ROOT, 'supabase/manual/apply_0026_0031_all.sql')
const OUT_CHECK = join(ROOT, 'supabase/manual/check_applied_0026_0031.sql')

/** 차례 · 파일 · 한 줄 이름 · 넣으면 바로 달라지는 것 */
const LIST = [
  { no: '0026', file: '20261114000026_view_consent.sql', what: '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', effect: '대표님이 [대표 | 팀장] 으로 팀장 화면을 볼 때 업체 · 서류 · 계약이 비어 보인다 — 팀장님이 설정에서 허락하면 다시 보인다(팀장님께 먼저 알려 둔다). 팀장님 화면 · 대표님 자기 화면은 그대로.' },
  { no: '0027', file: '20261114000027_intake_links.sql', what: '고객(컨설턴트)마다 상담 신청 링크', effect: "마케팅 › 고객 모으기 기초 7가지 아래에 '내 상담 신청 링크' 한 줄이 생긴다(만들기 전에는 링크 없음)." },
  { no: '0028', file: '20261115000028_self_signup.sql', what: '가입하면 바로 쓰기(꺼진 채로 들어간다)', effect: '달라지는 것 없음 — 꺼진 채. 켜기 전에 Authentication 의 Confirm email · Site URL 을 먼저(안내서 §12).' },
  { no: '0029', file: '20261118000029_signup_approval.sql', what: '가입 신청 → 대표가 앱에서 승인 · 거절', effect: "새로 가입한 사람이 대표님 종(알림)에 '가입 신청 n명' 으로 뜨고, 설정 › 작업공간에서 [승인] · [거절] 한다." },
  { no: '0030', file: '20261119000030_ai_assist_results.sql', what: 'AI 답 보관(끊겨도 이어 받기)', effect: 'AI 단추를 누른 뒤 다른 화면 · 다른 앱에 다녀와도 답을 이어 받는다(다시 세지 않음).' },
  { no: '0031', file: '20261123000031_upload_links.sql', what: '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', effect: "업체 서류함에 [링크로 받기] 가 생긴다. 고객이 올리면 오늘 화면 '받은 서류 n개' 에 뜬다." },
]

const read = (f) => readFileSync(join(MIG, f), 'utf8').replace(/\r\n/g, '\n')

/** 원문에서 맨 바깥 거래 두 줄만 뺀다(함수 몸의 begin 은 세미콜론이 없어 걸리지 않는다) — 꼭 한 줄씩 있어야 한다 */
function body(item) {
  const text = read(item.file)
  const begins = (text.match(/^begin;$/gm) ?? []).length
  const commits = (text.match(/^commit;$/gm) ?? []).length
  if (begins !== 1 || commits !== 1) throw new Error(`${item.file}: 'begin;' ${begins}줄 · 'commit;' ${commits}줄 — 한 줄씩이어야 묶을 수 있다`)
  return text.replace(/^begin;$/m, `-- (묶음: 거래는 맨 위 begin 하나)`).replace(/^commit;$/m, `-- (묶음: 맨 아래에서 한 번에 commit)`).trimEnd()
}

const namesIn = (text) => ({
  tables: [...new Set([...text.matchAll(/^create table if not exists public\.([a-z_0-9]+)/gm)].map((m) => m[1]))],
  fns: [...new Set([...text.matchAll(/^create or replace function public\.([a-z_0-9]+)\s*\(/gm)].map((m) => m[1]))],
})

/**
 * 그 마이그레이션이 **새로** 만드는 표 · 함수 이름(있는지 보는 데 쓴다).
 * 앞선 마이그레이션에 이미 있던 함수를 고쳐 쓰는 것(0026 의 portal_preview_project 등)은 뺀다 — 넣기 전에도 있어서 '일부만' 으로 보인다.
 */
function objects(item) {
  const earlier = { tables: new Set(), fns: new Set() }
  for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql') && x < item.file).sort()) {
    const n = namesIn(read(f))
    n.tables.forEach((t) => earlier.tables.add(t))
    n.fns.forEach((t) => earlier.fns.add(t))
  }
  const mine = namesIn(read(item.file))
  const tables = mine.tables.filter((t) => !earlier.tables.has(t))
  const fns = mine.fns.filter((t) => !earlier.fns.has(t))
  if (!tables.length && !fns.length) throw new Error(`${item.file}: 새로 만드는 표 · 함수를 하나도 못 찾았다`)
  return { tables, fns }
}

const q = (s) => `'${s.replace(/'/g, "''")}'`

/** 여섯 줄 결과 표 — 번호 | 무엇 | 있는 것 | 결과 */
function summarySql() {
  const rows = []
  for (const item of LIST) {
    const { tables, fns } = objects(item)
    for (const t of tables) rows.push(`  (${q(item.no)}, ${q(item.what)}, to_regclass(${q('public.' + t)}) is not null)`)
    for (const f of fns) rows.push(`  (${q(item.no)}, ${q(item.what)}, exists (select 1 from fn where name = ${q(f)}))`)
  }
  return [
    'with fn(name) as (',
    "  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
    '), part(no, what, ok) as (',
    '  values',
    rows.join(',\n'),
    ')',
    'select no as 번호, what as 무엇, count(*) filter (where ok) || \'/\' || count(*) as 있는_것,',
    "       case when bool_and(ok) then '들어감' when bool_or(ok) then '일부만' else '없음' end as 결과",
    'from part group by no, what order by no;',
  ].join('\n')
}

const BAR = '-- ====================================================================='

function applySql() {
  const head = [
    BAR,
    '-- 🚨 운영 DB — 0026 ~ 0031 여섯 개를 한 번에 넣는 묶음(D-662 · 실행은 대표)',
    '--',
    '-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다. 손으로 고치지 않는다(여섯 마이그레이션 원문 그대로 · 차례대로).',
    '-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행 → 맨 아래 결과 표 여섯 줄이 모두 `들어감`.',
    '-- 전부 또는 전무: 한 거래다. 중간에 하나라도 멈추면 여섯 개 모두 들어가지 않는다(잠금이 5초 넘게 걸려도 멈춘다 — 조금 뒤 다시).',
    '-- 여러 번 실행해도 결과는 같다. 이미 몇 개를 따로 넣었어도 된다(있는 것은 그대로 두고 없는 것만 더한다).',
    '-- 더하기만 한다 — 기존 표 · 열 · 자료는 지우거나 바꾸지 않는다.',
    '-- 먼저 있어야 하는 것: 0016 ~ 0025(2026-11-12 운영에서 확인 — D-600). 없으면 그 자리에서 멈추고 아무것도 바뀌지 않는다.',
    '--',
    '-- 넣으면 바로 달라지는 것',
    ...LIST.map((x) => `--   ${x.no} ${x.what} — ${x.effect}`),
    '--',
    '-- 넣기 전 · 넣은 뒤 보기(읽기만): supabase/manual/check_applied_0026_0031.sql',
    '-- 자세한 확인(읽기만): verify_after_0026 · 0027 · 0028 · 0029 · 0031.sql · 안내서 docs/OPS_0023_0024_RUNBOOK.md §17',
    "-- 되돌리기: rollback_0026 ~ 0031.sql 각각(기록 · 자료는 남는다) — 대표가 '되돌려' 라고 할 때만.",
    BAR,
    'begin;',
    "set local lock_timeout = '5s';",
    '',
  ]
  const parts = LIST.map((item) => [`-- ───────────────────────────── ${item.no} ${item.what} ─────────────────────────────`, body(item), ''].join('\n'))
  const tail = ['commit;', '', '-- 결과(바꾸지 않음) — 여섯 줄 모두 들어감 이면 끝', summarySql(), '']
  return [...head, ...parts, ...tail].join('\n')
}

function checkSql() {
  return [
    BAR,
    '-- 운영 DB 점검 — 0026 ~ 0031 여섯 개가 들어가 있는지 한 장으로(D-662)',
    '-- **읽기만** 한다(맨 위 `set transaction read only` + SELECT 한 문장). 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다.',
    '-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다(마이그레이션이 만드는 표 · 함수 이름을 그대로 센다).',
    '-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.',
    "-- 결과: 여섯 줄(번호 | 무엇 | 있는 것 | 결과) — '없음'(아직) · '들어감'(끝) · '일부만'(있을 수 없는 상태 — 묶음을 다시 통째로 실행).",
    "-- 되돌린 것(rollback_00NN — 권한만 거둠)은 이 표에서 '들어감' 으로 보인다. 그것까지 가르려면 check_applied_0026_0028 · 0029 · 0030 · 0031.sql.",
    BAR,
    'set transaction read only;',
    '',
    summarySql(),
    '',
  ].join('\n')
}

const apply = applySql()
const check = checkSql()
if (process.argv.includes('--check')) {
  const stale = []
  for (const [path, want] of [[OUT_APPLY, apply], [OUT_CHECK, check]]) {
    let have = ''
    try {
      have = readFileSync(path, 'utf8')
    } catch {
      have = ''
    }
    if (have !== want) stale.push(path.replace(ROOT + '/', ''))
  }
  if (stale.length) {
    console.log(`FAIL  운영 묶음이 마이그레이션 원문과 다르다 — node scripts/make-ops-bundle.mjs 를 다시: ${stale.join(' · ')}`)
    process.exit(1)
  }
  console.log(`PASS  운영 묶음 = 마이그레이션 원문(여섯 개 · ${apply.split('\n').length}줄) · 점검 SQL 도 같은 이름을 센다`)
} else {
  writeFileSync(OUT_APPLY, apply)
  writeFileSync(OUT_CHECK, check)
  console.log(`apply_0026_0031_all.sql ${apply.split('\n').length}줄 · check_applied_0026_0031.sql ${check.split('\n').length}줄`)
}
