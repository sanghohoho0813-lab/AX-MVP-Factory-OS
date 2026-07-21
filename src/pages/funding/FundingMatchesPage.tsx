import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Building2, Pencil } from 'lucide-react'
import type { CriterionCategory, CriterionStatus, FundingMatch, FundingStrategy, MatchPriority } from '../../types/funding'
import { setMatchPriority, updateCriterion, updateMatch } from '../../services/fundingService'
import { CRITERION_STATUSES, MATCH_PRIORITIES, MATCH_PRIORITY_META, CRITERION_STATUS_META, NO_APPROVAL_PREDICTION_NOTE } from '../../lib/fundingMeta'
import { institutionRepository, supportProgramRepository } from '../../repositories'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { HelpNote } from '../../components/ui/HelpNote'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/toastContext'
import { CriterionStatusBadge, MatchConfidenceBadge, MatchPriorityBadge } from '../../components/funding/badges'
import { ReadOnlyNotice, FundingStrategyFrame } from './fundingShared'

const CRITERION_CATEGORY_LABEL: Record<CriterionCategory, string> = {
  basic: '기본',
  financial: '재무',
  credit: '신용',
  technology: '기술',
  innovation: '혁신',
  employment: '고용',
  certification: '인증',
  market: '시장',
  region: '지역',
  documentation: '서류',
  compliance: '규정',
  other: '기타',
}

function institutionName(id: string): string {
  return institutionRepository.getById(id)?.name ?? '기관 미상'
}
function programName(id: string | null): string {
  if (!id) return '기관 일반'
  return supportProgramRepository.getById(id)?.name ?? '프로그램 미상'
}

function ApprovalNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-(--radius-card) border border-slate-200 bg-slate-50/70 px-4 py-3">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
      <p className="text-[13px] break-keep text-slate-600">{NO_APPROVAL_PREDICTION_NOTE}</p>
    </div>
  )
}

function ChipList({ label, items, tone = 'slate' }: { label: string; items: string[]; tone?: 'slate' | 'success' | 'warning' | 'danger' }) {
  if (items.length === 0) return null
  const toneClass =
    tone === 'success'
      ? 'border-success-200 bg-success-50 text-success-700'
      : tone === 'warning'
        ? 'border-warning-200 bg-warning-50 text-warning-700'
        : tone === 'danger'
          ? 'border-danger-200 bg-danger-50 text-danger-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <li key={i} className={`rounded-md border px-2 py-0.5 text-[12px] break-keep ${toneClass}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CriterionTable({
  match,
  readOnly,
  onStatus,
}: {
  match: FundingMatch
  readOnly: boolean
  onStatus: (criterionId: string, status: CriterionStatus) => void
}) {
  if (match.criterionChecks.length === 0) {
    return <p className="text-[13px] break-keep text-slate-400">등록된 요건 점검 항목이 없습니다.</p>
  }
  // 좁은 화면에서 가로 스크롤이 생기지 않도록 표 대신 세로 카드 목록으로 표시한다.
  return (
    <ul className="flex min-w-0 flex-col gap-2">
      {match.criterionChecks.map((c) => (
        <li key={c.id} className="min-w-0 rounded-(--radius-card) border border-slate-200 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-[13px] font-medium break-keep text-slate-700">{c.label}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">{CRITERION_CATEGORY_LABEL[c.category]}</span>
              <CriterionStatusBadge status={c.status} />
            </div>
          </div>
          {c.description && <p className="mt-1 text-xs break-keep text-slate-400">{c.description}</p>}
          {c.status === 'unknown' && (
            <p className="mt-1 text-[11px] break-keep text-slate-400">데이터 없음 — 미충족과 다릅니다(확인 필요).</p>
          )}
          {c.missingEvidence && (
            <p className="mt-1 text-xs break-keep text-slate-500">부족한 증빙: {c.missingEvidence}</p>
          )}
          {!readOnly && (
            <label className="mt-2 flex flex-col gap-1">
              <span className="sr-only">{c.label} 요건 상태 변경</span>
              <select
                value={c.status}
                onChange={(e) => onStatus(c.id, e.target.value as CriterionStatus)}
                className="w-full max-w-[220px] rounded-(--radius-control) border border-slate-200 px-2 py-1 text-xs text-slate-700"
              >
                {CRITERION_STATUSES.map((s) => (
                  <option key={s} value={s}>{CRITERION_STATUS_META[s].label}</option>
                ))}
              </select>
            </label>
          )}
        </li>
      ))}
    </ul>
  )
}

