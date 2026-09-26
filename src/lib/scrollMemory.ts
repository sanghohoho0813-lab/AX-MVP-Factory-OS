/**
 * 뒤로 오면 보던 자리로 (D-124)
 *
 * 예전에는 화면이 바뀔 때마다 무조건 맨 위로 올렸다 — 긴 목록(영업 보드 · 고객 관리)에서 업체를 열었다가
 * 뒤로 오면 다시 맨 위부터 찾아 내려가야 했다.
 *
 * 이제는
 *   - 새로 들어간 화면(PUSH)은 예전처럼 맨 위에서 시작한다(같은 화면 안에서 탭 · 업체만 바꾸면 그대로)
 *   - 뒤로 · 앞으로(POP)는 그 칸에서 보던 자리로 돌아간다. 목록을 다 불러와 길이가 생길 때까지 잠깐(최대 2초) 기다리고,
 *     그 사이에 사람이 먼저 화면을 만지면 그만둔다.
 * 자리는 이 탭(sessionStorage)에만 둔다 — 창을 닫으면 잊는다.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const KEY = 'axmvp.ui.scroll_memory'
const LIMIT = 80

function readAll(): Record<string, number> {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as unknown
    return v && typeof v === 'object' ? (v as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function remember(key: string, y: number): void {
  try {
    const all = readAll()
    delete all[key]
    all[key] = Math.round(y)
    const keys = Object.keys(all)
    for (const k of keys.slice(0, Math.max(0, keys.length - LIMIT))) delete all[k]
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* 저장 공간이 없으면 자리 기억만 못 한다 */
  }
}

export function useScrollMemory(onRouteChange?: () => void): void {
  const location = useLocation()
  const navType = useNavigationType()
  const keyRef = useRef(location.key)
  const pathRef = useRef(location.pathname)
  const changeRef = useRef(onRouteChange)
  useEffect(() => {
    changeRef.current = onRouteChange
  })

  // 브라우저가 스스로 자리를 되돌리면 우리 것과 엇갈린다
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // 지금 칸에서 보던 자리를 계속 적어 둔다(한 프레임에 한 번)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        remember(keyRef.current, window.scrollY)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useLayoutEffect(() => {
    const samePath = pathRef.current === location.pathname
    keyRef.current = location.key
    pathRef.current = location.pathname
    if (!samePath) changeRef.current?.()

    if (navType !== 'POP') {
      if (!samePath) window.scrollTo(0, 0)
      // 같은 화면에서 탭 · 검색어 · 업체만 바꾼 것은 새 칸 이름으로 지금 자리를 적어 둔다(안 움직여도 돌아올 자리가 있게)
      else remember(location.key, window.scrollY)
      return
    }
    const y = readAll()[location.key]
    if (y === undefined) {
      if (!samePath) window.scrollTo(0, 0)
      return
    }
    // 목록을 다 불러와 그만큼 길어질 때까지 기다렸다가 돌아간다
    let stop = false
    const cancel = () => {
      stop = true
    }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    for (const e of events) window.addEventListener(e, cancel, { passive: true, once: true })
    const started = performance.now()
    let raf = 0
    const tick = () => {
      if (stop) return
      const room = document.documentElement.scrollHeight - window.innerHeight
      if (room >= y - 2 || performance.now() - started > 2000) {
        window.scrollTo(0, Math.min(y, Math.max(0, room)))
        return
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      stop = true
      if (raf) cancelAnimationFrame(raf)
      for (const e of events) window.removeEventListener(e, cancel)
    }
  }, [location.key, location.pathname, navType])
}
