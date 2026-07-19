import type {
  ModuleFilters,
  ProjectSurveyBlueprint,
  ProjectSurveyBlueprintInput,
  Question,
  QuestionFilters,
  QuestionInput,
  SurveyModule,
  SurveyModuleInput,
  SurveyTemplate,
  SurveyTemplateInput,
  TemplateFilters,
} from '../types/survey'
import { normalizeQuery } from '../lib/format'
import {
  STORAGE_KEYS,
  generateId,
  notifyStoreChanged,
  readJson,
  writeJson,
} from '../storage/localStore'
import {
  DuplicateCodeError,
  EntityNotFoundError,
  type ProjectSurveyBlueprintRepository,
  type QuestionRepository,
  type SurveyModuleRepository,
  type SurveyTemplateRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 질문                                                                 */
/* ------------------------------------------------------------------ */

export class LocalQuestionRepository implements QuestionRepository {
  private read(): Question[] {
    return readList<Question>(STORAGE_KEYS.questions)
  }

  private write(list: Question[]): void {
    writeJson(STORAGE_KEYS.questions, list)
    notifyStoreChanged()
  }

  getAll(includeArchived = false): Question[] {
    const list = this.read()
    return includeArchived ? list : list.filter((q) => q.archivedAt === null)
  }

  getById(id: string): Question | null {
    return this.read().find((q) => q.id === id) ?? null
  }

  isCodeTaken(code: string, excludeId?: string): boolean {
    const target = code.trim().toUpperCase()
    return this.read().some(
      (q) => q.id !== excludeId && q.code.trim().toUpperCase() === target,
    )
  }

  create(input: QuestionInput): Question {
    if (this.isCodeTaken(input.code)) throw new DuplicateCodeError(input.code)
    const timestamp = nowIso()
    const question: Question = {
      ...input,
      id: generateId(),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    }
    this.write([...this.read(), question])
    return question
  }

  update(id: string, input: Partial<QuestionInput>): Question {
    const list = this.read()
    const index = list.findIndex((q) => q.id === id)
    if (index < 0) throw new EntityNotFoundError('질문')
    if (input.code && this.isCodeTaken(input.code, id)) {
      throw new DuplicateCodeError(input.code)
    }
    const updated: Question = {
      ...list[index],
      ...input,
      id,
      version: list[index].version + 1,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  clone(id: string): Question {
    const source = this.getById(id)
    if (!source) throw new EntityNotFoundError('질문')
    // 코드 중복을 피하기 위해 -COPY 접미어에 번호를 붙인다
    let cloneCode = `${source.code}-COPY`
    let n = 1
    while (this.isCodeTaken(cloneCode)) {
      n += 1
      cloneCode = `${source.code}-COPY${n}`
    }
    const timestamp = nowIso()
    const cloned: Question = {
      ...source,
      id: generateId(),
      code: cloneCode,
      text: `${source.text} (복제)`,
      version: 1,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    }
    this.write([...this.read(), cloned])
    return cloned
  }

  setActive(id: string, active: boolean): Question {
    return this.update(id, { active })
  }

  archive(id: string): Question {
    const list = this.read()
    const index = list.findIndex((q) => q.id === id)
    if (index < 0) throw new EntityNotFoundError('질문')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      active: false,
      archivedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  getUsageCount(id: string): number {
    const modules = readList<SurveyModule>(STORAGE_KEYS.surveyModules)
    const templates = readList<SurveyTemplate>(STORAGE_KEYS.surveyTemplates)
    let count = 0
    for (const m of modules) {
      if (m.archivedAt === null && m.questionIds.includes(id)) count += 1
    }
    for (const t of templates) {
      if (t.archivedAt !== null) continue
      const used = t.sections.some((s) =>
        s.placements.some((p) => p.questionId === id),
      )
      if (used) count += 1
    }
    return count
  }

  search(filters: QuestionFilters): Question[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll(filters.includeArchived).filter((q) => {
      if (filters.category && q.category !== filters.category) return false
      if (filters.type && q.type !== filters.type) return false
      if (filters.respondentRole && q.respondentRole !== filters.respondentRole) {
        return false
      }
      if (filters.scope && q.scope !== filters.scope) return false
      if (filters.scoringDomain && q.scoringDomain !== filters.scoringDomain) {
        return false
      }
      if (
        filters.expertRiskGrade &&
        q.expertRiskGrade !== filters.expertRiskGrade
      ) {
        return false
      }
      if (filters.activeState === 'active' && !q.active) return false
      if (filters.activeState === 'inactive' && q.active) return false
      if (filters.inUse && this.getUsageCount(q.id) === 0) return false
      if (query) {
        const haystack = [
          q.code,
          q.text,
          q.helpText,
          q.analysisTags.join(' '),
          q.industryKeys.join(' '),
          q.objectiveKeys.join(' '),
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
/* 모듈                                                                 */
/* ------------------------------------------------------------------ */

export class LocalSurveyModuleRepository implements SurveyModuleRepository {
  private read(): SurveyModule[] {
    return readList<SurveyModule>(STORAGE_KEYS.surveyModules)
  }

  private write(list: SurveyModule[]): void {
    writeJson(STORAGE_KEYS.surveyModules, list)
    notifyStoreChanged()
  }

  getAll(includeArchived = false): SurveyModule[] {
    const list = this.read()
    return includeArchived ? list : list.filter((m) => m.archivedAt === null)
  }

  getById(id: string): SurveyModule | null {
    return this.read().find((m) => m.id === id) ?? null
  }

  create(input: SurveyModuleInput): SurveyModule {
    const timestamp = nowIso()
    const module: SurveyModule = {
      ...input,
      id: generateId(),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    }
    this.write([...this.read(), module])
    return module
  }

  update(id: string, input: Partial<SurveyModuleInput>): SurveyModule {
    const list = this.read()
    const index = list.findIndex((m) => m.id === id)
    if (index < 0) throw new EntityNotFoundError('모듈')
    const updated: SurveyModule = {
      ...list[index],
      ...input,
      id,
      version: list[index].version + 1,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  archive(id: string): SurveyModule {
    const list = this.read()
    const index = list.findIndex((m) => m.id === id)
    if (index < 0) throw new EntityNotFoundError('모듈')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      status: 'archived',
      archivedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  search(filters: ModuleFilters): SurveyModule[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll(filters.includeArchived).filter((m) => {
      if (filters.kind && m.kind !== filters.kind) return false
      if (filters.status && m.status !== filters.status) return false
      if (
        filters.respondentRole &&
        !m.recommendedRespondentRoles.includes(filters.respondentRole)
      ) {
        return false
      }
      if (query) {
        const haystack = [m.name, m.description, m.keys.join(' ')]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 템플릿                                                               */
/* ------------------------------------------------------------------ */

export class LocalSurveyTemplateRepository implements SurveyTemplateRepository {
  private read(): SurveyTemplate[] {
    return readList<SurveyTemplate>(STORAGE_KEYS.surveyTemplates)
  }

  private write(list: SurveyTemplate[]): void {
    writeJson(STORAGE_KEYS.surveyTemplates, list)
    notifyStoreChanged()
  }

  getAll(includeArchived = false): SurveyTemplate[] {
    const list = this.read()
    return includeArchived ? list : list.filter((t) => t.archivedAt === null)
  }

  getById(id: string): SurveyTemplate | null {
    return this.read().find((t) => t.id === id) ?? null
  }

  create(input: SurveyTemplateInput, estimatedMinutes: number): SurveyTemplate {
    const timestamp = nowIso()
    const template: SurveyTemplate = {
      ...input,
      id: generateId(),
      version: 1,
      estimatedMinutes,
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: input.status === 'published' ? timestamp : null,
      archivedAt: null,
    }
    this.write([...this.read(), template])
    return template
  }

  update(
    id: string,
    input: Partial<SurveyTemplateInput>,
    estimatedMinutes?: number,
  ): SurveyTemplate {
    const list = this.read()
    const index = list.findIndex((t) => t.id === id)
    if (index < 0) throw new EntityNotFoundError('템플릿')
    const updated: SurveyTemplate = {
      ...list[index],
      ...input,
      id,
      estimatedMinutes: estimatedMinutes ?? list[index].estimatedMinutes,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  publish(id: string): SurveyTemplate {
    const list = this.read()
    const index = list.findIndex((t) => t.id === id)
    if (index < 0) throw new EntityNotFoundError('템플릿')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      status: 'published',
      publishedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  cloneAsDraft(id: string): SurveyTemplate {
    const source = this.getById(id)
    if (!source) throw new EntityNotFoundError('템플릿')
    const timestamp = nowIso()
    const cloned: SurveyTemplate = {
      ...structuredCloneSafe(source),
      id: generateId(),
      name: `${source.name} (복제)`,
      status: 'draft',
      version: 1,
      publishedAt: null,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), cloned])
    return cloned
  }

  createNewVersion(id: string): SurveyTemplate {
    const source = this.getById(id)
    if (!source) throw new EntityNotFoundError('템플릿')
    const timestamp = nowIso()
    const next: SurveyTemplate = {
      ...structuredCloneSafe(source),
      id: generateId(),
      name: source.name,
      status: 'draft',
      version: source.version + 1,
      publishedAt: null,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), next])
    return next
  }

  archive(id: string): SurveyTemplate {
    const list = this.read()
    const index = list.findIndex((t) => t.id === id)
    if (index < 0) throw new EntityNotFoundError('템플릿')
    const timestamp = nowIso()
    list[index] = {
      ...list[index],
      status: 'archived',
      archivedAt: timestamp,
      updatedAt: timestamp,
    }
    this.write(list)
    return list[index]
  }

  search(filters: TemplateFilters): SurveyTemplate[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.getAll(filters.includeArchived).filter((t) => {
      if (filters.respondentRole && t.respondentRole !== filters.respondentRole) {
        return false
      }
      if (filters.status && t.status !== filters.status) return false
      if (filters.purpose && t.purpose !== filters.purpose) return false
      if (query) {
        const haystack = [t.name, t.description].join(' ').toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 프로젝트 설문 초안                                                    */
/* ------------------------------------------------------------------ */

export class LocalProjectSurveyBlueprintRepository
  implements ProjectSurveyBlueprintRepository
{
  private read(): ProjectSurveyBlueprint[] {
    return readList<ProjectSurveyBlueprint>(STORAGE_KEYS.surveyBlueprints)
  }

  private write(list: ProjectSurveyBlueprint[]): void {
    writeJson(STORAGE_KEYS.surveyBlueprints, list)
    notifyStoreChanged()
  }

  getAll(): ProjectSurveyBlueprint[] {
    return this.read()
  }

  getById(id: string): ProjectSurveyBlueprint | null {
    return this.read().find((b) => b.id === id) ?? null
  }

  getByProjectId(projectId: string): ProjectSurveyBlueprint[] {
    return this.read().filter((b) => b.projectId === projectId)
  }

  create(input: ProjectSurveyBlueprintInput): ProjectSurveyBlueprint {
    const timestamp = nowIso()
    const blueprint: ProjectSurveyBlueprint = {
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), blueprint])
    return blueprint
  }

  update(
    id: string,
    input: Partial<ProjectSurveyBlueprintInput>,
  ): ProjectSurveyBlueprint {
    const list = this.read()
    const index = list.findIndex((b) => b.id === id)
    if (index < 0) throw new EntityNotFoundError('설문 초안')
    const updated: ProjectSurveyBlueprint = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  markReady(id: string): ProjectSurveyBlueprint {
    return this.update(id, { status: 'ready' })
  }
}

/** structuredClone 미지원 환경 대비 안전 깊은 복제 */
function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
