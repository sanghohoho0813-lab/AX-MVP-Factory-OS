/**
 * 적던 글 — 탭을 바꾸거나 다른 화면에 다녀와도 이 브라우저 탭 안에서는 남는다 (D-125)
 *
 * 미팅 메모(D-120)와 같은 방식: sessionStorage 라 이 탭 안에서만 산다(다른 사람 · 다른 기기로 가지 않는다).
 * 저장이 되면 clear() 로 지운다. 저장 공간이 없어도 화면은 평소처럼 돈다.
 */
import { useCallback, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function useSessionDraft<T>(key: string, fallback: T): [T, (next: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  // 다른 업체로 바뀌면(열쇠가 바뀌면) 그 업체의 적던 글로
  const [seenKey, setSeenKey] = useState(key)
  if (seenKey !== key) {
    setSeenKey(key)
    setValue(read(key, fallback))
  }
  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        const empty = next === '' || next === null || (Array.isArray(next) && next.length === 0)
        if (empty) sessionStorage.removeItem(key)
        else sessionStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* 저장 공간이 없어도 화면은 돈다 */
      }
    },
    [key],
  )
  const clear = useCallback(() => {
    setValue(fallback)
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* 무시 */
    }
    // fallback 은 부르는 쪽의 고정 값(빈 글 등)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return [value, set, clear]
}

/**
 * 여러 칸짜리 적던 것(회사 사정 · 제안 고르던 상품) — 저장된 값과 다를 때만 남긴다.
 * set 은 값 또는 (앞 값 → 새 값) 함수를 받는다. 저장된 값과 같아지면 남긴 것을 지운다.
 */
export function useDraftState<T>(key: string, saved: T): [T, (u: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => read<T | null>(key, null) ?? saved)
  const write = (v: T | null) => {
    try {
      if (v === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* 무시 */
    }
  }
  const set = (u: T | ((prev: T) => T)) =>
    setValue((prev) => {
      const v = typeof u === 'function' ? (u as (p: T) => T)(prev) : u
      write(JSON.stringify(v) === JSON.stringify(saved) ? null : v)
      return v
    })
  const reset = () => {
    write(null)
    setValue(saved)
  }
  return [value, set, reset]
}
