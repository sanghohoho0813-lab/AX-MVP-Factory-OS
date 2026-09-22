// 정책자금 AI 진단에 사용되는 도메인 타입 정의

export type BusinessType = "개인사업자" | "법인사업자";
export type YearsInBusiness = "1년 미만" | "1~3년" | "3~7년" | "7년 이상";
export type Revenue =
  | "1억 미만"
  | "1~5억"
  | "5~10억"
  | "10~30억"
  | "30억 이상";
export type Employees = "0명" | "1~4명" | "5~9명" | "10명 이상";
export type Credit = "우수" | "보통" | "낮음" | "알 수 없음";
export type FundPurpose =
  | "운전자금"
  | "시설자금"
  | "창업자금"
  | "저신용자금"
  | "긴급자금";
export type Strength =
  | "제조업"
  | "기술력"
  | "특허"
  | "연구소"
  | "벤처"
  | "청년대표"
  | "고용증가"
  | "수출"
  | "없음";

// ── 인콜 질문지 확장 필드 타입 (9차: 인콜 스크립트 + 종합진단표 반영) ──
export type CeoCareer = "1년 미만" | "1~3년" | "3~5년" | "5~10년" | "10년 이상" | "미확인";
export type CeoAge = "만 39세 이하" | "40~49세" | "50세 이상" | "미확인";
export type Premises = "자가" | "임차" | "자택" | "공유오피스" | "미확인";
export type ActualBusiness =
  | "제조"
  | "도소매"
  | "음식점·카페"
  | "서비스"
  | "건설·인테리어"
  | "IT·플랫폼"
  | "기타";
export type RevenueTrend3y = "증가" | "유지" | "감소" | "신규라 없음" | "미확인";
export type LastYearRevenue =
  | "1억 미만"
  | "1~3억"
  | "3~5억"
  | "5~10억"
  | "10~30억"
  | "30억 이상"
  | "미확인";
export type ThisYearTrend = "전년보다 증가" | "비슷" | "감소" | "미확인";
export type NetProfit = "흑자" | "적자" | "손익분기" | "미확인";
export type CreditBand =
  | "900점 이상"
  | "800점대"
  | "700점대"
  | "600점대"
  | "600점 미만"
  | "미확인";
export type YesNoUnknown = "없음" | "있음" | "미확인";
export type DebtRelief = "없음" | "신용회복" | "회생" | "파산" | "미확인";
export type ExistingDebtLevel =
  | "없음"
  | "매출 대비 낮음"
  | "매출 대비 보통"
  | "매출 대비 높음"
  | "매출 초과"
  | "미확인";
export type SecondFinance = "없음" | "일부 있음" | "많음" | "미확인";
export type WorkingCapitalUse =
  | "인건비"
  | "원재료"
  | "광고비"
  | "임차료"
  | "고금리 대환"
  | "재고매입"
  | "기타"
  | "해당없음";
export type FacilityUse =
  | "기계구입"
  | "차량구입"
  | "공장매입"
  | "인테리어"
  | "설비교체"
  | "해당없음";
export type FundingSize = "3천 이하" | "3천~5천" | "5천~1억" | "1억~2억" | "2억 이상" | "미확인";
export type SelfFunding = "있음" | "일부 있음" | "없음" | "미확인";
export type HiringPlan = "있음" | "없음" | "미확인";
export type YouthEmployment = "있음" | "없음" | "예정" | "미확인";
export type ClarityLevel = "명확함" | "보통" | "불명확" | "미확인";
export type BizPlanReadiness = "없음" | "초안 있음" | "자료 충분" | "미확인";
// 가점/강점 (bonus-points.json formKey 항목, 복수 선택)
export type BonusItem =
  | "특허 보유"
  | "기업부설연구소 보유"
  | "벤처기업"
  | "이노비즈"
  | "메인비즈"
  | "여성기업"
  | "사회적기업"
  | "수출 실적"
  | "정부 R&D 성공"
  | "법인전환 기업"
  | "만39세 이하 청년기업"
  | "연구개발비 비중 5% 이상"
  | "매출 또는 영업이익 10% 이상 증가"
  | "노란우산공제"
  | "고용지원금 참여"
  | "없음";

