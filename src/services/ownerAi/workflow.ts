/**
 * AI 작업실 흐름 — 생성 → 판단 → 채택 → 기록 → 재사용.
 *
 *  runSkill       업체 기억 · 자료로 최소 묶음을 만들어 서버 함수 호출 → 실행 기록 저장 → 타임라인 한 줄
 *  evaluate       채택 · 일부 채택 · 폐기 → 실행 기록 평가 + 타임라인(채택하면 기억에 넣을 제안을 돌려준다)
 *  saveRevision   고친 글 → 수정 이력 새 번호(예전 글 그대로)
 *  saveContext    기억 새 판(예전 판 그대로)
 *  pasteChatGpt   ChatGPT 결과 붙여넣기 → 실행 기록(붙여넣기)으로 남겨 채택 · 기억에 쓸 수 있게
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { buildAiContext } from './context'
import { callAi, type ServerRun } from './aiClient'
import { emptyCase, newUuid, normalizeBizNo, normalizeUrl, safeMaterialText, withCaseActivity } from './caseUtil'
import { proposeFromRun } from './memory'
import { renderStructured, runSummary } from './render'
import type { OwnerAiRepo } from './repo'
import { SKILL_META, skillName } from './skillCatalog'
import { EVALUATION_LABEL, RELATION_LABEL, type AiRevision, type AiRun, type AiRunInput, type CaseRelation, type CompanyCase, type ContextSnapshot, type CurrentContext, type Evaluation, type SkillId } from './types'

export interface CaseBundle {
  c: CompanyCase
  client: ClientOpsRecord | null
  snapshots: ContextSnapshot[]
  runs: AiRun[]
  /** 실행마다 마지막으로 고친 글 */
  latestRevision: Map<string, AiRevision>
}

/** 업체 작업실 한 번에 읽기 — Case · 이어 둔 고객 · 기억 판 · 실행 · 실행마다 마지막 수정 */
export async function loadBundle(repo: OwnerAiRepo, caseId: string, findClient: (id: string) => Promise<ClientOpsRecord | null>): Promise<CaseBundle | null> {
  const c = await repo.getCase(caseId)
  if (!c) return null
  const [snapshots, runs, client] = await Promise.all([repo.listSnapshots(caseId), repo.listRuns(caseId), c.clientId ? findClient(c.clientId).catch(() => null) : Promise.resolve(null)])
  const revs = await repo.listRevisionsFor(runs.map((r) => r.id))
  const latestRevision = new Map<string, AiRevision>()
  for (const r of revs) {
    const cur = latestRevision.get(r.runId)
    if (!cur || cur.revisionNo < r.revisionNo) latestRevision.set(r.runId, r)
  }
  return { c, client, snapshots, runs, latestRevision }
}

export interface RegisterInput {
  companyName: string
  homepageUrl?: string
  bizNo?: string
  requester?: string
  relation?: CaseRelation
  industry?: string
  memo?: string
  clientId?: string | null
  origin?: string
  workspaceId: string | null
  userId: string | null
}

/** 빠른 등록 — 새 Company Case 한 장(중복 확인은 화면이 먼저 한다) */
export async function registerCase(repo: OwnerAiRepo, input: RegisterInput, at = new Date().toISOString()): Promise<CompanyCase> {
  const base = emptyCase({ companyName: input.companyName, relation: input.relation, workspaceId: input.workspaceId, ownerId: input.userId, at })
  const c: CompanyCase = {
    ...base,
    homepageUrl: normalizeUrl(input.homepageUrl ?? ''),
    bizNo: normalizeBizNo(input.bizNo ?? ''),
    requester: (input.requester ?? '').trim().slice(0, 80),
    industry: (input.industry ?? '').trim().slice(0, 80),
    memo: (input.memo ?? '').trim().slice(0, 4000),
    clientId: input.clientId ?? null,
    origin: input.origin ?? '',
  }
  const where = input.origin?.startsWith('partner:') ? ' — Partner OS 요청' : input.clientId ? ' — 고객 관리 업체와 이어 만듦' : ''
  return repo.saveCase(withCaseActivity(c, `AI 작업실에 등록(${RELATION_LABEL[c.relation]})${input.requester ? ` · 요청 ${input.requester.trim()}` : ''}${where}`, at))
}

