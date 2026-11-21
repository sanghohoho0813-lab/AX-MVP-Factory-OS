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
import { certExpiries, credentialsOf, missingForMatch, profileOfRecord } from '../grants/grantProfile'
import { DEFAULT_GRANT_FILTER, amountOf, eventWord, factsOf, judgeGrant, manText, normalizeFilter, slotsOf, type GrantFilterSettings } from '../grants/grantFilter'
import {
  EMPLOYEE_CHIPS,
  REVENUE_CHIPS,
  YEARS_CHIPS,
  categoryOf,
  noticeMessage,
  parseBizinfoJson,
  parseNoticeText,
  periodOf,
  rulesFromText,
  profileFromQuery,
  profileToQuery,
  shareMessage,
} from '../grants/grantText'
import { exampleNotices } from '../grants/grantExamples'
import { certGrantView, grantRenewalRisks, grantWhatIfs, renewalRiskLine, whatIfLine } from '../grants/grantWhatIf'
import { alertPayload, publicPayload, sameNotice, validateAlert, type AlertRequest } from '../grants/grantStore'
import { mergeNotices, noticesFromFeed, slotOf } from '../grants/grantFeed'
import { industryClasses } from '../grants/grantMatch'
import { sentAt } from '../grants/grantStore'
import { withAgencyRegion } from '../grants/grantText'
import { clientsForNotice, fitSummary, grantClients, grantIndex } from '../grants/grantView'
import { answerFor } from '../clientAdvisor'
import { applyNews, grantYearStats, withApplyExecuted, applicationBoard, applyDocViews, applyDocsFor, applyReadiness, applyStage, docIdentity, grantDocRequestMessage, openApplications, portalRequestTitles, successFeeAmount, withApplyDocDone, withApplyResult, withApplySubmitted, withGrantApplication, withGrantChallenge, withoutGrantChallenge, withResultDueDate, withSuccessFee } from '../grants/grantApply'
import { documentsOf } from '../grants/grantText'
import { buildClientSchedule } from '../clientOpsSchedule'
import { feeStateOf, fundingFactsOf } from '../feeStatus'
import { recommendNextSteps } from '../clientInsights'
import { buildClientReport } from '../clientReport'
import { DECISION_BULK_KINDS, buildDecisions, paymentReminderMessage, undoDecision, weekdayOnOrAfter, withDecisionAnswer } from '../decisions'
import { buildClientAlerts } from '../clientOpsAlerts'
import { clip, grantBriefOf } from '../grants/grantBrief'
import { DIGEST_LIMIT, defaultDigestPicks, digestCandidates, digestExtra, digestHistory, digestMessage, digestSummary, noticeDay, sentIndexOf, type DigestItem } from '../grants/grantDigest'
import type { SentRecord } from '../grants/grantStore'
import { isGrantBookmark } from '../../types/clientOps'
import { DOC_FIELDS, docReadLine, readNoticeDoc } from '../grants/grantDoc'
import { buildYearPlan, refundDeadline, yearItemText, yearPlanKakao } from '../yearPlan'
import { expectedRetryMonth, programKey, rejectReasonText, rejectedTwinOf, retryHits, retrySourceOf, retryTips, sameProgramAcrossYears, withRejectInfo } from '../grants/grantRetry'
import type { Insight } from '../clientInsights'

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

  // D-156: '도전해 볼 만함' — 고른 공고만 마감을 챙긴다
  const pick = withGrantChallenge(base, n)
  check('도전 체크: 지켜보는 중 한 건 · 공고 · 마감 · 시각 · 서류 목록은 아직 없음', pick.created && pick.app.status === 'watching' && pick.app.noticeId === 'n-smart' && pick.app.applyDueDate === '2026-10-30' && pick.app.applyDueTime === '18:00' && pick.app.docs === undefined, pick.app)
  check('도전 체크: 활동 기록', pick.record.activity[0]?.text === '지원사업 도전 체크 — [서울] 2026 스마트공장 지원사업')
  check('도전 체크: 또 눌러도 한 건', withGrantChallenge(pick.record, n).record.fundingApplications.length === 1)
  const pickEv = buildClientSchedule(pick.record, TODAY).find((e) => e.kind === 'funding')
  check('도전 체크: 마감이 일정에 뜸(10-30)', pickEv?.date === '2026-10-30', pickEv)
  check('도전 체크 안 한 공고: 일정에 마감 없음', buildClientSchedule(base, TODAY).every((e) => e.kind !== 'funding'))
  const upgraded = withGrantApplication(pick.record, n)
  check('도전 체크 → [신청 준비]: 같은 건이 신청 준비로 · 서류 목록 생김', !upgraded.created && upgraded.record.fundingApplications.length === 1 && upgraded.app.status === 'preparing' && (upgraded.app.docs?.length ?? 0) === 6, upgraded.app)
  const unpicked = withoutGrantChallenge(pick.record, n)
  check('체크 풀기: 지켜보는 건은 지움 · 활동 기록', unpicked.fundingApplications.length === 0 && unpicked.activity[0]?.text.startsWith('지원사업 도전 체크 풀기'))
  check('체크 풀기: 신청 준비 뒤로는 지우지 않음', withoutGrantChallenge(upgraded.record, n) === upgraded.record)

  // D-157 검토: 체크만 한 공고는 대표 혼자 고른 것 — 손으로 적은 건을 지우지 않고, 고객 종이 · 놓친 마감 경고에 넣지 않는다
  const handMade = normalizeClientOps({ id: 'c9', companyName: '손으로', fundingApplications: [{ id: 'm1', programName: '[서울] 2026 스마트공장 지원사업', status: 'watching', applyDueDate: '2026-10-30', note: '대표가 적은 메모' }] } as never)
  check('손으로 적은 같은 이름 건: 체크 풀기로 지워지지 않음', withoutGrantChallenge(handMade, n) === handMade)
  check('isGrantBookmark: 공고에서 체크한 것만', isGrantBookmark(pick.app) && !isGrantBookmark(handMade.fundingApplications[0]) && !isGrantBookmark(upgraded.app))
  const reportNext = buildClientReport(pick.record, TODAY, 'year').next.map((x) => x.text).join(' | ')
  check('고객 보고서: 체크만 한 공고는 다음에 챙길 것에 없음', !reportNext.includes('스마트공장'), reportNext)
  const pastPick = withGrantChallenge(base, { ...n, applyEnd: '2026-09-20' }).record
  check('체크만 한 공고 마감 지남: 빨간 경고 없음 · 일정에서도 내려놓음', buildClientAlerts(pastPick, TODAY).every((a) => a.kind !== 'funding_overdue') && buildClientSchedule(pastPick, TODAY).every((e) => e.kind !== 'funding'))
  const board = applicationBoard([pick.record, upgraded.record], TODAY)
  check('신청 진행판: 체크만 한 공고는 \'도전 체크\' 칸 · 신청 준비는 서류 준비 칸', board.challenged.length === 1 && board.preparing.length === 1 && board.challenged[0].clientId === 'c1')
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

// D-152: D-151 검토로 찾은 것 — 다음 칸까지 먹던 제출서류 · 등기 · 괄호 안 쉼표 · 이름 겹침 · 작년 탈락 건 · 서류함 밖에서 받은 것
{
  const real = documentsOf(['□ 제출서류', '- 사업자등록증 1부', '- 등기사항전부증명서 1부', '□ 신청방법', '- 온라인 접수(www.k-startup.go.kr)', '□ 문의처: 중진공 1357', '4. 유의사항', '- 허위 제출 시 선정 취소'])
  check('검토 1 · 2: □ 신청방법 · 문의처 · 유의사항에서 멈춤 · 등기 서류 살림', JSON.stringify(real) === JSON.stringify(['사업자등록증', '등기사항전부증명서']), real)
  const paren = documentsOf(['제출서류: 납세증명서(국세, 지방세), 4대보험 가입자 명부'])
  check('검토 3: 괄호 안 쉼표는 한 서류 → 국세 · 지방세 둘로', JSON.stringify(paren) === JSON.stringify(['국세 납세증명서', '지방세 납세증명서', '4대보험 가입자 명부']), paren)
  const comma = documentsOf(['구비서류: 국세, 지방세 납세증명서 각 1부'])
  check('검토 3: \'국세, 지방세 납세증명서\' 에서 국세가 빠지지 않음', JSON.stringify(comma) === JSON.stringify(['국세 납세증명서', '지방세 납세증명서']), comma)
  const tail = documentsOf(['제출서류', '① 국세·지방세 완납증명서(신청일 기준)', '② 가. 중소기업확인서', '(3) 사업계획서'])
  check('검토 3 · 번호: 괄호 꼬리가 있어도 둘로 · \'가.\' \'(3)\' 떼기', JSON.stringify(tail) === JSON.stringify(['국세 완납증명서', '지방세 완납증명서', '중소기업확인서', '사업계획서']), tail)
  check('검토: \'※ 제출서류는 반환하지 않음\' 은 머리말이 아님', JSON.stringify(documentsOf(['※ 제출서류는 반환하지 않음', '3. 제출서류', '- 사업자등록증'])) === JSON.stringify(['사업자등록증']), documentsOf(['※ 제출서류는 반환하지 않음', '3. 제출서류', '- 사업자등록증']))
  check('검토 4: 4대보험료 · 건강보험료 완납은 국세가 아님', docIdentity('4대보험료 완납증명서') === docIdentity('4대보험 완납증명서') && docIdentity('건강보험료 완납증명서') !== docIdentity('국세 완납증명서') && docIdentity('완납증명서') === docIdentity('국세 납세증명서'))
  check('검토 4: 국세 · 4대보험료 완납 둘 다 남음 · 통장 거래내역 ≠ 통장 사본 · 개인인감 ≠ 법인인감', applyDocsFor({ documents: ['국세 완납증명서', '4대보험료 완납증명서'] }).length === 3 && docIdentity('통장 거래내역') !== docIdentity('통장 사본') && docIdentity('대표자 개인인감증명서') !== docIdentity('법인인감증명서'))
  const old = normalizeClientOps({ id: 'c20', companyName: 'x', fundingApplications: [{ id: 'old', programName: '청년창업사관학교', status: 'rejected', applyDueDate: '2025-03-01' }] } as never)
  const again = withGrantApplication(old, notice({}, { id: 'n-new', title: '청년창업사관학교', applyEnd: '2026-11-01' }))
  check('검토 5: 작년 탈락 건에 붙지 않고 새로 만듦(마감 2026-11-01)', again.created && again.record.fundingApplications.length === 2 && again.app.applyDueDate === '2026-11-01' && again.app.status === 'preparing')
  const manual = normalizeClientOps({ id: 'c21', companyName: 'x', fundingApplications: [{ id: 'm', programName: '청년창업사관학교', status: 'watching', applyDueDate: '2026-10-01' }] } as never)
  check('검토 5: 손으로 적은 진행 중 건에 붙으면 공고 마감으로', withGrantApplication(manual, notice({}, { id: 'n-new', title: '청년창업사관학교', applyEnd: '2026-11-01' })).app.applyDueDate === '2026-11-01')
  const outside = withGrantApplication(normalizeClientOps({ id: 'c22', companyName: 'x' } as never), notice({}, { id: 'n-o', documents: ['국세 납세증명서'] }))
  const marked = withApplyDocDone(outside.record, outside.app.id, '국세 납세증명서', true)
  check('서류함 밖에서 받은 서류: \'받았어요\' 표시 → 준비됨', applyDocViews(outside.record, outside.app, TODAY)[0].state === 'missing' && applyDocViews(marked, marked.fundingApplications[0], TODAY)[0].state === 'manual_done')
}

// D-153: 지원금 입금 → 성공보수 받을 돈 · 고객에게 알릴 소식 · 올해 성과
{
  const n = notice({}, { id: 'n-ex', title: '2026 수출바우처', applyEnd: '2026-10-20', documents: ['사업자등록증'] })
  const base = normalizeClientOps({ id: 'c30', companyName: '라마테크', representativeName: '박대표' } as never)
  let rec = withGrantApplication(base, n).record
  const id = rec.fundingApplications[0].id
  rec = withApplyResult(withApplySubmitted(rec, id, '2026-11-30'), id, 'selected', 30_000_000)
  rec = withSuccessFee(rec, id, 3_000_000, 10).record
  const feeId = rec.fundingApplications[0].successFeeId as string
  const facts = () => fundingFactsOf(rec.fundingApplications)
  check('입금 전: 성공보수는 조건 대기', feeStateOf(rec.fees.find((f) => f.id === feeId)!, TODAY, facts()) === 'waiting')
  const ex = withApplyExecuted(rec, id, 30_000_000, '2026-12-10')
  rec = ex.record
  const fee = rec.fees.find((f) => f.id === feeId)!
  check('입금: 실제 입금액 · 날짜 · 성공보수 조건 충족 → 지금 받을 돈', ex.feeUnlocked && rec.fundingApplications[0].executedAmount === 30_000_000 && rec.fundingApplications[0].executedAt === '2026-12-10' && fee.conditionMetAt === '2026-12-10' && feeStateOf(fee, TODAY, facts()) === 'claimable', fee)
  check('입금: 다시 적어도 충족일 그대로 · 잘못된 값은 무시', !withApplyExecuted(rec, id, 31_000_000, '2026-12-11').feeUnlocked && withApplyExecuted(rec, id, 31_000_000, '2026-12-11').record.fees.find((f) => f.id === feeId)!.conditionMetAt === '2026-12-10' && withApplyExecuted(rec, id, 0, '2026-12-11').record === rec && withApplyExecuted(rec, id, 1, '12/11').record === rec)
  const app = rec.fundingApplications[0]
  const sub = applyNews(rec, { ...app, approvedAmount: null }, 'submitted')
  check('고객 소식 — 접수: 결과 발표 날짜 · 대표님 이름 · 카톡 같은 글', sub.title === "'2026 수출바우처' 신청을 접수했습니다" && sub.body.startsWith('결과 발표는 11월 30일(월) 예정입니다.') && sub.kakao.startsWith('안녕하세요, 박대표 대표님.'), sub)
  const sel = applyNews(rec, app, 'selected')
  check('고객 소식 — 선정: 선정 금액 · 성공보수 · 요율은 안 보임', sel.body.includes('30,000,000원') && !/성공보수|요율|10%|3,000,000/.test(sel.title + sel.body + sel.kakao), sel)
  check('고객 소식 — 탈락: 다음 공고 안내', applyNews(rec, app, 'rejected').body.includes('다음 공고'))
  const r2 = withGrantApplication(rec, { ...n, id: 'n-r', title: '떨어진 사업' }).record
  const rid = r2.fundingApplications[0].id
  const yr = withApplyResult(withApplySubmitted(r2, rid), rid, 'rejected')
  const st = grantYearStats([{ ...yr, fundingApplications: yr.fundingApplications.map((a) => ({ ...a, resultAt: a.resultAt ? '2026' + a.resultAt.slice(4) : a.resultAt, submittedAt: a.submittedAt ? '2026' + a.submittedAt.slice(4) : a.submittedAt })) }], 2026)
  check('올해 성과: 접수 2 · 선정 1 · 탈락 1 · 선정률 50% · 선정 3천만 · 성공보수 300만(받은 돈 0)', st.submitted === 2 && st.selected === 1 && st.rejected === 1 && st.selectionRate === 0.5 && st.approvedTotal === 30_000_000 && st.feeTotal === 3_000_000 && st.feeReceived === 0, st)
  check('올해 성과: 결과 없으면 선정률 없음', grantYearStats([base], 2026).selectionRate === null)
}

