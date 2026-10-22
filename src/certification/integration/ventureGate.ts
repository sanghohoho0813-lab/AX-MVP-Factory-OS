/**
 * D-263 벤처 사업계획서 — 요약을 쓰기 전에 반드시 거칠 세 가지(규칙 · AI 아님).
 *
 * 대표: "사업계획서 요약 단계에서 TAM SOM 등 시장조사 하고 나서 작성해야 돼서 반드시 그 단계를 밟고 나서,
 *        출원된 특허번호, 기술인력(연구개발전담부서 유무)까지 반드시 파악하고 난 뒤에 사업계획서 요약을 시작해야 해.
 *        아무리 간편하게 한다 해도. 특허번호나 기술인력 유무 같은 것만큼은 내가 직접 입력해도 되게."
 * 기준 문서(내부 기준 문서 23-1B): Venture Factsheet → 신청기술명 → 요약 → 7개 V 문장 → 수치 · 증빙 Gate → 본문 1~7번.
 *
 *  ① 시장조사 — TAM · SAM · SOM 세 숫자가 모두 있어야(검색 근거가 있는 AI 조사 · 대표가 고치거나 확인한 숫자 — 검색 근거 없는 AI 추정은 대표가 한 번 확인)
 *  ② 출원번호 — 직접 넣은 번호 · 이전 컨설팅 기록 · [1] 7 지식재산권 칸에서 찾은 번호, 또는 대표가 '아직 출원 전' 이라고 고른 것
 *  ③ 기술인력 — 연구개발 조직(기업부설연구소 · 연구개발전담부서 · … · 없음) + 연구개발 인원(0명도 답)
 * 저장은 기업인증 notes(vplan:mkt · vplan:patentNo · vplan:researchers · vplan:judge) — DB 변경 없음.
 */
import type { AssistAnswer, AssistRun } from '../../services/aiAssist/client'
import { readJudgeReport, type JudgeReport } from '../../services/aiAssist/judge'
import { RD_ORG_OPTIONS, VK, rowsOf, type VPlanFacts, type VPlanState } from '../core/venturePlan'

export const GK = {
  market: 'vplan:mkt',
  patentNo: 'vplan:patentNo',
  researchers: 'vplan:researchers',
  judge: 'vplan:judge',
} as const

/** 대표가 '아직 출원 전' 이라고 고른 값 */
export const PATENT_NONE = 'none'

export interface MarketFigure {
  /** 규모(예 "1조 2,000억 원") — 비면 아직 */
  amount: string
  /** 산식 · 근거 한 줄 */
  basis: string
  /** 출처(기관 · 자료명 · 연도) */
  source: string
  /** 기준연도 */
  year: string
}
export interface MarketResearch {
  tam: MarketFigure
  sam: MarketFigure
  som: MarketFigure
  cagr: MarketFigure
  customer: string
  price: string
  scope: string
  headline: string
  grounded: boolean
  sources: { title: string; url: string }[]
  at: string
  by: 'ai' | 'human'
}

export interface GateState {
  market: MarketResearch | null
  /** 직접 넣은 출원번호 · 'none'(출원 전) · '' */
  patentNo: string
  /** 직접 넣은 연구개발 인원('' = 안 넣음) */
  researchers: string
  judge: { sum: JudgeReport | null; full: JudgeReport | null }
}

const EMPTY_FIG: MarketFigure = { amount: '', basis: '', source: '', year: '' }
const str = (x: unknown) => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '')

function readFig(v: unknown): MarketFigure {
  if (!v || typeof v !== 'object') return { ...EMPTY_FIG }
  const o = v as Record<string, unknown>
  return { amount: str(o.amount).slice(0, 80), basis: str(o.basis).slice(0, 300), source: str(o.source).slice(0, 200), year: str(o.year).slice(0, 20) }
}

export function readMarket(raw: string | undefined): MarketResearch | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!o || typeof o !== 'object') return null
    const sources = Array.isArray(o.sources) ? o.sources.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map((x) => ({ title: str(x.title), url: str(x.url) })).filter((x) => /^https?:\/\//.test(x.url)).slice(0, 8) : []
    return { tam: readFig(o.tam), sam: readFig(o.sam), som: readFig(o.som), cagr: readFig(o.cagr), customer: str(o.customer).slice(0, 300), price: str(o.price).slice(0, 200), scope: str(o.scope).slice(0, 300), headline: str(o.headline).slice(0, 300), grounded: o.grounded === true, sources, at: str(o.at), by: o.by === 'human' ? 'human' : 'ai' }
  } catch {
    return null
  }
}

