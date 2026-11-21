/**
 * D-640 업체 1년 자금 일정표 — 이번 달부터 12개월, 이 업체가 언제 무엇을 하면 되는지 한 장. 순수 함수 · 규칙(LLM 0).
 *
 * 새로 판정하지 않는다 — 이미 있는 것을 달력에 놓기만 한다(D-618 판정은 한 곳):
 *  1. 기한(buildClientSchedule 그대로) — 지원사업 · 정책자금 신청 마감 · 결과 발표 · 서류 만료 · 임원 중임 등기 · 도구 기한(고용지원금 회차 · 연구소 사후관리)
 *     고객 종이라 수수료(수금) · 내부 다음 약속 · 우리 업무 마감은 넣지 않는다(진단서 D-352 와 같은 기준).
 *  2. 이 업체에 맞는 공고(matchesFor — 조건 맞음 · 확인 필요) 마감 — 이미 신청 건으로 잡힌 공고는 한 번만.
 *  2-1. D-641 작년에 떨어진 사업 — 다시 올라온 공고 마감 또는 작년 그 달의 '다시 도전 · 공고 확인'(짐작 · 까닭은 쓰지 않는다).
 *  3. 먼저 제안할 것(buildInsights 의 가능성 높음 · 검토해 볼 만함) — 이번 달에 시작할 일.
 *     세액공제 · 감면이 걸린 판정은 신고 달(법인 3월 31일 · 개인 5월 31일 — 12월 결산 기준)에 '반영 확인'.
 *     판정에 'n년분 경정청구' 가 있으면 그 경정청구 마감(법정신고기한 뒤 5년 — 국세기본법 제45조의2)이 12개월 안이면 '놓치면 끝나는 기한'.
 *     정책자금이 제안이면 다음 1월에 '새해 융자 공고 확인'(해마다 연초 — 짐작한 때로 표시).
 *  선정 · 승인을 약속하지 않는다. 짐작한 때(해마다 · 결산 기준)는 approx 로 표시해 '확인' 이라고 쓴다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { Insight } from './clientInsights'
import type { GrantMatch } from './grants/grantMatch'
import { buildClientSchedule, type ScheduleEvent } from './clientOpsSchedule'
import { businessTypeOf } from '../tools/shared/clientPrefill'
import { expectedRetryMonth, isRetryable, retryHits } from './grants/grantRetry'

export type YearItemKind = 'deadline' | 'grant' | 'propose' | 'tax'

export interface YearItem {
  id: string
  /** 'YYYY-MM' */
  month: string
  /** 'YYYY-MM-DD' — 달 안 아무 때나 하면 되는 일은 '' */
  date: string
  kind: YearItemKind
  title: string
  detail: string
  /** 지나면 신청 · 청구할 수 없는 기한 */
  hard: boolean
  /** 이미 지난 기한(30일 안) — 이번 달 맨 위에 '늦음' */
  late: boolean
  /** 짐작한 때(해마다 · 12월 결산 기준) — '확인' 이라고 쓴다 */
  approx: boolean
  /** 화면에서 누르면 갈 곳(종이에는 없음) */
  path: string
}

export interface YearMonth {
  /** 'YYYY-MM' */
  key: string
  /** '11월' · 해가 바뀌면 '2027년 1월' */
  label: string
  items: YearItem[]
  hardCount: number
}

export interface YearPlan {
  companyName: string
  /** '2026년 11월 ~ 2027년 10월' */
  range: string
  months: YearMonth[]
  total: number
  hardCount: number
  notes: string[]
}

const ymOf = (d: string) => d.slice(0, 7)
function addMonths(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}
const monthName = (ym: string, withYear: boolean) => `${withYear ? `${Number(ym.slice(0, 4))}년 ` : ''}${Number(ym.slice(5, 7))}월`
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/** 고객 종이에 넣는 기한만 — 수금 · 내부 다음 약속 · 우리 업무 마감은 뺀다(임원 중임 등기는 업체 일이라 넣는다) */
function customerEvent(e: ScheduleEvent): boolean {
  if (e.kind === 'payment' || e.kind === 'next') return false
  if (e.kind === 'task') return e.id.includes(':officer:')
  return true
}

/** 신고 달 — 법인 3월 31일 · 개인 5월 31일(12월 결산 기준). from 이후 첫 번째 */
function filingDate(type: '' | 'individual' | 'corporation', from: string): { date: string; name: string } {
  const md = type === 'individual' ? '05-31' : '03-31'
  const name = type === 'individual' ? '종합소득세 신고' : type === 'corporation' ? '법인세 신고' : '법인세 · 종합소득세 신고'
  const y = Number(from.slice(0, 4))
  const date = `${y}-${md}` >= from ? `${y}-${md}` : `${y + 1}-${md}`
  return { date, name }
}

