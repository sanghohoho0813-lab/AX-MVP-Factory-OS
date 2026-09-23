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
import { normalizeClientOps, withDocument, withToolResult, withToolResultPublished, withoutToolResult, TOOL_RESULT_LIMIT, TOOL_DEADLINE_LIMIT } from '../../services/clientOpsService'
import { buildClientSchedule, SCHEDULE_KIND_LABEL } from '../../services/clientOpsSchedule'
import { roundDeadlines } from '../employment/lib/toolDeadlines'
import { changeDeadlines, surveyDeadlineDate } from '../labcare/lib/toolDeadlines'
import { TOOLS, liveTools, plannedTools, reviewTools, searchTools, toolOf, toolsNeeding } from '../../config/toolRegistry'
import { missingDocsForTools, missingDocsText, missingReason, toolReadiness } from '../../services/toolReadiness'
import { ageOf, businessTypeOf, clientFacts, employeeCountOf, industryValueOf, prefilledText, yearsInBusiness } from '../shared/clientPrefill'
import { buildToolPublishInput, isToolResultPublished } from '../../services/toolPublish'
import { listUpdates, publishUpdate } from '../../services/customerBridgeService'
import { summarizeModule } from '../shared/ModuleDashboard'
import { listRows, saveRow, deleteRow, replaceRows, rowData } from '../../services/moduleData'
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

