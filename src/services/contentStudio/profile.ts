/**
 * 업체 홍보 정보 (D-203) — 모든 홍보 글이 같이 쓰는 한 장.
 *
 * 업체 기록(확인된 사실만 · usableFactValue)에서 저절로 채우고, 사람이 고친 칸(overrides)이 있으면 그것이 이긴다.
 * 강점은 사실로만 만든다(업력 · 직원 수 · 인증 · 특허 · 연구소) — 지어낸 자랑은 넣지 않는다.
 * 홈페이지(D-202)를 만들어 두었으면 그 '하는 일' 목록(견본 표시가 없는 것)을 하는 일로 쓴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { industryOf } from '../siteBuilder/industry'
import { siteFacts, type SitePromo } from '../siteBuilder/draft'
import type { IndustryKey, SiteDoc } from '../siteBuilder/types'
import { contentLib } from './library'
import type { Tone } from './tone'

export interface ContentProfile {
  company: string
  industry: IndustryKey
  /** 대표 상품 · 서비스(짧게) — 키워드의 가운데 말 */
  item: string
  services: string[]
  /** '경기 화성시' */
  region: string
  /** 키워드용 짧은 지역 '화성' */
  area: string
  target: string
  /** 사실에서 만든 강점 + 사람이 더한 것 */
  strengths: string[]
  phone: string
  address: string
  homepage: string
  hours: string
  tone: Tone
  /** 설립 연도(없으면 '') */
  since: string
  years: number | null
  /** D-207 차별점 — 다른 곳과 다른 점(사람이 적은 것만 · 없으면 '') */
  differ: string
  /** 판매 채널 — 매장 · 온라인 · 방문 …(사람이 적은 것만) */
  channel: string
  /** 손님이 가장 많이 망설이는 점(사람이 적은 것만) — 카드뉴스 '망설임 풀기' 에 */
  objection: string
  /**
   * D-228 '재료' — 공식은 사실을 먹고 산다(이상한AI 3차 관찰: 재료가 없으면 도구가 숫자 · 후기 · 혜택을 지어낸다).
   * 사람이 적은 것만 쓰고, 없으면 글에 [대괄호] 로 비워 둔다. 우리는 지어내지 않는다.
   */
  /** 후기 수 · 평점('네이버 후기 1,240개 · 평점 4.8') */
  reviews: string
  /**
   * D-234 후기 출처('자사몰' · '매장 방명록' · '네이버 플레이스') — 규칙집 ⟲4차 2-3:
   * 출처가 없으면 다른 도구가 후기 위치를 지어내거나 계정 업체의 판매 플랫폼 이름을 넣었다.
   */
  reviewSource: string
  /** 실제 고객 한마디(고객 동의를 받은 말) */
  voice: string
  /** 이번 달 혜택 — 기한이 지났으면 '' (지난 혜택을 글에 쓰지 않는다) */
  offer: string
  /** 혜택 기한 YYYY-MM-DD(없으면 '') */
  offerUntil: string
  /** 기한이 지나 쓰지 않은 혜택(화면 안내용 · 글에는 안 씀) */
  offerExpired: string
  /** 가격 · 배송 · 이용 조건('1인분 6,500원 · 3만 원 이상 무료 배송') */
  price: string
  /** 글을 말하는 사람('대표 김한솔' · 'MD 지은') — 없으면 이름을 쓰지 않는다 */
  speaker: string
  /**
   * D-229 콘텐츠 작성 규칙집(1~3차 관찰 합본) 브리프 칸 —
   * 흔한 반박 1개(걱정과 함께 모든 글의 출발점) · 배송 · 교환 조건(사실 목록) · 넣지 말 것(업체가 따로 막은 말).
   */
  rebuttal: string
  shipping: string
  avoid: string[]
}

/** 사람이 고친 칸 — 비어 있지 않은 것만 저장한다 */
export interface ProfileOverrides {
  industry?: IndustryKey
  item?: string
  services?: string[]
  area?: string
  target?: string
  extraStrengths?: string[]
  phone?: string
  hours?: string
  tone?: Tone
  /** D-207 */
  differ?: string
  channel?: string
  objection?: string
  /** D-228 재료 */
  reviews?: string
  /** D-234 */
  reviewSource?: string
  voice?: string
  offer?: string
  offerUntil?: string
  price?: string
  speaker?: string
  /** D-229 */
  rebuttal?: string
  shipping?: string
  avoid?: string
}

