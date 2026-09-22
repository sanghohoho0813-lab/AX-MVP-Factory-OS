/**
 * 연구소 사후관리 도구 (LabCare) — 기업부설연구소 OS 의 규칙을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 규칙은 `lib/` 안에 있고(원본 그대로), 이 파일은 묻고 보여 주기만 한다.
 *  · 설립 가능성 체크 · 설립서류 체크리스트 · 월간 사후관리 점검
 *  · 세액공제 예상 · 변경신고 D-day · 안내문 11종
 *
 * 점수는 내지 않는다. "인정됩니다" 라고 단정하지 않는다 — 모든 결론은 현재 입력 기준 1차 검토다.
 * 적은 값은 이 브라우저에 남는다 — 상담 중 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, MetricTile, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import type {
  ActivityVerdict,
  CandidateVerdict,
  CeoVerdict,
  CheckAnswers,
  Client,
  EligibilityVerdict,
  FacilityVerdict,
  FeasibilityInput,
  FeasibilityResult,
  FeasibilityVerdict,
  LabType,
  PersonnelChangeType,
  ResearcherCandidate,
  RiskFactor,
} from './types'
import { assessFeasibility } from './lib/feasibility'
import { evaluateRisk, LEVEL_META, riskSummary, urgentReason } from './lib/riskEngine'
import { CATEGORY_RATES, formatKRW, formatManwon, getTaxCreditEstimate } from './lib/taxCredit'
import {
  CERT_OPTS,
  EDU_OPTS,
  EXCLUDED_INDUSTRIES,
  FACILITY_DEPT,
  FACILITY_LAB,
  FIELD_OPTS,
  INDUSTRY_CATEGORIES,
  MAJOR_OPTS,
  NATURE_OPTS,
  NEGATIVE_OPTS,
  SIZE_OPTS,
  TYPE_OPTS,
  newCandidate,
} from './lib/assessmentOptions'
import {
  DOC_MASTER,
  DOC_STATUS_OPTS,
  SETUP_GROUPS,
  docProgressOf,
  groupProgress,
  missingDocs,
  stageOf,
  type DocClient,
  type DocStatus,
  type SetupDoc,
  type SetupPackage,
} from './lib/documents'
import { changeDeadlineOf, ddayOf, isCheckDue, isSurveySeason, nextCheckDate, surveyDeadlineLabel, ymdLocal, type DdayInfo } from './lib/deadlines'
import { changeDeadlines } from './lib/toolDeadlines'
import { CYCLES, DEFAULT_ANSWERS, REASONS, STATUSES, defaultRequestText, mapChangeStatus, type ChangeRecStatus, type ChangeRecord } from './lib/changes'
import { INSPECTION_ITEMS, INSPECTION_POINTS } from './lib/inspection'
import { RESOURCE_CATEGORIES, RESOURCE_TEMPLATES, fillTemplate, type ResourceCategory } from './lib/templates'
import { BENEFIT_OPTIONS, composeBenefitText } from './lib/report'

/* ───────────────── 저장 ───────────────── */

const STORE = {
  assess: 'axmvp.tools.labcare.assess',
  docs: 'axmvp.tools.labcare.docs',
  check: 'axmvp.tools.labcare.check',
  tax: 'axmvp.tools.labcare.tax',
  changes: 'axmvp.tools.labcare.changes',
  templates: 'axmvp.tools.labcare.templates',
} as const

function readStore<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<T>
    return { ...fallback, ...saved }
  } catch {
    return fallback
  }
}

function usePersist(key: string, value: unknown) {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* 저장 못 해도 판정은 된다 */
    }
  }, [key, value])
}

/** 복사 — 되면 잠깐 "복사됨", 안 되면 본문을 그대로 보여 손으로 긁게 한다 */
function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setFailedId(null)
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800)
    } catch {
      setFailedId(id)
    }
  }
  return { copiedId, failedId, copy }
}

function CopyButton({ id, text, label = '복사', copyState }: { id: string; text: string; label?: string; copyState: ReturnType<typeof useCopy> }) {
  const done = copyState.copiedId === id
  return (
    <Button size="sm" onClick={() => copyState.copy(id, text)}>
      {done ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      {done ? '복사됨' : label}
    </Button>
  )
}

function CopyFallback({ id, text, copyState }: { id: string; text: string; copyState: ReturnType<typeof useCopy> }) {
  if (copyState.failedId !== id) return null
  return (
    <div className="flex flex-col gap-1">
      <p className="t-meta break-keep text-danger-700">이 브라우저에서는 자동 복사가 되지 않았습니다. 아래 글을 길게 눌러 직접 복사해 주세요.</p>
      <textarea readOnly value={text} rows={4} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} t-sub`} />
    </div>
  )
}

/* ───────────────── 공용 입력 조각 ───────────────── */

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  labelOf,
}: {
  label: string
  value: T | ''
  options: readonly T[]
  onChange: (v: T) => void
  hint?: string
  labelOf?: (v: T) => string
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="t-sub font-medium text-slate-600">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o === value
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o)}
              className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep transition-colors ${
                on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {labelOf ? labelOf(o) : o}
            </button>
          )
        })}
      </div>
      {hint && <p className="t-meta mt-1 break-keep text-slate-400">{hint}</p>}
    </fieldset>
  )
}

function MultiChips<T extends string>({
  label,
  values,
  options,
  onToggle,
  hint,
}: {
  label: string
  values: readonly T[]
  options: readonly T[]
  onToggle: (v: T) => void
  hint?: string
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="t-sub font-medium text-slate-600">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = values.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
                on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {on && <Check aria-hidden="true" className="mr-1 inline size-3.5" />}
              {o}
            </button>
          )
        })}
      </div>
      {hint && <p className="t-meta mt-1 break-keep text-slate-400">{hint}</p>}
    </fieldset>
  )
}

/** 예/아니오 한 줄 — 왼쪽 질문, 오른쪽 두 단추 */
function YesNo({ label, value, onChange, hint, yes = '예', no = '아니오' }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string; yes?: string; no?: string }) {
  const btn = (on: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(text === yes)}
      className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
        on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {text}
    </button>
  )
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <span className="t-sub block font-medium break-keep text-slate-700">{label}</span>
        {hint && <span className="t-meta block break-keep text-slate-400">{hint}</span>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {btn(value, yes)}
        {btn(!value, no)}
      </div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <input type="text" aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`mt-1 ${inputCls}`} />
      {hint && <span className="t-meta mt-0.5 block break-keep text-slate-400">{hint}</span>}
    </label>
  )
}

function NumField({ label, value, onChange, unit, hint, step = 1, min = 0 }: { label: string; value: number | ''; onChange: (v: number | '') => void; unit?: string; hint?: string; step?: number; min?: number }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`${inputCls} text-right tabular-nums`}
        />
        {unit && <span className="t-sub shrink-0 text-slate-500">{unit}</span>}
      </span>
      {hint && <span className="t-meta mt-0.5 block break-keep text-slate-400">{hint}</span>}
    </label>
  )
}

function DateField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <input type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 ${inputCls}`} />
      {hint && <span className="t-meta mt-0.5 block break-keep text-slate-400">{hint}</span>}
    </label>
  )
}

