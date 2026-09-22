import type {
  ActivityVerdict,
  CandidateAssessment,
  CandidateVerdict,
  CeoEligibility,
  EligibilityVerdict,
  FacilityVerdict,
  FeasibilityInput,
  FeasibilityResult,
  FeasibilityVerdict,
  RecommendedPath,
  ResearcherCandidate,
  SectionAssessment,
} from "../types";

/**
 * 설립 빠른판정 엔진 — 상담 중 3~5분 안에 1차 판단을 내리는 도구.
 *
 * 근거: docs/RND_LAB_RULES_2026.md
 *  - 2026 기업부설연구소 및 연구개발전담부서 신고에 관한 업무편람 (KOITA)
 *  - 기업부설연구소등의 연구개발 지원에 관한 법률·시행령·시행규칙 (2026-02-01 시행)
 *
 * 원칙:
 *  - 점수 산출 없음. 실무 판정형 결론만 낸다.
 *  - 법률 확정 판단처럼 단정하지 않는다. ("현재 입력 기준", "추가 확인 필요")
 *  - 대표자·겸직 등 경계 사례는 보수적으로 판정한다.
 */

/* ───────────────── 연구전담요원 수 기준 (시행령 제6조 제1항) ───────────────── */

/**
 * 기업부설연구소 기준 연구전담요원 최소 인원.
 *  - 벤처기업 / 연구원·교원 창업기업: 2명
 *  - 소기업: 3명 (창업일 이후 3년까지 2명)
 *  - 중기업: 5명 (소기업→중기업 전환 후 1년까지 3명)
 *  - 중견기업: 7명 / 대기업: 10명 / 해외소재 연구소: 5명
 */
export function requiredForLab(
  input: Pick<
    FeasibilityInput,
    | "companySize"
    | "isVenture"
    | "isResearcherFounded"
    | "businessMonths"
    | "becameMediumWithinYear"
    | "isOverseasLab"
  >,
): number {
  if (input.isOverseasLab) return 5;
  if (input.isVenture || input.isResearcherFounded) return 2;
  switch (input.companySize) {
    case "소기업":
      return input.businessMonths <= 36 ? 2 : 3;
    case "중기업":
      return input.becameMediumWithinYear ? 3 : 5;
    case "중견기업":
      return 7;
    case "대기업":
      return 10;
  }
}

/* ───────────────── 후보자별 자격 판정 ───────────────── */

const VERDICT_BY_RANK: CandidateVerdict[] = ["인정 가능", "추가 확인 필요", "인정 어려움"];