// D-158: 확인함 — 프로그램이 준비한 것에 맞다 · 아니다만
{
  const T = '2026-10-06'
  const rec = normalizeClientOps({
    id: 'd1', companyName: '확인상사', status: 'active', businessAddress: '경기도 파주시 문산읍 1', industry: '제조업', establishedAt: '2022-03-01',
    customDocuments: [{ id: 'cd', key: 'customdoc_tax', label: '납세증명서', validMonths: 1, sensitive: false }],
    documents: { customdoc_tax: { received: true, issuedAt: '2026-09-01', fileName: 't.pdf' } },
    factInbox: [{ id: 'fi1', key: 'revenue', value: '1200000000', source: 'document', asOf: '2025-12-31', ref: '재무제표', foundAt: '2026-10-01T00:00:00Z' }],
  } as never)
  const ns = [notice({ regions: ['경기'] }, { id: 'nd1', title: '경기 제조 혁신 바우처', applyEnd: '2026-10-25' }), notice({ regions: ['서울'] }, { id: 'nd2', title: '서울 공고' })]
  const ds = buildDecisions(rec, T, ns)
  const kinds = ds.map((d) => d.kind)
  check('확인함: 자료에서 읽은 정보 · 서류 기한(납세증명서 만료) · 맞는 공고(경기만) 가 모인다', kinds.includes('fact') && kinds.includes('doc') && ds.filter((d) => d.kind === 'grant').map((d) => d.title).join() === '경기 제조 혁신 바우처 — 도전해 볼까요?', ds.map((d) => `${d.kind}:${d.title}`))
  check('확인함: 급한 것 먼저(정보 확인 → 만료 서류 → 공고)', ds[0].kind === 'fact' && ds.findIndex((d) => d.kind === 'doc') < ds.findIndex((d) => d.kind === 'grant'))
  const g = ds.find((d) => d.kind === 'grant')!
  const yes = withDecisionAnswer(rec, g, 'yes', ns, '2026-10-06T01:00:00Z')
  check('확인함: 공고 [도전해 볼 만함] → 도전 체크 · 다시 묻지 않음', yes.fundingApplications.some((a) => a.noticeId === 'nd1' && a.status === 'watching') && !buildDecisions(yes, T, ns).some((d) => d.id === g.id) && yes.decided?.[g.id]?.a === 'yes')
  const f = ds.find((d) => d.kind === 'fact')!
  const fyes = withDecisionAnswer(rec, f, 'yes', ns, '2026-10-06T01:00:00Z')
  check('확인함: 정보 [맞아요] → 업체 정보로 · 후보 빠짐', fyes.factInbox.length === 0 && !buildDecisions(fyes, T, ns).some((d) => d.kind === 'fact'))
  const fno = withDecisionAnswer(rec, f, 'no', ns, '2026-10-06T01:00:00Z')
  check('확인함: 정보 [틀려요] → 넣지 않고 다시 묻지 않음', fno.factInbox.length === 0 && !buildDecisions(fno, T, ns).some((d) => d.kind === 'fact'))
  const d = ds.find((x) => x.kind === 'doc')!
  check('확인함: 서류 기한 → 요청 문구(납세증명서) 복사 효과', d.effect.type === 'copy' && d.effect.text.includes('납세증명서'), d)
  const dno = withDecisionAnswer(rec, d, 'no', ns, '2026-10-06T01:00:00Z')
  check('확인함: 서류 [나중에] → 같은 만료일에는 다시 묻지 않음', !buildDecisions(dno, T, ns).some((x) => x.kind === 'doc'))
  check('확인함: 보관 · 계약 끝난 업체는 묻지 않음', buildDecisions({ ...rec, archivedAt: '2026-10-01T00:00:00Z' }, T, ns).length === 0 && buildDecisions({ ...rec, status: 'completed' }, T, ns).length === 0)
  check('확인함: 지원사업 권한 없으면 공고 결정 없음', !buildDecisions(rec, T, ns, (k) => k !== 'grants').some((x) => x.kind === 'grant'))
  const saved = normalizeClientOps(JSON.parse(JSON.stringify(yes)))
  check('확인함: 답은 저장해 읽어도 그대로 · 이상한 값은 버림', saved.decided?.[g.id]?.a === 'yes' && normalizeClientOps({ id: 'x', companyName: 'x', decided: { a: { a: 'maybe', at: 1 } } } as never).decided === undefined)
  let many = rec
  for (let i = 0; i < 305; i++) many = withDecisionAnswer(many, { id: `x${i}`, effect: { type: 'copy', text: '' } }, 'no', ns, `2026-10-06T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`)
  check('확인함: 답은 300개까지(오래된 것부터 지움)', Object.keys(many.decided ?? {}).length === 300 && !many.decided?.x0 && !!many.decided?.x304)
}

// D-160: 확인할 것 넓히기 — 받을 돈 · 밀린 업무 · 다음 약속 · 다시 연락
{
  const T = '2026-10-06' // 화요일
  const at = '2026-10-06T01:00:00Z'
  const base = normalizeClientOps({
    id: 'm1', companyName: '수금상사', representativeName: '박대표', status: 'active',
    fees: [
      { id: 'f1', label: '계약금', amount: 3_000_000, dueDate: '2026-09-20', receivedAt: null },
      { id: 'f2', label: '잔금', amount: 2_000_000, dueDate: '2026-10-20', receivedAt: null },
      { id: 'f3', label: '성공보수', amount: 5_000_000, dueDate: '', receivedAt: null, conditionKind: 'funding_executed' },
      { id: 'f4', label: '착수금', amount: 1_000_000, dueDate: '2026-09-01', receivedAt: '2026-09-02T00:00:00Z' },
    ],
    nextAction: '', nextActionDueDate: '',
  } as never)
  const ds = buildDecisions(base, T, [])
  const money = ds.filter((d) => d.kind === 'money')
  check('받을 돈: 날짜 지난 계약금만(예정 · 조건 대기 · 입금 완료는 아님)', money.length === 1 && money[0].title.startsWith('계약금 3,000,000원'), money.map((d) => d.title))
  check('받을 돈: 16일 지남 · 입금 요청 문구(대표님 · 9월 20일 · 금액)', money[0].why.includes('16일') && money[0].effect.type === 'copy' && /박대표 대표님.*계약금 3,000,000원.*9월 20일/.test(money[0].effect.text), money[0])
  const myes = withDecisionAnswer(base, money[0], 'yes', [], at)
  check('받을 돈 [요청 문구 복사] → 활동 기록에 남김 · 다시 안 물음', myes.activity[0]?.text.includes('입금 요청 문구') && !buildDecisions(myes, T, []).some((d) => d.kind === 'money'))
  check('받을 돈: 날짜를 바꾸면(다시 지나면) 다시 묻는다', buildDecisions({ ...myes, fees: myes.fees.map((f) => (f.id === 'f1' ? { ...f, dueDate: '2026-09-25' } : f)) }, T, []).some((d) => d.kind === 'money'))
  check('받을 돈: 문구에 안쪽 말 없음', !/미수금|내 몫|영업자/.test(paymentReminderMessage(base, '계약금', 3_000_000, '2026-09-20')))

  // 다음 약속 — 없으면 단계에 맞는 약속을 7일 뒤(평일)로 · 지났으면 3일 뒤로 다시
  const empty = ds.find((d) => d.kind === 'next')!
  check('다음 약속: 비어 있으면 7일 뒤 평일로 제안', !!empty && empty.effect.type === 'next' && empty.effect.date === '2026-10-13', empty)
  const nyes = withDecisionAnswer(base, empty, 'yes', [], at)
  check('다음 약속 [잡기] → 업체 다음 약속 · 날짜가 들어감', nyes.nextAction !== '' && nyes.nextActionDueDate === '2026-10-13' && !buildDecisions(nyes, T, []).some((d) => d.kind === 'next'))
  const nno = withDecisionAnswer(base, empty, 'no', [], at)
  check('다음 약속 [안 잡음] → 이번 달은 안 묻고 다음 달에 다시', !buildDecisions(nno, T, []).some((d) => d.kind === 'next') && buildDecisions(nno, '2026-11-03', []).some((d) => d.kind === 'next'))
  const lateRec = { ...base, nextAction: '2차 미팅', nextActionDueDate: '2026-09-25' }
  const late = buildDecisions(lateRec, T, []).find((d) => d.kind === 'next')!
  check("다음 약속: 일주일 넘게 지난 '2차 미팅' → 3일 뒤(금)로 다시 잡기", late.title.includes('2차 미팅') && late.effect.type === 'next' && late.effect.date === '2026-10-09', late)
  check('다음 약속: 지난 지 일주일 안이면 묻지 않음', !buildDecisions({ ...base, nextAction: '통화', nextActionDueDate: '2026-10-01' }, T, []).some((d) => d.kind === 'next'))
  check('주말 피하기: 토 → 월 · 일 → 월 · 평일 그대로', weekdayOnOrAfter('2026-10-10') === '2026-10-12' && weekdayOnOrAfter('2026-10-11') === '2026-10-12' && weekdayOnOrAfter('2026-10-08') === '2026-10-08')

  // 밀린 업무 — 진행 중인데 기한이 일주일 넘게 지남 → 2주 뒤(평일)로 다시 잡기
  const svc = { ...base, services: { ...base.services, venture: { ...base.services.venture, status: 'in_progress' as const, dueDate: '2026-09-10' }, patent: { ...base.services.patent, status: 'in_progress' as const, dueDate: '2026-10-02' } } }
  const stale = buildDecisions(svc, T, []).filter((d) => d.kind === 'stale')
  check('밀린 업무: 26일 지난 벤처인증만(4일 지난 특허는 아직)', stale.length === 1 && stale[0].title.startsWith('벤처') && stale[0].why.includes('26일'), stale.map((d) => d.title))
  const syes = withDecisionAnswer(svc, stale[0], 'yes', [], at)
  check('밀린 업무 [2주 뒤로 다시 잡기] → 기한 10/20 · 활동 기록', syes.services.venture.dueDate === '2026-10-20' && syes.activity.some((a) => a.kind === 'service_due') && !buildDecisions(syes, T, []).some((d) => d.kind === 'stale'))
  check('밀린 업무: 완료 · 시작 전은 묻지 않음', !buildDecisions({ ...svc, services: { ...svc.services, venture: { ...svc.services.venture, status: 'done' as const } } }, T, []).some((d) => d.kind === 'stale'))

  // 다시 연락 — 오래 조용한 잠재고객만
  const quiet = normalizeClientOps({ id: 'p1', companyName: '조용상사', representativeName: '최대표', status: 'waiting', updatedAt: '2026-07-01T00:00:00Z', activity: [{ id: 'a', kind: 'sales', text: '1차 미팅', serviceKey: null, at: '2026-07-01T00:00:00Z' }] } as never)
  const fu = buildDecisions(quiet, T, []).find((d) => d.kind === 'followup')
  check('다시 연락: 97일 조용한 잠재고객 → 연락 문구(최대표 대표님)', !!fu && fu.title.includes('97일') && fu.effect.type === 'copy' && fu.effect.text.includes('최대표 대표님'), fu)
  check('다시 연락: 계약 고객은 아님(안부 칸이 맡는다)', !buildDecisions({ ...quiet, status: 'active' }, T, []).some((d) => d.kind === 'followup'))

  // 순서 · 한 번에
  const all = buildDecisions({ ...svc, fees: base.fees }, T, [])
  check('순서: 받을 돈 → 밀린 업무 → 다음 약속', all.findIndex((d) => d.kind === 'money') < all.findIndex((d) => d.kind === 'stale') && all.findIndex((d) => d.kind === 'stale') < all.findIndex((d) => d.kind === 'next'), all.map((d) => d.kind))
  check('한 번에 [모두 맞아요]: 복사(받을 돈 · 다시 연락 · 서류)는 빠진다', !DECISION_BULK_KINDS.includes('money') && !DECISION_BULK_KINDS.includes('followup') && !DECISION_BULK_KINDS.includes('doc') && DECISION_BULK_KINDS.includes('next'))
  let chain = { ...svc, fees: base.fees }
  for (const d of all.filter((x) => x.kind === 'stale' || x.kind === 'next')) chain = withDecisionAnswer(chain, d, 'yes', [], at)
  check('같은 업체 두 건을 이어서 적어도 둘 다 남음(기한 · 다음 약속)', chain.services.venture.dueDate === '2026-10-20' && chain.nextActionDueDate === '2026-10-13')
}

