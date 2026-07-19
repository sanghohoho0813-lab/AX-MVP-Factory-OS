// 프로젝트 상세 — 첫 화면에서 '지금 어느 단계 / 무엇이 막힘 / 다음 할 일'이 보이도록.
// S1 구현 탭: 개요·단계. 미구현 탭(설문·판정·산출물·테스트·자금)은 비활성으로 명시.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addLog, advanceStage, getCompany, getProject, listLogs, listStages, updateProject, updateStage,
} from '../lib/repo'
import type { Company, Project, ProjectStage, StageLog, StageStatus } from '../lib/types'
import {
  CONTRACT_STATUS_LABEL, LEVEL_LABELS, PROJECT_STATUS_LABEL, STAGE_STATUS_LABEL, fmtDate, isOverdue,
} from '../lib/types'
import {
  Button, ContractBadge, ErrorNote, Field, LevelChip, ProjectStatusBadge, StageChip, StageStatusBadge, inputCls,
} from '../components/ui'

const FUTURE_TABS = [
  { key: 'survey', label: '설문', tag: 'S2' },
  { key: 'assess', label: '판정', tag: 'S3' },
  { key: 'artifacts', label: '산출물', tag: 'S5' },
  { key: 'tests', label: '테스트', tag: 'S4' },
  { key: 'funding', label: '자금', tag: 'S6' },
]

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [stages, setStages] = useState<ProjectStage[]>([])
  const [logs, setLogs] = useState<StageLog[]>([])
  const [tab, setTab] = useState<'overview' | 'stages'>('overview')
  const [err, setErr] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const p = await getProject(id)
      if (!p) { setNotFound(true); return }
      const [c, s, l] = await Promise.all([getCompany(p.company_id), listStages(p.id), listLogs(p.id)])
      setProject(p); setCompany(c); setStages(s); setLogs(l)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [id])

  useEffect(() => { void reload() }, [reload])

  const currentStage = useMemo(
    () => stages.find((s) => s.stage_no === project?.current_stage) ?? null,
    [stages, project],
  )

  if (notFound) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        프로젝트를 찾을 수 없습니다. <Link to="/projects" className="font-bold text-navy-700 underline">목록으로 →</Link>
      </div>
    )
  }
  if (err) return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{err}</p>
  if (!project) return <p className="py-16 text-center text-sm text-slate-400">불러오는 중…</p>

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-5">
        <Link to="/projects" className="text-xs font-semibold text-slate-400 hover:text-slate-600">← 프로젝트 목록</Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
          <ContractBadge status={project.contract_status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {company ? <Link to={`/companies/${company.id}`} className="font-semibold text-slate-600 hover:text-navy-700">{company.name}</Link> : '-'}
          {project.summary ? ` · ${project.summary}` : ''}
        </p>
      </div>

      {/* 지금 상태 스트립 — 어느 단계 / 무엇이 막힘 / 다음 할 일 */}
      <div className="mb-6 grid gap-2.5 rounded-xl border border-navy-200 bg-navy-50/60 p-4 sm:grid-cols-3">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-navy-600/70">현재 단계</p>
          <div className="mt-1 flex items-center gap-1.5">
            <StageChip no={project.current_stage} compact />
            <span className="text-sm font-bold text-navy-900">{currentStage?.title ?? '-'}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {currentStage && <StageStatusBadge status={currentStage.status} />}
            {currentStage && isOverdue(currentStage) && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-rose-600">목표일 지남</span>
            )}
            <LevelChip current={project.current_level} target={project.target_level} />
          </div>
        </div>
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-navy-600/70">막힌 것 · 위험</p>
          <p className="mt-1 text-sm leading-snug text-slate-700">
            {currentStage?.hold_reason?.trim() || currentStage?.risks?.trim() || <span className="text-slate-400">기록된 위험·보류 사유 없음</span>}
          </p>
        </div>
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-navy-600/70">다음 액션</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-navy-900">
            {currentStage?.next_action?.trim() || <span className="font-normal text-slate-400">다음 액션을 기록해 두세요</span>}
          </p>
          {currentStage?.target_end_at && (
            <p className="mt-0.5 text-xs text-slate-500">목표일 {fmtDate(currentStage.target_end_at)}</p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(['overview', 'stages'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-bold transition-colors ${
              tab === t ? 'border-navy-800 text-navy-900' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t === 'overview' ? '개요' : '단계'}
          </button>
        ))}
        {FUTURE_TABS.map((t) => (
          <span key={t.key} className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-slate-300" title={`${t.tag} 스프린트에서 제공`}>
            {t.label}
            <span className="rounded bg-slate-100 px-1 py-0.5 text-[0.6rem] font-bold text-slate-400">{t.tag} 예정</span>
          </span>
        ))}
      </div>

      {tab === 'overview'
        ? <OverviewTab project={project} company={company} logs={logs} onSaved={reload} />
        : <StagesTab project={project} stages={stages} onChanged={reload} />}
    </div>
  )
}

