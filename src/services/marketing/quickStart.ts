/**
 * MUX-2 주제 하나 → 바로 쓰기(규칙 계산, AI 아님).
 * 대표 "60대도 설명 없이 · 주제 하나만 골라도 초안까지 · 형식 5개를 하나하나 고르지 않아도 우선 추천".
 *
 *  - 스레드: 오늘 요일 계획(WEEK_PLAN) → 그 틀 가운데 이번 주 잘 된 틀(참고만 · D-275) → 첫 틀. 'P 자료 나눔' 은 나눠 줄 자료가
 *    실제로 있는 주제(벤처 점검표)일 때만. 주제 태그는 주제 낱말로.
 *  - 릴스 · 틱톡: 이번 주 올린 비율(권장 틱톡 3 : 1 · 릴스 댓글은 자료가 있을 때)로 목적 → 주제 낱말로 형식.
 *  - 이번 주 키워드: 마케팅 첫 화면(콘텐츠 레이더)이 받은 키워드를 이 브라우저에 그 주 동안만 둔다 — 스레드 · 릴스 화면의 주제 칩.
 *    예시 데이터(유튜브 연결 전)는 두지 않는다.
 * 고른 사람이 직접 바꾼 형식은 덮어쓰지 않는다(화면이 판단).
 */
import { todayLocalDate } from '../../lib/appClock'
import { GOALS, mondayOf, templateOf, todayPlan, type ThreadGoal, type ThreadTemplateKey, type WeekRef } from './threads'
import { AIMS, PLATFORMS, formatOf, formatsFor, weekMix, type ShortAim, type ShortFormatKey, type ShortPlatform, type ShortPost } from './shorts'

/** 나눠 줄 자료가 실제로 있는 주제(지금은 벤처기업확인 셀프 체크리스트 카드 6장뿐) */
export const hasMaterial = (topic: string): boolean => /벤처|체크\s*리스트|점검표|셀프\s*체크/.test(topic)

/** 주제 낱말 → 스레드 주제 태그 1개(TOPIC_TAGS) — 비면 '' */
export function topicTag(topic: string): string {
  const t = topic.trim()
  if (!t) return ''
  if (/벤처/.test(t)) return '벤처기업확인'
  if (/정책\s*자금|자금|보증|융자|대출/.test(t)) return '정책자금'
  if (/지원\s*사업|공고|바우처|지원금|고용/.test(t)) return '정부지원사업'
  if (/(?<![A-Za-z])A[IX](?![A-Za-z])|자동화|화면|MVP|ChatGPT|Claude|챗GPT|디지털/i.test(t)) return 'AX'
  return '경영컨설팅'
}

export interface ThreadRec {
  goal: ThreadGoal
  template: ThreadTemplateKey
  tag: string
  /** 왜 이 틀인지 한 줄 */
  why: string
}

export function recommendThread(input: { topic: string; today?: string; weekRef?: WeekRef | null }): ThreadRec {
  const today = input.today ?? todayLocalDate()
  const plan = todayPlan(today)
  const material = hasMaterial(input.topic)
  const goal: ThreadGoal = plan?.goal ?? 'reply'
  const ok = (k: ThreadTemplateKey) => k !== 'P' || material
  const goalPicks = GOALS.find((g) => g.key === goal)?.picks ?? []
  let picks = (plan?.picks ?? goalPicks).filter(ok)
  if (!picks.length) picks = goalPicks.filter(ok)
  // 답글 날이고 나눠 줄 자료가 있으면 P(자료 나눔 조건 — 점수 중앙값 가장 높음)를 먼저
  if (material && goal === 'reply') picks = ['P', ...picks.filter((k) => k !== 'P')]
  const hot = new Set((input.weekRef?.items ?? []).map((x) => x.template))
  const hotPick = picks.find((k) => hot.has(k))
  const template: ThreadTemplateKey = hotPick ?? picks[0] ?? 'B'
  const t = templateOf(template)
  const why = [plan ? `오늘(${plan.day}) 계획 '${plan.label}'` : "주말 — '답글 · 리드'", hotPick ? '이번 주 잘 된 틀' : '', template === 'P' ? '나눠 줄 점검표가 있어요' : ''].filter(Boolean).join(' · ')
  return { goal: t && !t.goals.includes(goal) ? t.goals[0] : goal, template, tag: topicTag(input.topic), why }
}

