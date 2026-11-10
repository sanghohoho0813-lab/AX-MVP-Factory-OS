/**
 * D-519 처음 시작 — 업체 0곳에서 첫 콘텐츠까지 어디까지 했나(UX-2).
 *
 * 처음 쓰는 사람은 '업체 등록 → 서류 → 맞춤 추천 · 할 일 → (마케팅) 첫 콘텐츠' 를 차례로 해 봐야 이 OS 가 무엇을 해 주는지 안다.
 * 예전에는 업체가 0곳일 때만 1 → 2 → 3 안내가 보였고, 첫 업체를 등록하면 사라져 다음에 무엇을 할지 알 수 없었다.
 * 이제 실제 기록으로 단계마다 했는지 보고, 다 하기 전까지 오늘 맨 위에 '다음: …' 한 줄 + 큰 단추 하나(📐 한 번 누르면 그 자리로).
 * 규칙 계산 — AI 아님. 따로 저장하는 진행 기록 없음(업체 · 서류 · 할 일 · 내 콘텐츠를 그대로 본다).
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { JournalEntry } from '../types/bridge'

export type FirstStepKey = 'client' | 'doc' | 'todo' | 'content'

export interface FirstStep {
  key: FirstStepKey
  title: string
  /** 한 줄 — 하면 무엇이 되는지 */
  note: string
  done: boolean
  /** 누르면 가는 곳 */
  href: string
  /** 큰 단추 글자 */
  action: string
}

/** 처음 단계가 가리킬 업체 — 보관하지 않은 업체 중 가장 최근에 등록한 곳 */
export function firstUseClient(clients: readonly ClientOpsRecord[]): ClientOpsRecord | null {
  const live = clients.filter((c) => c.archivedAt === null)
  if (!live.length) return null
  return [...live].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

const hasDoc = (c: ClientOpsRecord) => Object.values(c.documents ?? {}).some((d) => !!d && (d.received || !!d.fileName || !!d.storagePath))
/** 업체에 걸린 할 일(기한이 있거나 후속조치) */
const isClientTodo = (e: JournalEntry) => !!e.clientId && (e.entryType === 'follow_up' || !!e.dueDate)

export function firstUseSteps(input: { clients: readonly ClientOpsRecord[]; journal: readonly JournalEntry[]; ideas: number; marketing: boolean; /** D-563 전문 모듈이 없는 계정(외부 구독 고객) — 모듈을 약속하지 않는다 */ basic?: boolean }): FirstStep[] {
  const target = firstUseClient(input.clients)
  const at = (tab: string) => (target ? `/ops/clients/${encodeURIComponent(target.id)}?tab=${tab}` : '/ops/clients?new=1')
  const steps: FirstStep[] = [
    { key: 'client', title: '첫 업체 등록', note: '사업자등록증을 올리면 이름 · 번호 · 대표가 채워져요', done: !!target, href: '/ops/clients?new=1', action: '첫 업체 등록' },
    { key: 'doc', title: '서류 한 장 올리기', note: '대충 올려도 칸 · 회사 정보를 채워요', done: input.clients.some(hasDoc), href: at('docs'), action: '서류 올리기' },
    { key: 'todo', title: '맞춤 추천 보고 할 일 하나', note: input.basic ? '확인할 것 · 받을 서류를 보고 [할 일로] 한 번' : '맞는 모듈 · 받을 서류를 보고 [할 일로] 한 번', done: input.journal.some(isClientTodo), href: at('smart'), action: '맞춤 추천 보기' },
  ]
  if (input.marketing) steps.push({ key: 'content', title: '첫 콘텐츠', note: '이번 주 주제 하나로 글 · 대본을 한 번에', done: input.ideas > 0, href: '/marketing', action: '마케팅 열기' })
  return steps
}

/** 아직 안 한 첫 단계(차례대로) — 다 했으면 null */
export function firstUseNext(steps: readonly FirstStep[]): FirstStep | null {
  return steps.find((s) => !s.done) ?? null
}

/** 새로 시작한 계정 — 보관하지 않은 업체가 3곳 이하이고, 처음 등록한 지 30일 안 */
export function isNewAccount(clients: readonly ClientOpsRecord[], today: string): boolean {
  const live = clients.filter((c) => c.archivedAt === null)
  if (!live.length) return true
  if (live.length > 3) return false
  const first = live.map((c) => c.createdAt.slice(0, 10)).sort()[0]
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000
  return Number.isFinite(days) && days <= 30
}

/**
 * 오늘에 '처음 시작' 한 줄을 띄울까 — 업체 · 서류 · 할 일 중 안 한 것이 있으면 띄운다.
 * 마케팅 첫 콘텐츠만 남았으면 새로 시작한 계정(업체 3곳 이하 · 30일 안)일 때만 — 오래 써 온 계정이 마케팅을 안 쓴다고 매일 조르지 않게.
 */
export function firstUseVisible(steps: readonly FirstStep[], clients: readonly ClientOpsRecord[], today: string): boolean {
  if (!clients.some((c) => c.archivedAt === null)) return false
  const left = steps.filter((s) => !s.done)
  if (!left.length) return false
  if (left.some((s) => s.key !== 'content')) return true
  return isNewAccount(clients, today)
}

/** [닫기] — 이 기기에서 다시 안 보임(화면 편의 · 기기마다) */
export const FIRST_USE_CLOSED_KEY = 'axmvp.ui.firstuse.closed'
