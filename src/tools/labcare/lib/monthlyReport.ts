/**
 * 연구소 월간 고객 리포트 — 글 한 장 (D-91).
 *
 * 원본(app/clients/[id]/report)은 인쇄용 리포트였다. 여기서는 **글**을 만든다 —
 * 대표가 실제로 하는 일은 카톡·메일로 보내는 것이고, 인쇄는 브라우저가 한다.
 *
 * 혜택 문장은 원본의 BENEFIT_OPTIONS 를 그대로 쓴다(report.ts). 여기서는 엮기만 한다.
 */

import { composeBenefitText } from './report'
import { dedicatedCount, researcherWarning, type LabInfoData } from './labInfo'

export interface MonthlyReportInput {
  companyName: string
  month: string
  info: LabInfoData
  /** 이번 달 연구노트 (과제명 → 상태) */
  notes: readonly { projectName: string; status: string }[]
  /** 현장조사 준비 — 준비된 항목 수 / 전체 */
  inspection: { done: number; total: number }
  /** 올해 활동조사 상태 */
  surveyStatus: string
  /** 고른 혜택 키 */
  benefitKeys: readonly string[]
}

export function monthlyReportText(input: MonthlyReportInput): string {
  const lines: string[] = [
    `[${input.companyName}] ${input.month} 기업부설연구소 사후관리 리포트`,
    '',
    `연구소 유형: ${input.info.labType}${input.info.labName ? ` (${input.info.labName})` : ''}`,
  ]
  if (input.info.certifiedDate) lines.push(`인정(신고)일: ${input.info.certifiedDate}`)
  if (input.info.registrationNumber) lines.push(`인정번호: ${input.info.registrationNumber}`)
  lines.push(`연구전담요원: ${dedicatedCount(input.info)}명 (전담 기준)`)

  const warn = researcherWarning(input.info)
  if (warn) lines.push(`※ ${warn}`)

  lines.push('', '1. 이번 달 연구노트')
  if (input.notes.length === 0) {
    lines.push('  아직 작성된 연구노트가 없습니다. 실사에서 가장 먼저 확인하는 자료입니다.')
  } else {
    for (const n of input.notes) lines.push(`  · ${n.projectName} — ${n.status}`)
  }

  lines.push('', '2. 연구개발활동조사', `  ${input.surveyStatus}`)
  lines.push(
    '',
    '3. 현장조사 대비',
    `  체크리스트 ${input.inspection.done}/${input.inspection.total} 항목 준비됨`,
  )

  const benefits = composeBenefitText([...input.benefitKeys])
  if (benefits) lines.push('', '4. 함께 검토해 볼 수 있는 것', ...benefits.split('\n').map((s) => `  · ${s}`))

  lines.push(
    '',
    '본 리포트는 사후관리 상태를 정리한 것이며, 세액공제·지원금의 적용 여부는 세무 대리인과 운영기관의 판단에 따릅니다.',
  )
  return lines.join('\n')
}
