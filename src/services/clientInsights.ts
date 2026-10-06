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
import { latestToolResult } from './toolResultGroups'
import { matchesFor, type GrantNotice } from './grants/grantMatch'
import { profileOfRecord, missingForMatch } from './grants/grantProfile'
import { runDiagnosis } from '../tools/policyFunding/diagnosis'
import { policyInputFromFacts } from '../tools/policyFunding/clientInput'
import { judge } from '../tools/startupTax/lib/judgement'
import { EMPTY_FORM } from '../tools/startupTax/lib/formDefaults'
import type { FormData as StartupForm, Region } from '../tools/startupTax/types'
import { placeOf } from './grants/grantMatch'

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
}

export interface InsightContext {
  record: ClientOpsRecord
  today: string
  facts: ClientFacts
  notices: readonly GrantNotice[]
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
    return {
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
  if (core.length) return { key: 'grants', label: '지원사업', tone: 'need', headline: `${core.join(' · ')}을(를) 알면 맞는 공고를 골라요`, detail: `지금 확인 필요 ${check.length}건`, missing: core, openPath: open, openLabel: '지원사업 알림', action: null }
  if (check.length) return { key: 'grants', label: '지원사업', tone: 'maybe', headline: `확인하면 맞을 수 있는 공고 ${check.length}건`, detail: check[0].reasons.filter((r) => r.state === 'unknown').map((r) => r.label).join(' · ') + ' 확인', missing: [], openPath: open, openLabel: '확인할 공고 보기', action: null }
  return { key: 'grants', label: '지원사업', tone: 'no', headline: '지역 · 업력 · 업종까지 맞는 공고가 지금은 없어요', detail: '새 공고가 들어오면(매일 아침 9시) 여기에 바로 보여요.', missing: [], openPath: open, openLabel: '지원사업 알림', action: null }
}

const policyInsight: Provider = ({ record, facts }) => {
  const { input, missing } = policyInputFromFacts(facts)
  const open = `/tools/policy-funding/diagnosis${q(record)}`
  const core = missing.filter((m) => m !== '매출')
  if (core.length) return { key: 'policy-funding', label: '정책자금', tone: 'need', headline: `${core.join(' · ')}을(를) 알면 바로 판정해요`, detail: '사업자등록증을 올리면 설립일 · 업종이 저절로 들어가요.', missing: core, openPath: open, openLabel: '정책자금 진단', action: null }
  const r = runDiagnosis(input)
  const level = r.likelihoodLevel ?? r.headline?.level ?? '보통'
  const tone: InsightTone = level === '높음' ? 'good' : level === '보통' ? 'maybe' : 'no'
  const why = r.headline?.reasons[0] ?? r.nextAction
  return {
    key: 'policy-funding',
    label: '정책자금',
    tone,
    headline: `진행 가능성 ${level} · 추천 기관 ${r.topAgency}`,
    detail: missing.includes('매출') ? `${why} · 매출을 알면 더 정확해요` : why,
    missing: missing.includes('매출') ? ['매출(재무제표 · 크레탑)'] : [],
    openPath: open,
    openLabel: '정책자금 진단 열기',
    action: tone === 'good' || tone === 'maybe' ? `정책자금 상담 — ${r.topAgency} 쪽으로 준비` : null,
  }
}

function startupRegion(address: string): { region: Region | ''; over: StartupForm['overconcentration'] } {
  const { sido } = placeOf(address)
  if (sido === '서울') return { region: 'seoul', over: 'yes' }
  if (sido === '경기' || sido === '인천') return { region: 'gyeonggi_incheon', over: 'unknown' }
  if (['부산', '대구', '광주', '대전', '울산'].includes(sido)) return { region: 'metro_city', over: 'no' }
  if (sido) return { region: 'other_local', over: 'no' }
  return { region: '', over: '' }
}

const startupInsight: Provider = ({ record, today, facts }) => {
  const open = `/tools/startup-tax${q(record)}`
  // 창업 5년이 지났으면 대표 나이와 상관없이 감면 기간 밖 — 묻지 않고 바로 말한다
  if (facts.establishedAt && facts.months !== null && facts.months >= 60) return { key: 'startup-tax', label: '창업감면', tone: 'no', headline: '창업 5년이 지나 감면 기간이 끝났을 가능성이 커요', detail: `설립 ${facts.establishedAt}`, missing: [], openPath: open, openLabel: '창업감면 판정', action: null }
  const missing = [!facts.establishedAt ? '설립일(창업일)' : '', !facts.representativeBirth ? '대표 생년월일' : ''].filter(Boolean)
  if (missing.length) return { key: 'startup-tax', label: '창업감면', tone: 'need', headline: `${missing.join(' · ')}을(를) 알면 판정해요`, detail: '사업자등록증 · 대표 신분 정보로 채워져요.', missing, openPath: open, openLabel: '창업감면 판정', action: null }
  const { region, over } = startupRegion(facts.address)
  const form: StartupForm = {
    ...EMPTY_FORM,
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
    detail: r.keyChecks[0] ?? r.reasons[0] ?? '',
    // 창업 형태(신규 · 승계)는 기록에 없다 — 판정기에서 물어본다
    missing: ['창업 형태(새로 창업 · 이어받기)'],
    openPath: open,
    openLabel: '창업감면 판정 열기',
    action: tone === 'good' ? '창업감면 — 감면 신청 · 경정청구 확인' : null,
  }
}

const employmentInsight: Provider = ({ record }) => {
  const open = `/tools/employment/roster${q(record)}`
  const last = latestToolResult(record, 'employment')
  const roster = last && (last.data as { tab?: string } | null)?.tab === 'roster' ? last : null
  if (!roster) return { key: 'employment', label: '고용지원금', tone: 'need', headline: '4대보험 가입자 명부를 올리면 직원별 지원금 후보를 바로 봐요', detail: '청년 · 고령 · 신규 입사 후보와 청년도약 참여신청 기한까지.', missing: ['4대보험 가입자 명부'], openPath: open, openLabel: '명부 진단', action: null }
  const hard = roster.deadlines.filter((d) => d.hard).length
  return {
    key: 'employment',
    label: '고용지원금',
    tone: roster.verdict === 'candidates' ? 'good' : 'no',
    headline: roster.verdictLabel || roster.title,
    detail: hard ? `청년도약 참여신청 기한 ${hard}명 — 지나면 신청 불가` : (roster.summary.split('\n')[1] ?? '').replace(/^·\s*/, ''),
    missing: [],
    openPath: open,
    openLabel: '명부 진단 보기',
    action: roster.verdict === 'candidates' ? `고용지원금 — ${roster.verdictLabel}` : null,
  }
}

const labInsight: Provider = ({ record, facts }) => {
  const open = `/tools/labcare${q(record)}`
  if (usableFactValue(record, 'researchLab')) return { key: 'labcare', label: '연구소', tone: 'done', headline: '연구소(전담부서)가 있어요 — 사후관리 · 세액공제를 챙길 때', detail: String(usableFactValue(record, 'researchLab')), missing: [], openPath: open, openLabel: '연구소 관리', action: null }
  const last = latestToolResult(record, 'labcare')
  if (last) return { key: 'labcare', label: '연구소', tone: /가능|추천/.test(last.verdictLabel) ? 'good' : 'maybe', headline: last.verdictLabel || last.title, detail: last.summary.split('\n')[0] ?? '', missing: [], openPath: open, openLabel: '연구소 진단 보기', action: null }
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

const taxInsight: Provider = ({ record }) => {
  const open = `/tools/tax${q(record)}`
  const hasShares = record.shareholderRegister.length > 0
  const filled = Object.values(record.taxProfile ?? {}).filter((v) => String(v).trim() !== '').length
  if (!hasShares && filled === 0) return { key: 'tax', label: '절세 설계', tone: 'need', headline: '주주명부 · 대표 급여를 알면 급여 · 배당 · 퇴직금 절세를 계산해요', detail: '', missing: ['주주명부', '대표 급여'], openPath: open, openLabel: '절세 설계', action: null }
  return { key: 'tax', label: '절세 설계', tone: 'maybe', headline: `절세 현황 ${filled}칸${hasShares ? ` · 주주 ${record.shareholderRegister.length}명` : ''} — 원하는 결과로 절세 방법을 찾아볼 수 있어요`, detail: '', missing: hasShares ? [] : ['주주명부'], openPath: open, openLabel: '절세 설계 열기', action: null }
}

/**
 * 맞춤 추천에 들어오는 모듈 — 위에서부터. 새 모듈을 들이면 판정 함수를 여기에 더한다.
 * (요금제에 없는 모듈은 화면이 뺀다 — 키가 기능 권한 키와 같다)
 */
export const INSIGHT_PROVIDERS: { key: string; run: Provider }[] = [
  { key: 'grants', run: grantsInsight },
  { key: 'policy-funding', run: policyInsight },
  { key: 'employment', run: employmentInsight },
  { key: 'startup-tax', run: startupInsight },
  { key: 'labcare', run: labInsight },
  { key: 'cretop', run: cretopInsight },
  { key: 'tax', run: taxInsight },
]

const TONE_RANK: Record<InsightTone, number> = { good: 0, maybe: 1, done: 2, need: 3, no: 4 }

/** 업체 하나 → 모듈별 판정(좋은 것 먼저). 한 모듈이 실패해도 나머지는 보인다 */
export function buildInsights(record: ClientOpsRecord, today: string, notices: readonly GrantNotice[], usable: (key: string) => boolean = () => true): Insight[] {
  const base = clientFacts(record, new Date(`${today}T00:00:00`))
  // 업종 칸이 비어 있으면 사업자등록증의 업태 · 종목으로(서류만 올려도 판정이 나오게)
  const facts = base.industryText ? base : { ...base, industryText: [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' ') }
  const ctx: InsightContext = { record, today, facts, notices }
  const out: Insight[] = []
  for (const p of INSIGHT_PROVIDERS) {
    if (!usable(p.key)) continue
    try {
      const r = p.run(ctx)
      if (r) out.push(r)
    } catch {
      // 한 모듈 엔진이 이 업체 값으로 실패해도 맞춤 추천 전체가 멈추지 않는다
    }
  }
  return out.map((x, i) => ({ x, i })).sort((a, b) => TONE_RANK[a.x.tone] - TONE_RANK[b.x.tone] || a.i - b.i).map((v) => v.x)
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
