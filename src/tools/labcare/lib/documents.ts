// 설립서류 체크리스트 — 원본 lib/mockStage1.ts 의 표·규칙을 그대로 옮긴 것 (데모 목업 생성부만 뺐다).

import type { LabType } from "../types";

/* ───────────────── 설립 진행(설립서류 관리) ───────────────── */

export type SetupStage =
  | "가능성 체크 완료"
  | "서류 준비중"
  | "조직도/도면 필요"
  | "최종 검토"
  | "신고 준비 완료";

export type DocStatus = "준비중" | "고객 요청중" | "완료" | "해당 없음";

/** 서류 분류 (제출 성격) */
export type DocClass = "필수" | "작성보조" | "요청시" | "해당시";

/** 체크리스트 그룹 (실무 흐름: 필수 / 작성보조 / 요청·해당) */
export type DocGroup = "essential" | "prep" | "optional";

export const SETUP_GROUPS: { id: DocGroup; title: string; desc: string }[] = [
  { id: "essential", title: "필수 준비서류", desc: "설립신고에 공통으로 필요한 핵심 서류" },
  { id: "prep", title: "신고 입력자료 정리", desc: "신고관리시스템에서 직접 작성하지만, 미리 정리해두면 작성 시간이 줄어듭니다" },
  { id: "optional", title: "요청 시 / 해당 시 준비", desc: "기업규모·업종·인력 구성에 따라 요청되거나 해당될 때 준비" },
];

/** GPT 프롬프트 종류 (신고 입력자료 정리 항목용) */
export type PromptKey = "project" | "content" | "equip" | "personnel";

/** 설립서류 패키지 생성에 필요한 고객사 정보 (Client의 부분집합) */
export interface DocClient {
  id: string;
  name: string;
  labType: LabType;
  businessType?: "법인사업자" | "개인사업자";
  industry?: string;
  employeeCount?: number;
  researcherCount?: number;
  certifiedDate?: string;
}

export interface SetupDocMaster {
  key: string;
  label: string;
  group: DocGroup;
  cls: DocClass;
  tip: string;
  /** 잘 쓰이지 않아 기본 화면에서 접어두는 항목 */
  collapsed?: boolean;
  /** 신고 입력자료 정리 항목의 GPT 프롬프트 종류 */
  promptKey?: PromptKey;
  /** 점검 체크리스트(연구개발인력 현황 정리 등) */
  checklist?: string[];
  /** 해당 고객사에 해당되지 않으면 true → 기본 '해당 없음' */
  na?: (c: DocClient) => boolean;
}

export interface SetupDoc {
  key: string;
  label: string;
  group: DocGroup;
  cls: DocClass;
  tip: string;
  collapsed?: boolean;
  promptKey?: PromptKey;
  checklist?: string[];
  status: DocStatus;
}

export interface SetupPackage {
  id: string;
  /** 고객사 관리의 실제 고객사 id (연동 키) */
  clientId: string;
  clientName: string;
  labType: LabType;
  stage: SetupStage;
  docs: SetupDoc[];
  /** 고객사 등록 전 임시 저장 업체 여부 */
  temp?: boolean;
}

/**
 * 설립서류 마스터 — 실무 흐름 기준 3그룹 (docs/SETUP_DOCUMENTS_MANUAL_AUDIT.md).
 *  · 필수 준비서류 / 작성 보조 항목 / 요청·해당 시 준비
 *  · 온라인 지정서식(인정신청서 등)은 시스템에서 직접 작성하므로 '작성 보조'로 분리
 */
