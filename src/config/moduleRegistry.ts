import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  Wallet,
  BookOpenText,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Compass,
  Gauge,
  ClipboardList,
  FileCheck2,
  Filter,
  FlaskConical,
  FlaskRound,
  Handshake,
  Inbox,
  KanbanSquare,
  Landmark,
  LayoutGrid,
  Library,
  LifeBuoy,
  ListChecks,
  Palette,
  PencilRuler,
  Settings,
  Sun,
  Workflow,
  CheckCheck,
  Megaphone,
  Rocket,
  CircleDashed,
} from 'lucide-react'
import { SALES_EXTRA_PATHS, SALES_TAB_PATHS } from './salesTabs'
import { REVIEW_HUB_PATH, type ToolDefinition, liveTools, movedTools, reviewTools } from './toolRegistry'
import { FEATURE_CATALOG, visibleModules } from './productCatalog'
import { UPCOMING_PATH, UPCOMING_PRODUCTS } from './upcomingProducts'

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
  | 'sales'
  | 'modules'
  | 'rare'
  | 'about'
  | 'settings'

export interface ModuleGroup {
  key: ModuleGroupKey
  title: string
  accent: NavAccent
  /** 접을 수 있는 그룹(전문 기능 묶음) */
  collapsible?: boolean
  /** D-162: 대표 · 기존 구성원(full)에게만 — Pilot 에게는 묶음째 보이지 않고 주소로도 열리지 않는다 */
  ownerOnly?: boolean
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
  /** 이 메뉴가 함께 맡는 다른 경로 (D-94: ‘도입 검토중’ 한 줄이 그 안의 도구 주소까지 맡는다) */
  alsoPaths?: string[]
  /** 툴팁·도움말용 예전 이름 */
  hint?: string
  /**
   * 기능 상태. 'next' 는 아직 없는 기능이다 — 메뉴에는 NEXT 배지로 보이고,
   * 누르면 404 대신 무엇을 만들 계획인지 설명하는 화면으로 간다. (규격 U-3)
   * 'soon' 은 만들고 있어 곧 들어올 것 — '준비 중' 배지, 누르면 자리 화면(D-103).
   */
  status?: 'live' | 'next' | 'soon'
  /**
   * 'future-items' — 누르면 화면을 옮기지 않고 메뉴 안에서 아직 없는 기능 목록이 펼쳐지고,
   * 하나를 누르면 가운데 안내창이 뜬다 (D-103 · 향후 확장).
   */
  expand?: 'future-items'
  /**
   * 메뉴 옆 숫자 (D-104) — 'clients' 등록 고객사 수(차분한 색) · 'requests' 처리 안 한 상담신청(빨강) ·
   * 'first-meetings' 아직 끝내지 않은 1차 미팅(빨강). 빨강은 0 이면 달지 않는다.
   */
  badge?: 'clients' | 'requests' | 'first-meetings'
  /** 설정 '고급 운영 기능 보기' 를 켰을 때만 목차에 보인다 (D-120) */
  advanced?: boolean
  /**
   * D-127: 전문 모듈 묶음 — 'category' 는 분야 한 줄(눌러서 펼침), parent 는 그 아래 줄이 어느 분야 줄에 드는지.
   * moduleKey 는 제품 카탈로그(productCatalog.ts)의 모듈 key — 잠김 표시를 여기서 읽는다.
   */
  kind?: 'category'
  parent?: string
  moduleKey?: string
  /** D-162: 대표 · 기존 구성원(full)에게만 — Pilot 에게는 메뉴에도 없고 주소로도 열리지 않는다 */
  ownerOnly?: boolean
}

/*
 * 순서는 **얼마나 자주 쓰는가** 로 정한다 (D-86).
 * 매일 여는 것이 위, 가끔 여는 것이 아래, 자리만 잡아 둔 것이 맨 아래.
 * 대표가 "컨설팅 작업실·AX STUDIO·자금·지원·업무 일기는 잘 안 쓴다" 고 해서 한 묶음으로 내렸다.
 */
