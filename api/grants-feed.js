/**
 * 기업마당 지원사업 공고 받아오기 (D-143) — Vercel 서버 함수.
 *
 *  - 인증키는 서버 환경변수에서만 읽는다(브라우저 · git · 번들에 넣지 않는다). 응답에 키를 싣지 않는다.
 *  - 한 번에 최대 1,000건. 화면에 필요한 칸만 다듬어 보낸다(개요는 400자).
 *  - 매일 아침 9시(한국 시간)까지 Vercel 캐시에 둔다 → 9시가 지나면 처음 여는 순간 새로 받아온다(매일 자동 갱신).
 *  - ?fresh=… 이면 캐시 없이 지금 바로 받아온다('지금 새로 가져오기').
 *  - ?status=1 이면 키가 있는지만 알려 준다(키 값은 절대 안 보낸다).
 *  - 다른 파일을 불러오지 않는다(서버 함수 하나로 끝나게). 공고 글 읽기 · 매칭은 화면 쪽 규칙(grantText · grantMatch)이 한다.
 */

const KEY_NAMES = ['BIZINFO_API_KEY', 'BIZINFO_KEY', 'BIZINFO_CRTFC_KEY', 'BIZINFO_API', 'BIZINFO_SERVICE_KEY', 'VITE_BIZINFO_API_KEY', 'VITE_BIZINFO_KEY']
const ENDPOINT = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do'
const MAX = 1000

function keyFromEnv() {
  for (const name of KEY_NAMES) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim()) return { name, value: v.trim() }
  }
  return null
}

/** 다음 한국 시간 오전 9시까지 남은 초(최소 60초) */
function secondsUntilNine(now = Date.now()) {
  const kst = new Date(now + 9 * 3600_000)
  const next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 9, 0, 0) - 9 * 3600_000
  const target = next > now ? next : next + 86_400_000
  return Math.max(60, Math.round((target - now) / 1000))
}

const strip = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

function itemsOf(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.jsonArray)) return data.jsonArray
  if (data && data.response && Array.isArray(data.response.items)) return data.response.items
  if (data && data.response && data.response.body && Array.isArray(data.response.body.items)) return data.response.body.items
  return []
}

function slim(it) {
  const pick = (k, max) => strip(it?.[k]).slice(0, max)
  return {
    pblancId: pick('pblancId', 40),
    pblancNm: pick('pblancNm', 200),
    jrsdInsttNm: pick('jrsdInsttNm', 80),
    excInsttNm: pick('excInsttNm', 80),
    reqstBeginEndDe: pick('reqstBeginEndDe', 80),
    pldirSportRealmLclasCodeNm: pick('pldirSportRealmLclasCodeNm', 30),
    trgetNm: pick('trgetNm', 300),
    bsnsSumryCn: pick('bsnsSumryCn', 400),
    pblancUrl: pick('pblancUrl', 300),
    hashtags: pick('hashtags', 300),
    creatPnttm: pick('creatPnttm', 30),
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const key = keyFromEnv()

  if (url.searchParams.get('status')) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ configured: !!key, keyName: key ? key.name : null, region: process.env.VERCEL_REGION || null })
    return
  }
  if (!key) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'no_key', message: '기업마당 인증키가 서버 환경변수에 없습니다(BIZINFO_API_KEY).' })
    return
  }

  const fresh = url.searchParams.has('fresh')
  const q = new URLSearchParams({ crtfcKey: key.value, dataType: 'json', searchCnt: String(MAX) })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const r = await fetch(`${ENDPOINT}?${q.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'MIRAE-AI-LAB-OS/1.0' } })
    const text = await r.text()
    if (!r.ok) {
      res.setHeader('Cache-Control', 'no-store')
      res.status(502).json({ error: 'upstream_status', status: r.status })
      return
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      res.setHeader('Cache-Control', 'no-store')
      // 키가 틀리면 기업마당이 JSON 이 아닌 글을 돌려준다 — 글 앞부분만(키는 들어 있지 않다)
      res.status(502).json({ error: 'upstream_not_json', sample: strip(text).slice(0, 120) })
      return
    }
    const items = itemsOf(data).slice(0, MAX).map(slim).filter((x) => x.pblancNm)
    res.setHeader('Cache-Control', fresh ? 'no-store' : `public, max-age=0, s-maxage=${secondsUntilNine()}, stale-while-revalidate=300`)
    res.status(200).json({ fetchedAt: new Date().toISOString(), count: items.length, items })
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(504).json({ error: e && e.name === 'AbortError' ? 'timeout' : 'fetch_failed' })
  } finally {
    clearTimeout(timer)
  }
}
