/**
 * 정책자금 진단 (D-88) — policy-funding-os 의 지식 엔진(규칙 JSON 28벌 + 순수 엔진 21개)을 그대로 옮긴 것.
 *
 * 흐름: 8문항 빠른 진단 → 결과(추천 기관 TOP3·세부 트랙·리스크·서류·로드맵·상담 대본·업셀) →
 * 심층 문항으로 정확도 높이기 → 업체 기록에 붙이기.
 *
 * 점수·문장은 전부 엔진이 만든다. 이 파일은 묻고 보여 주기만 한다. '승인 보장' 같은 말은 어디에도 없다 —
 * 원본의 면책 문구(REPORT_DISCLAIMER)를 그대로 단다.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, MetricTile, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { usePrefillFromClient } from '../shared/usePrefill'
import { PrefillNote } from '../shared/PrefillNote'
import { DEFAULT_INPUT, SAMPLE_INPUT, runDiagnosis } from './diagnosis'
import { oneLineConclusion, starString, todayTasks } from './coach'
import { REPORT_DISCLAIMER } from './report'
import type { DiagnosisInput, DiagnosisResult, LikelihoodLevel } from './types'
import {
  BONUS_ITEM_OPTIONS,
  CEO_AGE_OPTIONS,
  CLARITY_OPTIONS,
  CREDIT_BAND_OPTIONS,
  CREDIT_OPTIONS,
  DEBT_RELIEF_OPTIONS,
  EMPLOYEE_OPTIONS,
  EXISTING_DEBT_LEVEL_OPTIONS,
  FACILITY_USE_OPTIONS,
  FUNDING_SIZE_OPTIONS,
  HIRING_PLAN_OPTIONS,
  LAST_YEAR_REVENUE_OPTIONS,
  NET_PROFIT_OPTIONS,
  PURPOSE_OPTIONS,
  REVENUE_OPTIONS,
  SELF_FUNDING_OPTIONS,
  STRENGTH_OPTIONS,
  WORKING_CAPITAL_USE_OPTIONS,
  YEARS_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  YOUTH_EMPLOYMENT_OPTIONS,
} from './types'

const STORAGE_KEY = 'axmvp.tools.policyFunding'

function loadInput(): DiagnosisInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_INPUT
    return { ...DEFAULT_INPUT, ...(JSON.parse(raw) as Partial<DiagnosisInput>) }
  } catch {
    return DEFAULT_INPUT
  }
}

const LIKELIHOOD_TONE: Record<LikelihoodLevel, Tone> = { 높음: 'success', 보통: 'warning', 낮음: 'danger' }

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

/* 업체 기록의 숫자 → 이 도구가 쓰는 구간 (모르면 null — 짐작하지 않는다, D-90) */
function yearsBand(years: number | null): DiagnosisInput['years'] | null {
  if (years === null) return null
  if (years < 1) return '1년 미만'
  if (years < 3) return '1~3년'
  if (years < 7) return '3~7년'
  return '7년 이상'
}

function employeesBand(n: number | null): DiagnosisInput['employees'] | null {
  if (n === null) return null
  if (n <= 0) return '0명'
  if (n <= 4) return '1~4명'
  if (n <= 9) return '5~9명'
  return '10명 이상'
}

function ceoAgeBand(age: number | null): NonNullable<DiagnosisInput['ceoAge']> | null {
  if (age === null) return null
  if (age <= 39) return '만 39세 이하'
  if (age <= 49) return '40~49세'
  return '50세 이상'
}

function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | undefined
  options: readonly T[]
  onChange: (v: T) => void
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
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function MultiChips<T extends string>({ label, value, options, onChange }: { label: string; value: T[]; options: readonly T[]; onChange: (v: T[]) => void }) {
  const toggle = (o: T) => {
    if (o === ('없음' as T)) return onChange([o])
    const base = value.filter((v) => v !== ('없음' as T))
    onChange(base.includes(o) ? base.filter((v) => v !== o) : [...base, o])
  }
  return (
    <fieldset className="min-w-0">
      <legend className="t-sub font-medium text-slate-600">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
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
    </fieldset>
  )
}

