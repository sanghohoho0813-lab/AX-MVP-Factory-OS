/**
 * 연구소 변경신고·활동조사 → 업체 달력에 심을 기한 (D-89).
 *
 * 변경신고는 사유 발생일 + 30일이다. 놓치면 인정취소 사유가 된다.
 * 연구개발활동조사는 매년 4월 30일 마감이다.
 * 결과를 업체에 붙일 때 아직 신고하지 않은 건과 다음 활동조사 마감을 함께 심는다.
 */

import type { ToolDeadline } from '../../../types/clientOps'
import type { ChangeRecord } from './changes'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 다음 활동조사 마감 (올해 4월 30일이 지났으면 내년) — `surveyDeadlineLabel()` 과 같은 규칙 */
export function surveyDeadlineDate(today: Date): string {
  const y = today.getFullYear()
  const m = today.getMonth() + 1
  return `${m <= 4 ? y : y + 1}-04-30`
}

export function changeDeadlines(records: readonly ChangeRecord[], today: Date): ToolDeadline[] {
  const out: ToolDeadline[] = []
  for (const r of records) {
    if (r.status === '신고 완료') continue
    if (!DATE_RE.test(r.deadline)) continue
    const what = r.reasons[0] ?? (r.memo || '변경사항')
    out.push({
      date: r.deadline,
      title: `연구소 변경신고 — ${what}`,
      note: `발생일 ${r.occurredDate} + 30일`,
    })
  }
  out.push({
    date: surveyDeadlineDate(today),
    title: '연구개발활동조사표 제출',
    note: '연구소 보유 기업은 매년 4월 30일까지 (미제출은 인정취소 사유)',
  })
  return out
}
