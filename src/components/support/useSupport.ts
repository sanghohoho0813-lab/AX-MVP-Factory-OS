/**
 * D-568 문의 · 화면 오류 읽기 — 단추 · 점 · 두 화면이 같은 것을 본다.
 *
 *  - 보낸 사람(팀장 · 고객): 문의 창구가 열려 있나 · 내가 보낸 것 · 답장이 왔나(문의를 보낸 적이 있을 때만 살핀다).
 *  - 운영자(대표): 받은 문의 · 오류와 안 읽은 수 — 팀장 화면을 보는 동안에는 비운다.
 * 같은 순간의 요청은 하나로 합치고, 보낼 때 · 읽을 때(SUPPORT_CHANGED) · 창으로 돌아올 때 다시 센다.
 */
import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../../auth/authContext'
import { getDataModeConfig } from '../../data/dataMode'
import { useCustomerAudience } from '../../config/customerAudience'
import { SUPPORT_CHANGED, hasSentSupport, inboxUnread, listMySupport, listSupportInbox, supportState, unseenReplies, type InboxMessage, type SupportMessage, type SupportState } from '../../services/support'

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

function useSupportTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    window.addEventListener(SUPPORT_CHANGED, bump)
    window.addEventListener('focus', bump)
    return () => {
      window.removeEventListener(SUPPORT_CHANGED, bump)
      window.removeEventListener('focus', bump)
    }
  }, [])
  return tick
}

/** 문의 창구가 열려 있나 — 아직 모르면 null. enabled 가 꺼져 있으면 묻지 않는다(요청 0). */
export function useSupportState(enabled = true): SupportState | null {
  const auth = useContext(AuthContext)
  const cloud = getDataModeConfig().mode === 'supabase' && !!auth?.session
  const on = enabled && cloud
  const [state, setState] = useState<SupportState | null>(on ? null : 'missing')
  useEffect(() => {
    if (!on) {
      setState('missing')
      return
    }
    let alive = true
    void supportState().then((s) => alive && setState(s))
    return () => {
      alive = false
    }
  }, [on])
  return state
}

/** 내가 보낸 문의 · 오류 */
export function useMySupport(enabled: boolean): { list: SupportMessage[] | null; error: string } {
  const auth = useContext(AuthContext)
  const uid = auth?.session?.user.id ?? ''
  const tick = useSupportTick()
  const [list, setList] = useState<SupportMessage[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled || !uid) {
      setList(enabled ? null : [])
      return
    }
    let alive = true
    void cached(`mine:${uid}`, tick > 0, () => listMySupport(uid))
      .then((l) => {
        if (!alive) return
        setList(l)
        setError('')
      })
      .catch(() => {
        if (!alive) return
        setList((prev) => prev ?? [])
        setError('보낸 문의를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.')
      })
    return () => {
      alive = false
    }
  }, [enabled, uid, tick])
  return { list, error }
}

/**
 * 답장이 왔는데 아직 안 본 문의 수.
 *  - 구독 고객: 늘 살핀다(PC 에서 보내고 휴대폰에서 열어도 '답장' 이 보이게 — 고객 계정은 0024 · 0025 뒤에만 있다).
 *  - 내부 팀장: 이 브라우저에서 문의를 보낸 적이 있을 때만(안 쓴 사람에게는 요청 0).
 */
export function useSupportReplies(): number {
  const auth = useContext(AuthContext)
  const cloud = getDataModeConfig().mode === 'supabase' && !!auth?.session
  const tick = useSupportTick()
  const customer = useCustomerAudience()
  const sent = cloud && auth?.access === 'pilot' && (customer || hasSentSupport())
  const state = useSupportState(sent)
  const { list } = useMySupport(sent && state === 'ready')
  // tick 은 보낸 직후(hasSentSupport 가 켜진 뒤) 다시 그리게 한다
  void tick
  return sent && state === 'ready' ? unseenReplies(list ?? []).length : 0
}

/** 운영자(대표)의 받은 문의 · 오류 — 운영자가 아니면 서버가 빈 목록을 준다 */
export function useSupportInbox(): { entries: InboxMessage[] | null; unread: number; ready: boolean; error: string } {
  const auth = useContext(AuthContext)
  const cloud = getDataModeConfig().mode === 'supabase' && !!auth?.session
  const owner = cloud && auth?.access === 'full'
  const viewing = owner && !!auth?.pilotViews.some((v) => v.workspaceId === auth.currentWorkspaceId)
  const on = owner && !viewing
  const state = useSupportState(on)
  const ready = on && state === 'ready'
  const uid = auth?.session?.user.id ?? ''
  const tick = useSupportTick()
  const [entries, setEntries] = useState<InboxMessage[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!ready) {
      setEntries(state === null && on ? null : [])
      return
    }
    let alive = true
    void cached(`inbox:${uid}`, tick > 0, listSupportInbox)
      .then((l) => {
        if (!alive) return
        setEntries(l)
        setError('')
      })
      .catch(() => {
        if (!alive) return
        setEntries((prev) => prev ?? [])
        setError('받은 문의를 불러오지 못했습니다.')
      })
    return () => {
      alive = false
    }
  }, [ready, state, on, uid, tick])
  return { entries, unread: inboxUnread(entries ?? []), ready, error }
}
