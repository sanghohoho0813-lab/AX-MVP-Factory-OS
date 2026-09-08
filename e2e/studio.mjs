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
check('1 작업실 화면 열림', (await page.getByText('컨설팅 작업실').count()) > 0)
check('1 씨앗 프로젝트 카드', (await page.getByText('작업지연 위험분석 특허').count()) > 0)

// 2) 새 프로젝트 — 고객 고르기
await page.getByRole('button', { name: '새 프로젝트' }).first().click()
await wait(400)
await page.getByRole('dialog').getByLabel('고객').selectOption(SEED_CLIENT_ID)
await page.getByRole('dialog').getByLabel('프로젝트 이름').fill('작업지연 특허 · 벤처인증')
await page.getByRole('button', { name: '만들기', exact: true }).click()
await wait(1200)
check('2 프로젝트 생성 후 상세로 이동', /\/studio\/[^/]+$/.test(page.url()), page.url())
const projectUrl = page.url()

// 3) 개요 — 다음 행동이 있고, 첫 행동이 사실표 채우기다
check('3 다음 행동 표시', (await page.getByText('다음 행동').count()) > 0)
const first = await page.locator('button:has-text("사실표 ·")').first().textContent().catch(() => '')
check('3 첫 행동은 사실표 채우기', (first ?? '').includes('사실표'), first ?? '')

// 4) 사실표 — 고객 기록에서 회사 기본값이 들어와 있다 (미확인 상태)
await page.goto(projectUrl + '?tab=factsheet', { waitUntil: 'networkidle' })
await wait(600)
check('4 회사명 자동 채움', (await page.getByText('한솔테크').count()) > 0)
check('4 상태 = 미확인', (await page.getByText('미확인').count()) > 0)
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]'))
check('4 저장소에 사실표 출처 = 고객 운영 기록', stored[0]?.factsheet?.companyName?.source === '고객 운영 기록')

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
await page.goto(projectUrl + '?tab=stages&focus=S0', { waitUntil: 'networkidle' })
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
await page.goto(projectUrl + '?tab=stages&focus=S1', { waitUntil: 'networkidle' })
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
await page.goto(projectUrl + '?tab=thread', { waitUntil: 'networkidle' })
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
await page.goto(projectUrl + '?tab=prompts&focus=GENERAL_PROJECT_REVIEW', { waitUntil: 'networkidle' })
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
await page.goto(projectUrl + '?tab=artifacts', { waitUntil: 'networkidle' })
await wait(600)
await page.getByRole('button', { name: '이 종류 새 버전 적기' }).first().click()
await wait(400)
await page.getByLabel('결과 본문').fill('2차 검토 본문')
await page.getByRole('button', { name: '산출물로 저장' }).click()
await wait(1200)
const arts2 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.consulting_artifacts') ?? '[]'))
check('12 v2 생성 · v1 대체됨', arts2.length === 2 && arts2.some((a) => a.version === 2 && a.status === 'draft') && arts2.some((a) => a.version === 1 && a.status === 'superseded'))

// 13) 특허 — KIPO 참고자료 검색·선정 규칙
await page.goto(projectUrl + '?tab=patent&focus=kipo', { waitUntil: 'networkidle' })
await wait(600)
await page.getByLabel('참고자료 검색').fill('머신 러닝')
await wait(400)
check('13 KIPO 검색 결과 0304', (await page.getByText('0304').count()) > 0)
await page.getByRole('button', { name: '고르기' }).first().click()
await wait(900)
check('13 1종이면 부족 안내', (await page.getByText(/최소 2종/).count()) > 0)
check('13 PDF 미첨부 안내', (await page.getByText(/PDF 를 아직 받지 않은/).count()) > 0)

// 14) 벤처 — P0 Red Flag 12개 · Judge
await page.goto(projectUrl + '?tab=venture&focus=redflags', { waitUntil: 'networkidle' })
await wait(600)
check('14 P0 12개 표시', (await page.getByText(/남은 것 12\/12/).count()) > 0)
check('14 Judge 10축', (await page.locator('input[type=number]').count()) === 10)

// 15) 증빙 — 10슬롯
await page.goto(projectUrl + '?tab=evidence', { waitUntil: 'networkidle' })
await wait(600)
check('15 빈 슬롯 10', (await page.getByText('빈 슬롯 10').count()) > 0)
await page.getByRole('button', { name: /이 슬롯에 주장·첨부 추가/ }).first().click()
await wait(900)
check('15 슬롯 1에 항목 추가 → 빈 슬롯 9', (await page.getByText('빈 슬롯 9').count()) > 0)

// 16) 실사 — 질문 풀에서 고르기 · 금지어 탐지
await page.goto(projectUrl + '?tab=review&focus=qa', { waitUntil: 'networkidle' })
await wait(600)
await page.getByText('기본 질문 풀 15개에서 고르기').click()
await wait(300)
await page.getByRole('button', { name: '이 기술을 왜 개발했습니까?' }).click()
await wait(900)
check('16 예상질문 추가', (await page.getByText(/예상질문 · 답변 Key Point — 1개/).count()) > 0)
const script = page.getByLabel('Script (대표자 말투로)')
await script.fill('저희는 국내 최초로 특허 등록 완료한 …')
await script.blur()
await wait(900)
check('16 금지 표현 탐지', (await page.getByText('금지 표현이 들어 있습니다').count()) > 0)

// 17) 오늘 화면 — 컨설팅 다음 행동
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await wait(1200)
check('17 오늘 화면에 컨설팅 다음 행동', (await page.getByText('컨설팅 다음 행동').count()) > 0)

// 18) 고객 상세 — 컨설팅 탭
await page.goto(BASE + `/ops/clients/${SEED_CLIENT_ID}?tab=consulting`, { waitUntil: 'networkidle' })
await wait(900)
check('18 고객 상세 컨설팅 탭에 프로젝트', (await page.getByText('작업지연 특허 · 벤처인증').count()) > 0)

// 19) 전역 검색
await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
await wait(700)
await page.keyboard.press('Control+K')
await wait(400)
await page.keyboard.type('작업지연')
await wait(400)
check('19 검색에 컨설팅 작업실 그룹', (await page.getByText('컨설팅 작업실').count()) >= 2)
await page.keyboard.press('Escape')

// 20) 모바일 390 — 새 화면들 가로 넘침 0 · JS 오류 0
let overflow = 0
for (const tab of ['', '?tab=stages', '?tab=factsheet', '?tab=thread', '?tab=patent', '?tab=mvp', '?tab=venture', '?tab=evidence', '?tab=prompts', '?tab=artifacts', '?tab=decisions', '?tab=review']) {
  await page.goto(projectUrl + tab, { waitUntil: 'networkidle' })
  await wait(500)
  const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (w > 2) { overflow++; console.log('   overflow', tab, w) }
}
check('20 390px 가로 넘침 0 (12탭)', overflow === 0)
check('20 JS 오류 0', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\n컨설팅 작업실: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
