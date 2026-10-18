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
  shorts: '유튜브 쇼츠 · 인스타 릴스 20~60초',
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
  /** D-229 계절 글의 달(제목 맨 앞이 키워드라 제목에서 달을 읽지 않는다) */
  month?: number
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
/**
 * D-229 규칙집 3-5 — 한 상품에 5안을 이 순서로(반박 없애기 → 문제 해결 → 전후 변화 → 궁금증 → 권위 · 사회적 증거).
 * 예전 유형(정보형 · 손해 피하기형)은 지우지 않고 뒤에 둔다.
 */
export type AdType = 'info' | 'problem' | 'objection' | 'proof' | 'loss' | 'before' | 'curious'
export const AD_TYPES: AdType[] = ['objection', 'problem', 'before', 'curious', 'proof', 'info', 'loss']
export const AD_TYPE_LABEL: Record<AdType, string> = { objection: '망설임 풀기형', problem: '고민 공감형', before: '전후 변화형', curious: '궁금증형', proof: '기록 증명형', info: '정보형', loss: '손해 피하기형' }
export const AD_TYPE_HINT: Record<AdType, string> = {
  objection: '망설이는 이유를 먼저 풀어 주기',
  problem: '손님의 고민을 먼저 말하고 해결로',
  before: '바꾸기 전과 뒤 — 실제 사례만',
  curious: '고를 때 꼭 보는 것을 궁금하게',
  proof: '업력 · 인증 같은 기록으로 믿음',
  info: '알아 둘 것을 장마다 하나씩',
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

/** 글을 다시 만들 때 쓰는 요청 — 보관함에도 같이 남는다 */
export interface DraftInput {
  keyword?: string
  topicType?: TopicType
  topicTitle?: string
  pages?: 5 | 7
  purpose?: KakaoPurpose
  variant: number
  tone: Tone
  blogType?: BlogType
  shortLen?: ShortLen
  adType?: AdType
  /** D-208 상황 예시 묶음에서 만든 글 */
  situation?: string
  /** D-208 한 달 계획에서 올릴 날(YYYY-MM-DD) */
  planDate?: string
  /**
   * D-221 그 계획의 시작 월요일 · 주 몇 회. 예전에는 올릴 날만 남겨 계획을 짐작했다 —
   * 주 4회 계획에서 화요일 글 하나만 저장하면 다시 열 때 주 2회로, 둘째 주 글부터 저장하면 한 주 밀려 보였다.
   */
  planStart?: string
  planPer?: 2 | 4
}

export interface Draft {
  kind: ContentKind
  title: string
  blocks: DraftBlock[]
  /** 화면에만 보이는 안내(복사에는 안 들어감) */
  notes: string[]
  input: DraftInput
}

/* ------------------------------------------------------------------ */
/* 작은 도구                                                             */
/* ------------------------------------------------------------------ */

export const at = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]

/** 순서를 n 만큼 돌린다 */
function rotate<T>(list: readonly T[], n: number): T[] {
  if (!list.length) return []
  const k = ((n % list.length) + list.length) % list.length
  return [...list.slice(k), ...list.slice(0, k)]
}

export const j = (word: string, pair: '은/는' | '이/가' | '을/를' | '과/와' | '으로/로' | '이에요/예요') => `${word}${particle(word, pair)}`

export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.trim())
  return (m ? m[1] : text).trim()
}

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

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

export function topicsFor(p: ContentProfile, keyword: string, today: string, variant = 0, count = 3): Topic[] {
  const lib = contentLib(p.industry)
  const kw = clean(keyword) || mainKeyword(p)
  const n = variant
  const c = count
  const season = seasonHook(lib, today)
  // D-229 규칙집 3-1 · 1-1 — 키워드를 띄어쓰기까지 그대로 제목 맨 앞에(바로 뒤에 쉼표) · 기준은 2~3개, 그 개수를 제목에
  const titles: Partial<Record<TopicType, string[]>> = {
    tips: [`${kw}, 시작 전에 놓치면 손해인 ${c}가지`, `${kw}, 처음이라면 이 ${c}가지만 보세요`, `${kw}, 준비할 때 많이 놓치는 ${c}가지`],
    choose: [`${kw}, ${lib.placeNoun} 고를 때 꼭 볼 ${c}가지`, `${kw}, 견적 받기 전에 확인할 ${c}가지`, `${kw}, 어디에 맡길지 고민될 때 볼 ${c}가지`],
    faq: [`${kw}, 자주 묻는 질문 ${c}가지에 답해 드려요`, `${kw}, 문의 전에 많이 묻는 ${c}가지`],
    intro: [`${clean(`${p.area} ${p.item}`)}, ${j(p.company, '을/를')} 소개합니다`, `${clean(`${p.area} ${p.item}`)}, ${j(p.company, '은/는')} 이런 ${j(lib.placeNoun, '이에요/예요')}`],
    ...(lib.noCase ? {} : { case: [`${kw}, [고객 유형]이 바꾼 한 가지 — 진행 사례`, `${kw}, [고객 상황]에서 시작한 이야기`] }),
    ...(season ? { season: [`${kw}, ${season.month}월 ${season.hook} 앞두고 챙길 ${c}가지`, `${kw}, ${season.month}월에 미리 볼 ${c}가지`] } : {}),
  }
  const order: TopicType[] = ['tips', 'choose', 'faq', 'intro', 'case', 'season']
  return order
    .filter((t) => titles[t])
    .map((t) => ({ type: t, title: blogTitleFit(p, clean(at(titles[t] as string[], n))), angle: ANGLE[t], keyword: kw, strategy: STRATEGY[t], ...(t === 'season' && season ? { month: season.month } : {}) }))
}

/* ------------------------------------------------------------------ */
/* D-229 콘텐츠 작성 규칙집(1~3차 관찰 합본) — 길이 맞추기 · 지역 빼기 · 다리 문장 · 의료 안내              */
/* ------------------------------------------------------------------ */

/** 기업형(발주 · 구매 담당이 독자) — 제목에 괄호 꼬리말을 붙이지 않는다(규칙집 1-8 · 3-3) */
export const B2B_INDUSTRIES: ReadonlySet<ContentProfile['industry']> = new Set(['manufacturing', 'it', 'trade', 'consultant'])
export const isB2B = (p: Pick<ContentProfile, 'industry'>) => B2B_INDUSTRIES.has(p.industry)

/** 후보 중 [min, max] 안의 첫 글 — 없으면 범위에 가장 가까운 것 */
export function fitText(cands: readonly string[], min: number, max: number): string {
  const ok = cands.find((x) => x.length >= min && x.length <= max)
  if (ok) return ok
  const dist = (x: string) => (x.length < min ? min - x.length : x.length - max)
  return [...cands].sort((a, b) => dist(a) - dist(b))[0]
}

/** 블로그 제목 25~35자 — 짧으면 소비자형은 (괄호 보충), 기업형은 줄표 꼬리 */
function blogTitleFit(p: ContentProfile, title: string): string {
  if (title.length >= 25 || placeholders(title).length) return title
  const tails = isB2B(p) ? [' — 맡기기 전 확인', ' — 견적 전에 보세요', ' — 담당자가 먼저 보는 기준'] : [' (처음이라면 필독)', ' (꼭 보세요)', ' (손해 보기 전에 보세요)']
  return fitText([title, ...tails.map((x) => `${title}${x}`)], 25, 35)
}

/** 제목의 'N가지' 를 실제 개수로 */
export const withCount = (title: string, n: number) => title.replace(/\d+가지/, `${n}가지`)

/** 지역 말 빼기 — 유튜브 제목 · 썸네일은 전국 주제로(규칙집 1-11) */
export function withoutArea(p: ContentProfile, text: string): string {
  const words = [p.region, ...p.region.split(/\s+/), p.area]
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .sort((a, b) => b.length - a.length)
  let out = text
  for (const w of words) out = out.split(w).join(' ')
  return clean(out).replace(/^[,·\s]+|[,·\s]+$/g, '')
}

/** 다리 문장 — 앞에서 말한 기준을 우리 상품에 잇는 한 문장. 사실(차별점)이 있을 때만, 없으면 빈칸(규칙집 1-9) */
export function bridgeLine(p: ContentProfile, c: number): string {
  return p.differ ? `이 ${c}가지 기준, ${j(p.company, '은/는')} 이렇게 지켜요 — ${p.differ}` : `[앞의 ${c}가지 기준을 우리가 어떻게 지키는지 한 문장 — 사실만]`
}

/** 의료 — 개인차 · 부작용 안내(규칙집 5장 규제 업종: 꼭 넣을 것) */
export const CARE_NOTE = '개인에 따라 결과가 다를 수 있고 부작용이 생길 수 있어요. 자세한 주의 사항은 상담 때 꼭 안내받으세요.'

/* ------------------------------------------------------------------ */
/* 글감(점) — 주제마다 본문에 쓰는 항목                                    */
/* ------------------------------------------------------------------ */

interface Point {
  title: string
  body: string
}

