/**
 * D-250 기업인증 대화창 — 규칙 답(AI 아님). 판정(assess) · 로드맵 · 제출 서류 · 설명 문구를 짧은 답 카드로.
 * 판정 · 문구는 Core(src/certification/core) 그대로 — 여기서 바꾸거나 새로 판단하지 않는다.
 */
import { RECOMMENDATION_LABEL, READINESS_LABEL, type CertificationAssessment, type CertificationClientContext, type CertificationKey, type Recommendation } from '../../certification/core/types'
import type { Roadmap } from '../../certification/core/roadmap'
import { missingDocsRequest, submissionDocs } from '../../certification/core/submitGate'
import { explainFor } from '../../certification/core/explain'
import type { AssistContext } from '../aiAssist/context'
import { historyRows, type ChatAnswer, type ChatGuideStep, type ChatStarter, type ChatTopic, type ChatTurn } from './chatTypes'

export interface CertChatData {
  clientId: string
  clientName: string
  ctx: CertificationClientContext
  list: readonly CertificationAssessment[]
  roadmap: Roadmap
}

export const CERT_STARTERS: readonly ChatStarter[] = [
  { id: 'can', label: '받을 수 있는 인증', ask: '이 회사가 받을 수 있는 인증은?' },
  { id: 'docs', label: '빠진 서류', ask: '서류는 뭐가 더 필요해요?' },
  { id: 'next', label: '다음에 할 일', ask: '다음에 뭘 하면 돼요?' },
  { id: 'explain', label: '대표님께 보낼 설명', ask: '대표님께 보낼 설명 문구를 만들어 줘' },
]

export const CERT_TOPICS: readonly ChatTopic[] = [
  { id: 'docs', words: /서류|자료|증빙|준비물|필요한\s*(것|게)|빠진/ },
  { id: 'explain', words: /설명|카톡|문구|보낼|안내/ },
  { id: 'next', words: /다음|순서|먼저|뭐부터|무엇부터|로드맵|할\s*일/ },
  { id: 'can', words: /받을\s*수|가능|추천|어떤|뭐가|무슨\s*인증|인증/ },
]

const CERT_WORDS: readonly { key: CertificationKey; words: RegExp }[] = [
  { key: 'venture', words: /벤처/ },
  { key: 'innobiz', words: /이노비즈/ },
  { key: 'mainbiz', words: /메인비즈/ },
  { key: 'lab', words: /연구소|연구전담/ },
  { key: 'iso9001', words: /iso\s*9001|품질/i },
  { key: 'iso14001', words: /iso\s*14001|환경/i },
  { key: 'iso45001', words: /iso\s*45001|안전/i },
  { key: 'iso9001', words: /iso|아이에스오/i },
]

/** 쓴 말에 나온 인증(없으면 null) */
export function certOfText(text: string): CertificationKey | null {
  return CERT_WORDS.find((c) => c.words.test(String(text ?? '')))?.key ?? null
}

const ORDER: Record<Recommendation, number> = { now: 0, possible: 1, after_fix: 2, held: 3, need_info: 4, too_early: 5, low_priority: 6, not_needed: 7, ineligible: 8 }
const ACTIVE = new Set<Recommendation>(['now', 'possible', 'after_fix'])

const certHref = (key: string, clientId: string) => `/tools/cert-os/${key}?client=${encodeURIComponent(clientId)}`
export const certDetailHref = (clientId: string) => `/tools/cert-os?client=${encodeURIComponent(clientId)}&detail=1`

/** 로드맵 1순위 인증 → 없으면 진행할 만한 것 중 첫째 */
export function targetCert(data: CertChatData, want: CertificationKey | null): CertificationAssessment | null {
  if (want) return data.list.find((a) => a.key === want) ?? null
  const first = data.roadmap.steps.find((s) => data.list.some((a) => a.key === s.id))
  return (first ? data.list.find((a) => a.key === first.id) : null) ?? [...data.list].filter((a) => ACTIVE.has(a.recommendation)).sort((a, b) => ORDER[a.recommendation] - ORDER[b.recommendation])[0] ?? null
}

const pickClient = (): ChatAnswer => ({ title: '어느 회사 인증을 볼까요?', lines: ['위에서 회사를 먼저 골라 주세요.'], tone: 'info', actions: [{ id: 'pick', label: '회사 고르기', act: 'pick-client', primary: true }], source: 'rule' })

