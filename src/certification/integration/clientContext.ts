/**
 * MIRAE OS → 기업인증 Core 어댑터 (D-170).
 *
 * 업체 기록(사실 창고 · 서류함 · 회사 기본 정보 '인증서' 칸 · 진행 업무)을 읽어 `CertificationClientContext` 를 만든다.
 * 이미 있는 자료를 다시 묻지 않는다 — 기록에 없는 것만 컨설턴트가 칩으로 고른다(`CertProfile`, 모듈 기록에 업체별 저장).
 * 확인되지 않은 값은 null(모름) 로 둔다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { FACT_SOURCE_LABEL, readFact, usableFactValue } from '../../services/customerFacts'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { documentStatus } from '../../services/clientOpsAlerts'
import { RND_RANGE_LABEL, type LegacyVentureFacts, type BasisField, type BasisItem, type CertificationClientContext, type CertificationKey, type CompanySize, type EvidenceDoc, type HeldCertification, type ResearchUnit, type RndRange } from '../core/types'
import { BASIS_LABEL } from '../core/basis'
import { parseKsic } from '../rules/industryMap'
import type { CertLifecycle } from '../core/lifecycle'
import type { LabcareFacts } from './labcareAdapter'
import { CERT_RULES } from '../rules/officialRules'

/** 컨설턴트가 칩으로 고르는 업체 사정(기록에 없을 때만) — null = 모름 */
export interface CertProfile {
  b2b: boolean | null
  procurement: boolean | null
  exportPlan: boolean | null
  policyFundPlan: boolean | null
  rndPlan: boolean | null
  /** AX: 연구개발비 범위(칩) — 대표 금액으로 바꾸지 않는다 */
  rndRange: RndRange | null
  /** AX: 정확한 연구개발비(만원) — 재무제표 · 대표 확인으로 직접 적은 것만 */
  rndExactMan: number | null
  /** AX: 업종코드(KSIC 숫자 2~5자리) — 직접 적은 것 */
  ksic: string | null
  researchers: number | null
  researchUnit: ResearchUnit | null
  patents: number | null
  size: CompanySize | null
  /** 체납 · 회생 · 체불 · 산재 공표 같은 제외 사유가 있다 */
  exclusion: boolean | null
}

export const EMPTY_CERT_PROFILE: CertProfile = {
  b2b: null,
  procurement: null,
  exportPlan: null,
  policyFundPlan: null,
  rndPlan: null,
  rndRange: null,
  rndExactMan: null,
  ksic: null,
  researchers: null,
  researchUnit: null,
  patents: null,
  size: null,
  exclusion: null,
}

const RANGES: readonly RndRange[] = ['none', 'under_50m', '50m_100m', 'over_100m', 'unknown']

/** AX: 예전 칩(rndExpenseMan 0 · 3000 · 7000 · 15000 만원 — 범위의 '대표 금액')은 범위로만 옮긴다(정확한 금액이 아니었다) */
function rangeOf(r: Record<string, unknown>): RndRange | null {
  if (typeof r.rndRange === 'string' && (RANGES as readonly string[]).includes(r.rndRange)) return r.rndRange as RndRange
  const old = r.rndExpenseMan
  if (typeof old !== 'number' || !Number.isFinite(old) || old < 0) return null
  return old === 0 ? 'none' : old < 5000 ? 'under_50m' : old < 10000 ? '50m_100m' : 'over_100m'
}

export function normalizeCertProfile(raw: unknown): CertProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const b = (v: unknown) => (typeof v === 'boolean' ? v : null)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  return {
    b2b: b(r.b2b),
    procurement: b(r.procurement),
    exportPlan: b(r.exportPlan),
    policyFundPlan: b(r.policyFundPlan),
    rndPlan: b(r.rndPlan),
    rndRange: rangeOf(r),
    rndExactMan: n(r.rndExactMan),
    ksic: typeof r.ksic === 'string' && /^\d{2,5}$/.test(r.ksic) ? r.ksic : null,
    researchers: n(r.researchers),
    researchUnit: r.researchUnit === 'lab' || r.researchUnit === 'dept' || r.researchUnit === 'none' ? r.researchUnit : null,
    patents: n(r.patents),
    size: r.size === 'small' || r.size === 'medium' || r.size === 'mid_large' || r.size === 'large' ? r.size : null,
    exclusion: b(r.exclusion),
  }
}

