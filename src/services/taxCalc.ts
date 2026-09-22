/**
 * 세금 계산기 9종 — 중기이코노미 기업지원단 배포본(HTML)의 계산식을 그대로 옮긴 것 (D-85).
 *
 * 원칙
 *  - 계산식·세율표·공제표·판정식은 원본 자바스크립트를 **한 글자도 바꾸지 않고** 옮긴다.
 *    이름이 이상해 보여도(oldBracketTax 등) 원본을 따른다 — 고치면 대조가 깨진다.
 *  - 결과 줄의 이름(k)과 값(v)도 원본과 같게 만든다. `e2e/tax-parity.mjs` 가 원본 HTML 과
 *    같은 입력으로 같은 글자가 나오는지 브라우저에서 대조한다.
 *  - 규칙 계산이다. 외부 호출 없음. 'AI' 라고 부르지 않는다.
 *  - 원본의 사내 접근 코드·PWA 설치 부분은 옮기지 않는다 — 우리 OS 는 로그인이 따로 있다.
 *
 * 화면은 여기 정의(입력 칸 목록 + compute)를 읽어 한 부품이 9종을 그린다.
 */

/* ------------------------------------------------------------------ */
/* 형식 — 원본의 won()/pct() 그대로                                     */
/* ------------------------------------------------------------------ */

export function won(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-'
  const sign = n < 0 ? '-' : ''
  const r = Math.round(Math.abs(n))
  return sign + r.toLocaleString('ko-KR') + '원'
}

export function pct(n: number | null | undefined, d?: number): string {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return (n * 100).toFixed(d === undefined ? 1 : d) + '%'
}

