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
import { Check, Copy, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { OrigLabcare } from './orig/OrigLabcare'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile, Section, Surface } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import type { Client } from './types'
import { CATEGORY_RATES, formatKRW, formatManwon, getTaxCreditEstimate } from './lib/taxCredit'
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

const DISCLAIMER =
  '이 화면의 결론은 현재 입력 기준 1차 검토입니다. 인정 여부는 신고 기관(KOITA) 의 심사와 증빙자료로 결정되며, 세액공제·감면은 세무 대리인의 최종 검토가 필요합니다. 모든 기록은 실제 활동에 기반해야 하며 허위 작성은 금지됩니다.'

/* ───────────────── 색 매핑 (판정 → OS 색) ───────────────── */

/* ───────────────── 탭 ───────────────── */

/** 목차에서 고른 화면 → 이 자리에 선다. 목차 자체는 `toolRegistry` 의 sections 가 정한다.
 *  세액공제만 이 OS 의 계산 화면이고(원본에는 따로 된 화면이 없었다), 나머지는 모두 원본 화면(`orig/`)이다. */
export function LabcarePage() {
  const section = useModuleSection()
  const meta = toolOf('labcare')?.sections?.find((s) => s.key === section)

  if (section === 'tax') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="기업부설연구소 OS"
          description={`${meta?.label ?? '세액공제'} — ${meta?.hint ?? '연구개발비 세액공제 예상'}. 상담용 1차 검토이며 세무 대리인 검토를 대신하지 않습니다.`}
        />
        <TaxTab />
        <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-meta font-bold tracking-wide text-slate-400" data-testid="lab-module-eyebrow">기업부설연구소 OS</p>
      {section === 'dashboard' ? (
        <>
          <OrigLabcare section="dashboard" />
          <section className="flex flex-col gap-3" aria-label="고객 운영 업체와 연결">
            <h2 className="t-section text-slate-900">고객 운영 업체와 연결</h2>
            <ModuleDashboard toolKey="labcare" />
          </section>
        </>
      ) : (
        <OrigLabcare section={section} />
      )}
      <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
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

