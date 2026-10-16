/**
 * 홍보 글 만들기 (D-203) — 업체 홍보 정보 + 업종 견본으로 글 초안을 만든다. 규칙으로 채우며 'AI' 가 아니다.
 *
 * 형식 7가지: 키워드 정하기 · 블로그 글 · 짧은 영상 대본 · 긴 영상 기획 · 카드뉴스 · 카톡 채널 소식 · 플레이스 소개글.
 * 블로그 · 영상 · 카드뉴스는 '주제' 하나를 같이 쓴다(키워드 → 주제 → 글).
 * [다른 안] 은 variant 번호로 견본 문장 · 순서를 바꾼다 — 같은 번호면 늘 같은 글(시험 · 다시 열기).
 * 업체마다 다른 내용(혜택 · 사례 · 주차 …)은 지어내지 않고 [대괄호] 로 비워 둔다.
 *
 * D-207 이상한 AI 분해에서 가져온 구조(크레탑 · 요금 · 크레딧은 빼고 마케팅 규칙만 — 문장은 우리가 새로 씀):
 *   - 블로그 = 주제 카드(키워드 · 제목 · 주제 · 전략) → 본문. 글 종류 둘: 우리 블로그 글(업체가 말함) / 체험단 가이드(후기 쓰는 분께 줄 안내).
 *     본문 = 도입부 → 소제목 구간 → 한눈에 정리 → 소개 · 문의, 사이사이 사진 자리.
 *   - 영상(롱폼) = 기획 카드(썸네일 문구 · 제목 · 도입부 5~15초 · 주제 · 타겟 · 전략) → 대본.
 *   - 쇼츠 · 릴스 = 고정 문구 · 첫 3초 붙잡는 말 · 도입/중반/후반 · 초 구간 대본(나레이션 · 자막 · 장면) · 캡션, 길이 20~30초 / 30~60초.
 *   - 카드뉴스 = 장마다 큰 글자 · 작은 글자 · 그림, 광고 유형(정보 · 문제 공감 · 망설임 풀기 · 기록 증명 · 손해 피하기).
 *   - 키워드 = 네이버 키워드 도구에서 붙여 넣은 표 정리(쉼표 · 줄 · 탭 · '< 10' 은 0 · 같은 말은 큰 값 · 많은 순).
 *   - 발행 계획 = 주 2회 / 주 4회.
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
  /** D-207 전략 — 이 글이 손님을 어떻게 문의까지 데려오는가 */
  strategy: string
}

export type KakaoPurpose = 'news' | 'event' | 'season' | 'thanks'

export const PURPOSE_LABEL: Record<KakaoPurpose, string> = {
  news: '새 소식',
  event: '혜택 · 행사',
  season: '이번 달 안내',
  thanks: '1:1 안부',
}

/** D-207 블로그 글 종류 — 누가 말하는 글인가 */
export type BlogType = 'brand' | 'review'
export const BLOG_TYPE_LABEL: Record<BlogType, string> = { brand: '우리 블로그 글', review: '체험단 가이드' }
export const BLOG_TYPE_HINT: Record<BlogType, string> = {
  brand: '업체가 직접 쓰는 정보 · 소개 글',
  review: '후기를 써 줄 체험단에게 보내는 작성 안내',
}

/** D-207 쇼츠 · 릴스 길이 */
export type ShortLen = '20-30' | '30-60'
export const SHORT_LEN_LABEL: Record<ShortLen, string> = { '20-30': '20~30초', '30-60': '30~60초' }

/** D-207 카드뉴스 광고 유형 — 어떤 마음을 움직이는 장인가 */
export type AdType = 'info' | 'problem' | 'objection' | 'proof' | 'loss'
export const AD_TYPES: AdType[] = ['info', 'problem', 'objection', 'proof', 'loss']
export const AD_TYPE_LABEL: Record<AdType, string> = { info: '정보형', problem: '고민 공감형', objection: '망설임 풀기형', proof: '기록 증명형', loss: '손해 피하기형' }
export const AD_TYPE_HINT: Record<AdType, string> = {
  info: '알아 둘 것을 장마다 하나씩',
  problem: '손님의 고민을 먼저 말하고 해결로',
  objection: '망설이는 이유를 먼저 풀어 주기',
  proof: '업력 · 인증 같은 기록으로 믿음',
  loss: '모르고 하면 손해 보는 것',
}

