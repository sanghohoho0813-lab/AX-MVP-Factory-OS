/**
 * 디자인 한 번에 · 홈페이지 점수 · 업종 맞춤 블록 (D-208).
 *
 * 초보자는 색 · 글꼴 · 모서리 · 블록 모양 · 바탕을 하나씩 맞추기 어렵다. 그래서 '스타일' 하나를 누르면 그 묶음이 한꺼번에 바뀐다
 * (꾸밈 + 첫 화면 모양 + 사업 카드 모양 + 숫자 띠 + 블록 바탕 흐름). 글 · 사진 · 순서는 건드리지 않는다. 되돌리기 한 번이면 그 전으로.
 *
 * 점수(100점)는 '손님이 믿고 연락하기까지' 필요한 것을 우리 기준으로 센 것이다(검색 순위 점수가 아니다).
 * 빠진 것 중 점수가 큰 것부터 '이것만 하면 +n점' 으로 보여 주고, 누르면 그 블록 · 탭을 연다.
 * 업종 맞춤 블록: 업종마다 손님이 먼저 보고 싶어 하는 것(공사 사진 · 후기 · 거래처)을 아직 없으면 [넣기] 로 권한다.
 */
import { blockDef } from './blocks'
import { hasContent, httpsHref, safeImage } from './render'
import type { BlockType, CornerKey, FontKey, IndustryKey, ListItem, PaletteKey, PropValue, SiteBlock, SiteDoc } from './types'

const str = (v: PropValue | undefined): string => (typeof v === 'string' ? v.trim() : '')
const list = (v: PropValue | undefined): ListItem[] => (Array.isArray(v) ? v : [])

/* ------------------------------------------------------------------ */
/* 스타일 6가지                                                          */
/* ------------------------------------------------------------------ */

export type StyleKey = 'trust' | 'nature' | 'modern' | 'premium' | 'warm' | 'bold'

export interface StylePreset {
  key: StyleKey
  label: string
  hint: string
  palette: PaletteKey
  font: FontKey
  corner: CornerKey
  /** 첫 화면 모양 — 'photo' 는 사진이 있을 때만(없으면 색 바탕) */
  hero: 'split' | 'band' | 'photo'
  heroAlign: 'left' | 'center'
  services: 'icons' | 'rows' | 'plain'
  numbers: 'band' | 'plain'
  gallery: 'grid' | 'zigzag'
  /** 블록 바탕 — 적지 않은 블록은 '자동'(흰 · 옅은 번갈아). 진한 바탕은 두 곳까지(점검 'dark' 기준) */
  bg: Partial<Record<BlockType, string>>
}

export const STYLE_PRESETS: StylePreset[] = [
  { key: 'trust', label: '믿음직한 회사', hint: '남색 · 각진 카드 · 번호 줄 — 전문 서비스 · 무역', palette: 'navy', font: 'sans', corner: 'square', hero: 'split', heroAlign: 'left', services: 'rows', numbers: 'band', gallery: 'grid', bg: { certs: 'gray' } },
  { key: 'nature', label: '자연스러운', hint: '숲색 · 둥근 카드 · 옅은 색 바탕 — 제조 · 농식품', palette: 'forest', font: 'sans', corner: 'round', hero: 'split', heroAlign: 'left', services: 'icons', numbers: 'plain', gallery: 'grid', bg: { about: 'tint', process: 'tint' } },
  { key: 'modern', label: '산뜻한', hint: '바다색 · 아이콘 카드 · 색 띠 숫자 — IT · 의료', palette: 'ocean', font: 'sans', corner: 'round', hero: 'band', heroAlign: 'left', services: 'icons', numbers: 'band', gallery: 'grid', bg: {} },
  { key: 'premium', label: '고급스러운', hint: '와인색 · 명조 · 가운데 맞춤 — 뷰티 · 법률 · 디자인', palette: 'wine', font: 'serif', corner: 'square', hero: 'band', heroAlign: 'center', services: 'plain', numbers: 'plain', gallery: 'zigzag', bg: { reviews: 'dark' } },
  { key: 'warm', label: '따뜻한 가게', hint: '노을색 · 아주 둥근 · 사진 크게 — 음식 · 카페 · 교육', palette: 'sunset', font: 'sans', corner: 'pill', hero: 'photo', heroAlign: 'left', services: 'icons', numbers: 'plain', gallery: 'zigzag', bg: { about: 'tint' } },
  { key: 'bold', label: '강한 인상', hint: '먹색 · 각지게 · 진한 띠 — 건설 · 인테리어', palette: 'charcoal', font: 'sans', corner: 'square', hero: 'photo', heroAlign: 'left', services: 'rows', numbers: 'band', gallery: 'zigzag', bg: { process: 'dark' } },
]