// D-161: 되돌리기 — 그 답이 바꾼 것만
{
  const T = '2026-10-06'
  const at = '2026-10-06T01:00:00Z'
  const base = normalizeClientOps({
    id: 'u1', companyName: '되돌림상사', status: 'active', nextAction: '', nextActionDueDate: '',
    customDocuments: [{ id: 'cd', key: 'customdoc_tax', label: '납세증명서', validMonths: 1, sensitive: false }],
    documents: { customdoc_tax: { received: true, issuedAt: '2026-08-01', fileName: 't.pdf' } },
  } as never)
  const svc = { ...base, services: { ...base.services, venture: { ...base.services.venture, status: 'in_progress' as const, dueDate: '2026-09-10' } } }
  const ds = buildDecisions(svc, T, [])
  const next = ds.find((d) => d.kind === 'next')!
  const stale = ds.find((d) => d.kind === 'stale')!
  const a1 = withDecisionAnswer(svc, next, 'yes', [], at)
  const a2 = withDecisionAnswer(a1, stale, 'yes', [], at)
  // 다음 약속 답만 되돌린다 — 뒤에 한 밀린 업무 답(기한 · 답 기록 · 활동)은 남는다
  const u = undoDecision(a2, svc, a1, next.id)
  check('되돌리기: 다음 약속이 비고 · 그 답 기록만 빠짐', u.nextAction === '' && u.nextActionDueDate === '' && !u.decided?.[next.id] && !!u.decided?.[stale.id])
  check('되돌리기: 뒤에 한 답(업무 기한 10/20)은 그대로', u.services.venture.dueDate === '2026-10-20' && u.activity.some((x) => x.kind === 'service_due'))
  check('되돌리기: 이 답이 더한 활동 줄만 빠짐', !u.activity.some((x) => x.text.includes('다음 할 일')) && u.activity.length === a2.activity.length - (a1.activity.length - svc.activity.length))
  check('되돌리기 뒤 다시 묻는다', buildDecisions(u, T, []).some((d) => d.id === next.id))
  const u2 = undoDecision(a2, a1, a2, stale.id)
  check('되돌리기: 업무 기한도 예전 값(9/10)으로', u2.services.venture.dueDate === '2026-09-10' && !u2.decided?.[stale.id] && u2.nextActionDueDate === a2.nextActionDueDate)
  const edited = { ...a2, nextAction: '대표가 직접 고친 약속' }
  check('되돌리기: 그 사이 사람이 고친 칸은 덮지 않음', undoDecision(edited, svc, a1, next.id).nextAction === '대표가 직접 고친 약속')
  const no = withDecisionAnswer(svc, next, 'no', [], at)
  check('[아니에요] 도 되돌리면 다시 묻는다', buildDecisions(undoDecision(no, svc, no, next.id), T, []).some((d) => d.id === next.id))
  const doc = ds.find((d) => d.kind === 'doc')!
  check('서류 기한: 고객 화면에 올릴 서류 목록(납세증명서)', doc.effect.type === 'copy' && doc.effect.docs?.map((x) => x.label).join() === '납세증명서', doc.effect)
}

// D-161: 점검에서 찾은 것 — 다시 연락 · 나중에 · 긴 이름
{
  const T = '2026-10-06'
  const at = '2026-10-06T01:00:00Z'
  const hold = normalizeClientOps({ id: 'h1', companyName: '보류상사', representativeName: '정대표', status: 'waiting', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', sales: { stage: 'hold', movedAt: '2026-06-01T00:00:00Z' }, activity: [{ id: 'a0', kind: 'sales', text: '보류', serviceKey: null, at: '2026-06-01T00:00:00Z' }] } as never)
  const f1 = buildDecisions(hold, T, []).find((d) => d.kind === 'followup')!
  const answeredHold = { ...withDecisionAnswer(hold, f1, 'no', [], at), updatedAt: at }
  check('보류 업체: [안 함] 뒤 저장해도 같은 질문이 새로 나오지 않음', !!f1 && !buildDecisions(answeredHold, T, []).some((d) => d.kind === 'followup'), buildDecisions(answeredHold, T, []).map((d) => d.id))
  const lead = normalizeClientOps({ id: 'l1', companyName: '조용리드', status: 'waiting', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', activity: [{ id: 'a1', kind: 'sales', text: '첫 연락', serviceKey: null, at: '2026-05-01T00:00:00Z' }] } as never)
  const empty = buildDecisions(lead, T, []).find((d) => d.kind === 'next')!
  const afterNo = { ...withDecisionAnswer(lead, empty, 'no', [], at), updatedAt: at }
  check('다른 질문에 [아니에요] 해도 다시 연락 질문은 남는다(저장 ≠ 연락)', buildDecisions(afterNo, T, []).some((d) => d.kind === 'followup'))
  const m = normalizeClientOps({ id: 'mm', companyName: '나중상사', status: 'active', fees: [{ id: 'f1', label: '계약금', amount: 1_000_000, dueDate: '2026-09-20', receivedAt: null }] } as never)
  const md = buildDecisions(m, T, []).find((d) => d.kind === 'money')!
  const later = withDecisionAnswer(m, md, 'no', [], at)
  check('받을 돈 [나중에]: 14일 안에는 안 묻고 14일 뒤 아직 안 받았으면 다시', !buildDecisions(later, '2026-10-19', []).some((d) => d.kind === 'money') && buildDecisions(later, '2026-10-20', []).some((d) => d.kind === 'money'))
  const many = normalizeClientOps({
    id: 'dd', companyName: '서류많은상사', status: 'active',
    customDocuments: Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, key: `customdoc_longname_${i}_abcdef`, label: `서류${i}`, validMonths: 1, sensitive: false })),
    documents: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`customdoc_longname_${i}_abcdef`, { received: true, issuedAt: '2026-07-01', fileName: 'x.pdf' }])),
  } as never)
  const dd = buildDecisions(many, T, []).find((d) => d.kind === 'doc')!
  const kept = normalizeClientOps(JSON.parse(JSON.stringify(withDecisionAnswer(many, dd, 'no', [], at))))
  check('서류 14개 만료여도 답이 저장해 읽은 뒤 남는다(이름 짧게)', dd.id.length < 40 && !!kept.decided?.[dd.id], dd.id.length)
}

// D-168: 2차 · 3차 거르기 — 금액 · 선정 규모 · 행사 · 마감 여유
{
  const A = (amountText: string, summary = '', title = '공고') => amountOf({ amountText, title, summary }).man
  check('금액: 최대 5천만원 → 5,000만', A('최대 5천만원') === 5000, A('최대 5천만원'))
  check('금액: 1억 5천만원 → 15,000만', A('', '기업당 최대 1억 5천만원 이내') === 15000, A('', '기업당 최대 1억 5천만원 이내'))
  check('금액: 2,000만원 · 10,000,000원 · 50백만원 · 5,000천원', A('', '업체당 2,000만원') === 2000 && A('', '최대 10,000,000원') === 1000 && A('', '최대 50백만원') === 5000 && A('', '최대 5,000천원') === 500)
  check('금액: 총 예산 · 매출 조건은 지원금이 아니다', A('', '총 사업비 10억원, 매출액 50억원 이상 기업, 업체당 최대 3천만원') === 3000, A('', '총 사업비 10억원, 매출액 50억원 이상 기업, 업체당 최대 3천만원'))
  check('금액: 총 예산만 적혔으면 못 읽음', A('', '총 예산 5억원') === null, A('', '총 예산 5억원'))
  check('금액: 월 80만원 × 12개월 = 960만', A('', '1인당 월 최대 80만원, 최대 12개월 지원') === 960, A('', '1인당 월 최대 80만원, 최대 12개월 지원'))
  check('금액: 안 적힘 → null', A('', '중소기업의 수출을 돕습니다') === null)
  const S = (summary: string, title = '공고') => slotsOf({ title, summary, target: '' })
  check('선정 규모: 30개사 내외 · 10개 기업 · 50곳', S('30개사 내외 선정') === 30 && S('10개 기업 지원') === 10 && S('50곳 선정') === 50)
  check('선정 규모: 1개사당 금액은 규모가 아니다', S('1개사당 최대 2천만원') === null, S('1개사당 최대 2천만원'))
  check('선정 규모: 안 적힘 → null', S('수출 지원') === null)
  check('행사: 설명회 · 교육생 모집 · 수요조사 · 공모전은 행사', ['2026 수출바우처 사업설명회', 'AI 실무 교육생 모집', '스마트공장 수요조사', '창업 아이디어 공모전'].every((t) => eventWord({ title: t }) !== ''))
  check('행사: 해외 전시회 참가 지원 · 교육 지원금은 행사가 아니다', eventWord({ title: '수출 초보기업 해외 전시회 참가 지원' }) === '' && eventWord({ title: '직업능력개발 훈련비 지원' }) === '')
  const T0 = '2026-10-07'
  const n = (over: Partial<GrantNotice>) => notice({}, { applyEnd: '2026-10-30', deadlineKind: 'date', ...over })
  const J = (x: GrantNotice, s: Partial<GrantFilterSettings> = {}) => judgeGrant(x, factsOf(x), { ...DEFAULT_GRANT_FILTER, ...s }, T0)
  check('기본 기준: 300만원 미만은 2차에서 거름', J(n({ amountText: '최대 200만원' })).stage === 2)
  check('기본 기준: 금액 안 적힘은 남김', J(n({ amountText: '' })).pass)
  check('기본 기준: 설명회는 3차에서 거름', J(n({ title: '정책자금 설명회 안내', amountText: '' })).stage === 3)
  check('기준 1,000만: 5천만원 통과 · 500만원 거름', J(n({ amountText: '최대 5천만원' }), { minAmount: 1000 }).pass && !J(n({ amountText: '최대 500만원' }), { minAmount: 1000 }).pass)
  check('금액 안 적힌 것 숨기기', J(n({ amountText: '' }), { hideNoAmount: true }).stage === 2)
  check('선정 10곳 이상: 5개사 거름 · 30개사 통과', J(n({ summary: '5개사 선정' }), { minSlots: 10 }).stage === 3 && J(n({ summary: '30개사 선정' }), { minSlots: 10 }).pass)
  check('마감 여유 7일: 3일 남은 공고 거름 · 선착순은 그대로', J(n({ applyEnd: '2026-10-10' }), { minDays: 7 }).stage === 3 && J(n({ applyEnd: '', deadlineKind: 'first_come' }), { minDays: 7 }).pass)
  check('거르기 끄기: 전부 통과', J(n({ amountText: '최대 100만원', title: '설명회' }), { on: false }).pass)
  check('설정 읽기: 이상한 값은 기본값', JSON.stringify(normalizeFilter({ minAmount: 777, on: 'x', minSlots: 10 })) === JSON.stringify({ ...DEFAULT_GRANT_FILTER, minSlots: 10 }))
  check('금액 글: 1억 5천만원 · 3천만원 · 300만원', manText(15000) === '1억 5천만원' && manText(3000) === '3천만원' && manText(300) === '300만원' && manText(10000) === '1억원')
  const ex = exampleNotices(T0).map((x, i) => ({ ...x, id: `e${i}`, createdAt: '', updatedAt: '' }) as GrantNotice)
  check('예시 공고 6개는 기본 기준에서 다 남는다', ex.every((x) => J(x).pass), ex.filter((x) => !J(x).pass).map((x) => x.title))
}

