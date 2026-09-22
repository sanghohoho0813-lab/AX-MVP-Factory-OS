// ─────────────────────────────────────────────────────────────
// Funding Knowledge Engine — 오케스트레이터
//
// knowledge/*.json 을 읽어 "생각하는 엔진"으로 진단을 만든다.
// diagnosis.ts 는 이 파일의 runKnowledgeDiagnosis() 를 호출하는 얇은 컨트롤러가 된다.
//
// 파이프라인:
//   입력 → 전처리(profile) → industryCategory 추론 → precheck/agency/cases 검색
//   → 유사도 → risk → reasoning → scripts → upsell → roadmap → confidence → DiagnosisResult
// ─────────────────────────────────────────────────────────────

import type {
  DiagnosisInput,
  DiagnosisResult,
  IndustryCategory,
  Strength,
} from "../types";
import {
  CREDIT_OPTIONS,
  EMPLOYEE_OPTIONS,
  REVENUE_OPTIONS,
  YEARS_OPTIONS,
} from "../types";

// knowledge 데이터 (12개 JSON)
import agenciesJson from "../knowledge/funding-agencies.json";
import casesJson from "../knowledge/funding-cases.json";
import checkpointsJson from "../knowledge/funding-checkpoints.json";
import corePrinciplesJson from "../knowledge/funding-core-principles.json";
import precheckJson from "../knowledge/precheck-rules.json";
import rejectionJson from "../knowledge/rejection-reasons.json";
import planQuestionsJson from "../knowledge/business-plan-questions.json";
import scriptsJson from "../knowledge/funding-scripts.json";
import upsellsJson from "../knowledge/funding-upsells.json";
import upsellRulesJson from "../knowledge/upsell-rules.json";
import contractNoticesJson from "../knowledge/consulting-contract-notices.json";
import fieldReviewJson from "../knowledge/field-review-playbook.json";

import { matchCases } from "./caseMatcher";
import { selectAgencies } from "./agencySelector";
import { analyzeRisk } from "./riskAnalyzer";
import { generateReasoning } from "./reasoning";
import { generateScripts, generateMessages, buildCoachInsight } from "./scriptGenerator";
import { recommendUpsells } from "./upsellEngine";
import { buildRoadmap } from "./roadmapEngine";
import { calculateConfidence } from "./confidenceCalculator";
// ── 사업계획 AI / 심사 AI (10차) ──
import { getFramework, scorePlan } from "./planEngine";
import { buildPlanDraft } from "./storyEngine";
import { generatePlanQuestions } from "./questionEngine";
import { buildReviewSimulation } from "./reviewEngine";
import { checkDocuments } from "./documentEngine";
import { getGrowthPoints } from "./growthEngine";
import { detectSpecialTracks } from "./trackEngine";
// ── 사업계획 전략 AI (12차) ──
import {
  getPlanStrategy,
  getPlanLogic,
  buildAgencyComparison,
} from "./strategyEngine";
import { buildStoryVersions } from "./storyEngine";
import { getGrowthLogic } from "./growthLogicEngine";
import { getReviewFocus } from "./reviewFocusEngine";
import { getDocumentPriority } from "./documentPriorityEngine";
import { likelihoodOf } from "../types";

// ── knowledge 스키마 타입 ──
export interface AgencyRule {
  key: string;
  name: string;
  aliases?: string[];
  tier: string;
  suitableFor: string[];
  notSuitableFor: string[];
  mainPurposes: string[];
  favorableIndustries: string[];
  unfavorableConditions: string[];
  checkDocuments: string[];
  order: string;
  mode: string;
  consultingScript: string;
  cautions: string[];
}
export interface CaseRecord {
  id: string;
  title: string;
  industry: string;
  industryCategory: IndustryCategory;
  businessAge: string | null;
  revenue: string | null;
  creditStatus: string | null;
  debtStatus: string | null;
  employees: string | null;
  fundingPurpose: string;
  institutions: string[];
  approvedAmount: string;
  situation: string;
  strategy: string;
  keyPoint: string;
  risk: string;
  lesson: string;
  upsellOpportunity: string;
  sourceNote: string;
  searchTags: string[];
}
export interface ScriptGroup {
  key: string;
  label: string;
  scripts: string[];
}
export interface UpsellItem {
  key: string;
  name: string;
  recommendCondition: string;
  consultingScript: string;
  requiredDocuments: string[];
  linkReason: string;
  cautions: string[];
}
export interface UpsellRule {
  trigger: string;
  recommendKeys: string[];
  note: string;
}
export interface Checkpoint {
  key: string;
  label: string;
  whatReviewersSee: string;
  favorable: string[];
  unfavorable: string[];
  coachAction: string;
}
export interface RejectionReason {
  key: string;
  label: string;
  detail: string;
  fixable: boolean;
  remedy: string;
}
export interface ContractNotice {
  key: string;
  label: string;
  text: string;
}
export interface PlanQuestionSet {
  industry: string;
  focus: string[];
  questions: string[];
}

