/**
 * D-295 휴대폰 아래 메뉴 꾸미기 — 대표(2026-10-26): "하단에 오늘 · 일정 · 고객 · 상담 · 영업 · 더보기 — 이것도 커스터마이징 할 수 있게".
 *  - 아래 칸은 최대 5개 + 늘 맨 끝 '더보기'. 고른 것 · 순서는 이 기기에 기억(휴대폰마다 손에 맞게 — 계정 자료가 아니다).
 *  - 고를 수 있는 것 = 지금 계정 메뉴에 보이는 줄(대표 전용 줄은 팀장에게 없다) — 메뉴 표(moduleRegistry)를 그대로 쓴다.
 *  - 기억한 칸이 지금 메뉴에 없으면(팀장 계정 · 꺼진 기능) 빼고, 하나도 안 남으면 기본으로.
 */
import { useSyncExternalStore } from 'react'
import type { ModuleDefinition } from '../config/moduleRegistry'
import { readRaw, removeKey, writeRaw } from '../storage/localStore'
import { navAlias } from './uiNameAliases'

const KEY = 'axmvp.ui.mobile_nav.v1'
const EVT = 'axmvp:mobile-nav'
export const MOBILE_NAV_MAX = 5

/** 예전 그대로의 아래 메뉴 — 서랍 메뉴 순서: 오늘 → 일정 → 고객 → 상담신청 → 영업 (D-108 · D-125) */
export const MOBILE_NAV_DEFAULT: readonly string[] = ['today', 'calendar', 'client-ops', 'inbox', 'sales']

/** 아래 칸은 좁다(여섯 칸 · 큰 글자) — 짧은 이름. 없는 줄은 이름에서 앞 낱말 */
const SHORT: Record<string, string> = {
  today: '오늘',
  decide: '확인',
  calendar: '일정',
  'client-ops': '고객',
  'ai-workspace': 'AI 전략',
  'patent-venture': '특허',
  inbox: '상담',
  sales: '영업',
  agents: '정산',
  money: '매출',
  marketing: '마케팅',
  'first-meeting': '1차 미팅',
  tools: '모듈',
  settings: '설정',
}

export function shortLabel(m: Pick<ModuleDefinition, 'key' | 'label'>): string {
  if (SHORT[m.key]) return SHORT[m.key]
  const first = m.label.replace(/\(.*?\)/g, '').split(/\s*[·]\s*/)[0].trim()
  return first.replace(/\s*(관리|진단|계산기)$/, '').slice(0, 6) || m.label.slice(0, 6)
}

/** 아래 칸에 둘 수 있는 줄 — 주소가 있는 줄(펼치기만 하는 '출시 예정' 은 빼고) */
export function navCandidates(groups: readonly { group: { key: string }; items: readonly ModuleDefinition[] }[]): ModuleDefinition[] {
  return groups.flatMap((g) => g.items).filter((m) => m.enabled && !m.expand && !!m.path)
}

function readKeys(): string[] | null {
  try {
    const raw = readRaw(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as unknown
    // D-315 메뉴 key 가 바뀌면 옛 key 로 고른 칸도 이어진다
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(navAlias).slice(0, MOBILE_NAV_MAX) : null
  } catch {
    return null
  }
}

let cache: { raw: string | null; keys: string[] | null } | null = null
function snapshot(): string[] | null {
  let raw: string | null = null
  try {
    raw = readRaw(KEY)
  } catch {
    raw = null
  }
  if (!cache || cache.raw !== raw) cache = { raw, keys: readKeys() }
  return cache.keys
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** 고른 칸(없으면 null = 기본) */
export function useMobileNavKeys(): string[] | null {
  return useSyncExternalStore(subscribe, snapshot, () => null)
}

/** 고른 칸 저장 — null 이면 기본으로(기억 지움) */
export function saveMobileNavKeys(keys: readonly string[] | null): void {
  try {
    if (keys === null) removeKey(KEY)
    else writeRaw(KEY, JSON.stringify([...new Set(keys)].slice(0, MOBILE_NAV_MAX)))
  } catch {
    // 기억만 못 할 뿐 — 아래 메뉴는 기본으로
  }
  window.dispatchEvent(new Event(EVT))
}

/** 지금 계정에서 실제로 보일 칸 — 기억한 칸 중 메뉴에 있는 것(순서 그대로) · 하나도 없으면 기본 중 있는 것 */
export function resolveMobileNav(saved: readonly string[] | null, candidates: readonly ModuleDefinition[]): ModuleDefinition[] {
  const byKey = new Map(candidates.map((m) => [m.key, m]))
  const pick = (keys: readonly string[]) => keys.map((k) => byKey.get(k)).filter((m): m is ModuleDefinition => !!m).slice(0, MOBILE_NAV_MAX)
  const mine = saved ? pick(saved) : []
  return mine.length ? mine : pick(MOBILE_NAV_DEFAULT)
}
