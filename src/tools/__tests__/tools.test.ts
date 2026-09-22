/**
 * 도구함 이식 계약 테스트 (D-88)
 *  - 정책자금 진단 엔진: 샘플·기본·손으로 만든 프로필 8벌의 판정이 원본 규칙대로 나오는지 (특성 고정)
 *  - 영업 도구 표: 개수·순서·함수 결과
 *  - 도구 결과 저장 규약: normalize · withToolResult · 발행 표시 · 지우기
 *  - 크레탑 미팅 포인트: 문턱값 규칙
 * 실행: npm run test:tools
 */

import { DEFAULT_INPUT, SAMPLE_INPUT, runDiagnosis } from '../policyFunding/diagnosis'
import { oneLineConclusion, todayTasks } from '../policyFunding/coach'
import { REPORT_DISCLAIMER } from '../policyFunding/report'
import type { DiagnosisInput } from '../policyFunding/types'
import { CUSTOMER_STAGES, PLAN_CHECKLIST_ITEMS, likelihoodOf } from '../policyFunding/types'
import {
  CRETOP_WEAPONS,
  CUST_FLAGS,
  HOLD_REASONS,
  MEETING_THEMES,
  STRATEGY_LIBRARY,
  buildDefaultPackages,
  buildLeadPlan,
  buildMeetingPlan,
  deriveInterests,
  detectTheme,
  financeSignal,
  parseMemo,
  recommendedStrategiesFor,
  scoreBand,
  scoreLead,
} from '../salesKit/lib/salesData.js'
import { buildCretopMeetingPoints, cretopGradeIsLow } from '../cretop/lib/meetingPoints'
import { buildCretopParsedForUi, extractCretopCore } from '../cretop/engine/index.js'
import { normalizeClientOps, withToolResult, withToolResultPublished, withoutToolResult, TOOL_RESULT_LIMIT } from '../../services/clientOpsService'
import { TOOLS, liveTools, plannedTools, reviewTools, toolOf } from '../../config/toolRegistry'
import { judge } from '../startupTax/lib/judgement'
import { EMPTY_FORM } from '../startupTax/lib/formDefaults'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/* ---- 1. 정책자금 진단 — 특성 고정 ---- */
{
  const r = runDiagnosis(SAMPLE_INPUT)
  check('정책자금: 샘플(제조·특허·시설자금) 1순위는 기술보증기금 또는 중진공', /기술보증기금|중소벤처기업진흥공단/.test(r.topAgency), r.topAgency)
  check('정책자금: 추천 기관은 정확히 3곳', r.agencies.length === 3)
  check('정책자금: 순위가 점수 내림차순', r.agencies.every((a, i, arr) => i === 0 || arr[i - 1].score >= a.score))
  check('정책자금: 종합 점수 42~96 사이', r.overallScore >= 42 && r.overallScore <= 96, String(r.overallScore))
  check('정책자금: 진행 가능성은 점수로 정해진다', r.likelihoodLevel === likelihoodOf(r.overallScore))
  check('정책자금: 필수 서류 8종', r.documents.length === 8, String(r.documents.length))
  check('정책자금: 로드맵이 있고 단계가 있다', !!r.roadmap && r.roadmap.steps.length >= 6)
  check('정책자금: 세부 트랙 후보에 R&D 또는 스마트공장이 든다', (r.specialTracks ?? []).some((t) => /R&D|스마트공장|혁신성장/.test(t.name)), (r.specialTracks ?? []).map((t) => t.name).join())
  check('정책자금: 사업계획 완성도는 100점 만점 9개 항목', !!r.planScore && r.planScore.dimensions.length === 9 && r.planScore.dimensions.reduce((s, d) => s + d.max, 0) === 100)
  check('정책자금: 한 줄 결론에 1순위 기관이 들어간다', oneLineConclusion(r).includes(r.topAgency))
  check('정책자금: 오늘 할 일은 최대 5개', todayTasks(SAMPLE_INPUT, r).length <= 5 && todayTasks(SAMPLE_INPUT, r).length >= 3)
  check('정책자금: 절대 약속 금지 문구가 있다', r.coachInsight.neverPromise.length > 0)
  check('정책자금: 면책 문구는 승인 보장을 부정한다', /보장/.test(REPORT_DISCLAIMER))

  const d = runDiagnosis(DEFAULT_INPUT)
  check('정책자금: 기본값도 오류 없이 3곳 추천', d.agencies.length === 3)

  const mk = (patch: Partial<DiagnosisInput>): DiagnosisInput => ({ ...DEFAULT_INPUT, ...patch })
  const lowCreditFood = runDiagnosis(mk({ industry: '치킨집', businessType: '개인사업자', years: '1~3년', revenue: '1억 미만', employees: '1~4명', credit: '낮음', purpose: '저신용자금', strengths: ['없음'] }))
  check('정책자금: 저신용 음식점은 미소금융·지역신보·소진공 계열이 1순위', /미소금융|지역신용보증재단|소상공인시장진흥공단/.test(lowCreditFood.topAgency), lowCreditFood.topAgency)
  check('정책자금: 저신용 음식점 1순위에 신보는 없다', !lowCreditFood.agencies.some((a) => a.rank === 1 && a.name === '신용보증기금'))

  const bigCorp = runDiagnosis(mk({ industry: '자동차부품 제조', businessType: '법인사업자', years: '7년 이상', revenue: '30억 이상', employees: '10명 이상', credit: '우수', purpose: '운전자금', strengths: ['제조업', '고용증가'] }))
  check('정책자금: 매출 30억 우수신용 법인은 신보가 TOP3 에 든다', bigCorp.agencies.some((a) => a.name === '신용보증기금'), bigCorp.agencies.map((a) => a.name).join())

  const tiny = runDiagnosis(mk({ industry: '온라인 소매', revenue: '1억 미만', credit: '보통', purpose: '운전자금', strengths: ['없음'] }))
  check('정책자금: 매출 1억 미만이면 신보는 후순위(−45)', !tiny.agencies.slice(0, 2).some((a) => a.name === '신용보증기금'), tiny.agencies.map((a) => `${a.name}${a.score}`).join())

  const arrears = runDiagnosis(mk({ taxArrears: '있음', insuranceArrears: '있음' }))
  check('정책자금: 체납이 있으면 로드맵 0일차가 완납 정리', !!arrears.roadmap && /체납/.test(arrears.roadmap.steps[0].task), arrears.roadmap?.steps[0].task)
  check('정책자금: 체납이 있으면 리스크 점수가 기본보다 높다', (arrears.risk?.score ?? 0) >= (d.risk?.score ?? 0))

  const youth = runDiagnosis(mk({ industry: 'IT 플랫폼', years: '1년 미만', ceoAge: '만 39세 이하', purpose: '창업자금', strengths: ['청년대표'] }))
  check('정책자금: 청년 창업은 청년창업 트랙이 잡힌다', (youth.specialTracks ?? []).some((t) => /청년/.test(t.name)), (youth.specialTracks ?? []).map((t) => t.name).join())

  const exporter = runDiagnosis(mk({ industry: '전자부품 제조', businessType: '법인사업자', years: '3~7년', revenue: '10~30억', strengths: ['제조업', '수출'], purpose: '시설자금' }))
  check('정책자금: 수출 제조는 수출 트랙 또는 업셀에 수출바우처', (exporter.specialTracks ?? []).some((t) => /수출/.test(t.name)) || exporter.upsells.some((u) => /수출/.test(u.title)))

  const inventory = runDiagnosis(mk({ industry: '생활용품 도소매', purpose: '운전자금', workingCapitalUse: '재고매입', strengths: ['없음'] }))
  check('정책자금: 재고매입 도소매도 3곳 추천·서류·로드맵이 나온다', inventory.agencies.length === 3 && inventory.documents.length > 0 && !!inventory.roadmap)

  check('정책자금: 같은 입력이면 같은 결과(결정적)', JSON.stringify(runDiagnosis(SAMPLE_INPUT)) === JSON.stringify(r))
  check('정책자금: 고객 단계 12개', CUSTOMER_STAGES.length === 12, String(CUSTOMER_STAGES.length))
  check('정책자금: 사업계획 체크리스트 10개', PLAN_CHECKLIST_ITEMS.length === 10)
}

