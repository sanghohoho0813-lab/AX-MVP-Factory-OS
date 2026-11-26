/**
 * D-653 오늘 고객에게 보낼 안내 — 알림톡을 열기 전 단계(L-42 앞).
 *
 * 컨설턴트가 매일 아침 머릿속으로 챙기던 '오늘 연락드릴 곳' 세 가지를 업체 기록에서 골라 문구까지 만든다.
 *   - 약속 안내   다음 약속이 미팅 · 상담 · 방문이고 내일(또는 오늘)이면 → '내일 ○시 미팅 확인차 연락드립니다'
 *   - 서류 독촉   보낸 서류 요청에 아직 안 온 것이 있고 3일이 지났으면 → 남은 것만 다시 부탁(D-512 다시 요청과 같은 글)
 *   - 받을 돈     받기로 한 날이 2일 안 · 오늘 · 지났으면(조건 대기는 빼고 — D-140 수금 상태 그대로) → 입금 안내
 *   - 첫 인사     상담 신청 링크로 들어온 잠재고객에게 아직 연락 전이면(D-658) → '상담 신청 감사합니다 · 통화 편한 시간'
 * 보내는 것은 사람이다 — 앱은 문구만 만든다(외부 발송 · 비용 0). [보냈어요] 를 누르면 업체 기록에 남고 목록에서 빠진다.
 *   약속 · 받을 돈은 `notices`(무엇을 · 언제 보냈나) · 서류는 그 요청의 '다시 부탁한 날'(withRequestResent — 서류함과 같은 기록).
 * 나중에 알림톡을 열면 같은 목록 · 같은 문구가 자동 발송으로 바뀐다(템플릿이 이 글).
 * 규칙 글이다 — AI 가 쓰지 않는다. 수수료(영업자 몫) · 업무 일기 · 내부 메모는 문구에 넣지 않는다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { addDaysLocal, friendlyDate, splitNextTime } from './clientOpsNextAction'
import { openRequests, requestProgress, resendText, withRequestResent } from './docRequests'
import { feeStateOf, fundingFactsOf } from './feeStatus'
import { withActivity } from './clientOpsActivity'

export type NoticeKind = 'hello' | 'meet' | 'docs' | 'fee'

export interface OutboundNotice {
  /** 목록 안에서 하나뿐인 열쇠 */
  key: string
  kind: NoticeKind
  clientId: string
  companyName: string
  /** 한 줄 — '내일 2차 미팅 · 오후 2시' · '서류 3가지 · 5일째' · '착수금 330만원 · 예정일 3일 지남' */
  title: string
  /** 붙여 보낼 글 */
  text: string
  phone: string
  /** 보냈다는 기록을 어디에 — notices 열쇠 또는 서류 요청 id */
  mark: { type: 'notice'; id: string } | { type: 'resend'; reqId: string }
  /** 작을수록 위 */
  rank: number
}

/** 약속 글이 대표님을 뵙는 일일 때만(내부 할 일 '서류 독촉 전화' · '견적서 쓰기' 는 안내하지 않는다) */
export const MEET_NOTICE_WORDS = /미팅|상담|방문|제안|만남|브리핑|설명회|회의|뵙|면담|실사/
/**
 * 만남 말이 있어도 컨설턴트가 혼자 할 일이면 안내하지 않는다(D-655 첫날 걷기에서 찾음) —
 * 상담 신청 링크로 들어온 잠재고객의 '상담 신청 — 연락드리기' 가 약속으로 잡혀 '… 연락드리기 일정 확인차 연락드립니다' 가 나왔다.
 * '제안서 보내기' · '미팅 준비' · '방문 일정 잡기' · '상담 신청(들어온 것)' 도 같은 까닭.
 */
export const MEET_NOTICE_SKIP = /연락\s*드리기|연락하기|전화\s*(?:드리기|하기)|회신|답장|보내기|보내\s*드리기|준비|작성|쓰기|정리|독촉|잡기|상담\s*신청/

/** 서류 요청을 보낸(다시 보낸) 뒤 며칠이 지나면 다시 부탁할까 */
/**
 * D-658 상담 신청 링크로 들어온 잠재고객의 다음 할 일(서버 0027 이 적는 글 그대로 — services/intakeLink INTAKE_NEXT_ACTION 과 같은 글).
 * 여기 따로 적는 까닭: 이 파일은 서버 · 화면을 끌어오지 않는다(오늘 화면이 가볍게).
 */
