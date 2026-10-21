/**
 * AI 도우미 — 화면마다 보낼 자료 묶음(D-239). 화면이 이미 계산해 둔 목록을 그대로 받아, 보이는 것과 같은 것을 보낸다.
 * 사람 이름 · 연락처는 빼고(context.ts 의 safeText · personNames), 줄마다 ref 로 화면 주소를 남긴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import type { CustomerEvent, JournalEntry } from '../../types/bridge'
import type { BriefAction, MoneySignals } from '../dailyBriefService'
import type { AgendaItem } from '../upcomingAgenda'
import type { ScheduleEvent } from '../clientOpsSchedule'
import type { SalesRecontact, SalesRisk } from '../salesSignals'
import type { CareItem } from '../clientCare'
import { lastSalesTouch } from '../salesSignals'
import { daysInStage, isContractClient, isProspect, salesStageOf } from '../salesPipeline'
import { UNNAMED_AGENT, agentLedger, agentLedgerTotals } from '../feeMath'
import { isOpenEvent, waitingDays } from '../customerBridgeService'
import { regionOf } from '../clientOpsProfile'
import { COST_CATEGORY_LABEL, PAY_METHOD_LABEL, isActiveSub, monthlyEquivalent, nextCharge, outlook, toKrw } from '../finance/financeCore'
import type { Expense, FinanceSettings, Subscription } from '../finance/financeCore'
import { GRANT_CATEGORY_LABEL, VERDICT_LABEL, deadlineOf } from '../grants/grantMatch'
import type { GrantNotice } from '../grants/grantMatch'
import type { GrantClient, GrantIndex } from '../grants/grantView'
import { INSIGHT_TONE_LABEL, buildInsights } from '../clientInsights'
import type { Insight } from '../clientInsights'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { latestEmploymentRoster } from '../toolResultGroups'
import { RefBook, clientRow, daysBetween, personNames, safeText, wonText } from './context'
import type { AssistBundle, AssistRow, AssistSection } from './context'
import { STRENGTH_LABEL, myChannelStats, ratioLine } from '../marketing/ytRadar'
import type { RadarPlan, RadarVideo, RisingTopic } from '../marketing/ytRadar'
import { BRIEF_FIELDS, DEFAULT_BRIEF, IDEA_STATUS_LABEL, MAKE_CHECKS } from '../marketing/radarStore'
import type { ChannelBrief, ContentIdea } from '../marketing/radarStore'
import { shootKit } from '../marketing/shootKit'
import { linkedVideo, perfOf } from '../marketing/myPerformance'
import { PACK_RULES, PACK_SECTIONS, type ContentPack } from '../marketing/contentPack'
import { ANGLES, RISKY_WORDS, aiRequestFacts, aiRequestText, briefSlots } from '../contentStudio'
import type { ContentProfile, ProfileSource } from '../contentStudio'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

export function todayLabel(today: string): string {
  const d = new Date(`${today}T00:00:00`)
  return Number.isNaN(d.getTime()) ? today : `${today} (${WEEKDAY[d.getDay()]})`
}

/** 도구 기한 제목의 직원 이름('청년도약 참여신청 — 홍길동')을 가린다 */
export function maskStaff(title: string): string {
  return title.replace(/(참여신청|신청|직원)\s*[—–-]\s*[^\s·(),]{2,12}/g, '$1 — (직원)')
}

/** D-244 0 → A · 25 → Z · 26 → A2 … */
function agentLetter(k: number): string {
  return `${String.fromCharCode(65 + (k % 26))}${k >= 26 ? Math.floor(k / 26) + 1 : ''}`
}

function namesOf(byId: Map<string, ClientOpsRecord>, id: string | null | undefined): string[] {
  const r = id ? byId.get(id) : undefined
  return r ? personNames(r) : []
}

/* ------------------------------------------------------------------ */
/* 오늘 할 일                                                             */
/* ------------------------------------------------------------------ */

export interface TodayInput {
  today: string
  clients: ClientOpsRecord[]
  overdueTodos: JournalEntry[]
  todayTodos: JournalEntry[]
  hardDue: BriefAction[]
  appointments: ScheduleEvent[]
  agenda: AgendaItem[]
  agendaLate: AgendaItem[]
  money: MoneySignals
  weekIn: { count: number; total: number }
  salesRisks: SalesRisk[]
  recontacts: SalesRecontact[]
  care: CareItem[]
  openEvents: number
  agentPayable: number
  /** 3일 안 정기 결제(있으면) */
  charges?: { name: string; date: string; amount: string }[]
}