/**
 * Case 고치기 — 저장된 최신 판을 읽어 고친 뒤 저장한다(AI 를 기다리는 동안 자료를 더했어도 서로 덮지 않게).
 */
export async function patchCase(repo: OwnerAiRepo, base: CompanyCase, fn: (c: CompanyCase) => CompanyCase): Promise<CompanyCase> {
  const fresh = (await repo.getCase(base.id)) ?? base
  return repo.saveCase(fn(fresh))
}

export const latestSnapshot = (b: Pick<CaseBundle, 'snapshots'>): ContextSnapshot | null => (b.snapshots.length ? b.snapshots[b.snapshots.length - 1] : null)

export function runFromServer(sr: ServerRun, caseId: string, input: AiRunInput, snapshotId: string | null, userId: string | null): AiRun {
  const structured = sr.status === 'succeeded' ? sr.structured : null
  return {
    id: newUuid(),
    caseId,
    skillId: sr.skillId,
    skillVersion: sr.skillVersion,
    input,
    structured,
    rendered: structured ? renderStructured(sr.skillId, structured) : sr.raw,
    contextSnapshotId: snapshotId,
    contextVersion: sr.contextVersion,
    provider: sr.provider,
    model: sr.model,
    tier: sr.tier,
    status: sr.status,
    evaluation: 'draft',
    evaluationNote: '',
    adoptedPart: null,
    evaluatedAt: null,
    usage: sr.usage,
    estimatedCostUsd: sr.estimatedCostUsd,
    requestId: sr.requestId,
    createdBy: userId,
    createdAt: sr.createdAt,
  }
}

export interface RunSkillArgs {
  repo: OwnerAiRepo
  bundle: CaseBundle
  skill: SkillId
  input: AiRunInput
  requestId: string
  today: string
  userId: string | null
  materialIds?: string[]
  usable?: (key: string) => boolean
}

export async function runSkill(a: RunSkillArgs): Promise<{ run: AiRun; c: CompanyCase; replayed: boolean }> {
  const snap = latestSnapshot(a.bundle)
  const context = buildAiContext({
    skill: a.skill,
    c: a.bundle.c,
    client: a.bundle.client,
    memory: snap ? { version: snap.version, content: snap.content } : null,
    runs: a.bundle.runs,
    revisions: a.bundle.latestRevision,
    today: a.today,
    materialIds: a.materialIds,
    usable: a.usable,
  })
  const { run: sr, replayed } = await callAi({ requestId: a.requestId, skillId: a.skill, caseId: a.bundle.c.id, contextVersion: snap?.version ?? 0, input: a.input, context })
  const run = await a.repo.addRun(runFromServer(sr, a.bundle.c.id, a.input, snap?.id ?? null, a.userId))
  const tag = run.status === 'parse_fallback' ? ' · 형식 확인 필요(원문 보관)' : ''
  const c = await patchCase(a.repo, a.bundle.c, (x) => withCaseActivity(x, `${skillName(run.skillId)} v${run.skillVersion} 생성${tag}`, run.createdAt))
  return { run, c, replayed }
}

export interface EvaluateResult {
  run: AiRun
  c: CompanyCase
  /** 채택하면 기억에 넣을 제안(빈 묶음이면 바꿀 칸 없음) */
  proposal: Partial<CurrentContext>
}

const partLabel = (run: AiRun, part: unknown): string => {
  const idx = part && typeof part === 'object' && typeof (part as { index?: unknown }).index === 'number' ? (part as { index: number }).index : -1
  if (idx < 0) return ''
  const s = (run.structured ?? {}) as Record<string, unknown>
  const pickTitle = (list: unknown) => (Array.isArray(list) && list[idx] && typeof list[idx] === 'object' ? String((list[idx] as { title?: unknown }).title ?? '') : '')
  if (run.skillId === 'AX_PENGUIN') {
    const all = [s.recommended, ...(Array.isArray(s.alternatives) ? s.alternatives : [])]
    const it = all[idx] as { title?: unknown } | undefined
    return it?.title ? ` — ${String(it.title)}` : ''
  }
  const t = pickTitle(s.ideas) || pickTitle(s.items)
  return t ? ` — ${t}` : ` — ${idx + 1}번`
}

