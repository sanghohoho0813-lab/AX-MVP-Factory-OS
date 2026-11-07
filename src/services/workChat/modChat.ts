/**
 * D-552 모듈 대화창 9곳 — 정책자금 · 고용지원금 · 연구소 · 창업감면 · 세금 계산기 · 지원사업 · 크레탑 · 홍보 글 · 홈페이지.
 *
 * 단추 · 쓴 말 → 짧은 답 카드(규칙 — AI 아님). 판정 · 금액은 OS 가 이미 계산한 것 그대로(맞춤 추천 판정 · 상황 예시 · 계산기).
 * 여기서 새로 판단하거나 숫자를 지어내지 않는다. 답 아래 단추는 예전 화면(그 업체 · 그 화면)으로 바로.
 * AI 답(대표 · 팀장 Gemini)은 화면이 이미 있는 '직접 물어본 것에 답'(module.ask · grants.ask · content.ask · site.ask)으로 — 서버 변경 없음.
 */
import { INSIGHT_TONE_LABEL, type Insight } from '../clientInsights'
import type { ScenarioModule } from '../scenarioPresets'
import type { ScenarioRun } from '../scenarios'
import { TAX_CALCULATORS } from '../taxCalc'
import type { AssistPage } from '../aiAssist/presets'
import type { AssistContext } from '../aiAssist/context'
import type { ClientOpsRecord } from '../../types/clientOps'
import { historyRows, type ChatAction, type ChatAnswer, type ChatGuideStep, type ChatStarter, type ChatTopic, type ChatTurn } from './chatTypes'
import { CHAT_FIRST_PATHS, type ChatFirstKey } from './chatFirst'

export interface ModChatConfig {
  key: ChatFirstKey
  title: string
  /** 머리 아래 한 줄 — 이 화면이 무엇을 해 주는지 */
  sub: string
  placeholder: string
  starters: readonly ChatStarter[]
  /** '이렇게 물어보세요' — name 은 고른 업체 이름(없으면 '○○') */
  examples: (name: string) => string[]
  topics: readonly ChatTopic[]
  /** 맞춤 추천 판정 키(없으면 판정 없음 — 홍보 글 · 홈페이지) */
  insightKey: string | null
  scenarioModule: ScenarioModule | null
  assist: { id: string; page: AssistPage }
  /** 업체를 꼭 골라야 답하는 주제 */
  needsClient: readonly string[]
}

export interface ModChatData {
  today: string
  /** 보관하지 않은 업체 */
  clients: readonly ClientOpsRecord[]
  client: ClientOpsRecord | null
  /** 업체 하나 → 이 모듈 판정(light = 무거운 계산 건너뜀 · 판정 색은 같다) */
  insightOf: (r: ClientOpsRecord, light?: boolean) => Insight | null
  /** 업체 하나 → 이 모듈 상황 예시(맞는 것 먼저) */
  scenariosOf: (r: ClientOpsRecord) => ScenarioRun[]
  /** 지원사업 — 공고(제목 · 마감) */
  notices: readonly { id: string; title: string; deadline: string }[]
}

const enc = encodeURIComponent
const withClient = (href: string, clientId: string | null | undefined) => (clientId ? `${href}${href.includes('?') ? '&' : '?'}client=${enc(clientId)}` : href)

/* ------------------------------------------------------------------ */
/* 9곳 설정                                                               */
/* ------------------------------------------------------------------ */

const S = (id: string, label: string, ask: string): ChatStarter => ({ id, label, ask })
const T = (id: string, words: RegExp): ChatTopic => ({ id, words })
const COMMON_TOPICS: readonly ChatTopic[] = [
  T('docs', /서류|자료|증빙|준비물|요청\s*문구|뭐\s*받아|필요한\s*(것|게)/),
  T('who', /우리\s*고객|고객\s*(중|전체)|누가|어느\s*업체|업체들|먼저\s*연락|몇\s*곳/),
  T('scenario', /상황|만약|하면\s*(얼마|어떻게)|뽑으면|채용하면|받으면|세우면|가정|(명|억|원)이면/),
  T('how', /어떻게\s*(써|쓰|해)|사용\s*(법|방법)|뭐\s*하는\s*곳|처음/),
  T('judge', /가능|받을\s*수|될까|되나|돼\?|대상|얼마|판정|요약|어때|맞는|수\s*있(어|나|을까)/),
]