function Bullets({ items, tone = 'neutral' }: { items: string[]; tone?: 'neutral' | 'muted' }) {
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

function CardTitle({ children, badge }: { children: ReactNode; badge?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="t-card font-bold break-keep text-slate-900">{children}</h3>
      {badge}
    </div>
  )
}

function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: Tone }) {
  const fill = tone === 'success' ? 'bg-success-500' : tone === 'warning' ? 'bg-warning-500' : tone === 'danger' ? 'bg-danger-500' : 'bg-brand-600'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

const DISCLAIMER =
  '이 화면의 결론은 현재 입력 기준 1차 검토입니다. 인정 여부는 신고 기관(KOITA) 의 심사와 증빙자료로 결정되며, 세액공제·감면은 세무 대리인의 최종 검토가 필요합니다. 모든 기록은 실제 활동에 기반해야 하며 허위 작성은 금지됩니다.'

/* ───────────────── 색 매핑 (판정 → OS 색) ───────────────── */

const VERDICT_TONE: Record<FeasibilityVerdict, Tone> = {
  '기업부설연구소 가능': 'success',
  '연구개발전담부서 우선 추천': 'brand',
  '보완 후 가능': 'warning',
  '현재 진행 비추천': 'danger',
  '추가 확인 필요': 'neutral',
}
const CAND_TONE: Record<CandidateVerdict, Tone> = { '인정 가능': 'success', '추가 확인 필요': 'warning', '인정 어려움': 'danger' }
// 후보자 카드 상단 최종 판정 표시 라벨 (원본 CAND_LABEL)
const CAND_LABEL: Record<CandidateVerdict, string> = { '인정 가능': '가능성 높음', '추가 확인 필요': '추가 확인 필요', '인정 어려움': '부적합 가능성' }
const CEO_TONE: Record<CeoVerdict, Tone> = { '가능성 있음': 'success', '추가 확인 필요': 'warning', '인정 어려움': 'danger', '해당 없음': 'neutral' }
const SECTION_TONE: Record<EligibilityVerdict | ActivityVerdict | FacilityVerdict, Tone> = {
  '신고대상으로 보임': 'success',
  '신고대상 부적합 가능성': 'danger',
  '연구개발활동 적합': 'success',
  '보완 필요': 'warning',
  '부적합 가능성': 'danger',
  '물적요건 충족': 'success',
  '진행 어려움': 'danger',
  '추가 확인 필요': 'warning',
}
const DDAY_TONE: Record<DdayInfo['tone'], Tone> = { ok: 'neutral', warn: 'warning', danger: 'danger', over: 'danger' }
const LEVEL_TONE: Record<'normal' | 'warning' | 'danger', Tone> = { normal: 'success', warning: 'warning', danger: 'danger' }
const SEVERITY_TONE: Record<RiskFactor['severity'], Tone> = { high: 'danger', medium: 'warning', low: 'neutral' }
const SEVERITY_LABEL: Record<RiskFactor['severity'], string> = { high: '높음', medium: '중간', low: '낮음' }
const STATUS_TONE: Record<ChangeRecStatus, Tone> = { '확인 필요': 'warning', '변경 예정': 'brand', '신고 준비중': 'brand', '신고 완료': 'success' }

/* ───────────────── 탭 ───────────────── */

const TABS = [
  { key: 'assess', label: '설립 가능성 체크' },
  { key: 'docs', label: '설립서류' },
  { key: 'check', label: '월간 점검' },
  { key: 'tax', label: '세액공제 예상' },
  { key: 'changes', label: '변경신고 D-day' },
  { key: 'templates', label: '안내문 11종' },
] as const
type TabKey = (typeof TABS)[number]['key']

function isTabKey(v: string | null): v is TabKey {
  return TABS.some((t) => t.key === v)
}

export function LabcarePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('t')
  const tab: TabKey = isTabKey(raw) ? raw : 'assess'
  const setTab = (k: TabKey) => {
    const next = new URLSearchParams(params)
    next.set('t', k)
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="기업부설연구소 OS"
        description="기업부설연구소·연구개발전담부서의 설립 가능성부터 서류·월간 점검·변경신고·안내문까지 한 곳에서 봅니다. 상담용 1차 검토이며 신고 기관 심사와 세무 대리인 검토를 대신하지 않습니다."
      />
      <div role="tablist" aria-label="연구소 사후관리 도구" className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
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
      {tab === 'assess' && <AssessTab />}
      {tab === 'docs' && <DocsTab />}
      {tab === 'check' && <CheckTab />}
      {tab === 'tax' && <TaxTab />}
      {tab === 'changes' && <ChangesTab />}
      {tab === 'templates' && <TemplatesTab />}
      <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
    </div>
  )
}

/* ═════════════════ ① 설립 가능성 체크 ═════════════════ */

type AssessForm = Omit<FeasibilityInput, 'businessMonths'> & { years: number }

const EMPTY_ASSESS: AssessForm = {
  desiredType: '아직 모름',
  companyName: '',
  industry: '',
  industryField: '과학기술 분야',
  isExcludedIndustry: false,
  companySize: '소기업',
  isVenture: false,
  isResearcherFounded: false,
  years: 3,
  becameMediumWithinYear: false,
  employeeCount: 10,
  isOverseasLab: false,
  isForProfit: true,
  hasBusinessOps: true,
  rndOnlyCompany: false,
  isSubUnit: true,
  projectName: '',
  preCommercial: true,
  activityNature: '새로운 제품·공정·서비스 개발',
  negativeActivities: [],
  hasSpace: true,
  independentSpace: true,
  fixedWallsAndDoor: true,
  movableWallPossible: false,
  spaceUnder50: true,
  adequateArea: true,
  equipmentInSpace: true,
  isInfoServiceOrSW: false,
  candidates: [],
}

function loadAssess(): AssessForm {
  const saved = readStore<AssessForm>(STORE.assess, EMPTY_ASSESS)
  const candidates = Array.isArray(saved.candidates) && saved.candidates.length > 0
    ? saved.candidates.map((c) => ({ ...newCandidate(), ...c }))
    : [newCandidate()]
  return { ...saved, negativeActivities: Array.isArray(saved.negativeActivities) ? saved.negativeActivities : [], candidates }
}

function toInput(f: AssessForm): FeasibilityInput {
  const { years, ...rest } = f
  return {
    ...rest,
    businessMonths: Math.round(years * 12),
    becameMediumWithinYear: f.companySize === '중기업' ? f.becameMediumWithinYear : false,
  }
}

function assessSummaryText(f: AssessForm, r: FeasibilityResult): string {
  const lines = [
    `[설립 가능성 체크] ${f.companyName.trim() || '(기업명 미입력)'}${f.industry ? ` · ${f.industry}` : ''}`,
    `판정: ${r.verdict} · 추천 경로: ${r.recommendedType}`,
    r.summary,
    `연구소 기준 필요 인원 ${r.requiredForLab}명 · 인정 가능 후보 ${r.eligibleCount}명 · 추가 확인 ${r.reviewCount}명${r.shortage > 0 ? ` · 부족 ${r.shortage}명` : ''}`,
  ]
  if (r.improvements.length) lines.push('', '보완 항목', ...r.improvements.map((t) => `- ${t}`))
  if (r.strategy.length) lines.push('', '진행 전략', ...r.strategy.map((t) => `- ${t}`))
  lines.push('', '※ 현재 입력 기준 1차 검토입니다. 증빙자료 확인 후 달라질 수 있습니다.')
  return lines.join('\n')
}

