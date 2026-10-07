/**
 * MIRAE OS → 기업인증 Core 어댑터 (D-170).
 *
 * 업체 기록(사실 창고 · 서류함 · 회사 기본 정보 '인증서' 칸 · 진행 업무)을 읽어 `CertificationClientContext` 를 만든다.
 * 이미 있는 자료를 다시 묻지 않는다 — 기록에 없는 것만 컨설턴트가 칩으로 고른다(`CertProfile`, 모듈 기록에 업체별 저장).
 * 확인되지 않은 값은 null(모름) 로 둔다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { usableFactValue } from '../../services/customerFacts'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { documentStatus } from '../../services/clientOpsAlerts'
import type { CertificationClientContext, CertificationKey, CompanySize, EvidenceDoc, HeldCertification, ResearchUnit } from '../core/types'
import { CERT_RULES } from '../rules/officialRules'

/** 컨설턴트가 칩으로 고르는 업체 사정(기록에 없을 때만) — null = 모름 */
export interface CertProfile {
  b2b: boolean | null
  procurement: boolean | null
  exportPlan: boolean | null
  policyFundPlan: boolean | null
  rndPlan: boolean | null
  /** 연구개발비(만원) */
  rndExpenseMan: number | null
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
  rndExpenseMan: null,
  researchers: null,
  researchUnit: null,
  patents: null,
  size: null,
  exclusion: null,
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
    rndExpenseMan: n(r.rndExpenseMan),
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

export function certContextOf(record: ClientOpsRecord, today: string, profile: CertProfile = EMPTY_CERT_PROFILE): CertificationClientContext {
  const f = clientFacts(record, new Date(`${today}T00:00:00`))
  const held = heldCertifications(record)
  const unit = profile.researchUnit ?? researchUnitOf(record, held)
  const recordPatents = patentsOf(record)
  const policyService = record.services?.policyFund
  const ventureService = record.services?.venture
  return {
    companyName: f.companyName || record.companyName,
    entity: f.businessType === 'corporation' ? 'corporation' : f.businessType === 'individual' ? 'individual' : null,
    years: f.years,
    months: f.months,
    industryText: f.industryText,
    industryGroup: industryGroupOf(f.industryText),
    employees: f.employeeCount,
    size: profile.size,
    revenue: f.revenue?.won ?? null,
    operatingProfit: f.operatingProfit?.won ?? null,
    netIncome: f.netIncome?.won ?? null,
    totalAssets: f.totalAssets?.won ?? null,
    totalLiabilities: f.totalLiabilities?.won ?? null,
    rndExpense: profile.rndExpenseMan !== null ? profile.rndExpenseMan * 10_000 : null,
    researchUnit: unit,
    researchers: profile.researchers,
    patents: profile.patents ?? recordPatents,
    held,
    b2b: profile.b2b,
    procurement: profile.procurement,
    exportPlan: profile.exportPlan,
    // 진행 중인 정책자금 업무가 있으면 계획이 있는 것으로
    policyFundPlan: profile.policyFundPlan ?? (policyService && ACTIVE_SERVICE.has(policyService.status) ? true : null),
    rndPlan: profile.rndPlan ?? (ventureService && ACTIVE_SERVICE.has(ventureService.status) ? true : null),
    exclusionFlags: profile.exclusion ? ['제외 사유 있음(체납 · 회생 · 체불 · 산재 공표 등 — 내용 확인)'] : [],
    evidence: evidenceOf(record, today),
    today,
  }
}
