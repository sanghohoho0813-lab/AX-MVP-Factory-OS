/**
 * 테스트용 Mock Supabase 클라이언트.
 * SupabaseTableAdapter 가 사용하는 쿼리 체인(from/select/eq/order/single/maybeSingle/
 * insert/update/upsert/delete)과 rpc 를 인메모리로 흉내낸다.
 * 워크스페이스 격리(항상 workspace_id 필터)와 viewer 쓰기 차단(RLS 42501)을 검증하기 위한 것.
 */

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string; code?: string } | null }

export interface MockDb {
  [table: string]: Row[]
}

export class MockClient {
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'anon' = 'editor'
  db: MockDb
  constructor(db: MockDb = {}) {
    this.db = db
  }

  private canWrite(): boolean {
    return this.role === 'owner' || this.role === 'admin' || this.role === 'editor'
  }

  from(table: string) {
    const self = this
    if (!self.db[table]) self.db[table] = []
    return new MockQuery(self, table)
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
    // 공개 RPC 계약만 흉내 (get_public_survey 등)
    if (fn === 'get_public_survey') {
      const token = String(args.survey_token ?? '')
      const rows = this.db['survey_distributions'] ?? []
      const found = rows.find((r) => r._rawToken === token)
      if (!found) return { data: null, error: null }
      const p = (found.payload ?? {}) as Row
      return { data: { distributionId: found.id, available: true, status: 'issued', surveyTitle: p.surveyTitle }, error: null }
    }
    return { data: null, error: null }
  }

  _write(table: string, op: 'insert' | 'update' | 'upsert' | 'delete', row: Row, filters: Row): Result {
    if (!this.canWrite()) {
      return { data: null, error: { message: 'new row violates row-level security policy', code: '42501' } }
    }
    const list = this.db[table] ?? (this.db[table] = [])
    if (op === 'insert') {
      list.push({ ...row })
      return { data: { ...row }, error: null }
    }
    if (op === 'upsert') {
      const idx = list.findIndex((r) => r.id === row.id)
      if (idx >= 0) list[idx] = { ...list[idx], ...row }
      else list.push({ ...row })
      return { data: { ...row }, error: null }
    }
    if (op === 'update') {
      const idx = list.findIndex((r) => this.matches(r, filters))
      if (idx < 0) return { data: null, error: { message: 'not found', code: 'PGRST116' } }
      list[idx] = { ...list[idx], ...row }
      return { data: { ...list[idx] }, error: null }
    }
    // delete
    this.db[table] = list.filter((r) => !this.matches(r, filters))
    return { data: null, error: null }
  }

  matches(row: Row, filters: Row): boolean {
    return Object.entries(filters).every(([k, v]) => row[k] === v)
  }
}

class MockQuery {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private filters: Row = {}
  private payload: Row = {}
  private client: MockClient
  private table: string

  constructor(client: MockClient, table: string) {
    this.client = client
    this.table = table
  }

  select() {
    return this
  }
  eq(col: string, val: unknown) {
    this.filters[col] = val
    return this
  }
  is(col: string, val: unknown) {
    this.filters[col] = val
    return this
  }
  order() {
    return this
  }
  insert(row: Row) {
    this.op = 'insert'
    this.payload = row
    return this
  }
  update(row: Row) {
    this.op = 'update'
    this.payload = row
    return this
  }
  upsert(row: Row) {
    this.op = 'upsert'
    this.payload = row
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }

  private run(single: boolean, maybe: boolean): Result {
    if (this.op !== 'select') {
      return this.client._write(this.table, this.op, this.payload, this.filters)
    }
    const list = this.client.db[this.table] ?? []
    const matched = list.filter((r) => this.client.matches(r, this.filters))
    if (single) {
      if (matched.length === 0) return { data: null, error: { message: 'no rows', code: 'PGRST116' } }
      return { data: matched[0], error: null }
    }
    if (maybe) {
      return { data: matched[0] ?? null, error: null }
    }
    return { data: matched, error: null }
  }

  single() {
    return Promise.resolve(this.run(true, false))
  }
  maybeSingle() {
    return Promise.resolve(this.run(false, true))
  }
  then(resolve: (r: Result) => void) {
    resolve(this.run(false, false))
  }
}
