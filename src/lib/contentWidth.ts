/**
 * PC 본문 폭 — 좁게 · 보통 · 넓게 (D-201 대표 요청).
 *
 * "글자 크기는 그대로 두고, 가로로 긴 칸 때문에 눈이 좌우로 많이 왔다 갔다 한다 — 정책자금 진단 · 고용지원금 관리
 *  정도의 폭으로, 머리줄 단추 한 번에 3단계로 바꾸게."
 *   보통(기본) 1,280px — 본문 글 폭 약 1,170~1,200px(정책자금 진단 1,152px · 고용지원금 1,259px 와 같은 정도)
 *   좁게       1,100px — 글 폭 약 1,000px
 *   넓게       1,840px — D-201 전까지의 폭(큰 모니터에서 표 · 달력을 넓게)
 * 본문(main) 바깥 상자 폭이다(안쪽 여백 포함). 화면이 이보다 좁으면(노트북 · 휴대폰) 아무것도 바뀌지 않는다.
 * 저장은 이 브라우저(로그인한 사람별 금고 — 다른 화면 설정과 같은 칸). 다른 창에서 바꾸면 따라간다.
 */
import { useSyncExternalStore } from 'react'

export type ContentWidth = 'narrow' | 'normal' | 'wide'

const KEY = 'axmvp.ui.content_width'

export const CONTENT_WIDTH_PX: Record<ContentWidth, number> = { narrow: 1100, normal: 1280, wide: 1840 }
export const CONTENT_WIDTH_LABEL: Record<ContentWidth, string> = { narrow: '좁게', normal: '보통', wide: '넓게' }
const ORDER: ContentWidth[] = ['narrow', 'normal', 'wide']

/** 한 번 누를 때마다 좁게 → 보통 → 넓게 → 좁게 */
export function nextContentWidth(w: ContentWidth): ContentWidth {
  return ORDER[(ORDER.indexOf(w) + 1) % ORDER.length]
}

function readWidth(): ContentWidth {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'narrow' || v === 'wide' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

let width: ContentWidth = typeof window === 'undefined' ? 'normal' : readWidth()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  // 다른 창 · 로그인 바뀜(저장소 금고)에서 값이 바뀌면 따라간다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      width = readWidth()
      emit()
    }
  })
}

export function setContentWidth(next: ContentWidth): void {
  width = next
  try {
    window.localStorage.setItem(KEY, next)
  } catch {
    /* 저장이 안 돼도 이번 화면에서는 바뀐다 */
  }
  emit()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

const snapshot = () => width

export function useContentWidth(): ContentWidth {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