export const HELLO_NEXT_ACTION = '상담 신청 — 연락드리기'
/** 신청한 지 이만큼 지나도록 연락 전이면 '첫 인사' 는 더 띄우지 않는다(할 일 목록에는 그대로 남는다) */
export const HELLO_KEEP_DAYS = 14
export const DOCS_NUDGE_DAYS = 3
/** 받을 돈 — 예정일 며칠 전부터 미리 안내할까 */
export const FEE_AHEAD_DAYS = 2
/** 받을 돈 — 안내를 보낸 뒤 며칠 동안은 다시 띄우지 않나 */
export const FEE_QUIET_DAYS = 7
/** 받을 돈 — 이보다 오래 지난 미수금은 여기 말고 수금 탭에서(오래된 기록이 매일 쌓이지 않게) */
export const FEE_STALE_DAYS = 90
/** 보낸 기록을 얼마나 남기나(지난 약속 · 받은 돈 기록이 끝없이 늘지 않게) */
export const NOTICE_KEEP_DAYS = 120

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** from → to 날 수(to 가 뒤면 +) */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0
}

/** '김대표 대표님' · '이과장님' · '대표님' */
export function noticeWho(record: Pick<ClientOpsRecord, 'representativeName' | 'contactName'>): string {
  const rep = (record.representativeName ?? '').trim()
  if (rep) return `${rep} 대표님`
  const contact = (record.contactName ?? '').trim()
  return contact ? `${contact}님` : '대표님'
}

const won = (n: number): string => `${Math.round(n).toLocaleString('ko-KR')}원`

/** '3,300,000원' 대신 읽기 쉬운 '330만원'(만 단위로 딱 떨어질 때만) */
export function wonShortText(n: number): string {
  if (n >= 10_000 && n % 10_000 === 0) {
    const man = n / 10_000
    if (man >= 10_000) {
      const eok = Math.floor(man / 10_000)
      const rest = man % 10_000
      return rest ? `${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok.toLocaleString('ko-KR')}억원`
    }
    return `${man.toLocaleString('ko-KR')}만원`
  }
  return won(n)
}

function greet(record: ClientOpsRecord, sender: string): string {
  const me = sender.trim()
  return `안녕하세요, ${noticeWho(record)}.${me ? ` ${me}입니다.` : ''}`
}

/* ------------------------------------------------------------------ */
/* 하나씩                                                               */
/* ------------------------------------------------------------------ */

/**
 * D-658 새 상담 신청 → 첫 인사. 신청이 들어오면 서버가 '상담 신청 — 연락드리기' 를 그날 할 일로 적는다.
 * 그 할 일이 그대로 남아 있고(아직 연락 전) 14일이 안 지났으면 한 번만 — [보냈어요] 뒤에는 다시 안 뜬다(할 일은 사람이 끝낸다).
 */
function helloNotice(record: ClientOpsRecord, today: string, sender: string): OutboundNotice | null {
  if ((record.nextAction ?? '').trim() !== HELLO_NEXT_ACTION) return null
  const date = record.nextActionDueDate
  if (!date || !DAY.test(date)) return null
  const waited = daysBetween(date, today)
  if (waited < 0 || waited > HELLO_KEEP_DAYS) return null
  const id = `hello:${date}`
  if (record.notices?.[id]) return null
  return {
    key: `${record.id}|${id}`,
    kind: 'hello',
    clientId: record.id,
    companyName: record.companyName || '(이름 없음)',
    title: waited === 0 ? '새 상담 신청 · 오늘 들어옴' : `새 상담 신청 · ${waited}일째 연락 전`,
    text: [
      greet(record, sender),
      '상담 신청해 주셔서 감사합니다. 남겨 주신 내용 잘 확인했습니다.',
      '통화 편하신 시간을 알려 주시면 그때 연락드리겠습니다. 감사합니다.',
    ].join('\n'),
    phone: record.contactPhone ?? '',
    mark: { type: 'notice', id },
    // 새 문의는 맨 위 — 오래 기다린 곳이 먼저
    rank: -1 - Math.min(waited, 99) / 100,
  }
}

