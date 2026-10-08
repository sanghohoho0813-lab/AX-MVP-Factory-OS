/**
 * 컨설팅 작업실 — 브라우저 인수 시험 (20단계 E2E, local 모드).
 *
 *   node e2e/studio.mjs <baseUrl>
 *
 * 지키려는 것
 *   고객 → 프로젝트 생성 → 사실표 자동 채움 → 게이트 → 핵심 줄기 경고 → 단계 완료 규칙 →
 *   프롬프트 만들기(개인정보 필터) → 결과 들여오기(버전) → 산출물 → 결정 로그 → 오늘 화면 연동 →
 *   고객 상세 탭 → 검색 → 모바일 390 에서 가로 넘침 0.
 */

import { chromium } from 'playwright'
import { seedScript, SEED_CLIENT_ID } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())

// 1) 작업실이 열리고 비어 있다
await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
await wait(700)
check('1 작업실 화면 열림 (D-178 이름: 특허·MVP · 예전 이름 안 보임)', (await page.getByRole('heading', { name: '특허·MVP' }).count()) > 0 && !/특허\+벤처/.test(await page.locator('body').innerText()))
check('1 씨앗 프로젝트 카드', (await page.getByText('작업지연 위험분석 특허').count()) > 0)

// 2) 새 프로젝트 — 고객 고르기
await page.getByRole('button', { name: '새 프로젝트' }).first().click()
await wait(400)
await page.getByRole('dialog').getByLabel('고객').selectOption(SEED_CLIENT_ID)
// §23 빠른 생성 — 고객만 고르면 된다(이름·workflow·owner 는 기본값)
await page.getByRole('button', { name: '시작', exact: true }).click()
await wait(1200)
check('2 프로젝트 생성 후 상세로 이동', /\/studio\/[^/]+$/.test(page.url()), page.url())
const projectUrl = page.url()

// 3) 개요 — 다음 행동이 있고, 첫 행동이 사실표 채우기다
await page.goto(projectUrl + '?adv=1', { waitUntil: 'networkidle' })
await wait(600)
check('3 고급 개요에 다음 행동 표시', (await page.getByText('다음 행동').count()) > 0)
const first = await page.locator('button:has-text("사실표 ·")').first().textContent().catch(() => '')
check('3 첫 행동은 사실표 채우기', (first ?? '').includes('사실표'), first ?? '')

// 4) 사실표 — 고객 기록에서 회사 기본값이 들어와 있다 (미확인 상태)
await page.goto(projectUrl + '?adv=1&tab=factsheet', { waitUntil: 'networkidle' })
await wait(600)
check('4 회사명 자동 채움', (await page.getByText('한솔테크').count()) > 0)
check('4 상태 = 미확인', (await page.getByText('미확인').count()) > 0)
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]'))
check('4 저장소에 사실표 출처 = 고객 관리 기록', stored[0]?.factsheet?.companyName?.source === '고객 관리 기록')

// 5) 사실표 입력 — 고객 기록에 없던 항목(대표자·설립일·본점·주요 제품)을 채운다 (블러 저장)
const fillFact = async (key, label, value) => {
  await page.getByRole('button', { name: new RegExp(label) }).first().click()
  await wait(250)
  const box = page.locator(`#fact-input-${key}`)
  await box.fill(value)
  await box.blur()
  await wait(300)
}
await fillFact('representative', '^대표자', '김대표')
await fillFact('establishedAt', '설립일', '2019-03-02')
await fillFact('headOffice', '본점', '경기 남양주시 진접읍 1')
await fillFact('mainProducts', '주요 제품·서비스', '간판 및 광고물 제작')
await wait(1200)
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]'))
check('5 자동저장 — 네 항목이 저장됨', after[0]?.factsheet?.mainProducts?.value === '간판 및 광고물 제작' && after[0]?.factsheet?.representative?.value === '김대표' && after[0]?.factsheet?.headOffice?.value?.includes('남양주'))

