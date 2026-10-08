/**
 * 제품 카탈로그 — 무엇을 어떤 묶음으로 팔 수 있는가 (D-127)
 *
 * 네 층을 나눈다. **한 층을 바꿀 때 다른 층의 코드를 고치지 않는다.**
 *
 *   FEATURE      코드에 있는 화면·도구. `toolRegistry.ts`(도구) · `moduleRegistry.ts`(메뉴)가 맡는다.
 *                여기서는 그 key 로만 가리킨다 — 기능이 있다는 것과 쓸 권리는 다른 이야기다.
 *   MODULE       팔 수 있는 묶음. 기능 여러 개를 하나로 묶는다(MODULE_CATALOG · FEATURE_CATALOG).
 *   PLAN         요금제 — 기본 OS + 고를 수 있는 모듈 수(PLAN_CATALOG).
 *   ENTITLEMENT  이 작업공간이 지금 무엇을 쓸 수 있는가. `services/entitlements.ts` 가 계산한다.
 *
 * 가격은 이 파일의 `listPrice` 와 PRICE_RULES 에만 있다. 창립 가격 · 연 결제 · 행사 가격은
 * PRICE_RULES 에 줄을 더하는 것으로 끝난다 — 화면 코드에서 가격을 읽거나 적지 않는다.
 * 결제 · PG · 구독 청구는 아직 없다. 가격을 정하지 않은 것은 null(미정)로 둔다.
 *
 * 화면에서 요금제 이름(BASIC 등)으로 if 문을 쓰지 않는다 — `useEntitlements()` 에 물어본다.
 */

import type { LucideIcon } from 'lucide-react'
import { Building2, Calculator, Globe, Landmark, Lightbulb, Sparkles, TrendingUp } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* 분야(카테고리) — 메뉴에 한 줄씩. 모듈이 늘어도 분야 줄은 늘지 않는다     */
/* ------------------------------------------------------------------ */

export type ModuleCategoryKey = 'base' | 'growth' | 'gov' | 'tax' | 'tech' | 'ax' | 'web'

export interface ModuleCategory {
  key: ModuleCategoryKey
  name: string
  order: number
}

export const MODULE_CATEGORIES: ModuleCategory[] = [
  { key: 'base', name: '기본 OS', order: 0 },
  { key: 'growth', name: '기업성장', order: 1 },
  { key: 'gov', name: '정부지원사업', order: 2 },
  { key: 'tax', name: '절세·재무', order: 3 },
  { key: 'tech', name: '기술사업화', order: 4 },
  // D-120 쉬운 말: 'AX STUDIO' → 'AX 스튜디오' (화면 이름만 — key 는 그대로)
  { key: 'ax', name: 'AX 스튜디오', order: 5 },
  { key: 'web', name: '웹 스튜디오', order: 6 },
]

/* ------------------------------------------------------------------ */
/* MODULE — 팔 수 있는 묶음                                              */
/* ------------------------------------------------------------------ */

/** live: 담긴 일이 다 있다 · partial: 일부만 있다(나머지는 upcoming) · planned: 자리만 */
export type CatalogStatus = 'live' | 'partial' | 'planned'

export interface CatalogModule {
  key: string
  name: string
  /** 한 줄 소개 — 잠김 화면 · 모듈 살펴보기에 그대로 쓴다 */
  description: string
  /** 이 모듈이 맡는 일(쉬운 말) — 잠김 화면 한 줄: "기업인증 · 정책자금 · …" */
  covers: string[]
  /** 아직 들어오지 않은 일 — '앞으로 들어올 것' 으로 적는다 */
  upcoming: string[]
  category: ModuleCategoryKey
  /** 모듈 살펴보기 주소 */
  route: string
  icon: LucideIcon
  status: CatalogStatus
  /** 기본 OS 에 들어 있다(어느 요금제든 쓴다) */
  includedInBase: boolean
  /** GROWTH · PRO 에서 고를 수 있다 */
  addonEligible: boolean
  /** 월 정가(원). null = 아직 정하지 않음 */
  listPrice: number | null
  /** 권한 이름 — 저장된 체험·열기 기록이 이 이름을 쓴다(도구 key 와 겹치지 않게 `module.` 로 시작) */
  entitlementKey: string
  /** 함께 있어야 도는 다른 모듈의 key */
  dependencies: string[]
  /** 메뉴 · 모듈 목록에 보이는가 */
  visible: boolean
  /** D-136: 거의 쓰지 않는 모듈 — 목차의 접힌 '잘 안 쓰는 기능' 묶음 · 업체 상세 모듈 입구 맨 뒤 */
  rarelyUsed?: boolean
  order: number
}

export const BASE_MODULE_KEY = 'basic-os'

