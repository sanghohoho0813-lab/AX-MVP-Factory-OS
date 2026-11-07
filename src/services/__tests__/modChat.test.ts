/**
 * D-552 모듈 첫 화면 대화창 9곳 — 언제 대화창이 뜨는지 · 고른 것 기억 · 쓴 말 → 주제 · 예시 질문마다 답 · 판정 그대로 · AI 자료에 개인정보 0.
 */
import {
  CHAT_FIRST_KEY,
  CHAT_FIRST_KEYS,
  CHAT_FIRST_LABEL,
  CHAT_FIRST_PATHS,
  chatFirstKeyOf,
  chatShown,
  modeOf,
  parseChatFirst,
  readChatFirst,
  writeChatFirst,
} from '../workChat/chatFirst'
import { MOD_CHAT, calcOfText, modAiContext, modChatActions, modChatAnswer, modGuide, modTopicOf, type ModChatData } from '../workChat/modChat'
import type { Insight } from '../clientInsights'
import type { ScenarioRun } from '../scenarios'
import type { ClientOpsRecord } from '../../types/clientOps'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`PASS  ${name}`)
  } else {
    failed++
    console.log(`FAIL  ${name}${detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 600)}`)
  }
}

// 브라우저 저장 공간 흉내(노드에는 없다)
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

/* ------------------------------------------------------------------ */
/* F 언제 대화창이 뜨나                                                  */
/* ------------------------------------------------------------------ */
check('F1 9곳 — 정책자금 · 고용지원금 · 연구소 · 창업감면 · 세금 계산기 · 지원사업 · 크레탑 · 홍보 글 · 홈페이지', CHAT_FIRST_KEYS.length === 9 && CHAT_FIRST_KEYS.every((k) => MOD_CHAT[k] && CHAT_FIRST_LABEL[k] && CHAT_FIRST_PATHS[k].startsWith('/')))
check('F2 맨 첫 주소 · 처음(고른 것 없음) → 대화창', CHAT_FIRST_KEYS.every((k) => chatShown(CHAT_FIRST_PATHS[k], '', {})) && chatShown('/tools/tax/', '', {}))
check('F3 목차 화면 · 업체 · 상황 예시 · 바로 화면 주소 → 예전 화면(맞춤 추천 · 오늘에서 누른 [열기] 가 한 번 더 누르지 않게)',
  !chatShown('/tools/policy-funding/diagnose', '', {}) && !chatShown('/tools/policy-funding', '?client=c1', {}) && !chatShown('/tools/employment', '?preset=youth', {}) &&
  !chatShown('/tools/tax', '?m=calc&c=t2', {}) && !chatShown('/grants', '?view=notices', {}) && !chatShown('/tools/content', '?direct=1', {}))
check('F4 ?chat=1 은 언제나 대화창(바로 화면을 골랐어도 · 목차 화면에서도)', chatShown('/tools/labcare', '?chat=1', { all: 'direct' }) && chatShown('/tools/labcare/setup', '?chat=1', {}))
check('F5 다른 화면은 대화창 아님(오늘 · 고객 관리 · 비슷한 이름)', !chatShown('/', '', {}) && !chatShown('/ops/clients', '', {}) && !chatShown('/grantsx', '', {}) && !chatShown('/tools/marketing', '', {}) && chatFirstKeyOf('/tools/marketing') === null)
check('F6 목차 화면도 그 모듈로 본다([대화로 묻기] 단추가 맞는 모듈로)', chatFirstKeyOf('/tools/tax/x') === 'tax' && chatFirstKeyOf('/tools/startup-tax/judge') === 'startup-tax' && chatFirstKeyOf('/grants') === 'grants' && chatFirstKeyOf('/tools/homepage/') === 'homepage')