export const MOD_CHAT: Readonly<Record<ChatFirstKey, ModChatConfig>> = {
  'policy-funding': {
    key: 'policy-funding',
    title: '정책자금',
    sub: '어느 업체가 정책자금을 받을 수 있는지 · 어느 기관에서 · 무슨 서류가 필요한지 바로 알려 드려요.',
    placeholder: '예) 한솔테크 정책자금 가능해?',
    starters: [S('judge', '이 업체 받을 수 있나요?', '이 업체 정책자금 받을 수 있어요?'), S('who', '우리 고객 중 받을 만한 곳', '우리 고객 중 정책자금 받을 만한 곳은?'), S('docs', '신청 서류 · 요청 문구', '정책자금 신청 서류는 뭐가 필요해요?'), S('scenario', '상황 예시로 바로 설계', '이 업체 상황 예시로 정책자금 설계해 줘')],
    examples: (n) => [`${n} 정책자금 가능해? 어디서 얼마나?`, `${n} 운전자금 받으려면 서류 뭐 필요해?`, '우리 고객 중 정책자금 먼저 연락할 곳 3곳', `${n} 청년 채용하면 받을 수 있는 자금 있어?`],
    topics: COMMON_TOPICS,
    insightKey: 'policy-funding',
    scenarioModule: 'policy-funding',
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge', 'docs', 'scenario'],
  },
  employment: {
    key: 'employment',
    title: '고용지원금',
    sub: '채용 · 4대보험 명부로 받을 수 있는 지원금과 세액공제, 신청 회차를 바로 알려 드려요.',
    placeholder: '예) 한솔테크 청년 2명 뽑으면 얼마야?',
    starters: [S('judge', '이 업체 받을 수 있는 지원금', '이 업체가 받을 수 있는 고용지원금은?'), S('who', '우리 고객 중 받을 곳', '우리 고객 중 고용지원금 받을 곳은?'), S('scenario', '채용 상황 예시로 설계', '이 업체 채용 상황 예시로 설계해 줘'), S('docs', '받을 서류(명부 등)', '고용지원금에 필요한 서류는?')],
    examples: (n) => [`${n} 청년 2명 뽑으면 지원금 얼마야?`, `${n} 만 60세 이상 채용하면?`, `${n} 지금 받을 수 있는 지원금 있어?`, '우리 고객 중 이번 달 신청할 곳'],
    topics: COMMON_TOPICS,
    insightKey: 'employment',
    scenarioModule: 'employment',
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge', 'docs', 'scenario'],
  },
  labcare: {
    key: 'labcare',
    title: '기업부설연구소',
    sub: '연구소를 세울 수 있는지 · 세액공제가 얼마인지 · 설립 서류와 사후관리를 바로 알려 드려요.',
    placeholder: '예) 한솔테크 연구소 세울 수 있어?',
    starters: [S('judge', '이 업체 연구소 될까요?', '이 업체 연구소 세울 수 있어요?'), S('scenario', '세액공제 상황 예시', '이 업체 연구소 세액공제 상황 예시로 계산해 줘'), S('docs', '설립 서류', '연구소 설립 서류는 뭐가 필요해요?'), S('who', '우리 고객 중 연구소 할 곳', '우리 고객 중 연구소 세울 만한 곳은?')],
    examples: (n) => [`${n} 연구소 세울 수 있어?`, `${n} 연구원 2명이면 세액공제 얼마야?`, '연구소 설립 서류 뭐 필요해?', '우리 고객 중 연구소 할 만한 곳'],
    topics: COMMON_TOPICS,
    insightKey: 'labcare',
    scenarioModule: 'labcare',
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge', 'docs', 'scenario'],
  },
  'startup-tax': {
    key: 'startup-tax',
    title: '창업감면',
    sub: '창업 중소기업 세액감면(최대 100%)을 받을 수 있는지 · 몇 % · 몇 년인지 바로 알려 드려요.',
    placeholder: '예) 한솔테크 창업감면 받을 수 있어?',
    starters: [S('judge', '이 업체 감면 되나요?', '이 업체 창업감면 받을 수 있어요?'), S('scenario', '상황 예시(벤처 확인 등)', '이 업체 창업감면 상황 예시로 봐 줘'), S('docs', '판정에 필요한 것', '창업감면 판정에 뭐가 필요해요?'), S('who', '우리 고객 중 감면 대상', '우리 고객 중 창업감면 대상은?')],
    examples: (n) => [`${n} 창업감면 받을 수 있어? 몇 %야?`, `${n} 벤처 확인 받으면 감면이 달라져?`, '수도권 과밀억제권역이면 감면 안 돼?', '우리 고객 중 창업감면 놓친 곳'],
    topics: COMMON_TOPICS,
    insightKey: 'startup-tax',
    scenarioModule: 'startup-tax',
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge', 'docs', 'scenario'],
  },
  tax: {
    key: 'tax',
    title: '세금 계산기',
    sub: '대표 급여 · 퇴직금 · 주식 · 증여 · 상속 · 가지급금 — 물어보면 맞는 계산기를 그 업체 숫자로 열어 드려요.',
    placeholder: '예) 대표 급여 세후 월 800만원 받으려면?',
    starters: [S('scenario', '상황 예시로 바로 계산', '이 업체 상황 예시로 절세 계산해 줘'), S('judge', '이 업체 절세 포인트', '이 업체 절세할 곳은 어디예요?'), S('calc', '계산기 9종 고르기', '계산기는 어떤 게 있어요?'), S('basis', '계산 기준표(세율 · 공제)', '계산 기준표 보여 줘')],
    examples: () => ['대표 급여 세후 월 800만원 받으려면?', '퇴직금 3억 받으면 세금 얼마야?', '자녀에게 지분 10% 증여하면?', '가지급금 2억 정리하는 방법'],
    topics: [T('basis', /기준표|세율|공제율|기준/), T('calc', /계산기|어떤\s*계산|종류/), ...COMMON_TOPICS],
    insightKey: 'tax',
    scenarioModule: 'tax',
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge'],
  },
  grants: {
    key: 'grants',
    title: '지원사업',
    sub: '공고를 넣어 두면 우리 고객 중 맞는 업체를 골라 드려요. 업체마다 맞는 공고 · 마감 임박 공고를 물어보세요.',
    placeholder: '예) 한솔테크에 맞는 공고 있어?',
    starters: [S('judge', '이 업체에 맞는 공고', '이 업체에 맞는 지원사업 공고는?'), S('who', '맞는 공고가 있는 업체', '우리 고객 중 맞는 공고가 있는 업체는?'), S('soon', '마감 임박 공고', '마감 임박한 공고는?'), S('add', '공고 넣는 법', '공고는 어떻게 넣어요?')],
    examples: (n) => [`${n}에 맞는 공고 있어?`, '이번 주 마감인 공고 알려 줘', '우리 고객 중 맞는 공고 많은 순', '기업마당 공고는 언제 들어와?'],
    topics: [T('soon', /마감|임박|이번\s*주|기한/), T('add', /넣|추가|붙여|기업마당|들어와/), ...COMMON_TOPICS],
    insightKey: 'grants',
    scenarioModule: null,
    assist: { id: 'grants.ask', page: 'grants' },
    needsClient: ['judge', 'docs'],
  },
  cretop: {
    key: 'cretop',
    title: '크레탑 분석',
    sub: '크레탑 기업종합보고서를 올리면 재무 · 신용 · 미팅 포인트를 바로 뽑아 드려요.',
    placeholder: '예) 한솔테크 크레탑 분석 결과 요약해 줘',
    starters: [S('analyze', '보고서 올려 분석하기', '크레탑 보고서 분석은 어떻게 해요?'), S('judge', '이 업체 분석 요약', '이 업체 크레탑 분석 요약해 줘'), S('results', '분석해 둔 업체', '크레탑 분석해 둔 업체는?'), S('how', '무엇을 알 수 있나요?', '크레탑 분석으로 무엇을 알 수 있어요?')],
    examples: (n) => [`${n} 크레탑 분석 요약해 줘`, '크레탑 PDF 올리면 어떻게 돼?', '크레탑 분석으로 뭘 알 수 있어?', '분석해 둔 업체 목록'],
    topics: [T('analyze', /올려|올리면|분석\s*(하|시작)|PDF|붙여/i), T('results', /분석해\s*둔|목록|어느\s*업체/), T('how', /뭘\s*알|무엇을\s*알|알\s*수\s*있/), ...COMMON_TOPICS],
    insightKey: 'cretop',
    scenarioModule: null,
    assist: { id: 'module.ask', page: 'module' },
    needsClient: ['judge'],
  },
  content: {
    key: 'content',
    title: '홍보 글',
    sub: '업체 기록으로 블로그 · 카톡 · 체험단 · 쇼츠 홍보 글을 바로 만들어 드려요.',
    placeholder: '예) 한솔테크 블로그 글 만들어 줘',
    starters: [S('make', '이 업체 홍보 글 만들기', '이 업체 홍보 글 만들어 줘'), S('first', '먼저 만들 것 3가지', '홍보 글은 뭐부터 만들어요?'), S('kakao', '카톡 홍보 문구', '카톡 홍보 문구 만들어 줘'), S('month', '한 달 계획', '한 달 홍보 계획 짜 줘')],
    examples: (n) => [`${n} 블로그 글 만들어 줘`, `${n} 카톡으로 보낼 홍보 문구`, '체험단 모집 글은 어떻게 써?', '한 달 동안 뭘 올리면 돼?'],
    topics: [T('kakao', /카톡|카카오|문자/), T('month', /한\s*달|계획|달력|올릴\s*날/), T('first', /뭐부터|먼저|처음/), T('make', /만들|써\s*줘|블로그|체험단|쇼츠|글/), ...COMMON_TOPICS],
    insightKey: null,
    scenarioModule: null,
    assist: { id: 'content.ask', page: 'content' },
    needsClient: ['make', 'kakao'],
  },
  homepage: {
    key: 'homepage',
    title: '홈페이지',
    sub: '업체 기록으로 업종에 맞는 홈페이지 초안을 바로 만들고, 고쳐서 내려받을 수 있어요.',
    placeholder: '예) 한솔테크 홈페이지 만들어 줘',
    starters: [S('make', '이 업체 홈페이지 만들기', '이 업체 홈페이지 만들어 줘'), S('score', '점수 · 이것만 하면', '홈페이지 점수 높이려면 뭘 하면 돼요?'), S('sample', '업종 견본 보기', '업종 견본은 어떤 게 있어요?'), S('publish', '내려받아 올리는 법', '만든 홈페이지는 어떻게 올려요?')],
    examples: (n) => [`${n} 홈페이지 만들어 줘`, '휴대폰에서 전화 단추 보이게 할 수 있어?', '만든 홈페이지 어떻게 올려?', '사진은 어떻게 바꿔?'],
    topics: [T('score', /점수|부족|이것만/), T('publish', /올리|올려|내려받|HTML|도메인|게시/i), T('sample', /견본|업종|디자인|바탕/), T('edit', /사진|단추|바꿔|바꾸|고치|문구|블록/), T('make', /만들|초안|홈페이지/), ...COMMON_TOPICS],
    insightKey: null,
    scenarioModule: null,
    assist: { id: 'site.ask', page: 'site' },
    needsClient: ['make'],
  },
}

