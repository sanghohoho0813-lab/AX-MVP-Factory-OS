import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardCheck,
  Save,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useStoreVersion } from '../../../lib/useStoreVersion'
import { formatDateTime } from '../../../lib/format'
import { assessmentRepository } from '../../../repositories'
import { Button } from '../../../components/ui/Button'
import { ConfirmModal } from '../../../components/ui/ConfirmModal'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Panel } from '../../../components/ui/Panel'
import { useToast } from '../../../components/ui/toastContext'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import {
  AssessmentScoreHeadline,
  RuleVersionInfo,
  WebsiteReadinessSummary,
} from '../../../components/assessment/summaryPanels'
import { AssessmentStatusBadge } from '../../../components/assessment/badges'
import {
  checkCanFinalize,
  finalizeAssessment,
  markAssessmentReviewed,
  updateManualSummary,
} from '../../../services/assessmentService'
import {
  AnalysisHeader,
  ProjectNotFound,
  useAnalysisData,
} from './analysisShared'

function BulletPanel({
  title,
  items,
  icon: Icon,
  tone,
  empty,
}: {
  title: string
  items: string[]
  icon: typeof ThumbsUp
  tone: string
  empty: string
}) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-400">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
              <Icon aria-hidden="true" className={`mt-0.5 size-3.5 shrink-0 ${tone}`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function AssessmentResultPage() {
  const { projectId = '' } = useParams()
  const { showToast } = useToast()
  const version = useStoreVersion()
  const { context, organization } = useAnalysisData(projectId)
  const [manualSummary, setManualSummaryText] = useState('')
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [viewedId, setViewedId] = useState<string | null>(null)

  const versions = useMemo(
    () => assessmentRepository.getByProjectId(projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version],
  )

  const latest = context?.latest ?? null
  const viewed = viewedId
    ? versions.find((v) => v.id === viewedId) ?? latest
    : latest

  useEffect(() => {
    setManualSummaryText(viewed?.manualSummary ?? '')
  }, [viewed?.id, viewed?.manualSummary])

  if (!context) return <ProjectNotFound />
  const { project, issues } = context

  const header = <AnalysisHeader project={project} organization={organization} />

  if (!latest || !viewed) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={ClipboardCheck}
            title="분석을 먼저 실행하세요"
            description="개요 화면에서 진단 분석을 실행하면 결과를 검토·확정할 수 있습니다."
          />
        </div>
      </div>
    )
  }

  const isViewingLatest = viewed.id === latest.id
  const editable = isViewingLatest && viewed.status !== 'finalized'
  const finalizeCheck = checkCanFinalize(
    { ...viewed, manualSummary },
    issues,
  )
  const isWebsite = viewed.analysisKind === 'website'

  const handleSaveSummary = () => {
    updateManualSummary(latest.id, manualSummary)
    showToast('최종 의견을 저장했습니다.')
  }

  const handleReview = () => {
    updateManualSummary(latest.id, manualSummary)
    markAssessmentReviewed(latest.id)
    showToast('내부 검토를 완료했습니다.')
  }

  const handleFinalize = () => {
    try {
      updateManualSummary(latest.id, manualSummary)
      finalizeAssessment(latest.id)
      showToast('진단 결과를 확정했습니다.')
      setFinalizeOpen(false)
    } catch (error) {
      setFinalizeOpen(false)
      showToast(error instanceof Error ? error.message : '확정에 실패했습니다.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <AnalysisNav projectId={projectId} />

      <div className="flex flex-wrap items-center gap-2">
        <AssessmentStatusBadge status={viewed.status} />
        <RuleVersionInfo result={viewed} />
        {viewed.finalizedAt && (
          <span className="text-xs text-slate-400">확정 {formatDateTime(viewed.finalizedAt)}</span>
        )}
        {versions.length > 1 && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
            분석 버전
            <select
              value={viewed.id}
              onChange={(e) => setViewedId(e.target.value)}
              aria-label="분석 버전 선택"
              className="rounded-(--radius-control) border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} · {v.status === 'finalized' ? '확정' : v.status === 'superseded' ? '이전' : '초안'}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!isViewingLatest && (
        <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] break-keep text-slate-500">
          이전 버전(v{viewed.version}) 결과를 조회 중입니다. 편집은 최신 버전에서만 가능합니다.
        </p>
      )}

      {/* 최종 판정 */}
      <Panel title="최종 판정">
        {isWebsite && viewed.websiteReadiness ? (
          <WebsiteReadinessSummary website={viewed.websiteReadiness} />
        ) : (
          <AssessmentScoreHeadline result={viewed} />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BulletPanel title="핵심 강점" items={viewed.keyStrengths} icon={ThumbsUp} tone="text-success-600" empty="확인된 강점이 없습니다." />
        <BulletPanel title="핵심 약점" items={viewed.keyWeaknesses} icon={ThumbsDown} tone="text-warning-600" empty="확인된 약점이 없습니다." />
        <BulletPanel title="주요 위험" items={viewed.keyRisks} icon={ShieldAlert} tone="text-danger-600" empty="확인된 주요 위험이 없습니다." />
        <BulletPanel title="데이터 부족·확인 필요" items={viewed.missingDataSummary} icon={ShieldAlert} tone="text-slate-400" empty="누락 항목이 없습니다." />
      </div>

      {viewed.conflictSummary.length > 0 && (
        <Panel title="응답자 비교 요약">
          <ul className="flex flex-col gap-1.5">
            {viewed.conflictSummary.map((c) => (
              <li key={c} className="text-[13px] break-keep text-slate-700">• {c}</li>
            ))}
          </ul>
        </Panel>
      )}

      {/* 추천 다음 행동 */}
      <Panel title="추천 다음 행동">
        <ul className="flex flex-col gap-1.5">
          {viewed.suggestedNextActions.map((a) => (
            <li key={a} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
              {a}
            </li>
          ))}
        </ul>
      </Panel>

      {/* 내부 진단 의견 */}
      <Panel title="내부 진단 의견">
        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">자동 요약 (규칙 기반)</p>
            <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] break-keep text-slate-600">
              {viewed.autoSummary}
            </p>
          </div>
          <div>
            <label htmlFor="manual-summary" className="mb-1 block text-xs font-medium text-slate-400">
              담당자 최종 의견
            </label>
            <textarea
              id="manual-summary"
              value={manualSummary}
              onChange={(e) => setManualSummaryText(e.target.value)}
              disabled={!editable}
              rows={4}
              placeholder="자동 요약을 참고해 최종 진단 의견을 작성하세요. 확정하려면 최종 의견이 필요합니다."
              className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm break-keep focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          {editable && (
            <div>
              <Button variant="secondary" size="sm" onClick={handleSaveSummary}>
                <Save aria-hidden="true" className="size-3.5" />
                최종 의견 저장
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {/* 결과 상태 액션 */}
      {editable && (
        <Panel title="결과 상태">
          {!finalizeCheck.ok && (
            <ul className="mb-3 flex flex-col gap-1 rounded-(--radius-control) border border-warning-200 bg-warning-50/60 px-3 py-2">
              {finalizeCheck.reasons.map((r) => (
                <li key={r} className="text-xs break-keep text-warning-800">• {r}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleReview}>
              내부 검토 완료
            </Button>
            <Button
              variant="primary"
              onClick={() => setFinalizeOpen(true)}
              disabled={!finalizeCheck.ok}
            >
              <ClipboardCheck aria-hidden="true" className="size-4" />
              진단 결과 확정
            </Button>
            {!finalizeCheck.ok && (
              <span className="self-center text-xs text-slate-400">
                확정 조건을 먼저 충족해야 합니다.
              </span>
            )}
          </div>
        </Panel>
      )}

      <ConfirmModal
        open={finalizeOpen}
        title="진단 결과 확정"
        message={
          isWebsite
            ? `홈페이지 제작 준비도 ${viewed.websiteReadiness?.overallScore ?? 0}점으로 확정합니다. 확정 후에는 수정할 수 없으며, 재분석 시 새 버전으로 저장됩니다.`
            : `최종 점수 ${viewed.finalScore}점으로 진단 결과를 확정합니다. 확정 후에는 수정할 수 없으며, 재분석 시 새 버전으로 저장됩니다.`
        }
        confirmLabel="확정"
        onConfirm={handleFinalize}
        onCancel={() => setFinalizeOpen(false)}
      />
    </div>
  )
}
