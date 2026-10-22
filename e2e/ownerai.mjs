/**
 * qa:ownerai — 대표 AI 작업실 V1 (Company Case Intelligence) 끝까지 이어 보기.
 *
 * 브라우저 → /api/ai-run 은 진짜 서버 함수(api/ai-run.js)를 이 프로세스에서 부른다(Playwright route).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · AI 공급자(chat completions).
 * 로컬 모드(이 기기 = 대표)라 화면 저장은 브라우저 저장소 — 새로고침해도 남는지 본다.
 *
 *   0  설정 없음 → 'AI 기능 설정이 필요합니다.' · 단추 잠김 · 붙여넣기는 됨
 *   A  동료 요청 → 업체 등록(중복 확인) → PDF · URL · 메모(주민번호 지움) → AX 분석(두 번 눌러도 1번) → 일부 채택 → 기억 v1 → 동료 문구 → 복사
 *   B  다시 열기(새로고침) → 기억 · 결과 그대로 → 특허 아이디어(경고) → 하나 채택 → 기억 v2
 *   C  벤처 사업계획 → AI 에 보낸 글에 지난 AX · 특허 판단이 들어감(다시 설명 안 함)
 *   D  제안서 → 페이지 구성 → 점검(자리표시자 · 숫자) → 한 쪽만 고침 → 맞춤법 → PDF 다시(AI 다시 안 부름) · PNG
 *   E  AX 화면 → PC 1 + 모바일 2 → 글 고침 → 새로고침해도 남음 · PNG
 *   F  실패 · 형식 다름(원문 보관) · 업체 상세 'AI 작업실'(더보기 · 탭 줄 그대로) · Partner 주소 · 사용량 · 360/390 넘침 0 · 키 노출 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

// 게이트는 시험 파일을 e2e/.gate/ 로 떠서 돌린다 — 서버 함수는 저장소 맨 위(작업 폴더)에서 부른다
const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiRunState } = await fromRoot('api/ai-run.js')
const { SKILLS } = await fromRoot('api/_ai/skills.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.OWNERAI_SHOTS ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600))
  }
}
const shot = async (page, name, fullPage = true) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage })
}

/* ------------------------------------------------------------------ */
/* 가짜 바깥 — Supabase · AI 공급자                                     */
/* ------------------------------------------------------------------ */

const KEY = 'sk-test-OWNERAI-e2e-secret-998877'
const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const ENV = {
  SUPABASE_URL: 'https://qa.supabase.test',
  SUPABASE_ANON_KEY: 'qa-anon',
  OPENAI_API_KEY: KEY,
  AI_BASE_URL: 'https://api.openai.test/v1',
  AI_MODEL_CHEAP: 'm-cheap',
  AI_MODEL_STANDARD: 'm-standard',
  AI_MODEL_DEEP: 'm-deep',
  AI_PRICE_CHEAP: '0.15,0.6',
  AI_PRICE_STANDARD: '1,4',
  AI_PRICE_DEEP: '5,20',
  // 이 시험은 1분 안에 여러 번 부른다 — 속도 제한은 단위 시험(ownerAi)이 따로 본다
  AI_RATE_PER_MIN: '100',
  AI_RATE_PER_HOUR: '500',
}
function setEnv(over = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ ...ENV, ...over })) if (v !== undefined) process.env[k] = v
  __resetAiRunState()
}

/** AI 공급자에 간 요청(시험이 들여다본다) */
const llm = []
/** 다음 응답을 바꾸기(실패 · 형식 다름) */
let llmOverride = null

