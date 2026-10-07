/**
 * 고객에게 설명하기 (D-170) — 30초 설명 · 카톡 · 준비서류 요청 · 미팅용. LLM 없이 사실 + 검증된 틀로.
 * 나중에 AI 를 붙여도 이 함수의 입력(판정 결과 · 업체 사정)을 그대로 넘기면 된다.
 */
import { CERT_RULES } from '../rules/officialRules'
import { READINESS_LABEL, RECOMMENDATION_LABEL, type BasisField, type CertificationAssessment, type CertificationClientContext, type CertificationKey } from './types'

export interface ExplainSet {
  /** P2: 이 업체 맞춤 한 줄(확인된 사실만 — 없으면 '') */
  fit: string
  thirty: string
  kakao: string
  docRequest: string
  meeting: string
}

const CERT_NAME: Record<string, string> = { venture: '벤처기업', lab: '기업부설연구소', innobiz: '이노비즈', mainbiz: '메인비즈', iso9001: 'ISO 9001', iso14001: 'ISO 14001', iso45001: 'ISO 45001' }

/**
 * 이 업체 맞춤 한 줄(P2) — 확인된 사실(state confirmed)만 쓴다. 추정 · 칩 · 모름은 쓰지 않는다.
 * 쓸 사실이 없으면 '' — 화면 · 문구는 일반 설명만 쓴다.
 */
export function companyFitLine(key: CertificationKey, c: CertificationClientContext): string {
  const ok = (f: BasisField) => (c.basis ?? []).find((b) => b.field === f && b.state === 'confirmed' && b.value)
  const unit = ok('researchUnit')
  const hasUnit = !!unit && !/없음/.test(unit.value)
  const pat = ok('patents')
  const hasPat = !!pat && !/^0|없음/.test(pat.value)
  const years = ok('years')
  const live = c.held.filter((h) => h.key !== key && (!h.validUntil || h.validUntil >= c.today)).map((h) => CERT_NAME[h.key])
  const label = CERT_RULES[key].label
  if (key === 'innobiz' || key === 'venture' || key === 'lab') {
    const subject = hasUnit && hasPat ? '연구조직과 특허가' : hasUnit ? '연구조직이' : hasPat ? '특허가' : ''
    if (subject) return `귀사는 ${subject} 이미 확보되어 있어 ${label} 준비에서 기술혁신 근거를 만들기 유리한 상태입니다.`
  }
  if (key === 'mainbiz' && years) return `귀사는 업력 ${years.value}로 경영 이력이 쌓여 있어 ${label}의 경영혁신 근거를 정리하기 좋은 상태입니다.`
  if (live.length) return `귀사는 이미 ${live.join(' · ')} 확인을 받아 두어 ${label} 준비에 쓸 수 있는 자료가 있습니다.`
  return ''
}

export function explainFor(a: CertificationAssessment, c: CertificationClientContext, consultant = '담당 컨설턴트'): ExplainSet {
  const rule = CERT_RULES[a.key]
  const name = c.companyName || '대표님 회사'
  const benefits = a.benefits.length ? a.benefits.map((b) => b.title) : rule.benefits.slice(0, 3).map((b) => b.title)
  const cond = a.benefits.some((b) => b.conditional) || rule.benefits.some((b) => b.conditional)
  const fit = companyFitLine(a.key, c)
  const thirty = `${fit ? fit + ' ' : ''}${rule.label}은(는) ${rule.summary.split(' — ')[1] ?? rule.summary}입니다. ${name}은(는) 지금 '${RECOMMENDATION_LABEL[a.recommendation]}' 단계이고, ${a.oneLine}. 받으면 ${benefits.slice(0, 2).join(', ')} 같은 데 쓸 수 있습니다${cond ? '(적용 여부는 기관 · 시기에 따라 확인)' : ''}.`
  const kakao = [
    `대표님, ${consultant}입니다.`,
    `${name}에 ${rule.label} 검토 결과 '${RECOMMENDATION_LABEL[a.recommendation]}'으로 보입니다 — ${a.oneLine}.`,
    fit,
    `받으시면 ${benefits.slice(0, 3).join(' · ')}에 활용할 수 있습니다${cond ? '(세부 적용은 확인 필요)' : ''}.`,
    a.missingEvidence.length ? `진행하려면 ${a.missingEvidence.slice(0, 3).join(', ')} 자료가 먼저 필요합니다.` : '',
    '편하실 때 짧게 통화 가능하실까요?',
  ]
    .filter(Boolean)
    .join('\n')
  const docRequest = a.missingEvidence.length
    ? [`대표님, ${rule.label} 준비에 아래 자료를 부탁드립니다.`, ...a.missingEvidence.map((d, i) => `${i + 1}. ${d}`), a.haveEvidence.length ? `(이미 받은 자료: ${a.haveEvidence.join(', ')} — 다시 안 주셔도 됩니다)` : ''].filter(Boolean).join('\n')
    : `대표님, ${rule.label} 준비에 필요한 자료는 지금 다 받아 두었습니다. 추가로 필요한 것이 생기면 말씀드리겠습니다.`
  const meeting = [
    `■ ${rule.label} — ${name}`,
    `· 판단: ${RECOMMENDATION_LABEL[a.recommendation]} · 준비도 ${READINESS_LABEL[a.readiness]}`,
    `· 이유: ${a.oneLine}`,
    fit ? `· 이 업체: ${fit}` : '',
    ...a.reasons.slice(0, 5).map((r) => `  ${r.state === 'ok' ? '✓' : r.state === 'warn' ? '△' : r.state === 'no' ? '✗' : '?'} ${r.text}`),
    `· 타이밍: ${a.timing}`,
    `· 절차: ${rule.procedure.join(' → ')}`,
    rule.officialScores ? `· 공식 기준: ${rule.officialScores.map((s) => `${s.label} ${s.value}`).join(' / ')}` : '',
    `· 혜택(조건 확인): ${benefits.join(' · ')}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { fit, thirty, kakao, docRequest, meeting }
}
