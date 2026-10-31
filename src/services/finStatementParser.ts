/**
 * 재무제표(표준재무제표증명 · 재무상태표 · 손익계산서) 글자 → 매출 · 영업이익 · 순이익 · 자산 · 부채 (D-168)
 * + 가지급금(주임종 채권) · 미처분이익잉여금 · 전기 순이익 (D-305 — 절세 설계 현황).
 *
 * 줄마다 '과목 이름 + 숫자' 를 찾는다. 숫자가 둘 이상이면 앞의 것이 당기(올해)다(재무제표는 당기 → 전기 순).
 * 단위: '(단위 : 천원)' '(단위: 백만원)' 이 있으면 곱한다. 손실 과목(영업손실 · 당기순손실) · (123) · △123 · -123 은 음수.
 * 규칙 계산이다. 못 읽으면 그 값은 내지 않는다(지어내지 않는다).
 */

import { fixAmountNoise, joinNumberOnlyLines } from './ocrNumbers'
export interface FinStatementValues {
  revenue?: number
  operatingProfit?: number
  netIncome?: number
  totalAssets?: number
  totalLiabilities?: number
  /** D-305: 가지급금 · 주주임원종업원 채권(대여금) 합 — 절세 설계 '가지급금 잔액' */
  loanBalance?: number
  /** D-305: 미처분이익잉여금(음수면 미처리결손금) — 절세 설계 '배당 가능한 이익' */
  retainedEarnings?: number
  /** D-305: 당기순이익 줄의 둘째 숫자(전기) — 절세 설계 '순이익 — 직전 연도' */
  netIncomePrev?: number
  /** D-406: 매출액 줄의 둘째 숫자(전기) — 매출 추이(작년보다 +N%) */
  revenuePrev?: number
  /** D-409: 가지급금 · 주임종 채권 줄의 둘째 숫자(전기 말) 합 — 한 줄이라도 둘째 숫자가 없으면 없음 */
  loanBalancePrev?: number
  /** D-409: 미처분이익잉여금 줄의 둘째 숫자(전기 말) */
  retainedEarningsPrev?: number
  /** D-419: 손익계산서 경상연구개발비 · 연구개발비(당기) — 무형자산 '개발비' 는 아님 */
  rnd?: number
  /** 당기 결산 연도(찾았으면) */
  year?: string
  /**
   * D-418 재무제표 안의 셈이 맞아 스스로 확인된 값 — 'revenue' · 'revenuePrev' · 'operatingProfit' · 'netIncome' · 'netIncomePrev' ·
   * 'totalAssets' · 'totalLiabilities'(전기는 'Prev'). 매출 − 매출원가 = 매출총이익 · 매출총이익 − 판관비 = 영업이익 ·
   * 법인세차감전순이익 − 법인세비용 = 당기순이익 · 자산총계 = 부채총계 + 자본총계 가 원 단위까지 맞을 때만.
   */
  verified?: string[]
}

/** 가지급금 · 주임종 채권(대여금) — 특수관계자에게 빌려준 돈. 일반 '단기대여금' 은 남에게 빌려준 것일 수 있어 넣지 않는다 */
const LOAN = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?(?:가\s*지\s*급\s*금|주\s*[.·ㆍ,]?\s*임\s*[.·ㆍ,]?\s*종\s*(?:단\s*기|장\s*기)?\s*(?:채\s*권|대\s*여\s*금)|주\s*주\s*[.·ㆍ,]?\s*임\s*원\s*[.·ㆍ,]?\s*종\s*업\s*원\s*(?:단\s*기|장\s*기)?\s*(?:채\s*권|대\s*여\s*금))/
const RETAINED = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?미\s*처\s*분\s*이\s*익\s*잉\s*여\s*금(\s*[(（]\s*미\s*처\s*리\s*결\s*손\s*금\s*[)）])?/

const ITEMS: [keyof Omit<FinStatementValues, 'year' | 'verified'>, RegExp, boolean][] = [
  ['revenue', /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*)?(?:매\s*출\s*액|영\s*업\s*수\s*익|수\s*익\s*\(\s*매\s*출\s*액\s*\))/, false],
  ['operatingProfit', /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*)?영\s*업\s*(이\s*익|손\s*실|이\s*익\s*\(\s*손\s*실\s*\))/, true],
  ['netIncome', /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*)?당\s*기\s*순\s*(이\s*익|손\s*실|이\s*익\s*\(\s*손\s*실\s*\))/, true],
  ['totalAssets', /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*)?자\s*산\s*총\s*계/, false],
  ['totalLiabilities', /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*)?부\s*채\s*총\s*계/, false],
]

const NUM = /(\(\s*[\d,]+\s*\)|[△▲-]?\s*\d{1,3}(?:,\d{3})+|[△▲-]?\s*\d{4,})/g

function unitOf(text: string): number {
  const m = /단\s*위\s*[:：]?\s*(백만\s*원|천\s*원|원)/.exec(text)
  if (!m) return 1
  if (/백만/.test(m[1])) return 1_000_000
  if (/천/.test(m[1])) return 1_000
  return 1
}

