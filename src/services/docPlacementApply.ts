/**
 * 서류 칸 정하기 → 실제 칸(있는 칸 · 새 칸 · 번호 붙은 칸) (D-146).
 *
 * 서류 칸 하나에는 파일 하나다. 그래서 예전에는 폴더째 올릴 때 같은 칸으로 간 파일들이 서로를 덮어 '올렸는데 없는' 파일이 생겼다.
 * 이제는 덮지 않는다 — 그 칸에 이미 파일이 있거나 이번에 이미 넣었으면 '사업자등록증 (2)' 칸을 만들어 따로 둔다.
 * 사람이 미리보기로 보고 최신 것만 남기고 지운다.
 */
import type { ClientOpsRecord, DocumentKey, DocumentState } from '../types/clientOps'
import { allDocumentMetas } from './clientOpsDocuments'
import { withCustomDocument } from './clientOpsService'
import type { DocPlacement } from './docClassify'

const compact = (s: string) => s.replace(/[\s·ㆍ]/g, '')

function hasFile(record: ClientOpsRecord, key: DocumentKey): boolean {
  const d = record.documents[key]
  return Boolean(d && (d.fileName || d.storagePath))
}

/** 같은 이름(번호 무시)의 칸 중 비어 있는 것 */
function emptyCellNamed(record: ClientOpsRecord, label: string, used: ReadonlySet<string>): DocumentKey | null {
  const base = compact(label)
  for (const m of allDocumentMetas(record)) {
    if (!m.needsFile || used.has(m.key) || hasFile(record, m.key)) continue
    if (compact(m.label.replace(/\s*\(\d+\)$/, '')) === base) return m.key
  }
  return null
}

function nextNumberedLabel(record: ClientOpsRecord, label: string): string {
  const names = new Set(allDocumentMetas(record).map((m) => compact(m.label)))
  for (let n = 2; n < 100; n += 1) {
    const l = `${label} (${n})`
    if (!names.has(compact(l))) return l
  }
  return `${label} (${Date.now() % 1000})`
}

/**
 * 칸 정하기 결과 → 이 기록에서 쓸 칸(필요하면 만든다).
 * `used` 는 이번 묶음에서 이미 파일을 넣은 칸 — 같은 묶음 안에서도 덮지 않는다.
 */
export function cellForPlacement(record: ClientOpsRecord, p: DocPlacement, used: Set<string>): { record: ClientOpsRecord; key: DocumentKey; label: string; numbered: boolean } {
  let rec = record
  if (p.kind === 'existing' && !used.has(p.key) && !hasFile(rec, p.key)) {
    used.add(p.key)
    return { record: rec, key: p.key, label: p.label, numbered: false }
  }
  const label = p.label
  const empty = emptyCellNamed(rec, label, used)
  if (empty) {
    used.add(empty)
    return { record: rec, key: empty, label: allDocumentMetas(rec).find((m) => m.key === empty)?.label ?? label, numbered: false }
  }
  const taken = allDocumentMetas(rec).some((m) => compact(m.label.replace(/\s*\(\d+\)$/, '')) === compact(label))
  const finalLabel = taken ? nextNumberedLabel(rec, label) : label
  rec = withCustomDocument(rec, { label: finalLabel })
  const key = rec.customDocuments[rec.customDocuments.length - 1].key
  used.add(key)
  return { record: rec, key, label: finalLabel, numbered: taken }
}

/* ------------------------------------------------------------------ */
/* 서류 다시 분류 — 이미 올려 둔 파일을 제목으로 다시 가른다              */
/* ------------------------------------------------------------------ */

export interface ResortItem {
  /** 지금 들어 있는 칸 */
  fromKey: DocumentKey
  fromLabel: string
  fileName: string
  placement: DocPlacement
  /** 옮길 만한가 — 제목이 칸 이름과 다를 때만(근거 없이 옮기지 않는다) */
  move: boolean
  why: string
}

const baseLabel = (l: string) => compact(l.replace(/\s*\(\d+\)$/, '').replace(/^기타·?확인필요.*$/, '기타확인필요'))

