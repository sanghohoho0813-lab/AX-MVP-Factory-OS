/**
 * D-346 1주일치 한 번에 — 이번 주 키워드 1~3위로 유튜브 롱폼 1 · 릴스/쇼츠 3 · 스레드 7(+예비 2).
 * 대표: "버튼 하나만 누르면 1주일치 유튜브 롱폼 1개, 릴스쇼츠 영상 3개, 스레드 글 7개 한 번에 쫙 —
 *        트렌드 잇는 주제 벤치마킹해서, 기존 마케팅 공식들 잘 적용해서 100점짜리 결과".
 *
 *  - 주제: 이번 주 키워드(벤치마킹 채널 최근 2주에 함께 오른 주제 · 레이더 순위) 1위 = 롱폼 + 롱폼을 잘라 쓰는 쇼츠 둘 + 스레드 월~수,
 *    2위 = 릴스 하나 + 스레드 목~토, 3위 = 스레드 일요일 + 예비 둘. 키워드가 셋보다 적으면 고정 키워드(본업 주제)로 채운다.
 *  - 글은 이미 있는 공식 단추 그대로 부른다(서버 지시 · 규칙집을 새로 만들지 않는다):
 *    롱폼 = 키워드 묶음 유튜브 갈래(radar.pack.video) · 쇼츠 = 릴스 · 틱톡 대본(shorts.write · 2편씩 두 번) ·
 *    스레드 = 스레드 글 3개(threads.write · 세 번 — 글마다 요일 · 목적 · 틀을 정해 보낸다). 여섯 갈래를 동시에.
 *  - 규칙 초안(AI 아님)을 바로 보여 주고 답이 온 갈래부터 바꾼다. 글마다 기존 점검(스레드 · 숏폼 공식 · 빈칸 · 쓰지 않는 말)으로 '점검 통과 / 고칠 곳'.
 *  - 시청자 글에 레이더가 센 숫자(채널 수 · 영상 수)를 넣지 않는다 — 우리가 고른 근거일 뿐.
 */
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { packBundle } from '../aiAssist/builders'
import { HOLE, PACK_AVOID, aiSections, makePack, type PackBlock, type PackSectionId, type PackSource } from './contentPack'
import type { ChannelBrief } from './radarStore'
import { formatsFor, lintShort, parseShortDrafts, shortsContext, type ShortDraft, type ShortPlatform } from './shorts'
import { GOALS, TOPIC_TAGS, lintThreadPost, parseThreadDrafts, skeletonDraft, templateOf, threadsContext, type ThreadDraft, type ThreadGoal, type ThreadTemplateKey } from './threads'

