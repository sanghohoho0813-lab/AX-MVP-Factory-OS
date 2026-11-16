/**
 * 원본 고용지원금 매니저 Pro 저장소 자리 (D-93).
 *
 * 원본(SubsidyApp)은 업체·직원·지원금·달력 메모를 props 로 받고, 바뀌면 콜백(onSaveCompany …)을 불렀다.
 * 원본 뒤에는 Supabase 표(companies · employees · calendar_memos · profile.settings)가 있었다.
 * 이 OS 에서는 그 자리를 모듈 기록(`moduleData`, 모듈 `employment`)이 맡는다:
 *
 *   - 업체 = 고객 운영 업체. 업체 id = 고객 운영 업체 id. 이름·대표·주소 같은 기본 정보는 고객 운영 기록을 비춘다.
 *     고용지원금 쪽에서 적은 것(급여일·지원금별 진행 정보·업체 서류·수수료·업무 일지 …)만 `companies` 갈래에 업체별 한 줄
 *     (D-92 업체 기록과 같은 줄이라 옛 기록이 그대로 보인다)
 *   - 직원 = `employees` 갈래 한 줄 (clientId = 업체). D-91 모양(hireDate·stage·docs)으로 적힌 옛 줄도 읽는다
 *   - 지원금 표 · 프로필 = `orig` 갈래 한 줄씩 (key 로 구분)
 *   - 달력 메모 = `calendar` 갈래 한 줄 (D-92 와 같은 줄)
 *
 * 이 파일은 모양 바꾸기만 한다(시험이 직접 붙든다). 읽고 쓰는 것은 EmploymentOrig.tsx.
 */

import type { ClientOpsRecord } from '../../../types/clientOps'
import type { ModuleRow } from '../../../services/moduleData'
import { safeBizNo, scrubRrnDeep } from '../lib/privacy'
import { documentMetaOf } from '../../../services/clientOpsDocuments'

export type Rec = Record<string, unknown>

export const MODULE = 'employment'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/* ------------------------------------------------------------------ */
/* 업체                                                                 */
/* ------------------------------------------------------------------ */

/** 주소 첫머리로 수도권·비수도권 (원본 지역 칸) */
export function regionOfAddress(addr: string): string {
  const a = addr.trim()
  if (!a) return ''
  return /^(서울|경기|인천)/.test(a) ? '수도권' : '비수도권'
}

/** 고객 운영 업체 → 원본 업체 칸 기본값 */
export function osCompanyDefaults(os: ClientOpsRecord): Rec {
  // D-165: 첫 숫자만 — 전에는 숫자가 아닌 글자를 다 지워 '12명(2025.6 기준)' 이 1220256 이 됐다
  const count = /(\d+)/.exec(String(os.employeeCount ?? ''))?.[1] ?? ''
  return {
    name: os.companyName,
    bizNo: os.businessNumber || '',
    ceoName: os.representativeName || os.contactName || '',
    addr: os.businessAddress || '',
    phone: os.companyPhone || os.contactPhone || '',
    email: os.contactEmail || '',
    managerName: os.contactName || '',
    managerTitle: os.contactTitle || '',
    managerEmail: os.contactEmail || '',
    corpType: os.corporateNumber ? '법인' : '개인',
    establishedDate: os.establishedAt || '',
    bizType: os.industry || os.businessCategory || '',
    empCount: count,
    region: regionOfAddress(os.businessAddress || ''),
  }
}

/** 업체 고르기 목록에 쓰는 한 줄 (이미 등록된 업체는 taken) */
export function osPickList(clients: readonly ClientOpsRecord[], registered: ReadonlySet<string>): Rec[] {
  return clients
    .filter((c) => c.archivedAt === null)
    .map((c) => ({ id: c.id, ...osCompanyDefaults(c), taken: registered.has(c.id) }))
}

