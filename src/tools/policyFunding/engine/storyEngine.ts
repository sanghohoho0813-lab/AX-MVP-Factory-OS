// Story Engine — 사업계획서를 사람처럼 스토리화한다.
// 문장 재료(강조점·스토리 훅·키워드)는 knowledge(frameworks·growth-points)에서 읽고,
// 엔진은 프로필 사실을 끼워 기관이 좋아하는 문체로 조립만 한다.
// XX 는 대표와 함께 채울 숫자 자리.

import type { Profile } from "./knowledgeEngine";
import type {
  PlanDraft,
  PlanDraftSection,
  StoryPack,
  StoryVersion,
  IndustryCategory,
} from "../types";
import type { AgencyFramework } from "./planEngine";
import type { GrowthPoints } from "./growthEngine";
import storyFrameworksJson from "../knowledge/story-frameworks.json";

interface StoryVersionDef {
  key: string;
  label: string;
  tone: string;
  story: string;
}
interface StoryIndustryDef {
  category: string;
  chain: string[];
  versions: StoryVersionDef[];
}
const STORY_INDUSTRIES = (
  storyFrameworksJson as unknown as { industries: StoryIndustryDef[] }
).industries;

// 작업3: 업종별 스토리 3버전(보수형·일반형·성장형)을 생성한다.
export function buildStoryVersions(category: IndustryCategory): StoryPack {
  const pack =
    STORY_INDUSTRIES.find((s) => s.category === category) ??
    STORY_INDUSTRIES.find((s) => s.category === "건설/기타")!;
  const versions: StoryVersion[] = pack.versions.map((v) => ({
    key: v.key,
    label: v.label,
    tone: v.tone,
    story: v.story,
  }));
  return { category: pack.category, chain: pack.chain, versions };
}

export function storyTemplateCount(): number {
  return STORY_INDUSTRIES.reduce((sum, s) => sum + s.versions.length, 0);
}

function purposeNoun(profile: Profile): string {
  const i = profile.input;
  if (i.facilityUse && i.facilityUse !== "해당없음") return i.facilityUse;
  if (i.workingCapitalUse && i.workingCapitalUse !== "해당없음")
    return i.workingCapitalUse;
  return i.purpose;
}

function problemSentence(profile: Profile, growth: GrowthPoints): string {
  const hook = growth.storyHooks[0] ?? "성장 대비 운영 기반이 부족한 상황";
  const extra = profile.facilityIntent
    ? "현재 생산(처리) 능력이 부족하여 납기가 길어지고, 들어오는 주문에 충분히 대응하지 못하고 있습니다."
    : profile.input.workingCapitalUse === "광고비"
      ? "수요는 확인되었으나 마케팅 투자 여력이 부족해 신규 고객 유입이 정체되어 있습니다."
      : profile.input.workingCapitalUse === "재고매입"
        ? "정산 주기와 재고 선매입 부담으로 현금흐름이 꼬여, 팔 수 있는 물량을 확보하지 못하고 있습니다."
        : "운영 자금의 여유가 부족해 매출 확대 기회를 충분히 살리지 못하고 있습니다.";
  return `${hook}입니다. ${extra}`;
}

function effectSentence(profile: Profile, growth: GrowthPoints): string {
  const kws = growth.keywords.slice(0, 3).join("·");
  if (profile.facilityIntent)
    return `이번 투자로 생산량 XX% 증가, 불량률 XX%p 감소, 납기 XX일 단축을 예상합니다. ${kws} 지표가 함께 개선되어 거래처 대응 능력이 실질적으로 확대됩니다.`;
  if (profile.input.workingCapitalUse === "광고비")
    return `검증된 채널에 광고를 집행해 ROAS XX배 기준 신규 고객 XX명, 월 매출 XX만원 증가를 예상합니다. ${kws} 지표를 매월 관리하겠습니다.`;
  if (profile.input.workingCapitalUse === "재고매입")
    return `재고 선매입으로 단가 XX% 절감, 품절 기회손실 월 XX만원 회수를 예상합니다. 재고회전 XX일 기준으로 자금이 매출로 회전됩니다.`;
  return `자금 투입 후 ${kws} 개선을 통해 월 매출 XX만원 수준의 증가를 보수적으로 예상합니다.`;
}

