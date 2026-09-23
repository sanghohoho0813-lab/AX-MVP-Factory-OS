// 고용지원금 점검 Tip 계산 — 고용지원금 SaaS 연계 진입점.
// "받을 수 있음" 같은 단정 표현 금지: 점검/확인/검토 표현만 사용한다.

interface TipInput {
  employeeCount?: number;
  researcherCount: number;
  coreIssue?: string;
  hiringTip?: string;
}

/**
 * 지원금 TIP — 문구 통일.
 * "연구인력 채용과 고용지원금 대상 여부를 함께 확인한다"는 의미로 모든 고객사에 동일 표기한다.
 * (고객사에 별도 지정된 hiringTip이 있으면 그 값을 우선)
 */
export function getHiringSupportTip(c: TipInput): string {
  return c.hiringTip ?? "연구인력 고용지원금 대상 여부 확인";
}
