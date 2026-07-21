import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Info,
  Layers,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import type { FundingQualityCheck, FundingQualitySeverity, FundingStrategy } from '../../types/funding'
import { SummaryStrip, type SummaryStripItem } from '../../components/ui/SummaryStrip'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  checkCanFinalize,
  createNewVersion,
  finalizeStrategy,
  markReviewed,
  needsRefresh,
  summarizeStrategy,
  updateStrategyMeta,
} from '../../services/fundingService'
import { FundingStrategyFrame, ReadOnlyNotice, StaleBanner } from './fundingShared'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const SEVERITY_TEXT: Record<FundingQualitySeverity, string> = {
  error: 'text-danger-700',
  warning: 'text-warning-700',
  info: 'text-slate-500',
}
const SEVERITY_LABEL: Record<FundingQualitySeverity, string> = {
  error: '오류',
  warning: '주의',
  info: '참고',
}

const SECTIONS = [
  { id: 'sec-objective', label: '연계 목적' },
  { id: 'sec-candidates', label: '후보 기관' },
  { id: 'sec-evidence', label: '근거·부족조건' },
  { id: 'sec-official', label: '공식 확인사항' },
  { id: 'sec-progress', label: '진행 현황' },
  { id: 'sec-source', label: '출처 최신성' },
  { id: 'sec-risk', label: '위험·미해결' },
  { id: 'sec-editor', label: '요약·의견' },
  { id: 'sec-quality', label: '품질검사' },
]

export function FundingReviewPage() {
  const { projectId = '' } = useParams()
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => <ReviewContent strategy={strategy} projectId={projectId} />}
    />
  )
}

