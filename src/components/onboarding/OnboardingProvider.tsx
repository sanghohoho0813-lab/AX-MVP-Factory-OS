import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { OnboardingContext, type OnboardingContextValue } from './onboardingContext'
import { OnboardingModal } from './OnboardingModal'

/**
 * 처음 사용 가이드 전역 상태.
 *
 * 자동으로 뜨지 않는다. 매일 첫 접속에 안내창을 띄우면 일하러 들어온 사람이
 * 매번 창부터 닫아야 한다. 필요할 때 '처음 사용 가이드' 를 눌러서만 연다.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [forcedChapterId, setForcedChapterId] = useState<string | null>(null)

  const openGuide = useCallback((chapterId?: string) => {
    setForcedChapterId(chapterId ?? null)
    setIsOpen(true)
  }, [])

  const closeGuide = useCallback(() => {
    setIsOpen(false)
    setForcedChapterId(null)
  }, [])

  const value = useMemo<OnboardingContextValue>(
    () => ({ isOpen, openGuide, closeGuide }),
    [isOpen, openGuide, closeGuide],
  )

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingModal open={isOpen} initialChapterId={forcedChapterId} onClose={closeGuide} />
    </OnboardingContext.Provider>
  )
}
