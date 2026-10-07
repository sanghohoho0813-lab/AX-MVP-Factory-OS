/**
 * 인증 한눈에 (D-170 → AX) — 5초 안에: 무엇을 먼저 · 왜 · 무엇을 누르나.
 *   1순위 인증 하나(이름 · 상태 하나 · 이유 1~2줄 · 단추 하나) → 작은 순서 줄 → 나머지 인증은 한 줄씩.
 *   정보가 모자라면 가짜 1위를 만들지 않는다 — '판단하려면 N가지만 더 확인해 주세요'.
 * 기능은 지우지 않았다: 근거 · 혜택 · 자료는 인증 화면 안으로, 고객용 요약 · 추가 기회 · 기준 출처는 작은 단추 뒤로.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Lightbulb } from 'lucide-react'
import { Blank, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ClientPickerOptions } from '../../components/ops/ClientPickerOptions'
import { useToolClient } from '../../tools/shared/toolClientContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { CertificationAssessment, CertificationClientContext, CertificationKey } from '../core/types'
import type { Roadmap } from '../core/roadmap'
import { CONFLICT_LINE, type CertProfile } from '../integration/clientContext'
import { ExpiredBadge, RecBadge } from './certParts'
import { focusOf, MoreQuestions, openQuestions, questionsFor, QuestionStepper } from './ProfileQuestions'
import { sectionHref } from './certNav'
import { ClientSummarySheet } from './ClientSummarySheet'
import { RulesInfoButton } from './RulesSheet'

const SECTION: Record<CertificationKey, string> = { venture: 'venture', lab: 'lab', innobiz: 'innobiz', mainbiz: 'mainbiz', iso9001: 'iso', iso14001: 'iso', iso45001: 'iso' }
const CERT_KEYS = new Set<string>(['venture', 'lab', 'innobiz', 'mainbiz', 'iso9001', 'iso14001', 'iso45001'])
const NUM = ['①', '②', '③', '④', '⑤', '⑥']

/** 1순위 단추 말 — 상태에 맞는 한 마디 */
function ctaLabel(a: CertificationAssessment): string {
  if (a.recommendation === 'held') return `${a.label} 갱신 준비`
  if (a.key.startsWith('iso')) return `${a.label} 상담 요청`
  return `${a.label} 준비 시작`
}

/** 1순위 — 추천 순서의 첫 인증(특허 보강 · 정책자금 같은 비인증 걸음은 건너뛴다) */
export function heroOf(list: readonly CertificationAssessment[], roadmap: Roadmap): CertificationAssessment | null {
  const first = roadmap.steps.find((s) => CERT_KEYS.has(s.id))
  return first ? (list.find((a) => a.key === first.id) ?? null) : null
}

/** 업체 없이 열었을 때 — 업체부터 고른다 */
export function PickClient() {
  const { loadClients } = useToolClient()
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadClients().then((l) => alive && setClients(l.filter((c) => c.archivedAt === null)))
    return () => {
      alive = false
    }
  }, [loadClients])
  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="cert-pick-client">
        <p className="t-body font-semibold text-slate-900">어느 업체의 인증을 볼까요?</p>
        <p className="t-sub break-keep text-slate-600">업체를 고르면 업체 기록 · 서류함 · 회사 정보를 읽어 맞는 인증과 이유를 바로 보여 드립니다.</p>
        {clients && clients.length === 0 ? (
          <Blank title="아직 업체가 없습니다. 고객 관리에서 업체를 먼저 등록해 주세요." />
        ) : (
          <label className="flex flex-col gap-1">
            <span className="sr-only">업체</span>
            <select
              defaultValue=""
              onChange={(e) => e.target.value && navigate(`?client=${e.target.value}`)}
              className="tap t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none sm:max-w-md"
              data-testid="cert-client-select"
            >
              <option value="">업체 고르기</option>
              {clients && <ClientPickerOptions clients={clients.map((c) => ({ id: c.id, companyName: c.companyName, businessNumber: c.businessNumber, corporateNumber: c.corporateNumber }))} />}
            </select>
          </label>
        )}
      </div>
    </Surface>
  )
}


/** 컨설턴트 내부 — '추가 기회'(고객 화면 · 요약에는 없음) */
function followUps(ctx: CertificationClientContext, list: readonly CertificationAssessment[]): string[] {
  const items: string[] = []
  if (ctx.researchUnit !== 'lab' && list.find((a) => a.key === 'lab')?.recommendation !== 'need_info') items.push('기업부설연구소')
  if (ctx.patents === 0) items.push('특허')
  if (list.some((a) => a.recommendation === 'held' && (a.key === 'innobiz' || a.key === 'mainbiz' || a.key === 'venture'))) items.push('정책자금(인증 활용)')
  items.push('정부지원사업')
  if (ctx.employees !== null && ctx.employees >= 10) items.push('AX 구축')
  return items
}