/** 업종에 먼저 권하는 스타일 */
export const INDUSTRY_STYLE: Record<IndustryKey, StyleKey> = {
  manufacturing: 'nature',
  it: 'modern',
  trade: 'trust',
  food: 'warm',
  health: 'modern',
  professional: 'trust',
  education: 'warm',
  construction: 'bold',
  design: 'premium',
  general: 'trust',
}

export function stylePreset(key: string): StylePreset | null {
  return STYLE_PRESETS.find((s) => s.key === key) ?? null
}

/** 지금 꾸밈(색 · 글꼴 · 모서리)과 같은 스타일 — 고른 표시용(블록 모양까지는 보지 않는다) */
export function currentStyle(doc: SiteDoc): StyleKey | null {
  return STYLE_PRESETS.find((s) => s.palette === doc.theme.palette && s.font === doc.theme.font && s.corner === doc.theme.corner)?.key ?? null
}

const hasField = (t: BlockType, key: string) => !!blockDef(t)?.fields.some((f) => f.key === key)

/** 스타일 한 번에 — 새 문서를 돌려준다(되돌리기 한 번에 그 전으로) */
export function applyStylePreset(doc: SiteDoc, key: StyleKey, now: string): SiteDoc {
  const s = stylePreset(key)
  if (!s) return doc
  const blocks = doc.blocks.map((b): SiteBlock => {
    const props = { ...b.props }
    if (b.type === 'hero') {
      props.layout = s.hero === 'photo' && !safeImage(str(b.props.image)) ? 'band' : s.hero
      props.align = s.heroAlign
    }
    if (b.type === 'services') props.layout = s.services
    if (b.type === 'numbers') props.layout = s.numbers
    if (b.type === 'gallery') props.layout = s.gallery
    if (hasField(b.type, 'bg')) props.bg = s.bg[b.type] ?? 'auto'
    return { ...b, props }
  })
  return { ...doc, theme: { palette: s.palette, font: s.font, corner: s.corner }, blocks, updatedAt: now }
}

/* ------------------------------------------------------------------ */
/* 홈페이지 점수                                                          */
/* ------------------------------------------------------------------ */

export interface ScoreItem {
  key: string
  label: string
  /** 채우면 받는 점수 */
  points: number
  done: boolean
  /** 아직이면 무엇을 하면 되는지 한 줄 */
  how: string
  /** 누르면 열 곳 — 블록(있으면) · 꾸밈 탭 · 블록 더하기 */
  open: { blockId?: string; tab?: 'style'; add?: BlockType }
}

export interface SiteScore {
  score: number
  items: ScoreItem[]
  /** 아직인 것 중 점수가 큰 셋 */
  next: ScoreItem[]
}

