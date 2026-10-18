/**
 * 오늘 화면 — 다가오는 마감 · 약속 (D-143).
 *
 * 예전 '지금 이것부터' 는 규칙이 고른 셋을 늘 보여 줬다("다음 할 일이 비어 있습니다" 같은 것까지).
 * 대표가 원한 것은 '날짜가 정해진 실제 일' — 고객과 약속한 기한 · 미팅 · 업무 마감 · 신청 마감.
 * 그래서 날짜가 있는 것만, 날짜 순으로 보여 준다(규칙 점수 없음).
 *
 *  - 업체 일정(다음 약속 · 업무 마감 · 정책자금 신청 · 받을 돈 · 서류 만료 · 도구 기한) + 앞으로 기한인 할 일
 *  - 오늘부터 N일(기본 14일) 안. 마감이 지났는데 안 끝난 업무 · 신청 마감은 맨 위(최대 30일 전까지)
 *  - 바로 위 칸에 이미 있는 것은 뺀다: 오늘 · 밀린 할 일, 지난 · 오늘 · 내일 약속, 놓치면 끝나는 기한
 */
import type { JournalEntry } from '../types/bridge'
import { SCHEDULE_KIND_LABEL, type ScheduleEvent, type ScheduleKind } from './clientOpsSchedule'

export type AgendaKind = ScheduleKind | 'todo' | 'content'

export interface AgendaItem {
  id: string
  date: string
  daysLeft: number
  kind: AgendaKind
  kindLabel: string
  clientId: string | null
  clientName: string
  title: string
  detail: string
  href: string
}

/** 지나도 30일 동안 '늦음' 으로 보이는 것 — D-210: 도구 기한(못 낸 고용지원금 회차 · 지난 참여신청 기한)도 */
const LATE_KINDS: ReadonlySet<ScheduleKind> = new Set(['task', 'funding', 'tool'])

function daysFrom(today: string, date: string): number {
  const a = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))
  const b = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

export function buildAgenda(o: {
  schedule: readonly ScheduleEvent[]
  journal: readonly JournalEntry[]
  clientNames: ReadonlyMap<string, string>
  prospectIds: ReadonlySet<string>
  today: string
  days?: number
  /** D-237 이미 거른 다른 날짜 일(내 콘텐츠 촬영 · 게시 예정) — 날짜 순에 같이 섞는다 */
  extra?: readonly AgendaItem[]
}): AgendaItem[] {
  const { schedule, journal, clientNames, prospectIds, today } = o
  const days = o.days ?? 14
  const out: AgendaItem[] = [...(o.extra ?? [])]
  for (const e of schedule) {
    if (e.done || e.daysLeft === null) continue
    const left = e.daysLeft
    if (left > days) continue
    if (left < 0 && !(LATE_KINDS.has(e.kind) && left >= -30)) continue
    // 위 칸에 이미 있는 것
    if (e.kind === 'next' && left <= 1) continue
    if (e.kind === 'tool' && e.hard && left >= 0 && left <= 7) continue
    const href =
      e.kind === 'next' && prospectIds.has(e.clientId)
        ? `/sales/meeting?client=${e.clientId}`
        : e.kind === 'payment'
          ? `/ops/clients/${e.clientId}?tab=fees`
          : `/ops/clients/${e.clientId}`
    out.push({ id: e.id, date: e.date, daysLeft: left, kind: e.kind, kindLabel: e.kind === 'next' ? '약속' : SCHEDULE_KIND_LABEL[e.kind], clientId: e.clientId, clientName: e.clientName, title: e.title, detail: e.detail, href })
  }
  for (const j of journal) {
    // 오늘 · 밀린 할 일은 위 '오늘 할 일' 에 — 여기는 내일부터
    if (j.entryType !== 'follow_up' || j.completed || !j.dueDate || j.dueDate <= today) continue
    const left = daysFrom(today, j.dueDate)
    if (left > days) continue
    out.push({
      id: `todo:${j.id}`,
      date: j.dueDate,
      daysLeft: left,
      kind: 'todo',
      kindLabel: '할 일',
      clientId: j.clientId,
      clientName: j.clientId ? (clientNames.get(j.clientId) ?? '') : '',
      title: j.content.split('\n')[0].slice(0, 80),
      detail: '',
      href: j.clientId ? `/ops/clients/${j.clientId}` : '/journal',
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName) || a.title.localeCompare(b.title))
}

/**
 * D-237 내 콘텐츠(콘텐츠 레이더)의 촬영일 · 게시일 — 오늘부터 3일 안. 업체와 상관없는 대표의 일이다(마케팅은 대표 전용).
 * 촬영은 아직 찍기 전(아이디어 · 제작 예정 · 대본 준비)일 때만, 게시는 아직 안 올렸을 때만. 지난 날짜는 내 콘텐츠 탭이 빨갛게 알린다.
 */
export function contentAgenda(
  ideas: readonly { id: string; topic: string; status: string; shootDate: string; publishDate: string }[],
  today: string,
  days = 3,
): AgendaItem[] {
  const out: AgendaItem[] = []
  const day = /^\d{4}-\d{2}-\d{2}$/
  for (const i of ideas) {
    const due: [string, 'shoot' | 'publish'][] = []
    if (day.test(i.shootDate) && (i.status === 'idea' || i.status === 'selected' || i.status === 'script')) due.push([i.shootDate, 'shoot'])
    if (day.test(i.publishDate) && i.status !== 'published') due.push([i.publishDate, 'publish'])
    for (const [date, what] of due) {
      const left = daysFrom(today, date)
      if (left < 0 || left > days) continue
      out.push({
        id: `content:${what}:${i.id}`,
        date,
        daysLeft: left,
        kind: 'content',
        kindLabel: what === 'shoot' ? '촬영 예정' : '게시 예정',
        clientId: null,
        clientName: '',
        title: i.topic.slice(0, 80),
        detail: '내 콘텐츠',
        href: '/marketing?view=make',
      })
    }
  }
  return out
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** '오늘' · '내일' · '모레' · 'D-5' · '3일 지남' + 날짜(10/7 화) */
export function agendaWhen(item: Pick<AgendaItem, 'date' | 'daysLeft'>): { label: string; date: string } {
  const d = item.daysLeft
  const label = d < 0 ? `${-d}일 지남` : d === 0 ? '오늘' : d === 1 ? '내일' : d === 2 ? '모레' : `D-${d}`
  const wd = new Date(Date.UTC(Number(item.date.slice(0, 4)), Number(item.date.slice(5, 7)) - 1, Number(item.date.slice(8, 10)))).getUTCDay()
  return { label, date: `${Number(item.date.slice(5, 7))}/${Number(item.date.slice(8, 10))} ${WEEK[wd]}` }
}