export async function evaluate(repo: OwnerAiRepo, bundle: CaseBundle, run: AiRun, evaluation: Evaluation, note: string, part: unknown, currentContext: CurrentContext): Promise<EvaluateResult> {
  const next = await repo.setEvaluation(run.id, evaluation, note, part)
  const text = `${skillName(run.skillId)} v${run.skillVersion} ${EVALUATION_LABEL[evaluation]}${partLabel(run, part)}`
  const c = await patchCase(repo, bundle.c, (x) => withCaseActivity(x, text, next.evaluatedAt ?? new Date().toISOString()))
  const adopted = evaluation === 'adopted' || evaluation === 'partially_adopted'
  const proposal = adopted ? proposeFromRun(next, currentContext, bundle.latestRevision.get(run.id)?.content) : {}
  return { run: next, c, proposal }
}

export async function saveRevision(repo: OwnerAiRepo, bundle: CaseBundle, run: AiRun, content: unknown, note: string): Promise<{ rev: AiRevision; c: CompanyCase }> {
  const rev = await repo.addRevision(run.id, content, note)
  const c = await patchCase(repo, bundle.c, (x) => withCaseActivity(x, `${skillName(run.skillId)} 결과 수정(${rev.revisionNo}번째)${note ? ` — ${note}` : ''}`, rev.createdAt))
  return { rev, c }
}

export async function saveContext(repo: OwnerAiRepo, bundle: CaseBundle, content: CurrentContext, source: string, note: string): Promise<{ snap: ContextSnapshot; c: CompanyCase }> {
  const snap = await repo.addSnapshot(bundle.c.id, content, source, note)
  const c = await patchCase(repo, bundle.c, (x) => withCaseActivity({ ...x, contextVersion: Math.max(x.contextVersion, snap.version) }, `업체 기억 v${snap.version} 저장${note ? ` — ${note}` : ''}`, snap.createdAt))
  return { snap, c }
}

/** ChatGPT 결과 붙여넣기 — OS 는 ChatGPT 대화 · 기억을 읽지 못한다. 대표가 가져온 결과만 기록으로 남긴다 */
export async function pasteChatGpt(repo: OwnerAiRepo, bundle: CaseBundle, skill: SkillId, text: string, userId: string | null): Promise<{ run: AiRun; c: CompanyCase }> {
  const at = new Date().toISOString()
  // D-219: 붙여넣은 글도 자료처럼 주민번호 · 비밀번호 · 키를 지우고 남긴다(예전엔 원문 그대로 저장)
  const body = safeMaterialText(text).trim().slice(0, 30000)
  const run: AiRun = {
    id: newUuid(),
    caseId: bundle.c.id,
    skillId: skill,
    skillVersion: SKILL_META[skill].version,
    input: { task: 'ChatGPT 결과 붙여넣기' },
    structured: null,
    rendered: body,
    contextSnapshotId: latestSnapshot(bundle)?.id ?? null,
    contextVersion: latestSnapshot(bundle)?.version ?? null,
    provider: 'manual',
    model: 'ChatGPT(붙여넣기)',
    tier: 'manual',
    status: 'pasted',
    evaluation: 'draft',
    evaluationNote: '',
    adoptedPart: null,
    evaluatedAt: null,
    usage: { input: 0, output: 0, total: 0 },
    estimatedCostUsd: null,
    requestId: newUuid(),
    createdBy: userId,
    createdAt: at,
  }
  const saved = await repo.addRun(run)
  const c = await patchCase(repo, bundle.c, (x) => withCaseActivity(x, `ChatGPT 결과 붙여넣기 — ${skillName(skill)}`, at))
  return { run: saved, c }
}

/** 붙여넣은 글 · 원문만 있는 결과도 기억 제안에 쓸 수 있게 */
export function summaryForMemory(run: AiRun, revised?: unknown): string {
  return runSummary(run, revised)
}