// D-182: 오늘 · 확인할 것 '자세히' — 그 공고 하나 핵심만(금액 · 기간 · 대상 · 맞는 조건 · 원문)
{
  const T = '2026-10-06'
  const rec = normalizeClientOps({ id: 'b1', companyName: '요약상사', status: 'active', businessAddress: '경기도 파주시 문산읍 1', industry: '제조업', establishedAt: '2022-03-01' } as never)
  const n1 = notice(
    { regions: ['경기'], industries: ['제조업'] },
    {
      id: 'nb1', title: '경기 제조 혁신 바우처', applyStart: '2026-10-01', applyEnd: '2026-10-25', applyEndTime: '18:00', amountText: '기업당 최대 5천만원',
      operator: '경기테크노파크', target: '경기도 소재 제조업 중소기업(업력 7년 이내)으로서 공고일 현재 휴·폐업 중이 아닌 기업. 단, 국세 체납 기업은 제외합니다. 세부 요건은 공고문을 확인하세요.',
      summary: '제조 공정 개선 · 스마트화를 위한 바우처를 지원합니다. 총 20개사 내외 선정.', url: 'https://www.bizinfo.go.kr/x',
    },
  )
  const ds = buildDecisions(rec, T, [n1])
  const g = ds.find((d) => d.kind === 'grant')
  const b = g?.grant
  check('공고 요약(D-182): 맞는 공고 결정에 요약이 붙는다(다른 화면으로 가지 않아도 됨)', !!b && b.noticeId === 'nb1', ds.map((d) => d.kind))
  check('공고 요약(D-182): 지원 금액 — 글 그대로 · 맨 앞', b?.amount === '기업당 최대 5천만원' || b?.amount === '최대 5천만원', b?.amount)
  check('공고 요약(D-182): 접수 기간 10.01 ~ 10.25 18:00 · 마감까지', b?.period === '10.01 ~ 10.25 18:00' && /마감|D-/.test(b?.deadline ?? ''), [b?.period, b?.deadline])
  check('공고 요약(D-182): 선정 규모 20곳 · 분야 · 기관(소관 · 수행)', b?.slots === '선정 20곳' && b?.category !== '' && b?.agency === '중소벤처기업부 · 경기테크노파크', [b?.slots, b?.agency])
  check('공고 요약(D-182): 이 업체와 맞는 조건(지역 · 업종)', !!b && b.fits.some((t) => t.startsWith('지역')) && b.fits.some((t) => t.startsWith('업종')), b?.fits)
  check('공고 요약(D-182): 지원 대상은 짧게(140자 안 · …)', !!b && b.target.length <= 141 && b.target.length > 20, b?.target.length)
  check('공고 요약(D-182): 원문 주소 · 더 보기 길은 따로(openPath 그대로)', b?.url === 'https://www.bizinfo.go.kr/x' && g?.openPath === '/grants?view=clients&client=b1')
  // 금액을 못 읽으면 지어내지 않는다
  const n2 = notice({ regions: ['경기'] }, { id: 'nb2', title: '경기 판로 지원', amountText: '' })
  const b2 = grantBriefOf(matchGrant(n2, prof(BASE), T))
  check('공고 요약(D-182): 금액이 안 적힌 공고는 빈 칸(숫자를 지어내지 않음) · 선정 규모 없음', b2.amount === '' && b2.slots === '', [b2.amount, b2.slots])
  const b3 = grantBriefOf(matchGrant(notice({}, { id: 'nb3', deadlineKind: 'always', applyEnd: '' }), prof(BASE), T))
  const b4 = grantBriefOf(matchGrant(notice({}, { id: 'nb4', deadlineKind: 'first_come', applyStart: '2026-10-02', applyEnd: '' }), prof(BASE), T))
  check('공고 요약(D-182): 상시 접수 · 예산 소진 시까지', b3.period === '상시 접수' && b4.period === '10.02부터 예산 소진 시까지', [b3.period, b4.period])
  check('공고 요약(D-182): 다른 결정(정보 · 서류)에는 요약이 없다', ds.filter((d) => d.kind !== 'grant').every((d) => d.grant === undefined))
  check('공고 요약(D-182): 자르기 — 짧으면 그대로 · 길면 …', clip('짧은 글', 10) === '짧은 글' && clip('가'.repeat(50), 10).endsWith('…') && clip('가'.repeat(50), 10).length === 11)
}

// D-211 점검 결과 — 공고 날짜 · 조건 읽기 · 지원금과 정책자금 · 금액 · 업종 · 알림 날짜
{
  const p1 = periodOf('2026.10.01(목)부터 예산 소진 시까지')
  check('D211 기간: \'부터 … 소진 시까지\' 는 시작날(예전: 끝날로 읽어 다음 날부터 마감)', p1.applyStart === '2026-10-01' && p1.applyEnd === '' && p1.deadlineKind === 'first_come', p1)
  const p2 = periodOf('2026.10.01 ~ 예산 소진 시까지')
  check('D211 기간: \'날짜 ~ 소진 시까지\' 도 시작날', p2.applyStart === '2026-10-01' && p2.applyEnd === '', p2)
  const p3 = periodOf('2026. 10. 1.(목) ~ 10. 30.(금) 18:00')
  check('D211 기간: 끝날에 해가 없는 꼴 → 앞 날짜의 해 · 시각까지(예전: 마감 없음으로 계속 열림)', p3.applyStart === '2026-10-01' && p3.applyEnd === '2026-10-30' && p3.applyEndTime === '18:00', p3)
  const p4 = periodOf('2026.12.15 ~ 1.10')
  check('D211 기간: 해를 넘기는 끝날(12/15 ~ 1/10) → 다음 해', p4.applyEnd === '2027-01-10', p4)
  check('D211 기간: 예전 꼴은 그대로(~ 날짜 · 날짜까지 · 마감: 날짜)', periodOf('~ 2026.10.15').applyEnd === '2026-10-15' && periodOf('2026.10.15(수) 18:00까지').applyEnd === '2026-10-15' && periodOf('접수마감: 2026.10.15').applyEnd === '2026-10-15')
  const pn = parseNoticeText('2026 판로 지원사업\n지원대상: 업력 1~3년 중소기업\n일정 안내 2026.10.01 ~ 2026.10.31 까지 접수')
  check('D211 붙여넣기: 신청기간 줄이 없으면 날짜 옆 ~ 를 찾음(예전: 앞의 \'업력 1~3년\' ~ 를 잡아 날짜를 잃음)', pn.applyStart === '2026-10-01' && pn.applyEnd === '2026-10-31', [pn.applyStart, pn.applyEnd])
  const ind = (t: string) => { const r = rulesFromText(t); return [r.industries.join(), r.excludeIndustries.join()] }
  check('D211 업종: \'제조업체(체납기업 제외)\' · \'제조업(유흥업 제외)\' 는 제조 대상(예전: 제조 제외로 뒤집힘)', JSON.stringify(ind('도내 제조업체(체납기업 제외)')) === JSON.stringify(['제조', '']) && JSON.stringify(ind('제조업(유흥업 제외)')) === JSON.stringify(['제조', '']))
  check('D211 업종: \'제조업 및 지식서비스업(사치향락업 제외)\' 둘 다 대상 · \'(제조업 제외)\' 는 제외 그대로', JSON.stringify(ind('제조업 및 지식서비스업(사치향락업 제외)')) === JSON.stringify(['제조,지식서비스', '']) && JSON.stringify(ind('(제조업 제외)')) === JSON.stringify(['', '제조']))
  const pref = rulesFromText('국내 중소기업', '국내 중소기업\n※ 우대사항: 청년기업(대표자 만 39세 이하), 창업 3년 이내 기업은 가점')
  check('D211 조건: 우대 · 가점 문장은 조건이 아님(예전: 청년 대표 · 3년 이내만으로 읽어 다른 업체 숨김)', !pref.youthCeo && pref.withinYears === null, pref)
  const op = rulesFromText('국내 중소기업', '국내 중소기업 대상\n수행기관: 서울 소재 창업보육센터')
  check('D211 조건: 수행기관 소재지는 지역 조건이 아님', op.regions.length === 0, op.regions)
  const keep = rulesFromText('창업 3년 이내 기업(여성기업 우대)', '창업 3년 이내 기업(여성기업 우대)')
  check('D211 조건: 괄호 \'(여성기업 우대)\' 만 빼고 앞 조건(3년 이내)은 남김', keep.withinYears === 3 && !keep.womenCeo, keep)
  check('D211 조건: 지역 \'경기도 소재\' 는 그대로', rulesFromText('경기도 소재 중소기업').regions.join() === '경기')
  check('D211 금액: 2천5백만 · 1천5백만 · 1억 2천 5백만 → 2,500 · 1,500 · 12,500만원(예전: 모두 500만원)', amountOf({ amountText: '최대 2천5백만원', title: '', summary: '' }).man === 2500 && amountOf({ amountText: '1천5백만원', title: '', summary: '' }).man === 1500 && amountOf({ amountText: '1억 2천 5백만원', title: '', summary: '' }).man === 12500 && amountOf({ amountText: '최대 5천만원', title: '', summary: '' }).man === 5000)
  check('D211 업종: \'식품 도매\' · \'부품 도매\' · \'기계 임대업\' 은 제조가 아님 · \'식품 제조 및 도매\' 는 둘 다', JSON.stringify(industryClasses('도매 및 소매업 · 식품 도매')) === '["도소매"]' && !industryClasses('부품 도매').includes('제조') && !industryClasses('기계 임대업').includes('제조') && JSON.stringify(industryClasses('식품 제조 및 도매')) === '["제조","도소매"]' && industryClasses('기계 부품').includes('제조'))

  // 지원금 입금 ≠ 정책자금 조달
  const pf = normalizeClientOps({
    id: 'c211', companyName: '정책상사',
    fees: [{ id: 'pf-fee', kind: 'success', label: '정책자금 성공보수', amount: 5_000_000, dueDate: '', receivedAt: null, conditionKind: 'funding_executed', conditionMetAt: null }],
  } as never)
  let gr = withGrantApplication(pf, notice({}, { id: 'n-211', title: '2026 수출바우처', applyEnd: '2026-10-20' })).record
  const gid = gr.fundingApplications[0].id
  gr = withApplyExecuted(withApplyResult(withApplySubmitted(gr, gid, '2026-11-30'), gid, 'selected', 30_000_000), gid, 30_000_000, '2026-12-10').record
  const pfFee = gr.fees.find((f) => f.id === 'pf-fee')!
  check('D211 지원금 3천만 입금이 정책자금 성공보수(정책자금 실행 시)를 받을 돈으로 바꾸지 않음(예전: claimable)', feeStateOf(pfFee, TODAY, fundingFactsOf(gr.fundingApplications)) === 'waiting' && fundingFactsOf(gr.fundingApplications).executedTotal === 0)
  const manualPf = normalizeClientOps({ id: 'c212', companyName: '정책상사', fundingApplications: [{ id: 'mp', programName: '중진공 신시장진출자금', status: 'selected', applyDueDate: '', resultAt: '2026-09-20', approvedAmount: 200_000_000, executedAmount: 200_000_000 }] } as never)
  check('D211 손으로 적은 정책자금 실행은 그대로 정책자금 조달로 셈', fundingFactsOf(manualPf.fundingApplications).executedTotal === 200_000_000)
  const bd = applicationBoard([manualPf], TODAY)
  check('D211 신청 진행판: 손으로 적은 정책자금 선정 건은 \'성공보수 안 건 곳\' · 진행판에 없음(예전: feeMissing 1)', bd.feeMissing === 0 && bd.done.length === 0 && bd.preparing.length === 0)
  check('D211 올해 지원사업 성과: 정책자금 2억 선정은 넣지 않음', grantYearStats([manualPf], 2026).approvedTotal === 0 && grantYearStats([manualPf], 2026).selected === 0)
  const fc = withGrantChallenge(normalizeClientOps({ id: 'c213', companyName: 'x' } as never), notice({}, { id: 'n-fc', title: '선착순 바우처', applyStart: '2026-10-01', applyEnd: '2026-10-31', deadlineKind: 'first_come' }))
  const fp = withGrantApplication(normalizeClientOps({ id: 'c214', companyName: 'x' } as never), notice({}, { id: 'n-fc2', title: '선착순 바우처2', applyStart: '2026-10-01', applyEnd: '2026-10-31', deadlineKind: 'first_come' }))
  check('D211 선착순이어도 끝날이 있으면 도전 체크 · 신청 준비에 마감(예전: 마감 없음 → 일정 · 오늘에 안 뜸)', fc.app.applyDueDate === '2026-10-31' && fp.app.applyDueDate === '2026-10-31')
  check('D211 상시 공고는 마감 없음 그대로', withGrantChallenge(normalizeClientOps({ id: 'c215', companyName: 'x' } as never), notice({}, { id: 'n-al', title: '상시', applyEnd: '2026-12-31', deadlineKind: 'always' })).app.applyDueDate === '')
  const prevTz = process.env.TZ
  process.env.TZ = 'Asia/Seoul'
  check('D211 알림 보낸 날은 로컬 날짜(한국 오전 8시 30분 보낸 것 = 그날)', sentAt([{ clientId: 'a', noticeIds: ['n'], at: '2026-10-15T23:30:00.000Z', via: 'kakao' } as never], 'a', 'n') === '2026-10-16')
  if (prevTz === undefined) delete process.env.TZ
  else process.env.TZ = prevTz
}

// D-308 인증 — 회사 정보 글 + 올린 인증서(cf:…) · 만료는 빼고(정책자금 가점 D-307 과 같은 규칙)
{
  const T = '2026-10-28'
  const rec = (fv: Record<string, string>) => normalizeClientOps({ id: 'cr308', companyName: '인증테스트', factValues: fv } as never)
  const up = credentialsOf(rec({ 'cf:벤처기업': '확인번호 V-1 · 확인일 2025-01-02 · 2028-01-01까지' }), T)
  check('D-308 올린 벤처기업확인서(유효) → 벤처 · 인증을 앎(예전: 글만 읽어 모름)', up.certs.includes('venture') && up.known, JSON.stringify(up))
  const old = credentialsOf(rec({ certifications: '벤처기업, 이노비즈', 'cf:벤처기업': '확인일 2021-01-01 · 2024-01-01까지' }), T)
  check('D-308 올린 인증서가 만료면 글에 "벤처" 가 있어도 뺌 · 이노비즈는 그대로', !old.certs.includes('venture') && old.certs.includes('innobiz') && old.expired.includes('venture'), JSON.stringify(old))
  const renewed = credentialsOf(rec({ 'cf:벤처기업': '2024-01-01까지', 'cf:벤처기업 (2)': '2028-01-01까지' }), T)
  check('D-308 옛 인증서는 만료여도 새 인증서가 유효하면 벤처 그대로', renewed.certs.includes('venture') && !renewed.expired.includes('venture'), JSON.stringify(renewed))
  check('D-308 연구소 "없음" 은 연구소가 아님(예전: 글만 있으면 연구소로 셈)', !credentialsOf(rec({ researchLab: '없음' }), T).certs.includes('lab'))
  check('D-308 연구개발전담부서도 연구소 조건(lab)', credentialsOf(rec({ researchLab: '연구개발전담부서(2025 인정)' }), T).certs.includes('lab'))
  const p = profileOfRecord(rec({ 'cf:여성기업': '확인일 2025-03-01 · 2028-02-28까지' }), T)
  check('D-308 업체 → 매칭 조건: 올린 여성기업확인서 → women', p.certs.includes('women') && p.certsKnown, JSON.stringify(p.certs))
  check('D-308 벤처 대상 공고: 올린 확인서로 맞음 · 만료면 안 맞음', verdictOf({ certs: ['venture'] }, { certs: up.certs, certsKnown: up.known }) === 'fit' && verdictOf({ certs: ['venture'] }, { certs: old.certs, certsKnown: old.known }) === 'no')
}


