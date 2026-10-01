/**
 * 지원사업 매칭 (D-141) — 공고 조건 × 업체 조건 → 맞음 · 확인 필요 · 안 맞음 + 이유 한 줄씩. 순수 함수.
 *
 * 대표: "토스 · 카카오톡처럼 마감 임박 지원사업을 보여 주되, 기업 컨디션에 맞게 자동 매칭.
 *        계약 고객이 아니어도 가망고객도 써 볼 수 있게 — 영업에도 쓴다."
 *
 *  - 규칙 계산이다(LLM 호출 0). '선정 가능성' 을 말하지 않는다 — 공고 조건에 걸리는지만 본다.
 *  - 모르는 값은 '안 맞음' 이 아니라 '확인 필요' 다. 업체 정보가 비어 있다고 공고를 지우지 않는다.
 *  - 업체 조건은 범위(lo~hi)로 둔다 — 업체 기록은 정확한 값(lo=hi), 가망고객이 고른 칩은 구간.
 *    그래서 '창업 7년 이내' 와 '3~7년' 처럼 걸치면 '확인 필요' 가 된다(지어내지 않는다).
 */

export type GrantCategory = 'money' | 'hr' | 'marketing' | 'rnd' | 'export' | 'startup' | 'etc'

/** 화면 칩 순서 — 토스 · 카카오 화면과 같은 갈래 */
export const GRANT_CATEGORY_ORDER: GrantCategory[] = ['money', 'hr', 'marketing', 'rnd', 'export', 'startup', 'etc']

export const GRANT_CATEGORY_LABEL: Record<GrantCategory, string> = {
  money: '지원금·대출',
  hr: '인력지원',
  marketing: '마케팅',
  rnd: '개발',
  export: '수출',
  startup: '창업',
  etc: '기타',
}

export type DeadlineKind = 'date' | 'first_come' | 'always'

export type CertKey = 'venture' | 'innobiz' | 'mainbiz' | 'lab' | 'women'

export const CERT_LABEL: Record<CertKey, string> = {
  venture: '벤처기업',
  innobiz: '이노비즈',
  mainbiz: '메인비즈',
  lab: '기업부설연구소',
  women: '여성기업',
}

export type CompanySize = 'micro' | 'small' | 'mid'

export const SIZE_LABEL: Record<CompanySize, string> = { micro: '소상공인', small: '중소기업', mid: '중견기업' }

/** 공고가 거는 조건 — 비어 있으면 그 조건은 없다 */
export interface GrantRules {
  /** 시·도 짧은 이름(서울 · 경기 …). 비면 전국 */
  regions: string[]
  /** 시·군·구(파주시 …). 비면 시·도 전체 */
  cities: string[]
  /** 창업(설립) N년 이내 — 만 업력 < N */
  withinYears: number | null
  /** 업력 N년 이상 — 만 업력 ≥ N */
  minYears: number | null
  /** 업종 낱말 중 하나라도(제조 · 정보통신 …). 비면 모든 업종 */
  industries: string[]
  /** 이 업종은 안 됨 */
  excludeIndustries: string[]
  minEmployees: number | null
  maxEmployees: number | null
  /** 매출(백만원) */
  minRevenueM: number | null
  maxRevenueM: number | null
  /** 기업 규모 중 하나라도. 비면 상관없음 */
  sizes: CompanySize[]
  /** 대표 만 39세 이하(청년) */
  youthCeo: boolean
  /** 여성 대표(여성기업) */
  womenCeo: boolean
  /** 인증 중 하나라도 */
  certs: CertKey[]
}

export const NO_RULES: GrantRules = {
  regions: [],
  cities: [],
  withinYears: null,
  minYears: null,
  industries: [],
  excludeIndustries: [],
  minEmployees: null,
  maxEmployees: null,
  minRevenueM: null,
  maxRevenueM: null,
  sizes: [],
  youthCeo: false,
  womenCeo: false,
  certs: [],
}

export type GrantSource = 'manual' | 'paste' | 'bizinfo' | 'example'

export const GRANT_SOURCE_LABEL: Record<GrantSource, string> = {
  manual: '직접 적음',
  paste: '공고문 붙여넣기',
  bizinfo: '기업마당 파일',
  example: '예시',
}

