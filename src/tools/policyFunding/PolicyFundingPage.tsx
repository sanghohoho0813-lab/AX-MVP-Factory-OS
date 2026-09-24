/**
 * 정책자금 진단 (D-88 → D-92) — policy-funding-os 를 옮긴 것.
 *
 * D-92 부터 화면은 원본 컴포넌트(`orig/components`)를 거의 그대로 쓴다 — 글자·배치·색까지.
 * 규칙(엔진·지식 JSON)은 D-88 에 옮긴 그대로다. 점수·문장은 전부 엔진이 만든다.
 * '승인 보장' 같은 말은 어디에도 없다 — 원본의 면책 문구(REPORT_DISCLAIMER)를 그대로 단다.
 *
 * 이 OS 에서 더한 것: 고객 = 고객 운영 업체(orig/storage) · 업체 정보로 채우기(D-90) · 업체 기록에 붙이기(D-89).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { useToolClient } from '../shared/toolClientContext'
import { PolicyDashboardExtra } from './screens/DashboardExtra'
import { usePrefillFromClient } from '../shared/usePrefill'
import { PrefillNote } from '../shared/PrefillNote'
import { DEFAULT_INPUT } from './diagnosis'
import { REPORT_DISCLAIMER } from './report'
import type { DiagnosisInput, DiagnosisResult } from './types'
import { getStoredCustomers, hydratePolicyStore } from './orig/storage'
import DiagnosisSection from './orig/components/DiagnosisSection'
import DashboardView from './orig/components/DashboardView'
import CustomerDetailView from './orig/components/CustomerDetailView'
import ReportView from './orig/components/ReportView'
import { STAGE_BADGE } from './orig/stages'

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

/** 원본 화면이 읽는 상담 명단을 한 번 채운다 (고객 운영 업체 + 모듈 기록) */
function OrigPolicy({ children }: { children: ReactNode }) {
  const { loadClients, workspaceId } = useToolClient()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void loadClients()
      .then((list) => hydratePolicyStore(workspaceId, list))
      .catch(() => undefined)
      .then(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [loadClients, workspaceId])
  if (!ready) return <p className="t-sub text-slate-400">상담 기록을 읽는 중…</p>
  return (
    <div className="pf-orig @container" data-testid="pf-orig">
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 진단하기 — 원본 /diagnosis                                            */
/* ------------------------------------------------------------------ */

function DiagnosisScreen() {
  const [params] = useSearchParams()
  const { clientId } = useToolClient()
  const autoSample = params.get('sample') === '1'
  const [seed, setSeed] = useState<{ input: DiagnosisInput; key: number }>(() => ({ input: loadInput(), key: 0 }))

  // 업체에서 열었으면 아는 것을 채운다 (D-90).
  // 이 도구는 기본값이 빈 값이 아니라서(개인사업자·1~3년 …), **아직 손대지 않은 칸만** 바꾼다.
  const { note: prefillNote } = usePrefillFromClient((facts) => {
    const filled: string[] = []
    const next = { ...seed.input }
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
    if (filled.length > 0) setSeed((s) => ({ input: next, key: s.key + 1 }))
    return filled
  })

  const remember = useCallback((input: DiagnosisInput) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
    } catch {
      /* 저장 못 해도 진단은 된다 */
    }
  }, [])

  const extras = useCallback(
    (input: DiagnosisInput, result: DiagnosisResult) => (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4" data-testid="pf-attach">
        <ToolResultAttach
          toolKey="policy-funding"
          title="정책자금 진단"
          verdict={result.likelihoodLevel ?? null}
          verdictLabel={`진행 가능성 ${result.likelihoodLevel} · 1순위 ${result.topAgency}`}
          summary={buildSummary(input, result)}
          data={{ input, agencies: result.agencies, tracks: result.specialTracks, documents: result.documents }}
        />
        <span className="text-sm text-slate-500">진단 결과를 고객 운영 업체 기록(달력·오늘 포함)에 붙입니다.</span>
      </div>
    ),
    [],
  )

  return (
    <OrigPolicy>
      <PrefillNote note={prefillNote} />
      <section className="w-full px-2 pt-6 pb-8 @min-[640px]:pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">규칙 진단</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight @min-[640px]:text-4xl">정책자금 진단</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            DB가 들어온 순간, 이 업체를 어떤 기관으로 안내하고 어떤 말로 상담해야 할지 바로 확인하세요.
          </p>
        </div>
      </section>
      <section className="w-full pb-16">
        <DiagnosisSection
          key={`${seed.key}-${autoSample ? 's' : ''}`}
          autoSample={autoSample}
          initialInput={seed.input}
          presetClientId={clientId ?? undefined}
          extras={extras}
          onInputChange={remember}
        />
      </section>
      <p className="t-meta break-keep text-slate-400">{REPORT_DISCLAIMER}</p>
    </OrigPolicy>
  )
}

