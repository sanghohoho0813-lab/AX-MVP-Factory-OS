/**
 * D-638 대화창 글자 크기 — 대표(2026-11-19): "모델 바꾸기 옆에 −/+ 조그맣게 · 한 5단계 · 지금 기본도 나쁘진 않은데 나한테는 아주 약간 크다".
 *
 * 다섯 단계(85 · 92 · 100 · 110 · 120%) · 처음은 100%(예전 그대로). 모든 대화창이 같은 값 하나를 쓴다(오른쪽 판 · 휴대폰 아래 판 ·
 * 오늘 대화창 · AI 전략실 기획 대화) — 대화창 바깥 화면 글자는 그대로(화면 전체 글자 크기는 설정 › 보기).
 * 값은 이 기기에 기억('axmvp.' 이라 로그인한 사람마다 따로). 못 읽거나 못 쓰면 100% 로 · 이번 화면에서만 바뀐다.
 * 적용은 대화창 감싸개의 class `chat-zoom` 이 CSS 변수 --chat-zoom 을 읽는다(index.css).
 */
import { useSyncExternalStore } from 'react'

export const CHAT_SIZES = [0.85, 0.92, 1, 1.1, 1.2] as const
export const CHAT_SIZE_DEFAULT = 2
const KEY = 'axmvp.ui.chat_size'

const clamp = (i: number) => Math.min(CHAT_SIZES.length - 1, Math.max(0, Math.round(i)))

/** 저장된 값 읽기 — 숫자(단계 번호)만 · 그 밖은 기본 */
export function parseChatSize(raw: string | null): number {
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) ? clamp(n) : CHAT_SIZE_DEFAULT
}

function read(): number {
  try {
    return parseChatSize(window.localStorage.getItem(KEY))
  } catch {
    return CHAT_SIZE_DEFAULT
  }
}

let step = typeof window === 'undefined' ? CHAT_SIZE_DEFAULT : read()
const listeners = new Set<() => void>()

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--chat-zoom', String(CHAT_SIZES[step]))
}
apply()

if (typeof window !== 'undefined') {
  // 다른 탭에서 바꾼 것 · 로그인한 사람이 바뀌어 금고가 바뀐 것
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      step = read()
      apply()
      listeners.forEach((l) => l())
    }
  })
}

export function chatSizeStep(): number {
  return step
}

export function setChatSizeStep(next: number): void {
  const v = clamp(next)
  if (v === step) return
  step = v
  try {
    window.localStorage.setItem(KEY, String(v))
  } catch {
    // 저장이 안 돼도 이번 화면에서는 바뀐다
  }
  apply()
  listeners.forEach((l) => l())
}

export function useChatSize(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => step,
    () => CHAT_SIZE_DEFAULT,
  )
}
