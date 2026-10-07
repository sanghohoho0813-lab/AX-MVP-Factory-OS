/**
 * 고객용 '기업인증 진단 요약' (P2) — 고객에게 드리는 1~2장.
 * 들어가는 것: 검토한 인증 · 추천 인증 · 이유 · 준비 상태 · 필요 자료 · 기대 혜택 · 다음 순서 · 유의사항.
 * 빠지는 것(시험으로 확인): 실사 질문 · 답변 가이드 · 대표 답 · 자가진단 세부 · 제외 사유(체납 등) · 컨설턴트 메모 · 공식 점수 숫자.
 */
import { CERT_RULES, RULES_CHECKED_AT } from '../rules/officialRules'
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
  sections.push({ id: 'reviewed', title: '검토한 인증', lines: list.map((a) => `${a.label} — ${RECOMMENDATION_LABEL[a.recommendation]}`) })
  sections.push({
    id: 'recommend',
    title: '추천 인증',
    lines: picks.length ? picks.map((a) => `${a.label}(${RECOMMENDATION_LABEL[a.recommendation]})`) : [held.length ? '지금 보유한 인증을 잘 유지하는 것이 우선입니다.' : '지금 바로 추천할 인증은 없습니다 — 자료 확인 뒤 다시 안내드리겠습니다.'],
  })
  sections.push({
    id: 'why',
    title: '이유',
    lines: picks.flatMap((a) => {
      const fit = companyFitLine(a.key, c)
      return [`${a.label}: ${a.oneLine}`, ...(fit ? [`  ${fit}`] : [])]
    }),
  })
  sections.push({ id: 'ready', title: '준비 상태', lines: picks.map((a) => `${a.label} 준비 정도 — ${READINESS_LABEL[a.readiness]}`) })
  const docs = [...new Set(picks.flatMap((a) => a.missingEvidence))]
  const have = [...new Set(picks.flatMap((a) => a.haveEvidence))]
  sections.push({ id: 'docs', title: '필요 자료', lines: docs.length ? [...docs.map((d) => `□ ${d}`), ...(have.length ? [`(이미 받은 자료: ${have.join(', ')})`] : [])] : ['필요한 자료는 지금 다 받아 두었습니다.'] })
  sections.push({
    id: 'benefits',
    title: '기대 혜택',
    lines: picks.flatMap((a) => (a.benefits.length ? a.benefits : CERT_RULES[a.key].benefits.slice(0, 3).map((b) => ({ title: b.title, conditional: b.conditional }))).slice(0, 3).map((b) => `${a.label} — ${b.title}${b.conditional ? '(조건 · 시기 확인 필요)' : ''}`)),
  })
  sections.push({ id: 'next', title: '다음 순서', lines: roadmap.steps.length ? roadmap.steps.map((s, i) => `${i + 1}. ${s.label}`) : picks.length ? CERT_RULES[picks[0].key].procedure.slice(0, 4).map((p, i) => `${i + 1}. ${p}`) : ['자료를 받은 뒤 다시 안내드리겠습니다.'] })
  sections.push({
    id: 'notice',
    title: '유의사항',
    lines: [
      '인증 여부는 각 기관의 심사로 정해집니다. 이 요약은 준비 방향을 정리한 것이며 결과를 보장하지 않습니다.',
      '혜택은 기관 · 시기 · 업종 조건에 따라 달라질 수 있습니다.',
      `공식 기준은 ${RULES_CHECKED_AT} 기준으로 확인했습니다. 기준이 바뀌면 다시 안내드리겠습니다.`,
    ],
  })
  return { title: '기업인증 진단 요약', companyName: c.companyName, date: c.today, sections: sections.filter((s) => s.lines.length) }
}

export function clientSummaryText(s: ClientCertSummary, consultant: string): string {
  return [`${s.title} — ${s.companyName || '대표님 회사'}`, `${s.date} · ${consultant}`, ...s.sections.flatMap((x) => ['', `■ ${x.title}`, ...x.lines])].join('\n')
}