/** 학력·전공·자격·경력 기반 1차 자격 게이트 (rank 0/1/2 + 사유) */
function qualificationGate(
  c: ResearcherCandidate,
  input: Pick<FeasibilityInput, "companySize" | "industryField">,
): { rank: number; note: string } {
  const isSME = input.companySize === "소기업" || input.companySize === "중기업";
  const natural = c.major !== "비이공계";
  const bachelorPlus = c.education === "박사" || c.education === "석사" || c.education === "학사";
  const designOrService =
    input.industryField === "산업디자인 분야" || input.industryField === "서비스 분야";

  // 기업규모 공통 기준
  if (natural && bachelorPlus) {
    return { rank: 0, note: "자연계 분야 학사 이상 — 자격 기준에 해당합니다" };
  }
  if (c.cert === "기사 이상") {
    return { rank: 0, note: "기사 이상 국가기술자격 보유 — 자격 기준에 해당합니다" };
  }

  // 중소기업 완화 기준 (소기업·중기업)
  if (isSME) {
    if (natural && c.education === "전문학사(3년제)") {
      if (c.researchYears >= 1)
        return { rank: 0, note: "자연계 3년제 전문학사 + 경력 1년 이상 — 중소기업 완화 기준에 해당합니다" };
      return { rank: 1, note: "자연계 3년제 전문학사 — 연구개발 경력 1년 이상 확인 필요" };
    }
    if (natural && c.education === "전문학사(2년제)") {
      if (c.researchYears >= 2)
        return { rank: 0, note: "자연계 전문학사 + 경력 2년 이상 — 중소기업 완화 기준에 해당합니다" };
      return { rank: 1, note: "자연계 전문학사 — 연구개발 경력 2년 이상 확인 필요" };
    }
    if (c.cert === "산업기사") {
      if (c.researchYears >= 2)
        return { rank: 0, note: "산업기사 + 경력 2년 이상 — 중소기업 완화 기준에 해당합니다" };
      return { rank: 1, note: "산업기사 — 연구개발 경력 2년 이상 확인 필요" };
    }
    if (c.education === "마이스터고·특성화고 졸업" || c.cert === "기능사") {
      if (c.researchYears >= 4)
        return {
          rank: 0,
          note: "마이스터고·특성화고 졸업 또는 기능사 + 경력 4년 이상 — 중소기업 완화 기준에 해당합니다",
        };
      return {
        rank: 1,
        note: "마이스터고·특성화고/기능사 — 연구개발 경력 4년 이상 확인 필요",
      };
    }
  }

  // 산업디자인·서비스 분야: 비자연계 학위 인정 가능성 (별도 확인)
  if (!natural && bachelorPlus && designOrService) {
    return {
      rank: 1,
      note: `${input.industryField} 주업종 — 비자연계 학사도 인정 가능성이 있으나 주업종·담당업무 연관성 확인 필요`,
    };
  }

  return { rank: 2, note: "현재 입력 기준 학력·자격·경력 요건이 확인되지 않습니다" };
}

/** 후보자 1명 종합 판정 */
export function assessCandidate(
  c: ResearcherCandidate,
  input: Pick<FeasibilityInput, "companySize" | "industryField" | "businessMonths">,
): CandidateAssessment {
  const notes: string[] = [];
  const gate = qualificationGate(c, input);
  let rank = gate.rank;
  notes.push(gate.note);
  const bump = (r: number) => {
    rank = Math.max(rank, r);
  };

  // 상근 — 연구전담요원은 상시 근무가 필수
  if (!c.fullTime) {
    bump(2);
    notes.push("비상근 — 연구전담요원은 상시 근무가 필요합니다 (상근 전환 전 인정 어려움)");
  }

  // 4대보험 — 미가입자는 등록 불가 (시행규칙 제2조 제8항)
  if (!c.insured) {
    bump(1);
    notes.push("4대보험 가입(예정) 확인 필요 — 미가입 상태로는 등록이 어렵습니다");
  }

  // 전담성·겸직 — 연구전담요원은 다른 업무를 겸직할 수 없음
  if (c.isCeo) {
    // 대표자는 별도 카드에서 판정. 후보 목록에서는 보수적으로 처리.
    const earlySmall = input.companySize === "소기업" && input.businessMonths <= 36;
    if (earlySmall && rank === 0) {
      bump(1);
      notes.push("대표자 — 창업 3년 이내 소기업 예외 가능성 있음 (대표자 카드 참고, 전담성 확인 필요)");
    } else {
      bump(2);
      notes.push("대표자 — 창업 3년 이내 소기업 외에는 연구전담요원 인정이 어렵습니다");
    }
  } else {
    if (!c.researchDedicated) {
      bump(2);
      notes.push("연구업무 전담이 아님 — 연구전담요원은 연구개발 업무만 전담해야 합니다");
    }
    if (c.hasOtherDuties) {
      bump(2);
      notes.push("생산·판매·관리 등 다른 업무 겸직 — 겸직 해소 전 인정이 어렵습니다");
    }
    if (c.isRegisteredExec) {
      bump(1);
      notes.push("등기임원 — 업무영역·전담성에 따라 인정이 제한될 수 있어 확인 필요");
    }
  }

  // 주간 일반대학원 재학 (신법: 국가R&D 참여 석사과정 등 예외)
  if (c.daytimeGradSchool) {
    bump(1);
    notes.push(
      "주간 일반대학원 재학 — 원칙적으로 등록 불가하나, 국가연구개발사업 참여 석사과정 등 예외 해당 여부 확인 필요",
    );
  }

  // 담당 연구업무 미입력
  if (!c.dutyDescription.trim()) {
    bump(1);
    notes.push("실제 담당할 연구업무 내용 입력 필요");
  }

  return { candidate: c, verdict: VERDICT_BY_RANK[rank], notes };
}

