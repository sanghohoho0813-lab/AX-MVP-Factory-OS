/**
 * 컨설팅 작업실 저장소 — 프로젝트 · 산출물 · 프롬프트 꾸러미 · 결정 · 증빙.
 *
 * local    : localStorage (STORAGE_KEYS.consulting*)
 * supabase : consulting_* 5표 (workspace RLS). 마이그레이션 0012 가 아직 적용되지 않은
 *            환경에서는 ConsultingTablesMissingError 를 던지고, 화면은 "READY" 안내를 보인다.
 *
 * 외부 AI API 호출은 없다. 프롬프트 꾸러미는 사람이 복사해 나가고 결과를 붙여 넣는다.
 */

import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import type {
  ArtifactSource,
  ArtifactStatus,
  ArtifactType,
  ClaimStatus,
  ConsultingArtifact,
  ConsultingDecision,
  ConsultingEvidence,
  ConsultingProject,
  ConsultingPromptPackage,
  CreateConsultingProjectInput,
  DecisionKind,
  EvidenceSlot,
  PrivacyReport,
  PromptPackageType,
  PromptTarget,
  StageKey,
} from '../types/consulting'
import type { ClientOpsRecord } from '../types/clientOps'
import { normalizeProject, projectPayload } from '../domain/consulting/projectModel'
import { seedFactsFromClient } from '../domain/consulting/factsheetSchema'
import { isStageKey } from '../domain/consulting/workflowDefinition'
import { emptyPrivacyReport } from '../domain/consulting/privacyFilter'
import { createJournalEntry } from './journalService'
import { setProjectCache } from '../domain/consulting/projectCache'

/* ------------------------------------------------------------------ */
/* 공통                                                                 */
/* ------------------------------------------------------------------ */

const isLocal = () => getDataModeConfig().mode === 'local'

/** 마이그레이션 0012 미적용 — 화면은 이 오류를 잡아 READY 안내를 보인다 */
export class ConsultingTablesMissingError extends Error {
  constructor() {
    super('컨설팅 작업실 표가 아직 없습니다. supabase/migrations/20260908000012_consulting_studio.sql 을 적용한 뒤 사용할 수 있습니다.')
    this.name = 'ConsultingTablesMissingError'
  }
}

export function isTablesMissing(err: unknown): boolean {
  if (err instanceof ConsultingTablesMissingError) return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const code = (err as { code?: string } | null)?.code ?? ''
  return code === '42P01' || code === 'PGRST205' || /relation .*consulting_.* does not exist|consulting_\w+.*schema cache/i.test(msg)
}

function wrap(err: unknown): never {
  if (isTablesMissing(err)) throw new ConsultingTablesMissingError()
  throw err
}

