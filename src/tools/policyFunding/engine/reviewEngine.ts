// Review Engine — 심사관 시뮬레이터.
// knowledge/review-objections.json (질문+모범답안) 과 review-checkpoints.json
// (기관별 심사 관점)을 읽어, 기관·목적·상태별 예상 질문과 답변을 조립한다.

import type { Profile } from "./knowledgeEngine";
import type { ReviewQA, ReviewSimulation } from "../types";
import objectionsJson from "../knowledge/review-objections.json";
import checkpointsJson from "../knowledge/review-checkpoints.json";

interface ObjectionItem {
  q: string;
  answer: string;
  when?: string;
}
interface ByAgency {
  agencyKey: string;
  items: ObjectionItem[];
}
interface ByPurpose {
  purposeKey: string;
  match: string[];
  items: ObjectionItem[];
}
const OBJ = objectionsJson as unknown as {
  common: ObjectionItem[];
  byAgency: ByAgency[];
  byPurpose: ByPurpose[];
};

interface AgencyCheckpoint {
  agencyKey: string;
  agencyName: string;
  probeAreas: string[];
  reviewerMindset: string;
}
const CHK = checkpointsJson as unknown as { byAgency: AgencyCheckpoint[] };

// 기관명 → agencyKey
const AGENCY_KEY: Record<string, string> = {
  기술보증기금: "kibo",
  신용보증기금: "kodit",
  중소벤처기업진흥공단: "kosme",
  소상공인시장진흥공단: "semas",
  지역신용보증재단: "regional",
  미소금융: "misaeng",
};

// when 조건 평가 (질문 노출 여부)
function whenApplies(when: string | undefined, p: Profile): boolean {
  if (!when) return true;
  switch (when) {
    case "debtHeavy":
      return p.debtHeavy || p.heavySecondFinance;
    case "lowCredit":
      return p.lowCredit;
    case "declining":
      return (
        p.input.revenueTrend3y === "감소" || p.input.thisYearTrend === "감소"
      );
    default:
      return false;
  }
}

// 플레이스홀더 치환
function fill(text: string, p: Profile): string {
  return text
    .replaceAll("{company}", p.companyName)
    .replaceAll("{industry}", p.input.industry || p.industryCategory)
    .replaceAll("{purpose}", p.input.purpose)
    .replaceAll(
      "{career}",
      p.input.ceoCareer && p.input.ceoCareer !== "미확인"
        ? p.input.ceoCareer
        : "XX년",
    );
}

export function buildReviewSimulation(
  profile: Profile,
  topAgency: string,
): ReviewSimulation {
  const key = AGENCY_KEY[topAgency] ?? "semas";
  const items: ReviewQA[] = [];
  const push = (o: ObjectionItem) => {
    if (!items.some((x) => x.question === o.q)) {
      items.push({ question: fill(o.q, profile), answer: fill(o.answer, profile) });
    }
  };

  // 1) 목적별 질문 (가장 구체적 — 맨 앞)
  const raw: (string | undefined)[] = [
    profile.input.purpose,
    profile.input.workingCapitalUse,
    profile.input.facilityUse,
  ];
  const signals = raw.filter((s): s is string => Boolean(s) && s !== "해당없음");
  for (const bp of OBJ.byPurpose) {
    if (bp.match.some((m) => signals.includes(m))) bp.items.forEach(push);
  }

  // 2) 기관별 질문
  const ba = OBJ.byAgency.find((x) => x.agencyKey === key);
  ba?.items.forEach(push);

  // 3) 공통 질문 (when 조건 충족만)
  for (const c of OBJ.common) {
    if (whenApplies(c.when, profile)) push(c);
  }

  const chk = CHK.byAgency.find((x) => x.agencyKey === key);

  return {
    agency: topAgency,
    mindset:
      chk?.reviewerMindset ??
      "자금 사용처의 구체성과 상환 가능성을 중심으로 확인합니다.",
    items: items.slice(0, 8),
  };
}

export function reviewQuestionStats(): number {
  return (
    OBJ.common.length +
    OBJ.byAgency.reduce((s, a) => s + a.items.length, 0) +
    OBJ.byPurpose.reduce((s, p) => s + p.items.length, 0)
  );
}
