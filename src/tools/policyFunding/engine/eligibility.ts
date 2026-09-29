// D-136 적격 판정 — "이 업체가 지금 접수할 수 있나"를 기관 순위와 따로 본다.
//
// 예전에는 첫 줄의 "진행 가능성"이 추천 기관 3곳 적합도의 평균이었다.
// 그런데 저신용·2금융 같은 나쁜 사실이 미소금융·지역신보 가점을 올려서
// 나쁜 사실이 늘수록 첫 줄이 좋아지는 일이 있었고, 체납은 아예 읽지 않았다.
//
// 지금은:
//   1) 기관 순위(어느 기관이 맞나)는 그대로 agencySelector 가 정한다.
//   2) 첫 줄 점수는 "나쁜 사실을 뺀 프로필"의 적합도에서 출발해(= 나쁜 사실이 가점이 되지 않게)
//      나쁜 사실마다 깎고(points), 막는 사실은 위 끝을 누른다(cap).
//   3) 깎기·누르기만 있으므로 나쁜 사실이 하나 더 켜져도 점수는 절대 오르지 않는다.
//
// 깎는 점수·위 끝은 기관 규정이 아니라 이 도구의 내부 기준이다(보수적으로 잡았다).
// 기관별 2026 세부 요건이 확실하지 않은 것은 숫자를 만들지 않고 "★ 확인"을 붙인다.

import type { Profile } from "./knowledgeEngine";
import type { DiagnosisInput, HeadlineAssessment } from "../types";
import { likelihoodOf } from "../types";
import exclusionJson from "../knowledge/agency-exclusion-rules.json";

/* ───────── 막는 사실 (agency-exclusion-rules.json hardBlockers) ───────── */

export interface HardBlocker {
  condition: string;
  effect: string;
  severity: string;
}
interface IndustryRule {
  label: string;
  keywords: string[];
  note?: string;
}
const EX = exclusionJson as unknown as {
  hardBlockers: HardBlocker[];
  industryExclusions: { note: string; hard: IndustryRule[]; partial: IndustryRule[] };
};

/** hardBlockers 조건 글 → 입력 칸. 모르는 조건이면 null (시험이 잡는다) */
export function blockerApplies(b: HardBlocker, i: Partial<DiagnosisInput>): boolean | null {
  if (/국세|지방세/.test(b.condition)) return i.taxArrears === "있음";
  if (/4대보험/.test(b.condition)) return i.insuranceArrears === "있음";
  return null;
}

export function hardBlockers(): HardBlocker[] {
  return EX.hardBlockers;
}

export function hardBlockersOf(i: Partial<DiagnosisInput>): HardBlocker[] {
  return EX.hardBlockers.filter((b) => blockerApplies(b, i) === true);
}

/* ───────── 제외 업종 (industryExclusions — 보수적 목록, ★확인) ───────── */

export interface IndustryScreen {
  kind: "hard" | "partial" | null;
  label: string | null;
  note: string | null;
}

export function screenIndustry(text: string | null | undefined): IndustryScreen {
  const s = String(text ?? "").replace(/\s+/g, "").toLowerCase();
  if (!s) return { kind: null, label: null, note: null };
  for (const r of EX.industryExclusions.hard) {
    if (r.keywords.some((k) => s.includes(k.toLowerCase())))
      return { kind: "hard", label: r.label, note: `정책자금 제외 업종 가능성(${r.label}) — ★확인` };
  }
  for (const r of EX.industryExclusions.partial) {
    if (r.keywords.some((k) => s.includes(k.toLowerCase())))
      return { kind: "partial", label: r.label, note: r.note ?? `${r.label} — 업종 코드 ★확인` };
  }
  return { kind: null, label: null, note: null };
}

/* ───────── 소상공인 (소진공 대상) ─────────
 * 소상공인 = 상시근로자 5인 미만. 제조·건설·운수·광업은 10인 미만.
 * 직원 칸은 4대보험 기준 구간이라, 상시근로자(대표·일용 제외 등)로 다시 세면 달라질 수 있다(★).
 */
