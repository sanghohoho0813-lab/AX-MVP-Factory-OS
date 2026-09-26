/**
 * 크레탑 ↔ 영업 다리 (D-119).
 *
 * 크레탑 분석 결과(ui) 한 개로
 *   ① 고객 기록의 빈 칸(사업자번호 · 대표 · 업종 · 직원 · 설립일 · 주소 …)을 채우고
 *   ② 영업 칸(잠재 고객 · 관심사 · 고민 · 대표 나이 · 매출 · 체크)을 만들고
 *   ③ 도구 결과(크레탑 분석)를 붙이고
 *   ④ 미팅 준비가 읽을 '추천 전략 26 순위 · 진단 요약' 을 짧게 남긴다.
 *
 * 크레탑의 규칙(진단 요약 · 전략 순위 · 질문)은 analysisCore.js 그대로 — 여기서는 옮겨 담기만 한다.
 * 이미 적힌 값은 덮어쓰지 않는다(사람이 고친 것이 우선). 순수 함수만 둔다(저장은 salesIntake).
 * 규칙 계산이다 — 외부 호출 없음.
 */

import type { ClientOpsRecord, SalesInfo, ToolResult } from '../types/clientOps'
import { emptySales } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'
import {
  CONSULTING_STRATEGIES,
  buildDiagnosisSummary,
  buildOneLiner,
  detailHasPositive,
  oneLinerText,
  rankStrategies,
  type CretopRanked,
  type CretopStrategy,
  type CretopTone,
} from '../tools/cretop/mini/analysisCore.js'
import { isCorpOnlyStrategy } from '../tools/cretop/mini/extract.js'
import { meetingDocs, meetingQuestionFlow, type MeetingFlowStep } from '../tools/cretop/mini/meetingFlow.js'
import type { CretopMiniUi } from '../tools/cretop/mini/MiniApp.jsx'

/* ------------------------------------------------------------------ */
/* 회사 정보                                                            */
/* ------------------------------------------------------------------ */

export interface CretopCompany {
  name: string
  bizNo: string
  corpRegNo: string
  ceo: string
  industry: string
  /** YYYY-MM-DD 로 맞춘 설립일 (못 읽으면 빈 글자) */
  established: string
  employees: number | null
  address: string
  creditGrade: string
  scale: string
  mainProduct: string
}

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

