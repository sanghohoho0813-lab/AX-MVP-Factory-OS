/**
 * L-27 · D-608 대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만 — 화면 조각 셋.
 *
 *  - ViewingConsentLine: 대표가 팀장 화면을 보는 동안 띠 아래 한 줄 — 허락 상태 · [허락 요청 보내기].
 *  - ConsentRequestNotice: 팀장 화면 맨 위 — '대표님이 고객 자료 보기 허락을 요청했어요' → 설정의 그 칸으로.
 *  - ViewConsentPanel: 팀장 설정 — 하루 · 7일 · 30일 허락 · 지금 닫기 · 거절 · 지난 기록.
 * 서버 0026 이 없으면(missing) 셋 다 아무것도 그리지 않는다 — 지금 화면 그대로.
 *
 * D-675 '늘 보기'(서버 0032) — 대표(2026-11-26): "최은혜 팀장 화면은 계속 확인해야 하니 오가도 제약이 없게, 당분간은."
 *  - 대표 띠: 내부 팀장 화면일 때만 [늘 보기로 켜기](한 번 더 묻기) → 켜지면 '늘 보기 켜짐' 한 줄 + [끄기]. 켜고 끈 뒤에는 화면을 새로 읽는다(자료를 처음부터).
 *  - 팀장 화면: 맨 위에 한 번 알림 + 설정 칸에 '대표님이 늘 보기로 정해 두었어요'(허락 단추는 그동안 숨김) · 기록은 남는다. 끄는 것은 대표만.
 *  - 0032 전에는 서버가 canAlways 를 주지 않는다 → 단추 없음(지금 화면 그대로).
 * 박스는 흰 바탕 + 얇은 회색 테두리 · 강조는 글자색(D-370).
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, KeyRound, LockKeyhole, LockKeyholeOpen, X } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useViewingPilot } from '../../auth/osAccess'
import { Panel } from '../ui/Panel'
import {
  CONSENT_CHANGED,
  CONSENT_DAYS,
  alwaysLine,
  consentErrorText,
  declineConsent,
  grantConsent,
  historyLine,
  koWhen,
  leftText,
  loadConsent,
  requestConsent,
  revokeConsent,
  setAlwaysView,
  type ConsentDays,
  type ConsentState,
} from '../../services/viewConsent'

/** 이 작업공간의 허락 상태 — 바뀜 알림 · 창으로 돌아올 때 · 5분마다 다시 읽는다(기한이 지나면 저절로 닫힌 것이 보이게) */
export function useViewConsent(workspaceId: string | null | undefined) {
  const [state, setState] = useState<ConsentState | null>(null)
  const alive = useRef(true)
  const refresh = useCallback(async () => {
    const r = await loadConsent(workspaceId)
    if (!alive.current) return
    if (r.status === 'ready') setState(r.state)
    else if (r.status === 'missing') setState(null)
    // 'off'(잠깐 못 물어봄) — 보이던 것 그대로
  }, [workspaceId])
  useEffect(() => {
    alive.current = true
    setState(null)
    void refresh()
    const on = () => void refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener(CONSENT_CHANGED, on)
    document.addEventListener('visibilitychange', onVis)
    const t = window.setInterval(on, 5 * 60 * 1000)
    return () => {
      alive.current = false
      window.removeEventListener(CONSENT_CHANGED, on)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(t)
    }
  }, [refresh])
  return { state, setState, refresh }
}

const DAY_LABEL: Record<ConsentDays, string> = { 1: '하루', 7: '7일', 30: '30일' }

