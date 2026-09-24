/**
 * 모듈 2단 목차 (D-91).
 *
 * 원본 OS 들은 저마다 왼쪽 목차를 갖고 있었다(고용지원금 8개, 연구소 16개, 세일즈 14개).
 * 그 목차를 이 OS 안에서 그대로 살린다 — 단, OS 목차를 갈아끼우지 않는다.
 *
 *  - 넓은 화면(1280 이상): OS 사이드바 오른쪽에 **모듈 목차 한 칸**이 더 선다.
 *  - 좁은 화면: 화면 맨 위에 **모듈 햄버거** 하나. 누르면 그 모듈의 목차가 서랍으로 열린다.
 *    OS 햄버거(머리띠 왼쪽)는 그대로 있다 — 모듈 안에서도 '오늘·고객 운영' 으로 한 번에 나간다.
 *
 * 주소는 `/tools/<key>/<section>`. 화면을 더하려면 `toolRegistry` 의 `sections` 에 한 줄 적는다.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Menu, X } from 'lucide-react'
import { sectionAccent, type ToolDefinition } from '../../config/toolRegistry'
import type { NavAccent } from '../../config/moduleRegistry'

/**
 * 목차 아이콘 색 (D-92) — OS 왼쪽 메뉴와 같은 8색.
 * 같은 묶음은 같은 색이다. 아이콘은 옅은 색 칸 안에 앉아 한눈에 묶음이 갈린다.
 * (Tailwind 가 찾을 수 있게 클래스 이름을 통째로 적는다)
 */
const ICON_CHIP: Record<NavAccent, string> = {
  overview: 'bg-nav-overview/20 text-nav-overview',
  ops: 'bg-nav-ops/20 text-nav-ops',
  revenue: 'bg-nav-revenue/20 text-nav-revenue',
  customer: 'bg-nav-customer/20 text-nav-customer',
  ai: 'bg-nav-ai/20 text-nav-ai',
  evidence: 'bg-nav-evidence/20 text-nav-evidence',
  alert: 'bg-nav-alert/20 text-nav-alert',
  system: 'bg-slate-200/70 text-slate-500',
}

/** 고른 줄은 파란 바탕이라, 아이콘 칸은 흰 바탕에 같은 색 그대로 */
const ICON_CHIP_ON: Record<NavAccent, string> = {
  overview: 'bg-white text-nav-overview',
  ops: 'bg-white text-nav-ops',
  revenue: 'bg-white text-nav-revenue',
  customer: 'bg-white text-nav-customer',
  ai: 'bg-white text-nav-ai',
  evidence: 'bg-white text-nav-evidence',
  alert: 'bg-white text-nav-alert',
  system: 'bg-white text-slate-500',
}

const GROUP_BAR: Record<NavAccent, string> = {
  overview: 'bg-nav-overview',
  ops: 'bg-nav-ops',
  revenue: 'bg-nav-revenue',
  customer: 'bg-nav-customer',
  ai: 'bg-nav-ai',
  evidence: 'bg-nav-evidence',
  alert: 'bg-nav-alert',
  system: 'bg-nav-system',
}

export interface ModuleShellProps {
  tool: ToolDefinition
  /** 지금 보고 있는 화면 키 */
  section: string
  children: ReactNode
}

