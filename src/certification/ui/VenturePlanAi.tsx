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
 * D-270 대표: "벤처도 마찬가지 · 기획이 제일 중요 · 버튼 하나로 처음부터 끝까지보다 기획 단계에서 여러 개 내고 가장 괜찮은 것을 고르고".
 *   [전부 써줘] 를 없애고 절차마다 단추: 기획 방향 5개(순위 · 이유 · 제일 좋은 것 · 더 짜내기) → [이걸로 시작하자] → 요약 전 3가지
 *   → [요약 쓰기 — 자체점검 ① 까지] → [요약 확인 — 본문 쓰기](자체점검 ② 까지). 고른 방향은 모든 쓰기 · 자체점검 · 시장조사에 같이 간다.
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, Gavel, Loader2, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { AssistError, assistMessage, usedModel } from '../../services/aiAssist/client'
import { rankLabel } from '../../services/aiAssist/candidates'
import { prettyModel } from '../../services/patent/specRun'
import { answerOf } from '../../services/aiAssist/looseJson'
import { judgeOf, judgePassed, type JudgeReport } from '../../services/aiAssist/judge'
import { readJudgeSkill } from '../../services/aiAssist/judgeSkill'
import { callAssistRetry, retryText } from '../../services/aiAssist/retry'
import { readChoice } from '../../services/aiAssist/store'
import { ModelPicker } from '../../components/ai/ModelPicker'
import { PlanTalk } from '../../components/ai/PlanTalk'
import { TALK_MAX, answeredCount, talkFinished, talkOf, withAnswer } from '../../services/aiAssist/talk'
import { JudgeReportView, JudgeSkillButton } from '../../components/ai/JudgePanel'
import { RD_ORG_OPTIONS, VK, VPLAN_FIELD, mergeDraft, readPlan, type VPlanBatch, type VPlanFacts } from '../core/venturePlan'
import { PATENT_NONE, PLAN_LINE_LABEL, RD_ORG_SHORT, chosenPlan, judgePatch, marketConfirmed, marketDone, marketNeedsConfirm, marketOf, marketPatch, normalizeAppNo, patentPatch, planStatePatch, readGate, researchersPatch, summaryGate, type MarketResearch, type PlanPick } from '../integration/ventureGate'
import { VPLAN_BATCHES, VPLAN_STEPS, addMorePlans, buildBatchContext, buildMarketContext, buildPlanContext, buildPlanMoreContext, buildPlanRankContext, buildVentureJudgeContext, buildVentureTalkContext, draftItemsOf, fieldsOfBatch, judgeItemsOf, plansOf, rerankPlans, type VPlanStep } from '../integration/venturePlanAi'
import { AiConfirm } from '../../components/ai/AiConfirm'

export type AiRow = { phase: 'wait' | 'run' | 'done' | 'fail'; text: string; model?: string }
type RowState = AiRow

/** 이 오류면 다음 단계도 똑같이 실패한다 — 거기서 멈춘다 */
const STOP_CODES = new Set(['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed', 'provider_auth', 'rate_limited', 'network'])
const JUDGE_ROUNDS = 2

