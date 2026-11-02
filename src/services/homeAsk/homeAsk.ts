/**
 * D-497 오늘 맨 위 대화창 — 순수 함수(화면 · 저장과 따로, 단위 시험이 지킨다).
 *
 * 대표: "홈에 들어오면 LLM 처음 화면처럼 대화창만 딱 — '오늘 ○○ 1차 미팅 가는데 사업자등록증 받았어, 정책자금 어떻게 제안할까'
 *        같은 걸 물으면 기존 모듈 · 업체 자료를 엮어서 최선의 답을. 쓰면서 점점 정확하게."
 *
 *  1. 질문에서 업체 찾기 — 등록된 업체 이름(㈜ · 주식회사 · 띄어쓰기 무시) · 앞부분만 쓴 이름(그 이름으로 시작하는 업체가 하나뿐일 때) · 배운 별명
 *  2. 질문 종류 — 미팅 준비 · 정책자금 · 고용 · 연구소 · 절세 · 창업감면 · 지원사업 · 서류 · 오늘 · 돈
 *  3. 보낼 자료 묶기 — 물어본 업체(회사 · OS 모듈 판정 · 일정 · 받을 돈 · 서류함) → 오늘 → 고객 전체. 서버는 12묶음 · 4만 자까지라 순서가 곧 우선순위
 *  4. AI 가 안 될 때 규칙으로 정리한 답(AI 라고 부르지 않는다)
 *  5. 쓰면서 배우기 — 👎 까닭(업체를 잘못 짚음 · 자료와 다름 · 너무 김 · 더 구체적으로)을 말하기 규칙으로 · 👍 받은 질문은 예시로 · 고른 업체는 별명으로
 */
import { RefBook, type AssistBundle, type AssistRow, type AssistSection } from '../aiAssist/context'
import type { AssistAnswer, AssistItem } from '../aiAssist/client'

/* ------------------------------------------------------------------ */
/* 1. 업체 찾기                                                            */
/* ------------------------------------------------------------------ */

export interface NamedClient {
  id: string
  companyName: string
  archivedAt?: string | null
}

