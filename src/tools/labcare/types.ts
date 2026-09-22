// 사후관리 SaaS 도메인 타입 정의

/** 연구소 유형 */
export type LabType = "기업부설연구소" | "연구개발전담부서";

/** (선택) 연구원 상세 — 샘플/상세 인력 명단. 인건비 합계는 Client.researchersPayrollTotal에 집계된다. */
export interface ResearcherInfo {
  name: string;
  /** 직책 (연구소장 / 전담부서장 / 연구전담요원) */
  role: string;
  /** 입사일 (YYYY-MM-DD) */
  joinDate: string;
  /** 연구전담 여부 */
  dedicated: boolean;
  /** 연봉 (원) */
  annualSalary: number;
  /** 월 급여 (원) */
  monthlySalary: number;
}

/** 위험도 등급 (정상 → 주의 → 위험 → 즉시 확인 순으로 시급) */
export type RiskLevel = "정상" | "주의" | "위험" | "즉시 확인";

/** 점검 이력이 없는 고객사 표기용 */
export type ClientStatus = RiskLevel | "미점검";

/** 고객사 기본정보 */
export interface Client {
  id: string;
  /** 회사명 / 상호 */
  name: string;
  /** 업종 */
  industry: string;
  /** 연구소 유형 */
  labType: LabType;
  /** 대표자명 */
  ceoName: string;
  /** 사업장 주소 */
  address: string;
  /** 인정(설립) 신고일 (YYYY-MM-DD) */
  certifiedDate: string;
  /** 법인 설립일 (YYYY-MM-DD) */
  foundedDate?: string;
  /** 상시 근로자 수 */
  employeeCount?: number;
  /** 연구전담요원 수 */
  researcherCount: number;
  /** 연구소(전담부서) 명칭 */
  labName: string;
  /** 담당 컨설턴트 */
  consultant: string;
  /** 사업자 유형 (법인/개인) */
  businessType?: "법인사업자" | "개인사업자";
  /** 연구소/전담부서 인정번호 */
  labRegistrationNumber?: string;
  /** 신고관리시스템 비밀번호 메모 (데모: demo-**** 형태만 사용) */
  labPortalPassword?: string;
  /* ── 절세 예상 계산용 (모두 원 단위, 검토용) ── */
  /** 연구전담요원 연간 인건비 합계 */
  researchersPayrollTotal?: number;
  /** 연구 관련 재료비/시약/부품비 연간 예상액 */
  rndMaterialCost?: number;
  /** 기타 연구개발비 예상액 */
  rndOtherCost?: number;
  /** 전년도 연구개발비 (선택) */
  priorYearRndCost?: number;
  /** 당해연도 연구개발비 (선택, 미입력 시 인건비+재료비+기타로 추정) */
  currentYearRndCost?: number;
  /** 공제 유형 */
  taxCreditCategory?: "일반 R&D" | "신성장·원천기술" | "국가전략기술" | "미정";
  /** 세금 유형 (미지정 시 사업자 유형으로 추정) */
  businessTaxType?: "법인세" | "종합소득세";
  /** 예상 공제율(%) — 미지정 시 공제유형 기본값 */
  estimatedTaxCreditRate?: number;
  /** 절세 검토 메모 */
  taxMemo?: string;
  /** 고용지원금 점검 Tip (미지정 시 규칙으로 자동 계산) */
  hiringTip?: string;
  /** 핵심 이슈 (관리 메모) */
  coreIssue?: string;
  /** 비고 */
  note?: string;
  createdAt: string;
  /* ── 샘플 데이터 식별 (실제 등록 고객과 구분) ── */
  /** 샘플(예시) 고객 여부 */
  isSample?: boolean;
  /** 데이터 출처: 직접 등록은 'manual', 샘플은 'sample' */
  source?: "manual" | "sample";
  /** 샘플 생성 배치 식별자 */
  sampleBatchId?: string;
  /** (선택) 연구원 상세 명단 */
  researchers?: ResearcherInfo[];
  /** (선택) 벤처기업 인증 보유 — 연구원 2인 기업부설연구소 예외 판단 등 */
  isVenture?: boolean;
  /** (선택) 업력(개월) */
  businessMonths?: number;
}

