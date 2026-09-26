/**
 * 미팅 준비 › 크레탑에서 가져온 전략 (D-119).
 *
 * 크레탑 분석기 '제안' 탭의 26개 전략 순위를 미팅 준비로 끌어온다. 대표 지시 — "영업 전략을 짤 때부터 크레탑 기능을
 * 끌어오고, 하나하나 누르면 이것저것 너무 많이 써 있어 정신없다. 지우지 말고 합리적으로."
 *
 * 그래서
 *  - 전략마다 질문 5단계(A 오프닝 · B 현황 · C 문제 인식 · D 제안 연결 · E 다음 액션)를 차수에 나눠,
 *    지금 고른 차수의 질문만 앞에 보인다(1차 A·B·C · 2차 D · 3차 E). 나머지 차수 질문은 흐리게 아래에.
 *  - 추천 멘트 · 복사 단추를 바로 옆에. 추천 이유 · 핵심 확인사항 · 문제 제기 · 이대로 두면 · 요청 자료 · 기대 효과는
 *    '더 보기' 안에 — 글은 하나도 지우지 않았다.
 */
import { localDateOf } from '../../lib/appClock'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, FileSearch, ScanSearch } from 'lucide-react'
import { Badge, Disclosure, type Tone } from '../ui/primitives'
import { CopyButton, PillList } from './salesParts'
import { rampAt } from './salesColor'
import { CRETOP_TIER_LABEL, FLOW_ROUND, cretopForMeeting, meetingPicks, type CretopPick, type CretopTier } from '../../services/salesCretop'
import type { ClientOpsRecord } from '../../types/clientOps'

const TIER_TONE: Record<CretopTier, Tone> = { top: 'brand', rec: 'success', cond: 'warning', low: 'neutral' }
const DIAG_DOT: Record<string, string> = { bad: 'bg-danger-500', warn: 'bg-warning-500', good: 'bg-success-500', info: 'bg-slate-300' }
const DIAG_LABEL: Record<string, string> = { bad: '위험', warn: '주의', good: '기회', info: '참고' }

type Round = 0 | 1 | 2 | 3

