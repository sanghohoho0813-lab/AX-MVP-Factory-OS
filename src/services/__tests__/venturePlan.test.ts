/**
 * D-246 벤처 사업계획서(혁신성장유형) — 칸 순서 · 저장 · AI 초안 합치기(고친 칸 보호) · 사실로 채우기 · 점검 · 내보내기 ·
 * 명세서 → 재료 · AI 에 보낼 묶음 · 답 읽기.
 *
 * 실제 제출본(고객 사업계획서)은 저장소에 넣지 않는다 — 칸 순서 · 글자 수 기준만 옮겼다.
 */
import { ASSISTS, assistSystem, buildAssistPrompt } from '../../../api/_ai/assists.js'
import {
  NARRATIVE_IDS,
  VK,
  VPLAN_FIELDS,
  charCount,
  checkPlan,
  coreIpSentence,
  factFill,
  isEdited,
  mergeDraft,
  patentTitleOf,
  planMarkdown,
  planProgress,
  quotedName,
  readPlan,
  type VPlanFacts,
} from '../../certification/core/venturePlan'
import { VPLAN_BATCHES, VPLAN_STEPS, buildBatchContext, buildMarketContext, buildVentureJudgeContext, draftItemsOf, fieldsOfBatch, gateLines, judgeItemsOf } from '../../certification/integration/venturePlanAi'
import { GK, PATENT_NONE, marketDone, marketOf, normalizeAppNo, patentNoOf, patentPatch, readGate, researchersPatch, summaryGate, judgePatch, type GateState } from '../../certification/integration/ventureGate'
import { judgeOf, judgePassed, readJudgeReport } from '../aiAssist/judge'
import { PATENT_JUDGE, VENTURE_JUDGE, customSkillBlock } from '../../../api/_ai/judge.js'
import { parseSpecText } from '../patent/specParse'
import { specDigest } from '../patent/specDigest'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { buildVenturePack, ventureProgress, ventureRoutes, ventureSubmitCheck } from '../../certification/core/venturePack'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600))
  }
}

const FACTS: VPlanFacts = { companyName: '공구랩', patents: 1, researchUnit: 'dept', researchers: 2, rndExpense: 26_400_000, patentTitle: '공구 마모 예측 기반 교체시점 산출 시스템 및 방법', industryText: '소프트웨어 개발' }
const notesOf = (o: Record<string, string>) => o
const long = (n: number) => '가'.repeat(n)

/* ---------------- 칸 순서 ---------------- */
{
  const ids = VPLAN_FIELDS.map((f) => f.id)
  const order = ['tech_name', 'core_problem', 'core_ip', 'development_background', 'competitiveness_strategy', 'technology_progress', 'technology_plan_3y', 'entrepreneurship_example', 'rnd_expense', 'dev_records', 'ip_records', 'market_target', 'competitor_analysis', 'market_entry_progress', 'market_entry_plan_3y', 'collab_records', 'financing_plan', 'esg']
  const pos = order.map((id) => ids.indexOf(id))
  check('VP1 사이트 순서 — 요약 → 핵심 요약 → [1] → [2](제출본 순서)', pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), pos)
  check('VP2 서술 10칸 — 요구사항 정의서 1,000자 표와 같은 10개', NARRATIVE_IDS.length === 10 && ['development_background', 'competitiveness_strategy', 'technology_progress', 'technology_plan_3y', 'entrepreneurship_example', 'market_target', 'competitor_analysis', 'market_entry_progress', 'market_entry_plan_3y', 'financing_plan'].every((x) => NARRATIVE_IDS.includes(x)), NARRATIVE_IDS)
  check('VP3 핵심 요약 7칸 — 사이트 빈칸 문장 틀', VPLAN_FIELDS.filter((f) => f.part === 'core').length === 7 && VPLAN_FIELDS.filter((f) => f.part === 'core').every((f) => !!f.template && (f.fixed ?? []).length >= 2))
  check('VP4 체크박스 — 개발 배경 6 · 차별성 6 · 자금 조달 수단', VPLAN_FIELDS.find((f) => f.id === 'development_background')?.checks?.length === 6 && VPLAN_FIELDS.find((f) => f.id === 'competitiveness_strategy')?.checks?.length === 6 && (VPLAN_FIELDS.find((f) => f.id === 'financing_plan')?.checks?.length ?? 0) >= 6)
  check('VP5 시장진입 두 칸 — 실제 제출본 글자 수 안내(1,599 · 1,251)', /1,599/.test(VPLAN_FIELDS.find((f) => f.id === 'market_entry_progress')?.limitNote ?? '') && /1,251/.test(VPLAN_FIELDS.find((f) => f.id === 'market_entry_plan_3y')?.limitNote ?? ''))
  const ids2 = new Set(ids)
  check('VP6 칸 이름 겹침 없음', ids2.size === ids.length)
}

