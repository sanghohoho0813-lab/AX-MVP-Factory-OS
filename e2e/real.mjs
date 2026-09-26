/**
 * 실제 데이터처럼 — 긴 값 · 많은 항목으로 휴대폰 화면 잘림 · 넘침 찾기 (D-124)
 *
 *   node e2e/real.mjs <baseUrl>
 *
 * 왜 필요한가:
 *   시드 데이터는 이름이 짧고 항목이 적어 멀쩡해 보인다. 실제 업체는 '한국스마트팩토리솔루션(주)' 처럼
 *   이름이 길고, 주소 · 이메일 · 다음 할 일이 길고, 수금 항목이 열 줄을 넘는다. 대표가 휴대폰으로
 *   회사 기본 정보 카드를 열었더니 값이 오른쪽 끝에서 잘려 있었다(D-124) — 그런 것을 사람 눈 대신 숫자로 잡는다.
 *
 * 판정(화면마다 · 360 · 390 · 430 · 360 아주 큰 글자):
 *   1. 문서가 옆으로 넘치지 않는다(scrollWidth ≤ 화면 너비)
 *   2. 글자를 가진 칸이 화면 밖으로 나가지 않는다
 *   3. 글자를 가진 칸이 자기를 가두는(overflow hidden · clip) 조상 밖으로 삐져나가 잘리지 않는다
 *      — 일부러 옆으로 미는 줄(탭 · 칩 줄 · 표)과 말줄임(…)은 뺀다
 *   4. 화면 오류(오류 울타리) · JS 오류가 없다
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}

/** 시드 위에 긴 값 · 많은 항목을 얹는다 (브라우저 안에서) */
const LONG_DATA = `(() => {
  const K = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(K) || '[]')
  const now = new Date().toISOString()
  const day = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10) }
  const h = list.find((c) => c.id === 'cli_hansol')
  Object.assign(h, {
    companyName: '한솔테크놀로지스마트팩토리솔루션앤컨설팅(주)',
    representativeName: '김수한무거북이와두루미',
    contactName: '박실장(경영지원본부 재무회계팀)',
    contactPhone: '010-2345-6789',
    companyPhone: '02-1234-5678 (내선 1234)',
    contactEmail: 'ceo.hansol.technology.smartfactory@hansoltechnology-solutions.co.kr',
    homepage: 'https://www.hansoltechnology-smartfactory-solutions.co.kr/company/about',
    businessAddress: '경기도 성남시 분당구 판교역로 235 에이치스퀘어 엔동 7층 701호 (삼평동, 판교테크노밸리)',
    industry: '응용 소프트웨어 개발 및 공급업, 컴퓨터시스템 통합 자문 및 구축 서비스업',
    businessCategory: '정보통신업 · 전문, 과학 및 기술 서비스업',
    businessItem: '스마트팩토리 MES 솔루션, 산업용 IoT 게이트웨이, 데이터 분석 컨설팅',
    shareholders: '김수한무거북이와두루미 60% · 이두루미 25% · 한솔인베스트먼트유한회사 15%',
    nextAction: '벤처인증 신청서 최종 검토 후 제출 — 기술평가 보완 자료(특허 명세서 · 매출 증빙) 같이 올리기',
    nextActionDueDate: day(1),
  })
  h.customDocuments = [
    ...(h.customDocuments || []),
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'cd_long_' + i, label: '연구개발전담부서 인정서 및 연구원 재직증명서 묶음 ' + (i + 1), received: i % 2 === 0, note: '', createdAt: now })),
  ]
  h.fees = [
    ...(h.fees || []),
    ...Array.from({ length: 12 }, (_, i) => ({
      id: 'fee_long_' + i, serviceKey: null, kind: i % 3 === 0 ? 'deposit' : 'balance',
      label: '스마트팩토리 구축 지원사업 컨설팅 ' + (i + 1) + '차 중도금(부가세 별도)',
      amount: 12345000 * (i + 1), agentFee: i % 2 ? 1234500 : null, agentName: i % 2 ? '홍길동영업대리점' : '',
      agentPaidAt: null, dueDate: day(i * 7 - 30), receivedAt: i < 4 ? day(i * 7 - 30) : null, note: '세금계산서 발행 후 7일 이내 입금 약속',
    })),
  ]
  h.sales = { stage: 'contracted', source: '소개', referrer: '홍길동영업대리점 김영업부장', interests: ['가지급금', '미처분이익잉여금', '가업승계', '연구소', '벤처인증', '정책자금', '법인보험'], concern: '가지급금이 3억 넘게 쌓였고 자녀 승계를 5년 안에 끝내고 싶은데 세무사와 의견이 다르다', expectedFee: 123450000, history: [{ at: now, from: null, to: 'contracted' }], movedAt: now }
  // 잠재고객 스무 곳 — 이름이 긴 업체 · 단계 골고루
  const stages = ['lead', 'm1sched', 'm1done', 'm2', 'closing', 'hold']
  for (let i = 0; i < 20; i++) {
    const st = stages[i % stages.length]
    list.push({
      id: 'cli_long_' + i, workspaceId: null,
      companyName: ['대한민국스마트제조혁신', '글로벌바이오헬스케어', '한국친환경에너지솔루션', '미래모빌리티부품'][i % 4] + '(주) 제' + (i + 1) + '공장',
      contactName: '담당 ' + (i + 1), contactPhone: '010-0000-00' + String(i).padStart(2, '0'), contactEmail: '', businessNumber: '', corporateNumber: '',
      businessAddress: '', industry: '자동차 신품 부품 제조업', status: 'waiting',
      nextAction: i % 2 ? '1차 미팅 — 재무제표 3개년 · 주주명부 · 법인등기부등본 받아 오기' : '', nextActionDueDate: i % 2 ? day(i - 5) : '',
      notes: '', services: {}, documents: {}, customFields: [], customDocuments: [], fees: [], fundingApplications: [], toolResults: [], activity: [], archivedAt: null,
      sales: { stage: st, source: '홈페이지 상담신청', referrer: '', interests: st === 'lead' || st === 'm1sched' ? [] : ['가지급금', '정책자금', '가업승계'], concern: '임원 퇴직금 규정이 없고 가지급금이 계속 늘어난다', expectedFee: 5500000 * (i + 1), history: [{ at: now, from: null, to: st }], movedAt: now },
      createdAt: now, updatedAt: now,
    })
  }
  localStorage.setItem(K, JSON.stringify(list))
  // 업무 일기 — 긴 글 서른 줄
  const J = 'axmvp.v1.ops_journal_entries'
  const journal = JSON.parse(localStorage.getItem(J) || '[]')
  for (let i = 0; i < 30; i++) journal.push({ id: 'j_long_' + i, entryDate: day(-i), entryType: 'memo', content: '한솔테크놀로지 김수한무거북이와두루미 대표님과 통화 — 벤처인증 기술평가 보완 자료 목록을 다시 정리해서 금요일까지 보내 드리기로 함. 특허 명세서 초안은 변리사 검토 뒤 전달.', clientId: 'cli_hansol', pinned: false, createdAt: now, updatedAt: now })
  localStorage.setItem(J, JSON.stringify(journal))
})()`

