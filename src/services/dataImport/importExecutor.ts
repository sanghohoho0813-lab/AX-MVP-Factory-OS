/**
 * 가져오기 실행기 — 가져오기 계획을 Supabase 에 멱등적으로 적용한다.
 *
 * 원칙:
 *   - 실제 네트워크 저장은 비동기로 처리한다(동기 성공 위장 금지).
 *   - data_import_items 로 항목별 완료 상태를 남겨 재실행/이어받기가 안전하다.
 *   - 이미 완료된 항목은 건너뛴다(멱등).
 *   - 원본 localStorage 는 절대 삭제하지 않는다(이 모듈은 읽지도 않는다).
 *   - 실패는 성공처럼 표시하지 않는다. 오류는 job/summary 에 그대로 기록한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { IMPORT_ORDER } from './localSnapshot'
import type { ImportPlan } from './importPlan'

export interface ImportProgress {
  domain: string
  done: number
  total: number
}

export interface ImportRunResult {
  jobId: string
  status: 'completed' | 'partial' | 'failed'
  imported: number
  skipped: number
  failed: number
  errors: { domain: string; message: string }[]
}

export interface ImportRunOptions {
  workspaceId: string
  actorId: string
  onProgress?: (progress: ImportProgress) => void
  /** 배치 크기(기본 200) */
  batchSize?: number
}

/** 가져오기 작업(job)을 생성한다. */
async function createJob(
  client: SupabaseClient,
  workspaceId: string,
  actorId: string,
  sourceSchemaVersion: number,
): Promise<string> {
  const { data, error } = await client
    .from('data_import_jobs')
    .insert({
      workspace_id: workspaceId,
      actor_id: actorId,
      status: 'running',
      source_schema_version: sourceSchemaVersion,
    })
    .select('id')
    .single()
  if (error) throw new Error('가져오기 작업을 생성하지 못했습니다.')
  return (data as { id: string }).id
}

/** 이 작업에서 이미 완료된 (domain, source_id) 집합을 가져온다(이어받기). */
async function loadCompleted(client: SupabaseClient, jobId: string): Promise<Set<string>> {
  const { data, error } = await client
    .from('data_import_items')
    .select('domain, source_id')
    .eq('job_id', jobId)
    .eq('status', 'completed')
  if (error) return new Set()
  const set = new Set<string>()
  for (const row of data ?? []) {
    const r = row as { domain: string; source_id: string }
    set.add(`${r.domain}:${r.source_id}`)
  }
  return set
}

/**
 * 계획을 실행한다. resumeJobId 를 주면 그 작업을 이어서 진행한다.
 */
export async function runImportPlan(
  client: SupabaseClient,
  plan: ImportPlan,
  sourceSchemaVersion: number,
  options: ImportRunOptions,
  resumeJobId?: string,
): Promise<ImportRunResult> {
  const batchSize = options.batchSize ?? 200
  const jobId = resumeJobId ?? (await createJob(client, options.workspaceId, options.actorId, sourceSchemaVersion))
  const completed = resumeJobId ? await loadCompleted(client, jobId) : new Set<string>()

  let imported = 0
  let skipped = 0
  let failed = 0
  const errors: { domain: string; message: string }[] = []

  const domainOrder = new Map(IMPORT_ORDER.map((d, i) => [d, i]))
  const ordered = [...plan.domains].sort(
    (a, b) => (domainOrder.get(a.domain) ?? 0) - (domainOrder.get(b.domain) ?? 0),
  )

  for (const domainPlan of ordered) {
    const pending = domainPlan.rows.filter((row) => !completed.has(`${domainPlan.domain}:${row.id}`))
    skipped += domainPlan.rows.length - pending.length
    let done = domainPlan.rows.length - pending.length

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize)
      const { error } = await client.from(domainPlan.domain).upsert(batch)
      if (error) {
        failed += batch.length
        errors.push({ domain: domainPlan.domain, message: error.message })
        await recordItems(client, jobId, options.workspaceId, domainPlan.domain, batch, 'failed', error.message)
        continue
      }
      imported += batch.length
      done += batch.length
      await recordItems(client, jobId, options.workspaceId, domainPlan.domain, batch, 'completed')
      options.onProgress?.({ domain: domainPlan.domain, done, total: domainPlan.rows.length })
    }
  }

  const status: ImportRunResult['status'] = failed === 0 ? 'completed' : imported > 0 ? 'partial' : 'failed'
  await client
    .from('data_import_jobs')
    .update({ status, summary: { imported, skipped, failed, errors } })
    .eq('id', jobId)

  return { jobId, status, imported, skipped, failed, errors }
}

async function recordItems(
  client: SupabaseClient,
  jobId: string,
  workspaceId: string,
  domain: string,
  batch: { id: string }[],
  status: 'completed' | 'failed',
  error?: string,
): Promise<void> {
  const items = batch.map((row) => ({
    job_id: jobId,
    workspace_id: workspaceId,
    domain,
    source_id: row.id,
    target_id: row.id,
    status,
    error: error ?? null,
  }))
  await client.from('data_import_items').upsert(items, { onConflict: 'job_id,domain,source_id' })
}
