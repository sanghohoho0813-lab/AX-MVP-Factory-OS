/**
 * D-635 설정 › 작업공간 '가입 신청' — 대표(운영자)만 보인다. 서버 0029 전이면 칸이 없다.
 *
 *  - 맨 위 한 줄(기다리는 사람 수 · 승인하면 무엇이 열리는지) + 줄마다 [승인] · [거절](둘 다 한 번 더 묻기).
 *  - 줄 = 이름 · 소속 · 이메일 · 가입한 날 · 한 줄 소개 · '메일 확인 전'. 5줄까지 · [n명 더 보기].
 *  - 거절한 사람은 접힌 한 줄 안에 — [승인] 으로 나중에 열 수 있다(지운 것 없음).
 *  - 승인 = 0028 [바로 시작하기] · customer_provision.sql 과 같은 계정(빈 작업공간 · AI 시험 기간). AI 시험 기간 · 한도는 '가입하면 바로 쓰기' 설정 값.
 *  - 그 사람의 업체 · 서류 · 기록은 대표도 못 본다(0024). 이 칸은 이름 · 소속 · 이메일만 다룬다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toastContext'
import { loadSelfSignupAdmin, type SelfSignupAdmin } from '../../services/selfSignup'
import {
  approveSignup,
  approveWorkspaceName,
  decisionText,
  loadSignupRequests,
  rejectSignup,
  requestWho,
  signupDay,
  SIGNUP_REQUESTS_CHANGED,
  type SignupRequest,
} from '../../services/signupApproval'

const SHOW = 5
const inputCls = 'mt-1 min-h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none'

type Ask = { kind: 'approve' | 'reject'; row: SignupRequest }

export function SignupRequestsPanel({ focus = false }: { focus?: boolean }) {
  const { showToast } = useToast()
  const [admin, setAdmin] = useState<SelfSignupAdmin | null>(null)
  const [rows, setRows] = useState<SignupRequest[] | null>(null)
  const [all, setAll] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [wsName, setWsName] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    const [a, r] = await Promise.all([loadSelfSignupAdmin(), loadSignupRequests()])
    if (a.status !== 'ready' || r.status !== 'ready') {
      setAdmin(null)
      setRows(null)
      return
    }
    setAdmin(a.admin)
    setRows(r.rows)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // ?tab=workspace&focus=signup(종에서 왔을 때) — 이 칸으로 내려 준다
  useEffect(() => {
    if (focus && rows) box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus, rows])

  if (!admin || !rows) return null
  const pending = rows.filter((r) => r.status === 'pending')
  const rejected = rows.filter((r) => r.status === 'rejected')
  const shown = all ? pending : pending.slice(0, SHOW)
  const p = admin.policy

  const open = (kind: Ask['kind'], row: SignupRequest) => {
    setAsk({ kind, row })
    setWsName(approveWorkspaceName(row))
    setMemo('')
  }
  const decide = async () => {
    if (!ask || busy) return
    setBusy(true)
    const who = requestWho(ask.row)
    try {
      const r = ask.kind === 'approve' ? await approveSignup(ask.row.userId, wsName) : await rejectSignup(ask.row.userId, memo)
      showToast(decisionText(ask.kind, r, who))
      setAsk(null)
      await refresh()
      window.dispatchEvent(new Event(SIGNUP_REQUESTS_CHANGED))
    } catch {
      showToast('저장하지 못했어요 — 인터넷을 확인하고 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const line = (r: SignupRequest) => (
    <li key={r.userId} className="flex flex-col gap-1.5 py-3" data-testid="signup-request" data-email={r.email} data-status={r.status} data-confirmed={r.emailConfirmed ? '1' : '0'}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[1rem] font-semibold break-keep text-slate-900">{requestWho(r)}</span>
        <span className="min-w-0 text-[0.9375rem] break-all text-slate-600">{r.email}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-slate-600">
        <span>{signupDay(r.signedUpAt)} 가입</span>
        {!r.emailConfirmed && (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.875rem] font-semibold text-warning-700" data-testid="signup-unconfirmed">
            메일 확인 전
          </span>
        )}
        {r.status === 'rejected' && r.decidedAt && <span>{signupDay(r.decidedAt)} 거절</span>}
      </div>
      {r.intro && <p className="truncate text-[0.9375rem] text-slate-700">{r.intro}</p>}
      {r.status === 'rejected' && r.note && <p className="truncate text-[0.9375rem] text-slate-600">메모: {r.note}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={!r.emailConfirmed}
          title={r.emailConfirmed ? undefined : '가입 메일의 확인 링크를 누른 뒤 승인할 수 있어요'}
          onClick={() => open('approve', r)}
          data-testid="signup-approve"
        >
          승인
        </Button>
        {r.status === 'pending' && (
          <Button variant="ghost" size="sm" onClick={() => open('reject', r)} data-testid="signup-reject">
            거절
          </Button>
        )}
      </div>
    </li>
  )

  const who = ask ? requestWho(ask.row) : ''
  return (
    <div ref={box} data-testid="signup-requests" data-count={pending.length} data-guide="fn-signup-requests" id="signup-requests">
      <Panel title={pending.length > 0 ? `가입 신청 ${pending.length}명` : '가입 신청'}>
        <p className="text-[1rem] break-keep text-slate-800" data-testid="signup-requests-summary">
          {pending.length > 0 ? `[승인] 하면 그분만 쓰는 빈 작업공간이 열려요 · AI 시험 ${p.trialDays}일.` : '지금 기다리는 가입 신청이 없어요.'}
        </p>
        {shown.length > 0 && <ul className="mt-1 flex flex-col divide-y divide-slate-100">{shown.map(line)}</ul>}
        {!all && pending.length > SHOW && (
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setAll(true)} data-testid="signup-more">
            {pending.length - SHOW}명 더 보기
          </Button>
        )}
        {rejected.length > 0 && (
          <details className="mt-3 border-t border-slate-100 pt-3" data-testid="signup-rejected-list">
            <summary className="sum-chev cursor-pointer text-[0.9375rem] font-semibold text-slate-800">거절한 사람 {rejected.length}명</summary>
            <ul className="mt-1 flex flex-col divide-y divide-slate-100">{rejected.map(line)}</ul>
          </details>
        )}
      </Panel>
      <Modal
        open={!!ask}
        title={ask?.kind === 'approve' ? `${who} 님 가입을 승인할까요?` : `${who} 님 가입을 거절할까요?`}
        onClose={() => (busy ? undefined : setAsk(null))}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)} disabled={busy}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={() => void decide()}
              disabled={busy || (ask?.kind === 'approve' && !wsName.trim())}
              className={ask?.kind === 'reject' ? 'border-danger-600 bg-danger-600 hover:border-danger-700 hover:bg-danger-700' : undefined}
              data-testid="signup-decide"
            >
              {busy ? '처리 중…' : ask?.kind === 'approve' ? '승인' : '거절'}
            </Button>
          </>
        }
      >
        {ask?.kind === 'approve' ? (
          <div className="flex flex-col gap-3" data-testid="signup-approve-dialog">
            <p className="break-keep">
              {ask.row.email} 계정이 바로 열려요 — 그분만 쓰는 빈 작업공간 · AI 시험 {p.trialDays}일 · 월 AI {p.monthlyUnits}
              {p.marketing ? ' · 마케팅 AI 포함' : ''}.
            </p>
            <label className="text-[0.9375rem] text-slate-700">
              작업공간 이름
              <input value={wsName} onChange={(e) => setWsName(e.target.value)} maxLength={40} className={inputCls} data-testid="signup-approve-name" />
            </label>
            <p className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-[0.9375rem] break-keep text-slate-700">
              대표님 업체 · 자료는 그분께 안 보이고, 그분의 업체 · 서류도 대표님은 못 봐요.
            </p>
          </div>
        ) : ask ? (
          <div className="flex flex-col gap-3" data-testid="signup-reject-dialog">
            <p className="break-keep">지우는 것은 없어요. 그분은 &lsquo;가입이 승인되지 않았어요&rsquo; 화면을 보고, 나중에 승인할 수도 있어요.</p>
            <label className="text-[0.9375rem] text-slate-700">
              메모(대표님만 봐요 · 골라서)
              <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} className={inputCls} placeholder="예: 시범 대상 아님" data-testid="signup-reject-note" />
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