/** '2008-04-15' · '2008.4.15' · '2008년 4월' · '2008' → YYYY-MM-DD (모르는 칸은 01) */
export function normalizeEstablished(v: string): string {
  const m = /((?:19|20)\d{2})(?:[-./년\s]+(\d{1,2}))?(?:[-./월\s]+(\d{1,2}))?/.exec(v)
  if (!m) return ''
  const mm = Math.min(12, Math.max(1, Number(m[2] ?? 1)))
  const dd = Math.min(31, Math.max(1, Number(m[3] ?? 1)))
  return `${m[1]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function cretopCompany(ui: CretopMiniUi): CretopCompany {
  const co = (ui.companyInfo ?? {}) as Record<string, unknown>
  const grade = s(co.creditGrade)
  const emp = parseInt(s(co.employees).replace(/[^0-9]/g, ''), 10)
  return {
    name: s(co.companyName),
    bizNo: s(co.businessNo),
    corpRegNo: s(co.corpRegNo),
    ceo: s(co.ceoName),
    industry: s(co.standardIndustry) || s(co.industry),
    established: normalizeEstablished(s(co.established)),
    employees: Number.isFinite(emp) && emp > 0 ? emp : null,
    address: s(co.address),
    creditGrade: grade === '이미지 원문 확인 필요' ? '' : grade,
    scale: s(co.scale),
    mainProduct: s(co.mainProduct),
  }
}

/* ------------------------------------------------------------------ */
/* 추천 전략 — 크레탑 분석기 '제안' 탭과 같은 순위 · 등급                   */
/* ------------------------------------------------------------------ */

export type CretopTier = 'top' | 'rec' | 'cond' | 'low'

/** 크레탑 분석기 REC_TIERS 와 같은 문턱(80 · 60 · 40) · 같은 이름 */
export const CRETOP_TIER_LABEL: Record<CretopTier, string> = {
  top: '최우선 추천 검토',
  rec: '검토 권장',
  cond: '조건 확인 필요',
  low: '현재 가능성 낮음',
}

export function cretopTier(score: number): CretopTier {
  return score >= 80 ? 'top' : score >= 60 ? 'rec' : score >= 40 ? 'cond' : 'low'
}

/** 고객 기록에 남기는 짧은 순위 한 줄 — 이름으로 전략 원문(질문 흐름 · 멘트 …)을 다시 찾는다 */
export interface CretopPickRef {
  name: string
  score: number
  reasons: string[]
  held: boolean
}

export interface CretopPick extends CretopPickRef {
  cat: string
  tier: CretopTier
  strategy: CretopStrategy
  /** 대표에게 던질 질문 5단계(A 오프닝 · B 현황 · C 문제 인식 · D 제안 연결 · E 다음 액션) */
  flow: MeetingFlowStep[]
  docs: string[]
}

const STRATEGY_BY_NAME = new Map(CONSULTING_STRATEGIES.map((x) => [x.name, x]))

export function strategyByName(name: string): CretopStrategy | null {
  return STRATEGY_BY_NAME.get(name) ?? null
}

export function toPick(ref: CretopPickRef): CretopPick | null {
  const st = strategyByName(ref.name)
  if (!st) return null
  return { ...ref, cat: st.cat, tier: cretopTier(ref.score), strategy: st, flow: meetingQuestionFlow(st), docs: meetingDocs(st) }
}

/** 개인사업자면 법인 전용 전략은 뺀다(크레탑 분석기 제안 탭과 같다) */
export function rankedRefs(ui: CretopMiniUi): CretopPickRef[] {
  const personal = !!(ui.bizForm as { isPersonal?: boolean } | undefined)?.isPersonal
  return rankStrategies(ui)
    .filter((r: CretopRanked) => !(personal && isCorpOnlyStrategy(r.s.name)))
    .map((r) => ({ name: r.s.name, score: r.score, reasons: r.reasons.slice(0, 3), held: r.held }))
}

/**
 * 1차 미팅 질문 흐름을 차수에 나눠 싣는다 — 한 전략을 1차에 다 꺼내지 않게.
 *   1차: A 오프닝 · B 현황 확인 · C 문제 인식   2차: D 제안 연결   3차: E 다음 액션
 */
export const FLOW_ROUND: Record<MeetingFlowStep['step'], 1 | 2 | 3> = { A: 1, B: 1, C: 1, D: 2, E: 3 }

/* ------------------------------------------------------------------ */
/* 영업 칸으로 옮겨 담기                                                  */
/* ------------------------------------------------------------------ */

/** 크레탑 전략 이름 → 영업 관심사(SALES_INTERESTS 의 말) */
const STRATEGY_INTEREST: Record<string, string> = {
  정책자금: '정책자금',
  '차입금 구조개선': '정책자금',
  '부채비율 개선': '정책자금',
  '현금흐름 개선': '정책자금',
  고용지원금: '고용지원금',
  '청년채용 지원': '고용지원금',
  '기업부설연구소 / 연구개발전담부서': '연구소',
  '벤처기업 인증': '벤처인증',
  벤처투자유형: '벤처인증',
  '가지급금 정리': '가지급금',
  미처분이익잉여금: '미처분이익잉여금',
  이익소각: '미처분이익잉여금',
  '배당정책 정비': '미처분이익잉여금',
  '임원 퇴직금 재원': '임원퇴직금',
  '정관 정비': '정관정비',
  '주주구성 점검': '주식이동',
  '세액공제·세액감면 검토': '절세',
  가업승계: '가업승계',
  '상속·증여 설계': '가업승계',
  '사내(공동)근로복지기금': '사내근로복지기금',
}

export function interestOf(strategyName: string): string | null {
  return STRATEGY_INTEREST[strategyName] ?? null
}

export interface CretopDigest {
  company: CretopCompany
  diagnosis: { text: string; tone: CretopTone }[]
  refs: CretopPickRef[]
  /** 미팅에서 먼저 꺼낼 관심사 — 등급 '검토 권장' 이상 · 이미 보유 아님 · 위에서 5개 */
  interests: string[]
  /** 대표의 고민 한 줄 — 진단 요약에서 가장 급한 줄 */
  concern: string
  revenueM: number | null
  ceoAge: number | null
  flags: Record<string, boolean>
  isPersonal: boolean
}

function eokOf(ui: CretopMiniUi, key: string): number | null {
  const cp = (ui.corePreview ?? {}) as Record<string, { eok?: unknown } | undefined>
  const v = cp[key]?.eok
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function digestCretop(ui: CretopMiniUi): CretopDigest {
  const refs = rankedRefs(ui)
  const diagnosis = buildDiagnosisSummary(ui)
  const interests = [
    ...new Set(
      refs
        .filter((r) => r.score >= 60 && !r.held)
        .map((r) => interestOf(r.name))
        .filter((x): x is string => x !== null),
    ),
  ].slice(0, 5)
  const urgent = diagnosis.find((l) => l.tone === 'bad') ?? diagnosis.find((l) => l.tone === 'warn')
  const cert = (ui.certInfo ?? {}) as Record<string, string>
  const ip = (ui.ipInfo ?? {}) as Record<string, number | null>
  const flags: Record<string, boolean> = {}
  if (cert.rndLab === '인증' || cert.rndDept === '인증') flags.hasLab = true
  if (cert.venture === '인증') flags.venture = true
  if (typeof ip.patent === 'number' && ip.patent > 0) flags.patent = true
  if ((eokOf(ui, 'shortTermBorrowings') ?? 0) > 0 || (eokOf(ui, 'longTermBorrowings') ?? 0) > 0) flags.hasLoan = true
  if (detailHasPositive(ui, /가\s*지\s*급\s*금/)) flags.gajigeup = true
  if (detailHasPositive(ui, /가\s*수\s*금/)) flags.gasugeum = true
  const rev = eokOf(ui, 'revenue')
  const age = typeof ui.ceoAge === 'number' ? ui.ceoAge : null
  return {
    company: cretopCompany(ui),
    diagnosis,
    refs,
    interests,
    concern: urgent ? urgent.text : '',
    revenueM: rev !== null && rev > 0 ? Math.round(rev * 100) : null,
    ceoAge: age,
    flags,
    isPersonal: !!(ui.bizForm as { isPersonal?: boolean } | undefined)?.isPersonal,
  }
}

/* ------------------------------------------------------------------ */
/* 같은 업체 찾기                                                        */
/* ------------------------------------------------------------------ */

const digits = (v: string) => v.replace(/[^0-9]/g, '')

/** 회사 이름 비교용 — (주) · 주식회사 · 띄어쓰기를 뗀다 */
export function companyKey(name: string): string {
  return name
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 사업자번호가 같거나(10자리) 이름이 같은 업체 — 보관하지 않은 것을 먼저 */
export function findClientForCretop(records: ClientOpsRecord[], company: Pick<CretopCompany, 'name' | 'bizNo'>): ClientOpsRecord | null {
  const biz = digits(company.bizNo)
  const key = companyKey(company.name)
  const hit = (r: ClientOpsRecord) => (biz.length === 10 && digits(r.businessNumber) === biz) || (key !== '' && companyKey(r.companyName) === key)
  const live = records.filter((r) => r.archivedAt === null)
  return live.find(hit) ?? records.find(hit) ?? null
}

/* ------------------------------------------------------------------ */
/* 고객 기록에 채우기                                                    */
/* ------------------------------------------------------------------ */

export interface CretopApplyOptions {
  at?: string
  /** 새로 영업 칸을 만들 때의 유입 경로 */
  source?: string
}

/**
 * 크레탑 분석을 고객 기록에 옮겨 담는다.
 *  - 기본 정보: 빈 칸만 채운다(사람이 적은 값이 우선).
 *  - 영업 칸: 없으면 잠재 고객으로 만든다. 관심사는 합치고, 고민 · 대표 나이 · 매출은 비었을 때만.
 * 돌려주는 filled 는 채운 칸 이름(화면 안내 · 활동 기록용).
 */
export function applyCretopToClient(record: ClientOpsRecord, d: CretopDigest, opts: CretopApplyOptions = {}): { record: ClientOpsRecord; filled: string[] } {
  const at = opts.at ?? new Date().toISOString()
  const c = d.company
  const filled: string[] = []
  const next: ClientOpsRecord = { ...record }
  const fill = <K extends keyof ClientOpsRecord>(key: K, value: ClientOpsRecord[K], label: string) => {
    if (typeof value === 'string' && value.trim() === '') return
    if (typeof next[key] === 'string' && (next[key] as string).trim() !== '') return
    next[key] = value
    filled.push(label)
  }
  fill('businessNumber', c.bizNo, '사업자번호')
  fill('corporateNumber', c.corpRegNo, '법인번호')
  fill('representativeName', c.ceo, '대표자')
  fill('industry', c.industry, '업종')
  fill('businessItem', c.mainProduct, '주요 제품')
  fill('employeeCount', c.employees !== null ? `${c.employees}명` : '', '직원 수')
  fill('establishedAt', c.established, '설립일')
  fill('businessAddress', c.address, '주소')

  const base: SalesInfo = record.sales ?? { ...emptySales('lead', at), source: (opts.source ?? '').trim() }
  const sales: SalesInfo = {
    ...base,
    interests: [...new Set([...base.interests, ...d.interests])],
    concern: base.concern.trim() !== '' ? base.concern : d.concern,
    ceoAge: base.ceoAge ?? d.ceoAge ?? null,
    revenueM: base.revenueM ?? d.revenueM ?? null,
    flags: { ...d.flags, ...(base.flags ?? {}) },
  }
  if (sales.ceoAge === null) delete sales.ceoAge
  if (sales.revenueM === null) delete sales.revenueM
  if (Object.keys(sales.flags ?? {}).length === 0) delete sales.flags
  next.sales = sales

  let out = next
  if (!record.sales) out = withActivity(out, 'sales', `잠재고객 등록 · 크레탑${sales.source ? ` · ${sales.source}` : ''}`, null, at)
  if (filled.length > 0) out = withActivity(out, 'sales', `크레탑으로 기본 정보 채움 · ${filled.join(' · ')}`, null, at)
  return { record: out, filled }
}

/* ------------------------------------------------------------------ */
/* 도구 결과(크레탑 분석) — 크레탑 분석기 '업체 기록에 붙이기' 와 같은 모양    */
/* ------------------------------------------------------------------ */

export const CRETOP_RESULT_TITLE = '크레탑 분석'

/** 1장 요약 글 — 크레탑 분석기 결과 막대의 '1장 요약 복사' 와 같은 글 */
export function cretopSummaryText(ui: CretopMiniUi, selected: string[] = [], extraLines: string[] = []): string {
  return [
    oneLinerText(buildOneLiner(ui)),
    ...(selected.length ? ['', '■ 최종 선택 컨설팅 항목', ...selected.map((n, i) => `${i + 1}. ${n}`)] : []),
    ...(extraLines.length ? ['', ...extraLines] : []),
    '',
    '※ 크레탑 원문 기준 참고용 분석이며, 실제 상담 전 원문 확인이 필요합니다.',
  ].join('\n')
}

export interface CretopResultData {
  companyInfo: unknown
  corePreview: unknown
  oneLiner: ReturnType<typeof buildOneLiner>
  selected: string[]
  stockValue: unknown
  /** D-119: 26개 전략 순위(이름 · 점수 · 이유 · 보유) — 미팅 준비가 질문 흐름을 다시 꺼낸다 */
  ranked?: CretopPickRef[]
  /** D-119: 진단 요약(위험 · 주의 · 기회 · 참고) */
  diagnosis?: { text: string; tone: CretopTone }[]
}

export function cretopResultInput(
  ui: CretopMiniUi,
  selected: string[] = [],
  extra: { stockValue?: unknown; extraLines?: string[] } = {},
): Omit<ToolResult, 'id' | 'createdAt' | 'publishedUpdateId' | 'deadlines'> {
  const one = buildOneLiner(ui)
  const data: CretopResultData = {
    companyInfo: ui.companyInfo,
    corePreview: ui.corePreview,
    oneLiner: one,
    selected,
    stockValue: extra.stockValue ?? null,
    ranked: rankedRefs(ui),
    diagnosis: buildDiagnosisSummary(ui),
  }
  return {
    toolKey: 'cretop',
    title: CRETOP_RESULT_TITLE,
    verdict: null,
    verdictLabel: one.risks[0] ?? '',
    summary: cretopSummaryText(ui, selected, extra.extraLines ?? []),
    data,
  }
}

/* ------------------------------------------------------------------ */
/* 고객 기록에서 다시 꺼내기 — 미팅 준비 · 영업 흐름                        */
/* ------------------------------------------------------------------ */

export function latestCretopResult(record: Pick<ClientOpsRecord, 'toolResults'>): ToolResult | null {
  return record.toolResults.find((r) => r.toolKey === 'cretop') ?? null
}

export interface CretopForMeeting {
  at: string
  diagnosis: { text: string; tone: CretopTone }[]
  /** 크레탑 분석기에서 '최종 선택' 한 항목 — 있으면 이것부터 */
  selected: string[]
  picks: CretopPick[]
}

/** 붙여 둔 크레탑 결과 → 미팅 준비가 쓰는 모양. 예전(D-118 이전) 결과는 추천 5개 이름만 있어 순위 없이 싣는다 */
export function cretopForMeeting(record: Pick<ClientOpsRecord, 'toolResults'>): CretopForMeeting | null {
  const r = latestCretopResult(record)
  if (!r) return null
  const d = (r.data ?? {}) as Partial<CretopResultData>
  const selected = Array.isArray(d.selected) ? d.selected.filter((x): x is string => typeof x === 'string') : []
  let refs: CretopPickRef[] = Array.isArray(d.ranked) ? d.ranked : []
  if (refs.length === 0 && d.oneLiner && Array.isArray(d.oneLiner.strategies)) {
    refs = d.oneLiner.strategies.map((name, i) => ({ name, score: 70 - i, reasons: [], held: false }))
  }
  const picks = refs.map(toPick).filter((p): p is CretopPick => p !== null)
  const diagnosis = Array.isArray(d.diagnosis) ? d.diagnosis : (d.oneLiner?.risks ?? []).map((text) => ({ text, tone: 'warn' as CretopTone }))
  return { at: r.createdAt, diagnosis, selected, picks }
}

/** 미팅에서 꺼낼 전략 — 선택한 것이 있으면 그것, 없으면 '검토 권장' 이상 · 보유 아님 · 위에서 n개 */
export function meetingPicks(m: CretopForMeeting, n = 5): CretopPick[] {
  if (m.selected.length > 0) {
    const chosen = m.selected.map((name) => m.picks.find((p) => p.name === name) ?? toPick({ name, score: 0, reasons: [], held: false })).filter((p): p is CretopPick => p !== null)
    if (chosen.length > 0) return chosen
  }
  const good = m.picks.filter((p) => !p.held && p.score >= 60)
  return (good.length > 0 ? good : m.picks.filter((p) => !p.held)).slice(0, n)
}
