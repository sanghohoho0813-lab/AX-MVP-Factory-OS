/**
 * D-273 스레드 · 릴스 · 틱톡 기록 — 화면 상태(목록 · 저장 · 숫자 고치기 · 지우기)를 한 모양으로.
 * 못 읽었으면 저장을 막는다(빈 목록으로 보고 같은 글을 또 만들거나 V 한 달 한 번 검사가 틀리지 않게 — D-222 와 같은 이유).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { listThreadPosts, loadWeekRef, removeThreadPost, saveThreadPost, saveWeekRef, sortThreadPosts, type ThreadInput, type ThreadPost, type WeekRef, type WeekRefItem } from './threads'
import { listShortPosts, removeShortPost, saveShortPost, sortShortPosts, type ShortInput, type ShortPost } from './shorts'

interface Api<T, I> {
  list: (ws: string | null) => Promise<T[]>
  save: (ws: string | null, input: I) => Promise<T>
  remove: (ws: string | null, id: string) => Promise<void>
  sort: (xs: readonly T[]) => T[]
}

function useSnsPosts<T extends { id: string; savedAt: string }, I extends { id?: string; savedAt?: string }>(workspaceId: string | null, readOnly: boolean, api: Api<T, I>) {
  const [posts, setPostsState] = useState<T[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const ref = useRef<T[]>([])
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const apiRef = useRef(api)
  const setPosts = useCallback((fn: (xs: T[]) => T[]) => {
    ref.current = apiRef.current.sort(fn(ref.current))
    setPostsState(ref.current)
  }, [])
  const reload = useCallback(async () => {
    try {
      const list = await apiRef.current.list(workspaceId)
      setPosts(() => list)
      setFailed(false)
    } catch {
      setPosts(() => [])
      setFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [workspaceId, setPosts])
  useEffect(() => {
    setLoaded(false)
    void reload()
  }, [reload])

  /** 저장은 차례대로(숫자를 빨리 여러 칸 고쳐도 마지막 것이 남게) */
  const save = useCallback(
    (input: I): Promise<T> => {
      if (readOnly) return Promise.reject(new Error('팀장 화면을 보는 중에는 저장하지 않습니다.'))
      if (failed) return Promise.reject(new Error('기록을 아직 읽지 못했습니다 — 위의 [다시 읽기] 를 누른 뒤 저장해 주세요.'))
      const run = chain.current.then(async () => {
        const prev = input.id ? ref.current.find((p) => p.id === input.id) : undefined
        const saved = await apiRef.current.save(workspaceId, (prev ? { ...prev, ...input, savedAt: prev.savedAt } : input) as I)
        setPosts((xs) => [saved, ...xs.filter((x) => x.id !== saved.id)])
        return saved
      })
      chain.current = run.catch(() => null)
      return run
    },
    [workspaceId, readOnly, failed, setPosts],
  )
  /** 칸 몇 개만 — 그때의 최신 줄 위에 합친다 */
  const patch = useCallback(
    (id: string, part: Partial<I>) => {
      const cur = ref.current.find((p) => p.id === id)
      if (!cur) return Promise.reject(new Error('글을 찾지 못했습니다.'))
      return save({ ...(cur as unknown as I), ...part, id })
    },
    [save],
  )
  const remove = useCallback(
    async (id: string) => {
      if (readOnly) throw new Error('팀장 화면을 보는 중에는 지우지 않습니다.')
      await apiRef.current.remove(workspaceId, id)
      setPosts((xs) => xs.filter((x) => x.id !== id))
    },
    [workspaceId, readOnly, setPosts],
  )
  return { posts, loaded, failed, reload, save, patch, remove }
}

const THREAD_API: Api<ThreadPost, ThreadInput> = { list: listThreadPosts, save: saveThreadPost, remove: removeThreadPost, sort: sortThreadPosts }
const SHORT_API: Api<ShortPost, ShortInput> = { list: listShortPosts, save: saveShortPost, remove: removeShortPost, sort: sortShortPosts }

export const useThreadPosts = (workspaceId: string | null, readOnly: boolean) => useSnsPosts(workspaceId, readOnly, THREAD_API)
export const useShortPosts = (workspaceId: string | null, readOnly: boolean) => useSnsPosts(workspaceId, readOnly, SHORT_API)

/** D-275 이번 주 잘 터진 형식 — 못 읽었으면 저장을 막는다(이번 주 것을 빈 것으로 덮지 않게) */
export function useWeekRef(workspaceId: string | null, readOnly: boolean) {
  const [ref, setRef] = useState<WeekRef | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const reload = useCallback(async () => {
    try {
      setRef(await loadWeekRef(workspaceId))
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [workspaceId])
  useEffect(() => {
    void reload()
  }, [reload])
  const save = useCallback(
    async (items: readonly WeekRefItem[]) => {
      if (readOnly) throw new Error('팀장 화면을 보는 중에는 저장하지 않습니다.')
      if (failed) throw new Error('이번 주 형식을 아직 읽지 못했습니다 — 새로고침한 뒤 저장해 주세요.')
      const saved = await saveWeekRef(workspaceId, items)
      setRef(saved)
      return saved
    },
    [workspaceId, readOnly, failed],
  )
  return { ref, loaded, failed, reload, save }
}
