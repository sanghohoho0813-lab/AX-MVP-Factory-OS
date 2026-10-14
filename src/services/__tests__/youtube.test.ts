/**
 * 유튜브 벤치마킹 시험 (D-193).
 *  - 계산(ytBench): 기간 · 쇼츠 · 요일/시간(한국 시간) · 키워드(점수 · 2편 · 2채널 · 불용어 · 어미 · 채널명) · 주목 주제 · 제목 틀 ·
 *    순위 판 · 급상승 · 채널 현황 · 내 채널 비교 · 요일/시간/길이/롱폼·쇼츠/업로드 주기 · CSV
 *  - 예시 데이터: 같은 시각이면 같은 데이터 · 진짜 채널 이름 없음
 *  - 서버 함수(api/yt-bench.js): 유튜브를 흉내 낸 fetch 로 — 키 없음 · 주소 칸 검사 · 채널 하나 실패 · 할당량 · 틀린 키 · 캐시 · 키가 응답에 없음
 *  - 콘텐츠 레이더(D-194) R1~R12: 롱폼/쇼츠 기준 · 작은 채널 · 평소 대비 · 나이 · 한 번 터진 영상 · 여러 채널 · 한 채널 반복 ·
 *    네 묶음 · 3축 · BRIDGE · 수첩 저장/다시 읽기 · 작업공간 격리 + [채널 추가](로그인 확인 · 저렴한 호출만)
 *  - D-196 6시간 자동 갱신: 채널 구성 판 · status 할당량 0 · 6시간 칸 · 409 · 예전 18채널 저장본 → 49채널(D-197) · 5시간 59분 그대로 ·
 *    6시간 넘으면 새로 · 돌아올 때 · 판 바뀜 · [지금 새로] · 실패하면 지난번 것 + 받은 때(화면 저장소를 진짜 서버 함수로 이어서)
 * 실행: npm run test:youtube
 */
import handler, { CHANNELS, FEED_REVISION, FEED_SCHEMA, checkQuery, feedRevisionOf, parseChannelInput, parseDuration, secondsUntilNine, secondsUntilWindowEnd, windowOf as serverWindowOf } from '../../../api/yt-bench.js'
import { FRESH_MS, ensureYt, isStale, kstWhen, readCache, refreshYt, resetYtForTest, windowOf, ytSnapshot } from '../marketing/ytFeed'
import { TOPICS, aiMentions, aiToolsOf, domainsOf, formatTagsOf, normalizeTitle, toolTopicsOf, topicsOf } from '../marketing/radarPlaybook'
import { mergeFeeds } from '../marketing/ytExtra'
import { enabledModulesByGroup, isPilotHiddenPath } from '../../config/moduleRegistry'
import {
  aiKeywordBoard,
  aiWorkflowSignals,
  breakoutVideos,
  clusterHot,
  clusterOrder,
  clusterRecent,
  coverageHits,
  evidenceChannels,
  evidenceOrder,
  risingTopics,
  domainSignals,
  isCore,
  isCoreKeyword,
  isNoiseKeyword,
  newAiKeywords,
  sideBreakouts,
  whyRecommended,
  clusters,
  expectedShare,
  groupOf,
  hotPatterns,
  mixPicks,
  myChannelStats,
  pickBenchmarks,
  radarPlan,
  radarVideos,
  ratioLine,
  stripChannelTag,
  titlePatterns,
} from '../marketing/ytRadar'
import { briefText, confirmInput, ideaFromOpportunity, listIdeas, loadPrefs, normalizeIdea, normalizePrefs, removeIdea, saveIdea, savePrefs, selectedIdeas } from '../marketing/radarStore'
import {
  boardOf,
  byHour,
  byLength,
  byWeekday,
  bestOf,
  channelTable,
  compareMine,
  extractKeywords,
  extractTopics,
  formatByChannel,
  isMeaningful,
  isRising,
  lengthBucket,
  matchesKeyword,
  periodVideos,
  prepareFeed,
  shortNum,
  titleIdeas,
  titleWords,
  uploadCadence,
  videosCsv,
  type YtChannel,
  type YtVideoRaw,
} from '../marketing/ytBench'
import { sampleFeed } from '../marketing/ytSample'

let passed = 0
/** 기본 벤치마킹 채널 수(D-197: 33 → 49 — AI 실무 11 · AX 5 더함) */
const NCH = 49
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
}

const NOW = Date.parse('2026-10-14T03:00:00Z') // 한국 시간 2026-10-14(수) 12:00
const H = 3_600_000
const D = 24 * H
const ch = (id: string, title: string, subs: number, views: number, mine = false): YtChannel => ({ id, handle: `@${id}`, title, customUrl: `@${id}`, thumb: '', subs, videoCount: 100, views, mine })
const vid = (id: string, chId: string, t: string, ago: number, v: number, d = 600, l = 0, c = 0): YtVideoRaw => ({ id, ch: chId, t, at: new Date(NOW - ago).toISOString(), d, v, l, c })

/* ---------------- 계산 ---------------- */
{
  const feed = {
    channels: [ch('me', '김팀장의 경영노트', 8000, 900_000, true), ch('a', '절세연구소채널', 120_000, 30_000_000), ch('b', '나는사장이다', 60_000, 6_000_000), ch('c', '세무톡', 10_000, 500_000)],
    videos: [
      // 2026-10-14 01:00 UTC = 한국 10:00 수요일
      vid('v1', 'a', '정책자금 신청방법 놓치면 손해', 2 * H, 50_000, 900, 1000, 100),
      vid('v2', 'b', '정책자금 신청방법 사장님 필독', 3 * D, 30_000, 120),
      vid('v3', 'c', '고용지원금 받는 법 총정리', 5 * D, 8_000, 59),
      vid('v4', 'a', '고용지원금 받는 법 이렇게', 10 * D, 12_000, 1200),
      vid('v5', 'b', '고용지원금 바뀐 점', 20 * D, 9_000, 200),
      vid('v6', 'me', '정책자금 상담 사례', 1 * D, 4_000, 700),
      vid('v7', 'c', '가업승계 증여 절세연구소채널', 100 * D, 70_000, 2400),
      vid('v8', 'a', '가업승계 가업승계 증여특례', 400 * D, 999_999, 2000),
    ],
  }
  const p = prepareFeed(feed, NOW)
  const v1 = p.videos.find((v) => v.id === 'v1')!
  check('준비: 올린 지 며칠(내림) · 2시간 전은 0일', v1.daysAgo === 0 && p.videos.find((v) => v.id === 'v2')!.daysAgo === 3)
  check('준비: 요일 · 시간은 한국 시간(수요일 10시)', v1.weekday === 2 && v1.hour === 10, { w: v1.weekday, h: v1.hour })
  check('준비: 쇼츠 = 3분(180초) 이하', p.videos.find((v) => v.id === 'v2')!.isShort && !v1.isShort && p.videos.find((v) => v.id === 'v5')!.isShort === false)
  check('준비: 길이 구간 — 1분 이하 · 1~3분(쇼츠) · 15~30분', lengthBucket(59) === '1분 이하' && lengthBucket(120) === '1~3분(쇼츠)' && lengthBucket(900) === '5~15분' && lengthBucket(1200) === '15~30분' && lengthBucket(1801) === '30분 이상')
  check('준비: 좋아요율 소수 한 자리(1000/50000 = 2.0%)', v1.likeRate === 2)
  check('준비: 내 채널(mine 표시) · 내 영상', p.myChannelId === 'me' && p.videos.find((v) => v.id === 'v6')!.mine && !v1.mine)
  const p2 = prepareFeed({ channels: feed.channels.map((c) => ({ ...c, mine: false, customUrl: c.id === 'me' ? '@김팀장의경영노트' : c.customUrl })), videos: feed.videos }, NOW)
  check('준비: 서버가 mine 을 안 붙여도 핸들(김팀장의경영노트)로 내 채널을 찾는다', p2.myChannelId === 'me')
  check('준비: 영상 주소 · 썸네일 주소', v1.url === 'https://www.youtube.com/watch?v=v1' && v1.thumb === 'https://i.ytimg.com/vi/v1/mqdefault.jpg')
  check('준비: 채널 이름의 4자 이상 한글(절세연구소채널)은 키워드에서 뺀다', p.channelWords.has('절세연구소채널') && !isMeaningful('절세연구소채널', p.channelWords))

  check('불용어 · 어미: 사장님 · 신청방법 · 이렇게 · 놓치면(…면 아님) 판단', !isMeaningful('사장님') && !isMeaningful('신청방법') && !isMeaningful('이렇게') && !isMeaningful('신청하세요') && !isMeaningful('받으려면') && isMeaningful('정책자금'))
  check('제목 단어: 한글 3자 이상만 · 불용어 · 어미 빠짐', titleWords('정책자금 신청방법 놓치면 손해 TOP5').join() === '정책자금', titleWords('정책자금 신청방법 놓치면 손해 TOP5'))
  check('어미 더함(D-193): 놓치면 · 받으면 · 있다면 · 안되면 · 알아보면 · 신청하기 · 끝내기는 주제가 아니다 — 가업승계 · 고용지원금 · 법인세는 남는다', ['놓치면', '받으면', '있다면', '안되면', '알아보면', '신청하기', '끝내기'].every((w) => !isMeaningful(w)) && ['가업승계', '고용지원금', '법인세', '노란우산공제'].every((w) => isMeaningful(w)))

  const week = periodVideos(p.videos, 'week')
  check('기간: 이번 주 = 7일 안(v1 · v2 · v3 · v6)', week.map((v) => v.id).sort().join() === 'v1,v2,v3,v6')
  check('기간: 쇼츠 칸은 90일 안 쇼츠만 · 롱폼/쇼츠 거르기는 안 씀', periodVideos(p.videos, 'shorts', { type: 'long', channels: [] }).map((v) => v.id).sort().join() === 'v2,v3')
  check('기간: 올해 · 롱폼만 · 채널 a 만', periodVideos(p.videos, 'year', { type: 'long', channels: ['a'] }).map((v) => v.id).sort().join() === 'v1,v4')

  const month = periodVideos(p.videos, 'month')
  const kws = extractKeywords(month, p.channelWords)
  check('키워드: 2편 · 2채널 이상만(정책자금 · 고용지원금) — 한 채널만 다룬 말은 없음', kws.some((k) => k.word === '정책자금') && kws.some((k) => k.word === '고용지원금') && !kws.some((k) => k.word === '바뀐'), kws)
  check('키워드: 이어진 두 단어(정책자금 + 놓치면 아님 — 두 제목 모두 "정책자금 신청방법"은 신청방법이 불용어라 묶음 없음)', !kws.some((k) => k.word.includes('신청방법')))
  const kwTop = kws[0]
  check('키워드: 점수 = 조회수 합 — 정책자금(84,000) > 고용지원금(29,000)', kwTop.word === '정책자금' && kwTop.score === 84_000 && kwTop.videos === 3 && kwTop.channels === 3, kwTop)
  check('키워드 고르기: 두 단어면 둘 다 든 제목만', matchesKeyword('고용지원금 받는 법', '고용지원금') && matchesKeyword('가업승계 증여특례', '가업승계 증여특례') && !matchesKeyword('가업승계 상담', '가업승계 증여특례'))

  const bundle = {
    channels: [ch('x', '가채널', 1, 1), ch('y', '나채널', 1, 1), ch('z', '다채널', 1, 1)],
    videos: [
      vid('p1', 'x', '가업승계 증여특례 핵심 사례', D, 9000),
      vid('p2', 'y', '가업승계 증여특례 실제 사례', D, 3000),
      vid('p3', 'z', '퇴직연금 중간정산 사례', D, 1000),
      vid('p4', 'x', '퇴직연금 수령 방법', D, 1000),
      vid('p5', 'y', '퇴직연금 세금 정리', D, 1000),
      vid('p6', 'z', '가업승계 상담 실제 사례', D, 500),
    ],
  }
  const bp = prepareFeed(bundle, NOW)
  const topics = extractTopics(bp.videos, bp.channelWords)
  check('주목 주제: 두 단어 묶음(가업승계 증여특례) 먼저', topics[0]?.keyword === '가업승계 증여특례' && topics[0].channels === 2 && topics[0].topViews === 9000 && topics[0].avgViews === 6000, topics[0])
  check('주목 주제: 한 단어는 3편 · 2채널 이상(퇴직연금) · 묶음에 든 단어(가업승계)는 다시 안 나옴', topics.some((t) => t.keyword === '퇴직연금') && !topics.some((t) => t.keyword === '가업승계'), topics.map((t) => t.keyword))
  check('주목 주제: 대표 영상 = 조회수 가장 많은 것', topics[0]?.top.id === 'p1')
  check('제목 아이디어: 순위마다 다른 틀 3개 · 받침 따라 으로/로', titleIdeas('고용지원금', 2)[1] === '고용지원금으로 달라지는 것들 | 핵심만 짚어드립니다' && titleIdeas('가업승계', 2)[1] === '가업승계로 달라지는 것들 | 핵심만 짚어드립니다' && titleIdeas('정책자금', 0).length === 3 && titleIdeas('정책자금', 4)[0] === titleIdeas('정책자금', 0)[0])
  const dup = prepareFeed({ channels: bundle.channels, videos: [vid('d1', 'x', '연금저축 연금저축 비교', D, 1000), vid('d2', 'y', '연금저축 수령', D, 3000), vid('d3', 'z', '연금저축 해지', D, 2000)] }, NOW)
  const dt = extractTopics(dup.videos, dup.channelWords).find((t) => t.keyword === '연금저축')
  check('주목 주제 평균: 한 제목에 같은 말이 두 번이어도 영상은 한 번(예전 앱 버그 고침)', dt?.avgViews === 2000 && dt.videos === 3, dt)

  const board = boardOf(month, 3)
  check('순위 판: 조회수 순 상위 N', board.rows.map((v) => v.id).join() === 'v1,v2,v4' && board.rows.length === 3)
  check('순위 판: 내 채널이 판에 없으면 0 · 넓히면 순위', board.myBestRank === 0 && boardOf(month, 30).myBestRank === 6)
  check('순위 판: 키워드로 거른 평균(급상승 기준)', boardOf(month, 30, '고용지원금').periodAvg === Math.floor((8000 + 12000 + 9000) / 3))
  check('급상승: 14일 안 · 기간 평균의 2배 이상', isRising({ daysAgo: 3, views: 200 }, 100) && !isRising({ daysAgo: 15, views: 999 }, 100) && !isRising({ daysAgo: 1, views: 199 }, 100) && !isRising({ daysAgo: 1, views: 5 }, 0))

  const table = channelTable(p.channels)
  check('채널 현황: 구독자 많은 순 · 구독자당 조회수(소수 한 자리)', table[0].id === 'a' && table[0].viewsPerSub === 250 && table[3].id === 'me' && table[3].viewsPerSub === 112.5)
  const cmp = compareMine(p)
  check('내 채널 vs 벤치마킹: 4줄(구독자 · 평균 조회수 · 쇼츠 비율 · 30일 업로드)', cmp.length === 4 && cmp[0].mine === '8,000명' && cmp[0].bench === '63,333명' && cmp[3].mine === '1편', cmp)
  check('내 채널이 없으면 비교 없음', compareMine(prepareFeed({ channels: bundle.channels, videos: bundle.videos }, NOW)).length === 0)

  const wd = byWeekday(p.videos)
  check('요일별: 평균 높은 순 · 이름', wd.length > 0 && wd.every((g, i) => i === 0 || wd[i - 1].avg >= g.avg) && wd.every((g) => g.label.endsWith('요일')))
  const hours = byHour([...p.videos, ...p.videos])
  check('시간대: 2편 이상만 · "10:00~10:59"', hours.every((g) => g.count >= 2) && hours.some((g) => g.label === '10:00~10:59'))
  const lens = byLength(p.videos)
  check('길이 구간: 짧은 것부터 · 평균이 가장 높은 구간(30분 이상 — 가업승계 99만 회)', lens[0].label === '1분 이하' && bestOf(lens)?.label === '30분 이상' && lens.map((g) => g.label).join() === '1분 이하,1~3분(쇼츠),3~5분,5~15분,15~30분,30분 이상', lens)
  const fm = formatByChannel(p.videos)
  check('롱폼 vs 쇼츠: 채널마다 평균 · 편수', fm.find((r) => r.channel === '나는사장이다')!.shortCount === 1 && fm.find((r) => r.channel === '나는사장이다')!.longCount === 1)
  const cad = uploadCadence([...p.videos, { ...p.videos[0], id: 'solo', channelName: '혼자채널' }])
  const ca = cad.find((r) => r.channel === '절세연구소채널')!
  check('업로드 주기: 평균 간격(일) · 7일/30일 업로드 · 1편뿐이면 맨 뒤', ca.collected === 3 && ca.recent7 === 1 && ca.avgDays !== null && cad[cad.length - 1].channel === '혼자채널' && cad[cad.length - 1].avgDays === null, cad)

  const csv = videosCsv([...p.videos, { ...p.videos[0], id: 'q', title: '따옴표 "있는", 제목' }])
  check('CSV: 한글 깨짐 방지(BOM) · 머리줄 · 따옴표 · 쉼표 처리', csv.startsWith('﻿채널,제목,올린 날') && csv.includes('"따옴표 ""있는"", 제목"') && csv.split('\n').length === p.videos.length + 3)
  check('짧은 숫자: 1.2만 · 30만 · 1.5억', shortNum(12_000) === '1.2만' && shortNum(300_000) === '30만' && shortNum(150_000_000) === '1.5억' && shortNum(950) === '950')
}

