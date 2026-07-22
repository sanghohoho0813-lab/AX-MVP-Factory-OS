import { createContext, useContext } from 'react'

export interface OnboardingContextValue {
  /** 일일/수동 안내 모달 열림 여부 */
  isOpen: boolean
  /** 안내 모달 열기 (특정 챕터로 바로 열 수 있음) */
  openGuide: (chapterId?: string) => void
  /** 안내 모달 닫기 (이번 세션만) */
  closeGuide: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding 는 OnboardingProvider 안에서만 사용할 수 있습니다.')
  }
  return ctx
}
