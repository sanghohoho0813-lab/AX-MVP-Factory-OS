/**
 * 처음 사용 가이드 서비스 — 안내 상태 계산을 한곳에 모은다.
 *
 * 진행률·완료 판정은 projectProgressService(단일 기준)만 사용한다. 여기서
 * 도메인 계산을 복제하지 않고, 그 결과를 안내용 라벨/상태로 변환만 한다.
 */

import type { Project } from '../types/domain'
import type {
  ChapterDisplayStatus,
  GuideMode,
  LearningPath,
  OnboardingPreferences,
  TutorialChapter,
} from '../types/onboarding'
import { getProjectProgress, type ProjectProgress } from './projectProgressService'
import { computeProjectJourney, type ProjectJourney } from './journeyService'
import { chaptersForPath, TUTORIAL_CHAPTERS } from '../content/onboardingGuideContent'
import { TUTORIAL_VERSION } from '../repositories/onboardingPreferencesRepository'
import { projectRepository } from '../repositories'
import { todayLocalDate } from '../lib/appClock'

/* ------------------------------------------------------------------ */
/* 학습 경로 · 챕터 목록                                                */
/* ------------------------------------------------------------------ */

/** 프로젝트 유형 → 학습 경로 */
export function pathForProject(project: Project | null): LearningPath | null {
  return project ? project.projectType : null
}

/**
 * 화면에 표시할 챕터 목록. Core 모드에서는 고급 챕터를 목록 끝으로 보낸다
 * (접어서 보여주는 것은 UI 담당). advanced 모드면 순서 그대로.
 */
export function visibleChapters(path: LearningPath, mode: GuideMode): TutorialChapter[] {
  const list = chaptersForPath(path)
  if (mode === 'advanced') return list
  const core = list.filter((c) => !c.advanced)
  const advanced = list.filter((c) => c.advanced)
  return [...core, ...advanced]
}

/** 경로를 모를 때(프로젝트 없음)의 기본 안내 경로 — 전체를 보여준다 */
export function defaultPath(prefs: OnboardingPreferences): LearningPath {
  return prefs.selectedLearningPath ?? 'ax_website'
}

/* ------------------------------------------------------------------ */
/* 챕터 표시 상태 (§10) — 실제 데이터 기준                              */
/* ------------------------------------------------------------------ */

/**
 * 챕터의 종합 표시 상태.
 *  - 업무 단계가 있는 챕터: 진행률 단일 기준의 단계 상태를 그대로 반영
 *    (completed / in_progress / locked / ready).
 *  - ready 상태에서 안내를 읽었으면 'guide_read', 아니면 'not_started'.
 *  - 안내 전용 챕터(시스템 이해·고급 운영): 읽었으면 'completed', 아니면 'not_started'.
 */
export function chapterDisplayStatus(
  chapter: TutorialChapter,
  progress: ProjectProgress | null,
  prefs: OnboardingPreferences,
): ChapterDisplayStatus {
  const read = prefs.completedChapterIds.includes(chapter.id)

  if (chapter.progressStepKey === null) {
    return read ? 'completed' : 'not_started'
  }

  if (!progress) {
    // 프로젝트가 없으면 준비 단계만 시작 가능, 나머지는 잠김
    if (chapter.progressStepKey === 'prepare') return read ? 'guide_read' : 'not_started'
    return 'locked'
  }

  const step = progress.steps.find((s) => s.key === chapter.progressStepKey)
  if (!step) {
    // 이 프로젝트 유형에 해당 없는 단계
    return read ? 'guide_read' : 'not_started'
  }
  switch (step.state) {
    case 'completed':
      return 'completed'
    case 'in_progress':
      return 'in_progress'
    case 'blocked_by_prerequisite':
      return 'locked'
    case 'ready':
      return read ? 'guide_read' : 'not_started'
    default:
      return 'not_started'
  }
}

export const CHAPTER_STATUS_LABEL: Record<ChapterDisplayStatus, string> = {
  completed: '실제 업무 완료',
  in_progress: '진행 중',
  guide_read: '안내 읽음',
  not_started: '아직 시작 전',
  locked: '이전 단계가 필요함',
}

/* ------------------------------------------------------------------ */
/* 오늘의 추천 작업 (§6 · §14)                                          */
/* ------------------------------------------------------------------ */

