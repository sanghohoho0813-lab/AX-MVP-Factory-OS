/**
 * 업체 상세 '맞춤 추천' — 업체 기록 하나로 모든 모듈의 판정을 한 번에 (D-144).
 *
 * 대표 지시: 서류만 넣으면 지금까지 · 앞으로 도입할 모듈이 저절로 분석해서, 적합하거나 가능성 높은 것을
 * 모듈을 따로 열지 않아도 맞춤 추천 맨 앞에 보여 준다.
 *
 *  - 모듈마다 '판정 함수' 하나(INSIGHT_PROVIDERS). 새 모듈은 함수 하나를 더하면 맞춤 추천 · 다음 행동에 저절로 들어온다.
 *  - 각 판정은 모듈 화면이 쓰는 엔진 그대로다(정책자금 runDiagnosis · 창업감면 judge · 지원사업 matchesFor …) —
 *    맞춤 추천과 모듈 화면의 답이 다르지 않게.
 *  - 모르는 것은 짐작하지 않는다 — 판정에 꼭 필요한 정보가 없으면 '정보가 더 필요해요' 와 무엇이 필요한지.
 *  - 규칙 계산이다(AI · LLM 호출 없음). 저장하지 않고 볼 때마다 계산한다 — 업체 정보가 바뀌면 판정도 바로 바뀐다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { clientFacts, type ClientFacts } from '../tools/shared/clientPrefill'
import { usableFactValue } from './customerFacts'
import { latestToolResult, latestEmploymentRoster } from './toolResultGroups'
import { certInsightOf } from '../certification/integration/certInsight'
import { matchesFor, type GrantNotice } from './grants/grantMatch'
import { profileOfRecord, missingForMatch } from './grants/grantProfile'
import { runDiagnosis } from '../tools/policyFunding/diagnosis'
import { policyInputFromFacts } from '../tools/policyFunding/clientInput'
import { policyEvidence } from './policyEvidence'
import { policyApplyAsk, policyApplyMessage } from './policyApply'
import { judge } from '../tools/startupTax/lib/judgement'
import { EMPTY_FORM } from '../tools/startupTax/lib/formDefaults'
import { METRO_POP_DECLINE, startupCreditOverlap } from '../tools/startupTax/lib/rules'
import type { FormData as StartupForm, Region } from '../tools/startupTax/types'
import { placeOf } from './grants/grantMatch'
import { rosterSubsidyTotal } from '../tools/employment/lib/programs'
import { creditYears, headcountOf, headcountTaxCredit, headText, regionTypeOf, type RosterHeadcount } from '../tools/employment/lib/taxCredit'
import { josa } from '../lib/josa'
import { filledTaxProfile, loanPlan, retirePlan, salaryOrDividend, shareValueOf, viewProfile } from './taxPlan'

export type InsightTone = 'good' | 'maybe' | 'done' | 'need' | 'no'

export const INSIGHT_TONE_LABEL: Record<InsightTone, string> = {
  good: '가능성 높음',
  maybe: '검토해 볼 만함',
  done: '분석 있음',
  need: '정보가 더 필요해요',
  no: '지금은 어려움',
}

export interface Insight {
  /** 기능 키(요금제 권한 · 모듈 경로와 같다). 지원사업은 'grants' */
  key: string
  label: string
  tone: InsightTone
  headline: string
  detail: string
  /** 판정에 더 필요한 것(서류 · 정보 이름) */
  missing: string[]
  openPath: string
  openLabel: string
  /** 다음 행동으로 걸 만한 한 줄(없으면 null) */
  action: string | null
  /** D-191: 엔진이 이미 계산한 금액만(명부 진단 최대 지원금 · 연구소 세액공제 · 공고 금액 글) — 없으면 짐작하지 않는다 */
  amount?: string
  /** D-238: 이 업체 기록에 붙인 이 모듈의 가장 최근 결과 — 이미 해 본 것이면 '지난번 무엇 · 언제' 를 같이 보여 준다(판정 글과 같으면 없음) */
  last?: { label: string; at: string }
  /** D-313: 판정이 난 모듈의 '아직 받을 서류' 카톡 문구(정책자금 신청 서류) — 받을 것이 없으면 없음 */
  request?: { label: string; title: string; description: string; text: string; count: number }
}

/** 원 → '1,440만원' · 1억 이상은 '1.2억원' */
export function manwonText(won: number): string {
  if (!Number.isFinite(won) || won <= 0) return ''
  if (won >= 100_000_000) return `${(won / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원`
  return `${Math.round(won / 10_000).toLocaleString('ko-KR')}만원`
}

export interface InsightContext {
  record: ClientOpsRecord
  today: string
  facts: ClientFacts
  notices: readonly GrantNotice[]
  /** D-232 고객 관리 카드 띠처럼 판정 색만 필요할 때 — 무거운 계산(세금 계산기)은 건너뛴다(판정 색은 같다) */
  light?: boolean
}

type Provider = (c: InsightContext) => Insight | null

const q = (record: ClientOpsRecord) => `?client=${encodeURIComponent(record.id)}`

/* ------------------------------------------------------------------ */
/* 모듈별 판정                                                            */
/* ------------------------------------------------------------------ */

