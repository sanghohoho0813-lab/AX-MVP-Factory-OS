// Growth Engine — 업종별 성장 포인트(심사관이 좋아하는 키워드)를
// knowledge/industry-growth-points.json 에서 읽는다.

import type { IndustryCategory } from "../types";
import growthJson from "../knowledge/industry-growth-points.json";

export interface GrowthPoints {
  category: string;
  keywords: string[];
  reviewerNote: string;
  storyHooks: string[];
}

const GROWTH = (growthJson as unknown as { industries: GrowthPoints[] })
  .industries;

export function getGrowthPoints(category: IndustryCategory): GrowthPoints {
  return (
    GROWTH.find((g) => g.category === category) ??
    GROWTH.find((g) => g.category === "건설/기타")!
  );
}

export function allGrowthKeywordCount(): number {
  return GROWTH.reduce((sum, g) => sum + g.keywords.length, 0);
}
