/**
 * 처음 사용 가이드(온보딩 튜토리얼) 도메인 타입.
 *
 * 주의: 이 파일은 "안내 콘텐츠·표시 상태"만 다룬다. 실제 업무 진행률은
 * projectProgressService(단일 기준)에서만 계산하며 여기서 복제하지 않는다.
 */

import type { CoreStepKey } from '../services/projectProgressService'

/** 학습 경로 = 프로젝트 유형 (챕터 필터에 사용) */
export type LearningPath = 'ax' | 'website' | 'ax_website'

/** 가이드 표시 모드 — 고급 챕터 노출 여부 */
export type GuideMode = 'core' | 'advanced'

/**
 * 온보딩 저장 데이터 (버전 관리). 도메인 스키마와 분리된 별도 키에 저장한다.
 * 절대 도메인 데이터(localStorage v1.*)를 건드리지 않는다.
 */
export interface OnboardingPreferences {
  /** 콘텐츠 버전 — 안내가 크게 바뀌면 올려 재노출 판단에 사용 */
  tutorialVersion: number
  /** 일일 자동 노출 사용 여부 (기본 ON) */
  autoShowEnabled: boolean
  /** 최초 안내를 본 시각 (ISO) — 없으면 아직 안 봄 */
  firstSeenAt: string | null
  /** 마지막으로 자동 노출된 로컬 날짜 (YYYY-MM-DD) */
  lastShownDate: string | null
  /** "오늘 하루 보지 않기"로 미룬 날짜 — 이 날짜까지(포함) 자동 노출 안 함 */
  snoozedUntilDate: string | null
  /** 안내(챕터)를 읽음 처리한 챕터 id 목록 — 튜토리얼 읽음 상태(도메인 아님) */
  completedChapterIds: string[]
  /** 마지막으로 연 챕터 id (이어보기) */
  lastOpenedChapterId: string | null
  /** 사용자가 선택/추론된 학습 경로 */
  selectedLearningPath: LearningPath | null
  /** 가이드 모드 (고급 챕터 노출) */
  guideMode: GuideMode
  /** 저장 시각 */
  updatedAt: string
}

/** 챕터의 실제 업무 상태 (진행률 단일 기준을 안내용 라벨로 변환) */
export type ChapterWorkState =
  | 'not_applicable' // 이 프로젝트 유형에 해당 없음
  | 'locked' // 이전 단계가 필요함
  | 'not_started' // 아직 업무 시작 전
  | 'in_progress' // 진행 중
  | 'completed' // 실제 업무 완료

/** 화면에 표시하는 챕터 종합 상태 (§10 네 가지 구분) */
export type ChapterDisplayStatus =
  | 'completed' // 실제 업무 완료
  | 'in_progress' // 진행 중
  | 'guide_read' // 안내 읽음(업무 시작 전)
  | 'not_started' // 아직 업무 시작 전
  | 'locked' // 이전 단계가 필요함

/** 튜토리얼 챕터 정의 (안내 콘텐츠 레지스트리 §17) */
export interface TutorialChapter {
  id: string
  /** 순서 정렬용 번호 (0~7) */
  order: number
  title: string
  /** 짧은 설명 (목록용) */
  shortDescription: string
  /** 목적 상세 */
  detailedPurpose: string
  /** 왜 필요한지 */
  whyNeeded: string
  /** 시작 전 필요한 것 */
  prerequisites: string[]
  /** 이 화면에서 하는 일 */
  tasks: string[]
  /** 입력 내용 */
  inputs: string[]
  /** 주의점 */
  warnings: string[]
  /** 완료 조건 */
  completionCriteria: string[]
  /** 완료 후 결과 */
  expectedOutputs: string[]
  /** 다음 단계 안내 */
  nextStepHint: string
  /** 예상 소요시간(대략) */
  estimatedMinutes: number
  /** 자주 하는 실수 */
  commonMistakes: string[]
  /** 실제 이동 경로 (프로젝트 기준으로 치환 가능한 템플릿, :projectId 포함 가능) */
  routeTemplate: string | null
  /** 이 챕터가 적용되는 프로젝트 유형 */
  availableProjectTypes: LearningPath[]
  /** 고급 운영 챕터 여부 (Core 모드에서 마지막에 접힘) */
  advanced: boolean
  /** 진행률 단일 기준의 어떤 단계에 대응하는지 (없으면 안내 전용) */
  progressStepKey: CoreStepKey | null
  /** 로컬 모드 관련 안내를 함께 보여줄지 (공유·협업 챕터) */
  showLocalModeNotice?: boolean
}

/** 용어 쉬운 정의 (§9) */
export interface TermDefinition {
  term: string
  plain: string
}

/** FAQ 항목 (§11 F) */
export interface FaqItem {
  question: string
  answer: string
}

/** 화면별 "이 화면 사용법" 도움말 (§12) */
export interface ScreenHelp {
  /** 안정적인 화면 키 */
  key: string
  screenTitle: string
  /** 이 화면의 목적 */
  purpose: string
  /** 먼저 확인할 것 */
  checkFirst: string[]
  /** 입력 방법 */
  howToInput: string[]
  /** 완료 조건 */
  completionCriteria: string[]
  /** 다음 단계 */
  nextStep: string
  /** 관련 챕터 id (열기) */
  relatedChapterId: string | null
}

/** DOM 앵커 기반 화면 투어 한 단계 (§13) */
export interface TourStep {
  /** 대상 요소 선택자 (data-tour 속성) — 없으면 화면 중앙 안내 */
  target: string | null
  title: string
  body: string
}

/** 화면 투어 정의 */
export interface ScreenTour {
  key: string
  screenTitle: string
  steps: TourStep[]
}
