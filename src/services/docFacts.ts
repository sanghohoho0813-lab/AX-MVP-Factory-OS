/**
 * 올린 서류 → 회사 기본 정보 후보 (D-128 · D-129).
 *
 * 자료 업로드 → 글자 읽기(PDF 글자 · 사진 OCR) → 구조화 → 지금 값과 비교 → '확인 필요' 로 제안 → 확인하면 반영.
 * 저절로 확정하지 않는다. 같은 값이면 묻지 않고, 같은 인증서를 또 올려도 칸이 늘지 않는다(customerFacts.pendingFacts).
 *
 *  - 사업자등록증(· 사업자등록증명 D-344) · 법인등기부등본 → 회사명 · 번호 · 대표자 · 설립일 · 주소 · 업태 · 종목(공통 사실)
 *  - 인정서 · 확인서 · 인증서 · 특허증(어느 칸에 올렸든, 직접 만든 칸이어도) → 회사 기본 정보 '인증서' 묶음의 칸
 *  - 취업규칙 → '정년 · 계속고용' 칸(D-339)
 *  - 세무조정계산서 · 법인세 · 종합소득세 신고서 → '받은 공제 · 감면 YYYY년' 칸(D-378) — 경정청구 신호
 *  - 법인 등기부 → '임원 임기' 칸(D-380) — 3년이면 끝나는 날 · 달력에 중임 등기
 *  - 대표 신용점수 조회서 → '대표 신용점수' 칸(D-381) — 정책자금 대표 신용
 *  - 대표 신분증 사본 → 대표 생년월일 · 이름(D-389) — 주민등록번호는 남기지 않는다
 */

import type { ClientOpsRecord, DocumentKey, FactCandidate, FactSource } from '../types/clientOps'
import { isBizRegCertificate, parseKoreanBusinessDocument } from './koreanDocParser'
import { readBusinessNumber } from './bizNoRead'
import { certificateValue, parseCertificateDocument } from './certDocParser'
import { CUSTOM_FACT_PREFIX, formatWon, withFactCandidates } from './customerFacts'
import { parseFinancialStatement } from './finStatementParser'
import { latestFullYear, looksLikeVatCert, readVatCert, vatSummary } from './vatDoc'
import { incomeTrendLine, looksLikeIncomeCert, readIncomeCert } from './incomeDoc'
import { looksLikeWorkRules, readRetireRule, retireRuleLine } from './workRules'
import { readTaxReturn, reliefFactLabel, reliefFactValue } from './taxReturnDoc'
import { officerTerms, officerTermsValue, readDirectorTermYears } from './registryTax'
import { creditScoreValue, readCreditScore } from './creditScoreDoc'
import { readIdCard } from './idCardDoc'

const BUSINESS_DOC: Record<string, FactSource> = { businessRegistration: 'businessRegistration', corporateRegistry: 'corporateRegistry' }