export function buildPlanDraft(
  profile: Profile,
  framework: AgencyFramework,
  growth: GrowthPoints,
): PlanDraft {
  const i = profile.input;
  const company = profile.companyName;
  const industry = i.industry || profile.industryCategory;
  const noun = purposeNoun(profile);

  const career =
    i.ceoCareer && i.ceoCareer !== "미확인"
      ? `대표는 동종업계 경력 ${i.ceoCareer}의 경험을 보유하고 있으며, `
      : "";

  const strengthLine =
    profile.strengthKeywords.length > 0
      ? ` ${profile.strengthKeywords.slice(0, 4).join("·")} 등의 강점을 기반으로 운영하고 있습니다.`
      : "";

  const sections: PlanDraftSection[] = [
    {
      no: 1,
      title: "사업 개요",
      text: `${company}는 ${industry} 분야에서 ${i.years} 동안 사업을 운영해 온 ${i.businessType}입니다. ${career}${growth.reviewerNote.split(".")[0]}에 강점을 두고 있습니다.${strengthLine}`,
    },
    {
      no: 2,
      title: "현재 문제점",
      text: problemSentence(profile, growth),
    },
    {
      no: 3,
      title: "투자(자금) 필요성",
      text: `이번 ${noun} 자금은 위 문제를 해결하기 위한 것입니다. ${
        profile.facilityIntent
          ? "설비를 도입하면 병목 공정이 해소되어 지금 거절하고 있는 주문을 소화할 수 있습니다."
          : "자금이 투입되면 현재 정체된 부분이 풀려 매출 확대의 선순환이 시작됩니다."
      } 지금이 적기인 이유는 수요가 확인된 상태이고, 시기를 놓치면 기회 손실이 누적되기 때문입니다.`,
    },
    {
      no: 4,
      title: "자금 사용계획",
      text: `필요 자금 ${i.fundingSize && i.fundingSize !== "미확인" ? i.fundingSize : "XX"} 규모를 ${noun} 중심으로 사용합니다. 항목별 내역(견적 기준)과 집행 시기를 명확히 하고, ${
        i.selfFunding === "있음" || i.selfFunding === "일부 있음"
          ? "자기자금을 함께 투입해 무리 없는 구조로 설계했습니다."
          : "집행 후 증빙이 가능한 항목으로만 구성했습니다."
      }`,
    },
    {
      no: 5,
      title: "기대효과",
      text: effectSentence(profile, growth),
    },
    {
      no: 6,
      title: "매출 증가 근거",
      text: `${
        profile.growth
          ? "최근 매출이 성장 추세에 있으며, 이는 수요가 실재함을 보여줍니다."
          : "현재 매출 흐름과 확인된 수요(주문·문의)를 근거로 잡았습니다."
      } ${
        profile.hasMajorClients
          ? "주요 거래처의 발주·계약이 확보되어 있어 증가분의 상당 부분이 이미 예약된 수요입니다."
          : "보수적으로 추정한 증가분만 반영했고, 근거 자료(정산·주문 데이터)를 첨부합니다."
      }`,
    },
    {
      no: 7,
      title: "고용 효과",
      text:
        i.hiringPlan === "있음"
          ? `자금 집행 후 XX명(${i.youthEmployment === "있음" || i.youthEmployment === "예정" ? "청년 포함 " : ""}4대보험 기준) 채용을 계획하고 있습니다. 현재 ${i.employees} 고용을 유지 중이며, 고용 확대가 처리 능력과 매출 증가로 이어지는 구조입니다.`
          : `현재 ${i.employees}의 고용을 안정적으로 유지하고 있으며, 매출 확대에 따라 단계적 채용을 검토하겠습니다.`,
    },
    {
      no: 8,
      title: "향후 계획",
      text: `${framework.planPriorities[framework.planPriorities.length - 1]}를 중심으로 성장하겠습니다. ${
        i.growthPlan === "명확함"
          ? "1년 내 목표와 실행 단계가 정리되어 있으며,"
          : "단계별 목표를 수립하고 있으며,"
      } 상환은 개선된 현금흐름에서 무리 없이 이행하고, 성실 상환으로 신뢰를 쌓아 다음 단계 성장 자금으로 이어가겠습니다.`,
    },
  ];

  return {
    agency: framework.agencyName,
    emphasis: framework.emphasis,
    sections,
  };
}
