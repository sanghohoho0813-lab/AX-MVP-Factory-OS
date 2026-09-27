/**
 * 잠긴 모듈 — 보여는 주되, 쓰려면 모듈이 열려 있어야 한다 (D-91 · D-127).
 *
 * 첫 화면은 잠겨 있어도 보인다. 팔려면 무엇이 들어 있는지 보여야 하기 때문이다.
 * 다른 화면을 열면 모듈 소개 한 장(LockedModuleCard)이 대신 선다 — 모든 모듈이 같은 모양이다.
 *
 * 쓸 수 있는지는 권한 계산(useEntitlements)에 묻는다. 이 파일은 요금제를 모른다.
 */

import type { ReactNode } from 'react'
import type { ToolDefinition } from '../../config/toolRegistry'
import { useEntitlements } from '../../lib/entitlementsStore'
import { LockedModuleCard } from '../../components/modules/LockedModuleCard'

export interface ModuleGateProps {
  tool: ToolDefinition
  /** 지금 보고 있는 화면 (첫 화면은 잠겨도 보인다) */
  section: string
  children: ReactNode
}

export function ModuleGate({ tool, section, children }: ModuleGateProps) {
  const { ent, ready } = useEntitlements()
  const e = ent.feature(tool.key)
  // 읽는 중에는 그대로 보여 준다 — 잠깐 잠겼다 열리는 깜빡임을 만들지 않는다
  if (!ready || e.usable || !e.moduleKey) return <>{children}</>

  // 이 도구만 따로 잠근 기록(D-91)이면 체험도 이 도구에 건다
  const own = e.source !== ent.module(e.moduleKey).source
  const card = { moduleKey: e.moduleKey, source: e.source, accessKey: own ? tool.key : undefined }
  const first = tool.sections?.[0]?.key ?? ''
  if (section === first || e.lockedPreview === 'full') {
    return (
      <>
        <LockedModuleCard {...card} compact />
        {children}
      </>
    )
  }
  return <LockedModuleCard {...card} featureLabel={`${tool.label}의 ‘${tool.sections?.find((s) => s.key === section)?.label ?? section}’`} />
}
