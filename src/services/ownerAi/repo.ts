/**
 * 대표 AI 작업실 저장소 — 로컬 모드(이 브라우저)와 클라우드 모드(Supabase 표 0021) 같은 모양.
 *
 *   company_cases · company_context_snapshots · ai_runs · ai_output_revisions
 *   - 기억 · 실행 · 수정 이력은 덧붙이기만(지우기 · 덮어쓰기 없음) — DB 정책도 그렇게 막혀 있다.
 *   - 실행 기록은 평가(채택 · 일부 채택 · 폐기)만 바뀐다.
 * 클라우드 표가 아직 없으면(0021 실행 전) OwnerAiSetupError — 화면은 'AI 작업실 DB 설정이 필요합니다' 를 보인다.
 */
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import { announceStorageFull, isQuotaError, StorageFullError } from '../../storage/storageFull'
import { normalizeContext } from './memory'
import { CASE_RELATIONS, type AiRevision, type AiRun, type CaseRelation, type CompanyCase, type ContextSnapshot, type CurrentContext, type Evaluation } from './types'
import { newId } from './caseUtil'

export class OwnerAiSetupError extends Error {
  constructor() {
    super('AI 작업실 DB 설정이 필요합니다(0021).')
  }
}

export interface OwnerAiRepo {
  mode: 'local' | 'cloud'
  listCases(): Promise<CompanyCase[]>
  getCase(id: string): Promise<CompanyCase | null>
  saveCase(c: CompanyCase): Promise<CompanyCase>
  listSnapshots(caseId: string): Promise<ContextSnapshot[]>
  addSnapshot(caseId: string, content: CurrentContext, source: string, note: string): Promise<ContextSnapshot>
  listRuns(caseId: string): Promise<AiRun[]>
  listRunsSince(iso: string): Promise<AiRun[]>
  addRun(run: AiRun): Promise<AiRun>
  setEvaluation(runId: string, evaluation: Evaluation, note: string, adoptedPart: unknown): Promise<AiRun>
  listRevisions(runId: string): Promise<AiRevision[]>
  /** 여러 실행의 수정 이력 한 번에(업체 화면 열 때) */
  listRevisionsFor(runIds: readonly string[]): Promise<AiRevision[]>
  addRevision(runId: string, content: unknown, note: string): Promise<AiRevision>
}

const nowIso = () => new Date().toISOString()

/* ------------------------------------------------------------------ */
/* 로컬                                                                */
/* ------------------------------------------------------------------ */

const K = {
  cases: 'axmvp.v1.owner_ai.cases',
  snaps: 'axmvp.v1.owner_ai.snapshots',
  runs: 'axmvp.v1.owner_ai.runs',
  revs: 'axmvp.v1.owner_ai.revisions',
}

const mem = new Map<string, string>()