const grantsInsight: Provider = ({ record, today, notices }) => {
  const profile = profileOfRecord(record, today)
  const ms = matchesFor(notices, profile, today)
  const fit = ms.filter((m) => m.verdict === 'fit')
  const check = ms.filter((m) => m.verdict === 'check')
  // D-156: 도전 체크(지켜보는 중)한 공고 — 마감은 이것만 말한다
  const picked = record.fundingApplications.filter((a) => a.noticeId && a.status === 'watching')
  const core = [!profile.sido ? '회사 주소' : '', !profile.years ? '설립일' : '', !profile.industry.trim() ? '업종' : ''].filter(Boolean)
  const open = `/grants?view=clients&client=${encodeURIComponent(record.id)}`
  if (notices.length === 0) return { key: 'grants', label: '지원사업', tone: 'need', headline: '아직 받아 둔 공고가 없어요', detail: '기업마당 공고(매일 아침 9시)나 직접 넣은 공고가 있으면 이 업체 조건에 맞는 것을 바로 골라 드려요.', missing: [], openPath: open, openLabel: '지원사업 알림', action: null }
  if (fit.length > 0) {
    // D-156: 맞는 공고 수는 알리되 마감은 자동으로 띄우지 않는다. 대표가 '도전해 볼 만함' 으로 고른 공고만 마감을 말한다
    const next = [...picked].filter((a) => a.applyDueDate).sort((a, b) => a.applyDueDate.localeCompare(b.applyDueDate))[0]
    // D-191: 가장 맞는 공고의 금액 글 그대로(숫자를 지어내지 않는다)
    const amt = fit.map((m) => m.notice.amountText.trim()).find(Boolean)
    return {
      amount: amt ? `공고 금액 ${amt}` : undefined,
      key: 'grants',
      label: '지원사업',
      tone: 'good',
      headline: `가능성 높은 지원사업 ${fit.length}건${picked.length ? ` · 도전 체크 ${picked.length}건` : ''}`,
      detail: next
        ? `${next.programName} — 마감 ${Number(next.applyDueDate.slice(5, 7))}/${Number(next.applyDueDate.slice(8, 10))}`
        : picked.length
          ? picked[0].programName
          : '해 볼 만한 공고에 ☆ 도전해 볼 만함 을 누르면 그 마감만 챙겨 드려요',
      missing: missingForMatch(profile).filter((m) => m === '직원 수' || m === '매출'),
      openPath: open,
      openLabel: '맞는 공고 보기',
      action: null,
    }
  }
  if (core.length) return { key: 'grants', label: '지원사업', tone: 'need', headline: `${josa(core.join(' · '), '을/를')} 알면 맞는 공고를 골라요`, detail: `지금 확인 필요 ${check.length}건`, missing: core, openPath: open, openLabel: '지원사업 알림', action: null }
  if (check.length) return { key: 'grants', label: '지원사업', tone: 'maybe', headline: `확인하면 맞을 수 있는 공고 ${check.length}건`, detail: check[0].reasons.filter((r) => r.state === 'unknown').map((r) => r.label).join(' · ') + ' 확인', missing: [], openPath: open, openLabel: '확인할 공고 보기', action: null }
  return { key: 'grants', label: '지원사업', tone: 'no', headline: '지역 · 업력 · 업종까지 맞는 공고가 지금은 없어요', detail: '새 공고가 들어오면(매일 아침 9시) 여기에 바로 보여요.', missing: [], openPath: open, openLabel: '지원사업 알림', action: null }
}

/** D-311 '준비 서류 9/14 — 아직 사업계획서, 매출 증빙, 임대차계약서 외 2' (괄호 설명은 빼고 짧게) */
export function policyDocsLine(checks: readonly { label: string; status: string }[], show: boolean): string {
  if (!show || !checks.length) return ''
  const short = (l: string) => l.replace(/\s*\(.*\)\s*$/, '')
  const need = checks.filter((c) => c.status === '요청 필요').map((c) => short(c.label))
  const head = `준비 서류 ${checks.length - need.length}/${checks.length}`
  if (!need.length) return `${head} — 다 있어요`
  return `${head} — 아직 ${need.slice(0, 3).join(', ')}${need.length > 3 ? ` 외 ${need.length - 3}` : ''}`
}

const policyInsight: Provider = ({ record, facts, today }) => {
  const { input, missing, assumed } = policyInputFromFacts(facts)
  // D-306 서류함의 납세증명서 · 완납증명서 → 체납 '없음'(미확인이면 엔진이 '높음' 을 막는다) · 자본잠식 → 부채비율 '높음'
  const ev = policyEvidence(record, facts, today)
  const open = `/tools/policy-funding/diagnosis${q(record)}`
  const core = missing.filter((m) => m !== '매출')
  if (core.length) return { key: 'policy-funding', label: '정책자금', tone: 'need', headline: `${josa(core.join(' · '), '을/를')} 알면 바로 판정해요`, detail: '사업자등록증을 올리면 설립일 · 업종이 저절로 들어가요.', missing: core, openPath: open, openLabel: '정책자금 진단', action: null }
  const r = runDiagnosis({ ...input, ...ev.input })
  const level = r.likelihoodLevel ?? r.headline?.level ?? '보통'
  // D-215: 직원 수를 모르면 1~4명(소상공인)으로 계산된다 — '높음' 으로 단정하지 않고 가정이라고 알린다
  const noHeadcount = assumed.includes('직원 수')
  const tone: InsightTone = level === '높음' ? (noHeadcount ? 'maybe' : 'good') : level === '보통' ? 'maybe' : 'no'
  const why = r.headline?.reasons[0] ?? r.nextAction
  const more = [missing.includes('매출') ? '매출' : '', noHeadcount ? '직원 수' : ''].filter(Boolean)
  // D-311 준비 서류 — 서류함에 있는 것은 '확보'. 서류함에 하나라도 있을 때만(새 업체에 '1/14' 를 보이지 않게)
  const docsLine = policyDocsLine(r.documentChecks ?? [], (ev.input.haveDocs ?? []).length > 0)
  // D-313 판정이 났으면(볼 만함 · 바로 제안) 아직 받을 신청 서류를 카톡 문구로
  const ask = tone === 'good' || tone === 'maybe' ? policyApplyAsk(r.documentChecks ?? [], ev.want) : null
  const askText = ask ? policyApplyMessage(record, ask, r.topAgency) : ''
  return {
    key: 'policy-funding',
    label: '정책자금',
    tone,
    headline: `진행 가능성 ${level} · 추천 기관 ${r.topAgency}`,
    detail: [
      more.length ? `${why} · ${josa(more.join(' · '), '을/를')} 알면 더 정확해요${noHeadcount ? '(지금은 직원 1~4명 · 소상공인으로 가정)' : ''}` : why,
      ...ev.notes.slice(0, 3),
      docsLine,
    ]
      .filter(Boolean)
      .join(' · '),
    missing: [
      ...(missing.includes('매출') ? ['매출(재무제표 · 크레탑)'] : []),
      ...(noHeadcount ? ['직원 수(4대보험 가입자 명부)'] : []),
      // 체납을 확인할 서류 — 없으면 엔진이 가능성을 '높음' 으로 올리지 않는다
      ...(ev.want.length ? [`체납 확인 — ${ev.want.join(' · ')}`] : []),
    ],
    openPath: open,
    openLabel: '정책자금 진단 열기',
    action: tone === 'good' || tone === 'maybe' ? `정책자금 상담 — ${r.topAgency} 쪽으로 준비` : null,
    ...(ask && askText
      ? {
          request: {
            label: `아직 받을 서류 ${ask.items.length}가지 요청 문구`,
            title: '정책자금 신청 서류 요청 문구',
            description: `서류함에 이미 있는 서류는 뺐습니다. ${ask.ours.length ? `${ask.ours.join(' · ')}는 저희가 함께 쓰는 것이라 넣지 않았어요. ` : ''}어디서 떼는지 함께 적었습니다.`,
            text: askText,
            count: ask.items.length,
          },
        }
      : {}),
  }
}

