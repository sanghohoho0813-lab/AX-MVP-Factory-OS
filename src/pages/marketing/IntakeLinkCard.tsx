/**
 * L-9 · D-609 내 상담 신청 링크 — 접힌 한 줄('글을 본 사람이 바로 신청하게 하려면?')을 누르면 주소 하나.
 *
 * 주소를 글 끝 · 프로필에 붙여 두면, 누가 이름 · 연락처를 적고 보낼 때 이 작업공간의 잠재고객(영업 관리)으로 바로 들어온다.
 * 따로 옮겨 적지 않아도 되고, 오늘 할 일에 '상담 신청 — 연락드리기' 가 뜬다(서버 0027).
 *
 * 📐 첫 화면은 한 줄(접힘). 펼치면 한 가지 일만: 링크가 없으면 [만들기] · 있으면 주소 + [주소 복사].
 *    제목 고치기 · 주소 바꾸기 · 받지 않기는 그 안에서 또 접어 둔다.
 * 서버가 0027 전이거나 작업공간 주인이 아니면(대표가 팀장 화면을 볼 때 등) 아무것도 그리지 않는다.
 * 박스는 흰 바탕 + 얇은 회색 테두리 · 강조는 글자색(D-370). 마케팅 영역이라 15px 이상 · 쉬운 말(D-507).
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, Check, Copy, ExternalLink } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { useCurrentUser } from '../../components/layout/useCurrentUser'
import { useBrandProfile } from '../../services/brandProfile'
import { copyText } from '../../services/grants/grantView'
import {
  INTAKE_CHANGED,
  defaultIntakeTitle,
  intakeErrorText,
  intakeLine,
  intakeUrl,
  koDay,
  loadIntakeLink,
  offIntakeLink,
  rotateIntakeLink,
  saveIntakeLink,
  type IntakeState,
} from '../../services/intakeLink'

/** 이 작업공간의 링크 상태 — 바뀜 알림 · 창으로 돌아올 때 다시 읽는다 */
export function useIntakeLink(workspaceId: string | null | undefined) {
  const [state, setState] = useState<IntakeState | null>(null)
  const alive = useRef(true)
  const refresh = useCallback(async () => {
    const r = await loadIntakeLink(workspaceId)
    if (!alive.current) return
    if (r.status === 'ready') setState(r.state)
    else if (r.status === 'missing') setState(null)
  }, [workspaceId])
  useEffect(() => {
    alive.current = true
    setState(null)
    void refresh()
    const on = () => void refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener(INTAKE_CHANGED, on)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive.current = false
      window.removeEventListener(INTAKE_CHANGED, on)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refresh])
  return { state, setState }
}

const btnPrimary = 'tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700 disabled:opacity-60'
const btnLine = 'tap t-body inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60'
const inputCls = 't-body w-full min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none'

