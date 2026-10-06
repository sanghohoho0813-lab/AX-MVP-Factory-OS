/**
 * 업체 상세 '맞춤 추천' 탭 (D-144) — 개요 왼쪽, 서류를 올리면 가장 먼저 보는 곳.
 *
 *  1. 서류 올리기(파일 · 폴더째) — 머리줄 단추와 같은 창
 *  2. 방금 올린 서류 — 바로 넣은 정보 · 확인할 정보(까닭) · 크레탑 · 명부 진단
 *  3. 확인이 필요한 정보 — 확실하지 않은 것만(사진 글자 · 지금 값과 다름 …)
 *  4. 다음 행동 추천 — 누르면 그 모듈로 · '다음 약속으로' 한 번에
 *  5. 모듈별 판정 — 정책자금 · 고용지원금 · 창업감면 · 연구소 · 크레탑 · 절세 · 지원사업(요금제에 있는 것만)
 *  6. 지금 챙길 것 · 맞는 지원사업
 *
 * 판정은 규칙 계산이다(모듈 화면과 같은 엔진) — 'AI' 라고 부르지 않는다. 선정 · 승인 가능성을 보장하지 않는다.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, Check, CircleAlert, FileUp, Sparkles } from 'lucide-react'
import type { ClientOpsRecord, OpsAlert } from '../../types/clientOps'
import { Button } from '../ui/Button'
import { Badge, Section, Surface, type Tone } from '../ui/primitives'
import { AlertRow } from './opsParts'
import { FactInboxCard } from './ClientFactsCards'
import { ClientAdvisor } from './ClientAdvisor'
import { ClientGrantsCard } from '../grants/ClientGrantsCard'
import { useGrantData } from '../grants/useGrants'
import { useEntitlements } from '../../lib/entitlementsStore'
import { buildDecisions } from '../../services/decisions'
import { DecisionList, useDecisionAnswer } from './DecisionList'
import { pendingFacts } from '../../services/customerFacts'
import { INSIGHT_TONE_LABEL, buildInsights, recommendNextSteps, type InsightTone } from '../../services/clientInsights'
import type { DocBatchSummary } from '../../services/docAutoAnalyze'
import { docShelfSummary } from '../../services/docShelf'
import { addDaysLocal, withNextAction } from '../../services/clientOpsNextAction'
import { nowIso } from '../../lib/appClock'
import { activeApplications, applyReadiness, applyStage, openApplications } from '../../services/grants/grantApply'

const TONE: Record<InsightTone, Tone> = { good: 'success', maybe: 'brand', done: 'neutral', need: 'warning', no: 'neutral' }

export default function ClientSmartTab({
  record,
  today,
  workspaceId,
  alerts,
  lastBatch,
  onUpload,
  onCommit,
  onAlertOpen,
  onFill,
  userId,
  onCommitQuiet,
}: {
  /** D-158: 확인할 것 — 할 일 만들 사람 · 알림 없이 저장(답마다 알림은 확인함이 띄운다) */
  userId?: string | null
  onCommitQuiet?: (next: ClientOpsRecord) => Promise<boolean>
  record: ClientOpsRecord
  today: string
  workspaceId: string | null
  alerts: OpsAlert[]
  lastBatch: DocBatchSummary | null
  onUpload: () => void
  onCommit: (next: ClientOpsRecord, message: string) => Promise<void>
  onAlertOpen: (a: OpsAlert) => void
  onFill: () => void
}) {
  const { ent } = useEntitlements()
  const { notices } = useGrantData(workspaceId)
  const usable = (key: string) => key === 'grants' || ent.feature(key).usable
  const insights = useMemo(() => buildInsights(record, today, notices, usable), [record, today, notices, ent]) // eslint-disable-line react-hooks/exhaustive-deps
  const pending = pendingFacts(record).length
  // D-149: 서류함 손볼 것도 다음 행동에(만료 · 기타 칸 · 겹친 서류)
  const shelf = useMemo(() => {
    const s = docShelfSummary(record, today, new Set())
    return { expired: s.expired.length, other: s.other.length, dup: s.dupGroups.length }
  }, [record, today])
  // D-151: 신청 준비 중인 지원사업의 모자란 서류
  const applying = useMemo(
    () =>
      openApplications(record).map((a) => {
        const r = applyReadiness(record, a, today)
        return { name: a.programName, daysLeft: r.daysLeft, missing: r.needFromClient.length }
      }),
    [record, today],
  )
  const feeToSet = useMemo(() => activeApplications(record).filter((a) => applyStage(a) === 'selected').map((a) => a.programName || '지원사업'), [record])
  const steps = useMemo(() => recommendNextSteps(insights, pending, shelf, applying, feeToSet), [insights, pending, shelf, applying, feeToSet])
  const good = insights.filter((i) => i.tone === 'good').length
  // D-158: 확인할 것 — 이 업체 것만(자료에서 읽은 정보는 위 '확인이 필요한 정보' 칸이 맡는다)
  const decisions = useMemo(() => buildDecisions(record, today, notices, usable).filter((d) => d.kind !== 'fact'), [record, today, notices, ent]) // eslint-disable-line react-hooks/exhaustive-deps
  const { answer, busy } = useDecisionAnswer({
    workspaceId,
    userId: userId ?? null,
    today,
    notices,
    latest: () => record,
    save: async (next) => ((await (onCommitQuiet ?? (async () => false))(next)) ? next : null),
  })

  const setNext = (text: string) => void onCommit(withNextAction(record, text, addDaysLocal(today, 3)), `다음 약속으로 걸었습니다 — ${text.slice(0, 30)}`)

  return (
    <div className="flex flex-col gap-5" data-testid="smart-tab">
      {/* 1. 서류 올리기 */}
      <Surface className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <FileUp aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="t-card font-bold break-keep text-slate-900">서류만 올리면 저절로 분석해요</p>
            <p className="t-sub break-keep text-slate-600">
              사업자등록증 · 등기 · 크레탑 보고서 · 4대보험 명부 · 인증서를 파일이나 폴더째 넣으면 회사 정보를 채우고, 아래 판정이 바로 바뀝니다.
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={onUpload} data-testid="smart-upload" className="self-start sm:self-center">
          <FileUp aria-hidden="true" className="size-4" /> 서류 올리기
        </Button>
      </Surface>

      {/* 2. 방금 올린 서류 */}
      {lastBatch && <BatchSummary batch={lastBatch} />}

      {/* 3. 확인이 필요한 정보 */}
      <FactInboxCard record={record} now={nowIso()} onCommit={onCommit} />

      {/* 3-1. D-158: 프로그램이 준비한 것 — 맞다 · 아니다만(정보 확인은 위 칸이 맡는다) */}
      {decisions.length > 0 && (
        <Section title="프로그램이 준비했어요 — 맞나요?" count={decisions.length}>
          <div data-testid="smart-decisions">
            <DecisionList decisions={decisions} busy={busy} showClient={false} onAnswer={(d, a) => void answer(d, a)} />
          </div>
        </Section>
      )}

      {/* 4. 다음 행동 */}
      <Section title="다음 행동 추천" count={steps.length}>
        {steps.length === 0 ? (
          <p className="t-sub break-keep text-slate-500">지금 추천할 행동이 없어요. 서류를 올리면 판정이 나오고 할 일을 골라 드려요.</p>
        ) : (
          <ol className="flex flex-col gap-2" data-testid="smart-steps">
            {steps.map((st, i) => (
              <li key={st.id} className="flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center" data-testid="smart-step">
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden="true" className="t-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="t-body block break-keep font-semibold text-slate-900 [overflow-wrap:anywhere]">{st.text}</span>
                    <span className="t-sub block break-keep text-slate-500 [overflow-wrap:anywhere]">{st.why}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap gap-2 pl-9 sm:pl-0">
                  {st.href?.startsWith('#') ? (
                    <Button size="sm" variant="secondary" onClick={() => document.querySelector(st.href as string)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      확인하러 가기
                    </Button>
                  ) : st.href ? (
                    <Link to={st.href} className="tap t-sub inline-flex items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-700 hover:border-brand-400">
                      열기 <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={onUpload}>
                      서류 올리기
                    </Button>
                  )}
                  {st.id !== 'facts' && (
                    <Button size="sm" variant="ghost" onClick={() => setNext(st.text)} data-testid="smart-step-next">
                      <CalendarPlus aria-hidden="true" className="size-4" /> 다음 약속으로
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* 4-1. 맞춤 상담(D-145) — 목차에서 고르거나 직접 묻기 · 이 회사 기록 · 모듈 판정으로 답한다 */}
      <ClientAdvisor record={record} today={today} notices={notices} insights={insights} onSetNext={setNext} />

      {/* 5. 모듈별 판정 */}
      <Section title="모듈별 판정" count={good}>
        <p className="t-sub -mt-1 break-keep text-slate-500">업체 정보로 각 모듈을 미리 돌려 본 결과예요 — 모듈을 따로 열지 않아도 됩니다. 규칙으로 계산한 1차 판정이며 선정 · 승인을 보장하지 않아요.</p>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="smart-insights">
          {insights.map((ins) => (
            <li key={ins.key} data-testid="smart-insight" data-key={ins.key} data-tone={ins.tone}>
              <Surface edge={TONE[ins.tone]} showEdge className="flex h-full flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-card font-bold text-slate-900">{ins.label}</span>
                  <Badge tone={TONE[ins.tone]}>{INSIGHT_TONE_LABEL[ins.tone]}</Badge>
                </div>
                <p className="t-body break-keep font-semibold text-slate-800 [overflow-wrap:anywhere]">{ins.headline}</p>
                {ins.detail && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{ins.detail}</p>}
                {ins.missing.length > 0 && (
                  <p className="t-sub flex flex-wrap items-center gap-1.5 text-slate-600">
                    <span className="text-slate-500">있으면 더 정확:</span>
                    {ins.missing.map((m) => (
                      <span key={m} className="t-meta rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 font-semibold text-warning-800">
                        {m}
                      </span>
                    ))}
                  </p>
                )}
                <Link to={ins.openPath} className="tap t-sub mt-auto inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline">
                  {ins.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Surface>
            </li>
          ))}
        </ul>
      </Section>

      {/* 6. 지금 챙길 것 */}
      {alerts.length > 0 && (
        <Section title="지금 챙길 것" count={alerts.length}>
          <ul className="flex flex-col gap-2" data-testid="smart-alerts">
            {alerts.slice(0, 6).map((a) => (
              <AlertRow key={a.id} alert={a} hideClient onOpen={() => onAlertOpen(a)} />
            ))}
          </ul>
        </Section>
      )}

      {/* 7. 맞는 지원사업 */}
      <ClientGrantsCard workspaceId={workspaceId} record={record} today={today} onFill={onFill} onCommit={onCommit} />
    </div>
  )
}

function BatchSummary({ batch }: { batch: DocBatchSummary }) {
  const time = batch.at ? new Date(batch.at).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <div data-testid="smart-batch">
    <Surface edge="success" showEdge className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5 text-success-600" />
        <h2 className="t-card font-bold text-slate-900">방금 올린 서류 {batch.files}개를 읽었어요</h2>
        {time && <span className="t-meta text-slate-500">{time}</span>}
      </div>
      {batch.entered.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="t-sub font-semibold text-success-700">바로 넣은 정보 {batch.entered.length}건</p>
          <ul className="flex flex-col gap-1" data-testid="smart-entered">
            {batch.entered.map((f, i) => (
              <li key={`${f.key}-${i}`} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep">
                <Check aria-hidden="true" className="size-4 shrink-0 self-center text-success-600" />
                <span className="w-28 shrink-0 text-slate-500">{f.label}</span>
                <span className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">{f.display}</span>
                <span className="t-meta text-slate-400">{f.fileName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {batch.flagged.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="t-sub font-semibold text-warning-800">확인이 필요한 정보 {batch.flagged.length}건 — 아래에서 맞는지 골라 주세요</p>
          <ul className="flex flex-col gap-1" data-testid="smart-flagged">
            {batch.flagged.map((f, i) => (
              <li key={`${f.key}-${i}`} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0 self-center text-warning-600" />
                <span className="w-28 shrink-0 text-slate-500">{f.label}</span>
                <span className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">{f.display}</span>
                <span className="text-warning-800">{f.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {batch.placed && batch.placed.length > 0 && (
        <details open={batch.placed.length <= 8} className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="smart-placed">
          <summary className="tap t-sub cursor-pointer font-semibold text-slate-800">
            서류함에 넣은 곳 {batch.placed.length}개{batch.placed.some((x) => x.other) ? ` · 확인 필요 ${batch.placed.filter((x) => x.other).length}` : ''}
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {batch.placed.map((x, i) => (
              <li key={`${x.fileName}-${i}`} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep">
                <span className="min-w-0 text-slate-600 [overflow-wrap:anywhere]">{x.fileName}</span>
                <span aria-hidden="true" className="text-slate-400">→</span>
                <span className={`font-semibold ${x.other ? 'text-warning-800' : 'text-slate-900'}`}>{x.label}</span>
                {x.same ? (
                  <span className="t-meta text-warning-800">(이름 · 크기가 같은 파일이 이미 있어요 — 서류 탭에서 하나 지우세요)</span>
                ) : (
                  x.numbered && <span className="t-meta text-slate-500">(같은 서류가 이미 있어 따로 둠 — 서류 탭에서 하나 지우세요)</span>
                )}
              </li>
            ))}
          </ul>
          <Link to="?tab=docs" className="tap t-sub mt-1 inline-flex items-center font-semibold text-brand-700 hover:underline">
            서류 탭에서 열어 보기
          </Link>
        </details>
      )}
      {batch.cretop && (
        <p className="t-sub break-keep text-slate-700" data-testid="smart-batch-cretop">
          <Check aria-hidden="true" className="mr-1 inline size-4 text-success-600" />
          크레탑 보고서({batch.cretop.fileName})를 분석해 붙였어요{batch.cretop.filled.length ? ` — ${batch.cretop.filled.slice(0, 5).join(' · ')} 채움` : ''}.
        </p>
      )}
      {batch.roster && (
        <p className="t-sub break-keep text-slate-700" data-testid="smart-batch-roster">
          <Check aria-hidden="true" className="mr-1 inline size-4 text-success-600" />
          4대보험 명부({batch.roster.fileName}) — 직원 {batch.roster.employees}명(재직 {batch.roster.active}) · 후보 지원금 {batch.roster.candidates}건
          {batch.roster.youthDeadlines ? ` · 청년도약 참여신청 기한 ${batch.roster.youthDeadlines}명(달력 · 오늘에 걸림)` : ''}
        </p>
      )}
      {batch.warnings.map((w) => (
        <p key={w} className="t-sub break-keep text-danger-700" role="status">
          {w}
        </p>
      ))}
      {batch.entered.length === 0 && batch.flagged.length === 0 && !batch.cretop && !batch.roster && batch.warnings.length === 0 && (
        <p className="t-sub break-keep text-slate-500">이 서류에서는 회사 정보를 더 찾지 못했어요 — 서류함에 잘 올라갔어요.</p>
      )}
    </Surface>
    </div>
  )
}
