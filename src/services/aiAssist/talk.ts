/**
 * D-271 기획 대화 — 대표: "그 바탕으로 아이디어를 내봐 하면 의견을 딱 주는 거야. 일반 화장품이면 이런 방법이 있을 것 같습니다 ·
 *   근데 이런 거는 너무 흔하고 · 그래서 어떤 방식으로 하는 게 좋을까요? 이러면서 몇 단계 물어봐도 괜찮아 · 다섯 번 이내 ·
 *   옆에 챗GPT 띄워서 하는 것보다 이 버튼 하나로 기획까지 다 끝내게". 명세서(아이디어) · 벤처 사업계획서(기획 방향)가 같이 쓴다.
 *
 * 한 번 = AI 의 회사 이해(첫 번만) · 의견(흔한 방향과 약한 점) · 질문 하나 + 누를 답 3~4개. 대표가 답을 누르면 다음 질문,
 * 다섯 번이 되거나 AI 가 "충분" 이라고 하면 아이디어(방향) 5개를 그 답대로 낸다.
 */
import type { AssistAnswer } from './client'
import type { AssistRow } from './context'

export const TALK_MAX = 5

export interface TalkRound {
  /** 이 회사가 무엇을 하는지 한 줄(첫 번) */
  understanding: string
  /** 생각할 수 있는 방향 · 흔한지 · 약한 점 */
  opinions: { title: string; note: string }[]
  question: string
  /** 대표가 누를 답 */
  options: string[]
  /** 왜 묻는지 */
  why: string
  /** 대표 답('' = 아직) */
  answer: string
  /** AI 가 이제 충분하다고 함 */
  done: boolean
  /** 지금까지 잡힌 기획 한 줄 */
  headline: string
}

const str = (x: unknown) => (typeof x === 'string' ? x : '')
const one = (x: unknown, n: number) => str(x).replace(/\s+/g, ' ').trim().slice(0, n)

/** AI 답 → 한 번의 대화. 질문도 '충분' 도 없으면 null(답 모양 어긋남) */
export function talkOf(answer: AssistAnswer | null): TalkRound | null {
  if (!answer) return null
  const items = answer.items ?? []
  const tagOf = (t: unknown) => one(t, 20).replace(/\s/g, '')
  const und = items.find((it) => tagOf(it.tag) === '이해')
  const opinions = items.filter((it) => tagOf(it.tag) === '의견').map((it) => ({ title: one(it.title, 160), note: one(it.detail || it.body, 300) })).filter((o) => o.title).slice(0, 4)
  const q = items.find((it) => tagOf(it.tag) === '질문')
  const enough = items.find((it) => tagOf(it.tag) === '충분')
  const options = (q?.outline ?? []).map((o) => one(o, 120).replace(/^\s*(?:[①-⑥]|\d+[.)]|[-•·])\s*/, '')).filter(Boolean).slice(0, 5)
  if (!enough && (!q || !one(q.title, 300) || options.length < 2)) return null
  return {
    understanding: und ? [one(und.title, 200), one(und.detail, 300)].filter(Boolean).join(' — ') : '',
    opinions,
    question: enough ? '' : one(q?.title, 300),
    options: enough ? [] : options,
    why: enough ? one(enough.title || enough.detail, 300) : one(q?.detail, 200),
    answer: '',
    done: !!enough,
    headline: one(answer.headline, 300),
  }
}

export function readTalk(v: unknown): TalkRound[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      understanding: one(x.understanding, 600),
      opinions: (Array.isArray(x.opinions) ? x.opinions : []).filter((o): o is Record<string, unknown> => !!o && typeof o === 'object').map((o) => ({ title: one(o.title, 160), note: one(o.note, 300) })).slice(0, 4),
      question: one(x.question, 300),
      options: (Array.isArray(x.options) ? x.options : []).map((o) => one(o, 120)).filter(Boolean).slice(0, 5),
      why: one(x.why, 300),
      answer: one(x.answer, 600),
      done: x.done === true,
      headline: one(x.headline, 300),
    }))
    .slice(0, TALK_MAX + 1)
}

/** 대표가 답한 질문 수 */
export const answeredCount = (rounds: readonly TalkRound[]) => rounds.filter((r) => r.answer.trim()).length

/** 지금 대답을 기다리는 질문(없으면 null) */
export function openRound(rounds: readonly TalkRound[]): TalkRound | null {
  const last = rounds[rounds.length - 1]
  return last && !last.done && !last.answer.trim() && last.question ? last : null
}

/** 대화가 끝났나 — AI 가 충분하다고 했거나 다섯 번 답했으면 */
export const talkFinished = (rounds: readonly TalkRound[]) => rounds.some((r) => r.done) || answeredCount(rounds) >= TALK_MAX

/** 마지막 질문에 대표 답을 단다 */
export function withAnswer(rounds: readonly TalkRound[], answer: string): TalkRound[] {
  const a = one(answer, 600)
  if (!a || !openRound(rounds)) return [...rounds]
  return rounds.map((r, i) => (i === rounds.length - 1 ? { ...r, answer: a } : r))
}

/** AI 에 보낼 대화 줄 — 회사 이해 · 질문마다 "물음 / 대표 답" · 의견 */
export function talkRows(rounds: readonly TalkRound[]): AssistRow[] {
  const out: AssistRow[] = []
  const und = rounds.find((r) => r.understanding)?.understanding
  if (und) out.push({ part: 'AI 가 이해한 회사', memo: und })
  rounds.forEach((r, i) => {
    if (r.opinions.length) out.push({ part: `의견 ${i + 1}`, memo: r.opinions.map((o) => `${o.title}${o.note ? ` — ${o.note}` : ''}`).join(' / ').slice(0, 560) })
    if (r.question) out.push({ part: `질문 ${i + 1}`, memo: `${r.question}${r.answer ? ` → 대표 답: ${r.answer}` : ' → (아직 답 없음)'}`.slice(0, 560) })
  })
  return out
}

/** 아이디어 · 방향을 낼 때 붙이는 규칙 한 줄 */
export const TALK_RULE = '[자료 · 기획 대화] 의 대표 답을 반드시 따른다 — 대표가 고른 방향 · 고객 · 데이터 안에서 낸다. 대표가 "AI 가 정해 달라" 고 한 곳만 자체점검 기준으로 고른다.'