export const MODULE_CATALOG: CatalogModule[] = [
  {
    key: BASE_MODULE_KEY,
    name: '기본 OS',
    description: '고객 · 일정 · 상담 · 영업 · 자료 · 업무 기록 · 정산 · 오늘 화면',
    covers: ['고객', '일정', '상담', '영업', '자료', '업무 기록', '정산', '오늘 화면'],
    upcoming: [],
    category: 'base',
    route: '/',
    icon: Building2,
    status: 'live',
    includedInBase: true,
    addonEligible: false,
    listPrice: null,
    entitlementKey: 'base',
    dependencies: [],
    visible: false,
    order: 0,
  },
  {
    key: 'growth',
    name: '기업성장',
    description: '정책자금 · 고용지원금 · 연구소 · 지원사업 공고까지 한 업체 기록으로 잇습니다.',
    covers: ['정책자금', '고용지원금', '연구소', '지원사업', '기업인증', '보증'],
    upcoming: ['보증'],
    category: 'growth',
    route: '/modules/growth',
    icon: TrendingUp,
    status: 'partial',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.growth',
    dependencies: [],
    visible: true,
    order: 1,
  },
  {
    key: 'gov-support',
    name: '정부지원사업',
    description: '사업화 · R&D · 바우처 · 수출 지원사업을 찾고 신청 흐름을 관리합니다.',
    covers: ['사업화', 'R&D', '바우처', '수출', '공고 매칭'],
    upcoming: ['공고 매칭'],
    category: 'gov',
    route: '/modules/gov-support',
    icon: Landmark,
    status: 'partial',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.gov-support',
    dependencies: [],
    // D-163: 전문 모듈은 기업성장 · 절세·재무 둘만 — 지원사업(공고 알림 · 자금 연계)은 기업성장 안으로. 권한 이름은 예전 기록 때문에 그대로 둔다
    visible: false,
    order: 2,
  },
  {
    key: 'tax-finance',
    name: '절세·재무',
    description: '세금 계산 · 창업감면 판정 · 재무 분석으로 업체의 돈 문제를 먼저 봅니다.',
    covers: ['세금', '감면', '재무', '가업승계'],
    upcoming: ['가업승계'],
    category: 'tax',
    route: '/modules/tax-finance',
    icon: Calculator,
    status: 'partial',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.tax-finance',
    dependencies: [],
    visible: true,
    order: 3,
  },
  {
    key: 'tech-biz',
    name: '기술사업화',
    description: '특허 · R&D 기획을 단계별로 관리합니다(벤처기업 확인은 기업성장 › 기업인증).',
    covers: ['특허', 'R&D 기획', '기술사업화'],
    upcoming: [],
    category: 'tech',
    route: '/modules/tech-biz',
    icon: Lightbulb,
    status: 'live',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.tech-biz',
    dependencies: [],
    visible: true,
    rarelyUsed: true,
    order: 4,
  },
  {
    key: 'ax-studio',
    name: 'AX 스튜디오',
    description: 'AX 진단부터 만들 업무 고르기 · 시스템 설계 · 현장 검증 · 결과자료까지.',
    covers: ['AX 진단', 'MVP', '시스템 기획', '구축 지원'],
    upcoming: [],
    category: 'ax',
    route: '/modules/ax-studio',
    icon: Sparkles,
    status: 'live',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.ax-studio',
    dependencies: [],
    visible: true,
    rarelyUsed: true,
    order: 5,
  },
  {
    key: 'web-studio',
    name: '웹 스튜디오',
    description: '업체 홈페이지 · 랜딩페이지를 설계합니다.',
    covers: ['홈페이지', '랜딩페이지'],
    upcoming: ['랜딩페이지'],
    category: 'web',
    route: '/modules/web-studio',
    icon: Globe,
    status: 'partial',
    includedInBase: false,
    addonEligible: true,
    listPrice: null,
    entitlementKey: 'module.web-studio',
    dependencies: [],
    visible: true,
    rarelyUsed: true,
    order: 6,
  },
]

/* ------------------------------------------------------------------ */
/* FEATURE → MODULE — 코드에 있는 기능이 어느 묶음에 드는가               */
/* ------------------------------------------------------------------ */

/**
 * 잠겨 있을 때 얼마나 보여 주나
 *  - first-section 목차가 여러 칸인 도구: 첫 화면은 보이고 나머지는 잠김 안내 (D-91 규칙 그대로)
 *  - full          한 장짜리: 잠겨도 다 보인다 (D-91 '한 장짜리는 잠그지 않는다')
 *  - intro         화면 대신 모듈 소개가 선다
 */
export type LockedPreview = 'first-section' | 'full' | 'intro'

