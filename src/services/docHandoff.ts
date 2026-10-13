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
