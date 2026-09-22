/**
 * 창업감면 1분 판정기 (D-88) — startup-tax-checker 의 판정 규칙을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 규칙은 `lib/` 안에 있고(원본 그대로), 이 파일은 묻고 보여 주기만 한다.
 * 원본의 조합 셀프테스트(9,216 조합 · 52만 검증)가 `npm run test:startup-tax` 로 그대로 돈다.
 *
 * 적은 값은 이 브라우저에 남는다 — 상담 중 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import type { AdvancedInput, ExemptionKey, FormData as StartupTaxForm, JudgementResult, Verdict } from './types'
import { judge, VERDICT_EMOJI, VERDICT_LABEL, DISCLAIMER, DISCLAIMER_FRAMEWORK } from './lib/judgement'
import { buildSummaryText } from './lib/summary'
import {
  BUSINESS_TYPES,
  CHECK_ITEMS,
  INDUSTRIES,
  INDUSTRY_RELATIONS,
  OVERCONCENTRATIONS,
  REGIONS,
  STARTUP_FORMS,
  YES_NO_UNKNOWN,
  type Option,
} from './lib/options'
import { formatAge } from './lib/lineage'

const STORAGE_KEY = 'axmvp.tools.startupTax'

export const EMPTY_ADVANCED: AdvancedInput = {
  originalStartDate: '',
  hasExistingSole: '',
  hasExistingCorp: '',
  isExistingExec: '',
  newOwnerShare: '',
  familyShare: '',
  existingCorpExecShare: '',
  isOligopoly: '',
  prevIndustryRelation: '',
  assetTakeoverRatio: '',
  employeeMoved: '',
  reuseIdentity: '',
  sameAddress: '',
}

export const EMPTY_FORM: StartupTaxForm = {
  businessType: '',
  birthDate: '',
  startupDate: '',
  region: '',
  overconcentration: '',
  industry: '',
  startupForm: '',
  checkItems: { incomeTax: false, acquisitionTax: false, propertyTax: false, registrationTax: false },
  advanced: { ...EMPTY_ADVANCED },
}

function loadForm(): StartupTaxForm {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_FORM
    const saved = JSON.parse(raw) as Partial<StartupTaxForm>
    return {
      ...EMPTY_FORM,
      ...saved,
      checkItems: { ...EMPTY_FORM.checkItems, ...(saved.checkItems ?? {}) },
      advanced: { ...EMPTY_ADVANCED, ...(saved.advanced ?? {}) },
    }
  } catch {
    return EMPTY_FORM
  }
}

/** 판정 4단계 → OS 색 (초록·노랑·주황·빨강 그대로) */
export const VERDICT_TONE: Record<Verdict, Tone> = {
  good: 'success',
  caution: 'warning',
  conditional: 'warning',
  bad: 'danger',
}

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T | ''
  options: readonly Option<T>[]
  onChange: (v: T) => void
  hint?: string
}) {
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

function DateField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <input type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 ${inputCls}`} />
      {hint && <span className="t-meta mt-0.5 block text-slate-400">{hint}</span>}
    </label>
  )
}

function PctField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="t-sub font-medium text-slate-600">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} text-right tabular-nums`}
        />
        <span className="t-sub shrink-0 text-slate-500">%</span>
      </span>
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

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <Badge tone={VERDICT_TONE[verdict]}>
      {VERDICT_EMOJI[verdict]} {VERDICT_LABEL[verdict]}
    </Badge>
  )
}

