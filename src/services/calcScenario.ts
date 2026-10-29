/**
 * 상황 예시 — 세금 계산기 05 특정법인 증여의제 · 06 불균등 유상증자 · 감자 (D-243 · 로드맵 5단계 남은 것).
 *
 *  - 업체 숫자(주주명부 주식 수 · 관계 · 회사 순이익 · 1주 가치)는 calcPrefill 로 — 절세 현황이 비어 있으면 회사 정보로 채운 값(상황 예시 절세와 같은 값).
 *  - 상황 값(빌려준 돈 · 면제한 빚 · 준 재산 · 누가 몇 주 받거나 돌려주는지 · 액면가로)은 여기서 — 계산기 화면 `?preset=` 도 같은 값을 넣는다.
 *  - 계산은 계산기 식 그대로(sub.compute) — 업체 상세에서 본 숫자 = 계산기 화면 숫자. 결과 줄은 계산기가 낸 글을 그대로 옮긴다.
 *  - 주주명부가 없으면(06 은 1주 가치도) 짐작하지 않고 '받으면 바로 계산' 만 말한다.
 *  - 규칙 계산이다(AI · LLM 호출 없음).
 */
import type { ClientOpsRecord, ShareholderRow } from '../types/clientOps'
import { calculatorOf, defaultValues, type Output, type RowValues, type Values } from './taxCalc'
import { calcPrefill, holdersWithShares } from './taxCalcPrefill'
import { CALC_AMOUNT_FIELD, type ScenarioPreset } from './scenarioPresets'
import { filledTaxProfile, shareValueOf, viewProfile } from './taxPlan'
import { formatWon } from './customerFacts'
import { josa } from '../lib/josa'

export interface CalcPresetValues {
  /** 업체 숫자 + 상황 값 — 계산기 칸에 그대로 */
  values: Values
  /** 상황 값만(화면 '넣은 가정' · [가정 빼기]) */
  applied: Values
  /** 업체 기록에서 채운 칸 이름 */
  filled: string[]
  /** 이것이 없으면 결과를 내지 않는다(요청 문구 이름) */
  missing: string[]
  /** 계산에 둔 가정(사람이 읽는 말) */
  notes: string[]
}

const isKid = (r: ShareholderRow) => r.relation === 'child' || r.relation === 'minor_child'

/** 06 주주 표에서 그 주주의 줄 — 표는 주식이 있는 주주를 명부 순서대로 담는다(같은 이름이 있어도 순서로 맞춘다) */
function rowIndexOf(reg: readonly ShareholderRow[], who: ShareholderRow): number {
  return holdersWithShares(reg).findIndex((r) => r.id === who.id)
}

