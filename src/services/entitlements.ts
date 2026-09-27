/**
 * ENTITLEMENT — 이 작업공간이 지금 무엇을 쓸 수 있는가 (D-127)
 *
 * 넣는 것: 요금제 고른 것(Subscription) + 대표가 따로 정한 것(moduleAccess 기록: 체험 · 열기 · 잠그기)
 * 나오는 것: 모듈마다 · 기능마다 '쓸 수 있나 / 왜'
 *
 * 순서 (위가 이긴다)
 *   1. 기본 OS 에 든 것 → 늘 쓴다
 *   2. 대표가 잠근 것 → 잠김
 *   3. 요금제에 든 것(ALL 은 전부 · GROWTH/PRO 는 고른 모듈) → 쓴다
 *   4. 대표가 열어 둔 것 · 체험 중인 것 → 쓴다 (체험이 끝나면 잠김)
 *   5. 나머지 → 요금제에 없음
 * 기능 하나에 대한 기록(D-91 때 도구마다 남긴 것)은 모듈 기록보다 먼저 본다 — 예전 결정을 그대로 지킨다.
 *
 * 화면은 요금제 이름을 모른다. `feature(key).usable` · `module(key).usable` 만 본다.
 * 이 파일은 계산만 한다(저장 · 화면 없음) — 그래서 단위 시험으로 다 잰다.
 */

import {
  BASE_MODULE_KEY,
  DEFAULT_PLAN_KEY,
  FEATURE_CATALOG,
  MODULE_CATALOG,
  PLAN_CATALOG,
  PRICE_RULES,
  type BillingPeriod,
  type CatalogFeature,
  type CatalogModule,
  type LockedPreview,
  type PlanDefinition,
  type PriceRule,
} from '../config/productCatalog'
import { canUse, trialDaysLeft, type ModuleAccess } from './moduleAccess'
import { josa } from '../lib/josa'

/* ------------------------------------------------------------------ */
/* 요금제 고른 것                                                         */
/* ------------------------------------------------------------------ */

export interface Subscription {
  planKey: string
  /** GROWTH · PRO 에서 고른 모듈 key */
  selectedModules: string[]
  updatedAt: string
}

export function defaultSubscription(): Subscription {
  return { planKey: DEFAULT_PLAN_KEY, selectedModules: [], updatedAt: '' }
}

export interface Catalog {
  modules: CatalogModule[]
  features: CatalogFeature[]
  plans: PlanDefinition[]
}

export const DEFAULT_CATALOG: Catalog = { modules: MODULE_CATALOG, features: FEATURE_CATALOG, plans: PLAN_CATALOG }

function planIn(catalog: Catalog, key: string): PlanDefinition {
  return catalog.plans.find((p) => p.key === key) ?? catalog.plans.find((p) => p.key === DEFAULT_PLAN_KEY) ?? catalog.plans[catalog.plans.length - 1]
}

/** 고를 수 있는 모듈인가 */
function eligible(m: CatalogModule): boolean {
  return m.addonEligible && !m.includedInBase && m.visible && m.status !== 'planned'
}

/**
 * 고른 모듈 검사 — 요금제가 허락하는 수 · 고를 수 있는 것 · 함께 필요한 모듈.
 * selected 는 쓸 수 있는 것만 남긴 목록(앞에서부터 요금제 수만큼).
 */
export function validateSelection(planKey: string, picked: string[], catalog: Catalog = DEFAULT_CATALOG): { ok: boolean; errors: string[]; selected: string[] } {
  const plan = planIn(catalog, planKey)
  const errors: string[] = []
  if (plan.includesAllModules || plan.selectableModules === 0) {
    return { ok: picked.length === 0 || plan.includesAllModules, errors: picked.length > 0 && !plan.includesAllModules ? [`${josa(plan.name, '은/는')} 모듈을 고르지 않습니다.`] : [], selected: [] }
  }
  const uniq = [...new Set(picked)]
  const known = uniq.filter((k) => {
    const m = catalog.modules.find((x) => x.key === k)
    if (!m || !eligible(m)) {
      errors.push(`${josa(m?.name ?? k, '은/는')} 고를 수 있는 모듈이 아닙니다.`)
      return false
    }
    return true
  })
  if (known.length > plan.selectableModules) errors.push(`${josa(plan.name, '은/는')} 모듈을 ${plan.selectableModules}개까지 고릅니다 (지금 ${known.length}개).`)
  const selected = known.slice(0, plan.selectableModules)
  for (const k of selected) {
    const m = catalog.modules.find((x) => x.key === k) as CatalogModule
    for (const dep of m.dependencies) {
      const d = catalog.modules.find((x) => x.key === dep)
      if (d && !d.includedInBase && !selected.includes(dep)) errors.push(`${josa(m.name, '은/는')} ${d.name} 모듈이 함께 있어야 합니다.`)
    }
  }
  return { ok: errors.length === 0, errors, selected }
}