export function todayBundle(i: TodayInput): AssistBundle {
  const book = new RefBook()
  const byId = new Map(i.clients.map((c) => [c.id, c]))
  const todo = (j: JournalEntry): AssistRow => {
    const c = j.clientId ? byId.get(j.clientId) : undefined
    const ref = c ? book.client(c) : book.ref('t', j.id, '/journal')
    return { ref, 할일: safeText(j.content, namesOf(byId, j.clientId), 200), 기한: j.dueDate, 업체: c?.companyName ?? '' }
  }
  const clientRef = (id: string | null | undefined, href?: string) => {
    const c = id ? byId.get(id) : undefined
    return c ? book.client(c) : href ? book.ref('t', href, href) : undefined
  }
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '오늘 할 일',
      today: todayLabel(i.today),
      purpose: '하루를 놓치지 않게 — 오늘 꼭 할 일 · 기한 · 약속 · 돈',
      sections: [
        { name: '밀린 할 일', rows: i.overdueTodos.slice(0, 40).map(todo), total: i.overdueTodos.length },
        { name: '오늘 할 일', rows: i.todayTodos.slice(0, 40).map(todo), total: i.todayTodos.length },
        {
          name: '놓치면 끝나는 기한(7일 안)',
          rows: i.hardDue.slice(0, 30).map((h) => ({ ref: clientRef(h.clientId, h.href), 일: safeText(maskStaff(h.title), namesOf(byId, h.clientId), 160), 업체: h.clientName, 왜: safeText(maskStaff(h.reason), [], 120), 급함: h.severity === 'critical' ? '매우 급함' : h.severity === 'warning' ? '급함' : '' })),
        },
        {
          name: '업체 약속(지난 것 · 오늘 · 내일)',
          rows: i.appointments.slice(0, 30).map((e) => ({ ref: clientRef(e.clientId), 업체: e.clientName, 약속: safeText(e.title, namesOf(byId, e.clientId), 140), 날짜: e.date, 남은날: e.daysLeft })),
        },
        {
          name: '다가오는 마감 · 약속(14일)',
          rows: i.agenda.slice(0, 40).map((a) => ({ ref: clientRef(a.clientId, a.href), 날짜: a.date, 남은날: a.daysLeft, 종류: a.kindLabel, 업체: a.clientName, 일: safeText(maskStaff(a.title), namesOf(byId, a.clientId), 140) })),
          total: i.agenda.length,
        },
        {
          name: '지난 마감(아직 안 끝남)',
          rows: i.agendaLate.slice(0, 15).map((a) => ({ ref: clientRef(a.clientId, a.href), 날짜: a.date, 지난날: -a.daysLeft, 종류: a.kindLabel, 업체: a.clientName, 일: safeText(maskStaff(a.title), namesOf(byId, a.clientId), 140) })),
          total: i.agendaLate.length,
        },
        {
          name: '밀린 돈(받을 날 지남)',
          rows: i.money.overdue.items.slice(0, 20).map((m) => ({ ref: clientRef(m.clientId), 업체: m.clientName, 항목: safeText(m.label, namesOf(byId, m.clientId), 80), 금액: wonText(m.amount), 받을날: m.dueDate })),
          total: i.money.overdue.count,
        },
        // D-244: 규칙이 만든 글도 한 번 더 거른다(뒤에 자유 글이 섞여도 연락처가 나가지 않게)
        { name: '영업 — 챙길 곳', rows: i.salesRisks.slice(0, 15).map((s) => ({ ref: book.client(s.record), 업체: s.record.companyName, 이유: safeText(s.reason, personNames(s.record), 120), 할일: safeText(s.action, personNames(s.record), 80) })) },
        { name: '영업 — 다시 연락할 곳', rows: i.recontacts.slice(0, 12).map((s) => ({ ref: book.client(s.record), 업체: s.record.companyName, 이유: safeText(s.reasons.join(' · '), personNames(s.record), 160), 조용한날: s.days })) },
        { name: '안부 챙길 계약 고객', rows: i.care.slice(0, 12).map((c) => ({ ref: clientRef(c.clientId), 업체: c.companyName, 이유: c.reason === 'anniversary' ? '계약 1주년' : `${c.quietDays}일 조용`, 급함: c.urgent ? '급함' : '' })) },
        ...(i.charges && i.charges.length ? [{ name: '3일 안 정기 결제', rows: i.charges.map((c) => ({ 결제: safeText(c.name, [], 60), 날짜: c.date, 금액: c.amount })) }] : []),
      ],
      facts: [
        `이번 주 받을 돈(내 몫) ${wonText(i.weekIn.total) || '0원'} · ${i.weekIn.count}건`,
        `받을 날 지난 돈 ${wonText(i.money.overdue.total) || '0원'} · ${i.money.overdue.count}건`,
        `처리 안 한 상담신청 ${i.openEvents}건`,
        i.agentPayable > 0 ? `영업자에게 줄 돈 ${wonText(i.agentPayable)}` : '',
      ].filter(Boolean),
    },
  }
}

/* ------------------------------------------------------------------ */
/* 영업 관리                                                              */
/* ------------------------------------------------------------------ */

