/**
 * 영업 흐름 — 1차 미팅 준비부터 계약 뒤 관리까지 한 줄로 (D-119).
 *
 * 대표 지시: "1차 미팅부터 3차 미팅, 계약, 계약 이후 추가 업셀링 · 고객관리까지 하나로 이어져야 한다.
 * 계약 직전까지 보이지 않는 단계들이 많다. 컨설팅 작업실 기능도 1·2차 미팅 때 쓸 수 있다."
 *
 * 여기서 하는 것
 *  - 여섯 걸음(1차 준비 · 1차 미팅 · 2차·제안 · 3차·클로징 · 계약 · 계약 후)을 만들고,
 *    걸음마다 '보이지 않던 할 일' 을 이미 적힌 기록으로 자동 체크한다(크레탑 · 미팅 기록 · 제안 · 계약 준비 · 수금 …).
 *  - 계약 경로(현금 · 법인보험 · 종합 · 단계별)에 따라 몇 차에 계약하는지 안내한다.
 *  - 이 업체에 맞는 작업실 도구를 이유와 함께 고르고, 이 업체로 바로 열리게 한다(?client=).
 *    모듈 잠금(D-91)이 걸린 도구는 감추지 않고 '잠김' 으로 표시한다 — 나중에 모듈별 결제를 붙이는 자리.
 *
 * 순수 함수만 둔다. 규칙 계산이다 — 외부 호출 없음.
 */

import { localDateOf } from '../lib/appClock'
import type { ClientOpsRecord, SalesPath, SalesStage } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'
import { canUse, type ModuleAccess } from './moduleAccess'
import { cretopForMeeting, interestOf, latestCretopResult, meetingPicks } from './salesCretop'
import { deriveInterests } from './salesEngine'
import { isContractClient, salesStageOf } from './salesPipeline'
import { CONTRACT_CHECKLIST } from './salesProposal'

/* ------------------------------------------------------------------ */
/* 계약 경로                                                            */
/* ------------------------------------------------------------------ */

export const SALES_PATH_INFO: Record<SalesPath, { label: string; hint: string; skipClosing: boolean }> = {
  cash: { label: '현금 계약', hint: '1차 미팅 뒤 전화나 2차 미팅에서 계약하는 경우가 많습니다', skipClosing: true },
  insurance: { label: '법인보험', hint: '3차 · 4차 미팅에서 계약하는 경우가 많습니다', skipClosing: false },
  total: { label: '종합 컨설팅', hint: '처음부터 종합으로 — 3차 미팅 전후에 계약합니다', skipClosing: false },
  step: { label: '단계별', hint: '현금 서비스로 먼저 계약하고, 계약 뒤 종합 컨설팅으로 넓힙니다', skipClosing: true },
}

export function withSalesPath(record: ClientOpsRecord, path: SalesPath | null, at: string = new Date().toISOString()): ClientOpsRecord {
  const cur = record.sales?.path ?? null
  if (cur === path || !record.sales) return record
  const sales = { ...record.sales }
  if (path) sales.path = path
  else delete sales.path
  return withActivity({ ...record, sales }, 'sales', `계약 경로 · ${path ? SALES_PATH_INFO[path].label : '정하지 않음'}`, null, at)
}

/* ------------------------------------------------------------------ */
/* 작업실 도구                                                          */
/* ------------------------------------------------------------------ */

export interface JourneyTool {
  key: string
  label: string
  /** 이 업체로 바로 열리는 주소 */
  to: string
  /** 왜 이 도구인가 (관심사 · 크레탑 근거) */
  reason: string
  /** 이 업체에 결과를 붙인 적이 있다 */
  done: boolean
  /** 모듈 잠금 — 열어도 '대표 승인' 화면이 뜬다 */
  locked: boolean
}

interface ToolDef {
  key: string
  label: string
  path: (id: string) => string
  /** 모듈 잠금 키(toolRegistry key). 잠금이 없는 것은 null */
  accessKey: string | null
  /** 결과가 붙었는지 보는 도구 키 */
  resultKey: string | null
}