function valueOf(token: string): number | null {
  const neg = /^\(|^[△▲-]/.test(token.trim())
  const n = Number(token.replace(/[^\d]/g, ''))
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

/** '제 7(당)기 2025년 12월 31일 현재' · '제 7(당)기 2024년 4월 1일부터 2025년 3월 31일까지' → 당기 끝 해(전기 글은 빼고) */
const CUR_HEAD = /제\s*\d+\s*[(（]?\s*당\s*[)）]?\s*기/
function curYearOfLine(line: string): number | null {
  const m = CUR_HEAD.exec(line)
  if (!m) return null
  let span = line.slice(m.index + m[0].length)
  const prevAt = span.search(/제\s*\d+\s*[(（]?\s*전\s*[)）]?\s*기/)
  if (prevAt >= 0) span = span.slice(0, prevAt)
  const ys = [...span.matchAll(/(20\d{2})/g)].map((x) => Number(x[1]))
  return ys.length ? ys[ys.length - 1] : null
}

/**
 * D-413 여러 해 재무제표를 한 PDF 로 합쳐 올리면(2023 · 2024 · 2025 순서로 붙인 파일) 예전에는 파일 앞쪽 해만 읽어
 * 옛날 해가 앞이면 그 해 숫자가 회사 정보에 들어갔다. '(당)기' 머리줄의 해가 둘 이상이면 가장 최근 해 부분만 읽는다.
 * 한 해 재무제표(재무상태표 · 손익계산서 머리줄이 같은 해)는 예전과 같다.
 */
export function parseFinancialStatement(text: string): FinStatementValues {
  text = fixAmountNoise(String(text || ''))
  const all = text.split(/\r?\n/)
  const heads = all.map((l, i) => ({ i, y: curYearOfLine(l) })).filter((h): h is { i: number; y: number } => h.y !== null)
  const years = new Set(heads.map((h) => h.y))
  if (years.size >= 2) {
    const maxY = Math.max(...years)
    const parts = heads.flatMap((h, k) => (h.y === maxY ? [all.slice(k === 0 ? 0 : h.i, k + 1 < heads.length ? heads[k + 1].i : all.length).join('\n')] : []))
    let picked = parts.join('\n')
    // 단위 줄이 그 부분에 없으면 파일의 첫 단위 줄을 앞에(천원 · 백만원 재무제표)
    if (!/단\s*위/.test(picked)) {
      const u = all.find((l) => /단\s*위\s*[:：]?\s*(백만\s*원|천\s*원|원)/.test(l))
      if (u) picked = `${u}\n${picked}`
    }
    return parseOneStatement(picked)
  }
  return parseOneStatement(text)
}

/** D-419 경상연구개발비 · 연구개발비 · 경상개발비 */
const RND = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?(?:경\s*상\s*(?:연\s*구\s*)?개\s*발\s*비|연\s*구\s*(?:개\s*발\s*)?비)/

/** D-418 셈 확인에만 쓰는 과목(회사 정보로는 내지 않는다) */
const PFX = String.raw`^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?`
const CHECK_ITEMS: [string, RegExp, boolean][] = [
  ['costOfSales', new RegExp(PFX + String.raw`매\s*출\s*원\s*가`), false],
  ['grossProfit', new RegExp(PFX + String.raw`매\s*출\s*총\s*(이\s*익|손\s*실|이\s*익\s*\(\s*손\s*실\s*\))`), true],
  ['sga', new RegExp(PFX + String.raw`판\s*매\s*비\s*(?:와|및)?\s*(?:일\s*반\s*)?관\s*리\s*비`), false],
  ['pretax', new RegExp(PFX + String.raw`법\s*인\s*세\s*(?:비\s*용\s*)?차\s*감\s*전\s*(?:순\s*)?(이\s*익|손\s*실|이\s*익\s*\(\s*손\s*실\s*\))`), true],
  ['incomeTax', new RegExp(PFX + String.raw`법\s*인\s*세\s*(?:비\s*용|등)(?!\s*차\s*감)`), false],
  ['totalEquity', new RegExp(PFX + String.raw`자\s*본\s*총\s*계`), false],
]

function parseOneStatement(text: string): FinStatementValues {
  const out: FinStatementValues = {}
  if (!text || !/(재무|손익|대차|자산|매출)/.test(text)) return out
  const unit = unitOf(text)
  // D-414 표 칸이 줄마다 따로 나온 글은 숫자 줄을 앞 줄에 붙여 읽는다
  const lines = joinNumberOnlyLines(text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean))
  const loanSeen = new Set<string>()
  let loanPrevOk = true
  // D-418 셈 확인용 — 과목마다 [당기, 전기](손실 과목은 음수)
  const cols: Record<string, [number | undefined, number | undefined]> = {}
  const colOf = (key: string, nums: number[], loss: boolean) => {
    if (cols[key]) return
    const sign = (v: number | undefined) => (v === undefined ? undefined : loss && v > 0 ? -v * unit : v * unit)
    cols[key] = [sign(nums[0]), sign(nums[1])]
  }
  for (const line of lines) {
    for (const [key, re, lossable] of CHECK_ITEMS) {
      const m = re.exec(line)
      if (!m || cols[key]) continue
      const nums = [...line.slice(m[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).filter((v): v is number => v !== null)
      if (nums.length) colOf(key, nums, lossable && /손\s*실/.test(m[0]) && !/이\s*익/.test(m[0]))
    }
    for (const [key, re, lossable] of ITEMS) {
      if (out[key] !== undefined) continue
      const m = re.exec(line)
      if (!m) continue
      const rest = line.slice(m[0].length)
      const nums = [...rest.matchAll(NUM)].map((x) => valueOf(x[0])).filter((v): v is number => v !== null)
      if (nums.length === 0) continue
      let v = nums[0] * unit
      // '영업손실 30,000' — 손실 과목인데 부호가 없으면 음수로
      if (lossable && /손\s*실/.test(m[0]) && !/이\s*익/.test(m[0]) && v > 0) v = -v
      out[key] = v
      colOf(key, nums, lossable && /손\s*실/.test(m[0]) && !/이\s*익/.test(m[0]))
      // D-305: 당기순이익 줄의 둘째 숫자는 전기(직전 연도). '당기순손실' 처럼 손실만 적힌 줄은 전기 부호를 알 수 없어 내지 않는다
      if (key === 'netIncome' && nums.length >= 2 && /이\s*익/.test(m[0])) out.netIncomePrev = nums[1] * unit
      // D-406: 매출액 줄의 둘째 숫자도 전기(직전 연도) — 0 이하이면 비교하지 않는다
      if (key === 'revenue' && nums.length >= 2 && nums[1] > 0) out.revenuePrev = nums[1] * unit
    }
    // D-305: 가지급금 · 주임종 채권은 서로 다른 과목이면 더한다(둘 다 적힌 재무상태표도 있다) — 같은 과목이 또 나오면(다른 쪽 · 비교표) 처음 것만
    //   미처분이익잉여금은 처음 것
    const lm = LOAN.exec(line)
    const lk = lm ? lm[0].replace(/[^가-힣]/g, '') : ''
    if (lm && !loanSeen.has(lk)) {
      const ns = [...line.slice(lm[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).filter((v): v is number => v !== null)
      const n = ns[0]
      if (n !== undefined) {
        loanSeen.add(lk)
        out.loanBalance = (out.loanBalance ?? 0) + Math.max(0, n) * unit
        if (ns.length >= 2) out.loanBalancePrev = (out.loanBalancePrev ?? 0) + Math.max(0, ns[1]) * unit
        else loanPrevOk = false
      }
    }
    // D-419 경상연구개발비 · 연구개발비 — 세액공제 줄('…에 대한 세액공제')은 아님 · 무형자산 '개발비' 는 아님
    const dm = out.rnd === undefined && !/공\s*제/.test(line) ? RND.exec(line) : null
    if (dm) {
      const ns = [...line.slice(dm[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).filter((v): v is number => v !== null)
      if (ns[0] !== undefined && ns[0] > 0) out.rnd = ns[0] * unit
    }
    const rm = out.retainedEarnings === undefined ? RETAINED.exec(line) : null
    if (rm) {
      const ns = [...line.slice(rm[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).filter((v): v is number => v !== null)
      if (ns[0] !== undefined) out.retainedEarnings = ns[0] * unit
      if (ns.length >= 2) out.retainedEarningsPrev = ns[1] * unit
    }
  }
  if (!loanPrevOk) delete out.loanBalancePrev
  // D-418 셈이 원 단위까지 맞는 값 — 스캔(OCR) 글이어도 잘못 읽었을 가능성이 아주 낮다
  const verified: string[] = []
  for (const c of [0, 1] as const) {
    const g = (k: string) => cols[k]?.[c]
    const tag = (k: string) => verified.push(c === 0 ? k : `${k}Prev`)
    const rev = g('revenue'), cos = g('costOfSales'), gp = g('grossProfit'), sga = g('sga'), op = g('operatingProfit')
    const pre = g('pretax'), tax = g('incomeTax'), ni = g('netIncome'), ta = g('totalAssets'), tl = g('totalLiabilities'), te = g('totalEquity')
    if (rev !== undefined && cos !== undefined && gp !== undefined && rev - cos === gp) tag('revenue')
    if (gp !== undefined && sga !== undefined && op !== undefined && gp - sga === op) tag('operatingProfit')
    if (pre !== undefined && tax !== undefined && ni !== undefined && pre - tax === ni) tag('netIncome')
    if (ta !== undefined && tl !== undefined && te !== undefined && ta === tl + te) {
      tag('totalAssets')
      tag('totalLiabilities')
    }
  }
  if (verified.length) out.verified = verified
  const y = /(20\d{2})\s*년\s*(?:0?1[0-2]|0?[1-9])\s*월\s*\d{1,2}\s*일\s*(?:현재|까지)/.exec(text) ?? /제\s*\d+\s*\(?\s*당\s*\)?\s*기[^\d]{0,12}(20\d{2})/.exec(text)
  if (y) out.year = y[1]
  return out
}
