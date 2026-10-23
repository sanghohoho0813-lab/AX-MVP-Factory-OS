/**
 * D-271 명세서 재료 — 대표: "명세서 관련 자료들은 다 고객 관리에 넣어져 있거든 · 그거 바탕으로 아이디어를 짜야 되는데 연동이 안 돼 있는 것 같다 ·
 *   자료 넣기를 누르면 파일 첨부뿐만 아니라 GPT 랑 실제로 나눈 대화를 붙일 수 있게".
 *   업체 서류함(고객 관리 › 업체 › 서류)의 파일을 내려받아 글을 읽어 재료로 · 글 붙여넣기 · 파일 올리기 — 셋 다 같은 재료 칸(d.materials)에.
 * 서류 글은 화면에서만 읽고(서버에 원본 파일 · 글을 따로 저장하지 않음 — 서류함 원칙 그대로) 명세서 초안의 재료 칸에만 읽은 글을 남긴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'

/** 업체 서류함에서 재료로 가져올 수 있는 칸 — 신분증 · 명부 · 인증서 · 건강보험 같은 개인 정보 서류는 뺀다(AI 작업실과 같은 기준) */
export const SAFE_DOC_KEYS: readonly string[] = ['businessRegistration', 'corporateRegistry', 'cretopReport', 'financialStatements', 'smeCertificate']

/** 재료 칸의 종류 — 업체 서류에서 온 것 */
export const DOC_MATERIAL_KIND = '업체 서류'
export const PASTE_MATERIAL_KIND = '붙여 넣은 글'

export interface ImportableDoc {
  key: string
  label: string
  fileName: string
}

/** 이 업체 서류함에서 재료로 읽을 수 있는 파일(실제 파일이 올라와 있는 것 · 개인 정보 서류 빼고) */
export function importableDocs(record: ClientOpsRecord | null): ImportableDoc[] {
  if (!record) return []
  const custom = new Map((record.customDocuments ?? []).filter((d) => !d.sensitive).map((d) => [d.key, d.label]))
  return Object.entries(record.documents ?? {})
    .filter(([k, d]) => !!d?.storagePath && (SAFE_DOC_KEYS.includes(k) || custom.has(k)))
    .map(([k, d]) => ({ key: k, label: custom.get(k) || d.fileName || k, fileName: d.fileName || '' }))
}

/** 서류함에 받았다고 표시만 된 것(파일 없음 — 이 기기에만 저장한 경우) 수 */
export function docsWithoutFile(record: ClientOpsRecord | null): number {
  if (!record) return 0
  return Object.values(record.documents ?? {}).filter((d) => d?.received && !d.storagePath).length
}

/**
 * AI 에 보낼 때 재료 한 개의 글 — 길면 앞 1/3 · 뒤 2/3 (GPT 와 나눈 대화는 결론이 끝에 있다).
 * 예전엔 앞 2,240자만 보내 긴 대화의 마지막 정리를 보지 못했다.
 */
export function excerptForAi(text: string, max = 4480): string {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const head = Math.floor(max / 3)
  const tail = max - head - 12
  return `${t.slice(0, head)} …(가운데 줄임)… ${t.slice(t.length - tail)}`
}