/* ---------------- 저장 · 읽기 ---------------- */
{
  const s = readPlan(notesOf({ [VK.text('development_background')]: '배경', [VK.checks('development_background')]: '자주 발생하는 문제임|없는 선택지', [VK.status('market_target')]: 'entered', [VK.status('esg')]: '이상한 값', [VK.patent]: '[발명의 명칭] 무엇' }))
  check('S1 칸 글 · 체크(선택지에 있는 것만) · 상태(정해진 값만) · 재료', s.text.development_background === '배경' && s.checks.development_background.join() === '자주 발생하는 문제임' && s.status.market_target === 'entered' && s.status.esg === '' && s.materials.patent.startsWith('[발명'))
  check('S2 글자 수 — 한글 · 이모지 · 줄바꿈 모두 한 글자', charCount('가나\n😀') === 4 && charCount('') === 0)
}

/* ---------------- AI 초안 합치기 — 사람이 고친 칸은 덮지 않는다 ---------------- */
{
  const s = readPlan({
    [VK.text('development_background')]: '사람이 고친 글',
    [VK.ai('development_background')]: '예전 AI 글',
    [VK.text('competitiveness_strategy')]: '예전 AI 글 2',
    [VK.ai('competitiveness_strategy')]: '예전 AI 글 2',
    [VK.status('competitiveness_strategy')]: 'entered',
    [VK.checks('development_background')]: '자주 발생하는 문제임',
  })
  check('M1 고친 칸 알아봄', isEdited(s, 'development_background') && !isEdited(s, 'competitiveness_strategy'))
  const r = mergeDraft(s, [
    { id: 'development_background', text: '새 AI 글', checks: ['시급히 해결되어야 하는 문제임'] },
    { id: 'competitiveness_strategy', text: '**새** AI 글 2\n\n\n\n끝', checks: ['기존 제품 대비 편리함', '없는 체크'] },
    { id: 'market_target', text: '빈 칸에 처음' },
    { id: 'unknown_field', text: '버림' },
    { id: 'technology_progress', text: '   ' },
  ])
  check('M2 사람이 고친 칸 → 그대로 · 새 안은 따로(suggestion)', r.kept.join() === 'development_background' && r.patch[VK.suggestion('development_background')] === '새 AI 글' && !(VK.text('development_background') in r.patch))
  check('M3 AI 가 쓴 그대로인 칸 → 새 글로 · 마크다운 지움 · 빈 줄 줄임', r.patch[VK.text('competitiveness_strategy')] === '새 AI 글 2\n\n끝' && r.patch[VK.ai('competitiveness_strategy')] === '새 AI 글 2\n\n끝')
  check('M4 글이 바뀌면 "사이트 입력함" 표시를 내림(다시 넣어야 하니까)', r.patch[VK.status('competitiveness_strategy')] === '')
  check('M5 빈 칸 → 채움 · 모르는 칸 · 빈 글은 버림', r.replaced.includes('market_target') && !r.replaced.includes('technology_progress') && !Object.keys(r.patch).some((k) => k.includes('unknown_field')))
  check('M6 체크 — 사람이 고른 칸은 그대로, 비어 있으면 선택지에 맞는 것만', !(VK.checks('development_background') in r.patch) && r.patch[VK.checks('competitiveness_strategy')] === '기존 제품 대비 편리함')
}

{
  const tpl = VPLAN_FIELDS.find((f) => f.id === 'core_problem')!.template!
  const r = mergeDraft(readPlan({ [VK.text('core_problem')]: tpl, [VK.text('core_solution')]: tpl.replace('［무엇］', '공구') }), [
    { id: 'core_problem', text: '채운 문장' },
    { id: 'core_solution', text: '채운 문장 2' },
  ])
  check('M7 문장 틀만 넣은 칸은 빈 칸처럼 채움 · 틀을 고치기 시작한 칸은 보호', r.replaced.join() === 'core_problem' && r.kept.join() === 'core_solution')
}

