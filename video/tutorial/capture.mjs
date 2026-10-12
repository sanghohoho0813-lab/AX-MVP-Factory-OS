/**
 * 안내 영상(D-185)용 — 최은혜 팀장님이 실제로 보는 화면을 그대로 찍는다.
 *
 *   로컬 PostgreSQL(axe2e) ← PostgREST ← 브라우저(운영과 같은 빌드 · 클라우드 모드)
 *   e2e/pilot.mjs 와 같은 방식: 로그인 응답만 흉내 내고, 표 읽기 · 쓰기는 DB 의 접근 규칙(RLS)이 판단한다.
 *   팀장(Pilot) 작업공간에 **예시 업체**를 넣고(실제 고객 아님) 팀장 계정으로 로그인해 PC · 휴대폰 화면을 찍는다.
 *
 *   sudo node video/tutorial/capture.mjs [저장 폴더]    (pg_ctlcluster 16 main start 먼저)
 *   결과: <폴더>/<이름>.png (PC 1440×900 · 휴대폰 412×892, 2배율) + shots.json(화면 속 블록 위치)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const OUTDIR = process.argv[2] ?? 'video/tutorial/.cap'
mkdirSync(OUTDIR, { recursive: true })
const REF = 'qatutorial'
const PORT = 4547
const PGRST_PORT = 4546
const E2E_DB = 'axe2e'
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-tutorial'
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const USERS = [OWNER, PILOT]

execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore' })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
const WS = sql(`select id from public.workspaces where owner_id = '${PILOT.id}'`)

/* ---------------- 예시 업체 (화면 속 기업 · 인물은 모두 예시) ---------------- */
const kstNow = new Date(Date.now() + 9 * 3600_000)
const d = (off) => {
  const t = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()))
  t.setUTCDate(t.getUTCDate() + off)
  return t.toISOString().slice(0, 10)
}
const iso = (off, h = 10) => `${d(off)}T${String(h).padStart(2, '0')}:00:00.000Z`
const doc = (cid, key, file, issued, extra = {}) => ({ received: true, issuedAt: issued, fileName: file, fileSize: 184_000, storagePath: `${WS}/${cid}/${key}/${file}`, ...extra })
const fm = (source, status = 'confirmed', asOf = d(-3)) => ({ source, status, asOf, updatedAt: iso(-1) })

