import type { LucideIcon } from 'lucide-react'
import {
  BookOpenText,
  Building2,
  CalendarDays,
  Compass,
  Gauge,
  ClipboardList,
  FileCheck2,
  Filter,
  FlaskConical,
  Inbox,
  Landmark,
  LayoutGrid,
  Library,
  ListChecks,
  NotebookPen,
  Palette,
  PencilRuler,
  Settings,
  Sun,
} from 'lucide-react'

/**
 * 모듈 레지스트리 — 이 제품이 어떤 화면 묶음으로 구성되는지의 목록.
 *
 * 사이드바·도구함·튜토리얼은 이 목록에서 메뉴를 만든다. 화면을 추가하거나 다른 회사용으로
 * 조립할 때 컴포넌트 여기저기를 고치지 않고 여기서 켜고 끄기만 하면 되게 하려는 것이다.
 * 라우트 자체(appRouteChildren)는 여기와 별개로 항상 살아 있다 — 메뉴에서 빠져도 직접 주소로는 열린다.
 */

/** 메뉴 아이콘 구분색 — index.css 의 --color-nav-* 고정 토큰 이름 */
export type NavAccent = 'overview' | 'ops' | 'revenue' | 'customer' | 'ai' | 'evidence' | 'alert' | 'system'

export type ModuleGroupKey =
  | 'today'
  | 'clients'
  | 'calendar'
  | 'funding'
  | 'journal'
  | 'studio'
  | 'about'
  | 'tools'
  | 'settings'

export interface ModuleGroup {
  key: ModuleGroupKey
  title: string
  accent: NavAccent
  /** 접을 수 있는 그룹(전문 기능 묶음) */
  collapsible?: boolean
  /** 처음에는 접어 둔다 */
  defaultCollapsed?: boolean
}

export interface ModuleDefinition {
  key: string
  label: string
  path: string
  icon: LucideIcon
  group: ModuleGroupKey
  accent: NavAccent
  /** 이 제품 조립에서 켜져 있는지 */
  enabled: boolean
  /** 메뉴 활성 판정을 정확히 경로 일치로만 할지 (홈처럼 모든 경로의 접두가 되는 경우) */
  exact?: boolean
  /** 툴팁·도움말용 예전 이름 */
  hint?: string
  /**
   * 기능 상태. 'next' 는 아직 없는 기능이다 — 메뉴에는 NEXT 배지로 보이고,
   * 누르면 404 대신 무엇을 만들 계획인지 설명하는 화면으로 간다. (규격 U-3)
   */
  status?: 'live' | 'next'
}

export const MODULE_GROUPS: ModuleGroup[] = [
  { key: 'today', title: '오늘', accent: 'overview' },
  { key: 'clients', title: '고객', accent: 'ops' },
  { key: 'calendar', title: '일정', accent: 'evidence' },
  { key: 'funding', title: '자금·지원', accent: 'revenue' },
  { key: 'journal', title: '업무 일기', accent: 'customer' },
  { key: 'studio', title: 'AX STUDIO', accent: 'ai', collapsible: true, defaultCollapsed: true },
  { key: 'about', title: '이 시스템', accent: 'system', collapsible: true, defaultCollapsed: true },
  { key: 'tools', title: '도구함', accent: 'system' },
  { key: 'settings', title: '설정', accent: 'system' },
]

