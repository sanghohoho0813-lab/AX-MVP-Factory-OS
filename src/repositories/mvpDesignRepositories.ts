import type {
  MvpDesign,
  MvpDesignFilters,
  MvpDesignHandoffInput,
  MvpDesignHandoffSnapshot,
  MvpDesignInput,
} from '../types/mvpDesign'
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
  type MvpDesignHandoffRepository,
  type MvpDesignRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* MVP 설계                                                            */
/* ------------------------------------------------------------------ */

export class LocalMvpDesignRepository implements MvpDesignRepository {
  private read(): MvpDesign[] {
    return readList<MvpDesign>(STORAGE_KEYS.mvpDesigns)
  }
  private write(list: MvpDesign[]): void {
    writeJson(STORAGE_KEYS.mvpDesigns, list)
    notifyStoreChanged()
  }

  getAll(): MvpDesign[] {
    return this.read()
  }
  getById(id: string): MvpDesign | null {
    return this.read().find((d) => d.id === id) ?? null
  }
  getByProjectId(projectId: string): MvpDesign[] {
    return this.read()
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.version - a.version)
  }
  getLatestByProjectId(projectId: string): MvpDesign | null {
    const list = this.getByProjectId(projectId)
    if (list.length === 0) return null
    return list.find((d) => d.status !== 'superseded') ?? list[0]
  }
  nextVersion(projectId: string): number {
    return this.getByProjectId(projectId).reduce((m, d) => Math.max(m, d.version), 0) + 1
  }

  create(input: MvpDesignInput): MvpDesign {
    const ts = nowIso()
    const design: MvpDesign = {
      ...input,
      id: generateId(),
      version: this.nextVersion(input.projectId),
      createdAt: ts,
      updatedAt: ts,
    }
    this.write([...this.read(), design])
    return design
  }

  update(id: string, input: Partial<MvpDesignInput>): MvpDesign {
    const list = this.read()
    const index = list.findIndex((d) => d.id === id)
    if (index < 0) throw new EntityNotFoundError('MVP 설계')
    const updated: MvpDesign = {
      ...list[index],
      ...input,
      id,
      version: list[index].version,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  markReviewed(id: string, reviewerName: string): MvpDesign {
    return this.update(id, { status: 'reviewed', reviewedBy: reviewerName, reviewedAt: nowIso() })
  }

  finalize(id: string, finalizerName: string): MvpDesign {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('MVP 설계')
    const ts = nowIso()
    const next = this.read().map((d) => {
      if (d.projectId === target.projectId && d.id !== id && d.status === 'finalized') {
        return { ...d, status: 'superseded' as const, supersededAt: ts, updatedAt: ts }
      }
      if (d.id === id) {
        return { ...d, status: 'finalized' as const, finalizedBy: finalizerName, finalizedAt: ts, updatedAt: ts }
      }
      return d
    })
    this.write(next)
    return next.find((d) => d.id === id) as MvpDesign
  }

  supersede(id: string): MvpDesign {
    return this.update(id, { status: 'superseded', supersededAt: nowIso() })
  }

  search(filters: MvpDesignFilters): MvpDesign[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.read().filter((d) => {
      if (filters.status && d.status !== filters.status) return false
      if (query) {
        const haystack = `${d.coreTaskName} ${d.problemStatement} ${d.designSummary} ${d.autoSummary}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* MVP 설계 인계 스냅샷                                                  */
/* ------------------------------------------------------------------ */

export class LocalMvpDesignHandoffRepository implements MvpDesignHandoffRepository {
  private read(): MvpDesignHandoffSnapshot[] {
    return readList<MvpDesignHandoffSnapshot>(STORAGE_KEYS.mvpDesignHandoffs)
  }
  private write(list: MvpDesignHandoffSnapshot[]): void {
    writeJson(STORAGE_KEYS.mvpDesignHandoffs, list)
    notifyStoreChanged()
  }

  getAll(): MvpDesignHandoffSnapshot[] {
    return this.read()
  }
  getByProjectId(projectId: string): MvpDesignHandoffSnapshot[] {
    return this.read().filter((h) => h.projectId === projectId)
  }
  getByDesignId(mvpDesignId: string): MvpDesignHandoffSnapshot | null {
    return this.read().find((h) => h.mvpDesignId === mvpDesignId) ?? null
  }

  replaceForDesign(
    mvpDesignId: string,
    snapshot: MvpDesignHandoffInput,
  ): MvpDesignHandoffSnapshot {
    const kept = this.read().filter((h) => h.mvpDesignId !== mvpDesignId)
    const created: MvpDesignHandoffSnapshot = { ...snapshot, id: generateId() }
    this.write([...kept, created])
    return created
  }
}