/** 인사 변동 유형 */
export type PersonnelChangeType = "입사" | "퇴사" | "부서이동";

/** 월간 사후관리 점검 응답
 *  - 상태형 항목은 boolean (good 방향이 true가 되도록 명명)
 *  - 변동형 항목은 boolean + 상세 */
export interface CheckAnswers {
  /** 연구전담요원 입사/퇴사/부서이동 발생 여부 */
  personnelChange: boolean;
  personnelChangeType?: PersonnelChangeType;
  /** 연구소 공간(전용공간) 변경 여부 */
  spaceChange: boolean;
  /** 주소/대표자/상호 등 인정사항 변경 여부 */
  registrationChange: boolean;
  /** 연구과제 진행 여부 (true = 정상 진행) */
  projectOngoing: boolean;
  /** 연구노트 작성 여부 (true = 정상 작성) */
  researchNotesWritten: boolean;
  /** 연구개발비 증빙 정리 여부 (true = 정리 완료) */
  expenseEvidenceOrganized: boolean;
  /** 세무사 전달자료 준비 여부 (true = 준비 완료) */
  taxDocsPrepared: boolean;
  /** 연구개발활동조사 대응 필요 여부 (true = 대응 필요) */
  surveyResponseNeeded: boolean;
  /** 특이사항 메모 */
  memo: string;
}

/** 월간 점검 기록 */
export interface MonthlyCheck {
  id: string;
  clientId: string;
  /** 점검 대상 월 (YYYY-MM) */
  month: string;
  answers: CheckAnswers;
  /** 자동 계산된 위험 점수 (0~100, 높을수록 위험) */
  score: number;
  /** 자동 계산된 위험 등급 */
  level: RiskLevel;
  createdAt: string;
  isSample?: boolean;
  sampleBatchId?: string;
}

/** 위험 요인 (리포트/상세 표시용) */
export interface RiskFactor {
  key: string;
  /** 표시 라벨 (예: 연구노트 미작성) */
  label: string;
  severity: "high" | "medium" | "low";
  points: number;
  /** 왜 문제가 되는지 */
  detail: string;
  /** 권장 조치 */
  action: string;
}

/** 위험도 평가 결과 */
export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

/* ───────────────── 연구과제 / 연구노트 ───────────────── */

/** 연구과제 */
export interface ResearchProject {
  id: string;
  clientId: string;
  /** 연구과제명 */
  name: string;
  /** 업종/제품/서비스와의 연결 (실사 대응 핵심) */
  productService: string;
  /** 과제 시작일 (YYYY-MM-DD) */
  startDate: string;
  status: "진행중" | "완료" | "중단";
  isSample?: boolean;
  sampleBatchId?: string;
}

/** 연구노트 작성 상태 */
export type NoteStatus =
  | "작성 필요"
  | "작성중"
  | "초안 완료"
  | "실사보완 완료"
  | "저장 완료";

/** 참여 연구원별 역할 */
export interface ResearcherRole {
  name: string;
  role: string;
}

/** 월간 연구노트 */
export interface ResearchNote {
  id: string;
  clientId: string;
  projectId: string;
  /** 대상 월 (YYYY-MM) */
  month: string;
  /** 이번 달 연구활동 */
  activities: string;
  /** 테스트/개선 내용 */
  tests: string;
  /** 문제점 */
  problems: string;
  /** 다음 계획 */
  nextPlan: string;
  /** 참여 연구원별 역할 */
  roles: ResearcherRole[];
  /** 업종/제품/서비스와의 직접 관련성 */
  relevance: string;
  /** 생성된 연구노트 초안 */
  draft: string;
  /** 실사 대응 관점 보완 완료 여부 */
  auditReviewed: boolean;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
  isSample?: boolean;
  sampleBatchId?: string;
}