/** 칸 하나와 그 파일의 판정 → 옮길지 */
export function resortDecision(fromKey: DocumentKey, fromLabel: string, fileName: string, placement: DocPlacement): ResortItem {
  const base = { fromKey, fromLabel, fileName, placement }
  // 근거 없는 판정(기타 · 확인 필요)으로는 옮기지 않는다 — 사람이 둔 칸을 존중
  if (placement.kind === 'new' && placement.label.startsWith('기타')) return { ...base, move: false, why: '제목을 찾지 못해 그대로 둠' }
  if (placement.kind === 'existing' && placement.key === fromKey) return { ...base, move: false, why: '맞는 칸' }
  const to = placement.label
  if (baseLabel(to) === baseLabel(fromLabel)) return { ...base, move: false, why: '맞는 칸' }
  return { ...base, move: true, why: `${placement.reason} → '${to}' 칸으로` }
}

/**
 * 고른 것을 옮긴다 — 옛 칸은 비우고(직접 만든 칸이 비면 칸도 없앤다) 새 칸에 파일 정보를 그대로.
 * 먼저 옮길 파일을 모두 빼낸 뒤 넣는다 — 중소기업 확인서 칸에 든 졸업증명서와 기타 칸에 든 중소기업 확인서를 서로 바꿀 때
 * 순서 때문에 '(2)' 칸이 생기지 않게.
 * 파일 자체(보관함)는 건드리지 않는다 — 경로만 옮긴다.
 */
export function applyResort(
  record: ClientOpsRecord,
  moves: readonly ResortItem[],
  ops: {
    withDoc: (r: ClientOpsRecord, key: DocumentKey, patch: Partial<DocumentState>) => ClientOpsRecord
    withoutCustom: (r: ClientOpsRecord, id: string) => ClientOpsRecord
  },
): { record: ClientOpsRecord; moved: { fileName: string; from: string; to: string; key: DocumentKey; fromKey: DocumentKey }[] } {
  let rec = record
  const taken: { m: ResortItem; state: DocumentState }[] = []
  for (const m of moves) {
    const state = rec.documents[m.fromKey]
    if (!state || !(state.fileName || state.storagePath)) continue
    taken.push({ m, state })
    rec = ops.withDoc(rec, m.fromKey, { received: false, fileName: '', fileSize: 0, storagePath: '', issuedAt: '', note: '' })
  }
  const used = new Set<string>()
  const moved: { fileName: string; from: string; to: string; key: DocumentKey; fromKey: DocumentKey }[] = []
  for (const { m, state } of taken) {
    const cell = cellForPlacement(rec, m.placement, used)
    rec = ops.withDoc(cell.record, cell.key, {
      received: true,
      fileName: state.fileName,
      fileSize: state.fileSize,
      storagePath: state.storagePath,
      issuedAt: m.placement.issuedAt ?? state.issuedAt,
      note: state.note,
    })
    moved.push({ fileName: state.fileName, from: m.fromLabel, to: cell.label, key: cell.key, fromKey: m.fromKey })
  }
  // 비어 버린 직접 만든 칸은 없앤다(받음만 적은 칸은 남긴다 — 이번에 옮긴 칸만)
  for (const { m } of taken) {
    const custom = rec.customDocuments.find((d) => d.key === m.fromKey)
    if (custom && !used.has(m.fromKey) && !hasFile(rec, m.fromKey)) rec = ops.withoutCustom(rec, custom.id)
  }
  return { record: rec, moved }
}

/**
 * 칸에서 파일 지우기 — 겹쳐 올린 서류 중 최신 것만 남길 때.
 * 직접 만든 칸(번호 붙은 칸 · 제목으로 만든 칸 · 기타)은 칸도 없앤다. 기본 칸은 '안 받음' 으로 돌아간다.
 * 보관함의 파일 자체는 지우지 않는다(되돌릴 수 없는 삭제는 하지 않는다) — 이 업체 서류함에서만 빠진다.
 */
export function withoutDocumentFile(
  record: ClientOpsRecord,
  key: DocumentKey,
  ops: {
    withDoc: (r: ClientOpsRecord, key: DocumentKey, patch: Partial<DocumentState>) => ClientOpsRecord
    withoutCustom: (r: ClientOpsRecord, id: string) => ClientOpsRecord
  },
): ClientOpsRecord {
  let rec = ops.withDoc(record, key, { received: false, fileName: '', fileSize: 0, storagePath: '', issuedAt: '', note: '' })
  const custom = rec.customDocuments.find((d) => d.key === key)
  if (custom) rec = ops.withoutCustom(rec, custom.id)
  return rec
}
