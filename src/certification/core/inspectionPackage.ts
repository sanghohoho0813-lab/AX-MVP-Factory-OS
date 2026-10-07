/**
 * 실사 준비 패키지 (P2) — 한 번 눌러 한 묶음으로:
 *   A 업체 핵심정보(확인된 사실만) · B 이 업체에 특히 중요한 질문 5~8개 · C 질문마다 말하기 가이드
 *   D 가져갈 자료(✓ 준비됨 · △ 보완 필요 · ? 확인 필요) · E 실사 전날 체크(최대 5개) · 대표 확인 질문
 * 점수 · 퍼센트 없음. 없는 사실은 만들지 않는다.
 */
import { CERT_RULES } from '../rules/officialRules'
import { buildAnswerGuide, factKit, OWNER_BASIS, ownerPlaceholder, type AnswerGuide, type Sourced } from './answerGuide'
import type { InspectionQuestion, PreparedAnswer } from './inspection'
import { runSelfCheck, type Answer, type SelfCheckItem } from './selfCheck'
import type { BasisField, CertificationClientContext, CertificationKey } from './types'

export interface PackageQuestion {
  q: InspectionQuestion
  guide: AnswerGuide
  /** 왜 이 업체에 이 질문이 중요한가(한 줄) */
  why: string
  /** 컨설턴트가 이미 준비해 둔 질문(이대로 · 고침) */
  prepared: boolean
}

export type BringState = 'ready' | 'fix' | 'check'
export const BRING_MARK: Record<BringState, string> = { ready: '✓', fix: '△', check: '?' }
export const BRING_LABEL: Record<BringState, string> = { ready: '준비됨', fix: '보완 필요', check: '확인 필요' }

export interface InspectionPackage {
  cert: CertificationKey
  certLabel: string
  companyName: string
  /** A — 확인된 사실만(✓) */
  company: Sourced[]
  strengths: Sourced[]
  /** B · C */
  questions: PackageQuestion[]
  /** D */
  bring: { label: string; state: BringState }[]
  /** E — 최대 5개 */
  dayBefore: string[]
  /** 대표에게 확인할 것 */
  ownerQuestions: string[]
}

/** '없음' · '0건' · '0명' — 내세울 사실이 아님 */
const NONE = /없음|^0\s*(건|명|원)?$|^0건/
const COMPANY_FIELDS: BasisField[] = ['years', 'industry', 'revenue', 'employees', 'researchUnit', 'patents']
const CERT_NAME: Record<CertificationKey, string> = { venture: '벤처기업', lab: '기업부설연구소', innobiz: '이노비즈', mainbiz: '메인비즈', iso9001: 'ISO 9001', iso14001: 'ISO 14001', iso45001: 'ISO 45001' }

/** A — 확인된 사실 · 컨설턴트가 직접 고른 값만(근거 붙음). '확인 전' 값은 넣지 않는다 */
export function companyFacts(c: CertificationClientContext): { company: Sourced[]; strengths: Sourced[] } {
  const kit = factKit(c)
  const confirmed = (f: BasisField) => {
    const x = kit.fact(f)
    const b = (c.basis ?? []).find((y) => y.field === f)
    return x && b ? { label: b.label, value: x.value, from: x.basis } : null
  }
  const company: Sourced[] = []
  if (c.companyName) company.push({ text: `회사명 ${c.companyName}`, basis: '업체 기록' })
  for (const f of COMPANY_FIELDS) {
    const b = confirmed(f)
    // FV: '연구조직 없음 · 특허 0건' 은 핵심정보가 아니다(실사에서 내세울 사실만)
    if (b && !NONE.test(b.value)) company.push({ text: `${b.label} ${b.value}`, basis: b.from })
  }
  const live = c.held.filter((h) => !h.validUntil || h.validUntil >= c.today)
  if (live.length) company.push({ text: `인증 ${live.map((h) => CERT_NAME[h.key]).join(' · ')}`, basis: '회사 정보 인증서 칸 · 진행 기록' })
  const strengths: Sourced[] = []
  const unit = confirmed('researchUnit')
  if (unit && !NONE.test(unit.value)) strengths.push({ text: `${unit.value} 보유 — 기술개발 체제를 보여 줄 수 있음`, basis: unit.from })
  const pat = confirmed('patents')
  if (pat && !NONE.test(pat.value)) strengths.push({ text: `특허 ${pat.value} — 기술 성과 증빙`, basis: pat.from })
  if (live.length) strengths.push({ text: `${live.map((h) => CERT_NAME[h.key]).join(' · ')} 보유 — 이미 검증받은 이력`, basis: '회사 정보 인증서 칸 · 진행 기록' })
  return { company, strengths }
}