/* ───────────────── 대표자 포함 가능성 (보수적) ───────────────── */

const CEO_THREE_YEAR_NOTE =
  "창업 3년 경과 시 대표자는 연구전담요원에서 제외되므로, 사전에 변경신고 또는 연구전담요원 교체(충원)를 검토해야 합니다.";

export function assessCeo(
  input: Pick<FeasibilityInput, "companySize" | "industryField" | "businessMonths" | "candidates">,
): CeoEligibility {
  const ceoCand = input.candidates.find((c) => c.isCeo);
  if (!ceoCand) {
    return {
      applicable: false,
      verdict: "해당 없음",
      basis: "대표자를 연구전담요원 후보로 입력하지 않았습니다.",
      cautions: ["대표자 겸직을 검토하려면 후보자에 대표자를 추가해 주세요."],
      threeYearNote: "",
    };
  }

  const earlySmall = input.companySize === "소기업" && input.businessMonths <= 36;
  const gate = qualificationGate(ceoCand, input);
  const cautions: string[] = [];

  // 원칙: 연구전담요원은 타업무 겸직 불가 → 대표자는 원칙적으로 불가.
  // 유일한 예외: 창업 3년 이내 소기업의 대표자 (자격요건 충족 + 실제 연구업무 수행)
  if (!earlySmall) {
    const reason =
      input.companySize === "소기업"
        ? "창업일로부터 3년이 경과한 소기업"
        : `${input.companySize}${input.businessMonths <= 36 ? " (창업 3년 이내라도 소기업이 아님)" : ""}`;
    return {
      applicable: true,
      verdict: "인정 어려움",
      basis: `현재 입력 기준 ${reason}으로, 대표자의 연구전담요원 겸직 예외(창업 3년 이내 소기업)에 해당하지 않습니다.`,
      cautions: [
        "대표자는 기업경영 업무를 수행하므로 원칙적으로 연구전담요원이 될 수 없습니다.",
        "벤처기업 여부와 관계없이, 예외는 '창업 3년 이내 소기업'에만 적용됩니다.",
      ],
      threeYearNote: CEO_THREE_YEAR_NOTE,
    };
  }

  // 창업 3년 이내 소기업 — 자격요건과 전담성에 따라 판정
  if (gate.rank >= 2) {
    return {
      applicable: true,
      verdict: "인정 어려움",
      basis:
        "창업 3년 이내 소기업이지만, 현재 입력 기준 대표자의 학력·자격·경력 요건이 확인되지 않습니다.",
      cautions: [gate.note],
      threeYearNote: CEO_THREE_YEAR_NOTE,
    };
  }

  cautions.push(
    "대표자가 실제로 연구개발 업무를 수행하는지(전담성)에 대한 소명이 필요합니다.",
  );
  if (!ceoCand.insured) cautions.push("대표자의 4대보험 가입 확인이 필요합니다.");
  if (!ceoCand.dutyDescription.trim())
    cautions.push("대표자가 담당할 연구업무 내용을 구체적으로 정리해 두세요.");

  if (gate.rank === 1) {
    return {
      applicable: true,
      verdict: "추가 확인 필요",
      basis:
        "창업 3년 이내 소기업 대표자로 예외 가능성은 있으나, 자격 요건(학력·경력 등)에 추가 확인이 필요합니다.",
      cautions: [gate.note, ...cautions],
      threeYearNote: CEO_THREE_YEAR_NOTE,
    };
  }

  return {
    applicable: true,
    verdict: "가능성 있음",
    basis:
      "창업 3년 이내 소기업의 대표자로서 자격 요건을 충족하는 것으로 보입니다. 연구업무 수행을 전제로 연구전담요원 포함 가능성이 있습니다 (현재 입력 기준).",
    cautions,
    threeYearNote: CEO_THREE_YEAR_NOTE,
  };
}

