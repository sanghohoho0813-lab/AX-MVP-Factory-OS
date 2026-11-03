/**
 * D-520 업무 · 신청 건 한 줄 상태(LINK-2) — 업체 상세 업무 탭과 고객 관리 카드가 같은 규칙을 쓴다.
 *
 * 업무 카드는 '상태 · 마감 배지 · 서류 n(안 받은 수) · 다음: …' 를 따로따로 말했고, 고객에게 부탁해 둔 서류(D-512 요청함)가
 * 이 업무의 서류인지, 며칠째 기다리는지는 서류함에 가야 보였다. 이제 한 줄로:
 *   `서류 3/5 · 회신 대기 2건 4일째 · 목표 11/20 · 다음: 선행기술 조사 결과 검토`
 * - 서류 n/m — 이 업무에 필요한 서류 중 지금 쓸 수 있는 것(받음 · 만료 아님) / 전부
 * - 회신 대기 — 안 받은 서류 중 고객에게 요청해 둔 것(요청함)의 수 · 가장 오래 기다린 날
 * - 목표 — 마감 · 목표일(열린 업무만 · 지났으면 '지남')
 * - 다음 — 적어 둔 다음 할 일
 * 규칙 계산 — AI 아님. 기록 모양 그대로(DB 변경 없음).
 */
import type { ClientOpsRecord, DocumentKey, ServiceKey, ServiceStatus } from '../types/clientOps'
import { isServiceOpen, isServiceStarted, serviceMeta } from '../content/clientOpsCatalog'
import { daysLeftFrom, missingDocumentsFor, type DocumentStatusView } from './clientOpsAlerts'
import { pendingDocKeys } from './docRequests'

export interface ServiceLine {
  status: ServiceStatus
  /** 필요한 서류 중 쓸 수 있는 것 / 전부(필요한 서류가 없으면 need 0) */
  docs: { have: number; need: number; missing: DocumentStatusView[] }
  /** 안 받은 서류 중 고객에게 요청해 둔 것 — 수 · 가장 오래 기다린 날 */
  waiting: { count: number; days: number }
  /** 마감 · 목표일 — 열린 업무만 */
  due: { date: string; daysLeft: number | null; overdue: boolean; soon: boolean } | null
  next: string
  /** 시작했는데 서류가 모자람(예전 '서류 n' 배지와 같은 뜻) */
  blocked: boolean
  /** 한 줄 조각들(화면은 ' · ' 로 잇는다) */
  parts: string[]
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

/** pending = 이미 구한 요청함 칸(여러 업무를 그릴 때 한 번만 구하게) */
export function serviceLine(record: ClientOpsRecord, key: ServiceKey, today: string, pending?: Map<DocumentKey, { days: number }>): ServiceLine {
  const st = record.services[key]
  const meta = serviceMeta(key)
  const need = meta.requiredDocuments.length
  const missing = missingDocumentsFor(record, key, today)
  const req = pending ?? pendingDocKeys(record, today)
  const asked = missing.filter((m) => req.has(m.key))
  const waiting = { count: asked.length, days: asked.reduce((d, m) => Math.max(d, req.get(m.key)?.days ?? 0), 0) }
  const open = isServiceOpen(st.status)
  const left = open && st.dueDate ? daysLeftFrom(today, st.dueDate) : null
  const due = open && st.dueDate ? { date: st.dueDate, daysLeft: left, overdue: left !== null && left < 0, soon: left !== null && left >= 0 && left <= 7 } : null
  const blocked = isServiceStarted(st.status) && missing.length > 0
  const parts: string[] = []
  if (need > 0 && st.status !== 'not_applicable') parts.push(`서류 ${need - missing.length}/${need}`)
  if (waiting.count > 0) parts.push(`회신 대기 ${waiting.count}건 ${waiting.days === 0 ? '오늘 요청' : `${waiting.days}일째`}`)
  if (due) parts.push(`목표 ${md(due.date)}${due.overdue ? ' 지남' : ''}`)
  if (st.nextStep.trim()) parts.push(`다음: ${st.nextStep.trim()}`)
  return { status: st.status, docs: { have: need - missing.length, need, missing }, waiting, due, next: st.nextStep.trim(), blocked, parts }
}
