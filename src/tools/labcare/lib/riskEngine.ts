import type { CheckAnswers, RiskFactor, RiskLevel, RiskResult } from "../types";

/**
 * 사후관리 위험도 자동 진단 엔진.
 *
 * 단순 점수 합산이 아니라, "핵심 리스크가 있으면 등급을 강제로 끌어올리는"
 * 규칙 기반 진단을 사용한다. 설립은 끝났고, 이제부터는 '유지(사후관리)'가
 * 더 중요하다는 관점에서 가중치를 설계했다.
 *
 *  - 연구노트 미작성          : 세액공제·인정 유지의 핵심 증빙 공백 → 단독으로도 '위험'
 *  - 변경신고 검토 필요        : 연구원 변동/공간·회사정보 변경 → 기한이 걸린 사안 → '즉시 확인'
 *  - 세액공제 증빙 미흡        : 추후 세무 리스크로 이어질 수 있음 → 단독으로도 '위험'
 *
 * 점수(score)는 미리보기 막대·정렬용 참고치이며, 실제 등급(level)은 아래 규칙으로 결정된다.
 */

interface FactorDef {
  key: string;
  label: string;
  severity: RiskFactor["severity"];
  points: number;
  detail: string;
  action: string;
  /** 해당 응답이 위험요인에 해당하는지 판정 */
  triggered: (a: CheckAnswers) => boolean;
}

const FACTOR_DEFS: FactorDef[] = [
  {
    key: "researchNotes",
    label: "연구노트 미작성",
    severity: "high",
    points: 35,
    detail:
      "연구노트는 연구개발 활동을 입증하는 가장 기본적인 자료입니다. 작성이 비어 있으면 세액공제의 근거가 약해지고, 연구소 인정 유지에도 영향을 줄 수 있습니다.",
    action:
      "진행 중인 과제별로 연구노트(전자 또는 서면) 작성·서명 습관을 다시 잡으시길 권합니다.",
    triggered: (a) => !a.researchNotesWritten,
  },
  {
    key: "registrationChange",
    label: "상호·대표자·주소 변경 (변경신고 검토 필요)",
    severity: "high",
    points: 25,
    detail:
      "주소·대표자·상호 등 인정사항이 바뀌면 정해진 기한 안에 변경신고 검토가 필요합니다. 신고 시점을 놓치면 연구소 인정 유지에 부담이 될 수 있습니다.",
    action:
      "변경 내용과 변경일을 정리해, 기한 내 변경신고 대상인지 함께 확인하시길 권합니다.",
    triggered: (a) => a.registrationChange,
  },
  {
    key: "personnelChange",
    label: "연구전담요원 변동 (변경신고 검토 필요)",
    severity: "high",
    points: 22,
    detail:
      "연구전담요원의 입사·퇴사·부서이동은 인원 요건과 변경신고 검토가 필요한 사안입니다. 특히 퇴사·이동은 최소 인원 요건에 영향을 줄 수 있습니다.",
    action:
      "변동 인원의 자격·요건을 확인하고, 변경신고 대상인지와 충원 필요 여부를 함께 점검하시길 권합니다.",
    triggered: (a) => a.personnelChange,
  },
  {
    key: "spaceChange",
    label: "연구소 공간 변경 (변경신고 검토 필요)",
    severity: "high",
    points: 22,
    detail:
      "연구소 전용공간(면적·위치)이 바뀌면 변경신고 검토 대상이며, 독립공간 요건을 계속 충족하는지 확인이 필요합니다.",
    action:
      "변경된 공간의 도면·요건을 확인하고, 변경신고 대상인지 함께 검토하시길 권합니다.",
    triggered: (a) => a.spaceChange,
  },
  {
    key: "expenseEvidence",
    label: "연구개발비 증빙 미흡",
    severity: "medium",
    points: 20,
    detail:
      "인건비·재료비 등 연구개발비 증빙이 정리되어 있지 않으면, 추후 세무조사나 세액공제 사후검증에서 공제액을 인정받기 어려운 리스크로 이어질 수 있습니다.",
    action:
      "연구개발비 항목별 증빙(급여대장, 세금계산서 등)을 매월 정리해 두시길 권합니다.",
    triggered: (a) => !a.expenseEvidenceOrganized,
  },
  {
    key: "projectOngoing",
    label: "연구과제 진행 공백",
    severity: "medium",
    points: 18,
    detail:
      "진행 중인 연구과제가 없으면 연구개발 활동의 실체를 설명하기 어려워, 활동조사·실태점검에서 불리하게 작용할 수 있습니다.",
    action:
      "이번 달 연구개발 계획과 과제를 다시 정리하고, 활동 내역을 기록으로 남기시길 권합니다.",
    triggered: (a) => !a.projectOngoing,
  },
  {
    key: "surveyResponse",
    label: "연구개발활동조사 대응 필요",
    severity: "medium",
    points: 15,
    detail:
      "연구개발활동조사는 기한 안에 대응이 필요합니다. 대응이 늦어지면 연구소 인정에 불이익으로 이어질 수 있습니다.",
    action: "조사 항목을 미리 검토하고 기한 내 자료 제출을 준비하시길 권합니다.",
    triggered: (a) => a.surveyResponseNeeded,
  },
  {
    key: "taxDocs",
    label: "세무사 전달자료 미준비",
    severity: "low",
    points: 12,
    detail:
      "세무 신고에 쓰일 연구개발비 명세·증빙 자료가 준비되지 않으면, 세액공제 신고 일정과 공제 적용에 차질이 생길 수 있습니다.",
    action:
      "세무사에게 전달할 연구개발비 명세와 증빙을 미리 정리해 두시길 권합니다.",
    triggered: (a) => !a.taxDocsPrepared,
  },
];

