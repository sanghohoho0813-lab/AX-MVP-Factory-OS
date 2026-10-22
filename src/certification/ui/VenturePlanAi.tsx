/**
 * D-246 벤처 사업계획서 AI 초안 — 대표만(화면은 useOwnerAiAccess 'yes' 일 때만 그리고, 서버 /api/ai-assist 가 다시 막는다).
 *
 * 차례로 부른다(서버 함수 60초 안). 단계마다 받는 대로 저장 — 중간에 실패해도 앞의 것은 남고 실패한 단계만 다시 누를 수 있다.
 * 사람이 고친 칸은 덮지 않고 '새 안' 으로 따로 둔다(mergeDraft).
 * D-252: 대표 화면에서는 처음부터 펼쳐 둔다 — [전부 써줘] · 단계마다 [이것만 써줘] · 칸에서 누른 [AI로 이 칸 쓰기](request) 도 여기서 쓴다.
 * D-263 대표: "요약은 TAM · SOM 시장조사를 하고 나서, 출원번호 · 기술인력(연구개발전담부서 유무)까지 반드시 파악하고 난 뒤에 · 아무리 간편해도"
 *   "점검을 요청하면 꼭 한두 개씩 보완하라 하더라 — 한 번에 다 끝내게" · "자체점검는 사업계획서에도 중간중간 반드시".
 *   → 맨 위 '요약 전에 반드시 3가지'(시장조사 · 출원번호 · 기술인력 — 번호 · 인원은 직접 넣어도 됨). 셋이 안 차면 요약을 쓰지 않는다.
 *   → [전부 써줘] = 시장조사 → (3가지 확인) → 요약 → 자체점검 ① → 본문 5묶음 → 자체점검 ②. 자체점검이 고칠 수 있는 약점은 직접 고쳐 넣는다.
 */
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { AssistError, assistMessage } from '../../services/aiAssist/client'
import { answerOf } from '../../services/aiAssist/looseJson'
import { judgeOf, judgePassed, type JudgeReport } from '../../services/aiAssist/judge'
import { readJudgeSkill } from '../../services/aiAssist/judgeSkill'
import { callAssistRetry, retryText } from '../../services/aiAssist/retry'
import { readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { JudgeReportView, JudgeSkillButton } from '../../components/ai/JudgePanel'
import { RD_ORG_OPTIONS, VK, VPLAN_FIELD, mergeDraft, readPlan, type VPlanBatch, type VPlanFacts } from '../core/venturePlan'
import { PATENT_NONE, RD_ORG_SHORT, judgePatch, marketConfirmed, marketDone, marketNeedsConfirm, marketOf, marketPatch, normalizeAppNo, patentPatch, readGate, researchersPatch, summaryGate, type MarketResearch } from '../integration/ventureGate'
import { VPLAN_BATCHES, VPLAN_STEPS, buildBatchContext, buildMarketContext, buildVentureJudgeContext, draftItemsOf, fieldsOfBatch, judgeItemsOf, type VPlanStep } from '../integration/venturePlanAi'

export type AiRow = { phase: 'wait' | 'run' | 'done' | 'fail'; text: string }
type RowState = AiRow

/** 이 오류면 다음 단계도 똑같이 실패한다 — 거기서 멈춘다 */
const STOP_CODES = new Set(['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed', 'provider_auth', 'rate_limited', 'network'])
const JUDGE_ROUNDS = 2

const HINT = {
  market: '앞 답을 읽지 못했습니다. items 의 title 을 "tam" · "sam" · "som" · "cagr" · "customer" · "price" · "scope" 이름표 그대로, amount = 규모, detail = 산식, tag = 출처, when = 기준연도로 다시 써 주세요. JSON 한 덩어리만.',
  batch: '앞 답을 읽지 못했습니다. items 의 title = 칸 id 그대로(예 development_background), body = 그 칸 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  judge: '앞 답을 읽지 못했습니다. items 에 {"title":"score","amount":"합계 점수"} 하나, 판정은 {"title":"verdict","tag":"P0 · 감점 · 대표 확인","detail":"문제","body":"고친 방법"}, 고친 칸은 {"title":"칸 id","body":"고친 전체 글"} 로 다시 써 주세요. JSON 한 덩어리만.',
}

export function VenturePlanAi({
  notes,
  facts,
  today,
  hasMaterial,
  onSave,
  onGoMaterials,
  onGoField,
  onClose,
  request,
  onRows,
}: {
  notes: Record<string, string>
  facts: VPlanFacts
  today: string
  hasMaterial: boolean
  onSave: (patch: Record<string, string>) => Promise<void>
  onGoMaterials: () => void
  onGoField: (id: string) => void
  onClose: () => void
  /** 칸에서 누른 [AI로 이 칸 쓰기] — n 이 바뀔 때마다 그 묶음 하나를 쓴다 */
  request?: { batch: VPlanBatch; n: number } | null
  /** 묶음 진행을 칸에도 보여 주려고 */
  onRows?: (rows: Record<string, AiRow>) => void
}) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [busy, setBusy] = useState(false)
  const [asks, setAsks] = useState<{ id: string; text: string }[]>([])
  // 단계 사이에 화면 기록이 늦게 따라와도 앞 단계 결과를 보고 이어 쓰게
  const notesRef = useRef(notes)
  notesRef.current = notes
  // 여러 번 저장하는 동안 화면이 바뀌어도 늘 가장 최근 저장 함수로
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const pending = useRef<Record<string, string>>({})
  const now = () => ({ ...notesRef.current, ...pending.current })
  const save = async (patch: Record<string, string>) => {
    await saveRef.current(patch)
    Object.assign(pending.current, patch)
  }

  const gate = readGate(notes)
  const sg = summaryGate(readPlan(notes), facts, gate)

  const setRow = (k: string, r: RowState) => setRows((cur) => ({ ...cur, [k]: r }))
  const choiceOf = () => {
    const c = readChoice()
    return c ? { provider: c.provider, model: c.model } : null
  }

  /** 자체점검 — 판정 + 자체점검이 고친 칸 넣기. 90점 미만 · P0 이고 고친 칸이 있었으면 고친 글로 한 번 더(최대 2번) */
  const runJudge = async (key: 'judgeSum' | 'judgeAll', skill: string): Promise<[number, number]> => {
    const scope = key === 'judgeSum' ? 'sum' : 'full'
    const label = scope === 'sum' ? '요약' : '전체'
    const fixed: string[] = []
    const kept: string[] = []
    let report: JudgeReport | null = null
    for (let round = 1; round <= JUDGE_ROUNDS; round += 1) {
      setRow(key, { phase: 'run', text: round === 1 ? `${label}을 자체점검하는 중…(40초쯤)` : '고친 글로 한 번 더 자체점검하는 중…' })
      const state = readPlan(now())
      const { value: j } = await callAssistRetry({
        req: { assistId: 'venture.judge', page: 'venture', choice: choiceOf(), context: buildVentureJudgeContext({ scope, state, facts, today, gate: readGate(now()) }), ...(skill ? { skill } : {}) },
        parse: (run) => {
          const r = judgeOf(answerOf(run))
          return r.score == null && !r.verdicts.length && !r.rewrites.length ? null : r
        },
        hint: HINT.judge,
        missMessage: 'AI 답에서 판정을 찾지 못했습니다 — 다시 눌러 주세요',
        onRetry: (w, n, t) => setRow(key, { phase: 'run', text: retryText(w, n, t) }),
      })
      const m = mergeDraft(readPlan(now()), judgeItemsOf(j.rewrites, scope))
      const name = (id: string) => VPLAN_FIELD[id]?.title ?? id
      for (const id of m.replaced) if (!fixed.includes(name(id))) fixed.push(name(id))
      for (const id of m.kept) if (!kept.includes(name(id))) kept.push(name(id))
      report = { at: new Date().toISOString(), scope: label, score: j.score, scores: j.scores, verdicts: j.verdicts, fixed: [...fixed], kept: [...kept], rounds: round, custom: !!skill, headline: j.headline }
      await save({ ...m.patch, ...judgePatch(readGate(now()), scope, report) })
      if (judgePassed(report) || !m.replaced.length) break
    }
    const r = report as JudgeReport | null
    const p0 = r?.verdicts.filter((v) => v.level === 'P0').length ?? 0
    const ask = r?.verdicts.filter((v) => v.level === '대표 확인') ?? []
    if (ask.length) setAsks((cur) => [...cur.filter((x) => !x.id.startsWith(key)), ...ask.slice(0, 3).map((a, i) => ({ id: `${key}:${i}`, text: a.fix || a.text }))])
    setRow(key, { phase: 'done', text: `${r?.score != null ? `${r.score}점` : '점수 없음'} · P0 ${p0}${fixed.length ? ` · 직접 고친 칸 ${fixed.join(' · ')}` : ' · 고칠 것 없음'}${kept.length ? ` · 고치신 ${kept.length}칸은 새 안으로` : ''}${(r?.rounds ?? 1) > 1 ? ' · 고친 뒤 다시 판정' : ''}` })
    return [fixed.length, kept.length]
  }

  /** 단계 하나 — 성공이면 [새로 쓴 칸, 그대로 둔 칸], 멈춰야 하면 'stop' */
  const runOne = async (key: VPlanStep): Promise<[number, number] | 'stop' | 'fail'> => {
    const skill = readJudgeSkill()
    try {
      if (key === 'market') {
        setRow(key, { phase: 'run', text: '시장을 조사하는 중…(40초쯤)' })
        const state = readPlan(now())
        const { value } = await callAssistRetry<MarketResearch>({
          req: { assistId: 'venture.market', page: 'venture', choice: choiceOf(), context: buildMarketContext({ state, facts, today, gate: readGate(now()) }) },
          parse: (run) => marketOf(answerOf(run), run, new Date().toISOString()),
          hint: HINT.market,
          missMessage: 'AI 답에서 TAM · SAM · SOM 을 찾지 못했습니다 — 다시 눌러 주세요',
          onRetry: (w, n, t) => setRow(key, { phase: 'run', text: retryText(w, n, t) }),
        })
        await save(marketPatch(value))
        const ok = marketDone(value)
        const empty = (['tam', 'sam', 'som'] as const).filter((k) => !value[k].amount.trim()).map((k) => k.toUpperCase())
        setRow(key, ok ? { phase: 'done', text: `TAM ${value.tam.amount} · SAM ${value.sam.amount} · SOM ${value.som.amount}${value.grounded ? ` · 검색 근거 ${value.sources.length}곳` : ' · 검색 근거 없음 — 위에서 숫자를 한 번 확인해 주세요'}` } : { phase: 'fail', text: `${empty.join(' · ')} 숫자를 찾지 못했습니다 — 위에 AI 가 적은 산식을 보고 빈 숫자만 넣어 주세요` })
        return ok ? [0, 0] : 'fail'
      }
      if (key === 'judgeSum' || key === 'judgeAll') return await runJudge(key, skill)
      // 요약은 세 가지(시장조사 · 출원번호 · 기술인력)를 다 안 뒤에만
      if (key === 'sum') {
        const g = summaryGate(readPlan(now()), facts, readGate(now()))
        if (!g.ok) {
          setRow(key, { phase: 'fail', text: `요약 전에 먼저 — ${g.missing.join(' · ')}(위 '요약 전에 반드시' 에서)` })
          return 'stop'
        }
      }
      const b = VPLAN_BATCHES.find((x) => x.key === key)!
      setRow(key, { phase: 'run', text: '쓰는 중…(30초쯤)' })
      const state = readPlan(now())
      const { value: items } = await callAssistRetry({
        req: { assistId: b.assistId, page: 'venture', choice: choiceOf(), context: buildBatchContext({ batch: b.key, state, facts, today, gate: readGate(now()) }), ...(skill ? { skill } : {}) },
        parse: (run) => {
          const it = draftItemsOf(answerOf(run), b.key)
          return it.length ? it : null
        },
        hint: HINT.batch,
        missMessage: 'AI 답에서 칸을 찾지 못했습니다 — 다시 눌러 주세요',
        onRetry: (w, n, t) => setRow(key, { phase: 'run', text: retryText(w, n, t) }),
      })
      const m = mergeDraft(readPlan(now()), items)
      await save(m.patch)
      const got = items.filter((i) => i.note).map((i) => ({ id: i.id, text: i.note! }))
      setAsks((cur) => [...cur.filter((x) => !items.some((i) => i.id === x.id)), ...got])
      setRow(key, { phase: 'done', text: `${m.replaced.length}칸 씀${m.kept.length ? ` · 고친 칸 ${m.kept.length}개는 그대로(새 안 따로)` : ''}` })
      return [m.replaced.length, m.kept.length]
    } catch (e) {
      const code = e instanceof AssistError ? e.code : 'save'
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setRow(key, { phase: 'fail', text: why })
      return STOP_CODES.has(code) ? 'stop' : 'fail'
    }
  }

  const runAll = async (keys: VPlanStep[]) => {
    if (busy) return
    setBusy(true)
    pending.current = {}
    let wrote = 0
    let kept = 0
    let failed = 0
    let gated = false
    for (const k of keys) setRow(k, { phase: 'wait', text: '차례 기다림' })
    for (const [i, k] of keys.entries()) {
      const r = await runOne(k)
      if (r === 'stop') {
        gated = k === 'sum' && !summaryGate(readPlan(now()), facts, readGate(now())).ok
        for (const rest of keys.slice(i + 1)) setRow(rest, { phase: 'wait', text: gated ? "멈춤 — 위 '요약 전에 반드시' 부터" : '멈춤 — 위 오류부터' })
        failed += keys.length - i
        break
      }
      if (r === 'fail') failed += 1
      else {
        wrote += r[0]
        kept += r[1]
      }
    }
    pending.current = {}
    setBusy(false)
    if (gated) showToast('요약 전에 꼭 알아야 할 것이 있어요 — 위 칸에서 알려 주시면 [전부 써줘] 로 이어서 씁니다')
    else showToast(`AI 초안 — ${wrote}칸 썼습니다${kept ? ` · 고치신 칸 ${kept}개는 그대로 두고 새 안을 칸 아래에` : ''}${failed ? ` · ${failed}단계는 못 씀(다시 누르기)` : ''}`)
  }

  /** [전부 써줘] — 시장조사는 이미 됐으면 건너뛴다 */
  const allSteps = (): VPlanStep[] => VPLAN_STEPS.map((s) => s.key).filter((k) => k !== 'market' || !marketDone(readGate(now()).market))
  const failedKeys = VPLAN_STEPS.filter((s) => rows[s.key]?.phase === 'fail').map((s) => s.key)
  // D-263 자체점검 · 시장조사 줄은 칸에 보여 줄 묶음이 아니다 — 묶음 줄만 넘긴다
  const onRowsRef = useRef(onRows)
  onRowsRef.current = onRows
  useEffect(() => {
    onRowsRef.current?.(Object.fromEntries(Object.entries(rows).filter(([k]) => VPLAN_BATCHES.some((b) => b.key === k))))
  }, [rows])
  const runRef = useRef(runAll)
  runRef.current = runAll
  const lastReq = useRef(0)
  useEffect(() => {
    // 같은 요청을 두 번 쓰지 않게(화면이 다시 그려져도) · 다른 묶음을 쓰는 중이면 끝난 뒤에 이어서
    if (!request || request.n === lastReq.current || !hasMaterial || busy) return
    lastReq.current = request.n
    void runRef.current([request.batch])
  }, [request, hasMaterial, busy])

  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="vplan-ai">
        <div className="flex flex-col gap-1">
          <h3 className="t-body font-bold text-slate-900">AI 가 씁니다 — 버튼만 누르세요</h3>
          <p className="t-sub break-keep text-slate-700">
            시장조사 → 요약 → <b className="font-semibold">자체점검</b> → 본문 5묶음 → <b className="font-semibold">자체점검</b> 차례로 씁니다. 글로 고칠 수 있는 약점은 직접 고쳐 넣어 <b className="font-semibold">한 번에 끝내고</b>, <b className="font-semibold">고치신 칸은 덮지 않고 새 안으로 따로</b> 둡니다.
          </p>
          <p className="t-sub break-keep text-warning-800">누르면 재료 · 이미 쓴 칸 · 회사 숫자가 고른 AI 회사로 갑니다(사람 이름 · 연락처는 서버가 한 번 더 지움). 아직 출원 전 발명을 밖으로 보내면 안 되는 경우엔 누르지 마세요.</p>
          {/* D-255 모델 이름만 보이던 줄 → 누르면 고르는 단추(고른 모델은 모든 AI 단추가 같이) · D-263 자체점검 기준 */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ModelPicker />
            <JudgeSkillButton />
          </div>
        </div>
        {!hasMaterial ? (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 sm:flex-row sm:items-center" data-testid="vplan-ai-need">
            <p className="t-sub min-w-0 flex-1 break-keep text-warning-900">재료(특허 명세서 또는 AX · MVP)가 없으면 AI 가 지어낼 수 있어 막아 두었습니다.</p>
            <Button variant="primary" size="sm" onClick={onGoMaterials}>
              재료 넣기
            </Button>
          </div>
        ) : (
          <>
            <SummaryGateCard key={gate.patentNo} gate={sg} market={gate.market} patentInput={gate.patentNo} busy={busy} onSave={save} onRunMarket={() => void runAll(['market'])} rowMarket={rows.market} notes={notes} />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={busy} onClick={() => void runAll(allSteps())} data-testid="vplan-ai-run">
                {busy ? '쓰는 중…' : '전부 써줘'}
              </Button>
              {failedKeys.length > 0 && !busy && (
                <Button variant="secondary" size="sm" onClick={() => void runAll(failedKeys)} data-testid="vplan-ai-retry">
                  못 쓴 {failedKeys.length}단계만 다시
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
                닫기
              </Button>
            </div>
          </>
        )}
        <ul className="flex flex-col" data-testid="vplan-ai-rows">
          {VPLAN_STEPS.map((st) => {
            const r = rows[st.key]
            const isBatch = VPLAN_BATCHES.some((b) => b.key === st.key)
            const blocked = st.key === 'sum' && !sg.ok
            const judge = st.key === 'judgeSum' || st.key === 'judgeAll'
            return (
              <li key={st.key} className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center" data-testid="vplan-ai-row" data-key={st.key} data-phase={r?.phase ?? ''}>
                <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                  <b className="font-semibold">{st.label}</b>
                  {isBatch && <span className="text-slate-500"> · {fieldsOfBatch(st.key as VPlanBatch).length}칸</span>}
                  {blocked && !r && <span className="block text-warning-800">요약 전에 먼저 — {sg.missing.join(' · ')}</span>}
                  {r && <span className={`block ${r.phase === 'fail' ? 'text-danger-700' : r.phase === 'done' ? 'text-success-700' : 'text-slate-600'}`}>{r.phase === 'done' ? '✓ ' : r.phase === 'fail' ? '△ ' : ''}{r.text}</span>}
                </p>
                {hasMaterial && (
                  <Button variant="ghost" size="sm" className="self-start sm:self-auto" disabled={busy || blocked} onClick={() => void runAll([st.key])} data-testid="vplan-ai-one" title={blocked ? `요약 전에 먼저 — ${sg.missing.join(' · ')}` : undefined}>
                    {judge ? (r?.phase === 'done' ? '다시 판정' : '판정해줘') : st.key === 'market' ? (r?.phase === 'done' || marketDone(gate.market) ? '다시 조사' : '조사해줘') : r?.phase === 'done' ? '다시 써줘' : '이것만 써줘'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {(gate.judge.full ?? gate.judge.sum) && <JudgeReportView report={gate.judge.full ?? gate.judge.sum} title={gate.judge.full ? '자체점검 ② 사업계획서 전체' : '자체점검 ① 요약'} testId="vplan-judge" />}
        {asks.length > 0 && (
          <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid="vplan-ai-asks">
            <p className="t-sub font-semibold text-slate-800">AI 가 확인해 달라는 점</p>
            <ul className="flex flex-col gap-1">
              {asks.map((a) => (
                <li key={a.id} className="t-sub flex flex-wrap items-center gap-x-2 break-keep text-slate-700">
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{VPLAN_FIELD[a.id]?.title ?? (a.id.startsWith('judge') ? '자체점검' : a.id)}</b> · {a.text}
                  </span>
                  {VPLAN_FIELD[a.id] && (
                    <Button variant="ghost" size="sm" onClick={() => onGoField(a.id)}>
                      그 칸으로
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Surface>
  )
}

/* ------------------------------------------------------------------ */
/* 요약 전에 반드시 — 시장조사 · 출원번호 · 기술인력                        */
/* ------------------------------------------------------------------ */

const STAFF_CHIPS = [0, 1, 2, 3, 4, 5]
const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim()

function Mark({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success-600" /> : <Circle aria-hidden="true" className="size-5 shrink-0 text-warning-600" />
}

function SummaryGateCard({
  gate,
  market,
  patentInput,
  busy,
  onSave,
  onRunMarket,
  rowMarket,
  notes,
}: {
  gate: ReturnType<typeof summaryGate>
  market: MarketResearch | null
  patentInput: string
  busy: boolean
  onSave: (patch: Record<string, string>) => Promise<void>
  onRunMarket: () => void
  rowMarket?: RowState
  notes: Record<string, string>
}) {
  const { showToast } = useToast()
  const [patentEdit, setPatentEdit] = useState(false)
  const [patentText, setPatentText] = useState(patentInput === PATENT_NONE ? '' : patentInput)
  const [staffText, setStaffText] = useState('')
  // 숫자 고치기 — 대표가 열고 닫은 대로, 아직 안 건드렸으면 AI 가 숫자를 다 못 찾았을 때 저절로 열림
  const [marketEditPick, setMarketEdit] = useState<boolean | null>(null)
  const marketEdit = marketEditPick ?? (!!market && !gate.market.ok)
  const mkOf = (m: MarketResearch | null) => ({ tam: m?.tam.amount ?? '', sam: m?.sam.amount ?? '', som: m?.som.amount ?? '', source: m?.tam.source ?? '' })
  const [mk, setMk] = useState(() => mkOf(market))
  // 새 조사 결과가 오면 칸도 새 숫자로(렌더 중 맞추기)
  const [mkAt, setMkAt] = useState(market?.at ?? '')
  if ((market?.at ?? '') !== mkAt) {
    setMkAt(market?.at ?? '')
    setMk(mkOf(market))
  }
  const done = [gate.market.ok, gate.patent.ok, gate.rd.ok].filter(Boolean).length

  const savePatch = async (patch: Record<string, string>, msg: string) => {
    try {
      await onSave(patch)
      showToast(msg)
      return true
    } catch (e) {
      showToast(`저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`)
      return false
    }
  }
  const savePatent = async (v: string) => {
    if (v !== PATENT_NONE && !normalizeAppNo(v)) {
      showToast('출원번호 모양이 아닙니다 — 예: 10-2026-0012345(특허 10 · 실용 20)')
      return
    }
    if (await savePatch(patentPatch(readPlan(notes), v), v === PATENT_NONE ? '아직 출원 전으로 두었습니다 — 요약에 "출원 예정" 으로 씁니다' : `출원번호 ${normalizeAppNo(v)} 을 넣었습니다`)) setPatentEdit(false)
  }
  const saveOrg = (org: string) => void savePatch({ [VK.text('rd_org')]: org }, `연구개발 조직: ${RD_ORG_SHORT[org] ?? org}`)
  const saveStaff = (n: number) => void savePatch(researchersPatch(n), `연구개발 인원 ${n}명`)
  const confirmMarket = async () => {
    if (market && (await savePatch(marketPatch(marketConfirmed(market, new Date().toISOString())), 'AI 추정 숫자를 대표 확인 숫자로 두었습니다 — 출처를 알면 숫자 고치기에서 바꿔 주세요'))) setMarketEdit(false)
  }
  const saveMarket = async () => {
    const fig = (amount: string) => ({ amount: squeeze(amount).slice(0, 80), basis: '', source: squeeze(mk.source).slice(0, 200), year: '' })
    const base: MarketResearch = market ?? { tam: fig(''), sam: fig(''), som: fig(''), cagr: fig(''), customer: '', price: '', scope: '', headline: '', grounded: false, sources: [], at: '', by: 'human' }
    const next: MarketResearch = { ...base, tam: { ...fig(mk.tam), basis: base.tam.basis }, sam: { ...fig(mk.sam), basis: base.sam.basis }, som: { ...fig(mk.som), basis: base.som.basis }, by: 'human', at: new Date().toISOString() }
    if (await savePatch(marketPatch(next), '시장 숫자를 넣었습니다(대표 확인)')) setMarketEdit(false)
  }

  return (
    <section className={`flex flex-col gap-2.5 rounded-(--radius-control) border px-3 py-2.5 ${gate.ok ? 'border-success-200 bg-success-50/60' : 'border-warning-300 bg-warning-50'}`} data-testid="vplan-gate" data-ok={gate.ok ? 'yes' : 'no'} aria-labelledby="vplan-gate-title">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="vplan-gate-title" className="t-sub font-bold text-slate-900">
          요약 전에 반드시 — 3가지
        </h4>
        <span className={`t-meta rounded-full px-2 py-0.5 font-bold ${gate.ok ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-900'}`} data-testid="vplan-gate-count">
          {done}/3
        </span>
        <span className="t-meta break-keep text-slate-600">{gate.ok ? '다 알았어요 — 요약을 쓸 수 있습니다' : '셋을 다 알기 전에는 요약을 쓰지 않습니다(기준 문서 23-1B)'}</span>
      </div>

      {/* ① 시장조사 */}
      <div className="flex flex-col gap-1.5" data-testid="vplan-gate-market" data-ok={gate.market.ok ? 'yes' : 'no'}>
        <div className="flex items-start gap-2">
          <Mark ok={gate.market.ok} />
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
            <b className="font-semibold">① 시장조사(TAM · SAM · SOM)</b> · <span className={gate.market.ok ? 'text-slate-700' : 'text-warning-900'}>{rowMarket?.phase === 'run' ? rowMarket.text : gate.market.text}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pl-7">
          {marketNeedsConfirm(market) && (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void confirmMarket()} data-testid="vplan-gate-market-confirm">
              이 숫자로 확인
            </Button>
          )}
          <Button variant={gate.market.ok || marketNeedsConfirm(market) ? 'ghost' : 'primary'} size="sm" disabled={busy} onClick={onRunMarket} data-testid="vplan-gate-market-run">
            {market ? '다시 조사' : 'AI로 시장조사'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMarketEdit(!marketEdit)} data-testid="vplan-gate-market-edit">
            {marketEdit ? '숫자 고치기 닫기' : '숫자 고치기'}
          </Button>
        </div>
        {marketEdit && (
          <div className="grid gap-2 pl-7 sm:grid-cols-2" data-testid="vplan-gate-market-form">
            {(['tam', 'sam', 'som'] as const).map((k) => (
              <label key={k} className="t-meta flex flex-col gap-0.5 font-semibold text-slate-700">
                {k.toUpperCase()} 규모
                <input value={mk[k]} onChange={(e) => setMk((c) => ({ ...c, [k]: e.target.value }))} placeholder={k === 'tam' ? '예: 1조 2,000억 원' : k === 'sam' ? '예: 3,500억 원' : '예: 12억 원(3년)'} className="t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-normal text-slate-900" data-testid={`vplan-gate-${k}`} />
                {market?.[k].basis && <span className="t-meta break-keep font-normal text-slate-600 [overflow-wrap:anywhere]" data-testid={`vplan-gate-${k}-basis`}>AI 산식 · {market[k].basis}</span>}
              </label>
            ))}
            <label className="t-meta flex flex-col gap-0.5 font-semibold text-slate-700">
              출처
              <input value={mk.source} onChange={(e) => setMk((c) => ({ ...c, source: e.target.value }))} placeholder="예: 통계청 2025 · 협회 보고서" className="t-sub min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 font-normal text-slate-900" />
            </label>
            <Button variant="secondary" size="sm" className="self-end" disabled={!mk.tam.trim() || !mk.sam.trim() || !mk.som.trim()} onClick={() => void saveMarket()} data-testid="vplan-gate-market-save">
              숫자 저장
            </Button>
          </div>
        )}
      </div>

      {/* ② 출원번호 */}
      <div className="flex flex-col gap-1.5" data-testid="vplan-gate-patent" data-ok={gate.patent.ok ? 'yes' : 'no'}>
        <div className="flex items-start gap-2">
          <Mark ok={gate.patent.ok} />
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
            <b className="font-semibold">② 출원된 특허번호</b> · <span className={gate.patent.ok ? 'text-slate-700' : 'text-warning-900'}>{gate.patent.text}</span>
          </p>
          {gate.patent.ok && !patentEdit && (
            <Button variant="ghost" size="sm" onClick={() => setPatentEdit(true)} data-testid="vplan-gate-patent-change">
              바꾸기
            </Button>
          )}
        </div>
        {(!gate.patent.ok || patentEdit) && (
          <div className="flex flex-col gap-2 pl-7 sm:flex-row sm:items-center">
            <input value={patentText} onChange={(e) => setPatentText(e.target.value)} inputMode="numeric" placeholder="10-2026-0012345" aria-label="출원번호" className="t-sub min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 text-slate-900" data-testid="vplan-gate-patent-input" />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={!patentText.trim()} onClick={() => void savePatent(patentText)} data-testid="vplan-gate-patent-save">
                번호 넣기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void savePatent(PATENT_NONE)} data-testid="vplan-gate-patent-none">
                아직 출원 전이에요
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ③ 기술인력 */}
      <div className="flex flex-col gap-1.5" data-testid="vplan-gate-rd" data-ok={gate.rd.ok ? 'yes' : 'no'}>
        <div className="flex items-start gap-2">
          <Mark ok={gate.rd.ok} />
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
            <b className="font-semibold">③ 기술인력 — 연구개발전담부서 유무 · 인원</b> · <span className={gate.rd.ok ? 'text-slate-700' : 'text-warning-900'}>{gate.rd.text}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-7" role="group" aria-label="연구개발 조직">
          {RD_ORG_OPTIONS.map((o) => {
            const on = gate.rd.org === o
            return (
              <button key={o} type="button" onClick={() => saveOrg(o)} aria-pressed={on} className={`tap t-meta min-h-11 rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} data-testid="vplan-gate-org" data-org={RD_ORG_SHORT[o]}>
                {RD_ORG_SHORT[o]}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-7" role="group" aria-label="연구개발 인원">
          <span className="t-meta font-semibold text-slate-600">인원</span>
          {STAFF_CHIPS.map((n) => {
            const on = gate.rd.staff === n
            return (
              <button key={n} type="button" onClick={() => saveStaff(n)} aria-pressed={on} className={`tap t-meta min-h-11 min-w-11 rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`} data-testid="vplan-gate-staff" data-n={n}>
                {n}명
              </button>
            )
          })}
          <input value={staffText} onChange={(e) => setStaffText(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} inputMode="numeric" placeholder="6명 이상" aria-label="연구개발 인원(직접)" className="t-sub min-h-11 w-24 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 text-slate-900" data-testid="vplan-gate-staff-input" />
          {staffText && (
            <Button variant="secondary" size="sm" onClick={() => saveStaff(Number(staffText))} data-testid="vplan-gate-staff-save">
              {staffText}명 넣기
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
