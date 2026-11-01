/**
 * D-479 긴 목록은 처음 몇십 개만 그리고, 아래로 내려 끝에 가까워지면 이어서 그린다.
 * 업체 1,000곳이면 카드 1,000장을 한 번에 그리느라 화면이 2초 넘게 멈췄다 — 보이는 순서 · 모양은 그대로, 그리는 때만 나눈다.
 *
 *  const [count, more] = useGrowingCount(list.length, resetKey)
 *  list.slice(0, count).map(...)
 *  {count < list.length && <div ref={more}>…</div>}
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useGrowingCount(total: number, resetKey: unknown, step = 40): [number, (el: HTMLElement | null) => void] {
  const [count, setCount] = useState(step)
  const keyRef = useRef(resetKey)
  if (keyRef.current !== resetKey) {
    // 보기 · 정렬 · 찾기가 바뀌면 처음부터(렌더 중에 맞춰 두어 한 번 더 그리지 않게)
    keyRef.current = resetKey
    if (count !== step) setCount(step)
  }
  const obs = useRef<IntersectionObserver | null>(null)
  const more = useCallback(
    (el: HTMLElement | null) => {
      obs.current?.disconnect()
      obs.current = null
      if (!el) return
      if (typeof IntersectionObserver === 'undefined') {
        setCount(Number.MAX_SAFE_INTEGER)
        return
      }
      obs.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step)
        },
        { rootMargin: '1200px 0px' },
      )
      obs.current.observe(el)
    },
    // count 가 바뀔 때마다 다시 지켜본다 — 더 그린 뒤에도 끝이 아직 가까우면(처음 콜백이 바로 와서) 한 번 더
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, count],
  )
  useEffect(() => () => obs.current?.disconnect(), [])
  return [Math.min(count, total), more]
}