function MatchCard({
  match,
  strategyId,
  readOnly,
  onRequestExclude,
  onEdit,
}: {
  match: FundingMatch
  strategyId: string
  readOnly: boolean
  onRequestExclude: (matchId: string) => void
  onEdit: (match: FundingMatch) => void
}) {
  const { showToast } = useToast()
  const excluded = match.priority === 'excluded'

  function handlePriority(next: MatchPriority) {
    if (next === 'excluded') {
      onRequestExclude(match.id)
      return
    }
    try {
      setMatchPriority(strategyId, match.id, next)
      showToast('우선순위를 변경했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '우선순위를 변경할 수 없습니다.')
    }
  }

  function handleCriterion(criterionId: string, status: CriterionStatus) {
    try {
      updateCriterion(strategyId, match.id, criterionId, { status })
      showToast('요건 상태를 변경했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '요건 상태를 변경할 수 없습니다.')
    }
  }

  return (
    <article className={`min-w-0 rounded-(--radius-panel) border p-4 ${excluded ? 'border-slate-200 bg-slate-50/60 opacity-70' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-sm font-semibold break-words text-slate-900">{institutionName(match.institutionId)}</h3>
            <MatchPriorityBadge priority={match.priority} />
            <MatchConfidenceBadge confidence={match.confidence} />
          </div>
          <p className="mt-0.5 text-[13px] text-slate-500">{programName(match.programId)}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>우선순위</span>
              <select
                value={match.priority}
                onChange={(e) => handlePriority(e.target.value as MatchPriority)}
                className="rounded-(--radius-control) border border-slate-200 px-2 py-1 text-xs text-slate-700"
              >
                {MATCH_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{MATCH_PRIORITY_META[p].label}</option>
                ))}
              </select>
            </label>
            <Button variant="ghost" size="sm" onClick={() => onEdit(match)}>
              <Pencil aria-hidden="true" className="size-3.5" />
              의견 편집
            </Button>
          </div>
        )}
      </div>

      {excluded && match.exclusionReason && (
        <p className="mt-2 text-[12px] break-keep text-slate-500">제외 사유: {match.exclusionReason}</p>
      )}

      {!excluded && (
        <div className="mt-3 flex min-w-0 flex-col gap-3">
          {match.reasonSummary && <p className="text-[13px] break-keep text-slate-700">{match.reasonSummary}</p>}
          {match.expectedUse && (
            <p className="text-[13px] break-keep text-slate-600">
              <span className="font-semibold text-slate-500">예상 활용: </span>
              {match.expectedUse}
            </p>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <ChipList label="강점" items={match.strengths} tone="success" />
            <ChipList label="부족" items={match.gaps} tone="warning" />
            <ChipList label="위험" items={match.risks} tone="danger" />
            <ChipList label="다음 행동" items={match.requiredNextActions} />
          </div>

          {match.officialConfirmationRequired.length > 0 && (
            <div aria-live="polite" className="rounded-(--radius-card) border border-warning-300 bg-warning-50 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-warning-800">
                <AlertTriangle aria-hidden="true" className="size-4" />
                공식 확인 필요
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] break-keep text-warning-700">
                {match.officialConfirmationRequired.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {match.analystOpinion && (
            <p className="rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-[13px] break-keep text-slate-600">
              <span className="font-semibold text-slate-500">검토 의견: </span>
              {match.analystOpinion}
            </p>
          )}

          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-slate-400 uppercase">요건 점검</p>
            <CriterionTable match={match} readOnly={readOnly} onStatus={handleCriterion} />
          </div>
        </div>
      )}
    </article>
  )
}

function MatchesBody({ strategy }: { strategy: FundingStrategy }) {
  const { showToast } = useToast()
  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
  const [excludeId, setExcludeId] = useState<string | null>(null)
  const [exclusionReason, setExclusionReason] = useState('')
  const [editTarget, setEditTarget] = useState<FundingMatch | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [opinionText, setOpinionText] = useState('')

  function openExclude(matchId: string) {
    setExcludeId(matchId)
    setExclusionReason('')
  }
  function submitExclude() {
    if (!excludeId) return
    try {
      setMatchPriority(strategy.id, excludeId, 'excluded', exclusionReason.trim())
      showToast('후보를 제외했습니다.')
      setExcludeId(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '제외할 수 없습니다.')
    }
  }

  function openEdit(match: FundingMatch) {
    setEditTarget(match)
    setConfirmText(match.officialConfirmationRequired.join('\n'))
    setOpinionText(match.analystOpinion)
  }
  function submitEdit() {
    if (!editTarget) return
    try {
      updateMatch(strategy.id, editTarget.id, {
        officialConfirmationRequired: confirmText.split('\n').map((s) => s.trim()).filter(Boolean),
        analystOpinion: opinionText.trim(),
      })
      showToast('검토 의견을 저장했습니다.')
      setEditTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장할 수 없습니다.')
    }
  }

  return (
    <>
      <ReadOnlyNotice strategy={strategy} />
      <ApprovalNote />
      <HelpNote
        summary="후보 기관은 승인 가능성이 아니라 추가로 검토할 우선순위를 정리한 목록입니다. 실제 조건은 공식 공고와 기관 문의로 확인하세요."
        what="후보별로 우선순위와 요건 충족 상태를 정리합니다."
        when="근거를 모은 뒤 어떤 기관을 먼저 검토할지 정할 때 사용합니다."
        next="우선 검토 후보를 정하면 부족조건과 접촉 계획을 준비합니다."
      />

      {strategy.matches.length === 0 ? (
        <Panel title="기관 후보" flush>
          <EmptyState icon={Building2} title="아직 후보 기관이 없습니다" description="연계 전략을 생성하면 근거를 바탕으로 후보가 자동 정리됩니다." />
        </Panel>
      ) : (
        MATCH_PRIORITIES.map((priority) => {
          const group = strategy.matches.filter((m) => m.priority === priority)
          if (group.length === 0) return null
          return (
            <Panel key={priority} title={`${MATCH_PRIORITY_META[priority].label} (${group.length})`}>
              <div className="flex flex-col gap-4">
                {group.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    strategyId={strategy.id}
                    readOnly={readOnly}
                    onRequestExclude={openExclude}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </Panel>
          )
        })
      )}

      <Modal
        open={excludeId !== null}
        title="후보 제외"
        onClose={() => setExcludeId(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setExcludeId(null)}>취소</Button>
            <Button variant="primary" onClick={submitExclude}>제외</Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-slate-600">제외 사유</span>
          <textarea
            value={exclusionReason}
            onChange={(e) => setExclusionReason(e.target.value)}
            rows={3}
            placeholder="예: 대상 업종·지역 요건 불일치"
            className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </Modal>

      <Modal
        open={editTarget !== null}
        title="검토 의견 편집"
        onClose={() => setEditTarget(null)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>취소</Button>
            <Button variant="primary" onClick={submitEdit}>저장</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">공식 확인 필요 사항 (한 줄에 하나)</span>
            <textarea
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              rows={4}
              placeholder="예: 접수 기간과 예산 소진 여부를 공고에서 확인"
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">검토 의견</span>
            <textarea
              value={opinionText}
              onChange={(e) => setOpinionText(e.target.value)}
              rows={4}
              className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </Modal>
    </>
  )
}

export function FundingMatchesPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => <MatchesBody strategy={strategy} />}
    />
  )
}