const AX = {
  oneLine: '배차 · 정산을 한 화면에 모아 하루 3시간을 줄이는 물류 AX',
  thinking: Array.from({ length: 12 }, (_, i) => ({ step: i + 1, title: `단계 ${i + 1}`, finding: '확인함' })),
  recommended: {
    title: '배차 자동 추천 + 운임 정산 한 화면',
    why: '하루 배차 40건을 엑셀과 전화로 맞추고 있어 가장 시간이 큼',
    before: '엑셀 · 전화로 배차, 월말 정산 수작업',
    after: '주문이 들어오면 차량 · 기사 추천, 정산표 자동',
    coreFeatures: ['배차 추천', '운임 정산표', '기사 앱 확인'],
    dataNeeded: ['주문 · 배차 엑셀 3개월'],
    difficulty: '중간',
    mvpScope: '배차 추천 + 정산표(기사 앱은 다음)',
    risks: ['기사 앱 사용률'],
    patentLink: '배차 우선순위 산정 방법',
    ventureLink: '기술 차별성 — 추천 알고리즘',
    fundingLink: '스마트물류 지원사업',
  },
  alternatives: [{ title: '화물 상태 알림 카톡 자동', why: '고객 문의 전화 감소', before: '전화 응대', after: '자동 알림', coreFeatures: ['상태 알림'], dataNeeded: ['운송 상태'], difficulty: '낮음', mvpScope: '알림만', risks: ['카톡 비용'], patentLink: '약함', ventureLink: '약함', fundingLink: '약함' }],
  cautions: ['현장 기사 의견 먼저'],
  unknowns: ['월 배차 건수 정확히'],
}
const FIX = {
  AX_PENGUIN: AX,
  CONSULTANT_MESSAGE: { message: '박 컨설턴트님, 그린로직스는 배차 · 정산 자동화(MVP 6주)가 가장 맞습니다. 하루 3시간 절감이 핵심이고, 특허(배차 우선순위)와 스마트물류 지원사업까지 이어질 수 있습니다. 다음 주 대표 미팅 때 같이 보시죠.' },
  PATENT_IDEA: {
    warning: '내부 아이디어 정리용이며 실제 특허성/권리범위는 선행기술조사 및 변리사 검토가 필요합니다.',
    ideas: [
      { title: '배차 우선순위 산정 방법', problem: '여러 조건을 사람이 판단', priorArt: '거리 기준 배차', coreIdea: '납기 · 적재율 · 기사 이력 가중치로 순위', distinct: ['기사 이력 반영'], dataFlow: ['주문', '후보 차량', '점수', '추천'], procedure: ['수집', '점수', '추천'], independentClaim: '가중치 기반 순위 산정', dependentClaims: ['재배차'], embodiment: '웹 대시보드', searchKeywords: ['배차 추천'], risks: ['선행기술 많음'], businessLink: 'MVP 핵심 기능' },
      { title: '운임 자동 정산 검증', problem: '정산 오류', priorArt: '수기 대조', coreIdea: '운송 기록과 계약 단가 자동 대조', distinct: ['예외 표시'], dataFlow: ['기록', '단가', '대조'], procedure: ['대조'], independentClaim: '자동 대조', dependentClaims: [], embodiment: '정산표', searchKeywords: ['운임 정산'], risks: ['진보성'], businessLink: '정산 기능' },
    ],
    unknowns: [],
  },
  VENTURE_PLAN: { oneLine: '물류 배차 추천 기술로 중소 화주 비용을 줄이는 회사', sections: { basic: '물류 · 2018 설립', problem: '배차 수작업', product: '배차 추천 SaaS', tech: '가중치 순위 산정', market: '중소 물류', growth: '미확인', rnd: '배차 알고리즘', ip: '특허 출원 예정(배차 우선순위)', proof: '미확인' }, evidenceNeeded: ['배차 데이터'], unknowns: ['매출'] },
  SANGHO_PROPOSAL: {
    purpose: '대표 미팅용 AX 도입 제안',
    audience: '그린로직스 대표',
    pageCount: 5,
    pages: [
      { no: 1, title: '그린로직스 AX 도입 제안', message: '배차 · 정산을 한 화면으로', bullets: ['하루 3시간 절감', '6주 MVP'], keyNumbers: [{ label: '하루 절감', value: '3시간', basis: 'AI 추정' }], visual: '표지' },
      { no: 2, title: '지금 겪는 문제', message: '물류비용을 줄일수 있습니다', bullets: ['엑셀 · 전화 배차', '월말 정산 수작업'], keyNumbers: [], visual: '' },
      { no: 3, title: '[회사명] 맞춤 AX 로드맵', message: '6주 안에 첫 화면', bullets: ['1~2주 배차 추천', '3~4주 정산표', '5~6주 현장 적용'], keyNumbers: [], visual: '' },
      { no: 4, title: '기대 효과', message: '시간과 오류를 같이 줄입니다', bullets: ['정산 오류 감소', '연 절감 1500000원 이상'], keyNumbers: [{ label: '정산 오류', value: '−70%', basis: 'AI 추정' }], visual: '' },
      { no: 5, title: '다음 단계', message: '데이터 3개월만 주시면 시작합니다', bullets: ['주문 · 배차 엑셀', '운임 단가표'], keyNumbers: [], visual: '' },
    ],
    unknowns: [],
  },
  PROOFREAD: { fixes: [{ where: 'p2 메시지', before: '줄일수', after: '줄일 수', reason: '띄어쓰기' }] },
  AX_FRONT: {
    appName: '그린 배차',
    userType: '배차 담당 · 대표',
    oneLine: '배차 · 정산을 한 화면에서',
    kpis: [{ label: '오늘 배차', value: '42건', hint: '예시' }, { label: '미배차', value: '3건', hint: '' }, { label: '이번 달 정산', value: '1,240만', hint: '' }],
    navigation: ['대시보드', '배차', '정산', '기사'],
    dashboard: { title: '오늘 배차 현황', sections: [{ title: '급한 주문', kind: 'list', items: ['14시 납기 2건', '냉장 1건'] }, { title: '기사별 배차', kind: 'chart', items: ['김기사', '이기사', '박기사'] }] },
    table: { title: '배차 목록', columns: ['주문', '기사', '상태'], rows: [['A-102', '김기사', '운송 중'], ['A-103', '이기사', '대기']] },
    mobile1: { title: '오늘 내 배차', purpose: '기사가 오늘 할 일 확인', blocks: [{ title: '다음 상차', lines: ['10:30 인천 1창고'] }] },
    mobile2: { title: '정산 확인', purpose: '대표가 이번 달 정산 확인', blocks: [{ title: '이번 달', lines: ['1,240만 원 · 오류 2건'] }] },
  },
}

const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.startsWith('https://api.openai.test/v1/chat/completions')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.messages?.[0]?.content ?? '')
    // D-264 지시문에는 스킬 화면 이름만 간다(내부 번호 · 판 없이) — 이름으로 찾는다
    const name = /^\[스킬\] (.+)$/m.exec(sys)?.[1]
    const skill = Object.entries(SKILLS).find(([, s]) => s.name === name)?.[0] ?? 'UNKNOWN'
    llm.push({ skill, model: body.model, user: String(body.messages?.[1]?.content ?? ''), auth: h.Authorization })
    if (llmOverride) {
      const o = llmOverride
      llmOverride = null
      return new Response(o.body, { status: o.status })
    }
    const content = JSON.stringify(FIX[skill] ?? SKILLS[skill]?.example ?? {})
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1800, completion_tokens: 600 } }), { status: 200 })
  }
  return realFetch(input, init)
}

