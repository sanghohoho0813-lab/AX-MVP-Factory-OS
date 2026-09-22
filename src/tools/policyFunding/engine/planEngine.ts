// Plan Engine — 사업계획 완성도 점수(100점) + 기관별 평가 Framework 조회.
// 차원 정의는 knowledge/business-plan-frameworks.json(scoreDimensions)에서 읽고,
// 엔진은 프로필 신호로 각 차원의 충족도만 계산한다.

import type { Profile } from "./knowledgeEngine";
import type { PlanScore, PlanScoreDimension } from "../types";
import frameworksJson from "../knowledge/business-plan-frameworks.json";

export interface AgencyFramework {
  agencyKey: string;
  agencyName: string;
  focus: string[];
  emphasis: string;
  storyTone: string;
  planPriorities: string[];
}
interface DimensionDef {
  key: string;
  label: string;
  max: number;
}
const FW = frameworksJson as unknown as {
  frameworks: AgencyFramework[];
  scoreDimensions: DimensionDef[];
};

export function getFramework(agencyName: string): AgencyFramework {
  return (
    FW.frameworks.find(
      (f) => f.agencyName === agencyName || agencyName.includes(f.agencyName),
    ) ?? FW.frameworks.find((f) => f.agencyKey === "semas")!
  );
}

export function frameworkCount(): number {
  return FW.frameworks.length;
}

