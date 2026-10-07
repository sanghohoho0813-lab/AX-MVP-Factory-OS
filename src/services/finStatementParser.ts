/**
 * 재무제표(표준재무제표증명 · 재무상태표 · 손익계산서) 글자 → 매출 · 영업이익 · 순이익 · 자산 · 부채 (D-168).
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
  /** 당기 결산 연도(찾았으면) */
  year?: string
}

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
    }
  }
  const y = /(20\d{2})\s*년\s*(?:0?1[0-2]|0?[1-9])\s*월\s*\d{1,2}\s*일\s*(?:현재|까지)/.exec(text) ?? /제\s*\d+\s*\(?\s*당\s*\)?\s*기[^\d]{0,12}(20\d{2})/.exec(text)
  if (y) out.year = y[1]
  return out
}
