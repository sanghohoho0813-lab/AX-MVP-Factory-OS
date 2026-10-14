/**
 * 콘텐츠 레이더 계산 (D-194) — "그래서 이번 주에 무엇을 찍을까?" 까지.
 *
 * 규칙 계산이다('AI' 아님 · 외부 호출 0). D-193 의 받은 데이터(prepareFeed)를 그대로 쓴다.
 *
 * 1) 평소(기준) — 채널마다 · 롱폼/쇼츠 따로, '올린 지 7일 넘은 영상' 조회수의 중앙값(그 영상 자신은 뺀다).
 *    평균이 아니라 중앙값 — 한 번 터진 영상이 기준을 끌어올리지 않게. 기준 영상이 3편 안 되면 '기준 부족'.
 * 2) 올린 지 얼마 안 된 영상 — 조회수가 아직 덜 쌓였다. 실제 데이터(2026-10-14 · 18채널 900편)를 재 보니
 *    평소 대비 중앙값이 0~2일 0.35~0.43 · 2~4일 0.61~0.80 · 4~7일 0.81~0.95 · 7일 넘으면 약 1.0 이었다.
 *    → 기대 비율 = 1일 이하 0.3 → 7일에 1.0 까지 곧게. '같은 나이 영상 기대치' 로 나눠 비교한다(화면에 그 근거를 같이 쓴다).
 * 3) 평소보다 터진 영상(breakout) — 나이를 반영한 배수가 3배 이상(7일 안 영상은 실제로도 평소의 1.2배는 넘어야).
 *    평소보다 잘된 영상 = 2배 이상. 구독자 3만 이하 채널에서 터진 것은 '작은 채널' 신호로 따로 센다.
 * 4) 주제 — 제목을 정규화해 주제 분류표(radarPlaybook)로 묶는다. 신호 A~E:
 *    A 여러 채널 · B 최근 2주 증가 · C 평소보다 잘됨 · D 작은 채널 · E MIRAE 분야. 점수(0~100)를 만들지 않는다 —
 *    '신호 강함 · 보통 · 초기' 세 칸과 그 이유 문장만. 한 채널이 거의 다 올린 주제는 '초기 신호' 까지만(여러 채널 흐름이 아님).
 * 5) 이번 주 후보 — 데이터가 센 후보가 먼저(D-195). 비중 가이드(기본 45 · 35 · 20)는 앞 5개에서 한 종류가 몰리지 않게만
 *    막는다(종류마다 많아야 가이드 몫 + 1개 · 후보가 있으면 적어도 1개) — 4.5 · 3.5 · 2 개를 억지로 맞추지 않는다. 최대 10개 · 데이터가 없으면 만들지 않는다.
 * 6) 묶음 크기 보정(D-195) — 직접 경쟁 채널이 AI 실무 채널보다 많다. 그래서 '몇 개 채널' 만이 아니라
 *    '그 묶음 채널 중 몇 곳이 다뤘나'(예: AI 실무 8곳 중 4곳 · 직접 경쟁 18곳 중 5곳)를 같이 보고, 같은 세기면 비율이 높은 쪽이 먼저.
 *    새 점수(0~100)는 만들지 않는다 — 화면에는 'n곳 중 m곳' 그대로 쓴다.
 */
import { SHORT_MAX_SEC, extractTopics, periodVideos, type Prepared, type YtChannel, type YtVideo } from './ytBench'
import { TOPICS, TOPIC_BY_ID, normalizeTitle, topicsOf, type Angle, type ContentAxis, type TopicDef } from './radarPlaybook'

export type { ContentAxis } from './radarPlaybook'

/* ------------------------------------------------------------------ */
/* 채널 묶음                                                              */
/* ------------------------------------------------------------------ */

export type BenchmarkChannelGroup = 'direct' | 'ai' | 'ax' | 'format'
export const GROUPS: readonly BenchmarkChannelGroup[] = ['direct', 'ai', 'ax', 'format']
export const GROUP_LABEL: Record<BenchmarkChannelGroup, string> = {
  direct: '직접 경쟁 · 시장수요',
  ai: 'AI 실무',
  ax: 'AX · 업무자동화',
  format: '포맷 벤치마킹',
}
export const GROUP_PURPOSE: Record<BenchmarkChannelGroup, string> = {
  direct: '중소기업 대표가 지금 무엇에 관심 있는지(정책자금 · 지원사업 · 지원금 · 절세 · 법인)',
  ai: 'AI 콘텐츠에서 사람들이 반응하는 실무 주제와 설명 방식(ChatGPT · Claude · 자동화 · 생산성)',
  ax: 'MIRAE AI LAB 의 핵심 차별화 영역(업무자동화 · 노코드 · 기업 AI 도입 · 사내 시스템)',
  format: '주제가 아니라 표현 방식 — 제목 · 썸네일 · 오프닝 · 구성',
}

export const isGroup = (g: unknown): g is BenchmarkChannelGroup => typeof g === 'string' && (GROUPS as readonly string[]).includes(g)

/** 채널 → 묶음(서버가 붙여 보낸 것 → 대표가 바꾼 것 순). 모르면 직접 경쟁 */
export function groupOf(c: Pick<YtChannel, 'id'> & { group?: unknown }, overrides?: Readonly<Record<string, { group?: BenchmarkChannelGroup }>>): BenchmarkChannelGroup {
  const o = overrides?.[c.id]?.group
  if (isGroup(o)) return o
  return isGroup(c.group) ? c.group : 'direct'
}

export const AXIS_LABEL: Record<ContentAxis, string> = { market: '시장수요', axai: 'AX · AI', bridge: 'BRIDGE' }
export const AXIS_HINT: Record<ContentAxis, string> = {
  market: '사람들이 이미 찾는 주제(정책자금 · 지원사업 · 지원금 · 절세 · 법인)',
  axai: '중소기업 업무 자동화 · AI 활용 · AX 사례',
  bridge: '기존 중소기업 관심 주제에 AX · AI 를 붙인 주제 — MIRAE 만 말할 수 있는 쪽',
}

/** 비중 가이드(절대 규칙 아님) */
export interface MixGuide {
  market: number
  axai: number
  bridge: number
}
export const DEFAULT_MIX: MixGuide = { market: 45, axai: 35, bridge: 20 }

export function normalizeMix(m: Partial<MixGuide> | null | undefined): MixGuide {
  const n = (v: unknown, d: number) => {
    const x = Math.round(Number(v))
    return Number.isFinite(x) && x >= 0 && x <= 100 ? x : d
  }
  const out = { market: n(m?.market, DEFAULT_MIX.market), axai: n(m?.axai, DEFAULT_MIX.axai), bridge: n(m?.bridge, DEFAULT_MIX.bridge) }
  return out.market + out.axai + out.bridge > 0 ? out : DEFAULT_MIX
}

