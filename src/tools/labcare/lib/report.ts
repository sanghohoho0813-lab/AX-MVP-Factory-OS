// 월간 리포트의 추가 혜택 빌더·컨설턴트 의견 — 원본 app/clients/[id]/report/page.tsx 그대로.

import type { MonthlyCheck, ResearchNote, ResearchProject } from "../types";

export interface NoteRow {
  project: ResearchProject;
  note: ResearchNote | undefined;
}

/** 추가 혜택 검토 후보 (절세/혜택 빌더 — 검토 가능성 톤 유지) */
export const BENEFIT_OPTIONS: { key: string; label: string; sentence: string }[] = [
  { key: "welfareFund", label: "사내근로복지기금", sentence: "사내근로복지기금은 임직원 복지 재원 마련과 법인 비용처리 구조를 함께 검토할 수 있는 영역입니다." },
  { key: "policyFund", label: "정책자금/정부지원사업", sentence: "정책자금 및 정부지원사업 신청 시 기업부설연구소 보유 여부가 기술성·혁신성 판단에 긍정적으로 활용될 수 있습니다." },
  { key: "employTax", label: "통합고용세액공제", sentence: "통합고용세액공제는 고용 증가 여부와 인건비 구조에 따라 추가 절세 가능성을 검토할 수 있습니다." },
  { key: "smeSpecial", label: "중소기업특별세액감면", sentence: "중소기업특별세액감면은 업종·규모·소재지 요건에 따라 적용 가능성을 별도로 확인할 필요가 있습니다." },
  { key: "startupTax", label: "창업중소기업 세액감면", sentence: "창업중소기업 세액감면은 창업 시기·업종·지역 요건 충족 시 세부담 절감 가능성을 검토할 수 있습니다." },
  { key: "rndAllowance", label: "연구활동비 비과세", sentence: "연구전담요원의 연구활동비 비과세(월 한도)는 급여 구조 설계와 함께 검토할 수 있습니다." },
  { key: "hireSupport", label: "고용지원금", sentence: "고용 관련 지원금은 채용 계획과 인원 변동에 따라 신청 가능성을 점검할 수 있습니다." },
  { key: "certify", label: "기업인증/벤처인증", sentence: "기업인증·벤처인증은 연구소 보유와 연계해 가점·우대 혜택으로 이어질 수 있어 단계적 취득을 검토할 수 있습니다." },
  { key: "patent", label: "특허/지식재산권", sentence: "특허·지식재산권은 연구과제 결과물과 연계해 기술보호와 인증·지원사업 가점 활용 가능성을 검토할 수 있습니다." },
  { key: "bylaws", label: "정관/임원보수/퇴직금 규정", sentence: "정관·임원보수·퇴직금 규정 정비는 법인 자금 흐름과 세무 리스크 관리 차원에서 점검할 수 있는 영역입니다." },
  { key: "finance", label: "가지급금/가수금/이익소각", sentence: "가지급금·가수금·이익소각 등 재무구조 점검은 법인 신용도와 세무 리스크 관리를 위해 검토할 수 있습니다." },
];

/** 고른 혜택 키 → 검토 문장 묶음 (BENEFIT_OPTIONS 순서 유지) */
export function composeBenefitText(keys: string[]): string {
  return BENEFIT_OPTIONS.filter((o) => keys.includes(o.key))
    .map((o) => o.sentence)
    .join("\n");
}

export function consultantOpinion(noteRows: NoteRow[], check: MonthlyCheck | undefined): string {
  const saved = noteRows.filter((r) => r.note?.status === "저장 완료").length;
  const total = noteRows.length;
  const a = check?.answers;
  const hasChange = !!a && (a.personnelChange || a.spaceChange || a.registrationChange);

  if (total > 0 && saved === total && !hasChange) {
    return "이번 달 연구활동과 연구노트가 빠짐없이 정리되었고, 별도의 변경사항도 확인되지 않았습니다. 연구소가 안정적으로 관리되고 있으니 현재 흐름을 그대로 이어가시면 됩니다.";
  }
  if (hasChange) {
    return "이번 달 연구활동을 확인했으며, 변경사항이 일부 확인되어 변경신고 대상 여부를 함께 검토하고 있습니다. 연구노트와 함께 변경 부분을 정리해 연구소 인정 유지에 빈틈이 없도록 관리하겠습니다.";
  }
  return "이번 달 연구활동을 확인하고 연구노트를 정리하고 있습니다. 미작성 과제는 담당 컨설턴트가 함께 보완하여, 매월 연구소 관리가 누락 없이 이어지도록 지원하겠습니다.";
}
