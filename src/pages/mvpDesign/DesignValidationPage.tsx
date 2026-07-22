import { useParams } from 'react-router-dom'
import { ClipboardCheck, FlaskConical, Target } from 'lucide-react'
import type { MvpDesign } from '../../types/mvpDesign'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  KPI_DIRECTION_META,
  TEST_KIND_META,
} from '../../lib/mvpDesignMeta'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  GuardrailStatusBadge,
  QualitySeverityBadge,
} from '../../components/mvpDesign/badges'
import { DesignSectionFrame } from './designShared'

function featureName(design: MvpDesign, id: string | null): string {
  if (!id) return '전체'
  return design.features.find((f) => f.id === id)?.name ?? '기능'
}

export function DesignValidationPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const errors = design.qualityChecks.filter((c) => c.severity === 'error')
        const others = design.qualityChecks.filter((c) => c.severity !== 'error')
        return (
          <>
            <Panel title="설계 품질 점검">
              {design.qualityChecks.length === 0 ? (
                <p className="text-[0.92rem] text-success-700">점검 항목을 모두 통과했습니다.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...errors, ...others].map((c, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                      <QualitySeverityBadge severity={c.severity} />
                      <span className="min-w-0 text-[0.92rem] break-keep text-slate-600">{c.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {errors.length > 0 && (
                <p className="mt-3 text-[0.92rem] font-medium text-danger-600">오류 {errors.length}건을 해결해야 설계를 확정할 수 있습니다.</p>
              )}
            </Panel>

            <Panel title="범위 가드레일">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {design.guardrailChecks.map((g) => (
                  <li key={g.key} className="flex items-center justify-between gap-2 rounded-(--radius-card) border border-slate-200 px-3.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[0.92rem] text-slate-700">{g.label}</p>
                      <p className="text-[0.875rem] text-slate-400">{g.message}</p>
                    </div>
                    <GuardrailStatusBadge status={g.status} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={`수용 기준 · ${design.acceptanceCriteria.length}건`}>
              {design.acceptanceCriteria.length === 0 ? (
                <EmptyState icon={ClipboardCheck} title="수용 기준 없음" description="Must 기능에 검증 기준을 정의하세요." />
              ) : (
                <ul className="flex flex-col gap-2">
                  {design.acceptanceCriteria.map((a) => (
                    <li key={a.id} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5 text-[0.92rem]">
                      <p className="text-[0.875rem] font-semibold text-slate-400">{featureName(design, a.featureId)}</p>
                      <p className="mt-1 break-keep text-slate-600">
                        <span className="text-slate-400">조건</span> {a.given} · <span className="text-slate-400">실행</span> {a.when} · <span className="text-slate-400">기대</span> {a.then}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title={`테스트 시나리오 · ${design.testScenarios.length}건`}>
                <ul className="flex flex-col gap-2">
                  {design.testScenarios.map((t) => (
                    <li key={t.id} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <FlaskConical aria-hidden="true" className="size-3.5 text-slate-400" />
                        <p className="text-[0.92rem] font-medium text-slate-700">{t.title}</p>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[0.82rem] font-medium ${TONE_BADGE_CLASS[TEST_KIND_META[t.kind].tone]}`}>
                          {TEST_KIND_META[t.kind].label}
                        </span>
                      </div>
                      <p className="mt-1 text-[0.875rem] break-keep text-slate-500">{t.steps.join(' → ')} · 기대: {t.expected}</p>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title={`KPI · ${design.kpis.length}건`}>
                {design.kpis.length === 0 ? (
                  <EmptyState icon={Target} title="KPI 없음" description="검증에 사용할 성과 지표를 정의하세요." />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {design.kpis.map((k) => (
                      <li key={k.id} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">{KPI_DIRECTION_META[k.direction].symbol}</span>
                          <p className="text-[0.92rem] font-medium text-slate-700">{k.name}</p>
                        </div>
                        <p className="mt-0.5 text-[0.875rem] text-slate-500">
                          {k.notEstimable ? '목표값은 검증 단계에서 측정 · ' : ''}{k.measureMethod}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        )
      }}
    />
  )
}
