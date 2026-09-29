// 연구개발비 세액공제 "예상" 계산 — 사전 검토용 추정치 전용.
// 확정 표현 금지: 모든 결과는 "예상/검토용/요건 충족 시"로만 표시한다.
// 실제 적용 여부는 연구개발비 범위, 인건비, 구분경리, 세법 요건, 세무조정에 따라 달라진다.
//
// D-136: 공제율 표는 **중소기업 당기분** 예시다.
//  - 규모를 모르면 중소기업으로 가정하고 ★ 를 단다.
//  - 중견·대기업이라고 고르면 중소기업 공제율로 계산하지 않는다(공제율을 직접 넣어야 계산).
//  - 음수 · 숫자 아닌 값은 0 으로, 공제율 직접 입력은 0~100 으로 자른다(자르면 알린다).
//  - 공제액은 그해 낼 세금을 넘을 수 없다 · 전년 연구개발비가 있으면 증가분 방식 비교를 알린다.

import type { Client } from "../types";

export interface TaxCreditEstimate {
  /** 계산 가능 여부 (입력값이 없거나, 규모 때문에 공제율을 모르면 false) */
  available: boolean;
  taxType: "법인세" | "종합소득세";
  category: NonNullable<Client["taxCreditCategory"]>;
  /** 적용 공제율 (%) */
  rate: number;
  /** 당해연도 연구개발비 합계 (원) */
  totalRnd: number;
  /** 인건비/재료비/기타 내역 (원) */
  payroll: number;
  material: number;
  other: number;
  /** 연간/월/일 예상 절세액 (원) */
  annual: number;
  monthly: number;
  daily: number;
  /** 적용 가정 목록 */
  assumptions: string[];
  /** 입력을 고친 것 · 계산을 멈춘 이유 (화면에 눈에 띄게) */
  warnings: string[];
  /** 규모를 몰라 중소기업으로 가정했는가 */
  sizeAssumed: boolean;
}

/** 공제유형별 기본 공제율 (중소기업 당기분 예시) */
export const CATEGORY_RATES: Record<NonNullable<Client["taxCreditCategory"]>, number> = {
  "일반 R&D": 25,
  "신성장·원천기술": 30,
  국가전략기술: 40,
  미정: 25,
};

/** 금액 입력 정리 — 숫자가 아니거나 음수면 0 (0 으로 고쳤으면 fixed=true) */
function cleanWon(v: number | undefined): { won: number; fixed: boolean } {
  if (v === undefined || v === null) return { won: 0, fixed: false };
  const n = Number(v);
  if (!Number.isFinite(n)) return { won: 0, fixed: true };
  if (n < 0) return { won: 0, fixed: true };
  return { won: n, fixed: false };
}

/** 고객사 입력값 기반 예상 절세액 계산 (검토용) */
export function getTaxCreditEstimate(c: Client): TaxCreditEstimate {
  const warnings: string[] = [];
  const pay = cleanWon(c.researchersPayrollTotal);
  const mat = cleanWon(c.rndMaterialCost);
  const oth = cleanWon(c.rndOtherCost);
  const cur = cleanWon(c.currentYearRndCost);
  const prior = cleanWon(c.priorYearRndCost);
  if (pay.fixed || mat.fixed || oth.fixed || cur.fixed || prior.fixed)
    warnings.push("음수이거나 숫자가 아닌 금액은 0 으로 보고 계산했습니다.");
  const payroll = pay.won;
  const material = mat.won;
  const other = oth.won;
  const totalRnd = cur.won > 0 ? cur.won : payroll + material + other;

  const category = c.taxCreditCategory ?? "미정";
  const size = c.taxCompanySize;
  const sizeAssumed = size === undefined;
  const nonSme = size === "중견기업" || size === "대기업";

  // 공제율 직접 입력: 0 · 빈 값 · 숫자 아님 → 기본값, 100 초과 → 100
  let override: number | null = null;
  const rawRate = c.estimatedTaxCreditRate;
  if (rawRate !== undefined && rawRate !== null) {
    const n = Number(rawRate);
    if (!Number.isFinite(n) || n < 0) warnings.push("공제율 직접 입력이 올바르지 않아 쓰지 않았습니다.");
    else if (n > 100) {
      override = 100;
      warnings.push("공제율은 100% 를 넘을 수 없어 100% 로 잘랐습니다 — 입력을 확인하세요.");
    } else if (n > 0) override = n;
  }

  // 중견·대기업은 중소기업 공제율로 계산하지 않는다 — 직접 넣은 공제율이 있을 때만
  const rateKnown = override !== null || !nonSme;
  const rate = override ?? (nonSme ? 0 : CATEGORY_RATES[category]);
  if (!rateKnown)
    warnings.push(`${size}은 중소기업보다 공제율이 낮습니다 — 공제율을 직접 넣어야 계산합니다 (★ 확인).`);

  const taxType = c.businessTaxType ?? (c.businessType === "개인사업자" ? "종합소득세" : "법인세");
  const annual = rateKnown ? Math.round((totalRnd * rate) / 100) : 0;

  const assumptions: string[] = [
    override !== null
      ? `직접 넣은 공제율 ${rate}% 적용 (당해연도 연구개발비 × ${rate}%)`
      : `중소기업 당기분 방식 기준 (당해연도 연구개발비 × ${rate}%)`,
    "연구개발비 전액이 세액공제 대상 요건을 충족한다고 가정",
  ];
  if (sizeAssumed)
    assumptions.push("★ 중소기업 기준 — 중견·대기업은 공제율이 낮습니다 (규모 확인 필요)");
  if (category === "신성장·원천기술")
    assumptions.push("신성장·원천기술은 별표 해당 여부·구분경리 요건 검토 필요 (30% 이상 가능성)");
  else if (category === "국가전략기술")
    assumptions.push("국가전략기술은 별표 해당 여부·구분경리 요건 검토 필요 (40% 이상 가능성)");
  else if (category === "미정")
    assumptions.push("공제유형 미정 — 일반 R&D 25%를 예시로 적용, 유형 확인 필요");
  if (prior.won > 0)
    assumptions.push(
      `★ 전년도 연구개발비(${prior.won.toLocaleString("ko-KR")}원)가 있어 증가분 방식과 비교가 필요합니다 — 이 계산은 당기분 방식만 봤습니다`,
    );
  else assumptions.push("증가분 방식(전년 대비 증가액 기준)도 있어 유리한 방식 비교 검토 가능");
  assumptions.push("공제액은 그해 낼 세금(산출세액)보다 클 수 없고, 최저한세·이월공제에 따라 줄거나 넘어갈 수 있습니다 (★ 세무 대리인 확인)");
  for (const w of warnings) assumptions.push(`⚠ ${w}`);

  return {
    available: totalRnd > 0 && rateKnown,
    taxType,
    category,
    rate,
    totalRnd,
    payroll,
    material,
    other,
    annual,
    monthly: Math.round(annual / 12),
    daily: Math.round(annual / 365),
    assumptions,
    warnings,
    sizeAssumed,
  };
}

/** 원 단위 금액을 "12,500,000원" 형태로 */
export function formatKRW(v: number): string {
  return `${v.toLocaleString("ko-KR")}원`;
}

/** 원 단위 금액을 "1,250만원" 형태로 (만원 미만 절사) */
export function formatManwon(v: number): string {
  return `${Math.round(v / 10000).toLocaleString("ko-KR")}만원`;
}
