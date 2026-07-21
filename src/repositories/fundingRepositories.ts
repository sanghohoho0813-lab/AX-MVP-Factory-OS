import type {
  CaseStudy,
  CaseStudyFilters,
  CaseStudyInput,
  FundingStrategy,
  FundingStrategyFilters,
  FundingStrategyInput,
  FundingStrategySnapshot,
  FundingStrategySnapshotInput,
  InformationFreshnessStatus,
  Institution,
  InstitutionFilters,
  InstitutionInput,
  ProgramFilters,
  SupportProgram,
  SupportProgramInput,
} from '../types/funding'
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
  type CaseStudyRepository,
  type FundingStrategyRepository,
  type FundingStrategySnapshotRepository,
  type InstitutionRepository,
  type SupportProgramRepository,
} from './types'
import { computeProgramFreshness } from '../services/funding/freshnessEngine'

function nowIso(): string {
  return new Date().toISOString()
}
function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 기관                                                                 */
/* ------------------------------------------------------------------ */

export class LocalInstitutionRepository implements InstitutionRepository {
  private read(): Institution[] {
    return readList<Institution>(STORAGE_KEYS.institutions)
  }
  private write(list: Institution[]): void {
    writeJson(STORAGE_KEYS.institutions, list)
    notifyStoreChanged()
  }
  getAll(includeArchived = false): Institution[] {
    return this.read().filter((i) => includeArchived || i.archivedAt === null)
  }
  getById(id: string): Institution | null {
    return this.read().find((i) => i.id === id) ?? null
  }
  create(input: InstitutionInput): Institution {
    const ts = nowIso()
    const created: Institution = { ...input, id: generateId(), createdAt: ts, updatedAt: ts }
    this.write([...this.read(), created])
    return created
  }
  update(id: string, input: Partial<InstitutionInput>): Institution {
    const list = this.read()
    const idx = list.findIndex((i) => i.id === id)
    if (idx < 0) throw new EntityNotFoundError('기관')
    const updated: Institution = { ...list[idx], ...input, id, updatedAt: nowIso() }
    list[idx] = updated
    this.write(list)
    return updated
  }
  archive(id: string): Institution {
    return this.update(id, { archivedAt: nowIso() })
  }
  search(filters: InstitutionFilters): Institution[] {
    const q = normalizeQuery(filters.query ?? '')
    return this.getAll().filter((i) => {
      if (filters.category && i.category !== filters.category) return false
      if (filters.sourceStatus && i.sourceStatus !== filters.sourceStatus) return false
      if (q && !`${i.name} ${i.shortName} ${i.description}`.toLowerCase().includes(q)) return false
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 지원 프로그램                                                        */
/* ------------------------------------------------------------------ */

export class LocalSupportProgramRepository implements SupportProgramRepository {
  private read(): SupportProgram[] {
    return readList<SupportProgram>(STORAGE_KEYS.supportPrograms)
  }
  private write(list: SupportProgram[]): void {
    writeJson(STORAGE_KEYS.supportPrograms, list)
    notifyStoreChanged()
  }
  getAll(includeArchived = false): SupportProgram[] {
    return this.read().filter((p) => includeArchived || p.archivedAt === null)
  }
  getById(id: string): SupportProgram | null {
    return this.read().find((p) => p.id === id) ?? null
  }
  getByInstitutionId(institutionId: string): SupportProgram[] {
    return this.getAll().filter((p) => p.institutionId === institutionId)
  }
  create(input: SupportProgramInput): SupportProgram {
    const ts = nowIso()
    const created: SupportProgram = { ...input, id: generateId(), createdAt: ts, updatedAt: ts }
    this.write([...this.read(), created])
    return created
  }
  update(id: string, input: Partial<SupportProgramInput>): SupportProgram {
    const list = this.read()
    const idx = list.findIndex((p) => p.id === id)
    if (idx < 0) throw new EntityNotFoundError('지원 프로그램')
    const updated: SupportProgram = { ...list[idx], ...input, id, updatedAt: nowIso() }
    list[idx] = updated
    this.write(list)
    return updated
  }
  archive(id: string): SupportProgram {
    return this.update(id, { archivedAt: nowIso() })
  }
  search(filters: ProgramFilters): SupportProgram[] {
    const q = normalizeQuery(filters.query ?? '')
    return this.getAll().filter((p) => {
      if (filters.supportType && p.supportType !== filters.supportType) return false
      if (filters.institutionId && p.institutionId !== filters.institutionId) return false
      if (filters.freshness && computeProgramFreshness(p) !== filters.freshness) return false
      if (q && !`${p.name} ${p.summary}`.toLowerCase().includes(q)) return false
      return true
    })
  }
  /** 재확인이 필요한(stale·unknown·review_due) 프로그램 */
  findStalePrograms(): SupportProgram[] {
    return this.getAll().filter((p) => {
      const f: InformationFreshnessStatus = computeProgramFreshness(p)
      return f === 'stale' || f === 'unknown' || f === 'review_due'
    })
  }
}

/* ------------------------------------------------------------------ */
/* 연계 전략                                                            */
/* ------------------------------------------------------------------ */

export class LocalFundingStrategyRepository implements FundingStrategyRepository {
  private read(): FundingStrategy[] {
    return readList<FundingStrategy>(STORAGE_KEYS.fundingStrategies)
  }
  private write(list: FundingStrategy[]): void {
    writeJson(STORAGE_KEYS.fundingStrategies, list)
    notifyStoreChanged()
  }
  getAll(): FundingStrategy[] {
    return this.read()
  }
  getById(id: string): FundingStrategy | null {
    return this.read().find((s) => s.id === id) ?? null
  }
  getByProjectId(projectId: string): FundingStrategy[] {
    return this.read().filter((s) => s.projectId === projectId).sort((a, b) => b.version - a.version)
  }
  getLatestByProjectId(projectId: string): FundingStrategy | null {
    const list = this.getByProjectId(projectId)
    if (list.length === 0) return null
    return list.find((s) => s.status !== 'superseded') ?? list[0]
  }
  nextVersion(projectId: string): number {
    return this.getByProjectId(projectId).reduce((m, s) => Math.max(m, s.version), 0) + 1
  }
  create(input: FundingStrategyInput): FundingStrategy {
    const ts = nowIso()
    const id = generateId()
    const strategy: FundingStrategy = { ...input, id, version: this.nextVersion(input.projectId), createdAt: ts, updatedAt: ts }
    // 하위 엔티티의 strategyId 채우기
    strategy.matches = strategy.matches.map((m) => ({ ...m, strategyId: id }))
    strategy.gaps = strategy.gaps.map((g) => ({ ...g, strategyId: id }))
    strategy.outreachPlans = strategy.outreachPlans.map((p) => ({ ...p, strategyId: id }))
    strategy.outreachActivities = strategy.outreachActivities.map((a) => ({ ...a, strategyId: id }))
    strategy.documentRequirements = strategy.documentRequirements.map((d) => ({ ...d, strategyId: id }))
    strategy.applications = strategy.applications.map((a) => ({ ...a, strategyId: id }))
    strategy.outcomes = strategy.outcomes.map((o) => ({ ...o, strategyId: id }))
    strategy.metrics = strategy.metrics.map((m) => ({ ...m, strategyId: id }))
    this.write([...this.read(), strategy])
    return strategy
  }
  update(id: string, input: Partial<FundingStrategyInput>): FundingStrategy {
    const list = this.read()
    const idx = list.findIndex((s) => s.id === id)
    if (idx < 0) throw new EntityNotFoundError('연계 전략')
    const updated: FundingStrategy = { ...list[idx], ...input, id, version: list[idx].version, createdAt: list[idx].createdAt, updatedAt: nowIso() }
    list[idx] = updated
    this.write(list)
    return updated
  }
  markReviewed(id: string, reviewerName: string): FundingStrategy {
    return this.update(id, { status: 'reviewed', reviewedBy: reviewerName, reviewedAt: nowIso() })
  }
  finalize(id: string, finalizerName: string): FundingStrategy {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('연계 전략')
    const ts = nowIso()
    const next = this.read().map((s) => {
      if (s.projectId === target.projectId && s.id !== id && s.status === 'finalized') {
        return { ...s, status: 'superseded' as const, supersededAt: ts, updatedAt: ts }
      }
      if (s.id === id) {
        return { ...s, status: 'finalized' as const, finalizedBy: finalizerName, finalizedAt: ts, updatedAt: ts }
      }
      return s
    })
    this.write(next)
    return next.find((s) => s.id === id) as FundingStrategy
  }
  supersede(id: string): FundingStrategy {
    return this.update(id, { status: 'superseded', supersededAt: nowIso() })
  }
  search(filters: FundingStrategyFilters): FundingStrategy[] {
    const q = normalizeQuery(filters.query ?? '')
    return this.read().filter((s) => {
      if (filters.status && s.status !== filters.status) return false
      if (filters.applicationStage && !s.applications.some((a) => a.applicationStage === filters.applicationStage)) return false
      if (filters.outcomeType && !s.outcomes.some((o) => o.type === filters.outcomeType)) return false
      if (q && !`${s.objective} ${s.targetUse} ${s.strategySummary}`.toLowerCase().includes(q)) return false
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 전략 확정 스냅샷                                                     */
/* ------------------------------------------------------------------ */

export class LocalFundingStrategySnapshotRepository implements FundingStrategySnapshotRepository {
  private read(): FundingStrategySnapshot[] {
    return readList<FundingStrategySnapshot>(STORAGE_KEYS.fundingStrategySnapshots)
  }
  private write(list: FundingStrategySnapshot[]): void {
    writeJson(STORAGE_KEYS.fundingStrategySnapshots, list)
    notifyStoreChanged()
  }
  getAll(): FundingStrategySnapshot[] {
    return this.read()
  }
  getByStrategyId(strategyId: string): FundingStrategySnapshot | null {
    return this.read().find((s) => s.strategyId === strategyId) ?? null
  }
  getByProjectId(projectId: string): FundingStrategySnapshot[] {
    return this.read().filter((s) => s.projectId === projectId)
  }
  create(snapshot: FundingStrategySnapshotInput): FundingStrategySnapshot {
    const created: FundingStrategySnapshot = { ...snapshot, id: generateId() }
    this.write([...this.read(), created])
    return created
  }
  replaceForStrategy(strategyId: string, snapshot: FundingStrategySnapshotInput): FundingStrategySnapshot {
    const kept = this.read().filter((s) => s.strategyId !== strategyId)
    const created: FundingStrategySnapshot = { ...snapshot, id: generateId() }
    this.write([...kept, created])
    return created
  }
}

/* ------------------------------------------------------------------ */
/* 사례                                                                 */
/* ------------------------------------------------------------------ */

export class LocalCaseStudyRepository implements CaseStudyRepository {
  private read(): CaseStudy[] {
    return readList<CaseStudy>(STORAGE_KEYS.caseStudies)
  }
  private write(list: CaseStudy[]): void {
    writeJson(STORAGE_KEYS.caseStudies, list)
    notifyStoreChanged()
  }
  getAll(includeArchived = false): CaseStudy[] {
    return this.read().filter((c) => includeArchived || c.archivedAt === null)
  }
  getById(id: string): CaseStudy | null {
    return this.read().find((c) => c.id === id) ?? null
  }
  getByProjectId(projectId: string): CaseStudy[] {
    return this.getAll().filter((c) => c.projectId === projectId)
  }
  create(input: CaseStudyInput): CaseStudy {
    const ts = nowIso()
    const created: CaseStudy = { ...input, id: generateId(), createdAt: ts, updatedAt: ts }
    this.write([...this.read(), created])
    return created
  }
  update(id: string, input: Partial<CaseStudyInput>): CaseStudy {
    const list = this.read()
    const idx = list.findIndex((c) => c.id === id)
    if (idx < 0) throw new EntityNotFoundError('사례')
    const updated: CaseStudy = { ...list[idx], ...input, id, createdAt: list[idx].createdAt, updatedAt: nowIso() }
    list[idx] = updated
    this.write(list)
    return updated
  }
  markReview(id: string): CaseStudy {
    return this.update(id, { status: 'review' })
  }
  approve(id: string, approverName: string): CaseStudy {
    return this.update(id, { status: 'approved', approvedBy: approverName, approvedAt: nowIso() })
  }
  archive(id: string): CaseStudy {
    return this.update(id, { status: 'archived', archivedAt: nowIso() })
  }
  search(filters: CaseStudyFilters): CaseStudy[] {
    const q = normalizeQuery(filters.query ?? '')
    return this.getAll().filter((c) => {
      if (filters.status && c.status !== filters.status) return false
      if (filters.visibility && c.visibility !== filters.visibility) return false
      if (q && !`${c.title} ${c.industry} ${c.outcomeSummary}`.toLowerCase().includes(q)) return false
      return true
    })
  }
}