export interface DiagnosisInput {
  companyName: string;
  industry: string;
  businessType: BusinessType;
  years: YearsInBusiness;
  revenue: Revenue;
  employees: Employees;
  credit: Credit;
  purpose: FundPurpose;
  strengths: Strength[];
  memo: string;
  // ── 인콜 확장 필드 (전부 옵셔널 — 기존 저장 고객 호환) ──
  // A. 기본 정보
  ceoCareer?: CeoCareer;
  ceoAge?: CeoAge;
  premises?: Premises;
  actualBusiness?: ActualBusiness;
  // B. 매출 상세
  revenueTrend3y?: RevenueTrend3y;
  lastYearRevenue?: LastYearRevenue;
  thisYearTrend?: ThisYearTrend;
  netProfit?: NetProfit;
  // C. 신용/부채/체납
  creditBand?: CreditBand;
  recentDelinquency?: YesNoUnknown;
  debtRelief?: DebtRelief;
  taxArrears?: YesNoUnknown;
  insuranceArrears?: YesNoUnknown;
  existingDebtLevel?: ExistingDebtLevel;
  secondFinance?: SecondFinance;
  // D. 자금 목적
  workingCapitalUse?: WorkingCapitalUse;
  facilityUse?: FacilityUse;
  fundingSize?: FundingSize;
  selfFunding?: SelfFunding;
  // E. 고용/운영 (직원 수는 기존 employees 필드를 4대보험 기준으로 사용)
  hiringPlan?: HiringPlan;
  youthEmployment?: YouthEmployment;
  familyStaff?: YesNoUnknown;
  // F. 가점/강점 (복수 선택)
  bonusItems?: BonusItem[];
  // G. 사업계획/실사 준비
  fundUseClarity?: ClarityLevel;
  growthPlan?: ClarityLevel;
  majorClients?: YesNoUnknown;
  assetEvidence?: YesNoUnknown;
  bizPlanReadiness?: BizPlanReadiness;
  // H. 심층 진단 전용 필드 (11차 — 조건부 섹션)
  techClarity?: ClarityLevel; // 기술성 설명 가능 여부
  quoteReady?: YesNoUnknown; // 기계/설비 견적서 보유
  productivityEvidence?: YesNoUnknown; // 생산성 개선 근거
  debtRatioStatus?: SimpleStatus; // 부채비율 상태
  interestCoverage?: CoverageStatus; // 이자보상배수 상태
  leaseReady?: YesNoUnknown; // 임대차계약서 보유
  salesEvidenceReady?: YesNoUnknown; // 매출 증빙 가능
}

export interface AgencyRecommendation {
  rank: number;
  name: string;
  score: number;
  reasons: string[];
  cautions: string[];
  // 예외 검토 (원칙적 후순위지만 강점이 많아 예외적으로 노출된 경우)
  exceptionalReview?: boolean;
  exceptionalNote?: string;
}

// TOP3 에 들지 못했거나 후순위로 밀린 기관의 사유
export interface DeprioritizedAgency {
  name: string;
  reason: string;
}

export interface CoachContent {
  questions: string[];
  keyPoints: string[];
  closingLines: string[];
  objectionLines: string[];
}

export interface SimilarCase {
  title: string;
  industry: string;
  years: string;
  revenue: string;
  agency: string;
  approved: string;
  note: string;
  lesson?: string;
  matchRate?: number;
}

// 업종 대분류 (사례 매칭·기관 판단에 사용)
export type IndustryCategory =
  | "제조"
  | "도소매"
  | "음식/외식"
  | "서비스"
  | "IT/지식서비스"
  | "건설/기타";

// 김팀장 실전 코치 인사이트
export interface CoachInsight {
  firstChecks: string[];
  risks: string[];
  strategies: string[];
  neverPromise: string[];
}

