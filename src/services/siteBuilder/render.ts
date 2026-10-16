/**
 * 홈페이지 HTML 그리기 (D-202) — 미리보기와 내려받기가 같은 글을 쓴다(보이는 그대로 나간다).
 *
 * 안전:
 *   - 스크립트를 한 줄도 넣지 않는다. 질문 펼치기는 <details>, 메뉴는 앵커 링크 — 자바스크립트 없이 된다.
 *   - 사람이 적은 글은 모두 이스케이프(&lt; &gt; &amp; &quot; &#39;). 줄바꿈만 <br> 로.
 *   - 링크는 https · http · tel · mailto · #앵커만. 그림은 https · http 또는 data:image/(png|jpeg|webp|gif);base64 만.
 *   - 색 · 글꼴 · 모서리는 theme.ts 표에 있는 값만 CSS 에 들어간다.
 *   - 그림 · 아이콘 SVG 는 art.ts 에 있는 것만(업종 · 순번으로 고른다 — 사람이 적은 글은 들어가지 않는다).
 *
 * 모양(D-205): 첫 화면 '글 + 그림 나란히' · '색 바탕', 사업 '아이콘 카드' · '번호 줄' · '글 카드', 숫자 '색 띠' · '흰 바탕'.
 * 구역 제목 위에 작은 영문 머리글(ABOUT · BUSINESS …)을 단다.
 */
import { heroArt, serviceIcon } from './art'
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

/** 구역 제목 위 작은 머리글 — 고정 글(사람이 적은 글 아님) */
const KICKER: Partial<Record<SiteBlock['type'], string>> = {
  about: 'ABOUT',
  services: 'BUSINESS',
  numbers: 'NUMBERS',
  certs: 'CERTIFICATION',
  history: 'HISTORY',
  process: 'PROCESS',
  faq: 'FAQ',
  contact: 'CONTACT',
}

function heading(title: string, intro = '', kicker = ''): string {
  return `${kicker ? `<p class="kicker">${kicker}</p>` : ''}${title.trim() ? `<h2>${esc(title.trim())}</h2>` : ''}${intro.trim() ? `<p class="lead">${multi(intro)}</p>` : ''}`
}

/** 로고 자리 글자 하나 — '(주)샤인디자인' → '샤' */
function logoMark(name: string): string {
  const clean = name.replace(/^\s*(\(주\)|㈜|주식회사|\(유\)|유한회사|\(재\)|재단법인|\(사\)|사단법인)\s*/, '').replace(/\s*(\(주\)|㈜|주식회사)\s*$/, '').trim()
  return Array.from(clean)[0] ?? ''
}