export function readGate(notes: Record<string, string>): GateState {
  let judge: GateState['judge'] = { sum: null, full: null }
  try {
    const j = JSON.parse(notes[GK.judge] ?? 'null') as Record<string, unknown> | null
    if (j && typeof j === 'object') judge = { sum: readJudgeReport(j.sum), full: readJudgeReport(j.full) }
  } catch {
    // 못 읽으면 판정 없음
  }
  return { market: readMarket(notes[GK.market]), patentNo: (notes[GK.patentNo] ?? '').trim(), researchers: (notes[GK.researchers] ?? '').trim(), judge }
}

/** 세 숫자(TAM · SAM · SOM)가 모두 있으면 시장조사를 밟은 것 */
export const marketDone = (m: MarketResearch | null | undefined): boolean => !!m && !!m.tam.amount.trim() && !!m.sam.amount.trim() && !!m.som.amount.trim()

/** 검색 근거 없이 AI 가 추정만 한 숫자 — 요약 전에 대표가 한 번 확인(또는 고침)해야 한다(자체점검 P0 'TAM/SAM/SOM 근거 부족' 을 미리 막음) */
export const marketNeedsConfirm = (m: MarketResearch | null | undefined): boolean => marketDone(m) && !!m && m.by === 'ai' && !m.grounded

/** 대표가 'AI 숫자 그대로 확인' — 대표 확인 숫자로 바꿔 둔다 */
export const marketConfirmed = (m: MarketResearch, at: string): MarketResearch => ({ ...m, by: 'human', at })

/* ------------------------------------------------------------------ */
/* 출원번호                                                              */
/* ------------------------------------------------------------------ */

/** "10-2025-0123456" · "1020250123456" · "10 2025 0123456" → 10-2025-0123456(특허 10 · 실용 20 · 디자인 30 · 상표 40). 아니면 '' */
export function normalizeAppNo(v: string): string {
  const t = String(v ?? '').trim()
  const m = /(?<!\d)([1-4]0)[\s.-]?(\d{4})[\s.-]?(\d{7})(?!\d)/.exec(t)
  if (!m) return ''
  const year = Number(m[2])
  if (year < 1990 || year > 2100) return ''
  return `${m[1]}-${m[2]}-${m[3]}`
}

export type PatentSource = 'direct' | 'none' | 'legacy' | 'ip_records' | ''
export const PATENT_SOURCE_LABEL: Record<PatentSource, string> = { direct: '직접 넣음', none: '아직 출원 전', legacy: '이전 컨설팅 기록', ip_records: '[1] 7 지식재산권 칸', '': '' }

/** 출원번호 — 직접 넣은 것 → '출원 전' 고름 → 이전 컨설팅 기록 → 지식재산권 칸 순서 */
export function patentNoOf(s: Pick<VPlanState, 'text'>, f: Pick<VPlanFacts, 'applicationNumber'>, g: Pick<GateState, 'patentNo'>): { value: string; source: PatentSource } {
  if (g.patentNo === PATENT_NONE) return { value: '', source: 'none' }
  const direct = normalizeAppNo(g.patentNo)
  if (direct) return { value: direct, source: 'direct' }
  const legacy = normalizeAppNo(f.applicationNumber ?? '')
  if (legacy) return { value: legacy, source: 'legacy' }
  for (const row of rowsOf(s.text.ip_records ?? '')) {
    const n = normalizeAppNo(row)
    if (n) return { value: n, source: 'ip_records' }
  }
  return { value: '', source: '' }
}

/* ------------------------------------------------------------------ */
/* 기술인력                                                              */
/* ------------------------------------------------------------------ */

/** 연구개발 조직 짧은 이름(사이트 선택지 → 화면 칩) */
export const RD_ORG_SHORT: Record<string, string> = {
  [RD_ORG_OPTIONS[0]]: '기업부설연구소',
  [RD_ORG_OPTIONS[1]]: '연구개발전담부서',
  [RD_ORG_OPTIONS[2]]: '기업부설창작연구소',
  [RD_ORG_OPTIONS[3]]: '기업창작전담부서',
  [RD_ORG_OPTIONS[4]]: '자체연구부서',
  [RD_ORG_OPTIONS[5]]: '없음',
}