// ── knowledge 번들 (엔진 전역에서 함수 인자로 전달) ──
export interface KnowledgeBase {
  agencies: AgencyRule[];
  cases: CaseRecord[];
  checkpoints: Checkpoint[];
  fiveChecklist: { key: string; label: string; why: string }[];
  preRestrictions: { key: string; label: string; detail: string; severity: string }[];
  ninetyDayPlan: string[];
  rejectionReasons: RejectionReason[];
  planQuestions: PlanQuestionSet[];
  planCoreQuestions: string[];
  scriptGroups: ScriptGroup[];
  upsells: UpsellItem[];
  upsellRules: UpsellRule[];
  contractNotices: ContractNotice[];
  fieldReviewChecklist: { key: string; label: string; detail: string }[];
  requiredDocuments: string[];
}

const KB: KnowledgeBase = {
  agencies: (agenciesJson as unknown as { agencies: AgencyRule[] }).agencies,
  cases: (casesJson as unknown as { cases: CaseRecord[] }).cases,
  checkpoints: (checkpointsJson as unknown as { checkpoints: Checkpoint[] })
    .checkpoints,
  fiveChecklist: (
    precheckJson as unknown as {
      fiveChecklist: { items: { key: string; label: string; why: string }[] };
    }
  ).fiveChecklist.items,
  preRestrictions: (
    precheckJson as unknown as {
      preRestrictions: {
        items: { key: string; label: string; detail: string; severity: string }[];
      };
    }
  ).preRestrictions.items,
  ninetyDayPlan: (
    precheckJson as unknown as {
      preNinetyDayManagement: { items: string[] };
    }
  ).preNinetyDayManagement.items,
  rejectionReasons: (
    rejectionJson as unknown as { rejectionReasons: RejectionReason[] }
  ).rejectionReasons,
  planQuestions: (
    planQuestionsJson as unknown as { industryQuestions: PlanQuestionSet[] }
  ).industryQuestions,
  planCoreQuestions: (
    planQuestionsJson as unknown as { coreQuestions: string[] }
  ).coreQuestions,
  scriptGroups: (scriptsJson as unknown as { scriptGroups: ScriptGroup[] })
    .scriptGroups,
  upsells: (upsellsJson as unknown as { upsells: UpsellItem[] }).upsells,
  upsellRules: (upsellRulesJson as unknown as { rules: UpsellRule[] }).rules,
  contractNotices: (
    contractNoticesJson as unknown as { preContractNotices: ContractNotice[] }
  ).preContractNotices,
  fieldReviewChecklist: (
    fieldReviewJson as unknown as {
      preReviewChecklist: { key: string; label: string; detail: string }[];
    }
  ).preReviewChecklist,
  requiredDocuments: [
    "사업자등록증",
    "부가세과세표준증명",
    "재무제표 또는 손익자료",
    "4대보험 가입자명부",
    "국세/지방세 납세증명서",
    "신용정보 확인 관련 자료",
    "임대차계약서 또는 사업장 자료",
    "자금 사용 계획 자료",
  ],
};

// core-principles 는 3분류 트리아지에 참조 (문서 로드 확인용)
export const CORE_PRINCIPLES = corePrinciplesJson as unknown as {
  fundingTypes: { key: string; name: string; oneLine: string }[];
};

// 기관 접수에 필요한 표준 서류 (참조 데이터)
export const REQUIRED_DOCUMENTS: string[] = KB.requiredDocuments;

// ── 공통 헬퍼 ──
export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

const STRENGTH_KEYWORD: Record<string, string> = {
  제조업: "제조",
  기술력: "기술",
  특허: "특허",
  연구소: "연구소",
  벤처: "벤처",
  청년대표: "청년",
  고용증가: "고용",
  수출: "수출",
};

