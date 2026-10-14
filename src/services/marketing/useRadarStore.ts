/**
 * 콘텐츠 레이더 — 수첩 · 채널 설정 읽기/쓰기 훅 (D-194). 저장은 radarStore(moduleData) 그대로.
 * 대표가 팀장 화면을 보고 있을 때(useViewingPilot)는 쓰지 않는다 — 팀장 작업공간에 대표 아이디어가 섞이지 않게.
 */
import { useCallback, useEffect, useState } from 'react'
import { EMPTY_PREFS, listIdeas, loadPrefs, removeIdea, saveIdea, savePrefs, type ContentIdea, type RadarPrefs } from './radarStore'

export function useRadarPrefs(workspaceId: string | null, readOnly: boolean) {
  const [prefs, setPrefs] = useState<RadarPrefs>(EMPTY_PREFS)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    setLoaded(false)
    loadPrefs(workspaceId)
      .then((p) => {
        if (alive) setPrefs(p)
      })
      .catch(() => {
        if (alive) setPrefs(EMPTY_PREFS)
      })
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [workspaceId])
  const update = useCallback(
    async (next: RadarPrefs): Promise<boolean> => {
      if (readOnly) return false
      const before = prefs
      setPrefs(next)
      try {
        setPrefs(await savePrefs(workspaceId, next))
        return true
      } catch {
        setPrefs(before)
        return false
      }
    },
    [prefs, readOnly, workspaceId],
  )
  return { prefs, loaded, update }
}

export function useIdeas(workspaceId: string | null, readOnly: boolean) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    try {
      setIdeas(await listIdeas(workspaceId))
    } catch {
      setIdeas([])
    } finally {
      setLoaded(true)
    }
  }, [workspaceId])
  useEffect(() => {
    setLoaded(false)
    void reload()
  }, [reload])
  const save = useCallback(
    async (input: Parameters<typeof saveIdea>[1]): Promise<ContentIdea | null> => {
      if (readOnly) return null
      const saved = await saveIdea(workspaceId, input)
      setIdeas((xs) => [saved, ...xs.filter((x) => x.id !== saved.id)].sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
      return saved
    },
    [readOnly, workspaceId],
  )
  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (readOnly) return false
      await removeIdea(workspaceId, id)
      setIdeas((xs) => xs.filter((x) => x.id !== id))
      return true
    },
    [readOnly, workspaceId],
  )
  return { ideas, loaded, save, remove, reload }
}
