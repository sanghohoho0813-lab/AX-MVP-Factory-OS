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
const verdictOf = (rules: Partial<GrantRules>, p: Partial<CompanyProfile>) => matchGrant(notice(rules), prof(p), TODAY).verdict

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
  check('지역: 전국은 누구나', verdictOf({}, {}) === 'fit')
  check('지역: 경기 공고 · 경기 업체', verdictOf({ regions: ['경기'] }, { sido: '경기' }) === 'fit')
  check('지역: 경기 공고 · 서울 업체 = 안 맞음', verdictOf({ regions: ['경기'] }, { sido: '서울' }) === 'no')
  check('지역: 주소 모름 = 확인 필요(지우지 않는다)', verdictOf({ regions: ['경기'] }, {}) === 'check')
  check('지역: 파주시 공고 · 파주 업체', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기', city: '파주시' }) === 'fit')
  check('지역: 파주시 공고 · 고양 업체 = 안 맞음', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기', city: '고양시' }) === 'no')
  check('지역: 파주시 공고 · 시군구 모름 = 확인', verdictOf({ regions: ['경기'], cities: ['파주시'] }, { sido: '경기' }) === 'check')

  check('업력: 창업 7년 이내 · 만 6년 = 맞음', verdictOf({ withinYears: 7 }, { years: exact(6) }) === 'fit')
  check('업력: 창업 7년 이내 · 만 7년 = 안 맞음', verdictOf({ withinYears: 7 }, { years: exact(7) }) === 'no')
  check('업력: 칩 3~7년(만 3~6) · 7년 이내 = 맞음', verdictOf({ withinYears: 7 }, { years: YEARS_CHIPS[2].range }) === 'fit')
  check('업력: 칩 3~7년 · 5년 이내 = 확인 필요(걸침)', verdictOf({ withinYears: 5 }, { years: YEARS_CHIPS[2].range }) === 'check')
  check('업력: 칩 7년 이상 · 7년 이내 = 안 맞음', verdictOf({ withinYears: 7 }, { years: YEARS_CHIPS[3].range }) === 'no')
  check('업력: 칩 1~3년 · 3년 이내 = 맞음', verdictOf({ withinYears: 3 }, { years: YEARS_CHIPS[1].range }) === 'fit')
  check('업력: 3년 이상 · 만 3년 = 맞음', verdictOf({ minYears: 3 }, { years: exact(3) }) === 'fit')
  check('업력: 3년 이상 · 만 2년 = 안 맞음', verdictOf({ minYears: 3 }, { years: exact(2) }) === 'no')
  check('업력: 모름 = 확인', verdictOf({ withinYears: 7 }, {}) === 'check')

  check('업종: 제조 공고 · 금속 가공 = 맞음(다른 말)', verdictOf({ industries: ['제조'] }, { industry: '금속 가공' }) === 'fit')
  check('업종: 정보통신 공고 · 소프트웨어 개발 = 맞음', verdictOf({ industries: ['정보통신'] }, { industry: '응용 소프트웨어 개발' }) === 'fit')
  check('업종: 제조 공고 · 음식점 = 확인 필요(업종 글은 사람이 본다)', verdictOf({ industries: ['제조'] }, { industry: '한식 음식점' }) === 'check')
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
  check('규모: 중소기업 = 맞음', verdictOf({ sizes: ['small'] }, {}) === 'fit')

  check('청년: 만 39세 · 맞음', verdictOf({ youthCeo: true }, { ceoAge: exact(39) }) === 'fit')
  check('청년: 만 40세 · 안 맞음', verdictOf({ youthCeo: true }, { ceoAge: exact(40) }) === 'no')
  check('청년: 나이 모름 = 확인', verdictOf({ youthCeo: true }, {}) === 'check')
  check('여성: 여성 대표', verdictOf({ womenCeo: true }, { female: true }) === 'fit' && verdictOf({ womenCeo: true }, { female: false }) === 'no' && verdictOf({ womenCeo: true }, {}) === 'check')
  check('인증: 벤처 있음', verdictOf({ certs: ['venture', 'innobiz'] }, { certs: ['venture'], certsKnown: true }) === 'fit')
  check('인증: 인증 글이 있는데 해당 없음 = 안 맞음', verdictOf({ certs: ['venture'] }, { certs: ['lab'], certsKnown: true }) === 'no')
  check('인증: 인증을 모름 = 확인', verdictOf({ certs: ['venture'] }, {}) === 'check')

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
  check('목록: 안 맞음 · 마감 · 접수 전은 빠짐', ms.map((x) => x.notice.id).join() === 'b,a,f,d', ms.map((x) => x.notice.id))
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
      years: randRange(YEARS_CHIPS.map((c) => c.range)),
      employees: randRange(EMPLOYEE_CHIPS.map((c) => c.range)),
      revenueM: randRange(REVENUE_CHIPS.map((c) => c.range)),
      ceoAge: rnd() < 0.5 ? { lo: 0, hi: 39 } : { lo: 40, hi: OPEN_TOP },
    })
    const narrow = prof({
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
  check('문구: 오늘 마감이 맨 위', msg.split('\n').find((l) => l.startsWith('· '))?.includes('오늘 마감') === true, msg)
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

console.log(`\ngrants: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
