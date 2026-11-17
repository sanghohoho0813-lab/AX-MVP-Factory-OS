/**
 * qa:ownerai — 대표 AI 전략실 V1 (Company Case Intelligence) 끝까지 이어 보기.
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
 *   F  실패 · 형식 다름(원문 보관) · 업체 상세 'AI 전략실'(더보기 · 탭 줄 그대로) · Partner 주소 · 사용량 · 360/390 넘침 0 · 키 노출 0
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
  // D-272 기준 문서대로 — 판정 · 가장 큰 문제 · 16단계 · 돈 KPI 3 · 12주 · 반론 질문
  verdict: 'LITE',
  primaryConstraint: '배차를 전화 · 엑셀로 해 오후마다 2~3시간이 묶임',
  thinking: Array.from({ length: 16 }, (_, i) => ({ step: i + 1, title: `단계 ${i + 1}`, finding: '확인함' })),
  kpis: { cost: '배차 1건 처리 시간 — 측정 필요', revenue: '견적 → 계약 전환율 — 측정 필요', scale: '배차 담당 1인당 월 처리 건수 — 측정 필요' },
  prove12w: '배차 담당이 추천 화면으로 배차한 건수와 처리 시간을 0주 기준선과 비교',
  challenges: [{ q: '실제 누가 반복적으로 사용합니까?', answer: '배차 담당 2명(매일)', risk: 'P1' }],
  buildNow: ['배차 추천 화면'],
  prepareNow: ['주문 · 배차 엑셀 3개월 정리'],
  validateLater: ['기사 앱'],
  recommended: {
    title: '배차 자동 추천 + 운임 정산 한 화면',
    why: '하루 배차 40건을 엑셀과 전화로 맞추고 있어 가장 시간이 큼',
    before: '엑셀 · 전화로 배차, 월말 정산 수작업',
    after: '주문이 들어오면 차량 · 기사 추천, 정산표 자동',
    coreFeatures: ['배차 추천', '운임 정산표', '기사 앱 확인'],
    dataNeeded: ['주문 · 배차 엑셀 3개월'],
    difficulty: '중간',
    mvpScope: '배차 추천 + 정산표(기사 앱은 다음)',
    method: 'RULE — 거리 · 차량 조건 규칙으로 충분(학습 모델은 데이터가 쌓인 뒤)',
    processFirst: '배차 요청 양식을 하나로 표준화',
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
  // D-625 제안서 형식 'AX 퀵진단 4장' — 기준 문서(4장 틀)를 받았을 때만 이 답
  SANGHO_PROPOSAL_QUICK4: {
    purpose: '그린로직스 AX 퀵진단',
    audience: '그린로직스 대표',
    pageCount: 4,
    pages: [
      { no: 1, title: '그린로직스의 본업과 성장 병목', message: '배차 · 정산이 하루를 잡아먹습니다', bullets: ['중소 화주 물류 · 운임 매출', '문제 가설 TOP3 — 배차 · 정산 · 문의 전화'], keyNumbers: [], visual: '업무 5단계 흐름' },
      { no: 2, title: '당일 배차 변경 → 공차 운행', message: '우리는 주문 · 차량 조건을 규칙으로 판정해 배차를 바꾸고, 공차율로 효과를 측정합니다', bullets: ['현장 입력 → 판정 → 추천 → 배차 담당 승인', '효과는 측정 방법만(기준값 수집 먼저)'], keyNumbers: [], visual: '좌: 지금 · 중: 판정 · 우: 측정 방법' },
      { no: 3, title: '유사 사례 · 자금 연계', message: '사례 · 금액은 확인 불가 — 확인 뒤 채움', bullets: ['기관마다 심사 목적이 다름', '벤처 체크 4칸 — 모두 미검증'], keyNumbers: [], visual: '벤처 체크 4칸' },
      { no: 4, title: '예상 AX 화면(콘셉트 시안 — 개발 전)', message: 'PC 배차 판단 한 흐름 + 모바일 현장 확인', bullets: ['입력값 → 추천 결과 → 담당 승인'], keyNumbers: [], visual: 'PC 65% + 모바일 35%' },
    ],
    unknowns: ['현재는 정밀 현장진단 먼저', '월 배차 건수 · 공차율 기준값'],
  },
  AX_FRONT: {
    appName: '그린 배차',
    userType: '배차 담당 · 대표',
    oneLine: '배차 · 정산을 한 화면에서',
    basedOn: 'MVP 구체화 — 배차 추천 + 운임 정산표',
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
    llm.push({ skill, model: body.model, system: String(body.messages?.[0]?.content ?? ''), user: String(body.messages?.[1]?.content ?? ''), auth: h.Authorization })
    if (llmOverride) {
      const o = llmOverride
      llmOverride = null
      return new Response(o.body, { status: o.status })
    }
    const quick4 = skill === 'SANGHO_PROPOSAL' && sys.includes('[기준 문서] 아래 기준대로') && sys.includes('PAGE 2')
    const content = JSON.stringify(quick4 ? FIX.SANGHO_PROPOSAL_QUICK4 : FIX[skill] ?? SKILLS[skill]?.example ?? {})
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
  check('메뉴: 사이드바에 AI 전략실(대표 전용)', (await page.locator('nav a[href="/ai"]').count()) > 0)
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
  // D-282 오른쪽 칸이 기억 · 자료 · 기록 탭 — 자료 탭을 연다
  await page.locator('[data-side-tab="materials"]').click()
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
  check('A 결과 카드(D-272 기준 문서대로): 판정 "작게 시작" · 가장 큰 문제 · 12주 · 가장 추천(방법 · AI 전에 먼저) · 차선 · 돈 KPI 3 · 16단계 · 반론 질문 · 지금 만들 것', runText.includes('작게 시작') && runText.includes('가장 큰 문제') && runText.includes('12주에 증명할 것') && runText.includes('가장 추천') && runText.includes('배차 자동 추천') && runText.includes('AI 전에 먼저') && runText.includes('차선 1') && runText.includes('돈 KPI 3') && runText.includes('16단계로 본 것') && runText.includes('반론 질문') && runText.includes('지금 만들 것'), runText.slice(0, 300))
  check('A AX 분석 지시에 기준 문서(적합성 판정 · 반론 질문)가 같이 감 · 출처 이름 없음', !!axCall && axCall.system.includes('[기준 문서]') && axCall.system.includes('INSUFFICIENT_DATA') && axCall.system.includes('실제 누가 반복적으로 사용합니까') && !/펭귄|PENGUIN/i.test(axCall.system))
  await shot(page, 'A2-ax-result')
  // D-624 결과는 작업마다 한 줄 — 새 결과가 나오면 그 줄이 펼쳐져 그 결과가 보인다
  {
    const groups = await page.getByTestId('run-group').evaluateAll((els) => els.map((e) => [e.dataset.group, e.dataset.open]))
    check('D624 A 결과 = 작업 줄 하나(AX 전략 분석) · 새 결과라 펼쳐짐 · 상태 "검토 전"', JSON.stringify(groups) === '[["AX_PENGUIN","1"]]' && (await page.getByTestId('run-group-status').first().innerText()) === '검토 전', groups)
  }

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
  // D-624 두 번째 작업 — 줄이 둘 · 새 결과(동료 문구)만 펼침 · AX 줄은 접힌 채 결과 첫 줄이 보임 · 한 번에 한 줄만 펼침
  {
    const groups = await page.getByTestId('run-group').evaluateAll((els) => els.map((e) => [e.dataset.group, e.dataset.open]))
    const axLine = await page.locator('[data-group="AX_PENGUIN"] [data-testid="run-group-line"]').innerText().catch(() => '')
    check('D624 B 줄 순서는 작업 순서(AX 전략 분석 → 동료 전달문구) — 새것이 위로 올라오지 않음 · 동료 문구만 펼침 · AX 줄에 결과 첫 줄(일부 채택이면 고른 추천)', JSON.stringify(groups) === '[["AX_PENGUIN","0"],["CONSULTANT_MESSAGE","1"]]' && axLine.startsWith('배차 자동 추천 + 운임 정산 한 화면 — '), { groups, axLine })
    check('D624 C 펼친 결과만 그려짐(결과 본문 1개)', (await page.locator('[data-run]').count()) === 1)
    await page.locator('[data-group="AX_PENGUIN"] [data-testid="run-group-toggle"]').click()
    const after = await page.getByTestId('run-group').evaluateAll((els) => els.map((e) => [e.dataset.group, e.dataset.open]))
    check('D624 D AX 줄을 누르면 AX 결과가 펼쳐지고 동료 문구는 접힘', JSON.stringify(after) === '[["AX_PENGUIN","1"],["CONSULTANT_MESSAGE","0"]]' && (await page.locator('[data-run]').getAttribute('data-skill')) === 'AX_PENGUIN', after)
    // 작업 목록 줄에도 같은 상태 말
    const axStatus = await page.locator('[data-action="ax"] [data-testid="quick-action-status"]').innerText().catch(() => '')
    const msgStatus = await page.locator('[data-action="message"] [data-testid="quick-action-status"]').innerText().catch(() => '')
    check("D624 E '다른 작업' 줄에 결과 상태 — AX 전략 분석 '일부 채택' · 동료 전달문구 '검토 전' · 결과 없는 작업은 없음", axStatus === '일부 채택' && msgStatus === '검토 전' && (await page.locator('[data-action="idea"] [data-testid="quick-action-status"]').count()) === 0, { axStatus, msgStatus })
    // 아이콘 색은 하나 · 모양은 작업마다
    const icons = await page.locator('[data-testid="quick-actions"] [data-action]').evaluateAll((btns) =>
      btns.map((b) => {
        const svg = b.querySelector('svg')
        return { color: svg ? getComputedStyle(svg).color : '', shape: svg ? (svg.getAttribute('class') ?? '').split(' ').find((c) => c.startsWith('lucide-') && c !== 'lucide') ?? '' : '' }
      }),
    )
    check('D624 F 작업 10줄 — 아이콘 색 하나 · 모양 10가지 · 번호 1~10', new Set(icons.map((i) => i.color)).size === 1 && new Set(icons.map((i) => i.shape)).size === 10 && JSON.stringify(await page.locator('[data-testid="quick-actions"] [data-action] > span:first-child').allInnerTexts()) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']), icons)
    const tiles = await page.locator('[data-testid="case-purpose"] > span:first-child').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor + '|' + getComputedStyle(e).color))
    check('D624 G 목적 단추 그림 색도 하나', tiles.length >= 3 && new Set(tiles).size === 1, tiles)
    await shot(page, 'A3-run-list')
  }
}

/* ---- B. 며칠 뒤 다시 열기 ---- */
{
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('case-workspace').waitFor()
  const mem = await page.getByTestId('memory-fields').innerText()
  check('B 다시 열기: 기억(AX 방향) · 결과 2개 · 타임라인 그대로', mem.includes('배차 자동 추천') && (await page.getByTestId('run-group').count()) === 2 && (await page.getByTestId('case-timeline').locator('li').count()) >= 6)
  await quick('patent')
  await page.getByTestId('ai-run').click()
  await waitRuns(3)
  await page.waitForTimeout(300)
  const pCard = page.locator('[data-skill="PATENT_IDEA"]')
  check('B 특허: 경고 문구(선행기술조사 · 변리사 검토) 보임', (await pCard.innerText()).includes('변리사 검토가 필요합니다'))
  const pCall = llm.filter((c) => c.skill === 'PATENT_IDEA').pop()
  check('D624 H 특허 아이디어 — 특허 · 벤처 메뉴와 같은 기준 문서(5개 고정 질문 · 권리화 포인트)가 같이 감 · D-625 판 3 + 정합성 규칙(부록 G)', !!pCall && pCall.system.includes('[기준 문서]') && pCall.system.includes('5개 고정 질문') && pCall.system.includes('권리화 포인트') && pCall.system.includes('# 부록 G.') && pCall.system.includes('독립항의 주요 구성') && (await runs()).find((r) => r.skillId === 'PATENT_IDEA')?.skillVersion === 3)
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
  const vSys = llm.filter((c) => c.skill === 'VENTURE_PLAN').pop()?.system ?? ''
  check('D624 I 벤처 사업계획 — 벤처 사업계획서 기준 문서(근거 없는 숫자 금지)가 같이 감 · 칸은 9칸 그대로', vSys.includes('[기준 문서]') && vSys.includes('근거 없이 생성하지 않는다') && vSys.includes('basic 회사 기본정보'))
  check('D625 V 벤처 사업계획 — AX 기준의 공식 평가기준 연결(부록 C) · 증거 게이트(부록 E) · 공식 항목별 근거(criteria)도 같이 감', vSys.includes('# 부록 C.') && vSys.includes('# 부록 E.') && vSys.includes('criteria') && !vSys.includes('http'))
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
  check('D625 P1 제안서 창 — 형식(일반 제안서 · AX 퀵진단 4장) · 처음엔 일반 + 페이지 수', (await page.getByTestId('choice-kind').count()) === 1 && (await page.locator('[data-testid="choice-kind"] [data-value="general"]').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('choice-pages').count()) === 1)
  await page.getByTestId('ai-run').click()
  await waitRuns(5)
  await page.waitForTimeout(300)
  const gCall = llm.filter((c) => c.skill === 'SANGHO_PROPOSAL').pop()
  check('D625 P2 일반 제안서 — 퀵진단 기준은 안 감 · 보낸 값 kind: general · pages: 5', !!gCall && !gCall.system.includes('PAGE 2') && !gCall.system.includes('[기준 문서] 아래 기준대로') && gCall.user.includes('kind: general') && gCall.user.includes('pages: 5'))
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
  { const l289 = page.getByTestId('proofread'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
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
  {
    const fSys = llm.filter((c) => c.skill === 'AX_FRONT').pop()?.system ?? ''
    check('D624 J 화면 기획 — 채택한 AX · MVP 를 화면으로 옮기라는 지시 · AX 기준 문서 · 바탕(basedOn) 칸', fSys.includes('[대표가 채택한 결과]') && fSys.includes('[기준 문서]') && fSys.includes('basedOn'))
    const fText = await page.locator('[data-skill="AX_FRONT"]').getByTestId('run-text').innerText()
    check('D624 K 화면 기획 결과 글 맨 위에 "바탕: MVP 구체화 …"', fText.includes('바탕: MVP 구체화 — 배차 추천 + 운임 정산표'), fText.slice(0, 200))
  }
  await page.locator('[data-skill="AX_FRONT"]').getByTestId('open-studio').click()
  await page.getByTestId('front-studio').waitFor()
  check('D624 L 화면 스튜디오에 "바탕: …" 한 줄', (await page.getByTestId('front-based-on').innerText().catch(() => '')).includes('MVP 구체화'))
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

/* ---- D-625 제안서 형식 'AX 퀵진단 4장' — 기준 문서 4장 틀 → 스튜디오 4쪽 ---- */
{
  await page.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' })
  await page.getByTestId('case-workspace').waitFor()
  const n0 = (await runs()).length
  await quick('proposal', async () => {
    await page.locator('[data-testid="choice-kind"] [data-value="quick4"]').click()
  })
  await page.mouse.move(5, 5)
  await page.waitForTimeout(250)
  const kindLook = await page.locator('[data-testid="choice-kind"] button').evaluateAll((els) => els.map((e) => [e.dataset.value, e.getAttribute('aria-pressed'), getComputedStyle(e).backgroundColor, getComputedStyle(e).borderColor]))
  check('D625 Q1 퀵진단 4장을 고르면 페이지 수 고르기가 사라짐 · 눌린 모양은 퀵진단 4장(일반 제안서와 바탕 · 테두리 다름)', (await page.getByTestId('choice-pages').count()) === 0 && kindLook.length === 2 && kindLook[1][1] === 'true' && kindLook[0][1] === 'false' && (kindLook[1][2] !== kindLook[0][2] || kindLook[1][3] !== kindLook[0][3]), kindLook)
  await shot(page, 'D625-quick4-sheet', false)
  // 휴대폰 390 — 형식 두 칩이 한 줄 · 옆 넘침 0
  const vp = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const chipTops = await page.locator('[data-testid="choice-kind"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  check('D625 Q1b 휴대폰 390 — 형식 칩 두 개 한 줄 · 옆 넘침 0', over <= 0 && chipTops.length === 2 && chipTops[0] === chipTops[1], { over, chipTops })
  await shot(page, 'D625-quick4-sheet-390', false)
  await page.setViewportSize(vp)
  await page.waitForTimeout(200)
  await page.getByTestId('ai-run').click()
  await waitRuns(n0 + 1)
  await page.waitForTimeout(300)
  const qCall = llm.filter((c) => c.skill === 'SANGHO_PROPOSAL').pop()
  check(
    'D625 Q2 서버에 간 것 — 퀵진단 4장 기준(PAGE 1~4 · 통과 문장 · 자체 검수) · 출력 형식 앞 · 보낸 값 kind: quick4 · 페이지 수 없음 · 다른 고객사 · 내부 명령 이름 · 주소 0',
    !!qCall && ['PAGE 1', 'PAGE 4', '통과 문장 형식', '퀵진단 자체 검수'].every((x) => qCall.system.includes(x)) && qCall.system.lastIndexOf('[기준 문서] 아래 기준대로') < qCall.system.lastIndexOf('[출력 형식]') &&
      qCall.user.includes('kind: quick4') && !qCall.user.includes('pages:') && !/\uD3AD\uADC4|\uD558\uB098\uC815\uBCF4|\x4B\x50\x4A\x4B|https?:/.test(qCall.system),
  )
  const qRun = (await runs()).filter((r) => r.skillId === 'SANGHO_PROPOSAL').at(-1)
  check('D625 Q3 결과 — 제안서 판 2 · 4장(회사 이해 → 손실 사건 → 사례 · 자금 → 예상 화면) · 확인할 것 맨 앞 "정밀 현장진단 먼저"', qRun?.skillVersion === 2 && qRun?.structured?.pages?.length === 4 && (qRun?.rendered ?? '').includes('콘셉트 시안') && (qRun?.rendered ?? '').includes('현재는 정밀 현장진단 먼저'))
  await page.locator('[data-skill="SANGHO_PROPOSAL"]').first().getByTestId('open-studio').click()
  await page.getByTestId('proposal-studio').waitFor()
  await page.waitForTimeout(500)
  check('D625 Q4 제안서 스튜디오 — 4쪽 · 글자는 SVG text', (await page.locator('[data-testid="slide-list"] svg[data-slide]').count()) === 4 && (await page.locator('svg[data-slide] text').count()) > 12)
  await shot(page, 'D625-quick4-studio')
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
  await page.locator('[data-side-tab="materials"]').click()
  { const l289 = page.getByTestId('material-summarize'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
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

  // 업체 상세 — 탭 줄은 그대로, 더보기에서 AI 전략실
  await page.goto(`${BASE}/ops/clients/cli_hansol`, { waitUntil: 'networkidle' })
  const tabs = await page.locator('[role="tab"]').allInnerTexts()
  check('F 업체 상세: 탭 줄 그대로(AI 전략실은 더보기)', !tabs.some((t) => t.includes('AI 전략실')), tabs)
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
  check('G 서류 한 장 → 업체명 · 대표 · 사업자번호를 읽어 보여 줌 · [이 서류로 AI 전략실 만들기]', found.includes('푸른하늘') && found.includes('하늘이') && found.includes('214-88-01232') && (await page.getByTestId('case-quick-create').count()) === 1, found)
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

/* ---- D-626 기획 대화 — 이어서 묻기 · 리서치 · 자체점검 · 기획서 판 · 개발 프롬프트 ---- */
{
  FIX.PLAN_TALK = { title: '배차 병목 좁히기', answer: '결론: 배차 지연이 가장 큰 손실입니다.\n- 하루 3건이 늦게 나갑니다\n- 정산 오류가 뒤따릅니다', questions: ['늦은 배차 한 건의 손실 — 배차 담당에게'], next: ['병목 하나로 좁혀 줘', '지표부터 정하자'], keep: ['가장 큰 병목은 배차 지연'] }
  FIX.PLAN_RESEARCH = { answer: '물류 배차 자동화 사례는 있으나 이 규모의 수치는 확인하지 못했습니다.', findings: [{ claim: '화물 배차 시장은 주선 수수료 구조다', source: '국토교통부 통계(2025)', grade: 'A', kind: '시장 사실', note: '수수료 절감이 지표 후보' }], unknowns: ['동종 규모 회사의 도입 전후 수치'], next: ['옆 업종 사례도 찾아 줘'], keep: ['시장은 주선 수수료 구조'] }
  FIX.PLAN_JUDGE = { verdict: 'FIX', oneLine: '지표의 지금 값이 없어 효과를 증명할 수 없다', score: 58, scoreWhy: '증명 계획 0점', attacks: [{ role: '의심 많은 사장', point: '배차 추천을 기사가 안 따를 수 있다', why: '현장이 안 쓰면 효과 0', fix: '첫 2주는 추천만 보여 주고 따른 비율을 잰다', level: 'P0' }], five: [{ q: '실제 누가 반복해서 쓰는가', a: '배차 담당 2명', state: '답함' }], mustFix: ['지표의 지금 값을 첫 2주에 잰다'], stop: ['추천을 따른 비율'], next: ['고친 내용으로 판 다시 굳혀 줘'], keep: [] }
  FIX.PLAN_LOCK = { title: '그린 배차 AX', verdict: '진행 — 본업 손실이 분명하다', constraint: '배차 지연', coreValues: ['늦은 배차 줄이기', '정산 오류 줄이기', '기사 대기 줄이기'], moneyKpis: [{ name: '늦은 배차 건수', baseline: '미확인(첫 2주에 잰다)', target: '절반', how: '배차 기록' }], conversion: '화주가 주문을 앱으로 넣는다', process: { before: '전화로 배차', after: '추천 보고 한 번에 배차' }, job: '오늘 물량을 제때 내보내기', dataAsset: '배차 · 지연 기록', eventMap: ['주문 접수 → 배차 추천'], aiMethods: [{ job: '배차 추천', method: '규칙', why: '거리 · 납기 규칙으로 충분' }], proofPlan: ['2주 전후 지연 건수 비교'], readiness: '화주 화면은 주문 조회만', expansion: ['정산 자동화'], moat: '배차 기록', risks: ['기사가 추천을 안 따름'], notBuilding: ['기사 앱 — 이번엔 문자로'], open: ['늦은 배차 한 건의 손실 — 배차 담당에게'], changed: [], ready: '미정을 채운 뒤 — 지표 값이 없다' }
  FIX.DEV_PROMPT = { repoName: 'green-dispatch-ax', firstMessage: '저장소 green-dispatch-ax 를 만들고 전략 잠금부터 읽어 줘.', prompt: '# green-dispatch-ax\n\n## 전략 잠금\n- 병목: 배차 지연\n\n## 안 만드는 것\n- 기사 앱', assets: ['ax_cover_main.jpg — 첫 화면'], checks: ['지표의 지금 값을 채웠는지'], missing: ['늦은 배차 한 건의 손실'] }

  const talkRuns = async () => (await runs()).filter((r) => ['PLAN_TALK', 'PLAN_RESEARCH', 'PLAN_JUDGE', 'PLAN_LOCK', 'DEV_PROMPT'].includes(r.skillId))
  const waitTalk = async (n, ms = 15000) => {
    const t = Date.now()
    while (Date.now() - t < ms) {
      if ((await talkRuns()).length >= n) return true
      await page.waitForTimeout(150)
    }
    return false
  }
  const say = async (mode, text) => {
    await page.getByTestId(`talk-mode-${mode}`).click()
    if (text) await page.getByTestId('talk-input').fill(text)
    await page.getByTestId('talk-send').click()
  }
  const resultRowsBefore = await page.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' }).then(() => page.locator('[data-testid="run-row"], [data-testid="result-row"]').count())
  const open = page.getByTestId('case-talk-open').first()
  check('D626 T1 업체 작업실 머리에 [기획 대화] 단추', (await open.count()) > 0 && (await open.innerText()).includes('기획 대화'))
  await open.click()
  await page.getByTestId('talk-hero').waitFor()
  check('D626 T2 첫 화면 — 질문칸 하나 · 순서 한 줄(1 → 2 → 3) · 시작 예시', page.url().endsWith('/talk') && (await page.getByTestId('talk-steps').innerText()).includes('자체점검') && (await page.getByTestId('talk-starter').count()) === 3 && (await page.getByTestId('talk-threads').count()) === 0)
  await shot(page, 'T1-talk-hero', false)
  await page.getByTestId('talk-starter').first().click()
  check('D626 T3 시작 예시를 누르면 질문칸에 들어감(바로 보내지 않음)', (await page.getByTestId('talk-input').inputValue()).length > 10 && (await talkRuns()).length === 0)

  // 1) 이어서 묻기 — 첫 물음
  const llm0 = llm.length
  await say('talk', '이 회사에서 돈이 가장 많이 새는 곳이 어디야')
  check('D626 T4 첫 물음 → 답 카드(답 · 정해야 할 것 · 정해진 것 · 이어 물을 말)', (await waitTalk(1)) && (await page.getByTestId('talk-answer').first().innerText()).includes('배차 지연') && (await page.getByTestId('talk-questions').count()) === 1 && (await page.getByTestId('talk-next-chip').count()) === 2)
  const c1 = llm.at(-1)
  check('D626 T5 서버 — 기획 대화 스킬 · 전략 잠금 기준 문서 · 첫 물음엔 앞 대화 없음', llm.length === llm0 + 1 && c1.skill === 'PLAN_TALK' && c1.system.includes('[기준 문서] 아래 기준대로') && c1.system.includes('HYBRID STRATEGY LOCK') && !c1.user.includes('[지금까지의 대화'))
  const r1 = (await talkRuns())[0]
  check('D626 T6 대화 한 번 = 실행 한 줄(대화 번호 · 갈래 저장 · 앞 대화는 저장 입력에 안 넣음)', /^th_[a-z0-9]{6,24}$/.test(String(r1.input?.options?.thread)) && r1.input.options.field === 'ax' && !('history' in r1.input) && r1.status === 'succeeded')

  // 2) 이어서 — 앞 대화가 같이 간다
  await page.getByTestId('talk-next-chip').first().click()
  check('D626 T7 답 아래 이어 물을 말을 누르면 질문칸에', (await page.getByTestId('talk-input').inputValue()) === '병목 하나로 좁혀 줘')
  await page.getByTestId('talk-send').click()
  await waitTalk(2)
  const c2 = llm.at(-1)
  check('D626 T8 둘째 물음 — [지금까지의 대화] 에 첫 물음과 첫 답이 같이 감', c2.user.includes('[지금까지의 대화') && c2.user.includes('돈이 가장 많이 새는 곳이 어디야') && c2.user.includes('결론: 배차 지연이 가장 큰 손실입니다') && c2.user.includes('병목 하나로 좁혀 줘'), c2.user.slice(-900))

  // 3) 리서치 — 이 시험의 공급자는 웹 검색이 없다 → 알림
  await say('research', '같은 업종에서 배차 자동화로 성과를 낸 사례')
  await waitTalk(3)
  check('D626 T9 리서치 — 근거 등급 줄 · 못 찾은 것 · 검색 못 한 모델이면 알림', llm.at(-1).skill === 'PLAN_RESEARCH' && (await page.getByTestId('talk-grade').first().innerText()) === 'A' && (await page.getByTestId('talk-unknowns').count()) === 1 && (await page.getByTestId('talk-nosearch').count()) === 1)
  check('D626 T10 리서치 결과에 검색 여부 · 출처 목록이 서버에서 붙음', (await talkRuns()).find((r) => r.skillId === 'PLAN_RESEARCH')?.structured?.searched === false && Array.isArray((await talkRuns()).find((r) => r.skillId === 'PLAN_RESEARCH')?.structured?.sources))

  // 4) 세 번 주고받으면 '다음: 기획서 판으로 굳히기'
  const nextGo = page.getByTestId('talk-next-go')
  check('D626 T11 세 번 주고받으면 다음 걸음 안내(기획서 판으로 굳히기)', (await nextGo.count()) === 1 && (await nextGo.innerText()).includes('기획서 판'))
  await nextGo.click()
  check('D626 T12 안내를 누르면 그 모드가 골라짐 · 물음 없이 보낼 수 있음', (await page.getByTestId('talk-send').getAttribute('data-mode')) === 'lock' && (await page.getByTestId('talk-send').isEnabled()))
  await page.getByTestId('talk-send').click()
  await waitTalk(4)
  await page.getByTestId('talk-board').waitFor()
  const cLock = llm.at(-1)
  check('D626 T13 기획서 판 — 대화 세 번이 다 같이 가고 판이 옆 칸에(제목 · 칸 · 미정)', cLock.skill === 'PLAN_LOCK' && cLock.user.includes('리서치') && cLock.user.split('대표: ').length - 1 >= 3 && (await page.getByTestId('talk-board-title').innerText()) === '그린 배차 AX' && (await page.getByTestId('talk-board-field').count()) >= 12 && (await page.getByTestId('talk-board-open').innerText()).includes('미정 1개'))
  check('D626 T14 판 번호(1번째)', (await page.getByTestId('talk-board-version').innerText()).includes('기획서 판 1번째'))

  // 5) 자체점검 — 굳힌 판이 같이 간다
  check('D626 T15 판을 굳힌 뒤 다음 걸음 = 자체점검', (await nextGo.innerText()).includes('자체점검'))
  await say('judge', '')
  await waitTalk(5)
  const cJudge = llm.at(-1)
  check('D626 T16 자체점검 — [지금 기획서 판] 이 같이 감 · 판정 · 꼭 고칠 것 · 따져 본 것 접힘', cJudge.skill === 'PLAN_JUDGE' && cJudge.user.includes('[지금 기획서 판') && cJudge.user.includes('그린 배차 AX') && cJudge.user.includes('가장 큰 병목: 배차 지연') && (await page.getByTestId('talk-verdict').getAttribute('data-verdict')) === 'FIX' && (await page.getByTestId('talk-mustfix').count()) === 1 && !(await page.getByTestId('talk-attacks').evaluate((d) => d.open)))
  check('D626 T17 예전 점검 이름은 화면 · 지시문에 없음(자체점검)', !/악마\s*판사|\x44\x45\x56\x49\x4C/i.test((await page.locator('body').innerText()) + cJudge.system))

  // 6) 개발 프롬프트
  await say('prompt', '')
  await waitTalk(6)
  await page.getByTestId('talk-prompt').waitFor()
  check('D626 T18 개발 프롬프트 — 저장소 이름 · 처음 붙일 말 · 비어 있는 것', llm.at(-1).skill === 'DEV_PROMPT' && (await page.getByTestId('talk-prompt-repo').innerText()) === 'green-dispatch-ax' && (await page.getByTestId('talk-prompt-first').innerText()).includes('전략 잠금부터') && (await page.getByTestId('talk-prompt-missing').count()) === 1)
  await page.getByTestId('talk-prompt-copy').click()
  check('D626 T19 [프롬프트 복사] = 프롬프트 글 그대로', (await page.evaluate(() => navigator.clipboard.readText())).startsWith('# green-dispatch-ax'))
  await page.getByTestId('talk-prompt-download').click()
  check('D626 T20 프롬프트 파일로 내려받기(.md)', /green-dispatch-ax_프롬프트\.md$/.test(await lastDl()), await lastDl())
  await shot(page, 'T2-talk-chat', false)
  await shot(page, 'T3-talk-full')

  // 7) 판 채택 → 기억에 넣기 → 다른 작업이 이어받는다
  const snaps0 = (await snaps()).length
  await page.getByTestId('talk-board-adopt').click()
  await page.getByTestId('memory-save').waitFor()
  await page.getByTestId('memory-save').click()
  await page.waitForFunction((n) => JSON.parse(localStorage.getItem('axmvp.v1.owner_ai.snapshots') ?? '[]').length > n, snaps0)
  const lockRun = (await talkRuns()).find((r) => r.skillId === 'PLAN_LOCK')
  const lastSnap = (await snaps()).at(-1)
  check('D626 T21 [이 판 채택] → 기억에 넣기(방향 칸에 판 요약) · 새 기억 판', lockRun.evaluation === 'adopted' && (await snaps()).length === snaps0 + 1 && String(lastSnap.content.axDirection).includes('그린 배차 AX') && String(lastSnap.content.axDirection).includes('병목: 배차 지연'), lastSnap?.content?.axDirection)

  // 8) 새로 고쳐도 그대로 · 실패 → 다시 보내기
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('talk-turns').waitFor()
  check('D626 T22 새로 고쳐도 대화 6번 · 판 · 프롬프트 그대로', (await page.getByTestId('talk-turn').count()) === 6 && (await page.getByTestId('talk-board-title').innerText()) === '그린 배차 AX' && (await page.getByTestId('talk-prompt-repo').count()) === 1 && (await page.getByTestId('talk-thread').count()) === 1)
  llmOverride = { status: 500, body: '{"error":{"message":"boom"}}' }
  await say('talk', '지표를 하나로 줄이면 뭐가 남아')
  await page.getByTestId('talk-failed').waitFor()
  check('D626 T23 실패 — 대화에 실패 한 줄 · 적은 말은 질문칸에 그대로 · 저장 0', (await page.getByTestId('talk-input').inputValue()) === '지표를 하나로 줄이면 뭐가 남아' && (await talkRuns()).length === 6 && !(await page.getByTestId('talk-failed').innerText()).includes('boom'))
  await page.getByTestId('talk-retry').click()
  check('D626 T24 [다시 보내기] → 답', (await waitTalk(7)) && (await page.getByTestId('talk-turn').count()) === 7)

  // 9) 새 대화 — 앞 대화와 섞이지 않는다
  await page.getByTestId('talk-new').click()
  await page.getByTestId('talk-hero').waitFor()
  await page.getByTestId('talk-field-ip').click()
  await say('talk', '이 회사가 가진 기술부터 정리하자')
  await waitTalk(8)
  const cNew = llm.at(-1)
  const threadIds = [...new Set((await talkRuns()).map((r) => r.input.options.thread))]
  check('D626 T25 새 대화 — 대화 번호 따로 · 앞 대화 내용이 안 섞임 · 특허 · 벤처 갈래 기준 문서', threadIds.length === 2 && !cNew.user.includes('돈이 가장 많이 새는 곳') && !cNew.user.includes('[지금 기획서 판') && cNew.user.includes('field: ip') && cNew.system.includes('4개 경로') && (await page.getByTestId('talk-thread').count()) === 2, cNew.user.slice(-500))

  // 10) 다른 AI 대화 가져오기 — AI 를 부르지 않고 자료 + 대화 한 줄
  const llmN = llm.length
  await page.getByTestId('talk-import').click()
  await page.getByTestId('talk-import-text').fill('나: 특허를 어느 갈래로 갈까\n답: 기존 설비 제어 기술이 있으니 기존 기술 중심으로 가세요. 담당자 주민번호 900101-1234567')
  await page.getByTestId('talk-import-save').click()
  await page.getByTestId('talk-pasted').waitFor()
  const theCase = (await cases()).find((c) => c.id === caseId)
  const imported = theCase.materials.find((m) => m.kind === 'chatgpt' && m.title.startsWith('가져온 대화'))
  check('D626 T26 다른 AI 대화 가져오기 — AI 0번 · 업체 자료로 남음 · 주민번호 지움 · 대화에 한 줄', llm.length === llmN && !!imported && imported.text.includes('기존 기술 중심') && !JSON.stringify(theCase).includes('900101-1234567') && !JSON.stringify(await talkRuns()).includes('900101-1234567'))
  await say('talk', '그럼 그 갈래로 증거부터 모으자')
  await waitTalk(10)
  check('D626 T27 가져온 대화가 다음 물음에 같이 감(자료 + 앞 대화)', llm.at(-1).user.includes('기존 기술 중심'), llm.at(-1).user.slice(0, 600))

  // 11) 업체 작업실 — 결과 목록에는 대화가 안 쌓인다 · 단추에 대화 수
  await page.goto(`${BASE}/ai/cases/${caseId}`, { waitUntil: 'networkidle' })
  const rowsAfter = await page.locator('[data-testid="run-row"], [data-testid="result-row"]').count()
  check('D626 T28 업체 작업실 — 단추에 대화 수 · 결과 목록은 그대로(대화가 결과 줄로 쌓이지 않음)', (await page.getByTestId('case-talk-open').first().innerText()).includes('기획 대화 2') && rowsAfter === resultRowsBefore && !(await page.locator('main').innerText()).includes('기획 리서치'), [resultRowsBefore, rowsAfter])

  // 12) 휴대폰 390 — 넘침 0 · 대화 / 판 탭
  {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
    const mp = await m.newPage()
    await wireApi(mp)
    await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
    const dump = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('axmvp.')).map((k) => [k, localStorage.getItem(k)])))
    await mp.evaluate((d) => Object.entries(d).forEach(([k, v]) => localStorage.setItem(k, v)), dump)
    await mp.goto(`${BASE}/ai/cases/${caseId}/talk?t=${threadIds.find((t) => t === r1.input.options.thread)}`, { waitUntil: 'networkidle' })
    await mp.getByTestId('talk-turns').waitFor()
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const box = await mp.getByTestId('talk-send').boundingBox()
    check('D626 T29 휴대폰 390 — 가로 넘침 0 · 보내기 단추 화면 안 · 대화/판 탭', over <= 1 && !!box && box.x + box.width <= 390 && box.height >= 40 && (await mp.getByTestId('talk-pane-board').isVisible()), [over, box])
    await shot(mp, 'M390-talk', false)
    await mp.getByTestId('talk-pane-board').click()
    check('D626 T30 휴대폰 — [기획서 판] 탭을 누르면 판만 보임', (await mp.getByTestId('talk-board').isVisible()) && !(await mp.getByTestId('talk-turns').isVisible()))
    await shot(mp, 'M390-talk-board', false)
    await m.close()
  }
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