function Hero({ a, clientId }: { a: CertificationAssessment; clientId: string | null }) {
  const why = a.reasons.find((r) => r.state === 'ok')
  const benefit = a.benefits[0]
  return (
    <Surface showEdge edge={a.recommendation === 'now' || a.recommendation === 'held' ? 'success' : 'brand'}>
      <div className="flex flex-col gap-2.5" data-testid="cert-hero" data-key={a.key}>
        <span className="t-sub font-semibold text-brand-700">먼저 할 인증</span>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="t-section font-bold text-slate-900">{a.label}</h2>
          <RecBadge rec={a.recommendation} />
          {a.expired && <ExpiredBadge />}
        </div>
        <p className="t-body font-semibold break-keep text-slate-800" data-testid="cert-oneline">
          {a.oneLine}
        </p>
        {why && <p className="t-sub break-keep text-slate-600">✓ {why.text}</p>}
        {benefit && (
          <p className="t-sub break-keep text-slate-600" data-testid="cert-hero-benefit">
            쓸모 · {benefit.title}
          </p>
        )}
        <Link to={sectionHref(SECTION[a.key], clientId)} className="contents">
          <Button variant="primary" className="self-start" data-testid="cert-cta">
            {ctaLabel(a)} <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </Link>
      </div>
    </Surface>
  )
}

function InfoHero({ n, asking, onAsk }: { n: number; asking: boolean; onAsk: () => void }) {
  return (
    <Surface showEdge edge="warning">
      <div className="flex flex-col gap-2.5" data-testid="cert-hero" data-key="need_info">
        <span className="t-sub font-semibold text-warning-800">아직 1순위를 정하지 않았습니다</span>
        <h2 className="t-section font-bold break-keep text-slate-900">판단하려면 {n}가지만 더 확인해 주세요</h2>
        <p className="t-sub break-keep text-slate-600">모르는 것을 추측해서 추천하지 않습니다 — 고르면 바로 다시 판단합니다.</p>
        {!asking && (
          <Button variant="primary" className="self-start" onClick={onAsk} data-testid="cert-cta">
            정보 확인하기
          </Button>
        )}
      </div>
    </Surface>
  )
}