/*
 * D-209 수도권 과밀억제권역 — 수도권정비계획법 시행령 [별표 1] 제1호(조세특례제한법 창업감면이 이 구역을 쓴다).
 *  경기: 의정부 · 구리 · 하남 · 고양 · 수원 · 성남 · 안양 · 부천 · 광명 · 과천 · 의왕 · 군포 — 시 전체가 안.
 *        남양주(호평 · 평내 등 일부 동만) · 시흥(반월특수지역 제외)은 동까지 봐야 해 '모름'. 그 밖의 시 · 군은 밖.
 *  인천: 강화 · 옹진군은 밖. 서구(일부 동 · 청라) · 연수구(송도) · 중구(영종) · 남동구(국가산업단지)는 경제자유구역 · 산업단지가 빠져
 *        동 · 번지까지 봐야 해 '모름'. 동구 · 미추홀구 · 부평구 · 계양구는 안.
 * 예전에는 경기 · 인천을 모두 '모름' 으로 두어 상황 예시가 성남 · 인천 업체에도 '이미 밖' 이라고 말했다.
 */
const GG_OVER = ['의정부시', '구리시', '하남시', '고양시', '수원시', '성남시', '안양시', '부천시', '광명시', '과천시', '의왕시', '군포시']
const GG_PART = ['남양주시', '시흥시']
const IC_OUT = ['강화군', '옹진군']
const IC_PART = ['서구', '연수구', '중구', '남동구']
function metroOver(sido: string, city: string): StartupForm['overconcentration'] {
  if (!city) return 'unknown'
  if (sido === '경기') return GG_OVER.includes(city) ? 'yes' : GG_PART.includes(city) ? 'unknown' : 'no'
  return IC_OUT.includes(city) ? 'no' : IC_PART.includes(city) ? 'unknown' : 'yes'
}

/** 중소기업 확인 — 회사 정보 '중소기업 확인' 칸 · 인증 칸 · 받은 확인서. 모르면 false(가정은 부르는 쪽에서 ★ 로) */
export function smeConfirmed(record: ClientOpsRecord): boolean {
  const re = /중소기업\s*(확인|기준)/
  if ((record.customFields ?? []).some((f) => re.test(`${f.label} ${f.value}`))) return true
  if (re.test(usableFactValue(record, 'certifications'))) return true
  return !!record.documents?.smeCertificate?.received
}

/** D-318 popDecline — 수도권 인구감소지역(가평 · 연천 · 강화 · 옹진)인지. 2026년 이후 창업 감면율을 가른다(시 · 군을 모르면 '') */
export function startupRegion(address: string): { region: Region | ''; over: StartupForm['overconcentration']; popDecline: NonNullable<StartupForm['popDecline']> } {
  const { sido, city } = placeOf(address)
  if (sido === '서울') return { region: 'seoul', over: 'yes', popDecline: 'no' }
  if (sido === '경기' || sido === '인천') return { region: 'gyeonggi_incheon', over: metroOver(sido, city), popDecline: !city ? '' : METRO_POP_DECLINE.includes(city) ? 'yes' : 'no' }
  if (['부산', '대구', '광주', '대전', '울산'].includes(sido)) return { region: 'metro_city', over: 'no', popDecline: '' }
  if (sido) return { region: 'other_local', over: 'no', popDecline: '' }
  return { region: '', over: '', popDecline: '' }
}

const startupInsight: Provider = ({ record, today, facts }) => {
  const open = `/tools/startup-tax${q(record)}`
  // 창업 5년이 지났으면 대표 나이와 상관없이 감면 기간 밖 — 묻지 않고 바로 말한다
  if (facts.establishedAt && facts.months !== null && facts.months >= 60) return { key: 'startup-tax', label: '창업감면', tone: 'no', headline: '창업 5년이 지나 감면 기간이 끝났을 가능성이 커요', detail: `설립 ${facts.establishedAt}`, missing: [], openPath: open, openLabel: '창업감면 판정', action: null }
  const missing = [!facts.establishedAt ? '설립일(창업일)' : '', !facts.representativeBirth ? '대표 생년월일' : ''].filter(Boolean)
  if (missing.length) return { key: 'startup-tax', label: '창업감면', tone: 'need', headline: `${josa(missing.join(' · '), '을/를')} 알면 판정해요`, detail: '사업자등록증 · 대표 신분 정보로 채워져요.', missing, openPath: open, openLabel: '창업감면 판정', action: null }
  const { region, over, popDecline } = startupRegion(facts.address)
  const form: StartupForm = {
    ...EMPTY_FORM,
    popDecline,
    ventureDate: facts.ventureConfirmedAt ?? '',
    businessType: facts.businessType,
    birthDate: facts.representativeBirth,
    startupDate: facts.establishedAt,
    industry: (facts.industry || '') as StartupForm['industry'],
    region,
    overconcentration: over,
  }
  const r = judge(form, new Date(`${today}T00:00:00`))
  if (r.notice) return { key: 'startup-tax', label: '창업감면', tone: 'need', headline: r.notice, detail: '', missing: [], openPath: open, openLabel: '창업감면 판정', action: null }
  const tone: InsightTone = r.overall === 'good' ? 'good' : r.overall === 'bad' ? 'no' : 'maybe'
  return {
    key: 'startup-tax',
    label: '창업감면',
    tone,
    headline: r.oneLineConclusion,
    // D-318 감면율 한 줄을 먼저 — 상황 예시 · 한 장 설계서 · 판정 화면과 같은 값
    detail: [r.taxRate.line, r.keyChecks[0] ?? r.reasons[0] ?? ''].filter(Boolean).join(' · '),
    // 창업 형태(신규 · 승계)는 기록에 없다 — 판정기에서 물어본다
    missing: ['창업 형태(새로 창업 · 이어받기)'],
    openPath: open,
    openLabel: '창업감면 판정 열기',
    action: tone === 'good' ? '창업감면 — 감면 신청 · 경정청구 확인' : null,
  }
}

