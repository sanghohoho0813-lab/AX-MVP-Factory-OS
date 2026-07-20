import { createContext, useContext } from 'react'
import type { UiTextScale } from '../../types/ui'

export interface TextScaleContextValue {
  scale: UiTextScale
  setScale: (scale: UiTextScale) => void
}

export const TextScaleContext = createContext<TextScaleContextValue | null>(null)

export function useTextScale(): TextScaleContextValue {
  const ctx = useContext(TextScaleContext)
  if (!ctx) throw new Error('useTextScale must be used within TextScaleProvider')
  return ctx
}
