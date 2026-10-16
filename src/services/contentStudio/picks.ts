/**
 * 먼저 만들 것 (D-203) — 업체 기록 · 이번 달 · 이미 만든 글을 보고 3개를 고른다. 누르면 그 업체 글이 바로 나온다.
 * 왜 골랐는지(why)는 사실로만 적는다.
 */
import { particle } from '../../lib/josa'
import { contentLib } from './library'
import { seasonHook, type ContentKind, type KakaoPurpose, type TopicType } from './generate'
import type { ContentProfile } from './profile'

export interface ContentPick {
  key: string
  kind: ContentKind
  topicType?: TopicType
  purpose?: KakaoPurpose
  label: string
  why: string
}

export interface MadeItem {
  kind: ContentKind
  topicType?: TopicType
  purpose?: KakaoPurpose
  createdAt: string
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000)
}

export function firstPicks(p: ContentProfile, today: string, made: readonly MadeItem[] = []): ContentPick[] {
  const lib = contentLib(p.industry)
  /** sub = 주제 종류 또는 카톡 목적 */
  const madeKind = (kind: ContentKind, sub?: TopicType | KakaoPurpose, withinDays = 3650) =>
    made.some((m) => m.kind === kind && (!sub || m.topicType === sub || m.purpose === sub) && daysBetween(m.createdAt, today) <= withinDays)
  const cands: (ContentPick & { score: number })[] = []

  if (!madeKind('keywords')) cands.push({ key: 'keywords', kind: 'keywords', label: '키워드부터 정하기', why: '손님이 어떤 말로 찾는지 정해 두면 모든 글이 같은 키워드를 써요.', score: 90 })
  if (!madeKind('place')) cands.push({ key: 'place', kind: 'place', label: '플레이스 소개글', why: '지도에서 처음 보는 글이에요 — 업체 기록으로 바로 채워져요.', score: 80 })

  const s = seasonHook(lib, today)
  if (s && !madeKind('cards', 'season', 25)) cands.push({ key: 'season', kind: 'cards', topicType: 'season', label: `${s.month}월 카드뉴스`, why: `${s.month}월은 ${s.hook} — 지금 올리기 좋은 이야기예요.`, score: 75 })

  const trust = p.strengths.filter((x) => !/^설립|^직원/.test(x))
  const shown = `${trust.slice(0, 2).join(' · ')}${trust.length > 2 ? ` 외 ${trust.length - 2}건` : ''}`
  if (trust.length && !madeKind('blog', 'intro')) cands.push({ key: 'trust', kind: 'blog', topicType: 'intro', label: '업체 소개 블로그', why: `업체 기록에 ${shown}${particle(shown, '이/가')} 있어요 — 믿음을 주는 글이 잘 맞아요.`, score: 78 })
  else if (p.years !== null && p.years >= 10 && !madeKind('blog', 'intro')) cands.push({ key: 'years', kind: 'blog', topicType: 'intro', label: '업체 소개 블로그', why: `설립 ${p.years}년째 — 오래 해 온 곳이라는 점이 가장 큰 믿음이에요.`, score: 70 })
  if (p.years !== null && p.years < 1 && !madeKind('kakao', 'news')) cands.push({ key: 'open', kind: 'kakao', purpose: 'news', label: '새로 연 소식(카톡)', why: '설립 1년이 안 됐어요 — 문을 연 소식을 알리기 좋은 때예요.', score: 72 })

  if (!madeKind('blog', 'choose', 60)) cands.push({ key: 'choose', kind: 'blog', topicType: 'choose', label: '고르는 기준 블로그', why: `${lib.target}${particle(lib.target, '이/가')} 가장 많이 찾는 글이에요.`, score: 60 })
  if (!madeKind('shorts', undefined, 30)) cands.push({ key: 'shorts', kind: 'shorts', topicType: 'tips', label: '짧은 영상 대본', why: '20~30초 대본 — 휴대폰으로 바로 찍을 수 있어요.', score: 55 })
  if (!madeKind('blog', 'faq', 90)) cands.push({ key: 'faq', kind: 'blog', topicType: 'faq', label: '자주 묻는 질문 블로그', why: '미리 답해 두면 같은 문의 전화가 줄어요.', score: 50 })

  return cands
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score: _score, ...pick }) => pick)
}
