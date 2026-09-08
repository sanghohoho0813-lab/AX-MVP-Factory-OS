/**
 * 사실표 스키마 — VENTURE FACTSHEET (Master PART 1 §5).
 *
 * 회사별로 숫자와 핵심사실의 원본을 하나만 둔다. 사업계획서·인포그래픽·실사 Script·
 * MVP Demo 데이터가 서로 다른 숫자를 쓰지 않게 하려는 장치다.
 * 값마다 상태(confirmed/unverified/planned/demo/future)·출처·기준일을 붙인다.
 */

import type { ClientOpsRecord } from '../../types/clientOps'
import type {
  FactDefinition,
  FactKey,
  FactSectionKey,
  FactStatus,
  FactValue,
  Factsheet,
} from '../../types/consulting'

export const FACT_SECTION_LABEL: Record<FactSectionKey, string> = {
  company: '회사 기본',
  org: '조직',
  finance: '재무',
  business: '고객·사업',
  tech: '기술',
  market: '시장',
  plan3y: '3년 계획',
}

export const FACT_SECTION_ORDER: FactSectionKey[] = ['company', 'org', 'finance', 'business', 'tech', 'market', 'plan3y']

export const FACT_STATUS_LABEL: Record<FactStatus, string> = {
  confirmed: '확정',
  unverified: '미확인',
  planned: '계획',
  demo: '시연용',
  future: '향후',
}

export const FACT_STATUS_ORDER: FactStatus[] = ['confirmed', 'unverified', 'planned', 'demo', 'future']

const NUM_HINT = '숫자 + 기준연도 + 출처 + 산식'

