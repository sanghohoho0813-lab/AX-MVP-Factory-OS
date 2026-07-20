import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, MonitorSmartphone, ShieldAlert } from 'lucide-react'
import type { TestSessionScenarioResult } from '../../types/validation'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { Button } from '../../components/ui/Button'
import { resolveTestSession, submitTestSession } from '../../services/validationService'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-base text-slate-700 focus:border-brand-400 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-semibold text-slate-600'

type Difficulty = 'easy' | 'normal' | 'hard'
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
}

function defaultResult(scenarioId: string): TestSessionScenarioResult {
  return {
    scenarioId,
    done: false,
    difficulty: null,
    comment: '',
    errorReport: '',
    positive: '',
  }
}

/** 전체 화면 안내(오류·완료 상태) */
function FullPageNotice({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof CheckCircle2
  tone: 'success' | 'danger' | 'neutral'
  title: string
  description: string
}) {
  const toneCls =
    tone === 'success'
      ? 'border-success-200 bg-success-50 text-success-600'
      : tone === 'danger'
        ? 'border-danger-200 bg-danger-50 text-danger-600'
        : 'border-slate-200 bg-slate-50 text-slate-400'
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[640px] rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
        <span aria-hidden="true" className={`mx-auto flex size-14 items-center justify-center rounded-full border ${toneCls}`}>
          <Icon className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold break-keep text-slate-900">{title}</h1>
        <p className="mt-2 text-base break-keep text-slate-600">{description}</p>
      </div>
    </main>
  )
}