/* ---- 2. 영업 도구 표 ---- */
{
  check('영업: 전략 라이브러리 17종 (원본 그대로)', STRATEGY_LIBRARY.length === 17, String(STRATEGY_LIBRARY.length))
  check('영업: 전략마다 질문 3개·수임료·난도', STRATEGY_LIBRARY.every((s) => s.questions.length === 3 && s.fee && ['낮음', '보통', '높음'].includes(s.level)))
  check('영업: 미팅 테마 8종 (general 포함)', Object.keys(MEETING_THEMES).length === 8, Object.keys(MEETING_THEMES).join())
  check('영업: 테마마다 1차 질문 8개', Object.values(MEETING_THEMES).every((t) => t.m1q.length === 8))
  const pkgs = buildDefaultPackages()
  check('영업: 상품 40종·8분류', pkgs.length === 40 && new Set(pkgs.map((p) => p.cat)).size === 8, `${pkgs.length}/${new Set(pkgs.map((p) => p.cat)).size}`)
  check('영업: 상품 가격은 80~500만원', pkgs.every((p) => p.fee >= 80 && p.fee <= 500))
  check('영업: 연구소 사후관리 패키지 80만원', pkgs.find((p) => p.name === '연구소 사후관리 패키지')?.fee === 80)
  check('영업: 제안 주제 5분류 34종 (원본 그대로)', CRETOP_WEAPONS.length === 5 && CRETOP_WEAPONS.reduce((n, c) => n + c.items.length, 0) === 34, String(CRETOP_WEAPONS.reduce((n, c) => n + c.items.length, 0)))
  check('영업: 고객 플래그 17종', CUST_FLAGS.length === 17)
  check('영업: 보류 사유 8종', HOLD_REASONS.length === 8)

  const item = { name: '한솔테크', interests: ['가지급금'], ceoAge: 58, estYears: 18, empCount: 12, revenue: 2500, industry: '제조업', flags: { gajigeup: true }, stage: 'meeting1_done', dbSource: '소개' }
  check('영업: 가지급금 관심 → suspense 테마', detectTheme(item) === 'suspense')
  check('영업: 대표 58세·업력 18년 → 승계 전략이 1순위(+20)', recommendedStrategiesFor(item)[0]?.id === 'succession', recommendedStrategiesFor(item).map((s) => s.id).join())
  const m1 = buildMeetingPlan(item, 'm1')
  check('영업: 1차 미팅 대본에 질문·카톡·요청 자료가 있다', m1.questions.length >= 8 && m1.kakao.length > 20 && m1.docs.length > 0)
  const m2 = buildMeetingPlan(item, 'm2')
  check('영업: 2차 미팅 대본에 반론 3종', Array.isArray(m2.objections) && m2.objections.length === 3)
  const m3 = buildMeetingPlan(item, 'm3')
  check('영업: 3차 클로징에 가격 저항·보류 대응', m3.priceTalk.length > 0 && m3.holdTalk.length > 0)
  const s = scoreLead(item)
  check('영업: 리드 점수 40~88', s >= 40 && s <= 88, String(s))
  check('영업: 점수 구간 라벨', scoreBand(90).label === '계약 가능성 높음' && scoreBand(10).label === '낮음')
  check('영업: 리드 플랜에 후킹·전화·카톡·반론', (() => { const lp = buildLeadPlan(item); return typeof lp.hook === 'string' && typeof lp.phone === 'string' && typeof lp.kakao === 'string' && Array.isArray(lp.objections) })())
  check('영업: 플래그 → 관심사 파생 (가지급금·정관정비)', (() => { const d = deriveInterests({ flags: { gajigeup: true } }); return d.includes('가지급금') && d.includes('정관정비') })())
  const pm = parseMemo('제조업 매출 25억 직원 12명 대표 58세 업력 18년 가지급금 있음') as Record<string, unknown>
  check('영업: 메모 붙여넣기 인식', pm.industry === '제조업' && pm.revenue === 2500 && pm.empCount === 12 && pm.ceoAge === 58 && pm.estYears === 18 && (pm.flags as Record<string, boolean>).gajigeup === true, JSON.stringify(pm))
  check('영업: 재무 신호등 — 가지급금이면 노란불', financeSignal(item).level === 'yellow')
}