/* ───────────────── 신고대상 기업 여부 ───────────────── */

export function assessEligibility(
  input: Pick<
    FeasibilityInput,
    "isForProfit" | "hasBusinessOps" | "rndOnlyCompany" | "isSubUnit" | "isExcludedIndustry"
  >,
): SectionAssessment<EligibilityVerdict> {
  const notes: string[] = [];
  let verdict: EligibilityVerdict = "신고대상으로 보임";
  const setWorst = (v: EligibilityVerdict) => {
    const order: EligibilityVerdict[] = ["신고대상으로 보임", "추가 확인 필요", "신고대상 부적합 가능성"];
    if (order.indexOf(v) > order.indexOf(verdict)) verdict = v;
  };

  if (input.isExcludedIndustry) {
    setWorst("신고대상 부적합 가능성");
    notes.push("제외 업종에 해당 — 신고대상이 아닐 가능성이 높습니다. 업종 분류 재확인이 필요합니다.");
  }
  if (!input.isForProfit) {
    setWorst("추가 확인 필요");
    notes.push("영리기업 여부 확인 필요 — 신고대상은 영리활동을 하는 기업이 원칙입니다.");
  }
  if (input.rndOnlyCompany) {
    setWorst("신고대상 부적합 가능성");
    notes.push(
      "연구개발활동만 수행하는 회사 — 생산·판매·관리 등 기업경영 조직이 없으면 신고대상이 되지 않습니다.",
    );
  } else if (!input.hasBusinessOps) {
    setWorst("추가 확인 필요");
    notes.push(
      "기업경영 활동 인력(생산·판매·관리) 확인 필요 — 연구원 외 대표이사만 있는 회사는 인정이 어렵습니다. 외주 생산 기업도 상시종업원 1인 이상이 필요합니다.",
    );
  }
  if (!input.isSubUnit) {
    setWorst("추가 확인 필요");
    notes.push("연구소/전담부서는 기업 조직도상 하부조직이어야 합니다 — 조직 구조 확인 필요.");
  }

  if (notes.length === 0) notes.push("현재 입력 기준 신고대상 요건에 특이사항이 없습니다.");
  return { verdict, notes };
}

/* ───────────────── 연구개발활동 적합성 ───────────────── */

export function assessActivity(
  input: Pick<FeasibilityInput, "preCommercial" | "activityNature" | "negativeActivities">,
): SectionAssessment<ActivityVerdict> {
  const notes: string[] = [];
  const negatives = input.negativeActivities;
  const hasContractRnd = negatives.includes("수익 목적의 위탁연구 중심");

  let verdict: ActivityVerdict;

  if (input.activityNature === "해당 없음") {
    verdict = "부적합 가능성";
    notes.push("새로운 개발·기술적 개선에 해당하는 활동이 확인되지 않습니다.");
  } else if (hasContractRnd) {
    verdict = "부적합 가능성";
    notes.push(
      "수익창출 목적의 위탁연구가 주된 활동이면 연구개발활동으로 인정받기 어렵습니다. (공동연구·국책과제 수행을 위한 일부 위탁은 인정 가능)",
    );
  } else if (input.activityNature === "애매함") {
    verdict = "보완 필요";
    notes.push("연구개발 과제의 신규성·목표를 구체화하면 인정 가능성을 높일 수 있습니다.");
  } else if (negatives.length >= 3) {
    verdict = "부적합 가능성";
    notes.push(
      `제외활동 성격(${negatives.slice(0, 3).join(", ")} 등)이 다수 확인됩니다 — 과제 재설계 검토가 필요합니다.`,
    );
  } else if (negatives.length >= 1) {
    verdict = "보완 필요";
    notes.push(
      `일부 활동(${negatives.join(", ")})은 연구개발 범위에서 제외됩니다 — 신고용 과제에서는 분리·보완이 필요합니다.`,
    );
  } else {
    verdict = "연구개발활동 적합";
    notes.push(
      input.activityNature === "새로운 제품·공정·서비스 개발"
        ? "사업화 이전 단계의 새로운 개발 활동으로 인정 가능성이 있습니다 (현재 입력 기준)."
        : "기존 제품·서비스의 기술적 개선 활동으로 인정 가능성이 있습니다 (현재 입력 기준).",
    );
  }

  if (!input.preCommercial && verdict === "연구개발활동 적합") {
    verdict = "보완 필요";
    notes.push("사업화 이전 단계인지 확인 필요 — 이미 양산·판매 중인 기술의 단순 운영은 제외됩니다.");
  }

  return { verdict, notes };
}

