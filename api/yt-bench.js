/**
 * 유튜브 벤치마킹 데이터 받아오기 (D-193) — Vercel 서버 함수.
 *
 * 대표가 예전에 만든 '김팀장 벤치마킹 대시보드'(Streamlit) 의 수집 부분(youtube_api.py)을 옮긴 것.
 *  - 유튜브 키는 서버 환경변수에서만 읽는다(브라우저 · git · 번들에 넣지 않는다). 응답에 키를 싣지 않는다.
 *  - 정해 둔 채널 20곳(내 채널 1 + 벤치마킹 19)의 정보 + 채널마다 최근 영상 50편.
 *  - 쓰는 할당량: 한 번에 약 60단위(하루 무료 10,000단위의 0.6%) — 예전 앱보다 채널 정보를 한 번에 묶어 부른다.
 *  - 매일 아침 9시(한국 시간)까지 Vercel 캐시에 둔다(?slot=오늘) → 9시가 지나면 처음 여는 순간 새로 받는다.
 *  - [지금 새로 가져오기] 는 ?bucket=30분 칸 — 같은 30분 안에서는 몇 번을 눌러도 한 번만 유튜브를 부른다
 *    (아무나 주소를 두드려 하루 할당량을 다 쓰지 못하게). 정해 둔 칸 · 값 말고는 받지 않는다(400).
 *  - ?status=1 이면 키가 있는지만 알려 준다(키 값은 절대 안 보낸다).
 *  - 채널 하나가 실패해도 나머지는 보낸다 — 실패한 채널 이름을 같이 보낸다(예전 앱은 조용히 빠졌다).
 *  - 다른 파일을 불러오지 않는다(서버 함수 하나로 끝나게). 키워드 · 주제 추천 · 분석은 화면 쪽 규칙(ytBench)이 한다.
 */

// VITE_ 이름은 받지 않는다 — VITE_ 로 넣은 값은 화면 번들에 들어갈 수 있다(키는 서버 이름으로만)
const KEY_NAMES = ['YOUTUBE_API_KEY', 'YOUTUBE_KEY', 'YT_API_KEY', 'YOUTUBE_DATA_API_KEY']
const API = 'https://www.googleapis.com/youtube/v3'
const PER_CHANNEL = 50
const BUCKET_MS = 30 * 60_000
const POOL = 6

/** 내 채널 1 + 벤치마킹 19 — 예전 앱 그대로(youtube_api.py CHANNELS) */
export const CHANNELS = [
  { handle: '@김팀장의경영노트', mine: true },
  { id: 'UCnnqB7SaH8o-NHLonSFfE3A' },
  { handle: '@소상공인도우미' },
  { handle: '@onetop-1' },
  { handle: '@엘아이파트너스여팀장' },
  { handle: '@giupinfo' },
  { handle: '@jeongel' },
  { handle: '@kstartuptv' },
  { handle: '@richceo' },
  { handle: '@businesshelperJo' },
  { handle: '@bogopatv' },
  { handle: '@money_recipe' },
  { handle: '@사장님성장솔루션' },
  { handle: '@사장노트' },
  { handle: '@슬기로운정책지원' },
  { handle: '@rodemtax' },
  { handle: '@nicetax' },
  { handle: '@세금전문회계사김희연' },
  { handle: '@dowssem' },
  { handle: '@세무사' },
]

function keyFromEnv() {
  for (const name of KEY_NAMES) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim()) return { name, value: v.trim() }
  }
  return null
}

/** 다음 한국 시간 오전 9시까지 남은 초(최소 60초) */
export function secondsUntilNine(now = Date.now()) {
  const kst = new Date(now + 9 * 3600_000)
  const next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 9, 0, 0) - 9 * 3600_000
  const target = next > now ? next : next + 86_400_000
  return Math.max(60, Math.round((target - now) / 1000))
}

/** 가장 최근 한국 시간 오전 9시의 날짜 칸(= 세계 표준시 날짜) */
export const slotOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
export const bucketOf = (now = Date.now()) => Math.floor(now / BUCKET_MS)

/** 주소의 칸이 받을 만한지 — 지금 칸이나 바로 앞 칸만(시계가 조금 어긋나도 되게) */
export function checkQuery(searchParams, now = Date.now()) {
  const keys = [...searchParams.keys()]
  const allowed = new Set(['status', 'slot', 'bucket'])
  if (keys.some((k) => !allowed.has(k)) || keys.length > 1) return { ok: false }
  if (searchParams.has('status')) return { ok: true, kind: 'status' }
  if (searchParams.has('bucket')) {
    const b = Number(searchParams.get('bucket'))
    const cur = bucketOf(now)
    return Number.isInteger(b) && (b === cur || b === cur - 1) ? { ok: true, kind: 'fresh' } : { ok: false }
  }
  if (searchParams.has('slot')) {
    const s = searchParams.get('slot')
    return s === slotOf(now) || s === slotOf(now - 86_400_000) ? { ok: true, kind: 'daily' } : { ok: false }
  }
  return { ok: true, kind: 'daily' }
}

/** 'PT1H2M3S' → 3723 */
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso ?? ''))
  if (!m) return 0
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

class QuotaError extends Error {}
class KeyError extends Error {}

