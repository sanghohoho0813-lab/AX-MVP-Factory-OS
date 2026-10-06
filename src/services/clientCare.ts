/**
 * 계약 고객 돌봄 (D-155) — 계약하고 나서 조용해진 고객 · 계약 1주년이 다가오는 고객을 먼저 챙긴다.
 *
 *   마지막으로 챙긴 날 = 연락했어요 · 업체 메모 · 미팅 기록 · 업체 기록에 남은 일(업무 · 서류 · 입금 · 지원사업 · 계약 · 도구) 중 가장 최근.
 *     (보관 · 회사 정보 고침은 고객과 닿은 일이 아니라 넣지 않는다)
 *   조용함 — 30일 넘게 챙긴 것이 없으면 '한 달 넘게 조용', 60일 넘으면 급함.
 *   1주년 — 계약일이 해마다 돌아오는 날이 30일 안(지난 7일까지 포함)이면 성과 보고서 드리고 재계약 이야기할 때.
 *     그 날 30일 전부터 [연락했어요] 를 눌렀으면 챙긴 것으로 본다.
 *   [다음에] — 정한 날까지 목록에서 뺀다.
 *
 * 규칙 계산이다 — 외부 호출 · LLM 0. 저장은 업체 기록 payload 의 `care` 하나(DB 변경 없음).
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { contractStageOf } from '../types/clientOps'
import { buildClientReport, wonShort } from './clientReport'
import { withActivity } from './clientOpsActivity'
import { brand } from '../brand/brand.config'
import { localDateOf, nowDate } from '../lib/appClock'

export const CARE_QUIET_DAYS = 30
export const CARE_URGENT_DAYS = 60
export const CARE_ANNIVERSARY_AHEAD = 30
export const CARE_ANNIVERSARY_AFTER = 7

export type CareReason = 'quiet' | 'anniversary'

export interface CareItem {
  clientId: string
  companyName: string
  reason: CareReason
  /** 급함 — 60일 넘게 조용 · 1주년 7일 안(지났어도) */
  urgent: boolean
  /** 마지막으로 챙긴 날 (YYYY-MM-DD) · 없으면 '' */
  lastTouch: string
  /** 마지막으로 챙긴 뒤 지난 날 수 */
  quietDays: number
  /** 무엇으로 챙겼나 — '메모' · '입금 확인' … */
  lastTouchWhat: string
  /** 1주년일 때: 그 날 · 몇 해째 · 남은 날(지났으면 음수) */
  anniversary?: { date: string; years: number; daysLeft: number }
  /** 한 줄 설명 */
  text: string
}

const DAY = /^\d{4}-\d{2}-\d{2}/
const dayOf = (iso: string | null | undefined) => (iso && DAY.test(iso) ? iso.slice(0, 10) : '')
/** 저장된 시각(UTC ISO) → 한국(이 기기) 날짜. 9/6 오전 8시 반 메모가 9/5 로 잡히지 않게 */
const localDay = (iso: string | null | undefined) => (iso && DAY.test(iso) ? localDateOf(iso) : '')

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

function addDays(ymd: string, n: number): string {
  const t = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n))
  return t.toISOString().slice(0, 10)
}

const ACTIVITY_WHAT: Partial<Record<ClientOpsRecord['activity'][number]['kind'], string>> = {
  service_status: '업무 진행',
  service_due: '업무 일정',
  document: '서류',
  fee_added: '수금 항목',
  fee_received: '입금 확인',
  funding_added: '지원사업',
  funding_status: '지원사업',
  contract: '계약',
  tool: '분석 · 판정',
  sales: '영업',
  care: '안부 연락',
}