export const MODULE_GROUPS: ModuleGroup[] = [
  // 하루가 여기서 시작한다 — 오늘 할 일과 일정은 같은 질문("오늘 뭐 하지")이라 한 묶음이다
  { key: 'today', title: '오늘', accent: 'overview' },
  { key: 'clients', title: '고객', accent: 'ops' },
  // D-103: 영업자 일(정산 · 1차 미팅 체크리스트)을 고객 운영과 나눈다
  { key: 'sales', title: '영업', accent: 'revenue' },
  // D-127: 전문 모듈 — 분야 줄(D-163 부터 기업성장 · 절세·재무 둘. 기술사업화 · AX · WEB 은 '잘 안 쓰는 기능').
  // 도구는 분야 줄 아래에 접혀 있다. 도구가 늘어도 이 묶음의 줄 수는 늘지 않는다(예전 컨설팅 작업실 + AX 스튜디오)
  { key: 'modules', title: '전문 모듈', accent: 'system' },
  // D-136: 대표 "특허·벤처 · AX 스튜디오는 거의 안 쓴다" — 지우지 않고 접힌 한 묶음으로(주소 · 데이터 · 기능 그대로)
  { key: 'rare', title: '잘 안 쓰는 기능', accent: 'system', collapsible: true, defaultCollapsed: true, ownerOnly: true },
  { key: 'about', title: '이 시스템', accent: 'system', collapsible: true, defaultCollapsed: true, ownerOnly: true },
  { key: 'settings', title: '설정', accent: 'system' },
]

/**
 * 전문 모듈 줄 (D-127) — 제품 카탈로그의 분야마다 한 줄, 그 아래에 그 분야의 기능.
 *
 * 도구 줄은 **도구 목록에서 만든다**(`toolRegistry.ts`, D-86) — 새 도구는 거기 한 줄 + 카탈로그
 * (`productCatalog.ts` FEATURE_CATALOG)에 어느 모듈인지 한 줄이면 메뉴 · 모듈 살펴보기 · 업체 화면에 같이 붙는다.
 * 아직 없는 것(`planned`)은 메뉴에 걸지 않는다.
 */
function toolModule(t: ToolDefinition & { path: string }, parent: string): ModuleDefinition {
  return {
    key: `tool-${t.key}`,
    label: t.label,
    path: t.path,
    icon: t.icon,
    group: 'modules',
    accent: 'system',
    enabled: true,
    hint: t.navHint,
    parent,
  }
}

/** 메뉴 줄로 쓰는 기능(도구가 아닌 화면) — 분야는 카탈로그가 정한다 */
const FEATURE_NAV: Omit<ModuleDefinition, 'group' | 'parent'>[] = [
  { key: 'diagnosis', label: '기업 진단', path: '/diagnosis', icon: ClipboardList, accent: 'ai', enabled: true, hint: '진단 스튜디오' },
  { key: 'selection', label: '만들 업무', path: '/selection', icon: Filter, accent: 'ai', enabled: true, hint: '과제 선별' },
  { key: 'mvp-design', label: 'AX 설계', path: '/mvp-design', icon: PencilRuler, accent: 'ai', enabled: true, hint: 'MVP 설계' },
  { key: 'validation', label: '검증', path: '/validation', icon: FlaskConical, accent: 'ai', enabled: true, hint: '현장 검증', advanced: true },
  { key: 'deliverables', label: '결과자료', path: '/deliverables', icon: FileCheck2, accent: 'ai', enabled: true },
  { key: 'cases', label: '사례', path: '/cases', icon: Library, accent: 'ai', enabled: true, advanced: true },
  { key: 'clients', label: '고객사·프로젝트', path: '/clients', icon: Building2, accent: 'ai', enabled: true, hint: 'AX 프로젝트 단위 관리' },
  { key: 'website-studio', label: '홈페이지 설계', path: '/website-studio', icon: Palette, accent: 'ai', enabled: true },
  // D-104: 예전 '컨설팅 작업실'(임시 이름 특허+벤처)
  { key: 'consulting-studio', label: '특허+벤처', path: '/studio', icon: Workflow, accent: 'ai', enabled: true, hint: '특허 · 벤처인증 · MVP 단계 관리 (예전 이름: 컨설팅 작업실)' },
  // D-141 지원사업 알림 — D-163 부터 전문 모듈 › 기업성장 안(대표 · Pilot 같은 메뉴)
  { key: 'grants', label: '지원사업 알림', path: '/grants', icon: BellRing, accent: 'revenue', enabled: true, hint: '마감 임박 공고 · 업체 조건에 맞는 곳 · 신청 준비' },
  { key: 'funding', label: '자금·지원사업', path: '/funding', icon: Landmark, accent: 'revenue', enabled: true },
  { key: 'institutions', label: '기관 전략', path: '/funding/catalog', icon: Landmark, accent: 'ai', enabled: true, hint: '기관·프로그램 목록', advanced: true },
]

/** D-167: 메뉴에서 숨긴 기능(자금·지원사업 · 기관 전략)도 주소 → 기능 · 이름은 그대로 찾는다 */
export function navFeatureDef(key: string): Omit<ModuleDefinition, 'group' | 'parent'> | null {
  return FEATURE_NAV.find((x) => x.key === key) ?? null
}

