/**
 * 고용지원금 — 업체별 대상 직원 기록 (D-91).
 *
 * 원본(고용지원금 매니저 Pro)은 업체와 직원을 **자기 안에** 들고 있었다.
 * 여기서는 업체를 만들지 않는다 — 업체는 이 OS 의 고객 운영 하나뿐이고(`operations_clients`),
 * 직원 기록만 모듈 기록(`moduleData`, bucket `employees`)으로 쌓인다. `clientId` 가 업체를 가리킨다.
 *
 * 이 파일은 **계산만** 한다(화면 없음, 저장 없음). 시험이 이 함수들을 직접 붙든다.
 *
 * 주민등록번호는 받지 않는다. 생년월일까지만 — 나이 판정에 필요한 것은 그것뿐이다.
 */

import { addMo, getDdayFrom } from './dates'
import type { EmpType } from './programs'
import type { EmployeeRound } from './schedule'

/* ------------------------------------------------------------------ */
/* 단계 (원본 STS 7단계 그대로)                                          */
/* ------------------------------------------------------------------ */

export type EmpStage = 'preparing' | 'submitted' | 'reviewing' | 'approved' | 'inprogress' | 'completed' | 'resigned'

export interface StageMeta {
  key: EmpStage
  label: string
  /** 진행 보드 컬럼 순서 */
  order: number
}

export const EMP_STAGES: readonly StageMeta[] = [
  { key: 'preparing', label: '준비중', order: 0 },
  { key: 'submitted', label: '서류접수', order: 1 },
  { key: 'reviewing', label: '심사중', order: 2 },
  { key: 'approved', label: '승인', order: 3 },
  { key: 'inprogress', label: '지급중', order: 4 },
  { key: 'completed', label: '최종지급완료', order: 5 },
  { key: 'resigned', label: '퇴사', order: 6 },
]

export const EMP_STAGE_LABEL: Record<EmpStage, string> = EMP_STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s.label
    return acc
  },
  {} as Record<EmpStage, string>,
)

export function isEmpStage(v: unknown): v is EmpStage {
  return typeof v === 'string' && EMP_STAGES.some((s) => s.key === v)
}

/** 모르는 값이 들어와도 화면은 돈다 — 준비중으로 본다 (원본 normStatus 와 같다) */
export function normalizeStage(v: unknown): EmpStage {
  return isEmpStage(v) ? v : 'preparing'
}

/* ------------------------------------------------------------------ */
/* 직원 한 줄                                                            */
/* ------------------------------------------------------------------ */

export interface EmpDoc {
  name: string
  done: boolean
  /** 원본 5단계 상태 (없으면 done 으로 본다) — D-92 */
  status?: 'none' | 'requested' | 'submitted' | 'revise' | 'confirmed'
}

export interface EmpRecord {
  /** 모듈 기록의 id (moduleData 가 붙인다) */
  id: string
  /** 어느 업체인가 — 고객 운영의 업체 id */
  clientId: string
  name: string
  /** YYYY-MM-DD (없으면 빈 글자) */
  hireDate: string
  /** YYYY-MM-DD — 나이 판정에만 쓴다. 주민등록번호는 받지 않는다 */
  birthDate: string
  empType: EmpType
  /** toolRegistry 가 아니라 고용지원금 규칙표(programs.ts)의 id */
  programId: string
  stage: EmpStage
  rounds: EmployeeRound[]
  docs: EmpDoc[]
  memo: string
  /** 월 급여(원) — 원본 '필수 정보' (D-92). 없으면 0 */
  salary?: number
  /** 원본 직원 편집 칸 (D-92) — 성별 · 군복무 개월(청년 나이 상한 연장) · 신청 전 확인 6가지 */
  gender?: '' | '남' | '여'
  militaryMonths?: number
  eligChecks?: Record<string, boolean>
}

