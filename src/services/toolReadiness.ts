/**
 * "이 업체로 이 도구를 지금 돌릴 수 있나?" (D-90)
 *
 * 도구마다 있어야 하는 서류가 다르다. 고용지원금은 4대보험 가입자 명부가 없으면 진단이 안 되고,
 * 크레탑은 기업종합보고서가 없으면 읽을 것이 없다. 그 판단을 화면마다 따로 하지 않고 여기서 한 번 한다.
 *
 * 규칙
 *  - **없는 서류는 이름을 그대로 돌려준다.** '서류 2건 부족' 만으로는 무엇을 받아야 할지 알 수 없다.
 *  - 만료된 서류는 '없는 것' 으로 본다 — 3개월 지난 등기부등본은 기관이 받아 주지 않는다.
 *  - 파일이 필요한 서류(`needsFile`)는 **파일까지** 있어야 '올려 둔 것' 으로 본다.
 *    받았다고 체크만 해 둔 것은 도구가 읽을 수 없다.
 *  - 도구를 막지는 않는다. 손으로 붙여넣어 쓰는 길이 늘 있다 — 다만 눈에 띄게 알려 준다.
 */

import type { ClientOpsRecord, DocumentKey, DocumentState } from '../types/clientOps'
import type { ToolDefinition } from '../config/toolRegistry'
import { documentStatus } from './clientOpsAlerts'
import { documentMetaOf, emptyDocumentState } from './clientOpsDocuments'

export interface DocNeed {
  key: DocumentKey
  label: string
  /** 받았다고 표시돼 있는가 */
  received: boolean
  /** 실제 파일이 올라와 있는가 (파일이 필요 없는 칸이면 received 와 같다) */
  hasFile: boolean
  /** 유효기간이 지났는가 */
  expired: boolean
  /** 파일이 있어야 하는 칸인가 */
  needsFile: boolean
}

export interface ToolReadiness {
  tool: ToolDefinition
  /** 꼭 있어야 하는데 없는 것 */
  missing: DocNeed[]
  /** 있으면 더 정확해지는데 없는 것 */
  missingOptional: DocNeed[]
  /** 꼭 필요한 것이 전부 있는가 */
  ready: boolean
  /** 꼭 필요한 서류 자체가 없는 도구인가 (세금 계산기처럼) */
  needsNothing: boolean
}

function needOf(record: ClientOpsRecord, key: DocumentKey, today: string): DocNeed {
  const meta = documentMetaOf(record, key)
  const state: DocumentState = record.documents[key] ?? emptyDocumentState()
  const view = documentStatus(key, state, today, meta)
  const hasFile = meta.needsFile ? Boolean(state.storagePath || state.fileName) : state.received
  return {
    key,
    label: meta.label,
    received: state.received,
    hasFile,
    expired: view.expired,
    needsFile: meta.needsFile,
  }
}

/** 도구가 읽을 수 있는 상태인가 — 받았고, 파일이 있고, 기한이 지나지 않았을 때만 */
function usable(need: DocNeed): boolean {
  if (!need.received) return false
  if (need.expired) return false
  if (need.needsFile && !need.hasFile) return false
  return true
}

export function toolReadiness(record: ClientOpsRecord, tool: ToolDefinition, today: string): ToolReadiness {
  const required = tool.requiredDocs ?? []
  const recommended = tool.recommendedDocs ?? []
  const missing = required.map((k) => needOf(record, k, today)).filter((n) => !usable(n))
  const missingOptional = recommended.map((k) => needOf(record, k, today)).filter((n) => !usable(n))
  return {
    tool,
    missing,
    missingOptional,
    ready: missing.length === 0,
    needsNothing: required.length === 0,
  }
}

/** 여러 도구를 한꺼번에 */
export function readinessOf(record: ClientOpsRecord, tools: ToolDefinition[], today: string): ToolReadiness[] {
  return tools.map((t) => toolReadiness(record, t, today))
}

/**
 * 이 업체에서 도구 때문에 빠져 있는 서류를 한 줄로 (중복 없이, 도구가 많이 쓰는 것부터).
 * 업체 화면 맨 위 띠에 그대로 쓴다.
 */
export function missingDocsForTools(record: ClientOpsRecord, tools: ToolDefinition[], today: string): DocNeed[] {
  const count = new Map<DocumentKey, { need: DocNeed; n: number }>()
  for (const r of readinessOf(record, tools, today)) {
    for (const need of r.missing) {
      const prev = count.get(need.key)
      if (prev) prev.n += 1
      else count.set(need.key, { need, n: 1 })
    }
  }
  return [...count.values()].sort((a, b) => b.n - a.n).map((v) => v.need)
}

/** 화면에 그대로 쓰는 한 줄 — "없는 서류: 4대보험 가입자 명부 · 최근 3개년 재무제표" */
export function missingDocsText(needs: DocNeed[]): string {
  return needs.map((n) => n.label).join(' · ')
}

/** 왜 못 쓰는지 한 줄 (도구 카드의 빨간 글) */
export function missingReason(need: DocNeed): string {
  if (!need.received) return '아직 안 받음'
  if (need.expired) return '유효기간 지남'
  if (need.needsFile && !need.hasFile) return '파일이 없음 (받음 표시만 되어 있음)'
  return ''
}
