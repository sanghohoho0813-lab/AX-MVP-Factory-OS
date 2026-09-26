/**
 * 영업 파이프라인 (D-114) — 계약 전 고객도 고객 관리 한 장부에서.
 *
 * 기업컨설팅 OS(영업 도구 모음)의 단계 · 이력 규칙을 옮겼다. 순수 함수만 둔다(저장은 clientOpsService).
 * 순환 참조를 피하려고 clientOpsService 를 읽지 않는다 — 타입과 활동 기록 도우미만 쓴다.
 */

import {
  SALES_FLOW_STAGES,
  SALES_STAGE_LABEL,
  SALES_STAGE_ORDER,
  contractStageOf,
  emptySales,
  isSalesPath,
  isSalesStage,
  type ClientOpsRecord,
  type SalesInfo,
  type SalesMeetingNote,
  type SalesProposal,
  type SalesStage,
  type SalesStageEvent,
} from '../types/clientOps'
import { withActivity } from './clientOpsActivity'

/** 단계 이력은 이만큼만 남긴다 */
const HISTORY_LIMIT = 60

/**
 * 기업컨설팅 OS 의 15단계 키 → 8단계 (원본 PIPE6 대응표 그대로).
 * 원본은 보류와 이탈을 한 칸에 모았지만 여기서는 이탈을 따로 둔다.
 */
const LEGACY_STAGE: Record<string, SalesStage> = {
  lead: 'lead',
  contacted: 'lead',
  meeting_proposed: 'lead',
  meeting1_scheduled: 'm1sched',
  meeting1_done: 'm1done',
  docs_requested: 'm1done',
  docs_received: 'm1done',
  proposal_sent: 'm2',
  meeting2_scheduled: 'm2',
  meeting2_done: 'm2',
  closing_scheduled: 'closing',
  decision_pending: 'closing',
  contracted: 'contracted',
  hold: 'hold',
  lost: 'lost',
}

/** 새 단계 키 또는 원본 15단계 키 → 8단계. 모르면 null */
export function salesStageFrom(v: unknown): SalesStage | null {
  if (isSalesStage(v)) return v
  if (typeof v === 'string' && v in LEGACY_STAGE) return LEGACY_STAGE[v]
  return null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** 미팅 기록은 이만큼만 남긴다 */
const MEETING_LIMIT = 30

function normalizeProposal(p: Record<string, unknown>): SalesProposal {
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
  const m = p.monthly && typeof p.monthly === 'object' ? (p.monthly as Record<string, unknown>) : null
  return {
    packages: [...new Set(strList(p.packages))],
    feeManwon: n(p.feeManwon, 0),
    status: str(p.status) || '제안 전',
    at: str(p.at),
    monthly: m && n(m.premium, 0) > 0
      ? { premium: n(m.premium, 0), months: n(m.months, 84) || 84, rate: n(m.rate, 100), netIncome: typeof m.netIncome === 'number' && m.netIncome > 0 ? m.netIncome : null }
      : null,
  }
}

function normalizeMeetings(list: unknown[]): SalesMeetingNote[] {
  const out: SalesMeetingNote[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const m = raw as Record<string, unknown>
    if (typeof m.id !== 'string' || typeof m.at !== 'string') continue
    const round = m.round === 2 || m.round === 3 ? m.round : 1
    out.push({ id: m.id, at: m.at, round, text: str(m.text), reaction: str(m.reaction), issues: strList(m.issues), hesitant: strList(m.hesitant), nextDocs: strList(m.nextDocs) })
  }
  return out.slice(0, MEETING_LIMIT)
}

function normalizeHistory(v: unknown): SalesStageEvent[] {
  if (!Array.isArray(v)) return []
  const out: SalesStageEvent[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const to = salesStageFrom(e.to)
    if (!to || typeof e.at !== 'string') continue
    out.push({ at: e.at, from: salesStageFrom(e.from), to })
  }
  return out.slice(-HISTORY_LIMIT)
}

/** 저장된 값 → SalesInfo. 영업 칸이 없던 기록(예전 업체)은 null 그대로 */
export function normalizeSales(v: unknown): SalesInfo | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const stage = salesStageFrom(s.stage)
  if (!stage) return null
  const fee = typeof s.expectedFee === 'number' && Number.isFinite(s.expectedFee) && s.expectedFee >= 0 ? s.expectedFee : null
  const history = normalizeHistory(s.history)
  const out: SalesInfo = {
    stage,
    source: str(s.source).trim(),
    referrer: str(s.referrer).trim(),
    interests: Array.isArray(s.interests) ? [...new Set(s.interests.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))] : [],
    concern: str(s.concern),
    expectedFee: fee,
    history,
    movedAt: str(s.movedAt) || history[history.length - 1]?.at || '',
  }
  if (s.imported && typeof s.imported === 'object' && !Array.isArray(s.imported)) out.imported = s.imported as Record<string, unknown>
  // 2단계 칸 — 있을 때만 싣는다(없던 기록 모양은 그대로)
  const posNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  if (s.ceoAge !== undefined) out.ceoAge = posNum(s.ceoAge)
  if (s.revenueM !== undefined) out.revenueM = posNum(s.revenueM)
  if (s.flags && typeof s.flags === 'object' && !Array.isArray(s.flags)) {
    out.flags = Object.fromEntries(Object.entries(s.flags as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => [k, true]))
  }
  if (typeof s.memo === 'string') out.memo = s.memo
  if (Array.isArray(s.meetings)) out.meetings = normalizeMeetings(s.meetings)
  if (s.proposal && typeof s.proposal === 'object') out.proposal = normalizeProposal(s.proposal as Record<string, unknown>)
  if (Array.isArray(s.contractPrep)) out.contractPrep = [...new Set(strList(s.contractPrep))]
  if (isSalesPath(s.path)) out.path = s.path
  return out
}

