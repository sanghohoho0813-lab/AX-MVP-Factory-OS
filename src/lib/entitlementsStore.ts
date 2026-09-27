/**
 * 지금 쓸 수 있는 것 — 읽는 쪽 (D-127). 틀(EntitlementsProvider, entitlementsContext.tsx)이 한 번 읽어 나눠 준다.
 * 요금제나 체험·잠금을 바꾸면 notifyEntitlementsChanged() — 모든 곳이 다시 읽는다.
 */

import { createContext, useContext } from 'react'
import { todayLocalDate } from './appClock'
import { openEntitlements, type Entitlements } from '../services/entitlements'

export const ENTITLEMENTS_EVENT = 'axmvp:entitlements'

export function notifyEntitlementsChanged(): void {
  try {
    window.dispatchEvent(new Event(ENTITLEMENTS_EVENT))
  } catch {
    /* 창이 없으면(시험) 무시 */
  }
}

export interface EntitlementsValue {
  ent: Entitlements
  /** 다 읽었는가 */
  ready: boolean
  workspaceId: string | null
}

export const EntitlementsCtx = createContext<EntitlementsValue | null>(null)

const FALLBACK: EntitlementsValue = { ent: openEntitlements(todayLocalDate()), ready: false, workspaceId: null }

/** 틀 밖(단독 화면)에서는 아무것도 잠그지 않는다 */
export function useEntitlements(): EntitlementsValue {
  return useContext(EntitlementsCtx) ?? FALLBACK
}