export function cleanNum(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

/* ------------------------------------------------------------------ */
/* 정의 모양                                                             */
/* ------------------------------------------------------------------ */

export type FieldType = 'amount' | 'number' | 'select' | 'date' | 'text'

export interface Field {
  id: string
  label: string
  type: FieldType
  default: string
  options?: string[]
  hint?: string
  step?: string
  min?: number
  max?: number
}

export interface RowsColumn {
  key: string
  label: string
  type: 'text' | 'amount' | 'number' | 'select'
  options?: string[]
  /** 글자만 보여 주고 고치지 못하게 (주주 A~J 이름) */
  readonly?: boolean
}

export interface RowsField {
  kind: 'rows'
  id: string
  label: string
  columns: RowsColumn[]
  defaults: Record<string, string>[]
  /** '+ 주주 추가' 를 둘지 */
  addable?: boolean
  newRow?: Record<string, string>
}

export type AnyField = Field | RowsField
export type RowValues = Record<string, string>
export type Values = Record<string, string | RowValues[]>

export interface FieldGroup {
  title: string
  fields: AnyField[]
}

export interface Line {
  k: string
  v: string
  cls?: 'big' | 'highlight' | 'divider'
}

export interface Block {
  /** 원본 결과 칸의 id — 대조 시험이 이 id 로 짝을 맞춘다 */
  id: string
  title: string
  lines: Line[]
  /** 진한 배경(원본 .results) 인지 흰 카드인지 */
  tone?: 'dark' | 'light'
}

export interface TableOut {
  id: string
  title: string
  head: string[]
  rows: { cells: string[]; best?: boolean }[]
  note?: string
}

export interface Output {
  blocks: Block[]
  tables?: TableOut[]
  /** 입력 칸 아래 참고 문구 (원본 v_auto_hint 같은 것) */
  hint?: string
}

export interface Sub {
  key: string
  label: string
  groups: FieldGroup[]
  compute: (v: Values) => Output
  note?: string
}

export interface Calculator {
  key: string
  no: string
  title: string
  eyebrow: string
  desc: string
  /** 소탭 위에 공통으로 두는 입력 (특정법인 주주현황) */
  shared?: FieldGroup[]
  subs: Sub[]
  note?: string
}

export function isRowsField(f: AnyField): f is RowsField {
  return (f as RowsField).kind === 'rows'
}

/** 정의의 기본값으로 값 묶음을 만든다 */
export function defaultValues(calc: Calculator): Values {
  const out: Values = {}
  const put = (f: AnyField) => {
    if (isRowsField(f)) out[f.id] = f.defaults.map((r) => ({ ...r }))
    else out[f.id] = f.default
  }
  for (const g of calc.shared ?? []) g.fields.forEach(put)
  for (const s of calc.subs) for (const g of s.groups) g.fields.forEach(put)
  return out
}

function mk(v: Values) {
  const num = (id: string) => cleanNum(typeof v[id] === 'string' ? v[id] : '')
  const str = (id: string) => (typeof v[id] === 'string' ? (v[id] as string) : '')
  const rows = (id: string) => (Array.isArray(v[id]) ? (v[id] as RowValues[]) : [])
  return { num, str, rows }
}

const L = (k: string, v: string, cls?: Line['cls']): Line => ({ k, v, cls })
const DIV = (k: string): Line => ({ k, v: '', cls: 'divider' })

const A = (id: string, label: string, def: string, hint?: string): Field => ({ id, label, type: 'amount', default: def, hint })
const N = (id: string, label: string, def: string, opts: Partial<Field> = {}): Field => ({ id, label, type: 'number', default: def, ...opts })
const S = (id: string, label: string, options: string[], def: string): Field => ({ id, label, type: 'select', default: def, options })
const D = (id: string, label: string, def: string): Field => ({ id, label, type: 'date', default: def })
const T = (id: string, label: string, def: string): Field => ({ id, label, type: 'text', default: def })

/* ------------------------------------------------------------------ */
/* 1. 가지급금 손실계산기                                                */
/* ------------------------------------------------------------------ */

function calc1(v: Values): Output {
  const { num, str } = mk(v)
  const principal = num('g_principal')
  const rate = num('g_rate') / 100
  const corp = num('g_corp') / 100
  const inc = num('g_inc') / 100
  const ins = num('g_ins') / 100
  const hasDebt = str('g_debt') === '있음'
  const borrow = num('g_borrow') / 100
  const years = Math.max(1, Math.min(10, Math.round(num('g_years'))))

  const rows: { y: number; principal: number; interest: number; corpTax: number; incTax: number; insBurden: number; nonDeduct: number; annual: number; cum: number }[] = []
  let cum = 0
  for (let y = 1; y <= 10; y++) {
    const interest = principal * rate
    const corpTax = interest * corp
    const incTax = interest * inc
    const insBurden = interest * ins
    const nonDeduct = hasDebt ? principal * borrow * corp : 0
    const annual = corpTax + incTax + insBurden + nonDeduct
    cum += annual
    rows.push({ y, principal, interest, corpTax, incTax, insBurden, nonDeduct, annual, cum })
  }
  const year1Loss = rows[0].annual
  const periodLoss = rows[years - 1].cum
  const tenYearLoss = rows[9].cum

  return {
    blocks: [
      {
        id: 'g_out',
        title: '결과 요약',
        tone: 'dark',
        lines: [
          L('연간 손실액 (1년차 기준)', won(year1Loss)),
          L(`분석기간(${years}년) 누적손실`, won(periodLoss), 'highlight'),
          L('10년 방치 시 누적손실', won(tenYearLoss), 'big'),
          L('10년 누적손실 / 원금 비율', pct(tenYearLoss / principal)),
        ],
      },
    ],
    tables: [
      {
        id: 'g_table',
        title: '연도별 손실 계산표',
        head: ['연차', '가지급금 잔액', '인정이자', '법인세추가부담', '대표이사 소득세', '4대보험 추가', '지급이자 손금불산입', '연간손실합계', '누적손실'],
        rows: rows.map((r) => ({
          best: r.y === years,
          cells: [String(r.y), won(r.principal), won(r.interest), won(r.corpTax), won(r.incTax), won(r.insBurden), won(r.nonDeduct), won(r.annual), won(r.cum)],
        })),
        note: '※ 가지급금 원금은 상환되지 않는다고 가정하며(잔액 고정), 매년 동일한 인정이자율을 적용해 인정이자를 계산합니다. 인정이자가 다시 가지급금에 가산되는 경우(복리)에는 손실 규모가 본 표보다 더 커질 수 있습니다. 본 계산기는 상담·교육용 참고자료입니다.',
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 2. 대표이사 급여 최적화                                               */
/* ------------------------------------------------------------------ */

const S_RATE = {
  natPension: 0.0475,
  natPensionCap: 6590000,
  health: 0.03595,
  ltc: 0.1314,
  local: 0.1,
  basicDeduct: 1500000,
  stdCredit: 130000,
  earnedCap: 20000000,
  corpLow: 0.11,
  corpHigh: 0.22,
}

export function earnedIncomeDeduction(annual: number): number {
  let ded: number
  if (annual <= 5000000) ded = annual * 0.7
  else if (annual <= 15000000) ded = 3500000 + (annual - 5000000) * 0.4
  else if (annual <= 45000000) ded = 7500000 + (annual - 15000000) * 0.15
  else if (annual <= 100000000) ded = 12000000 + (annual - 45000000) * 0.05
  else ded = 14750000 + (annual - 100000000) * 0.02
  return Math.min(ded, S_RATE.earnedCap)
}

export function salaryBracketTax(base: number): number {
  if (base <= 14000000) return base * 0.06
  if (base <= 50000000) return base * 0.15 - 1260000
  if (base <= 88000000) return base * 0.24 - 5760000
  if (base <= 150000000) return base * 0.35 - 15440000
  if (base <= 300000000) return base * 0.38 - 19940000
  if (base <= 500000000) return base * 0.4 - 25940000
  if (base <= 1000000000) return base * 0.42 - 35940000
  return base * 0.45 - 65940000
}

function earnedTaxCreditLimit(annual: number): number {
  if (annual <= 33000000) return 740000
  if (annual <= 70000000) return Math.max(740000 - (annual - 33000000) * 0.008, 660000)
  if (annual <= 120000000) return Math.max(660000 - (annual - 70000000) * 0.5, 500000)
  return Math.max(500000 - (annual - 120000000) * 0.5, 200000)
}

export function computeSalary(monthly: number) {
  const annual = monthly * 12
  const pension = Math.round(Math.min(monthly, S_RATE.natPensionCap) * S_RATE.natPension) * 12
  const health = Math.round(monthly * S_RATE.health) * 12
  const ltc = Math.round(Math.round(monthly * S_RATE.health) * S_RATE.ltc) * 12
  const insTotal = pension + health + ltc
  const earnedDed = earnedIncomeDeduction(annual)
  const totalDed = earnedDed + S_RATE.basicDeduct + insTotal
  const base = Math.max(annual - totalDed, 0)
  const grossTax = Math.round(Math.max(salaryBracketTax(base), 0))
  let credit = grossTax <= 1300000 ? grossTax * 0.55 : 715000 + (grossTax - 1300000) * 0.3
  credit = Math.min(credit, earnedTaxCreditLimit(annual))
  const finalTax = Math.max(grossTax - credit - S_RATE.stdCredit, 0)
  const localTax = Math.round(finalTax * S_RATE.local)
  const personalTotal = finalTax + localTax + insTotal
  const corpSaveLow = Math.round(annual * S_RATE.corpLow)
  const corpSaveHigh = Math.round(annual * S_RATE.corpHigh)
  const netOutLow = personalTotal - corpSaveLow
  const netOutHigh = personalTotal - corpSaveHigh
  return {
    annual, pension, health, ltc, insTotal, earnedDed, totalDed, base, grossTax, credit, finalTax, localTax, personalTotal,
    corpSaveLow, corpSaveHigh, netOutLow, netOutHigh, afterTax: annual - personalTotal, effRate: personalTotal / annual,
  }
}

function calc2(v: Values): Output {
  const { num } = mk(v)
  const monthly = num('s_monthly')
  const r = computeSalary(monthly)
  const rows: { m: number; r: ReturnType<typeof computeSalary> }[] = []
  for (let m = 1000000; m <= 20000000; m += 1000000) rows.push({ m, r: computeSalary(m) })
  let minLow = rows[0]
  let minHigh = rows[0]
  rows.forEach((row) => {
    if (row.r.netOutLow < minLow.r.netOutLow) minLow = row
    if (row.r.netOutHigh < minHigh.r.netOutHigh) minHigh = row
  })
  return {
    blocks: [
      {
        id: 's_personal',
        title: '개인 부담 계산',
        tone: 'light',
        lines: [
          L('연간 총급여', won(r.annual)),
          L('국민연금(연)', won(r.pension)),
          L('건강보험(연)', won(r.health)),
          L('장기요양(연)', won(r.ltc)),
          L('4대보험 합계', won(r.insTotal)),
          L('근로소득공제', won(r.earnedDed)),
          L('과세표준', won(r.base)),
          L('산출세액', won(r.grossTax)),
          L('근로소득세액공제', won(r.credit)),
          L('결정세액(소득세)', won(r.finalTax)),
          L('지방소득세', won(r.localTax)),
          L('개인 부담 총액', won(r.personalTotal), 'highlight'),
        ],
      },
      {
        id: 's_corp',
        title: '법인세 절감 & 순유출 비교',
        tone: 'dark',
        lines: [
          DIV('과표 2억 이하 법인 (11%)'),
          L('법인세 절감액', won(r.corpSaveLow)),
          L('실질 순유출액', won(r.netOutLow), 'big'),
          DIV('과표 2억 초과 법인 (22%)'),
          L('법인세 절감액', won(r.corpSaveHigh)),
          L('실질 순유출액', won(r.netOutHigh), 'big'),
          DIV('법인세율 무관'),
          L('세후 실수령액', won(r.afterTax)),
          L('개인 실효부담률', pct(r.effRate)),
        ],
      },
    ],
    tables: [
      {
        id: 's_table',
        title: '월 급여별 순유출 시뮬레이션 (100만원~2,000만원)',
        head: ['월급여', '연간총급여', '4대보험계', '결정세액', '개인부담총액', '순유출액(11%)', '순유출액(22%)', '세후실수령액', '실효부담률'],
        rows: rows.map((row) => ({
          best: row.m === minLow.m || row.m === minHigh.m,
          cells: [won(row.m), won(row.r.annual), won(row.r.insTotal), won(row.r.finalTax), won(row.r.personalTotal), won(row.r.netOutLow), won(row.r.netOutHigh), won(row.r.afterTax), pct(row.r.effRate)],
        })),
        note: '노란색으로 표시된 행이 각 법인세율 구간에서 실질 순유출액이 가장 낮은(최적) 월 급여입니다. 대표이사는 고용·산재보험 적용 제외를 가정합니다.',
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 3. 비상장주식 가치평가                                                */
/* ------------------------------------------------------------------ */

function calc3(v: Values): Output {
  const { num, str } = mk(v)
  const shares = num('v_shares')
  const rate = num('v_rate') / 100
  const asset = num('v_asset')
  const debt = num('v_debt')
  const reBook = num('v_re_book')
  const reFair = num('v_re_fair')
  const severance = num('v_severance')
  const goodwill = num('v_goodwill')

  const netAssetBook = asset - debt
  const reDiff = reFair - reBook
  const netAssetValue = netAssetBook + reDiff - severance + goodwill
  const perShareNetAsset = shares > 0 ? netAssetValue / shares : 0
  const reRatio = asset + reFair - reBook > 0 ? reFair / (asset + reFair - reBook) : 0

  const inc = [num('v_inc0'), num('v_inc1'), num('v_inc2')]
  const mon = [num('v_month0'), num('v_month1'), num('v_month2')]
  const cap = [num('v_cap0'), num('v_cap1'), num('v_cap2')]
  const adj = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    let a = (cap[k] * rate * mon[k]) / 12
    for (let j = k + 1; j < 3; j++) a += cap[j] * rate
    adj[k] = a
  }
  const netIncome = [inc[0] + adj[0], inc[1] + adj[1], inc[2] + adj[2]]
  const perShareIncome = netIncome.map((x) => (shares > 0 ? x / shares : 0))
  const weights = [1, 2, 3]
  const weightedAvg = (perShareIncome[0] * weights[0] + perShareIncome[1] * weights[1] + perShareIncome[2] * weights[2]) / 6
  const perShareIncomeValue = rate > 0 ? weightedAvg / rate : 0

  const specialCorp = reRatio >= 0.8
  const realEstateHeavy = !specialCorp && reRatio >= 0.5 && reRatio < 0.8
  const autoType = specialCorp ? '특수법인' : realEstateHeavy ? '부동산과다보유법인' : '일반법인'
  const hint = `참고 자동판정 결과: ${autoType} (부동산비율 ${pct(reRatio)} 기준, 실제 반영값은 아래 직접 선택입니다)`

  const corpType = str('v_type')
  const wNetAsset = corpType === '특수법인' ? 1 : corpType === '부동산과다보유법인' ? 0.6 : 0.4
  const wIncome = 1 - wNetAsset

  const weightedValue = perShareNetAsset * wNetAsset + perShareIncomeValue * wIncome
  const minFloor = perShareNetAsset * 0.8
  const finalPerShare = Math.max(weightedValue, minFloor)
  const totalValue = finalPerShare * shares
  const priceRatio = netAssetValue !== 0 ? totalValue / netAssetValue : 0

  return {
    hint,
    blocks: [
      {
        id: 'v_out',
        title: '평가 결과',
        tone: 'dark',
        lines: [
          L('순자산가액', won(netAssetValue)),
          L('1주당 순자산가치', won(perShareNetAsset)),
          L('1주당 순손익가치', won(perShareIncomeValue)),
          L('법인구분 (반영값)', corpType),
          L('가중치 (순자산/순손익)', `${pct(wNetAsset, 0)} / ${pct(wIncome, 0)}`),
          L('A. 가중평균액', won(weightedValue)),
          L('B. 최저시가기준 (순자산×80%)', won(minFloor)),
          L('1주당 평가액 (Max A,B)', won(finalPerShare), 'big'),
          L('기업가치 평가액', won(totalValue), 'highlight'),
          L('순자산대비 주가비율', pct(priceRatio)),
        ],
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 4. 상속세                                                             */
/* ------------------------------------------------------------------ */

export function inheritGiftTax(base: number): number {
  if (base <= 100000000) return base * 0.1
  if (base <= 500000000) return base * 0.2 - 10000000
  if (base <= 1000000000) return base * 0.3 - 60000000
  if (base <= 3000000000) return base * 0.4 - 160000000
  return base * 0.5 - 460000000
}

function calc4core(v: Values) {
  const { num, str } = mk(v)
  const re = num('h_re'), fin = num('h_fin'), etc = num('h_etc'), gift = num('h_gift'), exempt = num('h_exempt')
  const due = num('h_due'), funeral = num('h_funeral'), debt = num('h_debt')
  const funeralCapped = Math.min(Math.max(funeral, 5000000), 15000000)
  const taxBase0 = re + fin + etc + gift - exempt - (due + funeralCapped + debt)

  const spouseAlive = str('h_spouse') === '예'
  const children = num('h_children'), minor = num('h_minor'), minorYr = num('h_minor_yr')
  const old = num('h_old'), disabled = num('h_disabled'), disabledYr = num('h_disabled_yr')

  const basicDed = 200000000
  const childDed = children * 50000000
  const minorDed = minor * 10000000 * minorYr
  const oldDed = old * 50000000
  const disabledDed = disabled * 10000000 * disabledYr
  const personalSum = basicDed + childDed + minorDed + oldDed + disabledDed
  const lumpDed = Math.max(500000000, personalSum)

  const spouseActual = num('h_spouse_actual'), spouseLegal = num('h_spouse_legal')
  const spouseDed = !spouseAlive ? 0 : Math.min(Math.max(Math.min(spouseActual, spouseLegal), 500000000), 3000000000)

  const netFin = fin
  const finDed = netFin <= 20000000 ? netFin : Math.min(Math.max(netFin * 0.2, 20000000), 200000000)

  const houseOk = str('h_house_ok') === '예'
  const houseVal = num('h_house_val')
  const houseDed = houseOk ? Math.min(houseVal, 600000000) : 0

  const totalDed = lumpDed + spouseDed + finDed + houseDed
  const taxBase = Math.max(taxBase0 - totalDed, 0)
  const grossTax = inheritGiftTax(taxBase)

  const skip = str('h_skip')
  const skipRate = skip === '할증30%' ? 0.3 : skip === '할증40%(미성년20억초과)' ? 0.4 : 0
  const skipTax = grossTax * skipRate

  const giftCredit = num('h_gift_credit')
  const subtotal = grossTax + skipTax - giftCredit
  const reportCredit = subtotal * 0.03
  const finalTax = Math.max(subtotal - reportCredit, 0)
  return { re, fin, etc, taxBase0, lumpDed, spouseDed, finDed, houseDed, totalDed, taxBase, grossTax, skipTax, reportCredit, finalTax }
}

function calc4(v: Values): Output {
  const r = calc4core(v)
  return {
    blocks: [
      {
        id: 'h_out',
        title: '상속세 계산 결과',
        tone: 'dark',
        lines: [
          L('상속세 과세가액', won(r.taxBase0)),
          L('일괄공제(기초+인적 vs 5억)', won(r.lumpDed)),
          L('배우자상속공제', won(r.spouseDed)),
          L('금융재산상속공제', won(r.finDed)),
          L('동거주택상속공제', won(r.houseDed)),
          L('상속공제 합계', won(r.totalDed)),
          L('상속세 과세표준', won(r.taxBase)),
          L('산출세액', won(r.grossTax)),
          L('세대생략 할증세액', won(r.skipTax)),
          L('신고세액공제(3%)', won(r.reportCredit)),
          L('납부할 상속세', won(r.finalTax), 'big'),
        ],
      },
    ],
  }
}

function calc4b(v: Values): Output {
  const r = calc4core(v)
  const { rows } = mk(v)
  const total = r.re + r.fin + r.etc
  const tax = r.finalTax
  let sumRatio = 0
  const data = rows('h2_rows').map((tr) => {
    const ratio = cleanNum(tr.ratio) / 100 || 0
    sumRatio += ratio
    return { name: tr.name ?? '', rel: tr.rel ?? '', ratio }
  })
  const lines: Line[] = [L('총 상속재산가액', won(total)), L('납부할 상속세', won(tax)), L('지분율 합계', pct(sumRatio)), DIV('상속인별 배분')]
  let sumAsset = 0
  let sumTax = 0
  data.forEach((d) => {
    const asset = d.ratio * total
    const t = d.ratio * tax
    sumAsset += asset
    sumTax += t
    lines.push(L(`${d.name} (${d.rel})`, `${won(asset)} / 세액 ${won(t)}`))
  })
  lines.push(L('합계', `${won(sumAsset)} / ${won(sumTax)}`, 'highlight'))
  return { blocks: [{ id: 'h2_out', title: '상속인별 실제 재산가액 및 부담세액', tone: 'dark', lines }] }
}

/* ------------------------------------------------------------------ */
/* 5. 주식양수도 · 증여세                                                */
/* ------------------------------------------------------------------ */

function calc5j(v: Values): Output {
  const { num, str } = mk(v)
  const fair = num('j_fair'), cost = num('j_cost'), qty = num('j_qty'), price = num('j_price')
  const rel = str('j_rel')
  const major = str('j_major')
  const fairTotal = fair * qty
  const costTotal = cost * qty
  const threshold = rel === '상증세법상 특수관계인' ? Math.min(fairTotal * 0.3, 300000000) : 300000000
  const lowBound = fairTotal - threshold
  const highBound = fairTotal + threshold
  let judge = '정상거래'
  if (price < lowBound) judge = '저가거래'
  else if (price > highBound) judge = '고가거래'
  const gain = price - costTotal
  let capGainTax = 0
  if (gain > 0) {
    if (major === '대주주') capGainTax = gain <= 300000000 ? gain * 0.2 : 300000000 * 0.2 + (gain - 300000000) * 0.25
    else capGainTax = gain * 0.1
  }
  const secTaxBase = judge === '정상거래' ? price : fairTotal
  const secTax = secTaxBase * 0.0035
  const lowGift = judge === '저가거래' ? fairTotal - price - threshold : 0
  const highGift = judge === '고가거래' ? price - fairTotal - threshold : 0
  const wrongfulThreshold = Math.min(fairTotal * 0.05, 300000000)
  const wrongful = Math.abs(fairTotal - price) >= wrongfulThreshold ? '해당 (시가로 재계산 과세)' : '해당없음'
  return {
    blocks: [
      {
        id: 'j_out',
        title: '계산 결과',
        tone: 'dark',
        lines: [
          L('양도주식 가액(시가총액)', won(fairTotal)),
          L('취득가액', won(costTotal)),
          L('이익증여 판정 기준금액', won(threshold)),
          L('정상거래가 범위', `${won(lowBound)} ~ ${won(highBound)}`),
          L('거래가 판정', judge, 'highlight'),
          L('양도차익(과세표준)', won(gain)),
          L('양도세', won(capGainTax)),
          L('증권거래세', won(secTax)),
          L('저가거래 이익증여(양수자)', won(lowGift)),
          L('고가거래 이익증여(양도자)', won(highGift)),
          L('소득세법 부당행위계산 판정', wrongful),
        ],
      },
    ],
  }
}

export function giftDeduction(rel: string): number {
  if (rel === '배우자') return 600000000
  if (rel === '직계존속(성년)') return 50000000
  if (rel === '직계존속(미성년)') return 20000000
  if (rel === '직계비속') return 50000000
  if (rel === '기타친족') return 10000000
  return 0
}

function calc5k(v: Values): Output {
  const { num, str } = mk(v)
  const one = (i: '1' | '2') => {
    const fair = num('k_fair' + i), qty = num('k_qty' + i), prior = num('k_prior' + i), rel = str('k_rel' + i)
    const giftValue = fair * qty
    const total = giftValue + prior
    const ded = giftDeduction(rel)
    const base = Math.max(total - ded, 0)
    const grossTax = inheritGiftTax(base)
    const priorBase = Math.max(prior - ded, 0)
    const priorTax = inheritGiftTax(priorBase)
    const finalTax = grossTax - priorTax
    return { total, ded, base, grossTax, priorTax, finalTax }
  }
  const k1 = one('1')
  const k2 = one('2')
  const part = (title: string, k: ReturnType<typeof one>): Line[] => [
    DIV(title),
    L('증여재산가액', won(k.total)),
    L('증여공제', won(k.ded)),
    L('과세표준', won(k.base)),
    L('산출증여세', won(k.grossTax)),
    L('기납부증여세공제', won(k.priorTax)),
    L('납부할 증여세', won(k.finalTax), 'big'),
  ]
  return { blocks: [{ id: 'k_out', title: '증여세 계산 결과', tone: 'dark', lines: [...part('예시1', k1), ...part('예시2', k2)] }] }
}

/* ------------------------------------------------------------------ */
/* 6. 퇴직급여                                                           */
/* ------------------------------------------------------------------ */

export function oldBracketTax(base: number): number {
  if (base <= 12000000) return base * 0.06
  if (base <= 46000000) return base * 0.15 - 1080000
  if (base <= 88000000) return base * 0.24 - 5220000
  if (base <= 150000000) return base * 0.35 - 14900000
  if (base <= 300000000) return base * 0.38 - 19400000
  if (base <= 500000000) return base * 0.4 - 25400000
  if (base <= 1000000000) return base * 0.42 - 35400000
  return base * 0.45 - 65400000
}

function calc6p1(v: Values): Output {
  const { num } = mk(v)
  const pay = num('q_pay'), basic = num('q_basic'), credit = num('q_credit'), health = num('q_health')
  const earnedDed = earnedIncomeDeduction(pay)
  const base = pay - earnedDed - basic
  const grossTax = Math.max(oldBracketTax(base), 0)
  const finalTax = grossTax - credit
  const localTax = finalTax * 0.1
  const payTax = finalTax + localTax
  const burden = payTax + health
  const burdenRate = burden / pay

  const corpBase = num('q_corptax_base')
  const corpGross = Math.min(corpBase, 200000000) * 0.1 + Math.max(corpBase - 200000000, 0) * 0.2
  const sme = num('q_sme') / 100
  const smeAmt = corpGross * sme
  const mintax = num('q_mintax')
  const afterMin = corpGross - smeAmt - mintax
  const rnd = num('q_rnd')
  const corpFinal = afterMin - rnd
  const localCorp = Math.min(corpBase, 200000000) * 0.01 + Math.max(corpBase - 200000000, 0) * 0.02
  const corpPay = corpFinal + localCorp
  const corpRate = corpPay / corpBase
  return {
    blocks: [
      {
        id: 'q_out',
        title: '개인 부담 vs 법인 부담',
        tone: 'dark',
        lines: [
          DIV('대표 개인 부담'),
          L('근로소득공제', won(earnedDed)),
          L('과세표준', won(base)),
          L('산출세액', won(grossTax)),
          L('납부소득세(지방세포함)', won(payTax)),
          L('담세액 계(소득세+건보료)', won(burden), 'highlight'),
          L('부담률', pct(burdenRate)),
          DIV('법인 부담'),
          L('법인세 산출세액', won(corpGross)),
          L('중소기업특별세액감면액', won(smeAmt)),
          L('납부법인세', won(corpPay), 'highlight'),
          L('부담률(납부법인세/과표)', pct(corpRate)),
        ],
      },
    ],
  }
}

function calc6p2(v: Values): Output {
  const { num, str } = mk(v)
  const start = new Date(str('r_start'))
  const end = new Date(str('r_end'))
  const multPre = num('r_mult_pre')
  const multPost = num('r_mult_post')
  const avg1 = num('r_avg1'), avg2 = num('r_avg2'), avg3 = num('r_avg3')

  const cutoff = new Date(2019, 11, 31)
  let monthsC = (2019 - start.getFullYear()) * 12 + (12 - (start.getMonth() + 1)) + 1
  if (start > cutoff) monthsC = 0
  let monthsD = (end.getFullYear() - 2020) * 12 + (end.getMonth() + 1 - 1) + 1
  if (end < new Date(2020, 0, 1)) monthsD = 0
  const totalMonths = monthsC + monthsD

  const capC = Math.min(multPre, 3)
  const capD = Math.min(multPost, 2)
  const amountC = avg1 * 0.1 * (monthsC / 12) * capC
  const amountD = avg2 * 0.1 * (monthsD / 12) * capD
  const totalStatute = amountC + amountD
  const noRuleLimit = avg3 * 0.1 * (totalMonths / 12)
  return {
    blocks: [
      {
        id: 'r_out',
        title: '퇴직소득 한도 계산',
        tone: 'dark',
        lines: [
          L('근속월수 (~2019.12.31)', totalMonths + '개월 중 ' + monthsC + '개월'),
          L('근속월수 (2020.1.1~)', monthsD + '개월'),
          L('2019년까지분 퇴직소득금액', won(amountC)),
          L('2020년이후분 퇴직소득금액', won(amountD)),
          L('정관 규정 있을 시 퇴직소득한도', won(totalStatute), 'big'),
          L('정관 규정 없을 시 퇴직소득한도', won(noRuleLimit), 'highlight'),
        ],
      },
    ],
  }
}

function calc6p3(v: Values): Output {
  const { num, str } = mk(v)
  const start = new Date(str('t_start'))
  const end = new Date(str('t_end'))
  const amount = num('t_amount')
  const years = Math.ceil(((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())) / 12)
  let serviceDed: number
  if (years <= 5) serviceDed = years * 1000000
  else if (years <= 10) serviceDed = (years - 5) * 2000000 + 5000000
  else if (years <= 20) serviceDed = (years - 10) * 2500000 + 15000000
  else serviceDed = (years - 20) * 3000000 + 40000000

  const afterService = amount - serviceDed
  const converted = years > 0 ? (afterService * 12) / years : 0
  let convDed: number
  if (converted < 8000000) convDed = converted
  else if (converted < 70000000) convDed = (converted - 8000000) * 0.6 + 8000000
  else if (converted < 100000000) convDed = (converted - 70000000) * 0.55 + 45200000
  else if (converted < 300000000) convDed = (converted - 100000000) * 0.45 + 61700000
  else convDed = (converted - 300000000) * 0.35 + 151700000

  const base = converted - convDed
  const convTax = Math.max(oldBracketTax(base), 0)
  const retireTax = Math.floor((convTax * years) / 12 / 10) * 10
  const localTax = Math.floor((retireTax * 0.1) / 10) * 10
  const totalTax = retireTax + localTax
  const effRate = amount > 0 ? totalTax / amount : 0
  return {
    blocks: [
      {
        id: 't_out',
        title: '퇴직소득세 계산 결과',
        tone: 'dark',
        lines: [
          L('근속연수', years + '년'),
          L('근속공제', won(serviceDed)),
          L('근속공제 후 산출액', won(afterService)),
          L('환산급여액', won(converted)),
          L('환산급여 차등공제', won(convDed)),
          L('퇴직소득 과세표준', won(base)),
          L('환산산출세액', won(convTax)),
          L('퇴직소득세액', won(retireTax)),
          L('지방소득세', won(localTax)),
          L('납부 세액', won(totalTax), 'big'),
          L('실세율', pct(effRate)),
        ],
      },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 7. 특정법인 증여의제                                                  */
/* ------------------------------------------------------------------ */

export function corpTaxNational(x: number): number {
  if (x <= 200000000) return x * 0.09
  if (x <= 20000000000) return x * 0.19 - 20000000
  if (x <= 300000000000) return x * 0.21 - 420000000
  return x * 0.24 - 9420000000
}

export function corpTaxLocal(x: number): number {
  if (x <= 200000000) return x * 0.1
  if (x <= 20000000000) return x * 0.2 - 20000000
  if (x <= 300000000000) return x * 0.22 - 420000000
  return x * 0.25 - 9420000000
}

function solveLimit(fn: (x: number) => number, target: number, lo: number, hi: number): number {
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (fn(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function shareholdersOf(v: Values) {
  const { rows } = mk(v)
  const list = rows('w_share_rows')
  const names = list.map((r) => r.name ?? '')
  const cats = list.map((r) => r.cat ?? '')
  const qtys = list.map((r) => cleanNum(r.qty) || 0)
  const total = qtys.reduce((a, b) => a + b, 0)
  const ratios = qtys.map((q) => (total > 0 ? q / total : 0))
  return { names, cats, qtys, ratios, maxRatio: Math.max(...ratios), total }
}

function judgeTable(id: string, title: string, sh: ReturnType<typeof shareholdersOf>, unitGiftAmount: number): TableOut {
  const rows: TableOut['rows'] = []
  sh.names.forEach((n, i) => {
    if (sh.ratios[i] <= 0) return
    const gift = unitGiftAmount * sh.ratios[i]
    const taxed = gift >= 100000000
    rows.push({ best: taxed, cells: [n, sh.cats[i] || '-', pct(sh.ratios[i]), won(gift), taxed ? 'O 과세' : 'X 비과세'] })
  })
  return { id, title, head: ['주주', '구분', '지분율', '증여의제이익', '판정'], rows }
}

function shareLines(sh: ReturnType<typeof shareholdersOf>): Line[] {
  const lines: Line[] = []
  sh.names.forEach((n, i) => {
    if (sh.qtys[i] <= 0) return
    lines.push(L(`${n} (${sh.cats[i] || '-'})`, pct(sh.ratios[i])))
  })
  lines.push(L('지배주주(최대주주) 지분율', pct(sh.maxRatio), 'highlight'))
  return lines
}

function calc7w1(v: Values): Output {
  const { num } = mk(v)
  const sh = shareholdersOf(v)
  const principal = num('w1_principal'), rate = num('w1_rate') / 100
  const benefit1 = principal * rate
  const deemGift1 = benefit1 * sh.maxRatio
  return {
    blocks: [
      { id: 'w_share', title: '주주별 지분율', tone: 'light', lines: shareLines(sh) },
      {
        id: 'w1_out',
        title: '판정 결과',
        tone: 'dark',
        lines: [
          L('특정법인의 이익(대여원금×적정이자율)', won(benefit1)),
          L('산출액(이익×지배주주지분율)', won(deemGift1)),
          L('1억원 이상 여부', deemGift1 >= 100000000 ? 'O (과세대상)' : 'X (비과세)', 'highlight'),
          L('과세되지 않는 대여원금 한도', won(rate * sh.maxRatio > 0 ? 100000000 / (rate * sh.maxRatio) : 0)),
        ],
      },
    ],
    tables: [judgeTable('w1_table', '주주별 증여의제 판정', sh, benefit1)],
  }
}

function calc7w2(v: Values): Output {
  const { num } = mk(v)
  const sh = shareholdersOf(v)
  const w2income = num('w2_income'), w2amount = num('w2_amount')
  const w2after = w2income + w2amount
  const w2taxBefore = corpTaxLocal(w2income)
  const w2taxAfter = corpTaxLocal(w2after)
  const w2taxIncrease = w2taxAfter - w2taxBefore
  const w2corpEquiv = w2taxAfter * Math.min(w2amount / w2after, 1)
  const w2net = w2amount - w2corpEquiv
  const w2limit =
    sh.maxRatio > 0
      ? solveLimit(
          (a) => {
            const after = w2income + a
            const tax = corpTaxLocal(after)
            const equiv = tax * Math.min(a / after, 1)
            return (a - equiv) * sh.maxRatio
          },
          100000000,
          0,
          1e13,
        )
      : NaN
  return {
    blocks: [
      { id: 'w_share', title: '주주별 지분율', tone: 'light', lines: shareLines(sh) },
      {
        id: 'w2_out',
        title: '판정 결과',
        tone: 'dark',
        lines: [
          L('채무면제 반영 후 소득금액', won(w2after)),
          L('채무면제 전 법인세 산출세액', won(w2taxBefore)),
          L('채무면제 후 법인세 산출세액', won(w2taxAfter)),
          L('법인세 증가액 (참고)', won(w2taxIncrease)),
          L('법인세상당액', won(w2corpEquiv)),
          L('정산증여액', won(w2net), 'highlight'),
          L('과세되지 않는 채무면제액 한도(지배주주 기준)', won(w2limit)),
        ],
      },
    ],
    tables: [judgeTable('w2_table', '주주별 증여의제 판정', sh, w2net)],
  }
}

function calc7w3(v: Values): Output {
  const { num } = mk(v)
  const sh = shareholdersOf(v)
  const w3income = num('w3_income'), w3amount = num('w3_amount')
  const w3after = w3income + w3amount
  const w3taxBefore = corpTaxLocal(w3income)
  const w3taxAfter = corpTaxLocal(w3after)
  const w3taxIncrease = w3taxAfter - w3taxBefore
  const w3corpEquiv = w3taxAfter * Math.min(w3amount / w3after, 1)
  const w3net = w3amount - w3corpEquiv
  const w3limit =
    sh.maxRatio > 0
      ? solveLimit(
          (a) => {
            const after = w3income + a
            const tax = corpTaxLocal(after)
            const equiv = tax * Math.min(a / after, 1)
            return (a - equiv) * sh.maxRatio
          },
          100000000,
          0,
          1e13,
        )
      : NaN
  return {
    blocks: [
      { id: 'w_share', title: '주주별 지분율', tone: 'light', lines: shareLines(sh) },
      {
        id: 'w3_out',
        title: '판정 결과',
        tone: 'dark',
        lines: [
          L('증여 반영 후 소득금액', won(w3after)),
          L('증여 전 법인세 산출세액', won(w3taxBefore)),
          L('증여 후 법인세 산출세액', won(w3taxAfter)),
          L('법인세 증가액 (참고)', won(w3taxIncrease)),
          L('법인세상당액', won(w3corpEquiv)),
          L('정산증여액', won(w3net), 'highlight'),
          L('과세되지 않는 증여가액 한도(지배주주 기준)', won(w3limit)),
        ],
      },
    ],
    tables: [judgeTable('w3_table', '주주별 증여의제 판정', sh, w3net)],
  }
}

function calc7w4(v: Values): Output {
  const { num } = mk(v)
  const sh = shareholdersOf(v)
  const w4income = num('w4_income'), w4div = num('w4_div'), w4ratio = num('w4_ratio') / 100
  const exemptRate = w4ratio < 0.2 ? 0.3 : w4ratio < 0.5 ? 0.8 : 1
  const exemptAmt = w4div * exemptRate
  const taxableDiv = w4div - exemptAmt
  const afterIncome = w4income + taxableDiv
  const afterTax = corpTaxLocal(afterIncome)
  const excessDiv = w4div * (1 - w4ratio)
  const corpEquiv = afterTax
  const netExcess = excessDiv - corpEquiv
  const w4limit =
    sh.maxRatio > 0
      ? solveLimit(
          (d) => {
            const taxableD = d * (1 - exemptRate)
            const after = w4income + taxableD
            const tax = corpTaxLocal(after)
            const excess = d * (1 - w4ratio)
            const net = excess - tax
            return net * sh.maxRatio
          },
          100000000,
          0,
          1e13,
        )
      : NaN
  return {
    blocks: [
      { id: 'w_share', title: '주주별 지분율', tone: 'light', lines: shareLines(sh) },
      {
        id: 'w4_out',
        title: '판정 결과',
        tone: 'dark',
        lines: [
          L('익금불산입률', pct(exemptRate, 0)),
          L('익금불산입금액', won(exemptAmt)),
          L('배당 반영 후 소득금액', won(afterIncome)),
          L('배당 반영 후 법인세 산출세액', won(afterTax)),
          L('초과배당금액', won(excessDiv)),
          L('정산초과배당액', won(netExcess), 'highlight'),
          L('과세되지 않는 배당금액 한도(지배주주 기준)', won(w4limit)),
        ],
      },
    ],
    tables: [judgeTable('w4_table', '주주별 증여의제 판정', sh, netExcess)],
  }
}

/* ------------------------------------------------------------------ */
/* 8. 불균등 유상증자 · 감자                                              */
/* ------------------------------------------------------------------ */

function giftThreshold(totalQtyValue: number): number {
  return Math.min(300000000, totalQtyValue * 0.3)
}

function readShareRows(v: Values, id: string) {
  const { rows } = mk(v)
  return rows(id).map((r) => ({ name: r.name ?? '', cat: r.cat ?? '개인', qty: cleanNum(r.qty) || 0, extra: cleanNum(r.extra) || 0 }))
}

function calc8x1(v: Values): Output {
  const { num } = mk(v)
  const fair = num('x1_fair'), issue = num('x1_issue')
  const rows = readShareRows(v, 'x1_rows')
  const sumC = rows.reduce((a, r) => a + r.qty, 0)
  const sumH = rows.reduce((a, r) => a + r.extra, 0)
  const N = sumC > 0 || sumH > 0 ? (sumC * fair + sumH * issue) / (sumC + sumH) : 0
  const threshold = giftThreshold(sumC * fair)
  const judge: TableOut['rows'] = []
  rows.forEach((r) => {
    if (r.extra <= 0) return
    const gain = (N - issue) * r.extra
    const corpEquiv = r.cat === '법인' ? corpTaxNational(Math.max(gain, 0)) : 0
    const net = gain - corpEquiv
    const taxed = net >= threshold
    judge.push({ best: taxed, cells: [r.name, r.cat, r.extra.toLocaleString(), won(gain), won(corpEquiv), won(net), taxed ? 'O 과세' : 'X 비과세'] })
  })
  return {
    blocks: [
      {
        id: 'x1_summary',
        title: '증자 후 정상가 및 주주별 이익증여',
        tone: 'dark',
        lines: [
          L('기존주식수 합계', sumC.toLocaleString() + '주'),
          L('증자(실제인수) 주식수 합계', sumH.toLocaleString() + '주'),
          L('증자 후 1주당 정상가', won(N), 'big'),
          L('1주당 이익(정상가-인수가)', won(N - issue)),
        ],
      },
    ],
    tables: [{ id: 'x1_judge', title: '주주별 증여의제 판정', head: ['주주', '구분', '인수주식수', '이익증여금액', '법인세상당액', '정산이익', '판정'], rows: judge }],
  }
}

function calc8x2(v: Values): Output {
  const { num } = mk(v)
  const fair = num('x2_fair'), redeem = num('x2_redeem')
  const rows = readShareRows(v, 'x2_rows')
  const sumC = rows.reduce((a, r) => a + r.qty, 0)
  const sumH = rows.reduce((a, r) => a + r.extra, 0)
  const remain = sumC - sumH
  const N = remain > 0 ? (sumC * fair - sumH * redeem) / remain : 0
  const threshold = giftThreshold(sumC * fair)
  const judge: TableOut['rows'] = []
  rows.forEach((r) => {
    const after = r.qty - r.extra
    const beforeRatio = sumC > 0 ? r.qty / sumC : 0
    const afterRatio = remain > 0 ? after / remain : 0
    if (afterRatio <= beforeRatio || after <= 0) return
    const gain = (N - fair) * after
    const corpEquiv = r.cat === '법인' ? corpTaxNational(Math.max(gain, 0)) : 0
    const net = gain - corpEquiv
    const taxed = net >= threshold
    judge.push({ best: taxed, cells: [r.name, r.cat, after.toLocaleString(), `${pct(beforeRatio)} → ${pct(afterRatio)}`, won(gain), won(corpEquiv), won(net), taxed ? 'O 과세' : 'X 비과세'] })
  })
  return {
    blocks: [
      {
        id: 'x2_summary',
        title: '감자 후 정상가 및 주주별 이익증여',
        tone: 'dark',
        lines: [
          L('기존주식수 합계', sumC.toLocaleString() + '주'),
          L('감자(실제상환) 주식수 합계', sumH.toLocaleString() + '주'),
          L('감자 후 잔여주식수', remain.toLocaleString() + '주'),
          L('감자 후 1주당 정상가', won(N), 'big'),
          L('1주당 가치증가(정상가-감자전가)', won(N - fair)),
        ],
      },
    ],
    tables: [{ id: 'x2_judge', title: '주주별 증여의제 판정', head: ['주주', '구분', '사후보유주식수', '지분율 변동', '이익증여금액', '법인세상당액', '정산이익', '판정'], rows: judge }],
  }
}

/* ------------------------------------------------------------------ */
/* 9. 2026 소득세 (양도·퇴직·종합)                                        */
/* ------------------------------------------------------------------ */

type Bracket = [number, number, number]
function vlookupBracket(x: number, table: Bracket[]): Bracket {
  let r = table[0]
  for (const row of table) {
    if (row[0] <= x) r = row
    else break
  }
  return r
}
const INC9_BRACKETS: Bracket[] = [[0, 0, 0.06], [14000000, 1260000, 0.15], [50000000, 5760000, 0.24], [88000000, 15440000, 0.35], [150000000, 19940000, 0.38], [300000000, 25940000, 0.4], [500000000, 35940000, 0.42], [1000000000, 65940000, 0.45]]
export function incomeTax9(base: number): number {
  const r = vlookupBracket(base, INC9_BRACKETS)
  return base * r[2] - r[1]
}
const EARNED_DED9: Bracket[] = [[0, 0, 0.7], [5000000, 3500000, 0.4], [15000000, 7500000, 0.15], [45000000, 12000000, 0.05], [100000000, 14750000, 0.02]]
function earnedDeduction9(pay: number): number {
  if (pay <= 5000000) return pay * 0.7
  const r = vlookupBracket(pay, EARNED_DED9)
  return r[1] + r[2] * (pay - r[0])
}
const PENSION_DED9: Bracket[] = [[0, 0, 1], [3500000, 3500000, 0.4], [7000000, 4900000, 0.2], [14000000, 6300000, 0.1]]
function pensionDeduction9(p: number): number {
  if (p <= 3500000) return p
  const r = vlookupBracket(p, PENSION_DED9)
  return Math.min(9000000, r[1] + r[2] * (p - r[0]))
}
const SERVICE_DED9: Bracket[] = [[0, 0, 1000000], [5, 5000000, 2000000], [10, 15000000, 2500000], [20, 40000000, 3000000]]
function serviceDeduction9(years: number): number {
  if (years <= 5) return 1000000 * years
  const r = vlookupBracket(years, SERVICE_DED9)
  return r[1] + r[2] * (years - r[0])
}
const CONV_DED9: Bracket[] = [[0, 0, 1], [8000000, 8000000, 0.6], [70000000, 45200000, 0.55], [100000000, 61700000, 0.45], [300000000, 151700000, 0.35]]
function convertedDeduction9(x: number): number {
  if (x <= 8000000) return x
  const r = vlookupBracket(x, CONV_DED9)
  return r[1] + r[2] * (x - r[0])
}
export function yearsRoundUp9(startStr: string, endStr: string): number {
  const start = new Date(startStr), end = new Date(endStr)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0
  const y = end.getFullYear() - start.getFullYear()
  const anniv = new Date(start.getFullYear() + y, start.getMonth(), start.getDate())
  let yy = y
  if (anniv > end) yy--
  const anniv2 = new Date(start.getFullYear() + yy, start.getMonth(), start.getDate())
  if (anniv2.getTime() !== end.getTime()) yy++
  return Math.max(yy, 1)
}

interface Scenario {
  gainAmt: number; total1: number; retireAmt: number; total2: number
  interestAmt: number; dividendAmt: number; businessAmt: number; earnedAmt: number; pensionAmt: number; otherAmt: number
  total3: number; taxSum: number; incomeSum: number; afterTaxAmt: number
  blocks: Block[]
}

function scenario(v: Values, p: string): Scenario {
  const { num, str } = mk(v)
  const qty = num(`${p}_qty`), transferPrice = num(`${p}_transferPrice`), acquirePrice = num(`${p}_acquirePrice`)
  const totalShares = num(`${p}_totalShares`), heldShares = num(`${p}_heldShares`)
  const isSme = str(`${p}_isSme`) === '중소기업'
  const under1yr = str(`${p}_under1yr`) === '1년미만'
  const isMajor = str(`${p}_isMajor`) === '대주주'
  const applyBasicDed = str(`${p}_basicDed`) === '여'

  const ratio = totalShares > 0 ? heldShares / totalShares : 0
  const marketCap = heldShares * transferPrice
  const autoMajor = ratio >= 0.04 || marketCap >= 1000000000 ? '대주주' : '소액주주'

  const transferAmt = qty * transferPrice
  const acquireAmt = qty * acquirePrice
  const secTax = transferAmt * 0.0035
  const gain = transferAmt - acquireAmt - secTax
  const gainAmt = Math.max(gain, 0)
  const basicDed = applyBasicDed ? Math.min(gainAmt, 2500000) : 0
  const taxBase1 = Math.max(gainAmt - basicDed, 0)
  const rate1 = isMajor ? (under1yr && !isSme ? 0.3 : taxBase1 <= 300000000 ? 0.2 : 0.25) : isSme ? 0.1 : 0.2
  const calcTax1 = isMajor && !(under1yr && !isSme) && taxBase1 > 300000000 ? taxBase1 * 0.25 - 15000000 : taxBase1 * rate1
  const localTax1 = calcTax1 * 0.1
  const subtotal1 = calcTax1 + localTax1
  const total1 = subtotal1 + secTax

  const retireAmt = num(`${p}_retireAmt`)
  const years = yearsRoundUp9(str(`${p}_startDate`), str(`${p}_endDate`))
  const svcDed = serviceDeduction9(years)
  const afterDed = Math.max(retireAmt - svcDed, 0)
  const converted = years > 0 ? (afterDed / years) * 12 : 0
  const convDed = convertedDeduction9(converted)
  const taxBase2 = Math.max(converted - convDed, 0)
  const convTax = incomeTax9(taxBase2)
  const calcTax2 = years > 0 ? (convTax / 12) * years : 0
  const localTax2 = calcTax2 * 0.1
  const total2 = calcTax2 + localTax2

  const interest = num(`${p}_interest`), dividend = num(`${p}_dividend`), business = num(`${p}_business`)
  const salary = num(`${p}_salary`), pension = num(`${p}_pension`), other = num(`${p}_other`)
  const personalDed = num(`${p}_personalDed`), otherDed = num(`${p}_otherDed`)
  const specialCredit = num(`${p}_specialCredit`), otherCredit = num(`${p}_otherCredit`)

  const interestAmt = interest
  const finTotal = interest + dividend
  const grossup = Math.max(0, Math.min(finTotal - 20000000, dividend)) * 0.11
  const dividendAmt = dividend + grossup
  const businessAmt = business
  const earnedDed = earnedDeduction9(salary)
  const earnedAmt = Math.max(salary - earnedDed, 0)
  const pensionDed = pensionDeduction9(pension)
  const pensionAmt = Math.max(pension - pensionDed, 0)
  const otherAmt = other
  const totalIncomeAmt = interestAmt + dividendAmt + businessAmt + earnedAmt + pensionAmt + otherAmt

  const compDed = personalDed + otherDed
  const taxBase3 = Math.max(totalIncomeAmt - compDed, 0)
  const taxA = incomeTax9(taxBase3)
  const taxB = Math.min(finTotal, 20000000) * 0.14 + incomeTax9(Math.max(taxBase3 - grossup - Math.min(finTotal, 20000000), 0))
  const calcTax3 = Math.max(taxA, taxB)
  const dividendCredit = calcTax3 === taxA ? Math.min(grossup, Math.max(taxA - taxB, 0)) : 0
  const earnedCreditLimit = salary <= 33000000 ? 740000 : salary <= 70000000 ? Math.max(740000 - (salary - 33000000) * 0.008, 660000) : Math.max(660000 - (salary - 70000000) * 0.5, 500000)
  const earnedAllocTax = totalIncomeAmt === 0 ? 0 : (calcTax3 * earnedAmt) / totalIncomeAmt
  const earnedCredit = Math.min(earnedCreditLimit, earnedAllocTax <= 1300000 ? earnedAllocTax * 0.55 : 715000 + (earnedAllocTax - 1300000) * 0.3)
  const totalCredit = dividendCredit + earnedCredit + specialCredit + otherCredit
  const decidedTax3 = Math.max(calcTax3 - totalCredit, 0)
  const localTax3 = decidedTax3 * 0.1
  const total3 = decidedTax3 + localTax3
  const burdenRate = totalIncomeAmt === 0 ? 0 : total3 / totalIncomeAmt

  const taxSum = total1 + total2 + total3
  const incomeSum = gainAmt + retireAmt + totalIncomeAmt
  const afterTaxAmt = incomeSum - taxSum

  const blocks: Block[] = [
    {
      id: `${p}_out1`, title: '양도소득세 계산 결과', tone: 'dark',
      lines: [
        L('지분율(보유/발행주식총수)', pct(ratio)), L('보유주식 시가총액', won(marketCap)), L('자동판정 참고값', autoMajor),
        L('① 양도가액', won(transferAmt)), L('② 취득가액', won(acquireAmt)), L('③ 증권거래세', won(secTax)), L('④ 양도차익', won(gain)),
        L('⑤ 양도소득금액', won(gainAmt)), L('⑥ 양도소득기본공제', won(basicDed)), L('⑦ 과세표준', won(taxBase1)), L('⑧ 적용세율', pct(rate1)),
        L('⑨ 산출세액', won(calcTax1)), L('⑩ 지방소득세', won(localTax1)), L('⑪ 양도소득세 등 합계', won(subtotal1)), L('⑫ 양도소득세 총부담액', won(total1), 'big'),
      ],
    },
    {
      id: `${p}_out2`, title: '퇴직소득세 계산 결과', tone: 'dark',
      lines: [
        L('① 근속연수(1년미만 절상)', years + '년'), L('② 근속연수공제', won(svcDed)), L('③ 공제후금액', won(afterDed)), L('④ 환산급여', won(converted)),
        L('⑤ 환산급여공제', won(convDed)), L('⑥ 퇴직소득 과세표준', won(taxBase2)), L('⑦ 환산산출세액', won(convTax)),
        L('⑧ 퇴직소득 산출세액(연분연승)', won(calcTax2)), L('⑨ 지방소득세', won(localTax2)), L('⑩ 퇴직소득세 총부담액', won(total2), 'big'),
      ],
    },
    {
      id: `${p}_out3`, title: '종합소득세 계산 결과', tone: 'dark',
      lines: [
        L('금융소득 합계(이자+배당)', won(finTotal)), L('배당가산액(Gross-up)', won(grossup)), L('종합소득금액 합계', won(totalIncomeAmt)),
        L('종합소득공제', won(compDed)), L('종합소득과세표준', won(taxBase3)), L('일반산출세액 ⓐ', won(taxA)), L('비교산출세액 ⓑ(금융소득 분리과세)', won(taxB)),
        L('종합소득산출세액(Max)', won(calcTax3)), L('배당세액공제', won(dividendCredit)), L('근로소득세액공제', won(earnedCredit)), L('세액공제 합계', won(totalCredit)),
        L('종합소득 결정세액', won(decidedTax3)), L('종합소득지방세액', won(localTax3)), L('종합소득세 총부담세액', won(total3), 'big'), L('부담률', pct(burdenRate)),
      ],
    },
    {
      id: `${p}_out4`, title: '④ 세금 합계', tone: 'dark',
      lines: [
        L('양도소득세 총부담액', won(total1)), L('퇴직소득세 총부담액', won(total2)), L('종합소득세 총부담세액', won(total3)),
        L('세금 합계', won(taxSum), 'highlight'), L('소득 합계', won(incomeSum)), L('세후 실수령액', won(afterTaxAmt), 'big'),
      ],
    },
  ]
  return { gainAmt, total1, retireAmt, total2, interestAmt, dividendAmt, businessAmt, earnedAmt, pensionAmt, otherAmt, total3, taxSum, incomeSum, afterTaxAmt, blocks }
}

function calc9(p: 'inc_a' | 'inc_b') {
  return (v: Values): Output => ({ blocks: scenario(v, p).blocks })
}

function calc9cmp(v: Values): Output {
  const a = scenario(v, 'inc_a')
  const b = scenario(v, 'inc_b')
  const savings = a.taxSum - b.taxSum
  const rows: TableOut['rows'] = [
    { cells: ['이자소득', won(a.interestAmt), '', won(b.interestAmt), ''] },
    { cells: ['배당소득', won(a.dividendAmt), '', won(b.dividendAmt), ''] },
    { cells: ['사업소득', won(a.businessAmt), '', won(b.businessAmt), ''] },
    { cells: ['근로소득', won(a.earnedAmt), '', won(b.earnedAmt), ''] },
    { cells: ['연금소득', won(a.pensionAmt), '', won(b.pensionAmt), ''] },
    { cells: ['기타소득', won(a.otherAmt), '', won(b.otherAmt), ''] },
    { cells: ['종합소득세 합계', '', won(a.total3), '', won(b.total3)] },
    { cells: ['양도소득', won(a.gainAmt), won(a.total1), won(b.gainAmt), won(b.total1)] },
    { cells: ['퇴직소득', won(a.retireAmt), won(a.total2), won(b.retireAmt), won(b.total2)] },
  ]
  return {
    blocks: [
      {
        id: 'inc_cmp_out', title: '합계 비교', tone: 'dark',
        lines: [
          L('1안 소득 합계 / 세금 합계', `${won(a.incomeSum)} / ${won(a.taxSum)}`),
          L('2안 소득 합계 / 세금 합계', `${won(b.incomeSum)} / ${won(b.taxSum)}`),
          L('1안 세후금액', won(a.afterTaxAmt)),
          L('2안 세후금액', won(b.afterTaxAmt)),
          L('절세액 (1안 세금합계 - 2안 세금합계)', won(savings), 'big'),
        ],
      },
    ],
    tables: [{ id: 'inc_cmp_table', title: '소득금액 및 세금 비교 (1안 vs 2안)', head: ['소득 구분', '1안 금액', '1안 세금', '2안 금액', '2안 세금'], rows }],
  }
}

function scenarioGroups(p: string, d: Record<string, string>): FieldGroup[] {
  return [
    {
      title: '① 주식 양도소득세 (비상장주식 기준)',
      fields: [
        A(`${p}_qty`, '양도 주식수 (주)', d.qty), A(`${p}_transferPrice`, '1주당 양도가액 (원)', d.transferPrice),
        A(`${p}_acquirePrice`, '1주당 취득가액 (원)', d.acquirePrice), D(`${p}_transferDate`, '양도시기', d.transferDate),
        A(`${p}_totalShares`, '발행주식총수 (주)', d.totalShares), A(`${p}_heldShares`, '보유 주식수 (주)', d.heldShares),
        S(`${p}_isSme`, '중소기업 여부', ['중소기업', '비중소기업'], d.isSme), S(`${p}_under1yr`, '1년 미만 보유 여부', ['1년이상', '1년미만'], d.under1yr),
        S(`${p}_isMajor`, '대주주 여부 (아래 참고값 확인 후 입력)', ['대주주', '소액주주'], d.isMajor), S(`${p}_basicDed`, '양도소득기본공제(250만원) 적용', ['여', '부'], d.basicDed),
      ],
    },
    {
      title: '② 퇴직소득세',
      fields: [A(`${p}_retireAmt`, '퇴직금액 (원)', d.retireAmt), D(`${p}_startDate`, '기산일(입사일)', d.startDate), D(`${p}_endDate`, '중간정산일/퇴직일', d.endDate)],
    },
    {
      title: '③ 종합소득세 (이자·배당·사업·근로·연금·기타)',
      fields: [
        A(`${p}_interest`, '이자소득 총수입금액', d.interest), A(`${p}_dividend`, '배당소득 총수입금액', d.dividend),
        A(`${p}_business`, '사업소득금액(필요경비 차감후)', d.business), A(`${p}_salary`, '총급여액(근로소득)', d.salary),
        A(`${p}_pension`, '총연금액(연금소득)', d.pension), A(`${p}_other`, '기타소득금액(필요경비 차감후)', d.other),
        A(`${p}_personalDed`, '인적공제 합계', d.personalDed), A(`${p}_otherDed`, '그 외 소득공제(국민연금 등)', d.otherDed),
        A(`${p}_specialCredit`, '특별세액공제(보험료·의료비 등)', d.specialCredit), A(`${p}_otherCredit`, '자녀·연금·정치자금 등 세액공제', d.otherCredit),
      ],
    },
  ]
}

const INC9_A = {
  qty: '10000', transferPrice: '10000', acquirePrice: '5000', transferDate: '2026-03-02', totalShares: '100000', heldShares: '30000',
  isSme: '중소기업', under1yr: '1년이상', isMajor: '대주주', basicDed: '부', retireAmt: '100000000', startDate: '2016-01-01', endDate: '2026-03-02',
  interest: '0', dividend: '100000000', business: '0', salary: '60000000', pension: '0', other: '0', personalDed: '1500000', otherDed: '0', specialCredit: '0', otherCredit: '0',
}
const INC9_B = { ...INC9_A, transferPrice: '5000', transferDate: '2025-05-03', startDate: '2010-01-01', endDate: '2020-03-02' }

/* ------------------------------------------------------------------ */
/* 목록 — 원본 사이드바 순서 그대로                                        */
/* ------------------------------------------------------------------ */

const REL_OPTIONS = ['타인', '배우자', '직계존속(성년)', '직계존속(미성년)', '직계비속', '기타친족']

export const TAX_CALCULATORS: Calculator[] = [
  {
    key: 't2', no: '01', title: '대표이사 급여 최적화 계산기', eyebrow: '2026 Executive Compensation',
    desc: '월 급여를 입력하면 개인 세금·4대보험, 법인세 절감, 순유출액이 자동 계산됩니다. (2026년 세율 기준)',
    subs: [{ key: 'main', label: '', groups: [{ title: '월 급여 입력', fields: [A('s_monthly', '월 급여 (원)', '10000000')] }], compute: calc2 }],
  },
  {
    key: 't6', no: '02', title: '퇴직급여 계산', eyebrow: 'Executive Retirement Benefit',
    desc: '임원 적정보수 검토, 임원 퇴직급여 산출액, 퇴직소득세를 계산합니다.',
    subs: [
      {
        key: 'p1', label: '적정보수검토',
        groups: [
          { title: '대표이사 보수', fields: [A('q_pay', '현재보수(상여포함, 연, 원)', '120000000'), A('q_basic', '기본공제(연, 원)', '12000000'), A('q_credit', '세액공제(원)', '1000000'), A('q_health', '건강보험료(연, 원)', '4800000')] },
          { title: '법인 현황', fields: [A('q_corptax_base', '법인세 과세표준(원)', '300000000'), N('q_sme', '중소기업특별세액감면율', '20', { step: '0.1', hint: '%' }), A('q_rnd', 'R&D 등 최저한세적용배제 세액공제', '0'), A('q_mintax', '최저한세적용 세액공제', '0')] },
        ],
        compute: calc6p1,
        note: '세율표는 일반 누진세율 기준입니다(6~45%, 8단계). 정확한 세액은 세무사 등 전문가 확인이 필요합니다.',
      },
      {
        key: 'p2', label: '임원퇴직급여산출액',
        groups: [{ title: '근속·정관 정보', fields: [D('r_start', '기산일(입사일)', '2011-01-01'), D('r_end', '퇴직일', '2021-01-01'), N('r_mult_pre', '소득세법상 지급배수 (~2019.12.31, 최대3배)', '3', { step: '0.1', max: 3 }), N('r_mult_post', '소득세법상 지급배수 (2020.1.1~, 최대2배)', '2', { step: '0.1', max: 2 }), A('r_avg1', '2017~2019년 총급여의 연평균 환산액(원)', '5000000'), A('r_avg2', '퇴직일 소급 3년 총급여의 연평균 환산액(원)', '60000000'), A('r_avg3', '퇴직일 소급 1년 총급여액 (정관 규정 없을 시, 원)', '60000000')] }],
        compute: calc6p2,
        note: '소득세법상 임원 퇴직소득한도: 2019.12.31까지는 3년 연평균환산액×10%×근무월수/12×정관배수(최대3배), 2020.1.1 이후는 최대 2배를 적용합니다.',
      },
      {
        key: 'p3', label: '퇴직소득세',
        groups: [{ title: '퇴직급여 & 근속 정보', fields: [D('t_start', '기산일', '1998-05-25'), D('t_end', '퇴사일', '2022-12-31'), A('t_amount', '퇴직급여액(원)', '1200000000')] }],
        compute: calc6p3,
        note: '소득세율은 퇴사연도 기준 종합소득세 누진세율(8단계, 6~45%)을 적용하였습니다. 실제 세무처리는 전문가 확인이 필요합니다.',
      },
    ],
  },
  {
    key: 't9', no: '03', title: '2026 소득세 계산기 (양도·퇴직·종합)', eyebrow: '2026년 세법 기준',
    desc: '비상장주식 양도소득세, 퇴직소득세, 종합소득세를 한번에 계산하고, 두 가지 방안(1안·2안)의 세부담을 비교합니다.',
    subs: [
      { key: 'inc_a', label: '1안', groups: scenarioGroups('inc_a', INC9_A), compute: calc9('inc_a') },
      { key: 'inc_b', label: '2안', groups: scenarioGroups('inc_b', INC9_B), compute: calc9('inc_b') },
      { key: 'inc_cmp', label: '요약비교', groups: [], compute: calc9cmp, note: '본 자료는 참고용입니다. 특수관계 여부에 따라 증여세가 별도로 발생할 수 있으며, 정확한 세액계산 시 추가 검토가 필요합니다.' },
    ],
    note: '2026년 세법 반영: ① 비상장주식 증권거래세율 0.35% ② 대주주 판정 보유금액 기준 10억원 ③ 종합소득세 기본세율표는 2023년 개정 이후 2026년까지 변경 없음. 본 계산기는 참고용이며 실제 신고는 세무사와 상담하시기 바랍니다.',
  },
  {
    key: 't5', no: '04', title: '주식양수도 · 증여세 비교 계산기', eyebrow: 'Share Transfer & Gift Tax',
    desc: '비상장주식 양수도 거래의 과세판정과 증여세를 계산·비교합니다.',
    subs: [
      {
        key: 'j1', label: '비상장주식 양수도 계산기',
        groups: [{ title: '입력값', fields: [A('j_fair', '1주당 시가(원)', '100000'), A('j_cost', '1주당 취득가(원)', '10000'), A('j_qty', '양도주식 수', '10000'), A('j_price', '실제 양도가액(총 거래가, 원)', '300000000'), S('j_rel', '거래당사자간 관계', ['상증세법상 특수관계인', '특수관계없는자(타인)'], '상증세법상 특수관계인'), S('j_major', '대주주 여부', ['대주주', '대주주 외(소액주주)'], '대주주')] }],
        compute: calc5j,
        note: '상증세법 §35 / 동법시행령 §26 (이익의 증여) · 증권거래세법 §7 · 소득세법 §101 (부당행위계산). 본 자료는 참고용이며 실제 신고 시 전문가와 상담하시기 바랍니다.',
      },
      {
        key: 'j2', label: '증여세 비교 계산기',
        groups: [
          { title: '예시1', fields: [A('k_fair1', '1주당 시가(원)', '120000'), A('k_qty1', '증여주식 수', '1000'), A('k_prior1', '10년 내 기증여액(원)', '100000000'), S('k_rel1', '증여자와의 관계', REL_OPTIONS, '직계존속(미성년)')] },
          { title: '예시2', fields: [A('k_fair2', '1주당 시가(원)', '500000'), A('k_qty2', '증여주식 수', '1000'), A('k_prior2', '10년 내 기증여액(원)', '200000000'), S('k_rel2', '증여자와의 관계', REL_OPTIONS, '직계존속(미성년)')] },
        ],
        compute: calc5k,
        note: '기증여액: 동일인으로부터 10년 이내 증여받은 금액(1천만원 초과분 합산) · 증여세 신고: 증여일이 속하는 달의 말일로부터 3개월 이내 · 주식증여는 취득세 없음.',
      },
    ],
  },
  {
    key: 't7', no: '05', title: '특정법인 증여의제 계산기', eyebrow: '상증세법 §45조의5',
    desc: '특정법인이 지배주주의 특수관계인과 거래하여 이익을 얻는 경우의 증여의제이익을 계산합니다.',
    shared: [
      {
        title: '주주현황 (지배주주 및 특수관계인) — 전 탭에 자동 반영됩니다',
        fields: [
          {
            kind: 'rows', id: 'w_share_rows', label: '주주현황',
            columns: [{ key: 'name', label: '주주', type: 'text', readonly: true }, { key: 'cat', label: '구분', type: 'text' }, { key: 'qty', label: '주식수', type: 'amount' }],
            defaults: [
              { name: 'A', cat: '지배주주', qty: '3000' }, { name: 'B', cat: '지배주주의 특수관계인', qty: '4000' }, { name: 'C', cat: '지배주주의 특수관계인', qty: '1000' },
              { name: 'D', cat: '지배주주의 특수관계인', qty: '4000' }, { name: 'E', cat: '', qty: '0' }, { name: 'F', cat: '', qty: '0' }, { name: 'G', cat: '', qty: '0' },
              { name: 'H', cat: '', qty: '0' }, { name: 'I', cat: '', qty: '0' }, { name: 'J', cat: '', qty: '0' },
            ],
          },
        ],
      },
    ],
    subs: [
      { key: 'w1', label: '① 금전무상대여', groups: [{ title: '입력값', fields: [A('w1_principal', '대여원금(원)', '5000000000'), N('w1_rate', '적정이자율(당좌대출이자율, %)', '4.6', { step: '0.01' })] }], compute: calc7w1 },
      { key: 'w2', label: '② 채무면제', groups: [{ title: '입력값', fields: [A('w2_income', '채무면제 전 특정법인 사업연도 소득금액(원)', '200000000'), A('w2_amount', '채무면제액(원)', '350000000')] }], compute: calc7w2 },
      { key: 'w3', label: '③ 증여', groups: [{ title: '입력값', fields: [A('w3_income', '증여 전 특정법인 사업연도 소득금액(원)', '1500000000'), A('w3_amount', '증여가액(금전·주식·현물 등, 원)', '200000000')] }], compute: calc7w3 },
      { key: 'w4', label: '④ 초과배당', groups: [{ title: '입력값', fields: [A('w4_income', '배당 전 특정법인 사업연도 소득금액(원)', '400000000'), A('w4_div', '특정법인이 수령한 배당금액(원)', '400000000'), N('w4_ratio', '배당지급법인(피출자법인)에 대한 지분율(%)', '50', { step: '0.1' })] }], compute: calc7w4 },
    ],
    note: '판정기준: 거래이익(정산금액)×주주 지분율이 1억원 이상이면 그 지분에 대해 증여세가 과세됩니다(금전무상대여는 법인세상당액 차감 없이 직접 판정). 본 계산기는 참고용 시뮬레이션 도구입니다.',
  },
  {
    key: 't8', no: '06', title: '불균등 유상증자 · 유상감자 계산기', eyebrow: '상증세법 §39 · 불균등 자본거래',
    desc: '일부 주주가 신주인수(또는 감자)를 포기(실권)하고 특정 주주(또는 특정법인)가 이를 불균등하게 인수·보유하여 이익을 얻는 경우의 증여의제이익을 계산합니다. 실제 컨설팅에서 흔한 "일부 실권 + 특정인 전부 인수/보유" 패턴을 기준으로 한 실무 간편 계산기입니다.',
    subs: [
      {
        key: 'x1', label: '유상증자',
        groups: [
          { title: '입력값', fields: [A('x1_fair', '증자 전 1주당 시가(원)', '220000'), A('x1_issue', '신주 1주당 인수가(원)', '5000')] },
          {
            title: '주주별 기존주식수 및 실제 인수주식수',
            fields: [{
              kind: 'rows', id: 'x1_rows', label: '주주', addable: true, newRow: { name: '신규주주', cat: '개인', qty: '0', extra: '0' },
              columns: [{ key: 'name', label: '주주명', type: 'text' }, { key: 'cat', label: '구분', type: 'select', options: ['개인', '법인'] }, { key: 'qty', label: '기존주식수', type: 'amount' }, { key: 'extra', label: '실제 인수주식수(신주)', type: 'amount' }],
              defaults: [{ name: '김XX(부)', cat: '개인', qty: '15000', extra: '0' }, { name: '김XX(모)', cat: '개인', qty: '5000', extra: '0' }, { name: 'ㅇㅇㅇ', cat: '법인', qty: '0', extra: '80000' }],
            }],
          },
        ],
        compute: calc8x1,
      },
      {
        key: 'x2', label: '유상감자',
        groups: [
          { title: '입력값', fields: [A('x2_fair', '감자 전 1주당 가치(원)', '48000'), A('x2_redeem', '1주당 감자대가(원)', '5000')] },
          {
            title: '주주별 기존주식수 및 실제 감자(상환)주식수',
            fields: [{
              kind: 'rows', id: 'x2_rows', label: '주주', addable: true, newRow: { name: '신규주주', cat: '개인', qty: '0', extra: '0' },
              columns: [{ key: 'name', label: '주주명', type: 'text' }, { key: 'cat', label: '구분', type: 'select', options: ['개인', '법인'] }, { key: 'qty', label: '기존주식수', type: 'amount' }, { key: 'extra', label: '실제 감자주식수', type: 'amount' }],
              defaults: [{ name: '김XX(부)', cat: '개인', qty: '15000', extra: '15000' }, { name: '김XX(모)', cat: '개인', qty: '5000', extra: '5000' }, { name: 'ㅇㅇㅇ', cat: '법인', qty: '80000', extra: '0' }],
            }],
          },
        ],
        compute: calc8x2,
      },
    ],
    note: '판정기준(상증세법 §39/§39의2, 동법시행령 §29): 이익 ≥ 기준금액(Min(3억원, 시가×30%))이면 과세. 이익을 얻은 자가 법인(특정법인 등)인 경우 법인세상당액을 차감한 정산이익을 기준으로 판정합니다("구분" 열에 "법인"으로 표시된 행). 본 계산기는 일부 주주 전부 실권 + 특정인(법인 포함) 불균등 인수·보유라는 실무상 대표적 패턴을 기준으로 한 간편 계산기이며, 정교한 지분율별 안분 계산이 필요한 경우 세무사와 상담하시기 바랍니다.',
  },
  {
    key: 't1', no: '07', title: '가지급금 손실계산기', eyebrow: 'Provisional Payment Simulation',
    desc: '대표이사(특수관계인) 가지급금을 방치할 경우 연도별 세무·자금 손실을 시뮬레이션합니다.',
    subs: [{
      key: 'main', label: '',
      groups: [{ title: '① 기본 가정 입력', fields: [A('g_principal', '가지급금 원금 (원)', '1000000000'), N('g_rate', '인정이자율 (당좌대출이자율)', '4.6', { step: '0.01', hint: '% 단위' }), N('g_years', '분석 기간 (년, 1~10)', '5', { min: 1, max: 10 }), N('g_corp', '법인세 적용세율', '20', { step: '0.1', hint: '%' }), N('g_inc', '대표이사 소득세 한계세율(지방소득세 포함)', '41.8', { step: '0.1', hint: '%' }), N('g_ins', '4대보험 추가부담률(회사분)', '9', { step: '0.1', hint: '%' }), S('g_debt', '회사 차입금 존재 여부', ['있음', '없음'], '있음'), N('g_borrow', '가중평균차입이자율(지급이자 손금불산입 계산용)', '4.6', { step: '0.01', hint: '%' })] }],
      compute: calc1,
    }],
  },
  {
    key: 't4', no: '08', title: '상속세 계산기', eyebrow: 'Inheritance Tax',
    desc: '상속재산가액, 상속공제, 세율을 반영한 상속세 계산 및 상속인별 세액안분입니다.',
    subs: [
      {
        key: 'i1', label: '상속세 계산',
        groups: [
          { title: '① 상속재산가액', fields: [A('h_re', '부동산 (시가 또는 보충적 평가액)', '1000000000'), A('h_fin', '금융재산 (예금·주식·보험금 등)', '300000000'), A('h_etc', '기타재산', '50000000'), A('h_gift', '사전증여재산 가산액', '100000000'), A('h_exempt', '비과세·과세가액불산입 재산', '0')] },
          { title: '② 공과금·장례비·채무', fields: [A('h_due', '공과금', '5000000'), A('h_funeral', '장례비용(500만~1500만)', '15000000'), A('h_debt', '채무', '200000000')] },
          { title: '③ 상속공제', fields: [S('h_spouse', '배우자 생존 여부', ['예', '아니오'], '예'), N('h_children', '자녀 수', '2'), N('h_minor', '미성년 자녀·직계비속 수', '0'), N('h_minor_yr', '미성년자 평균 잔여연수(19세까지)', '0'), N('h_old', '연로자 수(65세이상,배우자제외)', '0'), N('h_disabled', '장애인 수', '0'), N('h_disabled_yr', '장애인 기대여명연수', '0'), A('h_spouse_actual', '배우자 실제 상속받은 재산가액', '500000000'), A('h_spouse_legal', '배우자 법정상속분 상당액', '700000000'), S('h_house_ok', '동거주택 요건 충족', ['아니오', '예'], '아니오'), A('h_house_val', '동거주택가액', '0')] },
          { title: '④ 할증·세액공제', fields: [S('h_skip', '세대생략상속 여부', ['해당없음', '할증30%', '할증40%(미성년20억초과)'], '해당없음'), A('h_gift_credit', '증여세액공제(기납부)', '20000000')] },
        ],
        compute: calc4,
        note: '본 계산기는 2026년 7월 현재 시행 중인 「상속세 및 증여세법」 기준입니다. 개정안(국회 계류 중)은 반영되지 않았습니다. 실제 신고 시 세무사와 상담하시기 바랍니다.',
      },
      {
        key: 'i2', label: '상속인별 세액안분',
        groups: [{
          title: '상속인별 지분율 입력 (합계 100%가 되도록)',
          fields: [{
            kind: 'rows', id: 'h2_rows', label: '상속인', addable: true, newRow: { name: '상속인', rel: '자녀', ratio: '0' },
            columns: [{ key: 'name', label: '상속인', type: 'text' }, { key: 'rel', label: '관계', type: 'text' }, { key: 'ratio', label: '상속지분율(%)', type: 'number' }],
            defaults: [{ name: '배우자', rel: '배우자', ratio: '42.86' }, { name: '자녀1', rel: '자녀', ratio: '28.57' }, { name: '자녀2', rel: '자녀', ratio: '28.57' }],
          }],
        }],
        compute: calc4b,
        note: '상속세는 상속인 각자가 실제 받은 재산 비율대로 연대납세의무를 부담합니다(상증세법 §3조의2). 배우자 법정상속분은 자녀의 1.5배입니다.',
      },
    ],
  },
  {
    key: 't3', no: '09', title: '비상장주식 가치평가', eyebrow: 'Unlisted Share Valuation · 상증세법 보충적 평가',
    desc: '상속세 및 증여세법상 비상장주식 보충적 평가방법(순자산가치·순손익가치 가중평균)의 간편 계산기입니다.',
    subs: [{
      key: 'main', label: '',
      groups: [
        { title: '① 법인 기본 정보', fields: [T('v_name', '법인명', 'ㅇㅇㅇ'), A('v_shares', '평가일 현재 발행주식수(주)', '138000'), A('v_par', '액면가(원)', '5000'), N('v_rate', '적용이자율(순손익가치환원율)', '10', { step: '0.1', hint: '% · 기획재정부 고시 이자율' })] },
        { title: '② 재무상태 (순자산가치용)', fields: [A('v_asset', '자산총액(원)', '3000000000'), A('v_debt', '부채총계(원)', '1000000000'), A('v_re_book', '부동산 장부가(원)', '600000000'), A('v_re_fair', '부동산 시가(원)', '800000000'), A('v_severance', '미반영 퇴직급여추계액(원)', '0'), A('v_goodwill', '영업권 상당액(원)', '0')] },
        { title: '③ 법인 구분', fields: [S('v_type', '법인 구분 직접 선택', ['일반법인', '부동산과다보유법인', '특수법인'], '일반법인')] },
        { title: '④ 최근 3년 순손익액 & 자본거래 — 1년전', fields: [A('v_inc0', '각 사업연도 순손익액(원)', '250000000'), N('v_month0', '유상증(감)자 실시월(1~12)', '8'), A('v_cap0', '유상증(감)자 금액(감자는 -)', '0')] },
        { title: '2년전(직전)', fields: [A('v_inc1', '각 사업연도 순손익액(원)', '500000000'), N('v_month1', '유상증(감)자 실시월(1~12)', '3'), A('v_cap1', '유상증(감)자 금액(감자는 -)', '-200000000')] },
        { title: '결산연도', fields: [A('v_inc2', '각 사업연도 순손익액(원)', '420000000'), N('v_month2', '유상증(감)자 실시월(1~12)', '10'), A('v_cap2', '유상증(감)자 금액(감자는 -)', '0')] },
      ],
      compute: calc3,
      note: '가중치는 결산연도 3, 직전연도 2, 1년전 1을 적용합니다. 자본거래가 없으면 0으로 두세요.',
    }],
    note: '※ 부동산 비율 = 부동산 시가 ÷ (자산총액 + 부동산평가차액) · 특수법인/부동산과다보유법인 자동판정은 참고용이며, 실제 반영값은 위 "법인 구분 직접 선택"입니다.',
  },
]

export function calculatorOf(key: string): Calculator | undefined {
  return TAX_CALCULATORS.find((c) => c.key === key)
}
