/**
 * 고용지원금 — 업체 한 곳의 관리 기록 (D-92).
 *
 * 원본(고용지원금 매니저 Pro)의 업체 화면에 있던 것 가운데 D-91 에서 빠졌던 것들:
 *   - 지원금별 참여 정보(협약일·신청일·지원한도·운영기관·담당자·연락처)와 급여일
 *   - 업체 서류(5단계 상태)
 *   - 수수료 정산(수수료율·착수금·성공보수·청구·입금·세금계산서) + 직원별 수수료 + 정산서
 *   - 업무 일지(13종 유형)
 *   - 운영기관 보고서(기관용 현황 보고서) — 위험 항목·30일 계획·지원금별 현황·미제출 서류·대표 요약 문구
 *   - 대시보드: 오늘 바로 해야 할 일 · 월별 수령 · 업체별 수령 순위 · 미지급 대상자 · 지원금별 파이프라인 · 업체별 위험도
 *
 * 규칙·문장·문턱값은 원본 SubsidyApp.jsx 그대로다(각 함수 위에 원본 줄). 업체는 만들지 않는다 —
 * 모듈 기록 `employment/companies` 에 업체(clientId)마다 한 줄을 둔다. 이 파일은 계산만 한다.
 */

import { addMo, getDdayFrom } from './dates'
import { EMP_STAGE_LABEL, EMP_STAGES, empReceived, type EmpRecord } from './empRecords'
import { COMPANY_DEFAULT_DOCS } from './programs'

/* ------------------------------------------------------------------ */
/* 표 (원본 그대로)                                                       */
/* ------------------------------------------------------------------ */

/** 원본 178줄 NOTE_TYPES */
export const NOTE_TYPES: ReadonlyArray<{ id: string; icon: string }> = [
  { id: '전화', icon: '📞' },
  { id: '카톡', icon: '💬' },
  { id: '이메일', icon: '✉️' },
  { id: '서류요청', icon: '📤' },
  { id: '서류수령', icon: '📥' },
  { id: '신청완료', icon: '📨' },
  { id: '지급확인', icon: '💸' },
  { id: '고객미응답', icon: '🔕' },
  { id: '보완요청', icon: '📝' },
  { id: '수수료청구', icon: '🧾' },
  { id: '수수료입금', icon: '💰' },
  { id: '상태변경', icon: '🔄' },
  { id: '기타', icon: '🗒️' },
]
export function noteTypeMeta(id: string) {
  return NOTE_TYPES.find((t) => t.id === id) ?? NOTE_TYPES[NOTE_TYPES.length - 1]
}

/** 원본 186줄 DOC_STATUS */
export const DOC_STATUS: ReadonlyArray<{ id: DocStatusId; label: string; color: string; bg: string }> = [
  { id: 'none', label: '미요청', color: '#94A3B8', bg: '#F1F5F9' },
  { id: 'requested', label: '요청완료', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'submitted', label: '제출완료', color: '#0D9488', bg: '#F0FDFA' },
  { id: 'revise', label: '보완필요', color: '#DC2626', bg: '#FEF2F2' },
  { id: 'confirmed', label: '확인완료', color: '#059669', bg: '#ECFDF5' },
]
export type DocStatusId = 'none' | 'requested' | 'submitted' | 'revise' | 'confirmed'
export function docStatusMeta(id: string | undefined) {
  return DOC_STATUS.find((s) => s.id === id) ?? DOC_STATUS[0]
}

/** 원본 업체 서류 기본 목록(업체 등록 시 자동으로 붙던 것 — programs.ts COMPANY_DEFAULT_DOCS 5분류 16종) */
export const DEFAULT_COMPANY_DOCS: readonly string[] = COMPANY_DEFAULT_DOCS.flatMap((g) => g.docs)

/** 원본 4917줄 참여 상태 */
export const PARTICIPATION_STATES: readonly string[] = ['미신청', '신청완료', '협약 완료', '반려']

/* ------------------------------------------------------------------ */
/* 기록 모양                                                            */
/* ------------------------------------------------------------------ */

export interface CompanyDoc {
  id: string
  label: string
  done: boolean
  status?: DocStatusId
}

