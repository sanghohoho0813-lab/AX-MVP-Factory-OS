/**
 * 원본 영업 OS 저장소 자리 (D-93).
 *
 * 원본(corp-consult-sales-os App.jsx)은 모든 기록을 `data` 한 덩어리로 localStorage 에 넣었다
 * (leads · companies · educationItems · lawUpdates · packages · reportProfile …).
 * 화면 코드는 그대로 두고 `load()` · `save()` 두 함수만 여기로 돌린다.
 *
 * 업체는 고객 운영 하나뿐이다:
 *   - leads(신규 고객 발굴) · companies(고객사 관리)의 한 줄 = 고객 운영 업체 한 곳. id = 업체 id
 *   - 업체명은 고객 운영 기록을 비춘다. 영업 기록(단계·메모·제안…)은 모듈 기록 `sales-kit/accounts` 에 업체별로
 *     (D-91 영업 상태와 같은 줄이라 옛 기록도 그대로 보인다)
 *   - 나머지(교육·법령·상품·리포트 정보·설정)는 `sales-kit/orig` 한 줄
 */

import { deleteRow, listRows, saveRow } from '../../../services/moduleData'
import type { ClientOpsRecord } from '../../../types/clientOps'

const MODULE = 'sales-kit'
type Rec = Record<string, unknown>
type SalesData = Rec & { leads?: Rec[]; companies?: Rec[] }

let workspace: string | null = null
let osClients: ClientOpsRecord[] = []
/** 업체 id → 모듈 기록 줄 */
const accountRows = new Map<string, { id: string; json: string }>()
let miscRowId: string | undefined
let miscJson = ''
let cache: SalesData | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let hydratedFor: string | null | undefined

export function salesOsClients(): ClientOpsRecord[] {
  return osClients.filter((c) => c.archivedAt === null)
}
export function salesOsClientOf(id: string): ClientOpsRecord | undefined {
  return osClients.find((c) => c.id === id)
}

/** 영업 기록 한 줄 + 고객 운영 업체 → 원본 고객 한 줄 */
export function toSalesRecord(os: ClientOpsRecord, d: Rec): Rec {
  const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '')
  return {
    ...d,
    id: os.id,
    name: os.companyName,
    ceoName: s('ceoName') || os.representativeName || os.contactName || '',
    industry: s('industry') || os.industry || '기타',
    // D-94: 영업 쪽에 안 적었으면 고객 운영 기록으로 (카드에 '- · -명' 으로 비던 것)
    empCount: s('empCount') || String(os.employeeCount ?? '').replace(/[^0-9]/g, ''),
    nextDate: s('nextDate') || s('nextContactAt'),
    stage: s('stage') || 'lead',
    interests: Array.isArray(d.interests) ? d.interests : [],
    issues: Array.isArray(d.issues) ? d.issues : [],
    flags: d.flags && typeof d.flags === 'object' ? d.flags : {},
    memo: s('memo'),
    createdAt: s('createdAt') || os.createdAt?.slice(0, 10) || '',
  }
}

/** 원본이 부르는 load() — 화면을 열기 전에 hydrateSalesStore() 가 채워 둔다 */
export function salesLoad(): SalesData | null {
  return cache
}

/** 원본이 부르는 save(data) — 메모리에 두고 잠시 뒤 모듈 기록으로 */
export function salesSave(data: SalesData | null): void {
  cache = data
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void persist()
  }, 400)
}

export async function flushSalesStore(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  await persist()
}

async function persist(): Promise<void> {
  const d = cache
  if (!d) return
  const leads = Array.isArray(d.leads) ? d.leads : []
  const companies = Array.isArray(d.companies) ? d.companies : []
  const byId = new Map<string, { rec: Rec; inLead: boolean; inCompany: boolean }>()
  for (const r of leads) {
    const id = String(r.id ?? '')
    if (!salesOsClientOf(id)) continue // 고객 관리에 없는 업체는 남기지 않는다
    byId.set(id, { rec: r, inLead: true, inCompany: false })
  }
  for (const r of companies) {
    const id = String(r.id ?? '')
    if (!salesOsClientOf(id)) continue
    const cur = byId.get(id)
    byId.set(id, { rec: cur ? { ...cur.rec, ...r } : r, inLead: !!cur?.inLead, inCompany: true })
  }
  const jobs: Promise<unknown>[] = []
  for (const [id, v] of byId) {
    const dest = v.inLead && v.inCompany ? 'both' : v.inCompany ? 'company' : 'lead'
    const { name: _name, ...rest } = v.rec
    void _name
    // D-91 화면·대시보드가 읽던 이름도 같이 적어 둔다
    const data: Rec = { ...rest, dest, nextContactAt: rest.nextDate ?? rest.nextContactAt ?? '' }
    const json = JSON.stringify(data)
    const row = accountRows.get(id)
    if (row && row.json === json) continue
    jobs.push(
      saveRow(workspace, MODULE, 'accounts', { id: row?.id, clientId: id, data })
        .then((saved) => accountRows.set(id, { id: saved.id, json }))
        .catch(() => undefined),
    )
  }
  // 목록에서 빠진 업체 — 영업 기록만 지운다(고객 운영 업체는 그대로)
  for (const [id, row] of [...accountRows]) {
    if (byId.has(id)) continue
    accountRows.delete(id)
    jobs.push(deleteRow(workspace, MODULE, 'accounts', row.id).catch(() => undefined))
  }
  const { leads: _l, companies: _c, ...misc } = d
  void _l
  void _c
  const mj = JSON.stringify(misc)
  if (mj !== miscJson) {
    jobs.push(
      saveRow(workspace, MODULE, 'orig', { id: miscRowId, clientId: '', data: { key: 'data', value: misc } })
        .then((saved) => {
          miscRowId = saved.id
          miscJson = mj
        })
        .catch(() => undefined),
    )
  }
  await Promise.all(jobs)
}

