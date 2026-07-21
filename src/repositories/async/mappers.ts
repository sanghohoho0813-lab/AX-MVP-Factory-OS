/**
 * DB row(스네이크/관계 컬럼 + payload jsonb) ↔ 앱 엔티티(camelCase) 매핑 헬퍼.
 *
 * 하이브리드 저장 규약:
 *   - 엔티티 전체는 row.payload(jsonb, camelCase) 에 그대로 보존한다.
 *   - workspace_id / project_id / status 등 관계·정렬 컬럼은 별도 컬럼으로 승격한다.
 *   - 앱으로 되돌릴 때는 payload 를 그대로 엔티티로 사용하되, id/timestamps 는
 *     행의 정본 값으로 덮어써 일관성을 유지한다.
 */

/** DB 도메인 행의 공통 컬럼 */
export interface DomainRow {
  id: string
  workspace_id: string
  payload: Record<string, unknown>
  created_at?: string | null
  updated_at?: string | null
  [column: string]: unknown
}

/** 엔티티 최소 형태 (id + camelCase timestamps 를 가질 수 있음) */
export interface EntityLike {
  id: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** row → 엔티티: payload 를 기반으로 하되 정본 id/timestamp 로 보정 */
export function rowToEntity<T extends EntityLike>(row: DomainRow): T {
  const payload = { ...(row.payload ?? {}) } as Record<string, unknown>
  payload.id = row.id
  if (row.created_at && payload.createdAt === undefined) payload.createdAt = row.created_at
  if (row.updated_at && payload.updatedAt === undefined) payload.updatedAt = row.updated_at
  return payload as T
}

/** 승격 컬럼 추출 규칙 — 엔티티에서 관계 컬럼 값을 뽑아낸다 */
export interface PromotedColumns {
  [column: string]: unknown
}

/**
 * 엔티티 → row: workspace_id 와 지정된 승격 컬럼을 채우고, 나머지는 payload 로 보존.
 * promote 는 (엔티티) → 스네이크 컬럼 맵 을 반환하는 함수.
 */
export function entityToRow<T extends EntityLike>(
  entity: T,
  workspaceId: string,
  promote?: (entity: T) => PromotedColumns,
): DomainRow {
  const promoted = promote ? promote(entity) : {}
  return {
    id: entity.id,
    workspace_id: workspaceId,
    payload: entity as unknown as Record<string, unknown>,
    ...promoted,
  }
}

const SNAKE_BOUNDARY = /([a-z0-9])([A-Z])/g

/** camelCase → snake_case (단일 키) */
export function toSnakeKey(key: string): string {
  return key.replace(SNAKE_BOUNDARY, '$1_$2').toLowerCase()
}

/** snake_case → camelCase (단일 키) */
export function toCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}
