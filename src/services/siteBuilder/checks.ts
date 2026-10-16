/**
 * 내보내기 전 점검 (D-202) — 꼭 고칠 것(빨강) · 확인하면 좋은 것(노랑) · 참고(회색).
 * 점검은 막지 않는다 — 내려받기는 늘 된다. 다만 '꼭' 이 남아 있으면 단추 옆에 몇 개인지 보인다.
 */
import { blockDef, blockLabel } from './blocks'
import { hasContent, safeHref, safeImage } from './render'
import type { PropValue, SiteDoc } from './types'

export type CheckLevel = 'must' | 'should' | 'info'

export interface SiteCheck {
  key: string
  level: CheckLevel
  text: string
  /** 누르면 이 블록을 연다 */
  blockId?: string
  /** 한 번에 고칠 수 있는 것 */
  fix?: 'useContactPhone'
}

const str = (v: PropValue | undefined): string => (typeof v === 'string' ? v.trim() : '')
const EMAIL = /^[^\s@<>()'"\\]+@[^\s@<>()'"\\]+\.[^\s@<>()'"\\]+$/

export interface CheckContext {
  /** 업체 기록의 담당자 번호 — 대표 전화가 없을 때 [담당자 번호 넣기] 를 보인다 */
  contactPhone?: string
}

export function siteChecks(doc: SiteDoc, ctx: CheckContext = {}): SiteCheck[] {
  const out: SiteCheck[] = []
  const header = doc.blocks.find((b) => b.type === 'header')
  const footer = doc.blocks.find((b) => b.type === 'footer')
  const contact = doc.blocks.find((b) => b.type === 'contact')
  const company = str(footer?.props.companyName) || str(header?.props.logoText)
  const phone = str(contact?.props.phone) || str(footer?.props.phone)
  const email = str(contact?.props.email) || str(footer?.props.email)
  const address = str(contact?.props.address) || str(footer?.props.address)

  if (!company) out.push({ key: 'company', level: 'must', text: '회사 이름이 없어요 — 맨 위 줄 · 맨 아래 줄에 적어 주세요.', blockId: footer?.id ?? header?.id })
  if (!phone && !email) out.push({ key: 'reach', level: 'must', text: '연락할 방법(전화 · 메일)이 하나도 없어요.', blockId: contact?.id ?? footer?.id })
  if (!header) out.push({ key: 'no-header', level: 'should', text: '맨 위 줄(로고 · 메뉴)이 없어요.' })
  if (!footer) out.push({ key: 'no-footer', level: 'should', text: '맨 아래 줄(사업자 정보)이 없어요.' })
  if (!phone && (phone || email || company)) {
    out.push({
      key: 'phone',
      level: 'should',
      text: ctx.contactPhone ? '회사 대표 전화가 없어요 — 업체 기록의 담당자 번호를 넣을까요?' : '회사 대표 전화가 없어요.',
      blockId: contact?.id ?? footer?.id,
      ...(ctx.contactPhone ? { fix: 'useContactPhone' as const } : {}),
    })
  }
  if (!address) out.push({ key: 'address', level: 'should', text: '주소가 없어요.', blockId: contact?.id ?? footer?.id })
  if (footer && footer.props.showBusinessNumber === true && !str(footer.props.businessNumber)) {
    out.push({ key: 'bizno', level: 'should', text: '맨 아래 줄 사업자등록번호가 비어 있어요.', blockId: footer.id })
  }
  if (footer && !str(footer.props.representative)) out.push({ key: 'rep', level: 'should', text: '맨 아래 줄 대표 이름이 비어 있어요.', blockId: footer.id })
  for (const e of [str(contact?.props.email), str(footer?.props.email)]) {
    if (e && !EMAIL.test(e)) {
      out.push({ key: 'email', level: 'should', text: `메일 주소 모양이 이상해요(${e}).`, blockId: contact?.id ?? footer?.id })
      break
    }
  }

  for (const b of doc.blocks) {
    const label = blockLabel(b.type)
    if (b.hidePc && b.hideMobile) out.push({ key: `hidden-${b.id}`, level: 'should', text: `${label}: PC · 휴대폰 모두 숨겨서 어디에도 안 보여요.`, blockId: b.id })
    else if (!hasContent(b)) out.push({ key: `empty-${b.id}`, level: 'should', text: `${label}: 비어 있어서 홈페이지에 안 나와요.`, blockId: b.id })
    if (b.sample?.length && hasContent(b)) {
      const names = b.sample.map((k) => blockDef(b.type)?.fields.find((f) => f.key === k)?.label ?? k)
      out.push({ key: `sample-${b.id}`, level: 'should', text: `${label}: 견본 문구 그대로예요(${names.join(' · ')}) — 업체와 확인해 주세요.`, blockId: b.id })
    }
    for (const f of blockDef(b.type)?.fields ?? []) {
      if (f.kind === 'image' && str(b.props[f.key]) && !safeImage(str(b.props[f.key]))) {
        out.push({ key: `img-${b.id}-${f.key}`, level: 'should', text: `${label}: ${f.label} 주소가 올바르지 않아 빠져요(https:// 로 시작하는 주소나 올린 그림만).`, blockId: b.id })
      }
    }
    if (b.type === 'hero' && str(b.props.buttonTarget) === 'url' && !safeHref(str(b.props.buttonUrl))) {
      out.push({ key: `url-${b.id}`, level: 'should', text: `${label}: 단추가 갈 주소가 비었거나 올바르지 않아요 — 연락처로 내려가게 해 둘게요.`, blockId: b.id })
    }
  }
  if (!doc.seo.description.trim()) out.push({ key: 'seo', level: 'info', text: '검색 결과에 보일 설명이 비어 있어요.' })
  const mobileHidden = doc.blocks.filter((b) => b.hideMobile && !b.hidePc).length
  if (mobileHidden) out.push({ key: 'mobile-hidden', level: 'info', text: `휴대폰에서 숨긴 블록 ${mobileHidden}개` })

  const rank: Record<CheckLevel, number> = { must: 0, should: 1, info: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}
