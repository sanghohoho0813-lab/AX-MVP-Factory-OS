/**
 * 진행 기록 (P1) — '실제 진행' 단계 맨 위. 상태 칩 한 번 · [인증 완료 기록](번호 · 인증일 · 유효기간만) · 갱신 일정 · 다음에 할 일.
 * 날짜는 사람이 적은 것만. '인증일 + 3년' 은 누를 때만 칸에 채우고, 저장 전에 확인서와 대조하라고 적는다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, ChevronRight, ClipboardCheck } from 'lucide-react'
import { Badge, Disclosure } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { CERT_RULES } from '../rules/officialRules'
import { CERT_STATUS_LABEL, CERT_STATUS_ORDER, COMPLETION_PROBLEM_LABEL, completionProblems, validUntilByYears, type CertLifecycle, type CertStatus, type CompletionInput } from '../core/lifecycle'
import { RENEWAL_PHASE_LABEL, renewalPlan } from '../core/renewal'
import { nextAfterCertified, type AfterKind } from '../core/nextAfter'
import type { CertificationClientContext, CertificationKey } from '../core/types'

const inputCls = 't-body h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 focus:border-brand-500 focus:outline-none'

/** 다음에 할 일 → OS 화면 */
function afterHref(kind: AfterKind, clientId: string): string | null {
  switch (kind) {
    case 'policy_fund':
      return `/tools/policy-funding/diagnosis?client=${clientId}`
    case 'tax_credit':
      return `/tools/tax?client=${clientId}`
    case 'venture':
    case 'innobiz':
    case 'mainbiz':
      return `/tools/cert-os/${kind}?client=${clientId}`
    case 'lab_keep':
      return `/tools/labcare?client=${clientId}`
    case 'patent':
      return `/ops/clients/${clientId}?tab=consulting`
    default:
      return null
  }
}

const PHASE_TONE = { ok: 'success', notice: 'brand', todo: 'warning', grace: 'danger', expired: 'danger' } as const

