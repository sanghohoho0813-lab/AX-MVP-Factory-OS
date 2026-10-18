/**
 * 유튜브 벤치마킹 — 화면 쪽 저장소 (D-193 · D-196 6시간 자동 갱신). 기업마당 공고 저장소(grantFeed)와 같은 방식.
 *
 *  - 서버 함수(/api/yt-bench)가 채널 33곳 · 영상 약 1,650편을 받아 온다(유튜브 키는 서버에만).
 *  - 받은 것은 이 브라우저에 { 받은 때(fetchedAt) · 채널 구성 판(feedRevision) · 데이터 } 로 둔다. 저장이 막혀도 이 창에서는 그대로 쓴다.
 *  - D-196 최대 6시간 — 화면을 처음 열 때 · 새로고침 · 다른 탭/앱에서 돌아올 때(focus · visible) 받은 지 6시간이 넘었으면
 *    누르지 않아도 새로 받는다. 시계를 돌려 계속 묻지는 않는다(setInterval 없음).
 *  - 채널 구성 판: 서버의 가벼운 ?status=1(유튜브를 부르지 않음 · 할당량 0)이 지금 판을 알려 준다. 저장해 둔 판과 다르면
 *    6시간이 안 됐어도 바로 새로 받는다(같은 날 18채널 → 33채널 같은 변경도 바로 · 예전 모양 저장본은 판을 모르므로 새로 받는다).
 *  - 저절로 받을 때는 6시간 칸(?win=) + 판(&rev=) — 같은 6시간 · 같은 판이면 서버 캐시가 답해 유튜브는 한 번만 부른다.
 *  - [지금 새로 가져오기] 는 6시간과 상관없이 — 30분 칸(?bucket=) 그대로(30분 안에 여러 번 눌러도 유튜브는 한 번).
 *  - 받지 못하면 지난번 것을 그대로 두고 '지난번 받은 데이터로 보여드리고 있습니다.' 와 받은 때를 적는다(빈 화면으로 만들지 않는다).
 *  - 키를 넣기 전에는 [예시로 보기] — 지어낸 채널 · 숫자(예시 데이터라고 크게 표시). 저장하지 않는다.
 *  - 추천 계산은 이 데이터와 레이더 설정만 쓴다 — 화면 폭(PC · 휴대폰)은 배치만 바꾼다.
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
  /** 지금 보이는 데이터의 채널 구성 판('' = 모름 · 예전 저장본) */
  feedRevision: string
}

/** 이 브라우저에 둔 것 */
export interface YtCache {
  /** 유튜브에서 받은 때(서버 시각 · ms) */
  fetchedAt: number
  feedRevision: string
  feed: YtFeed
}

const CACHE_KEY = 'axmvp.yt.feed.v1'
export const YT_PATH = '/api/yt-bench'
const BUCKET_MS = 30 * 60_000
/** 데이터를 쓰는 최대 시간 — 이만큼 지나면 저절로 새로 받는다(서버의 6시간 칸과 같은 값) */
export const FRESH_MS = 6 * 3_600_000
/** 채널 구성 판 확인은 10분에 한 번까지 — 탭을 오갈 때마다 묻지 않게 */
const STATUS_TTL_MS = 10 * 60_000
/** 저절로 받기가 실패하면(또는 받은 것도 6시간이 넘었으면) 5분은 다시 저절로 받지 않는다 — 돌아올 때마다 두드리지 않게 */
const RETRY_MS = 5 * 60_000

let clock: () => number = () => Date.now()

export const slotOf = (now = clock()) => new Date(now).toISOString().slice(0, 10)
export const bucketOf = (now = clock()) => Math.floor(now / BUCKET_MS)
/** 6시간 칸 — 세계 표준시 0 · 6 · 12 · 18시에 바뀐다(서버 windowOf 와 같은 식) */
export const windowOf = (now = clock()) => Math.floor(now / FRESH_MS)

const EMPTY: YtState = { status: 'idle', message: '', feed: null, sample: false, feedRevision: '' }
let state: YtState = EMPTY
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null
/** 서버가 알려 준 지금 채널 구성 판(null = 모름 — 그때는 6시간만 본다) */
let server: { rev: string | null; at: number } | null = null
let autoAfter = 0