/** 동시에 n개씩 */
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  const run = async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run))
  return out
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const q = checkQuery(url.searchParams)
  const key = keyFromEnv()

  if (!q.ok) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(400).json({ error: 'bad_query' })
    return
  }
  if (q.kind === 'status') {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ configured: !!key, keyName: key ? key.name : null, channels: CHANNELS.length })
    return
  }
  if (!key) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'no_key', message: '유튜브 API 키가 서버 환경변수에 없습니다(YOUTUBE_API_KEY).' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  let units = 0
  const call = async (path, params) => {
    units += 1
    const qs = new URLSearchParams({ ...params, key: key.value })
    const r = await fetch(`${API}/${path}?${qs.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    let body = null
    try {
      body = await r.json()
    } catch {
      body = null
    }
    if (!r.ok) {
      const reason = String(body?.error?.errors?.[0]?.reason ?? '')
      const message = String(body?.error?.message ?? '')
      if (/quotaExceeded|dailyLimitExceeded|rateLimitExceeded/i.test(reason)) throw new QuotaError(reason)
      // 키 자체가 틀렸거나 막힌 것만 전체 실패 — 채널 하나의 '없음 · 비공개' 는 그 채널만 실패
      if (/keyInvalid|keyExpired|accessNotConfigured|ipRefererBlocked/i.test(reason) || /API key/i.test(message)) throw new KeyError(reason || String(r.status))
      throw new Error(`status_${r.status}`)
    }
    return body ?? {}
  }

  try {
    // 1) 핸들 → 채널 번호(핸들이 없으면 예전 사용자 이름으로 한 번 더)
    const failed = []
    const ids = await pool(CHANNELS, POOL, async (ch) => {
      if (ch.id) return ch.id
      try {
        const a = await call('channels', { part: 'id', forHandle: ch.handle })
        if (a.items?.[0]?.id) return a.items[0].id
        const b = await call('channels', { part: 'id', forUsername: ch.handle.replace(/^@/, '') })
        if (b.items?.[0]?.id) return b.items[0].id
      } catch (e) {
        if (e instanceof QuotaError || e instanceof KeyError) throw e
      }
      failed.push(ch.handle)
      return null
    })
    const known = ids.filter(Boolean)
    if (known.length === 0) throw new Error('no_channels')

    // 2) 채널 정보 — 한 번에(최대 50곳)
    const info = await call('channels', { part: 'snippet,statistics,contentDetails', id: known.join(','), maxResults: '50' })
    const byId = new Map((info.items ?? []).map((it) => [it.id, it]))
    const channels = []
    const uploads = []
    CHANNELS.forEach((ch, i) => {
      const id = ids[i]
      const it = id ? byId.get(id) : null
      if (!it) {
        if (id) failed.push(ch.handle ?? id)
        return
      }
      const sn = it.snippet ?? {}
      const st = it.statistics ?? {}
      channels.push({
        id,
        handle: ch.handle ?? sn.customUrl ?? '',
        title: String(sn.title ?? '').slice(0, 80),
        customUrl: String(sn.customUrl ?? '').slice(0, 80),
        thumb: String(sn.thumbnails?.default?.url ?? '').slice(0, 300),
        subs: num(st.subscriberCount),
        videoCount: num(st.videoCount),
        views: num(st.viewCount),
        mine: !!ch.mine,
      })
      const up = it.contentDetails?.relatedPlaylists?.uploads
      if (up) uploads.push({ id, up, label: ch.handle ?? id })
    })

    // 3) 채널마다 최근 영상 50편 → 4) 영상 정보 한 번에
    const lists = await pool(uploads, POOL, async (u) => {
      try {
        const p = await call('playlistItems', { part: 'contentDetails', playlistId: u.up, maxResults: String(PER_CHANNEL) })
        const vids = (p.items ?? []).map((x) => x.contentDetails?.videoId).filter(Boolean).slice(0, PER_CHANNEL)
        if (vids.length === 0) return []
        const v = await call('videos', { part: 'snippet,statistics,contentDetails', id: vids.join(','), maxResults: '50' })
        return (v.items ?? []).map((it) => ({
          id: String(it.id ?? ''),
          ch: u.id,
          t: String(it.snippet?.title ?? '').slice(0, 200),
          at: String(it.snippet?.publishedAt ?? ''),
          d: parseDuration(it.contentDetails?.duration),
          v: num(it.statistics?.viewCount),
          l: num(it.statistics?.likeCount),
          c: num(it.statistics?.commentCount),
        }))
      } catch (e) {
        if (e instanceof QuotaError || e instanceof KeyError) throw e
        failed.push(u.label)
        return []
      }
    })
    const videos = lists.flat().filter((x) => x.id && x.at)

    if (videos.length === 0) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(502).json({ error: 'upstream_empty', failed })
      return
    }
    // 절반 넘게 실패하면 캐시하지 않는다(덜 받은 것이 하루 종일 보이지 않게)
    const degraded = failed.length > CHANNELS.length / 2
    res.setHeader(
      'Cache-Control',
      degraded ? 'no-store' : q.kind === 'fresh' ? `public, max-age=0, s-maxage=${BUCKET_MS / 1000}` : `public, max-age=0, s-maxage=${secondsUntilNine()}, stale-while-revalidate=300`,
    )
    res.status(200).json({ fetchedAt: new Date().toISOString(), channels, videos, failed, units })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    if (e instanceof QuotaError) res.status(429).json({ error: 'quota' })
    else if (e instanceof KeyError) res.status(502).json({ error: 'bad_key' })
    else res.status(504).json({ error: e && e.name === 'AbortError' ? 'timeout' : 'fetch_failed' })
  } finally {
    clearTimeout(timer)
  }
}