/* ---------------- D-556 한 가지만 갖추면 더 맞는 공고 ---------------- */
{
  const N = (id: string, rules: Partial<GrantRules>, over: Partial<GrantNotice> = {}) => notice(rules, { id, title: `공고 ${id}`, ...over })
  const known = prof({ ...BASE, employees: exact(3), certs: [], certsKnown: true })
  const list = [
    N('v1', { certs: ['venture'] }),
    N('v2', { certs: ['venture', 'innobiz'] }),
    N('lab', { certs: ['lab'] }),
    N('emp', { minEmployees: 5 }),
    N('two', { certs: ['venture'], minEmployees: 5 }), // 인증 + 직원 — 두 가지라 세지 않음
    N('reg', { regions: ['부산'], certs: ['venture'] }), // 지역이 안 맞음 — 세지 않음
    N('closed', { certs: ['venture'] }, { applyEnd: '2026-09-01' }), // 마감 — 세지 않음
    N('w', { certs: ['women'] }),
    N('ok', {}), // 이미 맞음(전국 공통) — 세지 않음
  ]
  const wi = grantWhatIfs(list, known, TODAY, { clientId: 'c1' })
  const by = new Map(wi.map((w) => [w.key, w]))
  const ids = (k: string) => (by.get(k)?.gained ?? []).map((m) => m.notice.id).sort().join(',')
  check('D556-1 벤처 확인을 받으면 — 벤처를 요구하는 공고 둘(v1 · v2), 두 가지가 모자란 공고 · 지역이 안 맞는 공고 · 마감 공고는 빼고', ids('cert:venture') === 'v1,v2', ids('cert:venture'))
  check('D556-2 이노비즈 · 연구소 · 직원 수 각각 · 여성기업(성별 모름이면 보임)', ids('cert:innobiz') === 'v2' && ids('cert:lab') === 'lab' && ids('employees:5') === 'emp' && ids('cert:women') === 'w', wi.map((w) => w.key))
  check('D556-3 많이 생기는 것 먼저 · 이미 맞는 공고는 세지 않음', wi[0].key === 'cert:venture' && !wi.some((w) => w.gained.some((m) => m.notice.id === 'ok')))
  check('D556-4 이어서 준비할 곳 — 벤처는 기업인증 › 벤처기업 · 직원은 고용지원금 청년 채용 상황', by.get('cert:venture')?.next?.href === '/tools/cert-os/venture?client=c1' && (by.get('employees:5')?.next?.href ?? '').includes('preset=emp-youth') && by.get('cert:women')?.next === null)
  check('D556-5 직원 이름표 — 지금보다 몇 명 더', by.get('employees:5')?.label === '직원이 5명이 되면(지금보다 2명 더)', by.get('employees:5')?.label)
  const male = grantWhatIfs(list, { ...known, female: false }, TODAY)
  check('D556-6 남성 대표로 확인된 업체에는 여성기업 칸 없음', !male.some((w) => w.key === 'cert:women'))
  const unknownCerts = grantWhatIfs(list, { ...known, certsKnown: false }, TODAY)
  check('D556-7 인증을 모르는 업체는 인증 공고가 이미 "확인 필요" — 갖출 것으로 세지 않음', !unknownCerts.some((w) => w.key.startsWith('cert:')) && unknownCerts.some((w) => w.key === 'employees:5'))
  const has = grantWhatIfs(list, { ...known, certs: ['venture'] }, TODAY)
  check('D556-8 이미 벤처 확인이 있으면 벤처 칸 없음 · 이노비즈 칸도 없음(v2 는 벤처로 이미 맞음)', !has.some((w) => w.key === 'cert:venture') && !has.some((w) => w.key === 'cert:innobiz'))
  const renew = grantWhatIfs(list, known, TODAY, { expired: ['venture'] })
  check('D556-9 만료된 인증이면 "다시 받으면"', renew.find((w) => w.key === 'cert:venture')?.label === '벤처기업 확인을 다시 받으면' && renew.find((w) => w.key === 'cert:venture')?.renew === true)
  check('D556-10 한 줄 요약', whatIfLine(wi, 2) === '벤처 확인 +2 · 여성기업 +1' || /^벤처 확인 \+2 · /.test(whatIfLine(wi, 2)), whatIfLine(wi, 2))
  check('D556-11 받아 둔 공고가 없으면 빈 목록', grantWhatIfs([], known, TODAY).length === 0)
}


/* ---------------- D-557 인증이 곧 끝나면 · 기업인증 화면의 지원사업 ---------------- */
{
  const T = TODAY // 2026-10-01
  const rec = (fv: Record<string, string>, over: Record<string, unknown> = {}) =>
    normalizeClientOps({ id: 'c557', companyName: '갱신테스트', businessAddress: '경기도 파주시 문산읍 1', industry: '제조업', establishedAt: '2023-01-01', employeeCount: '3', factValues: fv, ...over } as never)
  const N = (id: string, rules: Partial<GrantRules>, over: Partial<GrantNotice> = {}) => notice(rules, { id, title: `공고 ${id}`, ...over })
  const soon = rec({ 'cf:벤처기업': '확인일 2024-01-02 · 2026-12-15까지' })
  check('D557-1 끝나는 날 — 올린 인증서의 "…까지" · 지난 것은 빼고', certExpiries(soon, T).venture === '2026-12-15' && certExpiries(rec({ 'cf:벤처기업': '2026-09-01까지' }), T).venture === undefined)
  const list = [
    N('late', { certs: ['venture'] }, { applyEnd: '2027-01-31' }), // 인증 끝난 뒤에도 접수 — 잃음
    N('early', { certs: ['venture'] }, { applyEnd: '2026-11-30' }), // 인증 끝나기 전에 마감 — 상관없음
    N('always', { certs: ['venture'] }, { applyEnd: '', deadlineKind: 'always' }), // 상시 — 잃음
    N('either', { certs: ['venture', 'innobiz'] }, { applyEnd: '2027-01-31' }), // 이노비즈도 있으면 상관없음
    N('none', {}, { applyEnd: '2027-01-31' }),
  ]
  const p = profileOfRecord(soon, T)
  const risks = grantRenewalRisks(list, p, T, certExpiries(soon, T), { clientId: 'c557' })
  const lost = (risks[0]?.lost ?? []).map((m) => m.notice.id).sort().join(',')
  check('D557-2 갱신하지 않으면 못 하는 공고 — 인증이 끝난 뒤에도 접수하는 것(날짜 · 상시)만', risks.length === 1 && risks[0].cert === 'venture' && lost === 'always,either,late', lost)
  const both = rec({ 'cf:벤처기업': '2026-12-15까지', certifications: '이노비즈' })
  const lost2 = (grantRenewalRisks(list, profileOfRecord(both, T), T, certExpiries(both, T))[0]?.lost ?? []).map((m) => m.notice.id).sort().join(',')
  check('D557-3 다른 인증으로도 맞는 공고(벤처 또는 이노비즈)는 세지 않음', lost2 === 'always,late', lost2)
  check('D557-4 한 줄 — "벤처기업 확인이 2026-12-15에 끝나요(75일 남음) — 갱신하지 않으면 공고 3건을 못 해요"', renewalRiskLine(risks[0]) === '벤처기업 확인이 2026-12-15에 끝나요(75일 남음) — 갱신하지 않으면 공고 3건을 못 해요', renewalRiskLine(risks[0]))
  check('D557-5 120일보다 멀면 알리지 않음 · 이어서 준비할 곳 = 기업인증 › 벤처기업', grantRenewalRisks(list, p, T, { venture: '2027-06-01' }).length === 0 && risks[0].next?.href === '/tools/cert-os/venture?client=c557')
  // 기업인증 화면 — 없는 인증이면 '받으면 n건 더', 있는 인증이면 '이 인증으로 맞는 공고' + 갱신 줄
  const noCert = rec({ certifications: '없음' })
  const v1 = certGrantView('venture', noCert, list, T)
  check('D557-6 기업인증 화면(벤처 없음): 받으면 더 맞는 공고(early · late · always · either)', !v1.held && v1.matches.map((m) => m.notice.id).sort().join(',') === 'always,early,either,late' && v1.risk === '', v1.matches.map((m) => m.notice.id))
  const v2 = certGrantView('venture', soon, list, T)
  check('D557-7 기업인증 화면(벤처 있음 · 곧 끝남): 이 인증 덕분에 맞는 공고 · 갱신 줄', v2.held && v2.matches.length === 4 && v2.riskCount === 3 && /갱신하지 않으면 공고 3건/.test(v2.risk), v2)
  const v3 = certGrantView('venture', soon, list, T, '2027-09-01')
  check('D557-8 기업인증 진행 기록의 유효기간이 멀면 갱신 줄 없음', v3.held && v3.risk === '')
  // 업체 질문 답(인증) — 곧 끝나는 인증이 있으면 사실 맨 앞에 같은 한 줄
  const ans = answerFor('cert', { record: soon, today: T, notices: list })
  check('D557-9 업체 질문 답(인증): 사실 맨 앞 "…갱신하지 않으면 공고 3건을 못 해요"', ans.facts[0] === renewalRiskLine(risks[0]), ans.facts)
  check('D557-10 곧 끝나는 인증이 없으면 그 줄 없음', !answerFor('cert', { record: noCert, today: T, notices: list }).facts.some((f) => /갱신하지 않으면/.test(f)))
}

