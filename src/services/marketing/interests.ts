/**
 * D-558 관심 분야(계정마다) → '이번 주 뜨는 주제' 10개.
 * 대표(2026-11-09): "이번 주 뜨는 주제도 사용자들마다 원하는 주제가 다르니 계정마다 관심 분야를 고를 수 있게".
 *
 * 쉬운 말 묶음 10개 → 레이더 주제 번호(TOPICS)로 바꿔, 고른 분야의 주제가 10개 맨 앞에 오고 남은 자리는 요즘 뜨는 다른 주제.
 * 아무것도 안 고르면 예전 그대로(모든 분야). 고른 값은 작업공간마다 레이더 설정(radar prefs)에 — 대표 · 팀장 · 구독 계정이 따로.
 * 우리 본업 주제(고정 다섯)는 늘 따로 보이므로 여기서 골라도 10개에는 다시 나오지 않는다.
 */

export interface InterestGroup {
  id: string
  label: string
  /** 칩 아래 작은 글씨 — 무엇이 들어 있나 */
  hint: string
  topics: readonly string[]
}

export const INTEREST_GROUPS: readonly InterestGroup[] = [
  { id: 'gov_money', label: '정부 돈', hint: '정책자금 · 지원금 · 지원사업', topics: ['policy_fund', 'employ_subsidy', 'grant_program', 'sme_subsidy'] },
  { id: 'tax', label: '세금 · 절세', hint: '절세 · 세무조사 · 창업감면 · 세법', topics: ['tax_saving', 'tax_audit', 'startup_tax', 'econ_policy'] },
  { id: 'corp', label: '법인 · 승계', hint: '법인전환 · 가업승계 · 대표 급여', topics: ['incorporation', 'succession', 'ceo_money'] },
  { id: 'cert', label: '기업인증', hint: '벤처 · 연구소 · 이노비즈', topics: ['certification'] },
  { id: 'hr', label: '인사 · 채용', hint: '채용 · 노무 · 고용지원금', topics: ['hr', 'employ_subsidy'] },
  { id: 'finance', label: '재무 · 금리', hint: '현금흐름 · 대출 금리 · 비용 절감', topics: ['finance', 'rate', 'cost_cut'] },
  { id: 'economy', label: '경기 · 시장', hint: '경기 · 물가 · 환율 · 수출 · 부동산', topics: ['economy_cycle', 'prices', 'fx', 'trade', 'sme_economy', 'stocks', 'real_estate'] },
  { id: 'growth', label: '마케팅 · 창업', hint: '영업 · 사업전략 · 경영관리', topics: ['marketing', 'strategy', 'management'] },
  { id: 'ai_tools', label: 'AI 도구', hint: 'ChatGPT · Claude · Gemini 업무 활용', topics: ['chatgpt', 'claude', 'gemini', 'codex', 'astra', 'sol', 'notebooklm', 'ai_docs', 'ai_marketing', 'ai_agent', 'prompt', 'ai_work', 'vibe_coding'] },
  { id: 'automation', label: '업무 자동화', hint: '엑셀 · 노코드 · 사내 시스템', topics: ['nocode', 'sheets', 'ax_adopt', 'inhouse', 'automation'] },
]

const IDS = new Set(INTEREST_GROUPS.map((g) => g.id))

/** 저장된 값 → 아는 묶음 번호만 · 겹치지 않게 · 최대 10 */
export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && IDS.has(x)))].slice(0, INTEREST_GROUPS.length)
}

/** 고른 묶음 → 레이더 주제 번호(겹치지 않게) */
export function interestTopics(groups: readonly string[]): string[] {
  const want = new Set(groups)
  return [...new Set(INTEREST_GROUPS.filter((g) => want.has(g.id)).flatMap((g) => g.topics))]
}

/** 한 줄 — '정부 돈 · 세금 · 절세' (없으면 '') */
export const interestLine = (groups: readonly string[]) =>
  INTEREST_GROUPS.filter((g) => groups.includes(g.id))
    .map((g) => g.label)
    .join(' · ')