const TOOL: Record<string, ToolDef> = {
  cretop: { key: 'cretop', label: '크레탑 분석기', path: (id) => `/tools/cretop/analyze?client=${id}`, accessKey: 'cretop', resultKey: 'cretop' },
  'cretop-value': { key: 'cretop-value', label: '주식가치 (크레탑)', path: (id) => `/tools/cretop/analyze?client=${id}&view=value`, accessKey: 'cretop', resultKey: null },
  tax: { key: 'tax', label: '세금 계산기', path: (id) => `/tools/tax?client=${id}`, accessKey: null, resultKey: 'tax' },
  'startup-tax': { key: 'startup-tax', label: '창업감면 판정기', path: (id) => `/tools/startup-tax/judge?client=${id}`, accessKey: 'startup-tax', resultKey: 'startup-tax' },
  employment: { key: 'employment', label: '고용지원금 매니저', path: (id) => `/tools/employment/diagnosis?client=${id}`, accessKey: 'employment', resultKey: 'employment' },
  labcare: { key: 'labcare', label: '기업부설연구소 OS', path: (id) => `/tools/labcare/assessment?client=${id}`, accessKey: 'labcare', resultKey: 'labcare' },
  'policy-funding': { key: 'policy-funding', label: '정책자금 진단', path: (id) => `/tools/policy-funding/diagnosis?client=${id}`, accessKey: 'policy-funding', resultKey: 'policy-funding' },
  studio: { key: 'studio', label: '특허+벤처', path: (id) => `/ops/clients/${id}?tab=consulting`, accessKey: null, resultKey: null },
}

/** 관심사 → 도구 (앞에 있는 것이 먼저) */
const INTEREST_TOOLS: Record<string, string[]> = {
  정책자금: ['policy-funding'],
  고용지원금: ['employment'],
  연구소: ['labcare'],
  벤처인증: ['studio'],
  가지급금: ['tax'],
  임원퇴직금: ['tax'],
  법인세: ['tax'],
  종소세: ['tax'],
  절세: ['tax', 'startup-tax'],
  미처분이익잉여금: ['cretop-value', 'tax'],
  가업승계: ['cretop-value', 'tax'],
  주식이동: ['cretop-value', 'tax'],
}

function yearsSince(date: string, today: string): number | null {
  const y = Number(/^(\d{4})/.exec(date)?.[1] ?? NaN)
  const t = Number(today.slice(0, 4))
  return Number.isFinite(y) && Number.isFinite(t) ? t - y : null
}

export interface JourneyOptions {
  /** YYYY-MM-DD */
  today: string
  /** 모듈 잠금 상태(listAccess). 없으면 모두 열림으로 본다 */
  access?: Map<string, ModuleAccess>
}

/**
 * 이 업체에 맞는 작업실 도구 — 관심사(직접 고른 것 · 체크에서 나온 것 · 크레탑 추천)에서 고른다.
 * 크레탑 근거가 있으면 그 이유를 먼저 적는다.
 */