function StrategyCard({ pick, round, index, count, defaultOpen }: { pick: CretopPick; round: Round; index: number; count: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const st = pick.strategy
  const now = round === 0 ? pick.flow.filter((f) => f.step === 'A') : pick.flow.filter((f) => FLOW_ROUND[f.step] === round)
  const later = pick.flow.filter((f) => !now.includes(f))
  const reason = pick.reasons.find((r) => !r.startsWith('이미 보유')) ?? st.why
  return (
    <li data-cretop-pick={pick.name} className="relative overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white">
      <span aria-hidden="true" className="ramp-bar absolute inset-y-0 left-0 w-[3px]" style={rampAt(index, Math.max(2, count))} />
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tap flex w-full items-start gap-2 px-3.5 py-2.5 pl-4 text-left hover:bg-slate-50">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-sub inline-flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
            {pick.name}
            <span className="t-meta font-medium text-slate-400">{pick.cat}</span>
            {pick.score > 0 && <Badge tone={TIER_TONE[pick.tier]}>{CRETOP_TIER_LABEL[pick.tier]}</Badge>}
            {pick.held && <Badge tone="warning">이미 보유</Badge>}
          </span>
          {reason && <span className="t-meta break-keep text-slate-500">{reason}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 px-3.5 py-3 pl-4">
          <div className="flex flex-col gap-1.5" data-testid="cretop-flow-now">
            <p className="t-meta font-semibold text-slate-500">{round === 0 ? '첫 연락에서 꺼낼 말' : `${round}차에서 물을 것`}</p>
            {now.map((f) => (
              <p key={f.step} className="t-body flex items-start gap-2 break-keep text-slate-800">
                <span className="t-meta mt-0.5 inline-flex shrink-0 items-center rounded border border-slate-200 bg-slate-50 px-1.5 font-bold text-slate-500">
                  {f.step} {f.label}
                </span>
                <span className="min-w-0 flex-1">{f.q}</span>
                <CopyButton text={f.q} />
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1 rounded-(--radius-control) bg-brand-50/60 px-3 py-2">
            <p className="t-meta font-semibold text-brand-700">추천 멘트</p>
            <p className="t-body flex items-start gap-2 break-keep text-slate-800">
              <span className="min-w-0 flex-1">“{st.ment}”</span>
              <CopyButton text={st.ment} />
            </p>
          </div>
          {later.length > 0 && (
            <ul className="flex flex-col gap-1">
              {later.map((f) => (
                <li key={f.step} className="t-meta flex gap-2 break-keep text-slate-500">
                  <span className="shrink-0 font-semibold">
                    {FLOW_ROUND[f.step]}차 · {f.step} {f.label}
                  </span>
                  <span className="min-w-0">{f.q}</span>
                </li>
              ))}
            </ul>
          )}
          <Disclosure title="더 보기" hint="추천 이유 · 확인사항 · 문제 제기 · 요청 자료 · 기대 효과">
            <div className="flex flex-col gap-2.5">
              <Block title="추천 이유" items={pick.reasons.length ? pick.reasons : [st.why]} />
              <Block title="핵심 확인사항" items={st.interest} />
              {st.problem && <Block title="문제 제기" items={[st.problem]} />}
              {st.implication && <Block title="이대로 두면" items={[st.implication]} />}
              <div>
                <p className="t-meta mb-1 font-semibold text-slate-500">요청 자료</p>
                <PillList items={pick.docs} />
              </div>
              <Block title="기대 효과" items={st.effects} />
            </div>
          </Disclosure>
        </div>
      )}
    </li>
  )
}

function Block({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="t-meta mb-0.5 font-semibold text-slate-500">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map((x) => (
          <li key={x} className="t-sub break-keep text-slate-700">
            · {x}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CretopMeetingPanel({ record, round }: { record: ClientOpsRecord; round: Round }) {
  const m = cretopForMeeting(record)
  if (!m) {
    return (
      <section data-testid="cretop-meeting" data-empty="1" className="flex flex-col items-start gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-4 py-4 sm:flex-row sm:items-center">
        <ScanSearch aria-hidden="true" className="size-6 shrink-0 text-brand-500" />
        <p className="t-sub min-w-0 flex-1 break-keep text-slate-600">
          크레탑 보고서를 넣으면 재무 · 신용으로 먼저 꺼낼 전략과 차수별 질문이 여기 붙고, 빈 기본 정보도 채워집니다.
        </p>
        <Link to={`/sales/new?client=${record.id}`} className="t-sub shrink-0 font-semibold text-brand-700 hover:underline">
          크레탑 보고서 넣기 →
        </Link>
      </section>
    )
  }
  const picks = meetingPicks(m, 5)
  const docs = [...new Set(picks.flatMap((p) => p.docs))].slice(0, 12)
  return (
    <section data-testid="cretop-meeting" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-card inline-flex items-center gap-2 font-bold text-slate-900">
          <FileSearch aria-hidden="true" className="size-5 text-brand-600" />
          크레탑에서 가져온 전략
          <span className="t-meta font-medium text-slate-500">
            {localDateOf(m.at)} 분석 · {m.selected.length ? `분석기에서 고른 ${m.selected.length}개` : '추천 순'}
          </span>
        </h2>
        <Link to={`/tools/cretop/analyze?client=${record.id}`} className="t-meta font-semibold text-brand-700 hover:underline">
          크레탑 분석기에서 전체 보기 →
        </Link>
      </div>
      {m.diagnosis.length > 0 && (
        <ul data-testid="cretop-diagnosis" className="flex flex-col gap-1">
          {m.diagnosis.slice(0, 5).map((l) => (
            <li key={l.text} className="t-sub flex items-start gap-2 break-keep text-slate-700">
              <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${DIAG_DOT[l.tone] ?? 'bg-slate-300'}`} />
              <span className="sr-only">{DIAG_LABEL[l.tone]}</span>
              <span className="min-w-0">{l.text}</span>
            </li>
          ))}
        </ul>
      )}
      <ol className="flex flex-col gap-2">
        {picks.map((p, i) => (
          <StrategyCard key={`${record.id}-${p.name}`} pick={p} round={round} index={i} count={picks.length} defaultOpen={i === 0} />
        ))}
      </ol>
      {round >= 1 && docs.length > 0 && (
        <div>
          <p className="t-meta mb-1 font-semibold text-slate-500">이 전략들로 요청할 자료</p>
          <PillList items={docs} />
        </div>
      )}
      <p className="t-meta break-keep text-slate-400">크레탑 원문 기준 규칙 계산입니다 — 실제 상담 전 원문 확인이 필요합니다.</p>
    </section>
  )
}
