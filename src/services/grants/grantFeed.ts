/**
 * 기업마당 공고 — 화면 쪽 공유 저장소 (D-143).
 *
 *  - 서버 함수(/api/grants-feed)가 기업마당에서 최대 1,000건을 받아 온다(인증키는 서버에만).
 *  - '오늘 9시 칸(slot)' 을 주소에 붙인다 → 한국 시간 오전 9시가 지나면 주소가 바뀌어 저절로 새로 받는다(매일 자동 갱신).
 *  - [지금 새로 가져오기] 는 캐시 없이 바로 받는다.
 *  - 한 번 받은 것은 이 브라우저에 두고(9시 칸이 같으면 다시 안 부른다), 화면 여러 곳(알림 · 오늘 · 업체 상세 · 고객 목록 · 보드)이 같이 쓴다.
 *    화면마다 따로 부르지 않는다 — 1,000건을 화면 수만큼 받는 병목이 없게.
 *  - 직접 넣은 공고(모듈 기록)와 합칠 때 같은 공고(이름 · 마감이 같음)는 직접 넣은 쪽을 남긴다.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { GrantNotice } from './grantMatch'
import { parseBizinfoJson } from './grantText'

export interface FeedRaw {
  pblancId: string
  pblancNm: string
  [k: string]: string
}

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable' | 'no_key'

export interface FeedState {
  status: FeedStatus
  /** 기업마당에서 받은 때(ISO) */
  fetchedAt: string
  count: number
  message: string
  notices: GrantNotice[]
}

const CACHE_KEY = 'axmvp.grants.feed.v1'
export const FEED_PATH = '/api/grants-feed'

/** 가장 최근 한국 시간 오전 9시의 날짜 — 9시 전이면 어제 날짜 */
export function slotOf(now = Date.now()): string {
  // 한국 시간 오전 9시 = 세계 표준시 0시 — 그래서 세계 표준시 날짜가 곧 '9시 칸' 이다
  return new Date(now).toISOString().slice(0, 10)
}

/** 다음 자동 갱신 시각(한국 시간 오전 9시) — 화면 안내용 */
export function nextRefreshText(now = Date.now()): string {
  const kstHour = new Date(now + 9 * 3600_000).getUTCHours()
  return kstHour < 9 ? '오늘 아침 9시' : '내일 아침 9시'
}

/** 서버가 준 칸 → 공고. id 는 기업마당 공고 번호로 고정(보낸 기록이 날마다 이어지게) */
export function noticesFromFeed(items: readonly FeedRaw[], fetchedAt: string): GrantNotice[] {
  const { drafts } = parseBizinfoJson(JSON.stringify({ jsonArray: items }))
  return drafts.map((d, i) => ({
    ...d,
    id: `biz_${d.externalId || `n${i}`}`,
    published: true,
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
  }))
}

/** 기업마당에서 매일 받아 오는 공고(고치기 · 지우기 대상 아님) */
export function isFeedNotice(n: Pick<GrantNotice, 'id'>): boolean {
  return n.id.startsWith('biz_')
}

/** 직접 넣은 공고 + 기업마당 — 같은 공고면 직접 넣은 것을 남긴다 */
export function mergeNotices(manual: readonly GrantNotice[], feed: readonly GrantNotice[]): GrantNotice[] {
  const key = (n: Pick<GrantNotice, 'title' | 'applyEnd'>) => `${n.title.replace(/\s+/g, '').replace(/[[\]()·,.]/g, '')}|${n.applyEnd}`
  const have = new Set(manual.map(key))
  return [...manual, ...feed.filter((n) => !have.has(key(n)))]
}

/* ------------------------------------------------------------------ */
/* 공유 저장소                                                            */
/* ------------------------------------------------------------------ */

let state: FeedState = { status: 'idle', fetchedAt: '', count: 0, message: '', notices: [] }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null

function set(next: Partial<FeedState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

function readCache(): { slot: string; fetchedAt: string; items: FeedRaw[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slot?: string; fetchedAt?: string; items?: FeedRaw[] }
    return v && typeof v.slot === 'string' && Array.isArray(v.items) ? { slot: v.slot, fetchedAt: v.fetchedAt ?? '', items: v.items } : null
  } catch {
    return null
  }
}

