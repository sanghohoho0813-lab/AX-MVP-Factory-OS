/**
 * 영업 진행 단계 (D-91).
 *
 * 원본(기업컨설팅 세일즈 OS · App.jsx)의 15단계와 보드용 6단계를 글자 그대로 옮겼다.
 * 대표가 보는 것은 6단계이고, 15단계는 그 안에 들어간다.
 */

export type SalesStage =
  | 'lead'
  | 'contacted'
  | 'meeting_proposed'
  | 'meeting1_scheduled'
  | 'meeting1_done'
  | 'docs_requested'
  | 'docs_received'
  | 'meeting2_scheduled'
  | 'meeting2_done'
  | 'proposal_sent'
  | 'closing_scheduled'
  | 'decision_pending'
  | 'contracted'
  | 'hold'
  | 'lost'

export interface StageMeta {
  key: SalesStage
  label: string
}

/** 15단계 — 원본 순서 그대로 */
export const SALES_STAGES: readonly StageMeta[] = [
  { key: 'lead', label: '발굴대상' },
  { key: 'contacted', label: '첫 연락' },
  { key: 'meeting_proposed', label: '미팅제안' },
  { key: 'meeting1_scheduled', label: '1차예정' },
  { key: 'meeting1_done', label: '1차완료' },
  { key: 'docs_requested', label: '자료요청' },
  { key: 'docs_received', label: '자료수령' },
  { key: 'meeting2_scheduled', label: '2차예정' },
  { key: 'meeting2_done', label: '2차완료' },
  { key: 'proposal_sent', label: '제안발송' },
  { key: 'closing_scheduled', label: '클로징' },
  { key: 'decision_pending', label: '검토중' },
  { key: 'contracted', label: '계약완료' },
  { key: 'hold', label: '보류' },
  { key: 'lost', label: '이탈' },
]

export const STAGE_LABEL: Record<SalesStage, string> = SALES_STAGES.reduce(
  (acc, s) => {
    acc[s.key] = s.label
    return acc
  },
  {} as Record<SalesStage, string>,
)

export function isSalesStage(v: unknown): v is SalesStage {
  return typeof v === 'string' && SALES_STAGES.some((s) => s.key === v)
}

export function normalizeSalesStage(v: unknown): SalesStage {
  return isSalesStage(v) ? v : 'lead'
}

export interface PipeColumn {
  key: string
  label: string
  desc: string
  /** 이 칸으로 옮길 때 저장할 대표 단계 */
  set: SalesStage
  match: SalesStage[]
}

/** 보드 6단계 — 원본 PIPE6 그대로 */
export const PIPE6: readonly PipeColumn[] = [
  { key: 'lead', label: '잠재 고객', desc: '발굴·첫 연락 단계', set: 'lead', match: ['lead', 'contacted', 'meeting_proposed'] },
  { key: 'm1sched', label: '1차 미팅 예정', desc: '일정 조율·확정', set: 'meeting1_scheduled', match: ['meeting1_scheduled'] },
  { key: 'm1done', label: '1차 미팅 완료', desc: '자료 요청·수령·제안 준비', set: 'meeting1_done', match: ['meeting1_done', 'docs_requested', 'docs_received'] },
  { key: 'm2', label: '2차 미팅', desc: '제안서·견적 전달, 2차 진행', set: 'meeting2_scheduled', match: ['proposal_sent', 'meeting2_scheduled', 'meeting2_done'] },
  { key: 'closing', label: '3차 클로징', desc: '조건 조율·의사결정·청약 준비', set: 'closing_scheduled', match: ['closing_scheduled', 'decision_pending'] },
  { key: 'contracted', label: '계약 완료', desc: '계약 완료·관리 시작', set: 'contracted', match: ['contracted'] },
]

export const PIPE6_HOLD: PipeColumn = { key: 'hold', label: '보류·장기관리', desc: '다시 연락할 때까지', set: 'hold', match: ['hold', 'lost'] }

export const PIPE6_ALL: readonly PipeColumn[] = [...PIPE6, PIPE6_HOLD]

/** 15단계 → 보드 6(+보류) 칸 */
export function pipe6Of(stage: SalesStage): string {
  if (PIPE6_HOLD.match.includes(stage)) return 'hold'
  const col = PIPE6.find((p) => p.match.includes(stage))
  return col ? col.key : 'lead'
}

export interface FunnelRow {
  column: PipeColumn
  count: number
  /** 첫 칸 대비 남은 비율(%) */
  rate: number
}

/** 퍼널 — 잠재 고객부터 계약까지 몇 곳이 남았나 */
export function funnelOf(stages: readonly SalesStage[]): FunnelRow[] {
  const counts = new Map<string, number>()
  for (const s of stages) {
    const k = pipe6Of(s)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  // 퍼널은 '그 단계 이상까지 간 곳' 을 센다 — 뒤 칸부터 누적한다
  const keys = PIPE6.map((p) => p.key)
  const cumulative = new Map<string, number>()
  let acc = 0
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    acc += counts.get(keys[i]) ?? 0
    cumulative.set(keys[i], acc)
  }
  const top = cumulative.get(keys[0]) ?? 0
  return PIPE6.map((column) => {
    const count = cumulative.get(column.key) ?? 0
    return { column, count, rate: top > 0 ? Math.round((count / top) * 100) : 0 }
  })
}

/** 계약 전환율(%) — 보류·이탈을 뺀 진행 건 중 계약 완료 비율 */
export function conversionRate(stages: readonly SalesStage[]): number {
  const live = stages.filter((s) => !PIPE6_HOLD.match.includes(s))
  if (live.length === 0) return 0
  return Math.round((live.filter((s) => s === 'contracted').length / live.length) * 100)
}