/* ---------------- D-623 맞는 공고 골라서 보내기 ---------------- */
{
  const T = '2026-11-17'
  const p = prof({ ...BASE })
  const mk = (id: string, over: Partial<GrantNotice>, rules: Partial<GrantRules> = { regions: ['경기'] }) => notice(rules, { id, title: `공고 ${id}`, createdAt: '2026-11-01T03:00:00Z', ...over })
  const list = [
    mk('old', { applyEnd: '2026-12-20' }),
    mk('told', { applyEnd: '2026-11-25' }),
    mk('new1', { applyEnd: '2026-11-20', postedAt: '2026-11-12', source: 'bizinfo', createdAt: '2026-11-17T00:10:00Z', agency: '경기도', amountText: '최대 3천만원', url: 'https://x.test/n1' }),
    mk('new2', { applyEnd: '2026-12-05', postedAt: '2026-11-15', source: 'bizinfo' }),
    mk('newcheck', { applyEnd: '2026-11-19', postedAt: '2026-11-16', source: 'bizinfo' }, { regions: ['경기'], minEmployees: 5 }),
    mk('nodate', { applyEnd: '2026-11-30', source: 'bizinfo', createdAt: '2026-11-17T00:10:00Z' }),
    mk('general', { applyEnd: '2026-11-21', postedAt: '2026-11-16' }, {}),
    mk('closed', { applyEnd: '2026-11-10', postedAt: '2026-11-12' }),
    mk('busan', { applyEnd: '2026-11-21', postedAt: '2026-11-16' }, { regions: ['부산'] }),
  ]
  const ms = matchesFor(list, p, T)
  const sent: SentRecord[] = [
    { id: 's2', clientId: 'c1', noticeIds: [], channel: 'link', at: '2026-11-10T04:00:00Z' },
    { id: 's1', clientId: 'c1', noticeIds: ['told'], channel: 'kakao', at: '2026-11-10T03:00:00Z', titles: { told: '공고 told' }, comments: { told: '작년에도 냈던 사업' }, note: '안녕하세요' },
    { id: 's0', clientId: 'c2', noticeIds: ['new1'], channel: 'kakao', at: '2026-11-16T03:00:00Z' },
  ]
  const idx = sentIndexOf(sent)
  check('D623-1 알린 기록 묶음: 업체마다 마지막 알림 날 · 공고마다 알린 날', idx.last.get('c1') === '2026-11-10' && idx.ids.get('c1')?.get('told') === '2026-11-10' && idx.last.get('c2') === '2026-11-16' && !idx.last.has('c3'))
  const cands = digestCandidates(ms, idx, 'c1')
  const ids = cands.map((c) => `${c.match.notice.id}:${c.bucket}`).join(' ')
  check(
    'D623-2 보낼 후보: 새로 올라온 것(맞음 · 마감 급한 순 → 확인 필요) → 아직 안 알린 것 → 알린 것 · 전국 공통 · 마감 · 안 맞음은 뺌',
    ids === 'new1:fresh new2:fresh newcheck:fresh nodate:unsent old:unsent told:sent',
    ids,
  )
  check('D623-3 올라온 날을 모르는 기업마당 공고는 새로 올라왔다고 하지 않음(받아 온 때는 매일 바뀐다)', noticeDay(list[5]) === '' && noticeDay(list[0]) === '2026-11-01' && noticeDay(list[2]) === '2026-11-12')
  check('D623-4 처음 골라 둘 것 = 새로 올라온 것만(다시 보내는 일은 직접 골랐을 때만)', defaultDigestPicks(cands).join(',') === 'new1,new2,newcheck' && defaultDigestPicks(cands, 2).join(',') === 'new1,new2')
  const sum = digestSummary(ms, idx, 'c1')
  check('D623-5 목록 숫자: 새로 올라온 조건 맞음 2건 · 7일 안 마감 1건 · 지난번 11-10', sum.fresh === 2 && sum.urgentFresh === 1 && sum.lastSent === '2026-11-10' && sum.due, sum)
  // 한 번도 안 알린 업체 — 맞는 공고 전부가 보낼 것 · 처음에는 5건만 골라 둔다
  const never = digestCandidates(ms, idx, 'c3')
  check('D623-6 한 번도 안 알린 업체: 전부 보낼 것 · 맞음 먼저 마감 급한 순', never.every((c) => c.bucket === 'fresh') && never.map((c) => c.match.notice.id).join(',') === 'new1,told,nodate,new2,old,newcheck', never.map((c) => c.match.notice.id))
  check('D623-7 처음 골라 두는 수 5건', defaultDigestPicks(never).length === 5 && digestSummary(ms, idx, 'c3').fresh === 5 && digestSummary(ms, idx, 'c3').lastSent === '')
  // 다 알린 업체는 보낼 곳이 아니다
  const all: SentRecord[] = [{ id: 'a', clientId: 'c9', noticeIds: ms.map((m) => m.notice.id), channel: 'kakao', at: '2026-11-17T03:00:00Z' }]
  check('D623-8 오늘 다 알린 업체: 보낼 것 0 · 골라 둔 것 0', !digestSummary(ms, sentIndexOf(all), 'c9').due && defaultDigestPicks(digestCandidates(ms, sentIndexOf(all), 'c9')).length === 0)

  const pick = (id: string, comment = ''): DigestItem => ({ match: cands.find((c) => c.match.notice.id === id)!.match, comment })
  const msg = digestMessage({ companyName: '한빛정밀', sender: '미래AI랩', items: [pick('new1', '  직원 수만 확인하면\n바로 신청할 수 있어요  '), pick('newcheck'), pick('new2')], note: '지난주에 말씀드린 건에 이어 보냅니다.' })
  check('D623-9 문구: 인사 · 한마디 · 건수 · 번호', /^한빛정밀 대표님, 안녕하세요\. 미래AI랩입니다\./.test(msg) && msg.includes('지난주에 말씀드린 건에 이어 보냅니다.') && msg.includes('공고 3건을 골라') && msg.includes('① 공고 new1') && msg.includes('② 공고 newcheck') && msg.includes('③ 공고 new2'), msg)
  check('D623-10 문구: 소관 · 마감(날짜) · 지원 · 의견 한 줄(줄바꿈 없앰) · 공고 주소', msg.includes('· 소관: 경기도') && /· 마감: [^\n]*\(11월 20일\)/.test(msg) && msg.includes('· 지원: 최대 3천만원') && msg.includes('· 제 의견: 직원 수만 확인하면 바로 신청할 수 있어요') && msg.includes('· 공고: https://x.test/n1'), msg)
  check('D623-11 문구: 확인 필요 공고는 확인할 것 · 의견이 없으면 의견 줄 없음', /② 공고 newcheck[\s\S]*· 확인할 것: 직원 수/.test(msg.split('③')[0]) && msg.split('· 제 의견:').length === 2, msg)
  check('D623-12 문구: 선정을 약속하지 않음 · 빈 줄 겹침 0 · AI 라고 하지 않음', msg.includes('선정 여부는 심사에서 정해집니다') && !/\n\n\n/.test(msg) && !/AI|선정됩니다|확실|보장/.test(msg.replace('미래AI랩', '')))
  const far = digestMessage({ companyName: '', sender: '담당자', items: [{ match: matchGrant(mk('m', { applyEnd: '2027-02-15' }), p, T), comment: '' }] })
  check('D623-13 문구: 이미 날짜가 든 마감 말에는 날짜를 또 붙이지 않음 · 회사 이름 없으면 "대표님"', far.includes('· 마감: 2월 15일 마감\n') && far.startsWith('대표님, 안녕하세요. 담당자입니다.'), far)
  const many = digestMessage({ companyName: 'x', sender: 's', items: Array.from({ length: 14 }, (_, i) => ({ match: matchGrant(mk(`k${i}`, { applyEnd: '2026-12-01' }), p, T), comment: '' })) })
  check('D623-14 한 통에 10건까지', DIGEST_LIMIT === 10 && many.includes('공고 10건') && many.includes('⑩ 공고 k9') && !many.includes('공고 k10'))
  const extra = digestExtra([pick('new1', '의견 하나'), pick('new2')], '  한마디  ')
  check('D623-15 보낸 기록에 같이 남기는 것: 공고 이름 · 적은 의견만 · 한마디', extra.titles.new1 === '공고 new1' && extra.titles.new2 === '공고 new2' && extra.comments.new1 === '의견 하나' && !('new2' in extra.comments) && extra.note === '한마디', extra)
  const hist = digestHistory(sent, 'c1', (id) => (id === 'told' ? '지금 이름' : ''))
  check('D623-16 보낸 기록 보기: 새것 먼저 · 그때 이름 · 의견 · 한마디 · 공고 없는 찾기 링크 기록도 한 줄', hist.length === 2 && hist[0].channel === 'link' && hist[0].items.length === 0 && hist[1].day === '2026-11-10' && hist[1].items[0].title === '공고 told' && hist[1].items[0].comment === '작년에도 냈던 사업' && hist[1].note === '안녕하세요', hist)
  const oldRec: SentRecord[] = [{ id: 'o', clientId: 'c1', noticeIds: ['gone', 'told'], channel: 'kakao', at: '2026-11-01T03:00:00Z' }]
  const h2 = digestHistory(oldRec, 'c1', (id) => (id === 'told' ? '지금 이름' : ''))
  check('D623-17 예전 기록(이름을 안 남긴 것): 지금 목록에 있으면 그 이름 · 없으면 빈 이름', h2[0].items.map((x) => x.title).join('|') === '|지금 이름', h2)
}

/* ---------------- D-639 공고 원문 파일 읽기 ---------------- */
{
  // ① 부처 PDF 꼴 — 번호 줄 · 공고명 · 서명 · 칸 머리(1.) · 괄호 칸 이름(❍) · 쪽 나눔 · 쪽 번호
  const pdf = `중소벤처기업부 공고 제2026 - 98호

2026년 중소기업 혁신바우처사업 참여기업 모집 공고

중소기업의 성장을 위한 컨설팅, 기술지원, 마케팅을 지원하는 「2026년 중소기업 혁신바우처사업」 참여기업 모집을 다음과 같이 공고합니다.
2026년 2월 10일
중소벤처기업부 장관
- 1 -
\f
1. 사업 개요
 ❍ (사업목적) 제조 중소기업의 경쟁력 강화를 위한 컨설팅 · 기술지원 · 마케팅 바우처 지원
 ❍ (지원규모) 총 300억원, 약 900개사
 ❍ (지원내용) 기업당 최대 5천만원 이내 바우처 지급(정부지원금 50~80%)
 ❍ (사업기간) 협약일 ~ 2026. 12. 31.
2. 신청 자격
 ❍ (지원대상) 최근 3년 평균 매출액 140억원 이하 제조 중소기업
   * 휴·폐업 기업, 국세·지방세 체납 기업 제외
 ❍ (우대사항) 여성기업, 장애인기업 가점 부여
- 2 -
\f
3. 신청 기간 및 방법
 ❍ (신청기간) 2026. 2. 10.(화) ~ 2026. 3. 5.(목) 18:00까지
 ❍ (신청방법) 혁신바우처 누리집(www.mssmiv.com) 온라인 신청
4. 제출서류
 ① 사업신청서 1부(서식 제1호)
 ② 중소기업확인서 1부
 ③ 국세·지방세 완납증명서 각 1부
 ④ 최근 3년 재무제표 각 1부
5. 문의처
 ❍ 중소기업 통합콜센터 ☎ 1357`
  const r = readNoticeDoc(pdf)
  const d = r.draft
  check('D639-1 공고명: 번호 줄 · 서명이 아니라 공고 이름 줄', d.title === '2026년 중소기업 혁신바우처사업 참여기업 모집 공고', d.title)
  check('D639-2 소관: 번호 줄 앞(중소벤처기업부)', d.agency === '중소벤처기업부', d.agency)
  check('D639-3 신청 기간: 날짜 끝 점 · 요일 뒤 시각까지 · 사업기간(협약일 ~)은 안 읽음', d.applyStart === '2026-02-10' && d.applyEnd === '2026-03-05' && d.applyEndTime === '18:00' && d.deadlineKind === 'date', [d.applyStart, d.applyEnd, d.applyEndTime])
  check('D639-4 지원 대상: 괄호 칸 글 + 아래 * 줄(제외) · 우대사항은 안 섞임', d.target.startsWith('최근 3년 평균 매출액 140억원 이하 제조 중소기업') && d.target.includes('체납 기업 제외') && !d.target.includes('여성기업'), d.target)
  check('D639-5 조건: 매출 140억 이하 · 제조 · 중소기업 · 여성 대표 조건 아님(우대)', d.rules.maxRevenueM === 14000 && d.rules.industries.includes('제조') && d.rules.sizes.includes('small') && !d.rules.womenCeo, d.rules)
  check('D639-6 지원 금액: 기업당 최대 5천만원(총 300억원 예산이 아님)', /5천만원/.test(d.amountText) && !/300억/.test(d.amountText), d.amountText)
  check('D639-7 개요에 지원규모(선정 900개사)가 들어가 선정 규모가 읽힘', slotsOf(d) === 900, slotsOf(d))
  check('D639-8 제출 서류: ① ~ ④ → 다섯 서류(국세 · 지방세 나눔)', JSON.stringify(d.documents) === JSON.stringify(['사업신청서', '중소기업확인서', '국세 완납증명서', '지방세 완납증명서', '최근 3년 재무제표']), d.documents)
  check('D639-9 주소: www 만 적힌 신청 누리집 → https://', d.url === 'https://www.mssmiv.com', d.url)
  check('D639-10 못 찾은 칸 0 · 짐작한 칸 0 · 3쪽', r.missing.length === 0 && r.unsure.length === 0 && r.pages === 3, r)
  const pageOf = (f: string) => r.found.find((x) => x.field === f)?.page
  check('D639-11 읽은 곳: 공고명 1쪽 · 대상 2쪽 · 기간 · 서류 3쪽', pageOf('공고명') === 1 && pageOf('지원 대상') === 2 && pageOf('신청 기간') === 3 && pageOf('제출 서류') === 3, r.found)
  check('D639-12 한 줄: 칸 이름 · 서류 개수', docReadLine(r) === '공고명 · 소관 · 신청 기간 · 지원 대상 · 지원 금액 · 제출 서류 5개', docReadLine(r))
  check('D639-13 갈래: 바우처 → 자금', d.category === 'money', d.category)

  // ② 한글 표 꼴 — 칸 사이 탭 · 띄어 쓴 칸 이름 · 표 머리 줄(구 분)
  const hwp = `[경기] 2026년 파주시 소상공인 온라인 판로 지원사업 모집 공고
구 분\t내 용
소 관 기 관\t경기도 파주시
지 원 대 상\t파주시 소재 소상공인(창업 3년 이내)
지 원 규 모\t20개사 내외, 업체당 최대 300만원
신 청 기 간\t2026. 4. 1.(수) ~ 4. 15.(수) 17:00
제 출 서 류\t신청서, 사업자등록증 사본 1부, 소상공인확인서
문 의 처\t파주시 일자리경제과 031-940-0000`
  const h = readNoticeDoc(hwp)
  check('D639-14 표: 공고명 · 소관(띄어 쓴 칸 이름)', h.draft.title.startsWith('[경기] 2026년 파주시 소상공인') && h.draft.agency === '경기도 파주시', [h.draft.title, h.draft.agency])
  check('D639-15 표: 기간(끝날에 해 없음) · 시각', h.draft.applyStart === '2026-04-01' && h.draft.applyEnd === '2026-04-15' && h.draft.applyEndTime === '17:00', [h.draft.applyStart, h.draft.applyEnd, h.draft.applyEndTime])
  check('D639-16 표: 대상 → 경기 파주시 · 소상공인 · 창업 3년 이내', h.draft.rules.regions.join() === '경기' && h.draft.rules.cities.join() === '파주시' && h.draft.rules.sizes.includes('micro') && h.draft.rules.withinYears === 3, h.draft.rules)
  check('D639-17 표: 금액 업체당 최대 300만원 · 선정 20곳 · 서류 셋', /300만원/.test(h.draft.amountText) && slotsOf(h.draft) === 20 && JSON.stringify(h.draft.documents) === JSON.stringify(['신청서', '사업자등록증 사본', '소상공인확인서']), [h.draft.amountText, h.draft.documents])
  check('D639-18 표: 문의처 줄이 서류 · 대상에 안 섞임', !h.draft.target.includes('031') && !(h.draft.documents ?? []).some((x) => x.includes('031')))

  // ③ 칸 머리만 있고 내용은 아래 '가.' 줄 · 신청기간 칸 없이 '접수' 줄 · 사업기간(~) 먼저 나옴 · 서류 칸 없음
  const loose = `서울특별시 공고 제2026-1150호
2026년 서울형 R&D 지원사업
기술개발 과제 모집 공고
□ 사업 개요
 ㅇ 사업기간: 2026. 6. 1. ~ 2027. 5. 31.(12개월)
 ㅇ 과제당 최대 2억원 지원(총 15개 과제 내외)
□ 신청자격
 가. 공고일 기준 서울시 소재 중소기업
 나. 업력 3년 이상 기업
□ 접수
 ㅇ 온라인 접수: 2026. 4. 20.(월) ~ 5. 8.(금) 16:00까지
□ 문의: 서울경제진흥원 02-0000-0000`
  const l = readNoticeDoc(loose)
  check('D639-19 두 줄로 나뉜 공고명 이어 붙임', l.draft.title === '2026년 서울형 R&D 지원사업 기술개발 과제 모집 공고', l.draft.title)
  check('D639-20 소관: 서울특별시 → 지역 서울', l.draft.agency === '서울특별시' && l.draft.rules.regions.join() === '서울', [l.draft.agency, l.draft.rules.regions])
  check('D639-21 칸 머리만 있는 신청자격 → 아래 가. 나. 줄이 대상 · 업력 3년 이상', l.draft.target.includes('서울시 소재 중소기업') && l.draft.target.includes('업력 3년 이상') && l.draft.rules.minYears === 3, [l.draft.target, l.draft.rules.minYears])
  check('D639-22 기간: 사업기간(~) 은 건너뛰고 접수 줄에서 짐작 · 짐작 표시', l.draft.applyStart === '2026-04-20' && l.draft.applyEnd === '2026-05-08' && l.draft.applyEndTime === '16:00' && l.unsure.includes('신청 기간'), [l.draft.applyStart, l.draft.applyEnd, l.unsure])
  check('D639-23 금액: 과제당 최대 2억원 · 서류 칸 없음 → 못 찾은 칸', /2억원/.test(l.draft.amountText) && l.missing.join() === '제출 서류', [l.draft.amountText, l.missing])
  check('D639-24 갈래: R&D', l.draft.category === 'rnd', l.draft.category)

  // ④ 글이 거의 없는 파일(사진 인식 실패 등) — 지어내지 않는다
  const thin = readNoticeDoc('안내\n자세한 내용은 붙임 파일을 참고하시기 바랍니다.')
  check('D639-25 읽을 것 없음: 공고명 빈 칸 · 못 찾은 칸 여섯 · 조건 없음', thin.draft.title === '' && thin.missing.length === DOC_FIELDS.length && rulesText(thin.draft.rules).length === 0, thin)
  // ⑤ 문장 속 칸 이름 낱말은 칸이 아니다 — '신청기간 내에 …' · '대상 기업은 …'
  const sentence = readNoticeDoc('2026년 스마트공장 보급사업 공고\n신청기간 내에 제출한 서류만 인정합니다.\n대상 기업은 선정 뒤 협약을 맺습니다.\n신청기간: 2026.07.01 ~ 2026.07.31\n지원대상: 제조업 중소기업')
  check('D639-26 문장 속 낱말은 칸 아님: 기간 · 대상은 진짜 칸에서', sentence.draft.applyEnd === '2026-07-31' && sentence.draft.target === '제조업 중소기업', [sentence.draft.applyEnd, sentence.draft.target])
  // 붙여넣기 읽기도 같은 시각 고침을 받는다(날짜 끝 점 뒤 시각)
  check('D639-27 붙여넣기 기간: 2026. 3. 5.(목) 18:00 → 18:00', periodOf('2026. 2. 10.(화) ~ 2026. 3. 5.(목) 18:00까지').applyEndTime === '18:00')
}

