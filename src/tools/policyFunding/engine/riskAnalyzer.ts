// 리스크 분석 — precheck-rules / checkpoints 기반으로 5단계 리스크와 사유 산출.
// 매우 낮음 / 낮음 / 보통 / 높음 / 매우 높음

import type { KnowledgeBase, Profile } from "./knowledgeEngine";
import type { RiskAssessment, RiskLevel } from "../types";

export function analyzeRisk(
  profile: Profile,
  kb: KnowledgeBase,
): RiskAssessment {
  let score = 25; // 기본 리스크
  const factors: string[] = [];
  const i = profile.input;

  // 신용
  if (i.credit === "낮음") {
    score += 22;
    factors.push("대표 신용이 낮아 한도 축소·거절 가능성이 있습니다.");
  } else if (i.credit === "알 수 없음") {
    score += 10;
    factors.push("대표 신용 미확인 — 조회 전까지 접근 상품이 갈립니다.");
  } else if (i.credit === "우수") {
    score -= 8;
  }

  // 업력
  if (i.years === "1년 미만") {
    score += 14;
    factors.push("업력 1년 미만으로 매출 실적이 부족할 수 있습니다.");
  } else if (i.years === "7년 이상") {
    score -= 4;
  }

  // 자금목적
  if (i.purpose === "저신용자금" || i.purpose === "긴급자금") {
    score += 6;
    factors.push(`${i.purpose} 성격상 시기·상품 제약이 있을 수 있습니다.`);
  }

  // 업종 담보/기술 근거
  if (
    profile.industryCategory === "음식/외식" ||
    profile.industryCategory === "도소매"
  ) {
    score += 6;
    factors.push(
      `${profile.industryCategory} 업종은 담보·기술 근거가 약해 한도가 제한적일 수 있습니다.`,
    );
  }

  // 강점 부재
  if (!profile.hasTech && !profile.hasManufacturing && !profile.hasExport) {
    score += 6;
    factors.push("뚜렷한 가점 요소가 적어 재무·성실납세로 승부해야 합니다.");
  } else {
    score -= 4;
  }

  // 규모/소상공인 기준
  if (i.employees === "10명 이상" && profile.industryCategory !== "제조") {
    score += 4;
  }

  // precheck 최상위 결격(세금·4대보험) — 사전 점검 리마인드 (항상 포함)
  const blocker = kb.preRestrictions.find((r) => r.severity === "blocker");
  if (blocker) {
    factors.push(
      `${blocker.label} 여부를 먼저 확인해야 합니다(미정리 시 접수 자체가 막힙니다).`,
    );
  }

  // 예산·시기
  factors.push("정책자금은 예산·접수 시기의 영향을 받습니다.");

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: RiskLevel =
    score < 20
      ? "매우 낮음"
      : score < 35
        ? "낮음"
        : score < 52
          ? "보통"
          : score < 70
            ? "높음"
            : "매우 높음";

  const explanation =
    `현재 정보 기준 리스크는 '${level}'입니다. ` +
    (factors[0] ?? "특이 리스크는 낮은 편입니다.") +
    " 접수 전 세금·4대보험·기대출·재무제표를 함께 점검하면 리스크를 낮출 수 있습니다.";

  return { level, score, factors: factors.slice(0, 5), explanation };
}
