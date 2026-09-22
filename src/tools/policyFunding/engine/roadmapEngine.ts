// Roadmap Engine — 30/60/90일 로드맵.
// 10차: 일반 로드맵을 기관별 로드맵(knowledge/funding-roadmaps.json)으로 분리.
// 1순위 기관의 실제 진행 순서(기보: 기술자료→특허→…→실행)를 그대로 따른다.

import type { Profile } from "./knowledgeEngine";
import type { Roadmap, RoadmapStep, RiskAssessment } from "../types";
import roadmapsJson from "../knowledge/funding-roadmaps.json";

interface RoadmapDef {
  agencyKey: string;
  agencyName: string;
  steps: { day: number; task: string }[];
}
const ROADMAPS = (roadmapsJson as unknown as { roadmaps: RoadmapDef[] })
  .roadmaps;

function label(days: number): string {
  return days === 0 ? "오늘" : `${days}일`;
}

function toRoadmap(
  raw: { day: number; task: string }[],
  agency?: string,
): Roadmap {
  const full: RoadmapStep[] = raw.map((s) => ({
    offsetLabel: label(s.day),
    offsetDays: s.day,
    task: s.task,
    phase: s.day <= 30 ? "30일" : s.day <= 60 ? "60일" : "90일",
  }));
  return {
    steps: full,
    phases: {
      d30: full.filter((s) => s.phase === "30일").map((s) => s.task),
      d60: full.filter((s) => s.phase === "60일").map((s) => s.task),
      d90: full.filter((s) => s.phase === "90일").map((s) => s.task),
    },
    ...(agency ? { agency } : {}),
  };
}

export function buildRoadmap(
  profile: Profile,
  topAgency: string,
  risk: RiskAssessment,
): Roadmap {
  const def = ROADMAPS.find(
    (r) => r.agencyName === topAgency || topAgency.includes(r.agencyName),
  );

  if (def) {
    const steps = [...def.steps.map((s) => ({ ...s }))];
    // 상태 기반 보정: 체납·저신용은 선행 단계가 추가된다
    if (profile.taxBlocked) {
      steps.unshift({ day: 0, task: "⚠ 국세/4대보험 체납 완납 정리 (접수 전 필수)" });
    }
    if (profile.lowCredit && def.agencyKey !== "misaeng") {
      steps.splice(1, 0, {
        day: 2,
        task: "신용 이슈 정리 + 저신용 대응 상품 병행 확인",
      });
    }
    if (risk.score >= 60) {
      steps.push({
        day: Math.max(...steps.map((s) => s.day)) + 10,
        task: "부결 시 원인 분석 후 보완·재도전",
      });
    }
    return toRoadmap(steps, def.agencyName);
  }

  // 폴백: 일반 로드맵
  const generic = [
    { day: 0, task: "기본자료 요청 (사업자등록증·부가세·재무제표)" },
    { day: 3, task: "세금·4대보험 완납, 기대출·연체 상태 확인" },
    { day: 7, task: "대표 상담 — 자금 목적·희망 금액·강점 확정" },
    { day: 15, task: "사업계획·자금사용계획 정리" },
    { day: 30, task: `${topAgency} 서류 완비 및 접수 준비` },
    { day: 45, task: `${topAgency} 기관 접수` },
    { day: 60, task: "심사·실사 대응 준비" },
    { day: 90, task: "승인 후 약정 및 실행" },
  ];
  return toRoadmap(generic, topAgency);
}