export function ModuleShell({ tool, section, children }: ModuleShellProps) {
  const sections = tool.sections ?? []
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()

  // 화면을 옮기면 서랍은 닫는다
  useEffect(() => {
    setDrawer(false)
  }, [location.pathname])

  // D-99: 서랍은 Esc 로 닫히고, 열면 닫기 단추에 · 닫으면 목차 단추로 초점이 돌아간다 (전에는 Esc 가 먹지 않았다)
  const openerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!drawer) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    const opener = openerRef.current
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [drawer])

  if (sections.length <= 1) return <>{children}</>

  const current = sections.find((s) => s.key === section) ?? sections[0]
  const groups: { name: string; items: typeof sections }[] = []
  for (const item of sections) {
    const name = item.group ?? ''
    const last = groups.at(-1)
    if (last && last.name === name) last.items.push(item)
    else groups.push({ name, items: [item] })
  }

  const ModuleIcon = tool.icon

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-5">
      {/* 좁은 화면 — 모듈 햄버거 한 줄 */}
      <div className="no-print flex items-center gap-2 xl:hidden">
        <button
          ref={openerRef}
          type="button"
          onClick={() => setDrawer(true)}
          data-testid="module-menu-open"
          aria-label={`${tool.label} 목차 열기`}
          className="tap inline-flex items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] font-bold text-slate-800"
        >
          <Menu aria-hidden="true" className="size-4" />
          {tool.label}
        </button>
        <span className="t-sub min-w-0 truncate text-slate-500">{current.label}</span>
      </div>

      {/* 넓은 화면 — 모듈 목차 한 칸 */}
      <nav
        aria-label={`${tool.label} 목차`}
        data-testid="module-nav"
        className="no-print hidden w-56 shrink-0 flex-col gap-3 xl:sticky xl:top-20 xl:flex xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto" /* D-94: 긴 화면을 내려도 목차가 따라온다 */
      >
        <div className="flex items-center gap-2 px-1">
          <ModuleIcon aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
          <span className="t-card min-w-0 truncate font-bold text-slate-900">{tool.label}</span>
        </div>
        <ModuleNavList tool={tool} groups={groups} section={current.key} />
        <Link to="/tools" className="t-meta inline-flex items-center gap-1 px-1 text-slate-400 hover:text-slate-600">
          <ChevronLeft aria-hidden="true" className="size-3.5" /> 작업실 전체
        </Link>
      </nav>

      {/* 서랍 */}
      {drawer && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={`${tool.label} 목차`}>
          <button type="button" aria-label="닫기" onClick={() => setDrawer(false)} className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col gap-3 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <ModuleIcon aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
              <span className="t-card min-w-0 flex-1 truncate font-bold text-slate-900">{tool.label}</span>
              <button ref={closeRef} type="button" aria-label="목차 닫기" onClick={() => setDrawer(false)} className="tap rounded-(--radius-control) p-1 text-slate-400 hover:bg-slate-100">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <ModuleNavList tool={tool} groups={groups} section={current.key} />
            <Link to="/tools" className="t-meta inline-flex items-center gap-1 text-slate-400">
              <ChevronLeft aria-hidden="true" className="size-3.5" /> 작업실 전체
            </Link>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ModuleNavList({
  tool,
  groups,
  section,
}: {
  tool: ToolDefinition
  groups: { name: string; items: NonNullable<ToolDefinition['sections']> }[]
  section: string
}) {
  // D-94: 업체에서 연 도구면(?client=) 화면을 옮겨도 그 업체를 놓지 않는다
  const [params] = useSearchParams()
  const client = params.get('client')
  const withClient = (path: string) => (client ? `${path}?client=${encodeURIComponent(client)}` : path)
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div key={g.name || `g${gi}`} className="flex flex-col gap-0.5">
          {g.name && (
            <span className="t-meta flex items-center gap-1.5 px-2 pt-1 font-bold tracking-wide text-slate-500" data-group-accent={sectionAccent(g.items[0])}>
              <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${GROUP_BAR[sectionAccent(g.items[0])]}`} />
              {g.name}
            </span>
          )}
          {g.items.map((item) => {
            const Icon = item.icon
            const on = item.key === section
            const accent = sectionAccent(item)
            return (
              <Link
                key={item.key}
                to={withClient(`${tool.path}/${item.key}`)}
                data-section={item.key}
                data-accent={accent}
                aria-current={on ? 'page' : undefined}
                title={item.hint}
                className={`tap flex items-center gap-2.5 rounded-(--radius-control) px-2 py-1.5 text-[0.94rem] ${
                  on ? 'bg-brand-600 font-bold text-white' : 'font-medium text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-md ${on ? ICON_CHIP_ON[accent] : ICON_CHIP[accent]}`}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
