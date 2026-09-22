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
import { changeDeadlineOf, ddayOf, nextCheckDate, ymdLocal } from '../lib/deadlines'
import { DOC_MASTER, buildTempPackage, docProgressOf, missingDocs, stageOf, type SetupDoc } from '../lib/documents'
import { RESOURCE_TEMPLATES, fillTemplate } from '../lib/templates'
import { INSPECTION_ITEMS, INSPECTION_POINTS } from '../lib/inspection'
import { BENEFIT_OPTIONS, composeBenefitText } from '../lib/report'
import { DEFAULT_ANSWERS, REASONS, mapChangeStatus } from '../lib/changes'
import { newCandidate } from '../lib/assessmentOptions'

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

console.log(`\nlabcare: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
