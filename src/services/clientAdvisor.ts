/**
 * 업체 상세 '맞춤 상담' — 이 회사 기록 · 모듈 판정으로 답하는 질문 목차 (D-145).
 *
 * 대표 지시: 맞춤 추천 안에 대화 화면 — 이 회사 맞춤으로, 원하는 컨설팅 결과 · 절차를 도움받게.
 * 원하는 것을 미리 예측해 버튼만 눌러도 되게, 대신 무분별하게 많이 말고 목차를 짜서 펼쳐 보게.
 *
 *  - 지금은 규칙으로 답한다(LLM 호출 0 · 'AI' 라고 부르지 않는다). 답은 모듈 엔진(정책자금 · 창업감면 · 지원사업 …)과
 *    업체 기록에서만 만든다 — 지어내지 않는다. 모르는 것은 '무엇을 알면 답할 수 있는지' 로 말한다.
 *  - 직접 친 질문은 낱말로 가장 가까운 질문을 찾는다. 못 찾으면 비슷한 질문 셋과 'AI 연결 준비 중' 자리.
 *  - 나중에 실제 AI 를 붙이면 answerFor 의 자리에서 같은 모양(AdvisorAnswer)을 돌려주면 화면은 그대로 쓴다.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { GrantNotice } from './grants/grantMatch'
import { matchesFor } from './grants/grantMatch'
import { profileOfRecord } from './grants/grantProfile'
import { clientFacts, type ClientFacts } from '../tools/shared/clientPrefill'
import { policyInputFromFacts } from '../tools/policyFunding/clientInput'
import { runDiagnosis } from '../tools/policyFunding/diagnosis'
import { buildDocumentRequestMessage } from './clientOpsMessages'
import { latestToolResult } from './toolResultGroups'
import { usableFactValue } from './customerFacts'
import { buildInsights, recommendNextSteps, type Insight, type InsightTone } from './clientInsights'
import { pendingFacts } from './customerFacts'

export interface AdvisorQuestion {
  id: string
  label: string
  /** 직접 친 질문을 이 질문으로 알아보는 낱말 */
  words: RegExp
}

export interface AdvisorGroup {
  key: string
  title: string
  hint: string
  questions: AdvisorQuestion[]
}

/** 목차 — 다섯 묶음 · 묶음마다 서너 개(많이 만들지 않는다) */
export const ADVISOR_GROUPS: AdvisorGroup[] = [
  {
    key: 'start',
    title: '한눈에',
    hint: '이 회사 요약 · 지금 할 일',
    questions: [
      { id: 'summary', label: '이 회사 한눈에 요약해 줘', words: /요약|한눈|정리|어떤 회사|현황/ },
      { id: 'next', label: '지금 무엇부터 하면 좋을까?', words: /무엇부터|뭐부터|먼저|다음|할 일|우선/ },
    ],
  },
  {
    key: 'money',
    title: '자금 · 지원사업',
    hint: '정책자금 · 지원사업 · 고용지원금',
    questions: [
      { id: 'policy', label: '받을 수 있는 정책자금은? 어디에 신청해?', words: /정책\s*자금|융자|대출|자금|보증|중진공|소진공|신보|기보/ },
      { id: 'grants', label: '지금 신청할 수 있는 지원사업은?', words: /지원\s*사업|공고|바우처|보조금|기업마당/ },
      { id: 'employment', label: '고용지원금 받을 수 있는 직원이 있나?', words: /고용|채용|직원|청년|인건비|명부|4대\s*보험/ },
    ],
  },
  {
    key: 'tax',
    title: '세금 · 절세',
    hint: '창업감면 · 대표 급여 · 세액공제',
    questions: [
      { id: 'startup', label: '창업감면 받을 수 있나?', words: /창업\s*감면|감면|법인세|소득세\s*감면|취득세/ },
      { id: 'salary', label: '대표 급여 · 배당 · 퇴직금은 어떻게 가져가면 좋아?', words: /급여|배당|퇴직|가지급|절세|주식|상속|증여/ },
    ],
  },
  {
    key: 'cert',
    title: '연구소 · 인증',
    hint: '연구소 설립 · 벤처 · 이노비즈',
    questions: [
      { id: 'lab', label: '연구소(전담부서) 세울 수 있나? 절차는?', words: /연구소|전담\s*부서|R&D|연구\s*개발|연구원/i },
      { id: 'cert', label: '벤처 · 이노비즈 인증 받을 수 있나?', words: /벤처|이노비즈|메인비즈|인증|확인서/ },
    ],
  },
  {
    key: 'sales',
    title: '상담 진행',
    hint: '물어볼 것 · 받을 서류 · 보낼 문구',
    questions: [
      { id: 'ask', label: '대표님께 무엇을 물어봐야 해?', words: /물어|질문|확인할|모르는|빠진 정보/ },
      { id: 'docs', label: '받아야 할 서류와 요청 문구', words: /서류|자료|요청|준비물|받아야/ },
      { id: 'pitch', label: '대표님께 보낼 제안 문구 만들어 줘', words: /제안|문구|카톡|메시지|보낼|안내/ },
    ],
  },
]

