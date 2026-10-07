/**
 * 영업 관리 › 전략 라이브러리 (D-114 4단계).
 *
 * 기업컨설팅 OS 에 흩어져 있던 상담 무기를 한 곳에 — 영업 전략 17 · 크레탑 무기 34 · 절세 전략 25 를 D-167 부터 주제 하나로 합쳐 보인다, 그리고 제안 주제 7 별로 '지금 연락할 고객'.
 * 문구는 원본 그대로. 찾기 · 분류로 좁히고, 한 줄을 누르면 펼쳐서 멘트 · 질문을 복사한다.
 * 크레탑 분석기 안의 추천(크레탑 결과에 붙는 것)과는 따로 둔다 — 그쪽은 분석 결과에 따라 달라지는 추천이고, 여기는 늘 보는 사전이다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { ScreenTitle, Surface } from '../../components/ui/primitives'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { NumberedList, PillList } from '../../components/sales/salesParts'
import { listClients } from '../../services/clientOpsService'
import { salesStageOf } from '../../services/salesPipeline'
import { STRATEGY_LIBRARY } from '../../services/salesEngine'
import { CRETOP_WEAPONS, PROPOSAL_TOPICS, TAX_STRATEGIES } from '../../services/salesLibrary'
import { customersForTopic } from '../../services/salesSignals'
import { rampAt } from '../../components/sales/salesColor'
import { todayLocalDate } from '../../lib/appClock'
import { SALES_STAGE_LABEL, type ClientOpsRecord } from '../../types/clientOps'

type SourceKey = 'strategy' | 'cretop' | 'tax'

/**
 * D-167: 세 목록(영업 전략 17 · 크레탑 무기 34 · 절세 전략 25 = 76)을 주제 하나로 합친다.
 * 대표: "똑같으면 굳이 76개로 나눠 놓을 이유가 없다" — 가지급금 · 정관 · 연구소 같은 주제가 세 곳에 따로 있었다.
 * 같은 주제는 한 줄로 모으고, 펼치면 세 목록의 내용(언제 꺼내나 · 물어볼 것 · 받을 자료 · 조심할 것)을 합쳐 보여 준다.
 * 멘트(이렇게 꺼낸다 · 마무리 말 · 연락 멘트)는 뺀다 — 포인트만(대표: 멘트 · 카톡 문구는 숨기자). 원본 목록은 그대로 둔다.
 */
const TOPIC_RULES: [string, RegExp][] = [
  ['articles', /정관/],
  ['retained', /미처분|이익잉여금/],
  ['succession', /가업승계|증여특례/],
  ['loan', /가지급금/],
  ['deposit', /가수금/],
  ['rnd-credit', /연구인력개발비/],
  ['lab', /연구소|전담부서/],
  ['welfare', /사내근로복지기금/],
  ['venture', /벤처/],
  ['innobiz', /이노비즈|메인비즈/],
  ['policy', /정책자금/],
  ['employ-sub', /고용지원금/],
  ['employ-credit', /통합고용세액공제/],
  ['exec-pay', /임원퇴직금|임원보수/],
  ['share-value', /주식가치/],
  ['burn', /이익소각|자기주식/],
  ['dividend', /배당/],
  ['insurance', /법인보험|퇴직연금|목적자금/],
  ['conversion', /법인전환/],
  ['related', /특수관계자|관계사/],
]
function topicKey(name: string): string {
  return TOPIC_RULES.find(([, re]) => re.test(name))?.[0] ?? name
}

interface Entry {
  id: string
  sources: SourceKey[]
  name: string
  cat: string
  /** 한 줄 요약 */
  line: string
  /** 펼친 내용 — [제목, 글] 또는 [제목, 목록] */
  body: ([string, string] | [string, string[]])[]
  search: string
}

const SOURCE_LABEL: Record<SourceKey, string> = { strategy: '영업', cretop: '크레탑', tax: '절세' }

interface Part {
  source: SourceKey
  name: string
  cat: string
  when: string[]
  what: string[]
  cretop: string[]
  ask: string[]
  docs: string[]
  caution: string[]
  fee: string[]
  search: string
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))]
const splitDocs = (s: string) => s.split(/[,·]|\s및\s/).map((x) => x.trim()).filter(Boolean)