/* ---- 3. 크레탑 미팅 포인트 ---- */
{
  check('크레탑: CCC·D·R 등급은 낮은 등급', cretopGradeIsLow('CCC+') && cretopGradeIsLow('D') && !cretopGradeIsLow('BBB') && !cretopGradeIsLow(''))
  const text = [
    '기업명 세방형(주)', '요약 손익계산서 단위:백만원', '구분 2023 2024 2025', '매출액 6000 6200 6397', '영업이익 90 95 104', '당기순이익 150 180 202',
    '요약 재무상태표 단위:백만원', '구분 2023 2024 2025', '자산총계 12000 11500 11000', '부채총계 9800 10100 8740', '자본총계 2200 1400 1000', '유동자산 3000 2900 2801', '유동부채 9500 9800 10000',
    '재무비율 단위:%', '구분 2023 2024 2025', '부채비율 445.45 721.43 874.00', '유동비율 31.58 29.59 28.01', '이자보상배수 0.75 0.61 0.52',
  ].join('\n')
  const ui = buildCretopParsedForUi(text)
  const core = extractCretopCore(text)
  const pts = buildCretopMeetingPoints({ rows: core.rows, company: { industry: '제조업', employees: 12 }, computed: ui.corePreview })
  check('크레탑: 부채비율 874·유동비율 28·이자보상 0.52 → 상위 포인트에 유동비율·이자보상 위험', pts.topPoints.some((p) => /유동비율이 낮은 편/.test(p)) && pts.topPoints.some((p) => /이자보상배수가 낮은 편/.test(p)), pts.topPoints.join(' | '))
  check('크레탑: 포인트는 최대 5개, 질문은 최대 8개', pts.topPoints.length <= 5 && pts.questions.length <= 8)
  check('크레탑: 제조업이면 연구소·인증 포인트가 들어간다', pts.proposals.some((p) => /인증·연구소/.test(p)))
  check('크레탑: 요청 자료가 중복 없이 모인다', new Set(pts.docs).size === pts.docs.length && pts.docs.length > 0)
}

