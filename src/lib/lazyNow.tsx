/**
 * D-647 쓸 때 받는 부품 — 이미 받아 둔 것은 바로 그린다.
 * React.lazy + Suspense 는 받아 둔 조각이어도 처음 한 번은 멈췄다가(fallback) 0.3초 뒤에 그린다(React 의 깜빡임 막기 대기).
 * 누르면 열리는 창(찾기 · 새 업체 등록의 서류 칸)은 그 0.3초가 그대로 느리게 보여서, 미리 받아 둔 경우에는 멈추지 않고 그리게 한다.
 * 아직 못 받았으면 fallback 을 보여 주고 받는 대로 다시 그린다. preload() 는 한가할 때 · 단추에 마우스를 올릴 때 부른다.
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'

export function lazyNow<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Comp: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  const preload = (): Promise<ComponentType<P>> => {
    if (Comp) return Promise.resolve(Comp)
    if (!pending) {
      pending = load().then((c) => {
        Comp = c
        return c
      })
      // 못 받으면 다음에 다시
      pending.catch(() => {
        pending = null
      })
    }
    return pending
  }
  function LazyNow({ fallback = null, ...props }: P & { fallback?: ReactNode }) {
    const [, setTick] = useState(0)
    useEffect(() => {
      if (Comp) return
      let alive = true
      preload()
        .then(() => {
          if (alive) setTick((t) => t + 1)
        })
        .catch(() => {})
      return () => {
        alive = false
      }
    }, [])
    const Ready = Comp
    return Ready ? <Ready {...(props as P)} /> : <>{fallback}</>
  }
  return { Component: LazyNow, preload }
}
