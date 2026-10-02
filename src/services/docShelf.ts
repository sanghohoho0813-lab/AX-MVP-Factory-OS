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
import { allDocumentMetas, emptyDocumentState } from './clientOpsDocuments'
import { documentStatus } from './clientOpsAlerts'
import { KNOWN_EXTRA_DOCS, OTHER_DOC_LABEL, type DocPlacement } from './docClassify'
import { applyResort } from './docPlacementApply'
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
  const dupGroups = [...groups.values()].filter((g) => g.length > 1)
  const expired = metas.filter((m) => documentStatus(m.key, record.documents[m.key] ?? emptyDocumentState(), today, m).expired).map((m) => m.key)
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