/** 원본 EmpModal 의 '신청 전 확인' 여섯 가지 */
export const ELIG_CHECKS: readonly string[] = ['대상 근로자 요건 확인', '고용보험 가입 여부 확인', '신청 대상 사업장 여부 확인', '중복 지원 제한 여부 확인', '필수 서류 준비 여부 확인', '신청 기한 확인']

export function emptyEmpRecord(clientId: string): Omit<EmpRecord, 'id'> {
  return {
    clientId,
    name: '',
    hireDate: '',
    birthDate: '',
    empType: '정규직',
    programId: '',
    stage: 'preparing',
    rounds: [],
    docs: [],
    memo: '',
  }
}

/** 저장된 값(무엇이든)을 직원 한 줄로 — 빠진 칸은 기본값으로 채운다 */
export function toEmpRecord(id: string, clientId: string, data: Record<string, unknown>): EmpRecord {
  const rounds = Array.isArray(data.rounds) ? (data.rounds as EmployeeRound[]) : []
  const docs = Array.isArray(data.docs) ? (data.docs as EmpDoc[]) : []
  return {
    id,
    clientId,
    name: typeof data.name === 'string' ? data.name : '',
    hireDate: typeof data.hireDate === 'string' ? data.hireDate : '',
    birthDate: typeof data.birthDate === 'string' ? data.birthDate : '',
    empType: (typeof data.empType === 'string' ? data.empType : '정규직') as EmpType,
    programId: typeof data.programId === 'string' ? data.programId : '',
    stage: normalizeStage(data.stage),
    rounds: rounds.filter((r) => r && typeof r.month === 'number'),
    docs: docs.filter((d) => d && typeof d.name === 'string'),
    memo: typeof data.memo === 'string' ? data.memo : '',
    salary: typeof data.salary === 'number' ? data.salary : 0,
    gender: data.gender === '남' || data.gender === '여' ? data.gender : '',
    militaryMonths: typeof data.militaryMonths === 'number' ? data.militaryMonths : 0,
    eligChecks: data.eligChecks && typeof data.eligChecks === 'object' ? (data.eligChecks as Record<string, boolean>) : {},
  }
}

/* ------------------------------------------------------------------ */
/* 돈·기한 계산 (원본 KanbanBoard 의 empRemaining · empNextDday 그대로)     */
/* ------------------------------------------------------------------ */

/** 아직 못 받은 회차의 예정액 합 */
export function empRemaining(emp: Pick<EmpRecord, 'rounds'>): number {
  return emp.rounds.reduce((s, r) => s + (r.isPaid ? 0 : r.expectedAmount || r.amount || 0), 0)
}

/** 받은 돈 합 */
export function empReceived(emp: Pick<EmpRecord, 'rounds'>): number {
  return emp.rounds.reduce((s, r) => s + (r.isPaid ? r.received || r.amount || 0 : 0), 0)
}

/** 아직 못 받은 회차 중 가장 이른 것의 D-day (없으면 null) */
export function empNextDday(emp: Pick<EmpRecord, 'rounds' | 'hireDate'>, today: Date): number | null {
  if (!emp.hireDate) return null
  for (const r of emp.rounds) {
    if (r.isPaid) continue
    return getDdayFrom(addMo(emp.hireDate, r.month), today)
  }
  return null
}

/** 아직 못 받은 회차 중 가장 이른 것의 날짜 (없으면 빈 글자) */
export function empNextDate(emp: Pick<EmpRecord, 'rounds' | 'hireDate'>): string {
  if (!emp.hireDate) return ''
  for (const r of emp.rounds) {
    if (r.isPaid) continue
    return addMo(emp.hireDate, r.month)
  }
  return ''
}

/**
 * 카드 급한 순 (원본 empUrgency 그대로)
 *   0 지연 · 1 임박(7일 안) · 2 서류 미완료 · 3 일반
 */