export interface DraftRequest {
  kind: ContentKind
  keyword?: string
  topic?: Topic
  pages?: 5 | 7
  purpose?: KakaoPurpose
  variant?: number
  blogType?: BlogType
  shortLen?: ShortLen
  adType?: AdType
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
  input: { keyword?: string; topicType?: TopicType; topicTitle?: string; pages?: 5 | 7; purpose?: KakaoPurpose; variant: number; tone: Tone; blogType?: BlogType; shortLen?: ShortLen; adType?: AdType }
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

const STRATEGY: Record<TopicType, string> = {
  tips: '검색으로 들어온 분께 먼저 도움을 주고, 끝에서 업체를 알려 문의로 연결해요.',
  choose: '여러 곳을 비교하는 분께 기준을 주고, 우리가 그 기준을 지키는 모습으로 믿음을 줘요.',
  faq: '문의 전에 궁금한 점을 미리 풀어 전화하기 쉽게 해요.',
  intro: '업체 이름이나 지역으로 찾은 분이 한 번에 마음을 정하게 해요.',
  case: '비슷한 고민이 있는 분이 "나도 되겠다" 고 느끼게 해요.',
  season: '찾는 사람이 많아지는 때를 잡아 미리 눈에 띄게 해요.',
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
  return order.filter((t) => titles[t]).map((t) => ({ type: t, title: clean(titles[t] as string), angle: ANGLE[t], keyword: kw, strategy: STRATEGY[t] }))
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

const DIFFER_HOLE = '[다른 곳과 다른 점 한 가지 — 업체와 확인해 적어 주세요]'

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
  lines.push(p.differ ? `다른 곳과 다른 점 — ${p.differ}` : DIFFER_HOLE)
  return { label: `${j(p.company, '을/를')} 소개해요`, text: lines.join('\n') }
}

function ctaBlock(p: ContentProfile, kw: string): DraftBlock {
  const lib = contentLib(p.industry)
  return { label: lib.ctaTitle, text: `${kw ? `${j(kw, '을/를')} 알아보고 계신다면 편하게 연락 주세요. ` : ''}${lib.ctaBody}\n\n${contactLines(p)}` }
}

/**
 * 사진 자리 — [대괄호] 가 아니라 (사진 자리: …) 로 적는다. 채울 글이 아니라 사진을 넣을 곳이라 점검의 '꼭' 에 세지 않는다.
 */
const PHOTO_PREFIX = '(사진 자리:'
const photo = (what: string): DraftBlock => ({ label: '', text: `${PHOTO_PREFIX} ${what})`, hint: '사진 자리' })

function visualsOf(lib: ContentLib): string[] {
  return lib.visual
    .split(' · ')
    .map((v) => v.trim())
    .filter(Boolean)
}

function objectionBlock(p: ContentProfile): DraftBlock {
  return { label: '이런 걱정이 있으셨죠?', text: `${p.objection}\n[이 걱정을 어떻게 덜어 드리는지 한두 문장 — 업체와 확인해 적어 주세요]` }
}

function blogDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const points = pointsFor(p, topic, variant)
  const visuals = visualsOf(lib)
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
  // 도입부 → 사진 → 소제목 구간(가운데 사진) → 한눈에 정리 → 걱정 풀기 → 소개 → 사진 → 문의 → 해시태그
  const blocks: DraftBlock[] = [{ label: '', text: topic.title, hint: '제목' }, { label: '', text: at(opener[topic.type], variant), hint: '첫 문단(도입부)' }, photo(at(visuals, 0))]
  if (topic.type === 'intro') {
    // 소개 글: 사실 · 하는 일 · 기록(줄마다) · 다른 점 · 진행 순서(설명까지)
    blocks.push({ label: points[0].title, text: points[0].body })
    blocks.push({ label: points[1].title, text: p.services.length ? p.services.map((s) => `• ${s}`).join('\n') : points[1].body })
    if (p.strengths.length) blocks.push({ label: '이런 기록이 있어요', text: p.strengths.map((s) => `• ${s}`).join('\n') })
    blocks.push({ label: '다른 곳과 다른 점', text: p.differ || DIFFER_HOLE })
    if (p.objection) blocks.push(objectionBlock(p))
    blocks.push(photo(at(visuals, 1)))
    blocks.push({ label: '이렇게 진행해요', text: processText(lib) })
  } else {
    points.forEach((pt, i) => {
      blocks.push({ label: topic.type === 'faq' ? `Q. ${pt.title}` : `${i + 1}. ${pt.title}`, text: topic.type === 'faq' ? `A. ${pt.body}` : pt.body })
      if (i === 1 && points.length > 2) blocks.push(photo(at(visuals, 1)))
    })
    if (topic.type === 'choose') {
      blocks.push({ label: `${j(p.company, '은/는')} 이렇게 진행해요`, text: processText(lib) })
      blocks.push({ label: '한눈에 정리', text: ['확인할 것 | 이유', ...points.map((pt) => `${pt.title} | ${firstSentence(pt.body)}`)].join('\n'), hint: '표로 넣으면 좋아요' })
    }
    if (topic.type === 'tips' || topic.type === 'season') blocks.push({ label: '한눈에 정리', text: points.map((pt, i) => `${i + 1}. ${pt.title}`).join('\n') })
    if (p.objection && (topic.type === 'choose' || topic.type === 'faq')) blocks.push(objectionBlock(p))
    if (topic.type === 'season') blocks.push({ label: '이번 달 안내', text: '[이번 달 일정 · 혜택이 있다면 적어 주세요 — 없으면 이 칸을 지워 주세요]' })
    blocks.push(companyBlock(p))
  }
  blocks.push(photo(at(visuals, 2)))
  blocks.push(ctaBlock(p, kw))
  blocks.push({ label: '', text: hashtags(p).join(' '), hint: '해시태그' })
  return blocks
}

