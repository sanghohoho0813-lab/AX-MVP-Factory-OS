/** D-360 오늘 화면 '오늘 올릴 것' — 오늘이 든 주 · 그날 올릴 글(1주일치 일정 그대로). 화면은 pages/marketing/radar/TodayPosts */
import { LONG_DAY, SHORT_SLOTS, THREAD_SLOTS } from './weekPlan'

/** 오늘이 든 주의 월요일 · 오늘이 몇째 날(1 월 ~ 7 일) */
export function postingDay(today: string): { monday: string; day: number } {
  const d = new Date(`${today}T00:00:00`)
  const w = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - w)
  const monday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { monday, day: w + 1 }
}

/** 그날 올릴 것 — 1주일치 일정(롱폼 수요일 · 쇼츠 화 · 목 · 릴스 토 · 스레드 매일) 그대로 */
export function postsOfDay(day: number): { text: string; tab: 'long' | 'shorts' | 'threads' }[] {
  const out: { text: string; tab: 'long' | 'shorts' | 'threads' }[] = []
  if (day === LONG_DAY) out.push({ text: '유튜브 롱폼', tab: 'long' })
  for (const s of SHORT_SLOTS) if (s.n > 0 && s.day === day) out.push({ text: `${s.platform === 'reels' ? '릴스' : '쇼츠'} ${'①②③'[s.n - 1]}`, tab: 'shorts' })
  const th = THREAD_SLOTS.find((t) => t.day === day)
  if (th) out.push({ text: `스레드(${th.aim})`, tab: 'threads' })
  return out
}
