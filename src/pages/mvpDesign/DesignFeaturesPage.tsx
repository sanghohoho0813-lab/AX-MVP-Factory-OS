import { useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bot, Lock, UserCheck } from 'lucide-react'
import type { FeatureScope, MvpDesign, MvpFeature } from '../../types/mvpDesign'
import { FEATURE_SCOPES, FEATURE_SCOPE_META } from '../../lib/mvpDesignMeta'
import { GLOSSARY } from '../../lib/glossary'
import { Term } from '../../components/ui/Term'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  AutomationModeBadge,
  FeatureScopeBadge,
  FeatureTypeBadge,
} from '../../components/mvpDesign/badges'
import { DesignEditError, setFeatureScope } from '../../services/mvpDesignService'
import { DesignSectionFrame } from './designShared'

function FeatureCard({ design, feature }: { design: MvpDesign; feature: MvpFeature }) {
  const { showToast } = useToast()
  const editable = design.status !== 'finalized' && design.status !== 'superseded'

  const changeScope = (scope: FeatureScope) => {
    if (scope === feature.scope) return
    try {
      setFeatureScope(design.id, feature.id, scope, '')
    } catch (error) {
      showToast(error instanceof DesignEditError ? error.message : '범위 변경에 실패했습니다.')
    }
  }

  return (
    <li className="rounded-(--radius-card) border border-slate-200 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{feature.name}</p>
            <FeatureTypeBadge type={feature.type} />
            <AutomationModeBadge mode={feature.automationMode} />
          </div>
          <p className="mt-1 text-[0.92rem] break-keep text-slate-500">{feature.summary}</p>
        </div>
        <FeatureScopeBadge scope={feature.scope} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <IoBox label="입력" value={feature.input} />
        <IoBox label="처리" value={feature.processing} />
        <IoBox label="출력" value={feature.output} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {feature.usesAi && (
          <span className="inline-flex items-center gap-1 text-xs text-accent-600"><Bot aria-hidden="true" className="size-3.5" />AI 보조</span>
        )}
        {feature.humanReviewRequired && (
          <span className="inline-flex items-center gap-1 text-xs text-warning-600"><UserCheck aria-hidden="true" className="size-3.5" />사람 확정</span>
        )}
        {feature.expertJudgmentBoundary && (
          <span className="inline-flex items-center gap-1 text-xs text-danger-600"><AlertTriangle aria-hidden="true" className="size-3.5" />전문가 최종판단 영역</span>
        )}
        {feature.evidence.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400"><ArrowRight aria-hidden="true" className="size-3" />{feature.evidence[0].label}</span>
        )}
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">범위 변경:</span>
          {FEATURE_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => changeScope(scope)}
              className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                scope === feature.scope
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {FEATURE_SCOPE_META[scope].label.split(' · ')[0]}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

function IoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-(--radius-control) bg-slate-50 px-3 py-2">
      <p className="text-[0.82rem] font-semibold text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs break-keep text-slate-600">{value || '-'}</p>
    </div>
  )
}

export function DesignFeaturesPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design) => {
        const groups: { scope: FeatureScope; features: MvpFeature[] }[] = FEATURE_SCOPES.map((scope) => ({
          scope,
          features: design.features.filter((f) => f.scope === scope).sort((a, b) => a.order - b.order),
        }))
        return (
          <>
            <div className="rounded-(--radius-card) border border-brand-100 bg-brand-50/50 px-4 py-3">
              <p className="flex items-start gap-2 text-[0.92rem] break-keep text-slate-600">
                <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
                1차 MVP는 Must 기능에 집중합니다. 검증되지 않은 기능은 Should/Later로 미루고, 각 기능은 입력·처리·출력으로 정의합니다.
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <Term label="Must" description={GLOSSARY.Must} />
                <Term label="Should" description={GLOSSARY.Should} />
                <Term label="Later" description={GLOSSARY.Later} />
                <Term label="Excluded" description={GLOSSARY.Excluded} />
              </p>
            </div>
            {groups.map((group) =>
              group.features.length === 0 ? null : (
                <Panel key={group.scope} title={`${FEATURE_SCOPE_META[group.scope].label} · ${group.features.length}건`}>
                  <ul className="flex flex-col gap-3">
                    {group.features.map((feature) => (
                      <FeatureCard key={feature.id} design={design} feature={feature} />
                    ))}
                  </ul>
                </Panel>
              ),
            )}
          </>
        )
      }}
    />
  )
}
