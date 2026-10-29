/**
 * D-287 화면 꾸미기 — 화면마다 칸 순서 · 오늘만 숨기기 · 계속 숨기기.
 *
 * 대표: "거의 모든 목차에서 세부적으로 들어가 있는 기능들 — 커스터마이징 할 수 있게. 예를 들면 오늘에서도
 * 오늘 할 일 몇 건보다 내가 원래 썼던 메모를 제일 위로. 잠시 안 보이게 하거나 계속 안 보이게 하거나, 순서도 입맛에 맞게."
 *
 *  - 칸(섹션)마다 id 가 있고, 화면은 기본 순서대로 칸을 넘긴다. 여기에는 '바꾼 것' 만 적는다.
 *  - 오늘만 숨기기 = 고른 날짜를 적어 두고 그날만 숨김(다음 날 저절로 다시 보임).
 *  - 화면에 새 칸이 생기면 기본 순서 자리(앞 칸 바로 뒤)에 들어간다 — 예전에 저장한 순서가 새 칸을 잃지 않게.
 * 기억은 이 기기 브라우저에(접기 D-192 와 같은 이유 — 기기마다 편한 순서가 다르다). 저장이 막혀도 기본 순서로 그린다.
 *
 * D-315 꾸미기 지키기 — 대표: "새로 개발되면 화면 꾸미기 해 놨던 게 일부 풀린다."
 *  - 지금 화면에 없는 칸(휴대폰 · PC 에 따라 · 팀장 · 자료가 있을 때만 보이는 칸)의 저장 자리를 순서를 바꿀 때 지우지 않는다
 *    (예전에는 그 칸이 없는 화면에서 다른 칸을 옮기면 그 칸의 자리가 지워져, 다시 나타날 때 기본 자리로 돌아갔다).
 *  - 칸 이름표가 바뀌면 옛 이름으로 저장한 것도 새 칸에 이어진다(lib/uiNameAliases).
 */
import { useSyncExternalStore } from 'react'
import { readRaw, writeRaw } from '../storage/localStore'
import { todayLocalDate } from './appClock'
import { layoutAlias } from './uiNameAliases'

export type SectionVisibility = 'show' | 'today' | 'off'

export interface PageLayout {
  /** 사람이 정한 순서(바꾼 적 없으면 빈 줄) */
  order: string[]
  /** 계속 숨긴 칸 */
  off: string[]
  /** 오늘만 숨긴 칸 — 칸 id → 숨긴 날(YYYY-MM-DD) */
  today: Record<string, string>
}

const EMPTY: PageLayout = { order: [], off: [], today: {} }
const KEY = (page: string) => `axmvp.ui.layout.${page}`
const EVT = 'axmvp:page-layout'

const cache = new Map<string, PageLayout>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function read(page: string): PageLayout {
  const hit = cache.get(page)
  if (hit) return hit
  let next = EMPTY
  try {
    const raw = readRaw(KEY(page))
    if (raw) {
      const p = JSON.parse(raw) as Partial<PageLayout>
      const today: Record<string, string> = {}
      const al = (id: string) => layoutAlias(page, id)
      if (p.today && typeof p.today === 'object') for (const [k, v] of Object.entries(p.today)) if (typeof v === 'string') today[al(k)] = v
      next = { order: [...new Set(strings(p.order).map(al))], off: [...new Set(strings(p.off).map(al))], today }
    }
  } catch {
    // 손상된 기억은 버리고 기본 순서로
  }
  cache.set(page, next)
  return next
}

function write(page: string, next: PageLayout) {
  cache.set(page, next)
  try {
    writeRaw(KEY(page), JSON.stringify(next))
  } catch {
    // 기억만 못 할 뿐 이번 화면에서는 바뀐다
  }
  emit()
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVT, { detail: page }))
}

if (typeof window !== 'undefined') {
  // 다른 창 · 로그인 바뀜(저장소 금고)에서 바뀌면 다시 읽는다
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key.startsWith('axmvp.ui.layout.')) {
      cache.clear()
      emit()
    }
  })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function usePageLayout(page: string): PageLayout {
  return useSyncExternalStore(
    subscribe,
    () => read(page),
    () => EMPTY,
  )
}

