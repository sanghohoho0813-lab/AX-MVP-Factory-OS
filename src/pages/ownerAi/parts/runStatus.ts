/**
 * D-624 AI 전략실 — 작업마다 결과 상태(작업 목록 줄 · 결과 줄이 같은 말 · 같은 글자색).
 * 색은 글자에만: 검토 전 = 주황(해야 할 일) · 채택 = 초록 · 폐기 = 회색. 바탕은 칠하지 않는다.
 */
import { EVALUATION_LABEL, type AiRun, type Evaluation, type SkillId } from '../../../services/ownerAi/types'

export const EVAL_TEXT: Record<Evaluation, string> = {
  draft: 'text-warning-700',
  adopted: 'text-success-700',
  partially_adopted: 'text-success-700',
  rejected: 'text-slate-500',
}

/** 결과 목록에 보이는 실행 — 맞춤법 검사(제안서 스튜디오 안) · 이미 반영한 기억 정리는 뺀다(기록 · 사용량에는 남는다) */
export function listedRuns(runs: readonly AiRun[]): AiRun[] {
  return runs.filter((r) => r.skillId !== 'PROOFREAD' && (r.skillId !== 'CONTEXT_UPDATE' || r.evaluation === 'draft'))
}

/** 작업마다 결과(새것 먼저) */
export function runsBySkill(runs: readonly AiRun[]): Map<SkillId, AiRun[]> {
  const m = new Map<SkillId, AiRun[]>()
  for (const r of [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))) {
    const list = m.get(r.skillId)
    if (list) list.push(r)
    else m.set(r.skillId, [r])
  }
  return m
}

/** '검토 전 · 3개' 처럼 — 가장 최근 결과의 상태 + 결과 수 */
export function statusLabel(list: readonly AiRun[]): string {
  const latest = list[0]
  if (!latest) return ''
  const state = latest.status === 'pasted' && latest.evaluation === 'draft' ? '붙여넣음 · 검토 전' : EVALUATION_LABEL[latest.evaluation]
  return list.length > 1 ? `${state} · 결과 ${list.length}개` : state
}

/** 11/17 05:07 */
export function fmtShort(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
