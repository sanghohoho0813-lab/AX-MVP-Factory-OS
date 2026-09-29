/**
 * 연구소 사후관리 도구 — 옮겨 온 규칙이 원본 그대로 도는지 확인하는 셀프테스트.
 *
 * 실행: npm run test:labcare
 * 근거 표: 2026 업무편람 연구전담요원 인원 기준 (시행령 제6조 제1항)
 */
import type { CheckAnswers, Client, FeasibilityInput, ResearcherCandidate } from '../types'
import { assessCeo, assessFeasibility, requiredForLab } from '../lib/feasibility'
import { computeLevel, evaluateRisk } from '../lib/riskEngine'
import { getTaxCreditEstimate } from '../lib/taxCredit'
import { addMonthsClamped, changeDeadlineOf, daysBetween, ddayOf, isCheckDue, nextCheckDate, parseYmd, ymdLocal, ymLocal } from '../lib/deadlines'
import { businessAgeLabel, withinStartupYears } from '../lib/startup'
import { monthsInBusiness } from '../../shared/clientPrefill'
import { addChangeRecord, currentMonth as storageCurrentMonth, nextCheckDate as storageNextCheckDate } from '../orig/lib/storage'
import { DOC_MASTER, buildTempPackage, docProgressOf, fewerThanTen, missingDocs, stageOf, type SetupDoc } from '../lib/documents'
import { RESOURCE_TEMPLATES, fillTemplate } from '../lib/templates'
import { INSPECTION_ITEMS, INSPECTION_POINTS } from '../lib/inspection'
import { checkRelevance, currentMonth, enhanceForAudit, generateNoteDraft, NOTE_STATUSES } from '../lib/noteDraft'
import { dedicatedCount, emptyLabInfo, minResearchers, researcherWarning } from '../lib/labInfo'
import { buildLabTasks, currentYear } from '../lib/labTasks'
import { monthlyReportText } from '../lib/monthlyReport'
import { surveyRequestText } from '../lib/surveyText'
import { BENEFIT_OPTIONS, composeBenefitText } from '../lib/report'
import { DEFAULT_ANSWERS, REASONS, mapChangeStatus } from '../lib/changes'
import { isExcludedIndustryText, newCandidate } from '../lib/assessmentOptions'

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/* ───────────────── 1. requiredForLab — 편람 인원 기준 표 ───────────────── */

type ReqInput = Parameters<typeof requiredForLab>[0]
const REQ_BASE: ReqInput = { companySize: '소기업', isVenture: false, isResearcherFounded: false, businessMonths: 24, becameMediumWithinYear: false, isOverseasLab: false }

check('소기업 창업 36개월 이내 → 2명', requiredForLab({ ...REQ_BASE, companySize: '소기업', businessMonths: 36 }) === 2)
check('소기업 창업 36개월 초과 → 3명', requiredForLab({ ...REQ_BASE, companySize: '소기업', businessMonths: 37 }) === 3)
check('중기업 → 5명', requiredForLab({ ...REQ_BASE, companySize: '중기업', businessMonths: 60 }) === 5)
check('중기업 전환 1년 이내 → 3명', requiredForLab({ ...REQ_BASE, companySize: '중기업', businessMonths: 60, becameMediumWithinYear: true }) === 3)
check('중견기업 → 7명', requiredForLab({ ...REQ_BASE, companySize: '중견기업', businessMonths: 120 }) === 7)
check('대기업 → 10명', requiredForLab({ ...REQ_BASE, companySize: '대기업', businessMonths: 120 }) === 10)
check('벤처기업 → 2명 (규모 무관)', requiredForLab({ ...REQ_BASE, companySize: '중기업', businessMonths: 120, isVenture: true }) === 2)
check('해외소재 연구소 → 5명 (벤처보다 우선)', requiredForLab({ ...REQ_BASE, companySize: '소기업', isVenture: true, isOverseasLab: true }) === 5)

/* ───────────────── 2. assessCeo ───────────────── */

function cand(p: Partial<ResearcherCandidate> = {}): ResearcherCandidate {
  return { ...newCandidate(), name: '홍길동', dutyDescription: '시제품 설계·시험', ...p }
}

const ceoCand = cand({ isCeo: true, education: '학사', major: '공학계열' })
const ceoEarly = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 24, candidates: [ceoCand] })
check('대표자 · 창업 3년 이내 소기업 · 공학 학사 → 가능성 있음', ceoEarly.verdict === '가능성 있음', ceoEarly.verdict)
check('대표자 카드에 3년 경과 안내가 붙는다', ceoEarly.threeYearNote.length > 0)

const ceoLate = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 48, candidates: [ceoCand] })
check('대표자 · 창업 3년 경과 소기업 → 인정 어려움', ceoLate.verdict === '인정 어려움', ceoLate.verdict)
check('3년 경과 사유 문구', ceoLate.basis.includes('3년이 경과한 소기업'), ceoLate.basis)

const ceoMid = assessCeo({ companySize: '중견기업', industryField: '과학기술 분야', businessMonths: 12, candidates: [ceoCand] })
check('대표자 · 중견기업 → 인정 어려움 (창업 3년 이내라도)', ceoMid.verdict === '인정 어려움', ceoMid.verdict)
check('중견기업 사유 문구', ceoMid.basis.includes('중견기업'), ceoMid.basis)

const ceoNone = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 12, candidates: [cand()] })
check('대표자 후보 없음 → 해당 없음', ceoNone.verdict === '해당 없음' && ceoNone.applicable === false)

/* ───────────────── 3. assessFeasibility ───────────────── */

