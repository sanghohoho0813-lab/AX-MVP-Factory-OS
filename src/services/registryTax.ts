/**
 * D-304 법인 등기부등본 · 정관(임원퇴직금 지급규정) → 절세 현황 — 대표 "서류는 대충 올려도 알아서".
 *
 * 요청 문구는 '대표 취임일 · 1주 액면가 → 법인 등기사항전부증명서' 라고 고객에게 달라고 하는데,
 * 받은 등기부에서는 회사 정보(상호 · 번호 · 대표 · 설립일 · 주소)만 읽고 있었다. 이제 절세 설계가 쓰는 값까지 읽는다.
 *  - 등기부: 1주의 금액 · 발행주식의 총수 · 자본금(검산: 1주의 금액 × 총수 = 자본금) ·
 *    대표가 처음 임원이 된 날(취임 · 선임 — 중임으로 이어지면 그대로, 퇴임 뒤 한 달 넘게 비면 그 뒤 취임부터).
 *    '발행할 주식의 총수'(정관상 한도)는 총수가 아니다. 증자로 여러 번 바뀌었으면 마지막 줄.
 *    현재 유효사항만 나온 등기부라 '중임' 날짜만 있으면 처음 취임일을 모른다 — 확실하지 않음으로(말소사항 포함 등기부로 확인).
 *  - 정관 · 임원퇴직금 지급규정: 대표이사의 퇴직금 지급배수('대표이사 3배' · 표의 지급배수 칸).
 * 주민등록번호 · 주소는 남기지 않는다. 규칙 계산 — 외부 호출 없음.
 */

export interface RegistryTaxRead {
  /** 1주의 금액(원) */
  par: number | null
  /** 발행주식의 총수(가장 최근 줄) */
  totalShares: number | null
  /** 자본금(원) — 검산용 */
  capital: number | null
  /** 1주의 금액 × 총수 = 자본금 이 맞나(자본금이 없으면 false) */
  sharesSure: boolean
  /** 1주의 금액이 한 가지로만 나왔나(또는 자본금 검산이 맞나) */
  parSure: boolean
  /** 대표가 처음 임원이 된 날(YYYY-MM-DD) */
  ceoStart: string | null
  ceoStartSure: boolean
  /** 화면에 보일 근거('대표이사 2018-03-05 취임 · 2021-03-05 중임 …') 또는 확실하지 않은 까닭 */
  ceoStartNote: string
}

const num = (s: string) => Number(s.replace(/[,\s]/g, ''))
const pad2 = (n: number) => String(n).padStart(2, '0')
const flat = (t: string) => t.replace(/\s+/g, ' ')

function lastMatch(re: RegExp, text: string): RegExpExecArray | null {
  let last: RegExpExecArray | null = null
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  for (let m = g.exec(text); m; m = g.exec(text)) last = m
  return last
}

type Act = 'in' | 'renew' | 'out'
interface OfficerEvent {
  name: string
  role: string
  date: string
  act: Act
}

const ROLE = /(공동대표이사|대표이사|사내이사|사외이사|기타비상무이사|이사|감사|대표)/
const ACT: Record<string, Act> = { 취임: 'in', 선임: 'in', 중임: 'renew', 퇴임: 'out', 사임: 'out', 해임: 'out', 만료: 'out', 사망: 'out' }

/** '임원에 관한 사항' 칸 — 사람(직위 · 이름) 다음에 오는 날짜 · 취임/중임/퇴임 */
function officerEvents(text: string): OfficerEvent[] {
  const t = flat(text)
  const at = t.search(/임원에\s*관한\s*사항/)
  if (at < 0) return []
  const rest = t.slice(at)
  // 다음 칸 머리에서 멈춘다
  const end = rest.slice(10).search(/회사성립연월일|등기기록의\s*개설|기\s*타\s*사\s*항|지\s*점\s*에\s*관한|지배인|전환사채|신주인수권|종류주식|주식매수선택권|목\s*적\s/)
  const sec = (end >= 0 ? rest.slice(0, end + 10) : rest).replace(/\d{6}\s*-\s*[\d*]{1,7}\**/g, ' ')
  const out: OfficerEvent[] = []
  let cur: { role: string; name: string } | null = null
  const re = new RegExp(`${ROLE.source}\\s+([가-힣]{2,5})|(\\d{4})\\s*[년.\\-]\\s*(\\d{1,2})\\s*[월.\\-]\\s*(\\d{1,2})\\s*일?\\s*(취임|선임|중임|퇴임|사임|해임|만료|사망|등기)`, 'g')
  for (let m = re.exec(sec); m; m = re.exec(sec)) {
    if (m[1] && m[2]) {
      cur = { role: m[1], name: m[2] }
      continue
    }
    const act = m[6]
    if (!cur || act === '등기') continue
    out.push({ name: cur.name, role: cur.role, date: `${m[3]}-${pad2(Number(m[4]))}-${pad2(Number(m[5]))}`, act: ACT[act] })
  }
  return out
}

