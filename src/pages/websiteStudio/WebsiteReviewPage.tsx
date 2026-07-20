import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import type { WebsiteDesign } from '../../types/websiteDesign'
import { WEBSITE_TYPE_META } from '../../lib/websiteDesignMeta'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import { websiteDesignHandoffRepository } from '../../repositories'
import {
  WebsiteDesignBlockedError,
  WebsiteDesignEditError,
  checkCanFinalize,
  createNewWebsiteVersion,
  finalizeWebsiteDesign,
  markWebsiteReviewed,
  updateDesignNotes,
} from '../../services/websiteDesignService'
import {
  GuardrailStatusBadge,
  QualitySeverityBadge,
  WebsiteStatusBadge,
  WebsiteTypeBadge,
} from '../../components/websiteStudio/badges'
import { WebsiteSectionFrame } from './websiteShared'

function ReviewBody({ design }: { design: WebsiteDesign }) {
  const { showToast } = useToast()
  const finalized = design.status === 'finalized'
  const editable = !finalized && design.status !== 'superseded'
  const [summary, setSummary] = useState(design.designSummary)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState(false)

  const check = checkCanFinalize({ ...design, designSummary: summary })
  const handoff = finalized ? websiteDesignHandoffRepository.getByDesignId(design.id) : null
  const activePages = design.pages.filter((p) => p.status !== 'excluded')
  const errors = design.qualityChecks.filter((c) => c.severity === 'error' && !c.passed)

  const saveSummary = () => {
    try { updateDesignNotes(design.id, { designSummary: summary }); showToast('저장했습니다.') }
    catch (error) { showToast(error instanceof WebsiteDesignEditError ? error.message : '저장 실패') }
  }
  const doReview = () => {
    try { updateDesignNotes(design.id, { designSummary: summary }); markWebsiteReviewed(design.id); showToast('내부 검토로 표시했습니다.') }
    catch (error) { showToast(error instanceof WebsiteDesignEditError || error instanceof WebsiteDesignBlockedError ? error.message : '처리 실패') }
  }
  const doFinalize = () => {
    try {
      updateDesignNotes(design.id, { designSummary: summary })
      finalizeWebsiteDesign(design.id)
      setConfirmFinalize(false)
      showToast('홈페이지 설계를 확정했습니다.')
    } catch (error) {
      setConfirmFinalize(false)
      showToast(error instanceof WebsiteDesignBlockedError ? error.message : '확정 실패')
    }
  }
  const doVersion = () => {
    try { createNewWebsiteVersion(design.projectId); setConfirmVersion(false); showToast('새 설계 버전을 생성했습니다.') }
    catch (error) { setConfirmVersion(false); showToast(error instanceof WebsiteDesignBlockedError ? error.message : '새 버전 생성 실패') }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <WebsiteStatusBadge status={design.status} />
        <WebsiteTypeBadge type={design.strategy.websiteType} />
        <span className="text-xs text-slate-400">설계 v{design.version}</span>
        {finalized && design.finalizedBy && <span className="text-xs text-slate-400">확정: {design.finalizedBy}</span>}
      </div>

      <Panel title="설계 요약">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="홈페이지 목적" value={design.strategy.purpose} />
          <Item label="홈페이지 유형" value={WEBSITE_TYPE_META[design.strategy.websiteType].label} />
          <Item label="핵심 고객" value={design.strategy.audiences.map((a) => a.name).join(', ')} />
          <Item label="핵심 CTA" value={design.strategy.conversionActions.find((c) => c.id === design.strategy.primaryConversionActionId)?.label ?? '-'} />
          <Item label="사이트맵" value={activePages.map((p) => p.name).join(' · ')} />
          <Item label="개발 지시문" value={`${design.generatedPrompts.length}종 생성`} />
        </dl>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="범위 가드레일">
          <ul className="flex flex-col gap-2">
            {design.scopeGuardrails.filter((g) => g.limitValue !== null).map((g) => (
              <li key={g.key} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate text-slate-600">{g.label}</span>
                <GuardrailStatusBadge status={g.status} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="품질 점검">
          {design.qualityChecks.filter((c) => !c.passed).length === 0 ? (
            <p className="text-[13px] text-success-700">점검 항목을 모두 통과했습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {design.qualityChecks.filter((c) => !c.passed).map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[13px]">
                  <QualitySeverityBadge severity={c.severity} />
                  <span className="min-w-0 break-keep text-slate-600">{c.description}</span>
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && <p className="mt-3 text-[13px] font-medium text-danger-600">오류 {errors.length}건을 해결해야 확정할 수 있습니다.</p>}
        </Panel>
      </div>

      <Panel title="최종 설계 요약 (담당자 의견)">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={!editable}
          rows={4}
          className="w-full max-w-[1000px] rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[14px] focus:border-brand-400 focus:outline-none disabled:bg-slate-50"
          placeholder="담당자 최종 설계 의견을 작성하세요. 확정하려면 필수입니다."
        />
        {editable && <div className="mt-3"><Button variant="secondary" size="sm" onClick={saveSummary}>저장</Button></div>}
      </Panel>

      {!editable && handoff && (
        <Panel title="확정 설계 내용 (동결)">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Item label="사이트맵" value={handoff.sitemap.join(' · ')} />
            <Item label="필요 콘텐츠" value={handoff.contentRequirements.join(', ') || '-'} />
            <Item label="필요 자산" value={handoff.assetRequirements.join(', ') || '-'} />
            <Item label="개발 지시문" value={handoff.selectedPrompt ? '포함됨' : '없음'} />
          </dl>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            {design.status === 'draft' && <Button variant="secondary" onClick={doReview}>내부 검토 완료</Button>}
            <Button variant="primary" onClick={() => setConfirmFinalize(true)} disabled={!check.ok}>
              <CheckCircle2 aria-hidden="true" className="size-4" />
              홈페이지 설계 확정
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmVersion(true)}>
            <RefreshCw aria-hidden="true" className="size-4" />
            새 버전 설계
          </Button>
        )}
      </div>

      {!check.ok && editable && (
        <ul className="flex flex-col gap-1 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3" aria-live="polite">
          {check.reasons.map((r) => <li key={r} className="text-[13px] break-keep text-warning-800">• {r}</li>)}
        </ul>
      )}

      <ConfirmModal
        open={confirmFinalize}
        title="홈페이지 설계 확정"
        message="확정하면 현재 설계가 인계 스냅샷으로 동결됩니다. 이후 원본 진단이 바뀌어도 이 설계는 유지됩니다."
        confirmLabel="확정"
        onConfirm={doFinalize}
        onCancel={() => setConfirmFinalize(false)}
      />
      <ConfirmModal
        open={confirmVersion}
        title="새 버전 설계"
        message="최신 홈페이지 진단 결과를 반영해 새 설계 버전을 생성합니다. 기존 확정 설계는 이전 버전으로 보존됩니다."
        confirmLabel="새 버전 생성"
        onConfirm={doVersion}
        onCancel={() => setConfirmVersion(false)}
      />
    </>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[13px] break-keep text-slate-700">{value}</dd>
    </div>
  )
}

export function WebsiteReviewPage() {
  const { projectId = '' } = useParams()
  return <WebsiteSectionFrame projectId={projectId} render={(design) => <ReviewBody design={design} />} />
}
