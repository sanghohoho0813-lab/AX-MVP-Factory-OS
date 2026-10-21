/**
 * 사업자등록번호 읽기 (D-255) — 규칙 계산(AI 아님).
 *
 * 팀장 지적: 사업자등록증을 올리면 번호가 틀린다(7 → 1 등). 번호가 틀리면 컨설턴트에게 치명적이다.
 * 그래서 '읽은 것'을 그대로 믿지 않는다.
 *  1. 글자 속 번호 모양을 전부 모은다 — 대시 변형(－ – —) · 전각 숫자 · 숫자 사이의 O/l/I/S/B 를 고쳐 읽고,
 *     '등록번호' 줄에서 나온 것에 무게를 준다(법인등록번호 13자리는 빼고).
 *  2. 국세청 검증 숫자(끝자리)로 거른다 — 숫자 하나만 틀려도 반드시 안 맞는다.
 *  3. 스캔(사진 글자)이면 '번호만 다시 읽기' 결과([번호 다시 읽기] 줄)와 맞아야 '확실'.
 *  4. 아무것도 안 맞으면 헷갈리기 쉬운 숫자(1↔7 · 3↔8 · 6↔8 …)를 하나씩 바꿔 검증 숫자가 맞는 후보를 만든다.
 *     후보는 '확인' 으로만 보인다 — 절대 저절로 넣지 않는다.
 */

/** 스캔 글자 인식이 번호 줄만 다시 읽은 결과 — 서류 글 끝에 이 머리로 붙는다 */
export const REREAD_MARK = '[번호 다시 읽기]'

/** 사업자등록번호 검증 숫자(국세청 규칙) — 글자 하나만 틀려도 맞지 않는다 */
export function bizNoChecksumOk(value: string): boolean {
  const d = value.replace(/\D/g, '').split('').map(Number)
  if (d.length !== 10) return false
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += d[i] * w[i]
  sum += Math.floor((d[8] * 5) / 10)
  return (10 - (sum % 10)) % 10 === d[9]
}

/** '1248100998' → '124-81-00998' */
export function formatBizNoDigits(d: string): string {
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** 헷갈리기 쉬운 숫자 짝 — 뒤 숫자가 클수록 자주 헷갈린다(스캔 · 사진 글자 인식에서 실제로 많이 나오는 순) */
const CONFUSION: ReadonlyArray<[string, string, number]> = [
  ['1', '7', 5],
  ['3', '8', 4],
  ['6', '8', 4],
  ['0', '8', 3],
  ['5', '6', 3],
  ['1', '4', 2],
  ['8', '9', 2],
  ['0', '6', 2],
  ['0', '9', 1],
  ['4', '9', 1],
  ['2', '7', 1],
  ['3', '5', 1],
]

const LIKE: Record<string, Array<[string, number]>> = (() => {
  const m: Record<string, Array<[string, number]>> = {}
  for (const [a, b, w] of CONFUSION) {
    ;(m[a] ??= []).push([b, w])
    ;(m[b] ??= []).push([a, w])
  }
  return m
})()

/** 번호 근처 글자 고치기 — 전각 숫자 · 대시 변형 · 숫자 사이에 낀 영문(O → 0, l/I/| → 1, S → 5, B → 8, Z → 2) */
export function normalizeNumberText(line: string): string {
  let s = line
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－–—―‐‑−ㅡ~]/g, '-')
    .replace(/[〇○]/g, '0')
    // 스캔에서 대시가 점 · 쉼표 · 가운뎃점으로 읽히는 일이 잦다(361-45.70187) — 숫자 사이에 낀 것만
    .replace(/(?<=\d)\s*[.,·・]\s*(?=\d)/g, '-')
  const fix: Record<string, string> = { O: '0', o: '0', l: '1', I: '1', '|': '1', '!': '1', S: '5', s: '5', B: '8', Z: '2', z: '2' }
  // 번호 덩어리(숫자 · 대시 · 헷갈리는 영문만 8자 넘게 이어지고 숫자가 5개 넘는 것) 안의 영문만 숫자로 — 일반 글자는 건드리지 않는다
  s = s.replace(/[0-9OolI|!SsBZz-]{8,}/g, (tok) => (tok.replace(/\D/g, '').length >= 5 ? tok.replace(/[OolI|!SsBZz]/g, (c) => fix[c] ?? c) : tok))
  return s
}

interface Raw {
  digits: string
  labeled: boolean
  reread: boolean
}

const LABEL = /(?:사\s*업\s*자\s*)?등\s*록\s*번\s*호/
const CORP_LABEL = /법\s*인\s*등\s*록\s*번\s*호/