function parts(): Part[] {
  const out: Part[] = []
  for (const s of STRATEGY_LIBRARY) {
    out.push({
      source: 'strategy', name: s.name, cat: s.fields[0] ?? '', when: [s.fit], what: [], cretop: [],
      ask: s.questions, docs: s.docs, caution: [s.risk], fee: [`${s.fee}${s.needTaxPro ? ' · 세무사 검토 필요' : ''}`],
      search: `${s.name} ${s.fit} ${s.pitch} ${s.fields.join(' ')}`,
    })
  }
  for (const t of TAX_STRATEGIES) {
    out.push({
      source: 'tax', name: t.name, cat: t.cat, when: [t.who], what: [t.concept], cretop: [],
      ask: [t.question], docs: t.docs, caution: [t.caution], fee: [],
      search: `${t.name} ${t.cat} ${t.concept} ${t.who}`,
    })
  }
  for (const g of CRETOP_WEAPONS) {
    for (const w of g.items) {
      out.push({
        source: 'cretop', name: w.name, cat: g.cat, when: [w.p], what: [], cretop: [w.r],
        ask: [w.q], docs: splitDocs(w.d), caution: [], fee: [],
        search: `${w.name} ${g.cat} ${w.p} ${w.r} ${w.q}`,
      })
    }
  }
  return out
}

function buildEntries(): Entry[] {
  const groups = new Map<string, Part[]>()
  for (const p of parts()) {
    const k = topicKey(p.name)
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.entries()].map(([k, ps]) => {
    const first = ps[0]
    const all = (f: (p: Part) => string[]) => uniq(ps.flatMap(f))
    const when = all((p) => p.when)
    const body: Entry['body'] = []
    if (when.length) body.push(['언제 꺼내나', when.join('\n')])
    const what = all((p) => p.what)
    if (what.length) body.push(['무엇', what.join('\n')])
    const cr = all((p) => p.cretop)
    if (cr.length) body.push(['크레탑에서 볼 것', cr.join('\n')])
    const ask = all((p) => p.ask)
    if (ask.length) body.push(['물어볼 것', ask])
    const docs = all((p) => p.docs)
    if (docs.length) body.push(['받을 자료', docs])
    const caution = all((p) => p.caution)
    if (caution.length) body.push(['조심할 것', caution.join('\n')])
    const fee = all((p) => p.fee)
    if (fee.length) body.push(['수임료 범위 (내부)', fee.join(' · ')])
    return {
      id: `topic-${k}`,
      sources: uniq(ps.map((p) => p.source)) as SourceKey[],
      name: first.name,
      cat: first.cat,
      line: when[0] ?? what[0] ?? '',
      body,
      search: ps.map((p) => `${p.name} ${p.search}`).join(' '),
    }
  })
}

