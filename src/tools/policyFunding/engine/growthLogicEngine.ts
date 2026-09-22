// Growth Logic Engine — 업종별 '성장 논리 사슬'을 읽는다.
// 자금이 어떻게 매출·고용으로 돌아오는지 인과 고리를 growth-logic.json 에서 조회한다.

import type { IndustryCategory, GrowthLogic } from "../types";
import growthLogicJson from "../knowledge/growth-logic.json";

interface GrowthLogicDef {
  category: string;
  chain: string[];
  logic: string;
  reviewerNote: string;
  keywords: string[];
}

const INDUSTRIES = (
  growthLogicJson as unknown as { industries: GrowthLogicDef[] }
).industries;

export function getGrowthLogic(category: IndustryCategory): GrowthLogic {
  const g =
    INDUSTRIES.find((x) => x.category === category) ??
    INDUSTRIES.find((x) => x.category === "건설/기타")!;
  return {
    category: g.category,
    chain: g.chain,
    logic: g.logic,
    reviewerNote: g.reviewerNote,
    keywords: g.keywords,
  };
}

export function growthLogicCount(): number {
  return INDUSTRIES.length;
}
