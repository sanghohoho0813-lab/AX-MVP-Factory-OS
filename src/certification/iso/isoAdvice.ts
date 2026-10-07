/**
 * ISO 9001 · 14001 · 45001 안내 (D-170) — 실행 시스템이 아니라 '어떤 ISO 를 검토할지' 와 상담 연결.
 * 인증은 KAB 인정 인증기관이 한다 — OS 가 발급하거나 자동 인증하는 것처럼 말하지 않는다.
 */
import { CERT_RULES } from '../rules/officialRules'
import { pickBenefits } from '../core/benefits'
import { readinessOf, reasonsOf, type Check } from '../core/readiness'
import type { CertificationAssessment, CertificationClientContext, CertificationKey, Recommendation } from '../core/types'

type IsoKey = Extract<CertificationKey, 'iso9001' | 'iso14001' | 'iso45001'>

const FIELD_FIT: Record<IsoKey, (c: CertificationClientContext) => { rec: Recommendation; line: string; checks: Check[] }> = {
  iso9001: (c) => {
    const checks: Check[] = []
    checks.push(c.b2b === null ? { weight: 'core', state: 'unknown', text: 'B2B 납품 · 거래처 인증 요구 — 확인 필요' } : c.b2b ? { weight: 'core', state: 'ok', text: 'B2B 납품 — 거래처가 품질 체계를 볼 수 있음' } : { weight: 'core', state: 'warn', text: '주로 소비자 대상 — 필요성 낮음' })
    if (c.industryGroup === 'manufacturing' || c.industryGroup === 'construction') checks.push({ weight: 'core', state: 'ok', text: '제조 · 건설 — 품질 관리 체계가 중요한 업종' })
    if (c.procurement) checks.push({ weight: 'core', state: 'ok', text: '조달 · 입찰 계획 — 평가에 쓰일 수 있음' })
    const want = c.b2b === true || c.procurement === true || c.industryGroup === 'manufacturing'
    return { rec: c.b2b === null && c.industryGroup === '' ? 'need_info' : want ? 'possible' : 'low_priority', line: want ? 'B2B 납품 · 품질관리 체계가 중요한 업체 — 검토 추천' : c.b2b === null ? '거래처 인증 요구가 있는지 확인 필요' : '지금은 우선순위 낮음 — 거래처 요구가 생기면', checks }
  },
  iso14001: (c) => {
    const env = c.industryGroup === 'manufacturing' || c.industryGroup === 'construction' || c.industryGroup === 'environment' || /화학|도금|폐기물|소재|금속|플라스틱/.test(c.industryText)
    const checks: Check[] = [env ? { weight: 'core', state: 'ok', text: '환경 관리 요구가 있는 업종' } : c.industryGroup === '' ? { weight: 'core', state: 'unknown', text: '업종 — 확인 필요' } : { weight: 'core', state: 'warn', text: '환경 측면이 큰 업종은 아님' }]
    if (c.exportPlan) checks.push({ weight: 'core', state: 'ok', text: '수출 — 해외 바이어 환경 요구' })
    return { rec: c.industryGroup === '' ? 'need_info' : env || c.exportPlan ? 'possible' : 'not_needed', line: env ? '환경 관리 요구가 있는 업종 — 검토' : '지금은 굳이 필요 없음', checks }
  },
  iso45001: (c) => {
    const site = c.industryGroup === 'manufacturing' || c.industryGroup === 'construction' || /물류|운송|설비|현장|공사/.test(c.industryText)
    const checks: Check[] = [site ? { weight: 'core', state: 'ok', text: '현장 · 제조 — 안전보건 관리가 중요한 사업장' } : c.industryGroup === '' ? { weight: 'core', state: 'unknown', text: '업종 — 확인 필요' } : { weight: 'core', state: 'warn', text: '사무 중심 사업장' }]
    if (c.employees !== null && c.employees >= 50) checks.push({ weight: 'core', state: 'ok', text: `직원 ${c.employees}명 — 안전보건 체계 필요성 큼` })
    return { rec: c.industryGroup === '' ? 'need_info' : site ? 'possible' : 'not_needed', line: site ? '안전보건 관리가 중요한 사업장 — 검토' : '지금은 굳이 필요 없음', checks }
  },
}

export function assessIso(c: CertificationClientContext): CertificationAssessment[] {
  return (['iso9001', 'iso14001', 'iso45001'] as IsoKey[]).map((key) => {
    const rule = CERT_RULES[key]
    const held = c.held.find((h) => h.key === key)
    const fit = FIELD_FIT[key](c)
    const checks = held ? [{ weight: 'must' as const, state: 'ok' as const, text: `${rule.label} 보유${held.note ? ` · ${held.note}` : ''}` }] : fit.checks
    const have = rule.evidence.filter((e) => c.evidence.some((d) => d.id === e.id && d.have)).map((e) => e.label)
    return {
      key,
      label: rule.label,
      readiness: held ? 'very_high' : readinessOf(checks),
      recommendation: held ? 'held' : fit.rec,
      oneLine: held ? '이미 보유 중 — 매년 사후심사 · 3년 갱신' : fit.line,
      reasons: reasonsOf(checks),
      missingFacts: checks.filter((x) => x.state === 'unknown').map((x) => x.text.split(' — ')[0]),
      missingEvidence: rule.evidence.filter((e) => !have.includes(e.label)).map((e) => e.label),
      haveEvidence: have,
      benefits: pickBenefits(rule.benefits, c),
      timing: held ? '사후심사 일정 관리' : fit.rec === 'possible' ? '거래처 · 입찰 일정에 맞춰 검토' : '필요가 생기면',
      nextAction: { label: '상담 요청', kind: 'consult' },
    }
  })
}

/** 상담 요청에 붙일 업체 요약 — 업체명 · 업종 · 직원 수 · 관심 ISO · 보유 자료만 */
export function isoConsultSummary(c: CertificationClientContext, interest: IsoKey[]): string {
  const have = c.evidence.filter((e) => e.have).map((e) => e.label)
  return [
    `[ISO 상담 요청] ${c.companyName || '업체'}`,
    `업종: ${c.industryText || '확인 필요'}`,
    `직원 수: ${c.employees ?? '확인 필요'}${c.employees !== null ? '명' : ''}`,
    `관심 ISO: ${interest.map((k) => CERT_RULES[k].label).join(' · ') || '정하지 않음'}`,
    `보유 자료: ${have.length ? have.join(' · ') : '없음'}`,
  ].join('\n')
}
