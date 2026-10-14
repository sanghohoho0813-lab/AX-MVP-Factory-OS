/**
 * 유튜브 벤치마킹 시험 (D-193).
 *  - 계산(ytBench): 기간 · 쇼츠 · 요일/시간(한국 시간) · 키워드(점수 · 2편 · 2채널 · 불용어 · 어미 · 채널명) · 주목 주제 · 제목 틀 ·
 *    순위 판 · 급상승 · 채널 현황 · 내 채널 비교 · 요일/시간/길이/롱폼·쇼츠/업로드 주기 · CSV
 *  - 예시 데이터: 같은 시각이면 같은 데이터 · 진짜 채널 이름 없음
 *  - 서버 함수(api/yt-bench.js): 유튜브를 흉내 낸 fetch 로 — 키 없음 · 주소 칸 검사 · 채널 하나 실패 · 할당량 · 틀린 키 · 캐시 · 키가 응답에 없음
 * 실행: npm run test:youtube
 */
import handler, { CHANNELS, checkQuery, parseDuration, secondsUntilNine } from '../../../api/yt-bench.js'
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
const call = async (q: string) => {
  const res = mkRes()
  await handler({ url: `/api/yt-bench${q}` }, res)
  return res
}
const slot = new Date().toISOString().slice(0, 10)
const bucket = Math.floor(Date.now() / 1_800_000)
const KEYVAL = 'TEST-KEY-abc123'

type FetchMode = 'ok' | 'quota' | 'badkey'
let mode: FetchMode = 'ok'
const calls: string[] = []
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = (async (input: string | URL) => {
  const u = new URL(String(input))
  calls.push(u.pathname.split('/').pop() + '?' + [...u.searchParams.keys()].join(','))
  if (mode === 'quota') return json(403, { error: { errors: [{ reason: 'quotaExceeded' }], message: 'quota' } })
  if (mode === 'badkey') return json(400, { error: { errors: [{ reason: 'badRequest' }], message: 'API key not valid. Please pass a valid API key.' } })
  const path = u.pathname.split('/').pop()
  const sp = u.searchParams
  if (path === 'channels' && sp.get('forHandle')) {
    const h = sp.get('forHandle')!
    return json(200, h === '@세무사' ? { items: [] } : { items: [{ id: `UC_${h.replace('@', '')}` }] })
  }
  if (path === 'channels' && sp.get('forUsername')) return json(200, { items: [] })
  if (path === 'channels' && sp.get('id')) {
    const ids = sp.get('id')!.split(',')
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
  check('서버: 키 없음 → status 는 configured=false · 채널 20곳', st.code === 200 && (st.body as { configured: boolean }).configured === false && (st.body as { channels: number }).channels === 20 && CHANNELS.length === 20)
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
  check('서버: 200 · 채널 19곳(1곳 못 찾음) · 영상 50편씩', ok.code === 200 && body.channels.length === 19 && body.videos.length === 19 * 50, { code: ok.code, ch: body.channels?.length, v: body.videos?.length })
  check('서버: 못 받은 채널 이름을 같이 보낸다(@세무사)', body.failed.join() === '@세무사')
  check('서버: 내 채널 표시(@김팀장의경영노트) · 핸들 · 숫자', body.channels[0].mine && body.channels[0].handle === '@김팀장의경영노트' && body.channels[0].subs === 12000 && body.channels.filter((c) => c.mine).length === 1)
  check('서버: 영상 칸 — 길이(초) · 조회수 숫자', body.videos[0].d === 45 && body.videos[1].d === 723 && body.videos[0].v === 1000 && typeof body.videos[0].at === 'string')
  check('서버: 응답 어디에도 키 값이 없다', !JSON.stringify(ok.body).includes(KEYVAL))
  check('서버: 할당량 약 60단위(채널 정보는 한 번에 묶음)', body.units === calls.length && body.units <= 62 && calls.filter((c) => c.startsWith('channels?part,id')).length === 1, { units: body.units, calls: calls.length })
  const maxAge = Number(/s-maxage=(\d+)/.exec(ok.headers['cache-control'] ?? '')?.[1] ?? -1)
  check('서버: 하루 칸은 다음 아침 9시까지 캐시', Math.abs(maxAge - secondsUntilNine()) <= 2, ok.headers['cache-control'])
  const fr = await call(`?bucket=${bucket}`)
  check('서버: [지금 새로] 는 30분 캐시(같은 30분에 여러 번 눌러도 유튜브는 한 번)', fr.code === 200 && fr.headers['cache-control'] === 'public, max-age=0, s-maxage=1800')

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

console.log(`\nyoutube: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