export interface ProgramInfo {
  id: string
  programId: string
  programName: string
  year: number
  /** 지원한도(명) — 빈 글자면 모름 */
  quota: string
  applyDate: string
  agreementDate: string
  participationStatus: string
  agencyName: string
  agencyManager: string
  agencyPhone: string
  agencyEmail: string
  memo: string
}

export interface Commission {
  /** 수수료율(%) — 원본 기본 20 */
  rate?: number
  /** 착수금(원) */
  retainer?: number
  /** 성공보수 적용 (기본 적용) */
  successFee?: boolean
  billed?: boolean
  paid?: boolean
  taxInvoice?: boolean
  memo?: string
}

export interface WorkNote {
  id: string
  text: string
  /** ISO 시각 */
  at: string
  type: string
  editedAt?: string
}

export interface CompanyMeta extends Record<string, unknown> {
  /** 급여일(매월 n일) — 급여 증빙 요청 시점 계산에 필요 */
  payday: string
  programInfos: ProgramInfo[]
  companyDocs: CompanyDoc[]
  commission: Commission
  notes: WorkNote[]
  /** 엑셀로 들여온 뒤 사람이 한 번 봐야 할 때 */
  needsReview?: boolean
}

export function emptyCompanyMeta(): CompanyMeta {
  return { payday: '', programInfos: [], companyDocs: [], commission: {}, notes: [] }
}

export function toCompanyMeta(data: Record<string, unknown> | undefined): CompanyMeta {
  const d = data ?? {}
  return {
    ...d,
    payday: typeof d.payday === 'string' ? d.payday : '',
    programInfos: Array.isArray(d.programInfos) ? (d.programInfos as ProgramInfo[]) : [],
    companyDocs: Array.isArray(d.companyDocs) ? (d.companyDocs as CompanyDoc[]) : [],
    commission: d.commission && typeof d.commission === 'object' ? (d.commission as Commission) : {},
    notes: Array.isArray(d.notes) ? (d.notes as WorkNote[]) : [],
  }
}

/** 원본 197줄 docIsDone — 상태가 있으면 확인완료만, 없으면 체크 */
export function docIsDone(d: { done: boolean; status?: string }): boolean {
  return d.status ? d.status === 'confirmed' : !!d.done
}

/* ------------------------------------------------------------------ */
/* 수수료 정산 (원본 4217~4226 · CommissionReport 773)                  */
/* ------------------------------------------------------------------ */

export interface CommissionSummary {
  rate: number
  retainer: number
  useSuccess: boolean
  totalPaid: number
  totalExpected: number
  /** 예상 총 수수료 = 착수금 + 전체 예상액 × 율 */
  expected: number
  /** 청구 가능액 = 착수금 + 수령액 × 율 */
  billable: number
  /** 미수금 — 청구했고 입금 전이면 청구 가능액 */
  receivable: number
  state: '입금 완료' | '청구 후 미입금' | '미청구'
  perEmployee: Array<{ id: string; name: string; programId: string; received: number; fee: number }>
}

export function empExpected(e: Pick<EmpRecord, 'rounds'>): number {
  return e.rounds.reduce((s, r) => s + (r.expectedAmount || r.amount || 0), 0)
}

export function commissionSummary(comm: Commission, emps: readonly EmpRecord[]): CommissionSummary {
  const rate = comm.rate != null ? comm.rate : 20
  const retainer = comm.retainer || 0
  const useSuccess = comm.successFee !== false
  const totalPaid = emps.reduce((s, e) => s + empReceived(e), 0)
  const totalExpected = emps.reduce((s, e) => s + empExpected(e), 0)
  const successFee = useSuccess ? (totalPaid * rate) / 100 : 0
  const expected = Math.round(retainer + (useSuccess ? (totalExpected * rate) / 100 : 0))
  const billable = Math.round(retainer + successFee)
  const receivable = comm.paid ? 0 : comm.billed ? billable : 0
  const perEmployee = emps
    .filter((e) => e.rounds.some((r) => r.isPaid))
    .map((e) => {
      const received = empReceived(e)
      return { id: e.id, name: e.name, programId: e.programId, received, fee: Math.round((received * rate) / 100) }
    })
  return { rate, retainer, useSuccess, totalPaid, totalExpected, expected, billable, receivable, state: comm.paid ? '입금 완료' : comm.billed ? '청구 후 미입금' : '미청구', perEmployee }
}

