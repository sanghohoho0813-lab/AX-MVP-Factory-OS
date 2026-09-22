/**
 * 회차 일정 → 업체 달력에 심을 기한 (D-89).
 *
 * 고용지원금은 "언제 신청하느냐" 가 돈이다. 회차를 한 번 놓치면 그 회차는 사라진다.
 * 그래서 결과를 업체에 붙일 때 아직 받지 않은 회차의 신청 가능일을 함께 심는다.
 * 이미 받은 회차는 심지 않는다 — 달력이 지난 일로 덮이지 않게.
 */

import type { ToolDeadline } from '../../../types/clientOps'
import type { ScheduleRow } from './schedule'
import { fMan } from './format'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function roundDeadlines(programName: string, rows: readonly ScheduleRow[]): ToolDeadline[] {
  const out: ToolDeadline[] = []
  for (const r of rows) {
    if (r.isPaid) continue
    if (!DATE_RE.test(r.date)) continue
    out.push({
      date: r.date,
      title: `${programName} ${r.label} 신청`,
      note: r.amount > 0 ? `예상 ${fMan(r.amount)}` : '',
    })
  }
  return out
}
