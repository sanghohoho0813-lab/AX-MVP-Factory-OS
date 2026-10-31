/**
 * 업체 상세 '맞춤 추천' 탭 (D-144) — 개요 왼쪽, 서류를 올리면 가장 먼저 보는 곳.
 *
 *  0. D-190: 이 업체에 먼저 제안할 것 — 모듈 판정 중 좋은 것 3개를 맨 위에 크게(누르면 그 모듈)
 *  1. 서류 올리기(파일 · 폴더째) — 머리줄 단추와 같은 창
 *  2. 방금 올린 서류 — 바로 넣은 정보 · 확인할 정보(까닭) · 크레탑 · 명부 진단
 *  3. 확인이 필요한 정보 — 확실하지 않은 것만(사진 글자 · 지금 값과 다름 …)
 *  4. 다음 행동 추천 — 누르면 그 모듈로 · '다음 약속으로' 한 번에
 *  4-0. D-242 상황별 한 장 설계서 — 청년 채용 · 만 60세 이상 채용 · 연구소(사람 수) → 여러 모듈을 한 장 · 붙이면 할 일로
 *  5. 모듈별 판정 — 정책자금 · 고용지원금 · 창업감면 · 연구소 · 크레탑 · 절세 · 지원사업(요금제에 있는 것만)
 *  6. 지금 챙길 것 · 맞는 지원사업
 *
 * 판정은 규칙 계산이다(모듈 화면과 같은 엔진) — 'AI' 라고 부르지 않는다. 선정 · 승인 가능성을 보장하지 않는다.
 */