/** 업체 이름 견주기용 — ㈜ · (주) · 주식회사 · 유한회사 · 띄어쓰기 · 기호를 빼고 소문자 */
export function normName(s: string): string {
  return String(s ?? '')
    .replace(/㈜|\(주\)|\(유\)|\(합\)|\(사\)|\(재\)/g, '')
    .replace(/주식회사|유한회사|유한책임회사|합자회사|합명회사|농업회사법인|영농조합법인|사단법인|재단법인|협동조합/g, '')
    .replace(/[\s.,·・()[\]{}'"`~!@#$%^&*_+=|\\/:;<>?-]/g, '')
    .toLowerCase()
}

/** 업체 이름이 아닌 흔한 말 — 앞부분만 쓴 이름으로 읽지 않는다 */
const STOP = new Set(
  '오늘 내일 모레 어제 이번 다음 지난 이번주 다음주 미팅 회의 방문 만남 상담 업체 회사 기업 대표 대표님 팀장 고객 고객사 사장 사장님 정책자금 고용지원금 고용 채용 연구소 절세 세금 지원사업 공고 창업감면 감면 제안 준비 서류 사업자 사업자등록증 등록증 재무제표 1차 2차 3차 첫 어떻게 무엇 뭐 뭘 뭔가 정리 추천 알려 알려줘 해줘 해 주세요 하는 있는 받은 받을 받았어 가는데 가는 갈 건데 할 수 있을지 어디 어느 누구 언제 얼마 얼마나 전부 모두 모든 그리고 근데 그럼 이거 그거 저거 이 그 저 좀 많이 가장 제일 먼저 우리 저희 내 나 정도 관련 대해 대한 위해 위한 같은 처럼'
    .split(/\s+/),
)

/** 말끝 조사 떼기 — '한솔테크에' → '한솔테크' */
function stripParticle(t: string): string {
  return t.replace(/(에서|에게|한테|께서|으로|이랑|하고|까지|부터|이나|라도|은|는|이|가|을|를|에|의|와|과|랑|로|도|만|께)$/u, '')
}

function tokensOf(text: string): string[] {
  return String(text ?? '')
    .split(/[^0-9A-Za-z가-힣㈜]+/u)
    .map((t) => stripParticle(t.trim()))
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

/**
 * 질문에 나온 업체(나온 순서 · 최대 3곳). 보관한 업체는 빼지 않는다(예전 업체를 물을 수도 있다).
 * 이름 전체가 들어 있으면 그 업체 — 'A테크' 와 'A테크솔루션' 이 함께 걸리면 긴 이름만.
 * 앞부분만 쓴 이름은 그 말로 시작하는 업체가 하나뿐일 때만(두 곳 이상이면 고르게 둔다).
 */
export function findClients(text: string, clients: readonly NamedClient[], aliases: Readonly<Record<string, string>> = {}): string[] {
  const q = normName(text)
  if (!q) return []
  const hits: { id: string; at: number; len: number }[] = []
  for (const c of clients) {
    const n = normName(c.companyName)
    if (n.length < 2) continue
    const at = q.indexOf(n)
    if (at >= 0) hits.push({ id: c.id, at, len: n.length })
  }
  // 긴 이름에 들어 있는 짧은 이름은 뺀다(같은 자리)
  const full = hits.filter((h) => !hits.some((o) => o !== h && o.len > h.len && o.at <= h.at && o.at + o.len >= h.at + h.len))
  const ids = new Map<string, number>(full.map((h) => [h.id, h.at]))
  const live = new Set(clients.map((c) => c.id))
  for (const [alias, id] of Object.entries(aliases)) {
    const a = normName(alias)
    if (a.length < 2 || !live.has(id) || ids.has(id)) continue
    const at = q.indexOf(a)
    if (at >= 0) ids.set(id, at)
  }
  if (ids.size === 0) {
    for (const t of tokensOf(text)) {
      const n = normName(t)
      if (n.length < 2) continue
      const cands = clients.filter((c) => normName(c.companyName).startsWith(n))
      if (cands.length === 1 && !ids.has(cands[0].id)) ids.set(cands[0].id, q.indexOf(n))
    }
  }
  return [...ids.entries()].sort((a, b) => a[1] - b[1]).slice(0, 3).map(([id]) => id)
}

/** 이름이 잡히지 않은 질문에서 사람이 업체를 고르면 — 질문 속 그 업체 이름의 일부를 별명으로 배운다 */
export function learnAliases(question: string, companyName: string): string[] {
  const n = normName(companyName)
  if (n.length < 2) return []
  return [...new Set(tokensOf(question).filter((t) => {
    const k = normName(t)
    return k.length >= 2 && k !== n && n.includes(k)
  }))].slice(0, 3)
}

/* ------------------------------------------------------------------ */
/* 2. 질문 종류                                                            */
/* ------------------------------------------------------------------ */

export type HomeIntent = 'meeting' | 'policy' | 'employment' | 'lab' | 'tax' | 'startup' | 'grants' | 'docs' | 'today' | 'money'

const INTENT_WORDS: readonly [HomeIntent, RegExp][] = [
  ['meeting', /미팅|만나|방문|상담\s*가|1\s*차|첫\s*만남|제안할|제안하|뭘\s*말|무슨\s*말|어떻게\s*제안/],
  ['policy', /정책\s*자금|운전\s*자금|시설\s*자금|중진공|소진공|신용보증|기보|신보|보증서|대출/],
  ['employment', /고용|채용|청년|지원금|두루누리|일자리|인건비/],
  ['lab', /연구소|연구\s*전담|R&D|연구개발|세액\s*공제/i],
  ['tax', /절세|세금|법인세|종합소득세|가지급금|배당|퇴직금|상속|증여|법인\s*전환/],
  ['startup', /창업\s*감면|창업\s*중소|감면/],
  ['grants', /지원\s*사업|공고|바우처|과제|보조금/],
  ['docs', /서류|사업자\s*등록증|재무\s*제표|등기부|명부|증명서|받았어|올렸/],
  ['today', /오늘|이번\s*주|할\s*일|일정|마감|기한|급한|중요한/],
  ['money', /매출|수금|미수|받을\s*돈|입금|돈|비용|정산/],
]

export function intentsOf(text: string): HomeIntent[] {
  const t = String(text ?? '')
  return INTENT_WORDS.filter(([, re]) => re.test(t)).map(([k]) => k)
}

/** 질문 종류 → 판정에서 먼저 볼 모듈 키(OS 모듈 판정 key 와 같다) */
export const INTENT_MODULES: Partial<Record<HomeIntent, readonly string[]>> = {
  policy: ['policy-funding'],
  employment: ['employment'],
  lab: ['labcare'],
  tax: ['tax'],
  startup: ['startup-tax'],
  grants: ['grants'],
}

/* ------------------------------------------------------------------ */
/* 3. 추천 질문 세 줄                                                       */
/* ------------------------------------------------------------------ */

export type SuggestIcon = 'meeting' | 'docs' | 'reco' | 'today' | 'money' | 'call'

export interface HomeSuggestion {
  icon: SuggestIcon
  text: string
  /** 이 질문이 가리키는 업체(있으면 대화창에 업체를 같이 건다) */
  clientId?: string
}

export interface SuggestInput {
  /** 지난 것 · 오늘 · 내일 약속(업체가 있는 것) */
  appointments: readonly { clientId: string | null; clientName: string; daysLeft: number | null }[]
  /** 최근 서류가 들어온 업체(새 것부터) */
  freshDocs: readonly { clientId: string; clientName: string }[]
  /** 맞는 모듈이 많은 업체(많은 순) — labels = 모듈 이름 */
  recos: readonly { clientId: string; clientName: string; labels: readonly string[] }[]
  overdueMoney: number
  hasTodos: boolean
}

/** 지금 자료에 맞춘 질문 세 줄 — 약속 → 새 서류 → 추천 많은 업체, 모자라면 오늘 · 돈 · 연락 */
export function homeSuggestions(i: SuggestInput): HomeSuggestion[] {
  const out: HomeSuggestion[] = []
  const used = new Set<string>()
  const meet = i.appointments.find((a) => a.clientId && (a.daysLeft ?? 9) >= 0 && (a.daysLeft ?? 9) <= 1)
  if (meet?.clientId) {
    out.push({ icon: 'meeting', text: `${meet.daysLeft === 0 ? '오늘' : '내일'} ${meet.clientName} 미팅 — 무엇을 먼저 제안할까요?`, clientId: meet.clientId })
    used.add(meet.clientId)
  }
  const doc = i.freshDocs.find((d) => !used.has(d.clientId))
  if (doc) {
    out.push({ icon: 'docs', text: `${doc.clientName} 서류가 들어왔어요 — 받을 수 있는 것 정리해 줘`, clientId: doc.clientId })
    used.add(doc.clientId)
  }
  const reco = i.recos.find((r) => !used.has(r.clientId) && r.labels.length > 0)
  if (reco) out.push({ icon: 'reco', text: `${reco.clientName}에 ${reco.labels.slice(0, 2).join(' · ')} 어떻게 제안할까?`, clientId: reco.clientId })
  const fill: HomeSuggestion[] = [
    { icon: 'today', text: i.hasTodos ? '오늘 제일 중요한 것 3개만 골라 줘' : '오늘 무엇부터 하면 좋을까?' },
    ...(i.overdueMoney > 0 ? [{ icon: 'money' as const, text: '받을 날 지난 돈 — 어디부터 연락할까?' }] : []),
    { icon: 'call', text: '이번 주 먼저 연락할 업체 3곳은?' },
  ]
  for (const f of fill) if (out.length < 3) out.push(f)
  return out.slice(0, 3)
}

/* ------------------------------------------------------------------ */
/* 4. 쓰면서 배우기                                                         */
/* ------------------------------------------------------------------ */

export type DownReason = 'wrongClient' | 'wrongFact' | 'tooLong' | 'vague'

export const DOWN_REASONS: readonly { key: DownReason; label: string }[] = [
  { key: 'wrongClient', label: '업체를 잘못 짚음' },
  { key: 'wrongFact', label: '자료와 다름' },
  { key: 'tooLong', label: '너무 길어요' },
  { key: 'vague', label: '더 구체적으로' },
]

export interface HomeFeedback {
  up: number
  down: Partial<Record<DownReason, number>>
  /** 👍 받은 질문 · 답 한 줄(최근 5개) — 다음 답의 예시 */
  liked: { q: string; headline: string }[]
}

export const EMPTY_FEEDBACK: HomeFeedback = { up: 0, down: {}, liked: [] }

export function parseFeedback(raw: string | null): HomeFeedback {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<HomeFeedback>) : {}
    const down: Partial<Record<DownReason, number>> = {}
    for (const r of DOWN_REASONS) {
      const n = Number((v.down as Record<string, unknown> | undefined)?.[r.key])
      if (Number.isFinite(n) && n > 0) down[r.key] = Math.min(99, Math.round(n))
    }
    const liked = Array.isArray(v.liked) ? v.liked.filter((x) => x && typeof x.q === 'string' && typeof x.headline === 'string').slice(-5).map((x) => ({ q: x.q.slice(0, 160), headline: x.headline.slice(0, 200) })) : []
    const up = Number(v.up)
    return { up: Number.isFinite(up) && up > 0 ? Math.round(up) : 0, down, liked }
  } catch {
    return EMPTY_FEEDBACK
  }
}

export function withFeedback(fb: HomeFeedback, vote: { up: true; q: string; headline: string } | { up: false; reason: DownReason }): HomeFeedback {
  if (vote.up) return { ...fb, up: fb.up + 1, liked: [...fb.liked, { q: vote.q.slice(0, 160), headline: vote.headline.slice(0, 200) }].slice(-5) }
  return { ...fb, down: { ...fb.down, [vote.reason]: Math.min(99, (fb.down[vote.reason] ?? 0) + 1) } }
}

/** 받은 평가 → 다음 답의 말하기 규칙(서버 [규칙집] 칸) */
export function preferenceRules(fb: HomeFeedback): string[] {
  const out: string[] = []
  if ((fb.down.tooLong ?? 0) > 0) out.push('대표가 "너무 길다" 고 했다 — headline 2문장 안 · items 4개 안 · detail 1문장.')
  if ((fb.down.vague ?? 0) > 0) out.push('대표가 "더 구체적으로" 를 원했다 — 모듈 이름 · 금액(OS 값) · 서류 이름 · 날짜를 꼭 넣고, 바로 말할 첫 문장을 준다.')
  if ((fb.down.wrongFact ?? 0) > 0) out.push('대표가 "자료와 다르다" 고 했다 — [자료] 에 있는 값만 쓰고, 없는 것은 "확인 필요" 로 남긴다. 추정은 쓰지 않는다.')
  if ((fb.down.wrongClient ?? 0) > 0) out.push('대표가 "업체를 잘못 짚었다" 고 했다 — 질문에 이름이 나온 업체만 다룬다. 이름이 모호하면 headline 에 어느 업체인지 되묻는다.')
  for (const l of fb.liked.slice(-3)) out.push(`대표가 좋다고 한 답의 예 — 질문 "${l.q}" → 답 "${l.headline}". 이런 방식으로.`)
  return out
}

/* ------------------------------------------------------------------ */
/* 5. 보낼 자료 묶기                                                        */
/* ------------------------------------------------------------------ */

/** ref(c3 · t2) 앞 글자 */
const prefixOf = (ref: string) => (/^([a-z]{1,3})\d/.exec(ref)?.[1] ?? 'r')

/**
 * 여러 묶음을 하나로 — ref 를 새 번호표로 다시 붙인다(같은 업체는 같은 번호).
 * 같은 이름 칸은 rename 으로 이름을 바꾸고, 같은 이름끼리는 줄을 합친다(물어본 업체가 여럿이어도 칸 수는 그대로).
 * 서버는 칸 12개까지만 읽는다 — 앞 칸이 먼저.
 */
export function mergeBundles(
  parts: readonly { bundle: AssistBundle; take?: (name: string) => boolean; rename?: (name: string) => string }[],
  meta: { title: string; today: string; purpose: string },
  extra: { before?: AssistSection[]; after?: AssistSection[]; facts?: string[]; rules?: string[] } = {},
): AssistBundle {
  const book = new RefBook()
  const byName = new Map<string, AssistSection>()
  const order: string[] = []
  const facts: string[] = []
  const put = (name: string, rows: AssistRow[], total?: number) => {
    const hit = byName.get(name)
    if (hit) {
      hit.rows.push(...rows)
      if (typeof total === 'number') hit.total = (hit.total ?? hit.rows.length - rows.length) + total
      return
    }
    byName.set(name, { name, rows: [...rows], ...(typeof total === 'number' ? { total } : {}) })
    order.push(name)
  }
  for (const s of extra.before ?? []) put(s.name, s.rows, s.total)
  parts.forEach(({ bundle, take, rename }, pi) => {
    for (const sec of bundle.context.sections) {
      if (take && !take(sec.name)) continue
      const rows = sec.rows.map((row) => {
        if (!row.ref) return row
        const key = bundle.ids?.[row.ref] ?? `${pi}:${row.ref}`
        return { ...row, ref: book.ref(prefixOf(row.ref), key, bundle.links[row.ref]) }
      })
      put(rename ? rename(sec.name) : sec.name, rows, sec.total)
    }
    for (const f of bundle.context.facts ?? []) if (!facts.includes(f)) facts.push(f)
  })
  for (const s of extra.after ?? []) put(s.name, s.rows, s.total)
  const sections = order.map((n) => byName.get(n) as AssistSection).filter((s) => s.rows.length > 0).slice(0, 12)
  return {
    links: book.links,
    ids: book.ids,
    context: { title: meta.title, today: meta.today, purpose: meta.purpose, sections, facts: [...facts, ...(extra.facts ?? [])].slice(0, 30), ...(extra.rules?.length ? { rules: extra.rules } : {}) },
  }
}

/** 앞선 대화(최근 3번) — 이어지는 질문으로 읽게 */
export function priorTurnsSection(turns: readonly { q: string; headline?: string }[]): AssistSection | null {
  const rows = turns.filter((t) => t.headline).slice(-3).map((t) => ({ 질문: t.q.slice(0, 200), 답: (t.headline ?? '').slice(0, 300) }))
  return rows.length ? { name: '앞선 대화', rows } : null
}

/* ------------------------------------------------------------------ */
/* 6. AI 가 안 될 때 — 규칙으로 정리한 답                                     */
/* ------------------------------------------------------------------ */

/** 판정 한 줄(OS 모듈 판정 — clientInsights 의 Insight 에서 필요한 칸만) */
export interface PickLite {
  key: string
  label: string
  tone: string
  toneLabel: string
  headline: string
  amount?: string
  missing: readonly string[]
  openPath: string
}

export interface RuleInput {
  question: string
  intents: readonly HomeIntent[]
  /** 물어본 업체마다 판정 좋은 순(먼저 제안할 것과 같은 순서) */
  focus: readonly { id: string; name: string; picks: readonly PickLite[]; missingDocs: readonly string[] }[]
  today: { overdue: number; todos: readonly string[]; hardDue: readonly string[]; appointments: readonly string[] }
  /** 질문에 업체 같은 말이 있었는데 못 찾았으면 비슷한 이름(최대 3) */
  nearNames: readonly string[]
}

export interface RuleAnswer extends AssistAnswer {
  links: Record<string, string>
}

/**
 * 규칙으로 정리한 답 — 판정 · 금액은 OS 가 계산한 그대로(지어내지 않음). 'AI' 라고 쓰지 않는다.
 * 업체가 있으면 먼저 제안할 것 · 물어볼 것 · 받을 서류, 없으면 오늘 할 일 · 기한 · 약속.
 */
export function ruleAnswer(i: RuleInput): RuleAnswer {
  const links: Record<string, string> = {}
  if (i.focus.length > 0) {
    const items: AssistItem[] = []
    for (const [fi, f] of i.focus.entries()) {
      const ref = `c${fi + 1}`
      links[ref] = `/ops/clients/${encodeURIComponent(f.id)}?tab=smart`
      // 질문 종류에 맞는 모듈을 앞으로(정책자금을 물으면 정책자금부터)
      const want = new Set(i.intents.flatMap((k) => INTENT_MODULES[k] ?? []))
      const picks = [...f.picks].sort((a, b) => Number(want.has(b.key)) - Number(want.has(a.key))).slice(0, 3)
      for (const p of picks) items.push({ title: `${i.focus.length > 1 ? `${f.name} · ` : ''}${p.label} — ${p.toneLabel}`, detail: p.headline, tag: p.label, amount: p.amount ?? '', ref })
      // 서류는 '받아 올 서류' 로 — 확인할 것에는 서류가 아닌 것만(겹치지 않게)
      const docs = new Set(f.missingDocs)
      const ask = [...new Set(picks.flatMap((p) => p.missing))].filter((m) => !docs.has(m)).slice(0, 6)
      if (ask.length && i.intents.includes('meeting')) items.push({ title: `${i.focus.length > 1 ? `${f.name} · ` : ''}미팅에서 확인할 것`, outline: ask, ref })
      if (f.missingDocs.length) items.push({ title: `${i.focus.length > 1 ? `${f.name} · ` : ''}받아 올 서류`, outline: f.missingDocs.slice(0, 6), ref })
      if (picks.length === 0) items.push({ title: `${f.name} — 아직 판정할 자료가 적어요`, detail: '사업자등록증 · 재무제표 · 4대보험 명부를 받으면 맞는 모듈을 바로 판정해요.', ref })
    }
    const names = i.focus.map((f) => f.name).join(' · ')
    const top = i.focus[0].picks[0]
    return {
      headline: top ? `${names} — 먼저 제안할 것은 ${top.label}(${top.toneLabel})부터예요.` : `${names} — 자료를 더 받으면 맞는 모듈을 판정해요.`,
      items,
      next: ['맞춤 추천에서 맞춤 진단서 한 장 드리기', '받아 올 서류 요청 문구 보내기'],
      links,
    }
  }
  const items: AssistItem[] = []
  for (const t of i.today.appointments.slice(0, 3)) items.push({ title: t, tag: '약속' })
  for (const t of i.today.hardDue.slice(0, 3)) items.push({ title: t, tag: '기한' })
  for (const t of i.today.todos.slice(0, 3)) items.push({ title: t, tag: '할 일' })
  const head = i.nearNames.length
    ? `등록된 업체에서 그 이름을 찾지 못했어요 — 혹시 ${i.nearNames.join(' · ')} 인가요?`
    : items.length
      ? `오늘 챙길 것 ${items.length}가지${i.today.overdue > 0 ? ` · 밀린 할 일 ${i.today.overdue}건` : ''}`
      : '오늘은 급한 일이 없어요. 업체 이름과 함께 물어보면 그 업체 판정 · 서류로 정리해요.'
  return { headline: head, items, next: i.nearNames.length ? ['[+] 에서 업체를 고르고 다시 물어보기'] : ['업체 이름을 넣어 물어보기(예: ○○ 미팅 준비)'], links }
}

/** 못 찾은 이름과 비슷한 업체 — 두 글자 이상 겹치는 이름(최대 3) */
export function nearNames(text: string, clients: readonly NamedClient[]): string[] {
  const toks = tokensOf(text).map(normName).filter((t) => t.length >= 2)
  if (!toks.length) return []
  const scored = clients
    .map((c) => {
      const n = normName(c.companyName)
      let best = 0
      for (const t of toks) for (let k = Math.min(t.length, n.length); k >= 2; k--) {
        let hit = false
        for (let s = 0; s + k <= t.length; s++) if (n.includes(t.slice(s, s + k))) { hit = true; break }
        if (hit) { best = Math.max(best, k); break }
      }
      return { name: c.companyName, best }
    })
    .filter((x) => x.best >= 2)
    .sort((a, b) => b.best - a.best)
  return scored.slice(0, 3).map((x) => x.name)
}

/**
 * D-499 '받아 올 서류' → 대표님께 보낼 카톡 문구(그대로 복사해 보내게). 서류 이름만 — 지어낸 기한 · 금액 없음.
 */
export function docRequestText(company: string, docs: readonly string[]): string {
  const list = [...new Set(docs.map((d) => d.replace(/\s*—\s*확인$/, '').trim()).filter(Boolean))].slice(0, 10)
  if (list.length === 0) return ''
  return [`안녕하세요 대표님${company ? `, ${company}` : ''} 상담 준비를 위해 아래 서류를 보내 주시면 바로 검토해 드리겠습니다.`, '', ...list.map((d) => `- ${d}`), '', '사진으로 찍어 보내셔도 됩니다. 감사합니다.'].join('\n')
}

/** D-499 답의 한 항목이 '받아 올 서류' 목록인가 */
export const isDocListItem = (title: string, outline: readonly string[] | undefined): boolean => /받아\s*올\s*서류|받을\s*서류|준비\s*서류|필요\s*서류/.test(title) && (outline?.length ?? 0) > 0

/* ------------------------------------------------------------------ */
/* D-501 답 아래 '상황 예시로 바로 설계' — 누르면 그 업체 숫자로 모듈이 열린다(고도화 목표 3)            */
/* ------------------------------------------------------------------ */

export interface PlanChip {
  id: string
  module: string
  moduleLabel: string
  title: string
  /** 엔진이 계산한 금액만(없으면 '') */
  amount: string
  /** 결과 한 줄(자료 칸 · 마우스 설명) */
  headline: string
  /** 모듈 화면 — 같은 가정 · 같은 업체로 열린다 */
  path: string
  /** D-502 방금 말한 사정으로 새로 맞게 된 상황(talk) · 물어본 가정으로 설계한 상황(if) */
  tag?: 'talk' | 'if'
}

/** 상황 예시 실행 결과에서 쓰는 것만(services/scenarios 의 ScenarioRun 과 같은 모양) */
export interface PlanRunLite {
  id: string
  module: string
  moduleLabel: string
  title: string
  amount: string
  headline: string
  openPath: string
  state: 'ready' | 'partial' | 'need'
  fit: { kind: 'fit' | 'ask' | 'data' | 'no' }
}

/**
 * 이 업체에 맞고(근거 있음) 결과가 나온 상황만 — 질문에 나온 모듈 먼저, 그다음 들어온 순서(맞음 · 바로 설계 먼저), 최대 3개.
 * 아직 등록 안 된 업체(임시 기록)는 열 화면이 없어 뺀다.
 */
export function planChips(runs: readonly PlanRunLite[], intents: readonly HomeIntent[], max = 3, skipId = 'chat_new', tags: ReadonlyMap<string, 'talk' | 'if'> = new Map()): PlanChip[] {
  const want = new Set(intents.flatMap((k) => INTENT_MODULES[k] ?? []))
  return runs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.fit.kind === 'fit' && r.state !== 'need' && r.openPath && !r.openPath.includes(skipId))
    // D-502 방금 말한 사정 · 물어본 가정으로 열린 상황이 맨 앞(그 말에 대한 답이니까)
    .sort((a, b) => Number(tags.has(b.r.id)) - Number(tags.has(a.r.id)) || Number(want.has(b.r.module)) - Number(want.has(a.r.module)) || a.i - b.i)
    .slice(0, max)
    .map(({ r }) => {
      const tag = tags.get(r.id)
      return { id: r.id, module: r.module, moduleLabel: r.moduleLabel, title: r.title, amount: r.amount, headline: r.headline, path: r.openPath, ...(tag ? { tag } : {}) }
    })
}

/** D-502 말한 사정 · 가정으로 새로 맞게 된 상황 — 전에는 맞지 않던(물어볼 것 · 안 맞음) 상황이 이제 맞음 */
export function openedBy(before: readonly PlanRunLite[], after: readonly PlanRunLite[], mode: 'talk' | 'if'): Map<string, 'talk' | 'if'> {
  const was = new Map(before.map((r) => [r.id, r.fit.kind]))
  return new Map(after.filter((r) => r.fit.kind === 'fit' && was.get(r.id) !== 'fit').map((r) => [r.id, mode]))
}

/** AI 에 보내는 '맞는 상황 예시' 칸 — 금액은 엔진 값 그대로 */
export function planSection(chips: readonly PlanChip[], company: string): AssistSection | null {
  if (!chips.length) return null
  return { name: `물어본 업체 · ${company} 맞는 상황 예시(답 아래 단추로 바로 설계)`, rows: chips.map((c) => ({ 상황: c.title, 모듈: c.moduleLabel, 결과: c.headline.slice(0, 120), 금액: c.amount || '금액 없음' })) }
}