// 결과 최상단 종합진단 요약
export interface DiagnosisSummary {
  score: number;
  topAgency: string;
  coreStrategy: string;
  biggestRisk: string;
}

export interface UpsellSuggestion {
  title: string;
  desc: string;
}

// ── Knowledge Engine 산출물 (추가 필드는 모두 옵셔널 — 기존 UI는 무시하므로 안전) ──
export type RiskLevel = "매우 낮음" | "낮음" | "보통" | "높음" | "매우 높음";

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0(안전)~100(위험)
  factors: string[];
  explanation: string;
}

export interface ConfidenceAssessment {
  score: number; // 0~100 (AI 확신도)
  level: "매우 높음" | "높음" | "보통" | "낮음";
  reasons: string[];
}

export interface RoadmapStep {
  offsetLabel: string; // "오늘", "3일", "7일" ...
  offsetDays: number;
  task: string;
  phase: "30일" | "60일" | "90일";
}

export interface Roadmap {
  steps: RoadmapStep[];
  phases: { d30: string[]; d60: string[]; d90: string[] };
  // 기관별 로드맵일 때 기관명 (10차)
  agency?: string;
}

// ── 사업계획 AI / 심사 AI 산출물 (10차 — 전부 옵셔널) ──
export interface PlanScoreDimension {
  key: string;
  label: string;
  score: number;
  max: number;
  note?: string; // 부족할 때 보완 코멘트
}

export interface PlanScore {
  total: number; // 0~100
  dimensions: PlanScoreDimension[];
  weakPoints: string[]; // 부족한 부분 자동 표시
}

export interface PlanDraftSection {
  no: number;
  title: string;
  text: string;
}

export interface PlanDraft {
  agency: string; // 어떤 기관 프레임에 맞춘 초안인지
  emphasis: string; // 이 기관에서 강조할 포인트
  sections: PlanDraftSection[];
}

export interface ReviewQA {
  question: string;
  answer: string;
}

export interface ReviewSimulation {
  agency: string;
  mindset: string; // 심사관이 보는 관점
  items: ReviewQA[];
}

export interface DocumentCheck {
  label: string;
  status: "확보" | "요청 필요";
  note?: string;
}

// ── 11차: 빠른/심층 진단 + 세부 자금 트랙 ──
export type LikelihoodLevel = "높음" | "보통" | "낮음";

// 내부 점수(0~100) → 화면용 3단계 가능성
export function likelihoodOf(score: number): LikelihoodLevel {
  return score >= 70 ? "높음" : score >= 50 ? "보통" : "낮음";
}

export interface SpecialTrackCandidate {
  key: string;
  name: string;
  level: LikelihoodLevel;
  reasons: string[];
  cautions: string[];
  requiredDocuments: string[];
  consultingScript: string;
}

export type SimpleStatus = "양호" | "보통" | "높음" | "미확인";
export type CoverageStatus = "양호" | "보통" | "낮음" | "미확인";

// ── 12차: 사업계획 전략 AI 산출물 (전부 옵셔널 — 기존 UI 무시하므로 안전) ──
// 작업1: 기관별 사업계획 전략 흐름
export interface PlanStrategy {
  agency: string;
  flow: string[]; // 전략 사슬 단계
  summary: string; // 핵심 한 줄
  winReason: string; // 왜 승인될 것 같은가
}

// 작업2: 사업계획 논리 흐름 (문장이 아니라 논리 설계)
export interface PlanLogicStep {
  no: number;
  key: string;
  title: string;
  question: string; // 대표에게 물어볼 것
  guide: string; // 심사관 관점 작성 방향
  emphasized?: boolean; // 1순위 기관이 특히 강조할 단계
}

// 작업3: 업종별 스토리 3버전
export interface StoryVersion {
  key: string; // conservative | balanced | growth
  label: string; // 보수형 | 일반형 | 성장형
  tone: string;
  story: string;
}
export interface StoryPack {
  category: string;
  chain: string[]; // 매출로 이어지는 논리 고리
  versions: StoryVersion[];
}

