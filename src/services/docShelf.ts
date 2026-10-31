/**
 * 서류함 한눈에 · 기타 칸 옮기기 (D-147).
 *
 * 폴더째 올리면 칸이 많아진다. 서류 탭 위에서 손볼 것만 센다:
 *   확인 필요(기타 칸) · 겹친 서류('사업자등록증' 과 '사업자등록증 (2)') · 만료 · 지금 필요한데 없음.
 * 누르면 그 칸으로 간다.
 *
 * '기타 · 확인 필요' 칸은 사람이 "이건 법인인감증명서" 라고 고르면 맞는 칸으로 옮긴다 —
 * 기본 칸이면 그 칸, 같은 이름의 칸이 있으면 그 칸(파일이 있으면 '(2)'), 아니면 그 이름으로 새 칸(알려진 서류면 유효기간까지).
 * 옮기기는 '서류 다시 분류' 와 같은 길(applyResort)을 쓴다 — 파일은 그대로, 경로만.
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import { allDocumentMetas } from './clientOpsDocuments'
import { documentsWithExpiry } from './clientOpsAlerts'
import { KNOWN_EXTRA_DOCS, OTHER_DOC_LABEL, placeDocument, type DocPlacement } from './docClassify'
import { applyResort, cellForPlacement, withFactRefs, withoutDocumentFile } from './docPlacementApply'
import { withDocument, withoutCustomDocument } from './clientOpsService'

/**
 * D-147: 폴더째 넣으면 딸려 오는 컴퓨터 파일 — 서류가 아니다(윈도 미리보기 · 맥 압축 찌꺼기 · 열려 있던 오피스 임시 파일)
 */
export function isSystemFile(file: Pick<File, 'name'> & { webkitRelativePath?: string }): boolean {
  const name = file.name
  const path = file.webkitRelativePath ?? ''
  return name.startsWith('.') || name.startsWith('~$') || /^(thumbs\.db|desktop\.ini|ehthumbs\.db)$/i.test(name) || /(^|\/)__MACOSX\//.test(path)
}

const base = (label: string) => label.replace(/\s*\(\d+\)$/, '').replace(/[\s·ㆍ]/g, '')

export function isOtherCell(label: string): boolean {
  return label.startsWith(OTHER_DOC_LABEL)
}

export interface DocShelfSummary {
  /** 무슨 서류인지 모르는 칸(파일 있음) */
  other: DocumentKey[]
  /** 같은 서류가 둘 이상 — 묶음마다 칸 키들 */
  dupGroups: DocumentKey[][]
  expired: DocumentKey[]
  /** 진행 중인 업무에 지금 필요한데 아직 없는 서류 */
  missingNow: DocumentKey[]
}

/**
 * D-411 해마다 · 기간마다 따로 내는 서류는 여러 장이 정상 — '겹쳐 있어요 · 최신 것만 남길까요?' 는 같은 기간일 때만.
 *  - 최근 3개년 재무제표: 결산일(발급일 칸) 해가 같을 때만 겹침(2025 · 2024 · 2023 세 장은 겹침 아님)
 *  - 원천세 신고서 · 부가세 신고서 · 사업장현황신고서: 기간을 칸에 남기지 않아 파일 이름이 같을 때만 겹침
 */
const YEARLY_DOCS = new Set(['최근3개년재무제표'])
const PERIOD_DOCS = new Set(['원천징수이행상황신고서', '부가가치세신고서', '사업장현황신고서'])
function splitPeriodGroup(record: ClientOpsRecord, b: string, g: DocumentKey[]): DocumentKey[][] {
  const by = (keyOf: (k: DocumentKey) => string) => {
    const m = new Map<string, DocumentKey[]>()
    for (const k of g) m.set(keyOf(k), [...(m.get(keyOf(k)) ?? []), k])
    return [...m.values()]
  }
  if (YEARLY_DOCS.has(b)) return by((k) => (record.documents[k]?.issuedAt ?? '').slice(0, 4))
  if (PERIOD_DOCS.has(b)) return by((k) => (record.documents[k]?.fileName ?? k).trim().toLowerCase())
  return [g]
}

/** D-411 지금 '겹쳐 있어요' 로 묻는 서류 이름(번호 뗀 이름) — 올린 결과 안내를 그와 맞춘다 */
export function dupShelfBases(record: ClientOpsRecord): Set<string> {
  const metas = allDocumentMetas(record)
  const label = (k: DocumentKey) => metas.find((m) => m.key === k)?.label ?? k
  return new Set(docShelfSummary(record, '', new Set()).dupGroups.map((g) => base(label(g[0]))))
}
export const shelfBaseOf = base

