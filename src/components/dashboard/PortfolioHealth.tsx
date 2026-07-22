import { Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HealthStatus, PortfolioProject } from '../../types'
import { HEALTH_META, PROJECT_STAGE_META, TONE_DOT_CLASS } from '../../lib/statusMeta'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusBadge } from '../ui/StatusBadge'

/** 실제 진행상태 파생 필드 — dashboardService.buildPortfolioItems가 채워 준다 */
interface DerivedProgressFields {
  /** "n / N단계" */
  stepText?: string
  /** 현재 단계 라벨 (있으면 stage 메타 라벨 대신 표시) */
  currentStepLabel?: string
  isSample?: boolean
}

interface PortfolioHealthProps {
  projects: (PortfolioProject & DerivedProgressFields)[]
}

const HEALTH_ORDER: HealthStatus[] = ['healthy', 'attention', 'risk']

export function PortfolioHealth({ projects }: PortfolioHealthProps) {
  const counts = HEALTH_ORDER.map((health) => ({
    health,
    count: projects.filter((p) => p.health === health).length,
  }))

  return (
    <section
      aria-label="고객사 포트폴리오 건강도"
      className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">
          고객사 포트폴리오 건강도
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {counts.map(({ health, count }) => (
            <li
              key={health}
              className="flex items-center gap-1.5 text-[13px] text-slate-500"
            >
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${TONE_DOT_CLASS[HEALTH_META[health].tone]}`}
              />
              {HEALTH_META[health].label}
              <span className="font-semibold text-slate-700">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {projects.map((project) => {
          const stage = PROJECT_STAGE_META[project.stage]
          const health = HEALTH_META[project.health]
          return (
            <li key={project.id}>
              <Link
                to={`/clients/${project.id}`}
                aria-label={`${project.client} 고객사 상세 보기`}
                className="block rounded-(--radius-card) border border-slate-200 px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-slate-50 text-slate-400"
                  >
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {project.client}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {project.industry}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {project.isSample && (
                    <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.78rem] font-medium text-brand-700">
                      샘플
                    </span>
                  )}
                  <StatusBadge tone={stage.tone}>
                    {project.currentStepLabel || stage.label}
                  </StatusBadge>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="shrink-0 text-sm text-slate-500">
                  {project.stepText ? (
                    <>
                      진행{' '}
                      <span className="font-semibold text-slate-700">
                        {project.stepText}
                      </span>
                    </>
                  ) : (
                    <>
                      진행률{' '}
                      <span className="font-semibold text-slate-700">
                        {project.progress}%
                      </span>
                    </>
                  )}
                </span>
                <ProgressBar
                  value={project.progress}
                  tone={health.tone}
                  label={`${project.client} 진행 단계`}
                />
              </div>
              <div className="mt-3">
                <StatusBadge tone={health.tone} withDot>
                  {health.label}
                </StatusBadge>
              </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