/* ───────────────── 핵심 리스크 그룹 ───────────────── */

/** 등급 판정에 쓰이는 3대 핵심 리스크 여부 */
function headlineRisks(a: CheckAnswers) {
  return {
    /** 연구노트 미작성 */
    notes: !a.researchNotesWritten,
    /** 변경신고 검토 필요 (연구원 변동 / 공간 변경 / 회사정보 변경) */
    filing: a.personnelChange || a.spaceChange || a.registrationChange,
    /** 세액공제 증빙 미흡 (연구개발비 증빙 또는 세무 전달자료) */
    tax: !a.expenseEvidenceOrganized || !a.taxDocsPrepared,
  };
}

/* ───────────────── 등급 메타(고객용 영업 문구) ───────────────── */

export interface LevelMeta {
  label: RiskLevel;
  /** 등급 한 줄 요약 */
  headline: string;
  /** 고객(대표)에게 그대로 보여줄 수 있는 설명 */
  customerMessage: string;
  tone: "normal" | "warning" | "danger";
  /** 정렬·비교용 시급도 (클수록 시급) */
  rank: number;
}

export const LEVEL_META: Record<RiskLevel, LevelMeta> = {
  정상: {
    label: "정상",
    headline: "이번 달 사후관리가 안정적으로 유지되고 있습니다.",
    customerMessage:
      "현재 연구소 인정 요건과 세액공제 관련 자료가 잘 관리되고 있습니다. 연구소는 설립보다 '유지'가 더 중요합니다. 지금의 관리 수준을 이어가시면 됩니다.",
    tone: "normal",
    rank: 0,
  },
  주의: {
    label: "주의",
    headline: "지금 챙겨두면 좋은 보완 항목이 있습니다.",
    customerMessage:
      "당장 큰 문제는 아니지만, 미뤄두면 사후관리 부담으로 커질 수 있는 항목이 있습니다. 다음 점검 전까지 보완하면 정상 등급을 유지할 수 있습니다.",
    tone: "warning",
    rank: 1,
  },
  위험: {
    label: "위험",
    headline: "연구소 인정 유지·세액공제에 영향을 줄 수 있는 리스크가 있습니다.",
    customerMessage:
      "그대로 두면 세액공제 혜택이나 연구소 인정 유지에 영향을 줄 수 있는 항목이 확인되었습니다. 아래 항목을 우선순위에 따라 보완하시길 권합니다.",
    tone: "danger",
    rank: 2,
  },
  "즉시 확인": {
    label: "즉시 확인",
    headline: "기한이 걸린 사안 또는 핵심 증빙 공백이 있어 빠른 확인이 필요합니다.",
    customerMessage:
      "변경신고처럼 정해진 기한이 있는 사안이거나, 세액공제의 근거가 되는 핵심 자료가 동시에 비어 있는 상황입니다. 시점을 놓치면 되돌리기 어려울 수 있어, 담당 컨설턴트와 먼저 확인하시길 권합니다.",
    tone: "danger",
    rank: 3,
  },
};

/** 등급 시급도 (정렬용) */
export function levelRank(level: RiskLevel): number {
  return LEVEL_META[level].rank;
}

/** 등급별 표시용 색상 토큰 */
export function levelTone(level: RiskLevel): "normal" | "warning" | "danger" {
  return LEVEL_META[level].tone;
}