/* ------------------------------------------------------------------ */
/* 운영기관 보고서 (원본 AgencyReport 830~)                               */
/* ------------------------------------------------------------------ */

export interface AgencyReportData {
  emps: EmpRecord[]
  totalRcv: number
  totalExp: number
  pct: number
  upcoming: Array<{ empName: string; prog: string; roundLabel: string; eligDate: string; dday: number; amount: number }>
  overdue: Array<{ empName: string; prog: string; roundLabel: string; eligDate: string; dday: number; amount: number }>
  sc: Record<string, number>
  riskItems: Array<{ empName: string; prog: string; status: string; problem: string; impact: number; action: string }>
  riskCount: number
  docItems: Array<{ empName: string; prog: string; docs: string[] }>
  companyMissingDocs: string[]
  missingDocsCount: number
  reqDocs: string[]
  rate: number
  estFee: number
  planWeek: string[]
  planMonth: string[]
  planNext: string[]
  progList: Array<{ name: string; count: number; expected: number; received: number; delay: number; missingDocs: number; remaining: number }>
}

export function agencyReportData(
  companyName: string,
  meta: CompanyMeta,
  employees: readonly EmpRecord[],
  programName: (id: string) => string,
  today: Date,
): AgencyReportData {
  const emps = employees.filter((e) => e.stage !== 'resigned')
  const totalRcv = emps.reduce((s, e) => s + empReceived(e), 0)
  const totalExp = emps.reduce((s, e) => s + empExpected(e), 0)
  const pct = totalExp > 0 ? Math.round((totalRcv / totalExp) * 100) : 0
  const upcoming: AgencyReportData['upcoming'] = []
  const overdue: AgencyReportData['overdue'] = []
  const riskItems: AgencyReportData['riskItems'] = []
  const docItems: AgencyReportData['docItems'] = []
  const byProg: Record<string, { name: string; count: number; expected: number; received: number; delay: number; missingDocs: number; remaining: number }> = {}
  const planWeek: string[] = []
  const planMonth: string[] = []
  const planNext: string[] = []
  for (const e of emps) {
    const pname = e.programId ? programName(e.programId) : '(지원금 미지정)'
    const statusLabel = EMP_STAGE_LABEL[e.stage]
    const rcv = empReceived(e)
    if (!byProg[e.programId]) byProg[e.programId] = { name: pname, count: 0, expected: 0, received: 0, delay: 0, missingDocs: 0, remaining: 0 }
    const bp = byProg[e.programId]
    bp.count++
    bp.expected += empExpected(e)
    bp.received += rcv
    // 필수 정보 누락
    const missInfo: string[] = []
    if (!e.hireDate) missInfo.push('입사일')
    if (!(Number(e.salary) > 0)) missInfo.push('급여')
    if (missInfo.length > 0) riskItems.push({ empName: e.name, prog: pname, status: statusLabel, problem: `필수 정보 누락 (${missInfo.join('·')})`, impact: 0, action: `${missInfo.join('·')} 입력 후 신청 일정 확정` })
    const empMissing = e.docs.filter((d) => !docIsDone(d)).map((d) => d.name)
    if (empMissing.length > 0) {
      docItems.push({ empName: e.name, prog: pname, docs: empMissing })
      bp.missingDocs += empMissing.length
    }
    for (const r of e.rounds) {
      if (r.isPaid || !e.hireDate) continue
      const ed = addMo(e.hireDate, r.month)
      const dd = getDdayFrom(ed, today)
      if (dd === null) continue
      const amt = r.expectedAmount || r.amount || 0
      if (dd < 0) {
        overdue.push({ empName: e.name, prog: pname, roundLabel: r.label, eligDate: ed, dday: dd, amount: amt })
        bp.delay++
        riskItems.push({ empName: e.name, prog: pname, status: statusLabel, problem: `신청기한 ${Math.abs(dd)}일 지연`, impact: amt, action: '보완서류 확인 후 즉시 신청' })
        planWeek.push(`${e.name} · ${r.label} 지연분 즉시 신청 검토`)
      } else if (dd <= 90) {
        upcoming.push({ empName: e.name, prog: pname, roundLabel: r.label, eligDate: ed, dday: dd, amount: amt })
        if (dd <= 14) {
          riskItems.push({ empName: e.name, prog: pname, status: statusLabel, problem: `신청기한 D-${dd} 임박`, impact: amt, action: '필요 서류 점검 후 신청 준비' })
          planWeek.push(`${e.name} · ${r.label} 신청 준비 (D-${dd})`)
        } else if (dd <= 30) planMonth.push(`${e.name} · ${r.label} 신청 여부 확인 (D-${dd})`)
        else planNext.push(`${e.name} · ${r.label} 급여이체증·재직확인 준비 (D-${dd})`)
      }
    }
    if (empMissing.length > 0) {
      const hasNear = e.rounds.some((r) => {
        if (r.isPaid || !e.hireDate) return false
        const dd = getDdayFrom(addMo(e.hireDate, r.month), today)
        return dd !== null && dd <= 90
      })
      if (hasNear) riskItems.push({ empName: e.name, prog: pname, status: statusLabel, problem: `미제출 서류 ${empMissing.length}건으로 신청 지연 가능`, impact: 0, action: `서류 요청: ${empMissing.slice(0, 3).join('·')}${empMissing.length > 3 ? ' 외' : ''}` })
    }
  }
  upcoming.sort((a, b) => a.dday - b.dday)
  overdue.sort((a, b) => a.dday - b.dday)
  if (emps.length > 0 && !meta.payday) riskItems.push({ empName: `${companyName} (업체)`, prog: '공통', status: '-', problem: '급여일 미입력', impact: 0, action: '급여일 입력 후 급여 증빙 요청 시점 확정' })
  riskItems.sort((a, b) => b.impact - a.impact)
  const sc: Record<string, number> = {}
  for (const s of EMP_STAGES) sc[s.key] = 0
  for (const e of emps) sc[e.stage] = (sc[e.stage] ?? 0) + 1
  const companyMissingDocs = meta.companyDocs.filter((d) => !docIsDone(d)).map((d) => d.label)
  let missingDocsCount = companyMissingDocs.length
  for (const it of docItems) missingDocsCount += it.docs.length
  if (missingDocsCount > 0) planWeek.unshift(`미제출 서류 ${missingDocsCount}건 요청·회수`)
  const reqDocs = Array.from(new Set([...companyMissingDocs, ...docItems.flatMap((it) => it.docs)]))
  const rate = meta.commission.rate || 0
  const estFee = Math.round((totalExp * rate) / 100)
  const progList = Object.values(byProg)
    .map((b) => ({ ...b, remaining: b.expected - b.received }))
    .sort((a, b) => b.expected - a.expected)
  return { emps, totalRcv, totalExp, pct, upcoming, overdue, sc, riskItems, riskCount: riskItems.length, docItems, companyMissingDocs, missingDocsCount, reqDocs, rate, estFee, planWeek, planMonth, planNext, progList }
}