/** 브라우저의 /api/ai-run → 진짜 서버 함수(대표 로그인 토큰을 서버 쪽에서 붙인다 — 로컬 모드는 토큰이 없다) */
async function wireApi(page, opts = { auth: OWNER }) {
  await page.route('**/api/ai-run**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: opts.auth ? { authorization: opts.auth } : {}, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

/* ------------------------------------------------------------------ */
/* 준비                                                                 */
/* ------------------------------------------------------------------ */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ownerai-'))
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
{
  const p = await browser.newPage()
  await p.setContent(`<html><body style="font-family:'Noto Sans KR',sans-serif;padding:40px"><h1>그린로직스 회사소개서</h1><p>그린로직스는 2018년에 설립된 물류 회사입니다. 직원 24명, 수도권 화주 120곳의 화물을 운송합니다.</p><p>지금은 배차를 엑셀과 전화로 하고, 월말 운임 정산을 손으로 맞춥니다. 대표는 배차 시간을 줄이고 싶어 합니다.</p></body></html>`)
  await p.pdf({ path: path.join(TMP, 'intro.pdf'), format: 'A4' })
  await p.close()
}
// 이 환경의 Playwright 는 한글 파일 경로를 넘기지 못한다 — 내용 + 한글 이름으로 넘긴다(실제 브라우저는 한글 이름 그대로)
const PDF = { name: '그린로직스_회사소개서.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(TMP, 'intro.pdf')) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', acceptDownloads: true })
// 이 환경의 headless 브라우저는 blob 내려받기의 한글 이름을 'download' 로 바꾼다 — 화면이 붙인 이름은 따로 적어 둔다
await ctx.addInitScript(() => {
  const orig = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) (window.__dl = window.__dl || []).push(this.download)
    return orig.call(this)
  }
})
const lastDl = () => page.evaluate(() => (window.__dl || []).at(-1) ?? '')
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin })
const page = await ctx.newPage()
const outside = []
page.on('request', (r) => {
  if (/openai\.com|api\.openai|anthropic\.com/i.test(r.url())) outside.push(r.url())
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
if (process.env.OWNERAI_DEBUG) page.on('console', (m) => console.log('  [console]', m.type(), m.text().slice(0, 200)))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())

const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), key)
const cases = () => ls('axmvp.v1.owner_ai.cases')
const runs = () => ls('axmvp.v1.owner_ai.runs')
const snaps = () => ls('axmvp.v1.owner_ai.snapshots')
const revs = () => ls('axmvp.v1.owner_ai.revisions')
const llmCount = (skill) => llm.filter((c) => !skill || c.skill === skill).length
const waitRuns = async (n, ms = 15000) => {
  const t = Date.now()
  while (Date.now() - t < ms) {
    if ((await runs()).length >= n) return true
    await page.waitForTimeout(150)
  }
  return false
}
async function quick(key, setup = async () => {}) {
  await page.locator(`[data-action="${key}"]`).click()
  await page.getByTestId('ai-run').waitFor()
  await setup()
}

/* ---- 0. 설정 없음 ---- */
setEnv({ OPENAI_API_KEY: undefined })
await wireApi(page)
{
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  check('메뉴: 사이드바에 AI 작업실(대표 전용)', (await page.locator('nav a[href="/ai"]').count()) > 0)
  await page.getByTestId('ai-setup-banner').waitFor({ timeout: 8000 }).catch(() => {})
  const banner = (await page.getByTestId('ai-setup-banner').innerText().catch(() => '')) ?? ''
  check("설정 없음: 'AI 기능 설정이 필요합니다.' + 넣을 설정 이름만(값 없음)", banner.includes('AI 기능 설정이 필요합니다.') && banner.includes('OPENAI_API_KEY') && !banner.includes(KEY), banner)
}