/* ---------------- 사실로 채우기 ---------------- */
{
  const empty = readPlan({})
  const r = factFill(empty, FACTS)
  check('F1 연구조직 · 연구개발비 · 지식재산권(출원중 · 번호는 출원 뒤) · 기술명', r.patch[VK.text('rd_org')]?.startsWith('연구개발전담부서') && r.patch[VK.text('rnd_expense')] === '26400000' && /출원중 \/ 공구 마모 예측.*\(출원 뒤 입력\).*공구랩/.test(r.patch[VK.text('ip_records')] ?? '') && r.patch[VK.text('tech_name')] === FACTS.patentTitle, r.patch)
  check('F2 핵심 요약 지식재산권 — 1건 · 연구개발전담부서 · 2명(실적은 빈칸으로 남김)', /특허출원 등 1건의 지식재산권과 연구개발전담부서 및 2명의 연구개발조직을 보유하여 ［n］건/.test(r.patch[VK.text('core_ip')] ?? ''), r.patch[VK.text('core_ip')])
  const filled = readPlan({ [VK.text('rd_org')]: '자체연구부서', [VK.text('tech_name')]: '사람이 정한 이름' })
  const r2 = factFill(filled, FACTS)
  check('F3 이미 적은 칸은 안 바꿈', !(VK.text('rd_org') in r2.patch) && !(VK.text('tech_name') in r2.patch) && r2.filled.includes('ip_records'))
  const ip = coreIpSentence(readPlan({ [VK.text('ip_records')]: '특허 / 출원중 / A\n특허 / 출원중 / B', [VK.text('dev_records')]: '자체 / 시스템 개발 / 2026-04~2026-07 / 자체', [VK.text('rd_org')]: '기업부설연구소(한국산업기술진흥협회 인정)' }), { ...FACTS, researchers: 3 })
  check('F4 지식재산권 문장 — 줄 수로 2건 · 연구소 이름(괄호 뺌) · 3명 · 실적 1건 · 빠진 것 없음', /2건의 지식재산권과 기업부설연구소 및 3명의 연구개발조직을 보유하여 1건의 기술개발/.test(ip.text) && ip.missing.length === 0, ip)
  const none = coreIpSentence(readPlan({}), { ...FACTS, patents: null, researchUnit: null, researchers: null })
  check('F5 모르면 빈칸 ［n］ 과 빠진 목록', none.missing.length === 4 && /［n］건의 지식재산권과 ［연구조직］/.test(none.text))
}

/* ---------------- 점검 ---------------- */
{
  const s = readPlan({
    [VK.text('development_background')]: long(1001),
    [VK.text('market_entry_progress')]: long(1200),
    [VK.text('competitiveness_strategy')]: '당사는 특허를 보유하여 경쟁력이 있습니다. ［무엇］',
    [VK.text('ip_records')]: '특허(국내) / 출원중 / 공구 마모 / (출원 뒤 입력)',
    [VK.text('core_problem')]: '그냥 쓴 문장',
    [VK.text('tech_name')]: '공구 마모 예측 시스템',
    [VK.text('core_market')]: '현재 당사에서 보유 또는 개발 중인 기술(제품, 서비스)명은 「다른 이름」으로서, 전체 시장은 ... 연평균 ...',
  })
  const issues = checkPlan(s)
  const has = (field: string, id: string) => issues.some((i) => i.field === field && i.id === id)
  check('C1 1,000자 넘음 → 주의(막지 않음)', has('development_background', 'OVER') && issues.find((i) => i.field === 'development_background' && i.id === 'OVER')?.level === 'warn')
  check('C2 시장진입 칸은 넘으면 제출본 사례를 함께', /1,599/.test(issues.find((i) => i.field === 'market_entry_progress' && i.id === 'OVER')?.text ?? ''))
  check('C3 출원중인데 "특허를 보유" → 고칠 말', has('competitiveness_strategy', 'IP_WORDING'))
  check('C4 빈칸 ［ ］ 남음', has('competitiveness_strategy', 'PLACEHOLDER'))
  check('C5 핵심 요약 문장 틀과 다름(참고)', has('core_problem', 'TEMPLATE'))
  check('C6 핵심 요약 기술명 ≠ 신청기술명', has('core_market', 'NAME') && quotedName(s.text.core_market) === '다른 이름')
  check('C7 체크박스 안 고름(참고)', has('development_background', 'CHECKS'))
  const reg = checkPlan(readPlan({ [VK.text('ip_records')]: '특허 / 등록 / A / 10-1234567', [VK.text('competitiveness_strategy')]: '특허를 보유' }))
  check('C8 등록 특허가 있으면 "보유" 는 문제 아님', !reg.some((i) => i.id === 'IP_WORDING'))
  check('C9 빈 칸은 점검하지 않음', checkPlan(readPlan({})).length === 0)
}

/* ---------------- 진행 · 내보내기 ---------------- */
{
  const all: Record<string, string> = {}
  for (const id of NARRATIVE_IDS) all[VK.text(id)] = '본문'
  for (const f of VPLAN_FIELDS.filter((x) => x.part === 'core')) all[VK.text(f.id)] = '문장'
  all[VK.text('tech_name')] = '이름'
  all[VK.status('market_target')] = 'entered'
  const p = planProgress(readPlan(all))
  check('P1 다 찼다 — 서술 10 · 핵심 요약 7 · 기술명', p.complete && p.narrativeFilled === 10 && p.entered === 1)
  const part = { ...all }
  delete part[VK.text('core_growth')]
  check('P2 핵심 요약 하나 비면 아직', !planProgress(readPlan(part)).complete)
  const md = planMarkdown(readPlan({ ...all, [VK.checks('development_background')]: '자주 발생하는 문제임' }), '공구랩')
  check('P3 한 장(MD) — 회사명 · 순서 · 체크 · 글자 수', md.startsWith('# 공구랩') && md.indexOf('## 사업계획서 요약') < md.indexOf('## [1] 문제정의') && md.indexOf('## [1] 문제정의') < md.indexOf('## [2] 성장전략') && md.includes('체크: 자주 발생하는 문제임') && md.includes('_(2자)_'))
}

