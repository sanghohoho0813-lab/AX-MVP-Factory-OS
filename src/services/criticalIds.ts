/**
 * D-492 중요 번호 — 처음 한 번만 사람이 확인(2026-11-02 대표 지시).
 * 대표: "사업자등록번호 · 법인등록번호 · 법인 설립일은 되게 중요하거든 — 철저히 보고, 100% 신뢰가 안 되면 처음에만큼은 확인을 직접 받도록."
 *
 * 서류에서 읽어 넣은 값(출처가 '직접 적음' 이 아닌 것) 가운데 아직 사람이 '맞아요' 하지 않은 것만 고른다.
 * 맞아요 → 사실 창고 '확인됨'(다시 묻지 않음) · 고치기 → 사람이 적은 값으로(역시 확인됨).
 * 넣는 규칙(검산 · 다른 회사 · 이미 적힌 값과 다르면 묻기)은 그대로 — 이것은 넣은 뒤 한 번 더 눈으로 보는 단계다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { readFact, withFactConfirmed } from './customerFacts'

export const CRITICAL_ID_KEYS = ['businessNumber', 'corporateNumber', 'establishedAt'] as const
export type CriticalIdKey = (typeof CRITICAL_ID_KEYS)[number]

export interface CriticalIdRow {
  key: CriticalIdKey
  label: string
  value: string
  display: string
  /** '사업자등록증 · 적어 둠' 처럼 어디서 왔나 */
  from: string
}

export const isCriticalIdKey = (k: string): k is CriticalIdKey => (CRITICAL_ID_KEYS as readonly string[]).includes(k)

export function criticalIdsToConfirm(record: ClientOpsRecord): CriticalIdRow[] {
  const out: CriticalIdRow[] = []
  for (const key of CRITICAL_ID_KEYS) {
    const f = readFact(record, key)
    // 서류에서 저절로 넣은 값은 '확인됨' 이어도 사람이 본 것이 아니다 — byPerson 이 없으면 한 번 묻는다
    if (!f || f.status === 'missing' || !f.source || f.source === 'manual' || record.factMeta?.[key]?.byPerson) continue
    out.push({ key, label: key === 'establishedAt' ? (record.businessNumber && /^\d{3}-?8[1-8]/.test(record.businessNumber) ? '법인 설립일' : '설립일 · 개업일') : f.label, value: f.value, display: f.display, from: f.sourceLabel.split(' · ')[0] })
  }
  return out
}

export function withCriticalConfirmed(record: ClientOpsRecord, keys: readonly string[], now: string): ClientOpsRecord {
  return keys.reduce((r, k) => withFactConfirmed(r, k, now), record)
}
