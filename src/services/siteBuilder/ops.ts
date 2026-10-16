/**
 * 홈페이지 고치기 (D-202) — 블록 옮기기 · 복사 · 지우기 · 칸 고치기 · 숨기기 · 꾸밈.
 * 모두 새 문서를 돌려준다(원래 것은 그대로 — 되돌리기가 쉽게).
 */
import { blockDef } from './blocks'
import type { BlockType, ListItem, PropValue, SiteBlock, SiteDoc, SiteSeo, SiteTheme } from './types'

const touch = (doc: SiteDoc, blocks: SiteBlock[], now: string): SiteDoc => ({ ...doc, blocks, updatedAt: now })

/** 위(-1) · 아래(+1)로 한 칸. 맨 위 줄은 늘 맨 위, 맨 아래 줄은 늘 맨 아래 */
export function moveBlock(doc: SiteDoc, id: string, dir: -1 | 1, now: string): SiteDoc {
  const i = doc.blocks.findIndex((b) => b.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= doc.blocks.length) return doc
  const pinned = (t: BlockType) => t === 'header' || t === 'footer'
  if (pinned(doc.blocks[i].type) || pinned(doc.blocks[j].type)) return doc
  const blocks = [...doc.blocks]
  ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
  return touch(doc, blocks, now)
}

export function removeBlock(doc: SiteDoc, id: string, now: string): SiteDoc {
  return touch(
    doc,
    doc.blocks.filter((b) => b.id !== id),
    now,
  )
}

/** 바로 아래에 복사 (맨 위 · 맨 아래 줄은 하나뿐이라 복사하지 않는다) */
export function duplicateBlock(doc: SiteDoc, id: string, newId: string, now: string): SiteDoc {
  const i = doc.blocks.findIndex((b) => b.id === id)
  if (i < 0 || blockDef(doc.blocks[i].type)?.single) return doc
  const src = doc.blocks[i]
  const copy: SiteBlock = JSON.parse(JSON.stringify({ ...src, id: newId }))
  const blocks = [...doc.blocks]
  blocks.splice(i + 1, 0, copy)
  return touch(doc, blocks, now)
}

/**
 * 블록 더하기 — afterId 바로 아래(없으면 맨 아래 줄 바로 위).
 * 맨 위 · 맨 아래 줄은 이미 있으면 더하지 않는다. 맨 위 줄은 맨 위로, 맨 아래 줄은 맨 아래로.
 */
export function insertBlock(doc: SiteDoc, block: SiteBlock, afterId: string | null, now: string): SiteDoc {
  if (blockDef(block.type)?.single && doc.blocks.some((b) => b.type === block.type)) return doc
  const blocks = [...doc.blocks]
  if (block.type === 'header') blocks.unshift(block)
  else if (block.type === 'footer') blocks.push(block)
  else {
    const after = afterId ? blocks.findIndex((b) => b.id === afterId) : -1
    const footerAt = blocks.findIndex((b) => b.type === 'footer')
    let at = after >= 0 ? after + 1 : footerAt >= 0 ? footerAt : blocks.length
    if (blocks[0]?.type === 'header') at = Math.max(at, 1)
    if (footerAt >= 0) at = Math.min(at, footerAt)
    blocks.splice(at, 0, block)
  }
  return touch(doc, blocks, now)
}

/** 칸 하나 고치기 — 고친 칸은 '견본' 표시가 빠진다 */
export function setProp(doc: SiteDoc, id: string, key: string, value: PropValue, now: string): SiteDoc {
  return touch(
    doc,
    doc.blocks.map((b) => {
      if (b.id !== id) return b
      const sample = b.sample?.filter((k) => k !== key)
      const next: SiteBlock = { ...b, props: { ...b.props, [key]: value } }
      if (sample && sample.length) next.sample = sample
      else delete next.sample
      return next
    }),
    now,
  )
}

/** 견본 표시만 지우기 — "업체와 확인했어요" */
export function confirmSample(doc: SiteDoc, id: string, now: string): SiteDoc {
  return touch(
    doc,
    doc.blocks.map((b) => {
      if (b.id !== id) return b
      const next = { ...b }
      delete next.sample
      return next
    }),
    now,
  )
}

export function setHidden(doc: SiteDoc, id: string, where: 'pc' | 'mobile', hidden: boolean, now: string): SiteDoc {
  return touch(
    doc,
    doc.blocks.map((b) => (b.id === id ? { ...b, ...(where === 'pc' ? { hidePc: hidden } : { hideMobile: hidden }) } : b)),
    now,
  )
}

export function setTheme(doc: SiteDoc, patch: Partial<SiteTheme>, now: string): SiteDoc {
  return { ...doc, theme: { ...doc.theme, ...patch }, updatedAt: now }
}

export function setSeo(doc: SiteDoc, patch: Partial<SiteSeo>, now: string): SiteDoc {
  return { ...doc, seo: { ...doc.seo, ...patch }, updatedAt: now }
}

/** 목록 칸 — 한 줄 더하기 · 지우기 · 옮기기 */
export function listAdd(items: ListItem[], template: ListItem, max: number): ListItem[] {
  return items.length >= max ? items : [...items, { ...template }]
}
export function listRemove(items: ListItem[], index: number): ListItem[] {
  return items.filter((_, i) => i !== index)
}
export function listMove(items: ListItem[], index: number, dir: -1 | 1): ListItem[] {
  const j = index + dir
  if (index < 0 || j < 0 || j >= items.length) return items
  const out = [...items]
  ;[out[index], out[j]] = [out[j], out[index]]
  return out
}
export function listSet(items: ListItem[], index: number, key: string, value: string): ListItem[] {
  return items.map((it, i) => (i === index ? { ...it, [key]: value } : it))
}

/** 대표 전화가 없을 때 [담당자 번호 넣기] — 연락처 · 맨 아래 줄 전화 칸에 */
export function withContactPhone(doc: SiteDoc, phone: string, now: string): SiteDoc {
  const p = phone.trim()
  if (!p) return doc
  return touch(
    doc,
    doc.blocks.map((b) => (b.type === 'contact' || b.type === 'footer') && !(typeof b.props.phone === 'string' && b.props.phone.trim()) ? { ...b, props: { ...b.props, phone: p } } : b),
    now,
  )
}