/** 원본 manWon */
export function manWon(n: number): string {
  const v = Math.abs(n || 0)
  if (v >= 100000000) return `${Math.round(n / 100000000)}억 원`
  if (v >= 10000) return `${Math.round(n / 10000).toLocaleString()}만 원`
  return `${(n || 0).toLocaleString()}원`
}

/** 원본 autoComment */
export function agencyAutoComment(rd: AgencyReportData): string {
  const parts: string[] = []
  if (rd.totalExp > 0) parts.push(`현재 귀사에서 신청 가능한 고용지원금 예상 총액은 약 ${manWon(rd.totalExp)}이며, 이 중 ${manWon(rd.totalRcv)}을 이미 수령하셨습니다.`)
  if (rd.riskCount > 0) parts.push(`다만 신청 기한이 임박했거나 지연된 항목이 ${rd.riskCount}건 있어 우선적으로 확인하시는 것이 좋습니다.`)
  else parts.push('현재 신청 일정상 급히 지연된 항목은 없어 전반적으로 양호하게 진행되고 있습니다.')
  if (rd.missingDocsCount > 0) parts.push(`미제출 서류 ${rd.missingDocsCount}건을 보완하시면 이후 회차 신청이 한결 수월해집니다.`)
  parts.push('회차별 지급 시점에는 급여이체증과 재직 여부 확인이 필요하니 미리 준비해두시길 권장드립니다.')
  return parts.join(' ')
}

