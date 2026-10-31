/**
 * D-303 주주명부 서류 → 주주표 — 대표 "서류는 대충 올려도 알아서".
 *
 * 올린 주주명부(엑셀 · 한글 · 워드 표는 칸이 탭으로 · PDF · 사진 글은 한 줄에 띄어 쓴 글)에서
 * 주주 이름 · 주식 수 · 지분율 · 관계(적혀 있을 때) · 발행주식 총수 · 1주의 금액을 읽는다.
 *  - 주민등록번호 · 주소는 읽지도 남기지도 않는다(숫자로 잘못 읽히지 않게 먼저 지운다).
 *  - 맞는지 스스로 검산한다: 주식 수 합 = 발행주식 총수(또는 합계 줄) · 또는 지분율 합 = 100%.
 *    검산이 맞을 때만 sure — 부르는 쪽(docAutoAnalyze)은 sure 이고 주주표가 비어 있을 때만 바로 넣는다.
 *  - 관계: 대표 이름과 같으면 · '대표이사' 면 대표, '배우자 · 자녀 …' 가 적혀 있으면 그것, 법인 이름이면 법인, 나머지는 '기타'(확인할 것에서 묻는다).
 * 규칙 계산 — 외부 호출 없음.
 */
import type { ShareholderRelation } from '../types/clientOps'
import { fixAmountNoise, joinSpacedHangul } from './ocrNumbers'

export interface ReadHolder {
  name: string
  shares: number
  /** 적혀 있던 지분율(%) — 없으면 null */
  pct: number | null
  relation: ShareholderRelation
  /** 관계를 서류 · 대표 이름으로 알았나(기타로 둔 것은 false) */
  relationSure: boolean
}

export interface RegisterRead {
  holders: ReadHolder[]
  /** 발행주식 총수 — 적힌 값, 없으면 합계 줄, 없으면 null */
  totalShares: number | null
  /** 1주의 금액(액면가, 원) — 적힌 값 또는 금액 ÷ 주식 수, 모르면 null */
  par: number | null
  /** 기준일(YYYY-MM-DD) — 적혀 있을 때만 */
  baseDate: string | null
  /** 어떻게 검산했나 — sum: 주식 수 합 = 총수 · pct: 지분율 합 100% · none: 검산 못 함 */
  check: 'sum' | 'pct' | 'none'
  sure: boolean
}

const TITLE = /주\s*주\s*명\s*부/
const SHARE_HEAD = /주\s*식\s*수|주식의\s*수|소유\s*주식|보유\s*주식|주식\s*수량|소유\s*주수/

/** 주주명부 같은 글인가 — 제목(파일 이름 · 첫머리) + 주식 수 · 지분 말 */
export function looksLikeShareholderRegister(doc: { fileName: string; text: string }): boolean {
  const head = doc.text.slice(0, 2500)
  const titled = TITLE.test(doc.fileName) || TITLE.test(head)
  return titled && (SHARE_HEAD.test(doc.text) || /지\s*분\s*율|\d\s*%/.test(doc.text) || /\d[\d,]*\s*주\b/.test(doc.text))
}

const num = (s: string) => Number(s.replace(/[,\s]/g, ''))
const pad2 = (n: number) => String(n).padStart(2, '0')

/** 주민번호 · 사업자번호 · 날짜 · 전화처럼 숫자로 잘못 읽힐 것을 먼저 지운다(남기지 않는다) */
function scrub(s: string): string {
  return s
    .replace(/\d{6}\s*-\s*[\d*]{1,7}\**/g, ' ')
    .replace(/\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/g, ' ')
    .replace(/\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g, ' ')
    .replace(/0\d{1,2}\s*-\s*\d{3,4}\s*-\s*\d{4}/g, ' ')
}

/** 주주 줄이 아닌 줄(총수 · 1주의 금액 · 기준일 · 회사 이름 · 서명 줄) */
const META = /발행\s*주식|총\s*발행|액면|1\s*주\s*(?:의|당)|기준\s*일|회\s*사\s*명|상\s*호|본\s*점|작\s*성\s*일|\(\s*인\s*\)|직인|위와\s*같/
const SUM = /합\s*계|총\s*계|소\s*계/