/** 오늘 안내의 기준이 되는 프로젝트를 고른다 (활성 우선 → 최근 → 없음) */
export function resolveTargetProject(activeProjectId: string | null): Project | null {
  if (activeProjectId) {
    const active = projectRepository.getById(activeProjectId)
    if (active && active.archivedAt === null) return active
  }
  const candidates = projectRepository
    .getAll()
    .filter((p) => p.archivedAt === null && p.status !== 'archived')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return candidates[0] ?? null
}

export interface TodayGuidance {
  hasProject: boolean
  project: Project | null
  journey: ProjectJourney | null
  progress: ProjectProgress | null
  /** 핵심 단계를 모두 마쳤는지 (라이트 안내로 전환) */
  allCompleted: boolean
}

/** 오늘의 추천 작업 — 진행률 단일 기준 + 다음 행동을 안내용으로 감싼다 */
export function computeTodayGuidance(activeProjectId: string | null): TodayGuidance {
  const project = resolveTargetProject(activeProjectId)
  if (!project) {
    return { hasProject: false, project: null, journey: null, progress: null, allCompleted: false }
  }
  const progress = getProjectProgress(project)
  const journey = computeProjectJourney(project)
  return {
    hasProject: true,
    project,
    journey,
    progress,
    allCompleted: progress.allCompleted,
  }
}

/* ------------------------------------------------------------------ */
/* 일일 자동 노출 판단 (§3 · §4)                                        */
/* ------------------------------------------------------------------ */

/** 자동 노출을 막는 화면(공개 설문·공개 테스트·인쇄 등)은 라우터 밖이거나 여기서 제외 */
const AUTO_SHOW_BLOCKED_PREFIXES = ['/survey/', '/test/']

export function isRouteAutoShowAllowed(pathname: string): boolean {
  return !AUTO_SHOW_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * 오늘 자동으로 가이드를 띄울지 판단한다.
 *  - 자동 노출 OFF → 안 함
 *  - 콘텐츠 버전이 올라갔으면 스누즈만 지켜 재노출
 *  - 오늘 날짜가 스누즈 경계 이하이면 안 함(로컬 날짜 기준, 포함)
 *  - 오늘 이미 노출했으면 안 함(버전 변경 시 예외)
 */
export function shouldAutoShowToday(
  prefs: OnboardingPreferences,
  today: string = todayLocalDate(),
): boolean {
  if (!prefs.autoShowEnabled) return false
  const versionChanged = prefs.tutorialVersion < TUTORIAL_VERSION
  if (prefs.snoozedUntilDate !== null && today <= prefs.snoozedUntilDate) return false
  if (!versionChanged && prefs.lastShownDate === today) return false
  return true
}

/* ------------------------------------------------------------------ */
/* 가이드 전체 진행률 (안내 센터 헤더용)                                */
/* ------------------------------------------------------------------ */

export interface GuideProgressSummary {
  /** 완료(실제 업무 완료)한 핵심 챕터 수 */
  completedCore: number
  /** 핵심 챕터 총 수 */
  totalCore: number
  percent: number
}

/** 경로 기준 핵심 챕터의 실제 업무 완료율 (진행률 단일 기준 반영) */
export function guideProgressSummary(
  path: LearningPath,
  progress: ProjectProgress | null,
  prefs: OnboardingPreferences,
): GuideProgressSummary {
  const core = chaptersForPath(path).filter((c) => !c.advanced && c.progressStepKey !== null)
  const completedCore = core.filter(
    (c) => chapterDisplayStatus(c, progress, prefs) === 'completed',
  ).length
  const totalCore = core.length
  const percent = totalCore === 0 ? 0 : Math.round((completedCore / totalCore) * 100)
  return { completedCore, totalCore, percent }
}

/** 이어보기용 — 마지막으로 연 챕터(없으면 첫 미완료/첫 챕터) */
export function resumeChapterId(
  path: LearningPath,
  mode: GuideMode,
  progress: ProjectProgress | null,
  prefs: OnboardingPreferences,
): string {
  const list = visibleChapters(path, mode)
  if (prefs.lastOpenedChapterId && list.some((c) => c.id === prefs.lastOpenedChapterId)) {
    return prefs.lastOpenedChapterId
  }
  const firstIncomplete = list.find(
    (c) => chapterDisplayStatus(c, progress, prefs) !== 'completed',
  )
  return firstIncomplete?.id ?? list[0]?.id ?? TUTORIAL_CHAPTERS[0].id
}
