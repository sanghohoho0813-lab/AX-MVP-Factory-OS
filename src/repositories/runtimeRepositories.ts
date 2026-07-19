import type {
  DistributionFilters,
  ResponseFilters,
  SurveyDistribution,
  SurveyDistributionInput,
  SurveyResponse,
  SurveyResponseInput,
} from '../types/surveyRuntime'
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
  type SurveyDistributionRepository,
  type SurveyResponseRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/** 저장 status를 만료 시각 기준으로 보정 (제출/회수는 그대로) */
function withComputedExpiry(dist: SurveyDistribution): SurveyDistribution {
  if (
    dist.status === 'submitted' ||
    dist.status === 'revoked' ||
    dist.status === 'expired'
  ) {
    return dist
  }
  if (dist.expiresAt && new Date(dist.expiresAt).getTime() < Date.now()) {
    return { ...dist, status: 'expired' }
  }
  return dist
}

/* ------------------------------------------------------------------ */
/* 설문 발급                                                            */
/* ------------------------------------------------------------------ */

export class LocalSurveyDistributionRepository
  implements SurveyDistributionRepository
{
  private read(): SurveyDistribution[] {
    return readList<SurveyDistribution>(STORAGE_KEYS.surveyDistributions)
  }

  private write(list: SurveyDistribution[]): void {
    writeJson(STORAGE_KEYS.surveyDistributions, list)
    notifyStoreChanged()
  }

  getAll(): SurveyDistribution[] {
    return this.read().map(withComputedExpiry)
  }

  getById(id: string): SurveyDistribution | null {
    const found = this.read().find((d) => d.id === id)
    return found ? withComputedExpiry(found) : null
  }

  getByToken(accessToken: string): SurveyDistribution | null {
    const found = this.read().find((d) => d.accessToken === accessToken)
    return found ? withComputedExpiry(found) : null
  }

  getByProjectId(projectId: string): SurveyDistribution[] {
    return this.getAll().filter((d) => d.projectId === projectId)
  }

  isTokenTaken(token: string): boolean {
    return this.read().some((d) => d.accessToken === token)
  }

  create(input: SurveyDistributionInput, accessToken: string): SurveyDistribution {
    const timestamp = nowIso()
    const distribution: SurveyDistribution = {
      ...input,
      id: generateId(),
      accessToken,
      status: 'issued',
      issuedAt: timestamp,
      firstOpenedAt: null,
      lastOpenedAt: null,
      submittedAt: null,
      revokedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), distribution])
    return distribution
  }

  update(id: string, input: Partial<SurveyDistribution>): SurveyDistribution {
    const list = this.read()
    const index = list.findIndex((d) => d.id === id)
    if (index < 0) throw new EntityNotFoundError('설문 링크')
    const updated: SurveyDistribution = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  revoke(id: string): SurveyDistribution {
    const timestamp = nowIso()
    return this.update(id, { status: 'revoked', revokedAt: timestamp })
  }

  regenerateToken(id: string, accessToken: string): SurveyDistribution {
    return this.update(id, { accessToken })
  }

  markOpened(id: string): SurveyDistribution {
    const dist = this.getById(id)
    if (!dist) throw new EntityNotFoundError('설문 링크')
    const timestamp = nowIso()
    const patch: Partial<SurveyDistribution> = {
      lastOpenedAt: timestamp,
      firstOpenedAt: dist.firstOpenedAt ?? timestamp,
    }
    // issued → opened (제출·회수·만료·작성중은 유지)
    if (dist.status === 'issued') patch.status = 'opened'
    return this.update(id, patch)
  }

  search(filters: DistributionFilters): SurveyDistribution[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll().filter((d) => {
      if (filters.status && d.status !== filters.status) return false
      if (filters.respondentRole && d.respondentRole !== filters.respondentRole) {
        return false
      }
      if (filters.projectId && d.projectId !== filters.projectId) return false
      if (filters.expiredOnly && d.status !== 'expired') return false
      if (filters.submittedOnly && d.status !== 'submitted') return false
      if (query) {
        const haystack = [
          d.surveyTitle,
          d.recipientName,
          d.recipientPosition,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 설문 응답                                                            */
/* ------------------------------------------------------------------ */

export class LocalSurveyResponseRepository implements SurveyResponseRepository {
  private read(): SurveyResponse[] {
    return readList<SurveyResponse>(STORAGE_KEYS.surveyResponses)
  }

  private write(list: SurveyResponse[]): void {
    writeJson(STORAGE_KEYS.surveyResponses, list)
    notifyStoreChanged()
  }

  getAll(): SurveyResponse[] {
    return this.read()
  }

  getById(id: string): SurveyResponse | null {
    return this.read().find((r) => r.id === id) ?? null
  }

  getByDistributionId(distributionId: string): SurveyResponse | null {
    return this.read().find((r) => r.distributionId === distributionId) ?? null
  }

  create(input: SurveyResponseInput): SurveyResponse {
    const timestamp = nowIso()
    const response: SurveyResponse = {
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), response])
    return response
  }

  update(id: string, input: Partial<SurveyResponseInput>): SurveyResponse {
    const list = this.read()
    const index = list.findIndex((r) => r.id === id)
    if (index < 0) throw new EntityNotFoundError('설문 응답')
    const updated: SurveyResponse = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  search(filters: ResponseFilters): SurveyResponse[] {
    return this.read().filter((r) => {
      if (filters.distributionId && r.distributionId !== filters.distributionId) {
        return false
      }
      if (filters.projectId && r.projectId !== filters.projectId) return false
      if (filters.status && r.status !== filters.status) return false
      return true
    })
  }
}
