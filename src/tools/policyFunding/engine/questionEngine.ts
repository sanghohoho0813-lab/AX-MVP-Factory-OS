// Question Engine — 고객 상태를 보고 사업계획서 작성용 추가 질문을 자동 생성.
// 질문은 전부 knowledge/business-plan-questions.json (purposeQuestionChains +
// industryQuestions + coreQuestions) 에서 읽는다. 하드코딩 금지.

import type { Profile } from "./knowledgeEngine";
import planQuestionsJson from "../knowledge/business-plan-questions.json";

interface PurposeChain {
  key: string;
  label: string;
  match: string[];
  chain: string[];
}
interface IndustryQuestionSet {
  industry: string;
  focus: string[];
  questions: string[];
}
const PQ = planQuestionsJson as unknown as {
  coreQuestions: string[];
  industryQuestions: IndustryQuestionSet[];
  purposeQuestionChains: PurposeChain[];
};

// 프로필의 자금 목적(대분류+세부)과 매칭되는 체인을 찾는다
function matchedChains(profile: Profile): PurposeChain[] {
  const raw: (string | undefined)[] = [
    profile.input.purpose,
    profile.input.workingCapitalUse,
    profile.input.facilityUse,
  ];
  const signals = raw.filter((s): s is string => Boolean(s) && s !== "해당없음");

  const chains = PQ.purposeQuestionChains.filter((c) =>
    c.match.some((m) => signals.includes(m)),
  );
  // 세부 목적 체인이 있으면 일반 운전자금 체인은 뒤로
  return chains.sort((a, b) => {
    const aGeneric = a.key === "workingGeneral" ? 1 : 0;
    const bGeneric = b.key === "workingGeneral" ? 1 : 0;
    return aGeneric - bGeneric;
  });
}

const INDUSTRY_LABEL: Record<string, string> = {
  "음식/외식": "음식점·외식",
  제조: "제조업",
  도소매: "온라인 쇼핑몰·유통",
  서비스: "서비스업",
};

export function generatePlanQuestions(profile: Profile): string[] {
  const out: string[] = [];

  // 1) 목적별 질문 체인 (가장 구체적)
  for (const chain of matchedChains(profile)) {
    for (const q of chain.chain) {
      if (!out.includes(q)) out.push(q);
    }
    if (out.length >= 10) break;
  }

  // 2) 업종별 질문 보강
  const label = INDUSTRY_LABEL[profile.industryCategory];
  const iq = PQ.industryQuestions.find((x) => x.industry === label);
  if (iq) {
    for (const q of iq.questions) {
      if (out.length >= 12) break;
      if (!out.includes(q)) out.push(q);
    }
  }

  // 3) 공통 핵심 질문으로 마무리 채움
  for (const q of PQ.coreQuestions) {
    if (out.length >= 12) break;
    if (!out.includes(q)) out.push(q);
  }

  return out.slice(0, 12);
}

export function planQuestionStats(): { chains: number; totalQuestions: number } {
  const totalQuestions =
    PQ.purposeQuestionChains.reduce((s, c) => s + c.chain.length, 0) +
    PQ.industryQuestions.reduce((s, i) => s + i.questions.length, 0) +
    PQ.coreQuestions.length;
  return { chains: PQ.purposeQuestionChains.length, totalQuestions };
}
