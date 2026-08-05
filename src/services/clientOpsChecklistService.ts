import { STORAGE_KEYS, notifyStoreChanged, readJson, writeJson } from '../storage/localStore'

export type ClientOpsCheckKey =
  | 'clientReplySent'
  | 'fundingContacted'
  | 'businessPlanDrafted'
  | 'midCheckDone'

export type ClientOpsCheckFlags = Record<ClientOpsCheckKey, boolean>

export interface ClientOpsCheckState {
  projectId: string
  checks: ClientOpsCheckFlags
  updatedAt: string
}

export type ClientOpsCheckMap = Record<string, ClientOpsCheckState>

export const EMPTY_CLIENT_OPS_CHECKS: ClientOpsCheckFlags = {
  clientReplySent: false,
  fundingContacted: false,
  businessPlanDrafted: false,
  midCheckDone: false,
}

function normalizeState(projectId: string, state: Partial<ClientOpsCheckState> | undefined): ClientOpsCheckState {
  return {
    projectId,
    checks: {
      ...EMPTY_CLIENT_OPS_CHECKS,
      ...(state?.checks ?? {}),
    },
    updatedAt: state?.updatedAt ?? new Date(0).toISOString(),
  }
}

export function getClientOpsCheckMap(): ClientOpsCheckMap {
  const raw = readJson<Record<string, Partial<ClientOpsCheckState>>>(STORAGE_KEYS.clientOpsChecks, {})
  return Object.fromEntries(
    Object.entries(raw).map(([projectId, state]) => [projectId, normalizeState(projectId, state)]),
  )
}

export function getClientOpsChecks(projectId: string | null): ClientOpsCheckFlags {
  if (!projectId) return EMPTY_CLIENT_OPS_CHECKS
  return normalizeState(projectId, getClientOpsCheckMap()[projectId]).checks
}

export function setClientOpsCheck(projectId: string, key: ClientOpsCheckKey, checked: boolean): void {
  const map = getClientOpsCheckMap()
  const current = normalizeState(projectId, map[projectId])
  map[projectId] = {
    projectId,
    checks: {
      ...current.checks,
      [key]: checked,
    },
    updatedAt: new Date().toISOString(),
  }
  writeJson(STORAGE_KEYS.clientOpsChecks, map)
  notifyStoreChanged()
}