export const ALL_QUESTIONS: AdvisorQuestion[] = ADVISOR_GROUPS.flatMap((g) => g.questions)

export interface AdvisorAnswer {
  questionId: string | null
  title: string
  verdict: { tone: InsightTone; text: string } | null
  /** 이 회사에 대해 아는 것 · 판단 이유 */
  facts: string[]
  /** 절차 · 할 일 순서 */
  steps: string[]
  /** 준비 서류 */
  docs: string[]
  /** 더 알면 정확해지는 것 */
  missing: string[]
  links: { label: string; href: string }[]
  /** 복사해서 쓰는 글(카톡 · 메모) */
  copyText: string
  /** 정해 둔 답이 없을 때 — 비슷한 질문 */
  suggestions: AdvisorQuestion[]
  /** 답 끝에 붙는 주의 */
  note: string
}

export interface AdvisorContext {
  record: ClientOpsRecord
  today: string
  notices: readonly GrantNotice[]
  /** 맞춤 추천이 이미 계산한 판정(없으면 여기서 계산) */
  insights?: Insight[]
}

const NOTE = '업체 기록과 모듈 규칙으로 만든 1차 답이에요 — 선정 · 승인 · 세액을 보장하지 않고, 신청 전 원문 · 전문가 확인이 필요해요.'

function empty(questionId: string | null, title: string): AdvisorAnswer {
  return { questionId, title, verdict: null, facts: [], steps: [], docs: [], missing: [], links: [], copyText: '', suggestions: [], note: NOTE }
}

const q = (record: ClientOpsRecord) => `?client=${encodeURIComponent(record.id)}`
const name = (r: ClientOpsRecord) => r.companyName || '이 회사'
const ceo = (r: ClientOpsRecord) => (r.representativeName || r.contactName ? `${r.representativeName || r.contactName} 대표님` : '대표님')

function factsOf(ctx: AdvisorContext): ClientFacts {
  const base = clientFacts(ctx.record, new Date(`${ctx.today}T00:00:00`))
  return base.industryText ? base : { ...base, industryText: [ctx.record.businessCategory, ctx.record.businessItem].filter(Boolean).join(' ') }
}

function insightOf(ctx: AdvisorContext, key: string): Insight | null {
  return (ctx.insights ?? buildInsights(ctx.record, ctx.today, ctx.notices)).find((i) => i.key === key) ?? null
}

function profileLines(r: ClientOpsRecord, f: ClientFacts): string[] {
  return [
    f.address ? `소재지 ${f.address}` : '',
    f.establishedAt ? `설립 ${f.establishedAt}${f.years !== null ? ` · 업력 ${f.years}년` : ''}` : '',
    f.industryText ? `업종 ${f.industryText}` : '',
    f.employeeCount !== null ? `직원 ${f.employeeCount}명` : '',
    f.revenue ? `매출 ${Math.round(f.revenue.won / 1e6).toLocaleString()}백만원${f.revenue.estimated ? '(예상)' : ''}` : '',
    f.businessType === 'corporation' ? '법인' : '',
    usableFactValue(r, 'certifications') ? `인증 ${usableFactValue(r, 'certifications')}` : '',
  ].filter(Boolean)
}