// 6) 단계 — S0 완료 조건: 필요 사실은 있으나 체크리스트 전이면 버튼 비활성
await page.goto(projectUrl + '?adv=1&tab=stages&focus=S0', { waitUntil: 'networkidle' })
await wait(600)
check('6 S0 완료 조건 통과 문구', (await page.getByText('필요한 사실·산출물이 모두 있습니다').count()) > 0)
const completeBtn = page.getByRole('button', { name: '완료로 넘기기' })
check('6 체크리스트 전에는 완료 버튼 비활성', await completeBtn.isDisabled())
for (const cb of await page.locator('input[type=checkbox]').all()) await cb.check()
await wait(200)
check('6 체크리스트 후 완료 버튼 활성', !(await completeBtn.isDisabled()))
await completeBtn.click()
await wait(1200)
const afterS0 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]')[0])
check('6 S0 완료 · 현재 단계 S1', afterS0.stages.S0.status === 'completed' && afterS0.currentStage === 'S1')

// 7) 게이트 — 이유 없이 결정 버튼 잠김 → 이유 적고 GO
await page.goto(projectUrl + '?adv=1&tab=stages&focus=S1', { waitUntil: 'networkidle' })
await wait(600)
check('7 GO 버튼은 이유 전에 비활성', await page.getByRole('button', { name: 'GO', exact: true }).isDisabled())
const reason = page.getByLabel('결정 이유')
await reason.fill('현장문제·거래처 명확')
await reason.blur()
await wait(300)
await page.getByRole('button', { name: 'GO', exact: true }).click()
await wait(1200)
const afterGate = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]')[0])
check('7 게이트 GO 저장', afterGate.gate.decision === 'go' && afterGate.gate.reason === '현장문제·거래처 명확')
const decisions1 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_decisions') ?? '[]'))
check('7 결정 로그에 게이트 기록', decisions1.some((d) => d.kind === 'gate'))
const journal1 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]'))
check('7 업무 일기에도 결정으로 남음', journal1.some((j) => j.entryType === 'decision' && j.clientId === 'cli_hansol'))

// 8) 핵심 줄기 — 서로 다른 기술 → p1 경고
await page.goto(projectUrl + '?adv=1&tab=thread', { waitUntil: 'networkidle' })
await wait(600)
const fillThread = async (key, text) => {
  const box = page.locator(`#thread-input-${key}`)
  await box.fill(text)
  await box.blur()
  await wait(400)
}
await fillThread('coreTech', '작업지연 위험분석')
await fillThread('patentPoint', '고객 예약 플랫폼')
await wait(1000)
check('8 다른 기술로 읽히면 P1 경고', (await page.getByText('같은 낱말을 하나도 쓰지 않습니다').count()) > 0)
await fillThread('patentPoint', '작업지연 위험 산출 순서')
await wait(1000)
check('8 같은 낱말이면 경고 사라짐', (await page.getByText('같은 낱말을 하나도 쓰지 않습니다').count()) === 0)

// 9) 프롬프트 — 개인정보 필터: 사실표에 주민번호를 넣어도 프롬프트에 나가지 않는다
await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]')
  list[0].factsheet.ceoCareer = { value: '주민 900101-1234567 · 계좌번호 110-123-456789 · 010-1234-5678', status: 'confirmed', source: '', asOfDate: '', note: '', updatedAt: null }
  localStorage.setItem('axmvp.v1.consulting_projects', JSON.stringify(list))
})
await page.goto(projectUrl + '?adv=1&tab=prompts&focus=GENERAL_PROJECT_REVIEW', { waitUntil: 'networkidle' })
await wait(800)
const preview = await page.getByLabel('프롬프트 미리보기').inputValue()
check('9 프롬프트에 [ARTIFACT] 머리줄 요구', preview.includes('[ARTIFACT] type=GENERAL_REVIEW stage=S0'))
check('9 주민번호가 나가지 않는다', !preview.includes('900101-1234567') && preview.includes('[가림:주민번호]'))
check('9 계좌·휴대폰 가림', !preview.includes('110-123-456789') && !preview.includes('010-1234-5678'))
check('9 가림 보고 배지', (await page.getByText(/총 \d+곳 가림/).count()) > 0)
check('9 여섯 버튼', (await page.getByRole('button', { name: '프롬프트 복사' }).count()) === 1 && (await page.getByRole('button', { name: 'Claude Code용 복사' }).count()) === 1)