/** 쓴 말 → 주제(처음 맞는 것 · 못 찾으면 null) — 세금 계산기는 계산기 이름이 먼저 */
export function modTopicOf(cfg: ModChatConfig, text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  if (cfg.key === 'tax' && calcOfText(t)) return 'calc-one'
  return cfg.topics.find((x) => x.words.test(t))?.id ?? null
}

/* ------------------------------------------------------------------ */
/* 세금 계산기 — 쓴 말 → 계산기                                            */
/* ------------------------------------------------------------------ */

const CALC_WORDS: readonly [string, RegExp][] = [
  ['t7', /특정\s*법인/],
  ['t8', /증자|감자/],
  ['t1', /가지급금/],
  ['t4', /상속/],
  ['t3', /비상장|주식\s*가치|가치\s*평가|주가/],
  ['t5', /양수도|지분|증여/],
  ['t6', /퇴직/],
  ['t2', /급여|월급|연봉/],
  ['t9', /양도|종합\s*소득|소득세/],
]

export function calcOfText(text: string): (typeof TAX_CALCULATORS)[number] | null {
  const key = CALC_WORDS.find(([, re]) => re.test(text))?.[0]
  return key ? (TAX_CALCULATORS.find((c) => c.key === key) ?? null) : null
}

export const calcHref = (key: string, clientId: string | null) => withClient(`/tools/tax?m=calc&c=${enc(key)}`, clientId)