export function introSentence(p: ContentProfile): string {
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

export const DIFFER_HOLE = '[다른 곳과 다른 점 한 가지 — 업체와 확인해 적어 주세요]'

/** D-228 혜택 한 줄 — '첫 주문 반찬 1종 증정(10월 31일까지)' · 없으면 '' (기한 지난 혜택은 프로필에서 이미 뺐다) */
export function offerLine(p: ContentProfile): string {
  if (!p.offer) return ''
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(p.offerUntil)
  return m ? `${p.offer}(${Number(m[1])}월 ${Number(m[2])}일까지)` : p.offer
}

/** D-228 의료 · 건강은 혜택 · 할인을 홍보에 싣지 않는다(의료법 광고 · 예약 · 상담만) */
export const noOfferAd = (p: ContentProfile) => p.industry === 'health'
/** D-228 고객 후기 · 체험담을 홍보에 싣지 않는 업종(의료 · 전문직 광고 규정) */
export const noVoiceAd = (p: ContentProfile) => p.industry === 'health' || p.industry === 'professional'

/** D-228 '이 글을 쓴 곳' 표 — 넣어 준 사실만(지어내지 않는다). 두 줄이 안 되면 넣지 않는다 */
function authorRows(p: ContentProfile): [string, string][] {
  const rows: [string, string][] = []
  if (p.speaker) rows.push(['쓴 사람', `${p.company} ${p.speaker}`])
  rows.push(['회사', p.since ? `${p.company} · ${p.since}년부터` : p.company])
  if (p.services.length) rows.push(['하는 일', p.services.slice(0, 3).join(' · ')])
  if (p.strengths.length) rows.push(['기록', p.strengths.slice(0, 3).join(' · ')])
  if (p.reviews) rows.push(['후기', p.reviews])
  return rows
}

export function contactLines(p: ContentProfile): string {
  return [
    `전화 ${p.phone || '[대표 전화]'}`,
    p.channel ? `구매 · 예약 ${p.channel}` : '',
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
  if (p.reviews) lines.push(`후기 — ${p.reviews}`)
  if (p.voice && !noVoiceAd(p)) lines.push(`고객 한마디 — "${p.voice}"`)
  lines.push(p.differ ? `다른 곳과 다른 점 — ${p.differ}` : DIFFER_HOLE)
  return { label: `${j(p.company, '을/를')} 소개해요`, text: lines.join('\n') }
}

function ctaBlock(p: ContentProfile, kw: string, hint?: string): DraftBlock {
  const lib = contentLib(p.industry)
  // D-228 실제 혜택 · 가격 조건이 있을 때만(지어내지 않음 · 의료는 혜택을 싣지 않음)
  const extra = [!noOfferAd(p) && offerLine(p) ? `이번 달 혜택 — ${offerLine(p)}` : '', p.price ? `가격 · 조건 — ${p.price}` : ''].filter(Boolean).join('\n')
  return { label: lib.ctaTitle, text: `${kw ? `${j(kw, '을/를')} 알아보고 계신다면 편하게 연락 주세요. ` : ''}${lib.ctaBody}${extra ? `\n\n${extra}` : ''}\n\n${contactLines(p)}`, ...(hint ? { hint } : {}) }
}

/**
 * 사진 자리 — [대괄호] 가 아니라 (사진 자리: …) 로 적는다. 채울 글이 아니라 사진을 넣을 곳이라 점검의 '꼭' 에 세지 않는다.
 */
const PHOTO_PREFIX = '(사진 자리:'
export const photo = (what: string): DraftBlock => ({ label: '', text: `${PHOTO_PREFIX} ${what})`, hint: '사진 자리' })

export function visualsOf(lib: ContentLib): string[] {
  return lib.visual
    .split(' · ')
    .map((v) => v.trim())
    .filter(Boolean)
}

function objectionBlock(p: ContentProfile): DraftBlock {
  return { label: '이런 걱정이 있으셨죠?', text: `${p.objection}\n[이 걱정을 어떻게 덜어 드리는지 한두 문장 — 업체와 확인해 적어 주세요]` }
}

/**
 * D-229 규칙집 3-1 블로그 브랜드형 — 도입(속마음 → 인사 · 경력 → 진짜 고민 · 흔한 반박 → 약속) · 사진 · 작성자 소개 표 →
 * 소제목① 기준 1 · ② 기준 2 · ③ 정리 → 구분선 → 부드러운 정리 · 다리 문장 · 가벼운 첫 행동 → 관련 글 · 연락처 · 지도.
 * 표는 하나(작성자 소개 표가 없을 때만 비교 표). 소개 · 사례 글은 예전 틀을 그대로 쓴다.
 */
function blogRulebook(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const kw = topic.keyword
  const points = pointsFor(p, topic, variant).slice(0, 2)
  const c = points.length
  const visuals = visualsOf(lib)
  const s = seasonHook(lib, todayOfTopic(topic))
  const quote = p.objection ? `"${p.objection}"\n${lib.field}에서 자주 듣는 말이에요.\n` : ''
  const hello = p.speaker ? `안녕하세요, ${p.company} ${j(p.speaker, '이에요/예요')}.` : `안녕하세요, ${j(p.company, '이에요/예요')}.`
  const career = p.since && p.years !== null && p.years >= 1 ? ` ${p.since}년부터 ${p.years}년째 이 일을 하고 있어요.` : ''
  const worry: Record<TopicType, string> = {
    tips: `${j(kw, '을/를')} 알아볼 때 가장 막막한 건 무엇부터 봐야 하는지예요.`,
    choose: `${j(kw, '을/를')} 맡길 곳은 겉으로 비슷해 보여서 더 고민이 돼요.`,
    faq: `${kw}에 대해 문의 전에 가장 많이 받는 질문이 있어요.`,
    intro: '',
    case: '',
    season: s ? `${s.month}월은 ${j(s.hook, '이에요/예요')}. 이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요.` : `이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요.`,
  }
  const rebut = p.rebuttal ? ` 흔히 "${p.rebuttal}" 라고들 하지만, 꼭 그렇지만은 않아요.` : ''
  const promise = topic.type === 'faq' ? ` 그중 ${c}가지에 먼저 답해 드릴게요.` : ` 이 ${c}가지만 보면 돼요.`
  const blocks: DraftBlock[] = [
    { label: '', text: topic.title, hint: '제목' },
    { label: '', text: `${quote}${hello}${career}\n${worry[topic.type]}${rebut}${promise}`, hint: '첫 문단(도입부)' },
    photo(p.speaker ? '말하는 사람 또는 매장 · 작업 공간' : '대표 또는 매장 · 작업 공간'),
  ]
  const author = authorRows(p)
  if (author.length >= 3) blocks.push({ label: '이 글을 쓴 곳', text: ['항목 | 내용', ...author.map(([k, v]) => `${k} | ${v}`)].join('\n'), hint: '작성자 소개 표 — 넣어 준 사실만' })
  // 기준마다 '실제 현장 이야기' 자리 — 규칙집 본문 2,100~3,000자는 사실(재료)로 채운다(지어내 늘리지 않는다)
  points.forEach((pt, i) => {
    blocks.push({ label: topic.type === 'faq' ? `Q. ${pt.title}` : `${i + 1}. ${pt.title}`, text: `${topic.type === 'faq' ? `A. ${pt.body}` : pt.body}\n[우리 현장에서 실제로 있었던 일 한두 문장 — 없으면 이 줄을 지워 주세요]`, hint: '소제목 — 기준 · 경고' })
    blocks.push(photo(at(visuals, i + 1)))
  })
  // 소제목③ 정리 — 표는 글 전체에 하나(작성자 소개 표가 없을 때만 비교 표)
  const table = topic.type === 'choose' && author.length < 3 ? ['확인할 것 | 이유', ...points.map((pt) => `${pt.title} | ${firstSentence(pt.body)}`)] : points.map((pt, i) => `${i + 1}. ${pt.title.replace(/[.!]$/, '')}`)
  // 정리 안에 업종 견본의 진행 순서 · 자주 묻는 질문 하나(소제목을 늘리지 않고 문단으로)
  const faq1 = topic.type === 'faq' ? null : lib.faq[0]
  const summary = [
    ...table,
    `\n진행은 이렇게 해요 — ${lib.process.map((st) => st.name).join(' → ')}`,
    faq1 ? `\n자주 받는 질문 — ${faq1.q}\n${faq1.a}` : '',
    p.objection && (topic.type === 'choose' || topic.type === 'faq') ? `\n${p.objection} — [이 걱정을 어떻게 덜어 드리는지 한 문장 — 업체와 확인해 적어 주세요]` : '',
    p.voice && !noVoiceAd(p) ? `\n실제로 이런 말을 들어요 — "${p.voice}"` : '',
  ].filter(Boolean)
  blocks.push({ label: `정리 — 이 ${c}가지만 기억하세요`, text: summary.join('\n'), hint: '소제목 — 정리' })
  blocks.push({ label: '', text: '(구분선)', hint: '구분선' })
  const soft = topic.type === 'faq' ? '더 궁금한 점은 편하게 물어봐 주세요.' : `${kw}, 처음엔 막막해도 이 ${c}가지만 챙기면 훨씬 수월해요.`
  blocks.push({ label: '', text: `${soft} ${bridgeLine(p, c)}\n${lib.softAsk}${p.industry === 'health' ? `\n${CARE_NOTE}` : ''}`, hint: '끝 — 부드러운 정리 · 다리 문장 · 가벼운 첫 행동(직접 명령은 쓰지 않아요)' })
  blocks.push(photo(at(visuals, 3)))
  const cta = ctaBlock(p, '', '연락처 · 지도 — 실제 값만')
  blocks.push({ ...cta, text: `관련 글 [함께 보면 좋은 글 링크 — 없으면 이 줄을 지워 주세요]\n${cta.text}` })
  blocks.push({ label: '', text: hashtags(p).join(' '), hint: '해시태그' })
  return blocks
}

function blogDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  // 소개 · 사례 글만 예전 틀(includes 로 물어 타입이 좁혀지지 않게 — 아래 예전 코드가 모든 주제를 다룬다)
  if (!(['intro', 'case'] as TopicType[]).includes(topic.type)) return blogRulebook(p, topic, variant)
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
    case: [`${kw}, [고객 상황]으로 고민하던 분과 함께한 이야기를 나눠요. 고객 동의를 받은 내용만 적었어요.`],
    season: (() => {
      const s = seasonHook(lib, todayOfTopic(topic))
      return s ? [`${s.month}월은 ${j(s.hook, '이에요/예요')}. 이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요. 미리 챙기면 좋은 것을 정리했어요.`] : [`이맘때 ${j(kw, '을/를')} 알아보는 분들이 많아요. 미리 챙기면 좋은 것을 정리했어요.`]
    })(),
  }
  // 도입부 → 사진 → 소제목 구간(가운데 사진) → 한눈에 정리 → 걱정 풀기 → 소개 → 사진 → 문의 → 해시태그
  // D-228 고객 속마음 한 줄로 시작(업체가 적은 '망설이는 점'만 · 지어내지 않음) → 도입부 → 사진 → 이 글을 쓴 곳(사실만)
  const quote = p.objection && (topic.type === 'tips' || topic.type === 'choose') ? `"${p.objection}"\n${lib.field}에서 자주 듣는 말이에요. ` : ''
  const blocks: DraftBlock[] = [{ label: '', text: topic.title, hint: '제목' }, { label: '', text: `${quote}${at(opener[topic.type], variant)}`, hint: '첫 문단(도입부)' }, photo(at(visuals, 0))]
  const author = authorRows(p)
  if (topic.type !== 'intro' && author.length >= 3) blocks.push({ label: '이 글을 쓴 곳', text: ['항목 | 내용', ...author.map(([k, v]) => `${k} | ${v}`)].join('\n'), hint: '표로 넣으면 좋아요 — 넣어 준 사실만' })
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
  if (p.industry === 'health') blocks.push({ label: '', text: CARE_NOTE, hint: '의료 안내 — 개인차 · 부작용' })
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
      // D-229 규칙집 3-2 — [키워드], [1인칭 의심 · 고민] [결과 한마디]
      text: [`${kw}, 반신반의했는데 [결과 한마디]`, `${kw}, 처음엔 망설였지만 [결과 한마디]`, `${kw}, 고민하다 ${p.company} 직접 써 본 이야기`].map((t) => `• ${t}`).join('\n'),
    },
    {
      label: '꼭 담아 주세요',
      text: [
        `• 하는 일: ${p.services.length ? p.services.join(' · ') : p.item}`,
        `• 업체가 강조하는 점: ${p.differ || '[업체가 강조하고 싶은 점 한 가지]'}`,
        `• 진행 순서: ${lib.process.map((s) => s.name).join(' → ')}`,
        `• 이용 정보: 위치 · 운영 시간(${p.hours || '[운영 시간]'}) · 연락처(${p.phone || '[대표 전화]'})${p.channel ? ` · 구매 · 예약(${p.channel})` : ''}`,
      ].join('\n'),
    },
    { label: `찍어 주세요(사진 ${shots.length}장 이상)`, text: shots.map((v) => `• ${v}`).join('\n') },
    {
      label: '글 순서',
      text: [
        `맨 위: 광고 표시 문구 — "${p.company}에서 [제품 · 원고료]를 제공받아 직접 써 본 뒤 쓴 후기입니다"`,
        '1. 도입 — 처음엔 의심 · 고민했던 이유(같은 처지인 분이 공감하게)',
        '2. 소제목① 써 보기 전 — 실패하거나 손해 봤던 경험',
        '3. 소제목② 써 보고 알게 된 것 → 결과(실제로 겪은 숫자만)',
        '4. 끝 — 같은 처지인 분께 권하기 · 위치 · 시간 · 연락처(실제 값)',
        '분량 1,800자 안팎 · 해요체 · 짧은 문단 · 소제목 2개 · 작성자 소개 표는 넣지 않아요.',
      ].join('\n'),
    },
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
  const mm = topic.month ?? Number(/(\d{1,2})월/.exec(topic.title)?.[1] ?? 0)
  return mm >= 1 && mm <= 12 ? `2000-${String(mm).padStart(2, '0')}-01` : '2000-01-01'
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

