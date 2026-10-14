/**
 * 업체 기억(Current Context) — 채택한 결과를 어느 칸에 어떻게 넣을지(규칙) · 바뀐 칸 비교 · 다음 판 만들기.
 * 기억은 덮어쓰지 않는다 — 저장할 때마다 새 판(snapshot)이 쌓이고 예전 판은 그대로 남는다.
 * 여기 규칙은 AI 가 아니다(대표가 채택한 글을 칸에 옮겨 적을 뿐). 'AI 로 정리' 를 누르면 그때만 CONTEXT_UPDATE 스킬을 부른다.
 */
import { CONTEXT_FIELDS, emptyContext, type AiRun, type ContextKey, type CurrentContext } from './types'
import { runSummary } from './render'

type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

export function normalizeContext(v: unknown): CurrentContext {
  const o = obj(v)
  const out = emptyContext()
  for (const f of CONTEXT_FIELDS) out[f.key] = str(o[f.key]).slice(0, 4000)
  return out
}

const appendLine = (cur: string, add: string) => {
  const a = add.trim()
  if (!a) return cur
  if (cur.split('\n').some((l) => l.trim() === a)) return cur
  return cur.trim() ? `${cur.trim()}\n${a}` : a
}

/**
 * 채택(또는 일부 채택)한 결과 → 기억 칸 제안. 바꾸는 칸만 돌려준다(대표가 확인 · 고친 뒤 새 판으로 저장).
 * revised: 대표가 고친 글(있으면 그것이 우선).
 */
export function proposeFromRun(run: Pick<AiRun, 'skillId' | 'structured' | 'rendered' | 'adoptedPart' | 'evaluation' | 'skillVersion'>, current: CurrentContext, revised?: unknown): Partial<CurrentContext> {
  const s = obj(revised && typeof revised === 'object' ? revised : run.structured)
  const summary = runSummary(run, revised)
  const out: Partial<CurrentContext> = {}
  const unknowns = arr(s.unknowns).map(str).filter(Boolean).slice(0, 5)
  const withUnknowns = () => {
    if (unknowns.length) out.unknowns = unknowns.reduce((acc, u) => appendLine(acc, `- ${u}`), current.unknowns)
  }
  switch (run.skillId) {
    case 'AX_PENGUIN':
    case 'AX_IDEA':
      out.axDirection = summary
      if (run.skillId === 'AX_PENGUIN' && str(s.oneLine) && !current.oneLine) out.oneLine = str(s.oneLine)
      withUnknowns()
      break
    case 'AX_MVP':
      out.mvp = summary
      withUnknowns()
      break
    case 'PATENT_IDEA':
      out.patent = `${summary}\n(내부 아이디어 — 선행기술조사 · 변리사 검토 전)`
      withUnknowns()
      break
    case 'VENTURE_PLAN':
      out.venture = summary
      withUnknowns()
      break
    case 'FUNDING_STRATEGY':
      out.funding = summary
      withUnknowns()
      break
    case 'SANGHO_PROPOSAL':
      out.nextSteps = appendLine(current.nextSteps, `제안서 구성 채택 — ${str(s.purpose) || '제안'}`)
      break
    case 'AX_FRONT':
      out.mvp = appendLine(current.mvp, `화면 기획: ${str(s.appName)}${str(s.oneLine) ? ` — ${str(s.oneLine)}` : ''}`)
      break
    case 'FREE_CHAT':
      out.decided = appendLine(current.decided, summary)
      break
    case 'SNAPSHOT_EXTRACT': {
      const facts = arr(s.facts).map(obj)
      const pick = (key: string) => str(facts.find((f) => str(f.key) === key)?.value)
      const core = pick('coreBusiness')
      const prob = pick('mainProblem')
      if (core && core !== '미확인' && !current.coreBusiness) out.coreBusiness = core
      if (prob && prob !== '미확인') out.problems = appendLine(current.problems, prob)
      break
    }
    case 'CONTEXT_UPDATE': {
      const p = normalizeContext(s.proposed)
      for (const f of CONTEXT_FIELDS) if (p[f.key] && p[f.key] !== current[f.key]) out[f.key] = p[f.key]
      break
    }
    default:
      break
  }
  // 같은 글이면 바꾸지 않는다
  for (const k of Object.keys(out) as ContextKey[]) if ((out[k] ?? '') === current[k]) delete out[k]
  return out
}

export function applyContext(current: CurrentContext, changes: Partial<CurrentContext>): CurrentContext {
  return normalizeContext({ ...current, ...changes })
}

/** 두 판 사이 바뀐 칸(버전 기록에서 보여 줄 것) */
export function contextDiff(a: CurrentContext, b: CurrentContext): { key: ContextKey; label: string; before: string; after: string }[] {
  return CONTEXT_FIELDS.filter((f) => (a[f.key] ?? '') !== (b[f.key] ?? '')).map((f) => ({ key: f.key, label: f.label, before: a[f.key] ?? '', after: b[f.key] ?? '' }))
}

export function contextIsEmpty(c: CurrentContext): boolean {
  return CONTEXT_FIELDS.every((f) => !c[f.key].trim())
}
