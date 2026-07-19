// 대시보드 — 실데이터 기반 (가짜 통계 금지, 빈 상태는 전문적으로).
// '고객 응답 대기'는 S1에선 수동 상태값(자료 요청/고객 검토 중, 프로젝트 고객 대기) 기반.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCompanies, listCurrentStages, listProjects } from '../lib/repo'
import type { Company, Project, ProjectStage } from '../lib/types'
import { CUSTOMER_WAIT_STATUSES, fmtDate, isOverdue, STAGE_TITLES } from '../lib/types'
import { EmptyState, LevelChip, PageHeader, ProjectStatusBadge, StageChip } from '../components/ui'

type Loaded = { companies: Company[]; projects: Project[]; currentStages: ProjectStage[] }

export default function DashboardPage() {
  const [data, setData] = useState<Loaded | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [companies, projects] = await Promise.all([listCompanies(), listProjects()])
        const currentStages = await listCurrentStages(projects)
        if (alive) setData({ companies, projects, currentStages })
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : '불러오지 못했습니다.')
      }
    })()
    return () => { alive = false }
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const { companies, projects, currentStages } = data
    const active = projects.filter((p) => !['dropped', 'completed'].includes(p.status))
    const stageOf = (p: Project) => currentStages.find((s) => s.project_id === p.id)
    const waiting = active.filter((p) =>
      p.status === 'waiting_customer' ||
      CUSTOMER_WAIT_STATUSES.includes(stageOf(p)?.status ?? 'not_started'))
    const overdue = active.filter((p) => { const s = stageOf(p); return s ? isOverdue(s) : false })
    const risky = active.filter((p) => {
      const s = stageOf(p)
      return p.status === 'hold' || Boolean(s?.risks?.trim()) || s?.status === 'hold'
    })
    const contractReview = projects.filter((p) => p.contract_status === 'reviewing')
    const byStage = Array.from({ length: 8 }, (_, i) => active.filter((p) => p.current_stage === i).length)
    const nextActions = active
      .map((p) => ({ p, s: stageOf(p) }))
      .filter((x) => Boolean(x.s?.next_action?.trim()))
      .sort((a, b) => (a.s?.target_end_at ?? '9999').localeCompare(b.s?.target_end_at ?? '9999'))
    return { companies, projects, active, waiting, overdue, risky, contractReview, byStage, nextActions }
  }, [data])

  if (err) return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</p>
  if (!stats) return <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>

  const kpis = [
    { label: '전체 고객사', value: stats.companies.length, to: '/companies' },
    { label: '진행 중 프로젝트', value: stats.active.length, to: '/projects' },
    { label: '고객 응답 대기', value: stats.waiting.length, tone: stats.waiting.length > 0 ? 'text-violet-600' : '' },
    { label: '지연', value: stats.overdue.length, tone: stats.overdue.length > 0 ? 'text-rose-600' : '' },
    { label: '위험', value: stats.risky.length, tone: stats.risky.length > 0 ? 'text-orange-600' : '' },
    { label: '계약 전환 검토', value: stats.contractReview.length, tone: stats.contractReview.length > 0 ? 'text-navy-700' : '' },
  ]

  return (
    <div>
      <PageHeader title="대시보드" desc="지금 어디가 막혀 있고, 다음에 무엇을 해야 하는지부터 확인하세요." />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${k.tone || 'text-navy-900'}`}>{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {stats.projects.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="아직 프로젝트가 없습니다"
            desc="고객사를 먼저 등록한 뒤, 첫 AX 프로젝트를 만들어 보세요."
            action={
              <div className="flex justify-center gap-2">
                <Link to="/companies/new" className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">고객사 등록</Link>
                <Link to="/projects/new" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">프로젝트 만들기</Link>
              </div>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* 다음 액션 */}
          <section>
            <h2 className="mb-2.5 text-[0.95rem] font-bold text-navy-900">다음 행동이 필요한 프로젝트</h2>
            {stats.nextActions.length === 0 ? (
              <EmptyState title="기록된 다음 액션이 없습니다" desc="프로젝트 상세의 현재 단계에서 '다음 액션'을 기록하면 여기에 모입니다." />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {stats.nextActions.slice(0, 8).map(({ p, s }) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900">{p.name}</span>
                          <StageChip no={p.current_stage} compact />
                          {s && isOverdue(s) && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-rose-600">지연</span>}
                        </div>
                        <p className="mt-0.5 truncate text-[0.85rem] text-slate-600">{s?.next_action}</p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-xs font-medium text-slate-400">{s?.target_end_at ? fmtDate(s.target_end_at) : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Stage 분포 + 최근 */}
          <section className="space-y-5">
            <div>
              <h2 className="mb-2.5 text-[0.95rem] font-bold text-navy-900">Stage별 프로젝트</h2>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <ul className="space-y-1.5">
                  {stats.byStage.map((count, i) => (
                    <li key={i} className="flex items-center gap-2 text-[0.82rem]">
                      <span className="w-8 shrink-0 font-bold text-navy-700">S{i}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">{STAGE_TITLES[i]}</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${count > 0 ? 'bg-navy-50 text-navy-700' : 'bg-slate-50 text-slate-300'}`}>{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h2 className="mb-2.5 text-[0.95rem] font-bold text-navy-900">최근 프로젝트</h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {stats.projects.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link to={`/projects/${p.id}`} className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-slate-50">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{p.name}</span>
                      <LevelChip current={p.current_level} target={p.target_level} />
                      <ProjectStatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
