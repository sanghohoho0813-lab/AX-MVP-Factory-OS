/**
 * 유튜브 벤치마킹 계산 (D-193) — 대표가 예전에 만든 '김팀장 벤치마킹 대시보드'(Streamlit app.py)의 분석을 옮긴 것.
 *
 * 규칙 계산이다('AI' 아님 · 외부 호출 없음). 받아 온 영상 · 채널(서버 함수 /api/yt-bench)로만 계산한다.
 *  - 기간: 이번 주(7일) · 이번 달(30일) · 올해(365일) · 쇼츠(90일 · 쇼츠만)
 *  - 키워드: 제목의 한글 3자 이상 단어 · 이어진 두 단어(조회수 × 1.3) — 조회수로 점수, 2편 이상 · 2채널 이상만, 상위 15
 *  - 주목 주제: 두 단어 묶음 먼저(2편 · 2채널 이상) → 한 단어(3편 · 2채널 이상), 최대 4개 · 제목 아이디어 3개씩(틀)
 *  - 급상승: 14일 안에 올린 영상이 그 기간 평균 조회수의 2배 이상
 *  - 심층 분석: 내 채널 vs 벤치마킹 평균 · 요일 · 시간대(한국 시간) · 롱폼/쇼츠 · 길이 구간 · 업로드 주기
 * 예전 앱과 다르게 고친 것(같이 적어 둔다):
 *  - 어미 거르기에 '놓치면 · 받으면 · 있다면 · 신청하기 · 끝내기' 꼴을 더했다(키워드에 '놓치면' 이 올라왔다).
 *  - 길이 구간: 쇼츠 기준(3분 이하)과 '쇼츠(1분 이하)' 이름이 달랐다 → '1분 이하 · 1~3분(쇼츠)' 로 나눴다.
 *  - 주목 주제의 평균 조회수: 한 제목에 같은 단어가 두 번 나오면 그 영상을 두 번 셌다 → 영상마다 한 번.
 * AI 롱폼 대본 만들기는 옮기지 않았다(LLM 호출 0 규칙).
 */
import { josa } from '../../lib/josa'

/* ------------------------------------------------------------------ */
/* 받은 모양                                                              */
/* ------------------------------------------------------------------ */

export interface YtChannel {
  id: string
  handle: string
  title: string
  customUrl: string
  thumb: string
  subs: number
  videoCount: number
  views: number
  mine: boolean
}

/** 서버가 보내는 영상 한 편(칸 이름을 줄였다 — 1,000편을 보내므로) */
export interface YtVideoRaw {
  id: string
  /** 채널 번호 */
  ch: string
  /** 제목 */
  t: string
  /** 올린 때(ISO) */
  at: string
  /** 길이(초) */
  d: number
  /** 조회수 · 좋아요 · 댓글 */
  v: number
  l: number
  c: number
}

export interface YtFeed {
  fetchedAt: string
  channels: YtChannel[]
  videos: YtVideoRaw[]
  /** 이번에 못 받은 채널 */
  failed: string[]
  /** 쓴 할당량 */
  units?: number
}

/** 예전 앱의 '내 채널' — 서버가 mine 을 못 붙여 보냈을 때 이름으로 찾는다 */
export const MY_CHANNEL_HANDLE = '김팀장의경영노트'
/** 쇼츠 = 3분 이하(유튜브 쇼츠 최대 길이) */
export const SHORT_MAX_SEC = 180

/* ------------------------------------------------------------------ */
/* 계산용 모양                                                            */
/* ------------------------------------------------------------------ */

export interface YtVideo {
  id: string
  channelId: string
  channelName: string
  title: string
  publishedAt: number
  /** 올린 지 며칠(내림) */
  daysAgo: number
  durationSec: number
  isShort: boolean
  views: number
  likes: number
  comments: number
  /** 좋아요 ÷ 조회수 × 100(소수 한 자리) */
  likeRate: number
  mine: boolean
  /** 0 = 월요일 … 6 = 일요일(한국 시간) */
  weekday: number
  /** 0~23(한국 시간) */
  hour: number
  bucket: LengthBucket
  url: string
  thumb: string
}