/** 서류 글자에서 찾은 후보들 (아직 확정 아님) */
export function factCandidatesFromDocText(key: DocumentKey, text: string, ref: string): Omit<FactCandidate, 'id' | 'foundAt'>[] {
  if (!text || text.replace(/\s/g, '').length < 10) return []
  const out: Omit<FactCandidate, 'id' | 'foundAt'>[] = []
  // D-344 홈택스 사업자등록증명 — 어느 칸에 올렸든(보통 '사업자등록증명' 새 칸) 사업자등록증과 같은 정보로 읽는다
  const bizSource = BUSINESS_DOC[key] ?? (isBizRegCertificate(text) ? 'businessRegistration' : undefined)
  if (bizSource) {
    const p = parseKoreanBusinessDocument(text)
    const pairs: [string, string | undefined][] = [
      ['companyName', p.companyName],
      ['businessNumber', p.businessNumber],
      ['corporateNumber', p.corporateNumber],
      ['representativeName', p.representativeName],
      // D-181: 대표 생년월일 — 등기부 '홍길동 801231-1******' · 개인사업자 등록증 '생년월일' 줄(날짜만 남기고 주민등록번호는 남기지 않는다)
      ['representativeBirth', p.representativeBirth],
      ['establishedAt', p.establishedAt],
      ['businessAddress', p.address],
      ['businessCategory', p.businessCategory],
      ['businessItem', p.businessItem],
    ]
    for (const [k, v] of pairs) if (typeof v === 'string' && v.trim() !== '') out.push({ key: k, value: v, source: bizSource, asOf: '', ref })
    // D-255: 사업자등록번호 — 확실하지 않으면(스캔 한 번만 맞음 · 검증 숫자 안 맞음) 까닭 · 고를 후보를 붙인다(저절로 넣지 않는다)
    const bn = readBusinessNumber(text)
    const at = out.findIndex((c) => c.key === 'businessNumber')
    if (!bn.sure && (bn.value || bn.candidates.length)) {
      const cand = { key: 'businessNumber', value: bn.value || bn.candidates[0], source: bizSource, asOf: '', ref, note: bn.reason, ...(bn.candidates.length ? { choices: bn.candidates } : {}) }
      if (at >= 0) out[at] = cand
      else out.splice(1, 0, cand)
    }
    // D-380 등기부 → 지금 임원의 이번 임기(3년이면 끝나는 날) — 회사 정보 '임원 임기' · 달력 '중임 등기'
    if (bizSource === 'corporateRegistry') {
      const terms = officerTerms(text)
      if (terms.length) out.push({ key: `${CUSTOM_FACT_PREFIX}임원 임기`, label: '임원 임기', group: 'people', value: officerTermsValue(terms), source: 'corporateRegistry', asOf: '', ref })
    }
    return out
  }
  // D-389 대표 신분증 사본 → 대표 생년월일 · 이름(주민등록번호 · 주소는 남기지 않는다). 기본 칸 '대표자 신분증 사본' 이 아니어도 제목이 신분증이면
  const id = readIdCard(text, key === 'representativeId' ? '신분증' : '')
  if (id) {
    out.push({ key: 'representativeBirth', value: id.birth, source: 'idCard', asOf: '', ref })
    if (id.name) out.push({ key: 'representativeName', value: id.name, source: 'idCard', asOf: '', ref })
    return out
  }
  // D-378 세무조정계산서 · 신고서 → 그해 받은 공제 · 감면(이름 · 금액). 공제 · 감면 칸을 못 찾았고 받은 것도 없으면 남기지 않는다
  //  (첫 장만 올린 신고서에 '없음' 이라고 적지 않게). 해를 모르면 확인으로. 세무조정계산서 묶음에는 표준재무제표도 있어 아래로 이어 간다
  const ret = readTaxReturn(text)
  if (ret && (ret.items.length || ret.sectionSeen)) {
    out.push({
      key: `${CUSTOM_FACT_PREFIX}${reliefFactLabel(ret.year)}`,
      label: reliefFactLabel(ret.year),
      group: 'identity',
      value: reliefFactValue(ret, formatWon),
      source: 'taxReturn',
      asOf: ret.year ? String(ret.year) : '',
      ref,
      ...(ret.year ? {} : { note: '사업연도를 못 읽었어요 — 몇 년 신고서인지 칸 이름에 적어 주세요' }),
    })
  }
  // D-168: 재무제표 → 매출 · 영업이익 · 순이익 · 자산 · 부채(당기)
  if (key === 'financialStatements') {
    const f = parseFinancialStatement(text)
    for (const k of ['revenue', 'operatingProfit', 'netIncome', 'totalAssets', 'totalLiabilities'] as const) {
      const v = f[k]
      if (typeof v === 'number') out.push({ key: k, value: String(v), source: 'financialStatements', asOf: f.year ?? '', ref })
    }
    return out
  }
  if (ret) return out
  // D-373 소득금액증명(개인사업자 · 종합소득세) → 가장 최근 해 수입금액(매출) · 사업소득금액(순이익) · 매출 추이. 검산이 안 맞으면 확인으로
  if (looksLikeIncomeCert(text)) {
    const inc = readIncomeCert(text)
    const last = inc?.years[inc.years.length - 1]
    if (inc && last) {
      const note = inc.sure ? {} : { note: last.rows > 1 ? '같은 해에 사업 줄이 여럿이라 더했어요 — 이 업체 사업장 것만인지 확인' : '수입금액 · 소득금액 검산이 맞지 않아요 — 서류를 보고 확인' }
      const asOf = String(last.year)
      out.push({ key: 'revenue', value: String(last.revenue), source: 'incomeCertificate', asOf, ref, ...note })
      out.push({ key: 'netIncome', value: String(last.income), source: 'incomeCertificate', asOf, ref, ...note })
      const trend = incomeTrendLine(inc, formatWon)
      if (trend && inc.sure) out.push({ key: `${CUSTOM_FACT_PREFIX}매출 추이`, label: '매출 추이', group: 'identity', value: trend, source: 'incomeCertificate', asOf, ref })
    }
    if (inc) return out
  }
  // D-311 부가세 과세표준증명 · 면세 수입금액증명 → 가장 최근 '다 찬 해'(1~12월 · 겹침 없음) 매출
  if (looksLikeVatCert(text)) {
    const vat = readVatCert(text)
    const full = vat ? latestFullYear(vat) : null
    if (full) {
      out.push({ key: 'revenue', value: String(full.total), source: 'vatCertificate', asOf: String(full.year), ref })
      // D-333 해마다 · 작년 같은 기간 대비 한 줄을 회사 정보에도 — 정책자금 '매출 성장세' 가 이 줄을 읽는다
      const trend = vat ? vatSummary(vat, formatWon) : ''
      if (/보다 [+-]?\d+%/.test(trend)) out.push({ key: `${CUSTOM_FACT_PREFIX}매출 추이`, label: '매출 추이', group: 'identity', value: trend, source: 'vatCertificate', asOf: String(full.year), ref })
      return out
    }
    if (vat) return out
  }
  // D-339 취업규칙 → 정년 · 계속고용 제도(고령자 계속고용장려금 요건) — 회사 정보 '정년 · 계속고용' 칸
  if (looksLikeWorkRules(text)) {
    const rule = readRetireRule(text)
    if (rule) out.push({ key: `${CUSTOM_FACT_PREFIX}정년 · 계속고용`, label: '정년 · 계속고용', group: 'people', value: retireRuleLine(rule), source: 'workRules', asOf: '', ref })
    return out
  }
  // D-382 정관 → '이사 임기(정관)' 칸 — 달력의 중임 등기 날짜를 정관 임기로 다시 센다(1~3년)
  const termYears = /^정\s*관|정\s*관\s*$/m.test(text.slice(0, 600)) || /제\s*1\s*조\s*\(?\s*상\s*호/.test(text) ? readDirectorTermYears(text) : null
  if (termYears) out.push({ key: `${CUSTOM_FACT_PREFIX}이사 임기(정관)`, label: '이사 임기(정관)', group: 'people', value: `${termYears}년`, source: 'articles', asOf: '', ref })
  // D-381 대표 신용점수 조회서 → '대표 신용점수' 칸(정책자금 대표 신용). 조회서의 다른 내용은 남기지 않는다
  const credit = readCreditScore(text)
  if (credit) {
    out.push({ key: `${CUSTOM_FACT_PREFIX}대표 신용점수`, label: '대표 신용점수', group: 'people', value: creditScoreValue(credit), source: 'creditReport', asOf: '', ref })
    return out
  }
  const cert = parseCertificateDocument(text)
  if (cert) {
    out.push({
      key: `${CUSTOM_FACT_PREFIX}${cert.name}`,
      label: cert.name,
      group: 'credential',
      value: certificateValue(cert),
      source: 'certificate',
      asOf: cert.date,
      ref,
    })
  }
  return out
}

/** 서류 하나를 올린 뒤 — 찾은 것을 '확인 필요' 로 남긴다. 몇 건 찾았는지 함께 */
export function withDocFacts(record: ClientOpsRecord, key: DocumentKey, text: string, now: string, makeId: () => string): { record: ClientOpsRecord; found: number } {
  const found = factCandidatesFromDocText(key, text, `doc:${key}:${now}`)
  if (found.length === 0) return { record, found: 0 }
  return { record: withFactCandidates(record, found, now, makeId), found: found.length }
}
