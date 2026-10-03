/**
 * 지원사업 알림 화면 묶음 (D-141) — 업체 목록 × 공고 목록을 한 번 계산해 화면 여러 곳(알림 · 업체 상세 · 오늘)이 같이 쓴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { isContractClient, isProspect } from '../salesPipeline'
import { NO_RULES, deadlineOf, deadlineRank, matchGrant, regionHit, verdictRank, type CompanyProfile, type GrantMatch, type GrantNotice } from './grantMatch'
import { profileOfRecord } from './grantProfile'
import { FINDER_PATH, profileToQuery, type NoticeDraft } from './grantText'

/** 공고 적기 칸 — 저장 전 모양 */
export type NoticeInput = NoticeDraft & { published: boolean }

export const emptyNotice = (): NoticeInput => ({
  title: '',
  agency: '',
  operator: '',
  category: 'money',
  applyStart: '',
  applyEnd: '',
  deadlineKind: 'date',
  amountText: '',
  target: '',
  summary: '',
  url: '',
  rules: { ...NO_RULES, regions: [], cities: [], industries: [], excludeIndustries: [], sizes: [], certs: [] },
  source: 'manual',
  published: false,
})


export type GrantClientKind = 'contract' | 'prospect'

export const CLIENT_KIND_LABEL: Record<GrantClientKind, string> = { contract: '계약 고객', prospect: '잠재고객' }

export interface GrantClient {
  record: ClientOpsRecord
  profile: CompanyProfile
  kind: GrantClientKind
}

/** 보관하지 않은 업체 전부 — 계약 고객 · 잠재고객(보류 · 이탈 포함: 새 공고가 다시 연락할 이유가 된다) */
export function grantClients(records: readonly ClientOpsRecord[], today: string): GrantClient[] {
  const out: GrantClient[] = []
  for (const r of records) {
    const kind: GrantClientKind | null = isContractClient(r) ? 'contract' : isProspect(r) ? 'prospect' : null
    if (kind) out.push({ record: r, profile: profileOfRecord(r, today), kind })
  }
  return out
}

export interface ClientMatch {
  client: GrantClient
  match: GrantMatch
}

const byClientOrder = (a: ClientMatch, b: ClientMatch) =>
  verdictRank(a.match.verdict) - verdictRank(b.match.verdict) ||
  (a.client.kind === 'contract' ? 0 : 1) - (b.client.kind === 'contract' ? 0 : 1) ||
  a.match.unknownCount - b.match.unknownCount ||
  a.client.record.companyName.localeCompare(b.client.record.companyName)

/**
 * 공고마다 맞는 업체(맞음 → 확인 필요 순 · 계약 고객 먼저).
 * 안 맞는 업체와 '전국 공통'(누구나 되는 공고)은 뺀다 — 업체를 겨냥한 공고만 '맞는 업체' 로 센다.
 */
export function clientsForNotice(notice: GrantNotice, clients: readonly GrantClient[], today: string): ClientMatch[] {
  return clients
    .map((client) => ({ client, match: matchGrant(notice, client.profile, today) }))
    .filter((x) => x.match.verdict === 'fit' || x.match.verdict === 'check')
    .sort(byClientOrder)
}

export interface GrantIndex {
  /** 공고 id → 맞는 업체(맞음 · 확인 필요) */
  byNotice: Map<string, ClientMatch[]>
  /** 업체 id → 맞는 공고(접수 중 · 안 맞음 뺌 · 전국 공통 포함) */
  byClient: Map<string, GrantMatch[]>
}

/**
 * 업체 × 공고를 한 번만 계산한다(D-143) — 기업마당 1,000건 × 업체 수백 곳이어도 화면마다 다시 계산하지 않게.
 * 마감된 공고는 건너뛴다. 같은 공고 목록 · 같은 업체 목록이면 저장해 둔 결과를 그대로 준다.
 */
