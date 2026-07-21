import type { Organization, Project } from '../types/domain'
import type {
  CaseStudy,
  CaseVisibility,
  ConsentStatus,
} from '../types/funding'
import {
  activityRepository,
  caseStudyRepository,
  fundingStrategyRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { collectFundingSources } from './funding/evidenceCollector'
import { buildCaseDraft } from './funding/caseStudyBuilder'

export class CaseStudyBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CaseStudyBlockedError'
  }
}
export class CaseStudyEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CaseStudyEditError'
  }
}

/** 실제 결과(Outcome)가 있는 전략만 사례 후보로 만들 수 있다. */
export function canCreateCase(strategyId: string): { ok: boolean; reason: string } {
  const strategy = fundingStrategyRepository.getById(strategyId)
  if (!strategy) return { ok: false, reason: '연계 전략을 찾을 수 없습니다.' }
  if (strategy.outcomes.length === 0) {
    return { ok: false, reason: '실제 결과가 기록된 전략만 사례로 만들 수 있습니다. 결과·성과를 먼저 기록하세요.' }
  }
  return { ok: true, reason: '' }
}

export function createCaseFromStrategy(strategyId: string): CaseStudy {
  const check = canCreateCase(strategyId)
  if (!check.ok) throw new CaseStudyBlockedError(check.reason)
  const strategy = fundingStrategyRepository.getById(strategyId)!
  const sources = collectFundingSources(strategy.projectId)
  if (!sources) throw new CaseStudyBlockedError('프로젝트 근거를 찾을 수 없습니다.')
  const draft = buildCaseDraft(strategy, sources)
  const created = caseStudyRepository.create({ ...draft, createdBy: CURRENT_USER.name })
  activityRepository.add({
    organizationId: created.organizationId,
    projectId: created.projectId,
    activityType: 'project_updated',
    title: '기관·자금 연계 사례 초안이 생성되었습니다.',
    description: `공개범위: 내부 전용 · 상태: 초안`,
    actorName: CURRENT_USER.name,
  })
  return created
}

/* ------------------------------------------------------------------ */
/* 편집                                                                 */
/* ------------------------------------------------------------------ */

function load(caseId: string): CaseStudy {
  const c = caseStudyRepository.getById(caseId)
  if (!c) throw new CaseStudyEditError('사례를 찾을 수 없습니다.')
  return c
}
function assertEditable(c: CaseStudy): void {
  if (c.status === 'archived') throw new CaseStudyEditError('보관된 사례는 수정할 수 없습니다.')
  if (c.status === 'approved') throw new CaseStudyEditError('승인된 사례는 수정할 수 없습니다. 상태를 되돌린 후 수정하세요.')
}

export function updateCase(
  caseId: string,
  patch: Partial<Pick<CaseStudy, 'title' | 'industry' | 'companyProfile' | 'initialSituation' | 'keyProblems' | 'strategySummary' | 'preparationActions' | 'timelineSummary' | 'outcomeSummary' | 'challenges' | 'lessons' | 'reusableInsights' | 'customerQuote' | 'anonymizationNotes'>>,
): CaseStudy {
  const c = load(caseId)
  assertEditable(c)
  return caseStudyRepository.update(caseId, { ...patch, manuallyEdited: true })
}

/** 자동 초안 원본으로 복구 */
export function restoreOriginalDraft(caseId: string): CaseStudy {
  const c = load(caseId)
  assertEditable(c)
  const strategy = fundingStrategyRepository.getById(c.strategyId)
  const sources = strategy ? collectFundingSources(strategy.projectId) : null
  if (!strategy || !sources) throw new CaseStudyEditError('원본을 재생성할 수 없습니다.')
  const draft = buildCaseDraft(strategy, sources)
  return caseStudyRepository.update(caseId, {
    ...draft,
    // 사용자 설정(공개범위·동의)은 유지
    visibility: c.visibility,
    consentStatus: c.consentStatus,
    status: c.status,
    manuallyEdited: false,
  })
}

export function setConsentStatus(caseId: string, consentStatus: ConsentStatus): CaseStudy {
  const c = load(caseId)
  assertEditable(c)
  return caseStudyRepository.update(caseId, { consentStatus })
}

