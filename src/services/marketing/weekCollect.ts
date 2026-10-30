/**
 * D-349 1주일치 결과 모으기 — 대표: "한 번이라도 API 돌렸으면 그 결과가 내 콘텐츠나 여기에 모여야 되는데 안 된 것 같거든".
 *  - 한 주 결과(WeekSaved)를 클라우드(모듈 기록 · marketing/weeks)에도 남긴다 — 휴대폰에서 만든 주가 PC 에서도 그대로 보인다.
 *  - AI 가 쓴 글만 각 목록으로: 롱폼 → 내 콘텐츠(대본 준비 · 롱폼 올릴 날) · 쇼츠 · 릴스 3 → 릴스 · 틱톡 목록 · 스레드 7 → 스레드 목록(쓰다 둔 글).
 *  - 같은 주 같은 자리는 같은 줄(id 고정 · 작업공간마다 다름) — 다시 써도 줄이 늘지 않는다.
 *  - 올린 글 · 직접 고친 글은 덮지 않는다 — 목록 글이 예전 AI 글 그대로일 때만 새 글로 바꾼다.
 *  - 예비(쇼츠 다른 버전 · 스레드 예비 둘)는 1주일치 화면에만 둔다.
 */
import { listRows, saveRow } from '../moduleData'
import { DEFAULT_BRIEF, listIdeas, normalizeIdea, saveIdea, type ContentIdea } from './radarStore'
import { listShortPosts, normalizeShortPost, saveShortPost, type ShortPost } from './shorts'
import { listThreadPosts, normalizeThreadPost, saveThreadPost, type ThreadPost } from './threads'
import { LONG_DAY, buildWeek, dateOf, dayLabel, normalizeWeekSaved, tagOf, type WeekPart, type WeekSaved } from './weekPlan'

export const WEEKS_MODULE = 'marketing'
export const WEEKS_BUCKET = 'weeks'

const wsTag = (ws: string | null) => (ws ?? 'local').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || 'local'
export const weekRowId = (ws: string | null, start: string) => `mkw_${wsTag(ws)}_${start}`
/** 기록표에서 '1주일치 · 11/3(화)' 표시 — 1주일치에서 모은 줄이 아니면 null */
export function weekBadge(p: { id: string; topic: string }): string | null {
  if (!p.id.startsWith('mkw_')) return null
  const day = /^\d{1,2}\/\d{1,2}\([월화수목금토일]\)/.exec(p.topic)?.[0]
  return day ? `1주일치 · ${day}` : '1주일치'
}

/** 목록 줄 id — 롱폼 l · 쇼츠 s1~s3 · 스레드 t1~t7 */
export const weekItemId = (ws: string | null, start: string, slot: string) => `${weekRowId(ws, start)}_${slot}`

export async function loadWeeksCloud(ws: string | null): Promise<WeekSaved[]> {
  const rows = await listRows(ws, WEEKS_MODULE, WEEKS_BUCKET)
  return rows.map((r) => normalizeWeekSaved(r.data)).filter((x): x is WeekSaved => x !== null)
}

export async function saveWeekCloud(ws: string | null, saved: WeekSaved): Promise<void> {
  await saveRow(ws, WEEKS_MODULE, WEEKS_BUCKET, { id: weekRowId(ws, saved.start), data: saved as unknown as Record<string, unknown> })
}

/* ------------------------------------------------------------------ */
/* 한 주 → 목록 줄(AI 가 쓴 것만)                                          */
/* ------------------------------------------------------------------ */

export interface WeekRows {
  idea: ContentIdea | null
  shorts: ShortPost[]
  threads: ThreadPost[]
}

const NO_SETUP = { pairs: [], trend: [] }
const SHORT_PART: Record<number, WeekPart> = { 1: 'shortA', 2: 'shortA', 3: 'shortB' }
const THREAD_PART = (day: number): WeekPart => (day <= 3 ? 'th0' : day <= 6 ? 'th1' : 'th2')