export const DOC_MASTER: SetupDocMaster[] = [
  // ── 그룹 1. 필수 준비서류 ──
  { key: "biz", label: "사업자등록증 사본", group: "essential", cls: "필수", tip: "행정정보 공동이용 동의 시 면제될 수 있습니다." },
  { key: "sme", label: "중소기업확인서 사본 및 유효기간 확인", group: "essential", cls: "필수", tip: "중소기업확인서 사본을 확보하고, 유효기간이 신청일 기준 유효한지 확인합니다. 일반적으로 4월 1일부터 다음 해 3월 31일까지 기간을 확인합니다." },
  { key: "org", label: "회사 조직도 및 연구조직 표시", group: "essential", cls: "필수", tip: "회사 전체 조직도 안에 연구소 또는 연구개발전담부서가 기업의 하부조직으로 표시되도록 정리합니다. (조직도 생성 메뉴 활용)" },
  { key: "floor", label: "층 전체도면 및 연구공간 내부도면", group: "essential", cls: "필수", tip: "층 전체 도면과 연구공간 내부 도면을 함께 준비합니다. (도면 생성 메뉴 활용)" },
  { key: "photoSign", label: "현판 보유 여부 및 현판사진", group: "essential", cls: "필수", tip: "전용출입구에 내구성 있는 현판이 부착되어 있는지 확인하고, 현판 글자가 읽히도록 촬영합니다." },
  { key: "photoInside", label: "내부사진 (전·후·좌·우)", group: "essential", cls: "필수", tip: "사방이 확인되도록 넓은 각도로 촬영. 2실 이상이면 각 실별로 촬영합니다." },
  { key: "insurance", label: "4대 사회보험 사업장 가입자 명부", group: "essential", cls: "필수", tip: "연구전담요원이 회사 소속임을 증명. 4대보험 미가입자는 전담요원 등록이 불가합니다." },
  { key: "degree", label: "연구전담요원 학위증명서 또는 졸업증명서", group: "essential", cls: "필수", tip: "자연계 학사 이상 등 자격요건 확인의 기본 서류입니다." },
  { key: "equipmentList", label: "연구기자재 목록 정리", group: "essential", cls: "필수", tip: "연구공간 안에 있고 연구활동에 직접 사용하는 기자재를 정리합니다." },
  { key: "personnelList", label: "연구개발인력 현황 정리", group: "essential", cls: "필수", tip: "연구소장·전담요원·보조원을 구분해 정리. 최소 인원 충족 여부를 확인하세요." },

  // ── 그룹 2. 신고 입력자료 정리 (온라인 지정서식 사전 정리) ──
  { key: "projectName", label: "연구과제명 정리", group: "prep", cls: "작성보조", promptKey: "project", tip: "실제 사업과 연결되는 과제명을 정리합니다. GPT 프롬프트로 후보를 도출할 수 있습니다." },
  { key: "mainContent", label: "주요 연구내용 정리", group: "prep", cls: "작성보조", promptKey: "content", tip: "무엇을·어떻게 개발하는지(월별 연구내용·테스트·결과물) 핵심 내용을 정리합니다." },
  { key: "equipInput", label: "연구기자재 현황 입력자료 정리", group: "prep", cls: "작성보조", promptKey: "equip", tip: "사무용 비품과 연구개발 직접 사용 기자재를 구분해 정리합니다. (별지 제3호)" },
  { key: "personnelInput", label: "연구개발인력 현황 입력자료 정리", group: "prep", cls: "작성보조", tip: "직원별 학력·전공·자격·경력·담당업무·겸직 여부로 전담요원 후보를 분류합니다. (별지 제4호)",
    checklist: ["전체 직원 명단 수령", "4대보험 가입자 명부 확인", "학력·전공 확인", "자격증 확인", "연구개발 경력 확인", "실제 담당 업무 확인", "연구전담 가능 후보 메모"] },

  // ── 그룹 3. 요청 시 / 해당 시 준비 (상단: 벤처확인서·기준검토표 / 그 외 접힘) ──
  { key: "venture", label: "벤처기업확인서", group: "optional", cls: "해당시", tip: "벤처기업은 전담요원 2명 기준. 확인서 유효기간 내여야 합니다." },
  { key: "smeReviewBiz", label: "중소기업 등 기준검토표 · 주업종 매출비중(51%) 확인", group: "optional", cls: "해당시", tip: "복수 업종 또는 서비스 분야 해당 시. 회계사·세무사 날인 검토표와 주업종 매출 50% 초과 증빙을 함께 준비합니다." },
  { key: "career", label: "연구개발 경력증명서", group: "optional", cls: "요청시", collapsed: true, tip: "전문학사·고졸 이하·자격증 기반 후보자의 완화기준(경력연수) 충족 증빙입니다." },
  { key: "appoint", label: "인사발령서 또는 업무분장표", group: "optional", cls: "요청시", collapsed: true, tip: "연구전담요원의 연구개발 전담 배치를 증빙. 현장조사에서 명함·업무내용과 일치해야 합니다." },
  { key: "namecard", label: "명함 또는 조직 내 직무표기 자료", group: "optional", cls: "요청시", collapsed: true, tip: "연구원의 직무가 연구업무로 표기되는지 확인하는 자료입니다." },
  { key: "cert", label: "연구전담요원 자격증 사본", group: "optional", cls: "해당시", collapsed: true, tip: "기사 등 국가기술자격으로 자격을 충족하는 경우 제출합니다." },
  { key: "safety", label: "연구실 안전 및 유지관리비 내역서", group: "optional", cls: "해당시", collapsed: true, tip: "연구전담요원+연구보조원 총 10인 이상인 경우 필요합니다.", na: (c) => (c.researcherCount ?? 0) < 10 },
  { key: "safetyInsurance", label: "보험가입보고서", group: "optional", cls: "해당시", collapsed: true, tip: "연구전담요원+연구보조원 총 10인 이상인 경우 필요합니다.", na: (c) => (c.researcherCount ?? 0) < 10 },
  { key: "midsize", label: "중견기업확인서", group: "optional", cls: "해당시", collapsed: true, tip: "중견기업일 때만 필요합니다. (전담요원 7명 기준)" },
  { key: "founder", label: "연구원·교원창업 관련 서류", group: "optional", cls: "해당시", collapsed: true, tip: "연구원·교원이 휴직·겸직·퇴직 후 3년 이내 창업한 경우 경력(퇴직)증명서·겸직허가서 등." },
  { key: "building", label: "건축물대장 / 임대차계약서 / 사용허가서", group: "optional", cls: "요청시", collapsed: true, tip: "무허가·가건물·주거전용 불인정. 확인 요청 시 적법 건물·점유권원 자료를 제출합니다." },
];

