/**
 * 업체 기록 → 홈페이지 초안 (D-202).
 *
 * 사실(회사명 · 대표 · 사업자등록번호 · 주소 · 전화 · 설립일 · 직원 수 · 인증 · 특허 · 연구소)은 업체 기록에서만 가져온다 —
 * '자료에서 찾은 후보'(아직 확인 안 한 값)는 쓰지 않는다(usableFactValue). 없으면 비워 두고 점검이 알린다.
 * 다짐 · 소개 같은 말은 업종 견본에서 가져오고 '견본' 표시(sample)를 단다.
 *
 * 전화: 홈페이지에는 회사 대표 전화만 넣는다. 담당자 휴대폰은 저절로 넣지 않는다(D-146 — 대표자 휴대폰번호는 서류함에서도 뺐다).
 */
import { particle } from '../../lib/josa'
import { usableFactValue } from '../customerFacts'
import type { ClientOpsRecord } from '../../types/clientOps'
import { INDUSTRY_PALETTE } from './theme'
import { industryDef, industryOf } from './industry'
import type { BlockType, IndustryKey, ListItem, PropValue, SiteBlock, SiteDoc } from './types'

export interface SiteFacts {
  companyName: string
  representative: string
  businessNumber: string
  address: string
  /** 회사 대표 전화 — 없으면 '' */
  phone: string
  /** 대표 전화가 없을 때 [담당자 번호 넣기] 로 쓸 수 있는 번호(저절로는 안 넣는다) */
  contactPhone: string
  email: string
  establishedAt: string
  /** 설립 몇 년째 (기준일 기준 · 1년 미만 0 · 모르면 null) */
  years: number | null
  employees: number | null
  category: string
  item: string
  certifications: string[]
  patents: string[]
  researchLab: string
  region: string
}

const SPLIT = /\s*(?:[,，、·;\n/]|그리고|및)\s*/

function listOf(text: string): string[] {
  return text
    .split(SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length <= 60)
    .filter((s, i, all) => all.indexOf(s) === i)
}

/** 사업자등록번호를 000-00-00000 으로 (10자리가 아니면 적힌 그대로) */
export function formatBizNo(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : raw.trim()
}

/** '서울특별시 강남구 …' → '서울 강남구' */
export function regionOf(address: string): string {
  const parts = address.trim().split(/\s+/)
  if (!parts[0]) return ''
  const head = parts[0]
    .replace(/특별자치시|특별자치도|특별시|광역시/, '')
    .replace(/^(경기|강원|충청북|충청남|전라북|전라남|경상북|경상남|제주)도$/, (_, p: string) => ({ 경기: '경기', 강원: '강원', 충청북: '충북', 충청남: '충남', 전라북: '전북', 전라남: '전남', 경상북: '경북', 경상남: '경남', 제주: '제주' })[p] ?? p)
  const second = parts[1] && /[시군구]$/.test(parts[1]) ? ` ${parts[1]}` : ''
  return `${head}${second}`.trim()
}

function yearsSince(date: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(today)
  if (!m || !t) return null
  let y = Number(t[1]) - Number(m[1])
  if (Number(t[2]) < Number(m[2]) || (Number(t[2]) === Number(m[2]) && Number(t[3]) < Number(m[3]))) y -= 1
  return y < 0 ? null : y
}

export function siteFacts(record: ClientOpsRecord, today: string): SiteFacts {
  const fact = (k: string) => usableFactValue(record, k).trim()
  const est = fact('establishedAt')
  const empRaw = fact('employeeCount').replace(/[^\d]/g, '')
  const lab = fact('researchLab')
  return {
    companyName: fact('companyName') || record.companyName.trim(),
    representative: fact('representativeName'),
    businessNumber: formatBizNo(fact('businessNumber')),
    address: fact('businessAddress'),
    phone: (record.companyPhone ?? '').trim(),
    contactPhone: (record.contactPhone ?? '').trim(),
    email: (record.contactEmail ?? '').trim(),
    establishedAt: est,
    years: est ? yearsSince(est, today) : null,
    employees: empRaw ? Number(empRaw) : null,
    category: fact('businessCategory'),
    item: fact('businessItem') || (record.industry ?? '').trim(),
    certifications: listOf(fact('certifications')),
    patents: listOf(fact('patents')),
    researchLab: lab && !/^(없음|아니오|미보유|해당 ?없음)$/.test(lab) ? lab : '',
    region: regionOf(fact('businessAddress')),
  }
}

/** 업체 기록에서 업종 알아보기 */
export function industryForRecord(record: ClientOpsRecord): IndustryKey {
  return industryOf(usableFactValue(record, 'businessCategory'), usableFactValue(record, 'businessItem'), record.industry ?? '')
}

/** 종목이 너무 길면 앞 것 하나만(큰 문구에 쓴다) */
function shortItem(item: string, fallback: string): string {
  const first = listOf(item)[0] ?? ''
  return first && first.length <= 24 ? first : fallback
}