export const FACTS: FactDefinition[] = [
  // 회사 기본
  { key: 'companyName', section: 'company', label: '회사명', placeholder: '법인명 그대로', numeric: false, fromClient: 'companyName' },
  { key: 'representative', section: 'company', label: '대표자', placeholder: '이름', numeric: false, fromClient: 'representativeName' },
  { key: 'establishedAt', section: 'company', label: '설립일', placeholder: 'YYYY-MM-DD', numeric: false, fromClient: 'establishedAt' },
  { key: 'headOffice', section: 'company', label: '본점', placeholder: '본점 소재지', numeric: false, fromClient: 'businessAddress' },
  { key: 'businessNumber', section: 'company', label: '사업자등록번호', placeholder: '000-00-00000', numeric: false, fromClient: 'businessNumber' },
  { key: 'corporateNumber', section: 'company', label: '법인등록번호', placeholder: '법인만', numeric: false, fromClient: 'corporateNumber' },
  { key: 'industry', section: 'company', label: '현재 업종', placeholder: '업태 · 종목', numeric: false, fromClient: 'industry' },
  { key: 'mainProducts', section: 'company', label: '주요 제품·서비스', placeholder: '지금 돈을 버는 것', numeric: false, multiline: true },
  // 조직
  { key: 'employees', section: 'org', label: '현재 직원수', placeholder: '4대보험 기준', numeric: true, fromClient: 'employeeCount' },
  { key: 'rdStaff', section: 'org', label: 'R&D 인력', placeholder: '명', numeric: true },
  { key: 'rdOrg', section: 'org', label: '연구개발조직', placeholder: '기업부설연구소 / 전담부서 / 없음', numeric: false },
  { key: 'ceoCareer', section: 'org', label: '대표자 핵심 경력', placeholder: '업력·현장 경험', numeric: false, multiline: true },
  { key: 'keyPeople', section: 'org', label: '핵심인력', placeholder: '이름 대신 역할로 적어도 된다', numeric: false, multiline: true },
  // 재무
  { key: 'revenue3y', section: 'finance', label: '최근 3개년 매출', placeholder: NUM_HINT, numeric: true, multiline: true },
  { key: 'profit3y', section: 'finance', label: '최근 3개년 영업이익', placeholder: NUM_HINT, numeric: true, multiline: true },
  { key: 'revenueThisYear', section: 'finance', label: '당해연도 예상매출', placeholder: NUM_HINT, numeric: true },
  { key: 'fundingNow', section: 'finance', label: '현재 자금조달', placeholder: '확보 완료 / 협의 중 / 계획 구분', numeric: true, multiline: true },
  { key: 'revenueTarget3y', section: 'finance', label: '향후 3개년 목표매출', placeholder: NUM_HINT, numeric: true, multiline: true },
  // 고객·사업
  { key: 'customers', section: 'business', label: '현재 고객수', placeholder: NUM_HINT, numeric: true },
  { key: 'accounts', section: 'business', label: '현재 거래처수', placeholder: NUM_HINT, numeric: true },
  { key: 'customerSegments', section: 'business', label: '주요 고객군', placeholder: '누구에게 파는가', numeric: false },
  { key: 'repeatSignals', section: 'business', label: '주문·문의·예약·반복거래', placeholder: '반복 사용의 근거', numeric: true, multiline: true },
  { key: 'contracts', section: 'business', label: '주요 계약·납품·서비스 실적', placeholder: '증빙 가능한 것만', numeric: false, multiline: true },
  // 기술
  { key: 'coreProblem', section: 'tech', label: '핵심 현장문제', placeholder: '반복되는 문제 한 문장', numeric: false, multiline: true },
  { key: 'currentMethod', section: 'tech', label: '기존 해결방식', placeholder: '지금은 어떻게 하는가, 왜 부족한가', numeric: false, multiline: true },
  { key: 'coreTech', section: 'tech', label: '핵심 해결기술', placeholder: '특허·MVP·사업계획서가 같은 이름으로 부를 기술', numeric: false, multiline: true },
  { key: 'implemented', section: 'tech', label: '현재 구현완료', placeholder: 'LIVE 인 것만', numeric: false, multiline: true },
  { key: 'inDevelopment', section: 'tech', label: '개발 중', placeholder: '', numeric: false, multiline: true },
  { key: 'futureDev', section: 'tech', label: '향후 개발', placeholder: 'FUTURE — 현재처럼 쓰지 않는다', numeric: false, multiline: true },
  { key: 'patent', section: 'tech', label: '특허', placeholder: '출원번호 · 출원일 · "출원 중"', numeric: false },
  { key: 'mvpUrl', section: 'tech', label: 'MVP URL', placeholder: 'https://', numeric: false },
  { key: 'axCore', section: 'tech', label: 'AX 핵심기능', placeholder: '분석·추천·최적화 중 1개', numeric: false },
  { key: 'platformUsers', section: 'tech', label: 'Platform 사용자', placeholder: '고객 / 거래처 / 현장 직원', numeric: false },
  // 시장
  { key: 'tam', section: 'market', label: 'TAM', placeholder: NUM_HINT, numeric: true },
  { key: 'sam', section: 'market', label: 'SAM', placeholder: NUM_HINT, numeric: true },
  { key: 'som', section: 'market', label: 'SOM', placeholder: NUM_HINT, numeric: true },
  { key: 'marketFormula', section: 'market', label: '각 산식', placeholder: '예: 사업체 2,800 × 확보율 3% × 연 360만원', numeric: false, multiline: true },
  { key: 'marketBaseYear', section: 'market', label: '기준연도', placeholder: 'YYYY', numeric: false },
  { key: 'marketSource', section: 'market', label: '출처', placeholder: '통계청·협회·보고서 이름', numeric: false },
  // 3년 계획
  { key: 'techGoal', section: 'plan3y', label: '기술 목표', placeholder: '1년차 / 2년차 / 3년차', numeric: false, multiline: true },
  { key: 'customerGoal', section: 'plan3y', label: '고객 목표', placeholder: '현재 → 3년 후 (산식)', numeric: true },
  { key: 'revenueGoal', section: 'plan3y', label: '매출 목표', placeholder: NUM_HINT, numeric: true },
  { key: 'marketExpansion', section: 'plan3y', label: '시장 확대', placeholder: '지역·업종·채널', numeric: false, multiline: true },
  { key: 'fundingNeed', section: 'plan3y', label: '자금 필요액', placeholder: NUM_HINT, numeric: true },
  { key: 'fundingUse', section: 'plan3y', label: '자금 사용처', placeholder: '개발인력·시스템·인증/특허·마케팅 …', numeric: false, multiline: true },
]

const FACT_BY_KEY = new Map(FACTS.map((f) => [f.key, f]))

export function factDef(key: FactKey): FactDefinition {
  const def = FACT_BY_KEY.get(key)
  if (!def) throw new Error(`알 수 없는 사실 항목: ${key}`)
  return def
}

