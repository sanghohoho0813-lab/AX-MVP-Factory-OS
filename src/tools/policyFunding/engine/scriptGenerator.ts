// Script Generator — knowledge/funding-scripts.json (conversation-scripts) 에서
// 상황별 대화 스크립트를 찾아 CoachContent·메시지·코치 인사이트를 생성.

import type { KnowledgeBase, Profile } from "./knowledgeEngine";
import type { CoachContent, CoachInsight, RiskAssessment } from "../types";

function group(kb: KnowledgeBase, key: string): string[] {
  return kb.scriptGroups.find((g) => g.key === key)?.scripts ?? [];
}

// topAgency 를 언급하는 스크립트를 우선 정렬
function preferAgency(scripts: string[], agency: string, n: number): string[] {
  const alias = agency.replace("기금", "").replace("공단", "");
  const hit = scripts.filter((s) => s.includes(agency) || s.includes(alias));
  const rest = scripts.filter((s) => !hit.includes(s));
  return [...hit, ...rest].slice(0, n);
}

// ── 인콜 조건부 확인 질문 (9차: 입력값에 따라 생성) ──
function conditionalQuestions(profile: Profile, topAgency: string): string[] {
  const q: string[] = [];
  const i = profile.input;

  if (profile.revenueEok < 5 && topAgency !== "신용보증기금") {
    q.push(
      "매출 5억 미만이라 신보 진행보다는 지역신보·소진공이 현실적인지 먼저 확인하세요.",
    );
  }
  if (profile.shortCareer) {
    q.push("대표가 이 업을 왜 할 수 있는지 — 경력·스토리를 먼저 확인하세요.");
  }
  if (profile.facilityIntent) {
    q.push("시설자금이면 견적서·기계(설비) 사진·자기자금 준비 여부를 확인하세요.");
  }
  if (profile.lowCredit) {
    q.push("최근 연체, 카드론, 2금융권 사용 여부를 반드시 확인하세요.");
  }
  if (i.employees !== "0명") {
    q.push("4대보험 가입자명부를 받고, 고용지원금 가능성도 함께 확인하세요.");
  }
  if (i.taxArrears === "미확인" || i.taxArrears === undefined) {
    q.push("국세·지방세 체납 여부를 확인하세요 (체납 시 접수 자체가 막힙니다).");
  }
  return q;
}

export function generateScripts(
  profile: Profile,
  topAgency: string,
  kb: KnowledgeBase,
): CoachContent {
  // 조건부 확인 질문을 먼저, 이후 인콜 기본 질문으로 채운다 (총 5개)
  const conditional = conditionalQuestions(profile, topAgency);
  const base = group(kb, "firstConsultQuestions");
  const questions = [...conditional, ...base.filter((b) => !conditional.includes(b))].slice(0, 5);
  const keyPoints = preferAgency(group(kb, "agencyRecommendation"), topAgency, 3);

  const docReq = group(kb, "documentRequest");
  const agencyRec = preferAgency(group(kb, "agencyRecommendation"), topAgency, 1);
  const closingLines = [
    agencyRec[0] ?? `${topAgency} 기준으로 준비하면 승인 가능성이 높습니다.`,
    docReq[docReq.length - 1] ?? "오늘 서류부터 준비를 시작하시죠.",
  ];

  const objectionLines = [
    group(kb, "costObjection")[0] ?? "부담되시는 점 이해합니다. 우선 가능성만 진단해드릴게요.",
    group(kb, "competitorComparison")[0] ?? "비교는 당연합니다. 기관 설계와 서류 완성도로 결과를 만들겠습니다.",
  ];

  return { questions, keyPoints, closingLines, objectionLines };
}

export function generateMessages(
  profile: Profile,
  topAgency: string,
  kb: KnowledgeBase,
): { documentMessage: string; followUpMessage: string } {
  const company = profile.companyName;
  const purpose = profile.input.purpose;

  const documentMessage =
    `${company} 대표님 안녕하세요 😊\n` +
    `오늘 말씀 나눈 대로 ${topAgency} 기준으로 검토를 진행하겠습니다.\n` +
    `아래 서류만 준비해 주시면 한도부터 꼼꼼히 확인해 정리해드릴게요.\n\n` +
    kb.requiredDocuments.map((d, idx) => `${idx + 1}. ${d}`).join("\n") +
    `\n\n` +
    (group(kb, "documentRequest").slice(-1)[0] ??
      "사진/파일 편하신 형태로 보내주시면 됩니다. 감사합니다!");

  const reContact = group(kb, "reContact");
  const followUpMessage =
    `${company} 대표님, 안녕하세요 😊\n` +
    `${reContact[0] ?? "지난 상담 이후 검토를 이어가고 있어 짧게 연락드립니다."}\n` +
    `말씀 주신 ${purpose} 관련해 ${topAgency} 기준으로 준비하면 충분히 가능성이 있어 보입니다.\n` +
    `${reContact[1] ?? "편하신 시간에 10분만 통화 가능하실까요?"}`;

  return { documentMessage, followUpMessage };
}

// 업종별 사업계획서 초점 (business-plan-questions)
function planFocus(profile: Profile, kb: KnowledgeBase): string | null {
  const map: Record<string, string> = {
    "음식/외식": "음식점·외식",
    제조: "제조업",
    도소매: "온라인 쇼핑몰·유통",
    서비스: "서비스업",
  };
  const label = map[profile.industryCategory];
  if (!label) return null;
  const set = kb.planQuestions.find((q) => q.industry === label);
  return set ? set.focus.join("·") : null;
}

export function buildCoachInsight(
  profile: Profile,
  risk: RiskAssessment,
  kb: KnowledgeBase,
): CoachInsight {
  // 가장 먼저 확인할 것 — precheck 5대 체크리스트 + 결격
  const firstChecks: string[] = [];
  const blocker = kb.preRestrictions.find((r) => r.severity === "blocker");
  if (blocker) firstChecks.push(`${blocker.label} — ${blocker.detail}`);
  for (const c of kb.fiveChecklist) {
    if (firstChecks.length >= 4) break;
    firstChecks.push(`${c.label} 확인 — ${c.why}`);
  }

  // 리스크 — riskAnalyzer 결과
  const risks = risk.factors.slice(0, 4);

  // 상담 전략
  const strategies: string[] = [
    "1순위 기관부터 서류를 완비해 한도를 최대한 끌어올리세요.",
  ];
  const focus = planFocus(profile, kb);
  if (focus)
    strategies.push(`사업계획서에서 ${focus} 중심으로 숫자를 제시하세요.`);
  if (profile.hasTech)
    strategies.push(
      "기술력·특허·연구소를 기술평가 자료로 정리하면 등급과 한도가 함께 올라갑니다.",
    );
  if (profile.input.credit === "낮음")
    strategies.push(
      "저신용이면 소진공·지역재단 소액부터 접근해 실적을 쌓은 뒤 확대하세요.",
    );

  // 절대 약속 금지 — consulting-contract-notices
  const neverPromise: string[] = [];
  for (const n of kb.contractNotices) {
    if (["noGuarantee", "customerFault", "feeTiming", "arrearsRisk"].includes(n.key))
      neverPromise.push(n.text);
  }

  return {
    firstChecks: firstChecks.slice(0, 4),
    risks,
    strategies: strategies.slice(0, 4),
    neverPromise: neverPromise.slice(0, 4),
  };
}
