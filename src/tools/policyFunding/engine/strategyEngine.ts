// Strategy Engine — 사업계획 "전략" 코치.
// '어디를 추천하는가'를 넘어 '왜 승인될 것 같은가 / 어떤 논리로 써야 하는가'를 만든다.
// 전략 흐름은 business-plan-strategies.json, 논리 흐름은 business-plan-patterns.json 에서 읽는다.

import type { Profile } from "./knowledgeEngine";
import type { PlanStrategy, PlanLogicStep } from "../types";
import strategiesJson from "../knowledge/business-plan-strategies.json";
import patternsJson from "../knowledge/business-plan-patterns.json";

interface StrategyDef {
  agencyKey: string;
  agencyName: string;
  flow: string[];
  summary: string;
  winReason: string;
}
interface LogicStepDef {
  no: number;
  key: string;
  title: string;
  question: string;
  guide: string;
  reviewerLikes: string;
}
interface AgencyEmphasisDef {
  agencyKey: string;
  emphasisSteps: string[];
  note: string;
}

const STRATEGIES = (
  strategiesJson as unknown as { strategies: StrategyDef[] }
).strategies;
const LOGIC_FLOW = (
  patternsJson as unknown as { logicFlow: LogicStepDef[] }
).logicFlow;
const AGENCY_EMPHASIS = (
  patternsJson as unknown as { agencyEmphasis: AgencyEmphasisDef[] }
).agencyEmphasis;

// 기관명 → agencyKey
export const AGENCY_KEY: Record<string, string> = {
  기술보증기금: "kibo",
  신용보증기금: "kodit",
  중소벤처기업진흥공단: "kosme",
  소상공인시장진흥공단: "semas",
  지역신용보증재단: "regional",
  미소금융: "misaeng",
};

function keyOf(agencyName: string): string {
  if (AGENCY_KEY[agencyName]) return AGENCY_KEY[agencyName];
  const hit = Object.keys(AGENCY_KEY).find((n) => agencyName.includes(n));
  return hit ? AGENCY_KEY[hit] : "semas";
}

// 작업1: 기관별 사업계획 전략 흐름
export function getPlanStrategy(topAgency: string): PlanStrategy {
  const key = keyOf(topAgency);
  const s =
    STRATEGIES.find((x) => x.agencyKey === key) ??
    STRATEGIES.find((x) => x.agencyKey === "semas")!;
  return {
    agency: s.agencyName,
    flow: s.flow,
    summary: s.summary,
    winReason: s.winReason,
  };
}

// 작업2: 사업계획 논리 흐름 7단계 (1순위 기관이 강조할 단계 표시)
export function getPlanLogic(topAgency: string): PlanLogicStep[] {
  const key = keyOf(topAgency);
  const emphasis =
    AGENCY_EMPHASIS.find((e) => e.agencyKey === key)?.emphasisSteps ?? [];
  return LOGIC_FLOW.map((step) => ({
    no: step.no,
    key: step.key,
    title: step.title,
    question: step.question,
    guide: step.guide,
    emphasized: emphasis.includes(step.key),
  }));
}

// 작업10: 왜 다른 기관이 아니라 이 기관인가 — 비교 근거
export function buildAgencyComparison(
  profile: Profile,
  agencyNames: string[],
): string[] {
  const out: string[] = [];
  const top = agencyNames[0];
  const second = agencyNames[1];
  if (!top) return out;

  const topKey = keyOf(top);
  const p = profile;

  // 1순위 기관을 고른 핵심 이유 (프로필 신호 기반)
  const topReason: Record<string, string> = {
    kibo: p.hasTech
      ? `기술·특허·인증 강점이 있어, 매출 규모로 겨루는 신용보증기금보다 기술평가로 한도를 키울 수 있는 기술보증기금이 더 유리합니다.`
      : `기술 요소를 살릴 수 있어 기술보증기금을 1순위로 두었습니다.`,
    kodit: `매출·재무 흐름이 안정적이어서, 기술평가 비중이 큰 기술보증기금보다 재무·상환 논리로 체급에 맞는 한도를 받는 신용보증기금이 더 적합합니다.`,
    kosme: `시설 투자와 고용 계획이 있어, 운영자금 중심의 소상공인시장진흥공단보다 투자·성장·일자리 정책 목적에 맞는 중소벤처기업진흥공단이 더 유리합니다.`,
    semas: p.lowCredit
      ? `저신용·소액 상황이라, 재무·기술 심사가 까다로운 보증기금보다 자금 사용처의 구체성과 절실함으로 빠르게 승인되는 소상공인시장진흥공단이 더 현실적입니다.`
      : `소상공인 규모와 운영자금 성격상, 성장·기술 평가 중심 기관보다 사용처 구체성으로 승부하는 소상공인시장진흥공단이 더 적합합니다.`,
    regional: `신용·규모 이슈로 중앙 보증기금 문턱이 높아, 대표 성실성과 사업 실체로 소액 보증이 열리는 지역신용보증재단이 더 현실적입니다.`,
    misaeng: `고금리 부채 정리와 재기가 급한 상황이라, 일반 정책자금보다 소액·자활 중심의 미소금융이 첫 단추로 적합합니다.`,
  };
  out.push(topReason[topKey] ?? `현재 조건에서 ${top}가 가장 적합합니다.`);

  // 2순위 대비 보완/전환 조건
  if (second) {
    out.push(
      `2순위 ${second}는 백업으로 남겨두되, ${
        topKey === "kibo"
          ? "기술 증빙이 약해질 경우"
          : topKey === "kosme"
            ? "시설·고용 계획이 축소될 경우"
            : "1순위 진행이 막힐 경우"
      } 전환을 검토하면 됩니다.`,
    );
  }

  // 체납/저신용 등 전제 조건 경고 (기관 선택보다 우선하는 리스크)
  if (p.taxBlocked) {
    out.push(
      "단, 어느 기관이든 체납이 있으면 사업성 이전에 접수가 막힙니다. 완납이 최우선 전제입니다.",
    );
  }
  return out;
}

export function strategyCount(): number {
  return STRATEGIES.length;
}
export function planLogicStepCount(): number {
  return LOGIC_FLOW.length;
}
