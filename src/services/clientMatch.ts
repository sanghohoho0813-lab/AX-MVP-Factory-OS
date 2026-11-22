/**
 * 같은 업체 찾기 — 사업자번호 먼저 · 이름은 번호가 서로 다르지 않을 때만(D-136).
 * 크레탑 엔진 · 영업 판정(salesCretop)과 떼어, 고객 관리 등록 창이 '이미 있는 업체' 를 볼 때 그 묶음을 받지 않게 했다(D-646). salesCretop 이 그대로 다시 내보낸다.
 */
import type { ClientOpsRecord } from '../types/clientOps'

const digits = (v: string) => v.replace(/[^0-9]/g, '')

/** 회사 이름 비교용 — (주) · 주식회사 · 띄어쓰기를 뗀다 */
export function companyKey(name: string): string {
  return name
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 같은 업체 찾기 — 보관하지 않은 것을 먼저.
 * D-136: ① 사업자번호(10자리)가 같은 업체가 목록 어디에 있든 이름보다 먼저.
 *        ② 이름만 같은 업체는 사업자번호가 서로 다르지 않을 때만(한쪽이라도 번호가 없을 때) — 번호가 다르면 다른 회사라 붙이지 않는다(null → 새로 만들지 사람이 고른다).
 */
export function findClientForCretop(records: ClientOpsRecord[], company: { name: string; bizNo: string }): ClientOpsRecord | null {
  const biz = digits(company.bizNo)
  const key = companyKey(company.name)
  const live = records.filter((r) => r.archivedAt === null)
  const archived = records.filter((r) => r.archivedAt !== null)
  if (biz.length === 10) {
    const byBiz = (r: ClientOpsRecord) => digits(r.businessNumber) === biz
    const found = live.find(byBiz) ?? archived.find(byBiz)
    if (found) return found
  }
  if (key === '') return null
  const byName = (r: ClientOpsRecord) => {
    if (companyKey(r.companyName) !== key) return false
    const theirs = digits(r.businessNumber)
    return !(biz.length === 10 && theirs.length === 10 && theirs !== biz)
  }
  return live.find(byName) ?? archived.find(byName) ?? null
}
