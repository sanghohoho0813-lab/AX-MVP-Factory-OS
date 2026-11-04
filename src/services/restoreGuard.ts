/**
 * D-530 백업 불러오기 안전장치(SAFE-1) — 다른 작업공간 자료가 섞이거나 옮겨지지 않게.
 *
 * 예전에는 [백업 불러오기] 가 파일의 업체를 같은 id 로 '지금 작업공간' 에 덮어 넣었다. 그 id 가 다른 작업공간(예: 대표가 함께 보는
 * 팀장 작업공간)에 이미 있으면 그 업체가 이 작업공간으로 **옮겨졌고**, '전부 바꾸기' 는 파일에 없는 지금 업체를 확인 없이 지웠다.
 * 이제 불러오기 전에 세 가지를 본다(규칙 — AI 아님 · 서버에 쓰지 않는다).
 *   1. 파일이 어느 작업공간에서 나왔나 — 내가 가진 다른 작업공간이면 막는다(그 작업공간을 고르고 불러오게).
 *      예전에 쓰던 작업공간이 지금 목록에 없으면(지워짐 · 나감) '더하기' 만 — '전부 바꾸기' 는 막는다.
 *   2. 파일의 업체 중 다른 작업공간에 이미 있는 것(서버가 알려 준 id)은 넣지 않는다 — 옮기지 않는다.
 *   3. '전부 바꾸기' 로 지워질 업체를 먼저 보여 주고 한 번 더 묻는다. 넣을 업체가 하나도 없으면 바꾸기를 막는다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { mergeBackup, type MergeMode, type MergeResult } from './clientOpsBackup'

export type RestoreSource = 'same' | 'unknown' | 'other-mine' | 'other-gone'

/**
 * 파일이 나온 작업공간 — 3판(D-521)은 `workspace.workspaceId`, 그 전 파일은 업체마다 적힌 작업공간이 하나로 같을 때만.
 * 이 브라우저에만 저장하던 때(로컬) 파일 · 작업공간이 섞인 파일은 null(모름).
 */
export function backupSourceWorkspace(text: string, clients: readonly ClientOpsRecord[]): string | null {
  try {
    const raw = JSON.parse(text) as { workspace?: { workspaceId?: unknown } }
    const ws = raw?.workspace?.workspaceId
    if (typeof ws === 'string' && ws.trim()) return ws.trim()
  } catch {
    // 파일 검사는 parseBackup 이 이미 했다 — 여기서는 모름으로
  }
  const seen = new Set(clients.map((c) => (c.workspaceId ?? '').trim()).filter(Boolean))
  return seen.size === 1 ? [...seen][0] : null
}

export function checkRestoreSource(input: { cloud: boolean; targetWs: string | null; sourceWs: string | null; myWorkspaceIds: readonly string[] }): RestoreSource {
  if (!input.cloud) return 'same'
  if (!input.sourceWs) return 'unknown'
  if (input.sourceWs === input.targetWs) return 'same'
  return input.myWorkspaceIds.includes(input.sourceWs) ? 'other-mine' : 'other-gone'
}

/** 쉬운 말 한 줄 — 막거나 알려야 할 때만(같은 작업공간 · 모름은 빈 글) */
export function restoreSourceLine(source: RestoreSource, sourceName?: string): string {
  if (source === 'other-mine') {
    return `이 파일은 다른 작업공간${sourceName ? `(${sourceName})` : ''}에서 내보낸 거예요 — 여기에 넣으면 두 작업공간 업체가 섞여요. 그 작업공간을 고른 뒤 불러와 주세요.`
  }
  if (source === 'other-gone') {
    return '지금은 열 수 없는 다른 작업공간에서 내보낸 파일이에요 — 이 작업공간에 업체를 더하기만 할 수 있어요(전부 바꾸기는 막았어요).'
  }
  return ''
}

/** 이 출처에서 어떤 불러오기를 허락하나 */
export function allowedModes(source: RestoreSource): { merge: boolean; replace: boolean } {
  if (source === 'other-mine') return { merge: false, replace: false }
  if (source === 'other-gone') return { merge: true, replace: false }
  return { merge: true, replace: true }
}

export interface RestorePlan {
  result: MergeResult
  /** 다른 작업공간에 이미 있어 넣지 않은 업체 */
  skipped: ClientOpsRecord[]
  /** '전부 바꾸기' 로 지금 목록에서 지워질 업체 */
  removed: ClientOpsRecord[]
  /** 막는 까닭(쉬운 말) — 있으면 아무것도 바꾸지 않는다 */
  blocked: string
}

/**
 * 불러오기 계획 — 순수 함수(시험이 직접 부른다).
 * foreignIds = 서버가 알려 준 '다른 작업공간에 있는 업체 id'. 그 업체는 넣지 않는다(옮기지 않는다).
 */
export function planRestore(input: {
  current: readonly ClientOpsRecord[]
  incoming: readonly ClientOpsRecord[]
  mode: MergeMode
  source: RestoreSource
  foreignIds: ReadonlySet<string>
}): RestorePlan {
  const allowed = allowedModes(input.source)
  const empty: MergeResult = { records: [...input.current], added: 0, updated: 0, kept: input.current.length }
  if (!allowed[input.mode]) {
    return { result: empty, skipped: [], removed: [], blocked: restoreSourceLine(input.source) || '이 파일은 이 방식으로 불러올 수 없어요.' }
  }
  const skipped = input.incoming.filter((c) => input.foreignIds.has(c.id))
  const usable = input.incoming.filter((c) => !input.foreignIds.has(c.id))
  if (input.mode === 'replace' && usable.length === 0) {
    return {
      result: empty,
      skipped,
      removed: [],
      blocked: skipped.length > 0 ? '넣을 수 있는 업체가 없어요 — 파일의 업체가 모두 다른 작업공간에 있어요. 지금 목록은 그대로 두었어요.' : '백업에 업체가 없어요 — 지금 목록은 그대로 두었어요.',
    }
  }
  const result = mergeBackup([...input.current], usable, input.mode)
  const keep = new Set(result.records.map((r) => r.id))
  const removed = input.mode === 'replace' ? input.current.filter((c) => !keep.has(c.id)) : []
  return { result, skipped, removed, blocked: '' }
}

/** 지워질 업체 이름 — 다섯 곳까지 이름, 나머지는 '외 n곳' */
export function removedNamesLine(removed: readonly ClientOpsRecord[], max = 5): string {
  const names = removed.slice(0, max).map((r) => r.companyName || '(이름 없음)')
  return removed.length > max ? `${names.join(' · ')} 외 ${removed.length - max}곳` : names.join(' · ')
}

/** 서버 오류(권한) 를 쉬운 말로 — 다른 작업공간 업체 id 가 섞여 서버가 막은 경우 */
export function restoreErrorLine(cause: unknown): string {
  const msg = cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String((cause as { message: unknown }).message) : ''
  const code = typeof cause === 'object' && cause && 'code' in cause ? String((cause as { code: unknown }).code) : ''
  if (code === '42501' || /row-level security|작업공간은 바꿀 수 없|workspace_id/i.test(msg)) {
    return '다른 작업공간에 있는 업체가 들어 있어 불러오지 않았어요 — 지금 목록은 그대로예요.'
  }
  return msg || '백업을 불러오지 못했습니다.'
}
