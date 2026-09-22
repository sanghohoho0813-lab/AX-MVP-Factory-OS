import type {
  Customer,
  CustomerStage,
  DiagnosisInput,
  DiagnosisResult,
} from "./types";
import { classifyIndustry } from "./diagnosis";

// "AI 코치" UX 를 위한 파생 로직 (순수 함수).

// 진행 추천도 → 별점 (0~5)
export function progressStars(score: number): number {
  return Math.max(1, Math.min(5, Math.floor(score / 20)));
}

export function starString(score: number): string {
  const n = progressStars(score);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// AI 코치의 한 줄 결론
export function oneLineConclusion(result: DiagnosisResult): string {
  return `이 업체는 ${result.topAgency}부터 검토하는 것이 가장 유리합니다.`;
}

// 오늘 해야 할 일 (진단 직후) — 최대 5개
export function todayTasks(
  input: DiagnosisInput,
  result: DiagnosisResult,
): string[] {
  const top = result.agencies[0]?.name ?? result.topAgency;
  const second = result.agencies[1]?.name;
  const tasks: string[] = [];

  if (input.strengths.includes("특허")) {
    tasks.push("대표에게 특허 등록 여부·번호 다시 확인");
  } else if (
    input.strengths.includes("기술력") ||
    input.strengths.includes("연구소")
  ) {
    tasks.push("보유 기술·인증 증빙 자료 확인");
  } else {
    tasks.push("대표 자금 목적과 희망 금액 재확인");
  }

  tasks.push("최근 재무제표·매출자료 요청");
  tasks.push(`${top} 중심으로 설명`);
  if (second) tasks.push(`${second}은 2순위로 안내`);
  tasks.push("다음 상담/통화 일정 예약");

  return tasks.slice(0, 5);
}

const STRENGTH_PHRASE: Record<string, string> = {
  제조업: "제조업",
  기술력: "기술력 우수",
  특허: "특허 보유",
  연구소: "부설연구소 보유",
  벤처: "벤처기업",
  청년대표: "청년 대표",
  고용증가: "고용 증가",
  수출: "수출 실적",
};

// AI 판단 근거 (사람이 생각하는 과정처럼)
export function aiReasoning(
  input: DiagnosisInput,
  result: DiagnosisResult,
): { signals: string[]; conclusion: string } {
  const cat = classifyIndustry(input.industry);
  const signals: string[] = [];

  if (input.strengths.includes("제조업") || cat === "제조") {
    signals.push("제조업");
  } else {
    signals.push(`${cat} 업종`);
  }
  signals.push(`업력 ${input.years}`);
  signals.push(`직원 ${input.employees}`);

  for (const s of ["특허", "기술력", "연구소", "벤처", "수출", "고용증가"]) {
    if (input.strengths.includes(s as never) && STRENGTH_PHRASE[s]) {
      signals.push(STRENGTH_PHRASE[s]);
    }
  }
  signals.push(`${input.purpose} 목적`);
  if (input.credit === "우수") signals.push("대표 신용 우수");
  else if (input.credit === "낮음") signals.push("대표 신용 낮음(주의)");

  return {
    signals: signals.slice(0, 7),
    conclusion: `${result.topAgency} 적합도 상승 → 1순위 추천`,
  };
}

export type CoachChatItem =
  | { kind: "situation"; text: string }
  | { kind: "coach"; text: string };

// AI 상담 코치 멘트 → 채팅형 시퀀스
export function buildCoachChat(result: DiagnosisResult): CoachChatItem[] {
  const items: CoachChatItem[] = [];
  const { keyPoints, questions, closingLines, objectionLines } = result.coach;

  items.push({ kind: "situation", text: "대표님께 이렇게 설명해보세요" });
  keyPoints.forEach((t) => items.push({ kind: "coach", text: t }));

  items.push({ kind: "situation", text: "이런 질문을 먼저 던져보세요" });
  questions.forEach((t) => items.push({ kind: "coach", text: t }));

  items.push({ kind: "situation", text: "계약을 유도할 땐 이렇게" });
  closingLines.forEach((t) => items.push({ kind: "coach", text: t }));

  items.push({ kind: "situation", text: '대표님이 "다른 데도 된다던데요?" 하고 망설이면' });
  objectionLines.forEach((t) => items.push({ kind: "coach", text: t }));

  return items;
}

// 고객 상세 "오늘 해야 할 일" — 진행단계 기반 파생, 최대 5개
const STAGE_TASKS: Record<CustomerStage, string[]> = {
  "신규 DB": ["첫 상담 전화 걸기", "자금 목적·희망 금액 확인", "체납·연체 여부 확인"],
  "1차 상담 완료": ["최근 재무제표·매출자료 요청", "추천기관 설명하기", "다음 통화 예약"],
  "계약 검토": ["계약 조건·수수료 안내", "계약금 안내", "진행 의사 확인"],
  "서류 요청": ["필요 서류 리마인드 발송", "준비 어려운 서류 안내"],
  "서류 대기": ["누락 서류 확인", "수령 서류 검토", "접수 준비 시작"],
  "접수 준비": ["사업계획/자금사용계획 정리", "접수 일정 확정", "최종 서류 점검"],
  "접수 완료": ["심사·실사 대응 준비", "추가 자료 요청 대비"],
  "심사 중": ["심사 진행 상황 확인", "추가 자료 준비"],
  승인: ["약정·실행 절차 안내", "업셀링 기회 제안", "후기·소개 요청"],
  보류: ["보류 사유 정리", "재접촉 시점 설정"],
  실패: ["사유 정리 및 기록", "대안 기관·재도전 검토"],
  "재접촉 예정": ["재접촉 일정 확정", "상황 변화 확인"],
};

export function customerTodayTasks(customer: Customer): string[] {
  const tasks: string[] = [];
  if (customer.nextAction) tasks.push(customer.nextAction);
  for (const t of STAGE_TASKS[customer.stage] ?? []) {
    if (!tasks.includes(t)) tasks.push(t);
  }
  return tasks.slice(0, 5);
}

// 대시보드 긴급도 정렬용 티어
export interface UrgencyTier {
  key: string;
  label: string;
  emoji: string;
  border: string;
  chip: string;
  stages: CustomerStage[];
}

export const URGENCY_TIERS: UrgencyTier[] = [
  {
    key: "today",
    label: "오늘 연락해야 함",
    emoji: "🔥",
    border: "border-l-red-500",
    chip: "bg-red-50 text-red-600",
    stages: ["신규 DB", "재접촉 예정"],
  },
  {
    key: "talk",
    label: "상담·계약 진행",
    emoji: "🟠",
    border: "border-l-orange-400",
    chip: "bg-orange-50 text-orange-600",
    stages: ["1차 상담 완료", "계약 검토"],
  },
  {
    key: "docs",
    label: "서류 대기",
    emoji: "🟡",
    border: "border-l-amber-400",
    chip: "bg-amber-50 text-amber-700",
    stages: ["서류 요청", "서류 대기"],
  },
  {
    key: "review",
    label: "접수·심사 중",
    emoji: "🟢",
    border: "border-l-green-500",
    chip: "bg-green-50 text-green-700",
    stages: ["접수 준비", "접수 완료", "심사 중"],
  },
  {
    key: "approved",
    label: "승인 완료",
    emoji: "🔵",
    border: "border-l-blue-500",
    chip: "bg-blue-50 text-blue-700",
    stages: ["승인"],
  },
  {
    key: "closed",
    label: "보류·종료",
    emoji: "⚪",
    border: "border-l-slate-300",
    chip: "bg-slate-100 text-slate-500",
    stages: ["보류", "실패"],
  },
];

export function stageTier(stage: CustomerStage): UrgencyTier {
  return (
    URGENCY_TIERS.find((t) => t.stages.includes(stage)) ??
    URGENCY_TIERS[URGENCY_TIERS.length - 1]
  );
}

export function urgencyRank(stage: CustomerStage): number {
  const idx = URGENCY_TIERS.findIndex((t) => t.stages.includes(stage));
  return idx < 0 ? URGENCY_TIERS.length : idx;
}
