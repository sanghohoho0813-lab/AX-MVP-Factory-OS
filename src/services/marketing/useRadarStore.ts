/**
 * 콘텐츠 레이더 — 수첩 · 채널 설정 읽기/쓰기 훅 (D-194). 저장은 radarStore(moduleData) 그대로.
 * 대표가 팀장 화면을 보고 있을 때(useViewingPilot)는 쓰지 않는다 — 팀장 작업공간에 대표 아이디어가 섞이지 않게.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_PREFS, listIdeas, loadPrefs, removeIdea, saveIdea, savePrefs, type ContentIdea, type RadarPrefs } from './radarStore'

export function useRadarPrefs(workspaceId: string | null, readOnly: boolean) {
  const [prefs, setPrefs] = useState<RadarPrefs>(EMPTY_PREFS)
  const [loaded, setLoaded] = useState(false)
  // D-222 읽기에 실패했는지 — 예전에는 실패해도 빈 설정을 '다 읽음' 으로 두어, 무엇 하나 바꾸면 대표가 더한 채널 · 꺼 둔 채널 · 숨긴 주제가 빈 설정으로 덮였다
  const [failed, setFailed] = useState(false)
  const [tries, setTries] = useState(0)
  /** 마지막으로 읽었거나 저장된 설정 — 저장이 실패하면 여기로 되돌린다 */
  const confirmed = useRef<RadarPrefs>(EMPTY_PREFS)
  const ready = useRef(false)
  const seq = useRef(0)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    let alive = true
    setLoaded(false)
    ready.current = false
    loadPrefs(workspaceId)
      .then((p) => {
        if (!alive) return
        confirmed.current = p
        ready.current = true
        setPrefs(p)
        setFailed(false)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [workspaceId, tries])
  const reload = useCallback(() => setTries((n) => n + 1), [])
  // D-222 저장은 차례대로 · 화면은 마지막으로 누른 것 기준(먼저 누른 것의 응답이 늦게 와도 나중 것을 되돌리지 않게)
  const update = useCallback(
    (next: RadarPrefs): Promise<boolean> => {
      if (readOnly || !ready.current) return Promise.resolve(false)
      const my = ++seq.current
      setPrefs(next)
      const run = chain.current.then(async () => {
        try {
          const saved = await savePrefs(workspaceId, next)
          confirmed.current = saved
          if (my === seq.current) setPrefs(saved)
          return true
        } catch {
          if (my === seq.current) setPrefs(confirmed.current)
          return false
        }
      })
      chain.current = run
      return run
    },
    [readOnly, workspaceId],
  )
  return { prefs, loaded, failed, ready: loaded && !failed, reload, update }
}

export function useIdeas(workspaceId: string | null, readOnly: boolean) {
  const [ideas, setIdeasState] = useState<ContentIdea[]>([])
  const [loaded, setLoaded] = useState(false)
  // D-222 목록을 못 읽었으면 담기를 막는다(빈 목록으로 보고 이미 있는 주제를 또 담던 것)
  const [failed, setFailed] = useState(false)
  /** 화면을 다시 그리기 전에도 최신 목록 — 메모 저장 중에 단계를 바꿔도 새 메모 위에 합친다 */
  const ideasRef = useRef<ContentIdea[]>([])
  const saving = useRef(new Set<string>())
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const setIdeas = useCallback((fn: (xs: ContentIdea[]) => ContentIdea[]) => {
    ideasRef.current = fn(ideasRef.current)
    setIdeasState(ideasRef.current)
  }, [])
  const reload = useCallback(async () => {
    try {
      const list = await listIdeas(workspaceId)
      setIdeas(() => list)
      setFailed(false)
    } catch {
      setIdeas(() => [])
      setFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [workspaceId, setIdeas])
  useEffect(() => {
    setLoaded(false)
    void reload()
  }, [reload])
  const put = useCallback(
    (input: Parameters<typeof saveIdea>[1]) => {
      const run = chain.current.then(async () => {
        const saved = await saveIdea(workspaceId, input)
        setIdeas((xs) => [saved, ...xs.filter((x) => x.id !== saved.id)].sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
        return saved
      })
      chain.current = run.catch(() => null)
      return run
    },
    [workspaceId, setIdeas],
  )
  /** 새로 담기 · 통째로 저장. 같은 주제를 담는 중이면 null(두 번 눌러도 한 줄) */
  const save = useCallback(
    async (input: Parameters<typeof saveIdea>[1]): Promise<ContentIdea | null> => {
      if (readOnly) return null
      if (failed) throw new Error('수첩을 아직 읽지 못했습니다.')
      const key = `key:${input.key}`
      if (saving.current.has(key)) return null
      saving.current.add(key)
      try {
        // 그새 같은 주제가 담겼으면(앞 저장이 끝남) 새 줄 대신 그 줄로
        const same = !input.id ? ideasRef.current.find((i) => i.key === input.key) : undefined
        return await put(same ? { ...same, ...input, id: same.id, savedAt: same.savedAt } : input)
      } finally {
        saving.current.delete(key)
      }
    },
    [readOnly, failed, put],
  )
  /** 칸 몇 개만 바꾸기 — 그때의 최신 줄 위에 합친다(D-222: 메모를 적고 바로 단계를 바꾸면 옛 메모로 덮이던 것) */
  const patch = useCallback(
    async (id: string, fields: Partial<Pick<ContentIdea, 'status' | 'memo' | 'shootDate' | 'publishDate' | 'checks' | 'link' | 'topic'>>): Promise<ContentIdea | null> => {
      if (readOnly) return null
      const cur = ideasRef.current.find((i) => i.id === id)
      if (!cur) return null
      const next = { ...cur, ...fields }
      setIdeas((xs) => xs.map((x) => (x.id === id ? next : x)))
      try {
        return await put(next)
      } catch (e) {
        setIdeas((xs) => xs.map((x) => (x.id === id && x === next ? cur : x)))
        throw e
      }
    },
    [readOnly, put, setIdeas],
  )
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (readOnly) return false
      await removeIdea(workspaceId, id)
      setIdeas((xs) => xs.filter((x) => x.id !== id))
      return true
    },
    [readOnly, workspaceId, setIdeas],
  )
  return { ideas, loaded, failed, save, patch, remove, reload }
}
