import type {
  AnalysisIssue,
  AnalysisIssueInput,
  AssessmentFilters,
  AssessmentResult,
  AssessmentResultInput,
  InterviewQuestion,
  InterviewQuestionInput,
} from '../types/assessment'
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
  type AnalysisIssueRepository,
  type AssessmentRepository,
  type InterviewQuestionRepository,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function readList<T>(key: string): T[] {
  const value = readJson<T[]>(key, [])
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ */
/* 분석 결과                                                            */
/* ------------------------------------------------------------------ */

export class LocalAssessmentRepository implements AssessmentRepository {
  private read(): AssessmentResult[] {
    return readList<AssessmentResult>(STORAGE_KEYS.assessments)
  }

  private write(list: AssessmentResult[]): void {
    writeJson(STORAGE_KEYS.assessments, list)
    notifyStoreChanged()
  }

  getAll(): AssessmentResult[] {
    return this.read()
  }

  getById(id: string): AssessmentResult | null {
    return this.read().find((a) => a.id === id) ?? null
  }

  getByProjectId(projectId: string): AssessmentResult[] {
    return this.read()
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.version - a.version)
  }

  getLatestByProjectId(projectId: string): AssessmentResult | null {
    const list = this.getByProjectId(projectId)
    if (list.length === 0) return null
    // superseded가 아닌 것 우선, 없으면 최신 버전
    const active = list.find((a) => a.status !== 'superseded')
    return active ?? list[0]
  }

  nextVersion(projectId: string): number {
    const list = this.getByProjectId(projectId)
    return list.reduce((max, a) => Math.max(max, a.version), 0) + 1
  }

  create(input: AssessmentResultInput): AssessmentResult {
    const timestamp = nowIso()
    const result: AssessmentResult = {
      ...input,
      id: generateId(),
      version: this.nextVersion(input.projectId),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), result])
    return result
  }

  update(id: string, input: Partial<AssessmentResultInput>): AssessmentResult {
    const list = this.read()
    const index = list.findIndex((a) => a.id === id)
    if (index < 0) throw new EntityNotFoundError('진단 분석')
    const updated: AssessmentResult = {
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

  markReviewed(id: string, reviewerName: string): AssessmentResult {
    return this.update(id, {
      status: 'reviewed',
      reviewedBy: reviewerName,
      reviewedAt: nowIso(),
    })
  }

  finalize(id: string, finalizerName: string): AssessmentResult {
    const target = this.getById(id)
    if (!target) throw new EntityNotFoundError('진단 분석')
    // 같은 프로젝트의 기존 확정 결과를 superseded 처리
    const list = this.read()
    const timestamp = nowIso()
    const next = list.map((a) => {
      if (a.projectId === target.projectId && a.id !== id && a.status === 'finalized') {
        return { ...a, status: 'superseded' as const, updatedAt: timestamp }
      }
      if (a.id === id) {
        return {
          ...a,
          status: 'finalized' as const,
          finalizedBy: finalizerName,
          finalizedAt: timestamp,
          updatedAt: timestamp,
        }
      }
      return a
    })
    this.write(next)
    return next.find((a) => a.id === id) as AssessmentResult
  }

  supersede(id: string): AssessmentResult {
    return this.update(id, { status: 'superseded' })
  }

  search(filters: AssessmentFilters): AssessmentResult[] {
    const query = normalizeQuery(filters.query ?? '')
    return this.read().filter((a) => {
      if (filters.status && a.status !== filters.status) return false
      if (filters.recommendation && a.recommendation !== filters.recommendation) {
        return false
      }
      if (filters.confidence && a.confidence !== filters.confidence) return false
      if (filters.minScore !== undefined && a.finalScore < filters.minScore) {
        return false
      }
      if (filters.maxScore !== undefined && a.finalScore > filters.maxScore) {
        return false
      }
      if (query) {
        const haystack = `${a.autoSummary} ${a.manualSummary}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }
}

/* ------------------------------------------------------------------ */
/* 분석 이슈                                                            */
/* ------------------------------------------------------------------ */

export class LocalAnalysisIssueRepository implements AnalysisIssueRepository {
  private read(): AnalysisIssue[] {
    return readList<AnalysisIssue>(STORAGE_KEYS.analysisIssues)
  }

  private write(list: AnalysisIssue[]): void {
    writeJson(STORAGE_KEYS.analysisIssues, list)
    notifyStoreChanged()
  }

  getAll(): AnalysisIssue[] {
    return this.read()
  }

  getByProjectId(projectId: string): AnalysisIssue[] {
    return this.read().filter((i) => i.projectId === projectId)
  }

  createMany(items: AnalysisIssueInput[]): AnalysisIssue[] {
    const timestamp = nowIso()
    const created: AnalysisIssue[] = items.map((input) => ({
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    this.write([...this.read(), ...created])
    return created
  }

  update(id: string, input: Partial<AnalysisIssueInput>): AnalysisIssue {
    const list = this.read()
    const index = list.findIndex((i) => i.id === id)
    if (index < 0) throw new EntityNotFoundError('분석 이슈')
    const updated: AnalysisIssue = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  resolve(id: string, resolutionNote: string): AnalysisIssue {
    return this.update(id, {
      status: 'resolved',
      resolutionNote,
      resolvedAt: nowIso(),
    })
  }

  exclude(id: string, reason: string): AnalysisIssue {
    return this.update(id, {
      status: 'excluded',
      resolutionNote: reason,
      resolvedAt: nowIso(),
    })
  }

  /**
   * 자동 생성 이슈만 새 결과로 교체한다.
   * - 수동 이슈는 보존
   * - 담당자가 해결·제외·확인한 자동 이슈는 이력 보존(상태 유지)
   * - 아직 미확인(open) 자동 이슈만 삭제 후 새로 생성
   */
  replaceAutoGenerated(
    projectId: string,
    items: AnalysisIssueInput[],
  ): AnalysisIssue[] {
    const timestamp = nowIso()
    const existing = this.read()
    const kept = existing.filter((i) => {
      if (i.projectId !== projectId) return true
      if (!i.autoGenerated) return true // 수동 이슈 보존
      // 담당자가 손댄(open이 아닌) 자동 이슈는 이력 보존
      return i.status !== 'open'
    })
    const keptRuleKeys = new Set(
      kept
        .filter((i) => i.projectId === projectId && i.autoGenerated)
        .map((i) => i.ruleKey),
    )
    // 이미 담당자가 처리한 규칙은 중복 재생성하지 않는다
    const fresh = items
      .filter((input) => !keptRuleKeys.has(input.ruleKey))
      .map((input) => ({
        ...input,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
    this.write([...kept, ...fresh])
    return this.getByProjectId(projectId)
  }
}

/* ------------------------------------------------------------------ */
/* 인터뷰 질문                                                          */
/* ------------------------------------------------------------------ */

export class LocalInterviewQuestionRepository
  implements InterviewQuestionRepository
{
  private read(): InterviewQuestion[] {
    return readList<InterviewQuestion>(STORAGE_KEYS.interviewQuestions)
  }

  private write(list: InterviewQuestion[]): void {
    writeJson(STORAGE_KEYS.interviewQuestions, list)
    notifyStoreChanged()
  }

  getAll(): InterviewQuestion[] {
    return this.read()
  }

  getByProjectId(projectId: string): InterviewQuestion[] {
    return this.read().filter((q) => q.projectId === projectId)
  }

  create(input: InterviewQuestionInput): InterviewQuestion {
    const timestamp = nowIso()
    const created: InterviewQuestion = {
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    this.write([...this.read(), created])
    return created
  }

  createMany(items: InterviewQuestionInput[]): InterviewQuestion[] {
    const timestamp = nowIso()
    const created = items.map((input) => ({
      ...input,
      id: generateId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    this.write([...this.read(), ...created])
    return created
  }

  update(id: string, input: Partial<InterviewQuestionInput>): InterviewQuestion {
    const list = this.read()
    const index = list.findIndex((q) => q.id === id)
    if (index < 0) throw new EntityNotFoundError('인터뷰 질문')
    const updated: InterviewQuestion = {
      ...list[index],
      ...input,
      id,
      updatedAt: nowIso(),
    }
    list[index] = updated
    this.write(list)
    return updated
  }

  select(id: string): InterviewQuestion {
    return this.update(id, { status: 'selected' })
  }

  answer(id: string, answer: string): InterviewQuestion {
    return this.update(id, {
      answer,
      status: 'answered',
      answeredAt: nowIso(),
    })
  }

  exclude(id: string): InterviewQuestion {
    return this.update(id, { status: 'excluded' })
  }

  /**
   * 자동 생성 질문만 교체한다.
   * - 수동 질문 보존
   * - 선택·답변·제외한 자동 질문은 이력 보존
   * - 아직 제안(suggested) 상태의 자동 질문만 갱신
   */
  replaceAutoGenerated(
    projectId: string,
    items: InterviewQuestionInput[],
  ): InterviewQuestion[] {
    const timestamp = nowIso()
    const existing = this.read()
    const kept = existing.filter((q) => {
      if (q.projectId !== projectId) return true
      if (q.manual) return true
      return q.status !== 'suggested'
    })
    const keptRuleKeys = new Set(
      kept
        .filter((q) => q.projectId === projectId && !q.manual)
        .map((q) => q.ruleKey),
    )
    const fresh = items
      .filter((input) => !keptRuleKeys.has(input.ruleKey))
      .map((input) => ({
        ...input,
        id: generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }))
    this.write([...kept, ...fresh])
    return this.getByProjectId(projectId)
  }
}
