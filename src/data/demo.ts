import { Box, ClipboardList, FileText, Filter } from 'lucide-react'
import type {
  MetricSummary,
  PortfolioProject,
  PriorityTask,
  TimelineItem,
  TimelineTrack,
} from '../types'

/* ------------------------------------------------------------------ */
/* 워크스페이스 / 사용자                                                */
/* ------------------------------------------------------------------ */

export const CURRENT_WORKSPACE = '김팀장의 AX랩'

export const WORKSPACES = ['김팀장의 AX랩', '대한정밀 컨설팅룸'] as const

export const CURRENT_USER = {
  name: '김팀장',
  role: 'AX랩 대표',
  initial: '김',
} as const

export const NOTIFICATION_COUNT = 8

export const NOTIFICATIONS = [
  { id: 'n1', message: '대한정밀 제조자료 검토가 내일 마감됩니다.', time: '10분 전' },
  { id: 'n2', message: '스마트물류 과제선별 워크숍 자료가 업로드되었습니다.', time: '1시간 전' },
  { id: 'n3', message: 'C병원 MVP 설계 검토 일정이 확정되었습니다.', time: '어제' },
] as const

/* ------------------------------------------------------------------ */
/* A. 핵심 운영 현황 KPI                                                */
/* ------------------------------------------------------------------ */

export const METRIC_SUMMARIES: MetricSummary[] = [
  {
    key: 'diagnosis-active',
    label: '진행 중 진단',
    value: 12,
    unit: '건',
    weeklyDelta: 2,
    tone: 'info',
    icon: ClipboardList,
  },
  {
    key: 'selection-pending',
    label: '선별 대기 과제',
    value: 7,
    unit: '건',
    weeklyDelta: 1,
    tone: 'warning',
    icon: Filter,
  },
  {
    key: 'mvp-building',
    label: '제작 중 MVP',
    value: 5,
    unit: '건',
    weeklyDelta: 0,
    tone: 'success',
    icon: Box,
  },
  {
    key: 'deliverables-preparing',
    label: '제출자료 준비',
    value: 3,
    unit: '건',
    weeklyDelta: -1,
    tone: 'danger',
    icon: FileText,
  },
]

/* ------------------------------------------------------------------ */
/* B. 이번 주 운영 타임라인 (2026.07.20 월 ~ 07.26 일)                   */
/* ------------------------------------------------------------------ */

export const WEEK_RANGE_LABEL = '2026.07.20 (월) ~ 07.26 (일)'

export const WEEK_DAYS = [
  { label: '월', date: 20 },
  { label: '화', date: 21 },
  { label: '수', date: 22 },
  { label: '목', date: 23 },
  { label: '금', date: 24 },
  { label: '토', date: 25 },
  { label: '일', date: 26 },
] as const

/** 데모 기준 오늘: 7.22(수) — 주 시작(월) 기준 인덱스 */
export const DEMO_TODAY_INDEX = 2

export const TIMELINE_TRACKS: TimelineTrack[] = [
  { key: 'diagnosis', label: '진단', tone: 'info' },
  { key: 'selection', label: '과제선별', tone: 'warning' },
  { key: 'mvp_design', label: 'MVP 설계', tone: 'success' },
  { key: 'website_design', label: '웹사이트 설계', tone: 'accent' },
  { key: 'validation', label: '현장검증', tone: 'info' },
  { key: 'deliverables', label: '자료 패키지', tone: 'danger' },
]

export const TIMELINE_ITEMS: TimelineItem[] = [
  {
    id: 't1',
    trackKey: 'diagnosis',
    title: 'ABC제조 진단 인터뷰',
    owner: '이정민 책임',
    startDay: 0,
    durationDays: 2,
  },
  {
    id: 't2',
    trackKey: 'selection',
    title: '스마트물류 과제선별 워크숍',
    owner: '박지훈 수석',
    startDay: 1,
    durationDays: 2,
  },
  {
    id: 't3',
    trackKey: 'mvp_design',
    title: 'C병원 MVP 설계 검토',
    owner: '최유진 책임',
    startDay: 2,
    durationDays: 2,
  },
  {
    id: 't4',
    trackKey: 'website_design',
    title: '세무사무소 홈페이지 디자인 가이드',
    owner: '정수현 선임',
    startDay: 2,
    durationDays: 3,
  },
  {
    id: 't5',
    trackKey: 'validation',
    title: '비원미래 현장검증 2차',
    owner: '김도현 책임',
    startDay: 3,
    durationDays: 2,
  },
  {
    id: 't6',
    trackKey: 'deliverables',
    title: '대한정밀 기관 설명자료 초안',
    owner: '김팀장',
    startDay: 4,
    durationDays: 2,
  },
]

/* ------------------------------------------------------------------ */
/* C. 오늘의 우선순위                                                   */
/* ------------------------------------------------------------------ */

export const PRIORITY_TASKS: PriorityTask[] = [
  {
    id: 'p1',
    rank: 1,
    client: '대한정밀',
    title: '제조자료 검토 마감',
    nextAction: '기관 제출 전 설명자료 초안 검토 및 피드백 반영',
    owner: '김팀장',
    dueLabel: 'D-1',
    tone: 'danger',
    action: {
      type: 'notify',
      label: '검토하기',
      message: '자료 검토 화면은 다음 개발 단계에서 제공됩니다.',
    },
  },
  {
    id: 'p2',
    rank: 2,
    client: '스마트물류',
    title: '과제선별 워크숍',
    nextAction: '이해관계자 인터뷰 결과 정리 및 선별 기준 준비',
    owner: '박지훈 수석',
    dueLabel: 'D-2',
    tone: 'warning',
    action: {
      type: 'notify',
      label: '자료보기',
      message: '워크숍 자료 화면은 다음 개발 단계에서 제공됩니다.',
    },
  },
  {
    id: 'p3',
    rank: 3,
    client: '세무사무소',
    title: '홈페이지 디자인 방향 확정',
    nextAction: '브랜드 정보 기반 디자인 가이드 초안 확정',
    owner: '정수현 선임',
    dueLabel: 'D-3',
    tone: 'info',
    action: {
      type: 'navigate',
      label: '스튜디오 열기',
      to: '/website-studio',
    },
  },
]

/* ------------------------------------------------------------------ */
/* D. 고객사 포트폴리오 건강도                                           */
/* ------------------------------------------------------------------ */

export const PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: 'c1',
    client: 'ABC제조',
    industry: '제조업',
    stage: 'diagnosis',
    progress: 65,
    health: 'healthy',
  },
  {
    id: 'c2',
    client: 'C병원',
    industry: '병원',
    stage: 'mvp_design',
    progress: 70,
    health: 'healthy',
  },
  {
    id: 'c3',
    client: '스마트물류',
    industry: '물류',
    stage: 'selection',
    progress: 40,
    health: 'attention',
  },
  {
    id: 'c4',
    client: '한빛세무사무소',
    industry: '세무사무소',
    stage: 'validation',
    progress: 25,
    health: 'risk',
  },
]