/** 1순위가 없을 때 — 인증을 골라 이어 묻는 칩(진행할 만한 것 먼저 · 대상 아님/불가는 뺀다) */
function askChips(data: CertChatData, label: string, ask: string): ChatAnswer['actions'] {
  return [...data.list]
    .filter((a) => a.recommendation !== 'not_needed' && a.recommendation !== 'ineligible')
    .sort((a, b) => ORDER[a.recommendation] - ORDER[b.recommendation])
    .slice(0, 3)
    .map((a) => ({ id: `ask-${a.key}`, label: `${a.label} ${label}`, ask: `${a.label} ${ask}` }))
}

const needInfo = (data: CertChatData) => data.list.some((a) => a.recommendation === 'need_info')
const askAction = (data: CertChatData) => ({ id: 'ask', label: '확인 질문에 답하기', href: certDetailHref(data.clientId), primary: true })

function canAnswer(data: CertChatData): ChatAnswer {
  const hero = targetCert(data, null)
  const sorted = [...data.list].sort((a, b) => ORDER[a.recommendation] - ORDER[b.recommendation])
  const lines = sorted.slice(0, 6).map((a) => `${a.label}: ${RECOMMENDATION_LABEL[a.recommendation]}${a.key === hero?.key ? ` — ${a.oneLine}` : ''}`)
  // 회사 정보가 모자라 판정을 못 한 것이 있으면 — 확인 질문(예전 '인증 한눈에')으로 바로
  const ask = !hero && needInfo(data)
  if (ask) lines.push('회사 정보가 모자라 판정을 못 한 인증이 있어요 — 확인 질문 몇 개에 답하면 바로 나와요.')
  return {
    title: hero ? `${hero.label}부터 — ${RECOMMENDATION_LABEL[hero.recommendation]}` : '지금 바로 진행할 인증은 없어요',
    lines,
    tone: hero && ACTIVE.has(hero.recommendation) ? 'ok' : 'info',
    actions: [
      ...(hero ? [{ id: 'hero', label: `${hero.label} 자세히`, href: certHref(hero.key, data.clientId), primary: true }] : []),
      ask ? askAction(data) : { id: 'all', label: '전체 판정 보기', href: certDetailHref(data.clientId) },
    ],
    source: 'rule',
    topic: 'can',
  }
}

function certAnswer(data: CertChatData, key: CertificationKey): ChatAnswer {
  const a = data.list.find((x) => x.key === key)
  if (!a) return canAnswer(data)
  const sym = (s: string) => (s === 'ok' ? '✓' : s === 'warn' ? '△' : s === 'no' ? '✗' : '?')
  return {
    title: `${a.label} — ${RECOMMENDATION_LABEL[a.recommendation]}`,
    lines: [a.oneLine, ...a.reasons.slice(0, 4).map((r) => `${sym(r.state)} ${r.text}`), ...(a.missingFacts.length ? [`확인할 것: ${a.missingFacts.slice(0, 3).join(' · ')}`] : [])],
    tone: ACTIVE.has(a.recommendation) || a.recommendation === 'held' ? 'ok' : a.recommendation === 'ineligible' ? 'warn' : 'info',
    actions: [{ id: 'open', label: `${a.label} 자세히`, href: certHref(a.key, data.clientId), primary: true }, ...(a.key === 'venture' ? [{ id: 'plan', label: '벤처 사업계획서 쓰기', href: `/patent-venture/plan?client=${encodeURIComponent(data.clientId)}` }] : [])],
    source: 'rule',
    topic: `k:${a.key}`,
  }
}

function docsAnswer(data: CertChatData, want: CertificationKey | null, consultant: string): ChatAnswer {
  const t = targetCert(data, want)
  if (!t)
    return {
      title: '어느 인증 서류를 볼까요?',
      lines: ['아직 1순위 인증이 정해지지 않았어요 — 아래에서 인증을 고르면 그 서류를 알려 드려요.', ...(needInfo(data) ? ['확인 질문에 답하면 1순위가 바로 정해져요.'] : [])],
      tone: 'info',
      actions: [...askChips(data, '서류', '서류 뭐 필요해?'), needInfo(data) ? { ...askAction(data), primary: false } : { id: 'all', label: '전체 판정 보기', href: certDetailHref(data.clientId) }],
      source: 'rule',
      topic: 'docs',
    }
  const docs = submissionDocs(t.key, data.ctx)
  const lines = docs.need.slice(0, 6).map((d) => `${d.label}${d.stale ? ' (기간 지남 — 새로 발급)' : ''}${d.required ? '' : ' (있으면 좋음)'}`)
  if (docs.need.length > 6) lines.push(`외 ${docs.need.length - 6}가지`)
  if (t.missingFacts.length) lines.push(`대표님께 확인할 것: ${t.missingFacts.slice(0, 3).join(' · ')}`)
  return {
    title: docs.need.length ? `${t.label} 제출에 ${docs.need.length}가지가 더 필요해요` : `${t.label} 제출 서류는 다 있어요 ✓`,
    lines: lines.length ? lines : [`있는 서류 ${docs.have.length}가지`],
    tone: docs.need.length ? 'warn' : 'ok',
    actions: [
      ...(docs.need.length ? [{ id: 'copy', label: '요청 문구 복사', copy: missingDocsRequest(data.clientName, t.key, docs, consultant), primary: true }] : []),
      { id: 'open', label: '서류 준비 화면', href: certHref(t.key, data.clientId), primary: !docs.need.length },
    ],
    source: 'rule',
    topic: 'docs',
  }
}

