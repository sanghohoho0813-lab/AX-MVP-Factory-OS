/**
 * 내보내기 전 점검 (D-202) — 꼭 고칠 것(빨강) · 확인하면 좋은 것(노랑) · 참고(회색).
 * 점검은 막지 않는다 — 내려받기는 늘 된다. 다만 '꼭' 이 남아 있으면 단추 옆에 몇 개인지 보인다.
 */
import { blockDef, blockLabel } from './blocks'
import { hasContent, httpsHref, safeHref, safeImage } from './render'
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
    // D-207
    for (const f of blockDef(b.type)?.fields ?? []) {
      if (f.kind !== 'list' || !Array.isArray(b.props[f.key])) continue
      for (const sub of f.itemFields ?? []) {
        if (sub.kind !== 'image') continue
        const bad = (b.props[f.key] as Record<string, string>[]).filter((it) => (it[sub.key] ?? '').trim() && !safeImage(it[sub.key] ?? '')).length
        if (bad) out.push({ key: `img-${b.id}-${f.key}`, level: 'should', text: `${label}: 사진 주소 ${bad}개가 올바르지 않아 빠져요(https:// 로 시작하는 주소나 올린 사진만).`, blockId: b.id })
      }
    }
    if (b.type === 'hero' && str(b.props.layout) === 'photo' && !safeImage(str(b.props.image))) {
      out.push({ key: `photo-${b.id}`, level: 'should', text: `${label}: '사진 가득' 모양인데 사진이 없어요 — 사진을 올리기 전까지는 색 바탕으로 보여요.`, blockId: b.id })
    }
    if (b.type === 'gallery' && hasContent(b)) {
      const items = (Array.isArray(b.props.items) ? b.props.items : []).filter((it) => Object.values(it).some((x) => typeof x === 'string' && x.trim()))
      const noPhoto = items.filter((it) => !safeImage(it.image ?? '')).length
      if (noPhoto) out.push({ key: `gallery-${b.id}`, level: 'should', text: `${label}: 사진 없는 칸 ${noPhoto}개 — 회색 자리로 보여요. 실제 사진을 올려 주세요.`, blockId: b.id })
    }
    if (b.type === 'reviews' && hasContent(b)) {
      out.push({ key: `reviews-${b.id}`, level: 'info', text: `${label}: 실제 고객이 남긴 글만 그대로 — 지어내거나 고친 후기는 표시 · 광고 규정에 걸려요. 받은 곳(네이버 리뷰 등)을 함께 적으면 믿음이 커져요.`, blockId: b.id })
    }
    if (b.type === 'contact') {
      for (const [k, name] of [['kakaoUrl', '카카오톡 채널 주소'], ['formUrl', '상담 신청서 주소']] as const) {
        if (str(b.props[k]) && !httpsHref(str(b.props[k]))) out.push({ key: `${k}-${b.id}`, level: 'should', text: `${label}: ${name}는 https:// 로 시작해야 해요 — 지금은 단추가 안 생겨요.`, blockId: b.id })
      }
    }
  }
  // 큰 제목(h1)은 한 페이지에 하나 — 첫 화면 큰 문구가 그것(검색이 무엇에 관한 페이지인지 알아보는 곳)
  const heroes = doc.blocks.filter((b) => b.type === 'hero' && hasContent(b) && str(b.props.title))
  if (heroes.length === 0) out.push({ key: 'h1', level: 'should', text: '첫 화면 큰 문구가 없어요 — 검색은 큰 제목(h1)으로 무엇을 하는 회사인지 알아봐요.' })
  else if (heroes.length > 1) out.push({ key: 'h1', level: 'info', text: `첫 화면 블록이 ${heroes.length}개예요 — 큰 제목(h1)은 한 페이지에 하나가 좋아요.`, blockId: heroes[1].id })
  const dark = doc.blocks.filter((b) => ['brand', 'dark'].includes(str(b.props.bg)) && hasContent(b)).length
  if (dark > 2) out.push({ key: 'dark', level: 'info', text: `진한 바탕(꾸밈 색 · 어둡게) 블록이 ${dark}개예요 — 한두 곳만 두면 더 눈에 띄어요.` })
  if (!doc.seo.description.trim()) out.push({ key: 'seo', level: 'info', text: '검색 결과에 보일 설명이 비어 있어요.' })
  const mobileHidden = doc.blocks.filter((b) => b.hideMobile && !b.hidePc).length
  if (mobileHidden) out.push({ key: 'mobile-hidden', level: 'info', text: `휴대폰에서 숨긴 블록 ${mobileHidden}개` })

  const rank: Record<CheckLevel, number> = { must: 0, should: 1, info: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}