// 10) 프롬프트 복사 → 꾸러미 기록
await page.getByRole('button', { name: '프롬프트 복사' }).click()
await wait(900)
const pkgs = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_prompt_packages') ?? '[]'))
check('10 꾸러미가 기록됨 (필터 통과본)', pkgs.length === 1 && !pkgs[0].prompt.includes('900101-1234567') && pkgs[0].privacy.rrn >= 1)
check('10 결과 들여오기 단추가 나타남', (await page.getByRole('button', { name: '결과 들여오기' }).count()) > 0)

// 11) 결과 들여오기 — 머리줄 인식 → 산출물 v1
await page.getByRole('button', { name: '결과 들여오기' }).first().click()
await wait(500)
await page.getByLabel('결과 본문').fill('[ARTIFACT] type=GENERAL_REVIEW stage=S1 title="1차 검토"\n\n## 현재 단계\nS1 게이트\n\n## 확인 필요\n- 없음')
await wait(300)
check('11 머리줄 인식 배지', (await page.getByText(/머리줄 인식/).count()) > 0)
await page.getByRole('button', { name: '산출물로 저장' }).click()
await wait(1200)
const arts = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]'))
check('11 산출물 v1 저장 · 종류·단계 자동', arts.length === 1 && arts[0].type === 'GENERAL_REVIEW' && arts[0].stageKey === 'S1' && arts[0].version === 1 && arts[0].title === '1차 검토')
check('11 본문에서 머리줄 제거', arts[0]?.content.startsWith('## 현재 단계'))
check('11 출처 = llm_paste · 꾸러미 연결', arts[0]?.source === 'llm_paste' && arts[0]?.promptPackageId === pkgs[0].id)

// 12) 두 번째 들여오기 → v2, v1 은 대체됨
await page.goto(projectUrl + '?adv=1&tab=artifacts', { waitUntil: 'networkidle' })
await wait(600)
await page.getByRole('button', { name: '이 종류 새 버전 적기' }).first().click()
await wait(400)
await page.getByLabel('결과 본문').fill('2차 검토 본문')
await page.getByRole('button', { name: '산출물로 저장' }).click()
await wait(1200)
const arts2 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]'))
check('12 v2 생성 · v1 대체됨', arts2.length === 2 && arts2.some((a) => a.version === 2 && a.status === 'draft') && arts2.some((a) => a.version === 1 && a.status === 'superseded'))

// 13) 특허 — KIPO 참고자료 검색·선정 규칙
await page.goto(projectUrl + '?adv=1&tab=patent&focus=kipo', { waitUntil: 'networkidle' })
await wait(600)
await page.getByLabel('참고자료 검색').fill('머신 러닝')
await wait(400)
check('13 KIPO 검색 결과 0304', (await page.getByText('0304').count()) > 0)
await page.getByRole('button', { name: '고르기' }).first().click()
await wait(900)
check('13 1종이면 부족 안내', (await page.getByText(/최소 2종/).count()) > 0)
check('13 PDF 미첨부 안내', (await page.getByText(/PDF 를 아직 받지 않은/).count()) > 0)

// 14) 벤처 — D-179 예전 벤처 기록은 읽기 전용(Red Flag · Judge 는 보이기만)
await page.goto(projectUrl + '?adv=1&tab=venture&focus=redflags', { waitUntil: 'networkidle' })
await wait(600)
check('14 P0 12개 표시(읽기 전용 · 확인 0/12)', /Red Flag 확인 0\/12/.test(await page.getByTestId('legacy-venture-more').innerText()))
check('14 Judge 입력칸 없음(예전 기록 읽기 전용)', (await page.locator('input[type=number]').count()) === 0)

// 15) 증빙 — 10슬롯
await page.goto(projectUrl + '?adv=1&tab=evidence', { waitUntil: 'networkidle' })
await wait(600)
check('15 빈 슬롯 10(읽기 전용 · 채운 슬롯 0/10)', /채운 슬롯 0\/10/.test(await page.getByTestId('legacy-evidence').innerText()))
check('15 슬롯 추가 단추 없음(D-179 — 벤처 증빙은 기업인증에서)', (await page.getByRole('button', { name: /이 슬롯에 주장·첨부 추가/ }).count()) === 0 && (await page.getByTestId('legacy-venture-record-open').count()) === 1)

