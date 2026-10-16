/**
 * 상황 예시 카탈로그 — 무엇을 가정하는가(D-199 · 로드맵 5단계 '계산기는 상황 예시로').
 *
 * 대표 지시: 직접 계산도 되지만 상황 예시를 많이 두고, 한 번 누르면 그 업체 숫자로 설계까지.
 *  - 여기는 '가정' 만 적는다(모듈 엔진을 부르지 않는다) — 모듈 화면이 `?preset=아이디` 로 열릴 때 이 가정만 읽어 칸을 채운다.
 *  - 계산(업체 숫자 + 가정 → 결과)은 services/scenarios.ts 가 모듈 화면과 같은 엔진으로 한다.
 *  - 가정은 상황을 그리는 값만(예: '청년 1명 정규직 채용' · '운전자금') — 업체 숫자(직원 수 · 매출 · 설립일)는 업체 기록에서.
 */
import type { HiringAnswers } from '../tools/employment/lib/eligibility'
import type { DiagnosisInput } from '../tools/policyFunding/types'
import type { FormData as StartupForm } from '../tools/startupTax/types'

export type ScenarioModule = 'tax' | 'employment' | 'labcare' | 'startup-tax' | 'policy-funding'

export const SCENARIO_MODULE_LABEL: Record<ScenarioModule, string> = {
  tax: '절세',
  employment: '고용지원금',
  labcare: '연구소',
  'startup-tax': '창업감면',
  'policy-funding': '정책자금',
}

/** 모듈 화면 주소(업체 · 가정은 뒤에 붙인다) */
export const SCENARIO_MODULE_PATH: Record<ScenarioModule, string> = {
  tax: '/tools/tax',
  employment: '/tools/employment/diagnosis',
  labcare: '/tools/labcare/tax',
  'startup-tax': '/tools/startup-tax',
  'policy-funding': '/tools/policy-funding/diagnosis',
}

/** 연구소 세액공제 가정(원 · 연간) */
export interface LabPreset {
  payroll: number
  material: number
  other: number
  category: '일반 R&D' | '신성장·원천기술' | '국가전략기술' | '미정'
}

export type HiringPreset = Pick<HiringAnswers, 'situation' | 'cats' | 'specials' | 'age' | 'gender' | 'empType'>

export interface ScenarioPreset {
  id: string
  module: ScenarioModule
  /** 상황 한 줄(버튼 글) */
  title: string
  /** 이런 업체 · 이럴 때 */
  when: string
  /** 절세 — 원하는 결과 문장(절세 설계 '찾기' 와 같은 문장 읽기) */
  taxText?: string
  /** 절세 — 여러 해에 나눠 가져오기까지 펼친다 */
  taxSplit?: boolean
  /** 절세 — 이 방법들은 추천이 아니어도 나란히 보여 준다(자사주: 양도 vs 소각) */
  taxCompare?: Array<'shareSale' | 'shareBurn' | 'spouseBurn' | 'salary' | 'dividend' | 'retire' | 'mix'>
  hiring?: HiringPreset
  lab?: LabPreset
  startup?: Partial<Pick<StartupForm, 'startupForm' | 'region' | 'overconcentration'>>
  policy?: Partial<DiagnosisInput>
}

