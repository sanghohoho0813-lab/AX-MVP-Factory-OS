/**
 * D-660 · D-667 이 업체에 지금 걸린 것(규칙만 · 화면 없음) — 알약 · 판은 ClientNowRow.tsx.
 */
import { useMemo } from 'react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { requestSummary } from '../../services/docRequests'
import { outboundNotices } from '../../services/outbound'
import { useSenderLine } from '../layout/useCurrentUser'

export type NowKind = 'uploads' | 'notices' | 'docreq'

export interface NowItem {
  kind: NowKind
  /** 알약 하나일 때 글(다섯 자 안팎 — '일 순서 안내' 자리에 선다) */
  short: string
  /** 판의 한 줄 — 이름 · 숫자 · 누르면 */
  label: string
  value: string
  go: string
  /** 사흘 넘게 기다린 서류 요청 — 빨간 글자 */
  danger: boolean
}

/** 이 업체에 지금 걸린 것(급한 순서) */
export function clientNowItems(record: ClientOpsRecord, today: string, sender: string, uploads: number, inDocs: boolean): NowItem[] {
  const out: NowItem[] = []
  if (uploads > 0 && !inDocs) out.push({ kind: 'uploads', short: `받은 서류 ${uploads}`, label: '받은 서류', value: `${uploads}개`, go: '칸에 넣기', danger: false })
  const notices = record.archivedAt ? 0 : outboundNotices([record], today, sender).length
  if (notices > 0) out.push({ kind: 'notices', short: `보낼 안내 ${notices}`, label: '보낼 안내', value: `${notices}건`, go: '문구 보기', danger: false })
  const req = inDocs ? null : requestSummary(record, today)
  if (req) {
    out.push({
      kind: 'docreq',
      short: req.done ? '서류 다 받음' : req.waitingDays === 0 ? '서류 요청함' : `서류 ${req.waitingDays}일째`,
      label: req.done ? '요청한 서류' : `서류 요청 ${req.waitingDays === 0 ? '오늘' : `${req.waitingDays}일째`}`,
      value: `${req.got}/${req.total}`,
      go: '서류함에서 보기',
      danger: !req.done && req.waitingDays >= 3,
    })
  }
  return out
}

export function useClientNow(record: ClientOpsRecord | null, today: string, uploads: number, inDocs: boolean): NowItem[] {
  const sender = useSenderLine()
  return useMemo(() => (record ? clientNowItems(record, today, sender, uploads, inDocs) : []), [record, today, sender, uploads, inDocs])
}

/** D-672 이 업체에 '받았다고 알리기' 가 걸려 있나 — 올린 서류를 넣은 그 판에서 바로 잇는다 */
export function gotNoticeCount(record: ClientOpsRecord | null, today: string): number {
  if (!record || record.archivedAt) return 0
  return outboundNotices([record], today).filter((n) => n.kind === 'got').length
}
