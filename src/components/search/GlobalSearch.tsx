/**
 * 전역 빠른 이동 검색. 상단 검색을 누르거나 Ctrl/Cmd+K, `/` 로 연다.
 * 고객 관리 업체(D-120 — 대표자 · 사업자번호 · 전화 뒷자리로도)·고객사·프로젝트·지금 해야 할 일·도구함·결과 자료를
 * 그룹으로 찾아 실제 화면으로 이동한다.
 * 외부 라이브러리 없이 구현한다.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { organizationRepository, projectRepository } from '../../repositories'
import { normalizeQuery } from '../../lib/format'
import { computeProjectJourney } from '../../services/journeyService'
import { useActiveProject } from '../../context/activeProject'
import { peekProjectCache } from '../../domain/consulting/projectCache'
import { searchTools } from '../../config/toolRegistry'
import { AuthContext } from '../../auth/authContext'
import { listClients } from '../../services/clientOpsService'
import { matchesClientSearch } from '../../services/clientOpsSearch'
import { isProspect } from '../../services/salesPipeline'
import type { ClientOpsRecord } from '../../types/clientOps'

interface Hit {
  group: '고객 관리' | '고객사' | '프로젝트' | '특허+벤처' | '지금 해야 할 일' | '컨설팅 작업실' | '결과·자료'
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

/**
 * compact: 좁은 화면(1360px 아래)용 '찾기' 단추(D-120) — 예전에는 그 폭에서 검색 칸이 사라지고 Ctrl+K 로만 열렸다.
 * 단축키는 넓은 칸 하나만 듣는다(두 곳이 함께 열리지 않게).
 */
export function GlobalSearch({ compact = false }: { compact?: boolean } = {}) {
  const navigate = useNavigate()
  const { setActiveProject } = useActiveProject()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // D-120: 고객 관리 업체 — 열 때마다 새로 읽는다(못 읽으면 이 묶음만 빠진다)
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const [opsClients, setOpsClients] = useState<ClientOpsRecord[]>([])
  useEffect(() => {
    if (!open) return
    let alive = true
    listClients(workspaceId)
      .then((list) => {
        if (alive) setOpsClients(list.filter((r) => r.archivedAt === null))
      })
      .catch(() => {
        /* 검색은 다른 묶음으로 계속 */
      })
    return () => {
      alive = false
    }
  }, [open, workspaceId])

  const close = useCallback(() => { setOpen(false); setQuery(''); setActive(0) }, [])

  // 전역 단축키
  // D-94: 붙잡는 단계(capture)에서 먼저 듣는다 — 검색 창이 열려 있을 때 Esc 는 검색 창만 닫고,
  // 그 아래 모듈 창(영업 고객 등록 등)까지 같이 닫히지 않게 전파를 멈춘다.
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])
  useEffect(() => {
    if (compact) return
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      const slash = e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if (cmdK || slash) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setOpen(true)
      } else if (e.key === 'Escape' && openRef.current) {
        e.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, compact])
  // compact 는 열려 있을 때만 Esc 를 듣는다
  useEffect(() => {
    if (!compact || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [compact, open, close])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    if (!open) return []
    const q = normalizeQuery(query)
    const orgs = organizationRepository.getAll()
    const projects = projectRepository.getAll().filter((p) => p.status !== 'archived')
    const out: Hit[] = []

    // 고객 관리 업체 — 회사명 · 대표자 · 담당자 · 사업자번호 · 전화 뒷자리 · 직접 만든 칸
    if (q) {
      for (const r of opsClients.filter((c) => matchesClientSearch(c, query)).slice(0, 8)) {
        const who = r.representativeName || r.contactName
        out.push({
          group: '고객 관리',
          label: r.companyName,
          sublabel: [isProspect(r) ? '잠재고객' : '계약 고객', who, r.contactPhone || r.businessNumber].filter(Boolean).join(' · '),
          onSelect: () => { navigate(`/ops/clients/${r.id}`); close() },
        })
      }
    }

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
    // 컨설팅 작업실 (특허·벤처·MVP) — 마지막으로 읽은 목록에서 (화면을 한 번 연 뒤부터 잡힌다)
    for (const c of peekProjectCache()) {
      if (c.status === 'archived') continue
      if (!q || `${c.clientName} ${c.title} ${c.currentStage}`.toLowerCase().includes(q)) {
        out.push({ group: '특허+벤처', label: `${c.clientName} · ${c.title}`, sublabel: `현재 ${c.currentStage}`, onSelect: () => { navigate(`/studio/${c.id}`); close() } })
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
    // 도구함 — "부채비율" 처럼 도구 이름이 아닌 말로도 찾게 한다 (D-89)
    for (const t of searchTools(query)) {
      if (!t.path) continue
      const path = t.path
      out.push({ group: '컨설팅 작업실', label: t.label, sublabel: t.navHint ?? t.desc.slice(0, 40), onSelect: () => { navigate(path); close() } })
    }
    for (const s of RESULT_SHORTCUTS) {
      if (!q || s.keywords.includes(q) || s.label.toLowerCase().includes(q)) {
        out.push({ group: '결과·자료', label: s.label, onSelect: () => { navigate(s.path); close() } })
      }
    }
    return out.slice(0, 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, opsClients])

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
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="찾기 — 업체 · 대표 · 전화번호 · 도구"
          data-testid="search-compact"
          className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-600 hover:bg-slate-100 hover:text-slate-800 sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <Search aria-hidden="true" className="size-5" />
          <span className="hidden text-[0.95rem] font-medium sm:inline">찾기</span>
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 text-[0.92rem] text-slate-400 hover:border-slate-300"
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        {/* min-w-0 이 없으면 좁은 화면에서 글자가 칸 밖으로 삐져나와 옆 버튼을 덮는다 */}
        <span className="min-w-0 truncate">업체·대표·전화·도구 찾기</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[0.8125rem] font-medium text-slate-400 2xl:inline">Ctrl K</kbd>
      </button>
      )}

      {/* D-94: body 로 띄운다 — 머리줄 안에 있으면 머리줄 층(z) 에 갇혀 모듈 창(영업 고객 등록 등) 뒤에 깔렸다 */}
      {open && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-navy-950/40 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="빠른 이동 검색">
          <button type="button" aria-label="검색 닫기" className="absolute inset-0 cursor-default" onClick={close} />
          <div className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-overlay)">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <Search aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="업체 이름 · 대표 · 전화번호 뒷자리 · 도구"
                className="h-14 w-full bg-transparent text-[1.05rem] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-[0.95rem] text-slate-400">일치하는 항목이 없습니다.</p>
              ) : (
                grouped.map((g) => (
                  <div key={g.group} className="mb-1">
                    <p className="px-3 py-1.5 text-[0.875rem] font-semibold text-slate-400">{g.group}</p>
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
        </div>,
        document.body,
      )}
    </>
  )
}
