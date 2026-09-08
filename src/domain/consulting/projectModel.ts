/**
 * 프로젝트 기본값 · 정규화.
 *
 * 저장된 값이 예전 모양이거나 일부가 비어 있어도 화면이 멈추지 않도록 여기서 한 번 채운다.
 * (고객 운영 기록의 normalizeClientOps 와 같은 역할)
 */

import type {
  ConsultingProject,
  CoreThread,
  CoreThreadKey,
  FieldReviewWorkspace,
  MvpWorkspace,
  PatentWorkspace,
  StageKey,
  StageState,
  VentureWorkspace,
} from '../../types/consulting'
import { STAGE_ORDER, isStageKey } from './workflowDefinition'
import { emptyFact } from './factsheetSchema'

export const CORE_THREAD_KEYS: CoreThreadKey[] = [
  'fieldProblem', 'existingMethod', 'coreTech', 'patentPoint', 'axCore', 'platformSurface', 'ventureSentence', 'keyEvidence',
]

export const CORE_THREAD_LABEL: Record<CoreThreadKey, string> = {
  fieldProblem: '현장문제',
  existingMethod: '기존방식',
  coreTech: '핵심 해결기술',
  patentPoint: '특허 권리화 포인트',
  axCore: 'MVP AX Core',
  platformSurface: 'Platform Surface',
  ventureSentence: '벤처 Solution 핵심문장',
  keyEvidence: '핵심 증빙',
}

export const CORE_THREAD_HINT: Record<CoreThreadKey, string> = {
  fieldProblem: '현장에서 반복되는 문제 한 문장',
  existingMethod: '지금은 어떻게 하고 왜 부족한가',
  coreTech: '특허·MVP·사업계획서가 같은 이름으로 부를 기술',
  patentPoint: '경쟁사가 가장 쉽게 베낄 핵심 구조·처리순서·연결관계',
  axCore: '실제로 동작하는 분석·추천·최적화 기능 1개',
  platformSurface: '고객·거래처·현장 사용자가 쓰는 화면',
  ventureSentence: '사업계획서 2번(솔루션)의 첫 문장',
  keyEvidence: '이 줄기를 증명하는 가장 강한 증빙 1~2개',
}

export function emptyStage(): StageState {
  return { status: 'not_started', skipReason: '', blockedBy: '', note: '', startedAt: null, completedAt: null, updatedAt: null }
}

export function emptyStages(): Record<StageKey, StageState> {
  return Object.fromEntries(STAGE_ORDER.map((k) => [k, emptyStage()])) as Record<StageKey, StageState>
}

export function emptyCoreThread(): CoreThread {
  return Object.fromEntries(CORE_THREAD_KEYS.map((k) => [k, ''])) as CoreThread
}

export function emptyPatent(): PatentWorkspace {
  return {
    problem: '', existingMethod: '', differentStructure: '', processFlow: '', claimPoint: '', titleCandidates: '',
    priorArtKeywords: '', priorArtFindings: '', inventors: '', applicant: '', rightsNote: '',
    applicationNumber: '', filedAt: '', examRequestDue: '', filingStatus: 'none',
  }
}

export function emptyMvp(): MvpWorkspace {
  return {
    productName: '', oneLineValue: '', targetUser: '', primaryJourney: '', axCoreFeature: '', axMode: '',
    platformSurface: '', live: '', demo: '', future: '', notBuilding: '', demoDataAssumption: '', mvpUrl: '', referenceStyle: '',
  }
}

/** 기본 제출서류 8종 (Master §24) — 키는 바꾸지 않는다 */
export const VENTURE_DOCUMENTS: { key: string; label: string; hint: string }[] = [
  { key: 'sme', label: '중소기업확인서', hint: '중소기업현황정보시스템' },
  { key: 'bizReg', label: '사업자등록증', hint: '' },
  { key: 'corpReg', label: '법인등기사항전부증명서', hint: '법인 · 신청일 근접 발급' },
  { key: 'vat', label: '부가가치세 과세표준증명원', hint: '요구기간 확인' },
  { key: 'fin', label: '재무제표 또는 감사보고서', hint: '요구기간 확인' },
  { key: 'empIns', label: '고용보험 취득자/가입자 명부', hint: '요구기간 확인' },
  { key: 'ins4', label: '4대보험 가입자 명부', hint: '최신' },
  { key: 'shareholders', label: '주주명부', hint: '법인 · 최신' },
]