/* ---------------- 명세서 → 재료 ---------------- */
{
  const md = [
    '【발명의 설명】', '【발명의 명칭】', '공구 마모 예측 기반 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR ESTIMATING TOOL REPLACEMENT TIME}',
    '【기술분야】', '[0001] 본 발명은 공구 진동정보로 마모를 예측하는 시스템에 관한 것이다.',
    '【발명의 내용】', '【해결하고자 하는 과제】', '[0002] 마모량을 예측하는 것을 목적으로 한다.',
    '【과제의 해결 수단】', '[0003] 시스템(500)은 신호 정규화부(510)와 마모판정부(530)를 포함한다.',
    '【발명의 효과】', '[0004] 교체 시점을 미리 알 수 있다.',
    '【도면의 간단한 설명】', '[0005] 도 1은 전체 구성도이다.',
    '【부호의 설명】', '500: 공구관리 시스템', '510: 신호 정규화부',
    '【청구범위】', '【청구항 1】', '진동신호를 측정항목으로 변환하는 신호 정규화부;를 포함하는 시스템.', '【청구항 2】', '청구항 1에 있어서, 마모판정부를 더 포함하는 시스템.', '【청구항 3】', '진동신호를 변환하는 단계;를 포함하는 방법.',
    '【요약서】', '【요약】', '공구 마모를 예측한다.',
  ].join('\n')
  const d = specDigest(parseSpecText(md, 'x.md'))
  check('D1 명칭 한글 · 영문 나눔', d.title === '공구 마모 예측 기반 교체시점 산출 시스템 및 방법' && d.titleEn.startsWith('SYSTEM AND METHOD'), d)
  check('D2 청구항 3 · 독립 2(인용 안 하는 것)', d.claims.total === 3 && d.claims.independent === 2, d.claims)
  check('D3 재료 — 기술분야 · 과제 · 해결 수단 · 효과 · 독립 청구항 · 구성요소, 문단 번호 뗌', ['[기술분야]', '[해결하려는 과제]', '[과제의 해결 수단]', '[발명의 효과]', '[독립 청구항 1]', '[독립 청구항 3]', '[구성요소(부호의 설명)] 공구관리 시스템 · 신호 정규화부'].every((x) => d.text.includes(x)) && !d.text.includes('[0001]'), d.text)
  check('D5 재료 첫 줄에서 특허 명칭만(영문 괄호 뗌 · 사람이 고친 재료에서도)', patentTitleOf(d.text) === '공구 마모 예측 기반 교체시점 산출 시스템 및 방법' && patentTitleOf('메모\n[발명의 명칭] 측정 장치(제1 실시예)') === '측정 장치(제1 실시예)' && patentTitleOf('') === '')
  check('D4 길이 상한', specDigest(parseSpecText(md.replace('마모량을 예측하는 것을 목적으로 한다.', long(5000)), 'x.md'), 1500).text.length <= 1600)
}

