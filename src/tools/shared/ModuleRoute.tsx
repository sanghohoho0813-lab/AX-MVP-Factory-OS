/**
 * 모듈 주소 한 줄 (D-91).
 *
 * `/tools/<key>/<화면>` 에서 '<화면>' 을 읽어 2단 목차를 세우고,
 * 그 화면 키를 모듈 안쪽에 넘긴다. 모듈 화면은 `useModuleSection()` 하나만 보면 된다.
 *
 * 모르는 화면 키가 들어오면 그 모듈의 첫 화면을 보여 준다 — 주소를 손으로 고쳐도 빈 화면이 나지 않게.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { toolOf } from '../../config/toolRegistry'
import { ModuleShell } from './ModuleShell'
import { ModuleGate } from './ModuleGate'

const ModuleSectionContext = createContext<string>('')

/** 지금 보고 있는 모듈 화면 키 (목차가 없는 도구에서는 빈 글자) */
export function useModuleSection(): string {
  return useContext(ModuleSectionContext)
}

export function ModuleRoute({ toolKey, children }: { toolKey: string; children: ReactNode }) {
  const params = useParams()
  const tool = toolOf(toolKey)
  const sections = tool?.sections ?? []

  if (!tool || sections.length === 0) return <>{children}</>

  const asked = params.section ?? ''
  const section = sections.some((s) => s.key === asked) ? asked : sections[0].key

  return (
    <ModuleSectionContext.Provider value={section}>
      <ModuleShell tool={tool} section={section}>
        <ModuleGate tool={tool} section={section}>
          {children}
        </ModuleGate>
      </ModuleShell>
    </ModuleSectionContext.Provider>
  )
}
