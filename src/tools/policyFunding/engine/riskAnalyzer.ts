// 리스크 분석 — precheck-rules / checkpoints 기반으로 5단계 리스크와 사유 산출.
// 매우 낮음 / 낮음 / 보통 / 높음 / 매우 높음
//
// D-136: 예전에는 '신용' 칸 하나만 봤다. 이제 신용점수 구간·파산/회생·최근 연체·체납·
// 2금융·기대출·적자·부채비율·이자보상배수까지 본다.
// "체납 여부를 확인하세요" 같은 안내는 위험이 아니라서 factors 가 아니라 reminders 에 둔다.

import type { KnowledgeBase, Profile } from "./knowledgeEngine";
import type { RiskAssessment, RiskLevel } from "../types";
import { hardBlockersOf, screenIndustry } from "./eligibility";

export function analyzeRisk(
  profile: Profile,
  kb: KnowledgeBase,
): RiskAssessment {
  let score = 25; // 기본 리스크
  let floor = 0; // 이 아래로는 내려가지 않는다 (막는 사실)
  const found: { text: string; weight: number }[] = [];
  const reminders: string[] = [];
  const i = profile.input;
  const add = (text: string, weight: number) => {
    score += weight;
    found.push({ text, weight });
  };

  // 막는 사실: 제외 업종 · 체납
  const ind = screenIndustry(i.industry);
  if (ind.kind === "hard") {
    add(`${ind.note} — 해당하면 기관 접수 불가`, 45);
    floor = Math.max(floor, 70);
  } else if (ind.kind === "partial") {
    add(`${ind.note}`, 10);
  }
  const blockers = hardBlockersOf(i);
  if (blockers.length > 0) {
    add(
      `${blockers.map((b) => b.condition.replace(/\s*있음$/, "")).join("·")} — 체납 해소 전에는 대부분 기관 접수 불가`,
      45,
    );
    floor = Math.max(floor, 70);
  }

  // 파산·회생·신용회복
  if (i.debtRelief === "파산" || i.debtRelief === "회생") {
    add(`${i.debtRelief} 진행·이력 — 면책·인가 여부 ★확인 전에는 접수가 어렵습니다.`, 32);
    floor = Math.max(floor, 55);
  } else if (i.debtRelief === "신용회복") {
    add("신용회복 진행 중 — 저신용 대응 상품 위주로만 접근 가능합니다.", 18);
  }

  // 신용 (칸 두 개를 함께 본다)
  const band = i.creditBand ?? "미확인";
  if (band === "600점 미만") {
    add("대표 신용 600점 미만 — 일반 기관은 거절 가능성이 큽니다.", 30);
    floor = Math.max(floor, 55);
  } else if (band === "600점대" || i.credit === "낮음") {
    add("대표 신용이 낮아 한도 축소·거절 가능성이 있습니다.", 22);
  } else if (i.credit === "알 수 없음" && band === "미확인") {
    add("대표 신용 미확인 — 조회 전까지 접근 상품이 갈립니다.", 10);
  } else if (profile.highCredit) {
    score -= 8;
  }
  if (i.recentDelinquency === "있음")
    add("최근 연체 있음 — 연체 해소 전에는 심사 통과가 어렵습니다.", 15);

  // 빚
  if (i.secondFinance === "많음") add("2금융·카드론이 많아 상환 위기 신호로 감점됩니다.", 12);
  else if (i.secondFinance === "일부 있음") add("2금융 사용 이력이 있어 설명이 필요합니다.", 5);
  if (i.existingDebtLevel === "매출 초과") add("기존 대출이 매출보다 많아 추가 한도가 거의 없습니다.", 15);
  else if (i.existingDebtLevel === "매출 대비 높음") add("기존 대출이 매출 대비 높아 한도가 줄 수 있습니다.", 8);

  // 재무 (심층 진단)
  if (i.netProfit === "적자") add("최근 적자 — 상환 능력을 숫자로 설명해야 합니다.", 8);
  if (i.debtRatioStatus === "높음") add("부채비율이 높아 재무 평가에서 감점됩니다.", 8);
  if (i.interestCoverage === "낮음") add("이자보상배수가 낮아 이자 낼 힘이 약해 보입니다.", 8);

  // 업력
  if (i.years === "1년 미만") {
    add("업력 1년 미만으로 매출 실적이 부족할 수 있습니다.", 14);
  } else if (i.years === "7년 이상") {
    score -= 4;
  }

  // 자금목적
  if (i.purpose === "저신용자금" || i.purpose === "긴급자금") {
    add(`${i.purpose} 성격상 시기·상품 제약이 있을 수 있습니다.`, 6);
  }

  // 업종 담보/기술 근거
  if (
    profile.industryCategory === "음식/외식" ||
    profile.industryCategory === "도소매"
  ) {
    add(`${profile.industryCategory} 업종은 담보·기술 근거가 약해 한도가 제한적일 수 있습니다.`, 6);
  }

  // 강점 부재
  if (!profile.hasTech && !profile.hasManufacturing && !profile.hasExport) {
    add("뚜렷한 가점 요소가 적어 재무·성실납세로 승부해야 합니다.", 6);
  } else {
    score -= 4;
  }

  // 규모/소상공인 기준
  if (i.employees === "10명 이상" && profile.industryCategory !== "제조") {
    score += 4;
  }

  // 안내(위험 아님): 체납을 아직 모르면 확인부터
  const arrearsUnknown =
    (i.taxArrears ?? "미확인") === "미확인" || (i.insuranceArrears ?? "미확인") === "미확인";
  const blocker = kb.preRestrictions.find((r) => r.severity === "blocker");
  if (blockers.length === 0 && arrearsUnknown && blocker) {
    reminders.push(`${blocker.label} 여부를 먼저 확인하세요(미정리 시 접수 자체가 막힙니다).`);
  }
  reminders.push("정책자금은 예산·접수 시기의 영향을 받습니다.");

  score = Math.max(floor, Math.max(0, Math.min(100, Math.round(score))));

  const level: RiskLevel =
    score < 20
      ? "매우 낮음"
      : score < 35
        ? "낮음"
        : score < 52
          ? "보통"
          : score < 70
            ? "높음"
            : "매우 높음";

  // 심한 것 먼저 (같으면 찾은 순서)
  const factors = found
    .map((f, idx) => ({ ...f, idx }))
    .sort((a, b) => b.weight - a.weight || a.idx - b.idx)
    .map((f) => f.text);

  const explanation =
    `현재 정보 기준 리스크는 '${level}'입니다. ` +
    (factors[0] ?? "현재 입력으로는 큰 위험 요소가 보이지 않습니다.") +
    " 접수 전 납세·4대보험·기대출·재무제표를 함께 점검하면 리스크를 낮출 수 있습니다.";

  return { level, score, factors: factors.slice(0, 5), explanation, reminders };
}