/** 상황 하나 → 계산기 칸 값(업체 숫자 + 상황 값). record 가 없으면 상황 값만 */
export function calcPresetValues(s: Pick<ScenarioPreset, 'calc'>, record: ClientOpsRecord | null, today: string): CalcPresetValues {
  const out: CalcPresetValues = { values: {}, applied: {}, filled: [], missing: [], notes: [] }
  const c = s.calc
  if (!c) return out
  const profile = record ? filledTaxProfile(record, today).profile : {}
  const pf = calcPrefill(c.key, record ? { ...record, taxProfile: profile } : null, today)
  const reg = record?.shareholderRegister ?? []
  const holders = holdersWithShares(reg)
  const p = viewProfile(profile)
  if (holders.length === 0) out.missing.push('주주명부(주식 수)')
  /** D-244: 계산기 기본값으로 되돌려 둘 칸 — 예전에 이 업체 계산기에서 바꾼 이율이 남아 있으면 상황 카드와 계산기 숫자가 달랐다 */
  const keep: Values = {}
  if (c.key === 't7') {
    if (c.sub === 'w1') keep.w1_rate = defaultValues(calculatorOf('t7')!).w1_rate
    if (c.amount) out.applied[CALC_AMOUNT_FIELD[c.sub]] = String(c.amount)
    const income = pf.values[`${c.sub}_income`]
    if (c.sub !== 'w1' && income === '0') out.notes.push('회사 순이익을 몰라 소득금액 0 으로 계산 — 법인세상당액이 작게 잡혀 증여 금액이 크게 보일 수 있어요')
  } else {
    const sv = shareValueOf(p, reg)
    if (holders.length > 0 && sv.perShare <= 0) out.missing.push('주식가치(1주 · 최근 재무제표)')
    const priceField = c.sub === 'x1' ? 'x1_issue' : 'x2_redeem'
    if (p.par > 0) out.applied[priceField] = String(Math.round(p.par))
    else out.notes.push('1주 액면가를 몰라 계산기 예시값(5,000원)으로 계산')
    const base = pf.values[`${c.sub}_rows`]
    if (holders.length > 0 && Array.isArray(base)) {
      const rows: RowValues[] = base.map((r) => ({ ...r }))
      const pct = (c.share?.pct ?? 0) / 100
      if (c.sub === 'x1') {
        const total = holders.reduce((a, r) => a + r.shares, 0)
        const extra = String(Math.max(1, Math.round(total * pct)))
        const kid = reg.find((r) => isKid(r) && r.shares > 0) ?? reg.find(isKid) ?? null
        const i = kid ? rowIndexOf(reg, kid) : -1
        if (kid && i >= 0) rows[i] = { ...rows[i], extra }
        else {
          rows.push({ name: kid?.name.trim() || '자녀(새 주주)', cat: '개인', qty: '0', extra })
          if (!kid) out.notes.push("주주명부에 자녀가 없어 '자녀(새 주주)' 로 넣었어요 — 실제 받을 사람으로 바꾸세요")
        }
        out.applied.x1_rows = rows
      } else {
        const ceo = reg.find((r) => r.relation === 'ceo' && r.shares > 0) ?? null
        if (!ceo) out.missing.push('주주명부에 대표 표시')
        else {
          const i = rowIndexOf(reg, ceo)
          rows[i] = { ...rows[i], extra: String(Math.max(1, Math.round(ceo.shares * pct))) }
          out.applied.x2_rows = rows
        }
      }
    }
  }
  out.values = { ...pf.values, ...keep, ...out.applied }
  out.filled = pf.names
  return out
}

/* ------------------------------------------------------------------ */
/* 업체 상세 '상황 예시로 바로 설계' 한 줄                                    */
/* ------------------------------------------------------------------ */

export type CalcRunState = 'ready' | 'partial' | 'need'

export interface CalcScenarioBody {
  state: CalcRunState
  headline: string
  lines: string[]
  amount: string
  needs: { label: string; ok: boolean; value: string }[]
  filledFrom: string[]
  assumptions: string[]
}

