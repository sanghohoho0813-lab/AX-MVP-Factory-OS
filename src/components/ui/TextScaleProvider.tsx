import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UiTextScale } from '../../types/ui'
import { uiPreferencesRepository } from '../../repositories/uiPreferencesRepository'
import { applyTextScale, TEXT_SCALE_META } from '../../lib/uiTextScale'
import { TextScaleContext } from './textScale'

/**
 * 전역 글자 크기 적용 프로바이더.
 * 저장된 설정을 읽어 html data 속성에 반영하고, 변경 시 저장·적용·안내한다.
 * index.html 인라인 스크립트가 초기 깜빡임을 이미 막으므로 여기서는 동기화만 한다.
 */
export function TextScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState<UiTextScale>(() => uiPreferencesRepository.get().textScale)
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    applyTextScale(scale)
  }, [scale])

  const setScale = useCallback((next: UiTextScale) => {
    uiPreferencesRepository.update(next)
    applyTextScale(next)
    setScaleState(next)
    setAnnounce(`글자 크기를 '${TEXT_SCALE_META[next].label}'로 변경했습니다.`)
  }, [])

  const value = useMemo(() => ({ scale, setScale }), [scale, setScale])

  return (
    <TextScaleContext.Provider value={value}>
      {children}
      <span aria-live="polite" className="sr-only">{announce}</span>
    </TextScaleContext.Provider>
  )
}
