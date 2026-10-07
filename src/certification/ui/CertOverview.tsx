/**
 * 인증 한눈에 (D-170) — 업체 하나를 열면 어떤 인증을 왜 · 지금 할지 · 무엇이 특히 유용한지 · 어떤 순서로.
 * 처음 화면에 다 펼치지 않는다: 카드마다 한 줄 이유 + 근거 3줄 + 혜택 칩 + 단추 하나. 나머지는 '자세히'.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileText, Info, Route } from 'lucide-react'
import { Blank, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ClientPickerOptions } from '../../components/ops/ClientPickerOptions'
import { useToolClient } from '../../tools/shared/toolClientContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import { CERT_RULES, rulesStale, RULES_CHECKED_AT } from '../rules/officialRules'
import type { CertificationAssessment, CertificationClientContext, CertificationKey } from '../core/types'
import type { Roadmap } from '../core/roadmap'
import type { CertProfile } from '../integration/clientContext'
import { ExpiredBadge, BenefitPicks, ReadinessBadge, ReasonList, RecBadge } from './certParts'
import { ProfileQuestions } from './ProfileQuestions'
import { sectionHref } from './certNav'
import { ClientSummarySheet } from './ClientSummarySheet'

/** 카드 단추 하나 — 인증마다 가장 자연스러운 다음 걸음 */
const CTA: Record<CertificationKey, { label: string; section: string }> = {
  venture: { label: '확인하기', section: 'venture' },
  lab: { label: '확인하기', section: 'lab' },
  innobiz: { label: '준비하기', section: 'innobiz' },
  mainbiz: { label: '준비하기', section: 'mainbiz' },
  iso9001: { label: '상담 요청', section: 'iso' },
  iso14001: { label: '상담 요청', section: 'iso' },
  iso45001: { label: '상담 요청', section: 'iso' },
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

function RoadmapCard({ roadmap }: { roadmap: Roadmap }) {
  const [why, setWhy] = useState(false)
  if (roadmap.steps.length === 0 && roadmap.later.length === 0) return null
  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="cert-roadmap">
        <h3 className="t-body inline-flex items-center gap-1.5 font-bold text-slate-900">
          <Route aria-hidden="true" className="size-4 text-brand-600" /> 추천 진행 순서
        </h3>
        {roadmap.steps.length > 0 ? (
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {roadmap.steps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />}
                <span className="t-body rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-semibold text-brand-800" data-testid="cert-roadmap-step">
                  {['①', '②', '③', '④', '⑤', '⑥'][i]} {s.label}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="t-sub text-slate-600">지금 진행할 인증은 없습니다.</p>
        )}
        {roadmap.later.length > 0 && (
          <p className="t-sub break-keep text-slate-600">
            나중에: {roadmap.later.map((l) => `${l.label}(${l.when})`).join(' · ')}
          </p>
        )}
        {roadmap.steps.length > 0 && (
          <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="cert-roadmap-why">
            왜 이 순서인가요?
          </button>
        )}
        {why && (
          <ol className="flex flex-col gap-1.5">
            {roadmap.steps.map((s, i) => (
              <li key={s.id} className="t-sub break-keep text-slate-700">
                <b className="font-semibold">
                  {['①', '②', '③', '④', '⑤', '⑥'][i]} {s.label}
                </b>{' '}
                — {s.why}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Surface>
  )
}

function CertCard({ a, clientId }: { a: CertificationAssessment; clientId: string | null }) {
  const [more, setMore] = useState(false)
  const cta = CTA[a.key]
  const strong = a.recommendation === 'now' || a.recommendation === 'possible'
  return (
    <Surface as="li" showEdge={strong || a.recommendation === 'held'} edge={a.recommendation === 'held' || a.recommendation === 'now' ? 'success' : 'brand'}>
      <div className="flex flex-col gap-2.5" data-testid="cert-card" data-key={a.key}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="t-section font-bold text-slate-900">{a.label}</h3>
          <RecBadge rec={a.recommendation} />
          {a.expired && <ExpiredBadge />}
          {!(a.recommendation === 'need_info' && a.readiness === 'unknown') && <ReadinessBadge r={a.readiness} />}
        </div>
        <p className="t-body font-semibold break-keep text-slate-800" data-testid="cert-oneline">
          {a.oneLine}
        </p>
        <ReasonList reasons={a.reasons} max={more ? undefined : 3} />
        <BenefitPicks picks={a.benefits.slice(0, more ? 5 : 3)} />
        {more && (
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
            <p className="t-sub break-keep text-slate-700">
              <b className="font-semibold">언제</b> · {a.timing}
            </p>
            {a.renewal && (
              <p className="t-sub break-keep text-slate-700">
                <b className="font-semibold">유효기간</b> · {a.renewal.validUntil} 까지({a.renewal.daysLeft >= 0 ? `${a.renewal.daysLeft}일 남음` : `${-a.renewal.daysLeft}일 지남`}) · 갱신 준비 {a.renewal.prepareFrom} 부터
              </p>
            )}
            {a.missingFacts.length > 0 && (
              <p className="t-sub break-keep text-warning-800">
                <b className="font-semibold">대표 확인 필요</b> · {a.missingFacts.join(' · ')}
              </p>
            )}
            {a.missingEvidence.length > 0 && (
              <p className="t-sub break-keep text-slate-700">
                <b className="font-semibold">더 받을 자료</b> · {a.missingEvidence.join(' · ')}
              </p>
            )}
            {a.haveEvidence.length > 0 && (
              <p className="t-sub break-keep text-success-700">
                <b className="font-semibold">이미 있는 자료</b> · {a.haveEvidence.join(' · ')}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Link to={sectionHref(cta.section, clientId)} className="contents">
            <Button variant={strong ? 'primary' : 'secondary'} data-testid="cert-cta">
              {cta.label}
            </Button>
          </Link>
          <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="tap t-sub inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900" data-testid="cert-more">
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${more ? 'rotate-180' : ''}`} /> {more ? '접기' : '자세히'}
          </button>
        </div>
      </div>
    </Surface>
  )
}

/** 컨설턴트 내부 화면에서만 — 차분하게 '추가 제안 가능' */
function FollowUpSales({ ctx, list }: { ctx: CertificationClientContext; list: CertificationAssessment[] }) {
  const items: string[] = []
  if (ctx.researchUnit !== 'lab' && list.find((a) => a.key === 'lab')?.recommendation !== 'need_info') items.push('기업부설연구소')
  if (ctx.patents === 0) items.push('특허')
  if (list.some((a) => a.recommendation === 'held' && (a.key === 'innobiz' || a.key === 'mainbiz' || a.key === 'venture'))) items.push('정책자금(인증 활용)')
  items.push('정부지원사업')
  if (ctx.employees !== null && ctx.employees >= 10) items.push('AX 구축')
  return (
    <p className="t-sub break-keep text-slate-500" data-testid="cert-followup">
      <b className="font-semibold text-slate-600">추가 제안 가능(내부)</b> · {items.join(' · ')}
    </p>
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
  const stale = Object.values(CERT_RULES).some((r) => rulesStale(r, ctx.today))
  const [summary, setSummary] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <RoadmapCard roadmap={roadmap} />
      <ProfileQuestions ctx={ctx} profile={profile} onChange={onProfile} pendingFacts={pendingFacts} onConfirmFacts={onConfirmFacts} />
      <ul className="flex flex-col gap-3" data-testid="cert-cards">
        {main.map((a) => (
          <CertCard key={a.key} a={a} clientId={clientId} />
        ))}
      </ul>
      <Button variant="secondary" className="self-start" onClick={() => setSummary(true)} data-testid="cert-summary-open">
        <FileText aria-hidden="true" className="size-4" /> 고객용 진단 요약
      </Button>
      {summary && <ClientSummarySheet list={list} ctx={ctx} roadmap={roadmap} onClose={() => setSummary(false)} />}
      <p className={`t-sub inline-flex items-start gap-1.5 break-keep ${stale ? 'text-warning-800' : 'text-slate-500'}`} data-testid="cert-freshness">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {stale ? '최신 기준 확인 필요 — ' : ''}공식 기준 마지막 확인 {RULES_CHECKED_AT}(중소벤처기업부 고시 · 법령 · 이노비즈넷 · 중소벤처24 · ISO). 준비도는 MIRAE 자체 5단계이고, 공식 점수는 인증별 화면에 따로 적었습니다.
      </p>
      <FollowUpSales ctx={ctx} list={list} />
    </div>
  )
}
