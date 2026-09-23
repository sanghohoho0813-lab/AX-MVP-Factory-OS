/**
 * 영업 대상 업체의 상태 (D-91).
 *
 * 원본은 고객(lead/company)을 자기 안에 들고 있었다. 여기서는 만들지 않는다 —
 * 업체는 고객 운영 하나뿐이고, 이 모듈은 그 업체의 **영업 상태**만 쌓는다.
 *
 * 저장: moduleData 의 `sales-kit` 상자, `accounts` 갈래.
 */

import { normalizeSalesStage, pipe6Of, type SalesStage } from './pipeline'

/** 원본 INTERESTS 16종 그대로 */
export const INTERESTS: readonly string[] = [
  '절세',
  '가업승계',
  '가지급금',
  '미처분이익잉여금',
  '정관정비',
  '임원퇴직금',
  '법인세',
  '종소세',
  '연구소',
  '벤처인증',
  '정책자금',
  '고용지원금',
  '법인보험',
  '사내근로복지기금',
  '법인전환',
  '주식이동',
]

/** 원본 SOURCES 그대로 */
export const SOURCES: readonly string[] = ['전화', '소개', '광고', '블로그', '유튜브', '인스타', '기존인맥', '교육/세미나', '기타']

export interface AccountData extends Record<string, unknown> {
  stage: SalesStage
  /** 어디서 온 고객인가 */
  source: string
  /** 관심사 (INTERESTS 에서 고른 것) */
  interests: string[]
  /** 다음 연락 예정일 YYYY-MM-DD */
  nextContactAt: string
  /** 마지막 연락일 YYYY-MM-DD */
  lastContactedAt: string
  /** 예상 수수료(원) */
  expectedFee: number
  memo: string
}

export function emptyAccount(): AccountData {
  return { stage: 'lead', source: '', interests: [], nextContactAt: '', lastContactedAt: '', expectedFee: 0, memo: '' }
}

export function toAccount(data: Record<string, unknown>): AccountData {
  return {
    stage: normalizeSalesStage(data.stage),
    source: typeof data.source === 'string' ? data.source : '',
    interests: Array.isArray(data.interests) ? (data.interests as string[]) : [],
    nextContactAt: typeof data.nextContactAt === 'string' ? data.nextContactAt : '',
    lastContactedAt: typeof data.lastContactedAt === 'string' ? data.lastContactedAt : '',
    expectedFee: typeof data.expectedFee === 'number' ? data.expectedFee : 0,
    memo: typeof data.memo === 'string' ? data.memo : '',
  }
}

/* ------------------------------------------------------------------ */
/* 다음 연락                                                            */
/* ------------------------------------------------------------------ */

export type FollowUpKind = '지남' | '오늘' | '예정' | '날짜 없음'

export interface FollowUp {
  clientId: string
  stage: SalesStage
  nextContactAt: string
  kind: FollowUpKind
  /** 지났으면 음수 */
  daysLeft: number | null
}

export function followUpOf(clientId: string, account: AccountData, today: string): FollowUp {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(account.nextContactAt)) {
    return { clientId, stage: account.stage, nextContactAt: '', kind: '날짜 없음', daysLeft: null }
  }
  const a = new Date(`${account.nextContactAt}T00:00:00`).getTime()
  const b = new Date(`${today}T00:00:00`).getTime()
  const daysLeft = Math.round((a - b) / 86400000)
  const kind: FollowUpKind = daysLeft < 0 ? '지남' : daysLeft === 0 ? '오늘' : '예정'
  return { clientId, stage: account.stage, nextContactAt: account.nextContactAt, kind, daysLeft }
}

export interface SalesSummary {
  total: number
  /** 보류·이탈을 뺀 진행 건 */
  live: number
  contracted: number
  /** 예상 수수료 합 (진행 건만) */
  pipelineFee: number
  overdue: number
  today: number
  byColumn: Record<string, number>
}

export function summarizeAccounts(
  rows: readonly { clientId: string; data: AccountData }[],
  today: string,
): SalesSummary {
  const byColumn: Record<string, number> = {}
  let live = 0
  let contracted = 0
  let pipelineFee = 0
  let overdue = 0
  let todayCount = 0

  for (const r of rows) {
    const col = pipe6Of(r.data.stage)
    byColumn[col] = (byColumn[col] ?? 0) + 1
    if (r.data.stage === 'contracted') contracted += 1
    if (col !== 'hold') {
      live += 1
      if (r.data.stage !== 'contracted') pipelineFee += r.data.expectedFee || 0
      const f = followUpOf(r.clientId, r.data, today)
      if (f.kind === '지남') overdue += 1
      else if (f.kind === '오늘') todayCount += 1
    }
  }

  return { total: rows.length, live, contracted, pipelineFee, overdue, today: todayCount, byColumn }
}

/** 성과 분석 CSV — 엑셀에서 그대로 열린다 */
export function accountsCsv(rows: readonly { name: string; data: AccountData }[]): string {
  const head = ['업체', '단계', '유입', '관심사', '마지막 연락', '다음 연락', '예상 수수료', '메모']
  const lines = rows.map((r) =>
    [
      r.name,
      r.data.stage,
      r.data.source,
      r.data.interests.join(' '),
      r.data.lastContactedAt,
      r.data.nextContactAt,
      String(r.data.expectedFee || 0),
      (r.data.memo || '').replace(/[\r\n]+/g, ' '),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  return [head.join(','), ...lines].join('\n')
}
