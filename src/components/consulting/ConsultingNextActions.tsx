/**
 * 오늘 화면용 — 진행 중인 컨설팅 프로젝트마다 다음 행동 1개.
 * 프로젝트가 없거나 표가 아직 없으면 아무것도 그리지 않는다(오늘 화면을 어지럽히지 않는다).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ConsultingProject, NextAction } from '../../types/consulting'
import { listArtifacts, listEvidence, listProjects, listPromptPackages } from '../../services/consultingStudioService'
import { resolveNextActions } from '../../domain/consulting/nextActionResolver'
import { stageTitle } from './studioParts'

export function ConsultingNextActions({ workspaceId, today, onCount }: { workspaceId: string | null; today: string; onCount?: (n: number) => void }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<{ project: ConsultingProject; action: NextAction }[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [projects, artifacts, prompts, evidence] = await Promise.all([
          listProjects(workspaceId),
          listArtifacts(workspaceId),
          listPromptPackages(workspaceId),
          listEvidence(workspaceId),
        ])
        const out = projects
          .filter((p) => p.status === 'active')
          .map((project) => ({ project, action: resolveNextActions(project, { artifacts, prompts, evidence, today })[0] }))
          .filter((r): r is { project: ConsultingProject; action: NextAction } => r.action !== undefined)
          .slice(0, 5)
        if (alive) {
          setRows(out)
          onCount?.(out.length)
        }
      } catch {
        // 표가 없거나 읽지 못하면 조용히 비운다 — 오늘 화면은 컨설팅 없이도 완전해야 한다
        if (alive) {
          setRows([])
          onCount?.(0)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [workspaceId, today, onCount])

  if (rows.length === 0) return null

  return (
    <ol className="flex flex-col gap-2">
      {rows.map(({ project, action }) => (
        <li key={project.id}>
          <button
            type="button"
            onClick={() => navigate(`/studio/${project.id}?tab=${action.tab}${action.focus ? `&focus=${encodeURIComponent(action.focus)}` : ''}`)}
            className="tap flex w-full items-start gap-3 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1">
              <span className="t-card block break-keep text-slate-900">{action.title}</span>
              <span className="t-sub mt-0.5 block break-keep text-slate-500">{project.clientName} · {stageTitle(action.stageKey)}</span>
            </span>
            <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-300" />
          </button>
        </li>
      ))}
    </ol>
  )
}