function nextAnswer(data: CertChatData): ChatAnswer {
  const steps = data.roadmap.steps
  if (!steps.length)
    return {
      title: needInfo(data) ? '먼저 확인 질문에 답해 주세요' : '지금 진행할 순서가 없어요',
      lines: [
        ...(needInfo(data) ? ['회사 정보가 모자라 순서를 못 정했어요 — 확인 질문 몇 개에 답하면 순서가 바로 나와요.'] : []),
        ...data.roadmap.later.slice(0, 3).map((l) => `나중에: ${l.label} (${l.when})`),
        '회사 정보(업력 · 매출 · 연구 인력)가 바뀌면 다시 봐 주세요.',
      ],
      tone: 'info',
      actions: [needInfo(data) ? askAction(data) : { id: 'all', label: '전체 판정 보기', href: certDetailHref(data.clientId) }],
      source: 'rule',
      topic: 'next',
    }
  const first = steps[0]
  const href = (id: string) => (id === 'patent' ? '/patent-venture' : data.list.some((a) => a.key === id) ? certHref(id, data.clientId) : '')
  return {
    title: `먼저 ${first.label}`,
    lines: [...steps.slice(0, 4).map((s, i) => `${i + 1}. ${s.label} — ${s.why}`), ...data.roadmap.later.slice(0, 2).map((l) => `나중에: ${l.label} (${l.when})`)],
    tone: 'info',
    actions: steps
      .slice(0, 2)
      .map((s, i) => ({ id: `step-${s.id}`, label: `${s.label} 열기`, href: href(s.id), primary: i === 0 }))
      .filter((a) => a.href),
    source: 'rule',
    topic: 'next',
  }
}

function explainAnswer(data: CertChatData, want: CertificationKey | null, consultant: string): ChatAnswer {
  const t = targetCert(data, want)
  if (!t) return { title: '어느 인증을 설명할까요?', lines: ['아래에서 인증을 고르면 대표님께 보낼 카톡 문구를 바로 만들어 드려요.'], tone: 'info', actions: askChips(data, '설명', '설명 문구 만들어 줘'), source: 'rule', topic: 'explain' }
  const ex = explainFor(t, data.ctx, consultant)
  return {
    title: `${t.label} — 대표님께 보낼 카톡`,
    lines: ex.kakao.split('\n').filter((l) => l.trim()).slice(0, 8),
    tone: 'info',
    actions: [
      { id: 'kakao', label: '카톡 문구 복사', copy: ex.kakao, primary: true },
      { id: 'thirty', label: '30초 설명 복사', copy: ex.thirty },
    ],
    source: 'rule',
    topic: 'explain',
  }
}

export function certHelpAnswer(owner: boolean): ChatAnswer {
  return {
    title: '이렇게 물어보세요',
    lines: ['"받을 수 있는 인증은?" · "벤처 서류 뭐 필요해?" · "다음에 뭐 해?" · "이노비즈 설명 문구"', owner ? 'AI 연결이 아직 안 돼 있어 정해진 답만 드려요 — 설정의 AI 연결을 확인해 주세요.' : '아래 단추를 누르면 바로 답해요.'],
    tone: 'info',
    actions: [],
    source: 'rule',
    topic: 'help',
  }
}

/** 시작 단추 · 찾은 주제 → 답. want = 쓴 말에 나온 인증 */
export function certChatAnswer(topic: string, data: CertChatData | null, want: CertificationKey | null = null, owner = false, consultant = '담당 컨설턴트'): ChatAnswer {
  if (!data) return pickClient()
  if (topic === 'can') return want ? certAnswer(data, want) : canAnswer(data)
  if (topic === 'docs') return docsAnswer(data, want, consultant)
  if (topic === 'next') return nextAnswer(data)
  if (topic === 'explain') return explainAnswer(data, want, consultant)
  if (topic.startsWith('k:')) return certAnswer(data, topic.slice(2) as CertificationKey)
  return certHelpAnswer(owner)
}