function RoadmapLine({ roadmap }: { roadmap: Roadmap }) {
  if (roadmap.steps.length < 2 && roadmap.later.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 px-1" data-testid="cert-roadmap">
      {roadmap.steps.length >= 2 && (
        <p className="t-sub flex flex-wrap items-center gap-x-1 gap-y-0.5 break-keep text-slate-700">
          <span className="font-semibold text-slate-500">순서</span>
          {roadmap.steps.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1" data-testid="cert-roadmap-step">
              {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-slate-400" />}
              <span className={i === 0 ? 'font-semibold text-slate-900' : ''}>
                {NUM[i]} {s.label}
              </span>
            </span>
          ))}
        </p>
      )}
      {roadmap.later.length > 0 && <p className="t-sub break-keep text-slate-500">나중에 · {roadmap.later.map((l) => `${l.label}(${l.when})`).join(' · ')}</p>}
      {roadmap.steps.length >= 2 && (
        <details data-testid="cert-roadmap-why-box">
          <summary className="tap t-sub inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-brand-700 [&::-webkit-details-marker]:hidden" data-testid="cert-roadmap-why">
            <ChevronDown aria-hidden="true" className="size-4" />
            왜 이 순서인가요?
          </summary>
          <ol className="flex flex-col gap-1 pt-1">
            {roadmap.steps.map((s, i) => (
              <li key={s.id} className="t-sub break-keep text-slate-700">
                <b className="font-semibold">
                  {NUM[i]} {s.label}
                </b>{' '}
                — {s.why}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

/** 나머지 인증 — 이름 · 상태 하나 · 한 줄 · › (큰 카드 반복 없음) */
function CertRow({ a, clientId }: { a: CertificationAssessment; clientId: string | null }) {
  return (
    <li>
      <Link to={sectionHref(SECTION[a.key], clientId)} className="tap flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5" data-testid="cert-row" data-key={a.key}>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="t-body font-bold text-slate-900">{a.label}</span>
            <RecBadge rec={a.recommendation} />
            {a.expired && <ExpiredBadge />}
          </span>
          <span className="t-sub line-clamp-2 break-keep text-slate-600" data-testid="cert-oneline">{a.oneLine}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
      </Link>
    </li>
  )
}

export function CertOverview({
  ctx,
  list,
  roadmap,
  profile,
  onProfile,
  clientId,
  pendingFacts,
  onConfirmFacts,
}: {
  ctx: CertificationClientContext
  list: CertificationAssessment[]
  roadmap: Roadmap
  profile: CertProfile
  onProfile: (patch: Partial<CertProfile>) => void
  clientId: string | null
  pendingFacts: { label: string; value: string }[]
  onConfirmFacts: () => Promise<number>
}) {
  const order: CertificationKey[] = ['venture', 'lab', 'innobiz', 'mainbiz', 'iso9001']
  const main = order.map((k) => list.find((a) => a.key === k)).filter((a): a is CertificationAssessment => !!a)
  const hero = heroOf(list, roadmap)
  const qs = questionsFor(ctx, profile, focusOf(main, hero?.key ?? null))
  const open = openQuestions(qs, profile)
  const needInfo = !hero && main.some((a) => a.recommendation === 'need_info')
  const [asking, setAsking] = useState(false)
  const [summary, setSummary] = useState(false)
  const [more, setMore] = useState(false)
  const rest = main.filter((a) => a.key !== hero?.key)
  return (
    <div className="flex flex-col gap-4">
      {hero ? (
        <Hero a={hero} clientId={clientId} />
      ) : needInfo && open.length > 0 ? (
        <InfoHero n={Math.min(3, open.length)} asking={asking} onAsk={() => setAsking(true)} />
      ) : (
        <Surface>
          <div className="flex flex-col gap-1.5" data-testid="cert-hero" data-key="none">
            <h2 className="t-section font-bold text-slate-900">지금 바로 진행할 인증은 없습니다</h2>
            <p className="t-sub break-keep text-slate-600">아래 인증마다 언제 · 무엇이 생기면 다시 볼지 적어 두었습니다.</p>
          </div>
        </Surface>
      )}
      {ctx.conflicts && ctx.conflicts.length > 0 && (
        <details className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3" data-testid="cert-conflicts">
          <summary className="tap t-sub flex cursor-pointer items-center gap-1.5 font-semibold break-keep text-warning-800">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" /> {CONFLICT_LINE}
          </summary>
          <ul className="flex flex-col gap-0.5 pb-2">
            {ctx.conflicts.map((c) => (
              <li key={c} className="t-sub break-keep text-slate-700">
                · {c}
              </li>
            ))}
          </ul>
        </details>
      )}
      {open.length > 0 && (
        <Surface>
          <div className="flex flex-col gap-2" data-testid="cert-questions">
            {asking ? (
              <QuestionStepper qs={qs} profile={profile} onChange={onProfile} />
            ) : needInfo ? null : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="t-sub break-keep text-slate-700">
                  <b className="font-semibold text-slate-900">더 정확하게</b> · {Math.min(3, open.length)}가지를 확인하면 판단이 정확해집니다
                </p>
                <Button variant="secondary" size="sm" onClick={() => setAsking(true)} data-testid="cert-ask-open">
                  정보 확인하기
                </Button>
              </div>
            )}
            <MoreQuestions qs={qs} profile={profile} onChange={onProfile} pendingFacts={pendingFacts} onConfirmFacts={onConfirmFacts} />
          </div>
        </Surface>
      )}
      {open.length === 0 && pendingFacts.length > 0 && <MoreQuestions qs={qs} profile={profile} onChange={onProfile} pendingFacts={pendingFacts} onConfirmFacts={onConfirmFacts} />}
      <RoadmapLine roadmap={roadmap} />
      {rest.length > 0 && (
        <Surface padded={false}>
          <h3 className="t-sub border-b border-slate-100 px-4 py-2.5 font-semibold text-slate-500 sm:px-5">{hero ? '다른 인증' : '인증별 상태'}</h3>
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="cert-rows">
            {rest.map((a) => (
              <CertRow key={a.key} a={a} clientId={clientId} />
            ))}
          </ul>
        </Surface>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button variant="ghost" size="sm" onClick={() => setSummary(true)} data-testid="cert-summary-open">
          <FileText aria-hidden="true" className="size-4" /> 고객용 요약
        </Button>
        <Button variant="ghost" size="sm" aria-expanded={more} onClick={() => setMore((v) => !v)} data-testid="cert-followup-open">
          <Lightbulb aria-hidden="true" className="size-4" /> 추가 기회
        </Button>
        <RulesInfoButton today={ctx.today} />
      </div>
      {more && (
        <p className="t-sub break-keep text-slate-600" data-testid="cert-followup">
          <b className="font-semibold text-slate-700">추가 제안 가능(내부 · 고객 화면에 안 보임)</b> · {followUps(ctx, list).join(' · ')}
        </p>
      )}
      {summary && <ClientSummarySheet list={list} ctx={ctx} roadmap={roadmap} onClose={() => setSummary(false)} />}
    </div>
  )
}
