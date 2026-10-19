/**
 * AI 도우미 답 → 다음 단계(D-241).
 * 대표: "열어보기를 누르면 진짜 뭔가 열리던지 뭔가 기록이 되든지 해야" — 답의 번호(ref)를 무엇으로 이어 줄지 · 할 일로 넣을 때의 글과 기한.
 */
import { normRef } from './context'
import type { AssistItem, AssistStatus, ProviderId } from './client'
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

const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 답의 when(언제) → 할 일 기한. 날짜가 있으면 그날(이미 지났으면 오늘), '내일' 이면 내일, 그 밖은 오늘.
 * 할 일은 기한이 있어야 오늘 · 달력에 보인다(D-210).
 */
export function dueFromWhen(when: string | undefined, today: string): string {
  const w = (when ?? '').trim()
  const m = w.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/)
  if (m) {
    const day = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    return day < today ? today : day
  }
  if (/모레/.test(w)) return addDays(today, 2)
  if (/내일/.test(w)) return addDays(today, 1)
  if (/다음\s*주/.test(w)) return addDays(today, 7)
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
  const cur = p.models.find((m) => m.id === run.model)?.tier ?? 'cheap'
  const want = cur === 'cheap' ? 'standard' : cur === 'standard' ? 'deep' : null
  const m = want ? p.models.find((x) => x.tier === want) : undefined
  return m ? { provider: p.id, model: m.id, label: m.label } : null
}
