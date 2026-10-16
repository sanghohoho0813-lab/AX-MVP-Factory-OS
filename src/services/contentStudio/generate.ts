/**
 * 홍보 글 만들기 (D-203) — 업체 홍보 정보 + 업종 견본으로 글 초안을 만든다. 규칙으로 채우며 'AI' 가 아니다.
 *
 * 형식 7가지: 키워드 정하기 · 블로그 글 · 짧은 영상 대본 · 긴 영상 기획 · 카드뉴스 · 카톡 채널 소식 · 플레이스 소개글.
 * 블로그 · 영상 · 카드뉴스는 '주제' 하나를 같이 쓴다(키워드 → 주제 → 글).
 * [다른 안] 은 variant 번호로 견본 문장 · 순서를 바꾼다 — 같은 번호면 늘 같은 글(시험 · 다시 열기).
 * 업체마다 다른 내용(혜택 · 사례 · 주차 …)은 지어내지 않고 [대괄호] 로 비워 둔다.
 */
import { particle } from '../../lib/josa'
import { contentLib, RISKY_WORDS, type ContentLib } from './library'
import type { ContentProfile } from './profile'
import { applyTone, type Tone } from './tone'

export type ContentKind = 'keywords' | 'blog' | 'shorts' | 'video' | 'cards' | 'kakao' | 'place'

export const CONTENT_KINDS: ContentKind[] = ['keywords', 'blog', 'shorts', 'video', 'cards', 'kakao', 'place']

export const KIND_LABEL: Record<ContentKind, string> = {
  keywords: '키워드 정하기',
  blog: '블로그 글',
  shorts: '짧은 영상 대본',
  video: '긴 영상 기획',
  cards: '카드뉴스',
  kakao: '카톡 채널 소식',
  place: '플레이스 소개글',
}

export const KIND_HINT: Record<ContentKind, string> = {
  keywords: '손님이 찾는 말 — 모든 글의 바탕',
  blog: '네이버 블로그 · 홈페이지 소식',
  shorts: '유튜브 쇼츠 · 인스타 릴스 40초',
  video: '유튜브 5~8분 · 썸네일 · 순서',
  cards: '인스타 카드뉴스 5장 · 7장',
  kakao: '카카오톡 채널 소식 · 안부',
  place: '네이버 플레이스 · 지도 소개',
}

/** 주제가 필요한 형식 */
export const NEEDS_TOPIC: ReadonlySet<ContentKind> = new Set(['blog', 'shorts', 'video', 'cards'])

export type TopicType = 'tips' | 'choose' | 'faq' | 'intro' | 'case' | 'season'

export const TOPIC_LABEL: Record<TopicType, string> = {
  tips: '알아 둘 정보',
  choose: '고르는 기준',
  faq: '자주 묻는 질문',
  intro: '업체 소개',
  case: '진행 사례',
  season: '이번 달 이야기',
}

export interface Topic {
  type: TopicType
  title: string
  /** 이 글이 무엇을 하는지 한 줄 */
  angle: string
  keyword: string
}

export type KakaoPurpose = 'news' | 'event' | 'season' | 'thanks'

export const PURPOSE_LABEL: Record<KakaoPurpose, string> = {
  news: '새 소식',
  event: '혜택 · 행사',
  season: '이번 달 안내',
  thanks: '1:1 안부',
}

export interface DraftRequest {
  kind: ContentKind
  keyword?: string
  topic?: Topic
  pages?: 5 | 7
  purpose?: KakaoPurpose
  variant?: number
}

export interface DraftBlock {
  label: string
  text: string
  /** 화면에만 보이는 설명(복사에는 안 들어감) */
  hint?: string
}

export interface Draft {
  kind: ContentKind
  title: string
  blocks: DraftBlock[]
  /** 화면에만 보이는 안내(복사에는 안 들어감) */
  notes: string[]
  input: { keyword?: string; topicType?: TopicType; topicTitle?: string; pages?: 5 | 7; purpose?: KakaoPurpose; variant: number; tone: Tone }
}

/* ------------------------------------------------------------------ */
/* 작은 도구                                                             */
/* ------------------------------------------------------------------ */

const at = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]