export type LengthBucket = '1분 이하' | '1~3분(쇼츠)' | '3~5분' | '5~15분' | '15~30분' | '30분 이상'
export const LENGTH_BUCKETS: readonly LengthBucket[] = ['1분 이하', '1~3분(쇼츠)', '3~5분', '5~15분', '15~30분', '30분 이상']

export function lengthBucket(sec: number): LengthBucket {
  if (sec <= 60) return '1분 이하'
  if (sec <= SHORT_MAX_SEC) return '1~3분(쇼츠)'
  if (sec <= 300) return '3~5분'
  if (sec <= 900) return '5~15분'
  if (sec <= 1800) return '15~30분'
  return '30분 이상'
}

export interface Prepared {
  videos: YtVideo[]
  channels: YtChannel[]
  myChannelId: string
  /** 채널 이름에서 뽑은 4자 이상 한글 단어 — 키워드에서 뺀다(채널명 파편) */
  channelWords: Set<string>
}

const DAY = 86_400_000
const KST = 9 * 3_600_000

function myChannelOf(channels: readonly YtChannel[]): string {
  const flagged = channels.find((c) => c.mine)
  if (flagged) return flagged.id
  const h = MY_CHANNEL_HANDLE.toLowerCase()
  const byName = channels.find((c) => c.customUrl.replace(/^@/, '').toLowerCase() === h || c.handle.replace(/^@/, '').toLowerCase() === h || c.title.toLowerCase().includes(h))
  return byName?.id ?? ''
}

/** 받은 것 → 계산용(기간 · 요일 · 시간 · 쇼츠 · 길이 구간 · 내 채널) */
export function prepareFeed(feed: Pick<YtFeed, 'channels' | 'videos'>, now: number = Date.now()): Prepared {
  const channels = feed.channels ?? []
  const myChannelId = myChannelOf(channels)
  const names = new Map(channels.map((c) => [c.id, c.title]))
  const channelWords = new Set<string>()
  for (const c of channels) for (const w of c.title.match(/[가-힣]{4,}/g) ?? []) channelWords.add(w)
  const videos: YtVideo[] = []
  for (const r of feed.videos ?? []) {
    const t = Date.parse(r.at)
    if (!r.id || !Number.isFinite(t)) continue
    const k = new Date(t + KST)
    const views = Math.max(0, Math.round(r.v || 0))
    const likes = Math.max(0, Math.round(r.l || 0))
    videos.push({
      id: r.id,
      channelId: r.ch,
      channelName: names.get(r.ch) ?? '알 수 없음',
      title: r.t ?? '',
      publishedAt: t,
      daysAgo: Math.floor((now - t) / DAY),
      durationSec: Math.max(0, Math.round(r.d || 0)),
      isShort: (r.d || 0) <= SHORT_MAX_SEC,
      views,
      likes,
      comments: Math.max(0, Math.round(r.c || 0)),
      likeRate: views > 0 ? Math.round((likes / views) * 1000) / 10 : 0,
      mine: !!myChannelId && r.ch === myChannelId,
      weekday: (k.getUTCDay() + 6) % 7,
      hour: k.getUTCHours(),
      bucket: lengthBucket(r.d || 0),
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(r.id)}`,
      thumb: `https://i.ytimg.com/vi/${encodeURIComponent(r.id)}/mqdefault.jpg`,
    })
  }
  return { videos, channels, myChannelId, channelWords }
}

/* ------------------------------------------------------------------ */
/* 거르기 · 기간                                                          */
/* ------------------------------------------------------------------ */

export type YtPeriod = 'week' | 'month' | 'year' | 'shorts'
export const PERIOD_LABEL: Record<YtPeriod, string> = { week: '이번 주', month: '이번 달', year: '올해', shorts: '쇼츠' }
export const PERIOD_HINT: Record<YtPeriod, string> = {
  week: '최근 7일 안에 올린 영상',
  month: '최근 30일 안에 올린 영상',
  year: '최근 365일 안에 올린 영상(채널마다 최근 50편까지만 받는다)',
  shorts: '최근 90일 안에 올린 쇼츠(3분 이하)',
}