/** 'n년분 경정청구' → 그해 분 경정청구 마감(법정신고기한 뒤 5년 · 12월 결산 기준) */
export function refundDeadline(year: number, type: '' | 'individual' | 'corporation'): string {
  return `${year + 6}-${type === 'individual' ? '05-31' : '03-31'}`
}

const TAX_KEYS = new Set(['startup-tax', 'labcare', 'employment'])

export function buildYearPlan(record: ClientOpsRecord, insights: readonly Insight[], matches: readonly GrantMatch[], today: string): YearPlan {
  const start = ymOf(today)
  const endYm = addMonths(start, 12) // 이 달 1일 전까지
  const inWindow = (d: string) => d >= `${start}-01` && ymOf(d) < endYm
  const type = businessTypeOf(record)
  const items: YearItem[] = []
  const push = (x: Omit<YearItem, 'month' | 'late' | 'approx' | 'path' | 'hard'> & Partial<Pick<YearItem, 'late' | 'approx' | 'path' | 'hard'>> & { month?: string }) =>
    items.push({ late: false, approx: false, path: '', hard: false, ...x, month: x.month ?? ymOf(x.date) })

  // 1. 기한 — 지난 것은 30일 안 · 안 끝낸 것만 이번 달 맨 위로
  const events = buildClientSchedule(record, today).filter(customerEvent)
  const appTitles = new Set<string>()
  for (const e of events) {
    if (e.done) continue
    if (e.kind === 'funding') appTitles.add(e.title.trim())
    const late = (e.daysLeft ?? 0) < 0
    if (late && (e.daysLeft ?? 0) < -30) continue
    if (!late && !inWindow(e.date)) continue
    const hard = e.kind === 'funding' ? !e.title.startsWith('결과 발표') : e.hard === true || e.id.includes(':officer:')
    push({
      id: `ev:${e.id}`,
      date: late ? '' : e.date,
      month: late ? start : ymOf(e.date),
      kind: 'deadline',
      title: e.title,
      detail: late ? `${e.date.slice(5).replace('-', '.')} 지났어요${e.detail ? ` · ${e.detail}` : ''}` : e.detail,
      hard,
      late,
      path: `/ops/clients/${record.id}?tab=${e.kind === 'document' ? 'docs' : e.kind === 'funding' ? 'funding' : 'smart'}`,
    })
  }

  // 2. 맞는 공고 마감 — 조건 맞음 먼저 · 많아야 6건 · 이미 신청 건으로 잡힌 공고는 빼고
  let grantCount = 0
  for (const m of matches) {
    if (grantCount >= 6) break
    if (m.verdict !== 'fit' && m.verdict !== 'check') continue
    const n = m.notice
    if (!n.applyEnd || !inWindow(n.applyEnd) || n.applyEnd < today) continue
    if (appTitles.has(n.title.trim())) continue
    grantCount += 1
    push({
      id: `gr:${n.id}`,
      date: n.applyEnd,
      kind: 'grant',
      title: `${clip(n.title, 46)} 마감`,
      detail: [n.amountText, m.verdict === 'fit' ? '조건 맞음' : `확인할 조건 ${m.unknownCount}가지`].filter(Boolean).join(' · '),
      hard: true,
      path: `/grants?open=${encodeURIComponent(n.id)}`,
    })
  }

  // 2-1. D-641 작년에 떨어진 사업 — 다시 올라왔으면 그 공고 마감('다시 도전' · 전국 공통 공고라도), 아직이면 작년 그 달에 '공고 확인'(짐작).
  //      고객 종이라 떨어진 까닭은 쓰지 않는다. 다시 도전을 접은 건 · 이미 다시 신청 중인 건은 빼고.
  const hits = retryHits(record, matches)
  const hitApp = new Set(hits.map((h) => h.app.id))
  for (const h of hits) {
    const n = h.match.notice
    const prev = items.find((x) => x.id === `gr:${n.id}`)
    if (prev) {
      prev.detail = ['다시 도전', prev.detail].filter(Boolean).join(' · ')
      continue
    }
    const end = n.applyEnd && n.applyEnd >= today && inWindow(n.applyEnd) ? n.applyEnd : ''
    push({
      id: `rt:${n.id}`,
      date: end,
      month: end ? ymOf(end) : start,
      kind: 'grant',
      title: `${clip(n.title, 40)} ${end ? '마감' : '— 다시 올라왔어요'}`,
      detail: ['다시 도전', n.amountText].filter(Boolean).join(' · '),
      hard: Boolean(end),
      path: `/grants?open=${encodeURIComponent(n.id)}`,
    })
  }
  for (const app of record.fundingApplications) {
    if (!isRetryable(app) || hitApp.has(app.id)) continue
    // 같은 사업으로 이미 다시 신청 중이면(이 건 뒤에 만든 진행 중인 건) 빼기
    if (record.fundingApplications.some((l) => l.retryOf === app.id && l.status !== 'rejected' && l.status !== 'given_up')) continue
    const ym = expectedRetryMonth(app, today)
    if (!ym || ym < start || ym >= endYm) continue
    push({
      id: `ra:${app.id}`,
      date: '',
      month: ym,
      kind: 'grant',
      title: `${clip(app.programName || '지원사업', 40)} — 다시 도전 · 공고 확인`,
      detail: '해마다 비슷한 때 공고가 나와요 — 지난번 부족했던 점부터 미리',
      approx: true,
      path: `/ops/clients/${record.id}?tab=funding`,
    })
  }

  // 3. 먼저 제안할 것 — 이번 달 시작 · 세액공제는 신고 달 · 경정청구 마감 · 정책자금은 새해 공고
  const picks = insights.filter((i) => (i.tone === 'good' || i.tone === 'maybe') && i.key !== 'grants' && i.key !== 'cretop')
  const taxBits: string[] = []
  for (const p of picks) {
    push({
      id: `pk:${p.key}`,
      date: '',
      month: start,
      kind: 'propose',
      // 할 일 문장이 없는 제안은 제목을 짧게('연구소 검토') — 긴 판정 문장은 아래 한 줄로
      title: p.action ? clip(p.action, 60) : `${p.label} 검토`,
      detail: [p.amount ?? '', p.action ? '' : clip(p.headline, 70)].filter(Boolean).join(' · '),
      path: p.openPath,
    })
    const refund = /(\d{4})년분\s*경정청구/.exec(`${p.action ?? ''} ${p.headline}`)
    if (refund) {
      const due = refundDeadline(Number(refund[1]), type)
      if (inWindow(due) && due >= today)
        push({ id: `rf:${p.key}:${refund[1]}`, date: due, kind: 'tax', title: `${refund[1]}년분 경정청구 마감 — ${p.label}`, detail: '신고기한 뒤 5년이 지나면 돌려받을 수 없어요(12월 결산 기준 · 세무사 확인)', hard: true, approx: type === '', path: p.openPath })
    }
    if (TAX_KEYS.has(p.key) && (p.key !== 'employment' || /세액공제/.test(`${p.action ?? ''} ${p.headline} ${p.detail}`))) taxBits.push(p.key === 'startup-tax' ? '창업감면' : p.key === 'labcare' ? '연구개발비 세액공제' : '통합고용세액공제')
  }
  if (taxBits.length) {
    const f = filingDate(type, today)
    if (inWindow(f.date))
      push({ id: 'tx:filing', date: f.date, kind: 'tax', title: `${f.name} — 반영 확인: ${[...new Set(taxBits)].join(' · ')}`, detail: '신고서에 빠지지 않게 세무사와 미리 맞춰요', approx: true })
  }
  if (picks.some((p) => p.key === 'policy-funding') && Number(start.slice(5, 7)) !== 1) {
    const jan = `${Number(start.slice(0, 4)) + 1}-01`
    if (jan < endYm) push({ id: 'pf:new-year', date: '', month: jan, kind: 'propose', title: '새해 정책자금 융자 공고 확인', detail: '해마다 연초에 그해 융자 계획이 공고돼요 — 예산이 열리면 바로 낼 수 있게 서류를 미리', approx: true, path: picks.find((p) => p.key === 'policy-funding')?.openPath ?? '' })
  }

  // 달마다 — 늦음 → 날짜순 → 달 안 아무 때나
  const months: YearMonth[] = []
  for (let i = 0; i < 12; i += 1) {
    const key = addMonths(start, i)
    const list = items
      .filter((x) => x.month === key)
      .sort((a, b) => Number(b.late) - Number(a.late) || (a.date || '9999').localeCompare(b.date || '9999') || Number(b.hard) - Number(a.hard))
    months.push({ key, label: monthName(key, i === 0 || key.endsWith('-01')), items: list, hardCount: list.filter((x) => x.hard).length })
  }
  const last = addMonths(start, 11)
  return {
    companyName: record.companyName || '(이름 없음)',
    range: `${monthName(start, true)} ~ ${monthName(last, true)}`,
    months,
    total: items.length,
    hardCount: items.filter((x) => x.hard).length,
    notes: [
      '날짜는 공고 · 서류 · 등기에 적힌 기한이에요. \'확인\' 이라고 쓴 때는 해마다 비슷한 때(12월 결산 기준)라 공고 · 세무사와 한 번 더 확인해요.',
      '선정 · 승인 · 환급을 약속하는 일정이 아니에요.',
    ],
  }
}