// industryCategory 추론 (6-value 통제 어휘 — knowledge/funding-cases.json 과 동일 기준)
export function inferIndustryCategory(text: string): IndustryCategory {
  const s = (text || "").toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => s.includes(k.toLowerCase()));
  if (has("제조", "공장", "가공", "생산", "부품", "금속", "기계", "섬유", "화학", "전자", "oem"))
    return "제조";
  if (has("음식", "외식", "식당", "카페", "요식", "한식", "분식", "주점", "베이커리", "치킨", "배달", "프랜차이즈"))
    return "음식/외식";
  if (has("소프트", "아이티", "it", "앱", "플랫폼", "개발", "소프트웨어", "지식", "콘텐츠", "바이오", "테크", "스타트업", "게임", "ai", "데이터"))
    return "IT/지식서비스";
  if (has("도소매", "도매", "소매", "쇼핑몰", "판매", "유통", "커머스", "상사", "마트", "무역", "온라인", "화장품", "중고차", "식자재"))
    return "도소매";
  if (has("건설", "인테리어", "시공", "토목", "전기공사", "설비공사", "건축", "농업"))
    return "건설/기타";
  if (has("미용", "서비스", "운송", "물류", "교육", "학원", "병원", "의료", "숙박", "용역", "컨설", "청소", "세탁", "정비", "광고", "왁싱", "네일", "피부", "애견"))
    return "서비스";
  return "건설/기타";
}

// ── 전처리: 입력 → Profile ──
export interface Profile {
  input: DiagnosisInput;
  industryCategory: IndustryCategory;
  companyName: string;
  isCorp: boolean;
  hasStrength: (s: Strength) => boolean;
  hasTech: boolean;
  hasPatent: boolean;
  hasLab: boolean;
  hasVenture: boolean;
  hasManufacturing: boolean;
  isYouth: boolean;
  hasEmploymentGrowth: boolean;
  hasExport: boolean;
  strengthKeywords: string[];
  yearsIdx: number;
  revenueIdx: number;
  employeesIdx: number;
  creditIdx: number; // 0 낮음~3 우수, -1 알수없음
  tags: string[];
  // ── 인콜 확장 파생 신호 (9차) ──
  revenueEok: number; // 전년도 매출 추정(억) — lastYearRevenue 우선, 없으면 기존 revenue
  lowCredit: boolean; // 낮음 / 600점대 이하 / 연체·신용회복 이력
  veryLowCredit: boolean; // 600점 미만 / 회생·파산
  highCredit: boolean; // 우수 / 800점대 이상
  heavySecondFinance: boolean; // 2금융·카드론 많음
  someSecondFinance: boolean;
  taxBlocked: boolean; // 국세/지방세 또는 4대보험 체납 있음
  debtHeavy: boolean; // 기대출 매출 대비 높음/초과
  growth: boolean; // 3년 추세 증가 또는 올해 증가
  smallFundOnly: boolean; // 필요자금 3천 이하 + 운전자금
  facilityIntent: boolean; // 시설자금 목적(기계/공장/설비 등 포함)
  hasCerts: boolean; // 벤처·이노비즈·메인비즈 등 인증 보유
  bonusCount: number; // 선택된 가점 개수 (없음 제외)
  shortCareer: boolean; // 대표 경력 3년 미만
  hasMajorClients: boolean;
}

// lastYearRevenue(신규 구간) → 억 단위 추정
const LAST_YEAR_REVENUE_EOK: Record<string, number> = {
  "1억 미만": 0.5,
  "1~3억": 2,
  "3~5억": 4,
  "5~10억": 7.5,
  "10~30억": 20,
  "30억 이상": 40,
};
// 기존 revenue(구 구간) → 억 단위 추정
const LEGACY_REVENUE_EOK: Record<string, number> = {
  "1억 미만": 0.5,
  "1~5억": 3,
  "5~10억": 7.5,
  "10~30억": 20,
  "30억 이상": 40,
};

// 가점 항목 → 매칭 키워드 (사례·기관 매칭에 합류)
const BONUS_KEYWORD: Record<string, string> = {
  "특허 보유": "특허",
  "기업부설연구소 보유": "연구소",
  벤처기업: "벤처",
  이노비즈: "이노비즈",
  메인비즈: "메인비즈",
  "수출 실적": "수출",
  "정부 R&D 성공": "R&D",
  "만39세 이하 청년기업": "청년",
};