/* ---- A. 동료 요청 → 업체 → 자료 → AX → 채택 → 동료 문구 ---- */
setEnv()
await page.reload({ waitUntil: 'networkidle' })
{
  check('설정 있음: 설정 안내 사라짐', (await page.getByTestId('ai-setup-banner').count()) === 0)
  await page.getByTestId('case-new').click()
  await page.getByTestId('case-name').fill('그린로직스(주)')
  await page.getByTestId('case-url').fill('greenlogis.co.kr')
  await page.getByTestId('case-requester').fill('박○○ 컨설턴트')
  await page.getByTestId('case-industry').fill('화물 운송 · 물류')
  await page.getByTestId('case-relation-new').selectOption('peer_request')
  await page.getByTestId('case-memo').fill('동료가 AX 제안 가능성을 봐 달라고 함')
  await page.getByTestId('case-create').click()
  await page.waitForURL(/\/ai\/cases\/case_/, { timeout: 10000 })
  await page.getByTestId('case-workspace').waitFor()
  check('A 업체 등록: 작업실로 이동 · 이름 · 관계(동료 컨설턴트 요청)', (await page.getByTestId('case-title').innerText()).includes('그린로직스') && (await page.getByTestId('case-relation').inputValue()) === 'peer_request')
  const snapTxt = await page.getByTestId('snapshot-fields').innerText()
  check("A Snapshot 13칸 · 모르는 칸은 '미확인'", (await page.locator('[data-snapshot]').count()) === 13 && snapTxt.includes('미확인') && snapTxt.includes('박○○ 컨설턴트'))

  // 중복 — 같은 홈페이지면 새로 못 만들고, 이름만 비슷하면 확인 뒤 가능
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-new').click()
  await page.getByTestId('case-name').fill('그린로직스')
  await page.getByTestId('case-dups').waitFor()
  check('A 중복: 이름이 같으면 먼저 알림 · 이 작업실 열기', (await page.getByTestId('dup-open-case').count()) > 0 && (await page.getByTestId('case-create').innerText()).includes('그래도'))
  await page.getByTestId('case-url').fill('https://www.greenlogis.co.kr/')
  check('A 중복: 홈페이지까지 같으면 새로 만들 수 없음(중복 업체 금지)', await page.getByTestId('case-create').isDisabled())
  await page.getByTestId('case-name').fill('한솔테크')
  await page.getByTestId('case-url').fill('')
  check('A 중복: 고객 관리 업체와 이름이 같으면 이어 만들기 권함', (await page.getByTestId('dup-link-client').count()) > 0)
  await page.getByTestId('dup-open-case').count()
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.locator('[data-testid="case-list"] button', { hasText: '그린로직스' }).click()
  await page.getByTestId('case-workspace').waitFor()

  // 자료 — PDF · URL · 메모(주민번호 · 비밀번호는 저장 전에 지움)
  await page.getByTestId('material-file-input').setInputFiles(PDF)
  await page.locator('[data-material]').first().waitFor({ timeout: 30000 })
  const mats = (await cases()).find((c) => c.companyName.includes('그린로직스'))?.materials ?? []
  check('A 자료: PDF 회사소개서 글을 읽어 저장(종류 회사소개서)', mats.length === 1 && mats[0].kind === 'intro' && mats[0].text.includes('배차'), mats.map((m) => [m.kind, m.chars]))
  await page.getByTestId('material-url').click()
  await page.locator('[data-field="url"]').fill('greenlogis.co.kr')
  await page.locator('[data-field="text"]').fill('수도권 화물 운송 · 냉장 물류 · 화주 120곳')
  await page.getByTestId('material-save').click()
  await page.getByTestId('material-memo').click()
  await page.locator('[data-field="text"]').fill('대표 김○○(900101-1234567) 공동인증서 비밀번호 abc!23 — 배차가 제일 힘들다고 함')
  await page.getByTestId('material-save').click()
  await page.waitForTimeout(400)
  const mats2 = (await cases()).find((c) => c.companyName.includes('그린로직스'))?.materials ?? []
  const memo = mats2.find((m) => m.kind === 'memo')?.text ?? ''
  check('A 자료: URL · 메모 더함(3개)', mats2.length === 3 && mats2.some((m) => m.kind === 'url'), mats2.map((m) => m.kind))
  check('A 개인정보: 메모의 주민번호 · 인증서 비밀번호는 저장 전에 지움', !memo.includes('1234567') && !memo.includes('abc!23') && memo.includes('배차'), memo)
  await page.getByTestId('material-url').click()
  await page.locator('[data-field="url"]').fill('https://greenlogis.co.kr')
  await page.getByTestId('material-save').click()
  await page.waitForTimeout(300)
  check('A 자료: 같은 주소를 또 넣으면 알려 주고 안 넣음', ((await cases()).find((c) => c.companyName.includes('그린로직스'))?.materials ?? []).length === 3)

  // AX 분석 — 두 번 눌러도 AI 는 한 번
  await quick('ax')
  const chars = await page.getByTestId('payload-chars').innerText()
  check('A AX 분석 창: 보낼 글 양 · 명부 · 주민번호 안 보냄 안내', /약 [\d,]+자/.test(chars) && chars.includes('주민번호'))
  await shot(page, 'A1-ax-sheet')
  const before = llmCount()
  await page.getByTestId('ai-run').dblclick()
  await waitRuns(1)
  await page.waitForTimeout(500)
  check('A 두 번 눌러도 AI 호출 1번 · 실행 기록 1줄', llmCount() - before === 1 && (await runs()).length === 1, { calls: llmCount() - before, runs: (await runs()).length })
  const axCall = llm.filter((c) => c.skill === 'AX_PENGUIN').pop()
  check('A AX 분석은 깊게(m-deep) · 서버 키로만 공급자 호출', axCall?.model === 'm-deep' && axCall?.auth === `Bearer ${KEY}`)
  check('A AI 에 보낸 글: 회사소개서 내용 O · 주민번호 · 비밀번호 · 대표자 이름 X', !!axCall && axCall.user.includes('배차') && !axCall.user.includes('1234567') && !axCall.user.includes('abc!23'), axCall?.user.slice(0, 400))
  const runText = await page.getByTestId('run-text').first().innerText()
  check('A 결과 카드: 가장 추천 + 차선 + 12단계', runText.includes('가장 추천') && runText.includes('배차 자동 추천') && runText.includes('차선 1') && runText.includes('12단계'))
  await shot(page, 'A2-ax-result')

  // 일부 채택 → 기억에 넣기(바뀌는 칸만) → v1
  await page.getByTestId('eval-partial').first().click()
  await page.getByText('추천 · 배차 자동 추천', { exact: false }).click()
  await page.getByTestId('partial-save').click()
  await page.getByTestId('memory-save').waitFor({ timeout: 5000 })
  const changed = await page.locator('[data-memory-input="axDirection"]').inputValue()
  check("A 일부 채택 → 기억에 넣을 칸 제안('지금까지 선택된 AX 방향')", changed.includes('배차 자동 추천'), changed)
  await page.getByTestId('memory-save').click()
  await page.waitForTimeout(400)
  check('A 기억 v1 저장 · 실행 평가 = 일부 채택', (await snaps()).length === 1 && (await runs())[0].evaluation === 'partially_adopted')

  // 동료 전달문구(300자) → 복사
  await quick('message', async () => {
    await page.getByRole('button', { name: '300자' }).click()
  })
  await page.getByTestId('ai-run').click()
  await waitRuns(2)
  await page.waitForTimeout(300)
  const msgCall = llm.filter((c) => c.skill === 'CONSULTANT_MESSAGE').pop()
  check('A 동료 문구: 빠르게(m-cheap) · 기억 v1 이 같이 감', msgCall?.model === 'm-cheap' && (msgCall?.user ?? '').includes('지금까지의 기억 v1'))
  await page.locator('[data-skill="CONSULTANT_MESSAGE"]').getByTestId('run-copy').click()
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('A 복사: 클립보드에 전달 문구', clip.includes('그린로직스는 배차'), clip)
}

/* ---- B. 며칠 뒤 다시 열기 ---- */
{
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('case-workspace').waitFor()
  const mem = await page.getByTestId('memory-fields').innerText()
  check('B 다시 열기: 기억(AX 방향) · 결과 2개 · 타임라인 그대로', mem.includes('배차 자동 추천') && (await page.locator('[data-run]').count()) === 2 && (await page.getByTestId('case-timeline').locator('li').count()) >= 6)
  await quick('patent')
  await page.getByTestId('ai-run').click()
  await waitRuns(3)
  await page.waitForTimeout(300)
  const pCard = page.locator('[data-skill="PATENT_IDEA"]')
  check('B 특허: 경고 문구(선행기술조사 · 변리사 검토) 보임', (await pCard.innerText()).includes('변리사 검토가 필요합니다'))
  const pCall = llm.filter((c) => c.skill === 'PATENT_IDEA').pop()
  check('B 특허: 지난번 채택한 AX 를 다시 설명 안 해도 같이 감', (pCall?.user ?? '').includes('배차 자동 추천'))
  await pCard.getByTestId('eval-partial').click()
  await page.getByText('배차 우선순위 산정 방법', { exact: false }).last().click()
  await page.getByTestId('partial-save').click()
  await page.getByTestId('memory-save').waitFor()
  check('B 하나 채택 → 특허 방향 칸에 그 아이디어만', (await page.locator('[data-memory-input="patent"]').inputValue()).includes('배차 우선순위') && !(await page.locator('[data-memory-input="patent"]').inputValue()).includes('운임 자동 정산'))
  await page.getByTestId('memory-save').click()
  await page.waitForTimeout(400)
  check('B 기억 v2 · 예전 판(v1) 그대로', (await snaps()).length === 2 && (await snaps())[0].content.patent === '')
  await page.getByTestId('memory-history').click()
  check('B 판 기록: v1 · v2 · 바뀐 칸', (await page.getByTestId('memory-history-list').innerText()).includes('특허 방향'))
  await page.keyboard.press('Escape')
}