export interface ShortRec {
  aim: ShortAim
  format: ShortFormatKey
  why: string
}

export function recommendShort(input: { topic: string; platform: ShortPlatform; posts: readonly ShortPost[]; today?: string }): ShortRec {
  const { topic, platform } = input
  const mix = weekMix(input.posts, input.today ?? todayLocalDate())[platform]
  const material = hasMaterial(topic)
  // 틱톡: 많이 보이게 3번에 문의로 1번 · 릴스: 댓글 받기는 나눠 줄 자료가 있을 때만(자금 · 세금 소재는 댓글 위주)
  const aim: ShortAim = platform === 'tiktok' ? (mix.convert * 3 < mix.reach ? 'convert' : 'reach') : material && mix.convert <= mix.reach ? 'convert' : 'reach'
  const list = formatsFor(platform, aim)
  const want: ShortFormatKey =
    platform === 'reels' && aim === 'convert'
      ? 'comment'
      : /하지\s*마|금지|실수|전에|순서/.test(topic)
        ? 'ban'
        : /화면|자동화|MVP|앱|시연/.test(topic)
          ? 'demo'
          : platform === 'tiktok' && /왜|어떻게|\?|궁금|질문/.test(topic)
            ? 'talk'
            : platform === 'tiktok'
              ? 'list'
              : 'ban'
  const format = (list.find((f) => f.key === want) ?? list[0])?.key ?? 'list'
  const aimName = (a: ShortAim) => AIMS[platform].find((x) => x.key === a)?.label ?? ''
  const where = PLATFORMS.find((p) => p.key === platform)?.label ?? ''
  const why = `이번 주 ${where} — ${aimName('reach')} ${mix.reach} : ${aimName('convert')} ${mix.convert}${platform === 'tiktok' ? ' (권장 3 : 1)' : ''} · ${formatOf(format)?.how ?? ''}`
  return { aim, format, why }
}

/* ------------------------------------------------------------------ */
/* 이번 주 키워드(주제 칩)                                               */
/* ------------------------------------------------------------------ */

const WEEK_TOPICS_KEY = 'mirae.mk.weekTopics.v1'
export const WEEK_TOPICS_MAX = 6

/** 콘텐츠 레이더가 받은 이번 주 키워드를 그 주 동안 둔다 */
export function rememberWeekTopics(topics: readonly string[], today: string = todayLocalDate()): void {
  const list = [...new Set(topics.map((t) => t.trim()).filter(Boolean))].slice(0, WEEK_TOPICS_MAX)
  if (!list.length) return
  try {
    localStorage.setItem(WEEK_TOPICS_KEY, JSON.stringify({ week: mondayOf(today), topics: list }))
  } catch {
    // 저장 공간이 없으면 칩만 '우리 분야' 로
  }
}

/** 이번 주(월요일 기준)에 받은 키워드만 — 지난주 것은 쓰지 않는다 */
export function readWeekTopics(today: string = todayLocalDate()): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(WEEK_TOPICS_KEY) ?? 'null') as { week?: unknown; topics?: unknown } | null
    if (v && v.week === mondayOf(today) && Array.isArray(v.topics)) return v.topics.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, WEEK_TOPICS_MAX)
  } catch {
    // 못 읽으면 없음
  }
  return []
}

export interface TopicChip {
  topic: string
  from: 'week' | 'ours'
}

/** 주제 칩 — 이번 주 키워드 먼저, 그다음 우리 분야(겹치면 하나) */
export function topicChips(week: readonly string[], ours: readonly string[]): TopicChip[] {
  const seen = new Set<string>()
  const out: TopicChip[] = []
  const add = (topic: string, from: TopicChip['from']) => {
    const k = topic.replace(/\s+/g, '')
    if (!k || seen.has(k)) return
    seen.add(k)
    out.push({ topic, from })
  }
  week.slice(0, WEEK_TOPICS_MAX).forEach((t) => add(t, 'week'))
  ours.forEach((t) => add(t, 'ours'))
  return out
}
