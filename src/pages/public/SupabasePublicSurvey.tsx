/**
 * 공개 설문 (supabase 모드). 공개 RPC 로 로드·저장한다.
 * - 원문 토큰을 RPC 에 전달 → 서버에서 해시 조회, 렌더 필드만 반환.
 * - 내부 정보(workspace/organization/project id, 담당자, 분석 규칙, 다른 응답)를 노출하지 않는다.
 * - autosave(비최종 제출) / resume / submit(최종) / completed / expired / revoked / invalid 상태.
 * 렌더링·검증은 로컬 모드와 동일한 순수 헬퍼·프레젠테이션 컴포넌트를 재사용한다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { RespondentRole } from '../../types'
import type { SnapshotSection } from '../../types/survey'
import type { RespondentProfile, SurveyAnswerValue } from '../../types/surveyRuntime'
import { getSupabaseClient } from '../../lib/supabase/client'
import { PublicTokenClient, type PublicSurveyView as RpcSurveyView } from '../../repositories/async/publicTokenClient'
import {
  calculateSurveyProgress,
  evaluateVisibleSnapshotQuestions,
  groupSnapshotQuestionsForPublicPages,
  sanitizeAnswersForSubmission,
  validateCurrentSurveyPage,
  validateFinalSubmission,
  type PublicSurveyView,
} from '../../services/surveyRuntimeService'
import {
  clearSurveyDraft,
  readSurveyDraft,
  writeSurveyDraft,
} from '../../storage/surveyDraftCache'
import { createSerialSaveQueue } from '../../lib/serialSaveQueue'
import { PublicSurveyLayout, PublicSurveyNotice } from '../../components/public/PublicSurveyLayout'
import { SurveyStartScreen } from '../../components/public/SurveyStartScreen'
import { SurveyPage } from '../../components/public/SurveyPage'
import { SurveyReviewPage } from '../../components/public/SurveyReviewPage'
import { SurveyCompletionPage } from '../../components/public/SurveyCompletionPage'
import {
  SurveyAutosaveIndicator,
  SurveyPageNavigation,
  SurveyProgressHeader,
  type AutosaveState,
} from '../../components/public/SurveyControls'

type Phase = 'loading' | 'start' | 'filling' | 'review' | 'completed' | 'unavailable'

function toView(rpc: RpcSurveyView): PublicSurveyView {
  // 내부 정보는 RPC 가 반환하지 않는다 → 공개용으로 빈 값/기본값 사용.
  return {
    distributionId: rpc.distributionId,
    organizationName: '',
    projectPurpose: '',
    surveyTitle: (rpc.surveyTitle as string) ?? '설문',
    respondentRole: (rpc.respondentRole as RespondentRole) ?? 'other',
    recipientName: (rpc.recipientName as string) ?? '',
    recipientPosition: (rpc.recipientPosition as string) ?? '',
    recipientDepartment: '',
    recipientEmail: '',
    recipientPhone: '',
    sections: (rpc.blueprintSnapshot as SnapshotSection[]) ?? [],
    introMessage: (rpc.introMessage as string) ?? '',
    privacyNotice: (rpc.privacyNotice as string) ?? '',
    consentRequired: Boolean(rpc.consentRequired),
    expiresAt: (rpc.expiresAt as string | null) ?? null,
    totalSections: ((rpc.blueprintSnapshot as SnapshotSection[]) ?? []).length,
  }
}

export function SupabasePublicSurvey() {
  const { accessToken = '' } = useParams()
  const client = useMemo(() => new PublicTokenClient(getSupabaseClient()), [])

  const [phase, setPhase] = useState<Phase>('loading')
  const [view, setView] = useState<PublicSurveyView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({})
  const [profile, setProfile] = useState<RespondentProfile>({ name: '', position: '', department: '', email: '', phone: '' })
  const [consented, setConsented] = useState(false)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [startError, setStartError] = useState<string | null>(null)
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const [autosave, setAutosave] = useState<AutosaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hasLocalDraft, setHasLocalDraft] = useState(false)

  // 최초 로드
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rpc = await client.getSurvey(accessToken)
        if (!alive) return
        if (!rpc) {
          setPhase('unavailable')
          return
        }
        if (!rpc.available) {
          setPhase('unavailable')
          return
        }
        setView(toView(rpc))
        setProfile((p) => ({ ...p, name: (rpc.recipientName as string) ?? '', position: (rpc.recipientPosition as string) ?? '' }))
        // 이 브라우저의 안전 draft 가 있으면 복구한다 (서버는 이전 답변을 반환하지 않음)
        const draft = readSurveyDraft(`sb-${accessToken}`)
        if (draft) {
          setAnswers(draft.answers)
          setConsented(draft.consented)
          setCurrentPageIndex(draft.currentPageIndex)
          setProfile((p) => ({ ...p, ...draft.profile, name: draft.profile.name || p.name, position: draft.profile.position || p.position }))
          setHasLocalDraft(true)
        }
        setPhase('start')
      } catch {
        if (alive) setLoadError('설문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
    })()
    return () => {
      alive = false
    }
  }, [client, accessToken])

  const sections = view?.sections ?? []
  const answerMap = useMemo(() => new Map(Object.entries(answers)), [answers])
  const codeById = useMemo(() => {
    const map = new Map<string, string>()
    sections.forEach((s) => s.placements.forEach((p) => map.set(p.questionId, p.questionCode)))
    return map
  }, [sections])
  const pages = useMemo(() => groupSnapshotQuestionsForPublicPages(sections, answerMap), [sections, answerMap])
  const progress = useMemo(() => calculateSurveyProgress(sections, answerMap), [sections, answerMap])
  const visibleIds = useMemo(
    () => new Set(evaluateVisibleSnapshotQuestions(sections, answerMap).map((p) => p.questionId)),
    [sections, answerMap],
  )
  const safePageIndex = Math.min(currentPageIndex, Math.max(0, pages.length - 1))

  /* ---------- 저장 (직렬화·순서 역전 방지·제출 후 차단) ---------- */
  // 항상 실행 시점의 최신 입력을 전송한다 — 오래된 응답이 최신 답변을 덮어쓰지 않는다.
  const stateRef = useRef({ answers, profile, consented, pageIndex: safePageIndex })
  stateRef.current = { answers, profile, consented, pageIndex: safePageIndex }
  // 저장 직렬화 큐 — 순서 역전 방지·중복 건너뛰기·제출 후 차단 (단위 테스트: persistence.test)
  const queueRef = useRef(createSerialSaveQueue())
  const draftId = `sb-${accessToken}`

  function buildAnswerRecords(source: Record<string, SurveyAnswerValue>) {
    const now = new Date().toISOString()
    return Object.entries(source)
      .filter(([, v]) => v !== undefined)
      .map(([questionId, value]) => ({ questionId, questionCode: codeById.get(questionId) ?? '', value, answeredAt: now, updatedAt: now }))
  }

  function saveNow(isFinal: boolean): Promise<void> {
    const queue = queueRef.current
    const seq = queue.nextSeq()
    const run = async () => {
      if (!view) return
      // 더 최신 저장 요청이 이미 대기 중이면 이 비최종 요청은 건너뛴다(마지막 요청이 최신 상태를 전송)
      if (!isFinal && seq !== queue.currentSeq()) return
      const latest = stateRef.current
      setAutosave('saving')
      try {
        const raw = buildAnswerRecords(latest.answers)
        const records = isFinal ? sanitizeAnswersForSubmission(sections, raw) : raw
        const prog = calculateSurveyProgress(sections, new Map(Object.entries(latest.answers)))
        await client.submitSurveyResponse(
          accessToken,
          {
            respondentProfile: latest.profile,
            consented: latest.consented,
            answers: records,
            currentPageIndex: latest.pageIndex,
            progressPercent: prog.progressPercent,
            answeredVisibleCount: prog.answeredVisibleQuestions,
            requiredVisibleCount: prog.totalRequiredQuestions,
            requiredAnsweredCount: prog.answeredRequiredQuestions,
          },
          isFinal,
        )
        if (isFinal) queue.close()
        // 서버 저장 성공 → 로컬 안전 draft 정리, 상태는 최신 요청만 반영
        clearSurveyDraft(draftId)
        if (isFinal || seq === queue.currentSeq()) {
          setAutosave('saved')
          setLastSavedAt(new Date().toISOString())
        }
      } catch {
        // 실패를 성공처럼 표시하지 않는다. 로컬 안전 draft 는 change-effect 가 이미 보존.
        setAutosave('offline_draft')
        throw new Error('save-failed')
      }
    }
    return queue.enqueue(run)
  }

  // 로컬 안전 draft — 서버 autosave 와 별개로, 입력 즉시 이 브라우저에 동기 보존한다.
  // (브라우저 종료 시 네트워크 완료는 보장할 수 없으므로 2단계 구조: 로컬 draft + 서버 autosave)
  useEffect(() => {
    if (phase === 'loading' || phase === 'unavailable' || phase === 'completed') return
    if (queueRef.current.isClosed()) return
    writeSurveyDraft({
      responseId: draftId,
      answers,
      profile,
      consented,
      currentPageIndex: safePageIndex,
      updatedAt: new Date().toISOString(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, profile, consented, safePageIndex, phase])

  // 디바운스 자동 저장 (서버)
  useEffect(() => {
    if (phase !== 'filling' || !view) return
    const t = window.setTimeout(() => { void saveNow(false).catch(() => {}) }, 800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, profile, consented, phase, safePageIndex])

  // 탭 숨김·페이지 종료 시 서버 저장 시도(완료는 보장되지 않음 — 로컬 draft 가 안전망)
  useEffect(() => {
    if (phase !== 'filling') return
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveNow(false).catch(() => {})
    }
    const onPageHide = () => { void saveNow(false).catch(() => {}) }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (phase === 'loading') {
    return <PublicSurveyNotice title="설문을 불러오는 중입니다…" description="잠시만 기다려 주세요." />
  }
  if (loadError) {
    return <PublicSurveyNotice title="설문을 불러올 수 없습니다." description={loadError} />
  }
  if (phase === 'unavailable') {
    return (
      <PublicSurveyNotice
        title="사용할 수 없는 설문 링크입니다."
        description="링크가 만료·중지되었거나 올바르지 않습니다. 담당 컨설턴트에게 문의해 주세요."
      />
    )
  }
  if (!view) {
    return <PublicSurveyNotice title="설문을 불러올 수 없습니다." description="잠시 후 다시 시도해 주세요." />
  }

  if (phase === 'completed') {
    return (
      <PublicSurveyLayout organizationName="" surveyTitle={view.surveyTitle}>
        <SurveyCompletionPage
          organizationName=""
          surveyTitle={view.surveyTitle}
          recipientName={profile.name}
          submittedAt={new Date().toISOString()}
          answeredCount={progress.answeredVisibleQuestions}
          requiredComplete={progress.answeredRequiredQuestions >= progress.totalRequiredQuestions}
        />
      </PublicSurveyLayout>
    )
  }

  const setAnswer = (questionId: string, value: SurveyAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    if (errorIds.has(questionId)) {
      setErrorIds((prev) => {
        const next = new Set(prev)
        next.delete(questionId)
        return next
      })
    }
  }

  const handleStart = () => {
    if (!profile.name.trim()) {
      setStartError('missing')
      return
    }
    if (view.consentRequired && !consented) {
      setStartError('consent')
      return
    }
    setStartError(null)
    setPhase('filling')
    void saveNow(false).catch(() => {})
  }

  const handleNext = () => {
    const page = pages[safePageIndex]
    if (!page) return
    const issues = validateCurrentSurveyPage(page.placements, page.sectionId, answerMap)
    if (issues.length > 0) {
      setErrorIds(new Set(issues.map((i) => i.questionId)))
      return
    }
    setErrorIds(new Set())
    void saveNow(false).catch(() => {})
    if (safePageIndex >= pages.length - 1) {
      setPhase('review')
      window.scrollTo(0, 0)
    } else {
      setCurrentPageIndex(safePageIndex + 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePrev = () => {
    setErrorIds(new Set())
    void saveNow(false).catch(() => {})
    if (safePageIndex > 0) {
      setCurrentPageIndex(safePageIndex - 1)
      window.scrollTo(0, 0)
    } else {
      setPhase('start')
      window.scrollTo(0, 0)
    }
  }

  const handleEditSection = (sectionId: string) => {
    const idx = pages.findIndex((pg) => pg.sectionId === sectionId)
    if (idx >= 0) {
      setCurrentPageIndex(idx)
      setPhase('filling')
      window.scrollTo(0, 0)
    }
  }

  const handleSubmit = async () => {
    if (submitting) return
    const issues = validateFinalSubmission(sections, answerMap, consented, view.consentRequired)
    if (issues.length > 0) {
      const consentIssue = issues.find((i) => i.type === 'missing_consent')
      if (consentIssue) {
        setPhase('start')
        setStartError('consent')
        return
      }
      setErrorIds(new Set(issues.map((i) => i.questionId)))
      const firstQ = issues[0].questionId
      const idx = pages.findIndex((pg) => pg.placements.some((p) => p.questionId === firstQ))
      if (idx >= 0) {
        setPhase('filling')
        setCurrentPageIndex(idx)
      }
      return
    }
    setSubmitting(true)
    try {
      await saveNow(true)
      setPhase('completed')
      window.scrollTo(0, 0)
    } catch {
      setSubmitting(false)
    }
  }

  if (phase === 'start') {
    return (
      <PublicSurveyLayout organizationName="" surveyTitle={view.surveyTitle}>
        <SurveyStartScreen
          view={view}
          estimatedMinutes={Math.max(1, Math.round(progress.estimatedRemainingMinutes) || 5)}
          hasDraft={hasLocalDraft}
          draftProgress={0}
          draftLastSaved={null}
          profile={profile}
          onProfileChange={(patch) => setProfile((p) => ({ ...p, ...patch }))}
          consented={consented}
          onConsentChange={setConsented}
          error={startError}
          onStart={handleStart}
        />
      </PublicSurveyLayout>
    )
  }

  if (phase === 'review') {
    const excludedCount = sections.reduce((n, s) => n + s.placements.filter((p) => !visibleIds.has(p.questionId)).length, 0)
    return (
      <PublicSurveyLayout organizationName="" surveyTitle={view.surveyTitle}>
        <SurveyReviewPage
          sections={sections}
          visibleIds={visibleIds}
          excludedCount={excludedCount}
          answers={answerMap}
          consentRequired={view.consentRequired}
          consented={consented}
          requiredComplete={progress.answeredRequiredQuestions >= progress.totalRequiredQuestions}
          submitting={submitting}
          onEditSection={handleEditSection}
          onSubmit={() => void handleSubmit()}
        />
      </PublicSurveyLayout>
    )
  }

  const page = pages[safePageIndex]
  const startNumber = pages.slice(0, safePageIndex).reduce((n, pg) => n + pg.placements.length, 0) + 1
  return (
    <PublicSurveyLayout
      organizationName=""
      surveyTitle={view.surveyTitle}
      footerBar={
        <SurveyPageNavigation
          canPrev
          isLast={safePageIndex >= pages.length - 1}
          submitting={submitting}
          autosave={<SurveyAutosaveIndicator state={autosave} lastSavedAt={lastSavedAt} savedLabel="클라우드 저장됨" onRetry={() => void saveNow(false).catch(() => {})} />}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      }
    >
      {page ? (
        <>
          <SurveyProgressHeader
            surveyTitle={view.surveyTitle}
            sectionTitle={page.sectionTitle}
            pageInfo={`섹션 ${page.pageInSection}/${page.totalPagesInSection} · 페이지 ${safePageIndex + 1}/${pages.length}`}
            progressPercent={progress.progressPercent}
            answered={progress.answeredVisibleQuestions}
            total={progress.totalVisibleQuestions}
          />
          {errorIds.size > 0 && (
            <p role="alert" className="mb-4 rounded-(--radius-card) border border-danger-200 bg-danger-50 px-4 py-2.5 text-[13px] font-medium text-danger-700">
              남은 필수 문항이 {errorIds.size}개 있습니다. 표시된 문항에 응답해 주세요.
            </p>
          )}
          <SurveyPage page={page} startNumber={startNumber} answers={answerMap} onAnswer={setAnswer} errorQuestionIds={errorIds} />
        </>
      ) : (
        <p className="text-sm text-slate-500">표시할 질문이 없습니다.</p>
      )}
    </PublicSurveyLayout>
  )
}