function writeCache(slot: string, fetchedAt: string, items: FeedRaw[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ slot, fetchedAt, items }))
  } catch {
    // 저장 공간이 모자라면 이 창에서만 쓴다 — 다음에 다시 받는다
  }
}

async function load(fresh: boolean): Promise<void> {
  const slot = slotOf()
  if (!fresh) {
    const c = readCache()
    if (c && c.slot === slot && c.items.length) {
      set({ status: 'ready', fetchedAt: c.fetchedAt, count: c.items.length, message: '', notices: noticesFromFeed(c.items, c.fetchedAt) })
      return
    }
  }
  set({ status: 'loading', message: '' })
  try {
    const r = await fetch(`${FEED_PATH}?${fresh ? `fresh=${Date.now()}` : `slot=${slot}`}`, { headers: { Accept: 'application/json' } })
    const type = r.headers.get('content-type') ?? ''
    if (!type.includes('json')) {
      // 로컬 미리보기 · 함수가 없는 곳 — 화면은 직접 넣은 공고로 그대로 돈다
      const c = readCache()
      set({ status: 'unavailable', message: '기업마당 연결은 배포된 사이트에서 됩니다.', ...(c ? { fetchedAt: c.fetchedAt, count: c.items.length, notices: noticesFromFeed(c.items, c.fetchedAt) } : {}) })
      return
    }
    const body = (await r.json()) as { items?: FeedRaw[]; fetchedAt?: string; error?: string; message?: string; status?: number; sample?: string }
    if (!r.ok || !Array.isArray(body.items)) {
      const c = readCache()
      const msg =
        body.error === 'no_key'
          ? '기업마당 인증키가 서버에 없습니다 — Vercel 환경변수 BIZINFO_API_KEY 에 넣어 주세요.'
          : body.error === 'upstream_not_json'
            ? `기업마당이 공고 대신 안내 글을 보냈습니다(인증키 확인 필요): ${body.sample ?? ''}`
            : body.error === 'timeout'
              ? '기업마당 응답이 늦어 이번에는 못 받았습니다. 잠시 뒤 다시 눌러 주세요.'
              : '기업마당에서 공고를 받지 못했습니다.'
      set({ status: body.error === 'no_key' ? 'no_key' : 'error', message: msg, ...(c ? { fetchedAt: c.fetchedAt, count: c.items.length, notices: noticesFromFeed(c.items, c.fetchedAt) } : {}) })
      return
    }
    const fetchedAt = body.fetchedAt ?? new Date().toISOString()
    writeCache(slot, fetchedAt, body.items)
    set({ status: 'ready', fetchedAt, count: body.items.length, message: '', notices: noticesFromFeed(body.items, fetchedAt) })
  } catch {
    const c = readCache()
    set({ status: 'error', message: '인터넷 연결을 확인해 주세요 — 지난번에 받은 공고로 보여 드립니다.', ...(c ? { fetchedAt: c.fetchedAt, count: c.items.length, notices: noticesFromFeed(c.items, c.fetchedAt) } : {}) })
  }
}

/** 한 번만(같은 9시 칸이면 저장된 것) — 여러 화면이 동시에 불러도 요청은 하나 */
export function ensureFeed(): Promise<void> {
  if (state.status === 'ready' && state.fetchedAt && slotOf() === slotOf(Date.parse(state.fetchedAt) || Date.now())) return Promise.resolve()
  if (!inflight) inflight = load(false).finally(() => (inflight = null))
  return inflight
}

/** [지금 새로 가져오기] */
export function refreshFeed(): Promise<void> {
  if (!inflight) inflight = load(true).finally(() => (inflight = null))
  return inflight
}

export function feedSnapshot(): FeedState {
  return state
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 화면에서 — 처음 쓸 때 한 번 불러 온다 */
export function useGrantFeed(): FeedState & { refresh: () => Promise<void> } {
  const s = useSyncExternalStore(subscribe, feedSnapshot, feedSnapshot)
  useEffect(() => {
    void ensureFeed()
  }, [])
  return { ...s, refresh: refreshFeed }
}

/** 시험용 — 저장소 비우기 */
export function resetFeedForTest() {
  state = { status: 'idle', fetchedAt: '', count: 0, message: '', notices: [] }
  inflight = null
}