/* ------------------------------------------------------------------ */
/* 계산                                                                  */
/* ------------------------------------------------------------------ */

export type EntitlementSource =
  | 'base' // 기본 OS
  | 'plan' // 요금제에 전부 들어 있음(ALL)
  | 'selected' // GROWTH · PRO 에서 고름
  | 'granted' // 대표가 열어 둠
  | 'trial' // 체험 중
  | 'trial-ended' // 체험 끝남
  | 'locked' // 대표가 잠금
  | 'not-in-plan' // 요금제에 없음
  | 'needs-dependency' // 함께 필요한 모듈이 없음

export interface ModuleEntitlement {
  moduleKey: string
  usable: boolean
  source: EntitlementSource
  /** 체험 중이면 남은 날 */
  trialDaysLeft: number | null
  /** 화면에 적을 한 줄 */
  label: string
}

export interface FeatureEntitlement {
  featureKey: string
  /** 카탈로그에 없는 기능(기본 화면)은 null */
  moduleKey: string | null
  usable: boolean
  source: EntitlementSource
  label: string
  lockedPreview: LockedPreview
  trialDaysLeft: number | null
}

export interface Entitlements {
  plan: PlanDefinition
  subscription: Subscription
  modules: Map<string, ModuleEntitlement>
  module(key: string): ModuleEntitlement
  feature(key: string): FeatureEntitlement
}

export function sourceLabel(source: EntitlementSource, daysLeft: number | null = null): string {
  switch (source) {
    case 'base':
      return '기본'
    case 'plan':
      return '요금제에 포함'
    case 'selected':
      return '고른 모듈'
    case 'granted':
      return '열어 둠'
    case 'trial':
      return daysLeft === null ? '체험 중' : `체험 ${daysLeft}일 남음`
    case 'trial-ended':
      return '체험 끝남'
    case 'locked':
      return '잠김'
    case 'not-in-plan':
      return '요금제에 없음'
    case 'needs-dependency':
      return '함께 필요한 모듈 없음'
  }
}

/** 대표가 따로 정한 기록 하나를 읽는다 — 없거나 '요금제 따름' 이면 null */
function overrideOf(access: ModuleAccess | undefined, today: string): { usable: boolean; source: EntitlementSource; daysLeft: number | null } | null {
  if (!access || access.state === 'inherit') return null
  if (access.state === 'locked') return { usable: false, source: 'locked', daysLeft: null }
  if (access.state === 'trial') {
    const usable = canUse(access, today)
    return { usable, source: usable ? 'trial' : 'trial-ended', daysLeft: trialDaysLeft(access, today) }
  }
  return { usable: true, source: 'granted', daysLeft: null }
}