export function buildProfile(input: DiagnosisInput): Profile {
  // 실제 하는 일 분류(actualBusiness)가 있으면 업종 추론에 우선 반영
  const industryText = [input.actualBusiness, input.industry]
    .filter(Boolean)
    .join(" ");
  const industryCategory = inferIndustryCategory(industryText);
  const has = (s: Strength) => input.strengths.includes(s);
  const bonusItems = (input.bonusItems ?? []).filter((b) => b !== "없음");
  const strengthKeywords = Array.from(
    new Set([
      ...input.strengths
        .filter((s) => s !== "없음")
        .map((s) => STRENGTH_KEYWORD[s])
        .filter(Boolean),
      ...bonusItems.map((b) => BONUS_KEYWORD[b]).filter(Boolean),
    ]),
  );

  const creditIdx =
    input.credit === "알 수 없음" ? -1 : CREDIT_OPTIONS.indexOf(input.credit) === 0
      ? 3
      : input.credit === "보통"
        ? 2
        : input.credit === "낮음"
          ? 1
          : 2;

  const tags: string[] = [industryCategory];
  const purposeTag: Record<string, string> = {
    운전자금: "운전자금",
    시설자금: "시설자금",
    창업자금: "창업초기",
    저신용자금: "저신용",
    긴급자금: "긴급자금",
  };
  if (purposeTag[input.purpose]) tags.push(purposeTag[input.purpose]);
  if (input.credit === "낮음") tags.push("저신용");
  if (has("청년대표")) tags.push("청년");
  if (has("수출")) tags.push("수출");
  if (has("고용증가")) tags.push("고용");
  if (has("제조업")) tags.push("제조");

  // ── 인콜 확장 파생 신호 ──
  const revenueEok =
    input.lastYearRevenue && input.lastYearRevenue !== "미확인"
      ? LAST_YEAR_REVENUE_EOK[input.lastYearRevenue]
      : LEGACY_REVENUE_EOK[input.revenue] ?? 3;

  const band = input.creditBand ?? "미확인";
  const veryLowCredit =
    band === "600점 미만" ||
    input.debtRelief === "회생" ||
    input.debtRelief === "파산";
  const lowCredit =
    veryLowCredit ||
    input.credit === "낮음" ||
    band === "600점대" ||
    input.recentDelinquency === "있음" ||
    input.debtRelief === "신용회복";
  const highCredit =
    !lowCredit &&
    (input.credit === "우수" || band === "900점 이상" || band === "800점대");

  const heavySecondFinance = input.secondFinance === "많음";
  const someSecondFinance = input.secondFinance === "일부 있음";
  const taxBlocked =
    input.taxArrears === "있음" || input.insuranceArrears === "있음";
  const debtHeavy =
    input.existingDebtLevel === "매출 대비 높음" ||
    input.existingDebtLevel === "매출 초과";
  const growth =
    input.revenueTrend3y === "증가" || input.thisYearTrend === "전년보다 증가";
  const smallFundOnly =
    input.fundingSize === "3천 이하" && input.purpose === "운전자금";
  const facilityIntent =
    input.purpose === "시설자금" ||
    (input.facilityUse !== undefined && input.facilityUse !== "해당없음");
  const hasCerts = bonusItems.some((b) =>
    ["벤처기업", "이노비즈", "메인비즈", "여성기업", "사회적기업"].includes(b),
  );
  const shortCareer =
    input.ceoCareer === "1년 미만" || input.ceoCareer === "1~3년";

  if (lowCredit) tags.push("저신용");
  if (heavySecondFinance || someSecondFinance) tags.push("2금융권");
  if (heavySecondFinance) tags.push("카드론");
  if (growth) tags.push("매출성장");
  if (debtHeavy) tags.push("기대출과다");
  if (input.workingCapitalUse === "고금리 대환") tags.push("고금리대환");
  if (input.ceoAge === "만 39세 이하" || bonusItems.includes("만39세 이하 청년기업"))
    tags.push("청년");

  return {
    input,
    industryCategory,
    companyName: input.companyName || "고객사",
    isCorp: input.businessType === "법인사업자",
    hasStrength: has,
    hasTech:
      has("기술력") ||
      has("특허") ||
      has("연구소") ||
      has("벤처") ||
      bonusItems.some((b) =>
        ["특허 보유", "기업부설연구소 보유", "벤처기업", "정부 R&D 성공", "연구개발비 비중 5% 이상"].includes(b),
      ),
    hasPatent: has("특허") || bonusItems.includes("특허 보유"),
    hasLab: has("연구소") || bonusItems.includes("기업부설연구소 보유"),
    hasVenture: has("벤처") || bonusItems.includes("벤처기업"),
    hasManufacturing:
      has("제조업") ||
      input.actualBusiness === "제조" ||
      industryCategory === "제조",
    isYouth:
      has("청년대표") ||
      input.ceoAge === "만 39세 이하" ||
      bonusItems.includes("만39세 이하 청년기업"),
    hasEmploymentGrowth:
      has("고용증가") ||
      input.hiringPlan === "있음" ||
      input.youthEmployment === "있음" ||
      input.youthEmployment === "예정",
    hasExport: has("수출") || bonusItems.includes("수출 실적"),
    strengthKeywords,
    yearsIdx: YEARS_OPTIONS.indexOf(input.years),
    revenueIdx: REVENUE_OPTIONS.indexOf(input.revenue),
    employeesIdx: EMPLOYEE_OPTIONS.indexOf(input.employees),
    creditIdx,
    tags: Array.from(new Set(tags)),
    revenueEok,
    lowCredit,
    veryLowCredit,
    highCredit,
    heavySecondFinance,
    someSecondFinance,
    taxBlocked,
    debtHeavy,
    growth,
    smallFundOnly,
    facilityIntent,
    hasCerts,
    bonusCount: bonusItems.length,
    shortCareer,
    hasMajorClients: input.majorClients === "있음",
  };
}