/** 첫 화면 칩 — 회사 소개 블록의 사실(설립 · 소재지 · 직원)만 */
function heroChips(ctx: Ctx): { label: string; value: string }[] {
  const about = ctx.doc.blocks.find((x) => x.type === 'about' && hasContent(x))
  const facts = filled(list(about?.props.facts))
  const want = ['설립', '소재지', '직원']
  return want
    .map((w) => facts.find((f) => (f.label ?? '').trim() === w))
    .filter((f): f is ListItem => !!f && !!(f.value ?? '').trim())
    .map((f) => ({ label: (f.label ?? '').trim(), value: (f.value ?? '').trim() }))
    .slice(0, 3)
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
      const mark = logoMark(str(p.logoText))
      const logo = logoImg ? `<img src="${esc(logoImg)}" alt="${esc(str(p.logoText) || '로고')}">` : `${mark ? `<span class="mark" aria-hidden="true">${esc(mark)}</span>` : ''}<span>${esc(str(p.logoText).trim() || ' ')}</span>`
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
      const split = str(p.layout) !== 'band'
      const chips = on(p.showFacts) ? heroChips(ctx) : []
      const eyebrow = str(p.eyebrow).trim() ? `<p class="eyebrow">${esc(str(p.eyebrow).trim())}</p>` : ''
      // 나란히 모양: 큰 문구의 마지막 줄을 강조색으로
      const lines = str(p.title).trim().split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      const h1 = lines.length === 0 ? '' : split && lines.length > 1 ? `<h1>${lines.slice(0, -1).map(esc).join('<br>')}<br><span class="hl">${esc(lines[lines.length - 1])}</span></h1>` : `<h1>${multi(str(p.title))}</h1>`
      const sub = str(p.subtitle).trim() ? `<p class="sub">${multi(str(p.subtitle))}</p>` : ''
      const tel = target !== 'phone' ? telHref(ctx.phone) : ''
      const btns =
        label || (split && tel)
          ? `<div class="btns">${label ? `<a class="btn hero-btn" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>` : ''}${
              split && tel ? `<a class="btn line" href="${esc(tel)}">전화 ${esc(ctx.phone)}</a>` : ''
            }</div>`
          : ''
      const chipHtml = chips.length ? `<ul class="chips">${chips.map((c) => `<li><span>${esc(c.label)}</span>${esc(c.value)}</li>`).join('')}</ul>` : ''
      if (split) {
        const art = img ? `<img class="hero-ph" src="${esc(img)}" alt="${esc(str(p.eyebrow).trim() || '대표 사진')}">` : heroArt(ctx.doc.industry)
        return `<section ${attrs(b, ctx, 'hero split')}><div class="w"><div class="hero-grid"><div class="hero-copy">${eyebrow}${h1}${sub}${btns}${chipHtml}</div><div class="hero-art">${art}</div></div></div></section>`
      }
      const cls = ['hero', 'band', img ? 'img' : '', str(p.align) === 'center' ? 'center' : ''].filter(Boolean).join(' ')
      const style = img ? ` style="background-image:linear-gradient(rgba(10,14,25,.58),rgba(10,14,25,.58)),url('${esc(img)}')"` : ''
      return `<section ${attrs(b, ctx, cls)}${style}><div class="w">${eyebrow}${h1}${sub}${btns}${chipHtml}</div></section>`
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
      return sec(`${heading(str(p.title), '', KICKER.about)}<div class="about${side ? '' : ' one'}"><div class="body">${body}</div>${side ? `<div>${side}</div>` : ''}</div>`)
    }
    case 'services': {
      const items = filled(list(p.items))
      const layout = str(p.layout)
      const desc = (it: ListItem) => ((it.desc ?? '').trim() ? `<p>${multi(it.desc ?? '')}</p>` : '')
      const two = (i: number) => String(i + 1).padStart(2, '0')
      const inner =
        layout === 'rows'
          ? `<ol class="rows">${items.map((it, i) => `<li><em>${two(i)}</em><div><h3>${esc(it.name ?? '')}</h3>${desc(it)}</div></li>`).join('')}</ol>`
          : layout === 'plain'
            ? `<div class="cards">${items.map((it) => `<div class="card"><h3>${esc(it.name ?? '')}</h3>${desc(it)}</div>`).join('')}</div>`
            : `<div class="cards icons">${items.map((it, i) => `<div class="card"><span class="icw">${serviceIcon(ctx.doc.industry, i)}</span><h3>${esc(it.name ?? '')}</h3>${desc(it)}</div>`).join('')}</div>`
      return sec(`${heading(str(p.title), str(p.intro), KICKER.services)}${inner}`)
    }
    case 'numbers': {
      const items = filled(list(p.items))
      const band = str(p.layout) !== 'plain'
      const inner = `${heading(str(p.title), '', KICKER.numbers)}<div class="nums">${items.map((it) => `<div class="num"><b>${esc(it.value ?? '')}</b><span>${esc(it.label ?? '')}</span></div>`).join('')}</div>`
      return band ? `<section ${attrs(b, ctx, 'numband')}><div class="w">${inner}</div></section>` : sec(inner)
    }
    case 'certs': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), str(p.intro), KICKER.certs)}<div class="certs">${items.map((it) => `<div class="cert"><i aria-hidden="true">✓</i><div><b>${esc(it.name ?? '')}</b>${(it.detail ?? '').trim() ? `<span>${esc(it.detail ?? '')}</span>` : ''}</div></div>`).join('')}</div>`)
    }
    case 'history': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), '', KICKER.history)}<ol class="timeline">${items.map((it) => `<li><b>${esc(it.year ?? '')}</b><span>${esc(it.text ?? '')}</span></li>`).join('')}</ol>`)
    }
    case 'process': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), str(p.intro), KICKER.process)}<ol class="steps">${items.map((it, i) => `<li class="step"><em>${String(i + 1).padStart(2, '0')}</em><h3>${esc(it.name ?? '')}</h3>${(it.desc ?? '').trim() ? `<p>${esc(it.desc ?? '')}</p>` : ''}</li>`).join('')}</ol>`)
    }
    case 'faq': {
      const items = filled(list(p.items))
      return sec(`${heading(str(p.title), '', KICKER.faq)}<div class="faq">${items.map((it) => `<details><summary>${esc(it.q ?? '')}</summary>${(it.a ?? '').trim() ? `<p>${multi(it.a ?? '')}</p>` : ''}</details>`).join('')}</div>`)
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
      return sec(`${heading(str(p.title), '', KICKER.contact)}<div class="contact-box"><dl class="facts contact">${rows}</dl>${map ? `<a class="btn ghost" href="${esc(map)}" target="_blank" rel="noopener">네이버 지도에서 보기</a>` : ''}</div>`)
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
body{font-family:var(--font);color:var(--ink);background:#fff;line-height:1.7;font-size:17px;word-break:keep-all;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
ol,ul{list-style:none}
.w{max-width:1160px;margin:0 auto;padding:0 28px}
section{padding:104px 0;scroll-margin-top:76px}
section.alt{background:var(--soft)}
.kicker{font-size:13px;font-weight:800;letter-spacing:.16em;color:var(--p);margin-bottom:12px}
h2{font-size:38px;line-height:1.28;letter-spacing:-.025em;margin-bottom:16px;font-weight:800}
h3{font-size:20px;line-height:1.4;margin-bottom:8px;letter-spacing:-.01em}
.lead{color:var(--muted);font-size:18px;max-width:720px;margin-bottom:40px}
h2+.cards,h2+.nums,h2+.certs,h2+.timeline,h2+.steps,h2+.faq,h2+.about,h2+.facts,h2+.rows,h2+.contact-box{margin-top:40px}
.hd{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.6) blur(10px);-webkit-backdrop-filter:saturate(1.6) blur(10px);border-bottom:1px solid var(--line)}
.hd .w{display:flex;align-items:center;gap:28px;min-height:72px}
.logo{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:20px;text-decoration:none;white-space:nowrap;letter-spacing:-.02em}
.logo img{height:38px;width:auto}
.mark{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--hf),var(--p));color:var(--op);font-size:17px;font-weight:800;flex:none}
.menu{display:flex;gap:28px;margin-left:auto;overflow-x:auto}
.menu a{text-decoration:none;color:var(--muted);font-size:15px;font-weight:600;white-space:nowrap;padding:8px 0}
.menu a:hover{color:var(--p)}
.sp{margin-left:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:0 28px;border-radius:var(--rb);background:var(--p);color:var(--op);font-weight:700;text-decoration:none;font-size:16px;white-space:nowrap;box-shadow:0 8px 20px -10px var(--p)}
.btn.sm{min-height:42px;padding:0 18px;font-size:15px;box-shadow:none}
.btn.ghost{background:transparent;border:1.5px solid var(--p);color:var(--p);margin-top:24px;box-shadow:none}
.btn.line{background:#fff;color:var(--ink);border:1.5px solid var(--line);box-shadow:none}
.btns{display:flex;flex-wrap:wrap;gap:12px}
.hero{color:#fff;padding:132px 0 120px;position:relative;overflow:hidden}
.hero.band{background:radial-gradient(circle at 88% 12%,rgba(255,255,255,.13) 0 170px,transparent 171px),radial-gradient(circle at 76% 96%,rgba(255,255,255,.08) 0 130px,transparent 131px),linear-gradient(135deg,var(--hf),var(--ht))}
.hero.img{background-size:cover;background-position:center}
.hero .eyebrow{opacity:.85;font-weight:700;margin-bottom:18px;font-size:15px;letter-spacing:.02em}
.hero h1{font-size:54px;line-height:1.2;letter-spacing:-.035em;margin-bottom:22px;max-width:860px;font-weight:800}
.hero .sub{font-size:19px;opacity:.92;max-width:640px;margin-bottom:38px}
.hero .hero-btn{background:#fff;color:var(--p)}
.hero.center{text-align:center}
.hero.center h1,.hero.center .sub{margin-left:auto;margin-right:auto}
.hero.center .btns,.hero.center .chips{justify-content:center}
.hero.split{color:var(--ink);background:radial-gradient(circle at 92% 8%,var(--soft) 0 260px,transparent 261px),linear-gradient(180deg,var(--soft) 0%,#fff 78%);padding:96px 0 104px}
.hero.split .eyebrow{display:inline-block;opacity:1;color:var(--p);background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 16px;font-size:14px;margin-bottom:22px}
.hero.split h1{font-size:50px}
.hero.split .sub{color:var(--muted);opacity:1}
.hero.split .hero-btn{background:var(--p);color:var(--op)}
.hero .hl{color:var(--p)}
.hero.band .hl{color:inherit}
.hero-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:56px;align-items:center}
.hero-art .art{width:100%;height:auto;display:block}
.hero-ph{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--rc) + 8px);box-shadow:0 30px 60px -30px rgba(15,23,42,.45)}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}
.chips li{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:700;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 16px;color:var(--ink)}
.chips li span{font-weight:600;color:var(--muted);font-size:13px}
.hero.band .chips li{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.28);color:#fff}
.hero.band .chips li span{color:rgba(255,255,255,.75)}
.art .o1{fill:var(--p);opacity:.07}.art .o2{fill:var(--p);opacity:.2}
.art .f1{fill:var(--p)}.art .f2{fill:var(--hf)}.art .f3{fill:var(--ht);opacity:.55}.art .f4{fill:var(--soft)}.art .f5{fill:#fff}.art .f6{fill:var(--line)}.art .f7{fill:#f5b73b}
.art .e{stroke:var(--line);stroke-width:2}.art .e2{stroke:var(--p);stroke-width:2.5}.art .op{opacity:.55}
.art .s1,.art .s2,.art .s3,.art .s4,.art .s5{fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
.art .s1{stroke:var(--p)}.art .s2{stroke:#fff}.art .s3{stroke:var(--hf)}.art .s4{stroke:#f5b73b}.art .s5{stroke:var(--p);opacity:.35}
.art .thin{stroke-width:3}.art .dash{stroke-dasharray:1 14;opacity:.6}
.about{display:grid;grid-template-columns:1.2fr 1fr;gap:64px;align-items:start}
.about.one{grid-template-columns:1fr;max-width:820px}
.about .body p{font-size:18px;line-height:1.8}
.about .body p+p{margin-top:16px;color:var(--muted)}
.ph{border-radius:var(--rc);margin-bottom:24px;width:100%;object-fit:cover;max-height:380px}
.about .facts{background:#fff;border:1px solid var(--line);border-top:4px solid var(--p);border-radius:var(--rc);padding:10px 26px;box-shadow:0 18px 40px -28px rgba(15,23,42,.35)}
.about .facts div:last-child{border-bottom:0}
.facts{border-top:2px solid var(--p)}
.facts div{display:flex;gap:16px;padding:15px 2px;border-bottom:1px solid var(--line)}
.facts dt{width:84px;flex:none;color:var(--muted);font-size:15px}
.facts dd{font-weight:700}
.facts a{text-decoration:none}
.contact-box{max-width:780px;background:#fff;border:1px solid var(--line);border-radius:var(--rc);padding:12px 30px 30px}
.contact-box .facts{border-top:0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}
.card{background:#fff;border:1px solid var(--line);border-radius:var(--rc);padding:32px 28px;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 22px 44px -28px rgba(15,23,42,.4)}
.card p{color:var(--muted);font-size:16px}
.icw{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:16px;background:var(--soft);color:var(--p);margin-bottom:20px;border:1px solid var(--line)}
.ic{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.rows{border-top:2px solid var(--ink)}
.rows li{display:grid;grid-template-columns:96px 1fr;gap:24px;padding:30px 4px;border-bottom:1px solid var(--line);align-items:start}
.rows em{font-style:normal;font-size:34px;font-weight:800;color:var(--p);line-height:1.1;letter-spacing:-.02em}
.rows p{color:var(--muted)}
.numband{background:radial-gradient(circle at 8% 0%,rgba(255,255,255,.1) 0 180px,transparent 181px),linear-gradient(135deg,var(--hf),var(--ht));color:#fff;padding:80px 0}
.numband .kicker{color:rgba(255,255,255,.75)}
.numband .num b{color:#fff}
.numband .num span{color:rgba(255,255,255,.82)}
.numband .num+.num{border-left:1px solid rgba(255,255,255,.18)}
.nums{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:20px;text-align:center}
.num{padding:12px}
.num b{display:block;font-size:52px;color:var(--p);letter-spacing:-.03em;line-height:1.15;margin-bottom:8px;font-weight:800}
.num span{color:var(--muted);font-weight:600}
.certs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.cert{display:flex;gap:14px;align-items:flex-start;padding:20px 22px;border:1px solid var(--line);border-radius:var(--rc);background:#fff}
.cert i{flex:none;width:30px;height:30px;border-radius:50%;background:var(--p);color:var(--op);font-style:normal;display:grid;place-items:center;font-size:14px;margin-top:1px}
.cert b{display:block}
.cert span{display:block;color:var(--muted);font-size:14px}
.timeline{border-left:2px solid var(--line);margin-left:6px}
.timeline li{display:grid;grid-template-columns:110px 1fr;gap:16px;padding:14px 0 14px 26px;position:relative}
.timeline li::before{content:'';position:absolute;left:-7px;top:22px;width:12px;height:12px;border-radius:50%;background:var(--p);box-shadow:0 0 0 4px var(--soft)}
.timeline b{color:var(--p)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;counter-reset:s}
.step{padding:30px 26px;border-radius:var(--rc);background:#fff;border:1px solid var(--line);position:relative}
.step em{display:block;font-style:normal;font-weight:800;font-size:15px;letter-spacing:.08em;color:var(--p);margin-bottom:14px}
.step em::before{content:'STEP '}
.step p{color:var(--muted);font-size:15px}
.faq{max-width:860px;display:flex;flex-direction:column;gap:12px}
details{background:#fff;border:1px solid var(--line);border-radius:var(--rc);padding:22px 26px}
summary{cursor:pointer;font-weight:700;font-size:17px;list-style:none;display:flex;align-items:flex-start;gap:12px}
summary::before{content:'Q';color:var(--p);font-weight:800}
summary::-webkit-details-marker{display:none}
summary::after{content:'+';color:var(--p);font-size:24px;line-height:1;margin-left:auto}
details[open] summary::after{content:'−'}
details p{margin-top:12px;color:var(--muted);padding-left:22px}
.cta{background:radial-gradient(circle at 12% 120%,rgba(255,255,255,.14) 0 220px,transparent 221px),radial-gradient(circle at 92% -10%,rgba(255,255,255,.1) 0 180px,transparent 181px),linear-gradient(135deg,var(--hf),var(--p));color:var(--op);text-align:center;padding:96px 0}
.cta h2{color:#fff}
.cta p{opacity:.92;margin:0 auto 30px;max-width:640px;font-size:18px}
.cta .tel{display:block;font-size:36px;font-weight:800;margin-bottom:24px;text-decoration:none;letter-spacing:.01em}
.cta .btn{background:#fff;color:var(--p)}
.ft{background:var(--fb);color:var(--fi);padding:56px 0;font-size:14px}
.ft b{color:#fff;font-size:18px;display:block;margin-bottom:12px}
.ft p{margin-top:4px}
.ft .sep{opacity:.4;margin:0 8px;font-style:normal}
.ft .copy{margin-top:20px;opacity:.7}
@media (max-width:900px){
.hero-grid{grid-template-columns:1fr;gap:36px}
.hero-art{max-width:460px}
}
@media (max-width:720px){
body{font-size:16px}
section{padding:68px 0}
h2{font-size:27px}
.lead{font-size:16px}
.w{padding:0 20px}
.hd .w{flex-wrap:wrap;gap:6px 14px;padding-top:10px;padding-bottom:8px;min-height:60px}
.logo{font-size:18px}
.logo img{height:32px}
.mark{width:32px;height:32px;font-size:15px}
.menu{order:3;width:100%;margin-left:0;gap:18px}
.hd .btn{margin-left:auto}
.sp{display:none}
.hero{padding:76px 0 68px}
.hero.split{padding:56px 0 64px}
.hero h1,.hero.split h1{font-size:33px}
.hero .sub{font-size:16px}
.hero-art{max-width:340px;margin:0 auto}
.btns .btn{flex:1 1 auto}
.about{grid-template-columns:1fr;gap:28px}
.about .body p{font-size:16px}
.num b{font-size:38px}
.numband .num+.num{border-left:0}
.rows li{grid-template-columns:56px 1fr;gap:14px;padding:22px 2px}
.rows em{font-size:24px}
.timeline li{grid-template-columns:72px 1fr}
.cta .tel{font-size:27px}
.contact-box{padding:6px 18px 22px}
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
      const plain = !['header', 'hero', 'cta', 'footer'].includes(b.type) && !(b.type === 'numbers' && str(b.props.layout) !== 'plain')
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
