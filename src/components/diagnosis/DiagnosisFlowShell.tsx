/**
 * 기업 진단 4단계 공통 프레임.
 * 상단: 프로젝트 컨텍스트 + 4단계 진행. 중앙: 현재 단계 작업. 오른쪽: 요약(모바일은 하단 접힘).
 * 진단 대상 → 질문 구성 → 설문·응답 → 진단 결과·업무 선택 을 하나의 흐름으로 통일한다.
 * 도메인 계산·저장 로직은 바꾸지 않고 정보 배치와 안내만 통일한다.
 */

import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Check, ChevronDown } from 'lucide-react'
import { ProjectContextBar } from '../workspace/ProjectContextBar'

export type DiagnosisStepKey = 'target' | 'questions' | 'responses' | 'result'

const STEPS: { key: DiagnosisStepKey; label: string }[] = [
  { key: 'target', label: '진단 대상' },
  { key: 'questions', label: '질문 구성' },
  { key: 'responses', label: '설문·응답' },
  { key: 'result', label: '진단 결과·업무 선택' },
]

function stepPath(step: DiagnosisStepKey, projectId: string): string {
  switch (step) {
    case 'target':
    case 'questions':
      return `/diagnosis/projects/${projectId}/setup`
    case 'responses':
      return `/diagnosis/projects/${projectId}/surveys`
    case 'result':
      return `/diagnosis/projects/${projectId}/analysis`
  }
}

export function DiagnosisStepNav({ current, projectId }: { current: DiagnosisStepKey; projectId: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current)
  return (
    <nav aria-label="기업 진단 단계" className="flex min-w-0 gap-1 overflow-x-auto">
      <ol className="flex min-w-0 flex-1 items-center gap-1">
        {STEPS.map((s, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming'
          return (
            <li key={s.key} className="min-w-0 flex-1">
              <NavLink
                to={stepPath(s.key, projectId)}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-(--radius-control) px-3 py-2.5 text-[0.9rem] font-medium transition-colors ${
                  state === 'current' ? 'bg-brand-50 text-brand-800' : state === 'done' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.78rem] font-bold ${
                  state === 'done' ? 'border-success-500 bg-success-500 text-white' : state === 'current' ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-400'
                }`}>
                  {state === 'done' ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
                </span>
                <span className="truncate">{s.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function DiagnosisSummaryPanel({ title = '현재 요약', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <aside className="min-w-0">
      {/* 모바일: 접이식 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.95rem] font-semibold text-slate-700 lg:hidden"
      >
        {title}
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>
        <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50/60 p-4 lg:sticky lg:top-6">
          <p className="mb-3 hidden text-[0.95rem] font-semibold text-slate-700 lg:block">{title}</p>
          {children}
        </div>
      </div>
    </aside>
  )
}

export function DiagnosisFlowShell({
  projectId,
  step,
  summary,
  children,
}: {
  projectId: string
  step: DiagnosisStepKey
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <ProjectContextBar />
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-2 py-1.5">
        <DiagnosisStepNav current={step} projectId={projectId} />
      </div>
      {summary ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">{children}</div>
          <DiagnosisSummaryPanel>{summary}</DiagnosisSummaryPanel>
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </div>
  )
}

/** 요약 패널 한 줄 */
export function SummaryLine({ label, value, tone }: { label: string; value: ReactNode; tone?: 'default' | 'warn' | 'ok' }) {
  const valueCls = tone === 'warn' ? 'text-warning-700' : tone === 'ok' ? 'text-success-700' : 'text-slate-800'
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 py-2 last:border-0">
      <span className="shrink-0 text-[0.9rem] text-slate-500">{label}</span>
      <span className={`min-w-0 break-keep text-right text-[0.9rem] font-medium ${valueCls}`}>{value}</span>
    </div>
  )
}