const FULL: FeasibilityInput = {
  desiredType: '아직 모름',
  companyName: '미래산업',
  industry: '제조업',
  industryField: '과학기술 분야',
  isExcludedIndustry: false,
  companySize: '소기업',
  isVenture: false,
  isResearcherFounded: false,
  businessMonths: 60,
  becameMediumWithinYear: false,
  employeeCount: 12,
  isOverseasLab: false,
  isForProfit: true,
  hasBusinessOps: true,
  rndOnlyCompany: false,
  isSubUnit: true,
  projectName: '자동 검사 장비 개발',
  preCommercial: true,
  activityNature: '새로운 제품·공정·서비스 개발',
  negativeActivities: [],
  hasSpace: true,
  independentSpace: true,
  fixedWallsAndDoor: true,
  movableWallPossible: false,
  spaceUnder50: true,
  adequateArea: true,
  equipmentInSpace: true,
  isInfoServiceOrSW: false,
  candidates: [cand({ name: '가' }), cand({ name: '나', education: '석사', major: '자연계열' }), cand({ name: '다', education: '고졸 이하', major: '비이공계', cert: '기사 이상' })],
}

const full = assessFeasibility(FULL)
check('소기업 5년차 · 자격 후보 3명 → 기업부설연구소 가능', full.verdict === '기업부설연구소 가능', full.verdict)
check('추천 경로 = 기업부설연구소', full.recommendedType === '기업부설연구소', full.recommendedType)
check('연구소 기준 필요 3명 · 인정 가능 3명 · 부족 0', full.requiredForLab === 3 && full.eligibleCount === 3 && full.shortage === 0, `${full.requiredForLab}/${full.eligibleCount}/${full.shortage}`)
check('요약은 단정하지 않는다 ("현재 입력 기준")', full.summary.includes('현재 입력 기준') && !full.summary.includes('인정됩니다'))
check('세 구역 모두 양호', full.eligibility.verdict === '신고대상으로 보임' && full.activity.verdict === '연구개발활동 적합' && full.facility.verdict === '물적요건 충족')

const oneCand = assessFeasibility({ ...FULL, candidates: [cand({ name: '가' })] })
check('자격 후보 1명 → 연구개발전담부서 우선 추천', oneCand.verdict === '연구개발전담부서 우선 추천', oneCand.verdict)
check('추천 경로 = 전담부서 선설립 후 연구소 전환', oneCand.recommendedType === '전담부서 선설립 후 연구소 전환', oneCand.recommendedType)
check('전략에 인원 기준 대비 문구', oneCand.strategy.some((s) => s.includes('인원 기준(3명)')), oneCand.strategy.join('|'))

const blocked = assessFeasibility({ ...FULL, isExcludedIndustry: true })
check('제외 업종 → 현재 진행 비추천', blocked.verdict === '현재 진행 비추천' && blocked.recommendedType === '추가 검토', blocked.verdict)

const noSpace = assessFeasibility({ ...FULL, hasSpace: false })
check('연구공간 없음 → 보완 후 가능', noSpace.verdict === '보완 후 가능', noSpace.verdict)
check('보완 항목에 공간 확보 안내', noSpace.improvements.some((s) => s.includes('공간 확보')))

const partTime = assessFeasibility({ ...FULL, candidates: [cand({ fullTime: false })] })
check('비상근 후보만 → 현재 진행 비추천 (인정 가능·확인 필요 0)', partTime.verdict === '현재 진행 비추천', partTime.verdict)

const uninsured = assessFeasibility({ ...FULL, candidates: [cand({ insured: false })] })
check('4대보험 미확인 후보만 → 추가 확인 필요', uninsured.verdict === '추가 확인 필요' && uninsured.reviewCount === 1, uninsured.verdict)

const banned = JSON.stringify(full) + JSON.stringify(oneCand) + JSON.stringify(blocked) + JSON.stringify(noSpace)
check('금지 표기 "기초연구진흥법" 없음', !banned.includes('기초' + '연구진흥법'))
check('점수형 표기(00점) 없음', !/\d+점/.test(banned))

/* ───────────────── 4. computeLevel / evaluateRisk ───────────────── */

const ok: CheckAnswers = { ...DEFAULT_ANSWERS }
check('기본 응답 → 정상', computeLevel(ok) === '정상')
check('연구과제 공백만 → 주의', computeLevel({ ...ok, projectOngoing: false }) === '주의')
check('연구노트 미작성만 → 위험', computeLevel({ ...ok, researchNotesWritten: false }) === '위험')
check('연구전담요원 변동 → 즉시 확인', computeLevel({ ...ok, personnelChange: true }) === '즉시 확인')
check('연구노트 미작성 + 증빙 미흡 → 즉시 확인', computeLevel({ ...ok, researchNotesWritten: false, expenseEvidenceOrganized: false }) === '즉시 확인')

const worst = evaluateRisk({ ...ok, researchNotesWritten: false, spaceChange: true, taxDocsPrepared: false, surveyResponseNeeded: true, projectOngoing: false })
check('요인 정렬: 심각도 high → medium → low', worst.factors.map((f) => f.severity).join(',') === 'high,high,medium,medium,low', worst.factors.map((f) => f.severity).join(','))
check('같은 심각도면 점수 높은 순 (연구노트 35 → 공간 22)', worst.factors[0].key === 'researchNotes' && worst.factors[1].key === 'spaceChange', worst.factors.map((f) => f.key).join(','))
check('medium 안에서도 점수순 (과제 18 → 조사 15)', worst.factors[2].key === 'projectOngoing' && worst.factors[3].key === 'surveyResponse')
check('요인마다 detail·action 이 있다', worst.factors.every((f) => f.detail.length > 0 && f.action.length > 0))
check('점수는 100 을 넘지 않는다', worst.score <= 100 && worst.level === '즉시 확인')
check('정상 응답은 요인 0개', evaluateRisk(ok).factors.length === 0)

