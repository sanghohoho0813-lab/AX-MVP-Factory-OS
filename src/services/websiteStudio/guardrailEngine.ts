import type { WebsiteDesign, WebsiteScopeGuardrail } from '../../types/websiteDesign'
import {
  GUARDRAIL_LABEL,
  WEBSITE_GUARDRAIL_LIMITS,
  type GuardrailKey,
} from './scoringConfig'

type GuardrailInput = Pick<WebsiteDesign, 'pages' | 'strategy' | 'forms' | 'integrations'>

function countActivePages(design: GuardrailInput): number {
  return design.pages.filter((p) => p.status === 'required' || p.status === 'recommended').length
}

/** 홈페이지 범위 가드레일 평가 (결정적) */
export function evaluateGuardrails(design: GuardrailInput): WebsiteScopeGuardrail[] {
  const activePages = countActivePages(design)
  const serviceDetail = design.pages.filter((p) => p.pageType === 'service_detail' && p.status !== 'excluded').length
  const primaryCta = design.strategy.conversionActions.filter((c) => c.priority === 'primary').length
  const forms = design.forms.filter((f) => f.required).length
  const integrations = design.integrations.filter((i) => i.requiredForLaunch).length

  const counted: { key: GuardrailKey; value: number; limit: number }[] = [
    { key: 'max_pages', value: activePages, limit: WEBSITE_GUARDRAIL_LIMITS.max_pages },
    { key: 'max_service_detail', value: serviceDetail, limit: WEBSITE_GUARDRAIL_LIMITS.max_service_detail },
    { key: 'max_primary_cta', value: primaryCta, limit: WEBSITE_GUARDRAIL_LIMITS.max_primary_cta },
    { key: 'max_forms', value: forms, limit: WEBSITE_GUARDRAIL_LIMITS.max_forms },
    { key: 'max_integrations', value: integrations, limit: WEBSITE_GUARDRAIL_LIMITS.max_integrations },
  ]

  const checks: WebsiteScopeGuardrail[] = counted.map(({ key, value, limit }) => {
    let status: WebsiteScopeGuardrail['status'] = 'pass'
    let explanation = `${value} / 상한 ${limit}`
    if (value > limit) {
      status = 'exceeded'
      explanation = `${value}개로 상한(${limit})을 초과했습니다. 범위를 줄이세요.`
    } else if (value === limit) {
      status = 'warning'
      explanation = `${value}개로 상한(${limit})에 도달했습니다.`
    }
    return { key, label: GUARDRAIL_LABEL[key], currentValue: value, limitValue: limit, status, explanation, relatedIds: [] }
  })

  const fixed: GuardrailKey[] = ['no_admin', 'no_membership', 'no_payment', 'no_multilang', 'no_complex_booking', 'mobile_web']
  fixed.forEach((key) => {
    checks.push({ key, label: GUARDRAIL_LABEL[key], currentValue: null, limitValue: null, status: 'pass', explanation: '1차 범위 기준 준수', relatedIds: [] })
  })
  return checks
}
