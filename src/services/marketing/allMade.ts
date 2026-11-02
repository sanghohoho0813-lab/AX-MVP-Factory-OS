/**
 * D-355 내 콘텐츠 '만든 것 한눈에' — 롱폼(내 콘텐츠 줄) · 릴스 · 틱톡 대본 · 스레드 글을 한 목록으로(최근 것 먼저).
 * 누르면 그 글이 있는 곳에서 바로 열리는 주소까지(롱폼 = ?idea= · 스레드 · 릴스 = ?open=). 화면은 radar/AllMade.
 */
import { IDEA_RESUME_STEP, IDEA_STATUS_LABEL, type ContentIdea } from './radarStore'
import type { ThreadPost } from './threads'
import type { ShortPost } from './shorts'

export type MadeKind = 'long' | 'short' | 'thread'

export interface MadeItem {
  kind: MadeKind
  id: string
  title: string
  state: string
  /** 정렬용 ISO */
  at: string
  href: string
}

const firstLine = (s: string) => (s.split('\n').map((l) => l.replace(/^\[[^\]]*\]\s*/, '').trim()).find(Boolean) ?? '').slice(0, 80)
const md = (ymd: string) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : '')

/** 세 형식 → 한 목록(최근 것 먼저) */
export function madeItems(ideas: readonly ContentIdea[], shorts: readonly ShortPost[], threads: readonly ThreadPost[]): MadeItem[] {
  const out: MadeItem[] = [
    ...ideas.map((i) => ({ kind: 'long' as const, id: i.id, title: i.topic || '제목 없는 롱폼', state: IDEA_STATUS_LABEL[i.status], at: i.savedAt, href: `/marketing?view=make&idea=${encodeURIComponent(i.id)}` })),
    ...shorts.map((p) => ({
      kind: 'short' as const,
      id: p.id,
      title: p.topic || firstLine(p.script) || '제목 없는 대본',
      state: p.status === 'posted' ? `올림${p.postedOn ? ` ${md(p.postedOn)}` : ''}` : '쓰다 둔 대본',
      at: p.savedAt,
      href: `/marketing/shorts?open=${encodeURIComponent(p.id)}`,
    })),
    ...threads.map((p) => ({
      kind: 'thread' as const,
      id: p.id,
      title: p.topic || firstLine(p.body) || '제목 없는 글',
      state: p.status === 'posted' ? `올림${p.postedOn ? ` ${md(p.postedOn)}` : ''}` : '쓰다 둔 글',
      at: p.savedAt,
      href: `/marketing/threads?open=${encodeURIComponent(p.id)}`,
    })),
  ]
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

/* ------------------------------------------------------------------ */
/* D-507 첫 화면 '지난번 하던 것' — 세 형식 모두(긴 영상 · 릴스/틱톡 · 스레드)            */
/* ------------------------------------------------------------------ */

export interface MadeResume {
  kind: MadeKind
  /** 형식 이름(쉬운 말) */
  kindLabel: string
  topic: string
  /** 지금 단계 · 다음에 할 일(쉬운 말) */
  stage: string
  next: string
  href: string
  /** 아직 올리지 않은 것 수(세 형식 합) */
  making: number
  /** 이번 달 올린 것 수(세 형식 합) */
  posted: number
}

const KIND_LABEL: Record<MadeKind, string> = { long: '유튜브 긴 영상', short: '릴스 · 틱톡', thread: '스레드 글' }

/**
 * 아직 올리지 않은 것 가운데 가장 최근(담은 때 · 쓴 때 순) 하나 + 만드는 중 · 이번 달 올린 수.
 * 올린 것만 있으면 카드 없음(null) — 첫 화면은 '할 일' 이 있을 때만 붙잡는다.
 */
export function madeResume(ideas: readonly ContentIdea[], shorts: readonly ShortPost[], threads: readonly ThreadPost[], today: string): MadeResume | null {
  const month = today.slice(0, 7)
  const open: Array<Omit<MadeResume, 'making' | 'posted'> & { at: string }> = [
    ...ideas
      .filter((i) => i.status !== 'published')
      .map((i) => ({ kind: 'long' as const, kindLabel: KIND_LABEL.long, topic: i.topic || '제목 없는 영상', ...(i.status === 'published' ? IDEA_RESUME_STEP.idea : IDEA_RESUME_STEP[i.status]), href: `/marketing?view=make&idea=${encodeURIComponent(i.id)}`, at: i.savedAt })),
    ...shorts
      .filter((p) => p.status !== 'posted')
      .map((p) => ({ kind: 'short' as const, kindLabel: KIND_LABEL.short, topic: p.topic || firstLine(p.script) || '제목 없는 대본', stage: '대본 써 둠', next: '찍어서 올리기', href: `/marketing/shorts?open=${encodeURIComponent(p.id)}`, at: p.savedAt })),
    ...threads
      .filter((p) => p.status !== 'posted')
      .map((p) => ({ kind: 'thread' as const, kindLabel: KIND_LABEL.thread, topic: p.topic || firstLine(p.body) || '제목 없는 글', stage: '글 써 둠', next: '복사해서 올리기', href: `/marketing/threads?open=${encodeURIComponent(p.id)}`, at: p.savedAt })),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  const last = open[0]
  if (!last) return null
  const inMonth = (ymd: string) => !!ymd && ymd.slice(0, 7) === month
  const posted =
    ideas.filter((i) => i.status === 'published' && inMonth(i.publishDate || i.savedAt)).length +
    shorts.filter((p) => p.status === 'posted' && inMonth(p.postedOn || p.savedAt)).length +
    threads.filter((p) => p.status === 'posted' && inMonth(p.postedOn || p.savedAt)).length
  const { at: _at, ...rest } = last
  void _at
  return { ...rest, making: open.length, posted }
}