function withFiles(list: unknown): Rec[] {
  return (Array.isArray(list) ? (list as Rec[]) : [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({ ...d, id: str(d.id) || uid(), label: str(d.label) || str(d.name), files: Array.isArray(d.files) ? d.files : [] }))
}

/**
 * D-618 고객 관리 서류함에 받아 둔 서류 → 고용지원금 업체 서류 체크.
 * 대표: "서류를 고객 관리에 넣어 놨으면 모듈이 먼저 끌고 와야 한다." — 이름으로 알아본다(직접 만든 칸 포함).
 * [고용지원금 서류 이름, 서류함 칸 이름]
 */
const BOX_DOC_MATCH: ReadonlyArray<readonly [RegExp, RegExp]> = [
  [/사업자\s*등록증/, /사업자\s*등록증/],
  [/법인\s*등기/, /^(?!.*(부동산|건물|토지)).*(법인\s*등기|등기부\s*등본|등기사항\s*(전부)?\s*증명)/],
  [/신분증/, /신분증/],
  [/통장\s*사본/, /통장\s*사본/],
  [/4대\s*보험\s*가입자\s*명부/, /4대\s*(사회)?\s*보험.*명부|가입자\s*명부/],
  [/법인세.*신고서|소득세.*신고서/, /법인세.*신고서|종합소득세\s*신고서|세무조정\s*계산서/],
  [/재무제표/, /재무제표|재무상태표|손익계산서/],
  [/국세\s*완납/, /^(?!.*지방세).*(납세\s*증명|국세\s*완납)/],
  [/임금\s*대장|급여\s*대장/, /임금\s*대장|급여\s*대장/],
  [/취업\s*규칙/, /취업\s*규칙/],
]

/** 이 업체 서류함에서 '받음' 인 칸 이름들 */
export function boxReceivedLabels(os: ClientOpsRecord): string[] {
  return Object.entries(os.documents ?? {})
    .filter(([, state]) => !!state?.received)
    .map(([key]) => documentMetaOf(os, key).label)
}

/**
 * 업체 서류에 서류함을 비춘다 — 아직 안 받은 줄(미요청 · 요청완료)인데 서류함에 있으면 '제출완료 · 서류함에 있음'.
 * 직접 정한 상태(보완필요 · 확인완료 · 제출완료)는 건드리지 않는다. 서류함에 없으면 예전 그대로.
 */
export function withBoxDocs(docs: Rec[], os: ClientOpsRecord): Rec[] {
  const held = boxReceivedLabels(os)
  if (!held.length) return docs.map((d) => (d.fromBox ? { ...d, fromBox: undefined } : d))
  return docs.map((d) => {
    const label = str(d.label)
    const inBox = BOX_DOC_MATCH.some(([mine, box]) => mine.test(label) && held.some((h) => box.test(h)))
    if (!inBox) return d.fromBox ? { ...d, fromBox: undefined } : d
    const status = str(d.status) || (d.done ? 'confirmed' : 'none')
    if (status === 'none' || status === 'requested') return { ...d, status: 'submitted', done: true, fromBox: true }
    return { ...d, fromBox: status === 'submitted' || status === 'confirmed' ? true : undefined }
  })
}

/** 모듈 기록(업체 한 줄) + 고객 운영 업체 → 원본 업체 */
export function toOrigCompany(os: ClientOpsRecord, meta: Rec | undefined, createdAt?: string): Rec {
  const m = meta ?? {}
  const out: Rec = { ...osCompanyDefaults(os), ...m }
  out.id = os.id
  out.osId = os.id
  out.name = os.companyName // 이름은 늘 고객 관리 기록 그대로
  out.companyDocs = withBoxDocs(withFiles(m.companyDocs), os)
  out.notes = Array.isArray(m.notes) ? m.notes : []
  out.programInfos = Array.isArray(m.programInfos) ? m.programInfos : []
  if (m.needsReview && m.reviewNeeded === undefined) out.reviewNeeded = true
  out.createdAt = str(m.createdAt) || createdAt || os.createdAt || ''
  delete out.removedAt
  return out
}

/**
 * 원본 업체 → 모듈 기록에 남길 것 (고객 운영 기록과 같은 값은 적지 않는다 — 고객 운영에서 고치면 그대로 따라온다).
 * D-136: 주민번호 모양은 저장하지 않는다 — 사업자번호 칸이면 비우고, 메모·업무 일지 글자에서는 지운다.
 */
export function companyMetaOf(company: Rec, os: ClientOpsRecord | undefined): Rec {
  const base = os ? osCompanyDefaults(os) : {}
  const out: Rec = {}
  for (const [k, v] of Object.entries(company)) {
    if (k === 'id' || k === 'name' || k === 'osId') continue
    if (k in base && base[k] === v) continue
    out[k] = v
  }
  if ('bizNo' in out) out.bizNo = safeBizNo(out.bizNo)
  return scrubRrnDeep(out)
}

/* ------------------------------------------------------------------ */
/* 직원                                                                 */
/* ------------------------------------------------------------------ */

/** 모듈 기록 한 줄 → 원본 직원. D-91 모양(hireDate · stage · docs · militaryMonths)도 받아 준다 */
export function toOrigEmployee(row: Pick<ModuleRow, 'id' | 'clientId' | 'data'>): Rec {
  const d = row.data ?? {}
  if (d._v === 'orig') return { ...d, id: row.id, companyId: row.clientId }
  const rounds: Rec[] = (Array.isArray(d.rounds) ? (d.rounds as Rec[]) : []).map((r) => ({ ...r, id: str(r.id) || uid() }))
  const docs = (Array.isArray(d.docs) ? (d.docs as Rec[]) : []).map((x) => ({
    id: uid(),
    label: str(x.name) || str(x.label),
    done: !!x.done,
    ...(x.status ? { status: x.status } : {}),
    files: [],
  }))
  const gender = d.gender === '여' || d.gender === 'female' ? 'female' : 'male'
  const total = rounds.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return {
    ...d,
    id: row.id,
    companyId: row.clientId,
    name: str(d.name),
    programId: str(d.programId),
    startDate: str(d.startDate) || str(d.hireDate),
    birthDate: str(d.birthDate),
    gender,
    milSvc: typeof d.milSvc === 'number' ? d.milSvc : typeof d.militaryMonths === 'number' ? d.militaryMonths : 0,
    status: str(d.status) || str(d.stage) || 'preparing',
    salary: d.salary ?? '',
    memo: str(d.memo),
    rounds,
    employeeDocs: Array.isArray(d.employeeDocs) ? withFiles(d.employeeDocs) : docs,
    totalExpected: typeof d.totalExpected === 'number' ? d.totalExpected : total,
  }
}

/** 원본 직원 → 모듈 기록. D-91 이름(hireDate · stage)도 같이 적어 둔다. 주민번호 모양은 지운다(D-136) */
export function employeeRowData(emp: Rec): Rec {
  const { id: _id, companyId: _cid, ...rest } = emp
  void _id
  void _cid
  return scrubRrnDeep({ ...rest, _v: 'orig', hireDate: str(emp.startDate), stage: str(emp.status) || 'preparing' })
}

/* ------------------------------------------------------------------ */
/* 지원금 표 · 달력 메모                                                 */
/* ------------------------------------------------------------------ */

/**
 * D-91 지원금 줄(끄기 · 직접 더한 것) → 원본 지원금 표.
 * 줄이 하나도 없으면 undefined — 원본이 자기 기본 표를 쓴다.
 */
export function programsFromD91(rows: readonly Pick<ModuleRow, 'data'>[], defaults: Record<string, Rec>, enabledDefaults: Record<string, boolean>): Record<string, Rec> | undefined {
  if (!rows.length) return undefined
  const out: Record<string, Rec> = {}
  const flag = new Map<string, boolean>()
  for (const r of rows) {
    const pid = str(r.data.programId)
    if (pid) flag.set(pid, r.data.enabled !== false)
  }
  for (const [k, p] of Object.entries(defaults)) {
    out[k] = { ...p, enabled: flag.has(k) ? flag.get(k) : !!enabledDefaults[k] }
  }
  for (const r of rows) {
    const c = r.data.custom as Rec | undefined
    if (!c || typeof c.id !== 'string' || out[c.id]) continue
    out[c.id] = { ...c, enabled: r.data.enabled !== false }
  }
  return out
}

/** 달력 메모 날짜 열쇠: D-92 는 2026-09-05, 원본은 2026-9-5 */
export function origMemoKey(key: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key)
  return m ? `${Number(m[1])}-${Number(m[2])}-${Number(m[3])}` : key
}

export function memosFromRow(data: Rec | undefined): Record<string, unknown[]> {
  const src = (data?.memos && typeof data.memos === 'object' ? data.memos : {}) as Record<string, unknown>
  const out: Record<string, unknown[]> = {}
  for (const [k, v] of Object.entries(src)) {
    if (!Array.isArray(v)) continue
    const key = origMemoKey(k)
    out[key] = [...(out[key] ?? []), ...v]
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 엑셀로 들여온 업체 → 고객 운영 업체                                    */
/* ------------------------------------------------------------------ */

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const plainName = (v: unknown) =>
  String(v ?? '')
    .replace(/\(주\)|㈜|주식회사|\s/g, '')
    .toLowerCase()

/** 엑셀 한 줄의 업체를 고객 운영 업체에 맞춘다 — 사업자번호가 같거나, 이름이 같으면 */
export function matchOsClient(comp: Rec, clients: readonly ClientOpsRecord[]): ClientOpsRecord | undefined {
  const b = digits(comp.bizNo)
  if (b.length >= 10) {
    const hit = clients.find((c) => digits(c.businessNumber) === b)
    if (hit) return hit
  }
  const n = plainName(comp.name)
  if (!n) return undefined
  return clients.find((c) => plainName(c.companyName) === n)
}