/* ------------------------------------------------------------------ */
/* M 고른 것 기억                                                         */
/* ------------------------------------------------------------------ */
check('M1 모듈마다 고른 것이 전체보다 먼저', modeOf({ all: 'direct', mods: { tax: 'chat' } }, 'tax') === 'chat' && modeOf({ all: 'direct' }, 'grants') === 'direct' && modeOf({}, 'grants') === 'chat')
check('M2 바로 화면을 고르면 맨 첫 주소도 예전 화면', !chatShown('/tools/tax', '', { mods: { tax: 'direct' } }) && chatShown('/tools/grants'.replace('/tools', ''), '', { mods: { tax: 'direct' } }))
check('M3 망가진 값 · 모르는 값은 버리고 아는 것만', JSON.stringify(parseChatFirst('{"all":"x","mods":{"tax":"direct","nope":"chat","grants":1}}')) === JSON.stringify({ mods: { tax: 'direct' } }) && JSON.stringify(parseChatFirst('not json')) === '{}' && JSON.stringify(parseChatFirst(null)) === '{}')
mem.set(CHAT_FIRST_KEY, JSON.stringify({ future: { a: 1 }, mods: { tax: 'chat', nextVersionModule: 'direct' } }))
writeChatFirst({ mods: { grants: 'direct' } })
const w1 = JSON.parse(mem.get(CHAT_FIRST_KEY)!)
check('M4 모듈 하나 고르면 그 칸만 — 이 버전이 모르는 값(다음 버전 모듈 · 다른 칸)은 그대로(D-315)', w1.future?.a === 1 && w1.mods.tax === 'chat' && w1.mods.grants === 'direct' && w1.mods.nextVersionModule === 'direct', w1)
writeChatFirst({ all: 'direct', clearMods: true })
const w2 = JSON.parse(mem.get(CHAT_FIRST_KEY)!)
check('M5 설정에서 전체를 고르면 9곳 개별 값은 비우고 전체를 따름 · 모르는 값은 그대로', w2.all === 'direct' && w2.mods.tax === undefined && w2.mods.grants === undefined && w2.mods.nextVersionModule === 'direct' && w2.future?.a === 1, w2)
check('M6 읽기 = 전체 바로 화면 → 9곳 모두 예전 화면', CHAT_FIRST_KEYS.every((k) => !chatShown(CHAT_FIRST_PATHS[k], '', readChatFirst())))
mem.clear()

/* ------------------------------------------------------------------ */
/* T 쓴 말 → 주제                                                          */
/* ------------------------------------------------------------------ */
const P = MOD_CHAT
check('T1 세금 계산기 — 계산기 이름이 먼저(급여 · 퇴직 · 증여 · 가지급금 · 상속 · 증자 · 특정법인 · 비상장)',
  calcOfText('대표 급여 세후 월 800만원 받으려면?')?.key === 't2' && calcOfText('퇴직금 3억 받으면 세금 얼마야?')?.key === 't6' && calcOfText('자녀에게 지분 10% 증여하면?')?.key === 't5' &&
  calcOfText('가지급금 2억 정리하는 방법')?.key === 't1' && calcOfText('상속세 얼마야')?.key === 't4' && calcOfText('불균등 증자하면')?.key === 't8' && calcOfText('특정법인 증여의제')?.key === 't7' && calcOfText('비상장 주식 가치')?.key === 't3' && calcOfText('안녕') === null)
check('T2 세금 계산기 — 기준표 · 계산기 목록', modTopicOf(P.tax, '계산 기준표 보여 줘') === 'basis' && modTopicOf(P.tax, '계산기는 어떤 게 있어요?') === 'calc')
check('T3 공통 — 서류 · 우리 고객 · 상황 · 판정',
  modTopicOf(P['policy-funding'], '운전자금 받으려면 서류 뭐 필요해?') === 'docs' && modTopicOf(P.employment, '우리 고객 중 이번 달 신청할 곳') === 'who' &&
  modTopicOf(P.employment, '청년 2명 뽑으면 지원금 얼마야?') === 'scenario' && modTopicOf(P.labcare, '연구원 2명이면 세액공제 얼마야?') === 'scenario' && modTopicOf(P.labcare, '연구소 세울 수 있어?') === 'judge')