export function StartupTaxPage() {
  const [form, setForm] = useState<StartupTaxForm>(() => loadForm())
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState(0)
  // 판정 기준일은 화면을 연 순간으로 고정한다 — 다시 그릴 때마다 나이·업력 경계가 흔들리면 안 된다
  const [baseDate] = useState(() => new Date())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch {
      /* 저장 못 해도 판정은 된다 */
    }
  }, [form])

  const result: JudgementResult | null = useMemo(() => (submitted ? judge(form, baseDate) : null), [submitted, form, baseDate])

  const set = <K extends keyof StartupTaxForm>(k: K, v: StartupTaxForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setAdv = <K extends keyof AdvancedInput>(k: K, v: AdvancedInput[K]) => setForm((f) => ({ ...f, advanced: { ...f.advanced, [k]: v } }))
  const toggleCheck = (k: ExemptionKey) => setForm((f) => ({ ...f, checkItems: { ...f.checkItems, [k]: !f.checkItems[k] } }))
  const reset = () => {
    setForm(EMPTY_FORM)
    setSubmitted(false)
  }

  const ready = form.businessType && form.birthDate && form.startupDate && form.overconcentration && form.industry && form.startupForm
  const missing = [
    !form.businessType && '사업자 유형',
    !form.birthDate && '대표자 생년월일',
    !form.startupDate && '창업일',
    !form.overconcentration && '과밀억제권역 여부',
    !form.industry && '업종',
    !form.startupForm && '창업 형태',
  ].filter((x): x is string => Boolean(x))

  const copy = async () => {
    if (!result) return
    const text = buildSummaryText(result)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 복사 못 하면 아래 미리보기에서 손으로 긁는다 */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="창업감면 판정기"
        description="여덟 가지만 고르면 창업중소기업 세액감면 가능성을 네 단계로 판정합니다. 상담용 1차 판정이며 세무 대리인의 최종 검토를 대신하지 않습니다."
        actions={
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" /> 다시 입력
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 입력 */}
        <Surface className="flex flex-col gap-5 p-4 sm:p-5">
          <ChoiceGroup label="① 사업자 유형" value={form.businessType} options={BUSINESS_TYPES} onChange={(v) => set('businessType', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="② 대표자 생년월일" value={form.birthDate} onChange={(v) => set('birthDate', v)} hint="청년(만 15~34세) 여부를 봅니다" />
            <DateField label="③ 창업일" value={form.startupDate} onChange={(v) => set('startupDate', v)} hint="사업자등록일 또는 법인 설립일" />
          </div>
          <ChoiceGroup label="④ 사업장 지역" value={form.region} options={REGIONS} onChange={(v) => set('region', v)} />
          <ChoiceGroup
            label="⑤ 수도권 과밀억제권역 여부"
            value={form.overconcentration}
            options={OVERCONCENTRATIONS}
            onChange={(v) => set('overconcentration', v)}
            hint="서울 전역·인천 대부분·경기 일부(성남·수원·고양 등)가 해당합니다"
          />
          <ChoiceGroup label="⑥ 업종" value={form.industry} options={INDUSTRIES} onChange={(v) => set('industry', v)} />
          <ChoiceGroup label="⑦ 창업 형태" value={form.startupForm} options={STARTUP_FORMS} onChange={(v) => set('startupForm', v)} />
          <fieldset>
            <legend className="t-sub font-medium text-slate-600">⑧ 감면 확인 항목 (고르지 않으면 전부)</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CHECK_ITEMS.map((o) => {
                const on = form.checkItems[o.value]
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCheck(o.value)}
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
          </fieldset>

          <Disclosure title="상세 입력 (선택)" hint="법 기준 정밀 판정 — 법인전환·양수·승계일 때 적으면 판정이 정확해집니다">
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <DateField label="기존 개인사업 최초 개시일" value={form.advanced.originalStartDate} onChange={(v) => setAdv('originalStartDate', v)} hint="법인전환·양수·승계면 이 날짜로 업력을 셉니다" />
              <ChoiceGroup label="기존 개인사업 있었음" value={form.advanced.hasExistingSole} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('hasExistingSole', v)} />
              <ChoiceGroup label="기존 법인 있었음" value={form.advanced.hasExistingCorp} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('hasExistingCorp', v)} />
              <ChoiceGroup label="기존 법인 임원이었음" value={form.advanced.isExistingExec} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('isExistingExec', v)} />
              <PctField label="신규 법인 대표 지분율" value={form.advanced.newOwnerShare} onChange={(v) => setAdv('newOwnerShare', v)} />
              <PctField label="친족 합산 지분율" value={form.advanced.familyShare} onChange={(v) => setAdv('familyShare', v)} />
              <PctField label="기존 법인·임원 합산 지분율" value={form.advanced.existingCorpExecShare} onChange={(v) => setAdv('existingCorpExecShare', v)} />
              <ChoiceGroup label="과점주주 해당" value={form.advanced.isOligopoly} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('isOligopoly', v)} />
              <ChoiceGroup label="이전 사업과 업종 관계" value={form.advanced.prevIndustryRelation} options={INDUSTRY_RELATIONS} onChange={(v) => setAdv('prevIndustryRelation', v)} />
              <PctField label="기존 자산 인수 비율" value={form.advanced.assetTakeoverRatio} onChange={(v) => setAdv('assetTakeoverRatio', v)} />
              <ChoiceGroup label="직원이 그대로 옮겨 옴" value={form.advanced.employeeMoved} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('employeeMoved', v)} />
              <ChoiceGroup label="상호·거래처 그대로 씀" value={form.advanced.reuseIdentity} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('reuseIdentity', v)} />
              <ChoiceGroup label="같은 주소" value={form.advanced.sameAddress} options={YES_NO_UNKNOWN} onChange={(v) => setAdv('sameAddress', v)} />
            </div>
          </Disclosure>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <Button variant="primary" disabled={!ready} onClick={() => setSubmitted(true)} className="w-full sm:w-auto">
              1분 판정하기
            </Button>
            {!ready && <span className="t-meta text-slate-500">아직 안 고른 것: {missing.join(' · ')}</span>}
          </div>
        </Surface>

        {/* 결과 */}
        <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
          {!result ? (
            <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="t-card font-bold text-slate-700">왼쪽을 채우고 판정하기를 누르면 여기에 결과가 나옵니다</span>
              <span className="t-sub break-keep text-slate-500">종합 판정 · 핵심 이유 · 예상 절세 규모 · 법 기준별 판정 · 상담 질문까지 한 번에 나옵니다.</span>
            </Surface>
          ) : (
            <>
              <Surface edge={VERDICT_TONE[result.overall]} className="flex flex-col gap-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-meta font-medium text-slate-500">종합 판정</span>
                  <VerdictBadge verdict={result.overall} />
                </div>
                <p className="t-card font-bold break-keep text-slate-900" data-testid="startup-tax-oneline">
                  {result.oneLineConclusion}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 t-sub text-slate-600">
                  <span>
                    예상 절세 규모 <b className="text-slate-900">{result.savingsLevel.level}</b> · {result.savingsLevel.label}
                  </span>
                  <span>
                    전문가 검토 추천도 <b className="text-slate-900">{result.expertReview.grade}</b> · {result.expertReview.label}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button size="sm" onClick={copy}>
                    {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                    {copied ? '복사됨' : '결과 복사 (카톡용)'}
                  </Button>
                  <ToolResultAttach
                    toolKey="startup-tax"
                    title="창업감면 판정"
                    verdict={result.overall}
                    verdictLabel={`${VERDICT_EMOJI[result.overall]} ${VERDICT_LABEL[result.overall]}`}
                    summary={buildSummaryText(result)}
                    data={{ form, baseDate: baseDate.toISOString().slice(0, 10) }}
                  />
                </div>
              </Surface>

              <Section title="이번 판정의 핵심 이유">
                <Surface className="p-4">
                  <Bullets items={result.keyReasons} />
                </Surface>
              </Section>

              <Section title="항목별 판정">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {result.coreItems.map((item) => (
                    <Surface key={item.key} edge={VERDICT_TONE[item.verdict]} className="flex flex-col gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="t-card font-bold text-slate-900">{item.title}</span>
                        <VerdictBadge verdict={item.verdict} />
                      </div>
                      <Bullets items={item.reasons} tone="muted" />
                      {item.checkPoints.length > 0 && (
                        <div className="border-t border-slate-100 pt-2">
                          <span className="t-meta font-medium text-slate-500">확인할 것</span>
                          <Bullets items={item.checkPoints} tone="muted" />
                        </div>
                      )}
                    </Surface>
                  ))}
                  {result.registration && (
                    <Surface className="flex flex-col gap-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="t-card font-bold text-slate-900">{result.registration.title}</span>
                        <Badge>참고</Badge>
                      </div>
                      <p className="t-sub break-keep text-slate-500">{result.registration.note}</p>
                      <Bullets items={result.registration.checkPoints} tone="muted" />
                    </Surface>
                  )}
                </div>
              </Section>

              <Section title="법 기준별 판정">
                <Surface className="p-4">
                  <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
                    {result.frameworks.map((f, i) => (
                      <button
                        key={f.key}
                        type="button"
                        role="tab"
                        aria-selected={tab === i}
                        onClick={() => setTab(i)}
                        className={`tap shrink-0 rounded-(--radius-control) border px-3 py-2 t-sub font-medium ${
                          tab === i ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {VERDICT_EMOJI[f.verdict]} {f.title}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const f = result.frameworks[tab] ?? result.frameworks[0]
                    return (
                      <div className="mt-3 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <VerdictBadge verdict={f.verdict} />
                          <span className="t-meta text-slate-500">{f.subtitle}</span>
                        </div>
                        <p className="t-body font-medium break-keep text-slate-800">{f.conclusion}</p>
                        {f.points.length > 0 && (
                          <ul className="flex flex-col gap-1.5">
                            {f.points.map((p) => (
                              <li key={p.text} className="flex gap-2 t-sub break-keep text-slate-600">
                                <span className="shrink-0">{p.tone === 'good' ? '🟢' : p.tone === 'caution' ? '🟡' : '🔴'}</span>
                                <span>{p.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {f.risks.length > 0 && (
                          <div>
                            <span className="t-meta font-medium text-danger-700">주의</span>
                            <Bullets items={f.risks} tone="muted" />
                          </div>
                        )}
                        {f.checkPoints.length > 0 && (
                          <div>
                            <span className="t-meta font-medium text-slate-500">확인할 것</span>
                            <Bullets items={f.checkPoints} tone="muted" />
                          </div>
                        )}
                        {f.note && <p className="t-meta break-keep text-slate-400">{f.note}</p>}
                      </div>
                    )
                  })()}
                  <p className="t-meta mt-3 break-keep border-t border-slate-100 pt-3 text-slate-400">{DISCLAIMER_FRAMEWORK}</p>
                </Surface>
              </Section>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Surface className="flex flex-col gap-1.5 p-4">
                  <span className="t-card font-bold text-slate-900">창업일 승계 분석</span>
                  <p className="t-sub break-keep text-slate-600">
                    기준 창업일 <b className="text-slate-900">{result.lineage.effectiveStartLabel}</b>
                    {result.lineage.businessAgeYears !== null && (
                      <>
                        {' '}· 업력 <b className="text-slate-900">{formatAge(result.lineage.businessAgeYears)}</b>
                      </>
                    )}
                  </p>
                  <p className="t-sub break-keep text-slate-500">
                    {result.lineage.needsOriginalDate
                      ? '법인전환·양수·승계인데 기존 사업 개시일이 없어 업력을 세지 못했습니다. 상세 입력에 적으면 정확해집니다.'
                      : result.lineage.within7Years === false
                        ? '창업 후 7년이 지나 창업기업(창업지원법) 인정이 어렵습니다.'
                        : result.lineage.hasTaxRemaining === false
                          ? '세액감면 5년 기간이 이미 지났습니다.'
                          : result.lineage.taxRemainingYears !== null
                            ? `세액감면 기간이 약 ${formatAge(result.lineage.taxRemainingYears)} 남았습니다.`
                            : ''}
                  </p>
                </Surface>
                <Surface className="flex flex-col gap-1.5 p-4">
                  <span className="t-card font-bold text-slate-900">청년 기준</span>
                  <p className="t-sub text-slate-600">
                    만 나이 <b className="text-slate-900">{result.youth.age ?? '-'}</b>세
                  </p>
                  <p className="t-sub break-keep text-slate-500">조특법: {result.youth.taxLawNote}</p>
                  <p className="t-sub break-keep text-slate-500">창업지원법: {result.youth.startupLawNote}</p>
                </Surface>
              </div>

              <Section title="추가 확인 항목">
                <Surface className="p-4">
                  <Bullets items={result.keyChecks} />
                </Surface>
              </Section>

              <Disclosure title="상담 예상 질문" hint={`${result.consultQuestions.length}개`}>
                <Bullets items={result.consultQuestions} tone="muted" />
              </Disclosure>
              <Disclosure title="대표님들이 놓치는 부분" hint={`${result.missedPoints.length}개`}>
                <Bullets items={result.missedPoints} tone="muted" />
              </Disclosure>
              <Disclosure title="예상 절세 포인트">
                <ul className="flex flex-col gap-1.5">
                  {result.savingsPoints.map((p) => (
                    <li key={p.text} className="flex gap-2 t-sub break-keep">
                      <span className="shrink-0">{p.tone === 'good' ? '🟢' : p.tone === 'caution' ? '🟡' : '🔴'}</span>
                      <span className="text-slate-600">{p.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="t-meta mt-2 break-keep text-slate-500">{result.savingsAdvice}</p>
              </Disclosure>
              {result.exclusionReasons.length > 0 && (
                <Disclosure title="창업 제외사유 진단" hint="해당 가능성 있음" defaultOpen>
                  {result.exclusionReasons.map((e) => (
                    <div key={e.title} className="flex flex-col gap-1">
                      <span className="t-body font-medium text-slate-800">{e.title}</span>
                      <p className="t-sub break-keep text-slate-600">{e.detail}</p>
                      <p className="t-meta break-keep text-slate-500">예외: {e.exception}</p>
                    </div>
                  ))}
                </Disclosure>
              )}
              <Disclosure title="전문가 검토 추천 근거" hint={`${result.expertReview.grade} · ${result.expertReview.label}`}>
                <p className="t-sub break-keep text-slate-600">{result.expertReview.description}</p>
                <Bullets items={result.expertReview.factors} tone="muted" />
              </Disclosure>
              <Disclosure title="카톡 요약 미리보기">
                <pre className="t-sub whitespace-pre-wrap break-keep text-slate-600">{buildSummaryText(result)}</pre>
              </Disclosure>

              <p className="t-meta break-keep text-slate-400">{DISCLAIMER}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