export function siteScore(doc: SiteDoc): SiteScore {
  const find = (t: BlockType) => doc.blocks.find((b) => b.type === t && !(b.hidePc && b.hideMobile))
  const live = (t: BlockType) => {
    const b = find(t)
    return b && hasContent(b) ? b : undefined
  }
  const notSample = (b: SiteBlock | undefined, key: string) => !!b && !b.sample?.includes(key)
  const hero = find('hero')
  const about = find('about')
  const services = find('services')
  const contact = find('contact')
  const footer = find('footer')
  const gallery = live('gallery')
  const phone = str(contact?.props.phone) || str(footer?.props.phone)
  const address = str(contact?.props.address) || str(footer?.props.address)
  const photos = [safeImage(str(hero?.props.image)), safeImage(str(about?.props.image)), ...list(gallery?.props.items).map((it) => safeImage(str(it.image)))].filter(Boolean).length
  const trust = (['certs', 'numbers', 'reviews', 'logos', 'history'] as BlockType[]).filter((t) => live(t)).length
  const samples = doc.blocks.filter((b) => b.sample?.length && hasContent(b) && !(b.hidePc && b.hideMobile))
  const kakaoOrForm = !!contact && (!!httpsHref(str(contact.props.kakaoUrl)) || !!httpsHref(str(contact.props.formUrl)))

  const items: ScoreItem[] = [
    { key: 'hero', label: '첫 화면 큰 문구 · 설명', points: 12, done: !!hero && !!str(hero.props.title) && notSample(hero, 'title') && !!str(hero.props.subtitle), how: '무엇을 하는 회사인지 한 줄 + 설명 한두 줄을 업체 말로 적어요.', open: hero ? { blockId: hero.id } : { add: 'hero' } },
    { key: 'button', label: '첫 화면 문의 단추', points: 5, done: !!hero && !!str(hero.props.buttonLabel), how: "첫 화면에 '문의하기' 같은 단추를 달아요.", open: hero ? { blockId: hero.id } : { add: 'hero' } },
    { key: 'about', label: '회사 소개 글(업체 말)', points: 10, done: !!about && hasContent(about) && notSample(about, 'body'), how: '견본 소개 글을 업체가 하는 말로 고치거나 확인해요.', open: about ? { blockId: about.id } : { add: 'about' } },
    { key: 'services', label: '사업 · 서비스 3개 이상', points: 10, done: !!services && notSample(services, 'items') && list(services.props.items).filter((it) => str(it.name)).length >= 3, how: '하는 일을 세 가지 이상, 업체가 쓰는 이름으로 적어요.', open: services ? { blockId: services.id } : { add: 'services' } },
    { key: 'photos', label: '실제 사진 3장 이상', points: 15, done: photos >= 3, how: `실제 사진이 ${photos}장이에요 — 첫 화면 · 회사 소개 · 사진 모음에 올려요.`, open: gallery ? { blockId: gallery.id } : hero ? { blockId: hero.id } : { add: 'gallery' } },
    { key: 'trust', label: '믿음을 주는 기록(인증 · 숫자 · 후기 · 거래처 · 연혁)', points: 12, done: trust >= 1, how: '인증 · 숫자 · 후기 · 거래처 · 연혁 중 하나를 채워요.', open: { add: 'reviews' } },
    { key: 'contact', label: '전화 · 주소', points: 12, done: !!phone && !!address, how: !phone ? '대표 전화를 적어요.' : '주소를 적어요.', open: contact ? { blockId: contact.id } : footer ? { blockId: footer.id } : { add: 'contact' } },
    { key: 'kakao', label: '카카오톡 · 상담 신청서 연결', points: 5, done: kakaoOrForm, how: '연락처 블록에 카카오톡 채널이나 상담 신청서 주소(https://)를 넣어요.', open: contact ? { blockId: contact.id } : { add: 'contact' } },
    { key: 'floatbar', label: '휴대폰 아래 고정 단추', points: 4, done: !!contact && contact.props.floatBar === true && !!phone, how: "연락처 블록의 '휴대폰 아래 고정 단추' 를 켜요(대표 전화가 있어야 해요).", open: contact ? { blockId: contact.id } : { add: 'contact' } },
    { key: 'sample', label: '견본 문구 모두 확인', points: 10, done: samples.length === 0, how: `견본 그대로인 블록이 ${samples.length}개예요 — 업체와 확인해 고치거나 [업체와 확인했어요] 를 눌러요.`, open: samples[0] ? { blockId: samples[0].id } : {} },
    { key: 'seo', label: '검색에 보일 제목 · 설명', points: 5, done: doc.seo.title.trim().length >= 4 && doc.seo.description.trim().length >= 20, how: '꾸밈 탭에서 검색 제목과 설명(20자 이상)을 적어요.', open: { tab: 'style' } },
  ]
  const score = items.reduce((s, it) => s + (it.done ? it.points : 0), 0)
  const next = items.filter((it) => !it.done).sort((a, b) => b.points - a.points).slice(0, 3)
  return { score, items, next }
}

