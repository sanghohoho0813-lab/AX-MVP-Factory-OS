/**
 * 인증 하나 — 벤처 · 연구소 · 이노비즈 · 메인비즈가 같은 4단계 문법 (D-170).
 *   1 받을 수 있나요?  2 무엇을 준비하나요?  3 실제 진행  4 받으면 무엇이 달라지나요?
 * AX: 단계마다 '지금 할 것 하나' 가 먼저 — 근거 · 공식 기준 · 진행 기록 · 절차 · 설명 문구는 접거나 시트 뒤로(지우지 않음).
 * 연구소는 기존 연구소 관리로 이어 준다(다시 만들지 않음). 벤처는 기업인증 안에서 시작해 끝난다(AX Hotfix — 예전 '특허+벤처' 화면은 기록만 읽음).
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ToolResultAttach } from '../../tools/shared/ToolResultAttach'
import { CERT_RULES, EVIDENCE_CLASS, evidenceClassOf } from '../rules/officialRules'
import { explainFor } from '../core/explain'
import { READINESS_LABEL, RECOMMENDATION_LABEL, type CertificationAssessment, type CertificationClientContext } from '../core/types'
import type { Answer } from '../core/selfCheck'
import type { PreparedAnswer } from '../core/inspection'
import { INNOBIZ_CHECK, INNOBIZ_INSPECTION } from '../innobiz/innobizCheck'
import { MAINBIZ_CHECK, MAINBIZ_INSPECTION } from '../mainbiz/mainbizCheck'
import { ExpiredBadge, BenefitPicks, ExplainButton, OfficialStructure, ReasonList, RecBadge, showReadiness, StepTabs } from './certParts'
import { InspectionFlow, SelfCheckFlow } from './SelfCheckFlow'
import { useToast } from '../../components/ui/toastContext'
import { CERT_STATUS_LABEL, type CertLifecycle, type CertStatus, type CompletionInput } from '../core/lifecycle'
import { LifecyclePanel } from './LifecyclePanel'
import { InspectionPackPanel, SubmitGatePanel, VentureCheckPanel, VenturePackPanel } from './PrepPanels'
import { buildInspectionPackage } from '../core/inspectionPackage'
import { buildSubmitGate } from '../core/submitGate'
import { buildVenturePack, VENTURE_REVIEWED_KEY, VENTURE_STAGE_LABEL, ventureProgress, ventureRoutes, ventureSubmitCheck } from '../core/venturePack'
import { inspectionHandoff, ventureHandoff } from '../core/handoff'
import { runSelfCheck } from '../core/selfCheck'
import { INNOBIZ_BANK } from '../innobiz/innobizGuides'
import { MAINBIZ_BANK } from '../mainbiz/mainbizGuides'
import { useSenderLine } from '../../components/layout/useCurrentUser'
import { BasisBox } from './BasisBox'
import { RulesInfoButton } from './RulesSheet'
import { sectionHref } from './certNav'

const EVIDENCE_LABEL = Object.fromEntries(Object.values(CERT_RULES).flatMap((r) => r.evidence.map((e) => [e.id, e.label])))
const labelOf = (id: string) => EVIDENCE_LABEL[id] ?? id

export function CertWorkspace({
  a,
  ctx,
  clientId,
  answers,
  prep,
  notes,
  onAnswer,
  onPrep,
  onNote,
  life,
  onStatus,
  onComplete,
  onPatchLife,
  onRequestDocs,
}: {
  a: CertificationAssessment
  ctx: CertificationClientContext
  clientId: string
  answers: Record<string, Answer>
  prep: Record<string, PreparedAnswer>
  /** P2: 대표 답(받아 적은 것) */
  notes: Record<string, string>
  onAnswer: (id: string, v: Answer) => void
  onPrep: (id: string, p: PreparedAnswer) => void
  onNote: (key: string, text: string) => Promise<void>
  life: CertLifecycle
  onStatus: (s: CertStatus) => Promise<void>
  onComplete: (input: CompletionInput, toProfile: boolean) => Promise<void>
  onPatchLife: (patch: Partial<Pick<CertLifecycle, 'memo' | 'postAuditAt'>>) => Promise<void>
  /** 서류함에 빈 칸(없는 것만) — 만든 칸 수 */
  onRequestDocs: (labels: string[]) => Promise<number>
}) {
  const rule = CERT_RULES[a.key]
  const { showToast } = useToast()
  // P1: 진행 중인 인증은 '실제 진행' 단계에서 연다(진행 기록이 거기 있다)
  const [step, setStep] = useState(life.status !== 'preparing' || life.history.length > 0 ? 2 : 0)
  const [flow, setFlow] = useState<'none' | 'self' | 'inspect' | 'pack' | 'gate' | 'venture' | 'vcheck'>('none')
  const sender = useSenderLine()
  const navigate = useNavigate()
  const requestDocs = async () => {
    const text = explain.docRequest
    const added = a.missingEvidence.length ? await onRequestDocs(a.missingEvidence).catch(() => -1) : 0
    const copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    showToast(added < 0 ? '서류함에 칸을 만들지 못했습니다 — 문구는 아래에서 복사해 주세요' : `${copied ? '요청 문구를 복사했습니다' : '요청 문구는 아래에서 복사해 주세요'}${added > 0 ? ` · 서류함에 칸 ${added}개` : ''}`)
  }
  const selfItems = a.key === 'innobiz' ? INNOBIZ_CHECK : a.key === 'mainbiz' ? MAINBIZ_CHECK : null
  const inspectQs = a.key === 'innobiz' ? INNOBIZ_INSPECTION : a.key === 'mainbiz' ? MAINBIZ_INSPECTION : null
  const explain = explainFor(a, ctx, sender)
  const bank = a.key === 'innobiz' ? INNOBIZ_BANK : a.key === 'mainbiz' ? MAINBIZ_BANK : null
  // P2: 실사 준비 패키지 · 제출 전 확인 · 벤처 준비 — 판단은 Core, 화면은 보여 주기만
  const pkg = useMemo(() => (bank && selfItems ? buildInspectionPackage({ cert: a.key, bank, selfCheck: selfItems, answers, ctx, prep, labelOf, notes }) : null), [bank, selfItems, a.key, answers, ctx, prep, notes])
  const gate = useMemo(() => (pkg && selfItems ? buildSubmitGate({ cert: a.key, ctx, selfCheck: selfItems, answers, pkg }) : null), [pkg, selfItems, a.key, ctx, answers])
  const venture = useMemo(() => (a.key === 'venture' ? buildVenturePack(ctx, notes) : null), [a.key, ctx, notes])
  const answeredSelf = Object.keys(answers).length > 0
  const unconfirmed = (ctx.basis ?? []).filter((b) => b.state === 'estimated' && !b.from.startsWith('컨설턴트')).length
  // AX Hotfix: 벤처는 기업인증 안에서 끝난다 — 예전 '특허+벤처' 화면으로 보내지 않는다. 연구소는 살아 있는 연구소 관리로 잇는다.
  const existingTool = a.key === 'lab' ? { label: '연구소 관리 열기', href: `/tools/labcare?client=${clientId}` } : null
  const deadlines = a.renewal
    ? [
        { date: a.renewal.prepareFrom, title: `${rule.label} 갱신 준비 시작`, note: rule.renewalNote, todo: true as const },
        { date: a.renewal.validUntil, title: `${rule.label} 유효기간 끝`, note: '', hard: true as const },
      ]
    : []
  // AX: 실제 진행 — 지금 단계 · 다음 행동 하나 · 진행 상태(사전진단 · 대표 확인 · 서류)
  const ownerLeft = pkg?.ownerQuestions.length ?? 0
  const ownerDone = Object.values(notes).filter((v) => v.trim()).length
  const docsTotal = a.haveEvidence.length + a.missingEvidence.length
  const submitted = life.status === 'applied' || life.status === 'review' || life.status === 'supplement'
  // 확인서로 들어온 보유 인증(진행 기록 없음)도 완료로 본다 — LifecyclePanel 이 같은 기준으로 보여 준다
  const done = life.status === 'certified' || life.status === 'renewal' || a.recommendation === 'held'
  const [lifeOpen, setLifeOpen] = useState(submitted || done)
  const openLife = () => {
    setLifeOpen(true)
    window.setTimeout(() => document.querySelector('[data-testid="cert-life-box"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
  }
  type Next = { stage: string; label: string; testid: string; go: () => void }
  // AX Hotfix: 벤처 — 준비 확인 → 대표 확인 → 사업계획 준비 → 제출 전 확인 → 신청 · 평가 → 완료(새 엔진 없이 준비 패키지를 흐름에 넣음)
  const openVenturePack = () => {
    if (!(notes[VENTURE_REVIEWED_KEY] ?? '').trim()) void onNote(VENTURE_REVIEWED_KEY, ctx.today).catch(() => undefined)
    setFlow('venture')
  }
  const vRoutes = a.key === 'venture' ? ventureRoutes(ctx) : []
  const vProg = venture ? ventureProgress({ sections: venture, notes, hasBizPlan: a.haveEvidence.some((x) => /사업계획/.test(x)) || (!!ctx.legacyVenture && ctx.legacyVenture.planDone >= ctx.legacyVenture.planTotal), status: done ? 'done' : submitted ? 'submitted' : 'preparing' }) : null
  const ventureNext: Next | null = !vProg
    ? null
    : vProg.stage === 'done'
      ? { stage: VENTURE_STAGE_LABEL.done, label: '벤처 확인 완료 기록', testid: 'cert-next-complete', go: openLife }
      : vProg.stage === 'applied'
        ? { stage: VENTURE_STAGE_LABEL.applied, label: '벤처 확인 완료 기록', testid: 'cert-next-complete', go: openLife }
        : vProg.stage === 'check'
          ? { stage: VENTURE_STAGE_LABEL.check, label: '벤처 준비 확인', testid: 'cert-venture-start', go: openVenturePack }
          : vProg.stage === 'owner'
            ? { stage: VENTURE_STAGE_LABEL.owner, label: `대표 확인 ${vProg.ownerLeft}개`, testid: 'cert-venture-owner', go: openVenturePack }
            : vProg.stage === 'plan'
              ? { stage: VENTURE_STAGE_LABEL.plan, label: '사업계획 준비', testid: 'cert-venture-plan', go: () => setStep(1) }
              : { stage: VENTURE_STAGE_LABEL.submit, label: '제출 전 확인', testid: 'cert-venture-check', go: () => setFlow('vcheck') }
  // 연구소는 기존 연구소 관리가 다음 행동(아래) — 진행 기록은 완료 · 심사 중이면 펼쳐 둔다
  const next: Next | null = ventureNext ?? (!(selfItems && pkg)
    ? null
    : done
      ? { stage: '인증 완료', label: '인증 완료 기록', testid: 'cert-next-complete', go: openLife }
      : submitted
        ? { stage: '심사 중', label: '심사 일정 기록', testid: 'cert-next-review', go: openLife }
        : !answeredSelf
          ? { stage: '사전진단 전', label: '사전진단 시작', testid: 'cert-selfcheck-start', go: () => setFlow('self') }
          : ownerLeft > 0
            ? { stage: '대표 확인', label: `대표 확인 ${ownerLeft}개`, testid: 'cert-next-owner', go: () => setFlow('pack') }
            : Object.keys(prep).length === 0
              ? { stage: '실사 준비', label: '실사 준비', testid: 'cert-prep-pack', go: () => setFlow('pack') }
              : { stage: '제출 준비', label: '제출 전 최종 확인', testid: 'cert-gate-open', go: () => setFlow('gate') })
  const keyReasons = [...a.reasons.filter((r) => r.state === 'no'), ...a.reasons.filter((r) => r.state === 'ok').slice(0, 2), ...a.reasons.filter((r) => r.state === 'warn').slice(0, 1), ...a.reasons.filter((r) => r.state === 'unknown').slice(0, 1)].slice(0, 4)
  // AX: 준비자료 — 그룹 제목이 공식 / MIRAE 뜻을 맡는다(줄마다 꼬리표 없음)
  const firstDocs = rule.evidence.filter((e) => !a.haveEvidence.includes(e.label) && EVIDENCE_CLASS[a.key] && ['official', 'process'].includes(evidenceClassOf(a.key, e.id).basis))
  const haveDocs = rule.evidence.filter((e) => a.haveEvidence.includes(e.label))
  const helpDocs = rule.evidence.filter((e) => !a.haveEvidence.includes(e.label) && !firstDocs.includes(e))
  return (
    <div className="flex flex-col gap-4" data-testid="cert-workspace" data-key={a.key}>
      <Surface>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-section font-bold text-slate-900">{rule.label}</h2>
            <RecBadge rec={a.recommendation} />
            {a.expired && <ExpiredBadge />}
          </div>
          <p className="t-body font-semibold break-keep text-slate-800">{a.oneLine}</p>
        </div>
      </Surface>
      <StepTabs
        step={step}
        onStep={(n) => {
          setStep(n)
          setFlow('none')
        }}
      />

      {step === 0 && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-0">
            <p className="t-body break-keep text-slate-800" data-testid="cert-judgment">
              현재 판단 <b className="font-bold">{RECOMMENDATION_LABEL[a.recommendation]}</b>
              {showReadiness(a) && <span className="text-slate-600"> · 준비도 {READINESS_LABEL[a.readiness]}(MIRAE)</span>}
            </p>
            <ReasonList reasons={keyReasons} />
            {a.missingFacts.length > 0 && <p className="t-sub break-keep text-warning-800">확인 필요 · {a.missingFacts.slice(0, 3).join(', ')}</p>}
            {selfItems ? (
              <Button
                variant="primary"
                className="self-start"
                onClick={() => {
                  setStep(2)
                  setFlow('self')
                }}
                data-testid="cert-step0-self"
              >
                {answeredSelf ? '사전진단 이어서' : '사전진단 시작'}
              </Button>
            ) : a.key === 'venture' ? (
              <Button
                variant="primary"
                className="self-start"
                onClick={() => {
                  setStep(2)
                  if (ventureNext && ventureNext.testid !== 'cert-venture-plan') ventureNext.go()
                }}
                data-testid="cert-step0-venture"
              >
                {ventureNext?.label ?? '벤처 준비 확인'}
              </Button>
            ) : existingTool ? (
              <Link to={existingTool.href} className="contents">
                <Button variant="primary" className="self-start" data-testid="cert-step0-tool">
                  <ExternalLink aria-hidden="true" className="size-4" /> {existingTool.label}
                </Button>
              </Link>
            ) : null}
            <details className="rounded-(--radius-control) border border-slate-200" data-testid="cert-basis-more">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-700">판단 근거 · 공식 기준 보기</summary>
              <div className="flex flex-col gap-3 px-3 pb-3">
                <p className="t-sub break-keep text-slate-600">
                  {rule.summary} · {a.timing}
                </p>
                {vRoutes.length > 0 && (
                  <div className="flex flex-col gap-1" data-testid="cert-venture-routes">
                    <p className="t-sub font-semibold text-slate-800">유형별로 보면</p>
                    <ul className="flex flex-col gap-0.5">
                      {vRoutes.map((r) => (
                        <li key={r.type} className={`t-sub break-keep ${r.state === 'fit' ? 'text-slate-800' : r.state === 'check' ? 'text-warning-800' : 'text-slate-500'}`} data-testid="cert-venture-route" data-state={r.state}>
                          {r.state === 'fit' ? '✓' : r.state === 'check' ? '?' : '–'} <b className="font-semibold">{r.label}</b> — {r.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ReasonList reasons={a.reasons} />
                <OfficialStructure rule={rule} />
                <BasisBox cert={a.key} ctx={ctx} />
                <RulesInfoButton cert={a.key} today={ctx.today} />
              </div>
            </details>
          </div>
        </Surface>
      )}

      {step === 1 && (
        <Surface>
          <div className="flex flex-col gap-4" data-testid="cert-step-body-1">
            {(
              [
                ['first', '먼저 준비', '공식 제출서류 — 기관 안내에 있는 것', firstDocs, 'text-slate-900'],
                ['have', '이미 있음', '서류함 · 회사 정보에 있음 — 다시 받지 않습니다', haveDocs, 'text-success-700'],
                ['help', '있으면 도움됨', 'MIRAE 실무 준비자료 — 공식 필수는 아님', helpDocs, 'text-slate-700'],
              ] as const
            )
              .filter(([, , , list]) => list.length > 0)
              .map(([id, title, hint, list, tone]) => (
                <section key={id} className="flex flex-col gap-1" data-testid={`cert-evidence-${id}`}>
                  <h3 className={`t-body font-bold ${tone}`}>
                    {title} <span className="t-sub font-normal text-slate-500">· {hint}</span>
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {list.map((e) => (
                      <li key={e.id} className="t-sub break-keep text-slate-800" data-testid="cert-evidence" data-have={id === 'have'} data-basis={evidenceClassOf(a.key, e.id).basis}>
                        {id === 'have' ? '✓ ' : '· '}
                        <b className="font-semibold">{e.label}</b> <span className="text-slate-500">— {e.why}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            <div className="flex flex-wrap items-center gap-2">
              {a.missingEvidence.length > 0 && (
                <Button variant="primary" onClick={() => void requestDocs()} data-testid="cert-request-docs">
                  모자란 자료 요청({a.missingEvidence.length})
                </Button>
              )}
              <Link to={`/ops/clients/${clientId}?tab=docs`} className="contents">
                <Button variant="ghost" size="sm">
                  서류함 열기
                </Button>
              </Link>
              <ExplainButton set={explain} first="docRequest" variant="ghost" />
            </div>
          </div>
        </Surface>
      )}

      {step === 2 && flow === 'none' && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-2">
            {next ? (
              <div className="flex flex-col gap-2.5" data-testid="cert-prep-actions">
                <p className="t-sub text-slate-600">
                  현재 단계 <b className="t-body font-bold text-slate-900" data-testid="cert-stage">{next.stage}</b>
                </p>
                {selfItems && pkg && (
                  <p className="t-sub flex flex-wrap gap-x-3 gap-y-1 break-keep text-slate-700" data-testid="cert-prep-status">
                    <span>{answeredSelf ? '✓ 사전진단 완료' : '○ 사전진단 전'}</span>
                    <span>
                      {ownerLeft === 0 && ownerDone > 0 ? '✓' : '△'} 대표 확인 {ownerDone}/{ownerDone + ownerLeft}
                    </span>
                    <span>
                      {docsTotal > 0 && a.haveEvidence.length === docsTotal ? '✓' : '△'} 서류 {a.haveEvidence.length}/{docsTotal}
                    </span>
                  </p>
                )}
                {vProg && venture && (
                  <p className="t-sub flex flex-wrap gap-x-3 gap-y-1 break-keep text-slate-700" data-testid="cert-prep-status">
                    <span>
                      {vProg.okCount === vProg.sectionCount ? '✓' : '△'} 준비 칸 {vProg.okCount}/{vProg.sectionCount}
                    </span>
                    <span>
                      {vProg.ownerLeft === 0 ? '✓' : '△'} 대표 확인 {vProg.ownerTotal - vProg.ownerLeft}/{vProg.ownerTotal}
                    </span>
                    <span>
                      {docsTotal > 0 && a.haveEvidence.length === docsTotal ? '✓' : '△'} 서류 {a.haveEvidence.length}/{docsTotal}
                    </span>
                  </p>
                )}
                {vProg && ctx.legacyVenture && (
                  <p className="t-sub flex flex-wrap gap-x-2 gap-y-0.5 break-keep text-slate-600" data-testid="cert-venture-legacy">
                    {['이전 컨설팅 기록', ctx.legacyVenture.planDone ? `사업계획 초안 ${ctx.legacyVenture.planDone}/${ctx.legacyVenture.planTotal}` : '', ctx.legacyVenture.patentStatus !== 'none' ? `특허 ${ctx.legacyVenture.patentStatus === 'registered' ? '등록' : '출원 중'}` : '', ctx.legacyVenture.submittedAt ? `신청 기록 ${ctx.legacyVenture.submittedAt}(진행 기록에 '신청' 으로 적어 두세요)` : '']
                      .filter(Boolean)
                      .map((x, i) => (
                        <span key={x}>
                          {i > 0 ? '· ' : ''}
                          {x}
                        </span>
                      ))}
                  </p>
                )}
                <Button variant="primary" className="self-start" onClick={next.go} data-testid={next.testid}>
                  {next.label}
                </Button>
                {vProg && venture && (
                  <details data-testid="cert-other-actions">
                    <summary className="tap t-sub inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
                      <ChevronDown aria-hidden="true" className="size-4" /> 다른 작업
                    </summary>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!['cert-venture-start', 'cert-venture-owner'].includes(next.testid) && (
                        <Button variant="secondary" size="sm" onClick={openVenturePack} data-testid="cert-venture-pack">
                          벤처 준비 보기
                        </Button>
                      )}
                      {next.testid !== 'cert-venture-check' && (
                        <Button variant="secondary" size="sm" onClick={() => setFlow('vcheck')} data-testid="cert-venture-check-more">
                          제출 전 확인
                        </Button>
                      )}
                    </div>
                  </details>
                )}
                {selfItems && pkg && gate && (
                  <details data-testid="cert-other-actions">
                    <summary className="tap t-sub inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
                      <ChevronDown aria-hidden="true" className="size-4" /> 다른 작업
                    </summary>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {next.testid !== 'cert-selfcheck-start' && (
                        <Button variant="secondary" size="sm" onClick={() => setFlow('self')} data-testid="cert-selfcheck-again">
                          {answeredSelf ? '사전진단 이어서' : '사전진단 시작'}
                        </Button>
                      )}
                      {next.testid !== 'cert-prep-pack' && (
                        <Button variant="secondary" size="sm" onClick={() => setFlow('pack')} data-testid="cert-prep-pack-more">
                          실사 준비
                        </Button>
                      )}
                      {next.testid !== 'cert-gate-open' && (
                        <Button variant="secondary" size="sm" onClick={() => setFlow('gate')} data-testid="cert-gate-open-more">
                          제출 전 최종 확인 · {gate.verdict === 'ready' ? '✓ 가능' : `△ ${gate.items.filter((x) => x.level === 'must' && !x.ok).length}개`}
                        </Button>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ) : existingTool ? (
              <div className="flex flex-col gap-2">
                <p className="t-sub break-keep text-slate-600">{rule.label} 진행은 이미 있는 화면에서 합니다(같은 업체 기록).</p>
                <div className="flex flex-wrap gap-2">
                  <Link to={existingTool.href} className="contents">
                    <Button variant="primary" data-testid="cert-existing-tool">
                      <ExternalLink aria-hidden="true" className="size-4" /> {existingTool.label}
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
            {/* AX: 진행 기록 · 절차는 접어 둔다 — 제출 뒤 · 완료면 열어 둔다 */}
            <details open={lifeOpen} onToggle={(e) => setLifeOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-(--radius-control) border border-slate-200" data-testid="cert-life-box">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-700">진행 기록 · 상태 바꾸기 · {CERT_STATUS_LABEL[life.status]}</summary>
              <div className="px-2 pb-2">
                <LifecyclePanel cert={a.key} life={life} ctx={ctx} clientId={clientId} onStatus={onStatus} onComplete={onComplete} onPatch={onPatchLife} />
              </div>
            </details>
            <details className="rounded-(--radius-control) border border-slate-200" data-testid="cert-procedure">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-700">전체 절차 보기({rule.procedure.length}단계)</summary>
              <ol className="flex flex-col gap-1 px-3 pb-3">
                {rule.procedure.map((x, i) => (
                  <li key={x} className="t-body break-keep text-slate-800">
                    {i + 1}. {x}
                  </li>
                ))}
              </ol>
              {rule.fee && <p className="t-sub px-3 pb-3 break-keep text-slate-600">수수료(공식 안내): {rule.fee}</p>}
            </details>
          </div>
        </Surface>
      )}
      {step === 2 && flow === 'self' && selfItems && <SelfCheckFlow rule={rule} items={selfItems} ctx={ctx} answers={answers} onAnswer={onAnswer} onDone={() => setFlow('inspect')} />}
      {step === 2 && flow === 'inspect' && inspectQs && <InspectionFlow qs={inspectQs} ctx={ctx} labelOf={labelOf} prep={prep} onPrep={onPrep} />}
      {step === 2 && flow === 'pack' && pkg && selfItems && (
        <InspectionPackPanel unconfirmed={unconfirmed} clientId={clientId} pkg={pkg} handoff={inspectionHandoff(pkg, a, runSelfCheck(selfItems, ctx, answers))} notes={notes} onNote={onNote} sender={sender} onPractice={() => setFlow('inspect')} onClose={() => setFlow('none')} />
      )}
      {step === 2 && flow === 'gate' && gate && pkg && (
        <SubmitGatePanel
          gate={gate}
          companyName={ctx.companyName}
          certLabel={rule.label}
          ownerQuestions={pkg.ownerQuestions}
          notes={notes}
          onNote={onNote}
          sender={sender}
          onRequestDocs={onRequestDocs}
          onAct={(id) => (id === 'exclusion' || id === 'size' ? navigate(sectionHref('overview', clientId)) : id === 'answers' ? setFlow('inspect') : setFlow('self'))}
          onClose={() => setFlow('none')}
        />
      )}
      {step === 2 && flow === 'vcheck' && venture && vProg && (
        <VentureCheckPanel
          rows={ventureSubmitCheck({ routes: vRoutes, progress: vProg, missingEvidence: a.missingEvidence, haveEvidence: a.haveEvidence })}
          applied={submitted || done}
          onRequestDocs={() => void requestDocs()}
          onOwner={openVenturePack}
          onApplied={() => void onStatus('applied').then(() => showToast('벤처기업 — 신청(활동 기록에 남김)')).then(() => { setFlow('none'); setLifeOpen(true) })}
          onClose={() => setFlow('none')}
        />
      )}
      {step === 2 && flow === 'venture' && venture && (
        <VenturePackPanel
          unconfirmed={unconfirmed}
          clientId={clientId}
          companyName={ctx.companyName}
          sections={venture}
          handoff={ventureHandoff(ctx.companyName, venture, a, { have: a.haveEvidence, missing: a.missingEvidence })}
          notes={notes}
          onNote={onNote}
          sender={sender}
          onClose={() => setFlow('none')}
        />
      )}

      {step === 3 && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-3">
            <BenefitPicks picks={a.benefits} />
            <details className="rounded-(--radius-control) border border-slate-200">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-800" data-testid="cert-all-benefits">
                모든 혜택 보기({rule.benefits.length})
              </summary>
              <ul className="flex flex-col gap-2 px-3 pb-3">
                {rule.benefits.map((x) => (
                  <li key={x.id} className="t-sub break-keep text-slate-700" data-testid="cert-benefit-row">
                    · <b className="font-semibold">{x.title}</b> — {x.detail}
                    {x.target && <span className="text-slate-600"> · 대상: {x.target}</span>}
                    {x.figure && x.source && (
                      <span className="block pl-3 text-slate-600" data-testid="cert-benefit-figure">
                        기관 안내 숫자: {x.figure} <span className="text-slate-500">({x.source})</span>
                      </span>
                    )}
                    {x.conditional && <span className="block pl-3 text-warning-800">활용 가능 · 공고별 확인 — 적용 여부는 기관 · 시기에 따라 달라집니다</span>}
                  </li>
                ))}
              </ul>
            </details>
            <p className="t-sub break-keep text-slate-700">
              <b className="font-semibold">사후관리 · 갱신</b> · {rule.renewalNote}
            </p>
            {a.renewal && life.status !== 'certified' && life.status !== 'renewal' ? (
              <ToolResultAttach toolKey="cert-os" title={`${rule.label} 유효기간 · 갱신`} verdict={a.recommendation} verdictLabel={RECOMMENDATION_LABEL[a.recommendation]} summary={`${rule.label} ${a.renewal.validUntil} 까지 · 갱신 준비 ${a.renewal.prepareFrom} 부터`} data={{ kind: 'renewal', cert: a.key, ...a.renewal }} deadlines={deadlines} followUp={{ text: `${rule.label} 갱신 서류 준비`, days: Math.max(1, Math.min(90, a.renewal.daysLeft - 30)) }} openPathFor={(cid) => `/tools/cert-os/${a.key}?client=${cid}`} />
            ) : (
              <p className="t-sub break-keep text-slate-600">인증을 받으면 '3. 실제 진행' 의 [인증 완료 기록] 에 번호 · 인증일 · 유효기간을 적어 주세요 — 갱신 일정이 달력 · 오늘에 걸립니다(확인서를 서류함에 올려도 읽습니다).</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {(a.recommendation === 'held' || a.recommendation === 'now') && (
                <Link to={`/tools/policy-funding/diagnosis?client=${clientId}`} className="contents">
                  <Button variant="secondary" data-testid="cert-next-fund">
                    인증 활용 — 정책자금 검토하기
                  </Button>
                </Link>
              )}
              <ExplainButton set={explain} />
            </div>
          </div>
        </Surface>
      )}
    </div>
  )
}

