/**
 * D-181: 고객 종류 — 중소기업 대표님 고객(지금까지 전부) · 컨설턴트 고객.
 *
 * 기록에는 컨설턴트 고객만 `clientType: 'consultant'` 가 남는다. 표시가 없으면 중소기업 대표님 고객이다
 * (예전 기록을 고치지 않아도 그대로 중소기업 쪽에 남는다).
 * 나누고 보는 것은 대표(full) 화면만 — 팀장(Pilot) 화면은 이 구분 없이 전부 보인다(화면에서 판단).
 */
import type { ClientOpsRecord } from '../types/clientOps'

export type ClientType = 'sme' | 'consultant'

export const CLIENT_TYPES: readonly ClientType[] = ['sme', 'consultant']

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  sme: '중소기업 고객',
  consultant: '컨설턴트 고객',
}

export function isClientType(v: unknown): v is ClientType {
  return v === 'sme' || v === 'consultant'
}

export function clientTypeOf(r: Pick<ClientOpsRecord, 'clientType'>): ClientType {
  return r.clientType === 'consultant' ? 'consultant' : 'sme'
}

/** 고객 종류 바꾸기 — 중소기업으로 되돌리면 표시를 지운다(예전 기록과 같은 모양) */
export function withClientType(r: ClientOpsRecord, type: ClientType): ClientOpsRecord {
  const rest = { ...r }
  delete rest.clientType
  return type === 'consultant' ? { ...rest, clientType: 'consultant' } : rest
}
