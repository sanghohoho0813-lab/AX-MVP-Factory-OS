import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UiMotionMode, UiThemeKey } from '../../types/ui'
import { uiPreferencesRepository } from '../../repositories/uiPreferencesRepository'
import { DEFAULT_THEME, applyTheme, themeMeta } from '../../lib/uiTheme'
import { AppearanceContext } from './appearance'

/** html 요소에 모션 설정을 반영한다 (CSS 에서 전환 효과를 끈다) */
function applyMotion(mode: UiMotionMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-motion', mode)
}

/**
 * 화면 테마·모션 적용 프로바이더.
 * 저장된 설정을 읽어 html data 속성에 반영하고, 변경 시 저장·적용·안내한다.
 * index.html 인라인 스크립트가 초기 깜빡임을 막으므로 여기서는 동기화만 한다.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<UiThemeKey>(
    () => uiPreferencesRepository.get().theme ?? DEFAULT_THEME,
  )
  const [motion, setMotionState] = useState<UiMotionMode>(
    () => uiPreferencesRepository.get().motion ?? 'full',
  )
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    applyMotion(motion)
  }, [motion])

  const setTheme = useCallback((next: UiThemeKey) => {
    uiPreferencesRepository.setTheme(next)
    applyTheme(next)
    setThemeState(next)
    setAnnounce(`화면 테마를 '${themeMeta(next).label}'로 변경했습니다.`)
  }, [])

  const setMotion = useCallback((next: UiMotionMode) => {
    uiPreferencesRepository.setMotion(next)
    applyMotion(next)
    setMotionState(next)
    setAnnounce(next === 'reduced' ? '화면 움직임을 줄였습니다.' : '화면 움직임을 원래대로 되돌렸습니다.')
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, motion, setMotion }),
    [theme, setTheme, motion, setMotion],
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
      <span aria-live="polite" className="sr-only">{announce}</span>
    </AppearanceContext.Provider>
  )
}