/** D-229 규칙집 3-4 — 쇼츠 상단 문구 14~22자 */
function shortsFixed(p: ContentProfile, topic: Topic, c: number): string {
  const lib = contentLib(p.industry)
  const short = p.item.length <= 8 ? p.item : ''
  const s = seasonHook(lib, todayOfTopic(topic))
  const cands: Record<TopicType, string[]> = {
    tips: [`${short ? `${short} ` : ''}꼭 알아야 할 ${c}가지`, `시작 전에 꼭 알아야 할 ${c}가지`, `모르면 손해 보는 ${c}가지`],
    choose: [`맡기기 전 꼭 확인할 ${c}가지`, `${lib.placeNoun} 고르기 전 꼭 볼 ${c}가지`],
    faq: [`가장 많이 묻는 질문 ${c}가지`, `${short ? `${short} ` : ''}자주 묻는 질문 ${c}가지`],
    intro: [`${j(p.company, '은/는')} 이렇게 일해요`, `${j(p.company, '이/가')} 일하는 순서 한눈에`, `${p.company}${p.area ? ` · ${p.area}` : ''} 소개`],
    case: ['[결과 한 줄 — 실제 사례만]'],
    season: [`${s ? `${s.month}월에 ` : '지금 '}꼭 챙길 ${c}가지`, `${s ? `${s.month}월, ` : ''}미리 챙길 것 ${c}가지`],
  }
  return fitText(cands[topic.type], 14, 22)
}

/** 쇼츠 · 릴스 — 고정 문구 · 첫 3초 · 도입/중반/후반 · 초 구간 대본(나레이션 · 자막 · 장면) · 캡션 */
function shortsDraft(p: ContentProfile, topic: Topic, variant: number, len: ShortLen): DraftBlock[] {
  const lib = contentLib(p.industry)
  const n = len === '20-30' ? 2 : 3
  const points = pointsFor(p, topic, variant).slice(0, n)
  const fixed = shortsFixed(p, topic, points.length)
  const visuals = visualsOf(lib)
  const hook = hookFor(p, topic, variant, points.length)
  const cta = lib.ctaShort.replace('{company}', p.company)
  // 구간(초) — 20~30초: 3 · 5 · 7 · 7 · 5 = 27초 / 30~60초: 3 · 5 · 10 · 10 · 10 · 7 = 45초
  const spans = len === '20-30' ? [3, 5, 7, 7, 5] : [3, 5, 10, 10, 10, 7]
  const ts = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  // D-228 30~60초는 '셋째가 제일 중요한데요'(끝까지 보게 하는 고리) → '그럼 뭘 보냐고요?'(질문으로 넘기기) → 세 가지 다시 + 저장
  const say = (pt: Point) => `${/[.?!]$/.test(pt.title) ? pt.title : `${pt.title}.`} ${firstSentence(pt.body)}`
  const ord = ['첫째', '둘째', '셋째']
  const rows: { nar: string; sub: string; scene: string }[] = [
    { nar: hook, sub: fixed, scene: `${at(visuals, 0)} — 첫 장면은 움직임이 있게` },
    { nar: n === 3 ? `많은 분이 여기서 놓쳐요. ${painFor(topic)}` : painFor(topic), sub: painFor(topic), scene: at(visuals, 1) },
    ...points.map((pt, i) => ({
      nar: n === 3 ? (i === 2 ? `셋째가 제일 중요한데요. ${say(pt)}` : `${ord[i]}, ${say(pt)}`) : say(pt),
      sub: `${i + 1}. ${pt.title}`,
      scene: at(visuals, i + 2),
    })),
    // D-229 규칙집 3-4 — 끝은 요약(정보형)이 기본, 업체 말은 한 줄만
    {
      // 요약은 '…, 이 N가지만 기억하세요.' 로 끝낸다(질문형 항목 '…있나요' 로 문장이 끝나면 격식 말투로 바뀌지 않는다)
      nar: n === 3 ? `그럼 뭘 확인하면 되냐고요? ${points.map((pt) => pt.title.replace(/[.!]$/, '')).join(' · ')}, 이 ${points.length}가지만 기억하세요. 저장해 두고 필요할 때 다시 보세요. ${cta}` : `정리하면 ${points.map((pt) => pt.title.replace(/[.!]$/, '')).join(' · ')}, 이 ${points.length}가지예요. 저장해 두고 다시 보세요. ${cta}`,
      sub: points.map((pt, i) => `${i + 1}. ${pt.title.replace(/[.!]$/, '')}`).join(' / '),
      scene: `${points.length}가지 체크 목록 화면(업체 이름 · 연락처는 한 줄만)`,
    },
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
    // 릴스 캡션 — 해시태그 5개(지역 + 업종 + 고민) · 의료는 개인차 안내
    { label: '캡션', text: `${topic.title}\n${points.map((pt, i) => `${i + 1}. ${pt.title}`).join('\n')}\n\n${cta}${p.industry === 'health' ? `\n${CARE_NOTE}` : ''}\n${hashtags(p, 5).join(' ')}` },
  ]
}

/**
 * D-228 영상 5편 순서 — 이상한AI 3차 관찰의 '자리 퍼널'(심화 → 부정 선언 → 넓히기 → 구매 직전 고객 → 구매 직전 우리 업체)을
 * 우리 업종 견본 · 업체 기록으로 새로 짰다. 숫자는 업체 기록(설립 연수)만 쓴다.
 */
export function videoSeries(p: ContentProfile, topic: Topic): { title: string; role: string }[] {
  const lib = contentLib(p.industry)
  // D-229 유튜브 제목에는 지역을 넣지 않는다
  const kw = withoutArea(p, topic.keyword) || p.item
  const check = lib.checks[0]?.title.replace(/[.?!]$/, '') ?? '기본'
  const ask = lib.ctaTitle.split(' · ')[0]
  return [
    { title: `${kw}, 고를 때 꼭 확인할 3가지${p.years !== null && p.years >= 3 ? `(${p.years}년 차 ${p.company})` : ''}`, role: '깊게 — 이 주제를 제대로 알려 믿음을 쌓아요' },
    { title: `${check}, 안 보고 고르면 생기는 일`, role: '손해 피하기 — "이것만 믿으면 안 돼요" 로 놓치면 손해인 점을 짚어요' },
    { title: `${kw} 맡긴 뒤에 꼭 챙길 것`, role: '넓히기 — 고르는 법에서 쓰는 법 · 관리하는 법으로 보는 사람을 넓혀요' },
    { title: `${ask} 전에 꼭 물어볼 3가지`, role: '결정 직전 — 마음을 정하기 직전인 분께 질문 목록을 줘요' },
    { title: `${p.company}만의 진행 방식 공개 — ${lib.process.map((x) => x.name).slice(0, 3).join(' → ')}`, role: '우리 업체 — 마지막에 우리가 어떻게 하는지 보여 줘요' },
  ]
}

/**
 * D-229 규칙집 3-3 — 유튜브 제목: 소비자형은 '본제목 (괄호 꼬리말)' 40~55자, 기업형은 괄호 없이 25~35자. 지역은 넣지 않는다.
 */
