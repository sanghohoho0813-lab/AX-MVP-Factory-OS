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

/**
 * 할 일에 맞는 화면 (D-122) — 예전에는 무엇이든 미팅 준비로 갔다.
 * 견적 · 제안 → 상품·제안, 다음 할 일 정하기 → 업체 상세(다음 약속), 연락 · 미팅 → 미팅 준비.
 */
export function salesActionPath(action: string, clientId: string): string {
  if (/견적|업무범위|제안서|검토 상황/.test(action)) return `/sales/proposal?client=${clientId}`
  if (/다음 (할 일|약속) 정하기/.test(action)) return `/ops/clients/${clientId}`
  return `/sales/meeting?client=${clientId}`
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
      reason = `다음 약속 ${d}일 지남`
      action = '연락하기'
    } else if (p?.status === '제안 완료' && (touch === null || touch >= 7)) {
      reason = '제안 완료 후 7일 이상 후속 없음'
      action = '견적 · 업무범위서 보내기'
    } else if (p?.status === '견적 전달' && (daysSince(p.at, now) ?? 99) >= 7) {
      reason = '견적 전달 후 7일 이상 변화 없음'
      action = '검토 상황 확인'
    } else if (scoreLead(toEngineItem(r, now)) >= 70 && r.nextAction.trim() === '') {
      reason = '계약 가능성 높은데 다음 할 일 없음'
      action = '다음 약속 정하기'
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
    // D-125: 안쪽 이유(대표가 보는 것)와 고객에게 보내는 문구를 나눈다 — 예전에는 '관리 접점 회복이 필요합니다' 같은
    // 안쪽 말이 그대로 고객 카톡에 들어갔다
    const timing: string[] = []
    if (ds >= 60) timing.push(ds >= 999 ? '연락 기록 없음' : `${ds}일째 연락 없음`)
    const heldDays = daysSince(r.sales?.movedAt, now) ?? 0
    if (stage === 'hold' && heldDays >= 30) timing.push(`보류한 지 ${heldDays}일 — 다시 연락할 때`)
    if (timing.length === 0) continue
    const extra: string[] = []
    const emp = parseInt(String(r.employeeCount ?? '').replace(/[^0-9]/g, ''), 10)
    const it = r.sales?.interests ?? []
    if (Number.isFinite(emp) && emp > 0) extra.push('직원 수가 바뀌었으면 고용지원금 다시 보기')
    if (it.includes('연구소')) extra.push('연구소 · 인증 요건 다시 보기')
    if (it.includes('정책자금')) extra.push('정책자금 · 보증 다시 보기')
    const reasons = [...timing, ...extra].slice(0, 2)
    const hook = it.includes('정책자금')
      ? '새로 나온 정책자금 · 보증 일정이 있어 한번 살펴봐 드리면 좋을 것 같아 연락드렸습니다.'
      : it.includes('연구소')
        ? '연구소 · 인증 쪽 요건이 달라진 부분이 있어 확인해 드리려고 연락드렸습니다.'
        : Number.isFinite(emp) && emp > 0
          ? '요즘 직원 채용은 어떠신지, 고용지원금 받을 수 있는 부분이 있는지 확인해 드리려고 연락드렸습니다.'
          : '요즘 회사 사정은 어떠신지, 도와드릴 부분이 있는지 여쭤보려고 연락드렸습니다.'
    const who = r.representativeName.trim() ? `${r.representativeName.trim()} 대표님` : `${r.companyName} 대표님`
    out.push({ record: r, reasons, days: ds, ment: `${who}, 오랜만에 안부 드립니다. ${hook} 편하실 때 10분 정도 통화 가능하실까요?` })
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