import { AiAssist } from '../ai/AiAssist'
import { clientBundle } from '../../services/aiAssist/builders'
import { buildClientSchedule } from '../../services/clientOpsSchedule'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarPlus, Check, CircleAlert, FileUp, History, MessageSquareText, Sparkles } from 'lucide-react'
import { activityTimeText } from '../../services/clientOpsActivity'
import { latestToolResult } from '../../services/toolResultGroups'
import { useIsPilot } from '../../auth/osAccess'
import type { ClientOpsRecord, OpsAlert } from '../../types/clientOps'
import { Button } from '../ui/Button'
import { Badge, Section, Surface, type Tone } from '../ui/primitives'
import { AlertRow } from './opsParts'
import { FactInboxCard } from './ClientFactsCards'
import { ClientAdvisor } from './ClientAdvisor'
import { ClientGrantsCard } from '../grants/ClientGrantsCard'
import { TopPicksCard } from './ClientTopPicks'
import { ClientScenarios } from './ClientScenarios'
import { ClientSituationPlan } from './ClientSituationPlan'
import { ClientDiagnosisSheet } from './ClientDiagnosisSheet'
import { diagnosisNote } from '../../services/clientDiagnosis'
import { SITUATION_PLANS, planResultInput, type PlanId, type SituationPlan } from '../../services/situationPlan'
import { withToolResult } from '../../services/clientOpsService'
import { withScenarioAnswer } from '../../services/scenarioFit'
import { Fold, FoldAllButton, HintTip, openFold } from '../ui/fold'
import { hintFor } from '../../content/sectionHints'
import { recoRequestMessage } from '../../services/recoRequest'
import { useGrantData } from '../grants/useGrants'
import { useEntitlements } from '../../lib/entitlementsStore'
import { buildDecisions } from '../../services/decisions'
import { DecisionList, useDecisionAnswer } from './DecisionList'
import { pendingFacts } from '../../services/customerFacts'
import { INSIGHT_TONE_LABEL, buildInsights, insightChanges, recommendNextSteps, type Insight, type InsightTone } from '../../services/clientInsights'
import { batchOfLog, type DocBatchSummary } from '../../services/docAutoAnalyze'
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
  onRequestText,
}: {
  /** D-191: '받으면 더 추천' 자료 요청 문구를 띄운다(업체 상세의 문구 창) · D-313 제목 · 설명이 다른 문구(정책자금 신청 서류)는 meta 로 */
  onRequestText?: (text: string, meta?: { title: string; description: string }) => void
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
  // D-161: 되돌리기는 알림이 뜬 뒤에 누른다 — 그때의 기록 위에 되돌린다
  const recordRef = useRef(record)
  recordRef.current = record
  const { notices, linkOf } = useGrantData(workspaceId)
  const usable = (key: string) => key === 'grants' || ent.feature(key).usable
  const insights = useMemo(() => buildInsights(record, today, notices, usable), [record, today, notices, ent]) // eslint-disable-line react-hooks/exhaustive-deps
  // D-345 방금 올린 서류 — 올리기 전 기록의 판정과 견줘 새로 판정이 난 모듈(한 번만 계산)
  const opened = useMemo(() => (lastBatch?.before ? insightChanges(buildInsights(lastBatch.before, today, notices, usable), insights) : []), [lastBatch, today, notices, insights]) // eslint-disable-line react-hooks/exhaustive-deps
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
  const requestText = useMemo(() => recoRequestMessage(record, insights), [record, insights])
  // D-158: 확인할 것 — 이 업체 것만(자료에서 읽은 정보는 위 '확인이 필요한 정보' 칸이 맡는다)
  const decisions = useMemo(() => buildDecisions(record, today, notices, usable).filter((d) => d.kind !== 'fact'), [record, today, notices, ent]) // eslint-disable-line react-hooks/exhaustive-deps
  const { answer, busy } = useDecisionAnswer({
    workspaceId,
    userId: userId ?? null,
    today,
    notices,
    latest: () => recordRef.current,
    save: async (next) => ((await (onCommitQuiet ?? (async () => false))(next)) ? next : null),
    linkOf,
  })

  const setNext = (text: string) => void onCommit(withNextAction(record, text, addDaysLocal(today, 3)), `다음 약속으로 걸었습니다 — ${text.slice(0, 30)}`)
  // D-199: 상황 예시도 요금제에 있는 모듈만(모듈 키 = 기능 권한 키)
  const scenarioUsable = useCallback((key: string) => ent.feature(key).usable, [ent])
  const assistBuild = useCallback(() => clientBundle(record, today, insights, buildClientSchedule(record, today)), [record, today, insights])
  // D-352 맞춤 진단서 한 장(대표님께 드릴 종이)
  const [diagOpen, setDiagOpen] = useState(false)
  // D-366 지난번 드린 진단서와 견준 한 줄
  const diagNote = useMemo(() => diagnosisNote(record, insights, today), [record, insights, today])
  // D-242: 아래 상황 예시 줄의 '한 장 설계서로' → 위 설계서가 그 상황으로 펼쳐진다
  const [planFocus, setPlanFocus] = useState<{ id: PlanId; n: number } | null>(null)
  const openPlan = (presetId: string) => {
    const def = SITUATION_PLANS.find((d) => d.preset === presetId)
    if (def) setPlanFocus((f) => ({ id: def.id, n: (f?.n ?? 0) + 1 }))
  }
  // D-242: 설계서를 업체 기록에 한 줄로 — 고른 행동은 할 일(달력 · 오늘). 다음 할 일이 비어 있으면 첫 행동을 거기에도
  // D-244: 새로 건 할 일 수를 돌려준다(앞서 붙인 설계서와 같은 할 일은 다시 걸지 않음) — 저장 못 하면 false
  const attachPlan = async (plan: SituationPlan, ids: string[]): Promise<number | false> => {
    const base = recordRef.current
    const input = planResultInput(plan, base.companyName, ids, base.toolResults)
    let next = withToolResult(base, input)
    const first = plan.actions.find((a) => ids.includes(a.id))
    if (first && !base.nextAction.trim()) next = withNextAction(next, first.text, first.date)
    if (onCommitQuiet) return (await onCommitQuiet(next)) ? input.deadlines.length : false
    await onCommit(next, `${plan.title} 설계서를 업체 기록에 붙였어요`)
    return input.deadlines.length
  }

  return (
    <div className="flex flex-col gap-4" data-testid="smart-tab">
      {diagOpen && <ClientDiagnosisSheet record={record} insights={insights} today={today} onClose={() => setDiagOpen(false)} onGiven={onCommitQuiet} />}
      {/* 0. D-190: 먼저 제안할 것 — 아래 '모듈별 판정' 중 좋은 것 3개를 맨 위에 */}
      <TopPicksCard insights={insights} onUpload={onUpload} showUpload={false} onDiagnosis={() => setDiagOpen(true)} diagNote={diagNote} onRequest={onRequestText && requestText ? () => onRequestText(requestText) : undefined} onPickRequest={onRequestText ? (p) => p.request && onRequestText(p.request.text, { title: p.request.title, description: p.request.description }) : undefined} onShowAll={() => {
          openFold('smart.verdicts')
          window.setTimeout(() => document.getElementById('module-verdicts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        }} />

      {/* D-239: 이 업체 AI 도우미 — 한 장 요약 · 다음 할 일 · 미팅 질문 · 제안 순서(먼저 제안할 것 바로 아래) */}
      <AiAssist page="client" scope={`client:${record.id}`} title={record.companyName} presets={['client.brief', 'client.next', 'client.meeting', 'client.pitch']} build={assistBuild} quick={2} defaultClientId={record.id} />

      {/* D-192: 아래 목차는 접어 두고 제목 줄만 — 한 번에 펼치거나 접기(맨 위 '먼저 제안할 것' 은 그대로 맨 위) */}
      <FoldAllButton className="-my-2 self-end" />

      {/* 1. 서류 올리기 — D-192: 설명 글은 ⓘ 로, 한 줄만 */}
      <Surface className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 sm:py-3">
        <HintTip tip={hintFor('서류만 올리면 저절로 분석해요')} label="서류만 올리면 저절로 분석해요" className="min-w-0 flex-1">
          <p className="t-card flex min-w-0 items-center gap-2 font-bold break-keep text-slate-900">
            <FileUp aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
            서류만 올리면 저절로 분석해요
          </p>
        </HintTip>
        <Button variant="primary" onClick={onUpload} data-testid="smart-upload">
          <FileUp aria-hidden="true" className="size-4" /> 서류 올리기
        </Button>
      </Surface>

      {/* 2. 방금 올린 서류 — D-183: 새로고침해도 지난 올리기 기록이 보인다(업체 기록에 남김) */}
      {lastBatch ? (
        <BatchSummary batch={lastBatch} fresh onRetry={onUpload} opened={opened} />
      ) : record.docUploads?.[0] ? (
        <BatchSummary batch={batchOfLog(record.docUploads[0])} fresh={false} onRetry={onUpload} />
      ) : null}

      {/* 3. 확인이 필요한 정보 */}
      <FactInboxCard record={record} now={nowIso()} onCommit={onCommit} />

      {/* 3-1. D-158: 프로그램이 준비한 것 — 맞다 · 아니다만(정보 확인은 위 칸이 맡는다) */}
      {decisions.length > 0 && (
        <Section title="프로그램이 준비했어요 — 맞나요?" count={decisions.length} fold={{ id: 'smart.decisions' }}>
          <div data-testid="smart-decisions">
            <DecisionList decisions={decisions} busy={busy} showClient={false} linked={(id) => !!linkOf(id)} onAnswer={(d, a) => void answer(d, a)} />
          </div>
        </Section>
      )}

      {/* 4. 다음 행동 */}
      {/* D-357 화면 원칙 — 맞춤 추천 첫 화면은 '먼저 제안할 것' 하나만 펼치고 나머지는 접힌 채 한 줄(펼친 것은 기억) */}
      <Section title="다음 행동 추천" count={steps.length} fold={{ id: 'smart.steps', summary: steps.length ? '누르면 이 업체에 지금 할 일 순서' : '지금 추천할 행동 없음' }}>
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

      {/* 4-0. D-242 상황별 한 장 설계서 — 상황 하나 · 사람 수 → 고용지원금 · 세액공제 · 정책자금을 한 장에 · 붙이면 할 일로 */}
      <ClientSituationPlan
        record={record}
        today={today}
        usable={scenarioUsable}
        onRequestText={onRequestText}
        onAnswer={(q, a) =>
          onCommit(withScenarioAnswer(recordRef.current, q, a, nowIso()), a === null ? '답을 지웠습니다 — 다시 여쭤 볼게요.' : '답을 저장했습니다 — 설계서 · 상황 예시를 다시 맞췄어요.')
        }
        onAttach={attachPlan}
        focus={planFocus}
      />

      {/* 4-1. D-199 상황 예시로 바로 설계 — 한 번 누르면 이 업체 숫자로(같은 엔진) · 모듈에서 같은 가정으로 이어서 */}
      <ClientScenarios
        record={record}
        today={today}
        usable={scenarioUsable}
        onRequestText={onRequestText}
        onSetNext={setNext}
        onAnswer={(q, a) =>
          onCommit(withScenarioAnswer(recordRef.current, q, a, nowIso()), a === null ? '답을 지웠습니다 — 다시 여쭤 볼게요.' : '답을 저장했습니다 — 상황 예시를 다시 맞췄어요.')
        }
        onPlan={openPlan}
      />

      {/* 4-1. 맞춤 상담(D-145) — 목차에서 고르거나 직접 묻기 · 이 회사 기록 · 모듈 판정으로 답한다. D-192: 접어 둔다 */}
      <Fold id="smart.advisor" title="맞춤 상담">
        <ClientAdvisor record={record} today={today} notices={notices} insights={insights} onSetNext={setNext} bare />
      </Fold>

      {/* 5. 모듈별 판정 */}
      <div id="module-verdicts" className="scroll-mt-32">
      {/* D-192: 위 '먼저 제안할 것' 이 좋은 것 3개를 보여 준다 — 전부는 접어 둔다(설명은 ⓘ) */}
      <Section title="모듈별 판정" count={insights.length} fold={{ id: 'smart.verdicts' }}>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="smart-insights">
          {insights.map((ins) => (
            <li key={ins.key} data-testid="smart-insight" data-key={ins.key} data-tone={ins.tone}>
              <Surface edge={TONE[ins.tone]} showEdge className="flex h-full flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-card font-bold text-slate-900">{ins.label}</span>
                  <Badge tone={TONE[ins.tone]}>{INSIGHT_TONE_LABEL[ins.tone]}</Badge>
                </div>
                <p className="t-body break-keep font-semibold text-slate-800 [overflow-wrap:anywhere]">{ins.headline}</p>
                {ins.amount && <p className="t-sub font-bold break-keep text-success-700" data-testid="smart-insight-amount">{ins.amount}</p>}
                {ins.detail && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{ins.detail}</p>}
                {ins.last && (
                  <p className="t-sub flex items-start gap-1 break-keep text-slate-600 [overflow-wrap:anywhere]" data-testid="smart-insight-last">
                    <History aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
                    <span className="min-w-0">
                      지난번 <b className="font-semibold text-slate-800">{ins.last.label}</b> · {activityTimeText(ins.last.at)}
                    </span>
                  </p>
                )}
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
                {/* D-313 판정이 났으면 아직 받을 신청 서류를 카톡 문구로 — 서류함에 있는 것은 뺀다 */}
                {ins.request && onRequestText && (
                  <button
                    type="button"
                    onClick={() => onRequestText(ins.request!.text, { title: ins.request!.title, description: ins.request!.description })}
                    className="tap t-sub inline-flex items-center gap-1 self-start rounded-(--radius-control) border border-slate-200 bg-white px-2.5 py-1 font-semibold break-keep text-brand-800 hover:border-brand-400"
                    data-testid="smart-insight-request"
                  >
                    <MessageSquareText aria-hidden="true" className="size-4 shrink-0" />
                    {ins.request.label}
                  </button>
                )}
                <Link to={ins.openPath} className="tap t-sub mt-auto inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline">
                  {ins.openLabel} <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Surface>
            </li>
          ))}
        </ul>
      </Section>
      </div>

      {/* 5-1. D-238: 홍보도 같이 — 홈페이지 · 홍보 글(대표 화면 · 요금제에 있을 때만) */}
      <ClientPromoRow record={record} />

      {/* 6. 지금 챙길 것 */}
      {alerts.length > 0 && (
        <Section title="지금 챙길 것" count={alerts.length} fold={{ id: 'smart.alerts' }}>
          <ul className="flex flex-col gap-2" data-testid="smart-alerts">
            {alerts.slice(0, 6).map((a) => (
              <AlertRow key={a.id} alert={a} hideClient onOpen={() => onAlertOpen(a)} />
            ))}
          </ul>
        </Section>
      )}

      {/* 7. 맞는 지원사업 */}
      <ClientGrantsCard workspaceId={workspaceId} record={record} today={today} onFill={onFill} onCommit={onCommit} fold={{ id: 'smart.grants' }} />
    </div>
  )
}

/**
 * D-238 맞춤 추천 '홍보도 같이' — 모듈 판정(정책자금 · 고용 …)과 따로, 이 업체 홈페이지 · 홍보 글을 바로 만드는 한 줄.
 * 판정이 아니라 입구다(가능성 · 금액을 말하지 않는다). 팀장 화면은 웹 스튜디오 입구가 없어(D-162) 그리지 않는다.
 */
function ClientPromoRow({ record }: { record: ClientOpsRecord }) {
  const { ent } = useEntitlements()
  const pilot = useIsPilot()
  const tools = [
    { key: 'homepage', label: '홈페이지', verb: '초안 만들기', again: '고치기', path: '/tools/homepage/build' },
    { key: 'content', label: '홍보 글', verb: '만들기', again: '더 만들기', path: '/tools/content/build' },
  ].filter((t) => ent.feature(t.key).usable)
  if (pilot || tools.length === 0) return null
  const q = `?client=${encodeURIComponent(record.id)}`
  return (
    <section aria-label="홍보도 같이" data-testid="smart-promo">
    <Surface className="flex flex-col gap-2.5 py-3 sm:py-3">
      <HintTip tip={hintFor('홍보도 같이')} label="홍보도 같이">
        <h3 className="t-card font-bold break-keep text-slate-900">홍보도 같이</h3>
      </HintTip>
      {/* D-375 상자 안 상자 대신 줄 — 판 하나 안에 두 줄(휴대폰은 가는 줄로 나눔) */}
      <ul className="flex flex-col divide-y divide-slate-100 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:divide-y-0">
        {tools.map((t) => {
          const last = latestToolResult(record, t.key)
          return (
            <li key={t.key} className="min-w-0">
              <Link
                to={`${t.path}${q}`}
                data-testid="smart-promo-open"
                data-tool={t.key}
                className="tap flex h-full flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) px-1 py-2.5 hover:bg-slate-50"
              >
                <span className="flex min-w-0 grow basis-[10rem] flex-col">
                  <span className="t-body font-bold text-slate-900">{t.label}</span>
                  <span className="t-meta break-keep text-slate-600 [overflow-wrap:anywhere]">{last ? `지난번 ${last.verdictLabel || last.title} · ${activityTimeText(last.createdAt)}` : '아직 만든 것이 없어요 — 회사 정보가 미리 들어가요'}</span>
                </span>
                <span className="t-sub ml-auto inline-flex shrink-0 items-center gap-1 font-semibold text-brand-700">
                  {last ? t.again : t.verb} <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Surface>
    </section>
  )
}

/** D-345 모듈별 판정(접혀 있으면 펼쳐서) 그 모듈 카드로 */
function goToInsight(key: string) {
  openFold('smart.verdicts')
  window.setTimeout(() => document.querySelector(`[data-testid="smart-insight"][data-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
}

function BatchSummary({ batch, fresh, onRetry, opened = [] }: { batch: DocBatchSummary; fresh: boolean; onRetry: () => void; opened?: Insight[] }) {
  const when = batch.at ? new Date(batch.at) : null
  const time = when ? (fresh ? when.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : when.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })) : ''
  const failed = batch.failed ?? []
  // D-192: 방금 올린 것은 펼쳐 두고, 지난번 것은 접어 둔다(한 줄 제목만)
  return (
    <div data-testid="smart-batch" data-fresh={fresh ? '1' : '0'} className="flex flex-col gap-2">
    {/* D-212: 못 올린 파일은 접지 않고 늘 보인다 — 올리기 창을 닫으면 빨간 줄이 사라져 잊어버렸다 */}
    {failed.length > 0 && (
      <div data-testid="smart-failed" data-count={failed.length}>
      <Surface edge="danger" showEdge className="flex flex-col gap-2">
        <p className="t-sub font-semibold break-keep text-danger-700">
          못 올린 파일 {failed.length}개 — 같은 파일을 다시 골라 올려 주세요
        </p>
        <ul className="flex flex-col gap-1">
          {failed.slice(0, 8).map((f, i) => (
            <li key={`${f.fileName}-${i}`} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep">
              <span className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">{f.fileName}</span>
              <span className="t-meta min-w-0 text-danger-700 [overflow-wrap:anywhere]">{f.reason}</span>
            </li>
          ))}
          {failed.length > 8 && <li className="t-meta text-slate-500">그 밖에 {failed.length - 8}개</li>}
        </ul>
        <Button variant="secondary" size="sm" onClick={onRetry} className="self-start" data-testid="smart-failed-retry">
          <FileUp aria-hidden="true" className="size-4" /> 다시 올리기
        </Button>
      </Surface>
      </div>
    )}
    <Fold
      id={fresh ? 'smart.batch.fresh' : 'smart.batch.last'}
      title={fresh ? `방금 올린 서류 ${batch.files}개를 읽었어요` : `지난번에 올린 서류 ${batch.files}개`}
      defaultOpen={fresh}
      action={time ? <span className="t-meta text-slate-500">{time}</span> : undefined}
    >
    <Surface edge="success" showEdge className="flex flex-col gap-3">
      {/* D-345 방금 올린 서류로 새로 판정이 난 모듈 — 누르면 아래 그 모듈 카드로 */}
      {opened.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="smart-batch-opened">
          <p className="t-sub flex items-center gap-1.5 font-semibold break-keep text-brand-800">
            <Sparkles aria-hidden="true" className="size-4 shrink-0" /> 이번 서류로 새로 판정됐어요 {opened.length}개
          </p>
          <ul className="flex flex-col gap-1">
            {opened.slice(0, 6).map((i) => (
              <li key={i.key}>
                <button type="button" onClick={() => goToInsight(i.key)} className="tap t-sub flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-(--radius-control) px-1 text-left break-keep hover:bg-white" data-testid="smart-batch-opened-item" data-key={i.key}>
                  <span className="shrink-0 font-semibold text-slate-900">{i.label}</span>
                  <Badge tone={TONE[i.tone]}>{INSIGHT_TONE_LABEL[i.tone]}</Badge>
                  {/* 휴대폰은 판정 글을 아랫줄 전체 폭으로(좁은 칸에 한두 글자씩 끊기지 않게) */}
                  <span className="order-last min-w-0 basis-full text-slate-700 [overflow-wrap:anywhere] sm:order-none sm:basis-0 sm:flex-1">{i.headline}</span>
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-brand-600 sm:ml-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {batch.entered.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="t-sub font-semibold text-success-700">바로 넣은 정보 {batch.entered.length}건</p>
          <ul className="flex flex-col gap-1" data-testid="smart-entered">
            {batch.entered.map((f, i) => (
              <li key={`${f.key}-${i}`} className="t-sub flex flex-wrap items-baseline gap-x-2 break-keep">
                <Check aria-hidden="true" className="size-4 shrink-0 self-center text-success-600" />
                <span className="w-28 shrink-0 text-slate-500">{f.label}</span>
                <span className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">{f.display}</span>
                <span className="t-meta min-w-0 text-slate-400 [overflow-wrap:anywhere]">{f.fileName}</span>
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
                <span className={`min-w-0 font-semibold [overflow-wrap:anywhere] ${x.other ? 'text-warning-800' : 'text-slate-900'}`}>{x.label}</span>
                {x.same ? (
                  <span className="t-meta text-warning-800">(이름 · 크기가 같은 파일이 이미 있어요 — '확인할 것' 에서 최신 것만 남기거나 서류 탭에서 하나 지우세요)</span>
                ) : (
                  x.numbered && <span className="t-meta text-slate-500">(같은 서류가 이미 있어 따로 둠 — '확인할 것' 에서 최신 것만 남기거나 서류 탭에서 하나 지우세요)</span>
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
    </Fold>
    </div>
  )
}
