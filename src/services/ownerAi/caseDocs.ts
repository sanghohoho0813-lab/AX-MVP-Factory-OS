/**
 * AI-2 업체 서류함 → AI 전략실 자료. 서류함에 올린 서류 중 AI 자료로 읽을 수 있는 칸만(신분증 · 명부 · 인증서 · 건강보험은 뺀다).
 * 첫 화면이 '아직 자료로 안 넣은 서류 N개' 를 알려 주고, 가져오기 창은 그 서류를 미리 골라 둔다(대표가 고를 것을 줄임).
 */
import type { ClientOpsRecord, DocumentState } from '../../types/clientOps'
import type { CaseMaterial, MaterialKind } from './types'

/** 업체 서류함에서 AI 자료로 가져올 수 있는 칸 */
export const DOC_KIND: Record<string, MaterialKind> = {
  businessRegistration: 'bizreg',
  corporateRegistry: 'registry',
  cretopReport: 'company_info',
  financialStatements: 'company_info',
  smeCertificate: 'other',
}

export const FROM_DOCS = '업체 서류함'

export interface CaseDoc {
  key: string
  label: string
  state: DocumentState
}

export function caseDocs(client: Pick<ClientOpsRecord, 'documents' | 'customDocuments'>): CaseDoc[] {
  const custom = new Map(client.customDocuments.filter((d) => !d.sensitive).map((d) => [d.key, d.label]))
  return Object.entries(client.documents)
    .filter(([k, d]) => d.storagePath && (k in DOC_KIND || custom.has(k)))
    .map(([k, d]) => ({ key: k, label: custom.get(k) || d.fileName || k, state: d }))
}

/** 아직 자료로 안 넣은 서류 — 서류함에서 같은 이름으로 가져온 자료가 없으면 */
export function docsNotIn(docs: readonly CaseDoc[], materials: readonly Pick<CaseMaterial, 'source' | 'title'>[]): CaseDoc[] {
  return docs.filter((d) => !materials.some((m) => m.source === FROM_DOCS && m.title === d.label))
}
