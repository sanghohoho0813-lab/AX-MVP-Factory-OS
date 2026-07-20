import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardList,
  Cpu,
  FlaskConical,
  Gauge,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  Target,
} from 'lucide-react'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { GATE_META, GATE_NUMBERS } from '../../lib/validationMeta'
import { summarize, type TrackContext } from '../../services/validationService'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { GateStatusBadge, QualitySeverityBadge } from '../../components/validation/badges'
import { ReadOnlyNotice, TrackSectionFrame } from './validationShared'

interface NextStep {
  title: string
  description: string
  label: string
  path: string
}

function computeNextStep(w: ValidationWorkspace, base: string): NextStep {
  const hasActiveBuild = w.buildArtifacts.some((b) => b.isCurrent)
  const hasReadyScenario = w.scenarios.some((s) => s.status === 'ready')
  const hasRound = w.rounds.length > 0
  const hasOpenCritical = w.issues.some(
    (i) =>
      i.severity === 'critical' &&
      i.status !== 'verified' &&
      i.status !== 'wont_fix' &&
      i.status !== 'accepted_risk',
  )

  if (!hasActiveBuild) {
    return {
      title: '테스트 버전을 등록하세요.',
      description: '어떤 제작물(링크·파일 위치)로 테스트할지 지정해야 회차를 시작할 수 있습니다.',
      label: '제작·참여자로 이동',
      path: `${base}/build`,
    }
  }
  if (!hasReadyScenario) {
    return {
      title: '테스트 시나리오를 준비하세요.',
      description: '실제로 검증할 시나리오가 준비되어야 회차에서 통과 여부를 기록할 수 있습니다.',
      label: '시나리오로 이동',
      path: `${base}/scenarios`,
    }
  }
  if (!hasRound) {
    return {
      title: '첫 테스트 회차를 만드세요.',
      description: '참여자·시나리오를 묶어 회차를 진행하면 실제 사용 결과가 기록됩니다.',
      label: '회차로 이동',
      path: `${base}/rounds`,
    }
  }
  if (hasOpenCritical) {
    return {
      title: '미해결 critical 이슈를 처리하세요.',
      description: 'critical 이슈가 남아 있으면 Gate 6 통과와 검증 확정이 막힙니다.',
      label: '피드백·이슈로 이동',
      path: `${base}/feedback`,
    }
  }
  return {
    title: 'Gate를 판정하고 다음 단계를 결정하세요.',
    description: '결과를 근거로 Gate를 판정한 뒤, 유지·수정·확대·운영·보류·중단을 결정합니다.',
    label: 'Gate로 이동',
    path: `${base}/gates`,
  }
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs break-keep text-slate-400">{hint}</p>}
    </div>
  )
}

function OverviewBody({
  w,
  track,
  projectId,
  trackType,
}: {
  w: ValidationWorkspace
  track: TrackContext
  projectId: string
  trackType: ValidationTrackType
}) {
  const navigate = useNavigate()
  const base = `/validation/projects/${projectId}/${trackType}`
  const summary = summarize(w)
  const nextStep = computeNextStep(w, base)
  const blockingQuality = w.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)

  const quickLinks = [
    { to: `${base}/plan`, label: '테스트 계획', icon: ClipboardList },
    { to: `${base}/build`, label: '제작·참여자', icon: Cpu },
    { to: `${base}/scenarios`, label: '시나리오', icon: ListChecks },
    { to: `${base}/rounds`, label: '회차', icon: FlaskConical },
    { to: `${base}/feedback`, label: '피드백·이슈', icon: MessageSquare },
    { to: `${base}/metrics`, label: 'KPI', icon: Gauge },
    { to: `${base}/gates`, label: 'Gate', icon: ShieldCheck },
    { to: `${base}/decision`, label: '결정', icon: Target },
  ]

  return (
    <>
      <ReadOnlyNotice workspace={w} />

      {track.needsRevalidationFlag && (
        <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3 text-[13px] break-keep text-warning-700">
          출처 설계가 새 버전으로 확정되었거나 검증 규칙이 갱신되었습니다. 결과 해석 전 재검증이 필요할 수 있습니다.
        </div>
      )}

      {/* 지금 해야 할 일 */}
      <section aria-label="지금 해야 할 일" className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">지금 해야 할 일</p>
        <p className="mt-1.5 text-base font-semibold break-keep text-slate-900">{nextStep.title}</p>
        <p className="mt-1 text-[13px] break-keep text-slate-600">{nextStep.description}</p>
        {!(w.status === 'finalized' || w.status === 'superseded') && (
          <div className="mt-3">
            <Button variant="primary" onClick={() => navigate(nextStep.path)}>
              {nextStep.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="자동 요약">
            <p className="text-[13px] leading-relaxed break-keep text-slate-700">{summary.headline}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="필수 통과율"
                value={`${summary.requiredPassRate}%`}
                hint={`통과 ${summary.requiredPassed}/${summary.requiredTotal}`}
              />
              <StatCard label="미해결 이슈" value={`${summary.openIssues}건`} hint={summary.hasOpenCritical ? 'critical 포함' : undefined} />
              <StatCard label="완료 회차" value={`${summary.completedRounds}/${summary.totalRounds}`} />
              <StatCard label="KPI 측정" value={`${summary.metricsMeasured}/${summary.metricsDefined}`} hint={summary.metricsMeasured === 0 ? '측정 필요' : undefined} />
              <StatCard label="Gate 통과" value={`${summary.gatesPassed}/8`} />
              <StatCard label="필수 미측정" value={`${summary.requiredNotRun}건`} hint={summary.requiredNotRun > 0 ? '테스트 진행 필요' : undefined} />
            </div>
          </Panel>

          <Panel title="진행 상황">
            <p className="mb-3 text-[13px] break-keep text-slate-500">Gate 0부터 7까지의 판정 상태입니다.</p>
            <ul className="flex flex-col gap-2">
              {GATE_NUMBERS.map((gate) => {
                const gr = w.gateReviews.find((g) => g.gate === gate)
                return (
                  <li key={gate} className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                    <span className="min-w-0 text-[13px] font-medium break-keep text-slate-700">{GATE_META[gate].label}</span>
                    {gr ? <GateStatusBadge status={gr.status} /> : <span className="text-xs text-slate-400">미생성</span>}
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="점검 상태">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-600">해결할 오류</span>
              <span className={blockingQuality.length > 0 ? 'font-semibold text-danger-600' : 'text-slate-400'}>
                {blockingQuality.length}건
              </span>
            </div>
            {blockingQuality.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {blockingQuality.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <QualitySeverityBadge severity={c.severity} />
                    <span className="min-w-0 text-xs break-keep text-slate-600">{c.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] break-keep text-slate-500">해결해야 할 오류가 없습니다.</p>
            )}
          </Panel>

          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {quickLinks.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

export function TrackOverviewPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w, _context, track) => (
        <OverviewBody w={w} track={track} projectId={projectId} trackType={trackType as ValidationTrackType} />
      )}
    />
  )
}
