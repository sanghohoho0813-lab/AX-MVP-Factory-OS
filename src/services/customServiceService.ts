/**
 * 컨설팅 항목(업무) 직접 추가.
 *
 * 기본 6종(법인설립·업종추가·특허·벤처인증·AX·정책자금)은 코드에 있고, 업체마다
 * 달라지는 나머지는 대표가 직접 만든다. 만든 항목은 워크스페이스 전체에 적용된다 —
 * 현황표가 업체별로 열이 달라지면 한눈에 비교할 수 없기 때문이다. 특정 업체에
 * 해당하지 않는 항목은 그 업체에서 상태를 '보류' 로 두면 경고에서 빠진다.
 *
 * 저장 위치
 *   local    : localStorage
 *   supabase : public.ops_custom_services (워크스페이스 단위, RLS 로 격리)
 */

import type { ServiceAccent, ServiceMeta } from '../content/clientOpsCatalog'
import { SERVICES } from '../content/clientOpsCatalog'
import type { ServiceKey } from '../types/clientOps'
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { STORAGE_KEYS, notifyStoreChanged, readJson, writeJson } from '../storage/localStore'
import { nowIso } from '../lib/appClock'

export interface CustomService {
  id: string
  workspaceId: string | null
  key: ServiceKey
  label: string
  shortLabel: string
  description: string
  accent: ServiceAccent
  order: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CustomServiceInput {
  label: string
  shortLabel?: string
  description?: string
  accent?: ServiceAccent
}

const isLocal = () => getDataModeConfig().mode === 'local'

/** 기본 6종 뒤에 붙도록 넉넉히 띄운 시작값 */
const CUSTOM_ORDER_BASE = 100

/* ------------------------------------------------------------------ */
/* 키 만들기                                                            */
/* ------------------------------------------------------------------ */

/**
 * 라벨에서 안정적인 키를 만든다. 한글은 그대로 두면 키가 길고 다루기 번거로워
 * 임의 접미사를 붙인다. 키는 한 번 정해지면 바꾸지 않는다 — 업체 데이터가 이 키로
 * 상태를 들고 있기 때문이다.
 */
export function makeCustomServiceKey(): ServiceKey {
  const rand = Math.random().toString(36).slice(2, 8)
  return `custom_${Date.now().toString(36)}${rand}`
}

/** 화면에 쓸 짧은 이름 — 비워 두면 라벨 앞부분을 쓴다 */
function shortOf(label: string, shortLabel?: string): string {
  const s = (shortLabel ?? '').trim()
  if (s) return s
  const t = label.trim()
  return t.length <= 5 ? t : t.slice(0, 5)
}

/* ------------------------------------------------------------------ */
/* 정규화 · 병합                                                        */
/* ------------------------------------------------------------------ */

export function normalizeCustomService(v: Partial<CustomService>): CustomService {
  const label = (v.label ?? '').trim()
  return {
    id: v.id ?? makeCustomServiceKey(),
    workspaceId: v.workspaceId ?? null,
    key: v.key ?? makeCustomServiceKey(),
    label,
    shortLabel: shortOf(label, v.shortLabel),
    description: v.description ?? '',
    accent: v.accent ?? 'neutral',
    order: typeof v.order === 'number' ? v.order : CUSTOM_ORDER_BASE,
    archived: v.archived ?? false,
    createdAt: v.createdAt ?? nowIso(),
    updatedAt: v.updatedAt ?? nowIso(),
  }
}

/** 커스텀 항목을 화면이 쓰는 ServiceMeta 모양으로 바꾼다 */
export function toServiceMeta(c: CustomService): ServiceMeta {
  return {
    key: c.key,
    label: c.label,
    shortLabel: c.shortLabel,
    description: c.description,
    requiredDocuments: [],   // 직접 만든 항목에는 필수 서류를 강제하지 않는다
    recurring: false,
    order: c.order,
    accent: c.accent,
  }
}

/**
 * 기본 6종 + 직접 만든 항목을 합쳐 화면이 쓸 목록을 만든다.
 * 보관(archived)한 항목은 빠지되, 이미 그 항목에 값이 있는 업체에서는 여전히 보여야
 * 하므로 화면 쪽에서 필요하면 keepKeys 로 되살린다.
 */
export function mergeServices(custom: CustomService[], keepKeys: ServiceKey[] = []): ServiceMeta[] {
  const keep = new Set(keepKeys)
  const extra = custom
    .filter((c) => !c.archived || keep.has(c.key))
    .map(toServiceMeta)
  return [...SERVICES, ...extra].sort((a, b) => a.order - b.order)
}

/* ------------------------------------------------------------------ */
/* 읽기 · 쓰기                                                          */
/* ------------------------------------------------------------------ */

function localAll(): CustomService[] {
  return readJson<Partial<CustomService>[]>(STORAGE_KEYS.customServices, []).map(normalizeCustomService)
}

function localWrite(list: CustomService[]): void {
  writeJson(STORAGE_KEYS.customServices, list)
  notifyStoreChanged()
}

function fromRow(row: Record<string, unknown>): CustomService {
  return normalizeCustomService({
    id: String(row.id),
    workspaceId: (row.workspace_id as string) ?? null,
    key: String(row.key),
    label: String(row.label ?? ''),
    shortLabel: String(row.short_label ?? ''),
    description: String(row.description ?? ''),
    accent: (row.accent as ServiceAccent) ?? 'neutral',
    order: Number(row.sort_order ?? CUSTOM_ORDER_BASE),
    archived: Boolean(row.archived),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  })
}

export async function listCustomServices(workspaceId: string | null): Promise<CustomService[]> {
  if (isLocal()) return localAll().sort((a, b) => a.order - b.order)
  if (!workspaceId) return []
  const { data, error } = await getSupabaseClient()
    .from('ops_custom_services')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => fromRow(r))
}

