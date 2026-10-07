/**
 * 실사 직전 3분 요약 (P1) — 실사 대비 기록(질문별 준비 상태)을 한 장으로.
 *   준비된 것 · 보완할 것 · 대표에게 물어볼 것 · 가져갈 자료
 * 없는 사실은 만들지 않는다 — 근거 없는 답은 '대표에게 물어볼 것' 으로.
 */
import type { InspectionCard, PreparedAnswer } from './inspection'

export interface PreInspectionSummary {
  ready: string[]
  fix: string[]
  ask: string[]
  bring: string[]
  /** 아직 한 번도 안 본 질문 수 */
  untouched: number
}

export function preInspectionSummary(cards: readonly InspectionCard[], answers: Record<string, PreparedAnswer>): PreInspectionSummary {
  const ready: string[] = []
  const fix: string[] = []
  const ask: string[] = []
  const bring = new Set<string>()
  let untouched = 0
  for (const k of cards) {
    const st = answers[k.q.id]?.state ?? 'pending'
    if (st === 'pending') untouched += 1
    k.haveEvidence.forEach((e) => bring.add(e))
    const answeredOk = (st === 'ok' && !k.needsOwner) || st === 'edited'
    if (st === 'confirm' || (k.needsOwner && st !== 'edited')) ask.push(k.q.question)
    else if (answeredOk && k.missingEvidence.length === 0) ready.push(k.q.question)
    else if (answeredOk) fix.push(`${k.q.question} — 자료: ${k.missingEvidence.join(' · ')}`)
    else fix.push(`${k.q.question} — 답변 준비`)
  }
  return { ready, fix, ask, bring: [...bring], untouched }
}

/** 복사 · 인쇄용 한 장 */
export function preInspectionText(title: string, s: PreInspectionSummary): string {
  const block = (h: string, xs: string[]) => [`■ ${h} (${xs.length})`, ...(xs.length ? xs.map((x) => `· ${x}`) : ['· 없음'])].join('\n')
  return [
    `${title} — 실사 직전 3분 요약`,
    block('준비된 것', s.ready),
    block('보완할 것', s.fix),
    block('대표에게 물어볼 것', s.ask),
    block('가져갈 자료(원본)', s.bring),
    s.untouched ? `※ 아직 보지 않은 질문 ${s.untouched}개` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