export interface ProfileSource {
  /** 이 칸이 어디서 왔나 — 화면에 '업체 기록' · '직접 적음' · '업종 견본' */
  item: 'record' | 'override' | 'industry' | 'site'
  services: 'record' | 'override' | 'site' | 'none'
  target: 'override' | 'industry'
}

const SPLIT = /\s*(?:[,，、·;\n/]|그리고|및)\s*/

function listOf(text: string): string[] {
  return text
    .split(SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length <= 40)
    .filter((s, i, all) => all.indexOf(s) === i)
}

/** '경기 화성시' → '화성' · '서울 강남구' → '강남' · '세종' → '세종' */
export function areaOf(region: string): string {
  const parts = region.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  const last = parts[parts.length - 1]
  if (parts.length >= 2 && /[시군구]$/.test(last) && last.length >= 3) return last.slice(0, -1)
  return last
}

/** 종목 글에서 키워드로 쓸 짧은 말 하나 */
export function shortItemOf(item: string): string {
  const first = listOf(item)[0] ?? ''
  // '전자부품 제조업' → '전자부품 제조' · 너무 길면 버린다
  const cleaned = first.replace(/(업|사업)$/, '').trim()
  return cleaned && cleaned.length <= 16 ? cleaned : ''
}

export function industryForContent(record: ClientOpsRecord, today: string): IndustryKey {
  if (record.clientType === 'consultant') return 'consultant'
  const f = siteFacts(record, today)
  return industryOf(f.category, f.item, record.industry ?? '')
}

/** 홈페이지의 '하는 일' — 견본 표시가 없는 것만(업체와 확인한 글) */
export function servicesFromSite(site: SiteDoc | null | undefined): string[] {
  const b = site?.blocks.find((x) => x.type === 'services')
  if (!b || b.sample?.includes('items') || !Array.isArray(b.props.items)) return []
  return b.props.items
    .map((it) => (typeof it.name === 'string' ? it.name.trim() : ''))
    .filter((n) => n.length > 1 && n.length <= 40)
    .slice(0, 6)
}

export function strengthsFromRecord(record: ClientOpsRecord, today: string): string[] {
  const f = siteFacts(record, today)
  const out: string[] = []
  if (f.years !== null && f.years >= 1) out.push(`설립 ${f.years}년째`)
  if (f.employees !== null && f.employees >= 5) out.push(`직원 ${f.employees}명`)
  for (const c of f.certifications.slice(0, 4)) out.push(/인증|확인|지정|선정/.test(c) ? c : `${c} 인증`)
  if (f.researchLab) out.push('기업부설연구소')
  if (f.patents.length) out.push(`특허 ${f.patents.length}건`)
  return out
}

