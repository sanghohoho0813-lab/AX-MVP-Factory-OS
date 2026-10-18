/**
 * 홍보 글 보관함 (D-203) — 업체마다 만든 글을 남긴다.
 *
 * 저장: 모듈 기록(moduleData) 'content' 상자 — 'items' 갈래(글 한 편 = 한 줄) · 'profile' 갈래(업체마다 고친 칸 한 줄).
 * DB 를 새로 만들지 않는다(이미 있는 module_data 표).
 * 같은 글을 두 번 넣지 않는다(지문 hash). 고쳐서 저장하면 원래 글을 지우지 않고 새 판(version)을 같은 사슬(rootId)에 단다.
 */
import { AD_TYPES, AD_TYPE_LABEL, CONTENT_KINDS, KIND_LABEL, TOPIC_LABEL, plainText, type AdType, type ContentKind, type DraftBlock, type DraftInput, type KakaoPurpose, type TopicType } from './generate'
import { SITUATION_KEYS } from './situations'
import { ANGLE_IDS, ANGLE_LABEL, type AngleId } from './angles'

export const CONTENT_MODULE = 'content'
export const ITEMS_BUCKET = 'items'
export const PROFILE_BUCKET = 'profile'

export interface ContentItem {
  id: string
  kind: ContentKind
  title: string
  blocks: DraftBlock[]
  input: DraftInput
  /** 처음 글의 id — 고친 판은 모두 같은 rootId */
  rootId: string
  version: number
  favorite: boolean
  /** D-208 올렸어요 — 업체가 실제로 올린 때(ISO). 없으면 아직 */
  postedAt?: string
  /** D-230 올린 뒤 숫자(규칙집 머리말 · 6장 — 실제로 잘 됐는지는 조회 · 저장 · 문의 기록으로 본다) */
  stats?: ContentStats
  hash: string
  createdAt: string
  updatedAt: string
}

/** 글 지문(FNV-1a 32비트) — 같은 종류 · 같은 글이면 같다 */
export function contentHash(kind: ContentKind, blocks: readonly DraftBlock[]): string {
  const s = `${kind}\u0000${plainText(kind, blocks)}`
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** D-230 올린 뒤 숫자 — 사람이 적은 것만(채널 화면에서 본 숫자) */
export interface ContentStats {
  views?: number
  saves?: number
  inquiries?: number
  /** 적은 때(ISO) */
  at: string
}

/** 숫자 칸 읽기 — 0 이상 정수만(10억 미만) */
export function normalizeStats(raw: unknown): ContentStats | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.floor(v) : undefined)
  const out: ContentStats = { at: typeof r.at === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.at) ? r.at.slice(0, 40) : '' }
  for (const k of ['views', 'saves', 'inquiries'] as const) {
    const n = num(r[k])
    if (n !== undefined) out[k] = n
  }
  return out.views === undefined && out.saves === undefined && out.inquiries === undefined ? null : out
}

const TOPICS: TopicType[] = ['tips', 'choose', 'faq', 'intro', 'case', 'season']
const PURPOSES: KakaoPurpose[] = ['news', 'event', 'season', 'thanks']

