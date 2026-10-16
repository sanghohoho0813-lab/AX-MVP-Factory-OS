/**
 * 상황 예시 (D-208) — "이런 일이 있을 때" 하나를 누르면 그 업체 글 묶음(카톡 · 블로그 · 카드뉴스 …)이 한꺼번에 나온다.
 *
 * 초보자는 '무엇을 써야 할지' 부터 막힌다. 그래서 형식이 아니라 상황(문 열었어요 · 행사해요 · 쉬어요 · 이사해요 …)으로 고르게 한다.
 * 모두 규칙으로 채우며 'AI' 가 아니다. 업체에 대한 사실은 홍보 정보에서만 가져오고, 모르는 것(날짜 · 혜택 · 새 주소 …)은
 * 지어내지 않고 [대괄호] 로 비워 둔다 — 상황마다 '채울 것' 을 먼저 보여 준다.
 * 여러 사람에게 보내는 카톡은 늘 (광고) 표시 · 안내(generate.ts AD_NOTE)를 단다. 말투(해요 / 합니다)는 다른 글과 같이 바뀐다.
 */
import { contentLib } from './library'
import type { ContentProfile } from './profile'
import { applyTone } from './tone'
import {
  AD_NOTE,
  DIFFER_HOLE,
  at,
  clean,
  contactLines,
  hashtags,
  introSentence,
  j,
  mainKeyword,
  makeDraft,
  monthOf,
  photo,
  seasonHook,
  topicsFor,
  visualsOf,
  type ContentKind,
  type Draft,
  type DraftBlock,
} from './generate'

export type SituationKey = 'open' | 'newItem' | 'event' | 'holiday' | 'price' | 'move' | 'award' | 'hiring' | 'review' | 'season' | 'caseDone' | 'thanks'

export const SITUATION_KEYS: SituationKey[] = ['open', 'newItem', 'event', 'holiday', 'price', 'move', 'award', 'hiring', 'review', 'season', 'caseDone', 'thanks']

/** 보관함 줄에 붙이는 짧은 이름 */
export const SITUATION_SHORT: Record<SituationKey, string> = {
  open: '문 연 소식',
  newItem: '새 상품 소식',
  event: '행사 안내',
  holiday: '쉬는 날 안내',
  price: '가격 안내',
  move: '이사 안내',
  award: '인증 · 상 소식',
  hiring: '채용',
  review: '후기 부탁',
  season: '이번 달 이야기',
  caseDone: '진행 사례',
  thanks: '감사 인사',
}

export interface Situation {
  key: SituationKey
  label: string
  hint: string
  /** 묶음에 들어가는 글(순서대로) */
  tabs: string[]
  /** 업체에 물어 채울 것 — 글 안에 [대괄호] 로 비어 있다 */
  fill: string[]
  /** 지금 때라서 먼저 권하는 까닭 — 없으면 '' */
  now: string
}

export interface SituationPack {
  situation: Situation
  items: { tab: string; draft: Draft }[]
}

/** 공휴일 한 줄(daysOff.ts KR_PUBLIC_HOLIDAYS 와 같은 모양) — 엔진은 저장소를 읽지 않으므로 화면이 넘긴다 */
export interface HolidayLike {
  date: string
  name: string
}

