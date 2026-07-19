// 고객사 목록
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies, listIndustries, listProjects } from '../lib/repo'
import type { Company, Industry, Project } from '../lib/types'
import { fmtDate } from '../lib/types'
import { EmptyState, PageHeader, inputCls } from '../components/ui'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [industries, setIndustries] = useState<Industry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([listCompanies(), listIndustries(), listProjects()])
      .then(([c, i, p]) => { if (alive) { setCompanies(c); setIndustries(i); setProjects(p) } })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : '불러오지 못했습니다.'))
    return () => { alive = false }
  }, [])

  const industryName = (code: string | null) => industries.find((i) => i.code === code)?.name ?? '-'
  const projectCount = (companyId: string) => projects.filter((p) => p.company_id === companyId).length

  const filtered = useMemo(() => {
    if (!companies) return []
    const s = q.trim().toLowerCase()
    if (!s) return companies
    return companies.filter((c) => [c.name, c.contact_name, c.region].some((v) => (v ?? '').toLowerCase().includes(s)))
  }, [companies, q])

  return (
    <div>
      <PageHeader
        title="고객사"
        desc="AX 프로젝트를 진행하는 고객 기업 목록입니다."
        action={<Link to="/companies/new" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">+ 고객사 등록</Link>}
      />
      {err && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</p>}

      {companies === null ? (
        <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : companies.length === 0 ? (
        <EmptyState
          title="등록된 고객사가 없습니다"
          desc="첫 고객사를 등록하면 프로젝트를 만들 수 있습니다."
          action={<Link to="/companies/new" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">고객사 등록</Link>}
        />
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회사명·담당자·지역 검색" className={`${inputCls} mb-4 max-w-xs`} />
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link to={`/companies/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.95rem] font-bold text-slate-900">{c.name}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.68rem] font-semibold text-slate-500">{industryName(c.industry_code)}</span>
                      {c.status === 'archived' && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[0.68rem] font-semibold text-slate-500">보관</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[0.8rem] text-slate-400">
                      {[c.region, c.contact_name, c.employee_band].filter(Boolean).join(' · ') || '추가 정보 없음'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-navy-700">{projectCount(c.id)}<span className="ml-0.5 text-xs font-medium text-slate-400">개 프로젝트</span></p>
                    <p className="text-[0.7rem] text-slate-400">{fmtDate(c.created_at)} 등록</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