export function emptyVenture(): VentureWorkspace {
  const section = () => ({ outline: '', done: false })
  return {
    sections: { 1: section(), 2: section(), 3: section(), 4: section(), 5: section(), 6: section(), 7: section() },
    documents: Object.fromEntries(VENTURE_DOCUMENTS.map((d) => [d.key, false])),
    judgeScores: {},
    redFlagsCleared: {},
    submittedAt: '',
    submissionNote: '',
  }
}

export function emptyFieldReview(): FieldReviewWorkspace {
  return {
    reviewDate: '', script: '', demoFlow: '', qa: [], numbersToMemorize: [], evidencePackChecked: {}, mockReviewDone: false, result: '',
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function normalizeProject(raw: Partial<ConsultingProject> & { id: string; clientId: string; createdAt: string; updatedAt: string }): ConsultingProject {
  const stages = emptyStages()
  if (raw.stages && typeof raw.stages === 'object') {
    for (const k of STAGE_ORDER) {
      const v = (raw.stages as Partial<Record<StageKey, Partial<StageState>>>)[k]
      if (v) stages[k] = { ...stages[k], ...v }
    }
  }
  const factsheet = { ...(raw.factsheet ?? {}) }
  for (const [k, v] of Object.entries(factsheet)) {
    if (v) (factsheet as Record<string, unknown>)[k] = { ...emptyFact(), ...v }
  }
  const thread = emptyCoreThread()
  if (raw.coreThread) for (const k of CORE_THREAD_KEYS) thread[k] = str(raw.coreThread[k])

  return {
    id: raw.id,
    workspaceId: raw.workspaceId ?? null,
    clientId: raw.clientId,
    clientName: str(raw.clientName),
    moduleKey: 'patent_venture_mvp',
    title: str(raw.title),
    status: raw.status ?? 'active',
    currentStage: isStageKey(raw.currentStage) ? raw.currentStage : 'S0',
    stages,
    factsheet,
    coreThread: thread,
    gate: { items: {}, decision: null, reason: '', decidedAt: null, ...(raw.gate ?? {}) },
    freshness: Array.isArray(raw.freshness) ? raw.freshness : [],
    kipo: Array.isArray(raw.kipo) ? raw.kipo.map((s) => ({ code: str(s.code), reason: str(s.reason), pdfAttached: s.pdfAttached === true })) : [],
    patent: { ...emptyPatent(), ...(raw.patent ?? {}) },
    mvp: { ...emptyMvp(), ...(raw.mvp ?? {}) },
    venture: {
      ...emptyVenture(),
      ...(raw.venture ?? {}),
      sections: { ...emptyVenture().sections, ...(raw.venture?.sections ?? {}) },
      documents: { ...emptyVenture().documents, ...(raw.venture?.documents ?? {}) },
    },
    fieldReview: { ...emptyFieldReview(), ...(raw.fieldReview ?? {}) },
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

/** 프로젝트 행 payload — 컬럼으로 뺀 것을 제외한 나머지 */
export function projectPayload(p: ConsultingProject) {
  return {
    clientName: p.clientName,
    stages: p.stages,
    factsheet: p.factsheet,
    coreThread: p.coreThread,
    gate: p.gate,
    freshness: p.freshness,
    kipo: p.kipo,
    patent: p.patent,
    mvp: p.mvp,
    venture: p.venture,
    fieldReview: p.fieldReview,
  }
}

/** 진행도 — completed/skipped 단계 수 / 17 */
export function projectProgress(p: ConsultingProject): { done: number; total: number; percent: number } {
  const done = STAGE_ORDER.filter((k) => p.stages[k].status === 'completed' || p.stages[k].status === 'skipped').length
  return { done, total: STAGE_ORDER.length, percent: Math.round((done / STAGE_ORDER.length) * 100) }
}

/** 지금 막힌 단계들 */
export function blockedStages(p: ConsultingProject): StageKey[] {
  return STAGE_ORDER.filter((k) => p.stages[k].status === 'blocked')
}