/**
 * D-207 체험단 가이드 — 후기를 써 줄 분께 보내는 작성 안내(업체가 쓰는 글이 아니다).
 * 대가를 받은 글임을 제목이나 첫머리에 밝히게 한다(공정거래위원회 추천 · 보증 심사지침).
 */
function reviewGuide(p: ContentProfile, topic: Topic): DraftBlock[] {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const visuals = visualsOf(lib)
  const groups = keywordGroups(p)
  const extra = [...(groups.find((g) => g.key === 'compare')?.words ?? []), ...(groups.find((g) => g.key === 'service')?.words ?? [])].filter((w) => w !== kw).slice(0, 3)
  const shots = [...visuals, '건물 밖 · 간판(찾아오는 길)', '안내 받는 모습 · 진행 장면', '위치 지도 화면'].filter((v, i, all) => all.indexOf(v) === i).slice(0, 7)
  return [
    { label: '', text: `[체험단 가이드] ${p.company} · ${kw}`, hint: '가이드 제목' },
    { label: '체험 안내', text: `업체: ${p.company}\n위치: ${p.address || p.region || '[주소]'}\n체험 내용: [제공하는 제품 · 서비스와 범위]\n체험 기간 · 글 올리는 날: [기간]` },
    { label: '꼭 넣을 키워드', text: `주 키워드: ${kw}\n함께 쓰면 좋은 말: ${extra.length ? extra.join(', ') : '[함께 쓸 말 두세 개]'}\n제목에 주 키워드를 한 번 넣고, 본문에는 자연스럽게 두세 번 넣어 주세요.` },
    {
      label: '제목 예시',
      text: [`${kw}, ${p.company} 직접 이용해 본 이야기`, `${clean(`${p.area} ${p.item}`)} 찾다가 ${p.company} 다녀왔어요`, `${kw} 고민이라면 참고하세요 — ${p.company} 이용 과정`].map((t) => `• ${t}`).join('\n'),
    },
    {
      label: '꼭 담아 주세요',
      text: [
        `• 하는 일: ${p.services.length ? p.services.join(' · ') : p.item}`,
        `• 업체가 강조하는 점: ${p.differ || '[업체가 강조하고 싶은 점 한 가지]'}`,
        `• 진행 순서: ${lib.process.map((s) => s.name).join(' → ')}`,
        `• 이용 정보: 위치 · 운영 시간(${p.hours || '[운영 시간]'}) · 연락처(${p.phone || '[대표 전화]'})`,
      ].join('\n'),
    },
    { label: `찍어 주세요(사진 ${shots.length}장 이상)`, text: shots.map((v) => `• ${v}`).join('\n') },
    { label: '글 순서', text: ['1. 찾게 된 이유 — 어떤 고민이 있었는지', '2. 처음 연락 · 방문했을 때', '3. 진행 과정 — 사진과 함께', '4. 좋았던 점 · 아쉬웠던 점(솔직하게)', '5. 이용 정보 — 위치 · 시간 · 연락처', '6. 마무리 한마디'].join('\n') },
    {
      label: '지켜 주세요',
      text: [
        `• 글 제목이나 첫 문장에 "${p.company}에서 [제품 · 서비스]를 제공받아 작성한 글이에요" 처럼 대가를 받은 사실을 분명히 적어 주세요(공정거래위원회 추천 · 보증 심사지침).`,
        '• 직접 겪은 것만 적고, 효과를 장담하는 말(최고 · 100% · 무조건)은 쓰지 말아 주세요.',
        '• 다른 사람의 사진 · 글은 가져오지 말아 주세요.',
        ...(lib.caution ? [`• ${lib.caution}`] : []),
      ].join('\n'),
    },
  ]
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

/** 쇼츠 · 릴스 — 고정 문구 · 첫 3초 · 도입/중반/후반 · 초 구간 대본(나레이션 · 자막 · 장면) · 캡션 */
function shortsDraft(p: ContentProfile, topic: Topic, variant: number, len: ShortLen): DraftBlock[] {
  const lib = contentLib(p.industry)
  const n = len === '20-30' ? 2 : 3
  const points = pointsFor(p, topic, variant).slice(0, n)
  const fixed = thumbFor(p, topic, points.length)
  const visuals = visualsOf(lib)
  const hook = hookFor(p, topic, variant, points.length)
  const cta = lib.ctaShort.replace('{company}', p.company)
  // 구간(초) — 20~30초: 3 · 5 · 7 · 7 · 5 = 27초 / 30~60초: 3 · 5 · 10 · 10 · 10 · 7 = 45초
  const spans = len === '20-30' ? [3, 5, 7, 7, 5] : [3, 5, 10, 10, 10, 7]
  const ts = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  const rows: { nar: string; sub: string; scene: string }[] = [
    { nar: hook, sub: fixed, scene: `${at(visuals, 0)} — 첫 장면은 움직임이 있게` },
    { nar: painFor(topic), sub: painFor(topic), scene: at(visuals, 1) },
    ...points.map((pt, i) => ({ nar: `${pt.title}. ${firstSentence(pt.body)}`, sub: `${i + 1}. ${pt.title}`, scene: at(visuals, i + 2) })),
    { nar: cta, sub: `${p.company} · ${p.phone || '[연락처]'}`, scene: '로고 · 연락처 화면' },
  ]
  let t = 0
  const script: DraftBlock[] = rows.map((r, i) => {
    const from = t
    t += spans[i] ?? 5
    return { label: `${ts(from)} - ${ts(t)}`, text: `나레이션: ${r.nar}\n자막: ${r.sub === fixed && i > 0 ? '고정 문구 유지' : r.sub}\n장면: ${r.scene}` }
  })
  return [
    { label: '', text: topic.title, hint: `제목 · ${SHORT_LEN_LABEL[len]} 세로 영상` },
    { label: '고정 문구', text: fixed, hint: '영상 내내 위에 떠 있는 글자 — 짧게' },
    { label: '첫 3초 · 붙잡는 말', text: hook },
    { label: '구조', text: `도입부: ${painFor(topic)}\n중반부: ${points.map((pt) => pt.title).join(' · ')}\n후반부: ${cta}` },
    ...script,
    { label: '캡션', text: `${topic.title}\n${points.map((pt, i) => `${i + 1}. ${pt.title}`).join('\n')}\n\n${cta}\n${hashtags(p, 8).join(' ')}` },
  ]
}

/** 롱폼 — 기획 카드(썸네일 문구 · 제목 · 도입부 · 주제 · 타겟 · 전략) → 대본 */
function videoDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const points = pointsFor(p, topic, variant)
  const thumb = thumbFor(p, topic, points.length)
  const visuals = visualsOf(lib)
  const hello = clean(`안녕하세요, ${p.area} ${p.item} ${lib.placeNoun} ${j(p.company, '이에요/예요')}.`)
  const blocks: DraftBlock[] = [
    { label: '', text: topic.title, hint: '제목 — 클릭하게 하고, 무슨 영상인지 분명하게' },
    { label: '썸네일 문구', text: thumb, hint: '눈길 + 궁금증 — 짧을수록 잘 읽혀요' },
    { label: '도입부 · 처음 5~15초', text: `말: ${hookFor(p, topic, variant, points.length)} 끝까지 보시면 ${topic.keyword}에서 꼭 챙길 ${points.length}가지를 한 번에 정리할 수 있어요.\n화면: ${at(visuals, 0)} · 큰 자막 "${thumb}"`, hint: '왜 봐야 하는지 · 끝까지 보면 무엇을 얻는지' },
    { label: '주제', text: `${TOPIC_LABEL[topic.type]} — ${topic.angle}` },
    { label: '타겟 청중', text: p.target },
    { label: '전략', text: topic.strategy },
    { label: '0:15 · 인사', text: `말: ${hello}\n화면: 대표 · 매장 · 간판 중 하나` },
  ]
  points.forEach((pt, i) => {
    blocks.push({ label: `${i + 1}:00 · ${i + 1}. ${pt.title}`, text: `말: ${pt.body}\n화면: 자막 "${pt.title}" · 자료 화면: [실제 예시 사진이나 장면]` })
  })
  const endMin = points.length + 1
  blocks.push({ label: `${endMin}:00 · 정리`, text: `말: 오늘 이야기한 ${points.length}가지를 다시 짚어 봐요.\n화면: ${points.map((pt, i) => `${i + 1}. ${pt.title}`).join(' / ')}` })
  blocks.push({ label: `${endMin}:30 · 마무리`, text: `말: ${lib.ctaShort.replace('{company}', p.company)} 궁금한 점은 댓글로 남겨 주세요.\n화면: ${p.company} · ${p.phone || '[연락처]'}${p.homepage ? ` · ${p.homepage}` : ''}` })
  blocks.push({ label: '설명란', text: `${topic.title}\n\n${contactLines(p)}\n\n${hashtags(p, 8).join(' ')}` })
  return blocks
}

