/**
 * D-262 AI 답 너그럽게 읽기 — 서버가 '모양 검사' 에서 떨어뜨린 답(run.raw)도 버리지 않는다.
 * 대표: "저기 단계에서 자꾸 막히네. llm 모델이 문제가 아닌 것 같아" — 실제로 모델 탓이 아니라,
 * 머리글(headline)이 빠졌거나 · 답이 길어 끝이 잘렸거나 · 코드 블록으로 감싸 보낸 답을 통째로 버리고 있었다.
 *
 *  - looseJson: 글에서 JSON 한 덩어리를 꺼낸다. 끝이 잘렸으면 마지막으로 온전히 닫힌 곳까지 살리고 괄호를 닫아 준다.
 *  - answerOf: run.structured 가 있으면 그대로, 없으면 run.raw 를 looseJson 으로 읽어 { headline, items } 모양으로.
 */
import type { AssistAnswer, AssistItem, AssistRun } from './client'

function tryParse(t: string): unknown {
  try {
    return JSON.parse(t)
  } catch {
    return undefined
  }
}

/** 앞에서부터 읽으며 열린 괄호를 쌓는다 — 끝 위치 i 까지 글 안(따옴표 안)인지 · 아직 열린 괄호들 */
function openAt(t: string, end: number): { inString: boolean; stack: string[] } {
  const stack: string[] = []
  let inString = false
  let esc = false
  for (let i = 0; i < end; i += 1) {
    const c = t[i]
    if (inString) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') stack.pop()
  }
  return { inString, stack }
}

/** 글 → JSON(코드 블록 · 앞뒤 말 · 끝 잘림까지). 못 읽으면 null */
export function looseJson(text: unknown): unknown {
  if (typeof text !== 'string') return null
  const whole = text.trim()
  // 코드 블록 안을 먼저 — 글 안에 ``` 가 또 있어 잘못 잘렸으면 원문 전체로 다시
  const fence = /```(?:json)?\s*([\s\S]*?)(?:```|$)/i.exec(whole)
  if (fence && fence[1].includes('{')) {
    const v = jsonIn(fence[1].trim())
    if (v !== null) return v
  }
  return jsonIn(whole)
}

function jsonIn(src: string): unknown {
  let t = src
  const a = t.indexOf('{')
  if (a < 0) return null
  t = t.slice(a)
  const b = t.lastIndexOf('}')
  if (b > 0) {
    const whole = tryParse(t.slice(0, b + 1))
    if (whole !== undefined) return whole
  }
  // 끝이 잘린 답 — 뒤에서부터 닫는 괄호(} ])가 있는 자리마다 잘라 보고, 남은 괄호를 닫아 읽어 본다(최대 400번)
  let tries = 0
  for (let i = t.length - 1; i > 0 && tries < 400; i -= 1) {
    const c = t[i]
    if (c !== '}' && c !== ']') continue
    tries += 1
    const cut = t.slice(0, i + 1)
    const { inString, stack } = openAt(cut, cut.length)
    if (inString) continue
    const close = stack
      .slice()
      .reverse()
      .map((x) => (x === '{' ? '}' : ']'))
      .join('')
    const v = tryParse(cut.replace(/,\s*$/, '') + close)
    if (v !== undefined) return v
  }
  return null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** 항목 하나를 화면이 아는 모양으로(모르는 칸은 버리고 · 글이 아닌 것은 글로) */
function itemOf(v: unknown): AssistItem | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const outline = Array.isArray(o.outline) ? o.outline.map(str).filter(Boolean) : undefined
  const it: AssistItem = { title: str(o.title) }
  for (const k of ['detail', 'tag', 'ref', 'when', 'amount', 'body'] as const) if (str(o[k])) it[k] = str(o[k])
  if (outline?.length) it.outline = outline
  return it.title || it.body || it.detail || it.tag || it.outline ? it : null
}

/** 읽은 답 — 서버가 검사를 통과시킨 것(structured) 먼저, 아니면 원문(raw)을 너그럽게. 항목이 하나도 없으면 null */
export function answerOf(run: Pick<AssistRun, 'structured' | 'raw'>): AssistAnswer | null {
  if (run.structured && Array.isArray(run.structured.items) && run.structured.items.length) return run.structured
  const v = looseJson(run.raw)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return run.structured ?? null
  const o = v as Record<string, unknown>
  const items = (Array.isArray(o.items) ? o.items : []).map(itemOf).filter((x): x is AssistItem => !!x)
  if (!items.length) return run.structured ?? null
  return {
    headline: str(o.headline),
    items,
    next: Array.isArray(o.next) ? o.next.map(str).filter(Boolean) : [],
    caution: str(o.caution) || undefined,
  }
}

/** 원문 JSON 묶음 그대로(항목 모양이 아닌 답 — 예: { components: [...] }) */
export function rawObjectOf(run: Pick<AssistRun, 'raw'>): Record<string, unknown> | null {
  const v = looseJson(run.raw)
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}