function ReviewContent({ strategy, projectId }: { strategy: FundingStrategy; projectId: string }) {
  const { showToast } = useToast()
  const readOnly = strategy.status === 'finalized' || strategy.status === 'superseded'
  const summary = summarizeStrategy(strategy)
  const stale = needsRefresh(strategy)
  const finalizeCheck = checkCanFinalize(strategy)
  const base = `/funding/projects/${projectId}`

  const [strategySummary, setStrategySummary] = useState(strategy.strategySummary)
  const [analystNotes, setAnalystNotes] = useState(strategy.analystNotes)
  const [officialConfirmationNotes, setOfficialConfirmationNotes] = useState(strategy.officialConfirmationNotes)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [busy, setBusy] = useState(false)

  const primaryMatches = strategy.matches.filter((m) => m.priority === 'primary')
  const secondaryMatches = strategy.matches.filter((m) => m.priority === 'secondary')
  const criticalGaps = strategy.gaps.filter(
    (g) => g.severity === 'critical' && (g.status === 'open' || g.status === 'in_progress'),
  )
  const officialConfirmations = strategy.matches.flatMap((m) => m.officialConfirmationRequired)

  const stats: SummaryStripItem[] = [
    { key: 'match', label: '후보 기관', value: summary.matchCount, unit: '개', tone: 'info', icon: Building2 },
    { key: 'primary', label: '우선 검토', value: summary.primaryCount, unit: '개', tone: 'success', icon: CheckCircle2 },
    { key: 'gap', label: '미해결 부족조건', value: summary.openGapCount, unit: '건', tone: summary.openGapCount > 0 ? 'warning' : 'neutral', icon: ClipboardList },
    { key: 'error', label: '확정 전 오류', value: summary.blockingErrorCount, unit: '건', tone: summary.blockingErrorCount > 0 ? 'danger' : 'success', icon: FileWarning },
  ]

  const saveMeta = () => {
    try {
      updateStrategyMeta(strategy.id, { strategySummary, analystNotes, officialConfirmationNotes })
      showToast('전략 요약·의견을 저장했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const saveDraft = () => {
    try {
      updateStrategyMeta(strategy.id, { strategySummary, analystNotes, officialConfirmationNotes })
      showToast('초안을 저장했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doMarkReviewed = () => {
    try {
      markReviewed(strategy.id)
      showToast('내부 검토 완료로 표시했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doFinalize = () => {
    setBusy(true)
    try {
      finalizeStrategy(strategy.id)
      showToast('전략을 확정하고 스냅샷을 생성했습니다.')
      setConfirmFinalize(false)
    } catch (err) {
      showToast(toErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const doNewVersion = () => {
    try {
      createNewVersion(projectId)
      showToast('새 버전을 만들었습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ReadOnlyNotice strategy={strategy} />
      <StaleBanner show={stale} />

      {/* 섹션 이동 (키보드 내비게이션) */}
      <nav aria-label="검토 섹션 바로가기" className="flex flex-wrap gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3 shadow-(--shadow-card)">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-(--radius-control) border border-slate-200 px-2.5 py-1 text-[13px] font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* 연계 목적·자금 용도 */}
      <section id="sec-objective" tabIndex={-1} aria-label="연계 목적·자금 용도">
        <Panel title="연계 목적·자금 용도">
          <p className="mb-4 text-sm font-medium text-brand-700">{summary.headline}</p>
          <SummaryStrip ariaLabel="전략 요약 통계" items={stats} />
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-400">연계 목적</dt>
              <dd className="text-[13px] break-keep text-slate-700">{strategy.objective || '미입력'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">자금 용도</dt>
              <dd className="text-[13px] break-keep text-slate-700">{strategy.targetUse || '미입력'}</dd>
            </div>
          </dl>
        </Panel>
      </section>

      {/* 후보 기관·프로그램 */}
      <section id="sec-candidates" tabIndex={-1} aria-label="후보 기관·프로그램">
        <Panel title="후보 기관·프로그램">
          <p className="mb-3 text-[13px] text-slate-500">우선 검토 {primaryMatches.length}개 · 보조 검토 {secondaryMatches.length}개 · 전체 {summary.matchCount}개</p>
          {primaryMatches.length === 0 ? (
            <p className="text-[13px] text-warning-700">우선 검토 후보가 없습니다. 기관 후보 화면에서 우선순위를 지정하세요.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {primaryMatches.map((m) => (
                <li key={m.id} className="rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2 text-[13px] break-keep text-slate-700">
                  <span className="mr-1.5 rounded-md border border-success-200 bg-success-50 px-1.5 py-0.5 text-xs font-medium text-success-700">우선</span>
                  {m.reasonSummary || '사유 미입력'}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* 근거·부족조건 */}
      <section id="sec-evidence" tabIndex={-1} aria-label="근거·부족조건">
        <Panel title="근거·부족조건">
          <p className="mb-3 text-[13px] text-slate-500">
            근거 {summary.evidenceCount}건 (검증 {summary.verifiedEvidenceCount}건) · 부족조건 {summary.gapCount}건 (미해결 {summary.openGapCount}건 · 중대 {summary.criticalGapCount}건)
          </p>
          {criticalGaps.length === 0 ? (
            <p className="text-[13px] text-success-700">미해결 중대 부족조건이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {criticalGaps.map((g) => (
                <li key={g.id} className="flex items-start gap-2 rounded-(--radius-card) border border-danger-200 bg-danger-50/60 px-3 py-2">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-600" />
                  <div>
                    <p className="text-[13px] font-medium break-keep text-danger-800">{g.title}</p>
                    <p className="text-xs break-keep text-danger-700">{g.requiredAction || g.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* 공식 확인사항 */}
      <section id="sec-official" tabIndex={-1} aria-label="공식 확인사항">
        <Panel title="공식 확인사항">
          <div aria-live="polite">
            {officialConfirmations.length === 0 ? (
              <p className="text-[13px] text-slate-500">등록된 공식 확인사항이 없습니다. 실제 조건은 공식 공고와 기관 문의로 확인하세요.</p>
            ) : (
              <>
                <p className="mb-2 text-[13px] font-medium text-warning-700">공식 공고·기관 확인이 필요한 항목 {officialConfirmations.length}건</p>
                <ul className="flex flex-col gap-1.5">
                  {officialConfirmations.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[13px] break-keep text-slate-700">
                      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Panel>
      </section>

      {/* 진행 현황 */}
      <section id="sec-progress" tabIndex={-1} aria-label="진행 현황">
        <Panel title="접촉·준비·신청·결과·사례 진행">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ProgressRow label="접촉 계획" value={`${strategy.outreachPlans.length}건 · 접촉 이력 ${strategy.outreachActivities.length}건`} to={`${base}/outreach`} />
            <ProgressRow label="준비자료" value={`${summary.docCount}건 (준비완료 ${summary.docReadyCount}건)`} to={`${base}/checklist`} />
            <ProgressRow label="신청·심사" value={`${summary.applicationCount}건 · 현재 ${summary.currentStageLabel || '없음'}`} to={`${base}/pipeline`} />
            <ProgressRow label="결과·성과" value={`결과 ${summary.outcomeCount}건 · 검증 KPI ${summary.verifiedMetricCount}건`} to={`${base}/outcome`} />
            <ProgressRow label="사례 후보" value={summary.caseCandidate ? '실제 결과 기반 사례 정리 가능' : '실제 결과 필요'} to={`${base}/case`} />
          </ul>
        </Panel>
      </section>

      {/* 출처 최신성 */}
      <section id="sec-source" tabIndex={-1} aria-label="출처 최신성">
        <Panel title="출처 최신성" flush>
          <div className="px-5 pt-4">
            <StaleBanner show={stale} />
          </div>
          {strategy.sourceSnapshot.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-slate-500">기록된 출처 스냅샷이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto px-5 py-4">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-400">
                    <th scope="col" className="py-2 pr-3 font-medium">출처</th>
                    <th scope="col" className="py-2 pr-3 font-medium">유형</th>
                    <th scope="col" className="py-2 pr-3 font-medium">버전</th>
                    <th scope="col" className="py-2 pr-3 font-medium">가용</th>
                    <th scope="col" className="py-2 font-medium">확인 시각</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {strategy.sourceSnapshot.map((src) => (
                    <tr key={`${src.sourceType}-${src.sourceId}`}>
                      <td className="py-2 pr-3 break-keep text-slate-700">{src.label}</td>
                      <td className="py-2 pr-3 text-slate-500">{src.sourceType}</td>
                      <td className="py-2 pr-3 text-slate-500">v{src.version}</td>
                      <td className="py-2 pr-3">
                        {src.available ? (
                          <span className="text-success-700">가용</span>
                        ) : (
                          <span className="text-danger-700">누락</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-500">{formatDate(src.capturedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </section>

      {/* 위험·미해결 */}
      <section id="sec-risk" tabIndex={-1} aria-label="위험·미해결 질문">
        <Panel title="위험·미해결 질문">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">위험</p>
              {strategy.risks.length === 0 ? (
                <p className="text-[13px] text-slate-400">등록된 위험 없음</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {strategy.risks.map((r, idx) => (
                    <li key={idx} className="text-[13px] break-keep text-slate-600">· {r}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">미해결 질문</p>
              {strategy.openQuestions.length === 0 ? (
                <p className="text-[13px] text-slate-400">등록된 질문 없음</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {strategy.openQuestions.map((q, idx) => (
                    <li key={idx} className="text-[13px] break-keep text-slate-600">· {q}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* 요약·의견 편집 */}
      <section id="sec-editor" tabIndex={-1} aria-label="전략 요약·의견 편집">
        <Panel
          title="전략 요약·의견"
          actions={!readOnly && <Button variant="secondary" size="sm" onClick={saveMeta}>저장</Button>}
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">전략 요약</span>
              <textarea className={inputClass} rows={3} value={strategySummary} disabled={readOnly} onChange={(e) => setStrategySummary(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">내부 의견 (분석가 노트)</span>
              <textarea className={inputClass} rows={3} value={analystNotes} disabled={readOnly} onChange={(e) => setAnalystNotes(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-600">공식 확인사항 메모</span>
              <textarea className={inputClass} rows={3} value={officialConfirmationNotes} disabled={readOnly} onChange={(e) => setOfficialConfirmationNotes(e.target.value)} />
            </label>
          </div>
        </Panel>
      </section>

      {/* 품질검사 */}
      <section id="sec-quality" tabIndex={-1} aria-label="품질검사">
        <Panel title="품질검사">
          <div aria-live="polite" className="mb-4">
            {finalizeCheck.ok ? (
              <div className="flex items-center gap-2 rounded-(--radius-card) border border-success-200 bg-success-50/60 px-3 py-2 text-[13px] font-medium text-success-700">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                확정 가능한 상태입니다.
              </div>
            ) : (
              <div className="rounded-(--radius-card) border border-danger-200 bg-danger-50/60 px-3 py-2">
                <p className="flex items-center gap-2 text-[13px] font-medium text-danger-700">
                  <XCircle aria-hidden="true" className="size-4" />
                  확정 전 해결할 항목 {finalizeCheck.reasons.length}건
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {finalizeCheck.reasons.map((r, idx) => (
                    <li key={idx} className="text-xs break-keep text-danger-700">· {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {strategy.qualityChecks.length === 0 ? (
            <p className="text-[13px] text-slate-500">품질검사 항목이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {(['error', 'warning', 'info'] as FundingQualitySeverity[]).map((sev) => {
                const items = strategy.qualityChecks.filter((c) => c.severity === sev)
                if (items.length === 0) return null
                return <QualityGroup key={sev} severity={sev} items={items} />
              })}
            </div>
          )}
        </Panel>
      </section>

      {/* 상태 액션 */}
      <Panel title="상태·확정">
        {strategy.status === 'finalized' && (
          <div className="mb-4 flex items-center gap-2 rounded-(--radius-card) border border-success-200 bg-success-50/60 px-3 py-2 text-[13px] text-success-700">
            <ShieldCheck aria-hidden="true" className="size-4" />
            확정일 {formatDate(strategy.finalizedAt)} · 스냅샷 생성됨 (읽기 전용)
          </div>
        )}
        {!finalizeCheck.ok && !readOnly && (
          <p className="mb-3 text-[13px] text-warning-700">확정하려면 위 품질검사의 오류를 먼저 해결하세요.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <Button variant="secondary" onClick={saveDraft}>초안 저장</Button>
              <Button variant="secondary" onClick={doMarkReviewed}>내부 검토 완료</Button>
              <Button variant="primary" onClick={() => setConfirmFinalize(true)} disabled={!finalizeCheck.ok}>
                <ShieldCheck aria-hidden="true" className="size-4" />
                전략 확정
              </Button>
            </>
          )}
          {strategy.status === 'finalized' && (
            <Button variant="secondary" onClick={doNewVersion}>
              <Layers aria-hidden="true" className="size-4" />
              새 버전
            </Button>
          )}
        </div>
      </Panel>

      <ConfirmModal
        open={confirmFinalize}
        title="전략 확정"
        message="이 연계 전략을 확정하시겠습니까?"
        warning="확정 시 현재 내용의 스냅샷이 생성되며 전략은 읽기 전용이 됩니다. 이후 수정은 새 버전에서만 가능합니다."
        confirmLabel="확정"
        busy={busy}
        onConfirm={doFinalize}
        onCancel={() => setConfirmFinalize(false)}
      />
    </div>
  )
}

function ProgressRow({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-[13px] break-keep text-slate-700">{value}</p>
      </div>
      <NavLink to={to} className="shrink-0 text-[13px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
        이동
      </NavLink>
    </li>
  )
}

const SEVERITY_CHIP: Record<FundingQualitySeverity, string> = {
  error: 'border-danger-200 bg-danger-50 text-danger-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-700',
  info: 'border-slate-200 bg-slate-50 text-slate-600',
}
const SEVERITY_BORDER: Record<FundingQualitySeverity, string> = {
  error: 'border-danger-200',
  warning: 'border-warning-200',
  info: 'border-slate-200',
}

function QualityGroup({ severity, items }: { severity: FundingQualitySeverity; items: FundingQualityCheck[] }) {
  return (
    <div>
      <p className={`mb-1.5 text-xs font-semibold ${SEVERITY_TEXT[severity]}`}>{SEVERITY_LABEL[severity]} ({items.length})</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((c) => (
          <li key={c.id} className={`rounded-(--radius-card) border ${SEVERITY_BORDER[severity]} px-3 py-2`}>
            <div className="flex items-center gap-2">
              <span className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${c.passed ? 'border-success-200 bg-success-50 text-success-700' : SEVERITY_CHIP[severity]}`}>
                {c.passed ? '통과' : SEVERITY_LABEL[severity]}
              </span>
              <span className="text-[13px] font-medium break-keep text-slate-700">{c.title}</span>
            </div>
            <p className="mt-0.5 text-xs break-keep text-slate-500">{c.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