// ── 오케스트레이션 ──
export function runKnowledgeDiagnosis(input: DiagnosisInput): DiagnosisResult {
  // 1) 전처리 + industryCategory
  const profile = buildProfile(input);

  // 2) 기관 선택 (funding-agencies.json + agency-exclusion-rules.json)
  const { recommendations: agencies, deprioritized } = selectAgencies(
    profile,
    KB,
  );
  const topAgency = agencies[0]?.name ?? "신용보증기금";
  const second = agencies[1]?.name;

  // 3) 사례 매칭 (funding-cases.json, 유사도 TOP5)
  const cases = matchCases(profile, KB, topAgency);

  // 4) 리스크 (precheck + checkpoints)
  const risk = analyzeRisk(profile, KB);

  // 4-1) 기관별 사업계획 Framework + 업종 성장 포인트 (10차)
  const framework = getFramework(topAgency);
  const growth = getGrowthPoints(profile.industryCategory);

  // 5) reasoning (사람처럼 설명) — 기관 추천 + 기관 비교 + 사업계획 강조점까지 (작업10·11)
  const comparisonForReasoning = buildAgencyComparison(
    profile,
    agencies.map((a) => a.name),
  );
  const reasoning =
    generateReasoning(profile, agencies, cases, risk, KB) +
    (comparisonForReasoning.length > 0
      ? ` ${comparisonForReasoning[0]}`
      : "") +
    ` 사업계획서에서는 ${framework.emphasis}`;

  // 6) scripts + coachInsight (funding-scripts / contract-notices / 인콜 조건부 질문)
  const coach = generateScripts(profile, topAgency, KB);
  const coachInsight = buildCoachInsight(profile, risk, KB);
  const { documentMessage, followUpMessage } = generateMessages(
    profile,
    topAgency,
    KB,
  );

  // 7) upsell (upsell-rules + funding-upsells, TOP5)
  const upsells = recommendUpsells(profile, KB);

  // 8) roadmap — 기관별 로드맵 (funding-roadmaps.json)
  const roadmap = buildRoadmap(profile, topAgency, risk);

  // 8-1) 사업계획 AI: 질문·점수·초안 (10차)
  const planQuestions = generatePlanQuestions(profile);
  const planScore = scorePlan(profile);
  const planDraft = buildPlanDraft(profile, framework, growth);

  // 8-2) 심사 AI: 심사관 시뮬레이터 + 자료 부족 탐지
  const reviewSim = buildReviewSimulation(profile, topAgency);
  const documentChecks = checkDocuments(profile);

  // 8-2.5) 세부 자금 트랙 후보 (11차 — special-funding-tracks.json)
  const specialTracks = detectSpecialTracks(profile);

  // 8-2.6) 사업계획 전략 AI (12차)
  const planStrategy = getPlanStrategy(topAgency); // 작업1
  const planLogic = getPlanLogic(topAgency); // 작업2
  const storyPack = buildStoryVersions(profile.industryCategory); // 작업3
  const growthLogic = getGrowthLogic(profile.industryCategory); // 작업4
  const reviewFocus = getReviewFocus(topAgency); // 작업5
  const documentPriority = getDocumentPriority(profile); // 작업6
  const agencyComparison = buildAgencyComparison(
    profile,
    agencies.map((a) => a.name),
  ); // 작업10

  // 8-3) 김팀장 AI 한마디 (작업8) — 사업계획 완성도 + 우선 준비 자료 기반
  const weak2 = planScore.weakPoints
    .slice(0, 2)
    .map((w) => w.split(":")[0]);
  // 지금 당장 가장 중요한 자료 2개 (요청 필요 항목을 중요도 순으로)
  const missingDocs = documentPriority
    .filter((d) => documentChecks.some((c) => c.label === d.label && c.status === "요청 필요"))
    .slice(0, 2)
    .map((d) => d.label);
  const docLine =
    missingDocs.length > 0
      ? ` 현재 자료 기준으로는 ${missingDocs.join("과 ")}이(가) 가장 중요합니다.`
      : "";
  const coachMessage =
    planScore.total < 70
      ? `이 업체는 사업계획서의 완성도가 승인 여부를 크게 좌우할 가능성이 있습니다. 특히 ${
          weak2.length > 0 ? weak2.join("·") : "매출 증가 논리"
        } 부분을 강하게 보완하면 승인 가능성이 눈에 띄게 올라갑니다.${docLine} ${framework.emphasis}`
      : `사업계획 기본기는 갖춰져 있습니다(완성도 ${planScore.total}점). 이제 ${reviewFocus.focus
          .slice(0, 2)
          .map((f) => f.label.split(" ")[0])
          .join("·")} 중심으로 숫자를 다듬고, 증빙을 눈으로 보여줄 준비를 하면 됩니다.${docLine}`;

  // 9) 진행 추천도 (기관 점수 집계)
  const avg =
    agencies.reduce((sum, a) => sum + a.score, 0) / (agencies.length || 1);
  const overallScore = clamp(avg, 42, 96);

  // 10) confidence (신뢰도)
  const confidence = calculateConfidence(profile, agencies, cases);

  // 11) summary + nextAction
  const coreStrategy = profile.hasTech
    ? `기술 강점을 앞세워 ${topAgency} 중심으로 준비${second ? `, ${second} 병행` : ""}`
    : input.credit === "낮음"
      ? `저신용 대응 상품(${topAgency}) 소액부터 단계적으로 접근`
      : `${topAgency} 중심으로 서류부터 완비해 한도 극대화${second ? ` (백업: ${second})` : ""}`;

  const nextAction =
    input.credit === "낮음"
      ? `${topAgency} 기준 서류 요청 오늘 발송 → 저신용 대응 상품 병행 검토`
      : `${topAgency} 기준 서류 요청 오늘 발송 → 1순위 기관 상담 일정 예약`;

  return {
    companyName: profile.companyName,
    overallScore,
    topAgency,
    nextAction,
    summary: {
      score: overallScore,
      topAgency,
      coreStrategy,
      biggestRisk: risk.factors[0] ?? risk.explanation,
    },
    coachInsight,
    agencies,
    coach,
    documents: REQUIRED_DOCUMENTS,
    cases,
    upsells,
    documentMessage,
    followUpMessage,
    // 엔진 추가 산출물 (옵셔널)
    reasoning,
    risk,
    confidence,
    roadmap,
    industryCategory: profile.industryCategory,
    deprioritized,
    // 사업계획 AI / 심사 AI (10차)
    planQuestions,
    planScore,
    planDraft,
    reviewSim,
    documentChecks,
    growthKeywords: growth.keywords,
    coachMessage,
    likelihoodLevel: likelihoodOf(overallScore),
    specialTracks,
    // 사업계획 전략 AI (12차)
    planStrategy,
    planLogic,
    storyPack,
    growthLogic,
    reviewFocus,
    documentPriority,
    agencyComparison,
  };
}

export { KB };