export function rdOf(s: Pick<VPlanState, 'text'>, f: Pick<VPlanFacts, 'researchUnit' | 'researchers'>, g: Pick<GateState, 'researchers'>): { org: string; orgFrom: 'plan' | 'facts' | ''; staff: number | null; staffFrom: 'direct' | 'facts' | '' } {
  const chosen = (s.text.rd_org ?? '').trim()
  const fromFacts = f.researchUnit === 'lab' ? RD_ORG_OPTIONS[0] : f.researchUnit === 'dept' ? RD_ORG_OPTIONS[1] : f.researchUnit === 'none' ? RD_ORG_OPTIONS[5] : ''
  const org = chosen || fromFacts
  const typed = /^\d{1,4}$/.test(g.researchers) ? Number(g.researchers) : null
  const staff = typed ?? (typeof f.researchers === 'number' && f.researchers >= 0 ? f.researchers : null)
  return { org, orgFrom: chosen ? 'plan' : fromFacts ? 'facts' : '', staff, staffFrom: typed != null ? 'direct' : staff != null ? 'facts' : '' }
}

/* ------------------------------------------------------------------ */
/* 요약 전 관문                                                          */
/* ------------------------------------------------------------------ */

export interface SummaryGate {
  ok: boolean
  market: { ok: boolean; text: string }
  patent: { ok: boolean; value: string; source: PatentSource; text: string }
  rd: { ok: boolean; org: string; staff: number | null; text: string }
  /** 아직 모자란 것(화면 · AI 멈춤 말) */
  missing: string[]
}

export function summaryGate(s: Pick<VPlanState, 'text'>, f: VPlanFacts, g: GateState): SummaryGate {
  const mk = marketDone(g.market)
  const m = g.market
  const confirm = marketNeedsConfirm(m)
  const nums = m ? `TAM ${m.tam.amount} · SAM ${m.sam.amount} · SOM ${m.som.amount}` : ''
  const market = mk && m && !confirm
    ? { ok: true, text: `${nums}${m.grounded ? ` · 검색 근거 ${m.sources.length}곳` : ' · 대표 확인 숫자'}` }
    : { ok: false, text: confirm ? `${nums} — AI 추정(검색 근거 없음) · 맞으면 [이 숫자로 확인], 다르면 숫자 고치기` : m ? 'TAM · SAM · SOM 중 빈 숫자가 있습니다' : '아직 조사하지 않았습니다' }
  const p = patentNoOf(s, f, g)
  const patent = { ok: !!p.value || p.source === 'none', value: p.value, source: p.source, text: p.value ? `${p.value} · ${PATENT_SOURCE_LABEL[p.source]}` : p.source === 'none' ? '아직 출원 전(요약에 "출원 예정" 으로)' : '출원번호를 모릅니다' }
  const r = rdOf(s, f, g)
  const rdOk = !!r.org && r.staff != null
  const rd = { ok: rdOk, org: r.org, staff: r.staff, text: rdOk ? `${RD_ORG_SHORT[r.org] ?? r.org} · 연구개발 인원 ${r.staff}명` : !r.org && r.staff == null ? '연구개발 조직 · 인원을 모릅니다' : !r.org ? '연구개발 조직(전담부서 유무)을 모릅니다' : '연구개발 인원을 모릅니다' }
  const missing = [!market.ok ? (confirm ? '시장조사 숫자 확인' : '시장조사(TAM · SAM · SOM)') : '', !patent.ok ? '출원번호' : '', !rd.ok ? '기술인력(연구개발 조직 · 인원)' : ''].filter(Boolean)
  return { ok: missing.length === 0, market, patent, rd, missing }
}

/* ------------------------------------------------------------------ */
/* 저장 조각                                                             */
/* ------------------------------------------------------------------ */

export const marketPatch = (m: MarketResearch): Record<string, string> => ({ [GK.market]: JSON.stringify(m) })

/** 출원번호 저장 — 번호면 지식재산권 칸의 '(출원 뒤 입력)' 첫 자리도 그 번호로 */
export function patentPatch(s: Pick<VPlanState, 'text'>, value: string): Record<string, string> {
  if (value === PATENT_NONE) return { [GK.patentNo]: PATENT_NONE }
  const n = normalizeAppNo(value)
  if (!n) return {}
  const patch: Record<string, string> = { [GK.patentNo]: n }
  const ip = s.text.ip_records ?? ''
  if (ip.includes('(출원 뒤 입력)')) patch[VK.text('ip_records')] = ip.replace('(출원 뒤 입력)', n)
  return patch
}

export const researchersPatch = (n: number | null): Record<string, string> => ({ [GK.researchers]: n == null || !Number.isFinite(n) || n < 0 ? '' : String(Math.min(9999, Math.round(n))) })