function needWs(workspaceId: string | null): string {
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  return workspaceId
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/* ------------------------------------------------------------------ */
/* 프로젝트                                                              */
/* ------------------------------------------------------------------ */

function projectsLocal(): ConsultingProject[] {
  return readJson<Partial<ConsultingProject>[]>(STORAGE_KEYS.consultingProjects, [])
    .filter((p): p is Partial<ConsultingProject> & { id: string; clientId: string } => typeof p.id === 'string' && typeof p.clientId === 'string')
    .map((p) => normalizeProject({ createdAt: nowIso(), updatedAt: nowIso(), ...p }))
}

function writeProjectsLocal(list: ConsultingProject[]): void {
  writeJson(STORAGE_KEYS.consultingProjects, list)
  notifyStoreChanged()
}

function projectFromRow(row: Record<string, unknown>): ConsultingProject {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Partial<ConsultingProject>
  return normalizeProject({
    ...payload,
    id: String(row.id),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    clientId: String(row.client_id),
    title: str(row.title),
    status: (row.status as ConsultingProject['status']) ?? 'active',
    currentStage: isStageKey(row.current_stage) ? row.current_stage : 'S0',
    createdAt: str(row.created_at, nowIso()),
    updatedAt: str(row.updated_at, nowIso()),
  })
}

function projectToRow(p: ConsultingProject, workspaceId: string) {
  return {
    id: p.id,
    workspace_id: workspaceId,
    client_id: p.clientId,
    module_key: p.moduleKey,
    title: p.title,
    status: p.status,
    current_stage: p.currentStage,
    payload: projectPayload(p),
  }
}

export async function listProjects(workspaceId: string | null): Promise<ConsultingProject[]> {
  if (isLocal()) {
    const list = projectsLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    setProjectCache(list)
    return list
  }
  const ws = needWs(workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_projects').select('*').eq('workspace_id', ws).order('updated_at', { ascending: false })
  if (error) wrap(error)
  const list = (data ?? []).map((r) => projectFromRow(r as Record<string, unknown>))
  setProjectCache(list)
  return list
}

export async function listProjectsForClient(workspaceId: string | null, clientId: string): Promise<ConsultingProject[]> {
  return (await listProjects(workspaceId)).filter((p) => p.clientId === clientId)
}

export async function getProject(workspaceId: string | null, id: string): Promise<ConsultingProject | null> {
  if (isLocal()) return projectsLocal().find((p) => p.id === id) ?? null
  const ws = needWs(workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_projects').select('*').eq('workspace_id', ws).eq('id', id).maybeSingle()
  if (error) wrap(error)
  return data ? projectFromRow(data as Record<string, unknown>) : null
}

/**
 * 새 프로젝트. 고객 기록을 주면 회사 기본 8항목을 사실표에 '미확인 · 출처: 고객 운영 기록' 으로 채운다.
 */
export async function createProject(
  workspaceId: string | null,
  input: CreateConsultingProjectInput,
  client?: ClientOpsRecord | null,
): Promise<ConsultingProject> {
  const now = nowIso()
  let project = normalizeProject({
    id: generateId(),
    workspaceId,
    clientId: input.clientId,
    clientName: input.clientName,
    title: (input.title ?? '').trim() || '특허 · 벤처 · MVP',
    createdAt: now,
    updatedAt: now,
  })
  if (client) project = { ...project, factsheet: seedFactsFromClient(project.factsheet, client, now) }
  project.stages.S0 = { ...project.stages.S0, status: 'in_progress', startedAt: now, updatedAt: now }

  if (isLocal()) {
    writeProjectsLocal([project, ...projectsLocal()])
    return project
  }
  const ws = needWs(workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_projects').insert(projectToRow(project, ws)).select().single()
  if (error) wrap(error)
  return projectFromRow(data as Record<string, unknown>)
}

export async function saveProject(project: ConsultingProject): Promise<ConsultingProject> {
  const next = normalizeProject({ ...project, updatedAt: nowIso() })
  if (isLocal()) {
    writeProjectsLocal(projectsLocal().map((p) => (p.id === next.id ? next : p)))
    return next
  }
  const ws = needWs(next.workspaceId)
  const row = projectToRow(next, ws)
  const { data, error } = await getSupabaseClient().from('consulting_projects').update(row).eq('id', next.id).eq('workspace_id', ws).select().single()
  if (error) wrap(error)
  return projectFromRow(data as Record<string, unknown>)
}

/** 프로젝트 삭제 — 산출물·프롬프트·결정·증빙도 함께 지운다 (supabase 는 cascade) */
export async function deleteProject(project: ConsultingProject): Promise<void> {
  if (isLocal()) {
    writeProjectsLocal(projectsLocal().filter((p) => p.id !== project.id))
    writeJson(STORAGE_KEYS.consultingArtifacts, artifactsLocal().filter((a) => a.projectId !== project.id))
    writeJson(STORAGE_KEYS.consultingPromptPackages, promptsLocal().filter((a) => a.projectId !== project.id))
    writeJson(STORAGE_KEYS.consultingDecisions, decisionsLocal().filter((a) => a.projectId !== project.id))
    writeJson(STORAGE_KEYS.consultingEvidence, evidenceLocal().filter((a) => a.projectId !== project.id))
    notifyStoreChanged()
    return
  }
  const ws = needWs(project.workspaceId)
  const { error } = await getSupabaseClient().from('consulting_projects').delete().eq('id', project.id).eq('workspace_id', ws)
  if (error) wrap(error)
}

/* ------------------------------------------------------------------ */
/* 산출물                                                                */
/* ------------------------------------------------------------------ */

function normalizeArtifact(v: Partial<ConsultingArtifact> & { projectId: string }): ConsultingArtifact {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    projectId: v.projectId,
    type: (v.type as ArtifactType) ?? 'NOTE',
    title: str(v.title),
    stageKey: isStageKey(v.stageKey) ? v.stageKey : 'S0',
    version: typeof v.version === 'number' && v.version >= 1 ? v.version : 1,
    status: (v.status as ArtifactStatus) ?? 'draft',
    content: str(v.content),
    source: (v.source as ArtifactSource) ?? 'manual',
    promptPackageId: v.promptPackageId ?? null,
    fileName: str(v.fileName),
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
  }
}

function artifactsLocal(): ConsultingArtifact[] {
  return readJson<Partial<ConsultingArtifact>[]>(STORAGE_KEYS.consultingArtifacts, [])
    .filter((a): a is Partial<ConsultingArtifact> & { projectId: string } => typeof a.projectId === 'string')
    .map(normalizeArtifact)
}

function artifactFromRow(r: Record<string, unknown>): ConsultingArtifact {
  return normalizeArtifact({
    id: String(r.id), workspaceId: r.workspace_id ? String(r.workspace_id) : null, projectId: String(r.project_id),
    type: r.type as ArtifactType, title: str(r.title), stageKey: r.stage_key as StageKey, version: Number(r.version ?? 1),
    status: r.status as ArtifactStatus, content: str(r.content), source: r.source as ArtifactSource,
    promptPackageId: (r.prompt_package_id as string) ?? null, fileName: str(r.file_name),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  })
}

export async function listArtifacts(workspaceId: string | null, projectId?: string): Promise<ConsultingArtifact[]> {
  if (isLocal()) {
    return artifactsLocal().filter((a) => !projectId || a.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
  const ws = needWs(workspaceId)
  let q = getSupabaseClient().from('consulting_artifacts').select('*').eq('workspace_id', ws).order('updated_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) wrap(error)
  return (data ?? []).map((r) => artifactFromRow(r as Record<string, unknown>))
}

export interface CreateArtifactInput {
  projectId: string
  type: ArtifactType
  title: string
  stageKey: StageKey
  content: string
  source: ArtifactSource
  promptPackageId?: string | null
  fileName?: string
  /** true 면 같은 type 의 이전 버전을 superseded 로 표시 */
  supersedePrevious?: boolean
}

/** 같은 type 의 다음 버전 번호 */
export function nextVersion(existing: ConsultingArtifact[], projectId: string, type: ArtifactType): number {
  const vs = existing.filter((a) => a.projectId === projectId && a.type === type).map((a) => a.version)
  return vs.length === 0 ? 1 : Math.max(...vs) + 1
}

export async function createArtifact(workspaceId: string | null, input: CreateArtifactInput): Promise<ConsultingArtifact> {
  const existing = await listArtifacts(workspaceId, input.projectId)
  const version = nextVersion(existing, input.projectId, input.type)
  const art = normalizeArtifact({
    workspaceId,
    projectId: input.projectId,
    type: input.type,
    title: input.title.trim() || `${input.type} v${version}`,
    stageKey: input.stageKey,
    version,
    status: 'draft',
    content: input.content,
    source: input.source,
    promptPackageId: input.promptPackageId ?? null,
    fileName: input.fileName ?? '',
  })
  const toSupersede = input.supersedePrevious ? existing.filter((a) => a.type === input.type && a.status !== 'superseded') : []

  if (isLocal()) {
    const list = artifactsLocal().map((a) => (toSupersede.some((s) => s.id === a.id) ? { ...a, status: 'superseded' as const, updatedAt: nowIso() } : a))
    writeJson(STORAGE_KEYS.consultingArtifacts, [art, ...list])
    notifyStoreChanged()
    return art
  }
  const ws = needWs(workspaceId)
  const client = getSupabaseClient()
  if (toSupersede.length > 0) {
    const { error } = await client.from('consulting_artifacts').update({ status: 'superseded' }).in('id', toSupersede.map((a) => a.id)).eq('workspace_id', ws)
    if (error) wrap(error)
  }
  const { data, error } = await client.from('consulting_artifacts').insert({
    id: art.id, workspace_id: ws, project_id: art.projectId, type: art.type, title: art.title, stage_key: art.stageKey,
    version: art.version, status: art.status, content: art.content, source: art.source, prompt_package_id: art.promptPackageId, file_name: art.fileName,
  }).select().single()
  if (error) wrap(error)
  return artifactFromRow(data as Record<string, unknown>)
}

export async function updateArtifact(art: ConsultingArtifact, patch: Partial<Pick<ConsultingArtifact, 'title' | 'status' | 'content'>>): Promise<ConsultingArtifact> {
  const next = normalizeArtifact({ ...art, ...patch, updatedAt: nowIso() })
  if (isLocal()) {
    writeJson(STORAGE_KEYS.consultingArtifacts, artifactsLocal().map((a) => (a.id === art.id ? next : a)))
    notifyStoreChanged()
    return next
  }
  const ws = needWs(art.workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_artifacts').update({ title: next.title, status: next.status, content: next.content }).eq('id', art.id).eq('workspace_id', ws).select().single()
  if (error) wrap(error)
  return artifactFromRow(data as Record<string, unknown>)
}

export async function deleteArtifact(art: ConsultingArtifact): Promise<void> {
  if (isLocal()) {
    writeJson(STORAGE_KEYS.consultingArtifacts, artifactsLocal().filter((a) => a.id !== art.id))
    notifyStoreChanged()
    return
  }
  const ws = needWs(art.workspaceId)
  const { error } = await getSupabaseClient().from('consulting_artifacts').delete().eq('id', art.id).eq('workspace_id', ws)
  if (error) wrap(error)
}

/* ------------------------------------------------------------------ */
/* 프롬프트 꾸러미                                                       */
/* ------------------------------------------------------------------ */

function normalizePrompt(v: Partial<ConsultingPromptPackage> & { projectId: string }): ConsultingPromptPackage {
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    projectId: v.projectId,
    type: (v.type as PromptPackageType) ?? 'GENERAL_PROJECT_REVIEW',
    target: (v.target as PromptTarget) ?? 'general',
    stageKey: isStageKey(v.stageKey) ? v.stageKey : 'S0',
    title: str(v.title),
    prompt: str(v.prompt),
    context: str(v.context),
    privacy: { ...emptyPrivacyReport(), ...(v.privacy ?? {}) },
    section: typeof v.section === 'number' ? v.section : null,
    createdAt: v.createdAt ?? nowIso(),
  }
}

function promptsLocal(): ConsultingPromptPackage[] {
  return readJson<Partial<ConsultingPromptPackage>[]>(STORAGE_KEYS.consultingPromptPackages, [])
    .filter((a): a is Partial<ConsultingPromptPackage> & { projectId: string } => typeof a.projectId === 'string')
    .map(normalizePrompt)
}

function promptFromRow(r: Record<string, unknown>): ConsultingPromptPackage {
  return normalizePrompt({
    id: String(r.id), workspaceId: r.workspace_id ? String(r.workspace_id) : null, projectId: String(r.project_id),
    type: r.type as PromptPackageType, target: r.target as PromptTarget, stageKey: r.stage_key as StageKey, title: str(r.title),
    prompt: str(r.prompt), context: str(r.context), privacy: (r.privacy as PrivacyReport) ?? emptyPrivacyReport(),
    section: typeof r.section === 'number' ? r.section : null, createdAt: str(r.created_at),
  })
}

export async function listPromptPackages(workspaceId: string | null, projectId?: string): Promise<ConsultingPromptPackage[]> {
  if (isLocal()) return promptsLocal().filter((a) => !projectId || a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const ws = needWs(workspaceId)
  let q = getSupabaseClient().from('consulting_prompt_packages').select('*').eq('workspace_id', ws).order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) wrap(error)
  return (data ?? []).map((r) => promptFromRow(r as Record<string, unknown>))
}

export async function savePromptPackage(
  workspaceId: string | null,
  input: Omit<ConsultingPromptPackage, 'id' | 'workspaceId' | 'createdAt'>,
): Promise<ConsultingPromptPackage> {
  const pkg = normalizePrompt({ ...input, workspaceId })
  if (isLocal()) {
    writeJson(STORAGE_KEYS.consultingPromptPackages, [pkg, ...promptsLocal()])
    notifyStoreChanged()
    return pkg
  }
  const ws = needWs(workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_prompt_packages').insert({
    id: pkg.id, workspace_id: ws, project_id: pkg.projectId, type: pkg.type, target: pkg.target, stage_key: pkg.stageKey,
    title: pkg.title, prompt: pkg.prompt, context: pkg.context, privacy: pkg.privacy, section: pkg.section,
  }).select().single()
  if (error) wrap(error)
  return promptFromRow(data as Record<string, unknown>)
}

/* ------------------------------------------------------------------ */
/* 결정                                                                  */
/* ------------------------------------------------------------------ */

function normalizeDecision(v: Partial<ConsultingDecision> & { projectId: string }): ConsultingDecision {
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    projectId: v.projectId,
    stageKey: isStageKey(v.stageKey) ? v.stageKey : 'S0',
    kind: (v.kind as DecisionKind) ?? 'other',
    summary: str(v.summary),
    reason: str(v.reason),
    createdAt: v.createdAt ?? nowIso(),
  }
}

function decisionsLocal(): ConsultingDecision[] {
  return readJson<Partial<ConsultingDecision>[]>(STORAGE_KEYS.consultingDecisions, [])
    .filter((a): a is Partial<ConsultingDecision> & { projectId: string } => typeof a.projectId === 'string')
    .map(normalizeDecision)
}

function decisionFromRow(r: Record<string, unknown>): ConsultingDecision {
  return normalizeDecision({
    id: String(r.id), workspaceId: r.workspace_id ? String(r.workspace_id) : null, projectId: String(r.project_id),
    stageKey: r.stage_key as StageKey, kind: r.kind as DecisionKind, summary: str(r.summary), reason: str(r.reason), createdAt: str(r.created_at),
  })
}

export async function listDecisions(workspaceId: string | null, projectId?: string): Promise<ConsultingDecision[]> {
  if (isLocal()) return decisionsLocal().filter((a) => !projectId || a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const ws = needWs(workspaceId)
  let q = getSupabaseClient().from('consulting_decisions').select('*').eq('workspace_id', ws).order('created_at', { ascending: false })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) wrap(error)
  return (data ?? []).map((r) => decisionFromRow(r as Record<string, unknown>))
}

/**
 * 결정 기록. 업무 일기에도 '결정' 항목으로 남긴다(고객 id 연결) — 오늘·일기 화면에서 함께 보이게.
 * 일기 쓰기가 실패해도 결정 자체는 저장된다.
 */
export async function recordDecision(
  scope: { workspaceId: string | null; userId: string | null },
  project: ConsultingProject,
  input: { stageKey: StageKey; kind: DecisionKind; summary: string; reason?: string },
): Promise<ConsultingDecision> {
  const summary = input.summary.trim()
  if (!summary) throw new Error('결정 내용을 적어 주세요.')
  const d = normalizeDecision({ workspaceId: scope.workspaceId, projectId: project.id, stageKey: input.stageKey, kind: input.kind, summary, reason: input.reason ?? '' })

  if (isLocal()) {
    writeJson(STORAGE_KEYS.consultingDecisions, [d, ...decisionsLocal()])
    notifyStoreChanged()
  } else {
    const ws = needWs(scope.workspaceId)
    const { error } = await getSupabaseClient().from('consulting_decisions').insert({
      id: d.id, workspace_id: ws, project_id: d.projectId, stage_key: d.stageKey, kind: d.kind, summary: d.summary, reason: d.reason,
    })
    if (error) wrap(error)
  }

  try {
    await createJournalEntry(scope.workspaceId, scope.userId, {
      content: `[${project.clientName} · ${input.stageKey}] ${summary}${d.reason ? ` — ${d.reason}` : ''}`,
      entryType: 'decision',
      entryDate: todayLocalDate(),
      clientId: project.clientId,
    })
  } catch {
    // 일기는 부가 기록이다 — 실패해도 결정은 이미 저장됐다
  }
  return d
}

/* ------------------------------------------------------------------ */
/* 증빙                                                                  */
/* ------------------------------------------------------------------ */

function normalizeEvidence(v: Partial<ConsultingEvidence> & { projectId: string }): ConsultingEvidence {
  const now = nowIso()
  const slot = typeof v.slot === 'number' && v.slot >= 1 && v.slot <= 10 ? (v.slot as EvidenceSlot) : 1
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    projectId: v.projectId,
    slot,
    claim: str(v.claim),
    claimStatus: (v.claimStatus as ClaimStatus) ?? 'live',
    title: str(v.title),
    source: str(v.source),
    linksPatent: v.linksPatent === true,
    linksMvp: v.linksMvp === true,
    ready: v.ready === true,
    note: str(v.note),
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
  }
}

function evidenceLocal(): ConsultingEvidence[] {
  return readJson<Partial<ConsultingEvidence>[]>(STORAGE_KEYS.consultingEvidence, [])
    .filter((a): a is Partial<ConsultingEvidence> & { projectId: string } => typeof a.projectId === 'string')
    .map(normalizeEvidence)
}

function evidenceFromRow(r: Record<string, unknown>): ConsultingEvidence {
  return normalizeEvidence({
    id: String(r.id), workspaceId: r.workspace_id ? String(r.workspace_id) : null, projectId: String(r.project_id),
    slot: Number(r.slot) as EvidenceSlot, claim: str(r.claim), claimStatus: r.claim_status as ClaimStatus, title: str(r.title), source: str(r.source),
    linksPatent: r.links_patent === true, linksMvp: r.links_mvp === true, ready: r.ready === true, note: str(r.note),
    createdAt: str(r.created_at), updatedAt: str(r.updated_at),
  })
}

function evidenceToRow(e: ConsultingEvidence, ws: string) {
  return {
    id: e.id, workspace_id: ws, project_id: e.projectId, slot: e.slot, claim: e.claim, claim_status: e.claimStatus, title: e.title,
    source: e.source, links_patent: e.linksPatent, links_mvp: e.linksMvp, ready: e.ready, note: e.note,
  }
}

export async function listEvidence(workspaceId: string | null, projectId?: string): Promise<ConsultingEvidence[]> {
  if (isLocal()) return evidenceLocal().filter((a) => !projectId || a.projectId === projectId).sort((a, b) => a.slot - b.slot || a.createdAt.localeCompare(b.createdAt))
  const ws = needWs(workspaceId)
  let q = getSupabaseClient().from('consulting_evidence').select('*').eq('workspace_id', ws).order('slot', { ascending: true })
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) wrap(error)
  return (data ?? []).map((r) => evidenceFromRow(r as Record<string, unknown>))
}

export async function upsertEvidence(workspaceId: string | null, item: Partial<ConsultingEvidence> & { projectId: string }): Promise<ConsultingEvidence> {
  const next = normalizeEvidence({ ...item, workspaceId, updatedAt: nowIso() })
  if (isLocal()) {
    const list = evidenceLocal()
    const exists = list.some((e) => e.id === next.id)
    writeJson(STORAGE_KEYS.consultingEvidence, exists ? list.map((e) => (e.id === next.id ? next : e)) : [...list, next])
    notifyStoreChanged()
    return next
  }
  const ws = needWs(workspaceId)
  const { data, error } = await getSupabaseClient().from('consulting_evidence').upsert(evidenceToRow(next, ws)).select().single()
  if (error) wrap(error)
  return evidenceFromRow(data as Record<string, unknown>)
}

export async function deleteEvidence(item: ConsultingEvidence): Promise<void> {
  if (isLocal()) {
    writeJson(STORAGE_KEYS.consultingEvidence, evidenceLocal().filter((e) => e.id !== item.id))
    notifyStoreChanged()
    return
  }
  const ws = needWs(item.workspaceId)
  const { error } = await getSupabaseClient().from('consulting_evidence').delete().eq('id', item.id).eq('workspace_id', ws)
  if (error) wrap(error)
}

/* ------------------------------------------------------------------ */
/* 한 번에 읽기 — 상세 화면용                                              */
/* ------------------------------------------------------------------ */

export interface ProjectBundle {
  project: ConsultingProject
  artifacts: ConsultingArtifact[]
  prompts: ConsultingPromptPackage[]
  decisions: ConsultingDecision[]
  evidence: ConsultingEvidence[]
}

export async function loadProjectBundle(workspaceId: string | null, id: string): Promise<ProjectBundle | null> {
  const project = await getProject(workspaceId, id)
  if (!project) return null
  const [artifacts, prompts, decisions, evidence] = await Promise.all([
    listArtifacts(workspaceId, id),
    listPromptPackages(workspaceId, id),
    listDecisions(workspaceId, id),
    listEvidence(workspaceId, id),
  ])
  return { project, artifacts, prompts, decisions, evidence }
}