/* ------------------------------------------------------------------ */
/* 인증 이름 → 키                                                         */
/* ------------------------------------------------------------------ */

const CERT_WORDS: [CertificationKey, RegExp][] = [
  ['venture', /벤처기업|벤처\s*확인|벤처인증/],
  ['innobiz', /이노비즈|inno-?biz|기술혁신형/i],
  ['mainbiz', /메인비즈|main-?biz|경영혁신형/i],
  ['lab', /기업부설연구소/],
  ['iso9001', /ISO\s*9001/i],
  ['iso14001', /ISO\s*14001/i],
  ['iso45001', /ISO\s*45001/i],
]

export function certKeyOf(text: string): CertificationKey | null {
  for (const [k, re] of CERT_WORDS) if (re.test(text)) return k
  return null
}

function validUntilOf(text: string): string {
  const m = /(20\d{2})[-.년\s]+(\d{1,2})[-.월\s]+(\d{1,2})\s*일?\s*(?:까지|만료)/.exec(text) ?? /~\s*(20\d{2})[-.](\d{1,2})[-.](\d{1,2})/.exec(text)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''
}

export function heldCertifications(record: ClientOpsRecord): HeldCertification[] {
  const out = new Map<CertificationKey, HeldCertification>()
  // 회사 기본 정보 '인증서' 칸(서류에서 읽어 확인한 것) — 유효기간이 같이 있다
  for (const f of record.customFields ?? []) {
    if (f.group !== 'credential') continue
    const k = certKeyOf(f.label) ?? certKeyOf(f.value)
    if (k) out.set(k, { key: k, validUntil: validUntilOf(f.value), note: f.value.slice(0, 80) })
  }
  // 사실 창고 '보유 인증' · '연구소'(글) — 기간은 모른다
  const certText = usableFactValue(record, 'certifications')
  for (const part of certText.split(/[,·/\n]/)) {
    const k = certKeyOf(part)
    if (k && !out.has(k)) out.set(k, { key: k, validUntil: validUntilOf(part), note: part.trim().slice(0, 80) })
  }
  return [...out.values()]
}

function researchUnitOf(record: ClientOpsRecord, held: HeldCertification[]): ResearchUnit | null {
  const lab = usableFactValue(record, 'researchLab')
  const cred = (record.customFields ?? []).filter((f) => f.group === 'credential').map((f) => f.label).join(' ')
  if (held.some((h) => h.key === 'lab') || /기업부설연구소/.test(`${lab} ${cred}`)) return 'lab'
  if (/전담부서/.test(`${lab} ${cred}`)) return 'dept'
  if (/없음|없다|미보유/.test(lab)) return 'none'
  return null
}

function patentsOf(record: ClientOpsRecord): number | null {
  const t = usableFactValue(record, 'patents')
  const credPatents = (record.customFields ?? []).filter((f) => f.group === 'credential' && /특허/.test(f.label)).length
  if (!t) return credPatents > 0 ? credPatents : null
  if (/없음|0\s*건/.test(t)) return credPatents
  const n = /(\d+)\s*건/.exec(t)
  return Math.max(n ? Number(n[1]) : t.split(/[,·/\n]/).filter((x) => x.trim()).length, credPatents)
}

/* ------------------------------------------------------------------ */
/* 증빙 ↔ 서류함                                                          */
/* ------------------------------------------------------------------ */

/** Core 증빙 id → 서류함 기본 칸 키 · 직접 만든 칸 이름 낱말 */
const EVIDENCE_MAP: Record<string, { keys?: string[]; label?: RegExp }> = {
  fin3: { keys: ['financialStatements'], label: /재무제표|재무상태표|손익계산서/ },
  biz_reg: { keys: ['businessRegistration'] },
  lab_cert: { label: /연구소\s*인정|전담부서\s*인정|연구개발전담부서/ },
  patent: { label: /특허|실용신안|지식재산|상표/ },
  rnd_records: { label: /연구\s*노트|연구개발\s*(과제|계획|보고)|과제\s*보고/ },
  org_chart: { label: /조직도|인력\s*현황/ },
  biz_plan: { label: /사업\s*계획|기술사업계획/ },
  quality: { label: /품질|ISO|공정도/i },
  vision: { label: /사업\s*계획|경영\s*(목표|계획)/ },
  kpi: { label: /회의록|실적|성과\s*관리|KPI/i },
  hr_rules: { label: /취업\s*규칙|인사\s*규정|교육\s*(계획|기록)/ },
  esg: { label: /사회\s*공헌|윤리|ESG|안전\s*보건/i },
  customer: { label: /고객\s*(만족|불만)|품질\s*개선|클레임/ },
  researchers: { label: /연구원|연구전담요원|학력|경력\s*증명/ },
  lab_space: { label: /도면|연구\s*공간|배치도/ },
  env: { label: /환경|배출/ },
  safety: { label: /안전|위험성\s*평가/ },
}