const HINT = {
  market: '앞 답을 읽지 못했습니다. items 의 title 을 "tam" · "sam" · "som" · "cagr" · "customer" · "price" · "scope" 이름표 그대로, amount = 규모, detail = 산식, tag = 출처, when = 기준연도로 다시 써 주세요. JSON 한 덩어리만.',
  batch: '앞 답을 읽지 못했습니다. items 의 title = 칸 id 그대로(예 development_background), body = 그 칸 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  judge: '앞 답을 읽지 못했습니다. items 에 {"title":"score","amount":"합계 점수"} 하나, 판정은 {"title":"verdict","tag":"P0 · 감점 · 대표 확인","detail":"문제","body":"고친 방법"}, 고친 칸은 {"title":"칸 id","body":"고친 전체 글"} 로 다시 써 주세요. JSON 한 덩어리만.',
  plan: '앞 답을 읽지 못했습니다. 기획 방향 5개 — items 마다 title = 방향 한 줄, outline = 정확히 6줄(핵심 기술 · 목표 고객 · 시장 · 차별 · 증거 · 3년 성장 · 약점), detail = 회사 근거, amount = 점수, when = 순위 이유로 다시 써 주세요. JSON 한 덩어리만.',
  rank: '앞 답을 읽지 못했습니다. 후보마다 항목 하나 — title = "후보 n", amount = 점수(0~100 숫자만), tag = 순위, when = 이 순위인 이유 한 줄로 다시 써 주세요. JSON 한 덩어리만.',
  talk: '앞 답을 읽지 못했습니다. items — {"tag":"이해","title":"회사 한 줄"}(첫 질문만) · {"tag":"의견","title":"줄거리","detail":"흔한지 · 약한 점"} 1~3개 · {"tag":"질문","title":"질문 한 문장","detail":"왜 묻는지","outline":["답1","답2","답3","잘 모르겠어요 — AI 가 정해 주세요"]}. 충분하면 질문 대신 {"tag":"충분","title":"왜 충분한지"}. JSON 한 덩어리만.',
}