export type SmallBizStatus = "yes" | "no" | "unsure";

const TEN_LIMIT_WORDS = /건설업|종합건설|전문건설|시공|토목|전기공사|설비공사|공사업|운수|운송|화물|택배|물류|광업|채굴|채석/;

/** 업종별 상시근로자 기준: 10(제조·건설·운수·광업) · 5(그 밖) · null(업종을 몰라 정할 수 없음) */
export function smallBizLimitOf(p: Profile): 5 | 10 | null {
  const text = String(p.input.industry ?? "").replace(/\s+/g, "");
  if (p.industryCategory === "제조" || p.hasManufacturing || TEN_LIMIT_WORDS.test(text)) return 10;
  if (p.industryCategory === "건설/기타") return null; // 건설인지 아닌지 글자로 확정 못 함
  return 5;
}

export function smallBizStatus(p: Profile): SmallBizStatus {
  const e = p.input.employees;
  if (e === "0명" || e === "1~4명") return "yes";
  const limit = smallBizLimitOf(p);
  if (e === "10명 이상") return "no";
  if (e === "5~9명") return limit === 10 ? "yes" : limit === 5 ? "no" : "unsure";
  return "unsure";
}

export function smallBizNote(p: Profile): string {
  const limit = smallBizLimitOf(p);
  const s = smallBizStatus(p);
  if (s === "no")
    return `직원 ${p.input.employees} — 소상공인 기준(${limit ?? 5}인 미만) 초과로 소진공 대상 아님 (상시근로자 기준 ★확인)`;
  if (s === "unsure")
    return `★ 소상공인 해당 여부 확인 필요 — 업종별 상시근로자 기준(5인·제조/건설/운수 10인 미만)`;
  return "";
}

/* ───────── 나쁜 사실을 뺀 프로필 (첫 줄 점수의 출발점) ───────── */

export function cleanProfile(p: Profile): Profile {
  const band = p.input.creditBand ?? "미확인";
  return {
    ...p,
    lowCredit: false,
    veryLowCredit: false,
    highCredit: p.input.credit === "우수" || band === "900점 이상" || band === "800점대",
    heavySecondFinance: false,
    someSecondFinance: false,
    taxBlocked: false,
    debtHeavy: false,
  };
}

/* ───────── 첫 줄 판정 ───────── */

interface Hit {
  reason: string;
  fix: string;
  points: number; // 깎는 점수
  cap: number; // 위 끝
}

const MAX_SCORE = 96;
const MIN_SCORE = 5;