/** 대표 확인 질문 하나의 저장 키(같은 질문이면 같은 키) */
export const ownerKey = (text: string) => text.replace(/\s|[?.(){}·,]/g, '')

export { OWNER_BASIS }

/** 받아 둔 대표 답을 가이드에 접어 넣는다 — 답한 질문은 '대표 확인' 에서 빠지고 근거 있는 문장이 된다 */
export function withOwnerNotes(g: AnswerGuide, notes: Record<string, string>): AnswerGuide {
  const answered = g.ownerAsk.map((a) => ({ a, note: (notes[ownerKey(a)] ?? '').trim() })).filter((x) => x.note)
  if (!answered.length || g.edited) return g
  const lines: Sourced[] = answered.map((x) => ({ text: x.note, basis: OWNER_BASIS }))
  const core = g.core.length ? g.core : lines.slice(0, 1)
  const rest = g.core.length ? lines : lines.slice(1)
  return { ...g, core, points: [...g.points, ...rest].slice(0, 4), ownerAsk: g.ownerAsk.filter((a) => !answered.some((x) => x.a === a)), needsOwner: core.length === 0 }
}

/** B — 이 업체에 특히 중요한 질문(5~8개). 늘 묻는 핵심 + 강점을 보여 줄 질문 + 자료가 모자란 질문 */
export function prioritizeQuestions(bank: readonly InspectionQuestion[], c: CertificationClientContext, labelOf: (id: string) => string, prep: Record<string, PreparedAnswer>, max = 8, notes: Record<string, string> = {}): PackageQuestion[] {
  const kit = factKit(c)
  const scored = bank.map((q, i) => {
    const guide = withOwnerNotes(buildAnswerGuide(q, c, labelOf, prep[q.id]), notes)
    const weight = q.weight ?? 2
    const strong = guide.core.length > 0
    const gap = guide.evidenceMissing.length > 0
    // FV: 업체 사실 때문에 더 중요해진 질문은 한 칸 올리고, 이유를 그대로 보여 준다
    const boosted = q.boost?.(kit) ?? null
    const score = weight * 2 + (strong ? 1 : 0) + (gap ? 1 : 0) + (boosted ? 2 : 0)
    const why = weight === 3 ? '거의 늘 묻는 질문' : boosted ?? (strong ? '이 업체 강점을 보여 줄 수 있음' : gap ? '자료를 보완해 두면 좋은 질문' : '업체 사정에 따라 물을 수 있음')
    const prepared = prep[q.id]?.state === 'ok' || prep[q.id]?.state === 'edited'
    return { q, guide, why, prepared, score, i }
  })
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.i - b.i)
  const take = Math.max(5, Math.min(max, sorted.filter((x) => x.score >= 4).length))
  return sorted.slice(0, take).map(({ q, guide, why, prepared }) => ({ q, guide, why, prepared }))
}

export function buildInspectionPackage(input: {
  cert: CertificationKey
  bank: readonly InspectionQuestion[]
  selfCheck?: readonly SelfCheckItem[]
  answers?: Record<string, Answer>
  ctx: CertificationClientContext
  prep: Record<string, PreparedAnswer>
  labelOf: (id: string) => string
  /** 대표 답(ownerKey → 답) */
  notes?: Record<string, string>
}): InspectionPackage {
  const { cert, bank, ctx: c, prep, labelOf } = input
  const rule = CERT_RULES[cert]
  const { company, strengths } = companyFacts(c)
  const notes = input.notes ?? {}
  const questions = prioritizeQuestions(bank, c, labelOf, prep, 8, notes)
  // D — 인증 증빙 + 고른 질문의 증빙
  const used = new Set(questions.flatMap((x) => x.q.evidence))
  const ids = [...new Set([...rule.evidence.map((e) => e.id), ...used])]
  const kit = factKit(c)
  // 이 인증의 자료 이름을 먼저(인증마다 이름이 조금 달라 화면끼리 어긋나지 않게)
  const nameOf = (id: string) => rule.evidence.find((e) => e.id === id)?.label ?? labelOf(id)
  const bring = ids.map((id) => {
    const doc = c.evidence.find((e) => e.id === id)
    const state: BringState = doc?.have && !doc.stale ? 'ready' : doc?.stale || used.has(id) ? 'fix' : 'check'
    return { label: nameOf(id), state }
  })
  const ownerQuestions = buildOwnerQuestions({ questions, selfCheck: input.selfCheck, answers: input.answers, ctx: c, notes })
  // E — 실사 전날 체크(최대 5)
  const fix = bring.filter((b) => b.state === 'fix').map((b) => b.label)
  const day: string[] = []
  if (ownerQuestions.length) day.push(`대표님께 ${ownerQuestions.length}가지 확인 받기(실사 답의 빈칸)`)
  if (fix.length) day.push(`보완할 자료 챙기기: ${fix.slice(0, 2).join(' · ')}${fix.length > 2 ? ` 외 ${fix.length - 2}` : ''}`)
  const unit = kit.fact('researchUnit')
  if (unit && !/없음/.test(unit.value)) day.push('연구공간 정리 · 연구원 자리 확인(현장에서 직접 봄)')
  if (bring.some((b) => b.state === 'ready')) day.push('준비된 자료 원본 챙기기(사본과 같은지)')
  day.push('대표님과 핵심 답 5분 맞춰 보기(가이드의 핵심 답 · 꼭 말할 것)')
  return { cert, certLabel: rule.label, companyName: c.companyName, company, strengths, questions, bring, dayBefore: day.slice(0, 5), ownerQuestions }
}

