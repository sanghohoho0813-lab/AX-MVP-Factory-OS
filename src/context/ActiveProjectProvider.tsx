import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { organizationRepository, projectRepository } from '../repositories'
import { readRaw, writeRaw } from '../storage/localStore'
import { useStoreVersion } from '../lib/useStoreVersion'
import { ActiveProjectContext, type ActiveProjectValue } from './activeProject'

const ACTIVE_KEY = 'axmvp.ui.active_project'
const RECENT_KEY = 'axmvp.ui.recent_projects'
const RECENT_MAX = 5

function readActiveId(): string | null {
  return readRaw(ACTIVE_KEY)
}

function readRecentIds(): string[] {
  const raw = readRaw(RECENT_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 프로젝트 중심 정보구조의 핵심 — 현재 선택된 프로젝트를 앱 전역에 제공한다.
 * 선택 상태는 브라우저에 저장되어 새로고침 후에도 유지된다.
 * (도메인 데이터는 기존 동기 Repository 를 그대로 사용한다.)
 */
export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const version = useStoreVersion()
  const [activeId, setActiveId] = useState<string | null>(() => readActiveId())
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentIds())

  const setActiveProject = useCallback((projectId: string | null) => {
    if (projectId) {
      writeRaw(ACTIVE_KEY, projectId)
      setActiveId(projectId)
      setRecentIds((prev) => {
        const next = [projectId, ...prev.filter((id) => id !== projectId)].slice(0, RECENT_MAX)
        writeRaw(RECENT_KEY, JSON.stringify(next))
        return next
      })
    } else {
      writeRaw(ACTIVE_KEY, '')
      setActiveId(null)
    }
  }, [])

  const value = useMemo<ActiveProjectValue>(() => {
    // version 을 의존성에 포함해 저장 데이터 변경 시 재계산한다.
    void version
    const project = activeId ? projectRepository.getById(activeId) : null
    // 보관되었거나 삭제된 프로젝트는 선택 해제된 것처럼 취급
    const validProject = project && project.archivedAt === null ? project : null
    const organization = validProject ? organizationRepository.getById(validProject.organizationId) : null
    const recentProjects = recentIds
      .map((id) => projectRepository.getById(id))
      .filter((p): p is NonNullable<typeof p> => p !== null && p.archivedAt === null)
    return { project: validProject, organization, recentProjects, setActiveProject }
  }, [activeId, recentIds, version, setActiveProject])

  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
}