/* ------------------------------------------------------------------ */
/* 업종 맞춤 블록                                                         */
/* ------------------------------------------------------------------ */

export interface BlockSuggestion {
  type: BlockType
  why: string
}

const SUGGEST: Record<IndustryKey, BlockSuggestion[]> = {
  manufacturing: [
    { type: 'logos', why: '납품한 거래처 로고는 구매 담당자가 가장 먼저 보는 믿음이에요.' },
    { type: 'gallery', why: '설비 · 완성품 사진이 있으면 무엇을 만드는지 한눈에 보여요.' },
    { type: 'history', why: '업력 · 인증을 받은 해를 연혁으로 보여 주면 오래된 회사인 게 드러나요.' },
  ],
  it: [
    { type: 'logos', why: '함께한 고객사 로고가 있으면 처음 보는 손님도 믿어요.' },
    { type: 'reviews', why: '고객이 남긴 한 줄이 기능 설명보다 오래 남아요.' },
  ],
  trade: [
    { type: 'logos', why: '거래처 · 브랜드 로고가 무역 회사의 실력이에요.' },
    { type: 'history', why: '수출입 연혁이 믿음을 줘요.' },
  ],
  food: [
    { type: 'gallery', why: '메뉴 사진이 있어야 손님이 먹고 싶어져요.' },
    { type: 'reviews', why: '방문 손님 후기가 처음 오는 손님의 망설임을 줄여요.' },
  ],
  health: [{ type: 'faq', why: '진료 · 예약 질문에 미리 답하면 전화가 줄어요(후기는 의료 광고 규정 때문에 권하지 않아요).' }],
  professional: [
    { type: 'reviews', why: '맡겼던 고객의 한마디가 전문가를 고르는 가장 큰 이유예요.' },
    { type: 'process', why: '진행 순서를 보여 주면 처음 맡기는 분도 안심해요.' },
  ],
  education: [
    { type: 'reviews', why: '수강생 · 학부모 후기가 등록을 망설이는 마음을 풀어 줘요.' },
    { type: 'gallery', why: '수업 · 공간 사진으로 분위기를 보여 줘요.' },
  ],
  construction: [
    { type: 'gallery', why: '시공 전 · 후 사진이 가장 큰 영업 자료예요.' },
    { type: 'reviews', why: '시공을 맡겼던 고객의 후기가 계약을 앞당겨요.' },
  ],
  design: [
    { type: 'gallery', why: '작업물 사진이 곧 실력이에요.' },
    { type: 'logos', why: '함께한 브랜드 로고가 믿음을 줘요.' },
  ],
  general: [{ type: 'reviews', why: '고객 후기가 처음 보는 손님의 믿음을 만들어요.' }],
}

/** 이 업종에 아직 없는 블록만 — 이미 있으면(비어 있어도) 권하지 않는다 */
export function blockSuggestions(doc: SiteDoc): BlockSuggestion[] {
  return SUGGEST[doc.industry].filter((s) => !doc.blocks.some((b) => b.type === s.type))
}
