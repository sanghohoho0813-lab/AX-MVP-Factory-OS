/**
 * 세금 계산기 9종을 업체로 열면 그 업체의 숫자로 미리 채운다 (D-134).
 *
 * 채우는 것은 '그 업체의 사실' 뿐이다 — 절세 설계 현황(taxProfile) · 주주명부 · 회사 이름.
 * 이율 · 공제 · 배수 같은 계산기 기본값(원본 산식의 기본)은 건드리지 않는다.
 * 주당 가치는 09 비상장주식 식(shareValueOf)으로 나온 값이나 직접 적은 값만 쓴다.
 * D-243: 05 특정법인 증여의제 · 06 불균등 증자 · 감자도 — 주주명부(주식 수 · 관계) · 회사 순이익 · 1주 가치.
 * 빌려준 돈 · 누가 몇 주 받는지 같은 '상황 값' 은 채우지 않는다(상황 예시 calcScenario 가 넣는다).
 * 그 업체의 사실인데 모르는 칸(부동산 장부가 · 유상증자 · 다른 소득 …)은 계산기 예시값을 남기지 않고
 * 절세 설계와 같은 값(0)으로 둔다 — 같은 업체를 계산기로 열어도 절세 설계와 같은 숫자가 나오게.
 * 순수 함수만 둔다.
 */
import type { ClientOpsRecord, ShareholderRow } from '../types/clientOps'
import { computeSalary, type RowValues, type Values } from './taxCalc'
import { ceoOf, shareValueOf, viewProfile } from './taxPlan'
import { todayLocalDate } from '../lib/appClock'

/** 모르는 칸을 0 으로 둔 것을 알리는 이름 */
export const ZERO_NOTE = '모르는 칸은 0(절세 설계와 같게)'

export interface CalcPrefill {
  /** 칸 값 — 주주 표(05 · 06)는 줄 목록 */
  values: Values
  /** 채운 칸 이름 — '업체 기록에서 채웠습니다' 에 그대로 */
  names: string[]
}

const s = (n: number) => String(Math.round(n))

/** 05 주주 표는 10줄(이름 칸은 고칠 수 없음) — 비는 줄은 계산기 원래 이름(A~J) */
const T7_ROWS = 10
const LETTERS = 'ABCDEFGHIJ'
const FAMILY = new Set<ShareholderRow['relation']>(['spouse', 'child', 'minor_child', 'parent', 'relative'])

/** 주식이 있는 주주만(명부 순서 그대로) */
export function holdersWithShares(reg: readonly ShareholderRow[]): ShareholderRow[] {
  return reg.filter((r) => Number.isFinite(r.shares) && r.shares > 0)
}

/** 지배주주 — 대표(주식이 있으면), 없으면 가장 많이 가진 사람 */
export function controllingHolder(reg: readonly ShareholderRow[]): ShareholderRow | null {
  const list = holdersWithShares(reg)
  return list.find((r) => r.relation === 'ceo') ?? [...list].sort((a, b) => b.shares - a.shares)[0] ?? null
}

/**
 * 05 구분 칸 — 증여로 보는 사람은 지배주주와 그 친족(지배주주등). 임원 · 기타는 지분율 계산에만 들어간다(계산기 표에도 보이게 '대상 아님').
 * 법인 주주는 간접 보유로 들어갈 수 있어 확인 표시.
 */
export function t7Category(r: ShareholderRow, top: ShareholderRow | null): string {
  if (top && r.id === top.id) return '지배주주'
  if (FAMILY.has(r.relation) || r.relation === 'ceo') return '지배주주의 친족'
  if (r.relation === 'corp') return '법인(★ 간접 보유 확인)'
  if (r.relation === 'executive') return '임원(증여 대상 아님)'
  return '기타(증여 대상 아님)'
}

/** 05 주주 표 — 10명이 넘으면 9명 + '그 외 n명'(지분율 합이 맞게) */
export function t7ShareRows(reg: readonly ShareholderRow[]): RowValues[] {
  const list = holdersWithShares(reg)
  const top = controllingHolder(reg)
  const shown = list.length > T7_ROWS ? list.slice(0, T7_ROWS - 1) : list
  const rows: RowValues[] = shown.map((r) => ({ name: r.name.trim() || '이름 없음', cat: t7Category(r, top), qty: s(r.shares) }))
  if (list.length > T7_ROWS) {
    const rest = list.slice(T7_ROWS - 1)
    rows.push({ name: `그 외 ${rest.length}명`, cat: '여러 명 합침(★ 한 사람씩 확인)', qty: s(rest.reduce((a, r) => a + r.shares, 0)) })
  }
  for (let i = rows.length; i < T7_ROWS; i++) rows.push({ name: LETTERS[i], cat: '', qty: '0' })
  return rows
}