// 16) 실사 — D-179 예전 벤처 현장실사는 읽기 전용(질문 추가 · Script 입력 없음) · 금지어 탐지는 예전 글에도(아래 L 에서)
await page.goto(projectUrl + '?adv=1&tab=review&focus=qa', { waitUntil: 'networkidle' })
await wait(600)
check('16 예상질문 추가 없음(읽기 전용 · 기록 0개)', (await page.getByText('기본 질문 풀 15개에서 고르기').count()) === 0 && /예상질문 · 답변 Key Point \(0개\)/.test(await page.getByTestId('legacy-field-review').innerText()))
check('16 Script 입력칸 없음 · 기업인증 벤처 열기 하나', (await page.getByLabel('Script (대표자 말투로)').count()) === 0 && (await page.getByTestId('legacy-venture-record-open').count()) === 1)

/*
 * 17) 오늘 화면에는 '컨설팅 다음 행동' 을 두지 않는다 (D-70).
 * 대표 지시로 오늘 화면을 네 구역으로 줄였다 — 컨설팅은 왼쪽 메뉴의 작업실에서 본다.
 * 정보가 사라진 것이 아니라 자리를 옮긴 것이므로, 가는 길이 살아 있는지도 함께 본다.
 */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await wait(1200)
check('17 오늘 화면에 컨설팅 다음 행동이 없다', (await page.getByText('컨설팅 다음 행동').count()) === 0)
await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
await wait(900)
check('17 컨설팅 작업실로 가는 길은 살아 있다', !page.url().includes('/404') && (await page.locator('main').innerText()).length > 0)

// 18) 고객 상세 — 컨설팅 탭
await page.goto(BASE + `/ops/clients/${SEED_CLIENT_ID}?tab=consulting`, { waitUntil: 'networkidle' })
await wait(900)
check('18 고객 상세 컨설팅 탭에 프로젝트(새 프로젝트 기본 이름 특허 · MVP)', (await page.getByText('특허 · MVP', { exact: true }).count()) > 0)

// 19) 전역 검색
await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
await wait(700)
await page.keyboard.press('Control+K')
await wait(400)
await page.keyboard.type('한솔')
await wait(400)
check('19 검색에 특허·MVP 그룹(예전 이름 없음)', (await page.getByRole('dialog').getByText('특허·MVP').count()) >= 1 && (await page.getByRole('dialog').getByText('특허+벤처').count()) === 0)
await page.keyboard.press('Escape')

