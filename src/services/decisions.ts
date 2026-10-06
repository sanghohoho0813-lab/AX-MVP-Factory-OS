/**
 * 확인함 (D-158) — 프로그램이 먼저 준비하고, 대표는 '맞아요 / 아니에요' 만 고른다.
 *
 * 업체 기록 · 올린 서류 · 받아 둔 공고를 읽어 결정할 거리를 한 줄씩 만든다.
 *   fact   자료에서 읽은 회사 정보(설립일 · 매출 …) — 맞으면 업체 정보로, 아니면 다시 묻지 않는다
 *   module 모듈 판정이 '가능성 높음' — 맞으면 그 일을 할 일로 건다(3일 뒤)
 *   grant  조건이 꼭 맞는 공고(마감 전) — 맞으면 '도전해 볼 만함' 체크(마감이 일정 · 오늘에)
 *   doc    서류 유효기간 끝남 · 14일 안 — 맞으면 서류 요청 문구를 복사
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

export type DecisionKind = 'fact' | 'module' | 'grant' | 'doc'

export const DECISION_KIND_LABEL: Record<DecisionKind, string> = {
  fact: '자료에서 읽은 정보',
  module: '해 볼 만한 일',
  grant: '맞는 지원사업',
  doc: '서류 기한',
}

export type DecisionEffect =
  | { type: 'fact'; pendingId: string }
  | { type: 'todo'; text: string; dueInDays: number }
  | { type: 'grant'; noticeId: string }
  | { type: 'copy'; text: string }

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
  }
  const decided = { ...(next.decided ?? {}), [d.id]: { a: answer, at: now } }
  // 오래된 답은 300개까지만(기록이 끝없이 커지지 않게)
  const keys = Object.keys(decided)
  if (keys.length > 300) for (const k of keys.sort((x, y) => decided[x].at.localeCompare(decided[y].at)).slice(0, keys.length - 300)) delete decided[k]
  return { ...next, decided }
}