export function LifecyclePanel({
  cert,
  life,
  ctx,
  clientId,
  onStatus,
  onComplete,
  onPatch,
}: {
  cert: CertificationKey
  life: CertLifecycle
  ctx: CertificationClientContext
  clientId: string
  onStatus: (s: CertStatus) => Promise<void>
  onComplete: (input: CompletionInput, toProfile: boolean) => Promise<void>
  onPatch: (patch: Partial<Pick<CertLifecycle, 'memo' | 'postAuditAt'>>) => Promise<void>
}) {
  const rule = CERT_RULES[cert]
  const { showToast } = useToast()
  const done = life.status === 'certified' || life.status === 'renewal'
  const [form, setForm] = useState<CompletionInput | null>(null)
  const [toProfile, setToProfile] = useState(true)
  const [busy, setBusy] = useState(false)
  const [memo, setMemo] = useState(life.memo)
  const [audit, setAudit] = useState(life.postAuditAt)
  const plan = life.validUntil ? renewalPlan(cert, life.validUntil, ctx.today) : null
  const after = done ? nextAfterCertified(cert, ctx) : []
  const problems = form ? completionProblems(form, ctx.today, rule.validYears !== null) : []

  const openForm = () => setForm({ number: life.number, certifiedAt: life.certifiedAt, validUntil: life.validUntil })
  const save = async () => {
    if (!form || problems.length > 0 || busy) return
    setBusy(true)
    try {
      await onComplete(form, toProfile)
      showToast(`${rule.label} 인증 완료를 기록했습니다${form.validUntil ? ' · 갱신 일정을 달력에 걸었습니다' : ''}`)
      setForm(null)
    } catch {
      showToast('저장하지 못했습니다 — 적은 내용은 그대로 있습니다. 다시 눌러 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-control) border border-slate-200 bg-slate-50/60 p-3 sm:p-4" data-testid="cert-life" data-status={life.status}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="t-body inline-flex items-center gap-1.5 font-bold text-slate-900">
          <ClipboardCheck aria-hidden="true" className="size-4 text-brand-600" /> 진행 기록
        </h3>
        <Badge tone={done ? 'success' : 'brand'}>
          <span data-testid="cert-life-status">{CERT_STATUS_LABEL[life.status]}</span>
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${rule.label} 진행 상태`}>
        {CERT_STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={life.status === s}
            onClick={() => (s === 'certified' && !done ? openForm() : void onStatus(s).then(() => showToast(`${rule.label} — ${CERT_STATUS_LABEL[s]}(활동 기록에 남김)`)))}
            className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${life.status === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`}
            data-testid={`cert-life-${s}`}
          >
            {CERT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {done && !form && (
        <div className="flex flex-col gap-2" data-testid="cert-life-done">
          <p className="t-sub break-keep text-slate-800">
            {[life.number && `번호 ${life.number}`, life.certifiedAt && `인증일 ${life.certifiedAt}`, life.validUntil ? `${life.validUntil}까지` : rule.validYears ? '유효기간 — 아직 안 적음' : '유효기간 없음(요건 유지 · 변경 신고)'].filter(Boolean).join(' · ')}
          </p>
          {plan && (
            <p className="t-sub inline-flex flex-wrap items-center gap-x-2 gap-y-1 break-keep text-slate-700" data-testid="cert-renewal" data-phase={plan.phase}>
              <CalendarCheck aria-hidden="true" className="size-4 text-brand-600" />
              <Badge tone={PHASE_TONE[plan.phase]}>{RENEWAL_PHASE_LABEL[plan.phase]}</Badge>
              {plan.daysLeft >= 0 ? `만료까지 ${plan.daysLeft}일` : `만료 ${-plan.daysLeft}일 지남`} · 갱신 준비 시기 {plan.noticeOn} · 갱신 서류 준비 {plan.todoOn}
              {plan.graceUntil ? ` · 연장 마지막 ${plan.graceUntil}` : ''}
            </p>
          )}
          {plan && <p className="t-meta break-keep text-slate-500">{plan.why} — 달력 · 오늘에 같은 날짜로 걸려 있습니다.</p>}
          {after.length > 0 && (
            <div className="flex flex-col gap-1.5" data-testid="cert-after">
              <span className="t-meta font-semibold text-slate-600">다음에 할 일</span>
              <ul className="flex flex-col gap-1.5">
                {after.map((x) => {
                  const href = afterHref(x.kind, clientId)
                  const body = (
                    <>
                      <span className="t-sub font-semibold text-slate-900">{x.label}</span>
                      <span className="t-meta block break-keep text-slate-600">{x.why}</span>
                    </>
                  )
                  return (
                    <li key={x.kind}>
                      {href ? (
                        <Link to={href} className="tap flex items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 hover:border-brand-300" data-testid="cert-after-item">
                          <span className="min-w-0 flex-1">{body}</span>
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                        </Link>
                      ) : (
                        <div className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="cert-after-item">
                          {body}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <Button variant="ghost" className="self-start" onClick={openForm} data-testid="cert-life-edit">
            인증 정보 고치기
          </Button>
        </div>
      )}

      {!done && !form && (
        <Button variant="secondary" className="self-start" onClick={openForm} data-testid="cert-complete-open">
          인증 완료 기록
        </Button>
      )}

      {form && (
        <div className="flex flex-col gap-3 rounded-(--radius-control) border border-brand-200 bg-white p-3" data-testid="cert-complete-form">
          <p className="t-sub break-keep text-slate-700">확인서에 있는 것만 적어 주세요. 모르는 칸은 비워 두면 됩니다.</p>
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">{cert === 'venture' ? '확인서 번호' : cert === 'lab' ? '인정 번호' : '인증(확인)서 번호'}</span>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className={inputCls} placeholder="예: 260101-00123" data-testid="cert-complete-number" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">{cert === 'lab' ? '인정일' : '인증(확인)일'}</span>
            <input type="date" value={form.certifiedAt} onChange={(e) => setForm({ ...form, certifiedAt: e.target.value })} className={`${inputCls} sm:w-auto`} data-testid="cert-complete-date" />
          </label>
          {rule.validYears !== null && (
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1">
                <span className="t-sub font-semibold text-slate-800">유효기간 끝</span>
                <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={`${inputCls} sm:w-auto`} data-testid="cert-complete-valid" />
              </label>
              {form.certifiedAt && !form.validUntil && (
                <button type="button" onClick={() => setForm({ ...form, validUntil: validUntilByYears(form.certifiedAt, rule.validYears ?? 0) })} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="cert-complete-fill">
                  인증일 + {rule.validYears}년(공식 유효기간)으로 채우기 — 확인서 날짜와 맞는지 꼭 보세요
                </button>
              )}
            </div>
          )}
          <label className="t-sub flex items-start gap-2 text-slate-700">
            <input type="checkbox" checked={toProfile} onChange={(e) => setToProfile(e.target.checked)} className="mt-1 size-4 accent-brand-600" data-testid="cert-complete-profile" />
            <span className="break-keep">회사 정보 '인증서' 칸에도 저장(다른 모듈 · 서류 요청이 같이 압니다)</span>
          </label>
          {problems.length > 0 && (
            <ul className="flex flex-col gap-0.5" role="alert">
              {problems.map((p) => (
                <li key={p} className="t-sub text-danger-700">
                  · {COMPLETION_PROBLEM_LABEL[p]}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={busy || problems.length > 0} data-testid="cert-complete-save">
              {busy ? '저장 중…' : '인증 완료로 저장'}
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              닫기
            </Button>
          </div>
        </div>
      )}

      <Disclosure title="더 적기 — 사후 점검 · 메모" hint={life.postAuditAt || life.memo ? '적어 둠' : ''}>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">사후 점검 · 사후심사 예정일</span>
            <input type="date" value={audit} onChange={(e) => setAudit(e.target.value)} onBlur={() => audit !== life.postAuditAt && void onPatch({ postAuditAt: audit })} className={`${inputCls} sm:w-auto`} data-testid="cert-life-audit" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="t-sub font-semibold text-slate-800">메모</span>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={() => memo !== life.memo && void onPatch({ memo })} rows={3} className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none" data-testid="cert-life-memo" />
          </label>
        </div>
      </Disclosure>
    </div>
  )
}
