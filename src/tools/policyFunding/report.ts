import type {
  Customer,
  LikelihoodLevel,
  PlanDraft,
  SpecialTrackCandidate,
  PlanStrategy,
  PlanLogicStep,
  StoryPack,
  GrowthLogic,
  ReviewFocus,
  DocPriorityItem,
} from "./types";
import { likelihoodOf } from "./types";
import { progressStars } from "./coach";

// 고객(진단 결과 포함 또는 Mock)으로부터 상담 리포트 화면에 필요한 모델을 만든다.
// 진단 데이터(diagnosisResult)가 있으면 풍부하게, 없으면(Mock) 안전한 기본값으로 구성.

export interface ReportAgency {
  rank: number;
  name: string;
  score: number | null;
  reasons: string[];
  cautions: string[];
}

export interface ReportSupportProgram {
  title: string;
  desc: string;
  recommended: boolean;
}

// 인콜 체크 요약 (9차 — 진단 입력이 있는 고객만)
export interface ReportIncall {
  ceoCareer: string;
  revenueTier: string;
  creditRisk: string[];
  bonusItems: string[];
  deprioritized: { name: string; reason: string }[];
}

export interface ReportModel {
  companyName: string;
  industry: string;
  businessType: string;
  diagnosisDate: string;
  topAgency: string;
  score: number;
  // 대표님 한 페이지 요약
  stars: number;
  estimatedPeriod: string;
  riskKeyword: string;
  keyPrep: string;
  coreStrategy: string;
  biggestRisk: string;
  nextAction: string;
  agencies: ReportAgency[];
  documents: string[];
  roadmap: string[];
  supportPrograms: ReportSupportProgram[];
  extraUpsells: string[];
  disclaimer: string;
  incall: ReportIncall | null;
  planDraft: PlanDraft | null;
  // 11차: 3단계 가능성 + 세부 자금 트랙
  likelihood: LikelihoodLevel;
  specialTracks: SpecialTrackCandidate[];
  // 12차: 사업계획 전략 AI (진단 고객만 — 없으면 null)
  planStrategy: PlanStrategy | null;
  planLogic: PlanLogicStep[];
  storyPack: StoryPack | null;
  growthLogic: GrowthLogic | null;
  reviewFocus: ReviewFocus | null;
  documentPriority: DocPriorityItem[];
  agencyComparison: string[];
}

// 진단 입력(인콜 필드)에서 리포트용 요약 블록 생성
function buildIncall(customer: Customer): ReportIncall | null {
  const di = customer.diagnosisInput;
  if (!di) return null;

  const creditRisk: string[] = [];
  const band = di.creditBand && di.creditBand !== "미확인" ? di.creditBand : null;
  if (band) creditRisk.push(`신용 ${band}`);
  else creditRisk.push(`신용 ${di.credit}`);
  if (di.recentDelinquency === "있음") creditRisk.push("최근 연체 있음");
  if (di.debtRelief && di.debtRelief !== "없음" && di.debtRelief !== "미확인")
    creditRisk.push(`${di.debtRelief} 이력`);
  if (di.taxArrears === "있음") creditRisk.push("국세/지방세 체납 ⚠");
  if (di.insuranceArrears === "있음") creditRisk.push("4대보험 체납 ⚠");
  if (di.existingDebtLevel && di.existingDebtLevel !== "미확인")
    creditRisk.push(`기대출 ${di.existingDebtLevel}`);
  if (di.secondFinance === "많음") creditRisk.push("2금융권·카드론 많음");

  const revenueTier =
    di.lastYearRevenue && di.lastYearRevenue !== "미확인"
      ? `전년도 ${di.lastYearRevenue}`
      : `연매출 ${di.revenue}`;

  return {
    ceoCareer: di.ceoCareer && di.ceoCareer !== "미확인" ? di.ceoCareer : "미확인",
    revenueTier,
    creditRisk,
    bonusItems: (di.bonusItems ?? []).filter((b) => b !== "없음"),
    deprioritized: customer.diagnosisResult?.deprioritized ?? [],
  };
}

function estimatePeriod(agency: string): string {
  if (agency.includes("중소벤처") || agency.includes("기술보증")) return "4~8주";
  if (agency.includes("소상공인") || agency.includes("재단")) return "2~4주";
  return "3~5주";
}

function riskKeywordOf(risk: string): string {
  if (risk.includes("신용")) return "대표 신용";
  if (risk.includes("부채")) return "부채비율";
  if (risk.includes("체납") || risk.includes("세금")) return "세금 체납";
  if (risk.includes("업력") || risk.includes("실적")) return "짧은 업력·실적";
  return "사전 점검 필요";
}

const DEFAULT_DOCUMENTS = [
  "사업자등록증",
  "부가세과세표준증명",
  "재무제표 또는 손익자료",
  "4대보험 가입자명부",
  "국세/지방세 납세증명서",
  "신용정보 확인 관련 자료",
  "임대차계약서 또는 사업장 자료",
  "자금 사용 계획 자료",
];