/* ---- 4-2. 도구가 심은 기한 → 달력 (D-89) ---- */
{
  const base = normalizeClientOps({ id: 'c3', companyName: '한솔테크(주)', workspaceId: null })
  const withDeadlines = withToolResult(base, {
    toolKey: 'employment',
    title: '고용지원금 회차 일정',
    verdict: null,
    verdictLabel: '청년일자리도약장려금',
    summary: '요약',
    data: null,
    deadlines: [
      { date: '2026-10-01', title: '1회차 신청', note: '예상 240만원' },
      { date: '2027-04-01', title: '2회차 신청', note: '' },
      { date: '날짜아님', title: '버려야 한다', note: '' },
    ],
  })
  check('기한: 날짜 모양이 아닌 것은 버린다', withDeadlines.toolResults[0].deadlines.length === 2)
  check('기한: 저장 → 다시 읽어도 남는다', normalizeClientOps(JSON.parse(JSON.stringify(withDeadlines)) as Record<string, unknown>).toolResults[0].deadlines[0].note === '예상 240만원')
  const events = buildClientSchedule(withDeadlines, '2026-09-22')
  const toolEvents = events.filter((e) => e.kind === 'tool')
  check('기한: 달력 일정으로 나온다', toolEvents.length === 2 && toolEvents[0].title === '1회차 신청', JSON.stringify(toolEvents.map((e) => e.title)))
  check('기한: 남은 날짜를 센다', toolEvents[0].daysLeft === 9, String(toolEvents[0].daysLeft))
  check('기한: 지난 것은 지난 일로 표시', buildClientSchedule(withDeadlines, '2026-10-02').filter((e) => e.kind === 'tool')[0].done === true)
  check('기한: 종류 이름이 있다', SCHEDULE_KIND_LABEL.tool === '도구 기한')
  const overflow = withToolResult(base, {
    toolKey: 'employment', title: 't', verdict: null, verdictLabel: '', summary: '', data: null,
    deadlines: Array.from({ length: TOOL_DEADLINE_LIMIT + 5 }, (_, i) => ({ date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, title: `r${i}`, note: '' })),
  })
  check('기한: 상한을 넘기지 않는다', overflow.toolResults[0].deadlines.length === TOOL_DEADLINE_LIMIT)
  // 다시 판정해 붙이면 옛 기한은 달력에서 내린다 (결과 자체는 남는다)
  {
    const again = withToolResult(withDeadlines, {
      toolKey: 'employment',
      title: '고용지원금 회차 일정',
      verdict: null,
      verdictLabel: '청년일자리도약장려금',
      summary: '다시 판정',
      data: null,
      deadlines: [{ date: '2026-11-01', title: '1회차 신청(고친 입사일)', note: '' }],
    })
    const ev = buildClientSchedule(again, '2026-09-22').filter((e) => e.kind === 'tool')
    check('기한: 다시 붙이면 옛 기한은 달력에서 내려간다', ev.length === 1 && ev[0].title.includes('고친 입사일'), JSON.stringify(ev.map((e) => e.title)))
    check('기한: 옛 결과 자체는 기록에 남는다', again.toolResults.length === 2 && again.toolResults[1].summary === '요약')
    const other = withToolResult(again, { toolKey: 'labcare', title: '연구소 기한', verdict: null, verdictLabel: '', summary: '', data: null, deadlines: [{ date: '2027-04-30', title: '활동조사', note: '' }] })
    check('기한: 다른 도구의 기한은 건드리지 않는다', buildClientSchedule(other, '2026-09-22').filter((e) => e.kind === 'tool').length === 2)
  }

  check('기한: 결과에 기한이 없으면 달력에도 없다', buildClientSchedule(withToolResult(base, { toolKey: 'cretop', title: 'x', verdict: null, verdictLabel: '', summary: '', data: null }), '2026-09-22').filter((e) => e.kind === 'tool').length === 0)

  // 고용지원금: 받은 회차는 심지 않는다
  const rows = [
    { index: 0, label: '1회차', month: 3, amount: 2_400_000, date: '2026-10-01', dday: 9, ddayLabel: 'D-9', kind: '신청 예정' as const, isPaid: false },
    { index: 1, label: '2회차', month: 6, amount: 2_400_000, date: '2027-01-01', dday: 101, ddayLabel: 'D-101', kind: '신청 예정' as const, isPaid: true },
  ]
  const rd = roundDeadlines('청년일자리도약장려금', rows)
  check('고용지원금: 아직 안 받은 회차만 기한이 된다', rd.length === 1 && rd[0].title === '청년일자리도약장려금 1회차 신청', JSON.stringify(rd))
  check('고용지원금: 예상액을 한 줄로 적는다', rd[0].note.includes('240'), rd[0].note)

  // 연구소: 신고 완료는 빼고, 활동조사 마감은 항상 붙는다
  const cd = changeDeadlines(
    [
      { id: 'a', reasons: ['연구소장 변경'], memo: '', status: '확인 필요', occurredDate: '2026-09-01', deadline: '2026-10-01' },
      { id: 'b', reasons: ['주소 변경'], memo: '', status: '신고 완료', occurredDate: '2026-08-01', deadline: '2026-08-31' },
    ],
    new Date('2026-09-22T00:00:00'),
  )
  check('연구소: 신고 완료한 건은 기한에서 빠진다', cd.length === 2 && cd[0].title.includes('연구소장 변경'), JSON.stringify(cd.map((d) => d.title)))
  check('연구소: 활동조사 마감이 늘 붙는다', cd[1].date === '2027-04-30' && cd[1].title.includes('연구개발활동조사'), cd[1].date)
  check('연구소: 4월 안이면 올해 마감', surveyDeadlineDate(new Date('2027-02-01T00:00:00')) === '2027-04-30')
}

/* ---- 5. 도구 목록 ---- */
{
  check('도구목록: 쓸 수 있는 도구 6개 (세금·창업감면·크레탑·고용지원금·연구소·정책자금)', liveTools().length === 6, liveTools().map((t) => t.key).join())
  check('도구목록: 검토중 1개 · 자리만 1개', reviewTools().length === 1 && plannedTools().length === 1)
  check('도구목록: 키가 겹치지 않는다', new Set(TOOLS.map((t) => t.key)).size === TOOLS.length)
  check('도구목록: 옮겨 온 것은 원본을 적는다', TOOLS.filter((t) => t.status !== 'planned').every((t) => !!t.origin))
  check('도구목록: toolOf 로 찾는다', toolOf('cretop')?.path === '/tools/cretop' && toolOf('nope') === undefined)

  // 검색 (D-89) — 대표는 도구 이름이 아니라 하고 싶은 일로 찾는다
  check('도구검색: 빈 말이면 쓸 수 있는 것 + 검토중 (자리만 잡은 것은 빼고)', searchTools('').length === 7 && searchTools('').every((t) => t.path !== null))
  check('도구검색: 이름으로', searchTools('크레탑').map((t) => t.key).join() === 'cretop')
  check('도구검색: 이름에 없는 말로도 — 부채비율 → 크레탑', searchTools('부채비율').map((t) => t.key).join() === 'cretop')
  check('도구검색: 지원금 → 고용지원금', searchTools('장려금').map((t) => t.key).join() === 'employment')
  check('도구검색: 보증 → 정책자금', searchTools('기술보증').map((t) => t.key).join() === 'policy-funding')
  check('도구검색: 퇴직금 → 세금 계산기', searchTools('퇴직금').map((t) => t.key).join() === 'tax')
  check('도구검색: 없는 말이면 빈 목록', searchTools('없는말입니다').length === 0)
}

