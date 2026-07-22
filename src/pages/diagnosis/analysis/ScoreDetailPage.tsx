import { useState } from 'react'
import { Plus, Trophy } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type {
  AssessmentDeduction,
  DomainScore,
} from '../../../types/assessment'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Modal } from '../../../components/ui/Modal'
import { Panel } from '../../../components/ui/Panel'
import { useToast } from '../../../components/ui/toastContext'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import {
  AssessmentScoreHeadline,
  DataCompletenessPanel,
  RuleVersionInfo,
  WebsiteReadinessSummary,
} from '../../../components/assessment/summaryPanels'
import {
  DeductionList,
  DomainScoreRow,
  ManualAdjustNotice,
  ScoreCalcNotice,
} from '../../../components/assessment/scoreParts'
import { ManualScoreAdjustmentModal } from '../../../components/assessment/ManualScoreAdjustmentModal'
import {
  addManualDeduction,
  applyManualScoreAdjustment,
  toggleDeductionOverride,
} from '../../../services/assessmentService'
import {
  AnalysisHeader,
  ProjectNotFound,
  useAnalysisData,
} from './analysisShared'

export function ScoreDetailPage() {
  const { projectId = '' } = useParams()
  const { showToast } = useToast()
  const { context, organization } = useAnalysisData(projectId)
  const [adjustDomain, setAdjustDomain] = useState<DomainScore | null>(null)
  const [addDeductionOpen, setAddDeductionOpen] = useState(false)
  const [dedPoints, setDedPoints] = useState('')
  const [dedReason, setDedReason] = useState('')
  const [overrideModal, setOverrideModal] = useState<AssessmentDeduction | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  if (!context) return <ProjectNotFound />
  const { project, latest } = context

  const header = <AnalysisHeader project={project} organization={organization} />

  if (!latest) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Trophy}
            title="분석을 먼저 실행하세요"
            description="개요 화면에서 진단 분석을 실행하면 점수 상세가 표시됩니다."
          />
        </div>
      </div>
    )
  }

  const editable = latest.status !== 'finalized'
  const adjustmentByDomain = new Map(
    latest.manualAdjustments.map((a) => [a.domain, a]),
  )

  const handleAdjust = (afterScore: number, reason: string) => {
    if (!adjustDomain) return
    try {
      applyManualScoreAdjustment(latest.id, adjustDomain.domain, afterScore, reason)
      showToast('점수를 보정했습니다.')
      setAdjustDomain(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '보정에 실패했습니다.')
    }
  }

  const handleToggleOverride = (deduction: AssessmentDeduction) => {
    if (deduction.overridden) {
      try {
        toggleDeductionOverride(latest.id, deduction.id, false, '')
        showToast('감점을 복원했습니다.')
      } catch (error) {
        showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
      }
      return
    }
    setOverrideReason('')
    setOverrideModal(deduction)
  }

  const submitOverride = () => {
    if (!overrideModal) return
    try {
      toggleDeductionOverride(latest.id, overrideModal.id, true, overrideReason)
      showToast('감점을 제외했습니다.')
      setOverrideModal(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '처리에 실패했습니다.')
    }
  }

  const submitAddDeduction = () => {
    try {
      addManualDeduction(latest.id, Number(dedPoints), dedReason)
      showToast('수동 감점을 추가했습니다.')
      setDedPoints('')
      setDedReason('')
      setAddDeductionOpen(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '추가에 실패했습니다.')
    }
  }

  const isWebsite = latest.analysisKind === 'website'

  if (isWebsite && latest.websiteReadiness) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <p className="rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 text-[0.875rem] break-keep text-slate-500">
          홈페이지 단독 프로젝트에는 AX 적합성 총점을 적용하지 않습니다. 대신 홈페이지 제작
          준비도를 표시합니다.
        </p>
        <Panel title="홈페이지 제작 준비도">
          <WebsiteReadinessSummary website={latest.websiteReadiness} />
        </Panel>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <AnalysisNav projectId={projectId} />

      <div className="flex flex-wrap items-center gap-2">
        <RuleVersionInfo result={latest} />
      </div>
      <ScoreCalcNotice />
      <ManualAdjustNotice show={latest.manualAdjustments.length > 0} />

      <Panel title="AX 적합성 점수">
        <AssessmentScoreHeadline result={latest} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          <Panel title="영역별 점수">
            <div className="flex flex-col gap-2.5">
              {latest.domainScores.map((score) => (
                <DomainScoreRow
                  key={score.domain}
                  score={score}
                  evidence={latest.evidence}
                  adjustment={adjustmentByDomain.get(score.domain)}
                  editable={editable}
                  onAdjust={() => setAdjustDomain(score)}
                />
              ))}
            </div>
          </Panel>

          <Panel
            title="감점"
            actions={
              editable ? (
                <Button variant="secondary" size="sm" onClick={() => setAddDeductionOpen(true)}>
                  <Plus aria-hidden="true" className="size-3.5" />
                  수동 감점
                </Button>
              ) : undefined
            }
          >
            <DeductionList
              deductions={latest.deductions}
              editable={editable}
              onToggleOverride={handleToggleOverride}
            />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="분석 신뢰도·데이터 충분도">
            <DataCompletenessPanel result={latest} />
          </Panel>
        </div>
      </div>

      <ManualScoreAdjustmentModal
        open={adjustDomain !== null}
        domainScore={adjustDomain}
        onClose={() => setAdjustDomain(null)}
        onSubmit={handleAdjust}
      />

      {/* 감점 제외 사유 */}
      <Modal
        open={overrideModal !== null}
        title="감점 제외"
        onClose={() => setOverrideModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOverrideModal(null)}>
              취소
            </Button>
            <Button variant="primary" onClick={submitOverride}>
              제외
            </Button>
          </>
        }
      >
        <label htmlFor="override-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
          제외 사유
        </label>
        <textarea
          id="override-reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          rows={3}
          placeholder="이 감점을 제외하는 이유를 기록하세요."
          className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </Modal>

      {/* 수동 감점 추가 */}
      <Modal
        open={addDeductionOpen}
        title="수동 감점 추가"
        onClose={() => setAddDeductionOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddDeductionOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={submitAddDeduction}>
              추가
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="ded-points" className="mb-1.5 block text-sm font-medium text-slate-700">
              감점 (점)
            </label>
            <input
              id="ded-points"
              type="number"
              min={1}
              value={dedPoints}
              onChange={(e) => setDedPoints(e.target.value)}
              className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="ded-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
              사유
            </label>
            <textarea
              id="ded-reason"
              value={dedReason}
              onChange={(e) => setDedReason(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
