/**
 * D-346 1주일치 한 번에 — 이번 주 키워드 1~3위로 유튜브 롱폼 1 · 릴스/쇼츠 3 · 스레드 7(+예비 2).
 * 대표: "버튼 하나만 누르면 1주일치 유튜브 롱폼 1개, 릴스쇼츠 영상 3개, 스레드 글 7개 한 번에 쫙 —
 *        트렌드 잇는 주제 벤치마킹해서, 기존 마케팅 공식들 잘 적용해서 100점짜리 결과".
 *
 *  - 주제(D-348 대표: "AI 는 미끼 — 늘 내 업이랑 접목해서 중소기업 대표가 좋은 정보를 얻게"): 짝 셋 = 본업(고정 키워드) × 미끼(이번 주 AI 흐름).
 *    본업은 이번 주 새 공고가 많은 순(같으면 주마다 돌아가며 다섯 모두 차례), 미끼는 벤치마킹 채널 최근 2주에 함께 오른 AI · 경영 주제.
 *    짝 1 = 롱폼 + 롱폼을 잘라 쓰는 쇼츠 둘 + 스레드 월~수 · 짝 2 = 릴스 하나 + 스레드 목~토 · 짝 3 = 스레드 일요일 + 예비 둘.
 *  - 글은 이미 있는 공식 단추 그대로 부른다(서버 지시 · 규칙집을 새로 만들지 않는다):
 *    롱폼 = 키워드 묶음 유튜브 갈래(radar.pack.video) · 쇼츠 = 릴스 · 틱톡 대본(shorts.write · 2편씩 두 번) ·
 *    스레드 = 스레드 글 3개(threads.write · 세 번 — 글마다 요일 · 목적 · 틀을 정해 보낸다). 여섯 갈래를 동시에.
 *  - 규칙 초안(AI 아님)을 바로 보여 주고 답이 온 갈래부터 바꾼다. 글마다 기존 점검(스레드 · 숏폼 공식 · 빈칸 · 쓰지 않는 말)으로 '점검 통과 / 고칠 곳'.
 *  - 시청자 글에 레이더가 센 숫자(채널 수 · 영상 수)를 넣지 않는다 — 우리가 고른 근거일 뿐.
 *  - 채널 설계 기준(D-347 · 확인된 사실 · 본업 · 접목 원칙)을 여섯 갈래 모두에 보낸다(예전에는 롱폼에만).
 */
import type { AssistAnswer } from '../aiAssist/client'
import type { AssistContext } from '../aiAssist/context'
import { briefSection, packBundle } from '../aiAssist/builders'
import { HOLE, PACK_AVOID, aiSections, customSource, makePack, type PackBlock, type PackSectionId, type PackSource } from './contentPack'
import { isMarketingCustomer } from './persona'
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

/* ------------------------------------------------------------------ */
/* D-348 짝 — 본업(고정 키워드) × 미끼(이번 주 AI 흐름)                    */
/* ------------------------------------------------------------------ */

export interface WeekPair {
  /** 본업 주제(고정 키워드) */
  core: PackSource
  /** 미끼(이번 주 뜨는 AI · 경영 주제) — 없으면 null */
  hook: PackSource | null
  /** 롱폼 · 쇼츠 · 스레드 재료(본업 주제 + 미끼로 시작하는 각도) */
  source: PackSource
  /** 화면 · 저장에 쓰는 이름 — '정책자금 × Claude 활용' */
  label: string
  /** 미끼 → 본업 → 대표가 얻는 것(규칙으로 고른 각도 — AI 가 더 나은 각도를 고를 수 있다) */
  angle: string
}

export interface WeekSetup {
  pairs: WeekPair[]
  /** 이번 주 AI 흐름 전부(공통으로 다루는 것을 AI 가 고르게) */
  trend: string[]
}

/** 유튜브 데이터가 없을 때의 미끼 — 늘 뜨는 AI 업무 활용 */
const FALLBACK_HOOKS = ['AI 업무 활용(ChatGPT · Claude)', 'AI 업무자동화', 'AI 로 서류 · 보고서 쓰기']