export function videoTitle(p: ContentProfile, topic: Topic, c: number): string {
  const lib = contentLib(p.industry)
  const item = withoutArea(p, topic.keyword) || p.item
  const s = seasonHook(lib, todayOfTopic(topic))
  const core: Record<TopicType, string> = {
    tips: `${item} 시작 전에 꼭 알아야 할 ${c}가지`,
    choose: `${item} ${lib.placeNoun} 고를 때 꼭 볼 ${c}가지`,
    faq: `${item} 자주 묻는 질문 ${c}가지`,
    intro: `${item}, ${j(p.company, '은/는')} 이렇게 일해요`,
    case: `[고객 유형]이 ${j(item, '으로/로')} 바꾼 한 가지`,
    season: s ? `${s.month}월 ${s.hook}, ${item} 미리 챙길 ${c}가지` : `${item} 미리 챙길 ${c}가지`,
  }
  // 계절 이야기가 길면 짧은 모양도 후보로
  const bases = [core[topic.type], ...(topic.type === 'season' && s ? [`${item}, ${s.month}월에 미리 챙길 ${c}가지`] : [])]
  if (isB2B(p)) return fitText(bases.flatMap((b) => [b, `${b} 총정리`, `${b} — ${lib.field}에서 본 기준`]), 25, 35)
  const tails = ['모르면 다시 알아보게 되는 이유', '현장에서 자주 보는 실수까지 정리', '처음 알아보는 분이라면 꼭 보세요', '맡기기 전에 꼭 보세요', '모르면 다시 알아보게 되는 이유까지 한 번에', '현장에서 자주 보는 실수까지 한 번에 정리']
  return fitText(bases.flatMap((b) => tails.map((x) => `${b} (${x})`)), 40, 55)
}

/** D-229 규칙집 3-3 — 썸네일 문구 20~35자 · 숫자를 꼭 · [숫자] + [손해 · 결과 · 비밀] (+ (보충)) */
export function videoThumb(p: ContentProfile, topic: Topic, c: number): string {
  const lib = contentLib(p.industry)
  const item = withoutArea(p, topic.keyword) || p.item
  const s = seasonHook(lib, todayOfTopic(topic))
  const base: Record<TopicType, string> = {
    tips: `모르면 손해 보는 ${c}가지`,
    choose: `맡기기 전 꼭 볼 ${c}가지`,
    faq: `가장 많이 묻는 질문 ${c}가지`,
    intro: p.years !== null && p.years >= 1 ? `${p.years}년 차 ${p.company}의 진행 방식` : `${lib.process.length}단계로 보는 ${p.company}`,
    case: '[N개월] 만에 바뀐 [한 가지]',
    season: `${s ? `${s.month}월에 ` : '지금 '}꼭 챙길 ${c}가지`,
  }
  const b = base[topic.type]
  const cands = isB2B(p) ? [b, `${item} ${b}`, `${item} 시작 전, ${b}`, `${b} — ${lib.field}에서 본 기준`] : [b, `${b} (맡기기 전 필수)`, `${b} (처음이라면 필독)`, `${b} (이것부터 확인)`]
  return fitText(cands, 20, 35)
}

/** 롱폼 — 기획 카드(썸네일 문구 · 제목 · 도입부 · 주제 · 타겟 · 전략) → 대본(체크포인트 3 + 마무리) */
function videoDraft(p: ContentProfile, topic: Topic, variant: number): DraftBlock[] {
  const lib = contentLib(p.industry)
  const points = pointsFor(p, topic, variant).slice(0, 3)
  const c = points.length
  const title = videoTitle(p, topic, c)
  const thumb = videoThumb(p, topic, c)
  const visuals = visualsOf(lib)
  const item = withoutArea(p, topic.keyword) || p.item
  const hello = clean(`안녕하세요, ${p.area} ${p.item} ${lib.placeNoun} ${j(p.company, '이에요/예요')}.`)
  // 도입 3~5문장: 질문 → 흔한 실패 장면 → 화자 근거 → "오늘 N가지" 약속
  const q: Record<TopicType, string> = {
    tips: `${item}, 무엇부터 봐야 할지 막막하셨죠?`,
    choose: `${item}, 어디에 맡겨야 할지 고민되시죠?`,
    faq: `${item}, 문의하기 전에 궁금한 게 많으시죠?`,
    intro: `${item}, 어떤 곳에 맡겨야 할지 고민되시죠?`,
    case: '[고객 상황], 비슷한 고민 있으시죠?',
    season: `${item}, 이맘때 미리 챙기셨나요?`,
  }
  const fail: Record<TopicType, string> = {
    tips: '알아보다 지쳐서 아무 데나 골랐다가 다시 알아보는 분이 많아요.',
    choose: '겉으로 비슷해 보여서 골랐다가 다시 알아보는 분이 많아요.',
    faq: '무엇을 물어야 할지 몰라 두세 번 다시 연락하는 분이 많아요.',
    intro: '겉만 보고 골랐다가 다시 찾는 분이 많아요.',
    case: '[처음 고민 — 한 문장]',
    season: '미루다가 가장 바쁜 때를 맞아 서두르는 분이 많아요.',
  }
  const who = p.years !== null && p.years >= 1 ? `${p.years}년 동안 ${lib.field}에서 본 것을 바탕으로` : `${lib.field}에서 자주 받는 질문을 바탕으로`
  const intro0 = `${q[topic.type]} ${fail[topic.type]} ${j(p.company, '이/가')} ${who} 오늘 꼭 볼 ${c}가지를 알려 드릴게요.`
  // 도입부 100~160자 — 짧으면 한 문장 더(3~5문장 안)
  const intro = intro0.length < 100 ? `${intro0} 끝까지 보시면 한 번에 정리돼요.` : intro0
  const blocks: DraftBlock[] = [
    { label: '', text: title, hint: isB2B(p) ? '제목 — 기업형: 괄호 없이 짧고 단정하게(25~35자) · 지역은 빼요' : '제목 — 본제목 (괄호 꼬리말) 40~55자 · 지역은 빼요' },
    { label: '썸네일 문구', text: thumb, hint: '20~35자 · 숫자를 꼭 넣어요' },
    { label: '도입부 · 처음 15초', text: `말: ${intro}\n화면: ${at(visuals, 0)} · 큰 자막 "${thumb}"`, hint: '질문 → 흔한 실패 → 근거 → "오늘 N가지" 약속(3~5문장)' },
    { label: '주제', text: `${TOPIC_LABEL[topic.type]} — ${topic.angle}` },
    { label: '타겟 청중', text: p.target },
    { label: '전략', text: topic.strategy },
    { label: '0:15 · 인사', text: `말: ${hello}\n화면: 대표 · 매장 · 간판 중 하나` },
  ]
  // 반전 문장 — 넘어갈 때마다 하나, 가운데에 '여기까지는 기본'(이탈을 막는다)
  const turns = ['그런데 이것보다 더 자주 놓치는 게 있어요.', `여기까지는 기본이에요. 진짜 차이는 ${c >= 3 ? '세 번째' : '다음'} 이야기에서 생겨요.`]
  points.forEach((pt, i) => {
    const lead = i === c - 1 && c >= 3 ? '세 번째는 가장 많이 놓치는 부분이에요. ' : ''
    const turn = i < c - 1 ? `\n말(넘어가며): ${turns[i] ?? turns[0]}` : ''
    blocks.push({ label: `${i + 1}:00 · ${i + 1}. ${pt.title}`, text: `말: ${lead}${pt.body}${turn}\n화면: 자막 "${pt.title}" · 자료 화면: [실제 예시 사진이나 장면]`, hint: '소제목 — 체크포인트' })
  })
  const endMin = c + 1
  const summary = points.map((pt) => pt.title.replace(/[.!]$/, '')).join(' · ')
  blocks.push({
    label: `${endMin}:00 · 마무리`,
    text: `말: 오늘 말한 ${summary}, 이 ${c}가지를 다시 짚어 봐요. 결국 처음에 꼼꼼히 확인하는 게 시간과 비용을 아끼는 길이에요. ${bridgeLine(p, c)}${p.industry === 'health' ? ` ${CARE_NOTE}` : ''} ${lib.ctaShort.replace('{company}', p.company)}\n화면: ${p.company} · ${p.phone || '[연락처]'}${p.homepage ? ` · ${p.homepage}` : ''}`,
    hint: `소제목 — ${p.speaker ? `${p.speaker}의 ` : ''}마지막 조언 · 요약 → 다리 문장 → CTA 하나. 구독 · 댓글 · 다음 영상 예고는 채널 방침에 따라 붙이거나 빼요`,
  })
  blocks.push({ label: '설명란', text: `${title}\n\n${contactLines(p)}\n\n${hashtags(p, 8).join(' ')}` })
  blocks.push({ label: '이 주제로 이어 찍을 5편', text: videoSeries(p, topic).map((x, i) => `${i + 1}편 · ${x.title}\n(${x.role})`).join('\n'), hint: '1편 깊게 → 2편 손해 피하기 → 3편 넓히기 → 4편 결정 직전 → 5편 우리 업체 — 5편 자리는 꼭 이 업체로(다른 업체가 들어가지 않게)' })
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
    cover = page(1, '표지', `${worry}, 걱정되시죠?`, `${j(p.company, '이/가')} 먼저 답해 드려요`, `${at(visuals, 0)} · 질문 말풍선`)
    inner = [
      page(2, '공감', '많은 분이 같은 걱정을 하세요', `${kw} 알아볼 때 가장 많이 묻는 것`, '고개를 갸웃하는 사람 · 물음표'),
      page(3, '이렇게 챙겨요', '[이 걱정을 어떻게 덜어 드리는지 한 문장]', p.differ || '[다른 곳과 다른 점 한 가지]', at(visuals, 1)),
      ...(p.voice && !noVoiceAd(p) ? [page(4, '고객 한마디', `"${p.voice}"`, '실제 고객이 해 주신 말이에요', '따옴표 · 말풍선')] : []),
      ...(p.strengths.length ? [page(4, '기록', p.strengths[0], p.strengths.slice(1, 3).join(' · ') || `${p.company}의 기록`, '인증서 · 숫자 강조')] : [page(4, '순서', '진행은 이렇게', lib.process.map((s) => s.name).join(' → '), '진행 장면')]),
      page(5, '자주 묻는 질문', lib.faq[0]?.q ?? '자주 묻는 질문', lib.faq[0]?.a ?? '', at(visuals, 2)),
      page(6, '순서', '진행은 이렇게', lib.process.map((s) => s.name).join(' → '), '진행 장면'),
    ].slice(0, body)
  } else if (adType === 'proof') {
    const facts = p.strengths.length ? p.strengths : ['[업력 · 진행 건수 같은 숫자]', '[인증 · 자격]', '[고객 수 · 재방문 같은 기록]']
    // D-228 첫 장 — 재료(후기 수 · 연수)가 있으면 그 숫자로, 없으면 지어내지 않고 '기록으로 보는'
    cover = p.reviews
      ? page(1, '표지', p.reviews, `${p.company} · ${clean(`${p.area} ${p.item}`)}`, `${at(visuals, 0)} · 큰 숫자`)
      : p.years !== null && p.years >= 3
        ? page(1, '표지', clean(`${p.area} ${p.years}년, ${p.item}`), `기록으로 보는 ${p.company}`, `${at(visuals, 0)} · 큰 숫자`)
        : page(1, '표지', `기록으로 보는 ${p.company}`, `${clean(`${p.area} ${p.item}`)}`, `${at(visuals, 0)} · 큰 숫자`)
    // 기록이 모자라면 진행 순서 · 자주 묻는 질문으로 장 수를 채운다(지어내지 않는다)
    const rows: [string, string, string, string][] = [
      ...(p.voice && !noVoiceAd(p) ? [['고객 한마디', `"${p.voice}"`, '실제 고객이 해 주신 말이에요', '따옴표 · 말풍선'] as [string, string, string, string]] : []),
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
  } else if (adType === 'before') {
    if (noOfferAd(p)) {
      // 의료 — 전후 비교를 쓰지 않는다(규칙집 5-2): 과정만 보여 주는 안
      cover = page(1, '표지', `${kw}, 이렇게 진행돼요`, `${p.company} · 과정만 보여 드려요`, `${at(visuals, 0)} · 진행 순서 화면`)
      inner = [
        ...lib.process.map((st, i) => page(i + 2, '과정', `${i + 1}. ${st.name}`, st.desc, at(visuals, i + 1))),
        page(0, '자주 묻는 질문', lib.faq[0]?.q ?? '자주 묻는 질문', lib.faq[0]?.a ?? '', at(visuals, 2)),
        page(0, '다른 점', p.differ || '[다른 곳과 다른 점 한 가지]', p.strengths.slice(0, 2).join(' · ') || '[믿을 만한 기록 한 줄]', at(visuals, 3)),
        page(0, '자주 묻는 질문', lib.faq[1]?.q ?? '더 궁금한 점', lib.faq[1]?.a ?? '', at(visuals, 1)),
      ].slice(0, body)
    } else {
      cover = page(1, '표지', '[전]: [바꾸기 전 모습] → [후]: [바뀐 뒤 모습]', `${kw} · ${p.company} 실제 사례`, '같은 자리 · 같은 각도로 찍은 전후 사진 두 장')
      inner = [
        page(2, '전', '[바꾸기 전 — 어떤 불편이 있었나]', '[고객 상황 — 이름은 빼고]', '바꾸기 전 사진'),
        page(3, '무엇을 했나', `${j(p.company, '이/가')} 이렇게 진행했어요`, lib.process.map((st) => st.name).join(' → '), '진행 장면'),
        page(4, '후', '[바뀐 뒤 — 숫자나 고객의 말로]', '고객 동의를 받은 사례만 실어요', '바뀐 뒤 사진'),
        page(5, '다른 점', p.differ || '[다른 곳과 다른 점 한 가지]', p.strengths.slice(0, 2).join(' · ') || '[믿을 만한 기록 한 줄]', at(visuals, 2)),
        page(6, '자주 묻는 질문', lib.faq[0]?.q ?? '자주 묻는 질문', lib.faq[0]?.a ?? '', at(visuals, 3)),
      ].slice(0, body)
    }
  } else if (adType === 'curious') {
    const checks = rotate(lib.checks, variant).slice(0, body - 1)
    cover = page(1, '표지', `${p.item} 고를 때 이것은 꼭 보래요`, `${kw} — ${checks.length}가지`, `${at(visuals, 0)} · 물음표`)
    inner = [...checks.map((ck, i) => page(i + 2, '이유', `${i + 1}. ${ck.title}`, ck.why, at(visuals, i + 1))), page(checks.length + 2, '우리는', `${j(p.company, '은/는')} 이렇게 챙겨요`, p.differ || lib.process.map((st) => st.name).join(' → '), '진행 장면')].slice(0, body)
  } else {
    const points = pointsFor(p, topic, variant).slice(0, body)
    const thumb = thumbFor(p, topic, points.length)
    cover = page(1, '표지', thumb, `${p.company}${p.area ? ` · ${p.area}` : ''}`, `${visuals[0] ?? ''} 위에 큰 글자`)
    inner = points.map((pt, i) => page(i + 2, '', `${i + 1}. ${pt.title}`, firstSentence(pt.body), `${at(visuals, i + 1)} 또는 아이콘 하나`))
  }
  // D-228 마지막 장 — 실제 혜택(기한 포함)이 있으면 '바로 행동 + 혜택 + 기한', 없으면 문의만(지어낸 선착순 · 할인 없음 · 의료는 혜택 빼고)
  inner = inner.map((b, i) => ({ ...b, label: b.label.replace(/^\d+장/, `${i + 2}장`) }))
  const offer = noOfferAd(p) ? '' : offerLine(p)
  const reach = `${p.phone || '[연락처]'}${p.channel ? ` · ${p.channel}` : p.region ? ` · ${p.region}` : ''}`
  const care = p.industry === 'health' ? `\n${CARE_NOTE}` : ''
  const last = offer ? page(inner.length + 2, '마무리 · 혜택', lib.ctaTitle, `${offer}\n연락: ${reach}`, '로고 · 혜택 · 연락처 화면') : page(inner.length + 2, '마무리', lib.ctaTitle, `${reach}${care}`, '로고 · 연락처 · 지도 화면')
  const caption = `${topic.title}\n\n${inner.map((b) => /큰 글자: (.*)/.exec(b.text)?.[1] ?? '').filter(Boolean).map((t) => `• ${t}`).join('\n')}\n\n${lib.ctaShort.replace('{company}', p.company)}${care}\n\n${hashtags(p).join(' ')}`
  return [{ ...cover, hint: AD_TYPE_LABEL[adType] }, ...inner, last, { label: '올릴 때 쓰는 글', text: caption }]
}

