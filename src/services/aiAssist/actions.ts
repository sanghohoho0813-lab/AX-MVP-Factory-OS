/**
 * AI 도우미 답 → 다음 단계(D-241).
 * 대표: "열어보기를 누르면 진짜 뭔가 열리던지 뭔가 기록이 되든지 해야" — 답의 번호(ref)를 무엇으로 이어 줄지 · 할 일로 넣을 때의 글과 기한.
 */
import { addDaysLocal } from '../clientOpsNextAction'
import { normRef } from './context'
import type { AssistAnswer, AssistItem, AssistStatus, ProviderId } from './client'
import type { AiChoice } from './store'

/** ref 머리 글자 → 이어 주는 곳 이름(단추 글) */
const REF_LABEL: Record<string, string> = {
  c: '업체 열기',
  g: '공고 보기',
  e: '상담신청 보기',
  t: '업무 일기에서 보기',
  i: '내 콘텐츠에서 보기',
  v: '영상 보기',
}

export function refKind(ref: unknown): string {
  return normRef(ref).replace(/\d+$/, '')
}

export function refLabel(ref: unknown): string {
  return REF_LABEL[refKind(ref)] ?? '열어 보기'
}

/**
 * 지금 보고 있는 화면과 같은 곳이면 true — 그런 링크는 눌러도 아무 일이 없어 보이므로 단추를 내지 않는다
 * (D-239 마케팅 답의 '열어 보기' 가 '/marketing' 이라 판만 닫혔던 것).
 */
export function isSamePage(href: string, here: { pathname: string; search: string }): boolean {
  if (/^https?:\/\//.test(href)) return false
  const [path, query = ''] = href.split('?')
  if (path !== here.pathname) return false
  if (!query) return true
  const want = new URLSearchParams(query)
  const now = new URLSearchParams(here.search)
  for (const [k, v] of want) if (now.get(k) !== v) return false
  return true
}

/** D-244 있는 날짜인가(2026-13-45 · 2026-11-31 은 아님) — 있으면 'YYYY-MM-DD' */
function realDay(y: number, m: number, d: number): string | null {
  const t = new Date(y, m - 1, d)
  if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** D-244 해 없는 날짜(10/25 · 10월 25일) — 올해 그날이 이미 지났으면 내년 */
function monthDay(m: number, d: number, today: string): string | null {
  const y = Number(today.slice(0, 4))
  const day = realDay(y, m, d)
  if (!day) return null
  return day < today ? realDay(y + 1, m, d) : day
}

/**
 * 답의 when(언제) → 할 일 기한. 날짜가 있으면 그날(이미 지났으면 오늘), '내일' 이면 내일, 그 밖은 오늘.
 * D-244 없는 날짜(2026-11-31)는 버리고, 'D-3' · '10/25' · '10/25(토)' · '10월 25일' 도 읽는다(today 는 이 기기 날짜).
 * 할 일은 기한이 있어야 오늘 · 달력에 보인다(D-210).
 */
export function dueFromWhen(when: string | undefined, today: string): string {
  const w = (when ?? '').trim()
  const m = w.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/)
  if (m) {
    const day = realDay(Number(m[1]), Number(m[2]), Number(m[3]))
    return !day || day < today ? today : day
  }
  const md = w.match(/(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/) ?? w.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (md) return monthDay(Number(md[1]), Number(md[2]), today) ?? today
  const dn = w.match(/D\s*-\s*(\d{1,3})(?!\d)/i)
  if (dn) return addDaysLocal(today, Number(dn[1]))
  if (/모레/.test(w)) return addDaysLocal(today, 2)
  if (/내일/.test(w)) return addDaysLocal(today, 1)
  if (/다음\s*주/.test(w)) return addDaysLocal(today, 7)
  return today
}

/** 할 일 글 — 제목이 짧으면 설명 첫 문장을 조금 붙인다(업무 일기에서 무슨 일인지 알게) */
export function todoText(item: Pick<AssistItem, 'title' | 'detail'>): string {
  const title = item.title.trim()
  const first = (item.detail ?? '').split(/(?<=[.!?。])\s|\n/)[0]?.trim() ?? ''
  const text = title.length < 16 && first ? `${title} — ${first.slice(0, 60)}` : title
  return text.slice(0, 200)
}

/**
 * D-241 같은 회사의 한 단계 위 모델(빠르게 → 보통 → 깊게). 키가 없거나 이미 가장 위면 null.
 * 대표: 싼 모델 답이 와닿지 않을 때 모델 설정을 열지 않고 한 번에 다시.
 */
export function betterModel(status: AssistStatus | null, run: { provider: ProviderId; model: string }): (AiChoice & { label: string }) | null {
  const p = status?.providers.find((x) => x.id === run.provider)
  if (!p || !p.configured) return null
  const now = p.models.find((m) => m.id === run.model)
  const cur = now?.tier
  if (!cur) {
    // D-244 단계를 모르는 모델 — 가격표로 견주어 더 비싼 단계 모델 중 가장 싼 것. 가격도 모르면 단추 없음(더 약한 모델을 권하지 않게)
    if (!now?.price) return null
    const cost = (x: [number, number]) => x[0] + x[1]
    const base = cost(now.price)
    const up = p.models.filter((x) => x.tier && x.price && cost(x.price) > base).sort((a, b) => cost(a.price!) - cost(b.price!))[0]
    return up ? { provider: p.id, model: up.id, label: up.label } : null
  }
  const want = cur === 'cheap' ? 'standard' : cur === 'standard' ? 'deep' : null
  const m = want ? p.models.find((x) => x.tier === want) : undefined
  return m ? { provider: p.id, model: m.id, label: m.label } : null
}

/**
 * D-244 이 ref 가 이미 있는 할 일(업무 일기 t#)을 가리키나 — 그런 줄에는 [할 일로 넣기] 를 내지 않는다(같은 할 일이 두 번).
 * 오늘 화면의 t# 중 업무 일기가 아닌 것(업체 없는 기한 · 일정)은 links 주소로 가른다.
 */
export function pointsAtTodo(ref: unknown, links: Record<string, string> | undefined): boolean {
  const r = normRef(ref)
  if (!r || refKind(r) !== 't') return false
  const href = links?.[r]
  return !href || href === '/journal' || href.startsWith('/journal?')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** D-244 답 글의 별칭(영업자 A …) → 실제 이름. 이 브라우저에서 보여 줄 때만(AI 에는 별칭만 갔다) — '영업자A' 처럼 붙여 써도 */
export function unalias(text: string, aliases: Record<string, string> | undefined): string {
  if (!text || !aliases) return text
  let out = text
  for (const k of Object.keys(aliases).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`${k.split(/\s+/).map(escapeRe).join('\\s*')}(?![A-Za-z0-9])`, 'g')
    out = out.replace(re, aliases[k])
  }
  return out
}

/** D-244 답 전체에 unalias */
export function unaliasAnswer(a: AssistAnswer | null, aliases: Record<string, string> | undefined): AssistAnswer | null {
  if (!a || !aliases || Object.keys(aliases).length === 0) return a
  const t = (s: string | undefined) => (s == null ? s : unalias(s, aliases))
  return {
    ...a,
    headline: unalias(a.headline, aliases),
    items: a.items.map((it) => ({ ...it, title: unalias(it.title, aliases), detail: t(it.detail), tag: t(it.tag), when: t(it.when), amount: t(it.amount), body: t(it.body), outline: it.outline?.map((o) => unalias(o, aliases)) })),
    next: a.next?.map((n) => unalias(n, aliases)),
    caution: t(a.caution),
  }
}
