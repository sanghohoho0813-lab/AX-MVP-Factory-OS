/**
 * D-232 내 콘텐츠 성과 — 올린 영상 ↔ 내 채널 영상 → 평소 대비 · 어떤 축 · 어떤 제목 틀이 우리 채널에서 잘 됐나.
 *
 * 대표: "이번 주 잘 터지는 것을 보고 틀을 가져와 내 스타일로 찍는다" — 찍고 올린 뒤에 우리 채널에서 실제로 어땠는지가
 * 다음 주제를 고르는 근거가 된다(레이더 로드맵 5 '성과 학습').
 *  - 레이더가 이미 받은 피드 안의 내 채널 영상(최근 50편)만 쓴다 — 유튜브를 더 부르지 않는다(할당량 0).
 *  - 올린 주소가 유튜브 영상이면 그 영상 숫자. 주소가 없으면 담기 30일 전부터 올린 내 영상 중 제목에 주제 낱말이 들어간 것을
 *    (이미 올린 영상을 나중에 적어 두는 경우까지)
 *    '이 영상인가요?' 로만 묻는다(대표가 [맞아요] 를 눌러야 잇는다 — 짐작으로 잇지 않음).
 *  - 평소 대비는 레이더와 같은 식(같은 채널 · 같은 형식 7일 넘은 영상 중앙값, 올린 지 7일 안 된 영상은 나이 보정).
 *  - 노출 · 클릭률 · 시청 지속시간은 공개 숫자에 없어 어림하지 않는다(YouTube Analytics 연결 뒤).
 */
import type { ContentIdea } from './radarStore'
import type { ContentAxis } from './radarPlaybook'
import { AXIS_LABEL, PATTERN_LABEL, type RadarVideo } from './ytRadar'

// 유튜브 영상 번호는 11자 — 예시 데이터(sample_0_3)도 같은 길로 시험할 수 있게 6~20자 글자 · 숫자 · _ · - 만
const ID_RE = /^[A-Za-z0-9_-]{6,20}$/

