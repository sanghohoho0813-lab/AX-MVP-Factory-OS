import type { UiPreferences, UiTextScale } from '../types/ui'
import { isTextScale } from '../lib/uiTextScale'
import { notifyStoreChanged, readRaw, writeRaw } from '../storage/localStore'

/**
 * 전역 표시 설정 저장소 — 스키마 도메인 데이터와 분리된 키를 사용한다.
 * UI 컴포넌트는 이 저장소(또는 상위 훅)를 통해서만 접근한다.
 */
const UI_PREFS_KEY = 'axmvp.ui.preferences'

function nowIso(): string {
  return new Date().toISOString()
}

/** 손상·미저장 시 기본값(글자 크기 1.5배) */
function defaults(): UiPreferences {
  return { textScale: 'default', updatedAt: nowIso() }
}

export const uiPreferencesRepository = {
  get(): UiPreferences {
    const raw = readRaw(UI_PREFS_KEY)
    if (raw === null) return defaults()
    try {
      const parsed = JSON.parse(raw) as Partial<UiPreferences>
      const textScale: UiTextScale = isTextScale(parsed.textScale) ? parsed.textScale : 'default'
      return { textScale, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso() }
    } catch {
      return defaults()
    }
  },

  update(textScale: UiTextScale): UiPreferences {
    const next: UiPreferences = { textScale, updatedAt: nowIso() }
    try {
      writeRaw(UI_PREFS_KEY, JSON.stringify(next))
    } catch {
      // 저장 실패는 앱을 막지 않는다 (세션 내 적용은 유지)
    }
    notifyStoreChanged()
    return next
  },

  reset(): UiPreferences {
    return this.update('default')
  },
}