/* ---------------- 예시 데이터 ---------------- */
{
  const a = sampleFeed(NOW)
  const b = sampleFeed(NOW)
  check('예시: 같은 시각이면 같은 데이터', JSON.stringify(a) === JSON.stringify(b))
  check('예시: 진짜 채널 이름 · 핸들이 없다(지어낸 숫자가 실제 성적처럼 보이지 않게)', a.channels.every((c) => c.title.includes('예시')) && !JSON.stringify(a).includes('김팀장') && !JSON.stringify(a).includes('UC'))
  const p = prepareFeed(a, NOW)
  check('예시: 내 채널 · 이번 주 영상 · 주목 주제가 나온다', !!p.myChannelId && periodVideos(p.videos, 'month').length > 10 && extractTopics(periodVideos(p.videos, 'month'), p.channelWords).length >= 2, extractTopics(periodVideos(p.videos, 'month'), p.channelWords).map((t) => t.keyword))
}

/* ---------------- 서버 함수 ---------------- */
type Res = { code: number; headers: Record<string, string>; body: unknown; setHeader: (k: string, v: string) => void; status: (c: number) => Res; json: (b: unknown) => Res }
const mkRes = (): Res => {
  const r: Res = {
    code: 0,
    headers: {},
    body: null,
    setHeader(k, v) {
      r.headers[k.toLowerCase()] = v
    },
    status(c) {
      r.code = c
      return r
    },
    json(b) {
      r.body = b
      return r
    },
  }
  return r
}
const call = async (q: string, headers: Record<string, string> = {}) => {
  const res = mkRes()
  await handler({ url: `/api/yt-bench${q}`, headers }, res)
  return res
}
const slot = new Date().toISOString().slice(0, 10)
const bucket = Math.floor(Date.now() / 1_800_000)
const KEYVAL = 'TEST-KEY-abc123'

type FetchMode = 'ok' | 'quota' | 'badkey'
let mode: FetchMode = 'ok'
const calls: string[] = []
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const GOOD_TOKEN = 'good-token-0123456789abcdef'
// 유튜브에서 없어진 채널 흉내(채널 정보 응답에서 빠짐)
const goneIds = new Set<string>()
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const u = new URL(String(input))
  if (u.hostname.endsWith('supabase.test')) {
    const auth = new Headers(init?.headers).get('authorization')
    return auth === `Bearer ${GOOD_TOKEN}` ? json(200, { id: 'user-1' }) : json(401, { msg: 'bad jwt' })
  }
  calls.push(u.pathname.split('/').pop() + '?' + [...u.searchParams.keys()].join(','))
  if (mode === 'quota') return json(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } })
  if (mode === 'badkey') return json(400, { error: { errors: [{ reason: 'badRequest' }], message: 'API key not valid. Please pass a valid API key.' } })
  const path = u.pathname.split('/').pop()
  const sp = u.searchParams
  if (path === 'channels' && sp.get('forHandle')) {
    const h = sp.get('forHandle')!
    return json(200, h === '@없는채널' ? { items: [] } : { items: [{ id: `UC_${h.replace('@', '')}` }] })
  }
  if (path === 'channels' && sp.get('forUsername')) return json(200, { items: [] })
  if (path === 'channels' && sp.get('id')) {
    const ids = sp.get('id')!.split(',').filter((id) => !goneIds.has(id))
    return json(200, { items: ids.map((id) => ({ id, snippet: { title: `채널 ${id}`, customUrl: `@${id}`, thumbnails: { default: { url: 'https://yt3.example/t.jpg' } } }, statistics: { subscriberCount: '12000', videoCount: '300', viewCount: '4500000' }, contentDetails: { relatedPlaylists: { uploads: `UU_${id}` } } })) })
  }
  if (path === 'playlistItems') {
    const pl = sp.get('playlistId')!
    return json(200, { items: Array.from({ length: 50 }, (_, i) => ({ contentDetails: { videoId: `${pl}_v${i}` } })) })
  }
  if (path === 'videos') {
    const ids = sp.get('id')!.split(',')
    return json(200, { items: ids.map((id, i) => ({ id, snippet: { title: `정책자금 영상 ${i}`, publishedAt: new Date(Date.now() - i * 86_400_000).toISOString() }, statistics: { viewCount: String(1000 + i), likeCount: '10', commentCount: '2' }, contentDetails: { duration: i % 3 ? 'PT12M3S' : 'PT45S' } })) })
  }
  return json(404, { error: { errors: [{ reason: 'notFound' }] } })
}) as typeof fetch

{
  const ENV = process.env as Record<string, string | undefined>
  delete ENV.YOUTUBE_API_KEY
  const st = await call('?status=1')
  check('서버: 키 없음 → status 는 configured=false · 채널 49곳(D-194: AI 8 · AX 4 · 포맷 2 더함 · @사장노트 뺌 → D-197: AI 11 · AX 5 더함)', st.code === 200 && (st.body as { configured: boolean }).configured === false && (st.body as { channels: number }).channels === NCH && CHANNELS.length === NCH)
  const nk = await call(`?slot=${slot}`)
  check('서버: 키 없음 → 503 no_key · 캐시 안 함 · 유튜브를 부르지 않음', nk.code === 503 && (nk.body as { error: string }).error === 'no_key' && nk.headers['cache-control'] === 'no-store' && calls.length === 0)

  ENV.YOUTUBE_API_KEY = KEYVAL
  const st2 = await call('?status=1')
  check('서버: status 는 키가 있는지 · 이름만(값은 절대 안 보냄)', (st2.body as { configured: boolean; keyName: string }).configured && (st2.body as { keyName: string }).keyName === 'YOUTUBE_API_KEY' && !JSON.stringify(st2.body).includes(KEYVAL))
  for (const bad of ['?foo=1', '?slot=2020-01-01', `?bucket=${bucket - 5}`, `?bucket=abc`, `?slot=${slot}&bucket=${bucket}`, `?status=1&x=2`]) {
    const r = await call(bad)
    check(`서버: 정해진 칸 · 값이 아니면 400(할당량 지킴) ${bad}`, r.code === 400 && r.headers['cache-control'] === 'no-store')
  }
  check('서버: 400 은 유튜브를 부르지 않는다', calls.length === 0)

  const ok = await call(`?slot=${slot}`)
  const body = ok.body as { channels: YtChannel[]; videos: YtVideoRaw[]; failed: string[]; units: number; fetchedAt: string }
  check('서버: 200 · 채널 49곳 모두 · 영상 50편씩 · 못 받은 채널 없음', ok.code === 200 && body.channels.length === NCH && body.videos.length === NCH * 50 && body.failed.length === 0, { code: ok.code, ch: body.channels?.length, v: body.videos?.length, failed: body.failed })
  check('서버: 내 채널 표시(@김팀장의경영노트 · 채널 번호 UCjXWwM0…) · 핸들 · 숫자', body.channels[0].mine && body.channels[0].id === 'UCjXWwM0_25vl1Mpr2Pc5amQ' && body.channels[0].handle === '@김팀장의경영노트' && body.channels[0].subs === 12000 && body.channels.filter((c) => c.mine).length === 1)
  check('채널 목록: 49곳 · 모두 채널 번호(주소가 바뀌어도 안 끊김) · 번호가 겹치지 않음 · @사장노트 없음', CHANNELS.length === NCH && CHANNELS.every((c) => /^UC[\w-]{22}$/.test(c.id)) && new Set(CHANNELS.map((c) => c.id)).size === NCH && !CHANNELS.some((c) => c.handle === '@사장노트'))
  check('서버: 영상 칸 — 길이(초) · 조회수 숫자', body.videos[0].d === 45 && body.videos[1].d === 723 && body.videos[0].v === 1000 && typeof body.videos[0].at === 'string')
  check('서버: 응답 어디에도 키 값이 없다', !JSON.stringify(ok.body).includes(KEYVAL))
  check('서버: 할당량 99단위(채널 번호로 바로 · 채널 정보는 한 번에 묶음 · 주소로 찾는 호출 0)', body.units === calls.length && body.units === 1 + NCH * 2 && calls.filter((c) => c.startsWith('channels?part,id')).length === 1 && calls.filter((c) => c.includes('forHandle') || c.includes('forUsername')).length === 0, { units: body.units, calls: calls.length })
  const maxAge = Number(/s-maxage=(\d+)/.exec(ok.headers['cache-control'] ?? '')?.[1] ?? -1)
  check('서버: 하루 칸은 다음 아침 9시까지 캐시', Math.abs(maxAge - secondsUntilNine()) <= 2, ok.headers['cache-control'])
  const fr = await call(`?bucket=${bucket}`)
  check('서버: [지금 새로] 는 30분 캐시(같은 30분에 여러 번 눌러도 유튜브는 한 번)', fr.code === 200 && fr.headers['cache-control'] === 'public, max-age=0, s-maxage=1800')
  goneIds.add('UCFSVU2_P0L2n21_d2J-ZQ2Q')
  const gone = await call(`?slot=${slot}`)
  goneIds.clear()
  const gb = gone.body as { channels: YtChannel[]; videos: YtVideoRaw[]; failed: string[] }
  check('서버: 채널 하나가 없어져도 나머지는 보내고 · 못 받은 채널 이름(@세무사)을 같이 보낸다', gone.code === 200 && gb.channels.length === NCH - 1 && gb.videos.length === (NCH - 1) * 50 && gb.failed.join() === '@세무사', gb.failed)

  mode = 'quota'
  const q = await call(`?slot=${slot}`)
  check('서버: 할당량 초과 → 429 quota · 캐시 안 함', q.code === 429 && (q.body as { error: string }).error === 'quota' && q.headers['cache-control'] === 'no-store')
  mode = 'badkey'
  const bk = await call(`?slot=${slot}`)
  check('서버: 틀린 키 → 502 bad_key(키 값은 안 보냄)', bk.code === 502 && (bk.body as { error: string }).error === 'bad_key' && !JSON.stringify(bk.body).includes(KEYVAL))
  mode = 'ok'

  const now = Date.now()
  check('주소 칸: 지금 · 바로 앞 30분 칸만 · 오늘/어제 9시 칸만', checkQuery(new URLSearchParams(`bucket=${Math.floor(now / 1_800_000) - 1}`), now).ok && !checkQuery(new URLSearchParams(`bucket=${Math.floor(now / 1_800_000) + 1}`), now).ok && checkQuery(new URLSearchParams(`slot=${new Date(now - 86_400_000).toISOString().slice(0, 10)}`), now).ok && checkQuery(new URLSearchParams(''), now).ok)
  check('길이 읽기: PT1H2M3S = 3723 · PT45S · P1DT1S · 빈 값 0', parseDuration('PT1H2M3S') === 3723 && parseDuration('PT45S') === 45 && parseDuration('P1DT1S') === 86401 && parseDuration('') === 0 && parseDuration(undefined) === 0)
  const nine = Date.parse('2026-10-14T00:00:00Z') // 한국 9시
  check('9시까지 남은 초: 8시 59분 → 60 · 9시 30초 → 하루 가까이', secondsUntilNine(nine - 60_000) === 60 && secondsUntilNine(nine + 30_000) === 86_370)
}