export const judgePatch = (g: GateState, scope: 'sum' | 'full', r: JudgeReport): Record<string, string> => ({ [GK.judge]: JSON.stringify({ ...g.judge, [scope]: r }) })

/* ------------------------------------------------------------------ */
/* AI 답 → 시장조사                                                      */
/* ------------------------------------------------------------------ */

const KEY_WORDS: Record<string, keyof Pick<MarketResearch, 'tam' | 'sam' | 'som' | 'cagr' | 'customer' | 'price' | 'scope'>> = {
  tam: 'tam',
  전체시장: 'tam',
  sam: 'sam',
  유효시장: 'sam',
  som: 'som',
  수익시장: 'som',
  확보시장: 'som',
  cagr: 'cagr',
  성장률: 'cagr',
  연평균성장률: 'cagr',
  customer: 'customer',
  고객: 'customer',
  목표고객: 'customer',
  price: 'price',
  단가: 'price',
  가격: 'price',
  scope: 'scope',
  영업범위: 'scope',
}
const squash = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-:：·.()[\]]/g, '')

/** 시장조사 단추 답 → 시장조사(읽을 것이 하나도 없으면 null — 숫자만 비면 시장조사로 읽고 화면이 숫자를 묻는다). 이름표는 title · tag 어디에 있어도 */
export function marketOf(answer: AssistAnswer | null, run: Pick<AssistRun, 'grounded' | 'sources'> | null, at: string): MarketResearch | null {
  if (!answer) return null
  const m: MarketResearch = { tam: { ...EMPTY_FIG }, sam: { ...EMPTY_FIG }, som: { ...EMPTY_FIG }, cagr: { ...EMPTY_FIG }, customer: '', price: '', scope: '', headline: str(answer.headline).slice(0, 300), grounded: !!run?.grounded, sources: (run?.sources ?? []).filter((x) => /^https?:\/\//.test(x.url)).slice(0, 8), at, by: 'ai' }
  for (const it of answer.items ?? []) {
    const key = KEY_WORDS[squash(it.title)] ?? KEY_WORDS[squash(it.tag)]
    if (!key) continue
    if (key === 'customer' || key === 'price' || key === 'scope') {
      m[key] = (str(it.body) || str(it.detail) || str(it.amount)).trim().slice(0, 300)
      continue
    }
    const amount = str(it.amount).trim() || (/[\d조억만%]/.test(str(it.body)) && str(it.body).length <= 60 ? str(it.body).trim() : '')
    m[key] = { amount: /검색\s*근거\s*없음|확인\s*필요/.test(amount) ? '' : amount.slice(0, 80), basis: (str(it.detail) || str(it.body)).trim().slice(0, 300), source: str(it.tag).replace(/^(tam|sam|som|cagr)$/i, '').trim().slice(0, 200), year: str(it.when).trim().slice(0, 20) }
  }
  // 숫자가 없어도 산식 · 고객 · 단가를 적어 왔으면 읽은 것(대표가 숫자만 채우면 된다) — 아무것도 없을 때만 '못 읽음'
  const any = [m.tam, m.sam, m.som, m.cagr].some((f) => f.amount || f.basis) || !!(m.customer || m.price || m.scope)
  return any ? m : null
}

/** AI 에 보낼 시장조사 줄 */
export function marketRows(m: MarketResearch | null): { part: string; memo: string }[] {
  if (!m) return []
  const fig = (label: string, f: MarketFigure) => (f.amount || f.basis ? [{ part: label, memo: [f.amount && `규모 ${f.amount}`, f.year && `기준 ${f.year}`, f.basis && `산식 ${f.basis}`, f.source && `출처 ${f.source}`].filter(Boolean).join(' | ') }] : [])
  return [
    ...fig('TAM(전체 잠재시장)', m.tam),
    ...fig('SAM(접근 가능한 시장)', m.sam),
    ...fig('SOM(3년 안 확보 시장)', m.som),
    ...fig('연평균 성장률', m.cagr),
    ...(m.customer ? [{ part: '목표 고객', memo: m.customer }] : []),
    ...(m.price ? [{ part: '단가 · 과금', memo: m.price }] : []),
    ...(m.scope ? [{ part: '지금 영업 범위', memo: m.scope }] : []),
    { part: '근거', memo: m.by === 'human' ? '대표가 확인 · 고친 숫자' : m.grounded ? `검색 근거 ${m.sources.length}곳(${m.sources.map((s) => s.title).slice(0, 3).join(' · ')})` : 'AI 지식(검색 근거 없음 — 출처 확인 필요)' },
  ]
}
