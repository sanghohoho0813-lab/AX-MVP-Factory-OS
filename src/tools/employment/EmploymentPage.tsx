/**
 * 고용지원금 진단 — 고용지원금 매니저 Pro 의 핵심 계산을 도구로 옮긴 것.
 *
 * 규칙표·계산식은 전부 `lib/` 에 있고(원본 그대로), 이 파일은 묻고 보여 주기만 한다.
 * 네 화면: 채용 진단 · 회차 일정 · 급여 계산기 · 4대보험 명부 진단 (`?t=` 로 고른다).
 *
 * 적은 값은 이 브라우저에 남는다. 단, 명부에 붙여 넣은 글자는 남기지 않는다 —
 * 주민등록번호 원본은 어디에도 저장하지 않는다는 원본의 약속을 그대로 지킨다.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, RotateCcw, Upload } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, MetricTile, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { BOSU_FLOOR_2026, DIAG_CATS, ELIG, EXCL, MIN_WAGE_2026, MIN_WAGE_MONTH_2026, SPECIAL_OPTIONS_CHILDCARE, SPECIAL_OPTIONS_RETAIN } from './lib/constants'
import { DEFAULT_PROGRAMS, PROGRAM_CHECKLISTS, PROGRAM_LIST, type EmpType, type Gender } from './lib/programs'
import { fD, fDFull } from './lib/dates'
import { fMan, fProgramAmt } from './lib/format'
import { buildAnswers, diagnoseHiring, youthGate, type DiagnosisRow, type DiagnosisStatus, type Region, type Situation } from './lib/eligibility'
import { computePayroll, type PayrollResult } from './lib/payroll'
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

function ToggleChip({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
        on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {on && <Check aria-hidden="true" className="mr-1 inline size-3.5" />}
      {label}
    </button>
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

const TABS = [
  { key: 'diagnosis', label: '채용 진단' },
  { key: 'schedule', label: '회차 일정' },
  { key: 'wage', label: '급여 계산기' },
  { key: 'roster', label: '4대보험 명부 진단' },
] as const
type TabKey = (typeof TABS)[number]['key']

function isTabKey(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v)
}

export function EmploymentPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('t')
  const tab: TabKey = isTabKey(raw) ? raw : 'diagnosis'
  const setTab = (k: TabKey) => {
    const next = new URLSearchParams(params)
    next.set('t', k)
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="고용지원금 매니저"
        description="채용 조건으로 가능성 있는 고용지원금을 고르고, 회차별 신청일과 급여·4대보험을 셈하고, 4대보험 명부로 직원별 후보를 1차 검토합니다. 상담용 1차 검토이며 운영기관 심사와 세무 대리인 검토를 대신하지 않습니다."
      />
      <div role="tablist" aria-label="고용지원금 도구" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`tap shrink-0 rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
              tab === t.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'diagnosis' && <DiagnosisTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'wage' && <WageTab />}
      {tab === 'roster' && <RosterTab />}
      <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
    </div>
  )
}

/* ═════════════════ ① 채용 진단 ═════════════════ */

interface DiagnosisForm {
  situation: Situation
  cats: string[]
  specials: string[]
  age: string
  gender: Gender | ''
  milMonths: string
  region: Region
  companySize: string
  empType: EmpType
  preApply: boolean
  noLayoff: boolean
  aboveFloor: boolean
  youthEligible: boolean
  /** 청년도약 자격요건 — 생년월일·입사예정일·취업애로·제외요건 (선택) */
  birthDate: string
  hireDate: string
  elig: Record<string, boolean>
  excl: Record<string, boolean>
}

const EMPTY_DIAGNOSIS: DiagnosisForm = {
  situation: 'new',
  cats: [],
  specials: [],
  age: '',
  gender: '',
  milMonths: '',
  region: '수도권',
  companySize: '',
  empType: '정규직',
  preApply: true,
  noLayoff: true,
  aboveFloor: true,
  youthEligible: true,
  birthDate: '',
  hireDate: '',
  elig: {},
  excl: {},
}

