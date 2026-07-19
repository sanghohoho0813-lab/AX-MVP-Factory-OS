// 프로젝트 목록 — 상태·Stage·Level 을 배지로 즉시 구분
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies, listProjects } from '../lib/repo'
import type { Company, Project, ProjectStatus } from '../lib/types'
import { PROJECT_STATUS_LABEL } from '../lib/types'
import { ContractBadge, EmptyState, LevelChip, PageHeader, ProjectStatusBadge, StageChip, inputCls } from '../components/ui'

const FILTERS: Array<{ key: ProjectStatus | 'all'; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'active', label: PROJECT_STATUS_LABEL.active },
  { key: 'waiting_customer', label: PROJECT_STATUS_LABEL.waiting_customer },
  { key: 'hold', label: PROJECT_STATUS_LABEL.hold },
  { key: 'completed', label: PROJECT_STATUS_LABEL.completed },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([listProjects(), listCompanies()])
      .then(([p, c]) => { if (alive) { setProjects(p); setCompanies(c) } })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : '불러오지 못했습니다.'))
    return () => { alive = false }
  }, [])

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? '-'

  const filtered = useMemo(() => {
    if (!projects) return []
    let rows = filter === 'all' ? projects : projects.filter((p) => p.status === filter)
    const s = q.trim().toLowerCase()
    if (s) rows = rows.filter((p) => [p.name, companyName(p.company_id)].some((v) => v.toLowerCase().includes(s)))
    return rows
    // eslint 없음 — companyName 은 companies 에만 의존
  }, [projects, filter, q, companies])

  return (
    <div>
      <PageHeader
        title="프로젝트"
        desc="고객사별 AX 프로젝트의 단계와 상태를 관리합니다."
        action={<Link to="/projects/new" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">+ 프로젝트</Link>}
      />
      {err && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</p>}

      {projects === null ? (
        <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : projects.length === 0 ? (
        <EmptyState
          title="아직 프로젝트가 없습니다"
          desc="고객사를 등록한 뒤 첫 프로젝트를 만들어 보세요."
          action={<Link to="/projects/new" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">프로젝트 만들기</Link>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition-colors ${
                  filter === f.key ? 'bg-navy-800 text-white' : 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="프로젝트·고객사 검색" className={`${inputCls} ml-auto w-full max-w-[220px]`} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="조건에 맞는 프로젝트가 없습니다" />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.95rem] font-bold text-slate-900">{p.name}</span>
                        <ProjectStatusBadge status={p.status} />
                        <ContractBadge status={p.contract_status} />
                      </div>
                      <p className="mt-0.5 truncate text-[0.8rem] text-slate-400">{companyName(p.company_id)}{p.summary ? ` · ${p.summary}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StageChip no={p.current_stage} />
                      <LevelChip current={p.current_level} target={p.target_level} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
