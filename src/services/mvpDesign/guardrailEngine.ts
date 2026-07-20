import type {
  GuardrailKey,
  MvpDesign,
  ScopeGuardrailCheck,
} from '../../types/mvpDesign'
import { GUARDRAIL_LABEL, GUARDRAIL_LIMITS } from './scoringConfig'

interface DesignCounts {
  coreTasks: number
  roles: number
  screens: number
  forms: number
  aiFeatures: number
  reports: number
  externalApis: number
}

/** 확정(활성) 범위 기준으로 설계 요소 수를 센다 */
export function countDesignElements(
  design: Pick<MvpDesign, 'roles' | 'screens' | 'features' | 'aiFeatures' | 'integrations'>,
): DesignCounts {
  const activeFeatures = design.features.filter((f) => f.scope === 'must' || f.scope === 'should')
  const activeScreens = design.screens.filter((s) => s.scope === 'must' || s.scope === 'should')
  return {
    coreTasks: 1,
    roles: design.roles.length,
    screens: activeScreens.length,
    forms: activeFeatures.filter((f) => f.type === 'input_form').length,
    aiFeatures: design.aiFeatures.length,
    reports: activeFeatures.filter((f) => f.type === 'dashboard_report').length,
    externalApis: design.integrations.filter((i) => i.requiredBeforeMvp && i.readiness !== 'deferred').length,
  }
}

const COUNTED: { key: GuardrailKey; get: (c: DesignCounts) => number }[] = [
  { key: 'single_core_task', get: (c) => c.coreTasks },
  { key: 'max_roles', get: (c) => c.roles },
  { key: 'max_screens', get: (c) => c.screens },
  { key: 'max_forms', get: (c) => c.forms },
  { key: 'max_ai_features', get: (c) => c.aiFeatures },
  { key: 'max_reports', get: (c) => c.reports },
  { key: 'max_external_api', get: (c) => c.externalApis },
]

const FIXED_GUARDRAILS: GuardrailKey[] = [
  'no_native_app',
  'no_full_erp',
  'no_payment',
  'no_multi_tenant',
  'no_expert_replacement',
]

/** 범위 가드레일 점검 결과를 산출한다 (결정적) */
export function evaluateGuardrails(
  design: Pick<MvpDesign, 'roles' | 'screens' | 'features' | 'aiFeatures' | 'integrations'>,
): ScopeGuardrailCheck[] {
  const counts = countDesignElements(design)
  const checks: ScopeGuardrailCheck[] = COUNTED.map(({ key, get }) => {
    const limit = GUARDRAIL_LIMITS[key]
    const actual = get(counts)
    let status: ScopeGuardrailCheck['status'] = 'ok'
    let message = `${actual}${limit !== null ? ` / 상한 ${limit}` : ''}`
    if (limit !== null) {
      if (actual > limit) {
        status = 'exceeded'
        message = `${actual}개로 상한(${limit})을 초과했습니다. 범위를 줄이세요.`
      } else if (actual === limit) {
        status = 'warning'
        message = `${actual}개로 상한(${limit})에 도달했습니다.`
      }
    }
    return { key, label: GUARDRAIL_LABEL[key], limit, actual, status, message }
  })
  FIXED_GUARDRAILS.forEach((key) => {
    checks.push({ key, label: GUARDRAIL_LABEL[key], limit: null, actual: null, status: 'ok', message: '1차 범위에서 제외로 준수' })
  })
  return checks
}
