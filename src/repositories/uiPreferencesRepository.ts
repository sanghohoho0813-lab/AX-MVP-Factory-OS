import type { FeatureVisibilityMode, UiMotionMode, UiPreferences, UiTextScale, UiThemeKey } from '../types/ui'
import { isTextScale } from '../lib/uiTextScale'
import { DEFAULT_THEME, LEGACY_DEFAULT_THEME, isThemeKey } from '../lib/uiTheme'
import { notifyStoreChanged, readRaw, writeRaw } from '../storage/localStore'
import { themeAlias } from '../lib/uiNameAliases'

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
      const chosen = parsed.themeChosen === true
      // D-315 테마 이름이 바뀌었으면 옛 이름으로 고른 것도 이어진다
      const tk = typeof parsed.theme === 'string' ? themeAlias(parsed.theme) : parsed.theme
      const saved = isThemeKey(tk) ? tk : DEFAULT_THEME
      return {
        textScale,
        featureVisibility,
        // D-186: 예전 기본값(딥 틸)은 글자 크기 등을 바꿀 때 함께 저장됐을 뿐 — 직접 고른 표시가 없으면 새 기본(오닉스 골드)
        theme: saved === LEGACY_DEFAULT_THEME && !chosen ? DEFAULT_THEME : saved,
        ...(chosen ? { themeChosen: true } : {}),
        motion: isMotionMode(parsed.motion) ? parsed.motion : 'full',
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
      }
    } catch {
      return defaults()
    }
  },

  update(textScale: UiTextScale): UiPreferences {
    return this.patch({ textScale })
  },

  setTheme(theme: UiThemeKey): UiPreferences {
    // 설정 › 화면에서 직접 고른 것 — 딥 틸을 골라도 그대로 둔다(D-186)
    return this.patch({ theme, themeChosen: true })
  },

  setMotion(motion: UiMotionMode): UiPreferences {
    return this.patch({ motion })
  },

  setFeatureVisibility(mode: FeatureVisibilityMode): UiPreferences {
    return this.patch({ featureVisibility: mode })
  },

  /**
   * D-315 바꾼 칸만 고쳐 쓴다 — 이 버전이 모르는 값(다음 버전의 새 칸 · 이름이 바뀐 테마)은 저장된 그대로 둔다.
   * 예전에는 하나를 바꿀 때 전부 이 버전 기준으로 다시 써서, 모르는 값이 기본값으로 덮였다.
   */
  patch(change: Partial<UiPreferences>): UiPreferences {
    let base: Record<string, unknown> = { ...this.get() }
    try {
      const raw = readRaw(UI_PREFS_KEY)
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = { ...base, ...(parsed as Record<string, unknown>) }
    } catch {
      // 손상된 기억이면 이 버전 값으로
    }
    persist({ ...base, ...change, updatedAt: nowIso() } as UiPreferences)
    return this.get()
  },

  reset(): UiPreferences {
    return persist(defaults())
  },
}
