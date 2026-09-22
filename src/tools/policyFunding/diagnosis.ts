// ─────────────────────────────────────────────────────────────
// diagnosis.ts — 얇은 컨트롤러 (Thin Controller)
//
// 과거에는 이 파일에 기관 스코어링·사례 매칭·코치 멘트·업셀 판단이
// 전부 하드코딩(if/else/score ~770줄)되어 있었다.
// 이제 판단 로직은 app/lib/engine 의 Knowledge Engine 이 knowledge/*.json 을
// 읽어 수행하고, 이 파일은 입력을 받아 엔진을 호출하는 역할만 한다.
//
// 공개 API(runDiagnosis / classifyIndustry / DEFAULT_INPUT / SAMPLE_INPUT)는
// 그대로 유지되어 기존 UI(DiagnosisSection·ResultCard·coach.ts 등)는 무수정.
// ─────────────────────────────────────────────────────────────

import type { DiagnosisInput, DiagnosisResult } from "./types";
import {
  inferIndustryCategory,
  runKnowledgeDiagnosis,
} from "./engine/knowledgeEngine";

// 업종 분류 — 엔진의 industryCategory 추론을 재노출 (coach.ts 하위호환)
export const classifyIndustry = inferIndustryCategory;

// 진단 실행 — Knowledge Engine 위임
export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  return runKnowledgeDiagnosis(input);
}

export const DEFAULT_INPUT: DiagnosisInput = {
  companyName: "",
  industry: "",
  businessType: "개인사업자",
  years: "1~3년",
  revenue: "1~5억",
  employees: "1~4명",
  credit: "보통",
  purpose: "운전자금",
  strengths: [],
  memo: "",
  // 인콜 확장 필드 기본값 (미확인 중심)
  ceoCareer: "미확인",
  ceoAge: "미확인",
  premises: "미확인",
  actualBusiness: "기타",
  revenueTrend3y: "미확인",
  lastYearRevenue: "미확인",
  thisYearTrend: "미확인",
  netProfit: "미확인",
  creditBand: "미확인",
  recentDelinquency: "미확인",
  debtRelief: "미확인",
  taxArrears: "미확인",
  insuranceArrears: "미확인",
  existingDebtLevel: "미확인",
  secondFinance: "미확인",
  workingCapitalUse: "해당없음",
  facilityUse: "해당없음",
  fundingSize: "미확인",
  selfFunding: "미확인",
  hiringPlan: "미확인",
  youthEmployment: "미확인",
  familyStaff: "미확인",
  bonusItems: [],
  fundUseClarity: "미확인",
  growthPlan: "미확인",
  majorClients: "미확인",
  assetEvidence: "미확인",
  bizPlanReadiness: "미확인",
  // 심층 진단 전용 (11차)
  techClarity: "미확인",
  quoteReady: "미확인",
  productivityEvidence: "미확인",
  debtRatioStatus: "미확인",
  interestCoverage: "미확인",
  leaseReady: "미확인",
  salesEvidenceReady: "미확인",
};

export const SAMPLE_INPUT: DiagnosisInput = {
  companyName: "(주)한빛정밀",
  industry: "자동차부품 제조",
  businessType: "법인사업자",
  years: "3~7년",
  revenue: "5~10억",
  employees: "5~9명",
  credit: "보통",
  purpose: "시설자금",
  strengths: ["제조업", "기술력", "특허"],
  memo: "노후 설비 교체 및 신규 라인 증설 자금 필요. 최근 매출 성장세.",
  // 인콜 확장 필드 (샘플 고객 시나리오)
  ceoCareer: "10년 이상",
  ceoAge: "40~49세",
  premises: "임차",
  actualBusiness: "제조",
  revenueTrend3y: "증가",
  lastYearRevenue: "5~10억",
  thisYearTrend: "전년보다 증가",
  netProfit: "흑자",
  creditBand: "800점대",
  recentDelinquency: "없음",
  debtRelief: "없음",
  taxArrears: "없음",
  insuranceArrears: "없음",
  existingDebtLevel: "매출 대비 보통",
  secondFinance: "없음",
  workingCapitalUse: "해당없음",
  facilityUse: "기계구입",
  fundingSize: "1억~2억",
  selfFunding: "일부 있음",
  hiringPlan: "있음",
  youthEmployment: "예정",
  familyStaff: "없음",
  bonusItems: ["특허 보유", "기업부설연구소 보유", "노란우산공제"],
  fundUseClarity: "명확함",
  growthPlan: "명확함",
  majorClients: "있음",
  assetEvidence: "있음",
  bizPlanReadiness: "초안 있음",
};