/* ------------------------------------------------------------------ */
/* 답 카드                                                                */
/* ------------------------------------------------------------------ */

const TONE: Record<Insight['tone'], ChatAnswer['tone']> = { good: 'ok', maybe: 'ok', done: 'info', need: 'info', no: 'warn' }
const RANK: Record<Insight['tone'], number> = { good: 0, maybe: 1, done: 2, need: 3, no: 4 }

const pickClient = (cfg: ModChatConfig): ChatAnswer => ({
  title: '어느 업체 일인가요?',
  lines: ['위 회사 칸에서 업체를 고르면 그 업체 숫자로 바로 답해요.', ...(cfg.starters.some((s) => s.id === 'who') ? ['업체를 고르지 않아도 [우리 고객 중 …] 은 바로 볼 수 있어요.'] : [])],
  tone: 'info',
  actions: [{ id: 'pick', label: '회사 고르기', act: 'pick-client', primary: true }, ...(cfg.starters.some((s) => s.id === 'who') ? [{ id: 'ask-who', label: cfg.starters.find((s) => s.id === 'who')!.label, ask: cfg.starters.find((s) => s.id === 'who')!.ask }] : [])],
  source: 'rule',
  topic: 'pick',
})

function judgeAnswer(cfg: ModChatConfig, d: ModChatData, c: ClientOpsRecord): ChatAnswer {
  const ins = d.insightOf(c)
  if (!ins)
    return { title: `${c.companyName} — ${cfg.title} 판정을 아직 낼 수 없어요`, lines: ['이 모듈을 쓸 수 없거나 판정에 필요한 자료가 없어요. 화면에서 직접 입력해 보세요.'], tone: 'info', actions: [{ id: 'open', label: `${cfg.title} 화면 열기`, href: withClient(CHAT_FIRST_PATHS[cfg.key] + '?direct=1', c.id), primary: true }], source: 'rule', topic: 'judge' }
  const lines = [ins.headline, ins.detail, ins.amount ? `예상 금액: ${ins.amount}` : '', ins.missing.length ? `더 필요한 것: ${ins.missing.slice(0, 5).join(' · ')}` : '', ins.last ? `지난번 결과: ${ins.last.label}` : ''].filter((l) => l && l.trim())
  const actions: ChatAction[] = [{ id: 'open', label: ins.openLabel || `${cfg.title} 열기`, href: ins.openPath, primary: true }]
  if (ins.request) actions.push({ id: 'req', label: '서류 요청 문구 복사', copy: ins.request.text })
  if (cfg.scenarioModule) actions.push({ id: 'ask-scn', label: '상황 예시로 설계', ask: cfg.starters.find((s) => s.id === 'scenario')?.ask ?? '상황 예시로 설계해 줘' })
  return { title: `${c.companyName} — ${cfg.title} ${INSIGHT_TONE_LABEL[ins.tone]}`, lines: lines.slice(0, 6), tone: TONE[ins.tone], actions, source: 'rule', topic: 'judge' }
}

function whoAnswer(cfg: ModChatConfig, d: ModChatData): ChatAnswer {
  if (d.clients.length === 0) return { title: '아직 등록된 업체가 없어요', lines: ['고객 관리에서 업체를 등록하고 서류를 올리면 맞는 곳을 골라 드려요.'], tone: 'info', actions: [{ id: 'clients', label: '고객 관리 열기', href: '/ops/clients', primary: true }], source: 'rule', topic: 'who' }
  const rows: { c: ClientOpsRecord; ins: Insight }[] = []
  for (const c of d.clients) {
    try {
      const ins = d.insightOf(c, true)
      if (ins) rows.push({ c, ins })
    } catch {
      // 한 업체 값으로 실패해도 나머지는 보인다
    }
  }
  const good = rows.filter((r) => r.ins.tone === 'good' || r.ins.tone === 'maybe').sort((a, b) => RANK[a.ins.tone] - RANK[b.ins.tone])
  const need = rows.filter((r) => r.ins.tone === 'need').length
  if (good.length === 0)
    return {
      title: `지금 바로 ${cfg.title} 진행할 만한 업체는 없어요`,
      lines: [`업체 ${d.clients.length}곳을 봤어요.${need ? ` 자료가 더 필요한 곳 ${need}곳 — 서류를 받으면 판정이 나와요.` : ''}`],
      tone: 'info',
      actions: [{ id: 'list', label: '고객 관리에서 보기', href: '/ops/clients', primary: true }],
      source: 'rule',
      topic: 'who',
    }
  return {
    title: `${cfg.title} — 진행해 볼 만한 업체 ${good.length}곳`,
    lines: [...good.slice(0, 6).map((r) => `${r.c.companyName} — ${INSIGHT_TONE_LABEL[r.ins.tone]} · ${r.ins.headline}${r.ins.amount ? ` (${r.ins.amount})` : ''}`), ...(good.length > 6 ? [`외 ${good.length - 6}곳`] : []), ...(need ? [`자료가 더 필요한 곳 ${need}곳`] : [])],
    tone: 'ok',
    actions: good.slice(0, 3).map((r, i) => ({ id: `open-${r.c.id}`, label: `${r.c.companyName} 열기`, href: r.ins.openPath, primary: i === 0 })),
    source: 'rule',
    topic: 'who',
  }
}

