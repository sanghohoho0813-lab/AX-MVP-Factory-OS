import { useParams } from 'react-router-dom'
import { ArrowRight, User, Cpu, Users, ExternalLink } from 'lucide-react'
import type { MvpWorkflow, MvpWorkflowStep } from '../../types/mvpDesign'
import { Panel } from '../../components/ui/Panel'
import { DesignSectionFrame } from './designShared'

const HANDLED_META: Record<MvpWorkflowStep['handledBy'], { label: string; icon: typeof User; tone: string }> = {
  user: { label: '담당자', icon: User, tone: 'text-slate-500' },
  system: { label: '시스템 자동', icon: Cpu, tone: 'text-success-600' },
  system_and_user: { label: '시스템+담당자', icon: Users, tone: 'text-brand-600' },
  external: { label: '외부', icon: ExternalLink, tone: 'text-warning-600' },
}

function WorkflowColumn({ workflow, tone }: { workflow: MvpWorkflow; tone: 'current' | 'desired' }) {
  return (
    <Panel title={tone === 'current' ? '현재 업무 흐름' : 'MVP 적용 후 목표 흐름'}>
      <p className="mb-3 text-[0.92rem] break-keep text-slate-500">{workflow.summary}</p>
      {workflow.steps.length === 0 ? (
        <p className="text-[0.92rem] text-slate-400">기록된 단계가 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {workflow.steps.map((step, i) => {
            const meta = HANDLED_META[step.handledBy]
            return (
              <li key={step.id} className="flex items-start gap-3 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.82rem] font-semibold text-slate-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.92rem] break-keep text-slate-700">{step.action}</p>
                  <p className={`mt-0.5 inline-flex items-center gap-1 text-[0.875rem] ${meta.tone}`}>
                    <meta.icon aria-hidden="true" className="size-3" />
                    {meta.label}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

export function DesignWorkflowPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const current = design.workflows.find((w) => w.kind === 'current')
        const desired = design.workflows.find((w) => w.kind === 'desired')
        return (
          <>
            <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/50 px-4 py-3">
              <p className="text-[0.92rem] break-keep text-slate-600">
                기능명이 아니라 실제 업무 흐름을 정의합니다. 목표 흐름의 각 단계가 어떤 기능으로 처리되는지 <ArrowRight aria-hidden="true" className="inline size-3" /> 기능·범위 탭에서 이어집니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {current && <WorkflowColumn workflow={current} tone="current" />}
              {desired && <WorkflowColumn workflow={desired} tone="desired" />}
            </div>
          </>
        )
      }}
    />
  )
}