const CORP = /\(\s*주\s*\)|㈜|주식회사|유한회사|\(\s*유\s*\)|법인/
/** 이름 자리에 올 수 없는 말(머리줄 · 칸 이름 · 주식 종류 · 직위) */
const STOP = new Set(['번호', '순번', '주주', '주주명', '성명', '이름', '주소', '주식', '보통주', '우선주', '종류', '합계', '총계', '소계', '대표이사', '대표', '이사', '감사', '비고', '지분율', '금액', '주식수', '관계', '구분', '기준일', '본인', '배우자', '자녀', '사내이사', '사외이사'])

function relationOf(text: string, name: string, ceoName: string): { relation: ShareholderRelation; sure: boolean } {
  const n = name.replace(/\s/g, '')
  if (ceoName && n === ceoName.replace(/\s/g, '')) return { relation: 'ceo', sure: true }
  if (CORP.test(name)) return { relation: 'corp', sure: true }
  if (/대표\s*이사|대표자|(?:^|\s)대표(?:\s|$)|본인/.test(text)) return { relation: 'ceo', sure: true }
  if (/배우자|(?:^|\s)(?:처|남편|부인|아내)(?:\s|$)/.test(text)) return { relation: 'spouse', sure: true }
  if (/미성년/.test(text)) return { relation: 'minor_child', sure: true }
  if (/자녀|아들|(?:^|\s)딸(?:\s|$)|장남|장녀|차남|차녀|자\(子\)/.test(text)) return { relation: 'child', sure: true }
  if (/부친|모친|아버지|어머니|(?:^|\s)(?:부|모)(?:\s|$)/.test(text)) return { relation: 'parent', sure: true }
  if (/친족|형제|자매|동생|(?:^|\s)형(?:\s|$)|누나|오빠|언니/.test(text)) return { relation: 'relative', sure: true }
  if (/사내\s*이사|사외\s*이사|(?:^|\s)이사(?:\s|$)|감사|임원|전무|상무/.test(text)) return { relation: 'executive', sure: true }
  return { relation: 'other', sure: false }
}

/** 한 줄 · 한 칸에서 이름 — 법인 이름이면 그대로, 사람이면 첫 한글 2~5자(머리말 말 빼고) */
function nameIn(s: string): string {
  const corp = /((?:\(\s*주\s*\)|㈜|주식회사)\s*[가-힣A-Za-z0-9]{1,20}|[가-힣A-Za-z0-9]{1,20}\s*(?:\(\s*주\s*\)|㈜|주식회사))/.exec(s)
  if (corp) return corp[1].replace(/\s+/g, ' ').trim()
  for (const m of s.matchAll(/[가-힣]{2,5}/g)) if (!STOP.has(m[0])) return m[0]
  return ''
}

interface Cols {
  name: number
  shares: number
  pct: number
  amount: number
  par: number
  note: number
}

function colsOf(cells: string[]): Cols | null {
  const find = (re: RegExp) => cells.findIndex((c) => re.test(c.replace(/\s+/g, '')))
  const name = find(/^(?:주주명|성명|주주|이름|성명\(법인명\)|주주\(성명\)|성명\/법인명|주주성명)/)
  const shares = cells.findIndex((c) => SHARE_HEAD.test(c))
  if (name < 0 || shares < 0) return null
  return { name, shares, pct: find(/지분|비율|^%$/), amount: find(/^금액|액면총액|주금액/), par: find(/1주의금액|1주당금액|액면가/), note: find(/비고|관계|직위|구분/) }
}

