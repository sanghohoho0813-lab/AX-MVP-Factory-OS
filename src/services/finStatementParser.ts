/**
 * 재무제표(표준재무제표증명 · 재무상태표 · 손익계산서) 글자 → 매출 · 영업이익 · 순이익 · 자산 · 부채 (D-168)
 * + 가지급금(주임종 채권) · 미처분이익잉여금 · 전기 순이익 (D-305 — 절세 설계 현황).
 *
 * 줄마다 '과목 이름 + 숫자' 를 찾는다. 숫자가 둘 이상이면 앞의 것이 당기(올해)다(재무제표는 당기 → 전기 순).
 * 단위: '(단위 : 천원)' '(단위: 백만원)' 이 있으면 곱한다. 손실 과목(영업손실 · 당기순손실) · (123) · △123 · -123 은 음수.
 * 규칙 계산이다. 못 읽으면 그 값은 내지 않는다(지어내지 않는다).
 */
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
  /** 당기 결산 연도(찾았으면) */
  year?: string
}

/** 가지급금 · 주임종 채권(대여금) — 특수관계자에게 빌려준 돈. 일반 '단기대여금' 은 남에게 빌려준 것일 수 있어 넣지 않는다 */
const LOAN = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?(?:가\s*지\s*급\s*금|주\s*[.·ㆍ,]?\s*임\s*[.·ㆍ,]?\s*종\s*(?:단\s*기|장\s*기)?\s*(?:채\s*권|대\s*여\s*금)|주\s*주\s*[.·ㆍ,]?\s*임\s*원\s*[.·ㆍ,]?\s*종\s*업\s*원\s*(?:단\s*기|장\s*기)?\s*(?:채\s*권|대\s*여\s*금))/
const RETAINED = /^(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩIVX]+\s*[.)]?\s*|\d{1,2}\s*[.)]\s*|[(（]?\d{1,2}[)）]\s*)?미\s*처\s*분\s*이\s*익\s*잉\s*여\s*금(\s*[(（]\s*미\s*처\s*리\s*결\s*손\s*금\s*[)）])?/

const ITEMS: [keyof Omit<FinStatementValues, 'year'>, RegExp, boolean][] = [
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

export function parseFinancialStatement(text: string): FinStatementValues {
  const out: FinStatementValues = {}
  if (!text || !/(재무|손익|대차|자산|매출)/.test(text)) return out
  const unit = unitOf(text)
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const loanSeen = new Set<string>()
  for (const line of lines) {
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
      // D-305: 당기순이익 줄의 둘째 숫자는 전기(직전 연도). '당기순손실' 처럼 손실만 적힌 줄은 전기 부호를 알 수 없어 내지 않는다
      if (key === 'netIncome' && nums.length >= 2 && /이\s*익/.test(m[0])) out.netIncomePrev = nums[1] * unit
    }
    // D-305: 가지급금 · 주임종 채권은 서로 다른 과목이면 더한다(둘 다 적힌 재무상태표도 있다) — 같은 과목이 또 나오면(다른 쪽 · 비교표) 처음 것만
    //   미처분이익잉여금은 처음 것
    const lm = LOAN.exec(line)
    const lk = lm ? lm[0].replace(/[^가-힣]/g, '') : ''
    if (lm && !loanSeen.has(lk)) {
      const n = [...line.slice(lm[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).find((v): v is number => v !== null)
      if (n !== undefined) {
        loanSeen.add(lk)
        out.loanBalance = (out.loanBalance ?? 0) + Math.max(0, n) * unit
      }
    }
    const rm = out.retainedEarnings === undefined ? RETAINED.exec(line) : null
    if (rm) {
      const n = [...line.slice(rm[0].length).matchAll(NUM)].map((x) => valueOf(x[0])).find((v): v is number => v !== null)
      if (n !== undefined) out.retainedEarnings = n * unit
    }
  }
  const y = /(20\d{2})\s*년\s*(?:0?1[0-2]|0?[1-9])\s*월\s*\d{1,2}\s*일\s*(?:현재|까지)/.exec(text) ?? /제\s*\d+\s*\(?\s*당\s*\)?\s*기[^\d]{0,12}(20\d{2})/.exec(text)
  if (y) out.year = y[1]
  return out
}