export function docShelfSummary(record: ClientOpsRecord, today: string, urgent: ReadonlySet<string>): DocShelfSummary {
  const metas = allDocumentMetas(record)
  const hasFile = (key: string) => Boolean(record.documents[key]?.fileName || record.documents[key]?.storagePath)
  const other = metas.filter((m) => isOtherCell(m.label) && hasFile(m.key)).map((m) => m.key)
  const groups = new Map<string, DocumentKey[]>()
  for (const m of metas) {
    if (!m.needsFile || !hasFile(m.key) || isOtherCell(m.label)) continue
    const g = groups.get(base(m.label)) ?? []
    g.push(m.key)
    groups.set(base(m.label), g)
  }
  const dupGroups = [...groups.entries()].flatMap(([b, g]) => splitPeriodGroup(record, b, g)).filter((g) => g.length > 1)
  // D-148: 같은 서류를 새로 받았으면 옛 칸 만료는 세지 않는다(경고 · 달력과 같은 기준)
  const expired = documentsWithExpiry(record, today).filter((x) => x.view.expired).map((x) => x.meta.key)
  const missingNow = metas.filter((m) => urgent.has(m.key) && !record.documents[m.key]?.received).map((m) => m.key)
  return { other, dupGroups, expired, missingNow }
}

export interface MoveTarget {
  value: string
  label: string
  /** 'existing' = 이 업체에 있는 칸 · 'new' = 그 이름으로 새 칸 */
  kind: 'existing' | 'new'
}

/** 기타 칸 파일을 옮길 수 있는 곳 — 이 업체의 칸(기타 빼고) + 칸이 없는 알려진 서류 */
export function moveTargets(record: ClientOpsRecord, fromKey: DocumentKey): MoveTarget[] {
  const metas = allDocumentMetas(record).filter((m) => m.needsFile && m.key !== fromKey && !isOtherCell(m.label) && !/\(\d+\)$/.test(m.label))
  const have = new Set(metas.map((m) => base(m.label)))
  const existing: MoveTarget[] = metas.map((m) => ({ value: `key:${m.key}`, label: m.label, kind: 'existing' }))
  const fresh: MoveTarget[] = KNOWN_EXTRA_DOCS.filter((k) => !have.has(base(k.label))).map((k) => ({ value: `new:${k.label}`, label: k.label, kind: 'new' }))
  return [...existing, ...fresh]
}

/** 고른 곳으로 옮긴다 — `value` 는 moveTargets 의 값, 또는 'new:<직접 적은 이름>' */
export function moveDocTo(record: ClientOpsRecord, fromKey: DocumentKey, value: string): { record: ClientOpsRecord; to: string } | null {
  const meta = allDocumentMetas(record).find((m) => m.key === fromKey)
  const state = record.documents[fromKey]
  if (!meta || !state || !(state.fileName || state.storagePath)) return null
  let placement: DocPlacement
  if (value.startsWith('key:')) {
    const key = value.slice(4)
    const to = allDocumentMetas(record).find((m) => m.key === key)
    if (!to) return null
    placement = { kind: 'existing', key: to.key, label: to.label, sure: true, reason: '사람이 고름', issuedAt: null }
  } else if (value.startsWith('new:') && value.slice(4).trim() !== '') {
    const label = value.slice(4).trim()
    // 같은 이름의 칸이 이미 있으면 그 칸으로(직접 적은 이름이 기본 칸과 같을 때)
    const same = allDocumentMetas(record).find((m) => m.needsFile && m.key !== fromKey && base(m.label) === base(label))
    placement = same
      ? { kind: 'existing', key: same.key, label: same.label, sure: true, reason: '사람이 고름', issuedAt: null }
      : { kind: 'new', label, sure: true, reason: '사람이 고름', issuedAt: null }
  } else {
    return null
  }
  const out = applyResort(
    record,
    [{ fromKey, fromLabel: meta.label, fileName: state.fileName, placement, move: true, why: '사람이 고름' }],
    { withDoc: withDocument, withoutCustom: withoutCustomDocument },
  )
  const moved = out.moved[0]
  return moved ? { record: out.record, to: moved.to } : null
}

/* ------------------------------------------------------------------ */
/* D-183: 확인할 것에서 서류함 정리 — 기타 칸 옮기기 · 겹친 서류            */
/* ------------------------------------------------------------------ */

/** 기타 칸 파일을 파일 이름으로 보면 갈 곳 — 모르면 null(사람이 고른다) */
export function otherCellSuggestion(record: ClientOpsRecord, fromKey: DocumentKey): MoveTarget | null {
  const st = record.documents[fromKey]
  if (!st?.fileName) return null
  const metas = allDocumentMetas(record).filter((m) => m.key !== fromKey && !isOtherCell(m.label))
  const p = placeDocument({ text: '', fileName: st.fileName }, metas)
  if (!p.label.trim() || isOtherCell(p.label)) return null
  if (p.kind === 'existing') return { value: `key:${p.key}`, label: p.label, kind: 'existing' }
  return { value: `new:${p.label}`, label: p.label, kind: 'new' }
}

const numberOf = (label: string) => Number(/\((\d+)\)$/.exec(label)?.[1] ?? '1')

