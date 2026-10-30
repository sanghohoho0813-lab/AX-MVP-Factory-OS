/**
 * D-354 업체로 연 모듈 첫 화면 — 맨 위 '이 업체' 한 장.
 * 예전엔 업체를 골라 들어와도 첫 화면이 고객 전체 숫자(업체 5곳 · 서류 빠진 업체 5곳)부터 보여, 이 업체가 지금 어떤지 · 다음에 무엇을 누를지를 찾아야 했다.
 *  - 맞춤 추천 탭과 같은 판정(buildInsights — 이 모듈 하나만) · 같은 말 · 같은 금액(엔진이 계산한 것만).
 *  - 판정에 더 필요한 것 · 이 모듈에 빠진 서류 → [서류함에서 올리기] · 다음 단추 하나([정책자금 진단] 같은 그 판정의 길).
 *  - 이 업체에 붙인 이 모듈의 최근 결과 · 기한(있을 때만). 규칙 계산이다 — AI 아님.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CalendarClock, FileWarning } from 'lucide-react'
import { buildInsights, INSIGHT_TONE_LABEL, type InsightTone } from '../../services/clientInsights'
import { toolOf } from '../../config/toolRegistry'
import { toolReadiness } from '../../services/toolReadiness'
import { todayLocalDate } from '../../lib/appClock'
import { daysLeftFrom } from '../../services/clientOpsAlerts'
import { useToolClient } from './toolClientContext'

const TONE: Record<InsightTone, string> = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  maybe: 'border-sky-300 bg-sky-50 text-sky-800',
  need: 'border-amber-300 bg-amber-50 text-amber-800',
  done: 'border-slate-300 bg-slate-50 text-slate-700',
  no: 'border-slate-200 bg-white text-slate-500',
}

export function ModuleClientFocus({ toolKey }: { toolKey: string }) {
  const { clientId, clientRecord } = useToolClient()
  const today = todayLocalDate()
  const tool = toolOf(toolKey)
  const view = useMemo(() => {
    if (!clientRecord) return null
    const insight = buildInsights(clientRecord, today, [], (k) => k === toolKey)[0] ?? null
    const ready = tool ? toolReadiness(clientRecord, tool, today) : null
    const results = clientRecord.toolResults.filter((r) => r.toolKey === toolKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const dues = results
      .flatMap((r) => r.deadlines)
      .map((d) => ({ ...d, left: daysLeftFrom(today, d.date) }))
      .filter((d) => d.left !== null && d.left >= -30)
      .sort((a, b) => a.date.localeCompare(b.date))
    return { insight, missingDocs: ready && !ready.ready ? ready.missing.map((m) => m.label) : [], last: results[0] ?? null, dues }
  }, [clientRecord, today, tool, toolKey])
  if (!clientId || !clientRecord || !view) return null
  const { insight, missingDocs, last, dues } = view
  const name = clientRecord.companyName || '이 업체'
  // 판정에 더 필요한 것과 모듈 서류가 겹치면 한 번만
  const need = [...new Set([...(insight?.missing ?? []), ...missingDocs])]
  return (
    <section className="no-print flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white p-3 sm:p-4" data-testid="module-client-focus" data-tone={insight?.tone ?? ''} aria-label={`${name} — ${tool?.label ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Building2 aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
        <h2 className="t-section min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere]">
          {name} · {insight?.label ?? tool?.label ?? '이 모듈'}
        </h2>
        {insight && <span className={`t-meta shrink-0 rounded-full border px-2 py-0.5 font-bold whitespace-nowrap ${TONE[insight.tone]}`}>{INSIGHT_TONE_LABEL[insight.tone]}</span>}
      </div>
      {insight && (
        <div className="flex flex-col gap-0.5">
          <p className="t-body font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="module-client-focus-headline">
            {insight.headline}
          </p>
          {insight.amount && <p className="t-body font-bold break-keep text-emerald-800">{insight.amount}</p>}
          {insight.detail && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{insight.detail}</p>}
          {insight.last && (
            <p className="t-meta text-slate-500">
              지난번: {insight.last.label} · {insight.last.at.slice(0, 10)}
            </p>
          )}
        </div>
      )}
      {need.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="module-client-focus-need">
          <FileWarning aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
          <span className="t-sub min-w-[10rem] flex-1 break-keep text-amber-900">
            <b>더 필요한 것</b> · {need.join(' · ')}
          </span>
          <Link to={`/ops/clients/${clientId}?tab=docs`} className="tap t-sub inline-flex shrink-0 items-center gap-1 font-semibold text-amber-900 hover:underline" data-testid="module-client-focus-docs">
            서류함에서 올리기 <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
      {dues.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="module-client-focus-dues">
          {dues.slice(0, 3).map((d, i) => (
            <li key={`${d.date}-${i}`} className="t-sub flex flex-wrap items-center gap-x-2 text-slate-700">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
              <span className="font-semibold">{d.date}</span>
              <span className="min-w-0 break-keep">{d.title}</span>
              <span className={`t-meta font-bold ${d.left !== null && d.left < 0 ? 'text-danger-700' : d.left !== null && d.left <= 14 ? 'text-warning-700' : 'text-slate-500'}`}>
                {d.left === null ? '' : d.left < 0 ? `${-d.left}일 지남` : d.left === 0 ? '오늘' : `${d.left}일 남음`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!insight && !last && <p className="t-sub text-slate-600">아직 이 업체로 이 모듈을 돌린 결과가 없어요 — 목차에서 화면을 골라 시작하세요.</p>}
      {insight && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={insight.openPath}
            className="tap t-body inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-700 sm:min-h-10"
            data-testid="module-client-focus-go"
          >
            {insight.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link to={`/ops/clients/${clientId}?tab=smart`} className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline" data-testid="module-client-focus-all">
            이 업체 맞춤 추천 전체
          </Link>
        </div>
      )}
    </section>
  )
}
