import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getDataModeConfig } from '../../data/dataMode'
import { useCallbackRef } from '../../lib/useCallbackRef'
import type { RespondentProfile, SurveyAnswerValue } from '../../types/surveyRuntime'
import type { SurveyResponse } from '../../types/surveyRuntime'
import {
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import {
  calculateSurveyProgress,
  createOrResumeSurveyResponse,
  evaluateVisibleSnapshotQuestions,
  groupSnapshotQuestionsForPublicPages,
  resolvePublicSurveyByToken,
  sanitizeAnswersForSubmission,
  submitSurveyResponse,
  validateCurrentSurveyPage,
  validateFinalSubmission,
  type PublicSurveyResolution,
} from '../../services/surveyRuntimeService'
import {
  PublicSurveyLayout,
  PublicSurveyNotice,
} from '../../components/public/PublicSurveyLayout'
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

type Phase = 'start' | 'filling' | 'review' | 'completed'

// supabase 모드 공개 설문은 공개 RPC 를 쓰며 lazy 로드한다(local 청크에 SDK 미포함).
const SupabasePublicSurvey = lazy(() =>
  import('./SupabasePublicSurvey').then((m) => ({ default: m.SupabasePublicSurvey })),
)

export function PublicSurveyPage() {
  if (getDataModeConfig().mode === 'supabase') {
    return (
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">불러오는 중…</div>}>
        <SupabasePublicSurvey />
      </Suspense>
    )
  }
  return <LocalPublicSurvey />
}

function LocalPublicSurvey() {
  const { accessToken = '' } = useParams()

  // 토큰 1회 해석 + markOpened
  const [resolution] = useState<PublicSurveyResolution>(() => {
    const r = resolvePublicSurveyByToken(accessToken)
    return r
  })
  const [response, setResponse] = useState<SurveyResponse | null>(() => {
    if (resolution.kind !== 'ok') return null
    surveyDistributionRepository.markOpened(resolution.distribution.id)
    return createOrResumeSurveyResponse(resolution.distribution)
  })

  const distribution = resolution.kind === 'ok' ? resolution.distribution : null
  const view = resolution.kind === 'ok' ? resolution.view : null

  const [phase, setPhase] = useState<Phase>(() => {
    if (resolution.kind !== 'ok' || !response) return 'start'
    return response.status === 'in_progress' && response.consented ? 'start' : 'start'
  })
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>(() => {
    if (!response) return {}
    return Object.fromEntries(response.answers.map((a) => [a.questionId, a.value]))
  })
  const [profile, setProfile] = useState<RespondentProfile>(
    () =>
      response?.respondentProfile ?? {
        name: distribution?.recipientName ?? '',
        position: distribution?.recipientPosition ?? '',
        department: '',
        email: distribution?.recipientEmail ?? '',
        phone: distribution?.recipientPhone ?? '',
      },
  )
  const [consented, setConsented] = useState(response?.consented ?? false)
  const [currentPageIndex, setCurrentPageIndex] = useState(
    response?.currentPageIndex ?? 0,
  )
  const [startError, setStartError] = useState<string | null>(null)
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())
  const [autosave, setAutosave] = useState<AutosaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    response?.lastSavedAt ?? null,
  )
  const [submitting, setSubmitting] = useState(false)

  const sections = useMemo(
    () => distribution?.blueprintSnapshot ?? [],
    [distribution],
  )
  const answerMap = useMemo(() => new Map(Object.entries(answers)), [answers])

  const codeById = useMemo(() => {
    const map = new Map<string, string>()
    sections.forEach((s) => s.placements.forEach((p) => map.set(p.questionId, p.questionCode)))
    return map
  }, [sections])

  const pages = useMemo(
    () => groupSnapshotQuestionsForPublicPages(sections, answerMap),
    [sections, answerMap],
  )
  const progress = useMemo(
    () => calculateSurveyProgress(sections, answerMap),
    [sections, answerMap],
  )
  const visibleIds = useMemo(
    () =>
      new Set(
        evaluateVisibleSnapshotQuestions(sections, answerMap).map((p) => p.questionId),
      ),
    [sections, answerMap],
  )

  // 현재 페이지가 사라지면 가장 가까운 유효 페이지로
  const safePageIndex = Math.min(currentPageIndex, Math.max(0, pages.length - 1))

  /* ---------- 저장 ---------- */
  const buildAnswerRecords = () => {
    const nowIso = new Date().toISOString()
    return Object.entries(answers)
      .filter(([, v]) => v !== undefined)
      .map(([questionId, value]) => ({
        questionId,
        questionCode: codeById.get(questionId) ?? '',
        value,
        answeredAt: nowIso,
        updatedAt: nowIso,
      }))
  }

  const saveNow = useCallbackRef((markInProgress: boolean) => {
    if (!response || !distribution) return
    // 만료·회수 링크에서는 저장하지 않음
    const fresh = surveyDistributionRepository.getById(distribution.id)
    if (!fresh || fresh.status === 'revoked' || fresh.status === 'expired') {
      setAutosave('error')
      return
    }
    if (response.status === 'submitted') return
    setAutosave('saving')
    try {
      const records = buildAnswerRecords()
      const prog = calculateSurveyProgress(sections, new Map(Object.entries(answers)))
      const timestamp = new Date().toISOString()
      const status = markInProgress || records.length > 0 ? 'in_progress' : response.status
      const updated = surveyResponseRepository.update(response.id, {
        respondentProfile: profile,
        consented,
        consentedAt: consented ? (response.consentedAt ?? timestamp) : null,
        answers: records,
        currentSectionId: pages[safePageIndex]?.sectionId ?? null,
        currentPageIndex: safePageIndex,
        progressPercent: prog.progressPercent,
        answeredVisibleCount: prog.answeredVisibleQuestions,
        requiredVisibleCount: prog.totalRequiredQuestions,
        requiredAnsweredCount: prog.answeredRequiredQuestions,
        status,
        startedAt: response.startedAt ?? (markInProgress ? timestamp : response.startedAt),
      })
      if (markInProgress && fresh.status !== 'in_progress') {
        surveyDistributionRepository.update(distribution.id, { status: 'in_progress' })
      }
      setResponse(updated)
      setLastSavedAt(updated.lastSavedAt)
      setAutosave('saved')
    } catch {
      // 입력값을 버리지 않고 오류 상태만 표시
      setAutosave('error')
    }
  })

  // 디바운스 자동 저장
  useEffect(() => {
    if (phase !== 'filling') return
    const t = window.setTimeout(() => saveNow(true), 800)
    return () => window.clearTimeout(t)
  }, [answers, profile, consented, phase, safePageIndex, saveNow])

  // 탭 숨김·종료 시 즉시 저장
  useEffect(() => {
    if (phase !== 'filling') return
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveNow(true)
    }
    const onBeforeUnload = () => saveNow(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [phase, saveNow])

  /* ---------- 오류 화면 ---------- */
  if (resolution.kind === 'not_found') {
    return (
      <PublicSurveyNotice
        title="유효하지 않은 설문 링크입니다."
        description="링크가 정확한지 확인해 주세요. 문제가 계속되면 담당 컨설턴트에게 문의해 주세요."
      />
    )
  }
  if (resolution.kind === 'expired') {
    return (
      <PublicSurveyNotice
        title="응답 기간이 종료되었습니다."
        description="설문 응답 기간이 지났습니다. 담당 컨설턴트에게 문의해 주세요."
      />
    )
  }
  if (resolution.kind === 'revoked') {
    return (
      <PublicSurveyNotice
        title="사용이 중지된 설문 링크입니다."
        description="이 설문 링크는 더 이상 사용할 수 없습니다. 담당 컨설턴트에게 문의해 주세요."
      />
    )
  }
  if (resolution.kind === 'submitted' || phase === 'completed') {
    const submittedInfo =
      resolution.kind === 'submitted'
        ? resolution
        : {
            organizationName: view?.organizationName ?? '',
            surveyTitle: view?.surveyTitle ?? '',
            recipientName: profile.name,
            submittedAt: response?.submittedAt ?? null,
            answeredCount: response?.answeredVisibleCount ?? 0,
            requiredAnswered:
              (response?.requiredAnsweredCount ?? 0) >=
              (response?.requiredVisibleCount ?? 0),
          }
    return (
      <PublicSurveyLayout
        organizationName={submittedInfo.organizationName}
        surveyTitle={submittedInfo.surveyTitle}
      >
        <SurveyCompletionPage
          organizationName={submittedInfo.organizationName}
          surveyTitle={submittedInfo.surveyTitle}
          recipientName={submittedInfo.recipientName}
          submittedAt={submittedInfo.submittedAt}
          answeredCount={submittedInfo.answeredCount}
          requiredComplete={submittedInfo.requiredAnswered}
        />
      </PublicSurveyLayout>
    )
  }

  if (!view || !distribution || !response) {
    return (
      <PublicSurveyNotice
        title="설문을 불러올 수 없습니다."
        description="잠시 후 다시 시도해 주세요. 문제가 계속되면 담당 컨설턴트에게 문의해 주세요."
      />
    )
  }

  /* ---------- 시작 ---------- */
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
    setCurrentPageIndex(response.currentPageIndex ?? 0)
    saveNow(true)
  }

  /* ---------- 페이지 이동 ---------- */
  const scrollToQuestion = (questionId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`q-${questionId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const focusable = el?.querySelector<HTMLElement>('input, textarea, button, select')
      focusable?.focus()
    }, 50)
  }

  const handleNext = () => {
    const page = pages[safePageIndex]
    if (!page) return
    const issues = validateCurrentSurveyPage(page.placements, page.sectionId, answerMap)
    if (issues.length > 0) {
      setErrorIds(new Set(issues.map((i) => i.questionId)))
      scrollToQuestion(issues[0].questionId)
      return
    }
    setErrorIds(new Set())
    saveNow(true)
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
    saveNow(true)
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

  const handleSubmit = () => {
    if (submitting) return
    const issues = validateFinalSubmission(
      sections,
      answerMap,
      consented,
      view.consentRequired,
    )
    if (issues.length > 0) {
      const consentIssue = issues.find((i) => i.type === 'missing_consent')
      if (consentIssue) {
        setPhase('start')
        setStartError('consent')
        window.scrollTo(0, 0)
        return
      }
      setErrorIds(new Set(issues.map((i) => i.questionId)))
      const firstQ = issues[0].questionId
      const idx = pages.findIndex((pg) => pg.placements.some((p) => p.questionId === firstQ))
      if (idx >= 0) {
        setPhase('filling')
        setCurrentPageIndex(idx)
        scrollToQuestion(firstQ)
      }
      return
    }
    setSubmitting(true)
    try {
      // 제출 전 숨겨진 질문 답변 제거 후 저장
      const sanitized = sanitizeAnswersForSubmission(sections, buildAnswerRecords())
      const withSanitized: SurveyResponse = { ...response, answers: sanitized }
      const submitted = submitSurveyResponse(withSanitized, distribution)
      setResponse(submitted)
      setPhase('completed')
      window.scrollTo(0, 0)
    } catch {
      setSubmitting(false)
    }
  }

  /* ---------- 렌더 ---------- */
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

  if (phase === 'start') {
    return (
      <PublicSurveyLayout organizationName={view.organizationName} surveyTitle={view.surveyTitle}>
        <SurveyStartScreen
          view={view}
          estimatedMinutes={Math.max(1, Math.round(progress.estimatedRemainingMinutes) || 5)}
          hasDraft={response.status === 'in_progress'}
          draftProgress={response.progressPercent}
          draftLastSaved={response.lastSavedAt}
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
    const excludedCount = sections.reduce(
      (n, s) => n + s.placements.filter((p) => !visibleIds.has(p.questionId)).length,
      0,
    )
    return (
      <PublicSurveyLayout organizationName={view.organizationName} surveyTitle={view.surveyTitle}>
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
          onSubmit={handleSubmit}
        />
      </PublicSurveyLayout>
    )
  }

  // filling
  const page = pages[safePageIndex]
  const startNumber =
    pages.slice(0, safePageIndex).reduce((n, pg) => n + pg.placements.length, 0) + 1

  return (
    <PublicSurveyLayout
      organizationName={view.organizationName}
      surveyTitle={view.surveyTitle}
      footerBar={
        <SurveyPageNavigation
          canPrev={safePageIndex > 0 || true}
          isLast={safePageIndex >= pages.length - 1}
          submitting={submitting}
          autosave={<SurveyAutosaveIndicator state={autosave} lastSavedAt={lastSavedAt} onRetry={() => saveNow(true)} />}
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
          <div className="mb-3 sm:hidden">
            <SurveyAutosaveIndicator state={autosave} lastSavedAt={lastSavedAt} onRetry={() => saveNow(true)} />
          </div>
          {errorIds.size > 0 && (
            <p
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-(--radius-card) border border-danger-200 bg-danger-50 px-4 py-2.5 text-[13px] font-medium text-danger-700"
            >
              남은 필수 문항이 {errorIds.size}개 있습니다. 표시된 문항에 응답해 주세요.
            </p>
          )}
          <SurveyPage
            page={page}
            startNumber={startNumber}
            answers={answerMap}
            onAnswer={setAnswer}
            errorQuestionIds={errorIds}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">표시할 질문이 없습니다.</p>
      )}
    </PublicSurveyLayout>
  )
}