function moduleRows(): ModuleDefinition[] {
  const tools = liveTools().filter((t): t is ToolDefinition & { path: string } => t.path !== null)
  const rows: ModuleDefinition[] = []
  for (const m of visibleModules()) {
    const parent = `cat-${m.key}`
    // D-136: 잘 안 쓰는 모듈(기술사업화 · AX 스튜디오 · 웹 스튜디오)은 접힌 '잘 안 쓰는 기능' 묶음으로
    const group: ModuleGroupKey = m.rarelyUsed ? 'rare' : 'modules'
    const children: ModuleDefinition[] = []
    for (const f of FEATURE_CATALOG.filter((x) => x.module === m.key && !x.hidden)) {
      if (f.source === 'tool') {
        const t = tools.find((x) => x.key === f.key)
        if (t) children.push({ ...toolModule(t, parent), group })
      } else {
        const n = FEATURE_NAV.find((x) => x.key === f.key)
        if (n) children.push({ ...n, group, parent })
      }
    }
    if (children.length === 0) continue
    rows.push({ key: parent, label: m.name, path: m.route, icon: m.icon, group, accent: 'system', enabled: true, kind: 'category', moduleKey: m.key, hint: m.covers.join(' · ') }, ...children)
  }
  return rows
}

/** D-118: 이 메뉴로 옮겨 온 옛 도구 주소 — 그 주소에 있어도 이 메뉴에 불이 켜진다 */
function movedToPaths(target: string): string[] {
  return movedTools().flatMap((t) => (t.path && t.movedTo?.path === target ? [t.path] : []))
}

