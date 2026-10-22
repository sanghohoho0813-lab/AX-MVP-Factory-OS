/**
 * D-252 명세서 AI 진행 — 화면 밖(이 모듈)에 둔다. 작업판을 나갔다 와도 쓰는 중 · 다 씀 · 실패가 그대로 보이고,
 * 나간 사이에 온 답은 다시 열 때 그 초안에 바로 들어간다(같은 접속 동안 · 메모리).
 *
 * 화면(명세서 편집기)이 열려 있으면 그 화면의 apply(받는 대로 저장)로 넣고, 닫혀 있으면 '넣을 것' 줄에 쌓아 두었다가
 * 다시 열 때 차례로 넣는다. 넣는 함수는 늘 '그 순간의 최신 초안' 을 받아 바꾸므로 사이에 고친 글을 덮지 않는다.
 */
import { AssistError, assistMessage, callAssist } from '../aiAssist/client'
import { answerOf, rawObjectOf } from '../aiAssist/looseJson'
import { judgeOf, judgePassed, type JudgeReport } from '../aiAssist/judge'
import { readJudgeSkill } from '../aiAssist/judgeSkill'
import { newRequestId, readChoice } from '../aiAssist/store'
import { cleanAiText, mergeSpecAi, type SectionKey, type SpecDraft } from './specDraft'
import { buildSpecContext, joinDetail, specItemsOf, type SpecBatch } from './specDraftAi'
import {
  applyFix,
  applyIdea,
  applyJudge,
  applyParts,
  buildFixContext,
  buildIdeaContext,
  buildJudgeContext,
  JUDGE_SCOPE_LABEL,
  buildPartsContext,
  buildResearchContext,
  fixIssues,
  fixItemsOf,
  fixable,
  ideasOf,
  partsOf,
  researchOf,
  stageBlock,
  stageOf,
  type AgentCompany,
  type AgentStage,
} from './specAgent'

export type Phase = 'wait' | 'run' | 'done' | 'fail' | 'skip'
export interface StageRow {
  phase: Phase
  text: string
}
export interface SpecRun {
  stages: Partial<Record<AgentStage, StageRow>>
  running: boolean
  /** AI 가 확인해 달라는 점(본문 · 청구항 묶음의 detail) */
  asks: { key: string; text: string }[]
}

export const IDLE: SpecRun = { stages: {}, running: false, asks: [] }

type Patch = (cur: SpecDraft) => SpecDraft
export interface SpecHost {
  get: () => SpecDraft
  apply: (p: Patch) => Promise<void>
}

export interface RunEnv {
  company: AgentCompany
  others: string[]
  today: string
  /** 사람이 고친 구성도 다시 쓰기(대표가 [다시 써줘] 를 확인했을 때) */
  forceParts?: boolean
}

const runs = new Map<string, SpecRun>()
const hosts = new Map<string, SpecHost>()
const pending = new Map<string, Patch[]>()
const shadow = new Map<string, SpecDraft>()
const subs = new Set<() => void>()
let version = 0

const emit = () => {
  version += 1
  for (const f of subs) f()
}
const setRun = (id: string, fn: (r: SpecRun) => SpecRun) => {
  runs.set(id, fn(runs.get(id) ?? IDLE))
  emit()
}
const setStage = (id: string, k: AgentStage, row: StageRow) => setRun(id, (r) => ({ ...r, stages: { ...r.stages, [k]: row } }))

