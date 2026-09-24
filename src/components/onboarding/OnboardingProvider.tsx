import { Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from 'react'
import { OnboardingContext, type OnboardingContextValue } from './onboardingContext'

// D-102: 안내창과 안내 글(약 29KB)은 처음 열 때 불러온다 — 전에는 모든 첫 화면 파일에 실렸다
const OnboardingModal = lazy(() => import('./OnboardingModal').then((m) => ({ default: m.OnboardingModal })))

/**
 * 처음 사용 가이드 전역 상태.
 *
 * 자동으로 뜨지 않는다. 매일 첫 접속에 안내창을 띄우면 일하러 들어온 사람이
 * 매번 창부터 닫아야 한다. 필요할 때 '처음 사용 가이드' 를 눌러서만 연다.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [forcedChapterId, setForcedChapterId] = useState<string | null>(null)
  // 한 번 연 뒤로는 계속 붙여 둔다 (닫는 움직임·다시 열 때 기다림 없음)
  const [everOpened, setEverOpened] = useState(false)

  const openGuide = useCallback((chapterId?: string) => {
    setForcedChapterId(chapterId ?? null)
    setEverOpened(true)
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
      {everOpened && (
        <Suspense fallback={null}>
          <OnboardingModal open={isOpen} initialChapterId={forcedChapterId} onClose={closeGuide} />
        </Suspense>
      )}
    </OnboardingContext.Provider>
  )
}
