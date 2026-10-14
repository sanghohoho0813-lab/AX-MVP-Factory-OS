/**
 * 유튜브 벤치마킹 — 화면 쪽 저장소 (D-193). 기업마당 공고 저장소(grantFeed)와 같은 방식.
 *
 *  - 서버 함수(/api/yt-bench)가 채널 33곳 · 영상 약 1,650편을 받아 온다(유튜브 키는 서버에만).
 *  - '오늘 9시 칸(slot)' 을 주소에 붙인다 → 한국 시간 오전 9시가 지나면 저절로 새로 받는다(하루 한 번).
 *  - [지금 새로 가져오기] 는 30분 칸(bucket) — 30분 안에 여러 번 눌러도 유튜브는 한 번만 부른다(할당량 지킴).
 *  - 한 번 받은 것은 이 브라우저에 둔다(같은 9시 칸이면 다시 안 부른다). 저장이 막혀도 이 창에서는 그대로 쓴다.
 *  - 키를 넣기 전에는 [예시로 보기] — 지어낸 채널 · 숫자(예시 데이터라고 크게 표시). 저장하지 않는다.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { YtFeed } from './ytBench'
import { sampleFeed } from './ytSample'

export type YtStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable' | 'no_key' | 'quota' | 'sample'

export interface YtState {
  status: YtStatus
  message: string
  feed: YtFeed | null
  /** 예시 데이터를 보고 있다 */
  sample: boolean
}

const CACHE_KEY = 'axmvp.yt.feed.v1'
export const YT_PATH = '/api/yt-bench'
const BUCKET_MS = 30 * 60_000

export const slotOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
export const bucketOf = (now = Date.now()) => Math.floor(now / BUCKET_MS)

let state: YtState = { status: 'idle', message: '', feed: null, sample: false }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null

function set(next: Partial<YtState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function readCache(): { slot: string; feed: YtFeed } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slot?: string; feed?: YtFeed }
    return v && typeof v.slot === 'string' && v.feed && Array.isArray(v.feed.videos) ? { slot: v.slot, feed: v.feed } : null
  } catch {
    return null
  }
}

function writeCache(slot: string, feed: YtFeed) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ slot, feed }))
  } catch {
    // 저장 공간이 모자라면 이 창에서만 쓴다 — 다음에 다시 받는다
  }
}

const MESSAGE: Record<string, string> = {
  no_key: '유튜브 API 키가 아직 서버에 없습니다. 키를 넣으면 매일 아침 9시에 저절로 받아 옵니다.',
  quota: '오늘 유튜브 사용 한도를 다 썼습니다. 한도는 한국 시간 오후 4~5시에 다시 채워집니다 — 지난번에 받은 것으로 보여 드립니다.',
  bad_key: '유튜브가 키를 받아 주지 않았습니다(키가 틀렸거나 YouTube Data API v3 가 켜져 있지 않음).',
  timeout: '유튜브 응답이 늦어 이번에는 못 받았습니다. 잠시 뒤 다시 눌러 주세요.',
  upstream_empty: '유튜브에서 영상을 하나도 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
}

async function load(fresh: boolean): Promise<void> {
  const slot = slotOf()
  if (!fresh) {
    const c = readCache()
    if (c && c.slot === slot && c.feed.videos.length) {
      set({ status: 'ready', message: '', feed: c.feed, sample: false })
      return
    }
  }
  set({ status: 'loading', message: '' })
  const keep = () => {
    const c = readCache()
    return c ? { feed: c.feed, sample: false } : {}
  }
  try {
    const r = await fetch(`${YT_PATH}?${fresh ? `bucket=${bucketOf()}` : `slot=${slot}`}`, { headers: { Accept: 'application/json' } })
    const type = r.headers.get('content-type') ?? ''
    if (!type.includes('json')) {
      // 로컬 미리보기 · 함수가 없는 곳
      set({ status: 'unavailable', message: '유튜브 연결은 배포된 사이트에서 됩니다. 지금은 [예시로 보기] 로 화면을 볼 수 있어요.', ...keep() })
      return
    }
    const body = (await r.json()) as Partial<YtFeed> & { error?: string; message?: string }
    if (!r.ok || !Array.isArray(body.videos) || !Array.isArray(body.channels)) {
      const code = body.error ?? ''
      set({
        status: code === 'no_key' ? 'no_key' : code === 'quota' ? 'quota' : 'error',
        message: MESSAGE[code] ?? '유튜브에서 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
        ...keep(),
      })
      return
    }
    const feed: YtFeed = { fetchedAt: body.fetchedAt ?? new Date().toISOString(), channels: body.channels, videos: body.videos, failed: body.failed ?? [], units: body.units }
    writeCache(slot, feed)
    set({ status: 'ready', message: '', feed, sample: false })
  } catch {
    set({ status: 'error', message: '인터넷 연결을 확인해 주세요 — 지난번에 받은 것으로 보여 드립니다.', ...keep() })
  }
}

/** 한 번만(같은 9시 칸이면 저장된 것) */
export function ensureYt(): Promise<void> {
  if (state.status === 'ready' && state.feed && slotOf() === slotOf(Date.parse(state.feed.fetchedAt) || Date.now())) return Promise.resolve()
  if (state.status === 'sample') return Promise.resolve()
  if (!inflight) inflight = load(false).finally(() => (inflight = null))
  return inflight
}

/** [지금 새로 가져오기] */
export function refreshYt(): Promise<void> {
  if (!inflight) inflight = load(true).finally(() => (inflight = null))
  return inflight
}

/** [예시로 보기] — 저장하지 않는다 */
export function showSample() {
  set({ status: 'sample', message: '', feed: sampleFeed(), sample: true })
}

export function ytSnapshot(): YtState {
  return state
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useYtFeed(): YtState & { refresh: () => Promise<void>; showSample: () => void } {
  const s = useSyncExternalStore(subscribe, ytSnapshot, ytSnapshot)
  useEffect(() => {
    void ensureYt()
  }, [])
  return { ...s, refresh: refreshYt, showSample }
}

/** 시험용 */
export function resetYtForTest() {
  state = { status: 'idle', message: '', feed: null, sample: false }
  inflight = null
}
