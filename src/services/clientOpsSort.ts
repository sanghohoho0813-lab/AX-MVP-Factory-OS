/**
 * 고객 목록 정렬 — 무엇을 기준으로 훑을 것인가.
 *
 * 기본은 '급한 순' 이다. 목록을 여는 이유의 대부분이 "오늘 뭐부터 챙기지" 이기 때문이다.
 * 그런데 전화를 받았을 때는 이름으로 찾고, 정책자금 자격을 볼 때는 업력으로 보고,
 * 계약 관리를 할 때는 계약일로 본다 — 그때마다 기준을 바꿀 수 있어야 한다.
 *
 * 순수 함수이므로 단위 시험으로 고정한다.
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { sortClientsByUrgency } from './clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'

const localDateOf = (iso: string) => {
  const x = new Date(iso)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
import { yearsInBusiness } from './clientOpsProfile'
import { monthsSinceContract } from './contractSummary'

export type ClientSortKey = 'active' | 'urgency' | 'name' | 'years' | 'contract'

/** D-159: 기본은 '요즘 챙기는 순'(대표) — 최근에 한 일 · 다가오는 일정 · 급한 경고가 많은 업체가 위로 */
export const CLIENT_SORT_ORDER: ClientSortKey[] = ['active', 'urgency', 'name', 'years', 'contract']

export const CLIENT_SORT_LABEL: Record<ClientSortKey, string> = {
  active: '요즘 챙기는 순',
  urgency: '급한 순',
  name: '가나다순',
  years: '업력순',
  contract: '계약 오래된 순',
}

export const CLIENT_SORT_HINT: Record<ClientSortKey, string> = {
  active: '최근에 한 일 · 다가오는 일정이 많은 곳이 위로',
  urgency: '마감 지남·연체가 위로',
  name: '업체 이름 순서대로',
  years: '오래된 회사가 위로',
  contract: '오래 함께한 업체가 위로',
}

export function isClientSortKey(v: unknown): v is ClientSortKey {
  return typeof v === 'string' && (CLIENT_SORT_ORDER as string[]).includes(v)
}

const DAY_MS = 86_400_000
const dayNum = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY_MS

/**
 * D-159: '요즘 챙기는' 점수 — 최근 30일에 한 일(활동 기록 · 메모 · 미팅) 1점씩(가까울수록 더) +
 * 앞으로 14일 안 일정(다음 약속 · 업무 마감 · 수금 · 신청 마감) 2점씩 + 14일 안에 지난 마감 3점씩(더 묵은 것 1점). 계약 끝남 · 보관은 맨 뒤.
 * 같으면 마지막으로 손댄 날이 최근인 곳 먼저.
 */
export function activityScore(r: ClientOpsRecord, today: string): { score: number; last: string } {
  if (r.archivedAt !== null || r.status === 'completed') return { score: -1, last: '' }
  const t = dayNum(today)
  let score = 0
  let last = ''
  const touch = (iso: string | null | undefined) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return
    // D-161: 시각이 붙은 기록은 이 기기의 날짜로(한국 새벽 0~9시 기록이 전날로 세지던 것) · 앞날 기록은 세지 않는다
    const d = iso.length > 10 && !Number.isNaN(Date.parse(iso)) ? localDateOf(iso) : iso.slice(0, 10)
    if (d > today) return
    if (d > last) last = d
    const ago = t - dayNum(d)
    if (ago >= 0 && ago <= 30) score += ago <= 7 ? 2 : 1
  }
  for (const a of r.activity) touch(a.at)
  for (const n of r.notes_list) touch(n.createdAt)
  for (const m of r.sales?.meetings ?? []) touch(m.at)
  const ahead = (d: string | null | undefined, open = true) => {
    if (!open || !d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return
    const left = dayNum(d) - t
    // 막 지난 마감(14일 안)은 지금 챙길 일 — 오래 묵은 마감은 '급한 순' 이 따로 보여 준다(여기서는 1점)
    if (left < 0) score += left >= -14 ? 3 : 1
    else if (left <= 14) score += 2
  }
  ahead(r.nextActionDueDate)
  for (const s of Object.values(r.services)) ahead(s?.dueDate, s?.status === 'in_progress' || s?.status === 'waiting_client')
  for (const f of r.fees) ahead(f.dueDate, f.receivedAt === null)
  for (const a of r.fundingApplications) ahead(a.applyDueDate, a.status === 'watching' || a.status === 'preparing')
  return { score, last: last || (r.updatedAt ?? '').slice(0, 10) }
}

/**
 * 값이 없는 업체는 언제나 맨 뒤로 보낸다.
 * 설립일을 아직 안 적은 업체가 '업력순' 에서 맨 위에 오면 목록을 못 믿게 된다.
 */
function byNumberDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

export function sortClients(
  records: ClientOpsRecord[],
  key: ClientSortKey,
  today: string = todayLocalDate(),
): ClientOpsRecord[] {
  const list = [...records]
  switch (key) {
    case 'active': {
      const score = new Map(list.map((r) => [r.id, activityScore(r, today)]))
      return list.sort((a, b) => {
        const sa = score.get(a.id)!
        const sb = score.get(b.id)!
        return sb.score - sa.score || sb.last.localeCompare(sa.last) || a.companyName.localeCompare(b.companyName, 'ko')
      })
    }
    case 'urgency':
      return sortClientsByUrgency(list, today)
    case 'name':
      // 한글 이름은 코드 순서가 아니라 사람이 읽는 순서로 — localeCompare('ko')
      return list.sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'))
    case 'years':
      return list.sort(
        (a, b) =>
          byNumberDesc(
            yearsInBusiness(a.establishedAt, today)?.nthYear ?? null,
            yearsInBusiness(b.establishedAt, today)?.nthYear ?? null,
          ) || a.companyName.localeCompare(b.companyName, 'ko'),
      )
    case 'contract':
      return list.sort(
        (a, b) =>
          byNumberDesc(
            monthsSinceContract(a.contract.signedAt, today),
            monthsSinceContract(b.contract.signedAt, today),
          ) || a.companyName.localeCompare(b.companyName, 'ko'),
      )
  }
}
