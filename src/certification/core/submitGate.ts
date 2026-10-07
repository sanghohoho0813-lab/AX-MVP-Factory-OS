/**
 * 제출 전 최종 확인 (P2) — 이노비즈 · 메인비즈. 판정은 두 가지뿐: '제출 준비 가능' · '먼저 확인 필요'.
 * FV: 항목을 '반드시 확인'(신청 자격 · 제외 사유 · 공식 제출서류 · 자가진단 절반 이상) 과 '보완 권장'(실사 설명 · 참고 증빙 · MIRAE 실무 준비자료) 으로 나눈다.
 * FV Final: '반드시' 로 막는 자료는 공식 기관 안내에서 확인된 것(EVIDENCE_CLASS 'official')뿐 — MIRAE 가 권하는 자료가 없다고 제출 불가처럼 보이지 않게.
 *     판정은 '반드시 확인' 만 본다 — 보완 권장이 남아도 제출은 할 수 있다(실사 전까지 채우면 된다). 새 점수는 없다.
 * 퍼센트 · 자체 점수 없음. 항목마다 ✓ / △ 한 줄. 공식 점수(650/700 · 600/700)는 따로 '공식 기준' 으로만 보인다.
 * 제출자료 정리도 여기서 — 서류함에 이미 있는 것은 다시 요청하지 않는다.
 */
import { CERT_RULES, evidenceAsk, evidenceClassOf, NO_FABRICATE_LINE, OFFICIAL_FRESH_DOCS, type EvidenceBasis } from '../rules/officialRules'
import type { InspectionPackage } from './inspectionPackage'
import { runSelfCheck, type Answer, type SelfCheckItem } from './selfCheck'
import type { CertificationClientContext, CertificationKey } from './types'

export type GateVerdict = 'ready' | 'check_first'
export const GATE_VERDICT_LABEL: Record<GateVerdict, string> = { ready: '제출 준비 가능', check_first: '먼저 확인 필요' }

export type GateLevel = 'must' | 'recommend'
export const GATE_LEVEL_LABEL: Record<GateLevel, string> = { must: '반드시 확인', recommend: '보완 권장' }

export interface GateItem {
  id: 'exclusion' | 'size' | 'selfcheck_unknown' | 'selfcheck_fix' | 'docs_required' | 'docs' | 'answers' | 'owner'
  level: GateLevel
  ok: boolean
  text: string
}

export interface SubmissionDocs {
  have: string[]
  /** 서류함에 없거나 기간이 지난 것만 — required: 공식 제출서류(basis 'official') */
  need: { id: string; label: string; stale: boolean; required: boolean; basis: EvidenceBasis }[]
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
    const basis = evidenceClassOf(cert, e.id).basis
    if (doc?.have && !doc.stale) have.push(e.label)
    else need.push({ id: e.id, label: e.label, stale: !!doc?.stale, required: basis === 'official', basis })
  }
  // 꼭 쓰는 자료를 먼저
  need.sort((a, b) => Number(b.required) - Number(a.required))
  return { have, need }
}