export function resolveEntitlements(
  subscription: Subscription,
  overrides: Map<string, ModuleAccess>,
  today: string,
  catalog: Catalog = DEFAULT_CATALOG,
): Entitlements {
  const plan = planIn(catalog, subscription.planKey)
  const picked = new Set(validateSelection(plan.key, subscription.selectedModules, catalog).selected)

  const first = new Map<string, ModuleEntitlement>()
  for (const m of catalog.modules) {
    const make = (usable: boolean, source: EntitlementSource, daysLeft: number | null = null): ModuleEntitlement => ({
      moduleKey: m.key,
      usable,
      source,
      trialDaysLeft: daysLeft,
      label: sourceLabel(source, daysLeft),
    })
    if (m.includedInBase && plan.includesBase) {
      first.set(m.key, make(true, 'base'))
      continue
    }
    const o = overrideOf(overrides.get(m.entitlementKey), today)
    if (o && o.source === 'locked') first.set(m.key, make(false, 'locked'))
    else if (plan.includesAllModules && m.status !== 'planned') first.set(m.key, make(true, 'plan'))
    else if (picked.has(m.key)) first.set(m.key, make(true, 'selected'))
    else if (o) first.set(m.key, make(o.usable, o.source, o.daysLeft))
    else first.set(m.key, make(false, 'not-in-plan'))
  }
  // 함께 필요한 모듈이 없으면 쓸 수 없다
  const modules = new Map<string, ModuleEntitlement>()
  for (const m of catalog.modules) {
    const e = first.get(m.key) as ModuleEntitlement
    const missing = e.usable && m.dependencies.some((d) => first.get(d)?.usable === false)
    modules.set(m.key, missing ? { ...e, usable: false, source: 'needs-dependency', label: sourceLabel('needs-dependency') } : e)
  }

  const base: ModuleEntitlement = { moduleKey: BASE_MODULE_KEY, usable: true, source: 'base', trialDaysLeft: null, label: sourceLabel('base') }
  const module = (key: string) => modules.get(key) ?? { ...base, moduleKey: key }
  const feature = (key: string): FeatureEntitlement => {
    const f = catalog.features.find((x) => x.key === key)
    if (!f) return { featureKey: key, moduleKey: null, usable: true, source: 'base', label: sourceLabel('base'), lockedPreview: 'full', trialDaysLeft: null }
    const m = module(f.module)
    const own = overrideOf(overrides.get(key), today)
    const pick = own ?? { usable: m.usable, source: m.source, daysLeft: m.trialDaysLeft }
    return {
      featureKey: key,
      moduleKey: f.module,
      usable: pick.usable,
      source: pick.source,
      label: sourceLabel(pick.source, pick.daysLeft),
      lockedPreview: f.lockedPreview,
      trialDaysLeft: pick.daysLeft,
    }
  }
  return { plan, subscription, modules, module, feature }
}

/** 요금제 · 기록을 아직 못 읽었을 때 — 아무것도 잠그지 않는다 */
export function openEntitlements(today: string): Entitlements {
  return resolveEntitlements(defaultSubscription(), new Map(), today)
}

/* ------------------------------------------------------------------ */
/* 가격 — 결제는 없다. 정한 가격이 있을 때 얼마인지 셈만 한다              */
/* ------------------------------------------------------------------ */

export interface Quote {
  /** 월 정가 */
  monthlyList: number
  period: BillingPeriod
  /** 이 주기 한 번에 내는 돈 */
  amount: number
  /** 붙은 규칙 이름 */
  applied: string[]
}

function ruleActive(r: PriceRule, target: { kind: 'module' | 'plan'; key: string }, period: BillingPeriod, today: string): boolean {
  if (r.appliesTo.kind !== target.kind) return false
  if (r.appliesTo.keys && !r.appliesTo.keys.includes(target.key)) return false
  if (r.period && r.period !== period) return false
  if (r.validFrom && today < r.validFrom) return false
  if (r.validTo && today > r.validTo) return false
  return true
}

/** 정가가 없으면(미정) null */
export function quote(
  target: { kind: 'module' | 'plan'; key: string },
  period: BillingPeriod,
  today: string,
  opts: { rules?: PriceRule[]; catalog?: Catalog } = {},
): Quote | null {
  const catalog = opts.catalog ?? DEFAULT_CATALOG
  const rules = opts.rules ?? PRICE_RULES
  const list = target.kind === 'module' ? catalog.modules.find((m) => m.key === target.key)?.listPrice : catalog.plans.find((p) => p.key === target.key)?.listPrice
  if (list === null || list === undefined) return null
  const active = rules.filter((r) => ruleActive(r, target, period, today))
  let monthly = list
  const applied: string[] = []
  for (const r of active.filter((x) => x.kind === 'fixed-monthly')) {
    if (r.value < monthly) {
      monthly = r.value
      applied.push(r.label)
    }
  }
  for (const r of active.filter((x) => x.kind === 'percent-off')) {
    monthly = monthly * (1 - r.value / 100)
    applied.push(r.label)
  }
  let months = period === 'year' ? 12 : 1
  if (period === 'year') {
    for (const r of active.filter((x) => x.kind === 'months-free')) {
      months = Math.max(0, months - r.value)
      applied.push(r.label)
    }
  }
  return { monthlyList: list, period, amount: Math.round(monthly * months), applied }
}