/* ------------------------------------------------------------------ */
/* 영상 하나의 신호                                                        */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000
/** 작은 채널 = 구독자 3만 이하 */
export const SMALL_CHANNEL_SUBS = 30_000
/** 평소 기준에 쓰는 영상 = 올린 지 7일 넘은 것 */
export const MATURE_DAYS = 7
export const BREAKOUT_X = 3
export const ABOVE_X = 2

/** 올린 지 ageDays 일인 영상이 '평소' 의 몇 할쯤 쌓였을지 — 실제 데이터로 정한 곧은 선(위 머리말 2) */
export function expectedShare(ageDays: number): number {
  if (!(ageDays > 1)) return 0.3
  if (ageDays >= MATURE_DAYS) return 1
  return 0.3 + (0.7 * (ageDays - 1)) / (MATURE_DAYS - 1)
}

export type VideoTier = 'breakout' | 'above' | 'normal' | 'below' | 'unknown'

export interface TitlePatternDef {
  id: string
  label: string
  /** '이 영상에서 참고할 것' 한 줄 */
  note: string
  re: RegExp
}

/** 제목 구조 — 한 제목이 여러 개일 수 있다 */
export const TITLE_PATTERNS: readonly TitlePatternDef[] = [
  { id: 'number', label: '숫자형', note: '숫자를 제목에 바로 씀(몇 가지 · 얼마 · 몇 배)', re: /\d+\s*(가지|개|단계|분|초|일|억|만|천|배|%|위|년|명|건|원|시간|편)|top\s?\d|\d+선/i },
  { id: 'warning', label: '경고형', note: '손해 · 주의 프레임(놓치면 · 모르면 · 실수)', re: /모르면|놓치면|손해|주의|조심|절대|위험|큰일|함정|실수|하지\s?마|망하는|안\s?되는\s?이유|후회/ },
  { id: 'twist', label: '반전형', note: '통념을 뒤집는 말로 시작(다들 · 사실은 · 착각)', re: /다들|사실은|알고\s?보니|오히려|착각|진짜\s?이유|아닙니다|끝났습니다|믿지\s?말|반전|아니라/ },
  { id: 'result', label: '결과형', note: '해 본 결과를 먼저 보여 줌(했더니 · 해봤습니다)', re: /했더니|해\s?봤더니|해\s?봤습니다|만들어\s?봤|써\s?봤|후기|결과|달라졌|줄였|바꿔\s?봤|돌려\s?봤/ },
  { id: 'question', label: '질문형', note: '질문으로 끝내 궁금하게 함', re: /[?？]|까\s*$|나요\s*$|왜\s|어떻게|얼마나|무엇|뭘/ },
  { id: 'deadline', label: '마감형', note: '마감 · 기한 · 선착순을 앞세움', re: /마감|오늘까지|이번\s?주|곧\s?끝|d-\s?\d|선착순|오픈런|종료|기한|마지막\s?접수|딱\s?\d+일/i },
  { id: 'compare', label: '비교형', note: '둘을 나란히 비교함(vs · 차이)', re: /\bvs\b|비교|차이|어느\s?쪽|무엇이\s?맞|뭐가\s?맞/i },
  { id: 'howto', label: '방법형', note: '방법 · 순서 · 정리를 약속함', re: /방법|하는\s?법|가이드|총정리|정리|순서|꿀팁|a\s?to\s?z/i },
]

export function titlePatterns(title: string): string[] {
  const t = String(title ?? '')
  return TITLE_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.id)
}

export const PATTERN_LABEL: Record<string, string> = Object.fromEntries(TITLE_PATTERNS.map((p) => [p.id, p.label]))

/** 채널 이름 꼬리표에서 빼는 너무 흔한 말 */
const GENERIC_TOKENS = new Set(['tv', 'the', '채널', 'official', 'channel'])

/**
 * 제목에서 그 채널의 이름 꼬리표를 뗀다 — '… | 절세미녀' · '[보고파TV]' · '#여의도정보맨' · '#shorts'.
 * 실제 데이터에서 '| 절세미녀' 꼬리표 때문에 그 채널 영상 전부가 '절세' 주제로 세졌다(D-194 확인).
 * 앞부분(첫 '|' 앞)은 늘 남긴다 — 채널 이름에 주제어가 든 채널(예: '… l 정책자금 l …')도 본문은 지키려고.
 */
export function stripChannelTag(title: string, channelTitle: string): string {
  const tokens = (String(channelTitle ?? '').match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).map((t) => t.toLowerCase()).filter((t) => !GENERIC_TOKENS.has(t))
  const has = (seg: string) => {
    const x = seg.toLowerCase().replace(/\s+/g, '')
    return tokens.some((t) => x.includes(t))
  }
  const parts = String(title ?? '').split(/\s*[|｜]\s*/)
  let out = [parts[0], ...parts.slice(1).filter((seg) => !has(seg))].join(' ')
  out = out.replace(/[[(（【]([^\])）】]{1,40})[\])）】]/g, (m, inner: string) => (tokens.length && has(inner) ? ' ' : m))
  out = out.replace(/#[^\s#]+/g, (m) => (/^#shorts?$/i.test(m) || (tokens.length && has(m.slice(1))) ? ' ' : m))
  return out.replace(/\s+/g, ' ').trim()
}

