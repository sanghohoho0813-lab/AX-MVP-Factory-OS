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
  const facts: Record<VentureSectionId, (Sourced | null)[]> = {
    basic: [c.companyName ? { text: `회사명 ${c.companyName}`, basis: '업체 기록' } : null, line('업력', 'years'), line('업종', 'industry'), line('직원', 'employees')],
    problem: [],
    product: [line('업종', 'industry')],
    tech: [line('연구조직', 'researchUnit'), line('특허', 'patents')],
    market: [line('B2B 납품', 'b2b'), line('조달 · 입찰', 'procurement'), line('수출', 'exportPlan')],
    growth: [line('매출', 'revenue'), line('영업이익', 'operatingProfit'), doc('fin3', '재무제표(서류함)')],
    rnd: [line('연구조직', 'researchUnit'), line('연구전담요원', 'researchers'), line('연구개발비', 'rndExpense'), doc('lab_cert', '연구소 · 전담부서 인정서(서류함)')],
    ip: [line('특허', 'patents'), doc('patent', '특허 등록증(서류함)')],
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