/**
 * D-302 명부 날짜로 센 인원(서류 올리기 · 명부 화면이 붙임) → 통합고용세액공제. 단가는 볼 때마다 지금 업체 주소 · 중소기업 확인으로.
 * 작년보다 줄었으면 공제 없음 · 같으면 '1명 늘면' 힌트. 직원 300명 이상인데 중소기업 확인이 없으면 단가를 정하지 않는다.
 */
export function rosterCredit(record: ClientOpsRecord, facts: ClientFacts, hc: RosterHeadcount): { won: number; threeYear: number; line: string; basis: string; assumptions: string[] } | null {
  const sme = smeConfirmed(record)
  if (!sme && facts.employeeCount !== null && facts.employeeCount >= 300) return null
  const sido = placeOf(facts.address).sido
  const region = regionTypeOf(sido || null)
  const { units, estimate } = headcountTaxCredit(hc, region, 'sme')
  const p = `${hc.prev.year}년 평균 ${headText(hc.prev.total)}명`
  const c = `${hc.cur.year}년 ${hc.cur.actualMonths < 12 ? '예상 ' : ''}${headText(hc.cur.total)}명`
  const assumptions = [
    ...(hc.basis === 'current' ? ['지금 직원만 있는 명부 — 작년에 그만둔 사람이 있으면 공제가 줄어요'] : []),
    ...(sme ? [] : ['중소기업으로 보고 계산(★ 중소기업 확인서)']),
    ...(region ? [] : ['주소를 몰라 수도권 단가(더 낮은 쪽)로 계산']),
  ]
  const won = estimate.creditTotal ?? 0
  // D-330 2026년 개편 — 1년 차는 작고 2 · 3년 차가 크다. 인원을 유지할 때 3년 합계(개편표일 때만 · 예전 표는 3년 같은 금액이라 따로 안 적음)
  const threeYear = units.table === 2026 && won > 0 ? creditYears(units, estimate.incYouth ?? 0, estimate.incNormal ?? 0).reduce((a, b) => a + b, 0) : 0
  // basis: 금액을 제목 · 금액 줄이 이미 말할 때 설명 칸에 쓸 '어떻게 셌나' 만
  const basis = `${p} → ${c} · 명부 날짜로 셈 · 세무사 확인`
  if (won > 0) return { won, threeYear, line: `통합고용세액공제 예상 ${threeYear ? `1년 차 약 ${manwonText(won)} · 3년 약 ${manwonText(threeYear)}` : `약 ${manwonText(won)}`}(${basis})`, basis, assumptions }
  if (hc.cur.total < hc.prev.total) return { won: 0, threeYear: 0, line: `${c} — ${p}보다 적어 통합고용세액공제는 없어요 · 지난해 공제를 받았다면 추징 확인`, basis, assumptions }
  // D-319 2026년부터 늘어난 인원은 1 · 2 · 3년 차 단가가 다르다
  const per = units.table === 2026 ? `1년 차 약 ${manwonText(units.youth * 10_000)}(유지하면 2년 차 ${manwonText(units.schedule.youth[1] * 10_000)} · 3년 차 ${manwonText(units.schedule.youth[2] * 10_000)})` : `1년에 약 ${manwonText(units.youth * 10_000)}`
  return { won: 0, threeYear: 0, line: `${c} — ${p}와 같아요 · 청년 등 1명 늘면 ${per} 덜 내요`, basis, assumptions }
}