export async function createCustomService(
  workspaceId: string | null,
  input: CustomServiceInput,
): Promise<CustomService> {
  const label = input.label.trim()
  if (!label) throw new Error('항목 이름을 적어 주세요.')

  const existing = await listCustomServices(workspaceId)
  if (existing.some((c) => !c.archived && c.label === label)) {
    throw new Error(`"${label}" 항목이 이미 있습니다.`)
  }
  if (SERVICES.some((s) => s.label === label)) {
    throw new Error(`"${label}" 은 기본 항목에 이미 있습니다.`)
  }

  const next = normalizeCustomService({
    workspaceId,
    key: makeCustomServiceKey(),
    label,
    shortLabel: input.shortLabel,
    description: input.description,
    accent: input.accent ?? 'neutral',
    order: CUSTOM_ORDER_BASE + existing.length,
  })

  if (isLocal()) {
    localWrite([...localAll(), next])
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('ops_custom_services')
    .insert({
      workspace_id: workspaceId,
      key: next.key,
      label: next.label,
      short_label: next.shortLabel,
      description: next.description,
      accent: next.accent,
      sort_order: next.order,
    })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function updateCustomService(
  service: CustomService,
  patch: Partial<Pick<CustomService, 'label' | 'shortLabel' | 'description' | 'accent' | 'order' | 'archived'>>,
): Promise<CustomService> {
  const label = (patch.label ?? service.label).trim()
  if (!label) throw new Error('항목 이름을 적어 주세요.')
  const next = normalizeCustomService({
    ...service,
    ...patch,
    label,
    shortLabel: shortOf(label, patch.shortLabel ?? service.shortLabel),
    updatedAt: nowIso(),
  })

  if (isLocal()) {
    localWrite(localAll().map((c) => (c.id === service.id ? next : c)))
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('ops_custom_services')
    .update({
      label: next.label,
      short_label: next.shortLabel,
      description: next.description,
      accent: next.accent,
      sort_order: next.order,
      archived: next.archived,
    })
    .eq('id', service.id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

/**
 * 항목을 목록에서 내린다. 지우지 않고 보관 처리한다 — 이미 이 항목으로 상태·메모를
 * 적어 둔 업체가 있으면 그 기록까지 사라지기 때문이다.
 */
export async function archiveCustomService(service: CustomService): Promise<CustomService> {
  return updateCustomService(service, { archived: true })
}

export async function restoreCustomService(service: CustomService): Promise<CustomService> {
  return updateCustomService(service, { archived: false })
}