export const MODULES: ModuleDefinition[] = [
  { key: 'today', label: '오늘', path: '/', icon: Sun, group: 'today', accent: 'overview', enabled: true, exact: true },
  // D-103: 오늘 기록 · 주간 돌아보기 · 전체 기록은 일정 안의 탭이다 — 그 주소에서도 '일정' 에 불이 켜진다
  // D-158: 프로그램이 준비한 것에 맞다 · 아니다만 고르는 곳
  { key: 'decide', label: '확인할 것', path: '/ops/decide', icon: CheckCheck, group: 'today', accent: 'overview', enabled: true, hint: '자료에서 읽은 정보 · 해 볼 만한 일 · 맞는 지원사업 · 서류 기한' },
  { key: 'calendar', label: '일정', path: '/ops/calendar', icon: CalendarDays, group: 'today', accent: 'evidence', enabled: true, alsoPaths: ['/journal'], hint: '달력 · 오늘 기록 · 주간 돌아보기 · 전체 기록' },

  // D-104: '고객 운영' → '고객 관리', '고객 이벤트함' → '잠재고객 상담신청' (주소는 그대로)
  { key: 'client-ops', label: '고객 관리', path: '/ops/clients', icon: ListChecks, group: 'clients', accent: 'ops', enabled: true, badge: 'clients' },
  // D-162: 공개 사이트(고객 플랫폼) 상담신청은 대표 작업공간으로만 들어온다 — Pilot 에게는 없다
  { key: 'inbox', label: '잠재고객 상담신청', path: '/ops/inbox', icon: Inbox, group: 'clients', accent: 'alert', enabled: true, badge: 'requests', hint: '고객 이벤트함', ownerOnly: true },

  // D-114: 기업컨설팅 OS(영업 도구 모음)를 옮긴 곳 — 목차는 이 한 줄, 보드 · 미팅 준비 · 상품·견적 · 전략은 안의 탭
  { key: 'sales', label: '영업 관리', path: '/sales/board', icon: KanbanSquare, group: 'sales', accent: 'revenue', enabled: true, alsoPaths: [...SALES_TAB_PATHS, ...SALES_EXTRA_PATHS, ...movedToPaths('/sales/board')], hint: '영업 보드 · 잠재고객 → 미팅 → 계약' },
  { key: 'agents', label: '영업자 정산', path: '/ops/agents', icon: Handshake, group: 'sales', accent: 'revenue', enabled: true, hint: '누구한테 지금 얼마를 줘야 하는가', ownerOnly: true },
  // D-142: 매출(계약 수금에서 저절로) · 비용(정기 결제 · 쓴 돈 · 영업자 수수료)
  { key: 'money', label: '매출 · 비용', path: '/money', icon: Wallet, group: 'sales', accent: 'revenue', enabled: true, hint: '들어온 돈 · 들어올 예정 · 정기 결제일 · 쓴 돈' },
  // D-169: 마케팅 · 브랜딩(블로그 · 유튜브 · SNS) — 도입 예정. 지금은 안내 화면만
  { key: 'marketing', label: '마케팅 · 브랜딩', path: '/marketing', icon: Megaphone, group: 'sales', accent: 'revenue', enabled: true, status: 'soon', hint: '블로그 · 유튜브 · 릴스 · SNS — 도입 예정' },
  // 만들고 있는 프로그램이 들어올 자리 — 들어오면 status 를 지우고 화면만 바꾼다 (docs/DECISIONS D-103)
  { key: 'first-meeting', label: '1차 미팅 체크리스트', path: '/sales/first-meeting', icon: ClipboardCheck, group: 'sales', accent: 'revenue', enabled: true, status: 'soon', badge: 'first-meetings', hint: '영업자용 AX 1차 미팅 체크리스트 — 만드는 중', ownerOnly: true },


  // 이 시스템이 왜 있는지 · 성과를 어떻게 재는지 · 다음에 무엇을 만들지 — 규격이 요구하는 '찾을 수 있는 이야기'
  { key: 'guide', label: '처음 사용 가이드', path: '/getting-started', icon: LifeBuoy, group: 'about', accent: 'system', enabled: true, hint: '처음 쓰는 순서 · 화면별 안내' },
  { key: 'why', label: '기획의도', path: '/why', icon: BookOpenText, group: 'about', accent: 'system', enabled: true, hint: '이 시스템을 왜 만들었는가' },
  { key: 'kpi', label: '성과 지표', path: '/kpi', icon: Gauge, group: 'about', accent: 'system', enabled: true, hint: '돈·시간·규모·사용 지표' },
  { key: 'roadmap', label: '향후 확장', path: '/roadmap', icon: Compass, group: 'about', accent: 'system', enabled: true, status: 'next', expand: 'future-items', hint: '아직 없는 기능과 계획 — 눌러서 펼치기' },

  ...moduleRows(),
  // D-169: 출시 예정 — 결과물이 나오는 컨설팅 상품(상품표)을 가나다 순으로. 하나씩 모듈이 되면 여기서 빠진다
  { key: 'cat-upcoming', label: '출시 예정', path: UPCOMING_PATH, icon: Rocket, group: 'modules', accent: 'system', enabled: true, kind: 'category', hint: '결과물이 나오는 컨설팅 — 하나씩 모듈로 들어옵니다' },
  ...UPCOMING_PRODUCTS.map((p): ModuleDefinition => ({ key: `up-${p.key}`, label: p.title, path: `${UPCOMING_PATH}/${p.key}`, icon: CircleDashed, group: 'modules', accent: 'system', enabled: true, parent: 'cat-upcoming' })),
  // 도입 검토중 — 검토중인 도구가 하나라도 있을 때만 한 줄 (D-88)
  ...(reviewTools().length > 0
    ? [{ key: 'tools-review', label: '도입 검토중', path: REVIEW_HUB_PATH, icon: FlaskRound, group: 'modules' as const, accent: 'system' as const, enabled: true, hint: '쓸 수는 있지만 아직 정식으로 들이지 않은 것', alsoPaths: reviewTools().flatMap((t) => (t.path ? [t.path] : [])) }]
    : []),
  { key: 'tools', label: '모듈 전체', path: '/tools', icon: LayoutGrid, group: 'modules', accent: 'system', enabled: true, hint: '전문 모듈 여섯과 그 안의 기능 · 요금제', alsoPaths: ['/modules'], exact: true },
  { key: 'settings', label: '설정', path: '/settings', icon: Settings, group: 'settings', accent: 'system', enabled: true },
]

/** 켜져 있는 모듈만, 그룹 순서대로 묶어 돌려준다 */
/**
 * 목차 묶음. opts.advanced 가 false 면 '고급 운영 기능' 메뉴(검증 · 기관 전략 · 사례)를 뺀다(D-120) —
 * 설정의 '고급 운영 기능 보기' 가 말한 대로. 주소로는 계속 열린다. opts 를 안 주면 전부(시험 · 옛 호출).
 */
export function enabledModulesByGroup(opts: { advanced?: boolean; pilot?: boolean } = {}): { group: ModuleGroup; items: ModuleDefinition[] }[] {
  const showAdvanced = opts.advanced ?? true
  const pilot = opts.pilot ?? false
  return MODULE_GROUPS.filter((group) => !(pilot && group.ownerOnly)).map((group) => ({
    group,
    // D-162: Pilot 에게는 대표 전용 줄 · 고급 운영 기능(검증 · 기관 전략 · 사례)을 빼고 보인다
    items: MODULES.filter((m) => m.enabled && m.group === group.key && (showAdvanced || !m.advanced) && !(pilot && (m.ownerOnly || m.advanced || isPilotHiddenPath(m.path)))),
  })).filter((g) => g.items.length > 0)
}

