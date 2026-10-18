/**
 * 도구 결과를 모듈(toolKey)마다 묶는다 (D-134).
 *
 * 업체 상세에서 결과가 쌓이면 같은 모듈의 옛 결과가 새 결과와 섞여 무엇이 지금 것인지 알기 어려웠다.
 * 모듈마다 가장 최근 것 하나를 앞에 두고, 나머지는 '지난 결과' 로 접는다. 순수 함수만 둔다.
 */
import type { ClientOpsRecord, ToolDeadline, ToolResult } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'

export interface ToolResultGroup {
  toolKey: string
  latest: ToolResult
  older: ToolResult[]
}

/** toolResults 는 최신이 앞 — 모듈이 처음 나온 순서(= 최근에 쓴 모듈 순)로 묶는다 */
export function toolResultGroups(results: ToolResult[]): ToolResultGroup[] {
  const map = new Map<string, ToolResultGroup>()
  for (const r of results) {
    const g = map.get(r.toolKey)
    if (g) g.older.push(r)
    else map.set(r.toolKey, { toolKey: r.toolKey, latest: r, older: [] })
  }
  return [...map.values()]
}

/** 모듈마다 가장 최근 결과 */
export function latestToolResult(record: Pick<ClientOpsRecord, 'toolResults'>, toolKey: string): ToolResult | null {
  return record.toolResults.find((r) => r.toolKey === toolKey) ?? null
}

/**
 * D-215: 고용지원금 '명부 진단' 결과(가장 최근) — 같은 도구의 회차 일정 · 입사일 결과가 더 최근이어도 명부 결과를 찾는다.
 * 예전: 가장 최근 고용지원금 결과만 보고 명부가 아니면 '명부를 올리면…' 으로 돌아가, 회차 일정 하나 붙이면 명부 판정 · 금액 · 기한 수가 사라졌다.
 */
export function latestEmploymentRoster(record: Pick<ClientOpsRecord, 'toolResults'>): ToolResult | null {
  return record.toolResults.find((r) => r.toolKey === 'employment' && (r.data as { tab?: string } | null)?.tab === 'roster') ?? null
}

/** 결과 한 건에 할 일 기한을 하나 더 건다 — 달력 · 오늘 화면에 뜬다(같은 날 · 같은 글이면 두 번 걸지 않는다) */
export function withToolResultDeadline(record: ClientOpsRecord, resultId: string, d: ToolDeadline): ClientOpsRecord {
  const target = record.toolResults.find((r) => r.id === resultId)
  if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !d.title.trim()) return record
  if (target.deadlines.some((x) => x.date === d.date && x.title === d.title.trim())) return record
  const item: ToolDeadline = { date: d.date, title: d.title.trim(), note: d.note, todo: true }
  return withActivity(
    { ...record, toolResults: record.toolResults.map((r) => (r.id === resultId ? { ...r, deadlines: [...r.deadlines, item] } : r)) },
    'tool',
    `할 일 · ${item.title} · ${item.date}`,
  )
}

/**
 * D-236: 모듈 기한 하나를 '했음' / '아직' 으로 — 홍보 글 '올렸어요' 를 누르면 그날 '홍보 글 올리기' 가
 * 오늘 화면에 30일 동안 '늦음' 으로 남았다. 같은 날 · 같은 제목인 기한만 바꾼다. 맞는 기한이 없으면 그대로 돌려준다.
 */
export function withToolDeadlineDone(record: ClientOpsRecord, toolKey: string, match: { date: string; title: string }, on: boolean): ClientOpsRecord {
  let hit = false
  const toolResults = record.toolResults.map((r) => {
    if (r.toolKey !== toolKey || !r.deadlines.some((d) => d.date === match.date && d.title === match.title && !!d.done !== on)) return r
    hit = true
    return {
      ...r,
      deadlines: r.deadlines.map((d) => {
        if (d.date !== match.date || d.title !== match.title) return d
        if (on) return { ...d, done: true as const }
        const { done: _done, ...rest } = d
        return rest
      }),
    }
  })
  return hit ? { ...record, toolResults } : record
}
