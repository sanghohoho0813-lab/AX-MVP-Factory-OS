/**
 * D-378 세무조정계산서 · 법인세 신고서(개인사업자는 종합소득세 신고서) → 그해 실제로 받은 세액공제 · 감면.
 *
 * 컨설팅에서 가장 흔한 제안거리 하나가 '받을 수 있었는데 신고서에서 빠진 공제' — 5년 안이면 경정청구로 돌려받는다.
 * 예전에는 신고서를 올려도 제목대로 칸만 만들고 읽지 않아, 맞춤 추천이 '공제를 챙겼는지 볼 때' 라고만 했다.
 *
 *  - 공제감면세액계산서 · 세액공제조정명세서 · 세액조정계산서에 이름이 나오는 공제 · 감면만 찾는다
 *    (통합고용 · 고용증대 · 사회보험료 · 연구 · 인력개발비 · 창업중소기업 감면 · 중소기업 특별세액감면 · 통합투자).
 *  - 그 이름 줄(이름이 두 줄로 나뉘면 이어서) 끝에 0보다 큰 금액이 있으면 '받음'. 빈 칸 · 0 은 받지 않은 것.
 *    서식에는 받지 않은 공제 이름도 빈 줄로 찍히기 때문이다.
 *  - 금액은 그 줄의 금액이 하나뿐일 때만 남긴다(대상세액 · 공제세액이 같이 찍힌 줄은 어느 쪽인지 몰라 이름만).
 *  - 공제 · 감면 칸 자체를 못 찾으면(첫 장만 올렸으면) '빠졌다' 고 말하지 않는다 — sectionSeen.
 *  - 사업자등록번호 · 날짜 · 조문 번호 · 서식 코드는 금액으로 읽지 않는다.
 * 규칙 계산 — 외부 호출 없음. 신고서의 다른 숫자(과세표준 · 산출세액)는 남기지 않는다.
 */

export type ReliefGroup = 'employment' | 'rnd' | 'startup' | 'smeSpecial' | 'invest'

export interface ReliefItem {
  group: ReliefGroup
  /** 보여 줄 이름 */
  name: string
  /** 0보다 큰 금액이 하나뿐인 줄에서만(원) */
  amount: number | null
}

export interface TaxReturnRead {
  kind: 'corp' | 'personal'
  /** 사업연도(귀속) 끝 해 */
  year: number | null
  /** 받은 공제 · 감면(금액 > 0) */
  items: ReliefItem[]
  /** 공제 · 감면 칸이 보였나 — 안 보였으면 '없다' 고 말하지 않는다 */
  sectionSeen: boolean
  /** 아는 이름은 없는데 공제 · 감면 합계 줄에 금액이 있으면(첫 장만 올렸거나 다른 공제) — '없다' 고 말하지 않는다 */
  otherTotal: number
}

const RELIEFS: { group: ReliefGroup; name: string; re: RegExp }[] = [
  { group: 'employment', name: '통합고용세액공제', re: /통\s*합\s*고\s*용\s*세\s*액\s*공\s*제/ },
  { group: 'employment', name: '고용증대세액공제', re: /고\s*용\s*을?\s*증\s*대\s*시\s*킨\s*기\s*업\s*에\s*대\s*한\s*세\s*액\s*공\s*제|고\s*용\s*증\s*대\s*세\s*액\s*공\s*제/ },
  { group: 'employment', name: '사회보험료 세액공제', re: /사\s*회\s*보\s*험\s*료\s*세\s*액\s*공\s*제/ },
  { group: 'rnd', name: '연구 · 인력개발비 세액공제', re: /연\s*구\s*[·ㆍ･.,]?\s*인\s*력\s*개\s*발\s*비\s*(?:에\s*대\s*한\s*)?세\s*액\s*공\s*제/ },
  { group: 'startup', name: '창업중소기업 세액감면', re: /창\s*업\s*중\s*소\s*기\s*업\s*(?:등\s*에\s*대\s*한\s*|에\s*대\s*한\s*)?세\s*액\s*감\s*면/ },
  { group: 'smeSpecial', name: '중소기업 특별세액감면', re: /중\s*소\s*기\s*업\s*(?:에\s*대\s*한\s*)?특\s*별\s*세\s*액\s*감\s*면/ },
  { group: 'invest', name: '통합투자세액공제', re: /통\s*합\s*투\s*자\s*세\s*액\s*공\s*제/ },
]

export const RELIEF_LABEL: Record<ReliefGroup, string> = {
  employment: '통합고용세액공제',
  rnd: '연구 · 인력개발비 세액공제',
  startup: '창업중소기업 세액감면',
  smeSpecial: '중소기업 특별세액감면',
  invest: '통합투자세액공제',
}

