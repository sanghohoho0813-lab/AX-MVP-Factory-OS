/**
 * 경로 줄 (D-235) — 대표 "어딜 클릭해서 들어가더라도 현재 어디 안에 있는 건지 길을 잃지 않도록".
 *
 *   고객 관리 › (주)샤인디자인 › 맞춤 추천 › 고용지원금 관리 › 채용 진단
 *   영업 › 마케팅 · 브랜딩 › 홍보 글 만들기 › 한솔정밀(주) › 릴스 · 쇼츠 대본
 *
 * 주소(경로 · ?client= · ?tab=)와 메뉴 표(moduleRegistry · toolRegistry)로 계산한다 — 화면마다 따로 적지 않는다.
 * 업체 이름은 업체 기록에서, '어느 탭에서 왔는지'(맞춤 추천 등)는 업체 화면이 마지막으로 연 탭 기억으로 잇는다.
 * 화면 안 단계(고른 글 종류 · 레이더 탭)는 화면이 꼬리(extras)로 붙인다. 순수 함수 — 시험은 wayfinding 단위 시험.
 */
import { MODULES, MODULE_GROUPS, moduleForPath, navParentForPath, screenGroupForPath, screenTitleForPath } from '../config/moduleRegistry'
import { TOOLS } from '../config/toolRegistry'
import { SALES_TABS } from '../config/salesTabs'
import { clientTabLabel } from '../config/clientDetailTabs'

export interface Crumb {
  /** 화면에 보이는 이름 */
  label: string
  /** 누르면 갈 곳 — 없으면 지금 자리(마지막 칸) */
  to?: string
}

export interface CrumbInput {
  pathname: string
  /** location.search ('?client=…&tab=…') */
  search: string
  /** 업체 번호 → 이름(모르면 null) */
  clientName?: (id: string) => string | null
  /** 업체 화면이 마지막으로 연 탭 — 그 업체의 모듈에 들어왔을 때 '맞춤 추천' 같은 가운데 칸을 잇는다 */
  lastClientTab?: { clientId: string; tab: string } | null
  /** 영업에서 업체로 들어왔으면(D-124) 맨 앞을 영업 관리로 */
  fromSales?: boolean
  /** 화면이 붙이는 꼬리(고른 단계 · 글 종류) */
  extras?: Crumb[]
}

/** 모듈 입구가 있는 업체 탭 — 여기서 연 모듈이면 경로 줄 가운데에 이 탭을 잇는다 */
const MODULE_DOOR_TABS = new Set(['smart', 'work', 'overview'])

const under = (p: string, base: string) => p === base || p.startsWith(`${base}/`)

/** 묶음 이름 칸이 갈 곳 — 그 묶음의 첫 메뉴 */
function groupHome(groupKey: string): string | undefined {
  if (groupKey === 'today') return '/'
  if (groupKey === 'clients') return '/ops/clients'
  if (groupKey === 'sales') return '/sales/board'
  if (groupKey === 'modules') return '/tools'
  return MODULES.find((m) => m.enabled && m.group === groupKey && !m.parent)?.path
}

