/**
 * D-252 명세서 AI 진행 — 화면 밖(이 모듈)에 둔다. 작업판을 나갔다 와도 쓰는 중 · 다 씀 · 실패가 그대로 보이고,
 * 나간 사이에 온 답은 다시 열 때 그 초안에 바로 들어간다(같은 접속 동안 · 메모리).
 *
 * 화면(명세서 편집기)이 열려 있으면 그 화면의 apply(받는 대로 저장)로 넣고, 닫혀 있으면 '넣을 것' 줄에 쌓아 두었다가
 * 다시 열 때 차례로 넣는다. 넣는 함수는 늘 '그 순간의 최신 초안' 을 받아 바꾸므로 사이에 고친 글을 덮지 않는다.
 */
import { AssistError, assistMessage, callAssist } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import { cleanAiText, mergeSpecAi, type SectionKey, type SpecDraft } from './specDraft'
import { buildSpecContext, joinDetail, specItemsOf, type SpecBatch } from './specDraftAi'
import {
  applyFix,
  applyIdea,
  applyParts,
  buildFixContext,
  buildIdeaContext,
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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    setStage(id, stage, { phase: 'run', text: attempt ? '다시 쓰는 중…' : `쓰는 중…(${s.seconds}초쯤)` })
    try {
      const run = await callAssist({ requestId: newRequestId(), assistId: s.assistId, page: 'patent', choice: choice ? { provider: choice.provider, model: choice.model } : null, context })
      switch (stage) {
        case 'idea': {
          const ideas = ideasOf(run.structured)
          if (!ideas.length) throw new AssistError('provider_error', 'AI 답에서 아이디어를 찾지 못했습니다 — 다시 눌러 주세요')
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
          const res = researchOf(run, d0.title)
          if (!res) throw new AssistError('provider_error', 'AI 답에서 조사 메모를 찾지 못했습니다 — 다시 눌러 주세요')
          await patch(id, (cur) => ({ ...cur, research: { ...res, forTitle: cur.title } }))
          setStage(id, stage, { phase: 'done', text: res.grounded ? `메모 ${res.items.length}개 · 검색 근거 ${res.sources.length}곳` : `메모 ${res.items.length}개 · AI 가 아는 범위(검색 근거 없음 — KIPRIS 확인 필요)` })
          return 'ok'
        }
        case 'parts': {
          const p = partsOf(run.structured)
          if (p.components.length < 2) throw new AssistError('provider_error', 'AI 답에서 구성요소를 찾지 못했습니다 — 다시 눌러 주세요')
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
          const items = fixItemsOf(run.structured)
          if (!items.length) throw new AssistError('provider_error', 'AI 답에서 고친 칸을 찾지 못했습니다 — 다시 눌러 주세요')
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
          const items = specItemsOf(run.structured, key)
          if (!items.length) throw new AssistError('provider_error', 'AI 답에서 칸을 찾지 못했습니다 — 다시 눌러 주세요')
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
      if (code === 'rate_limited' && attempt === 0) {
        setStage(id, stage, { phase: 'run', text: '잠깐 많이 불러서 1분 쉬었다 다시 씁니다' })
        await sleep(retryMs)
        continue
      }
      const why = e instanceof AssistError ? e.message || assistMessage(e.code) : `저장하지 못했습니다: ${e instanceof Error ? e.message : '연결을 확인하세요'}`
      setStage(id, stage, { phase: 'fail', text: why })
      return STOP_CODES.has(code) ? 'stop' : 'fail'
    }
  }
  return 'fail'
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
