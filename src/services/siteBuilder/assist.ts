/**
 * D-300 홈페이지 만들기 AI 도우미 — 대표 "홈페이지 만들기에도 AI 단추".
 *
 * 초안은 여전히 규칙(업체 기록 + 업종 견본)으로 만든다. AI 는 [AI 도우미] 판에서 단추를 누를 때만(서버 /api/ai-assist · 대표만).
 *  - 보내는 것: 회사 이름 · 업종 · 하는 일 · 지역(시 · 구) · 설립 연수 · 직원 수 · 인증 · 특허 이름 · 연구소 여부 ·
 *    지금 블록 문구(사진 · 연락처 · 바닥 줄 빼고 · 견본 그대로인지) · 후기 요약(이름 없이).
 *    대표 이름 · 사업자번호 · 전화 · 메일 · 상세 주소는 보내지 않는다(사람 이름은 글 안에서도 가린다).
 *  - 받은 답을 블록에 넣는 것은 아래 규칙 함수 — 편집 화면과 같은 setProp(글자 수 한도 · 견본 표시 지우기 · 되돌리기 가능).
 */
import type { AssistBundle, AssistRow } from '../aiAssist/context'
import { personNames, safeText } from '../aiAssist/context'
import type { AssistItem } from '../aiAssist/client'
import type { ClientOpsRecord } from '../../types/clientOps'
import { blockDef } from './blocks'
import { siteFacts, type SitePromo } from './draft'
import { industryDef } from './industry'
import { setProp, setSeo } from './ops'
import type { ListItem, SiteBlock, SiteDoc } from './types'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = (today: string) => {
  const d = new Date(`${today}T00:00:00`)
  return Number.isNaN(d.getTime()) ? today : `${today} (${WEEKDAY[d.getDay()]})`
}
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const list = (v: unknown): ListItem[] => (Array.isArray(v) ? (v as ListItem[]) : [])

/** 블록 하나 → 보낼 한 줄(사진 · 연락처 · 바닥 줄 · 머리 줄은 뺀다) */
function blockRow(b: SiteBlock, names: readonly string[]): AssistRow | null {
  if (b.type === 'header' || b.type === 'footer' || b.type === 'contact' || b.type === 'logos') return null
  if (b.hidePc && b.hideMobile) return null
  const p = b.props
  const t = (v: unknown, max = 300) => safeText(str(v), names, max)
  const items = list(p.items)
  let 글 = ''
  switch (b.type) {
    case 'hero':
      글 = [t(p.eyebrow, 60), t(p.subtitle, 200)].filter(Boolean).join(' / ')
      break
    case 'about':
      글 = t(p.body, 600)
      break
    case 'services':
    case 'process':
      글 = items.map((x) => `${t(x.name, 40)} — ${t(x.desc, 120)}`).join(' | ')
      break
    case 'faq':
      글 = items.map((x) => `Q ${t(x.q, 80)}`).join(' | ')
      break
    case 'numbers':
      글 = items.map((x) => `${t(x.value, 16)} ${t(x.label, 24)}`).join(' · ')
      break
    case 'certs':
      글 = items.map((x) => t(x.name, 40)).join(' · ')
      break
    case 'history':
      글 = items.map((x) => `${t(x.year, 10)} ${t(x.text, 80)}`).join(' · ')
      break
    case 'gallery':
      글 = items.map((x) => t(x.title, 40)).filter(Boolean).join(' · ')
      break
    case 'reviews':
      // 후기는 몇 개인지만 — 손님 이름 · 원문은 보내지 않는다
      글 = items.length ? `후기 ${items.length}개(원문은 보내지 않음)` : ''
      break
    case 'cta':
      글 = t(p.body, 200)
      break
  }
  return {
    블록: blockDef(b.type)?.label ?? b.type,
    종류: b.type,
    제목: t(p.title, 80),
    글: 글.slice(0, 700),
    견본: b.sample && b.sample.length ? '견본 그대로' : '',
  }
}