const clients = [
  {
    id: 'ex-gaon', companyName: '가온정밀(주)', status: 'active', nextAction: '연구소 설립 서류 회신 받기', nextActionDueDate: d(2),
    payload: {
      contactName: '홍길동', contactTitle: '대표', contactPhone: '010-0000-0000', contactEmail: 'ceo@gaon.example',
      representativeName: '홍길동', representativeBirth: '1974-03-15', businessNumber: '123-45-67890', corporateNumber: '110111-1234567',
      establishedAt: '2016-05-20', businessAddress: '경기도 화성시 동탄산단로', industry: '정밀기계 부품 제조', businessCategory: '제조업', businessItem: '자동차 정밀 부품',
      employeeCount: '18명', shareholders: '대표 70% · 배우자 30%',
      services: { incorporation: { status: 'done' }, businessScope: { status: 'done' }, patent: { status: 'in_progress', dueDate: d(9) }, venture: { status: 'not_started' }, ax: { status: 'not_started' }, policyFund: { status: 'waiting_client', dueDate: d(6) } },
      documents: {
        businessRegistration: doc('ex-gaon', 'businessRegistration', '가온정밀_사업자등록증.pdf', d(-12)),
        corporateRegistry: doc('ex-gaon', 'corporateRegistry', '가온정밀_법인등기부등본.pdf', d(-12)),
        financialStatements: doc('ex-gaon', 'financialStatements', '가온정밀_2025_재무제표.pdf', d(-12)),
        payrollRoster: doc('ex-gaon', 'payrollRoster', '4대보험_가입자명부.xlsx', d(-12)),
      },
      factMeta: {
        companyName: fm('businessRegistration'), businessNumber: fm('businessRegistration'), representativeName: fm('businessRegistration'),
        establishedAt: fm('corporateRegistry'), businessAddress: fm('businessRegistration'), employeeCount: fm('payrollRoster'),
        revenue: fm('financialStatements'), operatingProfit: fm('financialStatements'),
      },
      factValues: { revenue: '4,230,000,000', operatingProfit: '312,000,000', certifications: '벤처기업 (2027-03까지)' },
      factInbox: [
        { id: 'fi1', key: 'totalLiabilities', value: '1,180,000,000', source: 'financialStatements', asOf: d(-12), ref: '가온정밀_2025_재무제표.pdf', foundAt: iso(-1) },
        { id: 'fi2', key: 'mainCustomers', value: '현대모비스 협력사 외 12곳', source: 'financialStatements', asOf: d(-12), ref: '가온정밀_2025_재무제표.pdf', foundAt: iso(-1) },
      ],
      docUploads: [{
        id: 'up_ex1', at: iso(-1, 5), files: 4,
        placed: [
          { fileName: '가온정밀_사업자등록증.pdf', label: '사업자등록증', other: false, numbered: false },
          { fileName: '가온정밀_법인등기부등본.pdf', label: '법인등기부등본', other: false, numbered: false },
          { fileName: '가온정밀_2025_재무제표.pdf', label: '재무제표', other: false, numbered: false },
          { fileName: '4대보험_가입자명부.xlsx', label: '4대보험 가입자 명부', other: false, numbered: false },
        ],
        entered: [
          { key: 'businessNumber', label: '사업자등록번호', display: '123-45-67890', value: '123-45-67890', fileName: '가온정밀_사업자등록증.pdf' },
          { key: 'representativeName', label: '대표자', display: '홍길동', value: '홍길동', fileName: '가온정밀_사업자등록증.pdf' },
          { key: 'establishedAt', label: '설립일', display: '2016-05-20', value: '2016-05-20', fileName: '가온정밀_법인등기부등본.pdf' },
          { key: 'employeeCount', label: '직원 수', display: '18명', value: '18명', fileName: '4대보험_가입자명부.xlsx' },
        ],
        flagged: [{ key: 'totalLiabilities', label: '부채', display: '11억 8천만 원', fileName: '가온정밀_2025_재무제표.pdf', note: '재무제표 표에서 읽은 값 — 한 번 확인해 주세요' }],
        warnings: [],
      }],
      fees: [
        { id: 'gf1', kind: 'deposit', label: '착수금', amount: 3_300_000, dueDate: d(-20), receivedAt: d(-19) },
        { id: 'gf2', kind: 'success', label: '연구소 설립 성공보수', amount: 5_500_000, dueDate: d(30), receivedAt: null },
      ],
      contract: { signedAt: d(-21), kind: 'cash', cashAmount: 8_800_000, policies: [], note: '' },
      sales: { stage: 'contracted', source: '소개', referrer: '', interests: ['연구소', '정책자금'], concern: '연구소를 세워 세액공제를 받고 싶다', expectedFee: 8_800_000, history: [], movedAt: iso(-21) },
      activity: [
        { id: 'ga1', at: iso(-1, 5), type: 'document', text: '서류 4개 올림 — 사업자등록증 · 법인등기부등본 · 재무제표 · 4대보험 가입자 명부' },
        { id: 'ga2', at: iso(-3, 2), type: 'note', text: '홍길동 대표 통화 — 연구 전담 인력 2명 가능' },
      ],
    },
  },
  {
    id: 'ex-narae', companyName: '나래푸드', status: 'active', nextAction: '부가세 과세표준증명 받기', nextActionDueDate: d(0),
    payload: {
      contactName: '김철수', contactTitle: '대표', contactPhone: '010-0000-0000', representativeName: '김철수', businessNumber: '234-56-78901',
      establishedAt: '2021-09-01', businessAddress: '경기도 남양주시 진접읍', industry: '식품 제조', employeeCount: '6명',
      services: { incorporation: { status: 'not_started' }, businessScope: { status: 'not_started' }, patent: { status: 'not_started' }, venture: { status: 'not_started' }, ax: { status: 'not_started' }, policyFund: { status: 'in_progress', dueDate: d(4) } },
      documents: { businessRegistration: doc('ex-narae', 'businessRegistration', '나래푸드_사업자등록증.pdf', d(-30)) },
      fees: [{ id: 'nf1', kind: 'deposit', label: '착수금', amount: 1_100_000, dueDate: d(1), receivedAt: null }],
      contract: { signedAt: d(-7), kind: 'cash', cashAmount: 2_200_000, policies: [], note: '' },
      sales: { stage: 'contracted', source: '홈페이지 상담신청', referrer: '', interests: ['정책자금'], concern: '운전자금 1억이 필요하다', expectedFee: 2_200_000, history: [], movedAt: iso(-7) },
    },
  },
  {
    id: 'ex-daon', companyName: '다온바이오(주)', status: 'active', nextAction: '연구소 설립 가능성 체크', nextActionDueDate: d(5),
    payload: {
      contactName: '이영희', contactTitle: '대표', contactPhone: '010-0000-0000', representativeName: '이영희', businessNumber: '345-67-89012', corporateNumber: '110111-2345678',
      establishedAt: '2019-02-11', businessAddress: '충청북도 청주시 흥덕구 오송생명로', industry: '바이오 · 의료기기', employeeCount: '11명',
      services: { incorporation: { status: 'done' }, businessScope: { status: 'not_started' }, patent: { status: 'not_started' }, venture: { status: 'in_progress', dueDate: d(12) }, ax: { status: 'not_started' }, policyFund: { status: 'not_started' } },
      documents: { businessRegistration: doc('ex-daon', 'businessRegistration', '다온바이오_사업자등록증.pdf', d(-40)), corporateRegistry: doc('ex-daon', 'corporateRegistry', '다온바이오_등기부등본.pdf', d(-40)) },
      sales: { stage: 'contracted', source: '소개', referrer: '', interests: ['연구소', '벤처인증'], concern: '', expectedFee: null, history: [], movedAt: iso(-30) },
      contract: { signedAt: d(-30), kind: 'cash', cashAmount: 4_400_000, policies: [], note: '' },
    },
  },
  {
    id: 'ex-lime', companyName: '라임소프트(주)', status: 'active', nextAction: '청년 채용 참여신청 기한 확인', nextActionDueDate: d(1),
    payload: {
      contactName: '박영수', contactTitle: '대표', contactPhone: '010-0000-0000', representativeName: '박영수', businessNumber: '456-78-90123',
      establishedAt: '2020-07-01', businessAddress: '서울특별시 금천구 가산디지털1로', industry: '소프트웨어 개발', employeeCount: '9명',
      services: { incorporation: { status: 'done' }, businessScope: { status: 'not_started' }, patent: { status: 'not_started' }, venture: { status: 'done' }, ax: { status: 'not_started' }, policyFund: { status: 'not_started' } },
      documents: { businessRegistration: doc('ex-lime', 'businessRegistration', '라임소프트_사업자등록증.pdf', d(-50)), payrollRoster: doc('ex-lime', 'payrollRoster', '라임소프트_4대보험명부.xlsx', d(-6)) },
      sales: { stage: 'contracted', source: '소개', referrer: '', interests: ['고용지원금'], concern: '', expectedFee: null, history: [], movedAt: iso(-50) },
      contract: { signedAt: d(-50), kind: 'cash', cashAmount: 1_650_000, policies: [], note: '' },
    },
  },
  {
    id: 'ex-maru', companyName: '마루에너지', status: 'waiting', nextAction: '정책자금 심사 결과 기다리는 중', nextActionDueDate: d(7),
    payload: {
      contactName: '최민지', contactTitle: '대표', contactPhone: '010-0000-0000', representativeName: '최민지', businessNumber: '567-89-01234',
      establishedAt: '2018-04-16', businessAddress: '전라남도 나주시 빛가람로', industry: '신재생에너지', employeeCount: '14명',
      services: { incorporation: { status: 'done' }, businessScope: { status: 'not_started' }, patent: { status: 'not_started' }, venture: { status: 'not_started' }, ax: { status: 'not_started' }, policyFund: { status: 'in_progress', dueDate: d(7) } },
      documents: { businessRegistration: doc('ex-maru', 'businessRegistration', '마루에너지_사업자등록증.pdf', d(-60)) },
      fundingApplications: [{ id: 'mfa1', programName: '중소기업 정책자금(운전)', status: 'submitted', applyDueDate: d(-5), amount: 300_000_000 }],
      sales: { stage: 'contracted', source: '전화', referrer: '', interests: ['정책자금'], concern: '', expectedFee: null, history: [], movedAt: iso(-60) },
      contract: { signedAt: d(-60), kind: 'cash', cashAmount: 3_300_000, policies: [], note: '' },
    },
  },
  // 영업 중(잠재고객)
  {
    id: 'ex-bareun', companyName: '바른산업(주)', status: 'waiting', nextAction: '1차 미팅', nextActionDueDate: d(3),
    payload: {
      contactName: '홍길동', contactTitle: '대표', contactPhone: '010-0000-0000', industry: '금속 가공', employeeCount: '25명',
      sales: { stage: 'm1sched', source: '소개', referrer: '', interests: ['가지급금', '절세'], concern: '가지급금이 3억 가까이 쌓였다', expectedFee: 6_600_000, history: [], movedAt: iso(-2) },
    },
  },
  {
    id: 'ex-saebom', companyName: '새봄식품', status: 'waiting', nextAction: '첫 연락', nextActionDueDate: d(1),
    payload: {
      contactName: '김철수', contactTitle: '대표', contactPhone: '010-0000-0000', industry: '식품 유통',
      sales: { stage: 'lead', source: '홈페이지 상담신청', referrer: '', interests: ['정책자금'], concern: '', expectedFee: null, history: [], movedAt: iso(-1) },
    },
  },
  {
    id: 'ex-haneul', companyName: '하늘물산(주)', status: 'waiting', nextAction: '2차 미팅 — 제안서 설명', nextActionDueDate: d(6),
    payload: {
      contactName: '이영희', contactTitle: '대표', contactPhone: '010-0000-0000', industry: '무역', employeeCount: '12명',
      sales: { stage: 'm2', source: '소개', referrer: '', interests: ['가업승계', '절세'], concern: '자녀에게 회사를 넘기고 싶다', expectedFee: 11_000_000, history: [], movedAt: iso(-5) },
    },
  },
]
const esc = (s) => String(s).replace(/'/g, "''")
for (const c of clients) {
  sql(`insert into public.operations_clients (id, workspace_id, company_name, status, next_action, next_action_due_date, payload, created_at, updated_at)
       values ('${c.id}', '${WS}', '${esc(c.companyName)}', '${c.status}', '${esc(c.nextAction)}', ${c.nextActionDueDate ? `'${c.nextActionDueDate}'` : 'null'}, '${esc(JSON.stringify(c.payload))}'::jsonb, '${iso(-40)}', '${iso(-1)}')`)
}
const journal = [
  [d(0), 'call', '가온정밀 홍길동 대표 통화 — 연구소 공간 사진 오늘 보내 주기로', 'ex-gaon', null],
  [d(0), 'follow_up', '나래푸드 부가세 과세표준증명 받기', 'ex-narae', d(0)],
  [d(0), 'follow_up', '라임소프트 청년 채용 참여신청 서류 확인', 'ex-lime', d(1)],
  [d(-1), 'note', '다온바이오 — 연구 전담 인력 자격(학위 · 경력) 확인 필요', 'ex-daon', null],
  [d(-1), 'follow_up', '바른산업 1차 미팅 자료 준비(가지급금 정리 방법)', 'ex-bareun', d(3)],
  [d(-2), 'win', '마루에너지 정책자금 접수 완료', 'ex-maru', null],
]
journal.forEach(([date, type, content, cid, due], i) => {
  // 적은 시각도 낮 시간으로(찍는 시각이 한밤이어도)
  const at = `${date}T${String(8 + i).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00+09:00`
  sql(`insert into public.ops_journal_entries (workspace_id, owner_id, entry_date, entry_type, content, client_id, due_date, created_at, updated_at)
       values ('${WS}', '${PILOT.id}', '${date}', '${type}', '${esc(content)}', ${cid ? `'${cid}'` : 'null'}, ${due ? `'${due}'` : 'null'}, '${at}', '${at}')`)
})
// 고용지원금 — 예시 업체 2곳 · 직원 5명(이름은 모두 예시)
const mAgo = (m, dd = 0) => { const t = new Date(`${d(0)}T00:00:00Z`); t.setUTCMonth(t.getUTCMonth() - m); t.setUTCDate(t.getUTCDate() + dd); return t.toISOString().slice(0, 10) }
const yj = (paid) => [
  { id: 'r1', month: 6, amount: 3_600_000, label: '1차(6개월)', ...(paid ? { isPaid: true, paidDate: mAgo(2), received: 3_600_000 } : {}) },
  { id: 'r2', month: 9, amount: 1_800_000, label: '2차(9개월)' },
  { id: 'r3', month: 12, amount: 1_800_000, label: '3차(12개월)' },
]
const empDocs = (n) => ['근로계약서', '임금대장(6개월)', '급여이체확인서류', '개인정보동의서(근로자)'].map((label, i) => ({ id: `ed${i}`, label, done: i < n, files: [] }))
const emps = [
  ['e1', 'ex-lime', { name: '김도현', birthDate: '2000-04-12', gender: 'male', programId: 'youth_jump', status: 'inprogress', startDate: mAgo(8, 3), salary: 2_900_000, totalExpected: 7_200_000, rounds: yj(true), employeeDocs: empDocs(4) }],
  ['e2', 'ex-lime', { name: '권지민', birthDate: '1997-11-05', gender: 'female', programId: 'youth_jump', status: 'submitted', startDate: mAgo(5, 6), salary: 2_700_000, totalExpected: 7_200_000, rounds: yj(false), employeeDocs: empDocs(2) }],
  ['e3', 'ex-lime', { name: '박준혁', birthDate: '1999-03-15', gender: 'male', programId: 'youth_jump', status: 'preparing', startDate: mAgo(1, 4), salary: 2_600_000, totalExpected: 7_200_000, rounds: yj(false), employeeDocs: empDocs(1) }],
  ['e4', 'ex-gaon', { name: '장우진', birthDate: '1962-07-21', gender: 'male', programId: 'senior_continue', status: 'inprogress', startDate: mAgo(7, -10), salary: 3_100_000, totalExpected: 7_200_000,
    rounds: [{ id: 'q1', month: 3, amount: 900_000, label: '1분기', isPaid: true, paidDate: mAgo(3), received: 900_000 }, { id: 'q2', month: 6, amount: 900_000, label: '2분기' }, { id: 'q3', month: 9, amount: 900_000, label: '3분기' }, { id: 'q4', month: 12, amount: 900_000, label: '4분기' }],
    employeeDocs: [{ id: 'g1', label: '근로계약서', done: true, files: [] }, { id: 'g2', label: '월별임금대장', done: true, files: [] }, { id: 'g3', label: '재고용 근로계약서', done: false, files: [] }] }],
  ['e5', 'ex-gaon', { name: '한소희', birthDate: '1995-08-22', gender: 'female', programId: 'youth_jump', status: 'reviewing', startDate: mAgo(6, -2), salary: 2_800_000, totalExpected: 7_200_000, rounds: yj(false), employeeDocs: empDocs(3) }],
]
for (const [cid, meta] of [
  ['ex-lime', { createdAt: iso(-60), commission: { rate: 15, retainer: 300_000, billed: true, paid: true, successFee: true, memo: '착수금 입금 완료' }, notes: [{ id: 'n1', text: '권지민 1차 신청 서류 접수 — 결과 기다리는 중', at: iso(-3), author: '최은혜' }] }],
  ['ex-gaon', { createdAt: iso(-90), commission: { rate: 20, billed: false, paid: false, successFee: true, memo: '' }, notes: [] }],
]) {
  sql(`insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload, created_at, updated_at)
       values ('empco-${cid}', '${WS}', 'employment', 'companies', '${cid}', '${esc(JSON.stringify(meta))}'::jsonb, '${iso(-30)}', '${iso(-1)}')`)
}
for (const [id, cid, e] of emps) {
  const payload = { ...e, _v: 'orig', hireDate: e.startDate, stage: e.status }
  sql(`insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload, created_at, updated_at)
       values ('emp-${id}', '${WS}', 'employment', 'employees', '${cid}', '${esc(JSON.stringify(payload))}'::jsonb, '${iso(-30)}', '${iso(-1)}')`)
}
// 팀장 이름 · 직함(설정 › 내 정보에서 적은 것) · 안내 영상은 찍을 때 띄우지 않는다 · 작업공간 이름
sql(`update public.workspaces set name = '최은혜 팀장' where id = '${WS}'`)
sql(`update auth.users set raw_user_meta_data = '{"display_name":"최은혜","title":"팀장","tutorial_hidden":true}'::jsonb where id = '${PILOT.id}'`)

/* ---------------- PostgREST · 빌드 · 미리보기 ---------------- */
const PGRST = existsSync('.cache/postgrest/postgrest') ? '.cache/postgrest/postgrest' : process.env.POSTGREST_BIN
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore', detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${E2E_DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})
if (!process.env.SKIP_BUILD) {
  execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { stdio: 'ignore', env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' } })
}
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => { for (const p of [server, pgrst]) { try { process.kill(-p.pid) } catch { /* 이미 꺼짐 */ } } }
for (let i = 0; i < 80; i += 1) {
  try { const [a, b] = await Promise.all([fetch(BASE), fetch(`http://127.0.0.1:${PGRST_PORT}/`)]); if (a.ok && b.status < 500) break } catch { /* 아직 */ }
  await new Promise((r) => setTimeout(r, 250))
}

/* ---------------- 로그인 흉내 ---------------- */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(u) {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const meta = new Map([[PILOT.id, { display_name: '최은혜', title: '팀장', tutorial_hidden: true }]])
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: meta.get(u.id) ?? {}, created_at: '2026-01-01T00:00:00Z' })
const sessionOf = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `refresh-${u.id}`, user: userObj(u) })
const whoOf = (auth) => USERS.find((u) => jwt(u) === (auth ?? '').replace(/^Bearer /, '')) ?? null
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function route(r) {
  const req = r.request()
  const url = new URL(req.url())
  const path = decodeURIComponent(url.pathname)
  const headers = req.headers()
  if (path === '/auth/v1/token') {
    const body = JSON.parse(req.postData() ?? '{}')
    const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
    return u ? r.fulfill(json(sessionOf(u))) : r.fulfill(json({ error: 'invalid_grant' }, 400))
  }
  if (path === '/auth/v1/user') { const u = whoOf(headers['authorization']); return u ? r.fulfill(json(userObj(u))) : r.fulfill(json({ msg: 'no' }, 401)) }
  if (path === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
  if (path.startsWith('/storage/v1/')) {
    if (req.method() === 'POST' && path.startsWith('/storage/v1/object/sign/')) return r.fulfill(json({ signedURL: '/object/sign/x?token=t' }))
    return r.fulfill(json([]))
  }
  if (path.startsWith('/rest/v1/')) {
    const fwd = { ...headers }
    delete fwd['host']
    if (!whoOf(fwd['authorization'])) delete fwd['authorization']
    const res = await r.fetch({ url: `http://127.0.0.1:${PGRST_PORT}${path.slice('/rest/v1'.length)}${url.search}`, headers: fwd })
    return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body: await res.text() })
  }
  return r.fulfill(json([]))
}
// 기업마당 공고(예시) — 서버 함수 흉내
const ymd8 = (off) => d(off).replace(/-/g, '')
const FEED = [
  ['F1', '2026 경기도 제조기업 스마트공장 구축 지원', '경기도', '기술', '경기도 소재 제조 중소기업', '스마트공장 설비 도입비 최대 1억 원 지원', 9],
  ['F2', '2026 기업부설연구소 신규 설립 기업 R&D 바우처', '중소벤처기업부', '기술', '연구소 설립 3년 이내 중소기업', '연구개발 바우처 최대 5천만 원', 14],
  ['F3', '2026 청년 일자리 도약장려금 참여기업 모집', '고용노동부', '인력', '5인 이상 중소기업', '청년 채용 시 1인당 최대 1,200만 원', 20],
  ['F4', '2026 식품 제조기업 판로개척 지원사업', '농림축산식품부', '내수', '식품 제조 중소기업', '온라인 판로 · 박람회 참가비 지원', 6],
  ['F5', '2026 혁신성장 바우처(바이오)', '충청북도', '기술', '충북 소재 바이오 기업', '시제품 제작 · 인증 비용 지원', 11],
]
const feedItems = FEED.map(([id, nm, inst, realm, tgt, sum, end]) => ({ pblancId: `PBLN_${id}`, pblancNm: nm, jrsdInsttNm: inst, excInsttNm: '', reqstBeginEndDe: `${ymd8(-5)} ~ ${ymd8(end)}`, pldirSportRealmLclasCodeNm: realm, trgetNm: tgt, bsnsSumryCn: sum, pblancUrl: '', hashtags: '', creatPnttm: '' }))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const geo = []
async function newCtx(kind) {
  const opt = kind === 'pc'
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
    : { viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  const ctx = await browser.newContext({ ...opt, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  // 머리줄 시계가 한밤중으로 찍히지 않게 — 같은 날 오전 10시 24분(한국 시간)으로 멈춰 둔다(타이머는 그대로 돈다)
  await ctx.clock.setFixedTime(new Date(`${d(0)}T10:24:00+09:00`))
  await ctx.route(`https://${REF}.supabase.co/**`, route)
  await ctx.route('**/api/grants-feed*', (r) => r.fulfill(json({ fetchedAt: `${d(0)}T09:00:00+09:00`, count: feedItems.length, items: feedItems })))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('이메일').fill(PILOT.email)
  await page.getByLabel('비밀번호').fill(PILOT.password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  return { ctx, page }
}
async function settle(page, ms = 900) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
  // 깜빡이는 커서 · 알림 등 영상에 남지 않게
  await page.addStyleTag({ content: '*{caret-color:transparent!important} [data-sonner-toaster],[role="status"].toast{display:none!important}' }).catch(() => {})
}
/** 한 화면 — 전체 페이지(스크롤용 긴 그림) + 블록 위치 */
async function shot(page, kind, name, path, opts = {}) {
  if (path) await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await settle(page, opts.wait ?? 1100)
  if (opts.before) await opts.before(page)
  // 전체 그림은 맨 위에서 찍는다(내려가 있으면 고정 메뉴가 중간에 찍힌다)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(350)
  const blocks = await page.evaluate((sel) => {
    const out = {}
    for (const [k, s] of Object.entries(sel ?? {})) {
      const el = document.querySelector(s)
      if (el) { const b = el.getBoundingClientRect(); out[k] = { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height } }
    }
    // 화면 속 블록 위치(강조 상자 · 스크롤 멈춤 자리) — data-testid · 제목 · 메뉴 줄 · 단추
    const els = []
    for (const el of document.querySelectorAll('[data-testid], h1, h2, h3, aside nav a, aside nav button, main button, section')) {
      const b = el.getBoundingClientRect()
      if (b.width < 8 || b.height < 8) continue
      els.push({ id: el.getAttribute('data-testid') ?? '', tag: el.tagName.toLowerCase(), text: (el.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 40), x: Math.round(b.x + scrollX), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) })
    }
    return { blocks: out, els, H: document.documentElement.scrollHeight, W: document.documentElement.clientWidth }
  }, opts.blocks)
  const file = `${OUTDIR}/${kind}-${name}.png`
  let chrome = []
  if (kind === 'mo' && opts.full !== false) {
    // 휴대폰: 위 머리줄 · 아래 메뉴는 따로(화면 그대로 한 장) 찍고, 긴 그림에서는 숨긴다 — 영상에서 스크롤할 때 제자리에 붙여 쓴다
    await page.screenshot({ path: `${OUTDIR}/${kind}-${name}-top.png` })
    chrome = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
        const b = el.getBoundingClientRect()
        if (b.width < innerWidth * 0.9 || b.height > 140 || b.height < 20) continue
        if (b.top <= 2) out.push({ edge: 'top', y: Math.round(b.top), h: Math.round(b.height) })
        else if (b.bottom >= innerHeight - 2) out.push({ edge: 'bottom', y: Math.round(b.top), h: Math.round(b.height) })
        else continue
        el.style.visibility = 'hidden'
      }
      return out
    })
    await page.waitForTimeout(200)
  }
  await page.screenshot({ path: file, fullPage: opts.full !== false })
  geo.push({ name: `${kind}-${name}`, path, chrome, ...blocks })
  console.log('찍음', `${kind}-${name}`, blocks.H)
}

