/**
 * 지원사업 공고 — 글 읽기 · 기업마당 파일 읽기 · 영업 문구 · 공개 링크 (D-141). 순수 함수.
 *
 *  - 공고문을 그대로 붙여 넣으면 공고명 · 소관 · 신청기간 · 지원대상 · 조건(창업 N년 이내 · 지역 · 업종 …)을 읽는다.
 *    읽은 값은 저장 전에 사람이 본다(바로 저장하지 않는다).
 *  - 기업마당 지원사업 API 응답(JSON)을 파일로 받아 두었으면 한꺼번에 넣는다.
 *  - 규칙으로 읽는다(LLM 호출 0). 못 읽은 칸은 비워 둔다 — 지어내지 않는다.
 */
import {
  GRANT_CATEGORY_LABEL,
  NO_RULES,
  OPEN_TOP,
  SIDO_LIST,
  certsFromText,
  rangeText,
  sidosOf,
  isCityName,
  type CertKey,
  type CompanyProfile,
  type CompanySize,
  type DeadlineKind,
  type GrantCategory,
  type GrantMatch,
  type GrantNotice,
  type GrantRules,
  type Range,
} from './grantMatch'

/* ------------------------------------------------------------------ */
/* 날짜                                                                 */
/* ------------------------------------------------------------------ */

const DATE_RE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?|(20\d{2})(\d{2})(\d{2})/g

