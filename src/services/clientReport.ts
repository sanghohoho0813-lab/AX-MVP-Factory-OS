/**
 * 업체 성과 보고서 (D-154) — 고객 미팅 · 재계약 때 드리는 '함께 만든 성과' 한 장.
 *
 * 고객에게 드리는 종이라 **고객이 봐도 되는 것만** 담는다.
 *   넣는 것: 확보한 자금(지원사업 선정 · 지원금/정책자금 실제 입금) · 끝낸 업무 · 진행 중인 업무와 다음 단계 ·
 *            도구 판정의 요약 글(도구가 고객용으로 만든 summary) · 정리된 서류 수 · 다음에 챙길 것(마감 · 서류 만료).
 *   빼는 것: 수수료 · 수금 · 영업자 · 메모 · 업무 일기 · 영업 정보 · 내부 메모(note) · 도구 입력값(data).
 *
 * 기간은 올해 · 최근 12개월 · 계약 뒤 전체 중 고른다. 규칙 계산이다 — 외부 호출 · LLM 0.
 */

import type { ClientOpsRecord, ServiceKey } from '../types/clientOps'
import { SERVICES, SERVICE_STATUS_LABEL } from '../content/clientOpsCatalog'
import { allDocumentMetas } from './clientOpsDocuments'
import { daysLeftFrom, documentStatus, documentsWithExpiry } from './clientOpsAlerts'

export type ReportPeriod = 'year' | 'last12' | 'contract'

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  year: '올해',
  last12: '최근 12개월',
  contract: '계약 뒤 전체',
}

export interface ReportMoneyLine {
  name: string
  /** 입금까지 됐으면 executed(금액 = 실제 입금액), 선정만이면 selected(금액 = 선정 금액) */
  kind: 'selected' | 'executed'
  amount: number
  date: string
  /** 입금 줄에도 선정일을 함께(한 사업 한 줄) */
  selectedAt?: string
}

export interface ReportNextLine {
  date: string
  daysLeft: number | null
  text: string
}

export interface ClientReport {
  companyName: string
  representativeName: string
  period: ReportPeriod
  from: string
  to: string
  /** 머리 숫자 */
  headline: {
    /** 확보한 자금 — 실제 입금된 지원금 · 정책자금 합계(없으면 선정 금액 합계) */
    securedTotal: number
    securedBasis: 'executed' | 'selected' | 'none'
    selectedCount: number
    doneCount: number
    documentsReady: number
  }
  money: ReportMoneyLine[]
  done: { label: string; date: string }[]
  inProgress: { label: string; status: string; nextStep: string; dueDate: string }[]
  tools: { title: string; verdict: string; summary: string; date: string }[]
  next: ReportNextLine[]
}

const DAY = /^\d{4}-\d{2}-\d{2}/
const dayOf = (iso: string | null | undefined) => (iso && DAY.test(iso) ? iso.slice(0, 10) : '')

function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** 기간의 시작일 — 계약 뒤 전체인데 계약일이 없으면 업체를 만든 날 */
export function reportFrom(record: Pick<ClientOpsRecord, 'contract' | 'createdAt'>, period: ReportPeriod, today: string): string {
  if (period === 'year') return `${today.slice(0, 4)}-01-01`
  if (period === 'last12') {
    const f = addMonths(today, -12)
    const [y, m, d] = f.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    return next.toISOString().slice(0, 10)
  }
  return dayOf(record.contract.signedAt) || dayOf(record.createdAt) || `${today.slice(0, 4)}-01-01`
}

const serviceLabel = (key: ServiceKey) => SERVICES.find((s) => s.key === key)?.label ?? String(key)

