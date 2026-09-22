// Upsell Engine — knowledge/upsell-rules.json 트리거를 프로필로 평가하고
// knowledge/funding-upsells.json 카탈로그와 연결해 우선순위 TOP5 를 추천.

import type { KnowledgeBase, Profile, UpsellRule } from "./knowledgeEngine";
import type { UpsellSuggestion } from "../types";

// NL 트리거를 프로필 조건으로 해석 (지식=트리거→항목은 JSON, 평가만 엔진)
function matchesTrigger(rule: UpsellRule, p: Profile): boolean {
  const t = rule.trigger;
  if (t.includes("직원 증가") || t.includes("고용 증가")) return p.hasEmploymentGrowth;
  if (t.includes("직원 있음")) return p.input.employees !== "0명";
  if (t.includes("제조") || t.includes("기술") || t.includes("특허"))
    return p.hasManufacturing || p.hasTech;
  if (t.includes("매출 10억 이상 법인")) return p.isCorp && p.revenueIdx >= 3;
  if (t.includes("창업 초기") || t.includes("청년"))
    return p.isYouth || p.input.years === "1년 미만" || p.input.purpose === "창업자금";
  if (t.includes("수출")) return p.hasExport;
  if (t.includes("R&D")) return p.hasTech || p.industryCategory === "IT/지식서비스";
  if (t.includes("개인사업자 매출 증가")) return !p.isCorp && p.revenueIdx >= 2;
  // 승인 후 재접촉/재무제표 오류 등 진단 시점에 판단 불가한 트리거는 제외
  return false;
}

export function recommendUpsells(
  profile: Profile,
  kb: KnowledgeBase,
): UpsellSuggestion[] {
  const catalog = new Map(kb.upsells.map((u) => [u.key, u]));
  const orderedKeys: string[] = [];

  // rules 순서 = 우선순위. 매칭된 rule 의 recommendKeys 를 순서대로 수집.
  for (const rule of kb.upsellRules) {
    if (!matchesTrigger(rule, profile)) continue;
    for (const k of rule.recommendKeys) {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }
  }

  const suggestions: UpsellSuggestion[] = orderedKeys
    .map((k) => catalog.get(k))
    .filter((u): u is NonNullable<typeof u> => Boolean(u))
    .map((u) => ({ title: u.name, desc: u.consultingScript }));

  if (suggestions.length === 0) {
    suggestions.push({
      title: "정기 정책자금 점검",
      desc: "지금 당장 큰 업셀 포인트는 적지만, 분기별 정책자금 점검 리마인드로 재접촉 관계를 유지하세요.",
    });
  }

  return suggestions.slice(0, 5);
}
