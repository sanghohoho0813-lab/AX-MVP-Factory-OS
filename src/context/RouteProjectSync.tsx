/**
 * URL 의 :projectId 를 전역 활성 프로젝트로 동기화한다.
 * 모든 프로젝트 하위 화면(작업공간)에서 사이드바 작업공간·컨텍스트가 유지되게 한다.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveProject } from './activeProject'

// /projects/:id, /diagnosis/projects/:id/..., /selection/projects/:id 등에서 id 추출
const PROJECT_ID_RE = /\/projects\/([0-9a-fA-F-]{8,})/

export function RouteProjectSync() {
  const location = useLocation()
  const { project, setActiveProject } = useActiveProject()

  useEffect(() => {
    const match = PROJECT_ID_RE.exec(location.pathname)
    const id = match?.[1]
    if (id && id !== project?.id) {
      setActiveProject(id)
    }
  }, [location.pathname, project?.id, setActiveProject])

  return null
}