function set(next: Partial<YtState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

const fetchedTime = (feed: YtFeed) => {
  const t = Date.parse(feed.fetchedAt)
  return Number.isFinite(t) ? t : 0
}

/** 한국 시간 '10월 14일 16:21' */
export const kstWhen = (t: number) => (Number.isFinite(t) && t > 0 ? new Date(t + 9 * 3_600_000).toISOString().slice(5, 16).replace('-', '월 ').replace('T', '일 ') : '알 수 없음')

/** 저장해 둔 것 — 예전 모양 { slot, feed } 도 읽는다(받은 때는 데이터 안의 fetchedAt · 판은 모름) */
export function readCache(): YtCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { fetchedAt?: unknown; feedRevision?: unknown; feed?: YtFeed }
    if (!v || !v.feed || !Array.isArray(v.feed.videos) || !Array.isArray(v.feed.channels)) return null
    return {
      fetchedAt: typeof v.fetchedAt === 'number' && Number.isFinite(v.fetchedAt) ? v.fetchedAt : fetchedTime(v.feed),
      feedRevision: typeof v.feedRevision === 'string' ? v.feedRevision : '',
      feed: v.feed,
    }
  } catch {
    return null
  }
}

function writeCache(c: YtCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    // 저장 공간이 모자라면 이 창에서만 쓴다 — 다음에 다시 받는다
  }
}

/**
 * 다시 받아야 하나 — 없음 · 받은 지 6시간 이상 · 서버의 채널 구성 판과 다름.
 * 서버 판을 모를 때(함수가 없는 곳 · 예전 서버)는 6시간만 본다.
 */
export function isStale(c: Pick<YtCache, 'fetchedAt' | 'feedRevision'> | null, serverRev: string | null, now = clock()): boolean {
  if (!c) return true
  if (now - c.fetchedAt >= FRESH_MS) return true
  return !!serverRev && c.feedRevision !== serverRev
}

const MESSAGE: Record<string, string> = {
  // D-236: 대표 화면에 'API 키 · 서버' 같은 말 대신 — 설정 방법은 아래 담당자용 3단계에
  no_key: '유튜브에서 숫자를 받아 오는 연결이 아직 설정되지 않았어요. 설정을 마치면 6시간마다 저절로 받아 와요.',
  quota: '오늘 유튜브 사용 한도를 다 썼습니다. 한도는 한국 시간 오후 4~5시에 다시 채워집니다.',
  bad_key: '유튜브 연결 설정이 맞지 않아 받지 못했어요 — 설정 담당자에게 확인을 부탁해 주세요(담당자용: 키가 틀렸거나 YouTube Data API v3 가 꺼져 있음).',
  timeout: '유튜브 응답이 늦어 이번에는 못 받았습니다. 잠시 뒤 다시 눌러 주세요.',
  upstream_empty: '유튜브에서 영상을 하나도 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
}

/** 지금 채널 구성 판 — ?status=1(유튜브를 부르지 않는 가벼운 확인) · 10분에 한 번까지 */
async function serverRevision(): Promise<string | null> {
  if (server && clock() - server.at < STATUS_TTL_MS) return server.rev
  let rev: string | null = null
  try {
    const r = await fetch(`${YT_PATH}?status=1`, { headers: { Accept: 'application/json' } })
    if ((r.headers.get('content-type') ?? '').includes('json')) {
      const b = (await r.json()) as { feedRevision?: unknown } | null
      if (b && typeof b.feedRevision === 'string' && b.feedRevision) rev = b.feedRevision
    }
  } catch {
    // 모르면 6시간만 본다
  }
  server = { rev, at: clock() }
  return rev
}

/** 지금 보이는 것(없으면 저장해 둔 것) */
function current(): YtCache | null {
  if (state.feed && !state.sample) return { fetchedAt: fetchedTime(state.feed), feedRevision: state.feedRevision, feed: state.feed }
  return readCache()
}

function show(c: YtCache) {
  set({ status: 'ready', message: '', feed: c.feed, sample: false, feedRevision: c.feedRevision })
}

/** 받지 못함 — 지난번 것이 있으면 그대로 두고 받은 때를 적는다(빈 화면으로 만들지 않는다) */
function fallback(old: YtCache | null, status: YtStatus, reason: string) {
  if (!old) return set({ status, message: reason })
  set({ status, message: `지난번 받은 데이터로 보여드리고 있습니다. 받은 때 ${kstWhen(old.fetchedAt)} — ${reason}`, feed: old.feed, sample: false, feedRevision: old.feedRevision })
}

