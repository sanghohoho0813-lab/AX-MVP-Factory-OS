/**
 * 제출 전 최종 확인 (P2) — 이노비즈 · 메인비즈. 판정은 두 가지뿐: '제출 준비 가능' · '먼저 확인 필요'.
 * 퍼센트 · 자체 점수 없음. 항목마다 ✓ / △ 한 줄. 공식 점수(650/700 · 600/700)는 따로 '공식 기준' 으로만 보인다.
 * 제출자료 정리도 여기서 — 서류함에 이미 있는 것은 다시 요청하지 않는다.
 */
import { CERT_RULES } from '../rules/officialRules'
import type { InspectionPackage } from './inspectionPackage'
import { runSelfCheck, type Answer, type SelfCheckItem } from './selfCheck'
import type { CertificationClientContext, CertificationKey } from './types'

export type GateVerdict = 'ready' | 'check_first'
export const GATE_VERDICT_LABEL: Record<GateVerdict, string> = { ready: '제출 준비 가능', check_first: '먼저 확인 필요' }

export interface GateItem {
  id: 'exclusion' | 'size' | 'selfcheck_unknown' | 'selfcheck_fix' | 'docs' | 'answers' | 'owner'
  ok: boolean
  text: string
}

export interface SubmissionDocs {
  have: string[]
  /** 서류함에 없거나 기간이 지난 것만 */
  need: { label: string; stale: boolean }[]
}

export interface SubmitGate {
  cert: CertificationKey
  verdict: GateVerdict
  items: GateItem[]
  docs: SubmissionDocs
  /** 공식 기준(자체 판정과 섞지 않음) */
  official: { label: string; value: string }[]
}

export function submissionDocs(cert: CertificationKey, c: CertificationClientContext): SubmissionDocs {
  const have: string[] = []
  const need: SubmissionDocs['need'] = []
  for (const e of CERT_RULES[cert].evidence) {
    const doc = c.evidence.find((d) => d.id === e.id)
    if (doc?.have && !doc.stale) have.push(e.label)
    else need.push({ label: e.label, stale: !!doc?.stale })
  }
  return { have, need }
}

/** 모자란 자료만 요청하는 글(이미 받은 것은 '다시 안 주셔도 됩니다') */
export function missingDocsRequest(companyName: string, cert: CertificationKey, docs: SubmissionDocs, consultant: string): string {
  const label = CERT_RULES[cert].label
  if (!docs.need.length) return `대표님, ${consultant}입니다. ${label} 제출에 필요한 자료는 모두 받아 두었습니다. 추가로 필요한 것이 생기면 말씀드리겠습니다.`
  return [
    `대표님, ${consultant}입니다.`,
    `${companyName || '대표님 회사'} ${label} 제출 준비로 아래 자료만 부탁드립니다.`,
    ...docs.need.map((d, i) => `${i + 1}. ${d.label}${d.stale ? '(새로 발급본)' : ''}`),
    docs.have.length ? `(이미 받은 자료: ${docs.have.join(', ')} — 다시 안 주셔도 됩니다)` : '',
  ].filter(Boolean).join('\n')
}

export function buildSubmitGate(input: {
  cert: CertificationKey
  ctx: CertificationClientContext
  selfCheck: readonly SelfCheckItem[]
  answers: Record<string, Answer>
  pkg: InspectionPackage
}): SubmitGate {
  const { cert, ctx: c, pkg } = input
  const items: GateItem[] = []
  const basis = (f: 'exclusion') => (c.basis ?? []).find((b) => b.field === f && b.state !== 'missing')
  if (c.exclusionFlags.length) items.push({ id: 'exclusion', ok: false, text: '신청 제외 사유가 있습니다 — 먼저 해결해야 합니다' })
  else if (!basis('exclusion')) items.push({ id: 'exclusion', ok: false, text: '체납 · 회생 같은 제외 사유 확인 전(회사 정보에 확인 저장)' })
  else items.push({ id: 'exclusion', ok: true, text: '신청 제외 사유 없음 확인' })
  if (c.size === null) items.push({ id: 'size', ok: false, text: '중소기업 여부 확인 전(중소기업확인서)' })
  else if (c.size === 'small' || c.size === 'medium') items.push({ id: 'size', ok: true, text: '중소기업 확인' })
  else items.push({ id: 'size', ok: false, text: '중소기업이 아님 — 신청 대상인지 확인' })
  const r = runSelfCheck(input.selfCheck, c, input.answers)
  const unknown = r.items.filter((x) => x.verdict === 'confirm').length
  const fix = r.items.filter((x) => x.verdict === 'fix').length
  items.push(unknown ? { id: 'selfcheck_unknown', ok: false, text: `자가진단 ${unknown}개 항목 '모름' — 대표 확인` } : { id: 'selfcheck_unknown', ok: true, text: '자가진단 모든 항목 답함' })
  items.push(fix ? { id: 'selfcheck_fix', ok: false, text: `자가진단 ${fix}개 항목 보완 필요` } : { id: 'selfcheck_fix', ok: true, text: '자가진단 보완 필요 항목 없음' })
  const docs = submissionDocs(cert, c)
  items.push(docs.need.length ? { id: 'docs', ok: false, text: `제출 자료 ${docs.need.length}개 보완 필요` } : { id: 'docs', ok: true, text: '제출 자료 서류함에 모두 있음' })
  const open = pkg.questions.filter((x) => x.guide.needsOwner && !x.prepared).length
  items.push(open ? { id: 'answers', ok: false, text: `실사 핵심질문 ${open}개 답 근거 없음` } : { id: 'answers', ok: true, text: '실사 핵심질문 답 근거 있음' })
  items.push(pkg.ownerQuestions.length ? { id: 'owner', ok: false, text: `대표님께 확인할 것 ${pkg.ownerQuestions.length}개 남음` } : { id: 'owner', ok: true, text: '대표님께 확인할 것 없음' })
  return { cert, verdict: items.every((x) => x.ok) ? 'ready' : 'check_first', items, docs, official: CERT_RULES[cert].officialScores ?? [] }
}