export type YtType = 'all' | 'long' | 'short'

export interface YtFilter {
  type: YtType
  /** 고른 채널 번호(비면 전체) */
  channels: readonly string[]
}

export const NO_FILTER: YtFilter = { type: 'all', channels: [] }

/** 기간 + 거르기 — 쇼츠 칸은 '롱폼/쇼츠' 거르기를 쓰지 않는다(예전 앱 그대로) */
export function periodVideos(videos: readonly YtVideo[], period: YtPeriod, filter: YtFilter = NO_FILTER): YtVideo[] {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : 90
  return videos.filter((v) => {
    if (v.daysAgo > days) return false
    if (period === 'shorts') {
      if (!v.isShort) return false
    } else if (filter.type === 'long' && v.isShort) return false
    else if (filter.type === 'short' && !v.isShort) return false
    if (filter.channels.length > 0 && !filter.channels.includes(v.channelId)) return false
    return true
  })
}

/* ------------------------------------------------------------------ */
/* 키워드 · 주목 주제                                                      */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set(
  [
    // 조사/어미
    '이', '그', '저', '것', '수', '등', '및', '에', '를', '을', '가', '의', '은', '는', '로', '으로',
    '에서', '와', '과', '도', '만', '하는', '하기', '있는', '없는', '합니다', '입니다', '됩니다',
    '대한', '위한', '통해', '위해', '하면', '하고', '이번', '지금', '바로', '정말', '드디어',
    '속보', '중요', '긴급', '총정리', '요약', '정리', '방법', '이유', '결과', '확인', '신청',
    '까지', '부터', '동안', '이후', '이전', '최대', '최소', '모든', '각종', '관련', '내용',
    '사람', '경우', '우리', '여기', '어디', '무엇', '얼마', '어떻게', '하지', '않는', '없이',
    '있어', '했다', '된다', '한다', '않고', '되고', '이런', '그런', '저런', '어떤',
    '누가', '뭔가', '아직', '이미', '같은', '다른', '라는', '라고', '에도', '에서는', '으로는',
    // 화폐단위
    '만원', '억원', '천원', '백원', '십만', '억대', '만대', '원짜리',
    // 접속사/부사 파편
    '그렇다면', '이라면', '따라서', '그래서', '하지만', '그러나', '그런데', '그래도', '이처럼',
    // 행정 단어
    '대상자', '신청자', '수혜자', '수령자', '신청하세요', '확인하세요', '보세요', '아세요',
    // 동사/명령형 파편
    '꺼두', '켜두', '쉬세요', '십시오', '겠습니까', '드립니다', '합니다만', '봅니다',
    '알려드림', '알려드린', '정리드림', '설명드림', '말씀드림', '안내드림',
    // 시간
    '올해', '내년', '작년', '지난해', '이번달', '지난달', '다음달', '요즘', '최근',
    // 너무 일반적인 단어
    '정보', '공지', '발표', '안내', '시행', '개정', '최신', '공개', '단독', '핵심', '완벽',
    '비밀번호', '아이디', '이메일',
    // 유튜브 제목 관용구
    '알아보자', '살펴보자', '해봅시다', '총망라', '세금신고', '서류제출',
    // 금액 단위
    '천만원', '천만', '수수료', '수수료율',
    // 행정 복합어
    '신청방법', '신청날짜', '신청기간', '신청서류',
    // 동사 원형 파편
    '줍니다', '나왔습니다', '됐습니다', '했습니다',
    // 대표가 지목한 단어 — 너무 일반적이거나 채널명 파생
    '때문에', '연매출', '사장님', '지자체', '생활문화', '위험한',
    '회계사', '절세미녀', '하이닉스', '컨설턴트',
    // 지시·강조 부사
    '이렇게', '그렇게', '저렇게', '이러한', '그러한', '이러면', '그러면',
    '무조건', '결국엔', '솔직히', '정직하게',
  ],
)

