/**
 * D-618 AI 도우미에 모듈(연구소 · 정책자금 · 고용지원금 …)을 물었을 때, AI 답 위에 고정하는 '이 업체 판정'.
 *
 * 대표: "AI 도우미 답이 실제 모듈 결과랑 따로따로인 것 같다 — 사실상 똑같은 결과가 딱 나와 줬으면."
 * → 판정은 AI 가 새로 만들지 않는다. 맞춤 추천 카드 · 모듈 화면과 같은 판정 줄(규칙 계산)을 그대로 먼저 보여 주고,
 *   AI 답은 그 아래에서 풀어 쓴 설명만 한다. AI 가 느리거나 실패해도 판정 줄은 바로 보인다.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { Insight, InsightTone } from '../../services/clientInsights'
import { verdictsForAsk } from '../../services/homeAsk/homeAsk'
import { featureUsable, useEntitlements } from '../../lib/entitlementsStore'
import { Badge, type Tone } from '../ui/primitives'

const TONE: Record<InsightTone, Tone> = { good: 'success', maybe: 'brand', done: 'neutral', need: 'warning', no: 'neutral' }

export type VerdictRow = Pick<Insight, 'key' | 'label' | 'tone' | 'headline' | 'missing' | 'openPath' | 'openLabel' | 'amount'> & { toneLabel: string }

/** 판정 줄 그대로 — 고르기만 한다(글을 바꾸지 않는다) */
export function verdictRows(ask: string, insights: readonly Insight[], toneLabel: Record<InsightTone, string>): VerdictRow[] {
  return verdictsForAsk(ask, insights).map((x) => ({ key: x.key, label: x.label, tone: x.tone, headline: x.headline, missing: x.missing, openPath: x.openPath, openLabel: x.openLabel, amount: x.amount, toneLabel: toneLabel[x.tone] }))
}

export function AskVerdictPin({ rows }: { rows: readonly VerdictRow[] }) {
  if (!rows.length) return null
  return (
    <section aria-label="이 업체 판정" data-testid="ask-verdict-pin" className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5">
      <p className="t-meta font-semibold break-keep text-slate-600">이 업체 판정 — 모듈 화면과 같은 글이에요(규칙 계산)</p>
      <ul className="flex min-w-0 flex-col gap-3">
        {rows.map((x) => (
          <li key={x.key} data-testid="ask-verdict-row" data-key={x.key} className="flex min-w-0 flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="t-body font-bold text-slate-900">{x.label}</span>
              <Badge tone={TONE[x.tone]}>{x.toneLabel}</Badge>
            </p>
            <p className="t-body font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="ask-verdict-headline">
              {x.headline}
            </p>
            {x.amount && <p className="t-sub font-bold break-keep text-success-700">{x.amount}</p>}
            {x.missing.length > 0 && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">더 필요한 것 · {x.missing.slice(0, 4).join(' · ')}</p>}
            <Link
              to={x.openPath}
              data-testid="ask-verdict-open"
              className="tap t-sub inline-flex min-h-10 items-center gap-1 self-start rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-1 font-semibold break-keep text-brand-800 hover:border-brand-400"
            >
              {x.openLabel}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 머리줄 [AI 도우미] 단추용 — 판정 엔진(큰 파일)은 모듈을 물어봤을 때만 받는다(D-479: 업체 상세 첫 화면을 무겁게 하지 않는다).
 */
export function AskVerdictPinLazy({ ask, record, today }: { ask: string; record: ClientOpsRecord; today: string }) {
  const { ent } = useEntitlements()
  const [rows, setRows] = useState<VerdictRow[]>([])
  // 질문에 모듈 이름이 있는지는 가볍게 먼저 본다 — 없으면 판정 엔진을 받지 않는다
  const asksModule = verdictsForAsk(ask, [{ key: 'policy-funding' }, { key: 'employment' }, { key: 'labcare' }, { key: 'tax' }, { key: 'startup-tax' }, { key: 'grants' }]).length > 0
  useEffect(() => {
    if (!asksModule) return
    let alive = true
    void import('../../services/clientInsights').then(({ buildInsights, INSIGHT_TONE_LABEL }) => {
      if (alive) setRows(verdictRows(ask, buildInsights(record, today, [], (k) => featureUsable(ent, k)), INSIGHT_TONE_LABEL))
    })
    return () => {
      alive = false
    }
  }, [asksModule, ask, record, today, ent])
  return asksModule ? <AskVerdictPin rows={rows} /> : null
}