/* ---- 6. 창업감면 — 화면 기본값이 판정기와 맞물린다 ---- */
{
  const r = judge({ ...EMPTY_FORM, businessType: 'corporation', birthDate: '1995-03-01', startupDate: '2025-01-15', overconcentration: 'no', industry: 'manufacturing', startupForm: 'brand_new' }, new Date('2026-09-22'))
  check('창업감면: 청년·비과밀·제조·신규 → 종합 good', r.overall === 'good', r.overall)
  check('창업감면: 기본 폼(빈칸)도 판정기가 죽지 않는다', typeof judge(EMPTY_FORM, new Date('2026-09-22')).overall === 'string')
}

/* ---- 7. 고객 플랫폼으로 나가는 것 (D-89) ---- */
// "도구 결과를 발행하면 고객이 무엇을 보는가" 를 못 박는다.
// 나가는 것은 제목과 요약뿐 — 입력값·기한·판정 키·내부 메모·수수료는 나가지 않는다.
{
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    get length() {
      return store.size
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }

  const summary = '[창업감면 사전진단 결과]\n· 판정: 감면 가능성 높음\n· 근거: 청년 · 비과밀 · 제조업'
  const input = buildToolPublishInput('link-1', { title: '창업감면 판정', summary })
  check('발행: 갈래는 결과(result)', input.category === 'result')
  check('발행: 제목은 도구 이름 + 결과', input.title === '창업감면 판정 결과', input.title)
  check('발행: 본문은 요약 글 그대로', input.body === summary)
  check('발행: 고객이 할 일은 없다', input.customerActionRequired === false)
  const keys = Object.keys(input).sort().join()
  check('발행: 그 밖의 것은 담지 않는다', keys === 'body,category,customerActionRequired,linkId,title', keys)

  // 실제로 내보내 본다 (로컬 모드) — 저장된 글에 내부 정보가 없어야 한다
  const published = await publishUpdate(null, input)
  check('발행: 저장된 글이 공개 상태', published.status === 'published')
  const stored = await listUpdates(null, 'link-1')
  const raw = JSON.stringify(stored)
  check('발행: 고객이 보는 목록에 한 줄 생긴다', stored.length === 1 && stored[0].title === '창업감면 판정 결과', raw.slice(0, 120))
  check('발행: 저장본에 요약이 그대로', raw.includes('감면 가능성 높음'))
  for (const secret of ['수수료', '내부 메모', 'businessNumber', 'startupDate', '입력값']) {
    check(`발행: 저장본에 '${secret}' 가 없다`, !raw.includes(secret))
  }

  const once = withToolResult(normalizeClientOps({ id: 'p1', companyName: 'P사', workspaceId: null }), {
    toolKey: 'startup-tax', title: '창업감면 판정', verdict: 'good', verdictLabel: '높음', summary, data: { birthDate: '1995-03-01' },
  })
  check('발행: 붙인 직후에는 아직 안 보냈다', isToolResultPublished(once.toolResults[0]) === false)
  const marked = withToolResultPublished(once, once.toolResults[0].id, published.id)
  check('발행: 한 번 보내면 그렇게 기억한다 (두 번 안 보낸다)', isToolResultPublished(marked.toolResults[0]) === true)
  check('발행: 입력값은 우리 기록에만 남는다', JSON.stringify(marked.toolResults[0].data).includes('1995-03-01') && !raw.includes('1995-03-01'))
}