/** 카드뉴스 — 광고 유형마다 장 구성이 다르다. 장마다 큰 글자 · 작은 글자 · 그림 */
function cardsDraft(p: ContentProfile, topic: Topic, variant: number, pages: 5 | 7, adType: AdType): DraftBlock[] {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const visuals = visualsOf(lib)
  const body = pages - 2
  const page = (n: number, tag: string, big: string, small: string, pic: string): DraftBlock => ({ label: `${n}장${tag ? ` · ${tag}` : ''}`, text: `큰 글자: ${big}\n작은 글자: ${small}\n그림: ${pic}` })
  let cover: DraftBlock
  let inner: DraftBlock[] = []
  if (adType === 'problem') {
    const probs = rotate(lib.problems, variant).slice(0, Math.max(2, body - 2))
    cover = page(1, '표지', `${kw}, 이런 고민 있으세요?`, `${p.company}${p.area ? ` · ${p.area}` : ''}`, `${at(visuals, 0)} 위에 큰 글자`)
    inner = [
      ...probs.map((w, i) => page(i + 2, '고민', `"${w}" 때문에 고민이라면`, '혼자 알아보면 시간이 오래 걸려요', at(visuals, i + 1))),
      page(probs.length + 2, '해결', `${j(p.company, '이/가')} 이렇게 도와드려요`, lib.process.map((s) => s.name).join(' → '), '진행 장면'),
      page(probs.length + 3, '다른 점', p.differ || '[다른 곳과 다른 점 한 가지]', p.strengths.slice(0, 2).join(' · ') || '[믿을 만한 기록 한 줄]', at(visuals, 3)),
    ].slice(0, body)
  } else if (adType === 'objection') {
    const worry = p.objection || '[손님이 가장 많이 망설이는 점]'
    cover = page(1, '표지', `${worry}, 걱정되시죠?`, `${p.company}가 먼저 답해 드려요`, `${at(visuals, 0)} · 질문 말풍선`)
    inner = [
      page(2, '공감', '많은 분이 같은 걱정을 하세요', `${kw} 알아볼 때 가장 많이 묻는 것`, '고개를 갸웃하는 사람 · 물음표'),
      page(3, '이렇게 챙겨요', '[이 걱정을 어떻게 덜어 드리는지 한 문장]', p.differ || '[다른 곳과 다른 점 한 가지]', at(visuals, 1)),
      ...(p.strengths.length ? [page(4, '기록', p.strengths[0], p.strengths.slice(1, 3).join(' · ') || `${p.company}의 기록`, '인증서 · 숫자 강조')] : [page(4, '순서', '진행은 이렇게', lib.process.map((s) => s.name).join(' → '), '진행 장면')]),
      page(5, '자주 묻는 질문', lib.faq[0]?.q ?? '자주 묻는 질문', lib.faq[0]?.a ?? '', at(visuals, 2)),
      page(6, '순서', '진행은 이렇게', lib.process.map((s) => s.name).join(' → '), '진행 장면'),
    ].slice(0, body)
  } else if (adType === 'proof') {
    const facts = p.strengths.length ? p.strengths : ['[업력 · 진행 건수 같은 숫자]', '[인증 · 자격]', '[고객 수 · 재방문 같은 기록]']
    cover = page(1, '표지', `기록으로 보는 ${p.company}`, `${clean(`${p.area} ${p.item}`)}`, `${at(visuals, 0)} · 큰 숫자`)
    // 기록이 모자라면 진행 순서 · 자주 묻는 질문으로 장 수를 채운다(지어내지 않는다)
    const rows: [string, string, string, string][] = [
      ...facts.slice(0, body - 1).map((f, i): [string, string, string, string] => ['기록', f, i === 0 ? '말보다 기록으로 보여 드려요' : '사실만 적었어요', '숫자 · 인증 마크 강조']),
      ['다른 점', p.differ || '[다른 곳과 다른 점 한 가지]', `${kw}, ${j(p.company, '이/가')} 함께해요`, at(visuals, 1)],
      ['순서', '진행은 이렇게', lib.process.map((s) => s.name).join(' → '), '진행 장면'],
      ['자주 묻는 질문', lib.faq[0]?.q ?? '자주 묻는 질문', lib.faq[0]?.a ?? '', at(visuals, 2)],
    ]
    inner = rows.slice(0, body).map(([tag, big, small, pic], i) => page(i + 2, tag, big, small, pic))
  } else if (adType === 'loss') {
    const checks = rotate(lib.checks, variant).slice(0, body - 1)
    cover = page(1, '표지', `${kw}, 이것 모르면 손해예요`, `맡기기 전 ${checks.length}가지만 확인하세요`, `${at(visuals, 0)} · 경고 표시`)
    inner = [...checks.map((c, i) => page(i + 2, '', `${i + 1}. ${c.title}`, `놓치면: ${c.why}`, at(visuals, i + 1))), page(checks.length + 2, '우리는', `${j(p.company, '은/는')} 이렇게 챙겨요`, p.differ || lib.process.map((s) => s.name).join(' → '), '진행 장면')].slice(0, body)
  } else {
    const points = pointsFor(p, topic, variant).slice(0, body)
    const thumb = thumbFor(p, topic, points.length)
    cover = page(1, '표지', thumb, `${p.company}${p.area ? ` · ${p.area}` : ''}`, `${visuals[0] ?? ''} 위에 큰 글자`)
    inner = points.map((pt, i) => page(i + 2, '', `${i + 1}. ${pt.title}`, firstSentence(pt.body), `${at(visuals, i + 1)} 또는 아이콘 하나`))
  }
  const last = page(inner.length + 2, '마무리', lib.ctaTitle, `${p.phone || '[연락처]'}${p.region ? ` · ${p.region}` : ''}`, '로고 · 연락처 · 지도 화면')
  const caption = `${topic.title}\n\n${inner.map((b) => /큰 글자: (.*)/.exec(b.text)?.[1] ?? '').filter(Boolean).map((t) => `• ${t}`).join('\n')}\n\n${lib.ctaShort.replace('{company}', p.company)}\n\n${hashtags(p).join(' ')}`
  return [{ ...cover, hint: AD_TYPE_LABEL[adType] }, ...inner, last, { label: '올릴 때 쓰는 글', text: caption }]
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
    { label: '이런 점을 챙겨요', text: [...(p.differ ? [`• ${p.differ}`] : []), ...p.strengths.map((s) => `• ${s}`), ...(p.differ ? [] : ['• [다른 곳과 다른 점 한 가지]'])].join('\n') },
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
      if ((req.blogType ?? 'brand') === 'review') {
        blocks = reviewGuide(p, topic)
        title = `체험단 가이드 · ${p.company} · ${topic.keyword}`
      } else {
        blocks = blogDraft(p, topic, variant)
        title = topic.title
      }
      break
    case 'shorts':
      blocks = shortsDraft(p, topic, variant, req.shortLen ?? '20-30')
      title = topic.title
      break
    case 'video':
      blocks = videoDraft(p, topic, variant)
      title = topic.title
      break
    case 'cards':
      blocks = cardsDraft(p, topic, variant, req.pages ?? 5, req.adType ?? 'info')
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
      ...(req.kind === 'cards' ? { pages: req.pages ?? 5, adType: req.adType ?? 'info' } : {}),
      ...(req.kind === 'blog' ? { blogType: req.blogType ?? 'brand' } : {}),
      ...(req.kind === 'shorts' ? { shortLen: req.shortLen ?? '20-30' } : {}),
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
  const guide = blocks.some((b) => b.hint === '가이드 제목')
  if (kind === 'blog' && keyword && !guide) {
    const n = text.split(keyword).length - 1
    out.push({ key: 'kw', level: n >= 2 ? 'info' : 'should', text: n >= 2 ? `키워드 "${keyword}" ${n}번 — 제목 · 첫 문단 · 마무리에 들어 있어요.` : `키워드 "${keyword}" 가 ${n}번뿐이에요 — 제목과 첫 문단에 넣어 주세요.` })
    // D-207 블로그 구조 점검(우리 기준 — 네이버가 정한 숫자 규칙이 아니다)
    const title = blocks.find((b) => b.hint === '제목')?.text ?? ''
    const first = blocks.find((b) => b.hint?.startsWith('첫 문단'))?.text ?? ''
    if (title && !title.includes(keyword)) out.push({ key: 'kw-title', level: 'should', text: `제목에 키워드 "${keyword}" 가 없어요 — 제목 앞쪽에 넣어 주세요.` })
    if (first && !first.includes(keyword)) out.push({ key: 'kw-first', level: 'should', text: `첫 문단에 키워드 "${keyword}" 가 없어요 — 첫 두 줄 안에 넣어 주세요.` })
    const heads = blocks.filter((b) => b.label).length
    const photos = blocks.filter((b) => b.text.startsWith(PHOTO_PREFIX)).length
    out.push({ key: 'shape', level: 'info', text: `소제목 ${heads}개 · 사진 자리 ${photos}곳 — 사진 자리에 실제 사진을 넣고, 사진 아래에 한 줄 설명을 달면 읽기 쉬워요.` })
  }
  if (kind === 'blog' && guide) {
    out.push({ key: 'disclose', level: text.includes('제공받아') ? 'info' : 'should', text: text.includes('제공받아') ? '체험단 글에 대가 표시("제공받아 작성")를 하라는 안내가 들어 있어요.' : '체험단 글에는 대가를 받은 사실을 제목이나 첫머리에 밝히라는 안내를 넣어 주세요.' })
  }
  if (kind === 'video' || kind === 'shorts') {
    const fixed = blocks.find((b) => b.label === '썸네일 문구' || b.label === '고정 문구')?.text ?? ''
    if (fixed && fixed.length > 15) out.push({ key: 'fixed-len', level: 'should', text: `${kind === 'video' ? '썸네일' : '고정'} 문구가 ${fixed.length}자예요 — 15자 안쪽이면 휴대폰에서도 한눈에 읽혀요.` })
    if (kind === 'video') {
      const vt = blocks.find((b) => b.hint?.startsWith('제목'))?.text ?? ''
      if (keyword && vt && !vt.includes(keyword)) out.push({ key: 'kw-title', level: 'should', text: `제목에 키워드 "${keyword}" 가 없어요 — 유튜브 검색은 제목으로 무슨 영상인지 알아봐요.` })
      if (vt.length > 100) out.push({ key: 'title-len', level: 'should', text: `제목이 ${vt.length}자예요 — 100자 안으로 줄여 주세요.` })
    }
    if (kind === 'shorts') {
      const last = [...blocks].reverse().find((b) => /^\d+:\d{2} - \d+:\d{2}$/.test(b.label))
      const m = last ? /- (\d+):(\d{2})$/.exec(last.label) : null
      if (m) out.push({ key: 'dur', level: 'info', text: `전체 약 ${Number(m[1]) * 60 + Number(m[2])}초 · 세로 영상 — 첫 3초 안에 붙잡는 말이 나와요.` })
    }
  }
  if (kind !== 'keywords') out.push({ key: 'len', level: 'info', text: `${text.length.toLocaleString('ko-KR')}자(공백 포함)` })
  return out
}

