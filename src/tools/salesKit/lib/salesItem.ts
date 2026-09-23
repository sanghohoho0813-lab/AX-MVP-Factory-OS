/**
 * 영업 카드가 원본 규칙에 넘기는 고객(item) 만들기 (D-92).
 * 업체 기록(고객 운영) + 영업 기록(sales-kit/accounts) → 원본 App.jsx 의 고객 모양.
 */
import type { ClientOpsRecord } from '../../../types/clientOps'
import { clientFacts } from '../../shared/clientPrefill'
import { deriveInterests } from './salesData.js'
import type { SalesItem } from './salesData.js'
import type { AccountData } from './salesAccounts'

export interface SalesContact {
  id: string
  date: string
  type: string
  memo: string
  nextAction: string
}
export interface DocRow {
  name: string
  status: string
  requestedAt: string
  receivedAt: string
  memo: string
  location: string
}

/** 영업 기록 + 업체 기록 → 원본 규칙이 읽는 고객(item) */
export function toSalesItem(client: ClientOpsRecord, acc: AccountData): SalesItem {
  const f = clientFacts(client, new Date())
  const n = (k: string): number | string | undefined => {
    const v = acc[k]
    return typeof v === 'number' || (typeof v === 'string' && v !== '') ? (v as number | string) : undefined
  }
  const flags = (acc.flags as Record<string, boolean> | undefined) ?? {}
  const interests = Array.from(new Set([...acc.interests, ...deriveInterests({ flags })]))
  return {
    ...acc,
    id: client.id,
    name: client.companyName,
    companyName: client.companyName,
    industry: (n('industry') as string | undefined) ?? f.industryText,
    revenue: n('revenue') ?? '',
    netIncome: n('netIncome') ?? '',
    empCount: n('empCount') ?? (f.employeeCount ?? ''),
    estYears: n('estYears') ?? (f.years ?? ''),
    ceoAge: n('ceoAge') ?? (f.representativeAge ?? ''),
    concern: (acc.concern as string | undefined) ?? '',
    memo: acc.memo,
    interests,
    flags,
    stage: acc.stage,
    nextDate: acc.nextContactAt,
    expectedFee: acc.expectedFee ? Math.round(acc.expectedFee / 10000) : 0,
    dbSource: acc.source,
    createdAt: (acc.createdAt as string | undefined) || client.createdAt?.slice(0, 10) || '',
    lastContactAt: acc.lastContactedAt,
  }
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

