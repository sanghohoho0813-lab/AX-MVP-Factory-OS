import {
  BarChart3,
  Building2,
  CalendarCheck2,
  ClipboardList,
  Filter,
  FolderOpen,
  Home,
  Landmark,
  Library,
  Palette,
  PencilRuler,
  SearchCheck,
  Settings,
} from 'lucide-react'
import type { NavigationGroup, NavigationItem } from '../types'

export const APP_VERSION = 'v0.1.0'

/**
 * 사이드바 정보구조 — 업무 흐름 중심으로 그룹화한다.
 * 라벨은 쉬운 한국어를 우선하고, 기존 전문 용어는 hint(툴팁)로 보존한다.
 * 라우트(path)와 내부 키는 변경하지 않는다.
 */
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    key: 'start',
    title: '시작',
    items: [
      { key: 'home', label: '홈', path: '/', icon: Home },
      { key: 'today', label: '오늘 할 일', path: '/today', icon: CalendarCheck2, hint: '일일 실행계획' },
      { key: 'clients', label: '고객사', path: '/clients', icon: Building2, hint: '고객사·프로젝트 관리' },
    ],
  },
  {
    key: 'flow',
    title: 'AX 제작 흐름',
    items: [
      { key: 'diagnosis', label: '기업 진단', path: '/diagnosis', icon: ClipboardList, step: 1, hint: '진단 스튜디오' },
      { key: 'selection', label: '만들 업무 선택', path: '/selection', icon: Filter, step: 2, hint: '과제선별' },
      { key: 'mvp-design', label: '기능·화면 설계', path: '/mvp-design', icon: PencilRuler, step: 3, hint: 'MVP 설계' },
      { key: 'validation', label: '실제 사용 테스트', path: '/validation', icon: SearchCheck, step: 4, hint: '현장검증' },
      { key: 'deliverables', label: '제출자료 만들기', path: '/deliverables', icon: FolderOpen, step: 5, hint: '자료 패키지' },
      { key: 'funding', label: '기관·자금 연계', path: '/funding', icon: Landmark, step: 6, hint: '기관·자금·성과·사례 관리' },
    ],
  },
  {
    key: 'website',
    title: '홈페이지',
    items: [
      { key: 'website-studio', label: '홈페이지 설계', path: '/website-studio', icon: Palette, hint: '웹사이트 스튜디오' },
    ],
  },
  {
    key: 'manage',
    title: '관리',
    items: [
      { key: 'cases', label: '사례 라이브러리', path: '/cases', icon: Library, hint: '기관·자금 연계 사례' },
      { key: 'reports', label: '리포트', path: '/reports', icon: BarChart3 },
      { key: 'settings', label: '설정', path: '/settings', icon: Settings },
    ],
  },
]

/** 하위 호환용 평탄 목록 (기존 참조 유지) */
export const NAVIGATION_ITEMS: NavigationItem[] = NAVIGATION_GROUPS.flatMap((g) => g.items)
