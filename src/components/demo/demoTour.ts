import { createContext, useContext } from 'react'

export interface DemoTourStep {
  label: string
  path: string
}

/** 시연 순서 — 각 단계는 실제 페이지로 이동한다 (가짜 화면 없음). */
export const DEMO_TOUR_STEPS: DemoTourStep[] = [
  { label: '고객사 보기', path: '/clients/org-001' },
  { label: '프로젝트 보기', path: '/projects/proj-101' },
  { label: '기업 진단 보기', path: '/diagnosis/projects/proj-101/analysis' },
  { label: '진단 결과 보기', path: '/diagnosis/projects/proj-101/analysis/result' },
  { label: '만들 업무 선택 보기', path: '/selection/projects/proj-101/decision' },
  { label: '기능·화면 설계 보기', path: '/mvp-design/projects/proj-101/features' },
  { label: '최종 설계 결과 보기', path: '/mvp-design/projects/proj-101/review' },
]

export interface DemoTourContextValue {
  active: boolean
  stepIndex: number
  steps: DemoTourStep[]
  /** 시연을 시작한다 (데이터 준비 후 첫 단계로 이동) */
  start: () => void
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  exit: () => void
}

export const DemoTourContext = createContext<DemoTourContextValue | null>(null)

export function useDemoTour(): DemoTourContextValue {
  const ctx = useContext(DemoTourContext)
  if (!ctx) {
    throw new Error('useDemoTour must be used within DemoTourProvider')
  }
  return ctx
}
