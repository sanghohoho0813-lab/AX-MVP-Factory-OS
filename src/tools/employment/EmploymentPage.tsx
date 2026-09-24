/**
 * 고용지원금 매니저 — 원본 고용지원금 매니저 Pro(git-test-kind-cori)를 옮긴 것.
 *
 * D-93 부터 화면은 원본 SubsidyApp.jsx 를 그대로 쓴다(`orig/`) — 대시보드 · 업체 관리 · 진행 보드 ·
 * 채용 진단 · 급여 계산기 · 수령액 시뮬레이터 · 지원금 관리 · 설정. 원본 안에서 화면을 옮기면 주소가 따라 바뀐다.
 * 업체는 고객 운영 하나뿐이다 — 업체를 추가할 때 고객 운영 업체를 고른다(orig/store.ts).
 *
 * 이 파일에 남은 두 화면(회차 일정 · 4대보험 명부 진단)은 이 OS 에서 더한 것이다 —
 * 업체 서류함 파일로 바로 돌리고, 결과를 업체 기록·달력에 붙인다. 명부에 붙여 넣은 글자는 남기지 않는다.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Copy, FolderOpen, RotateCcw, Upload } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { EmploymentOrig } from './orig/EmploymentOrig'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, MetricTile, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { usePrefillFromClient } from '../shared/usePrefill'
import { useToolClient } from '../shared/toolClientContext'
import { fetchClientDocFile, hasDocFile } from '../shared/clientDocFile'
import { PrefillNote } from '../shared/PrefillNote'
import { DEFAULT_PROGRAMS, PROGRAM_LIST } from './lib/programs'
import { fD, fDFull } from './lib/dates'
import { fMan, fProgramAmt } from './lib/format'
import { roundSchedule, type RoundKind } from './lib/schedule'
import { roundDeadlines } from './lib/toolDeadlines'
import {
  analyzeRoster,
  buildCopyText,
  CONFIDENCE_META,
  defaultTaxUnits,
  EMP_DOC_CHECKLIST,
  estimateSubsidyTotal,
  estimateTaxCredit,
  formatWon,
  LEVELS,
  parseRosterFile,
  parseRosterText,
  rosterStaleness,
  TAX_CHECKLIST,
  type LevelKey,
  type RegionType,
  type RosterAnalysis,
  type RosterEmployee,
  type RosterMeta,
  type SizeType,
} from './lib/payrollDiagnosis'

const STORAGE_PREFIX = 'axmvp.tools.employment.'

function loadStored<T>(tab: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tab)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return fallback
  }
}

function useStored<T extends object>(tab: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadStored(tab, fallback))
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + tab, JSON.stringify(value))
    } catch {
      /* 저장 못 해도 계산은 된다 */
    }
  }, [tab, value])
  return [value, setValue] as const
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

const DISCLAIMER = '이 화면의 결과는 규칙표 기준 1차 검토이며 확정이 아닙니다. 실제 신청 전 최신 공고와 운영기관 안내를 확인하고, 세액공제는 세무 대리인의 검토를 받으세요.'

/* ------------------------------------------------------------------ */
/* 공용 조각                                                            */
/* ------------------------------------------------------------------ */

interface Option<T extends string> {
  value: T
  label: string
}

function ChoiceGroup<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T | ''; options: readonly Option<T>[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="t-sub font-medium text-slate-600">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep transition-colors ${
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {hint && <p className="t-meta mt-1 text-slate-400">{hint}</p>}
    </fieldset>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="t-meta mt-0.5 block text-slate-400">{hint}</span>}
    </label>
  )
}