const p = (x: ScenarioPreset) => x

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  // 절세 11 — 절세 설계 '원하는 결과로 찾기' 와 같은 문장
  p({ id: 'tax-cash-1e', module: 'tax', title: '대표가 1억 가져오기', when: '이번에 목돈이 필요할 때 — 급여 · 배당 · 주식 · 퇴직금 중 가장 싼 길', taxText: '1억 현금화하고 싶어' }),
  p({ id: 'tax-cash-3e-split', module: 'tax', title: '3억을 여러 해에 나눠 가져오기', when: '한 번에 가져오면 세금이 클 때 — 1 · 2 · 3 · 5년 나눠 비교', taxText: '3억 현금화하고 싶어', taxSplit: true }),
  p({ id: 'tax-treasury', module: 'tax', title: '자사주로 1억 가져오기', when: '배당가능이익이 쌓여 있을 때 — 양도(보유)와 소각(의제배당) 비교', taxText: '자사주로 1억 가져오기', taxCompare: ['shareSale', 'shareBurn'] }),
  p({ id: 'tax-salary-rate', module: 'tax', title: '대표 급여 — 실효세율 20%에 맞추기', when: '급여를 얼마로 정할지 고민할 때', taxText: '급여 실효세율 20%로' }),
  p({ id: 'tax-salary-net', module: 'tax', title: '대표 급여 — 세후 월 800만원 받기', when: '손에 쥘 금액부터 정하고 싶을 때', taxText: '세후 월 800만원 받게 급여' }),
  p({ id: 'tax-gift-10', module: 'tax', title: '자녀에게 지분 10% 증여', when: '주식 가치가 오르기 전에 미리 넘길 때', taxText: '자녀에게 지분 10% 증여' }),
  p({ id: 'tax-gift-free', module: 'tax', title: '증여세 없이 자녀에게 줄 수 있는 만큼', when: '공제 한도 안에서 먼저 넘길 때', taxText: '세금 없이 자녀에게 증여' }),
  p({ id: 'tax-succession', module: 'tax', title: '가업승계 준비 — 증여특례 · 상속까지', when: '자녀에게 회사를 물려줄 계획이 있을 때', taxText: '가업승계 준비' }),
  p({ id: 'tax-inherit', module: 'tax', title: '지금 상속되면 상속세는?', when: '대표 연세가 있거나 재산이 클 때', taxText: '상속세 미리 보기' }),
  p({ id: 'tax-loan', module: 'tax', title: '가지급금 정리', when: '가지급금 이자 · 인정상여가 쌓일 때', taxText: '가지급금 정리' }),
  p({ id: 'tax-retire', module: 'tax', title: '대표 퇴직금 한도 · 세금', when: '퇴임 · 중간정산을 생각할 때', taxText: '퇴직금 얼마까지 되나' }),
  // 고용지원금 4 — 채용 진단(같은 엔진)
  p({ id: 'emp-youth', module: 'employment', title: '청년(만 29세) 정규직 1명 채용', when: '청년을 새로 뽑을 계획이 있을 때 — 채용 전에 참여신청', hiring: { situation: 'new', cats: ['청년'], specials: [], age: 29, gender: null, empType: '정규직' } }),
  p({ id: 'emp-senior', module: 'employment', title: '만 60세 이상 고령자 채용', when: '경력직 고령자를 뽑을 때', hiring: { situation: 'new', cats: ['고령자'], specials: [], age: 61, gender: null, empType: '정규직' } }),
  p({ id: 'emp-childcare', module: 'employment', title: '직원 육아휴직 · 대체인력 채용', when: '직원이 육아휴직을 쓰고 빈자리를 채울 때', hiring: { situation: 'childcare', cats: ['육아'], specials: ['육아휴직', '대체인력'], age: null, gender: null, empType: '정규직' } }),
  p({ id: 'emp-convert', module: 'employment', title: '계약직 → 정규직 전환', when: '계약직 직원을 정규직으로 바꿀 때', hiring: { situation: 'retain', cats: ['재직'], specials: ['정규직전환'], age: null, gender: null, empType: '계약직' } }),
  // 연구소 2 — 연구개발비 세액공제(같은 엔진)
  p({ id: 'lab-two', module: 'labcare', title: '연구원 2명(연봉 각 4,000만원)으로 연구소 설립', when: '연구소(전담부서)를 새로 만들 때 — 인건비 세액공제', lab: { payroll: 80_000_000, material: 0, other: 0, category: '일반 R&D' } }),
  p({ id: 'lab-material', module: 'labcare', title: '연구원 1명 + 시제품 재료비 3,000만원', when: '시제품 · 개발 재료비가 드는 해', lab: { payroll: 40_000_000, material: 30_000_000, other: 0, category: '일반 R&D' } }),
  // 창업감면 3 — 판정기(같은 엔진)
  p({ id: 'startup-new', module: 'startup-tax', title: '새로 창업한 경우 — 지금 감면 판정', when: '신규 창업(이어받지 않음) — 이 회사 숫자 그대로', startup: { startupForm: 'brand_new' } }),
  p({ id: 'startup-convert', module: 'startup-tax', title: '개인사업자 → 법인전환한 경우', when: '법인으로 바꿨을 때 — 감면 기간이 이어지는지', startup: { startupForm: 'conversion' } }),
  p({ id: 'startup-move', module: 'startup-tax', title: '본점을 과밀억제권역 밖으로 옮기면', when: '수도권 과밀억제권역 안 업체 — 이전하면 감면율이 바뀌는지', startup: { startupForm: 'brand_new', region: 'other_local', overconcentration: 'no' } }),
  // 정책자금 3 — 진단(같은 엔진)
  p({ id: 'policy-working', module: 'policy-funding', title: '운전자금(인건비 · 원자재) 필요', when: '매출은 있는데 운영 자금이 빠듯할 때', policy: { purpose: '운전자금' } }),
  p({ id: 'policy-facility', module: 'policy-funding', title: '기계 · 설비 사기(시설자금)', when: '설비 투자 견적이 있을 때', policy: { purpose: '시설자금', quoteReady: '있음' } }),
  p({ id: 'policy-hiring', module: 'policy-funding', title: '청년 채용 계획과 함께 신청', when: '자금과 함께 고용을 늘릴 때 — 가점', policy: { purpose: '운전자금', hiringPlan: '있음', youthEmployment: '예정' } }),
]

