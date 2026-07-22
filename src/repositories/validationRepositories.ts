import type {
  ValidationFilters,
  ValidationHandoffInput,
  ValidationHandoffSnapshot,
  ValidationTestSession,
  ValidationTestSessionInput,
  ValidationTrackType,
  ValidationWorkspace,
  ValidationWorkspaceInput,
} from '../types/validation'
import { normalizeQuery } from '../lib/format'
import {
  STORAGE_KEYS,
  generateId,
  notifyStoreChanged,
  readJson,
  writeJson,
} from '../storage/localStore'
import {
  EntityNotFoundError,
  type ValidationHandoffRepository,
  type ValidationTestSessionRepository,
  type ValidationWorkspaceRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 검증 워크스페이스                                                     */
/* ------------------------------------------------------------------ */

export class LocalValidationWorkspaceRepository implements ValidationWorkspaceRepository {
  private read(): ValidationWorkspace[] {
    return readList<ValidationWorkspace>(STORAGE_KEYS.validationWorkspaces)
  }
  private write(list: ValidationWorkspace[]): void {
    writeJson(STORAGE_KEYS.validationWorkspaces, list)
    notifyStoreChanged()
  }

  getAll(): ValidationWorkspace[] {
    return this.read()
  }
  getById(id: string): ValidationWorkspace | null {
    return this.read().find((w) => w.id === id) ?? null
  }
  getByProjectId(projectId: string): ValidationWorkspace[] {
    return this.read()
      .filter((w) => w.projectId === projectId)
      .sort((a, b) => b.version - a.version)
  }
  getByProjectAndTrack(projectId: string, trackType: ValidationTrackType): ValidationWorkspace[] {
    return this.getByProjectId(projectId).filter((w) => w.trackType === trackType)
  }
  getLatestByProjectAndTrack(projectId: string, trackType: ValidationTrackType): ValidationWorkspace | null {
    const list = this.getByProjectAndTrack(projectId, trackType)
    if (list.length === 0) return null
    return list.find((w) => w.status !== 'superseded') ?? list[0]
  }
  nextVersion(projectId: string, trackType: ValidationTrackType): number {
    return this.getByProjectAndTrack(projectId, trackType).reduce((m, w) => Math.max(m, w.version), 0) + 1
  }

  create(input: ValidationWorkspaceInput): ValidationWorkspace {
    const ts = nowIso()
    const id = generateId()
    const workspace: ValidationWorkspace = {
      ...input,
      id,
      version: this.nextVersion(input.projectId, input.trackType),
      createdAt: ts,
      updatedAt: ts,
    }
    // 하위 엔티티의 workspaceId 채우기
    workspace.gateReviews = workspace.gateReviews.map((g) => ({ ...g, workspaceId: id }))
    workspace.rounds = workspace.rounds.map((r) => ({ ...r, workspaceId: id }))
    workspace.feedbackItems = workspace.feedbackItems.map((f) => ({ ...f, workspaceId: id }))
    workspace.issues = workspace.issues.map((i) => ({ ...i, workspaceId: id }))
    this.write([...this.read(), workspace])
    return workspace
  }

  update(id: string, input: Partial<ValidationWorkspaceInput>): ValidationWorkspace {
    const list = this.read()
    const index = list.findIndex((w) => w.id === id)
    if (index < 0) throw new EntityNotFoundError('검증 워크스페이스')
    const updated: ValidationWorkspace = {
      ...list[index],
      ...input,
      id,
      version: list[index].version,
      createdAt: list[index].createdAt,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  markReady(id: string): ValidationWorkspace {
    return this.update(id, { status: 'ready' })
  }
  startTesting(id: string): ValidationWorkspace {
    return this.update(id, { status: 'testing' })
  }
  markEvaluating(id: string): ValidationWorkspace {
    return this.update(id, { status: 'evaluating' })
  }

  finalize(id: string, finalizerName: string): ValidationWorkspace {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('검증 워크스페이스')
    const ts = nowIso()
    const next = this.read().map((w) => {
      // 같은 프로젝트·트랙의 기존 확정본을 supersede
      if (
        w.projectId === target.projectId &&
        w.trackType === target.trackType &&
        w.id !== id &&
        w.status === 'finalized'
      ) {
        return { ...w, status: 'superseded' as const, supersededAt: ts, updatedAt: ts }
      }
      if (w.id === id) {
        return { ...w, status: 'finalized' as const, finalizedBy: finalizerName, finalizedAt: ts, updatedAt: ts }
      }
      return w
    })
    this.write(next)
    return next.find((w) => w.id === id) as ValidationWorkspace
  }

  supersede(id: string): ValidationWorkspace {
    return this.update(id, { status: 'superseded', supersededAt: nowIso() })
  }

  search(filters: ValidationFilters): ValidationWorkspace[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.read().filter((w) => {
      if (filters.status && w.status !== filters.status) return false
      if (filters.trackType && w.trackType !== filters.trackType) return false
      if (query) {
        const haystack = `${w.title} ${w.objective} ${w.targetUsers}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 검증 인계 스냅샷                                                      */
/* ------------------------------------------------------------------ */

export class LocalValidationHandoffRepository implements ValidationHandoffRepository {
  private read(): ValidationHandoffSnapshot[] {
    return readList<ValidationHandoffSnapshot>(STORAGE_KEYS.validationHandoffs)
  }
  private write(list: ValidationHandoffSnapshot[]): void {
    writeJson(STORAGE_KEYS.validationHandoffs, list)
    notifyStoreChanged()
  }

  getAll(): ValidationHandoffSnapshot[] {
    return this.read()
  }
  getByWorkspaceId(workspaceId: string): ValidationHandoffSnapshot | null {
    return this.read().find((h) => h.workspaceId === workspaceId) ?? null
  }
  getByProjectAndTrack(projectId: string, trackType: ValidationTrackType): ValidationHandoffSnapshot[] {
    return this.read().filter((h) => h.projectId === projectId && h.trackType === trackType)
  }

  create(snapshot: ValidationHandoffInput): ValidationHandoffSnapshot {
    const created: ValidationHandoffSnapshot = { ...snapshot, id: generateId() }
    this.write([...this.read(), created])
    return created
  }

  replaceForWorkspace(workspaceId: string, snapshot: ValidationHandoffInput): ValidationHandoffSnapshot {
    const kept = this.read().filter((h) => h.workspaceId !== workspaceId)
    const created: ValidationHandoffSnapshot = { ...snapshot, id: generateId() }
    this.write([...kept, created])
    return created
  }
}

/* ------------------------------------------------------------------ */
/* 로컬 테스트 세션 (localStorage 로컬 전용 — 외부 전송 없음)             */
/* ------------------------------------------------------------------ */

export class LocalValidationTestSessionRepository implements ValidationTestSessionRepository {
  private read(): ValidationTestSession[] {
    return readList<ValidationTestSession>(STORAGE_KEYS.validationTestSessions)
  }
  private write(list: ValidationTestSession[]): void {
    writeJson(STORAGE_KEYS.validationTestSessions, list)
    notifyStoreChanged()
  }

  getAll(): ValidationTestSession[] {
    return this.read()
  }
  getByToken(accessToken: string): ValidationTestSession | null {
    return this.read().find((s) => s.accessToken === accessToken) ?? null
  }
  getByWorkspaceId(workspaceId: string): ValidationTestSession[] {
    return this.read()
      .filter((s) => s.workspaceId === workspaceId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  create(input: ValidationTestSessionInput, accessToken: string): ValidationTestSession {
    const ts = nowIso()
    const session: ValidationTestSession = {
      ...input,
      id: generateId(),
      accessToken,
      createdAt: ts,
      updatedAt: ts,
    }
    this.write([...this.read(), session])
    return session
  }

  update(id: string, input: Partial<ValidationTestSession>): ValidationTestSession {
    const list = this.read()
    const index = list.findIndex((s) => s.id === id)
    if (index < 0) throw new EntityNotFoundError('로컬 테스트 세션')
    const updated: ValidationTestSession = {
      ...list[index],
      ...input,
      id,
      accessToken: list[index].accessToken,
      createdAt: list[index].createdAt,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  revoke(id: string): ValidationTestSession {
    return this.update(id, { status: 'revoked' })
  }
  complete(id: string): ValidationTestSession {
    return this.update(id, { status: 'completed', submittedAt: nowIso() })
  }
}