function meetNotice(record: ClientOpsRecord, today: string, sender: string): OutboundNotice | null {
  const date = record.nextActionDueDate
  if (!date || !DAY.test(date)) return null
  const tomorrow = addDaysLocal(today, 1)
  if (date !== today && date !== tomorrow) return null
  const text = (record.nextAction ?? '').trim()
  if (!text || !MEET_NOTICE_WORDS.test(text) || MEET_NOTICE_SKIP.test(text)) return null
  const id = `meet:${date}`
  if (record.notices?.[id]) return null
  const { base, time } = splitNextTime(text)
  const what = (base || text).slice(0, 40)
  const when = date === today ? '오늘' : '내일'
  const at = `${when} ${friendlyDate(date)}${time ? ` ${time}` : ''}`
  return {
    key: `${record.id}|${id}`,
    kind: 'meet',
    clientId: record.id,
    companyName: record.companyName || '(이름 없음)',
    title: `${when} ${what}${time ? ` · ${time}` : ''}`,
    text: [
      greet(record, sender),
      `${at} ${what} 일정 확인차 연락드립니다.`,
      '혹시 시간이 바뀌셨으면 편하게 말씀해 주세요. 감사합니다.',
    ].join('\n'),
    phone: record.contactPhone ?? '',
    mark: { type: 'notice', id },
    rank: date === today ? 0 : 1,
  }
}

function docsNotices(record: ClientOpsRecord, today: string, sender: string): OutboundNotice[] {
  const out: OutboundNotice[] = []
  for (const req of openRequests(record)) {
    const p = requestProgress(record, req, today)
    if (!p.pending.length || p.waitingDays < DOCS_NUDGE_DAYS) continue
    const body = resendText(record, req, today)
    if (!body) continue
    // 다시 요청 글의 첫 줄(인사)만 이 목록의 인사로 — 본문 · 서류 목록 · 끝인사는 서류함 [다시 요청] 과 글자까지 같다
    const lines = body.split('\n')
    lines[0] = greet(record, sender)
    out.push({
      key: `${record.id}|docs:${req.id}`,
      kind: 'docs',
      clientId: record.id,
      companyName: record.companyName || '(이름 없음)',
      title: `서류 ${p.pending.length}가지 · ${p.waitingDays}일째 안 옴`,
      text: lines.join('\n'),
      phone: record.contactPhone ?? '',
      mark: { type: 'resend', reqId: req.id },
      // 오래 기다린 것이 위 — rank 3 안에서 기다린 날로 한 번 더 줄 세운다
      rank: 3 - Math.min(p.waitingDays, 99) / 100,
    })
  }
  return out
}