/* ---------------- AI 에 보낼 묶음 · 답 읽기 ---------------- */
{
  check('A1 묶음 6개 · 묶음마다 긴 칸 2개까지(60초 안)', VPLAN_BATCHES.length === 6 && VPLAN_BATCHES.every((b) => fieldsOfBatch(b.key).filter((f) => f.limit === 1000).length <= 2))
  const batched = new Set(VPLAN_BATCHES.flatMap((b) => fieldsOfBatch(b.key).map((f) => f.id)))
  check('A2 서술 10칸 모두 어느 묶음에 있음 · 지식재산권 문장은 규칙으로(AI 아님)', NARRATIVE_IDS.every((id) => batched.has(id)) && !batched.has('core_ip'))
  check('A3 화면 · 서버 단추 이름표가 같다(venture.*)', VPLAN_BATCHES.every((b) => ASSISTS[b.assistId]?.page === 'venture' && ASSISTS[b.assistId]?.kind === 'write' && ASSIST_PRESETS.some((p) => p.id === b.assistId && p.label === ASSISTS[b.assistId].label)))
  const s = readPlan({ [VK.patent]: '[발명의 명칭] 공구 마모\n' + long(1300), [VK.ax]: 'MVP: 관리자 화면 · 휴대폰 입력 구현', [VK.memo]: '거래처 49곳 · 월 105톤(2026-06 기준)', [VK.text('development_background')]: '이미 쓴 배경 ' + long(700), [VK.text('competitiveness_strategy')]: '이 묶음 칸' })
  const ctx = buildBatchContext({ batch: 'p1', state: s, facts: FACTS, today: '2026-10-20' })
  const rows = ctx.sections.flatMap((x) => x.rows)
  check('A4 자료 줄은 600자 아래로 끊음(서버 메모 한도)', rows.every((r) => String(r.memo ?? '').length <= 600) && ctx.sections[0].rows.length >= 3)
  check('A5 이미 쓴 칸 — 이번 묶음 칸은 빼고 보냄', !ctx.sections[3].rows.some((r) => String(r.part).startsWith('development_background') || String(r.part).startsWith('competitiveness_strategy')))
  const ctx2 = buildBatchContext({ batch: 'p2', state: s, facts: FACTS, today: '2026-10-20' })
  check('A6 다음 묶음엔 앞 칸이 이어 갈 자료로', ctx2.sections[3].rows.some((r) => String(r.part).startsWith('development_background')))
  check('A7 규칙 — 이번 묶음 칸만 · 특허/AX/벤처 한 이야기 · 출원 그대로', ctx.rules!.some((r) => r.startsWith('칸 development_background')) && !ctx.rules!.some((r) => r.startsWith('칸 market_target')) && ctx.rules!.some((r) => r.includes('한 이야기')) && ctx.rules!.some((r) => r.includes('출원 상태 그대로')))
  check('A8 사실 — 회사명 · 연구조직 · 인원 · 연구개발비 · 특허 명칭', ['회사명: 공구랩', '연구개발전담부서', '2명', '26,400,000원', '특허(출원) 명칭'].every((x) => ctx.facts!.join('\n').includes(x)))
  const prompt = buildAssistPrompt(ASSISTS['venture.p1'], ctx, '')
  check('A9 서버가 만드는 글 — 자료 · 규칙집 · 4만 자 안', prompt.user.includes('[규칙집]') && prompt.user.includes('MVP: 관리자 화면') && prompt.user.length < 40000 && assistSystem(ASSISTS['venture.p1']).includes('venture.p1'))
  const items = draftItemsOf(
    {
      headline: 'x',
      items: [
        { title: 'development_background', body: '배경 본문', tag: '자주 발생하는 문제임, 꼭 해결해야 하는 문제임', detail: '확인할 점' },
        { title: '솔루션으로서의 제품/서비스 소개(경쟁력 확보 방안)', body: '경쟁력 본문' },
        { title: 'market_target', body: '다른 묶음 칸 — 버림' },
        { title: 'competitiveness_strategy', body: '', detail: '본문 없이 확인할 점만' },
      ],
    },
    'p1',
  )
  check('A10 답 읽기 — id · 칸 이름으로 찾음 · tag → 체크 · 다른 묶음 칸 · 빈 본문 버림 · detail 은 본문 아님(확인할 점으로만)', items.length === 2 && items[0].id === 'development_background' && items[0].checks?.length === 2 && items[0].note === '확인할 점' && items[1].id === 'competitiveness_strategy' && items[1].text === '경쟁력 본문' && !items[1].note, items)
  check('A11 답이 없으면 빈 목록', draftItemsOf(null, 'p1').length === 0)
}

/* ---------------- 벤처 제출 전 확인 — 기업인증 안에서 쓴 사업계획서 ---------------- */
{
  const vctx = { companyName: '공구랩', entity: 'corporation', years: 3, months: 40, industryText: '소프트웨어 개발', industryGroup: 'software', employees: 5, size: 'small', revenue: 300_000_000, operatingProfit: null, netIncome: null, totalAssets: null, totalLiabilities: null, rndExpense: 26_400_000, researchUnit: 'dept', researchers: 2, patents: 1, held: [], b2b: null, procurement: null, exportPlan: null, policyFundPlan: null, rndPlan: null, exclusionFlags: [], evidence: [], today: '2026-10-20' } as never
  const routes = ventureRoutes(vctx)
  const prog = ventureProgress({ sections: buildVenturePack(vctx, {}), notes: {}, hasBizPlan: false, status: 'preparing' })
  const row = (w?: Parameters<typeof ventureSubmitCheck>[0]['written']) => ventureSubmitCheck({ routes, progress: prog, missingEvidence: ['사업계획서'], haveEvidence: [], written: w }).find((r) => r.key === 'plan')!
  check('W1 사업계획 줄 — 안 썼으면 쓰기 또는 받기 · 반쯤 썼으면 몇 칸 · 다 썼으면 ✓(서류 없어도)', /사업계획서 쓰기/.test(row().text) && row({ narrativeFilled: 4, narrativeTotal: 10, complete: false, entered: 0, total: 28 }).text.includes('4/10') && row({ narrativeFilled: 10, narrativeTotal: 10, complete: true, entered: 3, total: 28 }).mark === 'ok', [row().text, row({ narrativeFilled: 10, narrativeTotal: 10, complete: true, entered: 3, total: 28 })])
}