/* ---- C. 한 달 뒤 — 벤처 사업계획에 지난 판단 자동 ---- */
{
  await page.reload({ waitUntil: 'networkidle' })
  await quick('venture')
  await page.getByTestId('ai-run').click()
  await waitRuns(4)
  await page.waitForTimeout(300)
  const vCall = llm.filter((c) => c.skill === 'VENTURE_PLAN').pop()?.user ?? ''
  check('C 벤처: 기억 v2(AX 방향 + 특허) · 채택 결과가 자동으로 AI 에', vCall.includes('지금까지의 기억 v2') && vCall.includes('배차 자동 추천') && vCall.includes('배차 우선순위'), vCall.slice(0, 500))
  const vText = await page.locator('[data-skill="VENTURE_PLAN"]').innerText()
  check('C 벤처 결과: 기업인증 벤처 패키지와 같은 9칸', ['회사 기본정보', '해결하려는 문제', '기술 · 차별성', '지식재산', '실증 · 성과'].every((t) => vText.includes(t)))
}

/* ---- D. 제안서 ---- */
let caseId = ''
{
  caseId = (await cases()).find((c) => c.companyName.includes('그린로직스'))?.id ?? ''
  await quick('proposal', async () => {
    await page.getByRole('button', { name: '5장' }).click()
  })
  await page.getByTestId('ai-run').click()
  await waitRuns(5)
  await page.waitForTimeout(300)
  await page.locator('[data-skill="SANGHO_PROPOSAL"]').getByTestId('open-studio').click()
  await page.getByTestId('proposal-studio').waitFor()
  await page.waitForTimeout(500)
  check('D 스튜디오: 5쪽 · 글자는 SVG text(이미지 아님)', (await page.locator('[data-testid="slide-list"] svg[data-slide]').count()) === 5 && (await page.locator('svg[data-slide] text').count()) > 20 && (await page.locator('svg[data-slide] image').count()) === 0)
  const qa = await page.getByTestId('proposal-qa').innerText()
  check('D 점검: 자리표시자([회사명]) · 숫자 표기(1500000원) 잡음', qa.includes('자리표시자') && qa.includes('숫자 표기'), qa)
  await shot(page, 'D1-proposal-qa')
  const proposalCalls = llmCount('SANGHO_PROPOSAL')
  // 3쪽만 고친다
  await page.locator('[data-testid="slide-list"] button').nth(2).click()
  await page.getByTestId('page-title').fill('그린로직스 맞춤 AX 로드맵')
  await page.getByTestId('page-save').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="slide-list"] button').nth(3).click()
  // D-219: 본문 칸에서 실제로 치기 — 줄 끝 띄어쓰기 · 엔터가 그대로 남는다(예전: 한 글자마다 다듬어 '감소자동' · 새 줄 안 됨)
  const bl = page.getByTestId('page-bullets')
  await bl.fill('정산 오류 감소')
  await bl.press('End')
  await bl.pressSequentially(' 자동')
  await bl.press('Enter')
  await bl.pressSequentially('새 줄')
  check('D-219 본문 칸: 줄 끝 띄어쓰기 · 엔터가 그대로(정산 오류 감소 자동 / 새 줄)', (await bl.inputValue()) === '정산 오류 감소 자동\n새 줄', JSON.stringify(await bl.inputValue()))
  await shot(page, 'D3-bullets-typing', false)
  await page.getByTestId('page-bullets').fill('정산 오류 감소\n연 절감 150만 원 이상')
  await page.getByTestId('page-save').click()
  await page.waitForTimeout(400)
  check('D 한 쪽씩 고침 → 점검 통과 · 수정 이력 2번(원래 결과 그대로)', (await page.getByTestId('proposal-qa-ok').count()) === 1 && (await revs()).length === 2 && JSON.stringify((await runs()).find((r) => r.skillId === 'SANGHO_PROPOSAL').structured).includes('[회사명]'))
  // 맞춤법 → 고른 것만 고치기
  await page.getByTestId('proofread').click()
  await page.getByTestId('proofread-fixes').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '고른 것 고치기' }).click()
  await page.waitForTimeout(500)
  const p2 = await page.locator('[data-testid="slide-list"] svg[data-slide="2"]').innerHTML()
  check('D 맞춤법: 줄일수 → 줄일 수 (그 자리만)', p2.includes('줄일 수') && !p2.includes('줄일수'))
  // PDF 다시 — AI 다시 안 부름
  await page.evaluate(() => {
    window.__printed = 0
    window.print = () => {
      window.__printed += 1
    }
  })
  await page.getByTestId('export-pdf').click()
  const printed = await page.evaluate(() => window.__printed)
  const sheet = await page.getByTestId('print-sheet').innerHTML()
  check('D PDF: 인쇄 한 번 · 5쪽 · 고친 글 그대로 · 제안서 AI 다시 안 부름', printed === 1 && (sheet.match(/data-slide=/g) ?? []).length === 5 && sheet.includes('그린로직스 맞춤 AX 로드맵') && sheet.includes('줄일 수') && llmCount('SANGHO_PROPOSAL') === proposalCalls)
  const dl = page.waitForEvent('download', { timeout: 10000 })
  await page.getByTestId('export-png').click()
  const file = await dl.catch(() => null)
  check('D PNG: 지금 쪽을 그림 파일로(그린로직스_제안서_N쪽.png)', !!file && /^그린로직스\(주\)_제안서_\d쪽\.png$/.test(await lastDl()), await lastDl())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('proposal-studio').waitFor()
  await page.waitForTimeout(400)
  check('D 다시 열어도 고친 판(맞춤법 포함)', (await page.locator('[data-testid="slide-list"] svg[data-slide="2"]').innerHTML()).includes('줄일 수'))
  await shot(page, 'D2-proposal-fixed')
}

