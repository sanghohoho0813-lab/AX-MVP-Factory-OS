/**
 * L-9 · D-609 상담 신청 공개 화면 (/ask/<12자리>) — 로그인 없음 · OS 로고 · 이름 없음.
 *
 * 컨설턴트(팀장 · 구독 고객 · 대표)가 글 끝 · 프로필에 붙인 주소로 들어온 사람이 이름 · 연락처 · 하고 싶은 말을 적고 보낸다.
 * 보내면 그 컨설턴트 작업공간의 잠재고객(영업 관리 · 고객 관리)으로 바로 들어간다(서버 0027 public_intake_submit).
 *
 *  - 화면이 읽는 것은 컨설턴트가 정한 제목 · 한 줄 소개뿐. 작업공간 · 이메일 · 다른 고객은 나가지 않는다.
 *  - 라우터 · 로그인 준비 밖에서 바로 그린다(App.tsx) — '불러오는 중' 에 OS 이름이 뜨지 않게, 받는 양도 적게.
 *  - 60대 기준: 글자 16px 이상 · 누르는 칸 48px · 쉬운 말. 한 화면에 한 가지(적고 → 보내기).
 *  - 사람 눈에 안 보이는 칸(website)을 로봇이 채우면 서버가 접수된 척만 한다.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  EMPTY_INTAKE_FORM,
  INTAKE_SOURCES,
  intakeErrorText,
  loadPublicIntakeForm,
  sourceFromQuery,
  submitPublicIntake,
  validateIntake,
  type IntakeForm,
  type PublicFormLoad,
} from '../../services/intakeLink'

const inputCls = 'w-full min-h-12 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-brand-500 focus:outline-none'

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 sm:py-10" data-testid="intake-page">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-7">{children}</div>
      <p className="mx-auto mt-3 max-w-[560px] px-1 text-[0.9375rem] break-keep text-slate-600">적어 주신 내용은 이 신청 화면을 만든 분께만 전달돼요.</p>
    </main>
  )
}

export default function IntakeFormPage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<PublicFormLoad | null>(null)
  const [form, setForm] = useState<IntakeForm>(() => ({ ...EMPTY_INTAKE_FORM, source: typeof window !== 'undefined' ? sourceFromQuery(window.location.search) : '' }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let alive = true
    void loadPublicIntakeForm(slug).then((r) => {
      if (!alive) return
      setLoad(r)
      if (r.status === 'open') document.title = r.title
    })
    return () => {
      alive = false
    }
  }, [slug, tries])

  const set = <K extends keyof IntakeForm>(k: K, v: IntakeForm[K]) => setForm((prev) => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (busy) return
    const problem = validateIntake(form)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await submitPublicIntake(slug, form)
      if (r === 'closed') setLoad({ status: 'closed' })
      else setDone(true)
    } catch (cause) {
      setError(intakeErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!load) {
    return (
      <Shell>
        <p role="status" className="text-base text-slate-700" data-testid="intake-loading">
          상담 신청 화면을 여는 중…
        </p>
      </Shell>
    )
  }
  if (load.status === 'closed') {
    return (
      <Shell>
        <h1 className="text-xl font-bold break-keep text-slate-900" data-testid="intake-closed">
          이 주소는 지금 상담 신청을 받지 않아요
        </h1>
        <p className="text-base break-keep text-slate-700">주소를 보내 준 분께 새 주소를 물어봐 주세요.</p>
      </Shell>
    )
  }
  if (load.status === 'error') {
    return (
      <Shell>
        <h1 className="text-xl font-bold break-keep text-slate-900" data-testid="intake-error">
          잠깐 연결이 안 됐어요
        </h1>
        <button type="button" onClick={() => setTries((n) => n + 1)} className="tap min-h-12 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-base font-semibold text-slate-800 hover:bg-slate-50">
          다시 열기
        </button>
      </Shell>
    )
  }
  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-start gap-2" role="status" data-testid="intake-done">
          <CheckCircle2 aria-hidden="true" className="size-9 text-success-600" />
          <h1 className="text-xl font-bold break-keep text-slate-900">보냈어요 — 곧 연락드릴게요</h1>
          <p className="text-base break-keep text-slate-700">{load.title} 에 잘 전달됐어요. 이 창은 닫으셔도 돼요.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold break-keep text-slate-900 sm:text-2xl" data-testid="intake-title">
          {load.title}
        </h1>
        {load.intro && (
          <p className="text-base break-keep text-slate-800" data-testid="intake-intro">
            {load.intro}
          </p>
        )}
        <p className="text-base break-keep text-slate-700">이름과 연락처를 남겨 주시면 연락드려요. 1분이면 돼요.</p>
      </header>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        noValidate
        data-testid="intake-form"
      >
        <label className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">이름</span>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" maxLength={30} className={inputCls} data-testid="intake-name" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">
            회사 이름 <span className="font-normal text-slate-600">(있으면)</span>
          </span>
          <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} autoComplete="organization" maxLength={60} className={inputCls} data-testid="intake-company" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">휴대폰</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" maxLength={20} className={inputCls} data-testid="intake-phone" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">
            이메일 <span className="font-normal text-slate-600">(전화가 불편하면)</span>
          </span>
          <input value={form.email} onChange={(e) => set('email', e.target.value)} type="email" inputMode="email" autoComplete="email" maxLength={80} className={inputCls} data-testid="intake-email" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-base font-semibold text-slate-800">
            궁금한 것 · 하고 싶은 말 <span className="font-normal text-slate-600">(안 적어도 돼요)</span>
          </span>
          <textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={3} maxLength={500} className={`${inputCls} min-h-24 resize-y`} data-testid="intake-message" />
        </label>
        <fieldset className="flex flex-col gap-1.5" data-testid="intake-sources">
          <legend className="mb-1.5 text-base font-semibold text-slate-800">
            어디서 보고 오셨어요? <span className="font-normal text-slate-600">(안 골라도 돼요)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {INTAKE_SOURCES.map((s) => {
              const on = form.source === s
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('source', on ? '' : s)}
                  className={`tap min-h-12 rounded-full border px-4 text-base font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                  data-testid="intake-source"
                  data-source={s}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>
        {/* 사람 눈에 안 보이는 칸 — 로봇만 채운다(채우면 서버가 접수된 척만 한다) */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            홈페이지
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} name="website" />
          </label>
        </div>
        <label className="tap flex items-start gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white p-3">
          <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-1 size-5 shrink-0 accent-brand-600" data-testid="intake-consent" />
          <span className="text-base break-keep text-slate-800">
            상담 연락을 위해 적은 이름 · 회사 이름 · 연락처 · 내용을 이 신청 화면을 만든 분께 보내는 데 동의합니다. 상담이 끝나거나 원하시면 지워 달라고 하실 수 있어요.
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-base break-keep text-danger-700" data-testid="intake-problem">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="tap min-h-13 rounded-(--radius-control) bg-brand-600 px-4 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-60" data-testid="intake-submit">
          {busy ? '보내는 중…' : '상담 신청 보내기'}
        </button>
      </form>
    </Shell>
  )
}