export const AD_NOTE = '여러 사람에게 보내는 소식은 광고로 봐요 — 맨 앞에 (광고)를 넣었어요. 받는 분이 거부할 방법(채널 차단)을 알리고, 따로 동의받지 않았다면 밤 9시 ~ 아침 8시에는 보내지 마세요.'

function kakaoDraft(p: ContentProfile, purpose: KakaoPurpose, today: string, variant: number): { blocks: DraftBlock[]; notes: string[] } {
  const lib = contentLib(p.industry)
  const m = monthOf(today)
  const phone = `문의 ${p.phone || '[대표 전화]'}`
  const hello = `안녕하세요, ${j(p.company, '이에요/예요')}.`
  let text = ''
  if (purpose === 'news') {
    text = `(광고) ${p.company}\n\n${hello}\n[전하고 싶은 소식 — 새 서비스 · 새 메뉴 · 바뀐 운영 시간]\n\n${p.services.length ? `하는 일: ${p.services.join(' · ')}\n` : ''}${phone}`
  } else if (purpose === 'event') {
    // D-228 홍보 정보에 실제 혜택 · 기한이 있으면 그대로(의료는 혜택 광고를 하지 않으므로 빈칸 그대로)
    const real = noOfferAd(p) ? '' : p.offer
    const until = /^\d{4}-(\d{2})-(\d{2})$/.exec(real ? p.offerUntil : '')
    text = `(광고) ${p.company} ${m}월 혜택 안내\n\n${real || '[혜택 내용 — 예: 첫 상담 고객 ○○]'}\n기간: [시작일] ~ ${until ? `${Number(until[1])}월 ${Number(until[2])}일` : '[끝나는 날]'}\n대상: [대상]\n${p.price ? `가격 · 조건: ${p.price}\n` : ''}\n${lib.ctaBody}\n${phone}`
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
    { label: '이런 점을 챙겨요', text: [...(p.differ ? [`• ${p.differ}`] : []), ...p.strengths.map((s) => `• ${s}`), ...(p.reviews ? [`• 후기 ${p.reviews}`] : []), ...(p.differ ? [] : ['• [다른 곳과 다른 점 한 가지]'])].join('\n') },
    { label: '이용 안내', text: `• 시간: ${p.hours || '[운영 시간 · 쉬는 날]'}\n• 주차: [주차 안내]\n• 예약 · 문의: ${p.phone || '[대표 전화]'}${p.channel ? ` · ${p.channel}` : ''}` },
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
  const topic0 = req.topic ?? topicsFor(p, kw, today, variant)[0]
  // D-229 제목의 'N가지' 는 그 형식이 실제로 다루는 개수(블로그 2 · 영상 3 · 쇼츠 2~3 · 정보형 카드는 본문 장 수)
  const per = req.kind === 'blog' ? 2 : req.kind === 'shorts' ? ((req.shortLen ?? '20-30') === '20-30' ? 2 : 3) : req.kind === 'cards' && (req.adType ?? 'info') === 'info' ? (req.pages ?? 5) - 2 : 3
  const topic = { ...topic0, title: withCount(topic0.title, per) }
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
      title = blocks[0].text
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
  if (req.kind === 'cards' && req.adType === 'before') notes.push(noOfferAd(p) ? '의료 · 규제 업종은 전후 비교를 쓰지 않아요 — 과정만 보여 주는 안으로 만들었어요.' : '전후 사진 · 숫자는 실제 사례(고객 동의)만 — [대괄호] 를 실제 값으로 채우거나, 사례가 없으면 이 안은 쓰지 마세요.')
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

const HOLE_RE = /\[([^\]\n]{1,80})\]/g

export function placeholders(text: string): string[] {
  return [...text.matchAll(HOLE_RE)].map((m) => m[1])
}

/** D-209 여러 글의 [대괄호] 자리 이름 — 나온 순서대로 한 번씩(한 번 적어 묶음 모든 글에 넣을 때). 칸 이름(라벨)은 채울 자리가 아니다. */
export function holeNames(blockSets: readonly (readonly DraftBlock[])[]): string[] {
  const out: string[] = []
  for (const bs of blockSets) for (const b of bs) for (const h of placeholders(b.text)) if (!out.includes(h)) out.push(h)
  return out
}

/** D-209 입력 칸에 쓸 이름 — '문 연 기념 혜택 — 없으면 이 줄을 지워 주세요' → 이름 · 도움말 · 없어도 되는 칸인지 */
export function holeLabel(name: string): { label: string; hint: string; optional: boolean } {
  const [label, ...rest] = name.split(' — ')
  return { label: label.trim(), hint: rest.join(' — ').trim(), optional: /없으면|있다면|있으면/.test(name) }
}

/** D-209 같은 이름(— 앞)의 빈 칸은 입력 칸 하나로 — '다른 점 한 가지' 와 '다른 점 한 가지 — 업체와 확인해…' 를 한 번에 */
export function holeGroups(names: readonly string[]): { label: string; hint: string; optional: boolean; names: string[] }[] {
  const out: { label: string; hint: string; optional: boolean; names: string[] }[] = []
  for (const n of names) {
    const h = holeLabel(n)
    const g = out.find((x) => x.label === h.label)
    if (g) {
      g.names.push(n)
      if (!g.hint && h.hint) g.hint = h.hint
      g.optional = g.optional || h.optional
    } else out.push({ label: h.label, hint: h.hint, optional: h.optional, names: [n] })
  }
  return out
}

/**
 * D-209 [대괄호] 자리를 적은 값으로 바꾼다. 빈 값(띄어쓰기만 포함)은 그대로 둔다 · 값 안의 $& 같은 기호도 글자 그대로.
 * drop 에 든 자리('없어요')는 그 줄을 지우고, 칸 글이 비면 칸도 뺀다.
 */
export function fillHoles(blocks: readonly DraftBlock[], values: Readonly<Record<string, string>>, drop: readonly string[] = []): { blocks: DraftBlock[]; filled: number } {
  let filled = 0
  const out: DraftBlock[] = []
  for (const b of blocks) {
    let text = b.text
    if (drop.length) {
      const lines = text.split('\n')
      const kept = lines.filter((ln) => !drop.some((n) => ln.includes(`[${n}]`)))
      if (kept.length !== lines.length) {
        filled += lines.length - kept.length
        text = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
        if (!text) continue
      }
    }
    text = text.replace(HOLE_RE, (m, name: string) => {
      const v = values[name]?.trim()
      if (!v) return m
      filled += 1
      return v
    })
    out.push({ ...b, text })
  }
  return { blocks: out, filled }
}

/* ------------------------------------------------------------------ */
/* D-228 사실 대조 — 이상한AI 3차 관찰에서 본 위험(준 적 없는 혜택 · 지어낸 출처 · 깎아내리기 · 숫자 뜻 바꾸기 · 모순)을 */
/* 우리 글 · 다른 도구에서 받은 글 모두에 대 본다. 규칙 검사다(AI 아님).                                       */
/* ------------------------------------------------------------------ */

const POLICY_WORDS: { re: RegExp; what: string }[] = [
  { re: /무료\s*배송|배송비\s*무료/, what: '무료 배송' },
  { re: /무료\s*교환|교환\s*(?:보장|무조건)|무조건\s*교환|환불\s*(?:보장|100)/, what: '교환 · 환불 약속' },
  { re: /\d+\s*%\s*할인|할인\s*(?:쿠폰|이벤트)/, what: '할인' },
  { re: /증정|사은품|덤으로/, what: '증정' },
  { re: /선착순/, what: '선착순' },
  { re: /오늘만|오늘\s*하루만|마감\s*임박/, what: '오늘만 · 마감 임박' },
]
const SOURCE_RE = /(?:연구소|연구원|협회|학회|소비자원|기관|교수|박사|전문가)(?:에서|가|이|의|도)?\s?[^\n.]{0,10}(?:권고|권장|발표|분석|밝혔|추천한|인정한)/
const BASH_RE = /(?:다른|타)\s?(?:업체|곳|가게|회사)[^\n.]{0,12}(?:보다\s*(?:못|비싸|나쁘|떨어)|와\s*달리|과\s*달리)|(?:편의점|대형\s?마트|인터넷\s?최저가)[^\n.]{0,10}(?:덩어리|위험|최악|못\s*믿)/

const STAT_RE = /\d+\s*명\s*중\s*\d+(?:\s*[~∼-]\s*\d+)?\s*명/
const MONTH_LIMIT_RE = /(\d{1,2})\s*월\s*(?:한정|까지만|만\s*특가)/
const ROUNDUP_RE = /(?:업체|가게|병원|학원|맛집|매장)\s*\d+\s*곳|\d+\s*곳\s*(?:총정리|비교|추천|모음)/
const PRESSURE_RE = /지금\s*(?:안\s*하면|아니면|놓치면|시작하지\s*않으면)[^\n.]{0,20}(?:후회|늦)|후회\s*(?:하기\s*전에|하지\s*않으려면)/

/** [대괄호] 자리는 빼고 본다 — 채울 자리 안내 글은 사실 주장이 아니다 */
const withoutHoles = (t: string) => t.replace(/\[[^\]\n]{1,80}\]/g, ' ')

