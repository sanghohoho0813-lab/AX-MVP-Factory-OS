/**
 * 계약에서 파생되는 값 — 몇 개월째인가, 한 줄로 어떻게 읽히는가, 무엇을 해 드렸는가.
 *
 * 저장하지 않고 매번 계산한다. 날짜가 지나면 '18개월째' 가 저절로 '19개월째' 가 된다.
 * 순수 함수이므로 단위 시험으로 고정한다.
 */

import type { ClientOpsRecord, ContractInfo, ServiceKey } from '../types/clientOps'
import { CONTRACT_KIND_LABEL } from '../types/clientOps'
import { SERVICES } from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'
import { formatKrw } from '../lib/format'

function ymd(s: string): [number, number, number] | null {
  const t = s.trim()
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t)
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return [y, mo, d]
}

/**
 * 계약한 지 몇 달째인가 — 사람이 세는 방식(계약한 달이 1개월째).
 * 앞으로의 날짜이거나 읽을 수 없으면 null.
 */
export function monthsSinceContract(signedAt: string, today: string = todayLocalDate()): number | null {
  const s = ymd(signedAt)
  const t = ymd(today)
  if (!s || !t) return null
  let months = (t[0] - s[0]) * 12 + (t[1] - s[1])
  // 그 달의 계약일이 아직 안 지났으면 한 달을 빼고, 사람이 세는 '1개월째' 로 +1
  if (t[2] < s[2]) months -= 1
  const nth = months + 1
  return nth >= 1 && nth < 1200 ? nth : null
}

/** '18개월째' · 1년이 넘으면 '1년 6개월째 (18개월)' */
export function contractAgeText(signedAt: string, today: string = todayLocalDate()): string {
  const n = monthsSinceContract(signedAt, today)
  if (n === null) return ''
  if (n < 12) return `${n}개월째`
  const y = Math.floor(n / 12)
  const m = n % 12
  return m === 0 ? `${y}년째 (${n}개월)` : `${y}년 ${m}개월째 (${n}개월)`
}

/**
 * 좁은 칸용 — '18개월째' · '1년 6개월째'.
 * 목록 카드에는 괄호 안 총 개월수를 붙이지 않는다. 한 줄에 들어가는 것이 먼저다.
 */
export function contractAgeShort(signedAt: string, today: string = todayLocalDate()): string {
  const n = monthsSinceContract(signedAt, today)
  if (n === null) return ''
  if (n < 12) return `${n}개월째`
  const y = Math.floor(n / 12)
  const m = n % 12
  return m === 0 ? `${y}년째` : `${y}년 ${m}개월째`
}

/** 보험 계약들의 월납보험료 합계. 금액이 하나도 없으면 null */
export function monthlyPremiumTotal(contract: ContractInfo): number | null {
  const known = contract.policies.map((p) => p.monthlyPremium).filter((v): v is number => typeof v === 'number')
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0)
}

export interface ContractSummary {
  /** 계약 정보가 하나라도 들어 있는가 */
  hasAny: boolean
  /** '2024-03-15' */
  signedAt: string
  /** '1년 6개월째 (18개월)' */
  ageText: string
  /** '현금 + 보험' */
  kindLabel: string
  /** '현금 500만원 · 월납 35만원' — 돈 한 줄 */
  moneyText: string
  /** 보험 건수 */
  policyCount: number
}

/**
 * 계약 한 줄 요약.
 * 없는 값은 만들어 내지 않는다 — 금액을 안 적었으면 금액 줄이 비어 있다.
 */
export function summarizeContract(contract: ContractInfo, today: string = todayLocalDate()): ContractSummary {
  const money: string[] = []
  if (typeof contract.cashAmount === 'number' && contract.cashAmount > 0) money.push(`현금 ${formatKrw(contract.cashAmount)}`)
  const premium = monthlyPremiumTotal(contract)
  if (premium !== null && premium > 0) money.push(`월납 ${formatKrw(premium)}`)

  return {
    hasAny:
      contract.signedAt.trim() !== '' ||
      contract.kind !== '' ||
      contract.cashAmount !== null ||
      contract.policies.length > 0 ||
      contract.note.trim() !== '',
    signedAt: contract.signedAt.trim(),
    ageText: contractAgeText(contract.signedAt, today),
    kindLabel: contract.kind === '' ? '' : CONTRACT_KIND_LABEL[contract.kind],
    moneyText: money.join(' · '),
    policyCount: contract.policies.length,
  }
}

/* ------------------------------------------------------------------ */
/* 무엇을 해 드렸는가                                                    */
/* ------------------------------------------------------------------ */

export interface DoneWork {
  key: ServiceKey
  label: string
  /** 완료일 (YYYY-MM-DD). 모르면 '' */
  at: string
}

/**
 * 끝낸 일 목록 — 최근에 끝낸 것이 위로.
 *
 * 새로 기록하게 만들지 않는다. 이미 업무별로 '완료' 와 완료 시각이 저장돼 있으므로
 * 그것을 모아 보여 줄 뿐이다.
 */
export function doneWorks(record: ClientOpsRecord): DoneWork[] {
  return SERVICES.filter((s) => record.services[s.key]?.status === 'done')
    .map((s) => ({
      key: s.key,
      label: s.label,
      at: (record.services[s.key]?.completedAt ?? '').slice(0, 10),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}