/* ---- 8. 도구가 쓰는 서류 · 업체 준비 상태 (D-90) ---- */
{
  const TODAY = '2026-09-23'
  const base = normalizeClientOps({ id: 'r1', companyName: '한솔테크(주)', workspaceId: null })

  const employment = toolOf('employment')!
  const cretop = toolOf('cretop')!
  const tax = toolOf('tax')!
  const policy = toolOf('policy-funding')!

  check('서류: 도구마다 필요한 서류가 정해져 있다', (employment.requiredDocs ?? []).join() === 'payrollRoster' && (cretop.requiredDocs ?? []).join() === 'cretopReport')
  check('서류: 세금 계산기는 서류가 필요 없다', (tax.requiredDocs ?? []).length === 0)
  check('서류: 정책자금은 둘이 필요하다', (policy.requiredDocs ?? []).join() === 'businessRegistration,financialStatements')
  check('서류: 이 서류를 쓰는 도구를 거꾸로 찾는다', toolsNeeding('payrollRoster').map((t) => t.key).join() === 'employment')
  check('서류: 아무 도구도 안 쓰는 서류도 있다', toolsNeeding('jointCertificate').length === 0)

  // 아무 서류도 없는 업체 — 이름이 그대로 나와야 한다
  const empty = toolReadiness(base, employment, TODAY)
  check('준비상태: 없으면 준비 안 됨', empty.ready === false && empty.missing.length === 1)
  check('준비상태: 없는 서류를 이름으로 알려 준다', empty.missing[0].label === '4대보험 가입자 명부', empty.missing[0].label)
  check('준비상태: 왜 못 쓰는지 한 줄', missingReason(empty.missing[0]) === '아직 안 받음')
  check('준비상태: 서류가 필요 없는 도구는 늘 준비됨', toolReadiness(base, tax, TODAY).ready === true && toolReadiness(base, tax, TODAY).needsNothing === true)

  // 받았다고 체크만 하고 파일이 없으면 — 도구는 읽을 수 없다
  const checkedOnly = withDocument(base, 'payrollRoster', { received: true, issuedAt: '2026-09-01' })
  const half = toolReadiness(checkedOnly, employment, TODAY)
  check('준비상태: 받음 표시만으로는 부족하다 (파일이 있어야 읽는다)', half.ready === false && missingReason(half.missing[0]).includes('파일이 없음'), missingReason(half.missing[0]))

  // 파일까지 올라오면 준비됨
  const withFile = withDocument(checkedOnly, 'payrollRoster', { fileName: '명부.xlsx', fileSize: 1024 })
  check('준비상태: 파일까지 있으면 준비됨', toolReadiness(withFile, employment, TODAY).ready === true)

  // 유효기간이 지난 것은 없는 것으로 본다 (명부는 3개월)
  const stale = withDocument(base, 'payrollRoster', { received: true, issuedAt: '2026-01-02', fileName: '명부.xlsx' })
  const staleR = toolReadiness(stale, employment, TODAY)
  check('준비상태: 기한 지난 서류는 없는 것으로 본다', staleR.ready === false && missingReason(staleR.missing[0]) === '유효기간 지남')

  // 있으면 좋은 서류는 막지 않는다
  const cretopOk = withDocument(base, 'cretopReport', { received: true, issuedAt: '2026-09-01', fileName: '크레탑.pdf' })
  const cr = toolReadiness(cretopOk, cretop, TODAY)
  check('준비상태: 권장 서류가 없어도 막지 않는다', cr.ready === true && cr.missingOptional.length === 1 && cr.missingOptional[0].label === '최근 3개년 재무제표')

  // 업체 전체 — 없는 서류를 한 줄로, 많이 쓰는 것부터
  const all = missingDocsForTools(base, liveTools(), TODAY)
  check('준비상태: 업체에서 빠진 서류를 모아 준다', all.length === 4, missingDocsText(all))
  check('준비상태: 사업자등록증이 맨 앞 (도구 셋이 쓴다)', all[0].label === '사업자등록증', missingDocsText(all))
  check('준비상태: 같은 서류를 두 번 세지 않는다', new Set(all.map((n) => n.key)).size === all.length)
  const ready = liveTools().map((t) => toolReadiness(withFile, t, TODAY)).filter((r) => r.ready).length
  check('준비상태: 명부만 있으면 고용지원금·세금 계산기가 열린다', ready === 2, String(ready))
}