export function factChecks(rawText: string, p: ContentProfile): DraftCheck[] {
  const text = withoutHoles(rawText)
  const out: DraftCheck[] = []
  const given = `${p.offer} ${p.price} ${p.shipping} ${p.strengths.join(' ')} ${p.differ}`
  for (const w of POLICY_WORDS) {
    const m = w.re.exec(text)
    if (m && !w.re.test(given)) out.push({ key: `policy-${w.what}`, level: 'should', text: `'${m[0]}' — 홍보 정보(이번 달 혜택 · 가격 조건)에 없는 ${w.what}이에요. 업체가 실제로 하는 것인지 확인하고, 아니면 지워 주세요.` })
  }
  const src = SOURCE_RE.exec(text)
  if (src) out.push({ key: 'source', level: 'should', text: `'${src[0]}' — 기관 · 전문가 출처는 이름 · 날짜를 확인할 수 있을 때만 쓰세요(지어낸 출처는 거짓 광고예요).` })
  const bash = BASH_RE.exec(text)
  if (bash) out.push({ key: 'bash', level: 'should', text: `'${bash[0]}' — 다른 업체 · 다른 상품을 깎아내리면 비교 광고 문제가 될 수 있어요. 우리 장점만 말해 주세요.` })
  // 업력 숫자 — 업체 기록(설립 N년째)과 다른 '○년 차 · ○년째 · 경력 ○년' 은 모순(같은 업체 글끼리 숫자가 엇갈리면 믿음이 깨진다)
  const yearsSaid = [...text.matchAll(/(\d{1,3})\s*년\s*(?:차|째)|(?:경력|업력)\s*(\d{1,3})\s*년/g)].map((m) => Number(m[1] ?? m[2]))
  const odd = yearsSaid.filter((n) => p.years === null || n !== p.years)
  if (odd.length) out.push({ key: 'years', level: 'should', text: p.years === null ? `'${odd[0]}년' — 업체 기록에 설립 연도가 없어요. 업력 숫자는 확인한 뒤에만 써 주세요.` : `'${odd[0]}년' — 업체 기록은 설립 ${p.years}년째예요. 다른 글과 숫자가 엇갈리지 않게 맞춰 주세요.` })
  // D-229 규칙집 1-6 통계형 — '10명 중 7명' 은 우리 조사 · 고객 데이터가 있을 때만
  const stat = STAT_RE.exec(text)
  if (stat) out.push({ key: 'stat', level: 'should', text: `'${stat[0]}' — 통계형 표현은 우리 조사 · 고객 데이터가 있을 때만 써요. 없으면 "많은 분들이" 로 바꿔 주세요.` })
  // 실제 날짜 없는 기간 한정(규칙집 금지 2 · 4-3)
  const lim = MONTH_LIMIT_RE.exec(text)
  if (lim) {
    const mm = /^\d{4}-(\d{2})-/.exec(p.offerUntil)
    if (!mm) out.push({ key: 'month-limit', level: 'should', text: `'${lim[0]}' — 홍보 정보에 혜택 기한이 없어요. 실제 날짜가 정해졌을 때만 기간 한정을 써 주세요.` })
    else if (Number(mm[1]) !== Number(lim[1])) out.push({ key: 'month-limit', level: 'should', text: `'${lim[0]}' — 적어 둔 혜택 기한은 ${Number(mm[1])}월이에요. 실제 달로 맞춰 주세요.` })
  }
  // 다른 업체를 모아 소개 · 비교(규칙집 금지 5)
  const round = ROUNDUP_RE.exec(text)
  if (round) out.push({ key: 'roundup', level: 'should', text: `'${round[0]}' — 다른 업체를 모아 소개 · 비교하는 글은 쓰지 않아요. 우리 업체 이야기만 해 주세요.` })
  // 의료 · 교육 압박형(규칙집 5-4)
  if (p.industry === 'health' || p.industry === 'education') {
    const push = PRESSURE_RE.exec(text)
    if (push) out.push({ key: 'pressure', level: 'should', text: `'${push[0]}' — 의료 · 교육 광고에는 압박하는 말(지금 안 하면 후회)을 쓰지 않아요.` })
  }
  // 업체가 넣지 말라고 한 말(브리프 '넣지 말 것')
  for (const w of p.avoid.filter((x) => text.includes(x)).slice(0, 3)) out.push({ key: `avoid-${w}`, level: 'should', text: `'${w}' — 업체가 넣지 말라고 한 말이에요. 빼 주세요.` })
  // 주지 않은 후기 문장 — 따옴표 말을 고객 · 후기 말로 소개하는데 적어 둔 고객 한마디(또는 망설이는 점)가 아니면
  for (const m of text.matchAll(/["“]([^"”\n]{4,80})["”]/g)) {
    const q = m[1].trim()
    if ((p.voice && (q.includes(p.voice) || p.voice.includes(q))) || (p.objection && q === p.objection)) continue
    const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0)
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 10)
    // '손님은 "무엇이 맛있는 집인지" 를 찾아요' 같은 설명은 후기가 아니다 — 후기 · 한마디 · 말씀으로 소개하거나 "…라고 하셨" 일 때만
    if (/(?:후기|리뷰|한마디|말씀)[^\n]{0,6}$/.test(before) || /^\s*(?:라는\s*(?:후기|리뷰|말)|라고\s*(?:하셨|해\s*주셨|말씀)|는\s*(?:후기|리뷰))/.test(after)) {
      out.push({ key: 'voice-made', level: 'should', text: `'${q.length > 24 ? `${q.slice(0, 24)}…` : q}' — 홍보 정보에 적힌 고객 한마디가 아니에요. 실제로 받은 후기만, 받은 그대로 써 주세요.` })
      break
    }
  }
  // 후기 수의 뜻 바꾸기 — '후기 1,240개' 를 '1,240명 재구매' 처럼
  if (p.reviews && !/명|고객|재구매/.test(p.reviews)) {
    for (const raw of p.reviews.match(/\d[\d,]*/g) ?? []) {
      const n = raw.replace(/,/g, '')
      if (n.length < 2) continue
      const re = new RegExp(`(?:${n}|${Number(n).toLocaleString('ko-KR')})\\s*(?:명|분|고객|재구매)`)
      const m = re.exec(text)
      if (m) {
        out.push({ key: 'reviews-meaning', level: 'should', text: `'${m[0]}' — 홍보 정보에는 '${p.reviews}' 로 적혀 있어요. 후기 수를 고객 수 · 재구매로 바꿔 쓰지 마세요.` })
        break
      }
    }
  }
  return out
}

