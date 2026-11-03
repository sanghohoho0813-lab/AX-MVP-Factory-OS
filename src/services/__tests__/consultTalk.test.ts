/**
 * D-508 고객에게 이렇게 말하세요 — 판정 그대로 말하기 카드 · 미팅 대본.
 * 엔진이 낸 글만 쓰는지(새 숫자 없음) · 모듈마다 쉽게 말하면 · 자주 묻는 것 · 조심할 말 · 대본 순서.
 */
import { normalizeClientOps } from '../clientOpsService'
import { buildInsights, topPicks, type Insight } from '../clientInsights'
import { TALK_CAUTION, faqSearch, meetingScript, meetingScriptText, scenarioTalk, scenarioTopic, talkCard, talkText, talkTopic } from '../consultTalk'
import { runScenarios } from '../scenarios'
import type { ClientOpsRecord } from '../../types/clientOps'
import { CONSULT_TERMS, splitTerms } from '../consultTerms'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}

const today = '2026-10-14'
const full = normalizeClientOps({
  id: 'full',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  establishedAt: '2023-03-02',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  businessAddress: '경기도 화성시 동탄대로 1',
  representativeBirth: '1990-05-05',
  employeeCount: '12',
  taxProfile: { monthlySalary: '5,000,000', retainedEarnings: '800,000,000', ceoStartDate: '2023-03-02', par: '5000', loanBalance: '120,000,000' },
  shareholderRegister: [
    { id: 'h1', name: '김한솔', relation: 'ceo', shares: 8000, acquirePrice: 5000 },
    { id: 'h2', name: '김다온', relation: 'child', shares: 2000, acquirePrice: 5000 },
  ],
  factValues: { totalAssets: '3,000,000,000', totalLiabilities: '1,200,000,000', netIncome: '400,000,000', revenue: '5,000,000,000' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as unknown as Partial<ClientOpsRecord>)
const empty = normalizeClientOps({ id: 'empty', companyName: '빈회사', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' } as unknown as Partial<ClientOpsRecord>)

const ins = buildInsights(full, today, [])
const byKey = (k: string) => ins.find((i) => i.key === k)!
const numbers = (s: string) => (s.match(/\d[\d,.]*\s*(?:만원|억원|원|%|명)/g) ?? []).map((x) => x.replace(/\s+/g, ''))

// T1 카드가 있는 모듈 · 없는 모듈
const cards = ins.map((i) => ({ i, c: talkCard(i) }))
check(
  'T1 정책자금 · 고용 · 창업감면 · 연구소 · 절세 · 기업인증 · 지원사업은 말하기 카드 · 크레탑은 없음(분석 도구)',
  cards.every(({ i, c }) => (i.key === 'cretop' ? c === null : c !== null)),
  cards.map(({ i, c }) => `${i.key}:${c ? c.topic : '-'}`),
)

// T2 정책자금 — 머리글(가능성 · 추천 기관)을 읽는 말로 · 숫자 새로 만들지 않음
const pol = byKey('policy-funding')
const polCard = talkCard(pol)!
const head = /^진행 가능성\s+(\S+)\s+·\s+추천 기관\s+(.+)$/.exec(pol.headline)
check(
  'T2 정책자금 — "정책자금은 {기관} 쪽이 가장 맞고, 진행 가능성은 \'{수준}\'" · 갚는 돈(대출) · 무조건 금지',
  !!head && polCard.say[0].includes(`${head[2]} 쪽이 가장 맞고`) && polCard.say[0].includes(`'${head[1]}'`) && /대출/.test(polCard.easy) && polCard.faq.some((f) => f.q === '갚아야 하나요?') && polCard.avoid.some((a) => a.includes('무조건')),
  { headline: pol.headline, say: polCard.say },
)

// T3 절세 — 가지급금 머리글이면 가지급금 이야기 · 금액은 엔진 amount 그대로
const tax = byKey('tax')
const taxCard = talkCard(tax)!
check(
  'T3 절세 — 가지급금이 있으면 가지급금 카드(인정이자) · 금액 줄은 엔진 금액 글 그대로(조사 맞춤)',
  taxCard.topic === 'loan' && taxCard.say[0].startsWith('대표님, 재무제표를 보니 가지급금이') && /인정이자/.test(taxCard.easy) && (!tax.amount || taxCard.say.some((s) => s.includes(tax.amount!))),
  { headline: tax.headline, amount: tax.amount, say: taxCard.say },
)

// T4 말하기 카드의 숫자는 판정 글(머리글 · 금액)에 있던 숫자뿐 — 새 숫자를 만들지 않는다
const stray = cards
  .filter(({ c }) => c)
  .flatMap(({ i, c }) => {
    const allowed = new Set([...numbers(i.headline), ...numbers(i.amount ?? ''), ...numbers(i.detail), ...numbers(i.missing.join(' ')), ...(i.request ? numbers(`${i.request.count}가지`) : [])])
    return numbers(c!.say.join(' ')).filter((n) => !allowed.has(n)).map((n) => `${i.key}:${n}`)
  })
check('T4 고객에게 읽을 말의 숫자는 판정 글에 있던 숫자뿐(새로 계산 · 부풀림 0)', stray.length === 0, stray)

// T5 모든 카드 — 쉽게 말하면 · 자주 묻는 것 2개 이상 · 조심할 말 · 'AI' 라고 부르지 않음 · '확정' 이라고 단정하지 않음
const bad = cards
  .filter(({ c }) => c)
  .filter(({ c }) => !c!.easy || c!.faq.length < 2 || !c!.avoid.length || /\bAI\b/.test(talkText(c!)) || c!.say.some((s) => /확정(?!\s*금액이 아니라)/.test(s) || /무조건/.test(s)))
  .map(({ i }) => i.key)
check('T5 카드마다 쉽게 말하면 · 자주 묻는 것 ≥2 · 조심할 말 · AI 낱말 0 · 읽을 말에 확정/무조건 단정 0', bad.length === 0, bad)

// T6 자료가 모자란 판정(필요) — 무엇만 보내 주시면 바로 확인 · 숫자 없이
const emptyIns = buildInsights(empty, today, [])
const needCards = emptyIns.filter((i) => i.tone === 'need').map((i) => talkCard(i)).filter(Boolean)
check(
  'T6 빈 업체 — 필요한 판정은 "…만 보내 주시면(서류) / 알려 주시면(정보) 가능 여부를 바로 확인" · 명부는 보내 · 업종 · 설립일은 알려',
  needCards.length > 0 &&
    needCards.every((c) => /만 (보내|알려) 주시면 가능 여부를 바로 확인/.test(c!.say[0]) || c!.say[0].includes('더 확인하면')) &&
    needCards.some((c) => c!.key === 'employment' && c!.say[0].includes('4대보험 가입자 명부만 보내 주시면')) &&
    needCards.some((c) => c!.key === 'policy-funding' && c!.say[0].includes('알려 주시면')),
  needCards.map((c) => c!.say[0]),
)

// T7 이야기 나누기 — 같은 모듈이라도 머리글로
const fake = (over: Partial<Insight>): Insight => ({ key: 'tax', label: '절세 설계', tone: 'maybe', headline: '', detail: '', missing: [], openPath: '/', openLabel: '', action: null, ...over })
check(
  'T7 갈래 — 퇴직금 · 급여/배당 · 법인전환 · 경정청구(고용 · 연구소 · 창업감면)',
  talkTopic(fake({ headline: '대표 퇴직금 — 지금 한도까지 받으면 세후 약 1.2억원' })) === 'retire' &&
    talkTopic(fake({ headline: '대표가 1억 더 가져간다면 — 배당 쪽이 세금이 덜 나와요' })) === 'pay' &&
    talkTopic(fake({ label: '법인전환 검토', headline: '법인으로 바꾸면 — 이익을 다 가져가도 세금이 줄어요' })) === 'convert' &&
    talkTopic(fake({ key: 'employment', label: '고용지원금', headline: '2025년 신고서에 통합고용세액공제가 빠졌어요 — 경정청구로 돌려받을 수 있어 보여요' })) === 'employment-refund' &&
    talkTopic(fake({ key: 'labcare', label: '연구소', headline: '연구소가 있는데 신고서에 연구개발비 세액공제가 없어요 — 경정청구 검토' })) === 'lab-refund' &&
    talkTopic(fake({ key: 'startup-tax', label: '창업감면', headline: '감면 기간은 끝났지만 2023년분 창업감면이 신고서에 없어요 — 경정청구 검토' })) === 'startup-refund',
)
const pay = talkCard(fake({ headline: '대표가 1억 더 가져간다면 — 배당 쪽이 세금이 덜 나와요', amount: '세후 1억 기준 약 830만원 덜 냄' }))!
const retire = talkCard(fake({ headline: '대표 퇴직금 — 지금 한도까지 받으면 세후 약 1.2억원', amount: '퇴직금 한도 약 1.5억원' }))!
check(
  'T8 급여/배당 · 퇴직금 — 머리글의 쪽 · 세후 금액을 읽는 말로 · 금액 줄은 조사 맞춤("830만원 덜 냄으로"가 아니라 "덜 냄으로")',
  pay.say[0] === '대표님이 1억을 더 가져가신다면, 이 회사 숫자로는 배당 쪽이 세금이 덜 나와요.' && retire.say[0].includes('약 1.2억원이 남는') && retire.say[1].startsWith('숫자로는 퇴직금 한도 약 1.5억원으로 나와요'),
  { pay: pay.say, retire: retire.say },
)
const refund = talkCard(fake({ key: 'employment', label: '고용지원금', tone: 'good', headline: '2025년 신고서에 통합고용세액공제가 빠졌어요 — 경정청구로 돌려받을 수 있어 보여요' }))!
check(
  "T9 경정청구 카드 — 머리글 ' — ' 는 문장 사이로 · 5년 안 · 2개월 안 결과",
  refund.say[0] === '대표님, 2025년 신고서에 통합고용세액공제가 빠졌어요. 경정청구로 돌려받을 수 있어 보여요.' && refund.say[1].includes('세무사님과 다시 계산') && refund.faq.some((f) => f.a.includes('5년')) && refund.faq.some((f) => f.a.includes('2개월')),
  refund.say,
)
const no = talkCard(fake({ key: 'startup-tax', label: '창업감면', tone: 'no', headline: '창업 5년이 지나 감면 기간이 끝났을 가능성이 커요' }))!
check('T10 안 맞는 판정 — 솔직하게("지금 자료로는 어려워 보여요") · 다른 제안부터', no.say[0].startsWith('대표님, 창업감면은 지금 자료로는 어려워 보여요.') && no.say[1].includes('먼저 말씀드린 것'), no.say)

// T11 미팅 대본 — 먼저 제안할 것과 같은 순서 · 시작 → 여쭐 것 → 제안 → (받을 서류) → 마무리
const script = meetingScript(full, ins)
const picks = topPicks(ins).filter((p) => talkCard(p))
const ids = script.sections.map((s) => s.id)
check(
  'T11 미팅 대본 — 시작 · 먼저 여쭤볼 것 · 제안(먼저 제안할 것과 같은 순서) · 마무리 · 다음 약속',
  ids[0] === 'open' && ids[1] === 'ask' && ids[ids.length - 1] === 'close' && script.pickCount === picks.length && picks.every((p, i) => ids[2 + i] === `pick-${p.key}`) && script.sections.find((s) => s.id === 'close')!.lines.some((l) => l.includes('다음 미팅')),
  { ids, picks: picks.map((p) => p.key) },
)
check(
  'T12 제안 칸 — 말하기 카드와 같은 말 · 대표님이 물을 것 2개',
  picks.every((p) => {
    const sec = script.sections.find((s) => s.id === `pick-${p.key}`)!
    return JSON.stringify(sec.lines) === JSON.stringify(talkCard(p)!.say) && sec.faq?.length === 2
  }),
)
const emptyScript = meetingScript(empty, emptyIns)
check(
  'T13 제안이 없는 업체 — 자료 받는 미팅(여쭐 것에 받을 자료 · 제안 칸 0 · 받을 서류 칸)',
  emptyScript.pickCount === 0 && !emptyScript.sections.some((s) => s.id.startsWith('pick-')) && emptyScript.sections.find((s) => s.id === 'ask')!.lines.some((l) => l.endsWith('받아 볼 수 있을까요?')) && emptyScript.sections.some((s) => s.id === 'docs') && emptyScript.sections[0].lines[1].includes('필요한 자료'),
  emptyScript.sections,
)
const text = meetingScriptText(script)
check('T14 대본 복사 글 — 회사 이름 · 번호 매긴 칸 · 주의 한 줄 · 수수료 · 영업자 말 0', text.startsWith('[한솔정밀(주)] 미팅 대본') && /\n1\. 시작\n/.test(text) && text.includes(TALK_CAUTION) && !/수수료|영업자|업무 일기/.test(text), text.slice(0, 200))
const askLines = [...script.sections, ...emptyScript.sections].filter((s) => s.id === 'ask').flatMap((s) => s.lines)
const docLines = [...script.sections, ...emptyScript.sections].filter((s) => s.id === 'docs').flatMap((s) => s.lines)
check(
  'T16 여쭐 말 — 서류는 "받아 볼 수 있을까요?" · 정보는 몇 명 · 있으세요 · 언제 세우셨어요(같은 질문 두 번 0) · 받을 서류 칸엔 서류만',
  askLines.includes('4대보험 가입자 명부를 받아 볼 수 있을까요?') && askLines.includes('회사는 언제 세우셨어요?') && !askLines.some((l) => /(수|공간|활동|형태|설립일)을 받아 볼/.test(l)) && emptyScript.sections.find((s) => s.id === 'ask')!.lines.length === new Set(emptyScript.sections.find((s) => s.id === 'ask')!.lines).size && !docLines.some((l) => /요원 수|연구공간|연구개발 활동|설립일/.test(l)),
  { askLines, docLines },
)
check('T15 조사 — "한솔정밀(주)를"(괄호 앞 글자) · 받을 것 "…을/를 받아 볼 수 있을까요?"', script.sections[0].lines[0].includes('한솔정밀(주)를 먼저 정리해 왔습니다') && !/을\(를\)|이\(가\)|은\(는\)/.test(text + meetingScriptText(emptyScript)))

// D-509 처음 보는 말 한 줄 설명
const p1 = splitTerms('가지급금 1.2억원 — 그대로 두면 인정이자 · 세금으로 해마다 새요 · 가지급금 정리')
check(
  'T17 용어 나누기 — 사전 말만 따로 · 같은 글에서 처음 한 번만 · 이어 붙이면 원래 글 그대로',
  p1.filter((p) => p.term).map((p) => p.term).join(',') === '가지급금,인정이자' && p1.map((p) => p.text).join('') === '가지급금 1.2억원 — 그대로 두면 인정이자 · 세금으로 해마다 새요 · 가지급금 정리',
  p1,
)
const p2 = splitTerms('2025년 신고서에 통합고용세액공제가 빠졌어요 — 경정청구 · 연구개발비 세액공제')
check('T18 긴 말 먼저 — 통합고용세액공제를 세액공제로 자르지 않음 · 뒤의 세액공제는 따로', p2.filter((p) => p.term).map((p) => p.term).join(',') === '통합고용세액공제,경정청구,세액공제', p2)
const defs = Object.entries(CONSULT_TERMS)
check(
  "T19 사전 — 뜻이 모두 한 줄(70자 안팎 이하) · 'AI' 0 · 판정 글 · 대본에 실제로 나오는 말(가지급금 · 경정청구 · 체납 · 1차 추정 …)",
  defs.length >= 20 && defs.every(([, v]) => v.length > 8 && v.length <= 80 && !/\bAI\b/.test(v)) && ['가지급금', '경정청구', '체납', '1차 추정', '과밀억제권역', '거치', '자부담'].every((k) => k in CONSULT_TERMS),
  defs.filter(([, v]) => v.length > 80).map(([k]) => k),
)
const seen = new Set<string>()
const card0 = cards.find(({ c }) => c)!.c!
const used = [card0.easy, ...card0.faq.map((f) => f.a)].flatMap((t) => splitTerms(t, seen).filter((p) => p.term).map((p) => p.term))
check('T20 여러 글에 걸쳐 seen 을 넘기면 한 번만', used.length === new Set(used).size, used)

// D-508 상황 예시 말하기
const runs = runScenarios(full, today)
const talks = runs.map((r) => ({ r, t: scenarioTalk(r) }))
const strayS = talks.flatMap(({ r, t }) => {
  const allowed = new Set([...numbers(r.title), ...numbers(r.headline), ...numbers(r.amount), ...numbers(r.needs.map((n) => n.label).join(' '))])
  return numbers(t.say.join(' ')).filter((n) => !allowed.has(n)).map((n) => `${r.id}:${n}`)
})
check(
  "T21 상황 예시 말하기 — 43개 모두 · 계산된 것은 \"'{상황}' 경우를 이 회사 숫자로 계산해 봤어요\" → 결과 → 금액 · 숫자는 계산 결과에 있던 것뿐",
  talks.length === runs.length && talks.every(({ r, t }) => (r.state === 'need' ? t.say[0].includes('계산해 보려면') : t.say[0] === `대표님, '${r.title}' 경우를 이 회사 숫자로 계산해 봤어요.`)) && strayS.length === 0,
  { strayS, sample: talks.slice(0, 2).map(({ t }) => t.say) },
)
check(
  'T22 상황 예시 갈래 — 가지급금 · 퇴직금 · 1억/급여 · 증여/승계/05·06 · 법인전환 · 고용 · 연구소 · 창업감면 · 정책자금',
  scenarioTopic({ id: 'tax-loan', module: 'tax' }) === 'loan' && scenarioTopic({ id: 'tax-retire', module: 'tax' }) === 'retire' && scenarioTopic({ id: 'tax-cash-1e', module: 'tax' }) === 'pay' && scenarioTopic({ id: 'tax-salary-net', module: 'tax' }) === 'pay' &&
    scenarioTopic({ id: 'tax-succession', module: 'tax' }) === 'gift' && scenarioTopic({ id: 'calc-t8-issue', module: 'tax' }) === 'gift' && scenarioTopic({ id: 'calc-t9-convert', module: 'tax' }) === 'convert' &&
    scenarioTopic({ id: 'emp-youth', module: 'employment' }) === 'employment' && scenarioTopic({ id: 'lab-two', module: 'labcare' }) === 'lab' && scenarioTopic({ id: 'startup-move', module: 'startup-tax' }) === 'startup' && scenarioTopic({ id: 'policy-facility', module: 'policy-funding' }) === 'policy',
)
const giftT = talks.find(({ r }) => r.id === 'tax-gift-10')!.t
check('T23 증여 이야기 — 10년 합산 · 성인 5,000만원 · 미성년 2,000만원 · 특례는 세무사', giftT.faq.some((f) => f.a.includes('10년 안에 다시 주면 합쳐서')) && giftT.faq.some((f) => f.a.includes('5,000만원') && f.a.includes('2,000만원')) && giftT.faq.some((f) => f.a.includes('세무사')), giftT.faq)

// D-508 대표님이 물으면 찾기
const f1 = faqSearch('직원이 그만두면')
const f2 = faqSearch('갚아야 하나요')
const f3 = faqSearch('인정이자', CONSULT_TERMS)
const f4 = faqSearch('경정청구 언제까지')
check(
  'T24 찾기 — 그만두면 → 고용 답 맨 앞 · 갚아야 → 정책자금 · 고용 · 지원사업 답 · 인정이자 → 용어 뜻(이/가 조사) · 경정청구 같은 답은 한 번만 · 빈 말 → 0',
  f1[0]?.q === '직원이 금방 그만두면요?' && ['policy', 'employment', 'grants'].every((t) => f2.some((h) => h.topic === t)) && f3.some((h) => h.topic === 'term' && h.q === '인정이자가 뭐예요?') &&
    f4.filter((h) => h.q === '언제까지 신청할 수 있어요?').length === 1 && faqSearch('  ').length === 0 && faqSearch('외계인 우주선').length === 0,
  { f1: f1.map((h) => h.q), f2: f2.map((h) => h.topic), f3: f3.map((h) => h.q), f4: f4.map((h) => h.q) },
)

const f5 = faqSearch('대표 가족도')
const f6 = faqSearch('세무조사')
const f7 = faqSearch('벤처 확인 몇 년')
check(
  'T25 대표님이 자주 묻는 말 더 — 대표 가족 → 고용 · 세무조사 → 돌려받기 · 가지급금 두 곳 이상 · 벤처 몇 년 → 인증 3년',
  f5[0]?.topic === 'employment' && f6.length >= 2 && f6.some((h) => h.a.includes('경정청구')) && f7[0]?.topic === 'cert' && f7[0]?.a.includes('3년'),
  { f5: f5.map((h) => h.topic), f6: f6.map((h) => `${h.topic}:${h.q}`), f7: f7.map((h) => `${h.topic}:${h.q}`) },
)

console.log(`\nconsultTalk: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