/** 본업마다 미끼를 잇는 길(대표가 정한 본업 기준에서) — 맞는 것이 없으면 일반 각도 */
const CORE_ANGLES: ReadonlyArray<[RegExp, string]> = [
  [/정책\s*자금/, 'AI 로 사업계획서 · 재무 설명 초안을 빨리 만들어 정책자금 준비 시간을 줄이고, 심사에서 우리 회사를 보여 줄 근거(AX — 가점이 아니라 눈에 띄게 해 주는 자료)까지'],
  [/고용\s*지원금/, 'AI 로 반복 업무를 줄이고 사람은 더 중요한 일에 — 채용 · 인건비는 고용지원금으로 설계'],
  [/인증|벤처/, 'AI · AX 로 만든 작동하는 화면을 벤처 · 이노비즈 같은 인증의 기술 근거로 — 창업 3년 안 벤처확인 세금 감면까지'],
  [/지원금/, 'AI 로 우리 회사가 받을 수 있는 지원금을 찾고 서류를 정리 — 몰라서 못 받던 돈'],
  [/지원\s*사업/, 'AI 로 공고를 읽고 사업계획서 초안을 써서 지원사업 신청 준비를 앞당기기'],
]
const angleOf = (core: string, hook: string) => {
  const how = CORE_ANGLES.find(([re]) => re.test(core))?.[1] ?? `${core}에서 대표가 이번 주 바로 할 일 하나로`
  return `${hook}(이번 주 뜨는 미끼)로 시작 → ${core}(본업)로 잇기 — ${how} → 끝은 중소기업 대표가 이번 주에 바로 써먹을 정보`
}

/** 주마다 하나씩 밀어 다섯 본업이 모두 차례가 오게 */
const weekIndex = (start: string) => Math.floor(Date.parse(`${start}T00:00:00Z`) / (7 * 86400000))

/**
 * 짝 셋. 본업 = 고정 키워드 중 이번 주 새 공고가 많은 셋(같으면 주마다 돌아가며) · 미끼 = 이번 주 키워드에서 AI · 경영×AI 먼저, 그다음 경제 · 경영.
 * 이번 주 키워드가 없으면 늘 뜨는 AI 업무 활용으로. 고정 키워드가 없으면(드묾) 이번 주 키워드를 본업 자리에.
 */
export function weekSetup(trending: readonly PackSource[], fixed: readonly { source: PackSource; fresh: number }[], start: string): WeekSetup {
  const rot = weekIndex(start)
  const cores = fixed
    .map((f, i) => ({ ...f, turn: (i - rot % Math.max(1, fixed.length) + fixed.length) % Math.max(1, fixed.length) }))
    .sort((a, b) => b.fresh - a.fresh || a.turn - b.turn)
    .map((f) => f.source)
  const rank = (s: PackSource) => (s.axis === 'axai' ? 0 : s.axis === 'bridge' ? 1 : 2)
  const seen = new Set(cores.map((c) => c.topic.replace(/\s+/g, '')))
  const hooks = [...trending].filter((t) => !seen.has(t.topic.replace(/\s+/g, ''))).sort((a, b) => rank(a) - rank(b))
  const fallback = FALLBACK_HOOKS.map((t) => customSource(t)).filter((x): x is PackSource => !!x)
  const hookList = hooks.length ? hooks : fallback
  const coreList = cores.length ? cores : trending.slice(0, 3)
  const pairs: WeekPair[] = coreList.slice(0, 3).map((core, i) => {
    const hook = hookList.length ? hookList[i % hookList.length] : null
    const label = hook ? `${core.topic} × ${hook.topic}` : core.topic
    const angle = hook ? angleOf(core.topic, hook.topic) : `${core.topic}에서 중소기업 대표가 이번 주 바로 써먹을 정보로`
    const source: PackSource = hook
      ? {
          ...core,
          key: `bridge:${core.key}+${hook.key}`,
          why: `이번 주 뜨는 '${hook.topic}' 을 미끼로 시작해 본업 '${core.topic}' 으로 잇습니다. ${core.why}`,
          view: `${hook.topic} 이야기로 시작해, 중소기업 대표가 ${core.topic}에서 이번 주 바로 써먹을 것으로 끝냅니다(순수 AI 설명으로 끝내지 않기). ${core.view}`,
          facts: [...core.facts, ...hook.facts].slice(0, 6),
          refs: hook.refs.length ? hook.refs : core.refs,
        }
      : core
    return { core, hook, source, label, angle }
  })
  return { pairs, trend: (hooks.length ? hooks : fallback).map((h) => h.topic).slice(0, 8) }
}