function ymd(y: string, m: string, d: string): string {
  const mm = Number(m)
  const dd = Number(d)
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  // 2월 31일 같은 없는 날은 버린다
  const t = new Date(Date.UTC(Number(y), mm - 1, dd))
  if (t.getUTCMonth() !== mm - 1) return ''
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function datesAt(text: string): { date: string; at: number }[] {
  const out: { date: string; at: number }[] = []
  for (const m of text.matchAll(DATE_RE)) {
    const v = m[1] ? ymd(m[1], m[2], m[3]) : ymd(m[4], m[5], m[6])
    if (v) out.push({ date: v, at: m.index ?? 0 })
  }
  return out
}

export function datesIn(text: string): string[] {
  return datesAt(text).map((d) => d.date)
}

/** '2026.09.01 ~ 2026.09.30' · '~ 2026.10.15 18:00' · '예산 소진 시까지' · '상시' */
export function periodOf(text: string): { applyStart: string; applyEnd: string; deadlineKind: DeadlineKind } {
  const t = text.replace(/\s+/g, ' ')
  const found = datesAt(t)
  const dates = found.map((d) => d.date)
  const firstCome = /선착순|소진\s*시|예산\s*소진|조기\s*마감|모집\s*(?:완료|마감|규모\s*충족)/.test(t)
  const always = /상시|수시\s*(접수|모집)|연중/.test(t)
  if (dates.length >= 2) return { applyStart: dates[0], applyEnd: dates[1], deadlineKind: firstCome ? 'first_come' : 'date' }
  if (dates.length === 1) {
    const before = t.slice(0, found[0].at)
    const isEnd = /[~∼]|까지|마감/.test(before) || /까지|마감/.test(t.slice(found[0].at))
    return isEnd ? { applyStart: '', applyEnd: dates[0], deadlineKind: firstCome ? 'first_come' : 'date' } : { applyStart: dates[0], applyEnd: '', deadlineKind: firstCome ? 'first_come' : always ? 'always' : 'date' }
  }
  return { applyStart: '', applyEnd: '', deadlineKind: firstCome ? 'first_come' : always ? 'always' : 'date' }
}

/* ------------------------------------------------------------------ */
/* 갈래 · 조건                                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_WORDS: [GrantCategory, RegExp][] = [
  ['export', /수출|해외\s*(진출|마케팅|판로)|글로벌|무역/],
  ['hr', /인력|채용|고용|일자리|인건비|재취업|일\s*·?\s*생활\s*균형|근로/],
  ['rnd', /R&D|기술\s*개발|연구\s*개발|기술혁신|실증|시제품|개발\s*지원|AI|인공지능|스마트공장|디지털/i],
  ['marketing', /마케팅|판로|홍보|전시회|박람회|온라인\s*판매|라이브\s*커머스|브랜드/],
  ['startup', /창업|스타트업|예비\s*창업|초기\s*기업/],
  ['money', /융자|대출|보증|정책\s*자금|자금\s*지원|지원금|보조금|바우처|포상|이차\s*보전|경영\s*안정/],
]

/** 공고 갈래 — 제목 먼저 보고, 제목에 없으면 본문 */
export function categoryOf(title: string, body = ''): GrantCategory {
  for (const [c, re] of CATEGORY_WORDS) if (re.test(title)) return c
  for (const [c, re] of CATEGORY_WORDS) if (re.test(body)) return c
  return 'etc'
}

const INDUSTRY_WORDS: [string, RegExp][] = [
  ['제조', /제조/],
  ['정보통신', /정보통신|ICT|소프트웨어|SW\b/i],
  ['지식서비스', /지식\s*서비스/],
  ['도소매', /도\s*소매|유통/],
  ['음식·숙박', /음식점|숙박/],
  ['건설', /건설/],
  ['농림·수산', /농업|임업|어업|수산|농식품/],
  ['관광', /관광/],
  ['콘텐츠', /콘텐츠|문화산업/],
]

/** 지원대상 글 → 조건. 이 글에 분명히 적힌 것만 */
export function rulesFromText(target: string, whole = target, title = ''): GrantRules {
  const r: GrantRules = { ...NO_RULES, regions: [], cities: [], industries: [], excludeIndustries: [], sizes: [], certs: [] }
  const t = target.replace(/\s+/g, ' ')
  const all = `${title} ${whole}`.replace(/\s+/g, ' ')

  // 창업 N년 이내 · 업력 N년 미만 / 이상 — 강한 표현이라 본문 전체에서
  const within = /(?:창업|설립|업력)\s*(?:후\s*)?(\d{1,2})\s*년\s*(?:이내|미만|이하)/.exec(all)
  if (within) r.withinYears = Number(within[1])
  const minY = /업력\s*(\d{1,2})\s*년\s*이상/.exec(all)
  if (minY) r.minYears = Number(minY[1])

  // 청년 대표 — '만 39세 이하' · '청년 창업'
  if (/(?:만\s*)?39\s*세\s*이하|청년\s*(?:창업|기업|대표|사업자)/.test(all)) r.youthCeo = true
  if (/여성\s*(?:기업|대표|창업|CEO)/i.test(t)) r.womenCeo = true

  // 인증 · 규모 · 업종 — 지원대상 글에서만(본문에 지나가며 나온 말로 조건을 걸지 않는다)
  const certs = certsFromText(t).filter((c) => c !== 'women' || !r.womenCeo)
  if (/(?:보유|인증|확인)\s*(?:기업|업체)|(?:벤처|이노비즈|메인비즈)\s*(?:기업|인증)/.test(t)) r.certs = certs as CertKey[]
  const sizes: CompanySize[] = []
  if (/소상공인/.test(t)) sizes.push('micro')
  if (/중소\s*기업|중소\s*·\s*중견|중소·중견/.test(t)) sizes.push('small')
  if (/중견/.test(t)) sizes.push('mid')
  r.sizes = sizes
  for (const [label, re] of INDUSTRY_WORDS) if (re.test(t)) r.industries.push(label)
  const empMin = /(?:상시\s*)?(?:근로자|종업원|직원)\s*(\d{1,4})\s*(?:인|명)\s*이상/.exec(t)
  if (empMin) r.minEmployees = Number(empMin[1])
  const empMax = /(?:상시\s*)?(?:근로자|종업원|직원)\s*(\d{1,4})\s*(?:인|명)\s*(?:이하|미만)/.exec(t)
  if (empMax) r.maxEmployees = Number(empMax[1]) - (/미만/.test(empMax[0]) ? 1 : 0)
  const rev = /매출(?:액)?\s*(\d[\d,.]*)\s*(억|천만|백만)\s*원?\s*(이상|이하|미만)/.exec(t)
  if (rev) {
    const unit = rev[2] === '억' ? 100 : rev[2] === '천만' ? 10 : 1
    const m = Math.round(Number(rev[1].replace(/,/g, '')) * unit)
    if (rev[3] === '이상') r.minRevenueM = m
    else r.maxRevenueM = m - (rev[3] === '미만' ? 1 : 0)
  }

  // 예비창업자만 — 대상 글에 예비창업자만 있고 기업 · 사업자 말이 없을 때
  if (/예비\s*창업/.test(t) && !/(기업|업체|개인사업자|법인사업자|소상공인|법인|창업\s*\d)/.test(t.replace(/예비\s*창업자?/g, ''))) r.preStartupOnly = true

  // 지역 — 제목 머리 [경기] · 'OO시 소재' · '관내'
  const head = /^\s*\[([^\]]{2,10})\]/.exec(title)
  if (head) {
    // [서울ㆍ경기] 처럼 둘 이상도 · [전남광주] 는 전남 · 광주
    for (const part of head[1].split(/[ㆍ·,/\s]+/)) for (const s of sidosOf(part)) if (!r.regions.includes(s)) r.regions.push(s)
  }
  for (const m of all.matchAll(/([가-힣]{1,6}(?:특별자치시|특별자치도|광역시|특별시|도)?)\s*([가-힣]{1,5}[시군구])?\s*(?:내\s*)?(?:소재|관내|에\s*본사|주된\s*사무소)/g)) {
    const ss = sidosOf(m[1])
    for (const s of ss) if (!r.regions.includes(s)) r.regions.push(s)
    const city = m[2] ?? (ss.length === 0 ? m[1] : '')
    if (city && isCityName(city) && !r.cities.includes(city)) r.cities.push(city)
  }
  return r
}