export function draftChecks(kind: ContentKind, blocks: readonly DraftBlock[], industry: ContentProfile['industry'], keyword?: string, p?: ContentProfile): DraftCheck[] {
  const text = plainText(kind, blocks)
  const out: DraftCheck[] = []
  // D-209 고침: 영상 · 카드뉴스는 복사할 때 칸 이름을 [0:00 - 0:03] · [1장] 으로 감싼다 — 칸 이름은 채울 자리로 세지 않는다
  const holes = blocks.flatMap((b) => placeholders(b.text))
  if (holes.length) out.push({ key: 'holes', level: 'must', text: `[대괄호] ${holes.length}곳을 실제 내용으로 바꾸거나 지워 주세요.` })
  for (const r of RISKY_WORDS) {
    const m = r.re.exec(text)
    if (m) out.push({ key: `risky-${r.word}`, level: 'should', text: `'${m[0]}' — ${r.why}. 광고 규정에 걸릴 수 있어요.` })
  }
  // D-229 규칙집 3-1 · 6장 — 연락처 · 링크 자리에 '정보 없음' 을 남기지 않는다
  const none = /정보\s*없음/.exec(text)
  if (none) out.push({ key: 'no-info', level: 'must', text: "'정보 없음' 이 남아 있어요 — 실제 값을 넣거나 그 줄을 지워 주세요." })
  // 의료 — 개인차 · 부작용 안내(규칙집 5장)
  if (industry === 'health' && (kind === 'blog' || kind === 'video' || kind === 'shorts' || kind === 'cards') && !/개인차|개인에\s*따라/.test(text))
    out.push({ key: 'care', level: 'should', text: '의료 글에는 개인차 · 부작용 안내를 넣어 주세요(예: 개인에 따라 결과가 다를 수 있어요).' })
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
    // D-229 규칙집 3-1 — 키워드는 띄어쓰기까지 그대로 제목 맨 앞에, 바로 뒤에 쉼표나 물음표 · 제목 25~35자 · 키워드 2~7번
    else if (title && !(title.startsWith(keyword) && /^[\s]*[,?]/.test(title.slice(keyword.length)))) out.push({ key: 'kw-front', level: 'should', text: `키워드 "${keyword}" 를 제목 맨 앞에 두고 바로 뒤에 쉼표나 물음표를 붙여 주세요.` })
    if (title && (title.length < 25 || title.length > 35)) out.push({ key: 'title-len', level: 'info', text: `제목 ${title.length}자 — 25~35자가 좋아요.` })
    // 두 글자 일반어('상담')는 다른 낱말 속에도 들어가 수가 부풀어 세지 않는다
    if (n > 7 && (keyword.length >= 4 || keyword.includes(' '))) out.push({ key: 'kw-many', level: 'should', text: `키워드 "${keyword}" 가 ${n}번 — 2~7번이 자연스러워요(억지로 넣은 느낌이 나요).` })
    if (first && !first.includes(keyword)) out.push({ key: 'kw-first', level: 'should', text: `첫 문단에 키워드 "${keyword}" 가 없어요 — 첫 두 줄 안에 넣어 주세요.` })
    // 소제목 — 규칙집 틀로 만든 글은 '소제목' 표시를 센다(예전에 저장한 글은 칸 이름 수)
    const marked = blocks.filter((b) => b.hint?.startsWith('소제목')).length
    const heads = marked || blocks.filter((b) => b.label).length
    const photos = blocks.filter((b) => b.text.startsWith(PHOTO_PREFIX)).length
    out.push({ key: 'shape', level: 'info', text: `소제목 ${heads}개 · 사진 자리 ${photos}곳 — 기준은 소제목 3개(기준 2 + 정리) · 사진 4~7곳이에요. 사진 아래에 한 줄 설명을 달면 읽기 쉬워요.` })
  }
  if (kind === 'blog' && guide) {
    const shown = /제공받아|원고료를\s*받고|받고\s*직접\s*써\s*본/.test(text)
    out.push({ key: 'disclose', level: shown ? 'info' : 'should', text: shown ? '체험단 글에 대가 표시(광고 표시 "제공받아 써 본 후기")를 맨 위에 넣으라는 안내가 들어 있어요.' : '체험단 글에는 대가를 받은 사실을 제목이나 첫머리에 밝히라는 안내를 넣어 주세요.' })
  }
  if (kind === 'video' || kind === 'shorts') {
    // D-229 규칙집 3-3 · 3-4 — 썸네일 문구 20~35자(숫자 꼭) · 쇼츠 상단 문구 14~22자 (예전 '15자 안쪽' 기준은 바꿨다)
    const fixed = blocks.find((b) => b.label === '썸네일 문구' || b.label === '고정 문구')?.text ?? ''
    if (fixed && !placeholders(fixed).length) {
      const [min, max] = kind === 'video' ? [20, 35] : [14, 22]
      if (fixed.length < min || fixed.length > max) out.push({ key: 'fixed-len', level: 'should', text: kind === 'video' ? `썸네일 문구가 ${fixed.length}자예요 — 20~35자에 숫자를 넣으면 눈에 잘 들어와요.` : `고정 문구가 ${fixed.length}자예요 — 14~22자면 휴대폰에서 한눈에 읽혀요.` })
      if (kind === 'video' && !/\d/.test(fixed)) out.push({ key: 'thumb-num', level: 'should', text: '썸네일 문구에 숫자를 넣어 주세요(예: 3가지 · 12년 차).' })
    }
    if (kind === 'video') {
      const vt = blocks.find((b) => b.hint?.startsWith('제목'))?.text ?? ''
      const core = keyword && p ? withoutArea(p, keyword) || keyword : keyword
      if (core && vt && !vt.includes(core)) out.push({ key: 'kw-title', level: 'should', text: `제목에 "${core}" 가 없어요 — 유튜브 검색은 제목으로 무슨 영상인지 알아봐요.` })
      if (p && vt && [p.area, ...p.region.split(/\s+/)].some((w) => w.length >= 2 && vt.includes(w))) out.push({ key: 'video-area', level: 'should', text: '유튜브 제목에서는 지역을 빼고 전국 주제로 넓혀 주세요 — 지역은 본문 사례로만 써요.' })
      const b2b = B2B_INDUSTRIES.has(industry)
      if (vt && (b2b ? vt.length < 25 || vt.length > 35 : vt.length < 40 || vt.length > 55)) out.push({ key: 'title-len', level: 'info', text: b2b ? `제목 ${vt.length}자 — 기업형은 괄호 없이 25~35자가 좋아요.` : `제목 ${vt.length}자 — 소비자형은 '본제목 (괄호 꼬리말)' 40~55자가 좋아요.` })
      if (vt.length > 100) out.push({ key: 'title-len', level: 'should', text: `제목이 ${vt.length}자예요 — 100자 안으로 줄여 주세요.` })
    }
    if (kind === 'shorts' && /안녕하세요/.test(blocks.filter((b) => /^\d+:\d{2} - /.test(b.label)).map((b) => b.text).join('\n')))
      out.push({ key: 'shorts-hello', level: 'should', text: '쇼츠는 인사 없이 바로 첫 번째 항목으로 들어가요.' })
    if (kind === 'shorts') {
      const last = [...blocks].reverse().find((b) => /^\d+:\d{2} - \d+:\d{2}$/.test(b.label))
      const m = last ? /- (\d+):(\d{2})$/.exec(last.label) : null
      if (m) out.push({ key: 'dur', level: 'info', text: `전체 약 ${Number(m[1]) * 60 + Number(m[2])}초 · 세로 영상 — 첫 3초 안에 붙잡는 말이 나와요.` })
    }
  }
  if (p && kind !== 'keywords') out.push(...factChecks(text, p))
  if (kind !== 'keywords') out.push({ key: 'len', level: 'info', text: `${text.length.toLocaleString('ko-KR')}자(공백 포함)${kind === 'blog' && !guide ? ' — 블로그 기준은 2,100~3,000자예요. [대괄호] 를 실제 이야기로 채우면 늘어나요.' : ''}` })
  return out
}

/* ------------------------------------------------------------------ */
/* D-229 발행 전 검수표 — 규칙집 6장. 규칙으로 볼 수 있는 것은 자동(통과 · 확인), 나머지는 사람이 체크          */
/* ------------------------------------------------------------------ */

export interface ReviewItem {
  group: '사람 · 업체' | '숫자 · 사실' | '형식' | '규제 · 표시' | '고친 뒤 · 올린 뒤'
  text: string
  /** pass 자동 통과 · warn 자동으로 찾은 문제 · manual 사람이 볼 것 */
  state: 'pass' | 'warn' | 'manual'
}

const FIXED_POINT: Record<ContentKind, string> = {
  blog: '키워드를 띄어쓰기까지 그대로 제목 맨 앞에',
  video: '제목 · 썸네일에 지역 없음 · 썸네일에 숫자',
  shorts: '고정 문구 14~22자 · 인사 없이 바로 첫 번째',
  cards: '5유형 순서 · 지역은 1장이나 위치 장에 한 번만',
  kakao: '맨 앞 (광고) · 밤 9시 ~ 아침 8시에는 보내지 않기',
  place: '실제 주소 · 운영 시간',
  keywords: '월 검색량 100 이상',
}