/** 유튜브 영상 주소 → 영상 번호. 유튜브 영상 주소가 아니면 '' */
export function youtubeIdOf(link: string): string {
  let u: URL
  try {
    u = new URL(String(link ?? '').trim())
  } catch {
    return ''
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  let id = ''
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? ''
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') ?? ''
    else {
      const m = /^\/(shorts|live|embed|v)\/([^/?#]+)/.exec(u.pathname)
      id = m?.[2] ?? ''
    }
  }
  return ID_RE.test(id) ? id : ''
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

export type PerfTone = 'good' | 'normal' | 'low' | 'unknown'

export interface VideoPerf {
  video: RadarVideo
  /** 나이 보정한 평소 대비(없으면 null — 비교할 영상이 3편 미만) */
  x: number | null
  tone: PerfTone
  /** '평소 1.8배' · '평소와 비교할 영상이 아직 적어요' */
  label: string
  /** '올린 지 5일 · 조회 12,345' */
  meta: string
}

const fmtX = (x: number) => (x >= 10 ? String(Math.round(x)) : x.toFixed(1))

export function perfOf(v: RadarVideo): VideoPerf {
  const x = v.adjusted
  const tone: PerfTone = x === null ? 'unknown' : x >= 1.5 ? 'good' : x < 0.7 ? 'low' : 'normal'
  const label = x === null ? '평소와 비교할 영상이 아직 적어요' : `평소 ${fmtX(x)}배${v.young ? '(올린 지 7일 안 됨 · 나이 보정)' : ''}`
  const days = Math.floor(v.ageDays)
  return { video: v, x, tone, label, meta: `올린 지 ${days === 0 ? '오늘' : `${days}일`} · 조회 ${v.views.toLocaleString('ko-KR')}` }
}

/** 이 줄에 이어진 내 영상(올린 주소의 영상 번호가 내 채널 피드에 있을 때) */
export function linkedVideo(i: Pick<ContentIdea, 'link'>, mineById: ReadonlyMap<string, RadarVideo>): RadarVideo | null {
  const id = youtubeIdOf(i.link)
  return id ? (mineById.get(id) ?? null) : null
}

const STOP = new Set(['대표', '대표님', '방법', '정리', '이유', '진짜', '지금', '오늘', '이번', '모든', '정말', '관련', '활용', '하는', '있는', '없는', '그리고'])

/** 낱말 — 2자 이상 · 조사 한 글자 떼기 · 흔한 말 빼기 */
function wordsOf(text: string): string[] {
  const out = new Set<string>()
  for (const raw of String(text ?? '').toLowerCase().split(/[\s·×,./|!?'"“”‘’()[\]:~\-—]+/)) {
    const w = raw.replace(/(은|는|이|가|을|를|의|에|로|와|과|도|만)$/, '')
    if (w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)) out.add(w)
  }
  return [...out]
}

const squash = (s: string) => String(s ?? '').toLowerCase().replace(/\s+/g, '')

/** 이 줄과 영상 제목이 얼마나 닮았나 — 주제가 통째로 들어가면 크게, 아니면 겹치는 낱말 수 */
export function matchScore(i: Pick<ContentIdea, 'topic' | 'titleCandidates'>, title: string): number {
  const t = squash(title)
  const main = i.topic.split(/\s*×\s*/)[0]
  if (squash(main).length >= 3 && t.includes(squash(main))) return 10
  const words = new Set([...wordsOf(i.topic), ...wordsOf(i.titleCandidates[0] ?? '')])
  let n = 0
  for (const w of words) if (t.includes(w)) n += 1
  return n
}

const DAY = 86_400_000
/** 담기 전 며칠까지 올린 영상을 후보로 보나 — 올린 뒤에 수첩에 적는 경우가 있어서 */
const BEFORE_SAVE_DAYS = 30

/**
 * 주소가 없는 줄 → '이 영상인가요?' 후보 하나씩. 이미 다른 줄에 이어진 영상 · 담기 30일보다 전에 올린 영상은 빼고,
 * 점수 2 이상(주제 통째 또는 낱말 2개)만. 같은 영상이 두 줄에 걸리면 점수 높은 줄에만.
 */
export function suggestMatches(ideas: readonly ContentIdea[], mine: readonly RadarVideo[]): Map<string, RadarVideo> {
  const taken = new Set(ideas.map((i) => youtubeIdOf(i.link)).filter(Boolean))
  const pairs: { idea: string; video: RadarVideo; score: number }[] = []
  for (const i of ideas) {
    if (i.link.trim()) continue
    const saved = Date.parse(i.savedAt)
    for (const v of mine) {
      if (taken.has(v.id)) continue
      if (Number.isFinite(saved) && v.publishedAt < saved - BEFORE_SAVE_DAYS * DAY) continue
      const score = matchScore(i, v.title)
      if (score >= 2) pairs.push({ idea: i.id, video: v, score })
    }
  }
  pairs.sort((a, b) => b.score - a.score || b.video.publishedAt - a.video.publishedAt)
  const out = new Map<string, RadarVideo>()
  const used = new Set<string>()
  for (const p of pairs) {
    if (out.has(p.idea) || used.has(p.video.id)) continue
    out.set(p.idea, p.video)
    used.add(p.video.id)
  }
  return out
}

export interface LearnRow {
  key: string
  label: string
  count: number
  /** 평균 평소 대비 */
  avg: number
}

export interface MyLearning {
  /** 이어진 영상 수(평소 대비를 잴 수 없는 영상 포함) */
  linked: number
  /** 평소 대비를 잰 영상 수 */
  measured: number
  byAxis: LearnRow[]
  byPattern: LearnRow[]
  best: { idea: ContentIdea; perf: VideoPerf } | null
  /** 화면 · 브리프에 그대로 쓰는 몇 줄 */
  lines: string[]
}

function rows(groups: Map<string, { label: string; xs: number[] }>): LearnRow[] {
  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, count: g.xs.length, avg: g.xs.reduce((s, x) => s + x, 0) / g.xs.length }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
}

/** 이어진 내 영상으로 — 어떤 축 · 어떤 제목 틀이 우리 채널에서 평소보다 잘 됐나(2편부터 말하고, 1편이면 '아직 한 편') */
export function learnFromMine(ideas: readonly ContentIdea[], mine: readonly RadarVideo[]): MyLearning {
  const byId = new Map(mine.map((v) => [v.id, v]))
  const pairs = ideas.map((idea) => ({ idea, v: linkedVideo(idea, byId) })).filter((p): p is { idea: ContentIdea; v: RadarVideo } => p.v !== null)
  const measured = pairs.filter((p) => p.v.adjusted !== null)
  const axis = new Map<string, { label: string; xs: number[] }>()
  const pattern = new Map<string, { label: string; xs: number[] }>()
  for (const { idea, v } of measured) {
    const x = v.adjusted as number
    const ak = idea.source === 'custom' ? 'custom' : idea.type
    const al = idea.source === 'custom' ? '직접 담은 주제' : AXIS_LABEL[idea.type as ContentAxis]
    axis.set(ak, { label: al, xs: [...(axis.get(ak)?.xs ?? []), x] })
    for (const p of v.patterns) pattern.set(p, { label: PATTERN_LABEL[p] ?? p, xs: [...(pattern.get(p)?.xs ?? []), x] })
  }
  const byAxis = rows(axis)
  const byPattern = rows(pattern)
  const bestPair = [...measured].sort((a, b) => (b.v.adjusted as number) - (a.v.adjusted as number))[0] ?? null
  const best = bestPair ? { idea: bestPair.idea, perf: perfOf(bestPair.v) } : null
  const lines: string[] = []
  if (measured.length === 1 && best) lines.push(`아직 한 편 — '${best.idea.topic}' ${best.perf.label}. 두 편부터 축 · 제목 틀을 비교해요.`)
  if (measured.length >= 2) {
    const top = byAxis[0]
    if (top) lines.push(`우리 채널에서는 ${top.label} 영상이 평소의 ${fmtX(top.avg)}배(${top.count}편)${byAxis[1] ? ` — ${byAxis.slice(1).map((r) => `${r.label} ${fmtX(r.avg)}배(${r.count}편)`).join(' · ')}` : ''}`)
    const tp = byPattern.find((r) => r.count >= 2) ?? null
    if (tp) lines.push(`제목은 ${tp.label}이 평소의 ${fmtX(tp.avg)}배(${tp.count}편) — 다음 제목도 이 틀로 한 번 더`)
    if (best) lines.push(`가장 잘 된 영상: '${best.idea.topic}' — ${best.perf.label}`)
  }
  return { linked: pairs.length, measured: measured.length, byAxis, byPattern, best, lines }
}