/* ---------------- 콘텐츠 레이더(D-194) ---------------- */
{
  // 채널마다 평소 영상을 깔고(7일 넘은 것) 그 위에 시험 영상을 얹는다
  const base = (chId: string, n: number, views: number, d = 600, from = 10) => Array.from({ length: n }, (_, i) => vid(`${chId}_b${i}`, chId, `평범한 이야기 ${chId} ${i}`, (from + i * 3) * D, views + i, d))

  // R1 — 롱폼과 쇼츠는 따로 잰다
  {
    const p = prepareFeed({ channels: [ch('k', '롱쇼채널', 50_000, 1)], videos: [...base('k', 6, 10_000, 900), ...base('k', 6, 1_000, 40), vid('k_s', 'k', '쇼츠 하나', 10 * D, 3_500, 40)] }, NOW)
    const v = radarVideos(p, { now: NOW }).find((x) => x.id === 'k_s')!
    check('R1 롱폼 · 쇼츠 기준 따로: 쇼츠 3,500 = 쇼츠 평소(약 1천)의 3.5배 → 터짐(롱폼 1만과 섞지 않음)', v.baseline !== null && v.baseline < 1_100 && v.baseline > 900 && v.tier === 'breakout', { baseline: v.baseline, tier: v.tier })
  }
  // R2 · R3 — 작은 채널 · 같은 조회수라도 평소가 다르면 신호가 다르다
  {
    const p = prepareFeed({ channels: [ch('s', '작은채널', 5_000, 1), ch('b', '큰채널', 900_000, 1)], videos: [...base('s', 8, 5_000), ...base('b', 8, 50_000), vid('s_x', 's', '정책자금 받은 회사 이야기', 9 * D, 40_000), vid('b_x', 'b', '정책자금 받은 회사 이야기 2', 9 * D, 40_000)] }, NOW)
    const rv = radarVideos(p, { now: NOW })
    const sx = rv.find((x) => x.id === 's_x')!
    const bx = rv.find((x) => x.id === 'b_x')!
    check('R2 작은 채널 터짐: 구독자 5천 채널 · 평소 5천 → 4만 = 8배 · 작은 채널 표시', sx.tier === 'breakout' && sx.small && Math.round(sx.ratio ?? 0) === 8, { tier: sx.tier, ratio: sx.ratio })
    check('R3 같은 4만 회라도 평소 5천 채널(8배)이 평소 5만 채널(0.8배)보다 강한 신호', (sx.adjusted ?? 0) > 5 * (bx.adjusted ?? 0) && bx.tier === 'normal' && breakoutVideos(rv).map((x) => x.id).join() === 's_x')
    check('R2 화면 말: "평소보다 8.0배" 근거를 그대로', ratioLine(sx) === '평소보다 8.0배', ratioLine(sx))
  }
  // R4 — 올린 지 얼마 안 된 영상은 나이를 반영한다
  {
    const p = prepareFeed({ channels: [ch('a', '나이채널', 30_000, 1)], videos: [...base('a', 8, 2_000), vid('a_young', 'a', '이틀 된 영상', 2 * D, 2_200), vid('a_old', 'a', '한 달 된 영상', 30 * D, 2_200)] }, NOW)
    const rv = radarVideos(p, { now: NOW })
    const y = rv.find((x) => x.id === 'a_young')!
    const o = rv.find((x) => x.id === 'a_old')!
    check('R4 경과시간: 같은 2,200회라도 2일 된 영상은 평소 기대(약 42%)의 2배 넘게 → 잘됨, 30일 된 것은 평소 수준', y.tier === 'above' && o.tier === 'normal' && (y.adjusted ?? 0) > 2 * (o.adjusted ?? 0), { y: y.adjusted, o: o.adjusted })
    check('R4 기대 비율 곡선: 1일 이하 0.3 → 7일 1.0(실제 데이터로 정함)', expectedShare(0.5) === 0.3 && expectedShare(7) === 1 && expectedShare(30) === 1 && expectedShare(4) > 0.6 && expectedShare(4) < 0.7)
    check('R4 화면 말: "2일 만에 평소의 1.1배"', ratioLine(y) === '2일 만에 평소의 1.1배', ratioLine(y))
  }
  // R5 — 한 번 터진 영상이 평소를 끌어올리지 않는다(중앙값)
  {
    const p = prepareFeed({ channels: [ch('v', '한방채널', 20_000, 1)], videos: [...base('v', 8, 1_000), vid('v_viral', 'v', '한 번 터진 영상', 20 * D, 1_000_000), vid('v_x', 'v', '평소보다 잘된 영상', 9 * D, 3_600)] }, NOW)
    const x = radarVideos(p, { now: NOW }).find((q) => q.id === 'v_x')!
    check('R5 100만 회 한 편이 있어도 평소는 약 1천(평균이면 11만) → 3,600 은 터짐', x.baseline !== null && x.baseline < 1_100 && x.tier === 'breakout', { baseline: x.baseline })
  }
  // R6 · R7 — 여러 채널 vs 한 채널 반복
  {
    const chs = [ch('m1', '시장채널하나', 10_000, 1), ch('m2', '시장채널둘', 12_000, 1), ch('m3', '시장채널셋', 15_000, 1), ch('solo', '혼자채널', 20_000, 1)]
    const vids = [
      ...base('m1', 6, 1_000, 600, 20), ...base('m2', 6, 1_000, 600, 20), ...base('m3', 6, 1_000, 600, 20), ...base('solo', 6, 1_000, 600, 20),
      vid('m1_t', 'm1', '정책자금 신청 전에 볼 것', 8 * D, 4_000),
      vid('m2_t', 'm2', '정책 자금 직접대출 열렸다', 9 * D, 1_200),
      vid('m3_t', 'm3', '정책자금 떨어지는 이유', 10 * D, 1_500),
      ...Array.from({ length: 5 }, (_, i) => vid(`solo_${i}`, 'solo', `가업승계 이야기 ${i}편`, (8 + i) * D, 1_100)),
    ]
    const rv = radarVideos(prepareFeed({ channels: chs, videos: vids }, NOW), { now: NOW })
    const cs = clusters(rv)
    const pf = cs.find((c) => c.topicId === 'policy_fund')!
    const su = cs.find((c) => c.topicId === 'succession')!
    check('R6 같은 주제가 3개 채널에서 + 터진 영상 → 신호 강함 · 이유에 "3개 채널"', pf.strength === 'strong' && pf.channels14 === 3 && pf.reasons.some((r) => r.includes('3개 채널')), pf)
    check('R6 표기 차이 합침: "정책 자금" 도 정책자금으로 센다', pf.videos30 === 3)
    check('R7 한 채널이 5편 올린 주제는 여러 채널 흐름으로 과대평가하지 않는다(초기 신호 · 이유에 "한 채널")', su.strength === 'early' && su.dominant === '혼자채널' && su.reasons.some((r) => r.includes('한 채널')) && clusterOrder(pf, su) < 0, su)
  }
  // R8 — 네 묶음
  {
    check('R8 묶음: 서버가 붙인 묶음 → 대표가 바꾼 묶음 순 · 모르면 직접 경쟁', groupOf({ id: 'x', group: 'ai' }) === 'ai' && groupOf({ id: 'x', group: 'ai' }, { x: { group: 'format' } }) === 'format' && groupOf({ id: 'y' }) === 'direct' && groupOf({ id: 'z', group: 'weird' }) === 'direct')
    const groups = new Map(CHANNELS.map((c) => [c.id, c.group]))
    const count = (g: string) => [...groups.values()].filter((x) => x === g).length
    check('R8 기본 채널: 직접 19(@사장노트 뺌) · AI 실무 19 · AX 9 · 포맷 2(모두 묶음이 있다 · D-197 AI 11 · AX 5 더함)', count('direct') === 19 && count('ai') === 19 && count('ax') === 9 && count('format') === 2 && CHANNELS.every((c) => typeof c.note === 'string' && c.note.length > 0))
    const chs = [{ ...ch('d1', '직접하나', 10_000, 1), group: 'direct' }, { ...ch('f1', '포맷하나', 900_000, 1), group: 'format' }, { ...ch('a1', '에이아이', 9_000, 1), group: 'ai' }, { ...ch('d2', '직접둘', 10_000, 1), group: 'direct' }]
    const vids = [...base('d1', 5, 1_000), ...base('f1', 5, 1_000), ...base('a1', 5, 1_000), ...base('d2', 5, 1_000), vid('f_t', 'f1', '정책자금 포맷 영상', 8 * D, 9_000), vid('f_t2', 'f1', '정책자금 포맷 영상 둘', 9 * D, 9_000), vid('d_t', 'd1', '정책자금 직접 영상', 8 * D, 900)]
    const p = prepareFeed({ channels: chs, videos: vids }, NOW)
    const plan = radarPlan(p, { now: NOW })
    check('R8 포맷 묶음 영상은 주제 수요로 세지 않는다(표현 방식 참고용) · AI 채널 수는 AI+AX 묶음', !plan.clusters.some((c) => c.topicId === 'policy_fund') && plan.aiChannels === 1)
    const off = radarPlan(p, { now: NOW, overrides: { a1: { enabled: false } } })
    check('R8 채널 끄기: 끈 AI 채널은 AI 채널 수에서도 빠진다 → AI 데이터 부족 안내', off.aiChannels === 0 && off.aiDataShort)
  }
  // R9 — 표기 정규화 · 3축 분류
  {
    check('R9 정규화: 챗GPT · 챗지피티 · ChatGPT → chatgpt / 클로드 → claude / 인공지능 → ai / AI 도입 → ax', normalizeTitle('챗지피티 활용').includes('chatgpt') && normalizeTitle('ChatGPT 활용').includes('chatgpt') && normalizeTitle('챗GPT 써보니').includes('chatgpt') && normalizeTitle('클로드 써보니').includes('claude') && normalizeTitle('인공지능 시대').includes(' ai ') && normalizeTitle('우리 회사 AI 도입기').includes(' ax '))
    check('R9 시장수요: 정책자금 · 지원사업 · 고용지원금 · 절세 · 가업승계', topicsOf('소상공인 정책자금 직접대출 오픈런').includes('policy_fund') && topicsOf('정부지원사업 사업계획서 쓰는 법').includes('grant_program') && topicsOf('청년 채용하면 고용지원금').includes('employ_subsidy') && topicsOf('법인세 줄이는 절세').includes('tax_saving') && topicsOf('비상장주식 증여 시기').includes('succession'))
    check('R9 지원금 계열은 합치지 않고 좁은 주제 하나만(고용지원금이면 소상공인 지원금으로 또 세지 않음)', topicsOf('고용지원금 받는 법').join() === 'employ_subsidy' && topicsOf('민생지원금 지역 발표').join() === 'sme_subsidy')
    check('R9 AI · AX: Claude + 업무자동화 / n8n → 노코드 / 엑셀 자동화 / AI 도입 → AX', topicsOf('Claude로 업무 자동화 해봤습니다').join() === 'claude,automation' && topicsOf('n8n 으로 회사 업무 돌리기').includes('nocode') && topicsOf('엑셀 자동화 10분').includes('sheets') && topicsOf('중소기업 AI 도입 사례').includes('ax_adopt'))
    check('R9 채널 이름 꼬리표는 주제로 세지 않는다("| 절세미녀" → 절세 아님)', topicsOf(stripChannelTag('퇴직금 1억 = 연금 50만 원 | 절세미녀', '절세미녀 김희연 회계사')).join() === 'ceo_money' && stripChannelTag('세제개편 분석[보고파TV]', '보고파TV') === '세제개편 분석' && stripChannelTag('지원금 꼭 받으세요 #shorts #여의도정보맨', '여의도 정보맨') === '지원금 꼭 받으세요')
    check('R9 낱말 속 겹침은 주제로 세지 않는다("일정관리" 의 정관 · "법인 만들어 봤습니다" 는 AI 만들기 아님 · "interpret" 의 erp)', topicsOf('노션 일정관리 템플릿').length === 0 && !topicsOf('법인 만들어 봤습니다').includes('vibe_coding') && topicsOf('AI로 사내 프로그램 만들어 봤습니다').includes('vibe_coding') && !topicsOf('interpret the data').includes('inhouse') && topicsOf('정관 변경 꼭 하세요').includes('incorporation'))
    check('R9 제목 구조: 숫자형 · 경고형 · 결과형 · 질문형 · 마감형 · 비교형', titlePatterns('5가지 꼭 챙기세요').includes('number') && titlePatterns('모르면 손해 보는 지원금').includes('warning') && titlePatterns('AI로 해봤더니 달라졌다').includes('result') && titlePatterns('법인전환 해야 할까?').includes('question') && titlePatterns('오늘까지 마감').includes('deadline') && titlePatterns('개인 vs 법인').includes('compare'))
  }
  // R10 — BRIDGE · 섞기 · 제목 품질
  {
    const chs = [ch('p1', '정책하나', 10_000, 1), ch('p2', '정책둘', 12_000, 1), ch('p3', '정책셋', 15_000, 1), { ...ch('ai1', '에이아이하나', 8_000, 1), group: 'ai' }, { ...ch('ai2', '에이아이둘', 9_000, 1), group: 'ai' }]
    const vids = [
      ...base('p1', 6, 1_000, 600, 20), ...base('p2', 6, 1_000, 600, 20), ...base('p3', 6, 1_000, 600, 20), ...base('ai1', 6, 1_000, 600, 20), ...base('ai2', 6, 1_000, 600, 20),
      vid('p1_t', 'p1', '지원사업 선정되는 사업계획서', 8 * D, 5_000), vid('p2_t', 'p2', '정부지원사업 공고 정리', 9 * D, 1_200), vid('p3_t', 'p3', '지원사업 떨어지는 이유', 10 * D, 1_300),
      vid('ai1_t', 'ai1', 'Claude로 보고서 써봤습니다', 8 * D, 6_000), vid('ai2_t', 'ai2', 'Claude 업무에 써보니', 9 * D, 1_500),
    ]
    const p = prepareFeed({ channels: chs, videos: vids }, NOW)
    const plan = radarPlan(p, { now: NOW })
    const bridge = plan.picks.find((o) => o.axis === 'bridge')
    check('R10 BRIDGE 후보: "정부지원사업 × AI 자동 선별" · 왜 BRIDGE 인지가 맨 앞', !!bridge && bridge.topic === '정부지원사업 × AI 자동 선별' && /AI|자동화/.test(bridge.whyNow[0]), bridge?.whyNow)
    check('R10 이번 주 앞 5개에 시장수요 · AX·AI · BRIDGE 가 섞인다', ['market', 'axai', 'bridge'].every((a) => plan.picks.slice(0, 5).some((o) => o.axis === a)), plan.picks.map((o) => o.axis))
    check('R10 같은 주제가 시장형 · BRIDGE 두 장으로 앞 5개에 겹치지 않는다(다른 후보가 있으면)', new Set(plan.picks.slice(0, 3).map((o) => o.topicId)).size === Math.min(3, new Set(plan.picks.map((o) => o.topicId)).size))
    const inputTitles = new Set(vids.map((x) => x.t))
    const allTitles = TOPICS.flatMap((t) => [...t.main.titles, ...(t.bridge?.titles ?? [])])
    check('R10 제목 후보는 경쟁 영상 제목을 그대로 쓰지 않는다', plan.picks.every((o) => o.titles.every((t) => !inputTitles.has(t.text))))
    check('R10 제목 문장 품질: 모든 주제 · 3개씩 · 10~45자 · 빈칸 · 템플릿 흔적 없음 · 키워드만 붙인 꼴(예: "정책자금 AI 10월 방법") 없음', allTitles.length === TOPICS.length * 3 + TOPICS.filter((t) => t.bridge).length * 3 && allTitles.every((t) => t.length >= 10 && t.length <= 45 && !/[{}]|undefined|\s{2}/.test(t) && !/^\S+ AI \d+월/.test(t)), allTitles.filter((t) => t.length < 10 || t.length > 45))
    const mixed = mixPicks({ market: plan.picks.filter((o) => o.axis === 'market'), axai: [], bridge: plan.picks.filter((o) => o.axis === 'bridge') }, { market: 45, axai: 35, bridge: 20 })
    check('R10 AI 후보가 없으면 그 자리는 다른 축으로(억지 카드 없음)', mixed.every((o) => o.axis !== 'axai') && mixed.length > 0)
    const empty = radarPlan(prepareFeed({ channels: [ch('e', '빈채널', 1_000, 1)], videos: base('e', 5, 100) }, NOW), { now: NOW })
    check('R10 데이터가 없으면 후보를 만들지 않는다', empty.picks.length === 0)
    check('R10 이번 달 잘된 제목 구조 · 내 채널 통계(Analytics 없이 공개 숫자만)', hotPatterns(radarVideos(p, { now: NOW })).length > 0 && myChannelStats(radarVideos(p, { now: NOW })) === null)
  }
  // R11 · R12 — 콘텐츠 수첩 저장 · 다시 읽기 · 작업공간 격리
  {
    const chs = [ch('p1', '정책하나', 10_000, 1), ch('p2', '정책둘', 12_000, 1)]
    const p = prepareFeed({ channels: chs, videos: [...base('p1', 6, 1_000), ...base('p2', 6, 1_000), vid('x1', 'p1', '정책자금 받는 순서', 8 * D, 5_000), vid('x2', 'p2', '정책자금 오픈런', 9 * D, 1_200)] }, NOW)
    const o = radarPlan(p, { now: NOW }).picks[0]
    const saved = await saveIdea('ws-A', ideaFromOpportunity(o))
    const back = await listIdeas('ws-A')
    check('R11 아이디어 저장 → 다시 읽기(주제 · 관점 · 유형 · 참고 영상 · 제목 3 · 썸네일 2 · 저장 시각 · 단계=아이디어)', back.length === 1 && back[0].id === saved.id && back[0].topic === o.topic && back[0].type === o.axis && back[0].benchmarkVideoIds.length > 0 && back[0].titleCandidates.length === 3 && back[0].thumbnailCandidates.length === 2 && !!back[0].savedAt && back[0].status === 'idea', back[0])
    await saveIdea('ws-A', { ...back[0], status: 'script', memo: '화요일 촬영' })
    const again = await listIdeas('ws-A')
    check('R11 단계 바꾸기 · 메모가 남는다(같은 줄을 고쳐 씀 · 두 줄 안 됨)', again.length === 1 && again[0].status === 'script' && again[0].memo === '화요일 촬영')
    check('R11 브리프 복사 글: 주제 · 관점 · 제목 · 근거 · 참고 영상(그대로 쓰지 않는다는 말)', briefText(again[0]).includes(o.topic) && briefText(again[0]).includes('그대로 쓰지 않는다') && briefText(again[0]).includes('youtube.com/watch'))
    check('R11 잘못된 기록은 버린다(주제 없음) · 모르는 단계는 아이디어', normalizeIdea({ topic: '' }, 'z') === null && normalizeIdea({ topic: '주제', status: 'weird' }, 'z')?.status === 'idea')
    check('R12 다른 작업공간에서는 안 보인다(팀장 작업공간 ≠ 대표 작업공간)', (await listIdeas('ws-B')).length === 0)
    await savePrefs('ws-A', normalizePrefs({ overrides: { UCaaaaaaaaaaaaaaaaaaaaaa: { enabled: false } }, added: [{ id: 'UCbbbbbbbbbbbbbbbbbbbbbb', title: '더한 채널', group: 'ax' }] }))
    const pa = await loadPrefs('ws-A')
    const pb = await loadPrefs('ws-B')
    check('R12 채널 설정도 작업공간마다 · 잘못된 채널 번호는 버린다', pa.overrides.UCaaaaaaaaaaaaaaaaaaaaaa?.enabled === false && pa.added[0]?.group === 'ax' && Object.keys(pb.overrides).length === 0 && pb.added.length === 0 && Object.keys(normalizePrefs({ overrides: { 'bad id<x>': { enabled: false } } }).overrides).length === 0 && normalizePrefs({ added: [{ id: 'notAnId', title: 'x' }] }).added.length === 0)
    await removeIdea('ws-A', saved.id)
    check('R11 빼기 → 수첩에서 사라진다', (await listIdeas('ws-A')).length === 0)
  }
}

