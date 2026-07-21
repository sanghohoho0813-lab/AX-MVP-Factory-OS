/**
 * 작업공간 공통 프레임 (Stage 12B-UX 4차).
 * 모든 프로젝트 기반 작업공간(AX 설계·홈페이지·테스트·제출자료·기관연계·사례)이
 * 동일한 정보 순서·표현·내비게이션을 쓰도록 통일한다.
 *
 * 정보 우선순위:
 *  1) 지금 해야 할 일  2) 결정할 내용  3) 지금까지 정한 내용
 *  4) 완료 조건  5) 문제·주의  6) 상세 편집  7) 전문가·시스템 정보
 *
 * 도메인 계산·저장 로직은 바꾸지 않고 배치와 안내만 통일한다.
 */

import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Cloud,
  Loader2,
  TriangleAlert,
} from 'lucide-react'
import { ProjectContextBar } from './ProjectContextBar'

/* ------------------------------------------------------------------ */
/* 타입                                                                 */
/* ------------------------------------------------------------------ */

export interface WorkspaceStep {
  key: string
  label: string
  /** 실제 라우트 경로 (WorkspaceStepNav는 URL과 연결되어야 한다) */
  path: string
}

export type WorkspaceSaveState = 'idle' | 'saving' | 'saved' | 'local' | 'error'

/* ------------------------------------------------------------------ */
/* 저장 상태                                                            */
/* ------------------------------------------------------------------ */