/* ------------------------------------------------------------------ */
/* 주 · 주제                                                             */
/* ------------------------------------------------------------------ */

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** 만들 주의 월요일 — 월 · 화요일이면 이번 주, 수요일부터는 다음 주(남은 날이 적어 다음 주 치를 미리) */
export function weekStart(today: string): string {
  const d = new Date(`${today}T00:00:00`)
  const w = (d.getDay() + 6) % 7 // 월 0 … 일 6
  const monday = addDays(today, -w)
  return w <= 1 ? monday : addDays(monday, 7)
}

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
/** 1(월) ~ 7(일) → '11/2(월)' */
export function dayLabel(start: string, day: number): string {
  const d = addDays(start, day - 1)
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${DAY_NAMES[day - 1]})`
}
export const dateOf = (start: string, day: number) => addDays(start, day - 1)

/** 이번 주 키워드 앞에서 셋(같은 주제는 한 번) — 모자라면 고정 키워드로 */
export function weekTopics(trending: readonly PackSource[], fixed: readonly PackSource[]): PackSource[] {
  const out: PackSource[] = []
  const seen = new Set<string>()
  for (const s of [...trending, ...fixed]) {
    const k = s.topic.replace(/\s+/g, '')
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(s)
    if (out.length === 3) break
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 갈래 · 자리                                                            */
/* ------------------------------------------------------------------ */

export type WeekPart = 'long' | 'shortA' | 'shortB' | 'th0' | 'th1' | 'th2'
export const WEEK_PARTS: readonly { part: WeekPart; assistId: string; page: 'radar' | 'shorts' | 'threads'; label: string }[] = [
  { part: 'long', assistId: 'radar.pack.video', page: 'radar', label: '유튜브 롱폼' },
  { part: 'shortA', assistId: 'shorts.write', page: 'shorts', label: '쇼츠 ① ②' },
  { part: 'shortB', assistId: 'shorts.write', page: 'shorts', label: '릴스 ③' },
  { part: 'th0', assistId: 'threads.write', page: 'threads', label: '스레드 월~수' },
  { part: 'th1', assistId: 'threads.write', page: 'threads', label: '스레드 목~토' },
  { part: 'th2', assistId: 'threads.write', page: 'threads', label: '스레드 일 · 예비' },
]

/** 롱폼은 수요일 — 화요일 쇼츠로 미리 보여 주고 목요일 쇼츠로 한 번 더 */
export const LONG_DAY = 3

export interface ShortSlot {
  /** 1~3 = 이번 주 쇼츠 · 0 = 다른 버전(예비) */
  n: 0 | 1 | 2 | 3
  part: 'shortA' | 'shortB'
  /** 그 갈래 답의 몇 번째 대본 */
  idx: 0 | 1
  topic: 0 | 1
  platform: ShortPlatform
  /** 올릴 요일(1 월 ~ 7 일 · 예비는 0) */
  day: number
  role: string
}
export const SHORT_SLOTS: readonly ShortSlot[] = [
  { n: 1, part: 'shortA', idx: 0, topic: 0, platform: 'tiktok', day: 2, role: '롱폼 미리 보기 — 핵심 하나를 먼저(롱폼 하루 전)' },
  { n: 2, part: 'shortA', idx: 1, topic: 0, platform: 'tiktok', day: 4, role: '롱폼 다음 날 — 다른 형식으로 한 번 더' },
  { n: 3, part: 'shortB', idx: 0, topic: 1, platform: 'reels', day: 6, role: '2위 주제 — 릴스로 짧게' },
  { n: 0, part: 'shortB', idx: 1, topic: 1, platform: 'reels', day: 0, role: '다른 버전 — ③이 마음에 안 들면' },
]

export interface ThreadSlot {
  /** 1(월) ~ 7(일) · 0 = 예비 */
  day: number
  goal: ThreadGoal
  template: ThreadTemplateKey
  topic: 0 | 1 | 2
  part: 'th0' | 'th1' | 'th2'
  /** 요일 목적 한 줄 */
  aim: string
}
/**
 * 스레드 4주 운영안(주 5개)의 요일 목적을 주 7개로 — 주말은 저장(토) · 팔로워(일). 아홉 글 모두 다른 틀.
 * 주제가 매주 바뀌어도 맞는 틀만(지어낼 위험이 있는 실화 · 실적 숫자 · 내 밥줄 틀은 뺐다).
 * 자료 나눔(P)은 실제로 만든 자료가 있을 때만 — 예비로 둔다.
 */
export const THREAD_SLOTS: readonly ThreadSlot[] = [
  { day: 1, goal: 'share', template: 'E', topic: 0, part: 'th0', aim: '저장 · 공유' },
  { day: 2, goal: 'follow', template: 'T', topic: 0, part: 'th0', aim: '관계 · 팔로워' },
  { day: 3, goal: 'follow', template: 'X', topic: 0, part: 'th0', aim: '신뢰' },
  { day: 4, goal: 'like', template: 'D', topic: 1, part: 'th1', aim: '공감 · 논쟁' },
  { day: 5, goal: 'reply', template: 'G', topic: 1, part: 'th1', aim: '답글 · 리드' },
  { day: 6, goal: 'share', template: 'Q', topic: 1, part: 'th1', aim: '저장 · 공유' },
  { day: 7, goal: 'reply', template: 'I', topic: 2, part: 'th2', aim: '관계 · 팔로워' },
  { day: 0, goal: 'like', template: 'S', topic: 2, part: 'th2', aim: '예비 — 공감 · 비교' },
  { day: 0, goal: 'reply', template: 'P', topic: 2, part: 'th2', aim: '예비 — 자료 나눔(실제 자료가 있을 때만)' },
]
export const slotsOf = (part: WeekPart) => THREAD_SLOTS.filter((s) => s.part === part)

/** 주제 태그(정책자금 · 벤처기업확인 · 정부지원사업 · AX · 경영컨설팅) — 주제 글에 있으면 */
export const tagOf = (topic: string) => TOPIC_TAGS.find((t) => topic.replace(/\s+/g, '').includes(t.replace(/\s+/g, ''))) ?? (/AI|인공지능|자동화/.test(topic) ? 'AX' : '')

/* ------------------------------------------------------------------ */
/* 서버에 보낼 자료 — 기존 단추의 자료에 '이번 주 계획' 을 붙인다             */
/* ------------------------------------------------------------------ */

export interface WeekRequest {
  part: WeekPart
  assistId: string
  page: 'radar' | 'shorts' | 'threads'
  context: AssistContext
  /** 롱폼 확정 제목이 없을 때 쓸 규칙 초안 제목 */
  headline: string
}

const viewRow = (s: PackSource) => ({ 주제: s.topic.slice(0, 80), 관점: s.view.slice(0, 300) })

export function weekRequests(topics: readonly PackSource[], brief: ChannelBrief, today: string): WeekRequest[] {
  if (topics.length === 0) return []
  const t = (i: number) => topics[Math.min(i, topics.length - 1)]
  const start = weekStart(today)
  const longPack = makePack(t(0), brief)
  const out: WeekRequest[] = []

  // 롱폼 — 키워드 묶음 유튜브 갈래 자료 그대로 + 이 롱폼을 쇼츠로 자를 곳
  const long = packBundle({ today, pack: longPack, brief }).context
  long.sections = [
    ...long.sections,
    {
      name: '이번 주 계획(1주일치 묶음의 중심 영상)',
      rows: [{ 올리는날: dayLabel(start, LONG_DAY), 쇼츠: `같은 주 쇼츠 둘(${dayLabel(start, 2)} · ${dayLabel(start, 4)})이 이 영상의 핵심 장면을 잘라 쓴다 — 대본 구간 outline 에 "쇼츠로 자를 곳" 을 1~2곳 표시` }],
    },
  ]
  out.push({ part: 'long', assistId: 'radar.pack.video', page: 'radar', context: long, headline: longPack.headline })

  // 쇼츠 — 틱톡 · 쇼츠 2편(1위 · 롱폼 잘라 쓰기) / 릴스 2편(2위 · 하나는 예비)
  for (const part of ['shortA', 'shortB'] as const) {
    const slots = SHORT_SLOTS.filter((s) => s.part === part)
    const s0 = slots[0]
    const src = t(s0.topic)
    const ctx = shortsContext({ platform: s0.platform, aim: 'reach', format: formatsFor(s0.platform, 'reach')[0]?.key ?? '', topic: src.topic, facts: '', recent: [], today })
    ctx.sections = [
      ...ctx.sections,
      { name: '이번 주 주제(관점 — 시청자 글에 레이더 숫자 쓰지 않기)', rows: [viewRow(src)] },
      {
        name: '이번 주 계획(1주일치 쇼츠 3편 가운데)',
        rows: slots.map((s, i) => ({ 대본: `${i + 1}번`, 역할: s.role, 올리는날: s.day ? dayLabel(start, s.day) : '예비', ...(s.topic === 0 ? { 같은주롱폼: `「${longPack.headline}」 ${dayLabel(start, LONG_DAY)} — 롱폼 링크는 고정 댓글에만, 영상 · 캡션에서 팔지 않기` } : {}) })),
      },
    ]
    out.push({ part, assistId: 'shorts.write', page: 'shorts', context: ctx, headline: '' })
  }

  // 스레드 — 세 번(글 셋씩) · 글마다 요일 목적 · 틀을 정해서
  for (const part of ['th0', 'th1', 'th2'] as const) {
    const slots = slotsOf(part)
    const src = t(slots[0].topic)
    const ctx = threadsContext({ goal: slots[0].goal, template: slots[0].template, topic: src.topic, tag: tagOf(src.topic), facts: '', reference: '', recent: [], today })
    const first = ctx.sections[0]?.rows[0]
    if (first) {
      first.목표 = slots.map((s, i) => `${i + 1}번 ${s.day ? dayLabel(start, s.day) : '예비'} ${s.aim} — ${GOALS.find((g) => g.key === s.goal)?.hint ?? ''}`).join(' / ')
      first.고른틀 = slots
        .map((s, i) => {
          const tp = templateOf(s.template)
          return tp ? `${i + 1}번 ${tp.key} ${tp.name} — 뼈대: ${tp.skeleton.join(' → ')}` : ''
        })
        .filter(Boolean)
        .join(' / ')
      first.목표에맞는틀 = '글마다 위 틀 그대로(세 글 모두 다른 틀 · 다른 첫 줄 기법)'
      first.오늘요일계획 = '1주일치 스레드 7개 + 예비 2개 가운데 이 셋'
    }
    ctx.sections = [...ctx.sections, { name: '이번 주 주제(관점 — 글에 레이더 숫자 쓰지 않기)', rows: [viewRow(src)] }]
    out.push({ part, assistId: 'threads.write', page: 'threads', context: ctx, headline: '' })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 답 → 칸 · 저장                                                         */
/* ------------------------------------------------------------------ */

export interface WeekSaved {
  at: string
  model: string
  /** 만든 주의 월요일 */
  start: string
  topics: string[]
  long?: Partial<Record<PackSectionId, PackBlock[]>>
  shortA?: ShortDraft[]
  shortB?: ShortDraft[]
  th0?: ThreadDraft[]
  th1?: ThreadDraft[]
  th2?: ThreadDraft[]
}

/** 답 하나를 그 갈래 결과로 — 칸이 비면 null(실패로 본다) */
export function partResult(part: WeekPart, a: AssistAnswer, headline: string): Partial<WeekSaved> | null {
  if (part === 'long') {
    const got = aiSections('video', a.headline?.trim() || headline, a.items ?? [], a.next ?? [])
    return Object.keys(got).length ? { long: got } : null
  }
  if (part === 'shortA' || part === 'shortB') {
    const d = parseShortDrafts(a).drafts
    return d.length ? { [part]: d } : null
  }
  const d = parseThreadDrafts(a).drafts
  return d.length ? { [part]: d } : null
}

/** 스레드 답 셋 → 자리 셋(같은 틀로 쓴 글을 그 자리에 · 나머지는 차례로) */
export function placeThreads(slots: readonly ThreadSlot[], drafts: readonly ThreadDraft[]): (ThreadDraft | null)[] {
  const used = new Set<number>()
  const out: (ThreadDraft | null)[] = slots.map((s) => {
    const i = drafts.findIndex((d, k) => !used.has(k) && d.template === s.template)
    if (i < 0) return null
    used.add(i)
    return drafts[i]
  })
  return out.map((d) => {
    if (d) return d
    const i = drafts.findIndex((_, k) => !used.has(k))
    if (i < 0) return null
    used.add(i)
    return drafts[i]
  })
}

/* ------------------------------------------------------------------ */
/* 한 주 모양 — 규칙 초안 + AI 결과                                         */
/* ------------------------------------------------------------------ */

export interface LintSum {
  bad: number
  warn: number
  lines: string[]
}

export interface WeekLong {
  topic: string
  headline: string
  titles: PackBlock[]
  script: PackBlock[]
  ai: boolean
  lint: LintSum
}
export interface WeekShort {
  slot: ShortSlot
  topic: string
  draft: ShortDraft
  ai: boolean
  lint: LintSum
}
export interface WeekThread {
  slot: ThreadSlot
  topic: string
  draft: ThreadDraft
  ai: boolean
  lint: LintSum
}
export interface WeekView {
  start: string
  topics: string[]
  long: WeekLong
  shorts: WeekShort[]
  threads: WeekThread[]
}

/** 빈칸 · 쓰지 않는 말 — 롱폼(공식 점검이 따로 없어 이 둘만) */
function longLint(text: string): LintSum {
  const holes = text.match(HOLE) ?? []
  const avoid = PACK_AVOID.exec(text)
  const lines = [...(avoid ? [`"${avoid[0]}" — 쓰지 않는 말`] : []), ...(holes.length ? [`[공식 자료 확인] 빈칸 ${holes.length}칸 — 공고 · 보도자료로 채우기`] : [])]
  return { bad: avoid ? 1 : 0, warn: holes.length ? 1 : 0, lines }
}

/** 공식 점검 줄 — 주제 태그(올릴 때 고른다)는 세지 않는다 */
const sumOf = (r: { lines: { key: string; level: string; text: string }[] }): LintSum => {
  const xs = r.lines.filter((l) => l.level !== 'ok' && l.key !== 'tag')
  return { bad: xs.filter((l) => l.level === 'bad').length, warn: xs.filter((l) => l.level === 'warn').length, lines: xs.map((l) => l.text) }
}

const ruleShort = (blocks: readonly PackBlock[], i: number, platform: ShortPlatform): ShortDraft => {
  const b = blocks[i] ?? blocks[0]
  const cap = blocks.find((x) => x.label.startsWith('캡션'))?.text ?? ''
  const [caption, ...tags] = cap.split('\n\n')
  return { firstWords: '', format: '', seconds: platform === 'reels' ? '약 25초' : '약 50초', script: b?.text ?? '', caption: caption ?? '', hashtags: tags.join(' ').trim() }
}

export function buildWeek(topics: readonly PackSource[], brief: ChannelBrief, today: string, saved: WeekSaved | null): WeekView {
  const start = saved?.start ?? weekStart(today)
  const t = (i: number) => topics[Math.min(i, topics.length - 1)]
  const names = saved?.topics.length ? saved.topics : topics.map((x) => x.topic)
  const name = (i: number) => names[Math.min(i, names.length - 1)] ?? ''
  const packs = [0, 1].map((i) => (t(i) ? makePack(t(i), brief) : null))
  const sec = (i: number, id: PackSectionId) => packs[i]?.sections.find((x) => x.id === id)?.blocks ?? []

  // 롱폼 — AI 칸이 있으면 그것, 없으면 규칙 초안
  const aiLong = saved?.long
  // AI 대본 맨 앞 '확정 제목' 은 머리 제목으로만(대본 칸에 두 번 보이지 않게)
  const script = aiLong?.video?.length ? aiLong.video.filter((b) => b.label !== '확정 제목') : sec(0, 'video')
  const titles = aiLong?.titles?.length ? aiLong.titles : sec(0, 'titles')
  const top = aiLong?.video?.[0]
  const headline = top?.label === '확정 제목' ? top.text : (packs[0]?.headline ?? '')
  const long: WeekLong = { topic: name(0), headline, titles, script, ai: !!aiLong?.video?.length, lint: longLint([...script, ...titles].map((b) => b.text).join('\n')) }

  const shorts: WeekShort[] = SHORT_SLOTS.map((slot) => {
    const got = saved?.[slot.part]?.[slot.idx]
    const draft = got ?? ruleShort(sec(slot.topic, 'shorts'), slot.platform === 'reels' ? 1 : slot.idx, slot.platform)
    const lint = sumOf(lintShort({ platform: slot.platform, aim: 'reach', script: draft.script, caption: draft.caption, hashtags: draft.hashtags }))
    return { slot, topic: name(slot.topic), draft, ai: !!got, lint }
  })

  const threads: WeekThread[] = []
  for (const part of ['th0', 'th1', 'th2'] as const) {
    const slots = slotsOf(part)
    const placed = placeThreads(slots, saved?.[part] ?? [])
    slots.forEach((slot, i) => {
      const got = placed[i]
      const tp = templateOf(slot.template)
      const draft: ThreadDraft = got ?? { firstLine: '', template: slot.template, body: tp ? skeletonDraft(tp, name(slot.topic)) : '', ending: '', selfComment: '', checks: [] }
      const lint = sumOf(lintThreadPost({ body: draft.body, template: draft.template || slot.template, selfComment: draft.selfComment }))
      threads.push({ slot, topic: name(slot.topic), draft, ai: !!got, lint })
    })
  }
  return { start, topics: names, long, shorts, threads }
}

/** 점검 요약 — 이번 주 글(예비 빼고) 몇 개 중 통과 · 고칠 곳 */
export function weekLintSummary(w: WeekView): { total: number; pass: number; bad: number; warn: number } {
  const items = [w.long.lint, ...w.shorts.filter((s) => s.slot.n > 0).map((s) => s.lint), ...w.threads.filter((x) => x.slot.day > 0).map((x) => x.lint)]
  return { total: items.length, pass: items.filter((l) => l.bad === 0).length, bad: items.reduce((a, l) => a + l.bad, 0), warn: items.reduce((a, l) => a + l.warn, 0) }
}

/** 요일마다 올릴 것(달력 한 줄) */
export function weekCalendar(w: WeekView): { day: number; label: string; items: { kind: 'long' | 'short' | 'thread'; text: string; anchor: string }[] }[] {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const items: { kind: 'long' | 'short' | 'thread'; text: string; anchor: string }[] = []
    if (day === LONG_DAY) items.push({ kind: 'long', text: '유튜브 롱폼', anchor: 'mk-week-long' })
    for (const s of w.shorts) if (s.slot.day === day) items.push({ kind: 'short', text: `${s.slot.platform === 'reels' ? '릴스' : '쇼츠'} ${'①②③'[s.slot.n - 1]}`, anchor: `mk-week-short-${s.slot.n}` })
    for (const x of w.threads) if (x.slot.day === day) items.push({ kind: 'thread', text: `스레드 · ${x.slot.aim}`, anchor: `mk-week-thread-${day}` })
    return { day, label: dayLabel(w.start, day), items }
  })
}

/** 전체를 글 하나로(복사 · 내려받기) — 올릴 날 순서 */
export function weekText(w: WeekView): string {
  const line = '─'.repeat(20)
  const out: string[] = [`1주일치 콘텐츠 — ${dayLabel(w.start, 1)} ~ ${dayLabel(w.start, 7)}`, `주제: ${w.topics.map((t, i) => `${i + 1}위 ${t}`).join(' · ')}`, '']
  out.push(line, `■ 유튜브 롱폼 — ${dayLabel(w.start, LONG_DAY)} · ${w.long.topic}`, `제목: ${w.long.headline}`, '')
  for (const b of [...w.long.titles, ...w.long.script]) out.push(`[${b.label}]`, b.text, '')
  for (const s of w.shorts) {
    out.push(line, `■ ${s.slot.n ? `${s.slot.platform === 'reels' ? '릴스' : '쇼츠'} ${'①②③'[s.slot.n - 1]} — ${dayLabel(w.start, s.slot.day)}` : '쇼츠 다른 버전(예비)'} · ${s.topic}`, s.slot.role, '')
    out.push(s.draft.script, '')
    if (s.draft.caption) out.push(`캡션: ${s.draft.caption}`)
    if (s.draft.hashtags) out.push(s.draft.hashtags)
    out.push('')
  }
  for (const x of w.threads) {
    out.push(line, `■ 스레드 ${x.slot.day ? dayLabel(w.start, x.slot.day) : '예비'} · ${x.slot.aim} · 틀 ${x.draft.template || x.slot.template} · ${x.topic}`, '', x.draft.body, '')
    if (x.draft.selfComment) out.push(`본인 댓글: ${x.draft.selfComment}`, '')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/* ------------------------------------------------------------------ */
/* 이 브라우저에 남기기 — 만든 주마다(최근 4주)                              */
/* ------------------------------------------------------------------ */

export const WEEK_STORE_KEY = 'axmvp.mkweek.v1'
const isDrafts = (v: unknown): boolean => Array.isArray(v) && v.every((d) => !!d && typeof d === 'object')

export function parseWeekStore(raw: string | null): Record<string, WeekSaved> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, WeekSaved> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const o = x as Partial<WeekSaved>
      if (!o || typeof o.at !== 'string' || typeof o.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(o.topics)) continue
      const keep: WeekSaved = { at: o.at, model: typeof o.model === 'string' ? o.model : '', start: o.start, topics: o.topics.filter((t) => typeof t === 'string').slice(0, 3) }
      if (o.long && typeof o.long === 'object') keep.long = o.long
      for (const p of ['shortA', 'shortB', 'th0', 'th1', 'th2'] as const) if (isDrafts(o[p])) (keep as unknown as Record<string, unknown>)[p] = o[p]
      out[k] = keep
    }
    return out
  } catch {
    return {}
  }
}

export function putWeekStore(store: Record<string, WeekSaved>, saved: WeekSaved, max = 4): Record<string, WeekSaved> {
  const all = Object.entries({ ...store, [saved.start]: saved }).sort((a, b) => b[0].localeCompare(a[0]))
  return Object.fromEntries(all.slice(0, max))
}