/* ------------------------------------------------------------------ */
/* 공고문 붙여넣기                                                       */
/* ------------------------------------------------------------------ */

export type NoticeDraft = Omit<GrantNotice, 'id' | 'createdAt' | 'updatedAt' | 'published'>

/**
 * D-143: 소관이 지자체면 그 지역 공고다 — '경기도 파주시' → 경기 · 파주시, '서울특별시' → 서울.
 * 중앙부처(중소벤처기업부 · 고용노동부 …)는 지역이 없다(전국). 이미 지역 조건이 있으면 건드리지 않는다.
 */
export function withAgencyRegion(rules: GrantRules, agency: string): GrantRules {
  if (rules.regions.length || rules.cities.length) return rules
  const parts = agency.trim().split(/\s+/)
  const sds = parts.length ? sidosOf(parts[0]) : []
  if (sds.length === 0) return rules
  const city = parts[1] && isCityName(parts[1]) ? parts[1] : ''
  return { ...rules, regions: sds, cities: city ? [city] : [] }
}

const LABELS = /^(공고명|사업명|소관\s*부처(?:\s*[·ㆍ]\s*지자체)?|소관\s*기관|주관\s*기관|사업\s*수행\s*기관|수행\s*기관|신청\s*기간|접수\s*기간|모집\s*기간|지원\s*대상|신청\s*대상|사업\s*개요|지원\s*내용|지원\s*규모|문의처|신청\s*방법|사업\s*목적)\s*[:：]?\s*/

