import { useParams } from 'react-router-dom'
import { AlertTriangle, Bot, PlugZap, ShieldCheck, ZapOff } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import { EmptyState } from '../../components/ui/EmptyState'
import { AI_PURPOSE_META, EXCEPTION_KIND_META } from '../../lib/mvpDesignMeta'
import {
  BusinessRuleTypeBadge,
  IntegrationReadinessBadge,
} from '../../components/mvpDesign/badges'
import { DesignSectionFrame } from './designShared'

export function DesignRulesPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const rules = [...design.businessRules].sort((a, b) => a.order - b.order)
        return (
          <>
            <Panel title={`업무 규칙 · ${rules.length}건`}>
              <p className="mb-3 text-[0.92rem] break-keep text-slate-500">
                예쁜 화면이 아니라 업무 규칙(조건 → 결과)을 정의합니다. 확인이 필요한 규칙은 담당자 검토 후 확정합니다.
              </p>
              <ul className="flex flex-col gap-2.5">
                {rules.map((rule) => (
                  <li key={rule.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{rule.name}</p>
                      <BusinessRuleTypeBadge type={rule.type} />
                      {rule.needsConfirmation && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-1.5 py-0.5 text-[0.82rem] font-medium text-warning-700">
                          <AlertTriangle aria-hidden="true" className="size-3" />담당자 확인 필요
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[0.92rem] break-keep text-slate-600">
                      <span className="font-medium text-slate-500">조건</span> {rule.condition} → <span className="font-medium text-slate-500">결과</span> {rule.outcome}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={`AI 기능 · ${design.aiFeatures.length}건`}>
              {design.aiFeatures.length === 0 ? (
                <div className="flex items-start gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.92rem] text-slate-500">
                  <ZapOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  이 설계는 규칙 기반으로 충분해 AI를 사용하지 않습니다. 불필요한 곳에 AI를 넣지 않습니다.
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {design.aiFeatures.map((ai) => (
                    <li key={ai.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Bot aria-hidden="true" className="size-4 text-accent-500" />
                        <p className="text-sm font-semibold text-slate-800">{ai.name}</p>
                        <span className="rounded-md border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[0.82rem] text-accent-700">{AI_PURPOSE_META[ai.purpose].label}</span>
                        {ai.humanConfirms && (
                          <span className="inline-flex items-center gap-1 text-[0.875rem] text-warning-600"><ShieldCheck aria-hidden="true" className="size-3.5" />사람이 확정</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[0.92rem] break-keep text-slate-600">{ai.justification}</p>
                      <p className="mt-1 text-[0.875rem] text-slate-400">대체 방식: {ai.fallback}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title={`외부 연동 · ${design.integrations.length}건`}>
                {design.integrations.length === 0 ? (
                  <EmptyState icon={PlugZap} title="외부 연동 없음" description="1차 범위에서는 외부 연동 없이 독립 동작합니다." />
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {design.integrations.map((i) => (
                      <li key={i.id} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{i.name}</p>
                          <IntegrationReadinessBadge readiness={i.readiness} />
                        </div>
                        <p className="mt-1 text-[0.92rem] break-keep text-slate-500">{i.purpose}</p>
                        {i.fallbackWhenNotReady && (
                          <p className="mt-1 text-[0.875rem] break-keep text-warning-600">미준비 시: {i.fallbackWhenNotReady}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={`예외·오류 시나리오 · ${design.exceptions.length}건`}>
                <ul className="flex flex-col gap-2">
                  {design.exceptions.map((e) => {
                    const meta = EXCEPTION_KIND_META[e.kind]
                    return (
                      <li key={e.id} className="rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <meta.icon aria-hidden="true" className="size-3.5 text-slate-400" />
                          <p className="text-[0.92rem] font-medium text-slate-700">{e.situation}</p>
                        </div>
                        <p className="mt-1 text-[0.875rem] break-keep text-slate-500">→ {e.handling}</p>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </div>
          </>
        )
      }}
    />
  )
}
