/**
 * D-479 긴 목록 — 처음 step 개만 그리고, 아래로 내려 끝에 가까워지면 이어서(useGrowingCount).
 * 보이는 순서 · 모양은 그대로 — 그리는 때만 나눈다. 남은 수는 '아래로 내리면 n곳 더 보여요'.
 */
import type { ReactNode } from 'react'
import { useGrowingCount } from '../../lib/useGrowingCount'

export function GrowingList<T>({
  items,
  render,
  className,
  resetKey,
  step = 30,
  unit = '곳',
  testId,
}: {
  items: readonly T[]
  render: (item: T, index: number) => ReactNode
  className?: string
  /** 바뀌면 처음 step 개부터 다시 */
  resetKey?: unknown
  step?: number
  unit?: string
  /** ul 의 data-testid */
  testId?: string
}) {
  const [count, more] = useGrowingCount(items.length, resetKey, step)
  return (
    <>
      <ul className={className} data-testid={testId}>
        {items.slice(0, count).map(render)}
      </ul>
      {count < items.length && (
        <div ref={more} className="t-meta py-2 text-center text-slate-500" data-testid="list-more" aria-live="polite">
          아래로 내리면 {items.length - count}
          {unit} 더 보여요
        </div>
      )}
    </>
  )
}
