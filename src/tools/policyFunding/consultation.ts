import type {
  ConsultationChecklist,
  ConsultationChecklistKey,
  Customer,
  LeadReaction,
} from "./types";

// 상담 진행·클로징 지원 로직 (순수 함수 — client/server 어디서든 import 가능).

export const CHECKLIST_ITEMS: {
  key: ConsultationChecklistKey;
  label: string;
}[] = [
  { key: "needs", label: "대표 기본 니즈 확인" },
  { key: "purpose", label: "자금 목적 확인" },
  { key: "debt", label: "기대출/부채 현황 확인" },
  { key: "credit", label: "신용 상태 확인" },
  { key: "revenue", label: "매출자료 확인" },
  { key: "taxArrears", label: "세금 체납 여부 확인" },
  { key: "agencyExplained", label: "추천기관 설명 완료" },
  { key: "orderExplained", label: "예상 진행 순서 설명 완료" },
  { key: "feeExplained", label: "수수료 안내 완료" },
  { key: "noGuaranteeNotice", label: "승인 보장 불가 고지 완료" },
  { key: "docsRequested", label: "필요서류 요청 완료" },
  { key: "nextMeeting", label: "다음 미팅/통화 일정 확정" },
];

export const LEAD_REACTIONS: LeadReaction[] = [
  "긍정적",
  "고민 중",
  "비용 부담",
  "타 업체 비교 중",
  "연락 두절",
  "보류 요청",
  "진행 의사 있음",
];

export function defaultChecklist(): ConsultationChecklist {
  return {
    needs: false,
    purpose: false,
    debt: false,
    credit: false,
    revenue: false,
    taxArrears: false,
    agencyExplained: false,
    orderExplained: false,
    feeExplained: false,
    noGuaranteeNotice: false,
    docsRequested: false,
    nextMeeting: false,
  };
}

// 기존/Mock 고객이 새 필드를 갖도록 안전하게 보정
export function normalizeChecklist(
  checklist?: ConsultationChecklist,
): ConsultationChecklist {
  return { ...defaultChecklist(), ...(checklist ?? {}) };
}

export function checklistProgress(customer: Pick<Customer, "consultationChecklist">) {
  const c = normalizeChecklist(customer.consultationChecklist);
  const total = CHECKLIST_ITEMS.length;
  const done = CHECKLIST_ITEMS.filter((i) => c[i.key]).length;
  return { done, total };
}

// 계약 가능성 점수 (0~100)
export function computeClosingScore(
  customer: Pick<Customer, "score" | "memo" | "consultationChecklist">,
): number {
  const c = normalizeChecklist(customer.consultationChecklist);
  let s = 0;
  if (customer.score >= 80) s += 20;
  if (c.agencyExplained) s += 15;
  if (c.orderExplained) s += 15;
  if (c.feeExplained) s += 10;
  if (c.noGuaranteeNotice) s += 10;
  if (c.docsRequested) s += 10;
  if (c.nextMeeting) s += 10;
  if ((customer.memo ?? "").trim().length >= 30) s += 10;
  return Math.min(100, s);
}

export function closingVerdict(score: number): {
  label: string;
  tone: "green" | "amber" | "slate";
} {
  if (score >= 80) return { label: "계약 가능성 높음", tone: "green" };
  if (score >= 50) return { label: "추가 설득 필요", tone: "amber" };
  return { label: "신뢰 형성 필요", tone: "slate" };
}

// 대표 반응별 추천 대응 멘트
export function reactionResponse(reaction: LeadReaction): string {
  switch (reaction) {
    case "긍정적":
      return "좋게 봐주셔서 감사합니다! 바로 진행하실 수 있도록 필요 서류부터 안내드릴게요. 준비되는 대로 최적 기관 순서로 접수 도와드리겠습니다.";
    case "고민 중":
      return "충분히 고민되실 수 있어요. 부담 갖지 마시고, 우선 가능성과 진행 순서만 정확히 정리해드릴게요. 실제 진행 여부는 그다음에 결정하셔도 됩니다.";
    case "비용 부담":
      return "대표님, 지금 바로 큰 비용을 쓰자는 의미보다는 가능성이 있는 기관과 순서를 먼저 정확히 잡아보자는 취지입니다. 실제 실행 여부와 규모는 한도가 확인된 뒤 대표님이 결정하시면 됩니다.";
    case "타 업체 비교 중":
      return "비교해보시는 건 당연합니다. 다만 정책자금은 단순 수수료보다 어떤 기관을 어떤 순서로 들어가느냐가 결과를 많이 좌우합니다. 저는 그 설계와 서류 완성도로 결과를 만들어 드리겠습니다.";
    case "연락 두절":
      return "대표님, 지난번 문의주신 정책자금 건 관련해서 자료 확인 전이라 정확한 한도 안내가 어려워 짧게 연락드립니다. 1~2분만 통화 가능하실 때 회신 주시면 바로 정리해드리겠습니다.";
    case "보류 요청":
      return "네, 지금은 잠시 보류하겠습니다. 다만 정책자금은 예산·시기 영향을 받으니, 다음 접수 시기가 다가오면 미리 알림 드릴게요. 필요할 때 바로 움직일 수 있게 준비만 해두시죠.";
    case "진행 의사 있음":
      return "결정 감사합니다! 그럼 바로 진행하겠습니다. 오늘 안내드린 서류부터 준비해 주시면, 제가 추천 기관 기준으로 한도를 최대한 끌어올려 설계하겠습니다.";
  }
}