/** 리포트 발송 기록 */
export interface ReportLog {
  clientId: string;
  month: string;
  sentAt: string;
}

/* ───────────────── 설립 빠른판정 ─────────────────
 * 근거: docs/RND_LAB_RULES_2026.md (2026 업무편람 + 기업부설연구소법) */

/** 희망 설립 유형 (아직 모름 포함) */
export type LabTypeChoice = LabType | "아직 모름";

/** 기업 규모 (중소기업 = 소기업 + 중기업) */
export type CompanySize = "소기업" | "중기업" | "중견기업" | "대기업";

/** 업종 분야 (연구전담요원 자격 예외 판단용) */
export type IndustryField = "과학기술 분야" | "서비스 분야" | "산업디자인 분야";

export type EducationLevel =
  | "박사"
  | "석사"
  | "학사"
  | "전문학사(3년제)"
  | "전문학사(2년제)"
  | "마이스터고·특성화고 졸업"
  | "고졸 이하";

export type MajorField =
  | "자연계열"
  | "공학계열"
  | "의약계열"
  | "기타 이공계"
  | "비이공계";

export type CertLevel = "기사 이상" | "산업기사" | "기능사" | "없음";

/** 연구개발활동 성격 (긍정 요소) */
export type ActivityNature =
  | "새로운 제품·공정·서비스 개발"
  | "기존 제품·서비스의 기술적 개선"
  | "애매함"
  | "해당 없음";

/** 연구개발활동 부정 요소 (조특법 시행령 제1조의2 제외활동 기반) */
export type NegativeActivity =
  | "단순 유지보수"
  | "단순 기술지원"
  | "일상적 품질관리"
  | "시장조사·판촉활동"
  | "일반 관리·경영개선"
  | "단순 소프트웨어 개선"
  | "보편화된 기술의 단순 활용"
  | "수익 목적의 위탁연구 중심";

/** 연구원 후보자 */
export interface ResearcherCandidate {
  id: string;
  name: string;
  /** 대표자 여부 */
  isCeo: boolean;
  /** 등기임원 여부 */
  isRegisteredExec: boolean;
  /** 상근 여부 */
  fullTime: boolean;
  /** 4대보험 가입(예정) 여부 */
  insured: boolean;
  /** 연구업무 전담 여부 */
  researchDedicated: boolean;
  /** 생산·판매·영업·관리 등 다른 업무 겸직 여부 */
  hasOtherDuties: boolean;
  /** 주간 일반대학원 석사 이상 과정 재학 여부 */
  daytimeGradSchool: boolean;
  education: EducationLevel;
  major: MajorField;
  cert: CertLevel;
  /** 연구개발 경력(년) */
  researchYears: number;
  /** 실제 담당할 연구업무 내용 */
  dutyDescription: string;
}

/** 설립 빠른판정 입력 */
export interface FeasibilityInput {
  desiredType: LabTypeChoice;
  companyName: string;
  industry: string;
  industryField: IndustryField;
  /** 제외 업종 여부 */
  isExcludedIndustry: boolean;
  companySize: CompanySize;
  isVenture: boolean;
  /** 연구원·교원 창업기업 여부 */
  isResearcherFounded: boolean;
  /** 업력 (개월) */
  businessMonths: number;
  /** 소기업에서 중기업이 된 지 1년 이내 여부 */
  becameMediumWithinYear: boolean;
  employeeCount: number;
  /** 해외소재 연구소로 설립 검토 여부 */
  isOverseasLab: boolean;

  /* 신고대상 */
  /** 영리활동을 하는 기업인지 */
  isForProfit: boolean;
  /** 생산·판매·관리 등 기업경영 조직(인력)이 있는지 */
  hasBusinessOps: boolean;
  /** 연구개발활동만 수행하는 회사인지 */
  rndOnlyCompany: boolean;
  /** 연구소/전담부서를 기업 내 하부조직으로 두는지 */
  isSubUnit: boolean;

  /* 연구개발활동 적합성 */
  projectName: string;
  /** 사업화 이전 단계 여부 */
  preCommercial: boolean;
  activityNature: ActivityNature;
  negativeActivities: NegativeActivity[];

