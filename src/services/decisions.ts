/**
 * 확인함 (D-158) — 프로그램이 먼저 준비하고, 대표는 '맞아요 / 아니에요' 만 고른다.
 *
 * 업체 기록 · 올린 서류 · 받아 둔 공고를 읽어 결정할 거리를 한 줄씩 만든다.
 *   fact   자료에서 읽은 회사 정보(설립일 · 매출 …) — 맞으면 업체 정보로, 아니면 다시 묻지 않는다
 *   module 모듈 판정이 '가능성 높음' — 맞으면 그 일을 할 일로 건다(3일 뒤)
 *   grant  조건이 꼭 맞는 공고(마감 전) — 맞으면 '도전해 볼 만함' 체크(마감이 일정 · 오늘에)
 *   doc    서류 유효기간 끝남 · 14일 안 — 맞으면 서류 요청 문구를 복사
 *   money  (D-160) 받기로 한 날이 지난 돈(미수금) — 맞으면 입금 요청 문구를 복사(활동 기록에 남김)
 *   stale  (D-160) 기한이 일주일 넘게 지난 진행 중 업무 — 맞으면 기한을 2주 뒤로 다시 잡는다
 *   next   (D-160) 다음 약속이 없거나 일주일 넘게 지남 — 맞으면 프로그램이 고른 약속 · 날짜로 잡는다
 *   followup (D-160) 오래 조용한 잠재고객 — 맞으면 다시 연락 문구를 복사(활동 기록에 남김)
 * 한 번 답한 것은 업체 기록 `decided` 에 남아 다시 묻지 않는다. 판정 글이 바뀌면(새 서류) 다시 묻는다.
 *
 * 규칙 계산이다 — 외부 호출 · LLM 0. 저장은 업체 기록 payload 하나(DB 변경 없음).
 */

import type { ClientOpsRecord } from '../types/clientOps'
import { contractStageOf } from '../types/clientOps'
import { pendingFacts, withFactDecisions } from './customerFacts'
import { buildInsights } from './clientInsights'
import { documentsWithExpiry } from './clientOpsAlerts'
import { buildDocumentRequestMessage } from './clientOpsMessages'
import { matchesFor, type GrantNotice } from './grants/grantMatch'
import { profileOfRecord } from './grants/grantProfile'
import { applicationFor, withGrantChallenge } from './grants/grantApply'
import { feeStateOf, fundingFactsOf } from './feeStatus'
import { withService } from './clientOpsService'
import { withActivity } from './clientOpsActivity'
import { addDaysLocal, friendlyDate, nextSuggestions, withNextAction } from './clientOpsNextAction'
import { salesStageOf } from './salesPipeline'
import { salesRecontacts, lastSalesTouch } from './salesSignals'
import { SERVICES } from '../content/clientOpsCatalog'
import type { ServiceKey } from '../types/clientOps'

export type DecisionKind = 'fact' | 'module' | 'grant' | 'doc' | 'money' | 'stale' | 'next' | 'followup'

export const DECISION_KIND_LABEL: Record<DecisionKind, string> = {
  fact: '자료에서 읽은 정보',
  module: '해 볼 만한 일',
  grant: '맞는 지원사업',
  doc: '서류 기한',
  money: '받을 돈',
  stale: '밀린 업무',
  next: '다음 약속',
  followup: '다시 연락',
}

/** D-160: 한 번에 '모두 맞아요' 해도 되는 종류 — 복사(카톡 문구)는 하나씩 보내야 하므로 뺀다 */
export const DECISION_BULK_KINDS: DecisionKind[] = ['fact', 'module', 'stale', 'next']

export type DecisionEffect =
  | { type: 'fact'; pendingId: string }
  | { type: 'todo'; text: string; dueInDays: number }
  | { type: 'grant'; noticeId: string }
  /** log: 맞아요(복사)를 누르면 활동 기록에 남길 한 줄 */
  | { type: 'copy'; text: string; log?: string }
  | { type: 'next'; text: string; date: string }
  | { type: 'due'; serviceKey: ServiceKey; date: string }

export interface Decision {
  /** 업체 안에서 변하지 않는 이름 — 답을 이 이름으로 남긴다 */
  id: string
  clientId: string
  clientName: string
  kind: DecisionKind
  /** 무엇을 정하나(진하게) */
  title: string
  /** 왜 묻나 — 근거 한 줄 */
  why: string
  yesLabel: string
  noLabel: string
  effect: DecisionEffect
  /** 더 볼 곳(업체 상세 탭 · 모듈) */
  openPath: string | null
  /** 작을수록 먼저 */
  rank: number
  /** D-160: [맞아요] 뒤 알림 글(없으면 효과 종류로 정한다) */
  doneText?: string
}

export interface DecisionAnswer {
  a: 'yes' | 'no'
  at: string
}

