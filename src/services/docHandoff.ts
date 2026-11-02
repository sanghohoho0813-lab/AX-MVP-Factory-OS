/**
 * 새 업체 등록 창에서 넣은 서류 → 업체 상세 '서류 올리기' 로 넘기기 (D-187).
 *
 * 등록 창은 서류를 읽어 칸만 채운다. 업체가 만들어진 뒤 상세 화면이 같은 파일을 받아
 * 서류함에 올리고 회사 정보 · 크레탑 · 명부까지 분석한다 — 이미 읽은 글자는 다시 읽지 않는다.
 *
 * 화면 사이 메모리에만 둔다(저장하지 않는다). 새로 고치면 사라진다 — 그때는 업체 상세에서 다시 올리면 된다.
 */

import type { ReadMethod } from './docAutoFill'

export interface HandoffDoc {
  file: File
  /** 등록 창에서 이미 읽은 글자 — 없으면 받는 쪽이 읽는다 */
  text?: string
  method?: ReadMethod
}

const pending = new Map<string, HandoffDoc[]>()

/** 업체 id 앞으로 서류를 맡긴다(같은 업체에 또 맡기면 뒤에 붙인다) */
export function handDocsTo(clientId: string, docs: readonly HandoffDoc[]): void {
  if (!clientId || docs.length === 0) return
  pending.set(clientId, [...(pending.get(clientId) ?? []), ...docs])
}

/** 맡긴 서류가 있나 — 꺼내지 않는다 */
export function peekHandedDocs(clientId: string): HandoffDoc[] {
  return pending.get(clientId) ?? []
}

/** 맡긴 서류를 꺼낸다(한 번만) */
export function takeHandedDocs(clientId: string): HandoffDoc[] {
  const docs = pending.get(clientId) ?? []
  pending.delete(clientId)
  return docs
}

/*
 * D-498 대화창에 올린 서류 → '새 업체 등록' 창으로(아직 없는 업체). 등록 창이 열리며 꺼내 칸을 채운다 —
 * 등록하면 위와 같은 길(handDocsTo)로 업체 상세 '서류 올리기' 까지 간다. 메모리에만(새로 고치면 사라짐).
 */
let pendingNew: { docs: HandoffDoc[]; at: number } = { docs: [], at: 0 }
/** 넘긴 뒤 이만큼 안에 열린 등록 창만 받는다 — 화면은 바로 넘어가므로 넉넉히 2분(나중에 다른 길로 연 등록 창에 옛 서류가 끼지 않게) */
export const NEW_DOCS_TTL_MS = 120_000

export function handNewClientDocs(docs: readonly HandoffDoc[]): void {
  pendingNew = { docs: [...docs], at: Date.now() }
}

/**
 * 등록 창이 본다 — 꺼내지 않는다(작업공간을 읽는 동안 등록 화면이 두 번 그려져 처음 것이 가져가 버렸다).
 * 등록하면 clearNewClientDocs 로 지운다.
 */
export function peekNewClientDocs(now = Date.now()): HandoffDoc[] {
  return now - pendingNew.at <= NEW_DOCS_TTL_MS ? pendingNew.docs : []
}
export function clearNewClientDocs(): void {
  pendingNew = { docs: [], at: 0 }
}
/** @deprecated 예전 이름 — 보고 바로 지운다 */
export function takeNewClientDocs(): HandoffDoc[] {
  const docs = peekNewClientDocs()
  clearNewClientDocs()
  return docs
}