export function salesBundle(records: ClientOpsRecord[], today: string, risks: SalesRisk[] = []): AssistBundle {
  const book = new RefBook()
  const live = records.filter((r) => r.archivedAt === null && salesStageOf(r) !== 'contracted' && salesStageOf(r) !== 'lost')
  const order = ['closing', 'proposal', 'meeting', 'contacted', 'lead', 'hold']
  live.sort((a, b) => order.indexOf(salesStageOf(a)) - order.indexOf(salesStageOf(b)) || (b.sales?.expectedFee ?? 0) - (a.sales?.expectedFee ?? 0))
  const riskOf = new Map(risks.map((r) => [r.record.id, r]))
  const rows = live.slice(0, 80).map((r) =>
    clientRow(book, r, {
      today,
      notes: 2,
      extra: (x) => ({
        단계에머문날: daysInStage(x) ?? '',
        제안: x.sales?.proposal ? `${safeText((x.sales.proposal.packages ?? []).slice(0, 4).join(' · '), personNames(x), 160)}${x.sales.proposal.feeManwon ? ` · ${x.sales.proposal.feeManwon}만원` : ''}` : '',
        걸림돌: safeText(riskOf.get(x.id)?.reason, personNames(x), 120),
        유입: safeText(x.sales?.source, [], 30),
      }),
    }),
  )
  const won = records.filter((r) => r.archivedAt === null && salesStageOf(r) === 'contracted' && (r.sales?.movedAt ?? '').slice(0, 7) === today.slice(0, 7))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '영업 관리',
      today: todayLabel(today),
      purpose: '잠재고객을 계약까지 — 단계마다 다음 한 걸음',
      sections: [{ name: '진행 중인 영업', rows, total: live.length }],
      facts: [`이번 달 계약 ${won.length}곳`, `진행 중 ${live.length}곳`],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 고객 관리(계약 고객 · 잠재고객)                                            */
/* ------------------------------------------------------------------ */

export function clientsBundle(records: ClientOpsRecord[], today: string, reco?: { chips: Map<string, { label: string; tone: string }[]> }, segment: 'all' | 'contract' | 'prospect' | string = 'all'): AssistBundle {
  const book = new RefBook()
  const live = records.filter((r) => r.archivedAt === null)
  const pool = segment === 'contract' ? live.filter((r) => isContractClient(r)) : segment === 'prospect' ? live.filter((r) => isProspect(r)) : live
  // 오래 조용한 곳이 먼저 보이게(여러 달 연락 안 된 곳 질문이 있어서)
  const quiet = (r: ClientOpsRecord) => {
    const t = lastSalesTouch(r)
    return t ? (daysBetween(t, today) ?? 0) : 9999
  }
  const sorted = [...pool].sort((a, b) => quiet(b) - quiet(a))
  const rows = sorted.slice(0, 80).map((r) =>
    clientRow(book, r, {
      today,
      notes: 3,
      extra: (x) => ({
        OS추천: (reco?.chips.get(x.id) ?? []).map((c) => `${c.label}(${c.tone === 'good' ? '가능성 높음' : '검토해 볼 만함'})`),
        계약일: x.contract?.signedAt ? x.contract.signedAt.slice(0, 10) : '',
      }),
    }),
  )
  return {
    links: book.links, ids: book.ids,
    context: {
      title: segment === 'prospect' ? '고객 관리 · 잠재고객' : segment === 'contract' ? '고객 관리 · 계약 고객' : '고객 관리',
      today: todayLabel(today),
      purpose: '놓치는 업체 없게 — 오래 조용한 곳 · 계약 가능성 · 제안할 것',
      sections: [{ name: '업체(오래 조용한 순)', rows, total: pool.length }],
      facts: [`계약 고객 ${live.filter((r) => isContractClient(r)).length}곳 · 잠재고객 ${live.filter((r) => isProspect(r)).length}곳`],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 잠재고객 상담신청함                                                      */
/* ------------------------------------------------------------------ */

const EVENT_SAFE_KEYS: Record<string, string> = {
  company_name: '회사',
  company: '회사',
  message: '문의',
  program: '관심 프로그램',
  industry: '업종',
  business_type: '사업자',
  lead_grade: '등급',
  title: '제목',
  body: '내용',
  request_type: '요청',
  product_slug: '상품',
  source: '유입',
}

export function inboxBundle(events: CustomerEvent[], clients: ClientOpsRecord[], today: string): AssistBundle {
  const book = new RefBook()
  const byId = new Map(clients.map((c) => [c.id, c]))
  const open = events.filter(isOpenEvent).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  const rows: AssistRow[] = open.slice(0, 60).map((e) => {
    const linked = e.operationsClientId ? byId.get(e.operationsClientId) : undefined
    const p = e.payload ?? {}
    // 사람 이름 칸(이름 · 대표자 · 연락처 · 이메일)은 읽지도 않는다 — 알려진 칸만
    const row: AssistRow = { ref: linked ? book.client(linked) : book.ref('e', e.id, '/ops/inbox'), 받은날: e.receivedAt.slice(0, 10), 기다린날: waitingDays(e, today), 상태: e.status, 중요: e.priority }
    const names = [p.representative_name, p.buyer_name, p.name].filter((x): x is string => typeof x === 'string')
    for (const [k, label] of Object.entries(EVENT_SAFE_KEYS)) {
      const v = p[k]
      if (typeof v === 'string' && v.trim() && row[label] === undefined) row[label] = safeText(v, names, k === 'message' || k === 'body' ? 400 : 80)
    }
    if (linked) row['연결된 업체'] = `${linked.companyName} · ${regionOf(linked.businessAddress)}`
    if (e.handlingNote) row['처리 메모'] = safeText(e.handlingNote, names, 160)
    return row
  })
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '잠재고객 상담신청',
      today: todayLabel(today),
      purpose: '들어온 신청을 놓치지 않고 계약으로',
      sections: [{ name: '처리 안 한 신청(오래된 순)', rows, total: open.length }],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 영업자 정산                                                            */
/* ------------------------------------------------------------------ */

export function agentsBundle(records: ClientOpsRecord[], today: string): AssistBundle {
  const book = new RefBook()
  const rows = agentLedger(records)
  const totals = agentLedgerTotals(rows)
  const byId = new Map(records.map((r) => [r.id, r]))
  const year = today.slice(0, 4)
  // D-244 영업자 이름은 보내지 않는다 — 가나다순으로 '영업자 A · B …'(같은 사람들이면 같은 별칭). 별칭 → 이름은 aliases 로 브라우저에만
  const aliasOf = new Map<string, string>()
  const aliases: Record<string, string> = {}
  const names = [...new Set(rows.map((a) => a.name))].filter((n) => n !== UNNAMED_AGENT).sort((a, b) => a.localeCompare(b, 'ko'))
  names.forEach((n, k) => {
    const al = `영업자 ${agentLetter(k)}`
    aliasOf.set(n, al)
    aliases[al] = n
  })
  const who = (n: string) => aliasOf.get(n) ?? n
  const items: AssistRow[] = []
  for (const a of rows) {
    for (const it of a.items) {
      const rec = byId.get(it.clientId)
      const fee = rec?.fees.find((f) => f.id === it.feeId)
      items.push({
        ref: rec ? book.client(rec) : undefined,
        영업자: who(a.name),
        업체: it.clientName,
        항목: safeText(it.label, [...(rec ? personNames(rec) : []), ...names], 60),
        고객금액: wonText(it.amount),
        영업자몫: wonText(it.agentFee),
        상태: it.agentPaidAt ? `줌 ${it.agentPaidAt.slice(0, 10)}` : it.receivedAt ? `줄 돈(고객 입금 ${it.receivedAt.slice(0, 10)})` : '고객 입금 기다림',
        고객입금예정: fee?.dueDate ?? '',
        조건: fee?.conditionText ? safeText(fee.conditionText, names, 60) : '',
      })
    }
  }
  const paidThisYear = rows.flatMap((a) => a.items).filter((it) => it.agentPaidAt && it.agentPaidAt.slice(0, 4) === year).reduce((n, it) => n + (it.agentFee ?? 0), 0)
  return {
    links: book.links, ids: book.ids, aliases,
    context: {
      title: '영업자 정산',
      today: todayLabel(today),
      purpose: '영업자에게 줄 돈과 줄 날을 놓치지 않게',
      sections: [
        { name: '영업자별 합계', rows: rows.map((a) => ({ 영업자: who(a.name), 줄돈: wonText(a.payable), 준돈: wonText(a.paid), 기다리는돈: wonText(a.waiting), 업체수: new Set(a.items.map((x) => x.clientId)).size })) },
        { name: '정산 항목', rows: items.slice(0, 120), total: items.length },
      ],
      facts: [`전체 — 줄 돈 ${wonText(totals.payable) || '0원'} · 준 돈 ${wonText(totals.paid) || '0원'} · 기다리는 돈 ${wonText(totals.waiting) || '0원'}`, `올해(${year}) 이미 준 돈 ${wonText(paidThisYear) || '0원'}`],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 일정                                                                   */
/* ------------------------------------------------------------------ */

export function calendarBundle(i: { today: string; events: ScheduleEvent[]; journal: JournalEntry[]; clients: ClientOpsRecord[]; daysOff: { date: string; name: string }[] }): AssistBundle {
  const book = new RefBook()
  const byId = new Map(i.clients.map((c) => [c.id, c]))
  const end = new Date(`${i.today}T00:00:00`)
  end.setDate(end.getDate() + 45)
  const until = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  const inRange = (d: string) => d >= i.today && d <= until
  const ev = i.events.filter((e) => !e.done && inRange(e.date)).sort((a, b) => a.date.localeCompare(b.date))
  const todos = i.journal.filter((j) => j.entryType === 'follow_up' && !j.completed && j.dueDate && (inRange(j.dueDate) || j.dueDate < i.today)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '일정',
      today: todayLabel(i.today),
      purpose: '이번 주 · 이번 달 일정과 마감을 한눈에',
      sections: [
        {
          name: '업체 일정 · 마감(오늘부터 45일)',
          rows: ev.slice(0, 80).map((e) => {
            const c = byId.get(e.clientId)
            return { ref: c ? book.client(c) : undefined, 날짜: `${todayLabel(e.date)}`, 종류: e.kind, 업체: e.clientName, 일: safeText(maskStaff(e.title), c ? personNames(c) : [], 140), 되돌릴수없음: e.hard ? '예' : '' }
          }),
          total: ev.length,
        },
        {
          name: '내가 적은 할 일',
          rows: todos.slice(0, 60).map((j) => {
            const c = j.clientId ? byId.get(j.clientId) : undefined
            return { ref: c ? book.client(c) : book.ref('t', j.id, '/journal'), 기한: todayLabel(j.dueDate), 할일: safeText(j.content, c ? personNames(c) : [], 160), 업체: c?.companyName ?? '', 밀림: j.dueDate < i.today ? '밀림' : '' }
          }),
          total: todos.length,
        },
        { name: '쉬는 날', rows: i.daysOff.filter((d) => inRange(d.date)).slice(0, 30).map((d) => ({ 날짜: todayLabel(d.date), 이름: safeText(d.name, [], 30) })) },
      ],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 매출 · 비용                                                            */
/* ------------------------------------------------------------------ */

export function moneyBundle(i: {
  today: string
  ym: string
  records: ClientOpsRecord[]
  subscriptions: readonly Subscription[]
  expenses: readonly Expense[]
  settings: FinanceSettings
}): AssistBundle {
  const book = new RefBook()
  const input = { records: i.records, subscriptions: i.subscriptions, expenses: i.expenses, settings: i.settings }
  const ahead = outlook(input, i.today, 6)
  const now = ahead[0]
  const subs = i.subscriptions.filter((s) => isActiveSub(s, i.today))
  const byId = new Map(i.records.map((r) => [r.id, r]))
  // 최근 6달 비용(한 번 쓴 비용) — 1년 예상의 근거
  const since = `${String(Number(i.today.slice(0, 4)) - (Number(i.today.slice(5, 7)) <= 6 ? 1 : 0))}-${String(((Number(i.today.slice(5, 7)) + 5) % 12) + 1).padStart(2, '0')}-01`
  const recent = i.expenses.filter((e) => e.date >= since).sort((a, b) => b.date.localeCompare(a.date))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '매출 · 비용',
      today: todayLabel(i.today),
      purpose: '돈의 흐름 — 들어올 돈 · 나갈 돈 · 줄일 것',
      sections: [
        {
          name: '정기 결제(지금 쓰는 것)',
          rows: subs.slice(0, 60).map((s) => ({
            이름: safeText(s.name, [], 60),
            분류: COST_CATEGORY_LABEL[s.category] ?? s.category,
            금액: `${s.currency === 'USD' ? `$${s.amount}` : wonText(s.amount)} / ${s.cycle === 'yearly' ? '년' : '월'}`,
            월환산: wonText(monthlyEquivalent(s, i.settings)),
            일년환산: wonText(monthlyEquivalent(s, i.settings) * 12),
            다음결제: nextCharge(s, i.today),
            결제수단: s.payMethod ? PAY_METHOD_LABEL[s.payMethod] : '',
          })),
          total: subs.length,
        },
        {
          name: '최근 6달 비용(한 번씩 쓴 것)',
          rows: recent.slice(0, 80).map((e) => ({ 날짜: e.date, 이름: safeText(e.name, [], 60), 분류: COST_CATEGORY_LABEL[e.category] ?? e.category, 금액: e.currency === 'USD' ? `$${e.amount} (${wonText(toKrw(e.amount, e.currency, i.settings))})` : wonText(e.amount), 업체: e.clientId ? (byId.get(e.clientId)?.companyName ?? '') : '' })),
          total: recent.length,
        },
        {
          name: `이번 달(${i.ym}) 들어올 돈 · 들어온 돈`,
          rows: now.revenue.lines.slice(0, 60).map((l) => {
            const rec = byId.get(l.clientId)
            return { ref: rec ? book.client(rec) : undefined, 업체: l.clientName, 항목: safeText(l.label, rec ? personNames(rec) : [], 60), 금액: wonText(l.amount), 상태: l.kind === 'received' ? '들어옴' : l.kind === 'overdue' ? '밀림' : '예정', 날짜: l.date }
          }),
        },
        {
          name: '앞으로 6달(달마다)',
          rows: ahead.map((m) => ({ 달: m.ym, 들어온돈: wonText(m.revenue.received), 들어올예정: wonText(m.revenue.expected), 밀린돈: wonText(m.revenue.overdue), 나갈돈: wonText(m.cost.total), 정기결제: wonText(m.cost.subscriptions), 영업자수수료: wonText(m.cost.agent) })),
        },
        {
          name: '이번 달 비용 분류별',
          rows: now.cost.byCategory.map((c) => ({ 분류: COST_CATEGORY_LABEL[c.category as keyof typeof COST_CATEGORY_LABEL] ?? String(c.category), 금액: wonText(c.krw) })),
        },
      ],
      facts: [`정기 결제 한 달 합계(환산) ${wonText(subs.reduce((n, s) => n + monthlyEquivalent(s, i.settings), 0)) || '0원'}`, `달러 환율 ${i.settings.usdKrw}원으로 계산`],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 지원사업 알림                                                          */
/* ------------------------------------------------------------------ */

export function grantsBundle(i: { today: string; notices: readonly GrantNotice[]; clients: readonly GrantClient[]; index: GrantIndex; records: ClientOpsRecord[] }): AssistBundle {
  const book = new RefBook()
  const open = i.notices
    .map((n) => ({ n, d: deadlineOf(n, i.today), list: i.index.byNotice.get(n.id) ?? [] }))
    .filter((x) => x.d.open || x.d.state === 'upcoming')
  open.sort((a, b) => b.list.filter((m) => m.client.kind === 'contract').length - a.list.filter((m) => m.client.kind === 'contract').length || b.list.length - a.list.length || (a.d.days ?? 999) - (b.d.days ?? 999))
  const challenge = new Set(i.records.flatMap((r) => (r.fundingApplications ?? []).filter((a) => a.noticeId && a.status === 'watching').map((a) => `${r.id}:${a.noticeId}`)))
  const noticeRows = open.slice(0, 50).map(({ n, d, list }) => ({
    ref: book.ref('g', n.id, `/grants?notice=${encodeURIComponent(n.id)}`),
    공고: safeText(n.title, [], 120),
    기관: safeText(n.agency || n.operator, [], 40),
    분야: GRANT_CATEGORY_LABEL[n.category] ?? '',
    마감: d.label,
    남은날: d.days ?? '',
    지원금: safeText(n.amountText, [], 60),
    대상: safeText(n.target, [], 160),
    맞는업체: list.slice(0, 8).map((m) => `${m.client.record.companyName}(${m.client.kind === 'contract' ? '계약' : '잠재'} · ${VERDICT_LABEL[m.match.verdict]}${challenge.has(`${m.client.record.id}:${n.id}`) ? ' · 도전 체크' : ''})`),
  }))
  const clientRows = i.clients.slice(0, 60).map((c) => {
    const ms = (i.index.byClient.get(c.record.id) ?? []).filter((m) => m.verdict === 'fit').slice(0, 5)
    return { ref: book.client(c.record), 업체: c.record.companyName, 구분: c.kind === 'contract' ? '계약 고객' : '잠재고객', 지역: regionOf(c.record.businessAddress), 업종: safeText(c.record.industry, [], 40), 맞는공고: ms.map((m) => `${safeText(m.notice.title, [], 60)}(${m.deadline.label})`) }
  })
  return {
    links: book.links, ids: book.ids,
    context: {
      title: '지원사업 알림',
      today: todayLabel(i.today),
      purpose: '우리 고객에게 맞는 공고를 마감 전에',
      sections: [
        { name: '접수 중 · 접수 예정 공고(맞는 업체 많은 순)', rows: noticeRows, total: open.length },
        { name: '업체별 맞는 공고', rows: clientRows.filter((r) => r.맞는공고.length > 0), total: i.clients.length },
      ],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 업체 상세(한 업체)                                                     */
/* ------------------------------------------------------------------ */

export function clientBundle(record: ClientOpsRecord, today: string, insights: readonly Insight[], schedule: readonly ScheduleEvent[] = []): AssistBundle {
  const book = new RefBook()
  const names = personNames(record)
  const f = clientFacts(record, new Date(`${today}T00:00:00`))
  const ref = book.client(record)
  const row = clientRow(book, record, { today, notes: 6 })
  // D-244: 서류 칸 이름은 서류 제목에서 오기도 해서(예: '홍길동 등본') 한 번 거른다
  const docs = Object.entries(record.documents ?? {}).map(([k, d]) => safeText(`${k}: ${(d as { status?: string }).status ?? ''}`, names, 120))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: `업체 상세 · ${record.companyName}`,
      today: todayLabel(today),
      purpose: '이 업체 하나 — 지금 상태 · 맞는 모듈 · 다음 할 일',
      sections: [
        { name: '회사', rows: [{ ...row, 업력: f.years != null ? `${f.years}년` : '', 매출: f.revenue ? `${wonText(f.revenue.won)}(${f.revenue.asOf}${f.revenue.estimated ? ' · 예상' : ''})` : '', 사업자: f.businessType === 'corporation' ? '법인' : f.businessType === 'individual' ? '개인' : '', 대표나이: f.representativeAge != null ? `${Math.floor(f.representativeAge / 10) * 10}대` : '' }] },
        {
          name: 'OS 모듈 판정(규칙 계산)',
          rows: insights.slice(0, 12).map((x) => ({ ref, 모듈: x.label, 판정: INSIGHT_TONE_LABEL[x.tone], 한줄: safeText(x.headline, names, 160), 자세히: safeText(x.detail, names, 200), 금액: x.amount ?? '', 모자란것: x.missing.slice(0, 6) })),
        },
        {
          name: '일정 · 마감',
          rows: schedule.filter((e) => !e.done).slice(0, 20).map((e) => ({ ref, 날짜: e.date, 종류: e.kind, 일: safeText(maskStaff(e.title), names, 140), 남은날: e.daysLeft })),
        },
        {
          name: '받을 돈',
          rows: record.fees.slice(0, 20).map((x) => ({ ref, 항목: safeText(x.label, names, 60), 금액: wonText(x.amount), 받을날: x.dueDate, 받음: x.receivedAt ? x.receivedAt.slice(0, 10) : '아직', 조건: safeText(x.conditionText, [], 60) })),
        },
        { name: '서류함', rows: docs.slice(0, 40).map((d) => ({ 서류: d })) },
      ],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 전문 모듈 한눈에(고객 전체를 거꾸로)                                     */
/* ------------------------------------------------------------------ */

const MODULE_NAME: Record<string, string> = {
  'policy-funding': '정책자금',
  employment: '고용지원금',
  labcare: '기업부설연구소',
  'startup-tax': '창업감면',
  tax: '절세',
  cretop: '크레탑 재무',
  'cert-os': '기업인증',
  grants: '지원사업',
}

export function moduleBundle(i: { today: string; records: ClientOpsRecord[]; features: readonly string[]; notices: readonly GrantNotice[]; usable: (key: string) => boolean; title: string }): AssistBundle {
  const book = new RefBook()
  const want = new Set(i.features)
  const rows: AssistRow[] = []
  for (const r of i.records.filter((x) => x.archivedAt === null)) {
    let list: Insight[] = []
    try {
      list = buildInsights(r, i.today, i.notices, (k) => want.has(k) && (k === 'grants' || i.usable(k))).filter((x) => want.has(x.key))
    } catch {
      list = []
    }
    if (list.length === 0) continue
    const names = personNames(r)
    const roster = want.has('employment') ? latestEmploymentRoster(r) : null
    const rosterData = (roster?.data ?? {}) as { counts?: Record<string, number>; subsidySummary?: { name: string; candidateCount: number; level?: string }[]; subsidyTotal?: number }
    for (const x of list) {
      rows.push({
        ref: book.client(r),
        업체: r.companyName,
        구분: isContractClient(r) ? '계약' : '잠재',
        모듈: x.label,
        판정: INSIGHT_TONE_LABEL[x.tone],
        한줄: safeText(x.headline, names, 160),
        자세히: safeText(x.detail, names, 220),
        금액: x.amount ?? '',
        모자란것: x.missing.slice(0, 6),
        ...(x.key === 'employment' && roster
          ? { 명부: `명부 기준 ${roster.createdAt.slice(0, 10)}`, 명부지원금: (rosterData.subsidySummary ?? []).filter((s) => s.candidateCount > 0).map((s) => `${s.name} 대상 ${s.candidateCount}명`), 명부합계: wonText(rosterData.subsidyTotal ?? null) }
          : {}),
      })
    }
  }
  const rank: Record<string, number> = { '가능성 높음': 0, '검토해 볼 만함': 1, '정보가 더 필요해요': 2, '이미 함': 3, '해당 없음': 4 }
  rows.sort((a, b) => (rank[String(a.판정)] ?? 9) - (rank[String(b.판정)] ?? 9))
  return {
    links: book.links, ids: book.ids,
    context: {
      title: i.title,
      today: todayLabel(i.today),
      purpose: `고객 전체를 ${i.features.map((k) => MODULE_NAME[k] ?? k).join(' · ')} 기준으로 거꾸로 훑기 — 누구에게 무엇을 받아 줄 수 있나`,
      sections: [{ name: '업체 × 모듈 판정(규칙 계산 그대로)', rows: rows.slice(0, 120), total: rows.length }],
      facts: ['판정 · 금액은 OS 규칙 계산 결과다. 바꾸지 말고 그대로 쓴다.'],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 마케팅 · 콘텐츠 레이더                                                  */
/* ------------------------------------------------------------------ */

/** 미래AI랩이 누구인지 — 레이더 · 홍보 글 AI 가 같은 관점으로 쓰게 */
export const MIRAE_PROFILE = [
  '미래AI랩: 중소기업 대표를 돕는 컨설팅 회사 — 정책자금 · 고용지원금 · 기업부설연구소 · 창업감면 · 절세 · 지원사업 · AX(업무에 AI 넣기) · 기업인증.',
  '유튜브 · 블로그 시청자 = 중소기업 대표와 실무자. 말투는 쉬운 말, 과장 없이, 실제 사례와 숫자로.',
  '우리만 말할 수 있는 것: 수백 개 업체 상담에서 본 실제 실수 · 받을 수 있는데 몰라서 못 받는 돈 · AI 를 현장 업무에 붙여 본 경험.',
]

export interface RadarInput {
  today: string
  view: string
  plan: RadarPlan | null
  rising: readonly RisingTopic[]
  breakouts: readonly RadarVideo[]
  videos: readonly RadarVideo[]
  ideas: readonly ContentIdea[]
  mine: readonly RadarVideo[]
  /** D-241 채널 설계 기준(대표가 고침 · 없으면 기본값) */
  brief?: ChannelBrief | null
}

/**
 * D-241 콘텐츠 레이더 자료 — 대표: "미래AI랩이랑 전혀 어울리지 않는 방식 · 내 컨텐츠에 맞게 설계".
 * 예전(D-239)에는 남의 채널 영상과 회사 소개 3줄만 보내 일반론이 나왔다.
 * 이제 순서: ① 채널 설계 기준 ② 내 채널(최근 · 잘 된 것) ③ 이번 주 후보 + 찍기 키트(규칙 브리프) ④ 내 콘텐츠 ⑤ 남의 잘 된 영상 · 급상승.
 * 자료가 넘쳐 뒤를 줄여도 ①~③ 은 남는다(서버는 뒤쪽 줄부터 줄인다).
 */
export function radarBundle(i: RadarInput): AssistBundle {
  const book = new RefBook()
  const brief = i.brief ?? DEFAULT_BRIEF
  const vRow = (v: RadarVideo) => ({
    ref: book.ref('v', v.id, v.url),
    제목: safeText(v.title, [], 120),
    채널: safeText(v.channelName, [], 40),
    조회: v.views,
    평소대비: ratioLine(v),
    올린지: `${v.ageDays}일`,
    길이: v.isShort ? '쇼츠' : `롱폼 ${Math.round(v.durationSec / 60)}분`,
  })
  const mineRow = (v: RadarVideo) => ({
    ref: book.ref('v', v.id, v.url),
    제목: safeText(v.title, [], 120),
    길이: v.isShort ? '쇼츠' : `롱폼 ${Math.round(v.durationSec / 60)}분`,
    조회: v.views,
    성과: perfOf(v).label,
    평소대비: ratioLine(v),
    올린지: `${v.ageDays}일`,
  })
  const picks = i.plan?.picks ?? []
  const mineById = new Map(i.mine.map((v) => [v.id, v]))
  const mineRecent = [...i.mine].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20)
  const mineBest = [...i.mine].filter((v) => (v.adjusted ?? v.ratio ?? 0) > 1).sort((a, b) => (b.adjusted ?? b.ratio ?? 0) - (a.adjusted ?? a.ratio ?? 0)).slice(0, 6)
  const stats = myChannelStats(i.mine as RadarVideo[])
  const sections: AssistSection[] = [
    { name: '채널 설계 기준(대표가 정함 — 반드시 따름)', rows: BRIEF_FIELDS.map((f) => ({ 항목: f.label, 기준: safeText(brief[f.key], [], 300) })) },
    { name: '내 채널 최근 영상(새것부터)', rows: mineRecent.map(mineRow), total: i.mine.length },
    { name: '내 채널에서 평소보다 잘 된 영상', rows: mineBest.map(mineRow) },
    {
      name: '이번 주 찍을 후보(지금 순위대로 · 찍기 키트는 규칙으로 만든 브리프)',
      rows: picks.slice(0, 10).map((o, n) => {
        const kit = shootKit(o)
        return {
          // 같은 화면이라 주소는 두지 않는다(D-241 — 예전엔 '/marketing' 으로 이어져 눌러도 아무 일이 없었다). 답의 [내 콘텐츠에 담기] 가 이 번호로 후보를 찾는다
          ref: book.ref('o', o.key),
          순위: n + 1,
          주제: o.topic,
          신호: STRENGTH_LABEL[o.strength],
          왜지금: safeText(o.summary, [], 240),
          근거: o.facts.slice(0, 3),
          잘된영상: o.benchmarks.slice(0, 3).map((b) => `${safeText(b.title, [], 80)} (${safeText(b.channelName, [], 30)} · ${ratioLine(b)})`),
          미래AI랩관점_규칙: safeText(o.view, [], 300),
          잘된틀_우리제목: kit.frames.slice(0, 3).map((f) => `${f.label} → ${f.mine}`),
          첫문장_규칙: safeText(kit.hook, [], 160),
          구성_규칙: kit.outline.map((st) => `${st.at} ${st.what}`),
          쇼츠3컷_규칙: kit.shorts.map((st) => `${st.at} ${st.what}`),
          형식: kit.format,
          준비: kit.prep.slice(0, 3),
        }
      }),
    },
    {
      name: '내 콘텐츠(이미 담은 것 — 겹치지 않게)',
      rows: i.ideas.slice(0, 40).map((x) => {
        const linked = linkedVideo(x, mineById)
        return {
          ref: book.ref('i', x.id, `/marketing?view=make&idea=${encodeURIComponent(x.id)}`),
          주제: safeText(x.topic, [], 80),
          단계: IDEA_STATUS_LABEL[x.status],
          관점: safeText(x.angle, [], 200),
          첫문장: safeText(x.hook, [], 160),
          메모: safeText(x.memo, [], 400),
          촬영일: x.shootDate,
          게시일: x.publishDate,
          체크: `${x.checks.length}/${MAKE_CHECKS.length}`,
          제목후보: x.titleCandidates.slice(0, 3).map((t) => safeText(t, [], 120)),
          참고영상: x.benchmarkTitles.slice(0, 3).map((t) => safeText(t, [], 120)),
          대본: x.script ? `있음(${x.script.length.toLocaleString('ko-KR')}자)` : '',
          성과: linked ? `${perfOf(linked).label} · 조회 ${linked.views}` : x.link ? '올린 주소 있음(내 채널 숫자 없음)' : '',
        }
      }),
      total: i.ideas.length,
    },
    { name: '남의 채널 — 평소보다 크게 잘 된 영상(틀만 참고)', rows: i.breakouts.slice(0, 20).map(vRow), total: i.breakouts.length },
    {
      name: '인기 급상승 주제(2주)',
      rows: i.rising.slice(0, 12).map((r) => ({ 주제: safeText(r.label, [], 40), 영상: r.videos14, 채널: r.channels14, 오름세: r.growing ? '오름' : '', 터진영상: r.breakouts, 우리분야: r.fit ? '맞음' : '참고만', 예: r.recent.slice(0, 3).map((v) => safeText(v.title, [], 70)) })),
    },
    { name: '많이 쓴 제목 틀(잘된 영상 기준)', rows: (i.plan?.hot ?? []).slice(0, 8).map((h) => ({ 틀: h.label, 잘된영상중: `${h.hot}/${h.hotOf}`, 잘된몫: `${h.hotShare}%`, 전체몫: `${h.baseShare}%` })) },
  ]
  if (i.view === 'top' || i.view === 'analysis') {
    const top = [...i.videos].filter((v) => !v.mine).sort((a, b) => b.views - a.views).slice(0, 20)
    sections.push({ name: '이번 달 조회 많은 영상', rows: top.map(vRow) })
  }
  const facts = [...MIRAE_PROFILE]
  if (stats) {
    const longMin = stats.longMedian ? ` · 롱폼 조회 중간값 ${stats.longMedian.toLocaleString('ko-KR')}` : ''
    facts.push(`내 채널 최근 ${stats.count}편: 롱폼 ${stats.longCount} · 쇼츠 ${stats.shortCount}${longMin}${stats.cadenceDays ? ` · 평균 ${stats.cadenceDays}일마다 한 편` : ''}${stats.bestTopic ? ` · 가장 잘 된 주제 '${stats.bestTopic.label}'` : ''}${stats.bestPattern ? ` · 가장 잘 된 제목 틀 '${stats.bestPattern.label}'` : ''}`)
  } else {
    facts.push('내 채널 영상 자료가 아직 없다 — 채널 설계 기준(형식 · 말투)만으로 맞춘다.')
  }
  return { links: book.links, ids: book.ids, context: { title: '마케팅 · 브랜딩 · 콘텐츠 레이더', today: todayLabel(i.today), purpose: '내 채널(채널 설계 기준)에 맞게, 지금 잘되는 주제로 이번 주 찍을 영상을 정하고 대본까지 이어 간다', sections, facts } }
}

/**
 * D-251 이번 주 키워드 하나 → 콘텐츠 묶음을 AI 로(대표만 · 갈래 셋을 같은 자료로).
 * 순서: ① 고른 키워드(관점 · 제목 · 첫 문장 · 근거) ② 채널 설계 기준 ③ 규칙 초안(구성만 — 다듬을 뼈대) + [규칙집] = 이상한AI 규칙집(미래AI랩 채널용).
 */
export function packBundle(i: { today: string; pack: ContentPack; brief?: ChannelBrief | null }): AssistBundle {
  const p = i.pack
  const s = p.source
  const brief = i.brief ?? DEFAULT_BRIEF
  const outline = p.sections
    .filter((x) => x.id !== 'checks')
    .map((x) => ({ 칸: x.label, 구성: x.blocks.map((b) => safeText(b.label, [], 80)), 예시: safeText(x.blocks[1]?.text ?? x.blocks[0]?.text ?? '', [], 400) }))
  return {
    links: {},
    context: {
      title: `마케팅 · 콘텐츠 묶음 · ${p.topic}`,
      today: todayLabel(i.today),
      purpose: '이번 주 키워드 하나로 유튜브 대본 · 릴스 대본 · 블로그 글 · 카드뉴스 · 올릴 때 글을 검증된 방법대로 한 번에',
      sections: [
        {
          name: '고른 키워드(이 주제 하나로)',
          rows: [
            {
              주제: safeText(s.topic, [], 80),
              왜지금: safeText(s.why, [], 240),
              미래AI랩관점: safeText(s.view, [], 300),
              제목후보_규칙: s.titles.slice(0, 5).map((t) => safeText(t, [], 80)),
              썸네일_규칙: s.thumbs.slice(0, 3).map((t) => safeText(t, [], 60)),
              첫문장_규칙: safeText(s.hook, [], 160),
              근거_우리만: s.facts.slice(0, 3).map((f) => safeText(f, [], 120)),
              참고영상_제목은베끼지않기: s.refs.slice(0, 3).map((t) => safeText(t, [], 80)),
              직접고른주제: s.custom ? '예' : '',
            },
          ],
        },
        { name: '채널 설계 기준(대표가 정함 — 반드시 따름)', rows: BRIEF_FIELDS.map((f) => ({ 항목: f.label, 기준: safeText(brief[f.key], [], 300) })) },
        { name: `규칙 초안 뼈대(${PACK_SECTIONS.length - 1}칸 — 이 순서 · 칸 이름을 살려 다듬기)`, rows: outline },
      ],
      facts: [...MIRAE_PROFILE],
      rules: [...PACK_RULES],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 블로그 · 플레이스 홍보 글 — 규칙집(이상한 마케팅 방식) 그대로                   */
/* ------------------------------------------------------------------ */

export function contentBundle(i: { today: string; profile: ContentProfile; source: ProfileSource; keyword: string; mirae: boolean; items: readonly { title: string; kind: string; createdAt: string }[] }): AssistBundle {
  const p = i.profile
  const blogReq = aiRequestText(p, { kind: 'blog', keyword: i.keyword })
  const placeReq = aiRequestText(p, { kind: 'place' })
  const placeOnly = placeReq.split('\n').filter((l) => /^(채널|길이|지역)/.test(l.trim()))
  const rules = [
    '— 블로그 글일 때(아래 요청문 그대로) —',
    ...blogReq.split('\n').filter((l) => l.trim()),
    '— 플레이스 소개글일 때(위 업체 · 사실 · 넣지 말 것은 같고, 아래만 바꿈) —',
    ...placeOnly,
    '— 제목 각도 17개(서로 다른 검색 의도) —',
    ...ANGLES.map((a) => `${a.no}. ${a.label} (${a.intent}) — ${a.rule}`),
    `— 쓰지 말 말 — ${RISKY_WORDS.map((w) => `${w.word}(${w.why})`).join(' · ')}`,
  ]
  return {
    links: {},
    context: {
      title: `블로그 · 플레이스 홍보 글 · ${p.company}`,
      today: todayLabel(i.today),
      purpose: '업체 홍보 정보(사실)만으로 네이버 블로그 · 플레이스에 올릴 글을 규칙집대로',
      sections: [
        { name: '홍보 브리프 7칸', rows: briefSlots(p, i.source).map((b) => ({ 칸: b.label, 내용: safeText(b.note, [], 200), 채움: b.ok ? '채움' : '비어 있음' })) },
        { name: '사실 목록(이것만 사실로)', rows: aiRequestFacts(p).map((f) => ({ 사실: safeText(f, [], 300) })) },
        { name: '보관함에 이미 있는 글(같은 제목 피하기)', rows: i.items.slice(0, 15).map((x) => ({ 제목: safeText(x.title, [], 80), 종류: x.kind, 만든날: x.createdAt.slice(0, 10) })) },
      ],
      facts: [`주 키워드: ${i.keyword || '(없음)'}`, ...(i.mirae ? MIRAE_PROFILE : [])],
      rules,
    },
  }
}