/* ---------------- D-263 요약 전에 반드시 — 시장조사 · 출원번호 · 기술인력 ---------------- */
{
  check('G1 출원번호 읽기 — 줄표 · 붙여 씀 · 띄어 씀 · 문장 안 → 10-2025-0123456', ['10-2025-0123456', '1020250123456', '10 2025 0123456', '출원번호 제10-2025-0123456호'].every((v) => normalizeAppNo(v) === '10-2025-0123456'), ['1020250123456', '출원번호 제10-2025-0123456호'].map(normalizeAppNo))
  check('G2 출원번호 아님 — 50 으로 시작 · 연도 1980 · 앞에 숫자가 더 붙음 · 등록번호(10-1234567)', ['50-2025-0123456', '10-1980-0123456', '110202501234567', '10-1234567', ''].every((v) => normalizeAppNo(v) === ''))
  const empty = readPlan({})
  const g0 = readGate({})
  const sg0 = summaryGate(empty, { ...FACTS, researchUnit: null, researchers: null }, g0)
  check('G3 아무것도 없으면 요약 못 씀 — 모자란 것 세 가지(시장조사 · 출원번호 · 기술인력)', !sg0.ok && sg0.missing.length === 3 && sg0.missing[0].startsWith('시장조사') && sg0.missing[1] === '출원번호' && sg0.missing[2].startsWith('기술인력'), sg0.missing)
  const market = marketOf({ headline: 'TAM 1조', items: [
    { title: 'tam', amount: '1조 2,000억 원', detail: '제조업체 4만 곳 × 연 300만 원', tag: '통계청 2025', when: '2025' },
    { title: 'SAM', amount: '1,800억 원', detail: '절삭 공구 쓰는 중소 제조 6천 곳' },
    { title: '수익시장', amount: '36억 원', detail: '3년 안 120곳 × 3,000만 원' },
    { title: 'cagr', amount: '', detail: '검색 근거 없음 — 확인 필요' },
    { title: 'customer', body: '절삭 공구를 쓰는 중소 제조업체' },
  ] }, { grounded: true, sources: [{ title: '통계청', url: 'https://kostat.go.kr/x' }, { title: '가짜', url: 'javascript:alert(1)' }] }, '2026-10-22')
  check('G4 시장조사 답 읽기 — 이름표 tam/SAM/수익시장 · 출처 · 기준연도 · 근거 없음은 빈 숫자 · 이상한 주소 버림', !!market && market.tam.amount === '1조 2,000억 원' && market.tam.source === '통계청 2025' && market.tam.year === '2025' && market.sam.amount === '1,800억 원' && market.som.amount === '36억 원' && market.cagr.amount === '' && market.customer.includes('중소 제조') && market.sources.length === 1 && market.grounded && marketDone(market), market)
  check('G5 숫자가 하나도 없는 답 → 시장조사 아님(null)', marketOf({ headline: 'x', items: [{ title: 'tam', detail: '검색 근거 없음 — 확인 필요' }] }, null, '2026-10-22') === null)
  const half = { ...market!, som: { amount: '', basis: '', source: '', year: '' } }
  check('G6 SOM 이 비면 시장조사를 밟지 않은 것', !marketDone(half) && !summaryGate(empty, FACTS, { ...g0, market: half }).market.ok)
  const gNone: GateState = { ...g0, market, patentNo: PATENT_NONE }
  const sg1 = summaryGate(empty, { ...FACTS, researchUnit: 'none', researchers: 0 }, gNone)
  check('G7 시장조사 + "아직 출원 전" + 전담부서 없음 · 연구 인원 0명 → 요약 써도 됨(0명 · 없음도 답)', sg1.ok && sg1.patent.source === 'none' && /출원 전/.test(sg1.patent.text) && sg1.rd.org.startsWith('없음') && sg1.rd.staff === 0, sg1)
  const withIp = readPlan({ [VK.text('ip_records')]: '특허 / 출원 / 공구 마모 예측 / 10-2025-0099999' })
  check('G8 출원번호 찾는 순서 — 직접 넣은 것 → 이전 컨설팅 기록 → 지식재산권 칸', patentNoOf(withIp, { applicationNumber: '10-2024-0000001' }, { patentNo: '1020250123456' }).source === 'direct' && patentNoOf(withIp, { applicationNumber: '10-2024-0000001' }, { patentNo: '' }).value === '10-2024-0000001' && patentNoOf(withIp, {}, { patentNo: '' }).value === '10-2025-0099999' && patentNoOf(empty, {}, { patentNo: 'abc' }).source === '')
  const ipWait = readPlan({ [VK.text('ip_records')]: '특허 / 출원 / 공구 마모 / (출원 뒤 입력)' })
  const pp = patentPatch(ipWait, '10 2025 0123456')
  check('G9 출원번호 저장 — 고친 모양으로 · 지식재산권 칸 "(출원 뒤 입력)" 자리에도 · 틀린 번호는 저장 안 함', pp[GK.patentNo] === '10-2025-0123456' && pp[VK.text('ip_records')].endsWith('10-2025-0123456') && Object.keys(patentPatch(ipWait, '12345')).length === 0 && patentPatch(ipWait, PATENT_NONE)[GK.patentNo] === PATENT_NONE, pp)
  check('G10 연구 인원 저장 — 0명 저장 · 음수/빈칸은 지움 · 직접 넣은 인원이 사실 창고보다 먼저', researchersPatch(0)[GK.researchers] === '0' && researchersPatch(-1)[GK.researchers] === '' && researchersPatch(null)[GK.researchers] === '' && summaryGate(empty, FACTS, { ...gNone, researchers: '5' }).rd.staff === 5)
  const sOrg = readPlan({ [VK.text('rd_org')]: '기업부설연구소(한국산업기술진흥협회 인정)' })
  const lines = gateLines(sOrg, { ...FACTS, researchers: null }, { ...g0, patentNo: '10-2025-0123456', researchers: '3' })
  check('G11 AI 에 보내는 사실 — 출원번호(출원 중 · 등록 아님) · 연구 조직 · 인원', lines[0].includes('10-2025-0123456') && lines[0].includes('등록 아님') && lines[1].includes('기업부설연구소') && lines[2].includes('3명'), lines)
  const gFull: GateState = { ...g0, market, patentNo: '10-2025-0123456', researchers: '2' }
  const sumCtx = buildBatchContext({ batch: 'sum', state: empty, facts: FACTS, today: '2026-10-22', gate: gFull })
  check('G12 요약 묶음 자료 — 시장조사 구역(TAM 규모 · 출처) · 출원번호 사실이 같이 감', sumCtx.sections.some((x) => x.name.startsWith('시장조사') && JSON.stringify(x.rows).includes('1조 2,000억 원') && JSON.stringify(x.rows).includes('통계청 2025')) && sumCtx.facts!.some((f) => f.includes('10-2025-0123456')))
  const mCtx = buildMarketContext({ state: readPlan({ [VK.memo]: '거래처 49곳', [VK.text('market_target')]: '중소 제조' }), facts: FACTS, today: '2026-10-22', gate: g0 })
  check('G13 시장조사 단추 자료 — 메모 · 이미 쓴 목표시장 칸 · 회사 사실', JSON.stringify(mCtx.sections).includes('거래처 49곳') && JSON.stringify(mCtx.sections).includes('market_target') && mCtx.facts![0].includes('공구랩'))
  check('G14 [전부 써줘] 차례 — 시장조사 → 요약 → 악마판사 ① → 본문 5묶음 → 악마판사 ②', VPLAN_STEPS.map((x) => x.key).join() === 'market,sum,judgeSum,p1,p2,g1,g2,x,judgeAll' && VPLAN_BATCHES[0].key === 'sum', VPLAN_STEPS.map((x) => x.key))
}