/**
 * D-162: Pilot 에게 열지 않는 주소 — 메뉴의 대표 전용 줄(묶음째 · 그 안의 도구 · 함께 맡는 주소) + 메뉴에 없는 내부 · 관리 화면.
 * 메뉴와 같은 표에서 계산한다(메뉴를 두 벌 만들지 않는다). 데이터는 이미 서버(RLS)에서 나뉘어 있고, 이건 화면 정리다.
 */
const PILOT_HIDDEN_EXTRA = [
  '/getting-started', '/why', '/kpi', '/roadmap', // 이 시스템
  '/today/legacy', // 옛 오늘 화면
  '/studio', '/ax', '/clients', '/projects', '/diagnosis', '/selection', '/mvp-design', '/validation', '/deliverables', '/website-studio', '/cases', // AX · 웹 스튜디오 · 특허+벤처
  '/funding', '/reports', // AX 프로젝트에 붙는 자금 연계(프로젝트 없이는 빈 화면) · 옛 리포트 — 기관 전략(고급) 포함
  '/tools/review', // 도입 검토중(대표가 고르는 곳)
  '/modules/tech-biz', '/modules/ax-studio', '/modules/web-studio',
]
const underBase = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

export function isPilotHiddenPath(pathname: string): boolean {
  if (PILOT_HIDDEN_EXTRA.some((b) => underBase(pathname, b))) return true
  const ownerGroups = new Set(MODULE_GROUPS.filter((g) => g.ownerOnly).map((g) => g.key))
  return MODULES.some((m) => m.enabled && (m.ownerOnly || m.advanced || ownerGroups.has(m.group)) && moduleMatchLength(m, pathname) > 0)
}

const underPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** 이 메뉴가 지금 주소를 맡는가 — 맡으면 맞은 경로의 길이(가장 긴 것이 이긴다), 아니면 0 */
export function moduleMatchLength(m: Pick<ModuleDefinition, 'path' | 'exact' | 'alsoPaths'>, pathname: string): number {
  if (m.exact ? pathname === m.path : underPath(pathname, m.path)) return m.path.length
  const also = (m.alsoPaths ?? []).filter((p) => underPath(pathname, p))
  return also.length > 0 ? Math.max(...also.map((p) => p.length)) : 0
}

/** 경로에 해당하는 모듈 — 가장 긴 접두가 일치하는 것을 고른다 */
export function moduleForPath(pathname: string): ModuleDefinition | null {
  let best: ModuleDefinition | null = null
  let bestLen = 0
  for (const m of MODULES) {
    if (!m.enabled) continue
    const len = moduleMatchLength(m, pathname)
    if (len > bestLen) {
      best = m
      bestLen = len
    }
  }
  return best
}

/**
 * 머리줄에 쓸 화면 이름 (D-94) — 검토중 도구(영업 도구 모음 등)는 메뉴 줄 이름(‘도입 검토중’)이 아니라 도구 이름을 쓴다.
 * 예전에는 이 주소를 맡는 메뉴가 없어 휴대폰 머리줄에 회사 이름만 떴다.
 */
export function screenTitleForPath(pathname: string): string | null {
  const review = [...reviewTools(), ...movedTools()].find((t) => t.path && underPath(pathname, t.path))
  if (review) return review.label
  return moduleForPath(pathname)?.label ?? null
}

/**
 * 머리줄 위 작은 글씨 — 이 화면이 서랍 메뉴의 어느 묶음에 있는지 (D-110, 예: 영업 › 영업자 정산).
 * 묶음 이름이 화면 이름과 같으면(오늘 › 오늘) 띄우지 않는다.
 */
export function screenGroupForPath(pathname: string): ModuleGroup | null {
  const review = reviewTools().find((t) => t.path && underPath(pathname, t.path))
  const m = review ? null : moduleForPath(pathname)
  // D-127: 전문 모듈 안의 화면은 분야 이름으로(절세·재무 › 세금 계산기) — '전문 모듈' 보다 어디인지 잘 보인다
  const parent = m?.parent ? MODULES.find((x) => x.key === m.parent) : undefined
  if (parent) return { key: 'modules', title: parent.label, accent: parent.accent }
  const groupKey = review ? 'modules' : m?.group
  const group = MODULE_GROUPS.find((g) => g.key === groupKey) ?? null
  if (!group) return null
  if (group.title === screenTitleForPath(pathname)) return null
  return group
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
