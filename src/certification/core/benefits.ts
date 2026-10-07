/**
 * 이 업체에 특히 쓸 만한 혜택 3~5개 (D-170) — 업체 계획(정책자금 · 조달 · R&D · 수출 · 채용)과 혜택 꼬리표를 맞춘다.
 * 확정 혜택처럼 말하지 않는다 — 조건이 붙는 혜택은 '적용 여부 추가 확인 필요'.
 */
import type { BenefitDef, BenefitTag } from '../rules/officialRules'
import type { BenefitPick, CertificationClientContext } from './types'
import { rndPositive } from './rnd'

const WHY: Record<BenefitTag, (c: CertificationClientContext) => string | null> = {
  funding: (c) => (c.policyFundPlan ? '정책자금 계획이 있어 자금 · 보증 심사에 활용할 가능성이 높습니다.' : null),
  guarantee: (c) => (c.policyFundPlan ? '보증을 끼고 자금을 쓰실 계획이라 보증 우대가 쓸모 있을 수 있습니다.' : null),
  procurement: (c) => (c.procurement ? '공공 조달 · 입찰 계획이 있어 가점이 직접 도움이 됩니다.' : c.b2b ? 'B2B 납품이 많아 대외 평가에서 쓰일 수 있습니다.' : null),
  rnd: (c) => (c.rndPlan ? '정부 R&D 과제 계획이 있어 우대 · 가점이 도움이 됩니다.' : c.researchUnit === 'lab' || c.researchUnit === 'dept' ? '연구조직이 있어 R&D 과제와 이어 쓰기 좋습니다.' : null),
  tax_audit: (c) => (c.revenue !== null && c.revenue >= 5_000_000_000 ? '매출 규모가 커서 세무조사 유예의 실익이 있을 수 있습니다.' : null),
  tax_credit: (c) => (rndPositive(c) ? '연구개발비가 있어 세액공제 · 감면을 함께 검토할 만합니다.' : null),
  trust: (c) => (c.b2b ? '거래처 · 납품처에 내미는 신뢰 자료가 됩니다.' : null),
  hiring: (c) => (c.employees !== null && c.employees >= 10 ? '직원이 늘어나는 중이라 인력 지원 가점을 쓸 수 있습니다.' : null),
  ip: (c) => (c.patents !== null && c.patents > 0 ? '특허가 있어 지식재산 우대를 바로 쓸 수 있습니다.' : null),
  export: (c) => (c.exportPlan ? '수출 · 해외 거래 계획이 있어 바이어 요구에 대응됩니다.' : null),
}

export function pickBenefits(defs: readonly BenefitDef[], c: CertificationClientContext, max = 4): BenefitPick[] {
  const picks: BenefitPick[] = []
  for (const d of defs) {
    const why = d.tags.map((t) => WHY[t](c)).find((x) => x !== null)
    if (why) picks.push({ id: d.id, title: d.title, why, conditional: d.conditional })
  }
  return picks.slice(0, max)
}