const PLACE_NOTE = "네이버 플레이스 '소식' 에 올리는 짧은 글이에요 — 사진 한 장을 같이 올리면 눈에 잘 띄어요."
const ONE_TO_ONE_NOTE = '한 분께 1:1 로 보내는 글이에요 — 여러 사람에게 보낼 때는 (광고) 표시가 필요해요.'
const EVENT_NOTE = '할인을 적을 때는 원래 가격과 할인 가격(또는 할인율)을 함께 적고, 기간 · 대상 · 조건을 빠짐없이 적어 주세요.'
const REVIEW_NOTE = '후기를 써 주신 분께 할인 · 선물을 드리면, 후기에 그 사실을 밝히도록 안내해 주세요(공정거래위원회 추천 · 보증 심사지침). 후기를 대신 써 주거나 좋은 말만 써 달라고 하지 마세요.'
const HIRING_NOTE = '채용 글에 성별 · 나이 제한(예: ○○세 이하 · 남자만)을 적으면 안 돼요(남녀고용평등법 · 고령자고용법). 급여 · 근무 시간은 실제와 같게 적어 주세요(채용절차법).'
const AWARD_NOTE = '인증 · 상은 받은 이름 그대로 적어 주세요 — 기간이 정해진 인증은 유효기간 안에서만 써요.'
const MOVE_NOTE = '플레이스 · 지도 · 홈페이지 주소도 같은 날 함께 바꿔 주세요.'
const PRICE_NOTE = '매장 · 플레이스 · 홈페이지의 가격표도 같은 날 함께 고쳐 주세요.'
const HOLIDAY_NOTE = "플레이스의 '영업시간 · 휴무일' 칸도 같이 바꿔 두면 헛걸음하는 손님이 없어요."

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`

/** 상황 12가지 — 업체 · 오늘에 맞춘 이름 · 지금 때 */
export function situationsFor(p: ContentProfile, today: string, holidays: readonly HolidayLike[] = []): Situation[] {
  const lib = contentLib(p.industry)
  const m = monthOf(today)
  const season = seasonHook(lib, today)
  const soon = holidays.filter((h) => h.date >= today && h.date <= addDays(today, 21)).sort((a, b) => a.date.localeCompare(b.date))[0]
  const thisYear = today.slice(0, 4)
  const list: Record<SituationKey, Omit<Situation, 'key'>> = {
    open: { label: '새로 문을 열었어요', hint: '개업 · 새 지점 · 새 단장', tabs: ['카톡', '블로그', '카드뉴스'], fill: ['문 연 날짜', '문 연 기념 혜택(있으면)'], now: p.since === thisYear ? `올해(${thisYear}년) 문을 열었어요` : '' },
    newItem: { label: '새 상품 · 서비스가 나왔어요', hint: '새 메뉴 · 새 서비스 · 새 제품', tabs: ['카톡', '블로그', '짧은 영상'], fill: ['새 상품 · 서비스 이름', '어떤 분께 좋은지', '가격 · 시작하는 날'], now: '' },
    event: { label: '할인 · 행사를 해요', hint: '기간 한정 혜택 알리기', tabs: ['카톡', '카드뉴스', '플레이스 소식'], fill: ['행사 이름 · 혜택 내용', '기간', '대상 · 참여 방법'], now: '' },
    holiday: { label: '쉬는 날을 알려요', hint: '명절 · 임시 휴무 · 운영 시간', tabs: ['카톡', '플레이스 소식'], fill: ['쉬는 날짜', '다시 여는 날'], now: soon ? `${md(soon.date)} ${soon.name}` : '' },
    price: { label: '가격이 달라져요', hint: '가격 · 구성 바뀜을 미리 알리기', tabs: ['카톡', '플레이스 소식', '블로그'], fill: ['바뀌는 날짜', '지금 가격 · 새 가격', '바뀌는 이유'], now: '' },
    move: { label: '이사 · 확장해요', hint: '새 주소 · 찾아오는 길', tabs: ['카톡', '블로그', '카드뉴스'], fill: ['옮기는 날짜', '새 주소', '주차 · 찾아오는 길'], now: '' },
    award: { label: '인증 · 상을 받았어요', hint: '인증 · 선정 · 수상 소식', tabs: ['블로그', '카드뉴스', '카톡'], fill: ['인증 · 상 이름', '주는 곳 · 받은 날'], now: '' },
    hiring: { label: '함께 일할 사람을 찾아요', hint: '채용 글 · 채용 카드뉴스', tabs: ['블로그', '카드뉴스'], fill: ['직무 · 하는 일', '근무 시간 · 급여 · 고용 형태', '지원 방법 · 마감일'], now: '' },
    review: { label: '후기를 부탁하고 싶어요', hint: '단골께 1:1 부탁 · 매장 안내 카드', tabs: ['카톡 1:1', '카드뉴스'], fill: ['후기 남기는 곳 · 링크'], now: '' },
    season: { label: `${season ? season.month : m}월 이야기를 올려요`, hint: season ? season.hook : '이번 달 인사 · 알아 둘 정보', tabs: ['카톡', '블로그', '카드뉴스'], fill: [], now: season ? `${season.month}월 — ${season.hook}` : '' },
    caseDone: lib.noCase
      ? { label: '진행 과정을 소개해요', hint: '어떻게 진행하는지 보여 주기(체험담 · 전후 사진 없이)', tabs: ['블로그', '짧은 영상'], fill: [], now: '' }
      : { label: '일 하나를 잘 끝냈어요', hint: '진행 사례 올리기(고객 동의를 받은 것만)', tabs: ['블로그', '짧은 영상', '카드뉴스'], fill: ['고객 상황(이름은 빼고)', '결과(고객 동의)'], now: '' },
    thanks: { label: '단골께 고마움을 전해요', hint: '안부 · 한 해 감사 인사', tabs: ['카톡 1:1', '카톡 여러 분께'], fill: ['고객 이름(1:1)', '올해 있었던 일 한 줄'], now: m === 12 || m === 1 ? '한 해 인사를 나누는 때' : '' },
  }
  return SITUATION_KEYS.map((key) => ({ key, ...list[key] }))
}

/* ------------------------------------------------------------------ */
/* 묶음 만들기                                                           */
/* ------------------------------------------------------------------ */

type Piece = { tab: string; kind: ContentKind; title: string; blocks: DraftBlock[]; notes: string[]; keyword?: boolean }

const page = (n: number, tag: string, big: string, small: string, pic: string): DraftBlock => ({ label: `${n}장${tag ? ` · ${tag}` : ''}`, text: `큰 글자: ${big}\n작은 글자: ${small}\n그림: ${pic}` })

function bullets(list: readonly string[]): string {
  return list.map((s) => `• ${s}`).join('\n')
}

/**
 * 묶음 하나 — 상황 · 업체 · 오늘로 늘 같은 글(시험 · 다시 열기).
 * 카드뉴스는 5장 + '올릴 때 쓰는 글', 짧은 영상은 27초, 블로그는 제목 · 첫 문단 · 사진 자리 · 소제목 · 문의 · 해시태그.
 */
export function situationPack(p: ContentProfile, key: SituationKey, today: string, holidays: readonly HolidayLike[] = []): SituationPack {
  const situation = situationsFor(p, today, holidays).find((s) => s.key === key) as Situation
  const lib = contentLib(p.industry)
  const C = p.company
  const kw = mainKeyword(p)
  const hello = `안녕하세요, ${j(C, '이에요/예요')}.`
  const phoneLine = `문의 ${p.phone || '[대표 전화]'}`
  const visuals = visualsOf(lib)
  const ctaShort = lib.ctaShort.replace('{company}', C)
  const kindName = clean(`${p.area} ${p.item}`)
  const label = situation.label
  const cta: DraftBlock = { label: lib.ctaTitle, text: `${lib.ctaBody}\n\n${contactLines(p)}` }
  const tags: DraftBlock = { label: '', text: hashtags(p).join(' '), hint: '해시태그' }
  const servicesOr = (n: number) => (p.services.length ? p.services.slice(0, n).join(' · ') : p.item)
  const last = (n: number) => page(n, '마무리', lib.ctaTitle, `${p.phone || '[연락처]'}${p.channel ? ` · ${p.channel}` : p.region ? ` · ${p.region}` : ''}`, '로고 · 연락처 · 지도 화면')
  const caption = (title: string, pages: DraftBlock[], tail = ctaShort, tagLine = hashtags(p).join(' ')): DraftBlock => ({
    label: '올릴 때 쓰는 글',
    text: `${title}\n\n${pages
      .slice(1, -1)
      .map((b) => /큰 글자: (.*)/.exec(b.text)?.[1] ?? '')
      .filter(Boolean)
      .map((t) => `• ${t}`)
      .join('\n')}\n\n${tail}\n\n${tagLine}`,
  })
  const cards = (title: string, pages: DraftBlock[], tail?: string, tagLine?: string): DraftBlock[] => [{ ...pages[0], hint: label }, ...pages.slice(1), caption(title, pages, tail, tagLine)]
  const kakao = (text: string): DraftBlock[] => [{ label: '', text, hint: label }]
  const blogHead = (title: string, first: string, pic: string): DraftBlock[] => [{ label: '', text: title, hint: '제목' }, { label: '', text: first, hint: '첫 문단(도입부)' }, photo(pic)]
  const introBlock: DraftBlock = { label: `${j(C, '을/를')} 소개해요`, text: [introSentence(p), p.services.length ? `하는 일: ${p.services.join(' · ')}` : '', p.differ ? `다른 곳과 다른 점 — ${p.differ}` : ''].filter(Boolean).join('\n') }

  let pieces: Piece[] = []
  let reused: { tab: string; draft: Draft }[] = []

  switch (key) {
    case 'open': {
      const blogTitle = `${kw}, ${C} 새로 문을 열었어요`
      pieces = [
        {
          tab: '카톡',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(
            [
              `(광고) ${C} 새로 문을 열었어요\n`,
              hello,
              `${p.area ? `${p.area}에서 ` : ''}${p.item} ${j(lib.placeNoun, '으로/로')} 새로 문을 열었어요.`,
              '문 연 날: [문 연 날짜]',
              ...(p.services.length ? [`하는 일: ${p.services.join(' · ')}`] : []),
              ...(p.differ ? [p.differ] : []),
              '[문 연 기념 혜택이 있다면 한 줄 — 없으면 이 줄을 지워 주세요]\n',
              contactLines(p),
            ].join('\n'),
          ),
          notes: [AD_NOTE],
        },
        {
          tab: '블로그',
          kind: 'blog',
          keyword: true,
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(kw, '을/를')} 찾는 분들께 반가운 소식을 전해요. ${j(C, '이/가')} [문 연 날짜]에 새로 문을 열었어요.`, '간판 · 문 연 날 모습'),
            // 설립 연도는 빼고(새로 연 소식에 옛 연도가 섞이지 않게) 지역 · 하는 일만
            { label: '어떤 곳인가요?', text: clean(`${j(C, '은/는')} ${p.region ? `${p.region}의 ` : ''}${p.item} ${j(lib.placeNoun, '이에요/예요')}.`) },
            { label: '하는 일', text: p.services.length ? bullets(p.services) : `• ${p.item}\n• [하는 일 두세 가지]` },
            { label: '이런 점을 챙겨요', text: [p.differ || DIFFER_HOLE, ...p.strengths.map((s) => `• ${s}`)].join('\n') },
            { label: '문 연 기념 안내', text: '[문 연 기념 혜택 · 기간 — 없으면 이 칸을 지워 주세요]' },
            photo(at(visuals, 1)),
            cta,
            tags,
          ],
          notes: [],
        },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(`${C} 새로 문을 열었어요`, [
            page(1, '표지', `${C} 새로 문을 열었어요`, kindName || p.item, '간판 · 가게 앞 사진 위에 큰 글자'),
            page(2, '이런 곳이에요', `${p.item} ${lib.placeNoun}`, p.services.length ? p.services.slice(0, 3).join(' · ') : '[하는 일 두세 가지]', at(visuals, 0)),
            page(3, '다른 점', p.differ || '[다른 곳과 다른 점 한 가지]', p.strengths.slice(0, 2).join(' · ') || lib.process.map((s) => s.name).join(' → '), at(visuals, 1)),
            page(4, '문 연 기념', '[문 연 기념 혜택 — 없으면 이 장을 빼 주세요]', '[기간]', '선물 · 축하 그림'),
            last(5),
          ]),
          notes: [],
        },
      ]
      break
    }
    case 'newItem': {
      const blogTitle = `${kw} 새 소식 — [새 상품 · 서비스 이름]`
      pieces = [
        {
          tab: '카톡',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(`(광고) ${C} 새 소식\n\n${hello}\n새로 나온 것: [새 상품 · 서비스 이름]\n이런 분께: [어떤 분께 좋은지 한 줄]\n가격 · 시작하는 날: [가격 · 날짜]\n\n${phoneLine}`),
          notes: [AD_NOTE],
        },
        {
          tab: '블로그',
          kind: 'blog',
          keyword: true,
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(kw, '을/를')} 찾는 분들께 새 소식을 전해요. ${C}에서 새로 선보이는 것을 소개해요.`, '새 상품 · 서비스 실제 사진'),
            { label: '무엇이 새로 나왔나요?', text: '[새 상품 · 서비스 이름]\n[어떤 것인지 두세 문장 — 재료 · 방법 · 구성]' },
            { label: '이런 분께 좋아요', text: `• ${p.target}\n• [이런 고민이 있는 분 — 한 줄]` },
            { label: '가격 · 시작하는 날', text: '[가격]\n[시작하는 날 · 수량이 정해져 있다면 함께]' },
            photo(at(visuals, 1)),
            introBlock,
            cta,
            tags,
          ],
          notes: [],
        },
        {
          tab: '짧은 영상',
          kind: 'shorts',
          title: `짧은 영상 · ${label}`,
          blocks: [
            { label: '', text: `${C} 새로 나왔어요 — [새 상품 · 서비스 이름]`, hint: '제목 · 20~30초 세로 영상' },
            { label: '고정 문구', text: '새로 나왔어요', hint: '영상 내내 위에 떠 있는 글자 — 짧게' },
            { label: '첫 3초 · 붙잡는 말', text: `${p.item}, 새로 나온 것을 보여 드려요.` },
            { label: '0:00 - 0:03', text: `나레이션: ${p.item}, 새로 나온 것을 보여 드려요.\n자막: 새로 나왔어요\n장면: 새 상품 · 서비스를 손으로 가리키며 시작` },
            { label: '0:03 - 0:10', text: '나레이션: [새 상품 · 서비스 이름] — [무엇이 좋은지 한 문장]\n자막: [새 상품 · 서비스 이름]\n장면: 가까이 찍은 모습' },
            { label: '0:10 - 0:20', text: `나레이션: [어떻게 쓰는지 · 진행하는지 한두 문장]\n자막: [핵심 한 줄]\n장면: ${at(visuals, 1)}` },
            { label: '0:20 - 0:27', text: `나레이션: ${ctaShort}\n자막: ${C} · ${p.phone || '[연락처]'}\n장면: 로고 · 연락처 화면` },
            { label: '캡션', text: `${C} 새로 나왔어요 — [새 상품 · 서비스 이름]\n[무엇이 좋은지 한 줄]\n\n${ctaShort}\n${hashtags(p, 8).join(' ')}` },
          ],
          notes: [],
        },
      ]
      break
    }
    case 'event': {
      const body = '[혜택 내용 — 예: 첫 방문 고객 ○○]\n기간: [시작일] ~ [끝나는 날]\n대상: [대상]\n참여 방법: [참여 방법]'
      pieces = [
        { tab: '카톡', kind: 'kakao', title: `카톡 · ${label}`, blocks: kakao(`(광고) ${C} [행사 이름] 안내\n\n${hello}\n${body}\n\n${lib.ctaBody}\n${phoneLine}`), notes: [AD_NOTE, EVENT_NOTE] },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(`${C} [행사 이름]`, [
            page(1, '표지', '[행사 이름]', `${C} · [기간]`, `${at(visuals, 0)} 위에 큰 글자`),
            page(2, '혜택', '[혜택 내용]', '대상: [대상]', '선물 · 할인 표시'),
            page(3, '참여 방법', '[참여 방법]', '기간: [시작일] ~ [끝나는 날]', '달력 · 진행 장면'),
            page(4, '이런 곳이에요', `${p.item} ${lib.placeNoun}`, p.differ || servicesOr(3), at(visuals, 1)),
            last(5),
          ]),
          notes: [EVENT_NOTE],
        },
        {
          tab: '플레이스 소식',
          kind: 'place',
          title: `플레이스 소식 · ${label}`,
          blocks: [
            { label: '소식 제목', text: `[행사 이름] — ${C}` },
            { label: '내용', text: body },
            { label: '문의', text: contactLines(p) },
          ],
          notes: [PLACE_NOTE, EVENT_NOTE],
        },
      ]
      break
    }
    case 'holiday': {
      const body = `[쉬는 날짜]에는 문을 닫아요.\n[다시 여는 날]부터 평소처럼 문을 열어요.${p.hours ? `\n평소 운영 시간: ${p.hours}` : ''}`
      pieces = [
        { tab: '카톡', kind: 'kakao', title: `카톡 · ${label}`, blocks: kakao(`(광고) ${C} 쉬는 날 안내\n\n${hello}\n${body}\n급한 문의: ${p.phone || '[대표 전화]'}${p.channel ? ` · ${p.channel}` : ''}`), notes: [AD_NOTE, HOLIDAY_NOTE] },
        {
          tab: '플레이스 소식',
          kind: 'place',
          title: `플레이스 소식 · ${label}`,
          blocks: [
            { label: '소식 제목', text: `쉬는 날 안내 — ${C}` },
            { label: '내용', text: '[쉬는 날짜]에는 문을 닫아요.\n[다시 여는 날]부터 평소처럼 문을 열어요.' },
            { label: '평소 운영 시간', text: p.hours || '[운영 시간 · 쉬는 날]' },
          ],
          notes: [PLACE_NOTE, HOLIDAY_NOTE],
        },
      ]
      break
    }
    case 'price': {
      const blogTitle = `${kw} 가격 안내 — [바뀌는 날짜]부터 달라져요`
      pieces = [
        {
          tab: '카톡',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(`(광고) ${C} 가격 안내\n\n${hello}\n[바뀌는 날짜]부터 가격이 달라져요.\n• [상품 · 서비스]: [지금 가격] → [새 가격]\n[바뀌는 이유 한 문장 — 예: 재료비 · 인건비]\n[바뀌기 전 예약 · 주문을 어떻게 하는지 — 없으면 이 줄을 지워 주세요]\n\n${phoneLine}`),
          notes: [AD_NOTE, PRICE_NOTE],
        },
        {
          tab: '플레이스 소식',
          kind: 'place',
          title: `플레이스 소식 · ${label}`,
          blocks: [
            { label: '소식 제목', text: `가격 안내 — ${C}` },
            { label: '내용', text: '[바뀌는 날짜]부터 가격이 달라져요.\n• [상품 · 서비스]: [지금 가격] → [새 가격]\n[바뀌는 이유 한 문장]' },
            { label: '문의', text: contactLines(p) },
          ],
          notes: [PLACE_NOTE, PRICE_NOTE],
        },
        {
          tab: '블로그',
          kind: 'blog',
          keyword: true,
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(kw, '을/를')} 찾아 주시는 분들께 미리 알려 드려요. ${C}의 가격이 [바뀌는 날짜]부터 달라져요.`, '가격표 · 매장 모습'),
            { label: '무엇이 달라지나요?', text: '항목 | 지금 | 바뀐 뒤\n[상품 · 서비스] | [지금 가격] | [새 가격]', hint: '표로 넣으면 좋아요' },
            { label: '왜 달라지나요?', text: '[바뀌는 이유 — 솔직하게 한두 문장]' },
            { label: '그대로 지키는 것', text: p.differ || '[가격이 바뀌어도 그대로인 것 — 예: 재료 · 진행 방식]' },
            introBlock,
            cta,
            tags,
          ],
          notes: [PRICE_NOTE],
        },
      ]
      break
    }
    case 'move': {
      const blogTitle = `${kw}, ${C} 새 주소로 옮겨요`
      pieces = [
        {
          tab: '카톡',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(`(광고) ${C} 새 주소 안내\n\n${hello}\n[옮기는 날짜]부터 새 곳에서 문을 열어요.\n새 주소: [새 주소]\n${p.address ? `지금 주소: ${p.address}\n` : ''}찾아오는 길: [가까운 역 · 큰 건물 · 주차]\n\n${phoneLine}`),
          notes: [AD_NOTE, MOVE_NOTE],
        },
        {
          tab: '블로그',
          kind: 'blog',
          keyword: true,
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(kw, '을/를')} 찾아 주시는 분들께 알려 드려요. ${j(C, '이/가')} [옮기는 날짜]부터 새 곳에서 문을 열어요.`, '새 건물 · 간판 · 입구'),
            { label: '새 주소', text: `[새 주소]${p.address ? `\n(지금 주소: ${p.address})` : ''}` },
            { label: '찾아오는 길', text: '[가까운 역 · 버스 정류장에서 오는 길]\n[주차 안내]' },
            { label: '그대로예요', text: `${p.services.length ? bullets(p.services) : `• ${p.item}`}\n• 전화: ${p.phone || '[대표 전화]'}` },
            photo('찾아오는 길 지도 화면'),
            cta,
            tags,
          ],
          notes: [MOVE_NOTE],
        },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(`${C} 새 주소로 옮겨요`, [
            page(1, '표지', '새 주소로 옮겨요', `${C} · [옮기는 날짜]`, '새 건물 · 간판 사진'),
            page(2, '새 주소', '[새 주소]', '[가까운 역 · 큰 건물]', '지도 화면'),
            page(3, '찾아오는 길', '[주차 · 오는 길 한 줄]', '[대중교통 안내]', '입구 · 주차장 사진'),
            page(4, '그대로예요', servicesOr(3), `전화 ${p.phone || '[대표 전화]'}`, at(visuals, 0)),
            last(5),
          ]),
          notes: [MOVE_NOTE],
        },
      ]
      break
    }
    case 'award': {
      const blogTitle = `${C}, [받은 인증 · 상 이름] 소식을 전해요 — ${kw}`
      pieces = [
        {
          tab: '블로그',
          kind: 'blog',
          keyword: true,
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(kw, '을/를')} 찾는 분들께 기쁜 소식을 전해요. ${C}의 새 기록, [받은 인증 · 상 이름] 이야기예요.`, '인증서 · 상패 실제 사진'),
            { label: '어떤 인증 · 상인가요?', text: '[인증 · 상 이름]\n주는 곳: [주는 곳]\n받은 날: [받은 날]\n[무엇을 보고 주는지 한두 문장]' },
            { label: '손님께 좋은 점', text: '[이 인증 · 상이 손님께 어떤 뜻인지 — 사실만 한두 문장]' },
            ...(p.strengths.length ? [{ label: '이런 기록도 있어요', text: bullets(p.strengths) }] : []),
            introBlock,
            cta,
            tags,
          ],
          notes: [AWARD_NOTE],
        },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(`${C} [받은 인증 · 상 이름]`, [
            page(1, '표지', '[받은 인증 · 상 이름]', `${j(C, '이/가')} 받았어요`, '인증서 · 상패 사진 위에 큰 글자'),
            page(2, '어떤 것', '[무엇을 보고 주는지 한 줄]', '주는 곳: [주는 곳] · [받은 날]', '인증 마크'),
            page(3, '손님께 좋은 점', '[손님께 좋은 점 한 줄]', p.differ || '[다른 곳과 다른 점 한 가지]', at(visuals, 0)),
            page(4, '기록', p.strengths[0] ?? '[다른 기록 — 업력 · 진행 건수]', p.strengths.slice(1, 3).join(' · ') || `${C}의 기록`, '숫자 · 인증 마크 강조'),
            last(5),
          ]),
          notes: [AWARD_NOTE],
        },
        {
          tab: '카톡',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(`(광고) ${C} 기쁜 소식\n\n${hello}\n${C}의 새 기록, [받은 인증 · 상 이름] 소식을 전해요.\n주는 곳: [주는 곳] · 받은 날: [받은 날]\n늘 찾아 주신 덕분이에요. 고마워요.\n\n${phoneLine}`),
          notes: [AD_NOTE, AWARD_NOTE],
        },
      ]
      break
    }
    case 'hiring': {
      const tag = (w: string) => `#${w.replace(/\(주\)|㈜|주식회사|\s+|[^\p{L}\p{N}_]/gu, '')}`
      const hireTags = ['채용', '구인', p.area ? `${p.area}채용` : '', p.area ? `${p.area}구인` : '', `${C}채용`].filter(Boolean).map(tag).filter((t, i, all) => t.length > 2 && all.indexOf(t) === i).join(' ')
      const blogTitle = `${C} 함께 일할 분을 찾아요 — [직무]`
      pieces = [
        {
          tab: '블로그',
          kind: 'blog',
          title: blogTitle,
          blocks: [
            ...blogHead(blogTitle, `${j(C, '이/가')} 함께 일할 분을 찾아요. ${introSentence(p)}`, '일하는 곳 · 함께 일하는 모습'),
            { label: '어떤 일인가요?', text: '[직무 이름]\n[하는 일 두세 줄]' },
            { label: '이런 분을 찾아요', text: '[필요한 경험 · 자격]\n[있으면 좋은 것]' },
            { label: '일하는 조건', text: `• 고용 형태: [정규직 · 계약직 · 시간제]\n• 근무 시간: [근무 시간 · 쉬는 날]\n• 급여: [급여 — 최저임금 이상]\n• 근무지: ${p.address || p.region || '[근무지]'}` },
            // 손님에게 하는 약속(차별점)은 채용 글에 넣지 않는다 — 회사 기록만
            ...(p.strengths.length ? [{ label: '우리 회사 소개', text: bullets(p.strengths) }] : []),
            { label: '지원 방법', text: '[지원 방법 — 이메일 · 전화 · 채용 사이트]\n마감: [마감일]' },
            { label: '', text: hireTags, hint: '해시태그' },
          ],
          notes: [HIRING_NOTE],
        },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(
            `${C} 함께 일할 분을 찾아요`,
            [
              page(1, '표지', '함께 일할 분을 찾아요', `${C} · [직무]`, '일하는 모습 사진 위에 큰 글자'),
              page(2, '하는 일', '[하는 일 한 줄]', '[필요한 경험 · 자격]', at(visuals, 0)),
              page(3, '일하는 조건', '[근무 시간 · 급여]', `근무지: ${p.region || p.address || '[근무지]'}`, '사무실 · 매장 사진'),
              page(4, '우리 회사', p.strengths[0] ?? `${p.item} ${lib.placeNoun}`, p.strengths.slice(1, 3).join(' · ') || kindName || C, '함께 일하는 사람들'),
              page(5, '지원 방법', '[지원 방법]', '마감: [마감일]', '연락처 · 지원 주소'),
            ],
            '[지원 방법] · 마감 [마감일]',
            hireTags,
          ),
          notes: [HIRING_NOTE],
        },
      ]
      break
    }
    case 'review': {
      pieces = [
        {
          tab: '카톡 1:1',
          kind: 'kakao',
          title: `카톡 1:1 · ${label}`,
          blocks: kakao(`${hello}\n[고객 이름]님, 지난번에 찾아 주셔서 고마워요.\n괜찮으셨다면 [후기 남기는 곳 — 예: 네이버 플레이스]에 짧은 후기 한 줄 부탁드려요.\n좋았던 점도, 아쉬웠던 점도 솔직하게 적어 주시면 큰 힘이 돼요.\n[후기 남기는 링크]`),
          notes: [ONE_TO_ONE_NOTE, REVIEW_NOTE],
        },
        {
          tab: '카드뉴스',
          kind: 'cards',
          title: `카드뉴스 · ${label}`,
          blocks: cards(`${C} 후기 한 줄 부탁드려요`, [
            page(1, '표지', '후기 한 줄이 큰 힘이 돼요', C, `${at(visuals, 0)} 위에 큰 글자`),
            page(2, '어디에', '[후기 남기는 곳]', '[QR 코드 · 링크]', 'QR 코드 크게'),
            page(3, '이런 이야기', '좋았던 점 · 아쉬웠던 점', '솔직한 이야기가 다른 손님께 도움이 돼요', '말풍선 그림'),
            page(4, '고마워요', '늘 찾아 주셔서 고마워요', `${C} 드림`, at(visuals, 1)),
            last(5),
          ]),
          notes: [REVIEW_NOTE],
        },
      ]
      break
    }
    case 'season': {
      const ts = topicsFor(p, kw, today)
      const t = ts.find((x) => x.type === 'season') ?? ts.find((x) => x.type === 'tips')
      reused = [
        { tab: '카톡', draft: makeDraft(p, { kind: 'kakao', purpose: 'season' }, today) },
        { tab: '블로그', draft: makeDraft(p, { kind: 'blog', keyword: kw, topic: t }, today) },
        { tab: '카드뉴스', draft: makeDraft(p, { kind: 'cards', keyword: kw, topic: t, pages: 5, adType: 'info' }, today) },
      ]
      break
    }
    case 'caseDone': {
      const ts = topicsFor(p, kw, today)
      const t = lib.noCase ? ts.find((x) => x.type === 'intro') : ts.find((x) => x.type === 'case')
      reused = lib.noCase
        ? [
            { tab: '블로그', draft: makeDraft(p, { kind: 'blog', keyword: kw, topic: t }, today) },
            { tab: '짧은 영상', draft: makeDraft(p, { kind: 'shorts', keyword: kw, topic: t, shortLen: '20-30' }, today) },
          ]
        : [
            { tab: '블로그', draft: makeDraft(p, { kind: 'blog', keyword: kw, topic: t }, today) },
            { tab: '짧은 영상', draft: makeDraft(p, { kind: 'shorts', keyword: kw, topic: t, shortLen: '20-30' }, today) },
            { tab: '카드뉴스', draft: makeDraft(p, { kind: 'cards', keyword: kw, topic: t, pages: 5, adType: 'proof' }, today) },
          ]
      break
    }
    case 'thanks': {
      pieces = [
        {
          tab: '카톡 여러 분께',
          kind: 'kakao',
          title: `카톡 · ${label}`,
          blocks: kakao(`(광고) ${C} 고마운 마음을 전해요\n\n${hello}\n늘 ${j(C, '을/를')} 찾아 주셔서 고마워요.\n[올해 있었던 일 한 줄 — 예: 새 서비스 · 이사]\n[감사 혜택이 있다면 한 줄 — 없으면 이 줄을 지워 주세요]\n앞으로도 더 잘 챙겨 드려요.\n\n${phoneLine}`),
          notes: [AD_NOTE],
        },
      ]
      reused = [{ tab: '카톡 1:1', draft: makeDraft(p, { kind: 'kakao', purpose: 'thanks' }, today) }]
      break
    }
  }

  const made = pieces.map((pc) => ({
    tab: pc.tab,
    draft: {
      kind: pc.kind,
      title: applyTone(pc.title, p.tone),
      blocks: pc.blocks.map((b) => ({ ...b, label: applyTone(b.label, p.tone), text: applyTone(b.text, p.tone) })),
      // 채용 글 · 1:1 후기 부탁에는 업종 광고 주의(의료 광고 심의 · 식품 표시 등)를 달지 않는다
      notes: lib.caution && key !== 'hiring' && key !== 'review' ? [...pc.notes, lib.caution] : pc.notes,
      input: { variant: 0, tone: p.tone, situation: key, ...(pc.keyword ? { keyword: kw } : {}), ...(pc.kind === 'blog' ? { blogType: 'brand' as const } : {}) },
    } satisfies Draft,
  }))
  const again = reused.map((r) => ({ tab: r.tab, draft: { ...r.draft, input: { ...r.draft.input, situation: key } } }))
  // 화면 탭 순서 = situation.tabs
  const all: { tab: string; draft: Draft }[] = [...made, ...again]
  const items = situation.tabs.map((t) => all.find((x) => x.tab === t)).filter((x): x is { tab: string; draft: Draft } => !!x)
  return { situation, items }
}
