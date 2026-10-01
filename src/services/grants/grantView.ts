/**
 * 지원사업 알림 화면 묶음 (D-141) — 업체 목록 × 공고 목록을 한 번 계산해 화면 여러 곳(알림 · 업체 상세 · 오늘)이 같이 쓴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { isContractClient, isProspect } from '../salesPipeline'
import { NO_RULES, deadlineOf, matchGrant, type CompanyProfile, type GrantMatch, type GrantNotice } from './grantMatch'
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

/** 공고마다 맞는 업체(맞음 먼저 · 계약 고객 먼저) — 안 맞는 업체는 뺀다 */
export function clientsForNotice(notice: GrantNotice, clients: readonly GrantClient[], today: string): ClientMatch[] {
  return clients
    .map((client) => ({ client, match: matchGrant(notice, client.profile, today) }))
    .filter((x) => x.match.verdict !== 'no')
    .sort(
      (a, b) =>
        (a.match.verdict === 'fit' ? 0 : 1) - (b.match.verdict === 'fit' ? 0 : 1) ||
        (a.client.kind === 'contract' ? 0 : 1) - (b.client.kind === 'contract' ? 0 : 1) ||
        a.match.unknownCount - b.match.unknownCount ||
        a.client.record.companyName.localeCompare(b.client.record.companyName),
    )
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
  for (const notice of notices) {
    if (notice.source === 'example') continue
    const d = deadlineOf(notice, today)
    if (!d.open || !d.urgent) continue
    const pending = clientsForNotice(notice, clients, today).filter((x) => x.match.verdict === 'fit' && !sent.some((s) => s.clientId === x.client.record.id && s.noticeIds.includes(notice.id)))
    if (pending.length) out.push({ notice, deadlineLabel: d.label, days: d.days, pending })
  }
  return out.sort((a, b) => (a.days ?? 99) - (b.days ?? 99) || b.pending.length - a.pending.length).slice(0, n)
}
