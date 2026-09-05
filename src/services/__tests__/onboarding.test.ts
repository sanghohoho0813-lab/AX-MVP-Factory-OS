/**
 * 처음 사용 가이드(온보딩) 단위 테스트.
 * 순수 로직·저장소(메모리 대체)·날짜 경계만 검증하므로 node에서 실행된다.
 * 실행: npm run test:onboarding
 */

import { deriveProjectProgress, type ProgressInputs } from '../projectProgressService'
import {
  chapterDisplayStatus,
  guideProgressSummary,
  visibleChapters,
} from '../onboardingService'
import { chaptersForPath, getChapter } from '../../content/onboardingGuideContent'
import {
  onboardingPreferencesRepository,
  TUTORIAL_VERSION,
} from '../../repositories/onboardingPreferencesRepository'
import type { OnboardingPreferences } from '../../types/onboarding'
import { __setClockForTest, todayLocalDate } from '../../lib/appClock'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/* 고정 시계 — 결정적 날짜 경계 검증 */
__setClockForTest(() => new Date(2026, 6, 22, 10, 0, 0)) // 2026-07-22 로컬
const TODAY = todayLocalDate()
check('clock: todayLocalDate 로컬 날짜', TODAY === '2026-07-22', TODAY)

function prefs(over: Partial<OnboardingPreferences> = {}): OnboardingPreferences {
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
    updatedAt: '2026-07-22T00:00:00.000Z',
    ...over,
  }
}

function progressInputs(over: Partial<ProgressInputs> = {}): ProgressInputs {
  return {
    projectId: 'p1',
    projectType: 'ax',
    prepared: true,
    submittedResponseCount: 0,
    blueprintReady: false,
    assessmentExists: false,
    assessmentFinalized: false,
    selectionStarted: false,
    selectionFinalized: false,
    axDesignStarted: false,
    axDesignFinalized: false,
    websiteStarted: false,
    websiteFinalized: false,
    deliverableStarted: false,
    deliverableFinalized: false,
    isSample: false,
    ...over,
  }
}

/* 자동 노출은 없앴다 — 가이드는 사용자가 버튼을 눌러야만 열린다.
   그래서 '오늘 띄울지' 를 판단하던 shouldAutoShowToday 도 함께 삭제했다. */

/* ---------------- chapterDisplayStatus (§10) ---------------- */
const systemCh = getChapter('system')!
check('상태: 안내 챕터 미읽음 → not_started', chapterDisplayStatus(systemCh, null, prefs()) === 'not_started')
check(
  '상태: 안내 챕터 읽음 → completed',
  chapterDisplayStatus(systemCh, null, prefs({ completedChapterIds: ['system'] })) === 'completed',
)

const prepareCh = getChapter('prepare')!
check('상태: 준비 챕터 프로젝트 없음 미읽음 → not_started', chapterDisplayStatus(prepareCh, null, prefs()) === 'not_started')
check(
  '상태: 준비 챕터 프로젝트 없음 읽음 → guide_read',
  chapterDisplayStatus(prepareCh, null, prefs({ completedChapterIds: ['prepare'] })) === 'guide_read',
)

const diagCh = getChapter('diagnosis')!
check('상태: 진단 챕터 프로젝트 없음 → locked', chapterDisplayStatus(diagCh, null, prefs()) === 'locked')

// 진단 완료 프로젝트
const doneDiag = deriveProjectProgress(
  progressInputs({ submittedResponseCount: 2, assessmentExists: true, assessmentFinalized: true }),
)
check('상태: 진단 완료 → completed', chapterDisplayStatus(diagCh, doneDiag, prefs()) === 'completed')

// 진단 시작 가능(ready) — 준비 완료, 진단 미시작
const readyDiag = deriveProjectProgress(progressInputs())
check('상태: 진단 ready·미읽음 → not_started', chapterDisplayStatus(diagCh, readyDiag, prefs()) === 'not_started')
check(
  '상태: 진단 ready·읽음 → guide_read',
  chapterDisplayStatus(diagCh, readyDiag, prefs({ completedChapterIds: ['diagnosis'] })) === 'guide_read',
)