export interface GeneratedMessage {
  key: string;
  label: string;
  text: string;
}

// 현재 고객 정보 + 대표 반응 기반으로 복사용 상담 메시지 생성
export function buildConsultationMessages(
  customer: Customer,
): GeneratedMessage[] {
  const company = customer.companyName || "대표님 회사";
  const agency = customer.recommendedAgency;
  const nextAction = customer.nextAction || "다음 단계 준비";
  const reaction = customer.leadReaction ?? null;

  const summary =
    `${company} 대표님, 오늘 상담 감사합니다 😊\n` +
    `말씀 나눈 내용 간단히 정리해드립니다.\n\n` +
    `· 추천 기관: ${agency}\n` +
    `· 다음 단계: ${nextAction}\n` +
    `· 예상 가능성: ${customer.score}점 수준\n\n` +
    `필요 서류 준비되는 대로 바로 검토 시작하겠습니다. 궁금한 점 있으시면 편하게 연락 주세요!`;

  const docs =
    `${company} 대표님, ${agency} 기준으로 진행을 위해 아래 서류를 준비 부탁드립니다.\n\n` +
    `1. 사업자등록증\n` +
    `2. 부가세과세표준증명\n` +
    `3. 재무제표 또는 손익자료\n` +
    `4. 국세/지방세 납세증명서\n` +
    `5. 자금 사용 계획 자료\n\n` +
    `사진/파일 편하신 형태로 보내주시면 됩니다. 준비 어려우신 항목은 말씀 주세요. 감사합니다!`;

  const costObjection = `${company} 대표님, ${reactionResponse("비용 부담")}`;

  const compareObjection = `${company} 대표님, ${reactionResponse("타 업체 비교 중")}`;

  const followUp =
    `${company} 대표님, 안녕하세요 😊\n` +
    `지난 상담 이후 ${agency} 기준으로 검토를 이어가고 있습니다.\n` +
    `다음 단계로 "${nextAction}" 부분을 준비하면 좋을 것 같아요.\n` +
    `편하신 시간에 짧게 통화 가능하실까요? 편하신 때 알려주세요!`;

  const preContract =
    `${company} 대표님, 진행 전 안내드립니다.\n\n` +
    `· 정책자금은 기관 심사 결과에 따라 최종 승인·한도·금리가 결정되며, 승인·한도를 보장하지 않습니다.\n` +
    `· 저희는 최적 기관 선정, 서류 설계, 접수 순서로 가능성을 최대한 높이는 역할을 합니다.\n` +
    `· 수수료와 진행 절차는 사전에 투명하게 안내드립니다.\n\n` +
    `확인 후 진행 의사 주시면 바로 시작하겠습니다. 감사합니다!`;

  const messages: GeneratedMessage[] = [
    { key: "summary", label: "첫 상담 후 요약 메시지", text: summary },
    { key: "docs", label: "서류 요청 메시지", text: docs },
    { key: "cost", label: "비용 부담 대응 메시지", text: costObjection },
    { key: "compare", label: "타 업체 비교 대응 메시지", text: compareObjection },
    { key: "followup", label: "재접촉 메시지", text: followUp },
    { key: "precontract", label: "계약 전 안내 메시지", text: preContract },
  ];

  // 대표 반응이 선택되어 있으면 해당 대응 메시지를 맨 앞으로 끌어올린다.
  if (reaction === "비용 부담") {
    const idx = messages.findIndex((m) => m.key === "cost");
    if (idx > 0) messages.unshift(messages.splice(idx, 1)[0]);
  } else if (reaction === "타 업체 비교 중") {
    const idx = messages.findIndex((m) => m.key === "compare");
    if (idx > 0) messages.unshift(messages.splice(idx, 1)[0]);
  } else if (reaction === "연락 두절") {
    const followUpIdx = messages.findIndex((m) => m.key === "followup");
    if (followUpIdx > 0)
      messages.unshift(messages.splice(followUpIdx, 1)[0]);
  }

  return messages;
}