/* ------------------------------------------------------------------ */
/* 질문별 답                                                              */
/* ------------------------------------------------------------------ */

const ANSWERS: Record<string, (ctx: AdvisorContext) => AdvisorAnswer> = {
  summary: (ctx) => {
    const a = empty('summary', `${name(ctx.record)} 한눈에`)
    const f = factsOf(ctx)
    a.facts = profileLines(ctx.record, f)
    const ins = ctx.insights ?? buildInsights(ctx.record, ctx.today, ctx.notices)
    const good = ins.filter((i) => i.tone === 'good' || i.tone === 'maybe')
    a.steps = good.map((i) => `${i.label} — ${i.headline}`)
    a.missing = [...new Set(ins.filter((i) => i.tone === 'need').flatMap((i) => i.missing))].slice(0, 5)
    a.verdict = good.length ? { tone: 'good', text: `검토해 볼 만한 것 ${good.length}가지` } : { tone: 'need', text: '서류를 더 받으면 판정이 나와요' }
    a.copyText = [`[${name(ctx.record)} 요약]`, ...a.facts, '', '검토할 것:', ...a.steps.map((s) => `· ${s}`)].join('\n')
    return a
  },
  next: (ctx) => {
    const a = empty('next', '지금 무엇부터')
    const ins = ctx.insights ?? buildInsights(ctx.record, ctx.today, ctx.notices)
    const steps = recommendNextSteps(ins, pendingFacts(ctx.record).length)
    a.steps = steps.map((s) => `${s.text} — ${s.why}`)
    a.links = steps.filter((s) => s.href && !s.href.startsWith('#')).map((s) => ({ label: s.text.slice(0, 24), href: s.href as string }))
    a.verdict = steps.length ? { tone: 'good', text: `할 일 ${steps.length}가지 — 위에서부터` } : { tone: 'need', text: '서류를 올리면 할 일을 골라 드려요' }
    a.copyText = ['[다음 할 일]', ...a.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n')
    return a
  },
  policy: (ctx) => {
    const a = empty('policy', '정책자금')
    const f = factsOf(ctx)
    const { input, missing } = policyInputFromFacts(f)
    a.links = [{ label: '정책자금 진단 열기', href: `/tools/policy-funding/diagnosis${q(ctx.record)}` }]
    const core = missing.filter((m) => m !== '매출')
    if (core.length) {
      a.verdict = { tone: 'need', text: `${core.join(' · ')}을(를) 알아야 판정해요` }
      a.missing = core
      a.steps = ['사업자등록증을 올리면 설립일 · 업종이 저절로 들어가요', '그다음 이 질문을 다시 눌러 주세요']
      return a
    }
    const r = runDiagnosis(input)
    const level = r.likelihoodLevel ?? r.headline?.level ?? '보통'
    a.verdict = { tone: level === '높음' ? 'good' : level === '보통' ? 'maybe' : 'no', text: `진행 가능성 ${level}` }
    a.facts = [...profileLines(ctx.record, f).slice(0, 4), ...(r.headline?.reasons ?? []).slice(0, 2).map((x) => `판단 이유: ${x}`), ...(r.headline?.checks ?? []).slice(0, 2).map((x) => `확인 필요: ${x}`)]
    a.steps = [...r.agencies.slice(0, 3).map((ag) => `${ag.rank}순위 ${ag.name}${ag.reasons[0] ? ` — ${ag.reasons[0]}` : ''}`), r.nextAction ? `다음: ${r.nextAction}` : ''].filter(Boolean)
    a.docs = r.documents.slice(0, 8)
    a.missing = missing.includes('매출') ? ['매출(재무제표 · 크레탑) — 알면 기관 · 한도가 더 정확해요'] : []
    a.copyText = [`[정책자금 1차 검토] ${name(ctx.record)}`, `진행 가능성 ${level} · 추천 기관 ${r.topAgency}`, ...a.steps.map((s) => `· ${s}`), a.docs.length ? `준비 서류: ${a.docs.join(', ')}` : ''].filter(Boolean).join('\n')
    return a
  },
  grants: (ctx) => {
    const a = empty('grants', '지금 신청할 수 있는 지원사업')
    const p = profileOfRecord(ctx.record, ctx.today)
    const ms = matchesFor(ctx.notices, p, ctx.today)
    const fit = ms.filter((m) => m.verdict === 'fit')
    const check = ms.filter((m) => m.verdict === 'check')
    a.links = [{ label: '맞는 공고 전부 보기', href: `/grants?view=clients&client=${encodeURIComponent(ctx.record.id)}` }]
    if (ctx.notices.length === 0) {
      a.verdict = { tone: 'need', text: '받아 둔 공고가 아직 없어요' }
      a.steps = ['지원사업 알림에서 기업마당 공고를 받아 오거나(매일 아침 9시) 공고를 넣어 주세요']
      return a
    }
    a.verdict = fit.length ? { tone: 'good', text: `지역 · 업력 · 업종까지 맞는 공고 ${fit.length}건` } : check.length ? { tone: 'maybe', text: `확인하면 맞을 수 있는 공고 ${check.length}건` } : { tone: 'no', text: '맞는 공고가 지금은 없어요' }
    a.steps = (fit.length ? fit : check).slice(0, 6).map((m) => `${m.notice.title} — ${m.deadline.label}${m.notice.amountText ? ` · ${m.notice.amountText}` : ''}`)
    a.missing = [!p.sido ? '회사 주소' : '', !p.years ? '설립일' : '', !p.industry ? '업종' : '', !p.employees ? '직원 수' : ''].filter(Boolean)
    a.copyText = [`${ceo(ctx.record)}, 회사 조건(지역 · 업력 · 업종)에 맞는 지원사업을 골라 봤습니다.`, ...a.steps.map((s) => `· ${s}`), '신청을 원하시면 서류 준비부터 도와드리겠습니다.'].join('\n')
    return a
  },
  employment: (ctx) => {
    const a = empty('employment', '고용지원금')
    const ins = insightOf(ctx, 'employment')
    a.links = [{ label: '명부 진단 열기', href: `/tools/employment/roster${q(ctx.record)}` }]
    const last = latestToolResult(ctx.record, 'employment')
    if (!last || (last.data as { tab?: string } | null)?.tab !== 'roster') {
      a.verdict = { tone: 'need', text: '4대보험 가입자 명부가 있으면 바로 봐요' }
      a.docs = ['4대보험 사업장 가입자 명부(최근 발급)']
      a.steps = ['명부를 서류 올리기로 넣기 → 직원별 후보 · 청년도약 참여신청 기한이 저절로 계산돼요', '입사 예정자가 있으면 입사 전에 지원금 조건(나이 · 근로 형태)을 먼저 확인']
      return a
    }
    a.verdict = { tone: last.verdict === 'candidates' ? 'good' : 'no', text: last.verdictLabel }
    a.facts = last.summary.split('\n').filter(Boolean).slice(0, 6)
    const hard = last.deadlines.filter((d) => d.hard)
    a.steps = [...hard.slice(0, 5).map((d) => `${d.date}까지 — ${d.title}`), '참여신청 → 6개월 고용 유지 → 회차별 신청(회차 일정은 고용지원금 화면에서)']
    a.docs = ['근로계약서', '임금대장 · 급여 이체 내역', '4대보험 가입 확인']
    a.copyText = [`[고용지원금 1차 검토] ${name(ctx.record)}`, ...a.facts, ...hard.map((d) => `· ${d.date}까지 ${d.title}`)].join('\n')
    if (ins?.detail) a.facts.unshift(ins.detail)
    return a
  },
  startup: (ctx) => {
    const a = empty('startup', '창업감면')
    const ins = insightOf(ctx, 'startup-tax')
    a.links = [{ label: '창업감면 판정 열기', href: `/tools/startup-tax${q(ctx.record)}` }]
    if (!ins) return a
    a.verdict = { tone: ins.tone, text: ins.headline }
    a.facts = [ins.detail].filter(Boolean)
    a.missing = ins.missing
    a.steps =
      ins.tone === 'no'
        ? ['창업 5년이 지났으면 창업감면 대신 다른 세액공제(고용 · 연구 인력)를 검토', '지난 5년 안에 감면을 안 받았다면 경정청구(5년 안) 가능 여부를 세무사와 확인']
        : ['창업 형태(새로 창업 · 이어받기) 확인 — 이어받은 창업은 감면이 안 될 수 있어요', '과밀억제권역(수도권 일부) 여부로 감면율이 달라져요', '감면을 안 받고 있었다면 경정청구로 돌려받을 수 있는지 확인']
    a.docs = ['사업자등록증', '대표 주민등록 초본(나이 확인 — 번호는 저장하지 않아요)', '법인등기부등본(법인)']
    a.copyText = [`[창업감면 1차 검토] ${name(ctx.record)}`, ins.headline, ...a.steps.map((s) => `· ${s}`)].join('\n')
    return a
  },
  salary: (ctx) => {
    const a = empty('salary', '대표 급여 · 배당 · 퇴직금')
    const ins = insightOf(ctx, 'tax')
    a.links = [{ label: '절세 설계 열기', href: `/tools/tax${q(ctx.record)}` }]
    a.verdict = ins ? { tone: ins.tone, text: ins.headline } : null
    a.facts = [
      ctx.record.shareholderRegister.length ? `주주 ${ctx.record.shareholderRegister.length}명 기록` : '주주명부가 아직 없어요',
      usableFactValue(ctx.record, 'netIncome') ? `순이익 ${usableFactValue(ctx.record, 'netIncome')}` : '',
    ].filter(Boolean)
    a.steps = ['원하는 결과를 고르기(급여로 · 배당으로 · 퇴직금으로 · 나눠서 · 가지급금 정리)', '절세 설계에서 1 · 2 · 3 · 5년 나눠 가져오기 총 세금을 비교', '결과를 대표님께 드릴 한 장으로 인쇄 · PDF']
    a.docs = ['주주명부', '대표 급여(연봉)', '최근 재무제표(순이익 · 이익잉여금)']
    a.missing = ins?.missing ?? []
    a.copyText = [`${ceo(ctx.record)}, 급여 · 배당 · 퇴직금을 어떻게 나눠 가져가시면 세금이 가장 적은지 계산해 드리려고 합니다.`, `필요한 자료: ${a.docs.join(', ')}`].join('\n')
    return a
  },
  lab: (ctx) => {
    const a = empty('lab', '연구소 · 전담부서')
    const f = factsOf(ctx)
    a.links = [{ label: '연구소 설립 가능성 보기', href: `/tools/labcare${q(ctx.record)}` }]
    if (usableFactValue(ctx.record, 'researchLab')) {
      a.verdict = { tone: 'done', text: '이미 연구소(전담부서)가 있어요' }
      a.steps = ['연구원 변동 · 연구 공간 변경은 30일 안에 변경 신고', '연구 인력 인건비 세액공제 · 연구개발 과제 신청에 활용', '연구노트 · 연구 활동 기록을 남겨 두기(사후관리)']
      return a
    }
    const early = f.months !== null && f.months < 36
    const need = early ? 2 : 3
    a.verdict = { tone: f.employeeCount !== null && f.employeeCount >= need ? 'maybe' : 'need', text: `소기업 기준 연구전담요원 ${need}명(전담부서는 1명)이 필요해요` }
    a.facts = [`직원 ${f.employeeCount ?? '?'}명 · 업력 ${f.years ?? '?'}년${early ? ' — 창업 3년 안이라 2명 기준' : ''}`, '벤처기업이면 2명 기준 · 중기업은 5명']
    a.steps = ['연구 인력 확인 — 자연계 학사 이상(또는 학사 + 경력) · 연구 일만 하는 사람', '독립된 연구 공간 — 칸막이 · 출입문 · 간판', '한국산업기술진흥협회(KOITA)에 온라인 신고', '인정 뒤 연구 인력 인건비 세액공제 · 병역특례 등 활용']
    a.docs = ['연구원 학위 · 경력 증명', '연구 공간 도면 · 사진', '4대보험 가입 명부', '사업자등록증']
    a.missing = ['연구 인력(학위 · 경력)', '연구 공간']
    a.copyText = [`[연구소 설립 1차 검토] ${name(ctx.record)}`, a.verdict.text, ...a.steps.map((s) => `· ${s}`)].join('\n')
    return a
  },
  cert: (ctx) => {
    const a = empty('cert', '벤처 · 이노비즈')
    const f = factsOf(ctx)
    const has = String(usableFactValue(ctx.record, 'certifications') ?? '')
    a.facts = [has ? `지금 인증: ${has}` : '등록된 인증이 없어요', `업력 ${f.years ?? '?'}년`]
    a.verdict = { tone: 'maybe', text: has ? '이미 있는 인증의 만료일 · 갱신을 먼저 챙기세요' : '유형별로 검토해 볼 만해요' }
    a.steps = [
      '벤처 — 혁신성장 유형(기술 · 사업성 평가) · 연구개발 유형(연구소 + 연구비) · 투자 유형(VC 투자) 중 맞는 길',
      f.years !== null && f.years >= 3 ? '이노비즈 — 업력 3년 이상이라 신청 가능(기술혁신 평가)' : '이노비즈 — 업력 3년 이상부터(지금은 기다리기)',
      '인증이 있으면 정책자금 · 지원사업 가점 · 세제 혜택이 붙어요',
    ]
    a.docs = ['사업자등록증', '재무제표', '연구소 인정서(있으면)', '특허 · 지식재산(있으면)']
    a.links = [{ label: '회사 정보에 인증 적기', href: `/ops/clients/${encodeURIComponent(ctx.record.id)}` }]
    a.copyText = [`[인증 검토] ${name(ctx.record)}`, ...a.steps.map((s) => `· ${s}`)].join('\n')
    return a
  },
  ask: (ctx) => {
    const a = empty('ask', '대표님께 물어볼 것')
    const f = factsOf(ctx)
    const qs = [
      !f.address ? '사업장 주소가 어디인가요? (지원사업 · 정책자금이 지역으로 갈려요)' : '',
      !f.establishedAt ? '개업일(설립일)이 언제인가요?' : '',
      !f.industryText ? '주로 무엇을 만들거나 파시나요? (업종)' : '',
      f.employeeCount === null ? '4대보험에 가입된 직원이 몇 명인가요?' : '',
      !f.revenue ? '작년 매출이 대략 얼마인가요?' : '',
      !f.representativeBirth ? '대표님 나이(생년)는요? (청년 창업 · 감면 판단)' : '',
      ctx.record.shareholderRegister.length === 0 ? '주주가 대표님 혼자인가요? 가족 지분이 있나요?' : '',
      '세금 · 4대보험 체납이 있나요? (있으면 자금 · 지원사업이 막혀요)',
      '앞으로 1년 안에 사람을 뽑을 계획이 있나요?',
    ].filter(Boolean)
    a.steps = qs
    a.verdict = { tone: 'need', text: `빠진 정보 위주로 ${qs.length}가지` }
    a.copyText = [`[${name(ctx.record)} 상담 때 물어볼 것]`, ...qs.map((s, i) => `${i + 1}. ${s}`)].join('\n')
    return a
  },
  docs: (ctx) => {
    const a = empty('docs', '받아야 할 서류')
    const ins = ctx.insights ?? buildInsights(ctx.record, ctx.today, ctx.notices)
    a.docs = [...new Set(ins.filter((i) => i.tone === 'need').flatMap((i) => i.missing))].slice(0, 8)
    const msg = buildDocumentRequestMessage(ctx.record, ctx.today)
    a.facts = a.docs.length ? ['받으면 모듈 판정이 바로 나오는 것부터'] : []
    a.steps = ['받은 서류는 머리줄 [서류 올리기]로 한 번에 — 회사 정보 · 판정이 저절로 바뀌어요']
    a.copyText = msg
    a.verdict = { tone: a.docs.length ? 'need' : 'done', text: a.docs.length ? `판정에 필요한 것 ${a.docs.length}가지` : '판정에 필요한 서류는 다 있어요' }
    return a
  },
  pitch: (ctx) => {
    const a = empty('pitch', '대표님께 보낼 제안 문구')
    const ins = (ctx.insights ?? buildInsights(ctx.record, ctx.today, ctx.notices)).filter((i) => i.tone === 'good' || i.tone === 'maybe')
    a.steps = ins.map((i) => `${i.label}: ${i.headline}`)
    a.verdict = ins.length ? { tone: 'good', text: `제안할 거리 ${ins.length}가지` } : { tone: 'need', text: '서류를 받으면 제안할 거리를 골라 드려요' }
    a.copyText = [
      `${ceo(ctx.record)}, 안녕하세요. ${name(ctx.record)} 자료로 검토해 보니 아래를 함께 준비해 보시면 좋겠습니다.`,
      ...ins.slice(0, 4).map((i) => `· ${i.label} — ${i.headline}`),
      '자세한 내용은 통화로 설명드리겠습니다. 편하신 시간 알려 주세요.',
    ].join('\n')
    return a
  },
}

/** 질문 하나에 답한다 */
export function answerFor(questionId: string, ctx: AdvisorContext): AdvisorAnswer {
  const fn = ANSWERS[questionId]
  if (!fn) return fallback('', ctx)
  try {
    return fn(ctx)
  } catch {
    const a = empty(questionId, ALL_QUESTIONS.find((x) => x.id === questionId)?.label ?? '답')
    a.verdict = { tone: 'need', text: '이 회사 정보로는 아직 답을 만들지 못했어요' }
    return a
  }
}

/** 직접 친 질문 → 가장 가까운 질문(낱말이 가장 많이 맞는 것) */
export function matchQuestion(text: string): { best: AdvisorQuestion | null; similar: AdvisorQuestion[] } {
  const t = text.trim()
  if (!t) return { best: null, similar: [] }
  const scored = ALL_QUESTIONS.map((qq) => ({ qq, n: (t.match(new RegExp(qq.words.source, `g${qq.words.flags.replace('g', '')}`)) ?? []).length })).filter((x) => x.n > 0)
  scored.sort((a, b) => b.n - a.n)
  return { best: scored[0]?.qq ?? null, similar: scored.slice(1, 4).map((x) => x.qq) }
}

function fallback(text: string, ctx: AdvisorContext): AdvisorAnswer {
  const a = empty(null, text ? `“${text.slice(0, 40)}”` : '정해 둔 답이 없어요')
  a.verdict = { tone: 'need', text: '이 질문은 정해 둔 답이 아직 없어요' }
  a.steps = ['아래 목차에서 가까운 질문을 눌러 보세요', 'AI 를 연결하면 이런 질문도 이 회사 정보로 답해 드려요(준비 중)']
  a.suggestions = [ALL_QUESTIONS.find((x) => x.id === 'next'), ALL_QUESTIONS.find((x) => x.id === 'summary'), ALL_QUESTIONS.find((x) => x.id === 'policy')].filter(Boolean) as AdvisorQuestion[]
  void ctx
  return a
}

/** 직접 친 질문에 답한다 — 가까운 질문이 있으면 그 답 + 비슷한 질문, 없으면 대신 할 수 있는 것 */
export function answerText(text: string, ctx: AdvisorContext): AdvisorAnswer {
  const { best, similar } = matchQuestion(text)
  if (!best) return fallback(text, ctx)
  const a = answerFor(best.id, ctx)
  return { ...a, suggestions: similar }
}