/** 쓴 말 → (주제, 인증). 인증 이름만 있으면 그 인증 답 */
export function certTopicOf(text: string): { topic: string | null; cert: CertificationKey | null } {
  const cert = certOfText(text)
  const topic = CERT_TOPICS.find((x) => x.words.test(text))?.id ?? null
  if (cert && (!topic || topic === 'can')) return { topic: `k:${cert}`, cert }
  return { topic, cert }
}

/** AI 에 보낼 자료 — 회사 숫자 · OS 판정 · 로드맵(사람 이름 · 번호 없음) */
export function certAiContext(data: CertChatData, turns: readonly ChatTurn[], today: string): AssistContext {
  const c = data.ctx
  return {
    title: '기업인증 대화창',
    today,
    purpose: '대표가 이 회사의 기업인증(벤처 · 이노비즈 · 메인비즈 · 연구소 · ISO)을 묻는다. 판정은 OS 가 규칙으로 계산한 값이다.',
    sections: [
      { name: '회사', rows: [{ 회사: data.clientName, 업력: c.years != null ? `${c.years}년` : '', 업종: c.industryText, 직원: c.employees ?? '', 매출: c.revenue != null ? `${Math.round(c.revenue / 1e6).toLocaleString()}백만 원` : '', 연구개발비: c.rndExpense != null ? `${Math.round(c.rndExpense / 1e6).toLocaleString()}백만 원` : '' }] },
      {
        name: '인증 판정(OS 규칙)',
        rows: data.list.map((a) => ({ 인증: a.label, 판정: RECOMMENDATION_LABEL[a.recommendation], 준비도: READINESS_LABEL[a.readiness], 한줄: a.oneLine, 모자란사실: a.missingFacts.slice(0, 5), 빠진증빙: a.missingEvidence.slice(0, 6), 시기: a.timing })),
      },
      { name: '추천 순서', rows: data.roadmap.steps.map((s, i) => ({ 순서: i + 1, 할것: s.label, 이유: s.why })) },
      { name: '앞선 대화', rows: historyRows(turns) },
    ],
  }
}

/** [사용 방법] — 처음 쓰는 사람용(대표 "사용 방법만 좀 자세히") */
export const CERT_GUIDE: readonly ChatGuideStep[] = [
  { head: '회사부터 고르세요', body: "기업인증은 회사마다 판정이 달라요. 맨 위 '회사' 칸에서 먼저 고르세요." },
  {
    head: '단추 하나만 누르면 됩니다',
    body: '받을 수 있는 인증 — 벤처 · 이노비즈 · 메인비즈 · 연구소 · ISO 판정과 1순위\n빠진 서류 — 1순위 인증 제출에 더 필요한 서류 + 대표님께 보낼 요청 문구 복사\n다음에 할 일 — 이 회사에 맞는 진행 순서\n대표님께 보낼 설명 — 카톡 문구 · 30초 설명 복사',
  },
  {
    head: '궁금한 건 그냥 물어보세요',
    body: "예) '벤처 서류 뭐 필요해?' · '이노비즈 받을 수 있어?' · '메인비즈 설명 문구'\n대표 계정: ✨ AI가 OS 판정(규칙으로 계산) · 빠진 서류 · 순서를 보고 답해요. 판정 자체는 바꾸지 않아요.\n팀장 계정 · AI 연결 전: 정해진 답으로 바로 알려 드려요.",
  },
  { head: '답 아래 단추로 바로 작업', body: '[○○ 자세히]를 누르면 그 인증 화면(받을 수 있나요? → 무엇을 준비 → 실제 진행 → 받으면)이 열려요. 셀프 체크 · 현장 실사 준비 · 제출 전 확인도 거기 그대로 있어요.\n[요청 문구 복사] · [카톡 문구 복사]는 누르면 바로 복사돼요.' },
  { head: '판정이 이상하면', body: "판정은 회사 정보(업력 · 매출 · 직원 · 연구 인력 · 특허)로 계산해요. [자세히]의 '확인 질문'에 답하거나 업체 상세에서 회사 정보를 고치면 바로 바뀌어요." },
  { head: '예전 전체 화면은 [자세히]', body: "오른쪽 위 [자세히] = 예전 '인증 한눈에' 화면(1순위 · 진행 순서 · 확인 질문 · 고객 요약)이 그대로 있어요." },
  { head: '알아 둘 것', body: '신청은 각 기관 사이트에서 직접 합니다. 기준은 공고마다 바뀔 수 있어 최종 확인은 공식 공고로 해 주세요.' },
]
