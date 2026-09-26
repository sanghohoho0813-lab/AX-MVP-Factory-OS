/**
 * 영업 관리 구분색 (D-118) — 대표 지시 "조금 색깔을 넣기는 해야겠어, 과하진 않게".
 *
 * 원본(기업컨설팅 OS)은 단계마다 파랑 · 보라 · 주황 · 금색을 따로 칠했다. 여기서는 테마 강조색 하나에서 색상만
 * 조금씩 옮긴 띠(index.css .ramp-*)를 쓴다 — 테마를 바꾸면 따라가고, 톤(밝기 · 채도)은 모두 같다.
 * 쓰는 곳은 작게: 칸 머리 · 점 · 숫자 알약 · 탭 아이콘. 칸 바탕 전체 · 카드 바탕은 칠하지 않는다.
 * 계약 완료는 성공색, 보류 · 이탈은 회색 — 의미가 있는 색은 OS 규칙 그대로.
 */
import type { CSSProperties } from 'react'
import type { SalesStage } from '../../types/clientOps'

/** 흐름 단계별 색상 이동(도) — 잠재 → 클로징으로 갈수록 조금씩 */
const STAGE_SHIFT: Partial<Record<SalesStage, number>> = { lead: 0, m1sched: 22, m1done: 44, m2: 66, closing: 88 }

export function rampStyle(shift: number): CSSProperties {
  return { ['--ramp-shift' as string]: String(Math.round(shift)) }
}

/** n 개 중 i 번째 — 0 ~ 88도 사이로 고르게 */
export function rampAt(index: number, count: number): CSSProperties {
  return rampStyle(count > 1 ? (88 / (count - 1)) * index : 0)
}

export interface StageColor {
  bar: string
  dot: string
  soft: string
  text: string
  border: string
  style?: CSSProperties
}

export function stageColor(stage: SalesStage): StageColor {
  if (stage === 'contracted') return { bar: 'bg-success-500', dot: 'bg-success-500', soft: 'bg-success-50', text: 'text-success-700', border: 'border-success-200' }
  if (stage === 'hold') return { bar: 'bg-slate-300', dot: 'bg-slate-400', soft: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }
  if (stage === 'lost') return { bar: 'bg-slate-200', dot: 'bg-slate-300', soft: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' }
  return { bar: 'ramp-bar', dot: 'ramp-dot', soft: 'ramp-soft', text: 'ramp-text', border: 'ramp-border', style: rampStyle(STAGE_SHIFT[stage] ?? 0) }
}
