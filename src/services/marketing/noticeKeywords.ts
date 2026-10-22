/**
 * D-267 이번 주 키워드 — '우리 분야' 공고 신호 · 지난주와 비교.
 * 대표: "계속 똑같네 키워드가 · 이번 주 기준으로 계속 업데이트 되는 게 맞는 거야? · 지원금이나 정책자금 같은 건 키워드에 안 뜨나?"
 *
 *  - 레이더 키워드는 벤치마킹 유튜브 채널(대부분 경제 · AI 채널)의 최근 2주(모자라면 30일) 영상 제목에서만 나온다.
 *    그 채널들이 정책자금 · 지원금 영상을 거의 안 올려 우리 본업 주제가 위로 못 올라왔다.
 *  - 그래서 우리 분야는 '기업마당 공고'(매일 아침 9시 받음)를 이번 주 신호로 쓴다 — 이번 주(오늘 포함 7일) 새로 올라온 공고 수 ·
 *    7일 안 마감 수로 정책자금 · 고용지원금 · 소상공인 지원금 · 기업인증 · 정부지원사업 키워드를 만든다(2건 넘게 새로 올라왔을 때만 · 이 차례로 3칸까지).
 *  - 지난주와 비교 — 이 브라우저에 주마다 첫 키워드 목록을 적어 두고 '새로' 표시 · 한 줄 요약(편의 기능 — 비면 표시 없음).
 * 규칙 계산 — 외부 호출 없음(공고 · 영상은 이미 받은 것).
 */

import type { GrantNotice } from '../grants/grantMatch'
import { TOPIC_BY_ID, normalizeTitle } from './radarPlaybook'
import type { PackSource } from './contentPack'

/**
 * 공고로 신호를 보는 우리 분야 주제(레이더 주제 분류표의 번호 그대로 — 관점 · 제목을 같이 쓴다).
 * 차례 = 첫 화면에 넣는 차례 — 대표가 콕 집은 정책자금 · 지원금 먼저. '정부지원사업'(그 밖 공고 전부)은 수가 늘 가장 많아 맨 뒤.
 */
export const NOTICE_TOPICS = ['policy_fund', 'employ_subsidy', 'sme_subsidy', 'certification', 'grant_program'] as const
export type NoticeTopicId = (typeof NOTICE_TOPICS)[number]

/** 새 공고가 이만큼은 돼야 키워드로(한 건은 흐름이 아님) */
export const NOTICE_MIN = 2
/** 첫 화면에 넣는 공고 키워드 자리(3번째 · 6번째 · 9번째) */
export const NOTICE_SLOTS = [2, 5, 8] as const

/** 공고 하나 → 우리 분야 주제 하나(좁은 것 먼저 — 소상공인 → 정책자금 → 고용 → 인증 → 그 밖 지원사업) */
export function noticeTopicOf(n: Pick<GrantNotice, 'title' | 'category' | 'target'>): NoticeTopicId {
  const t = normalizeTitle(n.title)
  const m = (id: string) => TOPIC_BY_ID.get(id)?.match.test(t) ?? false
  if (/소상공인|자영업/.test(t)) return 'sme_subsidy'
  if (n.category === 'money' || m('policy_fund') || /융자|이차보전|보증료|정책\s?금융/.test(t)) return 'policy_fund'
  if (n.category === 'hr' || m('employ_subsidy') || /채용|일자리|인건비|고용/.test(t)) return 'employ_subsidy'
  if (m('certification')) return 'certification'
  return 'grant_program'
}

const DAY = 86_400_000
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const at = (date: string) => Date.parse(`${date}T00:00:00Z`)

/** 이번 주 = 오늘을 끝으로 7일('10/16 ~ 10/22') */
export function weekWindow(today: string): { from: string; to: string } {
  return { from: ymd(at(today) - 6 * DAY), to: today }
}

export interface NoticeKeyword {
  key: string
  topicId: NoticeTopicId
  label: string
  /** 이번 주 새로 올라온 공고(올라온 날 · 없으면 접수 시작일이 이번 주) — 새 것 먼저 */
  fresh: GrantNotice[]
  /** 7일 안 마감(오늘 포함) — 마감 가까운 것 먼저 */
  closing: GrantNotice[]
  /** 화면 칩 — '이번 주 새 공고 7건' */
  note: string
}