// ── 개요 탭 ───────────────────────────────────────────────────
function OverviewTab({ project, company, logs, onSaved }: {
  project: Project; company: Company | null; logs: StageLog[]; onSaved: () => Promise<void>
}) {
  const [status, setStatus] = useState(project.status)
  const [contract, setContract] = useState(project.contract_status)
  const [currentLevel, setCurrentLevel] = useState(project.current_level)
  const [targetLevel, setTargetLevel] = useState(project.target_level)
  const [summary, setSummary] = useState(project.summary ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = status !== project.status || contract !== project.contract_status ||
    currentLevel !== project.current_level || targetLevel !== project.target_level ||
    summary !== (project.summary ?? '')

  async function save() {
    setBusy(true); setErr(null); setSaved(false)
    try {
      await updateProject(project.id, {
        status, contract_status: contract, current_level: currentLevel, target_level: targetLevel,
        summary: summary.trim() || null,
      })
      await onSaved()
      setSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-[0.95rem] font-bold text-navy-900">프로젝트 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="진행 상태">
            <select value={status} onChange={(e) => setStatus(e.target.value as Project['status'])} className={inputCls}>
              {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="계약 상태">
            <select value={contract} onChange={(e) => setContract(e.target.value as Project['contract_status'])} className={inputCls}>
              {Object.entries(CONTRACT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="현재 MVP Level" hint="Stage(진행 단계)와 다른 축입니다">
            <select value={currentLevel} onChange={(e) => setCurrentLevel(Number(e.target.value))} className={inputCls}>
              {LEVEL_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </Field>
          <Field label="목표 MVP Level">
            <select value={targetLevel} onChange={(e) => setTargetLevel(Number(e.target.value))} className={inputCls}>
              {LEVEL_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="한 줄 개요">
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
        </Field>
        <ErrorNote msg={err} />
        <div className="flex items-center gap-2.5 border-t border-slate-100 pt-4">
          <Button onClick={save} disabled={busy || !dirty}>{busy ? '저장 중…' : '저장'}</Button>
          {saved && !dirty && <span className="text-xs font-semibold text-teal-700">저장됨</span>}
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-[0.95rem] font-bold text-navy-900">고객사</h2>
          {company ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">회사명</dt><dd className="font-semibold text-slate-800">{company.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">담당자</dt><dd className="text-slate-700">{company.contact_name ?? '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">연락처</dt><dd className="text-slate-700">{company.contact_phone ?? '-'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">규모</dt><dd className="text-slate-700">{[company.employee_band, company.revenue_band].filter(Boolean).join(' · ') || '-'}</dd></div>
            </dl>
          ) : <p className="mt-3 text-sm text-slate-400">고객사 정보 없음</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-[0.95rem] font-bold text-navy-900">최근 기록</h2>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">아직 기록이 없습니다. 단계 탭에서 메모·상태를 기록해 보세요.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {logs.slice(0, 6).map((l) => (
                <li key={l.id} className="text-[0.82rem] leading-snug">
                  <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-slate-500">S{l.stage_no}</span>
                  <span className="text-slate-700">{l.content}</span>
                  <span className="ml-1.5 text-[0.7rem] text-slate-400">{fmtDate(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

// ── 단계 탭 ───────────────────────────────────────────────────
function StagesTab({ project, stages, onChanged }: {
  project: Project; stages: ProjectStage[]; onChanged: () => Promise<void>
}) {
  const [openNo, setOpenNo] = useState<number>(project.current_stage)
  return (
    <div className="space-y-2.5">
      {stages.map((s) => (
        <StageCard
          key={s.id}
          stage={s}
          project={project}
          isCurrent={s.stage_no === project.current_stage}
          open={openNo === s.stage_no}
          onToggle={() => setOpenNo(openNo === s.stage_no ? -1 : s.stage_no)}
          onChanged={onChanged}
        />
      ))}
    </div>
  )
}

function StageCard({ stage, project, isCurrent, open, onToggle, onChanged }: {
  stage: ProjectStage; project: Project; isCurrent: boolean; open: boolean
  onToggle: () => void; onChanged: () => Promise<void>
}) {
  const [form, setForm] = useState({
    status: stage.status,
    started_at: stage.started_at ?? '',
    target_end_at: stage.target_end_at ?? '',
    completed_at: stage.completed_at ?? '',
    required_materials: stage.required_materials ?? '',
    completion_criteria: stage.completion_criteria ?? '',
    risks: stage.risks ?? '',
    hold_reason: stage.hold_reason ?? '',
    next_action: stage.next_action ?? '',
    memo: stage.memo ?? '',
    customer_confirmed: stage.customer_confirmed,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setBusy(true); setErr(null)
    try {
      await updateStage(stage.id, {
        status: form.status,
        started_at: form.started_at || null,
        target_end_at: form.target_end_at || null,
        completed_at: form.completed_at || null,
        required_materials: form.required_materials.trim() || null,
        completion_criteria: form.completion_criteria.trim() || null,
        risks: form.risks.trim() || null,
        hold_reason: form.hold_reason.trim() || null,
        next_action: form.next_action.trim() || null,
        memo: form.memo.trim() || null,
        customer_confirmed: form.customer_confirmed,
      })
      if (form.status !== stage.status) {
        await addLog(project.id, stage.stage_no, 'status_change',
          `S${stage.stage_no} 상태: ${STAGE_STATUS_LABEL[stage.status]} → ${STAGE_STATUS_LABEL[form.status]}`)
      }
      await onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function addNote() {
    if (!note.trim()) return
    setBusy(true)
    try {
      await addLog(project.id, stage.stage_no, 'note', note.trim())
      setNote('')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function advance() {
    if (!window.confirm(`Stage ${stage.stage_no} 을(를) 통과 처리하고 다음 단계로 진행할까요?\n(현재 단계 상태가 '통과'로 기록됩니다)`)) return
    setBusy(true); setErr(null)
    try {
      await advanceStage(project, stage)
      await onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '진행에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const past = stage.stage_no < project.current_stage

  return (
    <div className={`overflow-hidden rounded-xl border bg-white ${isCurrent ? 'border-navy-600 ring-1 ring-navy-600/20' : 'border-slate-200'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[0.72rem] font-black ${
          isCurrent ? 'bg-navy-800 text-white' : past ? 'bg-teal-500/15 text-teal-700' : 'bg-slate-100 text-slate-400'
        }`}>{stage.stage_no}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-bold ${isCurrent ? 'text-navy-900' : 'text-slate-700'}`}>{stage.title}</span>
          {stage.next_action && isCurrent && <span className="block truncate text-xs text-slate-500">다음: {stage.next_action}</span>}
        </span>
        <StageStatusBadge status={stage.status} />
        {isOverdue(stage) && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-rose-600">지연</span>}
        <span className="text-slate-300" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {stage.purpose && <p className="text-[0.82rem] text-slate-500">{stage.purpose}</p>}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="상태">
              <select value={form.status} onChange={(e) => set('status', e.target.value as StageStatus)} className={inputCls}>
                {Object.entries(STAGE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="시작일">
              <input type="date" value={form.started_at} onChange={(e) => set('started_at', e.target.value)} className={inputCls} />
            </Field>
            <Field label="목표 완료일">
              <input type="date" value={form.target_end_at} onChange={(e) => set('target_end_at', e.target.value)} className={inputCls} />
            </Field>
            <Field label="실제 완료일">
              <input type="date" value={form.completed_at} onChange={(e) => set('completed_at', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="필요한 자료">
              <textarea value={form.required_materials} onChange={(e) => set('required_materials', e.target.value)} rows={2} className={`${inputCls} resize-y`} />
            </Field>
            <Field label="완료 조건">
              <textarea value={form.completion_criteria} onChange={(e) => set('completion_criteria', e.target.value)} rows={2} className={`${inputCls} resize-y`} />
            </Field>
            <Field label="위험요소">
              <textarea value={form.risks} onChange={(e) => set('risks', e.target.value)} rows={2} placeholder="비어 있으면 대시보드 위험 집계에서 제외됩니다" className={`${inputCls} resize-y`} />
            </Field>
            <Field label="보류 사유">
              <textarea value={form.hold_reason} onChange={(e) => set('hold_reason', e.target.value)} rows={2} className={`${inputCls} resize-y`} />
            </Field>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="다음 액션" hint="대시보드 '다음 행동' 목록에 표시됩니다">
              <input value={form.next_action} onChange={(e) => set('next_action', e.target.value)} className={inputCls} />
            </Field>
            <Field label="내부 메모">
              <input value={form.memo} onChange={(e) => set('memo', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.customer_confirmed} onChange={(e) => set('customer_confirmed', e.target.checked)} className="h-4 w-4 accent-navy-800" />
            고객 확인 완료
          </label>
          <ErrorNote msg={err} />
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
            <Button onClick={save} disabled={busy} size="sm">{busy ? '저장 중…' : '단계 저장'}</Button>
            {isCurrent && project.current_stage < 7 && (
              <Button onClick={advance} disabled={busy} size="sm" variant="secondary">
                ✓ 이 단계 통과 → 다음 단계로
              </Button>
            )}
            <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="기록 남기기 (커뮤니케이션·메모)" className={`${inputCls} sm:w-64`} />
              <Button onClick={addNote} disabled={busy || !note.trim()} size="sm" variant="ghost">기록</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