/** parts 를 주면 그 갈래가 쓴 줄만(갈래 답이 올 때마다 그만큼만 저장) */
export function weekRows(ws: string | null, saved: WeekSaved, parts?: readonly WeekPart[], at = new Date().toISOString()): WeekRows {
  // 주제 이름 · 글은 모두 저장된 결과에서 — 규칙 초안(AI 아님)은 목록으로 보내지 않는다
  const w = buildWeek(NO_SETUP, DEFAULT_BRIEF, saved.start, saved)
  const want = (p: WeekPart) => !parts || parts.includes(p)
  const start = saved.start
  const range = `${dayLabel(start, 1)} ~ ${dayLabel(start, 7)}`
  // 기록표는 저장한 때 늦은 순 — 요일이 빠른 글이 위에 오게 1초씩 당겨 적는다
  const stamp = (day: number) => {
    const t = Date.parse(at)
    return Number.isNaN(t) ? at : new Date(t - day * 1000).toISOString()
  }

  let idea: ContentIdea | null = null
  if (want('long') && w.long.ai) {
    const script = [...(w.long.headline ? [{ label: '확정 제목', text: w.long.headline }] : []), ...w.long.titles, ...w.long.script].map((b) => `[${b.label}]\n${b.text}`).join('\n\n')
    idea = normalizeIdea(
      {
        key: `week:${start}`,
        topic: w.long.headline || w.long.topic,
        topicId: `week-${start}`,
        angle: `1주일치 콘텐츠(${range}) · ${w.long.topic}`,
        type: 'bridge',
        titleCandidates: w.long.titles.map((b) => b.text.split('\n')[0]).filter(Boolean),
        whyNow: [`${range} 1주일치에서 AI 로 쓴 롱폼 — ${dayLabel(start, LONG_DAY)} 올리기`],
        savedAt: at,
        status: 'script',
        publishDate: dateOf(start, LONG_DAY),
        source: 'radar',
        script,
      },
      weekItemId(ws, start, 'l'),
    )
  }

  const shorts = w.shorts
    .filter((s) => s.slot.n > 0 && s.ai && want(SHORT_PART[s.slot.n]))
    .map((s) =>
      normalizeShortPost(
        {
          savedAt: stamp(s.slot.day),
          platform: s.slot.platform,
          aim: 'reach',
          format: s.draft.format,
          topic: `${dayLabel(start, s.slot.day)} · ${s.topic}`,
          script: s.draft.script,
          caption: s.draft.caption,
          hashtags: s.draft.hashtags,
          checks: s.lint.lines,
          status: 'draft',
          source: 'ai',
        },
        weekItemId(ws, start, `s${s.slot.n}`),
      ),
    )
    .filter((x): x is ShortPost => x !== null)

  const threads = w.threads
    .filter((x) => x.slot.day > 0 && x.ai && want(THREAD_PART(x.slot.day)))
    .map((x) =>
      normalizeThreadPost(
        {
          savedAt: stamp(x.slot.day),
          template: x.draft.template || x.slot.template,
          goal: x.slot.goal,
          topic: `${dayLabel(start, x.slot.day)} · ${x.slot.aim} — ${x.topic}`,
          tag: tagOf(x.topic),
          body: x.draft.body,
          selfComment: x.draft.selfComment,
          checks: x.draft.checks,
          status: 'draft',
          source: 'ai',
        },
        weekItemId(ws, start, `t${x.slot.day}`),
      ),
    )
    .filter((x): x is ThreadPost => x !== null)

  return { idea, shorts, threads }
}

/* ------------------------------------------------------------------ */
/* 목록에 넣기 — 없으면 새로 · 예전 AI 글 그대로면 바꾸기 · 고쳤거나 올렸으면 그대로   */
/* ------------------------------------------------------------------ */

export type RowDecision = 'write' | 'same' | 'kept' | 'posted'

