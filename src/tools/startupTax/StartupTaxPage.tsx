/**
 * 창업감면 1분 판정기 (D-88) — startup-tax-checker 의 판정 규칙을 옮겨 온 것.
 *
 * 규칙은 `lib/` 안에 있고, 이 파일은 묻고 보여 주기만 한다.
 * D-136: 원본 규칙의 틀린 곳을 고쳤다(청년 나이는 창업 당시 · 과밀+비청년 0% · 5개 과세연도 · 업종 목록 ·
 * 동종 재개업 · 지역↔과밀 맞춰 보기 · 예시 날짜 · 2026 개정). 단정 못 하는 것은 '★ 세무사 확인 필요' 로 보인다.
 * 원본의 조합 셀프테스트(조합 · 경계 사례)가 `npm run test:startup-tax` 로 돈다.
 *
 * 적은 값은 이 브라우저에 남는다 — 상담 중 화면을 옮겨도 다시 적지 않는다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { presetAssumptions, presetFieldsKept, scenarioPreset, withoutPresetFields } from '../../services/scenarioPresets'
import { PresetNote } from '../shared/PresetNote'
import { startupRegion } from '../../services/clientInsights'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { StartupTaxReportScreen } from './screens/ReportScreen'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { usePrefillFromClient } from '../shared/usePrefill'
import { PrefillNote } from '../shared/PrefillNote'
import { FactSendButton } from '../shared/FactSendButton'
import { useToolClient } from '../shared/toolClientContext'
import { loadStartupTaxForm, saveStartupTaxForm, markStartupTaxJudged } from './lib/formStore'
import type { FormData as StartupTaxForm, JudgementResult } from './types'
import { EMPTY_ADVANCED, EMPTY_FORM, openSavedForm } from './lib/formDefaults'
import { judge, VERDICT_EMOJI, VERDICT_LABEL } from './lib/judgement'
// D-211: 판정 기준일은 한국 날짜로 남긴다(UTC 로 자르면 오전 9시 전 판정이 어제 날짜였다)
import { formatDate } from './lib/date'
import { buildSummaryText } from './lib/summary'
import InputForm from './orig/components/InputForm'
import { StartupZoomPicker, useStartupZoom } from './StartupZoom'
import ResultCards from './orig/components/ResultCards'
import PrintSheet from './orig/components/PrintSheet'

/**
 * D-215: 빈 날짜는 빈 값으로 둔다 — 예시 날짜(1980-01-01 · 2020-01-01)는 날짜 고르기 칸이 처음 보여 주는 자리일 뿐 값이 아니다.
 *   예전(D-136): 빈 칸을 예시 날짜로 채워 두고 '예시와 같으면 안 적은 것' 으로 봐서, 대표 생년월일이 정말 1980-01-01 이면
 *   업체 정보로 채워도 판정이 안 되고(맞춤 추천은 판정 — 서로 다름), [업체 정보로 보내기] 도 숨었다.
 *   예전에 저장된 폼의 예시 날짜(그때 채워 둔 값)는 한 번만 빈 칸으로 읽는다(legacy).
 */
function freshForm(): StartupTaxForm {
  return { ...EMPTY_FORM, checkItems: { ...EMPTY_FORM.checkItems }, advanced: { ...EMPTY_ADVANCED }, placeholdersCleared: true }
}

function formFor(clientId: string | null): StartupTaxForm {
  const f = loadStartupTaxForm(clientId)
  if (!f) return freshForm()
  return openSavedForm(f)
}