/** 마지막으로 챙긴 날과 무엇으로 챙겼는지 */
export function lastTouchOf(record: ClientOpsRecord): { date: string; what: string } {
  let best = { date: '', what: '' }
  const take = (date: string, what: string) => {
    if (date && date > best.date) best = { date, what }
  }
  take(dayOf(record.care?.lastContactAt), '안부 연락')
  for (const n of record.notes_list) take(localDay(n.createdAt), '메모')
  for (const m of record.sales?.meetings ?? []) take(localDay(m.at), '미팅')
  for (const a of record.activity) {
    const what = ACTIVITY_WHAT[a.kind]
    if (what) take(localDay(a.at), what)
  }
  if (!best.date) take(dayOf(record.contract.signedAt) || localDay(record.createdAt), '계약')
  return best
}

/** 계약일이 해마다 돌아오는 날 중 today 기준 가장 가까운 것(지난 7일 ~ 앞으로) — 1년이 안 됐으면 null */
export function nextAnniversary(signedAt: string, today: string): { date: string; years: number; daysLeft: number } | null {
  const s = dayOf(signedAt)
  if (!s) return null
  const mmdd = s.slice(5)
  for (const y of [+today.slice(0, 4) - 1, +today.slice(0, 4), +today.slice(0, 4) + 1]) {
    // 2/29 계약은 평년엔 2/28
    let date = `${y}-${mmdd}`
    if (mmdd === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) date = `${y}-02-28`
    const years = y - +s.slice(0, 4)
    if (years < 1) continue
    const daysLeft = daysBetween(today, date)
    if (daysLeft >= -CARE_ANNIVERSARY_AFTER) return { date, years, daysLeft }
  }
  return null
}

/** 계약 중인 업체(보관 · 계약 끝남 · 계약 전 제외) */
const isCareTarget = (r: ClientOpsRecord) => r.archivedAt === null && contractStageOf(r.status) === 'signed'

export function careItemFor(record: ClientOpsRecord, today: string): CareItem | null {
  if (!isCareTarget(record)) return null
  const snooze = dayOf(record.care?.snoozeUntil)
  if (snooze && snooze > today) return null
  const touch = lastTouchOf(record)
  const quietDays = touch.date ? Math.max(0, daysBetween(touch.date, today)) : 0
  const base = { clientId: record.id, companyName: record.companyName, lastTouch: touch.date, lastTouchWhat: touch.what, quietDays }

  const ann = nextAnniversary(record.contract.signedAt, today)
  if (ann && ann.daysLeft <= CARE_ANNIVERSARY_AHEAD) {
    const contacted = dayOf(record.care?.lastContactAt)
    const handled = contacted && contacted >= addDays(ann.date, -CARE_ANNIVERSARY_AHEAD)
    if (!handled) {
      const when = ann.daysLeft > 0 ? `${ann.daysLeft}일 남음` : ann.daysLeft === 0 ? '오늘' : `${-ann.daysLeft}일 지남`
      return {
        ...base,
        reason: 'anniversary',
        urgent: ann.daysLeft <= 7,
        anniversary: ann,
        text: `계약 ${ann.years}주년 ${Number(ann.date.slice(5, 7))}/${Number(ann.date.slice(8, 10))}(${when}) — 성과 보고서 드리고 재계약 이야기`,
      }
    }
  }
  if (touch.date && quietDays >= CARE_QUIET_DAYS) {
    return {
      ...base,
      reason: 'quiet',
      urgent: quietDays >= CARE_URGENT_DAYS,
      text: `${quietDays}일째 조용 — 마지막: ${Number(touch.date.slice(5, 7))}/${Number(touch.date.slice(8, 10))} ${touch.what}`,
    }
  }
  return null
}

/** 챙길 계약 고객 — 급한 것 먼저, 그다음 1주년(가까운 순), 그다음 조용함(오래된 순) */
export function careList(records: ClientOpsRecord[], today: string): CareItem[] {
  const items = records.map((r) => careItemFor(r, today)).filter((x): x is CareItem => x !== null)
  const kind = (i: CareItem) => (i.reason === 'anniversary' ? 0 : 1)
  const score = (i: CareItem) => (i.reason === 'anniversary' ? (i.anniversary?.daysLeft ?? 0) : -i.quietDays)
  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || kind(a) - kind(b) || score(a) - score(b) || a.companyName.localeCompare(b.companyName, 'ko'))
}