export function buildProfile(record: ClientOpsRecord, today: string, ov: ProfileOverrides = {}, site?: SiteDoc | null): { profile: ContentProfile; source: ProfileSource } {
  const f = siteFacts(record, today)
  const industry = ov.industry ?? industryOf(f.category, f.item, record.industry ?? '')
  const lib = contentLib(industry)
  const recordItem = shortItemOf(f.item)
  const siteServices = servicesFromSite(site)
  const recordServices = listOf(f.item)

  const item = ov.item?.trim() || recordItem || lib.keywordItem
  const itemSource: ProfileSource['item'] = ov.item?.trim() ? 'override' : recordItem ? 'record' : 'industry'
  const services = ov.services?.length ? ov.services : siteServices.length ? siteServices : recordServices.length >= 2 ? recordServices.slice(0, 6) : []
  const servicesSource: ProfileSource['services'] = ov.services?.length ? 'override' : siteServices.length ? 'site' : recordServices.length >= 2 ? 'record' : 'none'
  const strengths = [...strengthsFromRecord(record, today), ...(ov.extraStrengths ?? []).map((s) => s.trim()).filter(Boolean)].filter((s, i, all) => all.indexOf(s) === i).slice(0, 8)
  // D-228 혜택은 기한이 지나면 쓰지 않는다(지난 혜택을 '이번 달' 로 알리면 거짓 광고)
  const offerUntil = /^\d{4}-\d{2}-\d{2}$/.test(ov.offerUntil ?? '') ? (ov.offerUntil as string) : ''
  const offerText = ov.offer?.trim() ?? ''
  const expired = !!offerText && !!offerUntil && offerUntil < today

  return {
    profile: {
      company: f.companyName || record.companyName.trim() || '우리 회사',
      industry,
      item,
      services,
      region: f.region,
      area: ov.area?.trim() || areaOf(f.region),
      target: ov.target?.trim() || lib.target,
      strengths,
      phone: ov.phone?.trim() || f.phone,
      address: f.address,
      homepage: (record.homepage ?? '').trim(),
      hours: ov.hours?.trim() ?? '',
      tone: ov.tone ?? 'friendly',
      since: /^(\d{4})/.exec(f.establishedAt)?.[1] ?? '',
      years: f.years,
      differ: ov.differ?.trim() ?? '',
      channel: ov.channel?.trim() ?? '',
      objection: ov.objection?.trim() ?? '',
      reviews: ov.reviews?.trim() ?? '',
      reviewSource: ov.reviewSource?.trim() ?? '',
      voice: (ov.voice?.trim() ?? '').replace(/^["“”'‘’]+|["“”'‘’]+$/g, ''),
      offer: expired ? '' : offerText,
      offerUntil: expired ? '' : offerUntil,
      offerExpired: expired ? offerText : '',
      price: ov.price?.trim() ?? '',
      speaker: ov.speaker?.trim() ?? '',
      rebuttal: (ov.rebuttal?.trim() ?? '').replace(/^["“”'‘’]+|["“”'‘’]+$/g, ''),
      shipping: ov.shipping?.trim() ?? '',
      avoid: (ov.avoid ?? '')
        .split(/\s*[,，·\n]\s*/)
        .map((x) => x.trim())
        .filter((x) => x.length >= 2)
        .slice(0, 12),
    },
    source: { item: itemSource, services: servicesSource, target: ov.target?.trim() ? 'override' : 'industry' },
  }
}

/** 저장된 고친 칸 읽기 — 모르는 칸 · 이상한 값은 버린다 */
export function normalizeOverrides(raw: unknown): ProfileOverrides {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const list = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 8)
      : undefined
  const keys: IndustryKey[] = ['manufacturing', 'it', 'trade', 'food', 'health', 'professional', 'education', 'construction', 'design', 'consultant', 'general']
  const out: ProfileOverrides = {}
  if (typeof r.industry === 'string' && (keys as string[]).includes(r.industry)) out.industry = r.industry as IndustryKey
  const item = str(r.item, 30)
  if (item) out.item = item
  const services = list(r.services)
  if (services?.length) out.services = services
  const area = str(r.area, 20)
  if (area) out.area = area
  const target = str(r.target, 60)
  if (target) out.target = target
  const extra = list(r.extraStrengths)
  if (extra?.length) out.extraStrengths = extra
  const phone = str(r.phone, 30)
  if (phone) out.phone = phone
  const hours = str(r.hours, 60)
  if (hours) out.hours = hours
  if (r.tone === 'formal' || r.tone === 'friendly') out.tone = r.tone
  const differ = str(r.differ, 200)
  if (differ) out.differ = differ
  const channel = str(r.channel, 60)
  if (channel) out.channel = channel
  const objection = str(r.objection, 120)
  if (objection) out.objection = objection
  const reviews = str(r.reviews, 60)
  if (reviews) out.reviews = reviews
  const reviewSource = str(r.reviewSource, 60)
  if (reviewSource) out.reviewSource = reviewSource
  const voice = str(r.voice, 120)
  if (voice) out.voice = voice
  const offer = str(r.offer, 80)
  if (offer) out.offer = offer
  if (typeof r.offerUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.offerUntil)) out.offerUntil = r.offerUntil
  const price = str(r.price, 80)
  if (price) out.price = price
  const speaker = str(r.speaker, 30)
  if (speaker) out.speaker = speaker
  const rebuttal = str(r.rebuttal, 120)
  if (rebuttal) out.rebuttal = rebuttal
  const shipping = str(r.shipping, 80)
  if (shipping) out.shipping = shipping
  const avoid = str(r.avoid, 200)
  if (avoid) out.avoid = avoid
  return out
}

/** D-237 홈페이지 초안에 넘길 홍보 정보 — 사람이 적은 칸만(전화 · 영업시간 · 후기 수 · 받은 곳 · 고객 한마디) */
export function promoForSite(raw: unknown): SitePromo {
  const clean = normalizeOverrides(raw)
  return { phone: clean.phone, hours: clean.hours, reviews: clean.reviews, reviewSource: clean.reviewSource, voice: clean.voice }
}

/**
 * D-207 '이 칸만 채우면 글이 좋아져요' — 글 곳곳의 [대괄호] 를 줄이는 칸(마케팅의 핵심은 차별점을 손님 눈높이로 전하는 것).
 * 중요한 순서대로. 화면은 첫 몇 개만 보여 준다.
 */
/** 후기 칸에 이미 어디 후기인지 적혀 있으면('네이버 후기 1,240개') 출처를 또 묻지 않는다 */
const REVIEW_PLACE_IN = /네이버|플레이스|스마트\s*스토어|구글|카카오|당근|쿠팡|배민|배달의\s*민족|요기요|인스타|자사몰|홈페이지|매장|오늘의\s*집|아이디어스|크몽|숨고|11번가|지마켓/
export function reviewPlaceIn(reviews: string): boolean {
  return REVIEW_PLACE_IN.test(reviews)
}

export type GapKey = 'differ' | 'phone' | 'services' | 'hours' | 'objection' | 'speaker' | 'reviews' | 'reviewSource' | 'voice' | 'offer' | 'price'

/** D-234 규칙집 0-12 — 가격에 숫자는 있는데 단위(1회 · 월 · 공임 · 1인분 · 개 · 부터 …)가 없으면 다른 도구가 '월 N원' 처럼 바꿔 썼다 */
export function priceWithoutUnit(price: string): boolean {
  return /\d/.test(price) && !/월|회|공임|별도|인분|인당|1인|개|세트|박스|kg|ml|g\b|시간|박|부터|평|건|장|당|병|송이|다발|코스|부가세|VAT|분|년|주/i.test(price)
}

export function profileGaps(p: ContentProfile): { key: GapKey; label: string; why: string }[] {
  const out: { key: GapKey; label: string; why: string }[] = []
  if (!p.differ) out.push({ key: 'differ', label: '차별점', why: '다른 곳과 다른 점 한 가지 — 모든 글의 중심이에요' })
  if (!p.phone) out.push({ key: 'phone', label: '대표 전화', why: '글 끝 문의 칸 · 카톡 · 플레이스에 들어가요' })
  if (!p.services.length) out.push({ key: 'services', label: '하는 일', why: '소개 · 플레이스 · 해시태그에 들어가요' })
  if (!p.hours) out.push({ key: 'hours', label: '운영 시간', why: '문의 칸 · 플레이스 이용 안내에 들어가요' })
  if (!p.objection) out.push({ key: 'objection', label: '손님이 망설이는 점', why: '카드뉴스 · 블로그에서 그 걱정을 먼저 풀어 줘요' })
  // D-229 규칙집 0-4 — 화자는 직함과 이름을 둘 다(직함만 적으면 엉뚱한 실명이 붙을 수 있다)
  if (!p.speaker) out.push({ key: 'speaker', label: '글에서 말하는 사람', why: '직함과 이름을 같이 — 작성자 소개 · 영상 마무리에 들어가요' })
  else if (TITLE_ONLY.test(p.speaker)) out.push({ key: 'speaker', label: '말하는 사람 이름', why: `'${p.speaker}' 처럼 직함만 적으면 다른 도구가 엉뚱한 실명을 붙일 수 있어요 — 이름도 적어 주세요` })
  // D-228 재료 — 없으면 숫자 · 후기 · 혜택 자리를 [대괄호] 로 비워 둬요(지어내지 않음)
  if (!p.reviews) out.push({ key: 'reviews', label: '후기 수 · 평점', why: '카드뉴스 첫 장 · 블로그 소개 표에 믿음을 주는 숫자로 들어가요' })
  // D-234 규칙집 ⟲4차 — 후기 출처 · 가격 단위가 비면 다른 도구가 지어내거나 바꿔 쓴다
  else if (!p.reviewSource && !reviewPlaceIn(p.reviews)) out.push({ key: 'reviewSource', label: '후기 출처', why: '자사몰 · 매장 · 플레이스처럼 — 비우면 다른 도구가 후기 위치를 지어내거나 다른 플랫폼 이름을 넣어요' })
  if (p.price && priceWithoutUnit(p.price)) out.push({ key: 'price', label: '가격 단위', why: `'${p.price}' 에 단위가 없어요 — '1회' · '월' · '공임' 처럼 적지 않으면 '월 ○원' 같은 오해 문구가 나와요` })
  if (!p.voice) out.push({ key: 'voice', label: '실제 고객 한마디', why: '카드뉴스 · 블로그에 고객의 말로 들어가요(동의 받은 말만)' })
  // 기한 지난 혜택은 맨 앞에 — 날짜가 걸린 일이라 위 3개 안에 보여야 한다
  if (p.offerExpired) out.unshift({ key: 'offer', label: '이번 달 혜택', why: `적어 둔 혜택("${p.offerExpired}")의 기한이 지났어요 — 새 기한을 적거나 지워 주세요` })
  return out
}

/** D-229 직함만 적은 화자('대표' · '원장') */
const TITLE_ONLY = /^(?:대표|대표님|원장|원장님|실장|팀장|이사|사장|소장|관장|점장|매니저|디자이너|선생님|강사|MD)$/

/**
 * D-229 규칙집 0장 — 브리프 6칸(업체 / 독자 / 알리는 것 / 화자+이름 / 사실 목록 / 넣지 말 것).
 * '넣지 말 것' 은 기본 금지 목록이 늘 붙으므로 비지 않는다. 독자가 업종 견본이면 채운 것으로 세되 '견본' 이라고 알린다.
 * D-234 규칙집 ⟲4차 — 7칸(+ 구매·문의처): 구매처가 비면 다른 도구가 계정 기본 업체의 판매 플랫폼 이름으로 채웠다(꽃집 카드 5/5).
 */
export interface BriefSlot {
  key: 'company' | 'target' | 'item' | 'speaker' | 'facts' | 'contact' | 'avoid'
  label: string
  ok: boolean
  note: string
}

/** 재료(사실 목록) — 경력 · 후기 · 고객 한마디 · 혜택 · 가격 · 배송 · 교환 · 그 밖의 기록(증빙 있는 것) */
export function materialList(p: ContentProfile): string[] {
  return [
    p.years !== null && p.years >= 1 ? `경력 ${p.years}년` : '',
    p.reviews ? (p.reviewSource ? `${p.reviews} (후기 출처: ${p.reviewSource})` : p.reviews) : '',
    p.voice,
    p.offer,
    p.price,
    p.shipping,
    p.differ,
    ...p.strengths.filter((s) => !/^설립 \d+년째$/.test(s)),
  ].filter(Boolean)
}

/** D-234 구매·문의처 — 실제로 받을 곳(전화 · 판매 채널 · 홈페이지 · 주소) */
export function contactOf(p: ContentProfile): string[] {
  return [p.phone, p.channel, p.homepage, p.address].map((x) => x.trim()).filter(Boolean)
}

/** 규칙집 0-5 — 재료 7개 이상이면 카드 5안 · 영상 5자리가 서로 다른 각도로 산다 */
export const MATERIAL_GOAL = 7

export function briefSlots(p: ContentProfile, source: ProfileSource): BriefSlot[] {
  const facts = materialList(p).length
  return [
    { key: 'company', label: '업체', ok: true, note: p.region ? `${p.company} · ${p.region}` : p.company },
    { key: 'target', label: '독자', ok: true, note: source.target === 'override' ? p.target : `업종 견본 — ${p.target}` },
    { key: 'item', label: '알리는 것', ok: source.item !== 'industry', note: source.item === 'industry' ? '업종 말뿐이에요 — 대표 상품을 적어 주세요' : p.item },
    { key: 'speaker', label: '화자 · 이름', ok: !!p.speaker && !TITLE_ONLY.test(p.speaker), note: !p.speaker ? '비어 있어요' : TITLE_ONLY.test(p.speaker) ? '직함만 있어요 — 이름도' : p.speaker },
    { key: 'facts', label: '사실 목록', ok: facts >= 1, note: `재료 ${facts}/${MATERIAL_GOAL}` },
    { key: 'contact', label: '구매·문의처', ok: contactOf(p).length > 0, note: contactOf(p).join(' · ') || '비어 있어요 — 전화 · 매장 · 링크 중 하나' },
    { key: 'avoid', label: '넣지 말 것', ok: true, note: p.avoid.length ? `기본 금지 + 업체가 막은 것 ${p.avoid.length}개` : '기본 금지 목록' },
  ]
}