function StartupTaxScreen() {
  // 업체마다 따로 적어 둔다 (D-94) — 다른 업체로 열면 그 업체의 답(없으면 빈 폼)으로 바뀐다
  const { clientId } = useToolClient()
  const [form, setForm] = useState<StartupTaxForm>(() => formFor(clientId))
  const [zoom, setZoom] = useStartupZoom()
  const loadedFor = useRef<string | null>(clientId)
  const [submitted, setSubmitted] = useState(false)
  // 진단 기준일 (오늘) — 마운트 시 1회 고정
  const [baseDate] = useState(() => new Date())
  const currentYear = baseDate.getFullYear()

  useEffect(() => {
    if (loadedFor.current === clientId) return
    loadedFor.current = clientId
    setForm(formFor(clientId))
    setSubmitted(false)
  }, [clientId])

  useEffect(() => {
    // 업체가 막 바뀐 순간(아직 새 업체 폼을 읽기 전)에는 쓰지 않는다 — 앞 업체 답이 뒤 업체 칸에 들어가지 않게
    if (loadedFor.current !== clientId) return
    saveStartupTaxForm(clientId, form)
  }, [form, clientId])

  // D-215: 빈 칸은 빈 칸 그대로 판정한다(예시 날짜 비교 없음)
  const judgedForm = form
  const result: JudgementResult | null = useMemo(() => (submitted ? judge(judgedForm, baseDate) : null), [submitted, judgedForm, baseDate])
  const summaryText = useMemo(() => (result ? buildSummaryText(result) : ''), [result])

  // 업체에서 열었으면 아는 것은 다시 묻지 않는다 (D-90) — 빈 칸(원본 기본값 포함)만 채운다
  const { note: prefillNote } = usePrefillFromClient((facts) => {
    const filled: string[] = []
    const next = { ...form }
    if (!next.businessType && facts.businessType) {
      next.businessType = facts.businessType
      filled.push('사업자 유형')
    }
    if (!next.birthDate && facts.representativeBirth) {
      next.birthDate = facts.representativeBirth
      filled.push('대표자 생년월일')
    }
    if (!next.startupDate && facts.establishedAt) {
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

  // D-199 상황 예시(?preset=) — 그 상황의 가정(창업 형태 · 권역)을 넣고 바로 판정한다. 권역이 비어 있으면 업체 주소로
  const { clientRecord } = useToolClient()
  const [params, setParams] = useSearchParams()
  const presetId = params.get('preset')
  const presetDone = useRef(false)
  // D-211: 넣은 가정(창업 형태 · 옮길 권역)만 칩으로 · [가정 빼기]는 그 칸만 넣기 전 값으로(업체 주소로 채운 권역은 가정이 아니다)
  const [presetUsed, setPresetUsed] = useState<{ title: string; applied: Partial<StartupTaxForm>; before: Partial<StartupTaxForm>; chips: { field: string; text: string }[]; cleared: boolean } | null>(null)
  useEffect(() => {
    if (presetDone.current || !presetId || (clientId && !clientRecord)) return
    presetDone.current = true
    const preset = scenarioPreset(presetId)
    if (!preset || preset.module !== 'startup-tax') return
    const place = startupRegion(clientRecord?.businessAddress ?? '')
    const applied: Partial<StartupTaxForm> = { ...(preset.startup ?? {}) }
    const filledRegion = form.region ? {} : { region: place.region, overconcentration: place.over }
    const base = { ...form, ...filledRegion }
    const before: Partial<StartupTaxForm> = Object.fromEntries(Object.keys(applied).map((k) => [k, base[k as keyof StartupTaxForm]]))
    setForm((f) => ({ ...f, ...(f.region ? {} : filledRegion), ...applied }))
    setSubmitted(true)
    markStartupTaxJudged(clientId, true)
    setPresetUsed({ title: preset.title, applied, before, chips: presetAssumptions(preset), cleared: false })
    const next = new URLSearchParams(params)
    next.delete('preset')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, clientRecord, clientId])

  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' })
  // D-94: 판정하면 결과 첫 칸으로 — 위의 업체 띠·안내·제목을 건너뛴다(휴대폰에서 결과가 화면 아래로 밀리던 것)
  const handleSubmit = () => {
    setSubmitted(true)
    markStartupTaxJudged(clientId, true)
    window.setTimeout(() => document.getElementById('startup-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  const handleReset = () => {
    setForm(freshForm())
    setSubmitted(false)
    markStartupTaxJudged(clientId, false)
    top()
  }
  const handleBack = () => {
    setSubmitted(false)
    top()
  }

  return (
    <div className="st-orig flex flex-col gap-4">
      <PrefillNote note={prefillNote} />
      {presetUsed && (
        <PresetNote
          testId="startup-preset-note"
          title={presetUsed.title}
          done="이 업체 숫자로 바로 판정했어요(아래 칸을 바꾸면 다시 판정)"
          chips={presetUsed.chips.filter((c) => !c.field || presetFieldsKept(form, presetUsed.applied).map(String).includes(c.field)).map((c) => c.text)}
          cleared={presetUsed.cleared}
          clearedText="창업 형태 · 권역을 상황 예시 전 값으로 돌렸어요(직접 고친 칸은 그대로)."
          onClear={() => {
            setForm((f) => withoutPresetFields(f, presetUsed.applied, presetUsed.before))
            setPresetUsed({ ...presetUsed, cleared: true })
          }}
        />
      )}
      {/* D-167: 판정기 안에서만 글자 크기 고르기 — 기본은 OS 글자와 어울리게(예전 1.25배는 따로 노는 느낌) */}
      <div className="flex justify-end">
        <StartupZoomPicker value={zoom} onChange={setZoom} />
      </div>
      {/* 화면 UI — 원본 그대로 (원본은 글자 기준 20px). D-167: 폭 max-w-xl → max-w-5xl(양쪽 여백 줄이기) */}
      <div className="st-zoom" data-testid="startup-orig" data-zoom={zoom}>
        <div className="mx-auto max-w-5xl px-1 pb-10 pt-2">
          <header className="mb-6 px-1">
            {/* D-96: 제목 크기를 OS 화면 제목에 맞춘다 (원본 text-4xl 은 넓은 화면 1.25배 확대와 겹쳐 45px 였다) */}
            <h1 className="t-page break-keep text-slate-900">창업감면 1분 판정기</h1>
            <p className="t-sub mt-1 break-keep text-slate-500">
              대표자 정보를 입력하면 창업기업 관련 감면 가능성을 1차로 판정합니다.
              <br />
              세액 계산기가 아닌 <b className="text-slate-700">상담 보조 판정 도구</b>입니다.
            </p>
          </header>

          <div id="startup-result" className="scroll-mt-20" />
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
                    data={{ form, baseDate: formatDate(baseDate) }}
                  />
                  <span className="text-sm text-gray-500">판정 결과를 고객 관리 업체 기록에 붙입니다.</span>
                </div>
              }
            />
          ) : (
            <InputForm form={form} onChange={setForm} onSubmit={handleSubmit} onReset={handleReset} currentYear={currentYear} />
          )}

          <footer className="t-meta mt-10 px-1 text-center text-slate-400">창업감면 1분 판정기 · 상담용 사전진단 도구</footer>
        </div>
      </div>

      {/* D-135: 판정에 쓴 대표 생년월일 · 창업일을 업체 정보로(같으면 '같음' 만 · 원본 예시 날짜는 보내지 않는다).
          확대해 그리는 원본 화면 밖에 둔다 — 안에 두면 휴대폰 큰 글자에서 단추가 화면 밖으로 밀렸다 */}
      {submitted && result && (
        <div className="no-print flex flex-wrap items-center gap-2" data-testid="startup-facts">
          {/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) && <FactSendButton factKey="representativeBirth" value={form.birthDate} display={form.birthDate.replace(/-/g, '.')} source="manual" />}
          {/^\d{4}-\d{2}-\d{2}$/.test(form.startupDate) && <FactSendButton factKey="establishedAt" value={form.startupDate} display={form.startupDate.replace(/-/g, '.')} source="manual" />}
        </div>
      )}

      {/* 인쇄 전용 A4 결과서 — 원본 PrintSheet (인쇄하면 이것만 나온다) */}
      {submitted && result && (
        <div className="print-document">
          <PrintSheet form={judgedForm} result={result} baseDate={baseDate} />
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