function NumberField({ label, value, onChange, hint, unit, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; unit?: string; placeholder?: string }) {
  return (
    <Field label={label} hint={hint}>
      <span className="flex items-center gap-1.5">
        <input type="number" inputMode="numeric" min={0} aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputCls} text-right tabular-nums`} />
        {unit && <span className="t-sub shrink-0 text-slate-500">{unit}</span>}
      </span>
    </Field>
  )
}

function Bullets({ items, tone = 'neutral' }: { items: readonly string[]; tone?: 'neutral' | 'muted' }) {
  if (items.length === 0) return null
  return (
    <ul className={`flex flex-col gap-1.5 ${tone === 'muted' ? 't-sub text-slate-500' : 't-body text-slate-700'}`}>
      {items.map((t) => (
        <li key={t} className="flex gap-2 break-keep">
          <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-slate-300" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 복사 못 하면 미리보기에서 손으로 긁는다 */
    }
  }
  return (
    <Button size="sm" onClick={copy}>
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {copied ? '복사됨' : '요약 복사'}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* 화면 뼈대                                                            */
/* ------------------------------------------------------------------ */

/** 이 OS 목차 키 ↔ 원본 화면 키 (D-93) */
const TO_VIEW: Record<string, string> = { companies: 'company', board: 'kanban' }
const TO_SECTION: Record<string, string> = { company: 'companies', kanban: 'board' }
/** 원본 화면으로 서는 목차 — 회차 일정 · 4대보험 명부 진단은 이 OS 에서 더한 화면이다 */
const ORIG_SECTIONS = new Set(['dashboard', 'companies', 'board', 'diagnosis', 'wage', 'simulator', 'programs', 'settings'])

/** 목차에서 고른 화면 → 이 자리에 선다. 목차 자체는 `toolRegistry` 의 sections 가 정한다. */
export function EmploymentPage() {
  const section = useModuleSection()
  const meta = toolOf('employment')?.sections?.find((s) => s.key === section)
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { clientId } = useToolClient()
  const here = useRef({ section, search: location.search })
  here.current = { section, search: location.search }
  const pending = useRef<{ view?: string; company?: string | null } | null>(null)

  // 원본이 화면·업체를 옮기면 주소를 바꾼다. 원본은 한 번에 두 번(업체 → 화면) 부르므로 모아서 한 번에
  const onNav = useCallback(
    (next: { view?: string; company?: string | null }) => {
      const queued = pending.current !== null
      pending.current = { ...(pending.current ?? {}), ...next }
      if (queued) return
      queueMicrotask(() => {
        const p = pending.current ?? {}
        pending.current = null
        const cur = here.current
        const view = p.view ?? TO_VIEW[cur.section] ?? cur.section
        const target = TO_SECTION[view] ?? (toolOf('employment')?.sections?.some((s) => s.key === view) ? view : 'dashboard')
        const qs = new URLSearchParams(cur.search)
        const company = 'company' in p ? p.company : qs.get('cid')
        if (company && target === 'companies') qs.set('cid', company)
        else qs.delete('cid')
        const q = qs.toString()
        void navigate(`/tools/employment/${target}${q ? `?${q}` : ''}`)
      })
    },
    [navigate],
  )

  if (ORIG_SECTIONS.has(section)) {
    // 업체에서 열었으면(?client=) 그 업체 화면으로
    const cid = params.get('cid') ?? (section === 'companies' ? clientId : null)
    return (
      <div className="flex flex-col gap-4">
        {/* D-94: 위 OS 모듈 머리줄이 이미 이름을 보여 준다 — 화면에는 숨기고 읽기 도구용 제목으로만 둔다 */}
        <h1 className="sr-only" data-testid="emp-module-eyebrow">
          고용지원금 매니저 Pro
        </h1>
        <EmploymentOrig view={TO_VIEW[section] ?? section} companyId={cid} onNav={onNav} focusClient={clientId} />
        {section === 'dashboard' && (
          <section className="flex flex-col gap-3" aria-label="고객 관리 업체와 연결">
            <h2 className="t-section text-slate-900">고객 관리 업체와 연결</h2>
            <ModuleDashboard toolKey="employment" />
          </section>
        )}
        <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="고용지원금 매니저"
        description={`${meta?.label ?? ''} — ${meta?.hint ?? ''}. 상담용 1차 검토이며 운영기관 심사와 세무 대리인 검토를 대신하지 않습니다.`}
      />
      {section === 'schedule' && <ScheduleTab />}
      {section === 'roster' && <RosterTab />}
      <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
    </div>
  )
}

/* ═════════════════ ② 회차 일정 ═════════════════ */

interface ScheduleForm {
  programId: string
  startDate: string
  paid: boolean[]
}

const EMPTY_SCHEDULE: ScheduleForm = { programId: 'youth_jump', startDate: '', paid: [] }

const KIND_TONE: Record<RoundKind, Tone> = { '지급 완료': 'success', '신청 지연': 'danger', '신청 임박': 'warning', '신청 예정': 'neutral' }

function ScheduleTab() {
  const [form, setForm] = useStored<ScheduleForm>('schedule', EMPTY_SCHEDULE)
  const [today] = useState(() => new Date())
  const program = DEFAULT_PROGRAMS[form.programId] ?? DEFAULT_PROGRAMS.youth_jump
  const sch = useMemo(() => roundSchedule(form.startDate, program, today, form.paid), [form.startDate, program, today, form.paid])
  const togglePaid = (i: number) =>
    setForm((f) => {
      const paid = program.rounds.map((_, idx) => !!f.paid[idx])
      paid[i] = !paid[i]
      return { ...f, paid }
    })
  const pickProgram = (id: string) => setForm((f) => ({ ...f, programId: id, paid: [] }))

  const summary = form.startDate
    ? [
        `${program.name} 회차 일정 (입사일 ${fDFull(form.startDate)})`,
        ...sch.rows.map((r) => `· ${r.label}: ${fD(r.date)} ${r.ddayLabel} · ${fMan(r.amount)} · ${r.kind}`),
        `총 ${fMan(sch.total)} · 받은 ${fMan(sch.received)} · 남은 ${fMan(sch.remaining)}`,
        `신청: ${program.applyUrl}`,
      ].join('\n')
    : ''

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-5 p-4 sm:p-5">
        <Field label="① 지원금">
          <select aria-label="지원금" value={form.programId} onChange={(e) => pickProgram(e.target.value)} className={inputCls}>
            {PROGRAM_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {fProgramAmt(p)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="② 입사일 (또는 전환·휴직 시작일)" hint="회차마다 입사일 + n개월이 신청 가능일입니다">
          <input type="date" aria-label="입사일" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputCls} />
        </Field>
        <Surface className="flex flex-col gap-1 p-3">
          <span className="t-body font-medium text-slate-800">{program.name}</span>
          <span className="t-sub break-keep text-slate-600">{program.note}</span>
          <span className="t-meta text-slate-500">신청: {program.applyUrl}</span>
        </Surface>
        <Disclosure title="필요 서류" hint={`업체 ${program.companyDocs.length} · 직원 ${program.employeeDocs.length}`}>
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div>
              <span className="t-meta font-medium text-slate-500">업체 서류</span>
              <Bullets items={program.companyDocs} tone="muted" />
            </div>
            <div>
              <span className="t-meta font-medium text-slate-500">직원 서류</span>
              <Bullets items={program.employeeDocs} tone="muted" />
            </div>
          </div>
        </Disclosure>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {!form.startDate ? (
          <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="t-card font-bold text-slate-700">입사일을 적으면 회차별 신청 가능일과 D-day 가 나옵니다</span>
            <span className="t-sub break-keep text-slate-500">받은 회차를 표시하면 남은 금액이 바로 갱신됩니다. 표시는 이 브라우저에만 남습니다.</span>
          </Surface>
        ) : (
          <>
            <Surface edge={sch.overdue > 0 ? 'danger' : sch.next7 > 0 ? 'warning' : 'neutral'} showEdge className="flex flex-col gap-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-meta font-medium text-slate-500">회차 일정</span>
                {sch.overdue > 0 && <Badge tone="danger">신청 지연 {sch.overdue}</Badge>}
                {sch.next7 > 0 && <Badge tone="warning">7일 내 {sch.next7}</Badge>}
                {sch.nextDday !== null && <Badge>다음 회차 D-{sch.nextDday}</Badge>}
              </div>
              <p className="t-card font-bold break-keep text-slate-900">
                총 {fMan(sch.total)} 중 <span className="text-success-700">{fMan(sch.received)}</span> 받음 · 남은 {fMan(sch.remaining)}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <CopyButton text={summary} />
                <ToolResultAttach
                  toolKey="employment"
                  title="고용지원금 회차 일정"
                  verdict={null}
                  verdictLabel={`${program.name} · 총 ${fMan(sch.total)}`}
                  summary={summary}
                  data={{ tab: 'schedule', programId: program.id, startDate: form.startDate, rows: sch.rows, total: sch.total, received: sch.received, remaining: sch.remaining }}
                  deadlines={roundDeadlines(program.name, sch.rows)}
                />
              </div>
            </Surface>
            {/* D-94: 넓은 화면에서는 오른쪽 칸(7/12)에 서므로 네 칸이면 금액이 잘린다 — 그때는 두 칸씩 */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
              <MetricTile label="총 예정" value={fMan(sch.total)} />
              <MetricTile label="받음" value={fMan(sch.received)} />
              <MetricTile label="남음" value={fMan(sch.remaining)} />
              <MetricTile label="신청 지연" value={`${sch.overdue}회`} tone={sch.overdue > 0 ? 'danger' : 'neutral'} />
            </div>
            <Surface padded={false} className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 t-meta text-slate-500">
                    <th className="px-3 py-2 font-medium">회차</th>
                    <th className="px-3 py-2 font-medium">신청 가능일</th>
                    <th className="px-3 py-2 font-medium">D-day</th>
                    <th className="px-3 py-2 text-right font-medium">금액</th>
                    <th className="px-3 py-2 font-medium">받음</th>
                  </tr>
                </thead>
                <tbody>
                  {sch.rows.map((r) => (
                    <tr key={r.index} className="border-b border-slate-100 t-sub text-slate-700">
                      <td className="px-3 py-2 break-keep">{r.label}</td>
                      <td className="px-3 py-2 t-num">{fD(r.date)}</td>
                      <td className="px-3 py-2">
                        <Badge tone={KIND_TONE[r.kind]}>
                          {r.isPaid ? '지급 완료' : `${r.ddayLabel} · ${r.kind}`}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right t-num">{fMan(r.amount)}</td>
                      <td className="px-3 py-2">
                        <label className="tap inline-flex items-center gap-1.5 t-sub text-slate-600">
                          <input type="checkbox" checked={r.isPaid} onChange={() => togglePaid(r.index)} className="size-4" aria-label={`${r.label} 받음`} />
                          받음
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
            <p className="t-meta break-keep text-slate-400">신청 가능일은 입사일에 회차 개월을 더한 날입니다. 실제 신청 기한은 공고마다 다르니 운영기관 안내를 함께 보세요.</p>
          </>
        )}
      </div>
    </div>
  )
}

/* ═════════════════ ④ 4대보험 명부 진단 ═════════════════ */

interface RosterForm {
  company: string
  sido: string
  sizeType: SizeType
  prevTotal: string
  prevYouth: string
  curTotal: string
  curYouth: string
  unitYouth: string
  unitNormal: string
  unitsTouched: boolean
}

const EMPTY_ROSTER: RosterForm = { company: '', sido: '', sizeType: 'sme', prevTotal: '', prevYouth: '', curTotal: '', curYouth: '', unitYouth: '', unitNormal: '', unitsTouched: false }

const SIDO_OPTIONS: readonly Option<string>[] = [
  { value: '서울', label: '서울' },
  { value: '경기', label: '경기' },
  { value: '인천', label: '인천' },
  { value: '기타', label: '그 외(비수도권)' },
]
const SIZE_OPTIONS: readonly Option<SizeType>[] = [
  { value: 'sme', label: '중소기업' },
  { value: 'mid', label: '중견기업' },
  { value: 'other', label: '기타/확인 필요' },
]

const LEVEL_TONE: Record<LevelKey, Tone> = { likely: 'success', check: 'warning', more: 'brand', unknown: 'neutral' }

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

function RosterTab() {
  const [form, setForm] = useStored<RosterForm>('roster', EMPTY_ROSTER)
  const set = <K extends keyof RosterForm>(k: K, v: RosterForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const { clientRecord, clientName } = useToolClient()
  // 업체에서 열었으면 업체명은 이미 안다 (D-90)
  const { note: prefillNote } = usePrefillFromClient((facts) => {
    if (form.company || !facts.companyName) return []
    setForm((f) => ({ ...f, company: facts.companyName }))
    return ['업체명']
  })
  // 붙여 넣은 명부 글자와 직원 목록은 저장하지 않는다 — 주민등록번호가 섞여 있을 수 있다
  const [text, setText] = useState('')
  const [employees, setEmployees] = useState<RosterEmployee[] | null>(null)
  const [meta, setMeta] = useState<RosterMeta | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [baseDate] = useState(() => new Date())

  const region: RegionType | null = form.sido ? (['서울', '경기', '인천'].indexOf(form.sido) >= 0 ? 'metro' : 'local') : null
  const units = defaultTaxUnits(region, form.sizeType)
  const unitYouth = form.unitsTouched && form.unitYouth !== '' ? form.unitYouth : String(units.youth)
  const unitNormal = form.unitsTouched && form.unitNormal !== '' ? form.unitNormal : String(units.normal)

  const analysis: RosterAnalysis | null = useMemo(() => (employees && employees.length > 0 ? analyzeRoster(employees, { baseDate }) : null), [employees, baseDate])
  const estimate = useMemo(
    () => estimateTaxCredit({ region, sizeType: form.sizeType, prevTotal: numOrNull(form.prevTotal), prevYouth: numOrNull(form.prevYouth), curTotal: numOrNull(form.curTotal), curYouth: numOrNull(form.curYouth), unitYouth, unitNormal }),
    [region, form.sizeType, form.prevTotal, form.prevYouth, form.curTotal, form.curYouth, unitYouth, unitNormal],
  )
  const stale = meta?.issueDate ? rosterStaleness(meta.issueDate, baseDate) : null
  const staleText = stale ? (stale.level === 'high' ? `${stale.days}일 경과 · 최신 명부 확인 필요` : stale.level === 'warn' ? `${stale.days}일 경과` : null) : null

  const runText = () => {
    setNotice('')
    const r = parseRosterText(text)
    if (!r.employees.length) {
      setEmployees(null)
      setMeta(null)
      setNotice('직원 후보를 찾지 못했습니다. 주민등록번호(앞 6자리-뒷자리) 또는 생년월일이 있는 명부 글자인지 확인해 주세요.')
      return
    }
    setEmployees(r.employees)
    setMeta(r.meta)
    if (!form.curTotal) set('curTotal', String(r.employees.length))
    setNotice(r.missingCount > 0 ? `${r.employees.length}명 후보 · 이름·생년월일·입사일이 빈 ${r.missingCount}명은 확인이 필요합니다.` : `${r.employees.length}명 후보를 찾았습니다.`)
  }

  /** 업체 서류함에 올려 둔 명부로 바로 진단 (D-90) */
  const runFromDocbox = async () => {
    setNotice('')
    try {
      const got = await fetchClientDocFile(clientRecord, 'payrollRoster')
      if (!got) {
        setNotice('서류함에 올려 둔 명부 파일이 없습니다. 파일을 먼저 올려 주세요.')
        return
      }
      await runFile(got.file)
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '서류함 파일을 읽지 못했습니다.')
    }
  }

  const runFile = async (file: File) => {
    setBusy(true)
    setNotice('')
    try {
      const r = await parseRosterFile(file)
      if (!r.ok || !r.employees) {
        setEmployees(null)
        setMeta(null)
        setNotice(
          r.error === 'unsupported'
            ? '엑셀(.xlsx) · PDF · CSV/TSV 글자 파일을 읽습니다. 오래된 엑셀(.xls)은 "다른 이름으로 저장 → xlsx 또는 CSV" 로 바꿔 주세요.'
            : r.error === 'no_text'
              ? 'PDF 에서 글자를 찾지 못했습니다. 스캔본이면 글자를 복사해 아래 칸에 붙여 넣어 주세요.'
              : r.error === 'no_rows' || r.error === 'empty'
                ? '직원 행을 찾지 못했습니다. 헤더(성명·주민등록번호·취득일)가 있는 명부인지 확인해 주세요.'
                : `읽지 못했습니다${r.message ? ` (${r.message})` : ''}.`,
        )
        return
      }
      setEmployees(r.employees)
      setMeta(r.meta ?? null)
      if (!form.curTotal) set('curTotal', String(r.employees.length))
      setNotice(`${file.name} 에서 ${r.employees.length}명 후보를 찾았습니다.`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const clearAll = () => {
    setText('')
    setEmployees(null)
    setMeta(null)
    setNotice('')
  }

  const copyText = analysis
    ? buildCopyText({
        company: form.company,
        totalEmp: analysis.counts.totalEmp,
        youthCount: analysis.counts.youthCount,
        seniorCount: analysis.counts.seniorCount,
        eiCheckCount: analysis.eiCheckCount,
        wcCheckCount: analysis.wcCheckCount,
        partialInsCount: analysis.partialInsCount,
        relCheckCount: analysis.relCheckCount,
        candidateSubsidyCount: analysis.candidateSubsidyCount,
        estimate,
        issueDate: meta?.issueDate ?? null,
        staleText,
      })
    : ''

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-5 p-4 sm:p-5">
        <Surface edge="brand" showEdge className="p-3">
          <p className="t-sub break-keep text-slate-600">
            명부는 이 브라우저 안에서만 읽습니다. 주민등록번호는 생년월일·성별만 뽑고 원본은 어디에도 저장하지 않으며, 화면에는 마스킹값(900101-1******)만 보입니다. 붙여 넣은 글자도 화면을 떠나면 남지 않습니다.
          </p>
        </Surface>
        <PrefillNote note={prefillNote} />
        <Field label="① 업체명 (요약 문구용 · 선택)">
          <input type="text" aria-label="업체명" value={form.company} onChange={(e) => set('company', e.target.value)} className={inputCls} placeholder="예: 미래상사" />
        </Field>
        <Field label="② 4대보험 가입자 명부 파일 (엑셀 · PDF · CSV/TSV)" hint="엑셀(.xlsx)은 그대로 올리면 됩니다. 스캔 PDF 는 글자 인식으로 넘어가며 처음 한 번은 다소 걸립니다.">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.pdf,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf,text/csv,text/plain"
            aria-label="명부 파일"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void runFile(f)
            }}
            className="t-sub block w-full text-slate-600 file:mr-3 file:rounded-(--radius-control) file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:t-sub file:font-medium file:text-slate-700"
          />
        </Field>
        {/* 업체 서류함에 올려 둔 명부로 바로 (D-90) */}
        {clientRecord && (
          hasDocFile(clientRecord, 'payrollRoster') ? (
            <Button variant="secondary" disabled={busy} onClick={() => void runFromDocbox()} data-testid="employment-from-docbox">
              <FolderOpen aria-hidden="true" className="size-4" />
              {busy ? '서류함에서 읽는 중…' : `${clientName} 서류함의 4대보험 명부로 진단`}
            </Button>
          ) : (
            <p className="t-sub flex items-start gap-1.5 break-keep text-danger-700" data-testid="employment-docbox-missing">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              서류함에 4대보험 가입자 명부가 없습니다 — 올려 두면 여기서 바로 진단합니다.
            </p>
          )
        )}
        <Field label="③ 또는 명부 글자 붙여넣기" hint="PDF 에서 복사한 글자, 홈택스·고용24 화면 복사본 모두 됩니다">
          <textarea aria-label="명부 글자" value={text} onChange={(e) => setText(e.target.value)} rows={7} className={`${inputCls} font-mono text-[0.85rem]`} placeholder={'성명 주민등록번호 국민연금 건강보험 산재보험 고용보험\n홍길동 980310-1****** 2026-01-05 2026-01-05 2026-01-05 2026-01-05'} />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" disabled={busy || !text.trim()} onClick={runText} className="w-full sm:w-auto">
            <Upload aria-hidden="true" className="size-4" /> {busy ? '읽는 중…' : '붙여 넣은 글자로 진단'}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <RotateCcw aria-hidden="true" className="size-4" /> 비우기
          </Button>
        </div>
        {notice && <p className="t-sub break-keep text-slate-600">{notice}</p>}

        <Disclosure title="통합고용세액공제 예상 입력" hint="전년도·올해 상시근로자 수와 소재지" defaultOpen>
          <div className="flex flex-col gap-4 pt-2">
            <ChoiceGroup label="사업장 소재지" value={form.sido} options={SIDO_OPTIONS} onChange={(v) => set('sido', v)} />
            <ChoiceGroup label="기업 규모" value={form.sizeType} options={SIZE_OPTIONS} onChange={(v) => set('sizeType', v)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="전년도 상시근로자" value={form.prevTotal} onChange={(v) => set('prevTotal', v)} unit="명" />
              <NumberField label="전년도 청년 등" value={form.prevYouth} onChange={(v) => set('prevYouth', v)} unit="명" />
              <NumberField label="올해 상시근로자" value={form.curTotal} onChange={(v) => set('curTotal', v)} unit="명" />
              <NumberField label="올해 청년 등" value={form.curYouth} onChange={(v) => set('curYouth', v)} unit="명" />
              <NumberField label="청년 등 단가" value={unitYouth} onChange={(v) => setForm((f) => ({ ...f, unitYouth: v, unitsTouched: true }))} unit="만원" hint="귀속연도 법령표 확인 필요" />
              <NumberField label="일반 단가" value={unitNormal} onChange={(v) => setForm((f) => ({ ...f, unitNormal: v, unitsTouched: true }))} unit="만원" />
            </div>
            {form.unitsTouched && (
              <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, unitYouth: '', unitNormal: '', unitsTouched: false }))}>
                기본 단가로 되돌리기
              </Button>
            )}
          </div>
        </Disclosure>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {!analysis ? (
          <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="t-card font-bold text-slate-700">명부를 올리거나 붙여 넣으면 직원별 후보가 나옵니다</span>
            <span className="t-sub break-keep text-slate-500">청년·고령·여성·신규 입사 추정을 나누고, 고용보험·산재보험 확인이 필요한 사람과 지원금별 후보 인원을 셉니다.</span>
          </Surface>
        ) : (
          <>
            <Surface edge={analysis.candidateSubsidyCount > 0 ? 'success' : 'neutral'} showEdge className="flex flex-col gap-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-meta font-medium text-slate-500">명부 1차 검토</span>
                <Badge tone={analysis.candidateSubsidyCount > 0 ? 'success' : 'neutral'}>후보 지원금 {analysis.candidateSubsidyCount}건</Badge>
                <Badge tone="warning">확인 항목 {analysis.checkItemCount}</Badge>
                {meta?.workplace && <Badge>{meta.workplace}</Badge>}
                {staleText && <Badge tone={stale?.level === 'high' ? 'danger' : 'warning'}>발급 {staleText}</Badge>}
              </div>
              <p className="t-card font-bold break-keep text-slate-900">
                {analysis.counts.totalEmp}명 중 청년 추정 {analysis.counts.youthCount}명 · 고령 {analysis.counts.seniorCount}명 · 조건 충족 시 최대 {formatWon(estimateSubsidyTotal(analysis.subsidySummary))} 검토 가능성
              </p>
              {estimate.computable && estimate.creditTotal != null && (
                <p className="t-sub text-slate-600">
                  통합고용세액공제 예상 <b className="text-slate-900">약 {formatWon(estimate.creditTotal)}</b> (증가 {estimate.incTotal}명 · 1차 추정 · 확정 아님)
                  {estimate.needsRecheck && <span className="text-danger-700"> · 청년 등 증가분이 전체 증가분보다 큽니다 — 입력값 재확인</span>}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                <CopyButton text={copyText} />
                <ToolResultAttach
                  toolKey="employment"
                  title="4대보험 명부 진단"
                  verdict={analysis.candidateSubsidyCount > 0 ? 'candidates' : 'none'}
                  verdictLabel={`후보 지원금 ${analysis.candidateSubsidyCount}건 · 확인 항목 ${analysis.checkItemCount}`}
                  summary={copyText}
                  data={{
                    tab: 'roster',
                    company: form.company,
                    counts: analysis.counts,
                    subsidySummary: analysis.subsidySummary.map((s) => ({ key: s.key, name: s.name, candidateCount: s.candidateCount, level: s.level })),
                    estimate,
                    issueDate: meta?.issueDate ?? null,
                    employees: analysis.rows.map((r) => ({ name: r.emp.name, age: r.diag.age, candidates: r.diag.candidates.map((c) => `${c.key}:${c.level}`) })),
                  }}
                />
              </div>
            </Surface>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MetricTile label="총 인원" value={`${analysis.counts.totalEmp}명`} hint={`재직 추정 ${analysis.counts.activeCount}`} />
              <MetricTile label="청년 추정" value={`${analysis.counts.youthCount}명`} />
              <MetricTile label="신규 입사 추정" value={`${analysis.counts.newHireCount}명`} hint="약 13개월 이내" />
              <MetricTile label="고용보험 확인" value={`${analysis.eiCheckCount}명`} tone={analysis.eiCheckCount > 0 ? 'warning' : 'neutral'} hint={`특수관계 확인 ${analysis.relCheckCount}`} />
            </div>

            <Section title="지원금별 후보">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {analysis.subsidySummary.map((s) => (
                  <Surface key={s.key} edge={LEVEL_TONE[s.level]} showEdge className="flex flex-col gap-1.5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="t-body font-bold break-keep text-slate-900">{s.name}</span>
                      <Badge tone={LEVEL_TONE[s.level]}>{LEVELS[s.level].label}</Badge>
                    </div>
                    <span className="t-sub text-slate-700">
                      후보 <b className="text-slate-900">{s.candidateCount}명</b> · 확인 {s.check} · 추가자료 {s.more}
                    </span>
                    <span className="t-meta break-keep text-slate-500">{s.note}</span>
                    <span className="t-meta text-slate-400">
                      {CONFIDENCE_META[s.confidence].label} · {s.confReason}
                    </span>
                  </Surface>
                ))}
              </div>
            </Section>

            <Section title="직원별 1차 검토" count={analysis.rows.length}>
              <Surface padded={false} className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 t-meta text-slate-500">
                      <th className="px-3 py-2 font-medium">이름</th>
                      <th className="px-3 py-2 font-medium">생년(마스킹)</th>
                      <th className="px-3 py-2 font-medium">나이</th>
                      <th className="px-3 py-2 font-medium">입사(취득)일</th>
                      <th className="px-3 py-2 font-medium">보험</th>
                      <th className="px-3 py-2 font-medium">후보</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.rows.map((r, i) => (
                      <tr key={`${r.emp.name}-${i}`} className={`border-b border-slate-100 t-sub ${r.diag.active ? 'text-slate-700' : 'text-slate-400'}`}>
                        <td className="px-3 py-2 break-keep">
                          {r.emp.name}
                          {!r.diag.active && <span className="t-meta ml-1 text-slate-400">상실</span>}
                        </td>
                        <td className="px-3 py-2 t-num">{r.emp.rrnMasked ?? r.emp.birthDate ?? '-'}</td>
                        <td className="px-3 py-2 t-num">
                          {r.diag.age ?? '-'}
                          {r.diag.isYouth && <span className="t-meta ml-1 text-brand-700">청년</span>}
                          {r.diag.isSenior && <span className="t-meta ml-1 text-slate-500">고령</span>}
                          {r.diag.isFemale && <span className="t-meta ml-1 text-slate-500">여</span>}
                        </td>
                        <td className="px-3 py-2 t-num">
                          {r.emp.hireDate ?? '-'}
                          {r.emp.multiDates && <span className="t-meta ml-1 text-warning-700">날짜 여러 개</span>}
                        </td>
                        <td className="px-3 py-2 break-keep">
                          {r.emp.insuranceRaw || '-'}
                          {r.diag.eiNeedsCheck && <span className="t-meta ml-1 text-warning-700">고용 확인</span>}
                          {r.diag.relCheck && <span className="t-meta ml-1 text-danger-700">특수관계 확인</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.diag.candidates.length === 0 ? (
                              <span className="t-meta text-slate-400">-</span>
                            ) : (
                              r.diag.candidates.map((c) => (
                                <Badge key={c.key} tone={LEVEL_TONE[c.level]}>
                                  {SUBSIDY_SHORT[c.key] ?? c.key} · {LEVELS[c.level].label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Surface>
            </Section>

            <Disclosure title="직원별 확인 문구" hint="후보마다 왜 확인이 필요한지">
              <ul className="flex flex-col gap-2">
                {analysis.rows
                  .filter((r) => r.diag.candidates.length > 0)
                  .map((r, i) => (
                    <li key={`${r.emp.name}-${i}`} className="flex flex-col gap-0.5">
                      <span className="t-body font-medium text-slate-800">{r.emp.name}</span>
                      {r.diag.candidates.map((c) => (
                        <span key={c.key} className="t-sub break-keep text-slate-600">
                          · {SUBSIDY_SHORT[c.key] ?? c.key}: {c.note}
                        </span>
                      ))}
                    </li>
                  ))}
              </ul>
            </Disclosure>
            <Disclosure title="추가 확인자료" hint={`${EMP_DOC_CHECKLIST.length}개`}>
              <Bullets items={EMP_DOC_CHECKLIST} tone="muted" />
            </Disclosure>
            <Disclosure title="세액공제 확인 목록" hint={`${TAX_CHECKLIST.length}개`}>
              <Bullets items={TAX_CHECKLIST} tone="muted" />
            </Disclosure>
            <Disclosure title="요약 미리보기 (직원 정보 없음)">
              <pre className="t-sub whitespace-pre-wrap break-keep text-slate-600">{copyText}</pre>
            </Disclosure>
          </>
        )}
      </div>
    </div>
  )
}

const SUBSIDY_SHORT: Record<string, string> = {
  youth_jump: '청년도약',
  emp_promo: '고용촉진',
  senior_continue: '계속고용',
  senior_intern: '시니어',
  saeil_women: '새일여성',
  parental: '육아',
}
