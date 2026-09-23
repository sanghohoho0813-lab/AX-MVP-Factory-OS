/**
 * 인쇄 리포트 — 대표님 한 페이지 요약 (D-91).
 *
 * 원본(app/clients/[id]/report)의 리포트 모델(report.ts · buildReportModel)을 그대로 쓴다.
 * 진단 화면에서 '이 업체 상담으로 저장' 을 누르면 그 업체의 진단이 남고, 여기서 그것으로 리포트를 만든다.
 *
 * 인쇄는 브라우저가 한다 — 따로 PDF 라이브러리를 넣지 않는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { buildReportModel } from '../report'
import type { Customer, DiagnosisInput, DiagnosisResult } from '../types'
import { emptyConsult, type ConsultData } from '../lib/consultRecord'

interface DiagnosisRow extends Record<string, unknown> {
  input: DiagnosisInput
  result: DiagnosisResult
  savedAt: string
}

export function PrintReportScreen() {
  const { loadClients, clientId } = useToolClient()
  const consults = useModuleBucket<ConsultData>('policy-funding', 'consults')
  const diagnoses = useModuleBucket<DiagnosisRow>('policy-funding', 'diagnoses')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [picked, setPicked] = useState(clientId ?? '')

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const withDiagnosis = useMemo(
    () => (clients ?? []).filter((c) => (diagnoses.rows ?? []).some((r) => r.clientId === c.id)),
    [clients, diagnoses.rows],
  )

  useEffect(() => {
    setPicked((cur) => (withDiagnosis.some((c) => c.id === cur) ? cur : withDiagnosis[0]?.id ?? ''))
  }, [withDiagnosis])

  const model = useMemo(() => {
    const client = (clients ?? []).find((c) => c.id === picked)
    const dx = (diagnoses.rows ?? []).find((r) => r.clientId === picked)
    if (!client || !dx) return null
    const consult = (consults.rows ?? []).find((r) => r.clientId === picked)?.data ?? emptyConsult()
    const customer: Customer = {
      id: client.id,
      companyName: client.companyName,
      industry: dx.data.input.industry || client.industry || '',
      businessType: dx.data.input.businessType,
      recommendedAgency: consult.topAgency || dx.data.result.topAgency,
      score: consult.score ?? dx.data.result.overallScore,
      stage: consult.stage,
      nextAction: consult.nextAction,
      lastContactedAt: consult.lastContactedAt,
      updatedAt: dx.data.savedAt,
      upsellOpportunities: (dx.data.result.upsells ?? []).map((u) => u.title),
      memo: consult.memo,
      diagnosisInput: dx.data.input,
      diagnosisResult: dx.data.result,
    }
    return buildReportModel(customer)
  }, [clients, diagnoses.rows, consults.rows, picked])

  if (clients === null || diagnoses.rows === null || consults.rows === null) {
    return <p className="t-sub text-slate-400">리포트 재료를 읽는 중…</p>
  }

  if (withDiagnosis.length === 0) {
    return (
      <Surface edge="brand" showEdge>
        <p className="t-sub break-keep text-slate-600" data-testid="pf-report-empty">
          아직 저장된 진단이 없습니다.{' '}
          <Link to="/tools/policy-funding/diagnosis" className="font-bold text-brand-700 hover:underline">
            진단하기
          </Link>{' '}
          에서 업체를 물고 진단한 뒤 <b>이 업체 상담으로 저장</b> 을 누르면 여기에 리포트가 생깁니다.
        </p>
      </Surface>
    )
  }

  return (
    <div className="flex flex-col gap-5" data-testid="pf-report">
      <Surface>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[14rem] flex-1">
            <span className="t-sub font-medium text-slate-600">업체</span>
            <select
              aria-label="리포트 업체"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
            >
              {withDiagnosis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" /> 인쇄·PDF
          </Button>
        </div>
      </Surface>

      {model && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <MetricTile label="1순위 기관" value={model.topAgency} hint={`${model.score}점`} tone="brand" />
            <MetricTile label="진행 가능성" value={model.likelihood} hint={'★'.repeat(model.stars)} />
            <MetricTile label="예상 기간" value={model.estimatedPeriod} />
            <MetricTile label="가장 큰 리스크" value={model.riskKeyword} tone="warning" />
          </div>

          <Section title="대표님 한 페이지 요약">
            <Surface>
              <div className="flex flex-col gap-2">
                <p className="t-card font-bold break-keep text-slate-900">{model.companyName}</p>
                <p className="t-sub break-keep text-slate-700">
                  <b>핵심 전략</b> — {model.coreStrategy}
                </p>
                <p className="t-sub break-keep text-slate-700">
                  <b>가장 큰 리스크</b> — {model.biggestRisk}
                </p>
                <p className="t-sub break-keep text-slate-700">
                  <b>먼저 챙길 서류</b> — {model.keyPrep}
                </p>
                {model.nextAction && (
                  <p className="t-sub break-keep text-slate-700">
                    <b>다음에 할 일</b> — {model.nextAction}
                  </p>
                )}
              </div>
            </Surface>
          </Section>

          <Section title="추천 기관" count={model.agencies.length}>
            <ul className="flex flex-col gap-2" data-testid="pf-report-agencies">
              {model.agencies.map((a) => (
                <li key={`${a.rank}-${a.name}`}>
                  <Surface as="div">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={a.rank === 1 ? 'brand' : 'neutral'}>{a.rank}순위</Badge>
                        <span className="t-sub font-bold text-slate-900">{a.name}</span>
                        {a.score !== null && <span className="t-meta text-slate-500">{a.score}점</span>}
                      </div>
                      {a.reasons.length > 0 && (
                        <ul className="t-meta flex list-disc flex-col gap-0.5 pl-5 text-slate-600">
                          {a.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                      {a.cautions.length > 0 && (
                        <ul className="t-meta flex list-disc flex-col gap-0.5 pl-5 text-amber-700">
                          {a.cautions.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Surface>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="필요 서류" count={model.documents.length}>
            <Surface>
              <ul className="t-sub flex list-disc flex-col gap-1 pl-5 text-slate-700" data-testid="pf-report-docs">
                {model.documents.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Surface>
          </Section>

          <Section title="90일 로드맵" count={model.roadmap.length}>
            <Surface>
              <ol className="t-sub flex list-decimal flex-col gap-1 pl-5 text-slate-700">
                {model.roadmap.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </Surface>
          </Section>

          {model.supportPrograms.some((p) => p.recommended) && (
            <Section title="함께 검토할 지원제도">
              <ul className="flex flex-col gap-2">
                {model.supportPrograms
                  .filter((p) => p.recommended)
                  .map((p) => (
                    <li key={p.title}>
                      <Surface as="div">
                        <p className="t-sub font-bold text-slate-900">{p.title}</p>
                        <p className="t-meta break-keep text-slate-600">{p.desc}</p>
                      </Surface>
                    </li>
                  ))}
              </ul>
            </Section>
          )}

          <p className="t-meta break-keep text-slate-400">{model.disclaimer}</p>
        </>
      )}
    </div>
  )
}