export function evidenceOf(record: ClientOpsRecord, today: string): EvidenceDoc[] {
  const metas = allDocumentMetas(record)
  const ids = new Set(Object.values(CERT_RULES).flatMap((r) => r.evidence.map((e) => e.id)))
  const out: EvidenceDoc[] = []
  for (const id of ids) {
    const map = EVIDENCE_MAP[id] ?? {}
    const label = Object.values(CERT_RULES).flatMap((r) => r.evidence).find((e) => e.id === id)?.label ?? id
    let have = false
    let stale = false
    for (const m of metas) {
      const hit = (map.keys ?? []).includes(m.key) || (map.label ? map.label.test(m.label) : false)
      if (!hit) continue
      const st = record.documents?.[m.key]
      if (!st?.received) continue
      const view = documentStatus(m.key, st, today, m)
      have = true
      if (!view.usable) stale = true
      else stale = false
      if (view.usable) break
    }
    // 서류가 없어도 인증서 칸에 확인된 것이 있으면(연구소 인정 · 특허 · ISO) 증빙으로 본다
    if (!have && (id === 'lab_cert' || id === 'patent' || id === 'quality')) {
      const re = id === 'lab_cert' ? /연구소|전담부서/ : id === 'patent' ? /특허/ : /ISO/i
      if ((record.customFields ?? []).some((f) => f.group === 'credential' && re.test(f.label))) have = true
    }
    out.push({ id, label, have, ...(stale ? { stale } : {}) })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 업종 대분류                                                            */
/* ------------------------------------------------------------------ */

export function industryGroupOf(text: string): CertificationClientContext['industryGroup'] {
  const t = text.replace(/\s+/g, '')
  if (!t) return ''
  if (/소프트웨어|SW|정보통신|IT|플랫폼|앱|시스템통합|데이터/i.test(t)) return 'software'
  if (/농업|영농|재배|축산|원예|작물|농산물생산/.test(t)) return 'agriculture'
  if (/바이오|의약|제약|의료기기/.test(t)) return 'bio'
  if (/환경|폐기물|재활용|수처리/.test(t)) return 'environment'
  if (/디자인/.test(t)) return 'design'
  if (/식품|음식료|제과|음료/.test(t)) return 'food'
  if (/제조|생산|가공|금속|기계|전자|부품|화학|플라스틱|섬유/.test(t)) return 'manufacturing'
  if (/건설|공사|인테리어|토목|전기공사/.test(t)) return 'construction'
  if (/도매|소매|유통|판매|쇼핑몰|무역/.test(t)) return 'retail'
  if (/서비스|컨설팅|교육|광고|마케팅|여행|운송|물류|임대/.test(t)) return 'service'
  return 'other'
}

/* ------------------------------------------------------------------ */
/* 만들기                                                                 */
/* ------------------------------------------------------------------ */

/** 진행 중인 업무 상태 — 시작했으면 그 계획이 있다고 본다 */
const ACTIVE_SERVICE = new Set<string>(['in_progress', 'waiting_client', 'done'])

/** P1: 다른 모듈 · 진행 기록에서 이미 아는 것 */
export interface CertExtra {
  /** 연구소 관리(labcare) 기록 */
  lab?: LabcareFacts | null
  /** 기업인증 진행 기록(인증 완료 · 유효기간) */
  lives?: readonly CertLifecycle[]
  /** AX Hotfix(LEGACY): 예전 '특허+벤처' 컨설팅 프로젝트 기록 — 읽기만 */
  legacy?: LegacyVentureFacts | null
}

/** 진행 기록에서 '인증 완료 · 갱신 준비' 인 것 → 보유 인증(사람이 적은 날짜만) */
function heldFromLives(lives: readonly CertLifecycle[]): HeldCertification[] {
  return lives
    .filter((l) => l.status === 'certified' || l.status === 'renewal')
    .map((l) => ({ key: l.cert, validUntil: l.validUntil, note: [l.number && `번호 ${l.number}`, l.certifiedAt && `인증일 ${l.certifiedAt}`].filter(Boolean).join(' · ') }))
}

const UNIT_LABEL: Record<ResearchUnit, string> = { lab: '기업부설연구소', dept: '연구개발전담부서', none: '없음' }
const unitOfText = (t: string): ResearchUnit | null => (/기업부설연구소|연구소/.test(t) && !/없음|없다|미보유/.test(t) ? 'lab' : /전담부서/.test(t) ? 'dept' : /없음|없다|미보유/.test(t) ? 'none' : null)
/** 서류 · 인증서에서 온 사실(1순위) — 직접 적음 · 상담 메모는 '사람이 확인한 사실'(3순위) */
const DOC_SOURCES = new Set(['businessRegistration', 'corporateRegistry', 'cretop', 'financialStatements', 'payrollRoster', 'certificate'])
export const CONFLICT_LINE = '기존 입력값과 현재 확인된 정보가 달라 최신 확인정보를 사용합니다.'

/**
 * AX 사실 우선순위(SSOT) — 공식 서류 사실 > 전문 모듈 기록(연구소 관리 · 특허 · 인증 완료) > 사람이 확인한 사실 > 컨설턴트 칩 > 추정.
 * 확인된 값이 있으면 칩이 이기지 못한다. 서로 다르면 conflicts 에 남겨 화면이 알려 준다.
 */
interface Resolved<T> {
  value: T | null
  item: BasisItem | null
  conflict?: string
}

function resolveUnit(record: ClientOpsRecord, p: CertProfile, extra: CertExtra, held: HeldCertification[]): Resolved<ResearchUnit> {
  const fact = readFact(record, 'researchLab')
  const factUnit = fact && fact.status === 'confirmed' ? unitOfText(fact.value) : null
  const factItem2 = factUnit ? factItem(record, 'researchLab', 'researchUnit', UNIT_LABEL[factUnit]) : null
  const credLab = held.some((h) => h.key === 'lab' && !/연구소 관리 기록/.test(h.note))
  const credentialText = (record.customFields ?? []).filter((f) => f.group === 'credential').map((f) => f.label).join(' ')
  const credUnit: ResearchUnit | null = credLab || /기업부설연구소/.test(credentialText) ? 'lab' : /전담부서/.test(credentialText) ? 'dept' : null
  const ranked: Resolved<ResearchUnit>[] = []
  if (factUnit && fact && DOC_SOURCES.has(fact.source ?? '')) ranked.push({ value: factUnit, item: factItem2 })
  if (credUnit) ranked.push({ value: credUnit, item: { field: 'researchUnit', label: BASIS_LABEL.researchUnit, value: UNIT_LABEL[credUnit], state: 'confirmed', from: '회사 정보 인증서 칸' } })
  if (extra.lab) ranked.push({ value: extra.lab.unit, item: { field: 'researchUnit', label: BASIS_LABEL.researchUnit, value: UNIT_LABEL[extra.lab.unit], state: 'confirmed', from: `연구소 관리 기록(인정 ${extra.lab.recognizedAt})` } })
  if (factUnit) ranked.push({ value: factUnit, item: factItem2 })
  const top = ranked[0]
  if (top) {
    if (p.researchUnit && p.researchUnit !== top.value) return { ...top, conflict: `연구조직 — 고른 값 '${UNIT_LABEL[p.researchUnit]}' 대신 ${top.item?.from ?? '확인된 정보'} '${UNIT_LABEL[top.value!]}'` }
    return top
  }
  if (p.researchUnit) return { value: p.researchUnit, item: chip('researchUnit', UNIT_LABEL[p.researchUnit]) }
  const guess = researchUnitOf(record, held)
  return { value: guess, item: guess ? (factItem(record, 'researchLab', 'researchUnit') ?? null) : null }
}

function resolveResearchers(p: CertProfile, extra: CertExtra): Resolved<number> {
  if (extra.lab?.researchers) {
    const item: BasisItem = { field: 'researchers', label: BASIS_LABEL.researchers, value: `${extra.lab.researchers}명`, state: 'confirmed', from: '연구소 관리 기록' }
    if (p.researchers !== null && p.researchers !== extra.lab.researchers) return { value: extra.lab.researchers, item, conflict: `연구전담요원 — 고른 값 ${p.researchers}명 대신 연구소 관리 기록 ${extra.lab.researchers}명` }
    return { value: extra.lab.researchers, item }
  }
  return p.researchers !== null ? { value: p.researchers, item: chip('researchers', `${p.researchers}명`) } : { value: null, item: null }
}

function resolvePatents(record: ClientOpsRecord, p: CertProfile, legacy?: LegacyVentureFacts | null): Resolved<number> {
  const fact = readFact(record, 'patents')
  const credCount = (record.customFields ?? []).filter((x) => x.group === 'credential' && /특허/.test(x.label)).length
  if (fact && fact.status === 'confirmed') {
    const n = patentsOf(record)
    const item = factItem(record, 'patents', 'patents')
    if (p.patents !== null && n !== null && p.patents !== n && factPatchValue('patents', p) !== fact.value) return { value: n, item, conflict: `특허 — 고른 값 ${factPatchValue('patents', p)} 대신 회사 정보(확인) ${fact.display}` }
    return { value: n, item }
  }
  // 인증서 칸 특허증 수는 '적어도' 그만큼 — 칩이 더 많으면 칩(올리지 않은 특허가 있을 수 있음), 더 적으면 확인된 쪽
  if (credCount > 0) {
    const item: BasisItem = { field: 'patents', label: BASIS_LABEL.patents, value: `${credCount}건`, state: 'confirmed', from: '회사 정보 인증서 칸(특허증)' }
    if (p.patents !== null && p.patents >= credCount) return { value: p.patents, item: chip('patents', factPatchValue('patents', p)) }
    if (p.patents !== null) return { value: credCount, item, conflict: `특허 — 고른 값 ${factPatchValue('patents', p)} 대신 인증서 칸 특허증 ${credCount}건` }
    return { value: credCount, item }
  }
  // LEGACY 컨설팅 프로젝트의 등록 기록(전문 기록) — 칩보다 먼저, 칩이 더 많으면 칩(다른 특허가 있을 수 있음).
  // 출원 중은 '보유' 가 아니다 — 숫자로 세지 않고 벤처 판단 · 준비 칸에서 '출원 중 · 등록 확인 필요' 로만 쓴다(ctx.legacyVenture)
  if (legacy && legacy.patentStatus === 'registered') {
    const label = '등록 1건 이상'
    const item: BasisItem = { field: 'patents', label: BASIS_LABEL.patents, value: label, state: 'confirmed', from: `이전 컨설팅 프로젝트 기록(${legacy.projectTitle})` }
    if (p.patents !== null && p.patents >= 1) return { value: p.patents, item: chip('patents', factPatchValue('patents', p)) }
    if (p.patents === 0) return { value: 1, item, conflict: `특허 — 고른 값 '없음' 대신 이전 컨설팅 프로젝트 기록 '${label}'` }
    return { value: 1, item }
  }
  if (p.patents !== null) return { value: p.patents, item: chip('patents', factPatchValue('patents', p)) }
  const n = patentsOf(record)
  return { value: n, item: factItem(record, 'patents', 'patents') }
}

/** 중소기업확인서 — 서류함(받음 · 유효) · 인증서 칸 · 보유 인증 글 */
function smeDocOf(record: ClientOpsRecord, today: string): boolean {
  const re = /중소기업\s*(확인서|기준\s*확인|확인)/
  for (const m of allDocumentMetas(record)) {
    if (!re.test(m.label)) continue
    const st = record.documents?.[m.key]
    if (st?.received && documentStatus(m.key, st, today, m).usable) return true
  }
  if ((record.customFields ?? []).some((f) => f.group === 'credential' && re.test(`${f.label} ${f.value}`))) return true
  return re.test(usableFactValue(record, 'certifications'))
}

/** 업종 코드(KSIC) — 서류 · 회사 정보 글에 코드가 있으면 그것, 없으면 직접 적은 코드 */
function ksicOf(record: ClientOpsRecord, f: ReturnType<typeof clientFacts>, p: CertProfile): string | null {
  const texts = [f.industryText, usableFactValue(record, 'businessItem'), usableFactValue(record, 'businessCategory'), ...(record.customFields ?? []).map((x) => `${x.label} ${x.value}`)]
  for (const t of texts) {
    const k = t ? parseKsic(t) : null
    if (k) return k
  }
  return p.ksic
}

export function certContextOf(record: ClientOpsRecord, today: string, profile: CertProfile = EMPTY_CERT_PROFILE, extra: CertExtra = {}): CertificationClientContext {
  const f = clientFacts(record, new Date(`${today}T00:00:00`))
  const held = heldCertifications(record)
  // 진행 기록 · 연구소 관리에서 아는 보유 인증을 더한다(회사 정보 '인증서' 칸이 먼저 — 유효기간이 비었으면 진행 기록 날짜로)
  for (const h of heldFromLives(extra.lives ?? [])) {
    const cur = held.find((x) => x.key === h.key)
    if (!cur) held.push(h)
    else if (!cur.validUntil && h.validUntil) cur.validUntil = h.validUntil
  }
  if (extra.lab && extra.lab.unit === 'lab' && !held.some((h) => h.key === 'lab')) held.push({ key: 'lab', validUntil: '', note: `연구소 관리 기록 · 인정 ${extra.lab.recognizedAt}${extra.lab.number ? ` · ${extra.lab.number}` : ''}` })
  const unit = resolveUnit(record, profile, extra, held)
  const researchers = resolveResearchers(profile, extra)
  const patents = resolvePatents(record, profile, extra.legacy)
  const smeDoc = smeDocOf(record, today)
  const conflicts = [unit.conflict, researchers.conflict, patents.conflict].filter((x): x is string => Boolean(x))
  const policyService = record.services?.policyFund
  const ventureService = record.services?.venture
  return {
    companyName: f.companyName || record.companyName,
    entity: f.businessType === 'corporation' ? 'corporation' : f.businessType === 'individual' ? 'individual' : null,
    years: f.years,
    months: f.months,
    industryText: f.industryText,
    industryGroup: industryGroupOf(f.industryText),
    ksic: ksicOf(record, f, profile),
    employees: f.employeeCount,
    size: profile.size,
    smeDoc,
    revenue: f.revenue?.won ?? null,
    operatingProfit: f.operatingProfit?.won ?? null,
    netIncome: f.netIncome?.won ?? null,
    totalAssets: f.totalAssets?.won ?? null,
    totalLiabilities: f.totalLiabilities?.won ?? null,
    // AX: 정확한 금액만 — 범위 칩은 rndRange 로 따로(대표 금액으로 바꾸지 않는다)
    rndExpense: profile.rndExactMan !== null ? profile.rndExactMan * 10_000 : null,
    rndRange: profile.rndRange,
    researchUnit: unit.value,
    researchers: researchers.value,
    patents: patents.value,
    held,
    b2b: profile.b2b,
    procurement: profile.procurement,
    exportPlan: profile.exportPlan,
    // 진행 중인 정책자금 업무가 있으면 계획이 있는 것으로
    policyFundPlan: profile.policyFundPlan ?? (policyService && ACTIVE_SERVICE.has(policyService.status) ? true : null),
    rndPlan: profile.rndPlan ?? (ventureService && ACTIVE_SERVICE.has(ventureService.status) ? true : null),
    exclusionFlags: profile.exclusion ? ['제외 사유 있음(체납 · 회생 · 체불 명단 공개 · 산재 공표 등 — 운영규정 제3조② 조건과 기간 확인)'] : [],
    evidence: evidenceOf(record, today),
    basis: basisOf(record, f, profile, { unit, researchers, patents, smeDoc }),
    ...(conflicts.length ? { conflicts } : {}),
    ...(extra.legacy ? { legacyVenture: extra.legacy } : {}),
    today,
  }
}

/* ------------------------------------------------------------------ */
/* 근거 — 판정에 쓴 사실이 어디서 왔고 확인됐는지 (P1)                     */
/* ------------------------------------------------------------------ */

const CHIP_FROM = '컨설턴트 선택(회사 정보 미확인)'

function factItem(record: ClientOpsRecord, factKey: string, field: BasisField, display?: string): BasisItem | null {
  const fact = readFact(record, factKey)
  if (!fact || fact.status === 'missing') return null
  return {
    field,
    label: BASIS_LABEL[field],
    value: display ?? fact.display,
    state: fact.status === 'confirmed' ? 'confirmed' : 'estimated',
    from: `${fact.source ? FACT_SOURCE_LABEL[fact.source] : '직접 적음'}${fact.asOf ? ` ${fact.asOf}` : ''}${fact.status === 'confirmed' ? '' : ' · 확인 전'}`,
  }
}

/** 칩 값 → 사실 창고에 넣을 글(특허 · 연구소) — 저장 단추와 같은 글이어야 '확인됨' 으로 알아본다 */
export function factPatchValue(key: 'patents' | 'researchLab', p: CertProfile): string {
  if (key === 'patents') return p.patents === null ? '' : p.patents === 0 ? '없음' : `${p.patents}건${p.patents >= 3 ? ' 이상' : ''}`
  return p.researchUnit === null ? '' : { lab: '기업부설연구소', dept: '연구개발전담부서', none: '없음' }[p.researchUnit]
}

const chip = (field: BasisField, value: string): BasisItem => ({ field, label: BASIS_LABEL[field], value, state: 'estimated', from: CHIP_FROM })
const yn = (v: boolean | null) => (v === null ? '' : v ? '예' : '아니오')

function basisOf(record: ClientOpsRecord, f: ReturnType<typeof clientFacts>, p: CertProfile, r: { unit: Resolved<ResearchUnit>; researchers: Resolved<number>; patents: Resolved<number>; smeDoc: boolean }): BasisItem[] {
  const out: BasisItem[] = []
  const push = (b: BasisItem | null) => b && out.push(b)
  push(factItem(record, 'establishedAt', 'years', f.years !== null ? `${f.years}년(설립 ${usableFactValue(record, 'establishedAt')})` : undefined))
  push(factItem(record, 'businessItem', 'industry') ?? factItem(record, 'businessCategory', 'industry') ?? (f.industryText ? { field: 'industry', label: BASIS_LABEL.industry, value: f.industryText, state: 'estimated', from: '업체 기본 정보 · 확인 전' } : null))
  push(factItem(record, 'employeeCount', 'employees'))
  // AX: 직원 수로 '중소기업' 을 확정하지 않는다 — 확인서가 있거나 확인서를 보고 고른 규모만 ✓ 쪽
  if (r.smeDoc) push({ field: 'size', label: BASIS_LABEL.size, value: p.size ? { small: '소기업', medium: '중기업', mid_large: '중견 이상', large: '대기업' }[p.size] : '중소기업', state: 'confirmed', from: '중소기업확인서' })
  else if (p.size) push({ ...chip('size', { small: '소기업', medium: '중기업', mid_large: '중견 이상', large: '대기업' }[p.size]), from: '컨설턴트 선택(중소기업확인서 기준) · 서류함에 확인서 없음' })
  else if (f.employeeCount !== null && f.employeeCount < 50) push({ field: 'size', label: BASIS_LABEL.size, value: '중소기업으로 보임(확정 아님)', state: 'estimated', from: `직원 ${f.employeeCount}명으로 추정 — 중소기업확인서로 확인` })
  for (const [k, field] of [['revenue', 'revenue'], ['operatingProfit', 'operatingProfit'], ['totalAssets', 'totalAssets'], ['totalLiabilities', 'totalLiabilities']] as const) push(factItem(record, k, field))
  if (p.rndExactMan !== null) push({ field: 'rndExpense', label: BASIS_LABEL.rndExpense, value: p.rndExactMan === 0 ? '없음' : `${p.rndExactMan.toLocaleString()}만원`, state: 'estimated', from: '직접 적은 정확한 금액(재무제표로 최종 확인)' })
  else if (p.rndRange && p.rndRange !== 'unknown') push(chip('rndExpense', p.rndRange === 'none' ? '없음' : `${RND_RANGE_LABEL[p.rndRange]}(범위 — 정확한 금액 확인 필요)`))
  push(r.unit.item)
  push(r.researchers.item)
  push(r.patents.item)
  for (const [k, field] of [['b2b', 'b2b'], ['procurement', 'procurement'], ['exportPlan', 'exportPlan']] as const) if (p[k] !== null) push(chip(field, yn(p[k])))
  if (p.exclusion !== null) push({ field: 'exclusion', label: BASIS_LABEL.exclusion, value: p.exclusion ? '있음' : '없음', state: 'estimated', from: '컨설턴트 확인(신청 전 증명서로 최종 확인)' })
  return out
}