/** 저장된 줄 → 글 한 편(모르는 칸 · 망가진 값은 버린다) */
export function normalizeItem(id: string, raw: unknown, createdAt = '', updatedAt = ''): ContentItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.kind !== 'string' || !(CONTENT_KINDS as string[]).includes(r.kind)) return null
  const kind = r.kind as ContentKind
  const blocks: DraftBlock[] = Array.isArray(r.blocks)
    ? r.blocks
        .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
        .map((b) => ({
          label: typeof b.label === 'string' ? b.label.slice(0, 200) : '',
          text: typeof b.text === 'string' ? b.text.slice(0, 8000) : '',
          ...(typeof b.hint === 'string' && b.hint ? { hint: b.hint.slice(0, 120) } : {}),
        }))
        .filter((b) => b.label || b.text)
        .slice(0, 40)
    : []
  if (!blocks.length) return null
  const inp = (r.input && typeof r.input === 'object' ? r.input : {}) as Record<string, unknown>
  const input: ContentItem['input'] = {
    variant: typeof inp.variant === 'number' && Number.isFinite(inp.variant) ? Math.max(0, Math.floor(inp.variant)) : 0,
    tone: inp.tone === 'formal' ? 'formal' : 'friendly',
    ...(typeof inp.keyword === 'string' && inp.keyword ? { keyword: inp.keyword.slice(0, 60) } : {}),
    ...(typeof inp.topicType === 'string' && (TOPICS as string[]).includes(inp.topicType) ? { topicType: inp.topicType as TopicType } : {}),
    ...(typeof inp.topicTitle === 'string' && inp.topicTitle ? { topicTitle: inp.topicTitle.slice(0, 120) } : {}),
    ...(inp.pages === 5 || inp.pages === 7 ? { pages: inp.pages } : {}),
    ...(typeof inp.purpose === 'string' && (PURPOSES as string[]).includes(inp.purpose) ? { purpose: inp.purpose as KakaoPurpose } : {}),
    // D-207
    ...(inp.blogType === 'brand' || inp.blogType === 'review' ? { blogType: inp.blogType } : {}),
    ...(inp.shortLen === '20-30' || inp.shortLen === '30-60' ? { shortLen: inp.shortLen } : {}),
    ...(typeof inp.adType === 'string' && (AD_TYPES as string[]).includes(inp.adType) ? { adType: inp.adType as AdType } : {}),
    // D-208
    ...(typeof inp.situation === 'string' && (SITUATION_KEYS as string[]).includes(inp.situation) ? { situation: inp.situation } : {}),
    ...(typeof inp.planDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inp.planDate) ? { planDate: inp.planDate } : {}),
    // D-221
    ...(typeof inp.planStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inp.planStart) && (inp.planPer === 2 || inp.planPer === 4) ? { planStart: inp.planStart, planPer: inp.planPer } : {}),
    // D-230
    ...(typeof inp.angle === 'string' && (ANGLE_IDS as string[]).includes(inp.angle) ? { angle: inp.angle as AngleId } : {}),
  }
  return {
    id,
    kind,
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 120) : '제목 없음',
    blocks,
    input,
    rootId: typeof r.rootId === 'string' && r.rootId ? r.rootId : id,
    version: typeof r.version === 'number' && r.version >= 1 ? Math.floor(r.version) : 1,
    favorite: r.favorite === true,
    ...(typeof r.postedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.postedAt) ? { postedAt: r.postedAt.slice(0, 40) } : {}),
    ...(normalizeStats(r.stats) ? { stats: normalizeStats(r.stats) as ContentStats } : {}),
    hash: typeof r.hash === 'string' && r.hash ? r.hash : contentHash(kind, blocks),
    createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : createdAt,
    updatedAt: updatedAt || createdAt,
  }
}

/** 줄로 저장할 모양 */
export function itemData(item: ContentItem): Record<string, unknown> {
  const { id: _id, updatedAt: _u, ...rest } = item
  return rest
}

/** 사슬마다 가장 새 판 하나 + 판 수 — 즐겨찾기 먼저, 그다음 최근 순 */
export function latestByRoot(items: readonly ContentItem[]): { item: ContentItem; versions: number }[] {
  const byRoot = new Map<string, ContentItem[]>()
  for (const it of items) byRoot.set(it.rootId, [...(byRoot.get(it.rootId) ?? []), it])
  return [...byRoot.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))
      const posted = list.map((x) => x.postedAt).filter((x): x is string => !!x).sort().pop()
      // D-230 숫자도 사슬 전체에서 가장 나중에 적은 것
      const stats = list.map((x) => x.stats).filter((x): x is ContentStats => !!x).sort((a, b) => a.at.localeCompare(b.at)).pop()
      return { item: { ...sorted[0], favorite: list.some((x) => x.favorite), ...(posted ? { postedAt: posted } : {}), ...(stats ? { stats } : {}) }, versions: list.length }
    })
    .sort((a, b) => Number(b.item.favorite) - Number(a.item.favorite) || b.item.createdAt.localeCompare(a.item.createdAt))
}

/** 같은 업체에 같은 글이 이미 있나 */
export function sameContent(items: readonly ContentItem[], kind: ContentKind, blocks: readonly DraftBlock[]): ContentItem | null {
  const h = contentHash(kind, blocks)
  return items.find((x) => x.hash === h && x.kind === kind) ?? null
}

/** 고친 글로 새 판 만들기(원래 글은 그대로) */
export function nextVersion(items: readonly ContentItem[], base: ContentItem, blocks: DraftBlock[], id: string, now: string): ContentItem {
  const chain = items.filter((x) => x.rootId === base.rootId)
  const version = Math.max(base.version, ...chain.map((x) => x.version)) + 1
  return { ...base, id, title: titleOf(blocks, base.title), blocks, version, hash: contentHash(base.kind, blocks), favorite: false, createdAt: now, updatedAt: now }
}

/**
 * D-221 보관함 제목 = 글 안 '제목' 칸(블로그 · 긴 영상). 예전에는 처음 만든 제목을 그대로 둬서
 * 제목 칸을 고치거나 [대괄호]를 채워 저장해도 목록에는 옛 제목 · 대괄호가 남았다. 제목 칸이 없는 글은 그대로.
 */
export function titleOf(blocks: readonly DraftBlock[], fallback: string): string {
  const t = (blocks.find((b) => b.hint?.startsWith('제목'))?.text ?? '').split('\n')[0].trim()
  return t ? t.slice(0, 120) : fallback
}

