/**
 * D-511 마케팅 · 브랜딩 첫 화면 대화창 — 한 줄로 쓴 말을 어디로 보낼지 정한다(규칙 — AI 호출 아님).
 * 대표 지시(2026-11-03): "마케팅 브랜딩도 미니 LLM 처럼 — 처음에 딱 대화창 하나와 살펴보기 · 만들기만, 나머지는 한 번 눌러야".
 *
 *  - 형식 말이 있으면 그 화면으로(스레드 · 릴스/쇼츠/틱톡 · 블로그/플레이스 · 홈페이지) — 남은 말은 주제로 넘긴다.
 *  - '1주일치' → 1주일치 한 번에 · 인기 영상 · 참고 채널 · 올리는 때/길이 · 내 콘텐츠 · 이번 주 찍을 것 → 그 칸.
 *  - 그 밖의 주제 → 콘텐츠 묶음(제목 · 유튜브 대본 · 짧은 영상 대본 · 블로그 글 · 카드뉴스 한 번에).
 */

export type MkRoute =
  | { kind: 'week' }
  | { kind: 'view'; view: 'plan' | 'top' | 'channels' | 'analysis' | 'make' }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'pack'; topic: string }
  | { kind: 'none' }

/** 주제만 남기기 — 형식 말 · 부탁 말 · 조사 끝을 뗀다 */
export function mkTopicOf(text: string): string {
  return text
    .replace(/(스레드|쓰레드|릴스|쇼츠|숏츠|틱톡|짧은\s*영상|유튜브|긴\s*영상|블로그|플레이스|홍보\s*글|카드\s*뉴스|대본)/g, ' ')
    .replace(/(을|를|으로|로|에|에서|용)?\s*(글|게시물|콘텐츠)?\s*(하나|한\s*개|한\s*편)?\s*(써\s*줘|써\s*주세요|만들어\s*줘|만들어\s*주세요|만들기|만들어|써|부탁해|부탁해요|해\s*줘|해\s*주세요|좀)?\s*[.!?~]*$/g, '')
    .replace(/\s+(으로|로|용|에)$/g, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 60)
}

const q = (topic: string, key: string) => (topic.length >= 2 ? `?${key}=${encodeURIComponent(topic)}` : '')

/** 한 줄 → 갈 곳 */
export function mkRoute(raw: string): MkRoute {
  const text = raw.trim()
  if (!text) return { kind: 'none' }
  const topic = mkTopicOf(text)
  if (/1\s*주일|일주일|한\s*주\s*치|1\s*주\s*치|주간\s*콘텐츠/.test(text)) return { kind: 'week' }
  if (/홈페이지|누리집|랜딩\s*페이지/.test(text)) return { kind: 'link', href: '/tools/homepage', label: '홈페이지 만들기' }
  if (/블로그|플레이스|홍보\s*글/.test(text)) return { kind: 'link', href: `/tools/content${q(topic, 'kw')}`, label: '블로그 · 플레이스 홍보 글' }
  if (/스레드|쓰레드/.test(text)) return { kind: 'link', href: `/marketing/threads${q(topic, 'topic')}`, label: '스레드' }
  if (/릴스|쇼츠|숏츠|틱톡|짧은\s*영상/.test(text)) return { kind: 'link', href: `/marketing/shorts${q(topic, 'topic')}`, label: '릴스 · 틱톡' }
  if (/내\s*콘텐츠|만든\s*것|저장한|담아\s*둔|써\s*둔/.test(text)) return { kind: 'view', view: 'make' }
  if (/참고\s*채널|채널\s*(목록|관리|추가)/.test(text)) return { kind: 'view', view: 'channels' }
  if (/올리는\s*때|언제\s*올|몇\s*시|길이|몇\s*분/.test(text)) return { kind: 'view', view: 'analysis' }
  if (/인기\s*영상|요즘\s*인기|급상승|뭐가\s*뜨|뜨는\s*영상/.test(text)) return { kind: 'view', view: 'top' }
  if (/이번\s*주|뭐\s*올릴|뭘\s*올릴|무엇을\s*올릴|뭐\s*찍|무엇을\s*찍|추천해|주제\s*추천/.test(text)) return { kind: 'view', view: 'plan' }
  return topic.length >= 2 ? { kind: 'pack', topic } : { kind: 'none' }
}

/** 대화창 아래 바로 가기 — 누르면 그 자리(쓰지 않아도). 형식(스레드 · 릴스 · 블로그)은 아래 목록에 있으니 겹치지 않게 둘 + 쓰는 법 예시 하나 */
export const MK_ASK_CHIPS: readonly { id: string; label: string; say: string }[] = [
  { id: 'plan', label: '이번 주 뭐 올릴까요?', say: '이번 주 뭐 올릴까' },
  { id: 'week', label: '1주일치 한 번에', say: '1주일치 한 번에' },
  { id: 'example', label: '예) 정책자금 스레드 글', say: '정책자금 바뀌는 점 스레드 글' },
]