/* ───────────────── 물적요건 ───────────────── */

export function assessFacility(
  input: Pick<
    FeasibilityInput,
    | "hasSpace"
    | "independentSpace"
    | "fixedWallsAndDoor"
    | "movableWallPossible"
    | "spaceUnder50"
    | "adequateArea"
    | "equipmentInSpace"
    | "isInfoServiceOrSW"
    | "companySize"
    | "isVenture"
    | "isResearcherFounded"
    | "desiredType"
  >,
): SectionAssessment<FacilityVerdict> {
  const notes: string[] = [];

  if (!input.hasSpace) {
    return {
      verdict: "진행 어려움",
      notes: [
        "연구공간이 아직 없습니다 — 공간 확보 후 진행해야 합니다.",
        "독립공간(고정벽체+별도 출입문)이 원칙이며, 중소·벤처기업 등은 50㎡ 이하 칸막이 구분 예외가 있습니다.",
      ],
    };
  }

  // 50㎡ 이하 분리구역 예외 대상인지
  const isSME = input.companySize === "소기업" || input.companySize === "중기업";
  const partitionException =
    (isSME || input.isVenture || input.isResearcherFounded) ||
    (input.isInfoServiceOrSW && input.desiredType === "연구개발전담부서");

  let verdict: FacilityVerdict = "물적요건 충족";
  const setWorst = (v: FacilityVerdict) => {
    const order: FacilityVerdict[] = ["물적요건 충족", "추가 확인 필요", "보완 필요", "진행 어려움"];
    if (order.indexOf(v) > order.indexOf(verdict)) verdict = v;
  };

  if (input.independentSpace && input.fixedWallsAndDoor) {
    notes.push("독립공간(고정벽체+별도 출입문) — 물적요건 원칙에 부합합니다.");
  } else if (input.independentSpace && input.movableWallPossible) {
    setWorst("추가 확인 필요");
    notes.push(
      "분리·이동 가능한 벽체(2m 이상)로 구분 — 신법상 인정 가능성이 있으나 전용공간 식별·관계법령 적합 여부 확인 필요.",
    );
  } else if (input.spaceUnder50 && partitionException) {
    setWorst("추가 확인 필요");
    notes.push(
      "50㎡ 이하 + 파티션 구분(분리구역) — 중소·벤처·연구원창업 기업(또는 정보서비스/SW 전담부서) 예외 적용 가능성이 있습니다. 면적·구분 상태 확인 필요.",
    );
  } else if (!input.independentSpace || !input.fixedWallsAndDoor) {
    setWorst("보완 필요");
    notes.push(
      "고정벽체와 별도 출입문이 확인되지 않습니다 — 독립공간 구성(또는 50㎡ 이하 예외 해당 여부) 보완이 필요합니다.",
    );
  }

  if (!input.adequateArea) {
    setWorst("보완 필요");
    notes.push("연구전담요원이 상시 근무하기에 면적이 부족해 보입니다 — 좌석·기자재 배치 기준으로 재검토 필요.");
  }
  if (!input.equipmentInSpace) {
    setWorst("보완 필요");
    notes.push("연구기자재는 연구공간 안에 위치해야 합니다 — 기자재 배치 정리가 필요합니다.");
  }

  return { verdict, notes };
}