/* ---------------- D-195 콘텐츠 레이더 UX 3.0 — 추천 품질 Q1~Q7 · 관심 없음 · 이번 주로 확정 ---------------- */
{
  const base = (chId: string, n: number, views: number, d = 600, from = 10) => Array.from({ length: n }, (_, i) => vid(`${chId}_b${i}`, chId, `평범한 이야기 ${chId} ${i}`, (from + i * 3) * D, views + i, d))
  const aich = (id: string, title: string, group = 'ai') => ({ ...ch(id, title, 9_000, 1), group })

  // Q1 · Q2 · Q3 — ChatGPT · Claude 는 다른 것(상위 'AI 업무 활용')
  check('Q 정규화: ChatGPT · Claude · Gemini 를 같은 말로 합치지 않는다', (() => {
    const n = normalizeTitle('챗GPT 클로드 제미나이 비교')
    return n.includes(' chatgpt ') && n.includes(' claude ') && n.includes(' gemini ') && !normalizeTitle('클로드 써보니').includes('chatgpt') && !normalizeTitle('챗지피티 써보니').includes('claude')
  })())
  check('Q 한 도구만 말하면 그 도구 주제(ChatGPT → chatgpt · 클로드 → claude)', topicsOf('ChatGPT로 견적서 10분 만에').join() === 'chatgpt' && topicsOf('클로드로 계약서 요약해봤습니다').join() === 'claude', [topicsOf('ChatGPT로 견적서 10분 만에'), topicsOf('클로드로 계약서 요약해봤습니다')])
  check('Q 두 도구를 함께 말하면(비교 · 나열) 어느 한 도구로 세지 않고 "AI 업무 활용"(실제 데이터: 클로드 소넷 … vs GPT-6 비교)', (() => {
    const a = topicsOf('클로드 소넷 5.5 출시! 2배 비싼 AI가 진짜 더 좋을까? | 소넷 5.5 vs 오퍼스 5.5 vs GPT-6 Sol 직접 비교')
    const b = topicsOf('지피티와 클로드 중 더 뛰어난 모델은 누구일까?')
    return !a.includes('chatgpt') && !a.includes('claude') && a.includes('ai_work') && b.join() === 'ai_work'
  })(), [topicsOf('클로드 소넷 5.5 출시! 2배 비싼 AI가 진짜 더 좋을까? | 소넷 5.5 vs 오퍼스 5.5 vs GPT-6 Sol 직접 비교'), topicsOf('지피티와 클로드 중 더 뛰어난 모델은 누구일까?')])
  check('Q 본문이 먼저 · # 꼬리표는 본문에 도구가 없을 때만("클로드로 회의록 #chatgpt" → Claude)', topicsOf('클로드로 회의록 정리 #chatgpt').join() === 'claude' && aiToolsOf('업무 자동화 꿀팁 #claude #chatgpt').length === 2 && !topicsOf('업무 자동화 꿀팁 #claude #chatgpt').includes('claude') && topicsOf('업무 자동화 꿀팁 #claude #chatgpt').includes('ai_work'), topicsOf('업무 자동화 꿀팁 #claude #chatgpt'))
  {
    const chs = [aich('g1', '지피티하나'), aich('g2', '지피티둘'), aich('c1', '클로드하나'), aich('c2', '클로드둘'), aich('x1', '둘다채널')]
    const vids = [
      ...base('g1', 6, 1_000), ...base('g2', 6, 1_000), ...base('c1', 6, 1_000), ...base('c2', 6, 1_000), ...base('x1', 6, 1_000),
      vid('g1_t', 'g1', 'ChatGPT로 견적서 만들기', 8 * D, 5_000), vid('g2_t', 'g2', '챗GPT 업무 활용 10가지', 9 * D, 4_000),
      vid('c1_t', 'c1', '클로드로 계약서 요약', 8 * D, 6_000), vid('c2_t', 'c2', 'Claude 업무에 써보니', 9 * D, 4_500),
      vid('x1_t', 'x1', '클로드 신모델 출시 vs GPT 직접 비교', 8 * D, 9_000), vid('x1_t2', 'x1', 'ChatGPT와 클로드 중 무엇이 맞을까', 9 * D, 8_000),
    ]
    const plan = radarPlan(prepareFeed({ channels: chs, videos: vids }, NOW), { now: NOW })
    const gpt = plan.clusters.find((c) => c.topicId === 'chatgpt')
    const cl = plan.clusters.find((c) => c.topicId === 'claude')
    const work = plan.clusters.find((c) => c.topicId === 'ai_work')
    const gptOpp = plan.picks.find((o) => o.topicId === 'chatgpt')
    const clOpp = plan.picks.find((o) => o.topicId === 'claude')
    check('Q1 ChatGPT 주제 · 대표 영상에 Claude 영상이 없다', !!gpt && gpt.hits.every((v) => !/claude|클로드/i.test(v.title)) && !!gptOpp && gptOpp.benchmarks.length > 0 && gptOpp.benchmarks.every((v) => !/claude|클로드/i.test(v.title)), gpt?.hits.map((v) => v.title))
    check('Q2 Claude 주제 · 대표 영상에 ChatGPT 영상이 없다', !!cl && cl.hits.every((v) => !/gpt|지피티/i.test(v.title)) && !!clOpp && clOpp.benchmarks.every((v) => !/gpt|지피티/i.test(v.title)), cl?.hits.map((v) => v.title))
    check('Q3 넓은 "AI 업무 활용" 에는 둘 다 나온 영상이 들어간다', !!work && work.hits.some((v) => v.id === 'x1_t') && work.hits.some((v) => v.id === 'x1_t2'), work?.hits.map((v) => v.title))
  }

  // Q4 · Q5 — 대표 벤치마킹 1~3편 가변 · 약한 영상(평소의 1배 아래)으로 칸을 채우지 않는다
  {
    const chs = [ch('b1', '하나채널', 10_000, 1), ch('b2', '둘채널', 12_000, 1), ch('b3', '셋채널', 15_000, 1)]
    const vids = [
      ...base('b1', 6, 1_000), ...base('b2', 6, 1_000), ...base('b3', 6, 1_000),
      vid('b1_t', 'b1', '정책자금 신청 전에 볼 것', 8 * D, 6_000), // 평소의 6배 — 터짐
      vid('b2_t', 'b2', '정책자금 떨어지는 이유', 9 * D, 900), // 평소의 0.9배
      vid('b3_t', 'b3', '정책자금 오픈런 마감', 3 * D, 900), // 3일 만에 평소의 0.9배(실제 데이터에서 칸 채우기로 들어간 꼴)
    ]
    const plan = radarPlan(prepareFeed({ channels: chs, videos: vids }, NOW), { now: NOW })
    const o = plan.picks.find((x) => x.topicId === 'policy_fund')!
    check('Q4 좋은 영상이 하나면 하나만(항상 3편 아님)', !!o && o.benchmarks.length === 1 && o.benchmarks[0].id === 'b1_t', o?.benchmarks.map((v) => [v.id, v.ratio]))
    check('Q5 평소의 1배 아래(0.9배) 영상은 칸을 채우려고 넣지 않는다', !!o && o.benchmarks.every((v) => (v.ratio ?? 0) >= 1))
    const many = radarVideos(prepareFeed({ channels: [ch('m1', 'a', 1, 1), ch('m2', 'b', 1, 1), ch('m3', 'c', 1, 1), ch('m4', 'd', 1, 1)], videos: [...base('m1', 6, 1_000), ...base('m2', 6, 1_000), ...base('m3', 6, 1_000), ...base('m4', 6, 1_000), ...['m1', 'm2', 'm3', 'm4'].map((c, i) => vid(`${c}_t`, c, '정책자금 이야기', (8 + i) * D, 5_000 + i))] }, NOW), { now: NOW })
    check('Q4 좋은 영상이 많아도 3편까지 · 채널마다 한 편 먼저', pickBenchmarks({ hits: many.filter((v) => v.topics.includes('policy_fund')) }).length === 3 && new Set(pickBenchmarks({ hits: many.filter((v) => v.topics.includes('policy_fund')) }).map((v) => v.channelId)).size === 3)
  }

  // Q6 — 묶음 크기 보정: 직접 경쟁 19곳 중 5곳 vs AI 실무 8곳 중 4곳 → AI 쪽이 더 촘촘한 신호
  {
    const direct = Array.from({ length: 19 }, (_, i) => ch(`d${i}`, `직접${i}`, 50_000, 1))
    const ai = Array.from({ length: 8 }, (_, i) => aich(`a${i}`, `에이아이${i}`))
    const vids = [
      ...direct.flatMap((c) => base(c.id, 5, 1_000)),
      ...ai.flatMap((c) => base(c.id, 5, 1_000)),
      ...[0, 1, 2, 3, 4].map((i) => vid(`d${i}_t`, `d${i}`, '정책자금 직접대출 열렸다', (8 + i) * D, i === 0 ? 5_000 : 1_300)),
      ...[0, 1, 2, 3].map((i) => vid(`a${i}_t`, `a${i}`, '클로드로 업무 정리', (8 + i) * D, i === 0 ? 5_000 : 1_300)),
    ]
    const plan = radarPlan(prepareFeed({ channels: [...direct, ...ai], videos: vids }, NOW), { now: NOW })
    const pf = plan.clusters.find((c) => c.topicId === 'policy_fund')!
    const cl = plan.clusters.find((c) => c.topicId === 'claude')!
    check('Q6 묶음마다 "n곳 중 m곳" — 직접 경쟁 19곳 중 5곳 · AI 실무 8곳 중 4곳', pf.coverage.some((g) => g.group === 'direct' && g.covered === 5 && g.total === 19) && cl.coverage.some((g) => g.group === 'ai' && g.covered === 4 && g.total === 8), [pf.coverage, cl.coverage])
    check('Q6 같은 세기 · 같은 터진 수면 비율이 높은 AI 쪽이 먼저(채널 수가 많다는 이유만으로 시장수요가 앞서지 않음)', pf.strength === cl.strength && pf.breakouts === cl.breakouts && pf.channels14 > cl.channels14 && clusterOrder(cl, pf) < 0 && plan.picks[0].topicId === 'claude', plan.picks.map((o) => o.key))
    check('Q6 카드 핵심 근거에 "AI 실무 채널 8곳 중 4곳" 이 그대로(점수 0~100 없음)', plan.picks[0].facts.some((f) => f.includes('AI 실무 채널 8곳 중 4곳')) && plan.picks.every((o) => o.facts.every((f) => !/\d+점/.test(f))), plan.picks[0].facts)
    check('비중 가이드는 안내: 앞 5개에 한 종류가 몰리지 않는다(시장 3 · AX·AI 3 · BRIDGE 2 까지)', ['market', 'axai', 'bridge'].every((a, i) => plan.picks.slice(0, 5).filter((o) => o.axis === a).length <= [3, 3, 2][i]), plan.picks.map((o) => o.axis))
  }

  // Q7 — 한 채널이 여러 편 올려도 여러 채널 흐름으로 세지 않는다
  {
    const chs = [ch('s1', '혼자채널', 10_000, 1), ch('s2', '다른채널', 10_000, 1), ch('s3', '셋째채널', 10_000, 1)]
    const vids = [...base('s1', 6, 1_000), ...base('s2', 6, 1_000), ...base('s3', 6, 1_000), ...Array.from({ length: 6 }, (_, i) => vid(`s1_${i}`, 's1', `가업승계 이야기 ${i}`, (8 + i) * D, 4_000)), vid('s2_x', 's2', '가업승계 한 편', 9 * D, 1_000)]
    const su = radarPlan(prepareFeed({ channels: chs, videos: vids }, NOW), { now: NOW }).clusters.find((c) => c.topicId === 'succession')!
    check('Q7 한 채널 6편 + 다른 채널 1편 → 초기 신호 · 채널 수는 2곳(편수가 아니라 채널)', su.strength === 'early' && su.channels30 === 2 && su.coverage.every((g) => g.covered <= 2) && !!su.dominant, su)
  }

  // 왜 지금 한 문장 · 핵심 근거 2개
  {
    const chs = [ch('w1', 'w하나', 10_000, 1), ch('w2', 'w둘', 10_000, 1), ch('w3', 'w셋', 10_000, 1)]
    const vids = [...base('w1', 6, 1_000), ...base('w2', 6, 1_000), ...base('w3', 6, 1_000), vid('w1_t', 'w1', '절세 놓치면 손해', 8 * D, 6_000), vid('w2_t', 'w2', '법인세 줄이는 법', 9 * D, 1_200), vid('w3_t', 'w3', '세금 신고 전에 볼 것', 10 * D, 1_300)]
    const o = radarPlan(prepareFeed({ channels: chs, videos: vids }, NOW), { now: NOW }).picks[0]
    check('U5 왜 지금 = 사람이 읽는 한 문장(규칙) — "최근 2주 동안 3개 채널에서 반복해서 다뤘고, 평소보다 크게 터진 영상이 1편 나왔습니다."', o.summary === '최근 2주 동안 3개 채널에서 반복해서 다뤘고, 평소보다 크게 터진 영상이 1편 나왔습니다.', o.summary)
    check('U5 핵심 근거는 2개까지 · 나머지 숫자는 근거(whyNow · cluster)에 그대로', o.facts.length >= 1 && o.facts.length <= 2 && o.whyNow.length >= 2 && o.cluster.videos30 === 3, o.facts)
  }

  // U10 · U11 — 관심 없음 · 숨긴 주제 되살리기(정확히 그 후보만)
  {
    const chs = [ch('p1', '정책하나', 10_000, 1), ch('p2', '정책둘', 12_000, 1), ch('p3', '정책셋', 15_000, 1), { ...ch('ai1', '에이아이하나', 8_000, 1), group: 'ai' }, { ...ch('ai2', '에이아이둘', 9_000, 1), group: 'ai' }]
    const vids = [
      ...base('p1', 6, 1_000), ...base('p2', 6, 1_000), ...base('p3', 6, 1_000), ...base('ai1', 6, 1_000), ...base('ai2', 6, 1_000),
      vid('p1_t', 'p1', '지원사업 선정되는 사업계획서', 8 * D, 5_000), vid('p2_t', 'p2', '정부지원사업 공고 정리', 9 * D, 1_200), vid('p3_t', 'p3', '지원사업 떨어지는 이유', 10 * D, 1_300),
      vid('ai1_t', 'ai1', 'Claude로 보고서 써봤습니다', 8 * D, 6_000), vid('ai2_t', 'ai2', 'Claude 업무에 써보니', 9 * D, 1_500),
    ]
    const p = prepareFeed({ channels: chs, videos: vids }, NOW)
    const all = radarPlan(p, { now: NOW })
    const muted = radarPlan(p, { now: NOW, muted: ['market:grant_program'] })
    check('U10 관심 없음 → 그 후보는 다음 추천에서 빠진다', all.picks.some((o) => o.key === 'market:grant_program') && !muted.picks.some((o) => o.key === 'market:grant_program') && muted.muted.includes('market:grant_program'))
    check('U10 정확히 그 후보만 — 같은 주제의 BRIDGE · 다른 주제(Claude)는 그대로', muted.picks.some((o) => o.key === 'bridge:grant_program') && muted.picks.some((o) => o.topicId === 'claude'), muted.picks.map((o) => o.key))
    check('U11 숨긴 주제 되살리기(목록에서 빼면 다시 나온다)', radarPlan(p, { now: NOW, muted: [] }).picks.some((o) => o.key === 'market:grant_program'))
    const np = normalizePrefs({ muted: ['market:grant_program', 'market:grant_program', '<script>', 'axai:claude', 'weird:x', 42] })
    check('U11 숨긴 후보 저장 모양 — 겹침 · 이상한 값은 버림 · 예전 기록(muted 없음)은 빈 목록', np.muted.join() === 'market:grant_program,axai:claude' && normalizePrefs({}).muted.length === 0)
    await savePrefs('ws-M', { ...normalizePrefs({}), muted: ['axai:claude'] })
    check('U11 숨긴 후보도 작업공간마다(다른 작업공간에는 없음)', (await loadPrefs('ws-M')).muted.join() === 'axai:claude' && (await loadPrefs('ws-N')).muted.length === 0)

    // U8 · U9 — 이번 주로 확정 = 수첩에 '제작 예정' · 이미 있으면 줄을 새로 만들지 않는다
    const o = all.picks[0]
    const c1 = confirmInput(o, [])
    const saved = await saveIdea('ws-C', c1.input)
    check('U8 이번 주로 확정 → 기존 수첩(ContentIdea)에 단계 "제작 예정"(selected)', !c1.existed && saved.status === 'selected' && saved.key === o.key && (await listIdeas('ws-C')).length === 1)
    const back = await listIdeas('ws-C')
    await saveIdea('ws-C', { ...back[0], status: 'idea' })
    const c2 = confirmInput(o, await listIdeas('ws-C'))
    await saveIdea('ws-C', c2.input)
    const after = await listIdeas('ws-C')
    check('U9 이미 담긴 아이디어면 줄을 새로 만들지 않고 단계만 바꾼다', c2.existed && c2.changed && after.length === 1 && after[0].id === saved.id && after[0].status === 'selected', after.map((i) => [i.id, i.status]))
    await saveIdea('ws-C', { ...after[0], status: 'filmed' })
    const c3 = confirmInput(o, await listIdeas('ws-C'))
    check('U9 이미 촬영까지 간 것은 단계를 되돌리지 않는다', c3.existed && !c3.changed && c3.input.status === 'filmed')
    check('이번 주 제작 예정 줄: 제작 예정만 · 3개까지', selectedIdeas([{ ...after[0], status: 'selected' }, { ...after[0], id: 'b', status: 'idea' }, { ...after[0], id: 'c', status: 'selected' }, { ...after[0], id: 'd', status: 'selected' }, { ...after[0], id: 'e', status: 'selected' }]).length === 3)
  }
}