/* ------------------------------------------------------------------ */
/* 인쇄 리포트 — 고객을 고르면 원본 /customers/{id}/report                  */
/* ------------------------------------------------------------------ */

function ReportPicker() {
  const list = getStoredCustomers()
  return (
    <section className="mx-auto w-full max-w-4xl px-2 pt-6 pb-16" data-testid="pf-report-picker">
      <h1 className="text-2xl font-bold tracking-tight">인쇄 리포트</h1>
      <p className="mt-2 text-slate-600">고객을 고르면 대표님용 한 페이지 요약 + 상세 리포트가 열립니다.</p>
      {list.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          아직 상담 중인 업체가 없습니다. <Link to="/tools/policy-funding/diagnosis" className="font-semibold text-blue-700 underline">진단하기</Link> 에서 결과를 고객으로 저장하세요.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 @min-[640px]:grid-cols-2">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/tools/policy-funding/report?cid=${c.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-blue-200"
              >
                <span className="min-w-0">
                  <b className="block truncate text-slate-900">{c.companyName}</b>
                  <span className="text-sm text-slate-500">{c.recommendedAgency}{c.diagnosisResult ? '' : ' · 진단 기록 없음'}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE[c.stage]}`}>{c.stage}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** D-98: 업체에서 연 인쇄 리포트 — 그 업체로 저장한 상담이 없으면 '고객을 찾을 수 없습니다' 로 막히지 않고 진단하기로 잇는다 */
function ClientReport({ id }: { id: string }) {
  const { clientName } = useToolClient()
  if (getStoredCustomers().some((c) => c.id === id)) return <ReportView id={id} initialCustomer={null} />
  return (
    <>
      <section className="mx-auto w-full max-w-4xl px-2 pt-6" data-testid="pf-report-none">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
          <p className="break-keep font-semibold text-slate-800">
            {clientName || '이 업체'}로 저장한 정책자금 상담이 아직 없습니다.
          </p>
          <p className="mt-1 break-keep text-sm text-slate-500">진단한 뒤 ‘이 업체 상담으로 저장’을 누르면 여기서 리포트를 뽑을 수 있습니다.</p>
          <Link
            to={`/tools/policy-funding/diagnosis?client=${encodeURIComponent(id)}`}
            className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            이 업체로 진단하기
          </Link>
        </div>
      </section>
      <ReportPicker />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 목차                                                                 */
/* ------------------------------------------------------------------ */

/** 목차에서 고른 화면 → 이 자리에 선다. 목차 자체는 `toolRegistry` 의 sections 가 정한다. */
export function PolicyFundingPage() {
  const section = useModuleSection()
  const meta = toolOf('policy-funding')?.sections?.find((s) => s.key === section)
  const [params] = useSearchParams()
  const { clientId } = useToolClient()
  const cid = params.get('cid')

  if (section === 'diagnosis') return <DiagnosisScreen />
  if (section === 'customers') {
    return <OrigPolicy key={cid ?? ''}>{cid ? <CustomerDetailView id={cid} initialCustomer={null} /> : <DashboardView />}</OrigPolicy>
  }
  if (section === 'report') {
    const id = cid ?? clientId
    return <OrigPolicy key={id ?? ''}>{cid ? <ReportView id={cid} initialCustomer={null} /> : id ? <ClientReport id={id} /> : <ReportPicker />}</OrigPolicy>
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="정책자금 진단"
        description={
          meta?.hint
            ? `${meta.label} — ${meta.hint}. 규칙과 사례로 계산하며, 승인을 보장하지 않습니다.`
            : '추천 기관 TOP3·서류·로드맵·상담 대본. 규칙과 사례로 계산하며, 승인을 보장하지 않습니다.'
        }
      />
      <ModuleDashboard toolKey="policy-funding">
        <PolicyDashboardExtra />
      </ModuleDashboard>
    </div>
  )
}