export function journeyTools(record: ClientOpsRecord, opts: JourneyOptions): JourneyTool[] {
  const s = record.sales
  const cretop = cretopForMeeting(record)
  const reasonOf = new Map<string, string>()
  const own = deriveInterests({ interests: s?.interests ?? [], flags: s?.flags ?? {} })
  for (const it of own) if (!reasonOf.has(it)) reasonOf.set(it, `관심사 · ${it}`)
  if (cretop) {
    for (const p of cretop.picks) {
      if (p.held || p.score < 60) continue
      const it = interestOf(p.name)
      // 순위가 높은 전략의 이유를 남긴다(같은 관심사로 묶이는 아래 순위가 덮지 않게)
      if (!it || reasonOf.get(it)?.startsWith('크레탑 · ')) continue
      const why = p.reasons.find((r) => !r.startsWith('이미 보유')) ?? p.name
      reasonOf.set(it, `크레탑 · ${p.name}${why && why !== p.name ? ` — ${why}` : ''}`)
    }
  }
  const age = yearsSince(record.establishedAt, opts.today)
  if (age !== null && age <= 7 && !reasonOf.has('절세')) reasonOf.set('절세', `업력 ${age}년 · 창업감면 대상일 수 있음`)

  const out: JourneyTool[] = []
  const seen = new Set<string>()
  const push = (key: string, reason: string) => {
    if (seen.has(key)) return
    const def = TOOL[key]
    if (!def) return
    seen.add(key)
    const access = def.accessKey ? opts.access?.get(def.accessKey) : undefined
    const done = def.resultKey ? record.toolResults.some((r) => r.toolKey === def.resultKey) : key === 'cretop-value' ? !!(latestCretopResult(record)?.data as { stockValue?: unknown } | undefined)?.stockValue : false
    out.push({ key, label: def.label, to: def.path(record.id), reason, done, locked: access ? !canUse(access, opts.today) : false })
  }
  for (const [interest, reason] of reasonOf) {
    for (const key of INTEREST_TOOLS[interest] ?? []) {
      if (key === 'startup-tax' && (age === null || age > 7)) continue
      push(key, reason)
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 여섯 걸음                                                            */
/* ------------------------------------------------------------------ */

export type JourneyStepKey = 'prep' | 'm1' | 'm2' | 'closing' | 'contract' | 'after'
export const JOURNEY_ORDER: JourneyStepKey[] = ['prep', 'm1', 'm2', 'closing', 'contract', 'after']

export const JOURNEY_LABEL: Record<JourneyStepKey, { label: string; hint: string }> = {
  prep: { label: '1차 미팅 준비', hint: '크레탑 · 질문 · 일정' },
  m1: { label: '1차 미팅', hint: '기록 · 요청 자료 · 다음 약속' },
  m2: { label: '2차 · 제안', hint: '제안서 · 견적 · 월납' },
  closing: { label: '3차 · 클로징', hint: '조건 조율 · 계약 준비' },
  contract: { label: '계약', hint: '계약 완료 · 수금 · 서류' },
  after: { label: '계약 후 관리', hint: '추가 제안 · 다시 연락' },
}

export interface JourneyTask {
  label: string
  done: boolean
  /** 누르면 가는 곳 (없으면 null) */
  to: string | null
  /** 한 줄 설명 (예: '7/10' · 요청 자료 이름) */
  note: string
  /** 아직 만들고 있는 기능 자리 (1차 미팅 체크리스트 AX) */
  soon?: boolean
}

export type JourneyState = 'done' | 'now' | 'next' | 'optional'

export interface JourneyStep {
  key: JourneyStepKey
  label: string
  hint: string
  state: JourneyState
  tasks: JourneyTask[]
  tools: JourneyTool[]
}

export interface Journey {
  path: SalesPath | null
  current: JourneyStepKey
  steps: JourneyStep[]
}

const STAGE_STEP: Record<SalesStage, number> = { lead: 0, m1sched: 0, m1done: 1, m2: 2, closing: 3, contracted: 4, hold: 0, lost: 0 }

/** 지금 몇 번째 걸음인가 — 보류 · 이탈은 거기까지 갔던 가장 먼 단계로 */
function currentIndex(record: ClientOpsRecord): number {
  const stage = salesStageOf(record)
  let idx = STAGE_STEP[stage]
  if (stage === 'hold' || stage === 'lost') {
    for (const h of record.sales?.history ?? []) if (h.to !== 'hold' && h.to !== 'lost') idx = Math.max(idx, STAGE_STEP[h.to])
  }
  if (stage === 'contracted' || (isContractClient(record) && idx < 4)) idx = record.fees.length > 0 ? 5 : 4
  return idx
}

const PROPOSAL_SENT = new Set(['견적 전달', '검토 중', '조건 조율', '계약 예정', '계약 완료'])

export function buildJourney(record: ClientOpsRecord, opts: JourneyOptions): Journey {
  const id = record.id
  const s = record.sales
  const meetings = s?.meetings ?? []
  const had = (round: 1 | 2 | 3) => meetings.some((m) => m.round === round)
  const cur = currentIndex(record)
  const path = s?.path ?? null
  const cretop = latestCretopResult(record)
  const tools = journeyTools(record, opts)
  const cretopTool = tools.find((t) => t.key === 'cretop')
  const cretopEntry: JourneyTool = cretopTool ?? {
    key: 'cretop',
    label: '크레탑 분석기',
    to: `/tools/cretop/analyze?client=${id}`,
    reason: '재무 · 신용 · 추천 전략을 미팅 전에',
    done: !!cretop,
    locked: (() => {
      const a = opts.access?.get('cretop')
      return a ? !canUse(a, opts.today) : false
    })(),
  }
  const others = tools.filter((t) => t.key !== 'cretop')
  const lastM1 = meetings.find((m) => m.round === 1)
  const prep = new Set(s?.contractPrep ?? [])
  const prepDone = CONTRACT_CHECKLIST.filter((x) => prep.has(x)).length
  const docsIn = Object.values(record.documents).filter((d) => d.received).length

  // 계약 뒤 추가 제안 — 크레탑 추천 가운데 제안에 아직 없는 것
  const proposed = (s?.proposal?.packages ?? []).join(' ')
  const cm = cretopForMeeting(record)
  const upsell = cm
    ? meetingPicks(cm, 6)
        .filter((p) => {
          const it = interestOf(p.name)
          return !(it && proposed.includes(it)) && !proposed.includes(p.name)
        })
        .slice(0, 3)
    : []

  const tasks: Record<JourneyStepKey, JourneyTask[]> = {
    prep: [
      {
        label: '크레탑 분석',
        done: !!cretop,
        // D-121: 1차 미팅 준비 = 크레탑 분석기 — 미팅 준비 1차 탭에서 바로 넣는다
        to: `/sales/meeting?client=${id}&round=1`,
        note: cretop ? `${localDateOf(cretop.createdAt)} 붙임` : '보고서를 넣으면 기본 정보 · 추천 전략이 채워집니다',
      },
      { label: '질문 · 전략 준비', done: cur >= 1 || meetings.length > 0, to: `/sales/meeting?client=${id}&round=1`, note: '크레탑 질문 흐름 · 영업 대본' },
      {
        label: '1차 미팅 날짜',
        done: cur >= 1 || salesStageOf(record) === 'm1sched',
        // D-120: 날짜는 카드 위 '다음 약속' 에서 바로 정한다(예전 링크는 날짜를 고칠 수 없는 업체 화면으로 갔다)
        to: null,
        note: record.nextActionDueDate && cur === 0 ? `${record.nextActionDueDate} · ${record.nextAction || '다음 할 일'}` : "'다음 약속' 에서 날짜를 정합니다",
      },
      { label: '1차 미팅 체크리스트 (AX)', done: false, to: '/sales/first-meeting', note: '준비 중 — 들어갈 자리', soon: true },
    ],
    m1: [
      { label: '1차 미팅 기록', done: had(1), to: `/sales/meeting?client=${id}&round=1`, note: lastM1 ? localDateOf(lastM1.at) : '' },
      { label: '요청 자료 받기', done: cur >= 2, to: `/ops/clients/${id}?tab=docs`, note: lastM1?.nextDocs.length ? lastM1.nextDocs.slice(0, 3).join(' · ') : `받은 서류 ${docsIn}` },
      { label: '다음 미팅 약속', done: cur >= 2, to: null, note: cur === 1 && record.nextActionDueDate ? record.nextActionDueDate : "'다음 약속' 에서 정합니다" },
    ],
    m2: [
      { label: '제안서', done: !!s?.proposal, to: `/sales/proposal?client=${id}`, note: s?.proposal ? `${s.proposal.packages.length}개 · ${s.proposal.status}` : '' },
      { label: '견적 · 월납', done: !!s?.proposal && (!!s.proposal.monthly || PROPOSAL_SENT.has(s.proposal.status)), to: `/sales/proposal?client=${id}`, note: '' },
      { label: '2차 미팅 기록', done: had(2), to: `/sales/meeting?client=${id}&round=2`, note: '' },
    ],
    closing: [
      { label: '계약 준비 체크', done: prepDone >= CONTRACT_CHECKLIST.length, to: `/sales/proposal?client=${id}`, note: `${prepDone}/${CONTRACT_CHECKLIST.length}` },
      { label: '3차 미팅 기록', done: had(3), to: `/sales/meeting?client=${id}&round=3`, note: '' },
    ],
    contract: [
      { label: '계약 완료로', done: cur >= 4, to: `/sales/proposal?client=${id}`, note: record.contract.signedAt ? `계약일 ${record.contract.signedAt}` : '' },
      { label: '수금 항목', done: record.fees.length > 0, to: `/ops/clients/${id}?tab=fees`, note: record.fees.length ? `${record.fees.length}건` : '' },
      { label: '계약 서류', done: docsIn > 0, to: `/ops/clients/${id}?tab=docs`, note: docsIn ? `받은 서류 ${docsIn}` : '' },
    ],
    after: upsell.length
      ? upsell.map((p) => ({ label: `추가 제안 · ${p.name}`, done: false, to: `/sales/proposal?client=${id}`, note: p.reasons[0] ?? '' }))
      : [{ label: '추가 제안 후보', done: false, to: `/sales/new?client=${id}`, note: cretop ? '크레탑 추천이 모두 제안에 들어가 있습니다' : '크레탑 분석을 붙이면 후보가 채워집니다' }],
  }

  const stepTools: Record<JourneyStepKey, JourneyTool[]> = {
    prep: [cretopEntry],
    m1: others,
    m2: others,
    closing: others.filter((t) => t.key === 'tax' || t.key === 'cretop-value'),
    contract: [],
    after: others.filter((t) => !t.done),
  }

  const skipClosing = path ? SALES_PATH_INFO[path].skipClosing : false
  const steps: JourneyStep[] = JOURNEY_ORDER.map((key, i) => {
    let state: JourneyState = i < cur ? 'done' : i === cur ? 'now' : 'next'
    if (key === 'closing' && skipClosing && i > cur) state = 'optional'
    return { key, ...JOURNEY_LABEL[key], state, tasks: tasks[key], tools: stepTools[key] }
  })
  return { path, current: JOURNEY_ORDER[cur], steps }
}