export const MODULES: ModuleDefinition[] = [
  { key: 'today', label: '오늘', path: '/', icon: Sun, group: 'today', accent: 'overview', enabled: true, exact: true },

  { key: 'client-ops', label: '고객 운영', path: '/ops/clients', icon: ListChecks, group: 'clients', accent: 'ops', enabled: true },
  { key: 'inbox', label: '고객 이벤트함', path: '/ops/inbox', icon: Inbox, group: 'clients', accent: 'alert', enabled: true },

  { key: 'calendar', label: '일정', path: '/ops/calendar', icon: CalendarDays, group: 'calendar', accent: 'evidence', enabled: true },

  { key: 'funding', label: '자금·지원사업', path: '/funding', icon: Landmark, group: 'funding', accent: 'revenue', enabled: true },

  { key: 'journal-today', label: '오늘 기록', path: '/journal', icon: NotebookPen, group: 'journal', accent: 'customer', enabled: true, exact: true },
  { key: 'journal-week', label: '주간 돌아보기', path: '/journal/week', icon: NotebookPen, group: 'journal', accent: 'customer', enabled: true },
  { key: 'journal-all', label: '전체 기록', path: '/journal/all', icon: NotebookPen, group: 'journal', accent: 'customer', enabled: true },

  { key: 'diagnosis', label: '기업 진단', path: '/diagnosis', icon: ClipboardList, group: 'studio', accent: 'ai', enabled: true, hint: '진단 스튜디오' },
  { key: 'selection', label: '만들 업무', path: '/selection', icon: Filter, group: 'studio', accent: 'ai', enabled: true, hint: '과제 선별' },
  { key: 'mvp-design', label: 'AX 설계', path: '/mvp-design', icon: PencilRuler, group: 'studio', accent: 'ai', enabled: true, hint: 'MVP 설계' },
  { key: 'website-studio', label: '홈페이지 설계', path: '/website-studio', icon: Palette, group: 'studio', accent: 'ai', enabled: true },
  { key: 'validation', label: '검증', path: '/validation', icon: FlaskConical, group: 'studio', accent: 'ai', enabled: true, hint: '현장 검증' },
  { key: 'deliverables', label: '결과자료', path: '/deliverables', icon: FileCheck2, group: 'studio', accent: 'ai', enabled: true },
  { key: 'institutions', label: '기관 전략', path: '/funding/catalog', icon: Landmark, group: 'studio', accent: 'ai', enabled: true, hint: '기관·프로그램 목록' },
  { key: 'cases', label: '사례', path: '/cases', icon: Library, group: 'studio', accent: 'ai', enabled: true },
  { key: 'clients', label: '고객사·프로젝트', path: '/clients', icon: Building2, group: 'studio', accent: 'ai', enabled: true, hint: 'AX 프로젝트 단위 관리' },

  // 이 시스템이 왜 있는지 · 성과를 어떻게 재는지 · 다음에 무엇을 만들지 — 규격이 요구하는 '찾을 수 있는 이야기'
  { key: 'why', label: '기획의도', path: '/why', icon: BookOpenText, group: 'about', accent: 'system', enabled: true, hint: '이 시스템을 왜 만들었는가' },
  { key: 'kpi', label: '성과 지표', path: '/kpi', icon: Gauge, group: 'about', accent: 'system', enabled: true, hint: '돈·시간·규모·사용 지표' },
  { key: 'roadmap', label: '향후 확장', path: '/roadmap', icon: Compass, group: 'about', accent: 'system', enabled: true, status: 'next', hint: '아직 없는 기능과 계획' },

  { key: 'tools', label: '전체 기능', path: '/tools', icon: LayoutGrid, group: 'tools', accent: 'system', enabled: true },
  { key: 'settings', label: '설정', path: '/settings', icon: Settings, group: 'settings', accent: 'system', enabled: true },
]

/** 켜져 있는 모듈만, 그룹 순서대로 묶어 돌려준다 */
export function enabledModulesByGroup(): { group: ModuleGroup; items: ModuleDefinition[] }[] {
  return MODULE_GROUPS.map((group) => ({
    group,
    items: MODULES.filter((m) => m.enabled && m.group === group.key),
  })).filter((g) => g.items.length > 0)
}

/** 경로에 해당하는 모듈 — 가장 긴 접두가 일치하는 것을 고른다 */
export function moduleForPath(pathname: string): ModuleDefinition | null {
  let best: ModuleDefinition | null = null
  for (const m of MODULES) {
    if (!m.enabled) continue
    const hit = m.exact ? pathname === m.path : pathname === m.path || pathname.startsWith(`${m.path}/`)
    if (hit && (best === null || m.path.length > best.path.length)) best = m
  }
  return best
}

/*
 * 아래 두 표는 반드시 클래스 이름을 통째로 적어야 한다.
 *
 * 예전에는 `text-nav-${accent}` 처럼 이어 붙여 만들었는데, Tailwind 는 소스에
 * 적힌 글자만 보고 CSS 를 만들기 때문에 그렇게 만든 이름은 아예 생성되지 않았다.
 * 그래서 메뉴 아이콘 색이 전부 안 나오고 흰색으로만 보였다. 이어 붙이지 말 것.
 */

/** 메뉴 아이콘 색 클래스 (비활성 상태) */
const NAV_TEXT: Record<NavAccent, string> = {
  overview: 'text-nav-overview',
  ops: 'text-nav-ops',
  revenue: 'text-nav-revenue',
  customer: 'text-nav-customer',
  ai: 'text-nav-ai',
  evidence: 'text-nav-evidence',
  alert: 'text-nav-alert',
  system: 'text-nav-system',
}

/** 그룹 색 띠 클래스 */
const NAV_BG: Record<NavAccent, string> = {
  overview: 'bg-nav-overview',
  ops: 'bg-nav-ops',
  revenue: 'bg-nav-revenue',
  customer: 'bg-nav-customer',
  ai: 'bg-nav-ai',
  evidence: 'bg-nav-evidence',
  alert: 'bg-nav-alert',
  system: 'bg-nav-system',
}

export function navAccentClass(accent: NavAccent): string {
  return NAV_TEXT[accent]
}

export function groupAccentClass(accent: NavAccent): string {
  return NAV_BG[accent]
}