/** 대표가 팀장 화면을 보는 동안 — 띠 아래 한 줄 */
export function ViewingConsentLine() {
  const auth = useContext(AuthContext)
  const viewing = useViewingPilot()
  const ws = viewing ? (auth?.currentWorkspaceId ?? null) : null
  const { state, setState } = useViewConsent(ws)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /** D-675 [늘 보기로 켜기] — 한 번 더 묻는 중 */
  const [confirming, setConfirming] = useState(false)
  if (!ws || !state || state.role !== 'viewer') return null
  const who = viewing ? `${viewing.personName} ${viewing.personTitle}`.trim() || '팀장' : '팀장'

  /** D-675 늘 보기 켜기 · 끄기 — 문(DB 정책)이 바뀌었으니 업체 · 서류 · 모듈 기록을 처음부터 다시 읽는다 */
  const setAlways = async (on: boolean) => {
    setBusy(true)
    setErr('')
    try {
      await setAlwaysView(ws, on)
      window.location.reload()
    } catch (e) {
      setErr(consentErrorText(e))
      setBusy(false)
    }
  }

  const ask = async () => {
    setBusy(true)
    setErr('')
    try {
      setState(await requestConsent(ws))
    } catch (e) {
      setErr(consentErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (state.always) {
    return (
      <div data-testid="viewing-consent" data-consent="always" className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 sm:px-4">
        <Eye aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="t-sub break-keep text-slate-800">
            <b>늘 보기 켜짐</b> · {koWhen(state.always.since)}부터 <span className="hidden text-slate-600 sm:inline">(허락 없이 보여요 · 팀장님 설정에도 표시돼요)</span>
          </p>
          {err && <p role="alert" className="t-sub mt-1 break-keep text-red-700">{err}</p>}
        </div>
        <button type="button" onClick={() => void setAlways(false)} disabled={busy} data-testid="viewing-consent-always-off" className="tap t-sub shrink-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50 disabled:opacity-60">
          {busy ? '끄는 중…' : '끄기'}
        </button>
      </div>
    )
  }

  if (confirming) {
    return (
      <div data-testid="viewing-consent" data-consent="confirm-always" className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
        <Eye aria-hidden="true" className="size-4 shrink-0 text-slate-700" />
        <div className="min-w-0 flex-1 basis-56">
          <p className="t-sub font-bold break-keep text-slate-900">{who} 화면의 고객 자료를 허락 없이 늘 볼까요?</p>
          <p className="t-sub mt-0.5 break-keep text-slate-700">팀장님 설정에 &lsquo;대표님이 늘 볼 수 있어요&rsquo; 로 표시되고, 켠 때 · 끈 때가 기록에 남아요. 끄는 것은 대표님만 할 수 있어요.</p>
          {err && <p role="alert" className="t-sub mt-1 break-keep text-red-700">{err}</p>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} data-testid="viewing-consent-always-cancel" className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            취소
          </button>
          <button type="button" onClick={() => void setAlways(true)} disabled={busy} data-testid="viewing-consent-always-go" className="tap t-sub rounded-(--radius-control) bg-navy-900 px-3 py-1.5 font-semibold whitespace-nowrap text-white hover:bg-navy-800 disabled:opacity-60">
            {busy ? '켜는 중…' : '늘 보기 켜기'}
          </button>
        </div>
      </div>
    )
  }

  /** D-675 내부 팀장 화면일 때만(서버가 알려 준다) — 허락을 기다리지 않고 늘 보게 */
  const alwaysButton = state.canAlways ? (
    <button type="button" onClick={() => { setErr(''); setConfirming(true) }} disabled={busy} data-testid="viewing-consent-always" data-guide="fn-view-always" className="tap t-sub shrink-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50 disabled:opacity-60">
      늘 보기로 켜기
    </button>
  ) : null

  if (state.active) {
    return (
      <div data-testid="viewing-consent" data-consent="active" className="no-print mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 sm:px-4">
        <LockKeyholeOpen aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
        <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
          <b>고객 자료 보기 허락됨</b> · {koWhen(state.active.expiresAt)}까지 <span className="text-slate-600">({leftText(state.active.expiresAt)})</span>
        </p>
        {alwaysButton}
      </div>
    )
  }

  const declined = !state.request && state.lastClosed?.closedReason === 'declined'
  return (
    <div data-testid="viewing-consent" data-consent={state.request ? 'requested' : 'closed'} className="no-print mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
      <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-slate-700" />
      <div className={`min-w-0 flex-1 ${alwaysButton ? 'basis-56' : ''}`}>
        <p className="t-sub font-bold break-keep text-slate-900">
          {state.request ? `허락 요청을 보냈어요 · ${koWhen(state.request.createdAt)}` : declined ? '지난 요청은 팀장님이 거절했어요' : '고객 자료는 팀장님이 허락해야 보여요'}
        </p>
        <p className="t-sub mt-0.5 hidden break-keep text-slate-700 sm:block">
          {state.request
            ? '팀장님이 설정에서 허락하면 바로 보여요. 그동안 업체 · 서류 · 계약은 비어 보여요.'
            : '업체 · 서류 · 계약 · 모듈 기록은 팀장님이 허락한 동안만 보여요. 마케팅 · 화면 설정은 그대로 보여요.'}
        </p>
        {err && <p role="alert" className="t-sub mt-1 break-keep text-red-700">{err}</p>}
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 empty:hidden">
        {!state.request && (
          <button type="button" onClick={() => void ask()} disabled={busy} data-testid="viewing-consent-ask" className="tap t-sub shrink-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-1.5 font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50 disabled:opacity-60">
            {busy ? '보내는 중…' : declined ? '다시 요청하기' : '허락 요청 보내기'}
          </button>
        )}
        {alwaysButton}
      </div>
    </div>
  )
}

const NOTICE_KEY = 'axmvp.viewConsent.noticeClosed'

/** 팀장 화면 맨 위 — 대표가 보낸 허락 요청(닫으면 그 요청은 다시 안 띄움) */
export function ConsentRequestNotice() {
  const auth = useContext(AuthContext)
  const mine = auth?.access === 'pilot' ? (auth.currentWorkspaceId ?? null) : null
  const { state } = useViewConsent(mine)
  const [closed, setClosed] = useState<string>(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  if (!mine || !state || state.role !== 'owner' || state.viewers === 0) return null
  const close = (at: string) => {
    setClosed(at)
    try {
      localStorage.setItem(NOTICE_KEY, at)
    } catch {
      // 저장이 막힌 브라우저 — 이번 화면에서만 닫힘
    }
  }
  // D-675 대표가 '늘 보기' 로 켜 두었다 — 허락 요청 대신 그 사실을 한 번 알린다(닫으면 그 켬은 다시 안 띄움)
  if (state.always) {
    const key = `always:${state.always.since}`
    if (closed === key) return null
    return (
      <div role="status" data-testid="consent-always-notice" className="no-print mb-4 flex items-start gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
        <Eye aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="t-sub font-bold break-keep text-slate-900">{state.always.by}님이 내 고객 자료를 &lsquo;늘 보기&rsquo; 로 정해 두었어요</p>
          <p className="t-sub mt-0.5 break-keep text-slate-700">끌 때까지는 허락하지 않아도 업체 · 서류 · 계약이 대표님에게 보여요.</p>
          <Link to="/settings?focus=consent" className="t-sub mt-1 inline-block font-semibold text-brand-700 underline" data-testid="consent-always-open">
            설정에서 보기 →
          </Link>
        </div>
        <button type="button" aria-label="알림 닫기" onClick={() => close(key)} className="tap rounded-(--radius-control) p-1 text-slate-500 hover:bg-slate-100">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    )
  }
  if (!state.request) return null
  if (closed === state.request.createdAt) return null
  const requestAt = state.request.createdAt
  return (
    <div role="status" data-testid="consent-request-notice" className="no-print mb-4 flex items-start gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
      <KeyRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="t-sub font-bold break-keep text-slate-900">{state.request.by}님이 내 고객 자료 보기를 요청했어요</p>
        <p className="t-sub mt-0.5 break-keep text-slate-700">허락하기 전에는 업체 · 서류 · 계약이 보이지 않아요. 허락해도 기간이 끝나거나 지금 닫으면 다시 안 보여요.</p>
        <Link to="/settings?focus=consent" className="t-sub mt-1 inline-block font-semibold text-brand-700 underline" data-testid="consent-request-open">
          설정에서 허락 · 거절하기 →
        </Link>
      </div>
      <button type="button" aria-label="알림 닫기" onClick={() => close(requestAt)} className="tap rounded-(--radius-control) p-1 text-slate-500 hover:bg-slate-100">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

/** 팀장 설정 — 대표님의 내 고객 자료 보기(허락 · 닫기 · 거절 · 지난 기록) */
export function ViewConsentPanel({ focus = false }: { focus?: boolean }) {
  const auth = useContext(AuthContext)
  const mine = auth?.access === 'pilot' ? (auth.currentWorkspaceId ?? null) : null
  const { state, setState } = useViewConsent(mine)
  const [days, setDays] = useState<ConsentDays>(7)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const ready = !!state && state.role === 'owner' && state.viewers > 0
  useEffect(() => {
    if (focus && ready) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus, ready])
  if (!mine || !state || state.role !== 'owner' || state.viewers === 0) return null

  const run = async (fn: () => Promise<ConsentState>) => {
    setBusy(true)
    setErr('')
    try {
      setState(await fn())
    } catch (e) {
      setErr(consentErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  // 지난 기록 — 허락 · 요청과 D-675 늘 보기(켬 · 끔)를 한 목록에 새것부터
  const lines = [
    ...state.history.map((h, i) => ({ key: `${h.kind}-${h.createdAt}-${i}`, at: h.createdAt, text: historyLine(h) })),
    ...state.alwaysHistory.map((h, i) => ({ key: `always-${h.since}-${i}`, at: h.since, text: alwaysLine(h) })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const pill = (on: boolean) =>
    `tap h-11 min-w-16 rounded-(--radius-control) border px-3 text-[0.9375rem] font-semibold whitespace-nowrap ${on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`

  return (
    <div ref={ref} id="view-consent" className="scroll-mt-20" data-testid="consent-settings" data-consent={state.always ? 'always' : state.active ? 'active' : 'closed'}>
      <Panel title="대표님의 내 고객 자료 보기">
        <p className="t-sub break-keep text-slate-700">
          대표님은 팀장님 화면을 오가며 볼 수 있어요. <b>업체 · 서류 · 계약 · 모듈 기록</b>은 {state.always ? '지금 대표님이 ‘늘 보기’ 로 정해 두어 허락 없이도 보이고' : '팀장님이 허락한 동안만 보이고'}, 마케팅 · 화면 설정은 늘 보여요.
        </p>

        {state.request && !state.always && (
          <div data-testid="consent-request-line" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-slate-100 py-3">
            <KeyRound aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-900">
              <b>{state.request.by}님</b>이 {koWhen(state.request.createdAt)}에 허락을 요청했어요.
            </p>
            <button type="button" disabled={busy} onClick={() => void run(() => declineConsent(mine))} data-testid="consent-decline" className="tap t-sub rounded-(--radius-control) border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              거절
            </button>
          </div>
        )}

        {state.always ? (
          <div className="mt-4" data-testid="consent-always">
            <p className="flex items-center gap-2 text-[0.9375rem] break-keep text-slate-900">
              <Eye aria-hidden="true" className="size-5 shrink-0 text-brand-700" />
              <span><b>대표님이 &lsquo;늘 보기&rsquo; 로 정해 두었어요</b> · {koWhen(state.always.since)}부터</span>
            </p>
            <p className="t-sub mt-2 break-keep text-slate-600">허락하지 않아도 {state.always.by}님에게 내 업체 · 서류 · 계약이 보여요. 끄는 것은 대표님만 할 수 있고, 끄면 다시 내가 허락한 동안만 보여요.</p>
          </div>
        ) : state.active ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="consent-active">
            <LockKeyholeOpen aria-hidden="true" className="size-5 shrink-0 text-brand-700" />
            <p className="min-w-0 flex-1 text-[0.9375rem] break-keep text-slate-900">
              <b>지금 허락 중</b> · {koWhen(state.active.expiresAt)}까지 <span className="text-slate-600">({leftText(state.active.expiresAt)})</span>
            </p>
            <button type="button" disabled={busy} onClick={() => void run(() => revokeConsent(mine))} data-testid="consent-revoke" className="tap h-11 rounded-(--radius-control) border border-red-300 bg-white px-4 text-[0.9375rem] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
              {busy ? '닫는 중…' : '지금 닫기'}
            </button>
          </div>
        ) : (
          <div className="mt-4" data-testid="consent-closed">
            <p className="flex items-center gap-2 text-[0.9375rem] break-keep text-slate-900">
              <LockKeyhole aria-hidden="true" className="size-5 shrink-0 text-slate-700" />
              <span><b>지금 닫혀 있어요</b> — 대표님은 고객 자료를 볼 수 없어요.</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="허락할 기간">
              {CONSENT_DAYS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} data-testid="consent-days" data-days={d} className={pill(days === d)}>
                  {DAY_LABEL[d]}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => void run(() => grantConsent(mine, days))} data-testid="consent-grant" data-guide="fn-view-consent" className="tap h-11 rounded-(--radius-control) bg-navy-900 px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-white hover:bg-navy-800 disabled:opacity-60">
                {busy ? '허락하는 중…' : `${DAY_LABEL[days]} 동안 허락하기`}
              </button>
            </div>
            <p className="t-sub mt-2 break-keep text-slate-600">기간이 끝나면 저절로 닫혀요. 허락한 뒤에도 언제든 [지금 닫기] 를 누르면 그 순간부터 안 보여요.</p>
          </div>
        )}

        {err && <p role="alert" className="t-sub mt-3 break-keep text-red-700">{err}</p>}

        {lines.length > 0 && (
          <details className="mt-4 border-t border-slate-100 pt-3" data-testid="consent-history">
            <summary className="t-sub cursor-pointer font-semibold text-slate-700">지난 기록 {lines.length}개(지우지 않고 남아요)</summary>
            <ul className="mt-2 divide-y divide-slate-100">
              {lines.map((l) => (
                <li key={l.key} className="t-sub py-2 break-keep text-slate-700">{l.text}</li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </div>
  )
}