export interface CatalogFeature {
  /** 코드의 이름 — toolRegistry 의 key(도구) 또는 moduleRegistry 의 key(메뉴 줄) */
  key: string
  source: 'tool' | 'nav'
  /** MODULE_CATALOG 의 key */
  module: string
  lockedPreview: LockedPreview
  /**
   * 업체 화면에서 부르는 말 — "고용지원금 [확인하기]".
   * path 에 `{client}` 가 있으면 업체 번호로 바꾸고, 없으면 `?client=` 를 붙인다.
   * 도구는 첫 주소로 연다 — 도구가 업체를 보고 알맞은 화면(이미 등록된 업체면 그 업체 화면, D-94)으로 보낸다.
   */
  clientEntry?: { topic: string; verb: string; path: string }
  /** 모듈 살펴보기에 적을 한 줄 (없으면 도구 설명) */
  summary?: string
  /**
   * D-167: 메뉴 · 모듈 살펴보기에서 숨김(대표: "지원사업 알림 · 정책자금 진단이 따로 있어 오히려 헷갈린다").
   * 지우지 않는다 — 화면 · 저장된 자료 · 요금제 계산은 그대로이고 주소로는 열린다. 되돌리려면 이 표시만 뺀다.
   */
  hidden?: boolean
}

export const FEATURE_CATALOG: CatalogFeature[] = [
  // 기업성장
  { key: 'policy-funding', source: 'tool', module: 'growth', lockedPreview: 'first-section', clientEntry: { topic: '정책자금', verb: '진단하기', path: '/tools/policy-funding/diagnosis' } },
  { key: 'employment', source: 'tool', module: 'growth', lockedPreview: 'first-section', clientEntry: { topic: '고용지원금', verb: '확인하기', path: '/tools/employment' } },
  { key: 'labcare', source: 'tool', module: 'growth', lockedPreview: 'first-section', clientEntry: { topic: '기업부설연구소', verb: '검토하기', path: '/tools/labcare' } },
  // D-163: 지원사업 알림 — 영업 목차에서 기업성장 안으로(요금제와 상관없이 늘 열림)
  { key: 'grants', source: 'nav', module: 'growth', lockedPreview: 'full', summary: '업체 조건에 맞는 공고 · 마감 임박 · 신청 준비를 봅니다.' },
  { key: 'cert-os', source: 'tool', module: 'growth', lockedPreview: 'first-section', clientEntry: { topic: '기업인증', verb: '확인하기', path: '/tools/cert-os' } },
  // 예전 '정부지원사업' 모듈의 기능 — D-163 부터 기업성장 안
  { key: 'funding', source: 'nav', module: 'growth', lockedPreview: 'intro', hidden: true, summary: '지원사업 신청 흐름과 필요한 서류를 업체별로 관리합니다.' },
  { key: 'institutions', source: 'nav', module: 'growth', lockedPreview: 'intro', hidden: true, summary: '기관 · 프로그램 목록과 기관별 전략을 봅니다.' },
  // 절세·재무
  { key: 'tax', source: 'tool', module: 'tax-finance', lockedPreview: 'full', clientEntry: { topic: '절세', verb: '계산하기', path: '/tools/tax' } },
  { key: 'startup-tax', source: 'tool', module: 'tax-finance', lockedPreview: 'first-section', clientEntry: { topic: '창업감면', verb: '판정하기', path: '/tools/startup-tax' } },
  { key: 'cretop', source: 'tool', module: 'tax-finance', lockedPreview: 'first-section', clientEntry: { topic: '재무 분석(크레탑)', verb: '분석하기', path: '/tools/cretop' } },
  // 기술사업화
  { key: 'consulting-studio', source: 'nav', module: 'tech-biz', lockedPreview: 'intro', clientEntry: { topic: '특허·MVP 프로젝트', verb: '관리하기', path: '/ops/clients/{client}?tab=consulting' }, summary: '특허 출원 · MVP 단계를 프로젝트별로 관리합니다(벤처기업 확인은 기업성장 › 기업인증).' },
  // AX STUDIO
  { key: 'diagnosis', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '설문으로 업체의 업무를 진단하고 AX 기회를 찾습니다.' },
  { key: 'selection', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '진단 결과에서 먼저 만들 업무를 고릅니다.' },
  { key: 'mvp-design', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '고른 업무의 화면 · 데이터 · 흐름을 설계합니다.' },
  { key: 'validation', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '현장에서 써 보고 결과를 모읍니다.' },
  { key: 'deliverables', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '제출용 결과자료를 만듭니다.' },
  { key: 'cases', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', summary: '지난 사례를 찾아봅니다.' },
  { key: 'clients', source: 'nav', module: 'ax-studio', lockedPreview: 'intro', clientEntry: { topic: 'AX 프로젝트', verb: '열기', path: '/ax/open' }, summary: 'AX 프로젝트를 고객사 단위로 관리합니다.' },
  // WEB STUDIO
  { key: 'website-studio', source: 'nav', module: 'web-studio', lockedPreview: 'intro', summary: '업체 홈페이지의 구성 · 문구 · 디자인을 설계합니다.' },
]

/* ------------------------------------------------------------------ */
/* PLAN — 요금제                                                         */
/* ------------------------------------------------------------------ */

export interface PlanDefinition {
  key: string
  name: string
  /** 쉬운 말 한 줄 */
  summary: string
  /** 기본 OS 가 들어 있다 */
  includesBase: boolean
  /** 고를 수 있는 모듈 수 (includesAllModules 면 뜻 없음) */
  selectableModules: number
  /** 모든 모듈이 들어 있다 */
  includesAllModules: boolean
  /** 월 정가(원). null = 아직 정하지 않음 */
  listPrice: number | null
  order: number
}

export const PLAN_CATALOG: PlanDefinition[] = [
  { key: 'BASIC', name: 'BASIC', summary: '기본 OS만', includesBase: true, selectableModules: 0, includesAllModules: false, listPrice: null, order: 1 },
  { key: 'GROWTH', name: 'GROWTH', summary: '기본 OS + 전문 모듈 2개', includesBase: true, selectableModules: 2, includesAllModules: false, listPrice: null, order: 2 },
  { key: 'PRO', name: 'PRO', summary: '기본 OS + 전문 모듈 4개', includesBase: true, selectableModules: 4, includesAllModules: false, listPrice: null, order: 3 },
  { key: 'ALL', name: 'ALL', summary: '기본 OS + 모든 전문 모듈', includesBase: true, selectableModules: 0, includesAllModules: true, listPrice: null, order: 4 },
]

/**
 * 요금제를 아직 고르지 않은 작업공간이 받는 요금제.
 * 결제가 붙기 전까지 지금 쓰는 것을 하나도 잠그지 않도록 ALL 이다.
 */
export const DEFAULT_PLAN_KEY = 'ALL'

/* ------------------------------------------------------------------ */
/* 가격 규칙 — 창립 가격 · 연 결제 · 행사                                 */
/* ------------------------------------------------------------------ */

export type BillingPeriod = 'month' | 'year'

export interface PriceRule {
  key: string
  /** 화면에 적을 이름 — "창립 회원가" */
  label: string
  /** 어디에 붙나 — 비우면 전부 */
  appliesTo: { kind: 'module' | 'plan'; keys?: string[] }
  /** 이 결제 주기에만 (비우면 둘 다) */
  period?: BillingPeriod
  /** percent-off: 몇 % 깎기 · fixed-monthly: 월 가격을 이 값으로 · months-free: 연 결제에서 몇 달 빼기 */
  kind: 'percent-off' | 'fixed-monthly' | 'months-free'
  value: number
  /** YYYY-MM-DD (포함) */
  validFrom?: string
  validTo?: string
}

/** 지금은 비어 있다 — 대표가 정하면 여기에 줄만 더한다 */
export const PRICE_RULES: PriceRule[] = []

/* ------------------------------------------------------------------ */
/* 찾기                                                                  */
/* ------------------------------------------------------------------ */

export function catalogModule(key: string): CatalogModule | undefined {
  return MODULE_CATALOG.find((m) => m.key === key)
}

export function catalogFeature(key: string): CatalogFeature | undefined {
  return FEATURE_CATALOG.find((f) => f.key === key)
}

export function planOf(key: string | null | undefined): PlanDefinition {
  return PLAN_CATALOG.find((p) => p.key === key) ?? (PLAN_CATALOG.find((p) => p.key === DEFAULT_PLAN_KEY) as PlanDefinition)
}

/** 메뉴 · 모듈 목록에 보일 전문 모듈 (기본 OS 제외) — 순서대로 */
export function visibleModules(): CatalogModule[] {
  return MODULE_CATALOG.filter((m) => m.visible && !m.includedInBase).sort((a, b) => a.order - b.order)
}

/** GROWTH · PRO 에서 고를 수 있는 모듈 */
export function selectableModules(): CatalogModule[] {
  return visibleModules().filter((m) => m.addonEligible && m.status !== 'planned')
}

export function featuresOfModule(moduleKey: string): CatalogFeature[] {
  return FEATURE_CATALOG.filter((f) => f.module === moduleKey && !f.hidden)
}

export function categoryName(key: ModuleCategoryKey): string {
  return MODULE_CATEGORIES.find((c) => c.key === key)?.name ?? key
}