/* ------------------------------------------------------------------ */
/* D-207 키워드 검색량 붙여넣기 — 네이버 검색광고 › 키워드 도구 표를 붙여 넣으면 정리                */
/* ------------------------------------------------------------------ */

export interface KeywordVolume {
  word: string
  pc: number | null
  mobile: number | null
  total: number | null
  /** '< 10' 처럼 숫자가 아닌 칸이 있었나 — 보이는 대로 두고 계산은 0 */
  small: boolean
}

/** '1,234' → 1234 · '< 10' → 0(small) · 빈칸/글자 → null */
function volumeOf(raw: string | undefined): { n: number | null; small: boolean } {
  const t = (raw ?? '').trim()
  if (!t) return { n: null, small: false }
  if (/^<\s*\d+$/.test(t)) return { n: 0, small: true }
  const d = t.replace(/,/g, '')
  return /^\d+$/.test(d) ? { n: Number(d), small: false } : { n: null, small: false }
}

/**
 * 붙여 넣은 글 → 키워드 · PC · 모바일 · 합. 줄마다 탭(엑셀 · 키워드 도구 복사) 또는 쉼표 한 줄 목록 둘 다 받는다.
 * 같은 말(영문 대소문자 · 띄어쓰기만 다름)은 합이 큰 쪽만 남긴다. 많이 찾는 순 · 최대 1,000개.
 */