/* ---------------- D-263 악마판사 — 판정 읽기 · 고친 칸 · 지시문 ---------------- */
{
  const ans = { headline: '점수 84/100 · P0 1개 · 고친 칸 2개', items: [
    { title: 'score', amount: '84', detail: 'A9 B8 C9 D7 E8 F7 G9 H9 I9 J9' },
    { title: 'verdict', tag: 'P0', detail: '출원인데 "특허 보유" 라고 씀', body: 'core_diff 를 "출원(10-2025-0123456)" 으로 고침' },
    { title: 'verdict', tag: '대표 확인', detail: '3년 고객 수 근거 없음', body: '지금 거래처가 몇 곳인가요?' },
    { title: 'core_diff', body: '고친 차별성 문장' },
    { title: 'development_background', body: '본문 칸 — 요약 판정이면 버림' },
    { title: '판정', tag: '감점', detail: '' },
  ] }
  const j = judgeOf(ans)
  check('J1 판사 답 읽기 — 점수 84 · A~J 한 줄 · 판결 2(P0 · 대표 확인 · 빈 것 버림) · 고친 칸 2', j.score === 84 && j.scores.startsWith('A9') && j.verdicts.length === 2 && j.verdicts[0].level === 'P0' && j.verdicts[0].fix.includes('고침') && j.verdicts[1].level === '대표 확인' && j.rewrites.length === 2, j)
  check('J2 통과 기준 — 90점 이상 · P0 없음(84점 · P0 있음은 아님 · 92점 P0 있음도 아님)', !judgePassed({ score: j.score, verdicts: j.verdicts }) && !judgePassed({ score: 92, verdicts: j.verdicts }) && judgePassed({ score: 92, verdicts: [] }) && !judgePassed(null))
  check('J3 점수 줄이 없으면 headline 의 "점수 NN" 에서', judgeOf({ headline: '점수 91/100 · 고칠 것 없음', items: [] }).score === 91 && judgeOf({ headline: '좋음', items: [] }).score === null)
  const sumItems = judgeItemsOf(j.rewrites, 'sum')
  const allItems = judgeItemsOf(j.rewrites, 'full')
  check('J4 고친 칸 → 초안 — 요약 판정은 요약 칸만 · 전체 판정은 본문 칸도', sumItems.map((x) => x.id).join() === 'core_diff' && allItems.map((x) => x.id).join() === 'core_diff,development_background', { sumItems, allItems })
  const r = readJudgeReport({ at: 'x', scope: 'sum', score: 140, verdicts: [{ level: '이상', text: 't' }, 'bad'], fixed: ['a'], rounds: 9, custom: true, headline: 'h' })
  check('J5 저장된 판정 안전하게 읽기 — 100 넘는 점수 버림 · 모르는 단계는 감점 · 횟수 3까지', !!r && r.score === null && r.verdicts.length === 1 && r.verdicts[0].level === '감점' && r.rounds === 3 && r.custom && readJudgeReport(null) === null && readJudgeReport({}) === null, r)
  const g = readGate({})
  const jp = judgePatch(g, 'sum', r!)
  check('J6 판정 저장 — 요약 · 전체 따로 남고 다시 읽힘', readGate(jp).judge.sum?.headline === 'h' && readGate(jp).judge.full === null)
  const jctx = buildVentureJudgeContext({ scope: 'sum', state: readPlan({ [VK.text('core_diff')]: '차별성 글', [VK.text('development_background')]: '본문 글' }), facts: FACTS, today: '2026-10-22', gate: g })
  check('J7 판사 ① 자료 — 요약 · 핵심 요약 칸만(본문 빼고) · 칸 규칙 · 판정 범위 "요약"', JSON.stringify(jctx.sections).includes('차별성 글') && !JSON.stringify(jctx.sections).includes('본문 글') && jctx.purpose.includes('요약') && jctx.rules!.some((x) => x.startsWith('칸 core_diff')))
  const sysJ = assistSystem(ASSISTS['venture.judge'], { skill: '/악마판사 대표표식 — 숫자 하나라도 어긋나면 P0' })
  check('J8 서버 판사 지시문 — 기본 악마판사(벤처) · 대표 정의가 기본보다 우선 · 출력 형식 그대로', sysJ.includes(VENTURE_JUDGE[0]) && sysJ.includes('대표표식') && sysJ.indexOf('대표표식') > sysJ.indexOf(VENTURE_JUDGE[0]) && sysJ.includes('우선한다') && sysJ.includes('[출력 형식]'))
  const sysSum = assistSystem(ASSISTS['venture.sum'], { skill: '대표표식' })
  const sysP1 = assistSystem(ASSISTS['venture.p1'])
  check('J9 쓰기 단추에도 — 최종본 규칙(한 번에 끝냄 · "보완하면 좋다" 금지) + 악마판사 기준 · 대표 정의', [sysSum, sysP1].every((x) => x.includes('[최종본 규칙 — 한 번에 끝낸다]') && x.includes('보완하면 좋다') && x.includes(VENTURE_JUDGE[0])) && sysSum.includes('대표표식') && !sysP1.includes('대표표식'))
  const sysSpec = assistSystem(ASSISTS['spec.judge'], { skill: '대표표식' })
  check('J10 명세서 판사 · 쓰기 단추 — 특허 악마판사 · 최종본 규칙(spec.a~e · parts · fix)', sysSpec.includes(PATENT_JUDGE[0]) && sysSpec.includes('대표표식') && ['spec.a', 'spec.b', 'spec.c', 'spec.d', 'spec.e', 'spec.parts', 'spec.fix'].every((id) => assistSystem(ASSISTS[id]).includes('[최종본 규칙') && assistSystem(ASSISTS[id]).includes(PATENT_JUDGE[0])))
  check('J11 다른 단추엔 붙지 않음 — 시장조사 · 아이디어 · 오늘 할 일', ['venture.market', 'spec.idea', 'today.top3'].every((id) => !assistSystem(ASSISTS[id], { skill: '대표표식' }).includes('대표표식') && !assistSystem(ASSISTS[id]).includes('[최종본 규칙')))
  check('J12 대표 정의 — 빈 글이면 아무것도 안 붙음 · 8,000자에서 자름', customSkillBlock('').length === 0 && customSkillBlock('  ').length === 0 && customSkillBlock('가'.repeat(9000))[2].length === 8000)
  check('J13 화면 이름표 = 서버(시장조사 · 판사 둘)', ['venture.market', 'venture.judge', 'spec.judge'].every((id) => ASSIST_PRESETS.some((p) => p.id === id && p.label === ASSISTS[id].label && p.kind === ASSISTS[id].kind)) && ASSISTS['venture.market'].research === true)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
