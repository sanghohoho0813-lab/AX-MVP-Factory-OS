/**
 * 올린 서류 → 회사 기본 정보 후보 (D-128 · D-129).
 *
 * 자료 업로드 → 글자 읽기(PDF 글자 · 사진 OCR) → 구조화 → 지금 값과 비교 → '확인 필요' 로 제안 → 확인하면 반영.
 * 저절로 확정하지 않는다. 같은 값이면 묻지 않고, 같은 인증서를 또 올려도 칸이 늘지 않는다(customerFacts.pendingFacts).
 *
 *  - 사업자등록증 · 법인등기부등본 → 회사명 · 번호 · 대표자 · 설립일 · 주소 · 업태 · 종목(공통 사실)
 *  - 인정서 · 확인서 · 인증서 · 특허증(어느 칸에 올렸든, 직접 만든 칸이어도) → 회사 기본 정보 '인증서' 묶음의 칸
 */

import type { ClientOpsRecord, DocumentKey, FactCandidate, FactSource } from '../types/clientOps'
import { parseKoreanBusinessDocument } from './koreanDocParser'
import { certificateValue, parseCertificateDocument } from './certDocParser'
import { CUSTOM_FACT_PREFIX, withFactCandidates } from './customerFacts'
import { parseFinancialStatement } from './finStatementParser'

const BUSINESS_DOC: Record<string, FactSource> = { businessRegistration: 'businessRegistration', corporateRegistry: 'corporateRegistry' }

/** 서류 글자에서 찾은 후보들 (아직 확정 아님) */
export function factCandidatesFromDocText(key: DocumentKey, text: string, ref: string): Omit<FactCandidate, 'id' | 'foundAt'>[] {
  if (!text || text.replace(/\s/g, '').length < 10) return []
  const out: Omit<FactCandidate, 'id' | 'foundAt'>[] = []
  const bizSource = BUSINESS_DOC[key]
  if (bizSource) {
    const p = parseKoreanBusinessDocument(text)
    const pairs: [string, string | undefined][] = [
      ['companyName', p.companyName],
      ['businessNumber', p.businessNumber],
      ['corporateNumber', p.corporateNumber],
      ['representativeName', p.representativeName],
      ['establishedAt', p.establishedAt],
      ['businessAddress', p.address],
      ['businessCategory', p.businessCategory],
      ['businessItem', p.businessItem],
    ]
    for (const [k, v] of pairs) if (typeof v === 'string' && v.trim() !== '') out.push({ key: k, value: v, source: bizSource, asOf: '', ref })
    return out
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