export interface GrantNotice {
  id: string
  title: string
  /** 소관 부처 · 지자체 */
  agency: string
  /** 수행 기관 */
  operator: string
  category: GrantCategory
  /** 접수 시작(YYYY-MM-DD 또는 '') */
  applyStart: string
  /** 접수 마감(YYYY-MM-DD 또는 '') */
  applyEnd: string
  deadlineKind: DeadlineKind
  /** "최대 5천만원" — 글 그대로. 숫자를 지어내지 않는다 */
  amountText: string
  /** 지원 대상 원문 */
  target: string
  summary: string
  url: string
  rules: GrantRules
  source: GrantSource
  /** 가망고객 공개 화면(/grants/find)에 보인다. 예시 공고는 공개하지 않는다 */
  published: boolean
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 업체 조건 — 범위로                                                     */
/* ------------------------------------------------------------------ */

export interface Range {
  lo: number
  /** 포함. 위가 열려 있으면 큰 수 */
  hi: number
}

export const OPEN_TOP = 1e12

export interface CompanyProfile {
  name: string
  /** 시·도 짧은 이름 */
  sido: string
  city: string
  /** 업종 · 종목 글(여러 칸을 이은 것) */
  industry: string
  /** 만 업력 */
  years: Range | null
  employees: Range | null
  /** 매출(백만원) */
  revenueM: Range | null
  ceoAge: Range | null
  female: boolean | null
  certs: CertKey[]
  /** 인증을 알고 있는가(아무것도 없다고 확인된 것과 모르는 것을 나눈다) */
  certsKnown: boolean
}

export const EMPTY_PROFILE: CompanyProfile = {
  name: '',
  sido: '',
  city: '',
  industry: '',
  years: null,
  employees: null,
  revenueM: null,
  ceoAge: null,
  female: null,
  certs: [],
  certsKnown: false,
}

export const exact = (n: number): Range => ({ lo: n, hi: n })

/** 시·도 — 긴 이름 · 짧은 이름 모두 짧은 이름으로 */
export const SIDO_LIST = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

const SIDO_LONG: [RegExp, string][] = [
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
  [/^(충청북|충북)/, '충북'],
  [/^(충청남|충남)/, '충남'],
  [/^(전라북|전북)/, '전북'],
  [/^(전라남|전남)/, '전남'],
  [/^(경상북|경북)/, '경북'],
  [/^(경상남|경남)/, '경남'],
  [/^제주/, '제주'],
]

export function sidoOf(word: string): string {
  const w = word.trim()
  for (const [re, short] of SIDO_LONG) if (re.test(w)) return short
  return ''
}

/** 주소 → 시·도 · 시·군·구 ("경기도 파주시 문산읍 …" → 경기 · 파주시) */
export function placeOf(address: string): { sido: string; city: string } {
  const parts = address.trim().split(/\s+/).filter(Boolean)
  const sido = parts.length ? sidoOf(parts[0]) : ''
  if (!sido) return { sido: '', city: '' }
  // 세종은 시·군·구가 없다. '수원시 영통구' 처럼 두 단계면 시까지만
  const city = parts[1] && /[시군구]$/.test(parts[1]) ? parts[1] : ''
  return { sido, city }
}

/** 업종 글에서 인증 찾기 */
export function certsFromText(text: string): CertKey[] {
  const out: CertKey[] = []
  if (/벤처/.test(text)) out.push('venture')
  if (/이노비즈|기술혁신형/.test(text)) out.push('innobiz')
  if (/메인비즈|경영혁신형/.test(text)) out.push('mainbiz')
  if (/연구소|연구개발전담/.test(text)) out.push('lab')
  if (/여성기업/.test(text)) out.push('women')
  return out
}

/* ------------------------------------------------------------------ */
/* 마감                                                                 */
/* ------------------------------------------------------------------ */

export type DeadlineState = 'closed' | 'today' | 'tomorrow' | 'week' | 'soon' | 'later' | 'first_come' | 'always' | 'upcoming' | 'unknown'

export interface Deadline {
  state: DeadlineState
  /** 마감까지 남은 날(날짜 마감일 때) */
  days: number | null
  label: string
  /** 7일 안에 끝나는가 — 알림 · 오늘 화면에 올린다 */
  urgent: boolean
  open: boolean
}

const DAY = 86_400_000
function dayNum(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const t = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  return Number.isFinite(t) ? Math.round(t / DAY) : null
}

export function daysBetween(from: string, to: string): number | null {
  const a = dayNum(from)
  const b = dayNum(to)
  return a === null || b === null ? null : b - a
}

const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`

export function deadlineOf(n: Pick<GrantNotice, 'applyStart' | 'applyEnd' | 'deadlineKind'>, today: string): Deadline {
  const startIn = n.applyStart ? daysBetween(today, n.applyStart) : null
  if (startIn !== null && startIn > 0) {
    return { state: 'upcoming', days: n.applyEnd ? daysBetween(today, n.applyEnd) : null, label: `${md(n.applyStart)} 접수 시작`, urgent: false, open: false }
  }
  if (n.deadlineKind === 'always') return { state: 'always', days: null, label: '상시 접수', urgent: false, open: true }
  const days = n.applyEnd ? daysBetween(today, n.applyEnd) : null
  if (days !== null && days < 0) return { state: 'closed', days, label: '마감', urgent: false, open: false }
  if (n.deadlineKind === 'first_come') {
    // 선착순은 날짜가 있어도 그 전에 끝날 수 있다
    return { state: 'first_come', days, label: '선착순 마감', urgent: days !== null && days <= 7, open: true }
  }
  if (days === null) return { state: 'unknown', days: null, label: '마감일 확인 필요', urgent: false, open: true }
  if (days === 0) return { state: 'today', days, label: '오늘 마감', urgent: true, open: true }
  if (days === 1) return { state: 'tomorrow', days, label: '내일 마감', urgent: true, open: true }
  // 이번 주(일요일까지)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const toSunday = dow === 0 ? 0 : 7 - dow
  if (days <= toSunday) return { state: 'week', days, label: '이번주 마감', urgent: true, open: true }
  if (days <= 7) return { state: 'soon', days, label: `D-${days}`, urgent: true, open: true }
  if (days <= 30) return { state: 'later', days, label: `D-${days}`, urgent: false, open: true }
  return { state: 'later', days, label: `${md(n.applyEnd)} 마감`, urgent: false, open: true }
}

/** 마감이 급한 순 — 오늘 → 날짜 순 → 선착순 → 마감일 모름 → 상시 → 접수 전 → 마감 */
export function deadlineRank(d: Deadline): number {
  if (d.state === 'closed') return 1e9
  if (d.state === 'upcoming') return 1e8 + (d.days ?? 0)
  if (d.state === 'always') return 1e7
  if (d.state === 'unknown') return 1e6
  if (d.state === 'first_come') return d.days !== null ? d.days + 0.5 : 5e5
  return d.days ?? 5e5
}

/* ------------------------------------------------------------------ */
/* 매칭                                                                 */
/* ------------------------------------------------------------------ */

export type ReasonState = 'ok' | 'no' | 'unknown'
export type Verdict = 'fit' | 'check' | 'no'

export const VERDICT_LABEL: Record<Verdict, string> = { fit: '조건 맞음', check: '확인 필요', no: '안 맞음' }

export interface Reason {
  key: string
  label: string
  state: ReasonState
  text: string
}

export interface GrantMatch {
  notice: GrantNotice
  verdict: Verdict
  reasons: Reason[]
  /** 확인 필요한 조건 수 */
  unknownCount: number
  deadline: Deadline
}

/** 범위 vs 조건(lo 이상 · hi 이하). 범위가 조건 안에 다 들면 ok, 전혀 안 겹치면 no, 걸치면 unknown */
function rangeCheck(r: Range | null, min: number | null, max: number | null): ReasonState {
  if (min === null && max === null) return 'ok'
  if (!r) return 'unknown'
  const lo = min ?? -Infinity
  const hi = max ?? Infinity
  if (r.lo >= lo && r.hi <= hi) return 'ok'
  if (r.hi < lo || r.lo > hi) return 'no'
  return 'unknown'
}

const won = (m: number) => (m >= 100 ? `${(m / 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원` : `${m.toLocaleString('ko-KR')}백만원`)

export function rangeText(r: Range | null, unit: '년' | '명' | '세' | 'won'): string {
  if (!r) return ''
  const f = (n: number) => (unit === 'won' ? won(n) : `${n.toLocaleString('ko-KR')}${unit === '년' ? '년' : unit}`)
  if (r.hi >= OPEN_TOP / 10) return unit === '년' ? `업력 ${r.lo}년 이상` : `${f(r.lo)} 이상`
  if (unit === '년' && r.lo <= 0) return `업력 ${r.hi + 1}년 미만`
  if (r.lo === r.hi) return unit === '년' ? `업력 ${r.lo}년(${r.lo + 1}년 차)` : f(r.lo)
  if (unit === '년') return `업력 ${r.lo}~${r.hi}년`
  if (r.lo <= 0) return `${f(r.hi)} 이하`
  return `${f(r.lo)}~${f(r.hi)}`
}

/** 업종 낱말이 업체 업종 글에 있는가 (띄어쓰기 · 가운뎃점 무시) */
function industryHit(text: string, words: string[]): boolean {
  const t = text.replace(/[\s·,./]/g, '')
  return words.some((w) => {
    const k = w.replace(/[\s·,./]/g, '')
    if (!k) return false
    if (t.includes(k)) return true
    // '정보통신' ↔ 소프트웨어 · IT 같은 흔한 다른 말
    if (/정보통신|ICT|소프트웨어|SW/i.test(k)) return /정보통신|소프트웨어|ICT|SW|IT|프로그램|플랫폼|앱/i.test(t)
    if (/제조/.test(k)) return /제조|생산|가공|공장/.test(t)
    return false
  })
}

/** 소상공인 — 상시 근로자 5명 미만(제조 · 건설 · 운수 · 광업은 10명 미만) */
function microLimit(industry: string): number {
  return /제조|건설|운수|광업/.test(industry) ? 9 : 4
}

export function matchGrant(notice: GrantNotice, p: CompanyProfile, today: string): GrantMatch {
  const r = { ...NO_RULES, ...notice.rules }
  const reasons: Reason[] = []
  const add = (key: string, label: string, state: ReasonState, text: string) => reasons.push({ key, label, state, text })

  // 지역
  if (r.regions.length === 0 && r.cities.length === 0) add('region', '지역', 'ok', '전국')
  else {
    const want = placeText(r)
    if (!p.sido) add('region', '지역', 'unknown', `${want} 업체만 — 회사 주소를 적으면 바로 확인돼요`)
    else if (r.regions.length && !r.regions.includes(p.sido)) add('region', '지역', 'no', `${want} 업체만 (이 업체는 ${p.sido})`)
    else if (r.cities.length === 0) add('region', '지역', 'ok', `${want} — ${[p.sido, p.city].filter(Boolean).join(' ')}`)
    else if (!p.city) add('region', '지역', 'unknown', `${want} 업체만 — 시·군·구를 확인해야 해요`)
    else if (r.cities.includes(p.city)) add('region', '지역', 'ok', `${want} — ${p.sido} ${p.city}`)
    else add('region', '지역', 'no', `${want} 업체만 (이 업체는 ${p.sido} ${p.city})`)
  }

  // 업력
  if (r.withinYears !== null || r.minYears !== null) {
    const want = [r.withinYears !== null ? `창업 ${r.withinYears}년 이내` : '', r.minYears !== null ? `업력 ${r.minYears}년 이상` : ''].filter(Boolean).join(' · ')
    const st = rangeCheck(p.years, r.minYears, r.withinYears !== null ? r.withinYears - 1 : null)
    add('years', '업력', st, st === 'unknown' && !p.years ? `${want} — 설립일을 적으면 확인돼요` : `${want} — ${rangeText(p.years, '년')}`)
  }

  // 업종
  if (r.industries.length || r.excludeIndustries.length) {
    const want = r.industries.length ? `${r.industries.join(' · ')} 업종` : `${r.excludeIndustries.join(' · ')} 제외`
    if (!p.industry.trim()) add('industry', '업종', 'unknown', `${want} — 업종을 적으면 확인돼요`)
    else if (r.excludeIndustries.length && industryHit(p.industry, r.excludeIndustries)) add('industry', '업종', 'no', `${r.excludeIndustries.join(' · ')} 업종은 안 됨 (이 업체: ${p.industry.slice(0, 20)})`)
    else if (r.industries.length && !industryHit(p.industry, r.industries)) add('industry', '업종', 'unknown', `${want} — 이 업체(${p.industry.slice(0, 20)})가 해당하는지 확인`)
    else add('industry', '업종', 'ok', `${want} — ${p.industry.slice(0, 20)}`)
  }

  // 직원 수
  if (r.minEmployees !== null || r.maxEmployees !== null) {
    const want = [r.minEmployees !== null ? `${r.minEmployees}명 이상` : '', r.maxEmployees !== null ? `${r.maxEmployees}명 이하` : ''].filter(Boolean).join(' · ')
    const st = rangeCheck(p.employees, r.minEmployees, r.maxEmployees)
    add('employees', '직원 수', st, p.employees ? `${want} — ${rangeText(p.employees, '명')}` : `${want} — 직원 수를 적으면 확인돼요`)
  }

  // 매출
  if (r.minRevenueM !== null || r.maxRevenueM !== null) {
    const want = [r.minRevenueM !== null ? `매출 ${won(r.minRevenueM)} 이상` : '', r.maxRevenueM !== null ? `매출 ${won(r.maxRevenueM)} 이하` : ''].filter(Boolean).join(' · ')
    const st = rangeCheck(p.revenueM, r.minRevenueM, r.maxRevenueM)
    add('revenue', '매출', st, p.revenueM ? `${want} — ${rangeText(p.revenueM, 'won')}` : `${want} — 매출을 적으면 확인돼요`)
  }

  // 규모
  if (r.sizes.length) {
    const want = r.sizes.map((s) => SIZE_LABEL[s]).join(' · ')
    if (r.sizes.includes('small') || r.sizes.includes('mid')) {
      // 우리 업체 대부분은 중소기업 — 매출 1,500억 넘는 것만 아니라고 본다
      const st: ReasonState = r.sizes.includes('small') ? (p.revenueM && p.revenueM.lo > 150_000 ? 'unknown' : 'ok') : 'unknown'
      add('size', '규모', st, st === 'ok' ? `${want} — 중소기업` : `${want} — 규모 확인 필요`)
    } else {
      const lim = microLimit(p.industry)
      const st = !p.employees ? 'unknown' : p.employees.hi <= lim ? 'ok' : p.employees.lo > lim ? 'no' : 'unknown'
      add('size', '규모', st, `${want}(상시 ${lim + 1}명 미만) — ${p.employees ? rangeText(p.employees, '명') : '직원 수를 적으면 확인돼요'}`)
    }
  }

  // 청년 대표
  if (r.youthCeo) {
    const st = rangeCheck(p.ceoAge, null, 39)
    add('ceoAge', '대표 나이', st, p.ceoAge ? `대표 만 39세 이하 — ${rangeText(p.ceoAge, '세')}` : '대표 만 39세 이하 — 대표 생년월일을 적으면 확인돼요')
  }

  // 여성 대표
  if (r.womenCeo) {
    const st: ReasonState = p.female === null ? 'unknown' : p.female ? 'ok' : 'no'
    add('women', '여성 대표', st, st === 'unknown' ? '여성 대표(여성기업) — 대표 성별을 적으면 확인돼요' : st === 'ok' ? '여성 대표 — 맞음' : '여성 대표 업체만')
  }

  // 인증
  if (r.certs.length) {
    const want = r.certs.map((c) => CERT_LABEL[c]).join(' · ')
    const have = r.certs.filter((c) => p.certs.includes(c))
    const st: ReasonState = have.length ? 'ok' : p.certsKnown ? 'no' : 'unknown'
    add('certs', '인증', st, st === 'ok' ? `${want} 중 하나 — ${have.map((c) => CERT_LABEL[c]).join(' · ')} 있음` : st === 'no' ? `${want} 중 하나가 있어야 해요` : `${want} 중 하나 — 인증을 적으면 확인돼요`)
  }

  const unknownCount = reasons.filter((x) => x.state === 'unknown').length
  const verdict: Verdict = reasons.some((x) => x.state === 'no') ? 'no' : unknownCount > 0 ? 'check' : 'fit'
  return { notice, verdict, reasons, unknownCount, deadline: deadlineOf(notice, today) }
}

/** 이 업체에 걸리는 공고 — 접수 중(또는 곧 시작) · 안 맞음 제외 · 맞음 먼저, 그다음 마감 급한 순 */
export function matchesFor(notices: readonly GrantNotice[], p: CompanyProfile, today: string, opts: { includeNo?: boolean; includeUpcoming?: boolean } = {}): GrantMatch[] {
  return notices
    .map((n) => matchGrant(n, p, today))
    .filter((m) => m.deadline.state !== 'closed' && (opts.includeUpcoming || m.deadline.state !== 'upcoming') && (opts.includeNo || m.verdict !== 'no'))
    .sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || deadlineRank(a.deadline) - deadlineRank(b.deadline) || a.notice.title.localeCompare(b.notice.title))
}

function verdictRank(v: Verdict): number {
  return v === 'fit' ? 0 : v === 'check' ? 1 : 2
}

/** 공고 목록 — 마감 급한 순(닫힌 것 뒤로) */
export function sortByDeadline(notices: readonly GrantNotice[], today: string): GrantNotice[] {
  return [...notices].sort((a, b) => deadlineRank(deadlineOf(a, today)) - deadlineRank(deadlineOf(b, today)) || a.title.localeCompare(b.title))
}

/** 지역에 걸리는 공고인가(전국 공고 포함) — 목록 머리 '파주시 에서' 용 */
export function inRegion(n: GrantNotice, sido: string, city: string): boolean {
  if (!sido) return true
  if (n.rules.regions.length && !n.rules.regions.includes(sido)) return false
  if (city && n.rules.cities.length && !n.rules.cities.includes(city)) return false
  return true
}

/* ------------------------------------------------------------------ */
/* 공고 하나 다듬기 (저장 전 · 읽은 뒤)                                     */
/* ------------------------------------------------------------------ */

const okDate = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const strs = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 30)).slice(0, max) : [])

export function normalizeRules(raw: unknown): GrantRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    regions: strs(r.regions).map((x) => sidoOf(x) || x).filter((x) => SIDO_LIST.includes(x)),
    cities: strs(r.cities),
    withinYears: num(r.withinYears),
    minYears: num(r.minYears),
    industries: strs(r.industries),
    excludeIndustries: strs(r.excludeIndustries),
    minEmployees: num(r.minEmployees),
    maxEmployees: num(r.maxEmployees),
    minRevenueM: num(r.minRevenueM),
    maxRevenueM: num(r.maxRevenueM),
    sizes: strs(r.sizes).filter((x): x is CompanySize => x === 'micro' || x === 'small' || x === 'mid'),
    youthCeo: r.youthCeo === true,
    womenCeo: r.womenCeo === true,
    certs: strs(r.certs).filter((x): x is CertKey => x in CERT_LABEL),
  }
}

export function normalizeNotice(raw: unknown, id: string, now: string): GrantNotice | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 200) : ''
  if (!title) return null
  const text = (k: string, max: number) => (typeof r[k] === 'string' ? (r[k] as string).trim().slice(0, max) : '')
  const category = GRANT_CATEGORY_ORDER.includes(r.category as GrantCategory) ? (r.category as GrantCategory) : 'etc'
  const deadlineKind: DeadlineKind = r.deadlineKind === 'first_come' || r.deadlineKind === 'always' ? r.deadlineKind : 'date'
  const source: GrantSource = r.source === 'paste' || r.source === 'bizinfo' || r.source === 'example' ? r.source : 'manual'
  const url = text('url', 500)
  return {
    id,
    title,
    agency: text('agency', 80),
    operator: text('operator', 80),
    category,
    applyStart: okDate(r.applyStart),
    applyEnd: okDate(r.applyEnd),
    deadlineKind,
    amountText: text('amountText', 80),
    target: text('target', 600),
    summary: text('summary', 1200),
    url: /^https?:\/\//.test(url) ? url : '',
    rules: normalizeRules(r.rules),
    source,
    // 예시 공고는 바깥에 보이지 않는다 — 지어낸 공고를 가망고객에게 보여 주지 않는다
    published: source !== 'example' && r.published === true,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
  }
}

/** 지역 조건 글 — '경기 파주시' · '서울 · 경기' · '파주시 · 고양시' */
function placeText(r: Pick<GrantRules, 'regions' | 'cities'>): string {
  return [r.regions.join(' · '), r.cities.join(' · ')].filter(Boolean).join(' ')
}

/** 이 공고가 거는 조건을 사람 말로 (목록 · 공개 화면) */
export function rulesText(r: GrantRules): string[] {
  const out: string[] = []
  if (r.regions.length || r.cities.length) out.push(placeText(r))
  if (r.withinYears !== null) out.push(`창업 ${r.withinYears}년 이내`)
  if (r.minYears !== null) out.push(`업력 ${r.minYears}년 이상`)
  if (r.industries.length) out.push(`${r.industries.join(' · ')} 업종`)
  if (r.excludeIndustries.length) out.push(`${r.excludeIndustries.join(' · ')} 제외`)
  if (r.minEmployees !== null) out.push(`직원 ${r.minEmployees}명 이상`)
  if (r.maxEmployees !== null) out.push(`직원 ${r.maxEmployees}명 이하`)
  if (r.minRevenueM !== null) out.push(`매출 ${won(r.minRevenueM)} 이상`)
  if (r.maxRevenueM !== null) out.push(`매출 ${won(r.maxRevenueM)} 이하`)
  if (r.sizes.length) out.push(r.sizes.map((s) => SIZE_LABEL[s]).join(' · '))
  if (r.youthCeo) out.push('대표 만 39세 이하')
  if (r.womenCeo) out.push('여성 대표')
  if (r.certs.length) out.push(`${r.certs.map((c) => CERT_LABEL[c]).join(' · ')} 중 하나`)
  return out
}