  /* 물적요건 */
  hasSpace: boolean;
  /** 독립 연구공간 여부 */
  independentSpace: boolean;
  /** 고정벽체 + 별도 출입문 여부 */
  fixedWallsAndDoor: boolean;
  /** 분리·이동 가능한 벽체(2m 이상) 적용 가능 여부 */
  movableWallPossible: boolean;
  /** 연구공간 전용면적 50㎡ 이하 여부 */
  spaceUnder50: boolean;
  /** 연구전담요원이 상시 근무 가능한 면적 여부 */
  adequateArea: boolean;
  /** 연구기자재가 연구공간 안에 위치하는지 */
  equipmentInSpace: boolean;
  /** 정보서비스·소프트웨어개발공급 업종 여부 (전담부서 분리구역 예외) */
  isInfoServiceOrSW: boolean;

  candidates: ResearcherCandidate[];
}

/** 설립 판정 결과 (점수가 아닌 판정형) */
export type FeasibilityVerdict =
  | "기업부설연구소 가능"
  | "연구개발전담부서 우선 추천"
  | "보완 후 가능"
  | "현재 진행 비추천"
  | "추가 확인 필요";

/** 추천 추진 유형 */
export type RecommendedPath =
  | "기업부설연구소"
  | "연구개발전담부서"
  | "전담부서 선설립 후 연구소 전환"
  | "추가 검토";

/** 후보자별 판정 */
export type CandidateVerdict = "인정 가능" | "추가 확인 필요" | "인정 어려움";

export interface CandidateAssessment {
  candidate: ResearcherCandidate;
  verdict: CandidateVerdict;
  notes: string[];
}

/** 대표자 연구전담요원 포함 가능성 (보수적 판정) */
export type CeoVerdict = "가능성 있음" | "추가 확인 필요" | "인정 어려움" | "해당 없음";

export interface CeoEligibility {
  applicable: boolean;
  verdict: CeoVerdict;
  /** 판정 근거 문구 */
  basis: string;
  /** 주의사항 */
  cautions: string[];
  /** 창업 3년 경과 시 안내 문구 */
  threeYearNote: string;
}

/** 신고대상 기업 여부 판정 */
export type EligibilityVerdict =
  | "신고대상으로 보임"
  | "추가 확인 필요"
  | "신고대상 부적합 가능성";

/** 연구개발활동 적합성 판정 */
export type ActivityVerdict = "연구개발활동 적합" | "보완 필요" | "부적합 가능성";

/** 물적요건 판정 */
export type FacilityVerdict = "물적요건 충족" | "보완 필요" | "추가 확인 필요" | "진행 어려움";

export interface SectionAssessment<V extends string> {
  verdict: V;
  notes: string[];
}

/** 설립 빠른판정 결과 */
export interface FeasibilityResult {
  verdict: FeasibilityVerdict;
  /** 추천 추진 유형 */
  recommendedType: RecommendedPath;
  /** 권장 경로 기준 필요한 연구전담요원 수 */
  requiredResearchers: number;
  /** 기업부설연구소 기준 필요 인원 (참고) */
  requiredForLab: number;
  /** 인정 가능해 보이는 후보 수 */
  eligibleCount: number;
  /** 추가 확인 필요 후보 수 */
  reviewCount: number;
  /** 부족 인원 (권장 경로 기준) */
  shortage: number;
  ceo: CeoEligibility;
  candidates: CandidateAssessment[];
  /** 신고대상 기업 여부 */
  eligibility: SectionAssessment<EligibilityVerdict>;
  /** 연구개발활동 적합성 */
  activity: SectionAssessment<ActivityVerdict>;
  /** 물적요건 */
  facility: SectionAssessment<FacilityVerdict>;
  /** 보완해야 할 사항 */
  improvements: string[];
  /** 추천 진행 전략 */
  strategy: string[];
  /** 한 줄 요약 (현재 입력 기준) */
  summary: string;
}