// 작업4: 업종별 성장 논리 사슬
export interface GrowthLogic {
  category: string;
  chain: string[];
  logic: string;
  reviewerNote: string;
  keywords: string[];
}

// 작업5: 기관별 심사 포인트 (별점)
export interface ReviewFocusItem {
  label: string;
  stars: number; // 1~5
  note: string;
}
export interface ReviewFocus {
  agency: string;
  mindset: string;
  focus: ReviewFocusItem[];
}

// 작업6: 자료 우선순위 (중요도 등급)
export interface DocPriorityItem {
  label: string;
  tier: number; // 5=반드시 / 4=매우 좋음 / 3=보완
  why: string;
}

// 작업9: 사업계획 체크리스트 (체크 시 저장)
export type PlanChecklistKey =
  | "problemDefined"
  | "investmentNeed"
  | "usePlan"
  | "growthLogic"
  | "revenueLogic"
  | "employmentEffect"
  | "clientEvidence"
  | "techEvidence"
  | "facilityEvidence"
  | "repaymentLogic";
export type PlanChecklist = Record<PlanChecklistKey, boolean>;
export interface PlanChecklistDef {
  key: PlanChecklistKey;
  label: string;
}
export const PLAN_CHECKLIST_ITEMS: PlanChecklistDef[] = [
  { key: "problemDefined", label: "현재 문제 정의" },
  { key: "investmentNeed", label: "투자 필요성" },
  { key: "usePlan", label: "자금 사용 계획" },
  { key: "growthLogic", label: "성장 논리" },
  { key: "revenueLogic", label: "매출 증가 논리" },
  { key: "employmentEffect", label: "고용 효과" },
  { key: "clientEvidence", label: "거래처 근거" },
  { key: "techEvidence", label: "기술 근거" },
  { key: "facilityEvidence", label: "시설 근거" },
  { key: "repaymentLogic", label: "상환 논리" },
];

export interface DiagnosisResult {
  companyName: string;
  overallScore: number;
  topAgency: string;
  nextAction: string;
  summary: DiagnosisSummary;
  coachInsight: CoachInsight;
  agencies: AgencyRecommendation[];
  coach: CoachContent;
  documents: string[];
  cases: SimilarCase[];
  upsells: UpsellSuggestion[];
  documentMessage: string;
  followUpMessage: string;
  // Knowledge Engine 추가 산출물 (옵셔널)
  reasoning?: string;
  risk?: RiskAssessment;
  confidence?: ConfidenceAssessment;
  roadmap?: Roadmap;
  industryCategory?: IndustryCategory;
  // 후순위/제외 기관 사유 (9차: 기관 적격성 보정)
  deprioritized?: DeprioritizedAgency[];
  // 사업계획 AI / 심사 AI (10차 — 전부 옵셔널)
  planQuestions?: string[]; // 사업계획서 작성용 추가 질문
  planScore?: PlanScore; // 사업계획 완성도 (100점)
  planDraft?: PlanDraft; // 사업계획 초안 (8개 섹션)
  reviewSim?: ReviewSimulation; // 심사관 시뮬레이터 (질문+모범답안)
  documentChecks?: DocumentCheck[]; // 자료 확보/부족 체크
  growthKeywords?: string[]; // 업종별 성장 키워드
  coachMessage?: string; // 김팀장 AI 한마디
  // 11차: 3단계 가능성 + 세부 자금 트랙
  likelihoodLevel?: LikelihoodLevel;
  specialTracks?: SpecialTrackCandidate[];
  // 12차: 사업계획 전략 AI (전부 옵셔널)
  planStrategy?: PlanStrategy; // 작업1: 기관별 전략 흐름
  planLogic?: PlanLogicStep[]; // 작업2: 논리 흐름 7단계
  storyPack?: StoryPack; // 작업3: 업종별 스토리 3버전
  growthLogic?: GrowthLogic; // 작업4: 성장 논리 사슬
  reviewFocus?: ReviewFocus; // 작업5: 심사 포인트(별점)
  documentPriority?: DocPriorityItem[]; // 작업6: 자료 우선순위
  agencyComparison?: string[]; // 작업10: 왜 이 기관인가 비교 근거
}