const md = (d: string) => (d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : '')

/** 한 줄 글 — 화면 · 종이 · 카톡이 같은 글 */
export function yearItemText(x: YearItem): string {
  const when = x.late ? '늦음 ' : x.date ? `${md(x.date)} ` : ''
  const tail = x.hard ? ' (놓치면 끝)' : x.approx ? ' (확인)' : ''
  return `${when}${x.title}${tail}`
}

/** 카톡 요약 — 일이 있는 달만 */
export function yearPlanKakao(p: YearPlan, sender = ''): string {
  const lines = [`${p.companyName} 대표님, 앞으로 1년 자금 일정을 정리했어요(${p.range}).`]
  for (const m of p.months) {
    if (!m.items.length) continue
    lines.push('', `[${m.label}]`)
    for (const x of m.items) lines.push(`· ${yearItemText(x)}`)
  }
  if (p.total === 0) lines.push('', '지금은 정해진 기한이 없어요 — 공고가 나오면 바로 알려 드릴게요.')
  lines.push('', ...p.notes.map((n) => `※ ${n}`))
  if (sender) lines.push('', sender)
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* D-642 1년 일정표 → 할 일(업무 일기 '다음 할 일')                      */
/* ------------------------------------------------------------------ */

export interface YearTodo {
  itemId: string
  /** 업무 일기에 적을 글 — 같은 글이 이미 있으면 다시 걸지 않는다 */
  content: string
  /** 할 일 날(YYYY-MM-DD · 토 · 일은 피한다) */
  dueDate: string
  /** 처음부터 골라 둘 것 — 놓치면 끝인 일 · 이번 달 · 다음 달 일 */
  preselect: boolean
}

const dayAdd = (ymd: string, n: number) => {
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}
const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay()
/** 토 · 일이면 앞 금요일로(오늘보다 앞이면 다음 월요일로) */
function weekdayNear(ymd: string, today: string): string {
  const d = dow(ymd)
  if (d !== 0 && d !== 6) return ymd
  const back = dayAdd(ymd, d === 6 ? -1 : -2)
  return back >= today ? back : dayAdd(ymd, d === 6 ? 2 : 1)
}
const monthAdd = (ym: string, n: number) => {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  return `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, '0')}`
}

/**
 * 일정표 한 줄 → 할 일 한 줄. 기한이 있는 일은 기한 1주 전(지났으면 오늘) · 지난 일은 오늘 ·
 * 달 안 아무 때나인 일은 이번 달이면 3일 뒤 · 다음 달부터는 그달 첫 평일. 글은 '업체 · 일 — 마감 M.D 전에'.
 */
export function yearTodoOf(x: YearItem, companyName: string, today: string): YearTodo {
  const co = companyName.trim() || '업체'
  let due: string
  let content: string
  if (x.late) {
    due = weekdayNear(today, today)
    content = `${co} · ${x.title} — 늦었어요, 오늘 확인`
  } else if (x.date) {
    const before = dayAdd(x.date, -7)
    due = weekdayNear(before > today ? before : today, today)
    if (due > x.date) due = x.date
    content = `${co} · ${x.title}${x.hard ? ` — 마감 ${md(x.date)} 전에` : ` (${md(x.date)})`}`
  } else {
    const thisMonth = today.slice(0, 7)
    due = x.month <= thisMonth ? weekdayNear(dayAdd(today, 3), today) : weekdayNear(`${x.month}-01`, `${x.month}-01`)
    content = `${co} · ${x.title}`
  }
  const soon = x.month <= monthAdd(today.slice(0, 7), 1)
  return { itemId: x.id, content, dueDate: due, preselect: x.hard || x.late || soon }
}

/** 고를 목록 — 놓치면 끝 · 늦음 먼저, 그다음 날짜 순(같은 글은 한 번) */
export function yearTodoChoices(p: YearPlan, today: string): { item: YearItem; todo: YearTodo }[] {
  const seen = new Set<string>()
  const out: { item: YearItem; todo: YearTodo }[] = []
  for (const m of p.months) {
    for (const x of m.items) {
      const todo = yearTodoOf(x, p.companyName, today)
      if (seen.has(todo.content)) continue
      seen.add(todo.content)
      out.push({ item: x, todo })
    }
  }
  const rank = (c: { item: YearItem }) => (c.item.late ? 0 : c.item.hard ? 1 : 2)
  return out.sort((a, b) => rank(a) - rank(b) || a.todo.dueDate.localeCompare(b.todo.dueDate))
}