function docsAnswer(cfg: ModChatConfig, d: ModChatData, c: ClientOpsRecord): ChatAnswer {
  const ins = cfg.insightKey ? d.insightOf(c) : null
  const missing = ins?.missing ?? []
  const actions: ChatAction[] = []
  if (ins?.request) actions.push({ id: 'req', label: '서류 요청 문구 복사', copy: ins.request.text, primary: true })
  actions.push({ id: 'docs', label: '서류함 열기', href: `/ops/clients/${enc(c.id)}?tab=docs`, primary: !ins?.request })
  return {
    title: missing.length ? `${c.companyName} — ${cfg.title}에 더 필요한 것 ${missing.length}가지` : `${c.companyName} — ${cfg.title} 판정에 더 필요한 서류는 없어요`,
    lines: missing.length ? [...missing.slice(0, 8), ...(ins?.request ? [`요청 문구에 담긴 서류 ${ins.request.count}가지 — 누르면 복사돼요.`] : [])] : ['지금 자료로 판정했어요. 신청 직전에는 기관이 정한 최신 서류를 한 번 더 확인해 주세요.'],
    tone: missing.length ? 'warn' : 'ok',
    actions,
    source: 'rule',
    topic: 'docs',
  }
}

function scenarioAnswer(cfg: ModChatConfig, d: ModChatData, c: ClientOpsRecord): ChatAnswer {
  const runs = d.scenariosOf(c)
  const FIT: Record<string, number> = { fit: 0, ask: 1, data: 2, no: 3 }
  const sorted = [...runs].sort((a, b) => (FIT[a.fit?.kind ?? 'data'] ?? 2) - (FIT[b.fit?.kind ?? 'data'] ?? 2))
  const usable = sorted.filter((r) => r.fit?.kind !== 'no')
  if (usable.length === 0)
    return { title: `${c.companyName}에 맞는 ${cfg.title} 상황 예시가 아직 없어요`, lines: ['회사 정보(업종 · 직원 수 · 매출 · 설립일)가 더 있으면 맞는 상황이 열려요.'], tone: 'info', actions: [{ id: 'open', label: `${cfg.title} 화면 열기`, href: withClient(CHAT_FIRST_PATHS[cfg.key] + '?direct=1', c.id), primary: true }], source: 'rule', topic: 'scenario' }
  return {
    title: `${c.companyName} — 바로 설계되는 상황 ${usable.length}가지`,
    lines: usable.slice(0, 5).map((r) => `${r.title} — ${r.headline}${r.amount ? ` (${r.amount})` : ''}`),
    tone: 'ok',
    actions: usable.slice(0, 3).map((r, i) => ({ id: `scn-${r.id}`, label: r.title, href: r.openPath, primary: i === 0 })),
    source: 'rule',
    topic: 'scenario',
  }
}

function calcListAnswer(d: ModChatData): ChatAnswer {
  const cid = d.client?.id ?? null
  return {
    title: '세금 계산기 9종 — 물어보면 맞는 계산기를 열어 드려요',
    lines: TAX_CALCULATORS.map((c) => `${c.no} ${c.title}`),
    tone: 'info',
    actions: [
      { id: 'plan', label: '원하는 결과로 찾기', href: withClient('/tools/tax?m=plan', cid), primary: true },
      ...TAX_CALCULATORS.slice(0, 3).map((c) => ({ id: `calc-${c.key}`, label: `${c.no} ${c.title.replace(/ ?계산기$/, '')}`, href: calcHref(c.key, cid) })),
    ],
    source: 'rule',
    topic: 'calc',
  }
}

function calcOneAnswer(text: string, d: ModChatData): ChatAnswer {
  const calc = calcOfText(text)!
  const cid = d.client?.id ?? null
  return {
    title: `${calc.no} ${calc.title}로 계산해요`,
    lines: [calc.desc, cid ? `${d.client!.companyName} 숫자로 채워서 열어요(빈 칸만 넣으면 돼요).` : '위에서 업체를 고르면 그 업체 숫자로 채워서 열어요.'],
    tone: 'info',
    actions: [{ id: 'open', label: `${calc.no} 계산기 열기`, href: calcHref(calc.key, cid), primary: true }, { id: 'plan', label: '원하는 결과로 찾기', href: withClient('/tools/tax?m=plan', cid) }],
    source: 'rule',
    topic: `calc:${calc.key}`,
  }
}