// 고객(CRM) 진행 단계 및 고객 레코드 — Mock 대시보드/상세에서 사용.
// 다음 단계에서 Supabase 연동 시 그대로 테이블 컬럼으로 매핑할 수 있도록 잡아둔다.
export type CustomerStage =
  | "신규 DB"
  | "1차 상담 완료"
  | "계약 검토"
  | "서류 요청"
  | "서류 대기"
  | "접수 준비"
  | "접수 완료"
  | "심사 중"
  | "승인"
  | "보류"
  | "실패"
  | "재접촉 예정";

// 상담 진행 체크리스트 (클로징 지원)
export type ConsultationChecklistKey =
  | "needs"
  | "purpose"
  | "debt"
  | "credit"
  | "revenue"
  | "taxArrears"
  | "agencyExplained"
  | "orderExplained"
  | "feeExplained"
  | "noGuaranteeNotice"
  | "docsRequested"
  | "nextMeeting";

export type ConsultationChecklist = Record<ConsultationChecklistKey, boolean>;

// 대표(고객) 반응
export type LeadReaction =
  | "긍정적"
  | "고민 중"
  | "비용 부담"
  | "타 업체 비교 중"
  | "연락 두절"
  | "보류 요청"
  | "진행 의사 있음";

export interface Customer {
  id: string;
  companyName: string;
  industry: string;
  businessType: BusinessType;
  recommendedAgency: string;
  score: number;
  stage: CustomerStage;
  nextAction: string;
  lastContactedAt: string;
  updatedAt: string;
  upsellOpportunities: string[];
  memo: string;
  // 진단에서 저장된 고객만 보유 (Mock 고객에는 없음)
  diagnosisInput?: DiagnosisInput;
  diagnosisResult?: DiagnosisResult;
  // 상담/클로징 확장 (기존·Mock 고객에는 없을 수 있어 옵셔널)
  consultationChecklist?: ConsultationChecklist;
  leadReaction?: LeadReaction | null;
  closingScore?: number;
  // 빠른/심층 진단 이력 (11차 — 옵셔널)
  quickDiagnosisInput?: DiagnosisInput;
  deepDiagnosisInput?: DiagnosisInput;
  likelihoodLevel?: LikelihoodLevel;
  specialFundingTracks?: SpecialTrackCandidate[];
}

// 진행단계 드롭다운/필터에 재사용
export const CUSTOMER_STAGES: CustomerStage[] = [
  "신규 DB",
  "1차 상담 완료",
  "계약 검토",
  "서류 요청",
  "서류 대기",
  "접수 준비",
  "접수 완료",
  "심사 중",
  "승인",
  "보류",
  "실패",
  "재접촉 예정",
];

// 폼 select/chip 렌더링에 재사용하는 옵션 목록
export const BUSINESS_TYPES: BusinessType[] = ["개인사업자", "법인사업자"];
export const YEARS_OPTIONS: YearsInBusiness[] = [
  "1년 미만",
  "1~3년",
  "3~7년",
  "7년 이상",
];
export const REVENUE_OPTIONS: Revenue[] = [
  "1억 미만",
  "1~5억",
  "5~10억",
  "10~30억",
  "30억 이상",
];
export const EMPLOYEE_OPTIONS: Employees[] = [
  "0명",
  "1~4명",
  "5~9명",
  "10명 이상",
];
export const CREDIT_OPTIONS: Credit[] = ["우수", "보통", "낮음", "알 수 없음"];
export const PURPOSE_OPTIONS: FundPurpose[] = [
  "운전자금",
  "시설자금",
  "창업자금",
  "저신용자금",
  "긴급자금",
];
export const STRENGTH_OPTIONS: Strength[] = [
  "제조업",
  "기술력",
  "특허",
  "연구소",
  "벤처",
  "청년대표",
  "고용증가",
  "수출",
  "없음",
];

