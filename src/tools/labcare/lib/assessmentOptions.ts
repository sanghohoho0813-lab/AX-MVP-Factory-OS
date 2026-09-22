// 설립 가능성 체크 화면의 선택지 — 원본 app/assessment/page.tsx 상단 표 그대로.

import type {
  ActivityNature,
  CertLevel,
  CompanySize,
  EducationLevel,
  IndustryField,
  LabTypeChoice,
  MajorField,
  NegativeActivity,
  ResearcherCandidate,
} from "../types";

export const EDU_OPTS: EducationLevel[] = [
  "박사",
  "석사",
  "학사",
  "전문학사(3년제)",
  "전문학사(2년제)",
  "마이스터고·특성화고 졸업",
  "고졸 이하",
];
export const MAJOR_OPTS: MajorField[] = ["자연계열", "공학계열", "의약계열", "기타 이공계", "비이공계"];
export const CERT_OPTS: CertLevel[] = ["기사 이상", "산업기사", "기능사", "없음"];
export const SIZE_OPTS: CompanySize[] = ["소기업", "중기업", "중견기업", "대기업"];
export const FIELD_OPTS: IndustryField[] = ["과학기술 분야", "서비스 분야", "산업디자인 분야"];
export const NATURE_OPTS: ActivityNature[] = [
  "새로운 제품·공정·서비스 개발",
  "기존 제품·서비스의 기술적 개선",
  "애매함",
  "해당 없음",
];
export const NEGATIVE_OPTS: NegativeActivity[] = [
  "단순 유지보수",
  "단순 기술지원",
  "일상적 품질관리",
  "시장조사·판촉활동",
  "일반 관리·경영개선",
  "단순 소프트웨어 개선",
  "보편화된 기술의 단순 활용",
  "수익 목적의 위탁연구 중심",
];

export const TYPE_OPTS: LabTypeChoice[] = ["기업부설연구소", "연구개발전담부서", "아직 모름"];

// 업종 대분류 → 분야 자동 추천 + 안내
export interface IndustryCategory {
  label: string;
  field: IndustryField;
  hint?: string;
}
export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { label: "제조업", field: "과학기술 분야" },
  { label: "전기전자/기계부품", field: "과학기술 분야" },
  { label: "소프트웨어/정보서비스", field: "과학기술 분야" },
  { label: "도소매업", field: "서비스 분야", hint: "도소매업도 서비스 분야 연구개발전담부서 가능성이 있습니다. 주문·재고 연동, 서비스 전달체계 개선, PB상품 포장디자인 개선 등으로 과제를 설계할 수 있습니다." },
  { label: "디자인/포장디자인", field: "산업디자인 분야", hint: "산업디자인 분야는 '제품디자인'과 '포장디자인'에 한해 인정 가능합니다. 단순 외관·브랜딩·홍보 디자인은 제외됩니다." },
  { label: "음식/프랜차이즈", field: "서비스 분야", hint: "서비스 분야 — 표준 레시피·주방 공정·서비스 전달체계 개선 등으로 과제를 설계할 수 있습니다." },
  { label: "건설/인테리어", field: "서비스 분야" },
  { label: "전문서비스업", field: "서비스 분야" },
  { label: "기타 서비스업", field: "서비스 분야" },
];
// 명백한 제외 업종 (선택 시 경고)
export const EXCLUDED_INDUSTRIES = ["유흥주점", "카지노/사행시설", "가상자산 매매중개", "기타 제외 업종"];

// 물적요건 비교 (연구소 / 전담부서)
export const FACILITY_LAB = [
  "독립된 연구공간",
  "고정벽체 또는 별도 출입문",
  "전용 출입구 현판",
  "연구기자재 확보",
  "연구전담요원 상시 근무 가능",
  "타 부서와 명확히 구분되는 공간",
];
export const FACILITY_DEPT = [
  "기업 내 하부조직으로 표시 가능",
  "연구전담요원 1명 이상",
  "연구개발 업무 전담 가능",
  "연구공간 또는 좌석 구분 가능",
  "연구기자재 확보",
  "도면·사진상 연구업무 공간 확인 가능",
  "타 업무 겸직 여부 확인",
];

let cidSeq = 0;
export function newCandidate(): ResearcherCandidate {
  cidSeq += 1;
  return {
    id: `cand-${Date.now()}-${cidSeq}`,
    name: "",
    isCeo: false,
    isRegisteredExec: false,
    fullTime: true,
    insured: true,
    researchDedicated: true,
    hasOtherDuties: false,
    daytimeGradSchool: false,
    education: "학사",
    major: "공학계열",
    cert: "없음",
    researchYears: 0,
    dutyDescription: "",
  };
}
