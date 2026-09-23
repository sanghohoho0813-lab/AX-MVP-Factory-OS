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

import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronLeft, Menu, X } from 'lucide-react'
import type { ToolDefinition } from '../../config/toolRegistry'

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
      <div className="flex items-center gap-2 xl:hidden">
        <button
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
        className="hidden w-56 shrink-0 flex-col gap-3 xl:flex"
      >
        <div className="flex items-center gap-2 px-1">
          <ModuleIcon aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
          <span className="t-card min-w-0 truncate font-bold text-slate-900">{tool.label}</span>
        </div>
        <ModuleNavList tool={tool} groups={groups} section={current.key} />
        <Link to="/tools" className="t-meta inline-flex items-center gap-1 px-1 text-slate-400 hover:text-slate-600">
          <ChevronLeft aria-hidden="true" className="size-3.5" /> 도구함 전체
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
              <button type="button" aria-label="목차 닫기" onClick={() => setDrawer(false)} className="tap rounded-(--radius-control) p-1 text-slate-400 hover:bg-slate-100">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <ModuleNavList tool={tool} groups={groups} section={current.key} />
            <Link to="/tools" className="t-meta inline-flex items-center gap-1 text-slate-400">
              <ChevronLeft aria-hidden="true" className="size-3.5" /> 도구함 전체
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
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div key={g.name || `g${gi}`} className="flex flex-col gap-0.5">
          {g.name && <span className="t-meta px-2 pt-1 font-bold tracking-wide text-slate-400">{g.name}</span>}
          {g.items.map((item) => {
            const Icon = item.icon
            const on = item.key === section
            return (
              <Link
                key={item.key}
                to={`${tool.path}/${item.key}`}
                data-section={item.key}
                aria-current={on ? 'page' : undefined}
                title={item.hint}
                className={`tap flex items-center gap-2 rounded-(--radius-control) px-2.5 py-2 text-[0.94rem] ${
                  on ? 'bg-brand-600 font-bold text-white' : 'font-medium text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${on ? 'text-white' : 'text-slate-400'}`} />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}