/** AI 도우미에 보낼 자료 — 업체 기록(사람 · 연락처 빼고) + 지금 블록 문구 */
export function siteAssistBundle(i: { record: ClientOpsRecord; doc: SiteDoc; today: string; promo?: SitePromo }): AssistBundle {
  const f = siteFacts(i.record, i.today)
  const names = personNames(i.record)
  const t = (v: string, max = 120) => safeText(v, names, max)
  const company = t(f.companyName, 60)
  const record: AssistRow[] = [
    {
      회사: company,
      업종견본: industryDef(i.doc.industry).label,
      업태: t(f.category, 60),
      하는일: t(f.item, 120),
      지역: t(f.region, 40),
      설립: f.years == null ? '' : `${f.years}년째`,
      직원: f.employees == null ? '' : `${f.employees}명`,
      인증: f.certifications.map((x) => t(x, 40)).join(' · '),
      특허: f.patents.map((x) => t(x, 60)).join(' · '),
      연구소: f.researchLab ? '있음' : '',
    },
  ]
  const promo = i.promo
  const promoRows: AssistRow[] = promo && (promo.reviews || promo.hours) ? [{ 후기요약: t(promo.reviews ?? '', 80), 운영시간: t(promo.hours ?? '', 80) }] : []
  const blocks = i.doc.blocks.map((b) => blockRow(b, names)).filter((r): r is AssistRow => r !== null)
  return {
    links: {},
    context: {
      title: `홈페이지 · ${company}`,
      today: dayLabel(i.today),
      purpose: '업체 기록(사실)만으로 한 장짜리 업체 홈페이지 문구를 — 손님이 믿고 연락하게',
      sections: [
        { name: '업체 기록', rows: record },
        ...(promoRows.length ? [{ name: '홍보 정보', rows: promoRows }] : []),
        { name: '지금 블록', rows: blocks },
      ],
      facts: [`검색 제목: ${t(i.doc.seo.title, 60) || '(없음)'}`, `검색 설명: ${t(i.doc.seo.description, 120) || '(없음)'}`],
      rules: ['업체 기록에 없는 숫자 · 연도 · 인증 · 수상 · 고객사 · 후기 · 가격은 만들지 않는다.', '"최고 · 1위 · 100% · 보장 · 유일 · 무조건" 같은 말을 쓰지 않는다.'],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 답 → 블록에 넣기(규칙)                                                 */
/* ------------------------------------------------------------------ */

export type SiteCopyTarget = 'hero' | 'about' | 'services' | 'cta'

/** 답 항목의 tag → 넣을 블록(영어 이름 · 우리말 이름 둘 다) */
export function copyTargetOf(item: Pick<AssistItem, 'tag' | 'title'>): SiteCopyTarget | null {
  const tag = String(item.tag ?? '').toLowerCase()
  if (/hero|첫\s*화면/.test(tag)) return 'hero'
  if (/about|회사\s*소개|소개/.test(tag)) return 'about'
  if (/services?|하는\s*일|서비스/.test(tag)) return 'services'
  if (/cta|연락|문의/.test(tag)) return 'cta'
  return null
}

const cut = (s: string, max: number) => {
  const v = s.replace(/\r\n?/g, '\n').trim()
  return v.length > max ? v.slice(0, max).trim() : v
}

/** "이름 — 설명" 줄 → 목록 한 줄(— · - · : 어느 것으로 나눠도) */
function nameDesc(line: string): ListItem | null {
  const s = line.replace(/^[\s\-·•*\d.)]+/, '').trim()
  if (!s) return null
  const m = /^(.{1,40}?)\s*(?:—|–|-|:)\s+(.+)$/.exec(s)
  return m ? { name: cut(m[1], 40), desc: cut(m[2], 240) } : { name: cut(s, 40), desc: '' }
}

/** 문구 답 하나를 그 블록에 — 그 종류 블록이 없으면 null(화면이 '블록 더하기' 를 안내) */
export function applyCopy(doc: SiteDoc, item: AssistItem, now: string): { doc: SiteDoc; blockId: string; target: SiteCopyTarget } | null {
  const target = copyTargetOf(item)
  if (!target) return null
  const block = doc.blocks.find((b) => b.type === target)
  if (!block) return null
  const title = str(item.title)
  const body = str(item.body) || str(item.detail)
  let next = doc
  if (target === 'hero') {
    if (title.trim()) next = setProp(next, block.id, 'title', cut(title, 80), now)
    if (body.trim()) next = setProp(next, block.id, 'subtitle', cut(body, 200), now)
  } else if (target === 'about') {
    if (title.trim()) next = setProp(next, block.id, 'title', cut(title, 60), now)
    if (body.trim()) next = setProp(next, block.id, 'body', cut(body, 1200), now)
  } else if (target === 'services') {
    if (title.trim()) next = setProp(next, block.id, 'title', cut(title, 60), now)
    const items = (item.outline ?? []).map((l) => nameDesc(String(l))).filter((x): x is ListItem => x !== null).slice(0, 9)
    if (items.length) next = setProp(next, block.id, 'items', items, now)
  } else {
    if (title.trim()) next = setProp(next, block.id, 'title', cut(title, 60), now)
    if (body.trim()) next = setProp(next, block.id, 'body', cut(body, 200), now)
  }
  return next === doc ? null : { doc: next, blockId: block.id, target }
}

/** 자주 묻는 질문 답 하나를 그 블록에 — 아직 견본 질문이면 견본을 비우고 이것부터, 아니면 뒤에 더한다(10개까지) */
export function applyFaq(doc: SiteDoc, blockId: string, item: AssistItem, now: string): SiteDoc | null {
  const block = doc.blocks.find((b) => b.id === blockId && b.type === 'faq')
  const q = cut(str(item.title), 80)
  const a = cut(str(item.body) || str(item.detail), 400)
  if (!block || !q || !a) return null
  const sampleItems = !!block.sample?.includes('items')
  const before = sampleItems ? [] : list(block.props.items).filter((x) => str(x.q).trim() || str(x.a).trim())
  if (before.some((x) => str(x.q).trim() === q)) return null
  if (before.length >= 10) return null
  return setProp(doc, blockId, 'items', [...before, { q, a }], now)
}

/** 검색 제목 · 설명 답 하나를 검색 정보에 */
export function applySeo(doc: SiteDoc, item: AssistItem, now: string): SiteDoc | null {
  const title = cut(str(item.title), 60)
  const description = cut(str(item.detail) || str(item.body), 160)
  if (!title && !description) return null
  return setSeo(doc, { ...(title ? { title } : {}), ...(description ? { description } : {}) }, now)
}
