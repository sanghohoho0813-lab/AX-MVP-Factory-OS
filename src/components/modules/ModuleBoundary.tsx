/**
 * 화면 하나를 통째로 맡는 기능이 잠겼을 때 (D-127) — 본문 대신 모듈 소개 한 장이 선다.
 *
 * 앱 틀(AppShell)이 한 번 감싼다. 각 화면은 요금제를 모른다.
 * 목차가 여러 칸인 도구(첫 화면은 보임)는 ModuleGate 가, 한 장짜리(다 보임)는 아무도 막지 않는다.
 */

import type { ReactNode } from 'react'
import { useEntitlements } from '../../lib/entitlementsStore'
import { featureForPath, featureLabel } from '../../config/featurePaths'
import { PageHeader } from '../ui/PageHeader'
import { LockedModuleCard } from './LockedModuleCard'

export function ModuleBoundary({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { ent } = useEntitlements()
  const f = featureForPath(pathname)
  const e = f ? ent.feature(f.key) : null
  if (!f || !e || f.lockedPreview !== 'intro' || e.usable) return <>{children}</>
  const label = featureLabel(f)
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={label} />
      <LockedModuleCard moduleKey={f.module} featureLabel={label} source={e.source} accessKey={e.source !== ent.module(f.module).source ? f.key : undefined} />
    </div>
  )
}