/** 원본 summaryText — 대표님께 보내는 한 줄 */
export function agencySummaryText(rd: AgencyReportData): string {
  let s = `대표님, 현재 확인된 고용지원금 예상 수령액은 약 ${manWon(rd.totalExp)}이며, 이 중 ${manWon(rd.totalExp - rd.totalRcv)}은 향후 신청 및 서류 보완 여부에 따라 달라질 수 있습니다.`
  const tail: string[] = []
  if (rd.missingDocsCount > 0) tail.push(`미제출 서류 ${rd.missingDocsCount}건`)
  if (rd.riskCount > 0) tail.push(`신청 일정 확인이 필요한 항목 ${rd.riskCount}건`)
  if (tail.length > 0) s += ` 현재 ${tail.join('과 ')}이 있어 우선 해당 부분부터 정리해드리겠습니다.`
  else s += ' 현재 급히 처리할 지연 항목은 없으며, 회차별 지급 일정에 맞춰 계속 관리해드리겠습니다.'
  return s
}

/** 원본 docRequestText */
export function agencyDocRequestText(rd: AgencyReportData): string {
  if (rd.reqDocs.length === 0) return '대표님 안녕하세요. 현재 추가로 요청드릴 미제출 서류는 없습니다. 감사합니다.'
  return `대표님 안녕하세요. 고용지원금 신청을 위해 아래 서류 확인이 필요합니다.\n\n${rd.reqDocs.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n확인 후 전달 부탁드립니다.`
}

/* ------------------------------------------------------------------ */
/* 대시보드 집계                                                          */
/* ------------------------------------------------------------------ */

export interface AlertTask {
  id: string
  kind: string
  kindColor: string
  title: string
  sub: string
  dday: number | null
  clientId: string
  pri: number
  sort: number
}

/** 원본 1251줄 DdayAlerts — 오늘 바로 해야 할 일 */
export function ddayAlerts(
  employees: readonly EmpRecord[],
  companies: ReadonlyArray<{ id: string; name: string; meta: CompanyMeta }>,
  today: Date,
  ddayLimit = 7,
): AlertTask[] {
  const list: AlertTask[] = []
  for (const emp of employees) {
    if (emp.stage === 'resigned' || !emp.hireDate || !emp.programId) continue
    const company = companies.find((c) => c.id === emp.clientId)
    emp.rounds.forEach((r, ri) => {
      if (r.isPaid) return
      const dday = getDdayFrom(addMo(emp.hireDate, r.month), today)
      if (dday === null || dday > ddayLimit) return
      const paying = emp.stage === 'approved' || emp.stage === 'inprogress'
      list.push({
        id: `${emp.id}-${ri}`,
        kind: dday < 0 ? (paying ? '지급 확인' : '신청 지연') : paying ? '지급 예정' : '신청 임박',
        kindColor: dday < 0 ? '#DC2626' : paying ? '#059669' : '#2563EB',
        title: emp.name,
        sub: `${company ? company.name : ''}${r.label ? ` · ${r.label}` : ''}`,
        dday,
        clientId: emp.clientId,
        pri: dday < 0 ? 0 : 1,
        sort: dday,
      })
    })
  }
  for (const c of companies) {
    let miss = c.meta.companyDocs.filter((d) => !d.done).length
    for (const e of employees) if (e.clientId === c.id && e.stage !== 'resigned') miss += e.docs.filter((d) => !d.done).length
    if (miss > 0) list.push({ id: `doc-${c.id}`, kind: '서류', kindColor: '#475569', title: c.name, sub: `미완료 서류 ${miss}건 보완 필요`, dday: null, clientId: c.id, pri: 2, sort: -miss })
  }
  for (const c of companies) {
    const hasEmp = employees.some((e) => e.clientId === c.id && e.stage !== 'resigned')
    if (hasEmp && !c.meta.payday) list.push({ id: `pay-${c.id}`, kind: '정보 누락', kindColor: '#B45309', title: c.name, sub: '급여일 미입력 — 급여 증빙 요청 시점 계산에 필요', dday: null, clientId: c.id, pri: 3, sort: 0 })
  }
  return list.sort((a, b) => a.pri - b.pri || a.sort - b.sort)
}

