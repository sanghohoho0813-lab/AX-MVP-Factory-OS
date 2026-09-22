import type { JudgementResult, Verdict } from '../types'
import { VERDICT_EMOJI, VERDICT_LABEL } from './judgement'

// 종합판정별 고객 친화 문장 (2줄)
const CUSTOMER_LINE: Record<Verdict, string> = {
  good: '현재 정보 기준으로 창업감면 적용\n가능성이 높은 편으로 확인됩니다.',
  caution: '현재 정보 기준으로 창업감면 가능성은 있으나\n일부 확인이 필요합니다.',
  conditional: '현재 정보 기준으로 감면 가능성은 있으나\n적용 여부가 크게 달라질 수 있습니다.',
  bad: '현재 정보 기준으로는 창업감면\n적용이 어려워 보입니다.',
}

// 카카오톡/문자 전송용 영업 친화 요약문 (10줄 내외)
export function buildSummaryText(result: JudgementResult): string {
  const L: string[] = []

  L.push('[창업감면 사전진단 결과]')
  L.push('')
  L.push('종합판정')
  L.push(`${VERDICT_EMOJI[result.overall]} ${VERDICT_LABEL[result.overall]}`)
  L.push('')
  L.push(CUSTOMER_LINE[result.overall])

  // 확인 필요 항목 (최대 2개)
  if (result.keyChecks.length > 0) {
    L.push('')
    L.push('확인 필요 항목')
    for (const c of result.keyChecks.slice(0, 2)) L.push(`- ${c.replace(/\s*확인$/, '')}`)
  }

  // 예상 절세 규모
  L.push('')
  L.push('예상 절세 규모')
  L.push(`💰 ${result.savingsLevel.label}`)

  L.push('')
  L.push('상담 시 보다 정확한 적용 여부 확인 가능합니다.')

  return L.join('\n')
}
