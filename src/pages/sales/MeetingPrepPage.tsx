/**
 * 영업 관리 › 미팅 준비 (D-114 2단계).
 *
 * 기업컨설팅 OS 의 '미팅 준비' · '고객 카드 분석' · '녹취/메모 분석' 을 고객 관리 한 장부 위로 옮겼다.
 *  - 고객을 고르면: 리드 점수 · 등급 · 전략 TOP3 · 미팅 테마, 그리고 첫 연락 · 1차 · 2차 · 3차 대본(원본 문구 그대로).
 *  - 고객 정보(대표 나이 · 매출 · 체크 17 · 메모)를 고치면 점수 · 대본이 바로 바뀐다. 메모 글로 빈 칸을 채울 수 있다.
 *  - 미팅 뒤 적은 메모를 규칙으로 나눠(반응 · 주제 · 망설임 · 다음 자료) 기록하고, 단계 · 다음 할 일을 한 번에 옮긴다.
 * 모두 규칙 계산이다(LLM 호출 없음). 'AX 1차 미팅 체크리스트'(/sales/first-meeting) 자리와는 따로다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, NotebookPen, Presentation } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useToast } from '../../components/ui/toastContext'
import { Badge, Disclosure, ScreenTitle, Surface, type Tone } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { CopyButton, NumberedList, PillList, ScriptBlock } from '../../components/sales/salesParts'
import { listClients, saveClient } from '../../services/clientOpsService'
import { salesStageOf, withSalesStage } from '../../services/salesPipeline'
import {
  profileFromMemo,
  roundForStage,
  stageAfterMeeting,
  toEngineItem,
  withMeetingNote,
  withSalesProfile,
} from '../../services/salesMeeting'
import {
  CUST_FLAGS,
  CUST_SECTIONS,
  MEETING_THEMES,
  analyzeTranscript,
  buildLeadPlan,
  buildMeetingPlan,
  detectTheme,
  followUpKakao,
  recommendedStrategiesFor,
  scoreLead,
  scoreTier,
  type ScoreTierKey,
  type TranscriptAnalysis,
} from '../../services/salesEngine'
import { todayLocalDate } from '../../lib/appClock'
import { SALES_STAGE_LABEL, SALES_STAGE_ORDER, type ClientOpsRecord, type SalesStage } from '../../types/clientOps'

type Round = 0 | 1 | 2 | 3
const ROUNDS: { key: Round; label: string }[] = [
  { key: 0, label: '첫 연락' },
  { key: 1, label: '1차 미팅' },
  { key: 2, label: '2차 미팅' },
  { key: 3, label: '3차 클로징' },
]

/** 등급 색 — 테마색 하나 · 경고 · 회색만 (원본의 초록 · 금색 · 주황 · 파랑 대신) */
const TIER_TONE: Record<ScoreTierKey, Tone> = { high: 'success', chase: 'brand', nurture: 'warning', long: 'neutral', low: 'neutral' }

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ------------------------------------------------------------------ */
/* 고객 정보 (점수 · 대본 재료)                                          */
/* ------------------------------------------------------------------ */