const krw = (n: number) => (Number.isFinite(n) ? formatWon(n) : '-')
/** 1주 값은 원 단위 그대로(만원으로 줄이면 5,000원이 '1만원' 이 된다) */
const perWon = (n: number) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('ko-KR')}원` : '-')
const lineOf = (o: Output, block: string, key: string) => o.blocks.find((b) => b.id === block)?.lines.find((l) => l.k === key)?.v ?? ''
const tableOf = (o: Output, id: string) => (o.tables ?? []).find((t) => t.id === id)
/** 계산기 글('46,000,000원')의 숫자 */
const numOf = (v: string) => Number(v.replace(/[^\d-]/g, '')) || 0
/** 계산기 글 → 화면 금액(4,600만원) — 숫자가 없으면 그대로 */
const w = (v: string) => (/\d/.test(v) ? krw(numOf(v)) : v)
const largest = (vs: string[]) => [...vs].sort((a, b) => numOf(b) - numOf(a))[0] ?? ''

/** 05 계산기 표 구분 — 증여로 보는 사람(지배주주와 친족) */
const isFamilyCat = (cat: string) => cat === '지배주주' || cat === '지배주주의 친족'

/** 계산기 05 · 06 상황 → 이 업체 숫자로 계산(계산기 식 그대로) */
export function runCalcScenario(s: ScenarioPreset, record: ClientOpsRecord, today: string): CalcScenarioBody {
  const c = s.calc!
  const calc = calculatorOf(c.key)!
  const sub = calc.subs.find((x) => x.key === c.sub) ?? calc.subs[0]
  const pv = calcPresetValues(s, record, today)
  const reg = record.shareholderRegister ?? []
  const holders = holdersWithShares(reg)
  const total = holders.reduce((a, r) => a + r.shares, 0)
  const { profile } = filledTaxProfile(record, today)
  const p = viewProfile(profile)
  const sv = shareValueOf(p, reg)
  const needs: CalcScenarioBody['needs'] = [{ label: '주주명부(주식 수)', ok: holders.length > 0, value: holders.length > 0 ? `${holders.length}명 · ${total.toLocaleString('ko-KR')}주` : '' }]
  if (c.key === 't7' && c.sub !== 'w1') {
    const inc = pv.values[`${c.sub}_income`]
    const known = typeof inc === 'string' && inc !== '0'
    needs.push({ label: '회사 순이익(재무제표)', ok: known, value: known ? krw(Number(inc)) : '' })
  }
  if (c.key === 't8') {
    needs.push({ label: '주식가치(1주 · 최근 재무제표)', ok: sv.perShare > 0, value: sv.perShare > 0 ? perWon(sv.perShare) : '' })
    needs.push({ label: '1주 액면가', ok: p.par > 0, value: p.par > 0 ? perWon(p.par) : '' })
    if (c.sub === 'x1') {
      const kid = reg.find(isKid)
      needs.push({ label: '주주명부에 자녀(새 주식 받을 사람)', ok: !!kid, value: kid?.name ?? '' })
    }
  }
  const assumptions = [`세금 계산기 ${calc.no}(${calc.title.replace(/ 계산기$/, '')})와 같은 식 · 참고용 — 실행 전 담당 세무사 검토`, ...pv.notes]
  if (pv.missing.length > 0) {
    return { state: 'need', headline: `${josa(pv.missing.join(' · '), '을/를')} 받으면 바로 계산해요`, lines: [], amount: '', needs, filledFrom: pv.filled, assumptions }
  }
  const o = sub.compute({ ...defaultValues(calc), ...pv.values })
  const lines: string[] = []
  let headline = ''
  let amount = ''
  if (c.key === 't7') {
    const table = tableOf(o, `${c.sub}_table`)
    // 표: 주주 · 구분 · 지분율 · 증여의제이익 · 판정 — 증여로 보는 사람(지배주주와 친족)만 결론에 쓴다
    const fam = (table?.rows ?? []).filter((r) => isFamilyCat(r.cells[1]))
    // D-244: 빌려주고 · 준 사람은 대표 — 대표가 주식이 없으면 최대주주(지배주주 줄)도 받는 가족이다(예전엔 그 줄을 빼고 '비과세' 라고 했다)
    const giver = holders.find((r) => r.relation === 'ceo')?.name.trim() || null
    const isGiver = (r: { cells: string[] }) => giver !== null && r.cells[1] === '지배주주' && r.cells[0] === giver
    const kin = fam.filter((r) => !isGiver(r))
    const taxed = kin.filter((r) => r.cells[4].startsWith('O'))
    const gain = c.sub === 'w1' ? lineOf(o, 'w1_out', '특정법인의 이익(대여원금×적정이자율)') : lineOf(o, `${c.sub}_out`, '정산증여액')
    const limitKey = c.sub === 'w1' ? '과세되지 않는 대여원금 한도' : c.sub === 'w2' ? '과세되지 않는 채무면제액 한도(지배주주 기준)' : '과세되지 않는 증여가액 한도(지배주주 기준)'
    const limit = lineOf(o, `${c.sub}_out`, limitKey)
    if (kin.length === 0) headline = '주주명부에 대표 친족 주주가 없어요 — 주주 가족에게 갈 이익이 없어요'
    else if (taxed.length > 0) headline = `과세 — ${taxed.map((r) => `${r.cells[0]}(${r.cells[2]}) ${w(r.cells[3])}`).join(' · ')} · 1억 이상`
    else headline = `비과세 — 가족 주주 몫이 가장 커도 ${w(largest(kin.map((r) => r.cells[3])))}(1억 미만)`
    lines.push(c.sub === 'w1' ? `회사가 얻는 이익(1년 이자) ${w(gain)}` : `회사가 얻은 이익(법인세상당액 뺀 것) ${w(gain)}`)
    // 지배주주 줄은 상황에서 빌려주고 · 준 본인 — 계산기 판정을 그대로 '과세' 라고 쓰면 위 결론(가족 몫)과 엇갈려 보인다
    for (const r of fam) lines.push(isGiver(r) ? `${r.cells[0]} · 지배주주(준 사람 본인) ${r.cells[2]} → ${w(r.cells[3])} — 본인 몫은 ★ 세무사 확인` : `${r.cells[0]} · ${r.cells[1]} ${r.cells[2]} → ${w(r.cells[3])} ${r.cells[4].startsWith('O') ? '과세' : '비과세'}`)
    if (limit) lines.push(`${c.sub === 'w1' ? '이자 없이 빌려줘도 되는 한도' : c.sub === 'w2' ? '증여세 없이 면제할 수 있는 한도' : '증여세 없이 넣을 수 있는 한도'}(계산기 · 최대주주 지분율 기준) ${w(limit)}`)
    amount = limit ? `한도 ${w(limit)}` : w(gain)
    assumptions.push('★ 빌려준 · 준 사람 본인 몫을 빼고 보는지 · 실제 과세 대상(지배주주와 친족 · 지분 30% 이상)은 세무사 확인')
  } else {
    const table = tableOf(o, `${c.sub}_judge`)
    const rows = table?.rows ?? []
    const per = c.sub === 'x1' ? lineOf(o, 'x1_summary', '증자 후 1주당 정상가') : lineOf(o, 'x2_summary', '감자 후 1주당 정상가')
    lines.push(`${c.sub === 'x1' ? '증자 전' : '감자 전'} 1주 ${perWon(sv.perShare)} → ${c.sub === 'x1' ? '증자' : '감자'} 뒤 ${perWon(numOf(per))}`)
    if (c.sub === 'x1') {
      // 표: 주주 · 구분 · 인수주식수 · 이익증여금액 · 법인세상당액 · 정산이익 · 판정
      for (const r of rows) lines.push(`${r.cells[0]} — 새 주식 ${r.cells[2]}주 · 이익 ${w(r.cells[5])} · ${r.cells[6].startsWith('O') ? '과세(기준 이상)' : '비과세(기준 미만)'}`)
      const top = rows[0]
      headline = top ? `${top.cells[0]} 이익 ${w(top.cells[5])} — ${top.cells[6].startsWith('O') ? '증여세 과세(기준 이상)' : '기준 미만 · 비과세'}` : '새 주식을 받는 사람이 없어요'
      amount = top ? `이익 ${w(top.cells[5])}` : ''
    } else {
      // 표: 주주 · 구분 · 사후보유주식수 · 지분율 변동 · 이익증여금액 · 법인세상당액 · 정산이익 · 판정
      for (const r of rows) lines.push(`${r.cells[0]} — 지분 ${r.cells[3]} · 이익 ${w(r.cells[6])} · ${r.cells[7].startsWith('O') ? '과세(기준 이상)' : '비과세(기준 미만)'}`)
      const taxed = rows.filter((r) => r.cells[7].startsWith('O'))
      headline = rows.length === 0 ? '지분이 늘어나는 주주가 없어요' : taxed.length > 0 ? `과세 — ${taxed.map((r) => `${r.cells[0]} ${w(r.cells[6])}`).join(' · ')}(기준 이상)` : `비과세 — 남은 주주 이익이 가장 커도 ${w(largest(rows.map((r) => r.cells[6])))}(기준 미만)`
      amount = rows[0] ? `이익 ${w(largest(rows.map((r) => r.cells[6])))}` : ''
    }
    assumptions.push('기준 금액 = 3억과 (기존 주식 × 1주 가치)의 30% 가운데 작은 것 — 계산기 식', '★ 실권 · 인수 경위 · 특수관계 여부에 따라 과세가 달라요(세무사 확인)')
  }
  const partial = needs.some((n) => !n.ok) || pv.notes.length > 0
  return { state: partial ? 'partial' : 'ready', headline, lines: lines.slice(0, 6), amount, needs, filledFrom: pv.filled, assumptions }
}