function feeNotices(record: ClientOpsRecord, today: string, sender: string): OutboundNotice[] {
  const out: OutboundNotice[] = []
  const funding = fundingFactsOf(record.fundingApplications)
  for (const fee of record.fees ?? []) {
    if (fee.receivedAt || !DAY.test(fee.dueDate ?? '')) continue
    const state = feeStateOf(fee, today, funding)
    const left = daysBetween(today, fee.dueDate)
    const due =
      state === 'overdue' ? left >= -FEE_STALE_DAYS : state === 'claimable' ? left === 0 : state === 'scheduled' ? left >= 1 && left <= FEE_AHEAD_DAYS : false
    if (!due) continue
    const id = `fee:${fee.id}`
    const sentAt = record.notices?.[id]
    if (sentAt && daysBetween(sentAt, today) < FEE_QUIET_DAYS) continue
    const label = (fee.label ?? '').trim() || '대금'
    const amount = typeof fee.amount === 'number' && Number.isFinite(fee.amount) && fee.amount > 0 ? fee.amount : null
    const money = amount ? ` ${wonShortText(amount)}` : ''
    const dayText = friendlyDate(fee.dueDate)
    let title: string
    let ask: string
    if (state === 'overdue') {
      title = `${label}${money} · 예정일 ${-left}일 지남`
      ask = `${dayText} 입금 예정이었던 ${label}${money} 건이 아직 확인되지 않아 연락드립니다. 혹시 이미 보내셨다면 알려 주세요. 바로 확인해 보겠습니다.`
    } else if (left === 0) {
      title = `${label}${money} · 오늘 입금 예정`
      ask = `오늘(${dayText})은 ${label}${money} 입금 예정일입니다. 이미 보내셨다면 이 메시지는 넘기셔도 됩니다.`
    } else {
      title = `${label}${money} · ${left === 1 ? '내일' : `${left}일 뒤`} 입금 예정`
      ask = `${label}${money} 입금 예정일이 ${dayText}입니다. 미리 안내드려요. 이미 보내셨다면 이 메시지는 넘기셔도 됩니다.`
    }
    out.push({
      key: `${record.id}|${id}`,
      kind: 'fee',
      clientId: record.id,
      companyName: record.companyName || '(이름 없음)',
      title,
      text: [greet(record, sender), ask, '감사합니다.'].join('\n'),
      phone: record.contactPhone ?? '',
      mark: { type: 'notice', id },
      // 지난 돈(2) → 오늘(4) → 곧(5) · 지난 돈은 오래 지난 것이 위
      rank: state === 'overdue' ? 2 - Math.min(-left, 99) / 100 : left === 0 ? 4 : 5,
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 목록 · 보냈어요                                                        */
/* ------------------------------------------------------------------ */

/** 오늘 고객에게 보낼 안내 — 보관한 업체는 빼고 · 급한 것부터 */
export function outboundNotices(clients: readonly ClientOpsRecord[], today: string, sender = ''): OutboundNotice[] {
  const out: OutboundNotice[] = []
  for (const c of clients) {
    if (c.archivedAt) continue
    const hello = helloNotice(c, today, sender)
    if (hello) out.push(hello)
    const meet = meetNotice(c, today, sender)
    if (meet) out.push(meet)
    out.push(...docsNotices(c, today, sender), ...feeNotices(c, today, sender))
  }
  return out.sort((a, b) => a.rank - b.rank || a.companyName.localeCompare(b.companyName, 'ko'))
}

/** 보낸 기록 다듬기 — 오래된 것(NOTICE_KEEP_DAYS 넘게 지난)은 버린다 */
export function pruneNotices(notices: Record<string, string> | undefined, today: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(notices ?? {})) {
    if (DAY.test(v) && daysBetween(v, today) <= NOTICE_KEEP_DAYS) out[k] = v
  }
  return out
}

/**
 * [보냈어요] — 기록에 남기고(업체 활동 기록 한 줄 포함) 되돌리는 함수를 같이 준다.
 * 되돌리기는 그때의 최신 기록에 이 한 번만 거꾸로 얹는다(그 사이 다른 칸을 고쳤어도 그대로).
 */
export function withNoticeSent(
  record: ClientOpsRecord,
  notice: Pick<OutboundNotice, 'mark' | 'title'>,
  today: string,
  at: string = new Date().toISOString(),
): { record: ClientOpsRecord; undo: (latest: ClientOpsRecord) => ClientOpsRecord } {
  let next: ClientOpsRecord
  let revert: (r: ClientOpsRecord) => ClientOpsRecord
  if (notice.mark.type === 'notice') {
    const id = notice.mark.id
    const prev = record.notices?.[id]
    next = { ...record, notices: { ...pruneNotices(record.notices, today), [id]: today } }
    revert = (r) => {
      const ns = { ...(r.notices ?? {}) }
      if (prev) ns[id] = prev
      else delete ns[id]
      const { notices: _drop, ...rest } = r
      void _drop
      return Object.keys(ns).length ? { ...rest, notices: ns } : rest
    }
  } else {
    const reqId = notice.mark.reqId
    const prev = (record.docRequests ?? []).find((q) => q.id === reqId)?.resentAt
    next = withRequestResent(record, reqId, today)
    revert = (r) => ({
      ...r,
      docRequests: (r.docRequests ?? []).map((q) => {
        if (q.id !== reqId) return q
        if (prev) return { ...q, resentAt: prev }
        const { resentAt: _drop, ...rest } = q
        void _drop
        return rest
      }),
    })
  }
  next = withActivity(next, 'notice', `고객에게 안내 보냄 — ${notice.title}`, null, at)
  const entryId = next.activity[0]?.id
  return {
    record: next,
    undo: (latest) => {
      const back = revert(latest)
      return { ...back, activity: back.activity.filter((a) => a.id !== entryId) }
    },
  }
}

/** 저장된 값 다듬기(clientOpsService.normalizeClientOps) — 'meet:' · 'fee:' · 'hello:' 열쇠 · 날짜만 */
export function normalizeNotices(value: unknown): { notices?: Record<string, string> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(-300)) {
    if (!/^(meet|fee|hello):[^\s]{1,120}$/.test(k) || typeof v !== 'string' || !DAY.test(v)) continue
    out[k] = v
  }
  return Object.keys(out).length ? { notices: out } : {}
}