/* ───────────────── 5. getTaxCreditEstimate ───────────────── */

function client(p: Partial<Client>): Client {
  return { id: 'c', name: '', industry: '', labType: '기업부설연구소', ceoName: '', address: '', certifiedDate: '', researcherCount: 0, labName: '', consultant: '', createdAt: '', ...p }
}

const t25 = getTaxCreditEstimate(client({ researchersPayrollTotal: 100_000_000, rndMaterialCost: 20_000_000, taxCreditCategory: '일반 R&D' }))
check('일반 R&D 25%: 1.2억 → 3,000만원', t25.rate === 25 && t25.totalRnd === 120_000_000 && t25.annual === 30_000_000, `${t25.rate}/${t25.totalRnd}/${t25.annual}`)
check('월·일 환산', t25.monthly === 2_500_000 && t25.daily === Math.round(30_000_000 / 365), `${t25.monthly}/${t25.daily}`)
const t30 = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCreditCategory: '신성장·원천기술' }))
check('신성장·원천기술 30%: 1억 → 3,000만원', t30.rate === 30 && t30.annual === 30_000_000)
const t40 = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCreditCategory: '국가전략기술', businessType: '개인사업자' }))
check('국가전략기술 40%: 1억 → 4,000만원 · 개인은 종합소득세', t40.rate === 40 && t40.annual === 40_000_000 && t40.taxType === '종합소득세')
const tOverride = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCreditCategory: '일반 R&D', estimatedTaxCreditRate: 10 }))
check('공제율 직접 지정이 우선', tOverride.rate === 10 && tOverride.annual === 10_000_000)
const tNone = getTaxCreditEstimate(client({}))
check('입력 없음 → available=false · 미정은 25% 예시', tNone.available === false && tNone.rate === 25 && tNone.category === '미정')
check('가정 문구는 확정 표현이 아니다', t25.assumptions.every((a) => !a.includes('됩니다')) && t25.assumptions.length >= 3)

/* ───────────────── 6. ddayOf 5갈래 ───────────────── */

function shift(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return ymdLocal(d)
}
const dOver = ddayOf(shift(-1))
check('어제 기한 → 기한초과/over', dOver.label === '기한초과' && dOver.tone === 'over' && dOver.daysLeft === -1, JSON.stringify(dOver))
const dToday = ddayOf(shift(0))
check('오늘 → D-day/danger', dToday.label === 'D-day' && dToday.tone === 'danger' && dToday.daysLeft === 0, JSON.stringify(dToday))
const d7 = ddayOf(shift(7))
check('7일 → D-7/danger', d7.label === 'D-7' && d7.tone === 'danger', JSON.stringify(d7))
const d14 = ddayOf(shift(14))
check('14일 → D-14/warn', d14.label === 'D-14' && d14.tone === 'warn', JSON.stringify(d14))
const d30 = ddayOf(shift(30))
check('30일 → D-30/ok', d30.label === 'D-30' && d30.tone === 'ok', JSON.stringify(d30))