export function parseKeywordVolumes(text: string): KeywordVolume[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean)
  const rows: KeywordVolume[] = []
  for (const line of lines) {
    const cols = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/).length >= 3 ? line.split(/\s{2,}/) : null
    if (cols) {
      const word = cols[0].trim()
      if (!word || /^(연관키워드|키워드|keyword)$/i.test(word)) continue
      const pc = volumeOf(cols[1])
      const mo = volumeOf(cols[2])
      const total = pc.n === null && mo.n === null ? null : (pc.n ?? 0) + (mo.n ?? 0)
      rows.push({ word, pc: pc.n, mobile: mo.n, total, small: pc.small || mo.small })
    } else {
      for (const w of line.split(/[,，]/).map((x) => x.trim()).filter(Boolean)) rows.push({ word: w, pc: null, mobile: null, total: null, small: false })
    }
  }
  const best = new Map<string, KeywordVolume>()
  for (const r of rows) {
    const key = r.word.toLowerCase().replace(/\s+/g, '')
    const cur = best.get(key)
    if (!cur || (r.total ?? -1) > (cur.total ?? -1)) best.set(key, r)
  }
  return [...best.values()].sort((a, b) => (b.total ?? -1) - (a.total ?? -1)).slice(0, 1000)
}

/* ------------------------------------------------------------------ */
/* D-207 한 달 올릴 계획 — 주 2회 / 주 4회                                                     */
/* ------------------------------------------------------------------ */

