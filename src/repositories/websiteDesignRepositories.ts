import type {
  WebsiteDesign,
  WebsiteDesignFilters,
  WebsiteDesignHandoffInput,
  WebsiteDesignHandoffSnapshot,
  WebsiteDesignInput,
} from '../types/websiteDesign'
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
  type WebsiteDesignHandoffRepository,
  type WebsiteDesignRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 홈페이지 설계                                                        */
/* ------------------------------------------------------------------ */

export class LocalWebsiteDesignRepository implements WebsiteDesignRepository {
  private read(): WebsiteDesign[] {
    return readList<WebsiteDesign>(STORAGE_KEYS.websiteDesigns)
  }
  private write(list: WebsiteDesign[]): void {
    writeJson(STORAGE_KEYS.websiteDesigns, list)
    notifyStoreChanged()
  }

  getAll(): WebsiteDesign[] {
    return this.read()
  }
  getById(id: string): WebsiteDesign | null {
    return this.read().find((d) => d.id === id) ?? null
  }
  getByProjectId(projectId: string): WebsiteDesign[] {
    return this.read()
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => b.version - a.version)
  }
  getLatestByProjectId(projectId: string): WebsiteDesign | null {
    const list = this.getByProjectId(projectId)
    if (list.length === 0) return null
    return list.find((d) => d.status !== 'superseded') ?? list[0]
  }
  nextVersion(projectId: string): number {
    return this.getByProjectId(projectId).reduce((m, d) => Math.max(m, d.version), 0) + 1
  }

  create(input: WebsiteDesignInput): WebsiteDesign {
    const ts = nowIso()
    const design: WebsiteDesign = {
      ...input,
      id: generateId(),
      version: this.nextVersion(input.projectId),
      createdAt: ts,
      updatedAt: ts,
    }
    // 페이지의 designId 채우기
    design.pages = design.pages.map((p) => ({ ...p, designId: design.id }))
    this.write([...this.read(), design])
    return design
  }

  update(id: string, input: Partial<WebsiteDesignInput>): WebsiteDesign {
    const list = this.read()
    const index = list.findIndex((d) => d.id === id)
    if (index < 0) throw new EntityNotFoundError('홈페이지 설계')
    const updated: WebsiteDesign = {
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

  markReviewed(id: string, reviewerName: string): WebsiteDesign {
    return this.update(id, { status: 'reviewed', reviewedBy: reviewerName, reviewedAt: nowIso() })
  }

  finalize(id: string, finalizerName: string): WebsiteDesign {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('홈페이지 설계')
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
    return next.find((d) => d.id === id) as WebsiteDesign
  }

  supersede(id: string): WebsiteDesign {
    return this.update(id, { status: 'superseded', supersededAt: nowIso() })
  }

  search(filters: WebsiteDesignFilters): WebsiteDesign[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.read().filter((d) => {
      if (filters.status && d.status !== filters.status) return false
      if (filters.websiteType && d.strategy.websiteType !== filters.websiteType) return false
      if (query) {
        const haystack = `${d.name} ${d.strategy.purpose} ${d.designSummary}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 홈페이지 설계 인계 스냅샷                                             */
/* ------------------------------------------------------------------ */

export class LocalWebsiteDesignHandoffRepository implements WebsiteDesignHandoffRepository {
  private read(): WebsiteDesignHandoffSnapshot[] {
    return readList<WebsiteDesignHandoffSnapshot>(STORAGE_KEYS.websiteDesignHandoffs)
  }
  private write(list: WebsiteDesignHandoffSnapshot[]): void {
    writeJson(STORAGE_KEYS.websiteDesignHandoffs, list)
    notifyStoreChanged()
  }

  getAll(): WebsiteDesignHandoffSnapshot[] {
    return this.read()
  }
  getByProjectId(projectId: string): WebsiteDesignHandoffSnapshot[] {
    return this.read().filter((h) => h.projectId === projectId)
  }
  getByDesignId(websiteDesignId: string): WebsiteDesignHandoffSnapshot | null {
    return this.read().find((h) => h.websiteDesignId === websiteDesignId) ?? null
  }

  create(snapshot: WebsiteDesignHandoffInput): WebsiteDesignHandoffSnapshot {
    const created: WebsiteDesignHandoffSnapshot = { ...snapshot, id: generateId() }
    this.write([...this.read(), created])
    return created
  }

  replaceForDesign(
    websiteDesignId: string,
    snapshot: WebsiteDesignHandoffInput,
  ): WebsiteDesignHandoffSnapshot {
    const kept = this.read().filter((h) => h.websiteDesignId !== websiteDesignId)
    const created: WebsiteDesignHandoffSnapshot = { ...snapshot, id: generateId() }
    this.write([...kept, created])
    return created
  }
}