check('T4 지원사업 — 마감 · 넣는 법 · 맞는 공고', modTopicOf(P.grants, '이번 주 마감인 공고 알려 줘') === 'soon' && modTopicOf(P.grants, '기업마당 공고는 언제 들어와?') === 'add' && modTopicOf(P.grants, '한솔에 맞는 공고 있어?') === 'judge')
check('T5 홍보 글 · 홈페이지 · 크레탑', modTopicOf(P.content, '카톡으로 보낼 홍보 문구') === 'kakao' && modTopicOf(P.content, '한 달 동안 뭘 올리면 돼?') === 'month' && modTopicOf(P.homepage, '만든 홈페이지 어떻게 올려?') === 'publish' &&
  modTopicOf(P.homepage, '사진은 어떻게 바꿔?') === 'edit' && modTopicOf(P.homepage, '홈페이지 점수 높이려면') === 'score' && modTopicOf(P.cretop, '크레탑 PDF 올리면 어떻게 돼?') === 'analyze' && modTopicOf(P.cretop, '분석해 둔 업체 목록') === 'results')
check('T6 모르는 말 · 빈 말 → 주제 없음(→ 이렇게 물어보세요)', modTopicOf(P.tax, '') === null && modTopicOf(P['policy-funding'], '오늘 날씨') === null)

/* ------------------------------------------------------------------ */
/* A 답 카드                                                               */
/* ------------------------------------------------------------------ */
const client = (id: string, name: string): ClientOpsRecord => ({ id, companyName: name, archivedAt: null, toolResults: [], industry: '소프트웨어 개발', establishedAt: '2019-03-02', employeeCount: '12명', contactName: '김대표', contactPhone: '010-2345-6789', businessNumber: '123-45-67890' }) as unknown as ClientOpsRecord
const A = client('cA', '한빛정밀(주)')
const B = client('cB', '두리식품')
const C = client('cC', '새봄디자인')
const ins = (tone: Insight['tone'], headline: string, extra: Partial<Insight> = {}): Insight =>
  ({ key: 'policy-funding', title: '정책자금', tone, headline, detail: '자세히 한 줄', missing: [], openPath: `/tools/policy-funding?client=x`, openLabel: '정책자금 진단 열기', ...extra }) as unknown as Insight
const TABLE: Record<string, Insight> = {
  cA: ins('good', '가능성 높음 · 추천 기관 중진공', { amount: '최대 2억원', missing: ['국세 납세증명서'], request: { text: '안녕하세요 대표님 — 국세 납세증명서를 보내 주세요', count: 1 } } as Partial<Insight>),
  cB: ins('need', '매출을 알면 판정해요', { missing: ['재무제표', '부가세 과세표준증명'] }),
  cC: ins('maybe', '검토해 볼 만함', { amount: '5천만원' }),
}
const runs: ScenarioRun[] = [
  { id: 's1', title: '운전자금 필요', headline: '진행 가능성 보통', amount: '최대 1억', openPath: '/tools/policy-funding?client=cA&preset=s1', fit: { kind: 'fit' } },
  { id: 's2', title: '맞지 않는 상황', headline: '-', amount: '', openPath: '/x', fit: { kind: 'no' } },
  { id: 's3', title: '시설자금', headline: '진행 가능성 보통', amount: '', openPath: '/tools/policy-funding?client=cA&preset=s3', fit: { kind: 'ask' } },
] as unknown as ScenarioRun[]
const data = (c: ClientOpsRecord | null, notices: ModChatData['notices'] = []): ModChatData => ({
  today: '2026-11-07',
  clients: [A, B, C],
  client: c,
  insightOf: (r) => TABLE[r.id] ?? null,
  scenariosOf: (r) => (r.id === 'cA' ? runs : []),
  notices,
})
const pf = P['policy-funding']

const j = modChatAnswer(pf, { starter: 'judge' }, data(A))
check('A1 판정 — 맞춤 추천과 같은 판정 · 금액 · 더 필요한 것 · 열기 · 요청 문구 · 상황 예시', j.title.includes('한빛정밀(주)') && j.lines.includes('가능성 높음 · 추천 기관 중진공') && j.lines.some((l) => l.includes('최대 2억원')) && j.lines.some((l) => l.includes('국세 납세증명서')) &&
  j.actions[0].href === '/tools/policy-funding?client=x' && j.actions.some((a) => a.copy?.includes('국세 납세증명서')) && j.actions.some((a) => a.ask) && j.source === 'rule', j)