/** 원본 1336줄 MonthlyReport — 해당 연도 1~12월 수령액 (지급일 기준) */
export function monthlyReceived(employees: readonly EmpRecord[], year: number): Array<{ month: number; received: number }> {
  const arr: Array<{ month: number; received: number }> = []
  for (let m = 1; m <= 12; m++) {
    let rcv = 0
    for (const emp of employees) {
      for (const r of emp.rounds) {
        if (r.isPaid && r.paidDate) {
          const pd = new Date(r.paidDate)
          if (pd.getFullYear() === year && pd.getMonth() + 1 === m) rcv += r.received || 0
        }
      }
    }
    arr.push({ month: m, received: rcv })
  }
  return arr
}

/** 원본 1337줄 CompanyRanking — 받은 돈 순 5곳 */
export function companyRanking(employees: readonly EmpRecord[], companies: ReadonlyArray<{ id: string; name: string }>) {
  return companies
    .map((c) => {
      const emps = employees.filter((e) => e.clientId === c.id)
      return { id: c.id, name: c.name, total: emps.reduce((s, e) => s + empReceived(e), 0), empCount: emps.filter((e) => e.stage !== 'resigned').length }
    })
    .filter((r) => r.empCount > 0 || r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

/** 원본 1340줄 PendingPaymentsList — 아직 다 못 받은 대상자 */
export function pendingPayments(employees: readonly EmpRecord[], today: Date) {
  const list: Array<{ id: string; name: string; clientId: string; paidCount: number; totalRounds: number; remainingAmount: number; nextDday: number | null }> = []
  for (const emp of employees) {
    if (emp.stage === 'resigned' || emp.stage === 'completed' || !emp.programId) continue
    let paidCount = 0
    let remainingAmount = 0
    let nextEligDate: string | null = null
    for (const r of emp.rounds) {
      if (r.isPaid) paidCount++
      else {
        remainingAmount += r.expectedAmount || r.amount || 0
        const ed = emp.hireDate ? addMo(emp.hireDate, r.month) : null
        if (ed && (!nextEligDate || ed < nextEligDate)) nextEligDate = ed
      }
    }
    const totalRounds = emp.rounds.length
    if (paidCount < totalRounds && totalRounds > 0) list.push({ id: emp.id, name: emp.name, clientId: emp.clientId, paidCount, totalRounds, remainingAmount, nextDday: nextEligDate ? getDdayFrom(nextEligDate, today) : null })
  }
  return list.sort((a, b) => {
    if (a.nextDday === null) return 1
    if (b.nextDday === null) return -1
    return a.nextDday - b.nextDday
  })
}

/** 원본 1346줄 ProgramPipeline — 지원금별 수령 진행률 */
export function programPipeline(employees: readonly EmpRecord[], programName: (id: string) => string) {
  const map: Record<string, { programId: string; name: string; count: number; sc: Record<string, number>; received: number; expected: number }> = {}
  for (const e of employees) {
    if (e.stage === 'resigned' || !e.programId) continue
    if (!map[e.programId]) map[e.programId] = { programId: e.programId, name: programName(e.programId), count: 0, sc: {}, received: 0, expected: 0 }
    const m = map[e.programId]
    m.count++
    m.sc[e.stage] = (m.sc[e.stage] ?? 0) + 1
    m.expected += empExpected(e)
    m.received += empReceived(e)
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
}

/** 원본 1397줄 CompanyRiskRanking — 지연·임박·서류·수령예정액 종합 */
export function companyRiskRanking(employees: readonly EmpRecord[], companies: ReadonlyArray<{ id: string; name: string; meta: CompanyMeta }>, today: Date) {
  return companies
    .map((c) => {
      const emps = employees.filter((e) => e.clientId === c.id && e.stage !== 'resigned')
      let overdue = 0
      let next7 = 0
      let remaining = 0
      let docMiss = 0
      let nextDday: number | null = null
      for (const e of emps) {
        for (const r of e.rounds) {
          if (r.isPaid) continue
          remaining += r.expectedAmount || r.amount || 0
          if (e.hireDate) {
            const dd = getDdayFrom(addMo(e.hireDate, r.month), today)
            if (dd !== null) {
              if (dd < 0) overdue++
              else if (dd <= 7) next7++
              if (dd >= 0 && (nextDday === null || dd < nextDday)) nextDday = dd
            }
          }
        }
        docMiss += e.docs.filter((d) => !d.done).length
      }
      docMiss += c.meta.companyDocs.filter((d) => !d.done).length
      const level =
        emps.length === 0
          ? { t: '대기', c: '#94A3B8', bg: '#F1F5F9' }
          : overdue > 0
            ? { t: '지연', c: '#DC2626', bg: '#FEF2F2' }
            : next7 > 0
              ? { t: '임박', c: '#2563EB', bg: '#EFF6FF' }
              : docMiss > 0
                ? { t: '서류 미비', c: '#475569', bg: '#E2E8F0' }
                : remaining >= 10000000
                  ? { t: '고액 관리', c: '#2563EB', bg: '#DBEAFE' }
                  : remaining > 0
                    ? { t: '정상', c: '#059669', bg: '#ECFDF5' }
                    : { t: '완료', c: '#059669', bg: '#ECFDF5' }
      return { id: c.id, name: c.name, empCount: emps.length, overdue, next7, remaining, docMiss, nextDday, level, score: overdue * 1e6 + next7 * 1e4 + docMiss * 100 + remaining / 1e6 }
    })
    .filter((r) => r.empCount > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

/** 원본 3299줄 대시보드 수수료 요약 — 누적·미청구·미입금·이번 달 예상 */
export function commissionTotals(employees: readonly EmpRecord[], companies: ReadonlyArray<{ id: string; meta: CompanyMeta }>, today: Date) {
  let total = 0
  let unbilled = 0
  let unpaid = 0
  let thisMonth = 0
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  for (const c of companies) {
    const cc = c.meta.commission
    const rate = cc.rate != null ? cc.rate : 20
    const ret = cc.retainer || 0
    const useS = cc.successFee !== false
    const emps = employees.filter((e) => e.clientId === c.id)
    if (emps.length === 0 && !ret) continue
    const rcv = emps.reduce((s, e) => s + empReceived(e), 0)
    const fee = Math.round(ret + (useS ? (rcv * rate) / 100 : 0))
    total += fee
    if (!cc.billed) unbilled += fee
    else if (!cc.paid) unpaid += fee
    for (const e of emps)
      for (const r of e.rounds) {
        if (r.isPaid || !e.hireDate) continue
        if (addMo(e.hireDate, r.month).slice(0, 7) === ym && useS) thisMonth += Math.round(((r.expectedAmount || r.amount || 0) * rate) / 100)
      }
  }
  return { total, unbilled, unpaid, thisMonth }
}

/** 원본 대시보드 '엑셀용 데이터 복사' — 탭으로 나눈 표 */
export function excelCopyText(employees: readonly EmpRecord[], companyName: (id: string) => string, programName: (id: string) => string): string {
  const head = ['업체', '이름', '지원금', '상태', '입사일', '받은 금액', '남은 예정액']
  const rows = employees.map((e) => [companyName(e.clientId), e.name, programName(e.programId), EMP_STAGE_LABEL[e.stage], e.hireDate, String(empReceived(e)), String(empExpected(e) - empReceived(e))])
  return [head, ...rows].map((r) => r.join('\t')).join('\n')
}