/* ------------------------------------------------------------------ */
/* 누가 어느 칸에 있는가                                                  */
/* ------------------------------------------------------------------ */

/**
 * 이 업체의 영업 단계.
 * 영업 칸이 없는 예전 업체는 계약 단계로 짐작한다 — 계약 전이면 '잠재 고객', 계약했으면 '계약 완료'.
 */
export function salesStageOf(record: Pick<ClientOpsRecord, 'sales' | 'status'>): SalesStage {
  if (record.sales) return record.sales.stage
  return contractStageOf(record.status) === 'pre' ? 'lead' : 'contracted'
}

/**
 * 계약 고객 — 고객 관리 옆 숫자(D-114)가 세는 것.
 * 보관하지 않았고, 계약 단계가 '계약 전' 이 아닌 업체(계약함 · 계약 완료).
 */
export function isContractClient(record: Pick<ClientOpsRecord, 'status' | 'archivedAt'>): boolean {
  return record.archivedAt === null && contractStageOf(record.status) !== 'pre'
}

/** 잠재고객 — 보관하지 않았고 아직 계약 전인 업체 (보류 · 이탈 포함) */
export function isProspect(record: Pick<ClientOpsRecord, 'status' | 'archivedAt'>): boolean {
  return record.archivedAt === null && contractStageOf(record.status) === 'pre'
}

export function countContractClients(records: Pick<ClientOpsRecord, 'status' | 'archivedAt'>[]): number {
  return records.filter(isContractClient).length
}

/** 보드 칸별 묶음 — 보관한 업체는 뺀다. 칸 안은 최근에 옮긴 순 */
export function groupBySalesStage(records: ClientOpsRecord[]): Record<SalesStage, ClientOpsRecord[]> {
  const out = Object.fromEntries(SALES_STAGE_ORDER.map((s) => [s, [] as ClientOpsRecord[]])) as Record<SalesStage, ClientOpsRecord[]>
  for (const r of records) {
    if (r.archivedAt !== null) continue
    out[salesStageOf(r)].push(r)
  }
  const movedAt = (r: ClientOpsRecord) => r.sales?.movedAt || r.updatedAt
  for (const s of SALES_STAGE_ORDER) out[s].sort((a, b) => movedAt(b).localeCompare(movedAt(a)))
  return out
}

/**
 * 진행 중인 영업 — 잠재 고객 ~ 3차 클로징. 보드 · 오늘 화면 · KPI 가 모두 이 기준으로 센다(D-118).
 * 영업 칸이 없는 계약 전 업체도 '잠재 고객' 으로 들어간다(보드와 같다).
 */
export function salesInFlow(records: ClientOpsRecord[]): { list: ClientOpsRecord[]; fee: number } {
  const g = groupBySalesStage(records)
  const list = SALES_FLOW_STAGES.filter((s) => s !== 'contracted').flatMap((s) => g[s])
  return { list, fee: list.reduce((sum, r) => sum + (r.sales?.expectedFee ?? 0), 0) }
}

/** 이 단계에 머문 날 수 (옮긴 적이 없으면 null) */
export function daysInStage(record: Pick<ClientOpsRecord, 'sales'>, now: Date = new Date()): number | null {
  const at = record.sales?.movedAt
  if (!at) return null
  const t = Date.parse(at)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000))
}

/* ------------------------------------------------------------------ */
/* 바꾸기                                                               */
/* ------------------------------------------------------------------ */

function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 영업 단계를 옮긴다 — 이력 한 줄 · 활동 기록 한 줄.
 * '계약 완료' 로 옮기면 계약 단계도 따라간다: 계약 전이던 업체는 '계약함'(진행 중)이 되고 계약일이 비어 있으면 오늘.
 * 거꾸로 계약한 업체를 영업 단계에서 되돌려도 계약 단계는 건드리지 않는다(계약을 영업 화면에서 취소하지 않는다).
 */