/** 블록 하나 — 칸 기본값 + 이번에 채운 값 */
function block(type: BlockType, id: string, props: Record<string, PropValue>, sample: string[] = []): SiteBlock {
  return { id, type, props, ...(sample.length ? { sample } : {}) }
}

export interface DraftOptions {
  /** 업종을 직접 고르면 그것으로(안 고르면 업체 기록으로 알아봄) */
  industry?: IndustryKey
  today: string
  now: string
  /** 블록 id 만들기(시험에서 고정) */
  makeId?: () => string
}

let seq = 0
const defaultId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

/**
 * 초안 만들기 — 머리줄 · 첫 화면 · 회사 소개 · 사업 · (숫자 · 인증 — 사실이 있을 때만) · 순서 · 질문 · 문의 띠 · 연락처 · 바닥.
 */
export function draftSite(record: ClientOpsRecord, opts: DraftOptions): SiteDoc {
  const makeId = opts.makeId ?? defaultId
  const f = siteFacts(record, opts.today)
  const industry = opts.industry ?? industryForRecord(record)
  const ind = industryDef(industry)
  const company = f.companyName || '회사 이름'
  const item = shortItem(f.item, ind.fallbackItem)
  const fill = (s: string) => s.replace(/\{item\}/g, item).replace(/\{company\}/g, company)

  const blocks: SiteBlock[] = []
  blocks.push(block('header', makeId(), { logoText: company, logoImage: '', showMenu: true, ctaLabel: '문의하기' }))
  blocks.push(
    block(
      'hero',
      makeId(),
      {
        layout: 'split',
        eyebrow: [company, f.item ? shortItem(f.item, '') : ''].filter(Boolean).join(' · '),
        title: fill(ind.heroTitle),
        subtitle: fill(ind.heroSubtitle),
        buttonLabel: '문의하기',
        buttonTarget: 'contact',
        buttonUrl: '',
        image: '',
        align: 'left',
        showFacts: true,
      },
      ['title', 'subtitle'],
    ),
  )

  // 회사 소개 — 첫 문장은 사실로만, 둘째 문장은 견본
  const estYear = /^(\d{4})/.exec(f.establishedAt)?.[1] ?? ''
  const first = [
    `${company}${particle(company, '은/는')}`,
    estYear ? `${estYear}년` : '',
    f.region ? `${f.region}에서 시작한` : estYear ? '설립한' : '',
    f.item ? `${shortItem(f.item, ind.fallbackItem)} 전문 기업입니다.` : `${ind.label.split(' ')[0]} 기업입니다.`,
  ]
    .filter(Boolean)
    .join(' ')
  const facts: ListItem[] = []
  if (f.establishedAt) facts.push({ label: '설립', value: f.establishedAt.replace(/^(\d{4})-(\d{2})-\d{2}$/, (_, y: string, m: string) => `${y}년 ${Number(m)}월`) })
  if (f.representative) facts.push({ label: '대표', value: f.representative })
  if (f.category || f.item) facts.push({ label: '업종', value: [f.category, f.item].filter(Boolean).join(' · ').slice(0, 60) })
  if (f.region) facts.push({ label: '소재지', value: f.region })
  if (f.employees && f.employees > 0) facts.push({ label: '직원', value: `${f.employees}명` })

  // 사실 블록 — 숫자 · 인증 (있을 때만)
  const numbers: ListItem[] = []
  if (f.years !== null && f.years >= 1) numbers.push({ value: `${f.years}년`, label: '업력' })
  if (f.employees !== null && f.employees >= 5) numbers.push({ value: `${f.employees}명`, label: '함께하는 사람' })
  const certItems: ListItem[] = [
    ...f.certifications.map((name) => ({ name, detail: '' })),
    ...(f.researchLab ? [{ name: '기업부설연구소', detail: /인정|설립|\d{4}/.test(f.researchLab) && f.researchLab.length <= 40 ? f.researchLab : '' }] : []),
    ...f.patents.map((name) => ({ name: /특허/.test(name) ? name : `특허 · ${name}`, detail: '' })),
  ].slice(0, 12)
  if (f.certifications.length + (f.researchLab ? 1 : 0) > 0) numbers.push({ value: `${f.certifications.length + (f.researchLab ? 1 : 0)}건`, label: '보유 인증' })
  if (f.patents.length > 0) numbers.push({ value: `${f.patents.length}건`, label: '특허' })

  // 종목이 여럿이면 그것을 사업 카드로 — 단 '광고물 제조업' 처럼 업종 분류 이름(…업)이 섞여 있으면 견본 카드가 낫다(D-205)
  const ownItems = listOf(f.item).slice(0, 6)
  const servicesFromRecord = ownItems.length >= 2 && !ownItems.some((x) => /업$/.test(x))
  const services: ListItem[] = servicesFromRecord ? ownItems.map((name) => ({ name, desc: '' })) : ind.services.map((s) => ({ ...s }))

  for (const t of ind.include) {
    if (t === 'about') {
      blocks.push(block('about', makeId(), { title: '회사 소개', body: `${first}\n${ind.aboutPromise}`, image: '', facts }, ['body']))
      if (numbers.length >= 2) blocks.push(block('numbers', makeId(), { layout: 'band', title: `숫자로 보는 ${company}`, items: numbers }))
    } else if (t === 'services') {
      blocks.push(block('services', makeId(), { layout: 'icons', title: ind.servicesTitle, intro: '', items: services }, servicesFromRecord ? [] : ['items']))
      if (certItems.length > 0) blocks.push(block('certs', makeId(), { title: '인증 · 특허', intro: '', items: certItems }))
    } else if (t === 'process') {
      blocks.push(block('process', makeId(), { title: ind.processTitle, intro: '', items: ind.process.map((s) => ({ ...s })) }, ['items']))
    } else if (t === 'faq') {
      blocks.push(block('faq', makeId(), { title: '자주 묻는 질문', items: ind.faq.map((s) => ({ ...s })) }, ['items']))
    } else if (t === 'cta') {
      blocks.push(block('cta', makeId(), { title: ind.ctaTitle, body: ind.ctaBody, buttonLabel: '문의하기', showPhone: true }, ['body']))
    } else if (t === 'contact') {
      blocks.push(
        block(
          'contact',
          makeId(),
          { title: '연락처 · 오시는 길', address: f.address, phone: f.phone, email: f.email, hours: ind.hours, showMapLink: Boolean(f.address) },
          ['hours'],
        ),
      )
    }
  }
  blocks.push(
    block('footer', makeId(), {
      companyName: company === '회사 이름' ? '' : company,
      representative: f.representative,
      businessNumber: f.businessNumber,
      showBusinessNumber: true,
      address: f.address,
      phone: f.phone,
      email: f.email,
      extra: '',
    }),
  )

  const description = `${first} ${f.region ? `${f.region} · ` : ''}${item} 문의는 ${f.phone || '홈페이지 연락처'}로.`.slice(0, 150)
  return {
    v: 1,
    industry,
    theme: { palette: INDUSTRY_PALETTE[industry], font: industry === 'professional' ? 'serif' : 'sans', corner: 'round' },
    seo: { title: `${company}${item ? ` | ${item}` : ''}`.slice(0, 60), description },
    blocks,
    createdAt: opts.now,
    updatedAt: opts.now,
  }
}

