/**
 * D-680 마케팅 ↔ 고객사 — 고객 사례를 공개 글에 쓸 때의 확인 단계(LINK-4).
 *
 * 예전: 글 쓰기 화면은 '고객 실명 · 매출 · 계약금액은 적지 않기' 라고만 적어 두었다.
 *       실제 사례를 쓰려면 고객 관리에서 보고 와서 손으로 옮겨 적었고, 글에 고객 회사 이름이 들어가도 아무도 알려 주지 않았다.
 *       허락받은 고객인지 적어 둘 곳도 없었다.
 *  1) 이름을 가린 한 줄 — 업체 기록에서 지역(시 · 도) · 업종 · 직원 규모대 · 업력대 · 함께 한 일만 뽑는다.
 *     회사 이름 · 사람 이름 · 번호 · 주소 · 매출 · 금액 · 서류 내용은 재료로 쓰지 않는다(읽지도 않는다).
 *  2) 글 속 고객 이름 찾기 — 내 고객 관리에 있는 회사 이름 · 대표 · 담당자 이름 · 사업자번호 · 전화가 글 · 주제 · 사실에 있으면 짚는다.
 *  3) 가리기 — 그 자리를 '한 제조업 회사' · '대표님' 으로 바꾼다. 번호는 지운다.
 *  4) 허락 — '고객에게 허락받았어요' 는 그 업체 기록에 날짜로 남는다(payload · DB 변경 없음). 번호 · 전화는 허락과 상관없이 늘 짚는다.
 * 규칙만 본다(글자 모양) — AI 를 부르지 않는다. 화면 · 서버를 끌어오지 않는다(순수 함수).
 */
import type { ClientOpsRecord } from '../../types/clientOps'

// ---------------------------------------------------------------- 허락 기록

