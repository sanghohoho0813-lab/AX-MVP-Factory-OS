/**
 * 인증 하나 — 벤처 · 연구소 · 이노비즈 · 메인비즈가 같은 4단계 문법 (D-170).
 *   1 받을 수 있나요?  2 무엇을 준비하나요?  3 실제 진행  4 받으면 무엇이 달라지나요?
 * 벤처 · 연구소는 기존 화면(특허+벤처 · 연구소 관리)으로 이어 준다 — 다시 만들지 않는다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ToolResultAttach } from '../../tools/shared/ToolResultAttach'
import { CERT_RULES, rulesStale } from '../rules/officialRules'
import { explainFor } from '../core/explain'
import { READINESS_LABEL, RECOMMENDATION_LABEL, type CertificationAssessment, type CertificationClientContext } from '../core/types'
import type { Answer } from '../core/selfCheck'
import type { PreparedAnswer } from '../core/inspection'
import { INNOBIZ_CHECK, INNOBIZ_INSPECTION } from '../innobiz/innobizCheck'
import { MAINBIZ_CHECK, MAINBIZ_INSPECTION } from '../mainbiz/mainbizCheck'
import { ExpiredBadge, BenefitPicks, ExplainBox, ReadinessBadge, ReasonList, RecBadge, StepTabs } from './certParts'
import { InspectionFlow, SelfCheckFlow } from './SelfCheckFlow'
import { brand } from '../../brand/brand.config'
import { useToast } from '../../components/ui/toastContext'
import type { CertLifecycle, CertStatus, CompletionInput } from '../core/lifecycle'
import { LifecyclePanel } from './LifecyclePanel'
import { PreInspectionPanel } from './PreInspectionPanel'
import { BasisBox } from './BasisBox'

const EVIDENCE_LABEL = Object.fromEntries(Object.values(CERT_RULES).flatMap((r) => r.evidence.map((e) => [e.id, e.label])))
const labelOf = (id: string) => EVIDENCE_LABEL[id] ?? id

export function CertWorkspace({
  a,
  ctx,
  clientId,
  answers,
  prep,
  onAnswer,
  onPrep,
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
  onAnswer: (id: string, v: Answer) => void
  onPrep: (id: string, p: PreparedAnswer) => void
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
  const [flow, setFlow] = useState<'none' | 'self' | 'inspect' | 'summary'>('none')
  const requestDocs = async () => {
    const text = explain.docRequest
    const added = a.missingEvidence.length ? await onRequestDocs(a.missingEvidence).catch(() => -1) : 0
    const copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false)
    showToast(added < 0 ? '서류함에 칸을 만들지 못했습니다 — 문구는 아래에서 복사해 주세요' : `${copied ? '요청 문구를 복사했습니다' : '요청 문구는 아래에서 복사해 주세요'}${added > 0 ? ` · 서류함에 칸 ${added}개` : ''}`)
  }
  const selfItems = a.key === 'innobiz' ? INNOBIZ_CHECK : a.key === 'mainbiz' ? MAINBIZ_CHECK : null
  const inspectQs = a.key === 'innobiz' ? INNOBIZ_INSPECTION : a.key === 'mainbiz' ? MAINBIZ_INSPECTION : null
  const explain = explainFor(a, ctx, `${brand.ownerName} 대표`)
  const existingTool = a.key === 'venture' ? { label: '특허+벤처 화면 열기', href: `/ops/clients/${clientId}?tab=consulting` } : a.key === 'lab' ? { label: '연구소 관리 열기', href: `/tools/labcare?client=${clientId}` } : null
  const deadlines = a.renewal
    ? [
        { date: a.renewal.prepareFrom, title: `${rule.label} 갱신 준비 시작`, note: rule.renewalNote, todo: true as const },
        { date: a.renewal.validUntil, title: `${rule.label} 유효기간 끝`, note: '', hard: true as const },
      ]
    : []
  return (
    <div className="flex flex-col gap-4" data-testid="cert-workspace" data-key={a.key}>
      <Surface>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-section font-bold text-slate-900">{rule.label}</h2>
            <RecBadge rec={a.recommendation} />
            {a.expired && <ExpiredBadge />}
            {!(a.recommendation === 'need_info' && a.readiness === 'unknown') && <ReadinessBadge r={a.readiness} />}
          </div>
          <p className="t-body font-semibold break-keep text-slate-800">{a.oneLine}</p>
          <p className="t-sub break-keep text-slate-600">{rule.summary}</p>
        </div>
      </Surface>
      <StepTabs step={step} onStep={(n) => { setStep(n); setFlow('none') }} />

      {step === 0 && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-0">
            <p className="t-sub break-keep text-slate-600">
              판단: <b className="font-semibold text-slate-800">{RECOMMENDATION_LABEL[a.recommendation]}</b> · 준비도 <b className="font-semibold text-slate-800">{READINESS_LABEL[a.readiness]}</b>(MIRAE 자체 5단계) · {a.timing}
            </p>
            <ReasonList reasons={a.reasons} />
            {a.missingFacts.length > 0 && <p className="t-sub break-keep text-warning-800">대표 확인 필요 · {a.missingFacts.join(' · ')}</p>}
            {rule.officialScores && (
              <div className="rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3" data-testid="cert-official">
                <p className="t-sub font-semibold text-slate-800">공식 기준(숫자는 공식 점수만)</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {rule.officialScores.map((s) => (
                    <li key={s.label} className="t-sub break-keep text-slate-700">
                      · {s.label}: <b className="font-semibold">{s.value}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <BasisBox cert={a.key} ctx={ctx} />
            <Sources ruleKey={a.key} today={ctx.today} />
          </div>
        </Surface>
      )}

      {step === 1 && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-1">
            <ul className="flex flex-col gap-1.5">
              {rule.evidence.map((e) => {
                const have = a.haveEvidence.includes(e.label)
                return (
                  <li key={e.id} className={`t-sub flex flex-wrap items-baseline gap-x-2 break-keep ${have ? 'text-success-700' : 'text-slate-800'}`} data-testid="cert-evidence" data-have={have}>
                    <b className="font-semibold">{have ? '✓ 있음' : '받을 것'}</b> {e.label}
                    <span className="text-slate-500">— {e.why}</span>
                  </li>
                )
              })}
            </ul>
            <p className="t-sub break-keep text-slate-600">이미 서류함 · 회사 정보에 있는 자료는 다시 받지 않습니다.</p>
            <div className="flex flex-wrap gap-2">
              {a.missingEvidence.length > 0 && (
                <Button variant="primary" onClick={() => void requestDocs()} data-testid="cert-request-docs">
                  고객에게 자료 요청({a.missingEvidence.length})
                </Button>
              )}
              <Link to={`/ops/clients/${clientId}?tab=docs`} className="contents">
                <Button variant="secondary">서류함 열기</Button>
              </Link>
            </div>
            <ExplainBox set={{ ...explain, thirty: explain.docRequest }} />
          </div>
        </Surface>
      )}

      {step === 2 && flow === 'none' && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-2">
            <LifecyclePanel cert={a.key} life={life} ctx={ctx} clientId={clientId} onStatus={onStatus} onComplete={onComplete} onPatch={onPatchLife} />
            <p className="t-sub font-semibold text-slate-800">절차</p>
            <ol className="flex flex-col gap-1">
              {rule.procedure.map((p, i) => (
                <li key={p} className="t-body break-keep text-slate-800">
                  {i + 1}. {p}
                </li>
              ))}
            </ol>
            {rule.fee && <p className="t-sub text-slate-600">수수료(공식 안내): {rule.fee}</p>}
            {selfItems && inspectQs ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setFlow('self')} data-testid="cert-selfcheck-start">
                  {Object.keys(answers).length ? '자가진단 이어서' : '자가진단 시작'}
                </Button>
                <Button variant="secondary" onClick={() => setFlow('inspect')} data-testid="cert-inspection-start">
                  실사 대비 시작
                </Button>
                <Button variant="secondary" onClick={() => setFlow('summary')} data-testid="cert-pre-summary">
                  실사 준비 요약 보기
                </Button>
              </div>
            ) : existingTool ? (
              <div className="flex flex-col gap-2">
                <p className="t-sub break-keep text-slate-600">{rule.label} 진행은 이미 있는 화면에서 합니다(같은 업체 기록).</p>
                <Link to={existingTool.href} className="contents">
                  <Button variant="primary" className="self-start" data-testid="cert-existing-tool">
                    <ExternalLink aria-hidden="true" className="size-4" /> {existingTool.label}
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        </Surface>
      )}
      {step === 2 && flow === 'self' && selfItems && <SelfCheckFlow rule={rule} items={selfItems} ctx={ctx} answers={answers} onAnswer={onAnswer} onDone={() => setFlow('inspect')} />}
      {step === 2 && flow === 'inspect' && inspectQs && <InspectionFlow qs={inspectQs} ctx={ctx} labelOf={labelOf} prep={prep} onPrep={onPrep} />}
      {step === 2 && flow === 'summary' && inspectQs && <PreInspectionPanel title={`${ctx.companyName} ${rule.label}`} qs={inspectQs} ctx={ctx} labelOf={labelOf} prep={prep} onClose={() => setFlow('none')} />}

      {step === 3 && (
        <Surface>
          <div className="flex flex-col gap-3" data-testid="cert-step-body-3">
            <BenefitPicks picks={a.benefits} />
            <details className="rounded-(--radius-control) border border-slate-200">
              <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-800" data-testid="cert-all-benefits">
                모든 혜택 보기({rule.benefits.length})
              </summary>
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {rule.benefits.map((b) => (
                  <li key={b.id} className="t-sub break-keep text-slate-700">
                    · <b className="font-semibold">{b.title}</b> — {b.detail}
                    {b.conditional && <span className="text-warning-800"> (적용 여부 추가 확인 필요)</span>}
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
            {(a.recommendation === 'held' || a.recommendation === 'now') && (
              <Link to={`/tools/policy-funding/diagnosis?client=${clientId}`} className="contents">
                <Button variant="secondary" className="self-start" data-testid="cert-next-fund">
                  인증 활용 — 정책자금 검토하기
                </Button>
              </Link>
            )}
            <div className="border-t border-slate-100 pt-3">
              <p className="t-sub mb-2 font-semibold text-slate-800">고객에게 설명하기</p>
              <ExplainBox set={explain} />
            </div>
          </div>
        </Surface>
      )}
    </div>
  )
}

function Sources({ ruleKey, today }: { ruleKey: keyof typeof CERT_RULES; today: string }) {
  const rule = CERT_RULES[ruleKey]
  const stale = rulesStale(rule, today)
  return (
    <details className="rounded-(--radius-control) border border-slate-200" data-testid="cert-sources">
      <summary className={`tap t-sub cursor-pointer px-3 py-2 font-semibold ${stale ? 'text-warning-800' : 'text-slate-700'}`}>
        {stale ? '최신 기준 확인 필요 — ' : ''}공식 출처 · 마지막 확인 {rule.checkedAt}
      </summary>
      <ul className="flex flex-col gap-1 px-3 pb-3">
        {rule.sources.map((s) => (
          <li key={s.name} className="t-sub break-keep text-slate-700">
            · {s.name} · {s.version} · 시행 {s.effective}{' '}
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="tap inline-flex min-h-10 items-center font-semibold text-brand-700 underline">
              원문
            </a>
          </li>
        ))}
        {(rule.conflicts ?? []).map((u) => (
          <li key={u} className="t-sub break-keep text-danger-700" data-testid="cert-conflict">
            · 공식 안내 상이 — 제출 전 확인 필요: {u}
          </li>
        ))}
        {rule.unverified.map((u) => (
          <li key={u} className="t-sub break-keep text-warning-800">
            · 확인 못 함: {u}
          </li>
        ))}
      </ul>
    </details>
  )
}