/** 순서를 n 만큼 돌린다 */
function rotate<T>(list: readonly T[], n: number): T[] {
  if (!list.length) return []
  const k = ((n % list.length) + list.length) % list.length
  return [...list.slice(k), ...list.slice(0, k)]
}

const j = (word: string, pair: '은/는' | '이/가' | '을/를' | '과/와' | '으로/로' | '이에요/예요') => `${word}${particle(word, pair)}`

function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.trim())
  return (m ? m[1] : text).trim()
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

export function monthOf(today: string): number {
  const m = /^\d{4}-(\d{2})/.exec(today)
  return m ? Number(m[1]) : 1
}

/** 이번 달 이야깃거리 — 없으면 다음 달(미리 준비하는 글) · 둘 다 없으면 null */
export function seasonHook(lib: ContentLib, today: string): { month: number; hook: string } | null {
  const m = monthOf(today)
  if (lib.season[m]) return { month: m, hook: lib.season[m] as string }
  const next = (m % 12) + 1
  if (lib.season[next]) return { month: next, hook: lib.season[next] as string }
  return null
}

export function mainKeyword(p: ContentProfile): string {
  return clean([p.area, p.item].filter(Boolean).join(' '))
}

function hashtagOf(word: string): string {
  return `#${word.replace(/\(주\)|㈜|주식회사|\s+|[^\p{L}\p{N}_]/gu, '')}`
}

export function hashtags(p: ContentProfile, max = 10): string[] {
  const lib = contentLib(p.industry)
  // 회사 이름은 앞쪽에 — 하는 일이 많아도 잘리지 않게
  const raw = [p.area && p.item ? `${p.area}${p.item}` : '', p.item, p.company, p.area, ...p.services.slice(0, 3), ...lib.hashtags]
  return raw
    .filter(Boolean)
    .map(hashtagOf)
    .filter((t) => t.length > 2)
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, max)
}

/* ------------------------------------------------------------------ */
/* 키워드                                                               */
/* ------------------------------------------------------------------ */

export interface KeywordGroup {
  key: 'find' | 'compare' | 'problem' | 'service' | 'brand'
  label: string
  why: string
  words: string[]
}

export const KEYWORD_NOTE = '검색량 숫자는 네이버 검색광고 › 키워드 도구에서 확인하세요 — OS 는 검색량을 짐작해 적지 않습니다.'

export function keywordGroups(p: ContentProfile): KeywordGroup[] {
  const lib = contentLib(p.industry)
  const area = p.area
  const item = p.item
  const wide = p.region && p.region.split(/\s+/).length >= 2 ? clean(`${p.region.split(/\s+/)[0]} ${area} ${item}`) : ''
  const uniq = (list: string[]) => list.map(clean).filter((w) => w.length > 1).filter((w, i, all) => all.indexOf(w) === i)
  const groups: KeywordGroup[] = [
    {
      key: 'find',
      label: '찾는 말',
      why: '지역과 함께 찾는 말 — 블로그 제목 · 플레이스 키워드에',
      words: uniq([mainKeyword(p), area ? `${area} ${item} 추천` : `${item} 추천`, area ? `${area} ${item} 잘하는 곳` : '', wide]),
    },
    {
      key: 'compare',
      label: '비교하는 말',
      why: '마음을 정하기 직전에 찾는 말 — 본문 소제목에',
      words: uniq(lib.intents.filter((w) => !/추천|잘하는/.test(w)).map((w) => `${item} ${w}`)),
    },
    {
      key: 'problem',
      label: '상황 말',
      why: '문제를 겪는 사람이 찾는 말 — 정보 글 주제로',
      words: uniq(lib.problems.map((w, i) => (i < 2 && area ? `${area} ${w}` : w))),
    },
  ]
  if (p.services.length) {
    groups.push({ key: 'service', label: '하는 일 말', why: '하는 일 이름 그대로 찾는 말 — 소제목 · 해시태그에', words: uniq(p.services.slice(0, 5).map((s) => (area ? `${area} ${s}` : s))) })
  }
  groups.push({ key: 'brand', label: '우리 이름', why: '이미 아는 손님이 찾는 말 — 소개글 · 마무리에', words: uniq([p.company, `${p.company} 후기`, area ? `${p.company} ${area}` : '']) })
  return groups.filter((g) => g.words.length)
}

