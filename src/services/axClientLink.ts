/**
 * 업체(고객 운영) ↔ AX 스튜디오 고객사 잇기 (D-135).
 *
 * AX 스튜디오 · 홈페이지 설계 · 지원사업은 예전부터 '고객사(Organization)' 를 따로 두었다.
 * 업체에서 AX 스튜디오를 열면 그 업체의 고객사로 간다 — 없으면 업체 정보로 하나 만든다.
 *  - 잇는 끈은 고객사 쪽 `clientOpsId` 하나(업체 기록 · DB 는 바꾸지 않는다)
 *  - 끈이 없으면 사업자번호가 같은 고객사를 찾아 잇는다(이름만 같으면 잇지 않는다 — 다른 회사일 수 있다)
 *  - 업체가 기준: 고객사의 빈 칸만 업체 정보로 채운다(고객사에서 고친 값은 덮지 않는다)
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { Organization, OrganizationInput } from '../types/domain'
import { organizationRepository } from '../repositories'
import { createOrganization } from './organizationService'
import { usableFactValue } from './customerFacts'
import { businessTypeOf, employeeCountOf } from '../tools/shared/clientPrefill'

const digits = (v: string) => v.replace(/\D/g, '')

/** 업체 정보 → 고객사 칸 (순수 함수) */
export function orgInputFromClient(record: ClientOpsRecord): OrganizationInput {
  const revenue = Number(digits(usableFactValue(record, 'revenue')))
  const region = (record.businessAddress.trim().split(/\s+/)[0] ?? '').replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '')
  return {
    name: record.companyName,
    businessRegistrationNumber: record.businessNumber,
    industry: record.industry,
    subIndustry: record.businessItem ?? '',
    businessType: businessTypeOf(record) === 'corporation' ? 'corporation' : businessTypeOf(record) === 'individual' ? 'sole_proprietor' : 'other',
    foundedAt: /^\d{4}-\d{2}-\d{2}$/.test(record.establishedAt ?? '') ? record.establishedAt : null,
    employeeCount: employeeCountOf(record.employeeCount ?? ''),
    annualRevenue: revenue > 0 ? revenue : null,
    region,
    address: record.businessAddress,
    website: record.homepage ?? '',
    primaryContact: { name: record.contactName, position: record.contactTitle ?? '', phone: record.contactPhone, email: record.contactEmail },
    status: 'active',
    healthStatus: 'healthy',
    notes: '',
    clientOpsId: record.id,
  }
}

/** 이 업체의 고객사 — 끈으로, 없으면 사업자번호(10자리)가 같고 아직 끈이 없는 고객사 */
export function findOrgForClient(record: Pick<ClientOpsRecord, 'id' | 'businessNumber'>, orgs: Organization[]): Organization | null {
  const byLink = orgs.find((o) => o.clientOpsId === record.id && o.archivedAt === null)
  if (byLink) return byLink
  const bn = digits(record.businessNumber)
  if (bn.length !== 10) return null
  return orgs.find((o) => !o.clientOpsId && o.archivedAt === null && digits(o.businessRegistrationNumber) === bn) ?? null
}

/** 고객사의 빈 칸만 업체 정보로 — 바뀔 것이 없으면 빈 객체 */
export function orgGapsFromClient(org: Organization, record: ClientOpsRecord): Partial<OrganizationInput> {
  const src = orgInputFromClient(record)
  const out: Partial<OrganizationInput> = {}
  const emptyStr = (v: string | null | undefined) => !v || !v.trim()
  if (emptyStr(org.businessRegistrationNumber) && src.businessRegistrationNumber) out.businessRegistrationNumber = src.businessRegistrationNumber
  if (emptyStr(org.industry) && src.industry) out.industry = src.industry
  if (emptyStr(org.address) && src.address) out.address = src.address
  if (emptyStr(org.website) && src.website) out.website = src.website
  if (org.foundedAt === null && src.foundedAt) out.foundedAt = src.foundedAt
  if (org.employeeCount === null && src.employeeCount !== null) out.employeeCount = src.employeeCount
  if (org.annualRevenue === null && src.annualRevenue !== null) out.annualRevenue = src.annualRevenue
  if (emptyStr(org.primaryContact?.name) && src.primaryContact.name) out.primaryContact = { ...src.primaryContact }
  if (org.clientOpsId !== record.id) out.clientOpsId = record.id
  return out
}

/** 업체에서 AX 스튜디오로 — 고객사를 찾거나(빈 칸 채움 · 끈 잇기) 만든다 */
export function ensureOrgForClient(record: ClientOpsRecord): { org: Organization; created: boolean } {
  // 만들기 직전에 한 번 더 읽는다 — 두 번 눌러 고객사가 둘 생기지 않게
  const found = findOrgForClient(record, organizationRepository.getAll(true))
  if (found) {
    const gaps = orgGapsFromClient(found, record)
    const org = Object.keys(gaps).length > 0 ? organizationRepository.update(found.id, gaps) : found
    return { org, created: false }
  }
  return { org: createOrganization(orgInputFromClient(record)), created: true }
}

/** 업체 상세에서 보여 줄 연결 고객사(만들지 않는다) */
export function linkedOrgOf(record: Pick<ClientOpsRecord, 'id' | 'businessNumber'>): Organization | null {
  return findOrgForClient(record, organizationRepository.getAll(false))
}
