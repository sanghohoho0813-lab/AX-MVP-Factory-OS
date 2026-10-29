/**
 * D-321 계산 기준표 — OS 가 계산에 쓰는 세율 · 공제 · 단가를 한 화면에.
 *
 * 숫자를 여기 따로 적지 않는다 — 계산기 · 모듈이 실제로 쓰는 상수와 함수에서 읽는다(바꾸면 기준표도 같이 바뀐다).
 * 기준 연도 · 조문 이름은 사람이 읽는 꼬리표다. 규칙 계산이며 AI 가 아니다.
 */
import { CONV_DED9, CORP_RATES, GROSSUP_RATE, INC9_BRACKETS, S_RATE, SERVICE_DED9, defaultValues, calculatorOf, giftDeduction, inheritGiftTax } from './taxCalc'
import { SME_2026, defaultTaxUnits } from '../tools/employment/lib/taxCredit'
import { RATES_2026 } from '../tools/employment/lib/payroll'
import { MIN_WAGE_2026 } from '../tools/employment/lib/constants'
import { VENTURE_STARTUP_RATE, startupRates } from '../tools/startupTax/lib/rules'
import { CATEGORY_RATES } from '../tools/labcare/lib/taxCredit'

export interface BasisRow {
  label: string
  value: string
}
export interface BasisSection {
  id: string
  title: string
  /** 기준 — 몇 년 · 어떤 법 */
  basis: string
  rows: BasisRow[]
  /** 이 기준을 쓰는 화면 */
  usedIn: string
  note?: string
}

const man = (won: number) => {
  const m = Math.round(won / 10_000)
  if (m >= 10_000) {
    const e = Math.floor(m / 10_000)
    const r = m % 10_000
    return r ? `${e}억 ${r.toLocaleString('ko-KR')}만` : `${e}억`
  }
  return `${m.toLocaleString('ko-KR')}만`
}
const pctOf = (r: number) => `${parseFloat((r * 100).toFixed(3))}%`

/** 누진 구간표 → '1,400만 이하 6%' 줄 */
function bracketRows(table: readonly (readonly [number, number, number])[], unit = '원'): BasisRow[] {
  return table.map(([from, , rate], i) => {
    const to = table[i + 1]?.[0]
    const label = i === 0 ? `${man(to!)} 이하` : to ? `${man(from)} 초과 ~ ${man(to)}` : `${man(from)} 초과`
    return { label: unit === '원' ? label : label, value: pctOf(rate) }
  })
}

/**
 * D-332 기준 연도 · 다음 점검 — 세법은 해마다 1월 · 7월(4대보험 상한)에 바뀐다. 해가 바뀌었는데 숫자를 다시 보지 않았으면 기준표 머리에 알린다.
 * 숫자를 고친 해에 LAW_BASIS_YEAR 를 올린다(그 해의 개정을 반영했다는 뜻).
 */
export const LAW_BASIS_YEAR = 2026
export function lawBasisStatus(today: string): { year: number; nextReview: string; stale: boolean } {
  const nextReview = `${LAW_BASIS_YEAR + 1}-01-01`
  return { year: LAW_BASIS_YEAR, nextReview, stale: today >= nextReview }
}