/** D-348 접목 규칙 — 여섯 갈래 모두에 [규칙집] 으로 */
export function bridgeRules(): string[] {
  const customer = isMarketingCustomer()
  const core = customer ? '내가 실제로 하는 일(채널 설계 기준의 본업)' : '고정 주제(정책자금 · 고용지원금 · 기업인증 · 정부지원금 · 정부지원사업)'
  return [
    '— 1주일치 묶음: AI 는 미끼, 끝은 본업 —',
    `이번 주 뜨는 AI · 트렌드 주제(미끼)로 시청자를 데려와, ${core}로 이어, 중소기업 대표가 이번 주에 바로 써먹을 정보로 끝낸다.`,
    '순수 AI 사용법 · 도구 기능 설명으로 끝내지 않는다 — AI 이야기는 첫 장면(미끼)과 "대표님 회사에 붙이면" 부분에만, 본론은 돈 · 지원금 · 인증 · 세금 · 경영 이득.',
    '[자료 · 접목] 의 미끼 · 본업 · 각도를 따른다. 각도가 어색하면 같은 미끼 · 본업으로 더 자연스러운 각도를 고른다. [자료 · 접목] 의 이번 주 AI 흐름에서 여러 채널이 공통으로 다루는 것을 미끼로 써도 된다.',
    ...(customer ? [] : ['자금 · 심사 이야기는 기본 컨디션(대표자 신용 · 재무 · 체납) → AX → 사업 성장 로드맵 순서. AX 를 자금 받는 수단이라 부르지 않는다. 채널 설계 기준의 실제 사례 · 숫자만 쓴다.']),
  ]
}

const bridgeSection = (p: WeekPair, trend: readonly string[]) => ({
  name: '접목(미끼 → 본업 → 대표가 얻는 것)',
  rows: [{ 미끼: p.hook?.topic ?? '(없음 — 본업으로 바로)', 이번주AI흐름: trend.join(' · '), 본업: p.core.topic, 본업이유: p.core.why.slice(0, 240), 각도: p.angle }],
})

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
  { n: 3, part: 'shortB', idx: 0, topic: 1, platform: 'reels', day: 6, role: '짝 2 — 릴스로 짧게' },
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

