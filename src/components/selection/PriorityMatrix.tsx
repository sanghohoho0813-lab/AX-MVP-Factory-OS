import { useMemo } from 'react'
import type { AutomationCandidate, PriorityQuadrant } from '../../types/selection'
import { QUADRANT_META } from '../../lib/selectionMeta'
import { TONE_DOT_CLASS } from '../../lib/statusMeta'
import { computeAxes } from '../../services/selection/candidateScoring'
import { PriorityQuadrantBadge } from './badges'

interface Point {
  candidate: AutomationCandidate
  x: number
  y: number
}

function buildPoints(candidates: AutomationCandidate[]): Point[] {
  // 셀 단위로 겹치는 점에 결정적 offset 적용 (random 금지)
  const byCell = new Map<string, number>()
  return candidates.map((candidate) => {
    const { impact, feasibility } = computeAxes(candidate.domainScores)
    const cellKey = `${Math.round(feasibility / 12)}-${Math.round(impact / 12)}`
    const seen = byCell.get(cellKey) ?? 0
    byCell.set(cellKey, seen + 1)
    const offset = seen === 0 ? 0 : ((seen % 4) - 1.5) * 3
    return {
      candidate,
      x: Math.max(4, Math.min(96, feasibility + offset)),
      y: Math.max(4, Math.min(96, impact + offset)),
    }
  })
}

export function PriorityMatrix({
  candidates,
  onOpen,
}: {
  candidates: AutomationCandidate[]
  onOpen: (c: AutomationCandidate) => void
}) {
  const points = useMemo(() => buildPoints(candidates), [candidates])

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative aspect-square w-full rounded-(--radius-panel) border border-slate-200 bg-white">
        {/* 사분면 배경 */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="border-r border-b border-slate-100 bg-accent-50/30" />
          <div className="border-b border-slate-100 bg-success-50/40" />
          <div className="border-r border-slate-100 bg-slate-50/40" />
          <div className="bg-warning-50/30" />
        </div>
        {/* 사분면 라벨 */}
        <span className="absolute top-2 left-2 text-[11px] font-medium text-accent-600">전략적 투자</span>
        <span className="absolute top-2 right-2 text-[11px] font-medium text-success-700">빠른 실행</span>
        <span className="absolute bottom-2 left-2 text-[11px] font-medium text-slate-400">후순위 보류</span>
        <span className="absolute right-2 bottom-2 text-[11px] font-medium text-warning-700">선행 준비 필요</span>

        {/* 축 */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-200" />
        <div className="absolute top-1/2 right-0 left-0 h-px bg-slate-200" />

        {/* 점 */}
        {points.map(({ candidate, x, y }) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onOpen(candidate)}
            aria-label={`${candidate.name} · 우선순위 ${candidate.priorityScore}점 · ${QUADRANT_META[candidate.quadrant].label}`}
            title={`${candidate.name} (${candidate.priorityScore}점)`}
            className="group absolute -translate-x-1/2 translate-y-1/2 cursor-pointer"
            style={{ left: `${x}%`, bottom: `${y}%` }}
          >
            <span
              className={`block size-3.5 rounded-full ring-2 ring-white ${TONE_DOT_CLASS[QUADRANT_META[candidate.quadrant].tone]}`}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded-md bg-navy-900 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-focus:block">
              {candidate.name}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>← 구현 가능성 낮음</span>
        <span>구현 가능성 높음 →</span>
      </div>
      <p className="mt-1 text-center text-xs text-slate-400">세로축: 운영·사업 효과 (위로 갈수록 큼)</p>
    </div>
  )
}

/** 모바일·목록 대체: 사분면별 후보 목록 */
export function PriorityMatrixList({
  candidates,
  onOpen,
}: {
  candidates: AutomationCandidate[]
  onOpen: (c: AutomationCandidate) => void
}) {
  const order: PriorityQuadrant[] = ['quick_win', 'strategic_bet', 'prepare_first', 'defer']
  return (
    <div className="flex flex-col gap-4">
      {order.map((q) => {
        const items = candidates.filter((c) => c.quadrant === q)
        if (items.length === 0) return null
        return (
          <div key={q}>
            <div className="mb-1.5">
              <PriorityQuadrantBadge quadrant={q} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {items
                .sort((a, b) => b.priorityScore - a.priorityScore)
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(c)}
                      className="flex w-full items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate text-[13px] font-medium text-slate-700">{c.name}</span>
                      <span className="shrink-0 text-sm font-bold text-slate-800">{c.priorityScore}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
