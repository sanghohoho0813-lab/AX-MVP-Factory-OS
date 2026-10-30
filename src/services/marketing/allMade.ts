/**
 * D-355 내 콘텐츠 '만든 것 한눈에' — 롱폼(내 콘텐츠 줄) · 릴스 · 틱톡 대본 · 스레드 글을 한 목록으로(최근 것 먼저).
 * 누르면 그 글이 있는 곳에서 바로 열리는 주소까지(롱폼 = ?idea= · 스레드 · 릴스 = ?open=). 화면은 radar/AllMade.
 */
import { IDEA_STATUS_LABEL, type ContentIdea } from './radarStore'
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