/** 공고 → 이번 주 우리 분야 키워드(NOTICE_TOPICS 차례 — 정책자금 · 지원금 먼저) */
export function noticeKeywords(notices: readonly GrantNotice[], today: string): NoticeKeyword[] {
  const { from } = weekWindow(today)
  const soon = ymd(at(today) + 6 * DAY)
  const groups = new Map<NoticeTopicId, { fresh: GrantNotice[]; closing: GrantNotice[] }>()
  for (const n of notices) {
    if (n.applyEnd && n.applyEnd < today) continue
    const id = noticeTopicOf(n)
    const g = groups.get(id) ?? { fresh: [], closing: [] }
    const seen = n.postedAt || n.applyStart
    if (seen && seen >= from && seen <= today) g.fresh.push(n)
    if (n.applyEnd && n.applyEnd >= today && n.applyEnd <= soon) g.closing.push(n)
    groups.set(id, g)
  }
  const out: NoticeKeyword[] = []
  for (const id of NOTICE_TOPICS) {
    const g = groups.get(id)
    if (!g || g.fresh.length < NOTICE_MIN) continue
    const def = TOPIC_BY_ID.get(id)
    if (!def) continue
    const fresh = [...g.fresh].sort((a, b) => (b.postedAt || b.applyStart).localeCompare(a.postedAt || a.applyStart) || a.title.localeCompare(b.title))
    const closing = [...g.closing].sort((a, b) => a.applyEnd.localeCompare(b.applyEnd))
    out.push({ key: `notice:${id}`, topicId: id, label: def.label, fresh, closing, note: `이번 주 새 공고 ${fresh.length}건` })
  }
  return out
}

const md = (date: string) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '')
const noticeLine = (n: GrantNotice) => `${n.title}${n.agency ? ` — ${n.agency}` : ''}${n.applyEnd ? ` · 마감 ${md(n.applyEnd)}` : n.applyStart ? '' : ' · 상시'}`

/** 공고 키워드 → 콘텐츠 묶음 재료(관점 · 제목은 레이더 분류표 그대로 · 근거는 실제 공고 이름 · 마감) */
export function noticePackSource(k: NoticeKeyword, today: string): PackSource | null {
  const def = TOPIC_BY_ID.get(k.topicId)
  if (!def) return null
  const w = weekWindow(today)
  return {
    key: k.key,
    topic: k.label,
    axis: 'market',
    why: `이번 주(${md(w.from)}~${md(w.to)}) 기업마당에 ${k.label} 공고가 새로 ${k.fresh.length}건 올라왔고${k.closing.length ? `, ${k.closing.length}건은 7일 안에 마감됩니다` : ''} — 대표님들이 지금 찾는 주제예요.`,
    facts: [`이번 주 새 공고 ${k.fresh.length}건(기업마당)`, ...(k.closing.length ? [`7일 안 마감 ${k.closing.length}건`] : []), ...k.fresh.slice(0, 3).map((n) => `새 공고: ${noticeLine(n)}`), ...k.closing.slice(0, 2).map((n) => `곧 마감: ${noticeLine(n)}`)],
    view: `${def.main.view} 이번 주 새로 올라온 공고를 예로 들되, 금액 · 자격은 공고 원문으로 확인해 말합니다.`,
    titles: [...def.main.titles],
    thumbs: [...def.main.thumbs],
    hook: `이번 주에만 ${k.label} 공고가 ${k.fresh.length}건 새로 올라왔습니다. 우리 회사가 볼 것만 딱 짚어 드리겠습니다.`,
    refs: [],
    custom: false,
  }
}

/** 이미 있는 레이더 묶음에 같은 주제 공고 근거를 덧붙인다(같은 주제가 레이더에도 올라왔을 때) */
export function withNoticeFacts(s: PackSource, k: NoticeKeyword | undefined): PackSource {
  if (!k) return s
  return { ...s, facts: [...s.facts, `이번 주 새 공고 ${k.fresh.length}건(기업마당)`, ...k.fresh.slice(0, 2).map((n) => `새 공고: ${noticeLine(n)}`)] }
}