/** 겹친 서류 묶음에서 남길 칸 — 발급일이 늦은 것 → 올린 때가 늦은 것 → 번호가 큰 칸 */
export function newestOf(record: ClientOpsRecord, keys: readonly DocumentKey[]): DocumentKey {
  const metas = allDocumentMetas(record)
  const label = (k: DocumentKey) => metas.find((m) => m.key === k)?.label ?? ''
  return [...keys].sort((a, b) => {
    const da = record.documents[a]
    const db = record.documents[b]
    // D-209: 발급일은 둘 다 알 때만 견준다 — 하나만 알면 늦게 올린 것(새로 받은 서류에 발급일을 아직 안 적었을 수 있다)
    const ia = da?.issuedAt ?? ''
    const ib = db?.issuedAt ?? ''
    if (ia && ib && ia !== ib) return ib.localeCompare(ia)
    const ua = da?.uploadedAt ?? da?.updatedAt ?? ''
    const ub = db?.uploadedAt ?? db?.updatedAt ?? ''
    return ub.localeCompare(ua) || numberOf(label(b)) - numberOf(label(a))
  })[0]
}

/**
 * 겹친 서류 정리 — 남길 파일을 번호 없는 칸에 두고 나머지 칸은 서류함에서 뺀다.
 * 파일 자체(보관함)는 지우지 않는다 — 서류함 칸에서만 빠진다(되돌리기 · 다시 올리기 가능).
 */
export function withDedupedShelf(record: ClientOpsRecord, keys: readonly DocumentKey[], keep: DocumentKey): ClientOpsRecord {
  if (!keys.includes(keep) || keys.length < 2) return record
  const metas = allDocumentMetas(record)
  const primary = keys.find((k) => !/\(\d+\)$/.test(metas.find((m) => m.key === k)?.label ?? '')) ?? keys[0]
  const kept = record.documents[keep]
  const ops = { withDoc: withDocument, withoutCustom: withoutCustomDocument }
  // D-209: 남길 파일에서 읽은 '확인할 정보' 는 남길 칸으로 · 빼는 파일(기본 칸의 옛 파일 포함)의 것은 뺀다
  let rec = withFactRefs(record, Object.fromEntries(keys.map((k) => [k, k === keep ? primary : null])))
  for (const k of keys) if (k !== primary) rec = withoutDocumentFile(rec, k, ops)
  if (keep !== primary && kept) {
    rec = withDocument(rec, primary, {
      received: true,
      fileName: kept.fileName,
      fileSize: kept.fileSize,
      storagePath: kept.storagePath,
      issuedAt: kept.issuedAt,
      validUntil: kept.validUntil,
      note: kept.note,
      folderPath: kept.folderPath ?? '',
      uploadedAt: kept.uploadedAt ?? kept.updatedAt ?? undefined,
    })
  }
  return rec
}

/* ------------------------------------------------------------------ */
/* D-148: 고객이 고객 플랫폼에 올린 파일 → 서류함                           */
/* ------------------------------------------------------------------ */

export interface PortalFileLike {
  documentType: string
  title: string
  storagePath: string
  fileName: string
  fileSize: number | null
}

/** 이 파일(같은 보관함 경로)이 이미 서류함 어느 칸에 있나 */
export function shelfCellOf(record: ClientOpsRecord, storagePath: string): { key: DocumentKey; label: string } | null {
  if (!storagePath) return null
  const meta = allDocumentMetas(record).find((m) => record.documents[m.key]?.storagePath === storagePath)
  return meta ? { key: meta.key, label: meta.label } : null
}

/**
 * 고객이 올린 파일을 서류함 칸에 넣는다 — 파일은 그대로(같은 보관함 경로), 칸만.
 * 요청할 때 고른 서류 종류(사업자등록증 …)가 이 업체의 칸이면 그 칸, 아니면 글자 제목 · 파일 이름(D-146 규칙),
 * 그래도 모르면 요청 제목('2025 재무제표') 이름의 칸. 이미 파일이 있는 칸은 덮지 않고 '(2)' 칸.
 */
export function filePortalDocument(record: ClientOpsRecord, doc: PortalFileLike, text: string): { record: ClientOpsRecord; key: DocumentKey; label: string } | null {
  if (!doc.storagePath) return null
  const already = shelfCellOf(record, doc.storagePath)
  if (already) return { record, ...already }
  const metas = allDocumentMetas(record)
  const typed = metas.find((m) => m.needsFile && m.key === doc.documentType)
  let placement: DocPlacement
  if (typed) {
    placement = { kind: 'existing', key: typed.key, label: typed.label, sure: true, reason: '요청한 서류 종류', issuedAt: null }
  } else {
    const p = placeDocument({ text, fileName: doc.fileName }, metas)
    const title = doc.title.trim()
    placement = p.kind === 'new' && p.label === OTHER_DOC_LABEL && title ? { kind: 'new', label: title, sure: false, reason: '요청 제목', issuedAt: p.issuedAt } : p
  }
  const cell = cellForPlacement(record, placement, new Set())
  // D-181: 서류에 찍힌 유효기간 끝도 함께(없으면 비운다)
  let rec = withDocument(cell.record, cell.key, { received: true, fileName: doc.fileName, fileSize: doc.fileSize ?? 0, storagePath: doc.storagePath, validUntil: placement.validUntil ?? undefined })
  if (placement.issuedAt) rec = withDocument(rec, cell.key, { issuedAt: placement.issuedAt })
  return { record: rec, key: cell.key, label: cell.label }
}
