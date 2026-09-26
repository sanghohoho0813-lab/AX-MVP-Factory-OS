/**
 * 영업 관리 › 전략 라이브러리 (D-114 4단계).
 *
 * 기업컨설팅 OS 에 흩어져 있던 상담 무기를 한 곳에 — 영업 전략 17 · 크레탑 무기 34 · 절세 전략 25, 그리고 제안 주제 7 별로 '지금 연락할 고객'.
 * 문구는 원본 그대로. 찾기 · 분류로 좁히고, 한 줄을 누르면 펼쳐서 멘트 · 질문을 복사한다.
 * 크레탑 분석기 안의 추천(크레탑 결과에 붙는 것)과는 따로 둔다 — 그쪽은 분석 결과에 따라 달라지는 추천이고, 여기는 늘 보는 사전이다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { ScreenTitle, Surface } from '../../components/ui/primitives'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { CopyButton, NumberedList, PillList } from '../../components/sales/salesParts'
import { listClients } from '../../services/clientOpsService'
import { salesStageOf } from '../../services/salesPipeline'
import { STRATEGY_LIBRARY } from '../../services/salesEngine'
import { CRETOP_WEAPONS, PROPOSAL_TOPICS, TAX_STRATEGIES } from '../../services/salesLibrary'
import { customersForTopic } from '../../services/salesSignals'
import { rampAt, rampStyle } from '../../components/sales/salesColor'
import { todayLocalDate } from '../../lib/appClock'
import { SALES_STAGE_LABEL, type ClientOpsRecord } from '../../types/clientOps'

type Source = 'all' | 'strategy' | 'cretop' | 'tax'

interface Entry {
  id: string
  source: Exclude<Source, 'all'>
  name: string
  cat: string
  /** 한 줄 요약 */
  line: string
  /** 펼친 내용 — [제목, 글, 복사?] 또는 [제목, 목록] */
  body: ([string, string, boolean] | [string, string[]])[]
  search: string
}

const SOURCE_LABEL: Record<Exclude<Source, 'all'>, string> = { strategy: '영업 전략', cretop: '크레탑 무기', tax: '절세 전략' }
/** D-118: 종류마다 조금씩 다른 구분색(테마를 따라감) */
const SOURCE_SHIFT: Record<Exclude<Source, 'all'>, number> = { strategy: 0, cretop: 44, tax: 88 }

function buildEntries(): Entry[] {
  const out: Entry[] = []
  for (const s of STRATEGY_LIBRARY) {
    out.push({
      id: `s-${s.id}`,
      source: 'strategy',
      name: s.name,
      cat: s.fields[0] ?? '',
      line: s.fit,
      body: [
        ['이렇게 꺼낸다', s.pitch, true],
        ['물어볼 것', s.questions],
        ['받을 자료', s.docs],
        ['조심할 것', s.risk, false],
        ['수임료 범위', `${s.fee}${s.needTaxPro ? ' · 세무사 검토 필요' : ''}`, false],
        ['마무리 말', s.close, true],
      ],
      search: `${s.name} ${s.fit} ${s.pitch} ${s.fields.join(' ')}`,
    })
  }
  for (const g of CRETOP_WEAPONS) {
    g.items.forEach((w, i) => {
      out.push({
        id: `c-${g.cat}-${i}`,
        source: 'cretop',
        name: w.name,
        cat: g.cat,
        line: w.p,
        body: [
          ['왜 관심을 가질까', w.p, false],
          ['크레탑에서 볼 것', w.r, false],
          ['질문', w.q, true],
          ['챙길 자료', w.d, false],
        ],
        search: `${w.name} ${g.cat} ${w.p} ${w.r} ${w.q}`,
      })
    })
  }
  for (const t of TAX_STRATEGIES) {
    out.push({
      id: `t-${t.id}`,
      source: 'tax',
      name: t.name,
      cat: t.cat,
      line: t.concept,
      body: [
        ['무엇', t.concept, false],
        ['맞는 고객', t.who, false],
        ['질문', t.question, true],
        ['받을 자료', t.docs],
        ['조심할 것', t.caution, false],
        ['연락 멘트', t.ment, true],
      ],
      search: `${t.name} ${t.cat} ${t.concept} ${t.who}`,
    })
  }
  return out
}