/** 첫 화면 목록에 공고 키워드를 끼운다 — 같은 주제가 이미 있으면 그 줄에 칩만, 없으면 3번째 · 6번째 · 9번째 자리에(최대 10개) */
export function withNoticeKeywords<T extends { key: string; topicId?: string }>(list: readonly T[], extra: readonly NoticeKeyword[], make: (k: NoticeKeyword) => T, max = 10): { list: T[]; noteOf: Map<string, string> } {
  const out = [...list]
  const noteOf = new Map<string, string>()
  let slot = 0
  for (const k of extra) {
    const same = out.find((x) => x.topicId === k.topicId && x.key.startsWith('market:'))
    if (same) {
      noteOf.set(same.key, k.note)
      continue
    }
    if (slot >= NOTICE_SLOTS.length) continue
    const item = make(k)
    out.splice(Math.min(NOTICE_SLOTS[slot], out.length), 0, item)
    noteOf.set(item.key, k.note)
    slot += 1
  }
  return { list: out.slice(0, max), noteOf }
}

/* ------------------------------------------------------------------ */
/* 지난주와 비교 — 주마다 첫 목록을 이 브라우저에                             */
/* ------------------------------------------------------------------ */

/** 그 날이 든 주의 월요일(YYYY-MM-DD) — 주 이름 */
export function weekOf(date: string): string {
  const d = at(date)
  const dow = new Date(d).getUTCDay()
  return ymd(d - ((dow + 6) % 7) * DAY)
}

export type WeekLog = Record<string, string[]>

/** 이번 주 목록을 적어 두고(이번 주에 처음일 때만) 지난주 목록을 돌려준다 · 4주까지만 둔다 */
export function rememberWeek(log: WeekLog, today: string, keys: readonly string[]): { log: WeekLog; last: string[] | null } {
  const now = weekOf(today)
  const prev = ymd(at(now) - 7 * DAY)
  const next: WeekLog = { ...log }
  if (!next[now] && keys.length) next[now] = [...keys]
  const weeks = Object.keys(next).sort().slice(-4)
  const kept: WeekLog = Object.fromEntries(weeks.map((w) => [w, next[w]]))
  return { log: kept, last: kept[prev] ?? null }
}

/** '지난주와 비교' 한 줄 — 새로 들어온 키워드 수 · 빠진 것 */
export function weekChange(keys: readonly string[], last: readonly string[] | null, labelOf: (key: string) => string): { fresh: Set<string>; line: string } {
  if (!last) return { fresh: new Set(), line: '' }
  const fresh = new Set(keys.filter((k) => !last.includes(k)))
  const gone = last.filter((k) => !keys.includes(k))
  if (fresh.size === 0 && gone.length === 0) return { fresh, line: '지난주와 같은 키워드예요 — 벤치마킹 채널들이 같은 주제를 계속 다루고 있어요.' }
  const goneText = gone.length ? ` · 빠진 것: ${gone.slice(0, 3).map(labelOf).join(', ')}${gone.length > 3 ? ` 외 ${gone.length - 3}개` : ''}` : ''
  return { fresh, line: `지난주와 비교: 새로 ${fresh.size}개${goneText}` }
}

const WEEK_KEY = 'axmvp.mk.week_keys.v1'
export function readWeekLog(): WeekLog {
  try {
    const raw = JSON.parse(window.localStorage.getItem(WEEK_KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object') return {}
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([w, v]) => /^\d{4}-\d{2}-\d{2}$/.test(w) && Array.isArray(v)).map(([w, v]) => [w, (v as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 20)]))
  } catch {
    return {}
  }
}
export function writeWeekLog(log: WeekLog): void {
  try {
    window.localStorage.setItem(WEEK_KEY, JSON.stringify(log))
  } catch {
    /* 저장이 안 되면 다음에 다시 — 표시만 없다 */
  }
}
