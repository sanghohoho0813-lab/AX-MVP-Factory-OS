/**
 * 홈페이지 HTML 그리기 (D-202) — 미리보기와 내려받기가 같은 글을 쓴다(보이는 그대로 나간다).
 *
 * 안전:
 *   - 스크립트를 한 줄도 넣지 않는다. 질문 펼치기는 <details>, 메뉴는 앵커 링크 — 자바스크립트 없이 된다.
 *   - 사람이 적은 글은 모두 이스케이프(&lt; &gt; &amp; &quot; &#39;). 줄바꿈만 <br> 로.
 *   - 링크는 https · http · tel · mailto · #앵커만. 그림은 https · http 또는 data:image/(png|jpeg|webp|gif);base64 만.
 *   - 색 · 글꼴 · 모서리는 theme.ts 표에 있는 값만 CSS 에 들어간다.
 */
import { blockDef } from './blocks'
import { cornerOf, fontOf, paletteOf } from './theme'
import type { ListItem, PropValue, SiteBlock, SiteDoc } from './types'

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** 여러 줄 글 — 이스케이프 뒤 줄바꿈만 <br> */
function multi(s: string): string {
  return esc(s.trim()).replace(/\r?\n/g, '<br>')
}

const SAFE_WEB = /^https?:\/\/[^\s'"()<>\\`]+$/i

/** 누를 수 있는 주소만 — 아니면 '' */
export function safeHref(raw: string): string {
  const u = raw.trim()
  if (!u) return ''
  if (u.startsWith('#') && /^#[\w-]{1,40}$/.test(u)) return u
  if (SAFE_WEB.test(u) && u.length <= 500) return u
  if (/^mailto:[^\s'"<>()\\`]+@[^\s'"<>()\\`]+$/i.test(u)) return u
  if (/^tel:\+?[\d-]{3,20}$/.test(u)) return u
  return ''
}

/** 그림 주소 — 웹 주소 또는 그림 data URL 만 */
export function safeImage(raw: string): string {
  const u = raw.trim()
  if (!u) return ''
  if (SAFE_WEB.test(u) && u.length <= 800) return u
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(u) && u.length <= MAX_IMAGE_CHARS) return u
  return ''
}

/** 그림 하나 상한(약 450KB) — 저장 공간을 지키려고 */
export const MAX_IMAGE_CHARS = 600_000

/** 전화번호 → tel: (숫자 · + · - 만) */
export function telHref(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '')
  return d.length >= 7 && d.length <= 16 ? `tel:${d}` : ''
}

export function mapHref(address: string): string {
  const a = address.trim()
  return a ? `https://map.naver.com/p/search/${encodeURIComponent(a)}` : ''
}

const str = (v: PropValue | undefined): string => (typeof v === 'string' ? v : '')
const on = (v: PropValue | undefined): boolean => v === true
const list = (v: PropValue | undefined): ListItem[] => (Array.isArray(v) ? v : [])
/** 칸이 하나라도 차 있는 줄만 */
const filled = (items: ListItem[]): ListItem[] => items.filter((it) => Object.values(it).some((x) => typeof x === 'string' && x.trim()))

export interface RenderOptions {
  /** 편집 화면 미리보기 — 블록을 누를 수 있게 표시를 달고, 밖으로 나가는 링크는 막는다 */
  preview?: boolean
  /** 미리보기에서 테두리로 보일 블록 */
  selectedId?: string | null
}

interface Ctx {
  doc: SiteDoc
  anchors: Map<string, string>
  phone: string
  email: string
  preview: boolean
}

/** 블록마다 앵커(#about) — 같은 종류가 둘이면 #about-2 */
export function blockAnchors(blocks: SiteBlock[]): Map<string, string> {
  const used = new Map<string, number>()
  const out = new Map<string, string>()
  for (const b of blocks) {
    const base = blockDef(b.type)?.anchor ?? b.type
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    out.set(b.id, n === 1 ? base : `${base}-${n}`)
  }
  return out
}

/** 맨 위 메뉴 — 메뉴 이름이 있는 블록 중 보이는 것(PC에서) */
export function menuItems(doc: SiteDoc): { label: string; href: string }[] {
  const anchors = blockAnchors(doc.blocks)
  return doc.blocks
    .filter((b) => !b.hidePc && blockDef(b.type)?.menu && hasContent(b))
    .map((b) => ({ label: str(b.props.title).trim() && str(b.props.title).length <= 12 ? str(b.props.title).trim() : (blockDef(b.type)?.menu as string), href: `#${anchors.get(b.id)}` }))
}

/** 이 블록에 보일 것이 있나 (비어 있으면 그리지 않는다) */
export function hasContent(b: SiteBlock): boolean {
  const p = b.props
  switch (b.type) {
    case 'header':
    case 'footer':
      return true
    case 'hero':
      return Boolean(str(p.title).trim() || str(p.subtitle).trim() || str(p.eyebrow).trim())
    case 'about':
      return Boolean(str(p.body).trim() || filled(list(p.facts)).length)
    case 'contact':
      return Boolean(str(p.address).trim() || str(p.phone).trim() || str(p.email).trim() || str(p.hours).trim())
    case 'cta':
      return Boolean(str(p.title).trim() || str(p.body).trim())
    default:
      return filled(list(p.items)).length > 0
  }
}

function attrs(b: SiteBlock, ctx: Ctx, cls: string): string {
  const c = [cls, b.hidePc ? 'hide-pc' : '', b.hideMobile ? 'hide-m' : ''].filter(Boolean).join(' ')
  return `id="${esc(ctx.anchors.get(b.id) ?? b.id)}" class="${esc(c)}"${ctx.preview ? ` data-block="${esc(b.id)}"` : ''}`
}

function heading(title: string, intro = ''): string {
  return `${title.trim() ? `<h2>${esc(title.trim())}</h2>` : ''}${intro.trim() ? `<p class="lead">${multi(intro)}</p>` : ''}`
}

function contactAnchor(ctx: Ctx): string {
  for (const t of ['contact', 'cta', 'footer'] as const) {
    const b = ctx.doc.blocks.find((x) => x.type === t && hasContent(x))
    if (b) return `#${ctx.anchors.get(b.id)}`
  }
  return '#footer'
}

function renderBlock(b: SiteBlock, ctx: Ctx, alt: boolean): string {
  const p = b.props
  const sec = (inner: string, cls = '') => `<section ${attrs(b, ctx, [alt ? 'alt' : '', cls].filter(Boolean).join(' '))}><div class="w">${inner}</div></section>`
  switch (b.type) {
    case 'header': {
      const logoImg = safeImage(str(p.logoImage))
      const logo = logoImg ? `<img src="${esc(logoImg)}" alt="${esc(str(p.logoText) || '로고')}">` : esc(str(p.logoText).trim() || ' ')
      const menu = on(p.showMenu) ? menuItems(ctx.doc) : []
      const cta = str(p.ctaLabel).trim()
      return `<header ${attrs(b, ctx, 'hd')}><div class="w"><a class="logo" href="#top">${logo}</a>${
        menu.length ? `<nav class="menu" aria-label="메뉴">${menu.map((m) => `<a href="${esc(m.href)}">${esc(m.label)}</a>`).join('')}</nav>` : '<span class="sp"></span>'
      }${cta ? `<a class="btn sm" href="${esc(contactAnchor(ctx))}">${esc(cta)}</a>` : ''}</div></header>`
    }
    case 'hero': {
      const img = safeImage(str(p.image))
      const target = str(p.buttonTarget)
      const services = ctx.doc.blocks.find((x) => x.type === 'services' && hasContent(x))
      const href =
        target === 'phone'
          ? telHref(ctx.phone) || contactAnchor(ctx)
          : target === 'services'
            ? services
              ? `#${ctx.anchors.get(services.id)}`
              : contactAnchor(ctx)
            : target === 'url'
              ? safeHref(str(p.buttonUrl)) || contactAnchor(ctx)
              : contactAnchor(ctx)
      const label = str(p.buttonLabel).trim()
      const ext = /^https?:/.test(href)
      const cls = ['hero', img ? 'img' : '', str(p.align) === 'center' ? 'center' : ''].filter(Boolean).join(' ')
      const style = img ? ` style="background-image:linear-gradient(rgba(10,14,25,.58),rgba(10,14,25,.58)),url('${esc(img)}')"` : ''
      return `<section ${attrs(b, ctx, cls)}${style}><div class="w">${str(p.eyebrow).trim() ? `<p class="eyebrow">${esc(str(p.eyebrow).trim())}</p>` : ''}${
        str(p.title).trim() ? `<h1>${multi(str(p.title))}</h1>` : ''
      }${str(p.subtitle).trim() ? `<p class="sub">${multi(str(p.subtitle))}</p>` : ''}${
        label ? `<a class="btn hero-btn" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>` : ''
      }</div></section>`
    }
    case 'about': {
      const facts = filled(list(p.facts))
      const img = safeImage(str(p.image))
      const body = str(p.body)
        .split(/\n{1,}/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => `<p>${esc(x)}</p>`)
        .join('')
      const side = [
        img ? `<img class="ph" src="${esc(img)}" alt="${esc(str(p.title) || '회사 사진')}">` : '',
        facts.length ? `<dl class="facts">${facts.map((f) => `<div><dt>${esc(f.label ?? '')}</dt><dd>${esc(f.value ?? '')}</dd></div>`).join('')}</dl>` : '',
      ].join('')
      return sec(`${heading(str(p.title))}<div class="about${side ? '' : ' one'}"><div class="body">${body}</div>${side ? `<div>${side}</div>` : ''}</div>`)
    }
    case 'services': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), str(p.intro))}<div class="cards">${items.map((it) => `<div class="card"><h3>${esc(it.name ?? '')}</h3>${(it.desc ?? '').trim() ? `<p>${multi(it.desc ?? '')}</p>` : ''}</div>`).join('')}</div>`)
    }
    case 'numbers': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title))}<div class="nums">${items.map((it) => `<div class="num"><b>${esc(it.value ?? '')}</b><span>${esc(it.label ?? '')}</span></div>`).join('')}</div>`)
    }
    case 'certs': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), str(p.intro))}<div class="certs">${items.map((it) => `<div class="cert"><i aria-hidden="true">✓</i><div><b>${esc(it.name ?? '')}</b>${(it.detail ?? '').trim() ? `<span>${esc(it.detail ?? '')}</span>` : ''}</div></div>`).join('')}</div>`)
    }
    case 'history': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title))}<ol class="timeline">${items.map((it) => `<li><b>${esc(it.year ?? '')}</b><span>${esc(it.text ?? '')}</span></li>`).join('')}</ol>`)
    }
    case 'process': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), str(p.intro))}<ol class="steps">${items.map((it, i) => `<li class="step"><em>${i + 1}</em><h3>${esc(it.name ?? '')}</h3>${(it.desc ?? '').trim() ? `<p>${esc(it.desc ?? '')}</p>` : ''}</li>`).join('')}</ol>`)
    }
    case 'faq': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title))}<div class="faq">${items.map((it) => `<details><summary>${esc(it.q ?? '')}</summary>${(it.a ?? '').trim() ? `<p>${multi(it.a ?? '')}</p>` : ''}</details>`).join('')}</div>`)
    }
    case 'cta': {
      const tel = on(p.showPhone) ? telHref(ctx.phone) : ''
      const label = str(p.buttonLabel).trim()
      const contact = ctx.doc.blocks.find((x) => x.type === 'contact' && hasContent(x))
      const btnHref = contact ? `#${ctx.anchors.get(contact.id)}` : tel || (ctx.email ? `mailto:${ctx.email}` : '')
      const safeBtn = safeHref(btnHref)
      return `<section ${attrs(b, ctx, 'cta')}><div class="w">${heading(str(p.title))}${str(p.body).trim() ? `<p>${multi(str(p.body))}</p>` : ''}${
        tel ? `<a class="tel" href="${esc(tel)}">${esc(ctx.phone)}</a>` : ''
      }${label && safeBtn ? `<a class="btn" href="${esc(safeBtn)}">${esc(label)}</a>` : ''}</div></section>`
    }
    case 'contact': {
      const address = str(p.address).trim()
      const phone = str(p.phone).trim()
      const email = str(p.email).trim()
      const hours = str(p.hours).trim()
      const map = on(p.showMapLink) ? mapHref(address) : ''
      const rows = [
        address ? `<div><dt>주소</dt><dd>${esc(address)}</dd></div>` : '',
        phone ? `<div><dt>전화</dt><dd>${telHref(phone) ? `<a href="${esc(telHref(phone))}">${esc(phone)}</a>` : esc(phone)}</dd></div>` : '',
        email ? `<div><dt>메일</dt><dd>${safeHref(`mailto:${email}`) ? `<a href="${esc(`mailto:${email}`)}">${esc(email)}</a>` : esc(email)}</dd></div>` : '',
        hours ? `<div><dt>운영 시간</dt><dd>${multi(hours)}</dd></div>` : '',
      ].join('')
      return sec(`${heading(str(p.title))}<dl class="facts contact">${rows}</dl>${map ? `<a class="btn ghost" href="${esc(map)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>` : ''}`)
    }
    case 'footer': {
      const name = str(p.companyName).trim()
      const year = /^(\d{4})/.exec(ctx.doc.updatedAt)?.[1] ?? ''
      const line1 = [
        name ? `상호 ${esc(name)}` : '',
        str(p.representative).trim() ? `대표 ${esc(str(p.representative).trim())}` : '',
        on(p.showBusinessNumber) && str(p.businessNumber).trim() ? `사업자등록번호 ${esc(str(p.businessNumber).trim())}` : '',
      ].filter(Boolean)
      const line2 = [
        str(p.address).trim() ? `주소 ${esc(str(p.address).trim())}` : '',
        str(p.phone).trim() ? `전화 ${esc(str(p.phone).trim())}` : '',
        str(p.email).trim() ? `메일 ${esc(str(p.email).trim())}` : '',
      ].filter(Boolean)
      const sep = '<i class="sep">|</i>'
      const line = (parts: string[]) => (parts.length ? `<p>${parts.map((x) => `<span>${x}</span>`).join(sep)}</p>` : '')
      return `<footer ${attrs(b, ctx, 'ft')}><div class="w">${name ? `<b>${esc(name)}</b>` : ''}${line(line1)}${line(line2)}${
        str(p.extra).trim() ? `<p>${esc(str(p.extra).trim())}</p>` : ''
      }<p class="copy">© ${esc(year)} ${esc(name)}</p></div></footer>`
    }
  }
}

