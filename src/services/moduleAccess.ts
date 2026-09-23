/**
 * 모듈 잠금 — 잠김 · 체험 · 열림 (D-91).
 *
 * 모듈을 따로 파는 구조(월 구독)를 위한 자리다. **결제는 붙이지 않는다** —
 * 상태만 관리하고, 나중에 결제를 붙일 자리만 비워 둔다.
 *
 * 규칙
 *  - 잠긴 모듈도 **목차와 첫 화면(대시보드)은 보인다.** 팔려면 보여야 한다.
 *  - 잠긴 모듈의 다른 화면을 열면 "대표 승인이 필요합니다" 가 뜬다. 막지만 감추지는 않는다.
 *  - 기본(오늘·일정·고객 운영·서류함·업무 일기)은 잠금이 없다. 잠금은 모듈에만.
 *  - 상태는 대표만 바꾼다. 이 OS 는 지금 대표 한 사람이 쓰므로 설정에서 바로 바꾼다.
 *
 * 저장: moduleData 의 `system` 상자, `access` 갈래 (로컬 ↔ 클라우드 그대로).
 */

import { listRows, saveRow } from './moduleData'

export type ModuleAccessState = 'locked' | 'trial' | 'open'

export interface ModuleAccess {
  moduleKey: string
  state: ModuleAccessState
  /** 체험이 끝나는 날 YYYY-MM-DD (체험이 아니면 빈 글자) */
  trialEndsAt: string
  /** 마지막으로 바꾼 때 */
  updatedAt: string
}

const MODULE = 'system'
const BUCKET = 'access'

/** 체험 기간 (원본과 같은 2주) */
export const TRIAL_DAYS = 14

export function defaultAccess(moduleKey: string): ModuleAccess {
  return { moduleKey, state: 'open', trialEndsAt: '', updatedAt: '' }
}

/** 체험이 끝났는가 */
export function trialExpired(access: Pick<ModuleAccess, 'state' | 'trialEndsAt'>, today: string): boolean {
  if (access.state !== 'trial') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(access.trialEndsAt)) return false
  return access.trialEndsAt < today
}

/** 지금 쓸 수 있는가 (체험이 끝났으면 못 쓴다) */
export function canUse(access: Pick<ModuleAccess, 'state' | 'trialEndsAt'>, today: string): boolean {
  if (access.state === 'open') return true
  if (access.state === 'trial') return !trialExpired(access, today)
  return false
}

/** 체험이 며칠 남았나 (체험이 아니면 null) */
export function trialDaysLeft(access: Pick<ModuleAccess, 'state' | 'trialEndsAt'>, today: string): number | null {
  if (access.state !== 'trial' || !/^\d{4}-\d{2}-\d{2}$/.test(access.trialEndsAt)) return null
  const end = new Date(`${access.trialEndsAt}T00:00:00`).getTime()
  const now = new Date(`${today}T00:00:00`).getTime()
  return Math.round((end - now) / 86400000)
}

/** 화면에 적을 한 줄 */
export function accessLabel(access: Pick<ModuleAccess, 'state' | 'trialEndsAt'>, today: string): string {
  if (access.state === 'open') return '열림'
  if (access.state === 'trial') {
    const left = trialDaysLeft(access, today)
    if (left === null) return '체험'
    return left < 0 ? '체험 끝남' : `체험 ${left}일 남음`
  }
  return '잠김'
}

/** 체험 마지막 날 (오늘부터 TRIAL_DAYS 일) */
export function trialEndDate(today: string, days = TRIAL_DAYS): string {
  const d = new Date(`${today}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* 저장                                                                */
/* ------------------------------------------------------------------ */

export async function listAccess(workspaceId: string | null): Promise<Map<string, ModuleAccess>> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const map = new Map<string, ModuleAccess>()
  for (const r of rows) {
    const key = typeof r.data.moduleKey === 'string' ? r.data.moduleKey : ''
    if (!key) continue
    map.set(key, {
      moduleKey: key,
      state: (r.data.state === 'locked' || r.data.state === 'trial' ? r.data.state : 'open') as ModuleAccessState,
      trialEndsAt: typeof r.data.trialEndsAt === 'string' ? r.data.trialEndsAt : '',
      updatedAt: r.updatedAt,
    })
  }
  return map
}

export async function setAccess(
  workspaceId: string | null,
  moduleKey: string,
  state: ModuleAccessState,
  today: string,
): Promise<ModuleAccess> {
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  const cur = rows.find((r) => r.data.moduleKey === moduleKey)
  const trialEndsAt = state === 'trial' ? trialEndDate(today) : ''
  const row = await saveRow(workspaceId, MODULE, BUCKET, {
    id: cur?.id,
    clientId: '',
    data: { moduleKey, state, trialEndsAt },
  })
  return { moduleKey, state, trialEndsAt, updatedAt: row.updatedAt }
}
