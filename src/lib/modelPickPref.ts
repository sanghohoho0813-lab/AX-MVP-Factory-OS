/**
 * D-570 구독 고객 화면의 [모델 · ○○] 단추 — 기본은 숨김(AI 는 기본 모델로 그대로 쓴다).
 * 대표(2026-11-10): "거의 LLM 처럼 편하게 쓰되, 더 디테일하게 들어가고 싶은 사람은 자기 입맛에 맞게."
 * 설정 › 계정 · 보기에서 [보이기] 를 고르면 그 브라우저에 기억한다. 대표 · 내부 팀장 화면은 늘 보인다(이 값을 보지 않는다).
 * D-629 그 단추가 [모델 · 자동] 을 보일지 · 자동이 어느 두 모델을 쓰는지 · 방금 어느 쪽으로 답했는지도 여기(아래) — 단추와 판이 같이 쓴다.
 */
import { useSyncExternalStore } from 'react'
import { autoPlan, type AutoPlan } from '../services/aiAssist/autoModel'
import type { AssistStatus, ProviderId } from '../services/aiAssist/client'
import { AUTO_EVENT, allowedProviders, autoUpgradeAllowed, lastAutoPick, type AutoPick } from '../services/aiAssist/store'

const KEY = 'axmvp.ui.modelPick'
const EVENT = 'axmvp:model-pick-pref'

export function modelPickShown(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setModelPickShown(show: boolean) {
  try {
    if (show) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* 못 적어도 이번 화면에서는 따른다 */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* 창이 없으면 넘어간다 */
  }
}

export function useModelPickShown(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener(EVENT, l)
      window.addEventListener('storage', l)
      return () => {
        window.removeEventListener(EVENT, l)
        window.removeEventListener('storage', l)
      }
    },
    modelPickShown,
    () => false,
  )
}

/* ------------------------------------------------------------------ */
/* D-629 [모델 · 자동] — 모델 고르기 단추 · 판이 같이 쓰는 것                  */
/* ------------------------------------------------------------------ */

/** 이 화면(대표 · 팀장 · 고객)에서의 자동 계획 — 물음에 쓰는 모델 · 일에 쓰는 모델. prefer = 그 회사 안에서([가장 싼 모델] · [좋은 모델] 단추) */
export function autoPlanFor(status: AssistStatus | null, prefer?: ProviderId | null): AutoPlan | null {
  return autoPlan(status, { providers: allowedProviders(), upgrade: autoUpgradeAllowed(), prefer })
}

/**
 * '자동' 이라고 보여 줄 계정인가 — 일을 시킬 때 더 좋은 모델로 올려 쓸 수 있을 때만.
 * 팀장(회사마다 가장 싼 모델 하나) · 구독 고객 · 모델이 하나뿐인 계정은 예전 모양 그대로(그 모델 이름) — 더 좋은 모델을 약속하는 말을 하지 않는다.
 * 서버 목록을 아직 못 받았으면 화면 모양(대표 화면인가)으로만 본다.
 */
export function showsAuto(status: AssistStatus | null): boolean {
  if (!autoUpgradeAllowed()) return false
  return status ? !!autoPlanFor(status)?.upgrades : true
}

/** 자동이 방금 고른 모델(이 화면에서만) — 모델 고르기 판의 '방금: 좋은 모델로 답함' 줄 */
export function useLastAutoPick(): AutoPick | null {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener(AUTO_EVENT, l)
      return () => window.removeEventListener(AUTO_EVENT, l)
    },
    lastAutoPick,
    () => null,
  )
}