/** D-208 계획 칸 하나의 형편 — 만든 글(사슬의 새 판) · 올렸는지 */
export interface PlanSlotState {
  item: ContentItem | null
  posted: boolean
}

/** 계획 칸마다 보관함에서 같은 날 · 같은 형식 글을 찾는다 */
export function planSlotStates(slots: readonly { date: string; kind: ContentKind }[], items: readonly ContentItem[]): PlanSlotState[] {
  const latest = latestByRoot(items).map((r) => r.item)
  const used = new Set<string>()
  return slots.map((sl) => {
    const it = latest.find((x) => x.input.planDate === sl.date && x.kind === sl.kind && !used.has(x.rootId)) ?? null
    if (it) used.add(it.rootId)
    return { item: it, posted: !!it?.postedAt }
  })
}

const PLAN_DOW = ['일', '월', '화', '수', '목', '금', '토']

/**
 * D-237 한 달 계획 [모두 복사] — 올릴 날 순서로 '날짜 — 형식 — 제목' 과 본문(복사할 글 모양 그대로), 글 사이는 줄로 나눈다.
 * 본문이 없으면 머리 줄만. 같은 날은 계획에 적힌 순서 그대로.
 */
export function planCopyText(rows: readonly { date: string; kind: ContentKind; title: string; blocks?: readonly DraftBlock[] | null }[]): string {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.date.localeCompare(b.r.date) || a.i - b.i)
    .map(({ r }) => {
      const [, m, d] = r.date.split('-').map(Number)
      const dow = PLAN_DOW[new Date(`${r.date}T00:00:00Z`).getUTCDay()] ?? ''
      const head = `${m}/${d} (${dow}) — ${KIND_LABEL[r.kind]} — ${r.title.trim()}`
      const body = r.blocks?.length ? plainText(r.kind, r.blocks) : ''
      return body ? `${head}\n\n${body}` : head
    })
    .join('\n\n────────\n\n')
}

/** 올렸어요 / 아직 — 사슬 전체에 같은 표시(새 판을 만들어도 남게) */
export function withPosted(items: readonly ContentItem[], rootId: string, at: string | null): ContentItem[] {
  return items
    .filter((x) => x.rootId === rootId)
    .map((x) => {
      const { postedAt: _p, ...rest } = x
      return at ? { ...rest, postedAt: at } : rest
    })
}

/** D-230 올린 뒤 숫자 — 사슬 전체에 같은 값(새 판을 만들어도 남게). null 이면 지운다 */
export function withStats(items: readonly ContentItem[], rootId: string, stats: ContentStats | null): ContentItem[] {
  return items
    .filter((x) => x.rootId === rootId)
    .map((x) => {
      const { stats: _s, ...rest } = x
      return stats ? { ...rest, stats } : rest
    })
}

/** 무엇을 기준으로 묶었나 — 제목 각도가 있으면 각도, 카드는 유형, 그 밖은 주제 · 형식 */
export function perfKey(item: ContentItem): { key: string; label: string } {
  if (item.input.angle) return { key: `angle:${item.input.angle}`, label: `제목 각도 · ${ANGLE_LABEL[item.input.angle]}` }
  if (item.kind === 'cards' && item.input.adType) return { key: `ad:${item.input.adType}`, label: `카드뉴스 · ${AD_TYPE_LABEL[item.input.adType]}` }
  if (item.input.topicType) return { key: `topic:${item.kind}:${item.input.topicType}`, label: `${KIND_LABEL[item.kind]} · ${TOPIC_LABEL[item.input.topicType]}` }
  return { key: `kind:${item.kind}`, label: KIND_LABEL[item.kind] }
}

export interface PerfRow {
  key: string
  label: string
  /** 숫자를 적은 글 수 */
  n: number
  views: number
  saves: number
  inquiries: number
}

/**
 * D-230 '무엇이 잘 됐나' — 숫자를 적은 글만, 각도 · 유형별로 더해서 문의 → 저장 → 조회 순.
 * 규칙집 머리말: 생성만으로는 잘 되는지 알 수 없다 — 올린 뒤 기록으로 본다.
 */
export function performanceBy(items: readonly ContentItem[]): PerfRow[] {
  const rows = new Map<string, PerfRow>()
  for (const { item } of latestByRoot(items)) {
    if (!item.stats) continue
    const k = perfKey(item)
    const r = rows.get(k.key) ?? { key: k.key, label: k.label, n: 0, views: 0, saves: 0, inquiries: 0 }
    r.n += 1
    r.views += item.stats.views ?? 0
    r.saves += item.stats.saves ?? 0
    r.inquiries += item.stats.inquiries ?? 0
    rows.set(k.key, r)
  }
  return [...rows.values()].sort((a, b) => b.inquiries - a.inquiries || b.saves - a.saves || b.views - a.views || a.label.localeCompare(b.label))
}
