/**
 * 저장된 홈페이지 읽기 (D-202) — 저장소에서 읽은 것은 믿지 않는다.
 * 모르는 블록 · 모르는 칸은 버리고, 글은 칸 상한으로 자르고, 고르기 칸은 목록에 있는 값만, 꾸밈은 표에 있는 값만.
 */
import { BLOCK_DEFS, blockDef } from './blocks'
import { MAX_IMAGE_CHARS } from './render'
import { CORNERS, FONTS, PALETTES } from './theme'
import { INDUSTRIES } from './industry'
import type { FieldDef, IndustryKey, ListItem, PropValue, SiteBlock, SiteDoc } from './types'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '')

const imageValue = (raw: unknown): string => (typeof raw === 'string' && raw.length <= MAX_IMAGE_CHARS ? raw : '')

function fieldValue(f: FieldDef, raw: unknown): PropValue {
  switch (f.kind) {
    case 'toggle':
      return raw === true
    case 'image':
      return imageValue(raw)
    case 'select': {
      const v = s(raw, 40)
      return f.options?.some((o) => o.value === v) ? v : (f.options?.[0]?.value ?? '')
    }
    case 'list': {
      if (!Array.isArray(raw)) return []
      return raw
        .filter(isObj)
        .slice(0, f.maxItems ?? 12)
        .map((it) => {
          const row: ListItem = {}
          for (const sub of f.itemFields ?? []) row[sub.key] = sub.kind === 'image' ? imageValue(it[sub.key]) : s(it[sub.key], sub.max ?? 200)
          return row
        })
    }
    default:
      return s(raw, f.max ?? 500)
  }
}

export function normalizeBlock(raw: unknown): SiteBlock | null {
  if (!isObj(raw)) return null
  const def = blockDef(String(raw.type))
  const id = s(raw.id, 64)
  if (!def || !id) return null
  const props: Record<string, PropValue> = {}
  const rawProps = isObj(raw.props) ? raw.props : {}
  for (const f of def.fields) props[f.key] = fieldValue(f, rawProps[f.key])
  const sample = Array.isArray(raw.sample) ? raw.sample.filter((k): k is string => typeof k === 'string' && def.fields.some((f) => f.key === k)) : []
  return {
    id,
    type: def.type,
    props,
    ...(raw.hidePc === true ? { hidePc: true } : {}),
    ...(raw.hideMobile === true ? { hideMobile: true } : {}),
    ...(sample.length ? { sample } : {}),
  }
}

/** 저장된 것을 읽어 올바른 홈페이지로 — 아니면 null */
export function normalizeSiteDoc(raw: unknown): SiteDoc | null {
  if (!isObj(raw) || !Array.isArray(raw.blocks)) return null
  const seen = new Set<string>()
  const singles = new Set<string>()
  const blocks: SiteBlock[] = []
  for (const r of raw.blocks.slice(0, 40)) {
    const b = normalizeBlock(r)
    if (!b || seen.has(b.id)) continue
    if (blockDef(b.type)?.single) {
      if (singles.has(b.type)) continue
      singles.add(b.type)
    }
    seen.add(b.id)
    blocks.push(b)
  }
  const theme = isObj(raw.theme) ? raw.theme : {}
  const seo = isObj(raw.seo) ? raw.seo : {}
  const industry = INDUSTRIES.some((i) => i.key === raw.industry) ? (raw.industry as IndustryKey) : 'general'
  return {
    v: 1,
    industry,
    theme: {
      palette: PALETTES.some((p) => p.key === theme.palette) ? (theme.palette as SiteDoc['theme']['palette']) : 'navy',
      font: FONTS.some((f) => f.key === theme.font) ? (theme.font as SiteDoc['theme']['font']) : 'sans',
      corner: CORNERS.some((c) => c.key === theme.corner) ? (theme.corner as SiteDoc['theme']['corner']) : 'round',
    },
    seo: { title: s(seo.title, 80), description: s(seo.description, 200) },
    blocks,
    createdAt: s(raw.createdAt, 40),
    updatedAt: s(raw.updatedAt, 40),
  }
}

/** 그림 data URL 들의 전체 크기(글자 수) — 저장 공간 지키기. 목록 안 그림(사진 모음 · 로고)도 센다(D-207) */
export function imageChars(doc: SiteDoc): number {
  let n = 0
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('data:')) n += v.length
  }
  for (const b of doc.blocks)
    for (const f of blockDef(b.type)?.fields ?? []) {
      if (f.kind === 'image') add(b.props[f.key])
      else if (f.kind === 'list' && f.itemFields?.some((x) => x.kind === 'image')) {
        const items = b.props[f.key]
        if (Array.isArray(items)) for (const it of items) for (const sub of f.itemFields) if (sub.kind === 'image') add(it[sub.key])
      }
    }
  return n
}

/** 한 홈페이지에 올린 그림 전체 상한(약 1.4MB) */
export const MAX_TOTAL_IMAGE_CHARS = 1_900_000

export { BLOCK_DEFS }