export function withSalesStage(record: ClientOpsRecord, stage: SalesStage, at: string = new Date().toISOString()): ClientOpsRecord {
  const prev = record.sales
  // 영업 칸이 없던 업체는 계약 단계로 짐작한 칸에서 출발한다(보드에 보이던 칸)
  const from = prev ? prev.stage : salesStageOf(record)
  if (from === stage) return record
  const base: SalesInfo = prev ?? { ...emptySales(stage, at), history: [] }
  const history = [...base.history, { at, from, to: stage }].slice(-HISTORY_LIMIT)
  let next: ClientOpsRecord = { ...record, sales: { ...base, stage, history, movedAt: at } }
  if (stage === 'contracted' && contractStageOf(record.status) === 'pre') {
    next = {
      ...next,
      status: 'active',
      contract: { ...next.contract, signedAt: next.contract.signedAt || localDate(new Date(at)) },
    }
  }
  const text = `영업 단계 ${SALES_STAGE_LABEL[from]} → ${SALES_STAGE_LABEL[stage]}`
  return withActivity(next, 'sales', text, null, at)
}

export type SalesInfoPatch = Partial<Pick<SalesInfo, 'source' | 'referrer' | 'interests' | 'concern' | 'expectedFee'>>

/** 유입 경로 · 소개자 · 관심사 · 고민 · 예상 수임료 고치기 (영업 칸이 없으면 지금 단계로 만든다) */
export function withSalesInfo(record: ClientOpsRecord, patch: SalesInfoPatch, at: string = new Date().toISOString()): ClientOpsRecord {
  const base = record.sales ?? emptySales(salesStageOf(record), at)
  const merged = normalizeSales({ ...base, ...patch }) ?? base
  const changed: string[] = []
  if (patch.source !== undefined && merged.source !== base.source) changed.push('유입 경로')
  if (patch.referrer !== undefined && merged.referrer !== base.referrer) changed.push('소개자')
  if (patch.interests !== undefined && merged.interests.join('|') !== base.interests.join('|')) changed.push('관심사')
  if (patch.concern !== undefined && merged.concern !== base.concern) changed.push('대표 고민')
  if (patch.expectedFee !== undefined && merged.expectedFee !== base.expectedFee) changed.push('예상 수임료')
  if (changed.length === 0 && record.sales) return record
  const next = { ...record, sales: merged }
  return changed.length ? withActivity(next, 'sales', `영업 정보 수정 — ${changed.join(' · ')}`, null, at) : next
}

/** 새 잠재고객 · 상담신청에서 만든 업체에 처음 영업 칸을 붙인다 */
export function withNewProspect(record: ClientOpsRecord, source: string, at: string = new Date().toISOString()): ClientOpsRecord {
  if (record.sales) return record
  const sales = { ...emptySales('lead', at), source: source.trim() }
  return withActivity({ ...record, sales }, 'sales', `잠재고객 등록${sales.source ? ` · ${sales.source}` : ''}`, null, at)
}

/* ------------------------------------------------------------------ */
/* 기업컨설팅 OS(영업 도구 모음) 기록 옮기기                               */
/* ------------------------------------------------------------------ */

export interface LegacyAccountRow {
  clientId: string
  data: Record<string, unknown>
}

/**
 * 영업 도구 모음(모듈 기록 sales-kit/accounts)에 쌓인 업체별 영업 기록 → 고객 기록의 영업 칸.
 * 영업 칸이 아직 없는 업체만 한 번 옮긴다(이미 있으면 건드리지 않음 — 여러 번 불러도 같다).
 * 원본 줄은 지우지 않는다. 원래 기록 전체는 sales.imported 에 둔다 — 미팅 대본 · 점수 단계에서 쓴다.
 * 바뀐 업체만 돌려준다.
 */
function toNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(str(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function importLegacySalesAccounts(
  records: ClientOpsRecord[],
  rows: LegacyAccountRow[],
  at: string = new Date().toISOString(),
): ClientOpsRecord[] {
  const byClient = new Map(rows.filter((r) => r.clientId).map((r) => [r.clientId, r.data]))
  const out: ClientOpsRecord[] = []
  for (const rec of records) {
    if (rec.sales) continue
    const d = byClient.get(rec.id)
    if (!d) continue
    const stage = salesStageFrom(d.stage) ?? 'lead'
    const feeManwon = typeof d.expectedFee === 'number' ? d.expectedFee : parseFloat(str(d.expectedFee).replace(/[^0-9.]/g, ''))
    const sales: SalesInfo = {
      stage,
      source: (str(d.dbSource) || str(d.source)).trim(),
      referrer: str(d.referrer).trim(),
      interests: Array.isArray(d.interests) ? d.interests.filter((x): x is string => typeof x === 'string') : [],
      concern: str(d.concern),
      expectedFee: Number.isFinite(feeManwon) && feeManwon > 0 ? Math.round(feeManwon * 10_000) : null,
      history: [{ at, from: null, to: stage }],
      movedAt: at,
      imported: { ...d },
      // 2단계(미팅 준비)가 쓰는 칸 — 원본에 있던 값 그대로
      ceoAge: toNum(d.ceoAge),
      revenueM: toNum(d.revenue),
      flags: d.flags && typeof d.flags === 'object' ? (d.flags as Record<string, boolean>) : {},
      memo: str(d.memo),
    }
    const normalized = normalizeSales(sales) ?? sales
    out.push(withActivity({ ...rec, sales: normalized }, 'sales', `영업 도구 모음 기록 옮김 · ${SALES_STAGE_LABEL[stage]}`, null, at))
  }
  return out
}
