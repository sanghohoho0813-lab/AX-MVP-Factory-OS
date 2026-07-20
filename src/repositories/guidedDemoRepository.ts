import {
  STORAGE_KEYS,
  notifyStoreChanged,
  readJson,
  writeJson,
} from '../storage/localStore'

/**
 * 시연(가이드 데모) 레코드 정리 전용 데이터 계층 유틸리티.
 *
 * 시연 서비스가 localStorage를 직접 다루지 않도록, 시연으로 식별된 레코드만
 * 안전하게 제거하는 책임을 데이터 계층에 둔다. 일반 사용자가 만든 고객사·
 * 프로젝트 자체는 건드리지 않으며, 지정된 시연 프로젝트의 파이프라인 산출물과
 * 시연 토큰으로 발급된 설문·응답만 정리한다.
 */

interface HasProjectId {
  projectId: string
}
interface DistributionLike {
  id: string
  projectId: string
  accessToken: string
}
interface ResponseLike {
  distributionId: string
}

function removeByProject(key: string, projectId: string): void {
  const list = readJson<HasProjectId[]>(key, [])
  if (!Array.isArray(list)) return
  const next = list.filter((r) => r.projectId !== projectId)
  if (next.length !== list.length) writeJson(key, next)
}

/** 시연 프로젝트의 진단~설계 파이프라인 산출물을 제거한다 */
function clearPipeline(projectId: string): void {
  removeByProject(STORAGE_KEYS.assessments, projectId)
  removeByProject(STORAGE_KEYS.analysisIssues, projectId)
  removeByProject(STORAGE_KEYS.interviewQuestions, projectId)
  removeByProject(STORAGE_KEYS.automationCandidates, projectId)
  removeByProject(STORAGE_KEYS.selectionDecisions, projectId)
  removeByProject(STORAGE_KEYS.selectionHandoffs, projectId)
  removeByProject(STORAGE_KEYS.mvpDesigns, projectId)
  removeByProject(STORAGE_KEYS.mvpDesignHandoffs, projectId)
}

/** 시연 토큰 접두어로 발급된 설문·응답만 제거한다 (일반 발급은 보존) */
function clearDemoSurveys(projectId: string, tokenPrefix: string): void {
  const dists = readJson<DistributionLike[]>(STORAGE_KEYS.surveyDistributions, [])
  if (!Array.isArray(dists)) return
  const demoIds = new Set(
    dists.filter((d) => d.projectId === projectId && d.accessToken.startsWith(tokenPrefix)).map((d) => d.id),
  )
  if (demoIds.size === 0) return
  writeJson(
    STORAGE_KEYS.surveyDistributions,
    dists.filter((d) => !demoIds.has(d.id)),
  )
  const resps = readJson<ResponseLike[]>(STORAGE_KEYS.surveyResponses, [])
  if (Array.isArray(resps)) {
    writeJson(
      STORAGE_KEYS.surveyResponses,
      resps.filter((r) => !demoIds.has(r.distributionId)),
    )
  }
}

export const guidedDemoRepository = {
  /** 시연 데이터 전체 초기화 (일반 데이터는 보존) */
  clearAll(projectId: string, tokenPrefix: string): void {
    clearDemoSurveys(projectId, tokenPrefix)
    clearPipeline(projectId)
    notifyStoreChanged()
  },
}
