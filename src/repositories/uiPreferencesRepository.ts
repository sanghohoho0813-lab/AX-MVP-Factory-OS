import type { FeatureVisibilityMode, UiMotionMode, UiPreferences, UiTextScale, UiThemeKey } from '../types/ui'
import { isTextScale } from '../lib/uiTextScale'
import { DEFAULT_THEME, isThemeKey } from '../lib/uiTheme'
import { notifyStoreChanged, readRaw, writeRaw } from '../storage/localStore'

/**
 * 전역 표시 설정 저장소 — 스키마 도메인 데이터와 분리된 키를 사용한다.
 * UI 컴포넌트는 이 저장소(또는 상위 훅)를 통해서만 접근한다.
 * 키 이름(axmvp.ui.preferences, textScale)은 변경하지 않는다.
 */
const UI_PREFS_KEY = 'axmvp.ui.preferences'

function nowIso(): string {
  return new Date().toISOString()
}

function isVisibilityMode(v: unknown): v is FeatureVisibilityMode {
  return v === 'core' || v === 'advanced'
}

function isMotionMode(v: unknown): v is UiMotionMode {
  return v === 'full' || v === 'reduced'
}

/** 손상·미저장 시 기본값 (표준 크기 · 핵심 기능만 표시 · 기본 테마) */
function defaults(): UiPreferences {
  return {
    textScale: 'default',
    featureVisibility: 'core',
    theme: DEFAULT_THEME,
    motion: 'full',
    updatedAt: nowIso(),
  }
}

function persist(next: UiPreferences): UiPreferences {
  try {
    writeRaw(UI_PREFS_KEY, JSON.stringify(next))
  } catch {
    // 저장 실패는 앱을 막지 않는다 (세션 내 적용은 유지)
  }
  notifyStoreChanged()
  return next
}

export const uiPreferencesRepository = {
  get(): UiPreferences {
    const raw = readRaw(UI_PREFS_KEY)
    if (raw === null) return defaults()
    try {
      const parsed = JSON.parse(raw) as Partial<UiPreferences>
      const textScale: UiTextScale = isTextScale(parsed.textScale) ? parsed.textScale : 'default'
      const featureVisibility: FeatureVisibilityMode = isVisibilityMode(parsed.featureVisibility)
        ? parsed.featureVisibility
        : 'core'
      return {
        textScale,
        featureVisibility,
        theme: isThemeKey(parsed.theme) ? parsed.theme : DEFAULT_THEME,
        motion: isMotionMode(parsed.motion) ? parsed.motion : 'full',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
      }
    } catch {
      return defaults()
    }
  },

  update(textScale: UiTextScale): UiPreferences {
    const current = this.get()
    return persist({ ...current, textScale, updatedAt: nowIso() })
  },

  setTheme(theme: UiThemeKey): UiPreferences {
    const current = this.get()
    return persist({ ...current, theme, updatedAt: nowIso() })
  },

  setMotion(motion: UiMotionMode): UiPreferences {
    const current = this.get()
    return persist({ ...current, motion, updatedAt: nowIso() })
  },

  setFeatureVisibility(mode: FeatureVisibilityMode): UiPreferences {
    const current = this.get()
    return persist({ ...current, featureVisibility: mode, updatedAt: nowIso() })
  },

  reset(): UiPreferences {
    return persist(defaults())
  },
}