/* ---- 9. 업체 기록 → 도구 입력값 (D-90) ---- */
{
  const T = new Date('2026-09-23T00:00:00')
  const rec = normalizeClientOps({
    id: 'p2',
    companyName: '한솔테크(주)',
    workspaceId: null,
    corporateNumber: '110111-1234567',
    representativeBirth: '1978-05-10',
    establishedAt: '2019-03-02',
    industry: '자동차 부품 제조',
    employeeCount: '12명(대표 포함)',
  } as Record<string, unknown>)
  const f = clientFacts(rec, T)

  check('채우기: 법인번호가 있으면 법인사업자', f.businessType === 'corporation')
  check('채우기: 법인번호가 없으면 비워 둔다', businessTypeOf({ corporateNumber: '' }) === '')
  check('채우기: 업종 글에서 제조업을 알아본다', f.industry === 'manufacturing', f.industry)
  check('채우기: 모르는 업종은 비워 둔다', industryValueOf('우주선 조종') === '')
  check('채우기: 직원 수는 숫자만 뽑는다', f.employeeCount === 12, String(f.employeeCount))
  check('채우기: 직원 수를 못 읽으면 null', employeeCountOf('여러 명') === null)
  check('채우기: 업력 계산', f.years === 7, String(f.years))
  check('채우기: 설립일이 없으면 null', yearsInBusiness('', T) === null)
  check('채우기: 대표 나이 계산 (생일 전)', f.representativeAge === 48, String(f.representativeAge))
  check('채우기: 생일이 지나면 한 살 더', ageOf('1978-01-10', T) === 48 && ageOf('1978-12-10', T) === 47)
  check('채우기: 채운 칸을 말로 적는다', prefilledText(['대표자 생년월일', '창업일']).includes('업체 기록에서 채웠습니다'))
  check('채우기: 아무것도 못 채웠으면 아무 말도 안 한다', prefilledText([]) === '')

  const bare = normalizeClientOps({ id: 'p3', companyName: '이름만', workspaceId: null })
  const bf = clientFacts(bare, T)
  check('채우기: 모르는 것은 비워 둔다 (짐작 안 함)', bf.businessType === '' && bf.industry === '' && bf.employeeCount === null && bf.years === null && bf.representativeAge === null)
}