/** [연락했어요] — 오늘 챙긴 것으로. 미루기는 지운다. 활동 기록에 한 줄. */
export function withCareContact(record: ClientOpsRecord, today: string, at: string = nowDate().toISOString()): ClientOpsRecord {
  const next: ClientOpsRecord = { ...record, care: { lastContactAt: today } }
  return withActivity(next, 'care', '안부 연락함', null, at)
}

/**
 * [다음에] 를 누르면 언제까지 뺄지 — 보통 2주.
 * 1주년은 그 날이 지나 7일까지만 목록에 있으므로 그보다 늦게 미루면 그해 1주년을 통째로 놓친다 → 1주년 마지막 날까지만.
 */
export function careSnoozeUntil(item: CareItem, today: string): string {
  const twoWeeks = addDays(today, 14)
  if (item.reason !== 'anniversary' || !item.anniversary) return twoWeeks
  const last = addDays(item.anniversary.date, CARE_ANNIVERSARY_AFTER)
  const until = last < twoWeeks ? last : twoWeeks
  return until > today ? until : addDays(today, 1)
}

/** [다음에] — 정한 날까지 돌봄 목록에서 뺀다 */
export function withCareSnooze(record: ClientOpsRecord, until: string): ClientOpsRecord {
  const care = { ...(record.care ?? {}) }
  if (DAY.test(until)) care.snoozeUntil = until.slice(0, 10)
  else delete care.snoozeUntil
  return { ...record, care }
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/** 안부 카톡 문구 — 고객이 봐도 되는 것만(성과 보고서와 같은 규칙) */
export function careMessage(record: ClientOpsRecord, item: CareItem, today: string, sender?: string): string {
  const who = record.representativeName ? `${record.representativeName} 대표님` : `${record.companyName} 담당자님`
  // D-162: 보내는 사람 — 주지 않으면 대표(지금처럼). Pilot 화면은 자기 이름을 넘긴다
  const me = sender?.trim() || `${brand.brandNameKo} ${brand.ownerName} ${brand.ownerTitle}`
  const r = buildClientReport(record, today, item.reason === 'anniversary' ? 'last12' : 'contract')
  const lines = [`안녕하세요, ${who}. ${me}입니다.`]
  if (item.reason === 'anniversary' && item.anniversary) {
    lines.push(`벌써 함께한 지 ${item.anniversary.years}년이 ${item.anniversary.daysLeft > 0 ? '되어 갑니다' : '되었습니다'}. 늘 믿고 맡겨 주셔서 감사합니다.`)
  } else {
    lines.push('요즘 사업은 어떠신지 안부 여쭙니다.')
  }
  const done: string[] = []
  if (r.headline.securedBasis !== 'none') done.push(`${r.headline.securedBasis === 'executed' ? '자금 확보' : '지원사업 선정'} ${wonShort(r.headline.securedTotal)}`)
  if (r.done.length) done.push(r.done.slice(-3).map((d) => d.label).join(' · '))
  if (done.length) lines.push(`${item.reason === 'anniversary' ? '지난 1년' : '그동안'} 함께 ${done.join(', ')}까지 해 왔습니다.`)
  const next = r.next[0]
  if (next) lines.push(`다음으로 ${md(next.date)} ${next.text} 챙기고 있습니다.`)
  lines.push(
    item.reason === 'anniversary'
      ? '그동안의 성과를 한 장으로 정리해 드리고, 앞으로 1년 챙길 것도 함께 말씀드리고 싶습니다. 편하신 때 30분 뵐 수 있을까요?'
      : '필요하신 것 있으시면 편하게 말씀 주세요. 감사합니다.',
  )
  return lines.join('\n')
}