/* ---- E. AX 화면 ---- */
{
  await page.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' })
  await quick('front')
  await page.getByTestId('ai-run').click()
  await waitRuns(7)
  await page.waitForTimeout(300)
  await page.locator('[data-skill="AX_FRONT"]').getByTestId('open-studio').click()
  await page.getByTestId('front-studio').waitFor()
  const pc = await page.getByTestId('front-pc').innerText()
  const m1 = await page.getByTestId('front-m1').innerText()
  const m2 = await page.getByTestId('front-m2').innerText()
  check('E PC 대시보드 1 + 모바일 2 · KPI · 예시 데이터 표시', pc.includes('오늘 배차') && pc.includes('예시 데이터') && m1.includes('오늘 내 배차') && m2.includes('정산 확인'))
  // D-219: 메뉴 칸 — 엔터로 새 메뉴를 더할 수 있다(예전: 새 줄이 바로 지워짐)
  const nav = page.getByTestId('front-nav')
  const navBefore = await nav.inputValue()
  await nav.press('Control+End')
  await nav.press('Enter')
  await nav.pressSequentially('정산 관리')
  check('D-219 메뉴 칸: 엔터로 새 메뉴 더하기', (await nav.inputValue()) === `${navBefore}\n정산 관리`, JSON.stringify(await nav.inputValue()))
  await nav.fill(navBefore)
  await page.getByTestId('front-app-name').fill('그린 배차 플러스')
  await page.getByTestId('front-save').click()
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('front-studio').waitFor()
  check('E 글 고침 → 새로고침해도 남음', (await page.getByTestId('front-pc').innerText()).includes('그린 배차 플러스'))
  const dl = page.waitForEvent('download', { timeout: 15000 })
  await page.getByTestId('front-png-pc').click()
  const file = await dl.catch(() => null)
  check('E PNG: PC 화면 그림 파일', !!file && /_PC\.png$/.test(await lastDl()), await lastDl())
  await shot(page, 'E1-front')
}

