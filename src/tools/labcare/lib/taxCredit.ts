// 연구개발비 세액공제 "예상" 계산 — 사전 검토용 추정치 전용.
// 확정 표현 금지: 모든 결과는 "예상/검토용/요건 충족 시"로만 표시한다.
// 실제 적용 여부는 연구개발비 범위, 인건비, 구분경리, 세법 요건, 세무조정에 따라 달라진다.

import type { Client } from "../types";

export interface TaxCreditEstimate {
  /** 계산 가능 여부 (입력값 없으면 false) */
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
}

/** 공제유형별 기본 공제율 (중소기업 당기분 예시) */
export const CATEGORY_RATES: Record<NonNullable<Client["taxCreditCategory"]>, number> = {
  "일반 R&D": 25,
  "신성장·원천기술": 30,
  국가전략기술: 40,
  미정: 25,
};

/** 고객사 입력값 기반 예상 절세액 계산 (검토용) */
export function getTaxCreditEstimate(c: Client): TaxCreditEstimate {
  const payroll = c.researchersPayrollTotal ?? 0;
  const material = c.rndMaterialCost ?? 0;
  const other = c.rndOtherCost ?? 0;
  const totalRnd = c.currentYearRndCost && c.currentYearRndCost > 0
    ? c.currentYearRndCost
    : payroll + material + other;

  const category = c.taxCreditCategory ?? "미정";
  const rate = c.estimatedTaxCreditRate && c.estimatedTaxCreditRate > 0
    ? c.estimatedTaxCreditRate
    : CATEGORY_RATES[category];
  const taxType = c.businessTaxType ?? (c.businessType === "개인사업자" ? "종합소득세" : "법인세");

  const annual = Math.round((totalRnd * rate) / 100);

  const assumptions: string[] = [
    `중소기업 당기분 방식 기준 (당해연도 연구개발비 × ${rate}%)`,
    "연구개발비 전액이 세액공제 대상 요건을 충족한다고 가정",
  ];
  if (category === "신성장·원천기술")
    assumptions.push("신성장·원천기술은 별표 해당 여부·구분경리 요건 검토 필요 (30% 이상 가능성)");
  else if (category === "국가전략기술")
    assumptions.push("국가전략기술은 별표 해당 여부·구분경리 요건 검토 필요 (40% 이상 가능성)");
  else if (category === "미정")
    assumptions.push("공제유형 미정 — 일반 R&D 25%를 예시로 적용, 유형 확인 필요");
  assumptions.push("증가분 방식(전년 대비 증가액 기준)도 있어 유리한 방식 비교 검토 가능");

  return {
    available: totalRnd > 0,
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