export function buildClientReport(record: ClientOpsRecord, today: string, period: ReportPeriod = 'year'): ClientReport {
  const from = reportFrom(record, period, today)
  const to = today
  const inRange = (d: string) => !!d && d >= from && d <= to

  // 확보한 자금 — 선정(그 기간에 결과) · 실제 입금(그 기간에 입금)
  const money: ReportMoneyLine[] = []
  // 한 사업은 한 줄 — 입금됐으면 입금(선정일 함께), 아니면 선정
  for (const a of record.fundingApplications) {
    const name = a.programName || '지원사업'
    const selectedIn = a.status === 'selected' && inRange(dayOf(a.resultAt)) && (a.approvedAmount ?? 0) > 0
    if ((a.executedAmount ?? 0) > 0 && inRange(dayOf(a.executedAt ?? ''))) {
      money.push({ name, kind: 'executed', amount: a.executedAmount as number, date: dayOf(a.executedAt ?? ''), ...(dayOf(a.resultAt) ? { selectedAt: dayOf(a.resultAt) } : {}) })
    } else if (selectedIn) {
      money.push({ name, kind: 'selected', amount: a.approvedAmount as number, date: dayOf(a.resultAt) })
    }
  }
  money.sort((x, y) => x.date.localeCompare(y.date))
  const executedTotal = money.filter((m) => m.kind === 'executed').reduce((s, m) => s + m.amount, 0)
  const selectedTotal = money.filter((m) => m.kind === 'selected').reduce((s, m) => s + m.amount, 0)
  const selectedCount = record.fundingApplications.filter((a) => a.status === 'selected' && inRange(dayOf(a.resultAt))).length

  // 업무 — 끝낸 것(그 기간) · 진행 중(지금)
  const done: ClientReport['done'] = []
  const inProgress: ClientReport['inProgress'] = []
  for (const [key, st] of Object.entries(record.services) as [ServiceKey, ClientOpsRecord['services'][ServiceKey]][]) {
    if (!st) continue
    if (st.status === 'done' && inRange(dayOf(st.completedAt))) done.push({ label: serviceLabel(key), date: dayOf(st.completedAt) })
    else if (st.status === 'in_progress' || st.status === 'waiting_client') {
      inProgress.push({ label: serviceLabel(key), status: SERVICE_STATUS_LABEL[st.status], nextStep: st.nextStep.trim(), dueDate: dayOf(st.dueDate) })
    }
  }
  done.sort((x, y) => x.date.localeCompare(y.date))

  // 도구 판정 — 고객용 요약 글만, 같은 도구는 가장 최근 것 하나
  const latest = new Map<string, ClientOpsRecord['toolResults'][number]>()
  for (const t of record.toolResults) {
    if (!inRange(dayOf(t.createdAt))) continue
    const prev = latest.get(t.toolKey)
    if (!prev || t.createdAt > prev.createdAt) latest.set(t.toolKey, t)
  }
  const tools = [...latest.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => ({ title: t.title, verdict: t.verdictLabel, summary: t.summary.trim().slice(0, 400), date: dayOf(t.createdAt) }))

  // 정리된 서류 — 지금 쓸 수 있는 서류 수
  const documentsReady = allDocumentMetas(record).filter((m) => {
    const s = record.documents[m.key]
    return s?.received && documentStatus(m.key, s, today, m).usable
  }).length

  // 다음에 챙길 것 — 60일 안의 신청 마감 · 결과 발표 · 업무 마감 · 서류 만료
  const until = addMonths(today, 2)
  const next: ReportNextLine[] = []
  const push = (date: string, text: string) => {
    if (date && date >= today && date <= until) next.push({ date, daysLeft: daysLeftFrom(today, date), text })
  }
  for (const a of record.fundingApplications) {
    if ((a.status === 'watching' || a.status === 'preparing') && a.applyDueDate) push(a.applyDueDate, `${a.programName || '지원사업'} 신청 마감`)
    if ((a.status === 'submitted' || a.status === 'reviewing') && a.resultDueDate) push(a.resultDueDate, `${a.programName || '지원사업'} 결과 발표`)
  }
  for (const s of inProgress) if (s.dueDate) push(s.dueDate, `${s.label}${s.nextStep ? ` — ${s.nextStep}` : ''}`)
  for (const { meta, view } of documentsWithExpiry(record, today)) if (view.expiresOn) push(view.expiresOn, `${meta.label} 유효기간 끝 — 새로 발급`)
  next.sort((a, b) => a.date.localeCompare(b.date))

  return {
    companyName: record.companyName,
    representativeName: record.representativeName,
    period,
    from,
    to,
    headline: {
      securedTotal: executedTotal || selectedTotal,
      securedBasis: executedTotal ? 'executed' : selectedTotal ? 'selected' : 'none',
      selectedCount,
      doneCount: done.length,
      documentsReady,
    },
    money,
    done,
    inProgress,
    tools,
    next: next.slice(0, 8),
  }
}

/** 짧은 원 표기 — 1.2억원 · 3,000만원 · 5,000원 (카톡 글에 쓴다) */
export const wonShort = (n: number) => (n >= 100_000_000 ? `${Math.round((n / 100_000_000) * 10) / 10}억원` : n >= 10_000 ? `${Math.round(n / 10_000).toLocaleString('ko-KR')}만원` : `${n.toLocaleString('ko-KR')}원`)
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/** 카톡으로 보낼 짧은 요약 */
export function reportKakao(r: ClientReport): string {
  const who = r.representativeName ? `${r.representativeName} 대표님` : `${r.companyName} 담당자님`
  const lines = [`안녕하세요, ${who}.`, `${REPORT_PERIOD_LABEL[r.period]}(${md(r.from)} ~ ${md(r.to)}) 함께 만든 성과를 정리해 드립니다.`, '']
  if (r.headline.securedBasis !== 'none') lines.push(`· ${r.headline.securedBasis === 'executed' ? '확보한 자금(입금)' : '선정된 지원금'}: ${wonShort(r.headline.securedTotal)}`)
  if (r.headline.selectedCount) lines.push(`· 지원사업 선정: ${r.headline.selectedCount}건`)
  if (r.done.length) lines.push(`· 끝낸 업무: ${r.done.map((d) => d.label).join(' · ')}`)
  if (r.inProgress.length) lines.push(`· 진행 중: ${r.inProgress.map((d) => d.label).join(' · ')}`)
  if (r.headline.documentsReady) lines.push(`· 바로 쓸 수 있게 정리된 서류: ${r.headline.documentsReady}가지`)
  if (r.next.length) {
    lines.push('', '다음에 챙길 것')
    for (const n of r.next.slice(0, 4)) lines.push(`· ${md(n.date)} ${n.text}`)
  }
  lines.push('', '자세한 내용은 정리한 보고서로 드리겠습니다. 감사합니다.')
  return lines.join('\n')
}
