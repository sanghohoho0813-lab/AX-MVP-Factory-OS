/**
 * 지원사업 찾기 — 가망고객 공개 화면 (D-141). 로그인 없음.
 *
 *  - 지역 · 업종 · 업력만 고르면 바로 '지금 신청할 수 있는 지원사업' 이 보인다(직원 · 매출 · 대표 나이는 고르면 더 정확).
 *  - 영업자가 보낸 링크로 들어오면 그 회사 조건이 이미 골라져 있다.
 *  - [새 공고 알림 받기] → 회사 · 연락처 · 동의 → 내부 '잠재고객 상담신청' 함으로 들어간다(고른 조건 그대로).
 *  - 공고는 내부가 '찾기 화면에 보이기' 한 것만, 공개 함수로만 읽는다. 예시 공고는 나오지 않는다.
 *  - 판정은 '조건 맞음 · 확인 필요' 뿐 — 선정 가능성을 말하지 않는다.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BellRing, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { brand } from '../../brand/brand.config'
import { Button } from '../../components/ui/Button'
import { BottomSheet } from '../../components/ui/primitives'
import { CategoryChips, DeadlineText, NoticeLink, ReasonList, VerdictBadge } from '../../components/grants/GrantParts'
import { todayLocalDate } from '../../lib/appClock'
import { CERT_LABEL, SIDO_LIST, matchesFor, type CertKey, type CompanyProfile, type GrantCategory, type GrantNotice } from '../../services/grants/grantMatch'
import { AGE_CHIPS, EMPLOYEE_CHIPS, INDUSTRY_CHIPS, REVENUE_CHIPS, YEARS_CHIPS, chipOf, profileChipsText, profileFromQuery, profileToQuery, type RangeChip } from '../../services/grants/grantText'
import { listPublicNotices, submitAlertRequest, validateAlert } from '../../services/grants/grantStore'

function Chip({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-testid={testid}
      onClick={onClick}
      className={`tap t-body rounded-full border px-3.5 py-2 font-semibold whitespace-nowrap ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}`}
    >
      {children}
    </button>
  )
}

function ChipRow({ label, chips, value, onPick, testid }: { label: string; chips: RangeChip[]; value: CompanyProfile['years']; onPick: (r: RangeChip['range'] | null) => void; testid: string }) {
  const cur = chipOf(chips, value)
  return (
    <div className="flex flex-col gap-1.5" data-testid={testid}>
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.label} on={cur === c.label} onClick={() => onPick(cur === c.label ? null : c.range)}>
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 t-body focus:border-brand-500 focus:outline-none'

export default function GrantFinderPage() {
  const today = todayLocalDate()
  const [params, setParams] = useSearchParams()
  const from = params.get('from') ?? ''
  const [profile, setProfile] = useState<CompanyProfile>(() => profileFromQuery(params.toString()))
  const [notices, setNotices] = useState<GrantNotice[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const ready3 = !!profile.sido && !!profile.industry && !!profile.years
  const [editing, setEditing] = useState(!ready3)
  const [category, setCategory] = useState<GrantCategory | 'all'>('all')
  const [open, setOpen] = useState('')
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = `지원사업 찾기 | ${brand.brandNameKo}`
    listPublicNotices()
      .then((r) => {
        setNotices(r.notices)
        setState(r.ready ? 'ready' : 'error')
      })
      .catch(() => setState('error'))
  }, [])

  const update = (patch: Partial<CompanyProfile>) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    setParams(new URLSearchParams(profileToQuery(next, { from })), { replace: true })
  }

  const matches = useMemo(() => matchesFor(notices, profile, today), [notices, profile, today])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of matches) c[m.notice.category] = (c[m.notice.category] ?? 0) + 1
    return c
  }, [matches])
  const listed = matches.filter((m) => category === 'all' || m.notice.category === category)
  const fit = matches.filter((m) => m.verdict === 'fit').length

  return (
    <div className="min-h-dvh bg-slate-50 pb-28">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <img src={brand.logoLight} alt={brand.logoAlt} className="h-7 w-auto" />
          <span className="t-sub ml-auto font-semibold text-slate-500">지원사업 찾기</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        <section className="flex flex-col gap-1">
          <h1 className="t-page break-keep text-slate-900" data-testid="finder-title">
            {profile.name ? `${profile.name} 대표님 회사에 맞는 지원사업` : '우리 회사에 맞는 정부 지원사업'}
          </h1>
          <p className="t-sub break-keep text-slate-600">지역 · 업종 · 업력 세 가지만 고르면 지금 신청할 수 있는 사업을 마감 급한 순으로 보여 드려요. 회원가입은 필요 없습니다.</p>
        </section>

        <section className="rounded-(--radius-panel) border border-slate-200 bg-white" aria-label="우리 회사 조건">
          <button type="button" onClick={() => setEditing((v) => !v)} className="tap flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={editing} data-testid="finder-edit">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="t-sub font-semibold text-slate-500">우리 회사 조건</span>
              <span className="t-body truncate font-semibold text-slate-900" data-testid="finder-summary">
                {profileChipsText(profile) || '아직 고르지 않았어요'}
              </span>
            </span>
            <span className="t-sub shrink-0 font-semibold text-brand-700">{editing ? '닫기' : '바꾸기'}</span>
            {editing ? <ChevronUp aria-hidden="true" className="size-5 text-slate-400" /> : <ChevronDown aria-hidden="true" className="size-5 text-slate-400" />}
          </button>
          {editing && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4" data-testid="finder-form">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="t-sub font-semibold text-slate-700">① 지역</span>
                  <select value={profile.sido} onChange={(e) => update({ sido: e.target.value, city: '' })} className={inputCls} data-testid="finder-sido">
                    <option value="">시·도 고르기</option>
                    {SIDO_LIST.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="t-sub font-semibold text-slate-700">시·군·구(선택)</span>
                  <input value={profile.city} onChange={(e) => update({ city: e.target.value.trim().slice(0, 10) })} placeholder="파주시" className={inputCls} disabled={!profile.sido} data-testid="finder-city" />
                </label>
              </div>
              <div className="flex flex-col gap-1.5" data-testid="finder-industry">
                <span className="t-sub font-semibold text-slate-700">② 업종</span>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_CHIPS.map((c) => (
                    <Chip key={c} on={profile.industry === c} onClick={() => update({ industry: profile.industry === c ? '' : c })}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
              <ChipRow label="③ 업력(설립한 지)" chips={YEARS_CHIPS} value={profile.years} onPick={(r) => update({ years: r })} testid="finder-years" />
              <p className="t-sub text-slate-500">아래는 고르면 더 정확해요(안 골라도 됩니다).</p>
              <ChipRow label="직원 수" chips={EMPLOYEE_CHIPS} value={profile.employees} onPick={(r) => update({ employees: r })} testid="finder-employees" />
              <ChipRow label="작년 매출" chips={REVENUE_CHIPS} value={profile.revenueM} onPick={(r) => update({ revenueM: r })} testid="finder-revenue" />
              <ChipRow label="대표 나이" chips={AGE_CHIPS} value={profile.ceoAge} onPick={(r) => update({ ceoAge: r })} testid="finder-age" />
              <div className="flex flex-col gap-1.5">
                <span className="t-sub font-semibold text-slate-700">대표 성별 · 인증</span>
                <div className="flex flex-wrap gap-2">
                  <Chip on={profile.female === true} onClick={() => update({ female: profile.female === true ? null : true })}>
                    여성 대표
                  </Chip>
                  {(['venture', 'innobiz', 'mainbiz', 'lab'] as CertKey[]).map((c) => (
                    <Chip key={c} on={profile.certs.includes(c)} onClick={() => update({ certs: profile.certs.includes(c) ? profile.certs.filter((x) => x !== c) : [...profile.certs, c], certsKnown: true })}>
                      {CERT_LABEL[c]}
                    </Chip>
                  ))}
                  <Chip on={profile.certsKnown && profile.certs.length === 0} onClick={() => update({ certs: [], certsKnown: !(profile.certsKnown && profile.certs.length === 0) })}>
                    인증 없음
                  </Chip>
                </div>
              </div>
              <Button variant="primary" onClick={() => setEditing(false)} className="w-full" data-testid="finder-apply">
                {ready3 ? `맞는 지원사업 ${matches.length}개 보기` : '고른 조건으로 보기'}
              </Button>
            </div>
          )}
        </section>

        {state === 'loading' && <p className="t-body text-slate-500">공고를 불러오는 중…</p>}
        {state === 'error' && (
          <p className="t-body rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-3 text-warning-800" role="alert">
            지금은 공고를 불러오지 못했습니다. 아래 '알림 받기' 를 남겨 주시면 맞는 공고를 직접 보내 드릴게요.
          </p>
        )}

        {state === 'ready' && (
          <section className="flex flex-col gap-3" aria-label="맞는 지원사업">
            <h2 className="t-section break-keep text-slate-900" data-testid="finder-hero">
              <span className="text-brand-700">{[profile.sido, profile.city].filter(Boolean).join(' ') || '전국'}</span> 에서 지금 신청할 수 있는 지원사업 <span className="text-brand-700">{matches.length}개</span>
              {fit > 0 && fit < matches.length && <span className="t-sub ml-1 font-normal text-slate-500">(조건 맞음 {fit}개)</span>}
            </h2>
            {matches.length > 0 && <CategoryChips value={category} counts={counts} onChange={setCategory} />}
            {listed.length === 0 ? (
              <p className="t-body rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-slate-500">지금은 고른 조건에 맞는 공고가 없어요. 알림을 받아 두시면 새 공고가 나올 때 알려 드려요.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="finder-list">
                {listed.map((m) => (
                  <li key={m.notice.id} data-testid="finder-row" data-verdict={m.verdict}>
                    <button type="button" onClick={() => setOpen(open === m.notice.id ? '' : m.notice.id)} className="tap flex w-full items-start gap-3 px-4 py-3.5 text-left" aria-expanded={open === m.notice.id}>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="t-body break-keep font-semibold text-slate-900">{m.notice.title}</span>
                        <span className="t-sub text-slate-500">{m.notice.agency}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <VerdictBadge v={m.verdict} />
                          {m.verdict === 'check' && <span className="t-sub text-warning-800">확인할 것 {m.unknownCount}가지</span>}
                        </span>
                      </span>
                      <DeadlineText d={m.deadline} />
                    </button>
                    {open === m.notice.id && (
                      <div className="flex flex-col gap-2 px-4 pb-4" data-testid="finder-detail">
                        {m.notice.amountText && <p className="t-body font-semibold text-slate-800">{m.notice.amountText}</p>}
                        <ReasonList reasons={m.reasons} />
                        {m.notice.target && <p className="t-sub break-keep text-slate-600">지원대상: {m.notice.target}</p>}
                        <NoticeLink url={m.notice.url} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="t-meta break-keep text-slate-500">공고에 적힌 조건과 고르신 정보를 맞춰 본 결과입니다. 실제 선정은 기관 심사로 정해지며, 신청 전 공고 원문을 꼭 확인해 주세요.</p>
          </section>
        )}
      </main>

      <div className="pb-safe fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {done ? (
            <p className="t-body flex items-center gap-2 font-semibold text-success-700" data-testid="finder-done">
              <CheckCircle2 aria-hidden="true" className="size-5" /> 신청했습니다. 맞는 공고가 나오면 연락드릴게요.
            </p>
          ) : (
            <Button variant="primary" className="w-full" onClick={() => setAsking(true)} data-testid="finder-alert-open">
              <BellRing aria-hidden="true" className="size-5" /> 새 공고 알림 받기 · 신청 도움 받기
            </Button>
          )}
        </div>
      </div>

      {asking && (
        <AlertSheet
          profile={profile}
          from={from}
          titles={matches.map((m) => m.notice.title)}
          fitCount={fit}
          onClose={() => setAsking(false)}
          onDone={() => {
            setAsking(false)
            setDone(true)
          }}
        />
      )}
    </div>
  )
}

function AlertSheet({ profile, from, titles, fitCount, onClose, onDone }: { profile: CompanyProfile; from: string; titles: string[]; fitCount: number; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ companyName: profile.name, name: '', phone: '', email: '', consent: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const req = () => ({ ...form, industry: profile.industry, conditions: profileChipsText(profile), query: profileToQuery(profile), titles, fitCount, from })
  const submit = async () => {
    const problem = validateAlert(req())
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitAlertRequest(req())
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '신청하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <BottomSheet
      title="새 공고 알림 받기"
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" onClick={() => void submit()} disabled={busy} data-testid="finder-alert-submit">
          {busy ? '보내는 중…' : '알림 신청하기'}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" data-testid="finder-alert">
        <p className="t-sub break-keep text-slate-600">고르신 조건({profileChipsText(profile) || '조건 없음'})에 맞는 새 공고가 나오면 알려 드리고, 신청 서류 준비도 도와드립니다.</p>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">회사 이름</span>
          <input id="finder-company" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">이름(선택)</span>
          <input id="finder-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">휴대폰</span>
          <input id="finder-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" placeholder="010-0000-0000" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">이메일(선택)</span>
          <input id="finder-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" className={inputCls} />
        </label>
        <label className="tap flex items-start gap-2.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
          <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1 size-5 accent-brand-600" data-testid="finder-consent" />
          <span className="t-sub break-keep text-slate-700">
            지원사업 안내 · 상담 연락을 위해 회사 이름 · 이름 · 연락처 · 고른 조건을 {brand.brandNameKo}가 받는 데 동의합니다. 안내가 끝나거나 그만 받기를 원하시면 지웁니다.
          </span>
        </label>
        {error && (
          <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
