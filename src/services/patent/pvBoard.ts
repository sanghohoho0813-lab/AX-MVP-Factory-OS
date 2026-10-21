/**
 * D-249 특허 · 벤처 진행판 — 회사마다 '명세서 몇 단계 · 고칠 것 · 사업계획서 몇 칸' 과 다음 할 일 하나.
 *
 * 규칙 계산(AI 아님). 입력은 이미 저장된 것뿐: 명세서 초안(patent-draft/draft) · 기업인증 벤처 기록(cert-os/work, cert=venture 의 'vplan:' 칸).
 * 화면은 이 결과를 그리기만 한다 — 주소(href)도 여기서 정해 진행판 · 시험이 같은 길을 쓴다.
 */
import { VPLAN_FIELDS, checkPlan, planProgress, readPlan } from '../../certification/core/venturePlan'
import { checkDraft, draftProgress, normalizeDraft, type DraftStep } from './specDraft'

export const PV_HOME = '/patent-venture'
export const specHref = (draftId: string, clientId: string, step?: DraftStep) =>
  `${PV_HOME}/write?draft=${encodeURIComponent(draftId)}${clientId ? `&client=${encodeURIComponent(clientId)}` : ''}${step ? `&step=${step}` : ''}`
/** D-261 새로 만든 명세서 — 열자마자 AI 가 처음부터 끝까지(대표) */
export const specAutoHref = (draftId: string, clientId: string) => `${specHref(draftId, clientId)}&auto=1`
export const planHref = (clientId: string) => `${PV_HOME}/plan?client=${encodeURIComponent(clientId)}`

export const STEP_TITLE: Record<DraftStep, string> = { idea: '1 아이디어', parts: '2 구성요소 · 단계', figures: '3 도면', claims: '4 청구항', body: '5 본문', check: '6 점검 · 내보내기' }
const STEP_ORDER: readonly DraftStep[] = ['idea', 'parts', 'figures', 'claims', 'body', 'check']

export interface PvDraftInput {
  id: string
  clientId: string
  updatedAt: string
  draft: unknown
}

export interface PvPlanInput {
  clientId: string
  updatedAt: string
  notes: Record<string, string>
}

export interface PvSpecState {
  id: string
  title: string
  done: number
  total: number
  /** 첫 미완 단계(다 했으면 check) */
  step: DraftStep
  errors: number
  updatedAt: string
  sample: boolean
}

export interface PvPlanState {
  narrative: number
  narrativeTotal: number
  core: number
  coreTotal: number
  entered: number
  total: number
  warn: number
  complete: boolean
  hasPatent: boolean
}

export type PvStage = 'spec' | 'spec-fix' | 'send' | 'plan' | 'plan-fix' | 'enter' | 'done'

export interface PvBoardRow {
  /** 진행판 줄 키 — 회사면 회사 id, 회사 없는 명세서면 'draft:<id>' */
  key: string
  clientId: string
  companyName: string
  updatedAt: string
  spec: PvSpecState | null
  specCount: number
  plan: PvPlanState | null
  stage: PvStage
  next: { text: string; label: string; href: string }
  /** 단계 줄(명세서 → 점검 → 사업계획서) 칸마다 다 됐는지 */
  flow: { spec: boolean; check: boolean; plan: boolean }
}

const CORE_IDS = VPLAN_FIELDS.filter((f) => f.part === 'core').map((f) => f.id)

/** 벤처 기록 중 사업계획서를 손댄 것만(‘vplan:’ 칸이 하나라도 있으면) */
export function isPlanStarted(notes: Record<string, string> | null | undefined): boolean {
  return !!notes && Object.keys(notes).some((k) => k.startsWith('vplan:') && String(notes[k] ?? '').trim())
}

export function specStateOf(input: PvDraftInput): PvSpecState {
  const d = normalizeDraft(input.draft)
  const p = draftProgress(d)
  const step = STEP_ORDER.find((s) => !p.steps[s]) ?? 'check'
  return {
    id: input.id,
    title: d.title.trim(),
    done: p.done,
    total: p.total,
    step,
    errors: checkDraft(d).filter((i) => i.level === 'error').length,
    updatedAt: input.updatedAt,
    sample: d.source.startsWith('견본'),
  }
}

export function planStateOf(notes: Record<string, string>): PvPlanState {
  const s = readPlan(notes)
  const p = planProgress(s)
  return {
    narrative: p.narrativeFilled,
    narrativeTotal: p.narrativeTotal,
    core: CORE_IDS.filter((id) => (s.text[id] ?? '').trim()).length,
    coreTotal: CORE_IDS.length,
    entered: p.entered,
    total: p.total,
    warn: checkPlan(s).filter((i) => i.level === 'warn').length,
    complete: p.complete,
    hasPatent: !!s.materials.patent.trim(),
  }
}