/* ───────────────── 등급 판정 (규칙 기반) ───────────────── */

/**
 * 점검 응답으로부터 사후관리 등급을 결정한다.
 *
 * - 즉시 확인 : 변경신고 검토가 필요한 변동(연구원/공간/회사정보)이 있거나,
 *               연구노트 미작성과 세액공제 증빙 미흡이 동시에 있는 경우
 * - 위험      : 핵심 리스크가 2개 이상이거나, 연구노트 미작성 또는 세액공제 증빙 미흡이 단독으로 있는 경우
 * - 주의      : 그 외 보완이 필요한 항목(연구과제 공백·활동조사 대응 등)이 있는 경우
 * - 정상      : 특이 리스크가 없는 경우
 */
export function computeLevel(a: CheckAnswers): RiskLevel {
  const { notes, filing, tax } = headlineRisks(a);
  const headlineCount = [notes, filing, tax].filter(Boolean).length;

  // 가장 시급: 기한이 걸린 변경신고 사안 또는 연구노트+증빙 동시 공백
  if (filing || (notes && tax)) return "즉시 확인";

  // 핵심 리스크 2개 이상, 또는 연구노트 미작성/세액공제 증빙 미흡 단독
  if (headlineCount >= 2 || notes || tax) return "위험";

  // 그 외 보완 필요 요인
  if (!a.projectOngoing || a.surveyResponseNeeded) return "주의";

  return "정상";
}

/**
 * 위험 사유를 고객이 한눈에 읽을 수 있는 한 줄 문구로 요약한다.
 * 예: "연구노트 미작성 + 세액공제 증빙 미흡", "변경신고 검토 필요"
 */
export function riskSummary(a: CheckAnswers): string {
  const parts: string[] = [];

  if (!a.researchNotesWritten) parts.push("연구노트 미작성");

  const changes: string[] = [];
  if (a.personnelChange) changes.push("연구전담요원 변동");
  if (a.spaceChange) changes.push("연구소 공간 변경");
  if (a.registrationChange) changes.push("상호·대표자·주소 변경");
  if (changes.length) parts.push(`변경신고 검토 필요(${changes.join("·")})`);

  if (!a.expenseEvidenceOrganized || !a.taxDocsPrepared) parts.push("세액공제 증빙 미흡");
  if (!a.projectOngoing) parts.push("연구과제 진행 공백");
  if (a.surveyResponseNeeded) parts.push("연구개발활동조사 대응 필요");

  if (parts.length === 0) return "특이사항 없음";
  const head = parts.slice(0, 2).join(" + ");
  return parts.length > 2 ? `${head} 외 ${parts.length - 2}건` : head;
}

/**
 * "즉시 확인" 등급일 때, 왜 즉시 확인이 필요한지에 대한 설명 문구.
 * (해당 등급이 아니면 빈 문자열)
 */
export function urgentReason(a: CheckAnswers): string {
  const { notes, filing, tax } = headlineRisks(a);
  if (filing) {
    const changes: string[] = [];
    if (a.personnelChange) changes.push("연구전담요원 변동");
    if (a.spaceChange) changes.push("연구소 공간 변경");
    if (a.registrationChange) changes.push("상호·대표자·주소 변경");
    return `${changes.join("·")} 사항이 확인되었습니다. 변경신고는 정해진 기한이 있어, 시점을 놓치면 연구소 인정 유지에 부담이 될 수 있습니다. 변경신고 대상 여부를 먼저 확인하시길 권합니다.`;
  }
  if (notes && tax) {
    return "연구노트 미작성과 세액공제 증빙 미흡이 함께 확인되었습니다. 세액공제의 근거가 되는 핵심 자료가 동시에 비어 있는 상황이라, 사후검증 시 공제 인정이 어려울 수 있어 우선 보완이 필요합니다.";
  }
  return "";
}

/** 점검 응답으로부터 위험도 평가 결과를 계산 */
export function evaluateRisk(answers: CheckAnswers): RiskResult {
  const factors: RiskFactor[] = FACTOR_DEFS.filter((d) => d.triggered(answers)).map(
    ({ triggered, ...rest }) => rest,
  );

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.min(100, rawScore);
  const level = computeLevel(answers);

  // 심각도 우선, 동일 심각도면 점수 높은 순으로 정렬
  const order = { high: 0, medium: 1, low: 2 };
  factors.sort((a, b) => order[a.severity] - order[b.severity] || b.points - a.points);

  return { score, level, factors };
}