/* ---------------- [채널 추가] — 로그인 확인 · 저렴한 호출만(D-194) ---------------- */
{
  const ENV = process.env as Record<string, string | undefined>
  ENV.YOUTUBE_API_KEY = KEYVAL
  check('채널 주소 읽기: @주소 · youtube.com/@주소 · /channel/UC… · UC… · /c/이름 · 그냥 이름 · 이상한 글은 null', parseChannelInput('@abc')?.handle === '@abc' && parseChannelInput('https://www.youtube.com/@오늘쓰는AI/videos')?.handle === '@오늘쓰는AI' && parseChannelInput('https://youtube.com/channel/UCgi5InkiecEitESPWd-n0vA')?.id === 'UCgi5InkiecEitESPWd-n0vA' && parseChannelInput('UCgi5InkiecEitESPWd-n0vA')?.id === 'UCgi5InkiecEitESPWd-n0vA' && parseChannelInput('youtube.com/c/somename')?.username === 'somename' && parseChannelInput('routeai')?.handle === '@routeai' && parseChannelInput('<script>') === null && parseChannelInput('') === null)
  check('주소 칸: extra 는 UC 번호 1~10개 · 겹치면 안 됨 · resolve 는 하나', checkQuery(new URLSearchParams('extra=UCgi5InkiecEitESPWd-n0vA')).ok && !checkQuery(new URLSearchParams('extra=abc')).ok && !checkQuery(new URLSearchParams(`extra=${Array(11).fill(0).map((_, i) => `UC${String(i).padStart(22, 'x')}`).join(',')}`)).ok && !checkQuery(new URLSearchParams('extra=UCgi5InkiecEitESPWd-n0vA,UCgi5InkiecEitESPWd-n0vA')).ok && !checkQuery(new URLSearchParams('resolve=@a&slot=x')).ok)
  delete ENV.SUPABASE_URL
  delete ENV.VITE_SUPABASE_URL
  calls.length = 0
  const noCfg = await call('?resolve=@abc', { authorization: `Bearer ${GOOD_TOKEN}` })
  check('[채널 추가] 서버에 로그인 확인 설정이 없으면 503 · 유튜브를 부르지 않는다', noCfg.code === 503 && (noCfg.body as { error: string }).error === 'no_auth_config' && calls.length === 0)
  ENV.VITE_SUPABASE_URL = 'https://proj.supabase.test'
  ENV.VITE_SUPABASE_ANON_KEY = 'anon-public-key'
  const anon = await call('?resolve=@abc')
  const badTok = await call('?resolve=@abc', { authorization: 'Bearer wrong-token-0123456789abcdef' })
  const ex401 = await call('?extra=UCgi5InkiecEitESPWd-n0vA')
  check('[채널 추가] 로그인 안 하면 401 — 아무나 주소를 바꿔 가며 할당량을 쓰지 못함 · 유튜브 호출 0', anon.code === 401 && badTok.code === 401 && ex401.code === 401 && calls.length === 0 && anon.headers['cache-control'] === 'no-store')
  const ok = await call('?resolve=https://www.youtube.com/@routeai', { authorization: `Bearer ${GOOD_TOKEN}` })
  const ch1 = (ok.body as { channel: { id: string; title: string; subs: number }; units: number })
  check('[채널 추가] 로그인하면 채널 확인 — 채널 정보 1단위(검색 100단위 안 씀) · 키 값 없음 · 캐시 안 함', ok.code === 200 && ch1.channel.id === 'UC_routeai' && ch1.units === 1 && !calls.some((c) => c.startsWith('search')) && !JSON.stringify(ok.body).includes(KEYVAL) && ok.headers['cache-control'] === 'no-store', ok.body)
  const nf = await call('?resolve=@없는채널', { authorization: `Bearer ${GOOD_TOKEN}` })
  check('[채널 추가] 유튜브에 없는 주소 → 404 not_found(주소 · 예전 이름으로 2단위만) · 캐시 안 함', nf.code === 404 && (nf.body as { error: string; units: number }).error === 'not_found' && (nf.body as { units: number }).units === 2 && nf.headers['cache-control'] === 'no-store', nf.body)
  calls.length = 0
  const ex = await call(`?extra=UCnewchannel00000000000a,${CHANNELS[1].id}`, { authorization: `Bearer ${GOOD_TOKEN}` })
  const exb = ex.body as { channels: YtChannel[]; videos: YtVideoRaw[]; units: number }
  check('[채널 추가] 더한 채널 영상 — 기본 목록과 겹치는 채널은 다시 부르지 않음 · 채널마다 2단위 + 정보 1', ex.code === 200 && exb.channels.length === 1 && exb.channels[0].id === 'UCnewchannel00000000000a' && exb.videos.length === 50 && exb.units === 3 && ex.headers['cache-control'] === 'no-store', { units: exb.units, ch: exb.channels.map((c) => c.id) })
}