const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** 대표가 지금 임기까지 쉬지 않고 임원이었던 첫날 — 퇴임 뒤 31일 안에 다시 취임 · 중임하면 이어진 것으로 */
function tenureStart(events: OfficerEvent[]): { start: string | null; sure: boolean; note: string } {
  // 같은 날 '만료' 와 '중임' 이면 만료를 먼저 본다(이어진 임기)
  const ev = [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.act === 'out' ? -1 : 0) - (b.act === 'out' ? -1 : 0))
  let start: { date: string; act: Act } | null = null
  let outAt: string | null = null
  for (const e of ev) {
    if (e.act === 'out') {
      outAt = e.date
      continue
    }
    // 그만둔 뒤 한 달 넘게 비었다가 다시 맡으면 새 임기 — 거기서부터
    if (start && outAt && dayGap(outAt, e.date) > 31) start = null
    if (!start) start = { date: e.date, act: e.act }
    outAt = null
  }
  if (outAt) return { start: null, sure: false, note: `${outAt} 퇴임 뒤 다시 취임한 기록이 없어요` }
  if (!start) return { start: null, sure: false, note: '' }
  const from = start.date
  const trail = ev
    .filter((e) => e.date >= from && e.act !== 'out')
    .slice(0, 4)
    .map((e) => `${e.date} ${e.act === 'renew' ? '중임' : '취임'}`)
    // D-373 사내이사 · 대표이사 줄이 같은 날 '취임' 을 두 번 말하면 한 번만
    .filter((x, i, a) => a.indexOf(x) === i)
    .join(' · ')
  if (start.act === 'renew') return { start: from, sure: false, note: `중임 날짜(${from})만 있어 처음 취임일을 몰라요 — 말소사항 포함 등기부로 확인` }
  return { start: from, sure: true, note: trail }
}

/** 등기부등본 글 → 절세 현황 값. 등기부가 아니면 null */
export function readRegistryTax(text: string, ceoName = ''): RegistryTaxRead | null {
  const t = flat(String(text || ''))
  if (!/등기사항|등기부|임원에\s*관한\s*사항|1\s*주\s*의\s*금\s*액/.test(t)) return null
  const parM = lastMatch(/1\s*주\s*의\s*금\s*액\s*[:：]?\s*(?:금\s*)?([\d,]+)\s*원/, t)
  // '발행할 주식의 총수'(정관상 한도)는 '발행\s*주식' 이 붙어 있지 않아 걸리지 않는다. 증자로 바뀌었으면 마지막 줄이 지금 값.
  //   등기부 표는 한 줄에 '발행주식의 총수 N 주 · 보통주식 N 주 · 금 X 원(자본금의 액)' — 같은 줄의 금액을 자본금으로 짝 짓는다
  const rowM = lastMatch(/발행\s*주식\s*의\s*총\s*수\s*[:：]?\s*([\d,]+)\s*주([^금]{0,80})금\s*([\d,]+)\s*원/, t)
  const totalM = lastMatch(/발행\s*주식\s*의\s*총\s*수\s*[:：]?\s*(?:보통주식?\s*)?([\d,]+)\s*주/, t)
  const capM = lastMatch(/자\s*본\s*금\s*(?:의\s*)?(?:액|총액)?\s*[:：]?\s*(?:금\s*)?([\d,]+)\s*원/, t)
  const par = parM ? num(parM[1]) : null
  const totalShares = totalM ? num(totalM[1]) : null
  // 같은 줄의 짝이 마지막 총수와 같으면 그 금액, 아니면 '자본금' 이라고 적힌 값
  const capital = rowM && num(rowM[1]) === totalShares ? num(rowM[3]) : capM ? num(capM[1]) : null
  const sharesSure = par !== null && totalShares !== null && capital !== null && par > 0 && par * totalShares === capital
  // 1주의 금액은 여러 번 나와도 모두 같으면 확실(액면 분할 · 병합이 있었으면 다르다)
  const pars = new Set([...t.matchAll(/1\s*주\s*의\s*금\s*액\s*[:：]?\s*(?:금\s*)?([\d,]+)\s*원/g)].map((m) => num(m[1])))
  const parSure = par !== null && par > 0 && (sharesSure || pars.size === 1)

  const events = officerEvents(text)
  const ceo = ceoName.replace(/\s/g, '') || events.find((e) => /대표/.test(e.role))?.name || ''
  const mine = events.filter((e) => e.name === ceo)
  const ten = mine.length ? tenureStart(mine) : { start: null, sure: false, note: '' }
  if (par === null && totalShares === null && !ten.start) return null
  return { par, totalShares, capital, sharesSure, parSure, ceoStart: ten.start, ceoStartSure: ten.sure, ceoStartNote: ten.note }
}

/**
 * D-380 지금 임원의 이번 임기 — 등기부 '임원에 관한 사항' 의 마지막 취임 · 중임(그 뒤 퇴임 · 사임 · 만료가 없는 사람만).
 * 이사 임기는 3년을 넘지 못한다(상법 제383조) — 정관이 정한 임기를 모르면 3년으로 본다(★ 정관 확인).
 * 바뀐 임원은 2주 안에 변경(중임) 등기를 해야 하고 늦으면 과태료다. 한 사람이 사내이사 · 대표이사로 함께 나오면 높은 직위 하나로.
 */
