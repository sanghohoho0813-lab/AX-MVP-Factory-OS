/**
 * 도구 결과가 말하는 회사와 붙일 업체가 같은가 (D-94).
 *
 * 크레탑 보고서처럼 결과 안에 회사가 적혀 있으면, 다른 업체 기록에 잘못 붙이기 전에 한 번 더 묻는다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'

export interface ToolSubject {
  name?: string
  bizNo?: string
}

const digitsOf = (v: string | undefined) => String(v ?? '').replace(/\D/g, '')
const plainName = (v: string | undefined) =>
  String(v ?? '')
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\s/g, '')
    .toLowerCase()

/** 결과의 회사와 붙일 업체가 다른가 — 사업자번호가 둘 다 있으면 그것으로, 아니면 이름으로 */
export function subjectMismatch(subject: ToolSubject | undefined, target: Pick<ClientOpsRecord, 'companyName' | 'businessNumber'>): boolean {
  if (!subject) return false
  const a = digitsOf(subject.bizNo)
  const b = digitsOf(target.businessNumber)
  if (a.length >= 10 && b.length >= 10) return a !== b
  const n = plainName(subject.name)
  const m = plainName(target.companyName)
  if (!n || !m) return false
  return !(n.includes(m) || m.includes(n))
}

