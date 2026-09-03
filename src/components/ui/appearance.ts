import { createContext, useContext } from 'react'
import type { UiMotionMode, UiThemeKey } from '../../types/ui'

export interface AppearanceContextValue {
  theme: UiThemeKey
  setTheme: (theme: UiThemeKey) => void
  motion: UiMotionMode
  setMotion: (motion: UiMotionMode) => void
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider')
  return ctx
}
