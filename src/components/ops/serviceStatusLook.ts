import type { ServiceStatus } from '../../types/clientOps'

/**
 * D-129: 업무 상태는 점이 아니라 바탕색 있는 조각 + 글자로 — 멀리서도 보이게, 색만으로 판단하지 않게.
 *   진행 중 → 호박색 · 완료 → 브랜드색 · 고객 대기 → 보라 · 보류 · 시작 전 → 회색 · 기한 지남 → 빨강
 * 색은 이 여섯 가지뿐이다(알록달록해지지 않게). 현황 카드 · 업체 개요가 같이 쓴다.
 */
export const SERVICE_STATUS_LOOK: Record<ServiceStatus, string> = {
  in_progress: 'border-amber-300 bg-amber-100 text-amber-900',
  done: 'border-brand-200 bg-brand-100 text-brand-700',
  waiting_client: 'border-violet-200 bg-violet-100 text-violet-800',
  on_hold: 'border-slate-300 bg-slate-100 text-slate-700',
  not_started: 'border-slate-200 bg-slate-50 text-slate-600',
  not_applicable: 'border-slate-200 bg-white text-slate-400 line-through decoration-slate-300',
}

export const SERVICE_OVERDUE_LOOK = 'border-danger-200 bg-danger-50 text-danger-700'
