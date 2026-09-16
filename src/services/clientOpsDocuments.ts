/**
 * 서류함 — 기본 10종과 '직접 만든 칸' 을 한 줄로 세우는 곳 (D-82).
 *
 * 기본 10종으로 안 되는 서류가 늘 있다. 법인인감증명서·국세완납증명서·재무제표처럼
 * 기관과 업종에 따라 달라지고, 그때마다 코드를 고칠 수는 없다. 그래서 대표가 칸을 만든다.
 *
 * 만든 칸은 기본 서류와 **똑같이 다룬다** — 받았는지·발급일·메모·파일 첨부·유효기간.
 * 상태는 `record.documents[key]` 에 같이 들어가므로 파일 첨부·서류함 파일 목록·활동 기록이
 * 그대로 따라온다. 화면이 알아야 하는 것은 '이 키의 설명(meta)이 무엇인가' 하나뿐이고,
 * 그것을 여기서 답한다.
 *
 * 순수 함수. 단위 시험으로 고정한다.
 */

import type { DocumentMeta } from '../content/clientOpsCatalog'
import { DOCUMENTS, documentMeta } from '../content/clientOpsCatalog'
import type { ClientOpsRecord, CustomDocument, DocumentKey, DocumentState } from '../types/clientOps'
import { isCustomDocumentKey } from '../types/clientOps'

/** 직접 만든 칸의 키 — 한 번 정해지면 바꾸지 않는다(상태와 파일이 이 키로 붙어 있다) */
export function makeCustomDocumentKey(): DocumentKey {
  const rand = Math.random().toString(36).slice(2, 8)
  return `customdoc_${Date.now().toString(36)}${rand}`
}

/**
 * 직접 만든 칸을 기본 서류와 같은 모양(DocumentMeta)으로 바꾼다.
 * 직접 만든 칸은 늘 파일을 받을 수 있다 — 칸을 만드는 이유의 대부분이 '이 파일을 어디 두지' 다.
 */
export function customDocumentMeta(doc: CustomDocument): DocumentMeta {
  return {
    key: doc.key,
    label: doc.label,
    validMonths: doc.validMonths,
    needsFile: true,
    sensitive: doc.sensitive,
    hint: doc.validMonths === null ? '직접 만든 칸입니다.' : `직접 만든 칸입니다. 유효 ${doc.validMonths}개월.`,
  }
}

/** 이 업체의 서류 전부 — 기본 10종 다음에 직접 만든 칸 */
export function allDocumentMetas(record: Pick<ClientOpsRecord, 'customDocuments'>): DocumentMeta[] {
  return [...DOCUMENTS, ...record.customDocuments.map(customDocumentMeta)]
}

/**
 * 이 키의 설명. 직접 만든 칸이면 그 업체의 정의에서 찾는다.
 *
 * 못 찾으면 기본 서류의 첫 항목으로 떨어지지 않고 **키를 이름으로 쓴 빈 설명**을 준다 —
 * 지워진 칸에 파일이 남아 있을 때 엉뚱하게 '사업자등록증' 으로 보이는 것이 더 나쁘다.
 */
export function documentMetaOf(record: Pick<ClientOpsRecord, 'customDocuments'>, key: DocumentKey): DocumentMeta {
  if (!isCustomDocumentKey(key)) return documentMeta(key)
  const found = record.customDocuments.find((d) => d.key === key)
  if (found) return customDocumentMeta(found)
  return { key, label: '(지운 서류 칸)', validMonths: null, needsFile: true, sensitive: false, hint: '' }
}

/** 아직 아무것도 안 적은 서류 칸 — 직접 만든 칸이 막 생겼을 때 */
export function emptyDocumentState(): DocumentState {
  return { received: false, issuedAt: '', fileName: '', fileSize: 0, storagePath: '', note: '', updatedAt: null }
}
