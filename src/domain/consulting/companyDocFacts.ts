/**
 * 사업자등록증·법인등기부등본에서 읽은 값을 사실표 항목으로 옮긴다.
 *
 * 글자를 뽑고 항목을 찾아내는 일은 이미 `koreanDocParser` 가 한다. 여기서 하는 일은 둘뿐이다.
 *   1. 두 서류를 함께 올렸을 때 어느 쪽 값을 쓸지 정한다 (서류마다 권위 있는 항목이 다르다).
 *   2. 파서의 이름을 사실표 이름으로 바꾸고, 어디서 읽었는지를 출처로 남긴다.
 *
 * 순수 함수다. 파일도 화면도 모른다.
 *
 * 없는 값을 만들어 내지 않는다(§31). 서류에 적혀 있지 않은 매출·직원수·거래처수는
 * 애초에 파서가 돌려주지 않으므로 여기로 올 수도 없다.
 */

import type { DocSource, ParsedCompanyInfo } from '../../services/koreanDocParser'
import type { FactKey, FactStatus } from '../../types/consulting'

export interface DocFactRead {
  key: FactKey
  value: string
  /**
   * 서류에 그대로 적힌 값은 '확정'. 우리가 뜻을 옮긴 값(종목 → 주요 제품)은 '미확인' 으로 두어
   * 확인 화면에서 한 번 더 눈에 띄게 한다.
   */
  status: Extract<FactStatus, 'confirmed' | 'unverified'>
  /** '사업자등록증' · '법인등기부등본' */
  source: string
}

export const DOC_LABEL: Record<Exclude<DocSource, 'unknown'>, string> = {
  business_registration: '사업자등록증',
  corporate_registry: '법인등기부등본',
}

/** 서류를 못 알아봤을 때 쓰는 이름 */
const UNKNOWN_LABEL = '올린 서류'

function labelOf(source: DocSource): string {
  return source === 'unknown' ? UNKNOWN_LABEL : DOC_LABEL[source]
}

/**
 * 항목별로 어느 서류를 먼저 믿는가.
 *
 * 법인등기부등본은 법인의 등기 사항(법인등록번호·본점·회사성립연월일·대표자)이 원본이다.
 * 사업자등록증은 세무 등록 사항(사업자등록번호·업태·종목)이 원본이다.
 * 회사명은 양쪽 모두 정확하지만 등기부의 상호가 법인명 그대로다.
 */
const PREFERRED: Partial<Record<keyof ParsedCompanyInfo, DocSource>> = {
  companyName: 'corporate_registry',
  corporateNumber: 'corporate_registry',
  address: 'corporate_registry',
  establishedAt: 'corporate_registry',
  representativeName: 'corporate_registry',
  businessNumber: 'business_registration',
  businessCategory: 'business_registration',
  businessItem: 'business_registration',
  businessItemsExtra: 'business_registration',
}

interface Picked {
  value: string
  from: DocSource
}

/** 여러 서류에서 같은 항목을 읽었을 때 하나를 고른다 */
function pick(docs: ParsedCompanyInfo[], field: keyof ParsedCompanyInfo): Picked | null {
  const have = docs
    .map((d) => ({ value: String(d[field] ?? '').trim(), from: d.source }))
    .filter((x) => x.value !== '')
  if (have.length === 0) return null
  const preferred = PREFERRED[field]
  return have.find((x) => x.from === preferred) ?? have[0]
}

/**
 * 올린 서류들에서 사실표에 채울 값을 뽑는다.
 * 서류를 한 장만 올려도, 두 장을 함께 올려도 같은 함수를 쓴다.
 */
export function factsFromDocuments(docs: ParsedCompanyInfo[]): DocFactRead[] {
  const out: DocFactRead[] = []
  const add = (key: FactKey, got: Picked | null, status: DocFactRead['status'] = 'confirmed'): void => {
    if (!got) return
    out.push({ key, value: got.value, status, source: labelOf(got.from) })
  }

  // 서류에 그대로 적혀 있는 것
  add('companyName', pick(docs, 'companyName'))
  add('representative', pick(docs, 'representativeName'))
  add('establishedAt', pick(docs, 'establishedAt'))
  add('headOffice', pick(docs, 'address'))
  add('businessNumber', pick(docs, 'businessNumber'))
  add('corporateNumber', pick(docs, 'corporateNumber'))

  // 업종 = 업태 · 종목. 둘 다 있으면 이어 붙인다.
  const category = pick(docs, 'businessCategory')
  const item = pick(docs, 'businessItem')
  if (category || item) {
    const joined = [category?.value, item?.value].filter((s): s is string => !!s).join(' · ')
    out.push({ key: 'industry', value: joined, status: 'confirmed', source: labelOf((category ?? item)!.from) })
  }

  /*
   * 주요 제품·서비스는 서류에 없다. 종목이 가장 가깝지만 "지금 돈을 버는 것" 과 같지는 않다.
   * 그래서 옮겨는 두되 '미확인' 으로 남겨 확인 화면에서 눈에 띄게 한다.
   */
  if (item) {
    const extra = pick(docs, 'businessItemsExtra')
    const value = [item.value, extra?.value].filter((s): s is string => !!s).join(' · ')
    out.push({ key: 'mainProducts', value, status: 'unverified', source: `${labelOf(item.from)} 종목` })
  }

  return out
}

/** 올린 서류들을 사람이 읽을 한 줄로 — '사업자등록증 · 법인등기부등본' */
export function documentsSummary(docs: ParsedCompanyInfo[]): string {
  const seen: string[] = []
  for (const d of docs) {
    const label = labelOf(d.source)
    if (!seen.includes(label)) seen.push(label)
  }
  return seen.join(' · ')
}