/* ---- 4. 도구 결과 저장 규약 ---- */
{
  const base = normalizeClientOps({ id: 'c1', companyName: '테스트', workspaceId: null })
  check('도구결과: 없는 기록은 빈 배열', Array.isArray(base.toolResults) && base.toolResults.length === 0)
  const withOne = withToolResult(base, { toolKey: 'startup-tax', title: '창업감면 판정', verdict: 'good', verdictLabel: '🟢 감면 가능성 높음', summary: '요약', data: { a: 1 } })
  check('도구결과: 붙이면 맨 앞에 온다', withOne.toolResults.length === 1 && withOne.toolResults[0].toolKey === 'startup-tax')
  check('도구결과: 활동 기록에 tool 한 줄', withOne.activity[0]?.kind === 'tool' && withOne.activity[0].text.includes('창업감면 판정'))
  check('도구결과: 발행 전에는 publishedUpdateId 가 null', withOne.toolResults[0].publishedUpdateId === null)
  const pub = withToolResultPublished(withOne, withOne.toolResults[0].id, 'upd_1')
  check('도구결과: 발행하면 update id 를 기억', pub.toolResults[0].publishedUpdateId === 'upd_1')
  const round = normalizeClientOps(JSON.parse(JSON.stringify(pub)) as Record<string, unknown>)
  check('도구결과: 저장 → 다시 읽어도 그대로', round.toolResults[0].verdictLabel === '🟢 감면 가능성 높음' && round.toolResults[0].publishedUpdateId === 'upd_1' && (round.toolResults[0].data as { a: number }).a === 1)
  const junk = normalizeClientOps({ id: 'c2', companyName: 'x', toolResults: [{ nope: 1 }, { toolKey: 'cretop' }, 'str'] } as unknown as Record<string, unknown>)
  check('도구결과: 깨진 항목은 버리고 toolKey 만 있어도 살린다', junk.toolResults.length === 1 && junk.toolResults[0].title === 'cretop' && junk.toolResults[0].summary === '')
  const gone = withoutToolResult(pub, pub.toolResults[0].id)
  check('도구결과: 지우면 비고 활동 기록에 남는다', gone.toolResults.length === 0 && gone.activity[0].text.includes('지움'))
  let many = base
  for (let i = 0; i < TOOL_RESULT_LIMIT + 5; i += 1) many = withToolResult(many, { toolKey: 'cretop', title: `t${i}`, verdict: null, verdictLabel: '', summary: '', data: null })
  check('도구결과: 상한을 넘으면 오래된 것부터 잘린다', many.toolResults.length === TOOL_RESULT_LIMIT && many.toolResults[0].title === `t${TOOL_RESULT_LIMIT + 4}`)
}

/* ---- 5. 도구 목록 ---- */
{
  check('도구목록: 쓸 수 있는 도구 6개 (세금·창업감면·크레탑·고용지원금·연구소·정책자금)', liveTools().length === 6, liveTools().map((t) => t.key).join())
  check('도구목록: 검토중 1개 · 자리만 1개', reviewTools().length === 1 && plannedTools().length === 1)
  check('도구목록: 키가 겹치지 않는다', new Set(TOOLS.map((t) => t.key)).size === TOOLS.length)
  check('도구목록: 옮겨 온 것은 원본을 적는다', TOOLS.filter((t) => t.status !== 'planned').every((t) => !!t.origin))
  check('도구목록: toolOf 로 찾는다', toolOf('cretop')?.path === '/tools/cretop' && toolOf('nope') === undefined)
}

/* ---- 6. 창업감면 — 화면 기본값이 판정기와 맞물린다 ---- */
{
  const r = judge({ ...EMPTY_FORM, businessType: 'corporation', birthDate: '1995-03-01', startupDate: '2025-01-15', overconcentration: 'no', industry: 'manufacturing', startupForm: 'brand_new' }, new Date('2026-09-22'))
  check('창업감면: 청년·비과밀·제조·신규 → 종합 good', r.overall === 'good', r.overall)
  check('창업감면: 기본 폼(빈칸)도 판정기가 죽지 않는다', typeof judge(EMPTY_FORM, new Date('2026-09-22')).overall === 'string')
}

console.log(`\ntools: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