function readList<T>(key: string): T[] {
  try {
    const raw = typeof localStorage === 'undefined' ? mem.get(key) ?? null : localStorage.getItem(key)
    const v = raw ? JSON.parse(raw) : []
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, list: T[]): void {
  const raw = JSON.stringify(list)
  if (typeof localStorage === 'undefined') {
    mem.set(key, raw)
    return
  }
  try {
    localStorage.setItem(key, raw)
  } catch (cause) {
    if (isQuotaError(cause)) {
      announceStorageFull(key)
      throw new StorageFullError()
    }
    throw cause
  }
}

export function normalizeCase(v: Partial<CompanyCase>): CompanyCase {
  const at = v.createdAt ?? nowIso()
  return {
    id: String(v.id ?? ''),
    workspaceId: v.workspaceId ?? null,
    ownerId: v.ownerId ?? null,
    companyName: String(v.companyName ?? '').trim(),
    relation: CASE_RELATIONS.includes(v.relation as CaseRelation) ? (v.relation as CaseRelation) : 'reviewed',
    clientId: v.clientId ?? null,
    bizNo: String(v.bizNo ?? '').replace(/\D/g, '').length === 10 ? String(v.bizNo).replace(/\D/g, '') : '',
    homepageUrl: String(v.homepageUrl ?? ''),
    requester: String(v.requester ?? ''),
    industry: String(v.industry ?? ''),
    memo: String(v.memo ?? ''),
    materials: Array.isArray(v.materials) ? v.materials : [],
    facts: v.facts && typeof v.facts === 'object' ? v.facts : {},
    activity: Array.isArray(v.activity) ? v.activity : [],
    contextVersion: Number(v.contextVersion) || 0,
    origin: String(v.origin ?? ''),
    createdAt: at,
    updatedAt: v.updatedAt ?? at,
    archivedAt: v.archivedAt ?? null,
  }
}

function localRepo(userId: string | null): OwnerAiRepo {
  return {
    mode: 'local',
    async listCases() {
      return readList<CompanyCase>(K.cases).map(normalizeCase).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async getCase(id) {
      const c = readList<CompanyCase>(K.cases).find((x) => x.id === id)
      return c ? normalizeCase(c) : null
    },
    async saveCase(c) {
      const list = readList<CompanyCase>(K.cases)
      const next = normalizeCase({ ...c, updatedAt: nowIso() })
      const i = list.findIndex((x) => x.id === c.id)
      if (i >= 0) list[i] = next
      else list.push(next)
      writeList(K.cases, list)
      return next
    },
    async listSnapshots(caseId) {
      return readList<ContextSnapshot>(K.snaps).filter((s) => s.caseId === caseId).sort((a, b) => a.version - b.version)
    },
    async addSnapshot(caseId, content, source, note) {
      const all = readList<ContextSnapshot>(K.snaps)
      const version = all.filter((s) => s.caseId === caseId).reduce((m, s) => Math.max(m, s.version), 0) + 1
      const snap: ContextSnapshot = { id: newId('snap_'), caseId, version, content: normalizeContext(content), source, note, createdBy: userId, createdAt: nowIso() }
      writeList(K.snaps, [...all, snap])
      const cases = readList<CompanyCase>(K.cases)
      const i = cases.findIndex((x) => x.id === caseId)
      if (i >= 0) {
        cases[i] = { ...cases[i], contextVersion: version, updatedAt: snap.createdAt }
        writeList(K.cases, cases)
      }
      return snap
    },
    async listRuns(caseId) {
      return readList<AiRun>(K.runs).filter((r) => r.caseId === caseId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async listRunsSince(iso) {
      return readList<AiRun>(K.runs).filter((r) => r.createdAt >= iso)
    },
    async addRun(run) {
      const all = readList<AiRun>(K.runs)
      // 같은 요청 번호는 한 줄만(두 번 눌림)
      if (run.requestId) {
        const same = all.find((r) => r.requestId === run.requestId)
        if (same) return same
      }
      writeList(K.runs, [...all, run])
      return run
    },
    async setEvaluation(runId, evaluation, note, adoptedPart) {
      const all = readList<AiRun>(K.runs)
      const i = all.findIndex((r) => r.id === runId)
      if (i < 0) throw new Error('실행 기록을 찾지 못했습니다.')
      all[i] = { ...all[i], evaluation, evaluationNote: note, adoptedPart: adoptedPart ?? null, evaluatedAt: nowIso() }
      writeList(K.runs, all)
      return all[i]
    },
    async listRevisions(runId) {
      return readList<AiRevision>(K.revs).filter((r) => r.runId === runId).sort((a, b) => a.revisionNo - b.revisionNo)
    },
    async listRevisionsFor(runIds) {
      const set = new Set(runIds)
      return readList<AiRevision>(K.revs).filter((r) => set.has(r.runId)).sort((a, b) => a.revisionNo - b.revisionNo)
    },
    async addRevision(runId, content, note) {
      const all = readList<AiRevision>(K.revs)
      const no = all.filter((r) => r.runId === runId).reduce((m, r) => Math.max(m, r.revisionNo), 0) + 1
      const rev: AiRevision = { runId, revisionNo: no, content, note, editedBy: userId, createdAt: nowIso() }
      writeList(K.revs, [...all, rev])
      return rev
    },
  }
}

/* ------------------------------------------------------------------ */
/* 클라우드(Supabase 0021)                                              */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  return code === 'PGRST205' || code === '42P01' || code === 'PGRST202' || /could not find the table|does not exist|schema cache/i.test(error.message ?? '')
}

function check<T>(r: { data: T | null; error: { code?: string; message?: string } | null }): T {
  if (missingTable(r.error)) throw new OwnerAiSetupError()
  if (r.error) throw new Error('AI 작업실 저장에 실패했습니다. 잠시 뒤 다시 시도해 주세요.')
  return r.data as T
}

const PAYLOAD_KEYS = ['requester', 'industry', 'memo', 'materials', 'facts', 'activity', 'origin'] as const

function caseFromRow(r: Row): CompanyCase {
  const p = (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Row
  return normalizeCase({
    id: String(r.id),
    workspaceId: (r.workspace_id as string) ?? null,
    ownerId: (r.owner_id as string) ?? null,
    companyName: String(r.company_name ?? ''),
    relation: r.relation as CaseRelation,
    clientId: (r.client_id as string) ?? null,
    bizNo: String(r.biz_no ?? ''),
    homepageUrl: String(r.homepage_url ?? ''),
    contextVersion: Number(r.context_version) || 0,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    archivedAt: (r.archived_at as string) ?? null,
    ...(Object.fromEntries(PAYLOAD_KEYS.map((k) => [k, p[k]])) as Partial<CompanyCase>),
  })
}

function rowOfCase(c: CompanyCase, workspaceId: string, userId: string): Row {
  return {
    id: c.id,
    workspace_id: workspaceId,
    owner_id: userId,
    company_name: c.companyName,
    relation: c.relation,
    client_id: c.clientId,
    biz_no: c.bizNo,
    homepage_url: c.homepageUrl.slice(0, 500),
    context_version: c.contextVersion,
    archived_at: c.archivedAt,
    payload: Object.fromEntries(PAYLOAD_KEYS.map((k) => [k, c[k]])),
  }
}

function runFromRow(r: Row): AiRun {
  const u = (r.token_usage && typeof r.token_usage === 'object' ? r.token_usage : {}) as Row
  return {
    id: String(r.id),
    caseId: String(r.company_case_id),
    skillId: r.skill_id as AiRun['skillId'],
    skillVersion: Number(r.skill_version) || 0,
    input: (r.input as AiRun['input']) ?? {},
    structured: r.structured_output ?? null,
    rendered: String(r.rendered_output ?? ''),
    contextSnapshotId: (r.context_snapshot_id as string) ?? null,
    contextVersion: r.context_version == null ? null : Number(r.context_version),
    provider: String(r.provider ?? ''),
    model: String(r.model ?? ''),
    tier: (r.tier as AiRun['tier']) ?? 'standard',
    status: r.status as AiRun['status'],
    evaluation: (r.evaluation as Evaluation) ?? 'draft',
    evaluationNote: String(r.evaluation_note ?? ''),
    adoptedPart: r.adopted_part ?? null,
    evaluatedAt: (r.evaluated_at as string) ?? null,
    usage: { input: Number(u.input) || 0, output: Number(u.output) || 0, total: Number(u.total) || (Number(u.input) || 0) + (Number(u.output) || 0) },
    estimatedCostUsd: r.estimated_cost == null ? null : Number(r.estimated_cost),
    requestId: (r.request_id as string) ?? null,
    createdBy: (r.created_by as string) ?? null,
    createdAt: String(r.created_at),
  }
}

function cloudRepo(workspaceId: string, userId: string): OwnerAiRepo {
  const db = () => getSupabaseClient()
  return {
    mode: 'cloud',
    async listCases() {
      const rows = check<Row[]>(await db().from('company_cases').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(500))
      return rows.map(caseFromRow)
    },
    async getCase(id) {
      const rows = check<Row[]>(await db().from('company_cases').select('*').eq('id', id).limit(1))
      return rows[0] ? caseFromRow(rows[0]) : null
    },
    async saveCase(c) {
      const rows = check<Row[]>(await db().from('company_cases').upsert(rowOfCase(c, c.workspaceId ?? workspaceId, userId)).select('*'))
      return caseFromRow(rows[0])
    },
    async listSnapshots(caseId) {
      const rows = check<Row[]>(await db().from('company_context_snapshots').select('*').eq('case_id', caseId).order('version', { ascending: true }))
      return rows.map((r) => ({ id: String(r.id), caseId: String(r.case_id), version: Number(r.version), content: normalizeContext(r.content), source: String(r.source ?? ''), note: String(r.note ?? ''), createdBy: (r.created_by as string) ?? null, createdAt: String(r.created_at) }))
    },
    async addSnapshot(caseId, content, source, note) {
      const last = check<Row[]>(await db().from('company_context_snapshots').select('version').eq('case_id', caseId).order('version', { ascending: false }).limit(1))
      const version = (last[0] ? Number(last[0].version) : 0) + 1
      const rows = check<Row[]>(await db().from('company_context_snapshots').insert({ case_id: caseId, version, content: normalizeContext(content), source: source.slice(0, 120) || 'manual', note: note.slice(0, 500), created_by: userId }).select('*'))
      check(await db().from('company_cases').update({ context_version: version }).eq('id', caseId).select('id'))
      const r = rows[0]
      return { id: String(r.id), caseId, version, content: normalizeContext(r.content), source: String(r.source), note: String(r.note ?? ''), createdBy: userId, createdAt: String(r.created_at) }
    },
    async listRuns(caseId) {
      return check<Row[]>(await db().from('ai_runs').select('*').eq('company_case_id', caseId).order('created_at', { ascending: false }).limit(300)).map(runFromRow)
    },
    async listRunsSince(iso) {
      return check<Row[]>(await db().from('ai_runs').select('*').gte('created_at', iso).order('created_at', { ascending: false }).limit(2000)).map(runFromRow)
    },
    async addRun(run) {
      const row = {
        id: run.id,
        company_case_id: run.caseId,
        skill_id: run.skillId,
        skill_version: run.skillVersion,
        input: run.input,
        structured_output: run.structured ?? null,
        rendered_output: run.rendered,
        context_snapshot_id: run.contextSnapshotId,
        context_version: run.contextVersion,
        provider: run.provider,
        model: run.model,
        tier: run.tier,
        status: run.status,
        evaluation: run.evaluation,
        token_usage: run.usage,
        estimated_cost: run.estimatedCostUsd,
        request_id: run.requestId,
        created_by: userId,
      }
      const r = await db().from('ai_runs').insert(row).select('*')
      // 같은 요청 번호(두 번 눌림)는 이미 있는 줄을 그대로
      if (r.error && (r.error as { code?: string }).code === '23505' && run.requestId) {
        const same = check<Row[]>(await db().from('ai_runs').select('*').eq('request_id', run.requestId).limit(1))
        if (same[0]) return runFromRow(same[0])
      }
      return runFromRow(check<Row[]>(r)[0])
    },
    async setEvaluation(runId, evaluation, note, adoptedPart) {
      const rows = check<Row[]>(await db().from('ai_runs').update({ evaluation, evaluation_note: note.slice(0, 2000), adopted_part: adoptedPart ?? null, evaluated_at: nowIso() }).eq('id', runId).select('*'))
      if (!rows[0]) throw new Error('실행 기록을 찾지 못했습니다.')
      return runFromRow(rows[0])
    },
    async listRevisions(runId) {
      const rows = check<Row[]>(await db().from('ai_output_revisions').select('*').eq('original_run_id', runId).order('revision_no', { ascending: true }))
      return rows.map((r) => ({ runId, revisionNo: Number(r.revision_no), content: r.content, note: String(r.note ?? ''), editedBy: (r.edited_by as string) ?? null, createdAt: String(r.created_at) }))
    },
    async listRevisionsFor(runIds) {
      if (!runIds.length) return []
      const rows = check<Row[]>(await db().from('ai_output_revisions').select('*').in('original_run_id', [...runIds].slice(0, 300)).order('revision_no', { ascending: true }))
      return rows.map((r) => ({ runId: String(r.original_run_id), revisionNo: Number(r.revision_no), content: r.content, note: String(r.note ?? ''), editedBy: (r.edited_by as string) ?? null, createdAt: String(r.created_at) }))
    },
    async addRevision(runId, content, note) {
      const last = check<Row[]>(await db().from('ai_output_revisions').select('revision_no').eq('original_run_id', runId).order('revision_no', { ascending: false }).limit(1))
      const no = (last[0] ? Number(last[0].revision_no) : 0) + 1
      const rows = check<Row[]>(await db().from('ai_output_revisions').insert({ original_run_id: runId, revision_no: no, content, note: note.slice(0, 500), edited_by: userId }).select('*'))
      return { runId, revisionNo: no, content: rows[0].content, note, editedBy: userId, createdAt: String(rows[0].created_at) }
    },
  }
}

export function ownerAiRepo(opts: { workspaceId: string | null; userId: string | null }): OwnerAiRepo {
  if (getDataModeConfig().mode === 'supabase' && opts.workspaceId && opts.userId) return cloudRepo(opts.workspaceId, opts.userId)
  return localRepo(opts.userId)
}
