/**
 * 공개 로컬 테스트 (supabase 모드). 공개 RPC 로 세션을 로드·제출한다.
 * - 원문 토큰 → 서버 해시 조회, 렌더 필드만 반환(내부 정보 미노출).
 * - 진행상태/동의/피드백 저장, 제출(최종), completed/expired/revoked/invalid 상태.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, MonitorSmartphone, ShieldAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { getSupabaseClient } from '../../lib/supabase/client'
import { PublicTokenClient, type PublicTestSessionView } from '../../repositories/async/publicTokenClient'

const inputCls = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-base text-slate-700 focus:border-brand-400 focus:outline-none'

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
        <p className="mt-2 text-sm break-keep text-slate-500">{description}</p>
      </div>
    </main>
  )
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((it) => (typeof it === 'string' ? it : typeof it === 'object' && it && 'text' in it ? String((it as { text: unknown }).text) : JSON.stringify(it)))
}

export function SupabasePublicTest() {
  const { accessToken = '' } = useParams()
  const client = useMemo(() => new PublicTokenClient(getSupabaseClient()), [])

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<PublicTestSessionView | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [overall, setOverall] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await client.getTestSession(accessToken)
        if (!alive) return
        if (!s || !s.available) {
          setUnavailable(true)
        } else {
          setSession(s)
        }
      } catch {
        if (alive) setError('테스트 세션을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [client, accessToken])

  async function handleSubmit() {
    if (submitting || !session) return
    setSubmitting(true)
    setError(null)
    try {
      await client.submitTestFeedback(accessToken, { consented, answers, overall, submittedAt: new Date().toISOString() }, true)
      setDone(true)
    } catch {
      setError('피드백을 저장하지 못했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  if (loading) return <FullPageNotice icon={Loader2} tone="neutral" title="불러오는 중입니다…" description="잠시만 기다려 주세요." />
  if (unavailable) return <FullPageNotice icon={ShieldAlert} tone="danger" title="사용할 수 없는 테스트 링크입니다." description="링크가 만료·중지되었거나 올바르지 않습니다. 담당자에게 문의해 주세요." />
  if (done) return <FullPageNotice icon={CheckCircle2} tone="success" title="테스트 피드백을 제출했습니다." description="참여해 주셔서 감사합니다." />
  if (!session) return <FullPageNotice icon={ShieldAlert} tone="neutral" title="테스트를 불러올 수 없습니다." description="잠시 후 다시 시도해 주세요." />

  const tasks = asStringList(session.tasks)
  const questions = asStringList(session.questions)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
            <MonitorSmartphone aria-hidden="true" className="size-4" /> 로컬 테스트
          </p>
          <h1 className="mt-1 text-xl font-bold break-keep text-slate-900">{(session.title as string) ?? '테스트'}</h1>
          {typeof session.instructions === 'string' && session.instructions && (
            <p className="mt-2 text-sm break-keep text-slate-600">{session.instructions}</p>
          )}
        </header>

        {typeof session.scenario === 'string' && session.scenario && (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">시나리오</h2>
            <p className="mt-2 text-sm break-keep text-slate-600">{session.scenario}</p>
          </section>
        )}

        {tasks.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">수행 과제</h2>
            <ul className="mt-2 list-inside list-disc text-sm break-keep text-slate-600">
              {tasks.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </section>
        )}

        {questions.length > 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">질문</h2>
            {questions.map((q, i) => (
              <div key={i}>
                <label className="mb-1 block text-sm font-medium break-keep text-slate-700">{q}</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                />
              </div>
            ))}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">전반적인 의견</label>
          <textarea className={inputCls} rows={4} value={overall} onChange={(e) => setOverall(e.target.value)} placeholder="사용하면서 느낀 점을 자유롭게 적어 주세요." />
          <label className="mt-4 flex items-start gap-2 text-[13px] break-keep text-slate-600">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} className="mt-0.5" />
            수집된 피드백이 서비스 개선 목적으로 사용되는 것에 동의합니다.
          </label>
        </section>

        {error && <p className="rounded-(--radius-card) border border-danger-200 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">{error}</p>}

        <Button variant="primary" disabled={submitting || !consented} onClick={() => void handleSubmit()} className="h-11">
          {submitting ? '제출 중…' : '피드백 제출'}
        </Button>
      </div>
    </main>
  )
}
