/**
 * AI 로 넘기기 (P2) — API 호출 없음. 컨설턴트가 복사해 쓰는 '구조화된 묶음'.
 *   Core 자료(HandoffPackage) → 어댑터(지금은 글 · 나중에 API 어댑터가 같은 묶음을 그대로 받는다).
 * 화면은 문구를 만들지 않는다 — 여기 함수만 부른다. 지어내지 말라는 지시가 늘 같이 간다.
 */
import { READINESS_LABEL, RECOMMENDATION_LABEL, type CertificationAssessment } from './types'
import { OWNER_BASIS, type Sourced } from './answerGuide'
import type { InspectionPackage } from './inspectionPackage'
import { ANSWER_LABEL, type SelfCheckResult } from './selfCheck'
import { PACK_LABEL, type VentureSection } from './venturePack'

export const HANDOFF_VERSION = 'cert-handoff/1'

export type HandoffTask = 'inspection_answers' | 'venture_plan'

/** 모든 묶음에 붙는 지시 — 바꿀 때는 시험(handoff 금지 규칙)도 같이 */
export const HANDOFF_RULES: readonly string[] = [
  '아래 "확인된 사실" 과 "증빙" 에 있는 내용만 쓰세요. 없는 수치 · 실적 · 연구개발 · 회의 · 교육 · 특허를 만들지 마세요.',
  '"업계 최고" · "국내 유일" 같은 근거 없는 평가 말을 쓰지 마세요.',
  '모르는 것은 지어내지 말고 "[대표 확인 필요: …]" 로 남기세요.',
  '문장은 짧게, 대표님이 말로 할 수 있게 써 주세요(외우는 대본이 아니라 말하기 메모).',
  '점수 · 합격 가능성 퍼센트를 쓰지 마세요.',
]

export interface HandoffPackage {
  version: typeof HANDOFF_VERSION
  task: HandoffTask
  certLabel: string
  companyName: string
  facts: Sourced[]
  judgment: { recommendation: string; readiness: string; oneLine: string; reasons: string[] } | null
  selfCheck: { question: string; answer: string; verdict: string }[]
  evidence: { have: string[]; missing: string[] }
  questions: { question: string; intent: string; core: Sourced[]; points: Sourced[]; ownerAsk: string[] }[]
  ownerAnswers: Sourced[]
  ownerQuestions: string[]
  sections: { title: string; state: string; lines: Sourced[]; ask: string }[]
  rules: readonly string[]
}

const judgmentOf = (a: CertificationAssessment | null) =>
  a ? { recommendation: RECOMMENDATION_LABEL[a.recommendation], readiness: READINESS_LABEL[a.readiness], oneLine: a.oneLine, reasons: a.reasons.slice(0, 6).map((r) => r.text) } : null

export function inspectionHandoff(pkg: InspectionPackage, a: CertificationAssessment | null, sc: SelfCheckResult | null): HandoffPackage {
  const ownerAnswers = pkg.questions.flatMap((x) => [...x.guide.core, ...x.guide.points].filter((s) => s.basis === OWNER_BASIS))
  return {
    version: HANDOFF_VERSION,
    task: 'inspection_answers',
    certLabel: pkg.certLabel,
    companyName: pkg.companyName,
    // FV: 강점은 사실을 다시 쓴 것이라 빼고(중복), 사실만 — 묶음이 길어지지 않게
    facts: pkg.company,
    judgment: judgmentOf(a),
    // 자가진단은 '모름' 이 아닌 답만(모름은 아래 '아직 대표 확인 전' 에 이미 있다)
    selfCheck: (sc?.items ?? []).filter((r) => r.answer !== 'unknown').map((r) => ({ question: r.item.question, answer: ANSWER_LABEL[r.answer], verdict: r.verdict })),
    evidence: { have: pkg.bring.filter((b) => b.state === 'ready').map((b) => b.label), missing: pkg.bring.filter((b) => b.state !== 'ready').map((b) => b.label) },
    questions: pkg.questions.map((x) => ({ question: x.q.question, intent: x.q.intent, core: x.guide.core, points: x.guide.points, ownerAsk: x.prepared ? [] : x.guide.ownerAsk })),
    ownerAnswers,
    ownerQuestions: pkg.ownerQuestions,
    sections: [],
    rules: HANDOFF_RULES,
  }
}