export function WorkspaceSaveStatus({ state = 'local' }: { state?: WorkspaceSaveState }) {
  const map: Record<WorkspaceSaveState, { label: string; cls: string; icon: ReactNode }> = {
    idle: { label: '', cls: 'text-slate-400', icon: null },
    saving: { label: '저장 중…', cls: 'text-slate-500', icon: <Loader2 aria-hidden="true" className="size-4 animate-spin" /> },
    saved: { label: '저장됨', cls: 'text-success-700', icon: <CircleCheck aria-hidden="true" className="size-4" /> },
    local: { label: '이 브라우저에 저장', cls: 'text-slate-500', icon: <Cloud aria-hidden="true" className="size-4" /> },
    error: { label: '저장 실패', cls: 'text-danger-600', icon: <TriangleAlert aria-hidden="true" className="size-4" /> },
  }
  const it = map[state]
  if (!it.label) return null
  return (
    <span aria-live="polite" className={`inline-flex items-center gap-1.5 text-[0.9rem] font-medium ${it.cls}`}>
      {it.icon}
      {it.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* 헤더 — 모듈명 + 쉬운 설명 + 저장 상태                                 */
/* ------------------------------------------------------------------ */

export function WorkspaceHeader({
  moduleName,
  moduleDescription,
  saveStatus,
}: {
  moduleName: string
  moduleDescription: string
  saveStatus?: WorkspaceSaveState
}) {
  return (
    <div className="flex flex-col gap-4">
      <ProjectContextBar />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[1.6rem] leading-tight font-bold break-keep text-slate-900 sm:text-[1.75rem]">{moduleName}</h1>
          <p className="mt-1 max-w-3xl text-[1.05rem] break-keep text-slate-600">{moduleDescription}</p>
        </div>
        {saveStatus && <WorkspaceSaveStatus state={saveStatus} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 내부 단계 내비게이션                                                  */
/* ------------------------------------------------------------------ */

export function WorkspaceStepNav({
  steps,
  currentKey,
  label = '작업 단계',
}: {
  steps: WorkspaceStep[]
  currentKey: string
  label?: string
}) {
  const currentIdx = steps.findIndex((s) => s.key === currentKey)
  return (
    <nav aria-label={label} className="rounded-(--radius-panel) border border-slate-200 bg-white px-2 py-1.5">
      <ol className="flex min-w-0 gap-1 overflow-x-auto">
        {steps.map((s, i) => {
          const state = i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming'
          return (
            <li key={s.key} className="min-w-0 shrink-0">
              <NavLink
                to={s.path}
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
                <span className="break-keep whitespace-nowrap">{s.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/* 지금 해야 할 일                                                       */
/* ------------------------------------------------------------------ */

export function WorkspaceNextAction({
  title,
  why,
  actionLabel,
  actionPath,
  onAction,
  disabled,
  disabledReason,
  secondary,
  tone = 'brand',
}: {
  title: string
  why?: string
  actionLabel: string
  actionPath?: string
  onAction?: () => void
  disabled?: boolean
  disabledReason?: string
  secondary?: ReactNode
  tone?: 'brand' | 'success'
}) {
  const box = tone === 'success' ? 'border-success-200 bg-success-50/50' : 'border-brand-100 bg-brand-50/60'
  const btn = 'inline-flex h-auto min-h-13 items-center justify-center gap-2 rounded-(--radius-control) bg-brand-600 px-6 py-2.5 text-[1.05rem] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50'
  return (
    <section className={`rounded-(--radius-panel) border p-5 sm:p-6 ${box}`}>
      <p className="text-[0.9rem] font-medium tracking-wide text-slate-500">지금 해야 할 일</p>
      <h2 className="mt-1.5 text-[1.45rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.55rem]">{title}</h2>
      {why && <p className="mt-2.5 max-w-3xl text-[1.02rem] leading-relaxed break-keep text-slate-600">{why}</p>}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        {actionPath && !onAction ? (
          <NavLink to={actionPath} className={`${btn} w-full sm:w-auto`}>
            <span className="whitespace-normal">{actionLabel}</span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </NavLink>
        ) : (
          <button type="button" onClick={onAction} disabled={disabled} className={`${btn} w-full cursor-pointer sm:w-auto`}>
            <span className="whitespace-normal">{actionLabel}</span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </button>
        )}
        {disabled && disabledReason && <p className="text-[0.9rem] break-keep text-slate-500">{disabledReason}</p>}
        {secondary && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{secondary}</div>}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 요약 한 줄                                                           */
/* ------------------------------------------------------------------ */

export function WorkspaceSummaryLine({ label, value, tone }: { label: string; value: ReactNode; tone?: 'default' | 'warn' | 'ok' }) {
  const valueCls = tone === 'warn' ? 'text-warning-700' : tone === 'ok' ? 'text-success-700' : 'text-slate-800'
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 py-2 last:border-0">
      <span className="shrink-0 text-[0.9rem] text-slate-500">{label}</span>
      <span className={`min-w-0 break-keep text-right text-[0.9rem] font-medium ${valueCls}`}>{value}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 완료 조건 체크리스트                                                  */
/* ------------------------------------------------------------------ */

export interface ChecklistItem {
  ok: boolean
  label: string
  /** 조건 미충족 시 이동할 화면 */
  actionPath?: string
  actionLabel?: string
}

export function WorkspaceCompletionChecklist({ title = '완료 조건', items }: { title?: string; items: ChecklistItem[] }) {
  const done = items.filter((i) => i.ok).length
  return (
    <div>
      <p className="mb-2 flex items-center justify-between gap-2 text-[0.95rem] font-semibold text-slate-700">
        {title}
        <span className="text-[0.85rem] font-medium text-slate-400">{done}/{items.length}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-[0.92rem]">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${c.ok ? 'bg-success-500 text-white' : 'bg-slate-200 text-slate-500'}`} aria-hidden="true">
              {c.ok ? '✓' : '·'}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`break-keep ${c.ok ? 'text-slate-700' : 'text-slate-500'}`}>{c.label}</span>
              <span className="sr-only">{c.ok ? ' (완료됨)' : ' (미완료)'}</span>
              {!c.ok && c.actionPath && (
                <NavLink to={c.actionPath} className="mt-0.5 flex w-fit items-center gap-1 text-[0.85rem] font-semibold text-brand-600 hover:text-brand-700">
                  {c.actionLabel ?? '이 항목 처리하기'}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </NavLink>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 문제·주의 패널                                                       */
/* ------------------------------------------------------------------ */

export interface WorkspaceWarning {
  tone: 'error' | 'warn'
  message: string
  actionPath?: string
  actionLabel?: string
}

export function WorkspaceWarningPanel({ warnings }: { warnings: WorkspaceWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-[0.95rem] font-semibold text-slate-700">확인이 필요한 항목</p>
      <ul className="flex flex-col gap-2">
        {warnings.map((w, i) => (
          <li key={i} className={`flex items-start gap-2 rounded-(--radius-control) border px-3 py-2 text-[0.9rem] break-keep ${w.tone === 'error' ? 'border-danger-200 bg-danger-50 text-danger-700' : 'border-warning-200 bg-warning-50 text-warning-800'}`}>
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              {w.message}
              {w.actionPath && (
                <NavLink to={w.actionPath} className="mt-0.5 flex w-fit items-center gap-1 text-[0.85rem] font-semibold underline-offset-2 hover:underline">
                  {w.actionLabel ?? '해당 화면으로 이동'}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </NavLink>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 완료 후 다음 단계                                                    */
/* ------------------------------------------------------------------ */

export function WorkspaceNextStep({ label, path }: { label: string; path: string }) {
  return (
    <div>
      <p className="mb-2 text-[0.95rem] font-semibold text-slate-700">완료 후 다음 단계</p>
      <NavLink to={path} className="flex items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5 text-[0.92rem] font-medium text-slate-700 hover:border-brand-300">
        <span className="min-w-0 break-keep">{label}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </NavLink>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 요약 패널 (데스크톱 고정 / 모바일 접이식)                              */
/* ------------------------------------------------------------------ */

export function WorkspaceSummaryPanel({ title = '현재 요약', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <aside className="min-w-0">
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
        <div className="mt-2 flex flex-col gap-5 rounded-(--radius-panel) border border-slate-200 bg-slate-50/60 p-4 lg:mt-0 lg:sticky lg:top-6">
          {children}
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* 셸                                                                   */
/* ------------------------------------------------------------------ */

export function WorkspaceShell({
  moduleName,
  moduleDescription,
  saveStatus,
  steps,
  currentKey,
  nextAction,
  summary,
  children,
}: {
  moduleName: string
  moduleDescription: string
  saveStatus?: WorkspaceSaveState
  steps?: WorkspaceStep[]
  currentKey?: string
  /** 상단 "지금 해야 할 일" 블록 (선택) */
  nextAction?: ReactNode
  /** 오른쪽 요약 패널 내용 (선택) */
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <WorkspaceHeader moduleName={moduleName} moduleDescription={moduleDescription} saveStatus={saveStatus} />
      {steps && currentKey && <WorkspaceStepNav steps={steps} currentKey={currentKey} />}
      {nextAction}
      {summary ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">{children}</div>
          <WorkspaceSummaryPanel>{summary}</WorkspaceSummaryPanel>
        </div>
      ) : (
        <div className="min-w-0">{children}</div>
      )}
    </div>
  )
}
