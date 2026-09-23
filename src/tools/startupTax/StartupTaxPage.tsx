/**
 * 창업감면 1분 판정기 (D-88) — startup-tax-checker 의 판정 규칙을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 규칙은 `lib/` 안에 있고(원본 그대로), 이 파일은 묻고 보여 주기만 한다.
 * 원본의 조합 셀프테스트(9,216 조합 · 52만 검증)가 `npm run test:startup-tax` 로 그대로 돈다.
 *
 * 적은 값은 이 브라우저에 남는다 — 상담 중 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { StartupTaxReportScreen } from './screens/ReportScreen'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { usePrefillFromClient } from '../shared/usePrefill'
import { PrefillNote } from '../shared/PrefillNote'
import type { FormData as StartupTaxForm, JudgementResult } from './types'
import { EMPTY_ADVANCED, EMPTY_FORM } from './lib/formDefaults'
import { judge, VERDICT_EMOJI, VERDICT_LABEL } from './lib/judgement'
import { buildSummaryText } from './lib/summary'
import InputForm from './orig/components/InputForm'
import ResultCards from './orig/components/ResultCards'
import PrintSheet from './orig/components/PrintSheet'

const STORAGE_KEY = 'axmvp.tools.startupTax'

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

/** 원본 기본값 (요청 사양: 생년월일 1980-01-01, 창업일 2020-01-01) — 업체 정보로 채울 때 이 값은 '안 적은 것' 으로 본다 */
const ORIG_BIRTH = '1980-01-01'
const ORIG_STARTUP = '2020-01-01'

function StartupTaxScreen() {
  const [form, setForm] = useState<StartupTaxForm>(() => {
    const f = loadForm()
    return { ...f, birthDate: f.birthDate || ORIG_BIRTH, startupDate: f.startupDate || ORIG_STARTUP }
  })
  const [submitted, setSubmitted] = useState(false)
  // 진단 기준일 (오늘) — 마운트 시 1회 고정
  const [baseDate] = useState(() => new Date())
  const currentYear = baseDate.getFullYear()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch {
      /* 저장 못 해도 판정은 된다 */
    }
  }, [form])

  const result: JudgementResult | null = useMemo(() => (submitted ? judge(form, baseDate) : null), [submitted, form, baseDate])
  const summaryText = useMemo(() => (result ? buildSummaryText(result) : ''), [result])

  // 업체에서 열었으면 아는 것은 다시 묻지 않는다 (D-90) — 빈 칸(원본 기본값 포함)만 채운다
  const { note: prefillNote } = usePrefillFromClient((facts) => {
    const filled: string[] = []
    const next = { ...form }
    if (!next.businessType && facts.businessType) {
      next.businessType = facts.businessType
      filled.push('사업자 유형')
    }
    if ((!next.birthDate || next.birthDate === ORIG_BIRTH) && facts.representativeBirth) {
      next.birthDate = facts.representativeBirth
      filled.push('대표자 생년월일')
    }
    if ((!next.startupDate || next.startupDate === ORIG_STARTUP) && facts.establishedAt) {
      next.startupDate = facts.establishedAt
      filled.push('창업일')
    }
    if (!next.industry && facts.industry) {
      next.industry = facts.industry as StartupTaxForm['industry']
      filled.push('업종')
    }
    if (filled.length > 0) setForm(next)
    return filled
  })

  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  const handleSubmit = () => {
    setSubmitted(true)
    top()
  }
  const handleReset = () => {
    setForm({ ...EMPTY_FORM, birthDate: ORIG_BIRTH, startupDate: ORIG_STARTUP, checkItems: { ...EMPTY_FORM.checkItems }, advanced: { ...EMPTY_ADVANCED } })
    setSubmitted(false)
    top()
  }
  const handleBack = () => {
    setSubmitted(false)
    top()
  }

  return (
    <div className="st-orig flex flex-col gap-4">
      <PrefillNote note={prefillNote} />
      {/* 화면 UI — 원본 그대로 (원본은 글자 기준 20px · 폭 max-w-xl) */}
      <div className="st-zoom" data-testid="startup-orig">
        <div className="mx-auto max-w-xl px-1 pb-10 pt-2">
          <header className="mb-6 px-1">
            <div className="text-base font-bold text-brand">세무·법인컨설팅 상담용</div>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-gray-900">창업감면 1분 판정기</h1>
            <p className="mt-2.5 text-lg leading-relaxed text-gray-500">
              대표자 정보를 입력하면 창업기업 관련 감면 가능성을 1차로 판정합니다.
              <br />
              세액 계산기가 아닌 <b className="text-gray-700">상담 보조 판정 도구</b>입니다.
            </p>
          </header>

          {submitted && result ? (
            <ResultCards
              result={result}
              summaryText={summaryText}
              onBack={handleBack}
              onPrint={() => window.print()}
              extras={
                <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-gray-100 bg-white p-4 shadow-card">
                  <ToolResultAttach
                    toolKey="startup-tax"
                    title="창업감면 판정"
                    verdict={result.overall}
                    verdictLabel={`${VERDICT_EMOJI[result.overall]} ${VERDICT_LABEL[result.overall]}`}
                    summary={summaryText}
                    data={{ form, baseDate: baseDate.toISOString().slice(0, 10) }}
                  />
                  <span className="text-sm text-gray-500">판정 결과를 고객 운영 업체 기록에 붙입니다.</span>
                </div>
              }
            />
          ) : (
            <InputForm form={form} onChange={setForm} onSubmit={handleSubmit} onReset={handleReset} currentYear={currentYear} />
          )}

          <footer className="mt-10 px-1 text-center text-sm text-gray-300">창업감면 1분 판정기 · 상담용 사전진단 도구</footer>
        </div>
      </div>

      {/* 인쇄 전용 A4 결과서 — 원본 PrintSheet (인쇄하면 이것만 나온다) */}
      {submitted && result && (
        <div className="print-document">
          <PrintSheet form={form} result={result} baseDate={baseDate} />
        </div>
      )}
    </div>
  )
}

/** 목차에서 고른 화면 → 이 자리에 선다. */
export function StartupTaxPage() {
  const section = useModuleSection()
  const meta = toolOf('startup-tax')?.sections?.find((s) => s.key === section)

  if (section === 'judge') return <StartupTaxScreen />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="창업감면 판정기"
        description={meta?.hint ? `${meta.label} — ${meta.hint}` : '여덟 가지만 고르면 창업중소기업 세액감면 가능성을 네 단계로 판정합니다.'}
      />
      {section === 'report' ? <StartupTaxReportScreen /> : <ModuleDashboard toolKey="startup-tax" />}
    </div>
  )
}
