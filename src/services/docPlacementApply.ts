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
import { OTHER_DOC_LABEL, knownDocValidMonths, type DocPlacement } from './docClassify'

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
  // D-148: 이름이 비면 기타 칸 — 빈 이름으로는 칸이 안 만들어져 엉뚱한 칸 키를 집었다
  const label = p.label.trim() || OTHER_DOC_LABEL
  const empty = emptyCellNamed(rec, label, used)
  if (empty) {
    used.add(empty)
    return { record: rec, key: empty, label: allDocumentMetas(rec).find((m) => m.key === empty)?.label ?? label, numbered: false }
  }
  const taken = allDocumentMetas(rec).some((m) => compact(m.label.replace(/\s*\(\d+\)$/, '')) === compact(label))
  const finalLabel = taken ? nextNumberedLabel(rec, label) : label
  // D-147: 알려진 서류면 유효기간도 함께(인감 3개월 · 납세 30일 …) — 만료 알림이 바로 걸린다
  // D-209: '법인등기부등본 (2)' 처럼 기본 칸의 번호 칸이면 그 기본 칸의 유효기간을 그대로(예전에는 비어 만료를 안 봤다)
  const sameBase = allDocumentMetas(rec).find((m) => compact(m.label.replace(/\s*\(\d+\)$/, '')) === compact(label) && m.validMonths)
  const before = rec.customDocuments.length
  rec = withCustomDocument(rec, { label: finalLabel, validMonths: sameBase?.validMonths ?? knownDocValidMonths(label) })
  // 새 칸이 정말 생겼을 때만 그 키를 쓴다 — 아니면 마지막 칸(다른 서류)에 덮어 쓰게 된다
  if (rec.customDocuments.length !== before + 1) throw new Error(`'${finalLabel}' 칸을 만들지 못했습니다.`)
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
    rec = ops.withDoc(rec, m.fromKey, { received: false, fileName: '', fileSize: 0, storagePath: '', issuedAt: '', validUntil: undefined, note: '', folderPath: '' })
  }
  const used = new Set<string>()
  const moved: { fileName: string; from: string; to: string; key: DocumentKey; fromKey: DocumentKey }[] = []
  const refMap: Record<string, string> = {}
  for (const { m, state } of taken) {
    const cell = cellForPlacement(rec, m.placement, used)
    rec = ops.withDoc(cell.record, cell.key, {
      received: true,
      fileName: state.fileName,
      fileSize: state.fileSize,
      storagePath: state.storagePath,
      issuedAt: m.placement.issuedAt ?? state.issuedAt,
      // D-181: 서류에 찍힌 유효기간 끝은 파일을 따라 옮긴다
      validUntil: m.placement.validUntil ?? state.validUntil,
      note: state.note,
      // D-204: 원래 폴더 경로도 파일을 따라 옮긴다(폴더로 보기에서 제자리)
      folderPath: state.folderPath ?? '',
      // D-209: 올린 때도 그대로(옮겼다고 오늘 올린 파일이 되지 않게)
      uploadedAt: state.uploadedAt ?? state.updatedAt ?? undefined,
    })
    moved.push({ fileName: state.fileName, from: m.fromLabel, to: cell.label, key: cell.key, fromKey: m.fromKey })
    refMap[m.fromKey] = cell.key
  }
  // D-209: 그 파일에서 읽은 '확인할 정보' 도 새 칸을 가리키게(옛 칸에 다른 파일이 들어와도 섞이지 않게)
  rec = withFactRefs(rec, refMap)
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
  // D-209: 유효기간 끝도 지운다 — 남아 있으면 다시 올린 파일이 옛 만료일을 물려받았다
  let rec = ops.withDoc(record, key, { received: false, fileName: '', fileSize: 0, storagePath: '', issuedAt: '', validUntil: undefined, note: '', folderPath: '', uploadedAt: undefined })
  const custom = rec.customDocuments.find((d) => d.key === key)
  if (custom) rec = ops.withoutCustom(rec, custom.id)
  // D-209: 뺀 파일에서 읽은 '확인할 정보' 도 함께 뺀다(거래처 사업자등록증을 지웠는데 번호가 다르다는 물음이 남았다)
  return withFactRefs(rec, { [key]: null })
}

/**
 * D-209 '확인할 정보'(factInbox)의 출처 칸 바꾸기 — ref 'doc:<칸>:…' 의 칸을 새 칸으로(null 이면 그 후보를 뺀다).
 * 원래 ref 로 한 번에 바꾼다(두 칸을 서로 바꿔도 섞이지 않게).
 */
export function withFactRefs(record: ClientOpsRecord, map: Readonly<Record<string, string | null>>): ClientOpsRecord {
  const inbox = record.factInbox ?? []
  if (!inbox.length || !Object.keys(map).length) return record
  let changed = false
  const next: typeof inbox = []
  for (const c of inbox) {
    const m = /^doc:([^:]+):/.exec(c.ref ?? '')
    if (!m || !(m[1] in map)) {
      next.push(c)
      continue
    }
    changed = true
    const to = map[m[1]]
    if (to) next.push({ ...c, ref: `doc:${to}:${c.ref.slice(m[0].length)}` })
  }
  return changed ? { ...record, factInbox: next } : record
}