export function ventureHandoff(companyName: string, sections: readonly VentureSection[], a: CertificationAssessment | null, evidence: { have: string[]; missing: string[] }): HandoffPackage {
  return {
    version: HANDOFF_VERSION,
    task: 'venture_plan',
    certLabel: '벤처기업',
    companyName,
    facts: sections.flatMap((s) => s.lines.filter((l) => l.basis !== OWNER_BASIS)),
    judgment: judgmentOf(a),
    selfCheck: [],
    evidence,
    questions: [],
    ownerAnswers: sections.flatMap((s) => s.lines.filter((l) => l.basis === OWNER_BASIS)),
    ownerQuestions: sections.filter((s) => s.state !== 'ok').map((s) => s.ask),
    sections: sections.map((s) => ({ title: s.title, state: PACK_LABEL[s.state], lines: s.lines, ask: s.state === 'ok' ? '' : s.ask })),
    rules: HANDOFF_RULES,
  }
}

const TASK_LINE: Record<HandoffTask, string> = {
  inspection_answers: '아래 자료로 실사(현장평가) 예상 질문마다 "핵심 답 1~3문장 · 꼭 말할 것 2~4개" 를 다듬어 주세요.',
  venture_plan: '아래 자료로 벤처확인 사업계획서의 칸별 초안 문장을 다듬어 주세요. 칸이 비어 있으면 비워 두고 대표 확인 질문으로 남기세요.',
}

/** 글 어댑터 — 복사해서 아무 AI 도구에 붙여 넣는 형태 */
export function handoffText(p: HandoffPackage): string {
  const src = (s: Sourced) => `- ${s.text} (근거: ${s.basis})`
  const out: string[] = [
    `# ${p.companyName} · ${p.certLabel} — ${p.task === 'inspection_answers' ? '실사 답변 다듬기' : '벤처 사업계획 칸 다듬기'}`,
    `(${p.version})`,
    '',
    '## 할 일',
    TASK_LINE[p.task],
    '',
    '## 꼭 지킬 것',
    ...p.rules.map((r) => `- ${r}`),
    '',
    '## 확인된 사실',
    ...(p.facts.length ? p.facts.map(src) : ['- (확인된 사실 없음)']),
  ]
  if (p.judgment) out.push('', '## 검토 결과(규칙 판정)', `- ${p.judgment.recommendation} · 준비 정도 ${p.judgment.readiness}`, `- ${p.judgment.oneLine}`, ...p.judgment.reasons.map((r) => `- ${r}`))
  if (p.selfCheck.length) out.push('', '## 자가진단', ...p.selfCheck.map((x) => `- ${x.question} → ${x.answer}`))
  out.push('', '## 증빙', `- 있음: ${p.evidence.have.join(', ') || '없음'}`, `- 없음 · 보완: ${p.evidence.missing.join(', ') || '없음'}`)
  if (p.questions.length) {
    out.push('', '## 예상 질문')
    p.questions.forEach((q, i) => {
      out.push(`### ${i + 1}. ${q.question}`, `- 묻는 이유: ${q.intent}`)
      out.push(...q.core.map(src), ...q.points.map(src))
      if (q.ownerAsk.length) out.push(...q.ownerAsk.map((x) => `- [대표 확인 필요: ${x}]`))
    })
  }
  if (p.sections.length) {
    out.push('', '## 칸별 상태')
    for (const s of p.sections) out.push(`### ${s.title} — ${s.state}`, ...s.lines.map(src), ...(s.ask ? [`- [대표 확인 필요: ${s.ask}]`] : []))
  }
  if (p.ownerAnswers.length) out.push('', '## 대표 답(컨설턴트 기록)', ...p.ownerAnswers.map((s) => `- ${s.text}`))
  if (p.ownerQuestions.length) out.push('', '## 아직 대표 확인 전', ...p.ownerQuestions.map((x) => `- ${x}`))
  return out.join('\n')
}