/** 블록 하나를 새로 더할 때의 기본값 (견본 표시 포함) */
export function newBlock(type: BlockType, record: ClientOpsRecord | null, industry: IndustryKey, today: string, id: string): SiteBlock {
  const ind = industryDef(industry)
  const f = record ? siteFacts(record, today) : null
  const company = f?.companyName || '회사 이름'
  switch (type) {
    case 'header':
      return block(type, id, { logoText: company, logoImage: '', showMenu: true, ctaLabel: '문의하기' })
    case 'hero':
      return block(type, id, { layout: 'split', eyebrow: company, title: ind.heroTitle.replace(/\{item\}/g, ind.fallbackItem), subtitle: '', buttonLabel: '문의하기', buttonTarget: 'contact', buttonUrl: '', image: '', align: 'left', showFacts: true }, ['title'])
    case 'about':
      return block(type, id, { title: '회사 소개', body: ind.aboutPromise, image: '', facts: [] }, ['body'])
    case 'services':
      return block(type, id, { layout: 'icons', title: ind.servicesTitle, intro: '', items: ind.services.map((s) => ({ ...s })) }, ['items'])
    case 'numbers':
      return block(type, id, { layout: 'band', title: '숫자로 보기', items: [{ value: '', label: '' }] })
    case 'certs':
      return block(type, id, { title: '인증 · 특허', intro: '', items: [{ name: '', detail: '' }] })
    case 'history': {
      const y = /^(\d{4})/.exec(f?.establishedAt ?? '')?.[1]
      return block(type, id, { title: '연혁', items: y ? [{ year: y, text: `${company} 설립` }] : [{ year: '', text: '' }] })
    }
    case 'process':
      return block(type, id, { title: ind.processTitle, intro: '', items: ind.process.map((s) => ({ ...s })) }, ['items'])
    case 'faq':
      return block(type, id, { title: '자주 묻는 질문', items: ind.faq.map((s) => ({ ...s })) }, ['items'])
    case 'cta':
      return block(type, id, { title: ind.ctaTitle, body: ind.ctaBody, buttonLabel: '문의하기', showPhone: true }, ['body'])
    case 'contact':
      return block(type, id, { title: '연락처 · 오시는 길', address: f?.address ?? '', phone: f?.phone ?? '', email: f?.email ?? '', hours: ind.hours, showMapLink: Boolean(f?.address) }, ['hours'])
    case 'footer':
      return block(type, id, { companyName: f?.companyName ?? '', representative: f?.representative ?? '', businessNumber: f?.businessNumber ?? '', showBusinessNumber: true, address: f?.address ?? '', phone: f?.phone ?? '', email: f?.email ?? '', extra: '' })
  }
}