/** 공개범위 변경 — 공개·고객 승인은 동의가 필요하다. */
export function setVisibility(caseId: string, visibility: CaseVisibility): CaseStudy {
  const c = load(caseId)
  assertEditable(c)
  if ((visibility === 'public' || visibility === 'customer_approved') && c.consentStatus !== 'agreed') {
    throw new CaseStudyEditError('고객 동의가 있어야 고객 승인·공개 범위로 설정할 수 있습니다.')
  }
  return caseStudyRepository.update(caseId, { visibility })
}

export interface AnonymizeCheck {
  ok: boolean
  issues: string[]
}
/** 익명화 검토 — 회사명·대표자·주소·연락처·정확 금액이 남아있는지 점검 */
export function checkAnonymization(c: CaseStudy): AnonymizeCheck {
  const org = organizationRepository.getById(c.organizationId)
  const issues: string[] = []
  const haystack = [c.title, c.companyProfile, c.initialSituation, c.strategySummary, c.outcomeSummary, ...c.keyProblems, ...c.lessons, c.customerQuote].join(' ')
  if (org?.name && haystack.includes(org.name)) issues.push('회사명이 본문에 남아 있습니다.')
  if (org?.primaryContact?.name && haystack.includes(org.primaryContact.name)) issues.push('대표자·담당자명이 남아 있습니다.')
  if (/\d{2,3}-\d{3,4}-\d{4}/.test(haystack)) issues.push('연락처가 남아 있습니다.')
  if (org?.address && haystack.includes(org.address)) issues.push('상세 주소가 남아 있습니다.')
  return { ok: issues.length === 0, issues }
}

/* ------------------------------------------------------------------ */
/* 라이프사이클                                                         */
/* ------------------------------------------------------------------ */

export function markReview(caseId: string): CaseStudy {
  const c = load(caseId)
  assertEditable(c)
  return caseStudyRepository.markReview(caseId)
}

export interface CaseFinalizeCheck {
  ok: boolean
  reasons: string[]
}
export function checkCanApprove(c: CaseStudy): CaseFinalizeCheck {
  const reasons: string[] = []
  const strategy = fundingStrategyRepository.getById(c.strategyId)
  if (!strategy || strategy.outcomes.length === 0) reasons.push('실제 결과가 있어야 합니다. 성공사례로 표현하려면 승인 결과가 필요합니다.')
  if ((c.visibility === 'public' || c.visibility === 'customer_approved') && c.consentStatus !== 'agreed') {
    reasons.push('공개·고객 승인 사례는 고객 동의가 필요합니다.')
  }
  if (c.visibility === 'anonymized' || c.visibility === 'public') {
    const anon = checkAnonymization(c)
    if (!anon.ok) reasons.push(`익명화 검토 필요: ${anon.issues.join(' ')}`)
  }
  if (c.title.trim() === '') reasons.push('사례 제목이 필요합니다.')
  return { ok: reasons.length === 0, reasons }
}

export function approveCase(caseId: string): CaseStudy {
  const c = load(caseId)
  const check = checkCanApprove(c)
  if (!check.ok) throw new CaseStudyBlockedError(check.reasons.join(' '))
  const approved = caseStudyRepository.approve(caseId, CURRENT_USER.name)
  activityRepository.add({
    organizationId: approved.organizationId,
    projectId: approved.projectId,
    activityType: 'status_changed',
    title: '기관·자금 연계 사례가 승인되었습니다.',
    description: `공개범위: ${approved.visibility}`,
    actorName: CURRENT_USER.name,
  })
  return approved
}

export function archiveCase(caseId: string): CaseStudy {
  return caseStudyRepository.archive(caseId)
}

/* ------------------------------------------------------------------ */
/* 조회                                                                 */
/* ------------------------------------------------------------------ */

export function getCase(id: string): CaseStudy | null {
  return caseStudyRepository.getById(id)
}
export function getAllCases(): CaseStudy[] {
  return caseStudyRepository.getAll()
}
export function getCasesByProject(projectId: string): CaseStudy[] {
  return caseStudyRepository.getByProjectId(projectId)
}

export interface CaseContext {
  caseStudy: CaseStudy
  project: Project | null
  organization: Organization | null
  anonymization: AnonymizeCheck
  canApprove: CaseFinalizeCheck
}
export function getCaseContext(caseId: string): CaseContext | null {
  const caseStudy = caseStudyRepository.getById(caseId)
  if (!caseStudy) return null
  return {
    caseStudy,
    project: projectRepository.getById(caseStudy.projectId),
    organization: organizationRepository.getById(caseStudy.organizationId),
    anonymization: checkAnonymization(caseStudy),
    canApprove: checkCanApprove(caseStudy),
  }
}
