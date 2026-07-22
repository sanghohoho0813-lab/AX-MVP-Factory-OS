/**
 * 프로젝트 컨텍스트 바 — 모든 작업 화면 상단에 현재 고객·프로젝트·단계를 고정 표시한다.
 * 프로젝트 미선택 시 선택 안내를 보여준다. 최근 5개 프로젝트 빠른 전환 제공.
 */

import { useNavigate } from 'react-router-dom'
import { Building2, ChevronDown, FolderKanban, Repeat } from 'lucide-react'
import { useActiveProject } from '../../context/activeProject'
import { useDismissable } from '../../lib/useDismissable'
import { PROJECT_TYPE_META } from '../../lib/domainMeta'
import { computeProjectJourney } from '../../services/journeyService'
import { Button } from '../ui/Button'

export function ProjectContextBar() {
  const navigate = useNavigate()
  const { project, organization, recentProjects, setActiveProject } = useActiveProject()
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()

  if (!project) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FolderKanban aria-hidden="true" className="size-5" />
          </span>
          <p className="text-[1.05rem] font-medium break-keep text-slate-700">먼저 작업할 프로젝트를 선택하세요.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/clients')}>프로젝트 선택하기</Button>
      </section>
    )
  }

  const journey = computeProjectJourney(project)
  const typeMeta = PROJECT_TYPE_META[project.projectType]
  const progress = journey.progress

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.95rem] font-medium text-slate-500">
            <Building2 aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{organization?.name ?? '고객사'}</span>
            {progress.isSample && (
              <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.78rem] font-semibold text-brand-700">샘플</span>
            )}
          </p>
          <h1 className="mt-0.5 text-[1.35rem] leading-tight font-bold break-keep text-slate-900">{project.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-slate-500">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{typeMeta.label}</span>
            <span className="break-keep">
              {progress.stepText} · 현재 {progress.currentStep.label}
            </span>
          </p>
        </div>

        <div ref={containerRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="프로젝트 변경"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.95rem] font-medium text-slate-700 hover:bg-slate-50 sm:px-4"
          >
            <Repeat aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span className="hidden sm:inline">프로젝트 변경</span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          </button>
          {open && (
            <div role="menu" className="absolute top-full right-0 z-30 mt-1.5 w-72 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
              {recentProjects.length > 0 && (
                <>
                  <p className="px-3 py-1.5 text-[0.8rem] font-semibold text-slate-400">최근 프로젝트</p>
                  {recentProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      onClick={() => { setActiveProject(p.id); setOpen(false); navigate(`/projects/${p.id}`) }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.95rem] hover:bg-slate-50 ${p.id === project.id ? 'font-semibold text-brand-700' : 'text-slate-700'}`}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === project.id && <span className="text-[0.8rem] text-brand-600">현재</span>}
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); navigate('/clients') }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[0.95rem] text-slate-700 hover:bg-slate-50"
              >
                다른 프로젝트 찾기
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