function AssessTab() {
  const [form, setForm] = useState<AssessForm>(() => loadAssess())
  usePersist(STORE.assess, form)

  const set = <K extends keyof AssessForm>(k: K, v: AssessForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const result = useMemo(() => assessFeasibility(toInput(form)), [form])

  const updateCandidate = (id: string, patch: Partial<ResearcherCandidate>) =>
    setForm((f) => ({ ...f, candidates: f.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  const addCandidate = () => setForm((f) => ({ ...f, candidates: [...f.candidates, newCandidate()] }))
  const removeCandidate = (id: string) => setForm((f) => ({ ...f, candidates: f.candidates.filter((c) => c.id !== id) }))
  const toggleNegative = (n: FeasibilityInput['negativeActivities'][number]) =>
    setForm((f) => ({ ...f, negativeActivities: f.negativeActivities.includes(n) ? f.negativeActivities.filter((x) => x !== n) : [...f.negativeActivities, n] }))
  const reset = () => setForm({ ...EMPTY_ASSESS, candidates: [newCandidate()] })

  const pickedCategory = INDUSTRY_CATEGORIES.find((c) => c.label === form.industry)
  const isDept = form.desiredType === '연구개발전담부서'
  const verdictOf = (id: string) => result.candidates.find((c) => c.candidate.id === id)
  const summaryText = assessSummaryText(form, result)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* 입력 */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="t-section text-slate-900">입력</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" /> 다시 입력
          </Button>
        </div>

        <Surface className="flex flex-col gap-4">
          <CardTitle>① 기업 기본요건</CardTitle>
          <ChoiceGroup label="희망 설립 유형" value={form.desiredType} options={TYPE_OPTS} onChange={(v) => set('desiredType', v)} />
          <TextField label="기업명" value={form.companyName} onChange={(v) => set('companyName', v)} placeholder="상호 또는 법인명" />
          <fieldset className="min-w-0">
            <legend className="t-sub font-medium text-slate-600">업종 대분류</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {INDUSTRY_CATEGORIES.map((c) => {
                const on = form.industry === c.label
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, industry: c.label, industryField: c.field, isExcludedIndustry: false }))}
                    className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
              {EXCLUDED_INDUSTRIES.map((label) => {
                const on = form.industry === label
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, industry: label, isExcludedIndustry: true }))}
                    className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
                      on ? 'border-danger-700 bg-danger-700 text-white' : 'border-danger-200 bg-white text-danger-700 hover:bg-danger-50'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {pickedCategory?.hint && <p className="t-meta mt-1 break-keep text-slate-500">{pickedCategory.hint}</p>}
            {form.isExcludedIndustry && <p className="t-meta mt-1 break-keep text-danger-700">제외 업종으로 표시됩니다 — 주업종 분류를 다시 확인해 주세요.</p>}
          </fieldset>
          <TextField label="업종 직접 입력 (선택)" value={pickedCategory || EXCLUDED_INDUSTRIES.includes(form.industry) ? '' : form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v, isExcludedIndustry: false }))} placeholder="위 분류에 없으면 적습니다" />
          <ChoiceGroup label="업종 분야" value={form.industryField} options={FIELD_OPTS} onChange={(v) => set('industryField', v)} hint="연구전담요원 자격 예외(서비스·산업디자인) 판단에 씁니다" />
          <ChoiceGroup label="기업 규모" value={form.companySize} options={SIZE_OPTS} onChange={(v) => set('companySize', v)} />
          {form.companySize === '중기업' && <YesNo label="소기업에서 중기업이 된 지 1년 이내" value={form.becameMediumWithinYear} onChange={(v) => set('becameMediumWithinYear', v)} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField label="업력" value={form.years} onChange={(v) => set('years', v === '' ? 0 : v)} unit="년" step={0.5} hint="창업일부터 지금까지" />
            <NumField label="상시 근로자 수" value={form.employeeCount} onChange={(v) => set('employeeCount', v === '' ? 0 : v)} unit="명" />
          </div>
          <div className="flex flex-col gap-3">
            <YesNo label="벤처기업 확인서 보유" value={form.isVenture} onChange={(v) => set('isVenture', v)} hint="벤처·연구원창업은 연구소 전담요원 2명 기준" />
            <YesNo label="연구원·교원 창업기업" value={form.isResearcherFounded} onChange={(v) => set('isResearcherFounded', v)} />
            <YesNo label="해외소재 연구소로 검토" value={form.isOverseasLab} onChange={(v) => set('isOverseasLab', v)} />
          </div>
          <Disclosure title="신고대상 기업 확인" hint="영리기업 · 경영조직 · 하부조직 여부">
            <div className="flex flex-col gap-3">
              <YesNo label="영리활동을 하는 기업이다" value={form.isForProfit} onChange={(v) => set('isForProfit', v)} />
              <YesNo label="생산·판매·관리 등 경영 인력이 있다" value={form.hasBusinessOps} onChange={(v) => set('hasBusinessOps', v)} hint="연구원 외 대표만 있는 회사는 어렵습니다" />
              <YesNo label="연구개발활동만 수행하는 회사다" value={form.rndOnlyCompany} onChange={(v) => set('rndOnlyCompany', v)} />
              <YesNo label="연구소를 기업 내 하부조직으로 둔다" value={form.isSubUnit} onChange={(v) => set('isSubUnit', v)} />
            </div>
          </Disclosure>
        </Surface>

        <Surface className="flex flex-col gap-4">
          <CardTitle>② 연구개발활동 적합성</CardTitle>
          <TextField label="연구과제명 (가안)" value={form.projectName} onChange={(v) => set('projectName', v)} placeholder="예: 주문·재고 연동 자동화 개선" />
          <ChoiceGroup label="활동 성격" value={form.activityNature} options={NATURE_OPTS} onChange={(v) => set('activityNature', v)} />
          <YesNo label="사업화 이전 단계다" value={form.preCommercial} onChange={(v) => set('preCommercial', v)} hint="이미 양산·판매 중인 기술의 단순 운영은 제외" />
          <MultiChips label="해당하는 제외활동 (있으면 모두)" values={form.negativeActivities} options={NEGATIVE_OPTS} onToggle={toggleNegative} />
        </Surface>

        <Surface className="flex flex-col gap-4">
          <CardTitle>③ 물적요건</CardTitle>
          <YesNo label="연구공간이 있다" value={form.hasSpace} onChange={(v) => set('hasSpace', v)} />
          {form.hasSpace && (
            <div className="flex flex-col gap-3">
              <YesNo label={isDept ? '연구공간 또는 좌석이 구분된다' : '독립된 연구공간이다'} value={form.independentSpace} onChange={(v) => set('independentSpace', v)} />
              {!isDept && <YesNo label="고정벽체 + 별도 출입문이 있다" value={form.fixedWallsAndDoor} onChange={(v) => set('fixedWallsAndDoor', v)} />}
              {isDept && <YesNo label="분리·이동형 벽체(2m 이상) 적용 가능" value={form.movableWallPossible} onChange={(v) => set('movableWallPossible', v)} />}
              <YesNo label="연구공간 전용면적 50㎡ 이하" value={form.spaceUnder50} onChange={(v) => set('spaceUnder50', v)} hint="중소·벤처 등은 50㎡ 이하 칸막이 구분 예외가 있습니다" />
              <YesNo label="전담요원이 상시 근무 가능한 면적이다" value={form.adequateArea} onChange={(v) => set('adequateArea', v)} />
              <YesNo label="연구기자재가 연구공간 안에 있다" value={form.equipmentInSpace} onChange={(v) => set('equipmentInSpace', v)} />
              {isDept && <YesNo label="정보서비스·SW개발공급 업종이다" value={form.isInfoServiceOrSW} onChange={(v) => set('isInfoServiceOrSW', v)} />}
            </div>
          )}
          <Disclosure title="연구소 · 전담부서 물적요건 비교" hint="무엇이 다른지 한눈에">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="t-meta font-medium text-slate-500">기업부설연구소</span>
                <Bullets items={FACILITY_LAB} tone="muted" />
              </div>
              <div>
                <span className="t-meta font-medium text-slate-500">연구개발전담부서</span>
                <Bullets items={FACILITY_DEPT} tone="muted" />
              </div>
            </div>
          </Disclosure>
        </Surface>

        <Surface className="flex flex-col gap-4">
          <CardTitle badge={<Badge>{form.candidates.length}명</Badge>}>④ 연구전담요원 후보자</CardTitle>
          {form.candidates.map((c, i) => {
            const v = verdictOf(c.id)
            return (
              <div key={c.id} className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="t-body font-bold text-slate-900">후보 {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {v && <Badge tone={CAND_TONE[v.verdict]}>{CAND_LABEL[v.verdict]}</Badge>}
                    {form.candidates.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeCandidate(c.id)} aria-label={`후보 ${i + 1} 삭제`}>
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <TextField label="이름 (선택)" value={c.name} onChange={(v2) => updateCandidate(c.id, { name: v2 })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <YesNo label="대표자" value={c.isCeo} onChange={(v2) => updateCandidate(c.id, { isCeo: v2 })} />
                  <YesNo label="등기임원" value={c.isRegisteredExec} onChange={(v2) => updateCandidate(c.id, { isRegisteredExec: v2 })} />
                  <YesNo label="상근" value={c.fullTime} onChange={(v2) => updateCandidate(c.id, { fullTime: v2 })} />
                  <YesNo label="4대보험 가입(예정)" value={c.insured} onChange={(v2) => updateCandidate(c.id, { insured: v2 })} />
                  <YesNo label="연구업무 전담" value={c.researchDedicated} onChange={(v2) => updateCandidate(c.id, { researchDedicated: v2 })} />
                  <YesNo label="생산·판매·관리 겸직" value={c.hasOtherDuties} onChange={(v2) => updateCandidate(c.id, { hasOtherDuties: v2 })} />
                  <YesNo label="주간 일반대학원 재학" value={c.daytimeGradSchool} onChange={(v2) => updateCandidate(c.id, { daytimeGradSchool: v2 })} />
                </div>
                <ChoiceGroup label="최종 학력" value={c.education} options={EDU_OPTS} onChange={(v2) => updateCandidate(c.id, { education: v2 })} />
                <ChoiceGroup label="전공 계열" value={c.major} options={MAJOR_OPTS} onChange={(v2) => updateCandidate(c.id, { major: v2 })} />
                <ChoiceGroup label="국가기술자격" value={c.cert} options={CERT_OPTS} onChange={(v2) => updateCandidate(c.id, { cert: v2 })} />
                <NumField label="연구개발 경력" value={c.researchYears} onChange={(v2) => updateCandidate(c.id, { researchYears: v2 === '' ? 0 : v2 })} unit="년" step={0.5} />
                <TextField label="실제 담당할 연구업무" value={c.dutyDescription} onChange={(v2) => updateCandidate(c.id, { dutyDescription: v2 })} placeholder="예: 시제품 설계·시험 및 데이터 분석" />
                {v && <Bullets items={v.notes} tone="muted" />}
              </div>
            )
          })}
          <Button onClick={addCandidate} className="w-full sm:w-auto">
            <Plus aria-hidden="true" className="size-4" /> 후보 추가
          </Button>
        </Surface>
      </div>

      {/* 결과 */}
      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        <Surface edge={VERDICT_TONE[result.verdict]} showEdge className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-meta font-medium text-slate-500">현재 입력 기준 판정</span>
            <Badge tone={VERDICT_TONE[result.verdict]}>{result.verdict}</Badge>
          </div>
          <p className="t-card font-bold break-keep text-slate-900" data-testid="labcare-verdict">
            {result.summary}
          </p>
          <p className="t-sub break-keep text-slate-600">
            추천 추진 유형 <b className="text-slate-900">{result.recommendedType}</b>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <ToolResultAttach
              toolKey="labcare"
              title="설립 가능성 체크"
              verdict={result.verdict}
              verdictLabel={result.verdict}
              summary={summaryText}
              data={{ kind: 'assess', input: toInput(form) }}
            />
          </div>
        </Surface>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricTile label="연구소 기준 필요 인원" value={`${result.requiredForLab}명`} hint="시행령 제6조 인원 기준" />
          <MetricTile label="권장 경로 기준 필요" value={`${result.requiredResearchers}명`} hint={result.recommendedType} />
          <MetricTile label="인정 가능 후보" value={`${result.eligibleCount}명`} hint={`추가 확인 ${result.reviewCount}명`} />
          <MetricTile label="부족 인원" value={`${result.shortage}명`} tone={result.shortage > 0 ? 'warning' : 'neutral'} />
        </div>

        <Section title="항목별 검토">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {(
              [
                { title: '신고대상 기업', s: result.eligibility },
                { title: '연구개발활동', s: result.activity },
                { title: '물적요건', s: result.facility },
              ] as const
            ).map((row) => (
              <Surface key={row.title} edge={SECTION_TONE[row.s.verdict]} showEdge className="flex flex-col gap-2">
                <CardTitle badge={<Badge tone={SECTION_TONE[row.s.verdict]}>{row.s.verdict}</Badge>}>{row.title}</CardTitle>
                <Bullets items={row.s.notes} tone="muted" />
              </Surface>
            ))}
          </div>
        </Section>

        <Section title="후보자별 판정" count={result.candidates.length}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {result.candidates.map((c, i) => (
              <Surface key={c.candidate.id} edge={CAND_TONE[c.verdict]} showEdge className="flex flex-col gap-2">
                <CardTitle badge={<Badge tone={CAND_TONE[c.verdict]}>{CAND_LABEL[c.verdict]}</Badge>}>
                  {c.candidate.name.trim() || `후보 ${i + 1}`}
                  {c.candidate.isCeo && <span className="t-meta ml-1 font-normal text-slate-500">대표자</span>}
                </CardTitle>
                <p className="t-meta text-slate-500">
                  {c.candidate.education} · {c.candidate.major} · {c.candidate.cert === '없음' ? '자격증 없음' : c.candidate.cert} · 경력 {c.candidate.researchYears}년
                </p>
                <Bullets items={c.notes} tone="muted" />
              </Surface>
            ))}
          </div>
        </Section>

        <Surface edge={CEO_TONE[result.ceo.verdict]} showEdge className="flex flex-col gap-2">
          <CardTitle badge={<Badge tone={CEO_TONE[result.ceo.verdict]}>{result.ceo.verdict}</Badge>}>대표자 연구전담요원 포함 가능성</CardTitle>
          <p className="t-sub break-keep text-slate-700">{result.ceo.basis}</p>
          <Bullets items={result.ceo.cautions} tone="muted" />
          {result.ceo.threeYearNote && <p className="t-meta break-keep text-slate-500">{result.ceo.threeYearNote}</p>}
        </Surface>

        {result.improvements.length > 0 && (
          <Section title="보완해야 할 항목" count={result.improvements.length}>
            <Surface>
              <Bullets items={result.improvements} />
            </Surface>
          </Section>
        )}

        <Section title="추천 진행 전략">
          <Surface>
            <Bullets items={result.strategy} />
          </Surface>
        </Section>

        <Disclosure title="요약 미리보기 (업체 기록에 붙는 글)">
          <pre className="t-sub whitespace-pre-wrap break-keep text-slate-600">{summaryText}</pre>
        </Disclosure>
      </div>
    </div>
  )
}

/* ═════════════════ ② 설립서류 체크리스트 ═════════════════ */

interface DocsState {
  client: DocClient
  statuses: Record<string, DocStatus>
}

const EMPTY_DOCS: DocsState = {
  client: { id: 'labcare-docs', name: '', labType: '기업부설연구소', businessType: '법인사업자', industry: '', employeeCount: 10, researcherCount: 3 },
  statuses: {},
}

function loadDocs(): DocsState {
  const saved = readStore<DocsState>(STORE.docs, EMPTY_DOCS)
  return { client: { ...EMPTY_DOCS.client, ...(saved.client ?? {}) }, statuses: saved.statuses && typeof saved.statuses === 'object' ? saved.statuses : {} }
}

function buildDocs(state: DocsState): SetupDoc[] {
  return DOC_MASTER.map((m) => ({
    key: m.key,
    label: m.label,
    group: m.group,
    cls: m.cls,
    tip: m.tip,
    collapsed: m.collapsed,
    promptKey: m.promptKey,
    checklist: m.checklist,
    status: state.statuses[m.key] ?? (m.na?.(state.client) ? '해당 없음' : '준비중'),
  }))
}

function DocRow({ doc, onChange }: { doc: SetupDoc; onChange: (s: DocStatus) => void }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`t-body font-medium break-keep ${doc.status === '해당 없음' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{doc.label}</span>
          <Badge>{doc.cls}</Badge>
          {doc.status === '고객 요청중' && <Badge tone="warning">고객 회신 대기</Badge>}
        </div>
        <p className="t-meta mt-0.5 break-keep text-slate-500">{doc.tip}</p>
        {doc.checklist && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {doc.checklist.map((c) => (
              <li key={c} className="t-meta rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
      <select aria-label={`${doc.label} 상태`} value={doc.status} onChange={(e) => onChange(e.target.value as DocStatus)} className={`${inputCls} sm:w-36`}>
        {DOC_STATUS_OPTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </li>
  )
}

function DocsTab() {
  const [state, setState] = useState<DocsState>(() => loadDocs())
  usePersist(STORE.docs, state)

  const setClient = <K extends keyof DocClient>(k: K, v: DocClient[K]) => setState((s) => ({ ...s, client: { ...s.client, [k]: v } }))
  const setStatus = (key: string, status: DocStatus) => setState((s) => ({ ...s, statuses: { ...s.statuses, [key]: status } }))
  const reset = () => setState({ ...EMPTY_DOCS, statuses: {} })

  const docs = useMemo(() => buildDocs(state), [state])
  const progress = docProgressOf(docs)
  const pkg: SetupPackage = { id: 'labcare-docs', clientId: state.client.id, clientName: state.client.name, labType: state.client.labType, stage: stageOf(progress), docs }
  const missing = missingDocs(pkg)
  const doneCount = docs.filter((d) => d.status === '완료').length
  const applicable = docs.filter((d) => d.status !== '해당 없음').length

  return (
    <div className="flex flex-col gap-4">
      <Surface className="flex flex-col gap-4">
        <CardTitle badge={<Badge tone={progress >= 100 ? 'success' : 'brand'}>{pkg.stage}</Badge>}>어느 업체의 서류인가요</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="업체명" value={state.client.name} onChange={(v) => setClient('name', v)} />
          <TextField label="업종 (선택)" value={state.client.industry ?? ''} onChange={(v) => setClient('industry', v)} />
          <NumField label="상시 근로자 수" value={state.client.employeeCount ?? ''} onChange={(v) => setClient('employeeCount', v === '' ? undefined : v)} unit="명" />
          <NumField label="연구전담요원 + 연구보조원 수" value={state.client.researcherCount ?? ''} onChange={(v) => setClient('researcherCount', v === '' ? undefined : v)} unit="명" hint="10명 이상이면 안전관리비·보험 서류가 해당됩니다" />
        </div>
        <ChoiceGroup label="설립 유형" value={state.client.labType} options={['기업부설연구소', '연구개발전담부서'] as const satisfies readonly LabType[]} onChange={(v) => setClient('labType', v)} />
        <ChoiceGroup label="사업자 유형" value={state.client.businessType ?? ''} options={['법인사업자', '개인사업자'] as const} onChange={(v) => setClient('businessType', v)} />
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="t-sub font-medium text-slate-700">전체 준비율</span>
              <span className="t-sub tabular-nums text-slate-700">
                {progress}% · {doneCount}/{applicable}
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={progress} tone={progress >= 100 ? 'success' : 'brand'} />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" /> 처음부터
          </Button>
        </div>
      </Surface>

      {missing.length > 0 && (
        <Surface edge="warning" showEdge className="flex flex-col gap-2">
          <CardTitle badge={<Badge tone="warning">{missing.length}건</Badge>}>고객 회신을 기다리는 서류</CardTitle>
          <Bullets items={missing.map((d) => d.label)} tone="muted" />
          <p className="t-meta break-keep text-slate-400">필수·요청시·해당시 항목 중 '고객 요청중' 인 것만 셉니다 (작성보조 제외).</p>
        </Surface>
      )}

      {SETUP_GROUPS.map((g) => {
        const rows = docs.filter((d) => d.group === g.id)
        const open = rows.filter((d) => !d.collapsed)
        const folded = rows.filter((d) => d.collapsed)
        const gp = groupProgress(pkg, g.id)
        return (
          <Section key={g.id} title={g.title}>
            <Surface className="flex flex-col gap-2">
              <p className="t-sub break-keep text-slate-500">{g.desc}</p>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <ProgressBar value={gp} tone={gp >= 100 ? 'success' : 'brand'} />
                </div>
                <span className="t-meta shrink-0 tabular-nums text-slate-600">{gp}%</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {open.map((d) => (
                  <DocRow key={d.key} doc={d} onChange={(s) => setStatus(d.key, s)} />
                ))}
              </ul>
              {folded.length > 0 && (
                <Disclosure title="잘 쓰이지 않는 항목" hint={`${folded.length}개 — 요청받거나 해당될 때 펼칩니다`}>
                  <ul className="divide-y divide-slate-100">
                    {folded.map((d) => (
                      <DocRow key={d.key} doc={d} onChange={(s) => setStatus(d.key, s)} />
                    ))}
                  </ul>
                </Disclosure>
              )}
            </Surface>
          </Section>
        )
      })}
    </div>
  )
}

/* ═════════════════ ③ 월간 사후관리 점검 ═════════════════ */

type BoolKey = Exclude<keyof CheckAnswers, 'memo' | 'personnelChangeType'>

const QUESTIONS: { key: BoolKey; label: string; hint: string; yes: string; no: string }[] = [
  { key: 'personnelChange', label: '연구전담요원 입사·퇴사·부서이동이 있었나요', hint: '인원 요건과 변경신고 검토가 함께 필요한 사안', yes: '있음', no: '없음' },
  { key: 'spaceChange', label: '연구소 전용공간(면적·위치)이 바뀌었나요', hint: '독립공간 요건 유지 확인', yes: '있음', no: '없음' },
  { key: 'registrationChange', label: '상호·대표자·주소 등 인정사항이 바뀌었나요', hint: '기한 안에 변경신고 검토', yes: '있음', no: '없음' },
  { key: 'projectOngoing', label: '연구과제가 진행 중인가요', hint: '진행 중인 과제가 없으면 활동의 실체 설명이 어렵습니다', yes: '진행 중', no: '공백' },
  { key: 'researchNotesWritten', label: '이번 달 연구노트를 작성했나요', hint: '세액공제·인정 유지의 핵심 증빙', yes: '작성함', no: '미작성' },
  { key: 'expenseEvidenceOrganized', label: '연구개발비 증빙을 정리했나요', hint: '급여대장·세금계산서 등 항목별 증빙', yes: '정리함', no: '미정리' },
  { key: 'taxDocsPrepared', label: '세무사 전달자료를 준비했나요', hint: '연구개발비 명세·증빙', yes: '준비함', no: '미준비' },
  { key: 'surveyResponseNeeded', label: '연구개발활동조사 대응이 필요한가요', hint: '매년 4월 30일 제출', yes: '필요', no: '해당 없음' },
]
const PCHANGE_TYPES: PersonnelChangeType[] = ['입사', '퇴사', '부서이동']

function checkSummaryText(a: CheckAnswers): string {
  const r = evaluateRisk(a)
  const meta = LEVEL_META[r.level]
  const lines = [`[월간 사후관리 점검] 등급: ${r.level}`, meta.headline, meta.customerMessage, `요약: ${riskSummary(a)}`]
  const urgent = urgentReason(a)
  if (urgent) lines.push(urgent)
  if (r.factors.length) lines.push('', '확인 항목', ...r.factors.map((f) => `- ${f.label}`))
  if (a.memo.trim()) lines.push('', `특이사항: ${a.memo.trim()}`)
  return lines.join('\n')
}

function CheckTab() {
  const [answers, setAnswers] = useState<CheckAnswers>(() => readStore<CheckAnswers>(STORE.check, DEFAULT_ANSWERS))
  usePersist(STORE.check, answers)
  const set = <K extends keyof CheckAnswers>(k: K, v: CheckAnswers[K]) => setAnswers((a) => ({ ...a, [k]: v }))

  const result = useMemo(() => evaluateRisk(answers), [answers])
  const meta = LEVEL_META[result.level]
  const tone = LEVEL_TONE[meta.tone]
  const urgent = urgentReason(answers)
  const summaryText = checkSummaryText(answers)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-4">
        <CardTitle
          badge={
            <Button variant="ghost" size="sm" onClick={() => setAnswers(DEFAULT_ANSWERS)}>
              <RotateCcw aria-hidden="true" className="size-4" /> 초기화
            </Button>
          }
        >
          이번 달 9가지 확인
        </CardTitle>
        {QUESTIONS.map((q, i) => (
          <div key={q.key} className="flex flex-col gap-2 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
            <YesNo label={`${i + 1}. ${q.label}`} hint={q.hint} value={answers[q.key]} onChange={(v) => set(q.key, v)} yes={q.yes} no={q.no} />
            {q.key === 'personnelChange' && answers.personnelChange && (
              <ChoiceGroup label="변동 유형" value={answers.personnelChangeType ?? ''} options={PCHANGE_TYPES} onChange={(v) => set('personnelChangeType', v)} />
            )}
          </div>
        ))}
        <label className="block min-w-0 border-t border-slate-100 pt-3">
          <span className="t-sub font-medium text-slate-600">9. 특이사항 메모</span>
          <textarea aria-label="특이사항 메모" value={answers.memo} onChange={(e) => set('memo', e.target.value)} rows={3} className={`mt-1 ${inputCls}`} placeholder="고객이 말한 것, 다음 달에 볼 것" />
        </label>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        <Surface edge={tone} showEdge className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-meta font-medium text-slate-500">이번 달 등급</span>
            <Badge tone={tone}>{result.level}</Badge>
          </div>
          <p className="t-card font-bold break-keep text-slate-900" data-testid="labcare-level">
            {meta.headline}
          </p>
          <p className="t-sub break-keep text-slate-600">{meta.customerMessage}</p>
          <p className="t-sub break-keep text-slate-700">
            요약 <b className="text-slate-900">{riskSummary(answers)}</b>
          </p>
          {urgent && <p className="t-sub break-keep text-danger-700">{urgent}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <ToolResultAttach toolKey="labcare" title="월간 사후관리 점검" verdict={result.level} verdictLabel={result.level} summary={summaryText} data={{ kind: 'check', answers }} />
          </div>
        </Surface>

        <Section title="확인이 필요한 항목" count={result.factors.length}>
          {result.factors.length === 0 ? (
            <Surface>
              <p className="t-sub break-keep text-slate-500">이번 달은 특이 리스크가 없습니다. 지금의 관리 수준을 이어가시면 됩니다.</p>
            </Surface>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {result.factors.map((f) => (
                <Surface key={f.key} edge={SEVERITY_TONE[f.severity]} showEdge className="flex flex-col gap-2">
                  <CardTitle badge={<Badge tone={SEVERITY_TONE[f.severity]}>영향 {SEVERITY_LABEL[f.severity]}</Badge>}>{f.label}</CardTitle>
                  <p className="t-sub break-keep text-slate-600">{f.detail}</p>
                  <div className="border-t border-slate-100 pt-2">
                    <span className="t-meta font-medium text-slate-500">권장 조치</span>
                    <p className="t-sub break-keep text-slate-700">{f.action}</p>
                  </div>
                </Surface>
              ))}
            </div>
          )}
        </Section>

        <Disclosure title="요약 미리보기 (업체 기록에 붙는 글)">
          <pre className="t-sub whitespace-pre-wrap break-keep text-slate-600">{summaryText}</pre>
        </Disclosure>
      </div>
    </div>
  )
}

/* ═════════════════ ④ 세액공제 예상 ═════════════════ */

interface TaxForm {
  payroll: number | ''
  material: number | ''
  other: number | ''
  currentYearRndCost: number | ''
  category: NonNullable<Client['taxCreditCategory']>
  businessType: NonNullable<Client['businessType']>
  rate: number | ''
  benefitKeys: string[]
}

const EMPTY_TAX: TaxForm = { payroll: '', material: '', other: '', currentYearRndCost: '', category: '미정', businessType: '법인사업자', rate: '', benefitKeys: [] }
const TAX_CATEGORIES: TaxForm['category'][] = ['일반 R&D', '신성장·원천기술', '국가전략기술', '미정']

function taxClientOf(f: TaxForm): Client {
  return {
    id: 'labcare-tax',
    name: '',
    industry: '',
    labType: '기업부설연구소',
    ceoName: '',
    address: '',
    certifiedDate: '',
    researcherCount: 0,
    labName: '',
    consultant: '',
    createdAt: '',
    businessType: f.businessType,
    researchersPayrollTotal: f.payroll === '' ? undefined : f.payroll,
    rndMaterialCost: f.material === '' ? undefined : f.material,
    rndOtherCost: f.other === '' ? undefined : f.other,
    currentYearRndCost: f.currentYearRndCost === '' ? undefined : f.currentYearRndCost,
    taxCreditCategory: f.category,
    estimatedTaxCreditRate: f.rate === '' ? undefined : f.rate,
  }
}

function TaxTab() {
  const [form, setForm] = useState<TaxForm>(() => {
    const s = readStore<TaxForm>(STORE.tax, EMPTY_TAX)
    return { ...s, benefitKeys: Array.isArray(s.benefitKeys) ? s.benefitKeys : [] }
  })
  usePersist(STORE.tax, form)
  const copyState = useCopy()
  const set = <K extends keyof TaxForm>(k: K, v: TaxForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleBenefit = (key: string) => setForm((f) => ({ ...f, benefitKeys: f.benefitKeys.includes(key) ? f.benefitKeys.filter((k) => k !== key) : [...f.benefitKeys, key] }))

  const est = useMemo(() => getTaxCreditEstimate(taxClientOf(form)), [form])
  const benefitText = composeBenefitText(form.benefitKeys)
  const summaryText = [
    `[연구개발비 세액공제 예상] ${est.category} · ${est.taxType} · 적용률 ${est.rate}% (예시)`,
    `당해연도 연구개발비 ${formatKRW(est.totalRnd)} → 연간 예상 ${formatKRW(est.annual)} (월 ${formatManwon(est.monthly)} · 일 ${formatManwon(est.daily)})`,
    ...est.assumptions.map((a) => `- ${a}`),
    ...(benefitText ? ['', '추가 검토 가능 영역', benefitText] : []),
    '',
    '※ 예상치입니다. 실제 공제 여부와 금액은 연구개발비 범위·구분경리·세무조정에 따라 달라지며 세무 대리인 검토가 필요합니다.',
  ].join('\n')

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Surface className="flex flex-col gap-4">
        <CardTitle>연구개발비 입력 (연간 · 원)</CardTitle>
        <NumField label="연구전담요원 인건비 합계" value={form.payroll} onChange={(v) => set('payroll', v)} unit="원" step={100000} />
        <NumField label="연구 재료비·시약·부품비" value={form.material} onChange={(v) => set('material', v)} unit="원" step={100000} />
        <NumField label="기타 연구개발비" value={form.other} onChange={(v) => set('other', v)} unit="원" step={100000} />
        <NumField label="당해연도 연구개발비 합계 (직접 입력 시 위 세 칸 대신 씀)" value={form.currentYearRndCost} onChange={(v) => set('currentYearRndCost', v)} unit="원" step={100000} />
        <ChoiceGroup label="공제 유형" value={form.category} options={TAX_CATEGORIES} onChange={(v) => set('category', v)} labelOf={(v) => `${v} (${CATEGORY_RATES[v]}%)`} hint="유형별 예시 공제율 — 별표 해당 여부·구분경리 요건은 별도 검토" />
        <ChoiceGroup label="사업자 유형" value={form.businessType} options={['법인사업자', '개인사업자'] as const} onChange={(v) => set('businessType', v)} hint="법인세 / 종합소득세 구분" />
        <NumField label="예상 공제율 직접 지정 (선택)" value={form.rate} onChange={(v) => set('rate', v)} unit="%" hint="비우면 공제 유형 기본값" />
        <Button variant="ghost" size="sm" onClick={() => setForm(EMPTY_TAX)} className="self-start">
          <RotateCcw aria-hidden="true" className="size-4" /> 다시 입력
        </Button>
      </Surface>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
        {!est.available ? (
          <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="t-card font-bold text-slate-700">연구개발비를 적으면 예상 절세 규모가 나옵니다</span>
            <span className="t-sub break-keep text-slate-500">인건비·재료비·기타 중 하나만 있어도 계산합니다. 확정 금액이 아닌 검토용 예상치입니다.</span>
          </Surface>
        ) : (
          <>
            <Surface edge="brand" showEdge className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-meta font-medium text-slate-500">요건 충족 시 예상</span>
                <Badge tone="brand">{est.category}</Badge>
                <Badge>{est.taxType}</Badge>
                <Badge>적용률 {est.rate}%</Badge>
              </div>
              <p className="t-card font-bold break-keep text-slate-900">연간 약 {formatManwon(est.annual)} 절세 검토 가능성</p>
              <p className="t-sub break-keep text-slate-600">당해연도 연구개발비 {formatKRW(est.totalRnd)} × {est.rate}% — 실제 적용은 연구개발비 범위·구분경리·세무조정에 따라 달라집니다.</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <ToolResultAttach toolKey="labcare" title="세액공제 예상" verdict={null} verdictLabel={`연간 약 ${formatManwon(est.annual)}`} summary={summaryText} data={{ kind: 'tax', form, estimate: est }} />
              </div>
            </Surface>
            <div className="grid grid-cols-3 gap-2.5">
              <MetricTile label="연간" value={formatManwon(est.annual)} hint={formatKRW(est.annual)} />
              <MetricTile label="월 환산" value={formatManwon(est.monthly)} hint={formatKRW(est.monthly)} />
              <MetricTile label="일 환산" value={formatManwon(est.daily)} hint={formatKRW(est.daily)} />
            </div>
            <Surface padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left">
                  <tbody className="divide-y divide-slate-100">
                    {(
                      [
                        ['인건비', est.payroll],
                        ['재료비', est.material],
                        ['기타', est.other],
                        ['당해연도 연구개발비 합계', est.totalRnd],
                      ] as const
                    ).map(([k, v]) => (
                      <tr key={k}>
                        <th scope="row" className="t-sub px-4 py-2.5 font-medium break-keep text-slate-600">{k}</th>
                        <td className="t-sub px-4 py-2.5 text-right tabular-nums text-slate-900">{formatKRW(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
            <Section title="적용 가정">
              <Surface>
                <Bullets items={est.assumptions} tone="muted" />
              </Surface>
            </Section>
          </>
        )}

        <Section title="추가 혜택 검토 빌더">
          <Surface className="flex flex-col gap-3">
            <p className="t-sub break-keep text-slate-500">리포트에 덧붙일 검토 영역을 고르면 문장이 만들어집니다. '검토 가능성' 톤을 유지합니다.</p>
            <div className="flex flex-wrap gap-1.5">
              {BENEFIT_OPTIONS.map((o) => {
                const on = form.benefitKeys.includes(o.key)
                return (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleBenefit(o.key)}
                    className={`tap rounded-(--radius-control) border px-3 py-2 t-sub font-medium break-keep ${
                      on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {on && <Check aria-hidden="true" className="mr-1 inline size-3.5" />}
                    {o.label}
                  </button>
                )
              })}
            </div>
            {benefitText ? (
              <>
                <pre className="t-sub whitespace-pre-wrap break-keep rounded-(--radius-control) bg-slate-50 p-3 text-slate-700">{benefitText}</pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton id="benefit" text={benefitText} label="문장 복사" copyState={copyState} />
                </div>
                <CopyFallback id="benefit" text={benefitText} copyState={copyState} />
              </>
            ) : (
              <p className="t-meta text-slate-400">아직 고른 항목이 없습니다.</p>
            )}
          </Surface>
        </Section>
      </div>
    </div>
  )
}