const employmentInsight: Provider = ({ record, facts }) => {
  const open = `/tools/employment/roster${q(record)}`
  const roster = latestEmploymentRoster(record)
  if (!roster) return { key: 'employment', label: '고용지원금', tone: 'need', headline: '4대보험 가입자 명부를 올리면 직원별 지원금 후보를 바로 봐요', detail: '청년 · 고령 · 신규 입사 후보와 청년도약 참여신청 기한, 통합고용세액공제 예상까지.', missing: ['4대보험 가입자 명부'], openPath: open, openLabel: '명부 진단', action: null }
  const hard = roster.deadlines.filter((d) => d.hard).length
  // D-191: 명부 진단이 계산한 최대 예상 지원금 — 저장된 값, 옛 결과는 요약 글의 '최대 n만원'
  const saved = (roster.data as { subsidyTotal?: unknown } | null)?.subsidyTotal
  const fromText = /최대\s*([\d,]+)\s*만원/.exec(roster.summary)?.[1]
  const old = typeof saved === 'number' && saved > 0 ? saved : fromText ? Number(fromText.replace(/,/g, '')) * 10_000 : 0
  // D-334 저장된 후보 수가 있으면 지금 규칙표 · 회사 지역 금액으로 다시 센다(예전 결과의 계속고용 720만이 남지 않게).
  //        주소를 모르면(수도권 금액으로 셈) 명부 화면에서 고른 소재지 금액이 더 클 수 있어 둘 중 큰 쪽
  const rows = (roster.data as { subsidySummary?: unknown } | null)?.subsidySummary
  const empSido = placeOf(facts.address).sido
  const fresh = Array.isArray(rows) ? rosterSubsidyTotal(rows as { key: string; candidateCount?: number }[], empSido ? (['서울', '경기', '인천'].includes(empSido) ? '수도권' : '비수도권') : null) : 0
  const total = fresh > 0 ? (empSido ? fresh : Math.max(fresh, old)) : old
  // 통합고용세액공제 — 명부 화면에서 사람이 넣어 계산한 값이 먼저(D-232), 없으면 명부 날짜로 센 인원으로(D-302). 둘 다 없으면 새로 들어온 직원 수로 '점검해 볼 만함'
  const data = roster.data as { estimate?: { computable?: unknown; creditTotal?: unknown; incTotal?: unknown }; counts?: { newHireCount?: unknown }; headcount?: unknown } | null
  const typed = data?.estimate?.computable === true && typeof data.estimate.creditTotal === 'number' && data.estimate.creditTotal > 0 ? data.estimate.creditTotal : 0
  const hc = typed > 0 ? null : headcountOf(data?.headcount)
  const fromRoster = hc ? rosterCredit(record, facts, hc) : null
  const credit = typed > 0 ? typed : (fromRoster?.won ?? 0)
  const newHires = typeof data?.counts?.newHireCount === 'number' ? data.counts.newHireCount : 0
  const candidates = roster.verdict === 'candidates'
  // 지원금 후보가 없고 세액공제만 있으면 제목 · 금액 줄이 금액을 말한다 — 설명 칸은 어떻게 셌는지만(같은 금액을 세 번 쓰지 않게)
  const creditHeadline = !candidates && credit > 0
  const creditLine =
    typed > 0
      ? creditHeadline
        ? '명부 진단 화면에서 계산한 값 · 1차 추정 · 세무사 확인'
        : `통합고용세액공제 예상 약 ${manwonText(typed)}(1차 추정 · 세무사 확인)`
      : fromRoster
        ? [creditHeadline ? fromRoster.basis : fromRoster.line, ...fromRoster.assumptions.slice(0, 1)].join(' · ')
        : newHires > 0
          ? `최근 1년 새로 들어온 직원 ${newHires}명 — 전년 직원 수를 넣으면 통합고용세액공제도 계산해요`
          : ''
  // D-330 개편표면 '1년 차 · 3년' 을 같이 — 1년 차만 보면 혜택이 작아 보였다
  const three = typed > 0 ? 0 : (fromRoster?.threeYear ?? 0)
  const creditText = three > 0 ? `세액공제 1년 차 약 ${manwonText(credit)} · 3년 약 ${manwonText(three)}` : `세액공제 약 ${manwonText(credit)}`
  const amount =
    candidates && total > 0 ? `최대 ${manwonText(total)} 검토(1차 추정)${credit > 0 ? ` + ${creditText}` : ''}` : credit > 0 ? `${creditText}(1차 추정)` : undefined
  const first = hard ? `청년도약 참여신청 기한 ${hard}명 — 지나면 신청 불가` : (roster.summary.split('\n')[1] ?? '').replace(/^·\s*/, '')
  return {
    amount,
    key: 'employment',
    label: '고용지원금',
    // 지원금 후보가 없어도 세액공제가 나오는 업체는 제안할 거리가 있다(검토해 볼 만함)
    tone: candidates ? 'good' : credit > 0 ? 'maybe' : 'no',
    headline: creditHeadline ? '직원이 늘어 통합고용세액공제를 받을 수 있어 보여요' : roster.verdictLabel || roster.title,
    // D-336 2025년 이후 창업이면 세액공제와 창업감면을 같은 해 함께 못 받을 수 있다 — 금액을 볼 때 같이 알린다
    detail: [first.startsWith('[') ? '' : first, creditLine, credit > 0 && startupCreditOverlap(facts.establishedAt) === 'excluded' ? '2025년 이후 창업 — 창업감면과 같은 해 함께 못 받을 수 있어 큰 쪽 선택(★ 세무사)' : ''].filter(Boolean).join(' · '),
    missing: [],
    openPath: open,
    openLabel: '명부 진단 보기',
    action: candidates ? `고용지원금 — ${roster.verdictLabel}` : credit > 0 ? '통합고용세액공제 — 세무사와 신고 확인' : null,
  }
}

/** D-191 연구소 도구가 붙인 가장 최근 세액공제 계산(연간 · 원) — 없으면 0 */
function labCreditOf(record: ClientOpsRecord): number {
  for (const r of record.toolResults) {
    if (r.toolKey !== 'labcare') continue
    const d = r.data as { kind?: unknown; estimate?: { annual?: unknown } } | null
    if (d?.kind === 'tax' && typeof d.estimate?.annual === 'number' && d.estimate.annual > 0) return d.estimate.annual
  }
  return 0
}

const labInsight: Provider = ({ record, facts }) => {
  const open = `/tools/labcare${q(record)}`
  const lab = usableFactValue(record, 'researchLab')
  if (lab) {
    // D-232: 연구소가 있으면 '연구개발비 세액공제를 챙겼나' 가 다음 제안이다(못 받은 해는 경정청구 5년) — 계산이 붙어 있으면 그 금액
    const credit = labCreditOf(record)
    const taxOpen = `/tools/labcare/tax${q(record)}`
    if (credit > 0) return { key: 'labcare', label: '연구소', tone: 'good', headline: `연구소가 있어요 — 연구개발비 세액공제 연간 약 ${manwonText(credit)}`, detail: `${String(lab)} · 신고 때 빠졌으면 지난 5년 경정청구 확인(★ 세무사)`, missing: [], openPath: taxOpen, openLabel: '세액공제 계산 보기', action: '연구소 — 연구개발비 세액공제 챙기기', amount: `세액공제 연간 약 ${manwonText(credit)}` }
    return { key: 'labcare', label: '연구소', tone: 'maybe', headline: '연구소(전담부서)가 있어요 — 연구개발비 세액공제를 챙겼는지 볼 때', detail: `${String(lab)} · 연구원 인건비를 넣으면 연간 공제액을 바로 계산해요`, missing: ['연구원 인건비(연)'], openPath: taxOpen, openLabel: '세액공제 계산', action: '연구소 — 연구개발비 세액공제 확인' }
  }
  const last = latestToolResult(record, 'labcare')
  if (last) {
    // D-191: 세액공제 계산 결과가 붙어 있으면 연간 금액
    const d = last.data as { kind?: unknown; estimate?: { annual?: unknown } } | null
    const annual = d?.kind === 'tax' && typeof d.estimate?.annual === 'number' ? d.estimate.annual : 0
    return { key: 'labcare', label: '연구소', tone: /가능|추천/.test(last.verdictLabel) ? 'good' : 'maybe', headline: last.verdictLabel || last.title, detail: last.summary.split('\n')[0] ?? '', missing: [], openPath: open, openLabel: '연구소 진단 보기', action: null, amount: annual > 0 ? `세액공제 연간 약 ${manwonText(annual)}` : undefined }
  }
  const emp = facts.employeeCount
  return {
    key: 'labcare',
    label: '연구소',
    tone: emp !== null && emp >= 2 ? 'maybe' : 'need',
    headline: emp !== null && emp >= 2 ? `직원 ${emp}명 — 연구 인력 · 공간이 있으면 연구소(전담부서) 설립을 검토해 볼 만해요` : '직원 수 · 연구 인력을 알면 연구소 설립 가능성을 봐요',
    detail: '연구 인력의 학위 · 경력과 독립된 연구 공간이 필요해요.',
    missing: ['연구 인력(학위 · 경력)', '연구 공간'],
    openPath: open,
    openLabel: '연구소 설립 가능성',
    action: null,
  }
}

