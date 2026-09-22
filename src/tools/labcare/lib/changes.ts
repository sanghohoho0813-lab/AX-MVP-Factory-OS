// 변경신고 관리 — 원본 app/changes/page.tsx 의 선택지·안내문과 lib/storage.ts 의 상태 타입 그대로.

import type { CheckAnswers } from "../types";

/** 변경기록 상태 (원본 storage.ts ChangeRecStatus) */
export type ChangeRecStatus = "확인 필요" | "변경 예정" | "신고 준비중" | "신고 완료";

/** 화면 표시용 변경 상태 (원본 mockStage1.ts ChangeStatus) */
export type ChangeStatus = "확인 필요" | "고객 자료요청" | "작성중" | "신고 완료" | "해당 없음";

/** 이 도구에서 브라우저에 남기는 변경기록 한 건 */
export interface ChangeRecord {
  id: string;
  reasons: string[];
  memo: string;
  status: ChangeRecStatus;
  /** 변경사유 발생일 (YYYY-MM-DD) */
  occurredDate: string;
  /** 신고기한 (발생일 + 30일) */
  deadline: string;
}

// 실무에서 자주 쓰는 변경사유 (인력 관련이 가장 빈번 → 상단)
export const REASONS = [
  "연구전담요원 퇴사",
  "연구전담요원 입사/충원",
  "연구전담요원 교체",
  "연구원 연봉 변경",
  "연구소 소재지 이전",
  "연구공간 변경",
  "연구기자재 변경",
];

export const STATUSES: ChangeRecStatus[] = ["확인 필요", "변경 예정", "신고 준비중", "신고 완료"];

export const CYCLES: { m: number; desc: string }[] = [
  { m: 1, desc: "매월 말 정기 확인이 필요한 고객사" },
  { m: 2, desc: "비교적 변동 가능성이 있는 고객사" },
  { m: 3, desc: "일반 관리 고객사" },
  { m: 6, desc: "변동이 적은 고객사" },
  { m: 12, desc: "최소 관리 고객사 — 장기간 방치 주의" },
];

export function defaultRequestText(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  return [
    "대표님, 안녕하세요.",
    "",
    `${ym} 연구소/연구개발전담부서 사후관리 안내드립니다.`,
    "",
    "이번 달 연구노트 작성과 함께, 아래 변경사항이 있는지도 확인 부탁드립니다.",
    "",
    "- 연구전담요원 퇴사/입사/교체",
    "- 연구전담요원 담당업무 또는 연봉 변동",
    "- 연구소/전담부서 소재지 또는 연구공간 변경",
    "- 연구기자재 변경",
    "- 기타 신고정보 변경사항",
    "",
    "위 사유들 중 해당되는 부분이 있으면 발생일로부터 30일 이내에 변경신고가 필수입니다.",
    "해당되는 내용이 있으면 미리 알려주시기 바랍니다.",
    "",
    "이번 달 연구노트도 함께 전달해드리겠습니다.",
    "",
    "감사합니다.",
  ].join("\n");
}

/** 변경기록 상태 → 화면 표시 상태 매핑 */
export function mapChangeStatus(s: ChangeRecStatus): ChangeStatus {
  switch (s) {
    case "확인 필요": return "확인 필요";
    case "변경 예정": return "고객 자료요청";
    case "신고 준비중": return "작성중";
    case "신고 완료": return "신고 완료";
    default: return "확인 필요";
  }
}

/** 월간 점검 기본 응답 (원본 check 화면 DEFAULT_ANSWERS) */
export const DEFAULT_ANSWERS: CheckAnswers = {
  personnelChange: false,
  spaceChange: false,
  registrationChange: false,
  projectOngoing: true,
  researchNotesWritten: true,
  expenseEvidenceOrganized: true,
  taxDocsPrepared: true,
  surveyResponseNeeded: false,
  memo: "",
};