/**
 * 동사/형용사 어미로 끝나는 단어(보시고 · 신청해야 · 있을까 …) — 예전 앱 그대로.
 * D-193 더함: 놓치면 · 받으면 · 있다면 · 안되면 · 알아보면 · 신청하기 · 끝내기(조건 · '-기' 꼴은 주제가 아니다)
 */
const VERB_ENDINGS =
  /(드림|드린|드릴|드렸|시고|세요|십시오|해야|이면|라면|는지|은지|을까|없을|합니다|됩니다|니까|아세요|이야기|하면서|이므로|보면서|했더니|됐더니|한다면|이라며|라며|려면|려고|더라도|더라면|했는데|됐는데|대해서|니다|지는|이는|으로|아요|어요|는데|은데|ㄴ다면|나요|리는|오는|하면|드는|르면|한다|된다|치면|으면|다면|되면|보면|하기|내기|는|한|은)$/

export function isMeaningful(word: string, channelWords: ReadonlySet<string> = new Set()): boolean {
  return !STOP_WORDS.has(word) && !VERB_ENDINGS.test(word) && !channelWords.has(word)
}

/** 제목 → 쓸 만한 단어(한글 3자 이상) */
export function titleWords(title: string, channelWords: ReadonlySet<string> = new Set()): string[] {
  return (title.match(/[가-힣]{3,}/g) ?? []).filter((w) => isMeaningful(w, channelWords))
}

interface Tally {
  score: number
  videos: number
  channels: Set<string>
  /** 이 말이 든 영상(한 번씩) */
  hits: YtVideo[]
}

/** 단어 · 이어진 두 단어마다 점수(조회수, 두 단어는 × 1.3) — 처음 나온 순서를 지킨다(점수가 같으면 먼저 나온 것) */
function tally(videos: readonly YtVideo[], channelWords: ReadonlySet<string>): Map<string, Tally> {
  const map = new Map<string, Tally>()
  const add = (key: string, score: number, v: YtVideo, seen: Set<string>) => {
    let t = map.get(key)
    if (!t) {
      t = { score: 0, videos: 0, channels: new Set(), hits: [] }
      map.set(key, t)
    }
    t.score += score
    if (!seen.has(key)) {
      seen.add(key)
      t.videos += 1
      t.channels.add(v.channelName)
      t.hits.push(v)
    }
  }
  for (const v of videos) {
    const views = Math.max(v.views, 1)
    const words = titleWords(v.title, channelWords)
    const seen = new Set<string>()
    for (const w of words) add(w, views, v, seen)
    for (let i = 0; i < words.length - 1; i += 1) add(`${words[i]} ${words[i + 1]}`, Math.floor(views * 1.3), v, seen)
  }
  return map
}

const ranked = (map: Map<string, Tally>) => [...map.entries()].sort((a, b) => b[1].score - a[1].score)

export interface Keyword {
  word: string
  /** 이 말이 든 영상 수 */
  videos: number
  channels: number
  score: number
}

/** 인기 핵심 키워드 — 2편 이상 · 2채널 이상, 점수 순 상위 max */
export function extractKeywords(videos: readonly YtVideo[], channelWords: ReadonlySet<string>, max = 15): Keyword[] {
  return ranked(tally(videos, channelWords))
    .filter(([, t]) => t.videos >= 2 && t.channels.size >= 2)
    .slice(0, max)
    .map(([word, t]) => ({ word, videos: t.videos, channels: t.channels.size, score: t.score }))
}

/** 키워드를 고르면 그 말이 든 영상만 — 두 단어면 둘 다 든 것 */
export function matchesKeyword(title: string, keyword: string): boolean {
  if (!keyword) return true
  const parts = keyword.split(' ').filter(Boolean)
  return parts.every((p) => title.includes(p))
}