function section(lines: string[], label: RegExp, max = 4): string {
  const i = lines.findIndex((l) => label.test(l))
  if (i < 0) return ''
  const first = lines[i].replace(label, '').trim()
  const out = first ? [first] : []
  for (let j = i + 1; j < lines.length && out.length < max; j++) {
    if (LABELS.test(lines[j]) || /^https?:\/\//.test(lines[j])) break
    out.push(lines[j])
  }
  return out.join(' ').trim()
}

export function parseNoticeText(raw: string): NoticeDraft {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const labeledTitle = section(lines, /^(공고명|사업명)\s*[:：]?\s*/, 1)
  const title = (labeledTitle || lines.find((l) => l.length >= 6 && !LABELS.test(l)) || '').slice(0, 200)
  const agency = section(lines, /^(소관\s*부처(?:\s*[·ㆍ]\s*지자체)?|소관\s*기관|주관\s*기관)\s*[:：]?\s*/, 1).slice(0, 80)
  const operator = section(lines, /^(사업\s*수행\s*기관|수행\s*기관)\s*[:：]?\s*/, 1).slice(0, 80)
  const periodText = section(lines, /^(신청\s*기간|접수\s*기간|모집\s*기간)\s*[:：]?\s*/, 2)
  const target = section(lines, /^(지원\s*대상|신청\s*대상)\s*[:：]?\s*/, 5).slice(0, 600)
  const summary = (section(lines, /^(사업\s*개요|지원\s*내용|사업\s*목적)\s*[:：]?\s*/, 6) || '').slice(0, 1200)
  const amount = /(?:최대|업체당|기업당|과제당|개사당)\s*[\d,.]+\s*(?:억|천만|백만|만)?\s*원(?:\s*이내)?/.exec(raw.replace(/\s+/g, ' '))
  const url = /https?:\/\/[^\s<>"')]+/.exec(raw)?.[0] ?? ''
  // 신청기간 줄이 없으면 글 전체에서 '~ 날짜' 를 찾는다
  const period = periodText ? periodOf(periodText) : periodOf(/[~∼].{0,30}20\d{2}|20\d{2}.{0,30}[~∼]/.test(raw) ? (/.{0,40}[~∼].{0,40}/.exec(raw.replace(/\s+/g, ' '))?.[0] ?? '') : /선착순|소진|상시/.test(raw) ? raw : '')
  const whole = lines.join(' ')
  return {
    title,
    agency,
    operator,
    category: categoryOf(title, `${target} ${summary}`),
    ...period,
    amountText: amount ? amount[0].replace(/\s+/g, ' ').slice(0, 80) : '',
    target,
    summary,
    url,
    rules: withAgencyRegion(rulesFromText(target, whole, title), agency),
    source: 'paste',
  }
}

/* ------------------------------------------------------------------ */
/* 기업마당 지원사업 API 응답(JSON)                                       */
/* ------------------------------------------------------------------ */

const BIZINFO_REALM: Record<string, GrantCategory> = {
  금융: 'money',
  기술: 'rnd',
  인력: 'hr',
  수출: 'export',
  내수: 'marketing',
  창업: 'startup',
  경영: 'etc',
  기타: 'etc',
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

export interface BizinfoParse {
  drafts: NoticeDraft[]
  /** 공고명이 없어 못 읽은 줄 */
  skipped: number
}

/**
 * 기업마당(bizinfo.go.kr) 지원사업정보 API 응답 — `{ jsonArray: [...] }` 또는 배열.
 * 필드: pblancNm(공고명) · jrsdInsttNm(소관) · excInsttNm(수행) · reqstBeginEndDe(신청기간)
 *       · pldirSportRealmLclasCodeNm(분야) · trgetNm(대상) · bsnsSumryCn(개요) · pblancUrl · hashtags
 */
export function parseBizinfoJson(text: string): BizinfoParse {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { drafts: [], skipped: 0 }
  }
  const obj = data as Record<string, unknown>
  const arr = Array.isArray(data) ? data : Array.isArray(obj?.jsonArray) ? obj.jsonArray : Array.isArray((obj?.response as Record<string, unknown>)?.items) ? ((obj.response as Record<string, unknown>).items as unknown[]) : []
  const drafts: NoticeDraft[] = []
  let skipped = 0
  for (const it of arr as Record<string, unknown>[]) {
    const s = (k: string) => (typeof it?.[k] === 'string' ? stripHtml(it[k] as string) : '')
    const title = s('pblancNm')
    if (!title) {
      skipped += 1
      continue
    }
    const target = s('trgetNm')
    const summary = s('bsnsSumryCn').slice(0, 1200)
    const tags = s('hashtags')
    let rules = rulesFromText(`${target}`, `${summary}`, title)
    // 해시태그 — 시·도 · 시·군·구 · 업종 · 업력.
    // 전국 공고는 해시태그에 17개 시·도를 다 적어 둔다(실제 기업마당 응답) — 시·도가 여럿(4개 이상)이면 지역 조건으로 보지 않는다.
    const tagList = tags.split(/[,#\s]+/).filter(Boolean)
    const tagSidos = [...new Set(tagList.flatMap((tag) => (SIDO_LIST.includes(tag) ? [tag] : sidosOf(tag))))]
    if (tagSidos.length > 0 && tagSidos.length <= 3) for (const sd of tagSidos) if (!rules.regions.includes(sd)) rules.regions.push(sd)
    // 시·군·구 태그(안산시 · 화천군) — 공고 이름 · 대상 · 개요에도 그 이름이 있을 때만(행사 장소 같은 태그는 거른다)
    const body = `${title} ${target} ${summary}`
    if (tagSidos.length <= 3)
      for (const tag of tagList)
        if (tag.length >= 3 && isCityName(tag) && body.includes(tag) && !rules.cities.includes(tag)) rules.cities.push(tag)
    // 이름 앞 '[경기] 부천시 …' — 시·군·구 공고
    const head = /^\s*\[[^\]]{1,12}\]\s*([가-힣]{2,4}[시군구])\s/.exec(title)
    if (head && isCityName(head[1]) && !rules.cities.includes(head[1])) rules.cities.push(head[1])
    for (const tag of tagList) for (const [label, re] of INDUSTRY_WORDS) if (re.test(tag) && !rules.industries.includes(label)) rules.industries.push(label)
    if (rules.withinYears === null) {
      const y = /(?:창업|업력)\s*(\d{1,2})\s*년\s*(?:이하|이내|미만)/.exec(tags)
      if (y) rules.withinYears = Number(y[1])
    }
    rules = withAgencyRegion(rules, s('jrsdInsttNm'))
    const urlRaw = s('pblancUrl')
    const url = /^https?:\/\//.test(urlRaw) ? urlRaw : urlRaw.startsWith('/') ? `https://www.bizinfo.go.kr${urlRaw}` : ''
    const realm = s('pldirSportRealmLclasCodeNm')
    drafts.push({
      title: title.slice(0, 200),
      agency: s('jrsdInsttNm').slice(0, 80),
      operator: s('excInsttNm').slice(0, 80),
      category: categoryOf(title, '') !== 'etc' ? categoryOf(title, '') : BIZINFO_REALM[realm] ?? categoryOf(title, `${target} ${summary}`),
      ...periodOf(s('reqstBeginEndDe')),
      amountText: '',
      target: target.slice(0, 600),
      summary,
      url,
      rules,
      source: 'bizinfo',
      ...(s('pblancId') ? { externalId: s('pblancId').slice(0, 40) } : {}),
    })
  }
  return { drafts, skipped }
}

/* ------------------------------------------------------------------ */
/* 영업 문구 (카톡 · 문자)                                                */
/* ------------------------------------------------------------------ */

export function shareMessage(o: { companyName: string; profileLine: string; matches: GrantMatch[]; link: string; sender: string; max?: number }): string {
  const max = o.max ?? 5
  const fit = o.matches.filter((m) => m.verdict === 'fit')
  const check = o.matches.filter((m) => m.verdict === 'check')
  const top = [...fit, ...check].slice(0, max)
  const who = o.companyName.trim() ? `${o.companyName.trim()} 대표님` : '대표님'
  const lines = [
    `${who}, 안녕하세요. ${o.sender}입니다.`,
    '',
    `대표님 회사 조건${o.profileLine ? `(${o.profileLine})` : ''}으로 지금 신청할 수 있는 지원사업을 찾아봤습니다.`,
    `조건이 맞는 사업 ${fit.length}건${check.length ? `, 한두 가지만 확인하면 되는 사업 ${check.length}건` : ''}입니다.`,
    '',
    ...top.map((m) => `· ${m.notice.title} — ${m.deadline.label}${m.verdict === 'check' ? ' (확인 필요)' : ''}`),
  ]
  if (fit.length + check.length > top.length) lines.push(`· 그 외 ${fit.length + check.length - top.length}건`)
  if (o.link) lines.push('', `조건별로 자세히 보기: ${o.link}`)
  lines.push('', '신청 서류 준비나 자격 확인이 필요하시면 편하게 말씀 주세요.')
  return lines.join('\n')
}

/** 공고 하나를 여러 업체에 알릴 때 — 업체마다 한 통 */
export function noticeMessage(o: { companyName: string; match: GrantMatch; sender: string }): string {
  const n = o.match.notice
  const who = o.companyName.trim() ? `${o.companyName.trim()} 대표님` : '대표님'
  const okReasons = o.match.reasons.filter((r) => r.state === 'ok' && r.key !== 'region').map((r) => r.text.split(' — ')[0])
  const unknown = o.match.reasons.filter((r) => r.state === 'unknown').map((r) => r.label)
  return [
    `${who}, 안녕하세요. ${o.sender}입니다.`,
    '',
    `대표님 회사에 맞는 지원사업 공고가 있어 알려 드립니다.`,
    '',
    `■ ${n.title}`,
    n.agency ? `· 소관: ${n.agency}` : '',
    `· 마감: ${o.match.deadline.label}${n.applyEnd ? ` (${Number(n.applyEnd.slice(5, 7))}월 ${Number(n.applyEnd.slice(8, 10))}일)` : ''}`,
    n.amountText ? `· 지원: ${n.amountText}` : '',
    okReasons.length ? `· 맞는 조건: ${okReasons.join(', ')}` : '',
    unknown.length ? `· 확인할 것: ${unknown.join(', ')}` : '',
    n.url ? `· 공고: ${n.url}` : '',
    '',
    '신청을 원하시면 서류 준비부터 도와드리겠습니다.',
  ]
    .filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '')
    .join('\n')
}

/* ------------------------------------------------------------------ */
/* 공개 링크 — 가망고객이 로그인 없이 자기 조건으로 보는 화면                 */
/* ------------------------------------------------------------------ */

export const FINDER_PATH = '/grants/find'

function encRange(r: Range | null): string {
  if (!r) return ''
  return `${r.lo}-${r.hi >= OPEN_TOP / 10 ? '' : r.hi}`
}

function decRange(s: string | null): Range | null {
  if (!s) return null
  const m = /^(\d{1,9})-(\d{0,12})$/.exec(s)
  if (!m) return null
  const lo = Number(m[1])
  const hi = m[2] === '' ? OPEN_TOP : Number(m[2])
  return hi >= lo ? { lo, hi } : null
}

/** 업체 조건 → 링크 뒤에 붙는 값 (회사 이름 · 지역 · 업종 · 구간만. 연락처 · 번호는 넣지 않는다) */
export function profileToQuery(p: CompanyProfile, opts: { from?: string } = {}): string {
  const q = new URLSearchParams()
  if (p.name) q.set('n', p.name.slice(0, 40))
  if (p.sido) q.set('r', p.sido)
  if (p.city) q.set('c', p.city)
  if (p.industry) q.set('i', p.industry.split(' · ')[0].slice(0, 30))
  if (p.years) q.set('y', encRange(p.years))
  if (p.employees) q.set('e', encRange(p.employees))
  if (p.revenueM) q.set('m', encRange(p.revenueM))
  if (p.ceoAge) q.set('a', encRange(p.ceoAge.hi <= 39 ? { lo: 0, hi: 39 } : { lo: 40, hi: OPEN_TOP }))
  if (p.female !== null) q.set('f', p.female ? '1' : '0')
  if (p.certsKnown) q.set('k', p.certs.join('.') || '-')
  if (opts.from) q.set('from', opts.from.slice(0, 40))
  return q.toString()
}

export function profileFromQuery(search: string): CompanyProfile {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const sido = SIDO_LIST.includes(q.get('r') ?? '') ? (q.get('r') as string) : ''
  const certs = (q.get('k') ?? '').split('.').filter((c): c is CertKey => ['venture', 'innobiz', 'mainbiz', 'lab', 'women'].includes(c))
  return {
    name: (q.get('n') ?? '').slice(0, 40),
    sido,
    city: sido ? (q.get('c') ?? '').slice(0, 10) : '',
    industry: (q.get('i') ?? '').slice(0, 30),
    years: decRange(q.get('y')),
    employees: decRange(q.get('e')),
    revenueM: decRange(q.get('m')),
    ceoAge: decRange(q.get('a')),
    female: q.get('f') === '1' ? true : q.get('f') === '0' ? false : null,
    certs,
    certsKnown: q.has('k'),
  }
}

/* ------------------------------------------------------------------ */
/* 가망고객이 고르는 칩                                                   */
/* ------------------------------------------------------------------ */

export interface RangeChip {
  label: string
  range: Range
}

export const YEARS_CHIPS: RangeChip[] = [
  { label: '1년 미만', range: { lo: 0, hi: 0 } },
  { label: '1~3년', range: { lo: 1, hi: 2 } },
  { label: '3~7년', range: { lo: 3, hi: 6 } },
  { label: '7년 이상', range: { lo: 7, hi: OPEN_TOP } },
]
export const EMPLOYEE_CHIPS: RangeChip[] = [
  { label: '1~4명', range: { lo: 0, hi: 4 } },
  { label: '5~9명', range: { lo: 5, hi: 9 } },
  { label: '10~49명', range: { lo: 10, hi: 49 } },
  { label: '50명 이상', range: { lo: 50, hi: OPEN_TOP } },
]
export const REVENUE_CHIPS: RangeChip[] = [
  { label: '1억 미만', range: { lo: 0, hi: 99 } },
  { label: '1~10억', range: { lo: 100, hi: 999 } },
  { label: '10~50억', range: { lo: 1000, hi: 4999 } },
  { label: '50억 이상', range: { lo: 5000, hi: OPEN_TOP } },
]
export const AGE_CHIPS: RangeChip[] = [
  { label: '만 39세 이하', range: { lo: 0, hi: 39 } },
  { label: '40세 이상', range: { lo: 40, hi: OPEN_TOP } },
]
export const INDUSTRY_CHIPS = ['제조업', '정보통신·소프트웨어', '도소매', '서비스', '건설', '음식·숙박', '농림·수산', '기타']

/** 업체 값이 칩 하나에 딱 들어가면 그 칩 (정확한 값 → 칩 표시) */
export function chipOf(chips: RangeChip[], r: Range | null): string {
  if (!r) return ''
  const hit = chips.find((c) => r.lo >= c.range.lo && r.hi <= c.range.hi)
  return hit?.label ?? ''
}

/** 칩 → 사람 말 (공개 화면 머리줄) */
export function profileChipsText(p: CompanyProfile): string {
  return [
    [p.sido, p.city].filter(Boolean).join(' '),
    p.industry,
    chipOf(YEARS_CHIPS, p.years) || rangeText(p.years, '년'),
    chipOf(EMPLOYEE_CHIPS, p.employees) ? `직원 ${chipOf(EMPLOYEE_CHIPS, p.employees)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export const CATEGORY_CHIPS: { key: GrantCategory | 'all'; label: string }[] = [{ key: 'all', label: '전체' }, ...(Object.keys(GRANT_CATEGORY_LABEL) as GrantCategory[]).map((k) => ({ key: k, label: GRANT_CATEGORY_LABEL[k] }))]