export function reviewChecklist(kind: ContentKind, checks: readonly DraftCheck[], p: ContentProfile, opts: { guide?: boolean } = {}): ReviewItem[] {
  if (kind === 'keywords') return []
  const has = (re: RegExp) => checks.some((c) => c.level !== 'info' && re.test(c.key))
  const auto = (bad: boolean): ReviewItem['state'] => (bad ? 'warn' : 'pass')
  const regulated = p.industry === 'health' || p.industry === 'food' || p.industry === 'education' || p.industry === 'professional'
  const items: ReviewItem[] = [
    { group: '사람 · 업체', text: '말하는 사람이 업종과 맞는가(의료 정보는 의료인이)', state: 'manual' },
    { group: '사람 · 업체', text: p.speaker ? `사람 이름이 '${p.speaker}' 그대로인가 — 다른 실명이 들어가지 않았는가` : '사람 이름이 들어가지 않았는가(말하는 사람을 정하지 않았어요)', state: 'manual' },
    { group: '사람 · 업체', text: `독자가 '${p.target}' 그대로인가(손님 ↔ 사장님이 뒤집히지 않았는가)`, state: 'manual' },
    { group: '사람 · 업체', text: '다른 업종 · 관계없는 사업 이야기가 섞이지 않았는가 — 끝 문단 · 캡션 · 영상 5편의 마지막 자리를 특히', state: 'manual' },
    { group: '사람 · 업체', text: '실명 브랜드를 고객사 · 거래처처럼 쓰지 않았는가', state: 'manual' },
    { group: '사람 · 업체', text: '다른 업체 · 다른 상품군을 모아 소개하거나 깎아내리지 않았는가', state: auto(has(/^(bash|roundup)$/)) },
    { group: '숫자 · 사실', text: '모든 숫자가 사실 목록에 있는가(하나씩 맞춰 보기)', state: has(/^(stat|years)$/) ? 'warn' : 'manual' },
    { group: '숫자 · 사실', text: '준 숫자의 뜻이 바뀌지 않았는가(후기 수 ↔ 고객 수 ↔ 재구매)', state: auto(has(/^reviews-meaning$/)) },
    { group: '숫자 · 사실', text: '주지 않은 후기 문장 · 정책(교환 · 배송 · 할인)이 없는가', state: auto(has(/^(policy-|voice-made|avoid-)/)) },
    { group: '숫자 · 사실', text: '기관 · 전문가 출처를 지어내지 않았는가', state: auto(has(/^source$/)) },
    { group: '숫자 · 사실', text: '기한이 실제 날짜이고 올리는 날에 유효한가', state: auto(has(/^month-limit$/) || !!p.offerExpired) },
    { group: '숫자 · 사실', text: '같은 업체의 다른 글과 숫자가 맞는가(업력 · 후기 수)', state: auto(has(/^years$/)) },
    { group: '형식', text: '길이 · 장 수 · 컷 수가 정한 값대로인가', state: has(/^(fixed-len|kw-many)$/) || checks.some((c) => c.key === 'title-len') ? 'warn' : 'manual' },
    { group: '형식', text: '틀의 빈칸 이름이 남지 않았는가([주제 내용] · [○년] 같은 것)', state: auto(has(/^holes$/)) },
    { group: '형식', text: "연락처 · 링크 자리에 실제 값이 있거나 지웠는가('정보 없음' 없음)", state: auto(has(/^(no-info|holes)$/)) },
    { group: '형식', text: `채널 고정점 — ${FIXED_POINT[kind]}`, state: kind === 'kakao' || kind === 'place' || kind === 'cards' ? 'manual' : auto(has(/^(kw-front|kw-title|kw-first|video-area|thumb-num|shorts-hello)$/)) },
  ]
  if (regulated || has(/^risky-/)) items.push({ group: '규제 · 표시', text: '광고 규정에 걸리는 말이 없는가(최고 · 1위 · 보장 · 100% …)', state: auto(has(/^risky-/)) })
  if (p.industry === 'health') {
    items.push({ group: '규제 · 표시', text: '개인차 · 부작용 안내가 들어갔는가', state: auto(has(/^care$/)) })
    if (kind === 'cards') items.push({ group: '규제 · 표시', text: "카드 '전후 변화' 안은 버리거나 사람이 다시 썼는가", state: 'manual' })
  }
  if (p.industry === 'health' || p.industry === 'education') items.push({ group: '규제 · 표시', text: '압박하는 말(지금 안 하면 후회)이 없는가', state: auto(has(/^pressure$/)) })
  if (opts.guide) items.push({ group: '규제 · 표시', text: '체험단 — 광고 표시 문구가 맨 위에 있는가', state: auto(has(/^disclose$/)) })
  items.push({ group: '고친 뒤 · 올린 뒤', text: '크게 고쳤거나 다시 만들었다면 이 표를 처음부터 다시 봤는가', state: 'manual' })
  items.push({ group: '고친 뒤 · 올린 뒤', text: '올린 뒤 조회 · 저장 · 문의를 기록해 어떤 각도가 잘 됐는지 남기는가', state: 'manual' })
  return items
}

/** D-228 키워드 검색량 등급 — 월 100 아래는 롱테일, 10 아래는 거의 안 찾음(이상한AI 키워드 추천 30개 중 13개가 100 미만이었다) */
export type VolumeTier = 'high' | 'mid' | 'low' | 'tiny' | 'none'
export const VOLUME_TIER_LABEL: Record<VolumeTier, string> = { high: '많이 찾음', mid: '보통', low: '적게 찾음', tiny: '거의 안 찾음', none: '숫자 없음' }
export function volumeTier(v: Pick<KeywordVolume, 'total' | 'small'>): VolumeTier {
  if (v.total === null) return 'none'
  if (v.total >= 1000) return 'high'
  if (v.total >= 100) return 'mid'
  if (v.total >= 10 && !v.small) return 'low'
  return 'tiny'
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
  /** D-221 이 칸이 속한 계획(시작 월요일 · 주 몇 회) — 글에 같이 남긴다 */
  start?: string
  per?: 2 | 4
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
  return monthPlanFrom(p, addDays(today, ((8 - dow) % 7) || 7), perWeek, today)
}

/** D-208 정해 둔 월요일부터 4주(진행 중인 계획을 날이 지나도 같은 칸으로 보이게) */
export function monthPlanFrom(p: ContentProfile, monday: string, perWeek: 2 | 4, today: string): PlanSlot[] {
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
      out.push({ date: addDays(monday, w * 7 + d), kind: slot.kind, ...(t ? { topicType: t.type } : {}), ...(slot.purpose ? { purpose: slot.purpose } : {}), title, start: monday, per: perWeek })
    }
  }
  return out
}

/**
 * D-208 한 달 치 한 번에 — 계획 칸마다 글 한 편. 같은 형식 · 주제가 또 나오면 다른 안(variant)으로 바꿔 같은 글이 두 번 생기지 않게 한다.
 * 글마다 올릴 날(planDate)을 남겨 계획 칸에 '만듦 · 올림' 을 표시한다.
 */
export function planDrafts(p: ContentProfile, slots: readonly PlanSlot[], today: string, taken: (d: Draft) => boolean = () => false): Draft[] {
  const kw = mainKeyword(p)
  const seen = new Map<string, number>()
  const made = new Set<string>()
  const make = (sl: PlanSlot, variant: number) => {
    const topic = sl.topicType ? topicsFor(p, kw, today, variant).find((t) => t.type === sl.topicType) ?? topicsFor(p, kw, today, variant)[0] : undefined
    const d = makeDraft(p, { kind: sl.kind, keyword: kw, topic, purpose: sl.purpose, variant }, today)
    return { ...d, input: { ...d.input, planDate: sl.date, ...(sl.start && sl.per ? { planStart: sl.start, planPer: sl.per } : {}) } }
  }
  return slots.map((sl) => {
    const key = `${sl.kind}|${sl.topicType ?? ''}|${sl.purpose ?? ''}`
    const start = seen.get(key) ?? 0
    // D-208 고침: 같은 묶음 안에서 같은 글(이번 달 이야기가 없어 '정보' 로 바뀐 칸 등)이나 이미 보관함에 있는 글이면 다른 안으로 — 다섯 번까지
    let v = start
    let d = make(sl, v)
    for (let i = 1; i <= 5 && (made.has(`${d.kind}\u0000${plainText(d.kind, d.blocks)}`) || taken(d)); i++) d = make(sl, start + i)
    v = d.input.variant
    seen.set(key, v + 1)
    made.add(`${d.kind}\u0000${plainText(d.kind, d.blocks)}`)
    return d
  })
}

/** D-221 '다른 안' 으로 새로 만들어도 계획 칸(올릴 날 · 시작 · 주 몇 회)은 그대로 */
export function keepPlan(d: Draft, from: DraftInput): Draft {
  if (!from.planDate) return d
  return { ...d, input: { ...d.input, planDate: from.planDate, ...(from.planStart && from.planPer ? { planStart: from.planStart, planPer: from.planPer } : {}) } }
}

/**
 * D-208 진행 중인 계획 — 보관함 글의 올릴 날(planDate)로 되찾는다. 마지막 날이 지났으면 null(새 계획을 짤 때).
 * 시작 = 가장 이른 날이 있는 주의 월요일 · 월요일이나 목요일 글이 있으면 주 4회.
 */
export function activePlan(items: readonly { input: { planDate?: string; planStart?: string; planPer?: 2 | 4 } }[], today: string): { monday: string; perWeek: 2 | 4 } | null {
  // D-221 계획 정보가 남은 글이 있으면 그것으로(가장 늦게 시작한 계획) — 마지막 칸(4주째 금요일)이 지나면 끝
  const known = items.map((x) => x.input).filter((i) => !!i.planDate && !!i.planStart && (i.planPer === 2 || i.planPer === 4))
  if (known.length) {
    const last = known.reduce((a, b) => ((b.planStart as string) > (a.planStart as string) ? b : a))
    return addDays(last.planStart as string, 25) < today ? null : { monday: last.planStart as string, perWeek: last.planPer as 2 | 4 }
  }
  // 예전 글(올릴 날만 있음) — 날짜로 짐작
  const dates = items.map((x) => x.input.planDate).filter((d): d is string => !!d)
  if (!dates.length) return null
  const max = dates.reduce((a, b) => (a > b ? a : b))
  if (max < today) return null
  const win = dates.filter((d) => d > addDays(max, -28))
  const min = win.reduce((a, b) => (a < b ? a : b))
  const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()
  return { monday: addDays(min, -((dow(min) + 6) % 7)), perWeek: win.some((d) => dow(d) === 1 || dow(d) === 4) ? 4 : 2 }
}