/* ---- 9. D-91 모듈 틀 — 목차 · 대시보드 · 모듈 기록 ---- */
{
  // 목차: 모든 도구가 목차를 갖고, 키가 겹치지 않고, 화면 키는 주소에 쓸 수 있는 글자만
  const withSections = TOOLS.filter((t) => t.path !== null)
  check('모듈 목차: 주소가 있는 도구는 전부 목차를 갖는다', withSections.every((t) => (t.sections ?? []).length >= 1), withSections.filter((t) => !t.sections).map((t) => t.key).join(','))
  const dupes = withSections.filter((t) => new Set((t.sections ?? []).map((s) => s.key)).size !== (t.sections ?? []).length)
  check('모듈 목차: 한 모듈 안에서 화면 키가 겹치지 않는다', dupes.length === 0, dupes.map((t) => t.key).join(','))
  const badKey = withSections.flatMap((t) => (t.sections ?? []).map((s) => s.key)).filter((k) => !/^[a-z0-9-]+$/.test(k))
  check('모듈 목차: 화면 키는 주소에 쓸 수 있는 글자만', badKey.length === 0, badKey.join(','))
  check('모듈 목차: 고용지원금 10화면 · 연구소 15화면 · 영업 14화면',
    (toolOf('employment')?.sections?.length === 10) && (toolOf('labcare')?.sections?.length === 15) && (toolOf('sales-kit')?.sections?.length === 14),
    `${toolOf('employment')?.sections?.length}/${toolOf('labcare')?.sections?.length}/${toolOf('sales-kit')?.sections?.length}`)

  // 대시보드: 업체 명단(고객 운영)을 그대로 읽는다 — 모듈이 명단을 따로 갖지 않는다
  const TODAY = '2026-09-23'
  const ready = withDocument(
    normalizeClientOps({ id: 'm1', companyName: '준비된곳', workspaceId: null }),
    'payrollRoster',
    { received: true, fileName: '명부.xlsx', storagePath: 'x/명부.xlsx' },
  )
  const readyWithResult = withToolResult(ready, {
    toolKey: 'employment',
    title: '회차 일정',
    verdict: null,
    verdictLabel: '1회차',
    summary: '',
    data: {},
    deadlines: [{ date: '2026-09-30', title: '1회차 신청', note: '' }],
  })
  const bare = normalizeClientOps({ id: 'm2', companyName: '서류없는곳', workspaceId: null })
  const otherTool = withToolResult(normalizeClientOps({ id: 'm3', companyName: '딴도구', workspaceId: null }), {
    toolKey: 'cretop',
    title: '크레탑 분석',
    verdict: null,
    verdictLabel: '',
    summary: '',
    data: {},
  })

  const sum = summarizeModule([readyWithResult, bare, otherTool], 'employment', TODAY)
  check('모듈 대시보드: 업체는 고객 운영 명단 그대로', sum.clients.length === 3, String(sum.clients.length))
  check('모듈 대시보드: 서류가 다 있는 업체만 바로 돌릴 수 있다', sum.ready.length === 1 && sum.ready[0].id === 'm1', sum.ready.map((c) => c.id).join(','))
  check('모듈 대시보드: 빠진 서류는 이름으로 말한다', sum.gaps.some((g) => g.clientId === 'm2' && g.missing.some((m) => m.includes('명부'))), JSON.stringify(sum.gaps))
  check('모듈 대시보드: 다른 도구의 결과는 세지 않는다', sum.results.length === 1 && sum.results[0].clientId === 'm1', String(sum.results.length))
  check('모듈 대시보드: 도구가 만든 기한을 업체와 함께 모은다', sum.dues.length === 1 && sum.dues[0].clientName === '준비된곳' && sum.dues[0].daysLeft === 7, JSON.stringify(sum.dues))

  const archived = { ...bare, archivedAt: '2026-01-01T00:00:00.000Z' }
  check('모듈 대시보드: 보관한 업체는 빼고 센다', summarizeModule([readyWithResult, archived], 'employment', TODAY).clients.length === 1)
}

/* ---- 10. D-91 모듈 기록 저장소 (업체는 만들지 않고 clientId 로 가리킨다) ---- */
{
  const run = async () => {
    await replaceRows(null, 'employment', 'employees', [])
    const saved = await saveRow(null, 'employment', 'employees', { clientId: 'm1', data: { name: '김직원', hireDate: '2026-03-02' } })
    check('모듈 기록: 저장하면 id 와 시각이 붙는다', Boolean(saved.id) && Boolean(saved.createdAt) && saved.clientId === 'm1')
    const rows = await listRows(null, 'employment', 'employees')
    check('모듈 기록: 저장한 것을 그대로 읽는다', rows.length === 1 && rowData<{ name: string }>(rows[0]).name === '김직원', JSON.stringify(rows))

    const other = await listRows(null, 'labcare', 'employees')
    check('모듈 기록: 모듈이 다르면 섞이지 않는다', other.length === 0, String(other.length))
    const otherBucket = await listRows(null, 'employment', 'notes')
    check('모듈 기록: 갈래가 다르면 섞이지 않는다', otherBucket.length === 0, String(otherBucket.length))

    await saveRow(null, 'employment', 'employees', { id: saved.id, clientId: 'm1', data: { name: '김직원', hireDate: '2026-04-01' } })
    const after = await listRows(null, 'employment', 'employees')
    check('모듈 기록: 같은 id 로 저장하면 덮어쓴다(늘어나지 않는다)', after.length === 1 && rowData<{ hireDate: string }>(after[0]).hireDate === '2026-04-01', JSON.stringify(after))

    await deleteRow(null, 'employment', 'employees', saved.id)
    check('모듈 기록: 지우면 사라진다', (await listRows(null, 'employment', 'employees')).length === 0)
  }
  await run()
}

console.log(`\ntools: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