/* ═════════════════ ⑤ 변경신고 D-day ═════════════════ */

interface ChangesState {
  records: ChangeRecord[]
  reminder: { cycleMonths: number; lastCheck: string }
  inspection: Record<string, boolean>
}

function emptyChanges(): ChangesState {
  return { records: [], reminder: { cycleMonths: 1, lastCheck: ymdLocal(new Date()) }, inspection: {} }
}

function loadChanges(): ChangesState {
  const base = emptyChanges()
  const s = readStore<ChangesState>(STORE.changes, base)
  return {
    records: Array.isArray(s.records) ? s.records : [],
    reminder: { ...base.reminder, ...(s.reminder ?? {}) },
    inspection: s.inspection && typeof s.inspection === 'object' ? s.inspection : {},
  }
}

function ChangesTab() {
  const [state, setState] = useState<ChangesState>(() => loadChanges())
  usePersist(STORE.changes, state)
  const copyState = useCopy()

  const [pickReasons, setPickReasons] = useState<string[]>([])
  const [occurred, setOccurred] = useState(() => ymdLocal(new Date()))
  const [memo, setMemo] = useState('')

  const previewDeadline = occurred ? changeDeadlineOf(occurred) : ''
  const previewDday = previewDeadline ? ddayOf(previewDeadline) : null
  const canAdd = occurred !== '' && (pickReasons.length > 0 || memo.trim() !== '')

  const addRecord = () => {
    if (!canAdd) return
    const rec: ChangeRecord = {
      id: `cr-${Date.now()}`,
      reasons: pickReasons,
      memo: memo.trim(),
      status: '확인 필요',
      occurredDate: occurred,
      deadline: changeDeadlineOf(occurred),
    }
    setState((s) => ({ ...s, records: [...s.records, rec] }))
    setPickReasons([])
    setMemo('')
  }
  const updateRecord = (id: string, patch: Partial<ChangeRecord>) => setState((s) => ({ ...s, records: s.records.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)) }))
  const deleteRecord = (id: string) => setState((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }))

  const reminder = { clientId: 'labcare', ...state.reminder }
  const nextDate = nextCheckDate(reminder)
  const due = isCheckDue(reminder)
  const season = isSurveySeason()
  const requestText = useMemo(() => defaultRequestText(), [])

  const sorted = [...state.records].sort((a, b) => a.deadline.localeCompare(b.deadline))
  const openCount = sorted.filter((r) => r.status !== '신고 완료').length
  // 업체 달력에 심을 기한 (D-89)
  const deadlines = useMemo(() => changeDeadlines(sorted, new Date()), [sorted])
  const deadlineSummary = [
    '[기업부설연구소 기한 안내]',
    ...deadlines.map((d) => `· ${d.date.replace(/-/g, '.')} — ${d.title}${d.note ? ` (${d.note})` : ''}`),
    '',
    '변경신고는 사유 발생일부터 30일 이내입니다. 기한을 넘기면 인정취소 사유가 될 수 있습니다.',
  ].join('\n')
  const toggleInspection = (key: string) => setState((s) => ({ ...s, inspection: { ...s.inspection, [key]: !s.inspection[key] } }))
  const inspectionDone = INSPECTION_ITEMS.filter((i) => state.inspection[i.key]).length

  return (
    <div className="flex flex-col gap-4">
      <Surface edge={season ? 'warning' : 'neutral'} showEdge={season} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-card font-bold text-slate-900">연구개발활동조사</span>
          <Badge tone={season ? 'warning' : 'neutral'}>{season ? '제출 시즌 (1~4월)' : '시즌 아님'}</Badge>
        </div>
        <p className="t-sub break-keep text-slate-600">
          다음 제출 마감 <b className="text-slate-900">{surveyDeadlineLabel()}</b> — 연구소 보유 기업은 매년 4월 30일까지 연구개발활동조사표를 제출합니다. 미제출은 인정취소 사유가 될 수 있습니다.
        </p>
        {/* 기한을 업체 달력으로 보낸다 (D-89) — 아직 신고 안 한 변경건 + 다음 활동조사 마감 */}
        <div className="flex flex-wrap gap-2">
          <ToolResultAttach
            toolKey="labcare"
            title="연구소 기한"
            verdict={null}
            verdictLabel={openCount > 0 ? `변경신고 ${openCount}건 · 활동조사 ${surveyDeadlineLabel()}` : `활동조사 ${surveyDeadlineLabel()}`}
            summary={deadlineSummary}
            data={{ kind: 'deadlines', records: sorted }}
            deadlines={deadlines}
          />
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Surface className="flex flex-col gap-4">
          <CardTitle>변경사유 기록</CardTitle>
          <MultiChips label="변경 사유 (해당하는 것 모두)" values={pickReasons} options={REASONS} onToggle={(r) => setPickReasons((arr) => (arr.includes(r) ? arr.filter((x) => x !== r) : [...arr, r]))} />
          <DateField label="발생일" value={occurred} onChange={setOccurred} hint="기한은 발생일 + 30일로 계산합니다" />
          <TextField label="메모 (선택)" value={memo} onChange={setMemo} placeholder="누가 · 무엇이 · 어떻게" />
          {previewDday && (
            <p className="t-sub break-keep text-slate-600">
              신고기한 <b className="text-slate-900">{previewDeadline.replace(/-/g, '.')}</b> <Badge tone={DDAY_TONE[previewDday.tone]}>{previewDday.label}</Badge>
            </p>
          )}
          <Button variant="primary" disabled={!canAdd} onClick={addRecord} className="w-full sm:w-auto">
            <Plus aria-hidden="true" className="size-4" /> 기록 추가
          </Button>
        </Surface>

        <Section title="변경신고 기한" count={openCount}>
          {sorted.length === 0 ? (
            <Surface>
              <p className="t-sub break-keep text-slate-500">아직 기록이 없습니다. 왼쪽에서 사유와 발생일을 적으면 D-day 가 붙습니다.</p>
            </Surface>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((r) => {
                const d = ddayOf(r.deadline)
                const done = r.status === '신고 완료'
                return (
                  <Surface key={r.id} edge={done ? 'success' : DDAY_TONE[d.tone]} showEdge={!done && d.tone !== 'ok'} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="t-card font-bold break-keep text-slate-900">{r.reasons[0] ?? r.memo ?? '변경사항'}</span>
                        {r.reasons.length > 1 && <Badge>+{r.reasons.length - 1}</Badge>}
                        {done ? <Badge tone="success">신고 완료</Badge> : <Badge tone={DDAY_TONE[d.tone]}>{d.label}</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteRecord(r.id)} aria-label="기록 삭제">
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                    <p className="t-sub break-keep text-slate-600">
                      발생 {r.occurredDate.replace(/-/g, '.')} → 기한 <b className="text-slate-900">{r.deadline.replace(/-/g, '.')}</b>
                      {r.reasons.length > 1 && <span className="text-slate-500"> · {r.reasons.join(', ')}</span>}
                    </p>
                    {r.memo && <p className="t-meta break-keep text-slate-500">{r.memo}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <select aria-label="처리 상태" value={r.status} onChange={(e) => updateRecord(r.id, { status: e.target.value as ChangeRecStatus })} className={`${inputCls} sm:w-40`}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Badge tone={STATUS_TONE[r.status]}>화면 표시: {mapChangeStatus(r.status)}</Badge>
                    </div>
                  </Surface>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      <Surface className="flex flex-col gap-3">
        <CardTitle badge={<Badge tone={due ? 'warning' : 'neutral'}>{due ? '확인 주기 도래' : `다음 ${nextDate.replace(/-/g, '.')}`}</Badge>}>정기 확인 주기</CardTitle>
        <ChoiceGroup
          label="확인 주기"
          value={String(state.reminder.cycleMonths)}
          options={CYCLES.map((c) => String(c.m))}
          onChange={(v) => setState((s) => ({ ...s, reminder: { ...s.reminder, cycleMonths: Number(v) } }))}
          labelOf={(v) => `${v}개월`}
          hint={CYCLES.find((c) => c.m === state.reminder.cycleMonths)?.desc}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <DateField label="마지막 확인일" value={state.reminder.lastCheck} onChange={(v) => setState((s) => ({ ...s, reminder: { ...s.reminder, lastCheck: v } }))} hint="다음 예정일은 (마지막 확인 + 주기)가 속한 달의 말일" />
          </div>
          <Button size="sm" onClick={() => setState((s) => ({ ...s, reminder: { ...s.reminder, lastCheck: ymdLocal(new Date()) } }))}>
            <Check aria-hidden="true" className="size-4" /> 오늘 확인함
          </Button>
        </div>
      </Surface>

      <Section title="현장조사 대비 체크" count={INSPECTION_ITEMS.length}>
        <Surface className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ProgressBar value={Math.round((inspectionDone / INSPECTION_ITEMS.length) * 100)} tone={inspectionDone === INSPECTION_ITEMS.length ? 'success' : 'brand'} />
            </div>
            <span className="t-meta shrink-0 tabular-nums text-slate-600">
              {inspectionDone}/{INSPECTION_ITEMS.length}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {INSPECTION_POINTS.map((p) => {
              const items = INSPECTION_ITEMS.filter((i) => i.point === p.id)
              const done = items.filter((i) => state.inspection[i.key]).length
              return (
                <div key={p.id} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-body font-bold text-slate-900">
                      <span aria-hidden="true">{p.icon}</span> {p.title}
                    </span>
                    <span className="t-meta tabular-nums text-slate-500">
                      {done}/{items.length}
                    </span>
                  </div>
                  <p className="t-meta break-keep text-slate-500">{p.desc}</p>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((i) => (
                      <li key={i.key}>
                        <label className="tap flex cursor-pointer items-start gap-2">
                          <input type="checkbox" checked={Boolean(state.inspection[i.key])} onChange={() => toggleInspection(i.key)} className="mt-1 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className={`t-sub block break-keep ${i.emphasis ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                              {i.label}
                              {i.emphasis && <Badge tone="danger" className="ml-1">핵심</Badge>}
                            </span>
                            <span className="t-meta block break-keep text-slate-400">{i.hint}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </Surface>
      </Section>

      <Disclosure title="변경사항 확인 요청문" hint="매달 고객에게 보내는 기본 안내 — 복사해서 씁니다">
        <div className="flex flex-col gap-2">
          <pre className="t-sub whitespace-pre-wrap break-keep text-slate-700">{requestText}</pre>
          <div className="flex flex-wrap gap-2">
            <CopyButton id="request" text={requestText} copyState={copyState} />
          </div>
          <CopyFallback id="request" text={requestText} copyState={copyState} />
        </div>
      </Disclosure>
    </div>
  )
}

/* ═════════════════ ⑥ 안내문 11종 ═════════════════ */

interface TemplatesState {
  고객사명: string
  월: string
  기한: string
}

function defaultMonthLabel(): string {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

function TemplatesTab() {
  const [vars, setVars] = useState<TemplatesState>(() => readStore<TemplatesState>(STORE.templates, { 고객사명: '', 월: defaultMonthLabel(), 기한: '' }))
  usePersist(STORE.templates, vars)
  const [category, setCategory] = useState<'전체' | ResourceCategory>('전체')
  const copyState = useCopy()

  const list = category === '전체' ? RESOURCE_TEMPLATES : RESOURCE_TEMPLATES.filter((t) => t.category === category)
  const missing = (['고객사명', '월', '기한'] as const).filter((k) => !vars[k].trim())

  return (
    <div className="flex flex-col gap-4">
      <Surface className="flex flex-col gap-4">
        <CardTitle>자리표시자 채우기</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="{고객사명}" value={vars.고객사명} onChange={(v) => setVars((s) => ({ ...s, 고객사명: v }))} placeholder="예: 미래산업" />
          <TextField label="{월}" value={vars.월} onChange={(v) => setVars((s) => ({ ...s, 월: v }))} placeholder="예: 2026년 9월" />
          <TextField label="{기한}" value={vars.기한} onChange={(v) => setVars((s) => ({ ...s, 기한: v }))} placeholder="예: 9월 25일(금)" />
        </div>
        <p className="t-meta break-keep text-slate-400">
          {missing.length ? `비워 둔 ${missing.map((m) => `{${m}}`).join(' · ')} 은 본문에 그대로 남아 어디를 채워야 하는지 보입니다.` : '세 자리 모두 채워졌습니다.'}
        </p>
        <ChoiceGroup label="분류" value={category} options={['전체', ...RESOURCE_CATEGORIES] as const} onChange={setCategory} />
      </Surface>

      <div className="grid gap-2.5 lg:grid-cols-2">
        {list.map((t) => {
          const text = fillTemplate(t.body, vars)
          return (
            <Surface key={t.id} className="flex flex-col gap-2">
              <CardTitle badge={<Badge>{t.category}</Badge>}>
                <span aria-hidden="true">{t.icon}</span> {t.title}
              </CardTitle>
              <p className="t-meta break-keep text-slate-500">{t.desc}</p>
              <p className="t-sub break-keep whitespace-pre-wrap rounded-(--radius-control) bg-slate-50 p-3 text-slate-700">{text}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton id={t.id} text={text} copyState={copyState} />
              </div>
              <CopyFallback id={t.id} text={text} copyState={copyState} />
            </Surface>
          )
        })}
      </div>
    </div>
  )
}