/** 모자란 자료만 요청하는 글(이미 받은 것은 '다시 안 주셔도 됩니다') */
export function missingDocsRequest(companyName: string, cert: CertificationKey, docs: SubmissionDocs, consultant: string): string {
  const label = CERT_RULES[cert].label
  if (!docs.need.length) return `대표님, ${consultant}입니다. ${label} 제출에 필요한 자료는 모두 받아 두었습니다. 추가로 필요한 것이 생기면 말씀드리겠습니다.`
  return [
    `대표님, ${consultant}입니다.`,
    `${companyName || '대표님 회사'} ${label} 제출 준비로 아래 자료만 부탁드립니다.`,
    ...docs.need.map((d, i) => `${i + 1}. ${evidenceAsk(d.id)}${d.stale ? '(기간이 지나 새로 발급한 것으로)' : ''}`),
    docs.have.length ? `(이미 받은 자료: ${docs.have.join(', ')} — 다시 안 주셔도 됩니다)` : '',
    NO_FABRICATE_LINE,
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
  // 반드시 확인 — 신청 자격 · 제외 사유
  if (c.exclusionFlags.length) items.push({ id: 'exclusion', level: 'must', ok: false, text: '신청 제외 사유가 있습니다 — 먼저 해결해야 합니다' })
  else if (!basis('exclusion')) items.push({ id: 'exclusion', level: 'must', ok: false, text: '체납 · 회생 같은 제외 사유 확인 전(회사 정보에 확인 저장)' })
  else items.push({ id: 'exclusion', level: 'must', ok: true, text: '신청 제외 사유 없음 확인' })
  if (c.size === null) items.push({ id: 'size', level: 'must', ok: false, text: '중소기업 여부 확인 전(중소기업확인서)' })
  else if (c.size === 'small' || c.size === 'medium') items.push({ id: 'size', level: 'must', ok: true, text: '중소기업 확인' })
  else items.push({ id: 'size', level: 'must', ok: false, text: '중소기업이 아님 — 신청 대상인지 확인' })
  const docs = submissionDocs(cert, c)
  const reqMissing = docs.need.filter((d) => d.required)
  const fresh = OFFICIAL_FRESH_DOCS[cert]
  items.push(reqMissing.length ? { id: 'docs_required', level: 'must', ok: false, text: `공식 제출서류 ${reqMissing.length}개 없음: ${reqMissing.map((d) => d.label).join(' · ')}` } : { id: 'docs_required', level: 'must', ok: true, text: `공식 제출서류(서류함으로 챙기는 것) 있음${fresh ? ` — ${fresh} 은 신청 직전 발급` : ''}` })
  const r = runSelfCheck(input.selfCheck, c, input.answers)
  const unknown = r.items.filter((x) => x.verdict === 'confirm').length
  const fix = r.items.filter((x) => x.verdict === 'fix').length
  // 자가진단은 절반 넘게 '모름' 이면 제출 판단을 할 수 없다(반드시) — 그 아래는 보완 권장
  const tooUnknown = unknown * 2 > r.items.length
  items.push(unknown ? { id: 'selfcheck_unknown', level: tooUnknown ? 'must' : 'recommend', ok: false, text: `자가진단 ${unknown}개 항목 '모름' — 대표 확인${tooUnknown ? '(절반이 넘음)' : ''}` } : { id: 'selfcheck_unknown', level: 'must', ok: true, text: '자가진단 모든 항목 답함' })
  // 보완 권장 — 실사 설명 · 참고 증빙
  items.push(fix ? { id: 'selfcheck_fix', level: 'recommend', ok: false, text: `자가진단 ${fix}개 항목 보완 필요` } : { id: 'selfcheck_fix', level: 'recommend', ok: true, text: '자가진단 보완 필요 항목 없음' })
  const optMissing = docs.need.filter((d) => !d.required)
  items.push(optMissing.length ? { id: 'docs', level: 'recommend', ok: false, text: `기본 준비자료 ${optMissing.length}개 보완(공식 목록 해당 시 · MIRAE 실무 준비자료)` } : { id: 'docs', level: 'recommend', ok: true, text: '기본 준비자료 모두 있음' })
  const open = pkg.questions.filter((x) => x.guide.needsOwner && !x.prepared).length
  items.push(open ? { id: 'answers', level: 'recommend', ok: false, text: `실사 핵심질문 ${open}개 답 근거 없음` } : { id: 'answers', level: 'recommend', ok: true, text: '실사 핵심질문 답 근거 있음' })
  items.push(pkg.ownerQuestions.length ? { id: 'owner', level: 'recommend', ok: false, text: `대표님께 확인할 것 ${pkg.ownerQuestions.length}개 남음` } : { id: 'owner', level: 'recommend', ok: true, text: '대표님께 확인할 것 없음' })
  return { cert, verdict: items.every((x) => x.level !== 'must' || x.ok) ? 'ready' : 'check_first', items, docs, official: CERT_RULES[cert].officialScores ?? [] }
}
