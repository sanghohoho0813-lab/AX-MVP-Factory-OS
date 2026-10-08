/**
 * 벤처 준비 패키지 (P2) — 벤처확인 신청서 · 사업계획서에 들어갈 사실을 9칸으로 모은다.
 * 기존 벤처 판정(assessVenture)은 그대로 — 여기는 '무엇이 확인됐고 무엇을 물어야 하나' 만.
 * 칸마다 ✓ 확인됨 · △ 일부 · ? 대표 확인. 내용을 지어내지 않는다 — 쓴 줄마다 근거가 붙는다.
 */
import { factKit, OWNER_BASIS, type Sourced } from './answerGuide'
import type { CertificationClientContext } from './types'

export type PackState = 'ok' | 'partly' | 'ask'
export const PACK_MARK: Record<PackState, string> = { ok: '✓', partly: '△', ask: '?' }
export const PACK_LABEL: Record<PackState, string> = { ok: '확인됨', partly: '일부', ask: '대표 확인' }

export type VentureSectionId = 'basic' | 'problem' | 'product' | 'tech' | 'market' | 'growth' | 'rnd' | 'ip' | 'proof'

export interface VentureSection {
  id: VentureSectionId
  title: string
  state: PackState
  lines: Sourced[]
  /** 대표에게 물을 것(이 칸을 채우려면) — 답을 받으면 notes[`venture:${id}`] 로 */
  ask: string
}

export const VENTURE_SECTIONS: { id: VentureSectionId; title: string; ask: string }[] = [
  { id: 'basic', title: '회사 기본정보', ask: '설립일 · 업종 · 직원 수가 회사 정보와 같은지 확인 부탁드립니다.' },
  { id: 'problem', title: '해결하려는 문제', ask: '어떤 고객의 어떤 불편 · 문제를 해결하나요?' },
  { id: 'product', title: '제품 · 서비스', ask: '주력 제품 · 서비스는 무엇이고 누가 사나요?' },
  { id: 'tech', title: '기술 · 차별성', ask: '경쟁 제품과 비교해 무엇이 다른가요?(기술 · 방식 · 원가)' },
  { id: 'market', title: '시장', ask: '주요 고객층과 경쟁사는 어디인가요?' },
  { id: 'growth', title: '매출 · 성장', ask: '최근 3년 매출 흐름과 올해 예상은 어떤가요?' },
  { id: 'rnd', title: '연구개발', ask: '연구개발 조직 · 인원 · 지난해 연구개발비는 어떻게 되나요?' },
  { id: 'ip', title: '지식재산', ask: '등록 · 출원 중인 특허 · 상표 · 프로그램 등록이 있나요?' },
  { id: 'proof', title: '실증 · 성과', ask: '납품 실적 · 시범 적용 · 수상 · 투자 유치 같은 성과가 있나요?' },
]


export function buildVenturePack(c: CertificationClientContext, notes: Record<string, string> = {}): VentureSection[] {
  const kit = factKit(c)
  const line = (label: string, f: Parameters<typeof kit.fact>[0]): Sourced | null => {
    const x = kit.fact(f)
    return x ? { text: `${label} ${x.value}`, basis: x.basis } : null
  }
  const note = (id: VentureSectionId): Sourced | null => {
    const t = (notes[`venture:${id}`] ?? '').trim()
    return t ? { text: t, basis: OWNER_BASIS } : null
  }
  const doc = (id: string, text: string): Sourced | null => (kit.hasEvidence(id) ? { text, basis: '서류함' } : null)
  // LEGACY 컨설팅 기록의 출원 중 특허 — 보유로 세지 않고 '출원 중 · 등록 확인 필요' 로
  const lv = c.legacyVenture
  const filed: Sourced | null =
    lv && lv.patentStatus === 'filed' && !(c.patents ?? 0)
      ? { text: `특허 출원 중${lv.applicationNumber ? `(${lv.applicationNumber})` : ''}${lv.filedAt ? ` · 출원일 ${lv.filedAt}` : ''} — 등록 여부 확인 필요`, basis: `이전 컨설팅 프로젝트 기록(${lv.projectTitle})` }
      : null
  const facts: Record<VentureSectionId, (Sourced | null)[]> = {
    basic: [c.companyName ? { text: `회사명 ${c.companyName}`, basis: '업체 기록' } : null, line('업력', 'years'), line('업종', 'industry'), line('직원', 'employees')],
    problem: [],
    product: [line('업종', 'industry')],
    tech: [line('연구조직', 'researchUnit'), line('특허', 'patents'), filed],
    market: [line('B2B 납품', 'b2b'), line('조달 · 입찰', 'procurement'), line('수출', 'exportPlan')],
    growth: [line('매출', 'revenue'), line('영업이익', 'operatingProfit'), doc('fin3', '재무제표(서류함)')],
    rnd: [line('연구조직', 'researchUnit'), line('연구전담요원', 'researchers'), line('연구개발비', 'rndExpense'), doc('lab_cert', '연구소 · 전담부서 인정서(서류함)')],
    ip: [line('특허', 'patents'), filed, doc('patent', '특허 등록증(서류함)')],
    proof: kit.held.length ? [{ text: `보유 인증 ${kit.held.join(' · ')}`, basis: '회사 정보 인증서 칸 · 진행 기록' }] : [],
  }
  // 칸이 '확인됨' 이 되려면 이만큼 — 그 밖에는 대표 답이 있어야 한다
  const enough: Record<VentureSectionId, number> = { basic: 3, problem: 99, product: 99, tech: 2, market: 99, growth: 2, rnd: 3, ip: 2, proof: 99 }
  return VENTURE_SECTIONS.map((s) => {
    const n = note(s.id)
    const lines = [...facts[s.id].filter((x): x is Sourced => !!x), ...(n ? [n] : [])]
    const factCount = lines.length - (n ? 1 : 0)
    const state: PackState = n ? 'ok' : factCount >= enough[s.id] ? 'ok' : factCount > 0 ? 'partly' : 'ask'
    return { id: s.id, title: s.title, state, lines, ask: s.ask }
  })
}