// 차원별 충족도(0~1)와 부족 시 코멘트
function assess(profile: Profile, key: string): { ratio: number; note?: string } {
  const i = profile.input;
  const clarity = (v?: string) => (v === "명확함" ? 1 : v === "보통" ? 0.6 : v === "불명확" ? 0.25 : 0.35);
  const yn = (v?: string) => (v === "있음" ? 1 : v === "없음" ? 0.2 : 0.4);

  switch (key) {
    case "tech": {
      // 기술 비중이 낮은 업종(음식·도소매·서비스 등)은 중립 처리 — 노이즈 방지
      const techIndustry =
        profile.industryCategory === "제조" ||
        profile.industryCategory === "IT/지식서비스";
      if (!techIndustry && !profile.hasTech) {
        return { ratio: 0.55 };
      }
      let r = 0.25;
      if (profile.hasTech) r += 0.3;
      if (profile.hasPatent) r += 0.2;
      if (profile.hasLab) r += 0.15;
      if (profile.hasCerts) r += 0.1;
      return {
        ratio: Math.min(1, r),
        note: profile.hasTech ? undefined : "기술·특허·인증 근거가 없습니다. 기술 요소가 있다면 증빙을 확보하세요.",
      };
    }
    case "market": {
      const r = 0.2 + (profile.hasMajorClients ? 0.35 : 0) + (profile.growth ? 0.25 : 0) + clarity(i.growthPlan) * 0.2;
      return {
        ratio: Math.min(1, r),
        note: profile.hasMajorClients ? undefined : "거래처·수요처 확보 근거가 약합니다. 계약서·발주서를 확보하세요.",
      };
    }
    case "evidence": {
      const r =
        yn(i.assetEvidence) * 0.4 +
        (i.bizPlanReadiness === "자료 충분" ? 0.35 : i.bizPlanReadiness === "초안 있음" ? 0.2 : 0.05) +
        yn(i.majorClients) * 0.25;
      return {
        ratio: Math.min(1, r),
        note: i.assetEvidence === "있음" ? undefined : "눈으로 보여줄 자료(사진·견적·계약)가 부족합니다.",
      };
    }
    case "revenueLogic": {
      const r =
        0.15 +
        (profile.growth ? 0.3 : 0.05) +
        (i.netProfit === "흑자" ? 0.25 : i.netProfit === "손익분기" ? 0.15 : 0.05) +
        clarity(i.fundUseClarity) * 0.3;
      return {
        ratio: Math.min(1, r),
        note: profile.growth ? undefined : "매출 증가 논리(과거 추세·수요 근거)를 보완하세요.",
      };
    }
    case "employmentLogic": {
      const r =
        (i.employees !== "0명" ? 0.4 : 0.1) +
        (i.hiringPlan === "있음" ? 0.3 : 0.05) +
        (i.youthEmployment === "있음" || i.youthEmployment === "예정" ? 0.3 : 0.05);
      return {
        ratio: Math.min(1, r),
        note: i.hiringPlan === "있음" ? undefined : "고용 창출 계획이 없습니다. 채용 계획이 있으면 큰 가점입니다.",
      };
    }
    case "facilityLogic": {
      if (!profile.facilityIntent) {
        return { ratio: clarity(i.fundUseClarity) * 0.8, note: undefined };
      }
      const r =
        0.15 +
        (i.selfFunding === "있음" ? 0.3 : i.selfFunding === "일부 있음" ? 0.2 : 0.05) +
        yn(i.assetEvidence) * 0.3 +
        (i.facilityUse && i.facilityUse !== "해당없음" ? 0.25 : 0.05);
      return {
        ratio: Math.min(1, r),
        note: i.selfFunding === "없음" ? "자기자금 준비가 없습니다. 일부라도 준비하면 신뢰가 올라갑니다." : yn(i.assetEvidence) < 1 ? "견적서·설비 사진을 확보하세요." : undefined,
      };
    }
    case "fundUseLogic": {
      const detail =
        (i.workingCapitalUse && i.workingCapitalUse !== "해당없음") ||
        (i.facilityUse && i.facilityUse !== "해당없음");
      const r =
        clarity(i.fundUseClarity) * 0.5 +
        (detail ? 0.3 : 0.05) +
        (i.fundingSize && i.fundingSize !== "미확인" ? 0.2 : 0.05);
      return {
        ratio: Math.min(1, r),
        note: clarity(i.fundUseClarity) < 0.6 ? "자금 사용처를 항목별 숫자로 구체화하세요." : undefined,
      };
    }
    case "viability": {
      const r =
        0.2 +
        (profile.yearsIdx >= 2 ? 0.25 : profile.yearsIdx === 1 ? 0.15 : 0.05) +
        (profile.revenueEok >= 3 ? 0.25 : profile.revenueEok >= 1 ? 0.15 : 0.05) +
        (i.netProfit === "흑자" ? 0.2 : 0.05) +
        (!profile.taxBlocked ? 0.1 : 0);
      return {
        ratio: Math.min(1, r),
        note: profile.taxBlocked ? "체납이 있으면 사업성 이전에 접수가 막힙니다. 완납이 최우선입니다." : undefined,
      };
    }
    case "ceoCapability": {
      const career = i.ceoCareer;
      const r =
        (career === "10년 이상" ? 0.6 : career === "5~10년" ? 0.5 : career === "3~5년" ? 0.35 : career === "1~3년" ? 0.2 : 0.15) +
        (profile.isYouth ? 0.15 : 0.05) +
        clarity(i.growthPlan) * 0.25;
      return {
        ratio: Math.min(1, r),
        note: career === "1년 미만" || career === "1~3년" ? "대표 경력이 짧습니다. '왜 이 업을 할 수 있는지' 스토리를 준비하세요." : undefined,
      };
    }
    default:
      return { ratio: 0.5 };
  }
}

export function scorePlan(profile: Profile): PlanScore {
  const dims: PlanScoreDimension[] = FW.scoreDimensions.map((d) => {
    const { ratio, note } = assess(profile, d.key);
    return {
      key: d.key,
      label: d.label,
      score: Math.round(d.max * ratio),
      max: d.max,
      note,
    };
  });

  const total = Math.min(
    100,
    dims.reduce((s, d) => s + d.score, 0),
  );
  const weakPoints = dims
    .filter((d) => d.score < d.max * 0.5 && d.note)
    .map((d) => `${d.label}: ${d.note}`);

  return { total, dimensions: dims, weakPoints };
}
