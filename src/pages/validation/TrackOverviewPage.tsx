import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ListChecks, MessageSquare, Wrench } from 'lucide-react'
import type {
  ValidationGateNumber,
  ValidationTrackType,
  ValidationWorkspace,
} from '../../types/validation'
import { GATE_META, GATE_NUMBERS, TRACK_META } from '../../lib/validationMeta'
import { summarize, type TrackContext } from '../../services/validationService'
import { Panel } from '../../components/ui/Panel'
import {
  FeedbackTypeBadge,
  GateStatusBadge,
  IssueStatusBadge,
  QualitySeverityBadge,
  SeverityBadge,
} from '../../components/validation/badges'
import {
  WorkspaceShell,
  WorkspaceNextAction,
  WorkspaceSummaryLine,
  WorkspaceCompletionChecklist,
  WorkspaceWarningPanel,
  WorkspaceNextStep,
  type ChecklistItem,
  type WorkspaceWarning,
} from '../../components/workspace/WorkspaceShell'
import {
  VALIDATION_MODULE_DESC,
  VALIDATION_MODULE_NAME,
  ReadOnlyNotice,
  TrackGateNotice,
  ValidationModuleHeader,
  ValidationProjectNotFound,
  validationSteps,
} from './validationShared'
import { useValidationData } from './useValidationData'

/**
 * Gate 번호를 앞세우지 않고 쉬운 이름을 주 라벨로 쓴다.
 * Gate 번호는 보조(작은 글씨)로만 노출한다.
 */
const PLAIN_GATE_LABEL: Record<ValidationGateNumber, string> = {
  gate_0: '문제 확인',
  gate_1: '먼저 만들 업무 확인',
  gate_2: '설계 준비 확인',
  gate_3: '테스트 버전 준비',
  gate_4: '테스트 준비 완료',
  gate_5: '실제 테스트 실행',
  gate_6: '결과 검토',
  gate_7: '다음 결정',
}

interface NextInfo {
  title: string
  why: string
  label: string
  path: string
  tone?: 'brand' | 'success'
}