// ── 인콜 확장 필드 옵션 목록 (폼 렌더링용) ──
export const CEO_CAREER_OPTIONS: CeoCareer[] = ["1년 미만", "1~3년", "3~5년", "5~10년", "10년 이상", "미확인"];
export const CEO_AGE_OPTIONS: CeoAge[] = ["만 39세 이하", "40~49세", "50세 이상", "미확인"];
export const PREMISES_OPTIONS: Premises[] = ["자가", "임차", "자택", "공유오피스", "미확인"];
export const ACTUAL_BUSINESS_OPTIONS: ActualBusiness[] = ["제조", "도소매", "음식점·카페", "서비스", "건설·인테리어", "IT·플랫폼", "기타"];
export const REVENUE_TREND_3Y_OPTIONS: RevenueTrend3y[] = ["증가", "유지", "감소", "신규라 없음", "미확인"];
export const LAST_YEAR_REVENUE_OPTIONS: LastYearRevenue[] = ["1억 미만", "1~3억", "3~5억", "5~10억", "10~30억", "30억 이상", "미확인"];
export const THIS_YEAR_TREND_OPTIONS: ThisYearTrend[] = ["전년보다 증가", "비슷", "감소", "미확인"];
export const NET_PROFIT_OPTIONS: NetProfit[] = ["흑자", "적자", "손익분기", "미확인"];
export const CREDIT_BAND_OPTIONS: CreditBand[] = ["900점 이상", "800점대", "700점대", "600점대", "600점 미만", "미확인"];
export const YES_NO_UNKNOWN_OPTIONS: YesNoUnknown[] = ["없음", "있음", "미확인"];
export const DEBT_RELIEF_OPTIONS: DebtRelief[] = ["없음", "신용회복", "회생", "파산", "미확인"];
export const EXISTING_DEBT_LEVEL_OPTIONS: ExistingDebtLevel[] = ["없음", "매출 대비 낮음", "매출 대비 보통", "매출 대비 높음", "매출 초과", "미확인"];
export const SECOND_FINANCE_OPTIONS: SecondFinance[] = ["없음", "일부 있음", "많음", "미확인"];
export const WORKING_CAPITAL_USE_OPTIONS: WorkingCapitalUse[] = ["인건비", "원재료", "광고비", "임차료", "고금리 대환", "재고매입", "기타", "해당없음"];
export const FACILITY_USE_OPTIONS: FacilityUse[] = ["기계구입", "차량구입", "공장매입", "인테리어", "설비교체", "해당없음"];
export const FUNDING_SIZE_OPTIONS: FundingSize[] = ["3천 이하", "3천~5천", "5천~1억", "1억~2억", "2억 이상", "미확인"];
export const SELF_FUNDING_OPTIONS: SelfFunding[] = ["있음", "일부 있음", "없음", "미확인"];
export const HIRING_PLAN_OPTIONS: HiringPlan[] = ["있음", "없음", "미확인"];
export const YOUTH_EMPLOYMENT_OPTIONS: YouthEmployment[] = ["있음", "없음", "예정", "미확인"];
export const CLARITY_OPTIONS: ClarityLevel[] = ["명확함", "보통", "불명확", "미확인"];
export const BIZ_PLAN_READINESS_OPTIONS: BizPlanReadiness[] = ["없음", "초안 있음", "자료 충분", "미확인"];
export const BONUS_ITEM_OPTIONS: BonusItem[] = [
  "특허 보유",
  "기업부설연구소 보유",
  "벤처기업",
  "이노비즈",
  "메인비즈",
  "여성기업",
  "사회적기업",
  "수출 실적",
  "정부 R&D 성공",
  "법인전환 기업",
  "만39세 이하 청년기업",
  "연구개발비 비중 5% 이상",
  "매출 또는 영업이익 10% 이상 증가",
  "노란우산공제",
  "고용지원금 참여",
  "없음",
];