export const REPORT_ROADMAP = [
  "기본자료 확인",
  "신용/부채/세금 상태 점검",
  "추천기관 최종 확정",
  "사업계획/자금사용계획 정리",
  "기관 접수",
  "심사/실사 대응",
  "승인 후 약정 및 실행",
];

const SUPPORT_CATALOG: { title: string; keys: string[]; desc: string }[] = [
  {
    title: "고용지원금",
    keys: ["고용"],
    desc: "직원 고용 시 청년내일채움·고용촉진장려금·두루누리 등 인건비 지원을 검토할 수 있습니다.",
  },
  {
    title: "기업부설연구소",
    keys: ["연구소"],
    desc: "R&D 인력이 있으면 부설연구소 인정으로 세액공제와 정책자금 가점을 확보할 수 있습니다.",
  },
  {
    title: "벤처기업 확인",
    keys: ["벤처"],
    desc: "기술 요건 충족 시 법인세·취득세 감면과 보증기관 우대를 받을 수 있습니다.",
  },
  {
    title: "세액공제",
    keys: ["세액공제"],
    desc: "통합고용·연구인력개발비·통합투자 세액공제를 점검해 볼 수 있습니다.",
  },
  {
    title: "법인 절세",
    keys: ["절세", "법인세", "법인전환"],
    desc: "가지급금 정리·대표 급여 설계 등으로 법인세를 절감할 수 있습니다.",
  },
];

export const REPORT_DISCLAIMER =
  "본 리포트는 입력된 정보를 바탕으로 한 사전 검토 자료이며, 정책자금 승인 여부를 보장하지 않습니다. 실제 가능 여부와 한도는 기관 심사, 예산, 신용, 부채, 세금 체납 여부, 사업계획, 접수 시점에 따라 달라질 수 있습니다.";

export function buildReportModel(customer: Customer): ReportModel {
  const result = customer.diagnosisResult;

  const agencies: ReportAgency[] = result
    ? result.agencies.map((a) => ({
        rank: a.rank,
        name: a.name,
        score: a.score,
        reasons: a.reasons,
        cautions: a.cautions,
      }))
    : [
        {
          rank: 1,
          name: customer.recommendedAgency,
          score: null,
          reasons: ["현재 정보 기준 1순위로 추천되는 기관입니다."],
          cautions: [
            "상세 적합도 점수와 기관별 비교는 진단을 실행하면 산출됩니다.", // [D-94] 규칙 계산 — "AI" 라 부르지 않는다
          ],
        },
      ];

  const coreStrategy =
    result?.summary.coreStrategy ??
    `${customer.recommendedAgency} 중심으로 서류부터 완비해 한도를 최대한 끌어올리는 전략을 권장합니다.`;

  const biggestRisk =
    result?.summary.biggestRisk ??
    "세금 체납·대표 신용·기존 부채 여부에 따라 한도가 달라질 수 있어 사전 점검이 필요합니다.";

  const documents = result?.documents ?? DEFAULT_DOCUMENTS;

  const upsells = customer.upsellOpportunities ?? [];
  const supportPrograms: ReportSupportProgram[] = SUPPORT_CATALOG.map((c) => ({
    title: c.title,
    desc: c.desc,
    recommended: upsells.some((u) => c.keys.some((k) => u.includes(k))),
  }));

  // 카탈로그 5종에 매칭되지 않은 추가 업셀 기회
  const matchedKeys = SUPPORT_CATALOG.flatMap((c) => c.keys);
  const extraUpsells = upsells.filter(
    (u) => !matchedKeys.some((k) => u.includes(k)),
  );

  const keyPrepDoc =
    documents.find((d) => d.includes("재무")) ?? documents[0] ?? "사업자등록증";

  return {
    companyName: customer.companyName,
    industry: customer.industry,
    businessType: customer.businessType,
    diagnosisDate: customer.lastContactedAt || customer.updatedAt,
    topAgency: customer.recommendedAgency,
    score: customer.score,
    stars: progressStars(customer.score),
    estimatedPeriod: estimatePeriod(customer.recommendedAgency),
    riskKeyword: riskKeywordOf(biggestRisk),
    keyPrep: keyPrepDoc,
    coreStrategy,
    biggestRisk,
    nextAction: customer.nextAction,
    agencies,
    documents,
    roadmap: REPORT_ROADMAP,
    supportPrograms,
    extraUpsells,
    disclaimer: REPORT_DISCLAIMER,
    incall: buildIncall(customer),
    planDraft: customer.diagnosisResult?.planDraft ?? null,
    likelihood:
      customer.likelihoodLevel ??
      customer.diagnosisResult?.likelihoodLevel ??
      likelihoodOf(customer.score),
    specialTracks:
      customer.specialFundingTracks ??
      customer.diagnosisResult?.specialTracks ??
      [],
    // 12차: 사업계획 전략 AI
    planStrategy: result?.planStrategy ?? null,
    planLogic: result?.planLogic ?? [],
    storyPack: result?.storyPack ?? null,
    growthLogic: result?.growthLogic ?? null,
    reviewFocus: result?.reviewFocus ?? null,
    documentPriority: result?.documentPriority ?? [],
    agencyComparison: result?.agencyComparison ?? [],
  };
}
