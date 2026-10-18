/**
 * 경로 줄 꼬리 · 업체 탭 기억 (D-235).
 *  - usePageCrumbs: 화면이 경로 줄 끝에 지금 단계를 붙인다(홍보 글 › 릴스 · 쇼츠 대본). 화면을 떠나면 저절로 지운다.
 *  - rememberClientTab: 업체 화면이 연 탭을 이 탭(브라우저 창) 동안 기억 — 그 업체의 모듈로 가면 '맞춤 추천' 칸을 잇는다.
 * 저장소가 막혀도 경로 줄만 짧아질 뿐 화면은 그대로다.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { Crumb } from './wayfinding'

let extras: Crumb[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCrumbExtras(): Crumb[] {
  return useSyncExternalStore(subscribe, () => extras, () => extras)
}

/** 화면 안 단계를 경로 줄 끝에 — 값이 바뀔 때만 다시 그린다 */
export function usePageCrumbs(list: Crumb[]) {
  const key = list.map((c) => `${c.label}|${c.to ?? ''}`).join('>')
  useEffect(() => {
    extras = key ? list : []
    emit()
    return () => {
      extras = []
      emit()
    }
    // key 가 같으면 같은 꼬리다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

const TAB_KEY = 'axmvp.wayfinding.clientTab'

export function rememberClientTab(clientId: string, tab: string) {
  try {
    sessionStorage.setItem(TAB_KEY, JSON.stringify({ clientId, tab }))
  } catch {
    // 기억만 못 한다
  }
}

export function lastClientTab(): { clientId: string; tab: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(TAB_KEY) ?? 'null') as unknown
    if (v && typeof v === 'object' && typeof (v as { clientId?: unknown }).clientId === 'string' && typeof (v as { tab?: unknown }).tab === 'string') return v as { clientId: string; tab: string }
  } catch {
    // 못 읽으면 없음
  }
  return null
}

/* 업체 이름 — 경로 줄에 쓰려고 이 탭 동안 기억(업체 화면 · 모듈이 기록을 읽을 때 적어 둔다) */
const NAME_KEY = 'axmvp.wayfinding.names'
let names: Record<string, string> | null = null
let namesVer = 0

function readNames(): Record<string, string> {
  if (names) return names
  try {
    const v = JSON.parse(sessionStorage.getItem(NAME_KEY) ?? '{}') as unknown
    names = v && typeof v === 'object' ? (v as Record<string, string>) : {}
  } catch {
    names = {}
  }
  return names
}

export function rememberClientNames(list: { id: string; companyName: string }[]) {
  const cur = readNames()
  let changed = false
  for (const r of list) {
    const n = r.companyName.trim()
    if (r.id && n && cur[r.id] !== n) {
      cur[r.id] = n
      changed = true
    }
  }
  if (!changed) return
  namesVer += 1
  try {
    sessionStorage.setItem(NAME_KEY, JSON.stringify(cur))
  } catch {
    // 이 탭 기억만
  }
  emit()
}

export function clientNameOf(id: string): string | null {
  return readNames()[id] ?? null
}

/** 이름 기억이 바뀌면 경로 줄을 다시 그린다 */
export function useClientNamesVersion(): number {
  return useSyncExternalStore(subscribe, () => namesVer, () => 0)
}