export function LocalTestPage() {
  const { accessToken = '' } = useParams()
  const version = useStoreVersion()
  const resolved = useMemo(
    () => resolveTestSession(accessToken),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, version],
  )

  const [consented, setConsented] = useState(false)
  const [results, setResults] = useState<Record<string, TestSessionScenarioResult>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!resolved) {
    return (
      <FullPageNotice
        icon={ShieldAlert}
        tone="danger"
        title="유효하지 않은 링크"
        description="테스트 링크가 정확한지 확인해 주세요. 이 링크는 링크를 만든 동일 브라우저에서만 열 수 있습니다."
      />
    )
  }

  if (submitted) {
    return (
      <FullPageNotice
        icon={CheckCircle2}
        tone="success"
        title="제출이 완료되었습니다"
        description="테스트에 참여해 주셔서 감사합니다. 이 창은 닫으셔도 됩니다."
      />
    )
  }

  if (resolved.session.status === 'completed') {
    return (
      <FullPageNotice
        icon={CheckCircle2}
        tone="neutral"
        title="이미 제출된 테스트입니다"
        description="이 테스트는 이미 제출이 완료되었습니다. 다시 제출할 수 없습니다."
      />
    )
  }

  if (resolved.session.status !== 'active') {
    return (
      <FullPageNotice
        icon={ShieldAlert}
        tone="neutral"
        title="사용할 수 없는 테스트 링크"
        description="이 테스트 링크는 회수되었거나 만료되어 더 이상 사용할 수 없습니다."
      />
    )
  }

  const { session, workspaceTitle, organizationName, scenarios } = resolved
  const getResult = (scenarioId: string) => results[scenarioId] ?? defaultResult(scenarioId)
  const patchResult = (scenarioId: string, patch: Partial<TestSessionScenarioResult>) => {
    setResults((prev) => ({
      ...prev,
      [scenarioId]: { ...getResult(scenarioId), ...patch },
    }))
  }

  const submit = () => {
    if (!consented) {
      setError('참여 동의에 체크해야 제출할 수 있습니다.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const payload: TestSessionScenarioResult[] = scenarios.map((s) => getResult(s.id))
      submitTestSession(accessToken, consented, payload)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-[640px]">
        <header className="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-600">
            <MonitorSmartphone aria-hidden="true" className="size-5" />
            <span className="text-sm font-semibold">실제 사용 테스트</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold break-keep text-slate-900">{workspaceTitle}</h1>
          {organizationName && <p className="mt-1 text-base text-slate-500">{organizationName}</p>}
          {session.participantName && <p className="mt-1 text-sm text-slate-400">참여자: {session.participantName}</p>}
          <p
            role="note"
            className="mt-4 rounded-(--radius-card) border border-warning-200 bg-warning-50 px-4 py-3 text-sm font-medium break-keep text-warning-700"
          >
            로컬 테스트 모드 · 동일 브라우저에서만 사용할 수 있습니다.
          </p>
        </header>

        <section aria-labelledby="consent-heading" className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h2 id="consent-heading" className="text-base font-semibold text-slate-800">개인정보·참여 동의</h2>
          <label className="mt-3 flex items-start gap-3 text-base break-keep text-slate-700">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-1 size-5 shrink-0 rounded border-slate-300"
            />
            <span>테스트 목적의 참여와 응답 기록에 동의합니다. (동의해야 제출할 수 있습니다)</span>
          </label>
        </section>

        <ol className="mt-4 flex flex-col gap-4">
          {scenarios.map((s, index) => {
            const r = getResult(s.id)
            return (
              <li key={s.id} className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <p className="text-sm font-semibold text-brand-600">시나리오 {index + 1}</p>
                <h3 className="mt-1 text-lg font-bold break-keep text-slate-900">{s.title}</h3>
                {s.description && <p className="mt-1 text-base break-keep text-slate-600">{s.description}</p>}
                {s.preconditions && <p className="mt-2 text-sm break-keep text-slate-500">사전 조건: {s.preconditions}</p>}
                {s.steps.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-600">진행 순서</p>
                    <ol className="mt-1 list-decimal pl-5 text-base break-keep text-slate-700">
                      {s.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                )}
                {s.expectedResult && <p className="mt-2 text-sm break-keep text-slate-500">기대 결과: {s.expectedResult}</p>}
                {s.passRule && <p className="mt-1 text-sm break-keep text-slate-500">통과 기준: {s.passRule}</p>}

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                  <label className="flex items-center gap-3 text-base text-slate-700">
                    <input
                      type="checkbox"
                      checked={r.done}
                      onChange={(e) => patchResult(s.id, { done: e.target.checked })}
                      className="size-5 rounded border-slate-300"
                    />
                    이 시나리오를 완료했습니다
                  </label>
                  <div className="max-w-[240px]">
                    <label htmlFor={`diff-${s.id}`} className={labelCls}>난이도</label>
                    <select
                      id={`diff-${s.id}`}
                      value={r.difficulty ?? ''}
                      onChange={(e) => patchResult(s.id, { difficulty: (e.target.value || null) as Difficulty | null })}
                      className={inputCls}
                    >
                      <option value="">선택 안 함</option>
                      {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
                        <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`cmt-${s.id}`} className={labelCls}>의견 (선택)</label>
                    <textarea id={`cmt-${s.id}`} value={r.comment} onChange={(e) => patchResult(s.id, { comment: e.target.value })} rows={2} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor={`err-${s.id}`} className={labelCls}>오류·문제 (선택)</label>
                    <textarea id={`err-${s.id}`} value={r.errorReport} onChange={(e) => patchResult(s.id, { errorReport: e.target.value })} rows={2} className={inputCls} placeholder="어떤 문제가 있었는지" />
                  </div>
                  <div>
                    <label htmlFor={`pos-${s.id}`} className={labelCls}>좋았던 점 (선택)</label>
                    <textarea id={`pos-${s.id}`} value={r.positive} onChange={(e) => patchResult(s.id, { positive: e.target.value })} rows={2} className={inputCls} />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          {error && (
            <p role="alert" className="mb-3 rounded-(--radius-card) border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm font-medium break-keep text-danger-700">
              {error}
            </p>
          )}
          <Button variant="primary" size="md" onClick={submit} disabled={submitting || !consented} className="w-full">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {submitting ? '제출 중…' : '제출'}
          </Button>
          <p className="mt-3 text-center text-sm break-keep text-slate-400">
            응답은 이 브라우저에만 저장되며, 외부로 전송되지 않습니다.
          </p>
        </div>
      </div>
    </main>
  )
}