const TITLE_CORP = /법\s*인\s*세\s*과\s*세\s*표\s*준\s*및\s*세\s*액\s*(?:신\s*고\s*서|조\s*정\s*계\s*산\s*서)|세\s*무\s*조\s*정\s*계\s*산\s*서|공\s*제\s*감\s*면\s*세\s*액\s*(?:및\s*추\s*가\s*납\s*부\s*세\s*액\s*)?합\s*계\s*표|세\s*액\s*공\s*제\s*조\s*정\s*명\s*세\s*서/
const TITLE_PERSONAL = /종\s*합\s*소\s*득\s*세[\s\S]{0,40}?과\s*세\s*표\s*준\s*확\s*정\s*신\s*고|종\s*합\s*소\s*득\s*세\s*신\s*고\s*서/

export function looksLikeTaxReturn(text: string, fileName = ''): boolean {
  const head = String(text || '').slice(0, 4000)
  if (TITLE_CORP.test(head)) return true
  // 소득금액증명 · 과세표준증명에도 '종합소득세 과세표준확정신고' 안내 글이 있다 — 그 서류는 신고서가 아니다
  if (/소\s*득\s*금\s*액\s*증\s*명|과\s*세\s*표\s*준\s*증\s*명/.test(head)) return false
  if (TITLE_PERSONAL.test(head)) return true
  return /세무\s*조정|조정\s*계산서|법인세\s*신고|종합\s*소득세\s*신고/.test(fileName) && /세\s*액\s*공\s*제|세\s*액\s*감\s*면|과\s*세\s*표\s*준/.test(head)
}

const SECTION = /공\s*제\s*[·ㆍ]?\s*감\s*면\s*세\s*액|세\s*액\s*공\s*제\s*(?:조\s*정\s*명\s*세\s*서|신\s*청\s*서)|세\s*액\s*감\s*면\s*신\s*청\s*서|최\s*저\s*한\s*세/

/** 금액 — 쉼표가 있는 수 또는 다섯 자리 이상(서식 코드 · 조문 번호 · 연도는 빠진다) */
const MONEY = /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d{5,})(?![\d,.])/g

function moneyIn(s: string): number[] {
  const body = s
    .replace(/\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/g, ' ')
    .replace(/20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g, ' ')
    .replace(/제\s*\d+\s*조(?:\s*의\s*\d+)?(?:\s*제\s*\d+\s*항)?/g, ' ')
  const out: number[] = []
  for (const m of body.matchAll(MONEY)) out.push(Number(m[1].replace(/,/g, '')))
  return out
}

function yearOf(text: string): number | null {
  const t = String(text || '').slice(0, 6000)
  const range = /(20\d{2})\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?\s*[~∼～\-]\s*(20\d{2})\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/.exec(t)
  if (range) return Number(range[2])
  const att = /(20\d{2})\s*년\s*(?:귀\s*속|사\s*업\s*연\s*도)|귀\s*속\s*(?:연\s*도|년\s*도)?\s*[:：]?\s*(20\d{2})/.exec(t)
  return att ? Number(att[1] ?? att[2]) : null
}

export function readTaxReturn(text: string, fileName = ''): TaxReturnRead | null {
  const raw = String(text || '')
  if (!looksLikeTaxReturn(raw, fileName)) return null
  const head = raw.slice(0, 4000)
  const kind: TaxReturnRead['kind'] = TITLE_PERSONAL.test(head) && !/법\s*인\s*세/.test(head) ? 'personal' : 'corp'
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/[ \t ]+/g, ' ').trim())
  const found = new Map<string, { group: ReliefGroup; name: string; amounts: number[]; single: number | null }>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    // 이름이 두 줄로 나뉜 경우('연구 · 인력개발비에 대한' / '세액공제 …') — 이 줄에서 시작하는 것만
    const next = lines[i + 1] ?? ''
    const win = `${line} ${next}`
    for (const r of RELIEFS) {
      const m = r.re.exec(win)
      if (!m || m.index >= line.length) continue
      const end = m.index + m[0].length
      // 이름 뒤 같은 줄 — 이름이 다음 줄까지 이어졌으면 다음 줄의 나머지
      let rest = end <= line.length ? line.slice(end) : win.slice(end)
      let nums = moneyIn(rest)
      // 금액이 다음 줄로 밀린 표(글자 없이 숫자만 있는 줄)
      if (!nums.length && end <= line.length && next && !/[가-힣]/.test(next)) {
        rest = next
        nums = moneyIn(next)
      }
      const pos = nums.filter((n) => n > 0)
      const cur = found.get(r.name) ?? { group: r.group, name: r.name, amounts: [], single: null }
      cur.amounts.push(...pos)
      const distinct = [...new Set(pos)]
      if (distinct.length === 1) cur.single = Math.max(cur.single ?? 0, distinct[0])
      found.set(r.name, cur)
    }
  }
  const items: ReliefItem[] = [...found.values()].filter((f) => f.amounts.length > 0).map((f) => ({ group: f.group, name: f.name, amount: f.single }))
  // 아는 이름이 아닌 공제 · 감면 줄(합계 · 다른 공제)의 금액 — 이름 없이 합계만 있으면 '없음' 이 아니다
  let otherTotal = 0
  for (const line of lines) {
    if (!/공\s*제\s*[·ㆍ]?\s*감\s*면\s*세\s*액|세\s*액\s*감\s*면|세\s*액\s*공\s*제/.test(line) || RELIEFS.some((r) => r.re.test(line))) continue
    for (const n of moneyIn(line)) otherTotal = Math.max(otherTotal, n)
  }
  return { kind, year: yearOf(raw), items, sectionSeen: SECTION.test(raw) || found.size > 0, otherTotal }
}

