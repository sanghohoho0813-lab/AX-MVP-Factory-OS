import { useMemo, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, Pencil, RotateCcw } from 'lucide-react'
import type { CaseVisibility, ConsentStatus } from '../../types/funding'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  CASE_STATUS_META,
  CASE_VISIBILITIES,
  CASE_VISIBILITY_META,
  CONSENT_STATUSES,
  CONSENT_STATUS_META,
} from '../../lib/fundingMeta'
import { CaseStatusBadge, CaseVisibilityBadge, ConsentBadge } from '../../components/funding/badges'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Modal } from '../../components/ui/Modal'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WorkspaceShell,
  WorkspaceNextAction,
  WorkspaceSummaryLine,
  WorkspaceCompletionChecklist,
  WorkspaceWarningPanel,
  type WorkspaceStep,
  type WorkspaceWarning,
} from '../../components/workspace/WorkspaceShell'
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

const MODULE_NAME = '사례 정리'
const MODULE_DESC = '실제 프로젝트 결과와 배운 점을 내부 학습자료 또는 고객 공개 사례로 정리합니다.'

const inputClass = 'w-full rounded-(--radius-control) border border-slate-200 px-3 py-2 text-[0.95rem]'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}
function linesToArray(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '')
}

/** 공개 범위를 쉬운 문장으로 (원어 enum 대신) */
function visibilitySentence(v: CaseVisibility): string {
  switch (v) {
    case 'internal':
      return '지금은 내부 전용입니다. 고객·홈페이지 등 외부에는 공개하지 않습니다.'
    case 'anonymized':
      return '익명화 사례입니다. 회사를 알아볼 수 없게 정리해 제한적으로 공유합니다.'
    case 'customer_approved':
      return '고객 승인 사례입니다. 고객이 동의한 범위 안에서 공유할 수 있습니다.'
    case 'public':
      return '공개 사례입니다. 외부에 공개할 수 있습니다.'
  }
}
/** 동의 상태를 쉬운 문장으로 */
function consentSentence(s: ConsentStatus): string {
  switch (s) {
    case 'not_requested':
      return '고객에게 아직 공개 동의를 요청하지 않았습니다.'
    case 'pending':
      return '고객에게 공개 동의를 요청했고 답변을 기다리는 중입니다.'
    case 'agreed':
      return '고객이 공개에 동의했습니다.'
    case 'declined':
      return '고객이 공개에 동의하지 않았습니다. 공개 사례로 만들 수 없습니다.'
    case 'not_required_internal':
      return '내부 전용이라 고객 동의가 필요하지 않습니다.'
  }
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
  const base = `/cases/${caseStudy.id}`

  const [editOpen, setEditOpen] = useState(false)
  const [showExpert, setShowExpert] = useState(false)
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

  /* --- 현재 상태 판단 (원어 enum이 아니라 실제 필드로) --- */
  const hasVerifiedOutcome = caseStudy.verifiedMetrics.length > 0
  const hasAnyOutcome = hasVerifiedOutcome || caseStudy.outcomeSummary.trim() !== ''
  const wantsPublic = caseStudy.visibility === 'public' || caseStudy.visibility === 'customer_approved'
  const needsAnon = caseStudy.visibility === 'anonymized' || caseStudy.visibility === 'public'
  const consentAgreed = caseStudy.consentStatus === 'agreed'
  const anonPassed = !needsAnon || anonymization.ok
  const canBePublic = consentAgreed && anonymization.ok
  const titleMissing = caseStudy.title.trim() === ''

  /* --- 지금 해야 할 일 (한 화면에 핵심 행동 하나) --- */
  const next: {
    title: string
    why: string
    label: string
    actionPath?: string
    onAction?: () => void
    tone?: 'brand' | 'success'
  } = (() => {
    if (caseStudy.status === 'approved') {
      return {
        title: '사례를 확정했습니다',
        why: '승인된 사례는 읽기 전용입니다. 사례 라이브러리에서 참고 자료로 활용하세요.',
        label: '사례 라이브러리로 가기',
        actionPath: '/cases',
        tone: 'success' as const,
      }
    }
    if (caseStudy.status === 'archived') {
      return {
        title: '보관된 사례입니다',
        why: '보관된 사례는 수정할 수 없습니다. 필요하면 라이브러리에서 다른 사례를 확인하세요.',
        label: '사례 라이브러리로 가기',
        actionPath: '/cases',
      }
    }
    if (titleMissing) {
      return {
        title: '사례 제목을 입력하세요',
        why: '사례를 확정하려면 제목이 필요합니다.',
        label: '내용 편집하기',
        onAction: openEdit,
      }
    }
    if (!hasAnyOutcome) {
      return {
        title: '아직 검증된 결과가 없습니다',
        why: '검증된 결과·성과가 없으면 성공사례로 공개할 수 없습니다. 결과를 정리하거나, 결과가 없다면 내부 학습 사례로 남기세요.',
        label: '결과 내용 편집하기',
        onAction: openEdit,
      }
    }
    if (needsAnon && !anonymization.ok) {
      return {
        title: '익명화 검토가 필요합니다',
        why: `공개·익명화 사례는 회사를 알아볼 수 있는 정보를 지워야 합니다. 확인할 항목 ${anonymization.issues.length}건이 있습니다.`,
        label: '익명화·동의 확인하기',
        actionPath: `${base}#case-consent`,
      }
    }
    if (wantsPublic && !consentAgreed) {
      return {
        title: '고객 동의를 먼저 받아야 합니다',
        why: '공개·고객 승인 사례는 고객 동의가 있어야 확정할 수 있습니다.',
        label: '고객 동의 확인하기',
        actionPath: `${base}#case-consent`,
      }
    }
    if (canApprove.ok) {
      return {
        title: '사례를 확정하세요',
        why:
          caseStudy.visibility === 'internal'
            ? '내부 학습 자료로 확정할 준비가 되었습니다.'
            : '공개 준비가 되었습니다. 확정하면 사례 라이브러리에서 활용할 수 있습니다.',
        label: '사례 확정하기',
        onAction: () => setConfirmApprove(true),
        tone: 'success' as const,
      }
    }
    return {
      title: '확정 전 확인할 항목이 있습니다',
      why: canApprove.reasons[0] ?? '확인이 필요한 항목을 정리하세요.',
      label: '확인할 항목 보기',
      actionPath: `${base}#case-finalize`,
    }
  })()

  /* --- 내부 단계 (실제 페이지 내 구간으로 이동) --- */
  const steps: WorkspaceStep[] = [
    { key: 'basic', label: '사례 기본정보', path: `${base}#case-basic` },
    { key: 'start', label: '시작 상황', path: `${base}#case-start` },
    { key: 'process', label: '진행 과정', path: `${base}#case-process` },
    { key: 'outcome', label: '실제 결과', path: `${base}#case-outcome` },
    { key: 'lessons', label: '배운 점', path: `${base}#case-lessons` },
    { key: 'consent', label: '익명화·동의', path: `${base}#case-consent` },
    { key: 'finalize', label: '사례 확정', path: `${base}#case-finalize` },
  ]
  const currentKey = readOnly
    ? 'finalize'
    : titleMissing || !hasAnyOutcome
      ? 'outcome'
      : !anonPassed || (wantsPublic && !consentAgreed)
        ? 'consent'
        : 'finalize'

  /* --- 완료 조건 체크리스트 --- */
  const checklist = [
    { ok: !titleMissing, label: '사례 제목 입력', actionPath: `${base}#case-basic`, actionLabel: '제목 입력하기' },
    { ok: hasAnyOutcome, label: '실제 결과·성과 정리', actionPath: `${base}#case-outcome`, actionLabel: '결과 정리하기' },
    { ok: anonPassed, label: '익명화 검토 통과', actionPath: `${base}#case-consent`, actionLabel: '익명화 확인하기' },
    { ok: !wantsPublic || consentAgreed, label: '공개 시 고객 동의 확보', actionPath: `${base}#case-consent`, actionLabel: '동의 확인하기' },
    { ok: caseStudy.status === 'approved', label: '사례 확정(승인)', actionPath: `${base}#case-finalize`, actionLabel: '확정하기' },
  ]

  /* --- 문제·주의 --- */
  const warns: WorkspaceWarning[] = []
  if (!readOnly) {
    if (caseStudy.consentStatus === 'declined' && wantsPublic) {
      warns.push({
        tone: 'error',
        message: '고객이 공개에 동의하지 않았습니다. 공개·고객 승인 사례로 확정할 수 없습니다.',
        actionPath: `${base}#case-consent`,
        actionLabel: '동의·공개 범위 확인',
      })
    } else if (wantsPublic && !consentAgreed) {
      warns.push({
        tone: 'error',
        message: '공개·고객 승인 사례는 고객 동의가 필요합니다.',
        actionPath: `${base}#case-consent`,
        actionLabel: '고객 동의 확인',
      })
    }
    if (needsAnon && !anonymization.ok) {
      anonymization.issues.slice(0, 3).forEach((issue) => {
        warns.push({ tone: 'warn', message: `익명화: ${issue}`, actionPath: `${base}#case-consent`, actionLabel: '익명화 확인' })
      })
    }
    if (!hasAnyOutcome) {
      warns.push({
        tone: 'warn',
        message: '검증된 결과가 없어 성공사례로 공개할 수 없습니다. 내부 학습 사례로 정리하세요.',
        actionPath: `${base}#case-outcome`,
        actionLabel: '결과 정리하기',
      })
    }
  }

  const summary = (
    <>
      <div>
        <WorkspaceSummaryLine
          label="공개 범위"
          value={CASE_VISIBILITY_META[caseStudy.visibility].label}
          tone={caseStudy.visibility === 'internal' ? 'warn' : 'default'}
        />
        <WorkspaceSummaryLine label="사례 상태" value={CASE_STATUS_META[caseStudy.status].label} tone={caseStudy.status === 'approved' ? 'ok' : 'default'} />
        <WorkspaceSummaryLine label="고객 동의" value={CONSENT_STATUS_META[caseStudy.consentStatus].label} tone={consentAgreed ? 'ok' : 'default'} />
        <WorkspaceSummaryLine label="익명화" value={anonymization.ok ? '통과' : '검토 필요'} tone={anonymization.ok ? 'ok' : 'warn'} />
        <WorkspaceSummaryLine label="검증된 성과" value={`${caseStudy.verifiedMetrics.length}건`} tone={hasVerifiedOutcome ? 'ok' : 'default'} />
        <WorkspaceSummaryLine label="지금 고객에게 공개 가능?" value={canBePublic ? '가능' : '아직 아님'} tone={canBePublic ? 'ok' : 'warn'} />
      </div>
      <WorkspaceCompletionChecklist items={checklist} />
      <WorkspaceWarningPanel warnings={warns} />
    </>
  )

  return (
    <WorkspaceShell
      moduleName={MODULE_NAME}
      moduleDescription={MODULE_DESC}
      saveStatus="local"
      steps={steps}
      currentKey={currentKey}
      nextAction={
        <WorkspaceNextAction
          title={next.title}
          why={next.why}
          actionLabel={next.label}
          actionPath={next.actionPath}
          onAction={next.onAction}
          tone={next.tone}
        />
      }
      summary={summary}
    >
      <div className="flex flex-col gap-5">
        <NavLink to="/cases" className="inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft aria-hidden="true" className="size-4" />
          사례 라이브러리로
        </NavLink>

        {/* 지금 이 사례의 상태 — 쉬운 문장 */}
        <Panel title="지금 이 사례는 어떤 상태인가요?">
          <ul className="flex flex-col gap-2.5">
            <StatusLine ok={hasVerifiedOutcome} label="검증된 성과" text={
              hasVerifiedOutcome
                ? `검증된 성과 ${caseStudy.verifiedMetrics.length}건이 기록되어 있습니다.`
                : hasAnyOutcome
                  ? '결과 요약은 있지만 검증된 성과 지표는 아직 없습니다.'
                  : '아직 검증된 결과·성과가 없습니다. 성공사례로 공개할 수 없습니다.'
            } />
            <StatusLine ok={anonymization.ok} label="익명화" text={
              anonymization.ok
                ? '재식별 가능한 정보가 발견되지 않았습니다.'
                : `익명화 검토가 필요합니다. 확인할 항목 ${anonymization.issues.length}건이 있습니다.`
            } />
            <StatusLine ok={consentAgreed} label="고객 동의" text={consentSentence(caseStudy.consentStatus)} />
            <StatusLine neutral label="공개 상태" text={visibilitySentence(caseStudy.visibility)} />
            <StatusLine ok={canBePublic} label="고객 공개 가능 여부" text={
              canBePublic
                ? '고객 동의와 익명화 검토가 끝나 고객에게 공개할 수 있는 상태입니다.'
                : '고객 동의와 익명화 검토가 모두 끝나야 고객에게 공개할 수 있습니다.'
            } />
          </ul>
        </Panel>

        {/* 사례 기본정보 */}
        <section id="case-basic" className="scroll-mt-24">
          <Panel
            title="사례 기본정보"
            actions={
              !readOnly && (
                <div className="flex items-center gap-2">
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
                </div>
              )
            }
          >
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[1.15rem] font-bold break-keep text-slate-900">{caseStudy.title || '제목 없음'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <CaseStatusBadge status={caseStudy.status} />
                  <CaseVisibilityBadge visibility={caseStudy.visibility} />
                  <ConsentBadge status={caseStudy.consentStatus} />
                  {caseStudy.manuallyEdited && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.82rem] text-slate-500">직접 수정됨</span>
                  )}
                </div>
              </div>
              <DetailText title="업종" value={caseStudy.industry} />
              <DetailText title="기업 개요" value={caseStudy.companyProfile} />
            </div>
          </Panel>
        </section>

        {/* 시작 상황 */}
        <section id="case-start" className="scroll-mt-24">
          <Panel title="시작 상황">
            <div className="flex flex-col gap-4">
              <DetailText title="초기 상황" value={caseStudy.initialSituation} />
              <DetailList title="핵심 문제" items={caseStudy.keyProblems} />
            </div>
          </Panel>
        </section>

        {/* 진행 과정 */}
        <section id="case-process" className="scroll-mt-24">
          <Panel title="진행 과정">
            <div className="flex flex-col gap-4">
              <DetailText title="전략 요약" value={caseStudy.strategySummary} />
              <DetailList title="연결 기관" items={caseStudy.selectedInstitutions} />
              <DetailList title="연결 프로그램" items={caseStudy.selectedPrograms} />
              <DetailList title="준비 활동" items={caseStudy.preparationActions} />
              <DetailText title="진행 요약" value={caseStudy.timelineSummary} />
            </div>
          </Panel>
        </section>

        {/* 실제 결과 */}
        <section id="case-outcome" className="scroll-mt-24">
          <Panel title="실제 결과">
            <div className="flex flex-col gap-4">
              {!hasAnyOutcome && (
                <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3.5 py-2.5">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
                  <p className="text-[0.92rem] break-keep text-warning-800">
                    아직 검증된 결과가 없습니다. 결과가 없거나 부결·보류된 경우라도 실패가 아니라 <b>내부 학습 사례</b>로 정리할 수 있습니다.
                  </p>
                </div>
              )}
              <div>
                <p className="text-[0.9rem] font-semibold text-slate-500">결과 요약 (실제 결과)</p>
                <p className="mt-1 rounded-(--radius-card) border border-slate-100 bg-slate-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-700">
                  {caseStudy.outcomeSummary || '결과 요약 없음'}
                </p>
              </div>
              <DetailList title="검증된 성과" items={caseStudy.verifiedMetrics} />
              <DetailList title="어려움" items={caseStudy.challenges} />
            </div>
          </Panel>
        </section>

        {/* 배운 점 */}
        <section id="case-lessons" className="scroll-mt-24">
          <Panel title="배운 점">
            <div className="flex flex-col gap-4">
              <DetailList title="배운 점" items={caseStudy.lessons} />
              <DetailList title="재사용 인사이트" items={caseStudy.reusableInsights} />
              {caseStudy.customerQuote.trim() !== '' && (
                <div>
                  <p className="text-[0.9rem] font-semibold text-slate-500">고객 인용</p>
                  <blockquote className="mt-1 border-l-2 border-brand-200 pl-3 text-[0.95rem] break-keep text-slate-600 italic">
                    “{caseStudy.customerQuote}”
                  </blockquote>
                </div>
              )}
            </div>
          </Panel>
        </section>

        {/* 익명화·동의 */}
        <section id="case-consent" className="flex scroll-mt-24 flex-col gap-5">
          <Panel title="익명화 점검">
            <div aria-live="polite">
              {anonymization.ok ? (
                <p className="text-[0.95rem] break-keep text-success-700">재식별 가능한 정보가 발견되지 않았습니다.</p>
              ) : (
                <div className="rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3 py-2.5">
                  <p className="flex items-center gap-2 text-[0.95rem] font-medium text-warning-800">
                    <AlertTriangle aria-hidden="true" className="size-4" />
                    익명화 검토가 필요합니다 ({anonymization.issues.length}건)
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {anonymization.issues.map((issue, idx) => (
                      <li key={idx} className="text-[0.9rem] break-keep text-warning-700">· {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2.5 text-[0.9rem] break-keep text-slate-500">
                익명화·공개 사례는 회사명·대표자·연락처·주소 등 회사를 알아볼 수 있는 정보를 남기면 안 됩니다.
              </p>
            </div>
          </Panel>

          <Panel title="공개 범위·고객 동의">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.9rem] font-medium text-slate-600">고객 동의 상태</span>
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
                <span className="text-[0.9rem] font-medium text-slate-600">공개 범위</span>
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
            <p className="mt-3 text-[0.9rem] break-keep text-slate-500">
              고객 승인·공개 범위는 고객 동의(‘동의’)가 있어야 설정할 수 있습니다. 동의가 없으면 저장되지 않습니다.
            </p>
            {!consentAgreed && wantsPublic && (
              <p className="mt-2 flex items-start gap-1.5 text-[0.9rem] break-keep text-danger-600">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                고객 동의가 없어 이 공개 범위로는 사례를 확정할 수 없습니다.
              </p>
            )}
          </Panel>
        </section>

        {/* 사례 확정 */}
        <section id="case-finalize" className="scroll-mt-24">
          <Panel title="사례 확정·보관">
            {!canApprove.ok && !readOnly && (
              <div className="mb-3 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-3 py-2.5">
                <p className="text-[0.95rem] font-medium text-warning-800">확정 전 해결할 항목 {canApprove.reasons.length}건</p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {canApprove.reasons.map((r, idx) => (
                    <li key={idx} className="text-[0.9rem] break-keep text-warning-700">· {r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!readOnly && (
                <>
                  <Button variant="secondary" onClick={doMarkReview}>검토 요청</Button>
                  <Button variant="primary" onClick={() => setConfirmApprove(true)} disabled={!canApprove.ok}>사례 확정(승인)</Button>
                </>
              )}
              {caseStudy.status !== 'archived' && (
                <Button variant="secondary" onClick={() => setConfirmArchive(true)}>보관</Button>
              )}
            </div>
            {!readOnly && !canApprove.ok && wantsPublic && !consentAgreed && (
              <p className="mt-2.5 text-[0.9rem] break-keep text-danger-600">
                고객 동의가 없어 공개·고객 승인 사례로는 확정할 수 없습니다. 위에서 고객 동의를 ‘동의’로 바꾸거나 공개 범위를 내부 전용으로 낮추세요.
              </p>
            )}
          </Panel>
        </section>

        {/* 전문가·시스템 정보 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowExpert((v) => !v)}
            aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700"
          >
            전문가·시스템 정보 (원어 상태값·근거·기록자)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-5">
              <DetailText title="익명화 메모" value={caseStudy.anonymizationNotes} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                <SysItem label="공개범위(원어)" value={caseStudy.visibility} />
                <SysItem label="상태(원어)" value={caseStudy.status} />
                <SysItem label="동의(원어)" value={caseStudy.consentStatus} />
                <SysItem label="연결 근거" value={`${caseStudy.evidenceIds.length}건`} />
                <SysItem label="작성자" value={caseStudy.createdBy || '-'} />
                <SysItem label="검토자" value={caseStudy.reviewedBy || '-'} />
                <SysItem label="승인자" value={caseStudy.approvedBy || '-'} />
                <SysItem label="직접 수정" value={caseStudy.manuallyEdited ? '예' : '아니오'} />
              </dl>
            </div>
          )}
        </div>

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
              <span className="text-[0.9rem] font-medium text-slate-600">제목</span>
              <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-medium text-slate-600">결과 요약</span>
              <textarea className={inputClass} rows={3} value={form.outcomeSummary} onChange={(e) => setForm((f) => ({ ...f, outcomeSummary: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-medium text-slate-600">배운 점 (줄바꿈으로 구분)</span>
              <textarea className={inputClass} rows={3} value={form.lessons} onChange={(e) => setForm((f) => ({ ...f, lessons: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-medium text-slate-600">재사용 인사이트 (줄바꿈으로 구분)</span>
              <textarea className={inputClass} rows={3} value={form.reusableInsights} onChange={(e) => setForm((f) => ({ ...f, reusableInsights: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-medium text-slate-600">고객 인용</span>
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
          title="사례 확정(승인)"
          message="이 사례를 확정하시겠습니까? 확정 후에는 읽기 전용이 됩니다."
          warning="확정 시 현재 공개 범위·동의 상태 기준으로 확정됩니다."
          confirmLabel="확정"
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
    </WorkspaceShell>
  )
}

function StatusLine({ ok, neutral, label, text }: { ok?: boolean; neutral?: boolean; label: string; text: string }) {
  const dot = neutral ? 'bg-slate-300' : ok ? 'bg-success-500' : 'bg-warning-500'
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[0.98rem] break-keep text-slate-700">
        <span className="font-semibold text-slate-800">{label}: </span>
        {text}
      </span>
    </li>
  )
}

function DetailText({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-[0.9rem] font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-[0.95rem] break-keep text-slate-700">{value.trim() === '' ? '미입력' : value}</p>
    </div>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[0.9rem] font-semibold text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-[0.95rem] text-slate-400">미입력</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-[0.95rem] break-keep text-slate-700">· {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SysItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.82rem] text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[0.9rem] break-keep text-slate-600">{value}</dd>
    </div>
  )
}