function EntryRow({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white" data-testid="library-entry" data-sources={e.sources.join(',')}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tap flex w-full items-start gap-2 px-3.5 py-3 text-left">
        <ChevronRight aria-hidden="true" className={`mt-1 size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="t-body font-bold text-slate-900">{e.name}</span>
            <span className="t-meta text-slate-400">{e.cat}{e.sources.length > 1 ? ` · ${e.sources.map((x) => SOURCE_LABEL[x]).join(' · ')} 합침` : ''}</span>
          </span>
          {!open && <span className="t-sub mt-0.5 line-clamp-1 block break-keep text-slate-500">{e.line}</span>}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 px-3.5 py-3">
          {e.body.map((b) => (
            <div key={b[0]} className="flex flex-col gap-1">
              <span className="t-meta font-semibold text-slate-500">{b[0]}</span>
              {typeof b[1] === 'string' ? <p className="t-sub break-keep whitespace-pre-line text-slate-700">{b[1]}</p> : b[0].includes('자료') ? <PillList items={b[1]} /> : <NumberedList items={b[1]} />}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

const LIB_FIRST = 12

function LibraryContent({ workspaceId }: { workspaceId: string | null }) {
  const today = todayLocalDate()
  const entries = useMemo(buildEntries, [])
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  useEffect(() => {
    let alive = true
    void listClients(workspaceId)
      .then((l) => { if (alive) setRecords(l) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [workspaceId])

  const list = entries.filter((e) => q.trim() === '' || e.search.includes(q.trim()))
  const topics = useMemo(() => PROPOSAL_TOPICS.map((t) => ({ t, list: customersForTopic(records, t) })), [records])

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="영업 관리" sub={`${today} · 컨설팅 주제 사전 — 주제별 지금 연락할 고객`} />
      <SalesTabs />

      <Surface className="flex flex-col gap-3">
        <h2 className="t-section text-slate-900">주제별 — 지금 연락할 고객</h2>
        {/* D-122: 연락할 곳이 있는 주제만 칸으로 — 없는 주제는 한 줄에 모은다(휴대폰에서 8칸이 화면 두 장이었다) */}
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="topic-list">
          {topics.map(({ t, list: cs }, ti) => cs.length === 0 ? null : (
            <li key={t.key} className="relative flex flex-col gap-1 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 pl-4">
              <span aria-hidden="true" className="ramp-bar absolute inset-y-0 left-0 w-[3px]" style={rampAt(ti, topics.length)} />
              <span className="flex items-baseline justify-between gap-2">
                <span className="t-sub font-bold text-slate-900">{t.name}</span>
                <span className={`t-meta rounded-full px-2 font-semibold tabular-nums ${cs.length > 0 ? 'ramp-soft ramp-text' : 'bg-white text-slate-400'}`} style={cs.length > 0 ? rampAt(ti, topics.length) : undefined}>{cs.length}곳</span>
              </span>
              <span className="t-meta break-keep text-slate-500">{t.action}</span>
              {cs.length > 0 && (
                <span className="t-meta flex flex-wrap gap-x-2 gap-y-0.5">
                  {cs.slice(0, 4).map((c) => (
                    <Link key={c.id} to={`/sales/meeting?client=${c.id}`} className="font-medium text-slate-700 hover:text-brand-700 hover:underline">
                      {c.companyName}
                      <span className="text-slate-400"> · {SALES_STAGE_LABEL[salesStageOf(c)]}</span>
                    </Link>
                  ))}
                  {cs.length > 4 && <span className="text-slate-400">외 {cs.length - 4}</span>}
                </span>
              )}
            </li>
          ))}
        </ul>
        {topics.some(({ list: cs }) => cs.length === 0) && (
          <p className="t-sub break-keep text-slate-500" data-testid="topic-empty">
            지금 연락할 곳이 없는 주제 · {topics.filter(({ list: cs }) => cs.length === 0).map(({ t }) => t.name).join(' · ')}
          </p>
        )}
        <p className="t-meta break-keep text-slate-500">관심사 · 고민 · 메모 · 업종 낱말로 골랐습니다. 이름을 누르면 미팅 준비로 갑니다.</p>
      </Surface>

      <div className="flex flex-col gap-3">
        {/* D-167: 영업 전략 · 크레탑 무기 · 절세 전략을 주제 하나로 합쳤다 — 종류 고르기 대신 찾기 하나 */}
        <h2 className="t-section text-slate-900">컨설팅 주제 <span className="t-sub font-medium text-slate-500">· 같은 주제는 하나로 합침</span></h2>
        <div className="relative w-full sm:max-w-md">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="가지급금 · 승계 · 연구소 … 로 찾기" aria-label="전략 찾기" className="w-full rounded-(--radius-control) border border-slate-300 bg-white py-2 pr-3 pl-9 text-[0.95rem] focus:border-brand-500 focus:outline-none" />
        </div>
        <p className="t-sub text-slate-500" data-testid="library-count">{list.length}개</p>
        <ul className="grid gap-2 lg:grid-cols-2" data-testid="library-list">
          {(showAll ? list : list.slice(0, LIB_FIRST)).map((e) => <EntryRow key={e.id} e={e} />)}
        </ul>
        {/* D-122: 한 번에 늘어놓지 않는다 — 찾기로 좁히거나 더 보기 */}
        {list.length > LIB_FIRST && (
          <button type="button" data-testid="library-more" onClick={() => setShowAll((v) => !v)} className="tap t-sub self-start rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">
            {showAll ? '접기' : `${list.length - LIB_FIRST}개 더 보기`}
          </button>
        )}
      </div>
    </div>
  )
}

export function StrategyLibraryPage() {
  return <WorkspaceScope>{(ctx) => <LibraryContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
