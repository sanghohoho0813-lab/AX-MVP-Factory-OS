import { useCallback, useRef } from 'react'

/**
 * 한 기록을 차례대로 저장한다 (D-120).
 *
 * 칸마다 바로 저장하는 화면에서, 응답이 늦게 온 예전 저장이 새로 고친 값을 덮던 문제를 막는다.
 *  - 같은 id 를 저장하는 중에 또 고치면, 끝난 뒤 '가장 새 값' 으로 한 번 더 저장한다(가운데 값은 건너뛴다).
 *  - 늦게 온 예전 응답은 onSaved 로 넘기지 않는다 — 화면에는 늘 가장 새 값이 남는다.
 * 돌려주는 함수는 저장이 됐으면 true, 실패하면 false(onError 가 먼저 불린다).
 */
export function useSerialSave<T extends { id: string }>(
  save: (record: T) => Promise<T>,
  onSaved: (saved: T) => void,
  onError: (cause: unknown) => void,
): (next: T) => Promise<boolean> {
  const latest = useRef(new Map<string, T>())
  const busy = useRef(new Set<string>())
  const cb = useRef({ save, onSaved, onError })
  cb.current = { save, onSaved, onError }

  return useCallback(async (next: T): Promise<boolean> => {
    latest.current.set(next.id, next)
    if (busy.current.has(next.id)) return true
    busy.current.add(next.id)
    try {
      for (;;) {
        const target = latest.current.get(next.id)
        if (!target) return true
        const saved = await cb.current.save(target)
        if (latest.current.get(next.id) === target) {
          latest.current.delete(next.id)
          cb.current.onSaved(saved)
          return true
        }
      }
    } catch (cause) {
      latest.current.delete(next.id)
      cb.current.onError(cause)
      return false
    } finally {
      busy.current.delete(next.id)
    }
  }, [])
}