/* ------------------------------------------------------------------ */
/* 주제                                                                 */
/* ------------------------------------------------------------------ */

const ANGLE: Record<TopicType, string> = {
  tips: '도움이 되는 정보로 믿음을 쌓고, 끝에 업체를 짧게 알려요.',
  choose: '고르는 기준을 알려 주고, 우리가 그 기준을 어떻게 지키는지 보여 줘요.',
  faq: '자주 받는 질문에 미리 답해 전화 · 문의를 줄여요.',
  intro: '처음 찾은 손님에게 어떤 곳인지 한 번에 보여 줘요.',
  case: '실제 진행한 일을 보여 줘요 — 고객 동의를 받은 내용만.',
  season: '지금 때에 맞는 이야기로 찾아올 이유를 만들어요.',
}

export function topicsFor(p: ContentProfile, keyword: string, today: string, variant = 0): Topic[] {
  const lib = contentLib(p.industry)
  const kw = clean(keyword) || mainKeyword(p)
  const n = variant
  const season = seasonHook(lib, today)
  const titles: Partial<Record<TopicType, string>> = {
    tips: at([`${kw}, 알아보기 전에 꼭 알아야 할 5가지`, `${kw} 처음이라면 이것부터 보세요`, `${kw} 준비할 때 많이 놓치는 5가지`], n),
    choose: at([`${kw} ${lib.placeNoun} 고를 때 확인할 5가지`, `${kw} 견적 받기 전 체크리스트`, `${kw}, 어디에 맡길지 고민될 때 보는 기준`], n),
    faq: at([`${kw} 자주 묻는 질문, ${j(p.company, '이/가')} 답해 드려요`, `${kw} 궁금한 점 ${lib.faq.length}가지 정리`], n),
    intro: at([`${clean(`${p.area} ${p.item}`)}, ${j(p.company, '을/를')} 소개합니다`, `${j(p.company, '은/는')} 이런 ${j(lib.placeNoun, '이에요/예요')}`], n),
    ...(lib.noCase ? {} : { case: at([`[고객 상황] ${p.item} 진행 사례`, `${p.area ? `${p.area}에서 ` : ''}진행한 ${p.item} 이야기 — [고객 상황]`], n) }),
    ...(season ? { season: at([`${season.month}월, ${season.hook} — ${kw} 미리 챙기세요`, `${season.month}월 ${season.hook}, ${kw} 미리 보기`], n) } : {}),
  }
  const order: TopicType[] = ['tips', 'choose', 'faq', 'intro', 'case', 'season']
  return order.filter((t) => titles[t]).map((t) => ({ type: t, title: clean(titles[t] as string), angle: ANGLE[t], keyword: kw }))
}

/* ------------------------------------------------------------------ */
/* 글감(점) — 주제마다 본문에 쓰는 항목                                    */
/* ------------------------------------------------------------------ */

interface Point {
  title: string
  body: string
}

function introSentence(p: ContentProfile): string {
  const lib = contentLib(p.industry)
  const where = [p.since ? `${p.since}년에` : '', p.region ? `${p.region}에서` : ''].filter(Boolean).join(' ')
  return clean(`${j(p.company, '은/는')} ${where ? `${where} 문을 연 ` : ''}${p.item} ${j(lib.placeNoun, '이에요/예요')}.`)
}

function processText(lib: ContentLib): string {
  return lib.process.map((s, i) => `${i + 1}. ${s.name} — ${s.desc}`).join('\n')
}

function pointsFor(p: ContentProfile, topic: Topic, variant: number): Point[] {
  const lib = contentLib(p.industry)
  switch (topic.type) {
    case 'tips':
      return rotate(lib.tips, variant)
    case 'season':
      return rotate(lib.tips, variant).slice(0, 3)
    case 'choose':
      return rotate(lib.checks, variant).map((c) => ({ title: c.title, body: c.why }))
    case 'faq':
      return lib.faq.map((f) => ({ title: f.q, body: f.a }))
    case 'intro':
      return [
        { title: '어떤 곳인가요?', body: introSentence(p) },
        { title: '하는 일', body: p.services.length ? p.services.join(' · ') : `${p.item} [하는 일을 두세 가지로 적어 주세요]` },
        ...(p.strengths.length ? [{ title: '이런 기록이 있어요', body: p.strengths.join(' · ') }] : []),
        { title: '이렇게 진행해요', body: lib.process.map((s) => s.name).join(' → ') },
      ]
    case 'case':
      return [
        { title: '어떤 고민이었나요?', body: '[고객 업종 · 상황 — 이름은 빼고 적어 주세요]' },
        { title: '이렇게 진행했어요', body: lib.process.map((s) => s.name).join(' → ') },
        { title: '결과', body: '[결과를 숫자나 고객의 말로 — 고객 동의를 받은 것만]' },
      ]
  }
}

