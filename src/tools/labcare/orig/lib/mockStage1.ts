// 1단계 메뉴/대시보드 확장용 목업 데이터.
// localStorage 구조를 건드리지 않고, 기존 storage 데이터 + 고정 목업으로 화면을 채운다.
// (설립서류·변경 D-day·활동조사 등의 실제 저장은 2~3단계에서 구현 예정)

import type { LabType } from "../../types";
import { currentMonth, getChangeRecords, getClients, getNoteTargets, getReminders, isCheckDue, isReportSent, type ChangeRecStatus } from "./storage";

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

/** 서비스 분야 추정 (업종 문자열 휴리스틱 — 기준검토표/매출비중 조건 판단용) */
export function isServiceField(industry?: string): boolean {
  return /서비스|소프트웨어|에스더블유|정보|아이티|플랫폼|콘텐츠|디자인|컨설팅|교육|광고|마케팅|물류|유통/.test(industry ?? "");
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

/** 데모 고객사별 목표 준비율(전체 ≈ 이 값) — 칩에서 100/50/15 등 차이가 분명히 보이게 */
const DEMO_TARGET: Record<string, number> = {
  "c-gear": 100, "c-code": 100, "c-bolt": 90,
  "c-daon": 60, "c-packing": 55, "c-living": 50,
  "c-miga": 45, "c-retail": 35, "c-hansol": 25, "c-market": 15,
};
/** 기본 관리 대상으로 먼저 노출할 데모 고객사 (완료형 100% / 진행형 50% 2개만) */
export const DEMO_INITIAL_IDS = ["c-gear", "c-living"];

/** 고객사 id 기반 결정적 해시 */
function idHash(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * 한 고객사의 서류별 상태 도출.
 *  · na → 해당 없음 / 사업자등록증(biz) → 항상 완료
 *  · 목표 준비율(target)에 맞춰 완료 분포를 결정 (해시 기반 결정적)
 *  · 미완료 항목: 필수/작성보조는 준비중(일부 고객 요청중), 요청·해당시는 기본 준비중
 */
function deriveDocs(c: DocClient, target: number): SetupDoc[] {
  return DOC_MASTER.map((m) => {
    let status: DocStatus;
    if (m.na?.(c)) {
      status = "해당 없음";
    } else if (m.key === "biz") {
      status = "완료";
    } else {
      const v = idHash(c.id + m.key) % 100;
      if (v < target) {
        status = "완료";
      } else if (m.cls === "필수" || m.cls === "작성보조") {
        // 미완료는 준비중(기본) / 일부 고객 요청중
        status = idHash(c.id + m.key + "·") % 4 === 0 ? "고객 요청중" : "준비중";
      } else {
        status = "준비중"; // 요청 시/해당 시는 명확히 아닐 때(na)만 해당 없음, 그 외 준비중
      }
    }
    return {
      key: m.key, label: m.label, group: m.group, cls: m.cls, tip: m.tip,
      collapsed: m.collapsed, promptKey: m.promptKey, checklist: m.checklist, status,
    };
  });
}

function stageOf(progress: number): SetupStage {
  return progress >= 100 ? "신고 준비 완료"
    : progress >= 70 ? "최종 검토"
    : progress >= 40 ? "조직도/도면 필요"
    : progress >= 15 ? "서류 준비중"
    : "가능성 체크 완료";
}

/** 고객사 1곳의 설립서류 패키지 생성 (관리 대상 추가 시 — 초기형으로 시작) */
export function buildSetupPackage(c: DocClient): SetupPackage {
  const docs = deriveDocs(c, DEMO_TARGET[c.id] ?? 20);
  const stage = stageOf(docProgressOf(docs));
  return { id: `setup-${c.id}`, clientId: c.id, clientName: c.name, labType: c.labType, stage, docs };
}

export function getSetupPackages(): SetupPackage[] {
  return getClients().map((c) => {
    const docs = deriveDocs(c, DEMO_TARGET[c.id] ?? 30);
    const stage = stageOf(docProgressOf(docs));
    return { id: `setup-${c.id}`, clientId: c.id, clientName: c.name, labType: c.labType, stage, docs };
  });
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
function docProgressOf(docs: SetupDoc[]): number {
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

/* ───────────────── 변경사항 관리 (30일 기한 D-day) ───────────────── */

export type ChangeStatus = "확인 필요" | "고객 자료요청" | "작성중" | "신고 완료" | "해당 없음";

export interface ChangeItem {
  id: string;
  clientName: string;
  item: string;
  /** 변경사유 발생일 (YYYY-MM-DD) */
  occurredDate: string;
  /** 신고기한 (발생일 + 30일) */
  deadline: string;
  status: ChangeStatus;
}

export interface DdayInfo {
  label: string;
  daysLeft: number;
  tone: "ok" | "warn" | "danger" | "over";
}

/** 변경신고 D-day 계산 (사유 발생일 + 30일 기준) */
export function ddayOf(deadline: string): DdayInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadline + "T00:00:00");
  const daysLeft = Math.round((dl.getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return { label: "기한초과", daysLeft, tone: "over" };
  if (daysLeft === 0) return { label: "D-day", daysLeft, tone: "danger" };
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, daysLeft, tone: "danger" };
  if (daysLeft <= 14) return { label: `D-${daysLeft}`, daysLeft, tone: "warn" };
  return { label: `D-${daysLeft}`, daysLeft, tone: "ok" };
}

/** 변경기록 상태 → 화면 표시 상태 매핑 */
function mapChangeStatus(s: ChangeRecStatus): ChangeStatus {
  switch (s) {
    case "확인 필요": return "확인 필요";
    case "변경 예정": return "고객 자료요청";
    case "신고 준비중": return "작성중";
    case "신고 완료": return "신고 완료";
    default: return "확인 필요";
  }
}

/**
 * 변경사항 — 저장소(getChangeRecords)에서 도출한다.
 * 고객사 원본에 존재하는 변경기록만 표시하므로, 고객사/샘플 삭제 시 함께 사라진다(흔적 없음).
 */
export function getChangeItems(): ChangeItem[] {
  const clients = getClients();
  return getChangeRecords()
    .map((r): ChangeItem | null => {
      const client = clients.find((c) => c.id === r.clientId);
      if (!client) return null; // 고객사가 없으면(삭제됨) 제외
      return {
        id: r.id,
        clientName: client.name,
        item: r.reasons[0] ?? r.memo ?? "변경사항",
        occurredDate: r.occurredDate,
        deadline: r.deadline,
        status: mapChangeStatus(r.status),
      };
    })
    .filter((x): x is ChangeItem => x !== null);
}

/* ───────────────── 연구개발활동조사 ───────────────── */

export type SurveyStatus = "자료 미수집" | "작성중" | "제출 완료" | "확인 필요";

export interface SurveyRow {
  clientName: string;
  status: SurveyStatus;
  note: string;
}

/** 활동조사 시즌(1~4월) 여부 — 매년 4월 30일 제출 마감 */
export function isSurveySeason(): boolean {
  const m = new Date().getMonth() + 1;
  return m >= 1 && m <= 4;
}

export function surveyDeadlineLabel(): string {
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  return m <= 4 ? `${y}년 4월 30일` : `${y + 1}년 4월 30일`;
}

export function getSurveyRows(): SurveyRow[] {
  const statuses: SurveyStatus[] = ["제출 완료", "작성중", "자료 미수집", "제출 완료"];
  const notes = [
    "연구개발비 집계 완료 · 제출 확인",
    "인건비 명세 정리 중",
    "고객사 자료 요청 필요",
    "제출 완료 · 접수증 보관",
  ];
  return getClients().map((c, i) => ({
    clientName: c.name,
    status: statuses[i % statuses.length],
    note: notes[i % notes.length],
  }));
}

/* ───────────────── 현장조사(실사) 대비 체크 ───────────────── */

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

/* ───────────────── 안내문/자료실 템플릿 ───────────────── */

export type ResourceCategory = "사후관리" | "설립" | "조사·실사" | "영업";

export interface ResourceTemplate {
  id: string;
  icon: string;
  title: string;
  desc: string;
  body: string;
  category: ResourceCategory;
}

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    id: "note-request",
    category: "사후관리",
    icon: "📓",
    title: "연구노트 자료 요청 (카톡용)",
    desc: "이번 달 연구활동 입력을 요청하는 짧은 메시지",
    body: "안녕하세요, {고객사명} 대표님. {월} 연구소 사후관리를 위해 이번 달 연구활동 내용을 간단히 회신 부탁드립니다. 1) 진행한 연구/테스트 2) 개선·문제점 3) 참여 연구원. 보내주시면 연구노트로 정리해 드리겠습니다. 감사합니다.",
  },
  {
    id: "activity-request",
    category: "사후관리",
    icon: "✍️",
    title: "월간 연구활동 입력 요청",
    desc: "메일용 정식 요청문",
    body: "{고객사명} 담당자님께. 기업부설연구소 인정 유지를 위해 매월 연구개발활동 기록이 필요합니다. {월} 활동 내용을 첨부 양식에 따라 {기한}까지 회신 부탁드립니다. 실제 수행하신 활동을 기반으로 정리되며, 추후 실사·활동조사 대응 자료로 활용됩니다.",
  },
  {
    id: "change-check",
    category: "사후관리",
    icon: "🔄",
    title: "변경사항 확인 요청",
    desc: "월간 변경사항(인력/공간/회사정보) 확인",
    body: "{고객사명} 담당자님, 이번 달 중 다음 변동이 있었는지 확인 부탁드립니다. ① 연구전담요원 입사/퇴사/부서이동 ② 연구공간 변경 ③ 상호/대표자/주소 변경. 변경사항은 발생일로부터 30일 이내 변경신고 대상일 수 있어 빠른 회신 부탁드립니다.",
  },
  {
    id: "researcher-change",
    category: "사후관리",
    icon: "👥",
    title: "연구전담요원 입·퇴사 확인 요청",
    desc: "인력 변동 시 자격·요건 확인",
    body: "{고객사명} 담당자님, 연구전담요원 변동 건 관련하여 다음 자료를 부탁드립니다. ① 변동 인원 성명/일자 ② (입사 시) 최종학력·전공·자격증 사본 ③ 4대보험 가입 확인. 인원 요건과 변경신고 대상 여부를 검토해 안내드리겠습니다.",
  },
  {
    id: "photo-request",
    category: "사후관리",
    icon: "📷",
    title: "연구공간 사진 요청",
    desc: "현판·내부 사진 (신고/실사 대비)",
    body: "{고객사명} 담당자님, 연구소 공간 자료 갱신을 위해 사진을 부탁드립니다. ① 전용 출입구의 현판이 보이는 사진 1장 ② 내부 전경(책상·기자재 포함) 2~3장. 스마트폰 촬영본이면 충분합니다.",
  },
  {
    id: "org-request",
    category: "설립",
    icon: "🧩",
    title: "조직도 자료 요청",
    desc: "회사/연구소 조직 구성 확인",
    body: "{고객사명} 담당자님, 조직도 작성을 위해 다음 정보를 부탁드립니다. ① 대표자 성명 ② 부서별 명칭과 인원수(경영지원/영업/생산 등) ③ 연구소 구성원(연구소장, 연구전담요원, 연구보조원)과 직책. 회신 주시면 신고용 조직도 초안을 만들어 드립니다.",
  },
  {
    id: "floor-request",
    category: "설립",
    icon: "📐",
    title: "도면 자료 요청",
    desc: "층 전체/연구소 내부 도면 작성용",
    body: "{고객사명} 담당자님, 신고용 도면 작성을 위해 다음을 부탁드립니다. ① 사무실 전체 형태(대략적인 스케치/사진 가능) ② 연구소 공간 위치와 출입문 위치 ③ 연구소 내 책상·PC·장비 수량. 정식 CAD 도면이 아니어도 괜찮습니다.",
  },
  {
    id: "survey-guide",
    category: "조사·실사",
    icon: "📋",
    title: "연구개발활동조사 안내 (4월)",
    desc: "연간 제출 의무 안내",
    body: "{고객사명} 대표님, 기업부설연구소 보유 기업은 매년 4월 30일까지 연구개발활동조사표 제출이 의무입니다(미제출 시 인정취소 사유). 저희가 작성을 지원해 드리니, 연구개발비 지출 내역과 연구인력 현황 자료를 {기한}까지 부탁드립니다.",
  },
  {
    id: "inspection-prep",
    category: "조사·실사",
    icon: "🔍",
    title: "현장조사 대비 자료 요청",
    desc: "실사 통보 시 사전 점검",
    body: "{고객사명} 담당자님, 현장조사 대비 사전 점검을 진행합니다. ① 현판 부착 상태 사진 ② 연구공간 현재 사진 ③ 연구전담요원 근무 현황 ④ 최근 연구노트. 점검 후 보완이 필요한 부분을 정리해 안내드리겠습니다.",
  },
  {
    id: "report-send",
    category: "사후관리",
    icon: "📤",
    title: "월간 사후관리 리포트 발송 안내",
    desc: "리포트 발송 시 동봉 메시지",
    body: "{고객사명} 대표님, {월} 연구소 사후관리 리포트를 보내드립니다. 이번 달 연구활동 확인, 변경사항 점검, 인정요건 유지 현황을 정리했습니다. 검토 후 문의사항은 언제든 연락 주세요. 다음 달에도 빠짐없이 챙겨드리겠습니다.",
  },
  {
    id: "contract-proposal",
    category: "영업",
    icon: "🤝",
    title: "사후관리 계약 제안 안내문",
    desc: "신규/기존 고객 사후관리 계약 제안",
    body: "{고객사명} 대표님, 기업부설연구소는 설립보다 유지·관리가 더 중요합니다. 연구노트 미작성, 변경신고 누락, 활동조사 미제출은 인정취소로 이어질 수 있습니다. 월간 사후관리 서비스(연구노트 정리·변경신고 관리·활동조사 대응·월간 리포트)를 제안드립니다. 상세 안내 자료를 함께 보내드립니다.",
  },
];

/* ───────────────── 오늘 할 일 ───────────────── */

export type TaskKind = "설립서류" | "연구노트" | "변경신고" | "리포트" | "사진요청";

export interface TodayTask {
  id: string;
  kind: TaskKind;
  icon: string;
  title: string;
  clientName: string;
  href: string;
  urgent: boolean;
  meta?: string;
}

/** 기존 storage 데이터 + 목업에서 오늘 할 일을 구성 */
export function getTodayTasks(): TodayTask[] {
  const month = currentMonth();
  const tasks: TodayTask[] = [];

  // 설립서류 누락 (실제 고객사 기반)
  for (const pkg of getSetupPackages()) {
    const missing = missingDocs(pkg);
    if (missing.length) {
      tasks.push({
        id: `task-doc-${pkg.id}`,
        kind: "설립서류",
        icon: "📁",
        title: `설립서류 누락 ${missing.length}건 확인`,
        clientName: pkg.clientName,
        href: "/setup-documents",
        urgent: false,
        meta: missing.slice(0, 2).map((d) => d.label).join(", ") + (missing.length > 2 ? " 외" : ""),
      });
    }
  }

  // 연구노트 작성 필요
  for (const t of getNoteTargets(month)) {
    if (t.status === "작성 필요" || t.status === "작성중") {
      tasks.push({
        id: `task-note-${t.project.id}`,
        kind: "연구노트",
        icon: "📓",
        title: t.status === "작성 필요" ? "연구노트 자료 요청" : "연구노트 작성 마무리",
        clientName: t.client?.name ?? "—",
        href: `/notes?client=${t.project.clientId}&project=${t.project.id}&month=${month}`,
        urgent: false,
        meta: t.project.name,
      });
    }
  }

  // 변경신고 D-day (7일 이내·초과는 긴급)
  for (const c of getChangeItems()) {
    if (c.status === "신고 완료" || c.status === "해당 없음") continue;
    const d = ddayOf(c.deadline);
    tasks.push({
      id: `task-chg-${c.id}`,
      kind: "변경신고",
      icon: "🔄",
      title: `변경신고 ${d.label} — ${c.item}`,
      clientName: c.clientName,
      href: "/changes",
      urgent: d.tone === "danger" || d.tone === "over",
      meta: `기한 ${c.deadline.replace(/-/g, ".")}`,
    });
  }

  // 변경 확인 주기 도래 고객사 (정기 확인 루틴)
  const allClients = getClients();
  for (const r of getReminders()) {
    if (!isCheckDue(r)) continue;
    const client = allClients.find((c) => c.id === r.clientId);
    if (!client) continue;
    tasks.push({
      id: `task-cycle-${r.clientId}`,
      kind: "변경신고",
      icon: "⏰",
      title: "변경사항 정기 확인",
      clientName: client.name,
      href: `/changes?client=${r.clientId}`,
      urgent: false,
      meta: "연구노트 작성 및 변경사유 확인 요청 필요",
    });
  }

  // 리포트 발송 대기
  const readyClients = new Set(
    getNoteTargets(month)
      .filter((t) => t.status === "저장 완료")
      .map((t) => t.project.clientId),
  );
  for (const c of getClients()) {
    if (readyClients.has(c.id) && !isReportSent(c.id, month)) {
      tasks.push({
        id: `task-report-${c.id}`,
        kind: "리포트",
        icon: "📤",
        title: "월간 리포트 발송",
        clientName: c.name,
        href: `/clients/${c.id}/report?month=${month}`,
        urgent: false,
      });
    }
  }

  // 긴급 우선 정렬
  tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent));
  return tasks;
}