const cretopInsight: Provider = ({ record }) => {
  const open = `/tools/cretop${q(record)}`
  const last = latestToolResult(record, 'cretop')
  if (!last) return { key: 'cretop', label: '크레탑', tone: 'need', headline: '크레탑 기업종합보고서를 올리면 재무 · 신용 · 영업 전략을 바로 봐요', detail: '매출 · 이익 · 부채도 회사 정보에 저절로 들어가요.', missing: ['크레탑 기업종합보고서'], openPath: open, openLabel: '크레탑 분석기', action: null }
  return { key: 'cretop', label: '크레탑', tone: 'done', headline: last.verdictLabel || last.title, detail: last.summary.split('\n').find((l) => l.trim()) ?? '', missing: [], openPath: last.openPath || open, openLabel: '크레탑 분석 보기', action: null }
}

/*
 * D-232 절세 — 절세 설계 엔진(세금 계산기 9종 식 그대로)으로 업체 숫자에서 바로 나오는 금액까지.
 *  - 가지급금 잔액이 있으면: 07 가지급금 계산기로 해마다 손해 → 가능성 높음(지금 새는 돈).
 *  - 대표 취임일 · 월 급여가 있으면: 02 퇴직급여 한도 · 03 퇴직소득세 → 검토해 볼 만함.
 *  - D-233 월 급여 · 주주명부 · 배당 가능한 이익이 있으면: 세후 1억을 더 가져갈 때 급여 올리기 vs 배당(01 · 03 식) — 차이 100만원 넘을 때만.
 *  - 숫자가 없으면 짐작하지 않는다(예전처럼 '찾아볼 수 있어요' + 받을 것).
 *  - light(고객 관리 카드 띠) — 판정 색만 필요해 계산은 건너뛴다(가지급금이 있으면 가능성 높음 · 같은 답).
 */
/** D-233 급여 vs 배당을 견줄 금액 — 상황 예시 '대표가 1억 가져오기'(tax-cash-1e)와 같은 세후 1억 */
const PAY_COMPARE = 100_000_000

