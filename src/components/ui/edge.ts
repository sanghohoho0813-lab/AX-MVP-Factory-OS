/**
 * D-483 강조 테두리 — 대표 지시(2026-11-02): "사각형에서 한쪽 테두리만 칠하는 건 절대 없게 — 칠할 거면 네 변을 같은 색으로."
 * 왼쪽 · 위쪽 3px 막대 대신 네 변을 같은 색으로 두른다. ring 은 자리를 차지하지 않아 칸 크기는 예전과 같다.
 *  - EDGE_BOX: 테두리가 있는 박스(border 와 함께 쓴다 — 'border' 는 박스가 이미 가진 것)
 *  - EDGE_INSET: 테두리 없이 한 판 안에 있는 칸(칸 사이 1px 선) — 안쪽에 네 변
 * test:edge 가 src 에서 한쪽만 칠하는 꼴(border-l-4 · inset-y-0 left-0 w-[3px] …)을 막는다.
 */
export type EdgeTone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success'

export const EDGE_BOX: Record<EdgeTone, string> = {
  neutral: 'border-slate-200',
  brand: 'border-brand-400 ring-1 ring-inset ring-brand-400',
  danger: 'border-danger-400 ring-1 ring-inset ring-danger-400',
  warning: 'border-warning-400 ring-1 ring-inset ring-warning-400',
  success: 'border-success-400 ring-1 ring-inset ring-success-400',
}

export const EDGE_INSET: Record<EdgeTone, string> = {
  neutral: '',
  brand: 'ring-2 ring-inset ring-brand-400',
  danger: 'ring-2 ring-inset ring-danger-400',
  warning: 'ring-2 ring-inset ring-warning-400',
  success: 'ring-2 ring-inset ring-success-400',
}
