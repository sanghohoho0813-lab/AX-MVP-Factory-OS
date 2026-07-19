import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react'
import type { MvpDesign } from '../../types/mvpDesign'
import type { MvpLevel, ProjectType } from '../../types/domain'
import { MVP_LEVELS, mvpLevelLabel } from '../../lib/domainMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { mvpDesignHandoffRepository } from '../../repositories'
import {
  DesignBlockedError,
  DesignEditError,
  checkCanFinalizeDesign,
  createNewDesignVersion,
  finalizeDesign,
  markDesignReviewed,
  regenerateDesign,
  setMvpLevel,
  updateDesignNotes,
} from '../../services/mvpDesignService'
import { DesignStatusBadge } from '../../components/mvpDesign/badges'
import { DesignSectionFrame } from './designShared'

function ReviewBody({ design, projectType }: { design: MvpDesign; projectType: ProjectType }) {
  const { showToast } = useToast()
  const finalized = design.status === 'finalized'
  const editable = !finalized && design.status !== 'superseded'

  const [summary, setSummary] = useState(design.designSummary)
  const [scopeNotes, setScopeNotes] = useState(design.scopeNotes)
  const [level, setLevel] = useState<MvpLevel>(design.levelDecision.selectedLevel)
  const [overrideReason, setOverrideReason] = useState(design.levelDecision.overrideReason)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmNewVersion, setConfirmNewVersion] = useState(false)

  const check = checkCanFinalizeDesign({ ...design, designSummary: summary, levelDecision: { ...design.levelDecision, selectedLevel: level, overrideReason } })
  const isOverride = level !== design.levelDecision.recommendedLevel
  const handoff = finalized ? mvpDesignHandoffRepository.getByDesignId(design.id) : null

  const saveLevel = (next: MvpLevel) => {
    setLevel(next)
    try {
      setMvpLevel(design.id, next, next === design.levelDecision.recommendedLevel ? '' : overrideReason)
    } catch (error) {
      if (error instanceof DesignEditError && next !== design.levelDecision.recommendedLevel) {
        // 사유가 필요하면 UI에서 입력받고 저장하지 않는다
        return
      }
      showToast(error instanceof DesignEditError ? error.message : '수준 변경 실패')
    }
  }

  const saveNotes = () => {
    try {
      updateDesignNotes(design.id, { designSummary: summary, scopeNotes })
      if (isOverride && overrideReason.trim()) setMvpLevel(design.id, level, overrideReason)
      showToast('저장했습니다.')
    } catch (error) {
      showToast(error instanceof DesignEditError ? error.message : '저장 실패')
    }
  }

  const doReview = () => {
    try {
      updateDesignNotes(design.id, { designSummary: summary, scopeNotes })
      markDesignReviewed(design.id)
      showToast('내부 검토로 표시했습니다.')
    } catch (error) {
      showToast(error instanceof DesignBlockedError || error instanceof DesignEditError ? error.message : '검토 처리 실패')
    }
  }

  const doFinalize = () => {
    try {
      updateDesignNotes(design.id, { designSummary: summary, scopeNotes })
      if (isOverride && overrideReason.trim()) setMvpLevel(design.id, level, overrideReason)
      finalizeDesign(design.id)
      setConfirmFinalize(false)
      showToast('MVP 설계를 확정했습니다.')
    } catch (error) {
      setConfirmFinalize(false)
      showToast(error instanceof DesignBlockedError ? error.message : '확정에 실패했습니다.')
    }
  }

  const doRegenerate = () => {
    try {
      regenerateDesign(design.id)
      showToast('설계를 다시 생성했습니다.')
    } catch (error) {
      showToast(error instanceof DesignBlockedError ? error.message : '재생성 실패')
    }
  }

  const doNewVersion = () => {
    try {
      createNewDesignVersion(design.projectId)
      setConfirmNewVersion(false)
      showToast('새 설계 버전을 생성했습니다.')
    } catch (error) {
      setConfirmNewVersion(false)
      showToast(error instanceof DesignBlockedError ? error.message : '새 버전 생성 실패')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <DesignStatusBadge status={design.status} />
        <span className="text-xs text-slate-400">설계 v{design.version}</span>
        {finalized && design.finalizedBy && <span className="text-xs text-slate-400">확정: {design.finalizedBy}</span>}
      </div>

      <Panel title="MVP 수준 결정">
        <p className="mb-3 text-[13px] break-keep text-slate-500">
          권장 수준: <span className="font-medium text-slate-700">{mvpLevelLabel(design.levelDecision.recommendedLevel, projectType)}</span>. 권장과 다른 수준을 선택하면 사유가 필요합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {MVP_LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              disabled={!editable}
              onClick={() => saveLevel(lv)}
              className={`rounded-(--radius-control) border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                lv === level ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {mvpLevelLabel(lv, projectType)}
            </button>
          ))}
        </div>
        {isOverride && editable && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">권장과 다른 수준 선택 사유 (필수)</label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[13px] focus:border-brand-400 focus:outline-none"
              placeholder="예: 현장 검증을 위해 실사용 MVP 수준이 필요합니다."
            />
          </div>
        )}
      </Panel>

      <Panel title="설계 요약 (최종 의견)">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!editable}
          rows={4}
          className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[13px] focus:border-brand-400 focus:outline-none disabled:bg-slate-50"
          placeholder="담당자 최종 설계 의견을 작성하세요. 확정하려면 필수입니다."
        />
        <p className="mt-2 text-xs break-keep text-slate-400">자동 요약: {design.autoSummary}</p>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-slate-500">범위 메모 (선택)</label>
          <textarea
            value={scopeNotes}
            onChange={(e) => setScopeNotes(e.target.value)}
            disabled={!editable}
            rows={2}
            className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[13px] focus:border-brand-400 focus:outline-none disabled:bg-slate-50"
          />
        </div>
        {editable && (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={saveNotes}>저장</Button>
          </div>
        )}
      </Panel>

      <Panel title="제외 범위">
        <ul className="flex flex-wrap gap-2">
          {design.outOfScope.map((item) => (
            <li key={item} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">{item}</li>
          ))}
        </ul>
      </Panel>

      {!editable && handoff && (
        <Panel title="Stage 8 인계 스냅샷 (확정 동결)">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SnapItem label="핵심 과제" value={handoff.coreTaskName} />
            <SnapItem label="MVP 수준" value={mvpLevelLabel(handoff.selectedLevel, projectType)} />
            <SnapItem label="필수 기능" value={handoff.mustFeatures.map((f) => f.name).join(', ') || '-'} />
            <SnapItem label="화면" value={handoff.screenNames.join(', ') || '-'} />
            <SnapItem label="데이터" value={handoff.entityNames.join(', ') || '-'} />
            <SnapItem label="KPI" value={handoff.kpiSummaries.join(', ') || '-'} />
          </dl>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            {design.status === 'draft' && (
              <Button variant="secondary" onClick={doReview}>내부 검토 완료</Button>
            )}
            <Button variant="secondary" onClick={doRegenerate}>
              <Sparkles aria-hidden="true" className="size-4" />
              설계 다시 생성
            </Button>
            <Button variant="primary" onClick={() => setConfirmFinalize(true)} disabled={!check.ok}>
              <CheckCircle2 aria-hidden="true" className="size-4" />
              설계 확정
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmNewVersion(true)}>
            <RefreshCw aria-hidden="true" className="size-4" />
            새 버전 설계
          </Button>
        )}
      </div>

      {!check.ok && editable && (
        <ul className="flex flex-col gap-1 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
          {check.reasons.map((r) => (
            <li key={r} className="text-[13px] break-keep text-warning-800">• {r}</li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={confirmFinalize}
        title="MVP 설계 확정"
        message="확정하면 현재 설계가 Stage 8 인계 스냅샷으로 동결됩니다. 이후 원본 과제가 바뀌어도 이 설계는 유지됩니다."
        confirmLabel="확정"
        onConfirm={doFinalize}
        onCancel={() => setConfirmFinalize(false)}
      />
      <ConfirmModal
        open={confirmNewVersion}
        title="새 버전 설계"
        message="최신 확정 핵심 과제를 반영해 새 설계 버전을 생성합니다. 기존 확정 설계는 이전 버전으로 보존됩니다."
        confirmLabel="새 버전 생성"
        onConfirm={doNewVersion}
        onCancel={() => setConfirmNewVersion(false)}
      />
    </>
  )
}

function SnapItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] break-keep text-slate-700">{value}</dd>
    </div>
  )
}

export function DesignReviewPage() {
  const { projectId = '' } = useParams()
  return (
    <DesignSectionFrame
      projectId={projectId}
      render={(design, context) => <ReviewBody design={design} projectType={context.project.projectType} />}
    />
  )
}