/** 짧고 안정적인 글자 지문 — 판정 글이 바뀌면 다른 이름이 되게 */
function sig(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const isYmd = (d: string | null | undefined): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 주말이면 다음 월요일로 — 약속 · 기한을 토 · 일에 잡지 않는다 */
export function weekdayOnOrAfter(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 6 ? addDaysLocal(date, 2) : day === 0 ? addDaysLocal(date, 1) : date
}

/** 받을 돈 — 입금 요청 문구(고객에게 보내는 말 · 안쪽 말 없음) */
export function paymentReminderMessage(record: ClientOpsRecord, label: string, amount: number | null, dueDate: string): string {
  const who = record.representativeName.trim() ? `${record.representativeName.trim()} 대표님` : `${record.companyName} 대표님`
  const what = `${label || '용역 대금'}${amount ? ` ${won(amount)}` : ''}`
  return `${who}, 안녕하세요. ${what}의 입금 예정일(${Number(dueDate.slice(5, 7))}월 ${Number(dueDate.slice(8, 10))}일)이 지나 확인차 연락드립니다. 이미 보내셨다면 말씀 부탁드리고, 아직이시면 편하실 때 입금 부탁드립니다. 감사합니다.`
}

/** 업체 하나의 결정 거리 — 이미 답한 것은 뺀다 */
export function buildDecisions(record: ClientOpsRecord, today: string, notices: readonly GrantNotice[], usable: (key: string) => boolean = () => true): Decision[] {
  if (record.archivedAt !== null || contractStageOf(record.status) === 'closed') return []
  const answered = record.decided ?? {}
  const out: Decision[] = []
  const base = { clientId: record.id, clientName: record.companyName }
  const push = (d: Omit<Decision, 'clientId' | 'clientName'>) => {
    if (!answered[d.id]) out.push({ ...base, ...d })
  }

  // 1) 자료에서 읽은 정보 — 맞나요?
  try {
    for (const p of pendingFacts(record).slice(0, 6)) {
      push({
        id: `fact:${p.id}`,
        kind: 'fact',
        title: `${p.label} ${p.display}${p.current && p.current !== p.display ? ` (지금 적힌 값 ${p.current})` : ''} — 맞나요?`,
        why: `${p.sourceLabel}에서 읽었습니다`,
        yesLabel: '맞아요 · 넣기',
        noLabel: '틀려요',
        effect: { type: 'fact', pendingId: p.id },
        openPath: `/ops/clients/${record.id}?tab=smart`,
        rank: 10,
      })
    }
  } catch {
    // 사실 창고가 실패해도 다른 결정 거리는 보인다
  }

  // 2) 모듈 판정 — 해 볼 만한 일
  try {
    for (const ins of buildInsights(record, today, notices, usable)) {
      if (!ins.action || !(ins.tone === 'good' || ins.tone === 'maybe') || ins.key === 'grants') continue
      push({
        id: `module:${ins.key}:${sig(ins.action)}`,
        kind: 'module',
        title: ins.action,
        why: `${ins.label} 판정 — ${ins.headline}`,
        yesLabel: '할 일로 걸기',
        noLabel: '지금은 아님',
        effect: { type: 'todo', text: `${record.companyName} · ${ins.action}`, dueInDays: 3 },
        openPath: ins.openPath,
        rank: ins.tone === 'good' ? 20 : 30,
      })
    }
  } catch {
    // 한 모듈 엔진이 실패해도 멈추지 않는다
  }

  // 3) 꼭 맞는 공고 — 도전해 볼까요? (이미 신청 건이 있는 공고 · 마감 지난 공고는 빼고, 마감 가까운 둘)
  if (usable('grants') && notices.length) {
    try {
      const fits = matchesFor(notices, profileOfRecord(record, today), today)
        .filter((m) => m.verdict === 'fit' && !applicationFor(record, m.notice))
        .sort((a, b) => (a.deadline.days ?? 9999) - (b.deadline.days ?? 9999))
        .slice(0, 2)
      for (const m of fits) {
        push({
          id: `grant:${m.notice.id}`,
          kind: 'grant',
          title: `${m.notice.title} — 도전해 볼까요?`,
          why: `지역 · 업력 · 업종 조건이 맞습니다 · ${m.deadline.label}${m.notice.amountText ? ` · ${m.notice.amountText}` : ''}`,
          yesLabel: '도전해 볼 만함',
          noLabel: '안 함',
          effect: { type: 'grant', noticeId: m.notice.id },
          openPath: `/grants?view=clients&client=${encodeURIComponent(record.id)}`,
          rank: 40,
        })
      }
    } catch {
      // 공고 판정이 실패해도 멈추지 않는다
    }
  }

  // 4) 서류 기한 — 끝났거나 14일 안. 맞으면 서류 요청 문구 복사
  const due = documentsWithExpiry(record, today).filter(({ view }) => view.daysLeft !== null && view.daysLeft <= 14)
  if (due.length) {
    const first = due[0]
    const names = due.map((d) => d.meta.label).slice(0, 3).join(' · ')
    push({
      id: `doc:${due.map((d) => `${d.meta.key}@${d.view.expiresOn}`).join(',')}`,
      kind: 'doc',
      title: `${names}${due.length > 3 ? ` 외 ${due.length - 3}가지` : ''} 새로 받기 — 요청할까요?`,
      why: (first.view.daysLeft ?? 0) < 0 ? `${first.meta.label} 유효기간이 ${md(first.view.expiresOn)}에 끝났습니다` : `${first.meta.label} 유효기간이 ${md(first.view.expiresOn)}에 끝납니다`,
      yesLabel: '요청 문구 복사',
      noLabel: '나중에',
      effect: { type: 'copy', text: buildDocumentRequestMessage(record, today) },
      openPath: `/ops/clients/${record.id}?tab=docs`,
      rank: (first.view.daysLeft ?? 0) < 0 ? 15 : 35,
    })
  }

  const stage = salesStageOf(record)
  const contracted = contractStageOf(record.status) === 'signed'

  // 5) 받을 돈 — 받기로 한 날이 지난 돈(조건 대기는 아니다). 업체마다 오래된 둘
  try {
    const funding = fundingFactsOf(record.fundingApplications)
    const late = record.fees
      .filter((f) => feeStateOf(f, today, funding) === 'overdue')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 2)
    for (const f of late) {
      const days = daysBetween(f.dueDate, today)
      push({
        id: `money:${f.id}@${f.dueDate}`,
        kind: 'money',
        title: `${f.label || '수금'}${f.amount ? ` ${won(f.amount)}` : ''} — 입금 요청 문구를 보낼까요?`,
        why: `받기로 한 날(${md(f.dueDate)})이 ${days}일 지났습니다`,
        yesLabel: '요청 문구 복사',
        noLabel: '나중에',
        effect: { type: 'copy', text: paymentReminderMessage(record, f.label, f.amount, f.dueDate), log: `입금 요청 문구 복사 · ${f.label || '수금'}` },
        openPath: `/ops/clients/${record.id}?tab=fees`,
        rank: 18,
        doneText: '입금 요청 문구를 복사했습니다 — 카톡에 붙여 보내세요',
      })
    }
  } catch {
    // 돈 계산이 실패해도 다른 결정 거리는 보인다
  }

  // 6) 밀린 업무 — 진행 중 · 고객 대기인데 기한이 일주일 넘게 지남 → 2주 뒤로 다시 잡기
  for (const meta of SERVICES) {
    const st = record.services[meta.key]
    if (!st || !(st.status === 'in_progress' || st.status === 'waiting_client') || !isYmd(st.dueDate)) continue
    const over = daysBetween(st.dueDate, today)
    if (over < 7) continue
    const date = weekdayOnOrAfter(addDaysLocal(today, 14))
    push({
      id: `stale:${meta.key}@${st.dueDate}`,
      kind: 'stale',
      title: `${meta.shortLabel} 기한을 ${friendlyDate(date)}로 다시 잡을까요?`,
      why: `기한(${md(st.dueDate)})이 ${over}일 지났는데 아직 ${st.status === 'waiting_client' ? '고객 대기' : '진행 중'}입니다`,
      yesLabel: '2주 뒤로 다시 잡기',
      noLabel: '그대로',
      effect: { type: 'due', serviceKey: meta.key, date },
      openPath: `/ops/clients/${record.id}?tab=work&svc=${meta.key}`,
      rank: 25,
      doneText: `기한을 ${md(date)}로 다시 잡았습니다`,
    })
  }

  // 7) 다음 약속 — 없거나 일주일 넘게 지남(보류 · 이탈은 '다시 연락' 이 맡는다)
  if (stage !== 'hold' && stage !== 'lost') {
    const text = record.nextAction.trim()
    if (text && isYmd(record.nextActionDueDate) && daysBetween(record.nextActionDueDate, today) >= 7) {
      const late = daysBetween(record.nextActionDueDate, today)
      const date = weekdayOnOrAfter(addDaysLocal(today, 3))
      push({
        id: `next:late:${sig(`${text}@${record.nextActionDueDate}`)}`,
        kind: 'next',
        title: `'${text}' — ${friendlyDate(date)}로 다시 잡을까요?`,
        why: `다음 약속 날짜(${md(record.nextActionDueDate)})가 ${late}일 지났습니다`,
        yesLabel: '다시 잡기',
        noLabel: '그대로',
        effect: { type: 'next', text, date },
        openPath: `/ops/clients/${record.id}`,
        rank: 28,
        doneText: `다음 약속을 ${md(date)}로 다시 잡았습니다`,
      })
    } else if (!text && !record.nextActionDueDate) {
      const suggest = nextSuggestions(record)[0] ?? '진행 상황 확인 통화'
      const what = contracted && suggest === '진행 상황 보고' ? '진행 상황 보고 통화' : suggest
      const date = weekdayOnOrAfter(addDaysLocal(today, 7))
      push({
        // 한 달에 한 번만 묻는다(아니라고 하면 이번 달은 다시 안 묻는다)
        id: `next:empty:${today.slice(0, 7)}`,
        kind: 'next',
        title: `다음 약속이 없어요 — '${what}' ${friendlyDate(date)}로 잡을까요?`,
        why: contracted ? '계약 고객인데 다음에 할 일이 비어 있습니다' : '잠재고객인데 다음에 할 일이 비어 있습니다',
        yesLabel: '잡기',
        noLabel: '안 잡음',
        effect: { type: 'next', text: what, date },
        openPath: `/ops/clients/${record.id}`,
        rank: 50,
        doneText: `다음 약속을 잡았습니다 — ${md(date)}`,
      })
    }
  }

  // 8) 다시 연락 — 오래 조용한 잠재고객(계약 고객은 오늘 '안부 챙길 계약 고객' 이 맡는다)
  if (!contracted && stage !== 'contracted') {
    try {
      const rc = salesRecontacts([record], new Date(`${today}T12:00:00`))[0]
      if (rc) {
        push({
          id: `followup:${(lastSalesTouch(record) ?? '').slice(0, 10)}`,
          kind: 'followup',
          title: `${rc.days >= 999 ? '연락 기록이 없어요' : `${rc.days}일째 연락이 없어요`} — 다시 연락 문구를 보낼까요?`,
          why: rc.reasons.join(' · '),
          yesLabel: '연락 문구 복사',
          noLabel: '안 함',
          effect: { type: 'copy', text: rc.ment, log: '다시 연락 문구 복사' },
          openPath: `/sales/meeting?client=${record.id}`,
          rank: 45,
          doneText: '연락 문구를 복사했습니다 — 카톡에 붙여 보내세요',
        })
      }
    } catch {
      // 영업 신호가 실패해도 멈추지 않는다
    }
  }

  return out.sort((a, b) => a.rank - b.rank)
}