try {
  const pc = await newCtx('pc')
  const P = pc.page
  await shot(P, 'pc', 'today', '/', { blocks: { agenda: '[data-testid="today-agenda"]' } })
  await shot(P, 'pc', 'clients', '/ops/clients')
  await shot(P, 'pc', 'client-smart', '/ops/clients/ex-gaon?tab=smart')
  await shot(P, 'pc', 'client-overview', '/ops/clients/ex-gaon?tab=overview')
  await shot(P, 'pc', 'client-docs', '/ops/clients/ex-gaon?tab=docs')
  await shot(P, 'pc', 'client-work', '/ops/clients/ex-gaon?tab=work')
  await shot(P, 'pc', 'decide', '/ops/decide')
  await shot(P, 'pc', 'calendar', '/ops/calendar')
  await shot(P, 'pc', 'journal', '/journal')
  await shot(P, 'pc', 'sales', '/sales/board')
  await shot(P, 'pc', 'employment', '/tools/employment', { wait: 2500 })
  for (const sec of ['diagnosis', 'wage', 'board']) await shot(P, 'pc', `emp-${sec}`, `/tools/employment/${sec}`, { wait: 2200 })
  await shot(P, 'pc', 'emp-company', '/tools/employment/companies?cid=ex-lime', { wait: 2500 })
  // 회차 일정 — 입사일 하나 넣은 모습
  await P.goto(`${BASE}/tools/employment/schedule?client=ex-lime`, { waitUntil: 'networkidle' }); await settle(P, 1500)
  await P.locator('input[type="date"]').first().fill(mAgo(5, 6)).catch((e) => console.log('schedule date', String(e).slice(0, 80)))
  await shot(P, 'pc', 'emp-schedule', null, { wait: 900 })
  await shot(P, 'pc', 'labcare', '/tools/labcare', { wait: 2500 })
  for (const sec of ['assessment', 'setup-docs', 'notes', 'changes', 'survey', 'check', 'inspection', 'tax']) await shot(P, 'pc', `lab-${sec}`, `/tools/labcare/${sec}?client=ex-daon`, { wait: 2200 })
  await shot(P, 'pc', 'marketing', '/marketing')
  await shot(P, 'pc', 'grants', '/grants', { wait: 2000 })
  await shot(P, 'pc', 'tax', '/tools/tax', { wait: 2000 })
  await shot(P, 'pc', 'taxplan', '/tools/tax?client=ex-gaon', { wait: 2000 })
  await shot(P, 'pc', 'policy', '/tools/policy-funding', { wait: 2500 })
  await shot(P, 'pc', 'policy-sample', '/tools/policy-funding/diagnosis?sample=1', { wait: 2500 })
  await shot(P, 'pc', 'cert', '/tools/cert-os?client=ex-gaon', { wait: 2000 })
  await shot(P, 'pc', 'startup', '/tools/startup-tax', { wait: 2000 })
  await shot(P, 'pc', 'money', '/money')
  // 크레탑 — 예시 보고서(시험용 견본 · 한빛정밀) 올려 분석한 모습
  await P.goto(`${BASE}/tools/cretop`, { waitUntil: 'networkidle' }); await settle(P)
  await P.getByLabel('크레탑 보고서 파일').setInputFiles('e2e/fixtures/cretop-sample.pdf').catch((e) => console.log('cretop upload', String(e).slice(0, 80)))
  await P.waitForFunction(() => (document.querySelector('#mini-results')?.textContent ?? '').trim().length > 40, null, { timeout: 25000 }).catch(() => {})
  await shot(P, 'pc', 'cretop', null, { wait: 1200 })
  await shot(P, 'pc', 'settings', '/settings')
  // 고객 관리 · 업체 상세의 '서류 올리기' 창(열린 모습)
  await P.goto(`${BASE}/ops/clients/ex-gaon?tab=docs`, { waitUntil: 'networkidle' })
  await settle(P)
  const up = P.getByRole('button', { name: /서류 올리기/ }).first()
  if (await up.count()) { await up.click().catch(() => {}); await P.waitForTimeout(800); await P.screenshot({ path: `${OUTDIR}/pc-upload-sheet.png` }); console.log('찍음 pc-upload-sheet') }
  await P.keyboard.press('Escape').catch(() => {})
  // 메뉴(사이드바)만 — 그대로 · '출시 예정' 펼친 모습
  await P.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await settle(P)
  await P.locator('aside').first().screenshot({ path: `${OUTDIR}/pc-sidebar.png` }).catch(() => {})
  // 메뉴 전체가 한 장에 들어오게 창을 길게 늘려 찍는다
  await P.setViewportSize({ width: 1440, height: 2400 })
  await P.waitForTimeout(400)
  await P.locator('aside').getByRole('button', { name: /출시 예정/ }).first().click().catch(() => {})
  await P.waitForTimeout(600)
  await P.locator('aside').first().screenshot({ path: `${OUTDIR}/pc-sidebar-upcoming.png` }).catch(() => {})
  const upGeo = await P.locator('aside').first().evaluate((el) => [...el.querySelectorAll('a, button')].map((x) => { const b = x.getBoundingClientRect(); return { text: (x.innerText ?? '').trim().replace(/\s+/g, ' ').slice(0, 30), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } }))
  geo.push({ name: 'pc-sidebar-upcoming', path: '/', els: upGeo.map((e) => ({ id: '', tag: 'a', ...e })), H: 2400, W: 288 })
  await P.setViewportSize({ width: 1440, height: 900 })
  await pc.ctx.close()

  const mo = await newCtx('mo')
  const M = mo.page
  await shot(M, 'mo', 'today', '/')
  await shot(M, 'mo', 'clients', '/ops/clients')
  await shot(M, 'mo', 'client-smart', '/ops/clients/ex-gaon?tab=smart')
  await shot(M, 'mo', 'client-overview', '/ops/clients/ex-gaon?tab=overview')
  await shot(M, 'mo', 'client-docs', '/ops/clients/ex-gaon?tab=docs')
  await shot(M, 'mo', 'decide', '/ops/decide')
  await shot(M, 'mo', 'calendar', '/ops/calendar')
  await shot(M, 'mo', 'sales', '/sales/board')
  await shot(M, 'mo', 'grants', '/grants', { wait: 2000 })
  await shot(M, 'mo', 'employment', '/tools/employment', { wait: 2500 })
  // 더보기(서랍 메뉴)
  await M.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await settle(M)
  await M.getByRole('button', { name: /더보기|메뉴 열기/ }).last().click().catch(() => {})
  await M.waitForTimeout(600)
  await M.screenshot({ path: `${OUTDIR}/mo-drawer.png` })
  await mo.ctx.close()
} finally {
  writeFileSync(`${OUTDIR}/shots.json`, JSON.stringify(geo, null, 1))
  await browser.close()
  stop()
}