/** 회사 정보 칸 이름 — 해마다 따로(경정청구는 5년을 본다) */
export function reliefFactLabel(year: number | null): string {
  return year ? `받은 공제 · 감면 ${year}년` : '받은 공제 · 감면'
}

/** 회사 정보 칸 값 — '통합고용세액공제 1,200만원 · 연구 · 인력개발비 세액공제' / '신고서에 공제 · 감면 없음' */
export function reliefFactValue(read: TaxReturnRead, fmt: (won: number) => string): string {
  const src = read.kind === 'personal' ? '종합소득세 신고서' : '법인세 신고서'
  if (!read.items.length && read.otherTotal > 0) return `공제 · 감면 ${fmt(read.otherTotal)}(${src}) — 어떤 공제인지는 공제감면세액계산서 · 세액공제조정명세서에서`
  if (!read.items.length) return `${src}에 공제 · 감면 없음`
  return `${read.items.map((i) => (i.amount ? `${i.name} ${fmt(i.amount)}` : i.name)).join(' · ')}(${src})`
}

export interface ReliefYear {
  year: number
  /** 받은 공제 · 감면 묶음 */
  groups: Set<ReliefGroup>
  /** '공제 · 감면 없음' 이 적힌 해 */
  none: boolean
  text: string
}

/** 회사 정보 칸들(받은 공제 · 감면 YYYY년) → 해마다 받은 묶음. 사람이 고쳐 적은 글도 이름으로 읽는다 */
export function reliefYearsOf(entries: readonly (readonly [string, string])[], prefix: string): ReliefYear[] {
  const out: ReliefYear[] = []
  for (const [k, v] of entries) {
    const label = k.startsWith(prefix) ? k.slice(prefix.length) : k
    const m = /^받은\s*공제\s*[·ㆍ]?\s*감면\s*(20\d{2})\s*년$/.exec(label.trim())
    if (!m) continue
    const text = String(v).trim()
    const groups = new Set<ReliefGroup>()
    for (const r of RELIEFS) if (r.re.test(text) || text.replace(/\s/g, '').includes(r.name.replace(/\s/g, ''))) groups.add(r.group)
    // 사람이 짧게 적은 글('통합고용 · 연구개발')도
    if (/통합\s*고용|고용\s*증대|사회\s*보험료/.test(text)) groups.add('employment')
    if (/연구\s*[·ㆍ]?\s*(?:인력)?\s*개발/.test(text)) groups.add('rnd')
    if (/창업\s*(?:중소기업)?\s*(?:세액)?\s*감면/.test(text)) groups.add('startup')
    const none = /공제\s*[·ㆍ]?\s*감면\s*없음/.test(text) && groups.size === 0
    // 무엇을 받았는지 모르는 해(합계만 · 다른 공제)는 뺀다 — '빠졌다' 고 말하지 않는다
    if (!none && groups.size === 0) continue
    out.push({ year: Number(m[1]), groups, none, text })
  }
  return out.sort((a, b) => b.year - a.year)
}

/** 경정청구는 법정신고기한(사업연도 끝 + 3개월 · 개인은 다음 해 5월)부터 5년 — 오늘 아직 되는 해인가 */
export function refundOpen(year: number, today: string, kind: 'corp' | 'personal' = 'corp'): boolean {
  const due = kind === 'personal' ? `${year + 1}-05-31` : `${year + 1}-03-31`
  const until = `${Number(due.slice(0, 4)) + 5}${due.slice(4)}`
  return today <= until
}