export interface HydrateSalesInput {
  workspaceId: string | null
  clients: ClientOpsRecord[]
  /** 원본 emptyData() — 처음 여는 작업실이면 이것으로 시작한다 */
  empty: () => Rec
}

/** 영업 화면을 열기 전에 한 번 */
export async function hydrateSalesStore(input: HydrateSalesInput): Promise<void> {
  // 같은 작업실을 이미 읽었으면 메모리 것을 그대로 쓴다 — 화면을 옮길 때 저장 전 기록을 덮어쓰지 않게
  if (cache && hydratedFor === input.workspaceId) {
    osClients = input.clients
    const overlay = (list: unknown) =>
      (Array.isArray(list) ? (list as Rec[]) : []).map((r) => {
        const os = input.clients.find((c) => c.id === r.id)
        return os ? { ...r, name: os.companyName } : r
      })
    cache = { ...cache, leads: overlay(cache.leads), companies: overlay(cache.companies) }
    return
  }
  await flushSalesStore()
  workspace = input.workspaceId
  osClients = input.clients
  const [accounts, origRows, profile, education, updates] = await Promise.all([
    listRows(workspace, MODULE, 'accounts'),
    listRows(workspace, MODULE, 'orig'),
    listRows(workspace, MODULE, 'profile'),
    listRows(workspace, MODULE, 'education'),
    listRows(workspace, MODULE, 'updates'),
  ])
  accountRows.clear()
  const leads: Rec[] = []
  const companies: Rec[] = []
  for (const r of accounts) {
    const os = input.clients.find((c) => c.id === r.clientId)
    if (!os) continue
    accountRows.set(r.clientId, { id: r.id, json: JSON.stringify(r.data) })
    const rec = toSalesRecord(os, r.data)
    const dest = r.data.dest === 'lead' || r.data.dest === 'both' ? r.data.dest : 'company'
    if (dest === 'lead' || dest === 'both') leads.push(rec)
    if (dest === 'company' || dest === 'both') companies.push(rec)
  }
  const miscRow = origRows.find((r) => r.data.key === 'data')
  miscRowId = miscRow?.id
  let misc: Rec
  if (miscRow && miscRow.data.value && typeof miscRow.data.value === 'object') {
    misc = miscRow.data.value as Rec
    miscJson = JSON.stringify(misc)
  } else {
    // 처음 — 원본 빈 데이터에 D-91/92 에 쌓은 것(상품·리포트 정보·월납 기준·교육·법령)을 한 번 옮긴다
    misc = { ...input.empty() }
    delete misc.leads
    delete misc.companies
    const p = profile[0]?.data as Rec | undefined
    if (p) {
      if (Array.isArray(p.packages) && p.packages.length) misc.packages = p.packages
      if (p.reportProfile && typeof p.reportProfile === 'object') misc.reportProfile = p.reportProfile
      if (p.affordSettings && typeof p.affordSettings === 'object') misc.affordSettings = p.affordSettings
    }
    if (education.length) misc.educationItems = education.map((r) => ({ ...(r.data as Rec), id: r.id }))
    if (updates.length) misc.lawUpdates = updates.map((r) => ({ ...(r.data as Rec), id: r.id }))
    miscJson = ''
  }
  cache = { ...misc, leads, companies }
  hydratedFor = input.workspaceId
}

/** 설정의 '전체 초기화' — 이 모듈의 영업 기록만 지운다. 고객 운영 업체는 그대로 */
export function salesResetAll(): void {
  cache = { leads: [], companies: [] }
  miscJson = ''
  salesSave(cache)
}

/** 시험용 */
export function resetSalesStoreForTest(data: SalesData | null, clients: ClientOpsRecord[] = []): void {
  cache = data
  osClients = clients
  accountRows.clear()
  miscRowId = undefined
  miscJson = ''
  hydratedFor = undefined
}
