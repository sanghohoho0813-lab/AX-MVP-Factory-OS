/**
 * 피드백 읽기 (D-188) — 사이드바 단추 · 종 · 두 화면이 같은 것을 본다.
 *
 *  - 대표: 팀장 작업공간마다(my_pilot_views) 피드백을 모은다 → 받은 피드백함 · 안 읽은 수.
 *  - 팀장: 내 작업공간의 피드백 → 이번 회차를 보냈나 · 대표님 읽음.
 * 같은 순간의 요청은 하나로 합치고, 보낼 때 · 읽을 때(FEEDBACK_CHANGED) · 창으로 돌아올 때 다시 센다.
 */

import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../../auth/authContext'
import { getDataModeConfig } from '../../data/dataMode'
import { FEEDBACK_CHANGED, listFeedback, type FeedbackEntry } from '../../services/feedbackSurvey'

export interface InboxEntry extends FeedbackEntry {
  /** 보낸 사람(팀장 화면 이름) */
  person: string
}

const REFRESH_GAP_MS = 20_000
const cache = new Map<string, { at: number; value: unknown; inflight: Promise<unknown> | null }>()

async function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit?.inflight) return hit.inflight as Promise<T>
  if (hit && !force && Date.now() - hit.at < REFRESH_GAP_MS) return hit.value as T
  const inflight = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value, inflight: null })
      return value
    })
    .catch((err) => {
      cache.delete(key)
      throw err
    })
  cache.set(key, { at: hit?.at ?? 0, value: hit?.value, inflight })
  return inflight
}

/** 보냄 · 읽음 · 창으로 돌아옴 — 다시 센다 */
function useFeedbackTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(FEEDBACK_CHANGED, bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])
  return tick
}

/** 대표의 받은 피드백함 — 팀장 화면 보기 중이거나 팀장 계정이면 비어 있다 */
export function useFeedbackInbox(): { entries: InboxEntry[] | null; unread: number; error: string } {
  const auth = useContext(AuthContext)
  const cloud = getDataModeConfig().mode === 'supabase'
  const owner = cloud && auth?.access === 'full'
  const viewing = owner && !!auth?.pilotViews.some((v) => v.workspaceId === auth.currentWorkspaceId)
  const views = owner && !viewing ? auth?.pilotViews ?? [] : []
  const key = views.map((v) => v.workspaceId).join(',')
  const tick = useFeedbackTick()
  const [entries, setEntries] = useState<InboxEntry[] | null>(owner && !viewing ? null : [])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!key) {
      setEntries([])
      return
    }
    let alive = true
    void cached(`inbox:${key}`, tick > 0, async () => {
      const lists = await Promise.all(
        views.map(async (v) => (await listFeedback(v.workspaceId)).map((e) => ({ ...e, person: [v.personName, v.personTitle].filter(Boolean).join(' ') || e.author.name }))),
      )
      return lists.flat().sort((a, b) => b.at.localeCompare(a.at))
    })
      .then((list) => {
        if (!alive) return
        setEntries(list)
        setError('')
      })
      .catch(() => {
        if (alive) setError('피드백을 불러오지 못했습니다.')
      })
    return () => {
      alive = false
    }
    // views 는 key 로 대신한다(같은 작업공간 목록이면 다시 읽지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])

  return { entries, unread: (entries ?? []).filter((e) => !e.readAt).length, error }
}

/** 팀장이 보낸 피드백 — 내 작업공간 것 */
export function useMyFeedback(workspaceId: string | null): FeedbackEntry[] | null {
  const tick = useFeedbackTick()
  const [list, setList] = useState<FeedbackEntry[] | null>(null)
  useEffect(() => {
    if (!workspaceId) {
      setList([])
      return
    }
    let alive = true
    void cached(`mine:${workspaceId}`, tick > 0, () => listFeedback(workspaceId))
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [workspaceId, tick])
  return list
}
