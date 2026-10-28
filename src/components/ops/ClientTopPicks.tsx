/**
 * 이 업체에 먼저 제안할 것 (D-190) — 업체 상세 맨 위, 크게.
 *
 * 대표 지시(고도화 최종 목표 2): 서류가 다 들어오면 모듈 추천이 먼저 — 맞는 모듈을 알아서 싹 다 추천하고, 눈에 잘 띄게.
 *  - 맞춤 추천 탭의 '모듈별 판정' 과 같은 엔진(buildInsights) — 가능성 높음 · 검토해 볼 만함만, 좋은 것 먼저 3개.
 *  - 카드 하나를 누르면 그 모듈이 이 업체로 열린다(업체 숫자가 미리 채워진 채로).
 *  - 제안할 것이 없으면 무엇을 받으면 판정이 나오는지 + [서류 올리기].
 * 규칙 계산이다 — 'AI' 라고 부르지 않는다. 선정 · 승인을 보장하지 않는다.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileUp, History, Send, Sparkles } from 'lucide-react'
import { activityTimeText } from '../../services/clientOpsActivity'
import type { ClientOpsRecord } from '../../types/clientOps'
import { Badge, type Tone } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useEntitlements } from '../../lib/entitlementsStore'
import { useGrantNotices } from '../grants/useGrants'
import { INSIGHT_TONE_LABEL, buildInsights, isPick, missingForPicks, topPicks, type Insight, type InsightTone } from '../../services/clientInsights'
import { recoRequestMessage } from '../../services/recoRequest'
import { HintTip } from '../ui/fold'
import { hintFor } from '../../content/sectionHints'

const TONE: Record<InsightTone, Tone> = { good: 'success', maybe: 'brand', done: 'neutral', need: 'warning', no: 'neutral' }

/** 이미 계산한 판정으로 그린다(맞춤 추천 탭은 자기 판정을 넘긴다) */
export function TopPicksCard({
  insights,
  onUpload,
  onShowAll,
  showUpload = true,
  onRequest,
  onPickRequest,
}: {
  insights: readonly Insight[]
  onUpload: () => void
  onShowAll?: () => void
  showUpload?: boolean
  /** D-191: '받으면 더 추천' → 고객에게 보낼 자료 요청 문구(없으면 단추를 그리지 않는다) */
  onRequest?: () => void
  /** D-313: 제안할 모듈의 '아직 받을 서류' 문구(정책자금 신청 서류) — 없으면 단추를 그리지 않는다 */
  onPickRequest?: (pick: Insight) => void
}) {
  const picks = topPicks(insights)
  const more = insights.filter(isPick).length - picks.length
  const need = missingForPicks(insights)
  return (
    <section data-testid="top-picks" aria-labelledby="top-picks-title" className="rounded-(--radius-panel) border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Sparkles aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
        {/* D-192: 설명은 화면에 깔지 않고 ⓘ · 마우스를 올리면 */}
        <HintTip tip={hintFor('이 업체에 먼저 제안할 것')} label="이 업체에 먼저 제안할 것">
          <h2 id="top-picks-title" className="text-[1.15rem] font-bold break-keep text-slate-900">
            이 업체에 먼저 제안할 것
          </h2>
        </HintTip>
        {onShowAll && insights.length > 0 && (
          <button type="button" onClick={onShowAll} data-testid="top-picks-all" className="tap t-sub ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            모듈별 판정 {insights.length}개 <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {picks.length > 0 ? (
        <>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3" data-testid="top-pick-list">
          {picks.map((p, i) => (
            <li key={p.key} className="min-w-0" data-testid="top-pick" data-key={p.key} data-tone={p.tone}>
              <Link
                to={p.openPath}
                className="tap group flex h-full flex-col gap-1.5 rounded-(--radius-card) border border-slate-200 bg-white px-3.5 py-3 hover:border-brand-400 hover:shadow-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="t-card font-bold text-slate-900">{p.label}</span>
                  <Badge tone={TONE[p.tone]}>{INSIGHT_TONE_LABEL[p.tone]}</Badge>
                </span>
                <span className="t-sub line-clamp-3 break-keep text-slate-700 [overflow-wrap:anywhere]">{p.headline}</span>
                {/* D-191: 엔진이 계산한 금액만(명부 진단 최대 지원금 · 세액공제 · 공고 금액 글) */}
                {p.amount && (
                  <span data-testid="top-pick-amount" className="t-sub font-bold break-keep text-success-700 [overflow-wrap:anywhere]">
                    {p.amount}
                  </span>
                )}
                {/* D-238: 이미 해 본 모듈이면 지난번 결과 · 언제 — 처음부터 다시 하지 않고 이어서 */}
                {p.last && (
                  <span data-testid="top-pick-last" className="t-meta flex items-start gap-1 break-keep text-slate-600 [overflow-wrap:anywhere]">
                    <History aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0 line-clamp-2">
                      지난번 {p.last.label} · {activityTimeText(p.last.at)}
                    </span>
                  </span>
                )}
                <span className="t-sub mt-auto inline-flex items-center gap-1 pt-0.5 font-semibold text-brand-700 group-hover:underline">
                  {p.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {/* D-313 제안할 모듈이 판정 났으면 — 아직 받을 신청 서류를 카톡 문구로(카드는 통째로 링크라 단추는 아래 줄에) */}
        {onPickRequest && picks.some((p) => p.request) && (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="top-pick-requests">
            {picks
              .filter((p) => p.request)
              .map((p) => (
                <Button key={p.key} size="sm" variant="secondary" onClick={() => onPickRequest(p)} data-testid="top-pick-request" data-key={p.key}>
                  <Send aria-hidden="true" className="size-4 shrink-0" /> {p.label} 신청 서류 {p.request!.count}가지 요청
                </Button>
              ))}
          </div>
        )}
        </>
      ) : (
        <p className="t-body mt-2 break-keep text-slate-700" data-testid="top-picks-none">
          지금 바로 제안할 모듈은 아직 없어요.{need.length > 0 ? ' 아래 서류 · 정보를 받으면 판정이 바로 나와요.' : ''}
        </p>
      )}

      {(more > 0 || need.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {more > 0 && onShowAll && (
            <button type="button" onClick={onShowAll} className="tap t-sub font-semibold text-slate-600 hover:text-brand-700 hover:underline">
              검토할 모듈 {more}개 더
            </button>
          )}
          {need.length > 0 && (
            <span className="t-sub flex min-w-0 flex-wrap items-center gap-1.5 text-slate-600" data-testid="top-picks-need">
              <span className="text-slate-500">받으면 더 추천:</span>
              {need.map((m) => (
                <span key={m} className="t-meta rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 font-semibold break-keep text-warning-800">
                  {m}
                </span>
              ))}
            </span>
          )}
          {/* D-191: 빠진 자료를 고객에게 — 어디서 떼는지 · 왜 필요한지 붙은 카톡 문구 */}
          {need.length > 0 && onRequest && (
            <Button size="sm" variant="secondary" onClick={onRequest} data-testid="top-picks-request">
              <Send aria-hidden="true" className="size-4" /> 요청 문구
            </Button>
          )}
          {/* 서류 올리기 단추는 제안할 것이 아직 없을 때만 — 있으면 머리줄 [서류 올리기] 와 겹친다 */}
          {need.length > 0 && picks.length === 0 && showUpload && (
            <Button size="sm" variant="primary" onClick={onUpload} className="sm:ml-auto" data-testid="top-picks-upload">
              <FileUp aria-hidden="true" className="size-4" /> 서류 올리기
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/** 개요 탭 맨 위 — 판정을 스스로 계산한다(공고 · 요금제 권한 포함) */
export default function ClientTopPicks({
  record,
  today,
  workspaceId,
  onUpload,
  onShowAll,
  onRequestText,
}: {
  record: ClientOpsRecord
  today: string
  workspaceId: string | null
  onUpload: () => void
  onShowAll: () => void
  onRequestText?: (text: string, meta?: { title: string; description: string }) => void
}) {
  const { ent } = useEntitlements()
  const notices = useGrantNotices(workspaceId)
  const insights = useMemo(() => buildInsights(record, today, notices, (key) => key === 'grants' || ent.feature(key).usable), [record, today, notices, ent])
  const text = useMemo(() => recoRequestMessage(record, insights), [record, insights])
  return (
    <TopPicksCard
      insights={insights}
      onUpload={onUpload}
      onShowAll={onShowAll}
      onRequest={onRequestText && text ? () => onRequestText(text) : undefined}
      onPickRequest={onRequestText ? (p) => p.request && onRequestText(p.request.text, { title: p.request.title, description: p.request.description }) : undefined}
    />
  )
}