/* ------------------------------------------------------------------ */
/* 대표에게 확인할 것                                                     */
/* ------------------------------------------------------------------ */

/** 신청 자격 빈칸 · 실사 가이드의 빈칸 · 자가진단 '모름' 을 모아 대표 확인 질문으로(중복 없이 최대 8) */
export function buildOwnerQuestions(input: { questions: readonly PackageQuestion[]; selfCheck?: readonly SelfCheckItem[]; answers?: Record<string, Answer>; ctx: CertificationClientContext; notes?: Record<string, string> }): string[] {
  const out: string[] = []
  // 신청 자격(제외 사유 · 중소기업)부터 — 이게 막히면 나머지는 의미가 없다
  const b = (f: BasisField) => (input.ctx.basis ?? []).find((x) => x.field === f && x.state !== 'missing')
  if (!b('exclusion')) out.push('최근 3년 국세 체납 · 회생 · 임금 체불 · 산재 공표가 있었나요?')
  // AX: '직원 수로 보임' 은 확인이 아니다 — 확인서가 없고 규모도 안 골랐으면 묻는다
  if (input.ctx.size === null && !input.ctx.smeDoc) out.push('중소기업확인서가 있나요?(있으면 사진으로)')
  for (const x of input.questions) if (!x.prepared) out.push(...x.guide.ownerAsk)
  if (input.selfCheck) {
    const r = runSelfCheck(input.selfCheck, input.ctx, input.answers ?? {})
    for (const it of r.items) if (it.answer === 'unknown') out.push(it.item.question)
  }
  const notes = input.notes ?? {}
  const seen = new Set<string>()
  return out.filter((t) => {
    const k = ownerKey(t)
    if (seen.has(k) || (notes[k] ?? '').trim()) return false
    seen.add(k)
    return true
  }).slice(0, 8)
}

/** [대표에게 질문 보내기] — 카톡 · 문자 문구 */
export function ownerQuestionMessage(companyName: string, certLabel: string, questions: readonly string[], consultant: string): string {
  return [
    `대표님, ${consultant}입니다.`,
    `${companyName || '대표님 회사'} ${certLabel} 준비로 몇 가지 여쭙니다. 아시는 것만 짧게 답 주셔도 됩니다.`,
    ...questions.map((q) => `□ ${q}`),
    '답 주시면 실사 준비 자료에 바로 정리하겠습니다.',
  ].join('\n')
}

/** 패키지 → 복사 · 인쇄용 한 장(내부용 — 고객에게 보내는 글 아님) */
export function inspectionPackageText(p: InspectionPackage): string {
  const lines: string[] = [`[내부] ${p.companyName} ${p.certLabel} 실사 준비`, '', '■ 업체 핵심정보(확인된 것만)', ...p.company.map((x) => `· ${x.text}`)]
  if (p.strengths.length) lines.push('', '■ 강점', ...p.strengths.map((x) => `· ${x.text}`))
  lines.push('', '■ 예상 핵심질문')
  p.questions.forEach((x, i) => {
    lines.push(`${i + 1}. ${x.q.question}`)
    if (x.guide.core.length) lines.push(`   핵심 답: ${x.guide.core.map((s) => s.text).join(' ')}`)
    else lines.push(`   핵심 답: ${ownerPlaceholder(x.q)}`)
    if (x.guide.points.length) lines.push(`   꼭 말할 것: ${x.guide.points.map((s) => s.text).join(' / ')}`)
    if (x.guide.evidenceHave.length) lines.push(`   증빙: ${x.guide.evidenceHave.join(' · ')}`)
    if (x.guide.ownerAsk.length && !x.prepared) lines.push(`   대표 확인: ${x.guide.ownerAsk.join(' / ')}`)
  })
  lines.push('', '■ 가져갈 자료', ...p.bring.map((b) => `${BRING_MARK[b.state]} ${b.label}(${BRING_LABEL[b.state]})`))
  lines.push('', '■ 실사 전날 체크', ...p.dayBefore.map((d) => `□ ${d}`))
  return lines.join('\n')
}
