// Confidence Calculator — 진단 신뢰도(0~100).
// "점수"가 아니라 "AI가 이 진단을 얼마나 확신하는지"를 계산한다.
// 데이터 충분성 + 사례 근거 + 기관 판단의 명확성으로 산정.

import type { Profile } from "./knowledgeEngine";
import type {
  AgencyRecommendation,
  ConfidenceAssessment,
  SimilarCase,
} from "../types";

export function calculateConfidence(
  profile: Profile,
  agencies: AgencyRecommendation[],
  cases: SimilarCase[],
): ConfidenceAssessment {
  let score = 50;
  const reasons: string[] = [];
  const i = profile.input;

  // 1) 데이터 충분성
  if (i.industry.trim()) {
    score += 10;
  } else {
    score -= 10;
    reasons.push("업종 미입력 — 업종을 알려주시면 정확도가 올라갑니다.");
  }
  if (i.strengths.filter((s) => s !== "없음").length > 0) {
    score += 8;
    reasons.push("보유 강점이 입력되어 기관 판단 근거가 충분합니다.");
  }
  if (i.credit !== "알 수 없음") score += 6;
  else {
    score -= 8;
    reasons.push("대표 신용 미확인 — 신용 확인 후 재진단을 권합니다.");
  }
  if (i.memo.trim().length >= 20) score += 4;
  if (i.companyName.trim()) score += 2;

  // 2) 사례 근거
  const best = cases[0]?.matchRate ?? 0;
  const strong = cases.filter((c) => (c.matchRate ?? 0) >= 55).length;
  if (best >= 70) {
    score += 12;
    reasons.push(`유사 승인 사례가 충분합니다 (최고 매칭 ${best}%).`);
  } else if (best >= 55) {
    score += 6;
    reasons.push(`유사 사례가 확인됩니다 (최고 매칭 ${best}%).`);
  } else {
    reasons.push("딱 맞는 유사 사례가 적어 추가 정보가 있으면 좋습니다.");
  }
  score += Math.min(8, strong * 2);

  // 3) 기관 판단 명확성
  const gap = (agencies[0]?.score ?? 0) - (agencies[1]?.score ?? 0);
  if (gap >= 15) {
    score += 10;
    reasons.push("1순위 기관이 명확히 앞섭니다.");
  } else if (gap >= 8) {
    score += 5;
  } else {
    reasons.push("상위 기관 간 점수가 근접해 병행 전략 검토가 필요합니다.");
  }

  score = Math.max(40, Math.min(98, Math.round(score)));

  const level: ConfidenceAssessment["level"] =
    score >= 85 ? "매우 높음" : score >= 70 ? "높음" : score >= 55 ? "보통" : "낮음";

  return { score, level, reasons: reasons.slice(0, 5) };
}
