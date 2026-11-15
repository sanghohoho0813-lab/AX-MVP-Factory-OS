/**
 * L-7 · D-610 설정 › 작업공간 '가입하면 바로 쓰기' — 대표(운영자)만 보인다. 서버 0028 전이면 칸이 없다.
 *
 *  - 맨 위 한 줄(지금 상태) + 큰 단추 하나([켜기] / [끄기]). 켤 때만 한 번 더 묻는다.
 *  - 받을 사람 수 · AI 시험 기간 · 월 AI 한도 · 마케팅 AI 포함은 접어 둔 칸에서.
 *  - 이 길로 연 계정은 이메일 · 이름 · 작업공간 이름 · 연 날 · AI 시험 끝 · 열림만(그 고객의 업체 · 서류는 대표도 못 본다 — 0024).
 *  - 계정 닫기 · 기간 늘리기는 화면에 없다(지금처럼 SQL Editor — 운영 안내서 §12).
 */
import { useCallback, useEffect, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import {
  clampPolicyNumber,
  loadSelfSignupAccounts,
  loadSelfSignupAdmin,
  saveSelfSignupAdmin,
  selfSignupSummary,
  SELF_SIGNUP_LIMITS,
  type SelfSignupAccount,
  type SelfSignupAdmin,
  type SelfSignupPolicy,
} from '../../services/selfSignup'

const day = (iso: string) => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}`
}
const inputCls = 'mt-1 min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none'

type Draft = Pick<SelfSignupPolicy, 'seatLimit' | 'trialDays' | 'monthlyUnits' | 'marketing'>

export function SelfSignupPanel() {
  const { showToast } = useToast()
  const [admin, setAdmin] = useState<SelfSignupAdmin | null>(null)
  const [accounts, setAccounts] = useState<SelfSignupAccount[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmOn, setConfirmOn] = useState(false)

  const refresh = useCallback(async () => {
    const r = await loadSelfSignupAdmin()
    if (r.status !== 'ready') {
      setAdmin(null)
      return
    }
    setAdmin(r.admin)
    setDraft({ seatLimit: r.admin.policy.seatLimit, trialDays: r.admin.policy.trialDays, monthlyUnits: r.admin.policy.monthlyUnits, marketing: r.admin.policy.marketing })
    setAccounts(await loadSelfSignupAccounts())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!admin || !draft) return null
  const p = admin.policy

  const save = async (next: Partial<SelfSignupPolicy>, done: string) => {
    setBusy(true)
    try {
      const r = await saveSelfSignupAdmin({ open: p.open, ...draft, ...next })
      if (r.status === 'ready') {
        setAdmin(r.admin)
        setDraft({ seatLimit: r.admin.policy.seatLimit, trialDays: r.admin.policy.trialDays, monthlyUnits: r.admin.policy.monthlyUnits, marketing: r.admin.policy.marketing })
      }
      showToast(done)
      setAccounts(await loadSelfSignupAccounts())
    } catch {
      showToast('저장하지 못했어요 — 인터넷을 확인하고 다시 눌러 주세요.')
    } finally {
      setBusy(false)
      setConfirmOn(false)
    }
  }

  const setNum = (k: 'seatLimit' | 'trialDays' | 'monthlyUnits', v: string) => setDraft((d) => (d ? { ...d, [k]: v === '' ? 0 : Number(v) } : d))
  const dirty = draft.seatLimit !== p.seatLimit || draft.trialDays !== p.trialDays || draft.monthlyUnits !== p.monthlyUnits || draft.marketing !== p.marketing
  const seatsAfter = Math.max(0, clampPolicyNumber('seatLimit', draft.seatLimit) - admin.used)

  return (
    <div data-testid="self-signup-panel" data-open={p.open ? '1' : '0'} data-guide="fn-self-signup">
      <Panel title="가입하면 바로 쓰기">
        <p className="text-[1rem] break-keep text-slate-800" data-testid="self-signup-summary">
          {selfSignupSummary(admin)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.open ? (
            <Button variant="secondary" onClick={() => void save({ open: false }, '가입하면 바로 쓰기를 껐어요. 이미 연 고객 계정은 그대로예요.')} disabled={busy} data-testid="self-signup-toggle" data-action="off">
              끄기
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setConfirmOn(true)} disabled={busy} data-testid="self-signup-toggle" data-action="on">
              켜기
            </Button>
          )}
          <span className="text-[0.9375rem] break-keep text-slate-600">
            받을 사람 {p.seatLimit}명 · AI 시험 {p.trialDays}일 · 월 AI {p.monthlyUnits}
            {p.marketing ? ' · 마케팅 AI 포함' : ''}
          </span>
        </div>

        <details className="mt-4 border-t border-slate-100 pt-3" data-testid="self-signup-settings">
          <summary className="cursor-pointer text-[0.9375rem] font-semibold text-slate-800">받을 사람 수 · AI 시험 기간 · 한도 바꾸기</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[0.9375rem] text-slate-700">
              받을 사람 수(명)
              <input type="number" inputMode="numeric" min={SELF_SIGNUP_LIMITS.seatLimit.min} max={SELF_SIGNUP_LIMITS.seatLimit.max} value={draft.seatLimit} onChange={(e) => setNum('seatLimit', e.target.value)} className={inputCls} data-testid="self-signup-seats" />
            </label>
            <label className="text-[0.9375rem] text-slate-700">
              AI 시험 기간(일)
              <input type="number" inputMode="numeric" min={SELF_SIGNUP_LIMITS.trialDays.min} max={SELF_SIGNUP_LIMITS.trialDays.max} value={draft.trialDays} onChange={(e) => setNum('trialDays', e.target.value)} className={inputCls} data-testid="self-signup-days" />
            </label>
            <label className="text-[0.9375rem] text-slate-700">
              월 AI 한도
              <input type="number" inputMode="numeric" min={SELF_SIGNUP_LIMITS.monthlyUnits.min} max={SELF_SIGNUP_LIMITS.monthlyUnits.max} value={draft.monthlyUnits} onChange={(e) => setNum('monthlyUnits', e.target.value)} className={inputCls} data-testid="self-signup-units" />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[0.9375rem] text-slate-800">
            <input type="checkbox" checked={draft.marketing} onChange={(e) => setDraft((d) => (d ? { ...d, marketing: e.target.checked } : d))} className="size-5 accent-brand-600" data-testid="self-signup-marketing" />
            마케팅 AI 단추도 쓰게 하기
          </label>
          <p className="mt-2 text-[0.9375rem] break-keep text-slate-600">
            시험 기간이 끝나면 AI 단추만 멈춰요. 그 고객의 화면 · 자료는 그대로예요. 지금 고치는 값은 앞으로 여는 계정부터 써요.
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => void save({}, '저장했어요.')} disabled={busy || !dirty} data-testid="self-signup-save">
            저장
          </Button>
        </details>

        <details className="mt-3 border-t border-slate-100 pt-3" data-testid="self-signup-accounts">
          <summary className="cursor-pointer text-[0.9375rem] font-semibold text-slate-800">이 길로 연 계정 {accounts.length}명</summary>
          {accounts.length === 0 ? (
            <p className="mt-2 text-[0.9375rem] text-slate-600">아직 없어요.</p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-slate-100">
              {accounts.map((a) => (
                <li key={a.email + a.joinedAt} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-[0.9375rem]" data-testid="self-signup-account" data-active={a.active ? '1' : '0'}>
                  <span className="min-w-0 font-semibold break-all text-slate-900">{a.email}</span>
                  {a.personName && <span className="text-slate-700">{a.personName}</span>}
                  <span className="text-slate-600">{a.workspaceName}</span>
                  <span className="text-slate-600">{day(a.joinedAt)} 시작</span>
                  {a.aiUntil && <span className="text-slate-600">AI 시험 {day(a.aiUntil)}까지</span>}
                  {!a.active && <span className="font-semibold text-danger-700">닫힘</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[0.9375rem] break-keep text-slate-600">이 고객들의 업체 · 서류 · 기록은 대표님도 볼 수 없어요. 계정 닫기 · 기간 늘리기는 지금처럼 SQL Editor 에서 해요.</p>
        </details>
      </Panel>
      <ConfirmModal
        open={confirmOn}
        title="가입하면 바로 쓰기를 켤까요?"
        message={`이메일 확인을 마친 새 가입자가 스스로 계정을 열어요(남은 자리 ${seatsAfter}명 · AI 시험 ${clampPolicyNumber('trialDays', draft.trialDays)}일 · 월 AI ${clampPolicyNumber('monthlyUnits', draft.monthlyUnits)}). 자리가 다 차면 저절로 닫히고, 언제든 [끄기] 로 닫을 수 있어요.`}
        warning="그 고객의 업체 · 서류 · 기록은 대표님도 볼 수 없어요(고객 자료 보호)."
        confirmLabel="켜기"
        busy={busy}
        onConfirm={() => void save({ open: true }, '켰어요. 새 가입자가 [바로 시작하기] 로 계정을 열 수 있어요.')}
        onCancel={() => setConfirmOn(false)}
      />
    </div>
  )
}
