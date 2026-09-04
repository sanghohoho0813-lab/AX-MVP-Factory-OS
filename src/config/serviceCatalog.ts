import type { ServiceKey, ServiceStatus } from '../types/clientOps'
import { SERVICES, type ServiceMeta } from '../content/clientOpsCatalog'

/**
 * 서비스 레지스트리 — "이 회사가 고객에게 파는 업무 종류"의 목록.
 *
 * 기존 6종(ServiceKey)은 저장된 데이터와 묶여 있어 그대로 두고, 여기서는
 * 고객 노출·자금 연관·활성 여부처럼 조립 단위로 바뀌는 속성을 덧붙인다.
 * 새 업무를 추가할 때 union type·switch·카드 컴포넌트를 전부 고치지 않도록,
 * 화면은 SERVICE_REGISTRY 를 돌면서 그린다.
 *
 * 다른 컨설팅 회사용으로 옮길 때는 이 파일과 brand.config, moduleRegistry 를 바꾼다.
 */
export interface ServiceDefinition extends ServiceMeta {
  /** 고객 플랫폼에 이 업무의 존재·단계를 보여줄지 */
  customerVisible: boolean
  /** 정책자금·지원사업과 직접 연관(자금 화면에 함께 표시) */
  fundingRelated: boolean
  /** 이 제품 조립에서 켜져 있는지 */
  enabled: boolean
  /** 고객 플랫폼 주문 상품(slug)과의 대응 — 주문 이벤트에서 "이 업무 시작"을 추천하는 근거 */
  orderProductSlugs: string[]
}

const EXTRA: Record<ServiceKey, Omit<ServiceDefinition, keyof ServiceMeta>> = {
  incorporation: { customerVisible: true, fundingRelated: false, enabled: true, orderProductSlugs: ['incorporation'] },
  businessScope: { customerVisible: true, fundingRelated: false, enabled: true, orderProductSlugs: [] },
  patent: { customerVisible: true, fundingRelated: true, enabled: true, orderProductSlugs: ['patent'] },
  venture: { customerVisible: true, fundingRelated: true, enabled: true, orderProductSlugs: ['venture', 'venture-certification'] },
  ax: { customerVisible: true, fundingRelated: true, enabled: true, orderProductSlugs: ['ax', 'ax-build', 'ax-consulting'] },
  policyFund: { customerVisible: true, fundingRelated: true, enabled: true, orderProductSlugs: ['funding', 'funding-consulting', 'policy-fund'] },
}

export const SERVICE_REGISTRY: ServiceDefinition[] = SERVICES.map((s) => ({ ...s, ...EXTRA[s.key] }))

export function enabledServices(): ServiceDefinition[] {
  return SERVICE_REGISTRY.filter((s) => s.enabled).sort((a, b) => a.order - b.order)
}

export function serviceDefinition(key: ServiceKey): ServiceDefinition {
  const found = SERVICE_REGISTRY.find((s) => s.key === key)
  if (!found) throw new Error(`알 수 없는 업무: ${key}`)
  return found
}

/**
 * 주문 상품 slug 로 어떤 업무를 시작하면 좋을지 추천한다.
 * 확정이 아니라 추천이다 — 상태를 자동으로 바꾸지 않는다.
 */
export function suggestServiceForProduct(productSlug: string): ServiceDefinition | null {
  const slug = productSlug.trim().toLowerCase()
  if (!slug) return null
  for (const s of SERVICE_REGISTRY) {
    if (s.orderProductSlugs.some((p) => slug === p || slug.startsWith(`${p}-`) || slug.includes(p))) return s
  }
  return null
}

/* ------------------------------------------------------------------ */
/* 고객에게 보이는 단계 — 내부 8단계를 그대로 내보내지 않는다             */
/* ------------------------------------------------------------------ */

/** 고객 플랫폼에 보이는 프로젝트 단계 (portal_client_links.customer_stage 와 같은 값) */
export type CustomerStage =
  | 'preparing'
  | 'reviewing_docs'
  | 'in_progress'
  | 'submitted'
  | 'awaiting_result'
  | 'completed'

export const CUSTOMER_STAGE_ORDER: CustomerStage[] = [
  'preparing',
  'reviewing_docs',
  'in_progress',
  'submitted',
  'awaiting_result',
  'completed',
]

export const CUSTOMER_STAGE_LABEL: Record<CustomerStage, string> = {
  preparing: '준비 중',
  reviewing_docs: '자료 확인 중',
  in_progress: '진행 중',
  submitted: '기관 접수',
  awaiting_result: '결과 대기',
  completed: '완료',
}

/**
 * 내부 업무 상태 → 고객 공개 단계 추천.
 * 자동으로 고객 단계를 바꾸지 않는다. "고객에게 업데이트" 모달의 기본값 제안에만 쓴다.
 */
export function suggestCustomerStage(statuses: ServiceStatus[]): CustomerStage {
  const started = statuses.filter((s) => s !== 'not_applicable' && s !== 'not_started')
  if (started.length === 0) return 'preparing'
  if (started.every((s) => s === 'done')) return 'completed'
  if (started.some((s) => s === 'submitted')) return 'submitted'
  if (started.some((s) => s === 'in_progress')) return 'in_progress'
  if (started.some((s) => s === 'waiting_client' || s === 'preparing')) return 'reviewing_docs'
  return 'preparing'
}

export function isCustomerStage(v: unknown): v is CustomerStage {
  return typeof v === 'string' && (CUSTOMER_STAGE_ORDER as string[]).includes(v)
}
