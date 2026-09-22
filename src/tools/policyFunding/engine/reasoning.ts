// Reasoning Engine — 왜 이렇게 판단했는지 사람처럼 설명.
// 예: "제조업이며 특허를 보유하고 있고 시설투자 목적이기 때문에
//      기술보증기금이 가장 적합합니다. 다만 최근 재무제표와 부채비율 확인이 필요합니다."

import type { KnowledgeBase, Profile } from "./knowledgeEngine";
import type {
  AgencyRecommendation,
  RiskAssessment,
  SimilarCase,
} from "../types";

const STRENGTH_CLAUSE: Record<string, string> = {
  제조업: "제조 기반이고",
  기술력: "기술력을 갖췄으며",
  특허: "특허를 보유하고 있고",
  연구소: "부설연구소를 운영하고 있으며",
  벤처: "벤처 요건을 갖췄고",
  청년대표: "청년 대표이며",
  고용증가: "고용을 늘리고 있고",
  수출: "수출 실적이 있으며",
};

export function generateReasoning(
  profile: Profile,
  agencies: AgencyRecommendation[],
  cases: SimilarCase[],
  risk: RiskAssessment,
  kb: KnowledgeBase,
): string {
  const i = profile.input;
  const top = agencies[0]?.name ?? "신용보증기금";
  const industry = i.industry || profile.industryCategory;

  // 강점 절 구성
  const clauses = i.strengths
    .filter((s) => s !== "없음")
    .map((s) => STRENGTH_CLAUSE[s])
    .filter(Boolean);
  const strengthPart =
    clauses.length > 0 ? clauses.join(" ") + " " : "";

  const purposeLabel = i.purpose === "시설자금" ? "시설투자" : i.purpose;

  // 1문장: 판단 근거
  const first =
    `${industry}이며 ${strengthPart}${purposeLabel} 목적이기 때문에 ` +
    `${top}이(가) 가장 적합합니다.`;

  // 2문장: 사례 근거
  const strongCases = cases.filter((c) => (c.matchRate ?? 0) >= 55).length;
  const casePart =
    strongCases > 0
      ? ` 비슷한 조건의 승인 사례도 ${strongCases}건 확인됩니다.`
      : "";

  // 3문장: 리스크 기반 유의점 (checkpoints/risk 활용)
  const cautionSeed =
    agencies[0]?.cautions[0] ??
    risk.factors[0] ??
    "재무제표와 기대출 상태 확인이 필요합니다.";
  const cautionShort = cautionSeed.replace(/[.!?]$/, "");
  const checkpointHint = kb.checkpoints.find((c) =>
    ["taxArrears", "financialStatement", "existingDebt"].includes(c.key),
  );
  const third =
    ` 다만 ${cautionShort}. ` +
    (i.credit === "낮음"
      ? "신용이 낮은 편이라 저신용 대응 상품부터 단계적으로 접근하는 것이 안전합니다."
      : `${checkpointHint ? "세금 체납·재무제표·기대출" : "재무제표와 부채비율"} 확인을 먼저 권합니다.`);

  return first + casePart + third;
}