function Bullets({ items, muted = false }: { items: string[]; muted?: boolean }) {
  if (!items.length) return null
  return (
    <ul className={`flex flex-col gap-1.5 ${muted ? 't-sub text-slate-500' : 't-body text-slate-700'}`}>
      {items.map((t, i) => (
        <li key={`${i}-${t}`} className="flex gap-2 break-keep">
          <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-slate-300" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 아래에서 손으로 */
    }
  }
  return (
    <Surface className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="t-card font-bold text-slate-900">{label}</span>
        <Button size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? '복사됨' : '복사'}
        </Button>
      </div>
      <pre className="t-sub break-keep whitespace-pre-wrap text-slate-600">{text}</pre>
    </Surface>
  )
}

function buildSummary(input: DiagnosisInput, r: DiagnosisResult): string {
  const lines = [
    `[정책자금 진단] ${input.companyName || '(회사명 미입력)'} · ${input.industry || r.industryCategory || ''}`.trim(),
    `진행 가능성 ${r.likelihoodLevel ?? ''} · 추천 기관 ${r.agencies.map((a, i) => `${i + 1}순위 ${a.name}`).join(' / ')}`,
    `핵심 전략: ${r.summary.coreStrategy}`,
    `가장 큰 리스크: ${r.summary.biggestRisk}`,
    `다음 할 일: ${r.nextAction}`,
  ]
  if (r.documents.length) lines.push(`준비 서류: ${r.documents.join(', ')}`)
  lines.push(REPORT_DISCLAIMER)
  return lines.join('\n')
}

export function PolicyFundingPage() {
  const [params] = useSearchParams()
  const [input, setInput] = useState<DiagnosisInput>(() => (params.get('sample') === '1' ? SAMPLE_INPUT : loadInput()))
  const [submitted, setSubmitted] = useState(params.get('sample') === '1')
  const [deepOpen, setDeepOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
    } catch {
      /* 저장 못 해도 진단은 된다 */
    }
  }, [input])

  const result: DiagnosisResult | null = useMemo(() => {
    if (!submitted) return null
    try {
      return runDiagnosis(input)
    } catch {
      return null
    }
  }, [submitted, input])

  // 업체에서 열었으면 아는 것을 채운다 (D-90).
  // 이 도구는 기본값이 빈 값이 아니라서(개인사업자·1~3년 …), **아직 손대지 않은 칸만** 바꾼다.
  const { note: prefillNote } = usePrefillFromClient((facts) => {
    const filled: string[] = []
    const next = { ...input }
    if (!next.companyName && facts.companyName) {
      next.companyName = facts.companyName
      filled.push('업체명')
    }
    if (!next.industry && facts.industryText) {
      next.industry = facts.industryText
      filled.push('업종')
    }
    if (next.businessType === DEFAULT_INPUT.businessType && facts.businessType === 'corporation') {
      next.businessType = '법인사업자'
      filled.push('사업자 유형')
    }
    const years = yearsBand(facts.years)
    if (next.years === DEFAULT_INPUT.years && years) {
      next.years = years
      filled.push('업력')
    }
    const emp = employeesBand(facts.employeeCount)
    if (next.employees === DEFAULT_INPUT.employees && emp) {
      next.employees = emp
      filled.push('직원 수')
    }
    const age = ceoAgeBand(facts.representativeAge)
    if ((next.ceoAge ?? '미확인') === '미확인' && age) {
      next.ceoAge = age
      filled.push('대표 나이')
    }
    if (filled.length > 0) setInput(next)
    return filled
  })

  const set = <K extends keyof DiagnosisInput>(k: K, v: DiagnosisInput[K]) => setInput((cur) => ({ ...cur, [k]: v }))
  const reset = () => {
    setInput(DEFAULT_INPUT)
    setSubmitted(false)
  }

  const top = result?.agencies[0]
  const showTech = !!result && result.agencies.slice(0, 3).some((a) => /기술보증|중소벤처/.test(a.name))
  const showFinance = !!result && result.agencies.slice(0, 3).some((a) => /신용보증기금/.test(a.name))
  const showSmall = !!result && result.agencies.slice(0, 3).some((a) => /소상공인|지역신용|미소/.test(a.name))

  return (
    <div className="flex flex-col gap-6">
      <PrefillNote note={prefillNote} />
      <PageHeader
        title="정책자금 진단"
        description="8문항이면 추천 기관 TOP3 와 세부 트랙, 리스크, 필요 서류, 90일 로드맵, 상담 대본이 나옵니다. 64건 사례와 규칙 지식으로 계산하며, 승인을 보장하지 않습니다."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE_INPUT); setSubmitted(true) }}>
              샘플 넣기
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw aria-hidden="true" className="size-4" /> 다시 입력
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <Surface className="flex flex-col gap-5 p-4 sm:p-5">
            <span className="t-section text-slate-900">⚡ 빠른 진단 (30초)</span>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">회사명</span>
                <input aria-label="회사명" value={input.companyName} onChange={(e) => set('companyName', e.target.value)} className={`mt-1 ${inputCls}`} placeholder="(주)한빛정밀" />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">업종 (자유 입력)</span>
                <input aria-label="업종" value={input.industry} onChange={(e) => set('industry', e.target.value)} className={`mt-1 ${inputCls}`} placeholder="자동차부품 제조" />
              </label>
            </div>
            <Chips label="사업자 구분" value={input.businessType} options={['개인사업자', '법인사업자'] as const} onChange={(v) => set('businessType', v)} />
            <Chips label="업력" value={input.years} options={YEARS_OPTIONS} onChange={(v) => set('years', v)} />
            <Chips label="연 매출" value={input.revenue} options={REVENUE_OPTIONS} onChange={(v) => set('revenue', v)} />
            <Chips label="직원 수 (4대보험 기준)" value={input.employees} options={EMPLOYEE_OPTIONS} onChange={(v) => set('employees', v)} />
            <Chips label="대표자 신용 상태" value={input.credit} options={CREDIT_OPTIONS} onChange={(v) => set('credit', v)} />
            <Chips label="자금 목적" value={input.purpose} options={PURPOSE_OPTIONS} onChange={(v) => set('purpose', v)} />
            <MultiChips label="보유 강점 (여러 개)" value={input.strengths} options={STRENGTH_OPTIONS} onChange={(v) => set('strengths', v)} />
            <label className="block">
              <span className="t-sub font-medium text-slate-600">메모 (통화 내용 등)</span>
              <textarea aria-label="메모" rows={2} value={input.memo} onChange={(e) => set('memo', e.target.value)} className={`mt-1 ${inputCls}`} />
            </label>
            <Button variant="primary" onClick={() => setSubmitted(true)} className="w-full sm:w-auto" data-testid="pf-run">
              진단하기
            </Button>
          </Surface>

          {result && (
            <Disclosure title="🔍 심층 진단으로 정확도 높이기" hint="TOP3 기관에 맞는 문항만" defaultOpen={deepOpen}>
              <div className="flex flex-col gap-4 pt-2">
                <span className="t-meta text-slate-500">답을 바꾸면 결과가 바로 다시 계산됩니다.</span>
                {showTech && (
                  <>
                    <Chips label="기술·시설: 투자 목적이 명확한가" value={input.techClarity} options={CLARITY_OPTIONS} onChange={(v) => { set('techClarity', v); setDeepOpen(true) }} />
                    <Chips label="견적서 준비" value={input.quoteReady} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('quoteReady', v)} />
                    <Chips label="생산성 개선 근거" value={input.productivityEvidence} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('productivityEvidence', v)} />
                    <Chips label="시설자금 용도" value={input.facilityUse} options={FACILITY_USE_OPTIONS} onChange={(v) => set('facilityUse', v)} />
                  </>
                )}
                {showFinance && (
                  <>
                    <Chips label="재무: 전년도 매출" value={input.lastYearRevenue} options={LAST_YEAR_REVENUE_OPTIONS} onChange={(v) => set('lastYearRevenue', v)} />
                    <Chips label="순이익" value={input.netProfit} options={NET_PROFIT_OPTIONS} onChange={(v) => set('netProfit', v)} />
                    <Chips label="기존 부채 수준" value={input.existingDebtLevel} options={EXISTING_DEBT_LEVEL_OPTIONS} onChange={(v) => set('existingDebtLevel', v)} />
                    <Chips label="주요 거래처 있음" value={input.majorClients} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('majorClients', v)} />
                  </>
                )}
                {showSmall && (
                  <>
                    <Chips label="소상공인: 신용 점수대" value={input.creditBand} options={CREDIT_BAND_OPTIONS} onChange={(v) => set('creditBand', v)} />
                    <Chips label="최근 연체" value={input.recentDelinquency} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('recentDelinquency', v)} />
                    <Chips label="채무조정 이력" value={input.debtRelief} options={DEBT_RELIEF_OPTIONS} onChange={(v) => set('debtRelief', v)} />
                    <Chips label="운전자금 용도" value={input.workingCapitalUse} options={WORKING_CAPITAL_USE_OPTIONS} onChange={(v) => set('workingCapitalUse', v)} />
                  </>
                )}
                <Chips label="국세 체납" value={input.taxArrears} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('taxArrears', v)} />
                <Chips label="4대보험 체납" value={input.insuranceArrears} options={YES_NO_UNKNOWN_OPTIONS} onChange={(v) => set('insuranceArrears', v)} />
                <Chips label="희망 금액" value={input.fundingSize} options={FUNDING_SIZE_OPTIONS} onChange={(v) => set('fundingSize', v)} />
                <Chips label="자기자금" value={input.selfFunding} options={SELF_FUNDING_OPTIONS} onChange={(v) => set('selfFunding', v)} />
                <Chips label="대표 나이" value={input.ceoAge} options={CEO_AGE_OPTIONS} onChange={(v) => set('ceoAge', v)} />
                <Chips label="채용 계획" value={input.hiringPlan} options={HIRING_PLAN_OPTIONS} onChange={(v) => set('hiringPlan', v)} />
                <Chips label="청년 고용" value={input.youthEmployment} options={YOUTH_EMPLOYMENT_OPTIONS} onChange={(v) => set('youthEmployment', v)} />
                <Chips label="자금 사용 계획 명확도" value={input.fundUseClarity} options={CLARITY_OPTIONS} onChange={(v) => set('fundUseClarity', v)} />
                <MultiChips label="가점 항목" value={input.bonusItems ?? []} options={BONUS_ITEM_OPTIONS} onChange={(v) => set('bonusItems', v)} />
              </div>
            </Disclosure>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4" aria-live="polite">
          {!result || !top ? (
            <Surface className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="t-card font-bold text-slate-700">왼쪽 8문항을 채우고 진단하기를 누르세요</span>
              <span className="t-sub break-keep text-slate-500">추천 기관 TOP3 · 세부 트랙 · 리스크 · 서류 · 로드맵 · 상담 대본이 한 번에 나옵니다.</span>
            </Surface>
          ) : (
            <>
              <Surface edge={LIKELIHOOD_TONE[result.likelihoodLevel ?? '보통']} className="flex flex-col gap-2 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={LIKELIHOOD_TONE[result.likelihoodLevel ?? '보통']}>진행 가능성 {result.likelihoodLevel}</Badge>
                  <span className="t-meta text-slate-500" aria-label={`별점 ${starString(result.overallScore).length}`}>{starString(result.overallScore)}</span>
                  <span className="t-meta text-slate-500">종합 {result.overallScore}점</span>
                </div>
                <p className="t-card font-bold break-keep text-slate-900" data-testid="pf-conclusion">
                  {oneLineConclusion(result)}
                </p>
                <p className="t-sub break-keep text-slate-600">{result.coachMessage}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <ToolResultAttach
                    toolKey="policy-funding"
                    title="정책자금 진단"
                    verdict={result.likelihoodLevel ?? null}
                    verdictLabel={`진행 가능성 ${result.likelihoodLevel} · 1순위 ${top.name}`}
                    summary={buildSummary(input, result)}
                    data={{ input, agencies: result.agencies, tracks: result.specialTracks, documents: result.documents }}
                  />
                </div>
              </Surface>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MetricTile label="1순위 기관" value={top.name} hint={`${top.score}점`} tone="brand" />
                <MetricTile label="리스크" value={result.risk?.level ?? '-'} hint={result.risk ? `${result.risk.score}점` : undefined} tone={result.risk && result.risk.score >= 52 ? 'danger' : 'neutral'} />
                <MetricTile label="판단 신뢰도" value={result.confidence?.level ?? '-'} hint={result.confidence ? `${result.confidence.score}점` : undefined} />
                <MetricTile label="사업계획 완성도" value={result.planScore ? `${result.planScore.total}점` : '-'} hint="100점 기준" />
              </div>

              <Section title="추천 기관 TOP 3">
                <div className="flex flex-col gap-2.5" data-testid="pf-agencies">
                  {result.agencies.map((a) => (
                    <Surface key={a.name} edge={a.rank === 1 ? 'brand' : 'neutral'} showEdge={a.rank === 1} className="flex flex-col gap-1.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="t-card font-bold text-slate-900">
                          {a.rank}순위 {a.name}
                        </span>
                        <Badge tone={a.rank === 1 ? 'brand' : 'neutral'}>{a.score}점</Badge>
                      </div>
                      <Bullets items={a.reasons} muted />
                      {a.cautions.length > 0 && (
                        <p className="t-sub break-keep text-warning-700">⚠ {a.cautions.join(' / ')}</p>
                      )}
                      {a.exceptionalReview && a.exceptionalNote && <p className="t-meta break-keep text-slate-500">예외 검토: {a.exceptionalNote}</p>}
                    </Surface>
                  ))}
                  {result.deprioritized && result.deprioritized.length > 0 && (
                    <Disclosure title="후순위 기관과 이유" hint={`${result.deprioritized.length}곳`}>
                      <Bullets items={result.deprioritized.map((d) => `${d.name} — ${d.reason}`)} muted />
                    </Disclosure>
                  )}
                </div>
              </Section>

              {result.specialTracks && result.specialTracks.length > 0 && (
                <Section title="세부 자금 트랙 후보" count={result.specialTracks.length}>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {result.specialTracks.map((t) => (
                      <Surface key={t.key} className="flex flex-col gap-1.5 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="t-body font-bold text-slate-900">{t.name}</span>
                          <Badge tone={LIKELIHOOD_TONE[t.level]}>{t.level}</Badge>
                        </div>
                        <Bullets items={t.reasons} muted />
                        {t.cautions.length > 0 && <p className="t-meta break-keep text-slate-500">주의: {t.cautions.join(' / ')}</p>}
                      </Surface>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="왜 이렇게 판단했나">
                <Surface className="flex flex-col gap-3 p-4">
                  <p className="t-body break-keep text-slate-700">
                    <b>핵심 전략</b> {result.summary.coreStrategy}
                  </p>
                  <p className="t-body break-keep text-slate-700">
                    <b>가장 큰 리스크</b> {result.summary.biggestRisk}
                  </p>
                  {result.reasoning && <p className="t-sub break-keep text-slate-600">{result.reasoning}</p>}
                  {result.risk && (
                    <div className="border-t border-slate-100 pt-2">
                      <span className="t-meta font-medium text-slate-500">리스크 요인</span>
                      <Bullets items={result.risk.factors} muted />
                    </div>
                  )}
                  {result.agencyComparison && result.agencyComparison.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <span className="t-meta font-medium text-slate-500">왜 다른 기관이 아니라 이 기관인가</span>
                      <Bullets items={result.agencyComparison} muted />
                    </div>
                  )}
                </Surface>
              </Section>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Surface className="flex flex-col gap-2 p-4">
                  <span className="t-card font-bold text-slate-900">✅ 오늘 해야 할 일</span>
                  <Bullets items={todayTasks(input, result)} />
                </Surface>
                <Surface className="flex flex-col gap-2 p-4">
                  <span className="t-card font-bold text-slate-900">가장 먼저 확인할 것</span>
                  <Bullets items={result.coachInsight.firstChecks} />
                  {result.coachInsight.neverPromise.length > 0 && (
                    <p className="t-meta break-keep border-t border-slate-100 pt-2 text-danger-700">절대 약속 금지: {result.coachInsight.neverPromise.join(' · ')}</p>
                  )}
                </Surface>
              </div>

              <Section title="준비해야 할 서류">
                <Surface className="flex flex-col gap-2 p-4">
                  {result.documentPriority && result.documentPriority.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {result.documentPriority.map((d) => (
                        <li key={d.label} className="flex items-start gap-2 t-sub">
                          <Badge tone={d.tier >= 5 ? 'danger' : d.tier >= 4 ? 'warning' : 'neutral'}>중요도 {d.tier}</Badge>
                          <span className="min-w-0 break-keep text-slate-700">
                            <b>{d.label}</b> — <span className="text-slate-500">{d.why}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Bullets items={result.documents} />
                  )}
                  {result.documentChecks && result.documentChecks.some((d) => d.status === '요청 필요') && (
                    <p className="t-meta break-keep border-t border-slate-100 pt-2 text-slate-500">
                      요청 필요: {result.documentChecks.filter((d) => d.status === '요청 필요').map((d) => d.label).join(' · ')}
                    </p>
                  )}
                </Surface>
              </Section>

              {result.roadmap && (
                <Section title={`진행 로드맵${result.roadmap.agency ? ` · ${result.roadmap.agency}` : ''}`}>
                  <Surface className="p-4">
                    <ol className="flex flex-col gap-1.5">
                      {result.roadmap.steps.map((s, i) => (
                        <li key={`${i}-${s.task}`} className="flex gap-2.5 t-sub">
                          <span className="t-meta w-12 shrink-0 font-medium text-slate-500 tabular-nums">{s.offsetLabel}</span>
                          <span className="min-w-0 break-keep text-slate-700">{s.task}</span>
                        </li>
                      ))}
                    </ol>
                  </Surface>
                </Section>
              )}

              <Disclosure title="상담 대본 · 반론 대응" hint={`질문 ${result.coach.questions.length}`}>
                <div className="flex flex-col gap-3 pt-1">
                  <div>
                    <span className="t-meta font-medium text-slate-500">먼저 물어볼 것</span>
                    <Bullets items={result.coach.questions} muted />
                  </div>
                  <div>
                    <span className="t-meta font-medium text-slate-500">핵심 포인트</span>
                    <Bullets items={result.coach.keyPoints} muted />
                  </div>
                  <div>
                    <span className="t-meta font-medium text-slate-500">클로징</span>
                    <Bullets items={result.coach.closingLines} muted />
                  </div>
                  <div>
                    <span className="t-meta font-medium text-slate-500">반론 대응</span>
                    <Bullets items={result.coach.objectionLines} muted />
                  </div>
                </div>
              </Disclosure>

              {result.reviewSim && result.reviewSim.items.length > 0 && (
                <Disclosure title="심사관 시뮬레이터" hint={result.reviewSim.agency}>
                  <p className="t-meta break-keep pb-2 text-slate-500">{result.reviewSim.mindset}</p>
                  <ul className="flex flex-col gap-2">
                    {result.reviewSim.items.map((qa) => (
                      <li key={qa.question} className="t-sub">
                        <span className="block font-medium break-keep text-slate-800">Q. {qa.question}</span>
                        <span className="block break-keep text-slate-600">A. {qa.answer}</span>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}

              {result.planQuestions && result.planQuestions.length > 0 && (
                <Disclosure title="사업계획서를 쓰기 위해 대표에게 물어볼 것" hint={`${result.planQuestions.length}개`}>
                  <Bullets items={result.planQuestions} muted />
                </Disclosure>
              )}

              {result.planDraft && (
                <Disclosure title={`사업계획 초안 · ${result.planDraft.agency}`} hint={result.planDraft.emphasis}>
                  <div className="flex flex-col gap-3">
                    {result.planDraft.sections.map((s) => (
                      <div key={s.no}>
                        <span className="t-body font-medium text-slate-800">
                          {s.no}. {s.title}
                        </span>
                        <p className="t-sub break-keep whitespace-pre-wrap text-slate-600">{s.text}</p>
                      </div>
                    ))}
                  </div>
                </Disclosure>
              )}

              {result.cases.length > 0 && (
                <Disclosure title="유사 사례" hint={`${result.cases.length}건`}>
                  <ul className="flex flex-col gap-2">
                    {result.cases.map((c) => (
                      <li key={c.title} className="t-sub">
                        <span className="block font-medium break-keep text-slate-800">
                          {c.title} {c.matchRate != null ? <Badge>{c.matchRate}% 유사</Badge> : null}
                        </span>
                        <span className="block break-keep text-slate-600">
                          {c.industry} · {c.years} · {c.revenue} · {c.agency} · {c.approved}
                        </span>
                        {c.lesson && <span className="block break-keep text-slate-500">교훈: {c.lesson}</span>}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}

              {result.upsells.length > 0 && (
                <Disclosure title="추가로 검토할 수 있는 지원제도" hint={`${result.upsells.length}개`}>
                  <Bullets items={result.upsells.map((u) => `${u.title} — ${u.desc}`)} muted />
                </Disclosure>
              )}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <CopyBlock label="서류 요청 메시지" text={result.documentMessage} />
                <CopyBlock label="다음 연락 메시지" text={result.followUpMessage} />
              </div>

              <p className="t-meta break-keep text-slate-400">{REPORT_DISCLAIMER}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