// 진단 진행 중
const inProgDiag = deriveProjectProgress(progressInputs({ submittedResponseCount: 1 }))
check('상태: 진단 진행 중 → in_progress', chapterDisplayStatus(diagCh, inProgDiag, prefs()) === 'in_progress')

// 진단 잠김 (준비 미완료)
const blockedDiag = deriveProjectProgress(progressInputs({ prepared: false }))
check('상태: 진단 잠김 → locked', chapterDisplayStatus(diagCh, blockedDiag, prefs()) === 'locked')

/* ---------------- visibleChapters / chaptersForPath (§7) ---------------- */
const axOrder = visibleChapters('ax', 'core').map((c) => c.id)
check(
  'chapters: AX 순서',
  JSON.stringify(axOrder) === JSON.stringify(['system', 'prepare', 'diagnosis', 'selection', 'ax_design', 'deliverables', 'advanced']),
  JSON.stringify(axOrder),
)
const webOrder = visibleChapters('website', 'core').map((c) => c.id)
check(
  'chapters: 홈페이지 순서',
  JSON.stringify(webOrder) === JSON.stringify(['system', 'prepare', 'website_design', 'deliverables', 'advanced']),
  JSON.stringify(webOrder),
)
const bothOrder = visibleChapters('ax_website', 'core').map((c) => c.id)
check(
  'chapters: AX+홈페이지 순서',
  JSON.stringify(bothOrder) ===
    JSON.stringify(['system', 'prepare', 'diagnosis', 'selection', 'ax_design', 'website_design', 'deliverables', 'advanced']),
  JSON.stringify(bothOrder),
)
check('chapters: 홈페이지 경로에 진단 없음', !chaptersForPath('website').some((c) => c.id === 'diagnosis'))
check('chapters: 고급 챕터는 항상 마지막', visibleChapters('ax', 'core').slice(-1)[0].id === 'advanced')

/* ---------------- guideProgressSummary ---------------- */
const sum0 = guideProgressSummary('ax', readyDiag, prefs())
check('진행률: AX 핵심 챕터 총 5', sum0.totalCore === 5, String(sum0.totalCore))
check('진행률: 준비만 완료 → 1/5', sum0.completedCore === 1, String(sum0.completedCore))
check('진행률: 퍼센트 20', sum0.percent === 20, String(sum0.percent))

/* ---------------- 저장소 (§3, §19) ---------------- */
onboardingPreferencesRepository.resetGuideProgress()
onboardingPreferencesRepository.setAutoShow(true)
let p = onboardingPreferencesRepository.get()
check('저장소: 기본 자동 노출 ON', p.autoShowEnabled === true)

p = onboardingPreferencesRepository.markShownToday()
check('저장소: markShownToday lastShownDate 오늘', p.lastShownDate === TODAY)
check('저장소: markShownToday firstSeenAt 채움', p.firstSeenAt !== null)

p = onboardingPreferencesRepository.snoozeToday()
check('저장소: snoozeToday 오늘 날짜', p.snoozedUntilDate === TODAY)
p = onboardingPreferencesRepository.clearSnooze()
check('저장소: clearSnooze 해제', p.snoozedUntilDate === null)

p = onboardingPreferencesRepository.markChapterRead('diagnosis')
check('저장소: 챕터 읽음 기록', p.completedChapterIds.includes('diagnosis') && p.lastOpenedChapterId === 'diagnosis')
p = onboardingPreferencesRepository.markChapterRead('diagnosis')
check('저장소: 중복 읽음 방지', p.completedChapterIds.filter((x) => x === 'diagnosis').length === 1)

// 진행 초기화는 읽음 상태만 지우고 자동 노출 설정은 유지
onboardingPreferencesRepository.setAutoShow(false)
p = onboardingPreferencesRepository.resetGuideProgress()
check('저장소: 초기화 후 읽음 비움', p.completedChapterIds.length === 0 && p.firstSeenAt === null)
check('저장소: 초기화는 자동 노출 설정 유지', p.autoShowEnabled === false)

__setClockForTest(null)

console.log(`\nonboarding: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
