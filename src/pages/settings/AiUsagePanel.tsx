/**
 * SAAS-2 설정 › 이번 달 AI 사용량 — 대표가 아닌 계정(구독 고객 · 내부 팀장)이 남은 양 · 이용 권한을 본다.
 *
 *  - 서버 장부(0022 my_ai_access)가 센 값 그대로 — 화면이 세지 않는다. 매달 1일(한국 시간) 다시 채워진다.
 *  - 내부 팀장: 한도 없이 기록만(이번 달 n단위) · 구독 고객: 요금제 · n / m · 이용 기한이 없으면 '구독 확인'.
 *  - 장부가 아직 없으면(대표가 SQL 을 적용하기 전) '준비 중' — 이때 마케팅 AI 는 닫혀 있고, 내부 팀장의 다른 AI 는 예전처럼 쓴다.
 *  - 대표 계정 · 대표가 팀장 화면으로 볼 때는 그리지 않는다(대표 AI 는 세지 않는다).
 */
import { useContext, useEffect, useState } from 'react'
import { Panel } from '../../components/ui/Panel'
import { AuthContext } from '../../auth/authContext'
import { getSupabaseClient } from '../../lib/supabase/client'

type Usage =
  | { state: 'loading' }
  | { state: 'none' }
  | { state: 'ok'; kind: 'internal' | 'customer'; plan: string; active: boolean; marketing: boolean; used: number; limit: number | null; month: string }

export function AiUsagePanel() {
  const access = useContext(AuthContext)?.access ?? null
  const [u, setU] = useState<Usage>({ state: 'loading' })
  useEffect(() => {
    if (access !== 'pilot') return
    let alive = true
    getSupabaseClient()
      .rpc('my_ai_access')
      .then(({ data, error }) => {
        if (!alive) return
        const d = (data ?? null) as { configured?: boolean; kind?: string; plan?: string; active?: boolean; marketing?: boolean; used?: number; limit?: number | null; month?: string } | null
        if (error || !d || !d.configured || (d.kind !== 'internal' && d.kind !== 'customer')) return setU({ state: 'none' })
        setU({ state: 'ok', kind: d.kind, plan: String(d.plan ?? ''), active: d.active === true, marketing: d.marketing === true, used: Number(d.used) || 0, limit: d.limit === null || d.limit === undefined ? null : Number(d.limit) || 0, month: String(d.month ?? '') })
      }, () => alive && setU({ state: 'none' }))
    return () => {
      alive = false
    }
  }, [access])
  if (access !== 'pilot') return null
  const pct = u.state === 'ok' && u.limit !== null && u.limit > 0 ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0
  return (
    <Panel title="이번 달 AI 사용량">
      <div className="flex flex-col gap-2" data-testid="ai-usage" data-state={u.state} data-kind={u.state === 'ok' ? u.kind : ''}>
        {u.state === 'loading' && <p className="t-sub text-slate-500">불러오는 중…</p>}
        {u.state === 'none' && (
          <p className="t-sub break-keep text-slate-600" data-testid="ai-usage-none">
            사용량 관리를 준비하고 있어요. 준비되면 여기에서 남은 양을 볼 수 있어요.
          </p>
        )}
        {u.state === 'ok' && u.kind === 'internal' && (
          <p className="t-body font-semibold text-slate-900" data-testid="ai-usage-numbers">
            {u.used.toLocaleString('ko-KR')}단위 <span className="t-sub font-normal text-slate-500">· {u.month.slice(0, 7)} · 내부 계정(한도 없이 기록만){u.marketing ? ' · 마케팅 포함' : ''}</span>
          </p>
        )}
        {u.state === 'ok' && u.kind === 'customer' && !u.active && (
          <p className="t-sub break-keep text-warning-800" data-testid="ai-usage-inactive">
            이용 기간이 끝났거나 요금제가 아직 없어요. 구독을 확인해 주세요(AI 기능은 그동안 쉬어요).
          </p>
        )}
        {u.state === 'ok' && u.kind === 'customer' && u.active && u.limit !== null && (
          <>
            <p className="t-body font-semibold text-slate-900" data-testid="ai-usage-numbers">
              {u.used.toLocaleString('ko-KR')} / {u.limit.toLocaleString('ko-KR')} <span className="t-sub font-normal text-slate-500">단위 · {u.month.slice(0, 7)}{u.plan && u.plan !== 'none' ? ` · ${u.plan}` : ''}{u.marketing ? ' · 마케팅 포함' : ''}</span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="이번 달 AI 사용량">
              <div className={`h-full rounded-full ${pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {u.state === 'ok' && (u.kind === 'internal' || u.active) && (
          <p className="t-meta break-keep text-slate-500">빠른 답 1 · 보통 3 · 깊은 답 10단위, 글 쓰기 단추는 두 배예요. AI 가 답하지 못한 요청은 세지 않아요. 매달 1일 다시 채워집니다.</p>
        )}
      </div>
    </Panel>
  )
}