/* ---------------- D-640 업체 1년 자금 일정표 ---------------- */
{
  const T2 = '2026-11-21'
  const ins = (key: string, tone: Insight['tone'], action: string | null, headline = '', extra: Partial<Insight> = {}): Insight => ({ key, label: { 'policy-funding': '정책자금', 'startup-tax': '창업감면', labcare: '연구소', employment: '고용지원금', grants: '지원사업', cretop: '크레탑', tax: '절세' }[key] ?? key, tone, headline, detail: '', missing: [], openPath: `/tools/${key}`, openLabel: '', action, ...extra })
  const rec = normalizeClientOps({
    id: 'yp1',
    companyName: '한빛정밀',
    status: 'active',
    corporateNumber: '110111-1234567',
    businessAddress: '경기도 파주시 문산읍 1',
    industry: '제조업',
    establishedAt: '2020-03-02',
    nextAction: '견적 회신',
    nextActionDueDate: '2026-11-28',
    fundingApplications: [
      { id: 'a1', programName: '스마트공장 구축 지원', status: 'preparing', applyDueDate: '2026-12-10', institution: '경기도' },
      { id: 'a2', programName: '늦은 신청', status: 'preparing', applyDueDate: '2026-11-10', institution: '' },
      { id: 'a3', programName: '아주 늦은 신청', status: 'preparing', applyDueDate: '2026-09-01', institution: '' },
      { id: 'a4', programName: '먼 훗날 신청', status: 'preparing', applyDueDate: '2028-01-05', institution: '' },
      { id: 'a5', programName: '결과 기다림', status: 'submitted', applyDueDate: '2026-10-01', resultDueDate: '2027-01-20', institution: '중기부' },
    ],
    fees: [{ id: 'f1', label: '착수금', amount: 3000000, dueDate: '2026-12-01', receivedAt: null, serviceKey: 'policyFund' }],
    documents: { payrollRoster: { received: true, issuedAt: '2026-10-15', fileName: '명부.pdf' } },
    toolResults: [{ id: 't1', toolKey: 'employment', title: '고용지원금 진단', summary: '', createdAt: '2026-11-01T00:00:00Z', deadlines: [{ date: '2027-02-28', title: '청년도약 참여신청 마감', note: '입사 후 3개월', hard: true }] }],
  } as never)
  const notice = (id: string, title: string, end: string, rules: Partial<GrantRules> = {}) => normalizeNotice({ id, title, agency: '경기도', applyStart: '2026-11-01', applyEnd: end, deadlineKind: 'date', amountText: '최대 3천만원', rules: { ...rules } }, id, T2)!
  const prof = profileOfRecord(rec, T2)
  const ns = [
    notice('g1', '경기 제조 디지털 바우처', '2027-02-15', { regions: ['경기'] }),
    notice('g2', '스마트공장 구축 지원', '2026-12-10'),
    notice('g3', '서울만 공고', '2027-01-10', { regions: ['서울'] }),
    notice('g4', '지난 공고', '2026-11-01'),
    ...Array.from({ length: 8 }, (_, i) => notice(`m${i}`, `경기 공고 ${i}`, `2027-0${(i % 6) + 3}-1${i}`, { regions: ['경기'] })),
    notice('w1', '전국 공통 공고', '2027-04-01'),
  ]
  const ms = matchesFor(ns, prof, T2, { includeUpcoming: true })
  const picks: Insight[] = [
    ins('startup-tax', 'maybe', '창업감면 — 2021년분 경정청구 세무사와 검토', '2021년분 창업감면이 신고서에 없어요'),
    ins('policy-funding', 'good', '정책자금 상담 — 중진공 쪽으로 준비', '중진공이 가장 맞아요', { amount: '최대 1억원' }),
    ins('employment', 'need', null, '명부를 올리면'),
    ins('grants', 'maybe', null, '확인하면 맞을 공고 2건'),
    ins('cretop', 'good', null, '크레탑 분석 있음'),
  ]
  const p = buildYearPlan(rec, picks, ms, T2)
  const month = (k: string) => p.months.find((m) => m.key === k)!
  const all = p.months.flatMap((m) => m.items)
  check('YP1 12달 · 2026년 11월 ~ 2027년 10월 · 해 바뀌면 해 이름', p.months.length === 12 && p.range === '2026년 11월 ~ 2027년 10월' && p.months[0].label === '2026년 11월' && p.months[1].label === '12월' && p.months[2].label === '2027년 1월', p.months.map((m) => m.label))
  check('YP2 신청 마감 → 그 달 · 놓치면 끝 · 업체 지원사업 신청 탭', month('2026-12').items.some((x) => x.title === '스마트공장 구축 지원' && x.hard && x.date === '2026-12-10' && x.path.endsWith('?tab=funding')), month('2026-12').items)
  check('YP3 고객 종이: 수금(착수금) · 내부 다음 약속(견적 회신) 없음', !all.some((x) => x.title.includes('착수금') || x.title.includes('견적 회신')), all.map((x) => x.title))
  const late = month('2026-11').items[0]
  check('YP4 지난 기한(30일 안) → 이번 달 맨 위 늦음 · 30일 넘으면 빼기', late.title === '늦은 신청' && late.late && late.detail.startsWith('11.10 지났어요') && !all.some((x) => x.title === '아주 늦은 신청'), month('2026-11').items)
  check('YP5 12달 밖 기한은 빼기 · 결과 발표는 놓치면 끝 아님', !all.some((x) => x.title === '먼 훗날 신청') && month('2027-01').items.some((x) => x.title === '결과 발표 — 결과 기다림' && !x.hard), month('2027-01').items)
  check('YP6 서류 만료(명부 3개월) → 그 달 · 서류 탭 · 놓치면 끝 아님', month('2027-01').items.some((x) => x.title === '4대보험 가입자 명부 만료' && !x.hard && x.path.endsWith('?tab=docs')), month('2027-01').items)
  check('YP7 도구 기한(청년도약 참여신청) → 놓치면 끝', month('2027-02').items.some((x) => x.title === '청년도약 참여신청 마감' && x.hard), month('2027-02').items)
  const grants = all.filter((x) => x.kind === 'grant')
  check('YP8 맞는 공고 마감(조건 맞음 · 확인 필요 — 골라서 보내기와 같은 기준): 서울만 · 지난 공고 · 전국 공통 빼고 · 이미 신청 건(스마트공장)은 한 번만 · 많아야 6건', grants.length === 6 && !grants.some((x) => /서울만|지난 공고|스마트공장|전국 공통/.test(x.title)) && grants.every((x) => x.hard && x.path.startsWith('/grants?open=')), grants.map((x) => x.title))
  check('YP9 공고 줄: 이름 · 마감 · 금액 · 조건', month('2027-02').items.some((x) => x.kind === 'grant' && x.title === '경기 제조 디지털 바우처 마감' && x.detail.startsWith('최대 3천만원')), month('2027-02').items)
  const nov = month('2026-11').items.filter((x) => x.kind === 'propose')
  check('YP10 먼저 제안할 것 → 이번 달(가능성 높음 · 검토해 볼 만함만 · 지원사업 · 크레탑은 따로 안 넣음)', nov.length === 2 && nov.some((x) => x.title === '정책자금 상담 — 중진공 쪽으로 준비' && x.detail === '최대 1억원') && nov.some((x) => x.title.startsWith('창업감면 — 2021년분')) && !all.some((x) => x.title.includes('명부를 올리면')), nov)
  check('YP11 2021년분 경정청구 → 2027-03-31 마감(법인 · 5년) · 놓치면 끝', month('2027-03').items.some((x) => x.title === '2021년분 경정청구 마감 — 창업감면' && x.date === '2027-03-31' && x.hard) && refundDeadline(2021, 'corporation') === '2027-03-31' && refundDeadline(2021, 'individual') === '2027-05-31')
  check('YP12 법인세 신고 달 — 반영 확인: 창업감면(확인 · 짐작한 때)', month('2027-03').items.some((x) => x.title === '법인세 신고 — 반영 확인: 창업감면' && x.approx && !x.hard), month('2027-03').items)
  check('YP13 정책자금이 제안이면 새해 1월 융자 공고 확인(확인)', month('2027-01').items.some((x) => x.title === '새해 정책자금 융자 공고 확인' && x.approx), month('2027-01').items)
  check('YP14 달 안 순서: 늦음 → 날짜 → 달 안 아무 때나', month('2026-11').items.map((x) => x.late ? 'late' : x.date ? 'date' : 'any').join(',').replace(/,?date/g, '') === 'late,any,any' || month('2026-11').items[0].late, month('2026-11').items.map((x) => x.title))
  check('YP15 합계 · 놓치면 끝 수', p.total === all.length && p.hardCount === all.filter((x) => x.hard).length && p.months.every((m) => m.hardCount === m.items.filter((x) => x.hard).length))

  // 지난 해분 경정청구(2020년분 → 2026-03-31 지남)는 넣지 않는다 · 개인사업자는 종합소득세 5월
  const indiv = normalizeClientOps({ id: 'yp2', companyName: '새봄상회', status: 'active', businessNumber: '123-45-67890' } as never)
  const pi = buildYearPlan(indiv, [ins('startup-tax', 'maybe', '창업감면 — 2020년분 경정청구 세무사와 검토'), ins('labcare', 'good', '연구소 — 연구개발비 세액공제 챙기기')], [], T2)
  const ai = pi.months.flatMap((m) => m.items)
  check('YP16 개인: 2020년분 경정청구 마감(2026-05-31) 지남 → 안 넣음', !ai.some((x) => x.title.includes('경정청구 마감')), ai.map((x) => x.title))
  check('YP17 개인: 종합소득세 신고 5월 31일 — 창업감면 · 연구개발비 세액공제', ai.some((x) => x.date === '2027-05-31' && x.title === '종합소득세 신고 — 반영 확인: 창업감면 · 연구개발비 세액공제'), ai)
  check('YP18 정책자금 제안 없으면 새해 공고 줄 없음', !ai.some((x) => x.title.includes('새해 정책자금')))
  // 1월에 열면 새해 공고 줄은 따로 안 넣음(이번 달 제안이 곧 그것)
  const pj = buildYearPlan(rec, [ins('policy-funding', 'good', '정책자금 상담')], [], '2027-01-05')
  check('YP19 1월에 열면 새해 공고 줄 없음 · 범위 2027년 1월 ~ 12월', !pj.months.flatMap((m) => m.items).some((x) => x.title.includes('새해 정책자금')) && pj.range === '2027년 1월 ~ 2027년 12월', pj.range)
  // 판정 없는 빈 업체 — 빈 일정표(지어내지 않음)
  const blank = buildYearPlan(normalizeClientOps({ id: 'yp3', companyName: '빈상사', status: 'active' } as never), [], [], T2)
  check('YP20 빈 업체: 할 일 0 · 12달은 그대로', blank.total === 0 && blank.months.length === 12)

  const k = yearPlanKakao(p, '담당 김대리')
  check('YP21 카톡: 회사 · 기간 · 일 있는 달만 · 놓치면 끝 · 확인 · 안내 · 서명', k.startsWith('한빛정밀 대표님, 앞으로 1년 자금 일정을 정리했어요(2026년 11월 ~ 2027년 10월).') && k.includes('[12월]') && k.includes('· 12.10 스마트공장 구축 지원 (놓치면 끝)') && k.includes('새해 정책자금 융자 공고 확인 (확인)') && !k.includes('[2027년 10월]') && k.includes('※ 선정 · 승인 · 환급을 약속하는 일정이 아니에요.') && k.trim().endsWith('담당 김대리'), k)
  check('YP22 카톡: 수수료 · AI 말 없음', !/착수금|수수료|AI/.test(k))
  check('YP23 빈 업체 카톡: 지금은 정해진 기한 없음', yearPlanKakao(blank).includes('지금은 정해진 기한이 없어요'))
  check('YP24 한 줄 글: 늦음 · 날짜 · 달 안', yearItemText(late).startsWith('늦음 늦은 신청') && yearItemText(month('2026-12').items[0]).startsWith('12.'), [yearItemText(late), yearItemText(month('2026-12').items[0])])
  // 할 일 문장이 없는 제안(검토해 볼 만함) — 제목은 짧게, 긴 판정 문장은 아래 한 줄
  const pn = buildYearPlan(rec, [ins('labcare', 'maybe', null, '연구소 설립 — 기업 규모(소기업 · 중기업) · 연구전담요원 후보(학위 · 전공 · 경력)만 확인하면 돼요', { amount: '연 1,200만원' })], [], T2)
  const lab = pn.months[0].items.find((x) => x.kind === 'propose')
  check('YP25 할 일 문장 없는 제안: 제목 "연구소 검토" · 아래 줄 금액 · 판정 문장', lab?.title === '연구소 검토' && lab.detail.startsWith('연 1,200만원 · 연구소 설립 — 기업 규모'), lab)
}