export function IntakeLinkCard({ onUse, defaultOpen = false, testId = 'mk-intake' }: { onUse?: (line: string) => void; defaultOpen?: boolean; testId?: string }) {
  const auth = useContext(AuthContext)
  const ws = auth?.currentWorkspaceId ?? null
  const { state, setState } = useIntakeLink(ws)
  const me = useCurrentUser()
  const { profile, loaded } = useBrandProfile()
  const suggested = defaultIntakeTitle(me.name, loaded ? profile.company : '')
  const [title, setTitle] = useState<string | null>(null)
  const [intro, setIntro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState<'' | 'url' | 'line' | 'saved'>('')
  const [confirm, setConfirm] = useState<'' | 'rotate' | 'off'>('')
  // 마케팅 첫 화면 [내 상담 신청 링크] 로 왔으면(?open=intake) 칸이 그려지자마자 그 자리로 한 번 내려 준다(아래쪽에 있어서)
  const boxRef = useRef<HTMLDetailsElement>(null)
  const scrolled = useRef(false)
  const shown = !!ws && state?.role === 'owner'
  useEffect(() => {
    if (!defaultOpen || !shown || scrolled.current) return
    scrolled.current = true
    boxRef.current?.scrollIntoView({ block: 'start' })
  }, [defaultOpen, shown])

  if (!ws || !state || state.role !== 'owner') return null
  const link = state.link

  const run = async (fn: () => Promise<IntakeState>, after?: () => void) => {
    setBusy(true)
    setErr('')
    try {
      setState(await fn())
      setConfirm('')
      after?.()
    } catch (cause) {
      setErr(intakeErrorText(cause))
    } finally {
      setBusy(false)
    }
  }
  const copy = async (what: 'url' | 'line', text: string) => {
    if (await copyText(text)) {
      setCopied(what)
      window.setTimeout(() => setCopied((c) => (c === what ? '' : c)), 2500)
    }
  }

  return (
    <details ref={boxRef} open={defaultOpen || undefined} className="scroll-mt-24 rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId} data-link={link ? '1' : '0'}>
      <summary className="t-body flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-mk-intake">
        글을 본 사람이 바로 신청하게 하려면? <span className="font-semibold text-brand-700">내 상담 신청 링크</span>
        {link && link.received > 0 && (
          <span className="t-sub font-semibold text-slate-700" data-testid={`${testId}-count`}>
            · 받은 신청 {link.received}건
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4">
        {!link ? (
          <>
            <p className="t-body break-keep text-slate-800">
              주소 하나를 글 끝 · 프로필에 붙여 두면, 누가 이름 · 연락처를 적어 보낼 때 <strong className="font-bold text-slate-900">영업 관리의 잠재고객으로 바로 들어와요</strong>. 따로 옮겨 적지 않아도 돼요.
            </p>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 t-body text-slate-800" aria-label="이렇게 돼요" data-testid={`${testId}-steps`}>
              <li>
                <strong className="font-bold text-slate-900">1</strong> 링크 만들기
              </li>
              <li aria-hidden="true">→</li>
              <li>
                <strong className="font-bold text-slate-900">2</strong> 글 끝 · 프로필에 붙이기
              </li>
              <li aria-hidden="true">→</li>
              <li>
                <strong className="font-bold text-slate-900">3</strong> 신청이 오면 잠재고객 · 오늘 할 일에
              </li>
            </ol>
            <label className="flex flex-col gap-1">
              <span className="t-body font-semibold text-slate-800">신청 화면 맨 위에 보일 제목</span>
              <input value={title ?? suggested} onChange={(e) => setTitle(e.target.value)} maxLength={40} className={inputCls} data-testid={`${testId}-title`} />
            </label>
            <div>
              <button type="button" disabled={busy} onClick={() => void run(() => saveIntakeLink(ws, (title ?? suggested).trim(), (intro ?? '').trim()))} className={btnPrimary} data-testid={`${testId}-create`}>
                {busy ? '만드는 중…' : '내 상담 신청 링크 만들기'}
              </button>
            </div>
            {state.closed > 0 && <p className="t-sub break-keep text-slate-700">예전에 쓰던 주소 {state.closed}개는 닫혀 있어요 — 새로 만들면 새 주소가 생겨요.</p>}
          </>
        ) : (
          <>
            <p className="t-body break-keep text-slate-800">
              이 주소를 글 끝 · 프로필에 붙여 두세요. 누가 적어 보내면 <strong className="font-bold text-slate-900">잠재고객</strong>으로 바로 들어와요.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="t-body min-w-0 flex-1 basis-64 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 font-semibold break-all text-slate-900" data-testid={`${testId}-url`}>
                {intakeUrl(link.slug)}
              </code>
              <button type="button" onClick={() => void copy('url', intakeUrl(link.slug))} className={btnPrimary} data-testid={`${testId}-copy`}>
                {copied === 'url' ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied === 'url' ? '복사했어요' : '주소 복사'}
              </button>
            </div>
            <p className="t-body break-keep text-slate-800" data-testid={`${testId}-received`}>
              {link.received > 0 ? (
                <>
                  지금까지 받은 신청 <strong className="font-bold text-slate-900">{link.received}건</strong>
                  {link.lastAt ? ` · 마지막 ${koDay(link.lastAt)}` : ''}{' '}
                  <Link to="/sales/board" className="font-bold text-brand-700 underline underline-offset-2" data-testid={`${testId}-leads`}>
                    잠재고객 보기
                  </Link>
                </>
              ) : (
                '아직 받은 신청이 없어요 — 오면 영업 관리 잠재고객 칸 · 오늘 할 일에 보여요.'
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid={`${testId}-line`}>
              <p className="t-body min-w-0 flex-1 basis-56 break-keep text-slate-800">
                <span className="font-bold text-slate-900">글 끝에 붙일 한 줄 </span>
                <span className="break-all">{intakeLine(link.slug)}</span>
              </p>
              <button type="button" onClick={() => void copy('line', intakeLine(link.slug))} className={btnLine} data-testid={`${testId}-copy-line`}>
                {copied === 'line' ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                {copied === 'line' ? '복사했어요' : '이 줄 복사'}
              </button>
              {onUse && (
                <button type="button" onClick={() => onUse(intakeLine(link.slug))} className={btnLine} data-testid={`${testId}-use`}>
                  <ArrowUp aria-hidden="true" className="size-4" /> 소개 글에 이 줄 넣기
                </button>
              )}
            </div>
            <div>
              <a href={intakeUrl(link.slug)} target="_blank" rel="noopener noreferrer" className={btnLine} data-testid={`${testId}-preview`}>
                <ExternalLink aria-hidden="true" className="size-4" /> 신청 화면 미리 보기
              </a>
            </div>
            <details className="rounded-(--radius-control) border border-slate-200 bg-white" data-testid={`${testId}-more`}>
              <summary className="t-body flex min-h-11 cursor-pointer items-center rounded-(--radius-control) px-3 py-2 font-semibold text-slate-800 hover:bg-slate-50">제목 고치기 · 주소 바꾸기 · 받지 않기</summary>
              <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3">
                <label className="flex flex-col gap-1">
                  <span className="t-body font-semibold text-slate-800">맨 위 제목</span>
                  <input value={title ?? link.title} onChange={(e) => setTitle(e.target.value)} maxLength={40} className={inputCls} data-testid={`${testId}-edit-title`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="t-body font-semibold text-slate-800">
                    한 줄 소개 <span className="font-normal text-slate-700">(무엇을 도와드리는지 · 안 적어도 돼요)</span>
                  </span>
                  <input value={intro ?? link.intro} onChange={(e) => setIntro(e.target.value)} maxLength={80} placeholder="예: 정책자금 · 고용지원금 상담" className={inputCls} data-testid={`${testId}-edit-intro`} />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => saveIntakeLink(ws, (title ?? link.title).trim(), (intro ?? link.intro).trim()),
                        () => {
                          setTitle(null)
                          setIntro(null)
                          setCopied('saved')
                        },
                      )
                    }
                    className={btnLine}
                    data-testid={`${testId}-save`}
                  >
                    {copied === 'saved' ? <Check aria-hidden="true" className="size-4" /> : null}
                    {copied === 'saved' ? '저장했어요' : '저장'}
                  </button>
                </div>
                <hr className="border-slate-100" />
                {confirm === '' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => setConfirm('rotate')} className={btnLine} data-testid={`${testId}-rotate`}>
                      주소 새로 만들기
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm('off')} className={btnLine} data-testid={`${testId}-off`}>
                      받지 않기
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2" role="alertdialog" aria-label="한 번 더 확인" data-testid={`${testId}-confirm`}>
                    <p className="t-body break-keep text-danger-700">
                      {confirm === 'rotate'
                        ? '지금 주소는 바로 안 받게 돼요. 이미 붙여 둔 글 · 프로필의 주소도 새 주소로 바꿔야 해요.'
                        : '이 주소로는 더 이상 신청을 받지 않아요. 다시 받으려면 새 주소를 만들어야 해요.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => (confirm === 'rotate' ? rotateIntakeLink(ws) : offIntakeLink(ws)))}
                        className={btnLine}
                        data-testid={`${testId}-confirm-yes`}
                      >
                        {confirm === 'rotate' ? '네, 새 주소로' : '네, 받지 않기'}
                      </button>
                      <button type="button" onClick={() => setConfirm('')} className={btnLine} data-testid={`${testId}-confirm-no`}>
                        그대로 두기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </details>
          </>
        )}
        {err && (
          <p role="alert" className="t-body rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep text-danger-700" data-testid={`${testId}-error`}>
            {err}
          </p>
        )}
      </div>
    </details>
  )
}
