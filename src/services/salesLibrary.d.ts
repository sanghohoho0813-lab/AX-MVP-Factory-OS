/** 전략 라이브러리 재료 타입 (D-114 4단계) — 구현은 salesLibrary.js (원본 SalesApp.jsx 에서 옮김) */

/** 크레탑 무기 — 이름 · 고객이 관심 가질 이유(p) · 크레탑에서 볼 것(r) · 질문(q) · 자료(d) */
export interface CretopWeapon {
  name: string
  p: string
  r: string
  q: string
  d: string
}
export const CRETOP_WEAPONS: { cat: string; items: CretopWeapon[] }[]

export interface TaxStrategy {
  id: string
  name: string
  cat: string
  topic: string
  concept: string
  who: string
  question: string
  docs: string[]
  caution: string
  ment: string
}
export const TAX_STRAT_DEFS: [string, string, string, string, string, string, string[], string][]
export const TAX_STRATEGIES: TaxStrategy[]
export function buildTaxStrategies(): TaxStrategy[]

export interface ProposalTopic {
  key: string
  name: string
  kw: string[]
  cats: string[]
  pkgCats: string[]
  industries?: string[]
  action: string
}
export const PROPOSAL_TOPICS: ProposalTopic[]
