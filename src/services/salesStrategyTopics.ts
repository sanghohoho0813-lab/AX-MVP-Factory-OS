/**
 * D-167 영업 관리 › 전략 — 세 목록(영업 전략 17 · 크레탑 무기 34 · 절세 전략 25)을 주제 하나로 합치는 규칙.
 * 대표: "똑같으면 굳이 76개로 나눠 놓을 이유가 없다" — 가지급금 · 정관 · 연구소 같은 주제가 세 곳에 따로 있었다.
 *
 * D-602(2026-11-12 대표 "스레드 1번 '무엇에 대해 쓸까요' 에 영업 관리 › 전략 40여 개를 키워드로 넣는 게 낫다") —
 * 전략 탭(StrategyLibraryPage)과 스레드 · 릴스/틱톡 주제 칩이 이 파일 하나를 본다(같은 주제는 한 줄 · 탭과 같은 순서).
 */
import { STRATEGY_LIBRARY } from './salesEngine'
import { CRETOP_WEAPONS, TAX_STRATEGIES } from './salesLibrary'

export const STRATEGY_TOPIC_RULES: [string, RegExp][] = [
  ['articles', /정관/],
  ['retained', /미처분|이익잉여금/],
  ['succession', /가업승계|증여특례/],
  ['loan', /가지급금/],
  ['deposit', /가수금/],
  ['rnd-credit', /연구인력개발비/],
  ['lab', /연구소|전담부서/],
  ['welfare', /사내근로복지기금/],
  ['venture', /벤처/],
  ['innobiz', /이노비즈|메인비즈/],
  ['policy', /정책자금/],
  ['employ-sub', /고용지원금/],
  ['employ-credit', /통합고용세액공제/],
  ['exec-pay', /임원퇴직금|임원보수/],
  ['share-value', /주식가치/],
  ['burn', /이익소각|자기주식/],
  ['dividend', /배당/],
  ['insurance', /법인보험|퇴직연금|목적자금/],
  ['conversion', /법인전환/],
  ['related', /특수관계자|관계사/],
]

/** 이 이름이 묶이는 주제 열쇠(규칙에 없으면 이름 그대로) */
export function strategyTopicKey(name: string): string {
  return STRATEGY_TOPIC_RULES.find(([, re]) => re.test(name))?.[0] ?? name
}

/** 전략 탭의 주제 이름 — 같은 주제는 처음 나온 이름 하나 · 탭과 같은 순서(영업 전략 → 절세 전략 → 크레탑 무기) */
export function strategyTopicNames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (name: string) => {
    const n = name.trim()
    if (!n) return
    const k = strategyTopicKey(n)
    if (seen.has(k)) return
    seen.add(k)
    out.push(n)
  }
  for (const s of STRATEGY_LIBRARY) add(s.name)
  for (const t of TAX_STRATEGIES) add(t.name)
  for (const g of CRETOP_WEAPONS) for (const w of g.items) add(w.name)
  return out
}