/** 제목 아이디어 틀 — 예전 앱 그대로(순위마다 다른 묶음) */
const COPY_TEMPLATE_SETS: ReadonlyArray<ReadonlyArray<(kw: string) => string>> = [
  [(k) => `${k} 완벽 정리 | 소상공인이 절대 놓치면 안 되는 핵심`, (k) => `지금 당장 확인! ${k} — 이것만 알면 됩니다`, (k) => `${k}, 사장님 유형별 대처법 총정리`],
  [(k) => `모르면 손해! ${k} 한 번에 정리해드립니다`, (k) => `${k} 신청 전에 이것 먼저 보세요`, (k) => `사장님들 주목! ${k} A to Z 완벽 가이드`],
  [(k) => `${k}, 지금 바로 확인하세요 | 실전 핵심 정리`, (k) => `${josa(k, '으로/로')} 달라지는 것들 | 핵심만 짚어드립니다`, (k) => `꼭 알아야 할 ${k} | 놓치면 진짜 손해`],
  [(k) => `${k} 완전 정복 | 처음부터 끝까지`, (k) => `${k} 제대로 활용하는 법 | 실전 가이드`, (k) => `${k} 핵심 포인트 3가지 | 사장님들 보세요`],
]

export function titleIdeas(keyword: string, rank: number): string[] {
  return COPY_TEMPLATE_SETS[rank % COPY_TEMPLATE_SETS.length].map((f) => f(keyword))
}

export interface Topic {
  keyword: string
  /** 다룬 채널 수 */
  channels: number
  videos: number
  topViews: number
  avgViews: number
  top: YtVideo
  ideas: string[]
}

/** 주목 주제 — 두 단어 묶음(2편 · 2채널) 먼저, 그다음 한 단어(3편 · 2채널, 앞 묶음에 든 단어는 뺀다) */
export function extractTopics(videos: readonly YtVideo[], channelWords: ReadonlySet<string>, n = 4): Topic[] {
  const all = ranked(tally(videos, channelWords))
  const phrases = all.filter(([w, t]) => w.includes(' ') && t.videos >= 2 && t.channels.size >= 2)
  const singles = all.filter(([w, t]) => !w.includes(' ') && t.videos >= 3 && t.channels.size >= 2)
  const picked: Array<[string, Tally]> = []
  const used = new Set<string>()
  for (const p of phrases) {
    if (picked.length >= n) break
    picked.push(p)
    for (const part of p[0].split(' ')) used.add(part)
  }
  for (const s of singles) {
    if (picked.length >= n) break
    if (!used.has(s[0])) picked.push(s)
  }
  return picked.map(([keyword, t], rank) => {
    const hits = [...t.hits].sort((a, b) => b.views - a.views)
    return {
      keyword,
      channels: t.channels.size,
      videos: hits.length,
      topViews: hits[0]?.views ?? 0,
      avgViews: hits.length ? Math.floor(hits.reduce((s, v) => s + v.views, 0) / hits.length) : 0,
      top: hits[0],
      ideas: titleIdeas(keyword, rank),
    }
  })
}

/* ------------------------------------------------------------------ */
/* 순위 판                                                               */
/* ------------------------------------------------------------------ */

export interface Board {
  /** 조회수 순 상위 topN */
  rows: YtVideo[]
  /** 고른 키워드까지 거른 영상 전체의 평균(급상승 기준) */
  periodAvg: number
  /** 순위 판에 오른 것의 평균 */
  shownAvg: number
  /** 내 채널이 판에서 가장 높은 순위(1부터) · 없으면 0 */
  myBestRank: number
}

export function boardOf(videos: readonly YtVideo[], topN: number, keyword = ''): Board {
  const pool = keyword ? videos.filter((v) => matchesKeyword(v.title, keyword)) : [...videos]
  const rows = [...pool].sort((a, b) => b.views - a.views).slice(0, Math.max(1, topN))
  const avg = (xs: readonly YtVideo[]) => (xs.length ? Math.floor(xs.reduce((s, v) => s + v.views, 0) / xs.length) : 0)
  const mi = rows.findIndex((v) => v.mine)
  return { rows, periodAvg: avg(pool), shownAvg: avg(rows), myBestRank: mi >= 0 ? mi + 1 : 0 }
}

/** 급상승 — 14일 안에 올렸고 그 기간 평균의 2배 이상 */
export function isRising(v: Pick<YtVideo, 'daysAgo' | 'views'>, periodAvg: number): boolean {
  return v.daysAgo <= 14 && periodAvg > 0 && v.views >= periodAvg * 2
}