/** 3-2-5 와 그 한 자리 어긋난 꼴(띄어쓰기로 쪼개진 것 포함) — 전화번호 2-4-4 · 3-4-4, 날짜 4-2-2 는 뺀다 */
const SHAPES = new Set(['10', '11', '3,2,5', '3,2,6', '4,2,5', '3,3,5', '2,2,5', '3,1,5', '3,2,4', '3,7', '5,5', '3,2,3,2', '3,2,2,3', '3,2,4,1', '3,2,1,4'])

/** 한 줄에서 번호 모양 덩어리 — 대시로 이은 숫자 무리, 띄어쓰기 하나로 쪼개진 이웃 무리는 붙여 본다 */
function runsOf(line: string): string[] {
  const toks = [...line.matchAll(/\d+(?:\s*-\s*\d+)*/g)].map((m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }))
  const out = new Set<string>()
  for (let i = 0; i < toks.length; i += 1) {
    let groups: string[] = []
    for (let j = i; j < Math.min(toks.length, i + 3); j += 1) {
      if (j > i && !/^ ?$/.test(line.slice(toks[j - 1].end, toks[j].start))) break
      groups = groups.concat(toks[j].text.split(/\s*-\s*/))
      const d = groups.join('')
      if (d.length > 11) break
      if (d.length >= 10 && SHAPES.has(groups.length === 1 ? String(d.length) : groups.map((g) => g.length).join(','))) out.add(d)
    }
  }
  return [...out]
}

/** 글 전체에서 번호 후보 덩어리 모으기 */
function collect(text: string): Raw[] {
  const raws: Raw[] = []
  // 이름표만 있는 줄(등록번호 :) 다음 줄의 번호도 이름표 붙은 것으로 본다(줄이 갈려 읽힌 스캔)
  let labelPending = false
  for (const rawLine of text.split('\n')) {
    const reread = rawLine.trimStart().startsWith(REREAD_MARK)
    let line = normalizeNumberText(rawLine)
    // 같은 줄에 법인등록번호가 있으면 거기서부터는 법인등록번호 — 사업자 번호 쪽만 본다
    const corp = CORP_LABEL.exec(line)
    if (corp) line = line.slice(0, corp.index)
    const hasLabel = LABEL.test(line)
    const runs = runsOf(line)
    const labeled = reread || hasLabel || (labelPending && runs.length > 0)
    for (const d of runs) raws.push({ digits: d, labeled, reread })
    if (line.trim()) labelPending = hasLabel && runs.length === 0
  }
  return raws
}

/** 숫자 하나 바꿔 검증 숫자가 맞는 후보(헷갈리기 쉬운 짝만) — [후보, 무게] */
function repairs(d: string): Array<[string, number]> {
  const out = new Map<string, number>()
  if (d.length === 10) {
    for (let i = 0; i < 10; i += 1) {
      for (const [to, w] of LIKE[d[i]] ?? []) {
        const c = d.slice(0, i) + to + d.slice(i + 1)
        if (bizNoChecksumOk(c)) out.set(c, Math.max(out.get(c) ?? 0, w))
      }
    }
  } else if (d.length === 11) {
    // 숫자 하나가 더 끼었다 — 하나씩 빼 본다
    for (let i = 0; i < 11; i += 1) {
      const c = d.slice(0, i) + d.slice(i + 1)
      if (bizNoChecksumOk(c)) out.set(c, Math.max(out.get(c) ?? 0, 2))
    }
  }
  return [...out]
}

/** 번호 앞 세 자리(세무서) · 가운데 두 자리(사업자 종류)가 될 수 있는 값인가 */
function plausible(d: string, kind: BizKindHint): boolean {
  if (d[0] === '0') return false
  const mid = Number(d.slice(3, 5))
  if (mid === 0) return false
  if (kind === 'corp') return mid >= 81 && mid <= 88
  if (kind === 'individual') return !(mid >= 80 && mid <= 89)
  return true
}

export type BizKindHint = 'corp' | 'individual' | 'unknown'

/** 서류 글로 본 사업자 종류 — 사업자등록증 머리 '(법인사업자)' · '(일반과세자)' 등 */
export function bizKindFromText(text: string): BizKindHint {
  if (/법\s*인\s*사\s*업\s*자|법인명\s*\(\s*단체명\s*\)/.test(text)) return 'corp'
  if (/(일\s*반|간\s*이)\s*과\s*세\s*자|면\s*세\s*사\s*업\s*자/.test(text)) return 'individual'
  return 'unknown'
}

export interface BizNoRead {
  /** 넣어도 되는 값('000-00-00000'). 확실하지 않으면 가장 그럴듯한 값 또는 '' */
  value: string
  /** 바로 넣어도 되는가 */
  sure: boolean
  /** 확인할 때 고를 후보(검증 숫자가 맞는 것만 · 많아야 4개) */
  candidates: string[]
  /** 다른 서류(크레탑 · 등기)와 맞춰 볼 때 쓰는 후보 전부(검증 숫자가 맞는 것 · 많아야 12개) — 화면에는 candidates 만 */
  alternatives: string[]
  /** 서류에서 읽은 그대로(사람이 원본과 비교할 때) */
  raw: string
  /** 왜 확실/확인인지 — 화면에 쓰는 말 */
  reason: string
}

