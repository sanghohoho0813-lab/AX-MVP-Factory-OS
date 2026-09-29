/**
 * 명부 진단 → 직원 등록 · 참여신청 기한 (D-138).
 *
 * 명부에서 청년도약 후보로 나온 사람은 '입사 후 3개월' 안에 참여신청을 해야 한다(D-137).
 *  - 업체 기록에 붙이면 사람마다 그 기한이 달력 · 오늘 화면에 뜬다.
 *  - 원하면 그 사람들을 고용지원금 직원으로 바로 등록한다(진행 상태 '준비') — 다시 적지 않게.
 * 주민등록번호는 여기까지 오지 않는다(명부 읽기에서 생년월일 · 성별만 남김).
 */
import { hireWindowOf } from './hireWindow'
import type { EmployeeDiag, RosterEmployee } from './rosterCore'

export interface RosterRow {
  emp: RosterEmployee
  diag: EmployeeDiag
}

export interface YouthEnrollItem {
  name: string
  birthDate: string
  gender: 'male' | 'female' | ''
  hireDate: string
  /** 참여신청 마지막 날 */
  deadline: string
  daysLeft: number
}

/** 지금 참여신청할 수 있는 청년도약 후보 — 재직 · 입사일 앎 · 기한 안. 기한이 가까운 사람부터 */
export function youthEnrollItems(rows: readonly RosterRow[], today: Date | string): YouthEnrollItem[] {
  const out: YouthEnrollItem[] = []
  for (const r of rows) {
    if (!r.diag.active || !r.emp.hireDate) continue
    if (!r.diag.candidates.some((c) => c.key === 'youth_jump')) continue
    const w = hireWindowOf('youth_jump', r.emp.hireDate, today)
    if (w.state !== 'open' || w.daysLeft == null) continue
    out.push({
      name: r.emp.name,
      birthDate: r.emp.birthDate ?? '',
      gender: r.emp.gender === 'F' ? 'female' : r.emp.gender === 'M' ? 'male' : '',
      hireDate: normalizeDay(r.emp.hireDate),
      deadline: w.deadline,
      daysLeft: w.daysLeft,
    })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, 'ko'))
}

function normalizeDay(s: string): string {
  const m = /^(\d{4})\D?(\d{1,2})\D?(\d{1,2})/.exec(s.trim())
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : s
}

/**
 * 업체 기록에 붙일 때 같이 올리는 기한 — 사람마다 참여신청 기한 하나.
 * 도구가 계산한 기한이라 todo 가 아니다 — 명부를 다시 붙이면 새 기한으로 바뀐다(겹치지 않게, D-89).
 */
export function youthEnrollDeadlines(items: readonly YouthEnrollItem[]): { date: string; title: string; note: string; hard: true }[] {
  return items.map((it) => ({
    date: it.deadline,
    title: `청년도약 참여신청 — ${it.name}`,
    note: `입사 ${it.hireDate} · 입사 후 3개월 안까지(예외) — 지나면 신청 불가`,
    // 지나면 끝나는 기한 — 7일 안이면 오늘 화면 맨 위로
    hard: true as const,
  }))
}

type Rec = Record<string, unknown>

/** 이미 등록된 직원과 같은 사람(이름 + 입사일)은 다시 만들지 않는다 */
export function notYetRegistered(items: readonly YouthEnrollItem[], existing: readonly Rec[], companyId: string): YouthEnrollItem[] {
  const key = (name: unknown, hire: unknown) => `${String(name ?? '').replace(/\s+/g, '')}|${String(hire ?? '')}`
  const have = new Set(existing.filter((e) => String(e.companyId) === companyId).map((e) => key(e.name, e.startDate || e.hireDate)))
  return items.filter((it) => !have.has(key(it.name, it.hireDate)))
}

/** 원본 고용지원금 화면이 읽는 직원 모양(진행 상태 '준비') — 회차 · 서류는 지원금 표에서 */
export function youthEmployeeRecord(it: YouthEnrollItem, companyId: string, program: { totalAmount?: number; rounds?: readonly Rec[]; employeeDocs?: readonly unknown[] } | undefined, id: string): Rec {
  const rounds = (program?.rounds ?? []).map((r) => ({ ...r, isPaid: false, received: 0 }))
  const docs = (program?.employeeDocs ?? []).map((d, i) => ({ id: `${id}-d${i}`, label: typeof d === 'string' ? d : String((d as Rec).label ?? ''), done: false, files: [] }))
  return {
    id,
    companyId,
    name: it.name,
    programId: 'youth_jump',
    startDate: it.hireDate,
    birthDate: it.birthDate,
    gender: it.gender || 'male',
    milSvc: 0,
    status: 'preparing',
    salary: '',
    weeklyHours: 40,
    memo: `4대보험 명부 진단에서 등록 — 참여신청 기한 ${it.deadline}`,
    totalExpected: program?.totalAmount ?? 0,
    rounds,
    employeeDocs: docs,
  }
}