/** 도구 안의 화면(/tools/<도구>/<화면>) — 화면 이름 */
function toolSection(pathname: string): { tool: (typeof TOOLS)[number]; section: { key: string; label: string } | null } | null {
  const tool = TOOLS.find((t) => t.path && under(pathname, t.path))
  if (!tool || !tool.path) return null
  const rest = pathname.slice(tool.path.length).replace(/^\//, '').split('/')[0]
  const section = rest ? (tool.sections ?? []).find((s) => s.key === rest) ?? null : null
  return { tool, section }
}

/** 마케팅 · 브랜딩이 함께 맡는 화면 이름(D-233 — 화면 제목은 '마케팅 · 브랜딩' 하나라 경로 줄에서 갈라 준다) */
function marketingTool(pathname: string): Crumb | null {
  if (under(pathname, '/marketing/youtube') || pathname === '/marketing') return { label: '콘텐츠 레이더', to: '/marketing/youtube' }
  if (under(pathname, '/marketing/threads')) return { label: '스레드', to: '/marketing/threads' }
  if (under(pathname, '/marketing/shorts')) return { label: '릴스 · 틱톡', to: '/marketing/shorts' }
  if (under(pathname, '/tools/content')) return { label: '블로그 · 플레이스 홍보 글 만들기', to: '/tools/content' }
  if (under(pathname, '/tools/homepage')) return { label: '홈페이지 만들기', to: '/tools/homepage' }
  if (under(pathname, '/marketing/more')) return { label: '마케팅 안내' }
  return null
}

function clientIdOf(pathname: string, params: URLSearchParams): string | null {
  const m = /^\/ops\/clients\/([^/]+)$/.exec(pathname)
  if (m && m[1] !== 'new') return decodeURIComponent(m[1])
  return params.get('client') || params.get('clientId') || null
}

/** 마지막 칸은 지금 자리 — 누를 곳이 아니다. 두 칸이 안 되면 경로 줄을 그리지 않는다 */
function finish(list: Crumb[]): Crumb[] {
  const out = dedupe(list)
  if (out.length) out[out.length - 1] = { label: out[out.length - 1].label }
  return out.length >= 2 ? out : []
}

/** 같은 이름이 잇달아 나오면 하나만(오늘 › 오늘 같은 것) */
function dedupe(list: Crumb[]): Crumb[] {
  const out: Crumb[] = []
  for (const c of list) {
    const label = c.label.trim()
    if (!label) continue
    if (out.length && out[out.length - 1].label === label) {
      // 뒤 칸이 더 구체적인 갈 곳을 가지면 그것으로
      if (c.to) out[out.length - 1] = { ...out[out.length - 1], to: c.to }
      continue
    }
    out.push({ ...c, label })
  }
  return out
}

export function routeCrumbs(input: CrumbInput): Crumb[] {
  const { pathname } = input
  const params = new URLSearchParams(input.search)
  const extras = input.extras ?? []
  const clientId = clientIdOf(pathname, params)
  const name = clientId ? input.clientName?.(clientId) ?? null : null

  // 오늘(첫 화면)은 경로 줄이 없다 — 꼬리가 있을 때만
  if (pathname === '/' || pathname === '/today') return extras.length ? finish([{ label: '오늘', to: '/' }, ...extras]) : []

  const out: Crumb[] = []

  // 업체 화면 — 고객 관리(또는 영업 관리) › 업체 › 탭
  if (/^\/ops\/clients\/[^/]+$/.test(pathname) && clientId) {
    out.push(input.fromSales ? { label: '영업 관리', to: '/sales/board' } : { label: '고객 관리', to: '/ops/clients' })
    out.push({ label: name ?? '업체', to: `/ops/clients/${encodeURIComponent(clientId)}` })
    out.push({ label: clientTabLabel(params.get('tab')) })
    return finish([...out, ...extras])
  }

  // 마케팅 · 브랜딩 — 영업 › 마케팅 · 브랜딩 › 도구 › 업체 › (화면 안 단계)
  const mk = marketingTool(pathname)
  if (mk) {
    out.push({ label: '영업', to: '/sales/board' }, { label: '마케팅 · 브랜딩', to: '/marketing' }, mk)
    if (clientId) out.push({ label: name ?? '업체', to: `${mk.to ?? pathname}/build?client=${encodeURIComponent(clientId)}` })
    return finish([...out, ...extras])
  }

  // 업체를 골라 연 모듈 — 고객 관리 › 업체 › (마지막 탭) › 모듈 › 모듈 안 화면
  const ts = toolSection(pathname)
  const title = screenTitleForPath(pathname)
  if (clientId && (ts || under(pathname, '/grants') || under(pathname, '/ai'))) {
    out.push({ label: '고객 관리', to: '/ops/clients' })
    out.push({ label: name ?? '업체', to: `/ops/clients/${encodeURIComponent(clientId)}` })
    const last = input.lastClientTab
    // 모듈을 여는 탭(맞춤 추천 · 업무 · 개요)에서 왔을 때만 가운데 칸을 잇는다 — '업무 일기 › 고용지원금' 같은 엉뚱한 길을 만들지 않게
    if (last && last.clientId === clientId && MODULE_DOOR_TABS.has(last.tab)) out.push({ label: clientTabLabel(last.tab), to: `/ops/clients/${encodeURIComponent(clientId)}?tab=${encodeURIComponent(last.tab)}` })
    if (ts) {
      out.push({ label: ts.tool.label, to: `${ts.tool.path}?client=${encodeURIComponent(clientId)}` })
      if (ts.section) out.push({ label: ts.section.label })
    } else if (title) out.push({ label: title })
    return finish([...out, ...extras])
  }

  // 그 밖 — 묶음 › 화면 › (영업 탭 · 모듈 안 화면)
  const group = screenGroupForPath(pathname)
  if (group) {
    const home = group.key === 'modules' ? MODULES.find((m) => m.label === group.title)?.path ?? groupHome('modules') : groupHome(group.key)
    // '고객 › 고객 관리' 는 같은 말이라 묶음 칸을 뺀다(영업 › 영업 관리는 둔다 — 마케팅 · 정산도 영업 묶음이다)
    if (!(group.key === 'clients' && title?.startsWith(group.title))) out.push({ label: group.title, to: home })
  } else {
    const m = moduleForPath(pathname)
    const g = m ? MODULE_GROUPS.find((x) => x.key === m.group) : undefined
    if (g && title && !(g.key === 'clients' && title.startsWith(g.title))) out.push({ label: g.title, to: groupHome(g.key) })
  }
  const parentNav = navParentForPath(pathname)
  const screenPath = ts?.tool.path ?? parentNav?.path ?? moduleForPath(pathname)?.path
  if (title) out.push({ label: title, to: screenPath })
  if (ts?.section) out.push({ label: ts.section.label })
  const salesTab = SALES_TABS.find((t) => under(pathname, t.to))
  if (salesTab && salesTab.label !== title) out.push({ label: salesTab.label, to: salesTab.to })
  if (pathname === '/sales/new') out.push({ label: '새 잠재고객' })
  if (pathname === '/ops/clients/new') out.push({ label: '새 업체 등록' })
  if (clientId && name && !ts) out.push({ label: name })

  return finish([...out, ...extras])
}