const NONE: BizNoRead = { value: '', sure: false, candidates: [], alternatives: [], raw: '', reason: '' }

/**
 * 서류 글 → 사업자등록번호.
 * scanned: 스캔 · 사진 글자 인식으로 읽은 글인가(모르면 [번호 다시 읽기] 줄이 있는지로 본다)
 */
export function readBusinessNumber(text: string, opts: { scanned?: boolean; kind?: BizKindHint } = {}): BizNoRead {
  const raws = collect(text)
  if (raws.length === 0) return NONE
  const scanned = opts.scanned ?? text.includes(REREAD_MARK)
  const kind = opts.kind ?? bizKindFromText(text)
  const labeledAny = raws.some((r) => r.labeled && !r.reread)
  // 번호 줄이 있으면 번호 줄 것만 — 다른 줄의 숫자(전화 · 발급번호)가 끼지 않게
  const pool = raws.filter((r) => r.reread || !labeledAny || r.labeled)
  const main = pool.filter((r) => !r.reread)
  const again = pool.filter((r) => r.reread)
  const raw = main[0]?.digits ?? again[0]?.digits ?? ''

  // 검증 숫자가 맞는 10자리 — 몇 번 나왔는지 센다(본문 · 다시 읽기 따로)
  type Tally = { main: number; again: number; labeled: boolean }
  const ok = new Map<string, Tally>()
  for (const r of pool) {
    if (r.digits.length !== 10 || !bizNoChecksumOk(r.digits) || !plausible(r.digits, kind)) continue
    const t = ok.get(r.digits) ?? { main: 0, again: 0, labeled: false }
    if (r.reread) t.again += 1
    else t.main += 1
    t.labeled ||= r.labeled
    ok.set(r.digits, t)
  }
  const ranked = [...ok].sort((a, b) => b[1].main + b[1].again * 1.5 + (b[1].labeled ? 1 : 0) - (a[1].main + a[1].again * 1.5 + (a[1].labeled ? 1 : 0)))
  if (ranked.length > 0) {
    const [best, t] = ranked[0]
    const rivals = ranked.slice(1).map(([d]) => formatBizNoDigits(d))
    const value = formatBizNoDigits(best)
    const alternatives = [value, ...rivals].slice(0, 12)
    if (!scanned) {
      // PDF 글자(홈택스 · 정부24 발급본) — 서류에 적힌 글자 그대로다
      const sure = rivals.length === 0
      return { value, sure, candidates: sure ? [] : [value, ...rivals].slice(0, 4), alternatives, raw: formatBizNoDigits(raw.slice(0, 10)), reason: sure ? '서류 글자 그대로 · 검증 숫자 맞음' : '서류에 번호가 여러 개 — 맞는 것을 골라 주세요' }
    }
    // 스캔 — 본문과 '번호만 다시 읽기' 가 같은 번호를 말해야 확실
    const twice = t.main > 0 && t.again > 0
    const sure = twice && rivals.length === 0
    return {
      value,
      sure,
      candidates: sure ? [] : [value, ...rivals].slice(0, 4),
      alternatives,
      raw: formatBizNoDigits(raw.slice(0, 10)),
      reason: sure ? '스캔 · 두 번 읽어 같음 · 검증 숫자 맞음' : twice ? '번호가 여러 개 읽혔어요 — 원본과 비교해 골라 주세요' : '스캔이라 한 번만 맞게 읽혔어요 — 원본과 한 번 비교해 주세요',
    }
  }

  // 검증 숫자가 맞는 게 하나도 없다 — 헷갈리기 쉬운 숫자를 바꿔 본 후보(넣지 않는다)
  const score = new Map<string, number>()
  for (const r of pool) {
    for (const [c, w] of repairs(r.digits)) {
      if (!plausible(c, kind)) continue
      score.set(c, (score.get(c) ?? 0) + w + (r.reread ? 2 : 0) + (r.labeled ? 1 : 0))
    }
  }
  const alternatives = [...score]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([d]) => formatBizNoDigits(d))
  const candidates = alternatives.slice(0, 4)
  const shown = raw.length >= 10 ? formatBizNoDigits(raw.slice(0, 10)) + (raw.length > 10 ? raw.slice(10) : '') : raw
  return {
    value: '',
    sure: false,
    candidates,
    alternatives,
    raw: shown,
    reason: candidates.length ? `읽은 번호(${shown})가 국세청 검증 숫자와 안 맞아요 — 원본을 보고 맞는 것을 골라 주세요` : `번호를 또렷하게 읽지 못했어요(${shown}) — 원본을 보고 적어 주세요`,
  }
}
