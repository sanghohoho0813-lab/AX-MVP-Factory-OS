/**
 * D-252 대표님 답장 한 번에 넣기 — 대표: "기업인증도 하나하나 타자로 입력하는 건 절대 없어야 돼".
 *
 * [대표에게 질문 보내기] 로 보낸 카톡에 대표님이 답하면, 그 답장을 통째로 붙여 넣는다 → 질문마다 나눠 담는다.
 *   ① 번호로 — "1. 네 / 2) 2명 / ③ 있음 / 3번 …" (보내는 문구에 번호를 붙여 두었다)
 *   ② 순서로 — 번호가 없어도 답 줄 수가 질문 수와 같으면 차례대로(이때는 '순서로 나눔' 이라 표시 · 저장 전에 눈으로 확인)
 *   ③ 둘 다 안 되면 비워 두고 알린다 — 대표 화면에서는 [AI로 나눠 보기](cert.reply)가 남는다.
 * 지어내지 않는다: 답장에 없는 질문은 비워 둔다. 인사 · 카톡 머리(이름 · 시각)는 걷어 낸다.
 */

export interface ReplyAsk {
  /** 저장 이름표(notes 키) */
  key: string
  /** 보낸 질문 */
  text: string
}

export type ReplyHow = 'number' | 'order' | 'ai'

export interface ReplyPick {
  key: string
  question: string
  answer: string
  how: ReplyHow
}

/** 카톡 내보내기 · 붙여넣기 머리: "[김대표] [오후 3:12] …" · "2026. 10. 21. 오후 3:12, 김대표 : …" · "김대표 : …" */
const KAKAO_HEAD = [
  /^\s*\[[^\]]{1,20}\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s*/,
  /^\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*(?:(?:오전|오후)\s*)?\d{1,2}:\d{2},?\s*[^:：]{1,20}\s*[:：]\s*/,
  /^\s*(?:오전|오후)\s*\d{1,2}:\d{2}\s*/,
]
/** 답이 아닌 줄 — 인사 · 맺음 · 날짜 줄 */
const NOISE = /^(?:-+\s*\d{4}년.*-+|안녕하세요[.!~ ]*|네[,.!~ ]*대표님[.!~ ]*|감사합니다[.!~ ]*|고맙습니다[.!~ ]*|수고하세요[.!~ ]*|확인했습니다[.!~ ]*|답변\s*드립니다[.!~ :]*|아래와\s*같습니다[.!~ :]*)$/

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'
/** 줄 앞 번호: "1." "1)" "1번" "Q1:" "□ 1." "(1)" "①" — "1.5억" · "10:30" 같은 숫자는 번호로 보지 않는다 */
const NUM_HEAD = /^\s*(?:[□■☐▶▷·\-*]\s*)?(?:Q\s*)?(?:\(\s*)?(\d{1,2})\s*(?:\)|\.(?!\d)|번\.?|:(?!\d)|：|\]|\s-)\s*/i

function cleanLine(raw: string): string {
  let s = raw.replace(/ /g, ' ')
  for (const re of KAKAO_HEAD) s = s.replace(re, '')
  return s.trim()
}

/** 답 앞에 질문을 그대로 옮겨 적은 경우("연구전담인력은 몇 명? → 2명") 질문 부분을 걷어 낸다 */
function dropEcho(answer: string, question: string): string {
  const a = answer.trim()
  const q = question.replace(/\s+/g, ' ').trim()
  for (const cut of [q, q.replace(/[?？.]$/, '')]) {
    if (cut.length >= 6 && a.startsWith(cut)) return a.slice(cut.length).replace(/^\s*(?:[?？]\s*)?(?:→|->|=>|:|：|-|—)?\s*/, '').trim()
  }
  return a.replace(/^(?:→|->|=>|:|：|—)\s*/, '').trim()
}

function numberOf(line: string): { n: number; rest: string } | null {
  const c = CIRCLED.indexOf(line.trim().charAt(0))
  if (c >= 0) return { n: c + 1, rest: line.trim().slice(1).replace(/^[\s.)]*/, '') }
  const m = NUM_HEAD.exec(line)
  if (!m) return null
  return { n: Number(m[1]), rest: line.slice(m[0].length) }
}

/**
 * 답장 → 질문마다. 같은 번호가 두 번이면 이어 붙인다. 번호 줄 뒤에 번호 없는 줄은 앞 번호의 답으로 잇는다.
 * leftover = 어느 질문에도 들어가지 않은 줄(번호 앞 인사 등은 버린다).
 */
export function splitReply(reply: string, asks: readonly ReplyAsk[]): { picks: ReplyPick[]; how: ReplyHow | null; leftover: string } {
  const lines = (reply ?? '').split(/\r?\n/).map(cleanLine).filter((l) => l && !NOISE.test(l))
  if (!lines.length || !asks.length) return { picks: [], how: null, leftover: '' }

  // ① 번호
  const byNum = new Map<number, string[]>()
  const loose: string[] = []
  let cur: number | null = null
  for (const l of lines) {
    const h = numberOf(l)
    if (h && h.n >= 1 && h.n <= asks.length) {
      cur = h.n
      const prev = byNum.get(cur) ?? []
      byNum.set(cur, h.rest ? [...prev, h.rest] : prev)
    } else if (cur != null) {
      byNum.set(cur, [...(byNum.get(cur) ?? []), l])
    } else loose.push(l)
  }
  if (byNum.size > 0) {
    const picks: ReplyPick[] = []
    for (const [n, parts] of [...byNum.entries()].sort((a, b) => a[0] - b[0])) {
      const ask = asks[n - 1]
      const answer = dropEcho(parts.join(' ').replace(/\s+/g, ' '), ask.text)
      if (answer) picks.push({ key: ask.key, question: ask.text, answer, how: 'number' })
    }
    return { picks, how: 'number', leftover: loose.join('\n') }
  }

  // ② 순서 — 답 줄 수 = 질문 수일 때만(하나라도 다르면 어긋날 수 있어 나누지 않는다)
  if (lines.length === asks.length) {
    const picks = asks.map((a, i) => ({ key: a.key, question: a.text, answer: dropEcho(lines[i], a.text), how: 'order' as const })).filter((p) => p.answer)
    return { picks, how: 'order', leftover: '' }
  }
  return { picks: [], how: null, leftover: lines.join('\n') }
}

/** AI 답(cert.reply) → 질문마다. title 또는 ref = q번호, body(없으면 detail) = 답. 없는 번호 · 빈 답은 버린다 */
export function replyPicksOfAi(items: readonly { title?: string; ref?: string; body?: string; detail?: string }[], asks: readonly ReplyAsk[]): ReplyPick[] {
  const out = new Map<string, ReplyPick>()
  for (const it of items ?? []) {
    const id = /^q(\d{1,2})$/i.exec(String(it.ref ?? '').trim()) ?? /^q(\d{1,2})$/i.exec(String(it.title ?? '').trim())
    if (!id) continue
    const ask = asks[Number(id[1]) - 1]
    const answer = String(it.body || it.detail || '').replace(/\s+/g, ' ').trim()
    if (!ask || !answer || /^(?:없음|답 없음|답변 없음|\(없음\)|-)$/.test(answer)) continue
    if (!out.has(ask.key)) out.set(ask.key, { key: ask.key, question: ask.text, answer, how: 'ai' })
  }
  return asks.map((a) => out.get(a.key)).filter((p): p is ReplyPick => !!p)
}