/* ------------------------------------------------------------------ */
/* 채널 현황 · 심층 분석                                                   */
/* ------------------------------------------------------------------ */

export interface ChannelRow extends YtChannel {
  /** 총 조회수 ÷ 구독자(소수 한 자리) */
  viewsPerSub: number
}

export function channelTable(channels: readonly YtChannel[]): ChannelRow[] {
  return [...channels]
    .map((c) => ({ ...c, viewsPerSub: Math.round((c.views / Math.max(c.subs, 1)) * 10) / 10 }))
    .sort((a, b) => b.subs - a.subs)
}

export interface CompareRow {
  label: string
  mine: string
  bench: string
}

const won = (n: number) => Math.round(n).toLocaleString('ko-KR')

/** 내 채널 vs 벤치마킹 평균 — 내 채널이 없으면 빈 목록 */
export function compareMine(p: Prepared): CompareRow[] {
  const me = p.channels.find((c) => c.id === p.myChannelId)
  const bench = p.channels.filter((c) => c.id !== p.myChannelId)
  if (!me || bench.length === 0) return []
  const mv = p.videos.filter((v) => v.channelId === me.id)
  const bv = p.videos.filter((v) => v.channelId !== me.id)
  const avg = (xs: readonly YtVideo[]) => (xs.length ? Math.floor(xs.reduce((s, v) => s + v.views, 0) / xs.length) : 0)
  const shortRate = (xs: readonly YtVideo[]) => (xs.length ? Math.round((xs.filter((v) => v.isShort).length / xs.length) * 1000) / 10 : 0)
  const b30 = bv.filter((v) => v.daysAgo <= 30)
  const perCh = new Map<string, number>()
  for (const v of b30) perCh.set(v.channelId, (perCh.get(v.channelId) ?? 0) + 1)
  const bench30 = perCh.size ? Math.round(([...perCh.values()].reduce((s, n) => s + n, 0) / perCh.size) * 10) / 10 : 0
  const benchSubs = Math.floor(bench.reduce((s, c) => s + c.subs, 0) / bench.length)
  return [
    { label: '구독자 수', mine: `${won(me.subs)}명`, bench: `${won(benchSubs)}명` },
    { label: '영상당 평균 조회수', mine: `${won(avg(mv))}회`, bench: `${won(avg(bv))}회` },
    { label: '쇼츠 비율', mine: `${shortRate(mv).toFixed(1)}%`, bench: `${shortRate(bv).toFixed(1)}%` },
    { label: '최근 30일 업로드', mine: `${mv.filter((v) => v.daysAgo <= 30).length}편`, bench: `${bench30.toFixed(1)}편` },
  ]
}

export interface GroupStat {
  label: string
  avg: number
  count: number
  max: number
}

function groupStats<K>(videos: readonly YtVideo[], keyOf: (v: YtVideo) => K, labelOf: (k: K) => string): Array<GroupStat & { key: K }> {
  const m = new Map<K, YtVideo[]>()
  for (const v of videos) {
    const k = keyOf(v)
    const arr = m.get(k)
    if (arr) arr.push(v)
    else m.set(k, [v])
  }
  return [...m.entries()].map(([key, xs]) => ({
    key,
    label: labelOf(key),
    avg: Math.round(xs.reduce((s, v) => s + v.views, 0) / xs.length),
    count: xs.length,
    max: Math.max(...xs.map((v) => v.views)),
  }))
}

export const WEEKDAY_LABEL = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']

/** 요일별(평균 조회수 높은 순) */
export function byWeekday(videos: readonly YtVideo[]): GroupStat[] {
  return groupStats(videos, (v) => v.weekday, (k) => WEEKDAY_LABEL[k]).sort((a, b) => b.avg - a.avg)
}

/** 시간대별(한국 시간 · 2편 이상만 · 평균 높은 순) */
export function byHour(videos: readonly YtVideo[]): GroupStat[] {
  const pad = (h: number) => String(h).padStart(2, '0')
  return groupStats(videos, (v) => v.hour, (h) => `${pad(h)}:00~${pad(h)}:59`)
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.avg - a.avg)
}