check('변경신고 기한 = 발생일 + 30일', changeDeadlineOf('2026-01-15') === '2026-02-14' && changeDeadlineOf('2026-12-10') === '2027-01-09')
check('다음 확인 예정일 = (마지막 확인 + 주기) 달의 말일', nextCheckDate({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-01-15' }) === '2026-02-28' && nextCheckDate({ clientId: 'x', cycleMonths: 3, lastCheck: '2026-01-15' }) === '2026-04-30')
check('변경기록 상태 → 화면 표시 매핑', mapChangeStatus('변경 예정') === '고객 자료요청' && mapChangeStatus('신고 준비중') === '작성중' && mapChangeStatus('신고 완료') === '신고 완료')
check('변경사유 7종', REASONS.length === 7 && REASONS[0] === '연구전담요원 퇴사')

/* ───────────────── 7. stageOf / docProgressOf / missingDocs / DOC_MASTER ───────────────── */

check('stageOf 경계', stageOf(0) === '가능성 체크 완료' && stageOf(14) === '가능성 체크 완료' && stageOf(15) === '서류 준비중' && stageOf(39) === '서류 준비중' && stageOf(40) === '조직도/도면 필요' && stageOf(69) === '조직도/도면 필요' && stageOf(70) === '최종 검토' && stageOf(99) === '최종 검토' && stageOf(100) === '신고 준비 완료')

const small = buildTempPackage({ id: 'a', name: 'A', labType: '기업부설연구소', researcherCount: 3 })
check('DOC_MASTER 항목 수 24~28', DOC_MASTER.length >= 24 && DOC_MASTER.length <= 28, String(DOC_MASTER.length))
check('연구원 10명 미만 → 안전관리비·보험가입보고서 해당 없음', small.docs.find((d) => d.key === 'safety')?.status === '해당 없음' && small.docs.find((d) => d.key === 'safetyInsurance')?.status === '해당 없음')
const big = buildTempPackage({ id: 'b', name: 'B', labType: '기업부설연구소', researcherCount: 10 })
check('연구원 10명 이상 → 안전관리비 준비중', big.docs.find((d) => d.key === 'safety')?.status === '준비중')
check('임시 패키지는 모두 준비중으로 시작 · 준비율 0 · 단계 가능성 체크 완료', docProgressOf(small.docs) === 0 && small.stage === '가능성 체크 완료')

const half: SetupDoc[] = small.docs.map((d, i) => ({ ...d, status: d.status === '해당 없음' ? d.status : i % 2 === 0 ? '완료' : d.status }))
const applicable = half.filter((d) => d.status !== '해당 없음').length
const done = half.filter((d) => d.status === '완료').length
check('준비율 = 완료 / 해당 없음 제외', docProgressOf(half) === Math.round((done / applicable) * 100))
check('전부 해당 없음이면 100', docProgressOf(small.docs.map((d) => ({ ...d, status: '해당 없음' as const }))) === 100)

const withRequests: SetupDoc[] = small.docs.map((d) => (d.key === 'biz' || d.key === 'projectName' || d.key === 'career' ? { ...d, status: '고객 요청중' } : d))
const miss = missingDocs({ ...small, docs: withRequests })
check('누락 = 고객 요청중 중 작성보조 제외 (biz·career 만)', miss.length === 2 && miss.every((d) => d.cls !== '작성보조'), miss.map((d) => d.key).join(','))

/* ───────────────── 8. 템플릿 · 실사 · 혜택 ───────────────── */

check('안내문 11종', RESOURCE_TEMPLATES.length === 11)
check('템플릿 id 중복 없음', new Set(RESOURCE_TEMPLATES.map((t) => t.id)).size === 11)
const filled = fillTemplate(RESOURCE_TEMPLATES[1].body, { 고객사명: '미래산업', 월: '2026년 9월', 기한: '9월 25일' })
check('자리표시자 치환', filled.includes('미래산업 담당자님께') && filled.includes('2026년 9월 활동') && filled.includes('9월 25일까지') && !filled.includes('{'))
const partial = fillTemplate(RESOURCE_TEMPLATES[1].body, { 고객사명: '미래산업' })
check('비운 자리표시자는 그대로 남는다', partial.includes('미래산업') && partial.includes('{월}') && partial.includes('{기한}'))
check('템플릿 본문에 금지 표기 없음', RESOURCE_TEMPLATES.every((t) => !t.body.includes('기초' + '연구진흥법')))

check('현장조사 항목 12개 · 3대 포인트', INSPECTION_ITEMS.length === 12 && INSPECTION_POINTS.length === 3)
check('포인트별 5/4/3', INSPECTION_ITEMS.filter((i) => i.point === '사람').length === 5 && INSPECTION_ITEMS.filter((i) => i.point === '공간').length === 4 && INSPECTION_ITEMS.filter((i) => i.point === '활동').length === 3)

check('추가 혜택 11종', BENEFIT_OPTIONS.length === 11)
check('혜택 문장은 검토 톤 (됩니다 단정 없음)', BENEFIT_OPTIONS.every((o) => o.sentence.includes('검토') || o.sentence.includes('점검') || o.sentence.includes('확인') || o.sentence.includes('활용')))
const composed = composeBenefitText(['patent', 'welfareFund'])
check('혜택 문장 조합은 표 순서 유지', composed.split('\n').length === 2 && composed.startsWith('사내근로복지기금'))

/* ---- D-91 3단계: 연구노트 · 연구소 정보 · 오늘 할 일 · 리포트 ---- */
{
  const project = { name: '열처리 공정 개선', productService: '자동차 부품 열처리' }
  const input = {
    month: '2026-09',
    activities: '열처리 온도 구간을 3단계로 나누어 시험하고 경도 변화를 측정했다',
    tests: '샘플 12개 경도 측정',
    problems: '고온 구간에서 변형 발생',
    nextPlan: '냉각 속도 조절 시험',
    roles: [{ name: '박연구', role: '시험 설계' }],
    relevance: '자동차 부품 열처리 공정의 불량률을 낮추기 위한 활동',
  }
  const draft = generateNoteDraft(input, '한솔테크(주)', project)
  check('연구노트: 여섯 칸이 순서대로 들어간다', ['1. 이번 달 연구개발 활동', '2. 테스트 및 개선', '3. 확인된 문제점', '4. 참여 연구원별 역할', '5. 업종·제품·서비스와의 직접 관련성', '6. 다음 달 연구 계획'].every((h) => draft.includes(h)))
  check('연구노트: 업체·과제가 머리에 붙는다', draft.includes('한솔테크(주)') && draft.includes('열처리 공정 개선'))
  check('연구노트: 빈 칸은 미입력이라고 적는다', generateNoteDraft({ ...input, tests: '' }, '한솔테크(주)', project).includes('(테스트/개선 미입력)'))
  const audited = enhanceForAudit(draft, project)
  check('연구노트: 실사 보완이 뒤에 붙는다', audited.includes('[실사 대응 보완]') && audited.length > draft.length)
  check('연구노트: 상태 다섯 가지', NOTE_STATUSES.length === 5 && NOTE_STATUSES[0] === '작성 필요')
  check('연구노트: 이번 달은 YYYY-MM', /^\d{4}-\d{2}$/.test(currentMonth(new Date('2026-09-23T00:00:00'))))

  const weak = checkRelevance({ activities: '연구함', relevance: '짧음' }, project)
  check('연구노트: 일반적인 서술은 짚어 준다', !weak.ok && weak.hints.length >= 2, JSON.stringify(weak.hints))
  const strong = checkRelevance({ activities: input.activities, relevance: input.relevance }, project)
  check('연구노트: 구체적이면 아무 말 안 한다', strong.ok, JSON.stringify(strong.hints))

  // 연구소 정보
  const info = emptyLabInfo()
  check('연구소: 기본은 기업부설연구소 · 최소 2명', info.labType === '기업부설연구소' && minResearchers('기업부설연구소') === 2 && minResearchers('연구개발전담부서') === 1)
  check('연구소: 비밀번호 칸이 없다', Object.keys(info).every((k) => !/password|비밀번호/i.test(k)))
  check('연구소: 사람이 없으면 그렇게 말한다', researcherWarning(info).includes('아직 적지 않았습니다'))
  const one = { ...info, researchers: [{ name: '박연구', role: '연구전담요원', joinDate: '2026-01-02', dedicated: true }] }
  check('연구소: 전담 1명이면 모자란다고 말한다', researcherWarning(one).includes('2명 이상') && dedicatedCount(one) === 1)
  const two = { ...one, researchers: one.researchers.concat([{ name: '최연구', role: '연구전담요원', joinDate: '2026-02-02', dedicated: true }]) }
  check('연구소: 전담 2명이면 아무 말 안 한다', researcherWarning(two) === '')
  const mixed = { ...one, researchers: one.researchers.concat([{ name: '겸직', role: '연구전담요원', joinDate: '2026-02-02', dedicated: false }]) }
  check('연구소: 겸직은 전담 수에 안 센다', dedicatedCount(mixed) === 1)

  // 오늘 할 일
  const tasks = buildLabTasks({
    clients: [{ id: 'c1', name: '한솔테크' }, { id: 'c2', name: '연구소 없는 곳' }],
    labInfo: new Map([['c1', one]]),
    notedThisMonth: new Set<string>(),
    surveyedThisYear: new Set<string>(),
    inspectionChecked: new Map(),
    urgentInspectionKeys: INSPECTION_ITEMS.filter((i) => i.emphasis).map((i) => i.key),
    month: '2026-09',
    year: 2026,
  })
  check('할 일: 연구소 정보가 없는 업체는 건드리지 않는다', tasks.every((t) => t.clientId === 'c1'))
  check('할 일: 노트 없음이 가장 급하다', tasks[0].kind === 'note', tasks.map((t) => t.kind).join(','))
  check('할 일: 활동조사·인원·현장조사도 같이 잡는다', ['survey', 'researcher', 'inspection'].every((k) => tasks.some((t) => t.kind === k)), tasks.map((t) => t.kind).join(','))
  const clean = buildLabTasks({
    clients: [{ id: 'c1', name: '한솔테크' }],
    labInfo: new Map([['c1', two]]),
    notedThisMonth: new Set(['c1']),
    surveyedThisYear: new Set(['c1']),
    inspectionChecked: new Map([['c1', INSPECTION_ITEMS.map((i) => i.key)]]),
    urgentInspectionKeys: INSPECTION_ITEMS.filter((i) => i.emphasis).map((i) => i.key),
    month: '2026-09',
    year: 2026,
  })
  check('할 일: 다 챙겼으면 비어 있다', clean.length === 0, JSON.stringify(clean))
  check('할 일: 올해는 숫자', currentYear(new Date('2026-09-23T00:00:00')) === 2026)

  // 월간 리포트
  const report = monthlyReportText({
    companyName: '한솔테크(주)',
    month: '2026-09',
    info: two,
    notes: [{ projectName: '열처리 공정 개선', status: '저장 완료' }],
    inspection: { done: 9, total: 12 },
    surveyStatus: '2026년 제출 완료',
    benefitKeys: ['policyFund'],
  })
  check('리포트: 업체·달·연구소 유형이 들어간다', report.includes('한솔테크(주)') && report.includes('2026-09') && report.includes('기업부설연구소'))
  check('리포트: 이번 달 노트를 적는다', report.includes('열처리 공정 개선') && report.includes('저장 완료'))
  check('리포트: 현장조사 준비도를 적는다', report.includes('9/12'))
  check('리포트: 고른 혜택 문장이 들어간다', report.includes('정책자금'))
  const empty = monthlyReportText({ companyName: 'A', month: '2026-09', info: two, notes: [], inspection: { done: 0, total: 12 }, surveyStatus: '미제출', benefitKeys: [] })
  check('리포트: 노트가 없으면 없다고 적는다', empty.includes('아직 작성된 연구노트가 없습니다'))

  check('활동조사 요청: 연도와 세 가지 요청', surveyRequestText('한솔테크(주)', 2026).includes('2026년') && surveyRequestText('한솔테크(주)', 2026).includes('연구전담요원 명단'))
}


/* ---- D-136: 연구소 판정 바로잡기 (창업 3년 · 규모 · 발생일 · 현지 날짜 · 말일 · 확인 필요 · 세액공제) ---- */
{
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d) // 현지 날짜 — TZ 와 관계없이 같은 날

  // 1. 창업 3년 이내 = 설립일 + 3년(그날 포함)까지
  check('창업: 딱 36개월(3년 되는 날) → 3년 이내', withinStartupYears('2023-09-29', day(2026, 9, 29)) === true)
  check('창업: 36개월 + 1일 → 3년 지남', withinStartupYears('2023-09-29', day(2026, 9, 30)) === false)
  check('창업: 36개월 + 1일은 꽉 찬 개월로는 여전히 36 (개월만 보면 틀린다)', monthsInBusiness('2023-09-29', day(2026, 9, 30)) === 36)
  check('창업: 3년 10개월 → 3년 지남 (예전에는 3년 × 12 = 36 으로 이내)', withinStartupYears('2022-10-30', day(2026, 9, 29)) === false && monthsInBusiness('2022-10-30', day(2026, 9, 29)) === 46)
  check('창업: 3년 11개월(47개월) → 3년 지남', withinStartupYears('2022-10-29', day(2026, 9, 29)) === false && monthsInBusiness('2022-10-29', day(2026, 9, 29)) === 47)
  check('창업: 2년 11개월 → 3년 이내', withinStartupYears('2023-10-30', day(2026, 9, 29)) === true)
  check('창업: 2월 29일 설립 → 3년 뒤 2월 28일까지', withinStartupYears('2024-02-29', day(2027, 2, 28)) === true && withinStartupYears('2024-02-29', day(2027, 3, 1)) === false)
  check('창업: 설립일 없음 · 틀린 날짜 · 미래 → 모름(null)', withinStartupYears('', day(2026, 9, 29)) === null && withinStartupYears('2026-02-30', day(2026, 9, 29)) === null && withinStartupYears('2026-10-01', day(2026, 9, 29)) === null)
  check('창업: 업력 글', businessAgeLabel('2022-10-29', day(2026, 9, 29)) === '3년 11개월' && businessAgeLabel('2023-09-29', day(2026, 9, 29)) === '3년' && businessAgeLabel('', day(2026, 9, 29)) === '')

  const small = { ...REQ_BASE, companySize: '소기업' as const }
  check('인원: 설립일로 3년 이내 → 2명', requiredForLab({ ...small, businessMonths: 36, withinStartup3y: true }) === 2)
  check('인원: 36개월 + 며칠(설립일로 지남) → 3명', requiredForLab({ ...small, businessMonths: 36, withinStartup3y: false }) === 3)
  check('인원: 설립일 모름 → 특례 없이 3명', requiredForLab({ ...small, businessMonths: 0, withinStartup3y: null }) === 3)
  check('인원: 규모 안 고름 → 소기업 특례 없이 3명', requiredForLab({ ...small, businessMonths: 12, withinStartup3y: true, sizeConfirmed: false }) === 3)
  check('인원: 예전 호출(개월만) 경계 유지 — 36 → 2 · 37 → 3', requiredForLab({ ...small, businessMonths: 36 }) === 2 && requiredForLab({ ...small, businessMonths: 37 }) === 3)

  // 대표자 — 모르면 '가능성 있음' 을 주지 않는다
  const ceoOver = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 36, withinStartup3y: false, candidates: [ceoCand] })
  check('대표자: 36개월 + 며칠 → 인정 어려움', ceoOver.verdict === '인정 어려움', ceoOver.verdict)
  const ceoUnknown = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 999, withinStartup3y: null, candidates: [ceoCand] })
  check('대표자: 설립일 모름 → 추가 확인 필요 + 설립일 안내', ceoUnknown.verdict === '추가 확인 필요' && ceoUnknown.cautions.some((c) => c.includes('설립일을 적어야')), JSON.stringify(ceoUnknown))
  const ceoNoSize = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 12, withinStartup3y: true, sizeConfirmed: false, candidates: [ceoCand] })
  check('대표자: 규모 안 고름 → 추가 확인 필요 (가능성 있음 아님)', ceoNoSize.verdict === '추가 확인 필요', ceoNoSize.verdict)
  const ceoWithin = assessCeo({ companySize: '소기업', industryField: '과학기술 분야', businessMonths: 36, withinStartup3y: true, candidates: [ceoCand] })
  check('대표자: 설립일로 3년 이내 소기업 → 가능성 있음 + ★ 세부 요건', ceoWithin.verdict === '가능성 있음' && ceoWithin.cautions.some((c) => c.includes('★')))

  // 2. 규모를 안 골랐으면 '가능' 을 내지 않는다
  const noSize = assessFeasibility({ ...FULL, sizeConfirmed: false })
  check('규모 안 고름: 자격 3명이어도 추가 확인 필요', noSize.verdict === '추가 확인 필요', noSize.verdict)
  check('규모 안 고름: 보완 항목에 ★ 규모', noSize.improvements.some((t) => t.includes('★ 기업 규모')), noSize.improvements.join('|'))
  const relaxedCand = cand({ education: '전문학사(3년제)', major: '공학계열', researchYears: 2 })
  const relaxedNoSize = assessFeasibility({ ...FULL, sizeConfirmed: false, candidates: [relaxedCand] })
  check('규모 안 고름: 중소기업 완화 기준은 인정 가능이 아니라 확인 필요', relaxedNoSize.candidates[0].verdict === '추가 확인 필요' && relaxedNoSize.eligibleCount === 0, relaxedNoSize.candidates[0].verdict)
  const relaxedSize = assessFeasibility({ ...FULL, candidates: [relaxedCand] })
  check('규모 고름(소기업): 완화 기준 인정 가능', relaxedSize.candidates[0].verdict === '인정 가능')
  const partNoSize = assessFeasibility({ ...FULL, sizeConfirmed: false, desiredType: '연구개발전담부서', independentSpace: false, fixedWallsAndDoor: false, spaceUnder50: true })
  check('규모 안 고름: 50㎡ 칸막이 중소기업 예외를 쓰지 않는다 → 보완 필요', partNoSize.facility.verdict === '보완 필요', partNoSize.facility.verdict)
  const partSize = assessFeasibility({ ...FULL, desiredType: '연구개발전담부서', independentSpace: false, fixedWallsAndDoor: false, spaceUnder50: true })
  check('규모 고름: 50㎡ 예외는 확인 필요 + ★', partSize.facility.verdict === '추가 확인 필요' && partSize.facility.notes.some((n) => n.includes('★')), partSize.facility.verdict)
  const partNot50 = assessFeasibility({ ...FULL, desiredType: '연구개발전담부서', independentSpace: false, fixedWallsAndDoor: false, spaceUnder50: false })
  check('물적: 50㎡ 이하가 아니면(기본값) 칸막이 예외 없음 → 보완 필요', partNot50.facility.verdict === '보완 필요', partNot50.facility.verdict)
  const unknownStart = assessFeasibility({ ...FULL, businessMonths: 999, withinStartup3y: null, candidates: [cand({ name: '가' }), cand({ name: '나' })] })
  check('설립일 모름: 소기업 2명은 연구소 가능이 아니다(3명 기준)', unknownStart.requiredForLab === 3 && unknownStart.verdict !== '기업부설연구소 가능', unknownStart.verdict)
  check('설립일 모름: 보완 항목에 설립일 안내', unknownStart.improvements.some((t) => t.includes('설립일을 적어야')))
  const knownStart = assessFeasibility({ ...FULL, businessMonths: 20, withinStartup3y: true, candidates: [cand({ name: '가' }), cand({ name: '나' })] })
  check('설립일로 3년 이내: 소기업 2명 → 연구소 가능', knownStart.requiredForLab === 2 && knownStart.verdict === '기업부설연구소 가능', knownStart.verdict)

  // 6. 전담부서 먼저 — 확인할 것이 남았으면 '우선 추천' 이 아니다
  const deptCheckElig = assessFeasibility({ ...FULL, isSubUnit: false, candidates: [cand({ name: '가' })] })
  check('전담부서 먼저: 신고대상 확인 필요 → 추가 확인 필요', deptCheckElig.verdict === '추가 확인 필요' && deptCheckElig.recommendedType === '전담부서 선설립 후 연구소 전환', deptCheckElig.verdict)
  const deptCheckFac = assessFeasibility({ ...FULL, fixedWallsAndDoor: false, movableWallPossible: true, candidates: [cand({ name: '가' })] })
  check('전담부서 먼저: 물적요건 확인 필요 → 추가 확인 필요', deptCheckFac.verdict === '추가 확인 필요', deptCheckFac.verdict)
  check('전담부서 먼저: 확인할 것 없으면 여전히 우선 추천', oneCand.verdict === '연구개발전담부서 우선 추천')

  // ★ 표시 — 규칙은 그대로, 불확실하다고 적는다
  const bigCert = assessFeasibility({ ...FULL, companySize: '대기업', candidates: [cand({ education: '고졸 이하', major: '비이공계', cert: '기사 이상' })] })
  check('★ 기사 이상 · 대기업: 인정 가능은 그대로 두되 ★ 확인', bigCert.candidates[0].verdict === '인정 가능' && bigCert.candidates[0].notes[0].includes('★'))
  const tech = assessFeasibility({ ...FULL, candidates: [cand({ education: '고졸 이하', major: '비이공계', cert: '기능사', researchYears: 4 })] })
  check('★ 기능사 + 4년: ★ 확인', tech.candidates[0].notes[0].includes('★ 기능사'))
  const mid = assessFeasibility({ ...FULL, companySize: '중기업', becameMediumWithinYear: true })
  check('★ 중기업 전환 1년 이내: 보완 항목에 ★', mid.improvements.some((t) => t.includes('★ 소기업→중기업')))

  // 3. 변경신고 기한 = 발생일 + 30일, D-day 는 그 기한으로
  check('변경신고: 지난 발생일 → 기한도 그만큼 앞', changeDeadlineOf('2026-08-20') === '2026-09-19')
  const pastDday = ddayOf(changeDeadlineOf('2026-08-20'), day(2026, 9, 29))
  check('변경신고: 40일 전 발생 → 기한초과 (예전엔 오늘 기준이라 D-30)', pastDday.tone === 'over' && pastDday.daysLeft === -10, JSON.stringify(pastDday))
  const soonDday = ddayOf(changeDeadlineOf('2026-09-01'), day(2026, 9, 29))
  check('변경신고: 28일 전 발생 → D-2', soonDday.label === 'D-2' && soonDday.tone === 'danger', JSON.stringify(soonDday))
  check('변경신고: 발생일을 못 읽으면 기한 빈 글자 · D-day 는 넉넉하다고 안 함', changeDeadlineOf('2026-02-30') === '' && ddayOf('').tone === 'over')
  check('변경신고: 월말 넘김 1/31 + 30일 = 3/2', changeDeadlineOf('2026-01-31') === '2026-03-02')
  const rec = addChangeRecord({ clientId: 'x-d136', reasons: ['연구전담요원 퇴사'], memo: '', occurredDate: '2026-08-20' })
  check('변경신고: 저장도 발생일 그대로 · 기한 = 발생일 + 30일', rec.occurredDate === '2026-08-20' && rec.deadline === '2026-09-19', JSON.stringify(rec))
  const recToday = addChangeRecord({ clientId: 'x-d136', reasons: ['연구기자재 변경'], memo: '' })
  check('변경신고: 발생일을 안 주면 오늘(현지 날짜)', recToday.occurredDate === ymdLocal(new Date()) && recToday.deadline === changeDeadlineOf(recToday.occurredDate))
  const recBad = addChangeRecord({ clientId: 'x-d136', reasons: ['연구기자재 변경'], memo: '', occurredDate: '2026-13-01' })
  check('변경신고: 틀린 발생일은 오늘로', recBad.occurredDate === ymdLocal(new Date()))

  // 4. 현지 날짜 — 자정 30분도 그날 (UTC 로 적으면 한국에서는 어제)
  check('날짜: 1월 1일 0시 30분 → 2026-01-01', ymdLocal(new Date(2026, 0, 1, 0, 30)) === '2026-01-01' && ymLocal(new Date(2026, 0, 1, 0, 30)) === '2026-01')
  check('날짜: 12월 31일 23시 59분 → 그날', ymdLocal(new Date(2026, 11, 31, 23, 59)) === '2026-12-31')
  check('날짜: 이번 달 = 현지 달', storageCurrentMonth() === ymLocal(new Date()))
  check('날짜: 없는 날짜는 못 읽음', parseYmd('2026-02-29') === null && parseYmd('2028-02-29') !== null && parseYmd('26-1-1') === null)
  check('날짜: 날 수는 날짜끼리', daysBetween(new Date(2026, 8, 29, 23, 59), new Date(2026, 8, 30, 0, 1)) === 1)

  // 5. 다음 확인일 — 그 달 말일로 (1/31 + 1개월 = 2월 말)
  check('확인 주기: 1/31 + 1개월 → 2월 28일', nextCheckDate({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-01-31' }) === '2026-02-28')
  check('확인 주기: 윤년 1/31 + 1개월 → 2월 29일', nextCheckDate({ clientId: 'x', cycleMonths: 1, lastCheck: '2028-01-31' }) === '2028-02-29')
  check('확인 주기: 11/30 + 3개월 → 다음 해 2월 말', nextCheckDate({ clientId: 'x', cycleMonths: 3, lastCheck: '2025-11-30' }) === '2026-02-28')
  check('확인 주기: 8/31 + 1개월 → 9월 30일', nextCheckDate({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-08-31' }) === '2026-09-30')
  check('확인 주기: 원본 저장소도 같은 답', storageNextCheckDate({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-01-31' }) === '2026-02-28' && storageNextCheckDate({ clientId: 'x', cycleMonths: 12, lastCheck: '2027-02-28' }) === '2028-02-29')
  check('확인 주기: addMonthsClamped 1/31 + 1 = 2/28', ymdLocal(addMonthsClamped(day(2026, 1, 31), 1)) === '2026-02-28')
  check('확인 주기: 도래 — 2월 말 예정이면 2월에 도래 · 1월엔 아직', isCheckDue({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-01-31' }, day(2026, 2, 1)) && !isCheckDue({ clientId: 'x', cycleMonths: 1, lastCheck: '2026-01-31' }, day(2026, 1, 31)))

  // 8. 세액공제 — 음수 · 숫자 아님 · 공제율 범위 · 규모 · 한도 · 증가분
  const tNeg = getTaxCreditEstimate(client({ researchersPayrollTotal: -50_000_000, rndMaterialCost: 20_000_000, taxCreditCategory: '일반 R&D' }))
  check('세액: 음수는 0 으로 + 알림', tNeg.payroll === 0 && tNeg.totalRnd === 20_000_000 && tNeg.annual === 5_000_000 && tNeg.warnings.length === 1, JSON.stringify(tNeg))
  const tNaN = getTaxCreditEstimate(client({ researchersPayrollTotal: Number.NaN, rndMaterialCost: 10_000_000 }))
  check('세액: 숫자 아님은 0', tNaN.payroll === 0 && tNaN.totalRnd === 10_000_000 && Number.isFinite(tNaN.annual))
  const tHigh = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, estimatedTaxCreditRate: 150 }))
  check('세액: 공제율 150% → 100% 로 자르고 알림', tHigh.rate === 100 && tHigh.annual === 100_000_000 && tHigh.warnings.some((w) => w.includes('100%')))
  const tNegRate = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, estimatedTaxCreditRate: -5, taxCreditCategory: '일반 R&D' }))
  check('세액: 음수 공제율은 안 쓰고 기본값 + 알림', tNegRate.rate === 25 && tNegRate.warnings.length === 1)
  const tMid = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCreditCategory: '일반 R&D', taxCompanySize: '중견기업' }))
  check('세액: 중견기업은 중소기업 공제율로 계산하지 않는다', tMid.available === false && tMid.annual === 0 && tMid.warnings.some((w) => w.includes('중견기업')), JSON.stringify(tMid))
  const tMidRate = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCompanySize: '대기업', estimatedTaxCreditRate: 2 }))
  check('세액: 대기업도 공제율을 직접 넣으면 계산', tMidRate.available && tMidRate.rate === 2 && tMidRate.annual === 2_000_000)
  check('세액: 규모 모름 → 중소기업 가정 ★', t25.sizeAssumed && t25.assumptions.some((a) => a.includes('★ 중소기업 기준')))
  const tSme = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, taxCompanySize: '중소기업' }))
  check('세액: 중소기업 고르면 가정 ★ 없음', !tSme.sizeAssumed && !tSme.assumptions.some((a) => a.includes('★ 중소기업 기준')) && tSme.annual === 25_000_000)
  check('세액: 낼 세금 · 최저한세 한도 안내', t25.assumptions.some((a) => a.includes('산출세액') && a.includes('최저한세')))
  const tPrior = getTaxCreditEstimate(client({ currentYearRndCost: 100_000_000, priorYearRndCost: 60_000_000 }))
  check('세액: 전년 연구개발비가 있으면 증가분 비교 ★', tPrior.assumptions.some((a) => a.includes('★') && a.includes('증가분') && a.includes('60,000,000원')))
  check('세액: 가정 문구는 여전히 단정하지 않는다', [tNeg, tHigh, tMid, tPrior].every((t) => t.assumptions.every((a) => !a.includes('됩니다'))))

  // 9. '5명 이상' — 인원을 모르면 10인 이상 서류를 지우지 않는다
  check('서류: 인원 모름 → 안전관리비 준비중(해당 없음 아님)', buildTempPackage({ id: 'u', name: 'U', labType: '기업부설연구소' }).docs.find((d) => d.key === 'safety')?.status === '준비중')
  check('서류: fewerThanTen 은 확실할 때만', fewerThanTen(3) && !fewerThanTen(undefined) && !fewerThanTen(10) && !fewerThanTen(Number.NaN))

  // 10. 업체 기록에서 채운 업종도 제외 업종 검사
  check('업종: 제외 업종 글 알아봄', isExcludedIndustryText('유흥주점업') && isExcludedIndustryText('가상자산 거래') && !isExcludedIndustryText('소프트웨어 개발') && !isExcludedIndustryText(''))
}

console.log(`\nlabcare: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