/** 서류 상태 선택지 (원본 setup-documents 화면의 STATUS_OPTS) */
export const DOC_STATUS_OPTS: DocStatus[] = ["준비중", "고객 요청중", "완료", "해당 없음"];

export function stageOf(progress: number): SetupStage {
  return progress >= 100 ? "신고 준비 완료"
    : progress >= 70 ? "최종 검토"
    : progress >= 40 ? "조직도/도면 필요"
    : progress >= 15 ? "서류 준비중"
    : "가능성 체크 완료";
}

/** 임시 저장 업체 패키지 — 모든 해당 서류를 '준비중'으로 시작 */
export function buildTempPackage(c: DocClient): SetupPackage {
  const docs: SetupDoc[] = DOC_MASTER.map((m) => ({
    key: m.key, label: m.label, group: m.group, cls: m.cls, tip: m.tip,
    collapsed: m.collapsed, promptKey: m.promptKey, checklist: m.checklist,
    status: m.na?.(c) ? "해당 없음" : "준비중",
  }));
  return { id: `temp-${c.id}`, clientId: c.id, clientName: c.name, labType: c.labType, stage: stageOf(docProgressOf(docs)), docs, temp: true };
}

/** 준비율: 완료 / (해당 없음 제외한 항목 수) */
export function docProgressOf(docs: SetupDoc[]): number {
  const applicable = docs.filter((d) => d.status !== "해당 없음");
  if (!applicable.length) return 100;
  const done = applicable.filter((d) => d.status === "완료").length;
  return Math.round((done / applicable.length) * 100);
}

export function docProgress(pkg: SetupPackage): number {
  return docProgressOf(pkg.docs);
}

/** 그룹별 준비율 (해당 없음 제외) */
export function groupProgress(pkg: SetupPackage, group: DocGroup): number {
  return docProgressOf(pkg.docs.filter((d) => d.group === group));
}

/** 누락·주의 = 필수·요청시·해당시 항목 중 고객 요청중 (고객 회신 대기 — 작성보조 제외) */
export function missingDocs(pkg: SetupPackage): SetupDoc[] {
  return pkg.docs.filter((d) => d.cls !== "작성보조" && d.status === "고객 요청중");
}
