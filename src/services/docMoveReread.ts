/**
 * D-489 기타 칸에서 맞는 칸으로 옮긴 서류를 다시 읽는다.
 * 예전에는 '무슨 서류인가요?' 로 사업자등록증 칸에 옮겨도 그 파일을 다시 읽지 않아, 번호 · 설립일이 회사 정보로 가지 않았다
 * (서류 다시 분류 창만 다시 읽었다). 사람이 고른 칸이라 서류 종류는 확실한 것으로 읽는다 — 값 넣기 규칙(검산 · 다른 회사 · 이미 적힌 값과 다르면 묻기)은 그대로.
 * 파일이 클라우드에 있을 때만(이 브라우저에만 저장 중이면 파일 내용이 없다).
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import { readStoredText } from './docStoredText'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { generateId } from '../storage/localStore'

export async function rereadMovedDoc(record: ClientOpsRecord, key: DocumentKey): Promise<{ record: ClientOpsRecord; entered: number } | null> {
  const state = record.documents[key]
  if (!state?.storagePath) return null
  try {
    const { text, method } = await readStoredText(state.storagePath, state.fileName)
    if (text.replace(/\s/g, '').length < 10) return null
    const { analyzeUploadedDocs } = await import('./docAutoAnalyze')
    const out = await analyzeUploadedDocs(record, [{ key, fileName: state.fileName, text, method, docSure: true }], { now: nowIso(), today: todayLocalDate(), makeId: generateId })
    return { record: out.record, entered: out.summary.entered.length }
  } catch {
    return null
  }
}