export function lawBasis(): BasisSection[] {
  const corp26 = CORP_RATES.y2026
  const corp25 = CORP_RATES.y2025
  const corpCuts = ['과표 2억 이하', '2억 초과 ~ 200억', '200억 초과 ~ 3,000억', '3,000억 초과']
  const t1 = calculatorOf('t1')
  const loanRate = t1 ? defaultValues(t1).g_rate : ''
  const giftRels = ['배우자', '직계존속(성년)', '직계존속(성년 · 혼인출산)', '직계존속(미성년)', '직계비속', '기타친족'] as const
  const inheritCuts: [number, string][] = [
    [100_000_000, '1억 이하'],
    [500_000_000, '1억 초과 ~ 5억'],
    [1_000_000_000, '5억 초과 ~ 10억'],
    [3_000_000_000, '10억 초과 ~ 30억'],
    [5_000_000_000, '30억 초과'],
  ]
  const old = defaultTaxUnits('metro', 'sme', 2025)
  const oldLocal = defaultTaxUnits('local', 'sme', 2025)
  const s25 = startupRates('outside', false)
  const s25o = startupRates('overcrowded', false)
  const s26 = startupRates('outside', true)
  const s26m = startupRates('metro', true)
  const s26o = startupRates('overcrowded', true)
  const three = (t: readonly number[]) => t.map((n) => n.toLocaleString('ko-KR')).join(' → ') + '만'
  return [
    {
      id: 'corp',
      title: '법인세',
      basis: '2026-01-01 이후 시작하는 사업연도 · 법인세법 §55 (2025년 12월 국회 통과)',
      rows: [
        ...corpCuts.map((label, i) => ({ label, value: `${pctOf(corp26[i])} (2025 사업연도까지 ${pctOf(corp25[i])})` })),
        { label: '지방소득세', value: '법인세의 10% 더 — 2억 이하 합계 11% · 2억 초과 22%' },
      ],
      usedIn: '세금 계산기 01 · 05 · 06 · 08 · 절세 설계 · 가지급금',
    },
    {
      id: 'income',
      title: '소득세 기본세율',
      basis: '2023년 귀속부터 · 소득세법 §55 (근로 · 종합 · 퇴직 같은 표)',
      rows: [
        ...bracketRows(INC9_BRACKETS),
        { label: '지방소득세', value: '소득세의 10% 더' },
        { label: '금융소득 종합과세', value: '이자 · 배당 합계 2,000만 넘는 부분 — 2,000만까지는 14%' },
        { label: '배당가산율(Gross-up)', value: `${pctOf(GROSSUP_RATE)} (2024년 이후 받는 배당 · 2027년 11% 안은 국회 전)` },
      ],
      usedIn: '세금 계산기 01 · 02 · 03(소득세) · 절세 설계',
    },
    {
      id: 'retire',
      title: '퇴직소득 — 근속연수공제 · 환산급여공제',
      basis: '2023-01-01 이후 퇴직 · 소득세법 §48 (2022년까지 퇴직은 그때 공제 · 세율로 따로 계산)',
      rows: [
        ...SERVICE_DED9.map(([from, base, per], i) => {
          const to = SERVICE_DED9[i + 1]?.[0]
          return { label: to ? `근속 ${from === 0 ? 1 : from + 1}~${to}년` : `근속 ${from + 1}년 이상`, value: from === 0 ? `1년마다 ${man(per)}` : `${man(base)} + ${from}년 넘는 1년마다 ${man(per)}` }
        }),
        ...CONV_DED9.map(([from, base, rate], i) => {
          const to = CONV_DED9[i + 1]?.[0]
          return { label: `환산급여 ${i === 0 ? `${man(to!)} 이하` : to ? `${man(from)} 초과 ~ ${man(to)}` : `${man(from)} 초과`}`, value: i === 0 ? '전액 공제' : `${man(base)} + 넘는 금액의 ${pctOf(rate)}` }
        }),
        { label: '근속연수', value: '날짜까지 보고 1년 미만은 1년' },
      ],
      usedIn: '세금 계산기 02 › 퇴직소득세 · 03 › 퇴직 · 절세 설계(퇴직금)',
    },
    {
      id: 'insurance',
      title: '4대보험(근로자 몫) · 근로소득 공제',
      basis: '2026년 요율',
      rows: [
        { label: '국민연금', value: `${pctOf(S_RATE.natPension)} · 기준소득 월 ${man(S_RATE.natPensionCap)}원 상한(2026년 7월부터 · 그 전 637만)` },
        { label: '건강보험', value: pctOf(S_RATE.health) },
        { label: '장기요양', value: `건강보험료의 ${pctOf(S_RATE.ltc)}` },
        { label: '고용보험(근로자)', value: `${pctOf(RATES_2026.employEach)} · 사업주는 고용안정 ${pctOf(RATES_2026.employStabilityEr)} 더(150인 미만)` },
        { label: '최저임금', value: `시간당 ${MIN_WAGE_2026.toLocaleString('ko-KR')}원(2026년)` },
        { label: '근로소득공제 한도', value: `${man(S_RATE.earnedCap)}원` },
        { label: '표준세액공제', value: `${man(S_RATE.stdCredit)}원` },
      ],
      usedIn: '세금 계산기 01(대표이사 급여) · 절세 설계(월급 바꾸기) · 고용지원금 › 급여 계산기',
    },
    {
      id: 'inherit',
      title: '상속세 · 증여세',
      basis: '상속세 및 증여세법 §26 · §53 · §53의2 — 2026년에도 그대로(2026년 세제개편안은 국회 전)',
      rows: [
        ...inheritCuts.map(([to, label], i) => {
          const prev = inheritCuts[i - 1]?.[0] ?? 0
          const rate = (inheritGiftTax(to) - inheritGiftTax(prev)) / (to - prev)
          return { label: `과세표준 ${label}`, value: pctOf(rate) }
        }),
        ...giftRels.map((r) => ({ label: `증여공제 · ${r}`, value: `${man(giftDeduction(r))}원(10년 합산)` })),
        { label: '상속 일괄공제', value: '5억(기초 2억 + 인적공제가 더 크면 그 금액)' },
        { label: '신고세액공제', value: '3%' },
      ],
      usedIn: '세금 계산기 04(상속세) · 05(증여세) · 절세 설계(증여 · 상속)',
    },
    {
      id: 'loan',
      title: '가지급금 · 비상장주식',
      basis: '법인세법 시행규칙(당좌대출이자율) · 상증법 시행령 §54~§56',
      rows: [
        { label: '가지급금 인정이자율', value: `${loanRate}% (당좌대출이자율)` },
        { label: '순손익 가중치', value: '최근 사업연도 3 · 2년 전 2 · 3년 전 1 (평균이 음수면 0)' },
        { label: '순손익가치 환원율', value: '10%' },
        { label: '일반법인 비중', value: '순손익 3 : 순자산 2' },
        { label: '부동산 50% 이상', value: '순손익 2 : 순자산 3 (80% 이상이면 순자산만)' },
        { label: '하한', value: '1주 순자산가치의 80%' },
      ],
      usedIn: '세금 계산기 07(가지급금) · 09(비상장주식) · 크레탑 주식가치 · 절세 설계',
    },
    {
      id: 'employ',
      title: '통합고용세액공제(중소기업 · 1명당)',
      basis: '조특법 §29의8 — 인원이 늘어난 해로 표를 고른다(2026-01-01 이후 시작하는 과세연도부터 개편)',
      rows: [
        { label: '2026~ 청년 등 · 수도권', value: three(SME_2026.metro.youth) },
        { label: '2026~ 청년 등 · 지방', value: three(SME_2026.local.youth) },
        { label: '2026~ 일반 · 수도권', value: three(SME_2026.metro.normal) },
        { label: '2026~ 일반 · 지방', value: three(SME_2026.local.normal) },
        { label: '2025년까지 늘어난 인원', value: `3년 같은 금액 — 청년 등 ${old.youth.toLocaleString('ko-KR')} · ${oldLocal.youth.toLocaleString('ko-KR')}만 / 일반 ${old.normal} · ${oldLocal.normal}만(수도권 · 지방)` },
      ],
      usedIn: '고용지원금 › 명부 진단 · 한 장 설계서(청년 · 만 60세 이상 채용) · 맞춤 추천 고용 카드',
      note: '청년 등 = 청년 · 장애인 · 만 60세 이상 · 경력단절. 2·3년 차는 인원을 유지할 때. 중견기업 개편 단가는 화면에서 직접 넣는다.',
    },
    {
      id: 'startup',
      title: '창업중소기업 세액감면(법인세 · 소득세 5년)',
      basis: '조특법 §6 · 시행령 §5 — 창업일로 표를 고른다',
      rows: [
        { label: '2025년까지 창업 · 과밀억제권역 밖', value: s25.text },
        { label: '2025년까지 창업 · 과밀억제권역', value: s25o.text },
        { label: '2026~ 수도권 밖 · 인구감소지역', value: s26.text },
        { label: '2026~ 수도권(과밀 · 인구감소지역 밖)', value: s26m.text },
        { label: '2026~ 과밀억제권역', value: s26o.text },
        { label: '창업 3년 안 벤처 확인(창업벤처)', value: `권역 · 나이 상관없이 ${VENTURE_STARTUP_RATE}%(확인받은 뒤 처음 소득이 난 해부터 5년 · §6②)` },
      ],
      usedIn: '창업감면 판정 · 상황 예시 · 한 장 설계서(창업 5년 안 채용) · 맞춤 추천',
      note: '수도권 인구감소지역 = 경기 가평 · 연천, 인천 강화 · 옹진(회사 주소로 저절로).',
    },
    {
      id: 'rnd',
      title: '연구개발비 세액공제(중소기업 당기분)',
      basis: '조특법 §10',
      rows: Object.entries(CATEGORY_RATES)
        .filter(([k]) => k !== '미정')
        .map(([k, v]) => ({ label: k, value: `${v}%${k === '일반 R&D' ? '' : ' 부터(분야 · 비중에 따라 더)'}` })),
      usedIn: '연구소 › 세액공제 예상 · 한 장 설계서(연구소 만들기) · 상황 예시',
    },
  ]
}
