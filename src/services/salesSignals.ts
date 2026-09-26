/**
 * 영업 신호 (D-114 4단계) — 기업컨설팅 OS 의 '영업 위험 신호' · '재접촉 명분' 규칙을 고객 관리 기록 위에서.
 *
 * 위험 신호(원본 riskSignals 5규칙, 한 업체에 하나 · 먼저 맞는 것):
 *   다음 할 일 날짜 지남 → 제안 완료 뒤 7일 후속 없음 → 견적 전달 뒤 7일 변화 없음 → 점수 70+ 인데 다음 할 일 없음 → 예상 수임료 300만+ 인데 미팅 기록 없음
 * 재접촉 명분(원본 recontactList): 60일 넘게 활동 없음 · 보류 30일 지남 이 **시점 이유** 이고,
 *   직원 · 연구소 · 정책자금 관심은 **덧붙이는 이유** 다. 원본은 직원만 있어도 거의 모든 업체를 올렸는데,
 *   목록이 업체 수만큼 길어져 쓸모가 없어서 시점 이유가 있는 곳만 올린다(DECISIONS D-117).
 * 순수 함수 · 규칙 계산.
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { salesStageOf } from './salesPipeline'
import { toEngineItem } from './salesMeeting'
import { scoreLead } from './salesEngine'
import type { ProposalTopic } from './salesLibrary'

const DAY = 86_400_000

function daysSince(iso: string | undefined | null, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isFinite(t) ? Math.floor((now.getTime() - t) / DAY) : null
}

/** 마지막으로 무슨 일이 있었던 날 — 활동 기록 맨 앞 · 미팅 기록 · 단계 옮긴 날 · 마지막 수정 중 가장 최근 */
export function lastSalesTouch(record: ClientOpsRecord): string | null {
  // 활동 기록이 없는 예전 업체는 마지막으로 고친 때(updatedAt)로 — '기록 없음' 으로 모두 오래된 곳이 되지 않게
  const cands = [record.activity[0]?.at, record.sales?.meetings?.[0]?.at, record.sales?.movedAt, record.updatedAt].filter((x): x is string => typeof x === 'string' && x !== '')
  if (cands.length === 0) return null
  const sorted = [...cands].sort()
  return sorted[sorted.length - 1]
}

export interface SalesRisk {
  record: ClientOpsRecord
  reason: string
  action: string
}

/** 영업 위험 신호 — 계약 완료 · 이탈 · 보관은 빼고, 최대 10곳 */
export function salesRisks(records: ClientOpsRecord[], today: string, now: Date = new Date()): SalesRisk[] {
  const out: SalesRisk[] = []
  for (const r of records) {
    if (r.archivedAt !== null) continue
    const stage = salesStageOf(r)
    if (stage === 'contracted' || stage === 'lost') continue
    const p = r.sales?.proposal
    const touch = daysSince(lastSalesTouch(r), now)
    let reason = ''
    let action = ''
    if (r.nextActionDueDate && r.nextActionDueDate < today) {
      const d = daysSince(r.nextActionDueDate, new Date(`${today}T00:00:00`)) ?? 0
      reason = `다음 할 일 날짜 ${d}일 지남`
      action = '연락하기'
    } else if (p?.status === '제안 완료' && (touch === null || touch >= 7)) {
      reason = '제안 완료 후 7일 이상 후속 없음'
      action = '견적 · 업무범위서 보내기'
    } else if (p?.status === '견적 전달' && (daysSince(p.at, now) ?? 99) >= 7) {
      reason = '견적 전달 후 7일 이상 변화 없음'
      action = '검토 상황 확인'
    } else if (scoreLead(toEngineItem(r, now)) >= 70 && r.nextAction.trim() === '') {
      reason = '계약 가능성 높은데 다음 할 일 없음'
      action = '다음 할 일 정하기'
    } else if ((r.sales?.expectedFee ?? 0) >= 3_000_000 && (r.sales?.meetings?.length ?? 0) === 0) {
      reason = '예상 수임료 높은데 미팅 기록 없음'
      action = '1차 미팅 제안'
    }
    if (reason) out.push({ record: r, reason, action })
  }
  return out.slice(0, 10)
}

export interface SalesRecontact {
  record: ClientOpsRecord
  reasons: string[]
  /** 복사할 연락 문구 (원본 문구 틀) */
  ment: string
  /** 마지막 활동 뒤 지난 날 */
  days: number
}

/** 다시 연락할 곳 — 오래 조용한 곳부터 최대 12곳 */
export function salesRecontacts(records: ClientOpsRecord[], now: Date = new Date()): SalesRecontact[] {
  const out: SalesRecontact[] = []
  for (const r of records) {
    if (r.archivedAt !== null) continue
    const stage = salesStageOf(r)
    const ds = daysSince(lastSalesTouch(r), now) ?? 999
    const timing: string[] = []
    if (ds >= 60) timing.push('최근 60일 이상 연락 이력이 없어 관리 접점 회복이 필요합니다.')
    if (stage === 'hold' && (daysSince(r.sales?.movedAt, now) ?? 0) >= 30) timing.push('보류 후 30일이 지나 재접촉 타이밍으로 볼 수 있습니다.')
    if (timing.length === 0) continue
    const extra: string[] = []
    const emp = parseInt(String(r.employeeCount ?? '').replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(emp) && emp > 0) extra.push('직원 수 변동 여부에 따라 고용지원금 검토 가능성을 다시 점검해볼 수 있습니다.')
    const it = r.sales?.interests ?? []
    if (it.includes('연구소')) extra.push('연구소·인증 요건 재점검 가능성이 있습니다.')
    if (it.includes('정책자금')) extra.push('정책자금·보증 관련 재점검 가능성이 있습니다.')
    const reasons = [...timing, ...extra].slice(0, 2)
    out.push({ record: r, reasons, days: ds, ment: `${r.companyName} 대표님, ${reasons[0]} 부담 없이 현황만 가볍게 점검해보시죠. 자료 확인 후 우선순위만 정리드리겠습니다.` })
  }
  return out.sort((a, b) => b.days - a.days).slice(0, 12)
}

/** 제안 주제 → 연락할 고객 (원본 relatedCustomersForTopic 규칙: 관심사 · 메모/고민 낱말 · 업종) */
export function customersForTopic(records: ClientOpsRecord[], topic: ProposalTopic): ClientOpsRecord[] {
  return records.filter((r) => {
    if (r.archivedAt !== null) return false
    const st = salesStageOf(r)
    if (st === 'lost') return false
    const its = r.sales?.interests ?? []
    if (topic.cats.some((c) => its.includes(c))) return true
    const text = `${r.sales?.concern ?? ''} ${r.sales?.memo ?? ''} ${r.industry} ${r.businessCategory}`
    if (topic.kw.some((k) => text.includes(k))) return true
    return (topic.industries ?? []).some((ind) => text.includes(ind.replace('업', '')))
  })
}
