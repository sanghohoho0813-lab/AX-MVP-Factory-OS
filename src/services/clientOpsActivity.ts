/**
 * 활동 기록 — 무엇이 언제 바뀌었는지 자동으로 한 줄씩 남긴다.
 *
 * 사람이 직접 쓰는 메모와 달리, 상태를 바꾸는 순간 시스템이 기록한다.
 * "이 업체 어디까지 했더라"를 카톡 대화나 기억이 아니라 이 목록에서 확인하는 것이 목적이고,
 * 지원사업 결과보고·실적 정리에도 그대로 쓸 수 있게 시간순으로 쌓아 둔다.
 *
 * 순수 함수만 둔다(저장소 접근 없음). 저장은 clientOpsService 가 담당한다.
 */

import type {
  ActivityEntry,
  ActivityKind,
  ClientOpsRecord,
  DocumentKey,
  FundingStatus,
  ServiceKey,
  ServiceStatus,
} from '../types/clientOps'
import {
  DOCUMENTS,
  FUNDING_STATUS_LABEL,
  SERVICE_STATUS_LABEL,
  serviceMeta,
} from '../content/clientOpsCatalog'

/** 한 업체가 보관하는 기록 수 상한 — 넘으면 오래된 것부터 버린다 */
export const ACTIVITY_LIMIT = 200

function generateId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function documentLabel(key: DocumentKey): string {
  return DOCUMENTS.find((d) => d.key === key)?.label ?? String(key)
}

/** 기록 한 건을 레코드 앞에 붙인다(최신순). 상한을 넘으면 뒤에서 잘라낸다. */
export function withActivity(
  record: ClientOpsRecord,
  kind: ActivityKind,
  text: string,
  serviceKey: ServiceKey | null = null,
  at: string = new Date().toISOString(),
): ClientOpsRecord {
  const entry: ActivityEntry = { id: generateId(), kind, text, serviceKey, at }
  return { ...record, activity: [entry, ...record.activity].slice(0, ACTIVITY_LIMIT) }
}

/* ------------------------------------------------------------------ */
/* 문구 만들기 — 화면·기록에서 같은 표현을 쓰도록 한곳에 모아 둔다        */
/* ------------------------------------------------------------------ */

export function serviceStatusText(key: ServiceKey, from: ServiceStatus, to: ServiceStatus): string {
  return `${serviceMeta(key).shortLabel} · ${SERVICE_STATUS_LABEL[from]} → ${SERVICE_STATUS_LABEL[to]}`
}

export function serviceDueText(key: ServiceKey, dueDate: string): string {
  return dueDate
    ? `${serviceMeta(key).shortLabel} · 마감일 ${dueDate}`
    : `${serviceMeta(key).shortLabel} · 마감일 지움`
}

export function documentReceivedText(key: DocumentKey, received: boolean): string {
  return received ? `${documentLabel(key)} 받음` : `${documentLabel(key)} 받음 표시 해제`
}

export function documentFileText(key: DocumentKey, fileName: string): string {
  return `${documentLabel(key)} 파일 첨부 — ${fileName}`
}

export function feeReceivedText(label: string, amount: number | null): string {
  return amount === null
    ? `입금 확인 — ${label}`
    : `입금 확인 — ${label} ${amount.toLocaleString('ko-KR')}원`
}

export function fundingStatusText(programName: string, from: FundingStatus, to: FundingStatus): string {
  const name = programName.trim() || '지원사업'
  return `${name} · ${FUNDING_STATUS_LABEL[from]} → ${FUNDING_STATUS_LABEL[to]}`
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                 */
/* ------------------------------------------------------------------ */

export interface ActivityWithClient extends ActivityEntry {
  clientId: string
  clientName: string
}

/** 여러 업체의 기록을 한 줄로 합쳐 최신순으로 돌려준다 */
export function recentActivity(records: ClientOpsRecord[], limit = 20): ActivityWithClient[] {
  const all: ActivityWithClient[] = []
  for (const r of records) {
    for (const a of r.activity) {
      all.push({ ...a, clientId: r.id, clientName: r.companyName })
    }
  }
  all.sort((a, b) => b.at.localeCompare(a.at))
  return all.slice(0, limit)
}

/** "3분 전", "어제", "3월 4일" 처럼 사람이 읽기 쉬운 시각 */
export function activityTimeText(at: string, now: Date = new Date()): string {
  const then = new Date(at)
  if (Number.isNaN(then.getTime())) return ''
  const diffMin = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}시간 전`
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const diffDay = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86400000)
  if (diffDay === 1) return '어제'
  if (diffDay < 7) return `${diffDay}일 전`
  return `${then.getMonth() + 1}월 ${then.getDate()}일`
}