/* ------------------------------------------------------------------ */
/* 형식별                                                               */
/* ------------------------------------------------------------------ */

function contactLines(p: ContentProfile): string {
  return [
    `전화 ${p.phone || '[대표 전화]'}`,
    p.address ? `주소 ${p.address}` : p.region ? `지역 ${p.region}` : '',
    `시간 ${p.hours || '[운영 시간]'}`,
    p.homepage ? `홈페이지 ${p.homepage}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function companyBlock(p: ContentProfile): DraftBlock {
  const lines = [introSentence(p)]
  if (p.services.length) lines.push(`하는 일: ${p.services.join(' · ')}`)
  if (p.strengths.length) lines.push(`이런 기록을 갖고 있어요.\n${p.strengths.map((s) => `• ${s}`).join('\n')}`)
  lines.push('[다른 곳과 다른 점 한 가지 — 업체와 확인해 적어 주세요]')
  return { label: `${j(p.company, '을/를')} 소개해요`, text: lines.join('\n') }
}

function ctaBlock(p: ContentProfile, kw: string): DraftBlock {
  const lib = contentLib(p.industry)
  return { label: lib.ctaTitle, text: `${kw ? `${j(kw, '을/를')} 알아보고 계신다면 편하게 연락 주세요. ` : ''}${lib.ctaBody}\n\n${contactLines(p)}` }
}

function blogDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const points = pointsFor(p, topic, variant)
  const opener: Record<TopicType, string[]> = {
    tips: [
      `${j(kw, '을/를')} 알아보고 계신가요? 처음이라면 무엇부터 봐야 할지 막막할 수 있어요. ${j(p.company, '이/가')} ${lib.field}에서 자주 듣는 이야기를 바탕으로 꼭 알아 두면 좋은 내용을 정리했어요.`,
      `${kw}, 막상 시작하려고 하면 궁금한 게 많아요. ${lib.field}에서 자주 받는 질문을 바탕으로 미리 알아 두면 좋은 ${points.length}가지를 정리했어요.`,
    ],
    choose: [
      `${j(kw, '을/를')} 맡길 ${j(lib.placeNoun, '을/를')} 찾고 계신가요? 겉으로는 비슷해 보여도 꼭 확인해야 할 점이 있어요.`,
      `${kw}, 어디에 맡길지 고민될 때 이 ${points.length}가지만 확인해 보세요. 나중에 생기는 문제를 많이 줄일 수 있어요.`,
    ],
    faq: [`${kw}에 대해 자주 받는 질문을 모았어요. 미리 알고 오시면 훨씬 편해요.`],
    intro: [`${j(kw, '을/를')} 찾는 분들께 ${j(p.company, '을/를')} 소개해요.`, `처음 찾아 주신 분들을 위해 ${j(p.company, '이/가')} 어떤 곳인지 정리했어요.`],
    case: ['[고객 상황]으로 고민하던 분과 함께한 이야기를 나눠요. 고객 동의를 받은 내용만 적었어요.'],
    season: (() => {
      const s = seasonHook(lib, todayOfTopic(topic))
      return s ? [`${s.month}월은 ${j(s.hook, '이에요/예요')}. 이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요. 미리 챙기면 좋은 것을 정리했어요.`] : [`이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요. 미리 챙기면 좋은 것을 정리했어요.`]
    })(),
  }
  const blocks: DraftBlock[] = [{ label: '', text: topic.title, hint: '제목' }, { label: '', text: at(opener[topic.type], variant), hint: '첫 문단' }]
  if (topic.type === 'intro') {
    // 소개 글: 사실 · 하는 일 · 기록(줄마다) · 다른 점(비워 둠) · 진행 순서(설명까지)
    blocks.push({ label: points[0].title, text: points[0].body })
    blocks.push({ label: points[1].title, text: p.services.length ? p.services.map((s) => `• ${s}`).join('\n') : points[1].body })
    if (p.strengths.length) blocks.push({ label: '이런 기록이 있어요', text: p.strengths.map((s) => `• ${s}`).join('\n') })
    blocks.push({ label: '다른 곳과 다른 점', text: '[다른 곳과 다른 점 한 가지 — 업체와 확인해 적어 주세요]' })
    blocks.push({ label: '이렇게 진행해요', text: processText(lib) })
  } else {
    points.forEach((pt, i) => blocks.push({ label: topic.type === 'faq' ? `Q. ${pt.title}` : `${i + 1}. ${pt.title}`, text: topic.type === 'faq' ? `A. ${pt.body}` : pt.body }))
    if (topic.type === 'choose') blocks.push({ label: `${j(p.company, '은/는')} 이렇게 진행해요`, text: processText(lib) })
    if (topic.type === 'season') blocks.push({ label: '이번 달 안내', text: '[이번 달 일정 · 혜택이 있다면 적어 주세요 — 없으면 이 칸을 지워 주세요]' })
    blocks.push(companyBlock(p))
  }
  blocks.push(ctaBlock(p, kw))
  blocks.push({ label: '', text: hashtags(p).join(' '), hint: '해시태그' })
  return blocks
}

// 주제에 날짜를 싣지 않으므로 계절 글은 주제 제목의 'N월' 로 달을 되찾는다
function todayOfTopic(topic: Topic): string {
  const m = /^(\d{1,2})월/.exec(topic.title)
  return m ? `2000-${String(Number(m[1])).padStart(2, '0')}-01` : '2000-01-01'
}

function hookFor(p: ContentProfile, topic: Topic, variant: number, count: number): string {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const s = seasonHook(lib, todayOfTopic(topic))
  const hooks: Record<TopicType, string[]> = {
    tips: [`${kw}, 이것 모르고 시작하면 손해예요.`, `${kw} 알아보기 전에 딱 ${count}가지만 보세요.`],
    choose: [`${j(lib.placeNoun, '을/를')} 고르기 전에 이것만 확인하세요.`, `${kw}, 어디에 맡길지 고민이라면 끝까지 보세요.`],
    faq: [`${p.item} 하면 가장 많이 받는 질문, 바로 답해 드려요.`],
    intro: [`${clean(`${p.area} ${p.item}`)}, 찾고 있다면 이 영상을 보세요.`],
    case: ['[고객 상황]이던 분이 이렇게 바뀌었어요.'],
    season: [s ? `${s.month}월은 ${j(s.hook, '이에요/예요')}. 지금 챙길 것 ${count}가지!` : `지금 챙길 것 ${count}가지!`],
  }
  return at(hooks[topic.type], variant)
}

function painFor(topic: Topic): string {
  const pains: Record<TopicType, string> = {
    tips: '무엇부터 봐야 할지 막막하죠?',
    choose: '비슷해 보여도 꼭 봐야 할 게 있어요.',
    faq: '미리 알고 오시면 훨씬 편해요.',
    intro: '어떤 곳인지 짧게 보여 드려요.',
    case: '[처음 고민 — 한 문장]',
    season: '미리 준비하면 훨씬 여유로워요.',
  }
  return pains[topic.type]
}

function thumbFor(p: ContentProfile, topic: Topic, count: number): string {
  const short = p.item.length <= 8 ? p.item : ''
  const map: Record<TopicType, string> = {
    tips: `${short ? `${short} ` : ''}꼭 알아야 할 ${count}가지`,
    choose: `맡기기 전 체크 ${count}가지`,
    faq: `${short ? `${short} ` : ''}자주 묻는 질문`,
    intro: `${p.company}${p.area ? ` · ${p.area}` : ''}`,
    case: '[결과 한 줄]',
    season: `지금 챙길 ${count}가지`,
  }
  return map[topic.type]
}

function shortsDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const points = pointsFor(p, topic, variant).slice(0, 3)
  const thumb = thumbFor(p, topic, points.length)
  const spans = ['8~16초', '16~24초', '24~32초']
  return [
    { label: '', text: topic.title, hint: '제목' },
    { label: '0~3초 · 첫마디', text: `말: ${hookFor(p, topic, variant, points.length)}\n화면: 큰 자막 "${thumb}"` },
    { label: '3~8초 · 공감', text: `말: ${painFor(topic)}\n화면: ${lib.visual.split(' · ')[0]} · 질문 자막` },
    ...points.map((pt, i) => ({ label: `${spans[i]} · ${i + 1}번째`, text: `말: ${pt.title}. ${firstSentence(pt.body)}\n화면: 자막 "${pt.title}"` })),
    { label: '32~40초 · 마무리', text: `말: ${lib.ctaShort.replace('{company}', p.company)}\n화면: ${p.company} · ${p.phone || '[연락처]'}` },
    { label: '설명 · 해시태그', text: `${topic.title}\n${hashtags(p, 8).join(' ')}` },
  ]
}

function videoDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const points = pointsFor(p, topic, variant)
  const thumb = thumbFor(p, topic, points.length)
  const hello = clean(`안녕하세요, ${p.area} ${p.item} ${lib.placeNoun} ${j(p.company, '이에요/예요')}.`)
  const blocks: DraftBlock[] = [
    { label: '', text: topic.title, hint: '제목' },
    { label: '썸네일 글자', text: thumb },
    { label: '0:00 · 오프닝', text: `말: ${hookFor(p, topic, variant, points.length)} 오늘은 ${topic.keyword} 이야기를 ${points.length}가지로 정리해 드려요.\n화면: ${lib.visual.split(' · ')[0]}` },
    { label: '0:30 · 인사', text: `말: ${hello}\n화면: 대표 · 매장 · 간판 중 하나` },
  ]
  points.forEach((pt, i) => {
    blocks.push({ label: `${i + 1}:00 · ${i + 1}. ${pt.title}`, text: `말: ${pt.body}\n화면: 자막 "${pt.title}" · [실제 예시 사진이나 장면]` })
  })
  const endMin = points.length + 1
  blocks.push({ label: `${endMin}:00 · 정리`, text: `말: 오늘 이야기한 ${points.length}가지를 다시 짚어 봐요.\n화면: ${points.map((pt, i) => `${i + 1}. ${pt.title}`).join(' / ')}` })
  blocks.push({ label: `${endMin}:30 · 마무리`, text: `말: ${lib.ctaShort.replace('{company}', p.company)} 궁금한 점은 댓글로 남겨 주세요.\n화면: ${p.company} · ${p.phone || '[연락처]'}${p.homepage ? ` · ${p.homepage}` : ''}` })
  blocks.push({ label: '설명란', text: `${topic.title}\n\n${contactLines(p)}\n\n${hashtags(p, 8).join(' ')}` })
  return blocks
}

function cardsDraft(p: ContentProfile, topic: Topic, variant: number, pages: 5 | 7): DraftBlock[] {
  const lib = contentLib(p.industry)
  const points = pointsFor(p, topic, variant).slice(0, pages - 2)
  const thumb = thumbFor(p, topic, points.length)
  const visuals = lib.visual.split(' · ')
  const blocks: DraftBlock[] = [{ label: '1장 · 표지', text: `큰 글자: ${thumb}\n작은 글자: ${p.company}${p.area ? ` · ${p.area}` : ''}\n그림: ${visuals[0]} 위에 큰 글자` }]
  points.forEach((pt, i) => {
    blocks.push({ label: `${i + 2}장`, text: `큰 글자: ${i + 1}. ${pt.title}\n작은 글자: ${firstSentence(pt.body)}\n그림: ${at(visuals, i + 1)} 또는 아이콘 하나` })
  })
  blocks.push({ label: `${points.length + 2}장 · 마무리`, text: `큰 글자: ${lib.ctaTitle}\n작은 글자: ${p.phone || '[연락처]'}${p.region ? ` · ${p.region}` : ''}\n그림: 로고 · 연락처 · 지도 화면` })
  blocks.push({ label: '올릴 때 쓰는 글', text: `${topic.title}\n\n${points.map((pt, i) => `${i + 1}. ${pt.title}`).join('\n')}\n\n${lib.ctaShort.replace('{company}', p.company)}\n\n${hashtags(p).join(' ')}` })
  return blocks
}

const AD_NOTE = '여러 사람에게 보내는 소식은 광고로 봐요 — 맨 앞에 (광고)를 넣었어요. 받는 분이 거부할 방법(채널 차단)을 알리고, 따로 동의받지 않았다면 밤 9시 ~ 아침 8시에는 보내지 마세요.'

function kakaoDraft(p: ContentProfile, purpose: KakaoPurpose, today: string, variant: number): { blocks: DraftBlock[]; notes: string[] } {
  const lib = contentLib(p.industry)
  const m = monthOf(today)
  const phone = `문의 ${p.phone || '[대표 전화]'}`
  const hello = `안녕하세요, ${j(p.company, '이에요/예요')}.`
  let text = ''
  if (purpose === 'news') {
    text = `(광고) ${p.company}\n\n${hello}\n[전하고 싶은 소식 — 새 서비스 · 새 메뉴 · 바뀐 운영 시간]\n\n${p.services.length ? `하는 일: ${p.services.join(' · ')}\n` : ''}${phone}`
  } else if (purpose === 'event') {
    text = `(광고) ${p.company} ${m}월 혜택 안내\n\n[혜택 내용 — 예: 첫 상담 고객 ○○]\n기간: [시작일] ~ [끝나는 날]\n대상: [대상]\n\n${lib.ctaBody}\n${phone}`
  } else if (purpose === 'season') {
    const s = seasonHook(lib, today)
    const tip = at(lib.tips, variant)
    text = `(광고) ${p.company} ${s ? s.month : m}월 안내\n\n${s ? `${s.month}월은 ${j(s.hook, '이에요/예요')}.\n` : ''}${tip.title} — ${firstSentence(tip.body)}\n\n궁금한 점은 편하게 물어봐 주세요.\n${phone}`
  } else {
    text = `${hello}\n[고객 이름]님, 지난번에 찾아 주셔서 고마워요.\n[이용하신 서비스]는 불편한 점 없으신가요?\n궁금한 점이 생기면 언제든 연락 주세요.\n${p.phone || '[대표 전화]'}`
  }
  return { blocks: [{ label: '', text, hint: PURPOSE_LABEL[purpose] }], notes: purpose === 'thanks' ? ['한 분께 1:1 로 보내는 안부예요 — 여러 사람에게 보낼 때는 (광고) 표시가 필요해요.'] : [AD_NOTE] }
}

function placeDraft(p: ContentProfile): DraftBlock[] {
  const lib = contentLib(p.industry)
  return [
    { label: '한 줄 소개', text: `${introSentence(p)} ${lib.ctaBody}` },
    { label: '하는 일', text: p.services.length ? p.services.map((s) => `• ${s}`).join('\n') : `• ${p.item}\n• [하는 일 두세 가지]` },
    { label: '이런 점을 챙겨요', text: [...p.strengths.map((s) => `• ${s}`), '• [다른 곳과 다른 점 한 가지]'].join('\n') },
    { label: '이용 안내', text: `• 시간: ${p.hours || '[운영 시간 · 쉬는 날]'}\n• 주차: [주차 안내]\n• 예약 · 문의: ${p.phone || '[대표 전화]'}` },
    { label: '찾아오시는 길', text: `${p.address || '[주소]'}\n[가까운 역 · 큰 건물 기준 길 안내]` },
  ]
}

function keywordDraft(p: ContentProfile): DraftBlock[] {
  return [...keywordGroups(p).map((g) => ({ label: g.label, text: g.words.join('\n'), hint: g.why })), { label: '해시태그', text: hashtags(p, 15).join(' ') }]
}

/* ------------------------------------------------------------------ */
/* 바깥에서 쓰는 것                                                      */
/* ------------------------------------------------------------------ */

export function makeDraft(p: ContentProfile, req: DraftRequest, today: string): Draft {
  const variant = req.variant ?? 0
  const kw = clean(req.keyword ?? '') || mainKeyword(p)
  const topic = req.topic ?? topicsFor(p, kw, today, variant)[0]
  const lib = contentLib(p.industry)
  let blocks: DraftBlock[] = []
  let notes: string[] = []
  let title = ''
  switch (req.kind) {
    case 'keywords':
      blocks = keywordDraft(p)
      title = `${mainKeyword(p)} 키워드`
      notes = [KEYWORD_NOTE]
      break
    case 'blog':
      blocks = blogDraft(p, topic, variant)
      title = topic.title
      break
    case 'shorts':
      blocks = shortsDraft(p, topic, variant)
      title = topic.title
      break
    case 'video':
      blocks = videoDraft(p, topic, variant)
      title = topic.title
      break
    case 'cards':
      blocks = cardsDraft(p, topic, variant, req.pages ?? 5)
      title = topic.title
      break
    case 'kakao': {
      const k = kakaoDraft(p, req.purpose ?? 'news', today, variant)
      blocks = k.blocks
      notes = k.notes
      title = `카톡 · ${PURPOSE_LABEL[req.purpose ?? 'news']}`
      break
    }
    case 'place':
      blocks = placeDraft(p)
      title = `${p.company} 플레이스 소개`
      break
  }
  if (lib.caution && req.kind !== 'keywords') notes.push(lib.caution)
  const toned = blocks.map((b) => ({ ...b, label: applyTone(b.label, p.tone), text: applyTone(b.text, p.tone) }))
  return {
    kind: req.kind,
    title: applyTone(title, p.tone),
    blocks: toned,
    notes,
    input: {
      ...(NEEDS_TOPIC.has(req.kind) ? { keyword: topic.keyword, topicType: topic.type, topicTitle: topic.title } : {}),
      ...(req.kind === 'cards' ? { pages: req.pages ?? 5 } : {}),
      ...(req.kind === 'kakao' ? { purpose: req.purpose ?? 'news' } : {}),
      variant,
      tone: p.tone,
    },
  }
}

/** 복사할 글 — 형식마다 읽기 좋은 모양으로 */
export function plainText(kind: ContentKind, blocks: readonly DraftBlock[]): string {
  return blocks
    .map((b) => {
      if (!b.label) return b.text
      if (kind === 'place') return `■ ${b.label}\n${b.text}`
      if (kind === 'shorts' || kind === 'video' || kind === 'cards') return `[${b.label}]\n${b.text}`
      return `${b.label}\n${b.text}`
    })
    .join('\n\n')
    .trim()
}

/* ------------------------------------------------------------------ */
/* 점검                                                                 */
/* ------------------------------------------------------------------ */

export interface DraftCheck {
  key: string
  level: 'must' | 'should' | 'info'
  text: string
}

export function placeholders(text: string): string[] {
  return [...text.matchAll(/\[([^\]\n]{1,80})\]/g)].map((m) => m[1])
}

export function draftChecks(kind: ContentKind, blocks: readonly DraftBlock[], industry: ContentProfile['industry'], keyword?: string): DraftCheck[] {
  const text = plainText(kind, blocks)
  const out: DraftCheck[] = []
  const holes = placeholders(text)
  if (holes.length) out.push({ key: 'holes', level: 'must', text: `[대괄호] ${holes.length}곳을 실제 내용으로 바꾸거나 지워 주세요.` })
  for (const r of RISKY_WORDS) {
    const m = r.re.exec(text)
    if (m) out.push({ key: `risky-${r.word}`, level: 'should', text: `'${m[0]}' — ${r.why}. 광고 규정에 걸릴 수 있어요.` })
  }
  const lib = contentLib(industry)
  if (lib.caution && kind !== 'keywords') out.push({ key: 'caution', level: 'info', text: lib.caution })
  if (kind === 'blog' && keyword) {
    const n = text.split(keyword).length - 1
    out.push({ key: 'kw', level: n >= 2 ? 'info' : 'should', text: n >= 2 ? `키워드 "${keyword}" ${n}번 — 제목 · 첫 문단 · 마무리에 들어 있어요.` : `키워드 "${keyword}" 가 ${n}번뿐이에요 — 제목과 첫 문단에 넣어 주세요.` })
  }
  if (kind !== 'keywords') out.push({ key: 'len', level: 'info', text: `${text.length.toLocaleString('ko-KR')}자(공백 포함)` })
  return out
}