export function weekRequests(setup: WeekSetup, brief: ChannelBrief, today: string): WeekRequest[] {
  const pairs = setup.pairs
  if (pairs.length === 0) return []
  const pr = (i: number) => pairs[Math.min(i, pairs.length - 1)]
  const start = weekStart(today)
  const longPack = makePack(pr(0).source, brief)
  const rules = bridgeRules()
  const out: WeekRequest[] = []

  // 롱폼 — 키워드 묶음 유튜브 갈래 자료(채널 설계 기준 · 규칙집 포함) + 접목 + 이 롱폼을 쇼츠로 자를 곳
  const long = packBundle({ today, pack: longPack, brief }).context
  long.sections = [
    ...long.sections,
    bridgeSection(pr(0), setup.trend),
    {
      name: '이번 주 계획(1주일치 묶음의 중심 영상)',
      rows: [{ 올리는날: dayLabel(start, LONG_DAY), 쇼츠: `같은 주 쇼츠 둘(${dayLabel(start, 2)} · ${dayLabel(start, 4)})이 이 영상의 핵심 장면을 잘라 쓴다 — 대본 구간 outline 에 "쇼츠로 자를 곳" 을 1~2곳 표시` }],
    },
  ]
  long.rules = [...(long.rules ?? []), ...rules]
  out.push({ part: 'long', assistId: 'radar.pack.video', page: 'radar', context: long, headline: longPack.headline })

  // 쇼츠 — 틱톡 · 쇼츠 2편(짝 1 · 롱폼 잘라 쓰기) / 릴스 2편(짝 2 · 하나는 예비)
  for (const part of ['shortA', 'shortB'] as const) {
    const slots = SHORT_SLOTS.filter((s) => s.part === part)
    const s0 = slots[0]
    const p = pr(s0.topic)
    const ctx = shortsContext({ platform: s0.platform, aim: 'reach', format: formatsFor(s0.platform, 'reach')[0]?.key ?? '', topic: p.label, facts: '', recent: [], today })
    ctx.sections = [
      ...ctx.sections,
      briefSection(brief),
      bridgeSection(p, setup.trend),
      { name: '이번 주 주제(관점 — 시청자 글에 레이더 숫자 쓰지 않기)', rows: [viewRow(p.source)] },
      {
        name: '이번 주 계획(1주일치 쇼츠 3편 가운데)',
        rows: slots.map((s, i) => ({ 대본: `${i + 1}번`, 역할: s.role, 올리는날: s.day ? dayLabel(start, s.day) : '예비', ...(s.topic === 0 ? { 같은주롱폼: `「${longPack.headline}」 ${dayLabel(start, LONG_DAY)} — 롱폼 링크는 고정 댓글에만, 영상 · 캡션에서 팔지 않기` } : {}) })),
      },
    ]
    ctx.rules = rules
    out.push({ part, assistId: 'shorts.write', page: 'shorts', context: ctx, headline: '' })
  }

  // 스레드 — 세 번(글 셋씩) · 글마다 요일 목적 · 틀을 정해서
  for (const part of ['th0', 'th1', 'th2'] as const) {
    const slots = slotsOf(part)
    const p = pr(slots[0].topic)
    const ctx = threadsContext({ goal: slots[0].goal, template: slots[0].template, topic: p.label, tag: tagOf(p.core.topic), facts: '', reference: '', recent: [], today })
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
    ctx.sections = [...ctx.sections, briefSection(brief), bridgeSection(p, setup.trend), { name: '이번 주 주제(관점 — 글에 레이더 숫자 쓰지 않기)', rows: [viewRow(p.source)] }]
    ctx.rules = rules
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

export function buildWeek(setup: WeekSetup, brief: ChannelBrief, today: string, saved: WeekSaved | null): WeekView {
  const start = saved?.start ?? weekStart(today)
  const topics = setup.pairs.map((p) => p.source)
  const t = (i: number) => topics[Math.min(i, topics.length - 1)]
  // 만든 주의 이름(짝)은 저장된 것 — 지금 순위가 바뀌어도 그 주에 쓴 글의 주제로
  const names = saved?.topics.length ? saved.topics : setup.pairs.map((p) => p.label)
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
  const out: string[] = [`1주일치 콘텐츠 — ${dayLabel(w.start, 1)} ~ ${dayLabel(w.start, 7)}`, `주제(본업 × 이번 주 AI 흐름): ${w.topics.map((t, i) => `짝 ${i + 1} ${t}`).join(' · ')}`, '']
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

/** 한 주 결과 하나 — 이 브라우저 · 클라우드 어느 쪽에서 읽어도 같은 검사 */
export function normalizeWeekSaved(x: unknown): WeekSaved | null {
  const o = x as Partial<WeekSaved> | null
  if (!o || typeof o !== 'object' || typeof o.at !== 'string' || typeof o.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.start) || !Array.isArray(o.topics)) return null
  const keep: WeekSaved = { at: o.at, model: typeof o.model === 'string' ? o.model : '', start: o.start, topics: o.topics.filter((t) => typeof t === 'string').slice(0, 3) }
  if (o.long && typeof o.long === 'object' && !Array.isArray(o.long)) keep.long = o.long
  for (const p of ['shortA', 'shortB', 'th0', 'th1', 'th2'] as const) if (isDrafts(o[p])) (keep as unknown as Record<string, unknown>)[p] = o[p]
  return keep
}

export function parseWeekStore(raw: string | null): Record<string, WeekSaved> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Record<string, WeekSaved> = {}
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const keep = /^\d{4}-\d{2}-\d{2}$/.test(k) ? normalizeWeekSaved(x) : null
      if (keep) out[k] = keep
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
