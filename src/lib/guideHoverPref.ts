/**
 * D-580 마우스 안내 카드(D-565 · D-569) 켜기 · 끄기 — 기본은 켬.
 * 처음 쓰는 사람에게는 메뉴 · 단추마다 뜨는 설명이 길잡이지만, 매일 쓰는 사람에게는 번거로울 수 있다.
 * 대표(2026-11-10): "거의 LLM 처럼 편하게 쓰되, 더 디테일하게 들어가고 싶은 사람은 자기 입맛에 맞게."
 * 설정 › 계정 · 보기에서 고른다. 꺼도 사용법 안내 화면(/guide)에는 같은 글이 그대로 있다. 이 브라우저에 기억한다.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'axmvp.ui.guideHover'
const EVENT = 'axmvp:guide-hover-pref'

/** 꺼 둔 것이 아니면 켬(값이 없거나 못 읽으면 켬) */
export function guideHoverOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setGuideHoverOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, '0')
  } catch {
    /* 못 적어도 이번 화면에서는 따른다 */
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* 창이 없으면 넘어간다 */
  }
}

export function useGuideHoverOn(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener(EVENT, l)
      window.addEventListener('storage', l)
      return () => {
        window.removeEventListener(EVENT, l)
        window.removeEventListener('storage', l)
      }
    },
    guideHoverOn,
    () => true,
  )
}