function soonAnswer(d: ModChatData): ChatAnswer {
  const soon = d.notices
    .map((n) => ({ n, left: n.deadline ? Math.round((Date.parse(`${n.deadline}T00:00:00`) - Date.parse(`${d.today}T00:00:00`)) / 86400000) : null }))
    .filter((x) => x.left !== null && x.left >= 0 && x.left <= 14)
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0))
  if (soon.length === 0)
    return { title: d.notices.length ? '2주 안에 마감되는 공고는 없어요' : '아직 받아 둔 공고가 없어요', lines: d.notices.length ? [`받아 둔 공고 ${d.notices.length}건 — 마감이 2주보다 남았거나 마감일이 없어요.`] : ['기업마당 공고는 매일 아침 9시에 들어와요. 직접 붙여 넣을 수도 있어요.'], tone: 'info', actions: [{ id: 'list', label: '공고 목록 보기', href: '/grants?view=notices', primary: true }], source: 'rule', topic: 'soon' }
  return {
    title: `2주 안에 마감되는 공고 ${soon.length}건`,
    lines: soon.slice(0, 6).map((x) => `${x.n.title} — ${x.left === 0 ? '오늘 마감' : `D-${x.left}`}`),
    tone: 'warn',
    actions: [{ id: 'list', label: '공고 목록 보기', href: '/grants?view=notices', primary: true }, { id: 'by', label: '업체별로 보기', href: '/grants?view=clients' }],
    source: 'rule',
    topic: 'soon',
  }
}

/** 모듈마다 고정 안내 답(홍보 글 · 홈페이지 · 크레탑 · 지원사업 일부) */
function fixedAnswer(cfg: ModChatConfig, topic: string, d: ModChatData): ChatAnswer | null {
  const c = d.client
  const cid = c?.id ?? null
  const name = c?.companyName ?? '이 업체'
  const base = CHAT_FIRST_PATHS[cfg.key]
  const open = (label: string, path = `${base}?direct=1`): ChatAction => ({ id: 'open', label, href: withClient(path, cid), primary: true })
  const A = (title: string, lines: string[], actions: ChatAction[], tone: ChatAnswer['tone'] = 'info'): ChatAnswer => ({ title, lines, tone, actions, source: 'rule', topic })
  switch (`${cfg.key}:${topic}`) {
    case 'grants:add':
      return A('공고는 두 가지로 들어와요', ['기업마당 공고 — 매일 아침 9시에 저절로 받아 와요(지금 받기 단추도 있어요).', '직접 넣기 — 공고 글을 그대로 붙여 넣으면 대상 · 지역 · 마감을 읽어 맞는 업체를 골라 줘요.'], [open('공고 넣으러 가기', '/grants?view=notices'), { id: 'by', label: '업체별로 보기', href: '/grants?view=clients' }])
    case 'cretop:analyze':
      return A('크레탑 보고서를 올리면 바로 분석해요', ['크레탑(KED) 기업종합보고서 PDF를 올리거나 글을 붙여 넣으세요.', '매출 · 이익 · 부채비율 · 신용등급과 미팅 포인트를 뽑고, 회사 정보에도 저절로 들어가요.'], [open('보고서 올리기', `${base}/analyze`)])
    case 'cretop:how':
      return A('크레탑 분석으로 알 수 있는 것', ['재무 요약 — 매출 · 영업이익 · 부채비율 · 자본잠식', '신용 · 위험 신호 — 등급 · 연체 · 소송', '미팅 포인트 — 정책자금 · 절세 · 인증으로 이어 말할 것', '숫자는 회사 정보(사실 창고)에 넣어 다른 모듈이 다시 써요.'], [open('보고서 올리기', `${base}/analyze`)])
    case 'cretop:results': {
      const done = d.clients.filter((x) => x.toolResults.some((r) => r.toolKey === 'cretop'))
      return done.length
        ? A(`크레탑 분석해 둔 업체 ${done.length}곳`, done.slice(0, 8).map((x) => `${x.companyName} — ${x.toolResults.filter((r) => r.toolKey === 'cretop').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.title ?? '분석 있음'}`), done.slice(0, 3).map((x, i) => ({ id: `c-${x.id}`, label: `${x.companyName} 열기`, href: `/ops/clients/${enc(x.id)}?tab=smart`, primary: i === 0 })), 'ok')
        : A('아직 크레탑 분석을 붙인 업체가 없어요', ['보고서를 올려 분석한 뒤 [기록에 붙이기] 를 누르면 여기 모여요.'], [open('보고서 올리기', `${base}/analyze`)])
    }
    case 'content:make':
      return A(`${name} 홍보 글을 만들어요`, ['업체 기록(업종 · 지역 · 강점)으로 초안을 바로 채워요 — 블로그 · 카톡 · 체험단 안내 · 쇼츠 대본.', '나온 글은 고치고 복사하거나 보관함에 남겨요.'], [open('홍보 글 만들기')], 'ok')
    case 'content:first':
      return A('홍보 글은 이 세 가지부터', ['1. 블로그 소개 글 — 검색에 잡히는 기본 글', '2. 카톡 홍보 문구 — 기존 고객에게 바로 보낼 짧은 글((광고) 표시 포함)', '3. 체험단 · 후기 안내 — 대가를 받았다는 표시까지'], [open('만들러 가기')])
    case 'content:kakao':
      return A(`${name} 카톡 홍보 문구`, ['홍보 글 화면에서 [카톡] 을 고르면 (광고) 표시 · 수신 거부 안내까지 넣은 글이 나와요.', '격식 있게 · 짧게 중에 고를 수 있어요.'], [open('카톡 문구 만들기')])
    case 'content:month':
      return A('한 달 홍보 계획', ['키워드 하나로 한 달 치 글을 한 번에 만들고, 올릴 날을 달력에 표시해요.', '올린 글은 [올렸어요] 로 표시하면 다음 글을 알려 줘요.'], [open('한 달 계획 만들기')])
    case 'content:how':
      return A('홍보 글 만들기 — 이렇게 써요', ['1. 업체 고르기 → 2. 만들 글 종류 고르기 → 3. 초안 고쳐서 복사', '광고 규정에 걸리는 말(최고 · 보장 등)은 빨갛게 표시돼요.'], [open('홍보 글 열기')])
    case 'homepage:make':
      return A(`${name} 홈페이지를 만들어요`, ['업체 기록(이름 · 업종 · 지역 · 연락처)으로 업종에 맞는 견본 초안을 바로 채워요.', '블록마다 고치고, 바탕 · 사진 · 휴대폰 고정 단추를 고를 수 있어요.'], [open('홈페이지 만들기')], 'ok')
    case 'homepage:score':
      return A('홈페이지 점수 — 이것만 하면 올라가요', ['연락처 · 지도 · 대표 사진 · 자주 묻는 질문 · 휴대폰 전화 단추가 있으면 점수가 올라가요.', '만들기 화면 오른쪽 점수판이 빠진 것을 하나씩 알려 줘요.'], [open('점수 보러 가기')])
    case 'homepage:sample':
      return A('업종 견본', ['제조 · 서비스 · 음식 · 디자인(간판 · 광고) 등 업종마다 첫 화면 그림 · 블록 순서가 다른 견본이 있어요.', '업체를 고르면 맞는 견본을 먼저 보여 줘요.'], [open('견본 보러 가기')])
    case 'homepage:edit':
      return A('만들기 화면에서 블록마다 고쳐요', ['글 · 사진 — 블록을 누르면 바로 고쳐요. 사진 모음에서 바꾸거나 새로 올려요.', '휴대폰 고정 단추 — 연락처 블록에서 켜면 화면 아래에 [전화 걸기] · [카카오톡 상담](또는 상담 신청 · 오시는 길)이 늘 보여요.', '바탕 · 디자인은 [디자인 한 번에] 에서 한 번에 바꿔요.'], [open('고치러 가기')])
    case 'homepage:publish':
      return A('만든 홈페이지 올리기', ['[HTML 내려받기] 로 파일 하나를 받아 호스팅(웹 호스팅 · 정적 사이트)에 올리면 돼요.', '업체 기록에 붙여 두면 다음에 이어서 고칠 수 있어요.'], [open('내려받으러 가기')])
    case 'homepage:how':
      return A('홈페이지 만들기 — 이렇게 써요', ['1. 업체 고르기 → 2. 견본 초안 확인 → 3. 블록 고치기 → 4. 내려받기'], [open('홈페이지 열기')])
    default:
      return null
  }
}

