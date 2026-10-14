/**
 * /ai/usage — 이번 달 AI 사용량(대표 전용). 호출 수 · 빠르게/보통/깊게 · 토큰 · 예상 비용(가격을 설정했을 때만).
 * 복잡한 대시보드가 아니라 한 장 표.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { monthUsage, usageMonths } from '../../services/ownerAi/usage'
import { OwnerAiSetupError } from '../../services/ownerAi/repo'
import type { AiRun } from '../../services/ownerAi/types'
import { todayLocalDate } from '../../lib/appClock'
import { MetricTile, ScreenTitle, Surface } from '../../components/ui/primitives'
import { OwnerAiGate, fmtUsd, useOwnerAiRepo } from './shared'

export default function OwnerAiUsagePage() {
  return (
    <OwnerAiGate>
      <Usage />
    </OwnerAiGate>
  )
}

function Usage() {
  const repo = useOwnerAiRepo()
  const today = todayLocalDate()
  const [runs, setRuns] = useState<AiRun[] | null>(null)
  const [dbSetup, setDbSetup] = useState(false)
  const [month, setMonth] = useState(today.slice(0, 7))
  useEffect(() => {
    let alive = true
    const since = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString()
    repo
      .listRunsSince(since)
      .then((l) => alive && setRuns(l))
      .catch((e) => {
        if (!alive) return
        if (e instanceof OwnerAiSetupError) setDbSetup(true)
        setRuns([])
      })
    return () => {
      alive = false
    }
  }, [repo])
  const months = useMemo(() => usageMonths(runs ?? [], today), [runs, today])
  const u = useMemo(() => monthUsage(runs ?? [], month), [runs, month])
  const pasted = (runs ?? []).filter((r) => r.tier === 'manual' && r.createdAt.slice(0, 7) === month).length

  return (
    <div className="flex flex-col gap-4">
      <Link to="/ai" className="t-sub tap inline-flex min-h-11 items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900">
        <ChevronLeft aria-hidden="true" className="size-4" />
        AI 작업실
      </Link>
      <ScreenTitle
        title="AI 사용량"
        sub="예상 비용은 서버에 모델 가격(AI_PRICE_*)을 넣었을 때만 셉니다 — 넣지 않으면 '가격 미설정'"
        actions={
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="t-body min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" aria-label="달 고르기" data-testid="usage-month">
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        }
      />
      {dbSetup && (
        <Surface>
          <p className="t-body font-semibold text-slate-900">AI 작업실 DB 설정이 필요합니다.</p>
        </Surface>
      )}
      {runs === null ? (
        <p className="t-sub text-slate-500" role="status">불러오는 중…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="usage-tiles">
            <MetricTile label="AI 호출" value={`${u.calls}번`} hint={`실패 ${u.failed} · 붙여넣기 ${pasted}`} hintOnMobile />
            <MetricTile label="빠르게 · 보통 · 깊게" value={`${u.byTier.cheap} · ${u.byTier.standard} · ${u.byTier.deep}`} hint="깊게는 비용이 큰 모델" hintOnMobile />
            <MetricTile label="토큰(입력 · 출력)" value={`${(u.inputTokens / 1000).toFixed(1)}k · ${(u.outputTokens / 1000).toFixed(1)}k`} />
            <MetricTile label="예상 비용" value={u.calls === 0 ? '$0' : u.costUnknownCalls === u.calls ? '가격 미설정' : fmtUsd(u.costUsd)} hint={u.costUnknownCalls ? `가격 모르는 호출 ${u.costUnknownCalls}번 제외` : '가격 설정한 모델 기준'} hintOnMobile />
          </div>
          <Surface padded={false}>
            <div className="overflow-x-auto">
              <table className="t-sub w-full min-w-[28rem] text-left" data-testid="usage-skills">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">작업</th>
                    <th className="px-3 py-2.5 text-right font-semibold">호출</th>
                    <th className="px-3 py-2.5 text-right font-semibold">채택</th>
                    <th className="px-4 py-2.5 text-right font-semibold">폐기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {u.bySkill.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">이 달에는 AI 호출이 없습니다.</td>
                    </tr>
                  ) : (
                    u.bySkill.map((s) => (
                      <tr key={s.skillId}>
                        <td className="px-4 py-2.5 text-slate-800">{s.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.calls}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{s.adopted}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.rejected}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Surface>
          <p className="t-meta break-keep text-slate-500">채택 · 폐기 비율은 어떤 작업이 실제로 쓸모 있었는지 보는 데 씁니다. 서버는 1분 6번 · 1시간 60번 · 하루 '깊게' 40번까지 받습니다(넘으면 잠시 뒤 다시).</p>
        </>
      )}
    </div>
  )
}
