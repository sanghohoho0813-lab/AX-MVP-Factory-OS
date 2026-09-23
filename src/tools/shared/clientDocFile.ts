/**
 * 업체 서류함에 올려 둔 파일을 도구가 바로 읽는다 (D-90).
 *
 * 크레탑 보고서를 서류함에 올려 두었으면, 도구에서 다시 올릴 이유가 없다.
 * 4대보험 명부도 마찬가지다. '이 업체 서류로 분석' 단추 하나면 끝나야 한다.
 *
 * 어떻게: 서류 칸에 저장된 Storage 경로로 5분짜리 서명 URL 을 받아 그 파일을 내려받는다.
 * 파일은 **브라우저 메모리에만** 머문다 — 도구가 읽고 나면 사라진다.
 *
 * 로컬 모드(이 브라우저에만 저장)에는 실제 파일이 없다. 그때는 null 을 돌려주고,
 * 화면은 "서류함에 파일을 올려 두면 여기서 바로 분석합니다" 로 안내한다.
 */

import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { documentFileUrl } from '../../services/clientOpsService'

export interface ClientDocFile {
  file: File
  fileName: string
}

/** 이 업체의 그 서류에 실제 파일이 올라와 있는가 */
export function hasDocFile(record: ClientOpsRecord | null, key: DocumentKey): boolean {
  const state = record?.documents[key]
  return Boolean(state?.storagePath)
}

/** 서류함 파일 이름 (없으면 빈 글자) */
export function docFileName(record: ClientOpsRecord | null, key: DocumentKey): string {
  return record?.documents[key]?.fileName ?? ''
}

/**
 * 서류함 파일을 실제로 가져온다. 없으면 null.
 * 실패하면 사람이 읽을 수 있는 오류를 던진다 — 화면이 그대로 보여 준다.
 */
export async function fetchClientDocFile(record: ClientOpsRecord | null, key: DocumentKey): Promise<ClientDocFile | null> {
  const state = record?.documents[key]
  if (!state?.storagePath) return null
  const url = await documentFileUrl(state.storagePath, state.fileName || undefined)
  if (!url) throw new Error('서류함 파일 주소를 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`서류함 파일을 내려받지 못했습니다 (HTTP ${res.status}).`)
  const blob = await res.blob()
  const fileName = state.fileName || '서류'
  return { file: new File([blob], fileName, { type: blob.type || 'application/octet-stream' }), fileName }
}