export function assessHeadline(p: Profile, fitScore: number): HeadlineAssessment {
  const i = p.input;
  const hits: Hit[] = [];
  const checks: string[] = [];
  const add = (reason: string, fix: string, points: number, cap = MAX_SCORE) =>
    hits.push({ reason, fix, points, cap });

  // 1) 제외 업종
  const ind = screenIndustry(i.industry);
  if (ind.kind === "hard") {
    add(ind.note ?? "정책자금 제외 업종 가능성 — ★확인", "업종(업종 코드)이 정책자금 대상인지 확인", 40, 30);
    checks.push(`★ ${ind.label} — 기관별 제외 업종 공고로 확인`);
  } else if (ind.kind === "partial") {
    add(`${ind.note}`, "업종 코드 확인", 0, 69);
    checks.push(`★ ${ind.note}`);
  }

  // 2) 체납 (hardBlockers)
  const blockers = hardBlockersOf(i);
  for (const b of blockers)
    add(`${b.condition} — 체납 해소 전에는 대부분 기관 접수 불가`, "체납 해소(완납 후 완납증명 받기)", 40, 30);
  const arrearsUnknown =
    (i.taxArrears ?? "미확인") === "미확인" || (i.insuranceArrears ?? "미확인") === "미확인";
  if (blockers.length === 0 && arrearsUnknown) {
    add("체납 여부 미확인 — 확인 전에는 '높음'으로 보지 않음", "국세·지방세·4대보험 체납 여부 확인", 0, 69);
    checks.push("★ 국세·지방세·4대보험 체납 여부 확인");
  }

  // 3) 파산·회생·신용회복
  if (i.debtRelief === "파산") {
    add("파산 진행·이력 — 면책 여부 ★확인 전에는 접수 어려움", "파산 면책 여부 확인", 30, 35);
    checks.push("★ 파산 면책 결정 여부");
  } else if (i.debtRelief === "회생") {
    add("회생 진행·이력 — 인가·변제 상태 ★확인 전에는 접수 어려움", "회생 인가·변제 상태 확인", 25, 45);
    checks.push("★ 회생 인가·변제 상태");
  } else if (i.debtRelief === "신용회복") {
    add("신용회복 진행 중 — 저신용 대응 상품 위주로만 가능", "신용회복 변제 상태 확인", 15, 60);
  }

  // 4) 신용
  const band = i.creditBand ?? "미확인";
  if (band === "600점 미만")
    add("대표 신용 600점 미만 — 일반 기관은 거절 가능성이 큼", "대표 신용 관리(연체·고금리 정리)", 25, 45);
  else if (band === "600점대")
    add("대표 신용 600점대 — 한도 축소·거절 가능성", "대표 신용 관리(연체·고금리 정리)", 10);
  if (i.credit === "낮음")
    add("대표 신용 낮음 — 한도 축소·거절 가능성", "대표 신용 관리(연체·고금리 정리)", 12, 60);
  else if (i.credit === "알 수 없음" && band === "미확인") {
    add("대표 신용 미확인", "대표 신용 조회", 5);
    checks.push("★ 대표 신용점수 조회");
  }
  if (i.recentDelinquency === "있음")
    add("최근 연체 있음 — 연체 해소 전에는 심사 통과가 어려움", "연체 해소", 15, 55);

  // 5) 빚
  if (i.secondFinance === "많음")
    add("2금융·카드론 많음 — 상환 위기 신호로 감점", "카드론·2금융 줄이기", 10, 65);
  else if (i.secondFinance === "일부 있음")
    add("2금융 일부 사용", "2금융 사용 줄이기", 4);
  if (i.existingDebtLevel === "매출 초과")
    add("기존 대출이 매출보다 많음 — 추가 한도가 거의 없음", "기존 대출·보증 한도 확인(대환 검토)", 15, 55);
  else if (i.existingDebtLevel === "매출 대비 높음")
    add("기존 대출이 매출 대비 높음", "기존 대출 정리 계획", 8);

  // 6) 재무 (심층 진단)
  if (i.netProfit === "적자") add("최근 적자 — 상환 능력 설명 필요", "적자 이유·흑자 전환 계획 정리", 8);
  if (i.debtRatioStatus === "높음") add("부채비율 높음 — 재무 평가 감점", "재무제표(부채비율) 점검", 8);
  if (i.interestCoverage === "낮음") add("이자보상배수 낮음 — 이자 낼 힘이 약해 보임", "이자 부담·손익 개선 설명 준비", 8);

  const penalty = hits.reduce((s, h) => s + h.points, 0);
  const cap = hits.reduce((m, h) => Math.min(m, h.cap), MAX_SCORE);
  const score = Math.max(MIN_SCORE, Math.min(cap, MAX_SCORE, Math.round(fitScore - penalty)));

  // 심한 것 먼저: 위 끝이 낮은 것 → 깎는 점수가 큰 것 (같으면 적은 순서 그대로)
  const ordered = hits
    .map((h, idx) => ({ h, idx }))
    .sort((a, b) => a.h.cap - b.h.cap || b.h.points - a.h.points || a.idx - b.idx)
    .map((x) => x.h);

  const blocked: HeadlineAssessment["blocked"] =
    ind.kind === "hard" ? "제외 업종" : blockers.length > 0 ? "체납" : null;

  return {
    score,
    level: likelihoodOf(score),
    fitScore: Math.round(fitScore),
    blocked,
    reasons: ordered.map((h) => h.reason),
    checks: Array.from(new Set(checks)),
    firstFix: ordered[0]?.fix ?? null,
  };
}