/** 목록에 이미 있는 글(old) · 그 자리의 예전 AI 글(prev) · 새 AI 글(next) */
export function decideRow(old: { text: string; posted: boolean } | undefined, prev: string | undefined, next: string): RowDecision {
  if (!old) return 'write'
  if (old.posted) return 'posted'
  if (old.text === next) return 'same'
  return prev !== undefined && old.text === prev ? 'write' : 'kept'
}

export interface CollectResult {
  /** 이번에 목록에 있게 된 줄 id(새로 · 같음 · 고친 것 그대로 · 올린 것) */
  ids: { idea: string[]; shorts: string[]; threads: string[] }
  /** 대표가 고친 글이라 덮지 않은 줄 */
  keptIds: string[]
  written: number
  kept: number
  posted: number
}

/** next = 새 결과 · prev = 그 직전 결과(없으면 null — 목록 글이 다르면 고친 것으로 보고 둔다) */
export async function collectWeek(ws: string | null, next: WeekSaved, prev: WeekSaved | null, parts?: readonly WeekPart[]): Promise<CollectResult> {
  const rows = weekRows(ws, next, parts)
  const before = prev ? weekRows(ws, prev, parts) : null
  const out: CollectResult = { ids: { idea: [], shorts: [], threads: [] }, keptIds: [], written: 0, kept: 0, posted: 0 }
  const tally = (d: RowDecision, id: string) => {
    if (d === 'write') out.written += 1
    if (d === 'kept') (out.kept += 1, out.keptIds.push(id))
    if (d === 'posted') out.posted += 1
  }

  const [ideas, shorts, threads] = await Promise.all([
    rows.idea ? listIdeas(ws) : Promise.resolve([] as ContentIdea[]),
    rows.shorts.length ? listShortPosts(ws) : Promise.resolve([] as ShortPost[]),
    rows.threads.length ? listThreadPosts(ws) : Promise.resolve([] as ThreadPost[]),
  ])

  if (rows.idea) {
    const n = rows.idea
    const old = ideas.find((i) => i.id === n.id)
    const d = decideRow(old && { text: old.script, posted: old.status === 'filmed' || old.status === 'published' }, before?.idea?.script, n.script)
    tally(d, n.id)
    // 바꿀 때도 대표가 정한 단계 · 메모 · 촬영일 · 체크는 그대로
    if (d === 'write') await saveIdea(ws, old ? { ...old, topic: n.topic, angle: n.angle, titleCandidates: n.titleCandidates, whyNow: n.whyNow, script: n.script, savedAt: n.savedAt } : n)
    out.ids.idea.push(n.id)
  }

  const prevShort = new Map((before?.shorts ?? []).map((s) => [s.id, s.script]))
  for (const n of rows.shorts) {
    const old = shorts.find((s) => s.id === n.id)
    const d = decideRow(old && { text: old.script, posted: old.status === 'posted' }, prevShort.get(n.id), n.script)
    tally(d, n.id)
    if (d === 'write') await saveShortPost(ws, old ? { ...old, topic: n.topic, format: n.format, script: n.script, caption: n.caption, hashtags: n.hashtags, checks: n.checks, savedAt: n.savedAt } : n)
    out.ids.shorts.push(n.id)
  }

  const prevThread = new Map((before?.threads ?? []).map((t) => [t.id, t.body]))
  for (const n of rows.threads) {
    const old = threads.find((t) => t.id === n.id)
    const d = decideRow(old && { text: old.body, posted: old.status === 'posted' }, prevThread.get(n.id), n.body)
    tally(d, n.id)
    if (d === 'write') await saveThreadPost(ws, old ? { ...old, template: n.template, goal: n.goal, topic: n.topic, tag: n.tag, body: n.body, selfComment: n.selfComment, checks: n.checks, savedAt: n.savedAt } : n)
    out.ids.threads.push(n.id)
  }
  return out
}
