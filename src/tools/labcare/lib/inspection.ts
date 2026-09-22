// 현장조사(실사) 대비 체크 — 원본 lib/mockStage1.ts 의 표 그대로.

/** 현장조사 핵심 3대 포인트 (사람·공간·활동) */
export type InspectionPoint = "사람" | "공간" | "활동";

export interface InspectionItem {
  key: string;
  label: string;
  hint: string;
  point: InspectionPoint;
  /** 현장조사에서 특히 자주 문제되는 핵심 항목 강조 */
  emphasis?: boolean;
}

export const INSPECTION_POINTS: { id: InspectionPoint; icon: string; title: string; desc: string }[] = [
  { id: "사람", icon: "🧑‍🔬", title: "사람", desc: "전담요원 자격·소속·겸직 여부" },
  { id: "공간", icon: "🏛️", title: "공간", desc: "현판·도면·사진·실제 좌석 일치" },
  { id: "활동", icon: "🧪", title: "활동", desc: "연구과제·기자재·연구노트 연결" },
];

/** 편람 현장조사 보고서 체크포인트 — 사람/공간/활동 3대 포인트로 분류 */
export const INSPECTION_ITEMS: InspectionItem[] = [
  // 사람
  { key: "namecard", label: "명함·이메일 서명·조직도상 직무가 연구업무와 일치", hint: "현장조사 핵심 — 명함/서명/조직도 직무가 영업·관리가 아닌 연구업무로 표기돼야 합니다", point: "사람", emphasis: true },
  { key: "appoint", label: "인사발령서 또는 업무분장표 보유", hint: "연구전담 발령 문서로 전담성을 증빙합니다", point: "사람", emphasis: true },
  { key: "noConcurrent", label: "겸직 의심 업무 없음 (업무내용 일치)", hint: "생산·판매·관리 등 타 업무 겸직이 없고, 실제 업무내용이 연구로 일치해야 합니다", point: "사람", emphasis: true },
  { key: "insured", label: "4대보험 가입자 명부상 해당 기업 소속 확인", hint: "전담요원이 해당 기업 4대보험에 가입돼 있어야 합니다", point: "사람" },
  { key: "separable", label: "영업/관리/생산 업무와 연구업무 구분 가능", hint: "조직·업무가 일반업무와 명확히 구분돼야 합니다", point: "사람" },
  // 공간
  { key: "sign", label: "현판 부착 상태", hint: "내구성 재질(스테인리스·플라스틱·나무), 공간 입구 부착", point: "공간" },
  { key: "space", label: "독립 연구공간 유지", hint: "고정벽체+출입문 또는 50㎡ 이하 예외 유지", point: "공간" },
  { key: "seat", label: "실제 좌석·PC가 연구공간에 배치", hint: "전담요원 좌석·PC가 연구공간 안에 있어야 합니다", point: "공간" },
  { key: "photos", label: "현판·내부 사진 / 도면 최신본 (실제 배치와 일치)", hint: "현판·내부 사진과 도면이 현재 배치와 일치해야 합니다", point: "공간" },
  // 활동
  { key: "equipment", label: "연구기자재가 연구과제와 연결", hint: "기자재가 연구활동에 직접 사용되고 과제와 연결돼야 합니다", point: "활동" },
  { key: "notes", label: "연구노트 또는 연구활동 증빙 보유", hint: "연구수행일시·인력·구체적 내용이 확인돼야 합니다", point: "활동" },
  { key: "relevance", label: "연구과제-사업 관련성", hint: "과제가 실제 제품/서비스와 직접 연결돼야 합니다", point: "활동" },
];