/* ───────────────── 종합 판정 ───────────────── */

const SUMMARY: Record<FeasibilityVerdict, string> = {
  "기업부설연구소 가능":
    "현재 입력 기준, 기업부설연구소 설립 요건을 충족하는 것으로 보입니다. 설립 전 증빙자료 확인이 필요합니다.",
  "연구개발전담부서 우선 추천":
    "현재 입력 기준, 연구개발전담부서부터 진행하는 것이 현실적입니다. 인력 보강 후 연구소 전환을 검토할 수 있습니다.",
  "보완 후 가능":
    "방향은 적합합니다. 보완 항목을 정리한 뒤 진행하는 것을 권장합니다 (보완 후 진행 권장).",
  "현재 진행 비추천":
    "현재 입력 기준으로는 인정이 어려워 보입니다. 선결 과제를 해결한 뒤 재검토를 권장합니다.",
  "추가 확인 필요":
    "현재 입력만으로는 판단이 어렵습니다. 표시된 확인 항목을 점검한 뒤 다시 판정해 주세요.",
};

export function assessFeasibility(input: FeasibilityInput): FeasibilityResult {
  const candidates = input.candidates.map((c) => assessCandidate(c, input));
  const eligibleCount = candidates.filter((c) => c.verdict === "인정 가능").length;
  const reviewCount = candidates.filter((c) => c.verdict === "추가 확인 필요").length;

  const ceo = assessCeo(input);
  const eligibility = assessEligibility(input);
  const activity = assessActivity(input);
  const facility = assessFacility(input);
  const reqLab = requiredForLab(input);

  /* 종합 판정 */
  const blocked =
    eligibility.verdict === "신고대상 부적합 가능성" || activity.verdict === "부적합 가능성";
  const needsFix =
    facility.verdict === "보완 필요" ||
    facility.verdict === "진행 어려움" ||
    activity.verdict === "보완 필요";
  const needsCheck =
    eligibility.verdict === "추가 확인 필요" || facility.verdict === "추가 확인 필요";

  const labOk = eligibleCount >= reqLab;
  const deptOk = eligibleCount >= 1;
  const wantsDeptOnly = input.desiredType === "연구개발전담부서";

  let verdict: FeasibilityVerdict;
  let recommendedType: RecommendedPath;

  if (blocked) {
    verdict = "현재 진행 비추천";
    recommendedType = "추가 검토";
  } else if (eligibleCount === 0 && reviewCount === 0) {
    verdict = "현재 진행 비추천";
    recommendedType = "추가 검토";
  } else if (eligibleCount === 0) {
    verdict = "추가 확인 필요";
    recommendedType = "추가 검토";
  } else if (wantsDeptOnly) {
    // 전담부서 희망
    if (needsFix) {
      verdict = "보완 후 가능";
      recommendedType = "연구개발전담부서";
    } else if (needsCheck) {
      verdict = "추가 확인 필요";
      recommendedType = "연구개발전담부서";
    } else {
      verdict = "연구개발전담부서 우선 추천";
      recommendedType = "연구개발전담부서";
    }
  } else if (labOk) {
    // 연구소 인원 충족
    if (needsFix) {
      verdict = "보완 후 가능";
      recommendedType = "기업부설연구소";
    } else if (needsCheck) {
      verdict = "추가 확인 필요";
      recommendedType = "기업부설연구소";
    } else {
      verdict = "기업부설연구소 가능";
      recommendedType = "기업부설연구소";
    }
  } else if (deptOk) {
    // 연구소 인원 미달, 전담부서는 가능 → 선설립 후 전환 경로
    if (needsFix) {
      verdict = "보완 후 가능";
      recommendedType = "전담부서 선설립 후 연구소 전환";
    } else {
      verdict = "연구개발전담부서 우선 추천";
      recommendedType = "전담부서 선설립 후 연구소 전환";
    }
  } else {
    verdict = "추가 확인 필요";
    recommendedType = "추가 검토";
  }

  const requiredResearchers =
    recommendedType === "기업부설연구소" ? reqLab : recommendedType === "추가 검토" ? (wantsDeptOnly ? 1 : reqLab) : 1;
  const shortage = Math.max(0, requiredResearchers - eligibleCount);

  /* 보완해야 할 항목 */
  const improvements: string[] = [];
  if (eligibility.verdict !== "신고대상으로 보임")
    improvements.push(...eligibility.notes.filter((n) => !n.includes("특이사항이 없습니다")));
  if (activity.verdict !== "연구개발활동 적합")
    improvements.push(...activity.notes);
  if (facility.verdict !== "물적요건 충족")
    improvements.push(...facility.notes.filter((n) => !n.includes("부합합니다")));
  if (shortage > 0)
    improvements.push(`자격을 갖춘 연구전담요원 ${shortage}명 추가 확보가 필요합니다.`);
  if (reviewCount > 0)
    improvements.push(
      `'추가 확인 필요' 후보 ${reviewCount}명의 자격(경력·전담성·4대보험 등) 증빙을 확인하세요.`,
    );
  if (input.candidates.some((c) => !c.fullTime))
    improvements.push("비상근 후보의 상근 전환이 필요합니다.");
  if (ceo.applicable && ceo.verdict !== "인정 어려움" && ceo.verdict !== "해당 없음")
    improvements.push("대표자의 연구업무 전담성 소명 자료(업무분장 등)를 준비하세요.");

  /* 추천 진행 전략 */
  const strategy: string[] = [];
  switch (verdict) {
    case "기업부설연구소 가능":
      strategy.push("현재 입력 기준 기업부설연구소 설립 추진이 가능해 보입니다.");
      strategy.push(
        "연구원 자격 증빙(학위·경력·4대보험), 독립 연구공간 자료(도면·사진·현판), 연구개발활동 개요서를 준비하세요.",
      );
      break;
    case "연구개발전담부서 우선 추천":
      if (wantsDeptOnly) {
        strategy.push("연구개발전담부서(전담요원 1명 이상) 설립 진행이 가능해 보입니다.");
      } else {
        strategy.push(
          `기업부설연구소 인원 기준(${reqLab}명) 대비 인정 가능 인원이 ${eligibleCount}명입니다 — 전담부서부터 진행하는 것이 현실적입니다.`,
        );
        strategy.push(
          "연구개발전담부서로 먼저 설립한 뒤, 인력을 확충해 기업부설연구소로 전환하는 경로를 권장합니다.",
        );
      }
      break;
    case "보완 후 가능":
      strategy.push("방향은 적합합니다. 위 보완 항목을 해결한 뒤 진행을 권장합니다.");
      if (recommendedType === "전담부서 선설립 후 연구소 전환")
        strategy.push("보완과 함께 전담부서 선설립 → 연구소 전환 경로를 검토하세요.");
      break;
    case "현재 진행 비추천":
      strategy.push("현재 입력 기준으로는 설립 진행을 권장하지 않습니다.");
      strategy.push(
        blocked
          ? "신고대상 요건 또는 연구개발활동 적합성의 선결 과제를 먼저 해결한 뒤 재검토하세요."
          : "자격을 갖춘 연구전담요원 확보가 우선입니다.",
      );
      break;
    case "추가 확인 필요":
      strategy.push("표시된 확인 항목(후보 자격·물적요건 등)을 점검한 뒤 다시 판정해 주세요.");
      strategy.push("설립 전 증빙자료(학위·경력증명·도면 등) 확인이 필요합니다.");
      break;
  }

  return {
    verdict,
    recommendedType,
    requiredResearchers,
    requiredForLab: reqLab,
    eligibleCount,
    reviewCount,
    shortage,
    ceo,
    candidates,
    eligibility,
    activity,
    facility,
    improvements,
    strategy,
    summary: SUMMARY[verdict],
  };
}