const SCREENS = [
  '/',
  '/ops/clients',
  '/ops/clients/cli_hansol',
  '/ops/clients/cli_hansol?tab=work',
  '/ops/clients/cli_hansol?tab=consulting',
  '/ops/clients/cli_hansol?tab=docs',
  '/ops/clients/cli_hansol?tab=fees',
  '/ops/clients/cli_hansol?tab=funding',
  '/ops/clients/cli_hansol?tab=portal',
  '/ops/clients/cli_hansol?tab=journal',
  '/ops/clients/cli_hansol?tab=files',
  '/ops/clients/cli_long_3',
  '/ops/calendar',
  '/ops/inbox',
  '/ops/agents',
  '/journal',
  '/sales/board',
  '/sales/meeting?client=cli_long_3&round=2',
  '/sales/meeting?client=cli_long_1&round=1',
  '/sales/proposal?client=cli_long_4',
  '/sales/new',
  '/tools/tax',
  '/settings',
]

/** 브라우저 안에서 도는 검사기 */
const DETECTOR = `(() => {
  const vw = document.documentElement.clientWidth
  const isStrip = (x) => { const cs = getComputedStyle(x); return cs.display.includes('flex') && cs.flexDirection.startsWith('row') && cs.flexWrap === 'nowrap' }
  // 일부러 옆으로 미는 줄 — 가로 스크롤 조상이 있고, 표 · 그림을 품었거나 한 줄 flex
  const scroller = (el) => {
    for (let a = el.parentElement; a; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return a
    }
    return null
  }
  const clipper = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return null
      if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') return a
    }
    return null
  }
  const ellipsis = (el) => {
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).textOverflow === 'ellipsis') return true
    }
    return false
  }
  const out = []
  const seen = new Set()
  for (const el of document.body.querySelectorAll('input,select,textarea,button,a,span,p,div,td,th,h1,h2,h3,h4,label,dd,dt,li,strong')) {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (el.closest('aside,[aria-hidden="true"],.sr-only,[data-real-skip]')) continue
    if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).position === 'fixed') continue
    const own = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own) continue
    const sc = scroller(el)
    const label = el.tagName.toLowerCase() + ' "' + (el.innerText || el.placeholder || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 24) + '"'
    if (!sc && (r.right > vw + 2 || r.left < -2)) {
      if (!seen.has(label)) { seen.add(label); out.push('화면 밖 ' + label + ' right=' + Math.round(r.right)) }
      continue
    }
    const cl = clipper(el)
    if (cl && !ellipsis(el)) {
      const c = cl.getBoundingClientRect()
      if (r.right > c.right + 2 || r.left < c.left - 2) {
        if (!seen.has(label)) { seen.add(label); out.push('잘림 ' + label + ' ' + Math.round(r.right) + '>' + Math.round(c.right)) }
      }
    }
  }
  return {
    sw: document.documentElement.scrollWidth,
    cw: vw,
    err: !!document.querySelector('[data-testid="screen-error"]'),
    out,
  }
})()`

const VIEWPORTS = [
  { tag: '360', width: 360 },
  { tag: '390', width: 390 },
  { tag: '430', width: 430 },
  { tag: '360 아주 큰 글자', width: 360, scale: 'extra_large' },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: 800 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(LONG_DATA)
  if (vp.scale) await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.scale)
  for (const path of SCREENS) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    if (vp.scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), vp.scale)
    await page.waitForTimeout(500)
    const r = await page.evaluate(DETECTOR)
    check(`[${vp.tag}] ${path}: 옆으로 넘치지 않음 · 오류 없음`, r.sw <= r.cw + 1 && !r.err, `${r.sw}/${r.cw}${r.err ? ' 화면 오류' : ''}`)
    check(`[${vp.tag}] ${path}: 잘린 글자 없음`, r.out.length === 0, r.out.slice(0, 5).join(' | '))
  }
  check(`[${vp.tag}] JS 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}
await browser.close()
console.log(`\n실제 데이터: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
