/**
 * 채널 설계 기준 줄 · 스레드 · 릴스 [AI로 완성 글 쓰기] 자료 덧붙이기 — 마케팅 AI 자료 묶음(marketingBuilders · 홍보 글 규칙까지)과 떼어,
 * 쓰기 화면이 처음 그릴 때 그 묶음을 받지 않게 했다(D-646). marketingBuilders 가 그대로 다시 내보낸다.
 */
import { safeText } from './context'
import { AI_BRIEF_KEYS, BRIEF_FIELDS } from '../marketing/radarStore'
import type { ChannelBrief } from '../marketing/radarStore'

/**
 * D-347 채널 설계 기준 줄 — 칸 글이 길면(최대 800자) 문장 끝에서 290자 안쪽으로 나눠 '(이어서)' 줄로.
 * 서버가 칸 하나를 300자에서 자르므로 한 칸에 다 담으면 뒤가 잘린다. 롱폼 · 쇼츠 · 스레드 · 영상 창이 같은 줄을 쓴다.
 */
export function briefRows(brief: ChannelBrief): { 항목: string; 기준: string }[] {
  const out: { 항목: string; 기준: string }[] = []
  // D-633 업을 알려 주는 칸만(AI_BRIEF_KEYS) — 말투 · 형식 · 끝맺음 · 접목 원칙은 AI 에 보내지 않는다(성공 공식대로 자유롭게)
  for (const f of BRIEF_FIELDS.filter((x) => AI_BRIEF_KEYS.includes(x.key))) {
    const text = safeText(brief[f.key], [], 800)
    if (!text) continue
    const parts: string[] = []
    let rest = text
    while (rest.length > 290) {
      const cut = Math.max(rest.lastIndexOf('. ', 290), rest.lastIndexOf(' / ', 290), rest.lastIndexOf(' · ', 290))
      const at = cut > 120 ? cut + 1 : 290
      parts.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) parts.push(rest)
    parts.forEach((p, i) => out.push({ 항목: i ? `${f.label}(이어서)` : f.label, 기준: p }))
  }
  return out
}
export const briefSection = (brief: ChannelBrief) => ({ name: '채널 설계 기준(이 사람의 업 — 이해용 · 주제 · 형식은 자유)', rows: briefRows(brief) })

/**
 * D-558 스레드 · 릴스 [AI로 완성 글 쓰기] — 화면이 만든 자료에 내 채널 설계 기준(본업 · 확인된 사실 · 말 원칙)을 맨 앞에,
 * 요청 한 줄을 두 번째에 붙인다([자료 · 요청] — 서버 지시문이 먼저 따른다). 요청이 비면 붙이지 않는다.
 */
export function withWriteExtras<T extends { sections: { name: string; rows: unknown[] }[] }>(
  ctx: T,
  extra: { brief?: ChannelBrief | null; request?: string; revise?: { body: string; fixes: readonly string[] } | null },
): T {
  const req = (extra.request ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  const [first, ...rest] = ctx.sections
  // D-559 [고칠 곳만 AI로 고쳐 쓰기] — 지금 글을 한 줄씩(서버가 칸 안 줄바꿈을 없애므로) + 점수에서 뺀 곳
  const lines = (extra.revise?.body ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())
  const reviseRows = lines.some(Boolean) ? lines.slice(0, 80).map((l) => ({ 줄: l || '(빈 줄)' })) : []
  const fixRows = (extra.revise?.fixes ?? []).filter((f) => f.trim()).slice(0, 8).map((f) => ({ 고칠곳: f.trim() }))
  const sections = [
    ...(extra.brief ? [briefSection(extra.brief)] : []),
    ...(first ? [first] : []),
    ...(req ? [{ name: '요청', rows: [{ 요청: req }] }] : []),
    ...(reviseRows.length ? [{ name: '고칠 글', rows: reviseRows }, { name: '고칠 곳', rows: fixRows.length ? fixRows : [{ 고칠곳: '읽기 쉽게 다듬기' }] }] : []),
    ...rest,
  ]
  return { ...ctx, sections }
}