export interface RadarVideo extends YtVideo {
  group: BenchmarkChannelGroup
  channelSubs: number
  /** 올린 지 며칠(소수) */
  ageDays: number
  /** 평소(같은 채널 · 같은 형식 · 7일 넘은 영상 중앙값) — 모르면 null */
  baseline: number | null
  /** 평소를 잰 영상 수 */
  baselineN: number
  /** 조회수 ÷ 평소 */
  ratio: number | null
  /** 나이를 반영한 배수 = ratio ÷ 기대 비율(7일 넘으면 ratio 와 같다) */
  adjusted: number | null
  /** 하루 평균 조회수 */
  perDay: number
  young: boolean
  tier: VideoTier
  small: boolean
  /** 조회수 ÷ 구독자 */
  viewsPerSub: number
  /** 같은 채널 · 같은 형식 영상 중 조회수 순위(1부터) / 몇 편 중 */
  rank: number
  rankOf: number
  topics: string[]
  patterns: string[]
  /** 이 채널에서 받은 영상이 며칠 전까지 거슬러 가나(채널마다 최근 50편만 받으므로 자주 올리는 채널은 짧다) */
  coverageDays: number
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface RadarOptions {
  now?: number
  /** 채널 번호 → 묶음 · 사용 여부(대표가 바꾼 것) */
  overrides?: Readonly<Record<string, { group?: BenchmarkChannelGroup; enabled?: boolean }>>
  mix?: Partial<MixGuide>
  /** 대표가 [관심 없음] 으로 숨긴 후보(Opportunity.key — '축:주제' 그대로 · D-195) */
  muted?: readonly string[]
}

/** 영상마다 평소 · 배수 · 등급 · 주제 · 제목 구조 */
export function radarVideos(p: Prepared, opts: RadarOptions = {}): RadarVideo[] {
  const now = opts.now ?? Date.now()
  const subs = new Map(p.channels.map((c) => [c.id, c.subs]))
  const titles = new Map(p.channels.map((c) => [c.id, c.title]))
  const coverage = new Map<string, number>()
  for (const v of p.videos) coverage.set(v.channelId, Math.max(coverage.get(v.channelId) ?? 0, (now - v.publishedAt) / DAY))
  const groups = new Map(p.channels.map((c) => [c.id, groupOf(c as YtChannel & { group?: unknown }, opts.overrides)]))
  const off = new Set(Object.entries(opts.overrides ?? {}).filter(([, o]) => o.enabled === false).map(([id]) => id))
  const vids = p.videos.filter((v) => !off.has(v.channelId))
  // 채널 · 형식별 묶음
  const byKey = new Map<string, YtVideo[]>()
  for (const v of vids) {
    const k = `${v.channelId}|${v.isShort ? 's' : 'l'}`
    const arr = byKey.get(k)
    if (arr) arr.push(v)
    else byKey.set(k, [v])
  }
  return vids.map((v) => {
    const ageDays = Math.max(0, (now - v.publishedAt) / DAY)
    const peers = byKey.get(`${v.channelId}|${v.isShort ? 's' : 'l'}`) ?? []
    const mature = peers.filter((x) => x.id !== v.id && (now - x.publishedAt) / DAY >= MATURE_DAYS).map((x) => x.views)
    const baseline = mature.length >= 3 ? median(mature) : null
    const ratio = baseline && baseline > 0 ? v.views / baseline : null
    const share = expectedShare(ageDays)
    const adjusted = ratio === null ? null : ratio / share
    const young = ageDays < MATURE_DAYS
    let tier: VideoTier = 'unknown'
    if (adjusted !== null && ratio !== null) {
      if (adjusted >= BREAKOUT_X && (!young || ratio >= 1.2)) tier = 'breakout'
      else if (adjusted >= ABOVE_X && (!young || ratio >= 1)) tier = 'above'
      else if (adjusted >= 0.5) tier = 'normal'
      else tier = 'below'
    }
    const sorted = [...peers].sort((a, b) => b.views - a.views)
    const s = subs.get(v.channelId) ?? 0
    const clean = stripChannelTag(v.title, titles.get(v.channelId) ?? '')
    return {
      ...v,
      group: groups.get(v.channelId) ?? 'direct',
      channelSubs: s,
      ageDays,
      baseline,
      baselineN: mature.length,
      ratio,
      adjusted,
      perDay: v.views / Math.max(ageDays, 0.5),
      young,
      tier,
      small: s > 0 && s <= SMALL_CHANNEL_SUBS,
      viewsPerSub: s > 0 ? v.views / s : 0,
      rank: sorted.findIndex((x) => x.id === v.id) + 1,
      rankOf: sorted.length,
      topics: topicsOf(clean),
      patterns: titlePatterns(clean),
      coverageDays: coverage.get(v.channelId) ?? 0,
    }
  })
}

/** '평소보다 6.2배' · 7일 안이면 '3일 만에 평소의 1.7배' */
export function ratioLine(v: Pick<RadarVideo, 'ratio' | 'adjusted' | 'young' | 'ageDays'>): string {
  if (v.ratio === null) return '평소 기준 부족'
  // 100배 넘게는 그냥 '100배 넘게'(평소가 아주 작은 채널에서 숫자만 커 보이지 않게)
  const x = (n: number) => (n >= 100 ? '100배 넘게' : `${n >= 10 ? Math.round(n).toString() : n.toFixed(1)}배`)
  if (!v.young) return `평소보다 ${x(v.ratio)}`
  const d = Math.max(1, Math.floor(v.ageDays))
  return `${d}일 만에 평소의 ${x(v.ratio)}`
}

/** 화면용 배수 숫자(나이 반영) — 7일 안 영상은 '같은 나이 기대치' 대비 */
export const tierLabel: Record<VideoTier, string> = { breakout: '평소보다 터짐', above: '평소보다 잘됨', normal: '평소 수준', below: '평소보다 낮음', unknown: '기준 부족' }

/* ------------------------------------------------------------------ */
/* 주제 묶음 · 신호                                                        */
/* ------------------------------------------------------------------ */

export type Strength = 'strong' | 'medium' | 'early'
export const STRENGTH_LABEL: Record<Strength, string> = { strong: '신호 강함', medium: '신호 보통', early: '초기 신호' }
const STRENGTH_ORDER: Record<Strength, number> = { strong: 0, medium: 1, early: 2 }

export interface Cluster {
  topicId: string
  label: string
  area: TopicDef['area']
  /** 30일 안 관련 영상(내 채널 · 포맷 묶음 · 꺼 둔 채널 제외) */
  hits: RadarVideo[]
  videos7: number
  videos14: number
  videos30: number
  channels14: number
  channels30: number
  breakouts: number
  above: number
  smallBreakouts: number
  /** 그 전 6주(15~56일) 편수 */
  prior: number
  /** 최근 2주가 그 전보다 빠르게 늘었나 */
  growing: boolean
  /** 한 채널이 대부분(75% 넘게) 올렸나 — 그 채널 이름 */
  dominant: string
  strength: Strength
  reasons: string[]
  /** 이미 '시장 주제 + AI/자동화' 를 함께 다룬 영상 수(BRIDGE 근거) */
  bridgeHits: number
  /** 묶음마다 '채널 n곳 중 m곳이 다뤘다'(최근 2주 — 2주에 2곳이 안 되면 30일) · 직접 경쟁 · AI 실무 · AX 만 */
  coverage: GroupCoverage[]
  coverageDays: 14 | 30
  /** 가장 촘촘한 묶음의 비율(0~1 · 채널 5곳 넘는 묶음만) — 순서를 정할 때만 쓰고(세 칸으로) 화면에는 'n곳 중 m곳' 으로 쓴다 */
  density: number
  densityGroup: BenchmarkChannelGroup | null
}

export interface GroupCoverage {
  group: BenchmarkChannelGroup
  covered: number
  total: number
}

/** 화면에 쓰는 짧은 묶음 이름 */
export const GROUP_SHORT: Record<BenchmarkChannelGroup, string> = { direct: '직접 경쟁', ai: 'AI 실무', ax: 'AX · 자동화', format: '포맷' }

/** '직접 경쟁 채널 18곳 중 6곳' */
export const coverageLine = (g: GroupCoverage) => `${GROUP_SHORT[g.group]} 채널 ${g.total}곳 중 ${g.covered}곳`

const isBench = (v: RadarVideo) => !v.mine && v.group !== 'format'

/** 묶음마다 계산에 쓰는 채널 수(내 채널 · 포맷 · 꺼 둔 채널 빼고 · 받아 온 영상이 있는 채널) */
function groupTotals(all: readonly RadarVideo[]): Map<BenchmarkChannelGroup, number> {
  const ids = new Map<BenchmarkChannelGroup, Set<string>>()
  for (const v of all) {
    if (!isBench(v)) continue
    const s = ids.get(v.group) ?? new Set<string>()
    s.add(v.channelId)
    ids.set(v.group, s)
  }
  return new Map([...ids.entries()].map(([g, s]) => [g, s.size]))
}

/**
 * 비율을 순서에 쓰는 묶음 — 채널이 5곳 넘어야(4곳 중 3곳 = 75% 처럼 작은 묶음이 부풀지 않게 · 실제 데이터에서 AX 4곳 묶음이 그랬다).
 * 비율 자체도 세 칸으로만 비교한다 — 절반 넘게 · 4분의 1 넘게 · 그 아래(작은 차이로 순서가 뒤집히지 않게).
 */
const DENSITY_MIN_TOTAL = 5
export const densityBand = (d: number): 0 | 1 | 2 => (d >= 0.5 ? 2 : d >= 0.25 ? 1 : 0)

function clusterOf(def: TopicDef, all: readonly RadarVideo[], totals: ReadonlyMap<BenchmarkChannelGroup, number> = groupTotals(all)): Cluster | null {
  const rel = all.filter((v) => isBench(v) && v.topics.includes(def.id))
  const hits = rel.filter((v) => v.ageDays <= 30).sort((a, b) => b.publishedAt - a.publishedAt)
  if (hits.length < 2) return null
  const in14 = hits.filter((v) => v.ageDays <= 14)
  const in7 = hits.filter((v) => v.ageDays <= 7)
  // 늘었는지는 '8주 넘게 거슬러 받은 채널' 영상으로만 잰다 — 자주 올리는 채널은 최근 50편이 2~3주뿐이라
  // 그 전 6주가 비어 보여 저절로 '늘었다' 가 된다(실제 데이터에서 확인)
  const covered = (v: RadarVideo) => v.coverageDays >= 56
  const prior = rel.filter((v) => covered(v) && v.ageDays > 14 && v.ageDays <= 56).length
  const in14c = in14.filter(covered).length
  const ch14 = new Set(in14.map((v) => v.channelId))
  const ch30 = new Set(hits.map((v) => v.channelId))
  const breakouts = hits.filter((v) => v.tier === 'breakout')
  const above = hits.filter((v) => v.tier === 'breakout' || v.tier === 'above')
  const smallBreakouts = breakouts.filter((v) => v.small)
  // 최근 2주 하루 편수 vs 그 전 6주 하루 편수
  const growing = in14c >= 3 && (prior === 0 || in14c / 14 >= (prior / 42) * 1.5)
  const perCh = new Map<string, number>()
  for (const v of hits) perCh.set(v.channelName, (perCh.get(v.channelName) ?? 0) + 1)
  const [topCh, topN] = [...perCh.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  const dominant = ch30.size === 1 || (hits.length >= 4 && topN / hits.length > 0.75) ? topCh : ''

  const A = ch14.size >= 2
  const strongA = ch14.size >= 3
  const C = above.length >= 1
  const D = smallBreakouts.length >= 1
  let strength: Strength = 'early'
  if (!dominant) {
    if (strongA && (breakouts.length >= 1 || D)) strength = 'strong'
    else if ((A && (growing || C)) || (C && ch30.size >= 2)) strength = 'medium'
  }

  const reasons: string[] = []
  if (ch14.size >= 2) reasons.push(`최근 2주 ${ch14.size}개 채널에서 다뤘습니다`)
  else if (ch30.size >= 2) reasons.push(`최근 30일 ${ch30.size}개 채널에서 다뤘습니다`)
  if (growing) reasons.push(prior === 0 ? `최근 2주 ${in14.length}편 — 그 전 6주에는 없던 주제입니다` : `최근 2주 ${in14.length}편 — 그 전 6주보다 빠르게 늘었습니다`)
  else if (in7.length >= 2) reasons.push(`최근 7일 ${in7.length}편`)
  if (breakouts.length >= 1) reasons.push(`평소보다 ${BREAKOUT_X}배 넘게 터진 영상 ${breakouts.length}편`)
  else if (above.length >= 1) reasons.push(`평소보다 ${ABOVE_X}배 넘게 잘된 영상 ${above.length}편`)
  if (D) {
    const b = [...smallBreakouts].sort((a, c) => (c.adjusted ?? 0) - (a.adjusted ?? 0))[0]
    reasons.push(`구독자 ${shortSubs(b.channelSubs)} 채널에서도 ${ratioLine(b)}`)
  }
  if (dominant) reasons.push(`대부분 한 채널(${dominant})이 올린 주제 — 여러 채널 흐름은 아직 아닙니다`)

  const bridgeHits = def.area === 'market' ? hits.filter((v) => v.topics.some((t) => TOPIC_BY_ID.get(t)?.area !== 'market')).length : 0
  // 묶음 크기 보정 — 같은 채널이 여러 편 올려도 한 곳으로 센다
  const coverageDays: 14 | 30 = ch14.size >= 2 ? 14 : 30
  const win = coverageDays === 14 ? in14 : hits
  const coverage: GroupCoverage[] = (['direct', 'ai', 'ax'] as const)
    .map((g) => ({ group: g, covered: new Set(win.filter((v) => v.group === g).map((v) => v.channelId)).size, total: totals.get(g) ?? 0 }))
    .filter((x) => x.covered > 0)
    .sort((a, b) => b.covered / Math.max(1, b.total) - a.covered / Math.max(1, a.total))
  const dense = coverage.filter((x) => x.total >= DENSITY_MIN_TOTAL)
  const density = dense.length ? dense[0].covered / dense[0].total : 0
  return {
    topicId: def.id,
    label: def.label,
    area: def.area,
    hits,
    videos7: in7.length,
    videos14: in14.length,
    videos30: hits.length,
    channels14: ch14.size,
    channels30: ch30.size,
    breakouts: breakouts.length,
    above: above.length,
    smallBreakouts: smallBreakouts.length,
    prior,
    growing,
    dominant,
    strength,
    reasons,
    bridgeHits,
    coverage,
    coverageDays,
    density,
    densityGroup: dense[0]?.group ?? null,
  }
}

const shortSubs = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}만` : `${n.toLocaleString('ko-KR')}명`)

/** 신호가 센 순(점수 대신 순서만) */
export function clusterOrder(a: Cluster, b: Cluster): number {
  return (
    STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
    // 같은 세기면 '그 묶음 채널 중 얼마나 다뤘나'(절반 넘게 · 4분의 1 넘게 · 그 아래)가 높은 쪽 — 채널이 많은 묶음이라서 앞서지 않게(D-195)
    densityBand(b.density) - densityBand(a.density) ||
    b.breakouts - a.breakouts ||
    b.channels14 - a.channels14 ||
    b.above - a.above ||
    b.videos14 - a.videos14 ||
    b.videos30 - a.videos30 ||
    a.topicId.localeCompare(b.topicId)
  )
}

export function clusters(videos: readonly RadarVideo[]): Cluster[] {
  const totals = groupTotals(videos)
  return TOPICS.map((d) => clusterOf(d, videos, totals))
    .filter((c): c is Cluster => c !== null)
    .sort(clusterOrder)
}

/* ------------------------------------------------------------------ */
/* 이번 주 후보                                                           */
/* ------------------------------------------------------------------ */

export type Approach = 'market' | 'ax' | 'hold'
export const APPROACH_LABEL: Record<Approach, string> = { market: '시장형', ax: 'MIRAE AX형', hold: '지금은 보류' }

export interface Opportunity {
  key: string
  axis: ContentAxis
  topicId: string
  /** 카드 머리 — BRIDGE 는 '정책자금 × 공고 자동 수집' */
  topic: string
  strength: Strength
  /** 왜 지금 — 사람이 읽는 한 문장(규칙으로 이어 붙인 것 · D-195 카드 기본 상태) */
  summary: string
  /** 핵심 근거 1~2개(카드 기본 상태) — 나머지 숫자는 [근거 보기] 에 다 있다 */
  facts: string[]
  /** 근거 문장 전부([근거 보기] · 수첩 · 브리프) */
  whyNow: string[]
  cluster: Cluster
  /** 대표 벤치마킹 0~3편 — 평소보다 잘된 영상만(터진 것 · 배수 높은 것 먼저). 약한 영상으로 칸을 채우지 않는다(D-195) */
  benchmarks: RadarVideo[]
  view: string
  titles: Array<{ text: string; patterns: string[] }>
  thumbs: string[]
  approach: Approach
  approachWhy: string
}

/** 이번 달 잘된 제목 구조 — 평소보다 잘된 영상(2배+) 중 많이 쓴 구조 */
export interface PatternStat {
  id: string
  label: string
  /** 잘된 영상 중 이 구조 */
  hot: number
  hotOf: number
  /** 전체 영상 중 이 구조의 몫(%) */
  baseShare: number
  hotShare: number
}

export function hotPatterns(videos: readonly RadarVideo[], days = 30): PatternStat[] {
  const pool = videos.filter((v) => !v.mine && v.ageDays <= days && v.tier !== 'unknown')
  const hot = pool.filter((v) => v.tier === 'breakout' || v.tier === 'above')
  if (hot.length === 0) return []
  return TITLE_PATTERNS.map((p) => {
    const h = hot.filter((v) => v.patterns.includes(p.id)).length
    const b = pool.filter((v) => v.patterns.includes(p.id)).length
    return { id: p.id, label: p.label, hot: h, hotOf: hot.length, baseShare: pool.length ? Math.round((b / pool.length) * 100) : 0, hotShare: Math.round((h / hot.length) * 100) }
  })
    .filter((s) => s.hot > 0)
    .sort((a, b) => b.hot - a.hot || b.hotShare - b.baseShare - (a.hotShare - a.baseShare))
}

/**
 * 대표 벤치마킹 1~3편(가변) — 그 채널 평소보다 실제로 더 본 영상(평소의 1배 이상)만.
 * D-195: 실제 데이터에서 3칸을 채우려고 '3일 만에 평소의 0.9배' 영상이 들어갔다 — 좋은 것이 하나면 하나만 보인다.
 * 순서: 터진 것(3배+) → 잘된 것(2배+) → 평소 넘음 · 같은 등급이면 나이 반영 배수 순 · 먼저 채널마다 한 편, 그다음 두 편까지.
 */
export function pickBenchmarks(c: Pick<Cluster, 'hits'>, n = 3): RadarVideo[] {
  const tierRank: Record<VideoTier, number> = { breakout: 0, above: 1, normal: 2, below: 3, unknown: 4 }
  const good = c.hits.filter((v) => v.ratio !== null && v.ratio >= 1 && v.tier !== 'below' && v.tier !== 'unknown')
  const sorted = [...good].sort((a, b) => tierRank[a.tier] - tierRank[b.tier] || (b.adjusted ?? 0) - (a.adjusted ?? 0) || b.views - a.views)
  const out: RadarVideo[] = []
  const per = new Map<string, number>()
  const add = (v: RadarVideo) => {
    out.push(v)
    per.set(v.channelId, (per.get(v.channelId) ?? 0) + 1)
  }
  for (const v of sorted) if (out.length < n && !per.has(v.channelId)) add(v)
  for (const v of sorted) if (out.length < n && !out.includes(v) && (per.get(v.channelId) ?? 0) < 2) add(v)
  return out
}

/** 이 주제에서 가장 촘촘한 묶음 — 'AI 실무 채널 8곳 중 4곳' (2곳 넘게 다뤘을 때만) */
function topCoverage(c: Cluster): GroupCoverage | null {
  const g = c.coverage.find((x) => x.group === c.densityGroup) ?? c.coverage[0]
  return g && g.covered >= 2 ? g : null
}

/** 왜 지금 — 한 문장(규칙). 예: '최근 2주 동안 6개 채널에서 반복해서 다뤘고, 평소보다 크게 터진 영상이 4편 나왔습니다.' */
function summaryOf(axis: ContentAxis, c: Cluster, label: string, axSignal: Cluster | undefined): string {
  if (c.dominant) return `대부분 한 채널(${c.dominant})이 올린 주제라 아직 여러 채널 흐름은 아닙니다.`
  const spread = c.channels14 >= 2 ? `최근 2주 동안 ${c.channels14}개 채널에서 반복해서 다뤘고` : c.channels30 >= 2 ? `최근 30일 동안 ${c.channels30}개 채널에서 다뤘고` : `최근 30일에 관련 영상이 ${c.videos30}편 올라왔고`
  if (axis === 'bridge') {
    const tail =
      c.bridgeHits > 0
        ? `이미 '${label} + AI · 자동화' 영상이 ${c.bridgeHits}편 나와 우리 AX 이야기를 붙이기 좋습니다`
        : axSignal && axSignal.strength !== 'early'
          ? `AI 실무 채널에서는 지금 '${axSignal.label}' 이 오르고 있어 둘을 붙여 말하기 좋은 때입니다`
          : `'${label} + AI' 를 다룬 영상은 아직 없어 먼저 말할 수 있습니다`
    return `${spread}, ${tail}.`
  }
  const tail =
    c.breakouts > 0
      ? `평소보다 크게 터진 영상이 ${c.breakouts}편 나왔습니다`
      : c.above > 0
        ? `평소보다 잘된 영상이 ${c.above}편 있습니다`
        : c.growing
          ? '그 전 6주보다 빠르게 늘고 있습니다'
          : '아직 평소보다 크게 터진 영상은 없습니다'
  return `${spread}, ${tail}.`
}

/** 핵심 근거 1~2개 — 카드 기본 상태에 보이는 것(나머지는 근거 보기) */
function factsOf(axis: ContentAxis, c: Cluster, label: string, axSignal: Cluster | undefined): string[] {
  if (c.dominant) return [`${c.dominant} 혼자 ${c.videos30}편`]
  const cov = topCoverage(c)
  const spread = cov ? `${coverageLine(cov)}이 다룸` : `${c.channels14 >= 2 ? c.channels14 : c.channels30}개 채널에서 다룸`
  const heat =
    c.breakouts > 0
      ? `평소보다 터진 영상 ${c.breakouts}편`
      : c.above > 0
        ? `평소보다 잘된 영상 ${c.above}편`
        : c.growing
          ? `최근 2주 ${c.videos14}편 · 빠르게 늘어남`
          : `최근 7일 ${c.videos7}편`
  if (axis === 'bridge') {
    const why =
      c.bridgeHits > 0
        ? `'${label} + AI · 자동화' 영상 ${c.bridgeHits}편`
        : axSignal && axSignal.strength !== 'early'
          ? `AI 실무에서 '${axSignal.label}' 상승`
          : `'${label} + AI' 영상 아직 없음`
    return [why, spread]
  }
  return [spread, heat]
}

function titlesFor(angle: Angle, hot: readonly PatternStat[]): Array<{ text: string; patterns: string[] }> {
  const rank = new Map(hot.map((h, i) => [h.id, i]))
  const score = (ps: string[]) => Math.min(...ps.map((p) => rank.get(p) ?? 99), 99)
  return angle.titles.map((text, i) => ({ text, patterns: titlePatterns(text), i })).sort((a, b) => score(a.patterns) - score(b.patterns) || a.i - b.i).map(({ text, patterns }) => ({ text, patterns }))
}

function opportunity(axis: ContentAxis, c: Cluster, hot: readonly PatternStat[], axSignal: Cluster | undefined): Opportunity | null {
  const def = TOPIC_BY_ID.get(c.topicId)
  if (!def) return null
  const angle = axis === 'bridge' ? def.bridge : def.main
  if (!angle) return null
  const whyNow = [...c.reasons]
  // BRIDGE 는 '왜 BRIDGE 인가' 를 맨 앞에(카드에는 앞 3줄만 보인다)
  if (axis === 'bridge') {
    if (c.bridgeHits > 0) whyNow.unshift(`이미 '${def.label} + AI · 자동화' 를 같이 다룬 영상 ${c.bridgeHits}편 — 시장이 이 조합을 받아 줍니다`)
    else if (axSignal && axSignal.strength !== 'early') whyNow.unshift(`AI 실무 채널에서는 지금 '${axSignal.label}' 이 오릅니다(${axSignal.channels14 || axSignal.channels30}개 채널) — 이 주제에 붙여 말하기 좋은 때입니다`)
    else whyNow.unshift(`'${def.label} + AI' 를 다룬 벤치마킹 영상은 아직 없습니다 — 먼저 말할 수 있는 자리입니다`)
  }
  const hold = c.strength === 'early' && (c.dominant !== '' || c.videos14 === 0)
  const approach: Approach = hold ? 'hold' : axis === 'market' ? 'market' : 'ax'
  const approachWhy = hold
    ? c.dominant
      ? `${c.dominant} 혼자 올린 주제라 아직 흐름이 아닙니다 — 다음 주에 다시 보세요`
      : '최근 2주에 올라온 영상이 없습니다 — 다음 주에 다시 보세요'
    : axis === 'market'
      ? '사람들이 이미 찾는 주제 — 우리 관점으로 정리해 바로 찍을 만합니다'
      : axis === 'bridge'
        ? '시장 수요가 확인된 주제에 우리 AX 이야기를 붙입니다'
        : '실무 장면으로 보여 주는 MIRAE AX형'
  return {
    key: `${axis}:${c.topicId}`,
    axis,
    topicId: c.topicId,
    topic: axis === 'bridge' && angle.name ? `${def.label} × ${angle.name}` : def.label,
    strength: c.strength,
    summary: summaryOf(axis, c, def.label, axSignal),
    facts: factsOf(axis, c, def.label, axSignal),
    whyNow: whyNow.slice(0, 4),
    cluster: c,
    benchmarks: pickBenchmarks(c),
    view: angle.view,
    // BRIDGE 는 써 둔 순서 그대로(첫 제목이 'AI · 자동화' 를 가장 또렷하게 말한다) · 나머지는 이번 달 잘된 제목 구조 먼저
    titles: axis === 'bridge' ? angle.titles.map((text) => ({ text, patterns: titlePatterns(text) })) : titlesFor(angle, hot),
    thumbs: [...angle.thumbs],
    approach,
    approachWhy,
  }
}

/** 후보 키('축:주제') → 화면 이름(숨긴 주제 목록 · 데이터가 없어 후보에 없을 때도) */
export function opportunityLabel(key: string): { axis: ContentAxis | null; label: string } {
  const [axis, id] = key.split(':')
  const def = TOPIC_BY_ID.get(id ?? '')
  const ax = axis === 'market' || axis === 'axai' || axis === 'bridge' ? axis : null
  if (!def) return { axis: ax, label: key }
  return { axis: ax, label: ax === 'bridge' && def.bridge?.name ? `${def.label} × ${def.bridge.name}` : def.label }
}

export interface RadarPlan {
  /** 최대 10개 — 앞 5개가 '이번 주 찍을 것' */
  picks: Opportunity[]
  /** AI · AX 벤치마킹 데이터가 모자라다(채널이 없거나 30일 안 관련 영상이 없음) */
  aiDataShort: boolean
  /** AI · AX 묶음 채널 수 */
  aiChannels: number
  clusters: Cluster[]
  hot: PatternStat[]
  mix: MixGuide
  /** 숨긴 후보 키(화면 '숨긴 주제' 관리용) */
  muted: string[]
}

const MAX_PICKS = 10

/**
 * 이번 주 후보 순서(D-195) — 데이터가 센 후보가 먼저(신호 세기 → 묶음 안 비율 → 터진 영상 수 …, clusterOrder).
 * 비중 가이드는 '안내' — 앞 5개 안에서만 ① 한 종류가 몰리지 않게(종류마다 많아야 가이드 몫 + 1개: 기본 45 · 35 · 20 → 3 · 3 · 2)
 * ② 비중을 준 종류에 쓸 만한 후보(초기 신호 아님)가 있으면 적어도 1개. 4.5 · 3.5 · 2 개를 억지로 맞추지 않는다.
 * 같은 주제가 시장형 · BRIDGE 두 장으로 겹치면 뒤로 · 비중 0 인 종류는 맨 뒤(빈자리 채움).
 */
export function mixPicks(pools: Record<ContentAxis, Opportunity[]>, mix: MixGuide, max = MAX_PICKS): Opportunity[] {
  const total = mix.market + mix.axai + mix.bridge
  const share: Record<ContentAxis, number> = { market: mix.market / total, axai: mix.axai / total, bridge: mix.bridge / total }
  const axes: ContentAxis[] = ['market', 'axai', 'bridge']
  const FRONT = Math.min(5, max)
  const cap = (a: ContentAxis) => (share[a] > 0 ? Math.round(share[a] * 5) + 1 : 0)
  const left = axes.flatMap((a) => pools[a]).sort((x, y) => clusterOrder(x.cluster, y.cluster) || axes.indexOf(x.axis) - axes.indexOf(y.axis))
  const count: Record<ContentAxis, number> = { market: 0, axai: 0, bridge: 0 }
  const used = new Set<string>()
  const out: Opportunity[] = []
  while (out.length < FRONT && left.length > 0) {
    const slots = FRONT - out.length
    // 아직 하나도 없는데 쓸 만한 후보가 남은 종류 — 남은 자리가 그 수만큼이면 그 종류에서만
    const must = axes.filter((a) => share[a] > 0 && count[a] === 0 && left.some((o) => o.axis === a && o.strength !== 'early'))
    const ok = (o: Opportunity) => count[o.axis] < cap(o.axis) && (must.length < slots || must.includes(o.axis))
    let i = left.findIndex((o) => ok(o) && !used.has(o.topicId))
    if (i < 0) i = left.findIndex(ok)
    if (i < 0) break
    const o = left.splice(i, 1)[0]
    out.push(o)
    count[o.axis] += 1
    used.add(o.topicId)
  }
  const rest: Opportunity[] = []
  const dup: Opportunity[] = []
  const zero: Opportunity[] = []
  for (const o of left) {
    if (share[o.axis] === 0) zero.push(o)
    else if (used.has(o.topicId)) dup.push(o)
    else {
      rest.push(o)
      used.add(o.topicId)
    }
  }
  return [...out, ...rest, ...dup, ...zero].slice(0, max)
}

/** '지금은 보류' 카드는 맨 뒤로 — 앞 5개(이번 주 찍을 것)는 찍을 만한 것만 */
function withHoldsLast(pools: Record<ContentAxis, Opportunity[]>, mix: MixGuide): Opportunity[] {
  const ready: Record<ContentAxis, Opportunity[]> = { market: [], axai: [], bridge: [] }
  const holds: Opportunity[] = []
  for (const a of ['market', 'axai', 'bridge'] as const) for (const o of pools[a]) (o.approach === 'hold' ? holds : ready[a]).push(o)
  const picked = mixPicks(ready, mix)
  return [...picked, ...holds].slice(0, MAX_PICKS)
}

/** videos 를 넘기면(화면에서 이미 계산한 것) 다시 계산하지 않는다 */
export function radarPlan(p: Prepared, opts: RadarOptions = {}, precomputed?: readonly RadarVideo[]): RadarPlan {
  const videos = precomputed ?? radarVideos(p, opts)
  const cs = clusters(videos)
  const hot = hotPatterns(videos)
  const mix = normalizeMix(opts.mix)
  const market = cs.filter((c) => c.area === 'market')
  const aiax = cs.filter((c) => c.area !== 'market')
  const off = new Set(Object.entries(opts.overrides ?? {}).filter(([, o]) => o.enabled === false).map(([id]) => id))
  const aiChannels = p.channels.filter((c) => !off.has(c.id) && !c.mine && ['ai', 'ax'].includes(groupOf(c as YtChannel & { group?: unknown }, opts.overrides))).length
  const aiDataShort = aiChannels === 0 || aiax.length === 0
  const axTop = aiax.find((c) => c.strength !== 'early')
  const muted = new Set(opts.muted ?? [])
  const pools: Record<ContentAxis, Opportunity[]> = {
    market: market.map((c) => opportunity('market', c, hot, undefined)).filter((o): o is Opportunity => o !== null),
    // AI · AX 벤치마킹 채널이 없으면 시장 채널에 섞인 AI 영상 몇 편으로 억지 후보를 만들지 않는다(신호 보통 이상만)
    axai: aiax
      .filter((c) => !aiDataShort || c.strength !== 'early')
      .map((c) => opportunity('axai', c, hot, undefined))
      .filter((o): o is Opportunity => o !== null),
    // BRIDGE 는 시장 신호가 보통 이상인 주제 먼저(시장 수요가 있어야 다리를 놓는다) — 초기 신호는 뒤로
    bridge: market.map((c) => opportunity('bridge', c, hot, axTop)).filter((o): o is Opportunity => o !== null),
  }
  // [관심 없음] 으로 숨긴 후보는 뺀다 — 정확히 그 후보(축:주제)만(같은 주제의 다른 축 · 비슷한 낱말은 그대로)
  for (const a of ['market', 'axai', 'bridge'] as const) pools[a] = pools[a].filter((o) => !muted.has(o.key))
  return { picks: withHoldsLast(pools, mix), aiDataShort, aiChannels, clusters: cs, hot, mix, muted: [...muted] }
}

/* ------------------------------------------------------------------ */
/* 시장 신호 — 급상승 주제(분류표 밖 단어 포함) · 평소보다 터진 영상             */
/* ------------------------------------------------------------------ */

export interface RisingTopic {
  label: string
  /** 분류표 주제면 그 번호 · 아니면 '' (MIRAE 분야 밖 — 참고만) */
  topicId: string
  videos14: number
  channels14: number
  growing: boolean
  breakouts: number
  fit: boolean
}

/** 급상승 주제 — 분류표 주제(늘어나는 것) + 분류표에 없는 단어(D-193 주목 주제, 최근 14일) */
export function risingTopics(p: Prepared, videos: readonly RadarVideo[], cs: readonly Cluster[], max = 6): RisingTopic[] {
  const out: RisingTopic[] = cs
    .filter((c) => c.videos14 >= 2 && (c.growing || c.channels14 >= 2))
    .map((c) => ({ label: c.label, topicId: c.topicId, videos14: c.videos14, channels14: c.channels14, growing: c.growing, breakouts: c.breakouts, fit: true }))
  const ids = new Set(videos.filter((v) => isBench(v)).map((v) => v.id))
  const recent = periodVideos(
    p.videos.filter((v) => ids.has(v.id)),
    'month',
  ).filter((v) => v.daysAgo <= 14)
  for (const t of extractTopics(recent, p.channelWords, 6)) {
    const norm = normalizeTitle(t.keyword)
    if (TOPICS.some((d) => d.match.test(norm))) continue
    const hitIds = new Set(recent.filter((v) => t.keyword.split(' ').every((w) => v.title.includes(w))).map((v) => v.id))
    out.push({
      label: t.keyword,
      topicId: '',
      videos14: t.videos,
      channels14: t.channels,
      growing: false,
      breakouts: videos.filter((v) => hitIds.has(v.id) && v.tier === 'breakout').length,
      fit: false,
    })
  }
  return out.slice(0, max)
}

/** 평소보다 터진 영상 — 30일 안 · 나이 반영 배수 순(작은 채널 · 최근 것이 앞으로 오도록 같은 배수면 최근 순) */
export function breakoutVideos(videos: readonly RadarVideo[], days = 30, max = 12, perChannel = 2): RadarVideo[] {
  const per = new Map<string, number>()
  const out: RadarVideo[] = []
  const sorted = videos.filter((v) => !v.mine && v.ageDays <= days && v.tier === 'breakout').sort((a, b) => (b.adjusted ?? 0) - (a.adjusted ?? 0) || a.ageDays - b.ageDays)
  // 한 채널이 판을 다 차지하지 않게 채널마다 두 편까지
  for (const v of sorted) {
    if (out.length >= max) break
    if ((per.get(v.channelId) ?? 0) >= perChannel) continue
    per.set(v.channelId, (per.get(v.channelId) ?? 0) + 1)
    out.push(v)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 영상 상세 — 참고할 것(규칙 문장)                                          */
/* ------------------------------------------------------------------ */

export function lessonsOf(v: RadarVideo, cs: readonly Cluster[]): string[] {
  const out: string[] = []
  if (v.ratio !== null && (v.tier === 'breakout' || v.tier === 'above')) out.push(`이 채널 평소 ${v.isShort ? '쇼츠' : '롱폼'}보다 조회가 빠릅니다 — ${ratioLine(v)}`)
  if (v.small && v.viewsPerSub >= 1) out.push(`구독자 ${shortSubs(v.channelSubs)} 채널인데 조회수가 구독자의 ${v.viewsPerSub.toFixed(1)}배`)
  for (const id of v.patterns.slice(0, 3)) {
    const p = TITLE_PATTERNS.find((x) => x.id === id)
    if (!p) continue
    if (id === 'number' && /^\s*[\d[(]/.test(v.title)) out.push('숫자를 제목 맨 앞에 둠')
    else out.push(p.note)
  }
  const mins = Math.round(v.durationSec / 60)
  out.push(v.isShort ? `${v.durationSec}초 쇼츠` : `${mins}분 롱폼`)
  for (const id of v.topics) {
    const c = cs.find((x) => x.topicId === id)
    if (c && c.channels14 >= 2) out.push(`최근 2주 같은 주제(${c.label})가 ${c.channels14}개 채널에서 올라옴`)
  }
  return out.slice(0, 6)
}

/* ------------------------------------------------------------------ */
/* 내 채널(최근 20편)                                                      */
/* ------------------------------------------------------------------ */

export interface MyChannelStats {
  count: number
  longMedian: number | null
  shortMedian: number | null
  longCount: number
  shortCount: number
  perDayMedian: number
  bestTopic: { label: string; median: number; count: number } | null
  bestPattern: { label: string; median: number; count: number } | null
  bestLength: { label: string; median: number; count: number } | null
  /** 평균 업로드 간격(일) */
  cadenceDays: number | null
}

export function myChannelStats(videos: readonly RadarVideo[], n = 20): MyChannelStats | null {
  const mine = videos.filter((v) => v.mine).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, n)
  if (mine.length === 0) return null
  const longs = mine.filter((v) => !v.isShort)
  const shorts = mine.filter((v) => v.isShort)
  const best = (keyOf: (v: RadarVideo) => string[], labelOf: (k: string) => string) => {
    const m = new Map<string, number[]>()
    for (const v of mine) for (const k of keyOf(v)) m.set(k, [...(m.get(k) ?? []), v.views])
    const rows = [...m.entries()].filter(([, xs]) => xs.length >= 2).map(([k, xs]) => ({ label: labelOf(k), median: median(xs), count: xs.length }))
    return rows.sort((a, b) => b.median - a.median)[0] ?? null
  }
  const ts = mine.map((v) => v.publishedAt).sort((a, b) => a - b)
  return {
    count: mine.length,
    longMedian: longs.length ? median(longs.map((v) => v.views)) : null,
    shortMedian: shorts.length ? median(shorts.map((v) => v.views)) : null,
    longCount: longs.length,
    shortCount: shorts.length,
    perDayMedian: median(mine.map((v) => v.perDay)),
    bestTopic: best((v) => v.topics, (k) => TOPIC_BY_ID.get(k)?.label ?? k),
    bestPattern: best((v) => v.patterns, (k) => PATTERN_LABEL[k] ?? k),
    bestLength: best((v) => [v.bucket], (k) => k),
    cadenceDays: ts.length >= 2 ? Math.round(((ts[ts.length - 1] - ts[0]) / DAY / (ts.length - 1)) * 10) / 10 : null,
  }
}

export { SHORT_MAX_SEC }
