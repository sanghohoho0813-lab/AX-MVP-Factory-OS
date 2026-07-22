import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  ListChecks,
  Route,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type {
  DeliverablePackage,
  DeliverableQualitySeverity,
  DeliverableSourceReference,
} from '../../types/deliverables'
import {
  checkCanFinalize,
  finalizePackage,
  markReviewed,
  needsRefresh,
  summarizePackage,
  toggleRedactionRule,
  updatePackageMeta,
} from '../../services/deliverableService'
import { formatDate, formatDateTime } from '../../lib/format'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { HelpNote } from '../../components/ui/HelpNote'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { DeliverableQualityBadge } from '../../components/deliverables/badges'
import { useToast } from '../../components/ui/toastContext'
import { PackageSectionFrame, ReadOnlyNotice } from './deliverableShared'

const SEVERITY_ORDER: DeliverableQualitySeverity[] = ['error', 'warning', 'info']
const SEVERITY_LABEL: Record<DeliverableQualitySeverity, string> = {
  error: '오류',
  warning: '경고',
  info: '안내',
}

function ReviewBody({ pkg, packageId }: { pkg: DeliverablePackage; packageId: string }) {
  const { showToast } = useToast()
  const readOnly = pkg.status === 'finalized' || pkg.status === 'superseded' || pkg.status === 'archived'
  const summary = summarizePackage(pkg)
  const stale = needsRefresh(pkg)
  const finalizeCheck = checkCanFinalize(pkg)

  const [finalSummary, setFinalSummary] = useState(pkg.finalSummary)
  const [reviewNotes, setReviewNotes] = useState(pkg.reviewNotes)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function handleSaveMeta() {
    try {
      updatePackageMeta(packageId, { finalSummary, reviewNotes })
      showToast('최종 요약과 검토 메모를 저장했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '저장에 실패했습니다.')
    }
  }

  function handleToggleRule(ruleId: string, enabled: boolean) {
    try {
      toggleRedactionRule(packageId, ruleId, enabled)
      showToast(enabled ? '가림 규칙을 적용했습니다.' : '가림 규칙을 해제했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '가림 규칙을 변경하지 못했습니다.')
    }
  }

  function handleMarkReviewed() {
    try {
      markReviewed(packageId)
      showToast('내부 검토 완료로 표시했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '상태를 변경하지 못했습니다.')
    }
  }

  function handleFinalize() {
    setBusy(true)
    try {
      finalizePackage(packageId)
      showToast('자료 패키지를 확정했습니다. 스냅샷이 생성되었습니다.')
      setConfirmOpen(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '확정에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const sourceColumns: DataTableColumn<DeliverableSourceReference>[] = [
    {
      key: 'label',
      header: '출처',
      cell: (r) => <span className="break-keep text-slate-700">{r.label}</span>,
    },
    {
      key: 'captured',
      header: '반영 시점',
      cell: (r) => <span className="text-slate-500">{formatDate(r.capturedAt)}</span>,
    },
    {
      key: 'available',
      header: '사용 가능',
      cell: (r) =>
        r.available ? (
          <span className="inline-flex items-center gap-1 text-success-700">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            사용 가능
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-danger-600">
            <XCircle aria-hidden="true" className="size-4" />
            누락
          </span>
        ),
    },
    {
      key: 'stale',
      header: '상태',
      cell: (r) =>
        r.stale ? (
          <span className="text-warning-700">원본 변경됨</span>
        ) : (
          <span className="text-slate-400">최신</span>
        ),
    },
  ]

  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    checks: pkg.qualityChecks.filter((c) => c.severity === severity),
  })).filter((g) => g.checks.length > 0)

  const finalizeDisabled = !finalizeCheck.ok || readOnly

  return (
    <>
      <HelpNote
        summary="자료를 최종 검토하고, 공개 범위를 확인한 뒤 자료 패키지를 확정합니다."
        what="개요·출처 최신성·포함 자료·가림 규칙·품질검사를 점검하고 최종 요약을 작성합니다."
        when="모든 Section 편집을 마치고 배포 직전에 사용합니다."
        next="확정하면 스냅샷이 생성되고 읽기 전용이 됩니다. 이후 수정은 새 버전에서 진행하세요."
      />

      <ReadOnlyNotice pkg={pkg} />

      {/* 화면 내 이동 */}
      <nav aria-label="검토 항목 이동" className="flex flex-wrap gap-2 text-[0.9rem]">
        {[
          { href: '#review-overview', label: 'A. 패키지 개요' },
          { href: '#review-sources', label: 'B. 출처 최신성' },
          { href: '#review-contents', label: 'C. 포함 자료' },
          { href: '#review-summary', label: 'D. 최종 요약·메모' },
          { href: '#review-redaction', label: 'E. 공개 범위·가림' },
          { href: '#review-quality', label: 'F. 품질검사' },
          { href: '#review-finalize', label: 'G. 상태·확정' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-(--radius-control) border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* A. 패키지 개요 */}
      <div id="review-overview" className="flex flex-col gap-4 scroll-mt-4">
        <Panel title="A. 패키지 개요">
          <p className="text-[0.9rem] leading-relaxed break-keep text-slate-700">{summary.headline}</p>
          {!summary.includesValidation && (
            <p className="mt-2 text-[0.9rem] break-keep text-warning-700">
              검증 전 설계안입니다. 실제 사용 테스트로 검증되지 않았으므로 &ldquo;검증 완료&rdquo;로 표기하지 않습니다.
            </p>
          )}
          <div className="mt-4">
            <SummaryStrip
              ariaLabel="패키지 개요 지표"
              items={[
                { key: 'sections', label: '활성 Section', value: summary.activeSectionCount, unit: '개', tone: 'info', icon: ListChecks },
                { key: 'prompts', label: '개발 프롬프트', value: summary.promptCount, unit: '개', tone: 'accent', icon: Sparkles },
                { key: 'roadmap', label: '로드맵 단계', value: summary.roadmapPhaseCount, unit: '개', tone: 'neutral', icon: Route },
                { key: 'evidence', label: '근거 항목', value: summary.evidenceCount, unit: '개', tone: 'neutral', icon: ClipboardList },
              ]}
            />
          </div>
        </Panel>
      </div>

      {/* B. 출처 최신성 */}
      <div id="review-sources" className="scroll-mt-4">
        <Panel title="B. 출처 최신성" flush>
          {stale && (
            <div className="mx-5 mt-5 flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
              <p className="text-[0.9rem] break-keep text-warning-800">
                출처 원본이 변경되었습니다. 확정된 자료는 그대로 보존되며, 최신 결과를 반영하려면 새 버전을 만드세요.
              </p>
            </div>
          )}
          <div className="overflow-x-auto px-5 py-5">
            {pkg.sourceReferences.length > 0 ? (
              <DataTable
                columns={sourceColumns}
                rows={pkg.sourceReferences}
                rowKey={(r) => r.id}
              />
            ) : (
              <p className="text-[0.9rem] break-keep text-slate-500">연결된 출처가 없습니다.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* C. 포함 자료 */}
      <div id="review-contents" className="scroll-mt-4">
        <Panel title="C. 포함 자료 수">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: '전체 Section', value: `${summary.sectionCount}개` },
              { label: '활성 Section', value: `${summary.activeSectionCount}개` },
              { label: '고객 공개 Section', value: `${summary.clientVisibleCount}개` },
              { label: '수동 수정본', value: `${summary.manualEditedCount}개` },
              { label: '개발 프롬프트', value: `${summary.promptCount}개` },
              { label: '근거 항목', value: `${summary.evidenceCount}개` },
            ].map((item) => (
              <div key={item.label} className="rounded-(--radius-card) border border-slate-200 px-4 py-3">
                <dt className="text-[0.9rem] text-slate-400">{item.label}</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-[0.9rem]">
            <span className="text-slate-500">세부 내용은 각 탭에서 확인하세요:</span>
            {[
              { to: 'contents', label: '포함 자료', icon: ListChecks },
              { to: 'reports', label: '보고서', icon: FileText },
              { to: 'roadmap', label: '실행 로드맵', icon: Route },
              { to: 'preview', label: '미리보기', icon: Eye },
            ].map((link) => (
              <Link
                key={link.to}
                to={`/deliverables/projects/${pkg.projectId}/packages/${pkg.id}/${link.to}`}
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                <link.icon aria-hidden="true" className="size-3.5" />
                {link.label}
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* D. 최종 요약·메모 */}
      <div id="review-summary" className="scroll-mt-4">
        <Panel
          title="D. 최종 요약·검토 메모"
          actions={
            <Button variant="secondary" size="sm" onClick={handleSaveMeta} disabled={readOnly}>
              저장
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="final-summary" className="mb-1.5 block text-[0.9rem] font-semibold text-slate-700">
                최종 요약
              </label>
              <textarea
                id="final-summary"
                value={finalSummary}
                onChange={(e) => setFinalSummary(e.target.value)}
                disabled={readOnly}
                rows={4}
                placeholder="자료 전체를 한눈에 설명하는 요약을 작성하세요."
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div>
              <label htmlFor="review-notes" className="mb-1.5 block text-[0.9rem] font-semibold text-slate-700">
                검토 메모
              </label>
              <textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={readOnly}
                rows={3}
                placeholder="내부 검토 과정에서 남길 메모입니다."
                className="w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[0.9rem] font-semibold text-slate-700">가정</p>
                {pkg.assumptions.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {pkg.assumptions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.9rem] break-keep text-slate-600">
                        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                        <span className="min-w-0">{a}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.9rem] text-slate-400">등록된 가정이 없습니다.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[0.9rem] font-semibold text-slate-700">미확인 질문</p>
                {pkg.openQuestions.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {pkg.openQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.9rem] break-keep text-slate-600">
                        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning-400" />
                        <span className="min-w-0">{q}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[0.9rem] text-slate-400">미확인 질문이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* E. 공개 범위·가림 처리 */}
      <div id="review-redaction" className="scroll-mt-4">
        <Panel title="E. 공개 범위·가림 처리">
          {pkg.redactionRules.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {pkg.redactionRules.map((rule) => {
                const personalWarn =
                  rule.type === 'remove_personal_contact' &&
                  !rule.enabled &&
                  (pkg.audience === 'client' || pkg.audience === 'institution')
                return (
                  <li
                    key={rule.id}
                    className="flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[0.9rem] break-keep text-slate-700">{rule.description}</p>
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-[0.9rem] text-slate-600">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={readOnly}
                          onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                          className="size-4 accent-brand-600 disabled:cursor-not-allowed"
                        />
                        {rule.enabled ? '적용' : '해제'}
                      </label>
                    </div>
                    {personalWarn && (
                      <p className="flex items-start gap-1.5 text-[0.9rem] break-keep text-danger-600">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        고객·기관용 자료에서 개인정보 가림을 해제하면 연락처·이메일이 그대로 노출됩니다.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[0.9rem] break-keep text-slate-500">등록된 가림 규칙이 없습니다.</p>
          )}
        </Panel>
      </div>

      {/* F. 품질검사 */}
      <div id="review-quality" className="scroll-mt-4">
        <Panel title="F. 품질검사">
          <p aria-live="polite" className="text-[0.9rem] break-keep">
            {finalizeCheck.ok ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-700">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                확정 조건을 충족했습니다.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-danger-600">
                <XCircle aria-hidden="true" className="size-4" />
                확정 전 해결할 오류 {finalizeCheck.reasons.length}건이 있습니다.
              </span>
            )}
          </p>

          {grouped.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4">
              {grouped.map((group) => (
                <div key={group.severity}>
                  <p className="mb-2 text-[0.9rem] font-semibold text-slate-600">
                    {SEVERITY_LABEL[group.severity]} ({group.checks.length})
                  </p>
                  <ul className="flex flex-col gap-2">
                    {group.checks.map((check) => (
                      <li
                        key={check.id}
                        className="flex items-start gap-2.5 rounded-(--radius-card) border border-slate-200 px-3.5 py-2.5"
                      >
                        <DeliverableQualityBadge severity={check.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.9rem] font-medium break-keep text-slate-700">{check.title}</p>
                          <p className="text-[0.9rem] break-keep text-slate-500">{check.description}</p>
                        </div>
                        {check.passed ? (
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-500" />
                        ) : (
                          <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-500" />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[0.9rem] break-keep text-slate-500">기록된 품질검사 항목이 없습니다.</p>
          )}
        </Panel>
      </div>

      {/* G. 상태·확정 */}
      <div id="review-finalize" className="scroll-mt-4">
        <Panel title="G. 상태·확정">
          {pkg.status === 'finalized' ? (
            <div className="flex flex-col gap-2 rounded-(--radius-card) border border-success-200 bg-success-50/60 px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-success-800">
                <CheckCircle2 aria-hidden="true" className="size-4" />
                자료가 확정되었습니다.
              </p>
              <p className="text-[0.9rem] break-keep text-success-800">
                확정일 {formatDateTime(pkg.finalizedAt)} · 확정 스냅샷이 생성되어 원본 보존됩니다.
              </p>
              {pkg.finalizedBy && <p className="text-[0.9rem] text-success-700">확정자 {pkg.finalizedBy}</p>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => showToast('현재 편집 내용은 자동 저장됩니다.')}
                  disabled={readOnly}
                >
                  초안 저장
                </Button>
                <Button variant="secondary" onClick={handleMarkReviewed} disabled={readOnly}>
                  내부 검토 완료
                </Button>
                <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={finalizeDisabled}>
                  자료 패키지 확정
                </Button>
              </div>
              {finalizeDisabled && !readOnly && finalizeCheck.reasons.length > 0 && (
                <div className="mt-3 rounded-(--radius-card) border border-danger-200 bg-danger-50/60 px-4 py-3">
                  <p className="text-[0.9rem] font-semibold text-danger-700">확정 전 해결이 필요합니다.</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {finalizeCheck.reasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.9rem] break-keep text-danger-700">
                        <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger-400" />
                        <span className="min-w-0">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="자료 패키지 확정"
        message="이 자료 패키지를 확정합니다. 확정 후에는 이 화면에서 수정할 수 없습니다."
        warning="확정 시 스냅샷이 생성되고 읽기 전용이 됩니다. 이후 변경은 새 버전에서 진행하세요."
        confirmLabel="확정"
        busy={busy}
        onConfirm={handleFinalize}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}

export function PackageReviewPage() {
  const { projectId = '', packageId = '' } = useParams()
  return (
    <PackageSectionFrame
      projectId={projectId}
      packageId={packageId}
      render={(pkg) => <ReviewBody pkg={pkg} packageId={packageId} />}
    />
  )
}