export function visibilityOf(layout: PageLayout, id: string, today = todayLocalDate()): SectionVisibility {
  if (layout.off.includes(id)) return 'off'
  if (layout.today[id] === today) return 'today'
  return 'show'
}

/**
 * 보일 순서 — 저장한 순서를 먼저, 저장한 뒤에 생긴 칸은 기본 순서에서 바로 앞 칸 뒤에.
 * 기본 순서에 없는 id(없어진 칸)는 버린다.
 */
export function arrangeIds(defaults: readonly string[], layout: PageLayout): string[] {
  const known = new Set(defaults)
  const out = layout.order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i)
  defaults.forEach((id, i) => {
    if (out.includes(id)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(defaults[j])
      if (k >= 0) {
        at = k + 1
        break
      }
    }
    out.splice(at, 0, id)
  })
  return out
}

/**
 * D-315 저장할 순서 — 지금 화면에 없는 칸의 저장 자리도 그대로 둔다(저장 순서에서 바로 앞에 있던 칸 뒤에).
 * 이 칸이 다시 나타나면 대표가 정해 둔 자리로 돌아온다.
 */
export function keepAbsent(arranged: readonly string[], saved: readonly string[]): string[] {
  const out = [...arranged]
  saved.forEach((id, i) => {
    if (out.includes(id)) return
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = out.indexOf(saved[j])
      if (k >= 0) {
        at = k + 1
        break
      }
    }
    out.splice(at, 0, id)
  })
  return out
}

/** 칸 하나를 위 · 아래 · 맨 위로 — 숨긴 칸은 건너뛰고 보이는 칸끼리 자리를 바꾼다 */
export function moveSection(page: string, defaults: readonly string[], id: string, to: 'up' | 'down' | 'top') {
  const layout = read(page)
  const order = arrangeIds(defaults, layout)
  const from = order.indexOf(id)
  if (from < 0) return
  const day = todayLocalDate()
  const shown = (x: string) => visibilityOf(layout, x, day) === 'show'
  order.splice(from, 1)
  if (to === 'top') order.unshift(id)
  else {
    // 이웃 중 보이는 칸을 찾아 그 앞(위) · 뒤(아래)로
    let j = to === 'up' ? from - 1 : from
    while (j >= 0 && j < order.length && !shown(order[j])) j += to === 'up' ? -1 : 1
    if (to === 'up') order.splice(Math.max(0, j), 0, id)
    else order.splice(Math.min(order.length, j + 1), 0, id)
  }
  write(page, { ...layout, order: keepAbsent(order, layout.order) })
}

export function setSectionVisibility(page: string, id: string, v: SectionVisibility) {
  const layout = read(page)
  const day = todayLocalDate()
  const off = layout.off.filter((x) => x !== id)
  // 지난날의 '오늘만' 은 이때 치운다
  const today = Object.fromEntries(Object.entries(layout.today).filter(([k, d]) => k !== id && d === day))
  if (v === 'off') off.push(id)
  if (v === 'today') today[id] = day
  write(page, { ...layout, off, today })
}

/** 시험용 — 지금 기억한 것 그대로 읽기 */
export function readLayoutForTest(page: string): PageLayout {
  return read(page)
}

/** 처음대로 — 순서 · 숨김 모두 */
export function resetLayout(page: string) {
  write(page, EMPTY)
}

/** 지금 숨어 있는 칸(오늘만 · 계속) */
export function hiddenIds(defaults: readonly string[], layout: PageLayout, today = todayLocalDate()): string[] {
  return defaults.filter((id) => visibilityOf(layout, id, today) !== 'show')
}

export function isCustomized(layout: PageLayout, today = todayLocalDate()): boolean {
  return layout.order.length > 0 || layout.off.length > 0 || Object.values(layout.today).some((d) => d === today)
}