export interface OfficerTerm {
  role: string
  name: string
  /** 이번 임기 시작(YYYY-MM-DD) */
  start: string
  act: 'in' | 'renew'
  /** 3년이면 끝나는 날 */
  ends: string
}

const ROLE_RANK = ['공동대표이사', '대표이사', '대표', '사내이사', '사외이사', '기타비상무이사', '이사', '감사']

export function officerTerms(text: string, termYears = 3): OfficerTerm[] {
  const events = officerEvents(text)
  const byName = new Map<string, OfficerEvent[]>()
  for (const e of events) byName.set(e.name, [...(byName.get(e.name) ?? []), e])
  const out: OfficerTerm[] = []
  for (const [name, list] of byName) {
    // 같은 날 '만료' 와 '중임' 이면 만료를 먼저(이어진 임기)
    const ev = [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.act === 'out' ? -1 : 0) - (b.act === 'out' ? -1 : 0))
    const last = ev[ev.length - 1]
    if (!last || last.act === 'out') continue
    const sameDay = ev.filter((e) => e.date === last.date && e.act !== 'out')
    const role = [...sameDay].sort((a, b) => ROLE_RANK.indexOf(a.role) - ROLE_RANK.indexOf(b.role))[0].role
    const y = Number(last.date.slice(0, 4)) + termYears
    out.push({ role, name, start: last.date, act: last.act === 'renew' ? 'renew' : 'in', ends: `${y}${last.date.slice(4)}` })
  }
  return out.sort((a, b) => a.ends.localeCompare(b.ends) || ROLE_RANK.indexOf(a.role) - ROLE_RANK.indexOf(b.role))
}

/** 회사 정보 '임원 임기' 칸 — '대표이사 김대표 2023-03-02 취임 · 3년이면 2026-03-02 만료 / …'(많아야 넷) */
export function officerTermsValue(terms: readonly OfficerTerm[]): string {
  return terms
    .slice(0, 4)
    .map((t) => `${t.role} ${t.name} ${t.start} ${t.act === 'renew' ? '중임' : '취임'} · 3년이면 ${t.ends} 만료`)
    .join(' / ')
}

/** '임원 임기' 칸 글 → 사람마다 끝나는 날(사람이 고쳐 적은 날짜도 그대로) */
export function officerTermsOf(value: string): { role: string; name: string; ends: string }[] {
  const out: { role: string; name: string; ends: string }[] = []
  for (const m of String(value || '').matchAll(/([가-힣]+)\s+([가-힣]{2,5})\s+\d{4}-\d{2}-\d{2}\s*(?:취임|중임)[^/]*?(\d{4}-\d{2}-\d{2})\s*만료/g)) out.push({ role: m[1], name: m[2], ends: m[3] })
  return out
}

/**
 * 정관 · 임원퇴직금 지급규정 — 대표이사 지급배수. 퇴직금 이야기가 있는 글에서만.
 *  표: 머리에 '지급배수 · 배수 · 지급률' 칸이 있고 대표이사 줄의 그 칸 숫자.  글: '대표이사 … 3배'.
 * 서로 다른 숫자가 나오면 고르지 않는다(null).
 */
export function readRetireMultiple(text: string): number | null {
  const raw = String(text || '').replace(/\r\n?/g, '\n')
  if (!/퇴\s*직\s*금|퇴\s*직\s*급\s*여/.test(raw) || !/배\s*수|지\s*급\s*률|\d\s*배/.test(raw)) return null
  const found = new Set<number>()
  const ok = (n: number) => Number.isFinite(n) && n > 0 && n <= 10
  const lines = raw.split('\n')
  // 표(탭)
  const headIdx = lines.findIndex((l) => l.includes('\t') && /배\s*수|지\s*급\s*률/.test(l) && /직\s*위|구\s*분|직\s*급/.test(l))
  if (headIdx >= 0) {
    const head = lines[headIdx].split('\t')
    const col = head.findIndex((c) => /배\s*수|지\s*급\s*률/.test(c))
    for (const l of lines.slice(headIdx + 1)) {
      const cells = l.split('\t')
      if (!/대\s*표\s*이\s*사|^\s*대\s*표\s*$/.test(cells[0] ?? '') && !/대\s*표\s*이\s*사/.test(cells.slice(0, 2).join(' '))) continue
      const m = /(\d+(?:\.\d+)?)/.exec(cells[col] ?? '')
      if (m && ok(Number(m[1]))) found.add(Number(m[1]))
    }
  }
  // 글: '대표이사 3배' · '대표이사 : 3.0 배' · '대표이사는 3배'
  for (const m of flat(raw).matchAll(/대\s*표\s*이\s*사\s*(?:는|은)?\s*[:：]?\s*(?:지급\s*배수\s*)?(\d+(?:\.\d+)?)\s*배/g)) if (ok(Number(m[1]))) found.add(Number(m[1]))
  return found.size === 1 ? [...found][0] : null
}