/** 06 주주 표 — 기존 주식 수만(인수 · 감자 주식 수는 0 — 상황마다 다르다) */
export function t8ShareRows(reg: readonly ShareholderRow[]): RowValues[] {
  return holdersWithShares(reg).map((r) => ({ name: r.name.trim() || '이름 없음', cat: r.relation === 'corp' ? '법인' : '개인', qty: s(r.shares), extra: '0' }))
}

export function calcPrefill(
  calcKey: string,
  record: (Pick<ClientOpsRecord, 'companyName' | 'taxProfile' | 'shareholderRegister'> & { factValues?: Partial<Record<string, string>> }) | null,
  today: string = todayLocalDate(),
): CalcPrefill {
  const out: CalcPrefill = { values: {}, names: [] }
  if (!record) return out
  const p = viewProfile(record.taxProfile ?? {})
  const reg = record.shareholderRegister ?? []
  const sv = shareValueOf(p, reg)
  const ceo = ceoOf(reg)
  const put = (id: string, v: string, name: string) => {
    if (!v || v === '0') return
    out.values[id] = v
    if (!out.names.includes(name)) out.names.push(name)
  }
  const putRows = (id: string, rows: RowValues[], name: string) => {
    if (rows.length === 0) return
    out.values[id] = rows
    if (!out.names.includes(name)) out.names.push(name)
  }
  let zeroed = false
  /** 그 업체의 사실인데 모르는 칸 — 예시값 대신 0 */
  const zero = (...ids: string[]) => {
    for (const id of ids) {
      if (out.values[id] === undefined) {
        out.values[id] = '0'
        zeroed = true
      }
    }
  }
  const annual = p.monthlySalary * 12
  /** 회사(특정법인) 소득금액 — 절세 현황 결산 연도 순손익, 없으면 회사 정보 순이익(세무조정 전) */
  const latestIncome = (): { won: number; name: string } | null => {
    if (p.vInc[2] !== null) return { won: p.vInc[2], name: '회사 소득금액(결산 연도 순손익)' }
    const fv = record.factValues?.netIncome ?? ''
    const v = fv.trim() ? viewProfile({ vInc2: fv }).vInc[2] : null
    return v !== null ? { won: v, name: '회사 소득금액(회사 정보 순이익 · 세무조정 전)' } : null
  }
  switch (calcKey) {
    case 't2':
      put('s_monthly', s(p.monthlySalary), '대표 월 급여')
      break
    case 't1':
      put('g_principal', s(p.loanBalance), '가지급금 잔액')
      break
    case 't6':
      put('q_pay', s(annual), '대표 연 보수(월 급여 × 12)')
      put('r_start', p.ceoStartDate, '대표 취임일')
      put('t_start', p.ceoStartDate, '대표 취임일')
      // D-165: 끝나는 날 · 평균 급여도 절세 설계(퇴직금 한도)와 같게 — 전에는 예시(2021 · 2022 년 끝)가 남아
      // 근속연수가 0 이 되거나 한도가 2021 년에서 끊겼다
      if (p.ceoStartDate) {
        put('r_end', today, '오늘(퇴직 기준일)')
        put('t_end', today, '오늘(퇴직 기준일)')
      }
      if (annual > 0) for (const id of ['r_avg1', 'r_avg2', 'r_avg3']) put(id, s(annual), '최근 3년 연 급여(월 급여 × 12)')
      break
    case 't9':
      put('inc_a_salary', s(annual), '대표 총급여(월 급여 × 12)')
      if (p.monthlySalary > 0) {
        // 절세 설계와 같게: 4대보험 본인분은 01 급여 식 · 다른 소득은 적은 금융소득만
        put('inc_a_otherDed', s(computeSalary(p.monthlySalary).insTotal), '4대보험 본인분(01 식)')
        put('inc_a_interest', s(p.otherFinIncome), '다른 금융소득')
        zero('inc_a_interest', 'inc_a_dividend', 'inc_a_business', 'inc_a_pension', 'inc_a_other')
      }
      put('inc_a_totalShares', s(sv.totalShares), '발행주식 총수')
      if (ceo) put('inc_a_heldShares', s(ceo.shares), '대표 주식 수')
      if (ceo) put('inc_a_acquirePrice', s(ceo.acquirePrice || p.par), ceo.acquirePrice ? '대표 취득가' : '액면가')
      put('inc_a_transferPrice', s(sv.perShare), sv.source === 'manual' ? '1주당 가치(직접 적음)' : '1주당 가치(09 식)')
      put('inc_a_startDate', p.ceoStartDate, '대표 취임일')
      break
    case 't5':
      put('j_fair', s(sv.perShare), '1주당 가치')
      put('k_fair1', s(sv.perShare), '1주당 가치')
      if (ceo) put('j_cost', s(ceo.acquirePrice || p.par), ceo.acquirePrice ? '대표 취득가' : '액면가')
      break
    case 't4': {
      const known = p.estateRealEstate + p.estateFinancial + p.estateOther > 0
      if (!known) break
      // 절세 설계 상속세와 같은 칸 — 대표 주식(09 식 가치)은 기타 재산에 더한다
      const shareValue = ceo && sv.perShare > 0 ? ceo.shares * sv.perShare : 0
      put('h_re', s(p.estateRealEstate), '대표 부동산')
      put('h_fin', s(p.estateFinancial), '대표 금융재산')
      put('h_etc', s(p.estateOther + shareValue), shareValue > 0 ? '기타 재산(대표 주식 가치 포함)' : '기타 재산')
      put('h_debt', s(p.estateDebt), '대표 채무')
      put('h_spouse', p.spouseAlive ? '예' : '아니오', '배우자')
      put('h_children', String(p.children), '자녀 수')
      put('h_house_ok', '아니오', '동거주택 없음')
      put('h_skip', '해당없음', '세대생략 없음')
      zero('h_re', 'h_fin', 'h_etc', 'h_debt', 'h_gift', 'h_exempt', 'h_due', 'h_funeral', 'h_minor', 'h_minor_yr', 'h_old', 'h_disabled', 'h_disabled_yr', 'h_spouse_actual', 'h_spouse_legal', 'h_house_val', 'h_gift_credit')
      break
    }
    case 't3':
      put('v_name', record.companyName, '회사 이름')
      put('v_shares', s(sv.totalShares), '발행주식 총수')
      put('v_par', s(p.par), '액면가')
      if (record.taxProfile?.vRate) put('v_rate', String(p.vRate), '순손익가치환원율')
      put('v_asset', s(p.vAsset), '자산총액')
      put('v_debt', s(p.vDebt), '부채총계')
      put('v_re_book', s(p.vReBook), '부동산 장부가')
      put('v_re_fair', s(p.vReFair), '부동산 시가')
      if (record.taxProfile?.vType) put('v_type', p.vType, '법인 구분')
      p.vInc.forEach((v, i) => {
        if (v !== null) put(`v_inc${i}`, s(v), '사업연도 순손익')
      })
      // 09 식으로 주식가치를 계산한 업체면 나머지 칸도 절세 설계와 같게(예시 부동산 · 유상증자 값이 남지 않게)
      if (sv.source === '09') {
        put('v_type', p.vType, '법인 구분')
        zero('v_asset', 'v_debt', 'v_re_book', 'v_re_fair', 'v_severance', 'v_goodwill', 'v_inc0', 'v_inc1', 'v_inc2', 'v_month0', 'v_month1', 'v_month2', 'v_cap0', 'v_cap1', 'v_cap2')
      }
      break
    case 't7': {
      // 주주명부가 있어야 채운다 — 예시 주주(A~D) 위에 이 회사 순이익만 넣으면 남의 지분율로 판정된다
      if (holdersWithShares(reg).length === 0) break
      putRows('w_share_rows', t7ShareRows(reg), '주주명부(주식 수 · 관계)')
      const inc = latestIncome()
      for (const id of ['w2_income', 'w3_income', 'w4_income']) {
        if (inc && inc.won !== 0) put(id, s(inc.won), inc.name)
      }
      zero('w2_income', 'w3_income', 'w4_income')
      break
    }
    case 't8': {
      if (holdersWithShares(reg).length === 0) break
      putRows('x1_rows', t8ShareRows(reg), '주주명부(기존 주식 수)')
      putRows('x2_rows', t8ShareRows(reg), '주주명부(기존 주식 수)')
      const per = sv.source === 'manual' ? '1주당 가치(직접 적음)' : '1주당 가치(09 식)'
      put('x1_fair', s(sv.perShare), per)
      put('x2_fair', s(sv.perShare), per)
      zero('x1_fair', 'x2_fair')
      break
    }
  }
  if (zeroed && out.names.length > 0) out.names.push(ZERO_NOTE)
  else if (out.names.length === 0) out.values = {}
  return out
}
