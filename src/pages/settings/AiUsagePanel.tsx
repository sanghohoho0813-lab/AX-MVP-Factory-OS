/**
 * SAAS-2 설정 › 이번 달 AI 사용량 — 대표가 아닌 계정(구독 고객 · 내부 팀장)이 남은 양 · 이용 권한을 본다.
 *
 *  - 서버 장부(0022 my_ai_access)가 센 값 그대로 — 화면이 세지 않는다. 매달 1일(한국 시간) 다시 채워진다.
 *  - 내부 팀장: 한도 없이 기록만(이번 달 n단위) · 구독 고객: n / m · 남은 양 · 이용 기한이 없으면 '구독 확인'
 *    (요금제의 내부 이름은 화면에 쓰지 않는다 — 가격 · 이름은 대표가 정한 뒤에. D-573).
 *  - 장부가 아직 없으면(대표가 SQL 을 적용하기 전) '준비 중' — 이때 마케팅 AI 는 닫혀 있고, 내부 팀장의 다른 AI 는 예전처럼 쓴다.
 *  - 대표 계정 · 대표가 팀장 화면으로 볼 때는 그리지 않는다(대표 AI 는 세지 않는다).
 *  - D-677 막히기 전에 알린다: 이용 기한(날짜 · 남은 날) 한 줄 · 7일 안에 끝남 / 80% 넘음 / 다 씀 / 기간 끝 → 알림 한 줄 + [문의하기].
 *    값 · 글은 services/aiAccess 한 곳(종의 한 줄과 같다). 종에서 오면(?focus=usage) 이 칸으로 내려온다.
 */
import { useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '../../components/ui/Panel'
import { AuthContext } from '../../auth/authContext'
import { AI_ACCESS_CHANGED, aiNotice, loadAiAccess, periodText, usedPct, type AiAccess } from '../../services/aiAccess'

type Usage = { state: 'loading' } | { state: 'none' } | { state: 'ok'; a: AiAccess }

export function AiUsagePanel({ focus = false }: { focus?: boolean }) {
  const auth = useContext(AuthContext)
  const access = auth?.access ?? null
  const userId = auth?.session?.user.id ?? null
  const [u, setU] = useState<Usage>({ state: 'loading' })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (access !== 'pilot') return
    let alive = true
    const read = (force: boolean) =>
      void loadAiAccess(userId, force).then((a) => {
        if (alive) setU(a ? { state: 'ok', a } : { state: 'none' })
      })
    // 설정을 열 때는 늘 새로 읽는다(방금 AI 를 쓰고 남은 양을 보러 온 것일 수 있다)
    read(true)
    const on = () => read(true)
    window.addEventListener(AI_ACCESS_CHANGED, on)
    return () => {
      alive = false
      window.removeEventListener(AI_ACCESS_CHANGED, on)
    }
  }, [access, userId])
  const ready = u.state !== 'loading'
  useEffect(() => {
    if (focus && ready) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus, ready])
  if (access !== 'pilot') return null
  const a = u.state === 'ok' ? u.a : null
  const pct = a ? (usedPct(a) ?? 0) : 0
  const notice = aiNotice(a)
  const period = a && a.kind === 'customer' ? periodText(a) : ''
  const ask = (
    <Link to="/support?from=/settings" className="t-sub font-semibold whitespace-nowrap text-brand-700 underline" data-testid="ai-usage-ask">
      문의하기 →
    </Link>
  )
  return (
    <div ref={ref} id="ai-usage" className="scroll-mt-20">
      <Panel title="이번 달 AI 사용량">
        <div className="flex flex-col gap-2" data-testid="ai-usage" data-state={u.state} data-kind={a ? a.kind : ''} data-notice={notice?.key ?? ''}>
          {u.state === 'loading' && <p className="t-sub text-slate-500">불러오는 중…</p>}
          {u.state === 'none' && (
            <p className="t-sub break-keep text-slate-600" data-testid="ai-usage-none">
              사용량 관리를 준비하고 있어요. 준비되면 여기에서 남은 양을 볼 수 있어요.
            </p>
          )}
          {a && a.kind === 'internal' && (
            <p className="t-body font-semibold text-slate-900" data-testid="ai-usage-numbers">
              {a.used.toLocaleString('ko-KR')}단위 <span className="t-sub font-normal text-slate-500">· {a.month.slice(0, 7)} · 내부 계정(한도 없이 기록만){a.marketing ? ' · 마케팅 포함' : ''}</span>
            </p>
          )}
          {a && a.kind === 'customer' && !a.active && notice && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="ai-usage-inactive">
              <p className="min-w-0 flex-1 basis-56 break-keep">
                <b className="t-body text-danger-700" data-testid="ai-usage-notice" data-key={notice.key}>{notice.title}</b>
                <span className="t-sub mt-0.5 block text-slate-700">{notice.detail} 다시 쓰려면 문의하기로 알려 주세요.</span>
              </p>
              {ask}
            </div>
          )}
          {a && a.kind === 'customer' && a.active && a.limit !== null && (
            <>
              <p className="t-body font-semibold text-slate-900" data-testid="ai-usage-numbers">
                {a.used.toLocaleString('ko-KR')} / {a.limit.toLocaleString('ko-KR')} <span className="t-sub font-normal text-slate-500">단위 · {a.month.slice(0, 7)}{` · 남은 양 ${Math.max(0, a.limit - a.used).toLocaleString('ko-KR')}`}{a.marketing ? ' · 마케팅 포함' : ''}</span>
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="이번 달 AI 사용량">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
              </div>
              {period && (
                <p className="t-sub break-keep text-slate-700" data-testid="ai-usage-period">
                  이용 기한 <b className="font-semibold text-slate-900">{period}</b>
                </p>
              )}
              {notice && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 basis-56 break-keep">
                    <b className={`t-sub ${notice.tone === 'danger' ? 'text-danger-700' : 'text-slate-900'}`} data-testid="ai-usage-notice" data-key={notice.key}>{notice.title}</b>
                    <span className="t-sub block text-slate-700">{notice.detail}{notice.key === 'low' ? '' : ' 더 쓰려면 문의하기로 알려 주세요.'}</span>
                  </p>
                  {notice.key !== 'low' && ask}
                </div>
              )}
            </>
          )}
          {a && (a.kind === 'internal' || a.active) && (
            <p className="t-meta break-keep text-slate-500">빠른 답 1 · 보통 3 · 깊은 답 10단위, 글 쓰기 단추는 두 배예요. AI 가 답하지 못한 요청은 세지 않아요. 매달 1일 다시 채워집니다.</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
