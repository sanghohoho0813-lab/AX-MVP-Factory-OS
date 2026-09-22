import type { Client, ResearchNote, ResearchProject } from "../types";

/**
 * 연구노트 초안 생성기 (현재는 입력값을 구조화하는 목업 — 추후 AI 연동 자리).
 *
 * 실제 AI 호출 없이도 화면 흐름(입력 → 초안 생성 → 실사 보완)을 보여주기 위한
 * 템플릿 기반 생성기다.
 */

type NoteInput = Pick<
  ResearchNote,
  "activities" | "tests" | "problems" | "nextPlan" | "roles" | "relevance" | "month"
>;

/** 입력값으로 연구노트 초안 본문을 구성한다. */
export function generateNoteDraft(
  input: NoteInput,
  client: Client,
  project: ResearchProject,
): string {
  const monthLabel = input.month.replace("-", "년 ") + "월";
  const roleLines = input.roles.length
    ? input.roles.map((r) => `  - ${r.name || "(미입력)"}: ${r.role || "(역할 미입력)"}`).join("\n")
    : "  - (참여 연구원 미입력)";

  return [
    `[${monthLabel} 연구노트] ${project.name}`,
    `과제 대상: ${client.name} · ${project.productService || "제품/서비스 미입력"}`,
    "",
    "1. 이번 달 연구개발 활동",
    input.activities || "(연구활동 미입력)",
    "",
    "2. 테스트 및 개선",
    input.tests || "(테스트/개선 미입력)",
    "",
    "3. 확인된 문제점",
    input.problems || "(문제점 미입력)",
    "",
    "4. 참여 연구원별 역할",
    roleLines,
    "",
    "5. 업종·제품·서비스와의 직접 관련성",
    input.relevance || "(관련성 미입력)",
    "",
    "6. 다음 달 연구 계획",
    input.nextPlan || "(다음 계획 미입력)",
  ].join("\n");
}

/** 실사 대응 관점 보완 문구를 초안 뒤에 덧붙인다. */
export function enhanceForAudit(draft: string, project: ResearchProject): string {
  return [
    draft,
    "",
    "─────────────────────────────",
    "[실사 대응 보완]",
    `· 본 연구활동은 '${project.productService || "당사 제품/서비스"}'의 기술적 개선과 직접 연결됩니다.`,
    "· 단순 생산·영업 활동이 아닌, 신규성·진보성이 있는 연구개발 활동임을 기록으로 뒷받침합니다.",
    "· 활동 결과는 시험성적서·설계문서·회의록 등 객관적 증빙과 함께 보관할 것을 권장합니다.",
  ].join("\n");
}

/**
 * 초안이 '업종·제품·서비스와 직접 연결되는지'를 점검한다.
 * (실사에서 일반적 서술은 지적 대상이 되므로, 구체성 신호를 확인)
 */
export function checkRelevance(
  input: Pick<NoteInput, "activities" | "relevance">,
  project: ResearchProject,
): { ok: boolean; hints: string[] } {
  const hints: string[] = [];
  const text = `${input.activities} ${input.relevance}`.trim();

  if (input.relevance.trim().length < 10) {
    hints.push("업종·제품·서비스와의 직접 관련성 설명이 짧습니다. 구체적으로 보완하세요.");
  }
  const keyword = (project.productService || "").split(/[\s,/·]+/).filter((w) => w.length >= 2)[0];
  if (keyword && !text.includes(keyword)) {
    hints.push(`연구활동에 제품/서비스 키워드('${keyword}')가 드러나지 않습니다. 직접 연결을 명시하세요.`);
  }
  if (input.activities.trim().length < 20) {
    hints.push("연구활동 서술이 일반적입니다. 무엇을·어떻게·왜 했는지 구체적으로 적으세요.");
  }

  return { ok: hints.length === 0, hints };
}
