import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Pencil, RotateCcw } from 'lucide-react'
import type { CaseVisibility, ConsentStatus } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  CASE_VISIBILITIES,
  CASE_VISIBILITY_META,
  CONSENT_STATUSES,
  CONSENT_STATUS_META,
} from '../../lib/fundingMeta'
import { CaseStatusBadge, CaseVisibilityBadge, ConsentBadge } from '../../components/funding/badges'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { Modal } from '../../components/ui/Modal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  approveCase,
  archiveCase,
  getCaseContext,
  markReview,
  restoreOriginalDraft,
  setConsentStatus,
  setVisibility,
  updateCase,
  type CaseContext,
} from '../../services/caseStudyService'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-sm'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}
function linesToArray(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '')
}

export function CaseDetailPage() {
  const { caseId = '' } = useParams()
  const version = useStoreVersion()
  const context = useMemo<CaseContext | null>(() => {
    return getCaseContext(caseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, version])

  if (!context) {
    return (
      <NotFoundState
        title="사례를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·보관된 사례입니다."
        backTo="/cases"
        backLabel="사례 라이브러리로"
      />
    )
  }
  return <CaseDetailContent context={context} />
}

interface EditFormState {
  title: string
  outcomeSummary: string
  lessons: string
  reusableInsights: string
  customerQuote: string
}

function CaseDetailContent({ context }: { context: CaseContext }) {
  const { showToast } = useToast()
  const { caseStudy, anonymization, canApprove } = context
  const readOnly = caseStudy.status === 'approved' || caseStudy.status === 'archived'

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    title: caseStudy.title,
    outcomeSummary: caseStudy.outcomeSummary,
    lessons: caseStudy.lessons.join('\n'),
    reusableInsights: caseStudy.reusableInsights.join('\n'),
    customerQuote: caseStudy.customerQuote,
  })
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const openEdit = () => {
    setForm({
      title: caseStudy.title,
      outcomeSummary: caseStudy.outcomeSummary,
      lessons: caseStudy.lessons.join('\n'),
      reusableInsights: caseStudy.reusableInsights.join('\n'),
      customerQuote: caseStudy.customerQuote,
    })
    setEditOpen(true)
  }
  const submitEdit = () => {
    try {
      updateCase(caseStudy.id, {
        title: form.title,
        outcomeSummary: form.outcomeSummary,
        lessons: linesToArray(form.lessons),
        reusableInsights: linesToArray(form.reusableInsights),
        customerQuote: form.customerQuote,
      })
      showToast('사례 내용을 저장했습니다.')
      setEditOpen(false)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doRestore = () => {
    try {
      restoreOriginalDraft(caseStudy.id)
      showToast('자동 초안 원본으로 복구했습니다.')
      setConfirmRestore(false)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const changeConsent = (value: ConsentStatus) => {
    try {
      setConsentStatus(caseStudy.id, value)
      showToast('동의 상태를 변경했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const changeVisibility = (value: CaseVisibility) => {
    try {
      setVisibility(caseStudy.id, value)
      showToast('공개 범위를 변경했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doMarkReview = () => {
    try {
      markReview(caseStudy.id)
      showToast('검토 요청으로 표시했습니다.')
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doApprove = () => {
    try {
      approveCase(caseStudy.id)
      showToast('사례를 승인했습니다.')
      setConfirmApprove(false)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }
  const doArchive = () => {
    try {
      archiveCase(caseStudy.id)
      showToast('사례를 보관했습니다.')
      setConfirmArchive(false)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo="/cases"
        backLabel="사례 라이브러리"
        title={caseStudy.title || '제목 없음'}
        badges={
          <>
            <CaseStatusBadge status={caseStudy.status} />
            <CaseVisibilityBadge visibility={caseStudy.visibility} />
            <ConsentBadge status={caseStudy.consentStatus} />
            {caseStudy.manuallyEdited && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500">직접 수정됨</span>
            )}
          </>
        }
        meta={caseStudy.industry ? <span>{caseStudy.industry}</span> : undefined}
        actions={
          !readOnly && (
            <>
              <Button variant="secondary" size="sm" onClick={openEdit}>
                <Pencil aria-hidden="true" className="size-3.5" />
                내용 편집
              </Button>
              {caseStudy.manuallyEdited && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRestore(true)}>
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  원본 복구
                </Button>
              )}
            </>
          )
        }
      />

      {/* 익명화·재식별 점검 */}
      <Panel title="익명화 점검">
        <div aria-live="polite">
          {anonymization.ok ? (
            <p className="text-[13px] text-success-700">재식별 가능한 정보가 발견되지 않았습니다.</p>
          ) : (
            <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3 py-2.5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-warning-800">
                <AlertTriangle aria-hidden="true" className="size-4" />
                익명화 검토가 필요합니다 ({anonymization.issues.length}건)
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {anonymization.issues.map((issue, idx) => (
                  <li key={idx} className="text-xs break-keep text-warning-700">· {issue}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-xs break-keep text-slate-500">
            익명화·공개 사례는 회사명·대표자·연락처·주소 등 재식별 가능한 조합을 피해야 합니다.
          </p>
        </div>
      </Panel>

      {/* 공개·동의 관리 */}
      <Panel title="공개 범위·고객 동의">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">고객 동의 상태</span>
            <select
              className={inputClass}
              value={caseStudy.consentStatus}
              disabled={readOnly}
              onChange={(e) => changeConsent(e.target.value as ConsentStatus)}
            >
              {CONSENT_STATUSES.map((s) => (
                <option key={s} value={s}>{CONSENT_STATUS_META[s].label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">공개 범위</span>
            <select
              className={inputClass}
              value={caseStudy.visibility}
              disabled={readOnly}
              onChange={(e) => changeVisibility(e.target.value as CaseVisibility)}
            >
              {CASE_VISIBILITIES.map((v) => (
                <option key={v} value={v}>{CASE_VISIBILITY_META[v].label}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs break-keep text-slate-500">
          공개·고객 승인 범위는 고객 동의가 있어야 설정할 수 있습니다.
        </p>
      </Panel>

      {/* 상세 내용 */}
      <Panel title="사례 상세">
        <div className="flex flex-col gap-4">
          <DetailText title="기업 개요" value={caseStudy.companyProfile} />
          <DetailText title="초기 상황" value={caseStudy.initialSituation} />
          <DetailList title="핵심 문제" items={caseStudy.keyProblems} />
          <DetailText title="전략 요약" value={caseStudy.strategySummary} />
          <DetailList title="연결 기관" items={caseStudy.selectedInstitutions} />
          <DetailList title="연결 프로그램" items={caseStudy.selectedPrograms} />
          <DetailList title="준비 활동" items={caseStudy.preparationActions} />
          <DetailText title="진행 요약" value={caseStudy.timelineSummary} />
          <div>
            <p className="text-xs font-semibold text-slate-500">결과 요약 (실제 결과)</p>
            <p className="mt-0.5 rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2 text-[13px] break-keep text-slate-700">
              {caseStudy.outcomeSummary || '결과 요약 없음'}
            </p>
          </div>
          <DetailList title="검증된 성과" items={caseStudy.verifiedMetrics} />
          <DetailList title="어려움" items={caseStudy.challenges} />
          <DetailList title="배운 점" items={caseStudy.lessons} />
          <DetailList title="재사용 인사이트" items={caseStudy.reusableInsights} />
          {caseStudy.customerQuote.trim() !== '' && (
            <div>
              <p className="text-xs font-semibold text-slate-500">고객 인용</p>
              <blockquote className="mt-0.5 border-l-2 border-brand-200 pl-3 text-[13px] break-keep text-slate-600 italic">
                “{caseStudy.customerQuote}”
              </blockquote>
            </div>
          )}
          <DetailText title="익명화 메모" value={caseStudy.anonymizationNotes} />
          <p className="text-xs text-slate-400">연결 근거 {caseStudy.evidenceIds.length}건</p>
        </div>
      </Panel>

      {/* 라이프사이클 */}
      <Panel title="사례 승인·보관">
        {!canApprove.ok && (
          <div className="mb-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3 py-2">
            <p className="text-[13px] font-medium text-warning-800">승인 전 해결할 항목 {canApprove.reasons.length}건</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {canApprove.reasons.map((r, idx) => (
                <li key={idx} className="text-xs break-keep text-warning-700">· {r}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <Button variant="secondary" onClick={doMarkReview}>검토 요청</Button>
              <Button variant="primary" onClick={() => setConfirmApprove(true)} disabled={!canApprove.ok}>사례 승인</Button>
            </>
          )}
          {caseStudy.status !== 'archived' && (
            <Button variant="secondary" onClick={() => setConfirmArchive(true)}>보관</Button>
          )}
        </div>
      </Panel>

      {/* 편집 모달 */}
      <Modal
        open={editOpen}
        title="사례 내용 편집"
        onClose={() => setEditOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submitEdit}>저장</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">제목</span>
            <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">결과 요약</span>
            <textarea className={inputClass} rows={3} value={form.outcomeSummary} onChange={(e) => setForm((f) => ({ ...f, outcomeSummary: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">배운 점 (줄바꿈으로 구분)</span>
            <textarea className={inputClass} rows={3} value={form.lessons} onChange={(e) => setForm((f) => ({ ...f, lessons: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">재사용 인사이트 (줄바꿈으로 구분)</span>
            <textarea className={inputClass} rows={3} value={form.reusableInsights} onChange={(e) => setForm((f) => ({ ...f, reusableInsights: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-600">고객 인용</span>
            <textarea className={inputClass} rows={2} value={form.customerQuote} onChange={(e) => setForm((f) => ({ ...f, customerQuote: e.target.value }))} />
          </label>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmRestore}
        title="원본 복구"
        message="직접 수정한 내용을 버리고 자동 초안 원본으로 되돌리시겠습니까?"
        warning="편집한 내용은 사라집니다. 공개 범위·동의 상태는 유지됩니다."
        confirmLabel="복구"
        danger
        onConfirm={doRestore}
        onCancel={() => setConfirmRestore(false)}
      />
      <ConfirmModal
        open={confirmApprove}
        title="사례 승인"
        message="이 사례를 승인하시겠습니까? 승인 후에는 읽기 전용이 됩니다."
        warning="승인 시 현재 공개 범위·동의 상태 기준으로 확정됩니다."
        confirmLabel="승인"
        onConfirm={doApprove}
        onCancel={() => setConfirmApprove(false)}
      />
      <ConfirmModal
        open={confirmArchive}
        title="사례 보관"
        message="이 사례를 보관하시겠습니까? 보관된 사례는 수정할 수 없습니다."
        confirmLabel="보관"
        danger
        onConfirm={doArchive}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  )
}

function DetailText({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <p className="mt-0.5 text-[13px] break-keep text-slate-700">{value.trim() === '' ? '미입력' : value}</p>
    </div>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-0.5 text-[13px] text-slate-400">미입력</p>
      ) : (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-[13px] break-keep text-slate-700">· {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