export function venturePackText(companyName: string, sections: readonly VentureSection[]): string {
  return [
    `[내부] ${companyName} 벤처 준비 패키지`,
    ...sections.flatMap((s) => [
      '',
      `${PACK_MARK[s.state]} ${s.title} — ${PACK_LABEL[s.state]}`,
      ...s.lines.map((l) => `  · ${l.text}`),
      ...(s.state === 'ok' ? [] : [`  □ 대표 확인: ${s.ask}`]),
    ]),
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* AX Hotfix — 벤처는 기업인증 안에서 끝난다: 유형별 길 · 진행 단계 · 제출 전 확인 */
/* ------------------------------------------------------------------ */

/** 대표 답이 있어야 채워지는 칸(회사 기록에는 없는 사업 이야기) */
export const VENTURE_OWNER_SECTIONS: readonly VentureSectionId[] = ['problem', 'product', 'market', 'proof']
/** 준비 패키지를 한 번 열어 본 표시(work.notes) — 1단계 '벤처 준비 확인' 이 끝났다는 뜻 */
export const VENTURE_REVIEWED_KEY = 'venture:_reviewed'

export interface VentureRoute {
  type: 'investment' | 'rnd' | 'growth' | 'pre'
  label: string
  /** fit 검토할 만함 · check 확인 필요 · no 해당 없음 */
  state: 'fit' | 'check' | 'no'
  text: string
}

/**
 * 유형별 길(벤처기업법 제2조의2 · 확인요령) — 정보가 모자라면 유형을 확정하지 않고 '확인 필요'.
 * 판정 숫자는 assessVenture 와 같은 기준(연구조직 · 연구개발비 5천만원 · 비율)을 그대로 읽는다.
 */
export function ventureRoutes(c: CertificationClientContext): VentureRoute[] {
  const lab = c.researchUnit === 'lab' || c.researchUnit === 'dept'
  const exact = c.rndExpense
  const range = c.rndRange
  const rnd: VentureRoute =
    c.researchUnit === null
      ? { type: 'rnd', label: '연구개발유형', state: 'check', text: '연구소 · 전담부서가 있는지 먼저 확인' }
      : !lab
        ? { type: 'rnd', label: '연구개발유형', state: 'no', text: '연구소 · 전담부서가 있어야 함 — 지금은 해당 없음' }
        : exact !== null
          ? exact >= 50_000_000
            ? { type: 'rnd', label: '연구개발유형', state: 'fit', text: '연구조직 · 연구개발비 5천만원 이상 — 매출 대비 비율 확인' }
            : { type: 'rnd', label: '연구개발유형', state: 'no', text: '연구개발비 5천만원 미만' }
          : range === 'none' || range === 'under_50m'
            ? { type: 'rnd', label: '연구개발유형', state: 'no', text: '연구개발비 5천만원 미만(고른 범위)' }
            : { type: 'rnd', label: '연구개발유형', state: 'check', text: '연구조직 있음 · 정확한 연구개발비 확인 필요' }
  const growth: VentureRoute =
    (c.patents ?? 0) > 0 || lab || c.rndPlan || c.legacyVenture?.patentStatus === 'filed'
      ? { type: 'growth', label: '혁신성장유형', state: 'fit', text: '기술성 · 성장성을 확인기관이 평가 — 사업계획 · 기술 근거로 준비' }
      : c.patents === null && c.researchUnit === null
        ? { type: 'growth', label: '혁신성장유형', state: 'check', text: '특허 · 연구조직 · 기술 계획을 확인하면 판단' }
        : { type: 'growth', label: '혁신성장유형', state: 'check', text: '기술 근거(특허 · 연구 · 혁신 제품)가 약함 — 사업계획으로 보강 필요' }
  return [
    rnd,
    growth,
    { type: 'investment', label: '벤처투자유형', state: 'check', text: c.legacyVenture?.fundingNow ? `이전 기록 '${c.legacyVenture.fundingNow}' — 벤처투자기관 투자인지 · 금액 확인` : '벤처투자기관 투자 유치 여부 · 금액을 대표님께 확인' },
    { type: 'pre', label: '예비벤처', state: c.years !== null ? 'no' : 'check', text: c.years !== null ? '창업 전 개인용 — 이미 사업 중이면 해당 없음' : '창업 전인지 확인' },
  ]
}

export type VentureStage = 'check' | 'owner' | 'plan' | 'submit' | 'applied' | 'done'
export const VENTURE_STAGE_LABEL: Record<VentureStage, string> = {
  check: '준비 확인',
  owner: '대표 확인',
  plan: '사업계획 준비',
  submit: '제출 전 확인',
  applied: '신청 · 확인기관 평가 중',
  done: '벤처 확인 완료',
}

export interface VentureProgress {
  stage: VentureStage
  /** 대표 답이 필요한 칸 */
  ownerLeft: number
  ownerTotal: number
  okCount: number
  sectionCount: number
}

/** 지금 단계 — 준비 확인 → 대표 확인 → 사업계획 준비 → 제출 전 확인 → 신청 · 평가 → 완료 */
export function ventureProgress(input: { sections: readonly VentureSection[]; notes: Record<string, string>; hasBizPlan: boolean; status: 'preparing' | 'submitted' | 'done' }): VentureProgress {
  const owner = input.sections.filter((s) => VENTURE_OWNER_SECTIONS.includes(s.id))
  const ownerLeft = owner.filter((s) => s.state !== 'ok').length
  const base = { ownerLeft, ownerTotal: owner.length, okCount: input.sections.filter((s) => s.state === 'ok').length, sectionCount: input.sections.length }
  if (input.status === 'done') return { ...base, stage: 'done' }
  if (input.status === 'submitted') return { ...base, stage: 'applied' }
  if (!(input.notes[VENTURE_REVIEWED_KEY] ?? '').trim()) return { ...base, stage: 'check' }
  if (ownerLeft > 0) return { ...base, stage: 'owner' }
  if (!input.hasBizPlan) return { ...base, stage: 'plan' }
  return { ...base, stage: 'submit' }
}

export interface VentureCheckRow {
  key: 'route' | 'docs' | 'owner' | 'plan'
  label: string
  mark: 'ok' | 'check' | 'todo'
  text: string
}

/** 벤처 제출 전 확인 — 네 줄(신청 유형 · 기본 자료 · 대표 확인 · 사업계획). 공식 점수 · 확률 없음 */
export function ventureSubmitCheck(input: { routes: readonly VentureRoute[]; progress: VentureProgress; missingEvidence: readonly string[]; haveEvidence: readonly string[] }): VentureCheckRow[] {
  const fit = input.routes.filter((r) => r.state === 'fit')
  const basicMissing = input.missingEvidence.filter((m) => /사업자등록증|재무제표/.test(m))
  const planMissing = input.missingEvidence.some((m) => /사업계획/.test(m))
  return [
    fit.length
      ? { key: 'route', label: '신청 유형', mark: 'ok', text: `${fit.map((r) => r.label).join(' · ')} 검토` }
      : { key: 'route', label: '신청 유형', mark: 'check', text: '유형을 정할 정보가 모자람 — 연구조직 · 연구개발비 · 투자 확인' },
    basicMissing.length ? { key: 'docs', label: '기본 자료', mark: 'check', text: `${basicMissing.join(' · ')} 받기` } : { key: 'docs', label: '기본 자료', mark: 'ok', text: '사업자등록증 · 재무제표 있음' },
    input.progress.ownerLeft ? { key: 'owner', label: '대표 확인', mark: 'todo', text: `사업 이야기 ${input.progress.ownerLeft}칸 대표 답 필요` } : { key: 'owner', label: '대표 확인', mark: 'ok', text: '대표 답 모두 받음' },
    planMissing ? { key: 'plan', label: '사업계획', mark: 'todo', text: '사업계획서(최근 것) 받기 — 혁신성장유형 평가 자료' } : { key: 'plan', label: '사업계획', mark: 'ok', text: '사업계획서 있음' },
  ]
}