const indexCache = new WeakMap<readonly GrantNotice[], WeakMap<readonly GrantClient[], { today: string; index: GrantIndex }>>()
export function grantIndex(notices: readonly GrantNotice[], clients: readonly GrantClient[], today: string): GrantIndex {
  const hit = indexCache.get(notices)?.get(clients)
  if (hit && hit.today === today) return hit.index
  const byNotice = new Map<string, ClientMatch[]>()
  const byClient = new Map<string, GrantMatch[]>(clients.map((c) => [c.record.id, []]))
  for (const notice of notices) {
    const d = deadlineOf(notice, today)
    if (d.state === 'closed') continue
    const list: ClientMatch[] = []
    const regions = notice.rules.regions
    for (const client of clients) {
      // 다른 시·도 공고는 바로 건너뛴다(지역 공고가 대부분이라 계산이 크게 준다) — matchGrant 도 '안 맞음' 으로 판정한다
      if (regions.length && client.profile.sido && !regionHit(regions, client.profile)) continue
      const match = matchGrant(notice, client.profile, today, d)
      if (match.verdict === 'no') continue
      if (match.verdict !== 'general') list.push({ client, match })
      if (d.state !== 'upcoming') byClient.get(client.record.id)?.push(match)
    }
    byNotice.set(notice.id, list.sort(byClientOrder))
  }
  for (const ms of byClient.values()) ms.sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || deadlineRank(a.deadline) - deadlineRank(b.deadline) || a.notice.title.localeCompare(b.notice.title))
  const index = { byNotice, byClient }
  let inner = indexCache.get(notices)
  if (!inner) indexCache.set(notices, (inner = new WeakMap()))
  inner.set(clients, { today, index })
  return index
}

/** 업체에 '맞춤'(지역 · 업력 · 업종까지 맞음)인 공고 수 · 7일 안 마감 수 */
export function fitSummary(ms: readonly GrantMatch[]): { fit: number; check: number; general: number; urgentFit: number } {
  let fit = 0
  let check = 0
  let general = 0
  let urgentFit = 0
  for (const m of ms) {
    if (m.verdict === 'fit') {
      fit += 1
      if (m.deadline.urgent) urgentFit += 1
    } else if (m.verdict === 'check') check += 1
    else if (m.verdict === 'general') general += 1
  }
  return { fit, check, general, urgentFit }
}

export interface NoticeReach {
  fit: number
  check: number
  contract: number
  prospect: number
}

export function reachOf(list: readonly ClientMatch[]): NoticeReach {
  return {
    fit: list.filter((x) => x.match.verdict === 'fit').length,
    check: list.filter((x) => x.match.verdict === 'check').length,
    contract: list.filter((x) => x.match.verdict === 'fit' && x.client.kind === 'contract').length,
    prospect: list.filter((x) => x.match.verdict === 'fit' && x.client.kind === 'prospect').length,
  }
}

/** 가망고객에게 보내는 찾기 링크 — 조건 구간만 붙는다(연락처 · 번호 없음) */
export function finderLink(origin: string, profile: CompanyProfile | null, from = ''): string {
  const q = profile ? profileToQuery(profile, { from }) : from ? `from=${encodeURIComponent(from)}` : ''
  return `${origin.replace(/\/$/, '')}${FINDER_PATH}${q ? `?${q}` : ''}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand?.('copy') ?? false
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export interface GrantAlert {
  notice: GrantNotice
  deadlineLabel: string
  days: number | null
  /** 조건 맞음인데 아직 이 공고를 안 알린 업체 */
  pending: ClientMatch[]
}

/** 오늘 화면 — 7일 안에 끝나는 공고 중 맞는 업체에 아직 안 알린 것 (급한 순 · 최대 n개) */
export function urgentGrantAlerts(
  notices: readonly GrantNotice[],
  clients: readonly GrantClient[],
  sent: readonly { clientId: string; noticeIds: string[] }[],
  today: string,
  n = 3,
): GrantAlert[] {
  const out: GrantAlert[] = []
  const index = grantIndex(notices, clients, today)
  for (const notice of notices) {
    if (notice.source === 'example') continue
    const d = deadlineOf(notice, today)
    if (!d.open || !d.urgent) continue
    const pending = (index.byNotice.get(notice.id) ?? []).filter((x) => x.match.verdict === 'fit' && !sent.some((s) => s.clientId === x.client.record.id && s.noticeIds.includes(notice.id)))
    if (pending.length) out.push({ notice, deadlineLabel: d.label, days: d.days, pending })
  }
  return out.sort((a, b) => (a.days ?? 99) - (b.days ?? 99) || b.pending.length - a.pending.length).slice(0, n)
}
