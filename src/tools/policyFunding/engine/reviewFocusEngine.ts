// Review Focus Engine — 기관별 심사관 우선순위(별점)를 읽는다.
// '이 기관 심사관이 무엇을 먼저 보는가'를 review-focus.json 에서 조회한다.

import type { ReviewFocus, ReviewFocusItem } from "../types";
import reviewFocusJson from "../knowledge/review-focus.json";
import { AGENCY_KEY } from "./strategyEngine";

interface FocusItemDef {
  label: string;
  stars: number;
  note: string;
}
interface AgencyFocusDef {
  agencyKey: string;
  agencyName: string;
  mindset: string;
  focus: FocusItemDef[];
}

const BY_AGENCY = (
  reviewFocusJson as unknown as { byAgency: AgencyFocusDef[] }
).byAgency;

function keyOf(agencyName: string): string {
  if (AGENCY_KEY[agencyName]) return AGENCY_KEY[agencyName];
  const hit = Object.keys(AGENCY_KEY).find((n) => agencyName.includes(n));
  return hit ? AGENCY_KEY[hit] : "semas";
}

export function getReviewFocus(topAgency: string): ReviewFocus {
  const key = keyOf(topAgency);
  const def =
    BY_AGENCY.find((a) => a.agencyKey === key) ??
    BY_AGENCY.find((a) => a.agencyKey === "semas")!;
  const focus: ReviewFocusItem[] = def.focus
    .slice()
    .sort((a, b) => b.stars - a.stars)
    .map((f) => ({ label: f.label, stars: f.stars, note: f.note }));
  return { agency: def.agencyName, mindset: def.mindset, focus };
}

export function reviewFocusPointCount(): number {
  return BY_AGENCY.reduce((sum, a) => sum + a.focus.length, 0);
}
