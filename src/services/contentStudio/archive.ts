/**
 * 홍보 글 보관함 (D-203) — 업체마다 만든 글을 남긴다.
 *
 * 저장: 모듈 기록(moduleData) 'content' 상자 — 'items' 갈래(글 한 편 = 한 줄) · 'profile' 갈래(업체마다 고친 칸 한 줄).
 * DB 를 새로 만들지 않는다(이미 있는 module_data 표).
 * 같은 글을 두 번 넣지 않는다(지문 hash). 고쳐서 저장하면 원래 글을 지우지 않고 새 판(version)을 같은 사슬(rootId)에 단다.
 */
import { AD_TYPES, CONTENT_KINDS, plainText, type AdType, type BlogType, type ContentKind, type DraftBlock, type KakaoPurpose, type ShortLen, type TopicType } from './generate'
import type { Tone } from './tone'

export const CONTENT_MODULE = 'content'
export const ITEMS_BUCKET = 'items'
export const PROFILE_BUCKET = 'profile'

export interface ContentItem {
  id: string
  kind: ContentKind
  title: string
  blocks: DraftBlock[]
  input: { keyword?: string; topicType?: TopicType; topicTitle?: string; pages?: 5 | 7; purpose?: KakaoPurpose; variant: number; tone: Tone; blogType?: BlogType; shortLen?: ShortLen; adType?: AdType }
  /** 처음 글의 id — 고친 판은 모두 같은 rootId */
  rootId: string
  version: number
  favorite: boolean
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
      return { item: { ...sorted[0], favorite: list.some((x) => x.favorite) }, versions: list.length }
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
  return { ...base, id, blocks, version, hash: contentHash(base.kind, blocks), favorite: false, createdAt: now, updatedAt: now }
}
