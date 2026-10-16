/**
 * 업체 홍보 정보 (D-203) — 모든 홍보 글이 같이 쓰는 한 장.
 *
 * 업체 기록(확인된 사실만 · usableFactValue)에서 저절로 채우고, 사람이 고친 칸(overrides)이 있으면 그것이 이긴다.
 * 강점은 사실로만 만든다(업력 · 직원 수 · 인증 · 특허 · 연구소) — 지어낸 자랑은 넣지 않는다.
 * 홈페이지(D-202)를 만들어 두었으면 그 '하는 일' 목록(견본 표시가 없는 것)을 하는 일로 쓴다.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { industryOf } from '../siteBuilder/industry'
import { siteFacts } from '../siteBuilder/draft'
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
  const keys: IndustryKey[] = ['manufacturing', 'it', 'trade', 'food', 'health', 'professional', 'education', 'construction', 'design', 'general']
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
  return out
}
