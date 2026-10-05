/**
 * 지원사업 매칭 시험 (D-141).
 *  - 마감 표시(오늘 · 내일 · 이번주 · D-N · 선착순 · 상시 · 접수 전 · 마감)
 *  - 조건 하나하나: 지역 · 업력 · 업종 · 직원 · 매출 · 규모 · 청년 · 여성 · 인증 — 맞음 / 안 맞음 / 확인 필요
 *  - 구간(가망고객 칩) — 걸치면 '확인 필요'. 구간을 좁혀도 판정이 뒤집히지 않는다(무작위 시험)
 *  - 업체 기록 → 조건(계약 고객 · 잠재고객 같은 길) · 공고문 붙여넣기 · 기업마당 파일 · 문구 · 링크
 * 실행: npm run test:grants
 */
import { normalizeClientOps } from '../clientOpsService'
import {
  EMPTY_PROFILE,
  NO_RULES,
  OPEN_TOP,
  deadlineOf,
  exact,
  inRegion,
  matchGrant,
  matchesFor,
  normalizeNotice,
  placeOf,
  rulesText,
  type CompanyProfile,
  type GrantNotice,
  type GrantRules,
  type Range,
} from '../grants/grantMatch'
import { missingForMatch, profileOfRecord } from '../grants/grantProfile'
import {
  EMPLOYEE_CHIPS,
  REVENUE_CHIPS,
  YEARS_CHIPS,
  categoryOf,
  noticeMessage,
  parseBizinfoJson,
  parseNoticeText,
  periodOf,
  profileFromQuery,
  profileToQuery,
  shareMessage,
} from '../grants/grantText'
import { exampleNotices } from '../grants/grantExamples'
import { alertPayload, publicPayload, sameNotice, validateAlert, type AlertRequest } from '../grants/grantStore'
import { mergeNotices, noticesFromFeed, slotOf } from '../grants/grantFeed'
import { withAgencyRegion } from '../grants/grantText'
import { clientsForNotice, fitSummary, grantClients, grantIndex } from '../grants/grantView'
import { applicationBoard, applyDocViews, applyDocsFor, applyReadiness, applyStage, docIdentity, grantDocRequestMessage, openApplications, portalRequestTitles, successFeeAmount, withApplyDocDone, withApplyResult, withApplySubmitted, withGrantApplication, withResultDueDate, withSuccessFee } from '../grants/grantApply'
import { documentsOf } from '../grants/grantText'
import { buildClientSchedule } from '../clientOpsSchedule'
import { recommendNextSteps } from '../clientInsights'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass += 1
  else {
    fail += 1
    console.log('FAIL', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const TODAY = '2026-10-01' // 목요일

function notice(rules: Partial<GrantRules> = {}, over: Partial<GrantNotice> = {}): GrantNotice {
  return {
    id: 'n1',
    title: '시험 공고',
    agency: '중소벤처기업부',
    operator: '',
    category: 'money',
    applyStart: '',
    applyEnd: '2026-10-20',
    deadlineKind: 'date',
    amountText: '',
    target: '',
    summary: '',
    url: '',
    rules: { ...NO_RULES, ...rules },
    source: 'manual',
    published: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}
const prof = (p: Partial<CompanyProfile>): CompanyProfile => ({ ...EMPTY_PROFILE, ...p })
/** D-143: 판정 시험의 기본 업체 — 지역 · 업력 · 업종을 아는 업체(맞춤 판정의 최소 조건) */
const BASE: Partial<CompanyProfile> = { sido: '경기', city: '파주시', industry: '제조업', years: exact(3) }
const verdictOf = (rules: Partial<GrantRules>, p: Partial<CompanyProfile>) => matchGrant(notice(rules), prof({ ...BASE, ...p }), TODAY).verdict

/* ---------------- 마감 ---------------- */
{
  const d = (applyEnd: string, kind: GrantNotice['deadlineKind'] = 'date', applyStart = '') => deadlineOf({ applyEnd, deadlineKind: kind, applyStart }, TODAY)
  check('마감: 오늘', d('2026-10-01').label === '오늘 마감' && d('2026-10-01').urgent)
  check('마감: 내일', d('2026-10-02').label === '내일 마감')
  check('마감: 이번주(일요일까지)', d('2026-10-04').label === '이번주 마감' && d('2026-10-04').state === 'week', d('2026-10-04'))
  check('마감: 다음 주 월요일은 D-5', d('2026-10-06').label === 'D-5' && d('2026-10-06').urgent)
  check('마감: 8일 뒤는 급하지 않음', d('2026-10-09').label === 'D-8' && !d('2026-10-09').urgent)
  check('마감: 한 달 넘으면 날짜', d('2026-11-15').label === '11월 15일 마감')
  check('마감: 어제 마감은 닫힘', d('2026-09-30').state === 'closed' && !d('2026-09-30').open)
  check('마감: 선착순', d('2026-10-20', 'first_come').label === '선착순 마감' && d('2026-10-20', 'first_come').open)
  check('마감: 선착순인데 날짜가 지났으면 닫힘', d('2026-09-20', 'first_come').state === 'closed')
  check('마감: 상시', d('', 'always').label === '상시 접수')
  check('마감: 접수 전', d('2026-10-30', 'date', '2026-10-05').label === '10월 5일 접수 시작' && !d('2026-10-30', 'date', '2026-10-05').open)
  check('마감: 날짜 모름은 확인 필요', d('').label === '마감일 확인 필요' && d('').open)
  // 일요일에 보면 이번주는 오늘만
  check('마감: 일요일 기준 다음날은 내일', deadlineOf({ applyEnd: '2026-10-05', deadlineKind: 'date', applyStart: '' }, '2026-10-04').label === '내일 마감')
  check('마감: 일요일 기준 이틀 뒤는 D-2', deadlineOf({ applyEnd: '2026-10-06', deadlineKind: 'date', applyStart: '' }, '2026-10-04').label === 'D-2')
}

/* ---------------- 조건 하나하나 ---------------- */
{
  check('지역: 아무 조건 없는 공고는 맞춤이 아니라 전국 공통', verdictOf({}, {}) === 'general')
  check('지역: 경기 공고 · 경기 업체', verdictOf({ regions: ['경기'] }, { sido: '경기' }) === 'fit')
  check('지역: 경기 공고 · 서울 업체 = 안 맞음', verdictOf({ regions: ['경기'] }, { sido: '서울' }) === 'no')
  check('지역: 주소 모름 = 확인 필요(지우지 않는다)', verdictOf({ regions: ['경기'] }, { sido: '', city: '' }) === 'check')
  check('지역: 파주시 공고 · 파주 업체', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기', city: '파주시' }) === 'fit')
  check('지역: 파주시 공고 · 고양 업체 = 안 맞음', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기', city: '고양시' }) === 'no')
  check('지역: 파주시 공고 · 시군구 모름 = 확인', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기', city: '' }) === 'check')

  check('업력: 창업 7년 이내 · 만 6년 = 맞음', verdictOf({ withinYears: 7 }, { years: exact(6) }) === 'fit')
  check('업력: 창업 7년 이내 · 만 7년 = 안 맞음', verdictOf({ withinYears: 7 }, { years: exact(7) }) === 'no')
  check('업력: 칩 3~7년(만 3~6) · 7년 이내 = 맞음', verdictOf({ withinYears: 7 }, { years: YEARS_CHIPS[2].range }) === 'fit')
  check('업력: 칩 3~7년 · 5년 이내 = 확인 필요(걸침)', verdictOf({ withinYears: 5 }, { years: YEARS_CHIPS[2].range }) === 'check')
  check('업력: 칩 7년 이상 · 7년 이내 = 안 맞음', verdictOf({ withinYears: 7 }, { years: YEARS_CHIPS[3].range }) === 'no')
  check('업력: 칩 1~3년 · 3년 이내 = 맞음', verdictOf({ withinYears: 3 }, { years: YEARS_CHIPS[1].range }) === 'fit')
  check('업력: 3년 이상 · 만 3년 = 맞음', verdictOf({ minYears: 3 }, { years: exact(3) }) === 'fit')
  check('업력: 3년 이상 · 만 2년 = 안 맞음', verdictOf({ minYears: 3 }, { years: exact(2) }) === 'no')
  check('업력: 모름 = 확인', verdictOf({ withinYears: 7 }, { years: null }) === 'check')

  check('업종: 제조 공고 · 금속 가공 = 맞음(다른 말)', verdictOf({ industries: ['제조'] }, { industry: '금속 가공' }) === 'fit')
  check('업종: 정보통신 공고 · 소프트웨어 개발 = 맞음', verdictOf({ industries: ['정보통신'] }, { industry: '응용 소프트웨어 개발' }) === 'fit')
  check('업종: 제조 공고 · 음식점 = 안 맞음(업종 갈래가 분명히 다름)', verdictOf({ industries: ['제조'] }, { industry: '한식 음식점' }) === 'no')
  check('업종: 정보통신 공고 · 소프트웨어 개발 = 맞음(같은 갈래 다른 말)', verdictOf({ industries: ['정보통신'] }, { industry: '응용 소프트웨어 개발' }) === 'fit')
  check('업종: 제조 공고 · 업종 글을 못 알아봄 = 확인 필요', verdictOf({ industries: ['제조'] }, { industry: '기타 개인 서비스' }) === 'check')
  check('업종: 음식·숙박 제외 · 음식점 = 안 맞음', verdictOf({ excludeIndustries: ['음식점'] }, { industry: '한식 음식점' }) === 'no')

  check('직원: 5명 이상 · 12명', verdictOf({ minEmployees: 5 }, { employees: exact(12) }) === 'fit')
  check('직원: 5명 이상 · 3명 = 안 맞음', verdictOf({ minEmployees: 5 }, { employees: exact(3) }) === 'no')
  check('직원: 5명 이상 · 칩 1~4명 = 안 맞음', verdictOf({ minEmployees: 5 }, { employees: EMPLOYEE_CHIPS[0].range }) === 'no')
  check('직원: 10명 이상 · 칩 5~9명 = 안 맞음', verdictOf({ minEmployees: 10 }, { employees: EMPLOYEE_CHIPS[1].range }) === 'no')
  check('직원: 7명 이상 · 칩 5~9명 = 확인', verdictOf({ minEmployees: 7 }, { employees: EMPLOYEE_CHIPS[1].range }) === 'check')

  check('매출: 50억 이하 · 12억 = 맞음', verdictOf({ maxRevenueM: 5000 }, { revenueM: exact(1200) }) === 'fit')
  check('매출: 50억 이하 · 칩 50억 이상 = 걸침이면 확인', verdictOf({ maxRevenueM: 5000 }, { revenueM: REVENUE_CHIPS[3].range }) === 'check')
  check('매출: 10억 이상 · 칩 1억 미만 = 안 맞음', verdictOf({ minRevenueM: 1000 }, { revenueM: REVENUE_CHIPS[0].range }) === 'no')

  check('규모: 소상공인 · 서비스 3명 = 맞음', verdictOf({ sizes: ['micro'] }, { employees: exact(3), industry: '컨설팅' }) === 'fit')
  check('규모: 소상공인 · 서비스 7명 = 안 맞음', verdictOf({ sizes: ['micro'] }, { employees: exact(7), industry: '컨설팅' }) === 'no')
  check('규모: 소상공인 · 제조 7명 = 맞음(10명 미만)', verdictOf({ sizes: ['micro'] }, { employees: exact(7), industry: '제조' }) === 'fit')
  check('규모: 중소기업만 거는 공고 = 전국 공통(거의 모두라 맞춤으로 안 셈)', verdictOf({ sizes: ['small'] }, {}) === 'general')

  check('청년: 만 39세 · 맞음', verdictOf({ youthCeo: true }, { ceoAge: exact(39) }) === 'fit')
  check('청년: 만 40세 · 안 맞음', verdictOf({ youthCeo: true }, { ceoAge: exact(40) }) === 'no')
  check('청년: 나이 모름 = 확인', verdictOf({ youthCeo: true }, { ceoAge: null }) === 'check')
  check('여성: 여성 대표', verdictOf({ womenCeo: true }, { female: true }) === 'fit' && verdictOf({ womenCeo: true }, { female: false }) === 'no' && verdictOf({ womenCeo: true }, { female: null }) === 'check')
  check('인증: 벤처 있음', verdictOf({ certs: ['venture', 'innobiz'] }, { certs: ['venture'], certsKnown: true }) === 'fit')
  check('인증: 인증 글이 있는데 해당 없음 = 안 맞음', verdictOf({ certs: ['venture'] }, { certs: ['lab'], certsKnown: true }) === 'no')
  check('인증: 인증을 모름 = 확인', verdictOf({ certs: ['venture'] }, { certsKnown: false, certs: [] }) === 'check')

  const m = matchGrant(notice({ regions: ['경기'], withinYears: 7, minEmployees: 5 }), prof({ sido: '경기', city: '파주시', years: exact(3) }), TODAY)
  check('이유: 조건마다 한 줄씩', m.reasons.length === 3 && m.reasons.map((r) => r.key).join() === 'region,years,employees', m.reasons)
  check('이유: 확인 필요 1개(직원 수)', m.unknownCount === 1 && m.verdict === 'check' && /직원 수를 적으면/.test(m.reasons[2].text))
  check('이유: 업력 글', /창업 7년 이내 — 업력 3년\(4년 차\)/.test(m.reasons[1].text), m.reasons[1].text)
}

/* ---------------- 목록 ---------------- */
{
  const p = prof({ sido: '경기', city: '파주시', industry: '제조', years: exact(3), employees: exact(12) })
  const list = [
    notice({}, { id: 'a', title: '가 전국 D-10', applyEnd: '2026-10-11' }),
    notice({}, { id: 'b', title: '나 전국 오늘', applyEnd: '2026-10-01' }),
    notice({ regions: ['서울'] }, { id: 'c', title: '다 서울', applyEnd: '2026-10-01' }),
    notice({ youthCeo: true }, { id: 'd', title: '라 청년(확인)', applyEnd: '2026-10-01' }),
    notice({}, { id: 'e', title: '마 마감', applyEnd: '2026-09-01' }),
    notice({}, { id: 'f', title: '바 상시', applyEnd: '', deadlineKind: 'always' }),
    notice({}, { id: 'g', title: '사 접수 전', applyStart: '2026-10-10', applyEnd: '2026-10-30' }),
  ]
  const ms = matchesFor(list, p, TODAY)
  check('목록: 안 맞음 · 마감 · 접수 전은 빠짐 · 확인 필요 먼저 · 전국 공통은 마감 순으로 뒤', ms.map((x) => x.notice.id).join() === 'd,b,a,f', ms.map((x) => x.notice.id))
  check('목록: 접수 전 포함 옵션', matchesFor(list, p, TODAY, { includeUpcoming: true }).some((x) => x.notice.id === 'g'))
  check('목록: 안 맞음 포함 옵션', matchesFor(list, p, TODAY, { includeNo: true }).some((x) => x.notice.id === 'c'))
  check('지역 거르기: 서울 공고는 경기에서 안 보임 · 전국은 보임', !inRegion(list[2], '경기', '') && inRegion(list[0], '경기', '파주시') && inRegion(list[2], '', ''))
}

/* ---------------- 무작위: 구간을 좁혀도 판정이 뒤집히지 않는다 ---------------- */
{
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const randRange = (chips: Range[]): Range => pick(chips)
  const inside = (r: Range): Range => {
    const hi = Math.min(r.hi, r.lo + 60)
    const v = r.lo + Math.floor(rnd() * (hi - r.lo + 1))
    return exact(v)
  }
  let flips = 0
  let tried = 0
  for (let i = 0; i < 2000; i++) {
    const rules: Partial<GrantRules> = {
      withinYears: rnd() < 0.5 ? pick([3, 5, 7, 10]) : null,
      minYears: rnd() < 0.2 ? pick([1, 2, 3]) : null,
      minEmployees: rnd() < 0.3 ? pick([1, 5, 10]) : null,
      maxEmployees: rnd() < 0.2 ? pick([9, 49, 299]) : null,
      maxRevenueM: rnd() < 0.3 ? pick([1000, 5000, 12000]) : null,
      minRevenueM: rnd() < 0.2 ? pick([100, 1000]) : null,
      youthCeo: rnd() < 0.2,
    }
    const wide = prof({
      sido: '경기',
      industry: '제조업',
      years: randRange(YEARS_CHIPS.map((c) => c.range)),
      employees: randRange(EMPLOYEE_CHIPS.map((c) => c.range)),
      revenueM: randRange(REVENUE_CHIPS.map((c) => c.range)),
      ceoAge: rnd() < 0.5 ? { lo: 0, hi: 39 } : { lo: 40, hi: OPEN_TOP },
    })
    const narrow = prof({
      sido: '경기',
      industry: '제조업',
      years: inside(wide.years as Range),
      employees: inside(wide.employees as Range),
      revenueM: inside(wide.revenueM as Range),
      ceoAge: inside((wide.ceoAge as Range).lo === 0 ? { lo: 20, hi: 39 } : { lo: 40, hi: 80 }),
    })
    const a = matchGrant(notice(rules), wide, TODAY).verdict
    const b = matchGrant(notice(rules), narrow, TODAY).verdict
    tried += 1
    // 구간이 맞음/안 맞음이면 그 안의 정확한 값도 같아야 한다. 확인 필요만 정확한 값에서 풀린다
    if ((a === 'fit' && b !== 'fit') || (a === 'no' && b !== 'no')) flips += 1
    if (b === 'check') flips += 1 // 정확한 값만 있으면 숫자 조건은 모두 판정된다
  }
  check(`무작위 ${tried}건: 구간 → 정확한 값에서 판정 뒤집힘 0 · 숫자 조건 확인 필요 0`, flips === 0, flips)
}

/* ---------------- 업체 기록 → 조건 ---------------- */
{
  const rec = normalizeClientOps({
    id: 'c1',
    companyName: '(주)한빛정밀',
    businessAddress: '경기도 파주시 문산읍 돈유1로 12',
    industry: '제조업',
    businessItem: '금속 가공',
    establishedAt: '2023.03.01',
    employeeCount: '12명(대표 포함)',
    representativeBirth: '1990-05-05',
    representativeGender: 'female',
    factValues: { revenue: '1200000000', certifications: '벤처기업 확인(2025)' },
    status: 'active',
  } as never)
  const p = profileOfRecord(rec, TODAY)
  check('업체 → 지역', p.sido === '경기' && p.city === '파주시', p)
  check('업체 → 업종 이어 붙임', p.industry === '제조업 · 금속 가공', p.industry)
  check('업체 → 업력 만 3년', p.years?.lo === 3 && p.years?.hi === 3)
  check('업체 → 직원 12', p.employees?.lo === 12)
  check('업체 → 매출 1,200백만원', p.revenueM?.lo === 1200)
  check('업체 → 대표 36세 · 여성', p.ceoAge?.lo === 36 && p.female === true)
  check('업체 → 벤처 인증', p.certs.includes('venture') && p.certsKnown)
  check('업체 → 빈 칸 없음', missingForMatch(p).length === 0, missingForMatch(p))

  const empty = profileOfRecord(normalizeClientOps({ id: 'c2', companyName: '빈 업체', status: 'waiting' } as never), TODAY)
  check('빈 업체 → 모두 모름', missingForMatch(empty).join() === '회사 주소,업종,설립일,직원 수,매출' && !empty.certsKnown && empty.female === null)

  // 가망고객이 공개 화면에서 고른 구간 — 업체 기록에 값이 없을 때만
  const q = profileToQuery(prof({ name: '새봄식품', sido: '전북', city: '전주시', industry: '식품 제조', years: YEARS_CHIPS[1].range, employees: EMPLOYEE_CHIPS[1].range }))
  const lead = normalizeClientOps({ id: 'c3', companyName: '새봄식품', status: 'waiting', employeeCount: '7', sales: { stage: 'lead', source: '지원사업 찾기', referrer: '', interests: [], concern: '', expectedFee: null, history: [], movedAt: '', grantQuery: q } } as never)
  const lp = profileOfRecord(lead, TODAY)
  check('잠재고객: 고른 지역 · 업종 · 업력 구간을 쓴다', lp.sido === '전북' && lp.city === '전주시' && lp.industry === '식품 제조' && lp.years?.lo === 1 && lp.years?.hi === 2, lp)
  check('잠재고객: 업체 기록 값(직원 7)이 구간보다 먼저', lp.employees?.lo === 7 && lp.employees?.hi === 7)
  check('잠재고객: grantQuery 저장 유지(normalize)', lead.sales?.grantQuery === q)

  check('주소: 서울특별시 강남구', placeOf('서울특별시 강남구 테헤란로 1').sido === '서울' && placeOf('서울특별시 강남구 테헤란로 1').city === '강남구')
  check('주소: 세종은 시군구 없음', placeOf('세종특별자치시 한누리대로 1').sido === '세종' && placeOf('세종특별자치시 한누리대로 1').city === '')
  check('주소: 전북특별자치도 · 충청남도', placeOf('전북특별자치도 전주시 완산구').sido === '전북' && placeOf('충청남도 천안시 동남구').sido === '충남')
  check('주소: 못 읽으면 빈칸', placeOf('알 수 없는 곳').sido === '')
}

/* ---------------- 링크 왕복 ---------------- */
{
  const p = prof({ name: '한빛정밀', sido: '경기', city: '파주시', industry: '제조업', years: exact(3), employees: exact(12), revenueM: exact(1200), ceoAge: exact(36), female: false, certs: ['venture'], certsKnown: true })
  const q = profileToQuery(p, { from: 'kim' })
  const back = profileFromQuery(`?${q}`)
  check('링크: 회사 · 지역 · 업종 · 구간 왕복', back.name === '한빛정밀' && back.sido === '경기' && back.city === '파주시' && back.industry === '제조업' && back.years?.lo === 3 && back.employees?.lo === 12 && back.revenueM?.lo === 1200, back)
  check('링크: 나이는 청년 여부만(정확한 나이 안 보냄)', back.ceoAge?.lo === 0 && back.ceoAge?.hi === 39 && !q.includes('36'))
  check('링크: 인증 · 성별', back.certs.join() === 'venture' && back.certsKnown && back.female === false)
  check('링크: 연락처 · 사업자번호 칸이 없다', !/phone|tel|bizNo|010/.test(q))
  check('링크: 이상한 지역은 버림', profileFromQuery('r=화성&c=동탄').sido === '' && profileFromQuery('r=화성&c=동탄').city === '')
  check('링크: 이상한 구간은 버림', profileFromQuery('y=abc&e=9-3').years === null && profileFromQuery('y=abc&e=9-3').employees === null)
  const open = profileFromQuery(profileToQuery(prof({ years: { lo: 7, hi: OPEN_TOP } })))
  check('링크: 위가 열린 구간', open.years?.lo === 7 && (open.years?.hi ?? 0) >= OPEN_TOP)
  check('링크: 인증 없음(-)도 알고 있음', profileFromQuery(profileToQuery(prof({ certsKnown: true }))).certsKnown)
}

/* ---------------- 공고문 붙여넣기 ---------------- */
{
  const text = `[경기] 2026년 파주시 중소기업 스마트공장 구축 지원사업 공고
소관부처·지자체 경기도 파주시
사업수행기관 파주시 기업지원과
신청기간 2026.10.05 ~ 2026.10.23
사업개요 제조 현장 자동화 설비 도입 비용을 지원합니다. 기업당 최대 5,000만원 이내
지원대상 파주시 소재 제조업 중소기업 (창업 7년 이내, 상시 근로자 5명 이상)
문의처 031-000-0000
https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000000001`
  const d = parseNoticeText(text)
  check('붙여넣기: 공고명', d.title.startsWith('[경기] 2026년 파주시 중소기업 스마트공장'), d.title)
  check('붙여넣기: 소관 · 수행', d.agency === '경기도 파주시' && d.operator === '파주시 기업지원과', [d.agency, d.operator])
  check('붙여넣기: 신청기간', d.applyStart === '2026-10-05' && d.applyEnd === '2026-10-23' && d.deadlineKind === 'date', [d.applyStart, d.applyEnd])
  check('붙여넣기: 지역(머리 [경기] + 파주시 소재)', d.rules.regions.join() === '경기' && d.rules.cities.join() === '파주시', d.rules)
  check('붙여넣기: 업종 · 규모 · 업력 · 직원', d.rules.industries.includes('제조') && d.rules.sizes.includes('small') && d.rules.withinYears === 7 && d.rules.minEmployees === 5, d.rules)
  check('붙여넣기: 지원 금액 글', /최대 5,000만원/.test(d.amountText), d.amountText)
  check('붙여넣기: 링크', d.url.startsWith('https://www.bizinfo.go.kr/'))
  check('붙여넣기: 지원대상에 링크 줄이 섞이지 않음', !d.target.includes('http') && d.target.startsWith('파주시 소재'), d.target)
  check('붙여넣기: 갈래 = 개발(스마트공장)', d.category === 'rnd', d.category)
  check('붙여넣기: 청년 조건 없음', d.rules.youthCeo === false && d.rules.womenCeo === false)
  check('붙여넣기: 조건 글', rulesText(d.rules).join(' / ') === '경기 파주시 / 창업 7년 이내 / 제조 업종 / 직원 5명 이상 / 중소기업', rulesText(d.rules))

  const t2 = parseNoticeText(`공고명: 2026년 청년 창업기업 판로 지원
주관기관: 창업진흥원
접수기간: 예산 소진 시까지(선착순)
지원대상: 대표자 만 39세 이하 청년 창업기업, 매출액 10억원 미만`)
  check('붙여넣기 2: 선착순', t2.deadlineKind === 'first_come' && t2.applyEnd === '', t2)
  check('붙여넣기 2: 청년 · 매출 10억 미만', t2.rules.youthCeo && t2.rules.maxRevenueM === 999, t2.rules)
  check('붙여넣기 2: 갈래 = 마케팅(판로)', t2.category === 'marketing', t2.category)
  check('붙여넣기 2: 소관', t2.agency === '창업진흥원')

  const t3 = parseNoticeText('2026 일·생활 균형 컨설팅 참여기업 모집\n신청기간: 상시 접수')
  check('붙여넣기 3: 상시', t3.deadlineKind === 'always' && t3.category === 'hr', t3)
  const t4 = parseNoticeText('수출 바우처 추가 모집 공고\n~ 2026년 10월 15일 18:00까지 접수')
  check('붙여넣기 4: 신청기간 줄 없이 ~ 날짜', t4.applyEnd === '2026-10-15' && t4.category === 'export', t4)
  check('붙여넣기: 빈 글이면 빈 제목(저장하지 않는다)', parseNoticeText('   ').title === '')
}

/* ---------------- 기간 · 갈래 ---------------- */
{
  check('기간: 20260901 ~ 20260930', periodOf('20260901 ~ 20260930').applyEnd === '2026-09-30' && periodOf('20260901 ~ 20260930').applyStart === '2026-09-01')
  check('기간: 2026년 9월 1일 ~ 2026년 9월 30일', periodOf('2026년 9월 1일 ~ 2026년 9월 30일').applyEnd === '2026-09-30')
  check('기간: 없는 날짜(13월 · 2월 31일)는 버림', periodOf('2026.13.40 ~ 2026.02.31').applyEnd === '' && periodOf('2026.13.40 ~ 2026.02.31').applyStart === '')
  check('기간: 앞 날짜가 틀리면 뒤 날짜만 마감으로', periodOf('2026.13.40 ~ 2026.10.31').applyEnd === '2026-10-31')
  check('기간: 시작일만', periodOf('2026.10.10 부터').applyStart === '2026-10-10' && periodOf('2026.10.10 부터').applyEnd === '')
  check('갈래: 제목 먼저', categoryOf('수출기업 인력 채용 지원') === 'export' && categoryOf('경영안정자금 융자') === 'money' && categoryOf('알 수 없는 공고') === 'etc')
}

/* ---------------- 기업마당 파일 ---------------- */
{
  const json = JSON.stringify({
    jsonArray: [
      {
        pblancId: 'PBLN_1',
        pblancNm: '[전북] 2026년 전주시 소상공인 경영안정자금 지원',
        jrsdInsttNm: '전북특별자치도 전주시',
        excInsttNm: '전주시',
        reqstBeginEndDe: '20261001 ~ 20261031',
        pldirSportRealmLclasCodeNm: '금융',
        trgetNm: '소상공인',
        bsnsSumryCn: '<p>전주시 소재 소상공인에게 경영안정자금을 융자합니다.</p>',
        pblancUrl: '/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_1',
        hashtags: '금융,전북,소상공인',
      },
      { pblancNm: '2026년 기술개발 지원', jrsdInsttNm: '중소벤처기업부', reqstBeginEndDe: '예산 소진시까지', pldirSportRealmLclasCodeNm: '기술', trgetNm: '중소기업' },
      { foo: 1 },
    ],
  })
  const r = parseBizinfoJson(json)
  check('기업마당: 2건 읽고 1건 건너뜀', r.drafts.length === 2 && r.skipped === 1, r.skipped)
  const a = r.drafts[0]
  check('기업마당: 제목 · 소관 · 기간', a.title.includes('전주시 소상공인') && a.agency === '전북특별자치도 전주시' && a.applyStart === '2026-10-01' && a.applyEnd === '2026-10-31')
  check('기업마당: 지역(머리 · 해시태그 · 소재)', a.rules.regions.join() === '전북' && a.rules.cities.join() === '전주시', a.rules)
  check('기업마당: 소상공인 · 갈래 지원금', a.rules.sizes.join() === 'micro' && a.category === 'money', [a.rules.sizes, a.category])
  check('기업마당: 링크는 절대 주소로', a.url.startsWith('https://www.bizinfo.go.kr/web/'))
  check('기업마당: 요약에 HTML 태그 없음', !/<p>/.test(a.summary))
  check('기업마당: 선착순 · 분야 기술 → 개발', r.drafts[1].deadlineKind === 'first_come' && r.drafts[1].category === 'rnd', r.drafts[1])
  check('기업마당: 배열 그대로도', parseBizinfoJson(JSON.stringify([{ pblancNm: 'x 공고' }])).drafts.length === 1)
  check('기업마당: JSON 아님 → 0건', parseBizinfoJson('<html>').drafts.length === 0)
}

/* ---------------- 다듬기 · 예시 · 공개 ---------------- */
{
  const n = normalizeNotice({ title: '  시험  ', applyEnd: '2026/10/01', rules: { regions: ['경기도', '화성'], certs: ['venture', 'x'], withinYears: -3 }, source: 'example', published: true, url: 'javascript:alert(1)' }, 'id1', 'now')
  check('다듬기: 시·도 긴 이름 → 짧게 · 없는 곳은 버림', n?.rules.regions.join() === '경기', n?.rules.regions)
  check('다듬기: 날짜 모양이 아니면 빈칸', n?.applyEnd === '')
  check('다듬기: 음수 업력 · 모르는 인증 버림', n?.rules.withinYears === null && n?.rules.certs.join() === 'venture')
  check('다듬기: 예시 공고는 공개 못 함', n?.published === false)
  check('다듬기: http(s) 아닌 링크 버림', n?.url === '')
  check('다듬기: 제목 없으면 null', normalizeNotice({ title: ' ' }, 'x', 'now') === null)

  const ex = exampleNotices(TODAY)
  check('예시: 6개 · 모두 [예시] · 비공개', ex.length === 6 && ex.every((e) => e.title.startsWith('[예시]') && e.source === 'example' && !e.published))
  const exState = ex.map((e) => deadlineOf(e, TODAY).label)
  check('예시: 오늘 마감 · 이번주 · 선착순 · 상시가 다 보인다', exState.includes('오늘 마감') && exState.includes('이번주 마감') && exState.includes('선착순 마감') && exState.includes('상시 접수'), exState)
  const pp = publicPayload({ ...(normalizeNotice({ title: '공개 공고', summary: 'x'.repeat(2000), published: true }, 'p1', 'now') as GrantNotice) })
  check('공개 사본: 정해진 칸만 · 개요 600자', Object.keys(pp).sort().join() === 'agency,amountText,applyEnd,applyStart,category,deadlineKind,id,operator,published,rules,source,summary,target,title,updatedAt,url' && (pp.summary as string).length === 600)
  check('같은 공고: 띄어쓰기 · 괄호 무시', sameNotice({ title: '[경기] 스마트 공장', applyEnd: '2026-10-01' }, { title: '경기 스마트공장', applyEnd: '2026-10-01' }) && !sameNotice({ title: 'a', applyEnd: '2026-10-01' }, { title: 'a', applyEnd: '2026-10-02' }))
}

/* ---------------- 문구 ---------------- */
{
  const p = prof({ name: '한빛정밀', sido: '경기', city: '파주시', industry: '제조', years: exact(3), employees: exact(12) })
  const list = exampleNotices(TODAY).map((e, i) => ({ ...e, id: `e${i}`, createdAt: '', updatedAt: '' })) as GrantNotice[]
  const ms = matchesFor(list, p, TODAY)
  const msg = shareMessage({ companyName: '한빛정밀', profileLine: '경기 파주시 · 제조 · 업력 3년', matches: ms, link: 'https://x.test/grants/find?r=경기', sender: '미래AI랩' })
  check('문구: 회사 · 조건 · 건수 · 링크', /한빛정밀 대표님/.test(msg) && /경기 파주시/.test(msg) && /조건이 맞는 사업 \d+건/.test(msg) && msg.includes('https://x.test/grants/find'), msg)
  check('문구: 서울 소상공인 공고는 없음', !msg.includes('서울 소상공인'))
  check('문구: 맞춤(경기 북부 제조) 공고가 맨 위 · 전국 공통은 안 넣음', msg.split('\n').find((l) => l.startsWith('· '))?.includes('경기 북부') === true && !msg.includes('지역 중소기업 AI'), msg)
  const one = noticeMessage({ companyName: '한빛정밀', match: ms[0], sender: '미래AI랩' })
  check('공고 한 통: 제목 · 마감', one.includes(ms[0].notice.title) && one.includes('마감:'), one)
  check('공고 한 통: 빈 줄이 겹치지 않음', !/\n\n\n/.test(one))
}

/* ---------------- 알림 신청 ---------------- */
{
  const base: AlertRequest = { companyName: '새봄식품', name: '정새봄', phone: '010-1234-5678', email: '', industry: '식품 제조', conditions: '전북 전주시 · 식품 제조 · 1~3년', query: 'r=전북', titles: ['가', '나', '다', '라', '마', '바'], fitCount: 6, from: '', consent: true }
  check('신청: 정상', validateAlert(base) === '')
  check('신청: 회사 이름 필수', validateAlert({ ...base, companyName: ' ' }) !== '')
  check('신청: 연락처 하나는 필수', validateAlert({ ...base, phone: '', email: '' }) !== '')
  check('신청: 이상한 번호', validateAlert({ ...base, phone: 'abc' }) !== '')
  check('신청: 동의 필수', validateAlert({ ...base, consent: false }) !== '')
  const pl = alertPayload(base)
  check('신청: 상담신청함이 읽는 칸 이름', pl.company_name === '새봄식품' && pl.representative_name === '정새봄' && pl.phone === '010-1234-5678' && pl.industry === '식품 제조')
  check('신청: 문의 글에 조건 · 건수 · 공고 3개', /지원사업 알림 신청 — 전북 전주시/.test(pl.message as string) && /맞는 공고 6건/.test(pl.message as string) && (pl.message as string).length <= 300)
  check('신청: 공고 제목 5개까지', (pl.grant_titles as string[]).length === 5)
  check('신청: 주민번호 · 비밀번호 칸 없음', !Object.keys(pl).some((k) => /rrn|resident|password|secret/i.test(k)))
}

/* ---------------- D-143: 맞춤은 겨냥한 공고만 · 기업마당 ---------------- */
{
  const full = prof(BASE)
  const m1 = matchGrant(notice({ regions: ['경기'] }), prof({ ...BASE, industry: '' }), TODAY)
  check('맞춤: 겨냥한 공고인데 업종 모르면 확인 필요 · 이유에 업체 정보', m1.verdict === 'check' && m1.reasons.some((r) => r.key === 'profile' && /업종/.test(r.text)), m1.reasons)
  check('맞춤: 아무 조건 없는 공고는 업체 정보가 비어도 전국 공통', matchGrant(notice({}), prof({}), TODAY).verdict === 'general')
  check('맞춤: 중소벤처기업부 전국 공고(조건 없음) 1,000건이 다 맞춤으로 뜨지 않는다', matchesFor(Array.from({ length: 50 }, (_, i) => notice({}, { id: `g${i}`, title: `공고 ${i}` })), full, TODAY).every((m) => m.verdict === 'general'))
  check('예비창업자 전용 = 안 맞음', matchGrant(notice({ preStartupOnly: true }), full, TODAY).verdict === 'no')
  const pre = parseNoticeText('2026 예비창업패키지 모집\n지원대상 예비창업자(공고일 기준 사업자 등록이 없는 자)')
  check('읽기: 예비창업자 전용', pre.rules.preStartupOnly === true, pre.rules)
  const mixed = parseNoticeText('2026 창업 지원\n지원대상 예비창업자 및 창업 3년 이내 기업')
  check('읽기: 예비창업자 + 기업이면 전용 아님', mixed.rules.preStartupOnly === false && mixed.rules.withinYears === 3, mixed.rules)
  check('소관 지자체 → 지역: 경기도 파주시', JSON.stringify(withAgencyRegion({ ...NO_RULES, regions: [], cities: [] }, '경기도 파주시')) === JSON.stringify({ ...NO_RULES, regions: ['경기'], cities: ['파주시'] }))
  check('소관 중앙부처 → 전국 그대로', withAgencyRegion({ ...NO_RULES, regions: [], cities: [] }, '중소벤처기업부').regions.length === 0)
  check('소관: 이미 지역 조건 있으면 그대로', withAgencyRegion({ ...NO_RULES, regions: ['서울'], cities: [] }, '경기도').regions.join() === '서울')
  const feed = noticesFromFeed(
    [
      { pblancId: 'PBLN_9', pblancNm: '2026 부산 제조혁신 바우처', jrsdInsttNm: '부산광역시', reqstBeginEndDe: '20261001 ~ 20261031', trgetNm: '중소기업', hashtags: '제조,부산' },
      { pblancId: 'PBLN_10', pblancNm: '2026 수출 첫걸음', jrsdInsttNm: '중소벤처기업부', reqstBeginEndDe: '예산 소진시까지', trgetNm: '중소기업' },
    ],
    '2026-10-02T00:00:00Z',
  )
  check('기업마당: id 는 공고 번호로 고정 · 공개 · 출처', feed[0].id === 'biz_PBLN_9' && feed[0].published && feed[0].source === 'bizinfo' && feed[0].externalId === 'PBLN_9')
  check('기업마당: 지자체 공고 → 부산 · 해시태그 제조 → 업종', feed[0].rules.regions.join() === '부산' && feed[0].rules.industries.includes('제조'), feed[0].rules)
  check('기업마당: 부산 공고는 경기 업체에 안 맞음 · 부산 제조 업체에 맞춤', matchGrant(feed[0], full, TODAY).verdict === 'no' && matchGrant(feed[0], prof({ ...BASE, sido: '부산', city: '해운대구' }), TODAY).verdict === 'fit')
  check('기업마당: 전국 공고(조건 없음) = 전국 공통', matchGrant(feed[1], full, TODAY).verdict === 'general')
  const manual = notice({}, { id: 'm1', title: '2026 부산 제조혁신 바우처', applyEnd: '2026-10-31' })
  const merged = mergeNotices([manual], feed)
  check('합치기: 같은 공고면 직접 넣은 것을 남김', merged.length === 2 && merged[0].id === 'm1' && merged.some((n) => n.id === 'biz_PBLN_10'))
  check('9시 칸: 한국 오전 8시 59분 = 어제 칸 · 9시 = 오늘 칸', slotOf(Date.parse('2026-10-01T23:59:00Z')) === '2026-10-01' && slotOf(Date.parse('2026-10-02T00:00:00Z')) === '2026-10-02')

  // 실제 기업마당 응답에서 본 모양(2026-10-02, 1,000건)
  const real = noticesFromFeed(
    [
      { pblancId: 'R1', pblancNm: '2026년 중소기업 정책자금 융자계획 변경 공고', jrsdInsttNm: '중소벤처기업부', reqstBeginEndDe: '예산 소진시까지', trgetNm: '중소기업', hashtags: '금융,서울,부산,대구,인천,전남,대전,울산,세종,경기,강원,충북,충남,전북,경북,경남,제주' },
      { pblancId: 'R2', pblancNm: '[경기] 안산시 2026년 소상공인 특례보증 추가 지원 계획 공고', jrsdInsttNm: '경기도', reqstBeginEndDe: '예산 소진시까지', trgetNm: '소상공인', bsnsSumryCn: '안산시 소재 소상공인', hashtags: '금융,경기,2026,경기도,안산시,소상공인' },
      { pblancId: 'R3', pblancNm: '[경기] 부천시 2026년 스타트업포럼 참가기업 모집 공고', jrsdInsttNm: '경기도', reqstBeginEndDe: '2026-10-01 ~ 2026-10-20', trgetNm: '중소기업', hashtags: '경기' },
      { pblancId: 'R4', pblancNm: '2026년 AI 실증 지원 공고', jrsdInsttNm: '전남광주통합특별시', reqstBeginEndDe: '모집 완료시', trgetNm: '중소기업', hashtags: '' },
      { pblancId: 'R5', pblancNm: '2026년 공공기술 사업화용 기술평가 지원기업 모집 공고', jrsdInsttNm: '지식재산처', reqstBeginEndDe: '2026-10-01 ~ 2026-10-31', trgetNm: '연구개발특구 소재 기업', hashtags: '창업7년이하' },
      { pblancId: 'R6', pblancNm: '[서울ㆍ경기] 2026년 ESG 컨설팅 지원 사업 공고', jrsdInsttNm: '보건복지부', reqstBeginEndDe: '2026-10-01 ~ 2026-10-31', trgetNm: '중소기업', hashtags: '' },
    ],
    '2026-10-02T00:00:00Z',
  )
  const byId = (id: string) => real.find((n) => n.id === `biz_${id}`) as GrantNotice
  check('실제: 해시태그에 시·도 17개 = 전국(지역 조건 아님) → 전국 공통', byId('R1').rules.regions.length === 0 && matchGrant(byId('R1'), full, TODAY).verdict === 'general', byId('R1').rules.regions)
  check('실제: 날짜 2026-10-01 ~ 2026-10-20(줄표)', byId('R3').applyEnd === '2026-10-20' && byId('R3').applyStart === '2026-10-01')
  check('실제: 안산시 태그 + 개요에 안산시 → 시 조건 · 파주 업체는 안 맞음', byId('R2').rules.cities.join() === '안산시' && matchGrant(byId('R2'), full, TODAY).verdict === 'no', byId('R2').rules)
  check('실제: 이름 앞 [경기] 부천시 → 부천시 조건', byId('R3').rules.cities.join() === '부천시', byId('R3').rules)
  check('실제: 전남광주통합특별시 → 전남 · 광주 둘 다', byId('R4').rules.regions.join() === '전남,광주', byId('R4').rules.regions)
  check('실제: 모집 완료시 = 선착순(예산 소진형)', byId('R4').deadlineKind === 'first_come')
  check('실제: 연구개발특구는 시·군·구 아님 · 해시태그 창업7년이하 → 업력', byId('R5').rules.cities.length === 0 && byId('R5').rules.withinYears === 7, byId('R5').rules)
  check('실제: [서울ㆍ경기] → 서울 · 경기 둘 다', byId('R6').rules.regions.join() === '서울,경기', byId('R6').rules.regions)

  // 한 번에 계산(공고 × 업체) — 화면마다 다시 계산하지 않고, 1,000건 × 300곳도 빨리
  const SIDOS = ['경기', '서울', '부산', '대구', '인천']
  const INDS = ['제조업', '소프트웨어 개발', '도소매', '한식 음식점', '건설업']
  const recs = Array.from({ length: 300 }, (_, i) =>
    normalizeClientOps({ id: `c${i}`, companyName: `업체${i}`, status: i % 3 ? 'active' : 'prospect', businessAddress: `${SIDOS[i % 5]} 어딘가시 ${i}`, industry: INDS[i % 5], establishedAt: `20${10 + (i % 15)}-03-01`, sales: i % 3 ? undefined : { stage: 'lead' } }),
  )
  const clients = grantClients(recs, TODAY)
  const big = Array.from({ length: 1000 }, (_, i) =>
    notice(i % 4 === 0 ? {} : { regions: [SIDOS[i % 5]], industries: i % 2 ? ['제조'] : [], withinYears: i % 3 ? null : 7 }, { id: `b${i}`, title: `공고 ${i}`, applyEnd: `2026-10-${String(2 + (i % 28)).padStart(2, '0')}` }),
  )
  const t0 = performance.now()
  const idx = grantIndex(big, clients, TODAY)
  const ms = performance.now() - t0
  console.log(`  index 1,000 공고 × ${clients.length} 업체: ${ms.toFixed(0)}ms`)
  check('한 번에 계산: 1,000 × 300 이 2초 안', ms < 2000, ms)
  check('한 번에 계산: 같은 목록이면 다시 계산 안 함', grantIndex(big, clients, TODAY) === idx)
  const b7 = big[7]
  check(
    '한 번에 계산 = 하나씩 계산(공고마다 맞는 업체)',
    JSON.stringify((idx.byNotice.get(b7.id) ?? []).map((x) => x.client.record.id)) === JSON.stringify(clientsForNotice(b7, clients, TODAY).map((x) => x.client.record.id)),
  )
  const c0 = clients[1]
  check(
    '한 번에 계산 = 하나씩 계산(업체마다 맞는 공고)',
    JSON.stringify((idx.byClient.get(c0.record.id) ?? []).map((m) => m.notice.id)) === JSON.stringify(matchesFor(big, c0.profile, TODAY).map((m) => m.notice.id)),
  )
  check('공고마다 맞는 업체: 전국 공통은 세지 않음', (idx.byNotice.get('b0') ?? []).length === 0)
  const sum = fitSummary(idx.byClient.get(c0.record.id) ?? [])
  check('업체 요약: 맞춤 · 전국 공통 나눠 셈', sum.general === 250 && sum.fit > 0 && sum.fit < 750, sum)
}

// D-149: 지원사업 검토로 찾은 것
{
  const prof = (o: Partial<CompanyProfile>): CompanyProfile => ({ ...EMPTY_PROFILE, years: exact(3), industry: '제조업', ...o })
  const mk = (rules: Partial<GrantRules>, title = '공고'): GrantNotice => normalizeNotice({ id: 'g', title, agency: '', applyStart: '', applyEnd: '2099-12-31', deadlineKind: 'date', url: '', summary: '', rules: { ...NO_RULES, regions: [], cities: [], industries: [], excludeIndustries: [], sizes: [], certs: [], ...rules } } as never)
  const ex = parseNoticeText('공고명: 경기 중소기업 지원\n소관 기관: 경기도\n신청 기간: 2026.10.01 ~ 2026.12.31\n지원 대상: 경기도 소재 중소기업(제조업 제외)')
  check("'(제조업 제외)' → 제조업은 빼는 조건(예전: 제조업만)", ex.rules.excludeIndustries.includes('제조') || ex.rules.excludeIndustries.some((x) => /제조/.test(x)), JSON.stringify(ex.rules))
  check("'(제조업 제외)' → 업종 '만' 조건은 없음", !ex.rules.industries.some((x) => /제조/.test(x)), JSON.stringify(ex.rules.industries))
  const gj = mk({ regions: ['경기'], cities: ['광주시'] }, '[경기] 광주시 기업 지원')
  check('경기 광주시 공고: 광주광역시 북구 업체는 안 맞음', matchGrant(gj, prof({ sido: '광주', city: '북구' }), '2026-10-03').verdict === 'no')
  check('경기 광주시 공고: 경기 수원시 업체는 안 맞음 · 경기 광주시 업체는 맞음', matchGrant(gj, prof({ sido: '경기', city: '수원시' }), '2026-10-03').verdict === 'no' && matchGrant(gj, prof({ sido: '경기', city: '광주시' }), '2026-10-03').verdict !== 'no')
  check("주소 '경기도 광주시 오포읍' → 경기 · 광주시", JSON.stringify(placeOf('경기도 광주시 오포읍 1')) === JSON.stringify({ sido: '경기', city: '광주시', sidoAlt: '' }))
  const merged = placeOf('전남광주통합특별시 북구 용봉로 1')
  check("통합 주소 '전남광주통합특별시' → 전남 · 광주 둘 다", merged.sido === '전남' && merged.sidoAlt === '광주', JSON.stringify(merged))
  check('통합 주소 업체: 광주 공고도 맞음', matchGrant(mk({ regions: ['광주'] }), prof({ sido: '전남', sidoAlt: '광주', city: '북구' }), '2026-10-03').verdict !== 'no')
  const jung = parseNoticeText('공고명: 중구 소상공인 지원\n소관 기관: 서울특별시 중구\n신청 기간: 2026.10.01 ~ 2026.12.31\n지원 대상: 중구 소재 소상공인')
  check("'중구 소재' + 소관 서울특별시 중구 → 서울 · 중구(부산 중구 업체는 안 맞음)", jung.rules.regions.includes('서울') && matchGrant({ ...mk({}), rules: jung.rules } as GrantNotice, prof({ sido: '부산', city: '중구' }), '2026-10-03').verdict === 'no', JSON.stringify(jung.rules))
}

// D-150: 마감 시각
{
  const pr = periodOf('2026.10.01 ~ 2026.10.15 18:00')
  check("기간: '~ 2026.10.15 18:00' → 마감 시각 18:00", pr.applyEnd === '2026-10-15' && pr.applyEndTime === '18:00', JSON.stringify(pr))
  check("기간: '2026.10.15(목) 오후 6시' → 18:00", periodOf('~ 2026.10.15(목) 오후 6시까지').applyEndTime === '18:00', JSON.stringify(periodOf('~ 2026.10.15(목) 오후 6시까지')))
  check('기간: 시각 없으면 없음', periodOf('2026.10.01 ~ 2026.10.15').applyEndTime === undefined)
  const n = { applyStart: '', applyEnd: '2026-10-15', deadlineKind: 'date' as const, applyEndTime: '18:00' }
  check('마감 시각: 마감일 17:59 → 오늘 18:00 마감 · 열림', deadlineOf(n, '2026-10-15', '17:59').state === 'today' && deadlineOf(n, '2026-10-15', '17:59').label === '오늘 18:00 마감')
  check('마감 시각: 마감일 18:00 이 지나면 마감', deadlineOf(n, '2026-10-15', '18:00').state === 'closed' && !deadlineOf(n, '2026-10-15', '19:10').open)
  check('마감 시각: 저장했다 읽어도 남음', normalizeNotice({ id: 'x', title: '공고', applyEnd: '2026-10-15', applyEndTime: '18:00', deadlineKind: 'date', rules: {} } as never).applyEndTime === '18:00')
}

// D-151: 신청 준비 — 공고 제출서류 읽기 · 서류함 대조(마감일 기준) · 두 번 안 만듦 · 요청 문구
{
  const docsText = `[서울] 2026 스마트공장 지원사업
신청기간 2026.10.01 ~ 2026.10.30 18:00
지원대상 서울 소재 제조업
제출서류
① 사업신청서 1부(서식 1)
② 사업자등록증 사본 1부
③ 국세 · 지방세 완납증명서 각 1부
④ 4대보험 가입자 명부, 중소기업(소상공인)확인서
※ 서류는 마감일 기준 발급분
문의처 02-000-0000`
  const draft = parseNoticeText(docsText)
  check('제출서류: 번호 목록을 서류 이름으로', JSON.stringify(draft.documents) === JSON.stringify(['사업신청서', '사업자등록증 사본', '국세 완납증명서', '지방세 완납증명서', '4대보험 가입자 명부', '중소기업(소상공인)확인서']), draft.documents)
  check('제출서류: 문의처에서 멈춤 · 대상 글을 먹지 않음', draft.target === '서울 소재 제조업', draft.target)
  check('제출서류: 한 줄에 쉼표로', JSON.stringify(documentsOf(['구비서류: 사업자등록증, 법인 등기사항전부증명서 1부, 재무제표(최근 3년)'])) === JSON.stringify(['사업자등록증', '법인 등기사항전부증명서', '재무제표(최근 3년)']), documentsOf(['구비서류: 사업자등록증, 법인 등기사항전부증명서 1부, 재무제표(최근 3년)']))
  check('제출서류: 없으면 빈 목록 · 공고에 칸 없음', documentsOf(['신청기간 2026.10.01 ~ 2026.10.30']).length === 0 && parseNoticeText('공고명 시험 공고\n신청기간 2026.10.01 ~ 2026.10.30').documents === undefined)
  check('제출서류: 저장했다 읽어도 남음', JSON.stringify(normalizeNotice({ title: '공고', documents: ['사업자등록증', '', 3] }, 'x', TODAY)?.documents) === JSON.stringify(['사업자등록증']))

  check('같은 서류: 등기사항전부증명서 = 법인등기부등본', docIdentity('법인 등기사항전부증명서') === docIdentity('법인등기부등본'))
  check('같은 서류: 국세 완납증명서 = 납세증명서 · 지방세는 다름', docIdentity('국세 완납증명서') === docIdentity('납세증명서') && docIdentity('지방세 완납증명서') !== docIdentity('국세 완납증명서'))
  check('같은 서류: 최근 3개년 재무제표 = 재무제표(최근 3년) = 표준재무제표증명', new Set(['최근 3개년 재무제표', '재무제표(최근 3년)', '표준재무제표증명']).size === 3 && new Set(['최근 3개년 재무제표', '재무제표(최근 3년)', '표준재무제표증명'].map(docIdentity)).size === 1)
  check('같은 서류: 4대보험 완납증명서 ≠ 가입자 명부', docIdentity('4대보험 완납증명서') !== docIdentity('4대보험 가입자 명부'))
  check('같은 서류: 사업자등록증 사본 = 사업자등록증 (2)', docIdentity('사업자등록증 사본') === docIdentity('사업자등록증 (2)'))

  const n = notice({}, { id: 'n-smart', title: '[서울] 2026 스마트공장 지원사업', applyEnd: '2026-10-30', applyEndTime: '18:00', url: 'https://www.bizinfo.go.kr/x', documents: draft.documents })
  const base = normalizeClientOps({
    id: 'c1', companyName: '샤인디자인', representativeName: '김대표',
    customDocuments: [{ id: 'cd1', key: 'customdoc_tax', label: '납세증명서', validMonths: 1, sensitive: false }],
    documents: {
      businessRegistration: { received: true, issuedAt: '2024-01-02', fileName: 'a.pdf' },
      smeCertificate: { received: true, issuedAt: '2025-11-20', fileName: 'b.pdf' },
      payrollRoster: { received: true, issuedAt: '2026-05-01', fileName: 'c.pdf' },
      customdoc_tax: { received: true, issuedAt: '2026-09-20', fileName: 'd.pdf' },
    },
  } as never)
  const made = withGrantApplication(base, n)
  const app = made.app
  check('신청 준비: 공고로 한 건 · 서류 준비 중 · 마감 · 시각 · 링크', made.created && app.status === 'preparing' && app.applyDueDate === '2026-10-30' && app.applyDueTime === '18:00' && app.noticeId === 'n-smart' && app.noticeUrl === 'https://www.bizinfo.go.kr/x' && app.programName === n.title, app)
  check('신청 준비: 활동 기록', made.record.activity[0]?.text === '지원사업 신청 준비 — [서울] 2026 스마트공장 지원사업', made.record.activity[0])
  const again = withGrantApplication(made.record, n)
  check('신청 준비: 같은 공고를 또 눌러도 한 건', !again.created && again.record.fundingApplications.length === 1 && again.app.id === app.id)
  check('신청 준비: 사업신청서가 있으면 신청서 · 사업계획서를 더 넣지 않음', !app.docs?.some((d) => d.label === '신청서 · 사업계획서') && app.docs?.length === 6, app.docs)

  const views = applyDocViews(made.record, app, TODAY)
  const st = (l: string) => views.find((v) => v.label === l)?.state
  check('대조: 사업자등록증(유효기간 없음) → 있음', st('사업자등록증 사본') === 'ok')
  check('대조: 중소기업 확인서(12개월 · 2026-11-20 까지) → 있음', st('중소기업(소상공인)확인서') === 'ok', views)
  check('대조: 4대보험 명부(3개월 · 2026-08-01 만료) → 만료', st('4대보험 가입자 명부') === 'expired', views)
  check('대조: 납세증명서(1개월 · 2026-10-20 만료) → 마감(10-30) 전에 만료', st('국세 완납증명서') === 'expires_before_due', views)
  check('대조: 지방세 완납증명서 → 서류함에 없음', st('지방세 완납증명서') === 'missing')
  check('대조: 사업신청서 → 우리가 챙길 것', st('사업신청서') === 'manual_todo')
  const r = applyReadiness(made.record, app, TODAY)
  check('준비: 2/6 · 고객에게 받을 것 3 · 우리 1', r.ready === 2 && r.total === 6 && r.needFromClient.length === 3 && r.needFromUs.length === 1 && r.daysLeft === 29, { ready: r.ready, c: r.needFromClient.length, u: r.needFromUs.length, d: r.daysLeft })
  const done = withApplyDocDone(made.record, app.id, '사업신청서', true)
  check('준비: 신청서 준비됨 표시 → 3/6', applyReadiness(done, done.fundingApplications[0], TODAY).ready === 3)
  const msg = grantDocRequestMessage(made.record, app, TODAY)
  check('요청 문구: 대표님 · 사업명 · 마감 10월 30일(금) 18:00 (D-29)', msg.startsWith('안녕하세요, 김대표 대표님.') && msg.includes("'[서울] 2026 스마트공장 지원사업'") && msg.includes('마감: 10월 30일(금) 18:00 (D-29)'), msg)
  check('요청 문구: 모자란 셋만 · 발급처 · 이유', msg.includes('1. 국세 완납증명서 (발급: 홈택스) — 마감 전에 유효기간이 끝나') && msg.includes('2. 지방세 완납증명서 (발급: 위택스 · 정부24)') && msg.includes('3. 4대보험 가입자 명부 (발급: 4대사회보험 정보연계센터) — 갖고 있는 것이 만료') && !msg.includes('사업신청서'), msg)
  check('요청 문구: 이미 받은 서류', msg.includes('이미 받은 서류: 사업자등록증 사본 · 중소기업(소상공인)확인서'), msg)
  const ev = buildClientSchedule(done, TODAY).find((e) => e.kind === 'funding')
  check('오늘 · 달력: 마감 10-30 · 서류 3/6 · 18:00 마감', ev?.date === '2026-10-30' && ev?.detail === '중소벤처기업부 · 서류 3/6 · 18:00 마감' && ev?.done === false, ev)
  const steps = recommendNextSteps([], 0, undefined, [{ name: '나중 사업', daysLeft: 20, missing: 1 }, { name: '급한 사업', daysLeft: 3, missing: 2 }, { name: '다 모음', daysLeft: 1, missing: 0 }, { name: '지난 사업', daysLeft: -2, missing: 4 }])
  check('맞춤 추천: 서류 모자란 신청 준비 — 마감 가까운 것부터 · 다 모은 것 · 지난 것은 빼기', steps.map((x) => x.text).join(' | ') === '급한 사업 — 서류 2가지 받기 · 3일 남음 | 나중 사업 — 서류 1가지 받기 · 20일 남음' && steps[0].href === '?tab=funding', steps)
  check('진행 중: 신청 준비만', openApplications(made.record).length === 1 && openApplications(base).length === 0)
  const saved = normalizeClientOps(JSON.parse(JSON.stringify(done)))
  check('저장했다 읽어도: 공고 · 시각 · 서류 · 준비됨', saved.fundingApplications[0].noticeId === 'n-smart' && saved.fundingApplications[0].applyDueTime === '18:00' && saved.fundingApplications[0].docs?.find((d) => d.label === '사업신청서')?.done === true)
  check('예전 기록(서류 목록 없음)은 그대로', normalizeClientOps({ id: 'c2', companyName: 'x', fundingApplications: [{ id: 'f', programName: 'p' }] } as never).fundingApplications[0].docs === undefined)
  // 손으로 적은 같은 이름 건이 있으면 새로 만들지 않고 공고 정보를 붙인다
  const manual = normalizeClientOps({ id: 'c3', companyName: 'x', fundingApplications: [{ id: 'f1', programName: '[서울] 2026 스마트공장 지원사업', status: 'watching', applyDueDate: '' }] } as never)
  const linked = withGrantApplication(manual, n)
  check('손으로 적은 같은 사업: 한 건 그대로 · 공고 · 마감 · 서류 붙음', !linked.created && linked.record.fundingApplications.length === 1 && linked.app.noticeId === 'n-smart' && linked.app.applyDueDate === '2026-10-30' && (linked.app.docs?.length ?? 0) === 6)
  // 제출서류가 없는 공고(기업마당) → 기본 목록 7
  check('제출서류 없는 공고: 기본 목록 7개(신청서 · 사업계획서 포함)', applyDocsFor({}).length === 7 && applyDocsFor({}).some((d) => d.label === '신청서 · 사업계획서'))
  check('상시 공고: 마감 없음', withGrantApplication(base, { ...n, id: 'n2', title: '상시 공고', deadlineKind: 'always', applyEnd: '' }).app.applyDueDate === '')
  const allOk = normalizeClientOps({ id: 'c4', companyName: '다있음', documents: { businessRegistration: { received: true, issuedAt: '2024-01-02', fileName: 'a.pdf' } } } as never)
  const one = withGrantApplication(allOk, { ...n, documents: ['사업자등록증'] })
  check('다 있으면: 모두 받았다는 문구', grantDocRequestMessage(one.record, one.app, TODAY).includes('필요한 서류는 모두 받았습니다'), grantDocRequestMessage(one.record, one.app, TODAY))
}

// D-152: 접수 → 결과 발표 → 선정 → 성공보수 · 신청 진행판 · 고객 화면 요청
{
  const n = notice({}, { id: 'n-life', title: '2026 수출바우처', applyEnd: '2026-10-20', documents: ['사업자등록증', '국세 납세증명서', '사업계획서'] })
  const base = normalizeClientOps({ id: 'c10', companyName: '가나테크', documents: { businessRegistration: { received: true, issuedAt: '2024-01-02', fileName: 'a.pdf' } } } as never)
  let rec = withGrantApplication(base, n).record
  const id = rec.fundingApplications[0].id
  check('단계: 처음은 서류 준비', applyStage(rec.fundingApplications[0]) === 'preparing')
  check('고객 화면 요청: 모자란 것만 · 이미 요청한 같은 서류는 빼기', JSON.stringify(portalRequestTitles(rec, rec.fundingApplications[0], TODAY, [])) === JSON.stringify(['국세 납세증명서']) && portalRequestTitles(rec, rec.fundingApplications[0], TODAY, ['납세증명서(국세)']).length === 0)
  rec = withApplySubmitted(rec, id, '2026-11-30')
  const sub = rec.fundingApplications[0]
  check('접수: 상태 · 접수일 오늘 · 결과 발표 예정일', sub.status === 'submitted' && sub.submittedAt !== null && sub.resultDueDate === '2026-11-30' && applyStage(sub) === 'waiting', sub)
  const evs = buildClientSchedule(rec, TODAY).filter((e) => e.kind === 'funding')
  check('일정: 결과 발표 11/30 · 마감 줄은 끝난 것으로', evs.some((e) => e.date === '2026-11-30' && e.title === '결과 발표 — 2026 수출바우처' && !e.done) && evs.some((e) => e.date === '2026-10-20' && e.done), evs)
  check('결과 발표일 고치기 · 지우기', withResultDueDate(rec, id, '2026-12-05').fundingApplications[0].resultDueDate === '2026-12-05' && normalizeClientOps(JSON.parse(JSON.stringify(withResultDueDate(rec, id, '')))).fundingApplications[0].resultDueDate === undefined)
  rec = withApplyResult(rec, id, 'selected', 30_000_000)
  const sel = rec.fundingApplications[0]
  check('선정: 상태 · 확정 금액 · 결과일', sel.status === 'selected' && sel.approvedAmount === 30_000_000 && sel.resultAt !== null && applyStage(sel) === 'selected')
  check('일정: 선정 뒤 결과 발표 줄은 사라짐', !buildClientSchedule(rec, TODAY).some((e) => e.title.startsWith('결과 발표')))
  check('성공보수: 3,000만 × 10% = 300만 · 천 원 아래 버림 · 잘못된 요율은 없음', successFeeAmount(30_000_000, 10) === 3_000_000 && successFeeAmount(12_345_678, 7) === 864_000 && successFeeAmount(null, 10) === null && successFeeAmount(1000, 0) === null && successFeeAmount(1000, 150) === null)
  const fee1 = withSuccessFee(rec, id, 3_000_000, 10)
  const f = fee1.record.fees[fee1.record.fees.length - 1]
  check('성공보수 걸기: 성공 · 300만 · 조건(협약 · 입금 뒤) · 메모', fee1.created && f.kind === 'success' && f.amount === 3_000_000 && f.label === '2026 수출바우처 성공보수' && f.conditionKind === 'custom' && f.dueDate === '' && f.note === '선정 금액 30,000,000원 × 10%', f)
  check('성공보수: 다시 눌러도 하나', !withSuccessFee(fee1.record, id, 3_000_000, 10).created && withSuccessFee(fee1.record, id, 3_000_000, 10).record.fees.length === fee1.record.fees.length)
  const saved = normalizeClientOps(JSON.parse(JSON.stringify(fee1.record)))
  check('저장했다 읽어도: 결과 발표일 · 성공보수 연결', saved.fundingApplications[0].resultDueDate === '2026-11-30' && saved.fundingApplications[0].successFeeId === f.id)
  const r0 = withGrantApplication(base, { ...n, id: 'n2', title: '떨어진 사업' }).record
  const rid = r0.fundingApplications[0].id
  const rej = withApplyResult(withApplySubmitted(r0, rid), rid, 'rejected', 5_000_000)
  check('탈락: 끝 · 확정 금액 안 적음', applyStage(rej.fundingApplications[0]) === 'closed' && rej.fundingApplications[0].approvedAmount === null)

  // 신청 진행판
  const prep = withGrantApplication(base, { ...n, id: 'n3', title: '준비 중 사업', applyEnd: '2026-10-08' }).record
  const board = applicationBoard([
    { ...prep, id: 'p1', companyName: '준비상사' },
    { ...rec, id: 'p2', companyName: '선정상사' },
    { ...withApplySubmitted(prep, prep.fundingApplications[0].id, '2026-10-25'), id: 'p3', companyName: '대기상사' },
    { ...prep, id: 'p4', companyName: '보관상사', archivedAt: '2026-09-01T00:00:00Z' },
  ], TODAY)
  check('진행판: 준비 1 · 기다림 1 · 결과 1 · 보관 업체 빠짐', board.preparing.length === 1 && board.waiting.length === 1 && board.done.length === 1 && board.preparing[0].clientName === '준비상사', { p: board.preparing.length, w: board.waiting.length, d: board.done.length })
  check('진행판: 준비 줄 서류 1/3 · 고객에게 받을 것 1(사업계획서는 우리 것) · 마감 D-7', board.preparing[0].ready === 1 && board.preparing[0].total === 3 && board.preparing[0].needFromClient === 1 && board.preparing[0].daysLeft === 7, board.preparing[0])
  check('진행판: 기다림 줄 결과 발표까지 24일', board.waiting[0].daysLeft === 24)
  check('진행판: 선정됐는데 성공보수 안 건 것 1 → 걸면 0', board.feeMissing === 1 && applicationBoard([{ ...fee1.record, id: 'p2' }], TODAY).feeMissing === 0)
}

console.log(`\ngrants: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