export function subscribeSpecRun(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const specRunVersion = () => version
export const specRun = (id: string): SpecRun => runs.get(id) ?? IDLE
export const isSpecRunning = (id: string) => specRun(id).running

/** 편집기가 열릴 때 붙고 닫힐 때 떨어진다. 붙을 때 쌓인 것을 차례로 넣는다 */
export function attachSpecHost(id: string, host: SpecHost): () => void {
  hosts.set(id, host)
  const ps = pending.get(id)
  if (ps?.length) {
    pending.delete(id)
    void (async () => {
      for (const p of ps) await host.apply(p)
      emit()
    })()
  }
  return () => {
    if (hosts.get(id) !== host) return
    shadow.set(id, host.get())
    hosts.delete(id)
  }
}

/** 화면에 없을 때 쌓인 것이 있나(목록에 '들어갈 AI 글 있음') */
export const pendingCount = (id: string) => pending.get(id)?.length ?? 0

const current = (id: string): SpecDraft | null => hosts.get(id)?.get() ?? shadow.get(id) ?? null

async function patch(id: string, p: Patch): Promise<SpecDraft | null> {
  const h = hosts.get(id)
  if (h) {
    await h.apply(p)
    return h.get()
  }
  const cur = shadow.get(id)
  if (cur) shadow.set(id, p(cur))
  pending.set(id, [...(pending.get(id) ?? []), p])
  return shadow.get(id) ?? null
}

/** 이 오류면 다음 단계도 똑같이 실패한다 — 거기서 멈춘다 */
const STOP_CODES = new Set(['setup_needed', 'db_setup_needed', 'login_required', 'forbidden', 'not_deployed', 'provider_auth', 'network'])
export const RATE_RETRY_MS = 65_000
let retryMs = RATE_RETRY_MS
/** 시험용 — 쉬었다 다시 부르는 시간 */
export function __setRetryMs(ms: number) {
  retryMs = ms
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/*
 * D-262 단계가 한 번 어긋나도 멈추지 않게 — 대표: "저기 단계에서 자꾸 막히네. llm 모델이 문제가 아닌 것 같아".
 * 예전엔 답 모양이 어긋나면(이름표가 다른 칸 · 머리글 빠짐 · 끝 잘림) 곧바로 '실패' 였다(다시 부르기는 '많이 불렀음' 때만).
 * 이제 같은 단계를 3번까지 — 두 번째부터는 무엇이 어긋났는지 · 이름표를 다시 알려 준다. 잠깐 끊긴 연결(시간 초과 · 붐빔)도 잠시 쉬었다 다시.
 */
const TRIES = 3
const PARSE_MISS = 'parse_miss'
const TRANSIENT = new Set(['provider_unreachable', 'provider_busy', 'provider_error'])
let transientMs = 3_000
/** 시험용 — 잠깐 끊겼을 때 쉬는 시간 */
export function __setTransientMs(ms: number) {
  transientMs = ms
}
/** 다시 부를 때 함께 보내는 말(대표가 더 묻는 것 자리 · 500자 안) */
const FORMAT_HINT: Record<AgentStage, string> = {
  idea: '앞 답을 읽지 못했습니다. items 마다 title = 한글 명칭(… 시스템 및 방법), body = 영문 명칭, outline = 정확히 5줄로 다시 써 주세요. JSON 한 덩어리만.',
  research: '앞 답을 읽지 못했습니다. items 4~7개, 항목마다 tag(검색어 · 비슷한 기술 · 차별화 · 위험 · 확인할 것 중 하나) · title · detail 로 다시 써 주세요. JSON 한 덩어리만.',
  parts:
    '앞 답에서 구성요소를 읽지 못했습니다. items 의 title 에 이름표만 정확히: axis.input · axis.process · axis.state · axis.judge · axis.output · axis.feedback · axis.link · system · comp · step · seed. comp 항목은 4개 이상 — detail = 구성요소 이름("…부"), body = 하는 일("~하는"). step 4개 이상. JSON 한 덩어리만.',
  a: '앞 답을 읽지 못했습니다. items 의 title = 칸 이름표(field · background · problem · effect) 그대로, body = 그 칸 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  b: '앞 답을 읽지 못했습니다. items 의 title = 칸 이름표(solution · abstract) 그대로, body = 그 칸 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  c: '앞 답을 읽지 못했습니다. items 하나 — title = "detail", body = 구체적인 내용 앞부분 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  d: '앞 답을 읽지 못했습니다. items 하나 — title = "detail2", body = 구체적인 내용 뒷부분 전체 글로 다시 써 주세요. JSON 한 덩어리만.',
  e: '앞 답을 읽지 못했습니다. items 하나 — title = "claims", body = 청구항 전체(청구항 n. 머리 · 빈 줄로 나눔)로 다시 써 주세요. JSON 한 덩어리만.',
  fix: '앞 답을 읽지 못했습니다. items 의 title = 고칠 칸 이름표(title · titleEn · field · background · problem · solution · effect · detail · abstract · claims), body = 그 칸 전체를 고친 글로 다시 써 주세요. JSON 한 덩어리만.',
  judge1: '앞 답을 읽지 못했습니다. items 에 {"title":"score","amount":"합계 점수"} 하나, 판결은 {"title":"verdict","tag":"P0 · 감점 · 대표 확인","detail":"문제","body":"고친 방법"}, 고친 것은 spec.parts 이름표(axis.* · system · comp · step · seed)로 다시 써 주세요. JSON 한 덩어리만.',
  judge2: '앞 답을 읽지 못했습니다. items 에 {"title":"score","amount":"합계 점수"} 하나, 판결은 {"title":"verdict","tag":"P0 · 감점 · 대표 확인","detail":"문제","body":"고친 방법"}, 고친 칸은 {"title":"칸 이름표(title · titleEn · field · background · problem · solution · effect · abstract · claims)","body":"고친 전체 글"} 로 다시 써 주세요. JSON 한 덩어리만.',
}

/** D-263 악마판사를 다시 부르는 기준 — 90점 미만이거나 P0 가 남았는데 판사가 고친 칸이 있으면 한 번 더 판정(최대 2번) */
const JUDGE_ROUNDS = 2

const KEY_LABEL: Record<string, string> = { field: '기술분야', background: '배경기술', problem: '해결하려는 과제', solution: '해결 수단', effect: '발명의 효과', detail: '구체적인 내용', abstract: '요약', claims: '청구항' }

/** 단계 하나 — 'ok' | 'fail' | 'stop' */
async function runStage(id: string, stage: AgentStage, env: RunEnv, choice: ReturnType<typeof readChoice>): Promise<'ok' | 'fail' | 'stop'> {
  const d0 = current(id)
  if (!d0) {
    setStage(id, stage, { phase: 'fail', text: '명세서를 찾지 못했습니다 — 다시 열어 주세요' })
    return 'stop'
  }
  const block = stageBlock(stage, d0)
  if (block) {
    setStage(id, stage, { phase: 'skip', text: block })
    return 'fail'
  }
  // 전부 써줘 — 후보가 이미 있으면 다시 부르지 않고 추천 1번으로
  if (stage === 'idea' && !d0.title.trim() && d0.ideas.length) {
    await patch(id, (cur) => (cur.title.trim() ? cur : applyIdea(cur, cur.ideas[0])))
    setStage(id, stage, { phase: 'done', text: '앞서 받은 후보 1번으로 채웠습니다' })
    return 'ok'
  }
  if (stage === 'fix' && !fixable(fixIssues(d0)).length) {
    setStage(id, stage, { phase: 'skip', text: '점검에서 고칠 글이 없습니다' })
    return 'ok'
  }
  if (stage === 'judge1' || stage === 'judge2') return runJudge(id, stage, env, choice)
  const s = stageOf(stage)
  const context =
    stage === 'idea'
      ? buildIdeaContext({ draft: d0, company: env.company, others: env.others, today: env.today })
      : stage === 'research'
        ? buildResearchContext({ draft: d0, today: env.today })
        : stage === 'parts'
          ? buildPartsContext({ draft: d0, today: env.today })
          : stage === 'fix'
            ? buildFixContext({ draft: d0, issues: fixable(fixIssues(d0)), today: env.today })
            : buildSpecContext({ batch: stage as SpecBatch, draft: d0, today: env.today })

  let hint = ''
  let rateWaited = false
  for (let attempt = 0; attempt < TRIES; attempt += 1) {
    if (!attempt) setStage(id, stage, { phase: 'run', text: `쓰는 중…(${s.seconds}초쯤)` })
    try {
      const skill = stage === 'idea' || stage === 'research' ? '' : readJudgeSkill()
      const run = await callAssist({ requestId: newRequestId(), assistId: s.assistId, page: 'patent', choice: choice ? { provider: choice.provider, model: choice.model } : null, context, ...(hint ? { ask: hint } : {}), ...(skill ? { skill } : {}) })
      // 서버가 모양 검사에서 떨어뜨린 답(머리글 빠짐 · 끝 잘림 · 코드 블록)도 원문에서 다시 읽는다
      const ans = answerOf(run)
      switch (stage) {
        case 'idea': {
          const ideas = ideasOf(ans)
          if (!ideas.length) throw new AssistError(PARSE_MISS, 'AI 답에서 아이디어를 찾지 못했습니다 — 다시 눌러 주세요')
          let filled = false
          await patch(id, (cur) => {
            filled = !cur.title.trim()
            const next = { ...cur, ideas }
            return filled ? applyIdea(next, ideas[0]) : next
          })
          setStage(id, stage, { phase: 'done', text: filled ? `${ideas.length}개 — 추천 1번 '${ideas[0].title}' 로 채웠습니다(다른 것으로 바꿀 수 있어요)` : `${ideas.length}개 — 아래에서 고르면 그걸로 바뀝니다` })
          return 'ok'
        }
        case 'research': {
          const res = researchOf({ ...run, structured: ans }, d0.title)
          if (!res) throw new AssistError(PARSE_MISS, 'AI 답에서 조사 메모를 찾지 못했습니다 — 다시 눌러 주세요')
          await patch(id, (cur) => ({ ...cur, research: { ...res, forTitle: cur.title } }))
          setStage(id, stage, { phase: 'done', text: res.grounded ? `메모 ${res.items.length}개 · 검색 근거 ${res.sources.length}곳` : `메모 ${res.items.length}개 · AI 가 아는 범위(검색 근거 없음 — KIPRIS 확인 필요)` })
          return 'ok'
        }
        case 'parts': {
          const p = partsOf(ans, rawObjectOf(run))
          if (p.components.length < 2) throw new AssistError(PARSE_MISS, 'AI 답에서 구성요소를 찾지 못했습니다 — 다시 눌러 주세요')
          let res: ReturnType<typeof applyParts> | null = null
          await patch(id, (cur) => {
            res = applyParts(cur, p, { force: env.forceParts })
            return res.draft
          })
          const r = res as ReturnType<typeof applyParts> | null
          setStage(id, stage, r?.kept ? { phase: 'done', text: '직접 고치신 구성은 그대로 두었습니다 — 바꾸려면 [다시 써줘]' } : { phase: 'done', text: `구성요소 ${p.components.length}개 · 단계 ${p.steps.length}개 · 종속항 씨앗 ${p.seeds.length}개` })
          return 'ok'
        }
        case 'fix': {
          const items = fixItemsOf(ans)
          if (!items.length) throw new AssistError(PARSE_MISS, 'AI 답에서 고친 칸을 찾지 못했습니다 — 다시 눌러 주세요')
          let m: ReturnType<typeof applyFix> | null = null
          await patch(id, (cur) => {
            m = applyFix(cur, items)
            return m.draft
          })
          const r = m as ReturnType<typeof applyFix> | null
          setStage(id, stage, { phase: 'done', text: `${r?.replaced.length ?? 0}칸 고침${r?.kept.length ? ` · 직접 고친 ${r.kept.length}칸은 새 안으로` : ''}` })
          return 'ok'
        }
        default: {
          const key = stage as SpecBatch
          const items = specItemsOf(ans, key)
          if (!items.length) throw new AssistError(PARSE_MISS, 'AI 답에서 칸을 찾지 못했습니다 — 다시 눌러 주세요')
          let m: { replaced: string[]; kept: string[] } = { replaced: [], kept: [] }
          await patch(id, (cur) => {
            if (key === 'c' || key === 'd') {
              const part = cleanAiText(items[0].text)
              const ai = { ...cur.ai, [key === 'c' ? 'detailFront' : 'detailBack']: part }
              const r = mergeSpecAi({ ...cur, ai }, [{ key: 'detail', text: joinDetail(ai.detailFront ?? '', ai.detailBack ?? '') }])
              m = r
              return r.draft
            }
            const r = mergeSpecAi(cur, items.map((i) => ({ key: i.key as SectionKey | 'claims', text: i.text })))
            m = r
            return r.draft
          })
          const got = items.filter((i) => i.note).map((i) => ({ key: i.key === 'detail2' ? 'detail' : i.key, text: i.note! }))
          if (got.length) setRun(id, (r) => ({ ...r, asks: [...r.asks.filter((x) => !got.some((g) => g.key === x.key)), ...got.map((g) => ({ key: KEY_LABEL[g.key] ?? g.key, text: g.text }))] }))
          setStage(id, stage, { phase: 'done', text: `${m.replaced.length ? `${m.replaced.length}칸 씀` : '바꾼 칸 없음'}${m.kept.length ? ` · 직접 고친 ${m.kept.length}칸은 새 안으로` : ''}` })
          return 'ok'
        }
      }
    } catch (e) {
      const code = e instanceof AssistError ? e.code : 'save'
      const left = attempt < TRIES - 1
      if (code === 'rate_limited' && !rateWaited && left) {
        rateWaited = true
        setStage(id, stage, { phase: 'run', text: '잠깐 많이 불러서 1분 쉬었다 다시 씁니다' })
        await sleep(retryMs)
        continue
      }
      if (code === PARSE_MISS && left) {
        hint = FORMAT_HINT[stage]
        setStage(id, stage, { phase: 'run', text: `답 모양이 어긋나 이름표를 다시 알려 주고 씁니다(${attempt + 2}/${TRIES})` })
        continue
      }
      if (TRANSIENT.has(code) && left) {
        setStage(id, stage, { phase: 'run', text: `연결이 잠깐 끊겨 다시 씁니다(${attempt + 2}/${TRIES})` })
        await sleep(transientMs)
        continue
      }
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setStage(id, stage, { phase: 'fail', text: why })
      return STOP_CODES.has(code) ? 'stop' : 'fail'
    }
  }
  return 'fail'
}

/**
 * D-263 악마판사 단계 — 판정 + 판사가 직접 고친 칸을 넣는다. 90점 미만이거나 P0 가 남았고 고친 칸이 있었으면
 * 고친 글로 한 번 더 판정한다(최대 2번) — "점검 요청하면 꼭 한두 개씩 보완하라 하더라" 를 화면 안에서 끝낸다.
 */
async function runJudge(id: string, stage: 'judge1' | 'judge2', env: RunEnv, choice: ReturnType<typeof readChoice>): Promise<'ok' | 'fail' | 'stop'> {
  const scope = stage === 'judge1' ? 'parts' : 'full'
  const label = JUDGE_SCOPE_LABEL[scope]
  const skill = readJudgeSkill()
  const fixedAll: string[] = []
  const keptAll: string[] = []
  let report: JudgeReport | null = null
  for (let round = 1; round <= JUDGE_ROUNDS; round += 1) {
    const d0 = current(id)
    if (!d0) {
      setStage(id, stage, { phase: 'fail', text: '명세서를 찾지 못했습니다 — 다시 열어 주세요' })
      return 'stop'
    }
    const context = buildJudgeContext({ draft: d0, scope, today: env.today })
    let hint = ''
    let got: ReturnType<typeof judgeOf> | null = null
    let rateWaited = false
    for (let attempt = 0; attempt < TRIES && !got; attempt += 1) {
      if (!attempt) setStage(id, stage, { phase: 'run', text: round === 1 ? `악마판사가 ${label}을 판정하는 중…(${stageOf(stage).seconds}초쯤)` : '판사가 고친 글로 한 번 더 판정하는 중…' })
      try {
        const run = await callAssist({ requestId: newRequestId(), assistId: 'spec.judge', page: 'patent', choice: choice ? { provider: choice.provider, model: choice.model } : null, context, ...(hint ? { ask: hint } : {}), ...(skill ? { skill } : {}) })
        const j = judgeOf(answerOf(run))
        if (j.score == null && !j.verdicts.length && !j.rewrites.length) throw new AssistError(PARSE_MISS, 'AI 답에서 판정을 찾지 못했습니다 — 다시 눌러 주세요')
        got = j
      } catch (e) {
        const code = e instanceof AssistError ? e.code : 'save'
        const left = attempt < TRIES - 1
        if (code === 'rate_limited' && !rateWaited && left) {
          rateWaited = true
          setStage(id, stage, { phase: 'run', text: '잠깐 많이 불러서 1분 쉬었다 다시 판정합니다' })
          await sleep(retryMs)
          continue
        }
        if (code === PARSE_MISS && left) {
          hint = FORMAT_HINT[stage]
          setStage(id, stage, { phase: 'run', text: `답 모양이 어긋나 이름표를 다시 알려 주고 판정합니다(${attempt + 2}/${TRIES})` })
          continue
        }
        if (TRANSIENT.has(code) && left) {
          setStage(id, stage, { phase: 'run', text: `연결이 잠깐 끊겨 다시 판정합니다(${attempt + 2}/${TRIES})` })
          await sleep(transientMs)
          continue
        }
        const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
        setStage(id, stage, { phase: 'fail', text: why })
        return STOP_CODES.has(code) ? 'stop' : 'fail'
      }
    }
    if (!got) return 'fail'
    const j = got
    let applied: ReturnType<typeof applyJudge> = { draft: d0, fixed: [], kept: [] }
    await patch(id, (cur) => {
      applied = applyJudge(cur, scope, j.rewrites)
      fixedAll.push(...applied.fixed.filter((x) => !fixedAll.includes(x)))
      keptAll.push(...applied.kept.filter((x) => !keptAll.includes(x)))
      report = { at: new Date().toISOString(), scope: label, score: j.score, scores: j.scores, verdicts: j.verdicts, fixed: [...fixedAll], kept: [...keptAll], rounds: round, custom: !!skill, headline: j.headline }
      const r = report
      return { ...applied.draft, judge: { ...applied.draft.judge, [scope]: r } }
    })
    // 통과했거나 · 판사가 고친 것이 없으면(다시 물어도 같은 판정) 여기서 끝
    if (judgePassed(report) || !applied.fixed.length) break
  }
  const r = report as JudgeReport | null
  const p0 = r?.verdicts.filter((v) => v.level === 'P0').length ?? 0
  const asks = r?.verdicts.filter((v) => v.level === '대표 확인') ?? []
  if (asks.length) setRun(id, (x) => ({ ...x, asks: [...x.asks.filter((a) => a.key !== `악마판사 ${label}`), ...asks.map((a) => ({ key: `악마판사 ${label}`, text: a.fix || a.text }))] }))
  setStage(id, stage, {
    phase: 'done',
    text: `${r?.score != null ? `${r.score}점` : '점수 없음'} · P0 ${p0}${fixedAll.length ? ` · 직접 고친 칸 ${fixedAll.join(' · ')}` : ' · 고칠 것 없음'}${keptAll.length ? ` · 직접 고치신 ${keptAll.join(' · ')}은 그대로` : ''}${(r?.rounds ?? 1) > 1 ? ' · 고친 뒤 다시 판정' : ''}`,
  })
  return 'ok'
}

/** 단계들을 차례로(이미 쓰는 중이면 무시). 단계 하나가 실패해도 다음 단계는 간다 — 설정 · 권한 오류면 멈춘다 */
export function startSpecRun(id: string, stages: AgentStage[], env: RunEnv): boolean {
  if (isSpecRunning(id) || !stages.length) return false
  const choice = readChoice()
  setRun(id, (r) => ({
    running: true,
    asks: stages.some((k) => ['a', 'b', 'c', 'd', 'e'].includes(k)) ? [] : r.asks,
    stages: { ...r.stages, ...Object.fromEntries(stages.map((k) => [k, { phase: 'wait', text: '차례 기다림' } as StageRow])) },
  }))
  void (async () => {
    for (const [i, k] of stages.entries()) {
      const r = await runStage(id, k, env, choice)
      if (r === 'stop') {
        for (const rest of stages.slice(i + 1)) setStage(id, rest, { phase: 'skip', text: '멈춤 — 위 오류부터' })
        break
      }
    }
    setRun(id, (r) => ({ ...r, running: false }))
  })()
  return true
}

/** 시험용 */
export function __resetSpecRun() {
  runs.clear()
  hosts.clear()
  pending.clear()
  shadow.clear()
  retryMs = RATE_RETRY_MS
  emit()
}