/* ---- D-211 모듈 화면 '넣은 가정' 칩 · [가정 빼기] ---- */

/** 칩 하나 — field 는 그 모듈 입력 칸 이름(고용지원금은 칸이 아니라 상황 전체라 ''). 절세는 상황 문장이 '원하는 것' 칸에 그대로 보여 칩을 두지 않는다 */
export interface PresetAssumption {
  field: string
  text: string
}

const man = (won: number) => `${Math.round(won / 10_000).toLocaleString('ko-KR')}만원`
// 고용지원금 진단 화면의 '1. 상황' 단추와 같은 말
const SITUATION_LABEL: Record<string, string> = { new: '신규 채용', retain: '재직자 처우개선', childcare: '출산·육아' }
const STARTUP_FORM_LABEL: Record<string, string> = { brand_new: '새로 창업', conversion: '개인 → 법인전환', acquisition: '사업 양수', reopen_same: '같은 업종 재창업', succession: '사업 승계' }
const REGION_LABEL: Record<string, string> = { seoul: '서울', gyeonggi_incheon: '경기/인천', metro_city: '지방 광역시', other_local: '기타 지방' }

/** 이 상황 예시가 넣은 가정 — 업체 숫자(직원 수 · 매출 · 주소)는 빼고, 상황을 그리는 값만 */
export function presetAssumptions(s: ScenarioPreset): PresetAssumption[] {
  const out: PresetAssumption[] = []
  if (s.lab) {
    if (s.lab.payroll > 0) out.push({ field: 'payroll', text: `인건비 ${man(s.lab.payroll)}` })
    if (s.lab.material > 0) out.push({ field: 'material', text: `재료비 ${man(s.lab.material)}` })
    if (s.lab.other > 0) out.push({ field: 'other', text: `기타 연구비 ${man(s.lab.other)}` })
    out.push({ field: 'category', text: s.lab.category })
  }
  if (s.startup) {
    if (s.startup.startupForm) out.push({ field: 'startupForm', text: STARTUP_FORM_LABEL[s.startup.startupForm] ?? s.startup.startupForm })
    if (s.startup.region) out.push({ field: 'region', text: `본점 ${REGION_LABEL[s.startup.region] ?? s.startup.region}` })
    if (s.startup.overconcentration === 'no') out.push({ field: 'overconcentration', text: '과밀억제권역 밖' })
    else if (s.startup.overconcentration === 'yes') out.push({ field: 'overconcentration', text: '과밀억제권역 안' })
  }
  if (s.policy) {
    if (s.policy.purpose) out.push({ field: 'purpose', text: s.policy.purpose })
    if (s.policy.quoteReady === '있음') out.push({ field: 'quoteReady', text: '설비 견적 있음' })
    if (s.policy.hiringPlan === '있음') out.push({ field: 'hiringPlan', text: '채용 계획 있음' })
    if (s.policy.youthEmployment === '예정') out.push({ field: 'youthEmployment', text: '청년 채용 예정' })
  }
  if (s.hiring) {
    const h = s.hiring
    const words = [SITUATION_LABEL[h.situation] ?? '', ...h.cats.filter((c) => c !== '육아' && c !== '재직'), ...h.specials, h.age !== null ? `만 ${h.age}세` : '', h.empType ?? '']
    for (const w of [...new Set(words)]) if (w) out.push({ field: '', text: w })
  }
  return out
}

/** 상황 예시가 넣은 칸 중 아직 그 값 그대로인 칸 — 그 뒤에 직접 고친 칸은 대표 값이라 빼지 않는다 */
export function presetFieldsKept<T extends object>(cur: T, applied: Partial<T>): (keyof T)[] {
  return (Object.keys(applied) as (keyof T)[]).filter((k) => String(cur[k] ?? '') === String(applied[k] ?? ''))
}

/** [가정 빼기] — 아직 가정 그대로인 칸만 상황 예시 전 값으로 되돌린다 */
export function withoutPresetFields<T extends object>(cur: T, applied: Partial<T>, before: Partial<T>): T {
  const next = { ...cur }
  for (const k of presetFieldsKept(cur, applied)) next[k] = before[k] as T[keyof T]
  return next
}

export function scenarioPreset(id: string | null | undefined): ScenarioPreset | null {
  if (!id) return null
  return SCENARIO_PRESETS.find((s) => s.id === id) ?? null
}

/** 모듈 화면 주소 — 업체 · 가정 */
export function scenarioPath(s: Pick<ScenarioPreset, 'id' | 'module'>, clientId: string): string {
  return `${SCENARIO_MODULE_PATH[s.module]}?client=${encodeURIComponent(clientId)}&preset=${encodeURIComponent(s.id)}`
}
