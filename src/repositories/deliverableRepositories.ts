import type {
  DeliverableExportRecord,
  DeliverableExportRecordInput,
  DeliverableFilters,
  DeliverablePackage,
  DeliverablePackageInput,
  DeliverablePackageSnapshot,
  DeliverablePackageSnapshotInput,
} from '../types/deliverables'
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
  type DeliverableExportRepository,
  type DeliverablePackageRepository,
  type DeliverablePackageSnapshotRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 제출자료 패키지                                                       */
/* ------------------------------------------------------------------ */

export class LocalDeliverablePackageRepository implements DeliverablePackageRepository {
  private read(): DeliverablePackage[] {
    return readList<DeliverablePackage>(STORAGE_KEYS.deliverablePackages)
  }
  private write(list: DeliverablePackage[]): void {
    writeJson(STORAGE_KEYS.deliverablePackages, list)
    notifyStoreChanged()
  }

  getAll(): DeliverablePackage[] {
    return this.read()
  }
  getById(id: string): DeliverablePackage | null {
    return this.read().find((p) => p.id === id) ?? null
  }
  getByProjectId(projectId: string): DeliverablePackage[] {
    return this.read()
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => b.version - a.version)
  }
  getLatestByProjectId(projectId: string): DeliverablePackage | null {
    const list = this.getByProjectId(projectId)
    if (list.length === 0) return null
    return list.find((p) => p.status !== 'superseded' && p.status !== 'archived') ?? list[0]
  }
  nextVersion(projectId: string): number {
    return this.getByProjectId(projectId).reduce((m, p) => Math.max(m, p.version), 0) + 1
  }

  create(input: DeliverablePackageInput): DeliverablePackage {
    const ts = nowIso()
    const id = generateId()
    const pkg: DeliverablePackage = {
      ...input,
      id,
      version: this.nextVersion(input.projectId),
      createdAt: ts,
      updatedAt: ts,
    }
    pkg.sections = pkg.sections.map((s) => ({ ...s, packageId: id }))
    pkg.prompts = pkg.prompts.map((p) => ({ ...p, packageId: id }))
    this.write([...this.read(), pkg])
    return pkg
  }

  update(id: string, input: Partial<DeliverablePackageInput>): DeliverablePackage {
    const list = this.read()
    const index = list.findIndex((p) => p.id === id)
    if (index < 0) throw new EntityNotFoundError('제출자료 패키지')
    const updated: DeliverablePackage = {
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

  markReviewed(id: string, reviewerName: string): DeliverablePackage {
    return this.update(id, { status: 'reviewed', reviewedBy: reviewerName, reviewedAt: nowIso() })
  }

  finalize(id: string, finalizerName: string): DeliverablePackage {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('제출자료 패키지')
    const ts = nowIso()
    const next = this.read().map((p) => {
      // 같은 프로젝트·같은 유형의 기존 확정본을 supersede
      if (p.projectId === target.projectId && p.type === target.type && p.id !== id && p.status === 'finalized') {
        return { ...p, status: 'superseded' as const, supersededAt: ts, updatedAt: ts }
      }
      if (p.id === id) {
        return { ...p, status: 'finalized' as const, finalizedBy: finalizerName, finalizedAt: ts, updatedAt: ts }
      }
      return p
    })
    this.write(next)
    return next.find((p) => p.id === id) as DeliverablePackage
  }

  supersede(id: string): DeliverablePackage {
    return this.update(id, { status: 'superseded', supersededAt: nowIso() })
  }

  archive(id: string): DeliverablePackage {
    return this.update(id, { status: 'archived', archivedAt: nowIso() })
  }

  search(filters: DeliverableFilters): DeliverablePackage[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.read().filter((p) => {
      if (filters.status && p.status !== filters.status) return false
      if (filters.type && p.type !== filters.type) return false
      if (filters.audience && p.audience !== filters.audience) return false
      if (filters.includesAx && !p.includedTracks.includes('ax')) return false
      if (filters.includesWebsite && !p.includedTracks.includes('website')) return false
      if (filters.includesValidation && !p.includedTracks.includes('validation')) return false
      if (query) {
        const haystack = `${p.name} ${p.description} ${p.sections.map((s) => s.title).join(' ')}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 확정 스냅샷                                                          */
/* ------------------------------------------------------------------ */

export class LocalDeliverablePackageSnapshotRepository
  implements DeliverablePackageSnapshotRepository
{
  private read(): DeliverablePackageSnapshot[] {
    return readList<DeliverablePackageSnapshot>(STORAGE_KEYS.deliverablePackageSnapshots)
  }
  private write(list: DeliverablePackageSnapshot[]): void {
    writeJson(STORAGE_KEYS.deliverablePackageSnapshots, list)
    notifyStoreChanged()
  }

  getAll(): DeliverablePackageSnapshot[] {
    return this.read()
  }
  getByPackageId(packageId: string): DeliverablePackageSnapshot | null {
    return this.read().find((s) => s.packageId === packageId) ?? null
  }
  getByProjectId(projectId: string): DeliverablePackageSnapshot[] {
    return this.read().filter((s) => s.projectId === projectId)
  }

  create(snapshot: DeliverablePackageSnapshotInput): DeliverablePackageSnapshot {
    const created: DeliverablePackageSnapshot = { ...snapshot, id: generateId() }
    this.write([...this.read(), created])
    return created
  }

  replaceForPackage(
    packageId: string,
    snapshot: DeliverablePackageSnapshotInput,
  ): DeliverablePackageSnapshot {
    const kept = this.read().filter((s) => s.packageId !== packageId)
    const created: DeliverablePackageSnapshot = { ...snapshot, id: generateId() }
    this.write([...kept, created])
    return created
  }
}

/* ------------------------------------------------------------------ */
/* 내보내기 기록 (메타데이터만 저장)                                     */
/* ------------------------------------------------------------------ */

export class LocalDeliverableExportRepository implements DeliverableExportRepository {
  private read(): DeliverableExportRecord[] {
    return readList<DeliverableExportRecord>(STORAGE_KEYS.deliverableExportRecords)
  }
  private write(list: DeliverableExportRecord[]): void {
    writeJson(STORAGE_KEYS.deliverableExportRecords, list)
    notifyStoreChanged()
  }

  getByPackageId(packageId: string): DeliverableExportRecord[] {
    return this.read()
      .filter((r) => r.packageId === packageId)
      .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))
  }

  create(record: DeliverableExportRecordInput): DeliverableExportRecord {
    const created: DeliverableExportRecord = { ...record, id: generateId() }
    this.write([...this.read(), created])
    return created
  }

  deleteByPackageId(packageId: string): void {
    this.write(this.read().filter((r) => r.packageId !== packageId))
  }
}