function EntryRow({ e }: { e: Entry }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="tap flex w-full items-start gap-2 px-3.5 py-3 text-left">
        <ChevronRight aria-hidden="true" className={`mt-1 size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span aria-hidden="true" className="ramp-dot mt-2 size-2 shrink-0 rounded-full" style={rampStyle(SOURCE_SHIFT[e.source])} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="t-body font-bold text-slate-900">{e.name}</span>
            <span className="t-meta"><span className="ramp-text font-semibold" style={rampStyle(SOURCE_SHIFT[e.source])}>{SOURCE_LABEL[e.source]}</span><span className="text-slate-400"> · {e.cat}</span></span>
          </span>
          {!open && <span className="t-sub mt-0.5 line-clamp-1 block break-keep text-slate-500">{e.line}</span>}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-slate-100 px-3.5 py-3">
          {e.body.map((b) => (
            <div key={b[0]} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="t-meta font-semibold text-slate-500">{b[0]}</span>
                {typeof b[1] === 'string' && b[2] ? <CopyButton text={b[1]} /> : null}
              </div>
              {typeof b[1] === 'string' ? <p className="t-sub break-keep text-slate-700">{b[1]}</p> : b[0].includes('자료') ? <PillList items={b[1]} /> : <NumberedList items={b[1]} />}
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

function LibraryContent({ workspaceId }: { workspaceId: string | null }) {
  const today = todayLocalDate()
  const entries = useMemo(buildEntries, [])
  const [source, setSource] = useState<Source>('all')
  const [q, setQ] = useState('')
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  useEffect(() => {
    let alive = true
    void listClients(workspaceId)
      .then((l) => { if (alive) setRecords(l) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [workspaceId])

  const list = entries.filter((e) => (source === 'all' || e.source === source) && (q.trim() === '' || e.search.includes(q.trim())))
  const counts = { all: entries.length, strategy: entries.filter((e) => e.source === 'strategy').length, cretop: entries.filter((e) => e.source === 'cretop').length, tax: entries.filter((e) => e.source === 'tax').length }
  const topics = useMemo(() => PROPOSAL_TOPICS.map((t) => ({ t, list: customersForTopic(records, t) })), [records])

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="영업 관리" sub={`${today} · 전략 라이브러리 — 영업 전략 · 크레탑 무기 · 절세 전략, 주제별 연락할 고객`} />
      <SalesTabs />

      <Surface className="flex flex-col gap-3">
        <h2 className="t-section text-slate-900">주제별 — 지금 연락할 고객</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="topic-list">
          {topics.map(({ t, list: cs }, ti) => (
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
        <p className="t-meta break-keep text-slate-400">관심사 · 고민 · 메모 · 업종 낱말로 고르는 규칙 계산입니다(원본 기준). 이름을 누르면 미팅 준비로 갑니다.</p>
      </Surface>

      <div className="flex flex-col gap-3">
        <div role="group" aria-label="전략 종류" data-testid="library-source" className="grid grid-cols-2 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:self-start">
          {(['all', 'strategy', 'cretop', 'tax'] as Source[]).map((k) => (
            <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)} className={`tap rounded-[8px] px-3 py-2 text-[0.88rem] font-semibold break-keep ${source === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {k !== 'all' && source !== k && <span aria-hidden="true" className="ramp-dot mr-1.5 inline-block size-2 rounded-full" style={rampStyle(SOURCE_SHIFT[k])} />}
              {k === 'all' ? '전체' : SOURCE_LABEL[k]} <span className="tabular-nums opacity-75">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-md">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="가지급금 · 승계 · 연구소 … 로 찾기" aria-label="전략 찾기" className="w-full rounded-(--radius-control) border border-slate-300 bg-white py-2 pr-3 pl-9 text-[0.95rem] focus:border-brand-500 focus:outline-none" />
        </div>
        <p className="t-sub text-slate-500" data-testid="library-count">{list.length}개</p>
        <ul className="grid gap-2 lg:grid-cols-2" data-testid="library-list">
          {list.map((e) => <EntryRow key={e.id} e={e} />)}
        </ul>
      </div>
    </div>
  )
}

export function StrategyLibraryPage() {
  return <WorkspaceScope>{(ctx) => <LibraryContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
