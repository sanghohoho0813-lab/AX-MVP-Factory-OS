/**
 * 보관함(client-documents)에 이미 있는 파일의 글자 읽기 (D-146 · D-148).
 * 서명 주소로 받아 PDF 글자 · 글자 파일 · 엑셀 · 사진(OCR)을 읽는다. 클라우드가 아니거나 못 읽으면 빈 글자 —
 * 부르는 쪽은 파일 이름으로 판별한다. 읽은 글자는 저장하지 않는다.
 */
import { canExtractText, extractTextFromFile } from './docTextExtract'
import { canUploadFiles, documentFileUrl } from './clientOpsService'
import type { ReadMethod } from './docAutoFill'

export async function readStoredText(storagePath: string, fileName: string): Promise<{ text: string; method: ReadMethod }> {
  if (!canUploadFiles() || !storagePath) return { text: '', method: 'none' }
  try {
    const url = await documentFileUrl(storagePath)
    if (!url) return { text: '', method: 'none' }
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], fileName || 'file', { type: blob.type })
    if (!canExtractText(file)) return { text: '', method: 'none' }
    const res = await extractTextFromFile(file)
    return { text: res.text, method: res.method }
  } catch {
    return { text: '', method: 'none' }
  }
}