const pick = modChatAnswer(pf, { starter: 'judge' }, data(null))
check('A2 업체 없이 판정 → 어느 업체 일인가요?(회사 고르기 · 우리 고객 전체 단추)', pick.topic === 'pick' && pick.actions[0].act === 'pick-client' && pick.actions.some((a) => a.ask === pf.starters.find((s) => s.id === 'who')!.ask))
const who = modChatAnswer(pf, { starter: 'who' }, data(null))
check('A3 우리 고객 중 — 가능성 높음 먼저 · 검토 · 자료 필요 수 · 업체 열기', who.title.includes('2곳') && who.lines[0].startsWith('한빛정밀(주)') && who.lines[1].startsWith('새봄디자인') && who.lines.some((l) => l.includes('자료가 더 필요한 곳 1곳')) && who.actions.length === 2, who)
const docs = modChatAnswer(pf, { text: '서류 뭐 필요해?' }, data(B))
check('A4 서류 — 더 필요한 것 · 서류함 열기(요청 문구 없으면 서류함이 주 단추)', docs.title.includes('2가지') && docs.lines[0] === '재무제표' && docs.actions[0].href === '/ops/clients/cB?tab=docs' && docs.actions[0].primary === true, docs)
const scn = modChatAnswer(pf, { starter: 'scenario' }, data(A))
check('A5 상황 예시 — 맞는 것 먼저 · 안 맞는 것 빼기 · 누르면 그 업체 숫자로(preset 주소)', scn.title.includes('2가지') && scn.lines[0].startsWith('운전자금 필요') && !scn.lines.some((l) => l.includes('맞지 않는')) && scn.actions[0].href === '/tools/policy-funding?client=cA&preset=s1', scn)
const scnNone = modChatAnswer(pf, { starter: 'scenario' }, data(B))
check('A6 맞는 상황이 없으면 — 지어내지 않고 회사 정보 안내 + 바로 화면', scnNone.lines[0].includes('회사 정보') && scnNone.actions[0].href === '/tools/policy-funding?direct=1&client=cB')
const calc = modChatAnswer(P.tax, { text: '퇴직금 3억 받으면 세금 얼마야?' }, data(A))
check('A7 세금 — 쓴 말에 맞는 계산기를 그 업체로 열기', calc.topic === 'calc:t6' && calc.actions[0].href === '/tools/tax?m=calc&c=t6&client=cA' && calc.lines.some((l) => l.includes('한빛정밀(주)')), calc)
const calcNo = modChatAnswer(P.tax, { text: '대표 급여 세후 800' }, data(null))
check('A8 세금 — 업체 없이도 계산기는 바로(업체 고르면 숫자 채움 안내)', calcNo.actions[0].href === '/tools/tax?m=calc&c=t2' && calcNo.lines.some((l) => l.includes('업체를 고르면')))
const list = modChatAnswer(P.tax, { starter: 'calc' }, data(null))
check('A9 계산기 9종 목록 · 원하는 결과로 찾기', list.lines.length === 9 && list.actions[0].href === '/tools/tax?m=plan')
const soon = modChatAnswer(P.grants, { starter: 'soon' }, data(null, [
  { id: 'n1', title: '스마트공장 지원', deadline: '2026-11-10' },
  { id: 'n2', title: '수출 바우처', deadline: '2026-11-07' },
  { id: 'n3', title: '먼 공고', deadline: '2026-12-31' },
  { id: 'n4', title: '지난 공고', deadline: '2026-11-01' },
  { id: 'n5', title: '마감 없음', deadline: '' },
]))
check('A10 지원사업 마감 임박 — 2주 안만 · 가까운 순 · 오늘 마감 · 지난 것 · 마감 없음 빼기', soon.title.includes('2건') && soon.lines[0] === '수출 바우처 — 오늘 마감' && soon.lines[1] === '스마트공장 지원 — D-3', soon)
const help = modChatAnswer(pf, { text: '오늘 날씨' }, data(A))
check('A11 모르는 말 → 이렇게 물어보세요(그 업체 이름으로 예시) + 큰 단추 넷', help.topic === 'help' && help.lines[0].startsWith('한빛정밀(주)') && help.actions.length === 4)
const site = modChatAnswer(P.homepage, { starter: 'make' }, data(null))
check('A12 홈페이지 · 홍보 글 — 업체 필요한 단추는 고르기부터 · 아닌 것은 바로 안내', site.topic === 'pick' && modChatAnswer(P.homepage, { starter: 'publish' }, data(null)).actions[0].href === '/tools/homepage?direct=1' && modChatAnswer(P.content, { starter: 'make' }, data(C)).actions[0].href === '/tools/content?direct=1&client=cC')

