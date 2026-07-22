import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { onboardingPreferencesRepository } from '../../repositories/onboardingPreferencesRepository'
import { isRouteAutoShowAllowed, shouldAutoShowToday } from '../../services/onboardingService'
import { OnboardingContext, type OnboardingContextValue } from './onboardingContext'
import { OnboardingModal } from './OnboardingModal'

/**
 * 처음 사용 가이드 전역 상태 — 일일 자동 노출과 수동 열기를 담당한다.
 * AppShell 안(ActiveProjectProvider·DemoTourProvider 하위)에서만 마운트한다.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [forcedChapterId, setForcedChapterId] = useState<string | null>(null)
  const autoChecked = useRef(false)

  const openGuide = useCallback((chapterId?: string) => {
    setForcedChapterId(chapterId ?? null)
    setIsOpen(true)
  }, [])

  const closeGuide = useCallback(() => {
    setIsOpen(false)
    setForcedChapterId(null)
  }, [])

  // 일일 자동 노출 — 마운트 후 1회, 허용 화면에서만 (§3 · §4)
  useEffect(() => {
    if (autoChecked.current) return
    autoChecked.current = true

    if (!isRouteAutoShowAllowed(location.pathname)) return
    // 다른 중요한 모달이 이미 열려 있으면 띄우지 않는다 (§4)
    const otherModalOpen = document.querySelector('[role="dialog"][aria-modal="true"]') !== null
    if (otherModalOpen) return

    const prefs = onboardingPreferencesRepository.get()
    if (!shouldAutoShowToday(prefs)) return

    onboardingPreferencesRepository.markShownToday()
    setForcedChapterId(null)
    setIsOpen(true)
    // location.pathname 은 최초 값만 사용 (1회 자동 노출)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