function ProfileEditor({ record, onSave }: { record: ClientOpsRecord; onSave: (next: ClientOpsRecord, msg: string) => void }) {
  const s = record.sales
  const init = useMemo(
    () => ({
      ceoAge: s?.ceoAge ? String(s.ceoAge) : '',
      revenueEok: s?.revenueM ? String(Math.round(s.revenueM) / 100) : '',
      flags: { ...(s?.flags ?? {}) } as Record<string, boolean>,
      memo: s?.memo ?? '',
    }),
    [s],
  )
  const [d, setD] = useState(init)
  const [seen, setSeen] = useState(init)
  if (seen !== init) {
    setSeen(init)
    setD(init)
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(init)
  const onCount = Object.values(d.flags).filter(Boolean).length

  const save = () => {
    const age = parseInt(d.ceoAge, 10)
    const eok = parseFloat(d.revenueEok)
    onSave(
      withSalesProfile(record, {
        ceoAge: Number.isFinite(age) && age > 0 ? age : null,
        revenueM: Number.isFinite(eok) && eok > 0 ? Math.round(eok * 100) : null,
        flags: d.flags,
        memo: d.memo,
      }),
      '고객 정보를 저장했습니다. 점수 · 대본이 새 값으로 바뀌었습니다.',
    )
  }
  const fillFromMemo = () => {
    const { patch, filled } = profileFromMemo({ ...record, sales: record.sales ? { ...record.sales, ceoAge: d.ceoAge ? parseInt(d.ceoAge, 10) : null, revenueM: d.revenueEok ? Math.round(parseFloat(d.revenueEok) * 100) : null, flags: d.flags } : record.sales }, d.memo)
    if (filled.length === 0) {
      onSave(record, '메모에서 새로 채울 값을 찾지 못했습니다.')
      return
    }
    setD((prev) => ({
      ...prev,
      ceoAge: patch.ceoAge ? String(patch.ceoAge) : prev.ceoAge,
      revenueEok: patch.revenueM ? String(Math.round(patch.revenueM) / 100) : prev.revenueEok,
      flags: patch.flags ? { ...prev.flags, ...patch.flags } : prev.flags,
    }))
    onSave(record, `메모에서 채웠습니다 — ${filled.join(' · ')}. 확인하고 저장하세요.`)
  }

  return (
    <Disclosure title="고객 정보 — 점수 · 대본 재료" hint={`대표 ${d.ceoAge || '?'}세 · 매출 ${d.revenueEok ? `${d.revenueEok}억` : '?'} · 체크 ${onCount}개`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block text-[0.85rem] text-slate-500">
            대표 나이
            <input value={d.ceoAge} inputMode="numeric" onChange={(e) => setD({ ...d, ceoAge: e.target.value.replace(/[^0-9]/g, '') })} className={inputClass} />
          </label>
          <label className="block text-[0.85rem] text-slate-500">
            매출 (억원)
            <input value={d.revenueEok} inputMode="decimal" onChange={(e) => setD({ ...d, revenueEok: e.target.value.replace(/[^0-9.]/g, '') })} className={inputClass} />
          </label>
          <p className="t-meta col-span-2 self-end pb-2 break-keep text-slate-500">
            직원 수 · 설립일 · 업종은 고객 관리 기본 정보에서 읽습니다.
          </p>
        </div>
        {CUST_SECTIONS.map((sec) => (
          <fieldset key={sec}>
            <legend className="t-sub font-semibold text-slate-700">{sec}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CUST_FLAGS.filter((f) => f[2] === sec).map(([key, label]) => {
                const on = !!d.flags[key]
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, flags: { ...d.flags, [key]: !on } })}
                    className={`t-meta rounded-full border px-2.5 py-1 font-medium ${on ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        <label className="block text-[0.85rem] text-slate-500">
          상담 메모
          <textarea
            value={d.memo}
            rows={3}
            onChange={(e) => setD({ ...d, memo: e.target.value })}
            placeholder="예) 제조업 매출 35억 직원 26명 대표 58세, 자녀 근무, 가지급금 있음"
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={fillFromMemo} disabled={d.memo.trim() === ''}>
            메모로 빈 칸 채우기
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
            고객 정보 저장
          </Button>
        </div>
      </div>
    </Disclosure>
  )
}

/* ------------------------------------------------------------------ */
/* 미팅 기록                                                             */
/* ------------------------------------------------------------------ */

function MeetingRecorder({ record, round, today, onSave }: { record: ClientOpsRecord; round: 1 | 2 | 3; today: string; onSave: (next: ClientOpsRecord, msg: string) => void }) {
  const stage = salesStageOf(record)
  const target = stageAfterMeeting(round)
  const canMove = SALES_STAGE_ORDER.indexOf(target) > SALES_STAGE_ORDER.indexOf(stage) && stage !== 'contracted' && stage !== 'hold' && stage !== 'lost'
  const [text, setText] = useState('')
  const [result, setResult] = useState<TranscriptAnalysis | null>(null)
  const [move, setMove] = useState(true)
  const [next, setNext] = useState('')
  const [due, setDue] = useState(addDays(today, 3))

  const analyze = () => {
    const a = analyzeTranscript(text)
    setResult(a)
    const docs = a.nextDocs.slice(0, 3).join(' · ')
    setNext(round === 3 ? '계약 조건 회신 확인' : `${round + 1}차 미팅 준비${docs ? ` — 자료 받기: ${docs}` : ''}`)
  }
  const save = () => {
    if (!result) return
    let rec = withMeetingNote(record, { round, text, analysis: result, nextAction: next, nextActionDueDate: due })
    if (canMove && move) rec = withSalesStage(rec, target)
    onSave(rec, `${round}차 미팅을 기록했습니다${canMove && move ? ` · ${SALES_STAGE_LABEL[target]}로 옮김` : ''}.`)
    setText('')
    setResult(null)
  }

  return (
    <section aria-label="미팅 기록" data-testid="meeting-recorder" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="t-section flex items-center gap-2 text-slate-900">
        <NotebookPen aria-hidden="true" className="size-5 text-brand-600" />
        {round}차 미팅 기록
      </h2>
      <label className="block text-[0.85rem] text-slate-500">
        미팅에서 나온 말 · 메모
        <textarea
          value={text}
          rows={4}
          onChange={(e) => { setText(e.target.value); setResult(null) }}
          placeholder="예) 가지급금 정리는 관심 있는데 비용이 부담된다. 세무사랑 상의해 보겠다. 자녀 1명 근무 중."
          className={inputClass}
        />
      </label>
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={analyze} disabled={text.trim() === ''}>
          메모 나눠 보기
        </Button>
      </div>
      {result && (
        <div data-testid="meeting-analysis" className="flex flex-col gap-3 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3.5">
          <p className="t-body break-keep text-slate-800">{result.summary}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="t-meta font-semibold text-slate-500">반응</dt>
              <dd className="t-sub font-semibold text-slate-800">{result.reaction}</dd>
            </div>
            <div>
              <dt className="t-meta font-semibold text-slate-500">망설이는 이유</dt>
              <dd className="t-sub text-slate-700">{result.hesitant.join(' · ') || '없음'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="t-meta font-semibold text-slate-500">나온 주제</dt>
              <dd className="mt-1"><PillList items={result.issues} /></dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="t-meta font-semibold text-slate-500">다음에 받을 자료</dt>
              <dd className="mt-1"><PillList items={result.nextDocs} /></dd>
            </div>
          </dl>
          <ScriptBlock title="다음 미팅 방향" text={result.strategy} />
          <ScriptBlock title="감사 카톡" text={result.kakao} copy />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="block text-[0.85rem] text-slate-500">
              다음 할 일
              <input value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-[0.85rem] text-slate-500">
              날짜
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
            </label>
          </div>
          {canMove && (
            <label className="t-sub flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} className="size-4 accent-brand-600" />
              영업 단계를 <strong className="font-semibold">{SALES_STAGE_LABEL[target]}</strong>로 옮기기
            </label>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={save}>
              기록 저장
            </Button>
          </div>
        </div>
      )}
      <p className="t-meta break-keep text-slate-400">메모 속 낱말로 나누는 규칙 계산입니다. 실제 뜻은 다시 확인하세요.</p>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 화면                                                                 */
/* ------------------------------------------------------------------ */

function MeetingContent({ workspaceId }: { workspaceId: string | null }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [params, setParams] = useSearchParams()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setRecords(await listClients(workspaceId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])
  useEffect(() => {
    void load()
  }, [load])

  // 고르는 칸 — 영업 흐름 순서(잠재 → 클로징), 계약 · 보류 · 이탈은 뒤로
  const live = useMemo(() => records.filter((r) => r.archivedAt === null), [records])
  const grouped = useMemo(
    () => SALES_STAGE_ORDER.map((st) => ({ st, list: live.filter((r) => salesStageOf(r) === st).sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko')) })).filter((g) => g.list.length > 0),
    [live],
  )
  const firstPick = grouped.find((g) => g.st === 'm1sched')?.list[0] ?? grouped[0]?.list[0] ?? null
  const clientId = params.get('client') ?? firstPick?.id ?? ''
  const record = live.find((r) => r.id === clientId) ?? null
  const stage: SalesStage = record ? salesStageOf(record) : 'lead'
  // 차수 — 고르지 않았으면 단계로 정한다(잠재 고객은 첫 연락부터)
  const rp = params.get('round')
  const round: Round = rp === '0' || rp === '1' || rp === '2' || rp === '3' ? (Number(rp) as Round) : stage === 'lead' ? 0 : roundForStage(stage)

  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); n.set('client', id); n.delete('round'); return n }, { replace: true })
  const setRound = (r: Round) => setParams((p) => { const n = new URLSearchParams(p); if (record) n.set('client', record.id); n.set('round', String(r)); return n }, { replace: true })

  const item = useMemo(() => (record ? toEngineItem(record) : null), [record])
  const score = item ? scoreLead(item) : 0
  const tier = scoreTier(score)
  const strategies = useMemo(() => (item ? recommendedStrategiesFor(item) : []), [item])
  const theme = item ? MEETING_THEMES[detectTheme(item)] : null

  const persist = async (next: ClientOpsRecord, msg: string) => {
    if (next === record) {
      showToast(msg)
      return
    }
    setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
    try {
      const saved = await saveClient(next)
      setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
      showToast(msg)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      void load()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="영업 관리" sub={`${today} · 미팅 준비 — 고객을 고르면 첫 연락 · 1·2·3차 대본이 준비됩니다`} />
      <SalesTabs />

      {error && (
        <p role="alert" className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : live.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
          <Presentation aria-hidden="true" className="mx-auto size-9 text-brand-400" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">미팅을 준비할 업체가 없습니다</p>
          <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">영업 보드에서 새 잠재고객을 등록하면 여기서 대본을 준비합니다.</p>
          <Link to="/sales/board" className="mt-5 inline-flex font-semibold text-brand-700 hover:underline">영업 보드로 →</Link>
        </div>
      ) : (
        <>
          <label className="flex max-w-xl flex-col gap-1 text-[0.85rem] text-slate-500">
            고객
            <select value={record?.id ?? ''} onChange={(e) => pick(e.target.value)} aria-label="미팅 준비할 고객" className={`${inputClass} !mt-0 font-semibold`}>
              {grouped.map((g) => (
                <optgroup key={g.st} label={SALES_STAGE_LABEL[g.st]}>
                  {g.list.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.companyName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {record && item && (
            <>
              {/* 요약 — 누구 · 어디까지 · 점수 · 무엇부터 */}
              <Surface className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Link to={`/ops/clients/${record.id}`} className="t-card inline-flex items-center gap-1 font-bold text-slate-900 hover:text-brand-700 hover:underline">
                    {record.companyName}
                    <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
                  </Link>
                  <Badge>{SALES_STAGE_LABEL[stage]}</Badge>
                  <Badge tone={TIER_TONE[tier.key]}>
                    <span data-testid="lead-score" className="tabular-nums">{score}점</span> · {tier.label}
                  </Badge>
                  {theme && <span className="t-sub text-slate-500">미팅 테마 · {theme.label}</span>}
                </div>
                {item.interests && item.interests.length > 0 && <PillList items={item.interests} />}
                <div>
                  <h2 className="t-sub font-bold text-slate-800">먼저 볼 전략 TOP3</h2>
                  <ol className="mt-1.5 grid gap-2 lg:grid-cols-3">
                    {strategies.map((st, i) => (
                      <li key={st.id} className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
                        <span className="t-sub font-bold text-slate-900">
                          <span className="text-brand-700 tabular-nums">{i + 1}.</span> {st.name}
                        </span>
                        <span className="t-meta break-keep text-slate-600">{st.fit}</span>
                        <span className="t-meta text-slate-500">
                          수임료 {st.fee}
                          {st.needTaxPro ? ' · 세무사 검토 필요' : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="t-meta break-keep text-slate-400">
                  점수 · 전략은 매출 · 직원 · 대표 나이 · 업력 · 관심사 · 유입 경로 · 단계로 매기는 규칙 계산입니다(원본 기준 20~88점).
                </p>
              </Surface>

              <ProfileEditor record={record} onSave={(n, m) => void persist(n, m)} />

              {/* 차수 고르기 */}
              <div role="group" aria-label="미팅 차수" data-testid="meeting-rounds" className="grid grid-cols-4 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:self-start">
                {ROUNDS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={round === r.key}
                    onClick={() => setRound(r.key)}
                    className={`tap rounded-[8px] px-2 py-2 text-[0.85rem] font-semibold break-keep sm:px-4 sm:text-[0.9rem] ${round === r.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <RoundPlan item={item} round={round} />

              {round !== 0 && <MeetingRecorder
                  key={`${record.id}-${round}`}
                  record={record}
                  round={round}
                  today={today}
                  onSave={(n, m) => {
                    void persist(n, m)
                    // 기록했으면 다음 차수 대본으로 넘어간다
                    if (round < 3) setRound((round + 1) as Round)
                  }}
                />}

              {(record.sales?.meetings?.length ?? 0) > 0 && (
                <Disclosure title="지난 미팅 기록" hint={`${record.sales?.meetings?.length}건`}>
                  <ul className="flex flex-col gap-2.5">
                    {record.sales?.meetings?.map((m) => (
                      <li key={m.id} className="rounded-(--radius-control) border border-slate-200 bg-white p-3">
                        <p className="t-meta text-slate-500">
                          {m.at.slice(0, 10)} · {m.round}차 · {m.reaction}
                        </p>
                        <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-700">{m.text}</p>
                        {m.issues.length > 0 && <div className="mt-1.5"><PillList items={m.issues} /></div>}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}

              <ScriptBlock title="다음 연락 카톡 (고객 유형별)" text={followUpKakao(item)} copy />
            </>
          )}
        </>
      )}
    </div>
  )
}

/** 차수별 대본 — 원본 buildMeetingPlan · buildLeadPlan 문구 그대로 */
function RoundPlan({ item, round }: { item: ReturnType<typeof toEngineItem>; round: Round }) {
  if (round === 0) {
    const p = buildLeadPlan(item)
    return (
      <div data-testid="meeting-plan" className="flex flex-col gap-3">
        <ScriptBlock title="첫 마디" text={p.hook} copy />
        <ScriptBlock title="전화 대본" text={p.phone} copy />
        <ScriptBlock title="통화 뒤 카톡" text={p.kakao} copy />
        <ScriptBlock title="자주 나오는 거절과 답">
          <ObjectionList items={p.objections} />
        </ScriptBlock>
        <ScriptBlock title="1차 미팅으로 넘기는 말" text={p.meetingBridge} />
      </div>
    )
  }
  if (round === 1) {
    const p = buildMeetingPlan(item, 'm1')
    return (
      <div data-testid="meeting-plan" className="flex flex-col gap-3">
        <ScriptBlock title="목표" text={p.goal} />
        <ScriptBlock title="오프닝" text={p.opening} copy />
        <ScriptBlock title={`질문 ${p.questions.length}개`}>
          <NumberedList items={p.questions} />
        </ScriptBlock>
        <ScriptBlock title="피할 것" text={p.avoid} />
        <ScriptBlock title="요청할 자료">
          <PillList items={p.docs} />
        </ScriptBlock>
        <ScriptBlock title="다음 단계" text={p.next} />
        <ScriptBlock title="미팅 뒤 카톡" text={p.kakao} copy />
      </div>
    )
  }
  if (round === 2) {
    const p = buildMeetingPlan(item, 'm2')
    return (
      <div data-testid="meeting-plan" className="flex flex-col gap-3">
        <ScriptBlock title="목표" text={p.goal} />
        <ScriptBlock title="핵심 이슈 TOP3">
          <NumberedList items={p.topIssues.map((t) => t.replace(/^\d+\.\s*/, ''))} />
        </ScriptBlock>
        <ScriptBlock title="진행 순서" text={p.approach} />
        <ScriptBlock title="거절과 답">
          <ObjectionList items={p.objections} />
        </ScriptBlock>
        <ScriptBlock title="마무리 말" text={p.close} copy />
        <ScriptBlock title="받을 자료">
          <PillList items={p.docs} />
        </ScriptBlock>
        <ScriptBlock title="수임료 범위 (내부)" text={p.fee} />
      </div>
    )
  }
  const p = buildMeetingPlan(item, 'm3')
  return (
    <div data-testid="meeting-plan" className="flex flex-col gap-3">
      <ScriptBlock title="목표" text={p.goal} />
      <ScriptBlock title="전략" text={p.strategy} />
      <ScriptBlock title="1차 계약 제안" text={p.proposal} copy />
      <ScriptBlock title="가격 이야기" text={p.priceTalk} copy />
      <ScriptBlock title="'생각해 볼게요' 에 대한 답" text={p.holdTalk} copy />
      <ScriptBlock title="계약 안내 카톡" text={p.contractKakao} copy />
    </div>
  )
}

function ObjectionList({ items }: { items: [string, string][] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map(([q, a]) => (
        <li key={q} className="flex flex-col gap-0.5">
          <span className="t-sub font-semibold text-slate-800">“{q}”</span>
          <span className="t-body flex items-start gap-2 break-keep text-slate-700">
            <span className="min-w-0 flex-1">{a}</span>
            <CopyButton text={a} />
          </span>
        </li>
      ))}
    </ul>
  )
}

export function MeetingPrepPage() {
  return <WorkspaceScope>{(ctx) => <MeetingContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
