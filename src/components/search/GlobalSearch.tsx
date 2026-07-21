/**
 * 전역 빠른 이동 검색. 상단 검색을 누르거나 Ctrl/Cmd+K, `/` 로 연다.
 * 고객사·프로젝트·지금 해야 할 일·결과 자료를 그룹으로 찾아 실제 화면으로 이동한다.
 * 외부 라이브러리 없이 구현한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { organizationRepository, projectRepository } from '../../repositories'
import { normalizeQuery } from '../../lib/format'
import { computeProjectJourney } from '../../services/journeyService'
import { useActiveProject } from '../../context/activeProject'

interface Hit {
  group: '고객사' | '프로젝트' | '지금 해야 할 일' | '결과·자료'
  label: string
  sublabel?: string
  onSelect: () => void
}

const RESULT_SHORTCUTS: { label: string; keywords: string; path: string }[] = [
  { label: '제출자료·보고서', keywords: '제출자료 보고서 결과 자료', path: '/deliverables/results' },
  { label: '검증 결과', keywords: '검증 결과 테스트', path: '/validation/results' },
  { label: '사례 라이브러리', keywords: '사례 라이브러리 레퍼런스', path: '/cases' },
  { label: '전체 진행 현황', keywords: '전체 진행 현황 리포트 대시보드', path: '/reports' },
]

export function GlobalSearch() {
  const navigate = useNavigate()
  const { setActiveProject } = useActiveProject()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => { setOpen(false); setQuery(''); setActive(0) }, [])

  // 전역 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if (cmdK || slash) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    if (!open) return []
    const q = normalizeQuery(query)
    const orgs = organizationRepository.getAll()
    const projects = projectRepository.getAll().filter((p) => p.status !== 'archived')
    const out: Hit[] = []

    for (const o of orgs) {
      if (!q || `${o.name} ${o.industry} ${o.primaryContact.name}`.toLowerCase().includes(q)) {
        out.push({ group: '고객사', label: o.name, sublabel: o.industry, onSelect: () => { navigate(`/clients/${o.id}`); close() } })
      }
    }
    for (const p of projects) {
      const orgName = orgs.find((o) => o.id === p.organizationId)?.name ?? ''
      if (!q || `${p.name} ${p.projectCode} ${orgName}`.toLowerCase().includes(q)) {
        out.push({ group: '프로젝트', label: p.name, sublabel: `${orgName} · ${p.projectCode}`, onSelect: () => { setActiveProject(p.id); navigate(`/projects/${p.id}`); close() } })
      }
    }
    // 지금 해야 할 일 (행동이 필요한 프로젝트)
    for (const p of projects) {
      const j = computeProjectJourney(p)
      if (!j.needsAction) continue
      if (!q || `${j.actionText} ${j.orgName} ${p.name}`.toLowerCase().includes(q)) {
        out.push({ group: '지금 해야 할 일', label: j.actionText, sublabel: `${j.orgName} · ${p.name}`, onSelect: () => { setActiveProject(p.id); navigate(j.actionPath); close() } })
      }
    }
    for (const s of RESULT_SHORTCUTS) {
      if (!q || s.keywords.includes(q) || s.label.toLowerCase().includes(q)) {
        out.push({ group: '결과·자료', label: s.label, onSelect: () => { navigate(s.path); close() } })
      }
    }
    return out.slice(0, 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query])

  useEffect(() => { setActive(0) }, [query])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); hits[active]?.onSelect() }
  }

  // 그룹핑 (표시 순서 유지)
  const grouped: { group: Hit['group']; items: { hit: Hit; index: number }[] }[] = []
  hits.forEach((hit, index) => {
    let g = grouped.find((x) => x.group === hit.group)
    if (!g) { g = { group: hit.group, items: [] }; grouped.push(g) }
    g.items.push({ hit, index })
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full min-w-0 max-w-xl cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 text-[0.95rem] text-slate-400 hover:border-slate-300"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">고객사, 프로젝트, 할 일 검색</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[0.75rem] font-medium text-slate-400 sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="빠른 이동 검색">
          <button type="button" aria-label="검색 닫기" className="absolute inset-0 cursor-default" onClick={close} />
          <div className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay)">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="고객사·프로젝트·할 일·자료 검색"
                className="h-14 w-full bg-transparent text-[1.05rem] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-[0.95rem] text-slate-400">일치하는 항목이 없습니다.</p>
              ) : (
                grouped.map((g) => (
                  <div key={g.group} className="mb-1">
                    <p className="px-3 py-1.5 text-[0.8rem] font-semibold text-slate-400">{g.group}</p>
                    <ul>
                      {g.items.map(({ hit, index }) => (
                        <li key={index}>
                          <button
                            type="button"
                            onMouseEnter={() => setActive(index)}
                            onClick={hit.onSelect}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left ${active === index ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[1rem] font-medium text-slate-800">{hit.label}</span>
                              {hit.sublabel && <span className="block truncate text-[0.85rem] text-slate-500">{hit.sublabel}</span>}
                            </span>
                            {active === index && <CornerDownLeft aria-hidden="true" className="size-4 shrink-0 text-brand-500" />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