function howAnswer(cfg: ModChatConfig): ChatAnswer {
  return {
    title: `${cfg.title} — 이렇게 쓰면 돼요`,
    lines: ['1. 위 회사 칸에서 업체를 고르세요(업체 없이도 우리 고객 전체는 볼 수 있어요).', '2. 아래 큰 단추를 누르거나 궁금한 것을 그냥 물어보세요.', '3. 답 아래 단추를 누르면 그 업체 · 그 화면으로 바로 가요.', '대화 없이 직접 하고 싶으면 아래 [직접 눌러서 하기] 에서 고르세요.'],
    tone: 'info',
    actions: cfg.starters.slice(0, 2).map((s) => ({ id: `ask-${s.id}`, label: s.label, ask: s.ask })),
    source: 'rule',
    topic: 'how',
  }
}

function helpAnswer(cfg: ModChatConfig, d: ModChatData): ChatAnswer {
  return {
    title: '이렇게 물어보면 바로 답해요',
    lines: cfg.examples(d.client?.companyName ?? '○○'),
    tone: 'info',
    actions: cfg.starters.map((s) => ({ id: `ask-${s.id}`, label: s.label, ask: s.ask })),
    source: 'rule',
    topic: 'help',
  }
}

/** 단추(starter id) 또는 쓴 말 → 답 카드 */
export function modChatAnswer(cfg: ModChatConfig, input: { starter?: string; text?: string }, d: ModChatData): ChatAnswer {
  const topic = input.starter ?? modTopicOf(cfg, input.text ?? '') ?? 'help'
  if (topic === 'calc-one' && input.text) return calcOneAnswer(input.text, d)
  if (topic === 'calc') return calcListAnswer(d)
  if (topic === 'basis') return { title: '계산 기준표 — 계산기가 쓰는 세율 · 공제', lines: ['2026년 기준 소득세 · 법인세 · 4대보험 · 퇴직소득 · 상속 · 증여 세율과 공제를 한 표로 볼 수 있어요.'], tone: 'info', actions: [{ id: 'basis', label: '계산 기준표 열기', href: '/tools/tax?m=basis', primary: true }], source: 'rule', topic: 'basis' }
  if (topic === 'soon') return soonAnswer(d)
  if (topic === 'how') return fixedAnswer(cfg, 'how', d) ?? howAnswer(cfg)
  if (topic === 'help') return helpAnswer(cfg, d)
  if (topic === 'who') return cfg.insightKey ? whoAnswer(cfg, d) : helpAnswer(cfg, d)
  if (cfg.needsClient.includes(topic) && !d.client) return pickClient(cfg)
  const fixed = fixedAnswer(cfg, topic, d)
  if (fixed) return fixed
  if (topic === 'judge' && d.client && cfg.insightKey) return judgeAnswer(cfg, d, d.client)
  if (topic === 'judge' && !d.client) return pickClient(cfg)
  if (topic === 'docs' && d.client) return docsAnswer(cfg, d, d.client)
  if (topic === 'scenario' && d.client && cfg.scenarioModule) return scenarioAnswer(cfg, d, d.client)
  if (topic === 'scenario' && !d.client) return pickClient(cfg)
  return helpAnswer(cfg, d)
}

