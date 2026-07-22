import type { GuideMode, LearningPath, OnboardingPreferences } from '../types/onboarding'
import { notifyStoreChanged, readRaw, writeRaw } from '../storage/localStore'
import { nowIso, todayLocalDate } from '../lib/appClock'

/**
 * 처음 사용 가이드 저장소 — 도메인 스키마와 분리된 별도 키를 사용한다.
 * (도메인 데이터 localStorage v1.* 는 절대 건드리지 않는다.)
 * 키 이름(axmvp.onboarding.prefs)은 변경하지 않는다.
 */
const ONBOARDING_KEY = 'axmvp.onboarding.prefs'

/** 현재 안내 콘텐츠 버전. 안내가 크게 개편되면 올린다. */
export const TUTORIAL_VERSION = 1

function isLearningPath(v: unknown): v is LearningPath {
  return v === 'ax' || v === 'website' || v === 'ax_website'
}

function isGuideMode(v: unknown): v is GuideMode {
  return v === 'core' || v === 'advanced'
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/** 기본값 — 일일 자동 노출 ON, 최초 미시청 */
function defaults(): OnboardingPreferences {
  return {
    tutorialVersion: TUTORIAL_VERSION,
    autoShowEnabled: true,
    firstSeenAt: null,
    lastShownDate: null,
    snoozedUntilDate: null,
    completedChapterIds: [],
    lastOpenedChapterId: null,
    selectedLearningPath: null,
    guideMode: 'core',
    updatedAt: nowIso(),
  }
}

/** 저장값을 안전하게 정규화 (손상·부분 저장 대비, 기존 키 보존) */
function normalize(parsed: Partial<OnboardingPreferences>): OnboardingPreferences {
  const base = defaults()
  return {
    // 저장된 콘텐츠 버전은 보존한다(재노출 판단은 서비스에서 비교).
    tutorialVersion:
      typeof parsed.tutorialVersion === 'number' ? parsed.tutorialVersion : base.tutorialVersion,
    autoShowEnabled:
      typeof parsed.autoShowEnabled === 'boolean' ? parsed.autoShowEnabled : base.autoShowEnabled,
    firstSeenAt: typeof parsed.firstSeenAt === 'string' ? parsed.firstSeenAt : null,
    lastShownDate: typeof parsed.lastShownDate === 'string' ? parsed.lastShownDate : null,
    snoozedUntilDate: typeof parsed.snoozedUntilDate === 'string' ? parsed.snoozedUntilDate : null,
    completedChapterIds: isStringArray(parsed.completedChapterIds) ? parsed.completedChapterIds : [],
    lastOpenedChapterId:
      typeof parsed.lastOpenedChapterId === 'string' ? parsed.lastOpenedChapterId : null,
    selectedLearningPath: isLearningPath(parsed.selectedLearningPath)
      ? parsed.selectedLearningPath
      : null,
    guideMode: isGuideMode(parsed.guideMode) ? parsed.guideMode : 'core',
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : base.updatedAt,
  }
}

function persist(next: OnboardingPreferences): OnboardingPreferences {
  const stamped = { ...next, updatedAt: nowIso() }
  try {
    writeRaw(ONBOARDING_KEY, JSON.stringify(stamped))
  } catch {
    // 저장 실패는 앱을 막지 않는다 (세션 내 적용 유지)
  }
  notifyStoreChanged()
  return stamped
}

export const onboardingPreferencesRepository = {
  get(): OnboardingPreferences {
    const raw = readRaw(ONBOARDING_KEY)
    if (raw === null) return defaults()
    try {
      return normalize(JSON.parse(raw) as Partial<OnboardingPreferences>)
    } catch {
      return defaults()
    }
  },

  update(patch: Partial<OnboardingPreferences>): OnboardingPreferences {
    return persist({ ...this.get(), ...patch })
  },

  setAutoShow(enabled: boolean): OnboardingPreferences {
    return this.update({ autoShowEnabled: enabled })
  },

  /** 오늘 자동 노출됨을 기록 (최초면 firstSeenAt 도 채움) */
  markShownToday(): OnboardingPreferences {
    const current = this.get()
    return persist({
      ...current,
      lastShownDate: todayLocalDate(),
      firstSeenAt: current.firstSeenAt ?? nowIso(),
      tutorialVersion: TUTORIAL_VERSION,
    })
  },

  /** "오늘 하루 보지 않기" — 오늘 날짜까지 미룬다(로컬 날짜 경계) */
  snoozeToday(): OnboardingPreferences {
    return this.update({ snoozedUntilDate: todayLocalDate() })
  },

  /** 오늘 미루기 해제 */
  clearSnooze(): OnboardingPreferences {
    return this.update({ snoozedUntilDate: null })
  },

  markChapterRead(chapterId: string): OnboardingPreferences {
    const current = this.get()
    if (current.completedChapterIds.includes(chapterId)) {
      return this.update({ lastOpenedChapterId: chapterId })
    }
    return this.update({
      completedChapterIds: [...current.completedChapterIds, chapterId],
      lastOpenedChapterId: chapterId,
    })
  },

  setLastOpenedChapter(chapterId: string): OnboardingPreferences {
    return this.update({ lastOpenedChapterId: chapterId })
  },

  setLearningPath(path: LearningPath | null): OnboardingPreferences {
    return this.update({ selectedLearningPath: path })
  },

  setGuideMode(mode: GuideMode): OnboardingPreferences {
    return this.update({ guideMode: mode })
  },

  /**
   * 가이드 진행(튜토리얼 읽음) 상태만 초기화한다.
   * 도메인 데이터·설정(자동 노출 여부)은 유지한다.
   */
  resetGuideProgress(): OnboardingPreferences {
    const current = this.get()
    return persist({
      ...current,
      completedChapterIds: [],
      lastOpenedChapterId: null,
      firstSeenAt: null,
      lastShownDate: null,
      snoozedUntilDate: null,
    })
  },
}
