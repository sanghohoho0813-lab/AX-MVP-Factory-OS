/**
 * 요금제 고른 것 저장 (D-127) — 결제는 없다. 대표가 고른 요금제 · 모듈만 적어 둔다.
 *
 * 저장: moduleData 의 `system` 상자, `plan` 갈래 한 줄 (로컬 ↔ 클라우드 그대로 · 모듈 잠금과 같은 상자).
 * 아직 고르지 않았으면 기본 요금제(DEFAULT_PLAN_KEY)를 돌려준다.
 */

import { listRows, saveRow } from './moduleData'
import { defaultSubscription, validateSelection, type Subscription } from './entitlements'

const MODULE = 'system'
const BUCKET = 'plan'

export async function loadSubscription(workspaceId: string | null): Promise<Subscription> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const r = rows[0]
  if (!r) return defaultSubscription()
  const planKey = typeof r.data.planKey === 'string' && r.data.planKey ? r.data.planKey : defaultSubscription().planKey
  const selectedModules = Array.isArray(r.data.selectedModules) ? r.data.selectedModules.filter((x): x is string => typeof x === 'string') : []
  return { planKey, selectedModules, updatedAt: r.updatedAt }
}

/** 요금제가 허락하는 만큼만 남겨 저장한다 */
export async function saveSubscription(workspaceId: string | null, planKey: string, picked: string[]): Promise<Subscription> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const { selected } = validateSelection(planKey, picked)
  const row = await saveRow(workspaceId, MODULE, BUCKET, { id: rows[0]?.id, clientId: '', data: { planKey, selectedModules: selected } })
  return { planKey, selectedModules: selected, updatedAt: row.updatedAt }
}