export interface PlanSlot {
  date: string
  kind: ContentKind
  topicType?: TopicType
  purpose?: KakaoPurpose
  title: string
}

const PLAN_2: { kind: ContentKind; topicType?: TopicType; purpose?: KakaoPurpose }[] = [
  { kind: 'blog', topicType: 'tips' },
  { kind: 'shorts', topicType: 'choose' },
  { kind: 'blog', topicType: 'choose' },
  { kind: 'cards', topicType: 'faq' },
  { kind: 'blog', topicType: 'faq' },
  { kind: 'shorts', topicType: 'tips' },
  { kind: 'blog', topicType: 'intro' },
  { kind: 'kakao', purpose: 'season' },
]
const PLAN_4_EXTRA: { kind: ContentKind; topicType?: TopicType; purpose?: KakaoPurpose }[] = [
  { kind: 'cards', topicType: 'tips' },
  { kind: 'blog', topicType: 'season' },
  { kind: 'shorts', topicType: 'faq' },
  { kind: 'video', topicType: 'choose' },
  { kind: 'cards', topicType: 'choose' },
  { kind: 'blog', topicType: 'tips' },
  { kind: 'shorts', topicType: 'intro' },
  { kind: 'place' },
]

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 다음 월요일부터 4주 — 주 2회는 화 · 금, 주 4회는 월 · 화 · 목 · 금 */
export function monthPlan(p: ContentProfile, today: string, perWeek: 2 | 4): PlanSlot[] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const monday = addDays(today, ((8 - dow) % 7) || 7)
  const days = perWeek === 2 ? [1, 4] : [0, 1, 3, 4]
  const seq = perWeek === 2 ? PLAN_2 : PLAN_2.flatMap((x, i) => [x, PLAN_4_EXTRA[i]])
  const kw = mainKeyword(p)
  const topics = topicsFor(p, kw, today)
  const out: PlanSlot[] = []
  let k = 0
  for (let w = 0; w < 4; w++) {
    for (const d of days) {
      const slot = seq[k % seq.length]
      k += 1
      const t = slot.topicType ? topics.find((x) => x.type === slot.topicType) : undefined
      const title = slot.kind === 'kakao' ? `카톡 · ${PURPOSE_LABEL[slot.purpose ?? 'news']}` : slot.kind === 'place' ? `${p.company} 플레이스 소개 다듬기` : (t?.title ?? `${kw} ${KIND_LABEL[slot.kind]}`)
      out.push({ date: addDays(monday, w * 7 + d), kind: slot.kind, ...(t ? { topicType: t.type } : {}), ...(slot.purpose ? { purpose: slot.purpose } : {}), title })
    }
  }
  return out
}
