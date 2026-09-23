/**
 * 업체 한 곳의 고용지원금 현황 보고서 (D-91).
 *
 * 원본에는 고객 보고서가 세 벌(기관용·PDF·수수료) 있었다. 여기서는 **한 벌**로 모은다 —
 * 대표가 실제로 보내는 것은 "지금 어디까지 왔고, 언제 무엇을 신청해야 하고, 얼마를 받았는가" 뿐이다.
 * 수수료는 이 OS 의 업체 수수료 탭이 이미 맡고 있어 여기서 다시 세지 않는다.
 *
 * 글자만 만든다(계산·저장 없음). 화면은 이 글을 복사하거나 업체 기록에 붙인다.
 */

import { addMo, fD, formatDday, getDdayFrom } from './dates'
import { fMan } from './format'
import { EMP_STAGE_LABEL, empReceived, empRemaining, type EmpRecord } from './empRecords'

export interface ClientReportInput {
  companyName: string
  employees: readonly EmpRecord[]
  /** 지원금 id → 이름 */
  programName: (id: string) => string
  today: Date
}

export function clientReportText({ companyName, employees, programName, today }: ClientReportInput): string {
  const live = employees.filter((e) => e.stage !== 'resigned')
  const received = employees.reduce((s, e) => s + empReceived(e), 0)
  const remaining = live.reduce((s, e) => s + empRemaining(e), 0)

  const lines: string[] = [
    `[${companyName}] 고용지원금 진행 현황`,
    `기준일 ${fD(today.toISOString().slice(0, 10))}`,
    '',
    `대상자 ${live.length}명 · 받은 금액 ${fMan(received)} · 남은 예정액 ${fMan(remaining)}`,
    '',
  ]

  for (const e of live) {
    lines.push(`· ${e.name} (${programName(e.programId)}) — ${EMP_STAGE_LABEL[e.stage]}`)
    if (e.hireDate) lines.push(`  입사 ${fD(e.hireDate)}`)
    for (const r of e.rounds) {
      const date = e.hireDate ? addMo(e.hireDate, r.month) : ''
      if (r.isPaid) {
        lines.push(`  ${r.label} 지급 완료 ${fMan(r.received || r.amount)}`)
      } else if (date) {
        const dd = getDdayFrom(date, today)
        lines.push(`  ${r.label} 신청 ${fD(date)} ${formatDday(dd)} · 예상 ${fMan(r.amount)}`)
      } else {
        lines.push(`  ${r.label} · 예상 ${fMan(r.amount)} (입사일을 넣으면 신청일이 계산됩니다)`)
      }
    }
    const left = e.docs.filter((d) => !d.done)
    if (left.length > 0) lines.push(`  받아야 할 서류: ${left.map((d) => d.name).join(' · ')}`)
    lines.push('')
  }

  lines.push('규칙표 기준 1차 검토이며 운영기관 심사 결과에 따라 달라질 수 있습니다.')
  return lines.join('\n')
}