/** 받기 — 저절로(6시간 칸) · [지금 새로](30분 칸). 판이 그사이 바뀌었으면(409) 서버가 알려 준 판으로 한 번만 다시 */
async function load(kind: 'auto' | 'manual', rev: string | null, old: YtCache | null, retried = false): Promise<void> {
  set({ status: 'loading', message: '' })
  const q = kind === 'manual' ? `bucket=${bucketOf()}` : `win=${windowOf()}`
  try {
    const r = await fetch(`${YT_PATH}?${q}${rev ? `&rev=${encodeURIComponent(rev)}` : ''}`, { headers: { Accept: 'application/json' } })
    const type = r.headers.get('content-type') ?? ''
    if (!type.includes('json')) {
      // 로컬 미리보기 · 함수가 없는 곳
      return fallback(old, 'unavailable', '유튜브 연결은 배포된 사이트에서 됩니다. 지금은 [예시로 보기] 로 화면을 볼 수 있어요.')
    }
    const body = (await r.json()) as Partial<YtFeed> & { error?: string; feedRevision?: unknown }
    if (r.status === 409 && body.error === 'revision' && typeof body.feedRevision === 'string' && body.feedRevision && !retried) {
      server = { rev: body.feedRevision, at: clock() }
      return load(kind, body.feedRevision, old, true)
    }
    if (!r.ok || !Array.isArray(body.videos) || !Array.isArray(body.channels)) {
      const code = body.error ?? ''
      return fallback(old, code === 'no_key' ? 'no_key' : code === 'quota' ? 'quota' : 'error', MESSAGE[code] ?? '유튜브에서 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    }
    const feed: YtFeed = { fetchedAt: body.fetchedAt ?? new Date(clock()).toISOString(), channels: body.channels, videos: body.videos, failed: body.failed ?? [], units: body.units }
    const c: YtCache = { fetchedAt: fetchedTime(feed), feedRevision: typeof body.feedRevision === 'string' ? body.feedRevision : (rev ?? ''), feed }
    writeCache(c)
    show(c)
  } catch {
    fallback(old, 'error', '인터넷 연결을 확인해 주세요.')
  }
}

/** 열 때 · 돌아올 때 — 6시간 · 채널 구성 판을 보고 필요할 때만 받는다 */
async function check(): Promise<void> {
  const c = current()
  // 6시간 안 · 판을 아는 저장본은 먼저 보여 준다(판 확인은 그다음 — 대개 그대로). 오래된 것 · 판을 모르는 것은 먼저 보이지 않는다
  if (!state.feed && c && c.feedRevision && !isStale(c, null)) show(c)
  const rev = await serverRevision()
  const now = clock()
  if (!isStale(c, rev, now)) {
    if (c && state.feed !== c.feed) show(c)
    return
  }
  if (now < autoAfter) {
    // 방금 저절로 받아 봤는데 안 됐다 — 있는 것으로(5분 뒤 다시)
    if (c && !state.feed) fallback(c, 'error', '잠시 뒤 다시 받아 봅니다.')
    return
  }
  await load('auto', rev, c)
  // 못 받았거나 받은 것도 오래됐으면 5분은 저절로 다시 받지 않는다(돌아올 때마다 두드리지 않게)
  if (state.status !== 'ready' || isStale(current(), rev)) autoAfter = clock() + RETRY_MS
}

/** 화면을 열 때 · 다른 탭/앱에서 돌아올 때 */
export function ensureYt(): Promise<void> {
  if (state.status === 'sample') return Promise.resolve()
  if (!inflight) {
    const run: Promise<void> = check().finally(() => {
      if (inflight === run) inflight = null
    })
    inflight = run
  }
  return inflight
}

let manual: Promise<void> | null = null

/**
 * [지금 새로 가져오기] — 6시간과 상관없이(30분 칸).
 * D-222 창으로 돌아온 순간의 저절로 확인(focus)이 도는 중에 눌러도 그 확인이 끝난 뒤 마저 받는다 —
 * 예전에는 그 확인을 그대로 돌려줘 '아직 6시간 안' 이면 아무것도 받지 않았다(돌지도 않고 새 데이터도 없음).
 */
export function refreshYt(): Promise<void> {
  if (manual) return manual
  const prev = inflight
  const run: Promise<void> = (async () => {
    if (prev) await prev.catch(() => undefined)
    await load('manual', await serverRevision(), current())
  })().finally(() => {
    if (manual === run) manual = null
    if (inflight === run) inflight = null
  })
  manual = run
  inflight = run
  return run
}

/** [예시로 보기] — 저장하지 않는다 */
export function showSample() {
  set({ status: 'sample', message: '', feed: sampleFeed(), sample: true, feedRevision: '' })
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
    // 화면을 하루 종일 열어 둘 때 — 다른 탭/앱에서 돌아오는 순간에만 다시 본다(시계로 계속 묻지 않는다)
    const back = () => {
      if (document.visibilityState !== 'hidden') void ensureYt()
    }
    window.addEventListener('focus', back)
    document.addEventListener('visibilitychange', back)
    return () => {
      window.removeEventListener('focus', back)
      document.removeEventListener('visibilitychange', back)
    }
  }, [])
  return { ...s, refresh: refreshYt, showSample }
}

/** 시험용 — 상태 · 서버 판 · 시계를 처음으로 */
export function resetYtForTest(now?: () => number) {
  state = EMPTY
  inflight = null
  manual = null
  server = null
  autoAfter = 0
  clock = now ?? (() => Date.now())
}