/** 사례 공개 허락 — 이 고객이 '글에 회사 이름을 써도 된다' 고 한 날(YYYY-MM-DD · 한국 날짜) */
export interface CaseConsent {
  at: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** 저장된 값 다듬기(clientOpsService.normalizeClientOps) */
export function normalizeCaseConsent(value: unknown): { caseConsent?: CaseConsent } {
  if (!value || typeof value !== 'object') return {}
  const at = (value as { at?: unknown }).at
  return typeof at === 'string' && DAY.test(at.trim()) ? { caseConsent: { at: at.trim() } } : {}
}

/** 허락을 적거나(on) 지운다 */
export function withCaseConsent<T extends { caseConsent?: CaseConsent }>(record: T, on: boolean, today: string): T {
  if (on) return DAY.test(today) ? { ...record, caseConsent: { at: today } } : record
  if (!record.caseConsent) return record
  const next = { ...record }
  delete next.caseConsent
  return next
}

/** '11월 26일' */
export function consentDayText(c: CaseConsent | undefined): string {
  if (!c || !DAY.test(c.at)) return ''
  return `${Number(c.at.slice(5, 7))}월 ${Number(c.at.slice(8, 10))}일`
}

// ---------------------------------------------------------------- 이름을 가린 한 줄

/** 사례에 쓰는 업체 칸 — 이것만 읽는다(매출 · 금액 · 서류 · 메모는 받지도 않는다) */
export type CaseSource = Pick<ClientOpsRecord, 'businessAddress' | 'industry' | 'businessCategory' | 'businessItem' | 'employeeCount' | 'establishedAt'>

export type CasePartKey = 'region' | 'industry' | 'size' | 'age'
export const CASE_PART_LABEL: Record<CasePartKey, string> = { region: '지역', industry: '업종', size: '규모', age: '업력' }
export const CASE_PART_KEYS: readonly CasePartKey[] = ['region', 'industry', 'size', 'age']

export interface CaseWork {
  label: string
  /** 마친 일인가(아니면 진행 중) */
  done: boolean
}

export interface CaseParts {
  /** '경기' — 시 · 도까지만(시 · 군 · 구 · 번지는 쓰지 않는다) */
  region: string
  /** '제조업' */
  industry: string
  /** '직원 10명대' — 정확한 사람 수는 쓰지 않는다 */
  size: string
  /** '창업 3~7년' — 정확한 설립일은 쓰지 않는다 */
  age: string
  work: CaseWork[]
}

const REGIONS: readonly [RegExp, string][] = [
  [/^서울/, '서울'],
  [/^부산/, '부산'],
  [/^대구/, '대구'],
  [/^인천/, '인천'],
  [/^광주/, '광주'],
  [/^대전/, '대전'],
  [/^울산/, '울산'],
  [/^세종/, '세종'],
  [/^경기/, '경기'],
  [/^강원/, '강원'],
  [/^(?:충청북도|충북)/, '충북'],
  [/^(?:충청남도|충남)/, '충남'],
  [/^(?:전라북도|전북)/, '전북'],
  [/^(?:전라남도|전남)/, '전남'],
  [/^(?:경상북도|경북)/, '경북'],
  [/^(?:경상남도|경남)/, '경남'],
  [/^제주/, '제주'],
]

/** 주소 → 시 · 도 이름(모르는 모양이면 '') */
export function regionOf(address: string): string {
  const head = String(address ?? '')
    .trim()
    .replace(/^\(\d{5}\)\s*/, '')
    .replace(/^\d{5}\s+/, '')
  for (const [re, name] of REGIONS) if (re.test(head)) return name
  return ''
}

/** '5명(대표 포함)' → '직원 5~9명' — 정확한 수 대신 규모대 */
export function sizeBand(employeeCount: string): string {
  const m = /\d[\d,]*/.exec(String(employeeCount ?? ''))
  if (!m) return ''
  const n = Number(m[0].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 5) return '직원 5명 미만'
  if (n < 10) return '직원 5~9명'
  if (n < 20) return '직원 10명대'
  if (n < 30) return '직원 20명대'
  if (n < 50) return '직원 30~40명대'
  if (n < 100) return '직원 50~90명대'
  return '직원 세 자릿수 규모'
}

/** 설립일 → '창업 3~7년' — 정확한 날짜 · 햇수 대신 업력대 */
export function ageBand(establishedAt: string, today: string): string {
  if (!DAY.test(String(establishedAt ?? '')) || !DAY.test(today)) return ''
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${establishedAt}T00:00:00Z`)) / 86_400_000
  if (!Number.isFinite(days) || days < 0) return ''
  const years = days / 365.25
  if (years < 3) return '창업 3년 이내'
  if (years < 7) return '창업 3~7년'
  if (years < 15) return '창업 7~15년'
  return '창업 15년 차 이후'
}

/** 업종 한마디 — 업종 칸 · 없으면 업태 · 종목. 괄호 · 숫자 · 긴 설명은 뺀다 */
export function industryOf(record: Pick<CaseSource, 'industry' | 'businessCategory' | 'businessItem'>): string {
  const raw = [record.industry, record.businessCategory, record.businessItem].map((v) => String(v ?? '').trim()).find(Boolean) ?? ''
  const first = raw
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,/·|\n]| 및 | 외 /)[0]
    .replace(/[0-9]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return first.length > 14 ? first.slice(0, 14).trim() : first
}

/** 업체 기록 → 사례 재료. work = 시작했거나 마친 업무 이름(부르는 쪽이 넘긴다 — 이 파일은 업무 목록을 끌어오지 않는다) */
export function caseParts(record: CaseSource, today: string, work: readonly CaseWork[] = []): CaseParts {
  return {
    region: regionOf(record.businessAddress),
    industry: industryOf(record),
    size: sizeBand(record.employeeCount),
    age: ageBand(record.establishedAt, today),
    work: work.filter((w) => w.label.trim()).slice(0, 3),
  }
}

/** 글에서 이 고객을 부르는 말 — '한 제조업 회사' · 업종을 모르면 '한 고객사' */
export function caseAlias(industry: string): string {
  const i = industry.trim()
  return i ? `한 ${i} 회사` : '한 고객사'
}

export const CASE_LINE_HEAD = '[고객 사례 · 이름 가림]'

/** 사실 목록에 넣는 한 줄 — off 에 든 재료는 뺀다(지역이 좁거나 드문 업종일 때) */
export function caseLine(parts: CaseParts, off: readonly CasePartKey[] = []): string {
  const part = (k: CasePartKey) => (off.includes(k) ? '' : parts[k])
  const who = [part('region'), part('industry')].filter(Boolean).join(' ')
  const detail = [part('size'), part('age')].filter(Boolean).join(' · ')
  const name = who ? `${who} 회사` : '한 고객사'
  // 업무 이름 안에 가운뎃점이 있는 것이 있어('업종 추가 · 목적사항 추가') 일 사이는 쉼표로 나눈다
  const work = parts.work.map((w) => `${w.label}(${w.done ? '마침' : '진행 중'})`).join(', ')
  return `${CASE_LINE_HEAD} ${name}${detail ? `(${detail})` : ''}${work ? ` — 함께 한 일: ${work}` : ''}`
}

/** 주제 칸이 비어 있을 때 넣어 줄 주제 — '제조업 회사 정책자금 진행 이야기' */
export function caseTopic(parts: CaseParts, off: readonly CasePartKey[] = []): string {
  const who = !off.includes('industry') && parts.industry ? `${parts.industry} 회사` : '고객사'
  const w = parts.work[0]?.label
  return w ? `${who} ${w} 진행 이야기` : `${who} 상담 이야기`
}

// ---------------------------------------------------------------- 글 속 고객 이름 찾기

/** 이름 찾기에 쓰는 업체 칸 */
export type NameSource = Pick<
  ClientOpsRecord,
  'id' | 'companyName' | 'representativeName' | 'contactName' | 'businessNumber' | 'corporateNumber' | 'contactPhone' | 'companyPhone' | 'industry' | 'businessCategory' | 'businessItem'
> & { caseConsent?: CaseConsent }

export type NameHitKind = 'company' | 'person' | 'number'

export interface NameHit {
  clientId: string
  /** 그 업체의 회사 이름(화면에 '○○ 고객' 으로) */
  company: string
  kind: NameHitKind
  /** 글에서 찾은 글자 그대로 */
  match: string
  /** 허락받은 고객인가 — 번호 · 전화는 늘 false(허락과 상관없이 넣지 않는다) */
  consent: boolean
  consentAt: string
}

const CORP = '\\(주\\)|㈜|주식회사|\\(유\\)|유한책임회사|유한회사|\\(합\\)|합자회사|합명회사|\\(사\\)|사단법인|\\(재\\)|재단법인|농업회사법인|영농조합법인|어업회사법인|사회적협동조합|협동조합|의료법인|세무법인|법무법인|회계법인|노무법인|특허법인'
const CORP_RE = new RegExp(CORP, 'g')
/** 회사 이름으로 흔한 낱말 — 이것만으로는 고객 이름으로 보지 않는다((주) 같은 표시가 붙어 있을 때만) */
const GENERIC = new Set(['컨설팅', '디자인', '마케팅', '솔루션', '테크', '산업', '건설', '상사', '식품', '유통', '물산', '전자', '기획', '개발', '무역', '회사', '고객사', '대표', '본사', '코리아', '서비스', '시스템', '엔지니어링'])
const TITLES = '대표이사님|대표이사|대표님|대표|사장님|사장|회장님|회장|이사님|이사|원장님|원장|소장님|소장|실장님|실장|팀장님|팀장|부장님|부장|과장님|과장|차장님|차장|대리님|대리|주임님|주임|님|씨'
/** 이름 칸에 흔히 적어 두는 말 — 사람 이름이 아니다 */
const NOT_A_NAME = new Set(['담당자', '대표자', '실무자', '관리자', '책임자', '경리', '총무', '미정', '없음', '모름', '본인', '사모님', '사장님', '대표님'])
const TITLE_TAIL = new RegExp(`\\s*(?:${TITLES})$`)

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const digits = (s: string) => String(s ?? '').replace(/\D/g, '')
const ascii = (ch: string) => /[A-Za-z0-9]/.test(ch)

/** '(주)미래 산업' → '미래산업' */
export function companyCore(name: string): string {
  return String(name ?? '')
    .replace(CORP_RE, ' ')
    .replace(/\s+/g, '')
    .trim()
}

/** '홍길동 대표님' → '홍길동' · '김대표' → ''(성만 남으면 이름으로 보지 않는다) */
export function personCore(name: string): string {
  // '홍길동, 김철수' · '홍길동 외 1명' 은 앞사람만
  let v = String(name ?? '')
    .split(/[,/·]| 외 /)[0]
    .replace(/\s+/g, ' ')
    .trim()
  for (let i = 0; i < 2; i += 1) v = v.replace(TITLE_TAIL, '').trim()
  v = v.replace(/\s+/g, '')
  return /^[가-힣]{2,5}$/.test(v) && !NOT_A_NAME.has(v) ? v : ''
}

interface Matcher {
  clientId: string
  company: string
  kind: NameHitKind
  re: RegExp
  /** 가릴 때 바꿔 넣는 말('' = 지운다) */
  alias: string
  consent: boolean
  consentAt: string
  /** 번호 · 전화 — 찾은 글자의 숫자가 이것과 같아야 한다 */
  digits?: string
}

export interface NameIndex {
  matchers: Matcher[]
}

function companyRe(core: string): RegExp | null {
  if (core.length < 2) return null
  const body = [...core].map(esc).join('\\s*')
  const head = ascii(core[0]) ? '(?<![A-Za-z0-9])' : ''
  const tail = ascii(core[core.length - 1]) ? '(?![A-Za-z0-9])' : ''
  const mark = `(?:${CORP})`
  // 두 글자 · 흔한 낱말은 (주) 같은 표시가 붙어 있을 때만
  const needMark = core.length <= 2 || GENERIC.has(core)
  const src = needMark ? `${mark}\\s*${head}${body}${tail}|${head}${body}${tail}\\s*${mark}` : `(?:${mark}\\s*)?${head}${body}${tail}(?:\\s*${mark})?`
  return new RegExp(src, 'gi')
}

function personRe(core: string): RegExp | null {
  if (!core) return null
  const body = [...core].map(esc).join('')
  // 두 글자 이름은 뒤에 호칭이 붙어 있을 때만('김진 대표')
  const src = core.length <= 2 ? `(?<![가-힣])${body}\\s*(?:${TITLES})` : `(?<![가-힣])${body}(?:\\s*(?:${TITLES}))?`
  return new RegExp(src, 'g')
}

/** 고객 목록 → 찾는 틀(글이 바뀔 때마다 다시 만들지 않게) — 300곳이어도 가볍다 */
export function buildNameIndex(clients: readonly NameSource[]): NameIndex {
  const matchers: Matcher[] = []
  for (const c of clients) {
    const company = String(c.companyName ?? '').trim()
    if (!company) continue
    const consent = !!c.caseConsent
    const consentAt = c.caseConsent?.at ?? ''
    const base = { clientId: c.id, company }
    const cre = companyRe(companyCore(company))
    if (cre) matchers.push({ ...base, kind: 'company', re: cre, alias: caseAlias(industryOf(c)), consent, consentAt })
    const rep = personCore(c.representativeName)
    const contact = personCore(c.contactName)
    const rre = personRe(rep)
    if (rre) matchers.push({ ...base, kind: 'person', re: rre, alias: '대표님', consent, consentAt })
    const pre = contact && contact !== rep ? personRe(contact) : null
    if (pre) matchers.push({ ...base, kind: 'person', re: pre, alias: '담당자님', consent, consentAt })
    const biz = digits(c.businessNumber)
    if (biz.length === 10) matchers.push({ ...base, kind: 'number', re: /\d{3}[-\s]?\d{2}[-\s]?\d{5}/g, alias: '', consent: false, consentAt: '', digits: biz })
    const corp = digits(c.corporateNumber)
    if (corp.length === 13) matchers.push({ ...base, kind: 'number', re: /\d{6}[-\s]?\d{7}/g, alias: '', consent: false, consentAt: '', digits: corp })
    for (const p of new Set([digits(c.contactPhone), digits(c.companyPhone)])) {
      if (p.length >= 9 && p.length <= 11) matchers.push({ ...base, kind: 'number', re: /0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, alias: '', consent: false, consentAt: '', digits: p })
    }
  }
  return { matchers }
}

interface Spot {
  at: number
  end: number
  text: string
  m: Matcher
}

/**
 * 글에서 찾은 자리 — 겹치면 긴 것 하나만('(주)미래산업' 안의 '(주)미래' 는 다른 고객 이름으로 보지 않는다).
 * 앞에서부터 차례로.
 */
function scan(text: string, index: NameIndex): Spot[] {
  const all: Spot[] = []
  for (const m of index.matchers) {
    m.re.lastIndex = 0
    for (let x = m.re.exec(text); x; x = m.re.exec(text)) {
      if (!x[0]) {
        m.re.lastIndex += 1
        continue
      }
      if (!m.digits || digits(x[0]) === m.digits) all.push({ at: x.index, end: x.index + x[0].length, text: x[0], m })
    }
  }
  all.sort((a, b) => b.end - b.at - (a.end - a.at) || a.at - b.at)
  const kept: Spot[] = []
  for (const s of all) if (!kept.some((k) => s.at < k.end && k.at < s.end)) kept.push(s)
  return kept.sort((a, b) => a.at - b.at)
}

/** 글에 있는 내 고객 이름 · 번호 — 같은 글자는 한 번만. 허락받지 않은 것이 앞 */
export function findClientNames(text: string, index: NameIndex): NameHit[] {
  const out: NameHit[] = []
  const src = String(text ?? '')
  if (!src.trim()) return out
  const seen = new Set<string>()
  for (const s of scan(src, index)) {
    const hit: NameHit = { clientId: s.m.clientId, company: s.m.company, kind: s.m.kind, match: s.text.trim(), consent: s.m.consent, consentAt: s.m.consentAt }
    const key = hitKey(hit)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out.sort((a, b) => Number(a.consent) - Number(b.consent))
}

const NO_BATCHIM: Record<string, string> = { 은: '는', 이: '가', 을: '를', 과: '와' }
const BATCHIM: Record<string, string> = { 는: '은', 가: '이', 를: '을', 와: '과' }

function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

/** 바꿔 넣은 말 뒤의 조사를 맞춘다 — 조사 뒤가 띄어쓰기 · 문장 부호 · 끝일 때만(낱말 속 글자는 건드리지 않는다) */
function fixJosa(alias: string, rest: string): string {
  const ch = rest[0]
  if (!ch) return rest
  const after = rest[1]
  if (after !== undefined && !/[\s,.!?…)"'”’\]]/.test(after)) return rest
  const swap = (hasBatchim(alias) ? BATCHIM : NO_BATCHIM)[ch]
  return swap ? swap + rest.slice(1) : rest
}

/**
 * 고객 이름 · 번호를 가린다 — 회사 이름은 '한 ○○ 회사', 사람 이름은 '대표님', 번호는 지운다.
 * keepConsented = 허락받은 고객의 이름은 그대로 둔다(번호는 늘 가린다) · skip = '고객 이름이 아니에요' 로 넘긴 것(hitKey).
 */
export function maskClientNames(text: string, index: NameIndex, opts: { keepConsented?: boolean; skip?: ReadonlySet<string> } = {}): string {
  let out = String(text ?? '')
  if (!out.trim()) return out
  // 뒤에서부터 바꾼다(앞자리 번호가 밀리지 않게)
  for (const s of scan(out, index).reverse()) {
    const m = s.m
    if (opts.keepConsented && m.consent && m.kind !== 'number') continue
    if (opts.skip?.has(hitKey({ clientId: m.clientId, kind: m.kind, match: s.text.trim() }))) continue
    const before = out.slice(0, s.at)
    const rest = out.slice(s.end)
    out = m.alias ? `${before}${m.alias}${fixJosa(m.alias, rest)}` : `${before.replace(/[ \t]+$/, (sp) => (rest.startsWith(' ') ? '' : sp))}${rest}`
  }
  return out
}

/** D-691 확인 줄 한 줄 — 같은 업체 · 같은 종류는 모양이 달라도('한솔테크(주)' · '한솔테크') 한 줄로 */
export interface NameHitGroup extends NameHit {
  /** 글에서 찾은 모양들(처음 찾은 것이 앞) */
  matches: string[]
  /** 그 모양들의 열쇠(가리기 · 넘기기를 한 번에) */
  keys: string[]
}

/** 찾은 것 → 확인 줄(업체 · 종류마다 한 줄 · 순서는 찾은 순서 그대로 — 허락 전이 앞) */
export function groupHits(hits: readonly NameHit[]): NameHitGroup[] {
  const out: NameHitGroup[] = []
  const at = new Map<string, NameHitGroup>()
  for (const h of hits) {
    // 번호는 숫자가 같을 때만 한 줄('123-45-67890' · '1234567890') — 전화 · 사업자번호처럼 다른 번호는 따로
    const k = h.kind === 'number' ? `${h.clientId}:number:${digits(h.match)}` : `${h.clientId}:${h.kind}`
    const g = at.get(k)
    if (g) {
      g.matches.push(h.match)
      g.keys.push(hitKey(h))
      continue
    }
    const ng: NameHitGroup = { ...h, matches: [h.match], keys: [hitKey(h)] }
    at.set(k, ng)
    out.push(ng)
  }
  return out
}

/** 찾은 것 하나의 열쇠 — '고객 이름이 아니에요' 로 넘긴 것을 기억할 때 */
export function hitKey(h: Pick<NameHit, 'clientId' | 'kind' | 'match'>): string {
  return `${h.clientId}:${h.kind}:${h.match.replace(/\s+/g, '')}`
}

/** 확인 줄에 보일 글 — 허락 전 · 허락 뒤 · 번호(무엇을 하면 되는지는 옆 단추가 말한다 — 짧게) */
export function hitText(h: NameHit & { matches?: readonly string[] }): string {
  const what = (h.matches?.length ? h.matches : [h.match]).map((m) => `"${m}"`).join(' · ')
  if (h.kind === 'number') return `${what} — 고객 번호예요. 공개 글에는 넣지 않아요.`
  if (h.consent) return `${what} — 허락받은 고객이에요(${consentDayText({ at: h.consentAt })}).`
  return `${what} — 내 고객 이름이에요.`
}