export function factsBySection(): { section: FactSectionKey; facts: FactDefinition[] }[] {
  return FACT_SECTION_ORDER.map((section) => ({ section, facts: FACTS.filter((f) => f.section === section) }))
}

export function emptyFact(): FactValue {
  return { value: '', status: 'unverified', source: '', asOfDate: '', note: '', updatedAt: null }
}

export function factFilled(v: FactValue | undefined): boolean {
  return !!v && v.value.trim() !== ''
}

export function factText(sheet: Factsheet, key: FactKey): string {
  return sheet[key]?.value.trim() ?? ''
}

/** 완성도 — 채운 항목 / 전체. 묶음별로도 낸다 */
export function factCompleteness(sheet: Factsheet): {
  filled: number
  total: number
  bySection: Record<FactSectionKey, { filled: number; total: number }>
  demoCount: number
  unverifiedCount: number
} {
  const bySection = Object.fromEntries(FACT_SECTION_ORDER.map((s) => [s, { filled: 0, total: 0 }])) as Record<
    FactSectionKey,
    { filled: number; total: number }
  >
  let filled = 0
  let demoCount = 0
  let unverifiedCount = 0
  for (const f of FACTS) {
    bySection[f.section].total += 1
    const v = sheet[f.key]
    if (factFilled(v)) {
      filled += 1
      bySection[f.section].filled += 1
      if (v!.status === 'demo') demoCount += 1
      if (v!.status === 'unverified') unverifiedCount += 1
    }
  }
  return { filled, total: FACTS.length, bySection, demoCount, unverifiedCount }
}

/** 비어 있는 필수 항목 */
export function missingFacts(sheet: Factsheet, required: FactKey[]): FactKey[] {
  return required.filter((k) => !factFilled(sheet[k]))
}

/**
 * 고객 운영 기록에서 회사 기본값을 가져온다.
 * 이미 값이 있는 칸은 건드리지 않는다 — 사실표가 원본이다.
 * 출처는 '고객 운영 기록' 으로 적고 상태는 unverified 로 둔다(서류로 확인한 것이 아니므로).
 */
export function seedFactsFromClient(sheet: Factsheet, client: ClientOpsRecord, at: string): Factsheet {
  const out: Factsheet = { ...sheet }
  const industry = [client.businessCategory, client.businessItem].filter((s) => s && s.trim()).join(' · ') || client.industry
  const pick: Record<NonNullable<FactDefinition['fromClient']>, string> = {
    companyName: client.companyName,
    representativeName: client.representativeName,
    establishedAt: client.establishedAt,
    businessAddress: client.businessAddress,
    businessNumber: client.businessNumber,
    corporateNumber: client.corporateNumber,
    industry,
    employeeCount: client.employeeCount,
  }
  for (const f of FACTS) {
    if (!f.fromClient) continue
    if (factFilled(out[f.key])) continue
    const value = (pick[f.fromClient] ?? '').trim()
    if (value === '') continue
    out[f.key] = { value, status: 'unverified', source: '고객 운영 기록', asOfDate: at.slice(0, 10), note: '', updatedAt: at }
  }
  return out
}

/** 사실표를 사람이 읽는 텍스트로 (프롬프트·스냅샷·복사에 쓴다). 빈 항목은 뺀다 */
export function factsheetToText(sheet: Factsheet, opts: { onlyKeys?: FactKey[]; withMeta?: boolean } = {}): string {
  const lines: string[] = []
  for (const { section, facts } of factsBySection()) {
    const rows = facts
      .filter((f) => !opts.onlyKeys || opts.onlyKeys.includes(f.key))
      .filter((f) => factFilled(sheet[f.key]))
    if (rows.length === 0) continue
    lines.push(`[${FACT_SECTION_LABEL[section]}]`)
    for (const f of rows) {
      const v = sheet[f.key]!
      const meta = opts.withMeta === false
        ? ''
        : ` (${FACT_STATUS_LABEL[v.status]}${v.asOfDate ? ` · ${v.asOfDate}` : ''}${v.source ? ` · 출처: ${v.source}` : ''})`
      lines.push(`${f.label}: ${v.value.trim().replace(/\n+/g, ' / ')}${meta}`)
      if (v.note.trim()) lines.push(`  산식/비고: ${v.note.trim().replace(/\n+/g, ' / ')}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