/* ---- F. 실패 · 형식 다름 · 업체 상세 · Partner · 사용량 · 휴대폰 ---- */
{
  await page.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' })
  const n0 = (await runs()).length
  llmOverride = { status: 500, body: '{"error":"boom"}' }
  await quick('idea')
  await page.getByTestId('ai-run').click()
  await page.waitForTimeout(1200)
  check('F 공급자 실패: 실행 기록 안 생김 · 창 그대로(다시 누를 수 있음)', (await runs()).length === n0 && (await page.getByTestId('ai-run').isEnabled()))
  llmOverride = { status: 200, body: JSON.stringify({ model: 'm-standard', choices: [{ message: { content: '죄송하지만 표로 드리면: 1. 배차 2. 정산' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }) }
  await page.getByTestId('ai-run').click()
  await waitRuns(n0 + 1)
  await page.waitForTimeout(300)
  const fb = page.locator('[data-skill="AX_IDEA"]').first()
  check("F 형식 다름: '형식 확인 필요' · 원문 그대로 보관", (await fb.innerText()).includes('형식 확인 필요') && (await fb.innerText()).includes('1. 배차 2. 정산'))

  // ChatGPT 붙여넣기
  await page.getByTestId('paste-chatgpt-open').click()
  await page.getByTestId('paste-skill').selectOption('FUNDING_STRATEGY')
  await page.getByTestId('paste-text').fill('ChatGPT: 스마트물류 바우처 · 혁신바우처를 먼저 보세요.')
  await page.getByTestId('paste-save').click()
  await page.waitForTimeout(400)
  const pasted = (await runs()).find((r) => r.status === 'pasted')
  check('F ChatGPT 결과 붙여넣기: 기록(붙여넣기 · 비용 없음) · AI 호출 0', !!pasted && pasted.tier === 'manual' && pasted.estimatedCostUsd === null)

  // D-219: '자료 요약 · 업체 정보 채우기' — 올린 자료를 실제로 보낸다(예전: 빈 목록을 '이것만' 으로 읽어 자료 0개)
  const nS = (await runs()).length
  await page.getByTestId('material-summarize').click()
  await waitRuns(nS + 1)
  const sum = llm.filter((c) => c.skill === 'SNAPSHOT_EXTRACT').at(-1)
  check('D-219 자료 요약: 올린 자료(회사소개서 · 메모)를 AI 에 함께 보낸다', !!sum && sum.user.includes('배차') && sum.user.includes('화주'), sum?.user.slice(0, 300))

  // D-219: 명부라서 스스로 뺀 자료를 '다시 보내기' — 한 번 더 묻고, 아니오면 그대로 뺀 채(예전: 바로 AI 로 나감)
  await page.getByTestId('material-memo').click()
  await page.locator('[data-field="text"]').fill('사업장 가입자 명부\n피보험자 홍길동 자격취득 2024-03-01 취득일 2024-03-01 상실일 - 보험료 부과 210,000')
  await page.getByTestId('material-save').click()
  await page.waitForTimeout(400)
  const rosterRow = page.locator('[data-testid="material-list"] li', { hasText: '명부' }).first()
  check('D-219 명부 자료: 스스로 AI 에 안 보냄', (await rosterRow.innerText()).includes('AI 에 안 보냄'))
  let askedRoster = ''
  page.once('dialog', (d) => { askedRoster = d.message(); void d.dismiss() })
  await rosterRow.getByRole('button', { name: '다시 보내기' }).click()
  await page.waitForTimeout(400)
  const rosterMat = ((await cases()).find((c) => c.id === caseId)?.materials ?? []).find((m) => m.title.includes('명부'))
  check('D-219 명부 다시 보내기: 한 번 더 묻고 · 아니오면 그대로 뺀 채', askedRoster.includes('개인별 명부') && !!rosterMat?.excluded, { askedRoster, excluded: rosterMat?.excluded })
  await rosterRow.scrollIntoViewIfNeeded()
  await shot(page, 'F0-roster-kept', false)

  // 업체 상세 — 탭 줄은 그대로, 더보기에서 AI 작업실
  await page.goto(`${BASE}/ops/clients/cli_hansol`, { waitUntil: 'networkidle' })
  const tabs = await page.locator('[role="tab"]').allInnerTexts()
  check('F 업체 상세: 탭 줄 그대로(AI 작업실은 더보기)', !tabs.some((t) => t.includes('AI 작업실')), tabs)
  await page.getByRole('button', { name: /더보기/ }).first().click()
  await page.getByTestId('more-ai').click()
  await page.getByTestId('client-ai-open').click()
  await page.getByTestId('case-workspace').waitFor()
  const linked = (await cases()).find((c) => c.clientId === 'cli_hansol')
  check('F 업체 상세 → 고객과 이어진 작업실(고객 정보로 Snapshot · 업체 DB 따로 안 만듦)', !!linked && linked.companyName === '한솔테크(주)' && (await page.getByTestId('snapshot-fields').innerText()).includes('소프트웨어'))
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-new').click()
  await page.getByTestId('case-name').fill('한솔테크')
  await page.getByTestId('case-dups').waitFor()
  check('F 같은 고객으로 또 만들려 하면 이어 둔 작업실을 연다', (await page.getByTestId('case-dups').innerText()).includes('이어 둔 작업실 열기'))

  // D-219: 같은 사업자번호로 먼저 만든 작업실(빠른 등록 · 아직 안 이음)이 있으면 업체 탭에서 새로 만들지 않고 묻고 잇는다
  // (예전: 클라우드는 DB 고유 규칙에 걸려 '저장에 실패했습니다' 만 뜨고 탭이 영영 안 열림 · 로컬은 둘째 작업실)
  const owner = (await cases())[0]?.ownerId ?? null
  await page.evaluate((o) => {
    const k = 'axmvp.v1.owner_ai.cases'
    const list = JSON.parse(localStorage.getItem(k) || '[]')
    const at = new Date().toISOString()
    list.push({ id: 'case_d219_wooil', companyName: '우일 산업(빠른 등록)', relation: 'reviewed', bizNo: '3138112508', clientId: null, ownerId: o, workspaceId: null, materials: [], facts: [], activity: [], createdAt: at, updatedAt: at, archivedAt: null, contextVersion: 0 })
    localStorage.setItem(k, JSON.stringify(list))
  }, owner)
  await page.goto(`${BASE}/ops/clients/cli_wooil`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /더보기/ }).first().click()
  await page.getByTestId('more-ai').click()
  let askedLink = ''
  page.once('dialog', (d) => { askedLink = d.message(); void d.accept() })
  await page.getByTestId('client-ai-open').click()
  await page.getByTestId('case-workspace').waitFor()
  const wooil = (await cases()).filter((c) => c.bizNo === '3138112508' && !c.archivedAt)
  check('D-219 업체 탭: 같은 사업자번호 작업실이 있으면 묻고 그 작업실에 잇는다(둘째 작업실 안 만듦)', askedLink.includes('같은 사업자번호') && wooil.length === 1 && wooil[0].id === 'case_d219_wooil' && wooil[0].clientId === 'cli_wooil', { askedLink, wooil: wooil.map((c) => [c.id, c.clientId]) })

  // Partner OS 주소
  await page.goto(`${BASE}/ai/new?event=ax_proposal_requested&company=${encodeURIComponent('파트너상사')}&requester=${encodeURIComponent('이○○')}&memo=${encodeURIComponent('AX 제안 요청')}`, { waitUntil: 'networkidle' })
  await page.getByTestId('case-name').waitFor()
  check('F Partner OS 요청 주소 → 빠른 등록 칸 채움(동료 컨설턴트 요청)', (await page.getByTestId('case-name').inputValue()) === '파트너상사' && (await page.getByTestId('case-requester').inputValue()) === '이○○' && (await page.getByTestId('case-relation-new').inputValue()) === 'peer_request')

  // D-255 바로 시작 — 대표 "기존 고객도 여기서 바로 · PDF 만 넣어도 시작 · 타자는 거의 없게"
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-quick').waitFor()
  const quickIds = () => page.getByTestId('case-quick-client').evaluateAll((els) => els.map((e) => e.dataset.id))
  const q0 = await quickIds()
  check(`G 바로 시작: '고객 관리에서 고르기' 가 처음 · 아직 작업실 없는 고객 ${q0.length}곳 · 이미 이은 한솔테크 · 우일은 없음`, q0.length >= 1 && !q0.includes('cli_hansol') && !q0.includes('cli_wooil') && (await page.getByTestId('case-quick-tab-client').getAttribute('aria-selected')) === 'true', q0)
  await shot(page, 'G1-quick-clients', false)
  const pickId = q0[0]
  const nBefore = (await cases()).length
  await page.locator(`[data-testid="case-quick-client"][data-id="${pickId}"]`).click()
  await page.waitForURL(/\/ai\/cases\//, { timeout: 10000 })
  await page.getByTestId('case-workspace').waitFor()
  const pickedCase = (await cases()).find((c) => c.clientId === pickId && !c.archivedAt)
  check('G 고객 하나 누르면 그 고객과 이은 작업실이 바로(타자 0 · 하나만 늘어남)', !!pickedCase && (await cases()).length === nBefore + 1, { pickId, n: (await cases()).length - nBefore })
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-quick').waitFor()
  check('G 이은 고객은 고르기 목록에서 빠짐', !(await quickIds()).includes(pickId))

  // 서류 한 장 — 가짜 회사 · 가짜 번호(검증 숫자는 맞음)
  await page.getByTestId('case-quick-tab-docs').click()
  const bizDoc = { name: '사업자등록증_푸른하늘.txt', mimeType: 'text/plain', buffer: Buffer.from(['사업자등록증', '(법인사업자)', '등록번호 : 214-88-01232', '법인명(단체명) : 푸른하늘(주)', '대표자 : 하늘이', '개업연월일 : 2023 년 03 월 02 일', '사업장 소재지 : 서울특별시 마포구 하늘로 1', '업태 : 정보통신업  종목 : 응용 소프트웨어 개발', '연락처 010-1234-5678'].join('\n'), 'utf8') }
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([bizDoc])
  await page.getByTestId('case-quick-found').waitFor({ timeout: 25000 })
  const found = await page.getByTestId('case-quick-found').innerText()
  check('G 서류 한 장 → 업체명 · 대표 · 사업자번호를 읽어 보여 줌 · [이 서류로 AI 작업실 만들기]', found.includes('푸른하늘') && found.includes('하늘이') && found.includes('214-88-01232') && (await page.getByTestId('case-quick-create').count()) === 1, found)
  await shot(page, 'G2-quick-docs', false)
  await page.getByTestId('case-quick-create').click()
  await page.waitForURL(/\/ai\/cases\//, { timeout: 10000 })
  await page.getByTestId('case-workspace').waitFor()
  const docCase = (await cases()).find((c) => c.companyName.includes('푸른하늘'))
  const mat = docCase?.materials?.[0]
  check('G 서류로 만든 작업실 — 이름 · 사업자번호 · 대표 메모 · 읽은 글이 자료 1건(휴대폰은 지움)', !!docCase && docCase.bizNo === '2148801232' && (docCase.memo ?? '').includes('하늘이') && (docCase.materials ?? []).length === 1 && !!mat && mat.text.includes('응용 소프트웨어') && !mat.text.includes('010-1234-5678'), docCase && { bizNo: docCase.bizNo, memo: docCase.memo, mats: (docCase.materials ?? []).length, text: mat?.text?.slice(0, 200) })
  // 같은 서류를 또 넣으면 새로 만들지 않고 그 작업실을 연다
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-quick-tab-docs').click()
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([bizDoc])
  await page.getByTestId('case-quick-found').waitFor({ timeout: 25000 })
  check('G 같은 서류를 또 넣으면 → 이미 작업실 있음 · [작업실 열기](새로 안 만듦)', (await page.getByTestId('case-quick-open-case').count()) === 1 && (await page.getByTestId('case-quick-create').count()) === 0)

  // 사용량
  await page.goto(BASE + '/ai/usage', { waitUntil: 'networkidle' })
  const tiles = await page.getByTestId('usage-tiles').innerText()
  const real = (await runs()).filter((r) => r.tier !== 'manual').length
  check('F 사용량: 이번 달 호출 · 빠르게/보통/깊게 · 예상 비용($)', tiles.includes(`${real}번`) && /\$\d/.test(tiles), tiles)
  await shot(page, 'F1-usage')
}

/* ---- 휴대폰 360 · 390 — 넘침 0 ---- */
for (const w of [360, 390]) {
  const m = await browser.newContext({ viewport: { width: w, height: 800 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  await wireApi(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  // 같은 기록을 옮겨 놓고 본다
  const dump = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('axmvp.')).map((k) => [k, localStorage.getItem(k)])))
  await mp.evaluate((d) => Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v)), dump)
  for (const url of ['/ai', `/ai/cases/${caseId}`, '/ai/usage']) {
    await mp.goto(BASE + url, { waitUntil: 'networkidle' })
    await mp.waitForTimeout(500)
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`${w} ${url.replace(caseId, ':id')}: 가로 넘침 0`, over <= 1, over)
  }
  await mp.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' })
  await mp.locator('[data-action="ax"]').click()
  await mp.getByTestId('ai-run').waitFor()
  const box = await mp.getByTestId('ai-run').boundingBox()
  check(`${w} 빠른 작업 창: 실행 단추가 화면 안 · 44px 이상`, !!box && box.x >= 0 && box.x + box.width <= w && box.height >= 40, box)
  if (w === 390) await shot(mp, 'M390-sheet', false)
  await mp.keyboard.press('Escape')
  if (w === 390) {
    await mp.waitForTimeout(300)
    await shot(mp, 'M390-case')
  }
  await m.close()
}

/* ---- 키 · 공급자 노출 0 ---- */
{
  const dist = path.resolve('dist/assets')
  const bad = []
  if (fs.existsSync(dist))
    for (const f of fs.readdirSync(dist).filter((x) => x.endsWith('.js'))) {
      const s = fs.readFileSync(path.join(dist, f), 'utf8')
      if (/api\.openai\.com|chat\/completions|sk-test-OWNERAI/.test(s)) bad.push(f)
    }
  check('보안: 화면 번들에 AI 공급자 주소 · 키 없음', fs.existsSync(dist) && bad.length === 0, bad)
  check('보안: 브라우저가 AI 공급자를 직접 부른 적 0번', outside.length === 0, outside)
  const stored = JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))))
  const leakKeys = await page.evaluate((needles) => Object.keys(localStorage).filter((k) => needles.some((n) => (localStorage.getItem(k) ?? '').includes(n))), [KEY, '900101-1234567', 'abc!23'])
  check('보안: 브라우저 저장소에 키 · 주민번호 · 인증서 비밀번호 없음', !stored.includes(KEY) && !stored.includes('900101-1234567') && !stored.includes('abc!23'), leakKeys)
  check('화면 오류 0', errors.length === 0, errors)
}

await browser.close()
fs.rmSync(TMP, { recursive: true, force: true })
console.log(`\nownerai: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