/** 다음 할 일 하나 — 명세서가 먼저(특허 → 사업계획서 한 이야기), 회사가 없으면 명세서만 */
export function nextOf(clientId: string, spec: PvSpecState | null, plan: PvPlanState | null): { stage: PvStage; next: PvBoardRow['next'] } {
  if (spec && spec.done < spec.total && spec.step !== 'check') {
    return { stage: 'spec', next: { text: `명세서 ${spec.done}/${spec.total}단계 — 다음은 ${STEP_TITLE[spec.step]}`, label: '명세서 이어 쓰기', href: specHref(spec.id, clientId, spec.step) } }
  }
  if (spec && spec.errors > 0) {
    return { stage: 'spec-fix', next: { text: `명세서에 고쳐야 할 것 ${spec.errors}개`, label: '고칠 곳 보기', href: specHref(spec.id, clientId, 'check') } }
  }
  if (!clientId) {
    return spec
      ? { stage: 'send', next: { text: '명세서 다 됨 — 회사를 고르면 벤처 사업계획서 재료로 보낼 수 있어요', label: '회사 고르고 보내기', href: specHref(spec.id, '', 'check') } }
      : { stage: 'spec', next: { text: '명세서부터 쓰세요', label: '명세서 쓰기', href: `${PV_HOME}/write` } }
  }
  if (spec && (!plan || !plan.hasPatent)) {
    return { stage: 'send', next: { text: '명세서 다 됨 — 벤처 사업계획서 재료로 보내세요', label: '재료로 보내기', href: specHref(spec.id, clientId, 'check') } }
  }
  if (!plan) return { stage: 'plan', next: { text: '벤처 사업계획서를 시작하세요', label: '사업계획서 쓰기', href: planHref(clientId) } }
  if (!plan.complete) {
    return { stage: 'plan', next: { text: `사업계획서 서술 ${plan.narrative}/${plan.narrativeTotal} · 핵심 요약 ${plan.core}/${plan.coreTotal}`, label: '사업계획서 이어 쓰기', href: planHref(clientId) } }
  }
  if (plan.warn > 0) return { stage: 'plan-fix', next: { text: `사업계획서에 내기 전에 고칠 것 ${plan.warn}개`, label: '고칠 곳 보기', href: planHref(clientId) } }
  if (plan.entered < plan.total) return { stage: 'enter', next: { text: `다 썼어요 — 신청 사이트에 넣은 칸 ${plan.entered}/${plan.total}`, label: '사이트에 붙이기', href: planHref(clientId) } }
  return { stage: 'done', next: { text: '사업계획서까지 끝 — 제출은 신청 사이트에서 직접', label: '다시 보기', href: planHref(clientId) } }
}

/**
 * 진행판 줄 — 회사마다 한 줄(그 회사의 가장 최근 명세서 + 사업계획서). 회사 없는 명세서는 하나씩 따로.
 * 최근에 손댄 순.
 */
export function pvBoard(input: { drafts: readonly PvDraftInput[]; plans: readonly PvPlanInput[]; clients: readonly { id: string; companyName: string }[] }): PvBoardRow[] {
  const nameOf = (id: string) => input.clients.find((c) => c.id === id)?.companyName ?? ''
  const byClient = new Map<string, PvDraftInput[]>()
  const loose: PvDraftInput[] = []
  for (const d of input.drafts) {
    if (!d.clientId) loose.push(d)
    else byClient.set(d.clientId, [...(byClient.get(d.clientId) ?? []), d])
  }
  const plans = new Map<string, PvPlanInput>()
  for (const p of input.plans) {
    if (!p.clientId || !isPlanStarted(p.notes)) continue
    const cur = plans.get(p.clientId)
    if (!cur || p.updatedAt > cur.updatedAt) plans.set(p.clientId, p)
  }
  const rows: PvBoardRow[] = []
  for (const clientId of new Set([...byClient.keys(), ...plans.keys()])) {
    const list = [...(byClient.get(clientId) ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const spec = list[0] ? specStateOf(list[0]) : null
    const planIn = plans.get(clientId) ?? null
    const plan = planIn ? planStateOf(planIn.notes) : null
    const { stage, next } = nextOf(clientId, spec, plan)
    const updatedAt = [spec?.updatedAt ?? '', planIn?.updatedAt ?? ''].sort().pop() ?? ''
    rows.push({
      key: clientId,
      clientId,
      companyName: nameOf(clientId) || '(이름 없는 회사)',
      updatedAt,
      spec,
      specCount: list.length,
      plan,
      stage,
      next,
      flow: { spec: !!spec && spec.step === 'check', check: !!spec && spec.done === spec.total, plan: !!plan?.complete },
    })
  }
  for (const d of loose) {
    const spec = specStateOf(d)
    const { stage, next } = nextOf('', spec, null)
    rows.push({ key: `draft:${d.id}`, clientId: '', companyName: spec.sample ? '견본(연습용)' : '회사 고르지 않음', updatedAt: d.updatedAt, spec, specCount: 1, plan: null, stage, next, flow: { spec: spec.step === 'check', check: spec.done === spec.total, plan: false } })
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** 진행판 위 숫자 — 진행 중 · 명세서 다 됨 · 사업계획서 다 됨 */
export function pvSummary(rows: readonly PvBoardRow[]): { active: number; specDone: number; planDone: number } {
  return {
    active: rows.filter((r) => r.stage !== 'done').length,
    specDone: rows.filter((r) => r.flow.check).length,
    planDone: rows.filter((r) => r.flow.plan).length,
  }
}