/** 길이 구간별(짧은 것부터) */
export function byLength(videos: readonly YtVideo[]): GroupStat[] {
  return groupStats(videos, (v) => v.bucket, (b) => b).sort((a, b) => LENGTH_BUCKETS.indexOf(a.key) - LENGTH_BUCKETS.indexOf(b.key))
}

export function bestOf(stats: readonly GroupStat[]): GroupStat | null {
  return stats.reduce<GroupStat | null>((best, g) => (!best || g.avg > best.avg ? g : best), null)
}

export interface FormatRow {
  channel: string
  longAvg: number
  shortAvg: number
  longCount: number
  shortCount: number
}

/** 채널별 롱폼 vs 쇼츠(롱폼 평균 높은 순) */
export function formatByChannel(videos: readonly YtVideo[]): FormatRow[] {
  const m = new Map<string, YtVideo[]>()
  for (const v of videos) m.set(v.channelName, [...(m.get(v.channelName) ?? []), v])
  const avg = (xs: readonly YtVideo[]) => (xs.length ? Math.round(xs.reduce((s, v) => s + v.views, 0) / xs.length) : 0)
  return [...m.entries()]
    .map(([channel, xs]) => {
      const lg = xs.filter((v) => !v.isShort)
      const sh = xs.filter((v) => v.isShort)
      return { channel, longAvg: avg(lg), shortAvg: avg(sh), longCount: lg.length, shortCount: sh.length }
    })
    .sort((a, b) => b.longAvg - a.longAvg)
}

export interface CadenceRow {
  channel: string
  collected: number
  recent7: number
  recent30: number
  /** 평균 업로드 간격(일, 소수 한 자리) · 영상이 2편 안 되면 null */
  avgDays: number | null
}

/** 채널별 업로드 주기(자주 올리는 순 · 모르는 것은 맨 뒤) */
export function uploadCadence(videos: readonly YtVideo[]): CadenceRow[] {
  const m = new Map<string, YtVideo[]>()
  for (const v of videos) m.set(v.channelName, [...(m.get(v.channelName) ?? []), v])
  return [...m.entries()]
    .map(([channel, xs]) => {
      const ts = xs.map((v) => v.publishedAt).sort((a, b) => a - b)
      const avgDays = ts.length >= 2 ? Math.round(((ts[ts.length - 1] - ts[0]) / DAY / (ts.length - 1)) * 10) / 10 : null
      return { channel, collected: xs.length, recent7: xs.filter((v) => v.daysAgo <= 7).length, recent30: xs.filter((v) => v.daysAgo <= 30).length, avgDays }
    })
    .sort((a, b) => (a.avgDays ?? Infinity) - (b.avgDays ?? Infinity))
}

/* ------------------------------------------------------------------ */
/* 글 · 파일                                                              */
/* ------------------------------------------------------------------ */

export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR')

/** 2026년 10월 3일(한국 시간) */
export function dateKo(t: number): string {
  const k = new Date(t + KST)
  return `${k.getUTCFullYear()}년 ${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`
}

/** 1.2만 · 3.4억 — 카드처럼 좁은 칸 */
export function shortNum(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(n >= 1_000_000_000 ? 0 : 1).replace(/\.0$/, '')}억`
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}만`
  return fmt(n)
}

/** 엑셀에서 바로 열리는 CSV(한글 깨지지 않게 BOM) */
export function videosCsv(videos: readonly YtVideo[]): string {
  const esc = (s: string | number) => {
    const t = String(s)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const head = ['채널', '제목', '올린 날', '조회수', '좋아요', '댓글', '좋아요율(%)', '길이(초)', '종류', '주소']
  const rows = [...videos]
    .sort((a, b) => b.views - a.views)
    .map((v) => [v.channelName, v.title, new Date(v.publishedAt + KST).toISOString().slice(0, 10), v.views, v.likes, v.comments, v.likeRate, v.durationSec, v.isShort ? '쇼츠' : '롱폼', v.url].map(esc).join(','))
  return `﻿${[head.join(','), ...rows].join('\n')}\n`
}