const taxInsight: Provider = ({ record, today, light }) => {
  const open = `/tools/tax${q(record)}`
  const hasShares = record.shareholderRegister.length > 0
  const filled = Object.values(record.taxProfile ?? {}).filter((v) => String(v).trim() !== '').length
  if (!hasShares && filled === 0) return { key: 'tax', label: '절세 설계', tone: 'need', headline: '주주명부 · 대표 급여를 알면 급여 · 배당 · 퇴직금 절세를 계산해요', detail: '', missing: ['주주명부', '대표 급여'], openPath: open, openLabel: '절세 설계', action: null }
  const { profile, filledKeys } = filledTaxProfile(record, today)
  const p = viewProfile(profile)
  const preset = (id: string) => `${open}&preset=${id}`
  const found: { tone: InsightTone; headline: string; short: string; amount: string; action: string | null; openPath: string; openLabel: string; note: string }[] = []
  if (p.loanBalance > 0) {
    const loan = light ? null : loanPlan(p)
    const year = loan?.ok ? loan.yearLoss : 0
    found.push({
      tone: 'good',
      // 금액은 바로 아래 초록 줄(amount)에 — 머리글에 같은 숫자를 두 번 쓰지 않는다
      headline: year > 0 ? `가지급금 ${manwonText(p.loanBalance)} — 그대로 두면 인정이자 · 세금으로 해마다 새요` : `가지급금 ${manwonText(p.loanBalance)} — 정리하는 길을 찾아볼 때`,
      short: year > 0 ? `가지급금 해마다 약 ${manwonText(year)} 손해` : `가지급금 ${manwonText(p.loanBalance)}`,
      amount: year > 0 ? `해마다 약 ${manwonText(year)} 손해` : '',
      action: '가지급금 정리 — 갚는 가장 싼 길 찾기',
      openPath: preset('tax-loan'),
      openLabel: '가지급금 정리 설계',
      note: p.monthlySalary > 0 ? '' : '대표 급여를 모르면 한계세율을 낮게 잡아 손해가 작게 나와요',
    })
  }
  if (!light && p.ceoStartDate && p.monthlySalary > 0) {
    const ret = retirePlan(p, today)
    if (ret.ok && ret.limit > 0)
      found.push({
        tone: 'maybe',
        headline: `대표 퇴직금 — 지금 한도까지 받으면 세후 약 ${manwonText(ret.net)}`,
        short: `퇴직금 한도 약 ${manwonText(ret.limit)}`,
        amount: `퇴직금 한도 약 ${manwonText(ret.limit)}`,
        action: null,
        openPath: preset('tax-retire'),
        openLabel: '퇴직금 설계',
        note: filledKeys.includes('ceoStartDate') ? '취임일은 설립일로 보고 계산' : '',
      })
  }
  // D-233 급여 vs 배당 — 상황 예시 '대표가 1억 가져오기' 와 같은 세후 1억 · 같은 경로 식. 지금 급여 · 주주명부 · 배당 가능한 이익을 알 때만(짐작하지 않음)
  if (!light && p.monthlySalary > 0 && hasShares && p.retainedEarnings > 0) {
    const reg = record.shareholderRegister
    const { salary, dividend } = salaryOrDividend(p, reg, shareValueOf(p, reg), PAY_COMPARE, today)
    const gap = salary.ok && dividend.ok ? Math.abs(salary.netBurden - dividend.netBurden) : 0
    if (gap >= 1_000_000) {
      const cheaper = dividend.netBurden < salary.netBurden ? '배당' : '급여'
      const subj = cheaper === '배당' ? '배당이' : '급여가'
      found.push({
        tone: 'maybe',
        headline: `대표가 1억 더 가져간다면 — ${cheaper} 쪽이 세금이 덜 나와요`,
        short: `세후 1억이면 ${subj} 약 ${manwonText(gap)} 덜 냄`,
        amount: `세후 1억 기준 약 ${manwonText(gap)} 덜 냄`,
        action: null,
        openPath: preset('tax-cash-1e'),
        openLabel: '1억 가져오기 설계',
        note: `급여 올리기 순부담 ${manwonText(salary.netBurden) || '0원'} · 배당 순부담 ${manwonText(dividend.netBurden) || '0원'} · 주식 · 퇴직금까지 견주면 더 싼 길이 있을 수 있어요`,
      })
    }
  }
  const top = found[0]
  if (!top) {
    const lack = [!hasShares ? '주주명부' : '', p.monthlySalary > 0 ? '' : '대표 급여'].filter(Boolean)
    // light(카드 띠)는 계산을 건너뛰었다 — 계산할 숫자(취임일 · 급여 / 급여 · 주주명부 · 배당 가능한 이익)가 있으면 전체 판정과 같은 색
    const skipped = !!light && ((!!p.ceoStartDate && p.monthlySalary > 0) || (p.monthlySalary > 0 && hasShares && p.retainedEarnings > 0))
    // D-238: 계산해 낸 것이 없는데 주주명부나 대표 급여까지 없으면 '검토해 볼 만함' 이 아니라 '정보가 더 필요해요' — 근거 없이 먼저 제안할 것에 올리지 않는다
    return { key: 'tax', label: '절세 설계', tone: lack.length && !skipped ? 'need' : 'maybe', headline: `절세 현황 ${filled}칸${hasShares ? ` · 주주 ${record.shareholderRegister.length}명` : ''} — ${lack.length ? `${josa(lack.join(' · '), '을/를')} 알면 절세 금액을 계산해요` : '원하는 결과로 절세 방법을 찾아볼 수 있어요'}`, detail: '', missing: lack, openPath: open, openLabel: '절세 설계 열기', action: null }
  }
  const others = found.slice(1).map((f) => f.short)
  return {
    key: 'tax',
    label: '절세 설계',
    tone: top.tone,
    headline: top.headline,
    detail: [others.length ? `그 밖에 · ${others.join(' · ')}` : '', top.note, '세금 계산기 식 그대로 · 실행 전 세무사 검토'].filter(Boolean).join(' · '),
    missing: [!hasShares ? '주주명부' : '', p.monthlySalary > 0 ? '' : '대표 급여'].filter(Boolean),
    openPath: top.openPath,
    openLabel: top.openLabel,
    action: top.action,
    amount: top.amount || undefined,
  }
}

/**
 * 맞춤 추천에 들어오는 모듈 — 위에서부터. 새 모듈을 들이면 판정 함수를 여기에 더한다.
 * (요금제에 없는 모듈은 화면이 뺀다 — 키가 기능 권한 키와 같다)
 */
// D-170: 기업인증 — 기업인증 Core 판정 그대로(업체 사정 칩은 화면에서 더 정확해진다)
const certInsight: Provider = ({ record, today }) => {
  const c = certInsightOf(record, today)
  return { key: 'cert-os', label: '기업인증', tone: c.tone, headline: c.headline, detail: c.detail, missing: c.missing, openPath: `/tools/cert-os${q(record)}`, openLabel: '인증 한눈에', action: null }
}

export const INSIGHT_PROVIDERS: { key: string; run: Provider }[] = [
  { key: 'grants', run: grantsInsight },
  { key: 'policy-funding', run: policyInsight },
  { key: 'employment', run: employmentInsight },
  { key: 'startup-tax', run: startupInsight },
  { key: 'labcare', run: labInsight },
  { key: 'cert-os', run: certInsight },
  { key: 'cretop', run: cretopInsight },
  { key: 'tax', run: taxInsight },
]

const TONE_RANK: Record<InsightTone, number> = { good: 0, maybe: 1, done: 2, need: 3, no: 4 }

/** D-238: 붙인 결과가 있으면 '지난번' 한 줄 — 판정 글이 이미 그 결과(크레탑 · 연구소 진단)면 같은 말을 두 번 쓰지 않는다 */
function withLast(ins: Insight, record: ClientOpsRecord): Insight {
  if (ins.key === 'grants') return ins
  const last = latestToolResult(record, ins.key)
  if (!last) return ins
  const label = (last.verdictLabel || last.title).trim()
  if (!label || label === ins.headline.trim()) return ins
  return { ...ins, last: { label, at: last.createdAt } }
}

/** 업체 하나 → 모듈별 판정(좋은 것 먼저). 한 모듈이 실패해도 나머지는 보인다 */
export function buildInsights(record: ClientOpsRecord, today: string, notices: readonly GrantNotice[], usable: (key: string) => boolean = () => true, light = false): Insight[] {
  const base = clientFacts(record, new Date(`${today}T00:00:00`))
  // 업종 칸이 비어 있으면 사업자등록증의 업태 · 종목으로(서류만 올려도 판정이 나오게)
  const facts = base.industryText ? base : { ...base, industryText: [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' ') }
  const ctx: InsightContext = { record, today, facts, notices, light }
  const out: Insight[] = []
  for (const p of INSIGHT_PROVIDERS) {
    if (!usable(p.key)) continue
    try {
      const r = p.run(ctx)
      if (r) out.push(withLast(r, record))
    } catch {
      // 한 모듈 엔진이 이 업체 값으로 실패해도 맞춤 추천 전체가 멈추지 않는다
    }
  }
  return out.map((x, i) => ({ x, i })).sort((a, b) => TONE_RANK[a.x.tone] - TONE_RANK[b.x.tone] || a.i - b.i).map((v) => v.x)
}