function css(doc: SiteDoc, opts: RenderOptions): string {
  const pal = paletteOf(doc.theme.palette)
  const font = fontOf(doc.theme.font)
  const corner = cornerOf(doc.theme.corner)
  const vars = `--p:${pal.primary};--op:${pal.onPrimary};--hf:${pal.heroFrom};--ht:${pal.heroTo};--soft:${pal.soft};--ink:${pal.ink};--muted:${pal.muted};--line:${pal.line};--fb:${pal.footBg};--fi:${pal.footInk};--rc:${corner.card}px;--rb:${corner.button}px;--font:${font.stack}`
  const preview = opts.preview
    ? `[data-block]{cursor:pointer}[data-block]:hover{box-shadow:inset 0 0 0 2px rgba(245,158,11,.55)}a[href^="http"],a[href^="tel"],a[href^="mailto"]{pointer-events:none}${
        opts.selectedId ? `[data-block="${esc(opts.selectedId)}"]{box-shadow:inset 0 0 0 4px #f59e0b !important}` : ''
      }`
    : ''
  return `:root{${vars}}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{font-family:var(--font);color:var(--ink);background:#fff;line-height:1.7;font-size:16px;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
ol{list-style:none}
.w{max-width:1120px;margin:0 auto;padding:0 24px}
section{padding:88px 0;scroll-margin-top:72px}
section.alt{background:var(--soft)}
h2{font-size:32px;line-height:1.3;letter-spacing:-.02em;margin-bottom:16px}
h3{font-size:19px;line-height:1.4;margin-bottom:8px}
.lead{color:var(--muted);font-size:17px;max-width:720px;margin-bottom:36px}
h2+.cards,h2+.nums,h2+.certs,h2+.timeline,h2+.steps,h2+.faq,h2+.about,h2+.facts{margin-top:32px}
.hd{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line)}
.hd .w{display:flex;align-items:center;gap:24px;min-height:68px}
.logo{font-weight:800;font-size:20px;text-decoration:none;white-space:nowrap;letter-spacing:-.02em}
.logo img{height:38px;width:auto}
.menu{display:flex;gap:24px;margin-left:auto;overflow-x:auto}
.menu a{text-decoration:none;color:var(--muted);font-size:15px;white-space:nowrap;padding:8px 0}
.sp{margin-left:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 26px;border-radius:var(--rb);background:var(--p);color:var(--op);font-weight:700;text-decoration:none;font-size:16px;white-space:nowrap}
.btn.sm{min-height:42px;padding:0 18px;font-size:15px}
.btn.ghost{background:transparent;border:1.5px solid var(--p);color:var(--p);margin-top:24px}
.hero{color:#fff;background:linear-gradient(135deg,var(--hf),var(--ht));padding:128px 0 116px}
.hero.img{background-size:cover;background-position:center}
.hero .eyebrow{opacity:.85;font-weight:600;margin-bottom:18px;font-size:16px}
.hero h1{font-size:50px;line-height:1.22;letter-spacing:-.03em;margin-bottom:22px;max-width:860px}
.hero .sub{font-size:19px;opacity:.92;max-width:680px;margin-bottom:38px}
.hero .hero-btn{background:#fff;color:var(--p)}
.hero.center{text-align:center}
.hero.center h1,.hero.center .sub{margin-left:auto;margin-right:auto}
.about{display:grid;grid-template-columns:1.25fr 1fr;gap:56px;align-items:start}
.about.one{grid-template-columns:1fr;max-width:820px}
.about .body p{font-size:17px}
.about .body p+p{margin-top:14px;color:var(--muted)}
.ph{border-radius:var(--rc);margin-bottom:24px;width:100%;object-fit:cover;max-height:360px}
.facts{border-top:2px solid var(--p)}
.facts div{display:flex;gap:16px;padding:14px 2px;border-bottom:1px solid var(--line)}
.facts dt{width:84px;flex:none;color:var(--muted)}
.facts dd{font-weight:600}
.facts a{text-decoration:none}
.contact{max-width:760px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--rc);padding:28px}
.card p{color:var(--muted);font-size:15px}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:20px;text-align:center}
.num{padding:12px}
.num b{display:block;font-size:46px;color:var(--p);letter-spacing:-.02em;line-height:1.15;margin-bottom:6px}
.num span{color:var(--muted)}
.certs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.cert{display:flex;gap:12px;align-items:flex-start;padding:18px 20px;border:1px solid var(--line);border-radius:var(--rc);background:#fff}
.cert i{flex:none;width:28px;height:28px;border-radius:50%;background:var(--p);color:var(--op);font-style:normal;display:grid;place-items:center;font-size:14px;margin-top:2px}
.cert b{display:block}
.cert span{display:block;color:var(--muted);font-size:14px}
.timeline li{display:grid;grid-template-columns:100px 1fr;gap:16px;padding:16px 2px;border-bottom:1px solid var(--line)}
.timeline b{color:var(--p)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}
.step{padding:26px;border-radius:var(--rc);background:#fff;border:1px solid var(--line)}
.step em{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--p);color:var(--op);font-style:normal;font-weight:700;margin-bottom:14px}
.step p{color:var(--muted);font-size:15px}
.faq{max-width:820px}
details{border-bottom:1px solid var(--line);padding:20px 2px}
summary{cursor:pointer;font-weight:700;font-size:17px;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}
summary::after{content:'+';color:var(--p);font-size:22px;line-height:1}
details[open] summary::after{content:'−'}
details p{margin-top:10px;color:var(--muted)}
.cta{background:var(--p);color:var(--op);text-align:center}
.cta p{opacity:.92;margin:0 auto 28px;max-width:640px;font-size:17px}
.cta .tel{display:block;font-size:32px;font-weight:800;margin-bottom:22px;text-decoration:none;letter-spacing:.01em}
.cta .btn{background:#fff;color:var(--p)}
.ft{background:var(--fb);color:var(--fi);padding:52px 0;font-size:14px}
.ft b{color:#fff;font-size:17px;display:block;margin-bottom:10px}
.ft p{margin-top:4px}
.ft .sep{opacity:.4;margin:0 8px;font-style:normal}
.ft .copy{margin-top:18px;opacity:.7}
@media (max-width:720px){
section{padding:60px 0}
h2{font-size:25px}
.w{padding:0 18px}
.hd .w{flex-wrap:wrap;gap:6px 14px;padding-top:10px;padding-bottom:8px;min-height:60px}
.logo{font-size:18px}
.logo img{height:32px}
.menu{order:3;width:100%;margin-left:0;gap:18px}
.hd .btn{margin-left:auto}
.sp{display:none}
.hero{padding:76px 0 68px}
.hero h1{font-size:32px}
.hero .sub{font-size:16px}
.about{grid-template-columns:1fr;gap:28px}
.num b{font-size:36px}
.timeline li{grid-template-columns:72px 1fr}
.cta .tel{font-size:25px}
.ft .sep{display:none}
.ft p span{display:block}
.hide-m{display:none!important}
}
@media (min-width:721px){.hide-pc{display:none!important}}
${preview}`
}

/** 홈페이지 한 장 (완성된 HTML 문서) */
export function renderSiteHtml(doc: SiteDoc, opts: RenderOptions = {}): string {
  const anchors = blockAnchors(doc.blocks)
  const contact = doc.blocks.find((b) => b.type === 'contact')
  const footer = doc.blocks.find((b) => b.type === 'footer')
  const phone = str(contact?.props.phone).trim() || str(footer?.props.phone).trim()
  const email = str(contact?.props.email).trim() || str(footer?.props.email).trim()
  const ctx: Ctx = { doc, anchors, phone, email, preview: Boolean(opts.preview) }
  let alt = false
  const body = doc.blocks
    .filter(hasContent)
    .map((b) => {
      // 번갈아 옅은 바탕 — 색 바탕 블록(첫 화면 · 문의 띠) · 머리 · 바닥은 세지 않는다
      const plain = !['header', 'hero', 'cta', 'footer'].includes(b.type)
      const html = renderBlock(b, ctx, plain && alt)
      if (plain) alt = !alt
      return html
    })
    .join('\n')
  const font = fontOf(doc.theme.font)
  const title = doc.seo.title.trim() || str(footer?.props.companyName) || '홈페이지'
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(doc.seo.description.trim())}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(doc.seo.description.trim())}">
<meta property="og:type" content="website">
${font.link ? `<link rel="stylesheet" href="${esc(font.link)}">` : ''}
<style>
${css(doc, opts)}
</style>
</head>
<body id="top">
${body}
</body>
</html>
`
}

/** 내려받을 파일 이름 — 회사명-홈페이지.html (파일 이름에 못 쓰는 글자는 뺀다) */
export function siteFileName(doc: SiteDoc): string {
  const footer = doc.blocks.find((b) => b.type === 'footer')
  const header = doc.blocks.find((b) => b.type === 'header')
  const name = (str(footer?.props.companyName) || str(header?.props.logoText) || '업체').replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 40) || '업체'
  return `${name}-홈페이지.html`
}