/** AI 답 아래 붙일 작업 화면 단추 — 쓴 말의 주제로 규칙 답을 만들어 그 단추만 */
export function modChatActions(cfg: ModChatConfig, text: string, d: ModChatData): ChatAction[] {
  const topic = modTopicOf(cfg, text)
  if (!topic) return []
  return modChatAnswer(cfg, { text }, d).actions.filter((a) => a.href || a.copy).slice(0, 2)
}

/** AI 에 보낼 자료 — 회사 · OS 판정 · 앞선 대화(대표 이름 · 전화 · 번호 없음) */
export function modAiContext(cfg: ModChatConfig, d: ModChatData, turns: readonly ChatTurn[]): AssistContext {
  const sections: AssistContext['sections'] = []
  if (d.client) {
    const c = d.client
    sections.push({ name: '고른 업체', rows: [{ 업체: c.companyName, 업종: c.industry ?? '', 설립일: c.establishedAt ?? '', 직원: c.employeeCount ?? '' }] })
    const ins = cfg.insightKey ? d.insightOf(c) : null
    if (ins) sections.push({ name: `${cfg.title} 판정(OS 규칙)`, rows: [{ 판정: INSIGHT_TONE_LABEL[ins.tone], 한줄: ins.headline, 자세히: ins.detail, 금액: ins.amount ?? '', 더필요: ins.missing.slice(0, 6) }] })
    if (cfg.scenarioModule) {
      const runs = d.scenariosOf(c).filter((r) => r.fit?.kind !== 'no').slice(0, 5)
      if (runs.length) sections.push({ name: '맞는 상황 예시(OS 계산)', rows: runs.map((r) => ({ 상황: r.title, 결과: r.headline, 금액: r.amount })) })
    }
  } else if (cfg.insightKey) {
    const rows = d.clients.slice(0, 40).flatMap((c) => {
      try {
        const ins = d.insightOf(c, true)
        return ins ? [{ 업체: c.companyName, 판정: INSIGHT_TONE_LABEL[ins.tone], 한줄: ins.headline, 금액: ins.amount ?? '' }] : []
      } catch {
        return []
      }
    })
    sections.push({ name: `고객 전체 ${cfg.title} 판정(OS 규칙)`, rows, total: d.clients.length })
  }
  if (cfg.key === 'grants' && d.notices.length) sections.push({ name: '받아 둔 공고', rows: d.notices.slice(0, 20).map((n) => ({ 공고: n.title, 마감: n.deadline })), total: d.notices.length })
  sections.push({ name: '앞선 대화', rows: historyRows(turns) })
  return {
    title: `${cfg.title} 대화창`,
    today: d.today,
    purpose: `대표가 ${cfg.title} 화면에서 묻는다. 판정 · 금액은 OS 가 규칙으로 계산한 값이다 — 바꾸거나 지어내지 말고, 없는 값은 '확인 필요' 로.`,
    sections,
  }
}

/** [사용 방법] */
export function modGuide(cfg: ModChatConfig): ChatGuideStep[] {
  return [
    { head: '업체부터 고르면 더 정확해요', body: `맨 위 '회사' 칸에서 업체를 고르면 그 업체 숫자로 답해요. 고르지 않아도 우리 고객 전체를 물어볼 수 있어요.` },
    { head: '큰 단추 하나만 눌러도 돼요', body: cfg.starters.map((s) => `${s.label} — ${s.ask}`).join('\n') },
    { head: '궁금한 건 그냥 물어보세요', body: `예) ${cfg.examples('○○').slice(0, 3).join(' · ')}\n✨ AI 가 연결돼 있으면 AI 가 OS 판정을 보고 답해요(판정 자체는 바꾸지 않아요). AI 가 꺼져 있으면 정해진 답으로 바로.` },
    { head: '직접 눌러서 하고 싶으면', body: "아래 [직접 눌러서 하기] 에서 화면을 바로 고르세요. '이 화면을 열면 → 바로 화면' 을 고르면 다음부터 대화창 없이 예전 화면으로 열려요(설정 › 내 설정에서 모두 바꿀 수도 있어요)." },
  ]
}
