/**
 * 콘텐츠 레이더 — 대표가 [채널 추가] 로 더한 채널 (D-194).
 *
 *  - 채널 확인: /api/yt-bench?resolve=@주소 (채널 정보 1~2단위 · 검색 100단위는 쓰지 않는다).
 *  - 더한 채널 영상: /api/yt-bench?extra=UC…,UC… (10곳까지 · 채널마다 2단위).
 *  - 둘 다 OS 에 로그인한 사람만 — 로그인 토큰을 붙여 보낸다(서버가 Supabase 에 물어 확인). 로컬 모드에서는 쓸 수 없다.
 *  - 받은 것은 이 브라우저에 그날 9시 칸 · 채널 묶음별로 둔다(사용자별 금고 axmvp.* 안) — 화면을 열 때마다 부르지 않는다.
 */
import { useEffect, useState } from 'react'
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import type { YtFeed } from './ytBench'
import { YT_PATH, slotOf } from './ytFeed'

const EXTRA_KEY = 'axmvp.yt.extra.v1'

export interface ResolvedChannel {
  id: string
  handle: string
  title: string
  thumb: string
  subs: number
  videoCount: number
  /** 이미 기본 목록에 있는 채널 */
  already: boolean
}

async function authHeader(): Promise<Record<string, string> | null> {
  if (getDataModeConfig().mode !== 'supabase') return null
  try {
    const { data } = await getSupabaseClient().auth.getSession()
    const t = data.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : null
  } catch {
    return null
  }
}

const RESOLVE_MESSAGE: Record<string, string> = {
  not_found: '그 주소의 채널을 찾지 못했습니다. 유튜브 채널 화면 주소(youtube.com/@…)를 그대로 붙여 넣어 주세요.',
  login_required: '로그인한 OS 에서만 채널을 확인할 수 있습니다.',
  no_auth_config: '서버에 로그인 확인 설정이 없어 지금은 채널을 더할 수 없습니다.',
  no_key: '유튜브 API 키가 서버에 없습니다.',
  quota: '오늘 유튜브 사용 한도를 다 썼습니다. 내일 다시 해 주세요.',
  bad_query: '채널 주소를 알아보지 못했습니다. youtube.com/@주소 꼴로 넣어 주세요.',
}

/** [채널 추가] — 넣은 주소를 채널로 확인 */
export async function resolveChannel(input: string): Promise<{ ok: true; channel: ResolvedChannel } | { ok: false; message: string }> {
  const text = input.trim()
  if (!text) return { ok: false, message: '채널 주소를 넣어 주세요.' }
  const auth = await authHeader()
  if (!auth) return { ok: false, message: '채널 추가는 로그인한 OS(배포된 사이트)에서 됩니다.' }
  try {
    const r = await fetch(`${YT_PATH}?resolve=${encodeURIComponent(text)}`, { headers: { Accept: 'application/json', ...auth } })
    if (!(r.headers.get('content-type') ?? '').includes('json')) return { ok: false, message: '유튜브 연결은 배포된 사이트에서 됩니다.' }
    const body = (await r.json()) as { channel?: ResolvedChannel; error?: string }
    if (r.ok && body.channel?.id) return { ok: true, channel: body.channel }
    return { ok: false, message: RESOLVE_MESSAGE[body.error ?? ''] ?? '채널을 확인하지 못했습니다. 잠시 뒤 다시 해 주세요.' }
  } catch {
    return { ok: false, message: '인터넷 연결을 확인해 주세요.' }
  }
}

export interface ExtraState {
  status: 'none' | 'loading' | 'ready' | 'error'
  message: string
  feed: YtFeed | null
}

function readCache(slot: string, ids: string): YtFeed | null {
  try {
    const raw = localStorage.getItem(EXTRA_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slot?: string; ids?: string; feed?: YtFeed }
    return v.slot === slot && v.ids === ids && v.feed && Array.isArray(v.feed.videos) ? v.feed : null
  } catch {
    return null
  }
}

function writeCache(slot: string, ids: string, feed: YtFeed) {
  try {
    localStorage.setItem(EXTRA_KEY, JSON.stringify({ slot, ids, feed }))
  } catch {
    // 저장 공간이 모자라면 이 창에서만
  }
}

/** 더한 채널의 영상 — 같은 9시 칸 · 같은 채널 묶음이면 저장된 것 */
export function useYtExtra(ids: readonly string[], refreshKey = 0): ExtraState {
  const key = [...ids].sort().join(',')
  const [state, setState] = useState<ExtraState>({ status: 'none', message: '', feed: null })
  useEffect(() => {
    let alive = true
    if (!key) {
      setState({ status: 'none', message: '', feed: null })
      return
    }
    const slot = slotOf()
    const cached = refreshKey === 0 ? readCache(slot, key) : null
    if (cached) {
      setState({ status: 'ready', message: '', feed: cached })
      return
    }
    setState((s) => ({ ...s, status: 'loading', message: '' }))
    void (async () => {
      const auth = await authHeader()
      if (!auth) {
        if (alive) setState({ status: 'error', message: '더한 채널은 로그인한 OS(배포된 사이트)에서 받아 옵니다.', feed: null })
        return
      }
      try {
        const r = await fetch(`${YT_PATH}?extra=${encodeURIComponent(key)}`, { headers: { Accept: 'application/json', ...auth } })
        const body = (await r.json().catch(() => ({}))) as Partial<YtFeed> & { error?: string }
        if (!alive) return
        if (!r.ok || !Array.isArray(body.videos) || !Array.isArray(body.channels)) {
          setState({ status: 'error', message: '더한 채널의 영상을 받지 못했습니다 — 기본 채널로만 계산했습니다.', feed: readCache(slot, key) })
          return
        }
        const feed: YtFeed = { fetchedAt: body.fetchedAt ?? new Date().toISOString(), channels: body.channels, videos: body.videos, failed: body.failed ?? [], units: body.units }
        writeCache(slot, key, feed)
        setState({ status: 'ready', message: '', feed })
      } catch {
        if (alive) setState({ status: 'error', message: '더한 채널의 영상을 받지 못했습니다 — 인터넷 연결을 확인해 주세요.', feed: null })
      }
    })()
    return () => {
      alive = false
    }
  }, [key, refreshKey])
  return state
}

/** 기본 feed + 더한 채널 feed → 하나(같은 채널 · 같은 영상은 한 번) */
export function mergeFeeds(base: YtFeed, extra: YtFeed | null, groups: Readonly<Record<string, string>>): YtFeed {
  if (!extra) return base
  const known = new Set(base.channels.map((c) => c.id))
  const seenVid = new Set(base.videos.map((v) => v.id))
  const channels = [...base.channels, ...extra.channels.filter((c) => !known.has(c.id)).map((c) => ({ ...c, group: groups[c.id] ?? c.group ?? 'ai' }))]
  const videos = [...base.videos, ...extra.videos.filter((v) => !seenVid.has(v.id) && !known.has(v.ch))]
  return { ...base, channels, videos, failed: [...base.failed, ...extra.failed] }
}