/* ---------------- 6시간 자동 갱신 · 채널 구성 판(D-196) ---------------- */
{
  const ENV = process.env as Record<string, string | undefined>
  ENV.YOUTUBE_API_KEY = KEYVAL
  mode = 'ok'
  // 예전 18채널(직접 경쟁 19곳 중 앞 18곳 — Production PC 에 남아 있던 것과 같은 수)
  const old18 = CHANNELS.slice(0, 18)
  const REV18 = feedRevisionOf(old18)
  check('판: 같은 설정이면 늘 같은 값 · 꼴 "응답판-채널수-요약값"(2-49-…)', FEED_REVISION === feedRevisionOf() && feedRevisionOf(CHANNELS.map((c) => ({ ...c }))) === FEED_REVISION && /^2-49-[0-9a-z]+$/.test(FEED_REVISION), FEED_REVISION)
  check(
    '판: 18채널 ≠ 49채널 · 묶음 하나만 바뀌어도 ≠ · 응답 판이 바뀌면 ≠ · 채널 순서 ≠ · 이름/메모만 바뀌면 같다(결과에 영향 없는 칸)',
    REV18 !== FEED_REVISION &&
      /^2-18-/.test(REV18) &&
      feedRevisionOf(CHANNELS.map((c, i) => (i === 20 ? { ...c, group: 'ax' } : c))) !== FEED_REVISION &&
      feedRevisionOf(CHANNELS, FEED_SCHEMA + 1) !== FEED_REVISION &&
      feedRevisionOf([...CHANNELS].reverse()) !== FEED_REVISION &&
      feedRevisionOf(CHANNELS.map((c) => ({ ...c, name: '다른 이름', note: '다른 메모' }))) === FEED_REVISION,
  )

  // 서버
  calls.length = 0
  const st = await call('?status=1')
  const sb = st.body as { configured: boolean; channels: number; feedRevision: string }
  check('8 status=1: configured · 채널 49 · feedRevision — 유튜브 호출 0(할당량 0) · 키 값 없음 · 캐시 안 함', st.code === 200 && sb.configured && sb.channels === NCH && sb.feedRevision === FEED_REVISION && calls.length === 0 && !JSON.stringify(sb).includes(KEYVAL) && st.headers['cache-control'] === 'no-store', sb)
  const w = serverWindowOf()
  const win = await call(`?win=${w}&rev=${FEED_REVISION}`)
  const wb = win.body as { feedRevision: string; channels: YtChannel[] }
  const wMax = Number(/s-maxage=(\d+)/.exec(win.headers['cache-control'] ?? '')?.[1] ?? -1)
  check('6시간 칸(?win=&rev=): 200 · 49채널 · 응답에 판 · 그 칸이 끝날 때까지만 캐시(6시간 이하)', win.code === 200 && wb.feedRevision === FEED_REVISION && wb.channels.length === NCH && Math.abs(wMax - secondsUntilWindowEnd()) <= 2 && wMax <= 6 * 3600, win.headers['cache-control'])
  calls.length = 0
  const r409 = await call(`?win=${w}&rev=${REV18}`)
  check('판이 다르면 409 + 지금 판 · 유튜브를 부르지 않는다(아무 rev 로 캐시를 비켜 가며 할당량을 쓰지 못함) · 캐시 안 함', r409.code === 409 && (r409.body as { feedRevision: string }).feedRevision === FEED_REVISION && calls.length === 0 && r409.headers['cache-control'] === 'no-store', r409.body)
  const fr2 = await call(`?bucket=${Math.floor(Date.now() / 1_800_000)}&rev=${FEED_REVISION}`)
  check('9 [지금 새로](?bucket=&rev=) — 30분 캐시 그대로 · 응답에 판', fr2.code === 200 && fr2.headers['cache-control'] === 'public, max-age=0, s-maxage=1800' && (fr2.body as { feedRevision: string }).feedRevision === FEED_REVISION)
  calls.length = 0
  for (const bad of [`?rev=${FEED_REVISION}`, `?status=1&rev=${FEED_REVISION}`, `?slot=${slot}&rev=${FEED_REVISION}`, `?win=${w + 1}`, `?win=${w - 2}`, '?win=abc', `?win=${w}&win=${w}`, `?win=${w}&rev=a&rev=b`, `?win=${w}&bucket=${bucket}`, `?win=${w}&x=1`]) {
    const r = await call(bad)
    check(`6시간 칸 주소 검사 400 ${bad}`, r.code === 400 && r.headers['cache-control'] === 'no-store')
  }
  check('6시간 칸 400 은 유튜브를 부르지 않는다', calls.length === 0)
  check(
    '6시간 칸: 지금 · 바로 앞 칸만 · 세계 표준시 6시(한국 15시)에 바뀜 · 남은 초(최소 60)',
    checkQuery(new URLSearchParams(`win=${w - 1}`)).ok &&
      serverWindowOf(Date.parse('2026-10-14T05:59:59Z')) + 1 === serverWindowOf(Date.parse('2026-10-14T06:00:00Z')) &&
      secondsUntilWindowEnd(Date.parse('2026-10-14T05:59:30Z')) === 60 &&
      secondsUntilWindowEnd(Date.parse('2026-10-14T00:00:00Z')) === 21_600 &&
      serverWindowOf(Date.parse('2026-10-14T07:00:00Z')) === windowOf(Date.parse('2026-10-14T07:00:00Z')),
  )

  // 화면 저장소 — 브라우저 fetch 를 진짜 서버 함수로 잇는다(유튜브만 흉내)
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  }
  const ytMock = globalThis.fetch
  const asked: string[] = []
  let netDown = false
  let statusRev: string | null = null // 배포가 막 바뀐 때 흉내(서버가 예전 판을 알려 줌)
  let statusHtml = false // 함수가 없는 곳(로컬 미리보기) 흉내
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const u = new URL(String(input), 'https://os.test')
    if (u.hostname !== 'os.test') return ytMock(input, init)
    asked.push(u.search)
    if (netDown) throw new TypeError('Failed to fetch')
    if (statusHtml && u.searchParams.has('status')) return new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })
    const res = await call(u.search)
    const body = statusRev && u.searchParams.has('status') ? { ...(res.body as object), feedRevision: statusRev } : res.body
    return new Response(JSON.stringify(body), { status: res.code, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  const H6 = FRESH_MS
  const feedOf = (n: number, at: number) => ({ fetchedAt: new Date(at).toISOString(), channels: CHANNELS.slice(0, n).map((c) => ch(c.id, c.name, 1000, 10_000)), videos: [vid('old1', CHANNELS[0].id, '예전에 받은 영상', 3 * D, 500)], failed: [] })
  const KEY = 'axmvp.yt.feed.v1'
  const begin = (cache: unknown) => {
    store.clear()
    if (cache) store.set(KEY, JSON.stringify(cache))
    asked.length = 0
    calls.length = 0
    netDown = false
    statusRev = null
    statusHtml = false
    mode = 'ok'
    resetYtForTest()
  }
  const feedAsks = () => asked.filter((q) => !q.includes('status=1'))
  const snap = () => ytSnapshot()

  // 1 · 2 · 3 같은 날짜의 18채널 예전 저장본(예전 모양 { slot, feed }) + 서버 판은 49채널 → 열자마자 버리고 49채널
  const now0 = Date.now()
  begin({ slot: new Date(now0).toISOString().slice(0, 10), feed: feedOf(18, now0 - 3_600_000) })
  await ensureYt()
  const saved = readCache()
  check(
    '1~3 같은 날 18채널 예전 저장본 + 서버 판 49채널 → 열자마자 새로 받음 → 49채널 · 저장본도 { 받은 때 · 판 · 데이터 }',
    snap().status === 'ready' && snap().feed?.channels.length === NCH && snap().feedRevision === FEED_REVISION && saved?.feedRevision === FEED_REVISION && saved?.feed.channels.length === NCH && typeof JSON.parse(store.get(KEY) ?? '{}').fetchedAt === 'number',
    { st: snap().status, n: snap().feed?.channels.length, asked },
  )
  check('1~3 묻는 순서: 판 확인(status) 한 번 → 6시간 칸 + 지금 판(?win=…&rev=…) 한 번', asked.length === 2 && asked[0] === '?status=1' && asked[1] === `?win=${windowOf()}&rev=${encodeURIComponent(FEED_REVISION)}`, asked)

  // 4 5시간 59분 된 저장본(판 같음) → 다시 쓰고 유튜브 · 데이터 요청 0
  begin({ fetchedAt: Date.now() - (H6 - 60_000), feedRevision: FEED_REVISION, feed: feedOf(NCH, Date.now() - (H6 - 60_000)) })
  await ensureYt()
  check('4 5시간 59분 된 저장본 → 그대로 씀 · 데이터 요청 0 · 유튜브 호출 0(판 확인만)', snap().status === 'ready' && snap().feed?.videos[0]?.id === 'old1' && feedAsks().length === 0 && calls.length === 0 && asked.join() === '?status=1', asked)

  // 6 열어 둔 채로 6시간이 지남 → 돌아올 때(focus · visible 이 부르는 ensureYt) 새로 받는다
  const tFocus = Date.now()
  begin({ fetchedAt: tFocus - H6 + 1500, feedRevision: FEED_REVISION, feed: feedOf(NCH, tFocus - H6 + 1500) })
  let fakeNow = tFocus
  resetYtForTest(() => fakeNow)
  await ensureYt()
  const beforeFocus = feedAsks().length
  fakeNow = tFocus + 2000
  await ensureYt()
  check('6 열어 둔 채로 6시간이 지남 → 돌아오면 새로 받음(열 때 0번 → 돌아올 때 1번) · 판 확인은 10분에 한 번(다시 묻지 않음)', beforeFocus === 0 && feedAsks().length === 1 && snap().feed?.videos[0]?.id !== 'old1' && asked.filter((q) => q === '?status=1').length === 1, asked)
  await ensureYt()
  await ensureYt()
  check('6 곧바로 또 돌아와도(focus 여러 번) 다시 받지 않는다 — 시계로 계속 묻지 않음', feedAsks().length === 1, asked)

  // 5 6시간 지난 저장본 → 열자마자 새로
  begin({ fetchedAt: Date.now() - H6 - 60_000, feedRevision: FEED_REVISION, feed: feedOf(NCH, Date.now() - H6 - 60_000) })
  await ensureYt()
  check('5 6시간 1분 된 저장본 → 열자마자 새로 받음(?win=)', feedAsks().length === 1 && /^\?win=\d+&rev=/.test(feedAsks()[0]) && snap().feed?.videos[0]?.id !== 'old1' && snap().status === 'ready', asked)

  // 7 판이 바뀜 → 1시간 전 것이어도 새로
  begin({ fetchedAt: Date.now() - 3_600_000, feedRevision: REV18, feed: feedOf(18, Date.now() - 3_600_000) })
  await ensureYt()
  check('7 판이 바뀜(18채널 판 → 49채널 판) → 1시간 전 것이어도 바로 새로 받음 → 49채널', feedAsks().length === 1 && snap().feed?.channels.length === NCH && snap().feedRevision === FEED_REVISION, asked)

  // 판 확인과 데이터 요청 사이에 배포가 바뀜(409) → 서버가 알려 준 판으로 한 번만 다시
  begin(null)
  statusRev = REV18
  await ensureYt()
  check('판 확인과 받기 사이에 배포가 바뀜 → 409 → 서버가 알려 준 판으로 한 번만 다시 → 49채널', feedAsks().length === 2 && feedAsks()[0].endsWith(`rev=${encodeURIComponent(REV18)}`) && feedAsks()[1].endsWith(`rev=${encodeURIComponent(FEED_REVISION)}`) && snap().feed?.channels.length === NCH && readCache()?.feedRevision === FEED_REVISION, asked)

  // 판을 알 수 없는 곳(함수 없음) → 6시간만 본다(예전 저장본도 6시간 안이면 그대로)
  begin({ slot: new Date().toISOString().slice(0, 10), feed: feedOf(18, Date.now() - 3_600_000) })
  statusHtml = true
  await ensureYt()
  check('판을 알 수 없으면(함수가 없는 곳) 6시간만 본다 — 1시간 된 저장본 그대로 · 데이터 요청 0', snap().status === 'ready' && snap().feed?.channels.length === 18 && feedAsks().length === 0, asked)

  // 9 [지금 새로 가져오기] — 6시간 안이어도 30분 칸으로 새로
  begin({ fetchedAt: Date.now() - 60_000, feedRevision: FEED_REVISION, feed: feedOf(NCH, Date.now() - 60_000) })
  await ensureYt()
  await refreshYt()
  check('9 [지금 새로 가져오기] → 1분 전 것이어도 새로(?bucket=…&rev=…) · 열 때는 받지 않음', feedAsks().length === 1 && /^\?bucket=\d+&rev=/.test(feedAsks()[0]) && snap().feed?.videos[0]?.id !== 'old1' && snap().status === 'ready', asked)

  // 10 저절로 받기 실패 → 지난번 것 그대로 + 받은 때
  const oldAt = Date.now() - H6 - 3_600_000
  begin({ fetchedAt: oldAt, feedRevision: FEED_REVISION, feed: feedOf(NCH, oldAt) })
  mode = 'quota'
  await ensureYt()
  const m = snap().message
  check('10 6시간 넘은 저장본 + 유튜브 한도 초과 → 빈 화면 아님: 지난번 것 그대로 · "지난번 받은 데이터로 보여드리고 있습니다." · 받은 때', snap().feed?.videos[0]?.id === 'old1' && snap().feed?.channels.length === NCH && m.startsWith('지난번 받은 데이터로 보여드리고 있습니다.') && m.includes(`받은 때 ${kstWhen(oldAt)}`) && m.includes('한도') && snap().status === 'quota', m)
  mode = 'ok'
  await ensureYt()
  check('10 실패 뒤 곧바로 돌아와도 다시 두드리지 않는다(5분 뒤)', feedAsks().length === 1, asked)
  begin({ fetchedAt: oldAt, feedRevision: FEED_REVISION, feed: feedOf(NCH, oldAt) })
  netDown = true
  await ensureYt()
  check('10 인터넷이 끊겨도(판 확인도 실패) 지난번 것 그대로 + 받은 때', snap().feed?.videos[0]?.id === 'old1' && snap().message.startsWith('지난번 받은 데이터로 보여드리고 있습니다.') && snap().message.includes('인터넷'), snap().message)
  begin(null)
  mode = 'quota'
  await ensureYt()
  check('10 지난번 것도 없으면 안내만(지난번 문구 없음)', snap().feed === null && snap().status === 'quota' && !snap().message.includes('지난번 받은'), snap().message)
  mode = 'ok'
  check('6시간 판정: 없음 · 6시간 정각 · 판 다름 → 다시 / 5시간 59분 · 판 모름 → 그대로', isStale(null, null) && isStale({ fetchedAt: 0, feedRevision: 'a' }, null, H6) && isStale({ fetchedAt: 0, feedRevision: 'a' }, 'b', 1000) && !isStale({ fetchedAt: 0, feedRevision: 'a' }, 'a', H6 - 60_000) && !isStale({ fetchedAt: 0, feedRevision: '' }, null, 1000))

  globalThis.fetch = ytMock
  resetYtForTest()
}


/* ---------------- D-197 경제 · 경영 · AI 집중 · 사이드 급상승 F1~F20 ---------------- */
{
  const baseOf = (chId: string, n: number, views: number, d = 600, from = 10) => Array.from({ length: n }, (_, i) => vid(`${chId}_b${i}`, chId, `평범한 이야기 ${chId} ${i}`, (from + i * 3) * D, views + i, d))
  const doms = (t: string) => domainsOf(topicsOf(t))

  // F1 경제 — 금리 · 환율 · 부동산 · 주식 · 경제 정책(정치 일반 뉴스는 아님)
  check(
    'F1 경제: 금리 → 중소기업 대출 · 환율 · 부동산 · 주식 인터뷰 · 세법 개정은 경제 / 정치 일반 뉴스는 경제 아님',
    topicsOf('금리 인하, 중소기업 대출 이자 얼마나 줄까').includes('rate') &&
      doms('환율 1500원 시대 수입 원가 이렇게').includes('economy') &&
      doms('사옥을 살까 임대할까').includes('economy') &&
      doms("2027년 주도주 완전히 바뀐다, '이 3개 주식' 모아가면 큰돈 번다 (박세익 대표 풀버전)").includes('economy') &&
      doms('삼성전자 정말 무서울 겁니다, 100년에 1번 나오는 폭등').includes('economy') &&
      doms('2027년 세법 개정안 총정리').includes('economy') &&
      doms('대선 여론조사 결과 총정리').join() === 'other' &&
      !topicsOf('비상장주식 가치평가 이렇게').includes('stocks'),
    [topicsOf("2027년 주도주 완전히 바뀐다, '이 3개 주식' 모아가면 큰돈 번다"), doms('대선 여론조사 결과 총정리'), topicsOf('비상장주식 가치평가 이렇게')],
  )
  // F2 경영
  check(
    'F2 경영: 정책자금 · 절세 · 고용지원금 · 인사 · 마케팅은 경영(경제 아님)',
    doms('정책자금 신청 전 꼭 볼 것').join() === 'business' && doms('법인 절세 방법 5가지').join() === 'business' && doms('청년 고용지원금 받는 법').join() === 'business' && doms('직원 채용 · 연봉 협상 이렇게').includes('business'),
    [doms('정책자금 신청 전 꼭 볼 것'), doms('직원 채용 · 연봉 협상 이렇게')],
  )
  // F3 AI
  check('F3 AI: 업무자동화 · AI 에이전트 · 바이브코딩은 AI 영역', doms('AI로 업무 자동화하는 법').join() === 'ai' && doms('AI 에이전트로 비서 만들기').join() === 'ai' && doms('바이브코딩으로 앱 만들기').join() === 'ai', [doms('AI로 업무 자동화하는 법'), doms('AI 에이전트로 비서 만들기')])
  // F4 Claude
  check(
    'F4 Claude: 클로드 · Claude · 오퍼스 · 소넷 → Claude 묶음(세부 이름은 따로 센다)',
    toolTopicsOf('클로드 오퍼스 써보니').join() === 'claude' && aiMentions('클로드 오퍼스 써보니').join() === 'claude,opus' && toolTopicsOf('Sonnet 새 버전 실무 후기').join() === 'claude' && topicsOf('Claude로 계약서 5분 요약').includes('claude'),
    [aiMentions('클로드 오퍼스 써보니'), toolTopicsOf('Sonnet 새 버전 실무 후기')],
  )
  // F5 ChatGPT
  check('F5 ChatGPT: 챗GPT · 챗지피티 · ChatGPT · GPTs → ChatGPT 묶음', toolTopicsOf('챗GPT로 보고서 만들기').join() === 'chatgpt' && toolTopicsOf('챗지피티 업무 활용').join() === 'chatgpt' && toolTopicsOf('GPTs 만들어 팔기').join() === 'chatgpt' && aiMentions('ChatGPT 업무 10가지').join() === 'chatgpt', [toolTopicsOf('GPTs 만들어 팔기')])
  // F6 Codex
  check('F6 Codex: 코덱스 · Codex → Codex 묶음(ChatGPT 묶음으로 세지 않음 · OpenAI 의 좁은 제품이 먼저)', toolTopicsOf('코덱스로 사내 도구 만들기').join() === 'codex' && toolTopicsOf('ChatGPT Codex 로 앱 만들어 봤다').join() === 'codex' && !topicsOf('코덱스로 사내 도구 만들기').includes('chatgpt'), [toolTopicsOf('ChatGPT Codex 로 앱 만들어 봤다')])
  // F7 Astra · Sol 은 데이터가 있을 때만
  {
    const chs = [{ ...ch('k1', '에이아이하나', 9_000, 1), group: 'ai' }, { ...ch('k2', '에이아이둘', 9_000, 1), group: 'ai' }]
    const none = radarVideos(prepareFeed({ channels: chs, videos: [...baseOf('k1', 5, 1_000), ...baseOf('k2', 5, 1_000), vid('k1_c', 'k1', 'Claude 업무 활용', 3 * D, 1_500), vid('k2_c', 'k2', '클로드 써보니', 4 * D, 1_500)] }, NOW), { now: NOW })
    const some = radarVideos(prepareFeed({ channels: chs, videos: [...baseOf('k1', 5, 1_000), ...baseOf('k2', 5, 1_000), vid('k1_a', 'k1', 'Astra 써보니 달라진 점', 3 * D, 1_500), vid('k2_a', 'k2', '아스트라로 회사 업무', 4 * D, 1_500), vid('k2_s', 'k2', 'GPT-6 Sol 직접 써봤습니다', 5 * D, 9_000)] }, NOW), { now: NOW })
    const kNone = aiKeywordBoard(none).map((k) => k.id)
    const kSome = aiKeywordBoard(some)
    check(
      'F7 Astra · Sol 은 최근 영상에 실제로 나올 때만 — 0편이면 칸이 없다 · 아스트라제네카는 Astra 아님',
      !kNone.includes('astra') && !kNone.includes('sol') && !kNone.includes('codex') && kNone.includes('claude') && kSome.find((k) => k.id === 'astra')?.videos === 2 && kSome.find((k) => k.id === 'astra')?.channels === 2 && kSome.some((k) => k.id === 'sol') && aiMentions('아스트라제네카 주가 전망').length === 0,
      [kNone, kSome.map((k) => `${k.id}:${k.videos}`)],
    )
  }
  // F8 · F9 섞이지 않음
  check(
    'F8 ChatGPT 영상은 Claude 묶음에 안 들어간다 · 둘을 비교하면 어느 쪽도 아니고 AI 업무 활용',
    !topicsOf('챗GPT로 보고서 만들기').includes('claude') && !topicsOf('ChatGPT vs Claude 무엇이 맞을까').includes('claude') && !topicsOf('ChatGPT vs Claude 무엇이 맞을까').includes('chatgpt') && topicsOf('ChatGPT vs Claude 무엇이 맞을까').includes('ai_work'),
    topicsOf('ChatGPT vs Claude 무엇이 맞을까'),
  )
  check('F9 Claude 영상은 Codex 묶음에 안 들어간다 · Codex 영상은 Claude 묶음에 안 들어간다', !topicsOf('Claude Code로 앱 만들기').includes('codex') && !topicsOf('Codex로 앱 만들기').includes('claude') && topicsOf('Codex와 Claude Code 비교').every((t) => t !== 'codex' && t !== 'claude'), [topicsOf('Claude Code로 앱 만들기'), topicsOf('Codex와 Claude Code 비교')])
  // F10 Gemini · NotebookLM(Google)
  check('F10 Gemini: 제미나이 · Gemini → Gemini 묶음 · NotebookLM 은 따로 · 둘 다 Google', toolTopicsOf('제미나이로 메일 정리').join() === 'gemini' && toolTopicsOf('노트북LM으로 회사 자료 정리').join() === 'notebooklm' && toolTopicsOf('Gemini와 NotebookLM 같이 쓰기').join() === 'gemini,notebooklm', [toolTopicsOf('Gemini와 NotebookLM 같이 쓰기')])

  // F11~F14 — 채널 묶음 피드(직접 경쟁 3 · AI 3 · 포맷 1 · 생활 1)
  const chs = [
    { ...ch('d1', '세금채널', 50_000, 1), group: 'direct' },
    { ...ch('d2', '자금채널', 50_000, 1), group: 'direct' },
    { ...ch('d3', '경영채널', 50_000, 1), group: 'direct' },
    { ...ch('a1', 'AI하나', 20_000, 1), group: 'ai' },
    { ...ch('a2', 'AI둘', 20_000, 1), group: 'ai' },
    { ...ch('a3', 'AI셋', 20_000, 1), group: 'ai' },
    { ...ch('f1', '대담채널', 900_000, 1), group: 'format', note: '전문가 인터뷰 · 대담 포맷' },
    { ...ch('o1', '생활채널', 100_000, 1), group: 'direct' },
  ]
  const vids = [
    ...baseOf('d1', 6, 1_000), ...baseOf('d2', 6, 1_000), ...baseOf('d3', 6, 1_000),
    ...baseOf('a1', 6, 1_000), ...baseOf('a2', 6, 1_000), ...baseOf('a3', 6, 1_000),
    ...baseOf('f1', 6, 10_000), ...baseOf('o1', 6, 5_000),
    vid('d1_t', 'd1', '정책자금 신청 전 꼭 볼 것', 3 * D, 5_000), vid('d2_t', 'd2', '정책자금 거절 이유 3가지', 4 * D, 4_500), vid('d3_t', 'd3', '올해 정책자금 달라진 점', 5 * D, 1_200),
    vid('a1_t', 'a1', 'Claude 로 계약서 요약', 3 * D, 6_000), vid('a2_t', 'a2', '클로드 업무 활용', 4 * D, 5_000), vid('a3_t', 'a3', 'Claude 써보니', 5 * D, 1_100),
    // 생활 채널 — 다이어트 영상이 여러 채널에서 크게 터져도 메인 후보가 되지 않는다(분류표 밖)
    vid('o1_x', 'o1', '다이어트 브이로그 30일 결과', 6 * D, 60_000), vid('d3_x', 'd3', '다이어트 브이로그 2주 차', 5 * D, 9_000),
    // 평범한 기타 영상(평소 수준)
    vid('o1_n', 'o1', '주말 캠핑 다녀왔습니다', 8 * D, 5_100),
    // 기타인데 3.5배(작은 채널도 아님 · 형식 반복 없음) — 사이드에도 안 뜬다
    vid('o1_m', 'o1', '여름 휴가 짐 싸기', 9 * D, 17_500),
    // 전문가 인터뷰 10배 — 사이드
    vid('f1_i', 'f1', '앞으로 10년 이렇게 바뀝니다 (김교수 풀버전)', 8 * D, 100_000),
  ]
  const p = prepareFeed({ channels: chs, videos: vids }, NOW)
  const rv = radarVideos(p, { now: NOW })
  const plan = radarPlan(p, { now: NOW }, rv)
  const byId = new Map(rv.map((v) => [v.id, v]))
  check(
    'F11 TOP 은 경제 · 경영 · AI 주제만 — 기타(다이어트) 영상이 크게 터져도 후보 · 묶음이 생기지 않는다',
    plan.picks.length > 0 && plan.picks.every((o) => o.domain !== 'other') && plan.clusters.every((c) => c.domain !== 'other') && byId.get('o1_x')?.domains.join() === 'other' && !breakoutVideos(rv).some((v) => v.id === 'o1_x'),
    [plan.picks.map((o) => `${o.topic}/${o.domain}`), byId.get('o1_x')?.domains],
  )
  const side = sideBreakouts(rv)
  check('F12 기타 영상이 평소의 5배 넘게 터지면 사이드 급상승에(포맷 · 훅 · 구성 참고 문장과 함께)', side.some((x) => x.v.id === 'o1_x' && x.notes.length > 0) && byId.get('o1_x')?.tier === 'breakout', side.map((x) => `${x.v.id}:${x.why}`))
  check(
    'F13 평범한 기타 영상(평소 수준 · 3.5배인 큰 채널 영상)은 사이드에도 안 뜬다 · 최대 5편 · 채널마다 1편',
    !side.some((x) => x.v.id === 'o1_n') && !side.some((x) => x.v.id === 'o1_m') && side.length <= 5 && new Set(side.map((x) => x.v.channelId)).size === side.length && !side.some((x) => x.v.id === 'd3_x' && side.some((y) => y.v.id === 'o1_x' && y.v.channelId === 'd3')),
    side.map((x) => `${x.v.id}:${(x.v.adjusted ?? 0).toFixed(1)}`),
  )
  const iv = side.find((x) => x.v.id === 'f1_i')
  check('F14 전문가 인터뷰(채널 메모 · 풀버전) 10배 → 사이드 · "전문가 인터뷰" 꼬리표 · 인터뷰 구성 참고', !!iv && iv.v.formats.includes('interview') && iv.notes.some((n) => n.includes('인터뷰')) && formatTagsOf('박세익 대표 풀버전 인터뷰').includes('interview'), iv)

  // F15 · F16 — 기본 벤치마킹 vs 내가 추가한 채널
  {
    const baseFeed = { fetchedAt: new Date(NOW).toISOString(), channels: [ch('b1', '기본채널', 10_000, 1)], videos: [vid('b1_v', 'b1', '정책자금 이야기', 3 * D, 100)], failed: [] }
    const extra = { fetchedAt: new Date(NOW).toISOString(), channels: [ch('x1', '더한채널', 10_000, 1)], videos: [vid('x1_v', 'x1', '클로드 이야기', 3 * D, 100)], failed: [] }
    const merged = mergeFeeds(baseFeed, extra, { x1: 'ai' })
    const mv = radarVideos(prepareFeed(merged, NOW), { now: NOW })
    check('F15 기본 채널 영상은 added=false · [채널 추가] 로 더한 채널 영상은 added=true(영상 상세 [기본 벤치마킹] · [내가 추가])', mv.find((v) => v.id === 'b1_v')?.added === false && mv.find((v) => v.id === 'x1_v')?.added === true && merged.channels.find((c) => c.id === 'x1')?.added === true, mv.map((v) => `${v.id}:${v.added}`))
  }
  check('F16 기본 채널 49곳 모두 "왜 보는 채널인지" 메모가 있다(8자 넘게) · 채널 번호 겹침 없음', CHANNELS.length === NCH && CHANNELS.every((c) => typeof c.note === 'string' && c.note.trim().length >= 8) && new Set(CHANNELS.map((c) => c.id)).size === NCH, CHANNELS.filter((c) => !c.note || c.note.length < 8).map((c) => c.handle))

  // F17 · F18 — 새 AI 키워드(보여 주기만)
  {
    const ai = (id: string, title: string) => ({ ...ch(id, title, 9_000, 1), group: 'ai' })
    const chs2 = [ai('n1', '에이아이 하나'), ai('n2', '에이아이 둘'), ai('n3', '에이아이 셋'), ai('n4', 'Nova Lab'), { ...ch('n5', '직접채널', 9_000, 1), group: 'direct' }]
    const v2 = [
      ...baseOf('n1', 5, 1_000), ...baseOf('n2', 5, 1_000), ...baseOf('n3', 5, 1_000), ...baseOf('n4', 5, 1_000), ...baseOf('n5', 5, 1_000),
      vid('n1_s', 'n1', 'Spark 로 회사 문서 정리', 2 * D, 900), vid('n2_s', 'n2', '새로 나온 Spark 써봤습니다', 3 * D, 900), vid('n3_s', 'n3', 'Spark 무료 사용법 #shorts', 4 * D, 900, 40),
      // 채널 이름에 든 말(Nova) — 세 채널에서 나와도 새 키워드가 아님
      vid('n4_n', 'n4', 'Nova 실험 1', 2 * D, 900), vid('n1_n', 'n1', 'Nova 써보니', 3 * D, 900), vid('n2_n', 'n2', 'Nova 후기', 3 * D, 900),
      // 흔한 말(shorts · free · tutorial) · 이미 아는 이름(Claude)은 새 키워드가 아님
      vid('n1_c', 'n1', 'Claude tutorial free', 2 * D, 900), vid('n2_c', 'n2', 'Claude tutorial free', 2 * D, 900), vid('n3_c', 'n3', 'Claude tutorial free', 2 * D, 900),
      // 직접 경쟁 채널에서만 나온 말은 세지 않는다(AI · AX 채널 기준)
      vid('n5_z', 'n5', 'Zeta 정책자금', 2 * D, 900),
    ]
    const p2 = prepareFeed({ channels: chs2, videos: v2 }, NOW)
    const rv2 = radarVideos(p2, { now: NOW })
    const nk = newAiKeywords(p2, rv2)
    check('F17 새 AI 키워드: 분류표에 없는 이름(Spark)이 최근 14일 AI 채널 3곳에서 → 후보(3채널 · 3편) — 분류표에 저절로 넣지 않음', nk.some((k) => k.word === 'Spark' && k.channels === 3 && k.videos === 3) && !TOPICS.some((t) => t.match.test(normalizeTitle(' spark '))), nk)
    check('F18 채널 이름(Nova) · 흔한 말(tutorial · free · shorts) · 이미 아는 이름(Claude) · AI 채널 밖 말(Zeta)은 새 키워드가 아니다', !nk.some((k) => /^(nova|tutorial|free|shorts|claude|zeta)$/i.test(k.word)), nk)
  }

  // F19 · F20
  check('F19 마케팅 · 콘텐츠 레이더는 여전히 대표 전용 — 팀장(Pilot) 메뉴에 없고 직접 주소도 막힘', isPilotHiddenPath('/marketing/youtube') && isPilotHiddenPath('/marketing') && enabledModulesByGroup({ pilot: true }).every((g) => g.items.every((m) => m.key !== 'marketing')) && enabledModulesByGroup({}).some((g) => g.items.some((m) => m.key === 'marketing')))
  check('F20 6시간 자동 갱신 그대로 — 6시간 · 채널이 49곳으로 바뀌어 판(2-49-…)이 달라져 열자마자 새로 받음(위 1~12 시험 그대로 통과)', FRESH_MS === 6 * H && /^2-49-/.test(FEED_REVISION) && FEED_REVISION === feedRevisionOf() && feedRevisionOf(CHANNELS.slice(0, 33)) !== FEED_REVISION, FEED_REVISION)

  // 추가 — 왜 추천됐나요 · 지금 강한 흐름 · 인기 탭 핵심/기타 · 흔한 말
  const top = plan.picks[0]
  const why = top ? whyRecommended(top) : []
  check('왜 추천됐나요: 다섯 가지(여러 채널 · 평소보다 잘됨 · 늘어남 · 작은 채널 · 경제·경영·AI) — 맞음/아님 + 사람 말 · 점수 없음', why.length === 5 && why.map((w) => w.id).join() === 'spread,hot,growing,small,domain' && why.every((w) => w.text.length > 5 && !/\d+\s*점/.test(w.text)) && why[4].met, why)
  const ds = domainSignals(plan.clusters)
  check('지금 강한 흐름: 데이터가 있는 영역만 채운다(경제 영상이 없으면 경제 칸은 비어 있음) · 경영 · AI 는 채워짐', ds.map((d) => d.domain).join() === 'economy,business,ai' && ds[0].items.length === 0 && ds[1].items.some((x) => x.topicId === 'policy_fund') && ds[2].items.some((x) => x.topicId === 'claude'), ds.map((d) => `${d.domain}:${d.items.map((x) => x.topicId)}`))
  check('인기 탭 핵심 키워드: 클로드 · 정책자금 · 부동산 = 핵심 / 다이어트 · 캠핑 = 기타 · 반드시 · 직장인을 · 충격적인 · 뒤집힌다 · 알아서 = 흔한 말', isCoreKeyword('클로드') && isCoreKeyword('정책자금') && isCoreKeyword('부동산') && !isCoreKeyword('다이어트') && !isCoreKeyword('캠핑') && isNoiseKeyword('반드시') && isNoiseKeyword('직장인을') && isNoiseKeyword('충격적인') && isNoiseKeyword('뒤집힌다') && isNoiseKeyword('알아서') && !isNoiseKeyword('가업승계 증여특례') && !isNoiseKeyword('고용지원금') && !isNoiseKeyword('부모님') && !isNoiseKeyword('바다'))
  check('사이드 급상승은 핵심 영상(경제 · 경영 · AI)을 넣지 않는다', side.every((x) => !isCore(x.v)))
}

/* ---------------- D-198 숫자 뒤 영상 목록 — 숫자 = 목록 길이 · 채널 수 = 목록 속 채널 수 ---------------- */
{
  const chCount = (vs: ReadonlyArray<{ channelId: string }>) => new Set(vs.map((v) => v.channelId)).size
  const num = (t: string, re: RegExp) => {
    const m = t.match(re)
    return m ? Number(m[m.length - 1]) : null
  }
  /** 후보 카드 핵심 근거 글의 숫자가 그 근거 영상 목록과 맞나 */
  const factOk = (text: string, hits: ReadonlyArray<{ channelId: string; tier: string; channelName: string }>) => {
    const cov = text.match(/(\d+)곳 중 (\d+)곳/)
    if (cov) return chCount(hits) === Number(cov[2])
    const chs = num(text, /(\d+)개 채널/)
    if (chs !== null) return chCount(hits) === chs
    if (/터진 영상 (\d+)편/.test(text)) return hits.length === num(text, /터진 영상 (\d+)편/) && hits.every((v) => v.tier === 'breakout')
    if (/잘된 영상 (\d+)편/.test(text)) return hits.length === num(text, /잘된 영상 (\d+)편/) && hits.every((v) => v.tier === 'breakout' || v.tier === 'above')
    if (/혼자 (\d+)편/.test(text)) return hits.length === num(text, /혼자 (\d+)편/) && chCount(hits) === 1
    if (/전체 (\d+)편/.test(text)) return hits.length === num(text, /전체 (\d+)편/)
    if (/(최근 2주|최근 7일) (\d+)편/.test(text)) return hits.length === num(text, /(?:최근 2주|최근 7일) (\d+)편/)
    if (/영상 (\d+)편/.test(text)) return hits.length === num(text, /영상 (\d+)편/)
    if (/아직 없음/.test(text)) return hits.length === 0
    return hits.length > 0 // '상승' — 그 AI 주제의 최근 영상
  }
  const runEvidence = (name: string, p: ReturnType<typeof prepareFeed>) => {
    const rv = radarVideos(p, { now: NOW })
    const plan = radarPlan(p, { now: NOW }, rv)
    const bad: string[] = []
    for (const o of plan.picks) {
      if (o.factHits.length !== o.facts.length) bad.push(`${o.key}: 근거 ${o.facts.length} / 목록 ${o.factHits.length}`)
      o.facts.forEach((f, i) => {
        if (!factOk(f, o.factHits[i] ?? [])) bad.push(`${o.key}: '${f}' ≠ ${o.factHits[i]?.length}편 · ${chCount(o.factHits[i] ?? [])}채널`)
      })
      const c = o.cluster
      if (c.hits.length !== c.videos30 || chCount(c.hits) !== c.channels30) bad.push(`${o.key}: 관련 영상 ${c.videos30} / ${c.hits.length}`)
      if (clusterHot(c).length !== c.breakouts) bad.push(`${o.key}: 터진 ${c.breakouts} / ${clusterHot(c).length}`)
      if (clusterRecent(c).length !== c.videos14 || chCount(clusterRecent(c)) !== c.channels14) bad.push(`${o.key}: 2주 ${c.videos14} / ${clusterRecent(c).length}`)
      for (const g of c.coverage) if (chCount(coverageHits(c, g.group)) !== g.covered || coverageHits(c, g.group).some((v) => v.group !== g.group)) bad.push(`${o.key}: ${g.group} ${g.covered}곳 / ${chCount(coverageHits(c, g.group))}`)
    }
    check(`E1 ${name}: 후보 카드 숫자(n곳 중 m곳 · n개 채널 · 터진 영상 n편 · 최근 2주 n편 …) = 그 숫자를 센 영상 목록 · 묶음별 'n곳 중 m곳' 도 같은 묶음 채널 수`, plan.picks.length > 0 && bad.length === 0, bad.slice(0, 6))

    const dbad: string[] = []
    for (const d of domainSignals(plan.clusters))
      for (const x of d.items) {
        if (x.recent.length !== x.videos14 || chCount(x.recent) !== x.channels14) dbad.push(`${x.topicId}: 2주 ${x.channels14}채널 · ${x.videos14}편 / ${chCount(x.recent)} · ${x.recent.length}`)
        if (x.hot.length !== x.breakouts || x.hot.some((v) => v.tier !== 'breakout')) dbad.push(`${x.topicId}: 터진 ${x.breakouts} / ${x.hot.length}`)
      }
    check(`E2 ${name}: 지금 강한 흐름 '2주 n개 채널 · m편' · '터진 영상 n' = 목록`, dbad.length === 0, dbad)

    const kw = aiKeywordBoard(rv)
    const kbad = kw.filter((k) => k.hits.length !== k.videos || chCount(k.hits) !== k.channels || k.hot.length !== k.breakouts || k.hits.some((v) => !v.aiKeywords.includes(k.id)) || k.hot.some((v) => v.tier !== 'breakout')).map((k) => k.id)
    check(`E3 ${name}: AI 핵심 키워드 'n개 채널 · m편' · '터진 영상 n' = 목록(목록 영상 제목에 그 이름이 실제로 있다)`, kbad.length === 0, kbad)

    const wf = aiWorkflowSignals(plan.clusters)
    check(`E4 ${name}: AI 업무 흐름 'n개 채널 · m편' = 목록`, wf.every((w) => w.hits.length === w.videos && chCount(w.hits) === w.channels), wf.map((w) => `${w.topicId}:${w.videos}/${w.hits.length}`))

    const rs = risingTopics(p, rv, plan.clusters)
    const rbad = rs.filter((r) => r.recent.length !== r.videos14 || chCount(r.recent) !== r.channels14 || r.hot.length !== r.breakouts).map((r) => `${r.label}(${r.fit ? '분류표' : '낱말'}): ${r.videos14}편 ${r.channels14}채널 터짐 ${r.breakouts} / ${r.recent.length} · ${chCount(r.recent)} · ${r.hot.length}`)
    check(`E5 ${name}: 급상승 주제(분류표 · 분류표 밖 낱말 모두) '2주 n편 · m채널' · '터진 영상 n' = 목록`, rs.length > 0 && rbad.length === 0, rbad)
    return { rv, plan }
  }
  const { rv: srv } = runEvidence('예시 데이터', prepareFeed(sampleFeed(NOW), NOW))

  // 새 AI 키워드 · 같은 제목에 두 번 나와도 한 편
  {
    const chs2 = [1, 2, 3].map((i) => ({ ...ch(`q${i}`, `에이아이${'가나다'[i - 1]}`, 9_000, 1), group: 'ai' }))
    const v2 = [
      vid('q1_s', 'q1', 'Orbit 써보니 Orbit 이 다릅니다', 2 * D, 900),
      vid('q2_s', 'q2', 'ORBIT 업무 활용', 3 * D, 900),
      vid('q3_s', 'q3', 'orbit 으로 보고서', 4 * D, 900),
      vid('q3_t', 'q3', 'Orbit 두 번째 후기', 5 * D, 900),
    ]
    const p2 = prepareFeed({ channels: chs2, videos: v2 }, NOW)
    const nk = newAiKeywords(p2, radarVideos(p2, { now: NOW })).find((k) => k.word.toLowerCase() === 'orbit')
    check(
      "E6 새 AI 키워드 'n개 채널 · m편' = 목록 · 한 제목에 두 번(Orbit … Orbit) 나와도 영상은 한 편 · 목록 제목에 그 말이 있다",
      !!nk && nk.videos === 4 && nk.hits.length === 4 && nk.channels === 3 && chCount(nk.hits) === 3 && nk.hits.every((v) => /orbit/i.test(v.title)),
      nk && { videos: nk.videos, hits: nk.hits.map((v) => v.id) },
    )
  }

  // 목록 순서 · 채널 칩
  const ord = evidenceOrder(srv.filter((v) => v.ageDays <= 30))
  const rank = (t: string) => ['breakout', 'above', 'normal', 'below', 'unknown'].indexOf(t)
  check('E7 영상 목록 순서: 터진 것 → 잘된 것 → 나머지(같은 등급은 배수 높은 순) · 원본 배열은 그대로', ord.every((v, i) => i === 0 || rank(ord[i - 1].tier) < rank(v.tier) || (rank(ord[i - 1].tier) === rank(v.tier) && (ord[i - 1].adjusted ?? -1) >= (v.adjusted ?? -1))) && ord.length === srv.filter((v) => v.ageDays <= 30).length)
  const chips = evidenceChannels(ord)
  check('E8 채널 칩: 영상 많은 순 · 칩 숫자 합 = 목록 길이 · 칩 수 = 목록 속 채널 수', chips.reduce((a, c) => a + c.count, 0) === ord.length && chips.length === chCount(ord) && chips.every((c, i) => i === 0 || chips[i - 1].count >= c.count))

  // 분석 탭 '단어로 본 주목 주제' — n개 채널 · 편수 = 센 영상
  const sp = prepareFeed(sampleFeed(NOW), NOW)
  const tps = extractTopics(periodVideos(sp.videos, 'month'), sp.channelWords)
  check("E9 단어로 본 주목 주제 'n개 채널' = 센 영상 속 채널 수 · 편수 = 목록 길이 · 최고 조회수 = 목록 첫 영상", tps.length > 0 && tps.every((t) => t.hits.length === t.videos && chCount(t.hits) === t.channels && t.hits[0]?.views === t.topViews), tps.map((t) => `${t.keyword}:${t.videos}/${t.hits.length}`))
}

console.log(`\nyoutube: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