/* ---------------- D-641 떨어진 신청 — 까닭 기록 · 다음 해 다시 도전 ---------------- */
{
  const T3 = '2026-11-21'
  // 이름 뼈대 — 해 · 차수 · 반기 · 공고 꾸밈말을 빼면 같은 사업
  check('RT1 이름 뼈대: 2025년도 · 2차 · 모집 공고 · [경기] 빼면 같음', programKey('[경기] 2025년도 스마트공장 구축 지원사업 2차 모집 공고') === programKey('2026년 스마트공장 구축 지원사업 공고'), [programKey('[경기] 2025년도 스마트공장 구축 지원사업 2차 모집 공고'), programKey('2026년 스마트공장 구축 지원사업 공고')])
  check('RT2 같은 사업: 상반기/하반기 · 재공고 · 띄어쓰기 · (공고)', sameProgramAcrossYears('2025년 하반기 수출바우처 사업 참여기업 모집', '2026 상반기 수출 바우처 사업(재공고)') && sameProgramAcrossYears('청년창업사관학교 15기 입교생 모집', '2026년 청년창업사관학교 입교생 모집') === false)
  check('RT3 다른 사업: 짧은 뼈대(4자 미만) · 다른 이름은 아님', !sameProgramAcrossYears('2026년 공고', '2027년 공고') && !sameProgramAcrossYears('스마트공장 구축 지원', '스마트상점 기술보급'))
  check('RT4 긴 뼈대가 다른 쪽에 통째로 — 같은 사업', sameProgramAcrossYears('경기도 수출바우처', '2026년 경기도 수출바우처 지원사업'))

  const rec0 = normalizeClientOps({
    id: 'rt1',
    companyName: '새솔기계',
    status: 'active',
    corporateNumber: '110111-7654321',
    businessAddress: '경기도 화성시 향남읍 1',
    industry: '제조업',
    establishedAt: '2019-05-01',
    fundingApplications: [
      { id: 'r1', programName: '2025년 스마트공장 구축 지원사업', status: 'rejected', applyDueDate: '2025-12-12', resultAt: '2026-02-20', institution: '경기도', noticeId: 'old1' },
      { id: 'r2', programName: '2025 수출바우처', status: 'rejected', applyDueDate: '2025-04-30', institution: '' },
      { id: 'r3', programName: '포기한 사업', status: 'given_up', applyDueDate: '2025-06-01', institution: '' },
    ],
  } as never)
  check('RT5 기준 날 · 다음 해 그 달(짐작)', expectedRetryMonth(rec0.fundingApplications[0]) === '2026-12' && expectedRetryMonth(rec0.fundingApplications[1]) === '2026-04')

  // 까닭 적기 — 고른 것 · 메모 · 다시 도전
  const rec1 = withRejectInfo(rec0, 'r1', { reasons: ['plan', 'docs', 'plan', 'bad' as never], note: '  발표 때 매출 근거 질문에 답을 못 함  ', retryPlan: 'retry' }, '2026-11-21T01:00:00Z')
  const r1 = rec1.fundingApplications.find((a) => a.id === 'r1')!
  check('RT6 까닭 적기: 겹침 · 모르는 값 빼고 · 메모 다듬고 · 다시 도전', JSON.stringify(r1.rejectReasons) === '["plan","docs"]' && r1.rejectNote === '발표 때 매출 근거 질문에 답을 못 함' && r1.retryPlan === 'retry', r1)
  check('RT7 까닭 한 줄 · 이번엔 이것부터', rejectReasonText(r1) === "사업계획서 · 발표 · 서류 빠짐 · 늦음 — '발표 때 매출 근거 질문에 답을 못 함'" && retryTips(r1).length === 2 && retryTips(r1)[0].includes('사업계획서'), [rejectReasonText(r1), retryTips(r1)])
  const cleared = withRejectInfo(rec1, 'r1', { reasons: [], note: ' ', retryPlan: 'skip' }, '2026-11-21T02:00:00Z').fundingApplications.find((a) => a.id === 'r1')!
  check('RT8 비우면 지움 · 다시 도전 접기', cleared.rejectReasons === undefined && cleared.rejectNote === undefined && cleared.retryPlan === 'skip')
  const long = withRejectInfo(rec0, 'r2', { reasons: ['score'], note: '가'.repeat(260), retryPlan: 'retry' }, '2026-11-21T01:00:00Z').fundingApplications.find((a) => a.id === 'r2')!
  check('RT9 메모 200자까지 · 저장했다 다시 읽어도 그대로', long.rejectNote?.length === 200 && (() => {
    const back = normalizeClientOps(JSON.parse(JSON.stringify(rec1)) as never).fundingApplications.find((a) => a.id === 'r1')!
    return JSON.stringify(back.rejectReasons) === JSON.stringify(r1.rejectReasons) && back.rejectNote === r1.rejectNote && back.retryPlan === r1.retryPlan
  })())
  check('RT9b 다음 회차 짐작: 그 사이 회차가 지났으면 그다음 해', expectedRetryMonth(rec0.fundingApplications[1], '2026-11-21') === '2027-04' && expectedRetryMonth(rec0.fundingApplications[0], '2026-11-21') === '2026-12')

  // 다시 올라온 공고
  const nt = (id: string, title: string, start: string, end: string, rules: Partial<GrantRules> = {}) => normalizeNotice({ id, title, agency: '경기도', applyStart: start, applyEnd: end, deadlineKind: 'date', amountText: '최대 5천만원', rules: { ...rules } }, id, T3)!
  const ns3 = [
    nt('old1', '2025년 스마트공장 구축 지원사업', '2025-11-01', '2025-12-12'),
    nt('new1', '[경기] 2026년도 스마트공장 구축 지원사업 모집 공고', '2026-11-10', '2026-12-15', { regions: ['경기'] }),
    nt('new1b', '2026 스마트공장 구축 지원사업 2차', '2027-03-01', '2027-03-31', { regions: ['경기'] }),
    nt('seoul', '2026 수출바우처', '2026-11-01', '2026-12-30', { regions: ['서울'] }),
    nt('other', '스마트상점 기술보급', '2026-11-01', '2026-12-20'),
  ]
  const ms3 = matchesFor(ns3, profileOfRecord(rec1, T3), T3, { includeUpcoming: true })
  const hits = retryHits(rec1, ms3)
  check('RT10 다시 올라온 공고: 같은 사업 · 마감 가까운 것 · 작년 공고(마감)는 아님 · 조건 안 맞는(서울) 공고는 아님', hits.length === 1 && hits[0].app.id === 'r1' && hits[0].match.notice.id === 'new1', hits.map((h) => [h.app.id, h.match.notice.id]))
  check('RT11 다시 도전 접으면 알리지 않음', retryHits(withRejectInfo(rec1, 'r1', { reasons: ['plan'], note: '', retryPlan: 'skip' }, '2026-11-21T03:00:00Z'), ms3).length === 0)
  check('RT12 포기한 건 · 진행 중인 건은 다시 도전 대상 아님', rejectedTwinOf(rec1, { id: 'x', title: '포기한 사업' }) === null)

  // 공고로 신청 준비 → 떨어진 건에 이어짐 · 다시 올라와도 두 번 알리지 않음
  const prep = withGrantApplication(rec1, hits[0].match.notice)
  check('RT13 [신청 준비] → 떨어진 건에 이음(retryOf) · 이번엔 이것부터를 그 건에서', prep.created && prep.app.retryOf === 'r1' && retrySourceOf(prep.record, prep.app)?.id === 'r1', prep.app)
  check('RT14 다시 신청 중이면 다시 올라왔다고 또 알리지 않음', retryHits(prep.record, ms3).length === 0)
  const bm = withGrantChallenge(rec1, hits[0].match.notice)
  check('RT15 [도전해 볼 만함](확인할 것 [다시 도전]) 도 이음 · 활동 기록 "다시 도전"', bm.app.retryOf === 'r1' && bm.record.activity[0].text.startsWith('지원사업 다시 도전 체크'), [bm.app.retryOf, bm.record.activity[0]?.text])
  const plain = withGrantApplication(rec1, ns3[4])
  check('RT16 다른 사업 공고는 잇지 않음', plain.app.retryOf === undefined)

  // 오늘 '확인할 것' — 다시 도전할까요?(지난 까닭 같이) · 같은 공고를 '도전해 볼까요?' 로 또 묻지 않음
  const ds = buildDecisions(rec1, T3, ns3)
  const rt = ds.find((d) => d.id === 'retry:new1')
  check('RT17 확인할 것: "작년에 떨어진 … 다시 올라왔어요" · 지난 까닭 · [다시 도전] · 신청 탭으로', !!rt && rt.title.includes('작년에 떨어진') && rt.why.includes('지난번: 사업계획서 · 발표') && rt.yesLabel === '다시 도전' && rt.openPath === '/ops/clients/rt1?tab=funding' && !ds.some((d) => d.id === 'grant:new1'), ds.map((d) => d.id))
  const answered = withDecisionAnswer(rec1, rt!, 'yes', ns3, '2026-11-21T04:00:00Z')
  const made = answered.fundingApplications.find((a) => a.noticeId === 'new1')
  check('RT18 [다시 도전] → 지켜보는 건(마감이 일정 · 오늘에) · 떨어진 건에 이음', made?.status === 'watching' && made.retryOf === 'r1', made)
  check('RT19 까닭을 안 적었으면 "까닭을 아직 안 적었어요"', (buildDecisions(rec0, T3, ns3).find((d) => d.id === 'retry:new1')?.why ?? '').includes('까닭을 아직 안 적었어요'))
  check('RT20 지원사업 알림을 못 쓰는 계정은 묻지 않음', !buildDecisions(rec1, T3, ns3, (k) => k !== 'grants').some((d) => d.id.startsWith('retry:')))

  // 1년 일정표 — 다시 올라온 공고 마감 '다시 도전' · 아직이면 작년 그 달 '공고 확인'(짐작) · 까닭은 고객 종이에 안 씀
  const yp = buildYearPlan(rec1, [], ms3, T3)
  const yall = yp.months.flatMap((m) => m.items)
  const reGrant = yall.find((x) => x.id === 'gr:new1' || x.id === 'rt:new1')
  check('RT21 일정표: 다시 올라온 공고 마감(12.15) · "다시 도전" · 놓치면 끝', !!reGrant && reGrant.date === '2026-12-15' && reGrant.detail.startsWith('다시 도전') && reGrant.hard, reGrant)
  const exp = yall.find((x) => x.id === 'ra:r2')
  check('RT22 일정표: 아직 안 올라온 사업은 작년 그 달(2027년 4월) "다시 도전 · 공고 확인"(확인)', !!exp && exp.month === '2027-04' && exp.approx && exp.title.includes('다시 도전 · 공고 확인'), exp)
  check('RT23 고객 종이(일정표 · 카톡)에 떨어진 까닭 · 메모 0', !yall.some((x) => /발표 때 매출|사업계획서 · 발표|서류 빠짐/.test(`${x.title} ${x.detail}`)) && !/발표 때 매출|서류 빠짐/.test(yearPlanKakao(yp)))
  const ypSkip = buildYearPlan(withRejectInfo(rec1, 'r2', { reasons: [], note: '', retryPlan: 'skip' }, '2026-11-21T05:00:00Z'), [], ms3, T3)
  check('RT24 다시 도전 접은 건은 일정표에도 없음', !ypSkip.months.flatMap((m) => m.items).some((x) => x.id === 'ra:r2'))
  check('RT25 다시 신청 중이면 일정표 "다시 도전 · 공고 확인" 줄 없음', !buildYearPlan(withGrantApplication(rec1, ns3[1]).record, [], ms3, T3).months.flatMap((m) => m.items).some((x) => x.id === 'ra:r1'))
}

console.log(`\ngrants: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
