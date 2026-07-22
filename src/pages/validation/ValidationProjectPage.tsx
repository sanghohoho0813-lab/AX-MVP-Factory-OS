import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Lock, RefreshCw } from 'lucide-react'
import type { TrackContext } from '../../services/validationService'
import { ensureWorkspace, ValidationBlockedError } from '../../services/validationService'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { TrackBadge, WorkspaceStatusBadge } from '../../components/validation/badges'
import { AdvancedFeatureNotice, LocalModeNotice } from '../../components/workspace/FeatureNotices'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { TRACK_META } from '../../lib/validationMeta'
import { ValidationModuleHeader, ValidationProjectNotFound } from './validationShared'
import { useValidationData } from './useValidationData'

export function ValidationProjectPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { context } = useValidationData(projectId)
  useStoreVersion()
  const advanced = isAdvancedVisible()

  if (!context) return <ValidationProjectNotFound />

  const startTrack = (track: TrackContext) => {
    try {
      ensureWorkspace(projectId, track.trackType)
      showToast(`${TRACK_META[track.trackType].label} 검증을 시작했습니다.`)
      navigate(`/validation/projects/${projectId}/${track.trackType}`)
    } catch (error) {
      showToast(error instanceof ValidationBlockedError ? error.message : '검증 시작에 실패했습니다.')
    }
  }

  const isCombined = context.project.projectType === 'ax_website'

  return (
    <div className="flex flex-col gap-5">
      {!advanced && (
        <AdvancedFeatureNotice
          featureName="실제 사용 테스트"
          whenToUse="설계를 확정한 뒤, 실제 사용자가 시험하고 문제·성과를 기록할 때 사용합니다."
        />
      )}

      <ValidationModuleHeader saveStatus="local" />

      <LocalModeNotice context="설문·테스트 링크는 이 브라우저에서만 열립니다." />

      <section
        aria-label="테스트 진행 방식 안내"
        className="rounded-(--radius-panel) border border-brand-100 bg-brand-50/60 p-5"
      >
        <p className="text-[0.82rem] font-semibold tracking-wide text-brand-700 uppercase">진행 방식</p>
        <p className="mt-1.5 text-[1.05rem] font-semibold break-keep text-slate-900">
          트랙별로 실제 사용 테스트를 진행하고 단계별 검토로 다음 진행을 판정합니다.
        </p>
        <p className="mt-1 text-[0.95rem] break-keep text-slate-600">
          ① 계획 → ② 제작·참여자 → ③ 시나리오 → ④ 회차 실행 → ⑤ 피드백·이슈 → ⑥ 성과 측정 → ⑦ 단계 판정 → ⑧ 다음 결정.
          관찰·측정 근거 없이 통과로 단정하지 않으며, 테스트를 막는 중대한 문제가 있으면 확정할 수 없습니다.
        </p>
      </section>

      {isCombined && (
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[0.95rem] break-keep text-slate-500">
          이 프로젝트는 AX MVP와 홈페이지 두 트랙을 각각 독립적으로 검증합니다. 두 트랙의 통과율·판정은 절대 합산하지 않습니다.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {context.tracks.map((track) => (
          <TrackCard key={track.trackType} track={track} onStart={() => startTrack(track)} onOpen={() => navigate(`/validation/projects/${projectId}/${track.trackType}`)} />
        ))}
      </div>
    </div>
  )
}

function TrackCard({
  track,
  onStart,
  onOpen,
}: {
  track: TrackContext
  onStart: () => void
  onOpen: () => void
}) {
  const meta = TRACK_META[track.trackType]
  const workspace = track.workspace
  const summary = track.summary

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-(--radius-panel) border border-slate-200 bg-white p-5 shadow-(--shadow-card)">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrackBadge track={track.trackType} />
          {workspace && <WorkspaceStatusBadge status={workspace.status} />}
        </div>
        {workspace && <span className="text-[0.82rem] text-slate-400">검증 v{workspace.version}</span>}
      </div>

      {!track.eligibility.available ? (
        <div className="flex flex-col gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/50 p-4">
          <p className="flex items-center gap-1.5 text-[1.05rem] font-semibold break-keep text-slate-800">
            <Lock aria-hidden="true" className="size-4 text-warning-600" />
            {meta.label}를 시작할 수 없습니다
          </p>
          <p className="text-[0.95rem] break-keep text-slate-600">{track.eligibility.reason}</p>
          <div className="mt-1">
            <Button variant="secondary" size="sm" disabled>
              검증 시작
            </Button>
          </div>
        </div>
      ) : !workspace ? (
        <div className="flex flex-col gap-3">
          <p className="text-[0.95rem] break-keep text-slate-600">
            확정된 출처 설계로 검증 워크스페이스를 생성해 실제 사용 테스트를 시작할 수 있습니다.
          </p>
          <div>
            <Button variant="primary" onClick={onStart}>
              검증 시작
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {track.needsRevalidationFlag && (
            <p className="flex items-start gap-1.5 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-3 py-2 text-[0.9rem] break-keep text-warning-700">
              <RefreshCw aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              출처 설계가 새 버전으로 확정됨 — 새 버전 검증 필요
            </p>
          )}

          <p className="text-[0.95rem] break-keep text-slate-600">{summary?.headline}</p>

          {summary?.hasOpenCritical && (
            <p className="flex items-center gap-1.5 text-[0.9rem] font-medium text-danger-600">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              테스트를 막는 중대한 문제가 남아 있어 확정할 수 없습니다
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <Stat label="필수 통과율" value={`${summary?.requiredPassRate ?? 0}%`} />
            <Stat label="미해결 이슈" value={`${summary?.openIssues ?? 0}건`} />
            <Stat label="완료 회차" value={`${summary?.completedRounds ?? 0}회`} />
            <Stat label="Gate 통과" value={`${summary?.gatesPassed ?? 0}/8`} />
          </dl>

          <div>
            <Button variant="secondary" onClick={onOpen}>
              열기
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.9rem] text-slate-400">{label}</dt>
      <dd className="text-lg font-bold text-slate-800">{value}</dd>
    </div>
  )
}