/** 여러 업체 — 업체마다 위에서 몇 개씩, 급한 것(작은 rank) 먼저 */
export function buildAllDecisions(records: readonly ClientOpsRecord[], today: string, notices: readonly GrantNotice[], usable?: (key: string) => boolean): Decision[] {
  return records.flatMap((r) => buildDecisions(r, today, notices, usable)).sort((a, b) => a.rank - b.rank || a.clientName.localeCompare(b.clientName, 'ko'))
}

/**
 * 답을 업체 기록에 적는다 — 기록만 바뀌는 효과(정보 넣기 · 도전 체크)는 여기서 함께.
 * 할 일 만들기 · 문구 복사는 화면이 한다(일기 · 클립보드).
 */
export function withDecisionAnswer(record: ClientOpsRecord, d: Pick<Decision, 'id' | 'effect'>, answer: 'yes' | 'no', notices: readonly GrantNotice[], now: string): ClientOpsRecord {
  let next = record
  if (d.effect.type === 'fact') {
    next = withFactDecisions(next, [{ id: d.effect.pendingId, action: answer === 'yes' ? 'accept' : 'reject' }], now)
  } else if (d.effect.type === 'grant' && answer === 'yes') {
    const notice = notices.find((n) => n.id === (d.effect as { noticeId: string }).noticeId)
    if (notice) next = withGrantChallenge(next, notice).record
  } else if (d.effect.type === 'next' && answer === 'yes') {
    next = withNextAction(next, d.effect.text, d.effect.date, { at: now })
  } else if (d.effect.type === 'due' && answer === 'yes') {
    if (next.services[d.effect.serviceKey]) next = withService(next, d.effect.serviceKey, { dueDate: d.effect.date })
  } else if (d.effect.type === 'copy' && answer === 'yes' && d.effect.log) {
    // 입금 요청은 고객에게 연락한 것(안부와 같은 칸) · 다시 연락은 영업 기록
    next = withActivity(next, d.effect.log.startsWith('입금') ? 'care' : 'sales', d.effect.log, null, now)
  }
  const decided = { ...(next.decided ?? {}), [d.id]: { a: answer, at: now } }
  // 오래된 답은 300개까지만(기록이 끝없이 커지지 않게)
  const keys = Object.keys(decided)
  if (keys.length > 300) for (const k of keys.sort((x, y) => decided[x].at.localeCompare(decided[y].at)).slice(0, keys.length - 300)) delete decided[k]
  return { ...next, decided }
}