export function empUrgency(emp: Pick<EmpRecord, 'rounds' | 'hireDate' | 'docs'>, today: Date): number {
  const dd = empNextDday(emp, today)
  if (dd !== null && dd < 0) return 0
  if (dd !== null && dd <= 7) return 1
  const done = emp.docs.filter((d) => d.done).length
  if (emp.docs.length > 0 && done < emp.docs.length) return 2
  return 3
}

/** 급한 순 정렬 (원본 byUrgency 그대로) */
export function byUrgency(a: EmpRecord, b: EmpRecord, today: Date): number {
  const ua = empUrgency(a, today)
  const ub = empUrgency(b, today)
  if (ua !== ub) return ua - ub
  const da = empNextDday(a, today)
  const db = empNextDday(b, today)
  if (da === null && db === null) return 0
  if (da === null) return 1
  if (db === null) return -1
  return da - db
}

/* ------------------------------------------------------------------ */
/* 모아 보기                                                            */
/* ------------------------------------------------------------------ */

export interface EmpSummary {
  /** 퇴사를 뺀 대상자 수 */
  active: number
  /** 아직 못 받은 돈 */
  pipeline: number
  /** 이미 받은 돈 */
  received: number
  /** 신청일이 지난 회차 수 */
  overdue: number
  /** 지난 회차의 돈 */
  overdueAmount: number
  /** 7일 안에 신청해야 하는 회차 수 */
  next7: number
  /** 서류가 덜 찬 대상자 수 */
  docsPending: number
  /** 최종지급완료 수 */
  completed: number
}

export function summarizeEmployees(emps: readonly EmpRecord[], today: Date): EmpSummary {
  const live = emps.filter((e) => e.stage !== 'resigned')
  let overdue = 0
  let overdueAmount = 0
  let next7 = 0
  for (const e of live) {
    if (!e.hireDate) continue
    for (const r of e.rounds) {
      if (r.isPaid) continue
      const dd = getDdayFrom(addMo(e.hireDate, r.month), today)
      if (dd === null) continue
      if (dd < 0) {
        overdue += 1
        overdueAmount += r.expectedAmount || r.amount || 0
      } else if (dd <= 7) {
        next7 += 1
      }
    }
  }
  return {
    active: live.length,
    pipeline: live.reduce((s, e) => s + empRemaining(e), 0),
    received: emps.reduce((s, e) => s + empReceived(e), 0),
    overdue,
    overdueAmount,
    next7,
    docsPending: live.filter((e) => e.docs.length > 0 && e.docs.some((d) => !d.done)).length,
    completed: emps.filter((e) => e.stage === 'completed').length,
  }
}

/** 진행 보드 한 칸 */
export interface StageColumn {
  stage: StageMeta
  items: EmpRecord[]
}

export function boardColumns(emps: readonly EmpRecord[], today: Date): StageColumn[] {
  return EMP_STAGES.map((stage) => ({
    stage,
    items: emps.filter((e) => normalizeStage(e.stage) === stage.key).sort((a, b) => byUrgency(a, b, today)),
  }))
}

/** 업체별 대상자 수·다음 기한 (업체 관리 화면) */
export interface ClientRollup {
  clientId: string
  active: number
  pipeline: number
  nextDate: string
  nextDday: number | null
  overdue: number
}

export function rollupByClient(emps: readonly EmpRecord[], today: Date): Map<string, ClientRollup> {
  const out = new Map<string, ClientRollup>()
  for (const e of emps) {
    const cur = out.get(e.clientId) ?? {
      clientId: e.clientId,
      active: 0,
      pipeline: 0,
      nextDate: '',
      nextDday: null,
      overdue: 0,
    }
    if (e.stage !== 'resigned') {
      cur.active += 1
      cur.pipeline += empRemaining(e)
      const d = empNextDate(e)
      const dd = empNextDday(e, today)
      if (d && (cur.nextDate === '' || d < cur.nextDate)) {
        cur.nextDate = d
        cur.nextDday = dd
      }
      if (dd !== null && dd < 0) cur.overdue += 1
    }
    out.set(e.clientId, cur)
  }
  return out
}