/** 지금 해야 할 일 (한 화면에 핵심 행동 하나) */
function computeNext(w: ValidationWorkspace, base: string): NextInfo {
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
      title: '테스트할 버전을 등록하세요.',
      why: '어떤 제작물(링크·파일 위치)로 시험할지 지정해야 회차를 시작할 수 있습니다.',
      label: '테스트 버전 등록하기',
      path: `${base}/build`,
    }
  }
  if (!hasReadyScenario) {
    return {
      title: '확인할 시나리오를 준비하세요.',
      why: '실제로 확인할 시나리오가 준비되어야 회차에서 통과 여부를 기록할 수 있습니다.',
      label: '시나리오 준비하기',
      path: `${base}/scenarios`,
    }
  }
  if (!hasRound) {
    return {
      title: '첫 테스트 회차를 만드세요.',
      why: '참여자와 시나리오를 묶어 회차를 진행하면 실제 사용 결과가 기록됩니다.',
      label: '참여자·회차로 이동',
      path: `${base}/rounds`,
    }
  }
  if (hasOpenCritical) {
    return {
      title: '미해결 차단 문제를 처리하세요.',
      why: '중대(critical) 이슈가 남아 있으면 결과 검토 통과와 검증 확정이 막힙니다.',
      label: '피드백·문제로 이동',
      path: `${base}/feedback`,
    }
  }
  return {
    title: '단계를 판정하고 다음 단계를 결정하세요.',
    why: '결과를 근거로 단계를 판정한 뒤 유지·수정·확대·운영·보류·중단을 결정합니다.',
    label: '단계 판정으로 이동',
    path: `${base}/gates`,
    tone: 'success',
  }
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
  const [showExpert, setShowExpert] = useState(false)
  const base = `/validation/projects/${projectId}/${trackType}`
  const summary = summarize(w)

  const currentBuild = w.buildArtifacts.find((b) => b.isCurrent)
  const requiredScenarios = w.scenarios.filter((s) => s.required && s.status !== 'retired')
  const readyRequiredScenarios = requiredScenarios.filter((s) => s.status === 'ready')
  const openIssues = w.issues.filter(
    (i) => i.status !== 'verified' && i.status !== 'wont_fix' && i.status !== 'accepted_risk',
  )
  const blockingQuality = w.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)
  const readOnly = w.status === 'finalized' || w.status === 'superseded'

  // 현재 판정 단계 (통과하지 못한 첫 단계 = 지금 다루는 단계)
  const currentGate: ValidationGateNumber =
    GATE_NUMBERS.find((g) => !summary.gateProgress.find((p) => p.gate === g)?.passed) ?? 'gate_7'

  // 지금 해야 할 일
  const next: NextInfo = (() => {
    if (w.status === 'finalized') {
      return {
        title: '검증이 확정되었습니다.',
        why: '결과와 다음 결정을 확인할 수 있습니다. 원본 보존을 위해 읽기 전용입니다.',
        label: '결과·다음 결정 보기',
        path: `${base}/decision`,
        tone: 'success',
      }
    }
    if (w.status === 'superseded') {
      return {
        title: '이전 버전입니다.',
        why: '이 검증은 새 버전으로 대체되었습니다. 읽기 전용으로 열람만 가능합니다.',
        label: '트랙 선택으로 이동',
        path: `/validation/projects/${projectId}`,
      }
    }
    return computeNext(w, base)
  })()

  const checklist: ChecklistItem[] = [
    { ok: !!currentBuild, label: '테스트할 버전이 등록됨', actionPath: `${base}/build`, actionLabel: '테스트 버전 등록하기' },
    { ok: w.participants.length > 0, label: '참여자가 등록됨', actionPath: `${base}/build`, actionLabel: '참여자 등록하기' },
    { ok: readyRequiredScenarios.length > 0, label: '확인할 시나리오가 준비됨', actionPath: `${base}/scenarios`, actionLabel: '시나리오 준비하기' },
    { ok: summary.completedRounds > 0, label: '테스트 회차가 완료됨', actionPath: `${base}/rounds`, actionLabel: '회차 진행하기' },
    { ok: !summary.hasOpenCritical, label: '미해결 차단(critical) 문제 없음', actionPath: `${base}/feedback`, actionLabel: '문제 확인하기' },
    { ok: summary.metricsMeasured > 0, label: '성과(KPI)가 측정됨', actionPath: `${base}/metrics`, actionLabel: '성과 측정하기' },
    { ok: w.finalDecision.type !== null, label: '다음 단계가 결정됨', actionPath: `${base}/decision`, actionLabel: '다음 결정하기' },
  ]

  const warns: WorkspaceWarning[] = [
    ...(summary.hasOpenCritical
      ? [{ tone: 'error' as const, message: '미해결 차단(critical) 문제가 있어 검증을 확정할 수 없습니다.', actionPath: `${base}/feedback`, actionLabel: '피드백·문제로 이동' }]
      : []),
    ...blockingQuality.slice(0, 3).map((c) => ({ tone: 'error' as const, message: c.description, actionPath: `${base}/gates`, actionLabel: '단계 판정으로 이동' })),
    ...(summary.requiredNotRun > 0
      ? [{ tone: 'warn' as const, message: `필수 시나리오 ${summary.requiredNotRun}건이 아직 측정되지 않았습니다.`, actionPath: `${base}/rounds`, actionLabel: '회차 진행하기' }]
      : []),
    ...(track.needsRevalidationFlag
      ? [{ tone: 'warn' as const, message: '출처 설계가 새 버전으로 확정되었거나 검증 규칙이 갱신되었습니다. 결과 해석 전 재검증이 필요할 수 있습니다.' }]
      : []),
  ]

  const summaryPanel = (
    <>
      <div>
        <WorkspaceSummaryLine label="테스트 대상" value={TRACK_META[trackType].label} />
        <WorkspaceSummaryLine
          label="현재 테스트 버전"
          value={currentBuild ? `${currentBuild.name}${currentBuild.version ? ` v${currentBuild.version}` : ''}` : '미등록'}
          tone={currentBuild ? 'default' : 'warn'}
        />
        <WorkspaceSummaryLine label="참여자" value={`${w.participants.length}명`} />
        <WorkspaceSummaryLine label="필수 시나리오" value={`${requiredScenarios.length}개`} />
        <WorkspaceSummaryLine label="완료 회차" value={`${summary.completedRounds}/${summary.totalRounds}회`} />
        <WorkspaceSummaryLine
          label="미해결 문제"
          value={`${summary.openIssues}건${summary.hasOpenCritical ? ' (차단 포함)' : ''}`}
          tone={summary.hasOpenCritical ? 'warn' : 'default'}
        />
        <WorkspaceSummaryLine
          label="현재 판정 단계"
          value={
            <span className="inline-flex flex-col items-end">
              <span>{PLAIN_GATE_LABEL[currentGate]}</span>
              <span className="text-[0.75rem] font-normal text-slate-400">Gate {GATE_META[currentGate].index}</span>
            </span>
          }
        />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
      {summary.finalizeReady && !readOnly && (
        <WorkspaceNextStep label="단계 판정 후 다음 단계를 결정하세요" path={`${base}/decision`} />
      )}
    </>
  )

  return (
    <WorkspaceShell
      moduleName={VALIDATION_MODULE_NAME}
      moduleDescription={VALIDATION_MODULE_DESC}
      saveStatus="local"
      steps={validationSteps(projectId, trackType)}
      currentKey="overview"
      nextAction={<WorkspaceNextAction title={next.title} why={next.why} actionLabel={next.label} actionPath={next.path} tone={next.tone} />}
      summary={summaryPanel}
    >
      <div className="flex flex-col gap-5">
        <ReadOnlyNotice workspace={w} />

        {/* 쉬운 말 요약 */}
        <Panel title="이 테스트 요약">
          <p className="text-[1.05rem] leading-relaxed break-keep text-slate-800">{summary.headline}</p>
          <dl className="mt-4 flex flex-col gap-3">
            {w.objective && <DefItem label="테스트 목표" value={w.objective} />}
            {w.targetUsers && <DefItem label="대상 사용자" value={w.targetUsers} />}
          </dl>
        </Panel>

        {/* 확인할 시나리오 — 사용자가 해야 할 일 / 기대 결과 / 통과 기준 / 필요한 증거 / 필수 여부 */}
        <Panel title="확인할 시나리오">
          {requiredScenarios.length === 0 ? (
            <p className="text-[0.95rem] break-keep text-slate-500">아직 확인할 필수 시나리오가 없습니다. ‘확인할 시나리오’ 화면에서 준비하세요.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {requiredScenarios.slice(0, 4).map((s) => (
                <li key={s.id} className="rounded-(--radius-control) border border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[1.05rem] font-semibold break-keep text-slate-800">{s.title}</p>
                    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.82rem] font-medium ${s.required ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {s.required ? '필수' : '선택'}
                    </span>
                  </div>
                  <dl className="mt-2 flex flex-col gap-1.5">
                    <ScenarioField label="사용자가 해야 할 일" value={s.steps.length > 0 ? s.steps.join(' → ') : s.description} />
                    <ScenarioField label="기대 결과" value={s.expectedResult} />
                    <ScenarioField label="통과 기준" value={s.passRule} />
                    <ScenarioField label="필요한 증거" value={s.requiredEvidence} />
                  </dl>
                </li>
              ))}
              {requiredScenarios.length > 4 && (
                <li className="text-[0.9rem] text-slate-400">외 {requiredScenarios.length - 4}건</li>
              )}
            </ul>
          )}
        </Panel>

        {/* 피드백과 이슈를 명확히 분리 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="사용자 피드백 (의견·불편·요청)">
            {w.feedbackItems.length === 0 ? (
              <p className="text-[0.95rem] break-keep text-slate-500">아직 기록된 사용자 피드백이 없습니다.</p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[0.9rem] break-keep text-slate-500">
                  <MessageSquare aria-hidden="true" className="size-4 text-slate-400" />
                  사용자의 의견·불편·요청입니다. 수정 대상 오류가 아닙니다.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {w.feedbackItems.slice(0, 5).map((f) => (
                    <li key={f.id} className="flex items-start gap-2 rounded-(--radius-control) border border-slate-100 px-3.5 py-2.5">
                      <FeedbackTypeBadge type={f.type} />
                      <span className="min-w-0 flex-1 text-[0.95rem] break-keep text-slate-700">{f.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title="수정할 이슈 (오류·차단 문제)">
            {openIssues.length === 0 ? (
              <p className="text-[0.95rem] break-keep text-slate-500">미해결 이슈가 없습니다.</p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[0.9rem] break-keep text-slate-500">
                  <Wrench aria-hidden="true" className="size-4 text-slate-400" />
                  실제로 수정해야 할 오류·차단 문제입니다.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {openIssues.slice(0, 5).map((i) => (
                    <li key={i.id} className="flex items-start gap-2 rounded-(--radius-control) border border-slate-100 px-3.5 py-2.5">
                      <SeverityBadge severity={i.severity} />
                      <span className="min-w-0 flex-1 text-[0.95rem] break-keep text-slate-700">{i.title}</span>
                      <IssueStatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowExpert((v) => !v)}
            aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold break-keep text-slate-700"
          >
            전문가·시스템 정보 (단계 판정·점검·성과·버전)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2 text-[0.82rem] text-slate-400">
                <span>검증 v{w.version}</span>
                <span>단계 통과 {summary.gatesPassed}/8</span>
                <span>규칙 {w.ruleVersion}</span>
              </div>

              <Panel title="단계별 판정 상태">
                <p className="mb-3 flex items-center gap-1.5 text-[0.9rem] break-keep text-slate-500">
                  <ListChecks aria-hidden="true" className="size-4 text-slate-400" />
                  문제 확인부터 다음 결정까지 8단계 판정 상태입니다.
                </p>
                <ul className="flex flex-col gap-2">
                  {GATE_NUMBERS.map((gate) => {
                    const gr = w.gateReviews.find((g) => g.gate === gate)
                    return (
                      <li key={gate} className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[0.95rem] font-medium break-keep text-slate-700">{PLAIN_GATE_LABEL[gate]}</span>
                          <span className="text-[0.78rem] text-slate-400">Gate {GATE_META[gate].index}</span>
                        </span>
                        {gr ? <GateStatusBadge status={gr.status} /> : <span className="text-[0.82rem] text-slate-400">미생성</span>}
                      </li>
                    )
                  })}
                </ul>
              </Panel>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel title="측정·진행 요약">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      ['필수 통과율', `${summary.requiredPassRate}%`],
                      ['필수 통과', `${summary.requiredPassed}/${summary.requiredTotal}`],
                      ['완료 회차', `${summary.completedRounds}/${summary.totalRounds}`],
                      ['성과(KPI) 측정', `${summary.metricsMeasured}/${summary.metricsDefined}`],
                      ['미해결 이슈', `${summary.openIssues}건`],
                      ['필수 미측정', `${summary.requiredNotRun}건`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[0.82rem] text-slate-400">{label}</dt>
                        <dd className="text-[1.1rem] font-bold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>

                <Panel title="점검 상태">
                  <div className="flex items-center justify-between text-[0.95rem]">
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
                          <span className="min-w-0 text-[0.9rem] break-keep text-slate-600">{c.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[0.95rem] break-keep text-slate-500">해결해야 할 오류가 없습니다.</p>
                  )}
                </Panel>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}

function DefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.85rem] font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[0.98rem] break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

function ScenarioField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 text-[0.85rem] font-medium text-slate-400 sm:w-28">{label}</dt>
      <dd className="min-w-0 flex-1 text-[0.92rem] break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

export function TrackOverviewPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  const tt = trackType as ValidationTrackType
  const { context } = useValidationData(projectId)

  if (!context) return <ValidationProjectNotFound />
  const track = context.tracks.find((t) => t.trackType === tt)
  if (!track) return <ValidationProjectNotFound />

  // 진입 차단 (확정 설계 없음) — 헤더 + 안내만
  if (!track.eligibility.available) {
    return (
      <div className="flex flex-col gap-5">
        <ValidationModuleHeader saveStatus="local" />
        <TrackGateNotice track={track} />
      </div>
    )
  }

  // 워크스페이스 미생성 — 단계 프레임 안에서 생성 안내
  if (!track.workspace) {
    return (
      <WorkspaceShell
        moduleName={VALIDATION_MODULE_NAME}
        moduleDescription={VALIDATION_MODULE_DESC}
        steps={validationSteps(projectId, tt)}
        currentKey="overview"
      >
        <div className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-[0.95rem] break-keep text-slate-500">
          아직 이 트랙의 검증 워크스페이스가 없습니다. 트랙 선택 화면에서 ‘검증 시작’을 눌러 생성하세요.
        </div>
      </WorkspaceShell>
    )
  }

  return <OverviewBody w={track.workspace} track={track} projectId={projectId} trackType={tt} />
}