/** 주주명부 글 → 주주 · 총수 · 1주의 금액 · 검산 */
export function readShareholderDoc(text: string, ceoName = ''): RegisterRead {
  // D-416 스캔 글자 잡음(한 글자씩 띄운 이름 · '15.000주')을 먼저 고친다
  const raw = fixAmountNoise(joinSpacedHangul(String(text || '').replace(/\r\n?/g, '\n')))
  const flat = raw.replace(/\s+/g, ' ')
  const statedTotal = (() => {
    const m = /발행\s*(?:한\s*)?주식\s*(?:의\s*)?총\s*수\s*[:：]?\s*(?:보통주\s*)?([\d,]+)\s*주?/.exec(flat) ?? /총\s*발행\s*주식\s*수?\s*[:：]?\s*([\d,]+)\s*주?/.exec(flat)
    return m ? num(m[1]) : null
  })()
  const statedPar = (() => {
    const m = /1\s*주\s*(?:의|당)?\s*(?:금액|액면\s*(?:가액?|금액)?)\s*[:：]?\s*(?:금\s*)?([\d,]+)\s*원?/.exec(flat) ?? /액면\s*(?:가액?|금액)\s*[:：]?\s*(?:금\s*)?([\d,]+)\s*원?/.exec(flat)
    return m ? num(m[1]) : null
  })()
  const baseDate = (() => {
    const m = /기준\s*일(?:자)?\s*[:：]?\s*(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(flat)
    return m ? `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}` : null
  })()

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const holders: ReadHolder[] = []
  let sumRow: number | null = null

  // 1) 표(칸이 탭) — 머리줄로 칸을 찾는다
  const tabbed = lines.filter((l) => l.includes('\t'))
  let cols: Cols | null = null
  let headAt = -1
  for (let i = 0; i < tabbed.length && i < 40; i++) {
    cols = colsOf(tabbed[i].split('\t'))
    if (cols) {
      headAt = i
      break
    }
  }
  // D-416 머리줄만 표(탭)이고 주주 줄은 띄어 쓴 글이면 — 표 줄에서 아무도 못 찾았을 때 띄어 쓴 줄로 다시 읽는다
  if (cols && !tabbed.slice(headAt + 1).some((l) => /\d/.test(scrub(l)))) cols = null
  if (cols) {
    for (const line of tabbed.slice(headAt + 1)) {
      const cells = line.split('\t').map((c) => c.trim())
      const nameCell = cells[cols.name] ?? ''
      const sharesCell = scrub(cells[cols.shares] ?? '')
      if (SUM.test(cells.join(' ')) || /^계$/.test(nameCell.replace(/\s/g, ''))) {
        const s = /([\d,]+)/.exec(sharesCell)
        if (s) sumRow = num(s[1])
        continue
      }
      if (META.test(nameCell)) continue
      const name = nameIn(nameCell)
      const sm = /([\d,]+)/.exec(sharesCell)
      if (!name || !sm) continue
      const shares = num(sm[1])
      if (!(shares > 0)) continue
      const pm = cols.pct >= 0 ? /(\d+(?:\.\d+)?)/.exec(cells[cols.pct] ?? '') : null
      const note = cols.note >= 0 ? (cells[cols.note] ?? '') : ''
      const rel = relationOf(`${note} ${nameCell}`, name, ceoName)
      holders.push({ name, shares, pct: pm ? Number(pm[1]) : null, relation: rel.relation, relationSure: rel.sure })
    }
  } else {
    // 2) 띄어 쓴 줄(PDF · 사진 글) — 한 줄에 이름 · 숫자가 함께 있는 줄
    const startAt = Math.max(0, lines.findIndex((l) => SHARE_HEAD.test(l) || /지\s*분\s*율/.test(l)))
    // 머리줄에 지분율 칸이 있으면 '60.00' 처럼 % 없이 쓴 소수도 지분율로 본다
    const pctHead = /지\s*분|비\s*율/.test(lines[startAt] ?? '')
    for (const line of lines.slice(startAt)) {
      if (SHARE_HEAD.test(line) && !/\d/.test(scrub(line))) continue
      if (META.test(line) && !SUM.test(line)) continue
      const clean = scrub(line)
      if (SUM.test(clean)) {
        const s = /([\d,]{1,})\s*주/.exec(clean) ?? /(\d{1,3}(?:,\d{3})+|\d+)/.exec(clean.replace(/합\s*계|총\s*계/g, ''))
        if (s) sumRow = num(s[1])
        continue
      }
      const body = clean.replace(/^\s*\d{1,3}[.)]?\s+/, '')
      const name = nameIn(body)
      if (!name) continue
      const pctM = /(\d+(?:\.\d+)?)\s*%/.exec(body) ?? (pctHead ? /(?:^|\s)(\d{1,3}\.\d{1,4})(?=\s|$)/.exec(body) : null)
      const pct = pctM && Number(pctM[1]) <= 100 ? Number(pctM[1]) : null
      const withJu = /(\d{1,3}(?:,\d{3})+|\d+)\s*주(?![가-힣])/.exec(body)
      const rest = body.replace(/(\d+(?:\.\d+)?)\s*%/g, ' ').replace(/(?:^|\s)\d{1,3}\.\d{1,4}(?=\s|$)/g, ' ')
      const tokens = [...rest.matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)].map((m) => ({ n: num(m[0]), comma: m[0].includes(',') })).filter((t) => t.n > 0)
      const nums = tokens.map((t) => t.n)
      let shares = withJu ? num(withJu[1]) : 0
      if (!shares && statedPar) shares = nums.find((s) => nums.includes(s * statedPar)) ?? 0
      if (!shares && pct !== null && statedTotal) {
        const want = Math.round((statedTotal * pct) / 100)
        shares = nums.includes(want) ? want : 0
      }
      // 마지막 수단: 천 단위 쉼표가 있는 첫 숫자(주소 번지는 보통 쉼표가 없다) — 틀리면 검산에서 걸린다
      if (!shares) shares = tokens.find((t) => t.comma)?.n ?? tokens[0]?.n ?? 0
      if (!(shares > 0)) continue
      const rel = relationOf(body, name, ceoName)
      holders.push({ name, shares, pct, relation: rel.relation, relationSure: rel.sure })
    }
  }

  // 같은 사람이 두 줄(보통주 · 우선주)이면 합친다
  const merged: ReadHolder[] = []
  for (const h of holders) {
    const same = merged.find((x) => x.name === h.name)
    if (same) {
      same.shares += h.shares
      same.pct = same.pct !== null && h.pct !== null ? Math.round((same.pct + h.pct) * 100) / 100 : null
    } else merged.push({ ...h })
  }
  const sumShares = merged.reduce((a, h) => a + h.shares, 0)
  const total = statedTotal ?? sumRow
  let check: RegisterRead['check'] = 'none'
  if (merged.length && total !== null && total > 0 && sumShares === total) check = 'sum'
  else if (merged.length && merged.every((h) => h.pct !== null)) {
    const pctSum = merged.reduce((a, h) => a + (h.pct ?? 0), 0)
    const agree = merged.every((h) => Math.abs((h.shares / sumShares) * 100 - (h.pct ?? 0)) <= 0.6)
    if (Math.abs(pctSum - 100) <= 0.5 && agree && (total === null || total === sumShares)) check = 'pct'
  }
  // 1주의 금액 — 적힌 값, 없으면 금액 ÷ 주식 수가 모두 같을 때(표의 금액 칸)
  let par = statedPar
  if (par === null && cols && (cols.par >= 0 || cols.amount >= 0)) {
    const pars = new Set<number>()
    for (const line of tabbed.slice(headAt + 1)) {
      const cells = line.split('\t')
      if (SUM.test(cells.join(' '))) continue
      if (cols.par >= 0) {
        const v = /([\d,]+)/.exec(scrub(cells[cols.par] ?? ''))
        if (v && num(v[1]) > 0) pars.add(num(v[1]))
        continue
      }
      const sh = /([\d,]+)/.exec(scrub(cells[cols.shares] ?? ''))
      const a = /([\d,]+)/.exec(scrub(cells[cols.amount] ?? ''))
      if (sh && a && num(sh[1]) > 0) pars.add(num(a[1]) / num(sh[1]))
    }
    const only = [...pars]
    if (only.length === 1 && Number.isInteger(only[0]) && only[0] > 0) par = only[0]
  }
  return { holders: merged, totalShares: total ?? (sumShares > 0 ? sumShares : null), par, baseDate, check, sure: check !== 'none' && merged.length > 0 }
}

/** 주주 · 지분 한 줄('이대표 60% · 김배우 40%') — 업체 기록 '주주·임원 구성' 칸이 비어 있을 때 채운다 */
export function holdersLine(read: RegisterRead): string {
  const total = read.holders.reduce((a, h) => a + h.shares, 0)
  if (!total) return ''
  return read.holders
    .map((h) => `${h.name} ${Math.round((h.shares / total) * 1000) / 10}%`)
    .join(' · ')
    .slice(0, 300)
}