/* 예시 질문마다 '이렇게 물어보세요' 로 되돌아가지 않는다 — 업체를 고른 경우 · 안 고른 경우 */
const bad: string[] = []
for (const k of CHAT_FIRST_KEYS) {
  const cfg = MOD_CHAT[k]
  for (const ex of cfg.examples(A.companyName)) {
    if (!modTopicOf(cfg, ex)) bad.push(`${k}: ${ex} → 주제 없음`)
    const a = modChatAnswer(cfg, { text: ex }, data(A))
    if (a.topic === 'help') bad.push(`${k}: ${ex} → help`)
    if (!a.actions.length) bad.push(`${k}: ${ex} → 단추 0`)
  }
  for (const s of cfg.starters) {
    const a = modChatAnswer(cfg, { starter: s.id }, data(A))
    if (a.topic === 'help' || !a.title) bad.push(`${k}: [${s.label}] → ${a.topic}`)
  }
}
check('A13 9곳 × 예시 4 · 큰 단추 4 — 모두 주제가 있고 답 아래 단추가 있음', bad.length === 0, bad)

/* 모든 답의 링크는 앱 안 주소 · 바로 화면 주소는 대화창이 아닌 예전 화면 */
const hrefs: string[] = []
for (const k of CHAT_FIRST_KEYS) for (const s of MOD_CHAT[k].starters) for (const c of [A, null]) for (const a of modChatAnswer(MOD_CHAT[k], { starter: s.id }, data(c)).actions) if (a.href) hrefs.push(a.href)
check('A14 답 단추 주소 — 앱 안(/) · 대화창 맨 첫 주소로 되돌아가지 않음', hrefs.length > 20 && hrefs.every((h) => h.startsWith('/') && !h.startsWith('//')) && hrefs.every((h) => { const [p, q = ''] = h.split('?'); return !chatShown(p, q ? `?${q}` : '', {}) }), hrefs.filter((h) => { const [p, q = ''] = h.split('?'); return chatShown(p, q ? `?${q}` : '', {}) }))

/* AI 답 아래 단추 · AI 자료 */
const acts = modChatActions(pf, '서류 뭐 필요해?', data(A))
check('A15 AI 답 아래 단추 — 쓴 말 주제의 작업 단추(열기 · 복사)만 · 주제 없으면 0', acts.length > 0 && acts.every((a) => a.href || a.copy) && modChatActions(pf, '오늘 날씨', data(A)).length === 0)
const ctx = JSON.stringify(modAiContext(pf, data(A), []))
check('A16 AI 자료 — 회사 · OS 판정 · 상황 예시만, 대표 이름 · 전화 · 사업자번호 0', ctx.includes('한빛정밀(주)') && ctx.includes('가능성 높음') && ctx.includes('운전자금 필요') && !ctx.includes('김대표') && !ctx.includes('010-2345') && !ctx.includes('123-45-67890'))
const ctxAll = JSON.stringify(modAiContext(pf, data(null), []))
check('A17 업체 안 고르면 고객 전체 판정 한 줄씩(개인정보 0)', ctxAll.includes('두리식품') && ctxAll.includes('새봄디자인') && !ctxAll.includes('010-'))
check('A18 사용 방법 4단계 — 직접 눌러서 하기 · 바로 화면 고르기 안내 포함', MOD_CHAT.tax && CHAT_FIRST_KEYS.every((k) => { const g = modGuide(MOD_CHAT[k]); return g.length === 4 && g[3].body.includes('바로 화면') }))
check('A19 규칙 답에는 AI 라고 쓰지 않음(정해진 답)', CHAT_FIRST_KEYS.every((k) => MOD_CHAT[k].starters.every((s) => { const a = modChatAnswer(MOD_CHAT[k], { starter: s.id }, data(A)); return a.source === 'rule' && !/\bAI\b/.test([a.title, ...a.lines].join(' ')) })))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
