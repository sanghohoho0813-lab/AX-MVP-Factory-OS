/**
 * 업체 기록 → 매칭 조건 (D-141). 계약 고객이든 잠재고객이든 같은 업체 기록 하나에서 읽는다.
 *
 *  - 주소 → 시·도 · 시·군·구, 설립일 → 만 업력, 직원 수 · 매출(사실 창고 → 영업 메모 순), 대표 생년월일 → 나이,
 *    대표 성별, 인증(사실 창고 '인증' · '연구소' 글).
 *  - 후보(아직 확인 안 한 자료 속 값)는 쓰지 않는다 — 사실 창고 규칙과 같다(usableFactValue).
 *  - 없는 값은 비워 둔다 → 매칭에서 '확인 필요' 가 된다. 지어내지 않는다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { usableFactValue, wonOf } from '../customerFacts'
import { ageFrom, yearsInBusiness } from '../clientOpsProfile'
import { certsFromText, exact, placeOf, type CompanyProfile } from './grantMatch'
import { profileFromQuery } from './grantText'

/** '12명' · '12' · '약 12명(대표 포함)' → 12 */
function countOf(text: string): number | null {
  const m = /(\d[\d,]*)/.exec(text ?? '')
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function profileOfRecord(record: ClientOpsRecord, today: string): CompanyProfile {
  const { sido, city, sidoAlt } = placeOf(record.businessAddress ?? '')
  const industry = [record.industry, record.businessCategory, record.businessItem].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ')
  const yrs = record.establishedAt ? yearsInBusiness(record.establishedAt, today) : null
  const emp = countOf(record.employeeCount ?? '')
  const revWon = wonOf(usableFactValue(record, 'revenue'))
  const revM = revWon !== null ? Math.round(revWon / 1_000_000) : typeof record.sales?.revenueM === 'number' ? record.sales.revenueM : null
  const age = record.representativeBirth ? ageFrom(record.representativeBirth, today) : typeof record.sales?.ceoAge === 'number' ? record.sales.ceoAge : null
  const certText = [usableFactValue(record, 'certifications'), usableFactValue(record, 'researchLab') ? '연구소' : ''].join(' ')
  const out: CompanyProfile = {
    name: record.companyName,
    sido,
    ...(sidoAlt ? { sidoAlt } : {}),
    city,
    industry,
    years: yrs ? exact(yrs.fullYears) : null,
    employees: emp !== null ? exact(emp) : null,
    revenueM: revM !== null && revM >= 0 ? exact(revM) : null,
    ceoAge: age !== null ? exact(age) : null,
    female: record.representativeGender === 'female' ? true : record.representativeGender === 'male' ? false : null,
    certs: certsFromText(certText),
    certsKnown: certText.trim() !== '',
  }
  // 지원사업 찾기에서 가망고객이 고른 구간 — 업체 기록에 정확한 값이 없을 때만 쓴다
  const q = record.sales?.grantQuery
  if (q) {
    const g = profileFromQuery(q)
    if (!out.sido && g.sido) {
      out.sido = g.sido
      out.city = g.city
    }
    if (!out.industry) out.industry = g.industry
    out.years ??= g.years
    out.employees ??= g.employees
    out.revenueM ??= g.revenueM
    out.ceoAge ??= g.ceoAge
    out.female ??= g.female
    if (!out.certsKnown && g.certsKnown) {
      out.certs = g.certs
      out.certsKnown = true
    }
  }
  return out
}

/** 매칭에 쓰는 업체 정보 중 비어 있는 것 — '이것만 적으면 더 정확해요' */
export function missingForMatch(p: CompanyProfile): string[] {
  const out: string[] = []
  if (!p.sido) out.push('회사 주소')
  if (!p.industry) out.push('업종')
  if (!p.years) out.push('설립일')
  if (!p.employees) out.push('직원 수')
  if (!p.revenueM) out.push('매출')
  return out
}

/** "경기 파주시 · 제조업 · 업력 3년" — 문구 · 머리줄 */
export function profileLine(p: CompanyProfile): string {
  return [
    [p.sido, p.city].filter(Boolean).join(' '),
    p.industry.split(' · ')[0]?.slice(0, 14) ?? '',
    p.years ? (p.years.lo === p.years.hi ? `업력 ${p.years.lo}년` : '') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
