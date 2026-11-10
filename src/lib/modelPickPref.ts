/**
 * D-570 구독 고객 화면의 [모델 · ○○] 단추 — 기본은 숨김(AI 는 기본 모델로 그대로 쓴다).
 * 대표(2026-11-10): "거의 LLM 처럼 편하게 쓰되, 더 디테일하게 들어가고 싶은 사람은 자기 입맛에 맞게."
 * 설정 › 계정 · 보기에서 [보이기] 를 고르면 그 브라우저에 기억한다. 대표 · 내부 팀장 화면은 늘 보인다(이 값을 보지 않는다).
 */
import { useSyncExternalStore } from 'react'

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