// L) D-179 예전 벤처 기록 읽기 전용 — 읽기는 두 곳(특허·MVP · 기업인증), 수정은 기업인증 한 곳
{
  const PROJ = 'proj_hansol'
  const KEY = 'axmvp.v1.consulting_projects'
  await page.evaluate(({ key, id }) => {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    const p = list.find((x) => x.id === id)
    p.fieldReview = { ...(p.fieldReview ?? {}), script: '저희는 국내 최초로 특허 등록 완료한 …', qa: [{ question: '이 기술을 왜 개발했습니까?', keyPoint: '' }] }
    p.venture = { ...(p.venture ?? {}), sections: { 1: { outline: '현장 납기 지연을 늦게 아는 문제 — 예전 사업계획 요지', done: true }, 2: { outline: '작업지연 위험 점수로 먼저 알려 주는 솔루션', done: false } }, documents: { bizReg: true }, judgeScores: {}, redFlagsCleared: {}, submittedAt: '2026-08-20', submissionNote: '접수번호 2026-123' }
    localStorage.setItem(key, JSON.stringify(list))
  }, { key: KEY, id: PROJ })
  // 예전 벤처 기록의 내용(저장할 때 빈 칸 기본값이 채워지는 것은 내용이 아니므로 뺀다)
  const ventureOf = () => page.evaluate(({ key, id }) => {
    const p = JSON.parse(localStorage.getItem(key) ?? '[]').find((x) => x.id === id) ?? {}
    const v = p.venture ?? {}
    const fr = p.fieldReview ?? {}
    return JSON.stringify({ s: [1, 2, 3, 4, 5, 6, 7].map((n) => [v.sections?.[n]?.outline ?? '', !!v.sections?.[n]?.done]), at: v.submittedAt ?? '', note: v.submissionNote ?? '', docs: Object.entries(v.documents ?? {}).filter(([, on]) => on).map(([k]) => k).sort(), script: fr.script ?? '', qa: (fr.qa ?? []).length, s14: p.stages?.S14?.status ?? 'not_started' })
  }, { key: KEY, id: PROJ })
  const before = await ventureOf()
  const pUrl = BASE + '/studio/' + PROJ
  await page.goto(pUrl + '?adv=1&tab=venture', { waitUntil: 'networkidle' })
  await wait(700)
  const rec = page.getByTestId('legacy-venture-record')
  check('L1 예전 벤처 사업계획이 화면에 보임(1번 요지 · 초안 완료 · 빈 칸은 기록 없음)', /현장 납기 지연을 늦게 아는 문제/.test(await page.locator('[data-testid="legacy-plan-section"][data-no="1"]').innerText()) && /초안 완료/.test(await page.locator('[data-testid="legacy-plan-section"][data-no="1"]').innerText()) && /기록 없음/.test(await page.locator('[data-testid="legacy-plan-section"][data-no="3"]').innerText()))
  check('L2 예전 벤처 영역에 입력칸 · 체크 · 고르기 0', (await rec.locator('input, textarea, select, [contenteditable="true"]').count()) === 0)
  check('L3 신청일은 글로만(2026-08-20) · 날짜 입력칸 없음', /2026-08-20/.test(await page.getByTestId('legacy-submitted-at').innerText()) && (await rec.locator('input[type="date"]').count()) === 0 && /현재 진행상태는 기업인증에서 확인하세요/.test(await rec.innerText()))
  check('L2 Primary 단추 하나 = 기업인증 벤처 열기', (await page.locator('main button.bg-brand-600:visible').count()) === 1 && /기업인증 벤처 열기/.test(await page.getByTestId('legacy-venture-record-open').innerText()))
  await page.goto(pUrl + '?adv=1&tab=stages&focus=S14', { waitUntil: 'networkidle' })
  await wait(600)
  check('L4 벤처 단계(S14 신청 완료) — 상태 · 완료 · 막힘 · 건너뛰기 단추 없음 · 예전 기록 안내', (await page.getByTestId('legacy-stage').count()) === 1 && (await page.getByRole('button', { name: /완료로 넘기기|진행 중으로|검토 대기로|막힘으로 표시|건너뜀으로 표시|이 단계로 옮기기/ }).count()) === 0)
  await page.goto(pUrl + '?adv=1&tab=review', { waitUntil: 'networkidle' })
  await wait(500)
  check('L4 현장실사 · 결과도 읽기 전용(입력칸 0) · 예전 Script · 질문은 글로 보임', (await page.getByTestId('legacy-field-review').count()) === 1 && (await page.getByTestId('legacy-field-review').locator('input, textarea, select').count()) === 0 && /국내 최초/.test(await page.getByTestId('legacy-field-review').innerText()) && /이 기술을 왜 개발했습니까/.test(await page.getByTestId('legacy-field-review').innerText()))
  check('16 금지 표현 탐지(예전 글에도 알려 줌)', /국내 최초/.test(await page.getByTestId('legacy-forbidden').innerText().catch(() => '')))
  await page.goto(pUrl + '?adv=1&tab=prompts&focus=VENTURE_PLAN_SECTION', { waitUntil: 'networkidle' })
  await wait(500)
  check('L4 벤처 프롬프트는 새로 못 만듦(종류 목록에 없음 · 안내)', (await page.getByLabel('프롬프트 종류').locator('option', { hasText: /사업계획서|Judge|Claim|인포그래픽|실사/ }).count()) === 0 && (await page.getByTestId('legacy-venture-record-notice').count()) === 1)
  check('L3 · L4 화면을 돌아다녀도 예전 벤처 기록 그대로(사업계획 · 신청일 · 메모 · 실사 · S14 상태)', (await ventureOf()) === before)
  // L6 특허 · L7 MVP 는 계속 편집
  await page.goto(pUrl + '?adv=1&tab=patent', { waitUntil: 'networkidle' })
  await wait(500)
  await page.getByLabel('발명자 (실제 기여 기준)').fill('김발명')
  await page.getByLabel('발명자 (실제 기여 기준)').press('Tab')
  await wait(1300)
  const pt = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? '[]').find((x) => x.id === id)?.patent?.inventors, { key: KEY, id: PROJ })
  check('L6 특허 필드는 계속 편집 · 저장(발명자)', pt === '김발명', pt)
  await page.goto(pUrl + '?adv=1&tab=mvp', { waitUntil: 'networkidle' })
  await wait(500)
  await page.getByLabel('PRODUCT').fill('납기 레이더')
  await page.getByLabel('PRODUCT').press('Tab')
  await wait(1300)
  const mv = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? '[]').find((x) => x.id === id)?.mvp?.productName, { key: KEY, id: PROJ })
  check('L7 MVP 필드는 계속 편집 · 저장(PRODUCT)', mv === '납기 레이더', mv)
  check('L6 · L7 특허 · MVP 를 저장해도 예전 벤처 기록 그대로', (await ventureOf()) === before)
  // L5 기업인증으로 — 같은 업체
  await page.goto(pUrl + '?adv=1&tab=venture', { waitUntil: 'networkidle' })
  await wait(500)
  await page.getByTestId('legacy-venture-record-open').click()
  await page.waitForURL(/\/tools\/cert-os\/venture/)
  await wait(700)
  check('L5 [기업인증 벤처 열기] → 같은 업체(client=cli_hansol)', /\/tools\/cert-os\/venture\?client=cli_hansol/.test(page.url()), page.url())
  // L8 기업인증이 예전 기록을 계속 읽음
  await page.getByTestId('cert-step-2').click()
  await wait(400)
  const lg = await page.getByTestId('cert-venture-legacy').innerText().catch(() => '')
  check('L8 기업인증 벤처가 예전 사업계획 초안(1/7)을 계속 읽음', /사업계획 초안 1\/7/.test(lg), lg)
  // L9 다른 업체에는 안 섞임(같은 작업공간 안 업체 구분 — 작업공간 사이 격리는 qa:db 모든 표 · qa:pilot)
  await page.goto(BASE + '/tools/cert-os/venture?client=cli_wooil', { waitUntil: 'networkidle' })
  await wait(500)
  await page.getByTestId('cert-step-2').click()
  await wait(300)
  check('L9 다른 업체(우일산업)에는 한솔의 예전 벤처 기록이 안 보임', (await page.getByTestId('cert-venture-legacy').count()) === 0)
  // 예전 주소 · 돌려보내기 없음
  await page.goto(BASE + `/ops/clients/${SEED_CLIENT_ID}?tab=consulting`, { waitUntil: 'networkidle' })
  await wait(700)
  check('L 예전 주소(업체 상세 컨설팅 탭) 그대로 열림 · 튕기지 않음', page.url().includes('tab=consulting') && (await page.getByTestId('legacy-venture-notice').count()) === 1)
  await page.goto(pUrl, { waitUntil: 'networkidle' })
  await wait(600)
  check('L 간단 화면 진행 탭도 정상(특허 · MVP 단계는 그대로)', (await page.locator('main').innerText()).length > 0 && !page.url().includes('/404'))
}

// 20) 모바일 390 — 새 화면들 가로 넘침 0 · JS 오류 0
let overflow = 0
for (const tab of ['', '?adv=1', '?adv=1&tab=stages', '?adv=1&tab=factsheet', '?adv=1&tab=thread', '?adv=1&tab=patent', '?adv=1&tab=mvp', '?adv=1&tab=venture', '?adv=1&tab=evidence', '?adv=1&tab=prompts', '?adv=1&tab=artifacts', '?adv=1&tab=decisions', '?adv=1&tab=review']) {
  await page.goto(projectUrl + tab, { waitUntil: 'networkidle' })
  await wait(500)
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (w > 2) { overflow++; console.log('   overflow', tab, w) }
}
check('20 390px 가로 넘침 0 (간단+고급 13화면)', overflow === 0)
check('20 JS 오류 0', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\n컨설팅 작업실: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