/** D-270 맨 위 차례 — 절차마다 단추로 넘어간다 */
type VPhase = 'need' | 'plan' | 'gate' | 'sum' | 'body' | 'done'
const VSTEPS: { label: string; phases: VPhase[] }[] = [
  { label: '재료', phases: ['need'] },
  { label: '기획 방향', phases: ['plan'] },
  { label: '요약 전 3가지', phases: ['gate'] },
  { label: '요약 · 자체점검 ①', phases: ['sum'] },
  { label: '본문 · 자체점검 ②', phases: ['body', 'done'] },
]
const VHEAD: Record<VPhase, string> = {
  need: '재료부터 — 특허 명세서나 AX · MVP',
  plan: '기획부터 — AI 와 사업계획서 방향을 잡습니다',
  gate: '요약 전에 3가지를 채워 주세요',
  sum: '요약을 씁니다',
  body: '요약을 확인하고 본문을 씁니다',
  done: '사업계획서를 다 썼어요',
}
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
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
  onRequestTaken,
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
  /** D-289 칸 요청을 받아 쓰기 시작했으면 — 부르는 쪽이 요청을 비운다(판을 다시 펼쳐도 또 부르지 않게) */
  onRequestTaken?: () => void
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
      // D-270 기획 방향을 고르기 전에는 사업계획서 칸을 쓰지 않는다(시장조사는 됨) — 칸에서 누른 [AI로 이 칸 쓰기] 는 그대로
      if (!chosenPlan(readGate(now()).plan) && !requestRun.current) {
        setRow(key, { phase: 'fail', text: '기획 방향부터 — 위에서 방향을 골라 [이걸로 시작하자]' })
        return 'stop'
      }
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
    if (gated) showToast('요약 전에 꼭 알아야 할 것이 있어요 — 위 칸에서 알려 주시면 [요약 쓰기] 로 이어서 씁니다')
    else showToast(`AI 초안 — ${wrote}칸 썼습니다${kept ? ` · 고치신 칸 ${kept}개는 그대로 두고 새 안을 칸 아래에` : ''}${failed ? ` · ${failed}단계는 못 씀(다시 누르기)` : ''}`)
  }

  const failedKeys = VPLAN_STEPS.filter((s) => rows[s.key]?.phase === 'fail').map((s) => s.key)
  // D-263 자체점검 · 시장조사 줄은 칸에 보여 줄 묶음이 아니다 — 묶음 줄만 넘긴다
  const onRowsRef = useRef(onRows)
  onRowsRef.current = onRows
  useEffect(() => {
    onRowsRef.current?.(Object.fromEntries(Object.entries(rows).filter(([k]) => VPLAN_BATCHES.some((b) => b.key === k))))
  }, [rows])
  /** 칸에서 누른 [AI로 이 칸 쓰기] 로 도는 중(기획 방향 전이어도 그 칸은 쓴다) */
  const requestRun = useRef(false)
  const runRef = useRef(runAll)
  runRef.current = runAll
  const lastReq = useRef(0)
  useEffect(() => {
    // 같은 요청을 두 번 쓰지 않게(화면이 다시 그려져도) · 다른 묶음을 쓰는 중이면 끝난 뒤에 이어서
    if (!request || request.n === lastReq.current || !hasMaterial || busy) return
    lastReq.current = request.n
    // D-289 받은 요청은 바로 비운다 — 판을 접었다 다시 펼치면(새로 그려지며 lastReq 가 0) 지난 요청을 누르지 않아도 또 부르던 문제
    onRequestTaken?.()
    requestRun.current = true
    void runRef.current([request.batch]).finally(() => {
      requestRun.current = false
    })
  }, [request, hasMaterial, busy, onRequestTaken])

  /* D-270 기획 방향 — [기획 방향 5개 내줘] · [이 중 제일 좋은 게 뭐야?] · [자체점검으로 더 짜내기] · [이걸로 시작하자] */
  const planSt = gate.plan
  const chosen = chosenPlan(planSt)
  const [pickTitle, setPickTitle] = useState('')
  const picked: PlanPick | null = planSt.options.find((p) => p.title === pickTitle) ?? planSt.options[0] ?? null
  const runPlan = async (kind: 'plan' | 'rank' | 'more') => {
    if (busy) return
    const key = kind === 'plan' ? 'plan' : kind === 'rank' ? 'planRank' : 'planMore'
    setBusy(true)
    setRow(key, { phase: 'run', text: kind === 'plan' ? '기획 방향 5개를 내고 순위를 매기는 중…(30~60초)' : kind === 'rank' ? '방향을 자체점검 기준으로 견주는 중…' : '지금 방향의 약점을 공격하고 새 방향을 짜내는 중…' })
    try {
      const skill = readJudgeSkill()
      const st = readPlan(now())
      const g = readGate(now())
      const onRetry = (w: 'parse' | 'transient' | 'rate', n: number, t: number) => setRow(key, { phase: 'run', text: retryText(w, n, t) })
      if (kind === 'plan') {
        const { run, value } = await callAssistRetry({
          req: { assistId: 'venture.plan', page: 'venture', choice: choiceOf(), context: buildPlanContext({ state: st, facts, today, gate: g }), ...(skill ? { skill } : {}) },
          parse: (r) => {
            const p = plansOf(answerOf(r))
            return p.length >= 2 ? p : null
          },
          hint: HINT.plan,
          missMessage: 'AI 답에서 기획 방향을 찾지 못했습니다 — 다시 눌러 주세요',
          onRetry,
        })
        await save(planStatePatch({ ...readGate(now()).plan, options: value, chosen: '' }))
        setPickTitle('')
        setRow(key, { phase: 'done', text: `${value.length}개 — 1순위 '${value[0].title}'${value[0].score != null ? `(${value[0].score}점)` : ''} · 골라서 [이걸로 시작하자]`, model: usedModel(run) })
      } else if (kind === 'rank') {
        const { run, value } = await callAssistRetry({
          req: { assistId: 'venture.planRank', page: 'venture', choice: choiceOf(), context: buildPlanRankContext({ state: st, facts, today, gate: g }), ...(skill ? { skill } : {}) },
          parse: (r) => {
            const x = rerankPlans(g.plan.options, answerOf(r))
            return x.matched ? x : null
          },
          hint: HINT.rank,
          missMessage: 'AI 답에서 후보 점수를 찾지 못했습니다 — 다시 눌러 주세요',
          onRetry,
        })
        await save(planStatePatch({ ...readGate(now()).plan, options: value.items, chosen: '' }))
        setPickTitle('')
        const top = value.items[0]
        setRow(key, { phase: 'done', text: `가장 나은 것 — '${top.title}'${top.score != null ? `(${top.score}점)` : ''}${value.headline ? ` · ${value.headline}` : ''}`, model: usedModel(run) })
      } else {
        const { run, value } = await callAssistRetry({
          req: { assistId: 'venture.planMore', page: 'venture', choice: choiceOf(), context: buildPlanMoreContext({ state: st, facts, today, gate: g }), ...(skill ? { skill } : {}) },
          parse: (r) => {
            const p = plansOf(answerOf(r), 3)
            return p.length ? { more: p, headline: String(answerOf(r)?.headline ?? '').trim() } : null
          },
          hint: HINT.plan,
          missMessage: 'AI 답에서 새 방향을 찾지 못했습니다 — 다시 눌러 주세요',
          onRetry,
        })
        const m = addMorePlans(g.plan.options, value.more)
        await save(planStatePatch({ ...readGate(now()).plan, options: m.items, chosen: '' }))
        setRow(key, { phase: 'done', text: m.added ? `새 방향 ${m.added}개${value.headline ? ` — 지금 방향의 약점: ${value.headline}` : ''}` : '새로 나온 것이 지금 방향과 같습니다 — 한 번 더 눌러 보세요', model: usedModel(run) })
      }
    } catch (e) {
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setRow(key, { phase: 'fail', text: why })
    }
    setBusy(false)
  }
  /*
   * D-271 기획 대화 — 대표: "의견을 딱 주는 거야 · 이런 거는 너무 흔하고 · 어떤 방식으로 하는 게 좋을까요? · 다섯 번 이내 ·
   *   특허든 벤처든 버튼 하나로 기획까지". 답을 누르면 다음 질문 · 다섯 번 또는 AI 가 '충분' 이면 그 답대로 방향 5개.
   */
  const runTalk = async (answer?: string) => {
    if (busy) return
    setBusy(true)
    try {
      if (answer) {
        const g0 = readGate(now()).plan
        const next = withAnswer(g0.talk, answer)
        await save(planStatePatch({ ...g0, talk: next }))
        if (talkFinished(next)) {
          setBusy(false)
          await runPlan('plan')
          return
        }
      }
      const g = readGate(now())
      const n = answeredCount(g.plan.talk)
      setRow('talk', { phase: 'run', text: n ? `답 ${n}개를 보고 다음 질문을 고르는 중…` : 'AI 가 재료를 읽고 의견과 첫 질문을 정리하는 중…(20초쯤)' })
      const skill = readJudgeSkill()
      const { run, value: round } = await callAssistRetry({
        req: { assistId: 'venture.talk', page: 'venture', choice: choiceOf(), context: buildVentureTalkContext({ state: readPlan(now()), facts, today, gate: g }), ...(skill ? { skill } : {}) },
        parse: (r) => talkOf(answerOf(r)),
        hint: HINT.talk,
        missMessage: 'AI 답에서 질문을 찾지 못했습니다 — 다시 눌러 주세요',
        onRetry: (w, k, t) => setRow('talk', { phase: 'run', text: retryText(w, k, t) }),
      })
      const g1 = readGate(now()).plan
      await save(planStatePatch({ ...g1, talk: [...g1.talk.filter((r) => r.answer.trim() || r.done), round].slice(-(TALK_MAX + 1)) }))
      setRow('talk', { phase: 'done', text: round.done ? '충분히 좁혀졌어요 — 이 대화대로 방향 5개를 냅니다' : `질문 ${Math.min(n + 1, TALK_MAX)}/${TALK_MAX} — 답을 눌러 주세요`, model: usedModel(run) })
      if (round.done) {
        setBusy(false)
        await runPlan('plan')
        return
      }
    } catch (e) {
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setRow('talk', { phase: 'fail', text: why })
    }
    setBusy(false)
  }
  const talkAgain = async () => {
    if (planSt.talk.length && !window.confirm('기획 대화를 처음부터 다시 할까요? 지금 답은 지워집니다.')) return
    await save(planStatePatch({ ...readGate(now()).plan, talk: [] }))
    setRows((cur) => {
      const { talk: _drop, ...rest } = cur
      void _drop
      return rest
    })
  }
  const choosePlan = async () => {
    if (!picked) return
    await save(planStatePatch({ ...readGate(now()).plan, chosen: picked.title }))
    showToast(`'${clip(picked.title, 30)}' 방향으로 — 다음은 요약 전 3가지(시장조사 · 출원번호 · 기술인력)`)
  }
  const backToPlans = async () => {
    if (!window.confirm('기획 방향을 다시 고릅니다. 이미 쓴 칸은 그대로 두고, 다시 쓰면 새 방향으로 씁니다. 돌아갈까요?')) return
    await save(planStatePatch({ ...readGate(now()).plan, chosen: '' }))
  }

  // 지금 어느 절차인가 — 재료 → 기획 방향 → 요약 전 3가지 → 요약 → 본문
  const planText = readPlan(notes).text
  const textOf = (b: VPlanStep) => (VPLAN_BATCHES.some((x) => x.key === b) ? fieldsOfBatch(b as VPlanBatch).filter((f) => f.kind === 'text' || f.kind === 'line') : [])
  // 요약은 자체점검 ① 까지 거쳤거나(판정이 있음) 요약 칸을 모두 썼으면 끝 — 회사 기록 · 문장 틀로 몇 칸만 찬 것은 아직
  const sumWritten = !!gate.judge.sum || textOf('sum').every((f) => (planText[f.id] ?? '').trim())
  const bodyLeft = VPLAN_BATCHES.filter((b) => b.key !== 'sum' && textOf(b.key).some((f) => !(planText[f.id] ?? '').trim())).map((b) => b.key)
  const phase: VPhase = !hasMaterial ? 'need' : !chosen ? 'plan' : !sg.ok ? 'gate' : !sumWritten ? 'sum' : bodyLeft.length ? 'body' : 'done'
  const stepAt = VSTEPS.findIndex((x) => x.phases.includes(phase))
  const planRowsShown = (['talk', 'plan', 'planRank', 'planMore'] as const).filter((k) => rows[k])

  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="vplan-ai" data-phase={phase}>
        <div className="flex flex-col gap-1">
          <h3 className="t-body font-bold text-slate-900" data-testid="vplan-ai-head">
            {busy ? 'AI 가 쓰는 중이에요…' : VHEAD[phase]}
          </h3>
          <p className="t-sub break-keep text-slate-700">
            기획 방향을 먼저 고르고 → 요약 전 3가지 → 요약(<b className="font-semibold">자체점검 ①</b>) → 본문 5묶음(<b className="font-semibold">자체점검 ②</b>) 차례로, 절차마다 단추로 넘어갑니다. 글로 고칠 수 있는 약점은 직접 고쳐 넣고, <b className="font-semibold">고치신 칸은 덮지 않고 새 안으로 따로</b> 둡니다.
          </p>
          <p className="t-sub break-keep text-warning-800">누르면 재료 · 이미 쓴 칸 · 회사 숫자가 고른 AI 회사로 갑니다(사람 이름 · 연락처는 서버가 한 번 더 지움). 아직 출원 전 발명을 밖으로 보내면 안 되는 경우엔 누르지 마세요.</p>
          {/* D-255 모델 이름만 보이던 줄 → 누르면 고르는 단추(고른 모델은 모든 AI 단추가 같이 · 단계마다 그때 고른 모델로) · D-263 자체점검 기준 */}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ModelPicker />
            <JudgeSkillButton />
          </div>
        </div>
        <ol className="flex flex-wrap gap-1.5" data-testid="vplan-steps" data-phase={phase} aria-label="사업계획서 쓰는 차례">
          {VSTEPS.map((x, i) => {
            const now2 = i === stepAt
            const past = i < stepAt
            return (
              <li key={x.label} className={`t-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${now2 ? 'bg-brand-600 text-white' : past ? 'bg-success-100 text-success-800' : 'bg-slate-100 text-slate-500'}`} aria-current={now2 ? 'step' : undefined} data-testid="vplan-step" data-now={now2 ? 'yes' : 'no'}>
                {past ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true">{i + 1}</span>}
                {x.label}
              </li>
            )
          })}
        </ol>
        {!hasMaterial ? (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center" data-testid="vplan-ai-need">
            <p className="t-sub min-w-0 flex-1 break-keep text-warning-900">재료(특허 명세서 또는 AX · MVP)가 없으면 AI 가 지어낼 수 있어 막아 두었습니다.</p>
            <Button variant="primary" size="sm" onClick={onGoMaterials}>
              재료 넣기
            </Button>
          </div>
        ) : (
          <>
            {phase === 'plan' ? (
              <section className="flex flex-col gap-2.5" data-testid="vplan-plan" aria-label="기획 방향">
                {planSt.options.length === 0 ? (
                  planSt.talk.length ? (
                    <>
                      <PlanTalk rounds={planSt.talk} busy={busy} onAnswer={(a) => void runTalk(a)} onNext={() => void runPlan('plan')} nextLabel={talkFinished(planSt.talk) ? '이 대화대로 방향 5개 내줘' : '그만 묻고 지금 답대로 방향 5개 내줘'} testId="vplan-talk" />
                      {!busy && (
                        <div className="flex flex-wrap gap-2">
                          {rows.talk?.phase === 'fail' && (
                            <AiConfirm><Button variant="secondary" size="sm" onClick={() => void runTalk()} data-testid="vplan-talk-retry">
                              질문 다시 받기
                            </Button></AiConfirm>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => void talkAgain()} data-testid="vplan-talk-again">
                            기획 대화 처음부터
                          </Button>
                        </div>
                      )}
                    </>
                  ) : busy ? (
                    <p className="t-sub flex items-center gap-1.5 text-brand-800" role="status" data-testid="vplan-talk-wait">
                      <Loader2 aria-hidden="true" className="size-5 animate-spin" /> {rows.plan?.phase === 'run' ? '기획 방향을 내는 중…' : 'AI 가 재료를 읽고 의견을 정리하는 중…'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <AiConfirm><Button variant="primary" className="min-h-12" onClick={() => void runTalk()} data-testid="vplan-talk-start">
                          <MessageCircleQuestion aria-hidden="true" className="size-5" /> AI 와 기획 시작(질문 5번 안)
                        </Button></AiConfirm>
                        <AiConfirm><Button variant="secondary" onClick={() => void runPlan('plan')} data-testid="vplan-plan-run">
                          <Sparkles aria-hidden="true" className="size-4" /> 묻지 말고 방향 5개 내줘
                        </Button></AiConfirm>
                      </div>
                      <p className="t-meta break-keep text-slate-500">AI 가 회사를 어떻게 이해했는지 · 흔한 줄거리와 약한 점을 먼저 말하고, 무엇을 정하면 좋을지 하나씩 묻습니다. 답은 누르기만 하면 돼요.</p>
                    </div>
                  )
                ) : (
                  <>
                    {planSt.talk.some((r) => r.answer.trim()) && <PlanTalk rounds={planSt.talk} busy={false} onAnswer={() => {}} onNext={() => {}} nextLabel="" testId="vplan-talk" compact />}
                    <ul className="flex flex-col gap-2" role="radiogroup" aria-label="사업계획서 기획 방향 후보" data-testid="vplan-plan-list">
                      {planSt.options.map((p, i) => {
                        const on = picked?.title === p.title
                        return (
                          <li key={`${p.title}-${i}`} className={`flex flex-col rounded-(--radius-control) border-2 ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 bg-white'}`} data-testid="vplan-plan-option" data-rank={i + 1} data-picked={on ? 'yes' : 'no'} data-fresh={p.fresh ? 'yes' : 'no'}>
                            <button type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setPickTitle(p.title)} className="tap flex w-full min-w-0 items-start gap-2.5 px-3 pt-2.5 pb-1.5 text-left" data-testid="vplan-plan-pick">
                              <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand-600 bg-brand-600' : 'border-slate-400 bg-white'}`}>
                                {on && <span className="size-2 rounded-full bg-white" />}
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className={`t-meta rounded-full px-2 py-0.5 font-bold ${i === 0 ? 'bg-brand-600 text-white' : i < 3 ? 'bg-brand-100 text-brand-900' : 'bg-slate-100 text-slate-600'}`}>{rankLabel(i)}</span>
                                  {p.score != null && <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{p.score}점</span>}
                                  {p.fresh && <span className="t-meta rounded-full bg-danger-600 px-2 py-0.5 font-bold text-white">새로 · 자체점검</span>}
                                </span>
                                <span className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{p.title}</span>
                                {p.reason && <span className="t-sub break-keep text-brand-900">{i < 3 ? `${rankLabel(i)}인 이유 · ` : ''}{p.reason}</span>}
                                {p.lines[1] && <span className="t-meta break-keep text-slate-700">고객 · {clip(p.lines[1], 120)}</span>}
                                {p.why && <span className="t-meta break-keep text-slate-600">회사 근거 · {clip(p.why, 160)}</span>}
                              </span>
                            </button>
                            <details className="px-3 pb-2.5 pl-11">
                              <summary className="tap t-meta cursor-pointer font-semibold text-slate-600">자세히 — 핵심 기술 · 고객 · 차별 · 증거 · 3년 성장 · 약점</summary>
                              <dl className="t-meta mt-1 grid gap-0.5 break-keep text-slate-700">
                                {p.lines.map((l, j) => (
                                  <dd key={j}>
                                    <b className="font-semibold">{PLAN_LINE_LABEL[j] ?? ''}</b> · {l}
                                  </dd>
                                ))}
                              </dl>
                            </details>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <Button variant="primary" className="min-h-12" disabled={busy || !picked} onClick={() => void choosePlan()} data-testid="vplan-plan-start">
                        이걸로 시작하자 <ArrowRight aria-hidden="true" className="size-5" />
                      </Button>
                      <AiConfirm><Button variant="secondary" disabled={busy || planSt.options.length < 2} onClick={() => void runPlan('rank')} data-testid="vplan-plan-rank">
                        <Gavel aria-hidden="true" className="size-4" /> 이 중 제일 좋은 게 뭐야?
                      </Button></AiConfirm>
                      <AiConfirm><Button variant="secondary" disabled={busy} onClick={() => void runPlan('more')} data-testid="vplan-plan-more">
                        <Sparkles aria-hidden="true" className="size-4" /> 자체점검으로 더 짜내기
                      </Button></AiConfirm>
                      <AiConfirm><Button variant="ghost" disabled={busy} onClick={() => void runPlan('plan')} data-testid="vplan-plan-run">
                        5개 새로 내줘
                      </Button></AiConfirm>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <>
                {chosen && (
                  <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center" data-testid="vplan-plan-chosen">
                    <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                      <b className="font-semibold">기획 방향</b> · <span className="[overflow-wrap:anywhere]">{chosen.title}</span>
                    </p>
                    <Button variant="ghost" size="sm" className="self-start sm:self-auto" disabled={busy} onClick={() => void backToPlans()} data-testid="vplan-plan-back">
                      다른 방향으로
                    </Button>
                  </div>
                )}
                <SummaryGateCard key={gate.patentNo} gate={sg} market={gate.market} patentInput={gate.patentNo} busy={busy} onSave={save} onRunMarket={() => void runAll(['market'])} rowMarket={rows.market} notes={notes} />
                <div className="flex flex-wrap gap-2">
                  {phase === 'sum' && (
                    <AiConfirm><Button variant="primary" className="min-h-12" disabled={busy} onClick={() => void runAll(['sum', 'judgeSum'])} data-testid="vplan-ai-next" data-step="sum">
                      {busy ? '쓰는 중…' : '요약 쓰기 — 자체점검 ① 까지'}
                    </Button></AiConfirm>
                  )}
                  {phase === 'body' && (
                    <AiConfirm><Button variant="primary" className="min-h-12" disabled={busy} onClick={() => void runAll([...bodyLeft, 'judgeAll'])} data-testid="vplan-ai-next" data-step="body">
                      {busy ? '쓰는 중…' : `요약 확인 — 본문 ${bodyLeft.length}묶음 쓰기`}
                    </Button></AiConfirm>
                  )}
                  {failedKeys.length > 0 && !busy && (
                    <AiConfirm><Button variant="secondary" size="sm" onClick={() => void runAll(failedKeys)} data-testid="vplan-ai-retry">
                      못 쓴 {failedKeys.length}단계만 다시
                    </Button></AiConfirm>
                  )}
                  <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
                    닫기
                  </Button>
                </div>
              </>
            )}
            {planRowsShown.length > 0 && (
              <ul className="flex flex-col gap-0.5" data-testid="vplan-plan-rows">
                {planRowsShown.map((k) => {
                  const r = rows[k]!
                  return (
                    <li key={k} className={`t-sub break-keep ${r.phase === 'fail' ? 'text-danger-700' : r.phase === 'done' ? 'text-success-700' : 'text-slate-600'}`} data-testid="vplan-plan-row" data-key={k} data-phase={r.phase} data-model={r.model ?? ''}>
                      <b className="font-semibold text-slate-800">{k === 'talk' ? '기획 대화' : k === 'plan' ? '기획 방향' : k === 'planRank' ? '가장 나은 방향' : '자체점검으로 더 짜내기'}</b> · {r.text}
                      {r.model && <span className="t-meta ml-1.5 inline-block rounded bg-white px-1.5 font-semibold whitespace-nowrap text-slate-600 ring-1 ring-slate-200">{prettyModel(r.model)}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
        <ul className="flex flex-col" data-testid="vplan-ai-rows">
          {VPLAN_STEPS.map((st) => {
            const r = rows[st.key]
            const isBatch = VPLAN_BATCHES.some((b) => b.key === st.key)
            const blocked = (st.key === 'sum' && !sg.ok) || (!chosen && st.key !== 'market')
            const judge = st.key === 'judgeSum' || st.key === 'judgeAll'
            return (
              <li key={st.key} className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-center" data-testid="vplan-ai-row" data-key={st.key} data-phase={r?.phase ?? ''}>
                <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                  <b className="font-semibold">{st.label}</b>
                  {isBatch && <span className="text-slate-500"> · {fieldsOfBatch(st.key as VPlanBatch).length}칸</span>}
                  {blocked && !r && <span className="block text-warning-800">{!chosen && st.key !== 'market' ? '기획 방향부터 — 위에서 방향을 고르세요' : `요약 전에 먼저 — ${sg.missing.join(' · ')}`}</span>}
                  {r && <span className={`block ${r.phase === 'fail' ? 'text-danger-700' : r.phase === 'done' ? 'text-success-700' : 'text-slate-600'}`}>{r.phase === 'done' ? '✓ ' : r.phase === 'fail' ? '△ ' : ''}{r.text}</span>}
                </p>
                {hasMaterial && (
                  <AiConfirm><Button variant="ghost" size="sm" className="self-start sm:self-auto" disabled={busy || blocked} onClick={() => void runAll([st.key])} data-testid="vplan-ai-one" title={blocked ? (!chosen && st.key !== 'market' ? '기획 방향부터' : `요약 전에 먼저 — ${sg.missing.join(' · ')}`) : undefined}>
                    {judge ? (r?.phase === 'done' ? '다시 판정' : '판정해줘') : st.key === 'market' ? (r?.phase === 'done' || marketDone(gate.market) ? '다시 조사' : '조사해줘') : r?.phase === 'done' ? '다시 써줘' : '이것만 써줘'}
                  </Button></AiConfirm>
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
          <AiConfirm><Button variant={gate.market.ok || marketNeedsConfirm(market) ? 'ghost' : 'primary'} size="sm" disabled={busy} onClick={onRunMarket} data-testid="vplan-gate-market-run">
            {market ? '다시 조사' : 'AI로 시장조사'}
          </Button></AiConfirm>
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
