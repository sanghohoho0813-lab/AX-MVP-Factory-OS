/**
 * 다음 약속(다음 할 일 + 날짜) — 한 업체의 '다음에 무엇을, 언제' (D-120).
 *
 * 예전에는 크레탑 등록 · 미팅 기록 때만 적을 수 있었고, 한 번 적으면 고칠 화면이 없었다.
 * 이제 영업 흐름 · 미팅 준비 · 업체 상세에서 바로 고친다. 적은 날짜는 일정(달력)과 오늘 화면에 뜬다.
 * 순수 함수만 둔다.
 */
import type { ClientOpsRecord, SalesStage } from '../types/clientOps'
import { withActivity } from './clientOpsActivity'
import { salesStageOf, withSalesStage } from './salesPipeline'

/** 날짜 빨리 고르기 — 오늘부터 며칠 뒤 */
export const NEXT_QUICK_DAYS: { label: string; days: number }[] = [
  { label: '오늘', days: 0 },
  { label: '내일', days: 1 },
  { label: '3일 뒤', days: 3 },
  { label: '1주 뒤', days: 7 },
  { label: '2주 뒤', days: 14 },
]

export function addDaysLocal(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 단계별로 자주 쓰는 다음 할 일 — 눌러서 채운다 */
const SUGGEST: Record<SalesStage, string[]> = {
  lead: ['1차 미팅', '첫 연락'],
  m1sched: ['1차 미팅'],
  m1done: ['자료 받기', '2차 미팅'],
  m2: ['2차 미팅', '견적 회신 확인'],
  closing: ['3차 미팅', '계약서 발송'],
  contracted: ['진행 상황 보고', '추가 제안 미팅'],
  hold: ['다시 연락'],
  lost: ['다시 연락'],
}

export function nextSuggestions(record: ClientOpsRecord): string[] {
  return SUGGEST[salesStageOf(record)]
}

/** '2026-09-29' → '9월 29일(화)' */
export function friendlyDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const d = new Date(`${date}T00:00:00`)
  const wd = '일월화수목금토'[d.getDay()]
  return `${Number(m[2])}월 ${Number(m[3])}일(${wd})`
}

/** 오늘 기준 한마디 — 오늘 · 내일 · 3일 뒤 · 2일 지남 */
export function relativeDay(date: string, today: string): string {
  const a = new Date(`${today}T00:00:00`).getTime()
  const b = new Date(`${date}T00:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  const n = Math.round((b - a) / 86_400_000)
  if (n === 0) return '오늘'
  if (n === 1) return '내일'
  if (n === 2) return '모레'
  return n > 0 ? `${n}일 뒤` : `${-n}일 지남`
}

/**
 * 다음 약속 바꾸기. 같으면 그대로 돌려준다.
 * moveToM1: 잠재 고객인데 '1차 미팅' 을 날짜와 함께 적으면 '1차 미팅 예정' 으로 옮긴다(고를 수 있음).
 */
export function withNextAction(
  record: ClientOpsRecord,
  text: string,
  date: string,
  opts: { moveToM1?: boolean; at?: string } = {},
): ClientOpsRecord {
  const at = opts.at ?? new Date().toISOString()
  const t = text.trim()
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''
  let next = record
  if (t !== record.nextAction || d !== record.nextActionDueDate) {
    next = withActivity(
      { ...record, nextAction: t, nextActionDueDate: d },
      'profile',
      t || d ? `다음 할 일 · ${t || '(내용 없음)'}${d ? ` · ${d}` : ''}` : '다음 할 일 비움',
      null,
      at,
    )
  }
  if (opts.moveToM1 && d && salesStageOf(next) === 'lead') next = withSalesStage(next, 'm1sched', at)
  return next
}

/** 잠재 고객 + '1차 미팅' + 날짜 → 1차 미팅 예정으로 옮길지 물을 때 */
export function suggestsFirstMeeting(record: ClientOpsRecord, text: string, date: string): boolean {
  return salesStageOf(record) === 'lead' && /1차\s*미팅/.test(text) && /^\d{4}-\d{2}-\d{2}$/.test(date)
}

/**
 * D-651 다음 약속 '몇 시에' — 시각은 따로 칸을 두지 않고(저장 모양 그대로) 약속 글 뒤에 ' · 오후 2시' 로 붙인다.
 * 미팅 메모 · 대화창이 읽어 넣는 모양(homeTalk talkNext — '2차 미팅 · 오후 2시')과 같다.
 */
export const NEXT_TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 8; h <= 19; h++) {
    const word = h < 12 ? '오전' : h === 12 ? '낮' : '오후'
    const hh = h > 12 ? h - 12 : h
    out.push(`${word} ${hh}시`, `${word} ${hh}시 반`)
  }
  return out
})()

const TIME_SUFFIX = /\s*·\s*((?:오전|오후|아침|저녁|낮)\s*)?(\d{1,2})\s*시(?:\s*(반|\d{1,2}\s*분))?\s*$/

/** '2차 미팅 · 오후 2시' → { base: '2차 미팅', time: '오후 2시' } · 시각이 없으면 time '' */
export function splitNextTime(text: string): { base: string; time: string } {
  const m = TIME_SUFFIX.exec(text)
  if (!m) return { base: text, time: '' }
  const time = `${m[1] ? `${m[1].trim()} ` : ''}${m[2]}시${m[3] ? ` ${m[3].replace(/\s/g, '')}` : ''}`
  return { base: text.slice(0, m.index).trimEnd(), time }
}

/** 약속 글 + 시각 → 저장할 글(시각이 없으면 글 그대로 · 글이 없으면 시각만) */
export function joinNextTime(base: string, time: string): string {
  const b = base.trim()
  const t = time.trim()
  if (!t) return b
  return b ? `${b} · ${t}` : t
}