/* ------------------------------------------------------------------ */
/* D-190 먼저 제안할 것 — 업체 상세 맨 위 · 고객 관리 카드 · 추천 많은 순        */
/* ------------------------------------------------------------------ */

/** 제안할 만한 판정인가 — 가능성 높음 · 검토해 볼 만함만(분석 있음 · 정보 더 필요 · 어려움은 제안이 아니다) */
export const isPick = (i: Pick<Insight, 'tone'>): boolean => i.tone === 'good' || i.tone === 'maybe'

/** 업체 상세 맨 위 — 먼저 제안할 것 많아야 n개(판정은 이미 좋은 것 먼저 · 같으면 모듈 순서) */
export function topPicks(insights: readonly Insight[], n = 3): Insight[] {
  return insights.filter(isPick).slice(0, n)
}

/** 아직 판정 못 한 모듈에 필요한 서류 · 정보 — 겹치지 않게, 많아야 n개 */
export function missingForPicks(insights: readonly Insight[], n = 3): string[] {
  return [...new Set(insights.filter((i) => i.tone === 'need').flatMap((i) => i.missing))].slice(0, n)
}

export interface RecoChip {
  key: string
  label: string
  tone: 'good' | 'maybe'
}

/**
 * 고객 관리 카드의 추천 띠 — 업체마다 모듈 판정을 돌리되 지원사업은 목록이 한 번에 센 '맞는 공고 수' 를 쓴다
 * (업체마다 공고 1,000건을 다시 대 보지 않는다).
 */
export function cardRecoChips(record: ClientOpsRecord, today: string, grantFit: number, usable: (key: string) => boolean = () => true): RecoChip[] {
  const ins = buildInsights(record, today, [], (k) => k !== 'grants' && usable(k), true).filter(isPick)
  const chips: RecoChip[] = ins.map((i) => ({ key: i.key, label: i.label, tone: i.tone as RecoChip['tone'] }))
  if (grantFit > 0 && usable('grants')) chips.unshift({ key: 'grants', label: `지원사업 ${grantFit}건`, tone: 'good' })
  return chips.map((c, i) => ({ c, i })).sort((a, b) => TONE_RANK[a.c.tone] - TONE_RANK[b.c.tone] || a.i - b.i).map((v) => v.c)
}

/** 추천 많은 순 — 가능성 높음 2점 · 검토해 볼 만함 1점 */
export function recoScore(chips: readonly Pick<RecoChip, 'tone'>[]): number {
  return chips.reduce((s, c) => s + (c.tone === 'good' ? 2 : 1), 0)
}

export interface NextStep {
  id: string
  text: string
  why: string
  href: string | null
}

/** 맞춤 추천 — 다음 행동(최대 5) · 확인할 정보 → 가능성 높은 모듈 → 빠진 서류 */
export function recommendNextSteps(
  insights: readonly Insight[],
  pendingCount: number,
  /** D-149: 서류함 손볼 것(만료 · 무슨 서류인지 확인 · 겹친 서류 묶음) — 있으면 서류 탭으로 */
  shelf?: { expired: number; other: number; dup: number },
  /** D-151: 신청 준비 중인 지원사업 — 마감이 가까운 것부터, 서류가 모자라면 맨 위 */
  applying?: readonly { name: string; daysLeft: number | null; missing: number }[],
  /** D-152: 선정됐는데 성공보수를 수금에 안 건 사업 */
  feeToSet?: readonly string[],
): NextStep[] {
  const out: NextStep[] = []
  for (const name of (feeToSet ?? []).slice(0, 2)) out.push({ id: `fee:${name}`, text: `${name} 선정 — 성공보수 수금에 걸기`, why: '걸어 두면 협약 · 입금 뒤 받을 돈으로 수금 · 매출에 잡혀요', href: '?tab=funding' })
  for (const a of [...(applying ?? [])].filter((x) => x.missing > 0 && (x.daysLeft === null || x.daysLeft >= 0)).sort((x, y) => (x.daysLeft ?? 999) - (y.daysLeft ?? 999)).slice(0, 2)) {
    const when = a.daysLeft === null ? '' : a.daysLeft === 0 ? ' · 오늘 마감' : ` · ${a.daysLeft}일 남음`
    out.push({ id: `apply:${a.name}`, text: `${a.name} — 서류 ${a.missing}가지 받기${when}`, why: '모자란 서류만 카톡 문구로 보낼 수 있어요', href: '?tab=funding' })
  }
  if (pendingCount > 0) out.push({ id: 'facts', text: `서류에서 읽은 정보 ${pendingCount}건 확인하기`, why: '확실하지 않은 것만 남겨 두었어요 — 맞으면 한 번에 넣어요', href: '#fact-inbox' })
  if (shelf && shelf.expired + shelf.other + shelf.dup > 0) {
    const parts = [shelf.expired ? `만료 ${shelf.expired}` : '', shelf.other ? `무슨 서류인지 확인 ${shelf.other}` : '', shelf.dup ? `겹친 서류 ${shelf.dup}묶음` : ''].filter(Boolean)
    out.push({ id: 'shelf', text: `서류함 정리하기 — ${parts.join(' · ')}`, why: shelf.expired ? '만료된 서류는 신청 때 막혀요 — 새 발급본을 받아 두세요' : '열어 보고 맞는 칸으로 옮기거나 겹친 것을 지워요', href: '?tab=docs' })
  }
  for (const ins of insights) if ((ins.tone === 'good' || ins.tone === 'maybe') && ins.action) out.push({ id: `ins:${ins.key}`, text: ins.action, why: `${ins.label} — ${ins.detail || ins.headline}`, href: ins.openPath })
  const docs = [...new Set(insights.filter((i) => i.tone === 'need').flatMap((i) => i.missing))]
  if (docs.length) out.push({ id: 'docs', text: `${docs.slice(0, 3).join(' · ')} 받기`, why: '받으면 판정이 바로 나와요(서류 올리기 한 번으로)', href: null })
  return out.slice(0, 5)
}