const SITUATIONS: readonly Option<Situation>[] = [
  { value: 'new', label: '신규 채용' },
  { value: 'retain', label: '재직자 처우개선' },
  { value: 'childcare', label: '출산·육아' },
]
const GENDERS: readonly Option<Gender>[] = [
  { value: 'male', label: '남' },
  { value: 'female', label: '여' },
]
const REGIONS: readonly Option<Region>[] = [
  { value: '수도권', label: '수도권' },
  { value: '비수도권', label: '비수도권' },
]
const EMP_TYPES: readonly Option<EmpType>[] = [
  { value: '정규직', label: '정규직' },
  { value: '계약직', label: '계약직' },
  { value: '인턴', label: '인턴' },
  { value: '대체인력', label: '대체인력' },
]

const STATUS_TONE: Record<DiagnosisStatus, Tone> = { recommend: 'success', maybe: 'warning', exclude: 'neutral' }
const STATUS_LABEL: Record<DiagnosisStatus, string> = { recommend: '가능성 높음', maybe: '조건 확인 필요', exclude: '해당 낮음' }

function toggleIn(list: string[], v: string): string[] {
  return list.indexOf(v) >= 0 ? list.filter((x) => x !== v) : list.concat([v])
}

function DiagnosisTab() {
  const [form, setForm] = useStored<DiagnosisForm>('diagnosis', EMPTY_DIAGNOSIS)
  const [submitted, setSubmitted] = useState(false)
  const set = <K extends keyof DiagnosisForm>(k: K, v: DiagnosisForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const specialOptions = form.situation === 'retain' ? SPECIAL_OPTIONS_RETAIN : form.situation === 'childcare' ? SPECIAL_OPTIONS_CHILDCARE : []
  const answers = useMemo(() => buildAnswers(form), [form])
  const rows: DiagnosisRow[] | null = useMemo(() => (submitted ? diagnoseHiring(answers, PROGRAM_LIST) : null), [submitted, answers])
  const recommend = rows ? rows.filter((r) => r.status === 'recommend') : []
  const maybe = rows ? rows.filter((r) => r.status === 'maybe') : []
  const exclude = rows ? rows.filter((r) => r.status === 'exclude') : []

  const showYouth = form.cats.indexOf('청년') >= 0 && form.situation === 'new'
  const gate = useMemo(
    () => (showYouth && form.birthDate ? youthGate({ birthDate: form.birthDate, gender: form.gender, milMonths: Number(form.milMonths) || 0, elig: form.elig, excl: form.excl, hireDate: form.hireDate || undefined }) : null),
    [showYouth, form.birthDate, form.gender, form.milMonths, form.elig, form.excl, form.hireDate],
  )

  const summary = rows
    ? [
        `고용지원금 채용 진단 (${form.situation === 'new' ? '신규 채용' : form.situation === 'retain' ? '재직자 처우개선' : '출산·육아'} · ${form.region} · ${form.empType})`,
        `가능성 높음 ${recommend.length}건 · 조건 확인 필요 ${maybe.length}건`,
        ...recommend.map((r) => `✅ ${r.program.name} — ${r.reasons.join(' · ')}`),
        ...maybe.map((r) => `⚠️ ${r.program.name} — ${r.blockers.join(' · ') || r.reasons.join(' · ')}`),
        '진단 결과는 가능성 안내이며 확정이 아닙니다. 실제 신청 전 최신 공고를 확인하세요.',
      ].join('\n')
    : ''

  const reset = () => {
    setForm(EMPTY_DIAGNOSIS)
    setSubmitted(false)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-5 p-4 sm:p-5">
        <ChoiceGroup label="① 상황" value={form.situation} options={SITUATIONS} onChange={(v) => set('situation', v)} />
        {form.situation === 'new' && (
          <fieldset>
            <legend className="t-sub font-medium text-slate-600">② 채용 대상자 (여럿 가능)</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {DIAG_CATS.map((c) => (
                <ToggleChip key={c.id} on={form.cats.indexOf(c.id) >= 0} label={`${c.icon} ${c.label}`} onToggle={() => set('cats', toggleIn(form.cats, c.id))} />
              ))}
            </div>
          </fieldset>
        )}
        {specialOptions.length > 0 && (
          <fieldset>
            <legend className="t-sub font-medium text-slate-600">② 구체적 상황 (여럿 가능)</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {specialOptions.map((c) => (
                <ToggleChip key={c.id} on={form.specials.indexOf(c.id) >= 0} label={c.label} onToggle={() => set('specials', toggleIn(form.specials, c.id))} />
              ))}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="③ 나이(만)" value={form.age} onChange={(v) => set('age', v)} placeholder="29" unit="세" />
          <ChoiceGroup label="④ 성별" value={form.gender} options={GENDERS} onChange={(v) => set('gender', v)} />
          {form.gender === 'male' && <NumberField label="⑤ 군복무 개월" value={form.milMonths} onChange={(v) => set('milMonths', v)} placeholder="18" unit="개월" hint="청년 상한(만 34세)이 복무 기간만큼 늘어납니다 (최대 만 39세)" />}
          <NumberField label="⑥ 회사 규모(고용보험 피보험자)" value={form.companySize} onChange={(v) => set('companySize', v)} placeholder="피보험자 수" unit="명" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceGroup label="⑦ 지역" value={form.region} options={REGIONS} onChange={(v) => set('region', v)} />
          <ChoiceGroup label="⑧ 채용형태" value={form.empType} options={EMP_TYPES} onChange={(v) => set('empType', v)} />
        </div>
        <fieldset>
          <legend className="t-sub font-medium text-slate-600">⑨ 확인 사항 (해당하면 켠다)</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <ToggleChip on={form.preApply} label="채용 전(사전신청 가능)" onToggle={() => set('preApply', !form.preApply)} />
            <ToggleChip on={form.noLayoff} label="최근 감원 이력 없음" onToggle={() => set('noLayoff', !form.noLayoff)} />
            <ToggleChip on={form.aboveFloor} label="월보수 124만원 이상" onToggle={() => set('aboveFloor', !form.aboveFloor)} />
            {showYouth && form.region === '수도권' && <ToggleChip on={form.youthEligible} label="취업애로요건 해당(청년·수도권)" onToggle={() => set('youthEligible', !form.youthEligible)} />}
          </div>
        </fieldset>

        {showYouth && (
          <Disclosure title="청년도약 자격요건 정밀 확인 (선택)" hint="생년월일·취업애로·제외요건으로 나이 경계와 자격을 다시 봅니다">
            <div className="flex flex-col gap-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="생년월일">
                  <input type="date" aria-label="생년월일" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} className={inputCls} />
                </Field>
                <Field label="입사(예정)일" hint="비우면 오늘 기준으로 나이를 셉니다">
                  <input type="date" aria-label="입사(예정)일" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <fieldset>
                <legend className="t-sub font-medium text-slate-600">취업애로요건 (1개 이상)</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ELIG.map((e) => (
                    <ToggleChip key={e.id} on={!!form.elig[e.id]} label={e.label} onToggle={() => set('elig', { ...form.elig, [e.id]: !form.elig[e.id] })} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="t-sub font-medium text-slate-600">제외요건 — 확인한 것만 켠다</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EXCL.map((x) => (
                    <ToggleChip key={x.id} on={form.excl[x.id] === true} label={x.label} onToggle={() => set('excl', { ...form.excl, [x.id]: form.excl[x.id] === true ? false : true })} />
                  ))}
                </div>
              </fieldset>
              {gate && (
                <Surface edge={gate.ok ? 'success' : 'warning'} showEdge className="flex flex-col gap-1 p-3">
                  <span className="t-body font-medium text-slate-800">
                    {gate.age !== null ? `만 ${gate.age}세 (상한 ${gate.maxLabel})` : '나이 확인 불가'} · {gate.ageOk ? '나이 요건 충족' : '나이 요건 미충족'}
                  </span>
                  <span className="t-sub text-slate-600">
                    취업애로요건 {gate.anyElig ? '1개 이상 해당' : '해당 없음'} · 제외요건 {gate.allExclOk ? '전부 확인' : gate.failedExcl.length > 0 ? `${gate.failedExcl.length}개 해당 가능` : '확인 안 됨'}
                  </span>
                  {gate.nearBorder && <span className="t-meta text-warning-700">경계선 — 관할기관 확인 필요</span>}
                  <span className={`t-sub font-medium ${gate.ok ? 'text-success-700' : 'text-slate-500'}`}>{gate.ok ? '대상자 예상' : '일부 요건 확인 필요'}</span>
                </Surface>
              )}
            </div>
          </Disclosure>
        )}

        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <Button variant="primary" onClick={() => setSubmitted(true)} className="w-full sm:w-auto">
            지원금 가능성 진단
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" /> 다시 입력
          </Button>
        </div>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {!rows ? (
          <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="t-card font-bold text-slate-700">채용 조건을 고르고 진단을 누르면 여기에 결과가 나옵니다</span>
            <span className="t-sub break-keep text-slate-500">15개 고용지원금을 규칙표에 대어 가능성 높음 · 조건 확인 필요 · 해당 낮음으로 나눕니다.</span>
          </Surface>
        ) : (
          <>
            <Surface edge={recommend.length > 0 ? 'success' : maybe.length > 0 ? 'warning' : 'neutral'} showEdge className="flex flex-col gap-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-meta font-medium text-slate-500">진단 결과</span>
                <Badge tone="success">가능성 높음 {recommend.length}</Badge>
                <Badge tone="warning">조건 확인 필요 {maybe.length}</Badge>
                <Badge>해당 낮음 {exclude.length}</Badge>
              </div>
              <p className="t-card font-bold break-keep text-slate-900" data-testid="employment-diagnosis-oneline">
                {recommend.length > 0 ? `${recommend.map((r) => r.program.name).join(' · ')} 검토 가능성이 있습니다` : maybe.length > 0 ? '조건을 확인하면 검토 가능한 지원금이 있습니다' : '입력 조건에 뚜렷하게 맞는 지원금이 없습니다'}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <CopyButton text={summary} />
                <ToolResultAttach
                  toolKey="employment"
                  title="고용지원금 진단"
                  verdict={recommend.length > 0 ? 'recommend' : maybe.length > 0 ? 'maybe' : 'exclude'}
                  verdictLabel={`가능성 높음 ${recommend.length}건 · 확인 필요 ${maybe.length}건`}
                  summary={summary}
                  data={{ tab: 'diagnosis', answers, results: rows.map((r) => ({ id: r.program.id, name: r.program.name, status: r.status, score: r.score, reasons: r.reasons, blockers: r.blockers })) }}
                />
              </div>
            </Surface>

            {recommend.length > 0 && (
              <Section title="가능성 높음" count={recommend.length}>
                {recommend.map((r) => (
                  <DiagnosisCard key={r.program.id} row={r} withChecklist />
                ))}
              </Section>
            )}
            {maybe.length > 0 && (
              <Section title="조건 확인 필요" count={maybe.length}>
                {maybe.map((r) => (
                  <DiagnosisCard key={r.program.id} row={r} />
                ))}
              </Section>
            )}
            {exclude.length > 0 && (
              <Disclosure title="해당 낮음" hint={`${exclude.length}개`}>
                <ul className="flex flex-col gap-1.5">
                  {exclude.map((r) => (
                    <li key={r.program.id} className="flex flex-wrap items-baseline gap-x-2 t-sub break-keep text-slate-500">
                      <span className="font-medium text-slate-700">{r.program.name}</span>
                      <span>{r.blockers.length > 0 ? r.blockers.join(' · ') : r.reasons.join(' · ') || '대상 유형 불일치'}</span>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
            <Disclosure title="요약 미리보기">
              <pre className="t-sub whitespace-pre-wrap break-keep text-slate-600">{summary}</pre>
            </Disclosure>
          </>
        )}
      </div>
    </div>
  )
}

function DiagnosisCard({ row, withChecklist = false }: { row: DiagnosisRow; withChecklist?: boolean }) {
  const p = row.program
  const checklist = PROGRAM_CHECKLISTS[p.id] ?? []
  return (
    <Surface edge={STATUS_TONE[row.status]} showEdge className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-card font-bold break-keep text-slate-900">{p.name}</span>
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        <Badge>{p.group}</Badge>
        <Badge tone="brand">{fProgramAmt(p)}</Badge>
      </div>
      {row.reasons.length > 0 && <p className="t-sub break-keep text-success-700">👍 {row.reasons.join(' · ')}</p>}
      {row.blockers.length > 0 && <p className="t-sub break-keep text-danger-700">⚠️ {row.blockers.join(' · ')}</p>}
      <p className="t-sub break-keep text-slate-600">{p.note}</p>
      <p className="t-meta text-slate-500">신청: {p.applyUrl}</p>
      {withChecklist && checklist.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <span className="t-meta font-medium text-slate-500">신청 전 확인할 것 ({checklist.length})</span>
          <Bullets items={checklist} tone="muted" />
        </div>
      )}
    </Surface>
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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

/* ═════════════════ ③ 급여 계산기 ═════════════════ */

interface WageForm {
  monthly: string
  weeklyHours: string
  dependents: string
  annual: string
}

const EMPTY_WAGE: WageForm = { monthly: '', weeklyHours: '40', dependents: '1', annual: '' }

function won(n: number): string {
  return n.toLocaleString() + '원'
}

function WageTab() {
  const [form, setForm] = useStored<WageForm>('wage', EMPTY_WAGE)
  const set = <K extends keyof WageForm>(k: K, v: WageForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const monthly = Number(form.monthly) || 0
  const result: PayrollResult | null = useMemo(() => computePayroll(monthly, Number(form.weeklyHours) || 40, Number(form.dependents) || 1), [monthly, form.weeklyHours, form.dependents])

  const applyAnnual = () => {
    const a = Number(form.annual) || 0
    if (a > 0) set('monthly', String(Math.round(a / 12)))
  }

  const summary = result
    ? [
        `급여 계산 (2026 · 월급 ${won(monthly)} · 주 ${form.weeklyHours || 40}시간 · 부양가족 ${form.dependents || 1}명)`,
        `시급 환산 ${won(result.hourlyWage)} (${result.isAboveMin ? '최저임금 이상' : '최저임금 미달'}) · 월 ${result.monthlyHours}시간`,
        `근로자 공제 합계 ${won(result.totalDeduct)} → 실수령 ${won(result.netPay)}`,
        `사업주 부담 4대보험 ${won(result.total4_er)} → 총 인건비 ${won(result.totalEmployerCost)}`,
        '소득세는 간이세액표 근사이며 실제 원천징수액과 다를 수 있습니다.',
      ].join('\n')
    : ''

  const eeRows: [string, string, number][] = result
    ? [
        ['국민연금', '4.5% (상한 590만)', result.pension_ee],
        ['건강보험', '3.545%', result.health_ee],
        ['장기요양', '건강보험의 12.95%', result.care_ee],
        ['고용보험', '0.9%', result.employ_ee],
        ['근로소득세', '간이세액 근사', result.incomeTax],
        ['지방소득세', '소득세의 10%', result.localTax],
      ]
    : []
  const erRows: [string, string, number][] = result
    ? [
        ['국민연금', '4.5% (상한 590만)', result.pension_er],
        ['건강보험', '3.545%', result.health_er],
        ['장기요양', '건강보험의 12.95%', result.care_er],
        ['고용보험', '0.9%', result.employ_er],
        ['산재보험', '1.43% (업종 평균 예시)', result.injury_er],
      ]
    : []

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-5 p-4 sm:p-5">
        <p className="t-sub break-keep text-slate-500">
          2026년 기준 · 최저임금 시급 <b className="text-slate-900">{MIN_WAGE_2026.toLocaleString()}원</b> · 월환산 <b className="text-slate-900">{MIN_WAGE_MONTH_2026.toLocaleString()}원</b>(209h) · 지원금 보수 하한{' '}
          <b className="text-slate-900">{BOSU_FLOOR_2026.toLocaleString()}원</b>
        </p>
        <NumberField label="① 월급 (세전)" value={form.monthly} onChange={(v) => set('monthly', v)} unit="원" placeholder="3000000" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="② 주 소정근로시간" value={form.weeklyHours} onChange={(v) => set('weeklyHours', v)} unit="시간" hint="40시간이면 월 209시간, 15시간 이상이면 주휴 포함" />
          <NumberField label="③ 부양가족 수 (본인 포함)" value={form.dependents} onChange={(v) => set('dependents', v)} unit="명" />
        </div>
        <Disclosure title="연봉으로 넣기" hint="연봉 ÷ 12">
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end">
            <NumberField label="연봉" value={form.annual} onChange={(v) => set('annual', v)} unit="원" placeholder="36000000" />
            <Button size="sm" onClick={applyAnnual} className="shrink-0">
              월급에 반영
            </Button>
          </div>
        </Disclosure>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {!result ? (
          <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="t-card font-bold text-slate-700">월급을 적으면 4대보험·세금·실수령액이 나옵니다</span>
            <span className="t-sub break-keep text-slate-500">근로자 공제와 사업주 부담을 따로 보여 주고, 최저임금·지원금 보수 하한도 같이 확인합니다.</span>
          </Surface>
        ) : (
          <>
            <Surface edge={result.isAboveMin ? 'success' : 'danger'} showEdge className="flex flex-col gap-2 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-meta font-medium text-slate-500">급여 계산</span>
                <Badge tone={result.isAboveMin ? 'success' : 'danger'}>{result.isAboveMin ? '최저임금 이상' : '최저임금 미달'}</Badge>
                <Badge tone={result.isAboveFloor ? 'success' : 'warning'}>{result.isAboveFloor ? '보수 하한 124만 충족' : '보수 하한 124만 미달'}</Badge>
              </div>
              <p className="t-card font-bold break-keep text-slate-900">
                실수령 <span className="text-brand-700">{won(result.netPay)}</span> · 사업주 총 인건비 {won(result.totalEmployerCost)}
              </p>
              <p className="t-sub text-slate-600">
                시급 환산 <b className="text-slate-900">{won(result.hourlyWage)}</b> (월 {result.monthlyHours}시간) · 최저 월급 {won(result.minMonthly)} · 시급 차이 {result.gap >= 0 ? '+' : ''}
                {result.gap.toLocaleString()}원
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <CopyButton text={summary} />
                <ToolResultAttach
                  toolKey="employment"
                  title="급여 계산"
                  verdict={result.isAboveMin ? 'above_min' : 'below_min'}
                  verdictLabel={result.isAboveMin ? '최저임금 이상' : '최저임금 미달'}
                  summary={summary}
                  data={{ tab: 'wage', monthly, weeklyHours: form.weeklyHours, dependents: form.dependents, ...result }}
                />
              </div>
            </Surface>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <MetricTile label="근로자 4대보험" value={won(result.total4_ee)} />
              <MetricTile label="소득세+지방세" value={won(result.incomeTax + result.localTax)} />
              <MetricTile label="공제 합계" value={won(result.totalDeduct)} />
              <MetricTile label="사업주 4대보험" value={won(result.total4_er)} />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Surface padded={false} className="overflow-x-auto">
                <div className="border-b border-slate-100 px-3 py-2 t-body font-medium text-slate-800">근로자 공제</div>
                <table className="w-full min-w-[300px] text-left">
                  <tbody>
                    {eeRows.map(([label, pct, amt]) => (
                      <tr key={label} className="border-b border-slate-100 t-sub">
                        <td className="px-3 py-2 text-slate-700">
                          {label} <span className="t-meta text-slate-400">{pct}</span>
                        </td>
                        <td className="px-3 py-2 text-right t-num text-danger-700">−{amt.toLocaleString()}원</td>
                      </tr>
                    ))}
                    <tr className="t-sub font-medium">
                      <td className="px-3 py-2 text-slate-900">실수령액</td>
                      <td className="px-3 py-2 text-right t-num text-slate-900">{won(result.netPay)}</td>
                    </tr>
                  </tbody>
                </table>
              </Surface>
              <Surface padded={false} className="overflow-x-auto">
                <div className="border-b border-slate-100 px-3 py-2 t-body font-medium text-slate-800">사업주 부담</div>
                <table className="w-full min-w-[300px] text-left">
                  <tbody>
                    {erRows.map(([label, pct, amt]) => (
                      <tr key={label} className="border-b border-slate-100 t-sub">
                        <td className="px-3 py-2 text-slate-700">
                          {label} <span className="t-meta text-slate-400">{pct}</span>
                        </td>
                        <td className="px-3 py-2 text-right t-num text-success-700">+{amt.toLocaleString()}원</td>
                      </tr>
                    ))}
                    <tr className="t-sub font-medium">
                      <td className="px-3 py-2 text-slate-900">총 인건비</td>
                      <td className="px-3 py-2 text-right t-num text-slate-900">{won(result.totalEmployerCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </Surface>
            </div>
            <p className="t-meta break-keep text-slate-400">근로소득세는 간이세액표 근사식이라 실제 원천징수액과 차이가 날 수 있습니다. 산재보험 요율은 업종마다 다릅니다.</p>
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
