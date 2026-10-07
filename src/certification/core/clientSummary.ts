/**
 * 고객용 '기업인증 진단 요약' (P2) — 고객에게 드리는 1~2장.
 * 들어가는 것: 검토한 인증 · 추천 인증 · 이유 · 준비 상태 · 필요 자료 · 기대 혜택 · 다음 순서 · 유의사항.
 * 빠지는 것(시험으로 확인): 실사 질문 · 답변 가이드 · 대표 답 · 자가진단 세부 · 제외 사유(체납 등) · 컨설턴트 메모 · 공식 점수 숫자.
 */
import { CERT_RULES, evidenceAsk, evidenceIdOf, NO_FABRICATE_LINE, RULES_CHECKED_AT } from '../rules/officialRules'
import { companyFitLine } from './explain'
import type { Roadmap } from './roadmap'
import { READINESS_LABEL, RECOMMENDATION_LABEL, type CertificationAssessment, type CertificationClientContext } from './types'

export interface SummarySection {
  id: 'reviewed' | 'recommend' | 'why' | 'ready' | 'docs' | 'benefits' | 'next' | 'notice'
  title: string
  lines: string[]
}

export interface ClientCertSummary {
  title: string
  companyName: string
  date: string
  sections: SummarySection[]
}

const ACTIVE = new Set(['now', 'possible', 'after_fix'])

export function buildClientSummary(list: readonly CertificationAssessment[], c: CertificationClientContext, roadmap: Roadmap): ClientCertSummary {
  const picks = list.filter((a) => ACTIVE.has(a.recommendation)).slice(0, 3)
  const held = list.filter((a) => a.recommendation === 'held')
  const sections: SummarySection[] = []
  // FV: 첫 장에 고객이 알아야 할 다섯 가지 — 추천 · 이유 · 지금 준비할 것 · 기대 혜택 · 다음 순서. 나머지(준비 정도 · 검토한 다른 인증 · 유의사항)는 뒤에
  sections.push({
    id: 'recommend',
    title: '추천 인증',
    lines: picks.length ? picks.map((a) => `${a.label}(${RECOMMENDATION_LABEL[a.recommendation]})`) : [held.length ? `지금 보유한 인증(${held.map((a) => a.label).join(' · ')})을 잘 유지하는 것이 우선입니다.` : '지금 바로 추천할 인증은 없습니다 — 자료 확인 뒤 다시 안내드리겠습니다.'],
  })
  // 맞춤 한 줄(확인된 사실)은 한 번만 — 같은 문장이 인증마다 되풀이되지 않게
  const fit = picks.map((a) => companyFitLine(a.key, c)).find(Boolean) ?? ''
  sections.push({ id: 'why', title: '이유', lines: [...(fit ? [fit] : []), ...picks.map((a) => `${a.label}: ${a.oneLine}`)] })
  // 같은 자료가 인증마다 이름만 달라 두 번 나오지 않게 — 증빙 id 로 한 번만
  const uniq = (labels: string[]) => {
    const seen = new Set<string>()
    return labels.filter((l) => {
      const k = evidenceIdOf(l) ?? l
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const docs = uniq(picks.flatMap((a) => a.missingEvidence))
  const have = uniq(picks.flatMap((a) => a.haveEvidence))
  // 고객에게는 내부 이름이 아니라 '무엇을 보내면 되는지' 로. 추천할 인증이 아직 없으면 기본 자료부터(다 받았다고 말하지 않는다)
  const docLines = !picks.length
    ? [`□ ${evidenceAsk('biz_reg')}`, `□ ${evidenceAsk('fin3')}`, '□ 중소기업확인서(있으면)', '자료를 받으면 맞는 인증을 골라 다시 안내드리겠습니다.']
    : docs.length
      ? [...docs.map((d) => `□ ${evidenceAsk(d)}`), ...(have.length ? [`(이미 받은 자료: ${have.join(', ')})`] : []), NO_FABRICATE_LINE]
      : ['필요한 자료는 지금 다 받아 두었습니다.']
  sections.push({ id: 'docs', title: '지금 준비할 자료', lines: docLines })
  sections.push({
    id: 'benefits',
    title: '기대 혜택',
    lines: picks.flatMap((a) => (a.benefits.length ? a.benefits : CERT_RULES[a.key].benefits.slice(0, 3).map((b) => ({ title: b.title, conditional: b.conditional }))).slice(0, 3).map((b) => `${a.label} — ${b.title}${b.conditional ? '(조건 · 시기 확인 필요)' : ''}`)),
  })
  sections.push({ id: 'next', title: '다음 순서', lines: roadmap.steps.length ? roadmap.steps.map((s, i) => `${i + 1}. ${s.label}`) : picks.length ? CERT_RULES[picks[0].key].procedure.slice(0, 4).map((p, i) => `${i + 1}. ${p}`) : ['자료를 받은 뒤 다시 안내드리겠습니다.'] })
  sections.push({ id: 'ready', title: '준비 정도', lines: picks.map((a) => `${a.label} — ${READINESS_LABEL[a.readiness]}`) })
  const others = list.filter((a) => !picks.includes(a))
  sections.push({ id: 'reviewed', title: '함께 검토한 인증', lines: others.map((a) => `${a.label} — ${RECOMMENDATION_LABEL[a.recommendation]}`) })
  sections.push({
    id: 'notice',
    title: '유의사항',
    lines: [
      '인증 여부는 각 기관의 심사로 정해집니다. 혜택은 기관 · 시기 · 업종에 따라 달라질 수 있습니다.',
      `공식 기준은 ${RULES_CHECKED_AT}에 확인했습니다.`,
    ],
  })
  return { title: '기업인증 진단 요약', companyName: c.companyName, date: c.today, sections: sections.filter((s) => s.lines.length) }
}

export function clientSummaryText(s: ClientCertSummary, consultant: string): string {
  return [`${s.title} — ${s.companyName || '대표님 회사'}`, `${s.date} · ${consultant}`, ...s.sections.flatMap((x) => ['', `■ ${x.title}`, ...x.lines])].join('\n')
}
