/**
 * L-41 · D-652 업체 대표가 올리기 링크로 보낸 파일 → 이 업체 서류함 칸으로.
 *
 * 서류 올리기(D-144)와 같은 길을 쓴다 — 칸 정하기(cellForPlacement: 덮지 않고 '(2)' 칸) → 받음 · 파일 → 글자 읽어 회사 정보 채우기
 * (analyzeUploadedDocs: 검산 · 다른 회사 · 이미 적힌 값과 다르면 묻기 그대로).
 *  - 업체 대표가 고른 칸이 있으면 그 칸(서류 종류 확실) · '그 밖의 서류' 면 글자 · 이름으로 칸을 정한다(못 정하면 '기타 · 확인 필요').
 *  - 파일은 이미 보관함에 있다 — 다시 올리지 않고 경로만 칸에 건다.
 *  - 저장은 하지 않는다(부르는 쪽이 그때의 최신 기록에 얹어 저장).
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import type { UploadedFile } from './uploadLink'
import { allDocumentMetas } from './clientOpsDocuments'
import { withDocument } from './clientOpsService'
import { cellForPlacement } from './docPlacementApply'
import { OTHER_DOC_LABEL, placeDocument, type DocPlacement } from './docClassify'
import { readStoredText } from './docStoredText'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { generateId } from '../storage/localStore'
import type { ReadMethod } from './docAutoFill'

/** 서류함 폴더 보기에서 모아 보이는 이름 */
export const UPLOAD_LINK_FOLDER = '고객이 올린 서류'

/** 칸 정하기 — 고른 칸(있으면) > 업체 대표가 고른 칸 > 글자 · 이름으로 */
export function placementForUpload(
  record: Pick<ClientOpsRecord, 'customDocuments'>,
  file: Pick<UploadedFile, 'docKey' | 'docLabel' | 'fileName'>,
  read: { text: string },
  chosenKey?: DocumentKey | '',
): DocPlacement {
  const metas = allDocumentMetas(record)
  const pick = chosenKey || file.docKey
  const hit = pick ? metas.find((m) => m.key === pick) : undefined
  if (hit) {
    // 사람이 고른 칸 — 발급일 · 유효기간 끝은 글자에서만 가져온다(칸은 그대로)
    const fromText = read.text ? placeDocument({ text: read.text, fileName: file.fileName }, metas) : null
    return {
      kind: 'existing',
      key: hit.key,
      label: hit.label,
      sure: true,
      reason: chosenKey ? '직접 고른 칸' : '업체 대표가 고른 칸',
      issuedAt: fromText?.issuedAt ?? null,
      validUntil: fromText?.validUntil ?? null,
    }
  }
  if (read.text || file.fileName) return placeDocument({ text: read.text, fileName: file.fileName }, metas)
  return { kind: 'new', label: OTHER_DOC_LABEL, sure: false, reason: '제목을 찾지 못함', issuedAt: null }
}

/** 칸에 넣은 기록 · 넣은 칸 · 회사 정보 채운 수 */
export function withUploadedFile(
  record: ClientOpsRecord,
  file: UploadedFile,
  placement: DocPlacement,
): { record: ClientOpsRecord; key: DocumentKey; label: string } {
  const cell = cellForPlacement(record, placement, new Set())
  const next = withDocument(cell.record, cell.key, {
    received: true,
    fileName: file.fileName,
    fileSize: file.fileSize,
    storagePath: file.storagePath,
    issuedAt: placement.issuedAt ?? '',
    validUntil: placement.validUntil ?? undefined,
    folderPath: UPLOAD_LINK_FOLDER,
  })
  return { record: next, key: cell.key, label: cell.label }
}

/**
 * 파일 하나를 칸에 넣고 글자를 읽어 회사 정보까지 — 클라우드에서만(파일 글자는 보관함에서 받아 읽는다).
 * 읽기가 안 되면 칸에만 넣는다(파일 이름으로 칸을 정한다).
 */
export async function placeUploadedFile(
  record: ClientOpsRecord,
  file: UploadedFile,
  chosenKey?: DocumentKey | '',
): Promise<{ record: ClientOpsRecord; key: DocumentKey; label: string; entered: number }> {
  let read: { text: string; method: ReadMethod } = { text: '', method: 'none' }
  try {
    read = await readStoredText(file.storagePath, file.fileName)
  } catch {
    // 못 읽으면 칸만
  }
  const placement = placementForUpload(record, file, read, chosenKey)
  const put = withUploadedFile(record, file, placement)
  if (read.text.replace(/\s/g, '').length < 10) return { ...put, entered: 0 }
  try {
    const { analyzeUploadedDocs } = await import('./docAutoAnalyze')
    const out = await analyzeUploadedDocs(put.record, [{ key: put.key, fileName: file.fileName, text: read.text, method: read.method, docSure: placement.sure }], {
      now: nowIso(),
      today: todayLocalDate(),
      makeId: generateId,
    })
    return { record: out.record, key: put.key, label: put.label, entered: out.summary.entered.length }
  } catch {
    return { ...put, entered: 0 }
  }
}
