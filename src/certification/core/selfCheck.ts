/**
 * 자가진단 엔진 (D-170) — 이노비즈 · 메인비즈가 같이 쓴다. 문항(도메인)은 각 폴더에.
 *
 * 공식 자가진단(이노비즈넷 650점 · 중소벤처24 600점)을 대신하지 않는다 — 공식 지표 · 배점은 공개되지 않는다.
 * 여기서는 'MIRAE 준비 점검' 으로 문항마다 답 + 필요한 증빙 + 지금 있는 증빙을 맞춰 보고,
 * 항목별 판정(충분 · 추가 증빙 권장 · 보완 필요 · 대표 확인 필요)과 준비도 5단계를 낸다. 점수를 만들지 않는다.
 */
import { readinessOf, type Check } from './readiness'
import type { CertificationClientContext, Readiness } from './types'

export type Answer = 'yes' | 'partly' | 'no' | 'unknown'

export const ANSWER_LABEL: Record<Answer, string> = { yes: '있음', partly: '일부', no: '없음', unknown: '모름' }

export interface SelfCheckItem {
  id: string
  /** 묶음 이름(MIRAE 준비 점검 묶음 — 공식 지표 이름 아님) */
  area: string
  question: string
  /** 쉬운 설명 */
  plain: string
  /** 필요한 증빙(증빙 id · 이름) */
  evidence: { id: string; label: string }[]
  /** 업체 사정으로 미리 고른 답(근거와 함께) — 모르면 null */
  suggest?: (c: CertificationClientContext) => { answer: Answer; because: string } | null
  /** 현장평가에서 특히 보는가 */
  fieldRisk?: string
}

export type ItemVerdict = 'enough' | 'more_evidence' | 'fix' | 'confirm'

export const ITEM_VERDICT_LABEL: Record<ItemVerdict, string> = {
  enough: '충분',
  more_evidence: '추가 증빙 권장',
  fix: '보완 필요',
  confirm: '대표 확인 필요',
}

export interface ItemResult {
  item: SelfCheckItem
  answer: Answer
  /** 답이 미리 고른 것인가(사람이 고치지 않음) */
  suggested: boolean
  because: string
  haveEvidence: string[]
  missingEvidence: string[]
  verdict: ItemVerdict
}

export interface SelfCheckResult {
  items: ItemResult[]
  readiness: Readiness
  strengths: string[]
  gaps: string[]
  confirm: string[]
  /** 실사 전에 준비할 자료(모자란 증빙 중복 없이) */
  prepare: string[]
}

export function judgeItem(item: SelfCheckItem, c: CertificationClientContext, answered: Answer | undefined): ItemResult {
  const s = item.suggest?.(c) ?? null
  const answer: Answer = answered ?? s?.answer ?? 'unknown'
  const suggested = answered === undefined && s !== null
  const have = item.evidence.filter((e) => c.evidence.some((d) => d.id === e.id && d.have && !d.stale)).map((e) => e.label)
  const missing = item.evidence.filter((e) => !have.includes(e.label)).map((e) => e.label)
  let verdict: ItemVerdict
  if (answer === 'unknown') verdict = 'confirm'
  else if (answer === 'no') verdict = 'fix'
  else if (answer === 'partly') verdict = missing.length ? 'fix' : 'more_evidence'
  else verdict = missing.length === 0 || item.evidence.length === 0 ? 'enough' : 'more_evidence'
  return { item, answer, suggested, because: answered !== undefined ? '직접 고름' : s?.because ?? '', haveEvidence: have, missingEvidence: missing, verdict }
}

export function runSelfCheck(items: readonly SelfCheckItem[], c: CertificationClientContext, answers: Record<string, Answer>): SelfCheckResult {
  const results = items.map((it) => judgeItem(it, c, answers[it.id]))
  const checks: Check[] = results.map((r) => ({
    weight: 'core',
    state: r.verdict === 'enough' ? 'ok' : r.verdict === 'more_evidence' ? 'warn' : r.verdict === 'fix' ? 'no' : 'unknown',
    text: r.item.question,
  }))
  const prepare = [...new Set(results.flatMap((r) => (r.answer === 'yes' || r.answer === 'partly' ? r.missingEvidence : [])))]
  return {
    items: results,
    readiness: readinessOf(checks),
    strengths: results.filter((r) => r.verdict === 'enough').map((r) => r.item.question),
    gaps: results.filter((r) => r.verdict === 'fix' || r.verdict === 'more_evidence').map((r) => r.item.question),
    confirm: results.filter((r) => r.verdict === 'confirm').map((r) => r.item.question),
    prepare,
  }
}
